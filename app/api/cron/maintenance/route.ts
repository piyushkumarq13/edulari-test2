import { NextResponse } from "next/server";
import { autoDisableMaintenance } from "@/lib/maintenance";


export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await autoDisableMaintenance();
  return NextResponse.json({ ok: true, ...result });
}
