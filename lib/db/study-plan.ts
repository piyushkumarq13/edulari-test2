import { sql } from "./client";
import { findEnrollment, getStudentCourses, type StudentCourse } from "./learning";

/**
 * Port of public/student/schedule.php (reads) and public/student/schedule-api.php
 * (writes). Every statement matches the PHP; the CSRF gap in schedule-api.php is closed
 * in the route handler, not here.
 */

export type StudyPlan = {
  id: number;
  student_id: number;
  course_id: number;
  lesson_id: number | null;
  planned_date: string;
  planned_time: string | null;
  duration_min: number;
  note: string | null;
  is_done: boolean;
  created_at: Date;
  updated_at: Date;
  course_title: string;
  thumbnail: string | null;
  lesson_title: string | null;
};

export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 480;
export const DEFAULT_DURATION_MIN = 30;

/** schedule-api.php: `max(5, min(480, postInt('duration_min') ?: 30))`. */
export function clampDuration(raw: number): number {
  const n = Number.isFinite(raw) ? Math.trunc(raw) : 0;
  const value = n === 0 ? DEFAULT_DURATION_MIN : n;
  return Math.max(MIN_DURATION_MIN, Math.min(MAX_DURATION_MIN, value));
}

/** PHP's `DateTime::createFromFormat('Y-m-d', $date)` — rejects 2026-13-01, 2026-02-30. */
export function isValidPlannedDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

/** `<input type="time">` value, or empty. */
export function normalizePlannedTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === "") return null;
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const [h, min] = v.split(":");
  if (Number(h) > 23 || Number(min) > 59) return null;
  return `${String(Number(h)).padStart(2, "0")}:${String(Number(min)).padStart(2, "0")}:00`;
}

export async function getWeekPlans(studentId: number, monday: string, sunday: string): Promise<StudyPlan[]> {
  return sql<StudyPlan[]>`
    SELECT sp.id, sp.student_id, sp.course_id, sp.lesson_id,
           sp.planned_date::text AS planned_date,
           sp.planned_time, sp.duration_min, sp.note, sp.is_done,
           sp.created_at, sp.updated_at,
           c.title AS course_title, c.thumbnail,
           l.title AS lesson_title
    FROM study_plan sp
    JOIN courses c ON sp.course_id = c.id
    LEFT JOIN lessons l ON sp.lesson_id = l.id
    WHERE sp.student_id = ${studentId}
      AND sp.planned_date BETWEEN ${monday} AND ${sunday}
    ORDER BY sp.planned_date ASC, sp.planned_time ASC, sp.id ASC
  `;
}

export type PendingTask = {
  id: number;
  title: string;
  type: "quiz" | "assignment";
  course_title: string;
  course_id: number;
  status?: string | null;
};

/**
 * schedule.php's pending-task sweep: per enrollment, up to 5 unattempted quizzes and up
 * to 5 unsubmitted/pending assignments, concatenated then sliced to 8 overall.
 */
export async function getPendingTasks(userId: number, limitPerKind = 5, total = 8): Promise<PendingTask[]> {
  const enrollments = await sql<{ enrollment_id: number; course_id: number; course_title: string }[]>`
    SELECT e.id AS enrollment_id, c.id AS course_id, c.title AS course_title
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.student_id = ${userId}
  `;

  const tasks: PendingTask[] = [];
  for (const enr of enrollments) {
    const quizzes = await sql<{ id: number; title: string }[]>`
      SELECT l.id, l.title FROM lessons l
      WHERE l.course_id = ${enr.course_id}
        AND l.content_type = 'quiz'
        AND NOT EXISTS (
          SELECT 1 FROM quiz_attempts qa
          WHERE qa.lesson_id = l.id AND qa.enrollment_id = ${enr.enrollment_id}
        )
      LIMIT ${limitPerKind}
    `;
    for (const q of quizzes) {
      tasks.push({ id: Number(q.id), title: q.title, type: "quiz", course_title: enr.course_title, course_id: Number(enr.course_id) });
    }

    const assignments = await sql<{ id: number; title: string; status: string | null }[]>`
      SELECT l.id, l.title, ass.status
      FROM lessons l
      LEFT JOIN assignment_submissions ass
        ON l.id = ass.lesson_id AND ass.enrollment_id = ${enr.enrollment_id}
      WHERE l.course_id = ${enr.course_id}
        AND l.content_type = 'assignment'
        AND (ass.id IS NULL OR ass.status = 'pending')
      LIMIT ${limitPerKind}
    `;
    for (const a of assignments) {
      tasks.push({
        id: Number(a.id), title: a.title, type: "assignment",
        course_title: enr.course_title, course_id: Number(enr.course_id), status: a.status,
      });
    }
  }

  return tasks.slice(0, total);
}

