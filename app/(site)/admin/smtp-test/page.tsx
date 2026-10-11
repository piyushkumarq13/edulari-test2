import type { Metadata } from "next";
import "@/styles/css/admin/settings.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import SmtpTestClient from "./SmtpTestClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "SMTP Test — Edulari Admin",
    description: "Send a test email to confirm SMTP sending works.",
    noindex: true,
    canonical: false,
  });
}

export default async function SmtpTestPage() {
  await requireAdmin();
  const csrfToken = await readCsrfToken();

  const user = process.env.SMTP_USERNAME ?? process.env.SMTP_USER ?? "";
  const from = process.env.SMTP_FROM_EMAIL ?? "";

  return (
    <div className="sts-page">
      <div className="sts-page-header">
        <div className="sts-page-header__left">
          <div className="sts-page-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="m4 6 8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="sts-page-title">SMTP Test</h1>
            <p className="sts-page-subtitle">Send a real test email to confirm outgoing mail works.</p>
          </div>
        </div>
      </div>

      <div className="sts-panels">
        <div className="sts-panel sts-panel--active">
          <div className="sts-card">
            <div className="sts-card-header">
              <div>
                <h2 className="sts-card-title">Current configuration</h2>
                <p className="sts-card-desc">
                  Read from the environment of the running server. Secrets are never shown — only whether they are set.
                </p>
              </div>
            </div>

            <ul className="smt-list">
              <ConfigRow label="SMTP_HOST" value={process.env.SMTP_HOST || ""} />
              <ConfigRow label="SMTP_PORT" value={process.env.SMTP_PORT || "587"} />
              <ConfigRow label="SMTP_SECURE (TLS)" value={String(process.env.SMTP_SECURE ?? String(Number(process.env.SMTP_PORT ?? 587) === 465))} />
              <ConfigRow label="SMTP_AUTH" value={process.env.SMTP_AUTH ?? "true"} />
              <ConfigRow label="SMTP_USERNAME" value={user} secret />
              <ConfigRow label="SMTP_PASSWORD" value={process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? ""} secret />
              <ConfigRow label="SMTP_FROM_EMAIL" value={from} />
              <ConfigRow label="SMTP_FROM_NAME" value={process.env.SMTP_FROM_NAME ?? "Edulari"} />
              <ConfigRow label="EMAIL_DRY_RUN" value={process.env.EMAIL_DRY_RUN ?? "false"} />
            </ul>

            {(String(process.env.EMAIL_DRY_RUN ?? "false") === "true") && (
              <p className="sts-hint sts-hint--warn">
                EMAIL_DRY_RUN is <strong>true</strong>. No message will actually be sent until you set it to <code>false</code>.
              </p>
            )}
          </div>

          <div className="sts-card">
            <div className="sts-card-header">
              <div>
                <h2 className="sts-card-title">Send a test email</h2>
                <p className="sts-card-desc">
                  Runs two checks: a transporter <code>verify()</code> (connection + authentication) and a real
                  <code> sendMail()</code>. Both must succeed.
                </p>
              </div>
            </div>

            <SmtpTestClient csrfToken={csrfToken} />
          </div>

          <div className="sts-card">
            <div className="sts-card-header">
              <div>
                <h2 className="sts-card-title">If it fails</h2>
              </div>
            </div>
            <ul className="smt-tips">
              <li><strong>Missing variable</strong> — add it in Vercel (Settings → Environment Variables) and redeploy. Editing <code>.env.local</code> does nothing on Vercel.</li>
              <li><strong>Port 587 rejected / timeout</strong> — some providers block outbound 587. Try port 465 with <code>SMTP_SECURE=true</code>.</li>
              <li><strong>535 / authentication failed</strong> — the username is usually the full address, and many providers require an app password rather than the account password.</li>
              <li><strong>550 sender rejected</strong> — <code>SMTP_FROM_EMAIL</code> must be a verified sender on that account.</li>
              <li><strong>550 relay denied</strong> — the provider rejects mail to that recipient. Try a different address.</li>
              <li>Back to <a href="/admin/settings">System Settings</a>.</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        .smt-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
        .smt-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; padding: .55rem .75rem; border: 1px solid var(--sts-border, rgba(255,255,255,.08)); border-radius: 10px; background: var(--sts-surface, rgba(255,255,255,.02)); }
        .smt-row__key { font: 600 .78rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--sts-text-muted, #9aa); min-width: 12.5rem; }
        .smt-row__val { font: .82rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
        .smt-row__val--missing { color: #ef4444; font-weight: 700; }
        .smt-tips { margin: 0; padding-left: 1.1rem; display: grid; gap: .5rem; font-size: .85rem; line-height: 1.6; color: var(--sts-text, #ddd); }
        .smt-tips code, .smt-code { font: .85em ui-monospace, SFMono-Regular, Menlo, monospace; background: rgba(255,255,255,.08); padding: .1rem .3rem; border-radius: 4px; }
        .smt-form { display: grid; gap: .75rem; }
        .smt-row-actions { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
        .smt-result { margin-top: 1rem; padding: .85rem 1rem; border-radius: 10px; border: 1px solid; font-size: .88rem; line-height: 1.6; }
        .smt-result--ok { border-color: rgba(34,197,94,.45); background: rgba(34,197,94,.10); }
        .smt-result--err { border-color: rgba(239,68,68,.45); background: rgba(239,68,68,.10); }
        .smt-steps { margin: .6rem 0 0; padding: 0; list-style: none; display: grid; gap: .35rem; }
        .smt-step { display: flex; gap: .55rem; align-items: baseline; font-size: .82rem; }
        .smt-step__tag { font-weight: 700; min-width: 3.6rem; }
        .smt-step--ok .smt-step__tag { color: #22c55e; }
        .smt-step--err .smt-step__tag { color: #ef4444; }
        .smt-hint { margin: .75rem 0 0; font-size: .82rem; line-height: 1.6; color: var(--sts-text-muted, #9aa); }
      `}</style>
    </div>
  );
}

function ConfigRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const missing = value.trim() === "";
  return (
    <li className="smt-row">
      <span className="smt-row__key">{label}</span>
      <span className={missing ? "smt-row__val smt-row__val--missing" : "smt-row__val"}>
        {missing ? "NOT SET" : secret ? `${"*".repeat(8)} (set, ${value.length} chars)` : value}
      </span>
    </li>
  );
}