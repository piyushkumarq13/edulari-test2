import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { logDbError } from "@/lib/db/client";


const EDUCATION = ["high_school", "diploma", "bachelors", "masters", "phd", "other"];
const GOALS = ["career_change", "skill_upgrade", "personal_interest", "academic", "other"];
const LEVELS = ["beginner", "intermediate", "advanced"];

const schema = z.object({
  highest_education: z.enum(EDUCATION).optional(),
  college_name: z.string().trim().max(255).optional(),
  field_of_study: z.string().trim().max(255).optional(),
  learning_goal: z.enum(GOALS).optional(),
  experience_level: z.enum(LEVELS).optional(),
  bio: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  skills: z.array(z.string().trim().max(100)).max(100).default([]),
  custom_skill: z.string().trim().max(100).optional(),
  courses_interested: z.array(z.string().trim().max(100)).max(100).default([]),
  custom_course: z.string().trim().max(100).optional(),
});

function csv(list: string[], custom?: string): string {
  const all = [...list];
  if (custom) all.push(custom);
  return all.map((v) => v.trim()).filter(Boolean).join(",").slice(0, 1000);
}

/** onboarding.php's POST handler: upsert student_profiles, then flag the user. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ success: false, message: "Invalid request. Please refresh and try again." }, { status: 403 });
  }
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, message: "Invalid request. Please refresh and try again." }, { status: 403 });
  }

  const parsed = schema.safeParse({
    highest_education: form.get("highest_education") ?? undefined,
    college_name: form.get("college_name") ?? undefined,
    field_of_study: form.get("field_of_study") ?? undefined,
    learning_goal: form.get("learning_goal") ?? undefined,
    experience_level: form.get("experience_level") ?? undefined,
    bio: form.get("bio") ?? undefined,
    phone: form.get("phone") ?? undefined,
    skills: form.getAll("skills[]").map(String),
    custom_skill: form.get("custom_skill") ?? undefined,
    courses_interested: form.getAll("courses_interested[]").map(String),
    custom_course: form.get("custom_course") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request. Please refresh and try again." }, { status: 400 });
  }

  const d = parsed.data;
  const education = d.highest_education ?? null;
  const college = d.college_name ?? "";
  const field = d.field_of_study ?? "";
  const goal = d.learning_goal ?? null;
  const expLevel = d.experience_level ?? null;
  const skills = csv(d.skills, d.custom_skill);
  const coursesInterested = csv(d.courses_interested, d.custom_course);
  const bio = d.bio ?? "";
  const phone = d.phone ?? "";

  try {
    const existing = await sql<{ id: number }[]>`SELECT id FROM student_profiles WHERE user_id = ${user.id}`;
    if (existing.length) {
      await sql`
        UPDATE student_profiles
        SET highest_education = ${education}, college_name = ${college}, field_of_study = ${field},
            learning_goal = ${goal}, experience_level = ${expLevel}, skills = ${skills},
            courses_interested = ${coursesInterested}, bio = ${bio}, phone = ${phone}
        WHERE user_id = ${user.id}
      `;
    } else {
      await sql`
        INSERT INTO student_profiles
          (user_id, highest_education, college_name, field_of_study,
           learning_goal, experience_level, skills, courses_interested, bio, phone)
        VALUES (${user.id}, ${education}, ${college}, ${field}, ${goal}, ${expLevel},
                ${skills}, ${coursesInterested}, ${bio}, ${phone})
      `;
    }
    await sql`UPDATE users SET profile_completed = true WHERE id = ${user.id}`;
  } catch (err) {
    logDbError("onboarding", err);
    return NextResponse.json({ success: false, message: "Could not save your profile. Please try again." }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/student/dashboard?onboarded=1", req.url), { status: 303 });
}