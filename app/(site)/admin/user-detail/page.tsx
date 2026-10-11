import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import { getUserBasic, getUserDetails } from "@/lib/db/admin/users";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { APP_TIMEZONE, formatMonthDayYear, formatPrice, phpNumber } from "@/lib/format";
import UserDetailClient, {
  type ActivityItem,
  type CourseRow,
  type EnrollmentRow,
  type ProfileData,
} from "./UserDetailClient";
import "@/styles/css/admin/user-detail.css";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const id = Number(sp.id ?? 0);
  const basic = Number.isInteger(id) && id > 0 ? await getUserBasic(id) : null;
  return pageMetadata({
    title: basic ? `User Detail – ${basic.name} | Admin` : "User Detail — Admin",
    description: "Admin view of an Edulari user account.",
    path: "/admin/user-detail",
    noindex: true,
  });
}

export const dynamic = "force-dynamic";

/** PHP date('M d, Y H:i') — 24-hour. */
function fmtDateTime(input: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("month")} ${g("day")}, ${g("year")} ${g("hour")}:${g("minute")}`;
}

/** PHP date('F d, Y \a\t H:i') — 24-hour. */
function fmtLongDateTime(input: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("month")} ${g("day")}, ${g("year")} at ${g("hour")}:${g("minute")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "").toUpperCase();
}

function ucfirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default async function AdminUserDetailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const id = Number(sp.id ?? 0);
  const profile = Number.isInteger(id) && id > 0 ? await getUserDetails(id) : null;
  if (!profile) redirect("/admin/users?error=user_not_found");

  const csrfToken = await readCsrfToken();

  const isStudent = profile.role === "student";
  const isInstructor = profile.role === "instructor";
  const isAdmin = profile.role === "admin";
  const isBlocked = profile.block_reason === "admin_blocked";
  const isActive = profile.is_active === true;

  const roleBadgeClass = isAdmin ? "ud-badge--admin" : isInstructor ? "ud-badge--instructor" : "ud-badge--student";
  const statusLabel = isBlocked ? "Blocked" : isActive ? "Active" : "Inactive";
  const statusClass = isBlocked ? "ud-status--blocked" : isActive ? "ud-status--active" : "ud-status--inactive";

  const courses: CourseRow[] = (profile.courses ?? []).map((c) => {
    const rating = c.avg_rating === null ? null : Number(c.avg_rating);
    return {
      id: c.id,
      title: c.title,
      level: c.level ?? "",
      studentCount: phpNumber(Number(c.student_count)),
      hasRating: rating !== null,
      rating: rating !== null ? rating.toFixed(1) : "",
      pricePaid: Number(c.price) > 0,
      priceText: formatPrice(Number(c.price)),
      isPublished: c.is_published === true,
      created: formatMonthDayYear(c.created_at),
    };
  });

  const enrollments: EnrollmentRow[] = (profile.enrollments ?? []).map((e) => ({
    id: e.id,
    courseTitle: e.course_title,
    instructorName: e.instructor_name,
    progress: Math.min(100, Math.max(0, Number(e.progress_percentage) || 0)),
    enrolled: formatMonthDayYear(e.enrolled_at),
  }));

  const statsRaw = profile.stats ?? { total_students: 0, total_enrollments: 0, total_revenue: 0 };
  const completedCount = (profile.enrollments ?? []).filter((e) => Number(e.progress_percentage) >= 100).length;
  const avgProgress = enrollments.length
    ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
    : 0;

  const activity: ActivityItem[] = [{ kind: "created", title: "Account Created", date: fmtLongDateTime(profile.registration_date) }];
  if (profile.last_login) {
    activity.push({ kind: "login", title: "Last Login", date: fmtLongDateTime(profile.last_login) });
  }
  if (isInstructor && courses.length > 0) {
    activity.push({ kind: "course", title: "Latest Course Created", date: `${courses[0].title} — ${courses[0].created}` });
  }
  if (isStudent && enrollments.length > 0) {
    activity.push({ kind: "enrollment", title: "Latest Enrollment", date: `${enrollments[0].courseTitle} — ${enrollments[0].enrolled}` });
  }
  if (isBlocked) {
    activity.push({ kind: "blocked", title: "Account Blocked by Admin", date: profile.block_note ? `Reason: ${profile.block_note}` : "" });
  }

  const data: ProfileData = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    roleLabel: ucfirst(profile.role),
    roleBadgeClass,
    statusLabel,
    statusClass,
    isStudent,
    isInstructor,
    isAdmin,
    isBlocked,
    isActive,
    initials: initials(profile.name),
    avatarUrl: profile.profile_image ? getAvatarUrl(profile.profile_image) : null,
    joinedShort: formatMonthDayYear(profile.registration_date),
    lastLoginShort: profile.last_login ? fmtDateTime(profile.last_login) : null,
    registrationAt: fmtLongDateTime(profile.registration_date),
    lastLoginAt: profile.last_login ? fmtLongDateTime(profile.last_login) : null,
    blockNote: profile.block_note ?? "",
    blockReason: profile.block_reason ?? "",
    emailVerified: profile.email_verified === true,
    showQuickActions: !isAdmin || profile.id !== admin.id,
    courses,
    enrollments,
    completedCount,
    avgProgress,
    instructorStats: {
      totalStudents: phpNumber(Number(statsRaw.total_students)),
      totalRevenue: formatPrice(Number(statsRaw.total_revenue)),
      totalCourses: String(courses.length),
      totalEnrollments: phpNumber(Number(statsRaw.total_enrollments)),
    },
    activity,
  };

  return <UserDetailClient data={data} csrfToken={csrfToken} />;
}
