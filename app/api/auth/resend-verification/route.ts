import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { issueEmailVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/senders";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
  const form = await req.formData();
  if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
    return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
  }
  const parsed = schema.safeParse({ email: form.get("email") });
  if (!parsed.success) return NextResponse.json({ success: false, errors: ["Please enter a valid email address."] }, { status: 400 });

  const { email } = parsed.data;
  // Never reveal whether the email exists.
  const users = await sql<{ id: number; name: string; email: string }[]>`
    SELECT id, name, email FROM users WHERE email = ${email} AND email_verified = false
  `;
  if (users.length > 0) {
    const token = await issueEmailVerificationToken(users[0].id);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await sendVerificationEmail(users[0].email, users[0].name, `${siteUrl}/verify-email?token=${token}`);
  }
  return NextResponse.json({ success: true, redirect: "/login" });
}
