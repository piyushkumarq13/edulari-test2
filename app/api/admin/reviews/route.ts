import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import { deleteReviewAction } from "@/lib/api/admin/reviews";

export const runtime = "nodejs";

/**
 * AJAX handler for public/admin/reviews.php. The only write action is `ajax_delete`, which the PHP
 * answered with `{success: <bool>}`.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const form = await req.formData();
  const token = form.get("csrf_token");
  if (!(await csrfOk(typeof token === "string" ? token : ""))) {
    return NextResponse.json({ success: false, message: "Invalid CSRF token." });
  }

  if (form.get("ajax_delete") !== null) {
    const reviewId = Number.parseInt(String(form.get("review_id") ?? "0"), 10) || 0;
    const result = await deleteReviewAction(reviewId);
    if (result.success) {
      await auditAdmin(user, "admin.review.delete", { review_id: reviewId }, req);
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ success: false, message: "Unknown action." });
}
