import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { getCart, getOrderOwnedBy, getPurchaseByOrderIdForStudent, parseCourses } from "@/lib/db/commerce";
import { verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { amountMatches, computeOrderTotalPaise, paiseToRupees, splitPaidAndFree } from "@/lib/payments/amounts";
import { processCapturedPayment } from "@/lib/payments/capture";
import { decodePendingOrder, pendingOrderCookieOptions, PENDING_ORDER_COOKIE } from "@/lib/payments/pending-order";
import { logSecurity } from "@/lib/security/events";

export const maxDuration = 60;

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "";
}

/** Layer 1 of verify-payment.php: verify the signature server-side and enroll at once. */
export async function POST(req: Request) {
  // PHP answers with `message`, not `error`, on this endpoint — the checkout JS reads
  // result.message, so the key must stay `message`.
  const fail = async (message: string, status = 400) => {
    await logSecurity("PAYMENT_VERIFY_FAILED", { message }, req);
    return NextResponse.json({ success: false, message }, { status });
  };

  if (!isSameOriginPost(req)) return fail("Invalid request.", 403);

  const user = await requireApiUser();
  if (!user) return fail("Please log in.", 401);
  // Stronger than the PHP, which answers 200 here: the body keeps the same
  // `message` key so checkout.php's JS still shows the right text.
  if (user.role !== "student") {
    return NextResponse.json({ success: false, message: "Instructors are not permitted to purchase courses." }, { status: 403 });
  }

  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, message: "Invalid request token." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

  if (!paymentId || !signature) return fail("Payment data missing. Please try again.");

  // ── Session binding parity: the order id must match the value stored at order
  //    creation (the PHP $_SESSION['razorpay_order_id']). ─────────────────────
  const jar = await cookies();
  const pending = decodePendingOrder(jar.get(PENDING_ORDER_COOKIE)?.value);
  if (!pending || pending.orderId !== orderId) return fail("Order mismatch.");

  const order = await getOrderOwnedBy(orderId, user.id);
  if (!order) return fail("Order mismatch.");

  // ── The real security check: HMAC-SHA256(order_id|payment_id), timing-safe. ──
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) return fail("Payment signature invalid.");

  // ── Cart is fetched BEFORE processing (processCapturedPayment removes items). ─
  const cartItems = await getCart(user.id);
  const { paidItems, freeItems } = splitPaidAndFree(cartItems);

  const expectedPaise = computeOrderTotalPaise(cartItems);
  const paidPaise = pending.amountPaise;

  if (!amountMatches(expectedPaise, paidPaise)) return fail("Payment amount mismatch. Please contact support.");

  const existingPurchase = await getPurchaseByOrderIdForStudent(orderId, user.id);
  if (existingPurchase?.status === "refunded") {
    return fail("This payment was already refunded. Please contact support.", 409);
  }

  // ── All cart items (paid + free) are enrolled together, as in the PHP. ──────
  const allItems = [...paidItems, ...freeItems];
  const courses = allItems.map((item) => ({
    course_id: Number(item.course_id),
    title: String(item.title ?? ""),
    price: Number(item.price),
  }));

  // Fall back to the stored snapshot if the cart changed between order and verify.
  const snapshot = courses.length > 0 ? courses : parseCourses(order.courses_json);
  if (snapshot.length === 0) return fail("Order has no courses. Please contact support.", 409);

  const result = await processCapturedPayment(user.id, orderId, paymentId, paidPaise, snapshot, clientIp(req));

  if (!result.success) {
    await logSecurity("PAYMENT_ENROLLMENT_FAILED", { user_id: user.id, order_id: orderId }, req);
    return NextResponse.json({
      success: false,
      message: "Payment was received but enrollment failed. Please contact support and reference your account email.",
    });
  }

  // Clean up the one-shot pending-order cookie, mirroring unset($_SESSION[...]).
  jar.set(PENDING_ORDER_COOKIE, "", { ...pendingOrderCookieOptions(), maxAge: 0 });

  await logSecurity(
    "PAYMENT_VERIFIED",
    { user_id: user.id, order_id: orderId, enrolled_count: result.enrolled_count, already_processed: result.already_processed },
    req,
  );

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
    amount: paiseToRupees(paidPaise),
    enrolled_count: result.enrolled_count,
    courses: allItems.map((item) => ({
      title: String(item.title ?? ""),
      price: Number(item.price ?? 0),
      thumbnail: String(item.thumbnail ?? ""),
    })),
  });
}
