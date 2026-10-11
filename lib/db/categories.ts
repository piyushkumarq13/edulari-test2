import { sql } from "@/lib/db/client";

export async function listCategories(): Promise<Array<{ id: number; name: string; slug: string }>> {
  return sql<{ id: number; name: string; slug: string }[]>`SELECT id, name, slug FROM categories ORDER BY name`;
}

export async function getCategoryBySlug(slug: string): Promise<{ id: number; name: string; slug: string; description: string | null } | null> {
  const rows = await sql<{ id: number; name: string; slug: string; description: string | null }[]>`SELECT id, name, slug, description FROM categories WHERE slug = ${slug}`;
  return rows.length ? rows[0] : null;
}
