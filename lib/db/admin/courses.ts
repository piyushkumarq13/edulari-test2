import { sql, logDbError } from "@/lib/db/client";
import { ensureUniqueSlug } from "@/lib/db/instructor/courses";

/**
 * Admin course queries. Ports the inline SQL in public/admin/courses.php, create-course.php and
 * edit-course.php plus adminGetCourse()/adminCreateCourse()/adminUpdateCourse()/adminDeleteCourse()
 * /adminToggleCoursePublish() from private/functions/admin.php.
 *
 * Admin queries deliberately have NO ownership filter: an admin may read and mutate any course.
 */

export type AdminCourseFilters = {
  status?: string;
  search?: string;
  instructor?: number;
  category?: number;
  featured?: string;
};

export type AdminCourseRow = {
  id: number;
  instructor_id: number;
  category_id: number | null;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail: string | null;
  level: string;
  language: string;
  duration_hours: number;
  price: string;
  is_published: boolean;
  is_featured: boolean;
  certificate_enabled: boolean;
  passing_percentage: number;
  created_at: Date;
  updated_at: Date;
  instructor_name: string | null;
  instructor_email: string | null;
  category_name: string | null;
  student_count: number;
  avg_rating: string | null;
  review_count: number;
};

export type AdminCourse = {
  id: number;
  instructor_id: number;
  category_id: number | null;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail: string | null;
  level: string;
  language: string;
  duration_hours: number;
  price: string;
  is_published: boolean;
  is_featured: boolean;
  certificate_enabled: boolean;
  passing_percentage: number;
  created_at: Date | null;
  updated_at: Date | null;
  published_at: Date | null;
  instructor_name: string | null;
  category_name: string | null;
};

/** Shared WHERE builder so the listing query and its COUNT stay in lockstep (as in courses.php). */
function buildWhere(f: AdminCourseFilters) {
  const term = `%${f.search ?? ""}%`;
  return sql`
    1 = 1
    ${f.status === "published" ? sql`AND c.is_published = true` : f.status === "pending" ? sql`AND c.is_published = false` : sql``}
    ${f.search ? sql`AND (c.title ILIKE ${term} OR c.description ILIKE ${term} OR u.name ILIKE ${term})` : sql``}
    ${f.instructor ? sql`AND c.instructor_id = ${f.instructor}` : sql``}
    ${f.category ? sql`AND c.category_id = ${f.category}` : sql``}
    ${f.featured === "yes" ? sql`AND c.is_featured = true` : f.featured === "no" ? sql`AND c.is_featured = false` : sql``}
  `;
}

