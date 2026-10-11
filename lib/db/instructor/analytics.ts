import { sql } from "@/lib/db/client";
import { getCourseById } from "./courses";

export type OverviewStats = {
  total_courses: number;
  published_courses: number;
  total_students: number;
  total_revenue: number;
  avg_course_rating: number;
  recent_enrollments: Array<{
    student_name: string;
    course_title: string;
    enrolled_at: Date;
    progress_percentage: number;
  }>;
  monthly_revenue: Array<{ month: string; enrollments: number; revenue: number }>;
  top_courses: Array<{
    id: number;
    title: string;
    enrollment_count: number;
    avg_rating: number | null;
    price: number | string;
  }>;
};

const round2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

/**
 * getInstructorOverviewStats($instructorId). Revenue is SUM(courses.price) over the
 * instructor's enrollment rows — the PHP credits the full list price, there is no share.
 */
export async function getInstructorOverviewStats(instructorId: number): Promise<OverviewStats> {
  const [courseRow, studentRow, revenueRow, ratingRow, monthly, topCourses, recentEnrollments] =
    await Promise.all([
      sql<{ total: string; published: string }[]>`
        SELECT COUNT(*)::text AS total,
               SUM(CASE WHEN is_published THEN 1 ELSE 0 END) AS published
        FROM courses WHERE instructor_id = ${instructorId}`,
      sql<{ count: string }[]>`
        SELECT COUNT(DISTINCT e.student_id)::text AS count
        FROM enrollments e JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ${instructorId}`,
      sql<{ total: string | null }[]>`
        SELECT SUM(c.price) AS total
        FROM enrollments e JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ${instructorId}`,
      sql<{ avg: string | null }[]>`
        SELECT AVG(r.rating) AS avg
        FROM course_reviews r JOIN courses c ON r.course_id = c.id
        WHERE c.instructor_id = ${instructorId}`,
      sql<Array<{ month: string; enrollments: string; revenue: string }>>`
        SELECT to_char(e.enrolled_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
               COUNT(*)::text AS enrollments,
               COALESCE(SUM(c.price), 0) AS revenue
        FROM enrollments e JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ${instructorId}
          AND e.enrolled_at >= (now() - interval '6 months')
        GROUP BY 1 ORDER BY 1 ASC`,
      // PHP bug: this joined course_reviews as well and grouped only by c.id, which multiplied
      // the enrollment count by the number of reviews. Counts and averages are correct here.
      sql<OverviewStats["top_courses"]>`
        SELECT c.id, c.title, c.price,
               (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count,
               (SELECT AVG(r.rating) FROM course_reviews r WHERE r.course_id = c.id) AS avg_rating
        FROM courses c
        WHERE c.instructor_id = ${instructorId} AND c.is_published = true
        ORDER BY enrollment_count DESC, c.created_at DESC
        LIMIT 5`,
      sql<OverviewStats["recent_enrollments"]>`
        SELECT u.name AS student_name, c.title AS course_title,
               e.enrolled_at, e.progress_percentage
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN courses c ON e.course_id = c.id
        WHERE c.instructor_id = ${instructorId}
        ORDER BY e.enrolled_at DESC
        LIMIT 10`,
    ]);

  return {
    total_courses: Number(courseRow[0]?.total ?? 0),
    published_courses: Number(courseRow[0]?.published ?? 0),
    total_students: Number(studentRow[0]?.count ?? 0),
    total_revenue: Number(revenueRow[0]?.total ?? 0),
    avg_course_rating: round2(ratingRow[0]?.avg),
    recent_enrollments: recentEnrollments,
    monthly_revenue: monthly.map((m) => ({
      month: m.month,
      enrollments: Number(m.enrollments),
      revenue: Number(m.revenue),
    })),
    top_courses: topCourses.map((c) => ({
      id: Number(c.id),
      title: c.title,
      enrollment_count: Number(c.enrollment_count),
      avg_rating: c.avg_rating === null ? null : Number(c.avg_rating),
      price: c.price,
    })),
  };
}

export type ProgressBucket = { range_label: string; count: number };

