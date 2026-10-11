import { sql } from "@/lib/db/client";

export type LessonRow = {
  id: number;
  section_id: number;
  course_id: number;
  title: string;
  content_type: string;
  content_text: string | null;
  video_url: string | null;
  video_duration: number;
  pdf_file: string | null;
  is_free_preview: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

/**
 * edulariYoutubeId() from public/partials/video_player.php. course-content.php runs every
 * submitted video_url through this and rewrites it to the canonical watch URL when a YouTube
 * id can be extracted; anything else (Vimeo, a direct mp4, an unknown host) is stored as typed.
 */
export function youtubeIdFromUrl(input: string): string | null {
  let url = input.trim();
  if (url === "") return null;
  if (url.toLowerCase().includes("<iframe")) {
    const m = url.match(/src\s*=\s*["']([^"']+)["']/i);
    if (m) url = m[1];
  }
  const patterns: RegExp[] = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v|e)\/([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/attribution_link\?.*?[?&]?v=([A-Za-z0-9_-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[m.length - 1];
  }
  return null;
}

/** The normalisation course-content.php applies before createLesson()/updateLesson(). */
export function normaliseVideoUrl(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  const yt = youtubeIdFromUrl(v);
  return yt ? `https://www.youtube.com/watch?v=${yt}` : v;
}

export type LessonInput = {
  section_id: number;
  course_id: number;
  title: string;
  content_type: string;
  content_text?: string | null;
  video_url?: string | null;
  video_duration?: number;
  pdf_file?: string | null;
  is_free_preview?: boolean;
  sort_order?: number;
};

/** createLesson($data) — sort_order defaults to 0. */
export async function createLesson(data: LessonInput): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO lessons (
      section_id, course_id, title, content_type, content_text, video_url,
      video_duration, pdf_file, is_free_preview, sort_order, created_at, updated_at
    ) VALUES (
      ${data.section_id}, ${data.course_id}, ${data.title}, ${data.content_type},
      ${data.content_text ?? null}, ${data.video_url ?? null},
      ${Math.trunc(data.video_duration ?? 0)}, ${data.pdf_file ?? null},
      ${data.is_free_preview ?? false}, ${data.sort_order ?? 0}, now(), now()
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

const UPDATABLE_LESSON_FIELDS = [
  "section_id",
  "title",
  "content_type",
  "content_text",
  "video_url",
  "video_duration",
  "pdf_file",
  "is_free_preview",
  "sort_order",
] as const;

export type LessonPatch = Partial<Record<(typeof UPDATABLE_LESSON_FIELDS)[number], unknown>>;

/** updateLesson($lessonId, $courseId, $data) — scoped by id AND course_id. */
export async function updateLesson(
  lessonId: number,
  courseId: number,
  data: LessonPatch,
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const field of UPDATABLE_LESSON_FIELDS) {
    if (field in data) patch[field] = data[field];
  }
  if (Object.keys(patch).length === 0) return false;
  // sql(object) binds every value by column name, so no placeholder is hand-written.
  const rows = await sql<{ id: number }[]>`
    UPDATE lessons SET ${sql(patch)}, updated_at = now()
    WHERE id = ${lessonId} AND course_id = ${courseId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** deleteLesson($lessonId, $courseId). */
export async function deleteLesson(lessonId: number, courseId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    DELETE FROM lessons WHERE id = ${lessonId} AND course_id = ${courseId} RETURNING id
  `;
  return rows.length > 0;
}

/** getSectionLessons($sectionId, $courseId) — ordered by sort_order, id. */
export async function getSectionLessons(sectionId: number, courseId: number): Promise<LessonRow[]> {
  return sql<LessonRow[]>`
    SELECT * FROM lessons
    WHERE section_id = ${sectionId} AND course_id = ${courseId}
    ORDER BY sort_order ASC, id ASC
  `;
}

/** getLessonById($lessonId, $courseId = null). */
export async function getLessonById(
  lessonId: number,
  courseId?: number,
): Promise<LessonRow | null> {
  if (courseId === undefined) {
    const rows = await sql<LessonRow[]>`SELECT * FROM lessons WHERE id = ${lessonId} LIMIT 1`;
    return rows[0] ?? null;
  }
  const rows = await sql<LessonRow[]>`
    SELECT * FROM lessons WHERE id = ${lessonId} AND course_id = ${courseId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** getCourseLessons($courseId) — sections joined, ordered by section then lesson order. */
export async function getCourseLessons(courseId: number): Promise<Array<LessonRow & { section_title: string; section_sort: number }>> {
  return sql<Array<LessonRow & { section_title: string; section_sort: number }>>`
    SELECT l.*, s.title AS section_title, s.sort_order AS section_sort
    FROM lessons l
    JOIN course_sections s ON l.section_id = s.id
    WHERE l.course_id = ${courseId}
    ORDER BY s.sort_order ASC, s.id ASC, l.sort_order ASC, l.id ASC
  `;
}

/** reorderLessons($sectionId, $lessonOrders) — map of lessonId => sortOrder. */
export async function reorderLessons(
  sectionId: number,
  orders: Record<number, number>,
): Promise<boolean> {
  for (const [rawId, order] of Object.entries(orders)) {
    const id = Number(rawId);
    if (!Number.isFinite(id)) continue;
    await sql`
      UPDATE lessons SET sort_order = ${order} WHERE id = ${id} AND section_id = ${sectionId}
    `;
  }
  return true;
}

/** The next sort_order for a lesson appended to a section (the PHP used count()). */
export async function nextLessonOrder(sectionId: number, courseId: number): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM lessons WHERE section_id = ${sectionId} AND course_id = ${courseId}
  `;
  return Number(rows[0]?.count ?? 0);
}