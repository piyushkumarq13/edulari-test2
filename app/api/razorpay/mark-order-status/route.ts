import { NextResponse } from "next/server";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { getOrderOwnedBy, updateRazorpayOrderStatus } from "@/lib/db/commerce";
import { logSecurity } from "@/lib/security/events";

const ALLOWED = new Set(["cancelled", "failed"]);
const REASONS = new Set(["cancelled_by_user", "payment_failed", "checkout_closed", "unknown"]);

/**
 * Port of mark-order-status.php.
 *
 * These are client-reported, so they are only recorded while the row is still
 * `created` (handled inside updateRazorpayOrderStatus), and never cancel an order
 * whose money was already captured. The order must belong to the caller.
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 });

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ ok: false, error: "Instructors are not permitted to purchase courses." }, { status: 403 });
  }

  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : null;

  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !ALLOWED.has(status)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const order = await getOrderOwnedBy(orderId, user.id);
  if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });

  const updated = await updateRazorpayOrderStatus(orderId, status as "cancelled" | "failed", reason);

  await logSecurity("PAYMENT_ORDER_STATUS_MARKED", { user_id: user.id, order_id: orderId, status, applied: updated }, req);

  return NextResponse.json({ ok: true, applied: updated });
}
