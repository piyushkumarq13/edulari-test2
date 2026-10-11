/**
 * Builds the reference table of the exact ordered stylesheet list every in-scope PHP
 * page makes the browser load, then diffs it against what the Next.js pages import.
 *
 * Why order matters: navbar.php emits <link ... navbar.css> from INSIDE <body>, so
 * navbar.css is always the LAST stylesheet the browser applies. base.css and the
 * page's $extraCss land in <head> before it. Reproducing that order is required or
 * shared selectors (body, .btn, headings) resolve to the wrong file.
 *
 *   node scripts/php-stylesheet-order.mjs
 */
import fs from "node:fs";
import path from "node:path";

const OLD_PUBLIC = process.env.OLD_PUBLIC ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\htdocs\\public";
const NEW_ROOT = process.env.NEW_ROOT ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\Edulari";

/** php page basename -> [old relative path, new page dir, label] */
const PAGES = [
  ["index.php", "index.php", "app/(site)", "home"],
  ["about.php", "page/about.php", "app/(site)/about", "about"],
  ["browse-courses.php", "browse-courses.php", "app/(site)/browse-courses", "browse courses"],
  ["categories.php", "categories.php", "app/(site)/categories", "categories"],
  ["category.php", "page/category.php", "app/(site)/category/[slug]", "category detail"],
  ["course.php", "course.php", "app/(site)/course/[slug]", "course detail"],
  ["instructor-profile.php", "instructor-profile.php", "app/(site)/instructor-profile/[slug]", "instructor profile public"],
  ["contact.php", "contact.php", "app/(site)/contact", "contact"],
  ["track-contact.php", "track-contact.php", "app/(site)/track-contact", "track contact"],
  ["help-center.php", "help-center.php", "app/(site)/help-center", "help center"],
  ["report-bug.php", "report-bug.php", "app/(site)/report-bug", "report bug"],
  ["track-report.php", "track-report.php", "app/(site)/track-report", "track report"],
  ["security.php", "security.php", "app/(site)/security", "security"],
  ["updates.php", "updates.php", "app/(site)/updates", "updates"],
  ["demo.php", "demo.php", "app/demo", "demo"],
  ["verify-certificate.php", "verify-certificate.php", "app/(foot)/verify-certificate", "verify certificate"],
  ["login.php", "login.php", "app/login", "login"],
  ["register.php", "register.php", "app/register", "register"],
  ["register-success.php", "register-success.php", "app/register-success", "register success"],
  ["account-activation.php", "account-activation.php", "app/account-activation", "account activation"],
  ["verify-email.php", "verify-email.php", "app/verify-email", "verify email"],
  ["forgot-password.php", "forgot-password.php", "app/forgot-password", "forgot password"],
  ["reset-password.php", "reset-password.php", "app/reset-password", "reset password"],
  ["password-reset-after-verify.php", "password-reset-after-verify.php", "app/password-reset-after-verify", "password reset after verify"],
  ["cart.php", "cart.php", "app/(site)/cart", "cart"],
  ["wishlist.php", "wishlist.php", "app/(site)/wishlist", "wishlist"],
  ["checkout.php", "checkout.php", "app/(site)/checkout", "checkout"],
  ["purchase-history.php", "student/purchase-history.php", "app/(site)/student/purchase-history", "purchase history"],
  ["receipt.php", "student/receipt.php", "app/student/receipt", "receipt"],
  ["check-payment-status.php", "student/check-payment-status.php", null, "check payment status"],
  ["onboarding.php", "student/onboarding.php", "app/(student)/student/onboarding", "onboarding"],
  ["dashboard.php", "student/dashboard.php", "app/(site)/student/dashboard", "student dashboard"],
  ["my-courses.php", "student/my-courses.php", "app/(site)/student/my-courses", "my courses"],
  ["learn.php", "student/learn.php", "app/(student)/student/learn", "learn"],
  ["profile.php", "student/profile.php", "app/(site)/student/profile", "student profile"],
  ["grades.php", "student/grades.php", "app/(site)/student/grades", "grades"],
  ["certificates.php", "student/certificates.php", "app/(site)/student/certificates", "certificates"],
  ["generate-certificate.php", "student/generate-certificate.php", "app/(student)/student/generate-certificate", "generate certificate"],
  ["schedule.php", "student/schedule.php", "app/(site)/student/schedule", "schedule"],
  ["course-ai-shared.php", "course-ai-shared.php", "app/(student)/course-ai-shared", "shared ai chat"],
  // Phase 7: instructor registration wizard + competency test.
  ["step-1.php", "instructor-register/step-1.php", "app/instructor-register/step-1", "instructor register step 1"],
  ["step-2.php", "instructor-register/step-2.php", "app/instructor-register/step-2", "instructor register step 2"],
  ["step-3.php", "instructor-register/step-3.php", "app/instructor-register/step-3", "instructor register step 3"],
  ["step-4.php", "instructor-register/step-4.php", "app/instructor-register/step-4", "instructor register step 4"],
  ["step-5.php", "instructor-register/step-5.php", "app/instructor-register/step-5", "instructor register step 5"],
  ["step-6.php", "instructor-register/step-6.php", "app/instructor-register/step-6", "instructor register step 6"],
  ["step-7.php", "instructor-register/step-7.php", "app/instructor-register/step-7", "instructor register step 7"],
  ["step-8.php", "instructor-register/step-8.php", "app/instructor-register/step-8", "instructor register step 8"],
  ["instructor-register-success.php", "instructor-register-success.php", "app/instructor-register-success", "instructor register success"],
  ["index.php", "test/index.php", "app/test", "competency test"],
  // Phase 8: the instructor panel.
  ["dashboard.php", "instructor/dashboard.php", "app/(site)/instructor/dashboard", "instructor dashboard"],
  ["courses.php", "instructor/courses.php", "app/(site)/instructor/courses", "instructor courses"],
  ["create-course.php", "instructor/create-course.php", "app/(site)/instructor/create-course", "instructor create course"],
  ["edit-course.php", "instructor/edit-course.php", "app/(site)/instructor/edit-course", "instructor edit course"],
  ["course-content.php", "instructor/course-content.php", "app/(site)/instructor/course-content", "instructor course content"],
  ["course-analytics.php", "instructor/course-analytics.php", "app/(site)/instructor/course-analytics", "instructor course analytics"],
  ["analytics.php", "instructor/analytics.php", "app/(site)/instructor/analytics", "instructor analytics"],
  ["students.php", "instructor/students.php", "app/(site)/instructor/students", "instructor students"],
  ["reviews.php", "instructor/reviews.php", "app/(site)/instructor/reviews", "instructor reviews"],
  ["earnings.php", "instructor/earnings.php", "app/(site)/instructor/earnings", "instructor earnings"],
  ["profile.php", "instructor/profile.php", "app/(site)/instructor/profile", "instructor profile panel"],
  // Phase 9: the admin area (all templates include navbar.php + footer.php -> (site) chrome).
  ["dashboard.php", "admin/dashboard.php", "app/(site)/admin/dashboard", "admin dashboard"],
  ["users.php", "admin/users.php", "app/(site)/admin/users", "admin users"],
  ["user-detail.php", "admin/user-detail.php", "app/(site)/admin/user-detail", "admin user detail"],
  ["instructor-applications.php", "admin/instructor-applications.php", "app/(site)/admin/instructor-applications", "admin instructor applications"],
  ["instructor-application-detail.php", "admin/instructor-application-detail.php", "app/(site)/admin/instructor-application-detail", "admin instructor application detail"],
  ["courses.php", "admin/courses.php", "app/(site)/admin/courses", "admin courses"],
  ["create-course.php", "admin/create-course.php", "app/(site)/admin/create-course", "admin create course"],
  ["edit-course.php", "admin/edit-course.php", "app/(site)/admin/edit-course", "admin edit course"],
  ["categories.php", "admin/categories.php", "app/(site)/admin/categories", "admin categories"],
  ["enrollments.php", "admin/enrollments.php", "app/(site)/admin/enrollments", "admin enrollments"],
  ["reviews.php", "admin/reviews.php", "app/(site)/admin/reviews", "admin reviews"],
  ["banners.php", "admin/banners.php", "app/(site)/admin/banners", "admin banners"],
  ["send-notifications.php", "admin/send-notifications.php", "app/(site)/admin/send-notifications", "admin send notifications"],
  ["settings.php", "admin/settings.php", "app/(site)/admin/settings", "admin settings"],
  ["bug-reports.php", "admin/bug-reports.php", "app/(site)/admin/bug-reports", "admin bug reports"],
  ["bug-report-detail.php", "admin/bug-report-detail.php", "app/(site)/admin/bug-report-detail", "admin bug report detail"],
  ["contact-submissions.php", "admin/contact-submissions.php", "app/(site)/admin/contact-submissions", "admin contact submissions"],
  ["contact-submission-detail.php", "admin/contact-submission-detail.php", "app/(site)/admin/contact-submission-detail", "admin contact submission detail"],
];

