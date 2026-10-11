import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { isEnrolled } from "@/lib/db/enrollments";

const schema = z.object({
  course_id: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  review_text: z.string().trim().min(1).max(5000),
});

/** Port of submitReview() in private/functions/student.php (select-then-update/insert). */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });

  const form = await req.formData();
  const csrf = verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""));
  if (!csrf) return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });

  const parsed = schema.safeParse({
    course_id: form.get("course_id"),
    rating: form.get("rating"),
    review_text: form.get("review_text"),
  });
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please choose a rating and write a review." }, { status: 400 });

  const { course_id: courseId, rating, review_text: reviewText } = parsed.data;
  if (!await isEnrolled(user.id, courseId)) {
    return NextResponse.json({ success: false, error: "Only enrolled students can review this course." }, { status: 403 });
  }

  const existing = await sql<{ id: number }[]>`
    SELECT id FROM course_reviews WHERE student_id = ${user.id} AND course_id = ${courseId}
  `;

  if (existing.length) {
    await sql`
      UPDATE course_reviews SET rating = ${rating}, review_text = ${reviewText}, created_at = now()
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO course_reviews (course_id, student_id, rating, review_text)
      VALUES (${courseId}, ${user.id}, ${rating}, ${reviewText})
    `;
  }

  const courses = await sql<{ slug: string }[]>`SELECT slug FROM courses WHERE id = ${courseId}`;
  return NextResponse.json({ success: true, redirect: `/course/${courses[0]?.slug ?? ""}#reviews` });
}
