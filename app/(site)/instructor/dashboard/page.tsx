import type { Metadata } from "next";
import "@/styles/css/instructor/dashboard.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { getInstructorOverviewStats } from "@/lib/db/instructor/analytics";
import { formatPrice, formatMonthDayYear, monthNameFromKey, phpRound, phpNumber } from "@/lib/format";
import { toNumber } from "@/lib/payments/amounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Instructor Dashboard – Edulari",
  description: "Overview of your teaching performance.",
  noindex: true,
  canonical: false,
});

export default async function InstructorDashboardPage() {
  const user = await requireInstructorApproved();
  const stats = await getInstructorOverviewStats(user.id);
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <main className="in-page-wrap">
      <div className="indash-page-inner">
        <div className="indash-page-header">
          <div className="indash-page-header-text">
            <h1 className="indash-page-title">Welcome back, {firstName} 👋</h1>
            <p className="indash-page-subtitle">Here&apos;s an overview of your teaching performance.</p>
          </div>
          <a href="/instructor/create-course" className="indash-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Create Course
          </a>
        </div>

        <div className="indash-stats-grid">
          <div className="indash-stat-card">
            <div className="indash-stat-icon indash-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="indash-stat-body">
              <span className="indash-stat-label">Total Courses</span>
              <span className="indash-stat-value">{stats.total_courses}</span>
              <span className="indash-stat-sub">{stats.published_courses} published</span>
            </div>
          </div>

          <div className="indash-stat-card">
            <div className="indash-stat-icon indash-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="indash-stat-body">
              <span className="indash-stat-label">Total Students</span>
              <span className="indash-stat-value">{stats.total_students}</span>
              <span className="indash-stat-sub">across all courses</span>
            </div>
          </div>

          <div className="indash-stat-card">
            <div className="indash-stat-icon indash-stat-icon--purple" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="indash-stat-body">
              <span className="indash-stat-label">Total Revenue</span>
              <span className="indash-stat-value">{formatPrice(stats.total_revenue)}</span>
              <span className="indash-stat-sub">lifetime earnings</span>
            </div>
          </div>

          <div className="indash-stat-card">
            <div className="indash-stat-icon indash-stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="indash-stat-body">
              <span className="indash-stat-label">Average Rating</span>
              <span className="indash-stat-value">{phpNumber(stats.avg_course_rating, 1)}<small>/5</small></span>
              <span className="indash-stat-sub">across all courses</span>
            </div>
          </div>
        </div>

        <div className="indash-two-col">
          <section className="indash-card">
            <div className="indash-card-header">
              <h2 className="indash-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Top Performing Courses
              </h2>
              <a href="/instructor/courses" className="indash-card-action">View all</a>
            </div>

            {stats.top_courses.length > 0 ? (
              <div className="indash-table-wrap">
                <table className="indash-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Enrollments</th>
                      <th>Rating</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_courses.map((course) => (
                      <tr key={course.id}>
                        <td className="indash-td-title">{course.title}</td>
                        <td>{course.enrollment_count}</td>
                        <td>
                          <span className="indash-rating-badge">★ {phpRound(Number(course.avg_rating ?? 0), 1)}</span>
                        </td>
                        <td className="indash-td-money">{formatPrice(toNumber(course.price) * course.enrollment_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="indash-empty-state">
                <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <p>No courses yet.</p>
                <a href="/instructor/create-course" className="indash-empty-link">Create your first course</a>
              </div>
            )}
          </section>

          <section className="indash-card">
            <div className="indash-card-header">
              <h2 className="indash-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Recent Enrollments
              </h2>
              <a href="/instructor/students" className="indash-card-action">View all</a>
            </div>

            {stats.recent_enrollments.length > 0 ? (
              <div className="indash-table-wrap">
                <table className="indash-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Date</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_enrollments.map((e, i) => (
                      <tr key={i}>
                        <td className="indash-td-student">
                          <span className="indash-student-avatar" aria-hidden="true">
                            {e.student_name.slice(0, 1).toUpperCase()}
                          </span>
                          {e.student_name}
                        </td>
                        <td className="indash-td-title">{e.course_title}</td>
                        <td>{formatMonthDayYear(e.enrolled_at)}</td>
                        <td>
                          <div className="indash-progress-wrap" aria-label={`${e.progress_percentage}% complete`}>
                            <div className="indash-progress-bar">
                              <div className="indash-progress-fill" style={{ width: `${Math.min(100, e.progress_percentage)}%` }} />
                            </div>
                            <span className="indash-progress-label">{e.progress_percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="indash-empty-state">
                <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <p>No enrollments yet.</p>
              </div>
            )}
          </section>
        </div>

        <section className="indash-card">
          <div className="indash-card-header">
            <h2 className="indash-card-title">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Monthly Revenue
            </h2>
            <a href="/instructor/earnings" className="indash-card-action">Full report</a>
          </div>

          {stats.monthly_revenue.length > 0 ? (
            <div className="indash-table-wrap">
              <table className="indash-table">
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
                      <td className="indash-td-money">{formatPrice(m.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="indash-empty-state">
              <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>No revenue data available yet.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}