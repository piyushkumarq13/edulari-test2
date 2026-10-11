import crypto from "node:crypto";
import { sql } from "@/lib/db/client";
import { logSecurity } from "@/lib/security/events";
import {
  TEST_TOKEN_TTL_SECS,
  AUTOSAVE_MIN_INTERVAL_SECS,
  FAILURE_BLOCK_SECS,
  type TestQuestion,
  computeTestScore,
} from "./test-constants";

export {
  TEST_PASS_SCORE,
  TEST_TOKEN_TTL_MINS,
  TEST_TOKEN_TTL_SECS,
  TEST_QUESTION_COUNT,
  FAILURE_BLOCK_SECS,
  AUTOSAVE_MIN_INTERVAL_SECS,
} from "./test-constants";
export type { TestQuestion } from "./test-constants";
export { computeTestScore } from "./test-constants";

export type TestTokenRow = {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  used: boolean;
  started_at: Date | null;
  questions_data: TestQuestion[] | null;
  answers_data: Record<string, string> | null;
  started_ip: string | null;
  last_autosave_at: Date | null;
  test_data: Record<string, unknown>;
  on_pass_action: string;
  redirect_pass: string;
  redirect_fail: string;
  created_at: Date;
};

export type BlockStatus = { blocked: boolean; retry_after: string | null };

function rowToToken(r: Record<string, unknown>): TestTokenRow {
  return {
    id: Number(r.id),
    user_id: Number(r.user_id),
    token: r.token as string,
    expires_at: new Date(r.expires_at as string),
    used: Boolean(r.used),
    started_at: r.started_at ? new Date(r.started_at as string) : null,
    questions_data: (r.questions_data as TestQuestion[]) ?? null,
    answers_data: (r.answers_data as Record<string, string>) ?? null,
    started_ip: (r.started_ip as string) || null,
    last_autosave_at: r.last_autosave_at ? new Date(r.last_autosave_at as string) : null,
    test_data: (r.test_data as Record<string, unknown>) ?? {},
    on_pass_action: (r.on_pass_action as string) ?? "instructor_registration",
    redirect_pass: (r.redirect_pass as string) ?? "/instructor-register-success",
    redirect_fail: (r.redirect_fail as string) ?? "/instructor-register",
    created_at: new Date(r.created_at as string),
  };
}

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create (or resume) a test token for a user. Any previous token that was created but never
 * started is deleted so a fresh one can be created; a token that has already been started is
 * returned so the caller redirects into the in-progress test.
 * Mirrors createTestToken().
 */
export async function createTestToken(
  userId: number,
  testData: Record<string, unknown>,
  onPassAction = "instructor_registration",
  redirectPass = "/instructor-register-success",
  redirectFail = "/instructor-register/step-8",
): Promise<string> {
  const existing = await sql<{ token: string; started_at: Date | null }[]>`
    SELECT token, started_at FROM test_tokens WHERE user_id = ${userId} AND on_pass_action = ${onPassAction}`;
  if (existing[0]) {
    const startedAt = await sql<{ started_at: Date | null }[]>`
      SELECT started_at FROM test_tokens WHERE token = ${existing[0].token}`;
    if (startedAt[0] && startedAt[0].started_at !== null) {
      return existing[0].token;
    }
    await sql`DELETE FROM test_tokens WHERE user_id = ${userId} AND on_pass_action = ${onPassAction}`;
  }

  const token = newToken();
  await sql`
    INSERT INTO test_tokens (user_id, token, expires_at, used, test_data, on_pass_action, redirect_pass, redirect_fail)
    VALUES (
      ${userId}, ${token}, now() + (${TEST_TOKEN_TTL_SECS} || ' seconds')::interval, false,
      ${sql.json(testData as never)}, ${onPassAction}, ${redirectPass}, ${redirectFail}
    )`;
  return token;
}

/**
 * Validate a token. A token is usable while it is unused AND (not yet started OR not yet
 * expired) — exactly the PHP `used = 0 AND (expires_at > NOW() OR started_at IS NOT NULL)`.
 */