export async function countAdminCourses(f: AdminCourseFilters): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM courses c
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE ${buildWhere(f)}
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function getAdminCourses(
  f: AdminCourseFilters,
  sortBy: string,
  sortDir: "asc" | "desc",
  limit: number,
  offset: number,
): Promise<AdminCourseRow[]> {
  // ORDER BY columns are fixed fragments; only the whitelisted five are reachable.
  const order =
    sortBy === "title"
      ? sql`c.title`
      : sortBy === "student_count"
        ? sql`student_count`
        : sortBy === "price"
          ? sql`c.price`
          : sortBy === "avg_rating"
            ? sql`avg_rating`
            : sql`c.created_at`;
  const dir = sortDir === "asc" ? sql`ASC` : sql`DESC`;
  return sql<AdminCourseRow[]>`
    SELECT c.*,
      u.name  AS instructor_name,
      u.email AS instructor_email,
      cat.name AS category_name,
      (SELECT COUNT(*)::int FROM enrollments    WHERE course_id = c.id) AS student_count,
      (SELECT AVG(rating)        FROM course_reviews WHERE course_id = c.id) AS avg_rating,
      (SELECT COUNT(*)::int FROM course_reviews WHERE course_id = c.id) AS review_count
    FROM courses c
    LEFT JOIN users      u   ON c.instructor_id = u.id
    LEFT JOIN categories cat ON c.category_id   = cat.id
    WHERE ${buildWhere(f)}
    ORDER BY ${order} ${dir}
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export type AdminCourseStats = {
  total: number;
  published: number;
  featured: number;
  total_students: number;
};

/** The four summary cards (courses.php $statTotal/$statPubl/$statFeat/$statStudents). */
export async function getAdminCourseStats(): Promise<AdminCourseStats> {
  const rows = await sql<AdminCourseStats[]>`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN c.is_published THEN 1 ELSE 0 END), 0)::int AS published,
      COALESCE(SUM(CASE WHEN c.is_featured  THEN 1 ELSE 0 END), 0)::int AS featured,
      COALESCE(SUM((SELECT COUNT(*) FROM enrollments WHERE course_id = c.id)), 0)::int AS total_students
    FROM courses c
  `;
  return rows[0] ?? { total: 0, published: 0, featured: 0, total_students: 0 };
}

export async function getAdminInstructorList(): Promise<Array<{ id: number; name: string }>> {
  return sql<Array<{ id: number; name: string }>>`
    SELECT id, name FROM users WHERE role = 'instructor' ORDER BY name
  `;
}

export async function getAdminInstructorOptions(): Promise<Array<{ id: number; name: string; email: string | null }>> {
  return sql<Array<{ id: number; name: string; email: string | null }>>`
    SELECT id, name, email FROM users WHERE role = 'instructor' ORDER BY name
  `;
}

/** adminGetCourse($courseId) — a single course with instructor + category names, no ownership check. */
export async function adminGetCourse(courseId: number): Promise<AdminCourse | null> {
  const rows = await sql<AdminCourse[]>`
    SELECT c.*, u.name AS instructor_name, cat.name AS category_name
    FROM courses c
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ${courseId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export type AdminCreateCourseInput = {
  instructor_id: number;
  category_id: number | null;
  title: string;
  description: string;
  short_description: string;
  level: string;
  language: string;
  duration_hours: number;
  price: number;
  certificate_enabled: boolean;
  passing_percentage: number;
};

/**
 * adminCreateCourse($data): slug from the title (append time on collision), always saved as a
 * draft (is_published = 0), certificate defaults on and passing 70 — exactly the PHP defaults.
 */
export async function adminCreateCourse(data: AdminCreateCourseInput): Promise<number | null> {
  try {
    const slug = await ensureUniqueSlug(data.title);
    const rows = await sql<{ id: number }[]>`
      INSERT INTO courses (
        instructor_id, category_id, title, slug, description, short_description,
        level, language, duration_hours, price, certificate_enabled, passing_percentage,
        is_published, created_at, updated_at
      ) VALUES (
        ${data.instructor_id}, ${data.category_id}, ${data.title}, ${slug},
        ${data.description}, ${data.short_description},
        ${data.level}, ${data.language}, ${data.duration_hours}, ${data.price},
        ${data.certificate_enabled}, ${data.passing_percentage},
        false, now(), now()
      )
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    logDbError("adminCreateCourse", err);
    return null;
  }
}

/** The adminUpdateCourse() whitelist; unlike the instructor version it includes ownership + flags. */
const ADMIN_UPDATABLE_FIELDS = [
  "title",
  "description",
  "short_description",
  "category_id",
  "level",
  "language",
  "duration_hours",
  "price",
  "certificate_enabled",
  "passing_percentage",
  "thumbnail",
  "instructor_id",
  "is_published",
  "is_featured",
] as const;

export type AdminCoursePatch = Partial<Record<(typeof ADMIN_UPDATABLE_FIELDS)[number], unknown>>;

/**
 * adminUpdateCourse($courseId, $data). Returns true when the write executes.
 *
 * NOTE (deviation, see docs/PROGRESS.md): the PHP returned dw_execute()'s MySQL row count, which
 * is 0 for a no-op UPDATE, making an unchanged edit appear to fail. Postgres reports a row for
 * every UPDATE and the intended behaviour is success, so this returns true whenever the course
 * exists and the statement runs, and false only on a database error.
 */
export async function adminUpdateCourse(courseId: number, data: AdminCoursePatch): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const field of ADMIN_UPDATABLE_FIELDS) {
    if (field in data) patch[field] = data[field];
  }
  // A submitted title regenerates the slug (kept unique against every other course):
  if (typeof data.title === "string") {
    patch.slug = await ensureUniqueSlug(data.title, courseId);
  }
  if (Object.keys(patch).length === 0) return false;
  try {
    await sql`UPDATE courses SET ${sql(patch)}, updated_at = now() WHERE id = ${courseId}`;
    return true;
  } catch (err) {
    logDbError("adminUpdateCourse", err);
    return false;
  }
}

/** adminToggleCoursePublish($courseId, $publish) — sets only is_published, as the PHP did. */
export async function adminToggleCoursePublish(courseId: number, publish: boolean): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE courses SET is_published = ${publish} WHERE id = ${courseId} RETURNING id
  `;
  return rows.length > 0;
}

/** courses.php's feature/unfeature — sets only is_featured. */
export async function adminSetFeatured(courseId: number, featured: boolean): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE courses SET is_featured = ${featured} WHERE id = ${courseId} RETURNING id
  `;
  return rows.length > 0;
}

/**
 * adminDeleteCourse($courseId): the PHP's 15-step cascade, in one transaction. Quiz answers and
 * options are removed through their parent attempts/questions so no orphans survive.
 */
export async function adminDeleteCourse(courseId: number): Promise<boolean> {
  if (!Number.isFinite(courseId) || courseId <= 0) return false;
  try {
    return await sql.begin(async (tx) => {
      const t = tx as unknown as typeof sql;
      await t`
        DELETE FROM quiz_answers qa
        USING quiz_attempts qat
        WHERE qa.attempt_id = qat.id
          AND qat.lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM quiz_attempts WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`
        DELETE FROM quiz_options qo
        USING quiz_questions qq
        WHERE qo.question_id = qq.id
          AND qq.lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM assignment_submissions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM assignments WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM lessons WHERE course_id = ${courseId}`;
      await t`DELETE FROM course_sections WHERE course_id = ${courseId}`;
      await t`DELETE FROM enrollments WHERE course_id = ${courseId}`;
      await t`DELETE FROM course_reviews WHERE course_id = ${courseId}`;
      await t`DELETE FROM courses WHERE id = ${courseId}`;
      return true;
    });
  } catch (err) {
    logDbError("adminDeleteCourse", err);
    return false;
  }
}

