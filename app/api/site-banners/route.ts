import { NextResponse } from "next/server";
import { getActiveBanners } from "@/lib/banners";
import { getSessionFromRequest } from "@/lib/security/api";

export async function GET() {
  const user = await getSessionFromRequest();
  const banners = await getActiveBanners(user?.role ?? null);
  return NextResponse.json({ banners });
}
