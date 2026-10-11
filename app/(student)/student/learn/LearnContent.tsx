"use client";

import { useEffect, useRef, useState } from "react";
import type { FullLesson } from "@/lib/db/learning";
import { renderMarkdown } from "@/lib/markdown";
import { formatMonthDayYear, formatSubmittedAt } from "@/lib/format";
import VideoPlayer from "@/components/VideoPlayer";
import FileViewer from "@/components/FileViewer";
import type { LearnProps } from "./types";

/** learn.php lines 619-1001: the five content types plus the quiz result/review. */
export default function LearnContent({
  lesson,
  courseId,
  csrfToken,
  quizResult,
  quizReview,
  currentLessonId,
}: {
  lesson: FullLesson;
  courseId: number;
  csrfToken: string;
  quizResult: LearnProps["quizResult"];
  quizReview: LearnProps["quizReview"];
  currentLessonId: number;
}) {
  const html = renderMarkdown(lesson.content_text ?? "");
  const nav = lesson.navigation;
  const completed = !!lesson.lesson_completed_at;

  if (lesson.content_type === "video") {
    return (
      <section className="lp-content-section lp-content-section--video" aria-label="Video lesson">
        {lesson.video_url ? (
          <div className="lp-video-wrapper">
            <div className="lp-video-embed">
              <VideoPlayer videoUrl={lesson.video_url} title={lesson.title ?? "Lesson video"} />
            </div>
          </div>
        ) : null}

        {lesson.content_text ? (
          <div className="lp-content-card">
            <h3 className="lp-content-card__heading">About this lesson</h3>
            <div className="lp-prose" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : null}

        <LessonActions lessonId={Number(lesson.id)} courseId={courseId} completed={completed} completedAt={lesson.lesson_completed_at} csrfToken={csrfToken} />
      </section>
    );
  }

  if (lesson.content_type === "text") {
    return (
      <section className="lp-content-section lp-content-section--text" aria-label="Text lesson">
        <div className="lp-content-card lp-content-card--text">
          <div className="lp-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <LessonActions lessonId={Number(lesson.id)} courseId={courseId} completed={completed} completedAt={lesson.lesson_completed_at} csrfToken={csrfToken} />
      </section>
    );
  }

  if (lesson.content_type === "pdf") {
    return (
      <section className="lp-content-section lp-content-section--pdf" aria-label="PDF lesson">
        {lesson.pdf_file ? (
          <FileViewer
            lessonId={Number(lesson.id)}
            fileName={lesson.pdf_file.split("/").pop() ?? ""}
            title={lesson.title ?? "Lesson file"}
          />
        ) : null}
        <LessonActions lessonId={Number(lesson.id)} courseId={courseId} completed={completed} completedAt={lesson.lesson_completed_at} csrfToken={csrfToken} />
      </section>
    );
  }

  if (lesson.content_type === "quiz") {
    const questions = lesson.questions ?? [];
    const previous = lesson.previous_attempt;
    const showPassedBanner = !quizResult && !!previous && previous.passed;
    const showFailNotice = !quizResult && !!previous && !previous.passed;
    const showForm = !quizResult && questions.length > 0 && (!previous || !previous.passed);

    return (
      <section className="lp-content-section lp-content-section--quiz" aria-label="Quiz">
        {quizResult ? (
          <>
            <div
              className={`lp-quiz-result ${quizResult.passed ? "lp-quiz-result--pass" : "lp-quiz-result--fail"}`}
              role="status"
              aria-live="polite"
            >
              <div className="lp-quiz-result__icon" aria-hidden="true">
                {quizResult.passed ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
              <h3 className="lp-quiz-result__heading">
                {quizResult.passed ? "🎉 Congratulations! You passed!" : "Not quite — keep it up!"}
              </h3>
              <div className="lp-quiz-result__scores">
                <div className="lp-score-chip">
                  <span className="lp-score-chip__value">
                    {quizResult.score}/{quizResult.total}
                  </span>
                  <span className="lp-score-chip__label">Points</span>
                </div>
                <div className="lp-score-chip lp-score-chip--highlight">
                  <span className="lp-score-chip__value">{quizResult.percentage}%</span>
                  <span className="lp-score-chip__label">Score</span>
                </div>
              </div>
              <div className="lp-quiz-result__actions">
                {quizResult.passed && nav.next ? (
                  <a href={`/student/learn?course=${courseId}&lesson=${nav.next.id}`} className="lp-btn lp-btn--complete">
                    Next Lesson
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </a>
                ) : quizResult.passed ? (
                  <a href={`/student/learn?course=${courseId}&lesson=${currentLessonId}&completed=1`} className="lp-btn lp-btn--complete">
                    Finish Course
                  </a>
                ) : (
                  <a href={`/student/learn?course=${courseId}&lesson=${currentLessonId}`} className="lp-btn lp-btn--outline">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-3.01" />
                    </svg>
                    Try Again
                  </a>
                )}
              </div>
            </div>

            {quizReview && quizReview.length > 0 ? (
              <div className="lp-quiz-review" id="quizReview">
                <div className="lp-quiz-review__header">
                  <h3 className="lp-quiz-review__title">Answer Review</h3>
                  <p className="lp-quiz-review__subtitle">See how you did on each question</p>
                </div>
                <ol className="lp-quiz-review__list" aria-label="Question review">
                  {quizReview.map((review, rIdx) => (
                    <li
                      key={rIdx}
                      className={`lp-review-item lp-review-item--${review.is_correct ? "correct" : "wrong"}`}
                    >
                      <div className="lp-review-item__head">
                        <span className="lp-review-item__num">Q{rIdx + 1}</span>
                        <span className="lp-review-item__status-icon" aria-hidden="true">
                          {review.is_correct ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                        </span>
                        <span className="lp-review-item__pts">
                          {review.is_correct ? review.points : 0}/{review.points} pts
                        </span>
                      </div>
                      <p className="lp-review-item__question">{review.question}</p>
                      <div className="lp-review-item__options">
                        {review.options.map((opt) => {
                          const isSelected = Number(opt.id) === Number(review.selected_id);
                          const isCorrect = Number(opt.id) === Number(review.correct_id);
                          let optClass = "lp-review-option";
                          if (isCorrect) optClass += " lp-review-option--correct";
                          if (isSelected && !isCorrect) optClass += " lp-review-option--wrong";
                          return (
                            <div key={opt.id} className={optClass}>
                              <span className="lp-review-option__dot" aria-hidden="true" />
                              <span className="lp-review-option__text">{opt.option_text}</span>
                              {isCorrect ? (
                                <span className="lp-review-option__tag lp-review-option__tag--correct">Correct answer</span>
                              ) : isSelected ? (
                                <span className="lp-review-option__tag lp-review-option__tag--yours">Your answer</span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        ) : null}

        {showPassedBanner ? (
          <div className="lp-quiz-passed-banner" role="status">
            <div className="lp-quiz-passed-banner__check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="lp-quiz-passed-banner__text">
              <strong>Quiz already passed!</strong>
              <span>Best score: {Number(previous?.percentage ?? 0)}%</span>
            </div>
            <a
              href={`/student/learn?course=${courseId}&lesson=${nav.next ? nav.next.id : currentLessonId}`}
              className="lp-btn lp-btn--complete lp-btn--sm"
            >
              Continue
            </a>
          </div>
        ) : null}

        {showFailNotice ? (
          <div className="lp-quiz-notice lp-quiz-notice--warn" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Previous attempt: <strong>{Number(previous?.percentage ?? 0)}%</strong> — not passed yet. Try again below.
            </span>
          </div>
        ) : null}

        {showForm ? (
          <QuizForm
            lessonId={Number(lesson.id)}
            courseId={courseId}
            questions={questions}
            csrfToken={csrfToken}
          />
        ) : questions.length === 0 ? (
          <div className="lp-empty-state" role="status">
            <div className="lp-empty-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p>No questions are available for this quiz yet.</p>
          </div>
        ) : null}
      </section>
    );
  }

  if (lesson.content_type === "assignment") {
    if (!lesson.assignment) {
      return (
        <section className="lp-content-section lp-content-section--assignment" aria-label="Assignment">
          <div className="lp-empty-state" role="status">
            <div className="lp-empty-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              </svg>
            </div>
            <p>Assignment details are not yet available.</p>
          </div>
        </section>
      );
    }

    const assignment = lesson.assignment;
    const submission = lesson.submission;

    return (
      <section className="lp-content-section lp-content-section--assignment" aria-label="Assignment">
        <div className="lp-assignment-brief">
          <div className="lp-assignment-brief__header">
            <div className="lp-assignment-brief__icon-wrap" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div className="lp-assignment-brief__heading-text">
              <h3>Assignment Brief</h3>
              <p>Read all instructions carefully before submitting your work.</p>
            </div>
          </div>

          <div className="lp-assignment-brief__instructions">
            <div className="lp-prose"><Nl2Br text={assignment.instructions} /></div>
          </div>

          <div className="lp-assignment-brief__pills">
            <span className="lp-assignment-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 8 12 12 16 14" />
              </svg>
              Max marks: <strong>{assignment.max_marks}</strong>
            </span>
            <span className="lp-assignment-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Pass at: <strong>{assignment.passing_marks}</strong>
            </span>
            <span className="lp-assignment-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Due: <strong>{assignment.due_days} days</strong> after enrollment
            </span>
          </div>
        </div>

        {submission ? (
          <div className="lp-submission-card">
            <div className="lp-submission-card__header">
              <h3>Your Submission</h3>
              <span className={`lp-status-badge lp-status-badge--${submission.status}`}>
                {ucfirst(submission.status)}
              </span>
            </div>
            <p className="lp-submission-card__date">Submitted {formatSubmittedAt(submission.submitted_at)}</p>

            {submission.attachment_file ? (
              <p className="lp-submission-card__attachment">
                <a href={`/api/media?type=assignment_file&id=${submission.id}`} download>
                  📎 Download attachment
                </a>
              </p>
            ) : null}

            {submission.status === "graded" ? (
              <div className="lp-grade-display">
                <div className="lp-grade-display__score-wrap">
                  <span className="lp-grade-display__obtained">{submission.marks_obtained ?? ""}</span>
                  <span className="lp-grade-display__max">/ {assignment.max_marks}</span>
                  <span className="lp-grade-display__label">marks</span>
                </div>
                {submission.feedback ? (
                  <div className="lp-grade-display__feedback">
                    <p className="lp-grade-display__feedback-label">Instructor Feedback</p>
                    <p className="lp-grade-display__feedback-text"><Nl2Br text={submission.feedback} /></p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <AssignmentForm lessonId={Number(lesson.id)} courseId={courseId} csrfToken={csrfToken} />
        )}
      </section>
    );
  }

  return null;
}

/** learn.php's mark-complete / completed-notice block (lines 640-662). */
function LessonActions({
  lessonId,
  courseId,
  completed,
  completedAt,
  csrfToken,
}: {
  lessonId: number;
  courseId: number;
  completed: boolean;
  completedAt: Date | string | null;
  csrfToken: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  // Universal time tracking: `Math.floor((Date.now() - t0) / 1000)` on submit.
  useEffect(() => {
    const t0 = Date.now();
    const form = formRef.current;
    if (!form) return;
    const onSubmit = () => {
      const input = form.querySelector<HTMLInputElement>(".lp-time-spent");
      if (input) input.value = String(Math.floor((Date.now() - t0) / 1000));
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  if (completed) {
    return (
      <div className="lp-lesson-actions">
        <div className="lp-completed-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Completed on {formatMonthDayYear(completedAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-lesson-actions">
      <form method="post" action="/api/student/learn" className="lp-completion-form" ref={formRef}>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="action" value="mark_complete" />
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="time_spent" className="lp-time-spent" defaultValue="0" />
        <button type="submit" className="lp-btn lp-btn--complete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Mark Complete &amp; Continue
        </button>
      </form>
    </div>
  );
}

type SerialQuestion = {
  id: number;
  question: string;
  question_type: string;
  points: number;
  options: { id: number; option_text: string }[];
};

function QuizForm({
  lessonId,
  courseId,
  questions,
  csrfToken,
}: {
  lessonId: number;
  courseId: number;
  questions: SerialQuestion[];
  csrfToken: string;
}) {
  const [answered, setAnswered] = useState(0);
  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points ?? 0), 0);

  return (
    <>
      <div className="lp-quiz-meta-bar">
        <div className="lp-quiz-meta-bar__item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{questions.length} Questions</span>
        </div>
        <div className="lp-quiz-meta-bar__item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>{totalPoints} Total Points</span>
        </div>
      </div>

      <form method="post" action="/api/student/learn" className="lp-quiz-form" id="quizForm" noValidate>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="action" value="submit_quiz" />
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input type="hidden" name="course_id" value={courseId} />

        <ol className="lp-quiz-questions" aria-label="Quiz questions">
          {questions.map((question, qIdx) => (
            <li className="lp-question" id={`question-${question.id}`} key={question.id}>
              <div className="lp-question__head">
                <span className="lp-question__num" aria-hidden="true">
                  Q{qIdx + 1}
                </span>
                <span className="lp-question__points">
                  {question.points} pt{Number(question.points) !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="lp-question__text">{question.question}</p>
              <div
                className="lp-question__options"
                role="radiogroup"
                aria-label={`Options for question ${qIdx + 1}`}
                onChange={() =>
                  setAnswered((n) => {
                    const checked = new Set<string>();
                    document.querySelectorAll('#quizForm input[type="radio"]:checked').forEach((el) => {
                      checked.add((el as HTMLInputElement).name);
                    });
                    return checked.size > n ? checked.size : n;
                  })
                }
              >
                {question.question_type === "multiple_choice"
                  ? question.options.map((opt) => (
                      <label className="lp-option" key={opt.id}>
                        <input
                          type="radio"
                          name={`answers[${question.id}]`}
                          value={opt.id}
                          className="lp-option__input"
                          required
                        />
                        <span className="lp-option__dot" aria-hidden="true" />
                        <span className="lp-option__text">{opt.option_text}</span>
                      </label>
                    ))
                  : [
                      { value: "true", label: "True" },
                      { value: "false", label: "False" },
                    ].map((opt) => (
                      <label className="lp-option" key={opt.value}>
                        <input
                          type="radio"
                          name={`answers[${question.id}]`}
                          value={opt.value}
                          className="lp-option__input"
                          required
                        />
                        <span className="lp-option__dot" aria-hidden="true" />
                        <span className="lp-option__text">{opt.label}</span>
                      </label>
                    ))}
              </div>
            </li>
          ))}
        </ol>

        <div className="lp-quiz-footer">
          <p className="lp-quiz-footer__progress" aria-live="polite">
            <span id="answeredNum">{answered}</span> of {questions.length} answered
          </p>
          <button type="submit" className="lp-btn lp-btn--complete" id="quizSubmitBtn" disabled={answered < questions.length}>
            Submit Quiz
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </form>
    </>
  );
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".doc", ".docx", ".zip", ".txt"];

function AssignmentForm({
  lessonId,
  courseId,
  csrfToken,
}: {
  lessonId: number;
  courseId: number;
  csrfToken: string;
}) {
  const draftKey = `lp_draft_${lessonId}`;
  const [charCount, setCharCount] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileDropRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved && textareaRef.current) {
      textareaRef.current.value = saved;
      setCharCount(saved.length);
      setDraftRestored(true);
    }
  }, [draftKey]);

  useEffect(() => {
    const form = document.getElementById("assignmentForm");
    if (!form) return;
    const onSubmit = () => localStorage.removeItem(draftKey);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [draftKey]);

  // Debounced auto-save (3 s), matching learn.php's 3000 ms timer. The timer lives in a
  // ref because it must survive re-renders without becoming render state.
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    },
    [],
  );

  const onInput = (value: string) => {
    setCharCount(value.length);
    setDraftSaved(false);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(draftKey, value);
      setDraftSaved(true);
    }, 3000);
  };

  const clearDraft = () => {
    localStorage.removeItem(draftKey);
    if (textareaRef.current) textareaRef.current.value = "";
    setCharCount(0);
    setDraftRestored(false);
  };

  const validateAndShowFile = (file: File) => {
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setFileError("File type not allowed. Please upload PDF, DOC, DOCX, ZIP or TXT.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileName(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File is too large. Maximum size is 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileName(null);
      return;
    }
    setFileError(null);
    setFileName(file.name);
  };

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileName(null);
    setFileError(null);
    setDragOver(false);
  };

  return (
    <div className="lp-submission-form-card">
      <h3>Your Submission</h3>

      <div id="draftRestoreNotice" className="lp-draft-notice" hidden={!draftRestored}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>Draft restored from your last session.</span>
        <button type="button" className="lp-draft-notice__clear" id="clearDraftBtn" onClick={clearDraft}>
          Clear draft
        </button>
      </div>

      <form method="post" action="/api/student/learn" id="assignmentForm" encType="multipart/form-data">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="action" value="submit_assignment" />
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input type="hidden" name="course_id" value={courseId} />

        <div className="lp-form-group">
          <label htmlFor="submissionText" className="lp-form-label">
            Write your answer
          </label>
          <textarea
            id="submissionText"
            name="submission_text"
            rows={12}
            className="lp-form-textarea"
            placeholder="Write your assignment response here…"
            required
            minLength={10}
            ref={textareaRef}
            onChange={(e) => onInput(e.target.value)}
          />
          <div className="lp-form-hint">
            <span id="charCount">{charCount}</span> characters
            <span id="draftSavedLabel" className="lp-draft-saved-label" hidden={!draftSaved}>
              · Draft saved
            </span>
          </div>
        </div>

        <div className="lp-form-group">
          <label className="lp-form-label">
            Attach a file <span className="lp-form-label--optional">(optional)</span>
          </label>
          <div
            className={`lp-file-drop ${dragOver ? "lp-file-drop--drag" : ""}`}
            id="fileDropZone"
            role="button"
            tabIndex={0}
            aria-label="Drop file here or click to browse"
            ref={fileDropRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer?.files?.[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                validateAndShowFile(file);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <input
              type="file"
              id="assignmentFile"
              name="assignment_file"
              className="lp-file-drop__input"
              accept=".pdf,.doc,.docx,.zip,.txt"
              aria-describedby="fileHint"
              ref={fileInputRef}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) validateAndShowFile(f);
              }}
            />
            <div className="lp-file-drop__content" id="fileDropContent" hidden={fileName !== null}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>
                Drag &amp; drop or <span className="lp-file-drop__browse">click to browse</span>
              </span>
            </div>
            <div className="lp-file-drop__selected" id="fileSelected" hidden={fileName === null}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span id="selectedFileName">{fileName}</span>
              <button type="button" id="removeFileBtn" className="lp-file-drop__remove" aria-label="Remove file" onClick={clearFile}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <p id="fileHint" className="lp-form-hint">
            PDF, DOC, DOCX, ZIP or TXT — max 10 MB
          </p>
          <p id="fileError" className="lp-form-error" hidden={fileError === null}>
            {fileError}
          </p>
        </div>

        <div className="lp-form-actions">
          <button type="submit" className="lp-btn lp-btn--complete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Submit Assignment
          </button>
        </div>
      </form>
    </div>
  );
}

/** PHP `nl2br(htmlspecialchars($text))` — rendered as React text plus <br/>. */
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

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}