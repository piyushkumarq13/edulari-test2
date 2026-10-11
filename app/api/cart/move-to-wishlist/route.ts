import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { moveToWishlist } from "@/lib/db/enrollments";
import { encodeFlash, flashCookieOptions, FLASH_COOKIE } from "@/lib/payments/flash";

const schema = z.object({ course_id: z.coerce.number().int().positive() });

/** Port of the cart.php "Move to Wishlist" action. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  if (user.role === "instructor") {
    return NextResponse.json({ success: false, error: "Instructors cannot access the cart." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid course." }, { status: 400 });

  await moveToWishlist(user.id, parsed.data.course_id);

  const jar = await cookies();
  jar.set(FLASH_COOKIE, encodeFlash({ msg: "Course saved to your wishlist.", type: "success" }), flashCookieOptions());

  return NextResponse.json({ success: true, redirect: "/cart" });
}
