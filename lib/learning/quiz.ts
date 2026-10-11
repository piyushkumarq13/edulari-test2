import { sql, withTransaction } from "@/lib/db/client";
import { getQuizQuestions, type QuizQuestion } from "@/lib/db/learning";
import { markLessonComplete } from "./progress";

/**
 * Port of submitQuizAttempt() from private/functions/student.php.
 *
 * The scoring rules, verbatim:
 *  - every question contributes its `points` to the total, answered or not;
 *  - `multiple_choice` answers are option IDs, `true_false` answers are 'true'/'false';
 *  - one quiz_answers row per question, `selected_option_id` may be NULL;
 *  - percentage is round(earned/total*100, 2), pass mark comes from the COURSE;
 *  - only a pass calls markLessonComplete().
 */

export type QuizAnswerInput = Record<string, string | number>;

export type ScoredQuestion = {
  questionId: number;
  selectedOptionId: number | null;
  isCorrect: boolean;
  pointsEarned: number;
};

export type ScoredAttempt = {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  scored: ScoredQuestion[];
};

export const DEFAULT_PASSING_PERCENTAGE = 70;

/**
 * Pure scorer, split out of submitQuizAttempt() so the unit tests can cover the
 * multiple_choice / true_false / unanswered branches without a database.
 */
export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswerInput): ScoredAttempt {
  let totalPoints = 0;
  let earnedPoints = 0;
  const scored: ScoredQuestion[] = [];

  for (const question of questions) {
    totalPoints += Number(question.points ?? 0);

    const raw = answers[String(question.id)];
    const studentAnswer = raw === undefined || raw === null ? null : String(raw);

    let isCorrect = false;
    let pointsEarned = 0;
    let selectedOptionId: number | null = null;

    if (question.question_type === "multiple_choice") {
      for (const option of question.options) {
        if (String(option.id) === studentAnswer && option.is_correct) {
          isCorrect = true;
          pointsEarned = Number(question.points ?? 0);
        }
        if (String(option.id) === studentAnswer) selectedOptionId = Number(option.id);
      }
    } else {
      // true_false: the correct option is the one whose text is 'True' / 'False'.
      const correct = question.options.find((o) => o.is_correct);
      const expected = correct ? (correct.option_text === "True" ? "true" : "false") : null;
      if (correct && studentAnswer !== null && studentAnswer === expected) {
        isCorrect = true;
        pointsEarned = Number(question.points ?? 0);
      }
      for (const opt of question.options) {
        if (
          (studentAnswer === "true" && opt.option_text === "True") ||
          (studentAnswer === "false" && opt.option_text === "False")
        ) {
          selectedOptionId = Number(opt.id);
        }
      }
    }

    earnedPoints += pointsEarned;
    scored.push({ questionId: Number(question.id), selectedOptionId, isCorrect, pointsEarned });
  }

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100 * 100) / 100 : 0;
  return { totalPoints, earnedPoints, percentage, scored };
}

export function isPassed(percentage: number, passingPercentage: number): boolean {
  return percentage >= passingPercentage;
}

export type QuizAttemptResult = {
  attempt_id: number;
  score: number;
  total: number;
  percentage: number;
  passed: number;
};

/** The course's pass mark for the enrollment's course (defaults to 70). */
export async function getPassingPercentage(enrollmentId: number): Promise<number> {
  const rows = await sql<{ passing_percentage: number | null }[]>`
    SELECT c.passing_percentage FROM courses c
    JOIN enrollments e ON c.id = e.course_id
    WHERE e.id = ${enrollmentId}
  `;
  return rows[0]?.passing_percentage ?? DEFAULT_PASSING_PERCENTAGE;
}

/** Full submitQuizAttempt() including the DB writes. */
export async function submitQuizAttempt(
  enrollmentId: number,
  lessonId: number,
  answers: QuizAnswerInput,
): Promise<QuizAttemptResult> {
  const questions = await getQuizQuestions(lessonId);
  const scoredAttempt = scoreQuiz(questions, answers);
  const passingPercentage = await getPassingPercentage(enrollmentId);
  const passed = isPassed(scoredAttempt.percentage, passingPercentage);

  const attemptId = await withTransaction(async (t) => {
    const inserted = await t<{ id: number }[]>`
      INSERT INTO quiz_attempts (enrollment_id, lesson_id, started_at)
      VALUES (${enrollmentId}, ${lessonId}, now())
      RETURNING id
    `;
    const id = Number(inserted[0].id);

    for (const s of scoredAttempt.scored) {
      await t`
        INSERT INTO quiz_answers (attempt_id, question_id, selected_option_id, is_correct, points_earned)
        VALUES (${id}, ${s.questionId}, ${s.selectedOptionId}, ${s.isCorrect}, ${s.pointsEarned})
      `;
    }

    await t`
      UPDATE quiz_attempts
      SET score = ${scoredAttempt.earnedPoints},
          total_points = ${scoredAttempt.totalPoints},
          percentage = ${scoredAttempt.percentage},
          passed = ${passed},
          completed_at = now()
      WHERE id = ${id}
    `;

    return id;
  });

  if (passed) await markLessonComplete(enrollmentId, lessonId, 0);

  return {
    attempt_id: attemptId,
    score: scoredAttempt.earnedPoints,
    total: scoredAttempt.totalPoints,
    percentage: scoredAttempt.percentage,
    passed: passed ? 1 : 0,
  };
}

