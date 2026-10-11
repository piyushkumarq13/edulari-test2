"use client";

import type { CurriculumLesson, CurriculumSection } from "@/lib/db/learning";
import { formatDuration, sectionProgress } from "./types";

/** Port of learn.php's curriculum sidebar (lines 311-511). */
export default function LearnSidebar({
  courseId,
  sections,
  currentLessonId,
  completedLessons,
  totalLessons,
  progressPercentage,
  certificateEligible,
  hasCertificate,
  csrfToken,
}: {
  courseId: number;
  sections: CurriculumSection[];
  currentLessonId: number;
  completedLessons: number;
  totalLessons: number;
  progressPercentage: number;
  certificateEligible: boolean;
  hasCertificate: boolean;
  csrfToken: string;
}) {
  return (
    <aside className="lp-sidebar" id="lpSidebar" aria-label="Course curriculum">
      <div className="lp-sidebar__head">
        <div className="lp-sidebar__head-top">
          <h2 className="lp-sidebar__title">Course Content</h2>
          <button className="lp-sidebar__close-btn" id="sidebarCloseBtn" aria-label="Close curriculum">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="lp-sidebar__stats">
          <div className="lp-sidebar__stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              {completedLessons} / {totalLessons} completed
            </span>
          </div>
          <span className="lp-sidebar__stat-pct">{progressPercentage}%</span>
        </div>

        <div
          className="lp-sidebar__progress-bar"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="lp-sidebar__progress-fill" style={{ width: `${progressPercentage}%` }} />
        </div>

        {certificateEligible ? (
          <div className="lp-sidebar__cert-wrap">
            <form method="post" action="/api/student/learn" className="lp-cert-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="action" value="generate_certificate" />
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                className={`lp-cert-btn ${hasCertificate ? "lp-cert-btn--view" : "lp-cert-btn--generate"}`}
              >
                <span className="lp-cert-btn__icon" aria-hidden="true">
                  {hasCertificate ? "🏆" : "🎓"}
                </span>
                {hasCertificate ? "View My Certificate" : "Generate Certificate"}
              </button>
            </form>
          </div>
        ) : null}

        <div className="lp-sidebar__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            id="curriculumSearch"
            className="lp-sidebar__search-input"
            placeholder="Search lessons…"
            aria-label="Search lessons"
          />
          <button className="lp-sidebar__search-clear" id="searchClearBtn" aria-label="Clear search" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div id="lpBookmarksSection" className="lp-bookmarks-section" hidden>
        <div className="lp-bookmarks-section__header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <span>Saved Lessons</span>
        </div>
        <div id="lpBookmarksList" className="lp-bookmarks-list" />
      </div>

      <div id="searchNoResults" className="lp-search-no-results" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p>No lessons match your search.</p>
      </div>

      <nav className="lp-curriculum" id="lpCurriculum" aria-label="Lessons">
        {sections.map((section, sIdx) => {
          const sp = sectionProgress(section.lessons);
          const isOpen = section.lessons.some((l) => Number(l.id) === currentLessonId);
          return (
            <div
              key={section.id}
              className={`lp-section ${isOpen ? "lp-section--open" : ""}`}
              data-section-idx={sIdx}
            >
              <button
                className="lp-section__toggle"
                aria-expanded={isOpen}
                aria-controls={`section-lessons-${sIdx}`}
              >
                <span className="lp-section__chevron" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
                <span className="lp-section__name">{section.title}</span>
                <span className="lp-section__count">
                  {sp.completed}/{sp.total}
                </span>
              </button>

              <div className="lp-section__lessons" id={`section-lessons-${sIdx}`}>
                {section.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    courseId={courseId}
                    lesson={lesson}
                    isActive={Number(lesson.id) === currentLessonId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function LessonRow({
  courseId,
  lesson,
  isActive,
}: {
  courseId: number;
  lesson: CurriculumLesson;
  isActive: boolean;
}) {
  const isCompleted = !!lesson.lesson_completed_at;
  const dur =
    lesson.content_type === "video" && Number(lesson.video_duration) > 0
      ? formatDuration(Number(lesson.video_duration))
      : "";
  const typeLabel = lesson.content_type.charAt(0).toUpperCase() + lesson.content_type.slice(1);

  let lessonClasses = "lp-lesson";
  if (isActive) lessonClasses += " lp-lesson--active";
  if (isCompleted) lessonClasses += " lp-lesson--done";

  return (
    <a
      href={`/student/learn?course=${courseId}&lesson=${lesson.id}`}
      className={lessonClasses}
      data-lesson-id={lesson.id}
      data-lesson-title={lesson.title}
      aria-current={isActive ? "page" : "false"}
    >
      <div
        className={`lp-lesson__icon lp-lesson__icon--${isCompleted ? "done" : lesson.content_type}`}
        aria-hidden="true"
      >
        {isCompleted ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : lesson.content_type === "video" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ) : lesson.content_type === "quiz" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : lesson.content_type === "assignment" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ) : lesson.content_type === "pdf" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        )}
      </div>

      <div className="lp-lesson__body">
        <span className="lp-lesson__title">{lesson.title}</span>
        <div className="lp-lesson__meta">
          <span className={`lp-lesson__type-badge lp-lesson__type-badge--${lesson.content_type}`}>{typeLabel}</span>
          {dur ? <span className="lp-lesson__duration">{dur}</span> : null}
        </div>
      </div>

      {isActive ? <span className="lp-lesson__active-indicator" aria-hidden="true" /> : null}

      <button
        className="lp-lesson__bookmark-btn js-bookmark-btn"
        data-lesson-id={lesson.id}
        data-lesson-title={lesson.title}
        data-lesson-type={lesson.content_type}
        aria-label={`Bookmark ${lesson.title}`}
        title="Bookmark lesson (B)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      </button>
    </a>
  );
}