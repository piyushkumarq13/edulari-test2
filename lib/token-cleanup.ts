import { sql } from "@/lib/db/client";

const THROTTLE_MS = 21600 * 1000; // 6 hours

export async function cleanupExpiredTokens(force = false): Promise<Record<string, number>> {
  const now = Date.now();
  const state = await sql<{ last_run: Date | null }[]>`SELECT last_run FROM cron_state WHERE key = 'token_cleanup'`;
  const last = state.length > 0 && state[0].last_run ? new Date(state[0].last_run).getTime() : 0;
  if (!force && now - last < THROTTLE_MS) return {};

  // Seed/refresh the cron_state row.
  await sql`
    INSERT INTO cron_state (key, last_run) VALUES ('token_cleanup', now())
    ON CONFLICT (key) DO UPDATE SET last_run = now()
  `;

  const deleted: Record<string, number> = {};

  // test_tokens: expired or used
  let r = (await sql`DELETE FROM test_tokens WHERE expires_at < now() OR used = true`) as unknown as { count?: number };
  deleted["test_tokens"] = r.count ?? 0;

  r = (await sql`DELETE FROM test_failures WHERE retry_after < now()`) as unknown as { count?: number };
  deleted["test_failures"] = r.count ?? 0;

  r = (await sql`DELETE FROM email_verification_tokens WHERE expires_at < now()`) as unknown as { count?: number };
  deleted["email_verification_tokens"] = r.count ?? 0;

  r = (await sql`DELETE FROM password_resets WHERE expires_at < now()`) as unknown as { count?: number };
  deleted["password_resets"] = r.count ?? 0;

  r = (await sql`
    DELETE FROM login_attempts
    WHERE (block_expires IS NOT NULL AND block_expires < now())
       OR (is_blocked = false AND last_attempt < now() - interval '30 days')
  `) as unknown as { count?: number };
  deleted["login_attempts"] = r.count ?? 0;

  return deleted;
}
