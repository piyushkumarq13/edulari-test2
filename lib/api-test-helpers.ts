import { sql } from "@/lib/db/client";
import { saveRegSession } from "@/lib/instructor/reg-session";
import { saveInstructorApplication, type RegData } from "@/lib/db/instructor-registration";
import { deleteInstructorDocuments } from "@/lib/instructor/documents";
import {
  consumeTestToken,
  deleteTestToken,
  computeTestScore,
  recordTestFailure,
  TEST_PASS_SCORE,
  type TestTokenRow,
  type TestQuestion,
} from "@/lib/instructor/test-tokens";

/**
 * The scoring + finalisation half of public/test/index.php, shared by the GET resume path
 * (expired token) and the submit_test POST. The PHP called scoreAndFinalizeTest() from
 * three places; this is the single implementation both of them use.
 */

export interface TestResultSummary {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
  retry_date: string;
}

export interface TestState {
  token: string;
  valid: boolean;
  invalid: boolean;
  blocked: boolean;
  retry_after: string | null;
  phase: "intro" | "details" | "test";
  questions: TestQuestion[];
  answers: Record<string, string>;
  generate_error: string;
  error: string;
  result: TestResultSummary | null;
  test_title: string;
  test_badge_label: string;
  test_subject: string;
  test_level: string;
  redirect_pass: string;
  redirect_fail: string;
  redirect: string | null;
  remaining_secs: number;
  instructor_registration: boolean;
}

function baseState(token: string, row: Partial<TestTokenRow>, phase: TestState["phase"]): TestState {
  return {
    token,
    valid: true,
    invalid: false,
    blocked: false,
    retry_after: null,
    phase,
    questions: [],
    answers: {},
    generate_error: "",
    error: "",
    result: null,
    test_title: "Competency Test",
    test_badge_label: "📝 Test",
    test_subject: "",
    test_level: "",
    redirect_pass: row.redirect_pass ?? "/instructor-register-success",
    redirect_fail: row.redirect_fail ?? "/instructor-register",
    redirect: null,
    remaining_secs: 0,
    instructor_registration: (row.on_pass_action ?? "") === "instructor_registration",
  };
}

/**
 * Score the submitted answers, atomically consume the token, fire the pass/fail callback
 * and delete the token. Exactly one caller can win the consume, so a double submit cannot
 * score twice.
 */
export async function finalizeTest(
  tokenRow: TestTokenRow,
  submittedAnswers: Record<string, string>,
): Promise<TestState> {
  const { correct, total, score } = computeTestScore(tokenRow.questions_data ?? [], submittedAnswers);
  const passed = score >= TEST_PASS_SCORE;

  // Server clock is the only authority for time taken.
  const startedAt = tokenRow.started_at ?? new Date();
  const timeTaken = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

  const consumed = await consumeTestToken(tokenRow.token);
  if (!consumed) {
    await deleteTestToken(tokenRow.token);
    const s = baseState(tokenRow.token, tokenRow, "test");
    s.valid = false;
    s.invalid = true;
    s.error = "Your test session has expired. Please request a new test link.";
    s.redirect = tokenRow.redirect_fail;
    return s;
  }

  if (passed) {
    const regData = tokenRow.test_data as unknown as RegData;
    const result = await saveInstructorApplication(regData, score, timeTaken);
    if (result.ok) {
      await deleteTestToken(tokenRow.token);
      const s = baseState(tokenRow.token, tokenRow, "test");
      s.redirect = tokenRow.redirect_pass;
      // Tell the success page this account just applied.
      await saveRegSession({
        appSubmitted: true,
        pendingEmail: (regData.email as string) || "",
        testPassed: true,
        testScore: score,
      });
      return s;
    }
    const s = baseState(tokenRow.token, tokenRow, "test");
    s.questions = tokenRow.questions_data ?? [];
    s.answers = submittedAnswers;
    s.error = result.error ?? "Something went wrong saving your result. Please contact support.";
    return s;
  }

  const userId = tokenRow.user_id;
  await recordTestFailure(userId, tokenRow.started_ip ?? "", tokenRow.on_pass_action);

  const app = await sql<{ id: number; govt_id_file: string | null; marksheet_file: string | null }[]>`
    SELECT id, govt_id_file, marksheet_file FROM instructor_applications WHERE user_id = ${userId}`;
  if (app[0]) {
    await sql`
      UPDATE instructor_applications
      SET status = 'test_failed', test_score = ${score}, test_time_taken_seconds = ${timeTaken}
      WHERE id = ${app[0].id}`;
    await deleteInstructorDocuments(app[0]);
  } else {
    await sql`
      INSERT INTO instructor_applications (user_id, status, test_score, test_time_taken_seconds, submitted_at, updated_at)
      VALUES (${userId}, 'test_failed', ${score}, ${timeTaken}, now(), now())`;
  }

  await deleteTestToken(tokenRow.token);
  // Clear the wizard state so the applicant starts fresh on their next visit.
  await saveRegSession({ returnTo: null, resumeUserId: null, awaitingEmailVerify: false });

  const retryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const s = baseState(tokenRow.token, tokenRow, "test");
  s.questions = tokenRow.questions_data ?? [];
  s.answers = submittedAnswers;
  s.result = { passed: false, score, correct, total, retry_date: retryDate };
  return s;
}