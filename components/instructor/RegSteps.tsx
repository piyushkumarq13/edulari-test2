"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegData } from "@/lib/db/instructor-registration";
import {
  YEARS_EXP_OPTIONS,
  TEACHING_STYLES,
  EDUCATION_LEVELS,
  SKILL_LEVELS,
  YEARS_EXP_REVIEW,
} from "@/lib/instructor/wizard";

export interface StepResult {
  ok: boolean;
  error?: string;
  redirect?: string;
  step?: number;
  data?: RegData;
  block?: { blocked: boolean; retry_after: string | null };
}

async function postStep(n: number, body: Record<string, string | FormDataEntryValue>, csrf: string): Promise<StepResult> {
  const fd = new FormData();
  fd.set("csrf_token", csrf);
  for (const [k, v] of Object.entries(body)) fd.set(k, v as string);
  const res = await fetch(`/api/instructor-register/step/${n}`, { method: "POST", body: fd });
  const json = (await res.json()) as StepResult;
  return json;
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
export function Step1Form({ csrf, data }: { csrf: string; data?: RegData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const json = await postStep(1, Object.fromEntries(fd.entries()) as Record<string, string>, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.block?.blocked) return router.refresh();
    if (json.error) setError(json.error);
    router.refresh();
  };

  return (
    <form onSubmit={submit} action="/api/instructor-register/step/1">
      <input type="hidden" name="csrf_token" value={csrf} />
      <div className="form-group">
        <label htmlFor="name">Full Name <span className="req">*</span></label>
        <input type="text" id="name" name="name" placeholder="What should students call you?"
               defaultValue={data?.name ?? ""} required autoComplete="name" />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email Address <span className="req">*</span></label>
        <input type="email" id="email" name="email" placeholder="you@example.com"
               defaultValue={data?.email ?? ""} required autoComplete="email" />
        <div className="field-hint">This will be your login email</div>
      </div>
      <div className="form-group">
        <label htmlFor="password">Password <span className="req">*</span></label>
        <div className="input-password-wrap">
          <input type="password" id="password" name="password" placeholder="At least 8 characters"
                 required autoComplete="new-password" />
          <button type="button" className="toggle-password" data-toggle-pw="password">🙈</button>
        </div>
        <div className="field-hint">Must include letters and at least one number</div>
      </div>
      <div className="form-group">
        <label htmlFor="confirm_password">Confirm Password <span className="req">*</span></label>
        <div className="input-password-wrap">
          <input type="password" id="confirm_password" name="confirm_password"
                 placeholder="Repeat your password" required autoComplete="new-password" />
          <button type="button" className="toggle-password" data-toggle-pw="confirm_password">🙈</button>
        </div>
      </div>
      <div className="form-check">
        <input type="checkbox" id="terms" name="terms" required />
        <label htmlFor="terms">I agree to the <a href="#" target="_blank">Terms of Service</a> and <a href="#" target="_blank">Privacy Policy</a></label>
      </div>
      {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span>{error}</div>}
      <button type="submit" className="btn-primary" disabled={busy}>Continue →</button>
    </form>
  );
}

export function VerifyEmailGate({ csrf, email }: { csrf: string; email: string }) {
  const router = useRouter();
  return (
    <div className="email-verify-gate">
      <div className="verify-icon">📧</div>
      <p className="verify-msg">
        We sent a verification link to<br />
        <strong>{email}</strong>
      </p>
      <p className="verify-sub">Please click the link in that email, then come back here and click the button below to continue.</p>
      <form action="/api/instructor-register/step/1" method="post">
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="check_email_verified" value="1" />
        <button type="submit" className="btn-primary">I&apos;ve Verified My Email — Continue →</button>
      </form>
      <div className="alert alert-info" style={{ marginTop: 16, textAlign: "left" }}>
        <span className="alert-icon">💾</span>
        <span>Your progress is saved — you can return any time using this email address.</span>
      </div>
      <p className="verify-resend">
        Didn&apos;t receive it? Check your spam folder, or{" "}
        <a href="/instructor-register/step-1" onClick={(e) => { e.preventDefault(); router.refresh(); }}>
          start over
        </a>.
      </p>
    </div>
  );
}

export function ResumeGate({ csrf, email }: { csrf: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const json = await postStep(1, {
      resume_password_submit: "1",
      resume_password: String(fd.get("resume_password") ?? ""),
    }, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.error) setError(json.error);
  };

  const cancel = async () => {
    await postStep(1, { action: "cancel_resume" }, csrf);
    router.refresh();
  };

  return (
    <div className="email-verify-gate">
      <div className="verify-icon">🔐</div>
      <p className="verify-msg">
        We found an unfinished instructor registration for<br />
        <strong>{email}</strong>
      </p>
      <p className="verify-sub">Enter your password to continue exactly where you left off.</p>
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={submit}>
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="resume_password_submit" value="1" />
        <div className="form-group">
          <label htmlFor="resume_password">Password</label>
          <div className="input-password-wrap">
            <input type="password" id="resume_password" name="resume_password"
                   placeholder="Your account password" required autoComplete="current-password" />
            <button type="button" className="toggle-password" data-toggle-pw="resume_password">🙈</button>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>Continue Registration →</button>
      </form>
      <button type="button" onClick={cancel} className="btn-link" style={{ marginTop: 12 }}>
        Not you? Use a different email
      </button>
    </div>
  );
}

export function BlockedCard({ retryDate }: { retryDate: string }) {
  return (
    <div className="block-card">
      <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>🚫</div>
      <p>
        <strong>Account Creation Blocked</strong><br />
        A previous instructor competency test attempt from your device did not reach the
        required passing score. For quality standards, new instructor accounts cannot be
        created from this device during the <strong>7-day waiting period</strong>.
      </p>
      <div className="alert alert-error" style={{ marginTop: 16, textAlign: "left" }}>
        <span className="alert-icon">🔓</span>
        <span>You may register again after: <strong>{retryDate}</strong></span>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>
        Please use this time to review your subject area thoroughly. Once the block lifts,
        you are welcome to register and take the competency test again.
      </p>
    </div>
  );
}

// ── Steps 2-5 (shared text form shell) ────────────────────────────────────────
function DraftForm({
  step, csrf, editMode, children,
}: {
  step: number;
  csrf: string;
  editMode: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
  const body: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (k === "csrf_token") continue;
    body[k] = String(v);
  }
    const json = await postStep(step, body, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.error) setError(json.error);
  };

  const back = async () => {
    setBusy(true);
    const json = await postStep(step, { action: "back" }, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
  };

  return (
    <form onSubmit={save} action={`/api/instructor-register/step/${step}`}>
      <input type="hidden" name="csrf_token" value={csrf} />
      {children}
      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          <span className="alert-icon">⚠️</span>{error}
        </div>
      )}
      <div className="form-actions">
        {editMode ? (
          <>
            <button type="button" className="btn-secondary" onClick={back} disabled={busy}>← Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>Save Changes ✓</button>
          </>
        ) : (
          <>
            {step > 2 && (
              <button type="button" className="btn-secondary" onClick={back} disabled={busy}>← Back</button>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>Continue →</button>
          </>
        )}
      </div>
    </form>
  );
}

export function Step2Form({ csrf, data, editMode }: { csrf: string; data?: RegData; editMode: boolean }) {
  const p = data?.profile;
  return (
    <DraftForm step={2} csrf={csrf} editMode={editMode}>
      <div className="form-group">
        <label htmlFor="headline">Professional Headline <span className="req">*</span></label>
        <input type="text" id="headline" name="headline" placeholder="e.g. Senior Web Developer & React Specialist"
               defaultValue={p?.headline ?? ""} maxLength={120} required />
        <div className="field-hint char-counter" data-target="headline" data-max="120">0 / 120 characters</div>
      </div>
      <div className="form-group">
        <label htmlFor="bio">Instructor Bio <span className="req">*</span></label>
        <textarea id="bio" name="bio" rows={6} defaultValue={p?.bio ?? ""}
                  placeholder={"What's your background and area of expertise?\nWhat will students gain from your courses?\nWhat makes your teaching approach unique?"}
                  required />
        <div className="field-hint char-counter" data-target="bio" data-min="100">0 / 100 min characters</div>
      </div>
      <div className="form-row-2col">
        <div className="form-group">
          <label htmlFor="years_exp">Years of Experience</label>
          <select id="years_exp" name="years_exp" defaultValue={String(p?.years_exp ?? 0)}>
            {YEARS_EXP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="teaching_style">Teaching Style</label>
          <select id="teaching_style" name="teaching_style" defaultValue={p?.teaching_style ?? ""}>
            <option value="">-- Select --</option>
            {TEACHING_STYLES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      </div>
      <button type="button" className="collapsible-toggle" aria-expanded="false" aria-controls="socialLinksBody">
        <span className="collapsible-toggle-icon">▼</span>
        Add your links (optional — website, LinkedIn, Twitter)
      </button>
      <div className="collapsible-body" id="socialLinksBody">
        <div className="form-group" style={{ marginTop: 12 }}>
          <label htmlFor="website">Website / Portfolio URL</label>
          <input type="url" id="website" name="website" placeholder="https://yourwebsite.com" defaultValue={p?.website ?? ""} />
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label htmlFor="linkedin">LinkedIn Profile</label>
            <input type="url" id="linkedin" name="linkedin" placeholder="https://linkedin.com/in/yourname" defaultValue={p?.linkedin ?? ""} />
          </div>
          <div className="form-group">
            <label htmlFor="twitter">Twitter / X Profile</label>
            <input type="url" id="twitter" name="twitter" placeholder="https://twitter.com/yourhandle" defaultValue={p?.twitter ?? ""} />
          </div>
        </div>
      </div>
    </DraftForm>
  );
}

export function Step3Form({ csrf, data, editMode }: { csrf: string; data?: RegData; editMode: boolean }) {
  const c = data?.credentials;
  const thisYear = new Date().getFullYear();
  return (
    <DraftForm step={3} csrf={csrf} editMode={editMode}>
      <div className="form-section-card">
        <div className="form-section-card-header">
          <div className="form-section-card-icon">🎓</div>
          <div className="form-section-card-title">Education</div>
        </div>
        <div className="form-group">
          <label htmlFor="highest_education">Highest Education Level <span className="req">*</span></label>
          <select id="highest_education" name="highest_education" defaultValue={c?.highest_education ?? ""} required>
            <option value="">-- Select --</option>
            {EDUCATION_LEVELS.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="institution">Institution / University <span className="req">*</span></label>
          <input type="text" id="institution" name="institution" placeholder="e.g. IIT Delhi, University of Mumbai"
                 defaultValue={c?.institution ?? ""} required />
        </div>
        <div className="form-row-2col">
          <div className="form-group">
            <label htmlFor="field_of_study">Field of Study / Major <span className="req">*</span></label>
            <input type="text" id="field_of_study" name="field_of_study" placeholder="e.g. Computer Science"
                   defaultValue={c?.field_of_study ?? ""} required />
          </div>
          <div className="form-group">
            <label htmlFor="graduation_year">Graduation Year</label>
            <input type="number" id="graduation_year" name="graduation_year" min={1960} max={thisYear}
                   placeholder={String(thisYear)} defaultValue={c?.graduation_year ?? ""} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="certifications">Professional Certifications</label>
          <textarea id="certifications" name="certifications" rows={3} defaultValue={c?.certifications ?? ""}
                    placeholder="List any relevant certifications, e.g. AWS Certified, PMP, CFA…" />
          <div className="field-hint">One per line, or comma-separated</div>
        </div>
      </div>
      <div className="form-section-card">
        <div className="form-section-card-header">
          <div className="form-section-card-icon">💼</div>
          <div className="form-section-card-title">Professional Experience</div>
        </div>
        <div className="form-group">
          <label htmlFor="professional_exp">Work Experience & Roles <span className="req">*</span></label>
          <textarea id="professional_exp" name="professional_exp" rows={4} defaultValue={c?.professional_exp ?? ""}
                    placeholder="Describe your relevant work experience, roles, and key achievements…" required />
        </div>
      </div>
      <div className="form-section-card">
        <div className="form-section-card-header">
          <div className="form-section-card-icon">🏆</div>
          <div className="form-section-card-title">Notable Works <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></div>
        </div>
        <div className="form-group">
          <label htmlFor="notable_works">Books, Projects, Publications & Talks</label>
          <textarea id="notable_works" name="notable_works" rows={3} defaultValue={c?.notable_works ?? ""}
                    placeholder="Books authored, open-source projects, publications, conference talks, etc." />
          <div className="field-hint">These help your application stand out</div>
        </div>
      </div>
    </DraftForm>
  );
}

export function Step4Form({ csrf, data, editMode, categories }: {
  csrf: string; data?: RegData; editMode: boolean; categories: { id: number; name: string }[];
}) {
  const cp = data?.competency;
  return (
    <DraftForm step={4} csrf={csrf} editMode={editMode}>
      <div className="form-group">
        <label htmlFor="primary_subject">Primary Subject / Category <span className="req">*</span></label>
        <select id="primary_subject" name="primary_subject" defaultValue={cp?.primary_subject ?? ""} required>
          <option value="">-- Select a category --</option>
          {categories.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
          <option value="Other">Other</option>
        </select>
      </div>
      <div className="form-group">
        <label>Secondary Subjects / Topics</label>
        <input type="hidden" id="secondary_subjects" name="secondary_subjects" defaultValue={cp?.secondary_subjects ?? ""} />
        <div className="tag-input-wrapper" id="tagInputWrapper">
          <input type="text" className="tag-text-input" placeholder="Type a topic and press Enter or comma…" autoComplete="off" maxLength={40} />
        </div>
        <div className="field-hint">Add up to 15 related topics you can teach (e.g. React, Node.js, Docker)</div>
      </div>
      <div className="form-row-2col">
        <div className="form-group">
          <label htmlFor="skill_level">Skill Level You Teach <span className="req">*</span></label>
          <select id="skill_level" name="skill_level" defaultValue={cp?.skill_level ?? ""} required>
            <option value="">-- Select --</option>
            {SKILL_LEVELS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="target_audience">Target Audience <span className="req">*</span></label>
          <input type="text" id="target_audience" name="target_audience"
                 placeholder="e.g. Working professionals, college students" defaultValue={cp?.target_audience ?? ""} required />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="course_ideas">Course Ideas / Topics You Plan to Create <span className="req">*</span></label>
        <textarea id="course_ideas" name="course_ideas" rows={4} defaultValue={cp?.course_ideas ?? ""}
                  placeholder="Describe 1–3 course ideas you'd like to create on our platform. What will students learn? What problems will it solve?" required />
        <div className="field-hint char-counter" data-target="course_ideas" data-min="50">0 / 50 min characters</div>
      </div>
      <div className="form-group">
        <label htmlFor="sample_content">Sample Content Link <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional — recommended)</span></label>
        <input type="url" id="sample_content" name="sample_content"
               placeholder="YouTube video, blog post, GitHub repo, etc." defaultValue={cp?.sample_content ?? ""} />
        <div className="field-hint">🎬 Sharing a sample gives your application a significant advantage</div>
      </div>
    </DraftForm>
  );
}

export function Step5Form({ csrf, data, editMode }: { csrf: string; data?: RegData; editMode: boolean }) {
  const router = useRouter();
  const l = data?.legal;
  const [error, setError] = useState("");
  const [skipPayout, setSkipPayout] = useState(Boolean(l?.skip_payout));
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (k === "csrf_token") continue;
      if (k === "skip_payout" || k.startsWith("agree_")) { body[k] = fd.get(k) ? "1" : "0"; continue; }
      body[k] = String(v);
    }
    const json = await postStep(5, body, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.error) setError(json.error);
  };

  const back = async () => {
    setBusy(true);
    const json = await postStep(5, { action: "back" }, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
  };

  return (
    <>
      <div className="trust-banner">
        <div className="trust-banner-icon">🔒</div>
        <div className="trust-banner-text">
          <h4>Your data is protected</h4>
          <p>All financial details are encrypted with 256-bit SSL. Only our admin team can access them.</p>
          <div className="trust-badges-row">
            <span className="trust-badge-pill">🔒 256-bit SSL</span>
            <span className="trust-badge-pill">✅ Admin-only access</span>
            <span className="trust-badge-pill">✏️ Editable anytime</span>
          </div>
        </div>
      </div>
      <form onSubmit={save} action="/api/instructor-register/step/5">
        <input type="hidden" name="csrf_token" value={csrf} />
        <div className="form-section-title">Agreements</div>
        <div className="form-check-block">
          <input type="checkbox" id="agree_terms" name="agree_terms" value="1" defaultChecked={Boolean(l?.terms_agreed)} required />
          <label htmlFor="agree_terms">
            <strong>Terms & Conditions</strong><br />
            I have read and agree to the <a href="#" target="_blank">Instructor Terms of Service</a> and <a href="#" target="_blank">Community Guidelines</a>.
          </label>
        </div>
        <div className="form-check-block">
          <input type="checkbox" id="agree_quality" name="agree_quality" value="1" defaultChecked={Boolean(l?.content_policy)} required />
          <label htmlFor="agree_quality">
            <strong>Quality Standards</strong><br />
            I commit to producing high-quality course content that meets <a href="#" target="_blank">Edulari&apos;s quality standards</a>, including accurate information, clear audio/video, and regular updates.
          </label>
        </div>
        <div className="form-check-block">
          <input type="checkbox" id="agree_revenue" name="agree_revenue" value="1" defaultChecked={Boolean(l?.revenue_share_ack)} required />
          <label htmlFor="agree_revenue">
            <strong>Revenue Sharing Policy</strong><br />
            I understand and accept the <a href="#" target="_blank">revenue-sharing structure</a> and payment schedule for instructor earnings on the platform.
          </label>
        </div>
        <div className="form-section-title" style={{ marginTop: 28 }}>Tax Information</div>
        <div className="form-group">
          <label htmlFor="pan_number">PAN Number</label>
          <input type="text" id="pan_number" name="pan_number" placeholder="ABCDE1234F"
                 defaultValue={l?.pan_number ?? ""} maxLength={10} style={{ textTransform: "uppercase" }} />
          <div className="field-hint">10-character Permanent Account Number (India). Required for payouts above ₹50,000/year.</div>
        </div>
        <div className="form-section-title" style={{ marginTop: 28 }}>Bank Account for Earnings</div>
        <div className="optional-payout-notice">
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💡</span>
          <span>
            <strong>You can skip this for now.</strong> Your earnings will be held securely until
            you add your bank details from the instructor dashboard. Tick the checkbox below to
            continue without payout details.
          </span>
        </div>
        <div className="form-check-block" style={{ marginBottom: 18 }}>
          <input type="checkbox" id="skip_payout" name="skip_payout" value="1" defaultChecked={Boolean(l?.skip_payout)}
                 onChange={(e) => setSkipPayout(e.target.checked)} />
          <label htmlFor="skip_payout">
            <strong>Add payout details later</strong><br />
            <span style={{ fontWeight: 400 }}>I&apos;ll complete my bank details from the instructor dashboard after approval.</span>
          </label>
        </div>
        <div id="payoutFields" style={skipPayout ? { display: "none" } : undefined}>
          <div className="form-group">
            <label htmlFor="account_holder">Account Holder Name</label>
            <input type="text" id="account_holder" name="account_holder" placeholder="Name as it appears on your bank account" defaultValue={l?.account_holder ?? ""} />
          </div>
          <div className="form-row-2col">
            <div className="form-group">
              <label htmlFor="bank_name">Bank Name</label>
              <input type="text" id="bank_name" name="bank_name" placeholder="e.g. State Bank of India" defaultValue={l?.bank_name ?? ""} />
            </div>
            <div className="form-group">
              <label htmlFor="ifsc_code">IFSC Code</label>
              <input type="text" id="ifsc_code" name="ifsc_code" placeholder="e.g. SBIN0001234" defaultValue={l?.ifsc_code ?? ""} maxLength={11} style={{ textTransform: "uppercase" }} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="account_number">Account Number</label>
            <input type="text" id="account_number" name="account_number" placeholder="Bank account number" defaultValue={l?.account_number ?? ""} />
            <div className="field-hint">Your account details are stored with 256-bit encryption and never displayed in plain text after saving.</div>
          </div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 16 }}><span className="alert-icon">⚠️</span>{error}</div>}
        <div className="form-actions">
          {editMode ? (
            <>
              <button type="button" className="btn-secondary" onClick={back} disabled={busy}>← Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>Save Changes ✓</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={back} disabled={busy}>← Back</button>
              <button type="submit" className="btn-primary" disabled={busy}>Continue →</button>
            </>
          )}
        </div>
      </form>
    </>
  );
}

// ── Step 6: review ────────────────────────────────────────────────────────────
export function Step6Review({ csrf, data, router }: { csrf: string; data: RegData; router: ReturnType<typeof useRouter> }) {
  const p = data.profile;
  const c = data.credentials;
  const cp = data.competency;
  const l = data.legal;
  const [busyEdit, setBusyEdit] = useState(0);

  // The PHP posts the Edit buttons through a dedicated hidden form (#reviewEditForm) so
  // they cannot interfere with the navigation form. That form is rendered below.
  const cont = () => {
    const fd = new FormData();
    fd.set("csrf_token", csrf);
    fd.set("action", "continue");
    fetch("/api/instructor-register/step/6", { method: "POST", body: fd })
      .then((r) => r.json())
      .then((j: StepResult) => { if (j.redirect) router.push(j.redirect); });
  };

  const editBtn = (n: number, label: string) => (
    <button type="submit" form="reviewEditForm" name="action" value={`edit_step_${n}`}
            className="review-edit-link" onClick={() => setBusyEdit(n)} disabled={busyEdit === n}>
      {label}
    </button>
  );

  return (
    <>
      <div className="review-summary">
        <div className="review-summary-header"><h3>📋 Application Summary — Review Before Submitting</h3></div>
        <div className="review-section">
          <div className="review-section-title">
            ✉️ Account
            <span className="review-edit-link review-edit-link--locked" title="Email and password cannot be changed here">🔒 Locked</span>
          </div>
          <div className="review-row"><span className="review-row-key">Name</span><span className="review-row-val">{data.name || "—"}</span></div>
          <div className="review-row"><span className="review-row-key">Email</span><span className="review-row-val">{data.email || "—"}</span></div>
        </div>
        {p && Object.keys(p).length > 0 && (
          <div className="review-section">
            <div className="review-section-title">
              👤 Professional Profile
              {editBtn(2, "Edit")}
            </div>
            <div className="review-row"><span className="review-row-key">Headline</span><span className="review-row-val">{p.headline || "—"}</span></div>
            <div className="review-row"><span className="review-row-key">Experience</span><span className="review-row-val">{YEARS_EXP_REVIEW[p.years_exp ?? 0] ?? "—"}</span></div>
            {p.teaching_style && (
              <div className="review-row"><span className="review-row-key">Teaching Style</span><span className="review-row-val">{p.teaching_style}</span></div>
            )}
          </div>
        )}
        {c && Object.keys(c).length > 0 && (
          <div className="review-section">
            <div className="review-section-title">
              🎓 Credentials
              {editBtn(3, "Edit")}
            </div>
            <div className="review-row"><span className="review-row-key">Education</span><span className="review-row-val">{c.highest_education || "—"}</span></div>
            <div className="review-row"><span className="review-row-key">Institution</span><span className="review-row-val">{c.institution || "—"}</span></div>
            <div className="review-row"><span className="review-row-key">Field of Study</span><span className="review-row-val">{c.field_of_study || "—"}</span></div>
          </div>
        )}
        {cp && Object.keys(cp).length > 0 && (
          <div className="review-section">
            <div className="review-section-title">
              📚 Subject Competency
              {editBtn(4, "Edit")}
            </div>
            <div className="review-row"><span className="review-row-key">Primary Subject</span><span className="review-row-val">{cp.primary_subject || "—"}</span></div>
            {cp.secondary_subjects && (
              <div className="review-row"><span className="review-row-key">Topics</span><span className="review-row-val">{cp.secondary_subjects}</span></div>
            )}
            <div className="review-row"><span className="review-row-key">Skill Level</span><span className="review-row-val">{cp.skill_level || "—"}</span></div>
          </div>
        )}
        {l && Object.keys(l).length > 0 && (
          <div className="review-section">
            <div className="review-section-title">
              ⚖️ Legal &amp; Payout
              {editBtn(5, "Edit")}
            </div>
            <div className="review-row"><span className="review-row-key">Agreements</span><span className="review-row-val" style={{ color: "var(--success)" }}>✓ All 3 accepted</span></div>
            <div className="review-row">
              <span className="review-row-key">Payout Details</span>
              <span className="review-row-val">
                {l.skip_payout ? (
                  <span style={{ color: "var(--accent-orange)" }}>⏳ To be added later</span>
                ) : l.bank_name ? (
                  <span style={{ color: "var(--success)" }}>✓ {l.bank_name} — ••••{(l.account_number ?? "").slice(-4)}</span>
                ) : "—"}
              </span>
            </div>
          </div>
        )}
      </div>
      {/* Hidden form used exclusively by the Edit buttons above. */}
      <form id="reviewEditForm" method="post" action="/api/instructor-register/step/6" style={{ display: "none" }}>
        <input type="hidden" name="csrf_token" value={csrf} />
      </form>
      <div className="alert alert-info" style={{ marginTop: 24 }}>
        <span className="alert-icon">📄</span>
        Everything look good? Click <strong>Continue</strong> to proceed to the document upload step. You can still go back and edit anything above.
      </div>
      <form onSubmit={(e) => { e.preventDefault(); cont(); }}>
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="action" value="continue" />
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="submit" className="btn-primary">Continue — Upload Documents →</button>
        </div>
      </form>
    </>
  );
}

// ── Step 7: documents ─────────────────────────────────────────────────────────
export function Step7Form({ csrf, data }: { csrf: string; data?: RegData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const savedGovt = data?.documents?.govt_id_file ?? "";
  const savedMarks = data?.documents?.marksheet_file ?? "";
  const base = (k: string) => k.split("/").pop() ?? k;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/instructor-register/step/7", { method: "POST", body: fd });
    const json = (await res.json()) as StepResult;
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.error) setError(json.error);
  };

  return (
    <>
      <div className="alert alert-info">
        <span className="alert-icon">🔒</span>
        <span>
          Documents are stored with 256-bit encryption, visible only to our admin team, and{" "}
          <strong>permanently deleted</strong> after your application is reviewed. Accepted
          formats: JPG, PNG, WEBP, PDF — max 5 MB each.
        </span>
      </div>
      <form onSubmit={submit} action="/api/instructor-register/step/7" encType="multipart/form-data">
        <input type="hidden" name="csrf_token" value={csrf} />
        <div className="form-group">
          <label htmlFor="govt_id">Government-Issued Photo ID <span className="req">*</span></label>
          {savedGovt && (
            <div className="file-already-saved">
              ✅ <strong>Already uploaded:</strong> {base(savedGovt)}{" "}
              <span style={{ color: "#888", fontSize: "0.85em" }}>(upload below to replace)</span>
            </div>
          )}
          <div className="file-upload-box" id="govt_id_box">
            <input type="file" id="govt_id" name="govt_id" accept=".jpg,.jpeg,.png,.webp,.pdf"
                   required={!savedGovt} data-preview="govt_id_preview" data-name="govt_id_name" />
            <div className="file-upload-prompt">
              <span className="file-icon">🪪</span>
              <span className="file-upload-cta">{savedGovt ? "Upload replacement (optional)" : "Click to upload or drag & drop"}</span>
              <span className="file-formats">Aadhaar, Passport, Voter ID, Driving Licence</span>
              <span className="file-formats">JPG, PNG, WEBP or PDF — max 5 MB</span>
            </div>
            <div className="file-preview-wrap" id="govt_id_preview" />
            <div className="file-selected" id="govt_id_name" />
          </div>
          <div className="field-hint">A clear photo or scan — all four corners must be visible</div>
        </div>
        <div className="form-group" style={{ marginTop: 24 }}>
          <label htmlFor="marksheet">College / University Marksheet or Degree Certificate <span className="req">*</span></label>
          {savedMarks && (
            <div className="file-already-saved">
              ✅ <strong>Already uploaded:</strong> {base(savedMarks)}{" "}
              <span style={{ color: "#888", fontSize: "0.85em" }}>(upload below to replace)</span>
            </div>
          )}
          <div className="file-upload-box" id="marksheet_box">
            <input type="file" id="marksheet" name="marksheet" accept=".jpg,.jpeg,.png,.webp,.pdf"
                   required={!savedMarks} data-preview="marksheet_preview" data-name="marksheet_name" />
            <div className="file-upload-prompt">
              <span className="file-icon">🎓</span>
              <span className="file-upload-cta">{savedMarks ? "Upload replacement (optional)" : "Click to upload or drag & drop"}</span>
              <span className="file-formats">Final-year marksheet, degree certificate, or transcript</span>
              <span className="file-formats">JPG, PNG, WEBP or PDF — max 5 MB</span>
            </div>
            <div className="file-preview-wrap" id="marksheet_preview" />
            <div className="file-selected" id="marksheet_name" />
          </div>
          <div className="field-hint">Must clearly show your name, institution, and qualification</div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 16 }}><span className="alert-icon">⚠️</span><span>{error}</span></div>}
        <div className="alert alert-warning" style={{ marginTop: 24 }}>
          <span className="alert-icon">📝</span>
          <span>
            After submitting your documents, you&apos;ll review your test details before taking the{" "}
            <strong>subject competency test</strong>. Passing the test completes your application —
            results are usually reviewed within 2–3 business days.
          </span>
        </div>
        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="submit" className="btn-primary" disabled={busy}>Save Documents &amp; Continue →</button>
        </div>
      </form>
    </>
  );
}

