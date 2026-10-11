import { NextResponse } from "next/server";
import { z } from "zod";
import { getApprovedInstructorFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";
import { getCourseById } from "@/lib/db/instructor/courses";
import { createSection, deleteSection } from "@/lib/db/instructor/sections";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  normaliseVideoUrl,
  nextLessonOrder,
  getLessonById,
} from "@/lib/db/instructor/lessons";
import { replaceQuizQuestions } from "@/lib/db/instructor/quizzes";
import { parseQuizQuestions, QuizValidationError } from "@/lib/api/instructor/parse-quiz";
import { createAssignment, deleteAssignmentByLesson, getAssignmentByLesson, updateAssignment } from "@/lib/db/instructor/assignments";
import { scanUploadFile } from "@/lib/storage/upload-validation";
import { deleteObject, putObject } from "@/lib/storage/b2";
import { revalidatePublicCoursePages } from "@/lib/revalidate";

export const runtime = "nodejs";

/** uploadLessonPDF()'s extension allow-list and the MIME types each may arrive as. */
const LESSON_FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  txt: ["text/plain"],
  zip: ["application/zip"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mp3: ["audio/mpeg"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  webp: ["image/webp"],
};
const ALLOWED_LESSON_MIMES = Array.from(new Set(Object.values(LESSON_FILE_TYPES).flat()));
const MAX_LESSON_BYTES = 50 * 1024 * 1024;

const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "1" || v === "on");

const lessonSchema = z.object({
  lesson_title: z.string().trim().min(1, "Lesson title is required."),
  content_type: z.string().trim().min(1, "Please select a content type."),
  content_text: z.string().trim().optional().default(""),
  video_url: z.string().trim().optional().default(""),
  video_duration: z.coerce.number().int().min(0).catch(0),
  is_free_preview: checkbox,
});