export type CourseDetailedAnalytics = {
  enrollment_trend: Array<{ date: string; count: number }>;
  completion_rate: number;
  progress_distribution: ProgressBucket[];
  quiz_performance: Array<{ lesson_title: string; attempt_count: number; avg_score: number | null }>;
};

/**
 * getCourseDetailedAnalytics($courseId, $instructorId) — returns false-equivalent (null) when
 * the course is not owned. quiz_performance averages quiz_attempts.percentage: the PHP
 * averaged `score` (raw points) and then printed a '%', which produced nonsense above 100.
 */
export async function getCourseDetailedAnalytics(
  courseId: number,
  instructorId: number,
): Promise<CourseDetailedAnalytics | null> {
  const owned = await getCourseById(courseId, instructorId);
  if (!owned) return null;

  const [trend, completion, buckets, quiz] = await Promise.all([
    sql<Array<{ date: string; count: string }>>`
      SELECT to_char(e.enrolled_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
             COUNT(*)::text AS count
      FROM enrollments e
      WHERE e.course_id = ${courseId}
        AND e.enrolled_at >= (now() - interval '30 days')
      GROUP BY 1 ORDER BY 1 ASC`,
    sql<{ total: string; done: string }[]>`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::text AS done
      FROM enrollments WHERE course_id = ${courseId}`,
    sql<ProgressBucket[]>`
      SELECT b.range_label, COUNT(*)::text AS count FROM (
        SELECT CASE
          WHEN progress_percentage = 0 THEN 'Not Started'
          WHEN progress_percentage BETWEEN 1 AND 25 THEN '1-25%'
          WHEN progress_percentage BETWEEN 26 AND 50 THEN '26-50%'
          WHEN progress_percentage BETWEEN 51 AND 75 THEN '51-75%'
          WHEN progress_percentage BETWEEN 76 AND 99 THEN '76-99%'
          ELSE 'Completed'
        END AS range_label
        FROM enrollments WHERE course_id = ${courseId}
      ) b GROUP BY b.range_label`,
    sql<Array<{ lesson_title: string; attempt_count: string; avg_score: string | null }>>`
      SELECT l.title AS lesson_title,
             COUNT(qa.id)::text AS attempt_count,
             AVG(qa.percentage) AS avg_score
      FROM lessons l
      LEFT JOIN quiz_attempts qa ON qa.lesson_id = l.id
      WHERE l.course_id = ${courseId} AND l.content_type = 'quiz'
      GROUP BY l.id, l.title, l.sort_order
      ORDER BY l.sort_order ASC, l.id ASC`,
  ]);

  const ORDER = ["Not Started", "1-25%", "26-50%", "51-75%", "76-99%", "Completed"];
  const byLabel = new Map(buckets.map((b) => [b.range_label, Number(b.count)]));
  const total = Number(completion[0]?.total ?? 0);
  const done = Number(completion[0]?.done ?? 0);

  return {
    enrollment_trend: trend.map((t) => ({ date: t.date, count: Number(t.count) })),
    completion_rate: total > 0 ? round2((done / total) * 100) : 0,
    progress_distribution: ORDER.map((label) => ({ range_label: label, count: byLabel.get(label) ?? 0 })),
    quiz_performance: quiz.map((q) => ({
      lesson_title: q.lesson_title,
      attempt_count: Number(q.attempt_count),
      avg_score: q.avg_score === null ? null : Number(q.avg_score),
    })),
  };
}

export type CourseStudentRow = {
  id: number;
  name: string;
  email: string;
  enrolled_at: Date;
  progress_percentage: number;
  completed_at: Date | null;
  total_lessons: number;
};

