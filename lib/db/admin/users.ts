import { sql, withTransaction } from "@/lib/db/client";

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  block_reason: string | null;
  block_note: string | null;
  profile_image: string | null;
  registration_date: string;
  last_login: string | null;
  course_count: number;
  enrollment_count: number;
};

export type AdminUserFilters = {
  role?: string;
  search?: string;
  status?: number;
};

export type AdminUserStats = {
  students: number;
  instructors: number;
  admins: number;
  active: number;
  inactive: number;
};

export type AdminEnrollmentRow = {
  id: number;
  course_id: number;
  student_id: number;
  enrolled_at: string;
  completed_at: string | null;
  progress_percentage: number;
  final_grade: number | null;
  course_title: string;
  thumbnail: string | null;
  price: number;
  instructor_id: number;
  instructor_name: string;
};

export type AdminInstructorCourseRow = {
  id: number;
  title: string;
  level: string | null;
  price: number;
  is_published: boolean;
  created_at: string;
  student_count: number;
  avg_rating: number | null;
};

export type AdminInstructorStats = {
  total_students: number;
  total_enrollments: number;
  total_revenue: number;
};

export type AdminUserDetail = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  block_reason: string | null;
  block_note: string | null;
  profile_image: string | null;
  email_verified: boolean | null;
  registration_date: string;
  last_login: string | null;
  enrollments?: AdminEnrollmentRow[];
  courses?: AdminInstructorCourseRow[];
  stats?: AdminInstructorStats;
};

const VALID_ROLES = ["admin", "instructor", "student"] as const;

export function isValidRole(role: string): boolean {
  return (VALID_ROLES as readonly string[]).includes(role);
}

/** getAllUsers() — filters + pagination, ordered by registration_date DESC. */
export async function getAllUsers(
  filters: AdminUserFilters = {},
  limit = 25,
  offset = 0,
): Promise<AdminUserRow[]> {
  const role = filters.role ?? "";
  const search = filters.search?.trim() ?? "";
  const pattern = `%${search}%`;
  const status = typeof filters.status === "number" ? filters.status === 1 : null;

  return sql<AdminUserRow[]>`
    SELECT u.*,
      (SELECT COUNT(*) FROM courses WHERE instructor_id = u.id)::int AS course_count,
      (SELECT COUNT(*) FROM enrollments WHERE student_id = u.id)::int AS enrollment_count
    FROM users u
    WHERE 1 = 1
      ${role ? sql`AND u.role = ${role}` : sql``}
      ${search ? sql`AND (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})` : sql``}
      ${status !== null ? sql`AND u.is_active = ${status}` : sql``}
    ORDER BY u.registration_date DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/** Total users matching the same filters (the COUNT(*) query in users.php). */
export async function countUsers(filters: AdminUserFilters = {}): Promise<number> {
  const role = filters.role ?? "";
  const search = filters.search?.trim() ?? "";
  const pattern = `%${search}%`;
  const status = typeof filters.status === "number" ? filters.status === 1 : null;

  const rows = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt FROM users
    WHERE 1 = 1
      ${role ? sql`AND role = ${role}` : sql``}
      ${search ? sql`AND (name ILIKE ${pattern} OR email ILIKE ${pattern})` : sql``}
      ${status !== null ? sql`AND is_active = ${status}` : sql``}
  `;
  return rows[0]?.cnt ?? 0;
}

/** Total users, unfiltered. */
export async function countAllUsers(): Promise<number> {
  const rows = await sql<{ cnt: number }[]>`SELECT COUNT(*)::int AS cnt FROM users`;
  return rows[0]?.cnt ?? 0;
}

/** Quick stats for the card row. */
export async function getUserStats(): Promise<AdminUserStats> {
  const rows = await sql<AdminUserStats[]>`
    SELECT
      COALESCE(SUM(CASE WHEN role = 'student'    THEN 1 ELSE 0 END), 0)::int AS students,
      COALESCE(SUM(CASE WHEN role = 'instructor' THEN 1 ELSE 0 END), 0)::int AS instructors,
      COALESCE(SUM(CASE WHEN role = 'admin'      THEN 1 ELSE 0 END), 0)::int AS admins,
      COALESCE(SUM(CASE WHEN is_active = true    THEN 1 ELSE 0 END), 0)::int AS active,
      COALESCE(SUM(CASE WHEN is_active = false   THEN 1 ELSE 0 END), 0)::int AS inactive
    FROM users
  `;
  return rows[0] ?? { students: 0, instructors: 0, admins: 0, active: 0, inactive: 0 };
}

