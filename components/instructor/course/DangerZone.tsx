"use client";

import { useState } from "react";

/**
 * The Danger Zone card from edit-course.php. It lives in a client component because the Delete
 * button carries an onClick handler; the PHP used a hidden form submitted after confirm().
 */
export default function DangerZone({ prefix, courseId, csrfToken }: { prefix: string; courseId: number; csrfToken: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className={`${prefix}-card ${prefix}-card--danger`} style={{ marginTop: 16 }}>
      <h2 className={`${prefix}-card-title ${prefix}-card-title--danger`}>
        <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Danger Zone
      </h2>
      <p className={`${prefix}-danger-desc`}>These actions are irreversible. Please be certain before proceeding.</p>
      <div className={`${prefix}-danger-actions`}>
        <button
          type="button"
          id="deleteCourseBtn"
          disabled={busy}
          className={`${prefix}-btn ${prefix}-btn--danger`}
          onClick={async () => {
            if (!window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;
            setBusy(true);
            const fd = new FormData();
            fd.append("csrf_token", csrfToken);
            fd.append("course_id", String(courseId));
            fd.append("action", "delete");
            fd.append("confirm_delete", "yes");
            try {
              const res = await fetch(`/api/instructor/course/${courseId}`, { method: "POST", body: fd });
              const json = (await res.json()) as { redirect?: string; error?: string };
              if (json.redirect) window.location.href = json.redirect;
              else window.alert(json.error || "Failed to delete course. Please try again.");
            } catch {
              window.alert("Failed to delete course. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Delete Course
        </button>
      </div>
    </div>
  );
}