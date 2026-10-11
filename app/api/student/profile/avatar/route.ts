import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { scanUpload } from "@/lib/storage/upload-validation";
import { deleteObject, putObject } from "@/lib/storage/b2";
import { logDbError } from "@/lib/db/client";


/** profile.php's upload_avatar allow-list and 2 MB cap. */
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function redirectTo(req: Request, params: Record<string, string>): NextResponse {
  const url = new URL("/student/profile", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

/** profile.php's `stu_<id>_<time>.<ext>` under B2 `avatars/`. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) {
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: "Invalid request. Please refresh and try again." });
  }
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
  }

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: "Invalid request. Please refresh and try again." });
  }

  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: "No image file selected." });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUpload(buffer, ALLOWED_MIMES, "student_avatar", MAX_BYTES);
  if (!scan.safe) {
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: scan.message });
  }

  const ext = EXT_BY_MIME[scan.mime] ?? "jpg";
  const key = `avatars/stu_${user.id}_${Math.floor(Date.now() / 1000)}.${ext}`;

  try {
    const previous = await sql<{ profile_image: string | null }[]>`
      SELECT profile_image FROM users WHERE id = ${user.id}
    `;
    await putObject(key, buffer, scan.mime);
    await sql`UPDATE users SET profile_image = ${key} WHERE id = ${user.id}`;

    const oldKey = previous[0]?.profile_image ?? "";
    if (oldKey && oldKey !== key) await deleteObject(oldKey).catch(() => undefined);
  } catch (err) {
    logDbError("profile.avatar", err);
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: "Failed to upload image. Please try again." });
  }

  return redirectTo(req, { tab: "personal", flash_type: "success", flash_msg: "Profile picture updated!" });
}