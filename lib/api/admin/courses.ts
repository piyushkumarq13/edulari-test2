import { NextResponse } from "next/server";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/sessions";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import { deleteObject, putObject } from "@/lib/storage/b2";
import { scanUploadFile } from "@/lib/storage/upload-validation";
import { revalidatePublicCoursePages } from "@/lib/revalidate";
import {
  adminCreateCourse,
  adminDeleteCourse,
  adminGetCourse,
  adminSetFeatured,
  adminToggleCoursePublish,
  adminUpdateCourse,
  getAdminCourseSlugs,
  type AdminCoursePatch,
} from "@/lib/db/admin/courses";

/**
 * The admin course write actions from courses.php, create-course.php and edit-course.php.
 * Kept out of the route files so both routes share one implementation. Every action verifies the
 * session/admin role, the Origin header and the CSRF token, and records an audit event, then
 * answers with JSON so the client can follow the Post/Redirect/Get target.
 */

const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "1" || v === "on");

// PHP intval()/floatval(): non-numeric input collapses to 0 rather than failing.
const phpInt = z.preprocess((v) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}, z.number());
const phpFloat = z.preprocess((v) => {
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}, z.number());

const createSchema = z.object({
  instructor_id: phpInt,
  category_id: z.string().optional().default(""),
  title: z.string().optional().default("").transform((s) => s.trim()),
  short_description: z.string().optional().default("").transform((s) => s.trim()),
  description: z.string().optional().default("").transform((s) => s.trim()),
  level: z.string().optional().default("beginner"),
  language: z.string().optional().default("English").transform((s) => s.trim()),
  duration_hours: phpInt,
  price: phpFloat,
  certificate_enabled: checkbox,
  passing_percentage: phpInt,
});

const editSchema = z.object({
  title: z.string().optional().default("").transform((s) => s.trim()),
  short_description: z.string().optional().default("").transform((s) => s.trim()),
  description: z.string().optional().default("").transform((s) => s.trim()),
  category_id: z.string().optional().default(""),
  instructor_id: phpInt,
  level: z.string().optional().default("beginner"),
  language: z.string().optional().default("English").transform((s) => s.trim()),
  duration_hours: phpInt,
  price: phpFloat,
  certificate_enabled: checkbox,
  passing_percentage: phpInt,
  is_published: checkbox,
  is_featured: checkbox,
});

const THUMB_ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const THUMB_MAX = 2 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type CreateData = z.output<typeof createSchema>;
type EditData = z.output<typeof editSchema>;

/** The validation exactly as create-course.php ordered it (first failure wins). */
function firstCreateError(d: CreateData): string | null {
  if (d.instructor_id <= 0) return "Please select an instructor.";
  if (d.title === "") return "Course title is required.";
  if (d.title.length < 5) return "Course title must be at least 5 characters.";
  if (d.title.length > 200) return "Course title must not exceed 200 characters.";
  if (d.short_description === "") return "Short description is required.";
  if (d.short_description.length < 20) return "Short description must be at least 20 characters.";
  if (d.short_description.length > 500) return "Short description must not exceed 500 characters.";
  if (d.price < 0) return "Price cannot be negative.";
  if (d.passing_percentage < 0 || d.passing_percentage > 100) return "Passing percentage must be between 0 and 100.";
  if (d.duration_hours < 0) return "Duration cannot be negative.";
  return null;
}

/** The validation exactly as edit-course.php ordered it. */
function firstEditError(d: EditData): string | null {
  if (d.title === "") return "Course title is required.";
  if (d.short_description === "") return "Short description is required.";
  if (d.instructor_id <= 0) return "Please select an instructor.";
  if (d.passing_percentage < 0 || d.passing_percentage > 100) return "Passing percentage must be between 0 and 100.";
  if (d.price < 0) return "Price cannot be negative.";
  return null;
}

