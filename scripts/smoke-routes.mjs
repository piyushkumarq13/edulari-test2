/**
 * scripts/smoke-routes.mjs — npm run smoke:routes
 *
 * Phase 10 task 5: hit every route of a RUNNING production build and assert the
 * authorization contract.
 *
 *   - public routes            -> 200
 *   - protected pages, logged out -> redirect to /login (307/308/302/303) or 401/403
 *   - cron routes, no secret   -> 401
 *   - cron routes, bad secret  -> 401
 *   - API mutations, no origin -> 403 (CSRF defence in depth)
 *
 * Run `npm run build && npm start` first. Existing scripts/smoke.ts covers the DATABASE
 * side (migrations, RLS, grants); this one covers HTTP.
 */

import fs from "node:fs";

const BASE = process.env.NEW_BASE ?? "http://127.0.0.1:3000";

const env = {};
for (const file of [".env.local", "scripts/ui-compare/.env.compare"]) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* optional */ }
}

const slug = env.INSTRUCTOR_SLUG;
const courseSlug = env.COURSE_SLUG ?? "modern-react-typescript";
const categorySlug = env.CATEGORY_SLUG ?? "web-development";

/** Public, must be 200. */
const PUBLIC = [
  "/", "/about", "/browse-courses", "/categories", "/help-center",
  "/contact", "/report-bug", "/track-contact", "/track-report", "/verify-certificate",
  "/login", "/register", "/forgot-password", "/demo",
  `/category/${categorySlug}`, `/course/${courseSlug}`,
  "/sitemap.xml", "/robots.txt", "/manifest.webmanifest",
  ...(slug ? [`/instructor-profile/${slug}`] : []),
];

/** Authenticated pages. Logged out they must NOT return 200. */
const PROTECTED_PAGES = [
  "/cart", "/wishlist", "/checkout", "/updates", "/security",
  "/student/dashboard", "/student/my-courses", "/student/schedule",
  "/student/profile", "/student/grades", "/student/certificates",
  "/student/purchase-history", "/student/onboarding",
  "/instructor/dashboard", "/instructor/courses", "/instructor/create-course",
  "/instructor/course-content", "/instructor/analytics", "/instructor/course-analytics",
  "/instructor/earnings", "/instructor/reviews", "/instructor/students",
  "/instructor/profile",
  "/admin/dashboard", "/admin/users", "/admin/courses", "/admin/create-course",
  "/admin/categories", "/admin/enrollments", "/admin/reviews", "/admin/banners",
  "/admin/send-notifications", "/admin/settings", "/admin/bug-reports",
  "/admin/contact-submissions", "/admin/instructor-applications",
];

/**
 * Mutating APIs with no Origin header: must be rejected.
 *
 * Two shapes are accepted as "rejected", both of which abort the write:
 *  - 403 JSON, for fetch-based endpoints;
 *  - 303 back to the page with `flash_type=error`, for native form POSTs, which use
 *    Post/Redirect/Get exactly as the PHP did.
 *
 * `/api/student/profile` is the PRG case: a cross-origin form POST is bounced back with
 * "Invalid request. Please refresh and try again." and nothing is written.
 */
const MUTATIONS = [
  ["/api/cart/add", "POST", "json"], ["/api/cart/remove", "POST", "json"], ["/api/cart/checkout", "POST", "json"],
  ["/api/enroll", "POST", "json"], ["/api/wishlist/toggle", "POST", "json"], ["/api/wishlist/action", "POST", "json"],
  ["/api/course/review", "POST", "json"],
  ["/api/auth/login", "POST", "json"], ["/api/auth/register", "POST", "json"],
  ["/api/auth/forgot-password", "POST", "json"], ["/api/auth/reset-password", "POST", "json"],
  ["/api/contact", "POST", "json"], ["/api/report-bug", "POST", "json"],
  ["/api/razorpay/create-order", "POST", "json"], ["/api/razorpay/verify-payment", "POST", "json"],
  ["/api/razorpay/mark-order-status", "POST", "json"],
  ["/api/notifications/read-all", "POST", "json"],
  ["/api/security/change-password", "POST", "json"], ["/api/security/logout-sessions", "POST", "json"],
  ["/api/admin/users", "POST", "json"], ["/api/admin/categories", "POST", "json"],
  ["/api/admin/banners", "POST", "json"], ["/api/admin/settings", "POST", "json"],
  ["/api/admin/dashboard", "POST", "json"], ["/api/admin/reviews", "POST", "json"],
  ["/api/admin/enrollments", "POST", "json"],
  ["/api/instructor/course", "POST", "json"], ["/api/instructor/profile", "POST", "json"],
  ["/api/student/onboarding", "POST", "json"], ["/api/student/schedule", "POST", "json"],
  ["/api/upload/image", "POST", "json"],
  // Native form POST (Post/Redirect/Get), as in profile.php.
  ["/api/student/profile", "POST", "prg"],
];

