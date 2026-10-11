import type { Metadata } from "next";
import "@/styles/css/auth/verify-email.css";
import { pageMetadata } from "@/lib/seo/metadata";
import AuthShell from "@/components/AuthShell";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";
import { sql } from "@/lib/db/client";
import { sendWelcomeEmail } from "@/lib/email/senders";
import { createNotification } from "@/lib/notifications";
export const metadata: Metadata = pageMetadata({
  title: "Verify Email - Edulari",
  description: "Confirm your email address to activate your Edulari account.",
  path: "/verify-email",
  noindex: true,
});


export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  let ok = false;
  let invalid = token === "";

  if (token) {
    const result = await consumeEmailVerificationToken(token);
    ok = result.ok;
    invalid = !result.ok;
    if (ok && result.userId) {
      const users = await sql<{ name: string; email: string }[]>`SELECT name, email FROM users WHERE id = ${result.userId}`;
      if (users.length > 0) {
        await sendWelcomeEmail(users[0].email, users[0].name);
        await createNotification(result.userId, "welcome", "Welcome to Edulari!", "Your email is verified. Start learning today.");
      }
    }
  }

  return (
    <AuthShell title={ok ? "Email verified" : invalid ? "Verification failed" : "Verifying…"} subtitle={ok ? "Your account is now active." : invalid ? "This link is invalid or has expired." : ""}>
      {ok ? (
        <>
          <div className="auth-alert" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#064e3b" }}>Your email address has been verified successfully.</div>
          <a className="auth-btn auth-btn--primary auth-btn--lg" href="/login" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Log In</a>
        </>
      ) : invalid ? (
        <>
          <div className="auth-alert">This verification link is invalid or has expired (links last 30 minutes).</div>
          <a className="auth-btn auth-btn--primary auth-btn--lg" href="/account-activation" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Resend Verification Email</a>
        </>
      ) : null}
    </AuthShell>
  );
}
