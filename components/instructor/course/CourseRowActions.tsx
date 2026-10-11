"use client";

import { useRef, useState } from "react";

/**
 * The row actions on courses.php. Each button posts to the course action endpoint and follows
 * the redirect the server returns, so the outcome is always a full page load (PRG), exactly as
 * the PHP's header('Location: courses.php?msg=...') did. The delete button first flips a hidden
 * confirm_delete flag from "no" to "yes", which is what the PHP confirm() dialog achieved.
 */
export function CourseRowActions({
  courseId,
  isPublished,
  csrfToken,
}: {
  courseId: number;
  isPublished: boolean;
  csrfToken: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const post = async (action: string, confirmDelete?: boolean) => {
    if (busy) return;
    if (confirmDelete) {
      const warning =
        "WARNING: This will permanently delete the course and ALL its content (sections, lessons, quizzes, assignments, enrollments). This cannot be undone.\n\nAre you sure?";
      if (!window.confirm(warning)) return;
    }
    setBusy(action);
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    fd.append("course_id", String(courseId));
    fd.append("action", action);
    if (confirmDelete) fd.append("confirm_delete", "yes");
    try {
      const res = await fetch(`/api/instructor/course/${courseId}`, { method: "POST", body: fd });
      const json = (await res.json()) as { redirect?: string; error?: string };
      if (json.redirect) window.location.href = json.redirect;
      else window.alert(json.error || "Something went wrong.");
    } catch {
      window.alert("Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="incrs-actions-wrap">
      <a href={`/instructor/edit-course?id=${courseId}`} className="incrs-action-btn incrs-action-btn--edit" title="Edit course settings">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Edit
      </a>

      <a href={`/instructor/course-content?id=${courseId}`} className="incrs-action-btn incrs-action-btn--content" title="Manage course content">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        Content
      </a>

      <a href={`/instructor/course-analytics?id=${courseId}`} className="incrs-action-btn incrs-action-btn--stats" title="View analytics">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Stats
      </a>

      {isPublished ? (
        <button type="button" disabled={!!busy} onClick={() => post("unpublish")} className="incrs-action-btn incrs-action-btn--unpublish" title="Unpublish course">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Unpublish
        </button>
      ) : (
        <button type="button" disabled={!!busy} onClick={() => post("publish")} className="incrs-action-btn incrs-action-btn--publish" title="Publish course">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <polyline points="16 12 12 8 8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="16" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Publish
        </button>
      )}

      <button
        type="button"
        disabled={!!busy}
        onClick={() => post("delete", true)}
        className="incrs-action-btn incrs-action-btn--delete incrs-delete-form"
        title="Delete course permanently"
      >
        <input type="hidden" className="incrs-confirm-flag" value="yes" readOnly />
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Delete
      </button>
    </div>
  );
}

/** courses.php's filter bar; a plain GET form so the URL stays shareable. */
export function CourseFilters({
  search,
  status,
}: {
  search: string;
  status: string;
}) {
  const ref = useRef<HTMLFormElement | null>(null);
  return (
    <form method="get" className="incrs-filters-form" role="search" ref={ref} action="/instructor/courses">
      <div className="incrs-search-wrap">
        <svg className="incrs-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input type="search" name="search" className="incrs-search-input" placeholder="Search courses…" defaultValue={search} aria-label="Search courses" />
      </div>
      <select name="status" className="incrs-select" aria-label="Filter by status" defaultValue={status}>
        <option value="">All Statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <button type="submit" className="incrs-btn-filter">Filter</button>
      {search || status ? <a href="/instructor/courses" className="incrs-btn-clear">Clear</a> : null}
    </form>
  );
}