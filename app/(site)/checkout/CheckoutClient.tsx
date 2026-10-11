"use client";

import { useState } from "react";

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { email: string; contact: string };
  theme: { color: string };
  handler: (response: Record<string, string>) => void;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (response: Record<string, unknown>) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export type CheckoutCourse = {
  id: number;
  course_id: number;
  slug: string;
  title: string;
  thumbnail: string | null;
  instructor_name: string | null;
  price: number;
};

type VerifySuccess = {
  success: true;
  payment_id: string;
  amount: number;
  enrolled_count: number;
  courses: { title: string; price: number; thumbnail: string }[];
};

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "₹";

/** Loads the Razorpay Checkout SDK (https://checkout.razorpay.com/v1/checkout.js). */
function loadSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function spinnerHtml(label: string) {
  return (
    <>
      <svg viewBox="0 0 24 24" fill="none" style={{ animation: "rzp-spin 1s linear infinite" }}>
        <path
          d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>{" "}
      {label}
    </>
  );
}

function PayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThumbBox({ src, title }: { src: string | null; title: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} />
  ) : (
    <div className="checkout-course-placeholder">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

/** Port of checkout.php, including the inline payment script and success screen. */
export default function CheckoutClient({
  paidItems,
  total,
  csrfToken,
  formatPrice,
}: {
  paidItems: CheckoutCourse[];
  total: number;
  csrfToken: string;
  formatPrice: (n: number) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<VerifySuccess | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setLabel(null);
    setBusy(false);
  };

  /** Fire-and-forget status report; reconciliation is the backstop. */
  const reportOrderStatus = (orderId: string, status: string, reason: string) => {
    if (!orderId) return;
    fetch("/api/razorpay/mark-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      credentials: "same-origin",
      body: JSON.stringify({ razorpay_order_id: orderId, status, reason }),
    }).catch(() => {});
  };

  const pay = async () => {
    setBusy(true);
    setLabel("Preparing Payment…");
    setError("");

    // ── Step 1: create the Razorpay order on the server ──────────────────────
    let orderData: { order_id?: string; amount?: number; currency?: string; key?: string; name?: string; email?: string; contact?: string; error?: string };
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        credentials: "same-origin",
      });
      orderData = await res.json();
    } catch {
      showError("Could not connect to payment server. Please check your internet and try again.");
      return;
    }

    if (orderData.error || !orderData.order_id) {
      showError(orderData.error ?? "Invalid response from payment server.");
      return;
    }

    if (!(await loadSdk())) {
      showError("Could not load the payment window. Please check your connection and try again.");
      return;
    }

    // ── Step 2: open the Razorpay popup ──────────────────────────────────────
    const options: RazorpayOptions = {
      key: orderData.key ?? "",
      amount: Number(orderData.amount),
      currency: orderData.currency ?? "INR",
      name: orderData.name ?? "Edulari",
      description: "Course Enrollment",
      order_id: orderData.order_id,
      prefill: { email: orderData.email ?? "", contact: orderData.contact || "" },
      theme: { color: "#6366f1" },

      handler: async (response) => {
        setLabel("Verifying Payment…");

        const paymentData = {
          razorpay_order_id: String(response.razorpay_order_id ?? ""),
          razorpay_payment_id: String(response.razorpay_payment_id ?? ""),
          razorpay_signature: String(response.razorpay_signature ?? ""),
        };

        // ── Step 3: verify the signature on the server ───────────────────────
        let result: VerifySuccess | { success: false; message?: string };
        try {
          const verifyRes = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
            credentials: "same-origin",
            body: JSON.stringify(paymentData),
          });
          result = await verifyRes.json();
        } catch {
          showError(
            `Network error during verification. Your payment was received. Contact support with Payment ID: ${paymentData.razorpay_payment_id}`,
          );
          return;
        }

        if (result.success) {
          setSuccess(result);
          setBusy(false);
          setLabel(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          showError(
            `Verification failed: ${("message" in result && result.message) || "Unknown error"} | Payment ID: ${paymentData.razorpay_payment_id}`,
          );
        }
      },

      modal: {
        ondismiss: () => {
          reportOrderStatus(orderData.order_id!, "cancelled", "User closed checkout popup");
          setBusy(false);
          setLabel(null);
        },
      },
    };

    const rzp = new window.Razorpay!(options);

    rzp.on("payment.failed", (response) => {
      const err = response.error as { description?: string; reason?: string } | undefined;
      const reason = err?.description || err?.reason || "Unknown error";
      reportOrderStatus(orderData.order_id!, "failed", reason);
      showError(`Payment failed: ${reason}. Please try again.`);
    });

    rzp.open();
  };

  // ── Success screen (replaces the page content, as in checkout.php) ──────────
  if (success) {
    return (
      <div className="checkout-success">
        <div className="success-icon">
          <svg viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" fill="#d1fae5" stroke="#10b981" strokeWidth="3" />
            <path d="M24 40l12 12 20-22" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="success-title">Payment Successful! 🎉</h1>
        <p className="success-subtitle">You are now enrolled in your courses. Happy learning!</p>

        <div className="success-details">
          <div className="success-detail-row">
            <span className="detail-label">Payment ID</span>
            <span className="detail-value">{success.payment_id}</span>
          </div>
          <div className="success-detail-row">
            <span className="detail-label">Amount Paid</span>
            <span className="detail-value">
              {CURRENCY}
              {Number(success.amount || 0).toFixed(2)}
            </span>
          </div>
          <div className="success-detail-row">
            <span className="detail-label">Courses Enrolled</span>
            <span className="detail-value">{Number(success.enrolled_count || 0)} course(s)</span>
          </div>
        </div>

        <div className="success-courses">
          <h3>Enrolled Courses</h3>
          {success.courses.map((course, i) => (
            <div className="success-course-item" key={`${course.title}-${i}`}>
              <div className="success-course-thumb">
                {course.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f1f5f9",
                      borderRadius: 8,
                      color: "#94a3b8",
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="success-course-info">
                <p className="success-course-title">{course.title}</p>
                <p className="success-course-price">
                  {CURRENCY}
                  {Number(course.price || 0).toFixed(2)}
                </p>
              </div>
              <svg className="success-course-check" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#10b981" />
                <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>

        <div className="success-actions">
          <a href="/student/my-courses" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            Done — Go to My Courses
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
              <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" />
            </svg>
            Checkout
          </h1>
          <p className="page-subtitle">Complete your payment securely via Razorpay</p>
        </div>
      </div>

      <div className="checkout-steps">
        <div className="checkout-step checkout-step--done">
          <div className="step-circle">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
              <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>Cart</span>
        </div>
        <div className="step-line step-line--done" />
        <div className="checkout-step checkout-step--active">
          <div className="step-circle">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
              <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <span>Payment</span>
        </div>
        <div className="step-line" />
        <div className="checkout-step">
          <div className="step-circle">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span>Enrolled</span>
        </div>
      </div>

      <div className="checkout-layout">
        <div className="checkout-payment-col">
          <div className="checkout-card">
            <div className="checkout-card-header">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
              <h2>Secure Payment</h2>
            </div>

            <div className="checkout-error" id="paymentError" style={{ display: error ? "flex" : "none" }}>
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span id="paymentErrorText">{error}</span>
            </div>

            <div className="upi-amount-banner">
              <p className="upi-amount-label">Total Amount to Pay</p>
              <p className="upi-amount-value">{formatPrice(total)}</p>
            </div>

            <div style={{ margin: "1.25rem 0", padding: "1rem", background: "var(--surface-secondary,#f8fafc)", borderRadius: 10 }}>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                Accepted Payment Methods
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                <span style={{ padding: "0.25rem 0.6rem", background: "white", border: "1px solid var(--border,#e2e8f0)", borderRadius: 6 }}>
                  💳 Credit / Debit Card
                </span>
                <span style={{ padding: "0.25rem 0.6rem", background: "white", border: "1px solid var(--border,#e2e8f0)", borderRadius: 6 }}>
                  📱 UPI (GPay, PhonePe, Paytm)
                </span>
                <span style={{ padding: "0.25rem 0.6rem", background: "white", border: "1px solid var(--border,#e2e8f0)", borderRadius: 6 }}>
                  🏦 Net Banking
                </span>
                <span style={{ padding: "0.25rem 0.6rem", background: "white", border: "1px solid var(--border,#e2e8f0)", borderRadius: 6 }}>
                  👛 Wallets
                </span>
              </div>
            </div>

            <button type="button" id="payNowBtn" onClick={pay} disabled={busy} className="btn btn-primary btn-block btn-lg">
              {label ? spinnerHtml(label) : (
                <>
                  <PayIcon /> Pay {formatPrice(total)} Now
                </>
              )}
            </button>

            <a href="/cart" className="btn btn-ghost btn-block" style={{ marginTop: "0.75rem" }}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Cart
            </a>

            <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--text-muted,#94a3b8)" }}>
              🔒 100% Secure &nbsp;|&nbsp; Powered by <strong>Razorpay</strong>
            </p>
          </div>
        </div>

        <aside className="checkout-summary-col">
          <div className="cart-summary-card">
            <h2 className="summary-title">Order Summary</h2>

            <div className="checkout-course-list">
              {paidItems.map((item) => (
                <div className="checkout-course-row" key={item.course_id}>
                  <div className="checkout-course-thumb">
                    <ThumbBox src={item.thumbnail} title={item.title} />
                  </div>
                  <div className="checkout-course-info">
                    <p className="checkout-course-title">{item.title}</p>
                    <p className="checkout-course-instructor">{item.instructor_name}</p>
                  </div>
                  <span className="checkout-course-price">{formatPrice(Number(item.price))}</span>
                </div>
              ))}
            </div>

            <div className="summary-divider" />

            <div className="summary-rows">
              <div className="summary-row">
                <span>
                  Subtotal ({paidItems.length} course{paidItems.length > 1 ? "s" : ""})
                </span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            <div className="summary-divider" />

            <div className="summary-total-row">
              <span className="summary-total-label">Total</span>
              <span className="summary-total-amount">{formatPrice(total)}</span>
            </div>

            <ul className="trust-badges" style={{ marginTop: "1.5rem" }}>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Verified secure payment
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <polyline points="20 12 20 22 4 22 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="2" y="7" width="20" height="5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M12 22V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Instant enrollment on payment
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Lifetime access on enroll
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <style>{`@keyframes rzp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
