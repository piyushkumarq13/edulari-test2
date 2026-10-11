import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchProfile, linkOrCreate } from "@/lib/auth/oauth";
import { createSession } from "@/lib/auth/sessions";
import { getDeviceInfoFromHeaders } from "@/lib/auth/device";
import { getClientIp } from "@/lib/security/client-ip";
import { logSecurity } from "@/lib/security/events";

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (provider !== "google" && provider !== "github") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code") ?? "";
  const state = searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("oauth_state")?.value ?? "";
  jar.delete("oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/login?reason=oauth_state", req.url));
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const redirectUri = `${siteUrl}/api/auth/oauth/${provider}/callback`;
  const tokenRes = await exchangeCode(provider, code, redirectUri);
  if (!tokenRes) return NextResponse.redirect(new URL("/login?reason=oauth_failed", req.url));

  const profile = await fetchProfile(provider, tokenRes.access_token);
  if (!profile) return NextResponse.redirect(new URL("/login?reason=oauth_profile", req.url));

  const user = await linkOrCreate(profile);
  if (!user) return NextResponse.redirect(new URL("/login?reason=oauth_link", req.url));

  const ip = getClientIp(req.headers);
  const token = await createSession(user.id, ip, getDeviceInfoFromHeaders(req.headers));
  jar.set(process.env.SESSION_COOKIE_NAME ?? "edulari_session", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
  });

  await logSecurity("OAUTH_LOGIN", { user_id: user.id, provider }, req);

  const dest = user.role === "admin" ? "/admin/dashboard" : user.role === "instructor" ? "/instructor/dashboard" : "/student/dashboard";
  return NextResponse.redirect(new URL(dest, req.url));
}
