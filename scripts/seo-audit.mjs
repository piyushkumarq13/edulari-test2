/**
 * scripts/seo-audit.mjs — npm run seo:audit
 *
 * Fetches every route from a RUNNING production build and checks the SEO contract from
 * AGENTS.md section 11: title, meta description (unique), canonical, Open Graph, Twitter,
 * JSON-LD (parsed), robots directives, and the legacy 301s.
 *
 * Usage: node scripts/seo-audit.mjs            (expects `npm start` on 127.0.0.1:3000)
 */

const BASE = process.env.NEW_BASE ?? "http://127.0.0.1:3000";

/**
 * Public, indexable routes.
 *
 * `ld` is the number of JSON-LD blocks the ORIGINAL PHP template emitted - it was read
 * from the old site, not assumed. `indexable:false` marks templates that ship noindex
 * upstream (report-bug.php does). Matching the original is the goal (AGENTS.md section 2);
 * a page must not gain or lose structured data relative to the PHP it replaces.
 */
const PUBLIC = [
  { p: "/", ld: 2 },
  { p: "/about", ld: 2 },
  { p: "/browse-courses", ld: 1 },
  { p: "/categories", ld: 1 },
  { p: "/category/web-development", ld: 1 },
  { p: "/course/modern-react-typescript", ld: 2 },
  { p: "/contact", ld: 1 },
  { p: "/help-center", ld: 1 },
  { p: "/report-bug", ld: 0, indexable: false },
  { p: "/track-contact", ld: 0 },
  { p: "/track-report", ld: 0 },
  { p: "/verify-certificate", ld: 0 },
];

/** Public but data-dependent: only audited when INSTRUCTOR_SLUG is set in .env.compare. */
const DATA_DEPENDENT = [{ p: "/instructor-profile/{slug}", ld: 3 }];

/** Auth / private routes that must be noindex. */
const PRIVATE = ["/login", "/register", "/forgot-password", "/reset-password",
  "/account-activation", "/verify-email", "/password-reset-after-verify", "/register-success"];

/** Legacy URLs that must 301 to their clean equivalent. */
const LEGACY = [
  ["/index.php", "/"], ["/about.php", "/about"], ["/browse-courses.php", "/browse-courses"],
  ["/categories.php", "/categories"], ["/contact.php", "/contact"], ["/login.php", "/login"],
  ["/register.php", "/register"], ["/cart.php", "/cart"], ["/help-center.php", "/help-center"],
  ["/public/about", "/about"], ["/public/index.php", "/"],
];

const pick = (html, re) => html.match(re)?.[1] ?? null;

