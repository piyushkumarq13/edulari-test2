/**
 * For each in-scope PHP page, reports which of the stylesheets the page loads contain
 * rules whose selectors actually match markup on that page. Used to decide whether a
 * missing / mis-ordered import has any visual effect, or is a harmless deviation.
 *
 *   node scripts/css-usage.mjs [pageFilter]
 */
import fs from "node:fs";
import path from "node:path";

const OLD_PUBLIC = process.env.OLD_PUBLIC ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\htdocs\\public";
const NEW_ROOT = process.env.NEW_ROOT ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\Edulari";
const FILTER = process.argv[2];

const PAGES = [
  ["index.php", "index.php", "home"],
  ["page/about.php", "page/about.php", "about"],
  ["browse-courses.php", "browse-courses.php", "browse courses"],
  ["categories.php", "categories.php", "categories"],
  ["course.php", "course.php", "course detail"],
  ["instructor-profile.php", "instructor-profile.php", "instructor profile"],
  ["contact.php", "contact.php", "contact"],
  ["track-contact.php", "track-contact.php", "track contact"],
  ["help-center.php", "help-center.php", "help center"],
  ["report-bug.php", "report-bug.php", "report bug"],
  ["track-report.php", "track-report.php", "track report"],
  ["security.php", "security.php", "security"],
  ["updates.php", "updates.php", "updates"],
  ["verify-certificate.php", "verify-certificate.php", "verify certificate"],
  ["login.php", "login.php", "login"],
  ["register.php", "register.php", "register"],
  ["register-success.php", "register-success.php", "register success"],
  ["account-activation.php", "account-activation.php", "account activation"],
  ["verify-email.php", "verify-email.php", "verify email"],
  ["forgot-password.php", "forgot-password.php", "forgot password"],
  ["reset-password.php", "reset-password.php", "reset password"],
  ["password-reset-after-verify.php", "password-reset-after-verify.php", "password reset after verify"],
  ["cart.php", "cart.php", "cart"],
  ["wishlist.php", "wishlist.php", "wishlist"],
  ["checkout.php", "checkout.php", "checkout"],
  ["student/purchase-history.php", "student/purchase-history.php", "purchase history"],
  ["student/receipt.php", "student/receipt.php", "receipt"],
  ["student/dashboard.php", "student/dashboard.php", "student dashboard"],
  ["student/my-courses.php", "student/my-courses.php", "my courses"],
  ["student/profile.php", "student/profile.php", "student profile"],
  ["student/grades.php", "student/grades.php", "student grades"],
  ["student/certificates.php", "student/certificates.php", "student certificates"],
  ["student/schedule.php", "student/schedule.php", "student schedule"],
  ["student/learn.php", "student/learn.php", "learn"],
  ["student/generate-certificate.php", "student/generate-certificate.php", "generate certificate"],
  ["student/onboarding.php", "student/onboarding.php", "onboarding"],
  ["course-ai-shared.php", "course-ai-shared.php", "course ai shared"],
  ["instructor-register/step-1.php", "instructor-register/step-1.php", "instructor register step 1"],
  ["instructor-register/step-2.php", "instructor-register/step-2.php", "instructor register step 2"],
  ["instructor-register/step-3.php", "instructor-register/step-3.php", "instructor register step 3"],
  ["instructor-register/step-4.php", "instructor-register/step-4.php", "instructor register step 4"],
  ["instructor-register/step-5.php", "instructor-register/step-5.php", "instructor register step 5"],
  ["instructor-register/step-6.php", "instructor-register/step-6.php", "instructor register step 6"],
  ["instructor-register/step-7.php", "instructor-register/step-7.php", "instructor register step 7"],
  ["instructor-register/step-8.php", "instructor-register/step-8.php", "instructor register step 8"],
  ["instructor-register-success.php", "instructor-register-success.php", "instructor register success"],
  ["test/index.php", "test/index.php", "competency test"],
  // Phase 9: the admin area.
  ["admin/dashboard.php", "admin/dashboard.php", "admin dashboard"],
  ["admin/users.php", "admin/users.php", "admin users"],
  ["admin/user-detail.php", "admin/user-detail.php", "admin user detail"],
  ["admin/instructor-applications.php", "admin/instructor-applications.php", "admin instructor applications"],
  ["admin/instructor-application-detail.php", "admin/instructor-application-detail.php", "admin instructor application detail"],
  ["admin/courses.php", "admin/courses.php", "admin courses"],
  ["admin/create-course.php", "admin/create-course.php", "admin create course"],
  ["admin/edit-course.php", "admin/edit-course.php", "admin edit course"],
  ["admin/categories.php", "admin/categories.php", "admin categories"],
  ["admin/enrollments.php", "admin/enrollments.php", "admin enrollments"],
  ["admin/reviews.php", "admin/reviews.php", "admin reviews"],
  ["admin/banners.php", "admin/banners.php", "admin banners"],
  ["admin/send-notifications.php", "admin/send-notifications.php", "admin send notifications"],
  ["admin/settings.php", "admin/settings.php", "admin settings"],
  ["admin/bug-reports.php", "admin/bug-reports.php", "admin bug reports"],
  ["admin/bug-report-detail.php", "admin/bug-report-detail.php", "admin bug report detail"],
  ["admin/contact-submissions.php", "admin/contact-submissions.php", "admin contact submissions"],
  ["admin/contact-submission-detail.php", "admin/contact-submission-detail.php", "admin contact submission detail"],
];

