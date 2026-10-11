import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth/sessions";
import { getAdminFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";

/**
 * Shared entry check for every /api/admin/* route handler.
 *
 * The PHP admin pages each did `requireRole(ROLE_ADMIN)` and then, for POSTs, verified the CSRF
 * token (dashboard and the CRUD pages) or handled the request as a fetch (user-detail,
 * enrollments, reviews, bug/contact detail). This reproduces both: session + admin role, an
 * Origin/Host check, and the CSRF token comparison, in one place so a route cannot forget one.
 */
export type AdminAuth =
  | { user: SessionUser; denied: null }
  | { user: null; denied: NextResponse };

export async function authorizeAdmin(req: Request): Promise<AdminAuth> {
  const user = await getAdminFromRequest();
  if (!user) {
    return { user: null, denied: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  }
  if (!originMatchesHost(req.headers.get("origin"), req.headers.get("host"))) {
    return { user: null, denied: NextResponse.json({ ok: false, error: "Invalid request." }, { status: 403 }) };
  }
  return { user, denied: null };
}

/** Verify the submitted CSRF token against the httpOnly cookie. */
export async function csrfOk(token: string | undefined | null): Promise<boolean> {
  return verifyCsrfToken(await readCsrfToken(), token ?? "");
}

/** Read a multipart/urlencoded body into a flat string map (files are read separately). */
export async function readFields(req: Request): Promise<{ fields: Record<string, string>; form: FormData }> {
  const form = await req.formData();
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  return { fields, form };
}
