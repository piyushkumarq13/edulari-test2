import { sql, withTransaction } from "@/lib/db/client";

/**
 * Port of the queries used by public/admin/contact-submissions.php and
 * public/admin/contact-submission-detail.php.
 *
 * FIELD() ordering is reproduced with CASE; LIKE becomes ILIKE for the same
 * case-insensitive search MySQL provided.
 */

export const CONTACT_STATUSES = ["all", "open", "in_progress", "waiting", "resolved", "closed"] as const;
export const CONTACT_CATEGORIES = [
  "all",
  "general",
  "billing",
  "technical",
  "course_content",
  "account",
  "instructor",
  "partnership",
  "feedback",
  "other",
] as const;
export const CONTACT_PRIORITIES = ["all", "low", "normal", "high", "urgent"] as const;

export const CONTACT_PER_PAGE = 25;

export type ContactListFilters = {
  status: string;
  category: string;
  priority: string;
  search: string;
};

export type ContactListRow = {
  id: number;
  ticket_ref: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: Date;
  reply_count: number;
};

export type ContactDetail = {
  id: number;
  ticket_ref: string;
  user_id: number | null;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  order_ref: string | null;
  course_ref: string | null;
  sender_ip: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type ContactReplyRow = {
  id: number;
  submission_id: number;
  admin_id: number;
  reply_message: string;
  reply_type: string;
  resolution_status: string | null;
  created_at: Date;
  admin_name: string | null;
};

export type ContactStatusCounts = {
  all: number;
  open: number;
  in_progress: number;
  waiting: number;
  resolved: number;
  closed: number;
};

/** buildWhere() — the PHP `$where` with every column table-qualified. */
function buildWhere(f: ContactListFilters) {
  const like = `%${f.search}%`;
  let where = sql`WHERE 1 = 1`;
  if (f.status !== "all") where = sql`${where} AND cs.status = ${f.status}`;
  if (f.category !== "all") where = sql`${where} AND cs.category = ${f.category}`;
  if (f.priority !== "all") where = sql`${where} AND cs.priority = ${f.priority}`;
  if (f.search !== "") {
    where = sql`${where} AND (cs.ticket_ref ILIKE ${like} OR cs.subject ILIKE ${like} OR cs.sender_name ILIKE ${like} OR cs.sender_email ILIKE ${like})`;
  }
  return where;
}

export async function countContactSubmissions(f: ContactListFilters): Promise<number> {
  const where = buildWhere(f);
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM contact_submissions cs ${where}
  `;
  return rows[0]?.c ?? 0;
}

export async function listContactSubmissions(
  f: ContactListFilters,
  limit: number,
  offset: number,
): Promise<ContactListRow[]> {
  const where = buildWhere(f);
  return sql<ContactListRow[]>`
    SELECT cs.*,
           (SELECT COUNT(*) FROM contact_replies cr WHERE cr.submission_id = cs.id)::int AS reply_count
    FROM   contact_submissions cs
    ${where}
    ORDER BY
       CASE cs.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
       CASE cs.status WHEN 'open' THEN 1 WHEN 'waiting' THEN 2 WHEN 'in_progress' THEN 3 WHEN 'resolved' THEN 4 WHEN 'closed' THEN 5 ELSE 6 END,
       cs.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/** Per-status counts for the tab badges. */
export async function getContactStatusCounts(): Promise<ContactStatusCounts> {
  const rows = await sql<
    { open: number; in_progress: number; waiting: number; resolved: number; closed: number }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE status = 'open')::int        AS open,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'waiting')::int     AS waiting,
      COUNT(*) FILTER (WHERE status = 'resolved')::int    AS resolved,
      COUNT(*) FILTER (WHERE status = 'closed')::int      AS closed
    FROM contact_submissions
  `;
  const r = rows[0] ?? { open: 0, in_progress: 0, waiting: 0, resolved: 0, closed: 0 };
  return { ...r, all: r.open + r.in_progress + r.waiting + r.resolved + r.closed };
}

/** "Urgent Open" stat: open tickets with urgent priority. */
export async function countUrgentOpenContacts(): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM contact_submissions WHERE status = 'open' AND priority = 'urgent'
  `;
  return rows[0]?.c ?? 0;
}

export async function getContactSubmissionById(id: number): Promise<ContactDetail | null> {
  const rows = await sql<ContactDetail[]>`SELECT * FROM contact_submissions WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getContactReplies(submissionId: number): Promise<ContactReplyRow[]> {
  return sql<ContactReplyRow[]>`
    SELECT r.*, u.name AS admin_name
    FROM   contact_replies r
    LEFT JOIN users u ON u.id = r.admin_id
    WHERE  r.submission_id = ${submissionId}
    ORDER  BY r.created_at ASC
  `;
}

/** INSERT of a contact reply row (the PHP used dbInsert, which returns truthy on success). */
export async function insertContactReply(params: {
  submissionId: number;
  adminId: number;
  replyMessage: string;
  replyType: string;
  resolutionStatus: string | null;
}): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO contact_replies
      (submission_id, admin_id, reply_message, reply_type, resolution_status, created_at)
    VALUES
      (${params.submissionId}, ${params.adminId}, ${params.replyMessage}, ${params.replyType}, ${params.resolutionStatus}, now())
    RETURNING id
  `;
  return rows.length > 0;
}

export async function updateContactStatus(id: number, status: string): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`
    UPDATE contact_submissions SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** Delete a ticket and all of its replies atomically. */
export async function deleteContactSubmission(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    await tx`DELETE FROM contact_replies WHERE submission_id = ${id}`;
    await tx`DELETE FROM contact_submissions WHERE id = ${id}`;
  });
}