/** schedule.php's 28-day heatmap counts. */
export async function getHeatmapCounts(studentId: number, from: string, to: string): Promise<Map<string, number>> {
  const rows = await sql<{ planned_date: string; plan_count: number }[]>`
    SELECT planned_date, COUNT(*)::int AS plan_count
    FROM study_plan
    WHERE student_id = ${studentId} AND planned_date BETWEEN ${from} AND ${to}
    GROUP BY planned_date
  `;
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.planned_date, Number(r.plan_count));
  return map;
}

export type WeekStat = { planned_total: number; done_total: number };

export async function getWeekStats(studentId: number, monday: string, sunday: string): Promise<WeekStat> {
  const rows = await sql<{ planned_total: number; done_total: number | null }[]>`
    SELECT COUNT(*)::int AS planned_total,
           COALESCE(SUM(CASE WHEN is_done THEN 1 ELSE 0 END), 0)::int AS done_total
    FROM study_plan
    WHERE student_id = ${studentId} AND planned_date BETWEEN ${monday} AND ${sunday}
  `;
  return { planned_total: rows[0]?.planned_total ?? 0, done_total: rows[0]?.done_total ?? 0 };
}

/** Distinct `planned_date` values with is_done = 1, newest first (schedule.php streak). */
export async function getDoneDatesDesc(studentId: number): Promise<string[]> {
  const rows = await sql<{ planned_date: string }[]>`
    SELECT DISTINCT planned_date FROM study_plan
    WHERE student_id = ${studentId} AND is_done = true
    ORDER BY planned_date DESC
  `;
  return rows.map((r) => r.planned_date);
}

/** distinctPlanDatesDesc is the same shape, for dashboard.php's lesson-based streak. */
export async function getLearningDatesDesc(studentId: number): Promise<string[]> {
  const rows = await sql<{ learn_date: string }[]>`
    SELECT DISTINCT DATE(lp.completed_at) AS learn_date
    FROM lesson_progress lp
    JOIN enrollments e ON lp.enrollment_id = e.id
    WHERE e.student_id = ${studentId} AND lp.completed_at IS NOT NULL
    ORDER BY learn_date DESC
  `;
  return rows.map((r) => r.learn_date);
}

export type LearningTotals = { total_seconds: number; learning_days: number; completed_lessons: number };

export async function getLearningTotals(studentId: number): Promise<LearningTotals> {
  const rows = await sql<{ total_seconds: number; learning_days: number; completed_lessons: number }[]>`
    SELECT COALESCE(SUM(lp.time_spent_seconds), 0)::int AS total_seconds,
           COUNT(DISTINCT DATE(lp.completed_at))::int AS learning_days,
           COUNT(lp.id)::int AS completed_lessons
    FROM lesson_progress lp
    JOIN enrollments e ON lp.enrollment_id = e.id
    WHERE e.student_id = ${studentId} AND lp.completed_at IS NOT NULL
  `;
  return rows[0] ?? { total_seconds: 0, learning_days: 0, completed_lessons: 0 };
}

