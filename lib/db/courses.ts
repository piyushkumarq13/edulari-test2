import { sql } from "@/lib/db/client";

// Read-side course queries shared by public browse/category pages.

export async function listPublishedCourses(categoryId?: number): Promise<Array<{ id: number; title: string; slug: string; price: number; thumbnail: string | null }>> {
  if (categoryId !== undefined) {
    return sql<{ id: number; title: string; slug: string; price: number; thumbnail: string | null }[]>`
      SELECT id, title, slug, price, thumbnail FROM courses WHERE is_published = true AND category_id = ${categoryId} ORDER BY created_at DESC
    `;
  }
  return sql<{ id: number; title: string; slug: string; price: number; thumbnail: string | null }[]>`
    SELECT id, title, slug, price, thumbnail FROM courses WHERE is_published = true ORDER BY created_at DESC
  `;
}

export async function getCourseBySlug(slug: string): Promise<{ id: number; title: string; slug: string; description: string | null; price: number; instructor_id: number } | null> {
  const rows = await sql<{ id: number; title: string; slug: string; description: string | null; price: number; instructor_id: number }[]>`
    SELECT id, title, slug, description, price, instructor_id FROM courses WHERE slug = ${slug} AND is_published = true
  `;
  return rows.length ? rows[0] : null;
}
