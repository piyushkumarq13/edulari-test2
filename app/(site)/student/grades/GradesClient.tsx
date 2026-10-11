"use client";

import { useState } from "react";
import type { CourseGrade } from "@/lib/learning/grades";
import "@/styles/css/student/grades.css";

export type GradeLessonRow = {
  lessonId: number;
  lessonTitle: string;
  isQuiz: boolean;
  scoreText: string;
  scoreNum: number | null;
  fillClass: string;
  dateText: string;
  statusClass: string;
  statusLabel: string;
  attempts: {
    score: number;
    totalPoints: number;
    percentage: number;
    statusClass: string;
    statusLabel: string;
    dateText: string;
  }[];
};

export type CourseGradePanel = {
  enrollmentId: number;
  courseId: number;
  courseTitle: string;
  thumbnail: string | null;
  instructorName: string | null;
  categoryName: string | null;
  progressPercentage: number;
  passingPercentage: number;
  enrolledAtLabel: string;
  grade: CourseGrade;
  lessons: GradeLessonRow[];
  feedbackItems: {
    lessonTitle: string;
    statusClass: string;
    statusLabel: string;
    marks: number;
    maxMarks: number;
    passingMarks: number | null;
    submittedAtLabel: string;
    feedback: string | null;
    isGraded: boolean;
    isPending: boolean;
  }[];
};

function Badge({ className, label }: { className: string; label: string }) {
  return <span className={`badge badge-${className}`}>{label}</span>;
}