/** my-courses.php's total hours (completed lessons only). */
export async function getTotalHours(studentId: number): Promise<number> {
  const totals = await getLearningTotals(studentId);
  return Math.round((totals.total_seconds / 3600) * 10) / 10;
}

// ── Writes (schedule-api.php) ────────────────────────────────────────────────

export type PlanWriteResult = { success: boolean; message?: string; plan_id?: number; is_done?: boolean };

export async function isEnrolledCheck(courseId: number, studentId: number): Promise<boolean> {
  return (await findEnrollment(studentId, courseId)) !== null;
}

export async function ownPlan(planId: number, studentId: number): Promise<StudyPlan | null> {
  const rows = await sql<StudyPlan[]>`SELECT * FROM study_plan WHERE id = ${planId} AND student_id = ${studentId}`;
  return rows[0] ?? null;
}

export async function addPlan(input: {
  studentId: number;
  courseId: number;
  lessonId: number | null;
  plannedDate: string;
  plannedTime: string | null;
  durationMin: number;
  note: string | null;
}): Promise<PlanWriteResult> {
  if (!input.courseId || !input.plannedDate) {
    return { success: false, message: "Course and date are required." };
  }
  if (!(await isEnrolledCheck(input.courseId, input.studentId))) {
    return { success: false, message: "You are not enrolled in that course." };
  }
  if (!isValidPlannedDate(input.plannedDate)) {
    return { success: false, message: "Invalid date." };
  }

  const rows = await sql<{ id: number }[]>`
    INSERT INTO study_plan (student_id, course_id, lesson_id, planned_date, planned_time, duration_min, note)
    VALUES (${input.studentId}, ${input.courseId}, ${input.lessonId}, ${input.plannedDate},
            ${input.plannedTime}, ${input.durationMin}, ${input.note})
    RETURNING id
  `;
  if (rows.length) return { success: true, plan_id: Number(rows[0].id) };
  return { success: false, message: "Could not save. Please try again." };
}

export async function updatePlan(input: {
  studentId: number;
  planId: number;
  courseId: number;
  lessonId: number | null;
  plannedDate: string;
  plannedTime: string | null;
  durationMin: number;
  note: string | null;
}): Promise<PlanWriteResult> {
  if (!(await ownPlan(input.planId, input.studentId))) {
    return { success: false, message: "Session not found." };
  }
  if (!input.courseId || !input.plannedDate) {
    return { success: false, message: "Course and date are required." };
  }
  if (!(await isEnrolledCheck(input.courseId, input.studentId))) {
    return { success: false, message: "You are not enrolled in that course." };
  }
  if (!isValidPlannedDate(input.plannedDate)) {
    return { success: false, message: "Invalid date." };
  }

  const res = await sql`
    UPDATE study_plan
    SET course_id = ${input.courseId}, lesson_id = ${input.lessonId}, planned_date = ${input.plannedDate},
        planned_time = ${input.plannedTime}, duration_min = ${input.durationMin}, note = ${input.note}
    WHERE id = ${input.planId} AND student_id = ${input.studentId}
  `;
  return { success: res.count > 0 };
}

export async function deletePlan(planId: number, studentId: number): Promise<PlanWriteResult> {
  if (!(await ownPlan(planId, studentId))) return { success: false, message: "Session not found." };
  const res = await sql`DELETE FROM study_plan WHERE id = ${planId} AND student_id = ${studentId}`;
  return { success: res.count > 0 };
}

export async function toggleDone(planId: number, studentId: number): Promise<PlanWriteResult> {
  const plan = await ownPlan(planId, studentId);
  if (!plan) return { success: false, message: "Session not found." };
  const newDone = !plan.is_done;
  const res = await sql`
    UPDATE study_plan SET is_done = ${newDone} WHERE id = ${planId} AND student_id = ${studentId}
  `;
  return { success: res.count > 0, is_done: newDone };
}

export async function getStudentCoursesForSchedule(studentId: number): Promise<StudentCourse[]> {
  return getStudentCourses(studentId);
}