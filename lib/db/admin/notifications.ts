import { sql } from "@/lib/db/client";

/**
 * Admin-side send helpers from private/functions/notifications.php.
 *
 * The PHP stores ONE notification_messages row per broadcast (no per-user duplication) and never
 * writes notification_reads rows on send — read/delete state is created lazily by the reader. The
 * exact INSERT columns and audience values are reproduced here, including the quirk that a
 * "specific" send stores sent_by = NULL even though an admin triggered it.
 */

/** createNotificationForAll(): audience='all', target NULL, sent_by = $sentBy ?: null. Returns 1/0. */
export async function createNotificationForAll(
  type: string,
  title: string,
  body: string,
  sentBy: number,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO notification_messages (type, title, body, audience, target_user_id, sent_by)
    VALUES (${type}, ${title}, ${body}, 'all', NULL, ${sentBy || null})
    RETURNING id
  `;
  return rows.length > 0 ? 1 : 0;
}

/** createNotificationForRole(): audience = the role string, target NULL, sent_by = $sentBy ?: null. */
export async function createNotificationForRole(
  role: string,
  type: string,
  title: string,
  body: string,
  sentBy: number,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO notification_messages (type, title, body, audience, target_user_id, sent_by)
    VALUES (${type}, ${title}, ${body}, ${role}, NULL, ${sentBy || null})
    RETURNING id
  `;
  return rows.length > 0 ? 1 : 0;
}

/** createNotification(): audience='specific', target_user_id = the user, sent_by = NULL. */
export async function createNotificationForSpecific(
  userId: number,
  type: string,
  title: string,
  body: string,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO notification_messages (type, title, body, audience, target_user_id, sent_by)
    VALUES (${type}, ${title}, ${body}, 'specific', ${userId}, NULL)
    RETURNING id
  `;
  return rows.length > 0 ? 1 : 0;
}

/** The specific-user lookup from send-notifications.php: active users only, LIMIT 1. */
export async function findActiveUserIdByEmail(email: string): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM users WHERE email = ${email} AND is_active = true LIMIT 1
  `;
  return rows.length > 0 ? Number(rows[0].id) : null;
}

/** notificationTypeLabel() from functions/notifications.php (unchanged). */
export function notificationTypeLabel(type: string): string {
  switch (type) {
    case "welcome":
      return "Welcome";
    case "password_reset":
      return "Password Reset";
    case "password_changed":
    case "new_login":
      return "Security Alert";
    case "instructor_approved":
    case "instructor_rejected":
      return "Application";
    case "promotional":
      return "Promotion";
    case "general":
      return "General";
    case "featured_course":
      return "Featured Course";
    case "new_course":
      return "New Course";
    case "recommendation":
      return "Recommendation";
    case "announcement":
      return "Announcement";
    default:
      return "Notification";
  }
}
