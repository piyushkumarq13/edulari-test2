import { config } from "@/lib/config";

/**
 * Client-safe test constants. These are referenced by both the server token logic and the
 * client test page, so they live here rather than in test-tokens.ts (which pulls in the
 * Postgres client and cannot be bundled for the browser).
 */
export const TEST_PASS_SCORE = config.TEST_PASS_SCORE;
export const TEST_QUESTION_COUNT = config.TEST_QUESTION_COUNT;
export const TEST_TOKEN_TTL_MINS = config.TEST_TOKEN_TTL_MINS;
export const TEST_TOKEN_TTL_SECS = config.TEST_TOKEN_TTL_MINS * 60;
export const FAILURE_BLOCK_SECS = 7 * 24 * 60 * 60;
export const AUTOSAVE_MIN_INTERVAL_SECS = 1;

export type TestQuestion = {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: string;
};

/**
 * Pure scoring. Mirrors computeTestScore() in private/api/test_token.php: answers are
 * upper-cased and trimmed before comparison and the score is a rounded percentage.
 * Client-safe (no I/O) so it can be unit-tested without the database.
 */
export function computeTestScore(
  questions: TestQuestion[],
  answers: Record<string, string>,
): { correct: number; total: number; score: number } {
  let correct = 0;
  questions.forEach((q, i) => {
    const submitted = (answers[String(i)] ?? "").toUpperCase().trim();
    if (submitted && submitted === q.answer) correct++;
  });
  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score };
}