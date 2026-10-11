import crypto from "node:crypto";
import { cookies } from "next/headers";

export const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? "edulari_csrf";

export function issueCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyCsrfToken(expected: string | undefined | null, received: string | undefined | null): boolean {
  if (!expected || !received) return false;
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

/** For route handlers/server actions: verify request Origin matches Host (CSRF defense-in-depth). */
export function originMatchesHost(originHeader: string | null, hostHeader: string | null): boolean {
  if (!originHeader || !hostHeader) return false;
  try {
    const o = new URL(originHeader);
    return o.host === hostHeader;
  } catch {
    return false;
  }
}

/**
 * Read the per-browser CSRF token. Mirrors verifyCSRFToken()/generateCSRFToken()
 * from private/auth.php: PHP keeps the token in $_SESSION, we keep it in an
 * httpOnly cookie that proxy.ts issues on first request and never rotates on
 * form posts (exactly like the PHP session value).
 */
export async function readCsrfToken(): Promise<string> {
  const jar = await cookies();
  return jar.get(CSRF_COOKIE)?.value ?? "";
}
