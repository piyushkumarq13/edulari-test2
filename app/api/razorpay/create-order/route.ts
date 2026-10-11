import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { getCart, insertRazorpayOrder } from "@/lib/db/commerce";
import { splitPaidAndFree, computeOrderTotalPaise } from "@/lib/payments/amounts";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { encodePendingOrder, pendingOrderCookieOptions, PENDING_ORDER_COOKIE } from "@/lib/payments/pending-order";
import { CURRENCY_CODE } from "@/lib/format";
import { logSecurity } from "@/lib/security/events";

/** Port of create-order.php. The amount is always recomputed from the cart. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.role === "instructor") {
    return NextResponse.json({ error: "Instructors are not permitted to purchase courses." }, { status: 403 });
  }
  if (user.role !== "student") {
    return NextResponse.json({ error: "Instructors are not permitted to purchase courses." }, { status: 403 });
  }

  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const cartItems = await getCart(user.id);
  const { paidItems } = splitPaidAndFree(cartItems);
  if (paidItems.length === 0) {
    return NextResponse.json({ error: "No paid items in cart" });
  }

  const amountPaise = computeOrderTotalPaise(cartItems);
  const receipt = `rcpt_${user.id}_${Math.floor(Date.now() / 1000)}`;

  let order;
  try {
    order = await createRazorpayOrder({
      amountPaise,
      currency: CURRENCY_CODE,
      receipt,
      notes: { student_id: String(user.id) },
    });
  } catch (err) {
    // Logged without the key id, secret or response body.
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[payments] create-order failed (${message}) — user ${user.id}`);
    const network = /network/i.test(message);
    return NextResponse.json({
      error: network ? "Could not reach payment server. Please try again." : "Failed to create payment order. Please try again.",
    });
  }

  const coursesSnapshot = paidItems.map((item) => ({
    course_id: Number(item.course_id),
    title: String(item.title ?? ""),
    price: Number(item.price),
  }));

  const inserted = await insertRazorpayOrder({
    studentId: user.id,
    razorpayOrderId: order.id,
    amountPaise,
    currency: CURRENCY_CODE,
    courses: coursesSnapshot,
  });
  if (!inserted) {
    console.error(`[payments] razorpay_orders insert failed for an order — user ${user.id}`);
  }

  const jar = await cookies();
  jar.set(PENDING_ORDER_COOKIE, encodePendingOrder({ orderId: order.id, amountPaise }), pendingOrderCookieOptions());

  await logSecurity("PAYMENT_ORDER_CREATED", { user_id: user.id, amount_paise: amountPaise, course_count: coursesSnapshot.length }, req);

  return NextResponse.json({
    order_id: order.id,
    amount: amountPaise,
    currency: CURRENCY_CODE,
    key: process.env.RAZORPAY_KEY_ID ?? "",
    name: process.env.SITE_NAME ?? "Edulari",
    email: user.email,
    // create-order.php sends `$user['phone'] ?? ''`, but getCurrentUser() in
    // private/auth.php only exposes id/name/email/role/profile_image, so this is
    // always the empty string. Kept as a field for parity with the PHP payload.
    contact: "",
  });
}
