import type { Metadata } from "next";
import "@/styles/css/instructor/earnings.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireInstructorApproved } from "@/lib/auth/guards";
import {
  getEarningsTotals,
  getMonthlyEarnings,
  getTopEarningCourses,
  getRecentSales,
  getAvailableYears,
  getInstructorPayouts,
  getTotalPayoutsForInstructor,
  pendingBalance,
} from "@/lib/db/instructor/earnings";
import {
  formatPrice,
  formatMonthDayYear,
  formatClock12PHPM,
  phpNumber,
  ucfirst,
} from "@/lib/format";
import { toNumber } from "@/lib/payments/amounts";
import EarningsChart from "@/components/instructor/EarningsChart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Earnings – Edulari",
  description: "Track your revenue, sales history and payouts.",
  noindex: true,
  canonical: false,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function InstructorEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireInstructorApproved();
  const sp = await searchParams;

  const now = new Date();
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now),
  );
  const filterYear = Number(sp.year ?? currentYear) || currentYear;
  const filterMonth = Math.max(0, Math.min(12, Number(sp.month ?? 0) || 0));

  const [totals, monthly, topCourses, recentSales, years, payouts, paidOut] = await Promise.all([
    getEarningsTotals(user.id),
    getMonthlyEarnings(user.id, filterYear),
    getTopEarningCourses(user.id),
    getRecentSales(user.id, filterYear, filterMonth),
    getAvailableYears(user.id),
    getInstructorPayouts(user.id),
    getTotalPayoutsForInstructor(user.id),
  ]);

  const availableYears = years.length > 0 ? years : [currentYear];
  const balance = pendingBalance(totals.total_earnings, paidOut);
  const maxRevenue = Math.max(1, topCourses[0]?.revenue ?? 1);

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(now);
  const yearLabel = String(currentYear);

  return (
    <main className="in-page-wrap earn-wrap">
      <div className="earn-page-header">
        <div>
          <h1 className="earn-page-title">Earnings</h1>
          <p className="earn-page-sub">Track your revenue, sales history and top‑performing courses.</p>
        </div>
      </div>

      <div className="earn-kpi-grid">
        <div className="earn-kpi-card earn-kpi-card--green">
          <div className="earn-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="earn-kpi-body">
            <span className="earn-kpi-label">Total Earnings</span>
            <span className="earn-kpi-value">{formatPrice(totals.total_earnings)}</span>
            <span className="earn-kpi-sub">All time</span>
          </div>
        </div>

        <div className="earn-kpi-card earn-kpi-card--blue">
          <div className="earn-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className="earn-kpi-body">
            <span className="earn-kpi-label">This Month</span>
            <span className="earn-kpi-value">{formatPrice(totals.this_month)}</span>
            <span className="earn-kpi-sub">{monthLabel}</span>
          </div>
        </div>

        <div className="earn-kpi-card earn-kpi-card--purple">
          <div className="earn-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="earn-kpi-body">
            <span className="earn-kpi-label">This Year</span>
            <span className="earn-kpi-value">{formatPrice(totals.this_year)}</span>
            <span className="earn-kpi-sub">{yearLabel}</span>
          </div>
        </div>

        <div className="earn-kpi-card earn-kpi-card--orange">
          <div className="earn-kpi-icon">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="earn-kpi-body">
            <span className="earn-kpi-label">Total Students</span>
            <span className="earn-kpi-value">{phpNumber(totals.total_students)}</span>
            <span className="earn-kpi-sub">Enrolled across all courses</span>
          </div>
        </div>
      </div>

      <div className="earn-two-col">
        <div className="earn-card earn-card--chart">
          <div className="earn-card-header">
            <h2 className="earn-card-title">Monthly Revenue</h2>
            <form className="earn-year-form" method="get" action="/instructor/earnings">
              <label htmlFor="chartYear" className="sr-only">Year</label>
              <select name="year" id="chartYear" className="earn-select" defaultValue={String(filterYear)}>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {filterMonth ? <input type="hidden" name="month" value={filterMonth} /> : null}
            </form>
          </div>
          <EarningsChart
            revenue={monthly.map((m) => m.revenue)}
            sales={monthly.map((m) => m.sales)}
            year={filterYear}
          />
        </div>

        <div className="earn-card">
          <div className="earn-card-header">
            <h2 className="earn-card-title">Top Courses</h2>
          </div>
          {topCourses.length > 0 ? (
            <ul className="earn-top-list">
              {topCourses.map((tc, i) => {
                const pct = maxRevenue > 0 ? Math.round((tc.revenue / maxRevenue) * 100) : 0;
                return (
                  <li className="earn-top-item" key={i}>
                    <span className="earn-top-rank">{i + 1}</span>
                    <div className="earn-top-info">
                      <span className="earn-top-name">{tc.title}</span>
                      <div className="earn-top-bar-wrap">
                        <div className="earn-top-bar" style={{ "--bar-pct": `${pct}%` } as React.CSSProperties} />
                      </div>
                      <span className="earn-top-meta">{`${tc.enrollments} students · ${formatPrice(tc.revenue)}`}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="earn-empty">No course data yet.</p>
          )}
        </div>
      </div>

      <div className="earn-card">
        <div className="earn-card-header">
          <h2 className="earn-card-title">Sales Transactions</h2>

          <form className="earn-filter-form" method="get" action="/instructor/earnings">
            <label htmlFor="fYear" className="sr-only">Year</label>
            <select name="year" id="fYear" className="earn-select" defaultValue={String(filterYear)}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <label htmlFor="fMonth" className="sr-only">Month</label>
            <select name="month" id="fMonth" className="earn-select" defaultValue={String(filterMonth)}>
              <option value="0">All Months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <button type="submit" className="earn-filter-btn">Filter</button>
            <a href="/instructor/earnings" className="earn-reset-btn">Reset</a>
          </form>
        </div>

        {recentSales.length > 0 ? (
          <div className="earn-table-wrap">
            <table className="earn-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th className="earn-th-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, i) => (
                  <tr key={i}>
                    <td className="earn-td-date">
                      <span className="earn-date-main">{formatMonthDayYear(sale.enrolled_at)}</span>
                      <span className="earn-date-time">{formatClock12PHPM(sale.enrolled_at)}</span>
                    </td>
                    <td>
                      <span className="earn-student-name">{sale.student_name}</span>
                    </td>
                    <td className="earn-td-course">{sale.course_title}</td>
                    <td className="earn-td-amount">
                      {toNumber(sale.price) > 0 ? (
                        <span className="earn-amount">{formatPrice(toNumber(sale.price))}</span>
                      ) : (
                        <span className="earn-amount earn-amount--free">Free</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="earn-empty-state">
            <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p>No sales found for the selected period.</p>
            <a href="/instructor/earnings" className="earn-reset-btn">Clear filters</a>
          </div>
        )}
      </div>

      {/* Payout history */}
      <div className="earn-card" style={{ marginTop: "1.5rem" }}>
        <div className="earn-card-header">
          <h2 className="earn-card-title">Payout History</h2>
          <div className="earn-balance-summary">
            <span className="earn-balance-label">Pending Balance:</span>
            <span className="earn-balance-value">{formatPrice(balance)}</span>
          </div>
        </div>
        {payouts.length > 0 ? (
          <div className="earn-table-wrap">
            <table className="earn-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th className="earn-th-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="earn-td-date">
                      <span className="earn-date-main">{formatMonthDayYear(p.created_at)}</span>
                      {p.paid_at ? <span className="earn-date-time">{`Paid ${formatMonthDayYear(p.paid_at)}`}</span> : null}
                    </td>
                    <td>
                      <span className="earn-amount">{formatPrice(toNumber(p.amount))}</span>
                    </td>
                    <td>{p.payment_method || "—"}</td>
                    <td>
                      <span style={{ fontSize: "12px" }}>{p.reference_no || "—"}</span>
                    </td>
                    <td>{p.note || "—"}</td>
                    <td className="earn-th-right">
                      <span style={payoutPillStyle(p.status)}>{ucfirst(p.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--earn-border)" }}>
                  <td style={{ fontWeight: 600, padding: ".75rem 1rem" }}>Total Paid Out</td>
                  <td style={{ fontWeight: 600, padding: ".75rem 1rem" }}>{formatPrice(paidOut)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="earn-empty-state">
            <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <p>No payouts recorded yet. Payouts are added by the admin.</p>
          </div>
        )}
      </div>
    </main>
  );
}

/** The inline status pill styles, copied verbatim from earnings.php's $colors map. */
function payoutPillStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 500 };
  if (status === "paid") return { ...base, background: "#dcfce7", color: "#16a34a" };
  if (status === "pending") return { ...base, background: "#fef3c7", color: "#b45309" };
  if (status === "cancelled") return { ...base, background: "#fee2e2", color: "#dc2626" };
  return base;
}