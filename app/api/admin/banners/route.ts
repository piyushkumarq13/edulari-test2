import { NextResponse } from "next/server";
import { bannersPost } from "@/lib/api/admin/banners";

export const runtime = "nodejs";

/** POST /api/admin/banners — the JSON actions from public/admin/banners.php. */
export async function POST(req: Request): Promise<NextResponse> {
  return bannersPost(req);
}
