import { sql } from "@/lib/db/client";

/**
 * Data access for the admin System Settings page (port of public/admin/settings.php +
 * private/functions/admin.php getSystemSettings()). Values live in `app_settings`; the
 * runtime-only values (secrets, transaction pooler limits) stay in environment variables.
 */

const SETTING_KEYS = [
  "site_name",
  "site_url",
  "admin_email",
  "timezone",
  "currency_code",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "hash_cost",
  "session_lifetime",
  "razorpay_key_id",
  "active_ai_provider",
] as const;

export type AdminSettings = {
  siteName: string;
  siteUrl: string;
  adminEmail: string;
  timezone: string;
  currencyCode: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  hashCost: string;
  sessionLifetime: string;
  razorpayKeyId: string;
  activeAiProvider: string;
  /** Whether each secret is present in the environment (never the value itself). */
  smtpPasswordSet: boolean;
  openrouterKeySet: boolean;
  nvidiaKeySet: boolean;
  razorpaySecretSet: boolean;
};

function first(...values: Array<string | undefined>): string {
  for (const v of values) {
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const rows = await sql<{ setting_key: string; setting_value: string }[]>`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key IN ${sql(SETTING_KEYS as unknown as string[])}
  `;
  const db = new Map<string, string>();
  for (const r of rows) db.set(r.setting_key, r.setting_value);

  return {
    siteName: first(db.get("site_name"), process.env.SITE_NAME, "Edulari"),
    siteUrl: first(db.get("site_url"), process.env.NEXT_PUBLIC_SITE_URL),
    adminEmail: first(db.get("admin_email"), process.env.ADMIN_EMAIL),
    timezone: first(db.get("timezone"), process.env.APP_TIMEZONE, "UTC"),
    currencyCode: first(db.get("currency_code"), process.env.CURRENCY_CODE, "INR"),
    smtpHost: first(db.get("smtp_host"), process.env.SMTP_HOST),
    smtpPort: first(db.get("smtp_port"), process.env.SMTP_PORT, "587"),
    smtpUser: first(db.get("smtp_user"), process.env.SMTP_USERNAME, process.env.SMTP_USER),
    hashCost: first(db.get("hash_cost"), "12"),
    sessionLifetime: first(db.get("session_lifetime"), process.env.SESSION_LIFETIME, "86400"),
    razorpayKeyId: first(db.get("razorpay_key_id"), process.env.RAZORPAY_KEY_ID),
    activeAiProvider: first(db.get("active_ai_provider"), process.env.ACTIVE_AI_PROVIDER, "openrouter"),
    smtpPasswordSet: Boolean(process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS),
    openrouterKeySet: Boolean(process.env.OPENROUTER_API_KEY),
    nvidiaKeySet: Boolean(process.env.NVIDIA_KIMI_API_KEY),
    razorpaySecretSet: Boolean(process.env.RAZORPAY_KEY_SECRET),
  };
}

/** saveSettings() persistence step: key/value pairs into app_settings. */
export async function saveSettingsValues(entries: Record<string, string | number>): Promise<void> {
  const pairs = Object.entries(entries);
  await Promise.all(
    pairs.map(([key, value]) =>
      sql`
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES (${key}, ${String(value)})
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()
      `,
    ),
  );
}

async function listBaseTables(): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;
  return rows.map((r) => r.table_name);
}

export type TableCount = { table: string; count: number };

/** Load-time table list + row counts for the Database tab (PHP @while table list + COUNT). */
export async function getTableCounts(): Promise<{ tables: string[]; counts: TableCount[] }> {
  const tables = await listBaseTables();
  const counts = await Promise.all(
    tables.map(async (table) => {
      try {
        const r = await sql<{ cnt: number }[]>`SELECT COUNT(*)::int AS cnt FROM ${sql(table)}`;
        return { table, count: r[0]?.cnt ?? 0 };
      } catch {
        return { table, count: 0 };
      }
    }),
  );
  return { tables, counts };
}

export type DbHealthRow = {
  table: string;
  count: number | null;
  size_kb: number | null;
  status: "ok" | "error";
};

/** db_health action: per-table count + on-disk size (pg_total_relation_size). */
export async function getDbHealth(): Promise<{ allOk: boolean; tables: DbHealthRow[] }> {
  const names = await listBaseTables();
  let allOk = true;
  const tables = await Promise.all(
    names.map(async (table): Promise<DbHealthRow> => {
      try {
        const r = await sql<{ cnt: number; size_kb: number }[]>`
          SELECT
            (SELECT COUNT(*) FROM ${sql(table)})::int AS cnt,
            ROUND(pg_total_relation_size(${table}::regclass) / 1024.0, 1)::float8 AS size_kb
        `;
        return { table, count: r[0]?.cnt ?? 0, size_kb: r[0]?.size_kb ?? null, status: "ok" };
      } catch {
        allOk = false;
        return { table, count: null, size_kb: null, status: "error" };
      }
    }),
  );
  return { allOk, tables };
}

export async function getDbVersion(): Promise<string> {
  try {
    const r = await sql<{ v: string }[]>`SELECT version() AS v`;
    return r[0]?.v ?? "N/A";
  } catch {
    return "N/A";
  }
}
