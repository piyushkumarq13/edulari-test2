/**
 * scripts/ui-compare/config.mjs
 *
 * Shared page/viewport/selector configuration for the UI parity comparison.
 *
 * Breakpoints: the eight required widths plus every breakpoint that actually appears
 * in the ported stylesheet tree, discovered by scanning media queries (see
 * `breakpointsFromCss()`), so a CSS-only breakpoint can never be skipped.
 */

import fs from "node:fs";
import path from "node:path";

export const OLD_BASE = process.env.OLD_BASE ?? "http://127.0.0.1:8080";
export const NEW_BASE = process.env.NEW_BASE ?? "http://127.0.0.1:3000";

export const REQUIRED_VIEWPORTS = [1920, 1440, 1280, 1024, 768, 480, 375, 320];

const CSS_ROOT = path.join(process.cwd(), "styles", "css");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".css")) acc.push(p);
  }
  return acc;
}

/** Every `max-width: Npx` / `min-width: Npx` used anywhere in the ported CSS. */
export function breakpointsFromCss() {
  const found = new Set();
  for (const f of walk(CSS_ROOT)) {
    const css = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/@media[^{]*?\((?:max|min)-width:\s*(\d+(?:\.\d+)?)px\)/gi)) {
      found.add(Math.round(Number(m[1])));
    }
  }
  return [...found].sort((a, b) => b - a);
}

export function allViewports() {
  return [...new Set([...REQUIRED_VIEWPORTS, ...breakpointsFromCss()])].sort((a, b) => b - a);
}

/**
 * Every page built in Phases 4 and 5.
 *
 * `auth` pages are chrome-less in the PHP source, `student` pages need a session, and
 * the last group mirrors the navbar/footer split recorded in docs/php-chrome-map.json.
 */
export const PAGES = [
  { id: "home", path: "/", auth: false, group: "site" },
  { id: "about", path: "/about", auth: false, group: "site" },
  { id: "browse-courses", path: "/browse-courses", auth: false, group: "site" },
  { id: "categories", path: "/categories", auth: false, group: "site" },
  { id: "category-detail", path: "/category/web-development", auth: false, group: "site" },
  { id: "course-detail", path: "/course/modern-react-typescript", auth: false, group: "site" },
  { id: "course-detail-free", path: "/course/free-frontend-basics", auth: false, group: "site" },
  { id: "instructor-profile", path: "/instructor-profile/{INSTRUCTOR_SLUG}", auth: false, group: "site" },
  { id: "contact", path: "/contact", auth: false, group: "site" },
  { id: "track-contact", path: "/track-contact", auth: false, group: "site" },
  { id: "help-center", path: "/help-center", auth: false, group: "site" },
  { id: "report-bug", path: "/report-bug", auth: false, group: "site" },
  { id: "track-report", path: "/track-report", auth: false, group: "site" },
  { id: "security", path: "/security", auth: true, group: "site" },
  { id: "updates", path: "/updates", auth: true, group: "site" },
  { id: "verify-certificate", path: "/verify-certificate", auth: false, group: "foot" },
  { id: "login", path: "/login", auth: false, group: "bare" },
  { id: "register", path: "/register", auth: false, group: "bare" },
  { id: "register-success", path: "/register-success", auth: false, group: "bare" },
  { id: "account-activation", path: "/account-activation", auth: false, group: "bare" },
  { id: "verify-email", path: "/verify-email", auth: false, group: "bare" },
  { id: "forgot-password", path: "/forgot-password", auth: false, group: "bare" },
  { id: "reset-password", path: "/reset-password", auth: false, group: "bare" },
  { id: "password-reset-after-verify", path: "/password-reset-after-verify", auth: false, group: "bare" },
  { id: "cart", path: "/cart", auth: true, group: "site" },
  { id: "cart-empty", path: "/cart", auth: true, group: "site", state: "empty-cart" },
  { id: "wishlist", path: "/wishlist", auth: true, group: "site" },
  { id: "checkout", path: "/checkout", auth: true, group: "site" },
  { id: "purchase-history", path: "/student/purchase-history", auth: true, group: "site" },
  { id: "receipt", path: "/student/receipt?order={ORDER_ID}", auth: true, group: "bare" },
  // Phase 6: the student learning area.
  { id: "student-dashboard", path: "/student/dashboard", auth: true, group: "site" },
  { id: "my-courses", path: "/student/my-courses", auth: true, group: "site" },
  { id: "learn", path: "/student/learn?course={COURSE_ID}", auth: true, group: "bare" },
  { id: "student-profile", path: "/student/profile", auth: true, group: "site" },
  { id: "grades", path: "/student/grades", auth: true, group: "site" },
  { id: "certificates", path: "/student/certificates", auth: true, group: "site" },
  { id: "generate-certificate", path: "/student/generate-certificate?course={COURSE_ID}", auth: true, group: "bare" },
  { id: "schedule", path: "/student/schedule", auth: true, group: "site" },
  { id: "onboarding", path: "/student/onboarding", auth: true, group: "bare" },
  // Phase 7: instructor registration wizard + competency test. These pages are reached
  // before the applicant has an account, so they are captured without a session.
  { id: "instructor-register-step-1", path: "/instructor-register/step-1", auth: false, group: "bare" },
  { id: "instructor-register-success", path: "/instructor-register-success", auth: false, group: "bare" },
  // Phase 9: the admin area. Every page is behind requireAdmin(), so it needs an ADMIN
  // session. Set COMPARE_ADMIN_EMAIL / COMPARE_ADMIN_PASSWORD (see
  // scripts/ui-compare/seed-compare-admin.mjs). Id-dependent detail pages list the env
  // key they need in `requiresEnv` and are skipped (not mis-captured) when it is unset.
  { id: "admin-dashboard", path: "/admin/dashboard", auth: true, role: "admin", group: "site" },
  { id: "admin-users", path: "/admin/users", auth: true, role: "admin", group: "site" },
  { id: "admin-user-detail", path: "/admin/user-detail?id={ADMIN_USER_ID}", auth: true, role: "admin", group: "site", requiresEnv: ["ADMIN_USER_ID"] },
  { id: "admin-instructor-applications", path: "/admin/instructor-applications", auth: true, role: "admin", group: "site" },
  { id: "admin-instructor-application-detail", path: "/admin/instructor-application-detail?id={APPLICATION_ID}", auth: true, role: "admin", group: "site", requiresEnv: ["APPLICATION_ID"] },
  { id: "admin-courses", path: "/admin/courses", auth: true, role: "admin", group: "site" },
  { id: "admin-create-course", path: "/admin/create-course", auth: true, role: "admin", group: "site" },
  { id: "admin-edit-course", path: "/admin/edit-course?id={EDIT_COURSE_ID}", auth: true, role: "admin", group: "site", requiresEnv: ["EDIT_COURSE_ID"] },
  { id: "admin-categories", path: "/admin/categories", auth: true, role: "admin", group: "site" },
  { id: "admin-enrollments", path: "/admin/enrollments", auth: true, role: "admin", group: "site" },
  { id: "admin-reviews", path: "/admin/reviews", auth: true, role: "admin", group: "site" },
  { id: "admin-banners", path: "/admin/banners", auth: true, role: "admin", group: "site" },
  { id: "admin-send-notifications", path: "/admin/send-notifications", auth: true, role: "admin", group: "site" },
  { id: "admin-settings", path: "/admin/settings", auth: true, role: "admin", group: "site" },
  { id: "admin-bug-reports", path: "/admin/bug-reports", auth: true, role: "admin", group: "site" },
  { id: "admin-bug-report-detail", path: "/admin/bug-report-detail?id={BUG_ID}", auth: true, role: "admin", group: "site", requiresEnv: ["BUG_ID"] },
  { id: "admin-contact-submissions", path: "/admin/contact-submissions", auth: true, role: "admin", group: "site" },
  { id: "admin-contact-submission-detail", path: "/admin/contact-submission-detail?id={CONTACT_ID}", auth: true, role: "admin", group: "site", requiresEnv: ["CONTACT_ID"] },
];

