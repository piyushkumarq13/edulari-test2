import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import { maybeCleanupStaleDraftDocs, maybePurgeRejectedInstructorData } from "@/lib/instructor/maintenance";
import { cleanupExpiredTokens } from "@/lib/token-cleanup";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE = "/admin/dashboard";

/**
 * POST handler for public/admin/dashboard.php's three maintenance actions.
 *
 * The PHP posted back to the page and, on success, redirected to itself with `?msg=` (PRG). The
 * same three forms post here; the handler answers with a 303 back to /admin/dashboard carrying the
 * identical flash message, which the page renders inside the matching maintenance card.
 */
function redirectWithMsg(req: Request, msg: string): NextResponse {
  const url = new URL(BASE, req.url);
  url.searchParams.set("msg", msg);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const form = await req.formData();
  const token = form.get("csrf_token");
  if (!(await csrfOk(typeof token === "string" ? token : ""))) {
    // The PHP: http_response_code(403); die('Security token mismatch. Refresh the page and try again.');
    return new NextResponse("Security token mismatch. Refresh the page and try again.", { status: 403 });
  }

  if (form.get("run_cleanup") === "1") {
    const deleted = await maybeCleanupStaleDraftDocs(true);
    const msg =
      deleted > 0
        ? `Cleanup done — removed doc files from ${deleted} application(s).`
        : "Cleanup done — no stale files found.";
    await auditAdmin(user, "admin.dashboard.run_cleanup", { deleted }, req);
    return redirectWithMsg(req, msg);
  }

  if (form.get("run_purge") === "1") {
    const purged = await maybePurgeRejectedInstructorData(true);
    const msg =
      purged > 0
        ? `Purge done — cleared instructor data for ${purged} rejected/failed user(s). They are now active students.`
        : "Purge done — no rejected/failed users found to purge.";
    await auditAdmin(user, "admin.dashboard.run_purge", { purged }, req);
    return redirectWithMsg(req, msg);
  }

  if (form.get("run_token_cleanup") === "1") {
    const counts = await cleanupExpiredTokens(true);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    let msg: string;
    if (total > 0) {
      // Key order mirrors cleanupExpiredTokens() = test_tokens, test_failures,
      // email_verification_tokens, password_resets, login_attempts.
      const details = Object.entries(counts)
        .map(([table, n]) => `${n} from ${table}`)
        .join(", ");
      msg = `Token cleanup done — deleted ${total} expired row(s): ${details}.`;
    } else {
      msg = "Token cleanup done — nothing to delete.";
    }
    await auditAdmin(user, "admin.dashboard.run_token_cleanup", { total, counts }, req);
    return redirectWithMsg(req, msg);
  }

  // Unknown action: the PHP fell through and re-rendered with no alert. A bare redirect matches.
  return redirectWithMsg(req, "");
}
