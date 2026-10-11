import { sql, withTransaction } from "@/lib/db/client";

export type QuizOptionRow = {
  id: number;
  question_id: number;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
};

export type QuizQuestionRow = {
  id: number;
  lesson_id: number;
  question: string;
  question_type: string;
  points: number;
  sort_order: number;
  options?: QuizOptionRow[];
};

export interface QuizOptionInput {
  text: string;
  is_correct?: boolean | number;
}

export interface QuizQuestionInput {
  lesson_id: number;
  question: string;
  question_type?: string;
  points?: number;
  sort_order?: number;
  options?: QuizOptionInput[];
  correct_answer?: string;
}

/** createQuizOption($questionId, $text, $isCorrect = 0, $sortOrder = 0). */
export async function createQuizOption(
  questionId: number,
  text: string,
  isCorrect: boolean | number = 0,
  sortOrder = 0,
): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
    VALUES (${questionId}, ${text}, ${Boolean(isCorrect)}, ${sortOrder})
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

/**
 * createQuizQuestion($data): multiple_choice stores one option row per entry; true_false
 * stores exactly two options, 'True' and 'False', with the one named by correct_answer marked.
 */
export async function createQuizQuestion(data: QuizQuestionInput): Promise<number | null> {
  return withTransaction(async (tx) => {
    const questionId = await createQuizQuestionRow(tx, data);
    if (questionId === null) return null;
    const type = data.question_type ?? "multiple_choice";
    if (type === "multiple_choice") {
      const options = data.options ?? [];
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        await createQuizOptionRow(tx, questionId, opt.text, Boolean(opt.is_correct), i);
      }
    } else {
      const answer = data.correct_answer === "false" ? "false" : "true";
      await createQuizOptionRow(tx, questionId, "True", answer === "true", 0);
      await createQuizOptionRow(tx, questionId, "False", answer === "false", 1);
    }
    return questionId;
  });
}

async function createQuizQuestionRow(tx: typeof sql, data: QuizQuestionInput): Promise<number | null> {
  const rows = await tx<{ id: number }[]>`
    INSERT INTO quiz_questions (lesson_id, question, question_type, points, sort_order, created_at)
    VALUES (${data.lesson_id}, ${data.question}, ${data.question_type ?? "multiple_choice"},
            ${data.points ?? 1}, ${data.sort_order ?? 0}, now())
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

async function createQuizOptionRow(
  tx: typeof sql,
  questionId: number,
  text: string,
  isCorrect: boolean,
  sortOrder: number,
): Promise<void> {
  await tx`
    INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order)
    VALUES (${questionId}, ${text}, ${isCorrect}, ${sortOrder})
  `;
}

/** updateQuizQuestion($questionId, $data) — whitelist: question, points, sort_order. */
export async function updateQuizQuestion(
  questionId: number,
  data: { question?: string; points?: number; sort_order?: number },
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const field of ["question", "points", "sort_order"] as const) {
    if (field in data) patch[field] = data[field];
  }
  if (Object.keys(patch).length === 0) return false;
  const rows = await sql<{ id: number }[]>`
    UPDATE quiz_questions SET ${sql(patch)}
    WHERE id = ${questionId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** updateQuizOptions($questionId, $options) — delete then re-insert, as the PHP does. */
export async function updateQuizOptions(
  questionId: number,
  options: QuizOptionInput[],
): Promise<boolean> {
  return withTransaction(async (tx) => {
    await tx`DELETE FROM quiz_options WHERE question_id = ${questionId}`;
    for (let i = 0; i < options.length; i++) {
      await createQuizOptionRow(tx, questionId, options[i].text, Boolean(options[i].is_correct), i);
    }
    return true;
  });
}

/** deleteQuizQuestion($questionId). */
export async function deleteQuizQuestion(questionId: number): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`DELETE FROM quiz_questions WHERE id = ${questionId} RETURNING id`;
  return rows.length > 0;
}

/** getQuizQuestions($lessonId) — ordered by sort_order, id, each with its options. */
export async function getQuizQuestions(lessonId: number): Promise<QuizQuestionRow[]> {
  const questions = await sql<QuizQuestionRow[]>`
    SELECT id, lesson_id, question, question_type, points, sort_order
    FROM quiz_questions WHERE lesson_id = ${lessonId}
    ORDER BY sort_order ASC, id ASC
  `;
  if (questions.length === 0) return [];
  const options = await sql<QuizOptionRow[]>`
    SELECT id, question_id, option_text, is_correct, sort_order
    FROM quiz_options
    WHERE question_id IN ${sql(questions.map((q) => q.id))}
    ORDER BY sort_order ASC, id ASC
  `;
  const byQuestion = new Map<number, QuizOptionRow[]>();
  for (const opt of options) {
    const list = byQuestion.get(opt.question_id);
    if (list) list.push(opt);
    else byQuestion.set(opt.question_id, [opt]);
  }
  return questions.map((q) => ({ ...q, options: byQuestion.get(q.id) ?? [] }));
}

/** getQuizTotalPoints($lessonId). */
export async function getQuizTotalPoints(lessonId: number): Promise<number> {
  const rows = await sql<{ total: string | null }[]>`
    SELECT COALESCE(SUM(points), 0) AS total FROM quiz_questions WHERE lesson_id = ${lessonId}
  `;
  return Number(rows[0]?.total ?? 0);
}

/** course-content.php replaces a quiz lesson's questions wholesale on every save. */
export async function replaceQuizQuestions(lessonId: number, questions: QuizQuestionInput[]): Promise<void> {
  await sql`DELETE FROM quiz_questions WHERE lesson_id = ${lessonId}`;
  for (let i = 0; i < questions.length; i++) {
    await createQuizQuestion({ ...questions[i], lesson_id: lessonId, sort_order: i });
  }
}