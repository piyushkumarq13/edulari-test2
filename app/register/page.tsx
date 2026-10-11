import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/auth/register.css";
import "@/styles/css/auth/oauth.css";
import AuthShell from "@/components/AuthShell";
import RegisterForm from "./RegisterForm";
import { readCsrfToken } from "@/lib/security/csrf";

// Reads the CSRF cookie server-side, so it cannot be prerendered.
export const metadata: Metadata = pageMetadata({
  title: "Create Account - Edulari",
  description: "Create your free Edulari account and start learning today.",
  path: "/register",
  canonical: false,
  noindex: true,
});

export default async function RegisterPage() {
  const csrfToken = await readCsrfToken();
  return (
    <AuthShell title="Create your account" subtitle="Start learning in minutes - it's free." footer={<a href="/login">Already have an account?</a>}>
      <RegisterForm csrfToken={csrfToken} />
      <p className="auth-switch">Already have an account? <a href="/login">Log in</a></p>
    </AuthShell>
  );
}
