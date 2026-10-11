import { NextResponse } from "next/server";
import { runInstructorMaintenance } from "@/lib/instructor/maintenance";
import { cleanupExpiredTestTokens } from "@/lib/instructor/test-tokens";

export const dynamic = "force-dynamic";

/**
 * Instructor-registration maintenance: stale draft documents (30 min throttle) and the
 * rejected/test_failed purge (5 h throttle), plus the expired test-token cleanup.
 * Protected by CRON_SECRET, mirroring the other cron routes.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const docs = await runInstructorMaintenance();
  const tokens = await cleanupExpiredTestTokens();
  return NextResponse.json({ ok: true, purged: docs, tokens });
}
