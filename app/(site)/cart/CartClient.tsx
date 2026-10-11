"use client";

import { useState } from "react";

export type CartCourse = {
  id: number;
  course_id: number;
  slug: string;
  title: string;
  thumbnail: string | null;
  level: string;
  price: number;
  avg_rating: number | null;
  category_name: string | null;
  instructor_name: string | null;
};

type Res = { success: boolean; error?: string; redirect?: string };

/** Port of renderStarsCart() from cart.php. */
export function StarsCart({ rating }: { rating: number }) {
  return (
    <span className="stars">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        const kind = n <= Math.floor(rating) ? "filled" : n - 0.5 <= rating ? "half" : "empty";
        return (
          <span key={n} className={`star ${kind}`}>
            ★
          </span>
        );
      })}
    </span>
  );
}

function action(url: string, body: Record<string, unknown>, csrfToken: string) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    credentials: "same-origin",
    body: JSON.stringify(body),
  })
    .then((r) => r.json() as Promise<Res>)
    .then((d) => {
      if (!d.success) throw new Error(d.error ?? "Something went wrong.");
      if (d.redirect) window.location.href = d.redirect;
      return d;
    });
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Full port of the cart.php markup (header, item list, summary, empty state). */
export default function CartClient({
  items,
  wishlistIds,
  freeCount,
  paidCount,
  subtotal,
  wishlistCount,
  csrfToken,
  formatPrice,
}: {
  items: CartCourse[];
  wishlistIds: number[];
  freeCount: number;
  paidCount: number;
  subtotal: number;
  wishlistCount: number;
  csrfToken: string;
  formatPrice: (n: number) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = subtotal;
  const itemCount = items.length;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const clearCart = () => {
    if (!confirm("Clear your entire cart?")) return;
    void run(() => action("/api/cart/remove", { action: "clear" }, csrfToken));
  };

  const checkout = () => void run(() => action("/api/cart/checkout", {}, csrfToken));

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
              <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Shopping Cart
          </h1>
          <p className="page-subtitle">
            {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
          </p>
        </div>
        {itemCount > 0 ? (
          <div className="page-header-right">
            <button type="button" onClick={clearCart} disabled={busy} className="btn btn-ghost btn-danger-hover">
              <TrashIcon />
              Clear Cart
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {itemCount > 0 ? (
        <div className="cart-layout">
          <div className="cart-items-col">
            {items.map((item) => {
              const isFree = Number(item.price) === 0;
              const inWishlist = wishlistIds.includes(Number(item.course_id));
              const avgRating = item.avg_rating ? Math.round(Number(item.avg_rating) * 10) / 10 : 0;

              return (
                <div className="cart-item" key={item.course_id}>
                  <a href={`/course/${encodeURIComponent(item.slug)}`} className="cart-item-thumb-link">
                    <div className="cart-item-thumb">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt={item.title} loading="lazy" />
                      ) : (
                        <div className="cart-item-placeholder">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </a>

                  <div className="cart-item-details">
                    {item.category_name ? <p className="cart-item-cat">{item.category_name}</p> : null}

                    <h3 className="cart-item-title">
                      <a href={`/course/${encodeURIComponent(item.slug)}`}>{item.title}</a>
                    </h3>

                    <p className="cart-item-instructor">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      {item.instructor_name}
                    </p>

                    <div className="cart-item-meta">
                      {item.level ? (
                        <span className={`cart-meta-tag cart-meta-tag--${item.level}`}>
                          {item.level.charAt(0).toUpperCase() + item.level.slice(1)}
                        </span>
                      ) : null}
                      {avgRating > 0 ? (
                        <span className="cart-item-rating">
                          <span className="cart-rating-num">{avgRating.toFixed(1)}</span>
                          <StarsCart rating={avgRating} />
                        </span>
                      ) : null}
                    </div>

                    <div className="cart-item-actions">
                      {inWishlist ? (
                        <span className="cart-action-label">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                          </svg>
                          In Wishlist
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="cart-action-link"
                          disabled={busy}
                          onClick={() => void run(() => action("/api/cart/move-to-wishlist", { course_id: item.course_id }, csrfToken))}
                        >
                          <svg viewBox="0 0 24 24" fill="none">
                            <path
                              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Save for later
                        </button>
                      )}

                      <span className="cart-action-divider">·</span>

                      <button
                        type="button"
                        className="cart-action-link cart-action-link--remove"
                        disabled={busy}
                        onClick={() => void run(() => action("/api/cart/remove", { course_id: item.course_id }, csrfToken))}
                      >
                        <svg viewBox="0 0 24 24" fill="none">
                          <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    {isFree ? (
                      <span className="price price--free">Free</span>
                    ) : (
                      <span className="price">{formatPrice(Number(item.price))}</span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="cart-continue">
              <a href="/browse-courses" className="btn btn-ghost">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Continue Shopping
              </a>
            </div>
          </div>

          <aside className="cart-summary-col">
            <div className="cart-summary-card">
              <h2 className="summary-title">Order Summary</h2>

              <div className="summary-rows">
                <div className="summary-row">
                  <span>Total items</span>
                  <span>{itemCount}</span>
                </div>
                {freeCount > 0 ? (
                  <div className="summary-row">
                    <span>Free courses</span>
                    <span className="summary-free">{freeCount}</span>
                  </div>
                ) : null}
                {paidCount > 0 ? (
                  <>
                    <div className="summary-row">
                      <span>Paid courses</span>
                      <span>{paidCount}</span>
                    </div>
                    <div className="summary-row">
                      <span>Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="summary-divider" />

              <div className="summary-total-row">
                <span className="summary-total-label">Total</span>
                <span className="summary-total-amount">
                  {total === 0 ? <span className="price--free">Free</span> : formatPrice(total)}
                </span>
              </div>

              <button type="button" onClick={checkout} disabled={busy} className="btn btn-primary btn-block summary-checkout-form">
                {total === 0 ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Enroll in Free Courses
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                      <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Proceed to Checkout
                  </>
                )}
              </button>

              <ul className="trust-badges">
                <li>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Secure checkout
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none">
                    <polyline points="20 12 20 22 4 22 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="2" y="7" width="20" height="5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 22V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  30-day money-back guarantee
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Lifetime access on enroll
                </li>
              </ul>

              {wishlistCount > 0 ? (
                <>
                  <div className="summary-divider" />
                  <a href="/wishlist" className="summary-wishlist-link">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    View Wishlist ({wishlistCount} saved)
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </a>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="var(--primary-light)" />
              <circle cx="27" cy="62" r="4" stroke="var(--primary)" strokeWidth="3" />
              <circle cx="54" cy="62" r="4" stroke="var(--primary)" strokeWidth="3" />
              <path d="M14 18h6l7 28h22l6-18H24" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="empty-title">Your cart is empty</h2>
          <p className="empty-sub">Looks like you haven&apos;t added any courses yet. Browse our catalog and start learning something new today!</p>
          <div className="empty-actions">
            <a href="/browse-courses" className="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Browse Courses
            </a>
            {wishlistCount > 0 ? (
              <a href="/wishlist" className="btn btn-outline">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
                View Wishlist ({wishlistCount})
              </a>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