function analyse(html) {
  const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const canonical = pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const robots = pick(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);
  const ogTitle = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const ogType = pick(html, /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i);
  const ogUrl = pick(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["']/i);
  const twCard = pick(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i);
  const twTitle = pick(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']*)["']/i);

  const ld = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      ld.push({ ok: true, data: JSON.parse(m[1]) });
    } catch (e) {
      ld.push({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { title, desc, canonical, robots, ogTitle, ogType, ogUrl, twCard, twTitle, ld };
}

const env = {};
try {
  const cfg = await (await import("node:fs/promises")).readFile(
    new URL("./ui-compare/.env.compare", import.meta.url), "utf8");
  for (const line of cfg.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* optional */ }

const ROUTES = [...PUBLIC];
if (env.INSTRUCTOR_SLUG) ROUTES.push({ ...DATA_DEPENDENT[0], p: `/instructor-profile/${env.INSTRUCTOR_SLUG}` });

const rows = [];
const descSeen = new Map();
const titleSeen = new Map();
const fails = [];

for (const def of ROUTES) {
  const path = def.p;
  let res, html = "";
  try {
    res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    html = await res.text();
  } catch (err) {
    fails.push(`${path} FETCH FAILED: ${err instanceof Error ? err.message : err}`);
    continue;
  }
  const a = analyse(html);
  const problems = [];
  if (res.status !== 200) problems.push(`status ${res.status}`);
  if (!a.title) problems.push("no <title>");
  if (!a.desc) problems.push("no meta description");
  if (!a.canonical) problems.push("no canonical");
  if (!a.ogTitle) problems.push("no og:title");
  if (!a.ogUrl) problems.push("no og:url");
  if (!a.twCard) problems.push("no twitter:card");
  // Structured data must match the PHP template it replaces - no more, no less.
  if (a.ld.length !== def.ld) problems.push(`JSON-LD count ${a.ld.length}, PHP has ${def.ld}`);
  for (const l of a.ld) if (!l.ok) problems.push(`JSON-LD parse error: ${l.error}`);
  if (def.indexable === false) {
    if (!a.robots || !/noindex/i.test(a.robots)) problems.push(`template is noindex upstream but robots=${a.robots ?? "none"}`);
  } else if (a.robots && /noindex/i.test(a.robots)) {
    problems.push(`public page is noindex (${a.robots})`);
  }

  if (a.desc) {
    if (descSeen.has(a.desc)) problems.push(`duplicate description (also ${descSeen.get(a.desc)})`);
    else descSeen.set(a.desc, path);
  }
  if (a.title) {
    if (titleSeen.has(a.title)) problems.push(`duplicate title (also ${titleSeen.get(a.title)})`);
    else titleSeen.set(a.title, path);
  }

  rows.push({
    path, status: res.status, title: a.title, descLen: a.desc?.length ?? 0,
    canonical: a.canonical, ogUrl: a.ogUrl, twitter: a.twCard, ldCount: a.ld.length,
    ldTypes: a.ld.filter((l) => l.ok).map((l) => Array.isArray(l.data) ? l.data.map((d) => d["@type"]) : l.data?.["@type"]).flat().join(","),
    robots: a.robots, problems,
  });
  if (problems.length) fails.push(`${path}: ${problems.join("; ")}`);
}

const privateRows = [];
for (const path of PRIVATE) {
  let res, html = "";
  try {
    res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    html = await res.text();
  } catch { fails.push(`${path} FETCH FAILED`); continue; }
  const a = analyse(html);
  const noindex = a.robots ? /noindex/i.test(a.robots) : /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const ok = res.status === 200 && noindex;
  if (!ok) fails.push(`${path}: private route not noindex (status ${res.status}, robots=${a.robots ?? "none"})`);
  privateRows.push({ path, status: res.status, noindex, ok });
}

const legacyRows = [];
for (const [from, to] of LEGACY) {
  let res;
  try { res = await fetch(`${BASE}${from}`, { redirect: "manual" }); } catch { fails.push(`${from} FETCH FAILED`); continue; }
  const loc = res.headers.get("location");
  const permanent = res.status === 301 || res.status === 308;
  const correct = loc ? loc.replace(/\/$/, "") === (to === "/" ? "" : to) : false;
  const ok = permanent && correct;
  if (!ok) fails.push(`${from}: expected 301 -> ${to}, got ${res.status} -> ${loc}`);
  legacyRows.push({ from, status: res.status, location: loc, ok });
}

const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const sitemap = {
  isXml: /<\?xml/.test(xml),
  hasUrlset: /<urlset/.test(xml),
  locCount: (xml.match(/<loc>/g) ?? []).length,
  includesPublishedCourse: /\/course\/[a-z0-9-]+/.test(xml),
  includesCategory: /\/category\/[a-z0-9-]+/.test(xml),
  hasHttpsLoc: !/<loc>http:\/\//.test(xml),
};
if (!sitemap.isXml || !sitemap.hasUrlset || sitemap.locCount === 0) fails.push("sitemap.xml invalid or empty");
if (!sitemap.hasHttpsLoc) fails.push("sitemap.xml contains non-https loc");

const robotsTxt = await (await fetch(`${BASE}/robots.txt`)).text();
const robots = {
  hasSitemap: /Sitemap:/i.test(robotsTxt),
  sitemapUrl: robotsTxt.match(/Sitemap:\s*(\S+)/i)?.[1] ?? null,
  disallowAdmin: /Disallow:\s*\/admin/i.test(robotsTxt),
  disallowApi: /Disallow:\s*\/api/i.test(robotsTxt),
  disallowStudent: /Disallow:\s*\/student/i.test(robotsTxt),
};
if (!robots.hasSitemap) fails.push("robots.txt has no Sitemap: directive");

const notFound = await fetch(`${BASE}/definitely-not-a-real-page-xyz`, { redirect: "manual" });
if (notFound.status !== 404) fails.push(`404 route returned ${notFound.status}, expected 404`);

const headerRes = await fetch(`${BASE}/`);
const headers = {
  hsts: headerRes.headers.get("strict-transport-security"),
  nosniff: headerRes.headers.get("x-content-type-options"),
  frame: headerRes.headers.get("x-frame-options"),
  referrer: headerRes.headers.get("referrer-policy"),
  permissions: headerRes.headers.get("permissions-policy"),
  csp: Boolean(headerRes.headers.get("content-security-policy")),
};
if (!headers.nosniff) fails.push("missing X-Content-Type-Options");
if (!headers.frame) fails.push("missing X-Frame-Options");
if (!headers.csp) fails.push("missing Content-Security-Policy");

console.log("\n=== SEO audit ===\n");
console.log("Public routes");
console.log("| path | status | title | desc | canonical | og:url | twitter | JSON-LD |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(`| ${r.path} | ${r.status} | ${r.title ? "yes" : "MISSING"} | ${r.descLen}c | ${r.canonical ? "yes" : "MISSING"} | ${r.ogUrl ? "yes" : "MISSING"} | ${r.twitter ? "yes" : "MISSING"} | ${r.ldCount} (${r.ldTypes || "none"}) |`);
}
console.log("\nPrivate routes (must be noindex)");
for (const r of privateRows) console.log(`| ${r.path} | ${r.status} | noindex=${r.noindex} | ${r.ok ? "ok" : "FAIL"} |`);
console.log("\nLegacy redirects (must be 301)");
for (const r of legacyRows) console.log(`| ${r.from} | ${r.status} -> ${r.location ?? "-"} | ${r.ok ? "ok" : "FAIL"} |`);
console.log("\nsitemap.xml", JSON.stringify(sitemap));
console.log("robots.txt ", JSON.stringify(robots));
console.log("404 status ", notFound.status);
console.log("headers    ", JSON.stringify({ ...headers, csp: headers.csp }));

console.log(`\nunique descriptions: ${descSeen.size}/${rows.length}`);
console.log(`unique titles:       ${titleSeen.size}/${rows.length}`);
console.log(`\n${fails.length ? `FAILURES (${fails.length}):` : "NO FAILURES"}`);
for (const f of fails) console.log("  - " + f);

process.exitCode = fails.length ? 1 : 0;