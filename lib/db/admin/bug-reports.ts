import { sql } from "@/lib/db/client";

/**
 * Port of the queries used by public/admin/bug-reports.php and
 * public/admin/bug-report-detail.php.
 *
 * MySQL's FIELD() ordering is reproduced with a CASE expression, and LIKE is
 * replaced with ILIKE (MySQL's default collation is case-insensitive; Postgres
 * is not) so the search behaves the same.
 */

export const BUG_STATUSES = ["all", "open", "in_progress", "resolved", "wont_fix", "duplicate"] as const;
export const BUG_SEVERITIES = ["all", "Low", "Minor", "Moderate", "High", "Critical"] as const;
export const BUG_TYPES = ["all", "bug", "ui", "performance", "feature", "content", "other"] as const;

export type BugListFilters = {
  status: string;
  severity: string;
  type: string;
  search: string;
};

export type BugReportListRow = {
  id: number;
  reference: string;
  reporter_name: string;
  reporter_email: string;
  reporter_role: string;
  issue_type: string;
  subject: string;
  severity_label: string;
  status: string;
  created_at: Date;
};

export type BugReportDetail = {
  id: number;
  reference: string;
  reporter_name: string;
  reporter_email: string;
  reporter_role: string;
  reporter_ip: string;
  issue_type: string;
  page_url: string;
  subject: string;
  description: string;
  steps: string | null;
  expected: string | null;
  severity: number;
  severity_label: string;
  browser: string;
  attachment: string | null;
  status: string;
  admin_notes: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type BugStatusCounts = {
  all: number;
  open: number;
  in_progress: number;
  resolved: number;
  wont_fix: number;
  duplicate: number;
};

/** buildBugWhere() — the PHP `$where` built from the three filters plus the search. */
function buildWhere(f: BugListFilters) {
  const like = `%${f.search}%`;
  let where = sql`WHERE 1 = 1`;
  if (f.status !== "all") where = sql`${where} AND status = ${f.status}`;
  if (f.severity !== "all") where = sql`${where} AND severity_label = ${f.severity}`;
  if (f.type !== "all") where = sql`${where} AND issue_type = ${f.type}`;
  if (f.search !== "") {
    where = sql`${where} AND (reference ILIKE ${like} OR subject ILIKE ${like} OR reporter_name ILIKE ${like} OR reporter_email ILIKE ${like})`;
  }
  return where;
}

export async function listBugReports(f: BugListFilters): Promise<BugReportListRow[]> {
  const where = buildWhere(f);
  return sql<BugReportListRow[]>`
    SELECT id, reference, reporter_name, reporter_email, reporter_role,
           issue_type, subject, severity_label, status, created_at
    FROM   bug_reports
    ${where}
    ORDER BY
       CASE severity_label WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Moderate' THEN 3 WHEN 'Minor' THEN 4 WHEN 'Low' THEN 5 ELSE 6 END,
       CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 WHEN 'wont_fix' THEN 4 WHEN 'duplicate' THEN 5 ELSE 6 END,
       created_at DESC
  `;
}

/** Per-status counts for the tabs. */
export async function getBugStatusCounts(): Promise<BugStatusCounts> {
  const rows = await sql<
    { open: number; in_progress: number; resolved: number; wont_fix: number; duplicate: number }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE status = 'open')::int        AS open,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved')::int    AS resolved,
      COUNT(*) FILTER (WHERE status = 'wont_fix')::int    AS wont_fix,
      COUNT(*) FILTER (WHERE status = 'duplicate')::int   AS duplicate
    FROM bug_reports
  `;
  const r = rows[0] ?? { open: 0, in_progress: 0, resolved: 0, wont_fix: 0, duplicate: 0 };
  return { ...r, all: r.open + r.in_progress + r.resolved + r.wont_fix + r.duplicate };
}

/** Critical-open count for the "Critical Open" stat card. */
export async function countCriticalOpenBugs(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM bug_reports WHERE status = 'open' AND severity_label = 'Critical'
  `;
  return rows[0]?.c ?? 0;
}

export async function getBugReportById(id: number): Promise<BugReportDetail | null> {
  const rows = await sql<BugReportDetail[]>`SELECT * FROM bug_reports WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** Update status + admin note; resolved_at is set, cleared, or left untouched. */
export async function updateBugReportStatus(params: {
  id: number;
  newStatus: string;
  adminNotes: string;
  resolvedAction: "set" | "clear" | "none";
}): Promise<boolean> {
  const { id, newStatus, adminNotes, resolvedAction } = params;
  const rows = await sql<{ id: number }[]>`
    UPDATE bug_reports
    SET status = ${newStatus},
        admin_notes = ${adminNotes},
        updated_at = now(),
        resolved_at = ${
          resolvedAction === "set" ? sql`now()` : resolvedAction === "clear" ? sql`NULL` : sql`resolved_at`
        }
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Used by the admin-only bug-attachment download route to authorise a filename. */
export async function findBugReportByAttachment(filename: string): Promise<{ attachment: string } | null> {
  const rows = await sql<{ attachment: string }[]>`
    SELECT attachment FROM bug_reports WHERE attachment = ${filename} LIMIT 1
  `;
  return rows[0] ?? null;
}
