import { sendMail } from "./transport";
import { sql } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";
import {
  buildInstructorApprovalEmailHtml,
  buildInstructorApprovalEmailText,
  buildInstructorRejectionEmailHtml,
  buildInstructorRejectionEmailText,
} from "@/lib/email/templates";

const SITE_NAME = "Edulari";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${SITE_NAME}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f0f4f8;color:#1a2f4a;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1a2f4a;color:#fff;padding:20px;text-align:center;font-size:20px;font-weight:700;">${SITE_NAME}</td></tr>
<tr><td style="padding:24px;"><h2 style="margin:0 0 12px;">${title}</h2>${bodyHtml}</td></tr>
<tr><td style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} ${SITE_NAME}. <a href="${SITE_URL}" style="color:#6b7280;">${SITE_URL}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const v = (label: string, value: string | undefined) => `<p><strong>${label}:</strong> ${value ?? ""}</p>`;

export async function sendVerificationEmail(email: string, name: string, verifyUrl: string) {
  const html = shell("Verify your email", `<p>Hi ${name},</p><p>Please verify your email address to activate your ${SITE_NAME} account.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Verify Email</a></p><p>Or paste this link: ${verifyUrl}</p>`);
  return sendMail({ to: email, toName: name, subject: `Verify Your Email — ${SITE_NAME}`, html });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const html = shell(`Welcome to ${SITE_NAME}!`, `<p>Hi ${name},</p><p>Your account is verified. Start learning today.</p><p><a href="${SITE_URL}">Explore courses</a></p>`);
  return sendMail({ to: email, toName: name, subject: `Welcome to ${SITE_NAME}!`, html });
}

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string, adminInitiated = false) {
  const intro = adminInitiated
    ? `An administrator has initiated a password reset for your ${SITE_NAME} account.`
    : `We received a request to reset your ${SITE_NAME} password.`;
  const html = shell(
    "Reset your password",
    `<p>Hi ${name},</p><p>${intro}</p><p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Reset Password</a></p><p>If you did not request this, you can ignore this email. Your password will not change.</p>`,
  );
  const result = await sendMail({ to: email, toName: name, subject: `Reset your password — ${SITE_NAME}`, html });

  const users = await sql<{ id: number }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (users.length > 0) {
    const notifyText = adminInitiated
      ? `Hi ${name},\n\nAn administrator has initiated a password reset for your account. Check your email for the reset link.\n\nIf you did not request a password reset, you can safely ignore this notification.`
      : `Hi ${name},\n\nA password reset was requested for your account. If you made this request, check your email for the reset link.\n\nIf you did not request a password reset, you can safely ignore this notification.`;
    await createNotification(users[0].id, "password_reset", "Password Reset Requested", notifyText);
  }

  return result;
}

export async function sendInstructorApplicationNotification(adminEmail: string, applicantEmail: string, applicantName: string, testScore = 0) {
  const html = shell(
    "New instructor application",
    `<p>A new instructor application was submitted.</p>${v("Name", applicantName)}${v("Email", applicantEmail)}${v("Competency test score", `${testScore}%`)}`,
  );
  return sendMail({ to: adminEmail, subject: `New instructor application — ${SITE_NAME}`, html });
}

/**
 * sendInstructorApprovalEmail() from private/email/email_senders.php lines 161-184, ported
 * exactly: subject "🎉 Your Instructor Application has been Approved – Edulari", the
 * approval HTML/plain builders, then an in-app `instructor_approved` notification created
 * for the user whose email matches. Fire-and-forget in PHP, so send errors must not throw.
 */
export async function sendInstructorApprovalEmail(email: string, name: string) {
  let sent = false;
  try {
    const result = await sendMail({
      to: email,
      toName: name,
      subject: `🎉 Your Instructor Application has been Approved – ${SITE_NAME}`,
      html: buildInstructorApprovalEmailHtml(name),
      text: buildInstructorApprovalEmailText(name),
    });
    sent = Boolean(result);
  } catch {
    // PHP caught the PHPMailer exception and only wrote error_log; never surface to admin.
  }

  const users = await sql<{ id: number }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (users.length > 0) {
    await createNotification(
      users[0].id,
      "instructor_approved",
      "Your Instructor Application has been Approved! 🎉",
      `Hi ${name},\n\nCongratulations! Your instructor application has been reviewed and approved. You can now create and publish courses on ${SITE_NAME}.\n\nHead to your instructor dashboard to get started.`,
    );
  }
  return sent;
}

/**
 * sendInstructorRejectionEmail() from private/email/email_senders.php lines 195-223, ported
 * exactly: subject "Update on Your Instructor Application – Edulari", the "APPLICATION
 * UPDATE" HTML template (reason in the HTML body), plain text WITHOUT the reason (as the
 * PHP AltBody did), and an in-app `instructor_rejected` notification with the reason.
 */
export async function sendInstructorRejectionEmail(email: string, name: string, reason = "") {
  let sent = false;
  try {
    const result = await sendMail({
      to: email,
      toName: name,
      subject: `Update on Your Instructor Application – ${SITE_NAME}`,
      html: buildInstructorRejectionEmailHtml(name, reason),
      text: buildInstructorRejectionEmailText(name, reason),
    });
    sent = Boolean(result);
  } catch {
    // PHP caught the PHPMailer exception and only wrote error_log; never surface to admin.
  }

  const users = await sql<{ id: number }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (users.length > 0) {
    let bodyText = `Hi ${name},\n\nThank you for applying to become an instructor on ${SITE_NAME}. After reviewing your application, we are unable to approve it at this time.`;
    if (reason) {
      bodyText += `\n\nReason: ${reason}`;
    }
    bodyText += "\n\nYou are welcome to reapply in the future.";
    await createNotification(users[0].id, "instructor_rejected", "Update on Your Instructor Application", bodyText);
  }
  return sent;
}

export async function sendNewLoginNotificationEmail(email: string, name: string, ip: string, deviceInfo: string) {
  return sendMail({ to: email, toName: name, subject: `New login to your account — ${SITE_NAME}`, html: shell("New login detected", `<p>Hi ${name},</p><p>We noticed a new sign-in to your account.</p>${v("IP", ip)}${v("Device", deviceInfo)}<p>If this wasn't you, change your password immediately.</p>`) });
}
