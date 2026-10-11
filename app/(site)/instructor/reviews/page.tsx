import type { Metadata } from "next";
import "@/styles/css/instructor/reviews.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import {
  getCourseReviewOverview,
  getPersonalRatingOverview,
  getCourseReviews,
  getPersonalRatings,
  getRecentReviewActivity,
} from "@/lib/db/instructor/reviews";
import { getPublishedCourseOptions } from "@/lib/db/instructor/courses";
import { formatMonthDayYear, phpNumber } from "@/lib/format";
import ReviewsClient, { type ReviewRow, type BreakdownStats } from "@/components/instructor/ReviewsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "My Reviews – Edulari",
  description: "Monitor feedback from students across your courses and instructor profile.",
  noindex: true,
  canonical: false,
});

const SORTS = ["newest", "oldest", "highest", "lowest"] as const;

export default async function InstructorReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; course?: string; rating?: string; search?: string; sort?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;

  const tab = sp.tab === "personal" ? "personal" : "course";
  const courseId = Number(sp.course ?? 0);
  const ratingRaw = Number(sp.rating ?? 0);
  const rating = ratingRaw > 0 && ratingRaw <= 5 ? ratingRaw : 0;
  const search = (sp.search ?? "").trim();
  const sortRaw = sp.sort ?? "newest";
  const sort = (SORTS as readonly string[]).includes(sortRaw) ? sortRaw : "newest";

  const [courseStatsRaw, personalStatsRaw, courses, activity, courseReviews, personalReviews] =
    await Promise.all([
      getCourseReviewOverview(user.id),
      getPersonalRatingOverview(user.id),
      getPublishedCourseOptions(user.id),
      getRecentReviewActivity(user.id),
      getCourseReviews(user.id, {
        courseId: courseId > 0 ? courseId : undefined,
        rating: rating || undefined,
        search,
        sort: sort as (typeof SORTS)[number],
      }),
      getPersonalRatings(user.id, {
        rating: rating || undefined,
        search,
        sort: sort as (typeof SORTS)[number],
      }),
    ]);

  const courseStats: BreakdownStats = {
    total: courseStatsRaw.total_course_reviews,
    avg: courseStatsRaw.avg_course_rating,
    five: courseStatsRaw.five_star,
    four: courseStatsRaw.four_star,
    three: courseStatsRaw.three_star,
    two: courseStatsRaw.two_star,
    one: courseStatsRaw.one_star,
  };
  const personalStats: BreakdownStats = {
    total: personalStatsRaw.total_personal_reviews,
    avg: personalStatsRaw.avg_personal_rating,
    five: personalStatsRaw.five_star,
    four: personalStatsRaw.four_star,
    three: personalStatsRaw.three_star,
    two: personalStatsRaw.two_star,
    one: personalStatsRaw.one_star,
  };

  const toRow = (r: (typeof courseReviews)[number]): ReviewRow => ({
    id: r.id,
    rating: Number(r.rating),
    review_text: r.review_text,
    created_at: String(r.created_at),
    student_name: r.student_name,
    student_email: r.student_email,
    student_avatar: r.student_avatar,
    course_id: r.course_id === null ? null : Number(r.course_id),
    course_title: r.course_title,
    course_slug: r.course_slug,
  });

  const isCourse = tab === "course";
  const isFiltered = courseId > 0 || rating > 0 || search !== "" || sort !== "newest";

  return (
    <main className="in-page-wrap">
      <div className="rv-page-inner">
        <div className="rv-page-header">
          <div className="rv-page-header-text">
            <h1 className="rv-page-title">My Reviews</h1>
            <p className="rv-page-subtitle">Monitor feedback from students across your courses and instructor profile.</p>
          </div>
          <div className="rv-page-header-actions">
            <a href="/instructor/analytics" className="rv-btn rv-btn--secondary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              View Analytics
            </a>
          </div>
        </div>

        <div className="rv-stats-grid">
          <div className="rv-stat-card">
            <div className="rv-stat-icon rv-stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">Course Avg. Rating</span>
              <span className="rv-stat-value">{phpNumber(courseStats.avg, 1)}<small>/5</small></span>
              <span className="rv-stat-sub">{courseStats.total} course reviews</span>
            </div>
          </div>

          <div className="rv-stat-card">
            <div className="rv-stat-icon rv-stat-icon--purple" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">Personal Avg. Rating</span>
              <span className="rv-stat-value">{phpNumber(personalStats.avg, 1)}<small>/5</small></span>
              <span className="rv-stat-sub">{personalStats.total} personal ratings</span>
            </div>
          </div>

          <div className="rv-stat-card">
            <div className="rv-stat-icon rv-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">Total Reviews</span>
              <span className="rv-stat-value">{courseStats.total + personalStats.total}</span>
              <span className="rv-stat-sub">across all categories</span>
            </div>
          </div>

          <div className="rv-stat-card">
            <div className="rv-stat-icon rv-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="rv-stat-body">
              <span className="rv-stat-label">5-Star Reviews</span>
              <span className="rv-stat-value">{courseStats.five + personalStats.five}</span>
              <span className="rv-stat-sub">top-rated feedback</span>
            </div>
          </div>
        </div>

        <div className="rv-overview-grid">
          <section className="rv-card rv-breakdown-card">
            <div className="rv-card-header">
              <h2 className="rv-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Rating Breakdown
              </h2>
            </div>
            <div className="rv-breakdown-tabs">
              <a className={`rv-bd-tab ${isCourse ? "rv-bd-tab--active" : ""}`} href={`?tab=course`}>Course Reviews</a>
              <a className={`rv-bd-tab ${!isCourse ? "rv-bd-tab--active" : ""}`} href={`?tab=personal`}>Personal Ratings</a>
            </div>

            <div className="rv-breakdown-panel" id="bd-course" hidden={!isCourse}>
              <div className="rv-big-rating">
                <span className="rv-big-rating-num">{courseStats.avg > 0 ? phpNumber(courseStats.avg, 1) : "–"}</span>
                <div className="rv-big-rating-right">
                  <div className="rv-stars-row" aria-label={`${courseStats.avg} out of 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} viewBox="0 0 24 24" width="18" height="18"
                        fill={s <= Math.round(courseStats.avg) ? "#f59e0b" : "none"}
                        stroke="#f59e0b" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="rv-big-rating-count">{courseStats.total} reviews</span>
                </div>
              </div>
              <BreakdownRows stats={courseStats} />
            </div>

            <div className="rv-breakdown-panel" id="bd-personal" hidden={isCourse}>
              <div className="rv-big-rating">
                <span className="rv-big-rating-num">{personalStats.avg > 0 ? phpNumber(personalStats.avg, 1) : "–"}</span>
                <div className="rv-big-rating-right">
                  <div className="rv-stars-row" aria-label={`${personalStats.avg} out of 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} viewBox="0 0 24 24" width="18" height="18"
                        fill={s <= Math.round(personalStats.avg) ? "#f59e0b" : "none"}
                        stroke="#f59e0b" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="rv-big-rating-count">{personalStats.total} ratings</span>
                </div>
              </div>
              <BreakdownRows stats={personalStats} />
            </div>
          </section>

          <section className="rv-card rv-activity-card">
            <div className="rv-card-header">
              <h2 className="rv-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Recent Activity
              </h2>
            </div>

            {activity.length > 0 ? (
              <div className="rv-activity-list">
                {activity.map((act, i) => (
                  <div className="rv-activity-item" key={i}>
                    <div className={`rv-activity-icon rv-activity-icon--${act.type === "personal" ? "purple" : "amber"}`} aria-hidden="true">
                      {act.type === "personal" ? (
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="rv-activity-body">
                      <p className="rv-activity-text">
                        <strong>{act.student_name}</strong> rated <em>{act.context}</em>
                      </p>
                      <div className="rv-activity-meta">
                        <span className="rv-mini-stars" aria-label={`${act.rating} stars`}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} viewBox="0 0 24 24" width="11" height="11"
                              fill={s <= Number(act.rating) ? "#f59e0b" : "#e2e8f0"} stroke="none">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </span>
                        <span className="rv-activity-date">{formatMonthDayYear(String(act.created_at))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rv-empty-mini">
                <p>No recent activity yet.</p>
              </div>
            )}
          </section>
        </div>

        <ReviewsClient
          filters={{ tab, courseId, rating, search, sort }}
          courseCourses={courses}
          reviews={isCourse ? courseReviews.map(toRow) : personalReviews.map(toRow)}
          isFiltered={isFiltered}
          courseStats={courseStats}
          personalStats={personalStats}
          activity={[]}
        />

        {!isFiltered && (isCourse ? courseReviews : personalReviews).length === 0 ? (
          <div className="rv-empty-state">
            <div className="rv-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="52" height="52">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="rv-empty-title">No {isCourse ? "course reviews" : "personal ratings"} yet.</p>
            <p className="rv-empty-sub">
              {isCourse
                ? "Once students review your courses, their feedback will appear here."
                : "Personal ratings from students will appear here once they rate your instructor profile."}
            </p>
            <a href="/instructor/courses" className="rv-btn rv-btn--primary">View My Courses</a>
          </div>
        ) : null}

        {isFiltered && (isCourse ? courseReviews : personalReviews).length === 0 ? (
          <div className="rv-empty-state">
            <div className="rv-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="52" height="52">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="rv-empty-title">No reviews match your filters.</p>
            <p className="rv-empty-sub">Try adjusting or clearing your filters.</p>
            <a href={`?tab=${tab}`} className="rv-btn rv-btn--primary">Clear All Filters</a>
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** The five breakdown bars; the PHP rounded the share to a whole percent. */
function BreakdownRows({ stats }: { stats: BreakdownStats }) {
  const rows: Array<[number, number]> = [
    [5, stats.five],
    [4, stats.four],
    [3, stats.three],
    [2, stats.two],
    [1, stats.one],
  ];
  return (
    <>
      {rows.map(([star, count]) => {
        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
        const tone = star >= 4 ? "green" : star === 3 ? "amber" : "red";
        return (
          <div className="rv-breakdown-row" key={star}>
            <span className="rv-bd-label">{`${star} ★`}</span>
            <div className="rv-bd-bar-wrap">
              <div className="rv-bd-bar">
                <div
                  className={`rv-bd-bar-fill rv-bd-bar-fill--${tone}`}
                  style={{ width: `${pct}%` }}
                  data-pct={pct}
                />
              </div>
            </div>
            <span className="rv-bd-count">{count}</span>
          </div>
        );
      })}
    </>
  );
}