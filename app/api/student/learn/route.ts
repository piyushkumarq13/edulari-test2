import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { findEnrollment, getCourseDetail, getLessonForStudent, getQuizQuestions } from "@/lib/db/learning";
import { markLessonComplete } from "@/lib/learning/progress";
import { submitQuizAttempt } from "@/lib/learning/quiz";
import { submitAssignment } from "@/lib/learning/assignments";
import { logDbError } from "@/lib/db/client";

export const maxDuration = 60;

const baseSchema = z.object({
  action: z.enum(["mark_complete", "submit_quiz", "submit_assignment", "generate_certificate"]),
  course_id: z.coerce.number().int().positive(),
  lesson_id: z.coerce.number().int().nonnegative().optional(),
  time_spent: z.coerce.number().int().min(0).max(60 * 60 * 24).optional(),
});

const markCompleteSchema = baseSchema.extend({ action: z.literal("mark_complete"), lesson_id: z.coerce.number().int().positive() });

const quizSchema = baseSchema.extend({
  action: z.literal("submit_quiz"),
  lesson_id: z.coerce.number().int().positive(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

const assignmentSchema = baseSchema.extend({
  action: z.literal("submit_assignment"),
  lesson_id: z.coerce.number().int().positive(),
  submission_text: z.string().trim().min(10, "Please write at least 10 characters.").max(20000),
});

const certificateSchema = baseSchema.extend({ action: z.literal("generate_certificate") });

/** Post/Redirect/Get helper: 303 so the browser follows with GET. */
function redirectTo(path: string, extra: Record<string, string> = {}) {
  const url = new URL(path, process.env.NEXT_PUBLIC_SITE_URL ?? "https://edulari-test.vercel.app");
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

async function readForm(req: Request): Promise<FormData> {
  return req.formData();
}

/**
 * `answers[12]=4` is how a browser encodes the quiz radio group. Flatten it back into the
 * record submitQuizAttempt() expects; an unparseable key is simply ignored.
 */
export function extractAnswers(fields: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fields.entries()) {
    const m = /^answers\[([^\]]+)\]$/.exec(key);
    if (!m) continue;
    out[m[1]] = String(value);
  }
  return out;
}

/**
 * The four POST targets of learn.php. learn.php itself verified the CSRF token and then
 * redirected; the port splits the handler out so the App Router can answer with 303.
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 403 });
  }

  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  const fields = await readForm(req);

  const csrfOk = verifyCsrfToken(await readCsrfToken(), String(fields.get("csrf_token") ?? ""));
  if (!csrfOk) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 403 });
  }

  const action = String(fields.get("action") ?? "");
  const courseId = Number(fields.get("course_id") ?? 0);

  // Enrollment is re-checked for every action, exactly like getLessonForStudent().
  const enrollment = await findEnrollment(user.id, courseId);
  if (!enrollment) return redirectTo("/browse-courses");

  const course = await getCourseDetail(courseId);

  if (action === "generate_certificate") {
    const parsed = certificateSchema.safeParse({ action, course_id: courseId });
    if (!parsed.success) return redirectTo("/student/my-courses");
    return redirectTo("/student/generate-certificate", { course: String(courseId) });
  }

  if (action === "mark_complete") {
    const parsed = markCompleteSchema.safeParse({
      action,
      course_id: courseId,
      lesson_id: fields.get("lesson_id"),
      time_spent: fields.get("time_spent") ?? 0,
    });
    if (!parsed.success) return redirectTo(`/student/learn?course=${courseId}`);

    const lesson = await getLessonForStudent(parsed.data.lesson_id, courseId, user.id);
    if (!lesson) return redirectTo(`/student/learn?course=${courseId}`);

    await markLessonComplete(Number(enrollment.id), parsed.data.lesson_id, parsed.data.time_spent ?? 0);

    if (lesson.navigation.next) {
      return redirectTo("/student/learn", { course: String(courseId), lesson: String(lesson.navigation.next.id) });
    }
    return redirectTo("/student/learn", { course: String(courseId), lesson: String(parsed.data.lesson_id), completed: "1" });
  }

  if (action === "submit_quiz") {
    const parsed = quizSchema.safeParse({
      action,
      course_id: courseId,
      lesson_id: fields.get("lesson_id"),
      answers: extractAnswers(fields),
    });
    if (!parsed.success) return redirectTo(`/student/learn?course=${courseId}`);

    const lesson = await getLessonForStudent(parsed.data.lesson_id, courseId, user.id);
    if (!lesson || lesson.content_type !== "quiz") {
      return redirectTo(`/student/learn?course=${courseId}&lesson=${parsed.data.lesson_id}`);
    }

    // Only accept option ids / true|false that actually belong to this lesson's questions.
    const questions = await getQuizQuestions(parsed.data.lesson_id);
    const allowed = new Map<string, Set<string> | "tf">();
    for (const q of questions) {
      if (q.question_type === "multiple_choice") {
        allowed.set(String(q.id), new Set(q.options.map((o) => String(o.id))));
      } else {
        allowed.set(String(q.id), "tf");
      }
    }

    const cleanAnswers: Record<string, string> = {};
    for (const [questionId, rawValue] of Object.entries(parsed.data.answers)) {
      const rule = allowed.get(questionId);
      if (!rule) continue;
      const value = String(rawValue);
      if (rule === "tf") {
        if (value === "true" || value === "false") cleanAnswers[questionId] = value;
      } else if (rule.has(value)) {
        cleanAnswers[questionId] = value;
      }
    }

    const result = await submitQuizAttempt(Number(enrollment.id), parsed.data.lesson_id, cleanAnswers);
    return redirectTo("/student/learn", {
      course: String(courseId),
      lesson: String(parsed.data.lesson_id),
      attempt: String(result.attempt_id),
    });
  }

  if (action === "submit_assignment") {
    const parsed = assignmentSchema.safeParse({
      action,
      course_id: courseId,
      lesson_id: fields.get("lesson_id"),
      submission_text: fields.get("submission_text") ?? "",
    });
    if (!parsed.success) {
      return redirectTo(`/student/learn?course=${courseId}&lesson=${fields.get("lesson_id") ?? ""}`);
    }

    const lesson = await getLessonForStudent(parsed.data.lesson_id, courseId, user.id);
    if (!lesson || lesson.content_type !== "assignment") {
      return redirectTo(`/student/learn?course=${courseId}`);
    }

    const file = fields.get("assignment_file");
    let attachment: { buffer: Buffer; originalName: string } | null = null;
    if (file instanceof File && file.size > 0) {
      attachment = { buffer: Buffer.from(await file.arrayBuffer()), originalName: file.name };
    }

    try {
      await submitAssignment(Number(enrollment.id), parsed.data.lesson_id, user.id, {
        submissionText: parsed.data.submission_text,
        attachment,
      });
    } catch (err) {
      logDbError("submit_assignment", err);
    }

    return redirectTo("/student/learn", {
      course: String(courseId),
      lesson: String(parsed.data.lesson_id),
      msg: "assignment_submitted",
    });
  }

  void course;
  return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
}