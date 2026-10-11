import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { deleteObject } from "@/lib/storage/b2";
import { logDbError } from "@/lib/db/client";


function redirectTo(req: Request, params: Record<string, string>): NextResponse {
  const url = new URL("/student/profile", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

/** profile.php's remove_avatar action: delete the B2 object, then NULL the column. */
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

  try {
    const previous = await sql<{ profile_image: string | null }[]>`
      SELECT profile_image FROM users WHERE id = ${user.id}
    `;
    await sql`UPDATE users SET profile_image = NULL WHERE id = ${user.id}`;

    const oldKey = previous[0]?.profile_image ?? "";
    if (oldKey && oldKey.startsWith("avatars/")) await deleteObject(oldKey).catch(() => undefined);
  } catch (err) {
    logDbError("profile.avatar.remove", err);
    return redirectTo(req, { tab: "personal", flash_type: "error", flash_msg: "Failed to remove image. Please try again." });
  }

  return redirectTo(req, { tab: "personal", flash_type: "success", flash_msg: "Profile picture removed." });
}