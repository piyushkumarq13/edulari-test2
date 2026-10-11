import { sql } from "@/lib/db/client";

/**
 * Port of the grades.php per-course grade maths. Kept pure so the unit tests can cover
 * the weighting, the letter thresholds and the pass/fail rule without a database.
 */

export type GradableLesson = {
  lesson_id: number;
  lesson_title: string;
  content_type: string;
  attempt_id: number | null;
  quiz_score: number | null;
  total_points: number | null;
  quiz_pct: string | null;
  quiz_passed: boolean | null;
  quiz_completed_at: Date | null;
  submission_id: number | null;
  marks_obtained: number | null;
  assignment_status: string | null;
  submitted_at: Date | null;
  feedback: string | null;
  max_marks: number | null;
  passing_marks: number | null;
};

export type QuizAttemptHistory = {
  lesson_id: number;
  score: number;
  total_points: number;
  percentage: string;
  passed: boolean;
  completed_at: Date | null;
};

export type CourseGrade = {
  weightedAvg: number | null;
  letterGrade: string;
  gradeClass: string;
  passStatus: "pass" | "fail" | null;
  quizCount: number;
  quizPassed: number;
  assignCount: number;
  assignGraded: number;
};

export const QUIZ_DEFAULT_WEIGHT = 10;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** grades.php's letter ladder. */
export function letterGradeFor(weightedAvg: number | null): { letterGrade: string; gradeClass: string } {
  if (weightedAvg === null) return { letterGrade: "—", gradeClass: "grade-none" };
  if (weightedAvg >= 90) return { letterGrade: "A", gradeClass: "grade-a" };
  if (weightedAvg >= 80) return { letterGrade: "B", gradeClass: "grade-b" };
  if (weightedAvg >= 70) return { letterGrade: "C", gradeClass: "grade-c" };
  if (weightedAvg >= 60) return { letterGrade: "D", gradeClass: "grade-d" };
  return { letterGrade: "F", gradeClass: "grade-f" };
}

/** Pure port of grades.php's weighted-average loop for one enrollment. */
export function computeCourseGrade(
  lessons: GradableLesson[],
  passingPercentage: number,
): CourseGrade {
  let totalWeight = 0;
  let earnedWeight = 0;
  let quizCount = 0;
  let quizPassed = 0;
  let assignCount = 0;
  let assignGraded = 0;

  for (const les of lessons) {
    if (les.content_type === "quiz" && les.attempt_id !== null) {
      quizCount++;
      const weight = Number(les.total_points) || QUIZ_DEFAULT_WEIGHT;
      totalWeight += weight;
      earnedWeight += (Number(les.quiz_pct ?? 0) / 100) * weight;
      if (les.quiz_passed) quizPassed++;
    }
    if (les.content_type === "assignment") {
      assignCount++;
      if (les.assignment_status === "graded" && Number(les.max_marks ?? 0) > 0) {
        assignGraded++;
        const weight = Number(les.max_marks);
        totalWeight += weight;
        earnedWeight += Number(les.marks_obtained ?? 0);
      }
    }
  }

  const weightedAvg = totalWeight > 0 ? round1((earnedWeight / totalWeight) * 100) : null;
  const { letterGrade, gradeClass } = letterGradeFor(weightedAvg);

  return {
    weightedAvg,
    letterGrade,
    gradeClass,
    passStatus: weightedAvg === null ? null : weightedAvg >= passingPercentage ? "pass" : "fail",
    quizCount,
    quizPassed,
    assignCount,
    assignGraded,
  };
}

/** grades.php's global summary: sums per course, mean of the non-null averages. */
export function summarizeGrades(courseGrades: CourseGrade[]) {
  let globalTotalQuizzes = 0;
  let globalQuizzesPassed = 0;
  let globalAssignSubmitted = 0;
  let globalAssignGraded = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const cg of courseGrades) {
    globalTotalQuizzes += cg.quizCount;
    globalQuizzesPassed += cg.quizPassed;
    globalAssignSubmitted += cg.assignCount;
    globalAssignGraded += cg.assignGraded;
    if (cg.weightedAvg !== null) {
      scoreSum += cg.weightedAvg;
      scoreCount++;
    }
  }

  return {
    globalTotalQuizzes,
    globalQuizzesPassed,
    globalAssignSubmitted,
    globalAssignGraded,
    globalAvg: scoreCount > 0 ? round1(scoreSum / scoreCount) : null,
  };
}

