import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, type SessionUser } from "./sessions";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "edulari_session";

async function readToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE)?.value ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readToken();
  if (!token) return null;
  return validateSession(token);
}

export async function requireUser(reason = "session_expired"): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/login?reason=${encodeURIComponent(reason)}`);
  return u;
}

/** Route-handler variant: returns null instead of issuing a page redirect. */
export async function requireApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

/** Route-handler role guard: returns null when unauthenticated or wrong role. */
export async function requireApiRole(role: string): Promise<SessionUser | null> {
  const u = await getSessionUser();
  return u && u.role === role ? u : null;
}

/** Route-handler admin guard. */
export async function requireApiAdmin(): Promise<SessionUser | null> {
  return requireApiRole("admin");
}

export async function requireRole(role: string): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== role) {
    if (u.role === "admin") redirect("/admin/dashboard");
    if (u.role === "instructor") redirect("/instructor/dashboard");
    redirect("/index.php");
  }
  return u;
}

/** Page guard for the admin area. Mirrors requireRole(ROLE_ADMIN) in every public/admin/*.php. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("admin");
}

export async function requireInstructorApproved(): Promise<SessionUser> {
  const u = await requireRole("instructor");
  const { sql } = await import("@/lib/db/client");
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM instructor_applications WHERE user_id = ${u.id} ORDER BY submitted_at DESC LIMIT 1
  `;
  if (rows.length === 0 || rows[0].status !== "approved") redirect("/instructor-register");
  return u;
}

/**
 * Route-handler counterpart of requireInstructorApproved: returns null instead of redirecting,
 * so an API can answer 401/403. The PHP let a pending instructor reach some instructor URLs;
 * that was the bug that let unapproved applicants mutate content, so the check is kept here.
 */
export async function requireApiInstructorApproved(): Promise<SessionUser | null> {
  const u = await getSessionUser();
  if (!u || u.role !== "instructor") return null;
  const { sql } = await import("@/lib/db/client");
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM instructor_applications WHERE user_id = ${u.id} ORDER BY submitted_at DESC LIMIT 1
  `;
  return rows.length > 0 && rows[0].status === "approved" ? u : null;
}
