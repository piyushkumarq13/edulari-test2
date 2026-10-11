import type { Metadata } from "next";
import "@/styles/css/admin/create-course.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCategories } from "@/lib/db/instructor/courses";
import { getAdminInstructorOptions } from "@/lib/db/admin/courses";
import { CURRENCY_CODE, CURRENCY_DISPLAY_SYMBOL } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import CreateCourseForm from "@/components/admin/CreateCourseForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: `Create Course — Admin | ${SITE_NAME}`,
  description: "Create a new course as a draft and assign an instructor.",
  noindex: true,
  canonical: false,
});

export default async function AdminCreateCoursePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [sp, csrfToken, categories, instructors] = await Promise.all([
    searchParams,
    readCsrfToken(),
    getCategories(),
    getAdminInstructorOptions(),
  ]);

  const pick = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const success = pick(sp.success) !== "";
  const newId = Number.parseInt(pick(sp.id) || "0", 10);

  return (
    <main className="cc-page-wrap ad-page-wrap">
      <div className="cc-page-inner">
        {/* ── Page Header ── */}
        <div className="cc-page-header">
          <div className="cc-page-header-left">
            <a href="/admin/courses" className="cc-back-btn" aria-label="Back to courses">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Courses
            </a>
            <div className="cc-page-title-group">
              <div className="cc-page-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="cc-page-title">Create New Course</h1>
                <p className="cc-page-subtitle">Saved as <strong>Draft</strong> — publish after adding content in Edit Course</p>
              </div>
            </div>
          </div>
          <div className="cc-steps" role="list" aria-label="Course creation steps">
            <div className="cc-step cc-step--active" role="listitem">
              <div className="cc-step-num" aria-current="step">1</div>
              <span className="cc-step-label">Basic Info</span>
            </div>
            <div className="cc-step-connector" aria-hidden="true" />
            <div className="cc-step cc-step--upcoming" role="listitem">
              <div className="cc-step-num">2</div>
              <span className="cc-step-label">Content</span>
            </div>
            <div className="cc-step-connector" aria-hidden="true" />
            <div className="cc-step cc-step--upcoming" role="listitem">
              <div className="cc-step-num">3</div>
              <span className="cc-step-label">Publish</span>
            </div>
          </div>
        </div>

        {success && newId ? (
          /* ── Success State ── */
          <div className="cc-success-banner" role="alert" aria-live="polite">
            <div className="cc-success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="cc-success-body">
              <p className="cc-success-title">Course Created Successfully!</p>
              <p className="cc-success-text">Your course has been saved as a draft. Add sections, lessons, and media to get it ready for students.</p>
            </div>
            <div className="cc-success-actions">
              <a href={`/admin/edit-course?id=${newId}`} className="cc-btn cc-btn--primary">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Add Content &amp; Details
              </a>
              <a href="/admin/create-course" className="cc-btn cc-btn--ghost">Create Another Course</a>
              <a href="/admin/courses" className="cc-btn cc-btn--outline">View All Courses</a>
            </div>
          </div>
        ) : (
          <CreateCourseForm
            csrfToken={csrfToken}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            instructors={instructors.map((i) => ({ id: i.id, name: i.name, email: i.email }))}
            currencySymbol={CURRENCY_DISPLAY_SYMBOL}
            currencyCode={CURRENCY_CODE}
          />
        )}
      </div>
    </main>
  );
}
