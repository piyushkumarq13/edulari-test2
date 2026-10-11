import type { Metadata } from "next";
import "@/styles/css/admin/reviews-enrollments.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import {
  getEnrollments,
  getEnrollmentStats,
  getStudentOptions,
  getCourseOptionsForEnrollment,
} from "@/lib/db/admin/enrollments";
import { formatPrice, formatMonthDayYear, formatLongDate, formatClock12PHPM, phpNumber } from "@/lib/format";
import EnrollmentsScripts from "@/components/admin/EnrollmentsScripts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Enrollments – Admin | Edulari",
  description: "Manage student course enrollments, track progress, and enroll students manually.",
  noindex: true,
  canonical: false,
});

type PageToken =
  | { kind: "prev"; href: string }
  | { kind: "next"; href: string }
  | { kind: "ellipsis"; label: string }
  | { kind: "page"; label: string; href: string; active: boolean };

function buildPaginationToken(
  page: number,
  totalPages: number,
  search: string,
  courseId: number,
): PageToken[] {
  const href = (p: number) => {
    const q = new URLSearchParams({ page: String(p) });
    if (search) q.set("search", search);
    if (courseId) q.set("course_id", String(courseId));
    return `?${q.toString()}`;
  };
  const tokens: PageToken[] = [];
  if (page > 1) tokens.push({ kind: "prev", href: href(page - 1) });

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) tokens.push({ kind: "ellipsis", label: "1 …" });
  for (let i = start; i <= end; i++) tokens.push({ kind: "page", label: String(i), href: href(i), active: i === page });
  if (end < totalPages) tokens.push({ kind: "ellipsis", label: `… ${totalPages}` });

  if (page < totalPages) tokens.push({ kind: "next", href: href(page + 1) });
  return tokens;
}

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; course_id?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const search = (sp.search ?? "").trim();
  const courseId = Number.parseInt(sp.course_id ?? "0", 10) || 0;
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total, totalPages, page }, stats, students, courses, csrfToken] = await Promise.all([
    getEnrollments({ search, courseId, page: requestedPage }),
    getEnrollmentStats(),
    getStudentOptions(),
    getCourseOptionsForEnrollment(),
    readCsrfToken(),
  ]);

  const pagination = totalPages > 1 ? buildPaginationToken(page, totalPages, search, courseId) : [];

  const clearSearchHref = (() => {
    const q = new URLSearchParams();
    if (courseId) q.set("course_id", String(courseId));
    q.set("search", "");
    q.set("page", "1");
    return `?${q.toString()}`;
  })();

  return (
    <main className="ad-page-wrap">
      <div className="en-page-inner">
        {/* Page header */}
        <div className="en-page-header">
          <div>
            <h1 className="en-page-title">Enrollments</h1>
            <p className="en-page-subtitle">Manage student course enrollments, track progress, and enroll students manually.</p>
          </div>
          <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
            <button className="en-btn en-btn--outline" data-modal="enVerifyPaymentModal">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Verify Payment
            </button>
            <button className="en-btn en-btn--primary" data-modal="enEnrollModal">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Enroll Student
            </button>
          </div>
        </div>

        {/* Verify Payment Modal */}
        <div className="en-modal-overlay" id="enVerifyPaymentModal" role="dialog" aria-modal="true" aria-labelledby="enVerifyPaymentTitle" hidden>
          <div className="en-modal">
            <div className="en-modal-header">
              <h2 className="en-modal-title" id="enVerifyPaymentTitle">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Verify Payment &amp; Re-Enroll
              </h2>
              <button className="en-modal-close" data-close-verify aria-label="Close">✕</button>
            </div>
            <div className="en-modal-body">
              <p className="en-modal-hint">
                Use this when a student paid but was not enrolled due to a technical error.
                Enter their Razorpay Payment ID (starts with <code>pay_</code>) to look up the
                verified payment record and enroll them instantly.
              </p>
              <div className="en-form-group" style={{ marginTop: "1rem" }}>
                <label className="en-form-label" htmlFor="enVerifyPaymentInput">
                  Razorpay Payment ID <span className="en-required">*</span>
                </label>
                <input type="text" id="enVerifyPaymentInput" className="en-form-select" placeholder="pay_XXXXXXXXXXXXXXXX" maxLength={32} style={{ fontFamily: "monospace", letterSpacing: ".03em" }} autoComplete="off" />
                <div className="en-form-error" id="enVerifyPaymentErr"></div>
              </div>
              <div id="enVerifyResultBox" hidden style={{ marginTop: "1rem", padding: ".85rem 1rem", borderRadius: "6px", fontSize: ".9rem", lineHeight: 1.5 }}></div>
            </div>
            <div className="en-modal-footer">
              <button className="en-btn en-btn--ghost" data-close-verify>Cancel</button>
              <button className="en-btn en-btn--primary" id="enVerifySubmitBtn">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Look Up &amp; Enroll
              </button>
            </div>
          </div>
        </div>

        {/* Toast */}
        <div className="en-toast" id="enToast" role="alert" aria-live="polite"></div>

        {/* Stat cards */}
        <div className="en-stats-grid">
          <div className="en-stat-card en-stat-card--primary">
            <div className="en-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
            <div className="en-stat-body">
              <span className="en-stat-label">Total Enrollments</span>
              <span className="en-stat-value">{phpNumber(stats.totalEnrollments)}</span>
            </div>
          </div>

          <div className="en-stat-card en-stat-card--green">
            <div className="en-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="en-stat-body">
              <span className="en-stat-label">Total Revenue</span>
              <span className="en-stat-value">{formatPrice(stats.totalRevenue)}</span>
            </div>
          </div>

          <div className="en-stat-card en-stat-card--blue">
            <div className="en-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="en-stat-body">
              <span className="en-stat-label">Avg. Progress</span>
              <span className="en-stat-value">{stats.avgProgress}<span className="en-stat-unit">%</span></span>
            </div>
          </div>

          <div className="en-stat-card en-stat-card--orange">
            <div className="en-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <div className="en-stat-body">
              <span className="en-stat-label">Free Enrollments</span>
              <span className="en-stat-value">{phpNumber(stats.freeEnrollments)}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="en-filter-bar">
          <form method="get" action="/admin/enrollments" className="en-filter-form" id="enFilterForm">
            <div className="en-filter-search">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" className="en-filter-search-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input type="text" name="search" className="en-filter-input" placeholder="Search student name, email, or course…" defaultValue={search} autoComplete="off" />
              {search ? (
                <a href={clearSearchHref} className="en-filter-clear" title="Clear search">✕</a>
              ) : null}
            </div>

            <div className="en-filter-selects">
              <select name="course_id" className="en-select" id="enCourseFilter" defaultValue={String(courseId)}>
                <option value="0">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <button type="submit" className="en-btn en-btn--outline">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 4h18M7 8h10M11 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Filter
              </button>

              {search || courseId ? (
                <a href="/admin/enrollments" className="en-btn en-btn--ghost">Clear All</a>
              ) : null}
            </div>
          </form>

          <div className="en-filter-results">
            Showing <strong>{phpNumber(rows.length)}</strong> of <strong>{phpNumber(total)}</strong> enrollment{total !== 1 ? "s" : ""}
            {search || courseId ? <span className="en-filter-badge">Filtered</span> : null}
          </div>
        </div>

        {/* Enrollments table */}
        {rows.length === 0 ? (
          <div className="en-empty">
            <svg viewBox="0 0 24 24" fill="none" width="48" height="48"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" /></svg>
            <h3>No enrollments found</h3>
            <p>{search || courseId ? "Try adjusting your filters." : "No enrollments yet."}</p>
            {search || courseId ? (
              <a href="/admin/enrollments" className="en-btn en-btn--primary" style={{ marginTop: "1rem" }}>Clear Filters</a>
            ) : null}
          </div>
        ) : (
          <div className="en-table-wrap">
            <table className="en-table" id="enTable">
              <thead>
                <tr>
                  <th className="en-th en-th--id">#</th>
                  <th className="en-th en-th--date">Enrolled</th>
                  <th className="en-th en-th--student">Student</th>
                  <th className="en-th en-th--course">Course</th>
                  <th className="en-th en-th--instructor">Instructor</th>
                  <th className="en-th en-th--price">Amount</th>
                  <th className="en-th en-th--progress">Progress</th>
                  <th className="en-th en-th--actions">Actions</th>
                </tr>
              </thead>
              <tbody id="enTableBody">
                {rows.map((en) => {
                  const price = Number(en.price) || 0;
                  const prog = Math.trunc(Number(en.progress_percentage) || 0);
                  const priceLabel = price === 0 ? "Free" : formatPrice(price);
                  return (
                    <tr className="en-tr" id={`en-row-${en.id}`} key={en.id}>
                      <td className="en-td en-td--id">
                        <span className="en-id-badge">{en.id}</span>
                      </td>

                      <td className="en-td en-td--date">
                        <span className="en-date-primary">{formatMonthDayYear(en.enrolled_at)}</span>
                        <span className="en-date-secondary">{formatClock12PHPM(en.enrolled_at)}</span>
                      </td>

                      <td className="en-td en-td--student">
                        <div className="en-person">
                          <div className="en-avatar" aria-hidden="true">{en.student_name.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div className="en-person-name">{en.student_name}</div>
                            <div className="en-person-email">{en.student_email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="en-td en-td--course">
                        <a href={`/admin/courses?highlight=${en.course_id}`} className="en-course-link">{en.course_title}</a>
                      </td>

                      <td className="en-td en-td--instructor">{en.instructor_name}</td>

                      <td className="en-td en-td--price">
                        {price === 0 ? (
                          <span className="en-badge en-badge--free">Free</span>
                        ) : (
                          <span className="en-price">{formatPrice(price)}</span>
                        )}
                      </td>

                      <td className="en-td en-td--progress">
                        <div className="en-progress-wrap">
                          <div className="en-progress-bar">
                            <div className={`en-progress-fill ${prog >= 100 ? "en-progress-fill--complete" : prog >= 50 ? "en-progress-fill--mid" : ""}`} style={{ width: `${prog}%` }}></div>
                          </div>
                          <span className={`en-progress-label ${prog >= 100 ? "en-progress-label--complete" : ""}`}>
                            {prog >= 100 ? "✓ " : ""}{prog}%
                          </span>
                        </div>
                      </td>

                      <td className="en-td en-td--actions">
                        <button className="en-btn-icon en-btn-icon--view js-view-detail" title="View details" data-enrollment-id={en.id} data-student={en.student_name} data-email={en.student_email} data-course={en.course_title} data-instructor={en.instructor_name} data-price={priceLabel} data-progress={prog} data-date={`${formatLongDate(en.enrolled_at)} – ${formatClock12PHPM(en.enrolled_at)}`}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                        </button>
                        <button className="en-btn-icon en-btn-icon--delete js-unenroll" title="Unenroll student" data-enrollment-id={en.id} data-student={en.student_name} data-course={en.course_title}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 ? (
          <nav className="en-pagination" aria-label="Enrollment pages">
            {pagination.map((t, i) => {
              if (t.kind === "ellipsis") {
                return <span className="en-page-ellipsis" key={`e${i}`}>{t.label}</span>;
              }
              if (t.kind === "prev") {
                return <a href={t.href} className="en-page-btn en-page-btn--arrow" aria-label="Previous page" key="prev">‹</a>;
              }
              if (t.kind === "next") {
                return <a href={t.href} className="en-page-btn en-page-btn--arrow" aria-label="Next page" key="next">›</a>;
              }
              return (
                <a href={t.href} className={`en-page-btn ${t.active ? "en-page-btn--active" : ""}`} aria-current={t.active ? "page" : "false"} key={`p${t.label}`}>
                  {t.label}
                </a>
              );
            })}
          </nav>
        ) : null}
      </div>

      {/* Enroll Student Modal */}
      <div className="en-modal-overlay" id="enEnrollModal" role="dialog" aria-modal="true" aria-labelledby="enEnrollTitle" hidden>
        <div className="en-modal">
          <div className="en-modal-header">
            <h2 className="en-modal-title" id="enEnrollTitle">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Enroll Student
            </h2>
            <button className="en-modal-close" data-close-modal="enEnrollModal" aria-label="Close">✕</button>
          </div>
          <div className="en-modal-body">
            <p className="en-modal-hint">Manually enrolls a student for free, bypassing payment.</p>
            <div className="en-form-grid">
              <div className="en-form-group">
                <label className="en-form-label" htmlFor="enStudentSelect">Student <span className="en-required">*</span></label>
                <select id="enStudentSelect" className="en-form-select" required defaultValue="">
                  <option value="">— Select Student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
                <div className="en-form-error" id="enStudentErr"></div>
              </div>

              <div className="en-form-group">
                <label className="en-form-label" htmlFor="enCourseSelect">Course <span className="en-required">*</span></label>
                <select id="enCourseSelect" className="en-form-select" required defaultValue="">
                  <option value="">— Select Course —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} data-price={c.price}>
                      {c.title} {Number(c.price) > 0 ? `(${formatPrice(Number(c.price))})` : "(Free)"}
                    </option>
                  ))}
                </select>
                <div className="en-form-error" id="enCourseErr"></div>
              </div>
            </div>

            <div className="en-enroll-preview" id="enPreview" hidden>
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span id="enPreviewText"></span>
            </div>
          </div>
          <div className="en-modal-footer">
            <button className="en-btn en-btn--ghost" data-close-modal="enEnrollModal">Cancel</button>
            <button className="en-btn en-btn--primary" id="enSubmitBtn">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Enroll Student
            </button>
          </div>
        </div>
      </div>

      {/* Enrollment Detail Modal */}
      <div className="en-modal-overlay" id="enDetailModal" role="dialog" aria-modal="true" aria-labelledby="enDetailTitle" hidden>
        <div className="en-modal">
          <div className="en-modal-header">
            <h2 className="en-modal-title" id="enDetailTitle">Enrollment Details</h2>
            <button className="en-modal-close" data-close-modal="enDetailModal" aria-label="Close">✕</button>
          </div>
          <div className="en-modal-body">
            <div className="en-detail-grid">
              <div className="en-detail-row"><span className="en-detail-label">Enrollment ID</span><span className="en-detail-val" id="enDetailId"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Student</span><span className="en-detail-val" id="enDetailStudent"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Email</span><span className="en-detail-val" id="enDetailEmail"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Course</span><span className="en-detail-val" id="enDetailCourse"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Instructor</span><span className="en-detail-val" id="enDetailInstructor"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Amount Paid</span><span className="en-detail-val" id="enDetailPrice"></span></div>
              <div className="en-detail-row"><span className="en-detail-label">Enrolled On</span><span className="en-detail-val" id="enDetailDate"></span></div>
            </div>
            <div className="en-detail-progress-section">
              <div className="en-detail-progress-header">
                <span className="en-detail-label">Course Progress</span>
                <span className="en-detail-progress-pct" id="enDetailProgressPct"></span>
              </div>
              <div className="en-progress-bar en-progress-bar--lg">
                <div className="en-progress-fill" id="enDetailProgressBar" style={{ width: "0%" }}></div>
              </div>
            </div>
          </div>
          <div className="en-modal-footer">
            <button className="en-btn en-btn--ghost" data-close-modal="enDetailModal">Close</button>
            <button className="en-btn en-btn--danger" id="enDetailUnenrollBtn">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" /></svg>
              Unenroll
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Unenroll Modal */}
      <div className="en-modal-overlay" id="enUnenrollModal" role="dialog" aria-modal="true" aria-labelledby="enUnenrollTitle" hidden>
        <div className="en-modal en-modal--sm">
          <div className="en-modal-header en-modal-header--danger">
            <h2 className="en-modal-title" id="enUnenrollTitle">Unenroll Student?</h2>
            <button className="en-modal-close" data-close-modal="enUnenrollModal" aria-label="Close">✕</button>
          </div>
          <div className="en-modal-body">
            <p className="en-modal-warn-text">
              You are about to unenroll <strong id="enUnenrollStudent"></strong> from{" "}
              <strong id="enUnenrollCourse"></strong>.
              All progress data (lessons, quizzes, assignments) will be permanently deleted.
            </p>
            <div className="en-warn-box">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              This action cannot be undone.
            </div>
          </div>
          <div className="en-modal-footer">
            <button className="en-btn en-btn--ghost" data-close-modal="enUnenrollModal">Cancel</button>
            <button className="en-btn en-btn--danger" id="enConfirmUnenrollBtn">Yes, Unenroll</button>
          </div>
        </div>
      </div>

      <EnrollmentsScripts csrfToken={csrfToken} />
    </main>
  );
}
