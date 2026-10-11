import { sql } from "@/lib/db/client";
import { logDbError } from "@/lib/db/client";

/**
 * createSlug() from private/functions/courses.php (and the duplicate in admin.php):
 * lowercase, replace every run of characters outside [a-z0-9-] with a single dash,
 * collapse repeated dashes, trim leading/trailing dashes.
 */
export function createSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * createCourse()/updateCourse() in the PHP call createSlug($title) and, when the slug is
 * already taken, append '-' . time(). The same helper backs both create and the admin edit.
 * `excludeCourseId` lets an instructor keep its own slug when re-saving an unchanged title.
 */
export async function ensureUniqueSlug(
  base: string,
  excludeCourseId?: number,
): Promise<string> {
  const clean = createSlug(base);
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM courses WHERE slug = ${clean}
    ${excludeCourseId ? sql`AND id <> ${excludeCourseId}` : sql``}
    LIMIT 1
  `;
  if (rows.length === 0) return clean;
  // The PHP appends the raw unix timestamp; a collision is only reachable inside the same
  // second, which is the same limit the PHP had.
  return `${clean}-${Math.floor(Date.now() / 1000)}`;
}

export type CategoryRow = { id: number; name: string; slug: string; description: string | null };

/** getCategories() — all categories; callers order as the PHP did. */
export async function getCategories(): Promise<CategoryRow[]> {
  return sql<CategoryRow[]>`
    SELECT id, name, slug, description FROM categories ORDER BY name ASC
  `;
}

export type CourseRow = {
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
  price: number | string;
  is_published: boolean;
  is_featured: boolean;
  certificate_enabled: boolean;
  passing_percentage: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  category_name?: string | null;
};

/**
 * getCourseById($courseId, $instructorId = null). Passing the instructor id adds the
 * ownership filter, which is how every instructor page authorises a course id.
 */
export async function getCourseById(
  courseId: number,
  instructorId?: number,
): Promise<CourseRow | null> {
  if (instructorId === undefined) {
    const rows = await sql<CourseRow[]>`
      SELECT c.*, cat.name AS category_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ${courseId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
  const rows = await sql<CourseRow[]>`
    SELECT c.*, cat.name AS category_name
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ${courseId} AND c.instructor_id = ${instructorId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export interface CourseInput {
  instructor_id?: number;
  category_id?: number | null;
  title: string;
  description?: string | null;
  short_description?: string | null;
  level?: string;
  language?: string;
  duration_hours?: number;
  price?: number;
  certificate_enabled?: boolean;
  passing_percentage?: number;
}

/** createCourse($data): slug from title, unpublished, certificate on and passing 70 by default. */
export async function createCourse(data: CourseInput): Promise<number | null> {
  try {
    const slug = await ensureUniqueSlug(data.title);
    const rows = await sql<{ id: number }[]>`
      INSERT INTO courses (
        instructor_id, category_id, title, slug, description, short_description,
        level, language, duration_hours, price, is_published,
        certificate_enabled, passing_percentage, created_at, updated_at
      ) VALUES (
        ${data.instructor_id ?? 0}, ${data.category_id ?? null}, ${data.title}, ${slug},
        ${data.description ?? ""}, ${data.short_description ?? ""},
        ${data.level ?? "beginner"}, ${data.language ?? "English"},
        ${Math.trunc(data.duration_hours ?? 0)}, ${data.price ?? 0}, false,
        ${data.certificate_enabled ?? true}, ${data.passing_percentage ?? 70},
        now(), now()
      )
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    logDbError("createCourse", err);
    return null;
  }
}

/** The field whitelist of updateCourse(); is_featured is deliberately absent (admin-only). */
const UPDATABLE_COURSE_FIELDS = [
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
] as const;

export type CoursePatch = Partial<Record<(typeof UPDATABLE_COURSE_FIELDS)[number], unknown>>;

