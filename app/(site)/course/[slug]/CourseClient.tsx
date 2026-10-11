"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourseClient({
  courseId, isEnrolled, progress, completedAt, isFree, price, inWishlist, isInstructor, totalLessons, sectionsCount, freePreviewCount, certificateEnabled, durationStr, csrfToken,
}: {
  courseId: number; isEnrolled: boolean; progress: number; completedAt: string | null;
  isFree: boolean; price: number; inWishlist: boolean;
  isInstructor: boolean; totalLessons: number; sectionsCount: number;
  freePreviewCount: number; certificateEnabled: boolean; durationStr: string;
  csrfToken: string;
}) {
  const [wishlisted, setWishlisted] = useState(inWishlist);
  const [showUnenroll, setShowUnenroll] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const toggleWishlist = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/wishlist/toggle", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ course_id: courseId }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.success) {
      setWishlisted(data.in_wishlist);
      router.refresh();
      return;
    }
    if (res.status === 401) { router.push(`/login?redirect=${encodeURIComponent(`/course/${courseId}`)}`); return; }
    setError(data.error ?? "Please log in to manage your wishlist.");
  };

  const enrollOrAddToCart = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/enroll", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ course_id: courseId, action: isFree ? "enroll" : "add_to_cart" }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.success) { router.push(data.redirect); router.refresh(); return; }
    if (res.status === 401) { router.push(`/login?redirect=${encodeURIComponent(`/course/${courseId}`)}`); return; }
    setError(data.error ?? "Something went wrong.");
  };

  const unenroll = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/enroll", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ course_id: courseId, action: "unenroll" }) });
    const data = await res.json();
    setBusy(false);
    setShowUnenroll(false);
    if (res.ok && data.success) { router.push(data.redirect); router.refresh(); return; }
    setError(data.error ?? "Unenroll failed. Please try again.");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <>
      <div className="cp-enroll-card">
        {isEnrolled && !isInstructor ? (
          <>
            <div className="cp-enrolled-badge">You&apos;re Enrolled!</div>
            <div className="cp-progress-wrap">
              <div className="cp-progress-header">
                <span className="cp-progress-label">Your Progress</span>
                <span className="cp-progress-pct">{progress}%</span>
              </div>
              <div className="cp-progress-track"><div className="cp-progress-fill" style={{ width: `${progress}%` }}></div></div>
              {completedAt && <p className="cp-completed-note">Completed {completedAt}</p>}
            </div>
            <a href={`/student/learn?course=${courseId}`} className="cp-btn cp-btn--primary cp-btn--full cp-btn--lg">
              {progress > 0 ? "Continue Learning" : "Start Learning"}
            </a>
            <button type="button" className="cp-btn cp-btn--danger cp-btn--full" id="unenrollTrigger" style={{ marginTop: "0.625rem" }} onClick={() => setShowUnenroll(true)}>Unenroll from Course</button>
          </>
        ) : (
          <>
            <div className="cp-price-block">
              {isFree ? <span className="cp-price cp-price--free">Free</span> : <span className="cp-price">₹{price}</span>}
            </div>
            {error ? <p className="cp-instructor-notice" role="alert">{error}</p> : null}
            {!isInstructor && (
              <div className="cp-action-forms">
                <button type="button" className="cp-btn cp-btn--primary cp-btn--full cp-btn--lg" onClick={enrollOrAddToCart} disabled={busy}>
                  {isFree ? "Enroll Now — Free" : "Add to Cart"}
                </button>
              </div>
            )}
            {!isInstructor && (
              <div>
                <button type="button" className={`cp-btn cp-btn--outline cp-btn--full ${wishlisted ? "cp-btn--wishlisted" : ""}`} onClick={toggleWishlist} disabled={busy}>
                  {wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                </button>
              </div>
            )}
            {isInstructor && <p className="cp-instructor-notice">Instructors cannot enroll in courses.</p>}
            <p className="cp-guarantee">30-Day Money-Back Guarantee</p>
          </>
        )}

        <div className="cp-includes">
          <p className="cp-includes-title">This course includes:</p>
          <ul className="cp-includes-list">
            <li>{durationStr} on-demand video</li>
            <li>{totalLessons} lessons across {sectionsCount} sections</li>
            {certificateEnabled && <li>Certificate of completion</li>}
            <li>Full lifetime access</li>
            <li>Access on mobile and desktop</li>
            {freePreviewCount > 0 && <li>{freePreviewCount} free preview lesson{freePreviewCount > 1 ? "s" : ""}</li>}
          </ul>
        </div>

        <div className="cp-share">
          <p className="cp-share-label">Share this course:</p>
          <span className="cp-copy-confirm" id="copyConfirm">Link copied!</span>
          <div className="cp-share-btns">
            <button className="cp-share-btn" onClick={copyLink} title="Copy link">🔗</button>
            <button className="cp-share-btn" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`, "_blank")} title="Share on Twitter">𝕏</button>
            <button className="cp-share-btn" onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, "_blank")} title="Share on LinkedIn">in</button>
          </div>
        </div>
      </div>

      {showUnenroll && (
        <div id="unenrollModal" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowUnenroll(false)}>
          <div style={{ background: "var(--cn-dark,#1e1e2e)", border: "1px solid var(--border,rgba(255,255,255,0.1))", borderRadius: 16, padding: "2rem", maxWidth: 420, width: "90%", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", animation: "modalIn .2s ease" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Unenroll from Course?</h3>
            <p style={{ color: "#aaa", fontSize: "0.9rem", lineHeight: 1.6, margin: "1rem 0 1.5rem" }}>All your progress will be permanently deleted. You can re-enroll later, but you will start from scratch.</p>
            <form id="unenrollForm" onSubmit={(e) => { e.preventDefault(); void unenroll(); }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button type="button" id="unenrollCancel" className="cp-btn cp-btn--outline" style={{ flex: 1 }} onClick={() => setShowUnenroll(false)}>Cancel</button>
                <button type="submit" className="cp-btn" style={{ flex: 1, background: "#ef4444", color: "#fff", borderColor: "#ef4444", fontWeight: 600 }} disabled={busy}>Yes, Unenroll</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