/** getUserDetails() — profile plus role-specific collections. */
export async function getUserDetails(userId: number): Promise<AdminUserDetail | null> {
  const rows = await sql<AdminUserDetail[]>`SELECT * FROM users WHERE id = ${userId}`;
  const user = rows[0];
  if (!user) return null;

  if (user.role === "student") {
    user.enrollments = await sql<AdminEnrollmentRow[]>`
      SELECT e.*, c.title AS course_title, c.thumbnail, c.price,
        c.instructor_id, u.name AS instructor_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.instructor_id = u.id
      WHERE e.student_id = ${userId}
      ORDER BY e.enrolled_at DESC
    `;
  }

  if (user.role === "instructor") {
    user.courses = await sql<AdminInstructorCourseRow[]>`
      SELECT c.id, c.title, c.level, c.price, c.is_published, c.created_at,
        (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id)::int AS student_count,
        (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) AS avg_rating
      FROM courses c
      WHERE c.instructor_id = ${userId}
      ORDER BY c.created_at DESC
    `;
    const stats = await sql<AdminInstructorStats[]>`
      SELECT
        COUNT(DISTINCT e.student_id)::int AS total_students,
        COUNT(e.id)::int AS total_enrollments,
        COALESCE(SUM(c.price), 0) AS total_revenue
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = ${userId}
    `;
    user.stats = stats[0] ?? { total_students: 0, total_enrollments: 0, total_revenue: 0 };
  }

  return user;
}

/** Minimal user lookup used by the reset-password action. */
export async function getUserBasic(userId: number): Promise<{ id: number; name: string; email: string } | null> {
  const rows = await sql<{ id: number; name: string; email: string }[]>`
    SELECT id, name, email FROM users WHERE id = ${userId}
  `;
  return rows[0] ?? null;
}

/** Current is_active flag (for deciding the toggle direction). */
export async function getUserActiveStatus(userId: number): Promise<boolean | null> {
  const rows = await sql<{ is_active: boolean }[]>`SELECT is_active FROM users WHERE id = ${userId}`;
  return rows.length ? rows[0].is_active : null;
}

/** toggleUserStatus() */
export async function toggleUserStatus(userId: number, active: boolean): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE users SET is_active = ${active} WHERE id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

/** blockUser() — sets admin_blocked and kills active sessions in one transaction. */
export async function blockUser(userId: number, reason = ""): Promise<boolean> {
  return withTransaction(async (tx) => {
    const updated = await tx<{ id: number }[]>`
      UPDATE users
      SET is_active = false, block_reason = 'admin_blocked', block_note = ${reason}
      WHERE id = ${userId} AND role != 'admin'
      RETURNING id
    `;
    if (updated.length === 0) return false;
    await tx`
      UPDATE user_sessions
      SET is_active = false, kicked_reason = 'admin_blocked'
      WHERE user_id = ${userId} AND is_active = true
    `;
    return true;
  });
}

/** unblockUser() */
export async function unblockUser(userId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE users SET is_active = true, block_reason = NULL, block_note = NULL
    WHERE id = ${userId} RETURNING id
  `;
  return rows.length > 0;
}

/** changeUserRole() — validates the role and kills sessions so the new role takes effect. */
export async function changeUserRole(userId: number, newRole: string): Promise<boolean> {
  if (!isValidRole(newRole)) return false;
  return withTransaction(async (tx) => {
    const updated = await tx<{ id: number }[]>`
      UPDATE users SET role = ${newRole} WHERE id = ${userId} RETURNING id
    `;
    if (updated.length === 0) return false;
    await tx`
      UPDATE user_sessions
      SET is_active = false, kicked_reason = 'role_changed'
      WHERE user_id = ${userId} AND is_active = true
    `;
    return true;
  });
}

/** Port of adminDeleteCourse() scoped to an existing transaction. */
async function deleteCourseCascade(tx: typeof sql, courseId: number): Promise<void> {
  await tx`
    DELETE FROM quiz_answers
    WHERE attempt_id IN (
      SELECT id FROM quiz_attempts
      WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})
    )
  `;
  await tx`DELETE FROM quiz_attempts WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
  await tx`
    DELETE FROM quiz_options
    WHERE question_id IN (
      SELECT id FROM quiz_questions
      WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})
    )
  `;
  await tx`DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
  await tx`DELETE FROM assignment_submissions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
  await tx`DELETE FROM assignments WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
  await tx`DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
  await tx`DELETE FROM lessons WHERE course_id = ${courseId}`;
  await tx`DELETE FROM course_sections WHERE course_id = ${courseId}`;
  await tx`DELETE FROM enrollments WHERE course_id = ${courseId}`;
  await tx`DELETE FROM course_reviews WHERE course_id = ${courseId}`;
  await tx`DELETE FROM courses WHERE id = ${courseId}`;
}

