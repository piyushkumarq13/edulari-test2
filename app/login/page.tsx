import type { Metadata } from "next";
import "@/styles/css/auth/login.css";
import "@/styles/css/auth/oauth.css";
import { pageMetadata } from "@/lib/seo/metadata";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";
import { readCsrfToken } from "@/lib/security/csrf";
export const metadata: Metadata = pageMetadata({
  title: "Log In - Edulari",
  description: "Log in to your Edulari account to continue learning.",
  path: "/login",
  canonical: false,
  noindex: true,
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);
  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your learning journey." footer={<a href="/forgot-password">Forgot your password?</a>}>
      <LoginForm reason={sp.reason ?? ""} redirect={sp.redirect ?? ""} csrfToken={csrfToken} />
      <p className="auth-switch">New to Edulari? <a href="/register">Create an account</a></p>
    </AuthShell>
  );
}
