import { NextResponse } from "next/server";
import { markRead } from "@/lib/notifications";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";


export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOriginPost(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const user = await getSessionFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await markRead(user.id, Number(id));
  return NextResponse.json({ ok: true });
}
