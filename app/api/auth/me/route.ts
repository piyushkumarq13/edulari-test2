import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/security/api";

export async function GET() {
  const user = await getSessionFromRequest();
  if (!user) return NextResponse.json({ role: "guest" }, { status: 200 });
  return NextResponse.json(user);
}
