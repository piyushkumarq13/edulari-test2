import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getObject } from "@/lib/storage/b2";
import { getMaintenanceState } from "@/lib/maintenance";
import { getSessionFromRequest } from "@/lib/security/api";


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const key = searchParams.get("key") ?? "";
  const id = searchParams.get("id");
  const user = await getSessionFromRequest();

  try {
    if (type === "avatar") {
      if (!key) return NextResponse.json({ error: "Missing key parameter." }, { status: 400 });
      const obj = await getObject(key);
      return new NextResponse(obj.body as ReadableStream, {
        status: obj.status,
        headers: {
          "Content-Type": obj.contentType ?? "application/octet-stream",
          "Content-Length": String(obj.contentLength ?? 0),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "Accept-Ranges": obj.acceptRanges ?? "bytes",
        },
      });
    }

    if (type === "lesson_pdf") {
      const lessonId = Number(id ?? 0);
      if (!lessonId || lessonId <= 0) return NextResponse.json({ error: "Invalid lesson ID." }, { status: 400 });
      const state = await getMaintenanceState();
      if (state.student) return NextResponse.json({ error: "Service temporarily unavailable due to maintenance." }, { status: 503 });
      if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      const lessons = await sql<{ course_id: number; pdf_file: string | null }[]>`SELECT course_id, pdf_file FROM lessons WHERE id = ${lessonId}`;
      if (lessons.length === 0 || !lessons[0].pdf_file) return NextResponse.json({ error: "PDF not found." }, { status: 404 });
      const enrolled = await sql<{ c: string }[]>`SELECT COUNT(*)::text AS c FROM enrollments WHERE student_id = ${user.id} AND course_id = ${lessons[0].course_id}`;
      if (Number(enrolled[0].c) === 0) return NextResponse.json({ error: "You are not enrolled in this course." }, { status: 403 });
      const obj = await getObject(lessons[0].pdf_file);
      return new NextResponse(obj.body as ReadableStream, {
        status: obj.status,
        headers: {
          "Content-Type": obj.contentType ?? "application/pdf",
          "Content-Length": String(obj.contentLength ?? 0),
          "Content-Disposition": `inline; filename="${lessons[0].pdf_file.split("/").pop()}"`,
          "Cache-Control": "private, max-age=3600",
          "Accept-Ranges": obj.acceptRanges ?? "bytes",
        },
      });
    }

    if (type === "assignment_file") {
      // Private bucket object attached to an assignment submission. The PHP wrote the
      // upload to private/uploads/assignments/ and then dropped it (docs/analysis/phase6.md
      // section 7.2); the port stores the key and serves it to the owner, the course
      // instructor, or an admin.
      const submissionId = Number(id ?? 0);
      if (!submissionId || submissionId <= 0) return NextResponse.json({ error: "Invalid submission ID." }, { status: 400 });
      const subs = await sql<
        { attachment_file: string | null; student_id: number; instructor_id: number }[]
      >`
        SELECT ass.attachment_file, e.student_id, c.instructor_id
        FROM assignment_submissions ass
        JOIN enrollments e ON e.id = ass.enrollment_id
        JOIN courses c ON c.id = e.course_id
        WHERE ass.id = ${submissionId}
      `;
      if (subs.length === 0 || !subs[0].attachment_file) {
        return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
      }
      const row = subs[0];
      const attachmentKey = row.attachment_file as string;
      if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      const allowed = user.role === "admin" || user.id === row.student_id || user.id === row.instructor_id;
      if (!allowed) return NextResponse.json({ error: "Access denied." }, { status: 403 });

      const obj = await getObject(attachmentKey);
      return new NextResponse(obj.body as ReadableStream, {
        status: obj.status,
        headers: {
          "Content-Type": obj.contentType ?? "application/octet-stream",
          "Content-Length": String(obj.contentLength ?? 0),
          "Content-Disposition": `attachment; filename="${attachmentKey.split("/").pop()}"`,
          "Cache-Control": "private, max-age=3600",
          "Accept-Ranges": obj.acceptRanges ?? "bytes",
        },
      });
    }

    if (type === "instructor_doc") {
      // Government ID / marksheet uploaded during instructor registration. Private bucket,
      // admin-only (the applicant never re-downloads their own documents — the PHP did not
      // serve them back either). Phase 8 renders the admin review screen.
      const applicationId = Number(id ?? 0);
      if (!applicationId || applicationId <= 0) return NextResponse.json({ error: "Invalid application ID." }, { status: 400 });
      if (!user || user.role !== "admin") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
      const field = searchParams.get("field") === "marksheet_file" ? "marksheet_file" : "govt_id_file";
      const rows = await sql<{ key: string | null }[]>`
        SELECT ${sql(field)} AS key FROM instructor_applications WHERE id = ${applicationId}`;
      const key = rows[0]?.key;
      if (!key) return NextResponse.json({ error: "Document not found." }, { status: 404 });
      const obj = await getObject(key);
      return new NextResponse(obj.body as ReadableStream, {
        status: obj.status,
        headers: {
          "Content-Type": obj.contentType ?? "application/octet-stream",
          "Content-Length": String(obj.contentLength ?? 0),
          "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
          "Cache-Control": "private, max-age=3600",
          "Accept-Ranges": obj.acceptRanges ?? "bytes",
        },
      });
    }

    return NextResponse.json({ error: "Unknown media type." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
