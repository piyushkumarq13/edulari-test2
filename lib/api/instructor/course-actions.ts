import { NextResponse } from "next/server";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/sessions";
import { getApprovedInstructorFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";
import {
  createCourse,
  updateCourse,
  toggleCoursePublish,
  deleteCourse,
  getCourseById,
} from "@/lib/db/instructor/courses";
import { scanUploadFile } from "@/lib/storage/upload-validation";
import { deleteObject, putObject } from "@/lib/storage/b2";
import { revalidatePublicCoursePages } from "@/lib/revalidate";

/**
 * The instructor course write actions from create-course.php, edit-course.php and courses.php,
 * kept out of the route files so both routes share one implementation.
 */

/** Same validation the PHP applied, in the order it checked them. */
const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "1" || v === "on");

export const courseSchema = z.object({
  title: z.string().trim().min(1, "Course title is required.").max(150),
  short_description: z.string().trim().min(1, "Short description is required.").max(250),
  description: z.string().trim().default(""),
  category_id: z.string().trim().min(1, "Please select a category."),
  level: z.string().trim().min(1, "Please select a course level."),
  language: z.string().trim().default("English"),
  duration_hours: z.coerce.number().int().min(0).catch(0),
  price: z.coerce.number().min(0).catch(0),
  certificate_enabled: checkbox,
  passing_percentage: z.coerce.number().int().min(0).max(100).catch(70),
});

const THUMB_ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const THUMB_MAX = 2 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type FormFields = Record<string, string>;

async function readBody(req: Request): Promise<{ fields: FormFields; files: FormData }> {
  const form = await req.formData();
  const fields: FormFields = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  return { fields, files: form };
}

/** Validate session, instructor role, approval and same-origin; returns the user or a 403. */
async function authorize(
  req: Request,
): Promise<{ user: SessionUser; denied: null } | { user: null; denied: NextResponse }> {
  const user = await getApprovedInstructorFromRequest();
  if (!user) {
    return { user: null, denied: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  }
  if (!originMatchesHost(req.headers.get("origin"), req.headers.get("host"))) {
    return { user: null, denied: NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 }) };
  }
  return { user, denied: null };
}

/** POST /api/instructor/course — create a course (create-course.php). */
export async function createCourseAction(req: Request) {
  const { user, denied } = await authorize(req);
  if (denied) return denied;

  const { fields, files } = await readBody(req);
  if (!verifyCsrfToken(await readCsrfToken(), fields.csrf_token)) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." }, { status: 403 });
  }

  const p = courseSchema.safeParse(fields);
  if (!p.success) {
    return NextResponse.json({ ok: false, error: p.error.issues[0]?.message ?? "Invalid request." });
  }

  const courseId = await createCourse({
    instructor_id: user.id,
    category_id: Number(p.data.category_id),
    title: p.data.title,
    description: p.data.description,
    short_description: p.data.short_description,
    level: p.data.level,
    language: p.data.language,
    duration_hours: p.data.duration_hours,
    price: p.data.price,
    certificate_enabled: p.data.certificate_enabled,
    passing_percentage: p.data.passing_percentage,
  });
  if (!courseId) {
    return NextResponse.json({ ok: false, error: "Failed to create course. Please try again." });
  }

  const file = files.get("thumbnail");
  if (file instanceof File && file.size > 0) {
    const err = await storeThumbnail(file, courseId);
    if (err) return NextResponse.json({ ok: false, error: err });
  }

  return NextResponse.json({ ok: true, redirect: `/instructor/course-content?id=${courseId}&created=1` });
}

export type CourseActionName = "save" | "remove_thumbnail" | "publish" | "unpublish" | "delete";

export const COURSE_ACTIONS: CourseActionName[] = ["save", "remove_thumbnail", "publish", "unpublish", "delete"];