/** Cron routes. */
const CRONS = ["/api/cron/token-cleanup", "/api/cron/maintenance",
  "/api/cron/reconcile-payments", "/api/cron/instructor-maintenance"];

/**
 * Deliberately NOT in PROTECTED_PAGES:
 *
 * `/test` - the instructor competency test is gated by a single-use `?token=`, not by a
 * session, exactly like test/index.php (an applicant takes the test before they have an
 * account). Without a valid token the page renders the "generating questions" state and
 * /api/test rejects every submission, so it is not an authenticated page.
 */

let pass = 0;
const fails = [];

async function hit(url, init) {
  try {
    const res = await fetch(url, { redirect: "manual", ...init });
    return { status: res.status, location: res.headers.get("location") };
  } catch (err) {
    return { status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

function ok(label, cond, detail) {
  if (cond) { pass++; return true; }
  fails.push(`${label} — ${detail}`);
  return false;
}

console.log(`\n=== Route smoke test ===\n  base: ${BASE}\n`);

console.log("Public routes (expect 200)");
for (const p of PUBLIC) {
  const r = await hit(`${BASE}${p}`);
  ok(`GET ${p}`, r.status === 200, `got ${r.status}${r.error ? " " + r.error : ""}`);
  console.log(`  ${r.status === 200 ? "ok  " : "FAIL"} ${p} -> ${r.status}`);
}

console.log("\nProtected pages, logged out (expect redirect or 401/403, never 200)");
for (const p of PROTECTED_PAGES) {
  const r = await hit(`${BASE}${p}`);
  const denied = [301, 302, 303, 307, 308].includes(r.status) || r.status === 401 || r.status === 403;
  ok(`GET ${p} (logged out)`, denied, `got ${r.status} — page is reachable without a session`);
  console.log(`  ${denied ? "ok  " : "FAIL"} ${p} -> ${r.status}${r.location ? " -> " + r.location : ""}`);
}

console.log("\nMutating APIs with no Origin (write must be aborted)");
for (const [p, method, kind] of MUTATIONS) {
  const isForm = kind === "prg";
  const r = await hit(`${BASE}${p}`, isForm
    ? { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "name=x" }
    : { method, headers: { "Content-Type": "application/json" }, body: "{}" });
  const rejected = kind === "prg"
    ? (r.status === 303 && /flash_type=error/.test(r.location ?? ""))
    : r.status === 403;
  ok(`${method} ${p} (no origin)`, rejected,
    `got ${r.status}${r.location ? " -> " + r.location : ""}, expected ${kind === "prg" ? "303 + error flash" : "403"}`);
  if (!rejected) console.log(`  FAIL ${method} ${p} -> ${r.status} ${r.location ?? ""}`);
}

console.log("\nCron routes without / with a bad secret (expect 401)");
for (const p of CRONS) {
  const none = await hit(`${BASE}${p}`);
  const bad = await hit(`${BASE}${p}`, { headers: { Authorization: "Bearer wrong-secret" } });
  ok(`GET ${p} (no secret)`, none.status === 401, `got ${none.status}, expected 401`);
  ok(`GET ${p} (bad secret)`, bad.status === 401, `got ${bad.status}, expected 401`);
  console.log(`  ${none.status === 401 && bad.status === 401 ? "ok  " : "FAIL"} ${p} -> ${none.status}/${bad.status}`);
}

console.log(`\npassed: ${pass}`);
if (fails.length) {
  console.log(`\nFAILURES (${fails.length}):`);
  for (const f of fails) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log("NO FAILURES");
}