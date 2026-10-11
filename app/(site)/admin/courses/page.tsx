import type { Metadata } from "next";
import "@/styles/css/admin/courses.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCategories } from "@/lib/db/instructor/courses";
import {
  countAdminCourses,
  getAdminCourses,
  getAdminCourseStats,
  getAdminInstructorList,
  type AdminCourseFilters,
} from "@/lib/db/admin/courses";
import CoursesView from "@/components/admin/CoursesView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Manage Courses – Admin",
  description: "View, publish, feature, and manage all platform courses.",
  noindex: true,
  canonical: false,
});

const VALID_SORTS = ["created_at", "title", "student_count", "price", "avg_rating"];

function toInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);

  const pick = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  const status = pick(sp.status);
  const search = pick(sp.search);
  const instructorRaw = pick(sp.instructor);
  const categoryRaw = pick(sp.category);
  const featured = pick(sp.featured);

  const sortParam = pick(sp.sort);
  const sortBy = VALID_SORTS.includes(sortParam) ? sortParam : "created_at";
  const sortDir = (pick(sp.dir) || "desc") === "asc" ? "asc" : "desc";

  let page = Math.max(1, toInt(pick(sp.page) || "1"));
  const limitParam = toInt(pick(sp.per_page) || "20");
  const limit = [10, 20, 50, 100].includes(limitParam) ? limitParam : 20;

  const queryFilters: AdminCourseFilters = {
    status,
    search,
    instructor: toInt(instructorRaw) || undefined,
    category: toInt(categoryRaw) || undefined,
    featured,
  };

  const [totalCount, stats, instructors, categories] = await Promise.all([
    countAdminCourses(queryFilters),
    getAdminCourseStats(),
    getAdminInstructorList(),
    getCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  page = Math.min(page, totalPages);
  const offset = (page - 1) * limit;

  const courses = await getAdminCourses(queryFilters, sortBy, sortDir, limit, offset);

  return (
    <CoursesView
      csrfToken={csrfToken}
      courses={courses}
      stats={stats}
      totalCount={totalCount}
      page={page}
      totalPages={totalPages}
      limit={limit}
      offset={offset}
      sortBy={sortBy}
      sortDir={sortDir}
      filters={{ status, search, instructor: instructorRaw, category: categoryRaw, featured }}
      instructors={instructors}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      message={pick(sp.msg)}
    />
  );
}
