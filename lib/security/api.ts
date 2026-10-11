import { cookies } from "next/headers";
import { validateSession, type SessionUser } from "@/lib/auth/sessions";
import { originMatchesHost } from "@/lib/security/csrf";

export async function getSessionFromRequest(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.SESSION_COOKIE_NAME ?? "edulari_session")?.value ?? null;
  if (!token) return null;
  return validateSession(token);
}

export function isSameOriginPost(req: Request): boolean {
  return originMatchesHost(req.headers.get("origin"), req.headers.get("host"));
}

/** Session + role guard for admin mutation routes. */
export async function getAdminFromRequest(): Promise<SessionUser | null> {
  const user = await getSessionFromRequest();
  return user && user.role === "admin" ? user : null;
}

/**
 * Session + role + instructor-approval guard for instructor mutation routes.
 * The pages already call requireInstructorApproved, but the PHP API handlers only checked the
 * role, so a pending or rejected applicant could still POST directly. This closes that gap.
 */
export async function getApprovedInstructorFromRequest(): Promise<SessionUser | null> {
  const user = await getSessionFromRequest();
  if (!user || user.role !== "instructor") return null;
  const { sql } = await import("@/lib/db/client");
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM instructor_applications WHERE user_id = ${user.id}
    ORDER BY submitted_at DESC LIMIT 1
  `;
  return rows.length > 0 && rows[0].status === "approved" ? user : null;
}
