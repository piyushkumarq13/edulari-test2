import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { sql } from "@/lib/db/client";
import { getStudentStats } from "@/lib/db/commerce";
import { getStudentCourses, getStudentProfile } from "@/lib/db/learning";
import { getDoneDatesDesc, getLearningTotals, getWeekStats } from "@/lib/db/study-plan";
import { getWishlist } from "@/lib/db/commerce";
import { computeStreak } from "@/lib/learning/calendar";
import { APP_TIMEZONE, formatPrice, siteHour, todayInSiteTz } from "@/lib/format";
import DashboardClient, { type DashboardData } from "./DashboardClient";
import { DASHBOARD_EXTRA_STYLES } from "./dashboard-styles";
import "@/styles/css/student/dashboard.css";

export const metadata: Metadata = pageMetadata({
  title: "My Dashboard – Edulari",
  description: "Your learning dashboard: progress, streak, recommendations and quick links.",
  path: "/student/dashboard",
  noindex: true,
});

type Rec = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  price: string;
  category_name: string | null;
  instructor_name: string | null;
  avg_rating: string | null;
  student_count: number;
  lesson_count: number;
};

/** dashboard.php's personalised-then-random recommendation query. */
async function getRecommendations(interests: string[], enrolledIds: number[]): Promise<Rec[]> {
  if (interests.length > 0) {
    const rows = await sql<Rec[]>`
      SELECT c.*, cat.name AS category_name, u.name AS instructor_name,
        (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) AS avg_rating,
        (SELECT COUNT(*)::int FROM enrollments WHERE course_id = c.id) AS student_count,
        (SELECT COUNT(*)::int FROM lessons WHERE course_id = c.id) AS lesson_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.is_published = true
        AND cat.name IN ${sql(interests)}
        ${enrolledIds.length ? sql`AND c.id NOT IN ${sql(enrolledIds)}` : sql``}
      ORDER BY avg_rating DESC
      LIMIT 6
    `;
    if (rows.length > 0) return rows;
  }

  if (enrolledIds.length > 0) {
    return sql<Rec[]>`
      SELECT c.*, cat.name AS category_name, u.name AS instructor_name,
        (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) AS avg_rating,
        (SELECT COUNT(*)::int FROM enrollments WHERE course_id = c.id) AS student_count,
        (SELECT COUNT(*)::int FROM lessons WHERE course_id = c.id) AS lesson_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.is_published = true AND c.id NOT IN ${sql(enrolledIds)}
      ORDER BY random()
      LIMIT 6
    `;
  }

  return sql<Rec[]>`
    SELECT c.*, cat.name AS category_name, u.name AS instructor_name,
      (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) AS avg_rating,
      (SELECT COUNT(*)::int FROM enrollments WHERE course_id = c.id) AS student_count,
      (SELECT COUNT(*)::int FROM lessons WHERE course_id = c.id) AS lesson_count
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE c.is_published = true
    ORDER BY c.created_at DESC
    LIMIT 6 OFFSET 0
  `;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;
  const justOnboarded = sp.onboarded === "1";

  const [stats, studentProfile, myCourses, learningTotals, doneDates, wishlist, users] = await Promise.all([
    getStudentStats(user.id),
    getStudentProfile(user.id),
    getStudentCourses(user.id),
    getLearningTotals(user.id),
    getDoneDatesDesc(user.id),
    getWishlist(user.id),
    sql<{ profile_completed: boolean }[]>`SELECT profile_completed FROM users WHERE id = ${user.id}`,
  ]);

  const profileCompleted = !!users[0]?.profile_completed;
  const enrolledIds = myCourses.map((c) => Number(c.course_id));

  const interests = (studentProfile?.courses_interested ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const recommended = await getRecommendations(profileCompleted ? interests : [], enrolledIds);

  const todayStr = todayInSiteTz();
  const totalHours = Math.round((learningTotals.total_seconds / 3600) * 10) / 10;
  const streak = computeStreak(doneDates, todayStr);

  const inProgress = myCourses.filter((c) => Number(c.progress_percentage) < 100 && Number(c.progress_percentage) > 0);
  const notStarted = myCourses.filter((c) => Number(c.progress_percentage) === 0);
  const completed = myCourses.filter((c) => Number(c.progress_percentage) >= 100);
  const recentCourses = [...inProgress, ...notStarted].slice(0, 3);

  const overallPct = Number(stats.total_courses) > 0
    ? Math.round((Number(stats.completed_courses) / Number(stats.total_courses)) * 100)
    : 0;

  const hour = siteHour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const weekStat = await getWeekStats(user.id, todayStr, todayStr);

  const data: DashboardData = {
    userName: user.name,
    firstName: user.name.trim().split(" ")[0] ?? "",
    greeting,
    justOnboarded,
    showOnboardBanner: !profileCompleted,
    totalCourses: Number(stats.total_courses),
    completedCourses: Number(stats.completed_courses),
    wishlistCount: Number(stats.wishlist_count),
    cartCount: Number(stats.cart_count),
    totalHours,
    completedLessons: learningTotals.completed_lessons,
    learningDays: learningTotals.learning_days,
    streak,
    activeDates: doneDates,
    today: todayStr,
    overallPct,
    inProgressCount: inProgress.length,
    notStartedCount: notStarted.length,
    recentCourses: recentCourses.map((c) => ({
      courseId: Number(c.course_id),
      title: c.title,
      slug: c.slug,
      thumbnail: c.thumbnail,
      categoryName: c.category_name,
      categorySlug: c.category_slug ?? "general",
      instructorName: c.instructor_name ?? "",
      progressPercentage: Number(c.progress_percentage ?? 0),
      totalLessons: Number(c.total_lessons ?? 0),
      completedLessons: Number(c.completed_lessons ?? 0),
    })),
    firstContinueCourseId: inProgress.length > 0 ? Number(inProgress[0].course_id) : null,
    completedCoursesCards: completed.slice(0, 4).map((c) => ({
      courseId: Number(c.course_id),
      title: c.title,
      thumbnail: c.thumbnail,
      instructorName: c.instructor_name ?? "",
      certificateEnabled: c.certificate_enabled,
      hasCertificate: c.certificate_id !== null,
    })),
    completedCount: completed.length,
    personalised: profileCompleted && interests.length > 0,
    recommended: recommended.map((r) => ({
      id: Number(r.id),
      title: r.title,
      slug: r.slug,
      thumbnail: r.thumbnail,
      categoryName: r.category_name,
      instructorName: r.instructor_name ?? "",
      avgRating: r.avg_rating === null ? 0 : Number(r.avg_rating),
      studentCount: Number(r.student_count ?? 0),
      lessonCount: Number(r.lesson_count ?? 0),
      priceLabel: formatPrice(Number(r.price)),
    })),
    wishlistPreview: wishlist.slice(0, 3).map((w) => ({
      courseId: Number(w.course_id),
      slug: w.slug,
      title: w.title,
      thumbnail: w.thumbnail,
      priceLabel: formatPrice(Number(w.price)),
    })),
    weekStat,
    timezone: APP_TIMEZONE,
  };

  return (
    <>
      <style>{DASHBOARD_EXTRA_STYLES}</style>
      <DashboardClient {...data} />
    </>
  );
}