/** The per-question answer review learn.php renders after a submission. */
export type QuizReviewItem = {
  question: string;
  type: string;
  options: { id: number; option_text: string; is_correct: boolean }[];
  selected_id: number | null;
  correct_id: number | null;
  is_correct: boolean;
  points: number;
};

export function buildQuizReview(questions: QuizQuestion[], answers: QuizAnswerInput): QuizReviewItem[] {
  return questions.map((q) => {
    const submitted = answers[String(q.id)];
    const submittedVal = submitted === undefined || submitted === null ? null : String(submitted);

    let correctOpt: QuizReviewItem["options"][number] | null = null;
    let selectedOpt: QuizReviewItem["options"][number] | null = null;

    for (const opt of q.options) {
      if (opt.is_correct) correctOpt = opt;
      if (q.question_type === "multiple_choice" && String(opt.id) === submittedVal) selectedOpt = opt;
      if (q.question_type === "true_false") {
        if (
          (submittedVal === "true" && opt.option_text === "True") ||
          (submittedVal === "false" && opt.option_text === "False")
        ) {
          selectedOpt = opt;
        }
      }
    }

    return {
      question: q.question,
      type: q.question_type,
      options: q.options.map((o) => ({ id: Number(o.id), option_text: o.option_text, is_correct: o.is_correct })),
      selected_id: selectedOpt ? Number(selectedOpt.id) : null,
      correct_id: correctOpt ? Number(correctOpt.id) : null,
      is_correct: !!(selectedOpt && correctOpt && Number(selectedOpt.id) === Number(correctOpt.id)),
      points: Number(q.points ?? 0),
    };
  });
}

/** Stored per-question answer for one attempt. */
export type StoredQuizAnswer = { question_id: number; selected_option_id: number | null; is_correct: boolean };

/**
 * The same review list, rebuilt from the persisted quiz_answers rows instead of the
 * POSTed payload. Used after the post/redirect/get hop so a refresh re-renders the same
 * review instead of losing it.
 */
export function buildQuizReviewFromStored(
  questions: QuizQuestion[],
  stored: StoredQuizAnswer[],
): QuizReviewItem[] {
  const byQuestion = new Map(stored.map((a) => [Number(a.question_id), a]));

  return questions.map((q) => {
    const row = byQuestion.get(Number(q.id));
    const selectedId = row?.selected_option_id ?? null;
    const correctOpt = q.options.find((o) => o.is_correct) ?? null;

    return {
      question: q.question,
      type: q.question_type,
      options: q.options.map((o) => ({ id: Number(o.id), option_text: o.option_text, is_correct: o.is_correct })),
      selected_id: selectedId,
      correct_id: correctOpt ? Number(correctOpt.id) : null,
      is_correct: !!row?.is_correct,
      points: Number(q.points ?? 0),
    };
  });
}

/** Ownership-checked attempt fetch used after the quiz post/redirect/get. */
export async function getAttemptForReview(
  attemptId: number,
  enrollmentId: number,
  lessonId: number,
): Promise<{ attempt: { score: number; total_points: number; percentage: string; passed: boolean } | null; answers: StoredQuizAnswer[] }> {
  const rows = await sql<{ id: number; score: number; total_points: number; percentage: string; passed: boolean }[]>`
    SELECT id, score, total_points, percentage, passed
    FROM quiz_attempts
    WHERE id = ${attemptId} AND enrollment_id = ${enrollmentId} AND lesson_id = ${lessonId} AND completed_at IS NOT NULL
  `;
  if (rows.length === 0) return { attempt: null, answers: [] };

  const answers = await sql<StoredQuizAnswer[]>`
    SELECT question_id, selected_option_id, is_correct
    FROM quiz_answers WHERE attempt_id = ${attemptId} ORDER BY id
  `;

  return { attempt: rows[0], answers };
}