/** Port of public/student/grades.php (lines 215-741). */
export default function GradesClient({
  panels,
  activeCourseId,
  summary,
  enrollmentCount,
}: {
  panels: CourseGradePanel[];
  activeCourseId: number;
  summary: {
    globalTotalQuizzes: number;
    globalQuizzesPassed: number;
    globalAssignSubmitted: number;
    globalAssignGraded: number;
    globalAvg: number | null;
  };
  enrollmentCount: number;
}) {
  const [activeId, setActiveId] = useState(activeCourseId);

  function showCourse(courseId: number) {
    setActiveId(courseId);
    const url = new URL(window.location.href);
    url.searchParams.set("course", String(courseId));
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <main className="gr-page">
      <div className="gr-header">
        <div className="gr-header-blob gr-header-blob--1" />
        <div className="gr-header-blob gr-header-blob--2" />
        <div className="gr-header-inner">
          <div>
            <h1 className="gr-header-title">My Grades</h1>
            <p className="gr-header-sub">
              Track your quiz scores, assignment results, and overall academic performance across all courses.
            </p>
          </div>
          <div className="gr-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>
      </div>

      <div className="gr-summary">
        <div className="gr-stat">
          <div className="gr-stat-icon gr-stat-icon--purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <div className="gr-stat-value">
              {summary.globalAvg !== null ? (
                <>
                  {summary.globalAvg}
                  <span>%</span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="gr-stat-label">Overall Average</div>
          </div>
        </div>
        <div className="gr-stat">
          <div className="gr-stat-icon gr-stat-icon--green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="gr-stat-value">
              {summary.globalQuizzesPassed}
              <span>/{summary.globalTotalQuizzes}</span>
            </div>
            <div className="gr-stat-label">Quizzes Passed</div>
          </div>
        </div>
        <div className="gr-stat">
          <div className="gr-stat-icon gr-stat-icon--orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="12" y2="17" />
            </svg>
          </div>
          <div>
            <div className="gr-stat-value">
              {summary.globalAssignGraded}
              <span>/{summary.globalAssignSubmitted}</span>
            </div>
            <div className="gr-stat-label">Assignments Graded</div>
          </div>
        </div>
        <div className="gr-stat">
          <div className="gr-stat-icon gr-stat-icon--blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div>
            <div className="gr-stat-value">{enrollmentCount}</div>
            <div className="gr-stat-label">Enrolled Courses</div>
          </div>
        </div>
      </div>

      {panels.length === 0 ? (
        <div className="gr-empty">
          <div className="gr-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <p className="gr-empty-title">No grades yet</p>
          <p className="gr-empty-sub">Enroll in a course and complete quizzes or assignments to see your grades here.</p>
          <a href="/browse-courses" className="btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Browse Courses
          </a>
        </div>
      ) : (
        <div className="gr-layout">
          <aside className="gr-sidebar" aria-label="Course list">
            <div className="gr-sidebar-header">Your Courses</div>
            <div className="gr-sidebar-courses">
              {panels.map((panel) => (
                <button
                  key={panel.courseId}
                  className={`gr-course-btn ${panel.courseId === activeId ? "active" : ""}`}
                  data-course-id={panel.courseId}
                  aria-current={panel.courseId === activeId ? "true" : "false"}
                  onClick={() => showCourse(panel.courseId)}
                >
                  <div className="gr-cb-thumb">
                    {panel.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={panel.thumbnail} alt={panel.courseTitle} loading="lazy" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="gr-cb-info">
                    <div className="gr-cb-title">{panel.courseTitle}</div>
                    <div className="gr-cb-meta">
                      {panel.grade.weightedAvg !== null ? `${panel.grade.weightedAvg}%` : "No grades yet"}
                    </div>
                  </div>
                  <div className={`gr-cb-grade ${panel.grade.gradeClass}`}>{panel.grade.letterGrade}</div>
                </button>
              ))}
            </div>
          </aside>

          <div className="gr-main">
            {panels.map((panel) => (
              <div
                key={panel.courseId}
                className="gr-course-panel"
                id={`panel-${panel.courseId}`}
                style={{ display: panel.courseId === activeId ? "flex" : "none", flexDirection: "column", gap: "1.5rem" }}
              >
                <div className="gr-course-card">
                  <div className="gr-course-card-head">
                    <div className="gr-cch-thumb">
                      {panel.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={panel.thumbnail} alt={panel.courseTitle} loading="lazy" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="gr-cch-info">
                      <div className="gr-cch-title">{panel.courseTitle}</div>
                      <div className="gr-cch-instructor">by {panel.instructorName}</div>
                      {panel.categoryName ? <span className="gr-cch-cat">{panel.categoryName}</span> : null}
                    </div>
                    <div className={`gr-grade-pill ${panel.grade.gradeClass}`}>
                      <span className="letter">{panel.grade.letterGrade}</span>
                      <span className="pct">{panel.grade.weightedAvg !== null ? `${panel.grade.weightedAvg}%` : "—"}</span>
                    </div>
                  </div>

                  <div className="gr-course-meta">
                    <div className="gr-cm-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      <span>Progress</span>
                      <div className="gr-progress-wrap">
                        <div className="gr-progress-track">
                          <div className="gr-progress-fill" style={{ width: `${panel.progressPercentage}%` }} />
                        </div>
                        <span className="gr-progress-pct">{panel.progressPercentage}%</span>
                      </div>
                    </div>

                    {panel.grade.passStatus ? (
                      <div className="gr-cm-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <Badge className={panel.grade.passStatus} label={panel.grade.passStatus === "pass" ? "Pass" : "Fail"} />
                      </div>
                    ) : null}

                    <div className="gr-cm-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Quizzes:{" "}
                      <strong>
                        {panel.grade.quizPassed}/{panel.grade.quizCount} passed
                      </strong>
                    </div>

                    <div className="gr-cm-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Assignments:{" "}
                      <strong>
                        {panel.grade.assignGraded}/{panel.grade.assignCount} graded
                      </strong>
                    </div>

                    <div className="gr-cm-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      Passing: <strong>{panel.passingPercentage}%</strong>
                    </div>

                    <div className="gr-cm-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Enrolled: <strong>{panel.enrolledAtLabel}</strong>
                    </div>
                  </div>
                </div>

                <div className="gr-table-card">
                  <div className="gr-table-head">
                    <div className="gr-table-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                      Gradable Items
                    </div>
                  </div>

                  {panel.lessons.length === 0 ? (
                    <div className="gr-no-grades">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      This course has no quizzes or assignments yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%", maxWidth: "100%" }}>
                      <table className="gr-table">
                        <thead>
                          <tr>
                            <th>Lesson / Item</th>
                            <th>Type</th>
                            <th>Score</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {panel.lessons.map((les) => (
                            <GradeRow key={les.lessonId} panel={panel} les={les} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {panel.feedbackItems.length > 0 ? (
                  <div className="gr-feedback-card">
                    <div className="gr-feedback-head">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                        <line x1="9" y1="17" x2="12" y2="17" />
                      </svg>
                      Assignment Submissions
                    </div>
                    <div className="gr-feedback-list">
                      {panel.feedbackItems.map((item, idx) => (
                        <div className="gr-feedback-item" key={idx}>
                          <div className="gr-fi-title">{item.lessonTitle}</div>
                          <div className="gr-fi-score">
                            <Badge className={item.statusClass} label={item.statusLabel} />
                            {item.isGraded ? (
                              <span className="gr-fi-marks">
                                Score: <strong>{item.marks}</strong> / {item.maxMarks} marks
                                {item.passingMarks ? (
                                  <>
                                    {" "}
                                    &nbsp;· Passing: <strong>{item.passingMarks}</strong>
                                  </>
                                ) : null}
                              </span>
                            ) : null}
                            <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
                              Submitted {item.submittedAtLabel}
                            </span>
                          </div>
                          {item.feedback ? (
                            <div className="gr-fi-feedback">
                              <Nl2Br text={item.feedback} />
                            </div>
                          ) : item.isGraded ? (
                            <div className="gr-fi-nofeedback">No written feedback provided.</div>
                          ) : item.isPending ? (
                            <div className="gr-fi-nofeedback">Awaiting instructor review.</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function GradeRow({ panel, les }: { panel: CourseGradePanel; les: GradeLessonRow }) {
  const hasMultipleAttempts = les.attempts.length > 1;
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className={`gr-row-${les.isQuiz ? "quiz" : "assign"}`} data-lesson={les.lessonId}>
        <td>
          <div className="gr-lesson-name">{les.lessonTitle}</div>
          <a
            href={`/student/learn?course=${panel.courseId}&lesson=${les.lessonId}`}
            className="gr-lesson-link"
            target="_blank"
          >
            Review lesson
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </td>
        <td>
          {les.isQuiz ? (
            <span className="gr-type-badge gr-type-quiz">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Quiz
            </span>
          ) : (
            <span className="gr-type-badge gr-type-assign">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Assignment
            </span>
          )}
        </td>
        <td>
          {les.scoreNum !== null ? (
            <div className="gr-score-bar">
              <span className="gr-score-text">{les.scoreText}</span>
              <div className="gr-score-track">
                <div className={`gr-score-fill ${les.fillClass}`} style={{ width: `${Math.min(100, Math.max(0, les.scoreNum))}%` }} />
              </div>
            </div>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{les.scoreText}</span>
          )}
        </td>
        <td style={{ color: "var(--text-secondary)", fontSize: ".82rem" }}>{les.dateText}</td>
        <td>
          <Badge className={les.statusClass} label={les.statusLabel} />
        </td>
        <td>
          {les.isQuiz && hasMultipleAttempts ? (
            <button
              className={`gr-toggle-btn ${open ? "open" : ""}`}
              aria-expanded={open}
              title="View attempt history"
              onClick={() => setOpen((v) => !v)}
            >
              {les.attempts.length} attempts
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          ) : les.isQuiz && les.attempts.length === 1 ? (
            <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>1 attempt</span>
          ) : null}
        </td>
      </tr>

      {les.isQuiz && hasMultipleAttempts
        ? les.attempts.map((att, ai) => (
            <tr
              className={`gr-attempt-row ${open ? "visible" : ""}`}
              id={`attempt-row-${les.lessonId}-${panel.courseId}-${ai}`}
              key={ai}
            >
              <td colSpan={6}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <span className="gr-attempt-idx">Attempt {ai + 1}</span>
                  <span style={{ fontWeight: 600 }}>
                    {att.score}/{att.totalPoints}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>{att.percentage}%</span>
                  <Badge className={att.statusClass} label={att.statusLabel} />
                  <span style={{ color: "var(--text-muted)", fontSize: ".78rem" }}>{att.dateText}</span>
                </div>
              </td>
            </tr>
          ))
        : null}
    </>
  );
}

function Nl2Br({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}