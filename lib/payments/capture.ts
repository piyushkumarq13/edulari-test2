import { sql, withTransaction } from "@/lib/db/client";
import {
  getPurchaseByPaymentId,
  recordPurchase,
  updatePurchaseStatus,
  updateRazorpayOrderStatus,
  type CourseSnapshot,
} from "@/lib/db/commerce";

export type CaptureResult = {
  success: boolean;
  already_processed: boolean;
  enrolled_count: number;
  message?: string;
};

/** Minimal surface processCapturedPayment() needs, so tests can stub it. */
export type EnrollmentOps = {
  isEnrolled(studentId: number, courseId: number): Promise<boolean>;
  enroll(studentId: number, courseId: number): Promise<{ success: boolean; message?: string }>;
  removeFromCart(studentId: number, courseId: number): Promise<void>;
};

export const defaultEnrollmentOps: EnrollmentOps = {
  async isEnrolled(studentId, courseId) {
    const rows = await sql<{ id: number }[]>`
      SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
    `;
    return rows.length > 0;
  },
  async enroll(studentId, courseId) {
    try {
      await sql`
        INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
        VALUES (${courseId}, ${studentId}, now(), 0)
        ON CONFLICT DO NOTHING
      `;
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Enrollment failed" };
    }
  },
  async removeFromCart(studentId, courseId) {
    await sql`DELETE FROM cart WHERE student_id = ${studentId} AND course_id = ${courseId}`;
  },
};

export const ALREADY_ENROLLED_MESSAGE = "Already enrolled in this course";

/**
 * Single shared entry point for turning a captured Razorpay payment into
 * enrollments. Called by verify-payment (Layer 1), the webhook (Layer 2), the
 * reconciliation sweep (Layer 3) and check-payment-status, so there is exactly one
 * enrollment code path.
 *
 * Idempotent: safe to call more than once for the same payment_id.
 */
export async function processCapturedPayment(
  studentId: number,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  amountPaise: number,
  courses: CourseSnapshot[],
  ipAddress = "",
  ops: EnrollmentOps = defaultEnrollmentOps,
  deps: {
    record?: typeof recordPurchase;
    updatePurchase?: typeof updatePurchaseStatus;
    updateOrder?: typeof updateRazorpayOrderStatus;
    findByPaymentId?: typeof getPurchaseByPaymentId;
    transaction?: <T>(fn: (t: typeof sql) => Promise<T>) => Promise<T>;
  } = {},
): Promise<CaptureResult> {
  const record = deps.record ?? recordPurchase;
  const updatePurchase = deps.updatePurchase ?? updatePurchaseStatus;
  const updateOrder = deps.updateOrder ?? updateRazorpayOrderStatus;
  const findByPaymentId = deps.findByPaymentId ?? getPurchaseByPaymentId;
  const transaction = deps.transaction ?? withTransaction;

  // ── Idempotency: already fully processed? ───────────────────────────────────
  const existing = await findByPaymentId(razorpayPaymentId);
  if (existing && existing.status === "enrolled") {
    return { success: true, already_processed: true, enrolled_count: existing.enrolled_count };
  }

  // ── Record the purchase if not already recorded (race-safe) ─────────────────
  let purchaseId = existing?.id ?? null;
  if (!purchaseId) {
    purchaseId = await record({
      studentId,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      amountPaise,
      currency: process.env.CURRENCY_CODE ?? "INR",
      courses,
      ipAddress,
    });

    if (!purchaseId) {
      // Concurrent insert from another layer — re-read it.
      const again = await findByPaymentId(razorpayPaymentId);
      if (again && again.status === "enrolled") {
        return { success: true, already_processed: true, enrolled_count: again.enrolled_count };
      }
      purchaseId = again?.id ?? null;
    }
  }

  // ── Enroll every listed course atomically ───────────────────────────────────
  let enrolledCount = 0;

  try {
    await transaction(async () => {
      for (const course of courses) {
        const courseId = Number(course?.course_id ?? 0);
        if (!courseId) continue;

        if (!await ops.isEnrolled(studentId, courseId)) {
          const result = await ops.enroll(studentId, courseId);
          if (!result.success && result.message !== ALREADY_ENROLLED_MESSAGE) {
            throw new Error(`Enrollment failed for course ${courseId}`);
          }
          enrolledCount++;
        }
        await ops.removeFromCart(studentId, courseId);
      }
    });

    if (purchaseId) await updatePurchase(purchaseId, "enrolled", enrolledCount);
    await updateOrder(razorpayOrderId, "enrolled");

    return { success: true, already_processed: false, enrolled_count: enrolledCount };
  } catch (err) {
    if (purchaseId) await updatePurchase(purchaseId, "enrollment_failed", 0);
    await updateOrder(razorpayOrderId, "enrollment_failed");

    // Logged without the payment id or any secret.
    console.error(
      `[payments] processCapturedPayment enrollment FAILED (${err instanceof Error ? err.message : "unknown"}) — student ${studentId}`,
    );

    return { success: false, already_processed: false, enrolled_count: 0, message: "Enrollment failed." };
  }
}
