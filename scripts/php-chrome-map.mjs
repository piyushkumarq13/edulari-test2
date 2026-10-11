/**
 * Records, for every in-scope PHP template, whether it includes navbar.php and
 * footer.php. head.php is always used. This is the source of truth for which pages
 * must render site chrome in the Next.js port.
 *
 *   node scripts/php-chrome-map.mjs
 */
import fs from "node:fs";
import path from "node:path";

const OLD_PUBLIC = process.env.OLD_PUBLIC ?? "C:\\Users\\piyus\\Desktop\\htdocs (7)\\htdocs\\public";

const PAGES = [
  ["index.php", "home", ""],
  ["page/about.php", "about", "app/about"],
  ["browse-courses.php", "browse courses", "app/browse-courses"],
  ["categories.php", "categories", "app/categories"],
  ["course.php", "course detail", "app/course/[slug]"],
  ["instructor-profile.php", "instructor profile", "app/instructor-profile/[slug]"],
  ["contact.php", "contact", "app/contact"],
  ["track-contact.php", "track contact", "app/track-contact"],
  ["help-center.php", "help center", "app/help-center"],
  ["report-bug.php", "report bug", "app/report-bug"],
  ["track-report.php", "track report", "app/track-report"],
  ["security.php", "security", "app/security"],
  ["updates.php", "updates", "app/updates"],
  ["demo.php", "demo (route handler)", null],
  ["verify-certificate.php", "verify certificate", "app/verify-certificate"],
  ["login.php", "login", "app/login"],
  ["register.php", "register", "app/register"],
  ["register-success.php", "register success", "app/register-success"],
  ["account-activation.php", "account activation", "app/account-activation"],
  ["verify-email.php", "verify email", "app/verify-email"],
  ["forgot-password.php", "forgot password", "app/forgot-password"],
  ["reset-password.php", "reset password", "app/reset-password"],
  ["password-reset-after-verify.php", "password reset after verify", "app/password-reset-after-verify"],
  ["logout.php", "logout (redirect)", null],
  ["cart.php", "cart", "app/cart"],
  ["wishlist.php", "wishlist", "app/wishlist"],
  ["checkout.php", "checkout", "app/checkout"],
  ["student/purchase-history.php", "purchase history", "app/student/purchase-history"],
  ["student/receipt.php", "receipt", "app/student/receipt"],
  ["student/check-payment-status.php", "check payment status (JSON endpoint)", null],
  ["student/dashboard.php", "student dashboard", "app/student/dashboard"],
  ["student/my-courses.php", "my courses", "app/student/my-courses"],
  ["student/profile.php", "student profile", "app/student/profile"],
  ["student/grades.php", "student grades", "app/student/grades"],
  ["student/certificates.php", "student certificates", "app/student/certificates"],
  ["student/schedule.php", "student schedule", "app/student/schedule"],
  ["student/learn.php", "learn", "app/student/learn"],
  ["student/generate-certificate.php", "generate certificate", "app/student/generate-certificate"],
  ["student/onboarding.php", "onboarding", "app/student/onboarding"],
  ["instructor-register/step-1.php", "instructor register step 1", "app/instructor-register/step-1"],
  ["instructor-register/step-6.php", "instructor register review", "app/instructor-register/step-6"],
  ["instructor-register/step-8.php", "instructor register test preview", "app/instructor-register/step-8"],
  ["instructor-register-success.php", "instructor register success", "app/instructor-register-success"],
  ["test/index.php", "competency test", "app/test"],
  ["course-ai-shared.php", "course ai shared", "app/course-ai-shared"],
  // Phase 9: the admin area (every template includes navbar.php + footer.php).
  ["admin/dashboard.php", "admin dashboard", "app/admin/dashboard"],
  ["admin/users.php", "admin users", "app/admin/users"],
  ["admin/user-detail.php", "admin user detail", "app/admin/user-detail"],
  ["admin/instructor-applications.php", "admin instructor applications", "app/admin/instructor-applications"],
  ["admin/instructor-application-detail.php", "admin instructor application detail", "app/admin/instructor-application-detail"],
  ["admin/courses.php", "admin courses", "app/admin/courses"],
  ["admin/create-course.php", "admin create course", "app/admin/create-course"],
  ["admin/edit-course.php", "admin edit course", "app/admin/edit-course"],
  ["admin/categories.php", "admin categories", "app/admin/categories"],
  ["admin/enrollments.php", "admin enrollments", "app/admin/enrollments"],
  ["admin/reviews.php", "admin reviews", "app/admin/reviews"],
  ["admin/banners.php", "admin banners", "app/admin/banners"],
  ["admin/send-notifications.php", "admin send notifications", "app/admin/send-notifications"],
  ["admin/settings.php", "admin settings", "app/admin/settings"],
  ["admin/bug-reports.php", "admin bug reports", "app/admin/bug-reports"],
  ["admin/bug-report-detail.php", "admin bug report detail", "app/admin/bug-report-detail"],
  ["admin/contact-submissions.php", "admin contact submissions", "app/admin/contact-submissions"],
  ["admin/contact-submission-detail.php", "admin contact submission detail", "app/admin/contact-submission-detail"],
];

