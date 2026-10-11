import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/track-contact.css";
import { sql } from "@/lib/db/client";
import TrackContactClient from "./TrackContactClient";
export const metadata: Metadata = pageMetadata({
  title: "Track My Ticket - Edulari",
  description: "Look up the status of a support ticket using your ticket reference and email address.",
  path: "/track-contact",
  keywords: "track ticket, support status, ticket reference",
});

export default async function TrackContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ref = (sp.ref ?? "").toUpperCase();
  const email = sp.email ?? "";
  let ticket: Record<string, unknown> | null = null;
  let replies: Array<{ reply_message: string; reply_type: string; resolution_status: string | null; admin_name: string | null; created_at: Date }> = [];

  if (ref && email) {
    const rows = await sql<Record<string, unknown>[]>`SELECT * FROM contact_submissions WHERE ticket_ref = ${ref} AND sender_email = ${email}`;
    ticket = rows.length ? rows[0] : null;
    if (ticket) {
      replies = await sql`
        SELECT r.reply_message, r.reply_type, r.resolution_status, u.name AS admin_name, r.created_at
        FROM contact_replies r LEFT JOIN users u ON u.id = r.admin_id
        WHERE r.submission_id = ${ticket!.id as number} AND r.reply_type = 'public'
        ORDER BY r.created_at ASC
      `;
    }
  }

  return <TrackContactClient prefillRef={ref} prefillEmail={email} ticket={ticket} replies={JSON.parse(JSON.stringify(replies))} />;
}
