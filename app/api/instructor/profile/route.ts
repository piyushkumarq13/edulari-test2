import { NextResponse } from "next/server";
import { z } from "zod";
import { sql, withTransaction } from "@/lib/db/client";
import { getApprovedInstructorFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";
import { scanUploadFile } from "@/lib/storage/upload-validation";
import { deleteObject, putObject } from "@/lib/storage/b2";
import { revalidateInstructorProfile } from "@/lib/revalidate";

export const runtime = "nodejs";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AVATAR_MAX = 2 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const bio = z.string().trim().max(1500, "Bio cannot exceed 1 500 characters.");

/**
 * profile.php's four POST actions. Each one ends in a redirect to profile?tab=..., so the
 * flash state is carried in the query string rather than a session slot.
 */
export async function POST(req: Request) {
  const user = await getApprovedInstructorFromRequest();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  if (!originMatchesHost(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ redirect: "/instructor/profile?err=Invalid%20request.%20Please%20refresh%20and%20try%20again." });
  }

  const action = String(form.get("action") ?? "");
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const fail = (msg: string) => NextResponse.json({ ok: false, error: msg });

  if (action === "save_personal") {
    const bioValue = str("bio");
    const parsed = bio.safeParse(bioValue);
    if (!parsed.success) return fail("Bio cannot exceed 1 500 characters.");

    const yearsExp = Math.max(0, Number(str("years_exp")) || 0);
    const headline = str("headline");
    const website = str("website");
    const linkedin = str("linkedin_url");
    const twitter = str("twitter_url");
    const style = str("teaching_style");

    // The PHP ran `UPDATE users SET phone = ?`, but no users/instructor table has a phone
    // column (phone exists only on student_profiles), so that statement was dead code and the
    // submitted value was silently discarded. It is intentionally not persisted here either,
    // rather than inventing a column the schema does not define.
    await withTransaction(async (tx) => {
      const existing = await tx<{ id: number }[]>`
        SELECT id FROM instructor_profiles WHERE user_id = ${user.id} LIMIT 1`;
      if (existing.length > 0) {
        await tx`
          UPDATE instructor_profiles
          SET headline = ${headline}, bio = ${bioValue}, website = ${website},
              linkedin_url = ${linkedin}, twitter_url = ${twitter},
              years_exp = ${yearsExp}, teaching_style = ${style}, updated_at = now()
          WHERE user_id = ${user.id}`;
      } else {
        await tx`
          INSERT INTO instructor_profiles
            (user_id, headline, bio, website, linkedin_url, twitter_url, years_exp, teaching_style, created_at, updated_at)
          VALUES (${user.id}, ${headline}, ${bioValue}, ${website}, ${linkedin}, ${twitter}, ${yearsExp}, ${style}, now(), now())`;
      }
    });

    await revalidateInstructorProfile(user.id);
    return NextResponse.json({
      ok: true,
      redirect: "/instructor/profile?tab=personal&ok=Personal%20details%20updated%20successfully!",
    });
  }

  if (action === "save_education") {
    const gradYear = str("graduation_year");
    await sql`
      UPDATE instructor_applications
      SET highest_education = ${str("highest_education")},
          institution = ${str("institution")},
          field_of_study = ${str("field_of_study")},
          graduation_year = ${gradYear ? Number(gradYear) : null},
          certifications = ${str("certifications")},
          professional_exp = ${str("professional_exp")},
          notable_works = ${str("notable_works")},
          updated_at = now()
      WHERE user_id = ${user.id}`;
    await revalidateInstructorProfile(user.id);
    return NextResponse.json({
      ok: true,
      redirect: "/instructor/profile?tab=education&ok=Education%20%26%20credentials%20updated%20successfully!",
    });
  }

  if (action === "save_teaching") {
    await sql`
      UPDATE instructor_applications
      SET primary_subject = ${str("primary_subject")},
          secondary_subjects = ${str("secondary_subjects")},
          skill_level = ${str("skill_level")},
          target_audience = ${str("target_audience")},
          course_ideas = ${str("course_ideas")},
          updated_at = now()
      WHERE user_id = ${user.id}`;
    await revalidateInstructorProfile(user.id);
    return NextResponse.json({
      ok: true,
      redirect: "/instructor/profile?tab=teaching&ok=Teaching%20details%20updated%20successfully!",
    });
  }

  if (action === "remove_avatar") {
    const rows = await sql<{ profile_image: string | null }[]>`
      SELECT profile_image FROM users WHERE id = ${user.id}`;
    const oldKey = rows[0]?.profile_image ?? "";
    if (oldKey && !oldKey.startsWith("/")) await deleteObject(oldKey);
    await sql`UPDATE users SET profile_image = NULL WHERE id = ${user.id}`;
    await revalidateInstructorProfile(user.id);
    return NextResponse.json({
      ok: true,
      redirect: "/instructor/profile?tab=personal&ok=Profile%20picture%20removed.",
    });
  }

  if (action === "upload_avatar") {
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) return fail("No image file selected.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const scan = scanUploadFile(buffer, AVATAR_TYPES, "instructor_avatar", AVATAR_MAX);
    if (!scan.safe) return fail(scan.message);

    const ext = EXT_BY_MIME[scan.mime] ?? "jpg";
    const key = `avatars/inst_${user.id}_${Math.floor(Date.now() / 1000)}.${ext}`;

    const rows = await sql<{ profile_image: string | null }[]>`
      SELECT profile_image FROM users WHERE id = ${user.id}`;
    const oldKey = rows[0]?.profile_image ?? "";
    if (oldKey && !oldKey.startsWith("/")) await deleteObject(oldKey);

    try {
      await putObject(key, buffer, scan.mime);
    } catch {
      return NextResponse.json({
        redirect: "/instructor/profile?tab=personal&err=Failed%20to%20upload%20image.%20Please%20try%20again.",
      });
    }
    await sql`UPDATE users SET profile_image = ${key} WHERE id = ${user.id}`;
    await revalidateInstructorProfile(user.id);
    return NextResponse.json({
      ok: true,
      redirect: "/instructor/profile?tab=personal&ok=Profile%20picture%20updated!",
    });
  }

  return fail("Unknown action.");
}