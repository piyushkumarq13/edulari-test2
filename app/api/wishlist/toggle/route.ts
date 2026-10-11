import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { addToWishlist, isInWishlist, removeFromWishlist } from "@/lib/db/enrollments";

const schema = z.object({ course_id: z.coerce.number().int().positive() });

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  if (user.role === "instructor") {
    return NextResponse.json({ success: false, error: "As an instructor, you cannot enroll in or wishlist courses." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid course." }, { status: 400 });

  const wasIn = await isInWishlist(user.id, parsed.data.course_id);
  if (wasIn) await removeFromWishlist(user.id, parsed.data.course_id);
  else await addToWishlist(user.id, parsed.data.course_id, user.role === "instructor");

  return NextResponse.json({ success: true, in_wishlist: !wasIn });
}
