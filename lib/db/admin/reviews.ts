import { sql } from "@/lib/db/client";

/**
 * Port of the reviews queries and delete helper used by public/admin/reviews.php and
 * private/functions/admin.php (getAllReviews, deleteReview).
 */

export const REVIEWS_PER_PAGE = 20;

export type ReviewRow = {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: Date;
  student_name: string;
  student_email: string;
  course_title: string;
  course_id: number;
  instructor_name: string;
};

export type ReviewStats = {
  totalAllReviews: number;
  /** Postgres numeric comes back as text; the PHP echoed it verbatim ("4.3") or 0 when empty. */
  avgRating: string;
  ratingMap: Record<number, number>;
};

export type CourseReviewOption = { id: number; title: string };

export async function getReviews(params: {
  search: string;
  rating: number;
  courseId: number;
  page: number;
}): Promise<{ rows: ReviewRow[]; total: number; totalPages: number; page: number }> {
  const { search, rating, courseId } = params;

  const like = `%${search}%`;
  let where = sql`WHERE 1 = 1`;
  if (search !== "") {
    where = sql`${where} AND (u.name ILIKE ${like} OR c.title ILIKE ${like} OR r.review_text ILIKE ${like})`;
  }
  if (courseId > 0) {
    where = sql`${where} AND r.course_id = ${courseId}`;
  }
  if (rating >= 1 && rating <= 5) {
    where = sql`${where} AND r.rating = ${rating}`;
  }

  const totalRows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM course_reviews r
    JOIN users u   ON r.student_id    = u.id
    JOIN courses c ON r.course_id     = c.id
    JOIN users i   ON c.instructor_id = i.id
    ${where}
  `;
  const total = totalRows[0]?.count ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const offset = (page - 1) * REVIEWS_PER_PAGE;

  const rows = await sql<ReviewRow[]>`
    SELECT r.id, r.rating, r.review_text, r.created_at,
           u.name  AS student_name,  u.email AS student_email,
           c.title AS course_title,  c.id    AS course_id,
           i.name  AS instructor_name
    FROM course_reviews r
    JOIN users u   ON r.student_id    = u.id
    JOIN courses c ON r.course_id     = c.id
    JOIN users i   ON c.instructor_id = i.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ${REVIEWS_PER_PAGE} OFFSET ${offset}
  `;

  return { rows, total, totalPages, page };
}

/** Rating summary cards are computed over the whole table (never filtered). */
export async function getReviewStats(): Promise<ReviewStats> {
  const [stats, totalRows] = await Promise.all([
    sql<{ rating: number; cnt: number }[]>`
      SELECT rating, COUNT(*)::int AS cnt FROM course_reviews GROUP BY rating ORDER BY rating DESC
    `,
    sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM course_reviews`,
  ]);

  const totalAllReviews = totalRows[0]?.c ?? 0;

  const ratingMap: Record<number, number> = {};
  for (const row of stats) {
    ratingMap[Number(row.rating)] = row.cnt;
  }

  let avgRating = "0";
  if (totalAllReviews > 0) {
    const avgRows = await sql<{ avg: string | null }[]>`
      SELECT ROUND(AVG(rating)::numeric, 1) AS avg FROM course_reviews
    `;
    avgRating = avgRows[0]?.avg ?? "0";
  }

  return { totalAllReviews, avgRating, ratingMap };
}

export async function getCourseOptionsForReviews(): Promise<CourseReviewOption[]> {
  return sql<CourseReviewOption[]>`SELECT id, title FROM courses ORDER BY title`;
}

/** deleteReview(): returns true when a row was removed (a missing id is a failure, as in PHP). */
export async function deleteReview(reviewId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    DELETE FROM course_reviews WHERE id = ${reviewId} RETURNING id
  `;
  return rows.length > 0;
}

/** The deleted review's course slug, so the public course page can be revalidated. */
export async function getReviewCourseSlug(reviewId: number): Promise<string | null> {
  const rows = await sql<{ slug: string }[]>`
    SELECT c.slug
    FROM course_reviews r
    JOIN courses c ON r.course_id = c.id
    WHERE r.id = ${reviewId}
    LIMIT 1
  `;
  return rows[0]?.slug ?? null;
}
