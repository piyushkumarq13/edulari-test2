import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { issueEmailVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/senders";
import { getRegSession, saveRegSession } from "@/lib/instructor/reg-session";
import {
  loadInstructorDraft,
  saveInstructorDraft,
  isInstructorRegistrationResumable,
} from "@/lib/db/instructor-registration";
import { createTestToken, checkTestFailureBlock } from "@/lib/instructor/test-tokens";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  resolveStepGuard,
  isEditableStep,
} from "@/lib/instructor/wizard";
import type { RegData } from "@/lib/db/instructor-registration";

export const dynamic = "force-dynamic";

interface StepResult {
  ok: boolean;
  error?: string;
  redirect?: string;
  step?: number;
  data?: RegData;
  block?: { blocked: boolean; retry_after: string | null };
}

function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error } satisfies StepResult, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ n: string }> },
) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > 8) return fail("Not found.", 404);

  if (!isSameOriginPost(request)) return fail("Invalid origin.", 403);

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let fields: Record<string, string> = {};
  const files: Record<string, File> = {};
  try {
    if (isMultipart) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) {
        if (v instanceof File) files[k] = v;
        else fields[k] = String(v);
      }
    } else {
      fields = Object.fromEntries(await request.formData()) as Record<string, string>;
    }
  } catch {
    return fail("Invalid request. Please refresh and try again.");
  }

  if (!verifyCsrfToken(await readCsrfToken(), fields.csrf_token ?? "")) {
    return fail("Invalid request. Please refresh and try again.", 403);
  }

  const { session } = await getRegSession();
  const step = session.step;
  const userId = session.userId ?? 0;

  // Guard G2/G3/G4: cannot jump ahead; step-1 forwards when already past.
  const blockedStep = resolveStepGuard(n, step);
  if (blockedStep !== null) {
    return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${blockedStep}` } satisfies StepResult);
  }

  const action = fields.action ?? "";

  // ── step 1 ────────────────────────────────────────────────────────────────
  if (n === 1) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const block = await checkTestFailureBlock(0, ip);
    if (block.blocked && !fields.check_email_verified && !fields.resume_password_submit && action !== "cancel_resume") {
      return NextResponse.json({
        ok: true,
        block: { blocked: true, retry_after: block.retry_after },
      } satisfies StepResult);
    }

    if (fields.check_email_verified) {
      if (!userId) return fail("Session expired. Please start over.");
      const u = await sql<{ email_verified: boolean }[]>`
        SELECT email_verified FROM users WHERE id = ${userId}`;
      if (u[0]?.email_verified) {
        await saveRegSession({ awaitingEmailVerify: false, step: 2 });
        return NextResponse.json({ ok: true, redirect: "/instructor-register/step-2", step: 2 } satisfies StepResult);
      }
      return fail("Your email has not been verified yet. Please click the link in the verification email first.");
    }

    if (fields.resume_password_submit) {
      const resumeUserId = session.resumeUserId ?? 0;
      const entered = fields.resume_password ?? "";
      if (!resumeUserId) return fail("Your session expired. Please enter your email again.");
      const u = await sql<{ id: number; password: string; email: string }[]>`
        SELECT id, password, email FROM users WHERE id = ${resumeUserId}`;
      if (!u[0] || !(await verifyPassword(entered, u[0].password))) {
        return fail("Incorrect password. Please try again.");
      }
      if (!(await isInstructorRegistrationResumable(resumeUserId))) {
        await saveRegSession({ resumeUserId: null, resumeEmail: "" });
        return fail('This account can no longer be resumed here. Please <a href="/login">sign in</a> instead.');
      }
      const draft = await loadInstructorDraft(resumeUserId);
      await saveRegSession({
        userId: resumeUserId,
        step: draft.step,
        resumeUserId: null,
        resumeEmail: "",
        awaitingEmailVerify: false,
      });
      return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${draft.step}`, step: draft.step } satisfies StepResult);
    }

    if (action === "cancel_resume") {
      await saveRegSession({ resumeUserId: null, resumeEmail: "" });
      return NextResponse.json({ ok: true, redirect: "/instructor-register/step-1" } satisfies StepResult);
    }

    // Create a new account.
    const parsed = step1Schema.safeParse({
      name: fields.name ?? "",
      email: fields.email ?? "",
      password: fields.password ?? "",
      confirm_password: fields.confirm_password ?? "",
    });
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Please fill in all required fields.");
    }
    const { name, email, password } = parsed.data;

    const existing = await sql<{ id: number; email_verified: boolean; role: string }[]>`
      SELECT id, email_verified, role FROM users WHERE email = ${email}`;

    if (existing[0] && existing[0].email_verified && existing[0].role === "instructor"
        && (await isInstructorRegistrationResumable(existing[0].id))) {
      await saveRegSession({ resumeUserId: existing[0].id, resumeEmail: email });
      return NextResponse.json({ ok: true, redirect: "/instructor-register/step-1", step: 1, data: { email } } satisfies StepResult);
    }
    if (existing[0] && existing[0].email_verified) {
      return fail('This email address is already registered. Please <a href="/login">sign in</a> instead.');
    }

    if (existing[0]) {
      await sql`DELETE FROM users WHERE id = ${existing[0].id}`;
      await sql`DELETE FROM email_verification_tokens WHERE user_id = ${existing[0].id}`;
    }

    const passwordHash = await hashPassword(password);
    const inserted = await sql<{ id: number }[]>`
      INSERT INTO users (name, email, password, role, registration_date, email_verified, is_active)
      VALUES (${name}, ${email}, ${passwordHash}, 'instructor', now(), false, false)
      RETURNING id`;
    const newUserId = Number(inserted[0]?.id ?? 0);
    if (!newUserId) return fail("Registration failed. Please try again later.");

    const token = await issueEmailVerificationToken(newUserId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const sent = await sendVerificationEmail(email, name, `${siteUrl}/verify-email?token=${token}`);
    if (!sent.ok) {
      await sql`DELETE FROM users WHERE id = ${newUserId}`;
      return fail(sent.error || "Registration failed. Please try again later.");
    }

    await saveRegSession({
      userId: newUserId,
      step: 1,
      awaitingEmailVerify: true,
      pendingEmail: email,
    });
    return NextResponse.json({
      ok: true, redirect: "/instructor-register/step-1", step: 1,
      data: { user_id: newUserId, name, email },
    } satisfies StepResult);
  }

  // Steps 2-8 all require a verified email (G6).
  if (!userId) return fail("Session expired. Please start registration again.");
  const u = await sql<{ email_verified: boolean }[]>`SELECT email_verified FROM users WHERE id = ${userId}`;
  if (!u[0]?.email_verified) {
    await saveRegSession({ step: 1, awaitingEmailVerify: true });
    return NextResponse.json({ ok: true, redirect: "/instructor-register/step-1", step: 1 } satisfies StepResult);
  }

  // ── steps 2-5: save draft, advance ───────────────────────────────────────
  if (n >= 2 && n <= 5) {
    if (action === "back") {
      const dest = n - 1;
      if (session.returnTo) {
        const rt = session.returnTo;
        await saveRegSession({ returnTo: null });
        return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${rt}`, step: rt } satisfies StepResult);
      }
      await saveRegSession({ step: dest });
      return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${dest}`, step: dest } satisfies StepResult);
    }

    let patch: Partial<RegData> = {};
    let error = "";
    if (n === 2) {
      const p = step2Schema.safeParse(fields);
      if (!p.success) error = p.error.issues[0]?.message ?? "Professional headline and bio are required.";
      else patch = { profile: { headline: p.data.headline, bio: p.data.bio, website: p.data.website, linkedin: p.data.linkedin, twitter: p.data.twitter, years_exp: p.data.years_exp, teaching_style: p.data.teaching_style } };
    } else if (n === 3) {
      const p = step3Schema.safeParse(fields);
      if (!p.success) error = p.error.issues[0]?.message ?? "Education details (degree, institution, field of study) are required.";
      else patch = { credentials: { highest_education: p.data.highest_education, institution: p.data.institution, field_of_study: p.data.field_of_study, graduation_year: p.data.graduation_year === "" ? null : (p.data.graduation_year ?? null), certifications: p.data.certifications, professional_exp: p.data.professional_exp, notable_works: p.data.notable_works } };
    } else if (n === 4) {
      const p = step4Schema.safeParse(fields);
      if (!p.success) error = p.error.issues[0]?.message ?? "Primary subject, skill level, and target audience are required.";
      else patch = { competency: { primary_subject: p.data.primary_subject, secondary_subjects: p.data.secondary_subjects, skill_level: p.data.skill_level, target_audience: p.data.target_audience, course_ideas: p.data.course_ideas, sample_content: p.data.sample_content } };
    } else {
      const p = step5Schema.safeParse(fields);
      if (!p.success) error = p.error.issues[0]?.message ?? "Please fill in all payout fields.";
      else patch = { legal: { full_legal_name: fields.full_legal_name ?? "", pan_number: p.data.pan_number, bank_name: p.data.bank_name, account_number: p.data.account_number, ifsc_code: p.data.ifsc_code, account_holder: p.data.account_holder, upi_id: fields.upi_id ?? "", skip_payout: p.data.skip_payout ? 1 : 0, revenue_share_ack: p.data.agree_revenue ? 1 : 0, terms_agreed: p.data.agree_terms ? 1 : 0, content_policy: 1 } };
    }

    if (error) return fail(error);

    const data = await loadInstructorDraft(userId);
    const merged: RegData = { ...data.data, ...patch, user_id: userId, name: data.data.name, email: data.data.email };
    await saveInstructorDraft(userId, merged, Math.max(step, n));

    if (session.returnTo) {
      const rt = session.returnTo;
      await saveRegSession({ returnTo: null });
      return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${rt}`, step: rt } satisfies StepResult);
    }
    const next = n + 1;
    await saveRegSession({ step: next });
    return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${next}`, step: next } satisfies StepResult);
  }

  // ── step 6: review ─────────────────────────────────────────────────────
  if (n === 6) {
    if (action.startsWith("edit_step_")) {
      const target = Number(action.slice("edit_step_".length));
      if (isEditableStep(target)) {
        await saveRegSession({ returnTo: 6 });
        return NextResponse.json({ ok: true, redirect: `/instructor-register/step-${target}`, step } satisfies StepResult);
      }
    }
    if (action === "continue") {
      await saveRegSession({ step: 7 });
      return NextResponse.json({ ok: true, redirect: "/instructor-register/step-7", step: 7 } satisfies StepResult);
    }
    return fail("Invalid request. Please refresh and try again.");
  }

  // ── step 7: documents ───────────────────────────────────────────────────
  if (n === 7) {
    if (action === "back") {
      await saveRegSession({ step: 6 });
      return NextResponse.json({ ok: true, redirect: "/instructor-register/step-6", step: 6 } satisfies StepResult);
    }

    const { storeInstructorDocument } = await import("@/lib/instructor/documents");
    const existingDocs = (await loadInstructorDraft(userId)).data.documents;
    const errors: string[] = [];
    const saved: { govt_id_file: string; marksheet_file: string } = {
      govt_id_file: existingDocs?.govt_id_file ?? "",
      marksheet_file: existingDocs?.marksheet_file ?? "",
    };

    for (const [field, label, key] of [
      ["govt_id", "Government ID", "govt_id_file"],
      ["marksheet", "Marksheet / Degree", "marksheet_file"],
    ] as const) {
      const file = files[field];
      if (!file || file.size === 0) {
        if (!saved[key]) errors.push(`${label} is required.`);
        continue;
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const { scanUpload } = await import("@/lib/storage/upload-validation");
      const res = scanUpload(buf, ["image/jpeg", "image/png", "image/webp", "applicationPdf"], "instructor_docs", 5 * 1024 * 1024);
      if (!res.safe) {
        errors.push(`${label}: ${res.message}`);
        continue;
      }
      const doc = await storeInstructorDocument(key, userId, file.name, buf, res.mime);
      saved[key] = doc.key;
    }

    if (errors.length) return fail(errors.join("\n"));

    const data = await loadInstructorDraft(userId);
    await saveInstructorDraft(userId, { ...data.data, documents: saved, user_id: userId }, 7);
    await saveRegSession({ step: 8 });
    return NextResponse.json({ ok: true, redirect: "/instructor-register/step-8", step: 8 } satisfies StepResult);
  }

  // ── step 8: test preview ────────────────────────────────────────────────
  if (n === 8) {
    if (action === "back") {
      await saveRegSession({ step: 7 });
      return NextResponse.json({ ok: true, redirect: "/instructor-register/step-7", step: 7 } satisfies StepResult);
    }
    if (action !== "start_test") return fail("Invalid request. Please refresh and try again.");

    const attempt = await sql<{ test_attempt_started_at: Date | null }[]>`
      SELECT test_attempt_started_at FROM instructor_applications WHERE user_id = ${userId}`;
    if (attempt[0]?.test_attempt_started_at) {
      const live = await sql<{ token: string }[]>`
        SELECT token FROM test_tokens
        WHERE user_id = ${userId} AND on_pass_action = 'instructor_registration'
          AND started_at IS NOT NULL AND used = false`;
      if (live[0]) {
        return NextResponse.json({ ok: true, redirect: `/test?token=${encodeURIComponent(live[0].token)}` } satisfies StepResult);
      }
      return fail("This account has already completed its one competency test attempt.");
    }

    const existing = await sql<{ token: string; started_at: Date | null }[]>`
      SELECT token, started_at FROM test_tokens
      WHERE user_id = ${userId} AND on_pass_action = 'instructor_registration'`;
    if (existing[0]?.started_at) {
      return NextResponse.json({ ok: true, redirect: `/test?token=${encodeURIComponent(existing[0].token)}` } satisfies StepResult);
    }

    const data = await loadInstructorDraft(userId);
    const regData: RegData = {
      ...data.data,
      user_id: userId,
      test_title: "Instructor Competency Test",
      test_badge_label: "📝 Competency Test",
    };
    const token = await createTestToken(userId, regData as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, redirect: `/test?token=${encodeURIComponent(token)}` } satisfies StepResult);
  }

  return fail("Not found.", 404);
}