const rows = [];
for (const [rel, label, newDir] of PAGES) {
  const p = path.join(OLD_PUBLIC, rel);
  if (!fs.existsSync(p)) {
    rows.push({ label, php: rel, missing: true });
    continue;
  }
  const src = fs.readFileSync(p, "utf8");
  rows.push({
    label,
    php: rel,
    navbar: /navbar\.php/.test(src),
    footer: /footer\.php/.test(src),
    head: /head\.php/.test(src),
    newDir,
  });
}

const w = Math.max(...rows.map((r) => r.label.length));
console.log("page".padEnd(w) + "  navbar  footer  head   -> next route group");
console.log("-".repeat(w + 44));
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.label.padEnd(w)}  !! missing`);
    continue;
  }
  const shape = !r.navbar && !r.footer ? "BARE (no chrome)" : !r.navbar && r.footer ? "FOOTER ONLY" : "NAVBAR + FOOTER";
  console.log(
    `${r.label.padEnd(w)}  ${String(r.navbar).padEnd(7)} ${String(r.footer).padEnd(7)} ${String(r.head).padEnd(6)} -> ${shape}`,
  );
}

fs.writeFileSync(
  path.join(process.cwd(), "docs", "php-chrome-map.json"),
  JSON.stringify(rows, null, 2),
  "utf8",
);
console.log("\nwrote docs/php-chrome-map.json");

// ── Gate: the new page must sit in the route group that matches the PHP chrome.
//    `(site)` renders SiteNavbar + SiteFooter (and loads navbar.css, which declares a
//    global `body { padding-top }`), so a template with no navbar.php must NOT live there.
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name === "page.tsx") acc.push(full);
  }
  return acc;
}

const appDir = path.join(process.cwd(), "app");
const pages = fs.existsSync(appDir) ? walk(appDir) : [];
const routePath = (abs) =>
  "/" +
  path
    .relative(appDir, path.dirname(abs))
    .split(path.sep)
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");

const mismatches = [];
console.log("\nroute-group gate (new tree vs PHP chrome)");
for (const r of rows) {
  if (r.missing || r.newDir === null) continue;
  const target = r.newDir === "" ? "/" : `/${r.newDir.replace(/^app\//, "")}`;
  const found = pages.find((p) => routePath(p) === target);
  if (!found) {
    mismatches.push(`${r.label}: no page.tsx at ${target}`);
    console.log(`  MISSING  ${r.label.padEnd(w)} -> ${target}`);
    continue;
  }
  const segs = path.relative(appDir, found).split(path.sep);
  const inSite = segs.includes("(site)");
  const inFoot = segs.includes("(foot)");
  // The shape the PHP chrome demands: navbar+footer -> (site); footer only -> (foot); bare -> neither.
  const wantGroup = r.navbar ? "(site)" : r.footer ? "(foot)" : null;
  const ok = wantGroup ? segs.includes(wantGroup) : !inSite && !inFoot;
  if (!ok) mismatches.push(`${r.label}: ${target} is${inSite ? " under (site)" : inFoot ? " under (foot)" : ""} but the PHP template ${r.navbar ? "includes navbar.php" : r.footer ? "has a footer but no navbar" : "has no navbar and no footer"}`);
  console.log(`  ${ok ? "ok     " : "FAIL   "} ${r.label.padEnd(w)} -> ${target} (${segs.join("/")})`);
}

if (mismatches.length) {
  console.log(`\n${mismatches.length} chrome mismatch(es):`);
  for (const m of mismatches) console.log(`  - ${m}`);
  process.exitCode = 1;
} else {
  console.log("\nOK: every page sits in the route group its PHP template's chrome requires.");
}