/** deleteUser() — single transaction, mirroring the PHP cascade exactly. */
export async function deleteUser(userId: number): Promise<boolean> {
  return withTransaction(async (tx) => {
    const rows = await tx<{ role: string }[]>`SELECT role FROM users WHERE id = ${userId}`;
    const user = rows[0];
    if (!user) return false;

    if (user.role === "instructor") {
      const courses = await tx<{ id: number }[]>`SELECT id FROM courses WHERE instructor_id = ${userId}`;
      for (const course of courses) {
        await deleteCourseCascade(tx, course.id);
      }
    }

    if (user.role === "student") {
      const enrollments = await tx<{ id: number }[]>`SELECT id FROM enrollments WHERE student_id = ${userId}`;
      for (const en of enrollments) {
        await tx`DELETE FROM lesson_progress WHERE enrollment_id = ${en.id}`;
        await tx`DELETE FROM quiz_attempts WHERE enrollment_id = ${en.id}`;
        await tx`DELETE FROM assignment_submissions WHERE enrollment_id = ${en.id}`;
        await tx`DELETE FROM enrollments WHERE id = ${en.id}`;
      }
      await tx`DELETE FROM wishlists WHERE student_id = ${userId}`;
      await tx`DELETE FROM cart WHERE student_id = ${userId}`;
      await tx`DELETE FROM course_reviews WHERE student_id = ${userId}`;
    }

    await tx`DELETE FROM login_attempts WHERE identifier IN (SELECT email FROM users WHERE id = ${userId})`;
    await tx`DELETE FROM users WHERE id = ${userId}`;
    return true;
  });
}

/** Duplicate-email check for the add-user form. */
export async function emailExists(email: string): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`SELECT id FROM users WHERE email = ${email}`;
  return rows.length > 0;
}

/** addUser() — inserts a verified, active/inactive user with a bcrypt hash. */
export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
}): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified, registration_date)
    VALUES (${params.name}, ${params.email}, ${params.passwordHash}, ${params.role},
            ${params.isActive}, true, now())
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export type BlockedUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  block_note: string | null;
  registration_date: string;
};

/** Port of getBlockedUsers() from private/functions/admin.php. */
export async function getBlockedUsers(): Promise<BlockedUserRow[]> {
  return sql<BlockedUserRow[]>`
    SELECT id, name, email, role, block_note, registration_date
    FROM users
    WHERE is_active = false AND block_reason = 'admin_blocked'
    ORDER BY name
  `;
}

export type InstructorAuditSummary = {
  application: {
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    rejection_reason: string | null;
  } | null;
  total_courses: number;
  total_students: number;
  total_revenue: number;
};

/** Port of getInstructorAuditSummary() from private/functions/admin.php. */
export async function getInstructorAuditSummary(userId: number): Promise<InstructorAuditSummary> {
  const [app] = await sql<{ status: string; submitted_at: string; reviewed_at: string | null; rejection_reason: string | null }[]>`
    SELECT status, submitted_at, reviewed_at, rejection_reason
    FROM instructor_applications WHERE user_id = ${userId} ORDER BY submitted_at DESC LIMIT 1
  `;
  const [stats] = await sql<{ total_courses: number; total_students: number; total_revenue: string | null }[]>`
    SELECT
      COUNT(DISTINCT c.id)         AS total_courses,
      COUNT(DISTINCT e.student_id) AS total_students,
      COALESCE(SUM(c.price), 0)   AS total_revenue
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    WHERE c.instructor_id = ${userId}
  `;
  return {
    application: app ?? null,
    total_courses: stats?.total_courses ?? 0,
    total_students: stats?.total_students ?? 0,
    total_revenue: Number(stats?.total_revenue ?? 0),
  };
}
