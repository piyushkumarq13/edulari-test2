import crypto from "node:crypto";
import { sql } from "@/lib/db/client";

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Mirrors getCurrentUser() in private/auth.php, which also exposes profile_image. */
export type SessionUser = { id: number; email: string; role: string; name: string; profile_image: string | null };

export async function createSession(userId: number, ip: string, deviceInfo: string): Promise<string> {
  const token = createSessionToken();
  // Kick all previous active sessions for this user.
  await sql`UPDATE user_sessions SET is_active = false, kicked_reason = 'new_login' WHERE user_id = ${userId} AND is_active = true`;
  // Enforce rolling-5 window: keep newest 5 active sessions for this user.
  await sql`
    UPDATE user_sessions SET is_active = false, kicked_reason = 'session_limit'
    WHERE id IN (
      SELECT id FROM user_sessions
      WHERE user_id = ${userId} AND is_active = true
      ORDER BY created_at DESC OFFSET 5
    )
  `;
  await sql`
    INSERT INTO user_sessions (user_id, session_token, ip_address, device_info, created_at, last_active, is_active)
    VALUES (${userId}, ${hashSessionToken(token)}, ${ip}, ${deviceInfo}, now(), now(), true)
  `;
  return token;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  const hashed = hashSessionToken(token);
  const rows = await sql<{ id: number; user_id: number; created_at: Date | null; is_active: boolean; kicked_reason: string | null; expires_at: Date | null }[]>`
    SELECT id, user_id, created_at, is_active, kicked_reason, expires_at FROM user_sessions
    WHERE session_token = ${hashed} AND is_active = true
  `;
  if (rows.length === 0) return null;
  const sess = rows[0];
  if (sess.expires_at && new Date(sess.expires_at).getTime() < Date.now()) {
    await sql`UPDATE user_sessions SET is_active = false, kicked_reason = 'session_expired' WHERE id = ${sess.id}`;
    return null;
  }
  await sql`UPDATE user_sessions SET last_active = now() WHERE id = ${sess.id}`;
  // Live account + password_changed_at invalidation.
  const users = await sql<{ id: number; name: string; email: string; role: string; is_active: boolean; email_verified: boolean; password_changed_at: Date | null; profile_image: string | null }[]>`
    SELECT id, name, email, role, is_active, email_verified, password_changed_at, profile_image FROM users WHERE id = ${sess.user_id}
  `;
  if (users.length === 0) return null;
  const u = users[0];
  if (!u.is_active || !u.email_verified) {
    await sql`UPDATE user_sessions SET is_active = false, kicked_reason = 'account_blocked' WHERE id = ${sess.id}`;
    return null;
  }
  if (u.password_changed_at && sess.created_at && new Date(sess.created_at) < new Date(u.password_changed_at)) {
    await sql`UPDATE user_sessions SET is_active = false, kicked_reason = 'password_changed' WHERE id = ${sess.id}`;
    return null;
  }
  return { id: u.id, email: u.email, role: u.role, name: u.name, profile_image: u.profile_image };
}

export async function revokeSession(token: string, reason = "manual_logout"): Promise<void> {
  await sql`UPDATE user_sessions SET is_active = false, kicked_reason = ${reason} WHERE session_token = ${hashSessionToken(token)} AND is_active = true`;
}

export async function revokeAllForUser(userId: number, reason = "manual_logout"): Promise<void> {
  await sql`UPDATE user_sessions SET is_active = false, kicked_reason = ${reason} WHERE user_id = ${userId} AND is_active = true`;
}

export async function kickSessionById(sessionId: number, reason: string): Promise<void> {
  await sql`UPDATE user_sessions SET is_active = false, kicked_reason = ${reason} WHERE id = ${sessionId}`;
}

/** Kick every session except the caller's; mirrors logoutAllOtherSessions(). */
export async function revokeAllOtherSessions(userId: number, currentToken: string): Promise<boolean> {
  const res = await sql`
    UPDATE user_sessions SET is_active = false, kicked_reason = 'manual_logout'
    WHERE user_id = ${userId} AND session_token != ${hashSessionToken(currentToken)} AND is_active = true
  `;
  return res.count > 0;
}

/** Kick one session only if it belongs to this user. */
export async function revokeSessionById(sessionId: number, userId: number): Promise<boolean> {
  const res = await sql`
    UPDATE user_sessions SET is_active = false, kicked_reason = 'manual_logout'
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;
  return res.count > 0;
}

/**
 * Password change: issue a fresh session so the current device stays signed in,
 * while every other session is invalidated by createSession().
 */
export async function regenerateSessionOnPasswordChange(userId: number, ip: string, deviceInfo: string): Promise<string> {
  return createSession(userId, ip, deviceInfo);
}
