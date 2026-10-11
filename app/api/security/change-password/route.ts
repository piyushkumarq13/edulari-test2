import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { regenerateSessionOnPasswordChange } from "@/lib/auth/sessions";
import { getClientIp } from "@/lib/security/client-ip";
import { getDeviceInfoFromHeaders } from "@/lib/auth/device";
import { logSecurity } from "@/lib/security/events";

const schema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(1),
  confirm_password: z.string().min(1),
});

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "edulari_session";

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, errors: ["Please log in."] }, { status: 401 });

  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
  }
  const parsed = schema.safeParse({
    current_password: form.get("current_password"),
    new_password: form.get("new_password"),
    confirm_password: form.get("confirm_password"),
  });
  if (!parsed.success) return NextResponse.json({ success: false, errors: ["All fields are required."] }, { status: 400 });

  const { current_password: currentPw, new_password: newPw, confirm_password: confirmPw } = parsed.data;

  const rows = await sql<{ password: string }[]>`SELECT password FROM users WHERE id = ${user.id}`;
  if (!rows.length || !verifyPassword(currentPw, rows[0].password)) {
    return NextResponse.json({ success: false, errors: ["Current password is incorrect."] }, { status: 400 });
  }
  if (newPw.length < 8) {
    return NextResponse.json({ success: false, errors: ["New password must be at least 8 characters."] }, { status: 400 });
  }
  if (newPw !== confirmPw) {
    return NextResponse.json({ success: false, errors: ["Passwords do not match."] }, { status: 400 });
  }

  await sql`UPDATE users SET password = ${hashPassword(newPw)}, password_changed_at = now() WHERE id = ${user.id}`;

  const ip = getClientIp(req.headers);
  const token = await regenerateSessionOnPasswordChange(user.id, ip, getDeviceInfoFromHeaders(req.headers));
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
  });

  await logSecurity("PASSWORD_CHANGED", { user_id: user.id }, req);

  return NextResponse.json({ success: true, message: "Password changed successfully! All other devices have been logged out." });
}
