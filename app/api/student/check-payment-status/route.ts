import { NextResponse } from "next/server";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import {
  getOrderOwnedBy,
  getPurchaseByOrderIdForStudent,
  parseCourses,
} from "@/lib/db/commerce";
import { fetchCapturedRazorpayPayment } from "@/lib/payments/razorpay";
import { amountMatches } from "@/lib/payments/amounts";
import { processCapturedPayment } from "@/lib/payments/capture";

export const maxDuration = 60;

/**
 * Port of student/check-payment-status.php — the manual "still pending?" poll.
 *
 * Ownership is enforced. When Razorpay reports a captured payment that Layers 1/2
 * missed, enrollment happens here through the same processCapturedPayment() path.
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ error: "Instructors are not permitted to purchase courses." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const order = await getOrderOwnedBy(orderId, user.id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  // Already terminal: report the stored state without touching Razorpay.
  const stored = await getPurchaseByOrderIdForStudent(orderId, user.id);
  if (stored && (stored.status === "enrolled" || stored.status === "refunded")) {
    return NextResponse.json({ status: stored.status, enrolled_count: stored.enrolled_count });
  }

  const captured = await fetchCapturedRazorpayPayment(orderId);
  if (captured === null) {
    // Unknown, not "unpaid" — the client must keep waiting.
    return NextResponse.json({ status: "unknown" }, { status: 202 });
  }
  if (captured === false) {
    return NextResponse.json({ status: order.status === "created" ? "pending" : order.status });
  }

  if (!amountMatches(Number(order.amount_paise), Number(captured.amount))) {
    return NextResponse.json({ status: "amount_mismatch" }, { status: 409 });
  }

  const result = await processCapturedPayment(
    user.id,
    orderId,
    captured.id,
    Number(captured.amount),
    parseCourses(order.courses_json),
  );

  return NextResponse.json({
    status: result.success ? "enrolled" : "enrollment_failed",
    enrolled_count: result.enrolled_count,
  });
}
