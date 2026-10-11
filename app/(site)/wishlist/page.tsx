import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCartCourseIds, getEnrolledCourseIds, getWishlist } from "@/lib/db/commerce";
import { formatPrice } from "@/lib/format";
import { decodeFlash, FLASH_COOKIE } from "@/lib/payments/flash";
import FlashMessage from "@/components/FlashMessage";
import WishlistClient from "./WishlistClient";
import "@/styles/css/cart-wishlist.css";
export const metadata: Metadata = pageMetadata({
  title: "My Wishlist – Edulari",
  description: "Your saved Edulari courses, ready to move to the cart whenever you are.",
  path: "/wishlist",
  noindex: true,
});

export default async function WishlistPage() {
  // requireLogin(); instructors are bounced to /browse-courses by proxy.ts.
  const user = await requireUser();

  const [wishlist, cartIds, enrolledIds, csrfToken] = await Promise.all([
    getWishlist(user.id),
    getCartCourseIds(user.id),
    getEnrolledCourseIds(user.id),
    readCsrfToken(),
  ]);

  const jar = await cookies();
  const flash = decodeFlash(jar.get(FLASH_COOKIE)?.value);

  return (
    <div className="main-wrapper">
      <main className="page-content">
        {flash ? <FlashMessage msg={flash.msg} type={flash.type} csrfToken={csrfToken} /> : null}

        <WishlistClient
          items={JSON.parse(JSON.stringify(wishlist))}
          cartIds={cartIds}
          enrolledIds={enrolledIds}
          csrfToken={csrfToken}
          formatPrice={formatPrice}
        />
      </main>
    </div>
  );
}
