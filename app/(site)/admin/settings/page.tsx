import type { Metadata } from "next";
import "@/styles/css/admin/settings.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getAdminSettings, getTableCounts } from "@/lib/db/admin/settings";
import { getMaintenanceState } from "@/lib/maintenance";
import { APP_TIMEZONE, phpNumber } from "@/lib/format";
import SettingsScripts from "@/components/admin/SettingsScripts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAdminSettings();
  return pageMetadata({
    title: `System Settings — ${settings.siteName} Admin`,
    description: "Configure your platform, SMTP, security and more.",
    noindex: true,
    canonical: false,
  });
}

const CURRENCIES: Array<{ code: string; label: string }> = [
  { code: "INR", label: "₹ INR — Indian Rupee" },
  { code: "USD", label: "$ USD — US Dollar" },
  { code: "EUR", label: "€ EUR — Euro" },
  { code: "GBP", label: "£ GBP — British Pound" },
  { code: "JPY", label: "¥ JPY — Japanese Yen" },
  { code: "AUD", label: "A$ AUD — Australian Dollar" },
  { code: "CAD", label: "C$ CAD — Canadian Dollar" },
  { code: "SGD", label: "S$ SGD — Singapore Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
];

function timezoneList(): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  return zones;
}

/** PHP `gmdate('H\h i\m', SESSION_LIFETIME)`. */
function gmdateHhIm(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

/** PHP `date('H:i', strtotime($autoDisableAt))`. */
function hhmmInSiteTz(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [settings, csrfToken, tableData, maint] = await Promise.all([
    getAdminSettings(),
    readCsrfToken(),
    getTableCounts(),
    getMaintenanceState(),
  ]);

  const timezones = timezoneList();
  const currentTz = settings.timezone;

  const counts = new Map<string, number>(tableData.counts.map((c) => [c.table, c.count]));
  const tables = tableData.tables;
  const countOf = (t: string) => counts.get(t) ?? 0;

  const maintenanceMode = maint.student || maint.instructor;
  const maintStudent = maint.student;
  const maintInstructor = maint.instructor;
  const maintAutoDisableAt = maint.autoDisableAt ?? null;

  const maintScopes: string[] = [];
  if (maintStudent) maintScopes.push("Student");
  if (maintInstructor) maintScopes.push("Instructor");

  const maintBlockScopes: string[] = [];
  if (maintStudent) maintBlockScopes.push("Student (incl. public)");
  if (maintInstructor) maintBlockScopes.push("Instructor");

  const sessionSecs = Number.parseInt(settings.sessionLifetime, 10) || 0;

  return (
    <>
      <main className="ad-page-wrap">
        <div className="sts-page">
          {/* PAGE HEADER */}
          <div className="sts-page-header">
            <div className="sts-page-header__left">
              <div className="sts-page-icon">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div>
                <h1 className="sts-page-title">System Settings</h1>
                <p className="sts-page-subtitle">Configure your platform, SMTP, security and more</p>
              </div>
            </div>
            {/* Maintenance toggle pill */}
            <div className={`sts-maintenance-pill${maintenanceMode ? " sts-maintenance-pill--active" : ""}`} id="stsMaintPill">
              <span className="sts-maintenance-dot"></span>
              <span className="sts-maintenance-label" id="stsMaintLabel">
                {maintenanceMode ? `Maint: ${maintScopes.join("/")}` : "Maintenance OFF"}
              </span>
              <button className="sts-maintenance-btn" id="stsMaintBtn" title="Toggle maintenance mode">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M18.36 6.64a9 9 0 11-12.73 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* QUICK-STATS ROW */}
          <div className="sts-stats-row">
            <div className="sts-stat-card">
              <div className="sts-stat-icon sts-stat-icon--blue">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="sts-stat-body">
                <span className="sts-stat-value">{phpNumber(countOf("users"))}</span>
                <span className="sts-stat-label">Total Users</span>
              </div>
            </div>
            <div className="sts-stat-card">
              <div className="sts-stat-icon sts-stat-icon--green">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="sts-stat-body">
                <span className="sts-stat-value">{phpNumber(countOf("courses"))}</span>
                <span className="sts-stat-label">Total Courses</span>
              </div>
            </div>
            <div className="sts-stat-card">
              <div className="sts-stat-icon sts-stat-icon--orange">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="sts-stat-body">
                <span className="sts-stat-value">{phpNumber(countOf("enrollments"))}</span>
                <span className="sts-stat-label">Enrollments</span>
              </div>
            </div>
            <div className="sts-stat-card">
              <div className="sts-stat-icon sts-stat-icon--purple">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="sts-stat-body">
                <span className="sts-stat-value">{phpNumber(countOf("course_reviews"))}</span>
                <span className="sts-stat-label">Reviews</span>
              </div>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="sts-layout">
            {/* Sidebar tab navigation */}
            <aside className="sts-sidebar">
              <nav className="sts-tabs" role="tablist" aria-label="Settings sections">
                <button className="sts-tab sts-tab--active" role="tab" data-tab="general" aria-selected="true" aria-controls="sts-panel-general">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  General
                </button>
                <button className="sts-tab" role="tab" data-tab="smtp" aria-selected="false" aria-controls="sts-panel-smtp">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points="22 6 12 13 2 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  SMTP / Email
                </button>
                <button className="sts-tab" role="tab" data-tab="security" aria-selected="false" aria-controls="sts-panel-security">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Security
                </button>
                <button className="sts-tab" role="tab" data-tab="database" aria-selected="false" aria-controls="sts-panel-database">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2" />
                    <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Database
                </button>
                <button className="sts-tab" role="tab" data-tab="system" aria-selected="false" aria-controls="sts-panel-system">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                    <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  System Info
                </button>
                <button className="sts-tab" role="tab" data-tab="password" aria-selected="false" aria-controls="sts-panel-password">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Change Password
                </button>
                <button className="sts-tab" role="tab" data-tab="api" aria-selected="false" aria-controls="sts-panel-api">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M10 20l4-16M6 8l-4 4 4 4M18 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  API Keys
                </button>
              </nav>
            </aside>

            {/* Panels */}
            <div className="sts-panels">
              {/* GENERAL */}
              <section className="sts-panel sts-panel--active" id="sts-panel-general" role="tabpanel" aria-labelledby="">
                <div className="sts-card">
                  <div className="sts-card-header">
                    <h2 className="sts-card-title">General Settings</h2>
                    <p className="sts-card-desc">Core platform details and regional settings</p>
                  </div>
                  <form id="stsGeneralForm" className="sts-form" noValidate>
                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="siteName">
                          Site Name <span className="sts-req">*</span>
                        </label>
                        <input className="sts-input" type="text" id="siteName" name="site_name" defaultValue={settings.siteName} required maxLength={100} />
                        <span className="sts-hint">Displayed in emails, page titles and the navbar.</span>
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="siteUrl">
                          Site URL <span className="sts-req">*</span>
                        </label>
                        <input className="sts-input" type="url" id="siteUrl" name="site_url" defaultValue={settings.siteUrl} required maxLength={255} />
                        <span className="sts-hint">Must include https://</span>
                      </div>
                    </div>

                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="adminEmail">
                          Admin Email <span className="sts-req">*</span>
                        </label>
                        <input className="sts-input" type="email" id="adminEmail" name="admin_email" defaultValue={settings.adminEmail} required maxLength={254} />
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="timezone">
                          Server Timezone
                        </label>
                        <select className="sts-input sts-select" id="timezone" name="timezone" defaultValue={currentTz}>
                          {timezones.map((tz) => (
                            <option value={tz} key={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="sts-form-row" style={{ marginTop: "0.5rem" }}>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="currencyCode">
                          Display Currency
                        </label>
                        <select className="sts-input sts-select" id="currencyCode" name="currency_code" defaultValue={settings.currencyCode}>
                          {CURRENCIES.map((c) => (
                            <option value={c.code} key={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <span className="sts-hint">Controls how all prices are displayed across the site.</span>
                      </div>
                    </div>

                    <div className="sts-form-actions">
                      <button type="submit" className="sts-btn sts-btn--primary">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        Save Settings
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* SMTP */}
              <section className="sts-panel" id="sts-panel-smtp" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header">
                    <h2 className="sts-card-title">SMTP / Email Configuration</h2>
                    <p className="sts-card-desc">Configure outgoing email server settings</p>
                    <a className="sts-btn sts-btn--outline" href="/admin/smtp-test" style={{ marginTop: ".75rem" }}>Open SMTP test page</a>
                  </div>
                  <form id="stsSmtpForm" className="sts-form" noValidate>
                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="smtpHost">
                          SMTP Host
                        </label>
                        <input className="sts-input" type="text" id="smtpHost" name="smtp_host" defaultValue={settings.smtpHost} maxLength={253} />
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="smtpPort">
                          SMTP Port
                        </label>
                        <input className="sts-input" type="number" id="smtpPort" name="smtp_port" defaultValue={settings.smtpPort} min={1} max={65535} />
                        <span className="sts-hint">{"587 = TLS \u00a0|\u00a0 465 = SSL \u00a0|\u00a0 25 = plain"}</span>
                      </div>
                    </div>

                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="smtpUsername">
                          SMTP Username
                        </label>
                        <input className="sts-input" type="text" id="smtpUsername" name="smtp_username" defaultValue={settings.smtpUser} autoComplete="off" maxLength={254} />
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="smtpPassword">
                          SMTP Password
                        </label>
                        <div className="sts-pw-wrap">
                          <input
                            className="sts-input sts-input--pw"
                            type="password"
                            id="smtpPassword"
                            name="smtp_password"
                            defaultValue=""
                            placeholder={settings.smtpPasswordSet ? "Already configured — leave blank to keep" : "No password set"}
                            autoComplete="off"
                          />
                          <button type="button" className="sts-pw-toggle" data-target="smtpPassword" aria-label="Show/hide password">
                            <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Test email row */}
                    <div className="sts-test-email-row">
                      <div className="sts-field" style={{ flex: 1 }}>
                        <label className="sts-label" htmlFor="testEmail">
                          Send Test Email To
                        </label>
                        <input className="sts-input" type="email" id="testEmail" name="test_email" placeholder="test@example.com" />
                      </div>
                      <button type="button" className="sts-btn sts-btn--outline" id="stsSmtpTestBtn">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        Send Test
                      </button>
                    </div>

                    <div className="sts-form-actions">
                      <button type="submit" className="sts-btn sts-btn--primary">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        Save SMTP Settings
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* SECURITY */}
              <section className="sts-panel" id="sts-panel-security" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header">
                    <h2 className="sts-card-title">Security Settings</h2>
                    <p className="sts-card-desc">Password hashing, session lifetime and maintenance mode</p>
                  </div>
                  <form id="stsSecurityForm" className="sts-form" noValidate>
                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="hashCost">
                          Bcrypt Hash Cost <span className="sts-badge" id="hashCostBadge">{settings.hashCost}</span>
                        </label>
                        <input className="sts-range" type="range" id="hashCost" name="hash_cost" min={4} max={20} step={1} defaultValue={settings.hashCost} />
                        <span className="sts-hint">Higher = more secure but slower. Recommended: 10–14.</span>
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="sessionLifetime">
                          Session Lifetime (seconds)
                        </label>
                        <input className="sts-input" type="number" id="sessionLifetime" name="session_lifetime" defaultValue={settings.sessionLifetime} min={900} step={900} />
                        <span className="sts-hint">Current: {gmdateHhIm(sessionSecs)}. Min 15 min.</span>
                      </div>
                    </div>

                    {/* Maintenance mode card inside security */}
                    <div className={`sts-maint-block${maintenanceMode ? " sts-maint-block--on" : ""}`} id="stsMaintBlock">
                      <div className="sts-maint-block__left">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div>
                          <strong>Maintenance Mode</strong>
                          <span id="stsMaintStatus">
                            {maintenanceMode
                              ? `Currently ENABLED — blocking: ${maintBlockScopes.join(", ")}.${
                                  maintAutoDisableAt ? ` Auto-disable at ${hhmmInSiteTz(maintAutoDisableAt)}.` : ""
                                }`
                              : "Currently DISABLED — site is live."}
                          </span>
                        </div>
                      </div>
                      <button type="button" className={`sts-btn ${maintenanceMode ? "sts-btn--danger" : "sts-btn--outline"}`} id="stsMaintToggleBtn">
                        {maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
                      </button>
                    </div>

                    {/* Clear cache */}
                    <div className="sts-action-item">
                      <div>
                        <strong>Clear Session Cache</strong>
                        <span>Remove stale server-side sessions from the temp directory</span>
                      </div>
                      <button type="button" className="sts-btn sts-btn--outline" id="stsClearCacheBtn">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="23 20 23 14 17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Clear Cache
                      </button>
                    </div>

                    <div className="sts-form-actions">
                      <button type="submit" className="sts-btn sts-btn--primary">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        Save Security Settings
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* DATABASE */}
              <section className="sts-panel" id="sts-panel-database" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header sts-card-header--flex">
                    <div>
                      <h2 className="sts-card-title">Database Status</h2>
                      <p className="sts-card-desc">Record counts per table — click &quot;Run Health Check&quot; for live data</p>
                    </div>
                    <button type="button" className="sts-btn sts-btn--primary" id="stsDbHealthBtn">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Run Health Check
                    </button>
                  </div>

                  <div className="sts-table-wrap">
                    <table className="sts-table" id="stsDbTable">
                      <thead>
                        <tr>
                          <th>Table</th>
                          <th>Records</th>
                          <th>Size (KB)</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map((t) => (
                          <tr key={t}>
                            <td className="sts-table-name">
                              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                <rect x="2" y="3" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
                                <rect x="2" y="10" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
                                <rect x="2" y="17" width="20" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              {t}
                            </td>
                            <td>{phpNumber(countOf(t))}</td>
                            <td className="sts-table-size">—</td>
                            <td>
                              <span className="sts-badge-status sts-badge-status--ok">OK</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* SYSTEM INFO */}
              <section className="sts-panel" id="sts-panel-system" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header sts-card-header--flex">
                    <div>
                      <h2 className="sts-card-title">System Information</h2>
                      <p className="sts-card-desc">Live server and PHP environment details</p>
                    </div>
                    <button type="button" className="sts-btn sts-btn--outline" id="stsSysRefreshBtn">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                        <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="23 20 23 14 17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                  <div className="sts-sysinfo-grid" id="stsSysGrid">
                    {/* Populated by JS on load & refresh */}
                    <div className="sts-sysinfo-loading">
                      <div className="sts-spinner"></div>
                      <span>Loading system info…</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* CHANGE PASSWORD */}
              <section className="sts-panel" id="sts-panel-password" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header">
                    <h2 className="sts-card-title">Change Admin Password</h2>
                    <p className="sts-card-desc">Update the password for your admin account</p>
                  </div>
                  <form id="stsPwForm" className="sts-form sts-form--narrow" noValidate autoComplete="off">
                    <div className="sts-field">
                      <label className="sts-label" htmlFor="currentPassword">
                        Current Password <span className="sts-req">*</span>
                      </label>
                      <div className="sts-pw-wrap">
                        <input className="sts-input sts-input--pw" type="password" id="currentPassword" name="current_password" required autoComplete="current-password" />
                        <button type="button" className="sts-pw-toggle" data-target="currentPassword" aria-label="Show/hide">
                          <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="sts-field">
                      <label className="sts-label" htmlFor="newPassword">
                        New Password <span className="sts-req">*</span>
                      </label>
                      <div className="sts-pw-wrap">
                        <input className="sts-input sts-input--pw" type="password" id="newPassword" name="new_password" required minLength={8} autoComplete="new-password" />
                        <button type="button" className="sts-pw-toggle" data-target="newPassword" aria-label="Show/hide">
                          <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      {/* Password strength bar */}
                      <div className="sts-pw-strength" id="stsPwStrength">
                        <div className="sts-pw-strength-bar" id="stsPwStrengthBar"></div>
                      </div>
                      <span className="sts-pw-strength-label" id="stsPwStrengthLabel"></span>
                    </div>

                    <div className="sts-field">
                      <label className="sts-label" htmlFor="confirmPassword">
                        Confirm New Password <span className="sts-req">*</span>
                      </label>
                      <div className="sts-pw-wrap">
                        <input className="sts-input sts-input--pw" type="password" id="confirmPassword" name="confirm_password" required autoComplete="new-password" />
                        <button type="button" className="sts-pw-toggle" data-target="confirmPassword" aria-label="Show/hide">
                          <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <span className="sts-pw-match" id="stsPwMatch"></span>
                    </div>

                    <div className="sts-form-actions">
                      <button type="submit" className="sts-btn sts-btn--danger">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Update Password
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              {/* API KEYS */}
              <section className="sts-panel" id="sts-panel-api" role="tabpanel">
                <div className="sts-card">
                  <div className="sts-card-header">
                    <h2 className="sts-card-title">API Keys &amp; Integrations</h2>
                    <p className="sts-card-desc">Manage AI providers, payment gateway keys and active provider selection</p>
                  </div>
                  <form id="stsApiForm" className="sts-form" noValidate autoComplete="off">
                    {/* AI Provider selector */}
                    <div className="sts-field">
                      <label className="sts-label">Active AI Provider</label>
                      <div className="sts-form-row sts-form-row--2">
                        <label className={`sts-radio-card${settings.activeAiProvider === "openrouter" ? " sts-radio-card--active" : ""}`}>
                          <input type="radio" name="active_ai_provider" value="openrouter" defaultChecked={settings.activeAiProvider === "openrouter"} />
                          <strong>OpenRouter</strong>
                          <span>Free &amp; paid models via openrouter.ai</span>
                        </label>
                        <label className={`sts-radio-card${settings.activeAiProvider === "nvidia_kimi" ? " sts-radio-card--active" : ""}`}>
                          <input type="radio" name="active_ai_provider" value="nvidia_kimi" defaultChecked={settings.activeAiProvider === "nvidia_kimi"} />
                          <strong>NVIDIA Kimi-K2</strong>
                          <span>NVIDIA hosted Kimi-K2 model</span>
                        </label>
                      </div>
                    </div>

                    {/* OpenRouter */}
                    <div className="sts-field">
                      <label className="sts-label" htmlFor="openrouterApiKey">
                        OpenRouter API Key
                      </label>
                      <div className="sts-pw-wrap">
                        <input
                          className="sts-input sts-input--pw"
                          type="password"
                          id="openrouterApiKey"
                          name="openrouter_api_key"
                          defaultValue=""
                          placeholder={settings.openrouterKeySet ? "Already configured — leave blank to keep" : "No key set"}
                          autoComplete="off"
                        />
                        <button type="button" className="sts-pw-toggle" data-target="openrouterApiKey" aria-label="Show/hide">
                          <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <span className="sts-hint">
                        From <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>
                      </span>
                    </div>

                    {/* NVIDIA Kimi */}
                    <div className="sts-field">
                      <label className="sts-label" htmlFor="nvidiaApiKey">
                        NVIDIA API Key
                      </label>
                      <div className="sts-pw-wrap">
                        <input
                          className="sts-input sts-input--pw"
                          type="password"
                          id="nvidiaApiKey"
                          name="nvidia_api_key"
                          defaultValue=""
                          placeholder={settings.nvidiaKeySet ? "Already configured — leave blank to keep" : "No key set"}
                          autoComplete="off"
                        />
                        <button type="button" className="sts-pw-toggle" data-target="nvidiaApiKey" aria-label="Show/hide">
                          <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                      <span className="sts-hint">
                        From <a href="https://build.nvidia.com" target="_blank" rel="noreferrer">build.nvidia.com</a>
                      </span>
                    </div>

                    {/* Razorpay */}
                    <div className="sts-form-row sts-form-row--2">
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="razorpayKeyId">
                          Razorpay Key ID
                        </label>
                        <input className="sts-input" type="text" id="razorpayKeyId" name="razorpay_key_id" defaultValue={settings.razorpayKeyId} autoComplete="off" />
                      </div>
                      <div className="sts-field">
                        <label className="sts-label" htmlFor="razorpayKeySecret">
                          Razorpay Key Secret
                        </label>
                        <div className="sts-pw-wrap">
                          <input
                            className="sts-input sts-input--pw"
                            type="password"
                            id="razorpayKeySecret"
                            name="razorpay_key_secret"
                            defaultValue=""
                            placeholder={settings.razorpaySecretSet ? "Already configured — leave blank to keep" : "No secret set"}
                            autoComplete="off"
                          />
                          <button type="button" className="sts-pw-toggle" data-target="razorpayKeySecret" aria-label="Show/hide">
                            <svg className="sts-eye-show" viewBox="0 0 24 24" fill="none" width="16" height="16">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <svg className="sts-eye-hide" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: "none" }}>
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <span className="sts-hint" style={{ marginTop: "-8px", display: "block" }}>
                      From your <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer">Razorpay Dashboard</a>
                    </span>

                    <div className="sts-form-actions">
                      <button type="submit" className="sts-btn sts-btn--primary">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                        Save API Keys
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* MAINTENANCE MODAL */}
      <div className="sts-modal-overlay" id="stsMaintModal" style={{ display: "none" }}>
        <div className="sts-modal" role="dialog" aria-labelledby="stsMaintModalTitle">
          <div className="sts-modal-header">
            <h2 id="stsMaintModalTitle">Enable Maintenance Mode</h2>
            <button type="button" className="sts-modal-close" id="stsMaintModalClose" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="sts-modal-body">
            <label className="sts-modal-check">
              <input type="checkbox" id="stsMaintModalStudent" value="1" />
              <span className="sts-modal-check-mark"></span>
              <div>
                <strong>Student</strong>
                <span className="sts-hint">Also blocks all public/guest-facing pages (home, courses, etc.)</span>
              </div>
            </label>
            <label className="sts-modal-check">
              <input type="checkbox" id="stsMaintModalInstructor" value="1" />
              <span className="sts-modal-check-mark"></span>
              <div>
                <strong>Instructor</strong>
                <span className="sts-hint">Blocks instructor dashboard, course management, and onboarding</span>
              </div>
            </label>
            <div className="sts-field" style={{ marginTop: "1rem" }}>
              <label className="sts-label" htmlFor="stsMaintModalAuto">
                Auto-disable after
              </label>
              <select className="sts-input sts-select" id="stsMaintModalAuto">
                <option value="">Manual only</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
                <option value="custom">Custom minutes</option>
              </select>
              <div id="stsMaintModalCustomWrap" style={{ display: "none", marginTop: "0.5rem" }}>
                <input className="sts-input" type="number" id="stsMaintModalCustomMins" placeholder="Minutes" min={1} max={43200} />
              </div>
            </div>
          </div>
          <div className="sts-modal-footer">
            <button type="button" className="sts-btn sts-btn--outline" id="stsMaintModalCancel">
              Cancel
            </button>
            <button type="button" className="sts-btn sts-btn--primary" id="stsMaintModalConfirm" disabled>
              Enable Maintenance
            </button>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      <div className="sts-toast" id="stsToast" role="alert" aria-live="polite">
        <span className="sts-toast-icon" id="stsToastIcon"></span>
        <span className="sts-toast-msg" id="stsToastMsg"></span>
      </div>

      <SettingsScripts csrfToken={csrfToken} endpoint="/api/admin/settings" />
    </>
  );
}
