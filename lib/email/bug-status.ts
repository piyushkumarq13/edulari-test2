import { APP_TIMEZONE, trimWidth } from "@/lib/format";
import { emailShell, emailHeading, emailSubtitle, emailP, emailFeatureList, emailButton, emailNotice } from "./templates";
import { emailDataTable, emailFallbackLink, esc, nl2br } from "./shell-extra";

/**
 * Port of the bug-report status notification builders in
 * private/email/email_templates.php (lines 952-1156):
 *   buildBugStatusEmailSubject / buildBugStatusEmailHtml / buildBugStatusEmailText.
 * Sent from the admin bug-report detail page after every status change.
 */

const SITE_NAME = "Edulari";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

function firstName(name: string): string {
  return esc(name.trim().split(" ")[0] ?? "");
}

/** PHP date('d M Y, H:i') . ' UTC' in the site timezone. */
function updatedStamp(): string {
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

/** buildBugStatusEmailSubject() from email_templates.php line 952. */
export function buildBugStatusEmailSubject(newStatus: string, subject: string, reference: string): string {
  const statusPhrases: Record<string, string> = {
    resolved: "resolved",
    in_progress: "now being investigated",
    open: "reopened",
    wont_fix: "closed (won't fix)",
    duplicate: "closed (duplicate)",
  };
  const phrase = statusPhrases[newStatus] ?? newStatus;
  return `[${reference}] Your report has been ${phrase} — ${trimWidth(subject, 60)}`;
}

/** buildBugStatusEmailHtml() from email_templates.php line 964. */
export function buildBugStatusEmailHtml(
  reporterName: string,
  subject: string,
  reference: string,
  newStatus: string,
  adminNotes = "",
): string {
  const trackUrl = `${SITE_URL}/track-report?ref=${encodeURIComponent(reference)}`;
  const first = firstName(reporterName);
  const eSubject = esc(subject);
  const eRef = esc(reference);

  const statusConfig: Record<
    string,
    { icon: string; label: string; color: string; bg: string; border: string; badge: string; heading: string; sub: string; intro: string; extra: string }
  > = {
    resolved: {
      icon: "✅",
      label: "Resolved",
      color: "#15803d",
      bg: "#dcfce7",
      border: "#86efac",
      badge: "APPLICATION RESOLVED",
      heading: "Your report has been resolved!",
      sub: "Great news — the issue you reported has been fixed",
      intro: `We're pleased to let you know that the issue you reported has been <strong>resolved</strong>. Thank you for helping us improve ${SITE_NAME}!`,
      extra: emailFeatureList([
        ["🔍", "You can verify the fix is live on the platform."],
        ["🐛", `If the issue persists, please <a href="${SITE_URL}/report-bug" style="color:#0f4c81;">submit a new report</a>.`],
      ]),
    },
    in_progress: {
      icon: "🔵",
      label: "In Progress",
      color: "#5b21b6",
      bg: "#ede9fe",
      border: "#c4b5fd",
      badge: "UNDER INVESTIGATION",
      heading: "We're working on your report",
      sub: "Our team has picked up your issue and is actively investigating",
      intro: "Good news — your report has been assigned to our team and is now <strong>actively being investigated</strong>. We'll update you as soon as we have a resolution.",
      extra: emailNotice(
        "⏳",
        "Complex issues can take a little longer. We'll keep you posted via email.",
        "#ede9fe",
        "#5b21b6",
      ),
    },
    open: {
      icon: "🟡",
      label: "Reopened",
      color: "#854d0e",
      bg: "#fef9c3",
      border: "#fde68a",
      badge: "REPORT REOPENED",
      heading: "Your report has been reopened",
      sub: "We have reopened this issue for further investigation",
      intro: "Your report has been <strong>reopened</strong> for further review. Our team will continue investigating and keep you updated.",
      extra: "",
    },
    wont_fix: {
      icon: "⛔",
      label: "Won't Fix",
      color: "#991b1b",
      bg: "#fee2e2",
      border: "#fca5a5",
      badge: "CLOSED — WON'T FIX",
      heading: "An update on your report",
      sub: "Your report has been reviewed and closed",
      intro: "After careful review, our team has decided <strong>not to fix</strong> this issue at this time. This may be due to it being by design, out of scope, or not feasible to address currently.",
      extra: emailNotice(
        "💡",
        `Disagree with this decision? Reply to this email or <a href="${SITE_URL}/help-center" style="color:#0f4c81;">contact our support team</a>.`,
        "#fff8e8",
        "#f4a261",
      ),
    },
    duplicate: {
      icon: "🔁",
      label: "Duplicate",
      color: "#374151",
      bg: "#f3f4f6",
      border: "#d1d5db",
      badge: "CLOSED — DUPLICATE",
      heading: "Your report has been marked as a duplicate",
      sub: "This issue has already been reported and is being tracked",
      intro: "Our team has identified that your report is a <strong>duplicate</strong> of an existing issue we're already tracking. Rest assured, the underlying problem is on our radar.",
      extra: emailNotice(
        "🔗",
        "The original issue is already being investigated. You'll benefit from the fix once it's released.",
        "#f3f4f6",
        "#6b7280",
      ),
    },
  };

  const cfg = statusConfig[newStatus] ?? statusConfig.open;

  let body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background:${cfg.bg};
                      border:1px solid ${cfg.border};border-radius:50px;
                      padding:10px 22px;font-size:13px;font-weight:700;
                      color:${cfg.color};letter-spacing:.5px;">
            ${cfg.icon} &nbsp;${esc(cfg.badge)}
          </div>
        </td>
      </tr>
    </table>`;

  body += emailHeading(cfg.icon, cfg.heading);
  body += emailSubtitle(cfg.sub);

  body += emailP(`Hi <strong>${first}</strong>,`);
  body += emailP(cfg.intro);

  body += emailDataTable([
    ["Reference", eRef],
    ["Issue", eSubject],
    ["New Status", `${cfg.icon} <strong>${esc(cfg.label)}</strong>`],
    ["Updated", updatedStamp()],
  ]);

  if (adminNotes.trim() !== "") {
    body += `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:20px 0 0;">
      <tr>
        <td style="background:#f0f6fb;border-left:4px solid #0f4c81;
                   border-radius:0 8px 8px 0;padding:16px 18px;">
          <p style="font-size:13px;font-weight:700;color:#0f1f3a;margin:0 0 6px;">
            💬 Note from the ${esc(SITE_NAME)} Team:
          </p>
          <p style="font-size:14px;color:#2a4060;margin:0;line-height:1.7;">${nl2br(esc(adminNotes))}</p>
        </td>
      </tr>
    </table>`;
  }

  if (cfg.extra !== "") {
    body += cfg.extra;
  }

  body += emailButton(trackUrl, "Track Your Report →", "#6c63ff");
  body += emailFallbackLink(trackUrl);

  const previewText = `${cfg.icon} Your report ${reference} is ${cfg.label.toLowerCase()} — ${trimWidth(subject, 60)}`;
  return emailShell(body, previewText);
}

/** buildBugStatusEmailText() from email_templates.php line 1123. */
export function buildBugStatusEmailText(
  reporterName: string,
  subject: string,
  reference: string,
  newStatus: string,
  adminNotes = "",
): string {
  const trackUrl = `${SITE_URL}/track-report?ref=${encodeURIComponent(reference)}`;

  const statusLabels: Record<string, string> = {
    resolved: "RESOLVED ✅",
    in_progress: "IN PROGRESS 🔵",
    open: "REOPENED 🟡",
    wont_fix: "WON'T FIX ⛔",
    duplicate: "DUPLICATE 🔁",
  };
  const label = statusLabels[newStatus] ?? newStatus.toUpperCase();

  const noteText = adminNotes.trim() !== "" ? `\nNote from the ${SITE_NAME} Team:\n${adminNotes}\n` : "";

  return `Hi ${reporterName},

There's an update on your bug report.

Reference:  ${reference}
Issue:      ${subject}
New Status: ${label}
Updated:    ${updatedStamp()}
${noteText}
Track your report online:
${trackUrl}

Thank you for helping improve ${SITE_NAME}.

— The ${SITE_NAME} Team`;
}
