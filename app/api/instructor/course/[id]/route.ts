import { NextResponse } from "next/server";
import { courseAction, COURSE_ACTIONS, type CourseActionName } from "@/lib/api/instructor/course-actions";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }

  // The button that was pressed decides the action, exactly like the PHP's
  // $_POST['action'] dispatch in courses.php and edit-course.php.
  let action: CourseActionName = "save";
  try {
    const form = await req.clone().formData();
    const posted = String(form.get("action") ?? "");
    if (COURSE_ACTIONS.includes(posted as CourseActionName)) action = posted as CourseActionName;
  } catch {
    action = "save";
  }

  return courseAction(req, courseId, action);
}