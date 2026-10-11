import type { Metadata } from "next";
import "@/styles/css/admin/reviews-enrollments.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getReviews, getReviewStats, getCourseOptionsForReviews } from "@/lib/db/admin/reviews";
import { formatMonthDayYear, formatLongDate, formatClock12PHPM, phpNumber } from "@/lib/format";
import ReviewsScripts from "@/components/admin/ReviewsScripts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Manage Reviews – Admin | Edulari",
  description: "Moderate and manage all student reviews across every course.",
  noindex: true,
  canonical: false,
});

type PageToken =
  | { kind: "prev"; href: string }
  | { kind: "next"; href: string }
  | { kind: "ellipsis"; label: string }
  | { kind: "page"; label: string; href: string; active: boolean };

function buildPaginationToken(page: number, totalPages: number, search: string, rating: number): PageToken[] {
  const href = (p: number) => {
    const q = new URLSearchParams({ page: String(p) });
    if (search) q.set("search", search);
    if (rating) q.set("rating", String(rating));
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

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; rating?: string; course_id?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const search = (sp.search ?? "").trim();
  const rating = Number.parseInt(sp.rating ?? "0", 10) || 0;
  const courseId = Number.parseInt(sp.course_id ?? "0", 10) || 0;
  const requestedPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ rows, total, totalPages, page }, stats, courses, csrfToken] = await Promise.all([
    getReviews({ search, rating, courseId, page: requestedPage }),
    getReviewStats(),
    getCourseOptionsForReviews(),
    readCsrfToken(),
  ]);

  const pagination = totalPages > 1 ? buildPaginationToken(page, totalPages, search, rating) : [];

  const clearSearchHref = (() => {
    const q = new URLSearchParams();
    if (rating) q.set("rating", String(rating));
    if (courseId) q.set("course_id", String(courseId));
    q.set("search", "");
    q.set("page", "1");
    return `?${q.toString()}`;
  })();

  const hasFilters = search !== "" || rating > 0 || courseId > 0;
  const hasSimpleFilters = search !== "" || rating > 0;

  const starRow = (s: number) => "★".repeat(s);

  return (
    <main className="ad-page-wrap">
      <div className="rv-page-inner">
        {/* Page header */}
        <div className="rv-page-header">
          <div>
            <h1 className="rv-page-title">Course Reviews</h1>
            <p className="rv-page-subtitle">Moderate and manage all student reviews across every course.</p>
          </div>
        </div>

        {/* Toast */}
        <div className="rv-toast" id="rvToast" role="alert" aria-live="polite"></div>

        {/* Stat cards */}
        <div className="rv-stats-grid">
          <div className="rv-stat-card rv-stat-card--total">
            <div className="rv-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">Total Reviews</span>
              <span className="rv-stat-value">{phpNumber(stats.totalAllReviews)}</span>
            </div>
          </div>

          <div className="rv-stat-card rv-stat-card--avg">
            <div className="rv-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">Average Rating</span>
              <span className="rv-stat-value">{stats.avgRating} <span className="rv-stat-unit">/ 5</span></span>
            </div>
          </div>

          {[5, 4].map((s) => {
            const count = stats.ratingMap[s] ?? 0;
            return (
              <div className="rv-stat-card" key={s}>
                <div className="rv-stat-icon rv-stat-icon--stars">{starRow(s)}</div>
                <div className="rv-stat-body">
                  <span className="rv-stat-label">{s}-Star Reviews</span>
                  <span className="rv-stat-value">{phpNumber(count)}</span>
                  {stats.totalAllReviews > 0 ? (
                    <div className="rv-stat-bar">
                      <div className="rv-stat-bar-fill" style={{ width: `${Math.round((count / stats.totalAllReviews) * 100)}%` }}></div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="rv-filter-bar">
          <form method="get" action="/admin/reviews" className="rv-filter-form" id="rvFilterForm">
            <div className="rv-filter-search">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" className="rv-filter-search-icon"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input type="text" name="search" className="rv-filter-input" placeholder="Search student, course, or review text…" defaultValue={search} autoComplete="off" />
              {search ? (
                <a href={clearSearchHref} className="rv-filter-clear" title="Clear search">✕</a>
              ) : null}
            </div>

            <div className="rv-filter-selects">
              <select name="course_id" className="rv-select js-filter-submit" defaultValue={String(courseId)}>
                <option value="0">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select name="rating" className="rv-select js-filter-submit" defaultValue={String(rating)}>
                <option value="0">All Ratings</option>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>
                ))}
              </select>

              <button type="submit" className="rv-btn rv-btn--primary">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M3 4h18M7 8h10M11 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Filter
              </button>

              {hasFilters ? (
                <a href="/admin/reviews" className="rv-btn rv-btn--ghost">Clear All</a>
              ) : null}
            </div>
          </form>

          <div className="rv-filter-results">
            Showing <strong>{phpNumber(rows.length)}</strong> of <strong>{phpNumber(total)}</strong> review{total !== 1 ? "s" : ""}
            {hasFilters ? <span className="rv-filter-badge">Filtered</span> : null}
          </div>
        </div>

        {/* Reviews table */}
        {rows.length === 0 ? (
          <div className="rv-empty">
            <svg viewBox="0 0 24 24" fill="none" width="48" height="48"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            <h3>No reviews found</h3>
            <p>{hasSimpleFilters ? "Try adjusting your filters." : "There are no reviews yet."}</p>
            {hasSimpleFilters ? (
              <a href="/admin/reviews" className="rv-btn rv-btn--primary" style={{ marginTop: "1rem" }}>Clear Filters</a>
            ) : null}
          </div>
        ) : (
          <div className="rv-table-wrap">
            <table className="rv-table" id="rvTable">
              <thead>
                <tr>
                  <th className="rv-th rv-th--date">Date</th>
                  <th className="rv-th rv-th--student">Student</th>
                  <th className="rv-th rv-th--course">Course</th>
                  <th className="rv-th rv-th--instructor">Instructor</th>
                  <th className="rv-th rv-th--rating">Rating</th>
                  <th className="rv-th rv-th--review">Review</th>
                  <th className="rv-th rv-th--actions">Actions</th>
                </tr>
              </thead>
              <tbody id="rvTableBody">
                {rows.map((review) => {
                  const ratingInt = Math.trunc(Number(review.rating) || 0);
                  const rawText = review.review_text ?? "";
                  const preview = rawText.length > 120 ? rawText.slice(0, 120) + "…" : rawText;
                  const hasMore = rawText.length > 120;
                  return (
                    <tr className="rv-tr" id={`rv-row-${review.id}`} key={review.id}>
                      <td className="rv-td rv-td--date">
                        <span className="rv-date-primary">{formatMonthDayYear(review.created_at)}</span>
                        <span className="rv-date-secondary">{formatClock12PHPM(review.created_at)}</span>
                      </td>

                      <td className="rv-td rv-td--student">
                        <div className="rv-person">
                          <div className="rv-avatar" aria-hidden="true">{review.student_name.slice(0, 1).toUpperCase()}</div>
                          <div>
                            <div className="rv-person-name">{review.student_name}</div>
                            <div className="rv-person-email">{review.student_email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="rv-td rv-td--course">
                        <a href={`/admin/courses?highlight=${review.course_id}`} className="rv-course-link">{review.course_title}</a>
                      </td>

                      <td className="rv-td rv-td--instructor">{review.instructor_name}</td>

                      <td className="rv-td rv-td--rating">
                        <div className="rv-stars-wrap">
                          <div className="rv-stars" aria-label={`${ratingInt} out of 5 stars`}>
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span className={`rv-star ${i <= ratingInt ? "rv-star--filled" : "rv-star--empty"}`} key={i}>★</span>
                            ))}
                          </div>
                          <span className="rv-rating-num">{ratingInt}.0</span>
                        </div>
                      </td>

                      <td className="rv-td rv-td--review">
                        <div className="rv-review-text">
                          <span className="rv-review-preview">{preview}</span>
                          {hasMore ? (
                            <button className="rv-expand-btn" data-full={rawText} data-preview={preview} type="button">Read more</button>
                          ) : null}
                        </div>
                      </td>

                      <td className="rv-td rv-td--actions">
                        <button className="rv-btn-icon rv-btn-icon--view js-view-review" title="View full review" data-review-id={review.id} data-student={review.student_name} data-course={review.course_title} data-rating={review.rating} data-text={rawText} data-date={`${formatLongDate(review.created_at)} – ${formatClock12PHPM(review.created_at)}`}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                        </button>
                        <button className="rv-btn-icon rv-btn-icon--delete js-delete-review" title="Delete review" data-review-id={review.id} data-student={review.student_name}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
          <nav className="rv-pagination" aria-label="Review pages">
            {pagination.map((t, i) => {
              if (t.kind === "ellipsis") return <span className="rv-page-ellipsis" key={`e${i}`}>{t.label}</span>;
              if (t.kind === "prev") return <a href={t.href} className="rv-page-btn rv-page-btn--arrow" aria-label="Previous page" key="prev">‹</a>;
              if (t.kind === "next") return <a href={t.href} className="rv-page-btn rv-page-btn--arrow" aria-label="Next page" key="next">›</a>;
              return (
                <a href={t.href} className={`rv-page-btn ${t.active ? "rv-page-btn--active" : ""}`} aria-current={t.active ? "page" : "false"} key={`p${t.label}`}>
                  {t.label}
                </a>
              );
            })}
          </nav>
        ) : null}
      </div>

      {/* View Review Modal */}
      <div className="rv-modal-overlay" id="rvViewModal" role="dialog" aria-modal="true" aria-labelledby="rvModalTitle" hidden>
        <div className="rv-modal">
          <div className="rv-modal-header">
            <h2 className="rv-modal-title" id="rvModalTitle">Review Detail</h2>
            <button className="rv-modal-close" data-close-modal="rvViewModal" aria-label="Close modal">✕</button>
          </div>
          <div className="rv-modal-body">
            <div className="rv-modal-meta">
              <div className="rv-modal-meta-row">
                <span className="rv-modal-label">Student</span>
                <span className="rv-modal-val" id="rvModalStudent"></span>
              </div>
              <div className="rv-modal-meta-row">
                <span className="rv-modal-label">Course</span>
                <span className="rv-modal-val" id="rvModalCourse"></span>
              </div>
              <div className="rv-modal-meta-row">
                <span className="rv-modal-label">Date</span>
                <span className="rv-modal-val" id="rvModalDate"></span>
              </div>
              <div className="rv-modal-meta-row">
                <span className="rv-modal-label">Rating</span>
                <span className="rv-modal-val rv-modal-stars" id="rvModalStars"></span>
              </div>
            </div>
            <div className="rv-modal-review-text" id="rvModalText"></div>
          </div>
          <div className="rv-modal-footer">
            <button className="rv-btn rv-btn--ghost" data-close-modal="rvViewModal">Close</button>
            <button className="rv-btn rv-btn--danger" id="rvModalDeleteBtn">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" /></svg>
              Delete Review
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <div className="rv-modal-overlay" id="rvDeleteModal" role="dialog" aria-modal="true" aria-labelledby="rvDeleteTitle" hidden>
        <div className="rv-modal rv-modal--sm">
          <div className="rv-modal-header rv-modal-header--danger">
            <h2 className="rv-modal-title" id="rvDeleteTitle">Delete Review?</h2>
            <button className="rv-modal-close" data-close-modal="rvDeleteModal" aria-label="Close">✕</button>
          </div>
          <div className="rv-modal-body">
            <p className="rv-modal-warn-text">
              You are about to permanently delete the review left by{" "}
              <strong id="rvDeleteStudent"></strong>.
              This action cannot be undone.
            </p>
          </div>
          <div className="rv-modal-footer">
            <button className="rv-btn rv-btn--ghost" data-close-modal="rvDeleteModal">Cancel</button>
            <button className="rv-btn rv-btn--danger" id="rvConfirmDeleteBtn">Yes, Delete</button>
          </div>
        </div>
      </div>

      <ReviewsScripts csrfToken={csrfToken} />
    </main>
  );
}
