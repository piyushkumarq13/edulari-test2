import "./helpers/env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@/lib/db/client";
import {
  createTestToken,
  validateTestToken,
  consumeTestToken,
  recordTestFailure,
  checkTestFailureBlock,
  cleanupExpiredTestTokens,
  markTestStarted,
  saveTestAnswers,
} from "@/lib/instructor/test-tokens";

/**
 * Token lifecycle tests. They run against the live test database. Because
 * createTestToken() guarantees at most one live token per (user, on_pass_action) - the
 * PHP design - each test gets its own throwaway user so the tests cannot interfere with
 * one another.
 */

const createdUserIds: number[] = [];

async function makeUser(label: string): Promise<number> {
  const email = `tok-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@edulari.test`;
  const rows = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, email_verified, is_active)
    VALUES ('Token Test', ${email}, 'x', 'instructor', true, false)
    RETURNING id`;
  const id = Number(rows[0].id);
  createdUserIds.push(id);
  return id;
}

afterAll(async () => {
  for (const id of createdUserIds) {
    await sql`DELETE FROM test_tokens WHERE user_id = ${id}`;
    await sql`DELETE FROM test_failures WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
});

const Q = (answer: string) => ({
  question: `Q${answer}`,
  options: { A: "a", B: "b", C: "c", D: "d" as const },
  answer,
});

describe("token creation", () => {
  let userId = 0;
  beforeAll(async () => { userId = await makeUser("create"); });

  it("creates an unstarted token", async () => {
    const token = await createTestToken(userId, { hello: "world" });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const row = await validateTestToken(token);
    expect(row).not.toBeNull();
    expect(row!.user_id).toBe(userId);
    expect(row!.used).toBe(false);
    expect(row!.started_at).toBeNull();
    // test_data must come back as an object, not a JSON string.
    expect(row!.test_data).toEqual({ hello: "world" });
  });

  it("replaces an unstarted token with a fresh one", async () => {
    const user2 = await makeUser("replace");
    const t1 = await createTestToken(user2, { attempt: 1 });
    const t2 = await createTestToken(user2, { attempt: 2 });
    expect(t2).not.toBe(t1);
    expect(await validateTestToken(t1)).toBeNull();
    expect((await validateTestToken(t2))!.test_data).toEqual({ attempt: 2 });
  });

  it("returns the existing token once started, so the test resumes", async () => {
    const user3 = await makeUser("resume");
    const token = await createTestToken(user3, { resume: true });
    await markTestStarted(token, [Q("A")], "1.2.3.4");
    expect(await createTestToken(user3, { resume: false })).toBe(token);
  });
});

describe("atomic consumption", () => {
  it("exactly one of 12 concurrent consumers wins", async () => {
    const userId = await makeUser("race");
    const token = await createTestToken(userId, { race: true });
    await markTestStarted(token, [Q("A"), Q("B")], "1.2.3.4");

    const attempts = await Promise.all(
      Array.from({ length: 12 }, () => consumeTestToken(token)),
    );
    expect(attempts.filter((r) => r !== null)).toHaveLength(1);
  });

  it("a consumed token no longer validates", async () => {
    const userId = await makeUser("consumed");
    const token = await createTestToken(userId, { once: true });
    await consumeTestToken(token);
    expect(await validateTestToken(token)).toBeNull();
  });

  it("an unstarted expired token does not validate", async () => {
    const userId = await makeUser("expired");
    const token = await createTestToken(userId, { exp: true });
    await sql`UPDATE test_tokens SET expires_at = now() - interval '1 minute' WHERE token = ${token}`;
    expect(await validateTestToken(token)).toBeNull();
  });

  it("a started-but-expired token still validates so it can be scored", async () => {
    const userId = await makeUser("started-expired");
    const token = await createTestToken(userId, { started: true });
    await markTestStarted(token, [Q("A")], "1.2.3.4");
    await sql`UPDATE test_tokens SET expires_at = now() - interval '1 minute' WHERE token = ${token}`;
    // PHP: used = 0 AND (expires_at > NOW() OR started_at IS NOT NULL)
    expect(await validateTestToken(token)).not.toBeNull();
  });
});

