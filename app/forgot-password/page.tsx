import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/auth/forgot-password.css";
import AuthShell from "@/components/AuthShell";
import ForgotForm from "./ForgotForm";
import { readCsrfToken } from "@/lib/security/csrf";

// Reads the CSRF cookie server-side, so it cannot be prerendered.
export const metadata: Metadata = pageMetadata({
  title: "Forgot Password - Edulari",
  description: "Request a password reset link for your Edulari account.",
  path: "/forgot-password",
  canonical: false,
  noindex: true,
});


export default async function ForgotPasswordPage() {
  const csrfToken = await readCsrfToken();
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link." footer={<a href="/login">Back to login</a>}>
      <ForgotForm csrfToken={csrfToken} />
    </AuthShell>
  );
}
