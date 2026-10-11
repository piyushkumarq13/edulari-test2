import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatDayMonthYear, trimWidth } from "@/lib/format";
import {
  listBugReports,
  getBugStatusCounts,
  countCriticalOpenBugs,
  BUG_STATUSES,
  BUG_SEVERITIES,
  BUG_TYPES,
} from "@/lib/db/admin/bug-reports";
import { BUG_TYPE_LABELS_LIST, BUG_STATUS_LABELS } from "@/lib/admin/bug-labels";
import "@/styles/css/admin/dashboard.css";
import "@/styles/css/admin/bug-reports.css";

const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Edulari";

export const metadata: Metadata = pageMetadata({
  title: `Bug Reports – Admin | ${SITE_NAME}`,
  description: "Review and manage all submitted bug reports and issues.",
  path: "/admin/bug-reports",
  noindex: true,
});

export const dynamic = "force-dynamic";

/** PHP http_build_query(array_filter([...])) — empty values are dropped. */
function buildQuery(map: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(map)) if (v !== "") q.set(k, v);
  return q.toString();
}

export default async function AdminBugReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  let statusFilter = sp.status ?? "all";
  let severityFilter = sp.severity ?? "all";
  let typeFilter = sp.type ?? "all";
  const search = (sp.search ?? "").trim();

  if (!(BUG_STATUSES as readonly string[]).includes(statusFilter)) statusFilter = "all";
  if (!(BUG_SEVERITIES as readonly string[]).includes(severityFilter)) severityFilter = "all";
  if (!(BUG_TYPES as readonly string[]).includes(typeFilter)) typeFilter = "all";

  const [reports, counts, criticalOpen] = await Promise.all([
    listBugReports({ status: statusFilter, severity: severityFilter, type: typeFilter, search }),
    getBugStatusCounts(),
    countCriticalOpenBugs(),
  ]);

  const tabDefs: Array<[string, string]> = [
    ["all", "All"],
    ["open", "🟡 Open"],
    ["in_progress", "🔵 In Progress"],
    ["resolved", "✅ Resolved"],
    ["wont_fix", "⛔ Won't Fix"],
    ["duplicate", "🔁 Duplicate"],
  ];

  const isFiltered = search !== "" || severityFilter !== "all" || typeFilter !== "all";

  return (
    <div className="abr-page">
      <div className="abr-page-header">
        <div>
          <h1 className="abr-page-title">🐛 Bug Reports</h1>
          <p className="abr-page-sub">Review and manage all submitted bug reports and issues.</p>
        </div>
        <div className="abr-header-actions">
          <a href="/report-bug" className="addash-btn addash-btn--secondary" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            View Report Page
          </a>
        </div>
      </div>

      <div className="abr-stats">
        <div className="abr-stat">
          <div className="abr-stat-icon" style={{ background: "#fef9c3", color: "#854d0e" }}>🟡</div>
          <div><div className="abr-stat-label">Open</div><div className="abr-stat-value">{counts.open}</div></div>
        </div>
        <div className="abr-stat">
          <div className="abr-stat-icon" style={{ background: "#ede9fe", color: "#5b21b6" }}>🔵</div>
          <div><div className="abr-stat-label">In Progress</div><div className="abr-stat-value">{counts.in_progress}</div></div>
        </div>
        <div className="abr-stat">
          <div className="abr-stat-icon" style={{ background: "#dcfce7", color: "#15803d" }}>✅</div>
          <div><div className="abr-stat-label">Resolved</div><div className="abr-stat-value">{counts.resolved}</div></div>
        </div>
        <div className="abr-stat">
          <div className="abr-stat-icon" style={{ background: "#fee2e2", color: "#991b1b" }}>🚨</div>
          <div><div className="abr-stat-label">Critical Open</div><div className="abr-stat-value">{criticalOpen}</div></div>
        </div>
        <div className="abr-stat">
          <div className="abr-stat-icon" style={{ background: "#f1f5f9", color: "#374151" }}>📋</div>
          <div><div className="abr-stat-label">Total</div><div className="abr-stat-value">{counts.all}</div></div>
        </div>
      </div>

      <div className="abr-tabs">
        {tabDefs.map(([s, lbl]) => {
          const q = buildQuery({
            status: s,
            severity: severityFilter !== "all" ? severityFilter : "",
            type: typeFilter !== "all" ? typeFilter : "",
            search,
          });
          const cls = statusFilter === s ? "abr-tab active" : "abr-tab";
          const count = s === "all" ? counts.all : counts[s as keyof typeof counts];
          return (
            <a key={s} href={`?${q}`} className={cls}>
              {lbl}
              <span className="abr-tab-count">{count}</span>
            </a>
          );
        })}
      </div>

      <form method="GET" className="abr-filters">
        <input type="hidden" name="status" value={statusFilter} />
        <div className="abr-search-wrap">
          <svg className="abr-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" name="search" className="abr-search-input" placeholder="Search by ref, subject, name or email…" defaultValue={search} />
        </div>
        <select name="severity" className="abr-select" defaultValue={severityFilter}>
          <option value="all">All Severities</option>
          {["Critical", "High", "Moderate", "Minor", "Low"].map((sv) => (
            <option key={sv} value={sv}>{sv}</option>
          ))}
        </select>
        <select name="type" className="abr-select" defaultValue={typeFilter}>
          <option value="all">All Types</option>
          {Object.entries(BUG_TYPE_LABELS_LIST).map(([k, lbl]) => (
            <option key={k} value={k}>{lbl}</option>
          ))}
        </select>
        <button type="submit" className="abr-filter-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filter
        </button>
        {isFiltered ? (
          <a href={`?status=${statusFilter}`} className="addash-btn addash-btn--secondary">Clear</a>
        ) : null}
      </form>

      <div className="abr-table-card">
        {reports.length === 0 ? (
          <div className="abr-empty">
            <span className="abr-empty-icon">🎉</span>
            <h3>No reports found</h3>
            <p>No bug reports match your current filters.</p>
          </div>
        ) : (
          <div className="abr-table-wrap">
            <table className="abr-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>Reporter</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const sc = BUG_STATUS_LABELS[r.status] ?? { icon: "", label: r.status };
                  return (
                    <tr key={r.id}>
                      <td><span className="abr-ref">{r.reference}</span></td>
                      <td>
                        <div className="abr-subj">
                          {trimWidth(r.subject, 55)}
                          <small>{BUG_TYPE_LABELS_LIST[r.issue_type] ?? r.issue_type}</small>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: ".82rem" }}>{r.reporter_name}</div>
                        <div className="abr-email">{r.reporter_email}</div>
                      </td>
                      <td>{BUG_TYPE_LABELS_LIST[r.issue_type] ?? r.issue_type}</td>
                      <td>
                        <span className={`abr-badge abr-sev--${r.severity_label}`}>{r.severity_label}</span>
                      </td>
                      <td>
                        <span className={`abr-badge abr-badge--${r.status}`}>{sc.icon} {sc.label}</span>
                      </td>
                      <td className="abr-date">{formatDayMonthYear(r.created_at)}</td>
                      <td>
                        <a href={`/admin/bug-report-detail?id=${r.id}`} className="abr-view-btn">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          Review
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
