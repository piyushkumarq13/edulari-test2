import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { addToCart, enrollStudent, unenrollStudent } from "@/lib/db/enrollments";
import { sql } from "@/lib/db/client";

const bodySchema = z.object({
  course_id: z.coerce.number().int().positive(),
  action: z.enum(["enroll", "unenroll", "add_to_cart"]).default("enroll"),
});

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid course." }, { status: 400 });
  const { course_id: courseId, action } = parsed.data;

  const courses = await sql<{ id: number; slug: string; price: number }[]>`
    SELECT id, slug, price FROM courses WHERE id = ${courseId} AND is_published = true
  `;
  if (!courses.length) return NextResponse.json({ success: false, error: "Course not found." }, { status: 404 });
  const course = courses[0];

  if (action === "unenroll") {
    const result = await unenrollStudent(user.id, courseId);
    if (!result.success) return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    return NextResponse.json({ success: true, redirect: `/course/${course.slug}` });
  }

  if (action === "add_to_cart") {
    const ok = await addToCart(user.id, courseId, user.role === "instructor");
    if (!ok) return NextResponse.json({ success: false, error: "Could not add to cart." }, { status: 400 });
    return NextResponse.json({ success: true, redirect: "/cart" });
  }

  if (course.price > 0) {
    return NextResponse.json({ success: false, error: "This course requires purchase.", redirect: "/cart" }, { status: 400 });
  }

  const result = await enrollStudent(user.id, courseId, user.role === "instructor");
  if (!result.success) return NextResponse.json({ success: false, error: result.message }, { status: 400 });
  return NextResponse.json({ success: true, redirect: `/student/learn?course=${courseId}` });
}
