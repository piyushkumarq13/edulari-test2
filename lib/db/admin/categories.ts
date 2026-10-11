import { sql } from "@/lib/db/client";

/**
 * Port of public/admin/categories.php.
 *
 * The page carried its own page-local fetchCategories()/generateSlug() helpers instead of the
 * differently-behaving createSlug()/createCategory() in private/functions/admin.php, so the page
 * versions are the ones reproduced here (they use the real columns and is_published = true).
 */

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  course_count: number;
  published_count: number;
};

const ALLOWED_SORT = ["id", "name", "slug", "course_count"] as const;

/** fetchCategories(): search + whitelisted sort; course_count alias sorts with a name tiebreak. */
export async function fetchCategories(
  search = "",
  sortBy = "name",
  sortDir = "ASC",
): Promise<CategoryRow[]> {
  const by = (ALLOWED_SORT as readonly string[]).includes(sortBy) ? sortBy : "name";
  const dir = sortDir === "DESC" ? "DESC" : "ASC";
  const orderClause =
    by === "course_count"
      ? `ORDER BY course_count ${dir}, c.name ASC`
      : `ORDER BY c.${by} ${dir}`;

  const base = `SELECT c.id, c.name, c.slug, c.description,
                   (SELECT COUNT(*)::int FROM courses WHERE category_id = c.id)                      AS course_count,
                   (SELECT COUNT(*)::int FROM courses WHERE category_id = c.id AND is_published = true) AS published_count
            FROM categories c`;

  if (search !== "") {
    // MySQL LIKE is case-insensitive; Postgres needs ILIKE to match the original behaviour.
    const like = `%${search}%`;
    return sql.unsafe<CategoryRow[]>(
      `${base} WHERE (c.name ILIKE $1 OR c.description ILIKE $1 OR c.slug ILIKE $1) ${orderClause}`,
      [like],
    );
  }

  return sql.unsafe<CategoryRow[]>(`${base} ${orderClause}`);
}

/** generateSlug(): same character rules as the page; on collision it appends the unix seconds. */
export async function generateCategorySlug(
  name: string,
  excludeId: number | null = null,
): Promise<string> {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const rows = excludeId
    ? await sql<{ id: number }[]>`
        SELECT id FROM categories WHERE slug = ${slug} AND id <> ${excludeId} LIMIT 1`
    : await sql<{ id: number }[]>`
        SELECT id FROM categories WHERE slug = ${slug} LIMIT 1`;

  if (rows.length > 0) {
    slug += `-${Math.floor(Date.now() / 1000)}`;
  }
  return slug;
}

/** create: slug generated from the name, then INSERT. Returns true when a row was written. */
export async function createCategory(name: string, description: string): Promise<boolean> {
  const slug = await generateCategorySlug(name);
  const rows = await sql<{ id: number }[]>`
    INSERT INTO categories (name, slug, description) VALUES (${name}, ${slug}, ${description})
    RETURNING id
  `;
  return rows.length > 0;
}

/** update: regenerates the slug (excluding itself), returns true unless the query threw. */
export async function updateCategory(
  categoryId: number,
  name: string,
  description: string,
): Promise<boolean> {
  const slug = await generateCategorySlug(name, categoryId);
  await sql`
    UPDATE categories SET name = ${name}, slug = ${slug}, description = ${description}
    WHERE id = ${categoryId}
  `;
  return true;
}

/** delete: unassign the category's courses first, then delete the row. */
export async function deleteCategory(categoryId: number): Promise<{ courseCount: number }> {
  const countRows = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt FROM courses WHERE category_id = ${categoryId}
  `;
  const courseCount = countRows[0]?.cnt ?? 0;

  if (courseCount > 0) {
    await sql`UPDATE courses SET category_id = NULL WHERE category_id = ${categoryId}`;
  }
  await sql`DELETE FROM categories WHERE id = ${categoryId}`;
  return { courseCount };
}

/** bulk_delete: unassign then delete every selected id; returns the number of categories removed. */
export async function bulkDeleteCategories(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  await sql`UPDATE courses SET category_id = NULL WHERE category_id IN ${sql(ids)}`;
  const deleted = await sql<{ id: number }[]>`
    DELETE FROM categories WHERE id IN ${sql(ids)} RETURNING id
  `;
  return deleted.length;
}
