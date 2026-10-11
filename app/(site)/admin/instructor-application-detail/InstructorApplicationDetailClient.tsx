"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { TEST_PASS_SCORE } from "@/lib/instructor/test-constants";

export interface SiblingView {
  prevId: number | null;
  nextId: number | null;
  posLabel: string;
}

export interface ApplicationDetailView {
  id: number;
  applicantName: string;
  applicantEmail: string;
  headline: string;
  avatarInitials: string;
  avatarColor: string;
  website: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  expLabel: string;
  teachingStyle: string;
  registeredDate: string;
  submittedFull: string;
  submittedDay: string;
  timeAgo: string;
  reviewedAt: string | null;
  primarySubject: string;
  skillLevel: string;
  secondarySubjects: string;
  targetAudience: string;
  courseIdeas: string;
  sampleContentUrl: string;
  highestEducation: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: number | null;
  certifications: string;
  professionalExp: string;
  notableWorks: string;
  bio: string;
  fullLegalName: string;
  panMasked: string;
  panFull: string;
  bankMasked: string;
  bankFull: string;
  ifscCode: string;
  upiId: string;
  accountHolder: string;
  revenueShareAck: boolean;
  termsAgreed: boolean;
  contentPolicy: boolean;
  allPoliciesAgreed: boolean;
  testScore: number | null;
  testPassed: boolean;
  testTimeTakenSeconds: number | null;
  status: string;
  statusLabel: string;
  statusBadge: string;
  statusIcon: string;
  statusIconSvg: string;
  decisionCard: string;
  govtIdUrl: string | null;
  marksheetUrl: string | null;
  hasDocs: boolean;
  rejectionReason: string;
}

interface Props {
  view: ApplicationDetailView;
  siblings: SiblingView;
  csrfToken: string;
  initialMessage: string;
  initialError: string;
  initialMsgType: "success" | "danger";
}

const TABS = ["overview", "credentials", "competency", "legal"] as const;
type TabKey = (typeof TABS)[number];

/** PHP nl2br(htmlspecialchars(...)) — the CSS keeps pre-wrap, matching PHP output. */
function nl2br(text: string): React.ReactNode[] {
  return text.split("\n").map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {part}
    </Fragment>
  ));
}

