import { sql } from "@/lib/db/client";

export type SectionRow = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: Date;
};

/**
 * getCourseSections($courseId, $instructorId = null). Passing the instructor id first checks
 * that the course belongs to them and returns [] otherwise, so a section list can never leak
 * across instructors.
 */
export async function getCourseSections(
  courseId: number,
  instructorId?: number,
): Promise<SectionRow[]> {
  if (instructorId !== undefined) {
    const owned = await sql<{ id: number }[]>`
      SELECT id FROM courses WHERE id = ${courseId} AND instructor_id = ${instructorId} LIMIT 1
    `;
    if (owned.length === 0) return [];
  }
  return sql<SectionRow[]>`
    SELECT id, course_id, title, description, sort_order, created_at
    FROM course_sections
    WHERE course_id = ${courseId}
    ORDER BY sort_order ASC, id ASC
  `;
}

/** createSection($courseId, $title, $description = '', $sortOrder = 0). */
export async function createSection(
  courseId: number,
  title: string,
  description = "",
  sortOrder = 0,
): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO course_sections (course_id, title, description, sort_order, created_at)
    VALUES (${courseId}, ${title}, ${description}, ${sortOrder}, now())
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export type SectionPatch = { title?: string; description?: string; sort_order?: number };

/** updateSection($sectionId, $courseId, $data) — scoped by id AND course_id. */
export async function updateSection(
  sectionId: number,
  courseId: number,
  data: SectionPatch,
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const field of ["title", "description", "sort_order"] as const) {
    if (field in data) patch[field] = data[field];
  }
  if (Object.keys(patch).length === 0) return false;
  // sql(object) maps each key to its bound value, so no placeholder is ever hand-written.
  const rows = await sql<{ id: number }[]>`
    UPDATE course_sections SET ${sql(patch)}
    WHERE id = ${sectionId} AND course_id = ${courseId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** deleteSection($sectionId, $courseId). */
export async function deleteSection(sectionId: number, courseId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    DELETE FROM course_sections WHERE id = ${sectionId} AND course_id = ${courseId} RETURNING id
  `;
  return rows.length > 0;
}

/** reorderSections($courseId, $sectionOrders) — map of sectionId => sortOrder. */
export async function reorderSections(
  courseId: number,
  orders: Record<number, number>,
): Promise<boolean> {
  const ids = Object.keys(orders).map(Number).filter((n) => Number.isFinite(n));
  for (const id of ids) {
    await sql`
      UPDATE course_sections SET sort_order = ${orders[id]}
      WHERE id = ${id} AND course_id = ${courseId}
    `;
  }
  return true;
}