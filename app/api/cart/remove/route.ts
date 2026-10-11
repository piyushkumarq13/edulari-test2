import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isSameOriginPost } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { requireApiUser } from "@/lib/auth/guards";
import { removeFromCart, clearCart } from "@/lib/db/enrollments";
import { encodeFlash, flashCookieOptions, FLASH_COOKIE, type Flash } from "@/lib/payments/flash";

const schema = z.object({ course_id: z.coerce.number().int().positive() });

/** cart.php stores $_SESSION['flash'] before every redirect. */
async function withFlash(flash: Flash, redirect: string) {
  const jar = await cookies();
  jar.set(FLASH_COOKIE, encodeFlash(flash), flashCookieOptions());
  return NextResponse.json({ success: true, redirect });
}

/** Port of the `action=remove` and `action=clear_cart` branches of cart.php. */
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if ((body as { action?: string }).action === "clear") {
    await clearCart(user.id);
    return withFlash({ msg: "Your cart has been cleared.", type: "info" }, "/cart");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid course." }, { status: 400 });

  await removeFromCart(user.id, parsed.data.course_id);
  return withFlash({ msg: "Course removed from cart.", type: "info" }, "/cart");
}

/** The "Clear Cart" button also works over DELETE. */
export async function DELETE(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, error: "Invalid origin." }, { status: 403 });
  if (!verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token") ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 403 });
  }

  const user = await requireApiUser();
  if (!user) return NextResponse.json({ success: false, error: "Please log in." }, { status: 401 });
  if (user.role === "instructor") {
    return NextResponse.json({ success: false, error: "Instructors cannot access the cart." }, { status: 403 });
  }

  await clearCart(user.id);
  return withFlash({ msg: "Your cart has been cleared.", type: "info" }, "/cart");
}