export default function InstructorApplicationDetailClient({
  view,
  siblings,
  csrfToken,
  initialMessage,
  initialError,
  initialMsgType,
}: Props) {
  const { prevId, nextId, posLabel } = siblings;

  const [tab, setTab] = useState<TabKey>(() => {
    const h = window.location.hash.replace("#", "");
    return (TABS as readonly string[]).includes(h) ? (h as TabKey) : "overview";
  });
  const [rejectPanelOpen, setRejectPanelOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [panShown, setPanShown] = useState(false);
  const [bankShown, setBankShown] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);
  const rejectInputRef = useRef<HTMLTextAreaElement>(null);
  const modalHostRef = useRef<HTMLDivElement>(null);

  const testScore = view.testScore;
  const ringOffset = testScore !== null ? Math.round(207.3 * (1 - testScore / 100)) : 207.3;

  const switchTab = (key: TabKey) => {
    setTab(key);
    history.replaceState(null, "", `#${key}`);
  };

  // Auto-dismiss alert after 6s (PHP detail inline script).
  useEffect(() => {
    if (!message && !error) return;
    const t = setTimeout(() => {
      setMessage("");
      setError("");
    }, 6000);
    return () => clearTimeout(t);
  }, [message, error]);

  // Escape closes modals and the reject panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setApproveOpen(false);
        setRejectModalOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Body scroll lock while a modal is open + focus the modal's primary control.
  useEffect(() => {
    const open = approveOpen || rejectModalOpen;
    document.body.style.overflow = open ? "hidden" : "";
    if (open && modalHostRef.current) {
      const t = setTimeout(() => {
        const btn = modalHostRef.current?.querySelector<HTMLButtonElement>("[data-submit-form], .iad-modal-close");
        btn?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [approveOpen, rejectModalOpen]);

  const toggleRejectPanel = () => {
    const next = !rejectPanelOpen;
    setRejectPanelOpen(next);
    if (next) setTimeout(() => rejectInputRef.current?.focus(), 50);
  };

  const submitForm = (formId: string) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (form && form instanceof HTMLFormElement) form.requestSubmit();
  };

  const docBtn = (url: { toString: () => string } | null, label: string) => {
    return url ? (
      <a className="iad-doc-btn" href={url.toString()} target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {label}
        <span className="iad-doc-ext">↗</span>
      </a>
    ) : null;
  };

  const field = (label: string, value: string, full = false) => (
    <div className={full ? "iad-info-item iad-info-item--full" : "iad-info-item"}>
      <span className="iad-info-label">{label}</span>
      <span className="iad-info-val">{value ? value : <span className="iad-empty">—</span>}</span>
    </div>
  );

  const maskedRow = (
    label: string,
    masked: string,
    full: string,
    shown: boolean,
    onToggle: () => void,
    alwaysShowButton = false,
  ) => (
    <div className="iad-info-item">
      <span className="iad-info-label">{label}</span>
      <div className="iad-masked">
        <span className="iad-masked-text" data-full={full || undefined}>
          {shown ? full : masked}
        </span>
        {(alwaysShowButton || full) && (
          <button
            type="button"
            className="iad-reveal-btn js-reveal-btn"
            data-full={full || undefined}
            onClick={onToggle}
          >
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );

  const policyItem = (agreed: boolean, label: string) => (
    <li className={agreed ? "iad-policy-item iad-policy-item--agreed" : "iad-policy-item iad-policy-item--missing"}>
      <span className="iad-policy-icon" aria-hidden="true">
        {agreed ? "✓" : "✕"}
      </span>
      <span className="iad-policy-text">{label}</span>
      <span className="iad-policy-status">{agreed ? "Agreed" : "Not Agreed"}</span>
    </li>
  );

  const statusSvg =
    view.statusIconSvg === "check" ? (
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ) : view.statusIconSvg === "x" ? (
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    );

  const timelineItems = [
    { title: "Account Registered", date: view.registeredDate, cls: "done" },
    { title: "Application Submitted", date: view.submittedDay, cls: "done" },
    {
      title: "Admin Review",
      date: view.reviewedAt ?? "",
      cls: view.reviewedAt ? "done" : view.status === "pending" || view.status === "draft" ? "current" : "pending",
    },
    {
      title: view.statusLabel,
      date: view.reviewedAt ?? "",
      cls: view.status === "approved" ? "approved" : view.status === "rejected" || view.status === "test_failed" ? "rejected" : "pending",
    },
  ];

  const apiAction = `/api/admin/instructor-applications/${view.id}`;

  return (
    <div className="ad-page-wrap">
      <main className="iad-page">
        <div className="iad-inner">
          {/* ── Topbar ── */}
          <div className="iad-topbar">
            <div className="iad-topbar-left">
              <a href="/admin/instructor-applications" className="iad-back-btn">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Back to Applications
              </a>
              <div className="iad-breadcrumb">
                <a href="/admin/instructor-applications">Applications</a>
                <span className="iad-breadcrumb-sep">›</span>
                <span className="iad-breadcrumb-current">#{view.id}</span>
              </div>
            </div>
            <div className="iad-app-nav" role="navigation" aria-label="Adjacent applications">
              {prevId !== null ? (
                <a className="iad-app-nav-btn" href={`/admin/instructor-application-detail?id=${prevId}`} aria-label="Previous application">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              ) : (
                <span className="iad-app-nav-btn iad-app-nav-btn--disabled" aria-disabled="true">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
              <span className="iad-app-nav-pos">{posLabel}</span>
              {nextId !== null ? (
                <a className="iad-app-nav-btn" href={`/admin/instructor-application-detail?id=${nextId}`} aria-label="Next application">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              ) : (
                <span className="iad-app-nav-btn iad-app-nav-btn--disabled" aria-disabled="true">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
            </div>
          </div>

          {/* ── Page head ── */}
          <div className="iad-page-head">
            <div className="iad-page-head-left">
              <h1 className="iad-page-title">
                <svg viewBox="0 0 24 24" fill="none" width="24" height="24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <polyline points="9 13 11 15 15 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Application #{view.id}
              </h1>
              <p className="iad-page-subtitle">
                Submitted {view.submittedFull}
                <span className="iad-time-chip">{view.timeAgo}</span>
              </p>
            </div>
            <span className={`iad-badge ${view.statusBadge}`}>
              {statusSvg} {view.statusLabel}
            </span>
          </div>

          {/* ── Alert ── */}
          {message && !error && (
            <div className={`iad-alert iad-alert--${initialMsgType}`} id="iadAlert" role="alert">
              {message}
              <button className="iad-alert-close js-dismiss-alert" aria-label="Dismiss" onClick={() => setMessage("")}>×</button>
            </div>
          )}
          {error && (
            <div className="iad-alert iad-alert--danger" id="iadAlert" role="alert">
              {error}
              <button className="iad-alert-close js-dismiss-alert" aria-label="Dismiss" onClick={() => setError("")}>×</button>
            </div>
          )}

          <div className="iad-layout">
            {/* ══════════ SIDEBAR ══════════ */}
            <aside className="iad-sidebar">
              {/* Profile card */}
              <div className="iad-card iad-profile-card">
                <div className="iad-card-header">
                  <h2 className="iad-card-title">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
                    Applicant
                  </h2>
                </div>
                <div className="iad-profile-head">
                  <div className="iad-avatar" style={{ background: view.avatarColor }} aria-hidden="true">
                    {view.avatarInitials}
                  </div>
                  <div className="iad-profile-info">
                    <h3 className="iad-profile-name">{view.applicantName}</h3>
                    <p className="iad-profile-email">{view.applicantEmail}</p>
                    {view.headline && <p className="iad-profile-headline">{view.headline}</p>}
                  </div>
                </div>
                {(view.website || view.linkedinUrl || view.twitterUrl) && (
                  <div className="iad-social-row">
                    {view.website && (
                      <a className="iad-social-btn" href={view.website} target="_blank" rel="noopener noreferrer">Website</a>
                    )}
                    {view.linkedinUrl && (
                      <a className="iad-social-btn iad-social-btn--linkedin" href={view.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    )}
                    {view.twitterUrl && (
                      <a className="iad-social-btn iad-social-btn--twitter" href={view.twitterUrl} target="_blank" rel="noopener noreferrer">Twitter</a>
                    )}
                  </div>
                )}
                <div className="iad-card-body">
                  <dl className="iad-meta-list">
                    <div className="iad-meta-row">
                      <dt className="iad-meta-key">Email Verified</dt>
                      <dd className="iad-meta-val">
                        <span className={view.emailVerified ? "iad-pill iad-pill--success" : "iad-pill iad-pill--warning"}>
                          {view.emailVerified ? "Yes" : "No"}
                        </span>
                      </dd>
                    </div>
                    <div className="iad-meta-row">
                      <dt className="iad-meta-key">Account Status</dt>
                      <dd className="iad-meta-val">
                        <span className={view.isActive ? "iad-pill iad-pill--success" : "iad-pill iad-pill--danger"}>
                          {view.isActive ? "Active" : "Blocked"}
                        </span>
                      </dd>
                    </div>
                    <div className="iad-meta-row">
                      <dt className="iad-meta-key">Registered</dt>
                      <dd className="iad-meta-val">{view.registeredDate}</dd>
                    </div>
                    <div className="iad-meta-row">
                      <dt className="iad-meta-key">Submitted</dt>
                      <dd className="iad-meta-val">{view.submittedDay}</dd>
                    </div>
                    {view.reviewedAt && (
                      <div className="iad-meta-row">
                        <dt className="iad-meta-key">Reviewed</dt>
                        <dd className="iad-meta-val">{view.reviewedAt}</dd>
                      </div>
                    )}
                    <div className="iad-meta-row">
                      <dt className="iad-meta-key">Experience</dt>
                      <dd className="iad-meta-val">{view.expLabel}</dd>
                    </div>
                    {view.teachingStyle && (
                      <div className="iad-meta-row">
                        <dt className="iad-meta-key">Teaching Style</dt>
                        <dd className="iad-meta-val">{view.teachingStyle}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Score card */}
              {testScore !== null && (
                <div className={`iad-card iad-score-card ${testScore >= TEST_PASS_SCORE ? "iad-score-card--pass" : "iad-score-card--fail"}`}>
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M12 20v-6M6 20V10M18 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      Competency Test Score
                    </h2>
                  </div>
                  <div className="iad-score-body">
                    <div className="iad-score-circle">
                      <svg className="iad-score-ring" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                        <circle cx="40" cy="40" r="33" fill="none" stroke="var(--iad-score-track)" strokeWidth="7" />
                        <circle
                          cx="40"
                          cy="40"
                          r="33"
                          fill="none"
                          stroke="var(--iad-score-fill)"
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray="207.3"
                          strokeDashoffset={ringOffset}
                          transform="rotate(-90 40 40)"
                        />
                      </svg>
                      <div className="iad-score-inner">
                        <span className="iad-score-num">{testScore}</span>
                        <span className="iad-score-pct">%</span>
                      </div>
                    </div>
                    <p className={testScore >= TEST_PASS_SCORE ? "iad-score-verdict iad-score-verdict--pass" : "iad-score-verdict iad-score-verdict--fail"}>
                      {testScore >= TEST_PASS_SCORE ? "✓ Passed" : "✗ Below Pass Mark"}
                    </p>
                    <p className="iad-score-threshold">Pass mark: {TEST_PASS_SCORE}%</p>
                  </div>
                </div>
              )}

              {/* Documents card */}
              {view.hasDocs && (
                <div className="iad-card iad-docs-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                      Verification Documents
                    </h2>
                  </div>
                  <div className="iad-card-body">
                    <div className="iad-sensitive-banner">
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      <span>Sensitive — handle with care. Deleted after decision.</span>
                    </div>
                    <div className="iad-doc-btns">
                      {docBtn(view.govtIdUrl, "Government ID")}
                      {docBtn(view.marksheetUrl, "Marksheet / Degree")}
                    </div>
                  </div>
                </div>
              )}

              {/* Decision card */}
              <div className={`iad-card iad-decision-card ${view.decisionCard}`}>
                <div className="iad-card-header">
                  <h2 className="iad-card-title">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" /></svg>
                    Admin Decision
                  </h2>
                </div>
                <div className="iad-card-body">
                  {view.status === "pending" || view.status === "draft" ? (
                    <>
                      <p className="iad-decision-hint">
                        Review the application carefully before approving or rejecting.
                      </p>
                      <form id="approveForm" method="post" action={apiAction}>
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="action" value="approve" />
                        <button type="button" className="iad-btn iad-btn--success iad-btn--full" data-modal="approveModal" onClick={() => setApproveOpen(true)}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Approve Application
                        </button>
                      </form>
                      <div className="iad-reject-wrap" id="rejectWrap">
                        <button
                          type="button"
                          id="rejectToggle"
                          className="iad-reject-toggle iad-btn iad-btn--full iad-btn--outline-danger"
                          aria-expanded={rejectPanelOpen ? "true" : "false"}
                          aria-controls="rejectPanel"
                          onClick={toggleRejectPanel}
                        >
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                          Reject Application
                        </button>
                        <div className="iad-reject-panel" id="rejectPanel" hidden={!rejectPanelOpen}>
                          <form id="rejectForm" method="post" action={apiAction}>
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <input type="hidden" name="action" value="reject" />
                            <label className="iad-form-label" htmlFor="rejectReason">Rejection Reason</label>
                            <textarea
                              id="rejectReason"
                              name="rejection_reason"
                              className="iad-textarea"
                              rows={4}
                              maxLength={1000}
                              placeholder="Provide a rejection reason (optional). The applicant will be notified by email."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              ref={rejectInputRef}
                            />
                            <div className="iad-char-count">
                              <span id="rejectCharCount">{rejectReason.length}/1000</span>
                            </div>
                            <div className="iad-form-row">
                              <button type="button" className="iad-btn iad-btn--ghost" data-toggle-reject onClick={() => setRejectPanelOpen(false)}>Cancel</button>
                              <button type="button" className="iad-btn iad-btn--danger" data-modal="rejectModal" onClick={() => setRejectModalOpen(true)}>Confirm Rejection</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </>
                  ) : view.status === "approved" ? (
                    <>
                      <div className="iad-status-display iad-status-display--approved">
                        <span className="iad-status-icon" aria-hidden="true">✓</span>
                        <div>
                          <p className="iad-status-title">Application Approved</p>
                          <p className="iad-status-sub">{view.reviewedAt ? `Reviewed on ${view.reviewedAt}` : "Instructor access granted."}</p>
                        </div>
                      </div>
                      <a className="iad-btn iad-btn--outline iad-btn--full" href={`/admin/users?search=${encodeURIComponent(view.applicantEmail)}`}>
                        View User Profile →
                      </a>
                    </>
                  ) : (
                    <>
                      <div className="iad-status-display iad-status-display--rejected">
                        <span className="iad-status-icon" aria-hidden="true">✕</span>
                        <div>
                          <p className="iad-status-title">Application Rejected</p>
                          <p className="iad-status-sub">{view.reviewedAt ? `Reviewed on ${view.reviewedAt}` : ""}</p>
                        </div>
                      </div>
                      {view.rejectionReason ? (
                        <div className="iad-rejection-reason">
                          <p className="iad-rejection-reason-label">Rejection Reason</p>
                          <blockquote className="iad-text-block">{nl2br(view.rejectionReason)}</blockquote>
                        </div>
                      ) : (
                        <p className="iad-empty-note">No rejection reason was provided.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </aside>

            {/* ══════════ MAIN CONTENT ══════════ */}
            <div className="iad-content" role="main">
              <div className="iad-tabs" role="tablist" aria-label="Application sections">
                {TABS.map((key) => {
                  const labels: Record<TabKey, string> = {
                    overview: "Overview",
                    credentials: "Credentials",
                    competency: "Competency",
                    legal: "Legal",
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      className={tab === key ? "iad-tab iad-tab--active" : "iad-tab"}
                      data-tab={key}
                      role="tab"
                      aria-selected={tab === key ? "true" : "false"}
                      onClick={() => switchTab(key)}
                    >
                      {labels[key]}
                    </button>
                  );
                })}
              </div>

              {/* ── Overview ── */}
              <div className={`iad-tab-panel${tab === "overview" ? " iad-tab-panel--active" : ""}`} id="tab-overview" hidden={tab !== "overview"}>
                <div className="iad-quick-stats">
                  <div className="iad-qstat">
                    <span className="iad-qstat-icon iad-qstat-icon--blue">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /></svg>
                    </span>
                    <span className="iad-qstat-val">{view.expLabel}</span>
                    <span className="iad-qstat-lbl">Experience</span>
                  </div>
                  <div className="iad-qstat">
                    <span className={`iad-qstat-icon ${view.testScore !== null && view.testScore >= TEST_PASS_SCORE ? "iad-qstat-icon--green" : "iad-qstat-icon--red"}`}>
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M12 20v-6M6 20V10M18 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </span>
                    <span className="iad-qstat-val">{testScore !== null ? `${testScore}%` : "N/A"}</span>
                    <span className="iad-qstat-lbl">Test Score</span>
                  </div>
                  <div className="iad-qstat">
                    <span className={`iad-qstat-icon ${view.allPoliciesAgreed ? "iad-qstat-icon--green" : "iad-qstat-icon--orange"}`}>
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="iad-qstat-val">{view.allPoliciesAgreed ? "All Signed" : "Incomplete"}</span>
                    <span className="iad-qstat-lbl">Policies</span>
                  </div>
                  <div className="iad-qstat">
                    <span className={`iad-qstat-icon ${view.emailVerified ? "iad-qstat-icon--green" : "iad-qstat-icon--orange"}`}>
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                    </span>
                    <span className="iad-qstat-val">{view.emailVerified ? "Verified" : "Unverified"}</span>
                    <span className="iad-qstat-lbl">Email</span>
                  </div>
                </div>

                {view.bio && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Professional Bio</h2>
                    </div>
                    <div className="iad-card-body">
                      <blockquote className="iad-text-block">{nl2br(view.bio)}</blockquote>
                    </div>
                  </div>
                )}

                {view.courseIdeas && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Course Plans & Ideas</h2>
                    </div>
                    <div className="iad-card-body">
                      <blockquote className="iad-text-block">{nl2br(view.courseIdeas)}</blockquote>
                    </div>
                  </div>
                )}

                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Application Timeline</h2>
                  </div>
                  <div className="iad-card-body">
                    <ol className="iad-timeline">
                      {timelineItems.map((item) => (
                        <li className={`iad-timeline-item iad-timeline-item--${item.cls}`} key={item.title}>
                          <span className="iad-timeline-dot" aria-hidden="true" />
                          <div className="iad-timeline-body">
                            <p className="iad-timeline-title">{item.title}</p>
                            {item.date && <p className="iad-timeline-date">{item.date}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* ── Credentials ── */}
              <div className={`iad-tab-panel${tab === "credentials" ? " iad-tab-panel--active" : ""}`} id="tab-credentials" hidden={tab !== "credentials"}>
                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Education & Qualifications</h2>
                  </div>
                  <div className="iad-card-body">
                    <div className="iad-info-grid">
                      {field("Highest Education", view.highestEducation)}
                      {field("Field of Study", view.fieldOfStudy)}
                      {field("Institution", view.institution)}
                      {field("Graduation Year", view.graduationYear != null ? String(view.graduationYear) : "")}
                    </div>
                  </div>
                </div>

                {view.certifications && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Certifications</h2>
                    </div>
                    <div className="iad-card-body">
                      <blockquote className="iad-text-block">{nl2br(view.certifications)}</blockquote>
                    </div>
                  </div>
                )}

                {view.professionalExp && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Professional Experience</h2>
                    </div>
                    <div className="iad-card-body">
                      <blockquote className="iad-text-block">{nl2br(view.professionalExp)}</blockquote>
                    </div>
                  </div>
                )}

                {view.notableWorks && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Notable Works</h2>
                    </div>
                    <div className="iad-card-body">
                      <blockquote className="iad-text-block">{nl2br(view.notableWorks)}</blockquote>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Competency ── */}
              <div className={`iad-tab-panel${tab === "competency" ? " iad-tab-panel--active" : ""}`} id="tab-competency" hidden={tab !== "competency"}>
                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Subject Matter Details</h2>
                  </div>
                  <div className="iad-card-body">
                    <div className="iad-info-grid">
                      {field("Primary Subject", view.primarySubject)}
                      {field("Skill Level Taught", view.skillLevel)}
                      {field("Target Audience", view.targetAudience, true)}
                      {field("Secondary Subjects", view.secondarySubjects)}
                    </div>
                  </div>
                </div>

                {view.sampleContentUrl && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Sample Content</h2>
                    </div>
                    <div className="iad-card-body">
                      <a className="iad-sample-link" href={view.sampleContentUrl} target="_blank" rel="noopener noreferrer">
                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        {view.sampleContentUrl}
                      </a>
                    </div>
                  </div>
                )}

                {testScore !== null && (
                  <div className="iad-card">
                    <div className="iad-card-header">
                      <h2 className="iad-card-title">Competency Test Result</h2>
                    </div>
                    <div className="iad-card-body">
                      <div className="iad-score-bar-wrap">
                        <div className="iad-score-bar-labels">
                          <span>Score: {testScore}%</span>
                          <span>Pass Mark: {TEST_PASS_SCORE}%</span>
                        </div>
                        <div className="iad-score-bar" role="progressbar" aria-valuenow={testScore} aria-valuemin={0} aria-valuemax={100}>
                          <div
                            className={`iad-score-bar-fill ${testScore >= TEST_PASS_SCORE ? "iad-score-bar-fill--pass" : "iad-score-bar-fill--fail"}`}
                            style={{ width: `${testScore}%` }}
                          />
                          <div className="iad-score-bar-marker" style={{ left: `${TEST_PASS_SCORE}%` }} aria-hidden="true" />
                        </div>
                        <p className={`iad-score-result ${testScore >= TEST_PASS_SCORE ? "iad-score-result--pass" : "iad-score-result--fail"}`}>
                          {testScore >= TEST_PASS_SCORE
                            ? "✓ Passed — meets minimum competency requirement"
                            : `✗ Did not meet the minimum score of ${TEST_PASS_SCORE}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Legal ── */}
              <div className={`iad-tab-panel${tab === "legal" ? " iad-tab-panel--active" : ""}`} id="tab-legal" hidden={tab !== "legal"}>
                <div className="iad-sensitive-banner iad-sensitive-banner--lg">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" /></svg>
                  <span>Sensitive Information — this financial and identity data is encrypted at rest and shown only to administrators.</span>
                </div>

                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Identity Details</h2>
                  </div>
                  <div className="iad-card-body">
                    <div className="iad-info-grid">
                      {field("Full Legal Name", view.fullLegalName)}
                      {maskedRow("PAN Number", panShown ? view.panFull : view.panMasked, view.panFull, panShown, () => setPanShown((s) => !s), true)}
                    </div>
                  </div>
                </div>

                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Bank & Payment Details</h2>
                  </div>
                  <div className="iad-card-body">
                    <div className="iad-info-grid">
                      {field("Account Holder", view.accountHolder)}
                      {maskedRow("Bank Account Number", bankShown ? view.bankFull : view.bankMasked, view.bankFull, bankShown, () => setBankShown((s) => !s))}
                      {field("IFSC Code", view.ifscCode)}
                      {field("UPI ID", view.upiId)}
                    </div>
                  </div>
                </div>

                <div className="iad-card">
                  <div className="iad-card-header">
                    <h2 className="iad-card-title">Policy Agreements</h2>
                  </div>
                  <div className="iad-card-body">
                    <ul className="iad-policy-list">
                      {policyItem(view.revenueShareAck, "Revenue sharing terms acknowledged")}
                      {policyItem(view.termsAgreed, "Platform terms and conditions agreed")}
                      {policyItem(view.contentPolicy, "Content policy accepted")}
                    </ul>
                    {!view.allPoliciesAgreed && (
                      <div className="iad-policy-warning">
                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                        <span>This applicant has not agreed to all required policies.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════ MODALS ═══════════════════ */}
      <div className="iad-modal-overlay" id="approveModal" hidden={!approveOpen} role="dialog" aria-modal="true" aria-labelledby="approveModalTitle" ref={modalHostRef}>
        <div className="iad-modal iad-modal--success">
          <h3 className="iad-modal-title" id="approveModalTitle">Approve Application?</h3>
          <p className="iad-modal-body">
            This will grant <strong>{view.applicantName}</strong> instructor access and send them a confirmation email. This action cannot be undone.
          </p>
          <div className="iad-modal-actions">
            <button type="button" className="iad-btn iad-btn--ghost" onClick={() => setApproveOpen(false)}>Cancel</button>
            <button type="button" className="iad-btn iad-btn--success" data-submit-form="approveForm" onClick={() => submitForm("approveForm")}>Yes, Approve</button>
          </div>
        </div>
      </div>

      <div className="iad-modal-overlay" id="rejectModal" hidden={!rejectModalOpen} role="dialog" aria-modal="true" aria-labelledby="rejectModalTitle">
        <div className="iad-modal iad-modal--danger">
          <h3 className="iad-modal-title" id="rejectModalTitle">Reject Application?</h3>
          <p className="iad-modal-body">
            This will reject <strong>{view.applicantName}</strong>&apos;s application and send them a notification email. This action cannot be undone.
          </p>
          <div className="iad-modal-actions">
            <button type="button" className="iad-btn iad-btn--ghost" onClick={() => setRejectModalOpen(false)}>Cancel</button>
            <button type="button" className="iad-btn iad-btn--danger" data-submit-form="rejectForm" onClick={() => submitForm("rejectForm")}>Yes, Reject</button>
          </div>
        </div>
      </div>
    </div>
  );
}