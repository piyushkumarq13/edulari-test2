import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { sql } from "@/lib/db/client";
import { EDUCATION_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, SKILL_OPTIONS } from "@/lib/db/learning";
import OnboardingClient from "./OnboardingClient";
import "@/styles/css/auth/onboarding.css";

export const metadata: Metadata = pageMetadata({
  title: "Complete Your Profile – Edulari",
  description: "Answer five quick questions so Edulari can personalise your learning path.",
  path: "/student/onboarding",
  noindex: true,
});

/** onboarding.php's fallback chip list when the categories table is empty. */
const FALLBACK_INTERESTS = ["Web Development", "Data Science", "Design", "Business", "Photography", "Music", "Finance", "Health"];

export default async function OnboardingPage() {
  const user = await requireRole("student");

  const users = await sql<{ profile_completed: boolean }[]>`
    SELECT profile_completed FROM users WHERE id = ${user.id}
  `;
  if (users[0]?.profile_completed) redirect("/student/dashboard");

  const categories = await sql<{ id: number; name: string }[]>`SELECT id, name FROM categories ORDER BY name ASC`;
  const interestOptions = categories.length > 0 ? categories.map((c) => c.name) : FALLBACK_INTERESTS;

  const csrfToken = await readCsrfToken();

  return (
    <OnboardingClient
      csrfToken={csrfToken}
      skillOptions={SKILL_OPTIONS}
      interestOptions={interestOptions}
      educationOptions={EDUCATION_OPTIONS}
      goalOptions={GOAL_OPTIONS}
      levelOptions={LEVEL_OPTIONS}
    />
  );
}