import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step3Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Credentials & Qualifications – Edulari",
  description: "Help us verify your academic and professional background.",
  noindex: true,
  canonical: false,
});

export default async function Step3Page() {
  const s = await loadStepPage(3);
  return (
    <RegShell step={s.step} displayStep={3} showAutosave>
      <div className="form-header">
        <h1>Credentials &amp; Qualifications</h1>
        <p>Step 3 of 6 — Help us verify your academic and professional background</p>
        {s.editMode && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <span className="alert-icon">✏️</span>
            <span>You are editing this step. Save to return to your application review.</span>
          </div>
        )}
      </div>
      <Step3Form csrf={s.csrf} data={s.data} editMode={s.editMode} />
    </RegShell>
  );
}