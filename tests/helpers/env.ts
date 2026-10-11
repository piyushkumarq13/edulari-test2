import fs from "node:fs";
import path from "node:path";

/**
 * Test environment bootstrap. lib/config.ts validates the environment when it is first
 * imported, so the values have to exist before any module under test is loaded — hence a
 * plain side-effect import at the top of the test files.
 *
 * Real .env.local values are used when present so DB-backed tests can connect; anything
 * missing falls back to a placeholder that only satisfies the schema.
 */
for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

process.env.DATA_ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL ??= "postgres://invalid:invalid@localhost:5432/invalid";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789";
process.env.CSRF_SECRET ??= "test-csrf-secret-0123456789";

export {};