/** The `fill-*` class a 0-100 score maps to (shared by the table bars). */
export function fillClassFor(score: number | null): string {
  if (score === null) return "fill-none";
  if (score >= 90) return "fill-a";
  if (score >= 80) return "fill-b";
  if (score >= 70) return "fill-c";
  if (score >= 60) return "fill-d";
  return "fill-f";
}

/** gradeStatusBadge()'s five states. */
export type BadgeStatus = "pass" | "fail" | "graded" | "pending" | "none";
export function badgeClass(status: string | null | undefined): BadgeStatus {
  if (status === "pass" || status === "fail" || status === "graded" || status === "pending") return status;
  return "none";
}
export function badgeLabel(status: string | null | undefined): string {
  switch (badgeClass(status)) {
    case "pass": return "Pass";
    case "fail": return "Fail";
    case "graded": return "Graded";
    case "pending": return "Pending";
    default: return "—";
  }
}

export type EnrollmentGradeRow = {
  enrollment_id: number;
  progress_percentage: number;
  enrolled_at: Date | null;
  course_completed_at: Date | null;
  course_id: number;
  course_title: string;
  thumbnail: string | null;
  passing_percentage: number;
  category_name: string | null;
  instructor_name: string | null;
};

export async function getEnrollmentsWithCourse(userId: number): Promise<EnrollmentGradeRow[]> {
  return sql<EnrollmentGradeRow[]>`
    SELECT e.id AS enrollment_id, e.progress_percentage, e.enrolled_at,
           e.completed_at AS course_completed_at,
           c.id AS course_id, c.title AS course_title, c.thumbnail, c.passing_percentage,
           cat.name AS category_name, u.name AS instructor_name
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE e.student_id = ${userId}
    ORDER BY e.enrolled_at DESC
  `;
}

export async function getGradableLessons(enrollmentId: number, courseId: number): Promise<GradableLesson[]> {
  return sql<GradableLesson[]>`
    SELECT l.id AS lesson_id, l.title AS lesson_title, l.content_type,
           qa.id AS attempt_id,
           qa.score AS quiz_score,
           qa.total_points,
           qa.percentage AS quiz_pct,
           qa.passed AS quiz_passed,
           qa.completed_at AS quiz_completed_at,
           ass.id AS submission_id,
           ass.marks_obtained,
           ass.status AS assignment_status,
           ass.submitted_at,
           ass.feedback,
           a.max_marks,
           a.passing_marks
    FROM lessons l
    LEFT JOIN quiz_attempts qa ON l.id = qa.lesson_id AND qa.enrollment_id = ${enrollmentId}
    LEFT JOIN assignment_submissions ass ON l.id = ass.lesson_id AND ass.enrollment_id = ${enrollmentId}
    LEFT JOIN assignments a ON l.id = a.lesson_id
    WHERE l.course_id = ${courseId}
      AND l.content_type IN ('quiz', 'assignment')
    ORDER BY l.sort_order, l.id
  `;
}

export async function getQuizAttemptHistory(enrollmentId: number): Promise<QuizAttemptHistory[]> {
  return sql<QuizAttemptHistory[]>`
    SELECT qa.lesson_id, qa.score, qa.total_points, qa.percentage,
           qa.passed, qa.completed_at,
           l.title AS lesson_title
    FROM quiz_attempts qa
    JOIN lessons l ON qa.lesson_id = l.id
    WHERE qa.enrollment_id = ${enrollmentId}
    ORDER BY qa.lesson_id, qa.completed_at DESC
  `;
}

/** Group the flat attempt list by lesson, preserving the completed_at DESC order. */
export function groupAttemptsByLesson(attempts: QuizAttemptHistory[]): Map<number, QuizAttemptHistory[]> {
  const map = new Map<number, QuizAttemptHistory[]>();
  for (const att of attempts) {
    const key = Number(att.lesson_id);
    const list = map.get(key) ?? [];
    list.push(att);
    map.set(key, list);
  }
  return map;
}