import type { Metadata } from "next";
/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
import { redirect } from "next/navigation";
import "@/styles/css/auth/instructor-register-success.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { getRegSession, saveRegSession } from "@/lib/instructor/reg-session";
import { ADMIN_EMAIL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Application Submitted – Edulari",
  description: "Your instructor application has been received.",
  noindex: true,
  canonical: false,
});

export default async function InstructorRegisterSuccessPage() {
  const { session } = await getRegSession();

  // Only reachable immediately after the test was passed and the application saved.
  if (!session.appSubmitted) {
    redirect("/instructor-register");
  }

  const email = session.pendingEmail;
  const score = session.testScore;
  const passed = session.testPassed;

  // One-shot: clear the flags so a refresh does not re-render the confirmation.
  await saveRegSession({ appSubmitted: false, testPassed: false, testScore: null, pendingEmail: "" });

  return (
    <div className="page-wrapper">
      <a href="/" className="site-logo" suppressHydrationWarning><img src="/assets/images/edulari-logo.png" alt="Edulari" /></a>

      <div className="card">
        <div className="card-icon">🎉</div>
        <h1>Application Submitted!</h1>
        {passed && score !== null && (
          <div className="summary-item done" style={{ display: "inline-block", marginBottom: 12 }}>
            ✅ Competency test passed &mdash; Score: <strong>{`${score}%`}</strong>
          </div>
        )}
        <p className="card-desc">
          Thank you for applying to become an instructor on <strong>Edulari</strong>.
        </p>

        {email && (
          <>
            <div className="email-highlight">{email}</div>
            <p className="card-desc" style={{ marginTop: 12 }}>
              We&apos;ll send an email to this address once your application has been reviewed.
            </p>
          </>
        )}

        <div className="steps-summary">
          <div className="summary-item done">✅ Account created &amp; email verified</div>
          <div className="summary-item done">✅ Profile submitted</div>
          <div className="summary-item done">✅ Credentials on file</div>
          <div className="summary-item done">✅ Subject competency recorded</div>
          <div className="summary-item done">✅ Legal &amp; financial info saved</div>
          <div className="summary-item pending">⏳ Admin review &amp; approval (2–3 business days)</div>
        </div>

        <div className="what-next">
          <h3>What happens next?</h3>
          <ol>
            <li>Our team will review your application within <strong>2–3 business days</strong>.</li>
            <li>You&apos;ll receive an email at <strong>{email}</strong> with the outcome.</li>
            <li>Once approved, you can log in and start creating your first course.</li>
          </ol>
        </div>

        <a href="/login" className="btn-primary">Go to Login</a>
        <div className="card-footer">
          Questions? <a href={`mailto:${ADMIN_EMAIL}`}>Contact support</a>
        </div>
      </div>
    </div>
  );
}