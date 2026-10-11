import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getPurchaseReceiptData, parseCourses } from "@/lib/db/commerce";
import { CURRENCY_CODE, CURRENCY_DISPLAY_SYMBOL, siteUrl } from "@/lib/format";
import ReceiptDownload from "./ReceiptDownload";
import "@/styles/css/student/receipt.css";

// receipt.php loads this exact font set in <head>. receipt.css declares
//   --font-display: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
// and uses it for the invoice title, "Bill To" heading and footer (rules at lines
// 149/240/328/334). Without Plus Jakarta Sans those headings silently fell back to
// Inter, which has different metrics and a visibly different look.
const RECEIPT_FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap";
export const metadata: Metadata = {
  title: "Payment Receipt — Edulari",
  robots: { index: false, follow: false },
};

const FORMAT_DATE = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default async function ReceiptPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("student");
  const sp = await searchParams;
  const orderId = (sp.order ?? "").trim();

  // Missing order or a receipt the student does not own -> back to purchase history.
  if (!orderId) redirect("/student/purchase-history");

  const receipt = await getPurchaseReceiptData(orderId, user.id);
  if (!receipt) redirect("/student/purchase-history");

  const courses = parseCourses(receipt.courses_json);
  const purchaseDate = FORMAT_DATE.format(new Date(receipt.created_at));
  const statusLabel = receipt.status === "refunded" ? "Refunded" : "Paid";
  const amountRupees = (Number(receipt.amount_paise) / 100).toFixed(2);

  return (
    <>
      {/* receipt.php ships its own <head> with no site navbar/footer, so this page
          lives outside the (site) route group and never loads navbar.css. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={RECEIPT_FONT} />
      </head>

      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="afterInteractive" />

      <div className="rcpt-page">
        <div className="rcpt-actions no-print">
          <a href="/student/purchase-history" className="rcpt-btn rcpt-btn--back">
            ← Back to Purchase History
          </a>
          <ReceiptDownload orderId={receipt.razorpay_order_id} />
        </div>

        <div className="rcpt-card" id="receiptPrintArea">
          <div className="rcpt-header">
            <div className="rcpt-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/images/edulari-logo.png" alt="Edulari" className="rcpt-logo-img" />
            </div>
            <div className="rcpt-title-group">
              <h1 className="rcpt-title">Invoice</h1>
              <p className="rcpt-subtitle">Payment Receipt &mdash; #{receipt.razorpay_order_id.slice(0, 12)}</p>
            </div>
          </div>

          <div className="rcpt-meta">
            <div className="rcpt-meta-col">
              <div className="rcpt-meta-row">
                <span className="rcpt-meta-label">Invoice Date</span>
                <span className="rcpt-meta-value">{purchaseDate}</span>
              </div>
              <div className="rcpt-meta-row">
                <span className="rcpt-meta-label">Status</span>
                <span className={`rcpt-meta-badge rcpt-meta-badge--${receipt.status === "refunded" ? "refunded" : "paid"}`}>{statusLabel}</span>
              </div>
            </div>
            <div className="rcpt-meta-col rcpt-meta-col--right">
              <div className="rcpt-meta-row">
                <span className="rcpt-meta-label">Order ID</span>
                <span className="rcpt-meta-value rcpt-meta-value--mono">{receipt.razorpay_order_id}</span>
              </div>
              <div className="rcpt-meta-row">
                <span className="rcpt-meta-label">Payment ID</span>
                <span className="rcpt-meta-value rcpt-meta-value--mono">{receipt.razorpay_payment_id}</span>
              </div>
            </div>
          </div>

          <div className="rcpt-billto">
            <h2 className="rcpt-section-title">Bill To</h2>
            <div className="rcpt-billto-details">
              <p className="rcpt-billto-name">{user.name}</p>
              <p className="rcpt-billto-email">{user.email}</p>
            </div>
          </div>

          <div className="rcpt-items">
            <table className="rcpt-table">
              <thead>
                <tr>
                  <th className="rcpt-th rcpt-th--item">Course</th>
                  <th className="rcpt-th rcpt-th--price">Amount</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, i) => (
                  <tr className="rcpt-tr" key={`${course.course_id}-${i}`}>
                    <td className="rcpt-td rcpt-td--item">{course.title}</td>
                    <td className="rcpt-td rcpt-td--price">
                      {CURRENCY_DISPLAY_SYMBOL}
                      {Number(course.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="rcpt-tr rcpt-tr--total">
                  <td className="rcpt-td rcpt-td--item">Total</td>
                  <td className="rcpt-td rcpt-td--price rcpt-total-amount">
                    {CURRENCY_DISPLAY_SYMBOL}
                    {amountRupees} <span className="rcpt-currency-code">{CURRENCY_CODE}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rcpt-footer">
            <p className="rcpt-footer-note">This is a computer-generated receipt and does not require a signature.</p>
            <p className="rcpt-footer-site">
              Edulari &mdash; {siteUrl("").replace(/\/$/, "")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
