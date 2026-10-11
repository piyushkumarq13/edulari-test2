"use client";

import { useState } from "react";

/**
 * The "Publish Course" button course-content.php renders for a draft course. It posts the
 * publish action and follows the redirect, so the result is a full page load.
 */
export default function CoursePublishButton({ courseId, csrfToken }: { courseId: number; csrfToken: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="cc-btn cc-btn--success"
      onClick={async () => {
        setBusy(true);
        const fd = new FormData();
        fd.append("csrf_token", csrfToken);
        fd.append("course_id", String(courseId));
        fd.append("action", "publish");
        try {
          const res = await fetch(`/api/instructor/course/${courseId}`, { method: "POST", body: fd });
          const json = (await res.json()) as { redirect?: string; error?: string };
          if (json.redirect) window.location.href = json.redirect;
          else window.alert(json.error || "Failed to publish course.");
        } catch {
          window.alert("Failed to publish course.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Publish Course
    </button>
  );
}