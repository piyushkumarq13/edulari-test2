import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step7Form } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Document Upload – Edulari",
  description: "Upload your identity and academic documents.",
  noindex: true,
  canonical: false,
});

export default async function Step7Page() {
  const s = await loadStepPage(7);
  return (
    <RegShell step={s.step} displayStep={7} showAutosave>
      <div className="form-header">
        <h1>🪪 Document Upload</h1>
        <p>Step 7 of 8 — Upload your identity and academic documents</p>
      </div>
      <Step7Form csrf={s.csrf} data={s.data} />
    </RegShell>
  );
}