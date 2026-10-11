import { sql } from "@/lib/db/client";

/**
 * Port of markLessonComplete() + updateCourseProgress() from
 * private/functions/student.php.
 *
 * updateCourseProgress() counts EVERY lesson of the course (not just the ones the student
 * opened), rounds to a whole percent, and stamps completed_at exactly once.
 */

export function computeProgressPercentage(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/** Port of getLessonNavigation()'s prev/next search, as a pure function over the flat list. */
export function findFlatLessonIndex(lessonIds: number[], currentLessonId: number): number {
  return lessonIds.findIndex((id) => Number(id) === Number(currentLessonId));
}

/**
 * The completed-lesson count updateCourseProgress() uses. Kept separate so the unit
 * tests can assert the exact predicate the PHP writes.
 */
export async function countCompletedLessons(enrollmentId: number): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM lesson_progress
    WHERE enrollment_id = ${enrollmentId} AND completed_at IS NOT NULL
  `;
  return rows[0]?.c ?? 0;
}

/** The total-lesson count updateCourseProgress() uses: every lesson in the course. */
export async function countCourseLessons(enrollmentId: number): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM lessons l
    JOIN enrollments e ON l.course_id = e.course_id
    WHERE e.id = ${enrollmentId}
  `;
  return rows[0]?.c ?? 0;
}

/** Port of updateCourseProgress(). Returns the new percentage. */
export async function updateCourseProgress(enrollmentId: number): Promise<number> {
  const [completed, total] = await Promise.all([
    countCompletedLessons(enrollmentId),
    countCourseLessons(enrollmentId),
  ]);
  const percentage = computeProgressPercentage(completed, total);
  const completedAt = percentage >= 100 ? new Date() : null;
  await sql`
    UPDATE enrollments
    SET progress_percentage = ${percentage}, completed_at = COALESCE(completed_at, ${completedAt})
    WHERE id = ${enrollmentId}
  `;
  return percentage;
}

/**
 * Port of markLessonComplete(). An existing row accumulates time_spent_seconds and keeps
 * its original completed_at; a new row gets completed_at = now().
 */
export async function markLessonComplete(enrollmentId: number, lessonId: number, timeSpent = 0): Promise<boolean> {
  const existing = await sql<{ id: number }[]>`
    SELECT id FROM lesson_progress WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${lessonId}
  `;

  if (existing.length) {
    await sql`
      UPDATE lesson_progress
      SET time_spent_seconds = time_spent_seconds + ${timeSpent},
          completed_at = COALESCE(completed_at, now())
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, completed_at, time_spent_seconds)
      VALUES (${enrollmentId}, ${lessonId}, now(), ${timeSpent})
    `;
  }

  await updateCourseProgress(enrollmentId);
  return true;
}