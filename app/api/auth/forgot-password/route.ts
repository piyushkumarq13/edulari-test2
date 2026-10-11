import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/client-ip";
import { checkPasswordResetRateLimit, recordPasswordResetAttempt } from "@/lib/security/rate-limit";
import { issuePasswordResetToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email/senders";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(req: Request) {
  const isDev = String(process.env.NODE_ENV) !== "production";
  
  try {
    if (!isSameOriginPost(req)) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[forgot-password] origin check failed:", { origin: req.headers.get("origin"), host: req.headers.get("host") });
      }
      return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
    }
    
    const form = await req.formData();
    if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[forgot-password] CSRF verification failed");
      }
      return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
    }
    
    const parsed = schema.safeParse({ email: form.get("email") });
    if (!parsed.success) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[forgot-password] validation failed:", parsed.error.issues);
      }
      return NextResponse.json({ success: false, errors: ["Please enter a valid email address."] }, { status: 400 });
    }

    const { email } = parsed.data;
    const ip = getClientIp(req.headers);

    // Always return success to avoid revealing whether the email exists.
    const rateLimited = await checkPasswordResetRateLimit(email, ip);
    if (rateLimited) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[forgot-password] rate limited:", { email, ip });
      }
      return NextResponse.json({ success: true, redirect: "/password-reset-after-verify" });
    }

    try {
      await sql`DELETE FROM password_resets WHERE expires_at < now()`;

      const users = await sql<{ id: number; name: string; email: string }[]>`SELECT id, name, email FROM users WHERE email = ${email}`;
      
      if (users.length === 0) {
        // Debug logging - only in development
        if (isDev) {
          console.log("[forgot-password] email not found (privacy protection):", { email });
        }
        return NextResponse.json({ success: true, redirect: "/password-reset-after-verify" });
      }

      await recordPasswordResetAttempt(email, ip);
      const token = await issuePasswordResetToken(users[0].id);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const resetLink = `${siteUrl}/reset-password?token=${token}`;
      
      // Debug logging - only in development
      if (isDev) {
        console.log("[forgot-password] sending reset email:", { email, userId: users[0].id, linkLength: resetLink.length });
      }
      const sent = await sendPasswordResetEmail(users[0].email, users[0].name, resetLink);
      
      if (!sent.ok) {
        console.error("[forgot-password] email delivery failed:", { email, error: sent.error });
        // Still return success for privacy, but log the failure
      }
    } catch (dbErr) {
      // Always log database errors even in production
      console.error("[forgot-password] database operation failed:", dbErr);
      // Return success to maintain privacy guarantee
      return NextResponse.json({ success: true, redirect: "/password-reset-after-verify" });
    }

    return NextResponse.json({ success: true, redirect: "/password-reset-after-verify" });
  } catch (err) {
    console.error("[forgot-password] unexpected error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/auth/forgot-password"
    });
    
    return NextResponse.json({ 
      success: false, 
      errors: ["An unexpected error occurred. Please try again later."] 
    }, { status: 500 });
  }
}
