import { NextResponse } from "next/server";
import { authorizeAdmin, readFields } from "@/lib/admin/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { handleSettingsAction } from "@/lib/api/admin/settings";

export const runtime = "nodejs";
// Keep in sync with the max_exec_time value reported by the system_info action.
export const maxDuration = 30;

const CSRF_MESSAGE = "Security token invalid. Refresh the page and try again.";

/**
 * POST handler for public/admin/settings.php.
 *
 * The PHP page handled 10 JSON actions in one POST endpoint after an admin-role check and a CSRF
 * token check. This reproduces that: authorizeAdmin() (session + admin role + Origin/Host) first,
 * then the exact CSRF error shape (HTTP 200 JSON, as the PHP echoed), then the action dispatch.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  let fields: Record<string, string>;
  try {
    fields = (await readFields(req)).fields;
  } catch {
    return NextResponse.json({ success: false, message: CSRF_MESSAGE });
  }

  if (!verifyCsrfToken(await readCsrfToken(), String(fields.csrf_token ?? ""))) {
    return NextResponse.json({ success: false, message: CSRF_MESSAGE });
  }

  const action = String(fields.action ?? "");
  const result = await handleSettingsAction(action, fields, user, req);

  const response = NextResponse.json(result.body);
  if (result.cookieToken) {
    // change_password issues a fresh session on the current device (all others were kicked).
    response.cookies.set(process.env.SESSION_COOKIE_NAME ?? "edulari_session", result.cookieToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
    });
  }
  return response;
}
