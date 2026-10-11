import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getCourseLessonsForStudent } from "@/lib/db/learning";
import {
  addPlan,
  clampDuration,
  deletePlan,
  normalizePlannedTime,
  toggleDone,
  updatePlan,
} from "@/lib/db/study-plan";


const planFields = z.object({
  course_id: z.coerce.number().int().positive(),
  lesson_id: z.coerce.number().int().positive().optional(),
  planned_date: z.string().trim().max(10),
  planned_time: z.string().trim().max(8).optional(),
  duration_min: z.coerce.number().int().optional(),
  note: z.string().trim().max(255).optional(),
});

/** GET get_lessons — enrollment-gated lesson list for the plan modal. */
export async function GET(req: Request) {
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Unauthorized" });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "";
  if (action !== "get_lessons") {
    return NextResponse.json({ success: false, message: "Unknown action." });
  }

  const courseId = Number.parseInt(searchParams.get("course_id") ?? "0", 10);
  if (!courseId || !Number.isFinite(courseId)) {
    return NextResponse.json({ lessons: [] });
  }

  // getCourseLessonsForStudent() returns [] when the student is not enrolled.
  const lessons = await getCourseLessonsForStudent(courseId, user.id);
  return NextResponse.json({ lessons });
}

/**
 * The four POST actions of schedule-api.php.
 *
 * The PHP endpoint had NO CSRF check at all; AGENTS.md S6 requires one, so the token and
 * the Origin/Host pair are verified here (docs/analysis/phase6.md section 3).
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 403 });
  }
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Unauthorized" });
  }

  const form = await req.formData();
  const action = String(form.get("action") ?? "");

  if (action !== "add_plan" && action !== "update_plan" && action !== "delete_plan" && action !== "toggle_done") {
    return NextResponse.json({ success: false, message: "Unknown action." });
  }

  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 403 });
  }

  if (action === "delete_plan") {
    const planId = Number.parseInt(String(form.get("plan_id") ?? "0"), 10);
    return NextResponse.json(await deletePlan(Number.isFinite(planId) ? planId : 0, user.id));
  }

  if (action === "toggle_done") {
    const planId = Number.parseInt(String(form.get("plan_id") ?? "0"), 10);
    return NextResponse.json(await toggleDone(Number.isFinite(planId) ? planId : 0, user.id));
  }

  const parsed = planFields.safeParse({
    course_id: form.get("course_id"),
    lesson_id: form.get("lesson_id") || undefined,
    planned_date: form.get("planned_date"),
    planned_time: form.get("planned_time") || undefined,
    duration_min: form.get("duration_min") || undefined,
    note: form.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Course and date are required." });
  }

  const courseId = parsed.data.course_id;
  const lessonId = parsed.data.lesson_id ?? null;
  const plannedDate = parsed.data.planned_date;
  const plannedTime = normalizePlannedTime(parsed.data.planned_time);
  const durationMin = clampDuration(parsed.data.duration_min ?? 0);
  const note = parsed.data.note && parsed.data.note !== "" ? parsed.data.note : null;

  if (!courseId || !plannedDate) {
    return NextResponse.json({ success: false, message: "Course and date are required." });
  }

  if (action === "add_plan") {
    return NextResponse.json(
      await addPlan({ studentId: user.id, courseId, lessonId, plannedDate, plannedTime, durationMin, note }),
    );
  }

  const planId = Number.parseInt(String(form.get("plan_id") ?? "0"), 10);
  return NextResponse.json(
    await updatePlan({
      studentId: user.id,
      planId: Number.isFinite(planId) ? planId : 0,
      courseId,
      lessonId,
      plannedDate,
      plannedTime,
      durationMin,
      note,
    }),
  );
}