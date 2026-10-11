import type { Metadata } from "next";
import "@/styles/css/instructor/create-course.css";
import "@/styles/css/md-editor.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCategories } from "@/lib/db/instructor/courses";
import CourseEditor, { type CourseFormValues } from "@/components/instructor/course/CourseEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Create Course – Edulari",
  description: "Create a new course.",
  noindex: true,
  canonical: false,
});

/** create-course.php rendered an empty form; a failed POST re-rendered with the $_POST values. */
const empty: CourseFormValues = {
  title: "",
  short_description: "",
  description: "",
  category_id: "",
  level: "",
  language: "English",
  duration_hours: "0",
  price: "0.00",
  certificate_enabled: true,
  passing_percentage: "70",
  what_you_learn: "",
  requirements: "",
};

export default async function CreateCoursePage() {
  await requireInstructorApproved();
  const [categories, csrfToken] = await Promise.all([getCategories(), readCsrfToken()]);

  return (
    <main className="in-page-wrap cc-wrap">
      <div className="cc-page-header">
        <div>
          <h1 className="cc-page-title">Create New Course</h1>
          <p className="cc-page-sub">Fill in the details below, then add your content on the next step.</p>
        </div>
        <a href="/instructor/courses" className="cc-back-btn">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          My Courses
        </a>
      </div>

      <CourseEditor
        prefix="cc"
        action="/api/instructor/course"
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        values={empty}
        csrfToken={csrfToken}
      />

      <div className="cc-actions">
        <a href="/instructor/courses" className="cc-btn cc-btn--ghost">Cancel</a>
        <button type="submit" form="mainForm" className="cc-btn cc-btn--primary">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Create Course &amp; Add Content
        </button>
      </div>
    </main>
  );
}