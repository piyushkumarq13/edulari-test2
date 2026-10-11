import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/passwords";
import { revokeAllForUser } from "@/lib/auth/sessions";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "New password must be at least 8 characters."),
  confirm_password: z.string().min(1),
});

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
  }
  const parsed = schema.safeParse({ token: form.get("token"), password: form.get("password"), confirm_password: form.get("confirm_password") });
  if (!parsed.success) return NextResponse.json({ success: false, errors: ["New password must be at least 8 characters."] }, { status: 400 });

  const { token, password, confirm_password } = parsed.data;
  if (password !== confirm_password) return NextResponse.json({ success: false, errors: ["Passwords do not match."] }, { status: 400 });

  const info = await verifyPasswordResetToken(token);
  if (!info) return NextResponse.json({ success: false, errors: ["This reset link is invalid or has expired."] }, { status: 400 });

  const hash = hashPassword(password);
  await sql`UPDATE users SET password = ${hash}, password_changed_at = now() WHERE id = ${info.userId}`;
  await consumePasswordResetToken(token);
  await revokeAllForUser(info.userId, "password_changed");

  const jar = await cookies();
  jar.delete(process.env.SESSION_COOKIE_NAME ?? "edulari_session");

  await createNotification(info.userId, "password_changed", "Your password was changed", "Your password was reset and all other devices were signed out.");

  return NextResponse.json({ success: true, redirect: "/password-reset-after-verify" });
}
