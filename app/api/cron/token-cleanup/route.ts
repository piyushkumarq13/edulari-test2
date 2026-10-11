import { NextResponse } from "next/server";
import { cleanupExpiredTokens } from "@/lib/token-cleanup";


export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const deleted = await cleanupExpiredTokens(force);
  return NextResponse.json({ ok: true, deleted });
}
