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
  name: z.string().trim().min(1, "Name cannot be empty.").max(100),
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
  _tab: z.enum(["personal", "education", "interests"]).default("personal"),
});

function csv(list: string[], custom?: string): string {
  const all = [...list];
  if (custom) all.push(custom);
  return all.map((v) => v.trim()).filter(Boolean).join(",").slice(0, 1000);
}

function redirectTo(req: Request, path: string, params: Record<string, string> = {}): NextResponse {
  const url = new URL(path, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

/** profile.php's save_profile action. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) {
    return redirectTo(req, "/student/profile", { flash_type: "error", flash_msg: "Invalid request. Please refresh and try again." });
  }
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return redirectTo(req, "/student/profile", { flash_type: "error", flash_msg: "Invalid request. Please refresh and try again." });
  }

  const parsed = schema.safeParse({
    name: form.get("name") ?? "",
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
    _tab: form.get("_tab") ?? "personal",
  });

  if (!parsed.success) {
    return redirectTo(req, "/student/profile", {
      flash_type: "error",
      flash_msg: "Name cannot be empty.",
    });
  }

  const d = parsed.data;
  const tab = d._tab;

  try {
    await sql`UPDATE users SET name = ${d.name} WHERE id = ${user.id}`;

    const existing = await sql<{ id: number }[]>`SELECT id FROM student_profiles WHERE user_id = ${user.id}`;
    const values = [
      d.highest_education ?? null,
      d.college_name ?? "",
      d.field_of_study ?? "",
      d.learning_goal ?? null,
      d.experience_level ?? null,
      csv(d.skills, d.custom_skill),
      csv(d.courses_interested, d.custom_course),
      d.bio ?? "",
      d.phone ?? "",
    ];

    if (existing.length) {
      await sql`
        UPDATE student_profiles
        SET highest_education = ${values[0]}, college_name = ${values[1]}, field_of_study = ${values[2]},
            learning_goal = ${values[3]}, experience_level = ${values[4]}, skills = ${values[5]},
            courses_interested = ${values[6]}, bio = ${values[7]}, phone = ${values[8]}
        WHERE user_id = ${user.id}
      `;
    } else {
      await sql`
        INSERT INTO student_profiles
          (user_id, highest_education, college_name, field_of_study,
           learning_goal, experience_level, skills, courses_interested, bio, phone)
        VALUES (${user.id}, ${values[0]}, ${values[1]}, ${values[2]}, ${values[3]},
                ${values[4]}, ${values[5]}, ${values[6]}, ${values[7]}, ${values[8]})
      `;
      await sql`UPDATE users SET profile_completed = true WHERE id = ${user.id}`;
    }
  } catch (err) {
    logDbError("profile.save", err);
    return redirectTo(req, "/student/profile", {
      tab,
      flash_type: "error",
      flash_msg: "Could not save your profile. Please try again.",
    });
  }

  return redirectTo(req, "/student/profile", { tab, flash_type: "success", flash_msg: "Profile updated successfully!" });
}