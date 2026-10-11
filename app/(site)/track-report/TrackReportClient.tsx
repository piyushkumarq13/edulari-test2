import {
  ISSUE_TYPE_LABELS,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  TIMELINE_STEPS,
  maskEmail,
  utcStamp,
} from "./trackReportConfig";

type Props = {
  reference: string;
  error: string;
  report: Record<string, unknown> | null;
};

export default function TrackReportClient({ reference, error, report }: Props) {
  return (
    <main className="tr-main">
      {!reference ? (
        <div className="tr-state-card tr-state-idle">
          <div className="tr-state-graphic">
            <div className="tr-idle-rings">
              <div className="tr-idle-ring r1" />
              <div className="tr-idle-ring r2" />
              <div className="tr-idle-ring r3" />
            </div>
            <span className="tr-state-emoji">🔍</span>
          </div>
          <h2>No reference entered</h2>
          <p>Paste the <strong>BUG-XXXXXX</strong> reference from your confirmation email above to check your report status.</p>
          <div className="tr-state-actions">
            <a href="/report-bug" className="tr-btn tr-btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Submit a Report
            </a>
          </div>
        </div>
      ) : error ? (
        <div className="tr-state-card tr-state-error">
          <div className="tr-state-graphic"><span className="tr-state-emoji">😕</span></div>
          <h2>Report not found</h2>
          <p>{error}</p>
          <div className="tr-state-actions">
            <a href="/track-report" className="tr-btn tr-btn-outline">Try Again</a>
            <a href="/report-bug" className="tr-btn tr-btn-primary">Submit a Report</a>
          </div>
        </div>
      ) : report ? (
        <ReportView report={report} />
      ) : null}
    </main>
  );
}

