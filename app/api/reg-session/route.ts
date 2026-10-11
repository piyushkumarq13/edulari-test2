import { NextResponse } from "next/server";
import { getRegSession, regSessionCookieOptions } from "@/lib/instructor/reg-session";

export const dynamic = "force-dynamic";

/**
 * Establish the anonymous wizard session and set its cookie. The wizard pages are server
 * components and cannot set cookies during render, so a first visit is redirected here;
 * the cookie is then present for every subsequent request. Mirrors the PHP session that
 * _init.php reads.
 */
export async function GET(request: Request) {
  const { session, isNew } = await getRegSession();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/instructor-register";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/instructor-register";

  const res = NextResponse.redirect(new URL(safeNext, url.origin));
  // Always (re)assert the cookie so its expiry is refreshed on every wizard visit.
  const cookie = regSessionCookieOptions(isNew ? session.token : session.token);
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
