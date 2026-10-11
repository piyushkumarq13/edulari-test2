import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatMonthDayCommaYear } from "@/lib/format";
import {
  countContactSubmissions,
  listContactSubmissions,
  getContactStatusCounts,
  countUrgentOpenContacts,
  CONTACT_PER_PAGE,
} from "@/lib/db/admin/contact-submissions";
import {
  CONTACT_CATEGORY_LABELS,
  CONTACT_STATUS_META_LIST,
  CONTACT_PRIORITY_META_LIST,
  categoryLabel,
  contactStatusMeta,
  contactPriorityMeta,
} from "@/lib/admin/contact-labels";
import "@/styles/css/admin/dashboard.css";
import "@/styles/css/admin/contact-submissions.css";

const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Edulari";

export const metadata: Metadata = pageMetadata({
  title: `Contact Submissions – Admin | ${SITE_NAME}`,
  description: "Manage and respond to all user inquiries and support tickets.",
  path: "/admin/contact-submissions",
  noindex: true,
});

export const dynamic = "force-dynamic";

const STATUSES = ["all", "open", "in_progress", "waiting", "resolved", "closed"];
const CATEGORIES = ["all", "general", "billing", "technical", "course_content", "account", "instructor", "partnership", "feedback", "other"];
const PRIORITIES = ["all", "low", "normal", "high", "urgent"];

/** PHP http_build_query over array_filter for tab/filter links (drops empties). */
function buildQuery(pairs: Array<[string, string | number]>): string {
  const q = new URLSearchParams();
  for (const [k, v] of pairs) if (String(v) !== "") q.set(k, String(v));
  return q.toString();
}

