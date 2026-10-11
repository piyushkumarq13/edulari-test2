import { sql } from "@/lib/db/client";
import { parseCourses, updateRazorpayOrderStatus, type CourseSnapshot, type OrderRow } from "@/lib/db/commerce";
import { fetchCapturedRazorpayPayment, type RazorpayPayment } from "./razorpay";
import { processCapturedPayment } from "./capture";

// Verbatim from private/functions/payment_reconciliation.php, including its
// "TESTING" values. See docs/analysis/phase5.md section 9.
export const RECONCILE_INTERVAL_SECONDS = 60;
export const RECONCILE_GRACE_SECONDS = 10;
export const RECONCILE_MAX_ORDERS = 20;
export const RECONCILE_ABANDON_AFTER = 120;
export const RECONCILE_RECHECK_WINDOW_SECONDS = 3600;
export const CLEANUP_RETENTION_DAYS = 10;
export const CLEANUP_INTERVAL_SECONDS = 21600;

const LAST_RECONCILE_KEY = "last_payment_reconcile_run";
const LAST_CLEANUP_KEY = "last_cleanup_run";

export type ReconcileSummary = { scanned: number; enrolled: number; abandoned: number; unreachable: number };

async function claimRun(key: string, lastRun: number): Promise<boolean> {
  const res = await sql`
    UPDATE app_settings SET setting_value = ${String(Math.floor(Date.now() / 1000))}
    WHERE setting_key = ${key} AND setting_value = ${String(lastRun)}
  `;
  return res.count > 0;
}

async function readLastRun(key: string): Promise<number> {
  try {
    const rows = await sql<{ setting_value: string }[]>`
      SELECT setting_value FROM app_settings WHERE setting_key = ${key}
    `;
    if (rows.length) return Number(rows[0].setting_value) || 0;
    await sql`
      INSERT INTO app_settings (setting_key, setting_value) VALUES (${key}, '0')
      ON CONFLICT (setting_key) DO NOTHING
    `;
    return 0;
  } catch {
    // Fail open: never take the site down because the settings row is unreadable.
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Port of maybeRunPaymentReconciliation() — cheap no-op unless the interval elapsed. */
export async function maybeRunPaymentReconciliation(): Promise<boolean> {
  const lastRun = await readLastRun(LAST_RECONCILE_KEY);
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - lastRun < RECONCILE_INTERVAL_SECONDS) return false;
  return claimRun(LAST_RECONCILE_KEY, lastRun);
}

/** Port of maybeRunCancelledOrdersCleanup() — same claim pattern. */
export async function maybeRunCancelledOrdersCleanup(): Promise<boolean> {
  const lastRun = await readLastRun(LAST_CLEANUP_KEY);
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - lastRun < CLEANUP_INTERVAL_SECONDS) return false;
  return claimRun(LAST_CLEANUP_KEY, lastRun);
}

async function staleOrders(): Promise<OrderRow[]> {
  return sql<OrderRow[]>`
    SELECT id, student_id, razorpay_order_id, amount_paise, currency, courses_json, status, failure_reason, created_at
    FROM razorpay_orders
    WHERE (
        status IN ('created', 'enrollment_failed')
        OR (status IN ('cancelled', 'failed') AND created_at > (now() - (${RECONCILE_RECHECK_WINDOW_SECONDS} * interval '1 second')))
    )
      AND created_at < (now() - (${RECONCILE_GRACE_SECONDS} * interval '1 second'))
    ORDER BY created_at ASC
    LIMIT ${RECONCILE_MAX_ORDERS}
  `;
}

/** Port of reconcilePendingRazorpayPayments() (Layer 3). */
export async function reconcilePendingRazorpayPayments(): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { scanned: 0, enrolled: 0, abandoned: 0, unreachable: 0 };
  const orders = await staleOrders();

  for (const order of orders) {
    summary.scanned++;
    const result = await checkAndReconcileOneOrder(order);
    if (result === "enrolled") summary.enrolled++;
    else if (result === "abandoned") summary.abandoned++;
    else if (result === "unreachable") summary.unreachable++;
  }
  return summary;
}

/** Port of checkAndReconcileOneOrder(). */
export async function checkAndReconcileOneOrder(
  order: OrderRow,
  fetchPayment: (orderId: string) => Promise<RazorpayPayment | false | null> = fetchCapturedRazorpayPayment,
): Promise<"enrolled" | "abandoned" | "unreachable" | "noop"> {
  const captured = await fetchPayment(order.razorpay_order_id);

  if (captured === null) return "unreachable"; // API failed — retry next run

  if (captured === false) {
    // Only `created` / `enrollment_failed` rows may be downgraded to abandoned.
    // A cancelled/failed row already has a terminal client-reported status; it is
    // re-checked briefly but never downgraded.
    if (order.status === "created" || order.status === "enrollment_failed") {
      const ageSeconds = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
      if (ageSeconds >= RECONCILE_ABANDON_AFTER) {
        await updateRazorpayOrderStatus(order.razorpay_order_id, "abandoned");
        return "abandoned";
      }
    }
    return "noop";
  }

  const courses: CourseSnapshot[] = parseCourses(order.courses_json);
  const result = await processCapturedPayment(
    order.student_id,
    order.razorpay_order_id,
    captured.id,
    Number(captured.amount),
    courses,
  );
  return result.success ? "enrolled" : "noop";
}

/** Port of purgeOldCancelledOrders() (Layer 4). */
export async function purgeOldCancelledOrders(): Promise<number> {
  const res = await sql`
    DELETE FROM razorpay_orders
    WHERE status IN ('cancelled', 'failed')
      AND created_at < (now() - (${CLEANUP_RETENTION_DAYS} * interval '1 day'))
  `;
  if (res.count > 0) {
    console.log(`[payments] cleanup: purged ${res.count} cancelled/failed order(s) older than ${CLEANUP_RETENTION_DAYS} days`);
  }
  return res.count;
}
