import { sql } from "@/lib/db/client";

export type UserRow = {
  id: number; name: string; email: string; role: string; email_verified: boolean; is_active: boolean; profile_completed: boolean;
  oauth_provider?: string | null; oauth_id?: string | null; avatar_url?: string | null;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`SELECT id, name, email, role, email_verified, is_active, profile_completed, oauth_provider, oauth_id, avatar_url FROM users WHERE email = ${email}`;
  return rows.length ? rows[0] : null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`SELECT id, name, email, role, email_verified, is_active, profile_completed, oauth_provider, oauth_id, avatar_url FROM users WHERE id = ${id}`;
  return rows.length ? rows[0] : null;
}

export async function markEmailVerified(userId: number): Promise<void> {
  await sql`UPDATE users SET email_verified = true WHERE id = ${userId}`;
}

export async function setBlocked(userId: number, reason: string, note?: string): Promise<void> {
  await sql`UPDATE users SET is_active = false, block_reason = ${reason}, block_note = ${note ?? null} WHERE id = ${userId}`;
}
