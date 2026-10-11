import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step8Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Competency Test – Edulari",
  description: "Review the test details before you begin.",
  noindex: true,
  canonical: false,
});

export default async function Step8Page() {
  const s = await loadStepPage(8);
  return (
    <RegShell step={s.step} displayStep={8}>
      <div className="form-header">
        <h1>📝 Your Competency Test</h1>
        <p>Step 8 of 8 — Review the test details before you begin</p>
      </div>
      <Step8Form csrf={s.csrf} data={s.data} />
    </RegShell>
  );
}