function ReportView({ report }: { report: Record<string, unknown> }) {
  const status = String(report.status ?? "open");
  const sCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const sevLabel = String(report.severity_label ?? "Moderate");
  const sevCfg = SEVERITY_CONFIG[sevLabel] ?? SEVERITY_CONFIG.Moderate;
  const typeInfo = ISSUE_TYPE_LABELS[String(report.issue_type)] ?? { icon: "❓", label: String(report.issue_type) };

  const createdAt = utcStamp(report.created_at ? String(report.created_at) : null);
  const updatedAt = utcStamp(report.updated_at ? String(report.updated_at) : null);
  const resolvedAt = report.resolved_at ? utcStamp(String(report.resolved_at)) : null;

  const activeStep = sCfg.active;
  const isTerminal = sCfg.terminal;
  const isGood = sCfg.good;

  return (
    <>
      <div className="tr-status-banner" style={{ ["--s-color" as string]: sCfg.color, ["--s-bg" as string]: sCfg.bg, ["--s-border" as string]: sCfg.border, ["--s-gradient" as string]: sCfg.gradient } as React.CSSProperties}>
        <div className="tr-status-banner-inner">
          <div className="tr-status-hero-icon">{sCfg.heroIcon}</div>
          <div className="tr-status-banner-text">
            <div className="tr-status-ref">{String(report.reference)}</div>
            <div className="tr-status-subject">{String(report.subject)}</div>
            <div className="tr-status-chip">
              <span className="tr-chip-dot" style={{ background: sCfg.color }} />
              {sCfg.icon} {sCfg.label} &mdash; {sCfg.sublabel}
            </div>
          </div>
          <div className="tr-status-badges-stack">
            <span className="tr-pill" style={{ background: sevCfg.bg, color: sevCfg.color, borderColor: sevCfg.border }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sevCfg.dot, display: "inline-block" }} />
              {sevLabel}
            </span>
            <span className="tr-pill tr-pill-type">{typeInfo.icon} {typeInfo.label}</span>
          </div>
        </div>
      </div>

      <div className="tr-layout">
        <div className="tr-col-main">
          <div className="tr-card">
            <div className="tr-card-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Progress Timeline
            </div>
            <div className="tr-timeline-wrap">
              <div className="tr-timeline">
                {TIMELINE_STEPS.map((step, i) => {
                  const isDone = i + 1 < activeStep;
                  const isActive = i + 1 === activeStep;
                  const isBadEnd = isTerminal && !isGood && i === 3;
                  let cls = "";
                  if (isDone && !isBadEnd) cls = "done";
                  else if (isActive && !isBadEnd) cls = "active";
                  else if (isBadEnd) cls = "closed";

                  return (
                    <div key={step.label} className={`tr-tl-step ${cls}`}>
                      <div className="tr-tl-dot-wrap">
                        <div className="tr-tl-dot">
                          {isDone && !isBadEnd ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : isBadEnd ? (
                            "✕"
                          ) : (
                            step.icon
                          )}
                        </div>
                        {i < TIMELINE_STEPS.length - 1 ? <div className={`tr-tl-line ${isDone ? "filled" : ""}`} /> : null}
                      </div>
                      <div className="tr-tl-text">
                        <div className="tr-tl-label">{step.label}</div>
                        <div className="tr-tl-desc">
                          {step.desc}
                          {isActive && status === "in_progress" ? <span className="tr-tl-live">● Live</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="tr-progress-track">
                <div
                  className="tr-progress-fill"
                  style={{ width: `${sCfg.pct}%`, background: isGood ? "linear-gradient(90deg, var(--primary), #10b981)" : "linear-gradient(90deg, #f87171, #ef4444)" }}
                />
              </div>
              <div className="tr-progress-meta">
                <span>{sCfg.pct}% complete</span>
                {resolvedAt ? <span>Closed {resolvedAt}</span> : updatedAt !== createdAt ? <span>Updated {updatedAt}</span> : null}
              </div>
            </div>
          </div>

          {status === "resolved" ? (
            <div className="tr-callout tr-callout-resolved">
              <div className="tr-callout-icon">🎉</div>
              <div>
                <strong>Issue fixed!</strong> The problem you reported has been resolved. If the fix isn&apos;t visible yet, try clearing your browser cache or wait a few minutes for changes to propagate.
                {resolvedAt ? <div className="tr-callout-meta">Resolved on {resolvedAt}</div> : null}
              </div>
            </div>
          ) : status === "wont_fix" ? (
            <div className="tr-callout tr-callout-wontfix">
              <div className="tr-callout-icon">📋</div>
              <div>
                <strong>Closed — Won&apos;t Fix.</strong> After review, our team has decided not to action this report at this time. This may be by design, out of scope, or not technically feasible.
                <div className="tr-callout-meta">If you believe this is an error, <a href="/help-center">contact our support team</a>.</div>
              </div>
            </div>
          ) : status === "duplicate" ? (
            <div className="tr-callout tr-callout-duplicate">
              <div className="tr-callout-icon">🔗</div>
              <div>
                <strong>Duplicate report.</strong> This issue is already being tracked under another report. Your report has been merged and the underlying problem remains on our radar.
                <div className="tr-callout-meta">No action needed from you — you&apos;ll benefit from the fix when it ships.</div>
              </div>
            </div>
          ) : status === "in_progress" ? (
            <div className="tr-callout tr-callout-progress">
              <div className="tr-callout-icon">🔍</div>
              <div>
                <strong>Under active investigation.</strong> Our team has picked up this report and is working on a fix. We&apos;ll email you as soon as there&apos;s an update.
              </div>
            </div>
          ) : (
            <div className="tr-callout tr-callout-open">
              <div className="tr-callout-icon">📬</div>
              <div>
                <strong>In the queue.</strong> Your report has been received and is waiting for our team to review it. We prioritise by severity — Critical and High issues are addressed first.
              </div>
            </div>
          )}

          {report.admin_notes ? (
            <div className="tr-admin-note">
              <div className="tr-admin-note-header">
                <div className="tr-admin-avatar">E</div>
                <div>
                  <div className="tr-admin-name">Edulari Team</div>
                  <div className="tr-admin-time">{updatedAt}</div>
                </div>
                <div className="tr-admin-badge">Official Note</div>
              </div>
              <div className="tr-admin-note-body">{String(report.admin_notes)}</div>
            </div>
          ) : null}

          <div className="tr-card">
            <div className="tr-card-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Issue Description
            </div>
            <div className="tr-card-body">
              <div className="tr-text-block">{String(report.description)}</div>

              {report.steps ? (
                <div className="tr-subblock">
                  <div className="tr-subblock-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                    Steps to Reproduce
                  </div>
                  <div className="tr-text-block">{String(report.steps)}</div>
                </div>
              ) : null}

              {report.expected ? (
                <div className="tr-subblock">
                  <div className="tr-subblock-label">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
                    Expected Behaviour
                  </div>
                  <div className="tr-text-block">{String(report.expected)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="tr-col-side">
          <div className="tr-card">
            <div className="tr-card-head">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Report Details
            </div>
            <div className="tr-meta-list">
              <div className="tr-meta-row">
                <span className="tr-meta-label">Reference</span>
                <code className="tr-meta-code">{String(report.reference)}</code>
              </div>
              <div className="tr-meta-row">
                <span className="tr-meta-label">Reporter</span>
                <span className="tr-meta-val">{String(report.reporter_name)}</span>
              </div>
              <div className="tr-meta-row">
                <span className="tr-meta-label">Email</span>
                <span className="tr-meta-val tr-mono">{maskEmail(report.reporter_email ? String(report.reporter_email) : null)}</span>
              </div>
              <div className="tr-meta-row">
                <span className="tr-meta-label">Type</span>
                <span className="tr-meta-val">{typeInfo.icon} {typeInfo.label}</span>
              </div>
              <div className="tr-meta-row">
                <span className="tr-meta-label">Severity</span>
                <span className="tr-severity-pill" style={{ background: sevCfg.bg, color: sevCfg.color, borderColor: sevCfg.border }}>{sevLabel}</span>
              </div>
              {report.page_url ? (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Page</span>
                  <span className="tr-meta-val tr-truncate">{String(report.page_url)}</span>
                </div>
              ) : null}
              {report.browser ? (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Browser</span>
                  <span className="tr-meta-val">{String(report.browser)}</span>
                </div>
              ) : null}
              <div className="tr-meta-divider" />
              <div className="tr-meta-row">
                <span className="tr-meta-label">Submitted</span>
                <span className="tr-meta-val">{createdAt}</span>
              </div>
              {updatedAt !== createdAt ? (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Updated</span>
                  <span className="tr-meta-val">{updatedAt}</span>
                </div>
              ) : null}
              {resolvedAt ? (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Resolved</span>
                  <span className="tr-meta-val" style={{ color: "#065f46", fontWeight: 700 }}>{resolvedAt}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="tr-help-card">
            <div className="tr-help-icon">💬</div>
            <div className="tr-help-title">Need more help?</div>
            <div className="tr-help-body">Updates are sent to your confirmation email automatically.</div>
            <a href="/help-center" className="tr-btn tr-btn-outline tr-btn-sm">Visit Help Center</a>
          </div>

          <div className="tr-actions-card">
            <a href="/report-bug" className="tr-btn tr-btn-primary tr-btn-full">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Report
            </a>
            <a href="/track-report" className="tr-btn tr-btn-ghost tr-btn-full">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              Track Another
            </a>
          </div>
        </aside>
      </div>

      <div className="tr-search-again">
        Looking for a different report? <a href="/track-report">Search again →</a>
      </div>
    </>
  );
}
