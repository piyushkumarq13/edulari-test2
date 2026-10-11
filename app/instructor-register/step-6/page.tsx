import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import Step6ReviewClient from "@/components/instructor/Step6ReviewClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Application Review – Edulari",
  description: "Confirm everything looks right before uploading your documents.",
  noindex: true,
  canonical: false,
});

export default async function Step6Page() {
  const s = await loadStepPage(6);
  return (
    <RegShell step={s.step} displayStep={6} showAutosave>
      <div className="form-header">
        <h1>📋 Application Review</h1>
        <p>Step 6 of 8 — Confirm everything looks right before uploading your documents</p>
      </div>
      <Step6ReviewClient csrf={s.csrf} data={s.data} />
    </RegShell>
  );
}