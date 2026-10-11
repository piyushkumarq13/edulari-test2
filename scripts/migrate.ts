import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

// Load .env.local if present (tsx does not auto-load it like Next does).
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

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function main() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.error("DIRECT_URL is not set. Add it to .env.local and retry.");
    process.exit(1);
  }

  const sql = postgres(directUrl, { prepare: false, max: 1 });

  try {
    // Ensure bookkeeping table exists (created by 001 too, but create early).
    await sql`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        filename   text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const appliedRows = await sql<{ filename: string }[]>`
      SELECT filename FROM public.schema_migrations
    `;
    const applied = new Set(appliedRows.map((r) => r.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("No pending migrations. Database is up to date.");
      return;
    }

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const contents = fs.readFileSync(filePath, "utf8");
      process.stdout.write(`Applying ${file} ... `);
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(contents);
          await tx`INSERT INTO public.schema_migrations (filename) VALUES (${file})`;
        });
        console.log("ok");
      } catch (err) {
        console.log("FAILED");
        console.error(err instanceof Error ? err.message : err);
        process.exitCode = 1;
        return;
      }
    }
    console.log("All pending migrations applied.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