export async function validateTestToken(token: string): Promise<TestTokenRow | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM test_tokens
    WHERE token = ${token} AND used = false AND (expires_at > now() OR started_at IS NOT NULL)`;
  return rows[0] ? rowToToken(rows[0]) : null;
}

/**
 * Atomically consume a token. The single `UPDATE ... WHERE used = false` returning the row
 * is the only writer that can win, so concurrent submissions cannot both score.
 * Mirrors consumeTestToken().
 */
export async function consumeTestToken(token: string): Promise<TestTokenRow | null> {
  const rows = await sql<Record<string, unknown>[]>`
    UPDATE test_tokens SET used = true WHERE token = ${token} AND used = false RETURNING *`;
  return rows[0] ? rowToToken(rows[0]) : null;
}

export async function deleteTestToken(token: string): Promise<void> {
  await sql`DELETE FROM test_tokens WHERE token = ${token}`;
}

/**
 * Mark a test as started: set started_at, questions_data and started_ip, and restart the TTL
 * from now. The `AND started_at IS NULL` guard makes a double-start a no-op.
 * Mirrors markTestStarted().
 */
export async function markTestStarted(
  token: string,
  questions: TestQuestion[],
  ip: string,
): Promise<boolean> {
  const rows = await sql<Record<string, unknown>[]>`
    UPDATE test_tokens
    SET started_at = now(),
        expires_at = now() + (${TEST_TOKEN_TTL_SECS} || ' seconds')::interval,
        questions_data = ${sql.json(questions)},
        started_ip = ${ip}
    WHERE token = ${token} AND started_at IS NULL
    RETURNING id`;
  return rows.length === 1;
}

export type SaveAnswerResult = { ok: boolean; reason: string | null };

/**
 * Save one answer during an active test. Rate-limited to one write per second by
 * last_autosave_at. Mirrors saveTestAnswers().
 */
export async function saveTestAnswers(
  token: string,
  questionIndex: number,
  optionLetter: string,
): Promise<SaveAnswerResult> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT questions_data, answers_data, last_autosave_at FROM test_tokens WHERE token = ${token}`;
  const row = rows[0];
  if (!row) return { ok: false, reason: "token_not_found" };

  const questions = (row.questions_data as TestQuestion[]) ?? [];
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= questions.length) {
    return { ok: false, reason: "invalid_question_index" };
  }

  const letter = optionLetter.trim().toUpperCase();
  if (!questions[questionIndex].options[letter as "A" | "B" | "C" | "D"]) {
    return { ok: false, reason: "invalid_option" };
  }

  if (row.last_autosave_at) {
    const last = new Date(row.last_autosave_at as string).getTime();
    if (Date.now() - last < AUTOSAVE_MIN_INTERVAL_SECS * 1000) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  const answers = ((row.answers_data as Record<string, string>) ?? {}) as Record<string, string>;
  answers[String(questionIndex)] = letter;

  await sql`
    UPDATE test_tokens
    SET answers_data = ${sql.json(answers)}, last_autosave_at = now(), answers_updated_at = now()
    WHERE token = ${token}`;

  return { ok: true, reason: null };
}

/**
 * Record a failure for a user+IP and set a 7-day cooldown. Any previous failure row for the
 * same user OR ip is removed first. Mirrors recordTestFailure().
 */
export async function recordTestFailure(
  userId: number,
  ip: string,
  context = "instructor_registration",
): Promise<void> {
  await sql`
    DELETE FROM test_failures WHERE (user_id = ${userId} OR ip_address = ${ip}) AND context = ${context}`;
  await sql`
    INSERT INTO test_failures (user_id, ip_address, context, failed_at, retry_after)
    VALUES (${userId}, ${ip}, ${context}, now(), now() + (${FAILURE_BLOCK_SECS} || ' seconds')::interval)`;
}

/**
 * Whether a user OR an IP is currently blocked. Mirrors checkTestFailureBlock().
 */
export async function checkTestFailureBlock(
  userId: number,
  ip: string,
  context = "instructor_registration",
): Promise<BlockStatus> {
  const rows = await sql<{ retry_after: string }[]>`
    SELECT retry_after FROM test_failures
    WHERE (user_id = ${userId} OR ip_address = ${ip}) AND context = ${context} AND retry_after > now()
    ORDER BY retry_after DESC LIMIT 1`;
  return rows[0] ? { blocked: true, retry_after: rows[0].retry_after } : { blocked: false, retry_after: null };
}

export interface AbandonedResult {
  processed: number;
  failures: number;
}

/**
 * Find and score abandoned (expired, never-submitted) tokens. Always a fail path.
 * Mirrors findAndScoreAbandonedTestTokens().
 */
export async function findAndScoreAbandonedTestTokens(
  onFailure: (userId: number, score: number, timeTaken: number, ip: string) => Promise<void>,
): Promise<AbandonedResult> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM test_tokens WHERE used = false AND started_at IS NOT NULL AND now() > expires_at`;
  if (!rows.length) return { processed: 0, failures: 0 };

  let processed = 0;
  let failures = 0;
  for (const r of rows) {
    const token = r.token as string;
    const questions = ((r.questions_data as TestQuestion[]) ?? []);
    const answers = ((r.answers_data as Record<string, string>) ?? {});
    const { score } = computeTestScore(questions, answers);
    const startedAt = new Date(r.started_at as string);
    const timeTaken = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

    const consumed = await consumeTestToken(token);
    if (!consumed) continue;

    await recordTestFailure(Number(r.user_id), (r.started_ip as string) || "", consumed.on_pass_action);
    await onFailure(Number(r.user_id), score, timeTaken, (r.started_ip as string) || "");
    await deleteTestToken(token);
    processed++;
    failures++;
  }
  return { processed, failures };
}

/**
 * Delete expired/consumed tokens and stale failure rows.
 * Mirrors the test_tokens / test_failures half of cleanupExpiredTokens().
 */
export async function cleanupExpiredTestTokens(): Promise<{ tokens: number; failures: number }> {
  const tokens = await sql`DELETE FROM test_tokens WHERE expires_at < now() OR used = true RETURNING id`;
  const failures = await sql`DELETE FROM test_failures WHERE retry_after < now() RETURNING id`;
  return { tokens: tokens.length, failures: failures.length };
}

export { logSecurity };
