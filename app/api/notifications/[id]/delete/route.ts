import { NextResponse } from "next/server";
import { softDelete } from "@/lib/notifications";
import { getSessionFromRequest, isSameOriginPost } from "@/lib/security/api";


export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOriginPost(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await getSessionFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await softDelete(user.id, Number(id));
  return NextResponse.json({ ok: true });
}

export const DELETE = POST;
