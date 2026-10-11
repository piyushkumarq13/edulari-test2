import type { Metadata } from "next";
import { sql } from "@/lib/db/client";
import "@/styles/css/instructor/profile.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getInstructorOverviewStats } from "@/lib/db/instructor/analytics";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { formatPrice, phpNumber } from "@/lib/format";
import ProfileClient from "@/components/instructor/ProfileClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "My Profile – Edulari",
  description: "Manage your instructor profile.",
  noindex: true,
  canonical: false,
});

const EDUCATION_OPTIONS: Array<[string, string]> = [
  ["high_school", "High School / 10+2"],
  ["diploma", "Diploma"],
  ["bachelors", "Bachelor's Degree"],
  ["masters", "Master's Degree"],
  ["phd", "PhD / Doctorate"],
  ["other", "Other"],
];

const TEACHING_STYLE_OPTIONS: Array<[string, string]> = [
  ["lecture", "Lecture-Based"],
  ["project", "Project-Based"],
  ["socratic", "Socratic / Discussion"],
  ["blended", "Blended"],
  ["self_paced", "Self-Paced"],
];

const SKILL_LEVEL_OPTIONS: Array<[string, string]> = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
  ["expert", "Expert"],
];

export default async function InstructorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; err?: string }>;
}) {
  const user = await requireInstructorApproved();
  const [sp, csrfToken, stats] = await Promise.all([searchParams, readCsrfToken(), getInstructorOverviewStats(user.id)]);

  const [profileRows, appRows] = await Promise.all([
    sql<Record<string, unknown>[]>`SELECT * FROM instructor_profiles WHERE user_id = ${user.id} LIMIT 1`,
    sql<Record<string, unknown>[]>`SELECT * FROM instructor_applications WHERE user_id = ${user.id} LIMIT 1`,
  ]);
  const profile = (profileRows[0] ?? {}) as Record<string, never>;
  const application = (appRows[0] ?? {}) as Record<string, never>;

  const avatarUrl = getAvatarUrl(user.profile_image ?? "");
  const nameParts = user.name.trim().split(" ");
  const initials = (
    (nameParts[0]?.[0] ?? "") + (nameParts[1]?.[0] ?? "")
  ).toUpperCase();

  const activeTab = sp.tab === "education" || sp.tab === "teaching" ? sp.tab : "personal";
  const totalRevenue = Number(stats.total_revenue);

  return (
    <main className="ipf-main">
      <ProfileClient
        activeTab={activeTab}
        csrfToken={csrfToken}
        initialNotice={sp.ok ? { type: "success", msg: sp.ok } : sp.err ? { type: "error", msg: sp.err } : null}
        user={{
          name: user.name,
          email: user.email,
          phone: "",
          avatarUrl: avatarUrl || null,
          initials,
        }}
        stats={{
          totalCourses: stats.total_courses,
          totalStudents: stats.total_students,
          // PHP read $stats['avg_rating'], which never existed, so the hero always showed 0.0.
          avgRating: phpNumber(stats.avg_course_rating, 1),
          totalRevenue,
          revenueLabel: formatPrice(totalRevenue),
        }}
        profile={{
          headline: String(profile.headline ?? ""),
          bio: String(profile.bio ?? ""),
          website: String(profile.website ?? ""),
          linkedin_url: String(profile.linkedin_url ?? ""),
          twitter_url: String(profile.twitter_url ?? ""),
          years_exp: Number(profile.years_exp ?? 0),
          teaching_style: String(profile.teaching_style ?? ""),
        }}
        application={{
          highest_education: String(application.highest_education ?? ""),
          institution: String(application.institution ?? ""),
          field_of_study: String(application.field_of_study ?? ""),
          graduation_year: application.graduation_year === null || application.graduation_year === undefined
            ? ""
            : String(application.graduation_year),
          certifications: String(application.certifications ?? ""),
          professional_exp: String(application.professional_exp ?? ""),
          notable_works: String(application.notable_works ?? ""),
          primary_subject: String(application.primary_subject ?? ""),
          secondary_subjects: String(application.secondary_subjects ?? ""),
          skill_level: String(application.skill_level ?? ""),
          target_audience: String(application.target_audience ?? ""),
          course_ideas: String(application.course_ideas ?? ""),
        }}
        options={{ education: EDUCATION_OPTIONS, teachingStyle: TEACHING_STYLE_OPTIONS, skillLevel: SKILL_LEVEL_OPTIONS }}
      />
    </main>
  );
}