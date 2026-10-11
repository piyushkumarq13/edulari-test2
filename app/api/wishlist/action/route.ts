import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { removeFromWishlist, wishlistAddToCart, moveAllToCart } from "@/lib/db/enrollments";
import { encodeFlash, flashCookieOptions, FLASH_COOKIE, type Flash } from "@/lib/payments/flash";

const single = z.object({ course_id: z.coerce.number().int().positive() });
const all = z.object({ action: z.literal("move_all") });

/** wishlist.php stores every outcome in $_SESSION['flash'] before redirecting. */
async function withFlash(flash: Flash, payload: Record<string, unknown>) {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, encodeFlash(flash), flashCookieOptions());
  return NextResponse.json({ success: true, redirect: "/wishlist", ...payload });
}

/** Port of the wishlist.php "Remove", "Add to Cart" and "Move All to Cart" actions. */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  if (user.role === "instructor") {
    return NextResponse.json({ success: false, error: "Instructors cannot access the wishlist." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Move All to Cart (the PHP form posts course_id=0 with this button name).
  if (all.safeParse(body).success || (body as { action?: string }).action === "move_all") {
    const { moved } = await moveAllToCart(user.id);
    return withFlash({ msg: `${moved} course(s) moved to cart / enrolled.`, type: "success" }, { moved });
  }

  const parsed = single.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid course." }, { status: 400 });

  const courseId = parsed.data.course_id;
  const action = (body as { action?: string }).action;

  if (action === "add_to_cart") {
    const result = await wishlistAddToCart(user.id, courseId);
    if (result.not_found) return NextResponse.json({ success: false, error: "Course not found." }, { status: 404 });
    if (result.already_enrolled) {
      return withFlash({ msg: "You're already enrolled in this course.", type: "info" }, {});
    }
    if (result.enrolled) {
      return withFlash({ msg: "You're enrolled! Course added to My Learning.", type: "success" }, {});
    }
    return withFlash({ msg: "Course moved to your cart.", type: "success" }, {});
  }

  await removeFromWishlist(user.id, courseId);
  return withFlash({ msg: "Course removed from wishlist.", type: "info" }, {});
}
