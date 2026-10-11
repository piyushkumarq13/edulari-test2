import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step5Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Legal & Payout Setup – Edulari",
  description: "Agreements and earnings configuration.",
  noindex: true,
  canonical: false,
});

export default async function Step5Page() {
  const s = await loadStepPage(5);
  return (
    <RegShell step={s.step} displayStep={5} showAutosave>
      <div className="form-header">
        <h1>Legal &amp; Payout Setup</h1>
        <p>Step 5 of 6 — Agreements and earnings configuration</p>
        {s.editMode && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <span className="alert-icon">✏️</span>
            <span>You are editing this step. Save to return to your application review.</span>
          </div>
        )}
      </div>
      <Step5Form csrf={s.csrf} data={s.data} editMode={s.editMode} />
    </RegShell>
  );
}