/**
 * updateCourse($courseId, $data, $instructorId, &$rowsAffected). Returns false only when the
 * course is not owned by the instructor; the PHP returns true even when nothing changed, which
 * is what lets the edit page answer "No changes to save." using $rowsAffected.
 */
export async function updateCourse(
  courseId: number,
  data: CoursePatch,
  instructorId: number,
): Promise<{ ok: boolean; rowsAffected: number }> {
  const owned = await getCourseById(courseId, instructorId);
  if (!owned) return { ok: false, rowsAffected: 0 };

  const patch: Record<string, unknown> = {};
  for (const field of UPDATABLE_COURSE_FIELDS) {
    if (field in data) patch[field] = data[field];
  }
  // A new title regenerates the slug, exactly like adminUpdateCourse()/updateCourse() do.
  if (typeof data.title === "string") {
    patch.slug = await ensureUniqueSlug(data.title, courseId);
  }
if (Object.keys(patch).length === 0) return { ok: true, rowsAffected: 0 };

    // Postgres reports a row for every UPDATE, even when every value is identical, so an
    // unchanged form would look like a real edit. Compare against the stored row first so the
    // "No changes to save." branch still behaves as it did under MySQL. Values are compared as
    // text because a form always posts strings while the column may be a boolean or numeric.
    const current = owned as unknown as Record<string, unknown>;
    const normalise = (v: unknown): string | null =>
      v === null || v === undefined ? null : typeof v === "boolean" ? (v ? "1" : "0") : String(v);
    let changed = false;
    for (const [field, value] of Object.entries(patch)) {
      if (normalise(current[field]) !== normalise(value)) {
        changed = true;
        break;
      }
    }
    if (!changed) return { ok: true, rowsAffected: 0 };

    try {
    // sql(object) binds each column by name, so no placeholder is hand-written.
    const rows = await sql<{ count: string }[]>`
      UPDATE courses SET ${sql(patch)}, updated_at = now()
      WHERE id = ${courseId} AND instructor_id = ${instructorId}
      RETURNING 1 AS count
    `;
    return { ok: true, rowsAffected: rows.length };
  } catch (err) {
    logDbError("updateCourse", err);
    return { ok: false, rowsAffected: 0 };
  }
}

/**
 * toggleCoursePublish($courseId, $instructorId, $publish): sets is_published and stamps
 * published_at on publish, clearing it on unpublish.
 */
export async function toggleCoursePublish(
  courseId: number,
  instructorId: number,
  publish: boolean,
): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE courses
    SET is_published = ${publish},
        published_at = ${publish ? sql`now()` : sql`NULL`},
        updated_at = now()
    WHERE id = ${courseId} AND instructor_id = ${instructorId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * deleteCourse($courseId, $instructorId): the PHP cascade in one transaction. Quiz answers
 * and options are removed through their parent attempts/questions so no orphans survive.
 */
export async function deleteCourse(courseId: number, instructorId: number): Promise<boolean> {
  const owned = await getCourseById(courseId, instructorId);
  if (!owned) return false;
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
      await t`
        DELETE FROM assignment_submissions
        WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`
        DELETE FROM assignments
        WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`
        DELETE FROM lesson_progress
        WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ${courseId})`;
      await t`DELETE FROM lessons WHERE course_id = ${courseId}`;
      await t`DELETE FROM course_sections WHERE course_id = ${courseId}`;
      await t`DELETE FROM enrollments WHERE course_id = ${courseId}`;
      await t`DELETE FROM course_reviews WHERE course_id = ${courseId}`;
      const deleted = await t`
        DELETE FROM courses WHERE id = ${courseId} AND instructor_id = ${instructorId}
        RETURNING id
      `;
      if (deleted.length === 0) throw new Error("deleteCourse: course not deleted");
      return true;
    });
  } catch (err) {
    logDbError("deleteCourse", err);
    return false;
  }
}

export type InstructorCourseRow = {
  id: number;
  title: string;
  description: string | null;
  short_description: string | null;
  thumbnail: string | null;
  level: string;
  price: number | string;
  is_published: boolean;
  category_name: string | null;
  student_count: number;
  avg_rating: number | null;
};

