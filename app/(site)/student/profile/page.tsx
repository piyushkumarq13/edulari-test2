import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getStudentStats } from "@/lib/db/commerce";
import { readCsrfToken } from "@/lib/security/csrf";
import { sql } from "@/lib/db/client";
import {
  EDUCATION_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  SKILL_OPTIONS,
  getStudentProfile,
} from "@/lib/db/learning";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import ProfileClient from "./ProfileClient";
import "@/styles/css/student/profile.css";

export const metadata: Metadata = pageMetadata({
  title: "My Profile – Edulari",
  description: "Your name, education, skills and profile photo.",
  path: "/student/profile",
  noindex: true,
});

/** profile.php's fallback chip list when the categories table is empty. */
const FALLBACK_INTERESTS = ["Web Development", "Data Science", "Design", "Business", "Photography", "Music", "Finance", "Health"];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const tab = ["personal", "education", "interests"].includes(sp.tab ?? "") ? (sp.tab as string) : "personal";
  const flashType = (sp.flash_type ?? "") === "success" ? "success" : (sp.flash_type ?? "") === "error" ? "error" : "";
  const flashMessage = sp.flash_msg ?? "";

  const [stats, profile, categories, csrfToken] = await Promise.all([
    getStudentStats(user.id),
    getStudentProfile(user.id),
    sql<{ id: number; name: string }[]>`SELECT id, name FROM categories ORDER BY name ASC`,
    readCsrfToken(),
  ]);

  const savedSkills = (profile?.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const savedCourses = (profile?.courses_interested ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <ProfileClient
      userName={user.name}
      userEmail={user.email}
      avatarUrl={getAvatarUrl(user.profile_image ?? "")}
      profile={{
        highestEducation: profile?.highest_education ?? "",
        collegeName: profile?.college_name ?? "",
        fieldOfStudy: profile?.field_of_study ?? "",
        learningGoal: profile?.learning_goal ?? "",
        experienceLevel: profile?.experience_level ?? "",
        bio: profile?.bio ?? "",
        phone: profile?.phone ?? "",
      }}
      savedSkills={savedSkills}
      savedCourses={savedCourses}
      skillOptions={SKILL_OPTIONS}
      interestOptions={categories.length > 0 ? categories.map((c) => c.name) : FALLBACK_INTERESTS}
      educationOptions={EDUCATION_OPTIONS}
      goalOptions={GOAL_OPTIONS}
      levelOptions={LEVEL_OPTIONS}
      activeTab={tab}
      csrfToken={csrfToken}
      flashType={flashType}
      flashMessage={flashMessage}
      stats={{
        enrolled: Number(stats.total_courses),
        completed: Number(stats.completed_courses),
        wishlist: Number(stats.wishlist_count),
      }}
    />
  );
}