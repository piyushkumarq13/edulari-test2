"use client";

import useLearnBehaviour from "./useLearnBehaviour";
import LearnSidebar from "./LearnSidebar";
import LearnContent from "./LearnContent";
import CourseAiChat from "@/components/CourseAiChat";
import CodeHighlight from "@/components/CodeHighlight";
import type { LearnProps } from "./types";

/** learn.php's whole page body: top bar, sidebar, main, shortcuts modal, AI widget. */
export default function LearnClient(props: LearnProps) {
  const {
    user,
    course,
    enrollment,
    sections,
    totalLessons,
    completedLessons,
    currentLesson,
    currentLessonId,
    quizResult,
    quizReview,
    flashAssignmentSubmitted,
    courseCompleted,
    certificateEligible,
    hasCertificate,
    csrfToken,
  } = props;

  const nav = currentLesson?.navigation ?? { prev: null, next: null };

  useLearnBehaviour({
    courseId: course.id,
    lessonId: currentLessonId,
    prevLessonId: nav.prev ? Number(nav.prev.id) : null,
    nextLessonId: nav.next ? Number(nav.next.id) : null,
  });

  const allLessons = sections.flatMap((s) => s.lessons);
  const currentIdx = Math.max(0, allLessons.findIndex((l) => Number(l.id) === currentLessonId) + 1);

  return (
    <>
      {/* ══════════ TOP BAR ══════════ */}
      <header className="lp-topbar" id="lpTopbar">
        <div className="lp-topbar__left">
          <button
            className="lp-topbar__menu-btn"
            id="sidebarToggleBtn"
            aria-label="Toggle course curriculum"
            aria-expanded="false"
            aria-controls="lpSidebar"
          >
            <span className="lp-topbar__menu-bar" />
            <span className="lp-topbar__menu-bar" />
            <span className="lp-topbar__menu-bar" />
          </button>

          <a href="/student/my-courses" className="lp-topbar__back-btn" aria-label="Back to my courses">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>

          <div className="lp-topbar__course-info">
            <a href={`/course/${course.slug}`} className="lp-topbar__course-name">
              {course.title}
            </a>
            {currentLesson ? (
              <span className="lp-topbar__lesson-name">{currentLesson.title}</span>
            ) : null}
          </div>
        </div>

        <div className="lp-topbar__center">
          <div
            className="lp-topbar__progress"
            role="progressbar"
            aria-valuenow={enrollment.progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Course progress ${enrollment.progressPercentage}%`}
          >
            <div className="lp-topbar__progress-track">
              <div className="lp-topbar__progress-fill" style={{ width: `${enrollment.progressPercentage}%` }} />
            </div>
            <span className="lp-topbar__progress-pct">{enrollment.progressPercentage}%</span>
          </div>
        </div>

        <div className="lp-topbar__right">
          <nav className="lp-topbar__nav" aria-label="Quick navigation">
            <a href="/student/dashboard" className="lp-topbar__nav-link">
              Dashboard
            </a>
            <a href="/student/my-courses" className="lp-topbar__nav-link lp-topbar__nav-link--hidden-sm">
              My Courses
            </a>
          </nav>

          <button className="lp-topbar__icon-btn" id="darkModeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">
            <svg className="lp-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg className="lp-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          <button className="lp-topbar__icon-btn" id="shortcutsHelpBtn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h.01M12 14h.01M16 14h.01M6 14h.01" />
            </svg>
          </button>

          <div className="lp-topbar__avatar" title={user.name} aria-label={`Logged in as ${user.name}`}>
            {user.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatarUrl} alt={user.name} />
            ) : (
              <span>{user.initials}</span>
            )}
          </div>
        </div>
      </header>

      {/* ══════════ LAYOUT ══════════ */}
      <div className="lp-layout" id="lpLayout">
        <LearnSidebar
          courseId={course.id}
          sections={sections}
          currentLessonId={currentLessonId}
          completedLessons={completedLessons}
          totalLessons={totalLessons}
          progressPercentage={enrollment.progressPercentage}
          certificateEligible={certificateEligible}
          hasCertificate={hasCertificate}
          csrfToken={csrfToken}
        />

        <div className="lp-overlay" id="lpOverlay" aria-hidden="true" />

        <main className="lp-main" id="lpMain">
          {courseCompleted ? (
            <div className="lp-alert lp-alert--success" role="alert">
              <div className="lp-alert__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="lp-alert__body">
                <strong>🎉 Congratulations!</strong>
                <span>You&apos;ve completed all lessons in this course. Excellent work!</span>
                {certificateEligible ? (
                  <form method="post" action="/api/student/learn" className="lp-alert__cert-form">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="action" value="generate_certificate" />
                    <input type="hidden" name="course_id" value={course.id} />
                    <button type="submit" className="lp-alert__cta">
                      {hasCertificate ? "View Certificate" : "Get Your Certificate"} →
                    </button>
                  </form>
                ) : null}
              </div>
              <button className="lp-alert__dismiss" aria-label="Dismiss">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : null}

          {flashAssignmentSubmitted ? (
            <div className="lp-alert lp-alert--success" role="alert">
              <div className="lp-alert__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="lp-alert__body">
                <strong>Assignment Submitted!</strong>
                <span>Your instructor will review it and provide feedback soon.</span>
              </div>
              <button className="lp-alert__dismiss" aria-label="Dismiss">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : null}

          {currentLesson ? (
            <>
              <div className="lp-lesson-head">
                <nav className="lp-breadcrumb" aria-label="Lesson location">
                  {currentLesson.section_title ? (
                    <>
                      <span className="lp-breadcrumb__section">{currentLesson.section_title}</span>
                      <svg className="lp-breadcrumb__sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </>
                  ) : null}
                  <span className={`lp-breadcrumb__type lp-breadcrumb__type--${currentLesson.content_type}`}>
                    {ucfirst(currentLesson.content_type)}
                  </span>
                </nav>

                <div className="lp-lesson-head__title-row">
                  <h1 className="lp-lesson-head__title">{currentLesson.title}</h1>
                  {currentLesson.lesson_completed_at ? (
                    <span className="lp-completed-badge" aria-label="Lesson completed">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Completed
                    </span>
                  ) : null}
                </div>
              </div>

              <LearnContent
                lesson={currentLesson}
                courseId={course.id}
                csrfToken={csrfToken}
                quizResult={quizResult}
                quizReview={quizReview}
                currentLessonId={currentLessonId}
              />

              <nav className="lp-lesson-nav" aria-label="Lesson navigation">
                <div className="lp-lesson-nav__prev">
                  {nav.prev ? (
                    <a href={`/student/learn?course=${course.id}&lesson=${nav.prev.id}`} className="lp-nav-btn lp-nav-btn--prev">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>
                        <small>Previous</small>
                        {nav.prev.title}
                      </span>
                    </a>
                  ) : null}
                </div>

                <div className="lp-lesson-nav__counter" aria-label="Lesson position">
                  <span className="lp-lesson-nav__counter-current">{currentIdx}</span>
                  <span className="lp-lesson-nav__counter-sep" aria-hidden="true">
                    /
                  </span>
                  <span className="lp-lesson-nav__counter-total">{totalLessons}</span>
                </div>

                <div className="lp-lesson-nav__next">
                  {nav.next ? (
                    <a href={`/student/learn?course=${course.id}&lesson=${nav.next.id}`} className="lp-nav-btn lp-nav-btn--next">
                      <span>
                        <small>Next</small>
                        {nav.next.title}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  ) : (
                    <a href={`/student/learn?course=${course.id}&lesson=${currentLessonId}&completed=1`} className="lp-btn lp-btn--complete">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Finish Course
                    </a>
                  )}
                </div>
              </nav>
            </>
          ) : (
            <div className="lp-empty-hero" role="status">
              <div className="lp-empty-hero__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <h2 className="lp-empty-hero__heading">Ready to learn?</h2>
              <p className="lp-empty-hero__subtext">Select a lesson from the curriculum to get started.</p>
              <button className="lp-btn lp-btn--complete" id="openSidebarBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Open Curriculum
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ══════════ KEYBOARD SHORTCUTS MODAL ══════════ */}
      <div id="lpShortcutsModal" className="lp-modal" aria-modal="true" role="dialog" aria-labelledby="shortcutsModalTitle" hidden>
        <div className="lp-modal__backdrop" id="shortcutsModalBackdrop" />
        <div className="lp-modal__box">
          <div className="lp-modal__header">
            <h2 id="shortcutsModalTitle" className="lp-modal__title">
              Keyboard Shortcuts
            </h2>
            <button className="lp-modal__close" id="shortcutsModalClose" aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <dl className="lp-shortcuts-list">
            <div className="lp-shortcut-row">
              <dt>
                <kbd>←</kbd>
              </dt>
              <dd>Previous lesson</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>→</kbd>
              </dt>
              <dd>Next lesson</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>B</kbd>
              </dt>
              <dd>Bookmark / unbookmark current lesson</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>D</kbd>
              </dt>
              <dd>Toggle dark mode</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>S</kbd>
              </dt>
              <dd>Focus curriculum search</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>?</kbd>
              </dt>
              <dd>Open / close this help panel</dd>
            </div>
            <div className="lp-shortcut-row">
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close this panel / clear search</dd>
            </div>
          </dl>
        </div>
      </div>

      <CourseAiChat courseId={course.id} csrfToken={csrfToken} />
      <CodeHighlight />
    </>
  );
}

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}