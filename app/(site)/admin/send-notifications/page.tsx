import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { SITE_NAME } from "@/lib/site";
import SendNotificationsView from "@/components/admin/SendNotificationsView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: `Send Notifications – ${SITE_NAME}`,
  description: "Compose and broadcast a notification to users on the platform.",
  noindex: true,
  canonical: false,
});

// The page-authoritative inline <style> block from send-notifications.php (the external
// send-notifications.css was never linked by the PHP page, so these values are what actually
// rendered). Kept verbatim.
const INLINE_STYLE = [
  "/* ── Minimal inline styles until CSS file is created ── */",
  "body { margin: 0; background: #f5f7fa; color: #1a1a2e; }",
  ".sn-wrap { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }",
  ".sn-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 6px; }",
  ".sn-subtitle { color: #718096; font-size: .9rem; margin: 0 0 28px; }",
  ".sn-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px 28px 32px; }",
  ".sn-alert { border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: .9rem; }",
  ".sn-alert--success { background: #f0fff4; border: 1px solid #9ae6b4; color: #276749; }",
  ".sn-alert--error   { background: #fff5f5; border: 1px solid #fc8181; color: #c53030; }",
  ".sn-field { margin-bottom: 20px; }",
  ".sn-label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: 6px; color: #4a5568; }",
  ".sn-input, .sn-select, .sn-textarea {",
  "    width: 100%; box-sizing: border-box; padding: 9px 12px;",
  "    border: 1px solid #cbd5e0; border-radius: 7px; font-size: .9rem;",
  "    background: #fff; color: #1a1a2e; transition: border-color .15s;",
  "}",
  ".sn-input:focus, .sn-select:focus, .sn-textarea:focus {",
  "    outline: none; border-color: #3182ce; box-shadow: 0 0 0 3px rgba(49,130,206,.15);",
  "}",
  ".sn-textarea { min-height: 120px; resize: vertical; font-family: inherit; }",
  ".sn-hint { font-size: .78rem; color: #a0aec0; margin-top: 4px; }",
  ".sn-email-field { display: none; }",
  ".sn-email-field.visible { display: block; }",
  ".sn-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }",
  ".sn-type-opt { position: relative; }",
  '.sn-type-opt input[type="radio"] { position: absolute; opacity: 0; width: 0; height: 0; }',
  ".sn-type-label {",
  "    display: block; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;",
  "    font-size: .85rem; cursor: pointer; transition: border-color .15s, background .15s; text-align: center;",
  "}",
  '.sn-type-opt input[type="radio"]:checked + .sn-type-label {',
  "    border-color: #3182ce; background: #ebf8ff; color: #2b6cb0; font-weight: 600;",
  "}",
  ".sn-type-label:hover { border-color: #90cdf4; background: #f7fafc; }",
  ".sn-divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }",
  ".sn-preview { background: #f7fafc; border: 1px dashed #cbd5e0; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; display: none; }",
  ".sn-preview.visible { display: block; }",
  ".sn-preview-label { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #a0aec0; margin-bottom: 8px; }",
  ".sn-preview-title { font-size: 1rem; font-weight: 700; margin-bottom: 4px; }",
  ".sn-preview-body { font-size: .88rem; color: #4a5568; white-space: pre-wrap; word-break: break-word; }",
  ".sn-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 24px; }",
  ".sn-btn-submit {",
  "    background: #3182ce; color: #fff; border: none; border-radius: 8px;",
  "    padding: 10px 28px; font-size: .95rem; font-weight: 600; cursor: pointer; transition: background .15s;",
  "}",
  ".sn-btn-submit:hover { background: #2b6cb0; }",
  ".sn-btn-preview {",
  "    background: none; border: 1px solid #cbd5e0; border-radius: 8px;",
  "    padding: 10px 20px; font-size: .9rem; cursor: pointer; color: #4a5568; transition: background .15s;",
  "}",
  ".sn-btn-preview:hover { background: #edf2f7; }",
  ".sn-char-count { font-size: .78rem; color: #a0aec0; text-align: right; margin-top: 3px; }",
  "@media (max-width: 540px) { .sn-card { padding: 18px 14px; } .sn-type-grid { grid-template-columns: 1fr 1fr; } }",
].join("\n");

export default async function AdminSendNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requireAdmin();
  const [sp, csrfToken] = await Promise.all([searchParams, readCsrfToken()]);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INLINE_STYLE }} />
      <SendNotificationsView csrfToken={csrfToken} successMsg={sp.msg ?? ""} errorMsg={sp.error ?? ""} />
    </>
  );
}
