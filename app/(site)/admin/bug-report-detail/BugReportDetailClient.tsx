"use client";

import { useRef } from "react";
import {
  BUG_TYPE_LABELS_DETAIL,
  BUG_SEVERITY_COLORS,
  bugStatusConfig,
} from "@/lib/admin/bug-labels";

export type BugReportView = {
  id: number;
  reference: string;
  subject: string;
  issueType: string;
  severityLabel: string;
  status: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: string;
  browser: string;
  reporterIp: string;
  pageUrl: string;
  submittedText: string;
  updatedText: string;
  resolvedAtText: string | null;
  description: string;
  steps: string | null;
  expected: string | null;
  attachment: string | null;
  adminNotes: string | null;
};

type Props = {
  report: BugReportView;
  csrfToken: string;
  flash: string;
  flashType: string;
};

function ActionForm({
  action,
  buttonClass,
  dataMsg,
  notesId,
  notesRef,
  csrfToken,
  children,
}: {
  action: string;
  buttonClass: string;
  dataMsg?: string;
  notesId: string;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  csrfToken: string;
  children: React.ReactNode;
}) {
  const hidden = useRef<HTMLInputElement>(null);
  return (
    <form
      method="POST"
      className={dataMsg ? "js-confirm-action" : "js-inject-notes"}
      data-msg={dataMsg}
      onSubmit={(e) => {
        if (dataMsg && !window.confirm(dataMsg)) {
          e.preventDefault();
          return;
        }
        if (hidden.current && notesRef.current) hidden.current.value = notesRef.current.value;
      }}
    >
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="admin_notes" id={notesId} ref={hidden} />
      <button type="submit" className={buttonClass}>{children}</button>
    </form>
  );
}

