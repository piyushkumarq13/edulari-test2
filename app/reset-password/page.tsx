import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/auth/reset-password.css";
import AuthShell from "@/components/AuthShell";
import { verifyPasswordResetToken } from "@/lib/auth/tokens";
import ResetForm from "./ResetForm";
import { readCsrfToken } from "@/lib/security/csrf";
export const metadata: Metadata = pageMetadata({
  title: "Reset Password - Edulari",
  description: "Choose a new password for your Edulari account.",
  path: "/reset-password",
  canonical: false,
  noindex: true,
});


export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);
  const token = sp.token ?? "";
  const info = token ? await verifyPasswordResetToken(token) : null;

  if (!info) {
    return (
      <AuthShell title="Reset link invalid" subtitle="This reset link is invalid or has expired.">
        <div className="auth-alert">Reset links expire after 60 minutes and can only be used once.</div>
        <a className="auth-btn auth-btn--primary auth-btn--lg" href="/forgot-password" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Request a New Link</a>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`Resetting password for ${info.email}`}>
      <ResetForm token={token} csrfToken={csrfToken} />
    </AuthShell>
  );
}
