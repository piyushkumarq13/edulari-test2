import { APP_TIMEZONE } from "@/lib/format";
import { sendMail } from "./transport";
import { emailShell, emailHeading, emailSubtitle, emailP, emailButton, emailNotice } from "./templates";
import { emailDataTable, emailFallbackLink, esc, nl2br } from "./shell-extra";

/**
 * Port of the contact "admin reply" email builders in
 * private/email/email_templates.php (lines 1353-1448) and the sender in
 * private/email/email_senders.php sendContactReplyEmail() (line 395).
 * Sent only for public replies from the admin contact-submission detail page.
 */

const SITE_NAME = "Edulari";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function firstName(name: string): string {
  return name.trim().split(" ")[0] ?? "";
}

/** _contactStatusLabel() from email_templates.php line 1180. */
function contactStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Open 🔵",
    in_progress: "In Progress 🟡",
    waiting: "Waiting on You 🟠",
    resolved: "Resolved ✅",
    closed: "Closed ⚫",
  };
  return map[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** PHP date('d M Y, H:i') . ' UTC' in the site timezone. */
function repliedStamp(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")} ${g("month")} ${g("year")}, ${g("hour")}:${g("minute")} UTC`;
}

/** buildContactReplyHtml() from email_templates.php line 1354. */
export function buildContactReplyHtml(
  name: string,
  subject: string,
  ticketRef: string,
  replyMsg: string,
  newStatus: string,
): string {
  const trackUrl = `${SITE_URL}/track-contact?ref=${encodeURIComponent(ticketRef)}`;
  const first = firstName(name);
  const statusLabel = contactStatusLabel(newStatus);
  const isResolved = newStatus === "resolved" || newStatus === "closed";

  let body = emailHeading("💬", `Reply from ${SITE_NAME} Support`);
  body += emailSubtitle(`We've responded to your inquiry [${esc(ticketRef)}].`);

  body += emailP(`Hi <strong>${esc(first)}</strong>,`);
  body += emailP("Our support team has replied to your inquiry. Please see the message below.");

  body += emailDataTable([
    ["Ticket Reference", `<strong style="font-family:monospace;">${esc(ticketRef)}</strong>`],
    ["Subject", esc(subject)],
    ["New Status", esc(statusLabel)],
    ["Replied", repliedStamp()],
  ]);

  body += `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td style="background:#f0f6fb;border-left:4px solid #0f4c81;
                   border-radius:0 8px 8px 0;padding:18px 20px;">
          <p style="font-size:13px;font-weight:700;color:#0f1f3a;margin:0 0 10px;">
            💬 Message from ${esc(SITE_NAME)} Support:
          </p>
          <p style="font-size:15px;color:#1e293b;margin:0;line-height:1.75;white-space:pre-wrap;">${nl2br(esc(replyMsg))}</p>
        </td>
      </tr>
    </table>`;

  if (isResolved) {
    body += emailNotice(
      "✅",
      `Your ticket has been marked as <strong>${esc(statusLabel)}</strong>. If your issue isn't fully resolved, please <a href="${SITE_URL}/contact" style="color:#0f4c81;">submit a new ticket</a>.`,
      "#f0fdf4",
      "#16a34a",
    );
  } else {
    body += emailNotice(
      "↩️",
      "If you have follow-up questions, you can track your ticket and view the full thread anytime.",
      "#e8f4fd",
      "#0f4c81",
    );
  }

  body += emailButton(trackUrl, "View Full Ticket Thread →");
  body += emailFallbackLink(trackUrl);

  const previewText = `Reply from ${SITE_NAME} Support on "${subject}"`;
  return emailShell(body, previewText);
}

/** buildContactReplyText() from email_templates.php line 1423. */
export function buildContactReplyText(
  name: string,
  subject: string,
  ticketRef: string,
  replyMsg: string,
  newStatus: string,
): string {
  const trackUrl = `${SITE_URL}/track-contact?ref=${encodeURIComponent(ticketRef)}`;
  const first = firstName(name);
  const statusLabel = contactStatusLabel(newStatus);

  return `Hi ${first},

${SITE_NAME} Support has replied to your inquiry.

Ticket Reference : ${ticketRef}
Subject          : ${subject}
New Status       : ${statusLabel}
Replied          : ${repliedStamp()}

--- Support Reply ---
${replyMsg}
---------------------

View the full ticket thread:
${trackUrl}

If your issue isn't resolved, please submit a new ticket:
${SITE_URL}/contact

— The ${SITE_NAME} Support Team`;
}

/**
 * sendContactReplyEmail() from email_senders.php line 395. Fire-and-forget:
 * PHP wrapped this in try/catch and logged "Contact reply email failed for {email}: ...",
 * so a failed send never blocks the reply from being saved.
 */
export async function sendContactReplyEmail(
  email: string,
  name: string,
  subject: string,
  ticketRef: string,
  replyMsg: string,
  newStatus: string,
): Promise<void> {
  try {
    const result = await sendMail({
      to: email,
      toName: name,
      subject: `Re: ${subject} [${ticketRef}] – ${SITE_NAME}`,
      html: buildContactReplyHtml(name, subject, ticketRef, replyMsg, newStatus),
      text: buildContactReplyText(name, subject, ticketRef, replyMsg, newStatus),
    });
    if (!result.ok) {
      console.error(`Contact reply email failed for ${email}: ${result.error}`);
    }
  } catch (e) {
    console.error(`Contact reply email failed for ${email}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