export type AdminCourseOverview = {
  enrollmentCount: number;
  reviewCount: number;
  avgRating: number | null;
  sectionCount: number;
  lessonCount: number;
};

/** edit-course.php's sidebar counters (enrollments, reviews/rating, sections, lessons). */
export async function getAdminCourseOverview(courseId: number): Promise<AdminCourseOverview> {
  const enroll = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM enrollments WHERE course_id = ${courseId}`;
  const review = await sql<{ cnt: string; avg: string | null }[]>`
    SELECT COUNT(*)::text AS cnt, AVG(rating) AS avg FROM course_reviews WHERE course_id = ${courseId}`;
  const section = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM course_sections WHERE course_id = ${courseId}`;
  const lesson = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM lessons l
    JOIN course_sections s ON l.section_id = s.id
    WHERE s.course_id = ${courseId}`;
  const avg = review[0]?.avg;
  return {
    enrollmentCount: Number(enroll[0]?.cnt ?? 0),
    reviewCount: Number(review[0]?.cnt ?? 0),
    avgRating: avg === null || avg === undefined ? null : Math.round(Number(avg) * 10) / 10,
    sectionCount: Number(section[0]?.cnt ?? 0),
    lessonCount: Number(lesson[0]?.cnt ?? 0),
  };
}

/** Slug lookup for a set of ids, used to purge the public pages a bulk action touches. */
export async function getAdminCourseSlugs(ids: number[]): Promise<Array<{ id: number; slug: string }>> {
  const clean = ids.filter((id) => Number.isFinite(id) && id > 0);
  if (clean.length === 0) return [];
  return sql<Array<{ id: number; slug: string }>>`
    SELECT id, slug FROM courses WHERE id IN ${sql(clean)}
  `;
}