/** POST /api/instructor/course/[id] — save, remove_thumbnail, publish, unpublish, delete. */
export async function courseAction(req: Request, courseId: number, action: CourseActionName) {
  const { user, denied } = await authorize(req);
  if (denied) return denied;

  const course = await getCourseById(courseId, user.id);
  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found or access denied." });
  }

  const { fields, files } = await readBody(req);

  if (action !== "save" && !verifyCsrfToken(await readCsrfToken(), fields.csrf_token)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 });
  }

  if (action === "remove_thumbnail") {
    if (!course.thumbnail) {
      return NextResponse.json({ ok: false, error: "Failed to remove thumbnail." });
    }
    await deleteObject(course.thumbnail);
    await updateCourse(courseId, { thumbnail: null }, user.id);
    await revalidatePublicCoursePages(course.slug);
    return NextResponse.json({
      ok: true,
      redirect: `/instructor/edit-course?id=${courseId}&success=Thumbnail%20removed%20successfully.`,
    });
  }

  if (action === "publish" || action === "unpublish") {
    const publish = action === "publish";
    const done = await toggleCoursePublish(courseId, user.id, publish);
    if (!done) {
      return NextResponse.json({ ok: false, error: `Failed to ${publish ? "publish" : "unpublish"} course.` });
    }
    await revalidatePublicCoursePages(course.slug);
    const msg = encodeURIComponent(
      publish ? "Course published successfully." : "Course unpublished successfully.",
    );
    return NextResponse.json({ ok: true, redirect: `/instructor/courses?msg=${msg}` });
  }

  if (action === "delete") {
    if (fields.confirm_delete !== "yes") {
      return NextResponse.json({ ok: false, error: "Please confirm deletion." });
    }
    const done = await deleteCourse(courseId, user.id);
    if (!done) {
      return NextResponse.json({ ok: false, error: "Failed to delete course. Please try again." });
    }
    await revalidatePublicCoursePages(course.slug);
    const msg = encodeURIComponent("Course and all its content deleted successfully.");
    return NextResponse.json({ ok: true, redirect: `/instructor/courses?msg=${msg}` });
  }

  // action === "save"
  if (!verifyCsrfToken(await readCsrfToken(), fields.csrf_token)) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." }, { status: 403 });
  }
  const p = courseSchema.safeParse(fields);
  if (!p.success) {
    return NextResponse.json({ ok: false, error: p.error.issues[0]?.message ?? "Invalid request." });
  }

  const result = await updateCourse(
    courseId,
    {
      title: p.data.title,
      short_description: p.data.short_description,
      description: p.data.description,
      category_id: Number(p.data.category_id),
      level: p.data.level,
      language: p.data.language,
      duration_hours: p.data.duration_hours,
      price: p.data.price,
      certificate_enabled: p.data.certificate_enabled,
      passing_percentage: p.data.passing_percentage,
    },
    user.id,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Failed to update course. Please try again." });
  }

  // The PHP ran the upload before the "no changes" check so a thumbnail-only edit still worked.
  const file = files.get("thumbnail");
  const thumbAttempted = file instanceof File && file.size > 0;
  if (thumbAttempted) {
    const err = await storeThumbnail(file, courseId);
    if (err) return NextResponse.json({ ok: false, error: err });
  }

  // Revalidate the live slug too: a renamed course gets a new URL, so both the previous URL and the
// new one must be purged or a visitor can keep hitting a stale cached page.
const afterSave = await getCourseById(courseId, user.id);
await revalidatePublicCoursePages(course.slug);
if (afterSave && afterSave.slug !== course.slug) await revalidatePublicCoursePages(afterSave.slug);

  if (result.rowsAffected === 0 && !thumbAttempted) {
    const msg = encodeURIComponent("No changes to save.");
    return NextResponse.json({ ok: true, redirect: `/instructor/edit-course?id=${courseId}&success=${msg}` });
  }
  const msg = encodeURIComponent("Course updated successfully!");
  return NextResponse.json({ ok: true, redirect: `/instructor/edit-course?id=${courseId}&success=${msg}` });
}

/** uploadThumbnail(): full scan parity, stored in B2 under courses/, old key deleted. */
async function storeThumbnail(file: File, courseId: number): Promise<string | null> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUploadFile(buffer, THUMB_ALLOWED, "course_thumbnail", THUMB_MAX);
  if (!scan.safe) return scan.message;

  const ext = EXT_BY_MIME[scan.mime] ?? "jpg";
  const key = `courses/course_${courseId}_${Math.floor(Date.now() / 1000)}.${ext}`;

  const existing = await getCourseById(courseId);
  if (existing?.thumbnail) await deleteObject(existing.thumbnail);

  try {
    await putObject(key, buffer, scan.mime);
  } catch {
    return "Upload failed.";
  }
  await updateCourse(courseId, { thumbnail: key }, Number(existing?.instructor_id ?? 0));
  return null;
}