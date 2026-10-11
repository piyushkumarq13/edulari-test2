"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownEditor from "@/components/instructor/MarkdownEditor";
import CustomSelect from "./CustomSelect";

export type LessonPayload = {
  lesson: {
    id: number;
    section_id: number;
    title: string;
    content_type: string;
    content_text: string | null;
    video_url: string | null;
    video_duration: number;
    is_free_preview: boolean;
    /** Stored shape, as loaded from quiz_questions + quiz_options. */
    quiz_questions?: Array<{
      question: string;
      question_type: string;
      points: number;
      options: Array<{ id: number; option_text: string; is_correct: boolean }>;
    }>;
    assignment?: AssignmentData | null;
  } | null;
  sections: Array<{ id: number; title: string }>;
};

/** The editable form shape for one question card. */
export type QuizQuestion = {
  question: string;
  question_type: string;
  points: number;
  options: string[];
  correct_option: number;
  correct_answer: string;
};

export type AssignmentData = {
  instructions: string | null;
  max_marks: number;
  passing_marks: number;
  due_days: number;
  allow_late_submission: boolean;
};

const CONTENT_TYPES = [
  { value: "", label: "Select content type…" },
  { value: "video", label: "🎬 Video" },
  { value: "text", label: "📄 Text Article" },
  { value: "pdf", label: "📄 File / Document" },
  { value: "quiz", label: "❓ Quiz" },
  { value: "assignment", label: "📝 Assignment" },
];

const emptyQuestion = (): QuizQuestion => ({
  question: "",
  question_type: "multiple_choice",
  points: 1,
  options: ["", "", "", ""],
  correct_option: 0,
  correct_answer: "true",
});

/**
 * The Add/Edit Lesson modal from course-content.php, ported as a React component. The PHP
 * toggled the field block on the content_type select, built quiz question cards as an
 * accordion array, and switched the submit button between add_lesson and edit_lesson. The
 * modal is rendered here and the form is posted to the course-content action endpoint.
 */
