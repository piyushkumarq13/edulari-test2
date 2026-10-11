import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "@/styles/css/admin/edit-course.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCategories } from "@/lib/db/instructor/courses";
import { adminGetCourse, getAdminCourseOverview, getAdminInstructorList } from "@/lib/db/admin/courses";
import { CURRENCY_DISPLAY_SYMBOL } from "@/lib/format";
import EditCourseForm, { type EditCourse } from "@/components/admin/EditCourseForm";

export const dynamic = "force-dynamic";

function formatDay(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const id = Number.parseInt(Array.isArray(sp.id) ? (sp.id[0] ?? "0") : (sp.id ?? "0"), 10);
  const course = Number.isFinite(id) ? await adminGetCourse(id) : null;
  return pageMetadata({
    title: `Edit Course — ${course?.title ?? ""} | Admin`,
    description: "Edit course details, pricing, visibility and thumbnail.",
    noindex: true,
    canonical: false,
  });
}

export default async function AdminEditCoursePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [sp, csrfToken, categories, instructors] = await Promise.all([
    searchParams,
    readCsrfToken(),
    getCategories(),
    getAdminInstructorList(),
  ]);

  const pick = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
  const courseId = Number.parseInt(pick(sp.id) || "0", 10);
  if (!Number.isFinite(courseId) || courseId <= 0) redirect("/admin/courses");

  const course = await adminGetCourse(courseId);
  if (!course) redirect("/admin/courses");

  const overview = await getAdminCourseOverview(courseId);

  const editCourse: EditCourse = {
    id: course.id,
    instructor_id: course.instructor_id,
    category_id: course.category_id,
    title: course.title,
    short_description: course.short_description,
    description: course.description,
    level: course.level,
    language: course.language,
    duration_hours: course.duration_hours,
    price: course.price,
    is_published: course.is_published,
    is_featured: course.is_featured,
    certificate_enabled: course.certificate_enabled,
    passing_percentage: course.passing_percentage,
    thumbnail: course.thumbnail,
    instructor_name: course.instructor_name,
    category_name: course.category_name,
  };

  return (
    <main className="ec-page-wrap ad-page-wrap">
      <div className="ec-page-inner">
        {/* ── Page Header ── */}
        <div className="ec-page-header">
          <div className="ec-page-header-left">
            <a href="/admin/courses" className="ec-back-btn" aria-label="Back to courses">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Courses
            </a>
            <div className="ec-page-title-group">
              <div className="ec-page-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h1 className="ec-page-title">Edit Course</h1>
                <p className="ec-page-subtitle">
                  ID #{course.id} &nbsp;·&nbsp;{" "}
                  {course.is_published ? (
                    <span className="ec-status-badge ec-status-badge--published">Published</span>
                  ) : (
                    <span className="ec-status-badge ec-status-badge--draft">Draft</span>
                  )}{" "}
                  {course.is_featured ? <span className="ec-status-badge ec-status-badge--featured">Featured</span> : null}
                </p>
              </div>
            </div>
          </div>
          <div className="ec-page-header-right">
            <a href="/admin/courses" className="ec-btn ec-btn--ghost">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Discard
            </a>
            <button type="submit" form="editCourseForm" className="ec-btn ec-btn--primary">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Save Changes
            </button>
          </div>
        </div>

        <EditCourseForm
          csrfToken={csrfToken}
          course={editCourse}
          createdLabel={formatDay(course.created_at)}
          updatedLabel={formatDay(course.updated_at)}
          overview={overview}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          instructors={instructors.map((i) => ({ id: i.id, name: i.name }))}
          currencySymbol={CURRENCY_DISPLAY_SYMBOL}
          success={pick(sp.success)}
        />
      </div>
    </main>
  );
}