/** Normalise any href form to a path under styles/css. */
function normCss(href) {
  let h = href.trim().replace(/^\/+/, "");
  if (!h.endsWith(".css")) return null;
  h = h.replace(/^\.\.\//, "").replace(/^\.\//, "");
  if (h.startsWith("assets/css/")) h = h.slice("assets/css/".length);
  return h.endsWith(".css") ? h : null;
}

/** head.php: $extraCss array or single string, in written order. */
function extraCss(src) {
  const out = [];
  const arr = /\$extraCss\s*=\s*\[([^\]]*)\]\s*;/g;
  let m;
  while ((m = arr.exec(src)) !== null) for (const s of m[1].matchAll(/['"]([^'"]+\.css)['"]/g)) out.push(s[1]);
  const one = /\$extraCss\s*=\s*['"]([^'"]+\.css)['"]\s*;/g;
  while ((m = one.exec(src)) !== null) out.push(m[1]);
  return out;
}

/** Literal <link rel="stylesheet"> written straight into the page body. */
function literalCss(src) {
  const out = [];
  const re = /<link[^>]*rel=["']stylesheet["'][^>]*>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const href = /href=["']([^"']+)["']/.exec(m[0])?.[1];
    if (href) out.push(href);
  }
  return out;
}

function attrOf(src, tag) {
  const m = new RegExp(`<${tag}([^>]*)>`, "i").exec(src);
  return m ? m[1].trim().replace(/\s+/g, " ") || "(no attrs)" : `(no <${tag}>)`;
}

function inlineStyles(src) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const css = m[1].trim();
    if (css) out.push({ chars: css.length, first: css.split("\n")[0].trim().slice(0, 100) });
  }
  return out;
}

