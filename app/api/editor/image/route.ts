import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";
import { scanUploadFile } from "@/lib/storage/upload-validation";
import { putObject } from "@/lib/storage/b2";

export const runtime = "nodejs";

/**
 * Port of public/ajax-image-upload.php (the endpoint md-editor.js posts to when an instructor
 * inserts an image by file). The PHP allowed only `admin` and `instructor`, scanned the upload
 * against the same four image MIME types with a 5 MB cap, and stored it under public/uploads/.
 * That directory cannot survive on Vercel, so the object goes to B2 and is served through the
 * same /media?type=avatar proxy the rest of the public assets use.
 *
 * Two deliberate strengthenings over the PHP: the CSRF token is required (the PHP endpoint had
 * none) and the object key is randomised rather than derived from a timestamp.
 */
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getSessionFromRequest();
  if (!user || (user.role !== "admin" && user.role !== "instructor")) {
    return NextResponse.json({ success: false, message: "Not allowed." }, { status: 403 });
  }

  // ajax-image-upload.php carried no CSRF check; AGENTS.md forbids shipping a state-changing
  // endpoint without one, so the editor now sends the token it already holds.
  const originOk = originMatchesHost(req.headers.get("origin"), req.headers.get("host"));
  const csrfOk = verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token"));
  if (!originOk || !csrfOk) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 403 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const candidate = form.get("file");
    file = candidate instanceof File ? candidate : null;
  } catch {
    file = null;
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ success: false, message: "No file uploaded." });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUploadFile(buffer, ALLOWED_MIMES, "editor_image", MAX_BYTES);
  if (!scan.safe) {
    return NextResponse.json({ success: false, message: scan.message });
  }

  const ext = EXT_BY_MIME[scan.mime] ?? "jpg";
  const name = `editor_${Math.floor(Date.now() / 1000)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.${ext}`;
  const key = `editor/${name}`;

  try {
    await putObject(key, buffer, scan.mime);
  } catch {
    return NextResponse.json({ success: false, message: "Upload failed." });
  }

  return NextResponse.json({ success: true, url: `/media?type=avatar&key=${encodeURIComponent(key)}` });
}