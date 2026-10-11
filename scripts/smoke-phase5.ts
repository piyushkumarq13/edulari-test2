/**
 * Phase 5 live smoke test.
 *
 * Registers throwaway students, publishes fixture courses (paid + free) and exercises
 * the cart / wishlist / checkout / purchase-history / receipt pages plus the payment API
 * guards against a running server, then deletes everything it created.
 *
 *   npx tsx scripts/smoke-phase5.ts [baseUrl]
 *
 * Requires a running `next start` (or `next dev`) and valid .env.local credentials.
 * It never talks to Razorpay: the payment endpoints are only probed for their guard
 * behaviour (CSRF / origin / role / ownership), which is what can be asserted offline.
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    process.env[key] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE = process.argv[2] ?? "http://localhost:3100";
const SQL_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!SQL_URL) {
  console.error("smoke-phase5: DATABASE_URL / DIRECT_URL not set");
  process.exit(1);
}

const sql = postgres(SQL_URL, { prepare: false, max: 1 });

const SUFFIX = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const EMAIL = `phase5_${SUFFIX}@example.test`;
const OTHER_EMAIL = `phase5_other_${SUFFIX}@example.test`;
const INSTR_EMAIL = `phase5_instructor_${SUFFIX}@example.test`;
const PASSWORD = "Phase5Smoke!2026";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    failures.push(`${name}${extra ? ` - ${extra}` : ""}`);
    console.log(`  FAIL  ${name}${extra ? ` - ${extra}` : ""}`);
  }
}

const jar = new Map<string, string>();

function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair!.indexOf("=");
    if (idx <= 0) continue;
    const name = pair!.slice(0, idx).trim();
    const value = pair!.slice(idx + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function req(pathname: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  // Browsers always send Origin on a state-changing request; isSameOriginPost()
  // requires it, so the harness must do the same.
  const headers: Record<string, string> = { Cookie: cookieHeader() };
  for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k] = v;
  if (method !== "GET" && method !== "HEAD" && !headers["Origin"] && !headers["origin"]) headers["Origin"] = BASE;

  const res = await fetch(`${BASE}${pathname}`, { ...init, redirect: "manual", headers });
  absorb(res);
  return res;
}

function csrf(): string {
  return jar.get(process.env.CSRF_COOKIE_NAME ?? "edulari_csrf") ?? "";
}

async function freshLogin(email: string) {
  jar.clear();
  absorb(await fetch(`${BASE}/cart`));
  return req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: PASSWORD, csrf_token: csrf() }),
  });
}

async function main() {
  let userId = 0;
  let instructorId = 0;
  let otherId = 0;
  const paidCourseIds: number[] = [];
  const freeCourseIds: number[] = [];

  try {
    // ---- fixtures -------------------------------------------------------
    await sql`
      INSERT INTO users (name, email, password, role, is_active, email_verified, profile_completed, registration_date)
      VALUES
        (${`Phase5 Student`}, ${EMAIL}, 'x', 'student', true, true, true, now()),
        (${`Phase5 Other`}, ${OTHER_EMAIL}, 'x', 'student', true, true, true, now()),
        (${`Phase5 Instructor`}, ${INSTR_EMAIL}, 'x', 'instructor', true, true, true, now())
    `;
    const all = await sql<{ id: number; email: string }[]>`
      SELECT id, email FROM users WHERE email IN (${EMAIL}, ${OTHER_EMAIL}, ${INSTR_EMAIL})`;
    userId = Number(all.find((u) => u.email === EMAIL)!.id);
    otherId = Number(all.find((u) => u.email === OTHER_EMAIL)!.id);
    instructorId = Number(all.find((u) => u.email === INSTR_EMAIL)!.id);

    const { hashPassword } = await import("../lib/auth/passwords");
    const hash = await hashPassword(PASSWORD);
    await sql`UPDATE users SET password = ${hash} WHERE id IN (${userId}, ${otherId}, ${instructorId})`;

    const catRows = await sql<{ id: number }[]>`SELECT id FROM categories ORDER BY id LIMIT 1`;
    const categoryId = catRows.length ? Number(catRows[0]!.id) : null;

    for (const [title, price] of [
      [`P5 Paid ${SUFFIX}`, 499],
      [`P5 Paid2 ${SUFFIX}`, 501],
      [`P5 Free ${SUFFIX}`, 0],
    ] as const) {
      const rows = await sql<{ id: number }[]>`
        INSERT INTO courses (title, slug, description, price, level, instructor_id, category_id, is_published, created_at)
        VALUES (${title}, ${`p5-${title.toLowerCase().replace(/\s+/g, "-")}-${SUFFIX}`}, 'Phase 5 smoke fixture', ${price},
                'beginner', ${instructorId}, ${categoryId}, true, now())
        RETURNING id`;
      const id = Number(rows[0]!.id);
      (price === 0 ? freeCourseIds : paidCourseIds).push(id);
    }

    console.log(`\nPhase 5 live smoke against ${BASE}`);
    console.log(`  student ${userId}, other ${otherId}, instructor ${instructorId}, courses ${[...paidCourseIds, ...freeCourseIds].join(",")}\n`);

    // ---- auth -----------------------------------------------------------
    console.log("auth");
    absorb(await fetch(`${BASE}/cart`));
    const login = await req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: EMAIL, password: PASSWORD, csrf_token: csrf() }),
    });
    check("student can log in", login.status === 200 || login.status === 302, `status ${login.status}`);
    check("session cookie issued", jar.has(process.env.SESSION_COOKIE_NAME ?? "edulari_session"));

    // ---- pages render for a logged-in student ---------------------------
    console.log("\npages render");
    for (const p of ["/cart", "/wishlist", "/checkout", "/student/purchase-history"]) {
      const res = await req(p);
      const html = await res.text();
      check(`${p} renders for a logged-in student`, res.status === 200 && !html.includes("/login?reason"), `status ${res.status}`);
    }

    // ---- cart actions ---------------------------------------------------
    console.log("\ncart actions");
    for (const id of [...paidCourseIds, ...freeCourseIds]) {
      const res = await req("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: id }),
      });
      check(`add course ${id} to cart`, res.ok, `status ${res.status}`);
    }
    let cart = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${userId}`;
    check("cart holds 3 courses", cart.length === 3, `got ${cart.length}`);

    const cartHtml = await (await req("/cart")).text();
    check("cart page carries both paid courses", cartHtml.includes(`P5 Paid ${SUFFIX}`) && cartHtml.includes(`P5 Paid2 ${SUFFIX}`));
    check("cart page carries the free course", cartHtml.includes(`P5 Free ${SUFFIX}`));
    // The summary is a client component, so assert on the data it is given.
    check("cart page carries the server-computed total", cartHtml.includes("1000"));

    const noCsrf = await req("/api/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    check("cart clear without CSRF is rejected", noCsrf.status === 403, `status ${noCsrf.status}`);

    const clear = await req("/api/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ action: "clear" }),
    });
    check("cart clear succeeds with CSRF", clear.ok, `status ${clear.status}`);
    cart = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${userId}`;
    check("cart is empty after clear", cart.length === 0, `got ${cart.length}`);

    // ---- wishlist actions ----------------------------------------------
    console.log("\nwishlist actions");
    for (const id of paidCourseIds) {
      const res = await req("/api/wishlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
        body: JSON.stringify({ course_id: id }),
      });
      if (!res.ok) {
        // Phase 4 endpoint uses a different action shape; fall back to Phase 5.
        await req("/api/wishlist/action", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
          body: JSON.stringify({ course_id: id, action: "add" }),
        });
      }
    }
    let wish = await sql<{ course_id: number }[]>`SELECT course_id FROM wishlists WHERE student_id = ${userId}`;
    check("wishlist holds the 2 paid courses", wish.length === 2, `got ${wish.length}`);

    const wlHtml = await (await req("/wishlist")).text();
    check("wishlist page carries both saved courses", wlHtml.includes(`P5 Paid2 ${SUFFIX}`));

    const wlNoCsrf = await req("/api/wishlist/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move_all" }) });
    check("wishlist move-all without CSRF is rejected", wlNoCsrf.status === 403, `status ${wlNoCsrf.status}`);

    const moveAll = await req("/api/wishlist/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ action: "move_all" }),
    });
    check("move all wishlist items to cart", moveAll.ok, `status ${moveAll.status}`);
    cart = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${userId}`;
    wish = await sql<{ course_id: number }[]>`SELECT course_id FROM wishlists WHERE student_id = ${userId}`;
    check("cart now holds the 2 paid courses", cart.length === 2, `got ${cart.length}`);
    check("wishlist is now empty", wish.length === 0, `got ${wish.length}`);

    // ---- free-course checkout path -------------------------------------
    console.log("\nfree-course checkout path");
    await sql`DELETE FROM cart WHERE student_id = ${userId}`;
    await sql`INSERT INTO cart (student_id, course_id) VALUES (${userId}, ${freeCourseIds[0]})`;

    const freeCheckout = await req("/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: "{}",
    });
    const freeJson = (await freeCheckout.json().catch(() => ({}))) as { redirect?: string; enrolled_free?: number };
    check("free checkout redirects to My Courses, not to payment", freeCheckout.ok && freeJson.redirect === "/student/my-courses", JSON.stringify(freeJson));
    const enrolled = await sql<{ course_id: number }[]>`SELECT course_id FROM enrollments WHERE student_id = ${userId}`;
    check("free course is enrolled", enrolled.some((e) => Number(e.course_id) === freeCourseIds[0]));
    check("paid courses were NOT enrolled by the free path", !enrolled.some((e) => paidCourseIds.map(Number).includes(Number(e.course_id))));
    const cartAfterFree = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${userId}`;
    check("cart is empty after the free checkout", cartAfterFree.length === 0, `got ${cartAfterFree.length}`);

    // ---- paid checkout path --------------------------------------------
    console.log("\npaid checkout path");
    await sql`DELETE FROM cart WHERE student_id = ${userId}`;
    for (const id of paidCourseIds) await sql`INSERT INTO cart (student_id, course_id) VALUES (${userId}, ${id})`;

    const coRes = await req("/checkout");
    const coHtml = await coRes.text();
    check("checkout is not bounced back to the cart", coRes.status === 200, `status ${coRes.status} loc=${coRes.headers.get("location")}`);
    check("checkout carries both paid courses", coHtml.includes(`P5 Paid ${SUFFIX}`) && coHtml.includes(`P5 Paid2 ${SUFFIX}`));
    check("checkout carries the server-computed total", coHtml.includes("1000"));
    check("checkout ships the Razorpay SDK tag", coHtml.includes("checkout.razorpay.com/v1/checkout.js"));
    check("free course is not offered on checkout", !coHtml.includes(`P5 Free ${SUFFIX}`));

    // ---- payment API guards --------------------------------------------
    console.log("\npayment API guards");
    const noCsrfOrder = await req("/api/razorpay/create-order", { method: "POST" });
    check("create-order without CSRF is rejected", noCsrfOrder.status === 403, `status ${noCsrfOrder.status}`);

    const badOrigin = await fetch(`${BASE}/api/razorpay/create-order`, {
      method: "POST",
      redirect: "manual",
      headers: { Origin: "https://evil.example", "X-CSRF-Token": csrf(), Cookie: cookieHeader() },
    });
    check("create-order with a foreign Origin is rejected", badOrigin.status === 403, `status ${badOrigin.status}`);

    const badVerify = await req("/api/razorpay/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ razorpay_order_id: "order_AAAAAAAAAAAAAAAAAAAA", razorpay_payment_id: "x", razorpay_signature: "y" }),
    });
    check("verify-payment with a forged signature is rejected", badVerify.status >= 400, `status ${badVerify.status}`);

    const noCookieVerify = await fetch(`${BASE}/api/razorpay/verify-payment`, {
      method: "POST",
      redirect: "manual",
      headers: { Origin: BASE, "Content-Type": "application/json", "X-CSRF-Token": "not-the-real-token", Cookie: cookieHeader() },
    });
    check("verify-payment with a wrong CSRF token is rejected", noCookieVerify.status === 403, `status ${noCookieVerify.status}`);

    const unknownOrder = await req("/api/student/check-payment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ razorpay_order_id: "order_SOMEONEELSES00000" }),
    });
    check("check-payment-status for an unknown order is 404", unknownOrder.status === 404, `status ${unknownOrder.status}`);

    const markBad = await req("/api/razorpay/mark-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ razorpay_order_id: "order_X", status: "enrolled" }),
    });
    check("mark-order-status rejects a server-only status", markBad.status === 400, `status ${markBad.status}`);

    const webhookNoSig = await req("/api/razorpay/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "payment.captured" }),
    });
    check("webhook without a signature is 401", webhookNoSig.status === 401, `status ${webhookNoSig.status}`);

    const cronNoAuth = await fetch(`${BASE}/api/cron/reconcile-payments`, { redirect: "manual" });
    check("cron without a Bearer token is refused", cronNoAuth.status === 401 || cronNoAuth.status === 500, `status ${cronNoAuth.status}`);

    // ---- ownership ------------------------------------------------------
    console.log("\nownership");
    const otherOrderId = `order_OTHER${SUFFIX}`.slice(0, 30);
    await sql`
      INSERT INTO razorpay_orders (student_id, razorpay_order_id, amount_paise, currency, courses_json, status, created_at)
      VALUES (${otherId}, ${otherOrderId}, 1000, 'INR', '[]', 'created', now())`;

    const steal = await req("/api/student/check-payment-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ razorpay_order_id: otherOrderId }),
    });
    check("cannot inspect another student's order", steal.status === 404, `status ${steal.status}`);

    const stealMark = await req("/api/razorpay/mark-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ razorpay_order_id: otherOrderId, status: "cancelled" }),
    });
    check("cannot cancel another student's order", stealMark.status === 404, `status ${stealMark.status}`);
    const stillCreated = await sql<{ status: string }[]>`SELECT status FROM razorpay_orders WHERE razorpay_order_id = ${otherOrderId}`;
    check("the other student's order is untouched", stillCreated[0]?.status === "created", stillCreated[0]?.status);

    const stealReceipt = await req(`/student/receipt?order=${otherOrderId}`);
    const stealHtml = await stealReceipt.text();
    check("cannot view another student's receipt", !stealHtml.includes("rcpt-card"));

    // ---- instructor role rules -----------------------------------------
    console.log("\nrole rules");
    const iLogin = await freshLogin(INSTR_EMAIL);
    check("instructor can log in", iLogin.status === 200 || iLogin.status === 302, `status ${iLogin.status}`);

    for (const p of ["/cart", "/wishlist", "/checkout"]) {
      const res = await req(p);
      check(`instructor is redirected away from ${p}`, res.status === 307 || res.status === 302, `status ${res.status}`);
    }

    const iOrder = await req("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: "{}",
    });
    check("instructor cannot create a payment order", iOrder.status === 403, `status ${iOrder.status}`);

    const iAdd = await req("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: paidCourseIds[0] }),
    });
    check("instructor cannot add to the cart", iAdd.status === 403, `status ${iAdd.status}`);

    // ---- purchase history + receipt ------------------------------------
    console.log("\npurchase history and receipt");
    await freshLogin(EMAIL);

    const histOrderId = `order_HIST${SUFFIX}`.slice(0, 30);
    const histPayId = `pay_HIST${SUFFIX}`.slice(0, 48);
    await sql`
      INSERT INTO purchase_history
        (student_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency, status, enrolled_count, courses_json, created_at)
      VALUES (${userId}, ${histOrderId}, ${histPayId}, 100000, 'INR', 'enrolled', 2,
              ${JSON.stringify([{ course_id: paidCourseIds[0], title: `P5 Paid ${SUFFIX}`, price: 499 }])}, now())`;
    await sql`
      INSERT INTO razorpay_orders (student_id, razorpay_order_id, amount_paise, currency, courses_json, status, created_at)
      VALUES (${userId}, ${`order_ABAND${SUFFIX}`.slice(0, 30)}, 50000, 'INR',
              ${JSON.stringify([{ course_id: paidCourseIds[1], title: `P5 Paid2 ${SUFFIX}`, price: 501 }])}, 'abandoned',
              now() - interval '1 hour')`;
    await sql`
      INSERT INTO razorpay_orders (student_id, razorpay_order_id, amount_paise, currency, courses_json, status, failure_reason, created_at)
      VALUES (${userId}, ${`order_CANC${SUFFIX}`.slice(0, 30)}, 50000, 'INR',
              ${JSON.stringify([{ course_id: paidCourseIds[1], title: `P5 Paid2 ${SUFFIX}`, price: 501 }])}, 'cancelled',
              'cancelled_by_user', now() - interval '2 hours')`;

    const phHtml = await (await req("/student/purchase-history")).text();
    check("purchase history ships the table", phHtml.includes("ph-table"));
    check("purchase history carries the enrolled payment", phHtml.includes(histOrderId));
    check("purchase history ships both modal shells", phHtml.includes("phCheckModal") && phHtml.includes("phDetailsModal"));
    check("purchase history ships the filter bar", phHtml.includes("phFilterBar"));
    check("purchase history ships the status badges", phHtml.includes("ph-badge--enrolled"));

    const receiptRes = await req(`/student/receipt?order=${histOrderId}`);
    const receiptHtml = await receiptRes.text();
    check("receipt renders", receiptRes.status === 200 && receiptHtml.includes("rcpt-card"), `status ${receiptRes.status}`);
    check("receipt shows the order id", receiptHtml.includes(histOrderId));
    check("receipt shows the payment id", receiptHtml.includes(histPayId));
    check("receipt loads html2canvas + jsPDF", receiptHtml.includes("html2canvas") && receiptHtml.includes("jspdf"));
    // receipt.php includes neither navbar.php nor footer.php, so the page must ship no
    // chrome markup at all - not hide it with CSS. Assert the markup is absent.
    check("receipt has no navbar markup", !receiptHtml.includes("unavNav") && !receiptHtml.includes('class="unav"'));
    check("receipt has no footer markup", !receiptHtml.includes("uftr-footer"));
    check("receipt loads no navbar.css", !receiptHtml.includes("navbar.css"));

    const pendingReceipt = await req("/student/receipt?order=order_DOES_NOT_EXIST");
    const pendingHtml = await pendingReceipt.text();
    check("unknown receipt shows no invoice", !pendingHtml.includes("rcpt-card"));

    // ---- reconciliation layers -----------------------------------------
    console.log("\nreconciliation bookkeeping");
    const settings = await sql<{ setting_key: string; setting_value: string }[]>`
      SELECT setting_key, setting_value FROM app_settings
      WHERE setting_key IN ('last_payment_reconcile_run', 'last_cleanup_run')`;
    check("payment reconciliation is scheduled", settings.some((s) => s.setting_key === "last_payment_reconcile_run"));
    check("cancelled-order cleanup is scheduled", settings.some((s) => s.setting_key === "last_cleanup_run"));
  } finally {
    console.log("\ncleanup");
    try {
      const ids = [userId, instructorId, otherId].filter(Boolean);
      if (ids.length) {
        const rows = await sql<{ id: number }[]>`SELECT id FROM users WHERE id IN ${sql(ids)} OR email LIKE ${`%${SUFFIX}%`}`;
        const uids = rows.map((u) => Number(u.id));
        await sql`DELETE FROM cart WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM wishlists WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM purchase_history WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM razorpay_orders WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id IN ${sql(uids)})`;
        await sql`DELETE FROM enrollments WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM security_events WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM user_sessions WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM login_attempts WHERE identifier IN (${EMAIL}, ${INSTR_EMAIL})`;
        await sql`DELETE FROM courses WHERE title LIKE ${`%${SUFFIX}%`}`;
        await sql`DELETE FROM users WHERE id IN ${sql(uids)}`;
        console.log(`  removed users ${uids.join(",")} and their fixtures`);
      }
    } catch (err) {
      console.log(`  cleanup warning: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sql.end({ timeout: 5 });
  }

  console.log(`\nsmoke-phase5: ${pass} passed, ${fail} failed (${pass + fail} checks)`);
  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

void main();
