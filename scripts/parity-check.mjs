import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const OLD_PUBLIC = process.env.OLD_PUBLIC ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\htdocs\\public";
const NEW_ROOT = process.env.NEW_ROOT ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\Edulari";
const NEW_APP = path.join(NEW_ROOT, "app");
const NEW_COMPONENTS = path.join(NEW_ROOT, "components");
const NEW_STYLES = path.join(NEW_ROOT, "styles", "css");

// PHP template -> the CSS file it links. Extend as each phase completes.
const pairs = [
  ["index.php", "home.css"],
  ["about.php", "about.css"],
  ["browse-courses.php", "browse-courses.css"],
  ["categories.php", "categories.css"],
  ["course.php", "course.css"],
  ["instructor-profile.php", "instructor-profile.css"],
  ["contact.php", "contact.css"],
  ["help-center.php", "help-center.css"],
  ["report-bug.php", "report-bug.css"],
  ["track-contact.php", "track-contact.css"],
  ["track-report.php", "track-report.css"],
  ["security.php", "security.css"],
  ["updates.php", "updates.css"],
  ["verify-certificate.php", "verify-certificate.css"],
  // Phase 5: student commerce.
  ["cart.php", "cart-wishlist.css"],
  ["wishlist.php", "cart-wishlist.css"],
  ["checkout.php", "checkout.css"],
  ["student/purchase-history.php", path.join("student", "purchase-history.css")],
  ["student/receipt.php", path.join("student", "receipt.css")],
  // Phase 6: the student learning area.
  ["student/onboarding.php", path.join("auth", "onboarding.css")],
  ["student/dashboard.php", path.join("student", "dashboard.css")],
  ["student/my-courses.php", path.join("student", "my-courses.css")],
  ["student/learn.php", path.join("student", "learn.css")],
  ["student/profile.php", path.join("student", "profile.css")],
  ["student/grades.php", path.join("student", "grades.css")],
  ["student/certificates.php", path.join("student", "certificates.css")],
  ["student/generate-certificate.php", path.join("student", "generate-certificate.css")],
  ["student/schedule.php", path.join("student", "schedule.css")],
  ["course-ai-shared.php", "course-ai.css"],
  // Phase 7: instructor registration wizard + competency test.
  ["instructor-register/step-1.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-2.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-3.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-4.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-5.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-6.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-7.php", path.join("auth", "instructor-register.css")],
  ["instructor-register/step-8.php", path.join("auth", "instructor-register.css")],
  ["instructor-register-success.php", path.join("auth", "instructor-register-success.css")],
  ["test/index.php", path.join("auth", "instructor-test.css")],
  // Phase 8: the instructor panel.
  ["instructor/dashboard.php", path.join("instructor", "dashboard.css")],
  ["instructor/courses.php", path.join("instructor", "courses.css")],
  ["instructor/create-course.php", path.join("instructor", "create-course.css")],
  ["instructor/edit-course.php", path.join("instructor", "edit-course.css")],
  ["instructor/course-content.php", path.join("instructor", "course-content.css")],
  ["instructor/course-analytics.php", path.join("instructor", "course-analytics.css")],
  ["instructor/analytics.php", path.join("instructor", "analytics.css")],
  ["instructor/students.php", path.join("instructor", "students.css")],
  ["instructor/reviews.php", path.join("instructor", "reviews.css")],
  ["instructor/earnings.php", path.join("instructor", "earnings.css")],
  ["instructor/profile.php", path.join("instructor", "profile.css")],
  // Phase 9: the admin area.
  ["admin/dashboard.php", path.join("admin", "dashboard.css")],
  ["admin/users.php", path.join("admin", "users.css")],
  ["admin/user-detail.php", path.join("admin", "user-detail.css")],
  ["admin/instructor-applications.php", path.join("admin", "instructor-applications.css")],
  ["admin/instructor-application-detail.php", path.join("admin", "instructor-application-detail.css")],
  ["admin/courses.php", path.join("admin", "courses.css")],
  ["admin/create-course.php", path.join("admin", "create-course.css")],
  ["admin/edit-course.php", path.join("admin", "edit-course.css")],
  ["admin/categories.php", path.join("admin", "categories.css")],
  ["admin/enrollments.php", path.join("admin", "reviews-enrollments.css")],
  ["admin/reviews.php", path.join("admin", "reviews-enrollments.css")],
  ["admin/banners.php", path.join("admin", "banners.css")],
  ["admin/send-notifications.php", path.join("admin", "send-notifications.css")],
  ["admin/settings.php", path.join("admin", "settings.css")],
  ["admin/bug-reports.php", path.join("admin", "bug-reports.css")],
  ["admin/bug-report-detail.php", path.join("admin", "bug-report-detail.css")],
  ["admin/contact-submissions.php", path.join("admin", "contact-submissions.css")],
  ["admin/contact-submission-detail.php", path.join("admin", "contact-submission-detail.css")],
];

