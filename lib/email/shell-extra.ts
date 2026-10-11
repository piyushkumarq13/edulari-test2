/**
 * Shared email-body helpers from private/email/email_templates.php that
 * lib/email/templates.ts does not already export: esc(), emailFallbackLink()
 * (line 175) and emailDataTable() (line 212). Kept in a separate module so the
 * already-ported templates.ts stays untouched.
 */

/** PHP htmlspecialchars($v, ENT_QUOTES, 'UTF-8'). */
export const esc = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/** PHP nl2br() default: insert <br /> before each newline. */
export function nl2br(v: string): string {
  return v.replace(/\r\n|\r|\n/g, "<br />\n");
}

/** emailFallbackLink() from email_templates.php line 175. */
export function emailFallbackLink(url: string): string {
  return `
    <p style="font-size:13px;color:#6b80a0;margin:20px 0 0;text-align:center;line-height:1.6;">
      Or paste this link into your browser:<br>
      <a href="${url}"
         style="color:#0f4c81;word-break:break-all;font-size:12px;">${url}</a>
    </p>`;
}

/**
 * emailDataTable() from email_templates.php line 212. Labels are escaped;
 * values are raw HTML (callers pre-escape what needs escaping), matching PHP.
 */
export function emailDataTable(rows: Array<[string, string]>): string {
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
