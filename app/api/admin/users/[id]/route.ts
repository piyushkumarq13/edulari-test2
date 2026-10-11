import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { userActionAction } from "@/lib/api/admin/users";

export const runtime = "nodejs";

/**
 * Port of the AJAX action switch in admin/user-detail.php. The PHP page posted to itself with
 * `X-Requested-With: XMLHttpRequest`; the port uses a dedicated JSON endpoint. Both the list page
 * and the detail page call this route. `message` carries the detail-page wording (for the toast)
 * and `redirect` carries the list-page PRG target (so the success alert is shown after navigating).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ ok: false, message: "User not found.", error: "User not found." });
  }

  const { fields } = await readFields(req);
  if (!(await csrfOk(fields.csrf_token))) {
    const msg = "Invalid CSRF token. Please refresh and try again.";
    return NextResponse.json({ ok: false, message: msg, error: msg });
  }

  const result = await userActionAction({ ...fields, user_id: String(targetId) }, auth.user, req);
  return NextResponse.json({
    ok: result.ok,
    message: result.message ?? result.error,
    error: result.error,
    redirect: result.redirect,
  });
}
