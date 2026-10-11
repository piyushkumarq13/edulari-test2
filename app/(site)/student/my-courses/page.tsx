import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getCourseRatingMap, getStudentCourses } from "@/lib/db/learning";
import { getTotalHours } from "@/lib/db/study-plan";
import { formatMonthDayYear } from "@/lib/format";
import MyCoursesClient, { type MyCourseCard } from "./MyCoursesClient";
import "@/styles/css/student/my-courses.css";

export const metadata: Metadata = pageMetadata({
  title: "My Courses – Edulari",
  description: "Track your progress and continue where you left off.",
  path: "/student/my-courses",
  noindex: true,
});

export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const status = ["all", "in_progress", "completed", "not_started"].includes(sp.status ?? "")
    ? (sp.status as string)
    : "all";
  const search = (sp.search ?? "").trim();
  const sort = ["recent", "az", "za", "progress"].includes(sp.sort ?? "") ? (sp.sort as string) : "recent";
  const view = sp.view === "list" ? "list" : "grid";

  const [allCourses, totalHours] = await Promise.all([getStudentCourses(user.id), getTotalHours(user.id)]);

  const ratingMap = await getCourseRatingMap(allCourses.map((c) => Number(c.course_id)));

  const cards: MyCourseCard[] = allCourses.map((c) => ({
    courseId: Number(c.course_id),
    enrollmentId: Number(c.enrollment_id),
    title: c.title,
    thumbnail: c.thumbnail,
    categoryName: c.category_name,
    instructorName: c.instructor_name,
    progressPercentage: Number(c.progress_percentage ?? 0),
    totalLessons: Number(c.total_lessons ?? 0),
    completedLessons: Number(c.completed_lessons ?? 0),
    avgRating: ratingMap[Number(c.course_id)] ?? 0,
    enrolledAtLabel: c.enrolled_at ? formatMonthDayYear(c.enrolled_at) : "",
    completedAtLabel: c.completed_at ? formatMonthDayYear(c.completed_at) : null,
    certificateId: c.certificate_id,
  }));

  return (
    <MyCoursesClient
      cards={cards}
      totalHours={totalHours}
      status={status}
      search={search}
      sort={sort}
      view={view}
    />
  );
}