import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { revokeAllOtherSessions, revokeSessionById } from "@/lib/auth/sessions";

const schema = z.object({ action: z.enum(["logout_other_sessions", "logout_one_session"]), session_id: z.coerce.number().int().positive().optional() });

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "edulari_session";

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, error: "Invalid request. Please refresh and try again." }, { status: 403 });
  }
  const parsed = schema.safeParse({ action: form.get("action"), session_id: form.get("session_id") ?? undefined });
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });

  const jar = await cookies();
  const currentToken = jar.get(COOKIE)?.value ?? "";

  if (parsed.data.action === "logout_other_sessions") {
    if (currentToken) await revokeAllOtherSessions(user.id, currentToken);
    return NextResponse.json({ success: true, message: "All other devices have been logged out." });
  }

  const sessionId = parsed.data.session_id;
  if (!sessionId) return NextResponse.json({ success: false, error: "You cannot log out your current session from here." }, { status: 400 });
  if (!await revokeSessionById(sessionId, user.id)) {
    return NextResponse.json({ success: false, error: "You cannot log out your current session from here." }, { status: 400 });
  }
  return NextResponse.json({ success: true, message: "Session has been terminated." });
}
