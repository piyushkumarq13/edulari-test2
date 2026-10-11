"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = {
  id: number; title: string; slug: string; short_description: string | null; thumbnail: string | null;
  level: string; price: number; category_name: string | null; instructor_name: string | null;
  student_count: number; avg_rating: number | null; review_count: number; lesson_count: number;
};

export default function BrowseClient({
  courses, wishlistIds, cartIds, enrolledIds, userRole, view, page, totalPages, searchParams, csrfToken,
}: {
  courses: Course[]; wishlistIds: number[]; cartIds: number[]; enrolledIds: number[];
  userRole: string; view: string; page: number; totalPages: number; searchParams: Record<string, string | undefined>;
  csrfToken: string;
}) {
  const [wishlist, setWishlist] = useState(new Set(wishlistIds));
  const cart = new Set(cartIds);
  const router = useRouter();

  const isInstructor = userRole === "instructor";

  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    params.set("page", String(p));
    return "/browse-courses?" + params.toString();
  };

  const requireLogin = (res: Response) => {
    if (res.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent(pageUrl(page))}`);
      return true;
    }
    return false;
  };

  const toggleWishlist = async (id: number) => {
    const res = await fetch("/api/wishlist/toggle", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ course_id: id }) });
    if (requireLogin(res)) return;
    const data = await res.json();
    if (res.ok && data.success) {
      const next = new Set(wishlist);
      if (data.in_wishlist) next.add(id); else next.delete(id);
      setWishlist(next);
    }
  };

  const addToCart = async (id: number) => {
    const res = await fetch("/api/cart/add", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ course_id: id }) });
    if (requireLogin(res)) return;
    const data = await res.json();
    if (res.ok && data.success) router.push(data.redirect);
  };

  return (
    <>
      <div className={`bc-courses ${view === "list" ? "bc-courses--list" : "bc-courses--grid"}`}>
        {courses.length === 0 && (
          <div className="bc-empty">
            <h3 className="bc-empty-title">No courses found</h3>
            <p className="bc-empty-text">Try adjusting your filters or search term to find more courses.</p>
            <a href="/browse-courses" className="bc-btn bc-btn--primary bc-btn--lg">Clear All Filters</a>
          </div>
        )}
        {courses.map((course) => {
          const inWishlist = wishlist.has(course.id);
          const inCart = cart.has(course.id);
          const isEnrolled = enrolledIds.includes(course.id);
          const avgRating = course.avg_rating ? Math.round(course.avg_rating * 10) / 10 : 0;
          const isFree = course.price === 0;
          return (
            <article key={course.id} className="bc-card" data-course-id={course.id}>
              <a href={`/course/${course.slug}`} className="bc-card-img-link" tabIndex={-1} aria-hidden="true">
                <div className="bc-card-img">
                  {course.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={course.thumbnail} alt={course.title} loading="lazy" />
                  ) : (
                    <div className="bc-img-placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" /></svg></div>
                  )}
                  <div className="bc-img-overlay">
                    <div className="bc-badges-tl">
                      {isFree && <span className="bc-badge bc-badge--free">Free</span>}
                      {isEnrolled && <span className="bc-badge bc-badge--enrolled">Enrolled</span>}
                    </div>
                    {course.level && <span className={`bc-badge bc-badge--level bc-badge--${course.level}`}>{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</span>}
                  </div>
                </div>
              </a>

              {!isInstructor && (
                <form method="post" className="bc-wish-form">
                  <button type="button" className={`bc-wish-btn ${inWishlist ? "bc-wish-btn--active" : ""}`} title={inWishlist ? "Remove from wishlist" : "Save to wishlist"} aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist(course.id)}>
                    <svg viewBox="0 0 24 24" fill={inWishlist ? "currentColor" : "none"}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                  </button>
                </form>
              )}

              <div className="bc-card-body">
                {course.category_name && <p className="bc-card-cat">{course.category_name}</p>}
                <h3 className="bc-card-title"><a href={`/course/${course.slug}`}>{course.title}</a></h3>
                {course.short_description && view === "list" && <p className="bc-card-desc">{course.short_description.slice(0, 130)}…</p>}
                <p className="bc-card-instructor">{course.instructor_name}</p>
                <div className="bc-card-rating">
                  <span className="bc-rating-num">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</span>
                  <span className="bc-rating-cnt">({course.review_count})</span>
                </div>
                <div className="bc-card-meta">
                  <span className="bc-meta">{course.lesson_count} lessons</span>
                  <span className="bc-meta">{course.student_count} students</span>
                </div>
              </div>

              <div className="bc-card-footer">
                <div className="bc-price-wrap">
                  {isFree ? <span className="bc-price bc-price--free">Free</span> : <span className="bc-price">₹{course.price}</span>}
                </div>
                <div className="bc-card-btns">
                  {isEnrolled ? (
                    <a href={`/student/learn?course=${course.id}`} className="bc-btn bc-btn--primary">Continue</a>
                  ) : isFree && !isInstructor ? (
                    <a href={`/course/${course.slug}`} className="bc-btn bc-btn--primary">Enroll Free</a>
                  ) : inCart && !isInstructor ? (
                    <a href="/cart" className="bc-btn bc-btn--secondary">In Cart →</a>
                  ) : !isInstructor ? (
                    <button type="button" className="bc-btn bc-btn--primary" onClick={() => addToCart(course.id)}>Add to Cart</button>
                  ) : null}
                  <a href={`/course/${course.slug}`} className="bc-btn bc-btn--ghost">Details</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav className="bc-pagination" aria-label="Pagination">
          {page > 1 && <a href={pageUrl(page - 1)} className="bc-pg-btn bc-pg-btn--arrow" aria-label="Previous">‹</a>}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            if (p === page) return <span key={p} className="bc-pg-btn bc-pg-btn--current">{p}</span>;
            return <a key={p} href={pageUrl(p)} className="bc-pg-btn">{p}</a>;
          })}
          {page < totalPages && <a href={pageUrl(page + 1)} className="bc-pg-btn bc-pg-btn--arrow" aria-label="Next">›</a>}
        </nav>
      )}
    </>
  );
}