function parseIds(values: FormDataEntryValue[]): number[] {
  return values
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** POST /api/admin/courses — create (default) or one of the list-page actions. */
export async function adminCoursesPost(req: Request): Promise<NextResponse> {
  const { fields, form } = await readFields(req);
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;
  if (!(await csrfOk(fields.csrf_token))) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." }, { status: 403 });
  }

  if (fields.delete !== undefined) return deleteCourse(auth.user, Number.parseInt(fields.course_id ?? "0", 10), req);
  if (fields.toggle_publish !== undefined) return togglePublish(auth.user, Number.parseInt(fields.course_id ?? "0", 10), Number.parseInt(fields.status ?? "0", 10), req);
  if (fields.feature !== undefined) return setFeatured(auth.user, Number.parseInt(fields.course_id ?? "0", 10), true, req);
  if (fields.unfeature !== undefined) return setFeatured(auth.user, Number.parseInt(fields.course_id ?? "0", 10), false, req);
  if (fields.bulk_action !== undefined) return bulkAction(auth.user, fields.bulk_action, parseIds(form.getAll("selected_ids[]")), req);

  return createCourse(auth.user, fields);
}

async function createCourse(admin: SessionUser, fields: Record<string, string>): Promise<NextResponse> {
  const p = createSchema.safeParse(fields);
  if (!p.success) return NextResponse.json({ ok: false, error: p.error.issues[0]?.message ?? "Invalid request." });
  const d = p.data;
  const error = firstCreateError(d);
  if (error) return NextResponse.json({ ok: false, error });

  const courseId = await adminCreateCourse({
    instructor_id: d.instructor_id,
    category_id: d.category_id === "" ? null : Number(d.category_id),
    title: d.title,
    description: d.description,
    short_description: d.short_description,
    level: d.level,
    language: d.language,
    duration_hours: d.duration_hours,
    price: d.price,
    certificate_enabled: d.certificate_enabled,
    passing_percentage: d.passing_percentage,
  });
  if (!courseId) {
    return NextResponse.json({ ok: false, error: "Failed to create course. Please try again." });
  }
  await auditAdmin(admin, "admin.course.create", { course_id: courseId });
  return NextResponse.json({ ok: true, redirect: `/admin/create-course?success=1&id=${courseId}` });
}

async function deleteCourse(admin: SessionUser, courseId: number, req: Request): Promise<NextResponse> {
  if (courseId > 0) {
    const course = await adminGetCourse(courseId);
    if (await adminDeleteCourse(courseId)) {
      if (course) await revalidatePublicCoursePages(course.slug);
      await auditAdmin(admin, "admin.course.delete", { course_id: courseId }, req);
      const message = encodeURIComponent("Course deleted successfully.");
      return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
    }
  }
  return NextResponse.json({ ok: false, error: "Failed to delete course. Please try again." });
}

async function togglePublish(admin: SessionUser, courseId: number, currentStatus: number, req: Request): Promise<NextResponse> {
  const newStatus = currentStatus === 1 ? false : true;
  const course = await adminGetCourse(courseId);
  await adminToggleCoursePublish(courseId, newStatus);
  if (course) await revalidatePublicCoursePages(course.slug);
  await auditAdmin(admin, "admin.course.toggle_publish", { course_id: courseId, is_published: newStatus }, req);
  const message = encodeURIComponent("Course status updated.");
  return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
}

async function setFeatured(admin: SessionUser, courseId: number, featured: boolean, req: Request): Promise<NextResponse> {
  const course = await adminGetCourse(courseId);
  await adminSetFeatured(courseId, featured);
  if (course) await revalidatePublicCoursePages(course.slug);
  await auditAdmin(admin, "admin.course.feature", { course_id: courseId, is_featured: featured }, req);
  const message = encodeURIComponent(featured ? "Course marked as featured." : "Course removed from featured.");
  return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
}