/**
 * Which stylesheets does a Next page actually pull in, given where it now lives?
 *
 * base.css comes from app/layout.tsx and navbar.css from app/(site)/layout.tsx, so a
 * page's own directory only contributes the page-specific sheets. `newDir` values below
 * must match the real route-group layout (see docs/php-chrome-map.json).
 */
/**
 * Which stylesheets does a Next page itself import?
 *
 * base.css comes from app/layout.tsx and navbar.css from app/(site)/layout.tsx, so
 * the page directory only contributes the page-specific sheets. A layout.tsx sitting
 * in the same directory is skipped.
 */
function newImports(dir) {
  if (!dir) return null;
  const base = path.join(NEW_ROOT, dir);
  if (!fs.existsSync(base)) return null;
  const found = [];
  const files = fs.statSync(base).isDirectory() ? fs.readdirSync(base) : [path.basename(base)];
  for (const f of files) {
    if (!/\.(tsx|ts|css)$/.test(f)) continue;
    if (f === "layout.tsx") continue; // chrome/base CSS comes from the layout
    const p = path.join(base, f);
    if (!fs.statSync(p).isFile()) continue;
    const src = fs.readFileSync(p, "utf8");
    for (const m of src.matchAll(/import\s+["']@\/styles\/css\/([^"']+\.css)["']/g)) {
      const v = m[1];
      if (!found.includes(v)) found.push(v);
    }
  }
  return found;
}

/** Layout that contributes chrome CSS for a given route group. */
const CHROME_CSS = { site: ["navbar.css"], foot: [], bare: [] };

const layoutCss = [];
{
  const lay = fs.readFileSync(path.join(NEW_ROOT, "app", "layout.tsx"), "utf8");
  for (const m of lay.matchAll(/import\s+["']@\/styles\/css\/([^"']+\.css)["']/g)) layoutCss.push(m[1]);
}

