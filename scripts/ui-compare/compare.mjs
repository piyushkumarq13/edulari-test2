/**
 * npm run ui-compare
 *
 * Pixel/DOM parity harness: drives the OLD PHP site and the NEW Next app in headless
 * Chromium across every required viewport, pairs elements, compares computed styles and
 * geometry, and diffs full-page screenshots with pixelmatch.
 *
 * Usage
 *   npm run ui-compare                       # all pages, all viewports
 *   npm run ui-compare -- --page cart        # one page (substring match on id)
 *   npm run ui-compare -- --viewport 375     # one viewport
 *   npm run ui-compare -- --site new         # only the new site (no old site needed)
 *   npm run ui-compare -- --no-screenshots   # skip pixelmatch (DOM only)
 *
 * Configuration (scripts/ui-compare/.env.compare, git-ignored, never printed):
 *   OLD_BASE, NEW_BASE, COMPARE_EMAIL, COMPARE_PASSWORD, INSTRUCTOR_SLUG, ORDER_ID
 *
 * Outputs
 *   docs/ui-parity/JSON/<page>-<viewport>.json    full detail
 *   docs/ui-parity/shots/<page>-<viewport>-{old,new,diff}.png
 *   docs/UI_PARITY_REPORT.md                      human summary, sorted by impact
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { OLD_BASE, NEW_BASE, PAGES, allViewports } from "./config.mjs";
import { collect } from "./collect.mjs";
import { diffSnapshots } from "./diff.mjs";

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const flag = (name) => argv.includes(`--${name}`);

const pageFilter = arg("page");
const viewportFilter = arg("viewport")
  ? arg("viewport")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n))
  : null;
const onlySite = arg("site");
const wantShots = !flag("no-screenshots");
const limitPages = arg("limit") ? Number(arg("limit")) : null;

// ── config file ───────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(process.cwd(), "scripts", "ui-compare", ".env.compare");
const compareEnv = {};
if (fs.existsSync(CONFIG_PATH)) {
  for (const line of fs.readFileSync(CONFIG_PATH, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    compareEnv[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const OLD = compareEnv.OLD_BASE ?? OLD_BASE;
const NEW = compareEnv.NEW_BASE ?? NEW_BASE;

const OUT = path.join(process.cwd(), "docs", "ui-parity");
const SHOTS = path.join(OUT, "shots");
const JSONS = path.join(OUT, "JSON");
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(JSONS, { recursive: true });

// ── health checks ─────────────────────────────────────────────────────────────
async function reachable(base) {
  try {
    const res = await fetch(base, { redirect: "manual" });
    return { ok: res.status > 0, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

const needOld = onlySite !== "new";
const newHealth = await reachable(NEW);
const oldHealth = needOld ? await reachable(OLD) : { ok: true, status: 0 };

console.log(`\n=== UI parity compare ===`);
console.log(`  new site : ${NEW}  ${newHealth.ok ? `HTTP ${newHealth.status}` : "UNREACHABLE"}`);
if (needOld) console.log(`  old site : ${OLD}  ${oldHealth.ok ? `HTTP ${oldHealth.status}` : "UNREACHABLE"}`);

if (!newHealth.ok) {
  console.error(`\nThe new site is not running at ${NEW}. Start it with:\n  npm run build && npm start\n`);
  process.exit(2);
}
if (needOld && !oldHealth.ok) {
  console.error(`\nThe old PHP site is not running at ${OLD}. See docs/UI_COMPARE.md section 2.`);
  console.error(`To run DOM-only checks on the new site, re-run with:  npm run ui-compare -- --site new\n`);
  process.exit(2);
}

// ── login (per site) ──────────────────────────────────────────────────────────
async function loginState(browser, base, creds) {
  const email = creds?.email;
  const password = creds?.password;
  if (!email || !password) return { state: null, note: "credentials not set - authenticated pages will be skipped" };

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-IN" });
  const p = await ctx.newPage();
  // The CSRF cookie is httpOnly, so JS cannot read it; the token is rendered into a hidden
  // input on /login instead (and the middleware forwards the cookie to that same render).
  // The POST runs as an in-page fetch exactly like LoginForm does - Playwright's API request
  // context will not send a Secure cookie over http, but the browser context does.
  await p.goto(`${base}/login`, { waitUntil: "domcontentloaded" }).catch(() => {});
  const csrf = await p.$eval('input[name="csrf_token"]', (el) => el.value).catch(() => "");
  const res = await p
    .evaluate(
      async ({ email, password, csrf }) => {
        const fd = new FormData();
        fd.set("email", email);
        fd.set("password", password);
        fd.set("csrf_token", csrf);
        const r = await fetch("/api/auth/login", { method: "POST", body: fd });
        let body = null;
        try {
          body = await r.json();
        } catch {}
        return { ok: r.ok, status: r.status, body };
      },
      { email, password, csrf },
    )
    .catch(() => null);
  let ok = Boolean(res && res.ok);
  if (ok) {
    // A 200 from the login route is not enough: confirm the session cookie really landed,
    // otherwise every "authenticated" page below silently captures a redirect payload.
    const probe = await p.goto(`${base}/student/dashboard`, { waitUntil: "domcontentloaded" }).catch(() => null);
    ok = Boolean(probe && !probe.url().includes("/login"));
  }
  const status = res ? res.status : "n/a";
  const state = ok ? await ctx.storageState() : null;
  await ctx.close();
  // On failure return a null state so the page loop SKIPS authenticated pages rather than
  // silently comparing the redirected login page.
  return ok
    ? { state, note: "logged in" }
    : { state: null, note: `login failed (HTTP ${status}) - authenticated pages skipped` };
}

// ── pixel diff ────────────────────────────────────────────────────────────────
function pixelDiff(oldPng, newPng) {
  const width = Math.min(oldPng.width, newPng.width);
  const height = Math.min(oldPng.height, newPng.height);
  const out = new PNG({ width, height });
  const oldC = PNG.sync.read(oldPng);
  const newC = PNG.sync.read(newPng);

  // Crop the taller side so differing page lengths still compare pixel-for-pixel
  // over the shared region, and record the height delta separately.
  const crop = (src) => {
    const dst = new PNG({ width, height });
    PNG.bitblt(src, dst, 0, 0, width, height, 0, 0);
    return dst;
  };

  const a = crop(oldC);
  const b = crop(newC);

  const diffPixels = pixelmatch(a.data, b.data, out.data, width, height, { threshold: 0.1, includeAA: false });
  const total = width * height;
  return {
    percent: total ? (diffPixels / total) * 100 : 0,
    diffPixels,
    width,
    height,
    oldFullHeight: oldC.height,
    newFullHeight: newC.height,
    png: PNG.sync.write(out),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const results = [];
const skipped = [];

try {
  const oldAuth = needOld
    ? await loginState(browser, OLD, { email: compareEnv.COMPARE_EMAIL, password: compareEnv.COMPARE_PASSWORD })
    : { state: null };
  const newAuth = await loginState(browser, NEW, { email: compareEnv.COMPARE_EMAIL, password: compareEnv.COMPARE_PASSWORD });
  const newAdminAuth = await loginState(browser, NEW, {
    email: compareEnv.COMPARE_ADMIN_EMAIL,
    password: compareEnv.COMPARE_ADMIN_PASSWORD,
  });
  console.log(`  auth     : new (student) - ${newAuth.note}`);
  console.log(`             new (admin)   - ${newAdminAuth.note}`);
  if (needOld) console.log(`             old - ${oldAuth.note}`);

  const viewports = viewportFilter && viewportFilter.length ? viewportFilter : allViewports();
  let pages = PAGES;
  if (pageFilter) pages = pages.filter((p) => p.id.includes(pageFilter));
  if (limitPages) pages = pages.slice(0, limitPages);

  console.log(`  pages    : ${pages.length}`);
  console.log(`  viewports: ${viewports.join(", ")}\n`);

  for (const pageDef of pages) {
    for (const vp of viewports) {
      // A detail page needs a real entity id; skip (never mis-capture) when it is unset.
      const missingEnv = (pageDef.requiresEnv ?? []).filter((k) => !compareEnv[k]);
      if (missingEnv.length) {
        skipped.push({ page: pageDef.id, viewport: vp, reason: `set ${missingEnv.join(", ")} in .env.compare` });
        continue;
      }

      const resolved = {
        ...pageDef,
        path: pageDef.path
          .replace("{INSTRUCTOR_SLUG}", compareEnv.INSTRUCTOR_SLUG ?? "1")
          .replace("{ORDER_ID}", compareEnv.ORDER_ID ?? "")
          .replace("{COURSE_ID}", compareEnv.COURSE_ID ?? "")
          .replace("{ADMIN_USER_ID}", compareEnv.ADMIN_USER_ID ?? "")
          .replace("{APPLICATION_ID}", compareEnv.APPLICATION_ID ?? "")
          .replace("{EDIT_COURSE_ID}", compareEnv.EDIT_COURSE_ID ?? "")
          .replace("{BUG_ID}", compareEnv.BUG_ID ?? "")
          .replace("{CONTACT_ID}", compareEnv.CONTACT_ID ?? ""),
      };
      const tag = `${resolved.id}-${vp}`;

      const isAdmin = resolved.role === "admin";
      const siteAuth = isAdmin ? newAdminAuth : newAuth;
      if (resolved.auth && !siteAuth.state) {
        skipped.push({ page: resolved.id, viewport: vp, reason: isAdmin ? "no admin compare login" : "no compare login" });
        continue;
      }
      if (resolved.auth && needOld && !oldAuth.state) {
        skipped.push({ page: resolved.id, viewport: vp, reason: "no old-site login" });
        continue;
      }

      const optsNew = { base: NEW, page: resolved, viewport: vp, storageState: siteAuth.state };
      const newSnap = await collect(browser, optsNew);

      let oldSnap = null;
      if (needOld) {
        try {
          oldSnap = await collect(browser, { base: OLD, page: resolved, viewport: vp, storageState: oldAuth.state });
        } catch (err) {
          oldSnap = null;
          console.log(`  ! ${tag}: old site collect failed - ${err instanceof Error ? err.message : err}`);
        }
      }

      // Requests must land on the same page; a redirect on one side only is a mismatch.
      const entry = { page: resolved.id, viewport: vp, path: resolved.path, newStatus: newSnap.status, oldStatus: oldSnap?.status ?? null };

      if (oldSnap) {
        if (oldSnap.status !== newSnap.status) {
          entry.mismatches = [
            { kind: "meta", selector: "document", property: "http-status", old: oldSnap.status, new: newSnap.status, impact: 100 },
          ];
          entry.oldStylesheets = oldSnap.stylesheets;
          entry.newStylesheets = newSnap.stylesheets;
          results.push(entry);
          continue;
        }

        const { mismatches, onlyOld, onlyNew } = diffSnapshots(oldSnap, newSnap);
        entry.mismatches = mismatches;
        entry.onlyOld = onlyOld.map((e) => ({ tag: e.tag, id: e.id, classes: e.classes }));
        entry.onlyNew = onlyNew.map((e) => ({ tag: e.tag, id: e.id, classes: e.classes }));
        entry.oldStylesheets = oldSnap.stylesheets;
        entry.newStylesheets = newSnap.stylesheets;
        entry.oldFonts = oldSnap.fonts;
        entry.newFonts = newSnap.fonts;
        entry.newAppliedStylesheets = newSnap.appliedStylesheets;
        entry.newPreloadedOnlyStylesheets = newSnap.preloadedOnlyStylesheets;

        if (wantShots && oldSnap.screenshot?.length && newSnap.screenshot?.length) {
          try {
            const pd = pixelDiff(oldSnap.screenshot, newSnap.screenshot);
            entry.pixelDiffPercent = Math.round(pd.percent * 100) / 100;
            entry.pixelDiffPixels = pd.diffPixels;
            fs.writeFileSync(path.join(SHOTS, `${tag}-old.png`), oldSnap.screenshot);
            fs.writeFileSync(path.join(SHOTS, `${tag}-new.png`), newSnap.screenshot);
            fs.writeFileSync(path.join(SHOTS, `${tag}-diff.png`), pd.png);
          } catch (err) {
            entry.pixelDiffError = err instanceof Error ? err.message : String(err);
          }
        }
      } else {
        // New-site-only mode: record facts without a verdict.
        entry.newStylesheets = newSnap.stylesheets;
        entry.newFonts = newSnap.fonts;
        entry.pageHeight = newSnap.pageHeight;
        entry.horizontalOverflow = newSnap.horizontalOverflow;
        entry.newAppliedStylesheets = newSnap.appliedStylesheets;
        entry.newPreloadedOnlyStylesheets = newSnap.preloadedOnlyStylesheets;
        entry.newElements = newSnap.elements?.length ?? 0;
        entry.mismatches = [];
        entry.mode = "new-only";
        if (wantShots) fs.writeFileSync(path.join(SHOTS, `${tag}-new.png`), newSnap.screenshot);
      }

      fs.writeFileSync(
        path.join(JSONS, `${tag}.json`),
        JSON.stringify({ ...entry, newImages: newSnap.images }, null, 2),
        "utf8",
      );
      results.push(entry);

      const n = entry.mismatches?.length ?? 0;
      const pd = entry.pixelDiffPercent !== undefined ? `  px=${entry.pixelDiffPercent}%` : "";
      console.log(`  ${n === 0 ? "ok  " : "DIFF"} ${tag}  mismatches=${n}${pd}`);
    }
  }
} finally {
  await browser.close();
}

// ── summary ───────────────────────────────────────────────────────────────────
const allMismatches = results.flatMap((r) => (r.mismatches ?? []).map((m) => ({ ...m, page: r.page, viewport: r.viewport })));
allMismatches.sort((a, b) => b.impact - a.impact);

const byPage = {};
for (const r of results) byPage[r.page] = byPage[r.page] ?? { page: r.page, mismatches: 0, viewports: 0, pixel: [] };
for (const r of results) {
  byPage[r.page].viewports++;
  byPage[r.page].mismatches += r.mismatches?.length ?? 0;
  if (r.pixelDiffPercent !== undefined) byPage[r.page].pixel.push(r.pixelDiffPercent);
}
const pageRows = Object.values(byPage).sort((a, b) => b.mismatches - a.mismatches);

const lines = [];
lines.push("# UI parity report");
lines.push("");
lines.push("> Generated by `npm run ui-compare`. This file is overwritten on every run.");
lines.push("> The structural findings and root causes from the Phase 4/5 parity fix pass live in");
lines.push("> `docs/UI_PARITY_AUDIT.md` and are not regenerated here.");
lines.push("");
lines.push(`Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")}.`);
lines.push("");
lines.push(`- old site: ${needOld ? OLD : "(skipped - --site new)"}`);
lines.push(`- new site: ${NEW}`);
lines.push(`- viewports compared: ${[...new Set(results.map((r) => r.viewport))].sort((a, b) => b - a).join(", ")}`);
lines.push(`- total mismatches above tolerance: **${allMismatches.length}**`);

// Unstyled-page gate: a page with rendered content but no applied same-origin stylesheet
// renders unstyled. A DOM diff cannot see that (with no CSS there is no layout to
// compare), so it has to be asserted explicitly or the gate silently "passes" an
// unstyled site.
const unstyled = results.filter((r) => {
  const applied = r.newAppliedStylesheets;
  return Array.isArray(applied) && applied.length === 0 && (r.newElements ?? 0) > 0;
});
lines.push(`- pages rendering with unapplied (preloaded-only) CSS: **${unstyled.length}**`);
if (unstyled.length) {
  lines.push("");
  lines.push("## BLOCKER: stylesheets are preloaded but never applied");
  lines.push("");
  lines.push("These pages fetched their CSS (HTTP 200) but the browser never attached a");
  lines.push("`link rel=\"stylesheet\"`, so they render unstyled. This is a rendering failure, not a");
  lines.push("parity difference, and it is invisible to a DOM diff - fix it before trusting any");
  lines.push("number in this report.");
  lines.push("");
  for (const r of unstyled) {
    lines.push(`- ${r.id} @${r.viewport}: ${(r.newPreloadedOnlyStylesheets ?? []).join(", ")}`);
  }
}

if (onlySite === "new") {
  lines.push("");
  lines.push("## No numeric verdict in this run");
  lines.push("");
  lines.push("This run used `--site new`, so the old PHP site was never loaded. There is **no");
  lines.push("old-vs-new pixel or computed-style comparison in this report** - only the new site's");
  lines.push("own facts (applied stylesheets, fonts in use, page height, horizontal overflow, and a");
  lines.push("screenshot per page+viewport). Those alone catch a missing stylesheet, a wrong font");
  lines.push("stack or an extra navbar, but they cannot produce a parity verdict.");
  lines.push("");
  lines.push("See `docs/UI_COMPARE.md` sections 2 and 4 to start the old site and seed both sides,");
  lines.push("then re-run without `--site new`.");
} else if (!oldAuth.state) {
  lines.push("");
  lines.push("## Partial run");
  lines.push("");
  lines.push(`No old-site login was available (${oldAuth.note}), so the authenticated pages were`);
  lines.push("skipped. Public pages were compared normally.");
}
lines.push("");

lines.push("## Per page");
lines.push("");
lines.push("| page | viewports | mismatches | max pixel diff |");
lines.push("|---|---|---|---|");
for (const p of pageRows) {
  const maxPx = p.pixel.length ? `${Math.max(...p.pixel).toFixed(2)}%` : "n/a";
  lines.push(`| ${p.page} | ${p.viewports} | ${p.mismatches} | ${maxPx} |`);
}
lines.push("");

if (allMismatches.length === 0) {
  lines.push("## Mismatches");
  lines.push("");
  lines.push("None above tolerance.");
} else {
  lines.push("| page | viewport | selector | property | old | new | impact |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const m of allMismatches.slice(0, 400)) {
    lines.push(`| ${m.page} | ${m.viewport} | \`${m.selector}\` | ${m.property} | \`${String(m.old).slice(0, 60)}\` | \`${String(m.new).slice(0, 60)}\` | ${m.impact} |`);
  }
  if (allMismatches.length > 400) lines.push(`\n_... and ${allMismatches.length - 400} more (see docs/ui-parity/JSON/)._`);
}
lines.push("");

if (!needOld) {
  lines.push("## New-site facts (no old site to compare against)");
  lines.push("");
  lines.push("| page | height | horizontal overflow | fonts in use | page stylesheet |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    if (r.mode !== "new-only") continue;
    const fonts = (r.newFonts ?? []).map((f) => f.split(",")[0]).join(" + ");
    const sheets = (r.newStylesheets ?? []).filter((s) => s.includes("fonts.googleapis") || s.includes("/assets/css/")).join(" ");
    lines.push(`| ${r.page} @${r.viewport} | ${r.pageHeight} | ${r.horizontalOverflow} | ${fonts} | ${sheets || "(Next CSS chunks)"} |`);
  }
  lines.push("");
  lines.push("Rows for the page CSS of the other pages are in `docs/php-stylesheet-order.json`,");
  lines.push("which is the authoritative per-page stylesheet list.");
  lines.push("");
}

if (skipped.length) {
  lines.push("## Skipped");
  lines.push("");
  for (const s of skipped) lines.push(`- ${s.page} @ ${s.viewport}: ${s.reason}`);
  lines.push("");
}

fs.writeFileSync(path.join(process.cwd(), "docs", "UI_PARITY_REPORT.md"), lines.join("\n"), "utf8");
fs.writeFileSync(path.join(JSONS, "_summary.json"), JSON.stringify({ results: results.map((r) => ({ ...r, mismatches: r.mismatches?.length ?? 0 })) }, null, 2), "utf8");

console.log(`\ntotal mismatches: ${allMismatches.length}`);
console.log(`unstyled pages  : ${unstyled.length}${unstyled.length ? "  <-- BLOCKER, CSS preloaded but never applied" : ""}`);
console.log(`report: docs/UI_PARITY_REPORT.md`);
console.log(`json  : docs/ui-parity/JSON/\n`);
process.exit(allMismatches.length === 0 && unstyled.length === 0 ? 0 : 1);
