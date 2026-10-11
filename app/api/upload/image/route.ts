import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { scanUpload } from "@/lib/storage/upload-validation";
import { getSessionFromRequest } from "@/lib/security/api";


const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const user = await getSessionFromRequest();
  if (!user || !["admin", "instructor"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "Not allowed." }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, message: "No file uploaded." });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const scan = scanUpload(buffer, ALLOWED, "editor_image", 5 * 1024 * 1024);
  if (!scan.safe) {
    return NextResponse.json({ success: false, message: scan.message });
  }
  const ext = scan.mime === "image/png" ? "png" : scan.mime === "image/webp" ? "webp" : scan.mime === "image/gif" ? "gif" : "jpg";
  const name = `editor_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "editor");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return NextResponse.json({ success: true, url: `/uploads/editor/${name}` });
}
