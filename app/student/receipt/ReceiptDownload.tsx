"use client";

import { useState } from "react";

type ReceiptData = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_rupees: string;
  status: string;
  purchaseDate: string;
  currencySymbol: string;
  currencyCode: string;
  courses: { title: string; price: number }[];
};

/** Port of the receipt.php inline script: html2canvas capture -> jsPDF A4. */
export default function ReceiptDownload({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = () => {
    const el = document.getElementById("receiptPrintArea") as HTMLDivElement | null;
    const html2canvas = (window as unknown as { html2canvas?: (el: HTMLElement, opts: object) => Promise<HTMLCanvasElement> }).html2canvas;
    const jspdfCtor = (window as unknown as { jspdf?: { jsPDF: new (opts: object) => JsPdf } }).jspdf?.jsPDF;

    if (!el || !html2canvas || !jspdfCtor) {
      setFailed(true);
      alert("Download failed. Please try again.");
      return;
    }

    setBusy(true);
    const originalBg = el.style.background;
    el.style.background = "#ffffff";

    html2canvas(el, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 1024,
      windowHeight: Math.max(el.scrollHeight + 200, 1024),
    })
      .then((canvas) => {
        el.style.background = originalBg;
        const imgData = canvas.toDataURL("image/png", 1.0);
        const pdf = new jspdfCtor({ orientation: "portrait", unit: "px", format: "a4", hotfixes: ["px_scaling"] });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(usableWidth / imgWidth, usableHeight / imgHeight);
        const cw = imgWidth * ratio;
        const ch = imgHeight * ratio;
        const ox = (pageWidth - cw) / 2;
        const oy = (pageHeight - ch) / 2;

        pdf.addImage(imgData, "PNG", ox, oy, cw, ch, "", "FAST");
        pdf.save(`Receipt-${orderId}.pdf`);
        setBusy(false);
      })
      .catch((err: unknown) => {
        el.style.background = originalBg;
        setBusy(false);
        setFailed(true);
        alert("Download failed. Please try again.");
        console.error(err);
      });
  };

  return (
    <button className="rcpt-btn rcpt-btn--download" id="downloadBtn" onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? "⏳ Generating…" : "⬇ Download Receipt (PDF)"}
      {failed ? <span className="rcpt-download-error" /> : null}
    </button>
  );
}

type JsPdf = {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addImage(data: string, format: string, x: number, y: number, w: number, h: number, alias?: string, compression?: string): void;
  save(filename: string): void;
};

export type { ReceiptData };
