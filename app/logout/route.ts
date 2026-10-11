import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const jar = await cookies();
  const token = jar.get(process.env.SESSION_COOKIE_NAME ?? "edulari_session")?.value;
  if (token) {
    const { revokeSession } = await import("@/lib/auth/sessions");
    await revokeSession(token, "manual_logout");
  }
  jar.delete(process.env.SESSION_COOKIE_NAME ?? "edulari_session");
  return NextResponse.redirect(new URL("/login?reason=manual_logout", req.url));
}
