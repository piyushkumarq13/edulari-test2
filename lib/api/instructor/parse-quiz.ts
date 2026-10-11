import type { QuizQuestionInput } from "@/lib/db/instructor/quizzes";

export class QuizValidationError extends Error {}

/**
 * The modal serialises its question cards as quiz_questions[i][field], matching the array
 * names course-content.php's $_POST['quiz_questions'] produced. Kept as its own module so the
 * mapping is unit-testable without a request context.
 *
 * Points must stay positive and a multiple-choice question needs at least two real options with
 * exactly one marked correct; the PHP relied on the browser to enforce most of this, so a direct
 * POST could otherwise store an unanswerable question and silently break the student's score.
 */
export function parseQuizQuestions(form: FormData): QuizQuestionInput[] {
  const indices = new Set<number>();
  for (const key of form.keys()) {
    const m = key.match(/^quiz_questions\[(\d+)\]/);
    if (m) indices.add(Number(m[1]));
  }

  const out: QuizQuestionInput[] = [];
  for (const i of [...indices].sort((a, b) => a - b)) {
    const question = String(form.get(`quiz_questions[${i}][question]`) ?? "").trim();
    if (!question) continue;

    const type = String(form.get(`quiz_questions[${i}][type]`) ?? "multiple_choice");
    const rawPoints = Number(form.get(`quiz_questions[${i}][points]`) ?? 1);
    const points = Number.isFinite(rawPoints) ? Math.round(rawPoints) : NaN;
    if (!Number.isFinite(points) || points < 1 || points > 100) {
      throw new QuizValidationError("Quiz question points must be a whole number between 1 and 100.");
    }

    if (type === "multiple_choice") {
      const correctOption = Number(form.get(`quiz_questions[${i}][correct_option]`) ?? 0);
      const options: Array<{ text: string; is_correct: number }> = [];
      for (let oi = 0; oi < 4; oi++) {
        const text = String(form.get(`quiz_questions[${i}][options][${oi}]`) ?? "").trim();
        if (!text) continue;
        options.push({ text, is_correct: oi === correctOption ? 1 : 0 });
      }
      if (options.length < 2) {
        throw new QuizValidationError(`Question ${out.length + 1} needs at least two answer options.`);
      }
      if (options.filter((o) => o.is_correct === 1).length !== 1) {
        throw new QuizValidationError(`Question ${out.length + 1} needs exactly one correct answer.`);
      }
      out.push({ lesson_id: 0, question, question_type: type, points, options });
    } else {
      const correct = String(form.get(`quiz_questions[${i}][correct_answer]`) ?? "true");
      if (correct !== "true" && correct !== "false") {
        throw new QuizValidationError(`Question ${out.length + 1} has an invalid correct answer.`);
      }
      out.push({
        lesson_id: 0,
        question,
        question_type: type,
        points,
        correct_answer: correct,
      });
    }
  }
  return out;
}