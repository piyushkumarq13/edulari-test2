import type { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import type { SessionUser } from "@/lib/auth/sessions";
import {
  getBugReportById,
  updateBugReportStatus,
} from "@/lib/db/admin/bug-reports";
import { sendMail } from "@/lib/email/transport";
import {
  buildBugStatusEmailSubject,
  buildBugStatusEmailHtml,
  buildBugStatusEmailText,
} from "@/lib/email/bug-status";
import { redirectAfter } from "./redirect";

const DETAIL = "/admin/bug-report-detail";

const ACTION_STATUS: Record<string, string> = {
  resolve: "resolved",
  in_progress: "in_progress",
  reopen: "open",
  wont_fix: "wont_fix",
  duplicate: "duplicate",
};

const STATUS_FLASH: Record<string, string> = {
  resolved: "Resolved",
  in_progress: "marked In Progress",
  open: "Reopened",
  wont_fix: "marked Won't Fix",
  duplicate: "marked as Duplicate",
};

/**
 * POST handler for /api/admin/bug-reports/[id]. Ports the POST block of
 * public/admin/bug-report-detail.php (lines 26-123): verify CSRF, map the action
 * to a status, always overwrite admin_notes, set/clear resolved_at, notify the
 * reporter by email, then Post/Redirect/Get with the exact PHP flash wording.
 *
 * The PHP rendered the error/success inline (no redirect) except on success; the
 * port keeps Post/Redirect/Get for every outcome so a refresh never resubmits, and
 * carries `msg_type` so the flash renders danger-styled — see docs/PROGRESS.md.
 */
export async function handleBugDetailPost(req: Request, id: number): Promise<NextResponse> {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;
  const admin: SessionUser = auth.user;

  const { fields } = await readFields(req);

  if (!(await csrfOk(fields.csrf_token))) {
    return redirectAfter(
      req,
      { id: String(id), msg: "Invalid security token. Please refresh and try again.", msg_type: "error" },
      DETAIL,
    );
  }

  const report = await getBugReportById(id);
  if (!report) {
    return redirectAfter(req, { msg: "Unknown action.", msg_type: "error" }, "/admin/bug-reports");
  }

  const action = fields.action ?? "";
  if (!(action in ACTION_STATUS)) {
    return redirectAfter(req, { id: String(id), msg: "Unknown action.", msg_type: "error" }, DETAIL);
  }

  const newStatus = ACTION_STATUS[action];
  const adminNotes = (fields.admin_notes ?? "").trim();

  const resolvedAction: "set" | "clear" | "none" =
    newStatus === "resolved" ? "set" : report.status === "resolved" && newStatus !== "resolved" ? "clear" : "none";

  const updated = await updateBugReportStatus({ id, newStatus, adminNotes, resolvedAction });
  if (!updated) {
    return redirectAfter(req, { id: String(id), msg: "Failed to update the report. Please try again.", msg_type: "error" }, DETAIL);
  }

  let emailSent = false;
  try {
    const result = await sendMail({
      to: report.reporter_email,
      toName: report.reporter_name,
      subject: buildBugStatusEmailSubject(newStatus, report.subject, report.reference),
      html: buildBugStatusEmailHtml(report.reporter_name, report.subject, report.reference, newStatus, adminNotes),
      text: buildBugStatusEmailText(report.reporter_name, report.subject, report.reference, newStatus, adminNotes),
    });
    if (result.ok) {
      emailSent = true;
    } else {
      console.error(`[BugReport] Status email failed: ${result.error}`);
    }
  } catch (e) {
    console.error(`[BugReport] Status email failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const lbl = STATUS_FLASH[newStatus] ?? newStatus;
  const message = `Report ${lbl} successfully.${emailSent ? " Reporter notified by email." : " (Email notification failed — check logs.)"}`;

  await auditAdmin(admin, "admin.bug_report.status", { bug_report_id: id, status: newStatus }, req);
  return redirectAfter(req, { id: String(id), msg: message, msg_type: "success" }, DETAIL);
}
