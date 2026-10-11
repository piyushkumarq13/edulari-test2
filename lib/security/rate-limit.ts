import { sql } from "@/lib/db/client";

const LOGIN_MAX = 5;
const LOGIN_BLOCK_SECONDS = 7200; // 2h
const REG_MAX = 5;
const REG_WINDOW_SECONDS = 86400; // 24h
const REG_BLOCK_SECONDS = 86400;
const RESET_MAX = 3;
const RESET_WINDOW_SECONDS = 600; // 10min
const RECOVERY_MAX = 5;
const RECOVERY_BLOCK_SECONDS = 7200;

export function formatTimeRemaining(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
  if (m > 0) return `${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}`;
  return `${s} second${s === 1 ? "" : "s"}`;
}

// Pure predicates (exported for unit testing and reuse).
export function shouldBlockLogin(attemptCount: number): boolean {
  return attemptCount >= LOGIN_MAX;
}

export function shouldBlockRegistration(attemptCount: number, firstAttemptMs: number, nowMs: number): boolean {
  const withinWindow = firstAttemptMs >= nowMs - REG_WINDOW_SECONDS * 1000;
  return withinWindow && attemptCount >= REG_MAX;
}

export function shouldLimitPasswordReset(attemptCount: number): boolean {
  return attemptCount >= RESET_MAX;
}

// ---------- login_attempts ----------
export async function checkLoginBlock(email: string, ip: string): Promise<{ blocked: boolean; time_remaining?: number; readable_time?: string }> {
  for (const [identifier, type] of [[email, "email"], [ip, "ip"]] as Array<[string, "email" | "ip"]>) {
    const rows = await sql<{ id: number; is_blocked: boolean; block_expires: Date | null }[]>`
      SELECT id, is_blocked, block_expires FROM login_attempts WHERE identifier = ${identifier} AND type = ${type} AND is_blocked = true
    `;
    if (rows.length === 0) continue;
    const row = rows[0];
    const expires = row.block_expires ? new Date(row.block_expires).getTime() : 0;
    if (expires > Date.now()) {
      const remaining = Math.floor((expires - Date.now()) / 1000);
      return { blocked: true, time_remaining: remaining, readable_time: formatTimeRemaining(remaining) };
    }
    await sql`UPDATE login_attempts SET is_blocked = false, attempt_count = 0 WHERE id = ${row.id}`;
  }
  return { blocked: false };
}

export async function recordFailedLoginAttempt(email: string, ip: string): Promise<void> {
  for (const [identifier, type] of [[email, "email"], [ip, "ip"]] as Array<[string, "email" | "ip"]>) {
    const rows = await sql<{ id: number; attempt_count: number }[]>`
      SELECT id, attempt_count FROM login_attempts WHERE identifier = ${identifier} AND type = ${type}
    `;
    if (rows.length > 0) {
      const next = (rows[0].attempt_count ?? 0) + 1;
      const blocked = next >= LOGIN_MAX;
      const blockExpires = blocked ? new Date(Date.now() + LOGIN_BLOCK_SECONDS * 1000) : null;
      await sql`UPDATE login_attempts SET attempt_count = ${next}, last_attempt = now(), is_blocked = ${blocked}, block_expires = ${blockExpires} WHERE id = ${rows[0].id}`;
    } else {
      await sql`INSERT INTO login_attempts (identifier, type, attempt_count, last_attempt, is_blocked) VALUES (${identifier}, ${type}, 1, now(), false)`;
    }
  }
}

export async function resetLoginAttempts(email: string, ip: string): Promise<void> {
  await sql`UPDATE login_attempts SET attempt_count = 0, is_blocked = false, block_expires = null WHERE identifier = ${email} AND type = 'email'`;
  await sql`UPDATE login_attempts SET attempt_count = 0, is_blocked = false, block_expires = null WHERE identifier = ${ip} AND type = 'ip'`;
}

// ---------- registration_blocks ----------
export async function checkRegistrationBlock(ip: string): Promise<{ blocked: boolean; time_remaining?: number; readable_time?: string }> {
  const rows = await sql<{ is_blocked: boolean; block_expires: Date | null }[]>`
    SELECT is_blocked, block_expires FROM registration_blocks WHERE ip_address = ${ip}
  `;
  if (rows.length === 0) return { blocked: false };
  const row = rows[0];
  if (row.is_blocked) {
    const expires = row.block_expires ? new Date(row.block_expires).getTime() : 0;
    if (expires > Date.now()) {
      const remaining = Math.floor((expires - Date.now()) / 1000);
      return { blocked: true, time_remaining: remaining, readable_time: formatTimeRemaining(remaining) };
    }
    await sql`UPDATE registration_blocks SET is_blocked = false, attempt_count = 0, block_expires = null WHERE ip_address = ${ip}`;
  }
  return { blocked: false };
}

