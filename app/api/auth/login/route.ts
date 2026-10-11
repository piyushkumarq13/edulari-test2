import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/client-ip";
import { checkLoginBlock, recordFailedLoginAttempt, resetLoginAttempts } from "@/lib/security/rate-limit";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/sessions";
import { logSecurity } from "@/lib/security/events";
import { sendNewLoginNotificationEmail } from "@/lib/email/senders";
import { getDeviceInfoFromHeaders } from "@/lib/auth/device";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  redirect: z.string().optional().default(""),
});

export async function POST(req: Request) {
  const isDev = String(process.env.NODE_ENV) !== "production";
  
  try {
    if (!isSameOriginPost(req)) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] origin check failed:", { origin: req.headers.get("origin"), host: req.headers.get("host") });
      }
      return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });
    }

    const form = await req.formData();
    if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] CSRF verification failed");
      }
      return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
    }
    
    const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password"), redirect: form.get("redirect") ?? "" });
    if (!parsed.success) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] validation failed:", parsed.error.issues);
      }
      return NextResponse.json({ success: false, errors: ["Email and password are required."] }, { status: 400 });
    }

    const { email, password, redirect } = parsed.data;
    const ip = getClientIp(req.headers);

    const block = await checkLoginBlock(email, ip);
    if (block.blocked) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] rate limited:", { email, ip, readableTime: block.readable_time });
      }
      return NextResponse.json({ success: false, errors: [`Too many failed attempts. Try again in ${block.readable_time}.`] }, { status: 429 });
    }

    const users = await sql<{ id: number; name: string; email: string; role: string; password: string | null; email_verified: boolean; is_active: boolean; block_reason: string | null; last_login: Date | null }[]>`
      SELECT id, name, email, role, password, email_verified, is_active, block_reason, last_login FROM users WHERE email = ${email}
    `;

    if (users.length === 0 || !verifyPassword(password, users[0]?.password)) {
      await recordFailedLoginAttempt(email, ip);
      await logSecurity("LOGIN_FAILED", { email }, req);
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] invalid credentials:", { email, userFound: users.length > 0 });
      }
      return NextResponse.json({ success: false, errors: ["Invalid email or password."] }, { status: 401 });
    }

    const user = users[0];

    if (!user.email_verified) {
      // Debug logging - only in development
      if (isDev) {
        console.log("[login] email not verified:", { email });
      }
      return NextResponse.json({ success: false, errors: ["Please verify your email address before logging in."], unverified: true }, { status: 403 });
    }

    if (!user.is_active) {
      if (user.role === "instructor") {
        try {
          const apps = await sql<{ status: string }[]>`SELECT status FROM instructor_applications WHERE user_id = ${user.id} ORDER BY submitted_at DESC LIMIT 1`;
          if (apps.length > 0 && apps[0].status === "rejected") {
            return NextResponse.json({ success: false, errors: ["Your instructor application has been rejected. Please contact support or reapply."] }, { status: 403 });
          }
          if (user.block_reason === "admin_blocked") {
            return NextResponse.json({ success: false, errors: ["Your instructor account has been suspended. Please contact support."] }, { status: 403 });
          }
          if (apps.length === 0 || apps[0].status === "draft") {
            return NextResponse.json({ success: false, errors: ["Please finish your instructor registration."], resumeInstructor: true }, { status: 403 });
          }
          return NextResponse.json({ success: false, errors: ["Your instructor application is under review."] }, { status: 403 });
        } catch (err) {
          console.error("[login] instructor app check failed:", err);
          return NextResponse.json({ success: false, errors: ["Unable to check instructor status. Please try again later."] }, { status: 500 });
        }
      }
      if (user.block_reason === "admin_blocked") {
        return NextResponse.json({ success: false, errors: ["Your account has been suspended by an administrator. Please contact support."] }, { status: 403 });
      }
      return NextResponse.json({ success: false, errors: ["Your account has been deactivated. Please contact support."] }, { status: 403 });
    }

    await resetLoginAttempts(email, ip);
    await sql`UPDATE users SET last_login = now() WHERE id = ${user.id}`;

    const deviceInfo = getDeviceInfoFromHeaders(req.headers);
    const isKnownDevice = await sql<{ id: number }[]>`
      SELECT id FROM user_sessions WHERE user_id = ${user.id} AND ip_address = ${ip} AND device_info = ${deviceInfo} AND created_at > now() - interval '30 days' LIMIT 1
    `;
    const token = await createSession(user.id, ip, deviceInfo);

    // Set session cookie BEFORE returning response (App Router requirement)
    const cookieStore = await cookies();
    cookieStore.set(process.env.SESSION_COOKIE_NAME ?? "edulari_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
    });

    const wasFirstLogin = user.last_login === null;
    if (!wasFirstLogin && isKnownDevice.length === 0) {
      try {
        await sendNewLoginNotificationEmail(user.email, user.name, ip, deviceInfo);
      } catch (emailErr) {
        // Only log in development
        if (isDev) {
          console.error("[login] new login notification email failed:", emailErr);
        }
        // Don't fail login if email fails
      }
    }

    await logSecurity("LOGIN_SUCCESS", { user_id: user.id, email }, req);
    // Debug logging - only in development
    if (isDev) {
      console.log("[login] success:", { userId: user.id, email, role: user.role });
    }

    const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "";
    const dest = safeRedirect || (user.role === "admin" ? "/admin/dashboard" : user.role === "instructor" ? "/instructor/dashboard" : "/student/dashboard");
    return NextResponse.json({ success: true, redirect: dest });
  } catch (err) {
    console.error("[login] unexpected error:", {
      name: err instanceof Error ? err.name : "Unknown",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/auth/login"
    });
    
    await logSecurity("LOGIN_ERROR", { 
      email: "<unknown>",
      error: err instanceof Error ? err.message : "Unknown error"
    }, req);
    
    return NextResponse.json({ 
      success: false, 
      errors: ["An unexpected error occurred. Please try again later."] 
    }, { status: 500 });
  }
}
