import { sql } from "@/lib/db/client";

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  audience: string;
  target_user_id: number | null;
  sent_by: number | null;
  created_at: Date;
  is_read: boolean;
  deleted_at: Date | null;
};

export async function listForUser(userId: number, limit = 20, offset = 0): Promise<Notification[]> {
  const rows = await sql<Notification[]>`
    SELECT m.*, COALESCE(r.is_read, false) AS is_read, r.deleted_at
    FROM notification_messages m
    LEFT JOIN notification_reads r ON r.message_id = m.id AND r.user_id = ${userId}
    WHERE (m.audience = 'all' OR m.audience = (SELECT role FROM users WHERE id = ${userId}) OR (m.audience = 'specific' AND m.target_user_id = ${userId}))
      AND (r.deleted_at IS NULL OR r.deleted_at > now())
    ORDER BY m.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows;
}

export async function unreadCount(userId: number): Promise<number> {
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*)::text AS c
    FROM notification_messages m
    LEFT JOIN notification_reads r ON r.message_id = m.id AND r.user_id = ${userId}
    WHERE (m.audience = 'all' OR m.audience = (SELECT role FROM users WHERE id = ${userId}) OR (m.audience = 'specific' AND m.target_user_id = ${userId}))
      AND (r.deleted_at IS NULL OR r.deleted_at > now())
      AND COALESCE(r.is_read, false) = false
  `;
  return Number(rows[0].c);
}

export async function recentForUser(userId: number, limit = 5): Promise<Notification[]> {
  return listForUser(userId, limit, 0);
}

export async function createNotification(targetUserId: number | null, type: string, title: string, body: string, audience = "specific", sentBy?: number): Promise<void> {
  await sql`INSERT INTO notification_messages (type, title, body, audience, target_user_id, sent_by) VALUES (${type}, ${title}, ${body}, ${audience}, ${targetUserId}, ${sentBy ?? null})`;
}

export async function markRead(userId: number, messageId: number): Promise<void> {
  await sql`
    INSERT INTO notification_reads (message_id, user_id, is_read)
    VALUES (${messageId}, ${userId}, true)
    ON CONFLICT (message_id, user_id) DO UPDATE SET is_read = true
  `;
}

export async function markAllRead(userId: number): Promise<void> {
  await sql`
    INSERT INTO notification_reads (message_id, user_id, is_read)
    SELECT m.id, ${userId}, true
    FROM notification_messages m
    WHERE (m.audience = 'all' OR m.audience = (SELECT role FROM users WHERE id = ${userId}) OR (m.audience = 'specific' AND m.target_user_id = ${userId}))
    ON CONFLICT (message_id, user_id) DO UPDATE SET is_read = true
  `;
}

export async function softDelete(userId: number, messageId: number): Promise<void> {
  await sql`
    INSERT INTO notification_reads (message_id, user_id, deleted_at)
    VALUES (${messageId}, ${userId}, now())
    ON CONFLICT (message_id, user_id) DO UPDATE SET deleted_at = now()
  `;
}
