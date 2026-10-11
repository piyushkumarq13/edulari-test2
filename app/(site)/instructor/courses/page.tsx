import type { Metadata } from "next";
import "@/styles/css/instructor/courses.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getInstructorCourses } from "@/lib/db/instructor/courses";
import { toNumber } from "@/lib/payments/amounts";
import { formatPrice, phpRound } from "@/lib/format";
import { CourseFilters, CourseRowActions } from "@/components/instructor/course/CourseRowActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "My Courses – Edulari",
  description: "Manage, publish and track all your courses.",
  noindex: true,
  canonical: false,
});

export default async function InstructorCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; status?: string; search?: string }>;
}) {
  const user = await requireInstructorApproved();
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);

  const status = sp.status ?? "";
  const search = sp.search ?? "";
  const courses = await getInstructorCourses(user.id, { status, search });
  const isFiltered = Boolean(search || status);

  return (
    <main className="in-page-wrap">
      <div className="incrs-page-inner">
        <div className="incrs-page-header">
          <div className="incrs-page-header-text">
            <h1 className="incrs-page-title">My Courses</h1>
            <p className="incrs-page-subtitle">Manage, publish and track all your courses.</p>
          </div>
          <a href="/instructor/create-course" className="incrs-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Create New Course
          </a>
        </div>

        {sp.msg ? (
          <div className="incrs-alert incrs-alert--success" role="alert">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {sp.msg}
          </div>
        ) : null}

        <div className="incrs-filters-bar">
          <CourseFilters search={search} status={status} />
          <p className="incrs-result-count">
            {courses.length} course{courses.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="incrs-table-card">
            <div className="incrs-table-wrap">
              <table className="incrs-table">
                <thead>
                  <tr>
                    <th className="incrs-th-course">Course</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Students</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th className="incrs-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr className="incrs-row" key={c.id}>
                      <td className="incrs-td-course">
                        <div className="incrs-course-cell">
                          {c.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.thumbnail.startsWith("http") ? c.thumbnail : `/media?type=avatar&key=${encodeURIComponent(c.thumbnail)}`} alt={c.title} className="incrs-thumb" width={56} height={40} loading="lazy" />
                          ) : (
                            <div className="incrs-thumb-placeholder" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                          <span className="incrs-course-title">{c.title}</span>
                        </div>
                      </td>
                      <td className="incrs-td-category">{c.category_name ?? "Uncategorized"}</td>
                      <td className="incrs-td-price">{formatPrice(toNumber(c.price))}</td>
                      <td className="incrs-td-students">{c.student_count}</td>
                      <td className="incrs-td-rating">
                        {c.avg_rating ? (
                          <span className="incrs-rating">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            {phpRound(Number(c.avg_rating), 1)}
                          </span>
                        ) : (
                          <span className="incrs-muted">N/A</span>
                        )}
                      </td>
                      <td className="incrs-td-status">
                        {c.is_published ? (
                          <span className="incrs-badge incrs-badge--published">Published</span>
                        ) : (
                          <span className="incrs-badge incrs-badge--draft">Draft</span>
                        )}
                      </td>
                      <td className="incrs-td-actions">
                        <CourseRowActions courseId={c.id} isPublished={Boolean(c.is_published)} csrfToken={csrfToken} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="incrs-empty-state">
            <div className="incrs-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" width="44" height="44">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            {isFiltered ? (
              <>
                <p className="incrs-empty-title">No courses match your filters.</p>
                <p className="incrs-empty-sub">Try adjusting your search or status filter.</p>
                <a href="/instructor/courses" className="incrs-btn-primary incrs-btn-primary--sm">Clear Filters</a>
              </>
            ) : (
              <>
                <p className="incrs-empty-title">You haven&apos;t created any courses yet.</p>
                <p className="incrs-empty-sub">Build your first course and start teaching today.</p>
                <a href="/instructor/create-course" className="incrs-btn-primary incrs-btn-primary--sm">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Create Your First Course
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}