// ── Step 8: test preview ──────────────────────────────────────────────────────
const SKILL_LABEL: Record<string, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert",
};

export function Step8Form({ csrf, data }: { csrf: string; data?: RegData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cp = data?.competency;
  const primary = cp?.primary_subject || "Your Subject";
  const rawLevel = cp?.skill_level ?? "";
  const level = SKILL_LABEL[rawLevel.toLowerCase()] ?? (rawLevel || "Intermediate");
  const topics = (cp?.secondary_subjects ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  const act = async (action: string) => {
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("csrf_token", csrf);
    fd.set("action", action);
    const json = await postStep(8, { action }, csrf);
    setBusy(false);
    if (json.redirect) return router.push(json.redirect);
    if (json.error) setError(json.error);
  };

  return (
    <>
      <div className="s8-test-preview">
        <div className="s8-overview-card">
          <div className="s8-overview-icon">🧠</div>
          <div className="s8-overview-body">
            <h2 className="s8-overview-title">Instructor Competency Test</h2>
            <p className="s8-overview-sub">
              This short test verifies your subject expertise before your application goes to
              review. It is designed to be fair and relevant to what you will actually teach.
            </p>
          </div>
        </div>
        <div className="s8-details-grid">
          <div className="s8-detail-card">
            <span className="s8-detail-icon">📚</span>
            <div className="s8-detail-content">
              <div className="s8-detail-label">Subject</div>
              <div className="s8-detail-value">{primary}</div>
            </div>
          </div>
          <div className="s8-detail-card">
            <span className="s8-detail-icon">📊</span>
            <div className="s8-detail-content">
              <div className="s8-detail-label">Level</div>
              <div className="s8-detail-value">{level}</div>
            </div>
          </div>
          <div className="s8-detail-card">
            <span className="s8-detail-icon">⏱️</span>
            <div className="s8-detail-content">
              <div className="s8-detail-label">Estimated Duration</div>
              <div className="s8-detail-value">15 – 20 minutes</div>
            </div>
          </div>
          <div className="s8-detail-card">
            <span className="s8-detail-icon">✅</span>
            <div className="s8-detail-content">
              <div className="s8-detail-label">Passing Score</div>
              <div className="s8-detail-value">60% or above</div>
            </div>
          </div>
        </div>
        {topics.length > 0 && (
          <div className="s8-topics-section">
            <div className="s8-topics-label">📌 Topic areas your test may cover:</div>
            <div className="s8-topics-chips">
              {topics.map((t) => (<span className="s8-topic-chip" key={t}>{t}</span>))}
            </div>
          </div>
        )}
        <div className="s8-rules">
          <div className="s8-rules-title">📋 Before you begin — please read</div>
          <ul className="s8-rules-list">
            <li>The test is <strong>multiple-choice</strong> — no typing required.</li>
            <li>Questions are drawn from your declared subject and skill level.</li>
            <li>You <strong>cannot pause</strong> once the test starts — find a quiet moment.</li>
            <li>If you do not pass, you may re-apply after a <strong>7-day cooldown</strong>.</li>
            <li>Your test token is valid for <strong>60 minutes</strong> from the moment you click Start.</li>
          </ul>
        </div>
        <div className="alert alert-warning" style={{ marginTop: 8 }}>
          <span className="alert-icon">🚀</span>
          <span>
            Clicking <strong>Start Test</strong> will immediately open the test — make sure you are
            ready. Your 60-minute window begins the moment you proceed.
          </span>
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 16 }}><span className="alert-icon">⚠️</span>{error}</div>}
      <form action="/api/instructor-register/step/8" style={{ marginTop: 24 }} id="step8Form">
        <input type="hidden" name="csrf_token" value={csrf} />
        <input type="hidden" name="action" id="formAction" value="start_test" />
        <div className="form-actions">
          <button type="button" className="btn-secondary" id="step8BackBtn" onClick={() => act("back")} disabled={busy}>← Back</button>
          <button type="submit" className="btn-primary" disabled={busy}>Start Test 🚀</button>
        </div>
      </form>
    </>
  );
}