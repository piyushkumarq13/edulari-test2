"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = [
  { value: "bug", icon: "\u{1F41B}", label: "Bug / Error" },
  { value: "ui", icon: "\u{1F3A8}", label: "UI Problem" },
  { value: "performance", icon: "⚡", label: "Performance" },
  { value: "feature", icon: "\u{1F4A1}", label: "Feature Request" },
  { value: "content", icon: "\u{1F4DD}", label: "Wrong Content" },
  { value: "other", icon: "❓", label: "Other Issue" },
] as const;

const SEVERITY: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  1: { label: "Low", color: "#10b981", bg: "#d1fae5", desc: "Minor cosmetic issue" },
  2: { label: "Minor", color: "#059669", bg: "#a7f3d0", desc: "Small functional glitch" },
  3: { label: "Moderate", color: "#f59e0b", bg: "#fef3c7", desc: "Noticeable problem" },
  4: { label: "High", color: "#f97316", bg: "#ffedd5", desc: "Feature broken / data issue" },
  5: { label: "Critical", color: "#ef4444", bg: "#fef2f2", desc: "App unusable / data loss" },
};

const ROLES = ["Guest", "Student", "Instructor", "Admin", "Other"];

export default function ReportBugForm({
  success,
  reference,
  prefillName,
  prefillEmail,
  prefillRole,
  csrfToken,
}: {
  success: boolean;
  reference: string;
  prefillName: string;
  prefillEmail: string;
  prefillRole: string;
  csrfToken: string;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [fileName, setFileName] = useState("");
  const router = useRouter();

  const sev = SEVERITY[severity] ?? SEVERITY[3];

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (hp) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch("/api/report-bug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(`/report-bug?success=1&ref=${encodeURIComponent(data.reference)}`);
      return;
    }
    setErrors(data.errors ?? ["Something went wrong."]);
    setBusy(false);
  };

  if (success) {
    return (
      <main className="rb-page">
        <div className="rb-success-screen show" id="rbSuccess">
          <h1>Thanks for the report!</h1>
          <p>Your reference is <strong>{reference}</strong> (format <code>BUG-A1B2C3</code>).</p>
          <a href={`/track-report?ref=${encodeURIComponent(reference)}`} className="rb-submit" style={{ textDecoration: "none" }}>Track This Report</a>
        </div>
      </main>
    );
  }

  return (
    <main className="rb-page">
      <section className="rb-hero">
        <div className="rb-hero-inner">
          <h1 className="rb-hero-title">Report a Bug</h1>
          <p className="rb-hero-sub">Tell us what broke. We&apos;ll investigate and keep you posted.</p>
        </div>
      </section>

      <div className="rb-form-card" id="rbFormWrap">
        <div className="rb-form-title"><span>🐛</span>Bug / Issue Report Form</div>

        <form method="POST" encType="multipart/form-data" id="rbForm" className="rb-form" onSubmit={onSubmit} noValidate>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <div style={{ display: "none" }}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          </div>

          {errors.length > 0 ? <div className="rb-field-error" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}

          <label className="rb-label">Issue Type <span className="required">*</span></label>
          <div className="rb-type-grid">
            {TYPES.map((t) => (
              <div key={t.value} className="rb-type-pill">
                <input type="radio" name="issue_type" id={`type_${t.value}`} value={t.value} defaultChecked={t.value === "bug"} />
                <label htmlFor={`type_${t.value}`}><span className="pill-icon">{t.icon}</span>{t.label}</label>
              </div>
            ))}
          </div>
          <div className="rb-field-error" id="err_type">Please select an issue type.</div>

          <div className="rb-field-row">
            <div className="rb-field">
              <label className="rb-label" htmlFor="reporter_name">Full Name <span className="required">*</span></label>
              <div className="rb-input-wrap">
                <svg className="rb-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <input type="text" id="reporter_name" name="reporter_name" className="rb-input" placeholder="Your full name" defaultValue={prefillName} readOnly={prefillName ? true : undefined} required />
              </div>
            </div>
            <div className="rb-field">
              <label className="rb-label" htmlFor="reporter_email">
                Email Address <span className="required">*</span>
                {prefillEmail ? <span className="optional">(auto-filled)</span> : null}
              </label>
              <div className="rb-input-wrap">
                <svg className="rb-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                <input type="email" id="reporter_email" name="reporter_email" className={`rb-input ${prefillEmail ? "prefilled" : ""}`} placeholder="you@example.com" defaultValue={prefillEmail} readOnly={prefillEmail ? true : undefined} required />
              </div>
              <div className="rb-field-error" id="err_email">Please enter a valid email address.</div>
            </div>
          </div>

          <div className="rb-field-row">
            <div className="rb-field">
              <label className="rb-label" htmlFor="reporter_role">Your Role</label>
              <select id="reporter_role" name="reporter_role" className="rb-select" defaultValue={ROLES.includes(prefillRole) ? prefillRole : "Guest"}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="rb-field">
              <label className="rb-label" htmlFor="browser">Browser / Device <span className="optional">(optional)</span></label>
              <input type="text" id="browser" name="browser" className="rb-input" placeholder="e.g. Chrome 124 on Windows 11" />
            </div>
          </div>

          <div className="rb-field">
            <label className="rb-label" htmlFor="page_url">Page / Section Where You Found the Issue <span className="optional">(optional)</span></label>
            <div className="rb-input-wrap">
              <svg className="rb-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              <input type="text" id="page_url" name="page_url" className="rb-input" placeholder="e.g. /student/learn?course=5 or 'My Courses page'" />
            </div>
            <div className="rb-field-hint">You can paste the full URL or just describe the page name.</div>
          </div>

          <div className="rb-field">
            <label className="rb-label" htmlFor="subject">Subject / Title <span className="required">*</span></label>
            <input type="text" id="subject" name="subject" className="rb-input" placeholder="Short summary of the issue" maxLength={120} required />
            <div className="rb-field-error" id="err_subject">Please enter a subject (at least 5 characters).</div>
          </div>

          <div className="rb-field">
            <label className="rb-label" htmlFor="description">Description <span className="required">*</span></label>
            <div className="rb-char-wrap">
              <textarea id="description" name="description" className="rb-textarea tall" placeholder="Describe the issue in detail. What did you see? What went wrong?" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} required />
              <span className="rb-char-counter" id="descCounter">{description.toLocaleString()} / 5000</span>
            </div>
            <div className="rb-field-error" id="err_desc">Please describe the issue (at least 20 characters).</div>
          </div>

          <div className="rb-field">
            <label className="rb-label" htmlFor="steps">Steps to Reproduce <span className="optional">(optional but very helpful)</span></label>
            <div className="rb-char-wrap">
              <textarea id="steps" name="steps" className="rb-textarea" placeholder={"1. Go to..\n2. Click on...\n3. See error..."} maxLength={3000} value={steps} onChange={(e) => setSteps(e.target.value)} />
              <span className="rb-char-counter" id="stepsCounter">{steps.toLocaleString()} / 3000</span>
            </div>
          </div>

          <div className="rb-field">
            <label className="rb-label" htmlFor="expected">Expected Behaviour <span className="optional">(optional)</span></label>
            <textarea id="expected" name="expected" className="rb-textarea" style={{ minHeight: "80px" }} placeholder="What did you expect to happen instead?" />
          </div>

          <div className="rb-field">
            <label className="rb-label">Severity <span className="required">*</span></label>
            <div className="rb-severity-wrap">
              <div className="rb-severity-labels"><span>Low</span><span>Minor</span><span>Moderate</span><span>High</span><span>Critical</span></div>
              <input type="range" id="severity" name="severity" className="rb-severity-input" min={1} max={5} value={severity} step={1} onChange={(e) => setSeverity(Number(e.target.value))} />
              <div style={{ textAlign: "center", marginTop: ".4rem" }}>
                <span className="rb-severity-value" id="sevValue" style={{ color: sev.color, background: sev.bg }}>{sev.label} &mdash; {sev.desc}</span>
              </div>
            </div>
          </div>

          <div className="rb-field">
            <label className="rb-label">Screenshot / Attachment <span className="optional">(optional, max 5 MB)</span></label>
            <div className="rb-upload-zone" id="uploadZone">
              <input type="file" name="attachment" id="attachmentInput" accept="image/*,application/pdf" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
              <div className="rb-upload-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </div>
              <div className="rb-upload-text">Click to upload or drag &amp; drop</div>
              <div className="rb-upload-sub">PNG, JPG, WEBP, GIF, PDF — max 5 MB</div>
              <div className="rb-file-list" id="fileList">{fileName}</div>
            </div>
          </div>

          <label className="rb-checkbox-wrap" htmlFor="consent">
            <input type="checkbox" id="consent" name="consent" />
            <span className="rb-checkbox-label">
              <strong>I agree to share the above information</strong> with the Edulari team to help diagnose and fix this issue. I understand my email will be used to follow up on this report.
            </span>
          </label>
          <div className="rb-field-error" id="err_consent">Please check the consent box to proceed.</div>

          <button type="submit" className="rb-submit" id="rbSubmit" disabled={busy}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rb-submit-text"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            <span className="rb-submit-text">{busy ? "Submitting…" : "Submit Report"}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
