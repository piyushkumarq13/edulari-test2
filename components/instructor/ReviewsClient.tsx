"use client";

import { useEffect, useRef } from "react";
import { formatMonthDayYear, maskEmail } from "@/lib/format";
import { getAvatarUrl } from "@/lib/storage/media-urls";

export type ReviewRow = {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
  student_name: string;
  student_email: string;
  student_avatar: string | null;
  course_id: number | null;
  course_title: string | null;
  course_slug: string | null;
};

export type ReviewFilters = {
  tab: "course" | "personal";
  courseId: number;
  rating: number;
  search: string;
  sort: string;
};

export type BreakdownStats = {
  total: number;
  avg: number;
  five: number;
  four: number;
  three: number;
  two: number;
  one: number;
};

export type ActivityRow = {
  type: "course" | "personal";
  rating: number;
  created_at: string;
  student_name: string;
  context: string;
};

/**
 * reviews.php's client behaviour, in three pieces:
 *  - the tab bar (real links, so switching tabs is a full page load as in the PHP),
 *  - the filter form, which auto-submits whenever one of its three selects changes,
 *  - the rating breakdown bars, which animate from 0% to data-pct% on load.
 * The review list and the activity feed are rendered alongside so the animation effect and
 * the list share one component tree.
 */
export default function ReviewsClient({
  filters,
  courseCourses,
  reviews,
  isFiltered,
  courseStats,
  personalStats,
}: {
  filters: ReviewFilters;
  courseCourses: Array<{ id: number; title: string }>;
  reviews: ReviewRow[];
  isFiltered: boolean;
  courseStats: BreakdownStats;
  personalStats: BreakdownStats;
  activity: ActivityRow[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const isCourse = filters.tab === "course";

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).classList.contains("rv-select")) form.submit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  // The PHP set every bar to 0% then restored it on the next frame + an 80 ms timeout.
  useEffect(() => {
    const bars = Array.from(document.querySelectorAll<HTMLElement>(".rv-bd-bar-fill"));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const frames = bars.map((bar) => {
      const pct = bar.dataset.pct || "0";
      bar.style.width = "0%";
      return requestAnimationFrame(() => {
        timers.push(setTimeout(() => { bar.style.width = pct + "%"; }, 80));
      });
    });
    return () => {
      frames.forEach(cancelAnimationFrame);
      timers.forEach(clearTimeout);
    };
  }, []);

  const tabHref = (tab: "course" | "personal") => {
    // The PHP carried search/rating/sort across the tab switch but dropped the course filter.
    const q = new URLSearchParams({ tab });
    if (filters.search) q.set("search", filters.search);
    if (filters.rating) q.set("rating", String(filters.rating));
    if (filters.sort !== "newest") q.set("sort", filters.sort);
    return `?${q.toString()}#rv-tab-anchor`;
  };

  const tabBase = `/instructor/reviews`;

  return (
    <>
      <div id="rv-tab-anchor" />
      <div className="rv-tab-bar">
        <a href={`${tabBase}${tabHref("course")}`} className={`rv-tab ${isCourse ? "rv-tab--active" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Course Reviews
          <span className="rv-tab-badge">{courseStats.total}</span>
        </a>
        <a href={`${tabBase}${tabHref("personal")}`} className={`rv-tab ${!isCourse ? "rv-tab--active" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Personal Ratings
          <span className="rv-tab-badge">{personalStats.total}</span>
        </a>
      </div>

      <div className="rv-filters-card">
        <form method="get" className="rv-filters-form" role="search" action={tabBase} ref={formRef}>
          <input type="hidden" name="tab" value={filters.tab} />

          <div className="rv-search-wrap">
            <svg className="rv-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              name="search"
              className="rv-search-input"
              placeholder={isCourse ? "Search reviews, students, courses…" : "Search reviews, students…"}
              defaultValue={filters.search}
              aria-label="Search reviews"
            />
          </div>

          <div className="rv-filters-row">
            {isCourse ? (
              <select name="course" className="rv-select" aria-label="Filter by course" defaultValue={filters.courseId ? String(filters.courseId) : ""}>
                <option value="">All Courses</option>
                {courseCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            ) : null}

            <select name="rating" className="rv-select" aria-label="Filter by rating" defaultValue={filters.rating ? String(filters.rating) : ""}>
              <option value="">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} Star{r > 1 ? "s" : ""}</option>
              ))}
            </select>

            <select name="sort" className="rv-select" aria-label="Sort reviews" defaultValue={filters.sort}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>

            <div className="rv-filter-actions">
              <button type="submit" className="rv-btn rv-btn--primary">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="11" y1="18" x2="13" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Apply
              </button>
              {isFiltered ? <a href={`?tab=${filters.tab}`} className="rv-btn rv-btn--ghost">Clear</a> : null}
            </div>
          </div>
        </form>

        <p className="rv-result-count">
          <strong>{reviews.length}</strong> {isCourse ? "review" : "rating"}{reviews.length !== 1 ? "s" : ""} found
          {isFiltered ? <a href={`?tab=${filters.tab}`} className="rv-clear-link">Clear filters</a> : null}
        </p>
      </div>

      {reviews.length > 0 ? (
        <div className="rv-reviews-list">
          {reviews.map((review) => {
            const ratingInt = Math.trunc(Number(review.rating));
            const text = review.review_text ?? "";
            const lines = text.trim().split("\n");
            const hasText = Boolean(text.trim());
            const initials = review.student_name.slice(0, 1).toUpperCase();
            return (
              <article className="rv-review-card" key={review.id}>
                <div className="rv-review-header">
                  <div className="rv-reviewer">
                    {review.student_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getAvatarUrl(review.student_avatar)} alt={review.student_name} className="rv-avatar-img" width={44} height={44} />
                    ) : (
                      <span className="rv-avatar-initials" aria-hidden="true">{initials}</span>
                    )}
                    <div className="rv-reviewer-info">
                      <span className="rv-reviewer-name">{review.student_name}</span>
                      <span className="rv-reviewer-email">{maskEmail(review.student_email)}</span>
                    </div>
                  </div>
                  <div className="rv-review-meta">
                    <div className="rv-stars" aria-label={`${ratingInt} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} viewBox="0 0 24 24" width="16" height="16"
                          fill={s <= ratingInt ? "#f59e0b" : "#e2e8f0"}
                          stroke={s <= ratingInt ? "#f59e0b" : "#cbd5e1"}
                          strokeWidth="1.5">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                      <span className="rv-rating-num">{`${ratingInt}.0`}</span>
                    </div>
                    <span className="rv-review-date">{formatMonthDayYear(review.created_at)}</span>
                  </div>
                </div>

                {isCourse && review.course_title ? (
                  <div className="rv-course-badge">
                    <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    <a href={review.course_slug ? `/course/${review.course_slug}` : `/course?slug=${review.course_id}`} className="rv-course-link">{review.course_title}</a>
                  </div>
                ) : null}

                {hasText ? (
                  <div className="rv-review-body">
                    <p className="rv-review-text">
                      {lines.map((line, i) => (
                        <span key={i}>
                          {line}
                          {i < lines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </p>
                  </div>
                ) : (
                  <div className="rv-review-body rv-review-body--empty">
                    <p className="rv-no-text">No written review left.</p>
                  </div>
                )}

                <div className="rv-review-footer">
                  <span className={`rv-rating-badge rv-rating-badge--${ratingInt >= 4 ? "green" : ratingInt === 3 ? "amber" : "red"}`}>
                    {ratingInt >= 4 ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {ratingInt === 5 ? "Excellent" : "Good"}
                      </>
                    ) : ratingInt === 3 ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                        Average
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        {ratingInt === 2 ? "Poor" : "Critical"}
                      </>
                    )}
                  </span>
                  {isCourse && review.course_id ? (
                    <a href={`/instructor/course-analytics?id=${review.course_id}`} className="rv-link-btn">Course Analytics →</a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}