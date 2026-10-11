import type { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import type { SessionUser } from "@/lib/auth/sessions";
import {
  deleteContactSubmission,
  getContactSubmissionById,
  insertContactReply,
  updateContactStatus,
} from "@/lib/db/admin/contact-submissions";
import { sendContactReplyEmail } from "@/lib/email/contact-senders";
import { redirectAfter, redirectTo } from "./redirect";

const DETAIL = "/admin/contact-submission-detail";

const ALLOWED_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"];
const ALLOWED_TYPES = ["public", "internal"];

/** PHP strip_tags() — drop every HTML/PHP tag, keep the text. */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

/** PHP mb_strlen() — count Unicode code points, not UTF-16 units. */
export function codePointLength(value: string): number {
  return [...value].length;
}

/** PHP ucfirst(str_replace('_', ' ', $s)). */
function humanStatus(status: string): string {
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * POST handler for /api/admin/contact-submissions/[id]. Ports the POST block of
 * public/admin/contact-submission-detail.php (lines 30-126): three actions —
 * reply (public/internal), change_status, delete — behind the admin guard,
 * Origin/Host and CSRF checks. Sends the reply email only for public replies.
 * Carries `msg_type` across the redirect so the flash renders typed (the PHP lost
 * it); see docs/PROGRESS.md.
 */
export async function handleContactDetailPost(req: Request, id: number): Promise<NextResponse> {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;

  const admin: SessionUser = auth.user;
  const { fields } = await readFields(req);

  if (!(await csrfOk(fields.csrf_token))) {
    return redirectAfter(
      req,
      { id: String(id), msg: "Security token mismatch. Please refresh and try again.", msg_type: "error" },
      DETAIL,
    );
  }

  const submission = await getContactSubmissionById(id);
  if (!submission) {
    return redirectTo("/admin/contact-submissions");
  }

  const action = fields.action ?? "";

  if (action === "reply") {
    const replyMsg = stripTags(fields.reply_message ?? "").trim();
    let newStatus = fields.new_status ?? submission.status;
    let replyType = fields.reply_type ?? "public";

    if (!ALLOWED_STATUSES.includes(newStatus)) newStatus = submission.status;
    if (!ALLOWED_TYPES.includes(replyType)) replyType = "public";

    const len = codePointLength(replyMsg);
    if (replyMsg === "" || len < 5) {
      return redirectAfter(req, { id: String(id), msg: "Reply message is too short (minimum 5 characters).", msg_type: "error" }, DETAIL);
    }
    if (len > 10000) {
      return redirectAfter(req, { id: String(id), msg: "Reply is too long (max 10 000 characters).", msg_type: "error" }, DETAIL);
    }

    const saved = await insertContactReply({
      submissionId: id,
      adminId: admin.id,
      replyMessage: replyMsg,
      replyType,
      resolutionStatus: newStatus !== submission.status ? newStatus : null,
    });

    await updateContactStatus(id, newStatus);

    if (replyType === "public" && saved) {
      await sendContactReplyEmail(submission.sender_email, submission.sender_name, submission.subject, submission.ticket_ref, replyMsg, newStatus);
    }

    const flash = replyType === "internal" ? "Internal note saved." : "Reply sent and user notified via email.";
    await auditAdmin(
      admin,
      replyType === "internal" ? "admin.contact.internal_note" : "admin.contact.reply",
      { submission_id: id, status: newStatus },
      req,
    );
    return redirectAfter(req, { id: String(id), msg: flash, msg_type: "success" }, DETAIL);
  }

  if (action === "change_status") {
    let newStatus = fields.new_status ?? submission.status;
    if (!ALLOWED_STATUSES.includes(newStatus)) newStatus = submission.status;

    await updateContactStatus(id, newStatus);

    const flash = `Ticket status updated to ${humanStatus(newStatus)}.`;
    await auditAdmin(admin, "admin.contact.change_status", { submission_id: id, status: newStatus }, req);
    return redirectAfter(req, { id: String(id), msg: flash, msg_type: "success" }, DETAIL);
  }

  if (action === "delete") {
    await deleteContactSubmission(id);
    await auditAdmin(admin, "admin.contact.delete", { submission_id: id }, req);
    return redirectTo("/admin/contact-submissions?msg=deleted");
  }

  // Unknown action: the PHP fell through and re-rendered the page with no flash.
  return redirectAfter(req, { id: String(id) }, DETAIL);
}
