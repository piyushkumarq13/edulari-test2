import { NextResponse } from "next/server";
import { notificationsPost } from "@/lib/api/admin/notifications";

export const runtime = "nodejs";

/** POST /api/admin/notifications — send-notifications.php's form (PRG, 303 back to the page). */
export async function POST(req: Request): Promise<NextResponse> {
  return notificationsPost(req);
}
