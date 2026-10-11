import { sql } from "@/lib/db/client";

export type PlatformStats = {
  total_users: number;
  total_students: number;
  total_instructors: number;
  total_courses: number;
  published_courses: number;
  pending_courses: number;
  total_enrollments: number;
  total_revenue: string;
  monthly_revenue: Array<{ month: string; enrollments: number; revenue: string | null }>;
  recent_signups: Array<{ id: number; name: string; email: string; role: string; registration_date: Date }>;
  recent_enrollments: Array<{ student_name: string | null; course_title: string; price: string }>;
  top_courses: Array<{
    id: number;
    title: string;
    instructor_name: string | null;
    enrollment_count: number;
    revenue: string | null;
    avg_rating: string | null;
  }>;
};

/** Port of getPlatformStats() in private/functions/admin.php (all seven queries). */
export async function getPlatformStats(): Promise<PlatformStats> {
  const users = await sql<{ total: number; students: number; instructors: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END), 0)::int AS students,
      COALESCE(SUM(CASE WHEN role = 'instructor' THEN 1 ELSE 0 END), 0)::int AS instructors
    FROM users`;

  const courses = await sql<{ total: number; published: number; pending: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN is_published = true THEN 1 ELSE 0 END), 0)::int AS published,
      COALESCE(SUM(CASE WHEN is_published = false THEN 1 ELSE 0 END), 0)::int AS pending
    FROM courses`;

  const enrollmentTotals = await sql<{ count: number; revenue: string }[]>`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(c.price), 0) AS revenue
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id`;

  const monthly = await sql<{ month: string; enrollments: number; revenue: string | null }[]>`
    SELECT
      to_char(e.enrolled_at, 'YYYY-MM') AS month,
      COUNT(*)::int AS enrollments,
      SUM(c.price) AS revenue
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.enrolled_at >= now() - interval '12 months'
    GROUP BY to_char(e.enrolled_at, 'YYYY-MM')
    ORDER BY month DESC`;

  const signups = await sql<{ id: number; name: string; email: string; role: string; registration_date: Date }[]>`
    SELECT id, name, email, role, registration_date
    FROM users
    ORDER BY registration_date DESC
    LIMIT 10`;

  const recentEnrollments = await sql<{ student_name: string | null; course_title: string; price: string }[]>`
    SELECT u.name AS student_name, c.title AS course_title, c.price
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    ORDER BY e.enrolled_at DESC
    LIMIT 10`;

  const topCourses = await sql<{
    id: number;
    title: string;
    instructor_name: string | null;
    enrollment_count: number;
    revenue: string | null;
    avg_rating: string | null;
  }[]>`
    SELECT c.id, c.title, u.name AS instructor_name,
      COUNT(e.id)::int AS enrollment_count,
      SUM(c.price) AS revenue,
      AVG(r.rating) AS avg_rating
    FROM courses c
    LEFT JOIN enrollments e ON c.id = e.course_id
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN course_reviews r ON c.id = r.course_id
    GROUP BY c.id, u.name
    ORDER BY enrollment_count DESC
    LIMIT 10`;

  return {
    total_users: users[0]?.total ?? 0,
    total_students: users[0]?.students ?? 0,
    total_instructors: users[0]?.instructors ?? 0,
    total_courses: courses[0]?.total ?? 0,
    published_courses: courses[0]?.published ?? 0,
    pending_courses: courses[0]?.pending ?? 0,
    total_enrollments: enrollmentTotals[0]?.count ?? 0,
    total_revenue: enrollmentTotals[0]?.revenue ?? "0",
    monthly_revenue: monthly,
    recent_signups: signups,
    recent_enrollments: recentEnrollments,
    top_courses: topCourses,
  };
}

/** getPendingApplicationsCount() — the PHP never rendered this, but the dashboard's intent is clear. */
export async function getPendingApplicationsCount(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM instructor_applications WHERE status = 'pending'`;
  return rows[0]?.c ?? 0;
}
