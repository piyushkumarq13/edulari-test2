import type { Metadata } from "next";
import "@/styles/css/instructor/students.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import {
  getInstructorStudents,
  getStudentCourseDetails,
  getStudentOverviewStats,
} from "@/lib/db/instructor/analytics";
import { getPublishedCourseOptions } from "@/lib/db/instructor/courses";
import { formatMonthDayYear, phpNumber } from "@/lib/format";
import StudentsTable, { type StudentRow, type StudentCourseDetail } from "@/components/instructor/StudentsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "My Students – Edulari",
  description: "Monitor progress and engagement across all your courses.",
  noindex: true,
  canonical: false,
});

const SORTS = ["last_enrollment", "name", "progress"] as const;
const PROGRESSES = ["not_started", "in_progress", "completed"] as const;

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; course?: string; progress?: string; sort?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;

  const search = (sp.search ?? "").trim();
  const courseId = Number(sp.course ?? 0);
  const progressRaw = sp.progress ?? "";
  const progress = (PROGRESSES as readonly string[]).includes(progressRaw)
    ? (progressRaw as (typeof PROGRESSES)[number])
    : undefined;
  const sortRaw = sp.sort ?? "last_enrollment";
  const sort = (SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof SORTS)[number])
    : "last_enrollment";

  const [overview, courses, students] = await Promise.all([
    getStudentOverviewStats(user.id),
    getPublishedCourseOptions(user.id),
    getInstructorStudents(user.id, { search, courseId: courseId > 0 ? courseId : undefined, progress, sort }),
  ]);

  const detailMap = await getStudentCourseDetails(students.map((s) => s.id), user.id);
  const details: Record<number, StudentCourseDetail[]> = {};
  for (const [studentId, rows] of detailMap) {
    details[studentId] = rows.map((r) => ({
      course_id: Number(r.course_id),
      course_title: r.course_title,
      progress_percentage: Number(r.progress_percentage),
      enrolled_at: String(r.enrolled_at),
      completed_at: r.completed_at ? String(r.completed_at) : null,
      rating: r.rating === null ? null : Number(r.rating),
    }));
  }

  // Changing only the sort marks the page as filtered in the PHP, so "Clear" appears too.
  const isFiltered = Boolean(search || courseId > 0 || progressRaw || sort !== "last_enrollment");

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    profile_image: s.profile_image,
    courses_enrolled: Number(s.courses_enrolled),
    avg_progress: Number(s.avg_progress),
    courses_completed: Number(s.courses_completed),
    first_enrollment: String(s.first_enrollment),
    last_enrollment: String(s.last_enrollment),
  }));

  const formatDate = (v: string) => formatMonthDayYear(v);

  return (
    <main className="in-page-wrap">
      <div className="st-page-inner">
        <div className="st-page-header">
          <div className="st-page-header-text">
            <h1 className="st-page-title">My Students</h1>
            <p className="st-page-subtitle">Monitor progress and engagement across all your courses.</p>
          </div>
          <div className="st-page-header-actions">
            <a href="/instructor/analytics" className="st-btn st-btn--secondary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              View Analytics
            </a>
          </div>
        </div>

        <div className="st-stats-grid">
          <div className="st-stat-card">
            <div className="st-stat-icon st-stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="st-stat-body">
              <span className="st-stat-label">Total Students</span>
              <span className="st-stat-value">{overview.total_students}</span>
              <span className="st-stat-sub">unique learners</span>
            </div>
          </div>

          <div className="st-stat-card">
            <div className="st-stat-icon st-stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="st-stat-body">
              <span className="st-stat-label">Completions</span>
              <span className="st-stat-value">{overview.completed_students}</span>
              <span className="st-stat-sub">finished a course</span>
            </div>
          </div>

          <div className="st-stat-card">
            <div className="st-stat-icon st-stat-icon--indigo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="st-stat-body">
              <span className="st-stat-label">Avg. Progress</span>
              <span className="st-stat-value">
                {phpNumber(overview.avg_progress, 1)}<small>%</small>
              </span>
              <span className="st-stat-sub">across all enrollments</span>
            </div>
          </div>

          <div className="st-stat-card">
            <div className="st-stat-icon st-stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="st-stat-body">
              <span className="st-stat-label">New This Month</span>
              <span className="st-stat-value">{overview.new_this_month}</span>
              <span className="st-stat-sub">enrolled in last 30 days</span>
            </div>
          </div>
        </div>

        <div className="st-filters-card">
          <form method="get" className="st-filters-form" role="search" action="/instructor/students">
            <div className="st-search-wrap">
              <svg className="st-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input type="search" name="search" className="st-search-input" placeholder="Search by name or email…" defaultValue={search} aria-label="Search students" />
            </div>

            <div className="st-filters-row">
              <select name="course" className="st-select" aria-label="Filter by course" defaultValue={courseId > 0 ? String(courseId) : ""}>
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <select name="progress" className="st-select" aria-label="Filter by progress" defaultValue={progressRaw}>
                <option value="">All Progress</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              <select name="sort" className="st-select" aria-label="Sort students" defaultValue={sort}>
                <option value="last_enrollment">Sort: Recent First</option>
                <option value="name">Sort: Name A–Z</option>
                <option value="progress">Sort: Highest Progress</option>
              </select>

              <div className="st-filter-actions">
                <button type="submit" className="st-btn st-btn--primary">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                    <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="11" y1="18" x2="13" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Apply
                </button>
                {isFiltered ? <a href="/instructor/students" className="st-btn st-btn--ghost">Clear</a> : null}
              </div>
            </div>
          </form>

          <p className="st-result-count">
            <strong>{rows.length}</strong> student{rows.length !== 1 ? "s" : ""} found
            {isFiltered ? <a href="/instructor/students" className="st-clear-link">Clear filters</a> : null}
          </p>
        </div>

        {rows.length > 0 ? (
          <StudentsTable students={rows} details={details} formatDate={formatDate} />
        ) : (
          <div className="st-empty-state">
            <div className="st-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {isFiltered ? (
              <>
                <p className="st-empty-title">No students match your filters.</p>
                <p className="st-empty-sub">Try adjusting or clearing your search filters.</p>
                <a href="/instructor/students" className="st-btn st-btn--primary">Clear All Filters</a>
              </>
            ) : (
              <>
                <p className="st-empty-title">No students yet.</p>
                <p className="st-empty-sub">Once students enroll in your courses they&apos;ll appear here.</p>
                <a href="/instructor/courses" className="st-btn st-btn--primary">View My Courses</a>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}