export default async function AdminContactSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  let statusFilter = sp.status ?? "all";
  let categoryFilter = sp.category ?? "all";
  let priorityFilter = sp.priority ?? "all";
  const search = (sp.search ?? "").trim();

  if (!STATUSES.includes(statusFilter)) statusFilter = "all";
  if (!CATEGORIES.includes(categoryFilter)) categoryFilter = "all";
  if (!PRIORITIES.includes(priorityFilter)) priorityFilter = "all";

  const currentPage = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * CONTACT_PER_PAGE;

  const [total, submissions, counts, urgentOpen] = await Promise.all([
    countContactSubmissions({ status: statusFilter, category: categoryFilter, priority: priorityFilter, search }),
    listContactSubmissions({ status: statusFilter, category: categoryFilter, priority: priorityFilter, search }, CONTACT_PER_PAGE, offset),
    getContactStatusCounts(),
    countUrgentOpenContacts(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / CONTACT_PER_PAGE));

  const tabStatuses: Array<[string, string]> = [
    ["all", "All"],
    ["open", "Open"],
    ["in_progress", "In Progress"],
    ["waiting", "Waiting"],
    ["resolved", "Resolved"],
    ["closed", "Closed"],
  ];

  const isFiltered = search !== "" || categoryFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="acs-page">
      <div className="acs-page-header">
        <div>
          <h1 className="acs-page-title">💬 Contact Submissions</h1>
          <p className="acs-page-sub">Manage and respond to all user inquiries and support tickets.</p>
        </div>
        <div className="acs-header-actions">
          <a href="/contact" className="addash-btn addash-btn--secondary" target="_blank" rel="noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            View Contact Page
          </a>
        </div>
      </div>

      <div className="acs-stats">
        <div className="acs-stat">
          <div className="acs-stat-icon" style={{ background: "#fef9c3", color: "#854d0e" }}>🟡</div>
          <div><div className="acs-stat-label">Open</div><div className="acs-stat-value">{counts.open}</div></div>
        </div>
        <div className="acs-stat">
          <div className="acs-stat-icon" style={{ background: "#ede9fe", color: "#5b21b6" }}>🔵</div>
          <div><div className="acs-stat-label">In Progress</div><div className="acs-stat-value">{counts.in_progress}</div></div>
        </div>
        <div className="acs-stat">
          <div className="acs-stat-icon" style={{ background: "#ffedd5", color: "#9a3412" }}>🟠</div>
          <div><div className="acs-stat-label">Waiting on User</div><div className="acs-stat-value">{counts.waiting}</div></div>
        </div>
        <div className="acs-stat">
          <div className="acs-stat-icon" style={{ background: "#dcfce7", color: "#166534" }}>🟢</div>
          <div><div className="acs-stat-label">Resolved</div><div className="acs-stat-value">{counts.resolved}</div></div>
        </div>
        {urgentOpen > 0 ? (
          <div className="acs-stat acs-stat--urgent">
            <div className="acs-stat-icon" style={{ background: "#fee2e2", color: "#991b1b" }}>🚨</div>
            <div><div className="acs-stat-label">Urgent Open</div><div className="acs-stat-value">{urgentOpen}</div></div>
          </div>
        ) : null}
      </div>

      <div className="acs-tabs">
        {tabStatuses.map(([s, label]) => {
          const q = buildQuery([
            ["search", search],
            ["category", categoryFilter !== "all" ? categoryFilter : ""],
            ["priority", priorityFilter !== "all" ? priorityFilter : ""],
            ["status", s],
            ["page", 1],
          ]);
          const active = statusFilter === s ? " acs-tab--active" : "";
          const count = s === "all" ? counts.all : counts[s as keyof typeof counts];
          return (
            <a key={s} href={`?${q}`} className={`acs-tab${active}`}>
              {label}
              <span className="acs-tab-count">{count}</span>
            </a>
          );
        })}
      </div>

      <form method="GET" className="acs-filters">
        <input type="hidden" name="status" value={statusFilter} />
        <input type="text" name="search" className="acs-filter-input" placeholder="Search by name, email, subject, or ref…" defaultValue={search} />
        <select name="category" className="acs-filter-select" defaultValue={categoryFilter}>
          <option value="all">All Categories</option>
          {Object.entries(CONTACT_CATEGORY_LABELS).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
        <select name="priority" className="acs-filter-select" defaultValue={priorityFilter}>
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" className="addash-btn addash-btn--primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Filter
        </button>
        {isFiltered ? (
          <a href={`?status=${statusFilter}`} className="addash-btn addash-btn--secondary">Clear</a>
        ) : null}
      </form>

      {submissions.length === 0 ? (
        <div className="acs-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <p>No submissions match your filters.</p>
        </div>
      ) : (
        <>
          <div className="acs-table-wrap">
            <table className="acs-table">
              <thead>
                <tr>
                  <th>Ticket Ref</th>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Replies</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((row) => {
                  const sm = contactStatusMeta(CONTACT_STATUS_META_LIST, row.status, "acs-badge--open");
                  const pm = contactPriorityMeta(CONTACT_PRIORITY_META_LIST, row.priority, "acs-pri--normal");
                  const cat = categoryLabel(row.category);
                  const urgent = row.priority === "urgent" && row.status === "open";
                  return (
                    <tr key={row.id} className={`acs-row${urgent ? " acs-row--urgent" : ""}`}>
                      <td><code className="acs-ref">{row.ticket_ref}</code></td>
                      <td>
                        <div className="acs-sender">
                          <span className="acs-sender-name">{row.sender_name}</span>
                          <span className="acs-sender-email">{row.sender_email}</span>
                        </div>
                      </td>
                      <td className="acs-subject">{row.subject}</td>
                      <td><span className="acs-cat">{cat}</span></td>
                      <td><span className={`acs-pri ${pm.class}`}>{pm.label}</span></td>
                      <td><span className={`acs-badge ${sm.class}`}>{sm.label}</span></td>
                      <td className="acs-reply-count">{row.reply_count}</td>
                      <td className="acs-date">{formatMonthDayCommaYear(row.created_at)}</td>
                      <td>
                        <a href={`/admin/contact-submission-detail?id=${row.id}`} className="addash-btn addash-btn--secondary acs-view-btn">
                          View →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="acs-pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const pUrl = buildQuery([
                  ["status", statusFilter],
                  ["search", search],
                  ["category", categoryFilter !== "all" ? categoryFilter : ""],
                  ["priority", priorityFilter !== "all" ? priorityFilter : ""],
                  ["page", p],
                ]);
                return (
                  <a key={p} href={`?${pUrl}`} className={`acs-page-btn${p === currentPage ? " acs-page-btn--active" : ""}`}>{p}</a>
                );
              })}
              <span className="acs-page-info">Page {currentPage} of {totalPages} ({total} total)</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