async function bulkAction(admin: SessionUser, action: string, ids: number[], req: Request): Promise<NextResponse> {
  if (ids.length === 0) return NextResponse.json({ ok: true });

  const slugs = await getAdminCourseSlugs(ids);
  if (action === "publish" || action === "unpublish") {
    const publish = action === "publish";
    for (const id of ids) await adminToggleCoursePublish(id, publish);
    for (const s of slugs) await revalidatePublicCoursePages(s.slug);
    await auditAdmin(admin, "admin.course.bulk", { action, ids }, req);
    const message = encodeURIComponent(`${ids.length} course(s) ${publish ? "published" : "unpublished"}.`);
    return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
  }
  if (action === "feature" || action === "unfeature") {
    const featured = action === "feature";
    for (const id of ids) await adminSetFeatured(id, featured);
    for (const s of slugs) await revalidatePublicCoursePages(s.slug);
    await auditAdmin(admin, "admin.course.bulk", { action, ids }, req);
    const message = encodeURIComponent(`${ids.length} course(s) ${featured ? "marked as featured" : "removed from featured"}.`);
    return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
  }
  if (action === "delete") {
    let deleted = 0;
    for (const id of ids) {
      if (await adminDeleteCourse(id)) deleted++;
    }
    for (const s of slugs) await revalidatePublicCoursePages(s.slug);
    await auditAdmin(admin, "admin.course.bulk", { action, ids, deleted }, req);
    const message = encodeURIComponent(`${deleted} course(s) deleted successfully.`);
    return NextResponse.json({ ok: true, redirect: `/admin/courses?msg=${message}` });
  }
  return NextResponse.json({ ok: false, error: "Invalid bulk action." });
}

/** POST /api/admin/courses/[id] — edit-course.php save (with optional thumbnail upload). */
export async function adminCoursePost(req: Request, courseId: number): Promise<NextResponse> {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;

  const course = await adminGetCourse(courseId);
  if (!course) return NextResponse.json({ ok: false, error: "Course not found or access denied." });

  const { fields, form } = await readFields(req);
  if (!(await csrfOk(fields.csrf_token))) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please try again." }, { status: 403 });
  }

  const p = editSchema.safeParse(fields);
  if (!p.success) return NextResponse.json({ ok: false, error: p.error.issues[0]?.message ?? "Invalid request." });
  const d = p.data;
  const error = firstEditError(d);
  if (error) return NextResponse.json({ ok: false, error });

  // The upload runs before the update, exactly as edit-course.php did; a bad file aborts the save.
  const file = form.get("thumbnail");
  if (file instanceof File && file.size > 0) {
    const uploadError = await storeThumbnail(file, courseId);
    if (uploadError) return NextResponse.json({ ok: false, error: uploadError });
  }

  const patch: AdminCoursePatch = {
    title: d.title,
    short_description: d.short_description,
    description: d.description,
    category_id: d.category_id === "" ? null : Number(d.category_id),
    instructor_id: d.instructor_id,
    level: d.level,
    language: d.language,
    duration_hours: d.duration_hours,
    price: d.price,
    certificate_enabled: d.certificate_enabled,
    passing_percentage: d.passing_percentage,
    is_published: d.is_published,
    is_featured: d.is_featured,
  };
  if (!(await adminUpdateCourse(courseId, patch))) {
    return NextResponse.json({ ok: false, error: "Failed to update course. Please try again." });
  }

  await revalidatePublicCoursePages(course.slug);
  const refreshed = await adminGetCourse(courseId);
  if (refreshed && refreshed.slug !== course.slug) await revalidatePublicCoursePages(refreshed.slug);
  await auditAdmin(auth.user, "admin.course.update", { course_id: courseId }, req);

  const message = encodeURIComponent("Course updated successfully.");
  return NextResponse.json({ ok: true, redirect: `/admin/edit-course?id=${courseId}&success=${message}` });
}

/** adminUploadThumbnail(): full scan parity, stored in B2, the previous object deleted. */
async function storeThumbnail(file: File, courseId: number): Promise<string | null> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUploadFile(buffer, THUMB_ALLOWED, "course_thumbnail", THUMB_MAX);
  if (!scan.safe) return scan.message;

  const ext = EXT_BY_MIME[scan.mime] ?? "jpg";
  const key = `courses/course_${courseId}_${Math.floor(Date.now() / 1000)}.${ext}`;

  const existing = await adminGetCourse(courseId);
  if (existing?.thumbnail) await deleteObject(existing.thumbnail);

  try {
    await putObject(key, buffer, scan.mime);
  } catch {
    return "Upload failed. Check server write permissions.";
  }
  await adminUpdateCourse(courseId, { thumbnail: key });
  return null;
}
