import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { getOrderByRazorpayId, parseCourses } from "@/lib/db/commerce";
import { processCapturedPayment } from "@/lib/payments/capture";
import { logSecurity } from "@/lib/security/events";

export const maxDuration = 60;

/**
 * Layer 2 of razorpay-webhook.php.
 *
 * The raw body is read with req.text() BEFORE any parsing, because the signature is
 * computed over the exact bytes Razorpay sent. Parsing first would break it.
 *
 * Always answers 200 for a valid signature even when the order is unknown or the
 * enrollment failed: a non-2xx would make Razorpay retry forever, and Layer 3
 * (reconciliation) is what rescues genuinely failed orders.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    await logSecurity("PAYMENT_WEBHOOK_INVALID_SIGNATURE", {}, req);
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: unknown }; order?: { entity?: unknown } } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (event.event !== "payment.captured") return NextResponse.json({ ok: true, ignored: true });

  const paymentEntity = (event.payload?.payment?.entity ?? {}) as Record<string, unknown>;
  const orderEntity = (event.payload?.order?.entity ?? {}) as Record<string, unknown>;

  const orderId = String(orderEntity.id ?? paymentEntity.order_id ?? "");
  const paymentId = String(paymentEntity.id ?? "");
  const amountPaise = Number(paymentEntity.amount ?? 0);

  if (!orderId || !paymentId || !amountPaise) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const order = await getOrderByRazorpayId(orderId);
  if (!order) {
    // Unknown order: nothing to enroll. Logged without the payment id.
    await logSecurity("PAYMENT_WEBHOOK_UNKNOWN_ORDER", { order_id: orderId }, req);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await processCapturedPayment(
    order.student_id,
    orderId,
    paymentId,
    amountPaise,
    parseCourses(order.courses_json),
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
  );

  await logSecurity(
    "PAYMENT_WEBHOOK_PROCESSED",
    { order_id: orderId, success: result.success, already_processed: result.already_processed },
    req,
  );

  return NextResponse.json({ ok: true });
}
