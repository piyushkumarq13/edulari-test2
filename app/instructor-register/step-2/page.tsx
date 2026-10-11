import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step2Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Professional Profile – Edulari",
  description: "Tell learners about yourself as an instructor.",
  noindex: true,
  canonical: false,
});

export default async function Step2Page() {
  const s = await loadStepPage(2);
  return (
    <RegShell step={s.step} displayStep={2} showAutosave>
      <div className="form-header">
        <h1>Professional Profile &amp; Bio</h1>
        <p>Step 2 of 6 — Tell learners about yourself as an instructor</p>
        {s.data.email && (
          <div className="step-email-notice">
            ✉️ <span>Registered as <strong>{s.data.email}</strong></span>
          </div>
        )}
        {s.editMode && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <span className="alert-icon">✏️</span>
            <span>You are editing this step. Save to return to your application review.</span>
          </div>
        )}
      </div>
      <Step2Form csrf={s.csrf} data={s.data} editMode={s.editMode} />
    </RegShell>
  );
}