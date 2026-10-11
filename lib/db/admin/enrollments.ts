import { sql, withTransaction } from "@/lib/db/client";
import { parseCourses, type CourseSnapshot } from "@/lib/db/commerce";

/**
 * Port of the enrollments queries and admin helpers used by public/admin/enrollments.php:
 * private/functions/admin.php (adminEnrollStudent, adminUnenrollStudent) and
 * private/functions/student.php (isEnrolled, getPurchaseByPaymentId admin branch).
 */

export const ENROLLMENTS_PER_PAGE = 20;

export type EnrollmentRow = {
  id: number;
  enrolled_at: Date;
  progress_percentage: number;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  price: number;
  instructor_name: string;
};

export type EnrollmentStats = {
  totalEnrollments: number;
  totalRevenue: number;
  /** Already a string because Postgres numeric comes back as text; the PHP echoed it verbatim. */
  avgProgress: string;
  freeEnrollments: number;
};

export type StudentOption = { id: number; name: string; email: string };
export type CourseOption = { id: number; title: string; price: number };

export type AdminPurchase = {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  status: string;
  razorpay_payment_id: string;
  courses: CourseSnapshot[];
};

export async function getEnrollments(params: {
  search: string;
  courseId: number;
  page: number;
}): Promise<{ rows: EnrollmentRow[]; total: number; totalPages: number; page: number }> {
  const { search, courseId } = params;

  const like = `%${search}%`;
  let where = sql`WHERE 1 = 1`;
  if (search !== "") {
    where = sql`${where} AND (u.name ILIKE ${like} OR u.email ILIKE ${like} OR c.title ILIKE ${like})`;
  }
  if (courseId > 0) {
    where = sql`${where} AND e.course_id = ${courseId}`;
  }

  const totalRows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM enrollments e
    JOIN users u   ON e.student_id    = u.id
    JOIN courses c ON e.course_id     = c.id
    JOIN users i   ON c.instructor_id = i.id
    ${where}
  `;
  const total = totalRows[0]?.count ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / ENROLLMENTS_PER_PAGE));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const offset = (page - 1) * ENROLLMENTS_PER_PAGE;

  const rows = await sql<EnrollmentRow[]>`
    SELECT e.id, e.enrolled_at, e.progress_percentage,
           u.id    AS student_id,   u.name  AS student_name, u.email AS student_email,
           c.id    AS course_id,    c.title AS course_title,  c.price,
           i.name  AS instructor_name
    FROM enrollments e
    JOIN users u   ON e.student_id    = u.id
    JOIN courses c ON e.course_id     = c.id
    JOIN users i   ON c.instructor_id = i.id
    ${where}
    ORDER BY e.enrolled_at DESC
    LIMIT ${ENROLLMENTS_PER_PAGE} OFFSET ${offset}
  `;

  return { rows, total, totalPages, page };
}

/** Summary cards: unfiltered totals across the whole enrollments table. */
export async function getEnrollmentStats(): Promise<EnrollmentStats> {
  const rows = await sql<{
    total: number;
    revenue: string;
    avg: string | null;
    free: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM enrollments) AS total,
      (SELECT COALESCE(SUM(c.price), 0) FROM enrollments e JOIN courses c ON e.course_id = c.id) AS revenue,
      (SELECT ROUND(AVG(progress_percentage)::numeric, 1) FROM enrollments) AS avg,
      (SELECT COUNT(*)::int FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.price = 0) AS free
  `;
  const r = rows[0];
  return {
    totalEnrollments: r?.total ?? 0,
    totalRevenue: Number(r?.revenue ?? 0),
    avgProgress: r?.avg ?? "0",
    freeEnrollments: r?.free ?? 0,
  };
}

export async function getStudentOptions(): Promise<StudentOption[]> {
  return sql<StudentOption[]>`SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name`;
}

export async function getCourseOptionsForEnrollment(): Promise<CourseOption[]> {
  return sql<CourseOption[]>`SELECT id, title, price FROM courses ORDER BY title`;
}

/** adminEnrollStudent(): returns "already_enrolled" | true | false exactly as the PHP did. */
export async function adminEnrollStudent(
  studentId: number,
  courseId: number,
): Promise<"already_enrolled" | boolean> {
  const existing = await sql<{ id: number }[]>`
    SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId} LIMIT 1
  `;
  if (existing.length > 0) return "already_enrolled";

  const student = await sql<{ id: number }[]>`
    SELECT id FROM users WHERE id = ${studentId} AND role = 'student' LIMIT 1
  `;
  if (student.length === 0) return false;

  const course = await sql<{ id: number }[]>`SELECT id FROM courses WHERE id = ${courseId} LIMIT 1`;
  if (course.length === 0) return false;

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO enrollments (student_id, course_id, enrolled_at, progress_percentage)
    VALUES (${studentId}, ${courseId}, NOW(), 0)
    RETURNING id
  `;
  return inserted.length > 0;
}

/**
 * adminUnenrollStudent(): deletes all progress rows then the enrollment, in one transaction.
 * Certificates are intentionally NOT touched (matching the PHP).
 */
export async function adminUnenrollStudent(enrollmentId: number): Promise<boolean> {
  try {
    await withTransaction(async (tx) => {
      await tx`DELETE FROM lesson_progress WHERE enrollment_id = ${enrollmentId}`;
      await tx`DELETE FROM quiz_attempts WHERE enrollment_id = ${enrollmentId}`;
      await tx`DELETE FROM assignment_submissions WHERE enrollment_id = ${enrollmentId}`;
      await tx`DELETE FROM enrollments WHERE id = ${enrollmentId}`;
    });
    return true;
  } catch (err) {
    console.error("[admin] unenroll error:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function isEnrolled(studentId: number, courseId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId} LIMIT 1
  `;
  return rows.length > 0;
}

/** getPurchaseByPaymentId($id, 0) — the admin branch that also joins the student's name/email. */
export async function getAdminPurchaseByPaymentId(
  paymentId: string,
): Promise<AdminPurchase | null> {
  const trimmed = paymentId.trim();
  if (trimmed === "") return null;

  const rows = await sql<{
    id: number;
    student_id: number;
    student_name: string;
    student_email: string;
    status: string;
    razorpay_payment_id: string;
    courses_json: string;
  }[]>`
    SELECT ph.id, ph.student_id, ph.status, ph.razorpay_payment_id, ph.courses_json,
           u.name AS student_name, u.email AS student_email
    FROM purchase_history ph
    JOIN users u ON ph.student_id = u.id
    WHERE ph.razorpay_payment_id = ${trimmed}
    LIMIT 1
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: row.student_name,
    student_email: row.student_email,
    status: row.status,
    razorpay_payment_id: row.razorpay_payment_id,
    courses: parseCourses(row.courses_json),
  };
}
