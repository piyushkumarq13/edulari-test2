"use client";

import { useState } from "react";
import LessonModal, { type LessonPayload } from "./LessonModal";

export type SectionWithLessons = {
  section: { id: number; title: string; sort_order: number };
  lessons: Array<{
    id: number;
    section_id: number;
    title: string;
    content_type: string;
    content_text: string | null;
    video_url: string | null;
    video_duration: number;
    is_free_preview: boolean;
    quiz_questions?: Array<{
      question: string;
      question_type: string;
      points: number;
      options: Array<{ id: number; option_text: string; is_correct: boolean }>;
    }>;
    quiz_count: number;
    total_points: number;
    assignment: { max_marks: number; due_days: number; passing_marks: number; allow_late_submission: boolean; instructions: string | null } | null;
  }>;
};

/**
 * The interactive half of course-content.php: the add-section form, the per-section add/edit
 * lesson buttons that open the modal, and the delete confirmations. Everything else in that
 * page is static markup rendered on the server.
 */
export default function CourseContentClient({
  courseId,
  csrfToken,
  sections,
  sectionList,
  onMessage,
}: {
  courseId: number;
  csrfToken: string;
  sections: SectionWithLessons[];
  sectionList: Array<{ id: number; title: string }>;
  onMessage?: (msg: string, error: boolean) => void;
}) {
  const [modal, setModal] = useState<{ open: boolean; sectionId: number; lesson: LessonPayload["lesson"] }>({
    open: false,
    sectionId: sections[0]?.section.id ?? 0,
    lesson: null,
  });
  const [newSection, setNewSection] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (body: Record<string, string>) => {
    if (busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    for (const [k, v] of Object.entries(body)) fd.append(k, v);
    try {
      const res = await fetch(`/api/instructor/course/${courseId}/content`, { method: "POST", body: fd });
      const json = (await res.json()) as { redirect?: string; error?: string };
      if (json.redirect) window.location.href = json.redirect;
      else {
        onMessage?.(json.error || "Something went wrong.", true);
        setBusy(false);
      }
    } catch {
      onMessage?.("Something went wrong.", true);
      setBusy(false);
    }
  };

  const addSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSection.trim();
    if (!title) return;
    await post({ add_section: "1", section_title: title });
  };

  return (
    <>
      {/* Add section */}
      <div className="cc-card cc-card--add-section">
        <h2 className="cc-card-title">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add New Section
        </h2>
        <form className="cc-add-section-form" onSubmit={addSection}>
          <div className="cc-form-row">
            <input
              type="text"
              name="section_title"
              className="cc-input"
              placeholder="e.g. Introduction to the Course"
              required
              aria-label="Section title"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
            />
            <button type="submit" name="add_section" className="cc-btn cc-btn--primary" disabled={busy}>
              Add Section
            </button>
          </div>
        </form>
      </div>

      {/* Sections */}
      {sections.length > 0 ? (
        <div className="cc-sections-list">
          {sections.map(({ section, lessons }, sIdx) => (
            <div className="cc-section-card" id={`section-${section.id}`} key={section.id}>
              <div className="cc-section-header">
                <div className="cc-section-header-left">
                  <span className="cc-section-number">{sIdx + 1}</span>
                  <div>
                    <h3 className="cc-section-title">{section.title}</h3>
                    <span className="cc-section-meta">
                      {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="cc-section-header-actions">
                  <button
                    type="button"
                    className="cc-btn cc-btn--sm cc-btn--ghost js-add-lesson"
                    onClick={() => setModal({ open: true, sectionId: section.id, lesson: null })}
                    aria-label={`Add lesson to ${section.title}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Add Lesson
                  </button>
                  <button
                    type="button"
                    className="cc-btn cc-btn--sm cc-btn--danger-ghost"
                    aria-label={`Delete section ${section.title}`}
                    onClick={() => {
                      if (window.confirm("Delete this section and all its lessons?")) {
                        void post({ delete_section: "1", section_id_delete: String(section.id) });
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {lessons.length > 0 ? (
                <div className="cc-lessons-list">
                  {lessons.map((lesson, lIdx) => (
                    <div className="cc-lesson-item" key={lesson.id}>
                      <div className="cc-lesson-left">
                        <span className="cc-lesson-index">{lIdx + 1}</span>
                        <div className={`cc-lesson-icon cc-lesson-icon--${lesson.content_type}`} aria-hidden="true">
                          <LessonIcon type={lesson.content_type} />
                        </div>
                        <div className="cc-lesson-info">
                          <span className="cc-lesson-title">{lesson.title}</span>
                          <div className="cc-lesson-meta-row">
                            <span className={`cc-type-badge cc-type-badge--${lesson.content_type}`}>
                              {lesson.content_type.charAt(0).toUpperCase() + lesson.content_type.slice(1)}
                            </span>
                            {lesson.is_free_preview ? <span className="cc-type-badge cc-type-badge--free">Free Preview</span> : null}
                            {lesson.content_type === "video" && lesson.video_duration > 0 ? (
                              <span className="cc-lesson-duration">
                                {Math.floor(lesson.video_duration / 60)}m {lesson.video_duration % 60}s
                              </span>
                            ) : null}
                            {lesson.content_type === "quiz" && lesson.quiz_count > 0 ? (
                              <span className="cc-lesson-duration">
                                {lesson.quiz_count} questions · {lesson.total_points} pts
                              </span>
                            ) : null}
                            {lesson.content_type === "assignment" && lesson.assignment ? (
                              <span className="cc-lesson-duration">
                                {lesson.assignment.max_marks} marks · {lesson.assignment.due_days} days
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="cc-lesson-right">
                        <button
                          type="button"
                          className="cc-btn cc-btn--sm cc-btn--ghost js-edit-lesson"
                          aria-label="Edit lesson"
                          onClick={() => setModal({ open: true, sectionId: section.id, lesson })}
                        >
                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="cc-btn cc-btn--sm cc-btn--danger-ghost"
                          aria-label={`Delete lesson ${lesson.title}`}
                          onClick={() => {
                            if (window.confirm("Delete this lesson?")) {
                              void post({ delete_lesson: "1", lesson_id_delete: String(lesson.id) });
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cc-section-empty">
                  <p>No lessons yet.</p>
                  <button
                    type="button"
                    className="cc-btn cc-btn--sm cc-btn--primary js-add-lesson"
                    onClick={() => setModal({ open: true, sectionId: section.id, lesson: null })}
                  >
                    Add First Lesson
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-empty-state">
          <div className="cc-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="44" height="44">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="cc-empty-title">No sections yet</p>
          <p className="cc-empty-sub">Add your first section above to start building your course curriculum.</p>
        </div>
      )}

      <LessonModal
        // Remounting on open/section/lesson keeps the modal's state fresh without an effect.
        key={`${modal.open}-${modal.sectionId}-${modal.lesson?.id ?? 0}`}
        open={modal.open}
        sections={sectionList}
        initialSectionId={modal.sectionId}
        lesson={modal.lesson}
        csrfToken={csrfToken}
        courseId={courseId}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={(url) => { window.location.href = url; }}
      />
    </>
  );
}

function LessonIcon({ type }: { type: string }) {
  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "text") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "pdf") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "quiz") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}