import { withTransaction } from "@/lib/db/client";
import { updatePurchaseStatus } from "@/lib/db/commerce";
import {
  adminEnrollStudent,
  adminUnenrollStudent,
  getAdminPurchaseByPaymentId,
} from "@/lib/db/admin/enrollments";

/**
 * The three write actions POSTed by public/admin/enrollments.php, expressed as functions so the
 * route handler stays thin. Messages match the PHP byte-for-byte except for the student label,
 * which the PHP double-HTML-escaped (see docs/PROGRESS.md) and this port renders once.
 */

export type ActionResult = { success: boolean; message: string };

export const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{14,}$/;

export async function enrollStudentAction(studentId: number, courseId: number): Promise<ActionResult> {
  const result = await adminEnrollStudent(studentId, courseId);
  if (result === "already_enrolled") {
    return { success: false, message: "This student is already enrolled in that course." };
  }
  if (result) {
    return { success: true, message: "Student enrolled successfully." };
  }
  return { success: false, message: "Enrollment failed. Make sure IDs are valid." };
}

export async function unenrollStudentAction(enrollmentId: number): Promise<ActionResult> {
  const ok = await adminUnenrollStudent(enrollmentId);
  return ok
    ? { success: true, message: "Student unenrolled successfully." }
    : { success: false, message: "Failed to unenroll student." };
}

/**
 * verify_and_enroll: re-attempts enrollment for every course snapshot in a verified purchase.
 * Enrollment rows are created inside one transaction; the purchase is marked enrolled afterwards.
 */
export async function verifyAndEnrollAction(paymentId: string): Promise<ActionResult> {
  const id = paymentId.trim();
  if (id === "") return { success: false, message: "Payment ID is required." };
  if (!PAYMENT_ID_RE.test(id)) return { success: false, message: "Invalid Payment ID format." };

  const purchase = await getAdminPurchaseByPaymentId(id);
  if (!purchase) {
    return { success: false, message: "No verified payment found with that Payment ID." };
  }
  if (purchase.status === "enrolled") {
    return { success: false, message: "Student is already enrolled for this payment. No action needed." };
  }
  if (purchase.status === "refunded") {
    return { success: false, message: "This payment was refunded. Cannot enroll." };
  }

  let enrolled = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    await withTransaction(async (tx) => {
      for (const course of purchase.courses) {
        const courseId = Math.trunc(Number(course.course_id ?? 0)) || 0;
        if (courseId < 1) continue;

        const existing = await tx<{ id: number }[]>`
          SELECT id FROM enrollments WHERE student_id = ${purchase.student_id} AND course_id = ${courseId} LIMIT 1
        `;
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const inserted = await tx<{ id: number }[]>`
          INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
          VALUES (${courseId}, ${purchase.student_id}, NOW(), 0)
          RETURNING id
        `;
        if (inserted.length > 0) {
          enrolled++;
        } else {
          errors.push(`Course ID ${courseId}: Enrollment failed`);
        }
      }
    });
  } catch (err) {
    console.error("[admin] verify_and_enroll failed:", err instanceof Error ? err.message : err);
    return { success: false, message: "Enrollment failed due to a server error. Check error logs." };
  }

  await updatePurchaseStatus(purchase.id, "enrolled", enrolled + skipped);

  const studentLabel = `${purchase.student_name} (${purchase.student_email})`;
  let message = `Done. Student: ${studentLabel}. Enrolled in ${enrolled} course(s).`;
  if (skipped > 0) message += ` ${skipped} already enrolled (skipped).`;
  if (errors.length > 0) message += ` Errors: ${errors.join(", ")}`;

  return { success: true, message };
}
