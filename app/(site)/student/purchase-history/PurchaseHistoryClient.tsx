"use client";

import { useEffect, useRef, useState } from "react";

export type GroupMember = {
  razorpay_order_id: string;
  created_at: string;
  status: string;
  failure_reason: string | null;
};

export type CourseSnapshot = { course_id: number; title: string; price: number };

export type GroupedPurchase = {
  id: string | number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  amount_rupees: string;
  currency: string;
  status: string;
  enrolled_count: number;
  courses: CourseSnapshot[];
  created_at: string;
  failure_reason: string | null;
  group_members: GroupMember[] | null;
};

type StatusMeta = { label: string; className: string; icon: React.ReactNode };

function icon(path: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      {path}
    </svg>
  );
}

const STATUS_MAP: Record<string, StatusMeta> = {
  enrolled: {
    label: "Enrolled",
    className: "ph-badge--enrolled",
    icon: icon(<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />),
  },
  enrollment_failed: {
    label: "Contact Support",
    className: "ph-badge--failed",
    icon: icon(
      <>
        <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
  paid: {
    label: "Processing",
    className: "ph-badge--paid",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
  pending: {
    label: "Awaiting Confirmation",
    className: "ph-badge--paid",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
  refunded: {
    label: "Refunded",
    className: "ph-badge--refunded",
    icon: icon(
      <>
        <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  },
  cancelled: {
    label: "Cancelled",
    className: "ph-badge--cancelled",
    icon: icon(
      <>
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
  failed: {
    label: "Payment Failed",
    className: "ph-badge--payment-failed",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
  abandoned: {
    label: "Incomplete",
    className: "ph-badge--abandoned",
    icon: icon(
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
  },
};

const FORMAT_DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const FORMAT_TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const FORMAT_FULL = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const FORMAT_RAW_DATE = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ModalDetails = {
  status: string;
  status_label: string;
  status_class: string;
  order_id: string;
  receipt_order_id: string | null;
  payment_id: string | null;
  payment_fallback: string | null;
  date: string;
  amount: string;
  has_alert: boolean;
  courses: { title: string; price: string; url: string | null }[];
  attempts: { date: string; order_id: string; reason: string | null }[] | null;
};

/** Full port of student/purchase-history.php: table, filters, sort, and both modals. */
export default function PurchaseHistoryClient({
  purchases,
  slugMap,
  stats,
  totalCount,
  totalPages,
  page,
  csrfToken,
  currencySymbol,
  currencyCode,
}: {
  purchases: GroupedPurchase[];
  slugMap: Record<string, string>;
  stats: { totalSpent: number; enrolledCount: number; failedCount: number };
  totalCount: number;
  totalPages: number;
  page: number;
  csrfToken: string;
  currencySymbol: string;
  currencyCode: string;
}) {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [details, setDetails] = useState<ModalDetails | null>(null);
  const [scrollToAttempts, setScrollToAttempts] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ msg: string; ok: boolean } | null>(null);
  const [checkInput, setCheckInput] = useState("");
  const [checkResult, setCheckResult] = useState<{ msg: string; ok: boolean } | null>(null);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const attemptsRef = useRef<HTMLDivElement>(null);
  const originalOrderRef = useRef<Element[]>([]);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const sortColRef = useRef<string | null>(null);
  const sortDirRef = useRef<"asc" | "desc">("desc");

  // ── Reveal animations ─────────────────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const applyFilters = () => {
    const status = (document.getElementById("phFilterStatus") as HTMLSelectElement | null)?.value ?? "";
    const from = (document.getElementById("phFilterFrom") as HTMLInputElement | null)?.value ?? "";
    const to = (document.getElementById("phFilterTo") as HTMLInputElement | null)?.value ?? "";

    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("#phTable tbody tr"));
    let visible = 0;
    let pageRowCount = 0;

    for (const row of rows) {
      if (row.classList.contains("ph-tr--filter-empty")) continue;
      pageRowCount++;
      const rowStatus = row.getAttribute("data-status") ?? "";
      const rowDate = row.getAttribute("data-date") ?? "";

      let show = true;
      if (status !== "" && rowStatus !== status) show = false;
      if (show && from !== "" && rowDate < from) show = false;
      if (show && to !== "" && rowDate > to) show = false;

      row.classList.toggle("ph-tr--hidden", !show);
      if (show) visible++;
    }

    const tbody = tbodyRef.current;
    if (tbody) {
      const emptyRow = document.getElementById("phFilterEmptyRow");
      if (emptyRow) {
        emptyRow.hidden = !(visible === 0 && pageRowCount > 0);
      }
    }

    const countEl = document.getElementById("phFilterCount");
    if (countEl) {
      countEl.textContent = `Showing ${visible} of ${totalCount} purchase${totalCount !== 1 ? "s" : ""}`;
    }

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const pageParam = new URLSearchParams(window.location.search).get("page");
    if (pageParam) params.set("page", pageParam);
    const qs = params.toString();
    window.history.replaceState({ filter: { status, from, to } }, "", window.location.pathname + (qs ? `?${qs}` : ""));
  };

  const sortTable = (col: string) => {
    if (sortColRef.current === col) {
      sortDirRef.current = sortDirRef.current === "asc" ? "desc" : "asc";
    } else {
      sortColRef.current = col;
      sortDirRef.current = "desc";
    }
    const dir = sortDirRef.current;
    const tbody = tbodyRef.current;
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr")).filter((r) => !r.classList.contains("ph-tr--filter-empty"));

    rows.sort((a, b) => {
      if (col === "date") {
        const a2 = a.getAttribute("data-date") ?? "";
        const b2 = b.getAttribute("data-date") ?? "";
        return dir === "asc" ? (a2 < b2 ? -1 : a2 > b2 ? 1 : 0) : a2 > b2 ? -1 : a2 < b2 ? 1 : 0;
      }
      if (col === "amount") {
        const a2 = Number.parseFloat(a.getAttribute("data-amount") ?? "0") || 0;
        const b2 = Number.parseFloat(b.getAttribute("data-amount") ?? "0") || 0;
        return dir === "asc" ? a2 - b2 : b2 - a2;
      }
      return 0;
    });

    rows.forEach((row) => tbody.appendChild(row));

    document.querySelectorAll(".ph-sort-icon").forEach((el) => {
      el.textContent = "";
    });
    const active = document.querySelector(`.ph-th--${col} .ph-sort-icon`);
    if (active) active.textContent = dir === "asc" ? "▲" : "▼";
  };

  const clearFilters = () => {
    (document.getElementById("phFilterStatus") as HTMLSelectElement).value = "";
    (document.getElementById("phFilterFrom") as HTMLInputElement).value = "";
    (document.getElementById("phFilterTo") as HTMLInputElement).value = "";
    applyFilters();

    sortColRef.current = null;
    sortDirRef.current = "desc";
    document.querySelectorAll(".ph-sort-icon").forEach((el) => {
      el.textContent = "";
    });
    const tbody = tbodyRef.current;
    if (tbody && originalOrderRef.current.length) {
      originalOrderRef.current.forEach((row) => tbody.appendChild(row));
    }
  };

  // Save the original row order + restore filter state from the URL on mount.
  useEffect(() => {
    const statusEl = document.getElementById("phFilterStatus") as HTMLSelectElement | null;
    if (!statusEl) return;

    statusEl.addEventListener("change", applyFilters);
    (document.getElementById("phFilterFrom") as HTMLInputElement).addEventListener("change", applyFilters);
    (document.getElementById("phFilterTo") as HTMLInputElement).addEventListener("change", applyFilters);
    document.getElementById("phFilterClear")?.addEventListener("click", clearFilters);

    if (tbodyRef.current) {
      originalOrderRef.current = Array.from(tbodyRef.current.querySelectorAll("tr")).filter(
        (r) => !r.classList.contains("ph-tr--filter-empty"),
      );
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("status")) statusEl.value = params.get("status")!;
    if (params.get("from")) (document.getElementById("phFilterFrom") as HTMLInputElement).value = params.get("from")!;
    if (params.get("to")) (document.getElementById("phFilterTo") as HTMLInputElement).value = params.get("to")!;

    applyFilters();
    sortTable("date");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modals ────────────────────────────────────────────────────────────────
  const openDetails = (el: HTMLElement, scroll: boolean) => {
    let data: ModalDetails;
    try {
      data = JSON.parse(el.getAttribute("data-breakdown") ?? "{}") as ModalDetails;
    } catch {
      return;
    }
    lastTriggerRef.current = document.activeElement as HTMLElement;
    setDetails(data);
    setScrollToAttempts(scroll);
    document.body.style.overflow = "hidden";
  };

  useEffect(() => {
    if (!details || !scrollToAttempts) return;
    const t = setTimeout(() => {
      attemptsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      attemptsRef.current?.classList.add("ph-attempts--highlight");
      setTimeout(() => attemptsRef.current?.classList.remove("ph-attempts--highlight"), 1500);
    }, 350);
    return () => clearTimeout(t);
  }, [details, scrollToAttempts]);

  const closeModal = () => {
    setDetails(null);
    setCheckOpen(false);
    document.body.style.overflow = "";
    lastTriggerRef.current?.focus?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (details || checkOpen)) {
        closeModal();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [details, checkOpen]);

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setToast({ msg: text.startsWith("order_") ? "Order ID copied!" : "Copied!", type: "success" }))
      .catch(() => {});
  };

  // ── Self-service "Check & Enroll" (shared by both modals) ──────────────────
  const performCheck = async (orderId: string, setResult: (r: { msg: string; ok: boolean }) => void) => {
    if (verifyBusy) return;
    if (!orderId.trim()) {
      setResult({ msg: "Please enter your Order ID first.", ok: false });
      return;
    }
    setVerifyBusy(true);
    try {
      const res = await fetch("/api/student/check-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ razorpay_order_id: orderId.trim() }),
      });
      const data = (await res.json()) as { status?: string; message?: string; enrolled_count?: number };

      if (data.status === "enrolled") {
        setResult({ msg: `Enrolled in ${data.enrolled_count ?? 0} course(s). Reloading…`, ok: true });
        setToast({ msg: "Enrolled! Reloading your purchase history…", type: "success" });
        setTimeout(() => window.location.reload(), 1800);
      } else if (data.status === "pending") {
        setResult({ msg: "Payment not received yet. Razorpay has no captured payment for this order.", ok: false });
      } else if (data.status === "refunded") {
        setResult({ msg: "This payment was refunded.", ok: false });
      } else if (data.status === "amount_mismatch") {
        setResult({ msg: "Amount mismatch — contact support.", ok: false });
      } else if (data.status === "unknown") {
        setResult({ msg: "Could not reach Razorpay. Please try again in a moment.", ok: false });
      } else if (data.status === "enrollment_failed") {
        setResult({ msg: data.message ?? "Enrollment failed. Contact support.", ok: false });
      } else if (data.message) {
        setResult({ msg: data.message, ok: false });
      } else {
        setResult({ msg: `Status: ${data.status ?? "unknown"}`, ok: false });
      }
    } catch {
      setResult({ msg: "Network error — please check your connection and try again.", ok: false });
    } finally {
      setVerifyBusy(false);
    }
  };

  const start = (page - 1) * 20 + 1;
  const end = Math.min(page * 20, totalCount);
  const pageStart = Math.max(1, page - 2);
  const pageEnd = Math.min(totalPages, page + 2);

  const verifyDetails = () => void performCheck(verifyInput, setVerifyResult);
  const verifyStandalone = () => void performCheck(checkInput, setCheckResult);

  return (
    <>
      {/* Toast */}
      <div className={`ph-toast${toast ? ` ph-toast--${toast.type} ph-toast--show` : ""}`} id="phToast" role="alert" aria-live="polite">
        {toast?.msg ?? ""}
      </div>

      <main className="ph-page">
        {/* HERO */}
        <div className="ph-hero" data-reveal="fade-up">
          <div className="ph-hero-text">
            <div className="ph-hero-eyebrow">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              Verified Payment Records
            </div>
            <h1 className="ph-hero-title">Purchase History</h1>
            <p className="ph-hero-sub">
              Every completed payment is recorded here. If you ever paid but weren&apos;t enrolled, share your Payment ID with our support team
              and we&apos;ll fix it instantly.
            </p>
          </div>

          {stats.failedCount > 0 ? (
            <div className="ph-hero-alert">
              <div className="ph-hero-alert-icon">
                <WarningIcon />
              </div>
              <div className="ph-hero-alert-body">
                <div className="ph-hero-alert-title">
                  {stats.failedCount} enrollment issue{stats.failedCount > 1 ? "s" : ""} found
                </div>
                <div className="ph-hero-alert-desc">
                  Click &quot;Contact Support&quot; on the affected row and share the Payment ID to get enrolled.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* STATS ROW */}
        <div className="ph-stats-row" data-reveal="fade-up">
          <div className="ph-stat-pill">
            <div className="ph-stat-icon ph-stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="ph-stat-body">
              <span className="ph-stat-val">{totalCount.toLocaleString()}</span>
              <span className="ph-stat-lbl">Total Purchases</span>
            </div>
          </div>

          <div className="ph-stat-pill">
            <div className="ph-stat-icon ph-stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ph-stat-body">
              <span className="ph-stat-val">
                {currencySymbol}
                {stats.totalSpent.toLocaleString()}
              </span>
              <span className="ph-stat-lbl">Total Spent</span>
            </div>
          </div>

          <div className="ph-stat-pill">
            <div className="ph-stat-icon ph-stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="ph-stat-body">
              <span className="ph-stat-val">{stats.enrolledCount.toLocaleString()}</span>
              <span className="ph-stat-lbl">Successful Enrollments</span>
            </div>
          </div>

          <div className="ph-stat-pill">
            <div className="ph-stat-icon ph-stat-icon--orange">
              <WarningIcon />
            </div>
            <div className="ph-stat-body">
              <span className="ph-stat-val">{stats.failedCount.toLocaleString()}</span>
              <span className="ph-stat-lbl">Needs Attention</span>
            </div>
          </div>
        </div>

        {/* MAIN TABLE CARD */}
        {purchases.length === 0 ? (
          <div className="ph-empty" data-reveal="fade-up">
            <div className="ph-empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5" />
                <line x1="6" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="ph-empty-title">No purchases yet</h2>
            <p className="ph-empty-sub">When you buy a course, the verified payment record will appear here — even before enrollment is confirmed.</p>
            <a href="/browse-courses" className="ph-empty-btn">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Browse Courses
            </a>
          </div>
        ) : (
          <div className="ph-table-card" data-reveal="fade-up">
            <div className="ph-card-header">
              <h2 className="ph-card-title">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                  <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" />
                </svg>
                Payment Records
                <span className="ph-card-count">{totalCount.toLocaleString()}</span>
              </h2>
              <button
                type="button"
                className="ph-support-note ph-support-note--btn"
                id="phOpenCheckModalBtn"
                onClick={() => {
                  lastTriggerRef.current = document.activeElement as HTMLElement;
                  setCheckInput("");
                  setCheckResult(null);
                  setCheckOpen(true);
                  document.body.style.overflow = "hidden";
                }}
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Check Payment Status
              </button>
            </div>

            {/* FILTER BAR */}
            <div className="ph-filter-bar" id="phFilterBar">
              <div className="ph-filter-row">
                <div className="ph-filter-group">
                  <label htmlFor="phFilterStatus">Status</label>
                  <select id="phFilterStatus" defaultValue="">
                    <option value="">All</option>
                    <option value="enrolled">Enrolled</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="failed">Failed</option>
                    <option value="enrollment_failed">Enrollment Failed</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </div>
                <div className="ph-filter-group">
                  <label htmlFor="phFilterFrom">From</label>
                  <input type="date" id="phFilterFrom" />
                </div>
                <div className="ph-filter-group">
                  <label htmlFor="phFilterTo">To</label>
                  <input type="date" id="phFilterTo" />
                </div>
                <button type="button" className="ph-filter-clear" id="phFilterClear">
                  Clear filters
                </button>
              </div>
              <div className="ph-filter-count" id="phFilterCount" />
            </div>

            {/* Table */}
            <div className="ph-table-wrap">
              <table className="ph-table" id="phTable">
                <thead className="ph-thead" id="phThead">
                  <tr>
                    <th className="ph-th ph-th--date ph-th--sortable" data-sort="date" onClick={() => sortTable("date")}>
                      Date <span className="ph-sort-icon" />
                    </th>
                    <th className="ph-th ph-th--courses">Course</th>
                    <th className="ph-th ph-th--amount ph-th--sortable" data-sort="amount" onClick={() => sortTable("amount")}>
                      Amount <span className="ph-sort-icon" />
                    </th>
                    <th className="ph-th ph-th--status">Status</th>
                    <th className="ph-th ph-th--actions">Actions</th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef}>
                  {purchases.map((p) => {
                    const s = STATUS_MAP[p.status] ?? STATUS_MAP.paid!;
                    const created = new Date(p.created_at);
                    const detailsDate = FORMAT_FULL.format(created);
                    const detailsDateRaw = FORMAT_RAW_DATE.format(created);

                    let paymentId: string | null = null;
                    let paymentFallback: string | null = null;
                    if (["pending", "cancelled", "failed", "abandoned"].includes(p.status)) {
                      if (p.status === "pending") paymentFallback = "Not yet available";
                      else if (p.status === "abandoned") paymentFallback = "Unconfirmed — contact support if charged";
                      else paymentFallback = "No payment recorded";
                    } else {
                      paymentId = p.razorpay_payment_id;
                    }

                    const canReceipt = p.status === "enrolled" || p.status === "refunded";

                    const detailsData: ModalDetails = {
                      status: p.status,
                      status_label: s.label,
                      status_class: s.className,
                      order_id: p.razorpay_order_id,
                      receipt_order_id: canReceipt ? p.razorpay_order_id : null,
                      payment_id: paymentId,
                      payment_fallback: paymentFallback,
                      date: detailsDate,
                      amount: `${currencySymbol}${p.amount_rupees} ${currencyCode}`,
                      has_alert: p.status === "enrollment_failed" || p.status === "abandoned",
                      courses: p.courses.map((c) => {
                        const slug = slugMap[String(c.course_id)];
                        return {
                          title: c.title,
                          price: `${currencySymbol}${Number(c.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                          url: slug ? `/course/${encodeURIComponent(slug)}` : null,
                        };
                      }),
                      attempts:
                        p.group_members && p.group_members.length > 1
                          ? p.group_members.map((m) => ({
                              date: FORMAT_FULL.format(new Date(m.created_at)),
                              order_id: m.razorpay_order_id,
                              reason: m.status === "failed" && m.failure_reason ? m.failure_reason : null,
                            }))
                          : null,
                    };

                    const isFailedStyle = p.status === "enrollment_failed" || p.status === "abandoned";
                    const firstCourse = p.courses[0] ?? null;
                    const remainingCount = p.courses.length - 1;
                    const firstSlug = firstCourse ? slugMap[String(firstCourse.course_id)] : null;

                    return (
                      <tr
                        key={String(p.id)}
                        className={`ph-tr ph-tr--clickable${isFailedStyle ? " ph-tr--failed" : ""}`}
                        data-breakdown={JSON.stringify(detailsData)}
                        data-status={p.status}
                        data-date={detailsDateRaw}
                        data-amount={p.amount_rupees}
                        onClick={(e) => openDetails(e.currentTarget as HTMLElement, false)}
                      >
                        <td className="ph-td ph-td--date">
                          <span className="ph-date-primary">{FORMAT_DATE.format(created)}</span>
                          <span className="ph-date-secondary">{FORMAT_TIME.format(created)}</span>
                        </td>

                        <td className="ph-td ph-td--courses">
                          <div className="ph-course-list">
                            {firstCourse ? (
                              <div className="ph-course-item">
                                {firstSlug ? (
                                  <a href={`/course/${encodeURIComponent(firstSlug)}`} className="ph-course-link" onClick={(e) => e.stopPropagation()}>
                                    {firstCourse.title}
                                  </a>
                                ) : (
                                  <span className="ph-course-name">{firstCourse.title}</span>
                                )}
                                {remainingCount > 0 ? (
                                  <span className="ph-course-more" title={p.courses.slice(1).map((c) => c.title).join(", ")}>
                                    +{remainingCount} more
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        <td className="ph-td ph-td--amount">
                          <span className="ph-amount">
                            {currencySymbol}
                            {p.amount_rupees}
                          </span>
                          <span className="ph-currency">{currencyCode}</span>
                        </td>

                        <td className="ph-td ph-td--status">
                          <span className={`ph-badge ${s.className}`}>
                            {s.icon}
                            {s.label}
                          </span>
                          {p.group_members && p.group_members.length > 1 ? (
                            <button
                              type="button"
                              className="ph-group-badge"
                              data-scroll-attempts="1"
                              aria-label={`${p.group_members.length} attempts — click to view`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(e.currentTarget.closest("tr[data-breakdown]") as HTMLElement, true);
                              }}
                            >
                              ×{p.group_members.length}
                            </button>
                          ) : null}
                        </td>

                        <td className="ph-td ph-td--actions">
                          <button
                            type="button"
                            className={`ph-action-btn${isFailedStyle ? " ph-action-btn--failed" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(e.currentTarget.closest("tr[data-breakdown]") as HTMLElement, false);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  <tr id="phFilterEmptyRow" className="ph-tr--filter-empty" hidden>
                    <td className="ph-filter-empty-cell" colSpan={5}>
                      No purchases match these filters.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCount > 0 ? (
              <div className="ph-table-footer">
                <span className="ph-result-count">
                  Showing <strong>{start.toLocaleString()}–{end.toLocaleString()}</strong> of <strong>{totalCount.toLocaleString()}</strong> record
                  {totalCount !== 1 ? "s" : ""}
                </span>

                {totalPages > 1 ? (
                  <nav className="ph-pagination" aria-label="Purchase history pages">
                    {page > 1 ? (
                      <a href={`?page=${page - 1}`} className="ph-page-btn ph-page-btn--arrow" aria-label="Previous page">
                        ‹
                      </a>
                    ) : null}

                    {pageStart > 1 ? <span className="ph-page-ellipsis">1 …</span> : null}
                    {Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i).map((i) => (
                      <a
                        key={i}
                        href={`?page=${i}`}
                        className={`ph-page-btn ${i === page ? "ph-page-btn--active" : ""}`}
                        aria-current={i === page ? "page" : "false"}
                      >
                        {i}
                      </a>
                    ))}
                    {pageEnd < totalPages ? <span className="ph-page-ellipsis">… {totalPages}</span> : null}

                    {page < totalPages ? (
                      <a href={`?page=${page + 1}`} className="ph-page-btn ph-page-btn--arrow" aria-label="Next page">
                        ›
                      </a>
                    ) : null}
                  </nav>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </main>


      {/* DETAILS MODAL — always in the DOM (as in the PHP); .ph-modal-overlay hides it
          until the `--open` modifier is added, so opening never mounts/unmounts it. */}
      <DetailsModal
        open={details !== null}
        details={details}
        attemptsRef={attemptsRef}
        verifyBusy={verifyBusy}
        verifyInput={verifyInput}
        verifyResult={verifyResult}
        onVerifyInput={setVerifyInput}
        onVerify={verifyDetails}
        onClose={closeModal}
        onCopy={copy}
      />

      {/* STANDALONE "CHECK PAYMENT STATUS" MODAL (opened from the card header). */}
      <CheckPaymentModal
        open={checkOpen}
        busy={verifyBusy}
        input={checkInput}
        result={checkResult}
        onInput={setCheckInput}
        onVerify={verifyStandalone}
        onClose={closeModal}
      />

    </>
  );
}

function DetailsModal({
  open,
  details,
  attemptsRef,
  verifyBusy,
  verifyInput,
  verifyResult,
  onVerifyInput,
  onVerify,
  onClose,
  onCopy,
}: {
  open: boolean;
  details: ModalDetails | null;
  attemptsRef: React.RefObject<HTMLDivElement | null>;
  verifyBusy: boolean;
  verifyInput: string;
  verifyResult: { msg: string; ok: boolean } | null;
  onVerifyInput: (v: string) => void;
  onVerify: () => void;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const d = details;

  return (
    <div
      className={`ph-modal-overlay${open ? " ph-modal-overlay--open" : ""}`}
      id="phDetailsModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phDetailsModalTitle"
      hidden={!open}
    >
      <div className="ph-modal">
        <div className="ph-modal-header">
          <h2 className="ph-modal-title" id="phDetailsModalTitle">
            Purchase Details
          </h2>
          <button className="ph-modal-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="ph-modal-body">
          {/* Alert banner - only shown for enrollment_failed / abandoned */}
          {d?.has_alert ? (
            <div className="ph-modal-alert" id="phDetailsAlert">
              <div className="ph-modal-alert-icon">
                <WarningIcon />
              </div>
              <p className="ph-modal-alert-text">
                Your payment was <strong>received and verified</strong>, but enrollment didn&apos;t complete. Copy your Payment ID below and
                email it to our support team &mdash; we&apos;ll enroll you manually within 24 hours.
              </p>
            </div>
          ) : null}

          {/* Self-service order verification - only shown for enrollment_failed / abandoned */}
          {d?.has_alert ? (
            <div className="ph-verify" id="phVerify">
              <p className="ph-verify-label">Or verify it yourself right now:</p>
              <div className="ph-verify-row">
                <input
                  type="text"
                  id="phVerifyOrderId"
                  className="ph-verify-input"
                  placeholder="order_XXXXXXXXXXXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  value={verifyInput}
                  onChange={(e) => onVerifyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onVerify();
                    }
                  }}
                />
                <button type="button" id="phVerifyBtn" className="ph-verify-btn" disabled={verifyBusy} onClick={onVerify}>
                  <span className="ph-verify-btn-text">{verifyBusy ? "Checking…" : "Check & Enroll"}</span>
                  <span className="ph-verify-spinner" hidden={!verifyBusy} />
                </button>
              </div>
              {verifyResult ? (
                <div
                  className={`ph-verify-result ${verifyResult.ok ? "ph-verify-result--success" : "ph-verify-result--error"}`}
                  id="phVerifyResult"
                >
                  {verifyResult.msg}
                </div>
              ) : (
                <div className="ph-verify-result" id="phVerifyResult" hidden />
              )}
            </div>
          ) : null}

          {/* Download Receipt */}
          {d?.receipt_order_id ? (
            <a
              className="ph-verify-btn"
              id="phDownloadReceipt"
              href={`/student/receipt?order=${encodeURIComponent(d.receipt_order_id)}`}
              target="_blank"
              rel="noopener"
              style={{ textDecoration: "none", display: "inline-flex" }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                <path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download Receipt
            </a>
          ) : null}

          {/* Detail grid */}
          <div className="ph-detail-grid">
            <div className="ph-detail-row">
              <span className="ph-detail-label">Status</span>
              <span className="ph-detail-val" id="phDetailsStatus">
                {d ? <span className={`ph-badge ${d.status_class}`}>{d.status_label}</span> : null}
              </span>
            </div>
            <div className="ph-detail-row">
              <span className="ph-detail-label">Order ID</span>
              <span className="ph-detail-val ph-detail-val--mono" id="phDetailsOrderId">
                <span>{d?.order_id || "—"}</span>
                {d ? (
                  <button type="button" className="ph-copy-icon-btn" onClick={() => onCopy(d.order_id)} aria-label="Copy Order ID">
                    <CopyIcon />
                  </button>
                ) : null}
              </span>
            </div>
            <div className="ph-detail-row">
              <span className="ph-detail-label">Payment ID</span>
              <span className="ph-detail-val ph-detail-val--mono" id="phDetailsPaymentId">
                {d?.payment_id ? (
                  <>
                    <span>{d.payment_id}</span>
                    <button type="button" className="ph-copy-icon-btn" onClick={() => onCopy(d.payment_id as string)} aria-label="Copy Payment ID">
                      <CopyIcon />
                    </button>
                  </>
                ) : (
                  <em>{d?.payment_fallback || "—"}</em>
                )}
              </span>
            </div>
            <div className="ph-detail-row">
              <span className="ph-detail-label">Date</span>
              <span className="ph-detail-val" id="phDetailsDate">
                {d?.date}
              </span>
            </div>
            <div className="ph-detail-row">
              <span className="ph-detail-label">Total Amount</span>
              <span className="ph-detail-val" id="phDetailsAmount">
                {d?.amount}
              </span>
            </div>
          </div>

          {/* Numbered course list */}
          <h3 className="ph-breakdown-subtitle">Courses in this purchase</h3>
          <div className="ph-detail-courses" id="phDetailsCourses">
            {d?.courses.map((c, i) => (
              <div className="ph-detail-course-item" key={`${c.title}-${i}`}>
                <span>{i + 1}. </span>
                {c.url ? (
                  <a className="ph-course-link" href={c.url}>
                    {c.title}
                  </a>
                ) : (
                  <span>{c.title}</span>
                )}
                <span> &mdash; {c.price}</span>
              </div>
            ))}
          </div>

          {/* Attempt History (only for collapsed groups) */}
          {d?.attempts && d.attempts.length > 1 ? (
            <div className="ph-detail-attempts" id="phDetailsAttempts" ref={attemptsRef}>
              <h3 className="ph-breakdown-subtitle">Attempt History</h3>
              <div className="ph-history-list" id="phDetailsAttemptsList">
                {d.attempts.map((a, i) => (
                  <div className="ph-history-item" key={`${a.order_id}-${i}`}>
                    <div className="ph-history-top">
                      {a.order_id ? (
                        <button type="button" className="ph-history-order" onClick={() => onCopy(a.order_id)}>
                          {a.order_id}
                        </button>
                      ) : null}
                      <span className="ph-history-date">{a.date}</span>
                    </div>
                    {a.reason ? <span className="ph-history-reason">{a.reason}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ph-detail-attempts" id="phDetailsAttempts" hidden />
          )}
        </div>
      </div>
    </div>
  );
}

function CheckPaymentModal({
  open,
  busy,
  input,
  result,
  onInput,
  onVerify,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  input: string;
  result: { msg: string; ok: boolean } | null;
  onInput: (v: string) => void;
  onVerify: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`ph-modal-overlay${open ? " ph-modal-overlay--open" : ""}`}
      id="phCheckModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phCheckModalTitle"
      hidden={!open}
    >
      <div className="ph-modal">
        <div className="ph-modal-header">
          <h2 className="ph-modal-title" id="phCheckModalTitle">
            Check Payment Status
          </h2>
          <button className="ph-modal-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="ph-modal-body">
          <p className="ph-check-intro">
            Only use this if money was actually deducted from your account but the course still doesn&apos;t show as enrolled. If you
            haven&apos;t completed a payment yet, this won&apos;t find anything &mdash; please checkout normally instead.
          </p>

          <div className="ph-verify">
            <label className="ph-verify-label" htmlFor="phCheckOrderId">
              Razorpay Order ID
            </label>
            <div className="ph-verify-row">
              <input
                type="text"
                id="phCheckOrderId"
                className="ph-verify-input"
                placeholder="order_XXXXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                value={input}
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onVerify();
                  }
                }}
              />
              <button type="button" id="phCheckBtn" className="ph-verify-btn" disabled={busy} onClick={onVerify}>
                <span className="ph-verify-btn-text">{busy ? "Checking…" : "Check & Enroll"}</span>
                <span className="ph-verify-spinner" hidden={!busy} />
              </button>
            </div>
            {result ? (
              <div
                className={`ph-verify-result ${result.ok ? "ph-verify-result--success" : "ph-verify-result--error"}`}
                id="phCheckResult"
              >
                {result.msg}
              </div>
            ) : (
              <div className="ph-verify-result" id="phCheckResult" hidden />
            )}
            <p className="ph-verify-hint">
              You can find your Order ID in the &quot;View Details&quot; popup of the matching row in your Payment Records table below, or in
              your payment confirmation email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
