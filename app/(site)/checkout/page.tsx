import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireUser } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getCart } from "@/lib/db/commerce";
import { splitPaidAndFree, toNumber } from "@/lib/payments/amounts";
import { formatPrice } from "@/lib/format";
import CheckoutClient from "./CheckoutClient";
import "@/styles/css/cart-wishlist.css";
import "@/styles/css/checkout.css";
export const metadata: Metadata = pageMetadata({
  title: "Checkout – Edulari",
  description: "Complete your Edulari course payment securely via Razorpay.",
  path: "/checkout",
  noindex: true,
});

export default async function CheckoutPage() {
  // requireLogin(); proxy.ts bounces instructors to /browse-courses with a flash.
  const user = await requireUser();

  const cartItems = await getCart(user.id);
  const { paidItems } = splitPaidAndFree(cartItems);

  // "No paid courses in your cart." — the PHP shows this flash on /cart.
  if (paidItems.length === 0) redirect("/cart?flash=no_paid_courses");

  const csrfToken = await readCsrfToken();
  const subtotal = paidItems.reduce((sum, item) => sum + toNumber(item.price), 0);
  const total = Math.round(subtotal * 100) / 100;

  return (
    <div className="main-wrapper">
      {/* checkout.php loads the Razorpay Checkout SDK up front so the popup opens
          instantly on the first click; loadSdk() in the client stays as a fallback. */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <main className="page-content" id="pageContent">
        <CheckoutClient
          paidItems={JSON.parse(JSON.stringify(paidItems))}
          total={total}
          csrfToken={csrfToken}
          formatPrice={formatPrice}
        />
      </main>
    </div>
  );
}
