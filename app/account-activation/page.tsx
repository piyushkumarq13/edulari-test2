import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/auth/account-activation.css";
import AuthShell from "@/components/AuthShell";
import ActivationForm from "./ActivationForm";
import { readCsrfToken } from "@/lib/security/csrf";
export const metadata: Metadata = pageMetadata({
  title: "Activate Your Account - Edulari",
  description: "Resend the Edulari account verification email.",
  path: "/account-activation",
  noindex: true,
});


export default async function AccountActivationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);
  return (
    <AuthShell title="Activate your account" subtitle="We can resend your verification link.">
      <ActivationForm email={sp.email ?? ""} csrfToken={csrfToken} />
      <p className="auth-switch">Already verified? <a href="/login">Log in</a></p>
    </AuthShell>
  );
}