/** getInstructorCourses($instructorId, $filters) — filters are status and search. */
export async function getInstructorCourses(
  instructorId: number,
  filters: { status?: string; search?: string } = {},
): Promise<InstructorCourseRow[]> {
  const search = (filters.search ?? "").trim();
  const pattern = `%${search}%`;
  return sql<InstructorCourseRow[]>`
    SELECT c.id, c.title, c.description, c.short_description, c.thumbnail, c.level,
           c.price, c.is_published,
           cat.name AS category_name,
           (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count,
           (SELECT AVG(r.rating) FROM course_reviews r WHERE r.course_id = c.id) AS avg_rating
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.instructor_id = ${instructorId}
      ${filters.status === "published" ? sql`AND c.is_published = true` : sql``}
      ${filters.status === "draft" ? sql`AND c.is_published = false` : sql``}
      ${search ? sql`AND (c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})` : sql``}
    ORDER BY c.created_at DESC
  `;
}

export type CourseStats = {
  total_students: number;
  completed_students: number;
  avg_progress: number;
  avg_rating: number;
  total_reviews: number;
  total_revenue: number;
};

/** getCourseStats($courseId, $instructorId) — ownership checked first. */
export async function getCourseStats(
  courseId: number,
  instructorId: number,
): Promise<CourseStats | null> {
  const owned = await getCourseById(courseId, instructorId);
  if (!owned) return null;
  const [students, completed, progress, rating, revenue] = await Promise.all([
    sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM enrollments WHERE course_id = ${courseId}`,
    sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM enrollments WHERE course_id = ${courseId} AND completed_at IS NOT NULL`,
    sql<{ avg: string | null }[]>`SELECT AVG(progress_percentage) AS avg FROM enrollments WHERE course_id = ${courseId}`,
    sql<{ avg: string | null; count: string }[]>`SELECT AVG(rating) AS avg, COUNT(*)::text AS count FROM course_reviews WHERE course_id = ${courseId}`,
    sql<{ total: string | null }[]>`
      SELECT SUM(c.price) AS total
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE e.course_id = ${courseId}`,
  ]);
  const round2 = (v: string | null | undefined) => Math.round(Number(v ?? 0) * 100) / 100;
  return {
    total_students: Number(students[0]?.count ?? 0),
    completed_students: Number(completed[0]?.count ?? 0),
    avg_progress: round2(progress[0]?.avg),
    avg_rating: round2(rating[0]?.avg),
    total_reviews: Number(rating[0]?.count ?? 0),
    total_revenue: Number(revenue[0]?.total ?? 0),
  };
}

/** Used by edit-course.php's inline quick-stats block. */
export async function getCourseQuickStats(courseId: number): Promise<{
  total_students: number;
  avg_rating: number;
  total_reviews: number;
}> {
  const rows = await sql<{ total_students: string; avg_rating: string | null; total_reviews: string }[]>`
    SELECT (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id)::text AS total_students,
           COALESCE((SELECT AVG(r.rating) FROM course_reviews r WHERE r.course_id = c.id), 0) AS avg_rating,
           (SELECT COUNT(*) FROM course_reviews r WHERE r.course_id = c.id)::text AS total_reviews
    FROM courses c WHERE c.id = ${courseId}
  `;
  return {
    total_students: Number(rows[0]?.total_students ?? 0),
    avg_rating: Number(rows[0]?.avg_rating ?? 0),
    total_reviews: Number(rows[0]?.total_reviews ?? 0),
  };
}

/** Courses offered in the students/reviews filter dropdowns: published only, as in the PHP. */
export async function getPublishedCourseOptions(instructorId: number): Promise<Array<{ id: number; title: string }>> {
  return sql<Array<{ id: number; title: string }>>`
    SELECT id, title FROM courses
    WHERE instructor_id = ${instructorId} AND is_published = true
    ORDER BY title ASC
  `;
}