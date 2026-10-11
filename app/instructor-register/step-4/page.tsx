import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step4Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Subject Matter Competency – Edulari",
  description: "Tell us what you'll teach and who you'll teach it to.",
  noindex: true,
  canonical: false,
});

export default async function Step4Page() {
  const s = await loadStepPage(4);
  return (
    <RegShell step={s.step} displayStep={4} showAutosave>
      <div className="form-header">
        <h1>Subject Matter Competency</h1>
        <p>Step 4 of 6 — Tell us what you&apos;ll teach and who you&apos;ll teach it to</p>
        {s.editMode && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <span className="alert-icon">✏️</span>
            <span>You are editing this step. Save to return to your application review.</span>
          </div>
        )}
      </div>
      <Step4Form csrf={s.csrf} data={s.data} editMode={s.editMode} categories={s.categories} />
    </RegShell>
  );
}