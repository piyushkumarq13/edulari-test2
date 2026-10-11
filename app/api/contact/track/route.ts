import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref = (searchParams.get("ref") ?? "").toUpperCase().trim();
  const email = (searchParams.get("email") ?? "").trim();
  if (!ref || !email) return NextResponse.json({ ticket: null, replies: [] });

  const rows = await sql<Record<string, unknown>[]>`SELECT * FROM contact_submissions WHERE ticket_ref = ${ref} AND sender_email = ${email}`;
  if (rows.length === 0) return NextResponse.json({ ticket: null, replies: [] });
  const t = rows[0];

  const replies = await sql`
    SELECT r.reply_message, r.reply_type, r.resolution_status, u.name AS admin_name, r.created_at
    FROM contact_replies r LEFT JOIN users u ON u.id = r.admin_id
    WHERE r.submission_id = ${t.id as number} AND r.reply_type = 'public'
    ORDER BY r.created_at ASC
  `;
  return NextResponse.json({ ticket: t, replies });
}
