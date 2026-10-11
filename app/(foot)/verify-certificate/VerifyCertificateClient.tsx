"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

export default function VerifyCertificateClient({
  searchId,
  searched,
  cert,
  shareUrl,
  verifyBaseUrl,
}: {
  searchId: string;
  searched: boolean;
  cert: Record<string, unknown> | null;
  shareUrl: string;
  verifyBaseUrl: string;
}) {
  const [value, setValue] = useState(searchId);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  const issued = cert ? new Date(String(cert.issued_at)) : null;
  const issuedLabel = issued
    ? issued.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <>
      <div className="vc-bg" aria-hidden="true">
        <div className="vc-bg__grid" />
        <div className="vc-blob vc-blob--1" /><div className="vc-blob vc-blob--2" /><div className="vc-blob vc-blob--3" />
        {Array.from({ length: 5 }, (_, i) => <div key={i} className={`vc-particle vc-particle--${i + 1}`} />)}
      </div>

      <div className="vc-page">
        <nav className="vc-nav">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages, @next/next/no-img-element */}
          <a href="/" className="vc-nav__logo"><img src="/assets/images/edulari-logo.png" alt="Edulari" /></a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="vc-nav__back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Back to site
          </a>
        </nav>

        <main className="vc-main">
          <div className="vc-hero" data-reveal="fade-up">
            <div className="vc-shield" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h1 className="vc-hero__title">Certificate Verification</h1>
            <p className="vc-hero__sub">Instantly verify the authenticity of any <strong>Edulari</strong> certificate using its unique ID.</p>
          </div>

          <div className="vc-card" data-reveal="fade-up">
            <form
              method="GET"
              action="/verify-certificate"
              className="vc-form"
              id="verifyForm"
              autoComplete="off"
              onSubmit={() => setBusy(true)}
            >
              <div className="vc-form__field">
                <label htmlFor="certificate_id" className="vc-form__label">Certificate ID</label>
                <div className="vc-form__input-wrap">
                  <span className="vc-form__icon" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                  </span>
                  <input
                    type="text"
                    id="certificate_id"
                    name="id"
                    className="vc-form__input"
                    placeholder="e.g. CERT-A1B2-C3D4-E5F6"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    spellCheck={false}
                    required
                  />
                  {value ? (
                    <button type="button" className="vc-form__clear" id="clearBtn" aria-label="Clear" onClick={() => setValue("")}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  ) : null}
                </div>
                <p className="vc-form__hint">Find this on your certificate or in your email from us.</p>
              </div>

              <button type="submit" className="vc-btn vc-btn--primary" id="submitBtn" disabled={busy}>
                <span className="vc-btn__text">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
                  Verify Certificate
                </span>
                <span className="vc-btn__loader" aria-hidden="true" />
              </button>
            </form>
          </div>

          {searched ? (
            cert ? (
              <div className="vc-result vc-result--valid" id="resultPanel" data-reveal="fade-up">
                <div className="vc-result__header">
                  <div className="vc-result__seal">
                    <div className="vc-seal-ring vc-seal-ring--1" />
                    <div className="vc-seal-ring vc-seal-ring--2" />
                    <div className="vc-seal-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    </div>
                  </div>
                  <div className="vc-result__header-text">
                    <h2 className="vc-result__title">Certificate Verified</h2>
                    <p className="vc-result__subtitle">This is an authentic Edulari certificate.</p>
                  </div>
                </div>

                <div className="vc-details">
                  <h3 className="vc-details__heading">Certificate Details</h3>
                  <div className="vc-details__grid">
                    <div className="vc-detail">
                      <span className="vc-detail__icon vc-detail__icon--purple" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                      </span>
                      <div className="vc-detail__body">
                        <span className="vc-detail__label">Certificate ID</span>
                        <span className="vc-detail__value vc-detail__value--mono" id="certIdValue">{String(cert.certificate_id)}</span>
                      </div>
                      <CopyButton value={String(cert.certificate_id)} title="Copy Certificate ID" className="vc-copy-btn" onCopied={() => setToast(true)} />
                    </div>

                    <div className="vc-detail">
                      <span className="vc-detail__icon vc-detail__icon--blue" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </span>
                      <div className="vc-detail__body">
                        <span className="vc-detail__label">Student Name</span>
                        <span className="vc-detail__value">{String(cert.student_name)}</span>
                      </div>
                    </div>

                    <div className="vc-detail">
                      <span className="vc-detail__icon vc-detail__icon--amber" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z" /></svg>
                      </span>
                      <div className="vc-detail__body">
                        <span className="vc-detail__label">Course</span>
                        <span className="vc-detail__value">{String(cert.course_name)}</span>
                      </div>
                    </div>

                    {cert.instructor_name ? (
                      <div className="vc-detail">
                        <span className="vc-detail__icon vc-detail__icon--green" aria-hidden="true">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        </span>
                        <div className="vc-detail__body">
                          <span className="vc-detail__label">Instructor</span>
                          <span className="vc-detail__value">{String(cert.instructor_name)}</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="vc-detail">
                      <span className="vc-detail__icon vc-detail__icon--pink" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      </span>
                      <div className="vc-detail__body">
                        <span className="vc-detail__label">Date Issued</span>
                        <span className="vc-detail__value">{issuedLabel}</span>
                      </div>
                    </div>

                    <div className="vc-detail">
                      <span className="vc-detail__icon vc-detail__icon--purple" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                      </span>
                      <div className="vc-detail__body">
                        <span className="vc-detail__label">Verify URL</span>
                        <span className="vc-detail__value vc-detail__value--url">{shareUrl}</span>
                      </div>
                      <CopyButton value={shareUrl} title="Copy verification link" className="vc-copy-btn" onCopied={() => setToast(true)} />
                    </div>
                  </div>
                </div>

                <div className="vc-result__actions">
                  <a href={verifyBaseUrl} className="vc-btn vc-btn--ghost">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    Verify Another
                  </a>
                  <button type="button" className="vc-btn vc-btn--outline js-print-btn" onClick={() => window.print()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                    Print / Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="vc-result vc-result--invalid" id="resultPanel" data-reveal="fade-up">
                <div className="vc-result__header">
                  <div className="vc-result__seal vc-result__seal--invalid">
                    <div className="vc-seal-ring vc-seal-ring--1" />
                    <div className="vc-seal-ring vc-seal-ring--2" />
                    <div className="vc-seal-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                    </div>
                  </div>
                  <div className="vc-result__header-text">
                    <h2 className="vc-result__title">Not Found</h2>
                    <p className="vc-result__subtitle vc-result__subtitle--invalid">We couldn&apos;t find a certificate matching: <strong>{searchId}</strong></p>
                  </div>
                </div>
                <div className="vc-invalid__tips">
                  <p className="vc-invalid__tips-heading">Things to check:</p>
                  <ul className="vc-invalid__tips-list">
                    <li>Make sure the ID is entered exactly as shown on the certificate</li>
                    <li>Certificate IDs look like: <code>CERT-A1B2-C3D4-E5F6</code></li>
                    <li>Check for accidental spaces before or after the ID</li>
                  </ul>
                </div>
                <div className="vc-result__actions">
                  <a href={verifyBaseUrl} className="vc-btn vc-btn--primary">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    Try Again
                  </a>
                </div>
              </div>
            )
          ) : null}

          <div className="vc-trust" data-reveal="fade-up">
            <div className="vc-trust__item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Tamper-proof records
            </div>
            <div className="vc-trust__sep" aria-hidden="true" />
            <div className="vc-trust__item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Secure verification
            </div>
            <div className="vc-trust__sep" aria-hidden="true" />
            <div className="vc-trust__item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              Instant results
            </div>
          </div>
        </main>
      </div>

      <div className={`vc-toast ${toast ? "is-visible" : ""}`} id="copyToast" role="status" aria-live="polite">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Copied to clipboard!
      </div>
    </>
  );
}
