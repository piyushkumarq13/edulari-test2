import { NextResponse } from "next/server";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

/**
 * Post/Redirect/Get for the admin detail pages. The PHP pages echoed
 * `header("Location: ?" . http_build_query(array_merge($_GET, [...])))`, i.e. they kept
 * the current GET params and let the new flash values win. The Referer carries the
 * same current-URL params, gets replayed, and `extra` overrides any previous values.
 */
export function redirectAfter(
  req: Request,
  extra: Record<string, string>,
  fallback: string,
): NextResponse {
  const base = new URL(SITE_URL || "http://localhost");
  const target = new URL(fallback, base);
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const refUrl = new URL(ref, base);
      for (const [k, v] of refUrl.searchParams) target.searchParams.set(k, v);
    } catch {
      // Referer malformed — fall back to the bare page.
    }
  }
  for (const [k, v] of Object.entries(extra)) target.searchParams.set(k, v);
  return NextResponse.redirect(target, 303);
}

/** Absolute redirect to a fixed page (used by the contact delete action). */
export function redirectTo(path: string): NextResponse {
  const base = new URL(SITE_URL || "http://localhost");
  return NextResponse.redirect(new URL(path, base), 303);
}
