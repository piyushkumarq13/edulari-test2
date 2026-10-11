/**
 * scripts/ui-compare/seed-compare-admin.mjs
 *
 * The ui-compare harness renders authenticated pages with COMPARE_EMAIL/PASSWORD, which is
 * the seeded STUDENT. The /admin/** pages sit behind requireAdmin(), so `--site new` would
 * follow the login redirect and silently capture the wrong page. This helper creates a
 * throwaway ADMIN on the new site's database and records its credentials in the git-ignored
 * scripts/ui-compare/.env.compare (keys COMPARE_ADMIN_EMAIL / COMPARE_ADMIN_PASSWORD).
 *
 * The generated password is written only to that file and is never printed to stdout.
 *
 *   node scripts/ui-compare/seed-compare-admin.mjs setup      # create the temp admin
 *   node scripts/ui-compare/seed-compare-admin.mjs teardown   # delete it again
 *
 * `setup` also prints (non-secret) row counts for the admin detail pages so the harness can
 * be pointed at real ids, and the id of the temp admin for /admin/user-detail.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_COMPARE = path.join(ROOT, "scripts", "ui-compare", ".env.compare");

const ADMIN_EMAIL = "ui-compare-admin@edulari.test";
const ADMIN_NAME = "UI Compare Admin";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Set the given keys in a key=value env file, preserving everything else. */
function upsertEnv(file, pairs) {
  const keys = new Set(Object.keys(pairs));
  const kept = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l);
        return !(m && keys.has(m[1]));
      })
    : [];
  while (kept.length && kept[kept.length - 1].trim() === "") kept.pop();
  for (const [k, v] of Object.entries(pairs)) kept.push(`${k}=${v}`);
  fs.writeFileSync(file, kept.join("\n") + "\n", "utf8");
}

function removeEnvKeys(file, keys) {
  if (!fs.existsSync(file)) return;
  const set = new Set(keys);
  const kept = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l);
    return !(m && set.has(m[1]));
  });
  fs.writeFileSync(file, kept.join("\n"), "utf8");
}

const cmd = process.argv[2];
const env = loadEnv(ENV_LOCAL);
const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_URL / DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });

try {
  if (cmd === "setup") {
    const password = crypto.randomBytes(24).toString("base64url") + "Aa1!";
    const hash = await bcrypt.hash(password, 10);

    const existing = await sql`SELECT id FROM public.users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;
    let adminId;
    if (existing.length) {
      const rows = await sql`
        UPDATE public.users
        SET password = ${hash}, role = 'admin', is_active = true, email_verified = true,
            profile_completed = true, block_reason = NULL, block_note = NULL
        WHERE email = ${ADMIN_EMAIL}
        RETURNING id`;
      adminId = rows[0].id;
    } else {
      const rows = await sql`
        INSERT INTO public.users (name, email, password, role, email_verified, is_active, profile_completed, registration_date)
        VALUES (${ADMIN_NAME}, ${ADMIN_EMAIL}, ${hash}, 'admin', true, true, true, now())
        RETURNING id`;
      adminId = rows[0].id;
    }

    upsertEnv(ENV_COMPARE, { COMPARE_ADMIN_EMAIL: ADMIN_EMAIL, COMPARE_ADMIN_PASSWORD: password });

    const counts = {};
    const sampleIds = {};
    for (const t of ["bug_reports", "contact_submissions", "instructor_applications", "courses"]) {
      try {
        const r = await sql`SELECT count(*)::int AS n FROM public.${sql(t)}`;
        counts[t] = r[0].n;
        const s = await sql`SELECT id FROM public.${sql(t)} ORDER BY id LIMIT 1`;
        sampleIds[t] = s[0]?.id ?? null;
      } catch {
        counts[t] = null;
        sampleIds[t] = null;
      }
    }
    console.log(JSON.stringify({ ok: true, adminId, counts, sampleIds, wroteEnv: "scripts/ui-compare/.env.compare" }));
  } else if (cmd === "teardown") {
    await sql`DELETE FROM public.users WHERE email = ${ADMIN_EMAIL}`;
    removeEnvKeys(ENV_COMPARE, ["COMPARE_ADMIN_EMAIL", "COMPARE_ADMIN_PASSWORD"]);
    console.log(JSON.stringify({ ok: true, removed: ADMIN_EMAIL }));
  } else {
    console.error("usage: node scripts/ui-compare/seed-compare-admin.mjs setup|teardown");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
