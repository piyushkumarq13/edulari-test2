import { redirect } from "next/navigation";
import { getRegSession } from "@/lib/instructor/reg-session";
import { runInstructorMaintenance } from "@/lib/instructor/maintenance";
import { getSessionUser } from "@/lib/auth/guards";
import { redirectBasedOnRole } from "@/lib/auth/redirect";
import { loadInstructorDraft } from "@/lib/db/instructor-registration";
import { readCsrfToken } from "@/lib/security/csrf";
import { checkTestFailureBlock } from "@/lib/instructor/test-tokens";
import { formatRetryDate, resolveStepGuard } from "@/lib/instructor/wizard";
import { headers } from "next/headers";
import { sql } from "@/lib/db/client";
import type { RegData } from "@/lib/db/instructor-registration";

export interface StepPageState {
  csrf: string;
  step: number;
  displayStep: number;
  data: RegData;
  editMode: boolean;
  awaitingEmailVerify: boolean;
  resumeEmail: string;
  blockRetryDate: string;
  blocked: boolean;
  verified: boolean;
  categories: { id: number; name: string }[];
}

function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

/**
 * Shared guard + state loader for every wizard step page. Mirrors _init.php: redirect
 * logged-in users, recover/resume the session, run maintenance, compute the IP block and
 * expose the step label set. Returns the state a step page needs, or redirects when the
 * guard rejects the request.
 */
export async function loadStepPage(stepNumber: number): Promise<StepPageState> {
  const existing = await getSessionUser();
  if (existing) redirectBasedOnRole(existing.role);

  await runInstructorMaintenance();

  const { session, isNew } = await getRegSession();
  if (isNew) {
    redirect(`/api/reg-session?next=${encodeURIComponent(`/instructor-register/step-${stepNumber}`)}`);
  }

  const step = session.step;

  // Guard G3/G2/G4: step-1 forwards when the wizard is already past it; no step can be
  // reached before the step the applicant has actually completed.
  const blockedStep = resolveStepGuard(stepNumber, step);
  if (blockedStep !== null) {
    redirect(`/instructor-register/step-${blockedStep}`);
  }

  const csrf = await readCsrfToken();
  const ip = clientIp(await headers());
  const block = await checkTestFailureBlock(0, ip);

  let data: RegData = {};
  let verified = true;
  if (session.userId) {
    const draft = await loadInstructorDraft(session.userId);
    data = draft.data;
    const u = await sql<{ email_verified: boolean }[]>`SELECT email_verified FROM users WHERE id = ${session.userId}`;
    verified = Boolean(u[0]?.email_verified);
  }

  // Guard G6: an unverified email sends the applicant back to step 1.
  if (stepNumber >= 2 && session.userId && !verified) {
    const { saveRegSession } = await import("@/lib/instructor/reg-session");
    await saveRegSession({ step: 1, awaitingEmailVerify: true });
    redirect("/instructor-register/step-1");
  }

  const categories = await sql<{ id: number; name: string }[]>`
    SELECT id, name FROM categories ORDER BY name`;

  return {
    csrf,
    step,
    displayStep: stepNumber,
    data,
    editMode: (session.returnTo ?? 0) > 0,
    awaitingEmailVerify: session.awaitingEmailVerify,
    resumeEmail: session.resumeEmail,
    blockRetryDate: block.retry_after ? formatRetryDate(block.retry_after) : "",
    blocked: block.blocked,
    verified,
    categories,
  };
}