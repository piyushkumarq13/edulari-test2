import { sql } from "./client";

export type HomeCourse = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  level: string;
  price: number;
  category_name: string | null;
  category_slug: string | null;
  instructor_name: string | null;
  student_count: number;
  avg_rating: number | null;
  review_count: number;
  lesson_count: number;
};

export type PopularCategory = { id: number; name: string; slug: string; course_count: number };

export type PlatformStats = {
  total_students: number;
  total_instructors: number;
  total_courses: number;
  total_reviews: number;
};

export type Testimonial = {
  rating: number;
  review_text: string | null;
  student_name: string;
  course_title: string;
  course_slug: string;
  created_at: Date;
};

const COURSE_SELECT = `
  c.id, c.title, c.slug, c.thumbnail, c.level, c.price,
  cat.name as category_name, cat.slug as category_slug,
  u.name as instructor_name,
  COUNT(DISTINCT e.id)::int   as student_count,
  AVG(cr.rating)               as avg_rating,
  COUNT(DISTINCT cr.id)::int  as review_count,
  COUNT(DISTINCT l.id)::int   as lesson_count
`;

export async function getFeaturedCourses(limit = 6): Promise<HomeCourse[]> {
  return sql<HomeCourse[]>`
    SELECT ${sql.unsafe(COURSE_SELECT)}
    FROM courses c
    LEFT JOIN categories cat     ON c.category_id  = cat.id
    LEFT JOIN users u            ON c.instructor_id = u.id
    LEFT JOIN enrollments e      ON e.course_id     = c.id
    LEFT JOIN course_reviews cr  ON cr.course_id    = c.id
    LEFT JOIN lessons l          ON l.course_id     = c.id
    WHERE c.is_published = true AND c.is_featured = true
    GROUP BY c.id, cat.name, cat.slug, u.name
    ORDER BY c.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getLatestCourses(limit = 8): Promise<HomeCourse[]> {
  return sql<HomeCourse[]>`
    SELECT ${sql.unsafe(COURSE_SELECT)}
    FROM courses c
    LEFT JOIN categories cat     ON c.category_id  = cat.id
    LEFT JOIN users u            ON c.instructor_id = u.id
    LEFT JOIN enrollments e      ON e.course_id     = c.id
    LEFT JOIN course_reviews cr  ON cr.course_id    = c.id
    LEFT JOIN lessons l          ON l.course_id     = c.id
    WHERE c.is_published = true
    GROUP BY c.id, cat.name, cat.slug, u.name
    ORDER BY c.published_at DESC
    LIMIT ${limit}
  `;
}

export async function getPopularCategories(limit = 8): Promise<PopularCategory[]> {
  return sql<PopularCategory[]>`
    SELECT cat.id, cat.name, cat.slug, COUNT(c.id)::int AS course_count
    FROM categories cat
    INNER JOIN courses c ON c.category_id = cat.id AND c.is_published = true
    GROUP BY cat.id, cat.name, cat.slug
    ORDER BY course_count DESC
    LIMIT ${limit}
  `;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [roleRow, countRow] = await Promise.all([
    sql<{ total_students: number; total_instructors: number }[]>`
      SELECT COUNT(*) FILTER (WHERE role = 'student')::int    AS total_students,
             COUNT(*) FILTER (WHERE role = 'instructor')::int AS total_instructors
      FROM users
    `,
    sql<{ total_courses: number; total_reviews: number }[]>`
      SELECT (SELECT COUNT(*)::int FROM courses WHERE is_published = true) AS total_courses,
             (SELECT COUNT(*)::int FROM course_reviews)                   AS total_reviews
    `,
  ]);
  return {
    total_students: roleRow[0]?.total_students ?? 0,
    total_instructors: roleRow[0]?.total_instructors ?? 0,
    total_courses: countRow[0]?.total_courses ?? 0,
    total_reviews: countRow[0]?.total_reviews ?? 0,
  };
}

export async function getTopRatedCourses(limit = 4): Promise<HomeCourse[]> {
  return sql<HomeCourse[]>`
    SELECT ${sql.unsafe(COURSE_SELECT)}
    FROM courses c
    LEFT JOIN categories cat     ON c.category_id  = cat.id
    LEFT JOIN users u            ON c.instructor_id = u.id
    LEFT JOIN enrollments e      ON e.course_id     = c.id
    LEFT JOIN course_reviews cr  ON cr.course_id    = c.id
    LEFT JOIN lessons l          ON l.course_id     = c.id
    WHERE c.is_published = true
    GROUP BY c.id, cat.name, cat.slug, u.name
    HAVING AVG(cr.rating) >= 4.0
    ORDER BY avg_rating DESC, review_count DESC
    LIMIT ${limit}
  `;
}

export async function getRecentTestimonials(limit = 6): Promise<Testimonial[]> {
  return sql<Testimonial[]>`
    SELECT cr.rating, cr.review_text, cr.created_at,
           u.name as student_name, c.title as course_title, c.slug as course_slug
    FROM course_reviews cr
    JOIN users u   ON cr.student_id = u.id
    JOIN courses c ON cr.course_id  = c.id
    WHERE cr.rating >= 4
    ORDER BY cr.created_at DESC
    LIMIT ${limit}
  `;
}

export async function getWishlistIds(userId: number): Promise<number[]> {
  const rows = await sql<{ course_id: number }[]>`SELECT course_id FROM wishlists WHERE student_id = ${userId}`;
  return rows.map((r) => r.course_id);
}
