import { NextResponse } from "next/server";
import { maybeRunPaymentReconciliation, purgeOldCancelledOrders, reconcilePendingRazorpayPayments } from "@/lib/payments/reconciliation";

export const maxDuration = 300;

/**
 * Layer 3 + Layer 4 on a schedule (see vercel.json). The same interval guard from
 * payment_reconciliation.php runs here too, so a manual curl and the cron job can
 * never overlap and double-process an order.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron is not configured." }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ranReconcile = await maybeRunPaymentReconciliation();
  const summary = ranReconcile
    ? await reconcilePendingRazorpayPayments()
    : { scanned: 0, enrolled: 0, abandoned: 0, unreachable: 0 };

  const purged = await purgeOldCancelledOrders();

  return NextResponse.json({ ok: true, ran_reconcile: ranReconcile, summary, purged });
}
