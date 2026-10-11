const SITE_NAME = "Edulari";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "support@edulari.example.com";

const esc = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/**
 * emailShell() from private/email/email_templates.php (lines 29-145). Ported verbatim:
 * same inline CSS, same dark-blue gradient header with the "edu<span>lari</span>" wordmark,
 * same optional hidden preview text, divider and footer.
 */
export function emailShell(bodyContent: string, previewText = ""): string {
  const year = String(new Date().getFullYear());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${esc(SITE_NAME)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    /* Base */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f0f4f8;
      color: #1a2f4a;
      margin: 0;
      padding: 0;
    }
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper  { padding: 16px !important; }
      .email-card     { border-radius: 12px !important; }
      .email-header   { padding: 28px 24px !important; }
      .email-body     { padding: 32px 24px !important; }
      .email-footer   { padding: 20px 24px !important; }
      .btn-main       { display: block !important; width: 100% !important; text-align: center !important; }
      .stat-row td    { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="background-color:#f0f4f8;margin:0;padding:0;">

  ${previewText ? `<!-- Preview text -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f0f4f8;font-size:1px;line-height:1px;">${esc(previewText)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper"
         style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card"
               style="max-width:600px;background:#ffffff;border-radius:16px;
                      box-shadow:0 4px 24px rgba(15,76,129,.10);overflow:hidden;">

          <!-- ── Header ── -->
          <tr>
            <td class="email-header"
                style="background:linear-gradient(135deg,#0f4c81 0%,#0d3d6b 50%,#051d3a 100%);
                       padding:36px 40px;text-align:center;">
              <!-- Logo wordmark -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}" style="text-decoration:none;">
                      <span style="display:inline-block;font-size:28px;font-weight:800;
                                   letter-spacing:-0.5px;color:#ffffff;">
                        edu<span style="color:#00b4d8;">lari</span>
                      </span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td class="email-body" style="padding:40px 40px 32px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e0ecf5;"></div>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td class="email-footer" style="padding:24px 40px 32px;text-align:center;">
              <p style="font-size:13px;color:#6b80a0;line-height:1.6;margin:0 0 8px;">
                © ${year} ${esc(SITE_NAME)} · All rights reserved
              </p>
              <p style="font-size:12px;color:#9ab0c8;margin:0;">
                <a href="${SITE_URL}" style="color:#0f4c81;text-decoration:none;">${SITE_URL}</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** emailButton() from email_templates.php line 154. */
export function emailButton(url: string, label: string, color = "#0f4c81"): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
      <tr>
        <td align="center"
            style="background-color:${color};border-radius:8px;
                   box-shadow:0 4px 14px rgba(15,76,129,.30);">
          <a href="${url}" class="btn-main"
             style="display:inline-block;padding:15px 36px;font-size:16px;font-weight:700;
                    color:#ffffff;text-decoration:none;letter-spacing:0.2px;
                    border-radius:8px;line-height:1;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** emailNotice() from email_templates.php line 192. */
export function emailNotice(icon: string, text: string, bg = "#e8f0fe", border = "#0f4c81"): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:24px 0 0;">
      <tr>
        <td style="background:${bg};border-left:4px solid ${border};
                   border-radius:0 8px 8px 0;padding:14px 18px;">
          <p style="font-size:13px;color:#1a2f4a;margin:0;line-height:1.6;">
            ${icon}&nbsp; ${text}
          </p>
        </td>
      </tr>
    </table>`;
}

/** emailHeading() from email_templates.php line 234. */
export function emailHeading(icon: string, text: string): string {
  return `
    <h1 style="font-size:22px;font-weight:800;color:#0f1f3a;margin:0 0 6px;line-height:1.3;">
      ${icon} ${esc(text)}
    </h1>`;
}

/** emailSubtitle() from email_templates.php line 244. */
export function emailSubtitle(text: string): string {
  return `
    <p style="font-size:14px;color:#6b80a0;margin:0 0 24px;line-height:1.5;">${text}</p>`;
}

/** emailP() from email_templates.php line 252. */
export function emailP(text: string, extraStyle = ""): string {
  return `
    <p style="font-size:15px;color:#2a4060;line-height:1.7;margin:0 0 14px;${extraStyle}">${text}</p>`;
}

/** emailFeatureList() from email_templates.php line 262. */
export function emailFeatureList(items: Array<[string, string]>): string {
  const rows = items
    .map(
      ([icon, text]) => `
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:32px;font-size:18px;">${icon}</td>
        <td style="padding:8px 0 8px 8px;font-size:14px;color:#2a4060;line-height:1.6;">${text}</td>
      </tr>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:20px 0;">${rows}
    </table>`;
}

const firstName = (name: string): string => esc(name.trim().split(" ")[0] ?? "");

/**
 * buildInstructorApprovalEmailHtml() from email_templates.php line 475. The approval badge
 * ("✅ APPLICATION APPROVED"), heading, feature list and teal CTA ported verbatim.
 */
export function buildInstructorApprovalEmailHtml(name: string): string {
  const first = firstName(name);
  const loginUrl = `${SITE_URL}/login`;

  let body = `
    <!-- Approval badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background:linear-gradient(135deg,#e8faf8,#caf0f8);
                      border:1px solid #2ec4b6;border-radius:50px;
                      padding:10px 22px;font-size:13px;font-weight:700;
                      color:#2ec4b6;letter-spacing:.5px;">
            ✅ &nbsp;APPLICATION APPROVED
          </div>
        </td>
      </tr>
    </table>`;

  body += emailHeading("🎉", `Congratulations, ${first}!`);
  body += emailSubtitle(`You're now an approved instructor on ${SITE_NAME}`);

  body += emailP(
    `We're excited to have you join the ${SITE_NAME} instructor community! Your application has been reviewed and <strong>approved</strong>. Your account is now fully active.`,
  );

  body += `
    <p style="font-size:15px;font-weight:700;color:#0f1f3a;margin:24px 0 10px;">
      Get started as an instructor:
    </p>`;

  body += emailFeatureList([
    ["🎬", "<strong>Create your first course</strong> — use our step-by-step course builder."],
    ["👥", "<strong>Build your student base</strong> — your courses will be visible to thousands of learners."],
    ["💰", "<strong>Earn revenue</strong> — get paid for every enrolment on your courses."],
    ["📊", "<strong>Track performance</strong> — monitor views, enrolments, and earnings from your dashboard."],
  ]);

  body += emailButton(loginUrl, "Log In & Start Teaching →", "#2ec4b6");

  body += emailNotice(
    "💬",
    "Have questions about getting started? Reply to this email — we're here to help every step of the way.",
    "#f0f6fb",
    "#00b4d8",
  );

  return emailShell(body, `Great news — your instructor application on ${SITE_NAME} has been approved!`);
}

/** buildInstructorApprovalEmailText() from email_templates.php line 525. */
export function buildInstructorApprovalEmailText(name: string): string {
  return `Congratulations, ${name}!

Your instructor application on ${SITE_NAME} has been approved.

Your account is now fully active. Log in and start creating your first course:
${SITE_URL}/login

We're excited to have you on board!

— The ${SITE_NAME} Team`;
}

/**
 * buildInstructorRejectionEmailHtml() from email_templates.php line 541. The "APPLICATION
 * UPDATE" badge, optional feedback box (amber left border), improvement tips and admin
 * contact notice — ported verbatim.
 */
export function buildInstructorRejectionEmailHtml(name: string, reason = ""): string {
  const first = firstName(name);

  let body = `
    <!-- Rejection badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <div style="display:inline-block;background:#fdecea;
                      border:1px solid #e63946;border-radius:50px;
                      padding:10px 22px;font-size:13px;font-weight:700;
                      color:#e63946;letter-spacing:.5px;">
            ℹ️ &nbsp;APPLICATION UPDATE
          </div>
        </td>
      </tr>
    </table>`;

  body += emailHeading("📬", "Update on your application");
  body += emailSubtitle(`Thank you for applying to teach on ${SITE_NAME}`);

  body += emailP(`Hi <strong>${first}</strong>,`);
  body += emailP(
    `Thank you for taking the time to apply as an instructor on ${SITE_NAME}. After careful review of your application, we're unable to approve it at this time.`,
  );

  if (reason) {
    body += `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="margin:20px 0;">
          <tr>
            <td style="background:#fff8e8;border-left:4px solid #f4a261;
                       border-radius:0 8px 8px 0;padding:16px 18px;">
              <p style="font-size:13px;font-weight:700;color:#1a2f4a;margin:0 0 4px;">
                📝 Feedback from our review team:
              </p>
              <p style="font-size:14px;color:#2a4060;margin:0;line-height:1.6;">
                ${esc(reason)}
              </p>
            </td>
          </tr>
        </table>`;
  }

  body += emailP("We encourage you to reapply in the future. Here are some ways to strengthen your next application:");

  body += emailFeatureList([
    ["📖", "Complete relevant certifications in your subject area."],
    ["🎥", "Prepare sample content that demonstrates your teaching style."],
    ["🏅", "Build a portfolio of professional work or notable projects."],
  ]);

  body += emailNotice(
    "📧",
    `Questions about this decision? Contact us at <a href="mailto:${esc(ADMIN_EMAIL)}" style="color:#0f4c81;">${esc(ADMIN_EMAIL)}</a> — we're happy to provide more specific guidance.`,
    "#f0f6fb",
    "#0f4c81",
  );

  return emailShell(body, `An update on your instructor application at ${SITE_NAME}.`);
}

/** buildInstructorRejectionEmailText() from email_templates.php line 604. */
export function buildInstructorRejectionEmailText(name: string, reason = ""): string {
  const reasonText = reason ? `\nFeedback: ${reason}\n` : "";
  return `Hi ${name},

Thank you for applying to teach on ${SITE_NAME}.

After careful review, we are unable to approve your application at this time.
${reasonText}
You are welcome to reapply in the future.

If you have questions, please contact: ${ADMIN_EMAIL}

— The ${SITE_NAME} Team`;
}