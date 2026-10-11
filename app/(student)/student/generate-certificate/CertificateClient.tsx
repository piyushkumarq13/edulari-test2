"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { siteUrl } from "@/lib/format";
import { CERTIFICATE_SIGNATORY_NAME, SITE_NAME } from "@/lib/site";
import "@/styles/css/student/generate-certificate.css";

/**
 * The certificate canvas dimensions from generate-certificate.php. The wrapper is
 * 1122 x 730 px and the html2canvas / jsPDF export runs at 1122 x 794.
 */
const CERT_W = 1122;
const CERT_H = 730;
const PDF_W = 1122;
const PDF_H = 794;

const QRCODE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
const HTML2CANVAS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const JSPDF_SRC = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const CERT_FONTS =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap";

type Props = {
  courseId: number;
  certificateId: string;
  studentName: string;
  courseName: string;
  issuedDate: string;
  enrolledDate: string;
  completedDate: string;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("cdn load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () => reject(new Error("cdn load failed")));
    document.head.appendChild(s);
  });
}

/** Port of generate-certificate.php's page body plus its inline script. */
export default function CertificateClient(props: Props) {
  const { courseId, certificateId, studentName, courseName, issuedDate, enrolledDate, completedDate } = props;

  const verifyUrl = `${siteUrl("/verify-certificate")}?id=${encodeURIComponent(certificateId)}`;

  const scaleContainerRef = useRef<HTMLDivElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const downloadRef = useRef<HTMLButtonElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fixed-canvas scaling: scale = min(1, (pageWrap.clientWidth - 80) / CERT_W).
  const scaleCertificate = useCallback(() => {
    const wrapper = printAreaRef.current;
    const container = scaleContainerRef.current;
    const pageWrap = pageWrapRef.current;
    if (!wrapper || !container || !pageWrap) return;

    const available = pageWrap.clientWidth - 80;
    const scale = Math.min(1, available / CERT_W);

    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.transformOrigin = "top left";
    container.style.width = `${CERT_W * scale}px`;
    container.style.height = `${CERT_H * scale}px`;
  }, []);

  useEffect(() => {
    scaleCertificate();
    window.addEventListener("resize", scaleCertificate);
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) scaleCertificate();
      });
    } else {
      window.addEventListener("load", scaleCertificate);
    }
    return () => {
      cancelled = true;
      window.removeEventListener("resize", scaleCertificate);
      window.removeEventListener("load", scaleCertificate);
    };
  }, [scaleCertificate]);

  // QR code (qrcodejs, CorrectLevel.M) rendered into #qrcode.
  useEffect(() => {
    let cancelled = false;
    void loadScript(QRCODE_SRC)
      .then(() => {
        if (cancelled) return;
        const host = document.getElementById("qrcode");
        if (!host) return;
        host.replaceChildren();
        const QRCodeCtor = (
          window as unknown as {
            QRCode?: new (el: HTMLElement, opts: { text: string; width: number; height: number; colorDark: string; colorLight: string; correctLevel: number }) => void;
            QRCodeCorrectLevel?: { M: number };
          }
        ).QRCode;
        if (!QRCodeCtor) return;
        const level =
          (window as unknown as { QRCode: { CorrectLevel: { M: number } } }).QRCode?.CorrectLevel?.M ?? 0;
        new QRCodeCtor(host, {
          text: verifyUrl,
          width: 100,
          height: 100,
          colorDark: "#1a3a6e",
          colorLight: "#ffffff",
          correctLevel: level,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  const downloadCertificate = useCallback(async () => {
    const btn = downloadRef.current;
    const wrapper = printAreaRef.current;
    if (!btn || !wrapper) return;
    btn.disabled = true;
    btn.textContent = "⏳ Generating…";

    const prevTransform = wrapper.style.transform;
    const prevPosition = wrapper.style.position;
    wrapper.style.transform = "none";
    wrapper.style.position = "relative";

    try {
      await loadScript(HTML2CANVAS_SRC);
      await loadScript(JSPDF_SRC);
      const html2canvas = (window as unknown as { html2canvas: (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement> }).html2canvas;
      const jspdfNs = (window as unknown as { jspdf?: { jsPDF: new (opts: Record<string, unknown>) => { addImage: (d: string, f: string, x: number, y: number, w: number, h: number, u: string, c: string) => void; save: (n: string) => void } } }).jspdf;
      if (!html2canvas || !jspdfNs) throw new Error("libraries unavailable");

      const canvas = await html2canvas(wrapper, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        width: PDF_W,
        height: PDF_H,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });

      wrapper.style.transform = prevTransform;
      wrapper.style.position = prevPosition;

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jspdfNs.jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [PDF_W, PDF_H],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(imgData, "PNG", 0, 0, PDF_W, PDF_H, "", "FAST");

      const fileName =
        "Certificate-" +
        studentName.replace(/\s+/g, "-") +
        "-" +
        courseName.replace(/\s+/g, "-").substring(0, 30) +
        ".pdf";
      pdf.save(fileName);
    } catch (err) {
      console.error(err);
      alert("Download failed. Please try again.");
    } finally {
      wrapper.style.transform = prevTransform;
      wrapper.style.position = prevPosition;
      btn.disabled = false;
      btn.textContent = "⬇ Download Certificate";
      setDownloading(false);
    }
  }, [studentName, courseName]);

  const copyVerifyLink = () => {
    const input = document.getElementById("verifyLinkInput") as HTMLInputElement | null;
    if (!input) return;
    input.select();
    document.execCommand("copy");
    alert("Verification link copied!");
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={CERT_FONTS} />

      <div className="cert-page-wrapper" ref={pageWrapRef}>
        <div className="cert-actions no-print">
          <a href={`/student/learn?course=${courseId}`} className="cert-btn-back">
            ← Back to Course
          </a>
          <button
            className="cert-btn-download"
            id="downloadBtn"
            ref={downloadRef}
            disabled={downloading}
            onClick={() => void downloadCertificate()}
          >
            ⬇ Download Certificate
          </button>
          <a href="/student/my-courses" className="cert-btn-back">
            My Courses
          </a>
        </div>

        <div className="cert-scale-container" id="certScaleContainer" ref={scaleContainerRef}>
          <div className="certificate-wrapper" id="certificatePrintArea" ref={printAreaRef}>
            <div className="cert-inner-border" />

            <div className="cert-header-row">
              <div className="cert-logo-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/edulari-logo.png" alt="Edulari Logo" className="cert-logo-img" />
              </div>
              <div className="cert-brand-right">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/images/verified-badge.png" alt="Verified Badge" className="cert-verified-img" />
              </div>
            </div>

            <div className="cert-main-body">
              <div className="cert-watermark-grid" />

              <div className="cert-center-stamp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/images/edulari-stamp.png"
                  alt="Edulari Verified Stamp"
                  className="cert-center-stamp-img"
                />
              </div>

              <div className="cert-title-block">
                <svg className="cert-title-svg" viewBox="0 0 1000 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <path id="titleArc" d="M 50,90 Q 500,10 950,90" />
                  </defs>
                  <text className="cert-title-text" textAnchor="middle">
                    <textPath href="#titleArc" startOffset="50%">
                      CERTIFICATE OF COMPLETION
                    </textPath>
                  </text>
                </svg>
              </div>

              <div className="cert-certify-line">
                <em>This is to certify that</em>
              </div>

              <div className="cert-name-block">
                <div className="cert-student-name">{studentName}</div>
              </div>

              <div className="cert-completion-text">
                having <strong>{certificateId}</strong> has successfully completed the course
              </div>

              <div className="cert-course-block">
                <div className="cert-course-name">{courseName}</div>
              </div>

              <div className="cert-period-text">
                <em>from the period</em>
                <strong>
                  {enrolledDate} &ndash; {completedDate}
                </strong>
              </div>

              <div className="cert-footer-row">
                <div className="cert-footer-left">
                  <div className="cert-footer-label-bold">Date of Issue: {issuedDate}</div>
                  <div className="cert-footer-place">
                    <strong>Place:</strong> {SITE_NAME} Online Platform
                  </div>

                  <div className="cert-footer-validity">
                    <div className="cert-validity-row">
                      <span className="cert-validity-label">Valid Until:</span>
                      <span className="cert-validity-value">Lifetime</span>
                    </div>
                  </div>

                  <div className="cert-footer-verify">
                    <div className="cert-verify-label">Verify this certificate at:</div>
                    <div className="cert-verify-url">{siteUrl("")}/verify-certificate</div>
                  </div>
                </div>

                <div className="cert-footer-center">
                  <div id="qrcode" />
                  <div className="cert-footer-label-bold">Certificate Id: {certificateId}</div>
                </div>

                <div className="cert-footer-right">
                  <div className="cert-footer-label-bold">Signing Authority:</div>
                  <div className="cert-badge-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/ceo_signature.svg" alt="CEO Signature" className="cert-signature-img" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/verified-badge-footer.png" alt="Verified Badge" className="cert-badge-img" />
                  </div>
                  <div className="cert-authority-divider" />
                  <div className="cert-authority-name">
                    {CERTIFICATE_SIGNATORY_NAME}
                    <span className="cert-ceo-title">Founder &amp; CEO, {SITE_NAME}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cert-share-section no-print">
          <h3>Share Your Achievement</h3>
          <div className="cert-id-display">
            Certificate ID: <strong>{certificateId}</strong>
          </div>
          <div className="cert-verify-link">
            Verification Link:
            <input type="text" readOnly value={verifyUrl} id="verifyLinkInput" onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button id="copyVerifyBtn" onClick={copyVerifyLink}>
              Copy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
