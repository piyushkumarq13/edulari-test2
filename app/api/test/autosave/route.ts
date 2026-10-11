import { NextResponse } from "next/server";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { saveTestAnswers } from "@/lib/instructor/test-tokens";

export const dynamic = "force-dynamic";

/**
 * Autosave one answer during an active test. Mirrors the autosave_answer branch of
 * /test/index.php, including the 1-per-second rate limit and the JSON error reasons.
 */
export async function POST(request: Request) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  }
  const fd = await request.formData().catch(() => null);
  if (!fd) return NextResponse.json({ ok: false, reason: "invalid_request" });

  const token = String(fd.get("token") ?? "").trim();
  const csrf = String(fd.get("csrf_token") ?? "");
  if (!verifyCsrfToken(await readCsrfToken(), csrf)) {
    return NextResponse.json({ ok: false, reason: "csrf" });
  }

  const qIdx = Number(fd.get("question_index") ?? -1);
  const optLet = String(fd.get("option_letter") ?? "");

  const result = await saveTestAnswers(token, qIdx, optLet);
  return NextResponse.json(result);
}
