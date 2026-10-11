import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import { getContactSubmissionById, getContactReplies } from "@/lib/db/admin/contact-submissions";
import { CONTACT_STATUS_OPTIONS } from "@/lib/admin/contact-labels";
import { formatMonthDayYearAtTime } from "@/lib/admin/dates";
import ContactSubmissionClient, {
  type ContactReplyView,
  type ContactSubmissionView,
} from "./ContactSubmissionClient";
import "@/styles/css/admin/dashboard.css";
import "@/styles/css/admin/contact-submission-detail.css";

const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Edulari";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const id = Number.parseInt(sp.id ?? "0", 10) || 0;
  const submission = id ? await getContactSubmissionById(id) : null;
  return pageMetadata({
    title: submission ? `${submission.ticket_ref} – Admin | ${SITE_NAME}` : `Contact Submission – Admin | ${SITE_NAME}`,
    description: "Reply to a contact submission and manage its status.",
    path: "/admin/contact-submission-detail",
    noindex: true,
  });
}

/** PHP strtoupper(substr($name, 0, 1)) — first code point, uppercased. */
function firstLetter(name: string): string {
  const first = [...name][0] ?? "";
  return first.toUpperCase();
}

export default async function AdminContactSubmissionDetailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const id = Number.parseInt(sp.id ?? "0", 10) || 0;
  if (!id) redirect("/admin/contact-submissions");

  const submission = await getContactSubmissionById(id);
  if (!submission) redirect("/admin/contact-submissions");

  const [replies, csrfToken] = await Promise.all([getContactReplies(id), readCsrfToken()]);

  const view: ContactSubmissionView = {
    id: submission.id,
    ticketRef: submission.ticket_ref,
    status: submission.status,
    priority: submission.priority,
    category: submission.category,
    subject: submission.subject,
    senderName: submission.sender_name,
    senderEmail: submission.sender_email,
    senderRole: submission.sender_role,
    message: submission.message,
    orderRef: submission.order_ref,
    courseRef: submission.course_ref,
    senderIp: submission.sender_ip,
    userId: submission.user_id,
    submittedText: formatMonthDayYearAtTime(submission.created_at),
    updatedText: formatMonthDayYearAtTime(submission.updated_at),
    showUpdated: submission.updated_at.getTime() !== submission.created_at.getTime(),
    avatarLetter: firstLetter(submission.sender_name),
  };

  const replyViews: ContactReplyView[] = replies.map((r) => ({
    id: r.id,
    replyType: r.reply_type,
    adminName: r.admin_name,
    timeText: formatMonthDayYearAtTime(r.created_at),
    message: r.reply_message,
    resolutionStatus: r.resolution_status,
  }));

  return (
    <ContactSubmissionClient
      submission={view}
      replies={replyViews}
      statusOptions={CONTACT_STATUS_OPTIONS}
      siteName={SITE_NAME}
      csrfToken={csrfToken}
      flash={sp.msg ?? ""}
      flashType={sp.msg_type ?? ""}
    />
  );
}
