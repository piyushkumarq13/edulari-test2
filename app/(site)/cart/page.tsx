import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCart, getStudentStats, getWishlistCourseIds } from "@/lib/db/commerce";
import { splitPaidAndFree, toNumber } from "@/lib/payments/amounts";
import { formatPrice } from "@/lib/format";
import { decodeFlash, PREDEFINED_FLASH, FLASH_COOKIE } from "@/lib/payments/flash";
import FlashMessage from "@/components/FlashMessage";
import CartClient from "./CartClient";
import "@/styles/css/cart-wishlist.css";

export const metadata: Metadata = pageMetadata({
  title: "Cart ? Edulari",
  description: "Review the courses in your Edulari shopping cart and proceed to secure checkout.",
  path: "/cart",
  noindex: true,
});

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // requireLogin(); proxy.ts bounces instructors to /browse-courses with the flash.
  const user = await requireUser();
  const sp = await searchParams;

  const [cartItems, wishlistIds, stats, csrfToken] = await Promise.all([
    getCart(user.id),
    getWishlistCourseIds(user.id),
    getStudentStats(user.id),
    readCsrfToken(),
  ]);

  const jar = await cookies();
  const flash = decodeFlash(jar.get(FLASH_COOKIE)?.value) ?? (sp.flash ? PREDEFINED_FLASH[sp.flash] : undefined);

  const { paidItems, freeItems } = splitPaidAndFree(cartItems);
  const freeCount = freeItems.length;
  const paidCount = paidItems.length;
  const subtotal = paidItems.reduce((sum, item) => sum + toNumber(item.price), 0);

  return (
    <div className="main-wrapper">
      <main className="page-content">
        {flash ? <FlashMessage msg={flash.msg} type={flash.type} csrfToken={csrfToken} /> : null}

        <CartClient
          items={JSON.parse(JSON.stringify(cartItems))}
          wishlistIds={wishlistIds}
          freeCount={freeCount}
          paidCount={paidCount}
          subtotal={Math.round(subtotal * 100) / 100}
          wishlistCount={stats.wishlist_count}
          csrfToken={csrfToken}
          formatPrice={formatPrice}
        />
      </main>
    </div>
  );
}


