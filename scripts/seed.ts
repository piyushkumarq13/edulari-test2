import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

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
} catch {}

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.error("DIRECT_URL is not set in .env.local");
    process.exit(1);
  }
  const sql = postgres(directUrl, { prepare: false, max: 1 });
  try {
    // Default app_settings rows used by the PHP cron markers (now stored in DB).
    const rows: Array<[string, string]> = [
      ["last_payment_reconcile_run", "0"],
      ["last_cleanup_run", "0"],
    ];
    for (const [key, value] of rows) {
      await sql`
        INSERT INTO public.app_settings (setting_key, setting_value)
        VALUES (${key}, ${value})
        ON CONFLICT (setting_key) DO NOTHING
      `;
    }
    console.log("Seeded default app_settings rows.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
