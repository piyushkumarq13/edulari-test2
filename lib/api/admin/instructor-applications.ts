import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import {
  approveInstructorApplication,
  rejectInstructorApplication,
} from "@/lib/db/instructor-registration";
import type { SessionUser } from "@/lib/auth/sessions";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

const CSRF_ERROR = "Invalid request. Please try again.";

const approveSchema = z.object({
  action: z.literal("approve"),
  application_id: z.coerce.number().int().positive(),
});

const rejectSchema = z.object({
  action: z.literal("reject"),
  application_id: z.coerce.number().int().positive(),
  rejection_reason: z.string().trim().max(1000).default(""),
});

const bulkSchema = z.object({
  action: z.enum(["bulk_approve", "bulk_reject"]),
  selected_ids: z
    .array(z.coerce.number().int().positive())
    .max(500, "Too many applications."),
  bulk_rejection_reason: z.string().trim().max(1000).default(""),
});

/**
 * Post/Redirect/Get for the admin application pages. The PHP page echoed
 * `header("Location: ?$qs")` with array_merge($_GET, ['msg' => ...]), i.e. it kept every
 * filter and carried the flash message in the query string. Here the Referer carries the
 * same current-URL GET params, gets replayed, and `extra` wins over any previous values
 * (exactly like the PHP array_merge order).
 */
function redirectAfter(
  req: Request,
  extra: Record<string, string>,
  fallback = "/admin/instructor-applications",
): NextResponse {
  const base = new URL(SITE_URL || "http://localhost");
  const target = new URL(fallback, base);
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const refUrl = new URL(ref, base);
      for (const [k, v] of refUrl.searchParams) target.searchParams.set(k, v);
    } catch {
      // Referer malformed — fall back to the bare page.
    }
  }
  for (const [k, v] of Object.entries(extra)) target.searchParams.set(k, v);
  return NextResponse.redirect(target, 303);
}

/**
 * POST handler for /api/admin/instructor-applications. Reproduces the list page's POST
 * block (lines 23-76): approve / reject / bulk_approve / bulk_reject, all behind the
 * admin guard, Origin/Host check (inside authorizeAdmin) and the CSRF token check.
 * Every success redirects with the exact PHP flash message.
 */
export async function handleApplicationsListPost(req: Request): Promise<NextResponse> {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;
  const admin: SessionUser = auth.user;

  const { fields, form } = await readFields(req);
  if (!(await csrfOk(fields.csrf_token))) {
    return redirectAfter(req, { error: CSRF_ERROR });
  }

  const action = fields.action ?? "";

  if (action === "approve" || action === "reject") {
    const parsed = (action === "approve" ? approveSchema : rejectSchema).safeParse(fields);
    if (!parsed.success) return redirectAfter(req, { error: CSRF_ERROR });
    const { application_id: appId } = parsed.data;

    if (parsed.data.action === "approve") {
      const result = await approveInstructorApplication(appId);
      if (result.ok) {
        await auditAdmin(admin, "admin.application.approve", { application_id: appId }, req);
        return redirectAfter(req, { msg: "Application approved and instructor notified." });
      }
      return redirectAfter(req, { error: result.error ?? "Failed to approve application." });
    }

    const result = await rejectInstructorApplication(appId, parsed.data.rejection_reason);
    if (result.ok) {
      await auditAdmin(admin, "admin.application.reject", { application_id: appId }, req);
      return redirectAfter(req, { msg: "Application rejected." });
    }
    return redirectAfter(req, { error: result.error ?? "Failed to reject application." });
  }

  if (action === "bulk_approve" || action === "bulk_reject") {
    const rawIds =
      form.getAll("selected_ids[]").length > 0
        ? form.getAll("selected_ids[]")
        : fields.selected_ids
          ? [fields.selected_ids]
          : [];
    const parsed = bulkSchema.safeParse({ action, selected_ids: rawIds, bulk_rejection_reason: fields.bulk_rejection_reason ?? "" });
    if (!parsed.success) return redirectAfter(req, { error: CSRF_ERROR });
    const { selected_ids: ids, bulk_rejection_reason: reason } = parsed.data;

    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const result =
        action === "bulk_approve"
          ? await approveInstructorApplication(id)
          : await rejectInstructorApplication(id, reason);
      if (result.ok) ok++;
      else fail++;
    }

    const verb = action === "bulk_approve" ? "approved" : "rejected";
    let message = `${ok} application(s) ${verb}.`;
    if (fail > 0) message += ` ${fail} action(s) failed.`;

    await auditAdmin(
      admin,
      action === "bulk_approve" ? "admin.application.bulk_approve" : "admin.application.bulk_reject",
      { ids, ok, fail },
      req,
    );
    return redirectAfter(req, { msg: message });
  }

  return redirectAfter(req, { error: CSRF_ERROR });
}

/**
 * POST handler for /api/admin/instructor-applications/[id]. Reproduces the detail page's
 * POST block (lines 25-56). The PHP page lost the $msgType across the redirect (only
 * `msg` was carried), so every message rendered as success; the port also carries
 * `msg_type` so a rejection flash renders danger-typed — the intended behaviour.
 * See docs/PROGRESS.md "Port decisions".
 */
export async function handleApplicationDetailPost(
  req: Request,
  applicationId: number,
): Promise<NextResponse> {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;
  const admin: SessionUser = auth.user;

  const { fields } = await readFields(req);
  if (!(await csrfOk(fields.csrf_token))) {
    return redirectAfter(req, { error: CSRF_ERROR });
  }

  const action = fields.action ?? "";

  if (action === "approve") {
    const result = await approveInstructorApplication(applicationId);
    if (result.ok) {
      await auditAdmin(admin, "admin.application.approve", { application_id: applicationId }, req);
      return redirectAfter(req, {
        msg: "Application approved successfully. The instructor has been notified by email.",
        msg_type: "success",
      });
    }
    return redirectAfter(req, { error: result.error ?? "Failed to approve application." });
  }

  if (action === "reject") {
    const reason = (fields.rejection_reason ?? "").trim().slice(0, 1000);
    const result = await rejectInstructorApplication(applicationId, reason);
    if (result.ok) {
      await auditAdmin(admin, "admin.application.reject", { application_id: applicationId }, req);
      return redirectAfter(req, {
        msg: "Application rejected. The applicant has been notified.",
        msg_type: "danger",
      });
    }
    return redirectAfter(req, { error: result.error ?? "Failed to reject application." });
  }

  return redirectAfter(req, { error: CSRF_ERROR });
}