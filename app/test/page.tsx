import type { Metadata } from "next";
import "@/styles/css/auth/instructor-test.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { readCsrfToken } from "@/lib/security/csrf";
import { getSessionUser } from "@/lib/auth/guards";
import { redirectBasedOnRole } from "@/lib/auth/redirect";
import { headers } from "next/headers";
import { validateTestToken, checkTestFailureBlock, TEST_TOKEN_TTL_MINS } from "@/lib/instructor/test-tokens";
import { finalizeTest } from "@/lib/api-test-helpers";
import TestClient, { type TestClientProps } from "@/components/instructor/TestClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Competency Test – Edulari",
  description: "Instructor competency test.",
  noindex: true,
  canonical: false,
});

const EMPTY: TestClientProps = {
  csrf: "",
  token: "",
  valid: false,
  invalid: true,
  blocked: false,
  retry_after: null,
  phase: "intro",
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
  redirect: "/",
  remaining_secs: 0,
  instructor_registration: false,
};

/** Server clock, captured outside the component body. */
function nowMs(): number {
  return new Date().getTime();
}

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const token = (params.token ?? "").trim();

  const existing = await getSessionUser();
  if (existing) redirectBasedOnRole(existing.role);

  const csrf = await readCsrfToken();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  // Captured once: the server clock is the only authority for time.
  const now = nowMs();

  if (!token) {
    return <TestClient {...EMPTY} csrf={csrf} />;
  }

  const row = await validateTestToken(token);
  if (!row) {
    return <TestClient {...EMPTY} token={token} csrf={csrf} />;
  }

  // A started token that has already expired is scored and finalised on the GET, exactly
  // as the PHP did.
  if (row.started_at && row.expires_at.getTime() <= now) {
    const state = await finalizeTest(row, row.answers_data ?? {});
    return <TestClient {...state} csrf={csrf} />;
  }

  const block = await checkTestFailureBlock(row.user_id, ip, row.on_pass_action);
  const competency = (row.test_data.competency ?? {}) as Record<string, unknown>;

  const props: TestClientProps = {
    csrf,
    token,
    valid: true,
    invalid: false,
    blocked: block.blocked,
    retry_after: block.retry_after,
    phase: row.started_at ? "test" : "intro",
    questions: row.questions_data ?? [],
    answers: row.answers_data ?? {},
    generate_error: "",
    error: "",
    result: null,
    test_title: (row.test_data.test_title as string) || "Competency Test",
    test_badge_label: (row.test_data.test_badge_label as string) || "📝 Test",
    test_subject: (competency.primary_subject as string) || ((row.test_data.subject as string) ?? ""),
    test_level: (competency.skill_level as string) || ((row.test_data.level as string) ?? ""),
    redirect_pass: row.redirect_pass,
    redirect_fail: row.redirect_fail,
    redirect: null,
    remaining_secs: row.started_at
      ? Math.max(0, Math.round((row.expires_at.getTime() - now) / 1000))
      : TEST_TOKEN_TTL_MINS * 60,
    instructor_registration: row.on_pass_action === "instructor_registration",
  };

  return <TestClient {...props} />;
}