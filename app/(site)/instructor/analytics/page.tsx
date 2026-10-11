import type { Metadata } from "next";
import "@/styles/css/instructor/analytics.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { getInstructorOverviewStats } from "@/lib/db/instructor/analytics";
import { formatPrice, monthNameFromKey, phpNumber, phpRound } from "@/lib/format";
import { toNumber } from "@/lib/payments/amounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Analytics - Edulari",
  description: "Track your performance across all courses.",
  noindex: true,
  canonical: false,
});

export default async function InstructorAnalyticsPage() {
  const user = await requireInstructorApproved();
  const stats = await getInstructorOverviewStats(user.id);

  return (
    <main className="in-page-wrap">
      <div className="inan-page-inner">
        <div className="inan-page-header">
          <div className="inan-page-header-text">
            <h1 className="inan-page-title">Analytics</h1>
            <p className="inan-page-subtitle">Track your performance across all courses.</p>
          </div>
        </div>

        <div className="inan-stats-grid">
          <div className="inan-stat-card">
            <div className="inan-stat-icon inan-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inan-stat-body">
              <span className="inan-stat-label">Total Courses</span>
              <span className="inan-stat-value">{stats.total_courses}</span>
              <span className="inan-stat-sub">{stats.published_courses} published</span>
            </div>
          </div>

          <div className="inan-stat-card">
            <div className="inan-stat-icon inan-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="inan-stat-body">
              <span className="inan-stat-label">Total Students</span>
              <span className="inan-stat-value">{stats.total_students}</span>
              <span className="inan-stat-sub">unique learners</span>
            </div>
          </div>

          <div className="inan-stat-card">
            <div className="inan-stat-icon inan-stat-icon--purple" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="inan-stat-body">
              <span className="inan-stat-label">Total Revenue</span>
              <span className="inan-stat-value">{formatPrice(stats.total_revenue)}</span>
              <span className="inan-stat-sub">lifetime earnings</span>
            </div>
          </div>

          <div className="inan-stat-card">
            <div className="inan-stat-icon inan-stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inan-stat-body">
              <span className="inan-stat-label">Average Rating</span>
              <span className="inan-stat-value">{phpNumber(stats.avg_course_rating, 1)}<small>/5</small></span>
              <span className="inan-stat-sub">across all courses</span>
            </div>
          </div>
        </div>

        <section className="inan-card">
          <div className="inan-card-header">
            <h2 className="inan-card-title">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Monthly Revenue Trend
            </h2>
            <span className="inan-card-meta">Last 6 months</span>
          </div>

          {stats.monthly_revenue.length > 0 ? (
            <div className="inan-table-wrap">
              <table className="inan-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Enrollments</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthly_revenue.map((m) => (
                    <tr key={m.month}>
                      <td>{monthNameFromKey(m.month)}</td>
                      <td>{m.enrollments}</td>
                      <td className="inan-td-money">{formatPrice(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inan-empty-state">
              <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p>No revenue data available yet.</p>
            </div>
          )}
        </section>

        <section className="inan-card">
          <div className="inan-card-header">
            <h2 className="inan-card-title">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Top Performing Courses
            </h2>
            <a href="/instructor/courses" className="inan-card-action">View all courses</a>
          </div>

          {stats.top_courses.length > 0 ? (
            <div className="inan-table-wrap">
              <table className="inan-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Enrollments</th>
                    <th>Rating</th>
                    <th>Revenue</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_courses.map((course) => (
                    <tr key={course.id}>
                      <td className="inan-td-title">{course.title}</td>
                      <td>{course.enrollment_count}</td>
                      <td>
                        {course.avg_rating ? (
                          <span className="inan-rating-badge">★ {phpRound(Number(course.avg_rating), 1)}</span>
                        ) : (
                          <span className="inan-muted">N/A</span>
                        )}
                      </td>
                      <td className="inan-td-money">{formatPrice(toNumber(course.price) * course.enrollment_count)}</td>
                      <td>
                        <a href={`/instructor/course-analytics?id=${course.id}`} className="inan-link-btn">Details</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inan-empty-state">
              <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <p>No published courses with enrollments yet.</p>
              <a href="/instructor/create-course" className="inan-empty-link">Create your first course</a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}