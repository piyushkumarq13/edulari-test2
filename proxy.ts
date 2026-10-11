import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { buildCsp } from "@/lib/security/headers";
import { CSRF_COOKIE, issueCsrfToken } from "@/lib/security/csrf";
import { getMaintenanceState, isPathInMaintenanceScope } from "@/lib/maintenance";
import { renderMaintenancePage } from "@/components/maintenance-page";
import { validateSession } from "@/lib/auth/sessions";
import { encodeFlash, flashCookieOptions, FLASH_COOKIE } from "@/lib/payments/flash";
import { maybeRunCancelledOrdersCleanup, maybeRunPaymentReconciliation, purgeOldCancelledOrders, reconcilePendingRazorpayPayments } from "@/lib/payments/reconciliation";

// Match all app routes except static assets.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|uploads|legacy-js).*)"] };

/**
 * cart.php / wishlist.php / checkout.php all bounce instructors to /browse-courses
 * with a one-shot flash message. Middleware is the only place in the App Router that
 * may attach a cookie to a redirect response.
 */
const INSTRUCTOR_BLOCKED: Record<string, string> = {
  "/cart": "Instructors cannot access the cart.",
  "/wishlist": "Instructors cannot access the wishlist.",
  "/checkout": "Instructors cannot access checkout.",
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin bypass for maintenance mode.
  const sessionCookie = request.cookies.get(process.env.SESSION_COOKIE_NAME ?? "edulari_session")?.value ?? null;
  let role: string | null = null;
  if (sessionCookie) {
    try {
      const u = await validateSession(sessionCookie);
      role = u?.role ?? null;
    } catch {
      role = null;
    }
  }
  const isAdmin = role === "admin";

  if (!isAdmin) {
    try {
      const state = await getMaintenanceState();
      if (isPathInMaintenanceScope(pathname, state)) {
        return new NextResponse(renderMaintenancePage("Edulari"), {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    } catch {
      // Fail open: do not take the site down if the settings table is unreachable.
    }
  }

  if (role === "instructor" && INSTRUCTOR_BLOCKED[pathname]) {
    const res = NextResponse.redirect(new URL("/browse-courses", request.url));
    res.cookies.set(FLASH_COOKIE, encodeFlash({ msg: INSTRUCTOR_BLOCKED[pathname]!, type: "error" }), flashCookieOptions());
    return res;
  }

  // bootstrap.php calls both of these on every request; the interval guards make them
  // no-ops unless the window has elapsed.
  try {
    if (await maybeRunPaymentReconciliation()) await reconcilePendingRazorpayPayments();
    if (await maybeRunCancelledOrdersCleanup()) await purgeOldCancelledOrders();
  } catch {
    // Never let background maintenance break the request.
  }

  const nonce = crypto.randomBytes(16).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  const needsCsrf = !request.cookies.get(CSRF_COOKIE)?.value;
  const csrfToken = needsCsrf ? issueCsrfToken() : "";

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (needsCsrf) {
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}
