import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/auth/password-reset-after-verify.css";
import AuthShell from "@/components/AuthShell";

export const metadata: Metadata = pageMetadata({
  title: "Password Reset - Edulari",
  description: "Your Edulari password has been reset.",
  path: "/password-reset-after-verify",
  noindex: true,
});


export default function PasswordResetAfterVerifyPage() {
  return (
    <AuthShell title="Password updated" subtitle="Your password has been reset successfully.">
      <div className="auth-alert" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#064e3b" }}>All other devices have been signed out. Use your new password to log in.</div>
      <a className="auth-btn auth-btn--primary auth-btn--lg" href="/login" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Log In</a>
    </AuthShell>
  );
}
