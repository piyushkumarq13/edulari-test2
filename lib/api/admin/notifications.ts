import { NextResponse } from "next/server";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import { NOTIF_TYPES, AUDIENCE_OPTIONS } from "@/lib/admin/notification-options";
import {
  createNotificationForAll,
  createNotificationForRole,
  createNotificationForSpecific,
  findActiveUserIdByEmail,
} from "@/lib/db/admin/notifications";

/**
 * Port of public/admin/send-notifications.php. Classic form POST + Post/Redirect/Get: the handler
 * validates in the exact PHP order, stores ONE notification_messages row, then 303s back to
 * /admin/send-notifications carrying the flash message (or error) in the query string.
 */

const BASE = "/admin/send-notifications";

function redirectBack(req: Request, params: Record<string, string> = {}): NextResponse {
  const url = new URL(BASE, req.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, 303);
}

function flashError(req: Request, message: string): NextResponse {
  return redirectBack(req, { error: message });
}

/** POST /api/admin/notifications */
export async function notificationsPost(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const { fields } = await readFields(req);

  // CSRF: the PHP stored a flash and redirected (unlike the JSON banners page).
  if (!(await csrfOk(fields.csrf_token))) {
    return flashError(req, "Security token mismatch. Please refresh and try again.");
  }

  const type = (fields.type ?? "").trim();
  const title = (fields.title ?? "").trim();
  const body = (fields.body ?? "").trim();
  const audience = (fields.audience ?? "").trim();
  const email = (fields.email ?? "").trim();

  // Validation order is identical to send-notifications.php (first failure wins). strlen() is
  // byte-based; Buffer.byteLength reproduces that for multibyte input.
  if (!Object.prototype.hasOwnProperty.call(NOTIF_TYPES, type)) {
    return flashError(req, "Please select a valid notification type.");
  }
  const titleBytes = Buffer.byteLength(title, "utf8");
  if (titleBytes < 3) return flashError(req, "Title must be at least 3 characters.");
  if (titleBytes > 255) return flashError(req, "Title must not exceed 255 characters.");
  if (Buffer.byteLength(body, "utf8") < 5) return flashError(req, "Message body is too short.");
  if (!Object.prototype.hasOwnProperty.call(AUDIENCE_OPTIONS, audience)) {
    return flashError(req, "Please select a valid audience.");
  }
  if (audience === "specific" && email === "") {
    return flashError(req, "Please enter the user's email address.");
  }

  const adminId = Number(user.id) || 0;
  let sentCount = 0;
  let label = "selected users";

  if (audience === "all") {
    sentCount = await createNotificationForAll(type, title, body, adminId);
    label = "all users";
  } else if (audience === "student" || audience === "instructor" || audience === "admin") {
    sentCount = await createNotificationForRole(audience, type, title, body, adminId);
    label = audience === "student" ? "all students" : audience === "instructor" ? "all instructors" : "all admins";
  } else if (audience === "specific") {
    const targetId = await findActiveUserIdByEmail(email);
    if (targetId === null) {
      return flashError(req, "No active user found with that email address.");
    }
    sentCount = await createNotificationForSpecific(targetId, type, title, body);
    label = email;
  }

  if (sentCount > 0) {
    await auditAdmin(user, "admin.notification.send", { type, audience, target: label }, req);
    return redirectBack(req, { msg: `Notification sent successfully to ${label}. (1 record stored)` });
  }
  return flashError(req, "No users matched the selected audience, or the send failed.");
}
