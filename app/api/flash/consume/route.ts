import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { FLASH_COOKIE, flashCookieOptions } from "@/lib/payments/flash";

/**
 * Deletes the one-shot flash cookie after the message has been rendered once
 * (the PHP `unset($_SESSION['flash'])`).
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(FLASH_COOKIE, "", { ...flashCookieOptions(), maxAge: 0 });

  return NextResponse.json({ ok: true });
}
