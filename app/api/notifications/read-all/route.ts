import { NextResponse } from "next/server";
import { markAllRead } from "@/lib/notifications";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const user = await getSessionFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
