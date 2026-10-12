import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { issueCsrfToken, CSRF_COOKIE } from "@/lib/security/csrf";

/**
 * GET /api/security/csrf-token
 * Returns current CSRF token or issues new one if none exists.
 * Mirrors PHP generateCSRFToken() behavior from private/auth.php
 */
export async function GET(): Promise<NextResponse> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  
  if (existing) {
    return NextResponse.json({ token: existing });
  }
  
  // Issue new token
  const token = issueCsrfToken();
  jar.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  
  return NextResponse.json({ token });
}