export default function BugReportDetailClient({ report, csrfToken, flash, flashType }: Props) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const s = report.status;
  const sCfg = bugStatusConfig(s);
  const sev = BUG_SEVERITY_COLORS[report.severityLabel] ?? BUG_SEVERITY_COLORS.Moderate;
  const typeLabel = BUG_TYPE_LABELS_DETAIL[report.issueType] ?? report.issueType;

  return (
    <div className="abrd-page">
      <a href="/admin/bug-reports" className="abrd-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Bug Reports
      </a>

      {flash ? (
        <div className={`abrd-flash ${flashType}`}>
          {flashType === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          )}
          {flash}
        </div>
      ) : null}

      <div className="abrd-header">
        <div>
          <div className="abrd-ref">{report.reference}</div>
          <div className="abrd-title">{report.subject}</div>
          <div className="abrd-badges">
            <span className="abrd-badge" style={{ background: sCfg.bg, color: sCfg.color, borderColor: sCfg.border }}>
              {sCfg.icon} {sCfg.label}
            </span>
            <span className="abrd-badge" style={{ background: sev.bg, color: sev.color, borderColor: sev.border }}>
              ⚡ {report.severityLabel}
            </span>
            <span className="abrd-badge" style={{ background: "#ede9fe", color: "#5b21b6", borderColor: "#c4b5fd" }}>
              {typeLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="abrd-layout">
        <div className="abrd-main">
          <div className="abrd-card">
            <div className="abrd-card-head">
              <div className="abrd-card-head-icon" style={{ background: "#ede9fe", color: "#6c63ff" }}>👤</div>
              Reporter Information
            </div>
            <div className="abrd-card-body">
              <div className="abrd-grid">
                <div>
                  <div className="abrd-detail-label">Full Name</div>
                  <div className="abrd-detail-value">{report.reporterName}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">Email</div>
                  <div className="abrd-detail-value">
                    <a href={`mailto:${report.reporterEmail}`} style={{ color: "#6c63ff" }}>{report.reporterEmail}</a>
                  </div>
                </div>
                <div>
                  <div className="abrd-detail-label">Role</div>
                  <div className="abrd-detail-value">{report.reporterRole}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">Browser</div>
                  <div className="abrd-detail-value">{report.browser || "—"}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">IP Address</div>
                  <div className="abrd-detail-value">{report.reporterIp || "—"}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">Page / URL</div>
                  <div className="abrd-detail-value">{report.pageUrl || "—"}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">Submitted</div>
                  <div className="abrd-detail-value">{report.submittedText || "—"}</div>
                </div>
                <div>
                  <div className="abrd-detail-label">Last Updated</div>
                  <div className="abrd-detail-value">{report.updatedText || "—"}</div>
                </div>
                {report.resolvedAtText ? (
                  <div>
                    <div className="abrd-detail-label">Resolved At</div>
                    <div className="abrd-detail-value">{report.resolvedAtText}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="abrd-card">
            <div className="abrd-card-head">
              <div className="abrd-card-head-icon" style={{ background: "#fef3c7", color: "#92400e" }}>📋</div>
              Issue Details
            </div>
            <div className="abrd-card-body">
              <div className="abrd-text-label">Description</div>
              <div className="abrd-text-block">{report.description}</div>

              {report.steps ? (
                <div style={{ marginTop: "1rem" }}>
                  <div className="abrd-text-label">Steps to Reproduce</div>
                  <div className="abrd-text-block">{report.steps}</div>
                </div>
              ) : null}

              {report.expected ? (
                <div style={{ marginTop: "1rem" }}>
                  <div className="abrd-text-label">Expected Behaviour</div>
                  <div className="abrd-text-block">{report.expected}</div>
                </div>
              ) : null}

              {report.attachment ? (
                <div style={{ marginTop: "1rem" }}>
                  <div className="abrd-text-label">Attachment</div>
                  <a
                    href={`/api/admin/bug-attachment?file=${encodeURIComponent(report.attachment)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: ".83rem", color: "#6c63ff", fontWeight: 600, marginTop: "4px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                    {report.attachment}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {report.adminNotes ? (
            <div className="abrd-card">
              <div className="abrd-card-head">
                <div className="abrd-card-head-icon" style={{ background: "#d1fae5", color: "#15803d" }}>💬</div>
                Current Admin Note (sent to reporter)
              </div>
              <div className="abrd-card-body">
                <div className="abrd-text-block">{report.adminNotes}</div>
              </div>
            </div>
          ) : null}
        </div>

        <aside>
          <div className="abrd-action-card">
            <div className="abrd-action-head">⚡ Actions</div>
            <div className="abrd-action-body">
              <div className="abrd-current-status">
                <span className="abrd-current-label">Current Status</span>
                <span className="abrd-current-val" style={{ color: sCfg.color }}>{sCfg.icon} {sCfg.label}</span>
              </div>

              <div className="abrd-notes-wrap">
                <label className="abrd-notes-label" htmlFor="sharedNotes">
                  Note to Reporter <span style={{ fontWeight: 400, color: "#cbd5e1" }}>(optional)</span>
                </label>
                <textarea
                  id="sharedNotes"
                  ref={notesRef}
                  className="abrd-notes-textarea"
                  defaultValue={report.adminNotes ?? ""}
                  placeholder="Add a message that will be included in the email notification to the reporter…"
                />
                <div className="abrd-notes-hint">This note will appear in the status update email sent to the reporter.</div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: ".25rem 0" }} />

              {s !== "resolved" ? (
                <ActionForm action="resolve" buttonClass="abrd-action-btn abrd-btn--resolve" notesId="notes_resolve" notesRef={notesRef} csrfToken={csrfToken}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  Mark as Resolved
                </ActionForm>
              ) : null}

              {s === "open" || s === "wont_fix" || s === "duplicate" ? (
                <ActionForm action="in_progress" buttonClass="abrd-action-btn abrd-btn--progress" notesId="notes_in_progress" notesRef={notesRef} csrfToken={csrfToken}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  Mark as In Progress
                </ActionForm>
              ) : null}

              {s !== "open" ? (
                <ActionForm action="reopen" buttonClass="abrd-action-btn abrd-btn--reopen" notesId="notes_reopen" notesRef={notesRef} csrfToken={csrfToken}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.95" /></svg>
                  Reopen
                </ActionForm>
              ) : null}

              {s !== "wont_fix" ? (
                <ActionForm action="wont_fix" buttonClass="abrd-action-btn abrd-btn--wontfix" notesId="notes_wont_fix" dataMsg="Mark as Won't Fix? Reporter will be notified." notesRef={notesRef} csrfToken={csrfToken}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                  Won&apos;t Fix
                </ActionForm>
              ) : null}

              {s !== "duplicate" ? (
                <ActionForm action="duplicate" buttonClass="abrd-action-btn abrd-btn--duplicate" notesId="notes_duplicate" dataMsg="Mark as Duplicate? Reporter will be notified." notesRef={notesRef} csrfToken={csrfToken}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Mark as Duplicate
                </ActionForm>
              ) : null}

              <p style={{ fontSize: ".72rem", color: "#94a3b8", textAlign: "center", marginTop: ".25rem" }}>
                All actions send an email notification to the reporter.
              </p>
            </div>
          </div>

          <div className="abrd-card">
            <div className="abrd-card-head">
              <div className="abrd-card-head-icon" style={{ background: "#f1f5f9", color: "#374151" }}>🔗</div>
              Quick Links
            </div>
            <div className="abrd-card-body" style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
              <a href={`mailto:${report.reporterEmail}`} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: ".83rem", color: "#6c63ff", fontWeight: 600 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                Email Reporter Directly
              </a>
              <a href={`/track-report?ref=${encodeURIComponent(report.reference)}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: ".83rem", color: "#6c63ff", fontWeight: 600 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                View Reporter&apos;s Track Page
              </a>
              <a href="/admin/bug-reports" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: ".83rem", color: "#64748b", fontWeight: 600 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                Back to All Reports
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
