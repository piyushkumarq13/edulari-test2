import type { Metadata } from "next";
import "@/styles/css/auth/register-success.css";
import { pageMetadata } from "@/lib/seo/metadata";
import AuthShell from "@/components/AuthShell";

export const metadata: Metadata = pageMetadata({
  title: "Registration Successful - Edulari",
  description: "Check your inbox to activate your Edulari account.",
  path: "/register-success",
  noindex: true,
});

// Verbatim from the two <style> blocks register-success.php writes in <head>
// (.btn-login and .btn-check-status / .btn-resend). Both are page-local rules that
// no other stylesheet provides, and the markup below relies on them.
const REGISTER_SUCCESS_STYLES = `
            .btn-login {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: 100%;
                padding: 14px 24px;
                background: var(--primary);
                color: #fff;
                border: none;
                border-radius: var(--radius-sm);
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                transition: background var(--transition);
                margin-top: 24px;
                box-sizing: border-box;
            }
            .btn-login:hover { background: var(--primary-dark); }

        .btn-check-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 14px 24px;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: var(--radius-sm);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background var(--transition);
        }
        .btn-check-status:hover { background: var(--primary-dark); }
        .btn-resend {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px 24px;
            background: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
            border-radius: var(--radius-sm);
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition);
        }
        .btn-resend:hover { background: var(--primary); color: #fff; }
`;

export default function RegisterSuccessPage() {
  return (
    <AuthShell title="Check your inbox" subtitle="Almost there — confirm your email to activate your account.">
      <style dangerouslySetInnerHTML={{ __html: REGISTER_SUCCESS_STYLES }} />
      <div className="auth-alert" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#064e3b" }}>
        We&apos;ve sent a verification link to your email address. Click it to activate your Edulari account. The link expires in 30 minutes.
      </div>
      <div style={{ display: "grid", gap: "0.625rem" }}>
        <a className="auth-btn auth-btn--primary auth-btn--lg" href="/login" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Go to Login</a>
        <a className="auth-btn auth-btn--outline auth-btn--lg" href="/help-center" style={{ display: "block", lineHeight: "48px", textAlign: "center", textDecoration: "none" }}>Need help?</a>
      </div>
      <p className="auth-switch">Wrong email? <a href="/account-activation">Resend the verification link</a></p>
    </AuthShell>
  );
}