export default function LessonModal({
  open,
  sections,
  initialSectionId,
  lesson,
  csrfToken,
  courseId,
  onClose,
  onSaved,
}: {
  open: boolean;
  sections: Array<{ id: number; title: string }>;
  initialSectionId: number;
  lesson: LessonPayload["lesson"];
  csrfToken: string;
  courseId: number;
  onClose: () => void;
  onSaved: (redirect: string) => void;
}) {
  const [sectionId] = useState<number>(initialSectionId);
  const [contentType, setContentType] = useState(lesson?.content_type ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    lesson?.quiz_questions?.length
      ? lesson.quiz_questions.map((q) => ({
          question: q.question,
          question_type: q.question_type,
          points: q.points,
          options:
            q.options.length > 0
              ? q.options.map((o) => o.option_text)
              : ["", "", "", ""],
          correct_option: Math.max(
            0,
            q.options.findIndex((o) => o.is_correct),
          ),
          correct_answer: (() => {
            const idx = q.options.findIndex((o) => o.is_correct);
            return idx >= 0 && q.options[idx]?.option_text === "False" ? "false" : "true";
          })(),
        }))
      : [],
  );
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const pdfNameRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll, as lockBodyScroll() did.
    const scroll = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scroll}px`;
    document.body.style.width = "100%";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scroll);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const isEdit = Boolean(lesson?.id);

  const updateQuestion = (i: number, patch: Partial<QuizQuestion>) => {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, emptyQuestion()]);
    setCollapsed(new Set());
  };

  const removeQuestion = (i: number) => {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    fd.set("csrf_token", csrfToken);
    fd.set("action", isEdit ? "edit_lesson" : "add_lesson");
    // Serialize the quiz question array the way the PHP's quiz_questions[i][field] names did.
    fd.delete("quiz_questions");
    questions.forEach((q, i) => {
      if (q.question_type === "multiple_choice") {
        q.options.forEach((opt, oi) => fd.append(`quiz_questions[${i}][options][${oi}]`, opt));
        fd.append(`quiz_questions[${i}][correct_option]`, String(q.correct_option));
      } else {
        fd.append(`quiz_questions[${i}][correct_answer]`, q.correct_answer);
      }
      fd.append(`quiz_questions[${i}][question]`, q.question);
      fd.append(`quiz_questions[${i}][type]`, q.question_type);
      fd.append(`quiz_questions[${i}][points]`, String(q.points));
    });

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/instructor/course/${courseId}/content`, { method: "POST", body: fd });
      const json = (await res.json()) as { redirect?: string; error?: string };
      if (json.redirect) onSaved(json.redirect);
      else setError(json.error || "Something went wrong.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const showType = (t: string) => contentType === t;

  return (
    <div id="lessonModal" className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" style={{ display: "block" }}>
      <div className="cc-modal-backdrop" id="modalBackdrop" onClick={onClose} />
      <div className="cc-modal-dialog">
        <div className="cc-modal-header">
          <div>
            <h2 className="cc-modal-title" id="modalTitle">{isEdit ? "Edit Lesson" : "Add New Lesson"}</h2>
            <p className="cc-modal-section-name" id="modalSectionName">
              Section: {sections.find((s) => s.id === sectionId)?.title ?? ""}
            </p>
          </div>
          <button type="button" className="cc-modal-close" id="modalCloseBtn" aria-label="Close modal" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="cc-modal-body">
          {error ? (
            <div className="cc-alert cc-alert--error" role="alert">{error}</div>
          ) : null}
          <form method="post" encType="multipart/form-data" id="lessonForm" noValidate onSubmit={submit}>
            <input type="hidden" name="section_id" id="modalSectionId" value={sectionId} readOnly />
            <input type="hidden" name="lesson_id" id="modalLessonId" value={lesson?.id ?? ""} readOnly />
            <div className="cc-field">
              <label className="cc-label" htmlFor="lessonTitleInput">Lesson Title <span className="cc-required">*</span></label>
              <input
                type="text"
                name="lesson_title"
                id="lessonTitleInput"
                className="cc-input"
                placeholder="e.g. Getting Started with the Basics"
                required
                ref={titleRef}
                defaultValue={lesson?.title ?? ""}
              />
            </div>

            <div className="cc-field">
              <label className="cc-label" htmlFor="contentType">Content Type <span className="cc-required">*</span></label>
              <CustomSelect
                name="content_type"
                prefix="cc"
                id="contentType"
                required
                options={CONTENT_TYPES}
                defaultValue={lesson?.content_type ?? ""}
                ariaLabel="Content type"
                onChange={setContentType}
              />
            </div>

            {showType("video") ? (
              <div id="videoFields" className="cc-type-fields">
                <div className="cc-field">
                  <label className="cc-label" htmlFor="videoUrlInput">Video URL</label>
                  <input type="text" name="video_url" id="videoUrlInput" className="cc-input" placeholder="YouTube share URL or iframe embed code" defaultValue={lesson?.video_url ?? ""} />
                  <span className="cc-hint">Paste a YouTube share link (youtu.be / watch?v=), a YouTube <code>&lt;iframe&gt;</code> embed code, or a direct video URL</span>
                </div>
                <div className="cc-field">
                  <label className="cc-label" htmlFor="videoDurationInput">Duration (seconds)</label>
                  <input type="number" name="video_duration" id="videoDurationInput" className="cc-input cc-input--half" placeholder="600" min="0" defaultValue={lesson?.video_duration ?? 0} />
                  <span className="cc-hint">e.g. 600 = 10 minutes</span>
                </div>
              </div>
            ) : null}

            {showType("text") ? (
              <div id="textFields" className="cc-type-fields">
                <div className="cc-field">
                  <label className="cc-label" htmlFor="contentTextArea">Article Content</label>
                  <MarkdownEditor name="content_text" textareaId="contentTextArea" defaultValue={lesson?.content_text ?? ""} rows={6} draftKey="mde_draft_contentTextArea" />
                </div>
              </div>
            ) : null}

            {showType("pdf") ? (
              <div id="pdfFields" className="cc-type-fields">
                <div className="cc-field">
                  <label className="cc-label" htmlFor="pdfFileInput">Upload File</label>
                  <div className="cc-file-drop" id="fileDrop">
                    <svg viewBox="0 0 24 24" fill="none" width="32" height="32" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p>Drag &amp; drop or <label htmlFor="pdfFileInput" className="cc-file-link">browse</label></p>
                    <p className="cc-file-hint">PDF/DOC/DOCX/PPT/PPTX/XLS/XLSX/TXT/ZIP/Images/MP4/MP3 · Max 50MB</p>
                    <input
                      type="file"
                      name="pdf_file"
                      id="pdfFileInput"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.mp4,.webm,.mp3,.jpg,.jpeg,.png,.gif,.webp"
                      className="cc-file-input"
                      onChange={(e) => { if (pdfNameRef.current) pdfNameRef.current.textContent = e.target.files?.[0]?.name ?? ""; }}
                    />
                  </div>
                  <p className="cc-file-name" id="pdfFileName" ref={pdfNameRef} />
                </div>
              </div>
            ) : null}

            {showType("quiz") ? (
              <div id="quizFields" className="cc-type-fields">
                <div className="cc-quiz-header">
                  <h3 className="cc-quiz-heading">Quiz Questions</h3>
                  <button type="button" className="cc-btn cc-btn--sm cc-btn--primary" id="addQuestionBtn" onClick={addQuestion}>
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Add Question
                  </button>
                </div>
                <div id="questionsContainer" className="cc-questions-container">
                  {questions.map((q, qi) => {
                    const isCollapsed = collapsed.has(qi);
                    return (
                      <div key={qi} className={`cc-question-card${isCollapsed ? " cc-question-card--collapsed" : ""}`}>
                        <div className="cc-question-header" onClick={() => {
                          setCollapsed((prev) => {
                            const next = new Set(isCollapsed ? prev : [...prev].filter((x) => x !== qi));
                            if (isCollapsed) next.delete(qi);
                            else next.add(qi);
                            return next;
                          });
                        }}>
                          <span className="cc-question-expand">
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                          <span className="cc-question-num">Question {qi + 1}</span>
                          <button type="button" className="cc-btn cc-btn--sm cc-btn--danger-ghost cc-remove-q" aria-label="Remove question" onClick={(e) => { e.stopPropagation(); removeQuestion(qi); }}>
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                          </button>
                        </div>
                        <div className="cc-question-body">
                          <div className="cc-field">
                            <label className="cc-label">Question Text</label>
                            <textarea className="cc-textarea" rows={2} placeholder="Enter your question…" required value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} />
                          </div>
                          <div className="cc-field">
                            <label className="cc-label">Question Type</label>
                            <select className="cc-select cc-q-type-select" value={q.question_type} onChange={(e) => updateQuestion(qi, { question_type: e.target.value })}>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="true_false">True / False</option>
                            </select>
                          </div>
                          {q.question_type === "multiple_choice" ? (
                            <div className="cc-mc-options">
                              <p className="cc-label">Options <span className="cc-hint">(select the correct answer)</span></p>
                              {[0, 1, 2, 3].map((oi) => (
                                <label className="cc-mc-option" key={oi}>
                                  <input type="radio" name={`q_${qi}_correct`} checked={q.correct_option === oi} onChange={() => updateQuestion(qi, { correct_option: oi })} />
                                  <input
                                    type="text"
                                    className="cc-input"
                                    placeholder={`Option ${oi + 1}`}
                                    value={q.options[oi] ?? ""}
                                    onChange={(e) => {
                                      const next = [...q.options];
                                      next[oi] = e.target.value;
                                      updateQuestion(qi, { options: next });
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="cc-tf-options">
                              <label className="cc-label">Correct Answer</label>
                              <div className="cc-tf-btns">
                                <label className="cc-tf-btn"><input type="radio" name={`q_${qi}_tf`} checked={q.correct_answer === "true"} onChange={() => updateQuestion(qi, { correct_answer: "true" })} /> True</label>
                                <label className="cc-tf-btn"><input type="radio" name={`q_${qi}_tf`} checked={q.correct_answer === "false"} onChange={() => updateQuestion(qi, { correct_answer: "false" })} /> False</label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {questions.length === 0 ? <p className="cc-quiz-empty" id="quizEmptyMsg">Click &quot;Add Question&quot; to build your quiz.</p> : null}
              </div>
            ) : null}

            {showType("assignment") ? (
              <div id="assignmentFields" className="cc-type-fields">
                <div className="cc-field">
                  <label className="cc-label" htmlFor="assignmentInstructions">Assignment Instructions</label>
                  <textarea name="assignment_instructions" id="assignmentInstructions" className="cc-textarea" rows={4} placeholder="Describe what students need to do…" defaultValue={lesson?.assignment?.instructions ?? ""} />
                </div>
                <div className="cc-field-row">
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="maxMarksInput">Maximum Marks</label>
                    <input type="number" name="max_marks" id="maxMarksInput" className="cc-input" defaultValue={lesson?.assignment?.max_marks ?? 100} min="1" />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="passingMarksInput">Passing Marks</label>
                    <input type="number" name="passing_marks" id="passingMarksInput" className="cc-input" defaultValue={lesson?.assignment?.passing_marks ?? 40} min="1" />
                  </div>
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="dueDaysInput">Due (days after enrollment)</label>
                    <input type="number" name="due_days" id="dueDaysInput" className="cc-input" defaultValue={lesson?.assignment?.due_days ?? 7} min="1" />
                  </div>
                </div>
                <label className="cc-checkbox-label">
                  <input type="checkbox" name="allow_late_submission" id="allowLateSub" className="cc-checkbox" defaultChecked={Boolean(lesson?.assignment?.allow_late_submission)} />
                  <span>Allow late submissions</span>
                </label>
              </div>
            ) : null}

            <div className="cc-field cc-field--toggle">
              <label className="cc-checkbox-label">
                <input type="checkbox" name="is_free_preview" id="freePreviewCheck" className="cc-checkbox" defaultChecked={Boolean(lesson?.is_free_preview)} />
                <span>Mark as <strong>Free Preview</strong> (visible to non-enrolled students)</span>
              </label>
            </div>

            <div className="cc-modal-footer">
              <button type="button" className="cc-btn cc-btn--secondary" id="cancelModalBtn" onClick={onClose}>Cancel</button>
              <button type="submit" name="action" id="modalSubmitBtn" className="cc-btn cc-btn--primary" disabled={busy}>
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true" id="modalSubmitIcon">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span id="modalSubmitText">{isEdit ? "Update Lesson" : "Add Lesson"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}