import type { Metadata } from "next";
import "@/styles/css/auth/instructor-register.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { loadStepPage } from "@/lib/instructor/step-page";
import RegShell from "@/components/instructor/RegShell";
import { Step1Form, VerifyEmailGate, ResumeGate, BlockedCard } from "@/components/instructor/RegSteps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Become an Instructor – Edulari",
  description: "Apply to teach on Edulari.",
  noindex: true,
  canonical: false,
});

export default async function Step1Page() {
  const s = await loadStepPage(1);

  let body: React.ReactNode;
  if (s.blocked) {
    body = (
      <>
        <div className="form-header">
          <h1>Registration Blocked</h1>
          <p>Your access to instructor registration is temporarily restricted.</p>
        </div>
        <BlockedCard retryDate={s.blockRetryDate} />
      </>
    );
  } else if (s.awaitingEmailVerify) {
    body = (
      <>
        <div className="form-header">
          <h1>Check your inbox</h1>
          <p>Step 1 of 6 — Verify your email address to continue</p>
        </div>
        <VerifyEmailGate csrf={s.csrf} email={s.data.email ?? ""} />
      </>
    );
  } else if (s.resumeEmail) {
    body = (
      <>
        <div className="form-header">
          <h1>Welcome back</h1>
          <p>This account&apos;s registration is incomplete</p>
        </div>
        <ResumeGate csrf={s.csrf} email={s.resumeEmail} />
      </>
    );
  } else {
    body = (
      <>
        <div className="form-header">
          <h1>Create your instructor account</h1>
          <p>Step 1 of 6 — We&apos;ll send a verification link to your email</p>
        </div>
        <Step1Form csrf={s.csrf} data={s.data} />
        <div className="form-footer-links">
          Already have an account? <a href="/login">Sign in</a> &nbsp;|&nbsp;
          Registering as a student? <a href="/register">Student registration</a>
        </div>
      </>
    );
  }

  return (
    <RegShell step={s.step} displayStep={1}>
      {body}
    </RegShell>
  );
}