/** Does this sheet exist in the ported stylesheet tree? */
function existsInStyles(rel) {
  return fs.existsSync(path.join(NEW_ROOT, "styles", "css", rel));
}

const rows = [];
for (const [, rel, newDir, label] of PAGES) {
  const p = path.join(OLD_PUBLIC, rel);
  if (!fs.existsSync(p)) {
    rows.push({ page: label, php: rel, missing: true });
    continue;
  }
  const src = fs.readFileSync(p, "utf8");

  // Some templates declare $extraCss in a shared partial they require (the instructor
  // registration wizard sets it in _layout_top.php, not in each step file). Follow one
  // level of local require/include so those pages are measured correctly.
  let full = src;
  for (const m of src.matchAll(/require(?:_once)?\s*\(?\s*__DIR__\s*\.\s*['"]([^'"]+\.php)['"]/g)) {
    const inc = path.join(path.dirname(p), m[1]);
    if (fs.existsSync(inc)) full += "\n" + fs.readFileSync(inc, "utf8");
  }

  // Document order the browser sees: head (base + extraCss) ... then body literals,
  // then navbar.css from navbar.php (always last).
  const sheets = ["base.css", ...extraCss(full).map(normCss).filter(Boolean)];
  for (const h of literalCss(full)) {
    const n = normCss(h);
    if (n) sheets.push(n);
  }
  if (/navbar\.php/.test(full)) sheets.push("navbar.css");

  rows.push({
    page: label,
    php: rel,
    sheets,
    html: attrOf(src, "html"),
    body: attrOf(src, "body"),
    inlineStyles: inlineStyles(src),
    newDir,
    group: sheets.includes("navbar.css") ? "site" : !/[\\/](foot|site)[\\/]/.test(newDir ?? "") ? "bare" : "foot",
    newCss: newImports(newDir),
  });
}

const w = Math.max(...rows.map((r) => r.page.length));
console.log(`ROOT LAYOUT (app/layout.tsx) imports: ${layoutCss.join(", ")}\n`);
console.log("LEGEND: php = what the old page loads, in order | new = what the Next page imports\n");

for (const r of rows) {
  if (r.missing) {
    console.log(`${r.page.padEnd(w)}  !! old file missing: ${r.php}`);
    continue;
  }
  const hasNavbarPhp = r.sheets.includes("navbar.css");
  // Duplicates in the PHP list (index.php loads navbar.css twice, register-success.php
  // links its stylesheet twice) are the same file, so compare the unique set.
  const pageOnlyPhp = [...new Set(r.sheets)].filter(
    (s) => s !== "navbar.css" && s !== "base.css" && existsInStyles(s),
  );
  // student/navbar.css is referenced by cart/wishlist/checkout but does not exist in the
  // old site either, so it 404s there and must not be expected here.
  const newKey = (r.newCss ?? []).join("|");
  const chromeOk = hasNavbarPhp === (r.group === "site");
  const status =
    r.newCss === null ? "n/a (no page yet)" : pageOnlyPhp.join("|") === newKey && chromeOk ? "ok" : chromeOk ? "MISMATCH" : "CHROME-MISMATCH";

  console.log(`${r.page.padEnd(w)}  [${status}] group=${r.group}`);
  console.log(`${" ".repeat(w)}     php : ${[...new Set(r.sheets)].join(" , ")}`);
  console.log(`${" ".repeat(w)}     new : ${r.newCss === null ? "(no page)" : [...layoutCss, ...(CHROME_CSS[r.group] ?? []), ...r.newCss].join(" , ")}`);
  if (r.body && r.body !== "(no <body>)" && r.body !== "(no attrs)") {
    console.log(`${" ".repeat(w)}     body: <body${r.body}>`);
  }
  for (const s of r.inlineStyles) console.log(`${" ".repeat(w)}     inline <style>: ${s.chars} chars  "${s.first}"`);
}

fs.writeFileSync(path.join(NEW_ROOT, "docs", "php-stylesheet-order.json"), JSON.stringify({ layoutCss, rows }, null, 2), "utf8");
console.log(`\nwrote docs/php-stylesheet-order.json`);
