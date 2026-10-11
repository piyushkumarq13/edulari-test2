import crypto from "node:crypto";
import { sql } from "@/lib/db/client";

const VERIFY_MINS = 30;
const RESET_MINS = 60;

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function issueEmailVerificationToken(userId: number): Promise<string> {
  await sql`DELETE FROM email_verification_tokens WHERE expires_at < now()`;
  const token = makeToken();
  const expires = new Date(Date.now() + VERIFY_MINS * 60 * 1000);
  // Upsert (user_id unique).
  await sql`
    INSERT INTO email_verification_tokens (user_id, source_table, token, expires_at, created_at)
    VALUES (${userId}, 'users', ${token}, ${expires}, now())
    ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
  `;
  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<{ ok: boolean; userId?: number }> {
  const rows = await sql<{ user_id: number; expires_at: Date }[]>`
    SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ${token}
  `;
  if (rows.length === 0) return { ok: false };
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    await sql`DELETE FROM email_verification_tokens WHERE token = ${token}`;
    return { ok: false };
  }
  await sql`UPDATE users SET email_verified = true WHERE id = ${rows[0].user_id}`;
  await sql`DELETE FROM email_verification_tokens WHERE token = ${token}`;
  return { ok: true, userId: rows[0].user_id };
}

export async function issuePasswordResetToken(userId: number): Promise<string> {
  const token = makeToken();
  const expires = new Date(Date.now() + RESET_MINS * 60 * 1000);
  const rows = await sql`SELECT id FROM password_resets WHERE user_id = ${userId}`;
  if (rows.length > 0) {
    await sql`UPDATE password_resets SET token = ${token}, expires_at = ${expires} WHERE user_id = ${userId}`;
  } else {
    await sql`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${userId}, ${token}, ${expires})`;
  }
  return token;
}

export async function verifyPasswordResetToken(token: string): Promise<{ userId: number; name: string; email: string } | null> {
  await sql`DELETE FROM password_resets WHERE expires_at < now()`;
  const rows = await sql<{ user_id: number; name: string; email: string; expires_at: Date }[]>`
    SELECT pr.user_id, u.name, u.email, pr.expires_at
    FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE pr.token = ${token}
  `;
  if (rows.length === 0) return null;
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    await sql`DELETE FROM password_resets WHERE token = ${token}`;
    return null;
  }
  return { userId: rows[0].user_id, name: rows[0].name, email: rows[0].email };
}

export async function consumePasswordResetToken(token: string): Promise<void> {
  await sql`DELETE FROM password_resets WHERE token = ${token}`;
}

export async function enterRecoveryMode(userId: number): Promise<void> {
  await sql`UPDATE users SET is_recovery_mode = true WHERE id = ${userId}`;
}
export async function exitRecoveryMode(userId: number): Promise<void> {
  await sql`UPDATE users SET is_recovery_mode = false WHERE id = ${userId}`;
}
export async function isInRecoveryMode(userId: number): Promise<boolean> {
  const rows = await sql<{ is_recovery_mode: boolean }[]>`SELECT is_recovery_mode FROM users WHERE id = ${userId}`;
  return rows.length > 0 && rows[0].is_recovery_mode === true;
}
