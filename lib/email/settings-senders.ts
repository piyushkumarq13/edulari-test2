import { sendMail } from "./transport";
import { sql } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";
import { emailShell, emailHeading, emailSubtitle, emailP, emailNotice } from "@/lib/email/templates";
import { APP_TIMEZONE } from "@/lib/format";

/**
 * Port of sendPasswordChangedNotificationEmail() from private/email/email_senders.php (line 277)
 * together with buildPasswordChangedNotificationHtml()/Text() (email_templates.php 669/697).
 *
 * The shared emailShell/Heading/Subtitle/P/Notice helpers live in lib/email/templates.ts; the
 * two-column data table helper is NOT exported there, so it is reproduced here verbatim.
 */

const SITE_NAME = "Edulari";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

const esc = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/** emailDataTable() from email_templates.php line 212 (label escaped, value raw). */
function emailDataTable(rows: Array<[string, string]>): string {
  let html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:20px 0;border:1px solid #e0ecf5;border-radius:10px;overflow:hidden;">`;
  rows.forEach(([label, value], i) => {
    const bg = i % 2 === 0 ? "#f7fafd" : "#ffffff";
    html += `
      <tr style="background:${bg};">
        <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a6080;
                   width:40%;border-bottom:1px solid #e0ecf5;">${esc(label)}</td>
        <td style="padding:12px 16px;font-size:13px;color:#1a2f4a;
                   border-bottom:1px solid #e0ecf5;">${value}</td>
      </tr>`;
  });
  html += `
    </table>`;
  return html;
}

/** PHP `date('d M Y, H:i') . ' UTC'` — the site timezone values with the literal " UTC" suffix. */
function changedAt(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} UTC`;
}

/** buildPasswordChangedNotificationHtml() ported verbatim. */
export function buildPasswordChangedNotificationHtml(name: string, ip: string, deviceInfo: string): string {
  const firstName = esc(name.trim().split(" ")[0] ?? "");
  const time = changedAt();

  let body = emailHeading("🔐", "Your password was changed");
  body += emailSubtitle(`Your ${SITE_NAME} account password has been updated`);

  body += emailP(`Hi <strong>${firstName}</strong>,`);
  body += emailP(
    "Your account password was successfully changed. All other devices that were signed in to your account have been signed out automatically as a security measure.",
  );

  body += emailDataTable([
    ["Time", time],
    ["IP Address", esc(ip)],
    ["Device", esc(deviceInfo.slice(0, 80))],
  ]);

  body += emailNotice(
    "⚠️",
    "<strong>Didn't make this change?</strong> If you did not change your password, your account may be compromised. " +
      `<a href="${SITE_URL}/forgot-password" style="color:#0f4c81;">Reset your password immediately</a> and contact support.`,
    "#fff8e8",
    "#f4a261",
  );

  return emailShell(body, `Your ${SITE_NAME} password was changed — all other sessions signed out.`);
}

/** buildPasswordChangedNotificationText() ported verbatim. */
export function buildPasswordChangedNotificationText(name: string, ip: string, deviceInfo: string): string {
  const time = changedAt();
  return `Hi ${name},

Your ${SITE_NAME} account password was successfully changed.

Time:      ${time}
IP Address: ${ip}
Device:    ${deviceInfo.slice(0, 80)}

All other active sessions have been signed out automatically.

If you did not make this change, reset your password immediately:
${SITE_URL}/forgot-password

— The ${SITE_NAME} Team`;
}

/**
 * sendPasswordChangedNotificationEmail() ported: HTML + plain text with the exact subject
 * ("Your Password Was Changed – Edulari", en-dash), then an in-app `password_changed`
 * notification. Fire-and-forget — errors are only logged, never surfaced to the caller.
 */
export async function sendPasswordChangedNotificationEmail(
  email: string,
  name: string,
  ip: string,
  deviceInfo: string,
): Promise<void> {
  try {
    const result = await sendMail({
      to: email,
      toName: name,
      subject: `Your Password Was Changed – ${SITE_NAME}`,
      html: buildPasswordChangedNotificationHtml(name, ip, deviceInfo),
      text: buildPasswordChangedNotificationText(name, ip, deviceInfo),
    });
    // PHP only reached createNotification() when the PHPMailer send() did not throw.
    if (!result.ok) {
      console.error(`[email] password-changed notification failed for ${email}: ${result.error}`);
      return;
    }

    const users = await sql<{ id: number }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (users.length > 0) {
      await createNotification(
        users[0].id,
        "password_changed",
        "Your Password Was Changed",
        `Hi ${name},\n\nYour account password was successfully changed.\n\nIP Address: ${ip}\nDevice: ${deviceInfo}\n\nIf you made this change, no action is needed. If you did not change your password, please contact support immediately.`,
      );
    }
  } catch (e) {
    console.error(`[email] password-changed notification failed for ${email}:`, e instanceof Error ? e.message : e);
  }
}
