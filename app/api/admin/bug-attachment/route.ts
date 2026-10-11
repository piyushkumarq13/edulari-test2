import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/guards";
import { findBugReportByAttachment } from "@/lib/db/admin/bug-reports";
import { getObject } from "@/lib/storage/b2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Admin-only download/inline view of a bug-report attachment.
 *
 * The PHP detail page linked to /serve-attachment.php?file=… which does not exist in
 * the codebase (the link was dead). This route restores the intended behaviour: it only
 * serves a filename that is actually recorded on a bug_reports row (so it can never be
 * used to read arbitrary bucket keys / path-traverse) and only to a signed-in admin.
 * The object lives in the private bucket under the same `bug_reports/<name>` shape the
 * PHP used on local disk.
 */
export async function GET(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const file = (searchParams.get("file") ?? "").trim();

  // Filenames are the PHP-generated `br_<time>_<hex>.<ext>`; reject anything else
  // (also blocks `..`, slashes and backslashes).
  if (!file || !/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) {
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }

  const record = await findBugReportByAttachment(file);
  if (!record) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const range = req.headers.get("range") ?? undefined;

  try {
    const obj = await getObject(`bug_reports/${file}`, range);
    return new NextResponse(obj.body as ReadableStream, {
      status: obj.status,
      headers: {
        "Content-Type": obj.contentType ?? MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Content-Length": String(obj.contentLength ?? 0),
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Accept-Ranges": obj.acceptRanges ?? "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
}