/** getCourseStudentProgress($courseId, $instructorId, $limit = 50, $offset = 0). */
export async function getCourseStudentProgress(
  courseId: number,
  instructorId: number,
  limit = 50,
  offset = 0,
): Promise<CourseStudentRow[] | null> {
  const owned = await getCourseById(courseId, instructorId);
  if (!owned) return null;
  return sql<CourseStudentRow[]>`
    SELECT u.id, u.name, u.email, e.enrolled_at, e.progress_percentage, e.completed_at,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id)::text AS total_lessons
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    WHERE e.course_id = ${courseId}
    ORDER BY e.enrolled_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/** students.php's header block: distinct students, completions, avg progress, new in 30 days. */
export async function getStudentOverviewStats(instructorId: number): Promise<{
  total_students: number;
  completed_students: number;
  avg_progress: number;
  new_this_month: number;
}> {
  const rows = await sql<{
    total_students: string; completed_students: string; avg_progress: string | null; new_this_month: string;
  }[]>`
    SELECT COUNT(DISTINCT e.student_id)::text AS total_students,
           COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.student_id END)::text AS completed_students,
           ROUND(AVG(e.progress_percentage), 1) AS avg_progress,
           COUNT(DISTINCT CASE WHEN e.enrolled_at >= (now() - interval '30 days') THEN e.student_id END)::text AS new_this_month
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
  `;
  const r = rows[0];
  return {
    total_students: Number(r?.total_students ?? 0),
    completed_students: Number(r?.completed_students ?? 0),
    avg_progress: Number(r?.avg_progress ?? 0),
    new_this_month: Number(r?.new_this_month ?? 0),
  };
}

export type StudentListRow = {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
  courses_enrolled: number;
  avg_progress: number;
  courses_completed: number;
  last_enrollment: Date;
  first_enrollment: Date;
};

export type StudentFilters = {
  search?: string;
  courseId?: number;
  progress?: "not_started" | "in_progress" | "completed";
  sort?: "last_enrollment" | "name" | "progress";
};

/** students.php's main query: one row per student with aggregated per-course rollups. */
export async function getInstructorStudents(
  instructorId: number,
  filters: StudentFilters = {},
): Promise<StudentListRow[]> {
  const search = (filters.search ?? "").trim();
  const pattern = `%${search}%`;
  const order =
    filters.sort === "name"
      ? sql`u.name ASC`
      : filters.sort === "progress"
        ? sql`avg_progress DESC`
        : sql`last_enrollment DESC`;

  return sql<StudentListRow[]>`
    SELECT u.id, u.name, u.email, u.profile_image,
           COUNT(DISTINCT e.course_id)::text AS courses_enrolled,
           ROUND(AVG(e.progress_percentage), 1) AS avg_progress,
           SUM(CASE WHEN e.completed_at IS NOT NULL THEN 1 ELSE 0 END)::text AS courses_completed,
           MAX(e.enrolled_at) AS last_enrollment,
           MIN(e.enrolled_at) AS first_enrollment
    FROM users u
    JOIN enrollments e ON u.id = e.student_id
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
      ${search ? sql`AND (u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})` : sql``}
      ${filters.courseId ? sql`AND c.id = ${filters.courseId}` : sql``}
      ${filters.progress === "not_started" ? sql`AND e.progress_percentage = 0` : sql``}
      ${filters.progress === "in_progress"
        ? sql`AND e.progress_percentage > 0 AND e.completed_at IS NULL`
        : sql``}
      ${filters.progress === "completed" ? sql`AND e.completed_at IS NOT NULL` : sql``}
    GROUP BY u.id, u.name, u.email, u.profile_image
    ORDER BY ${order}
  `;
}

export type StudentCourseDetail = {
  student_id: number;
  course_id: number;
  course_title: string;
  progress_percentage: number;
  enrolled_at: Date;
  completed_at: Date | null;
  rating: number | null;
};

/** students.php's per-student detail rows, grouped by student id for the expandable row. */
export async function getStudentCourseDetails(
  studentIds: number[],
  instructorId: number,
): Promise<Map<number, StudentCourseDetail[]>> {
  const grouped = new Map<number, StudentCourseDetail[]>();
  if (studentIds.length === 0) return grouped;
  const rows = await sql<StudentCourseDetail[]>`
    SELECT e.student_id, c.id AS course_id, c.title AS course_title,
           e.progress_percentage, e.enrolled_at, e.completed_at, r.rating
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN course_reviews r ON r.course_id = c.id AND r.student_id = e.student_id
    WHERE e.student_id IN ${sql(studentIds)}
      AND c.instructor_id = ${instructorId}
    ORDER BY e.enrolled_at DESC
  `;
  for (const row of rows) {
    const list = grouped.get(Number(row.student_id));
    if (list) list.push(row);
    else grouped.set(Number(row.student_id), [row]);
  }
  return grouped;
}