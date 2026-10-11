import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { getCart } from "@/lib/db/commerce";
import { splitPaidAndFree } from "@/lib/payments/amounts";
import { enrollStudent, removeFromCart } from "@/lib/db/enrollments";
import { encodeFlash, flashCookieOptions, FLASH_COOKIE } from "@/lib/payments/flash";

/**
 * Port of the cart.php `action=checkout` branch.
 *
 * Free courses never touch Razorpay: they are enrolled straight away and removed
 * from the cart. If paid courses remain, the student continues to /checkout.
 */
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  if (user.role !== "student") {
    return NextResponse.json({ success: false, error: "Instructors cannot access the cart." }, { status: 403 });
  }

  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }

  const cartItems = await getCart(user.id);
  if (cartItems.length === 0) return NextResponse.json({ success: false, error: "Cart is empty." }, { status: 400 });

  const { paidItems, freeItems } = splitPaidAndFree(cartItems);

  let enrolledCount = 0;
  for (const item of freeItems) {
    const courseId = Number(item.course_id);
    const already = await enrollStudent(user.id, courseId, false);
    if (already.success) enrolledCount++;
    await removeFromCart(user.id, courseId);
  }

  const jar = await cookies();

  if (paidItems.length > 0) {
    jar.set(
      FLASH_COOKIE,
      encodeFlash({ msg: `Redirecting to payment for ${paidItems.length} paid course(s)…`, type: "info" }),
      flashCookieOptions(),
    );
    return NextResponse.json({ success: true, redirect: "/checkout" });
  }

  jar.set(
    FLASH_COOKIE,
    encodeFlash({ msg: `You're enrolled in ${enrolledCount} course(s)! Happy learning.`, type: "success" }),
    flashCookieOptions(),
  );
  return NextResponse.json({ success: true, enrolled_free: enrolledCount, redirect: "/student/my-courses" });
}
