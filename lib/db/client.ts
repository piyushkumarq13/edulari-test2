import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Do not throw at import time in build/lint contexts; surface a clear error when actually used.
  console.error("[db] DATABASE_URL is not set");
}

export const sql = postgres(databaseUrl ?? "postgres://invalid:invalid@localhost:5432/invalid", {
  prepare: false,
  max: 5,               // small pool for serverless
  idle_timeout: 20,     // close idle connections quickly
  connect_timeout: 10,
  onnotice: () => {},
});

export type SqlClient = typeof sql;

/** Run a function inside a transaction; committed on success, rolled back on error. */
export async function withTransaction<T>(
  fn: (tx: typeof sql) => Promise<T>,
): Promise<T> {
  try {
    return (await sql.begin(async (tx) => {
      return await fn(tx as unknown as typeof sql);
    })) as T;
  } catch (err) {
    // Log without leaking SQL parameters.
    console.error("[db] transaction failed:", err instanceof Error ? err.message : err);
    throw err;
  }
}

/** Safe log of a DB error without exposing parameters. */
export function logDbError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[db] ${context}: ${message}`);
}
