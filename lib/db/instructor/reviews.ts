import { sql } from "@/lib/db/client";

export type RatingBreakdown = {
  total_course_reviews: number;
  avg_course_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
};

export type PersonalRatingBreakdown = {
  total_personal_reviews: number;
  avg_personal_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
};

/** reviews.php query B.1: course_reviews joined through the instructor's courses. */
export async function getCourseReviewOverview(instructorId: number): Promise<RatingBreakdown> {
  const rows = await sql<Array<Record<string, string | null>>>`
    SELECT COUNT(cr.id)::text AS total_course_reviews,
           ROUND(AVG(cr.rating), 1) AS avg_course_rating,
           SUM(CASE WHEN cr.rating = 5 THEN 1 ELSE 0 END)::text AS five_star,
           SUM(CASE WHEN cr.rating = 4 THEN 1 ELSE 0 END)::text AS four_star,
           SUM(CASE WHEN cr.rating = 3 THEN 1 ELSE 0 END)::text AS three_star,
           SUM(CASE WHEN cr.rating = 2 THEN 1 ELSE 0 END)::text AS two_star,
           SUM(CASE WHEN cr.rating = 1 THEN 1 ELSE 0 END)::text AS one_star
    FROM course_reviews cr
    JOIN courses c ON cr.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
  `;
  const r = rows[0];
  return {
    total_course_reviews: Number(r?.total_course_reviews ?? 0),
    avg_course_rating: Number(r?.avg_course_rating ?? 0),
    five_star: Number(r?.five_star ?? 0),
    four_star: Number(r?.four_star ?? 0),
    three_star: Number(r?.three_star ?? 0),
    two_star: Number(r?.two_star ?? 0),
    one_star: Number(r?.one_star ?? 0),
  };
}

/** reviews.php query B.2: instructor_ratings for the instructor directly. */
export async function getPersonalRatingOverview(instructorId: number): Promise<PersonalRatingBreakdown> {
  const rows = await sql<Array<Record<string, string | null>>>`
    SELECT COUNT(id)::text AS total_personal_reviews,
           ROUND(AVG(rating), 1) AS avg_personal_rating,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)::text AS five_star,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)::text AS four_star,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)::text AS three_star,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)::text AS two_star,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)::text AS one_star
    FROM instructor_ratings
    WHERE instructor_id = ${instructorId}
  `;
  const r = rows[0];
  return {
    total_personal_reviews: Number(r?.total_personal_reviews ?? 0),
    avg_personal_rating: Number(r?.avg_personal_rating ?? 0),
    five_star: Number(r?.five_star ?? 0),
    four_star: Number(r?.four_star ?? 0),
    three_star: Number(r?.three_star ?? 0),
    two_star: Number(r?.two_star ?? 0),
    one_star: Number(r?.one_star ?? 0),
  };
}

export type ReviewListRow = {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: Date;
  student_id: number;
  student_name: string;
  student_email: string;
  student_avatar: string | null;
  course_id: number | null;
  course_title: string | null;
  course_slug: string | null;
};

export type ReviewFilters = {
  courseId?: number;
  rating?: number;
  search?: string;
  sort?: "newest" | "oldest" | "highest" | "lowest";
};

const reviewOrder = (sort: ReviewFilters["sort"]) => {
  switch (sort) {
    case "oldest":
      return sql`cr.created_at ASC`;
    case "highest":
      return sql`cr.rating DESC, cr.created_at DESC`;
    case "lowest":
      return sql`cr.rating ASC, cr.created_at DESC`;
    default:
      return sql`cr.created_at DESC`;
  }
};

/** reviews.php query B.4: the course-review list with its filters. */
export async function getCourseReviews(instructorId: number, filters: ReviewFilters = {}): Promise<ReviewListRow[]> {
  const search = (filters.search ?? "").trim();
  const pattern = `%${search}%`;
  return sql<ReviewListRow[]>`
    SELECT cr.id, cr.rating, cr.review_text, cr.created_at,
           u.id AS student_id, u.name AS student_name, u.email AS student_email,
           u.profile_image AS student_avatar,
           c.id AS course_id, c.title AS course_title, c.slug AS course_slug
    FROM course_reviews cr
    JOIN users u ON cr.student_id = u.id
    JOIN courses c ON cr.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
      ${filters.courseId ? sql`AND cr.course_id = ${filters.courseId}` : sql``}
      ${filters.rating ? sql`AND cr.rating = ${filters.rating}` : sql``}
      ${search
        ? sql`AND (u.name ILIKE ${pattern} OR cr.review_text ILIKE ${pattern} OR c.title ILIKE ${pattern})`
        : sql``}
    ORDER BY ${reviewOrder(filters.sort)}
  `;
}

/** reviews.php query B.5: the personal-rating list. It has no course filter in the PHP. */
export async function getPersonalRatings(
  instructorId: number,
  filters: Omit<ReviewFilters, "courseId"> = {},
): Promise<ReviewListRow[]> {
  const search = (filters.search ?? "").trim();
  const pattern = `%${search}%`;
  const alias = filters.sort === "oldest" ? sql`ir.created_at ASC`
    : filters.sort === "highest" ? sql`ir.rating DESC, ir.created_at DESC`
    : filters.sort === "lowest" ? sql`ir.rating ASC, ir.created_at DESC`
    : sql`ir.created_at DESC`;
  const rows = await sql<ReviewListRow[]>`
    SELECT ir.id, ir.rating, ir.note AS review_text, ir.created_at,
           u.id AS student_id, u.name AS student_name, u.email AS student_email,
           u.profile_image AS student_avatar,
           NULL::bigint AS course_id, NULL::text AS course_title, NULL::text AS course_slug
    FROM instructor_ratings ir
    JOIN users u ON ir.student_id = u.id
    WHERE ir.instructor_id = ${instructorId}
      ${filters.rating ? sql`AND ir.rating = ${filters.rating}` : sql``}
      ${search ? sql`AND (u.name ILIKE ${pattern} OR ir.note ILIKE ${pattern})` : sql``}
    ORDER BY ${alias}
  `;
  return rows;
}

export type RecentActivity = {
  type: "course" | "personal";
  rating: number;
  created_at: Date;
  student_name: string;
  context: string;
};

/** reviews.php query B.6: the last five ratings across both kinds. Always unfiltered. */
export async function getRecentReviewActivity(instructorId: number): Promise<RecentActivity[]> {
  return sql<RecentActivity[]>`
    SELECT 'course' AS type, cr.rating, cr.created_at, u.name AS student_name, c.title AS context
    FROM course_reviews cr
    JOIN users u ON cr.student_id = u.id
    JOIN courses c ON cr.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
    UNION ALL
    SELECT 'personal' AS type, ir.rating, ir.created_at, u.name AS student_name, 'Instructor Rating' AS context
    FROM instructor_ratings ir
    JOIN users u ON ir.student_id = u.id
    WHERE ir.instructor_id = ${instructorId}
    ORDER BY created_at DESC
    LIMIT 5
  `;
}