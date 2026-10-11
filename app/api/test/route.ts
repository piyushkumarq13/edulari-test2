import { NextResponse } from "next/server";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import {
  validateTestToken,
  markTestStarted,
  TEST_PASS_SCORE,
} from "@/lib/instructor/test-tokens";
import { generateTestQuestions } from "@/lib/ai/question-generator";
import { finalizeTest, type TestState } from "@/lib/api-test-helpers";
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

function baseState(token: string, phase: TestState["phase"] = "intro"): TestState {
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
    redirect_pass: "/instructor-register-success",
    redirect_fail: "/instructor-register",
    redirect: null,
    remaining_secs: 0,
    instructor_registration: false,
  };
}

/** Generate questions and mark the test started. Mirrors the go_start branch. */
async function startTest(token: string, ip: string): Promise<TestState> {
  const row = await validateTestToken(token);
  if (!row) {
    const s = baseState(token);
    s.valid = false;
    s.invalid = true;
    s.error = "Your test link is invalid or has expired. Please try again.";
    s.redirect = "/";
    return s;
  }

  const competency = (row.test_data.competency ?? {}) as Record<string, unknown>;
  const decorate = (s: TestState): TestState => {
    s.test_title = (row.test_data.test_title as string) || "Competency Test";
    s.test_badge_label = (row.test_data.test_badge_label as string) || "📝 Test";
    s.test_subject = (competency.primary_subject as string) || ((row.test_data.subject as string) ?? "");
    s.test_level = (competency.skill_level as string) || ((row.test_data.level as string) ?? "");
    s.redirect_pass = row.redirect_pass;
    s.redirect_fail = row.redirect_fail;
    s.instructor_registration = row.on_pass_action === "instructor_registration";
    return s;
  };

  if (row.started_at) {
    const s = decorate(baseState(token, "test"));
    s.questions = row.questions_data ?? [];
    s.answers = row.answers_data ?? {};
    s.remaining_secs = Math.max(0, Math.round((row.expires_at.getTime() - Date.now()) / 1000));
    return s;
  }

  let questions;
  try {
    questions = await generateTestQuestions(row.test_data as unknown as Record<string, unknown>);
  } catch (err) {
    const s = decorate(baseState(token, "details"));
    s.generate_error = `Test generation failed: ${err instanceof Error ? err.message : String(err)}`;
    return s;
  }

  await markTestStarted(token, questions, ip);
  if (row.on_pass_action === "instructor_registration") {
    await sql`
      UPDATE instructor_applications SET test_attempt_started_at = now() WHERE user_id = ${row.user_id}`;
  }

  const s = decorate(baseState(token, "test"));
  s.questions = questions;
  s.remaining_secs = 30 * 60;
  return s;
}

/** go_details / go_start / submit_test */
export async function POST(request: Request) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ ok: false, error: "Invalid origin." }, { status: 403 });
  }
  const fd = await request.formData().catch(() => null);
  if (!fd) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const token = String(fd.get("token") ?? "").trim();
  if (!verifyCsrfToken(await readCsrfToken(), String(fd.get("csrf_token") ?? ""))) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please refresh and try again." }, { status: 403 });
  }

  const action = String(fd.get("action") ?? "");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

  if (action === "go_start") {
    return NextResponse.json({ ok: true, state: await startTest(token, ip) });
  }

  if (action === "submit_test") {
    const row = await validateTestToken(token);
    if (!row) {
      return NextResponse.json({ ok: true, error: "Your test session has expired. Please request a new test link." });
    }
    if (!row.questions_data?.length) {
      return NextResponse.json({ ok: true, error: "No questions found. Please go back and try again." });
    }
    const answers: Record<string, string> = {};
    row.questions_data.forEach((_, i) => {
      const v = String(fd.get(`q_${i}`) ?? "").toUpperCase().trim();
      if (v) answers[String(i)] = v;
    });
    return NextResponse.json({ ok: true, state: await finalizeTest(row, answers) });
  }

  return NextResponse.json({ ok: true });
}

export { TEST_PASS_SCORE };