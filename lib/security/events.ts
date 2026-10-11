import { sql } from "@/lib/db/client";

export async function logSecurity(event: string, context: Record<string, unknown> = {}, req?: Request): Promise<void> {
  const ip = req ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown") : context.ip as string | undefined;
  const userId = (context.user_id as number | undefined) ?? null;
  try {
    await sql`INSERT INTO security_events (event, context, ip_address, user_id) VALUES (${event}, ${JSON.stringify(context)}::jsonb, ${ip ?? null}, ${userId})`;
  } catch (e) {
    // Never let logging crash the request.
    console.error("[security_events]", event, e);
  }
  console.info("[security]", event, JSON.stringify(context));
}