describe("autosave", () => {
  it("stores a valid answer and rejects a bad index or option", async () => {
    const userId = await makeUser("autosave");
    const token = await createTestToken(userId, { save: true });
    await markTestStarted(token, [Q("A"), Q("B")], "1.2.3.4");
    await sql`UPDATE test_tokens SET last_autosave_at = now() - interval '2 seconds' WHERE token = ${token}`;

    expect(await saveTestAnswers(token, 1, "B")).toEqual({ ok: true, reason: null });
    expect(await saveTestAnswers(token, 5, "A")).toEqual({ ok: false, reason: "invalid_question_index" });
    expect(await saveTestAnswers(token, 0, "Z")).toEqual({ ok: false, reason: "invalid_option" });
  });

  it("rate-limits a second save within one second", async () => {
    const userId = await makeUser("ratelimit");
    const token = await createTestToken(userId, { rate: true });
    await markTestStarted(token, [Q("A"), Q("B")], "1.2.3.4");
    await sql`UPDATE test_tokens SET last_autosave_at = now() - interval '2 seconds' WHERE token = ${token}`;
    expect((await saveTestAnswers(token, 0, "A")).ok).toBe(true);
    expect(await saveTestAnswers(token, 1, "B")).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("failure cooldown", () => {
  it("blocks the user for 7 days", async () => {
    const userId = await makeUser("cooldown");
    await recordTestFailure(userId, "9.9.9.9", "instructor_registration");
    const blocked = await checkTestFailureBlock(userId, "", "instructor_registration");
    expect(blocked.blocked).toBe(true);
    expect(blocked.retry_after).toBeTruthy();
  });

  it("blocks the IP even for a different user id", async () => {
    const userId = await makeUser("ipblock");
    await recordTestFailure(userId, "8.8.8.8", "instructor_registration");
    expect((await checkTestFailureBlock(0, "8.8.8.8", "instructor_registration")).blocked).toBe(true);
  });

  it("is scoped to the context", async () => {
    const userId = await makeUser("ctx");
    await recordTestFailure(userId, "7.7.7.7", "ctx_a");
    expect((await checkTestFailureBlock(userId, "7.7.7.7", "ctx_b")).blocked).toBe(false);
  });

  it("ignores a failure whose retry window has passed", async () => {
    const userId = await makeUser("expired-failure");
    await sql`
      INSERT INTO test_failures (user_id, ip_address, context, failed_at, retry_after)
      VALUES (${userId}, '6.6.6.6', 'instructor_registration', now() - interval '10 days', now() - interval '1 day')`;
    expect((await checkTestFailureBlock(userId, "6.6.6.6", "instructor_registration")).blocked).toBe(false);
  });
});

describe("time authority", () => {
  it("time taken is derived from started_at", async () => {
    const userId = await makeUser("time");
    const token = await createTestToken(userId, { time: true });
    await markTestStarted(token, [Q("A")], "1.2.3.4");
    await sql`UPDATE test_tokens SET started_at = now() - interval '90 seconds' WHERE token = ${token}`;
    const row = await validateTestToken(token);
    const timeTaken = Math.round((Date.now() - row!.started_at!.getTime()) / 1000);
    expect(timeTaken).toBeGreaterThanOrEqual(89);
    expect(timeTaken).toBeLessThanOrEqual(92);
  });

  it("markTestStarted cannot restart a started token", async () => {
    const userId = await makeUser("start-once");
    const token = await createTestToken(userId, { once: true });
    expect(await markTestStarted(token, [Q("A")], "1.2.3.4")).toBe(true);
    expect(await markTestStarted(token, [Q("B")], "5.6.7.8")).toBe(false);
    const row = await validateTestToken(token);
    expect(row!.questions_data).toEqual([Q("A")]);
    expect(row!.started_ip).toBe("1.2.3.4");
  });
});

describe("cleanup", () => {
  it("removes expired and consumed tokens plus stale failures", async () => {
    const userId = await makeUser("cleanup");
    const expired = await createTestToken(userId, { c1: true });
    await sql`UPDATE test_tokens SET expires_at = now() - interval '1 hour' WHERE token = ${expired}`;
    await sql`
      INSERT INTO test_failures (user_id, ip_address, context, failed_at, retry_after)
      VALUES (${userId}, '5.5.5.5', 'instructor_registration', now() - interval '10 days', now() - interval '1 day')`;

    const before = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM test_tokens WHERE user_id = ${userId}`;
    const res = await cleanupExpiredTestTokens();
    const after = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM test_tokens WHERE user_id = ${userId}`;
    expect(Number(after[0].c)).toBeLessThan(Number(before[0].c));
    expect(res.tokens).toBeGreaterThanOrEqual(1);
  });
});