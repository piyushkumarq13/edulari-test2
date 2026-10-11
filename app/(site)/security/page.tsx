import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/security.css";
import { requireUser } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { sql } from "@/lib/db/client";
import SecurityClient from "./SecurityClient";
export const metadata: Metadata = pageMetadata({
  title: "Security & Password - Edulari",
  description: "Manage your password, active sessions, and review your login activity.",
  noindex: true,
});

type SessionRow = {
  id: number;
  ip_address: string;
  device_info: string;
  created_at: Date;
  last_active: Date;
  is_active: boolean;
  kicked_reason: string | null;
};

export default async function SecurityPage() {
  const user = await requireUser();
  const csrfToken = await readCsrfToken();

  const sessions = await sql<SessionRow[]>`
    SELECT id, ip_address, device_info, created_at, last_active, is_active, kicked_reason
    FROM user_sessions WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 20
  `;

  const pwRow = await sql<{ password_changed_at: Date | null; registration_date: Date | null; days_since_change: number | null }[]>`
    SELECT password_changed_at, registration_date,
      EXTRACT(DAY FROM now() - COALESCE(password_changed_at, registration_date))::int AS days_since_change
    FROM users WHERE id = ${user.id}
  `;

  const passwordChangedAt = pwRow[0]?.password_changed_at ?? null;
  const registrationDate = pwRow[0]?.registration_date ?? null;
  const lastChangedStr = passwordChangedAt ?? registrationDate;
  let daysSinceChange: number | null = null;
  let lastChangedLabel = "Unknown";
  let isOldPassword = false;

  if (lastChangedStr && pwRow[0]?.days_since_change != null) {
    daysSinceChange = pwRow[0].days_since_change;
    isOldPassword = daysSinceChange > 90;
    if (daysSinceChange === 0) lastChangedLabel = "Today";
    else if (daysSinceChange === 1) lastChangedLabel = "Yesterday";
    else if (daysSinceChange < 30) lastChangedLabel = `${daysSinceChange} days ago`;
    else if (daysSinceChange < 365) {
      const months = Math.floor(daysSinceChange / 30);
      lastChangedLabel = `${months} month${months > 1 ? "s" : ""} ago`;
    } else {
      const years = Math.floor(daysSinceChange / 365);
      lastChangedLabel = `${years} year${years > 1 ? "s" : ""} ago`;
    }
  }

  let strengthScore = 0;
  let strengthLabel = "Unknown";
  let strengthClass = "sec-ph__badge--unknown";
  let strengthTips: string[] = [];

  if (!passwordChangedAt) {
    strengthScore = 1;
    strengthLabel = "Fair";
    strengthClass = "sec-ph__badge--fair";
    strengthTips = [
      "Consider updating your password — it was set at registration.",
      "Use at least 12 characters for better security.",
      "Mix uppercase, lowercase, numbers, and symbols.",
    ];
  } else if (isOldPassword) {
    strengthScore = 1;
    strengthLabel = "Fair";
    strengthClass = "sec-ph__badge--fair";
    strengthTips = [
      "Your password is over 90 days old. Refresh it for better security.",
      "Avoid reusing passwords from other sites.",
      "A passphrase (e.g. 4 random words) is both strong and memorable.",
    ];
  } else {
    strengthScore = 3;
    strengthLabel = "Strong";
    strengthClass = "sec-ph__badge--strong";
    strengthTips = [
      "Great — your password was updated recently.",
      "Keep using unique passwords for every site.",
      "Enable two-factor authentication when available.",
    ];
  }

  return (
    <main className="sec-main">
      <div className="sec-hero">
        <div className="sec-hero__inner">
          <div className="sec-hero__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="28" height="28">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="sec-hero__text">
            <h1 className="sec-hero__title">Security &amp; Password</h1>
            <p className="sec-hero__subtitle">Manage your password, active sessions, and review your login activity.</p>
          </div>
        </div>
      </div>

      <div className="sec-grid">
        <div className="sec-col sec-col--left">
          <section className="sec-card sec-card--health" aria-label="Password Health">
            <div className="sec-card__header">
              <div className="sec-card__icon sec-card__icon--amber" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="sec-card__title">Password Health</h2>
                <p className="sec-card__subtitle">Overview of your current password status.</p>
              </div>
            </div>
            <div className="sec-ph">
              <div className="sec-ph__row sec-ph__row--badge">
                <span className="sec-ph__row-label">Password Strength</span>
                <span className={`sec-ph__badge ${strengthClass}`}>{strengthLabel}</span>
              </div>
              <div className="sec-ph__bar-track" role="progressbar" aria-label="Password strength" aria-valuenow={strengthScore} aria-valuemin={0} aria-valuemax={3}>
                <div className={`sec-ph__bar-fill sec-ph__bar-fill--${strengthLabel.toLowerCase()}`} style={{ width: `${(strengthScore / 3) * 100}%` }}></div>
              </div>
              <div className="sec-ph__row">
                <span className="sec-ph__row-label">Last Changed</span>
                <span className="sec-ph__row-value">{lastChangedLabel}</span>
              </div>
              {daysSinceChange !== null && (
                <div className="sec-ph__row">
                  <span className="sec-ph__row-label">Days Since Change</span>
                  <span className={`sec-ph__row-value ${isOldPassword ? "sec-ph__row-value--warn" : ""}`}>{daysSinceChange} days</span>
                </div>
              )}
              {isOldPassword && (
                <div className="sec-ph__warning" role="alert">
                  <span>Your password is more than 90 days old. We recommend updating it soon.</span>
                </div>
              )}
              {strengthTips.length > 0 && (
                <div className="sec-ph__tips">
                  <p className="sec-ph__tips-label">Recommendations</p>
                  <ul className="sec-ph__tips-list">
                    {strengthTips.map((tip, i) => (
                      <li key={i}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true"><polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="sec-card" aria-label="Change Password">
            <div className="sec-card__header">
              <div className="sec-card__icon sec-card__icon--red" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="sec-card__title">Change Password</h2>
                <p className="sec-card__subtitle">Choose a strong password you haven&apos;t used before.</p>
              </div>
            </div>
            <SecurityClient csrfToken={csrfToken} />
          </section>
        </div>

        <div className="sec-col sec-col--right">
          <section className="sec-card" aria-label="Active Sessions">
            <div className="sec-card__header">
              <div className="sec-card__icon sec-card__icon--purple" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="sec-card__title">Active Sessions</h2>
                <p className="sec-card__subtitle">Devices and browsers currently signed in to your account.</p>
              </div>
            </div>
            <div className="sec-sessions-list" role="list">
              {sessions.map((s) => (
                <div key={s.id} className={`sec-session ${s.is_active ? "sec-session--active" : "sec-session--inactive"}`} role="listitem">
                  <div className="sec-session__body">
                    <div className="sec-session__top">
                      <span className="sec-session__device">Session</span>
                      <span className={`sec-session__badge ${s.is_active ? "sec-session__badge--active" : "sec-session__badge--inactive"}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="sec-session__meta">
                      <span className="sec-session__meta-item">IP: {s.ip_address}</span>
                      <span className="sec-session__meta-item">Signed in: {new Date(s.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {s.is_active ? (
                    <form method="post" action="/api/security/logout-sessions" className="sec-session__form">
                      <input type="hidden" name="csrf_token" value={csrfToken} />
                      <input type="hidden" name="action" value="logout_one_session" />
                      <input type="hidden" name="session_id" value={s.id} />
                      <button type="submit" className="sec-btn sec-btn--ghost sec-btn--sm js-session-logout" aria-label="Log out this session">Log out</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {sessions.some((s) => s.is_active) ? (
              <form method="post" action="/api/security/logout-sessions" className="sec-card__footer">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="action" value="logout_other_sessions" />
                <button type="submit" className="sec-btn sec-btn--danger js-other-logout">Log Out All Other Devices</button>
              </form>
            ) : null}
          </section>

          <section className="sec-card" aria-label="Login History">
            <div className="sec-card__header">
              <div className="sec-card__icon sec-card__icon--blue" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="sec-card__title">Login History</h2>
                <p className="sec-card__subtitle">Your recent login events.</p>
              </div>
            </div>
            <div className="sec-history" role="list">
              {sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="sec-history__row" role="listitem">
                  <div className="sec-history__info">
                    <span className="sec-history__device">Session</span>
                    <span className="sec-history__meta">
                      <span className="sec-history__ip">{s.ip_address}</span>
                      <span className="sec-history__time">{new Date(s.created_at).toLocaleString()}</span>
                    </span>
                  </div>
                  <span className="sec-history__status sec-history__status--ok">Signed in</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