export async function recordRegistrationAttempt(ip: string): Promise<void> {
  // Clean expired blocks first.
  await sql`DELETE FROM registration_blocks WHERE is_blocked = true AND block_expires < now()`;
  const rows = await sql<{ attempt_count: number; first_attempt: Date }[]>`
    SELECT attempt_count, first_attempt FROM registration_blocks WHERE ip_address = ${ip}
  `;
  if (rows.length > 0) {
    const first = new Date(rows[0].first_attempt).getTime();
    const windowStart = Date.now() - REG_WINDOW_SECONDS * 1000;
    if (first < windowStart) {
      await sql`UPDATE registration_blocks SET attempt_count = 1, first_attempt = now(), is_blocked = false, block_expires = null WHERE ip_address = ${ip}`;
    } else {
      const next = rows[0].attempt_count + 1;
      const blocked = next >= REG_MAX;
      const blockExpires = blocked ? new Date(Date.now() + REG_BLOCK_SECONDS * 1000) : null;
      await sql`UPDATE registration_blocks SET attempt_count = ${next}, is_blocked = ${blocked}, block_expires = ${blockExpires} WHERE ip_address = ${ip}`;
    }
  } else {
    await sql`INSERT INTO registration_blocks (ip_address, attempt_count, first_attempt, is_blocked) VALUES (${ip}, 1, now(), false)`;
  }
}

// ---------- password_reset_attempts ----------
export async function checkPasswordResetRateLimit(email: string, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RESET_WINDOW_SECONDS * 1000);
  const emailCount = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM password_reset_attempts WHERE identifier = ${email} AND type = 'email' AND attempt_at > ${windowStart}
  `;
  if (Number(emailCount[0].cnt) >= RESET_MAX) return true;
  const ipCount = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM password_reset_attempts WHERE identifier = ${ip} AND type = 'ip' AND attempt_at > ${windowStart}
  `;
  return Number(ipCount[0].cnt) >= RESET_MAX;
}

export async function recordPasswordResetAttempt(email: string, ip: string): Promise<void> {
  await sql`INSERT INTO password_reset_attempts (identifier, type) VALUES (${email}, 'email')`;
  await sql`INSERT INTO password_reset_attempts (identifier, type) VALUES (${ip}, 'ip')`;
}

// ---------- account_recovery_attempts ----------
export async function checkAccountRecoveryBlock(ip: string): Promise<{ blocked: boolean; time_remaining?: number }> {
  const rows = await sql<{ is_blocked: boolean; block_expires: Date | null }[]>`
    SELECT is_blocked, block_expires FROM account_recovery_attempts WHERE ip_address = ${ip}
  `;
  if (rows.length === 0) return { blocked: false };
  const row = rows[0];
  if (row.is_blocked) {
    const expires = row.block_expires ? new Date(row.block_expires).getTime() : 0;
    if (expires > Date.now()) {
      return { blocked: true, time_remaining: Math.floor((expires - Date.now()) / 1000) };
    }
    await sql`UPDATE account_recovery_attempts SET is_blocked = false, attempt_count = 0 WHERE ip_address = ${ip}`;
  }
  return { blocked: false };
}

export async function recordAccountRecoveryAttempt(ip: string): Promise<void> {
  const rows = await sql<{ attempt_count: number }[]>`
    SELECT attempt_count FROM account_recovery_attempts WHERE ip_address = ${ip}
  `;
  if (rows.length > 0) {
    const next = (rows[0].attempt_count ?? 0) + 1;
    const blocked = next >= RECOVERY_MAX;
    const blockExpires = blocked ? new Date(Date.now() + RECOVERY_BLOCK_SECONDS * 1000) : null;
    await sql`UPDATE account_recovery_attempts SET attempt_count = ${next}, is_blocked = ${blocked}, block_expires = ${blockExpires}, updated_at = now() WHERE ip_address = ${ip}`;
  } else {
    await sql`INSERT INTO account_recovery_attempts (ip_address, attempt_count, is_blocked) VALUES (${ip}, 1, false)`;
  }
}
