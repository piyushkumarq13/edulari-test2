/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import PasswordToggles from "@/components/PasswordToggles";

export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="auth-page">
      <style>{`
        .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem;background:#f5f6fa;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
        .auth-card{width:100%;max-width:420px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 10px 25px -5px rgba(0,0,0,.1),0 4px 10px -5px rgba(0,0,0,.06);padding:2rem}
        .auth-logo{display:block;margin:0 auto 1.25rem;height:48px;width:auto}
        .auth-title{text-align:center;font-size:1.5rem;font-weight:700;color:#111827;margin-bottom:.375rem}
        .auth-sub{text-align:center;font-size:.9rem;color:#6b7280;margin-bottom:1.5rem}
        .auth-field{margin-bottom:1rem}
        .auth-label{display:block;font-size:.8125rem;font-weight:600;color:#374151;margin-bottom:.375rem}
        .auth-input{width:100%;height:44px;padding:0 .75rem;border:1px solid #e5e7eb;border-radius:8px;font-size:.9375rem;font-family:inherit}
        .auth-input:focus{outline:none;border-color:#6c63ff;box-shadow:0 0 0 3px rgba(108,99,255,.15)}
        .auth-textarea{height:auto;padding:.625rem .75rem;line-height:1.5}
        .auth-pw-wrap{position:relative}
        .auth-pw-wrap .auth-input{padding-right:2.75rem}
        .toggle-password{position:absolute;right:.5rem;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;color:#9ca3af}
        .auth-btn{width:100%;height:44px;border:0;border-radius:8px;font-size:.9375rem;font-weight:600;cursor:pointer;font-family:inherit}
        .auth-btn--primary{background:#6c63ff;color:#fff}
        .auth-btn--primary:hover{background:#5449e6}
        .auth-btn--lg{height:48px}
        .auth-btn--outline{background:#fff;border:1px solid #d1d5db;color:#374151}
        .auth-divider{display:flex;align-items:center;gap:.75rem;margin:1.25rem 0;color:#9ca3af;font-size:.8rem}
        .auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:#e5e7eb}
        .auth-oauth{display:grid;grid-template-columns:1fr 1fr;gap:.625rem}
        .auth-oauth-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;height:44px;border:1px solid #d1d5db;border-radius:8px;text-decoration:none;color:#374151;font-size:.875rem;font-weight:600;background:#fff}
        .auth-oauth-logo{font-weight:800;color:#6c63ff}
        .auth-switch{text-align:center;font-size:.875rem;color:#6b7280;margin-top:1.25rem}
        .auth-switch a,.auth-foot a{color:#6c63ff;font-weight:600;text-decoration:none}
        .auth-foot{text-align:center;font-size:.85rem;color:#6b7280;margin-top:1rem}
        .auth-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:.625rem .75rem;font-size:.8125rem;margin-bottom:1rem}
        .auth-alert ul{margin:0;padding-left:1rem}
        .auth-strength{margin-top:.375rem;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden}
        .auth-strength span{display:block;height:100%;width:0;transition:width .2s}
        .auth-strength-label{font-size:.75rem;color:#6b7280;margin-top:.25rem}
        .auth-reqs{list-style:none;padding:0;margin:.5rem 0 0}
        .auth-reqs li{font-size:.75rem;color:#9ca3af;margin-top:.2rem}
        .auth-reqs li.met{color:#10b981}
        .auth-hp{position:absolute;left:-9999px}
        .auth-consent{display:flex;align-items:flex-start;gap:.5rem;font-size:.8125rem;color:#6b7280;margin:1rem 0}
      `}</style>
      <div className="auth-card">
        <Link href="/" className="auth-logo-link"><img src="/assets/images/edulari-logo.png" alt="Edulari" className="auth-logo" /></Link>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{subtitle}</p>
        {children}
        {footer ? <p className="auth-foot">{footer}</p> : null}
      </div>
      <PasswordToggles />
    </main>
  );
}
