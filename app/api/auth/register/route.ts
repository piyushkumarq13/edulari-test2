import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRegistrationBlock, recordRegistrationAttempt } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/auth/passwords";
import { issueEmailVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/email/senders";
import { logSecurity } from "@/lib/security/events";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Invalid email address format.").max(254),
  password: z.string().min(8, "Password must be at least 8 characters."),
  consent: z.string().optional(),
  website: z.string().optional(),
});

export async function POST(req: Request) {
  const isDev = String(process.env.NODE_ENV) !== "production";
  
  try {
    if (!isSameOriginPost(req)) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] origin check failed:", { origin: req.headers.get("origin"), host: req.headers.get("host") });
      }
      return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
    }

    const form = await req.formData();
    if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] CSRF verification failed");
      }
      return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
    }
    
    const parsed = schema.safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password"), consent: form.get("consent") ?? "", website: form.get("website") ?? "" });
    if (!parsed.success) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] validation failed:", parsed.error.issues);
      }
      const errors = parsed.error.issues.map((i) => (i.path[0] === "password" ? "Password must be at least 8 characters." : i.message));
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const { name, email, password, website } = parsed.data;
    if (website) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] website-only signups allowed:", { email });
      }
      return NextResponse.json({ success: true, redirect: "/register-success" });
    }

    const ip = getClientIp(req.headers);
    const block = await checkRegistrationBlock(ip);
    if (block.blocked) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] rate limited:", { ip, readableTime: block.readable_time });
      }
      return NextResponse.json({ success: false, errors: [`Too many accounts created from this network. Try again in ${block.readable_time}.`] }, { status: 429 });
    }

    const existing = await sql<{ id: number; email_verified: boolean }[]>`SELECT id, email_verified FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      if (!existing[0].email_verified) {
        // Debug logging - only in development
        if (isDev) {
          console.log("[register] unverified account exists:", { email, userId: existing[0].id });
        }
        await logSecurity("ACCOUNT_RECOVERY_ATTEMPT", { email, action: "existing_unverified_account_detected", user_id: existing[0].id }, req);
        return NextResponse.json({ success: true, redirect: `/account-activation?email=${encodeURIComponent(email)}` });
      }
      // Debug logging - only in development
      if (isDev) {
        console.log("[register] duplicate email:", { email });
      }
      return NextResponse.json({ success: false, errors: ["Email address is already registered."] }, { status: 409 });
    }

    const hash = hashPassword(password);
    const inserted = await sql<{ id: number }[]>`
      INSERT INTO users (name, email, password, role, registration_date, email_verified, is_active, profile_completed, ip_address)
      VALUES (${name}, ${email}, ${hash}, 'student', now(), false, true, false, ${ip})
      RETURNING id
    `;
    const userId = inserted[0].id;

    await recordRegistrationAttempt(ip);

    const token = await issueEmailVerificationToken(userId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    // Debug logging - only in development
    if (isDev) {
      console.log("[register] sending verification email:", { email, siteUrl, tokenLength: token.length });
    }
    const sent = await sendVerificationEmail(email, name, `${siteUrl}/verify-email?token=${token}`);

    if (!sent.ok) {
      console.error("[register] verification email failed:", sent.error);
      // Clean up the user we just created
      await sql`DELETE FROM users WHERE id = ${userId}`;
      await logSecurity("REGISTER_EMAIL_FAILURE", { user_id: userId, email, error: sent.error }, req);
      return NextResponse.json({ success: false, errors: ["Failed to send verification email. Please try again later."] }, { status: 500 });
    }

    await logSecurity("REGISTER_SUCCESS", { user_id: userId, email }, req);
    // Debug logging - only in development
    if (isDev) {
      console.log("[register] success:", { userId, email, name });
    }
    return NextResponse.json({ success: true, redirect: "/register-success" });
  } catch (err) {
    console.error("[register] unexpected error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/auth/register"
    });
    
    return NextResponse.json({ 
      success: false, 
      errors: ["An unexpected error occurred. Please try again later."] 
    }, { status: 500 });
  }
}
