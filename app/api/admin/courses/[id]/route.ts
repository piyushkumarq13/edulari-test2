import { NextResponse } from "next/server";
import { adminCoursePost } from "@/lib/api/admin/courses";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }
  return adminCoursePost(req, courseId);
}
