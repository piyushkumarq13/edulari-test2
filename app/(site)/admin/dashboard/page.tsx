import type { Metadata } from "next";
import "@/styles/css/admin/dashboard.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/site";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getPlatformStats, getPendingApplicationsCount } from "@/lib/db/admin/dashboard";
import { formatPrice, formatMonthDayYear } from "@/lib/format";
import ConfirmForm from "@/components/admin/ConfirmForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: `Admin Dashboard — ${SITE_NAME}`,
  description: "Platform-wide statistics, recent activity and maintenance actions.",
  noindex: true,
  canonical: false,
});

function roleBadge(role: string): string {
  return role === "admin" ? "danger" : role === "instructor" ? "warning" : "info";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [user, sp, csrfToken, stats, pendingApplications] = await Promise.all([
    requireAdmin(),
    searchParams,
    readCsrfToken(),
    getPlatformStats(),
    getPendingApplicationsCount(),
  ]);

  // ?msg= prefix routing, exactly as the PHP: first matching prefix wins.
  const m = sp.msg ?? "";
  let cleanupMessage: string | null = null;
  let purgeMessage: string | null = null;
  let tokenCleanupMessage: string | null = null;
  if (m.startsWith("Cleanup done")) cleanupMessage = m;
  else if (m.startsWith("Purge done")) purgeMessage = m;
  else if (m.startsWith("Token cleanup")) tokenCleanupMessage = m;

  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <main className="ad-page-wrap">
      <div className="addash-page-inner">
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="addash-page-header">
          <div>
            <h1 className="addash-page-title">Admin Dashboard</h1>
            <p className="addash-page-subtitle">
              Welcome back, {firstName}. Here&apos;s what&apos;s happening on the platform.
            </p>
          </div>
          <div className="addash-header-actions">
            <a href="/admin/instructor-applications" className="addash-btn addash-btn--secondary">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Applications
              {pendingApplications > 0 && <span className="addash-badge-count">{pendingApplications}</span>}
            </a>
            <a href="/admin/courses?status=pending" className="addash-btn addash-btn--primary">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <polyline points="9 11 12 14 22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Review Courses
              {stats.pending_courses > 0 && (
                <span className="addash-badge-count addash-badge-count--light">{stats.pending_courses}</span>
              )}
            </a>
          </div>
        </div>

        {/* ── Stats Grid ────────────────────────────────────────────────── */}
        <div className="addash-stats-grid">
          <div className="addash-stat-card">
            <div className="addash-stat-icon addash-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="addash-stat-body">
              <span className="addash-stat-label">Total Users</span>
              <span className="addash-stat-value">{stats.total_users.toLocaleString("en-US")}</span>
              <span className="addash-stat-sub">
                {stats.total_students.toLocaleString("en-US")} students &middot;{" "}
                {stats.total_instructors.toLocaleString("en-US")} instructors
              </span>
            </div>
          </div>

          <div className="addash-stat-card">
            <div className="addash-stat-icon addash-stat-icon--violet" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="addash-stat-body">
              <span className="addash-stat-label">Total Courses</span>
              <span className="addash-stat-value">{stats.total_courses.toLocaleString("en-US")}</span>
              <span className="addash-stat-sub">
                {stats.published_courses.toLocaleString("en-US")} published &middot;{" "}
                <span className="addash-stat-warning">{stats.pending_courses.toLocaleString("en-US")} pending</span>
              </span>
            </div>
          </div>

          <div className="addash-stat-card">
            <div className="addash-stat-icon addash-stat-icon--teal" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="addash-stat-body">
              <span className="addash-stat-label">Total Enrollments</span>
              <span className="addash-stat-value">{stats.total_enrollments.toLocaleString("en-US")}</span>
              <span className="addash-stat-sub">All-time enrollments</span>
            </div>
          </div>

          <div className="addash-stat-card">
            <div className="addash-stat-icon addash-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="addash-stat-body">
              <span className="addash-stat-label">Total Revenue</span>
              <span className="addash-stat-value">{formatPrice(Number(stats.total_revenue))}</span>
              <span className="addash-stat-sub">Platform-wide earnings</span>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <section className="addash-section">
          <h2 className="addash-section-title">Quick Actions</h2>
          <div className="addash-actions-grid">
            <a href="/admin/users?action=create" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--blue" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="16" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Add User</span>
                <span className="addash-action-desc">Create a new instructor or admin account</span>
              </div>
            </a>

            <a href="/admin/categories?action=create" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--violet" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Add Category</span>
                <span className="addash-action-desc">Create a new course category</span>
              </div>
            </a>

            <a href="/admin/courses?status=pending" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--orange" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <polyline points="9 11 12 14 22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Review Courses</span>
                <span className="addash-action-desc">
                  {stats.pending_courses.toLocaleString("en-US")} course(s) awaiting approval
                </span>
              </div>
            </a>

            <a href="/admin/instructor-applications" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--teal" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Applications</span>
                <span className="addash-action-desc">Review instructor applications</span>
              </div>
            </a>

            <a href="/admin/enrollments" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--green" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Enrollments</span>
                <span className="addash-action-desc">View and manage all enrollments</span>
              </div>
            </a>

            <a href="/admin/reviews" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--yellow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Reviews</span>
                <span className="addash-action-desc">Monitor course ratings &amp; reviews</span>
              </div>
            </a>

            <a href="/admin/send-notifications" className="addash-action-card">
              <div className="addash-action-icon addash-action-icon--blue" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="addash-action-body">
                <span className="addash-action-title">Send Notification</span>
                <span className="addash-action-desc">Broadcast updates to users</span>
              </div>
            </a>
          </div>
        </section>

        {/* ── Recent Activity (two columns) ────────────────────────────── */}
        <div className="addash-two-col">
          {/* Recent Signups */}
          <section className="addash-section">
            <div className="addash-section-header">
              <h2 className="addash-section-title">Recent Signups</h2>
              <a href="/admin/users" className="addash-link-more">View all</a>
            </div>
            <div className="addash-table-wrap">
              <table className="addash-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_signups.length > 0 ? (
                    stats.recent_signups.map((signup) => (
                      <tr key={signup.id}>
                        <td className="addash-td-user">
                          <div className="addash-user-avatar" aria-hidden="true">
                            {signup.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="addash-user-name">{signup.name}</span>
                            <span className="addash-user-email">{signup.email}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`addash-badge addash-badge--${roleBadge(signup.role)}`}>
                            {signup.role.charAt(0).toUpperCase() + signup.role.slice(1)}
                          </span>
                        </td>
                        <td className="addash-td-date">{formatMonthDayYear(signup.registration_date)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="addash-td-empty">No recent signups.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent Enrollments */}
          <section className="addash-section">
            <div className="addash-section-header">
              <h2 className="addash-section-title">Recent Enrollments</h2>
              <a href="/admin/enrollments" className="addash-link-more">View all</a>
            </div>
            <div className="addash-table-wrap">
              <table className="addash-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Course</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_enrollments.length > 0 ? (
                    stats.recent_enrollments.map((enrollment, i) => (
                      <tr key={i}>
                        <td className="addash-td-user">
                          <div className="addash-user-avatar addash-user-avatar--teal" aria-hidden="true">
                            {(enrollment.student_name ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                          <span className="addash-user-name">
                            {enrollment.student_name ?? "—"}
                          </span>
                        </td>
                        <td className="addash-td-course">{enrollment.course_title}</td>
                        <td className="addash-td-amount">{formatPrice(Number(enrollment.price))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="addash-td-empty">No recent enrollments.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── Top Performing Courses ────────────────────────────────────── */}
        <section className="addash-section">
          <div className="addash-section-header">
            <h2 className="addash-section-title">Top Performing Courses</h2>
            <a href="/admin/courses" className="addash-link-more">View all courses</a>
          </div>
          <div className="addash-table-wrap">
            <table className="addash-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Instructor</th>
                  <th>Enrollments</th>
                  <th>Revenue</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_courses.length > 0 ? (
                  stats.top_courses.map((course) => (
                    <tr key={course.id}>
                      <td className="addash-td-bold">{course.title}</td>
                      <td>{course.instructor_name}</td>
                      <td>
                        <span className="addash-pill">{course.enrollment_count.toLocaleString("en-US")}</span>
                      </td>
                      <td className="addash-td-amount">{formatPrice(Number(course.revenue ?? 0))}</td>
                      <td className="addash-td-rating">
                        {course.avg_rating ? (
                          <span className="addash-stars" aria-label={`${Math.round(Number(course.avg_rating) * 10) / 10} stars`}>
                            {Math.round(Number(course.avg_rating) * 10) / 10} ★
                          </span>
                        ) : (
                          <span className="addash-td-empty-cell">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="addash-td-empty">No course data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Maintenance ───────────────────────────────────────────────── */}
        <section className="addash-section addash-section--maintenance">
          <h2 className="addash-section-title addash-section-title--danger">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Maintenance
          </h2>
          <p className="addash-maintenance-note">
            These actions are irreversible. Use them only when you know what you&apos;re doing.
          </p>

          <div className="addash-maintenance-grid">
            {/* Doc Cleanup */}
            <div className="addash-maintenance-card">
              <div className="addash-maintenance-card-header">
                <div className="addash-maintenance-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <span className="addash-maintenance-title">Doc Cleanup</span>
                  <span className="addash-maintenance-desc">
                    Delete uploaded doc files from drafts and failed applications older than 15&nbsp;days.
                  </span>
                </div>
              </div>
              {cleanupMessage && <div className="addash-alert addash-alert--success">{cleanupMessage}</div>}
              <ConfirmForm action="/api/admin/dashboard" confirm="Run cleanup and delete stale doc files now?">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="run_cleanup" value="1" />
                <button type="submit" className="addash-btn addash-btn--danger-outline">
                  Run Doc Cleanup
                </button>
              </ConfirmForm>
            </div>

            {/* Purge Rejected */}
            <div className="addash-maintenance-card">
              <div className="addash-maintenance-card-header">
                <div className="addash-maintenance-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <span className="addash-maintenance-title">Purge Rejected Instructors</span>
                  <span className="addash-maintenance-desc">
                    Wipes profile &amp; application data for rejected/test-failed users. Converts them to students. Email is kept to block re-registration.
                  </span>
                </div>
              </div>
              {purgeMessage && <div className="addash-alert addash-alert--success">{purgeMessage}</div>}
              <ConfirmForm
                action="/api/admin/dashboard"
                confirm={"This will permanently delete all instructor profile and application data for rejected and test-failed users, and convert them to active students.\n\nTheir email is kept so they cannot re-register as instructor.\n\nContinue?"}
              >
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="run_purge" value="1" />
                <button type="submit" className="addash-btn addash-btn--danger-outline">
                  Purge Rejected / Failed Data
                </button>
              </ConfirmForm>
            </div>

            {/* Token Cleanup */}
            <div className="addash-maintenance-card">
              <div className="addash-maintenance-card-header">
                <div className="addash-maintenance-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <span className="addash-maintenance-title">Token Cleanup</span>
                  <span className="addash-maintenance-desc">
                    Deletes expired test tokens, email/password reset tokens, expired bans, and old login attempt records.
                  </span>
                </div>
              </div>
              {tokenCleanupMessage && <div className="addash-alert addash-alert--success">{tokenCleanupMessage}</div>}
              <ConfirmForm action="/api/admin/dashboard" confirm="Delete all expired tokens and stale login attempt records now?">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="run_token_cleanup" value="1" />
                <button type="submit" className="addash-btn addash-btn--danger-outline">
                  Run Token Cleanup
                </button>
              </ConfirmForm>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
