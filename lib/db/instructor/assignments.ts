import { sql } from "@/lib/db/client";

export type AssignmentRow = {
  id: number;
  lesson_id: number;
  instructions: string | null;
  max_marks: number;
  passing_marks: number;
  due_days: number;
  allow_late_submission: boolean;
  created_at: Date;
};

/** createAssignment($data): max_marks ?? 100, passing_marks ?? 40, due_days ?? 7. */
export async function createAssignment(data: {
  lesson_id: number;
  instructions?: string;
  max_marks?: number;
  passing_marks?: number;
  due_days?: number;
  allow_late_submission?: boolean | number;
}): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO assignments (lesson_id, instructions, max_marks, passing_marks, due_days, allow_late_submission, created_at)
    VALUES (${data.lesson_id}, ${data.instructions ?? ""},
            ${data.max_marks ?? 100}, ${data.passing_marks ?? 40}, ${data.due_days ?? 7},
            ${Boolean(data.allow_late_submission)}, now())
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export type AssignmentPatch = {
  instructions?: string;
  max_marks?: number;
  passing_marks?: number;
  due_days?: number;
  allow_late_submission?: boolean | number;
};

/** updateAssignment($assignmentId, $data) — whitelist; false when no fields were supplied. */
export async function updateAssignment(assignmentId: number, data: AssignmentPatch): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const field of ["instructions", "max_marks", "passing_marks", "due_days", "allow_late_submission"] as const) {
    if (!(field in data)) continue;
    patch[field] = field === "allow_late_submission" ? Boolean(data[field]) : data[field];
  }
  if (Object.keys(patch).length === 0) return false;
  const rows = await sql<{ id: number }[]>`
    UPDATE assignments SET ${sql(patch)}
    WHERE id = ${assignmentId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** deleteAssignment($assignmentId). */
export async function deleteAssignment(assignmentId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`DELETE FROM assignments WHERE id = ${assignmentId} RETURNING id`;
  return rows.length > 0;
}

/** Remove the assignment attached to a lesson, used when the lesson changes content type. */
export async function deleteAssignmentByLesson(lessonId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`DELETE FROM assignments WHERE lesson_id = ${lessonId} RETURNING id`;
  return rows.length > 0;
}

/** getAssignmentByLesson($lessonId). */
export async function getAssignmentByLesson(lessonId: number): Promise<AssignmentRow | null> {
  const rows = await sql<AssignmentRow[]>`
    SELECT * FROM assignments WHERE lesson_id = ${lessonId} LIMIT 1
  `;
  return rows[0] ?? null;
}

/** getAssignmentById($assignmentId). */
export async function getAssignmentById(assignmentId: number): Promise<AssignmentRow | null> {
  const rows = await sql<AssignmentRow[]>`SELECT * FROM assignments WHERE id = ${assignmentId} LIMIT 1`;
  return rows[0] ?? null;
}