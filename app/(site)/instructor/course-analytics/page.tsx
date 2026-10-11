import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/styles/css/instructor/course-analytics.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { getCourseById, getCourseStats } from "@/lib/db/instructor/courses";
import {
  getCourseDetailedAnalytics,
  getCourseStudentProgress,
} from "@/lib/db/instructor/analytics";
import { formatPrice, formatMonthDayYear, maskEmail, phpNumber, phpRound } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Course Analytics – Edulari",
  description: "Detailed analytics for this course.",
  noindex: true,
  canonical: false,
});

export default async function CourseAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;
  const courseId = Number(sp.id ?? 0);

  const course = Number.isFinite(courseId) && courseId > 0 ? await getCourseById(courseId, user.id) : null;
  if (!course) redirect("/instructor/courses");

  const [stats, detailed, students] = await Promise.all([
    getCourseStats(courseId, user.id),
    getCourseDetailedAnalytics(courseId, user.id),
    getCourseStudentProgress(courseId, user.id, 20, 0),
  ]);

  const totalStudents = stats?.total_students ?? 0;
  const completedStudents = stats?.completed_students ?? 0;
  const completionPct = totalStudents > 0 ? phpRound((completedStudents / totalStudents) * 100, 1) : "0";
  const dist = detailed?.progress_distribution ?? [];
  const distTotal = dist.reduce((n, d) => n + d.count, 0);
  const trend = detailed?.enrollment_trend ?? [];
  const quiz = detailed?.quiz_performance ?? [];
  const rows = students ?? [];

  return (
    <main className="in-page-wrap">
      <div className="inca-page-inner">
        <nav className="inca-breadcrumb" aria-label="Breadcrumb">
          <a href="/instructor/analytics" className="inca-breadcrumb-link">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Analytics
          </a>
          <span className="inca-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="inca-breadcrumb-current">{course.title}</span>
        </nav>

        <div className="inca-page-header">
          <div className="inca-page-header-text">
            <h1 className="inca-page-title">{course.title}</h1>
            <p className="inca-page-subtitle">Detailed analytics for this course.</p>
          </div>
          <div className="inca-page-header-actions">
            <a href={`/instructor/course-content?id=${courseId}`} className="inca-btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit Content
            </a>
            <a href={`/instructor/edit-course?id=${courseId}`} className="inca-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" />
              </svg>
              Edit Course
            </a>
          </div>
        </div>

        <div className="inca-stats-grid">
          <div className="inca-stat-card">
            <div className="inca-stat-icon inca-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="inca-stat-body">
              <span className="inca-stat-label">Total Students</span>
              <span className="inca-stat-value">{totalStudents}</span>
              <span className="inca-stat-sub">enrolled</span>
            </div>
          </div>

          <div className="inca-stat-card">
            <div className="inca-stat-icon inca-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inca-stat-body">
              <span className="inca-stat-label">Completed</span>
              <span className="inca-stat-value">{completedStudents}</span>
              <span className="inca-stat-sub">{completionPct}% completion rate</span>
            </div>
          </div>

          <div className="inca-stat-card">
            <div className="inca-stat-icon inca-stat-icon--indigo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inca-stat-body">
              <span className="inca-stat-label">Avg. Progress</span>
              <span className="inca-stat-value">{phpRound(stats?.avg_progress ?? 0, 1)}<small>%</small></span>
              <span className="inca-stat-sub">across all students</span>
            </div>
          </div>

          <div className="inca-stat-card">
            <div className="inca-stat-icon inca-stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="inca-stat-body">
              <span className="inca-stat-label">Average Rating</span>
              <span className="inca-stat-value">{phpNumber(stats?.avg_rating ?? 0, 1)}<small>/5</small></span>
              <span className="inca-stat-sub">{stats?.total_reviews ?? 0} reviews</span>
            </div>
          </div>

          <div className="inca-stat-card">
            <div className="inca-stat-icon inca-stat-icon--purple" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="inca-stat-body">
              <span className="inca-stat-label">Total Revenue</span>
              <span className="inca-stat-value">{formatPrice(stats?.total_revenue ?? 0)}</span>
              <span className="inca-stat-sub">from this course</span>
            </div>
          </div>
        </div>

        <div className="inca-two-col">
          <section className="inca-card">
            <div className="inca-card-header">
              <h2 className="inca-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                  <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Progress Distribution
              </h2>
            </div>

            {dist.length > 0 ? (
              <div className="inca-table-wrap">
                <table className="inca-table">
                  <thead>
                    <tr>
                      <th>Range</th>
                      <th>Students</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dist.map((range) => {
                      const sharePct = distTotal > 0 ? phpRound((range.count / distTotal) * 100, 1) : "0";
                      return (
                        <tr key={range.range_label}>
                          <td>{range.range_label}</td>
                          <td>{range.count}</td>
                          <td>
                            <div className="inca-dist-bar-wrap">
                              <div className="inca-dist-bar">
                                <div className="inca-dist-bar-fill" style={{ width: `${sharePct}%` }} />
                              </div>
                              <span>{sharePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="inca-empty-state">
                <p>No progress data yet.</p>
              </div>
            )}
          </section>

          <section className="inca-card">
            <div className="inca-card-header">
              <h2 className="inca-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Enrollment Trend
              </h2>
              <span className="inca-card-meta">Last 30 days</span>
            </div>

            {trend.length > 0 ? (
              <div className="inca-table-wrap">
                <table className="inca-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>New Enrollments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((day) => (
                      <tr key={day.date}>
                        <td>{formatMonthDayYear(day.date)}</td>
                        <td>{day.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="inca-empty-state">
                <p>No enrollments in the last 30 days.</p>
              </div>
            )}
          </section>
        </div>

        {quiz.length > 0 ? (
          <section className="inca-card">
            <div className="inca-card-header">
              <h2 className="inca-card-title">
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Quiz Performance
              </h2>
            </div>
            <div className="inca-table-wrap">
              <table className="inca-table">
                <thead>
                  <tr>
                    <th>Lesson / Quiz</th>
                    <th>Attempts</th>
                    <th>Avg. Score</th>
                  </tr>
                </thead>
                <tbody>
                  {quiz.map((q) => (
                    <tr key={q.lesson_title}>
                      <td className="inca-td-title">{q.lesson_title}</td>
                      <td>{q.attempt_count}</td>
                      <td>
                        {q.avg_score !== null ? (
                          <span className="inca-score-badge">{phpRound(q.avg_score, 1)}%</span>
                        ) : (
                          <span className="inca-muted">No attempts</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="inca-card">
          <div className="inca-card-header">
            <h2 className="inca-card-title">
              <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              </svg>
              Student Progress
            </h2>
            <span className="inca-card-meta">Most recent 20</span>
          </div>

          {rows.length > 0 ? (
            <div className="inca-table-wrap">
              <table className="inca-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Enrolled</th>
                    <th>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td className="inca-td-student">
                        <span className="inca-student-avatar" aria-hidden="true">{s.name.slice(0, 1).toUpperCase()}</span>
                        {s.name}
                      </td>
                      <td className="inca-td-email">{maskEmail(s.email)}</td>
                      <td className="inca-td-date">{formatMonthDayYear(s.enrolled_at)}</td>
                      <td>
                        <div className="inca-progress-wrap" aria-label={`${s.progress_percentage}% complete`}>
                          <div className="inca-progress-bar">
                            <div className="inca-progress-fill" style={{ width: `${Math.min(100, s.progress_percentage)}%` }} />
                          </div>
                          <span className="inca-progress-label">{s.progress_percentage}%</span>
                        </div>
                      </td>
                      <td>
                        {s.completed_at ? (
                          <span className="inca-badge inca-badge--success">Completed</span>
                        ) : (
                          <span className="inca-badge inca-badge--info">In Progress</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inca-empty-state">
              <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <p>No students enrolled yet.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}