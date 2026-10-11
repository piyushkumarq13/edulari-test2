import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { AiError, handleAction } from "@/lib/ai/course-chat";

export const maxDuration = 60;

const schema = z.object({
  course_id: z.coerce.number().int().positive(),
  content: z.string().trim().max(8000).optional(),
  message_id: z.coerce.number().int().nonnegative().optional(),
  version_index: z.coerce.number().int().nonnegative().optional(),
  feedback: z.string().max(16).optional(),
});

/**
 * Port of public/student/course_ai_chat_api.php.
 *
 * Auth guard (student only), course_id > 0, then a switch over the eight actions.
 * The PHP sent an X-CSRF-Token header the server never read; the port verifies it
 * (docs/analysis/phase6.md section 3).
 */
export async function POST(req: Request) {
  const user = await getSessionFromRequest();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (!isSameOriginPost(req)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token"))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const action = new URL(req.url).searchParams.get("action") ?? "";

  let raw: Record<string, unknown> = {};
  try {
    raw = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  } catch {
    raw = {};
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data.course_id <= 0) {
    return NextResponse.json({ error: "Invalid course" });
  }

  try {
    const result = await handleAction(action, parsed.data, user.id, parsed.data.course_id);
    if (result.kind === "messages") return NextResponse.json({ messages: result.messages });
    if (result.kind === "slug") return NextResponse.json({ slug: result.slug });
    if (result.kind === "ok") return NextResponse.json({ ok: true, feedback: result.feedback ?? null });
    return NextResponse.json({ error: result.error });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}