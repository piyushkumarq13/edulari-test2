import { NextResponse } from "next/server";
import { listForUser, unreadCount } from "@/lib/notifications";
import { getSessionFromRequest } from "@/lib/security/api";


export async function GET(req: Request) {
  const user = await getSessionFromRequest();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20") || 20, 50);
  const offset = Number(url.searchParams.get("offset") ?? "0") || 0;
  const [items, count] = await Promise.all([listForUser(user.id, limit, offset), unreadCount(user.id)]);
  return NextResponse.json({ notifications: items, unreadCount: count });
}
