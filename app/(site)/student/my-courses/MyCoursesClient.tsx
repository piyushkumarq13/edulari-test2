"use client";

import { useEffect, useRef } from "react";
import TextStars from "@/components/TextStars";
import { bucketFor, progressClass, progressLabel } from "@/lib/learning/calendar";
import "@/styles/css/student/my-courses.css";

export type MyCourseCard = {
  courseId: number;
  enrollmentId: number;
  title: string;
  thumbnail: string | null;
  categoryName: string | null;
  instructorName: string | null;
  progressPercentage: number;
  totalLessons: number;
  completedLessons: number;
  avgRating: number;
  enrolledAtLabel: string;
  completedAtLabel: string | null;
  certificateId: string | null;
};

/** Port of public/student/my-courses.php (lines 113-423). */
export default function MyCoursesClient({
  cards,
  totalHours,
  status,
  search,
  sort,
  view,
}: {
  cards: MyCourseCard[];
  totalHours: number;
  status: string;
  search: string;
  sort: string;
  view: string;
}) {
  const sortRef = useRef<HTMLSelectElement | null>(null);

  // Animate the progress fills: 0 -> data-width after 120 ms, 0.75 s cubic-bezier.
  useEffect(() => {
    const fills = document.querySelectorAll<HTMLElement>(".progress-fill[data-width]");
    fills.forEach((el) => {
      const target = el.getAttribute("data-width") + "%";
      el.style.width = "0";
      requestAnimationFrame(() => {
        setTimeout(() => {
          el.style.transition = "width 0.75s cubic-bezier(0.4,0,0.2,1)";
          el.style.width = target;
        }, 120);
      });
    });
  }, []);

  const counts = {
    all: cards.length,
    in_progress: cards.filter((c) => bucketFor(c.progressPercentage) === "in_progress").length,
    completed: cards.filter((c) => bucketFor(c.progressPercentage) === "completed").length,
    not_started: cards.filter((c) => bucketFor(c.progressPercentage) === "not_started").length,
  };

  let filtered = cards;
  if (status === "in_progress") filtered = filtered.filter((c) => bucketFor(c.progressPercentage) === "in_progress");
  else if (status === "completed") filtered = filtered.filter((c) => bucketFor(c.progressPercentage) === "completed");
  else if (status === "not_started") filtered = filtered.filter((c) => bucketFor(c.progressPercentage) === "not_started");

  if (search !== "") {
    const needle = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        (c.instructorName ?? "").toLowerCase().includes(needle) ||
        (c.categoryName ?? "").toLowerCase().includes(needle),
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (sort === "az") return a.title.localeCompare(b.title);
    if (sort === "za") return b.title.localeCompare(a.title);
    if (sort === "progress") return b.progressPercentage - a.progressPercentage;
    return b.enrollmentId - a.enrollmentId;
  });

  const qStr = (tabKey: string) =>
    `?status=${encodeURIComponent(tabKey)}${search ? `&search=${encodeURIComponent(search)}` : ""}&sort=${encodeURIComponent(sort)}&view=${encodeURIComponent(view)}`;

  const tabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "in_progress", label: "In Progress", count: counts.in_progress },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "not_started", label: "Not Started", count: counts.not_started },
  ];

  return (
    <main className="mc-page">
      <section className="page-hero">
        <div className="page-hero-text">
          <h1 className="page-hero-title">My Learning</h1>
          <p className="page-hero-sub">Track your progress and continue where you left off.</p>
        </div>
        <a href="/browse-courses" className="btn-browse">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Browse More Courses
        </a>
      </section>

      <div className="stats-row">
        <div className="stat-pill">
          <div className="stat-pill-icon stat-pill-icon--blue">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-pill-body">
            <span className="stat-pill-val">{counts.all}</span>
            <span className="stat-pill-lbl">Total Enrolled</span>
          </div>
        </div>
        <div className="stat-pill">
          <div className="stat-pill-icon stat-pill-icon--orange">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-pill-body">
            <span className="stat-pill-val">{counts.in_progress}</span>
            <span className="stat-pill-lbl">In Progress</span>
          </div>
        </div>
        <div className="stat-pill">
          <div className="stat-pill-icon stat-pill-icon--green">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="stat-pill-body">
            <span className="stat-pill-val">{counts.completed}</span>
            <span className="stat-pill-lbl">Completed</span>
          </div>
        </div>
        <div className="stat-pill">
          <div className="stat-pill-icon stat-pill-icon--purple">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="stat-pill-body">
            <span className="stat-pill-val">{totalHours}h</span>
            <span className="stat-pill-lbl">Hours Learned</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="tab-filters" role="tablist">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={qStr(tab.key)}
              className={`tab-btn ${status === tab.key ? "active" : ""}`}
              role="tab"
              aria-selected={status === tab.key ? "true" : "false"}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </a>
          ))}
        </div>

        <div className="toolbar-right">
          <form className="search-form" method="get" action="">
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="view" value={view} />
            <div className="search-wrap">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                name="search"
                className="search-input"
                placeholder="Search my courses…"
                defaultValue={search}
                autoComplete="off"
              />
              {search ? (
                <a
                  href={`?status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}&view=${view}`}
                  className="search-clear"
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </a>
              ) : null}
            </div>
          </form>

          <div className="controls">
            <select
              id="sortSelect"
              className="sort-select"
              aria-label="Sort courses"
              value={sort}
              ref={sortRef}
              onChange={(e) => {
                const url = new URL(window.location.href);
                url.searchParams.set("sort", e.target.value);
                window.location.href = url.toString();
              }}
            >
              <option value="recent">Most Recent</option>
              <option value="az">A &rarr; Z</option>
              <option value="za">Z &rarr; A</option>
              <option value="progress">Progress</option>
            </select>

            <div className="view-btns" role="group" aria-label="View mode">
              <a
                href={`?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&sort=${encodeURIComponent(sort)}&view=grid`}
                className={`view-btn ${view === "grid" ? "active" : ""}`}
                title="Grid view"
                aria-label="Grid view"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                </svg>
              </a>
              <a
                href={`?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&sort=${encodeURIComponent(sort)}&view=list`}
                className={`view-btn ${view === "list" ? "active" : ""}`}
                title="List view"
                aria-label="List view"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {search ? (
        <div className="results-meta">
          Showing <strong>{filtered.length}</strong> result{filtered.length !== 1 ? "s" : ""} for &ldquo;<strong>{search}</strong>&rdquo;
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className={`courses-container ${view === "list" ? "courses-list" : "courses-grid"}`}>
          {filtered.map((course) => (
            <CourseCard key={course.courseId} course={course} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            {search ? (
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          {search ? (
            <>
              <h3 className="empty-title">No courses found</h3>
              <p className="empty-sub">
                No results for &ldquo;<strong>{search}</strong>&rdquo;. Try a different search term.
              </p>
              <a href={`?status=${encodeURIComponent(status)}`} className="btn-empty">
                Clear Search
              </a>
            </>
          ) : counts.all === 0 ? (
            <>
              <h3 className="empty-title">No courses yet</h3>
              <p className="empty-sub">You haven&rsquo;t enrolled in any courses. Start your learning journey today!</p>
              <a href="/browse-courses" className="btn-empty">
                Browse Courses
              </a>
            </>
          ) : (
            <>
              <h3 className="empty-title">No courses here</h3>
              <p className="empty-sub">
                You have no <strong>{status.replace(/_/g, " ")}</strong> courses at the moment.
              </p>
              <a href="?status=all" className="btn-empty">
                View All Courses
              </a>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function CourseCard({ course }: { course: MyCourseCard }) {
  const pct = course.progressPercentage;
  const pLabel = progressLabel(pct);
  const pClass = progressClass(pct);
  const isCompleted = pct >= 100;
  const btnLabel = isCompleted ? "Review Course" : pct > 0 ? "Continue Learning" : "Start Learning";
  const btnMod = isCompleted ? "done" : pct > 0 ? "continue" : "start";

  return (
    <article className={`course-card ${pClass}`}>
      <a href={`/student/learn?course=${course.courseId}`} className="course-thumb-link" tabIndex={-1} aria-hidden="true">
        <div className="course-thumb">
          {course.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={course.thumbnail} alt={course.title} loading="lazy" />
          ) : (
            <div className="course-thumb-placeholder">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <span className={`thumb-status thumb-status--${pClass}`}>
            {isCompleted ? (
              <>
                <svg viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Completed
              </>
            ) : pct > 0 ? (
              <>
                <svg viewBox="0 0 24 24" fill="none">
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                In Progress
              </>
            ) : (
              "New"
            )}
          </span>
        </div>
      </a>

      <div className="course-body">
        {course.categoryName ? <span className="course-category">{course.categoryName}</span> : null}

        <h2 className="course-title">
          <a href={`/student/learn?course=${course.courseId}`}>{course.title}</a>
        </h2>

        <p className="course-instructor">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          </svg>
          {course.instructorName ?? ""}
        </p>

        {course.avgRating > 0 ? (
          <div className="course-rating">
            <TextStars rating={course.avgRating} />
            <span className="rating-val">{course.avgRating.toFixed(1)}</span>
          </div>
        ) : null}

        <div className="course-progress">
          <div className="progress-header">
            <span className="progress-status-lbl">{pLabel}</span>
            <span className="progress-pct">{Math.trunc(pct)}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill progress-fill--${pClass}`} data-width={Math.trunc(pct)} />
          </div>
          <p className="progress-lessons">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" />
            </svg>
            {course.completedLessons} / {course.totalLessons} lessons completed
          </p>
        </div>

        {isCompleted && course.completedAtLabel ? (
          <div className="course-completed-info">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Completed {course.completedAtLabel}
          </div>
        ) : null}

        <div className="course-actions">
          <a href={`/student/learn?course=${course.courseId}`} className={`btn-course btn-course--${btnMod}`}>
            {!isCompleted ? (
              <svg viewBox="0 0 24 24" fill="none">
                <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            {btnLabel}
          </a>
          {isCompleted && course.certificateId ? (
            <a href={`/student/generate-certificate?course=${course.courseId}`} className="btn-cert" target="_blank" rel="noopener" title="Download Certificate">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Certificate
            </a>
          ) : null}
        </div>

        <p className="course-enrolled-date">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          Enrolled {course.enrolledAtLabel}
        </p>
      </div>
    </article>
  );
}