/** check-payment-status.php is a JSON endpoint, not a page - verified by API instead. */
export const API_CHECKS = [
  { id: "check-payment-status", method: "POST", path: "/student/check-payment-status", auth: true },
  { id: "schedule-api-lessons", method: "GET", path: "/student/schedule-api?action=get_lessons&course_id={COURSE_ID}", auth: true },
  { id: "schedule-api-legacy", method: "POST", path: "/api/student/schedule", auth: true, body: { action: "get_lessons", course_id: 0 } },
  { id: "course-ai-chat", method: "POST", path: "/student/course_ai_chat_api?action=get_messages", auth: true, body: { course_id: 0 } },
];

/** Computed properties compared for every paired element. */
export const PROPERTIES = [
  "display", "position", "top", "right", "bottom", "left",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "box-sizing", "overflow-x", "overflow-y",
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "text-align", "text-transform", "text-decoration-line", "white-space",
  "color", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "box-shadow", "opacity", "transform", "transform-origin", "z-index", "visibility",
  "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "align-items", "align-self",
  "justify-content", "justify-items", "order",
  "list-style-type", "vertical-align", "object-fit", "aspect-ratio",
  "transition-duration", "animation-name",
];

/** 1px tolerance for positions/sizes; colors compared exactly. */
export const TOLERANCE_PX = 1;
export const COLOR_PROPS = new Set([
  "color", "background-color", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color",
]);

/**
 * Injected into BOTH sides identically before measuring, so animation state, the
 * non-blocking font swap and the countdown counters cannot skew a comparison.
 */
export const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  html { scroll-behavior: auto !important; }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
  .revealed { opacity: 1 !important; transform: none !important; }
`;

/** Selectors whose text is time- or random-derived and must be masked. */
export const MASK_SELECTORS = [
  "time", ".ph-date-primary", ".ph-date-secondary", ".ph-date", ".ph-history-date",
  "[data-count]", ".bc-stat-val", ".hero-stat-num", ".stat-num", ".rcpt-meta-value",
  ".result-count", ".ph-result-count",
  // Phase 6: values derived from "today" or from the week navigator.
  ".sc-hero-cal-head", ".sc-week-label", ".sc-stat-value", ".sc-course-pct",
];
