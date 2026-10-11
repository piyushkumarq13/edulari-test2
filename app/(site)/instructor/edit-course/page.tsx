import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/styles/css/instructor/edit-course.css";
import "@/styles/css/md-editor.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCategories, getCourseById, getCourseQuickStats } from "@/lib/db/instructor/courses";
import CourseEditor, { type CourseFormValues } from "@/components/instructor/course/CourseEditor";
import DangerZone from "@/components/instructor/course/DangerZone";
import { toNumber } from "@/lib/payments/amounts";
import { phpNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Edit Course – Edulari",
  description: "Edit your course settings.",
  noindex: true,
  canonical: false,
});

export default async function EditCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; success?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;
  // edit-course.php?id=N: the course id stays in the query string, so the URL is unchanged.
  const courseId = Number(sp.id ?? 0);

  const course = Number.isFinite(courseId) && courseId > 0 ? await getCourseById(courseId, user.id) : null;
  if (!course) redirect("/instructor/courses");

  const [categories, stats, csrfToken] = await Promise.all([
    getCategories(),
    getCourseQuickStats(courseId),
    readCsrfToken(),
  ]);

  const values: CourseFormValues = {
    title: course.title,
    short_description: course.short_description ?? "",
    description: course.description ?? "",
    category_id: course.category_id ? String(course.category_id) : "",
    level: course.level,
    language: course.language ?? "English",
    duration_hours: String(course.duration_hours ?? 0),
    price: String(toNumber(course.price)),
    certificate_enabled: Boolean(course.certificate_enabled),
    passing_percentage: String(course.passing_percentage ?? 70),
    what_you_learn: "",
    requirements: "",
  };

  const statusClass = course.is_published ? "ec-status--published" : "ec-status--draft";

  return (
    <main className="in-page-wrap ec-wrap">
      <div className="ec-page-header">
        <div className="ec-header-left">
          <a href={`/instructor/course-content?id=${courseId}`} className="ec-back-link">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Content
          </a>
          <h1 className="ec-page-title">Edit Course</h1>
          <p className="ec-page-sub">{course.title}</p>
        </div>

        <div className="ec-header-stats">
          <div className="ec-hstat">
            <span className="ec-hstat-val">{phpNumber(stats.total_students)}</span>
            <span className="ec-hstat-label">Students</span>
          </div>
          <div className="ec-hstat">
            <span className="ec-hstat-val">{phpNumber(stats.avg_rating, 1)}</span>
            <span className="ec-hstat-label">Avg Rating</span>
          </div>
          <div className="ec-hstat">
            <span className="ec-hstat-val">{phpNumber(stats.total_reviews)}</span>
            <span className="ec-hstat-label">Reviews</span>
          </div>
        </div>
      </div>

      <div className="ec-status-bar">
        <span className={`ec-status ${statusClass}`}>
          <span className="ec-status-dot" />
          {course.is_published ? "Published" : "Draft"}
        </span>
        {course.is_published ? (
          <a href={`/course/${course.slug}`} target="_blank" className="ec-preview-link">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Preview Course
          </a>
        ) : null}
      </div>

      <CourseEditor
        prefix="ec"
        action={`/api/instructor/course/${courseId}`}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        values={values}
        csrfToken={csrfToken}
        courseId={courseId}
        showThumbnailPreview
        currentThumbnail={course.thumbnail}
        success={sp.success ?? ""}
      />

      {/* Hidden delete form kept outside the main form, exactly as edit-course.php does. */}
      <form method="post" action={`/api/instructor/course/${courseId}`} id="deleteCourseForm" style={{ display: "none" }}>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="action" value="delete" />
        <input type="hidden" name="confirm_delete" value="yes" />
      </form>

      <div className="ec-actions">
        <a href="/instructor/courses" className="ec-btn ec-btn--ghost" id="ecCancelBtn">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Cancel
        </a>
        <a href={`/instructor/course-content?id=${courseId}`} className="ec-btn ec-btn--ghost">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit Content
        </a>
        <button type="submit" form="mainForm" className="ec-btn ec-btn--primary">
          <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          Save Changes
        </button>
      </div>

      <DangerZone prefix="ec" courseId={courseId} csrfToken={csrfToken} />
    </main>
  );
}
