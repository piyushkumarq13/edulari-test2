"use client";

import { useState } from "react";

export type WishlistCourse = {
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

type Res = { success: boolean; error?: string; redirect?: string; moved?: number };

/** Port of renderStarsWL() from wishlist.php. */
function StarsWL({ rating }: { rating: number }) {
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

function action(body: Record<string, unknown>, csrfToken: string) {
  return fetch("/api/wishlist/action", {
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

/** Full port of the wishlist.php markup (header, card grid, CTA bar, empty state). */
export default function WishlistClient({
  items,
  cartIds,
  enrolledIds,
  csrfToken,
  formatPrice,
}: {
  items: WishlistCourse[];
  cartIds: number[];
  enrolledIds: number[];
  csrfToken: string;
  formatPrice: (n: number) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    action(body, csrfToken).catch((err: unknown) => {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    });
  };

  const count = items.length;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            My Wishlist
          </h1>
          <p className="page-subtitle">
            {count} saved course{count !== 1 ? "s" : ""}
          </p>
        </div>
        {count > 0 ? (
          <div className="page-header-right">
            <button type="button" onClick={() => run({ action: "move_all" })} disabled={busy} className="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Move All to Cart
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {count > 0 ? (
        <>
          <div className="wl-grid">
            {items.map((item) => {
              const isEnrolledCourse = enrolledIds.includes(Number(item.course_id));
              const inCart = cartIds.includes(Number(item.course_id));
              const isFree = Number(item.price) === 0;
              const avgRating = item.avg_rating ? Math.round(Number(item.avg_rating) * 10) / 10 : 0;
              const slugHref = `/course/${encodeURIComponent(item.slug)}`;

              return (
                <article className="wl-card" key={item.course_id}>
                  <a href={slugHref} className="wl-thumb-link">
                    <div className="wl-thumb">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt={item.title} loading="lazy" />
                      ) : (
                        <div className="wl-thumb-placeholder">
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </div>
                      )}
                      {item.level ? (
                        <span className={`wl-level-badge wl-level-badge--${item.level}`}>
                          {item.level.charAt(0).toUpperCase() + item.level.slice(1)}
                        </span>
                      ) : null}
                      {isFree ? <span className="wl-free-badge">FREE</span> : null}
                    </div>
                  </a>

                  <div className="wl-body">
                    {item.category_name ? <p className="wl-category">{item.category_name}</p> : null}

                    <h2 className="wl-title">
                      <a href={slugHref}>{item.title}</a>
                    </h2>

                    <p className="wl-instructor">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      {item.instructor_name}
                    </p>

                    <div className="wl-rating">
                      {avgRating > 0 ? (
                        <>
                          <span className="wl-rating-num">{avgRating.toFixed(1)}</span>
                          <StarsWL rating={avgRating} />
                        </>
                      ) : (
                        <span className="wl-no-rating">No ratings yet</span>
                      )}
                    </div>

                    <div className="wl-price-row">
                      {isFree ? <span className="wl-price wl-price--free">Free</span> : <span className="wl-price">{formatPrice(Number(item.price))}</span>}
                    </div>
                  </div>

                  <div className="wl-actions">
                    {isEnrolledCourse ? (
                      <>
                        <a href={`/student/learn?course=${item.course_id}`} className="btn btn-success btn-sm">
                          <svg viewBox="0 0 24 24" fill="none">
                            <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                          Continue Learning
                        </a>
                        <button
                          type="button"
                          onClick={() => run({ course_id: item.course_id })}
                          disabled={busy}
                          className="btn btn-ghost btn-sm"
                          title="Remove from wishlist"
                        >
                          <TrashIcon />
                          Remove
                        </button>
                      </>
                    ) : inCart ? (
                      <>
                        <a href="/cart" className="btn btn-outline btn-sm">
                          <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                            <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          View in Cart
                        </a>
                        <button
                          type="button"
                          onClick={() => run({ course_id: item.course_id })}
                          disabled={busy}
                          className="btn btn-ghost btn-sm"
                          title="Remove from wishlist"
                        >
                          <svg viewBox="0 0 24 24" fill="none">
                            <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => run({ course_id: item.course_id, action: "add_to_cart" })}
                          disabled={busy}
                          className="btn btn-primary btn-sm"
                        >
                          {isFree ? (
                            <>
                              <svg viewBox="0 0 24 24" fill="none">
                                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Enroll Free
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none">
                                <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                                <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              Add to Cart
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => run({ course_id: item.course_id })}
                          disabled={busy}
                          className="btn btn-ghost btn-sm btn-danger-hover"
                          title="Remove from wishlist"
                        >
                          <svg viewBox="0 0 24 24" fill="none">
                            <path
                              d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                              fill="currentColor"
                            />
                          </svg>
                          Remove
                        </button>
                      </>
                    )}

                    <a href={slugHref} className="btn btn-ghost btn-sm">
                      Details
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="wl-cta-bar">
            <p>Find more courses to save</p>
            <a href="/browse-courses" className="btn btn-outline">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Browse Courses
            </a>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="36" fill="var(--primary-light)" />
              <path
                d="M55.84 26.61a13.5 13.5 0 00-19.09 0L40 29.92l3.25-3.31a13.5 13.5 0 0119.09 19.09l-2.59 2.59L40 57.71 20.25 48.29l-2.59-2.59A13.5 13.5 0 0136.75 26.3L40 29.61l3.25-3.31"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="M40 30l-3.25-3.31a13.5 13.5 0 00-18.34 19.69l2 1.91L40 57.71l19.59-9.42 2-1.91A13.5 13.5 0 0043.25 26.69L40 30z"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <h2 className="empty-title">Your wishlist is empty</h2>
          <p className="empty-sub">Save courses you&apos;re interested in and access them here anytime. Start exploring what&apos;s available!</p>
          <a href="/browse-courses" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Explore Courses
          </a>
        </div>
      )}
    </>
  );
}