/**
 * POST /api/instructor/course/[id]/content — every course-content.php write:
 * add_section, add_lesson, edit_lesson, delete_section, delete_lesson.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getApprovedInstructorFromRequest();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  if (!originMatchesHost(req.headers.get("origin"), req.headers.get("host"))) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const courseId = Number(id);
  const course = Number.isFinite(courseId) && courseId > 0 ? await getCourseById(courseId, user.id) : null;
  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found or access denied." }, { status: 404 });
  }

  const form = await req.formData();
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  if (!verifyCsrfToken(await readCsrfToken(), fields.csrf_token)) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." }, { status: 403 });
  }

  const redirect = (msg: string) =>
    `/instructor/course-content?id=${courseId}&msg=${encodeURIComponent(msg)}`;

  if (fields.add_section !== undefined) {
    const title = (fields.section_title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "" });
    const { getCourseSections } = await import("@/lib/db/instructor/sections");
    const existing = await getCourseSections(courseId);
    const created = await createSection(courseId, title, "", existing.length);
    if (!created) return NextResponse.json({ ok: false, error: "Failed to add section." });
    return NextResponse.json({ ok: true, redirect: redirect("Section added successfully.") });
  }

  if (fields.delete_section !== undefined) {
    const sectionId = Number(fields.section_id_delete ?? 0);
    if (sectionId > 0 && (await deleteSection(sectionId, courseId))) {
      return NextResponse.json({ ok: true, redirect: redirect("Section deleted successfully.") });
    }
    return NextResponse.json({ ok: false, error: "Failed to delete section." });
  }

  if (fields.delete_lesson !== undefined) {
    const lessonId = Number(fields.lesson_id_delete ?? 0);
    if (lessonId > 0 && (await deleteLesson(lessonId, courseId))) {
      return NextResponse.json({ ok: true, redirect: redirect("Lesson deleted successfully.") });
    }
    return NextResponse.json({ ok: false, error: "Failed to delete lesson." });
  }

  const isEdit = fields.edit_lesson !== undefined;
  const p = lessonSchema.safeParse(fields);
  if (!p.success) {
    return NextResponse.json({ ok: false, error: p.error.issues[0]?.message ?? "Invalid request." });
  }

  let quizQuestions: ReturnType<typeof parseQuizQuestions>;
  try {
    quizQuestions = parseQuizQuestions(form);
  } catch (err) {
    if (err instanceof QuizValidationError) {
      return NextResponse.json({ ok: false, error: err.message });
    }
    throw err;
  }

  if (isEdit) {
    const lessonId = Number(fields.lesson_id ?? 0);
    const old = lessonId > 0 ? await getLessonById(lessonId, courseId) : null;
    if (!old) return NextResponse.json({ ok: false, error: "Lesson not found." });

    const patch: Record<string, unknown> = {
      title: p.data.lesson_title,
      content_type: p.data.content_type,
      content_text: p.data.content_text,
      video_url: normaliseVideoUrl(p.data.video_url),
      video_duration: p.data.video_duration,
      is_free_preview: p.data.is_free_preview,
    };
    const newSectionId = Number(fields.section_id ?? 0);
    if (newSectionId > 0 && newSectionId !== Number(old.section_id)) patch.section_id = newSectionId;

    const updated = await updateLesson(lessonId, courseId, patch);
    if (!updated) return NextResponse.json({ ok: false, error: "Failed to update lesson." });

    const uploadErr = await storeLessonFile(form, lessonId, p.data.content_type);
    if (uploadErr) return NextResponse.json({ ok: false, error: uploadErr });

    // The PHP replaced every question on each save, so do the same.
    if (p.data.content_type === "quiz") {
      await replaceQuizQuestions(lessonId, quizQuestions);
    } else if (old.content_type === "quiz") {
      // Switching a lesson away from quiz leaves questions the student can still be graded on.
      await replaceQuizQuestions(lessonId, []);
    }
    if (p.data.content_type === "assignment") {
      await upsertAssignment(lessonId, fields);
    } else if (old.content_type === "assignment") {
      await deleteAssignmentByLesson(lessonId);
    }

    await revalidatePublicCoursePages(course.slug);
    return NextResponse.json({ ok: true, redirect: redirect("Lesson updated successfully.") });
  }

  // add_lesson
  const sectionId = Number(fields.section_id ?? 0);
  if (!(sectionId > 0)) return NextResponse.json({ ok: false, error: "Please select a section." });
  const order = await nextLessonOrder(sectionId, courseId);

  const lessonId = await createLesson({
    section_id: sectionId,
    course_id: courseId,
    title: p.data.lesson_title,
    content_type: p.data.content_type,
    content_text: p.data.content_text,
    video_url: normaliseVideoUrl(p.data.video_url),
    video_duration: p.data.video_duration,
    is_free_preview: p.data.is_free_preview,
    sort_order: order,
  });
  if (!lessonId) return NextResponse.json({ ok: false, error: "Failed to add lesson." });

  const uploadErr = await storeLessonFile(form, lessonId, p.data.content_type);
  if (uploadErr) return NextResponse.json({ ok: false, error: uploadErr });

  if (p.data.content_type === "quiz" && quizQuestions.length > 0) {
    await replaceQuizQuestions(lessonId, quizQuestions);
  }
  if (p.data.content_type === "assignment") {
    await upsertAssignment(lessonId, fields);
  }

  await revalidatePublicCoursePages(course.slug);
  return NextResponse.json({ ok: true, redirect: redirect("Lesson added successfully.") });
}

async function upsertAssignment(lessonId: number, fields: Record<string, string>): Promise<void> {
  const data = {
    instructions: (fields.assignment_instructions ?? "").trim(),
    max_marks: Number(fields.max_marks ?? 100),
    passing_marks: Number(fields.passing_marks ?? 40),
    due_days: Number(fields.due_days ?? 7),
    allow_late_submission: fields.allow_late_submission === "1" || fields.allow_late_submission === "on" ? 1 : 0,
  };
  const existing = await getAssignmentByLesson(lessonId);
  if (existing) await updateAssignment(existing.id, data);
  else await createAssignment({ lesson_id: lessonId, ...data });
}

/** uploadLessonPDF(): full allow-list + magic-byte scan, B2 storage, old key deleted. */
async function storeLessonFile(form: FormData, lessonId: number, contentType: string): Promise<string | null> {
  if (contentType !== "pdf") return null;
  const file = form.get("pdf_file");
  if (!(file instanceof File) || file.size === 0) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUploadFile(buffer, ALLOWED_LESSON_MIMES, "lesson_file", MAX_LESSON_BYTES);
  if (!scan.safe) return scan.message;

  const name = (file.name || "lesson").toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = (dot === -1 ? "bin" : name.slice(dot + 1)).replace(/[^a-z0-9]/g, "") || "bin";
  const key = `lessons/lesson_${lessonId}_${Math.floor(Date.now() / 1000)}.${ext}`;

  const old = await getLessonById(lessonId);
  if (old?.pdf_file) await deleteObject(old.pdf_file);

  try {
    await putObject(key, buffer, scan.mime);
  } catch {
    return "Upload failed.";
  }
  await updateLesson(lessonId, Number(old?.course_id ?? 0), { pdf_file: key });
  return null;
}