function walk(dir, ext, visit) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, ext, visit);
    else if (ext.some((e) => entry.endsWith(e))) visit(p);
  }
}

/** Resolve a PHP template path that may live in a subfolder (e.g. page/about.php). */
function findTemplate(name) {
  const direct = path.join(OLD_PUBLIC, name);
  if (existsSync(direct)) return direct;
  let hit = null;
  walk(OLD_PUBLIC, [".php"], (p) => {
    if (!hit && path.basename(p) === name) hit = p;
  });
  return hit;
}

function readAll(dir, ext) {
  let out = "";
  walk(dir, ext, (p) => { out += readFileSync(p, "utf8") + "\n"; });
  return out;
}

/** Strip PHP blocks/echo tags; keep a sentinel so templated values are detectable. */
function stripPhp(src) {
  return src
    .replace(/<\?php[\s\S]*?\?>/g, "__PHP__")
    .replace(/<\?=[\s\S]*?\?>/g, "__PHP__")
    .replace(/<\?php[\s\S]*$/g, "__PHP__");
}

/** Only the markup body, so class/id values from PHP strings are ignored. */
function markupOnly(src) {
  const stripped = stripPhp(src);
  const blocks = stripped.match(/<body[\s\S]*?<\/body>/i);
  return blocks ? blocks[0] : stripped;
}

const newSourceText = readAll(NEW_APP, [".tsx", ".ts"]) + "\n" + readAll(NEW_COMPONENTS, [".tsx", ".ts"]);
const newCssText = readAll(NEW_STYLES, [".css"]);

function classesOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/\bclass\s*=\s*["']([^"']+)["']/g)) {
    for (const t of m[1].trim().split(/\s+/)) {
      if (!t || t.includes("__PHP__") || t.includes("<") || t.includes("$") || t.includes("{")) continue;
      out.add(t);
    }
  }
  return out;
}

function idsOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/\bid\s*=\s*["']([^"']*)["']/g)) {
    const id = m[1].trim();
    if (id.includes("__PHP__")) continue;
    if (/^[A-Za-z][A-Za-z0-9_:.-]*$/.test(id)) out.add(id);
  }
  return out;
}

function hasClass(token, pageCss) {
  if (pageCss.includes(`.${token}`) || newCssText.includes(`.${token}`)) return true;
  return newSourceText.includes(`"${token}"`) || newSourceText.includes(`'${token}'`) || newSourceText.includes(` ${token} `) || newSourceText.includes(`className={\``) && newSourceText.includes(token);
}

function hasId(id, pageCss) {
  if (pageCss.includes(`#${id}`)) return true;
  if (newSourceText.includes(`id="${id}"`) || newSourceText.includes(`id='${id}'`)) return true;
  if (newSourceText.includes(`id="${id} `) || newSourceText.includes(`id='${id} `)) return true;
  // An id may also reach the DOM through a component prop, e.g. MarkdownEditor's
  // textareaId="contentTextArea". That renders the same id, so it counts as present.
  return new RegExp(`\\b[A-Za-z][A-Za-z0-9]*[Ii]d=["']${id}["']`).test(newSourceText);
}

let missing = 0;
let checkedTemplates = 0;

for (const [php, cssFile] of pairs) {
  const phpPath = findTemplate(php);
  if (!phpPath) {
    console.log(`SKIP (old template not found): ${php}`);
    continue;
  }
  checkedTemplates++;
  const body = markupOnly(readFileSync(phpPath, "utf8"));
  const cssPath = path.join(NEW_STYLES, cssFile);
  const pageCss = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

  for (const cls of classesOf(body)) {
    if (!hasClass(cls, pageCss)) {
      console.log(`MISSING .${cls} (in ${php})`);
      missing++;
    }
  }
  for (const id of idsOf(body)) {
    if (!hasId(id, pageCss)) {
      console.log(`MISSING #${id} (in ${php})`);
      missing++;
    }
  }
}

console.log(
  missing === 0
    ? `parity-check: OK (${checkedTemplates} templates, no missing class/id)`
    : `parity-check: ${missing} missing across ${checkedTemplates} templates`,
);
process.exit(missing === 0 ? 0 : 1);
