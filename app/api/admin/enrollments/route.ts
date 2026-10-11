import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import {
  enrollStudentAction,
  unenrollStudentAction,
  verifyAndEnrollAction,
} from "@/lib/api/admin/enrollments";

export const runtime = "nodejs";

/**
 * AJAX handler for public/admin/enrollments.php. The PHP page answered its own POSTs with JSON
 * (`{success, message}`); those three actions now live here and are fetched from the same page.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const form = await req.formData();
  const token = form.get("csrf_token");
  if (!(await csrfOk(typeof token === "string" ? token : ""))) {
    return NextResponse.json({ success: false, message: "Invalid CSRF token." });
  }

  if (form.get("enroll") !== null) {
    const studentId = Number.parseInt(String(form.get("student_id") ?? "0"), 10) || 0;
    const courseId = Number.parseInt(String(form.get("course_id") ?? "0"), 10) || 0;
    const result = await enrollStudentAction(studentId, courseId);
    if (result.success) {
      await auditAdmin(user, "admin.enrollment.enroll", { student_id: studentId, course_id: courseId }, req);
    }
    return NextResponse.json(result);
  }

  if (form.get("unenroll") !== null) {
    const enrollmentId = Number.parseInt(String(form.get("enrollment_id") ?? "0"), 10) || 0;
    const result = await unenrollStudentAction(enrollmentId);
    if (result.success) {
      await auditAdmin(user, "admin.enrollment.unenroll", { enrollment_id: enrollmentId }, req);
    }
    return NextResponse.json(result);
  }

  if (form.get("verify_and_enroll") !== null) {
    const paymentId = String(form.get("payment_id") ?? "").trim();
    const result = await verifyAndEnrollAction(paymentId);
    if (result.success) {
      await auditAdmin(user, "admin.enrollment.verify_and_enroll", { payment_id: paymentId }, req);
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ success: false, message: "Unknown action." });
}