function normCss(href) {
  let h = href.trim().replace(/^\/+/, "");
  if (!h.endsWith(".css")) return null;
  h = h.replace(/^\.\.\//, "").replace(/^\.\//, "");
  if (h.startsWith("assets/css/")) h = h.slice("assets/css/".length);
  if (!h.endsWith(".css")) return null;
  return h;
}

function pageSheets(src) {
  const out = ["base.css"];
  const arr = /\$extraCss\s*=\s*\[([^\]]*)\]\s*;/g;
  let m;
  while ((m = arr.exec(src)) !== null) for (const s of m[1].matchAll(/['"]([^'"]+\.css)['"]/g)) { const n = normCss(s[1]); if (n) out.push(n); }
  const one = /\$extraCss\s*=\s*['"]([^'"]+\.css)['"]\s*;/g;
  while ((m = one.exec(src)) !== null) { const n = normCss(m[1]); if (n) out.push(n); }
  for (const lm of src.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const href = /href=["']([^"']+)["']/.exec(lm[0])?.[1];
    const n = href && normCss(href);
    if (n) out.push(n);
  }
  if (/navbar\.php/.test(src)) out.push("navbar.css");
  return [...new Set(out)];
}

/** Classes/ids present in the page markup (PHP tags stripped). */
function markupTokens(src) {
  const stripped = src.replace(/<\?php[\s\S]*?\?>/g, " ").replace(/<\?=[\s\S]*?\?>/g, " ");
  const classes = new Set();
  const ids = new Set();
  const tags = new Set();
  for (const m of stripped.matchAll(/class\s*=\s*["']([^"']+)["']/gi)) {
    for (const t of m[1].trim().split(/\s+/)) if (t && !t.includes("<") && !t.includes("{")) classes.add(t);
  }
  for (const m of stripped.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = m[1].trim();
    if (/^[A-Za-z][A-Za-z0-9_:.-]*$/.test(id)) ids.add(id);
  }
  for (const m of stripped.matchAll(/<([a-z][a-z0-9]*)\b/gi)) tags.add(m[1].toLowerCase());
  return { classes, ids, tags };
}

/** Strip comments and @-rules, yield plain selector lists. */
function selectorsOf(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /(^|[};])\s*([^{}@]+?)\s*\{/g;
  let m;
  while ((m = re.exec(noComments)) !== null) {
    const sel = m[2].trim();
    if (!sel || sel.startsWith("@")) continue;
    for (const part of sel.split(",")) {
      const s = part.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

/** Does any selector in `css` touch a token the page actually renders? */
function selectorsUsed(css, tokens, sheetName) {
  const used = new Set();
  const sel = selectorsOf(css);
  for (const s of sel) {
    // strip pseudo-elements/classes and combinators for matching
    const bare = s.replace(/::?[a-z-]+(\([^)]*\))?/gi, "");
    const cls = [...bare.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
    const id = [...bare.matchAll(/#([A-Za-z_][A-Za-z0-9_-]*)/g)].map((m) => m[1]);
    const tag = /^([a-z][a-z0-9]*)/i.exec(bare.trim())?.[1]?.toLowerCase();

    const clsHit = cls.some((c) => tokens.classes.has(c));
    const idHit = id.some((i) => tokens.ids.has(i));
    const tagHit = tag && tokens.tags.has(tag) && (cls.length === 0 && id.length === 0);
    // element selectors like body/html/* always apply
    const globalHit = /^(html|body|\*|:root|::selection)$/.test(bare.trim()) || /\*/.test(bare);

    if (clsHit || idHit || tagHit || globalHit) used.add(s);
  }
  void sheetName;
  return used;
}

const cssCache = new Map();
function readCss(rel) {
  if (cssCache.has(rel)) return cssCache.get(rel);
  const p = path.join(NEW_ROOT, "styles", "css", rel);
  const v = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  cssCache.set(rel, v);
  return v;
}

const w = 24;
for (const [, rel, label] of PAGES) {
  if (FILTER && !label.includes(FILTER)) continue;
  const p = path.join(OLD_PUBLIC, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, "utf8");
  const tokens = markupTokens(src);
  const sheets = pageSheets(src);

  const lines = [];
  for (const s of sheets) {
    const css = readCss(s);
    if (css === null) { lines.push(`      ${s.padEnd(34)} (file not in styles/css)`); continue; }
    const used = selectorsUsed(css, tokens, s);
    lines.push(`      ${s.padEnd(34)} ${used.size} matching rules${used.size ? "" : "   <-- loads but affects nothing"}`);
  }
  console.log(`${label.padEnd(w)} classes=${tokens.classes.size} ids=${tokens.ids.size}`);
  for (const l of lines) console.log(l);
  console.log("");
}
