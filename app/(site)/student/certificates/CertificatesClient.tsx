"use client";

import { useEffect, useState } from "react";
import { siteUrl } from "@/lib/format";

export type CertificateCard = {
  id: number;
  certificate_id: string;
  course_id: number;
  course_name: string;
  thumbnail: string | null;
  issuedAtLabel: string;
};

/** Port of public/student/certificates.php (lines 54-303). */
export default function CertificatesClient({
  certificates,
  search,
  firstCertificateYear,
}: {
  certificates: CertificateCard[];
  search: string;
  firstCertificateYear: string;
}) {
  const total = certificates.length;

  const subtitle =
    total === 0 && search === ""
      ? "Complete courses to earn certificates of achievement."
      : search !== ""
        ? `Showing ${total} result${total !== 1 ? "s" : ""} for “${search}”`
        : `You have earned ${total} certificate${total !== 1 ? "s" : ""}.`;

  return (
    <main className="certs-main">
      <div className="certs-container">
        <div className="certs-page-header">
          <div className="certs-header-blob certs-header-blob--1" />
          <div className="certs-header-blob certs-header-blob--2" />
          <div className="certs-header-blob certs-header-blob--3" />
          <div className="certs-page-header-left">
            <div className="certs-page-eyebrow">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
              My Achievements
            </div>
            <h1 className="certs-page-title">My Certificates</h1>
            <p className="certs-page-subtitle">{subtitle}</p>
          </div>

          <form method="GET" action="" className="certs-search-form">
            <div className="certs-search-wrap">
              <svg className="certs-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                name="search"
                className="certs-search-input"
                placeholder="Search by course or certificate ID…"
                defaultValue={search}
                autoComplete="off"
              />
              {search !== "" ? (
                <a href="/student/certificates" className="certs-search-clear" aria-label="Clear search">
                  ✕
                </a>
              ) : null}
            </div>
            <button type="submit" className="certs-search-btn">
              Search
            </button>
          </form>
        </div>

        {total > 0 && search === "" ? (
          <div className="certs-stats-strip">
            <div className="certs-stat-item">
              <span className="certs-stat-number">{total}</span>
              <span className="certs-stat-label">Certificate{total !== 1 ? "s" : ""} Earned</span>
            </div>
            <div className="certs-stat-divider" />
            <div className="certs-stat-item">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="certs-stat-label">Achievements Unlocked</span>
            </div>
            <div className="certs-stat-divider" />
            <div className="certs-stat-item">
              <span className="certs-stat-number">{firstCertificateYear}</span>
              <span className="certs-stat-label">First Certificate</span>
            </div>
          </div>
        ) : null}

        {total > 0 ? (
          <div className="certs-grid">
            {certificates.map((cert) => {
              const verifyUrl = `${siteUrl("/verify-certificate")}?id=${encodeURIComponent(cert.certificate_id)}`;
              return (
                <div className="cert-card" key={cert.id}>
                  <div className="cert-card-banner">
                    {cert.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={cert.thumbnail} alt={cert.course_name} className="cert-card-thumb" />
                    ) : (
                      <div className="cert-card-thumb-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
                          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}

                    <div className="cert-card-badge">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                      </svg>
                      Certified
                    </div>
                  </div>

                  <div className="cert-card-body">
                    <h3 className="cert-card-course">{cert.course_name}</h3>
                    <div className="cert-card-meta">
                      <div className="cert-card-meta-row">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <span>Issued {cert.issuedAtLabel}</span>
                      </div>
                      <div className="cert-card-meta-row">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                          <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M16 7V5a4 4 0 00-8 0v2" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <span className="cert-card-id">{cert.certificate_id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="cert-card-actions">
                    <a href={`/student/generate-certificate?course=${cert.course_id}`} className="cert-card-btn cert-card-btn--primary">
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      View Certificate
                    </a>
                    <a href={verifyUrl} className="cert-card-btn cert-card-btn--secondary" target="_blank" rel="noopener noreferrer">
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Verify
                    </a>
                    <CertificateCopyButton certificateId={cert.certificate_id} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : search !== "" ? (
          <div className="certs-empty">
            <div className="certs-empty-icon">🔍</div>
            <h2 className="certs-empty-title">No certificates found</h2>
            <p className="certs-empty-text">
              No certificates matched “{search}”. Try a different search term.
            </p>
            <a href="/student/certificates" className="certs-empty-btn">
              Clear Search
            </a>
          </div>
        ) : (
          <div className="certs-empty">
            <div className="certs-empty-icon">🎓</div>
            <h2 className="certs-empty-title">No certificates yet</h2>
            <p className="certs-empty-text">
              Complete a course that offers a certificate to earn your first achievement. Keep learning and you&rsquo;ll be
              rewarded!
            </p>
            <a href="/student/my-courses" className="certs-empty-btn">
              Go to My Courses
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

/** The `.js-copy-cert` handler plus the SVG swap that confirms the copy for 1.5 s. */
function CertificateCopyButton({ certificateId }: { certificateId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(certificateId);
    } catch {
      const tmp = document.createElement("textarea");
      tmp.value = certificateId;
      tmp.style.position = "fixed";
      tmp.style.opacity = "0";
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
    }
    setCopied(true);
    showCertificateToast("Certificate ID copied!");
  };

  return (
    <button className="cert-card-btn cert-card-btn--icon js-copy-cert" title="Copy certificate ID" data-cert-id={certificateId} aria-label="Copy certificate ID" onClick={() => void copy()}>
      <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
        {copied ? (
          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" />
          </>
        )}
      </svg>
    </button>
  );
}

function showCertificateToast(message: string) {
  const toast = document.getElementById("certsToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("certs-toast--show");
  setTimeout(() => toast.classList.remove("certs-toast--show"), 2500);
}