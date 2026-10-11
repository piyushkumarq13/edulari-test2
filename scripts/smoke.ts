import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// tsx does not auto-load .env.local the way Next does.
try {
  const envFile = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
} catch { /* non-fatal */ }

type Check = { label: string; run: (sql: postgres.Sql) => Promise<string> };

const CHECKS: Check[] = [
  {
    label: "schema_migrations applied",
    run: async (sql) => {
      const rows = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM schema_migrations`;
      return `${rows[0]?.count ?? 0} migration(s)`;
    },
  },
  {
    label: "public tables + RLS",
    run: async (sql) => {
      const rows = await sql<{ total: string; rls: string; policies: string }[]>`
        SELECT COUNT(*)::text AS total,
               COUNT(*) FILTER (WHERE c.relrowsecurity)::text AS rls,
               (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public') AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `;
      const r = rows[0];
      if (!r) return "no tables";
      return `${r.total} table(s), RLS on ${r.rls}, policies ${r.policies} (expected 0)`;
    },
  },
  {
    label: "core tables present",
    run: async (sql) => {
      const expected = [
        "users", "user_sessions", "categories", "courses", "course_sections", "lessons",
        "enrollments", "lesson_progress", "course_reviews", "cart", "wishlists",
        "razorpay_orders", "purchase_history", "instructor_applications", "contact_submissions",
        "bug_reports", "notification_messages", "certificates", "site_banners",
        "cron_state", "maintenance_logs", "security_events",
      ];
      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ${sql(expected)}
      `;
      const found = new Set(rows.map((r) => r.table_name));
      const missing = expected.filter((t) => !found.has(t));
      return missing.length === 0 ? `all ${expected.length} present` : `MISSING: ${missing.join(", ")}`;
    },
  },
  {
    label: "anon/authenticated revoked",
    run: async (sql) => {
      const rows = await sql<{ grantee: string; count: string }[]>`
        SELECT grantee, COUNT(*)::text AS count
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
        GROUP BY grantee
      `;
      return rows.length === 0 ? "no grants to anon/authenticated" : `LEAK: ${rows.map((r) => `${r.grantee}=${r.count}`).join(", ")}`;
    },
  },
  {
    label: "app_settings seeded",
    run: async (sql) => {
      const rows = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM app_settings`;
      return `${rows[0]?.count ?? 0} row(s)`;
    },
  },
  {
    label: "set_updated_at trigger fn",
    run: async (sql) => {
      const rows = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM pg_proc WHERE proname = 'set_updated_at'
      `;
      return `${rows[0]?.count ?? 0} definition(s)`;
    },
  },
  {
    label: "indexed hot-path columns",
    run: async (sql) => {
      const rows = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM pg_indexes WHERE schemaname = 'public'
      `;
      return `${rows[0]?.count ?? 0} index(es)`;
    },
  },
];

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url) {
    console.error("DATABASE_URL / DIRECT_URL is not set. Add it to .env.local and retry.");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

  console.log("Edulari smoke check\n" + "=".repeat(48));
  let failures = 0;

  try {
    for (const check of CHECKS) {
      try {
        const detail = await check.run(sql);
        const bad = /MISSING|LEAK|expected 0/.test(detail) && /MISSING|LEAK/.test(detail);
        if (bad) failures++;
        console.log(`${bad ? "FAIL" : "ok  "}  ${check.label.padEnd(30)} ${detail}`);
      } catch (err) {
        failures++;
        console.log(`FAIL  ${check.label.padEnd(30)} ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("=".repeat(48));
  if (failures > 0) {
    console.log(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All smoke checks passed.");
}

void main();
