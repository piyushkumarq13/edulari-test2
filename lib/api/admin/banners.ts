import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";
import {
  BANNER_TEMPLATES,
  createBanner,
  deleteBanner,
  toggleBannerActive,
  updateBanner,
  type BannerCta,
  type BannerInput,
  type BannerSchedule,
} from "@/lib/db/admin/banners";

/**
 * The five POST actions of public/admin/banners.php (create_banner, update_banner, delete_banner,
 * toggle_banner_active, preview_banner). The PHP answered every action with JSON (HTTP 200) and the
 * client reloaded the page on success; that contract is kept so the client component can reproduce
 * the toast messages and 400ms/600ms reload timing.
 */

const trim = z.string().optional().default("").transform((s) => s.trim());

const bannerSchema = z.object({
  id: trim,
  title: trim,
  message: trim,
  template: trim,
  type: trim,
  cta_text: trim,
  cta_link: trim,
  schedule_start: trim,
  schedule_end: trim,
  resurface_after_days: z.string().optional().default(""),
  priority: z.string().optional().default(""),
});

// PHP (int): non-numeric input collapses to 0.
function phpInt(value: string | undefined): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** PHP !empty($v) for the checkbox semantics ("0" and "" are empty). */
function phpNotEmpty(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0";
}

/** PHP strtotime()+date('Y-m-d H:i:s'): keep the wall-clock value the datetime-local posted. */
function toMysqlDateTime(value: string): string | null {
  const t = value.trim();
  if (t === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(t);
  if (m) return `${m[1]} ${m[2]}:${m[3] ?? "00"}`;
  return t;
}

/** The CTA pairing rule: both fields or neither. Returns the error message when half-filled. */
export function buildCta(text: string, link: string): { cta: BannerCta; error: string | null } {
  if (text !== "" && link !== "") return { cta: { text, link }, error: null };
  if (text !== "" || link !== "") return { cta: null, error: "Both CTA text and link must be provided together." };
  return { cta: null, error: null };
}

function buildSchedule(start: string, end: string): BannerSchedule {
  if (start === "" && end === "") return null;
  return { start_at: toMysqlDateTime(start), end_at: toMysqlDateTime(end) };
}

function json(payload: Record<string, unknown>): NextResponse {
  return NextResponse.json(payload);
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// The page's $previewStyle block (banners.php:198), verbatim.
const PREVIEW_STYLE =
  '.sbn-shell{display:flex;align-items:center;gap:12px;width:100%;padding:10px 20px;font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;line-height:1.4}\n' +
  ".sbn-content{flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}\n" +
  ".sbn-type-info{background:#eff6ff;color:#1e3a5f;border-bottom:1px solid #bfdbfe}\n" +
  ".sbn-type-warning{background:#fffbeb;color:#5c3d0a;border-bottom:1px solid #fde68a}\n" +
  ".sbn-type-success{background:#ecfdf5;color:#064e3b;border-bottom:1px solid #a7f3d0}\n" +
  ".sbn-type-promo{background:linear-gradient(90deg,#fff0f0,#fff5e6);color:#7c2d12;border-bottom:1px solid #fed7aa}\n" +
  ".sbn-cta{display:inline-flex;align-items:center;padding:5px 14px;border-radius:6px;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0}\n" +
  ".sbn-type-info .sbn-cta{background:#3b82f6;color:#fff}\n" +
  ".sbn-type-warning .sbn-cta{background:#f59e0b;color:#1e1e2e}\n" +
  ".sbn-type-success .sbn-cta{background:#10b981;color:#fff}\n" +
  ".sbn-type-promo .sbn-cta{background:#e84545;color:#fff}\n" +
  ".sbn-close{flex-shrink:0;width:24px;height:24px;border:none;background:transparent;font-size:18px;line-height:1;cursor:pointer;opacity:.6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:inherit}\n" +
  ".sbn-close:hover{opacity:1;background:rgba(0,0,0,.06)}\n" +
  ".sbnt-simple-title{font-weight:700}\n" +
  ".sbnt-simple-message{opacity:.85}\n" +
  ".sbnt-icon-icon{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;font-weight:700}\n" +
  ".sbn-type-info .sbnt-icon-icon{background:#bfdbfe;color:#1e40af}\n" +
  ".sbn-type-warning .sbnt-icon-icon{background:#fde68a;color:#92400e}\n" +
  ".sbn-type-success .sbnt-icon-icon{background:#a7f3d0;color:#065f46}\n" +
  ".sbn-type-promo .sbnt-icon-icon{background:#fed7aa;color:#9a3412}\n" +
  ".sbnt-icon-texts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}\n" +
  ".sbnt-icon-title{font-weight:700}\n" +
  ".sbnt-icon-message{opacity:.85}\n" +
  ".sbnt-promo-badge{flex-shrink:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:4px}\n" +
  ".sbn-type-info .sbnt-promo-badge{background:#bfdbfe;color:#1e40af}\n" +
  ".sbn-type-warning .sbnt-promo-badge{background:#fde68a;color:#92400e}\n" +
  ".sbn-type-success .sbnt-promo-badge{background:#a7f3d0;color:#065f46}\n" +
  ".sbn-type-promo .sbnt-promo-badge{background:#fed7aa;color:#9a3412}\n" +
  ".sbnt-promo-texts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}\n" +
  ".sbnt-promo-title{font-weight:700}\n" +
  ".sbnt-promo-message{opacity:.85}";

const ICON_MAP: Record<string, string> = { info: "i", warning: "!", success: "\u2713", promo: "\u2605" };
const BADGE_MAP: Record<string, string> = { info: "Info", warning: "Notice", success: "Offer", promo: "Sale!" };

/** The three banner-templates/*.php files, rendered with the same conditional pieces. */
function renderTemplateHtml(template: string, type: string, title: string, message: string): string {
  if (template === "icon-message") {
    const icon = ICON_MAP[type] ?? "i";
    const titleHtml = title !== "" ? `<span class="sbnt-icon-title">${esc(title)}</span>` : "";
    const messageHtml = message !== "" ? `<span class="sbnt-icon-message">${esc(message)}</span>` : "";
    return `<span class="sbnt-icon-icon">${icon}</span><div class="sbnt-icon-texts">${titleHtml}${messageHtml}</div>`;
  }
  if (template === "seasonal-promo") {
    const badge = BADGE_MAP[type] ?? "Offer";
    const titleHtml = title !== "" ? `<span class="sbnt-promo-title">${esc(title)}</span>` : "";
    const messageHtml = message !== "" ? `<span class="sbnt-promo-message">${esc(message)}</span>` : "";
    return `<span class="sbnt-promo-badge">${badge}</span><div class="sbnt-promo-texts">${titleHtml}${messageHtml}</div>`;
  }
  const titleHtml = title !== "" ? `<span class="sbnt-simple-title">${esc(title)}</span>` : "";
  const messageHtml = message !== "" ? `<span class="sbnt-simple-message">${esc(message)}</span>` : "";
  return `${titleHtml}${messageHtml}`;
}

/** preview_banner: builds the shell HTML server-side, whitelisting the template (no traversal). */
function renderPreview(template: string, type: string, title: string, message: string, cta: BannerCta): string {
  const safeTemplate = Object.prototype.hasOwnProperty.call(BANNER_TEMPLATES, template) ? template : "simple-text";
  const ctaHtml =
    cta && cta.text !== "" && cta.link !== ""
      ? `<a class="sbn-cta" href="${esc(cta.link)}">${esc(cta.text)}</a>`
      : "";
  return (
    `<style>${PREVIEW_STYLE}</style>` +
    `<div class="sbn-shell sbn-type-${esc(type || "info")}" data-banner-id="preview" data-version="1" data-resurface-days="">` +
    `<div class="sbn-content">${renderTemplateHtml(safeTemplate, type, title, message)}</div>` +
    ctaHtml +
    `<button type="button" class="sbn-close" aria-label="Dismiss">&times;</button>` +
    `</div>`
  );
}

/** POST /api/admin/banners — dispatches the five actions. */
export async function bannersPost(req: Request): Promise<NextResponse> {
  const { user, denied } = await authorizeAdmin(req);
  if (denied) return denied;

  const { fields, form } = await readFields(req);

  // CSRF is checked first for every action (banners.php:20).
  if (!(await csrfOk(fields.csrf_token))) {
    return json({ success: false, message: "Security token invalid. Refresh the page and try again." });
  }

  const action = fields.action ?? "";
  const parsed = bannerSchema.safeParse(fields);
  if (!parsed.success) {
    return json({ success: false, message: "Unknown action." });
  }
  const d = parsed.data;

  if (action === "create_banner" || action === "update_banner") {
    if (action === "update_banner" && d.id === "") {
      return json({ success: false, message: "Banner ID missing." });
    }
    if (d.title === "" || d.message === "") {
      return json({ success: false, message: "Title and message are required." });
    }
    const audience = form
      .getAll("audience[]")
      .map((v) => String(v).trim())
      .filter((v) => v !== "");
    if (audience.length === 0) {
      return json({ success: false, message: "At least one audience must be selected." });
    }
    const { cta, error } = buildCta(d.cta_text, d.cta_link);
    if (error) return json({ success: false, message: error });

    const resurface = d.resurface_after_days !== "" ? phpInt(d.resurface_after_days) : null;
    const input: BannerInput = {
      title: d.title,
      message: d.message,
      template: d.template || "simple-text",
      type: d.type || "info",
      audience,
      cta,
      schedule: buildSchedule(d.schedule_start, d.schedule_end),
      resurface_after_days: resurface,
      priority: phpInt(d.priority),
      active: phpNotEmpty(fields.active),
    };

    if (action === "create_banner") {
      const banner = await createBanner(input, user.id);
      await auditAdmin(user, "admin.banner.create", { banner_id: banner.id, title: banner.title }, req);
      return json({ success: true, message: "Banner created.", banner });
    }

    const updated = await updateBanner(d.id, input, user.id);
    if (updated === null) return json({ success: false, message: "Banner not found." });
    await auditAdmin(user, "admin.banner.update", { banner_id: d.id, version: updated.version }, req);
    return json({ success: true, message: "Banner updated.", banner: updated });
  }

  if (action === "delete_banner") {
    if (d.id === "") return json({ success: false, message: "Banner ID missing." });
    const deleted = await deleteBanner(d.id);
    if (deleted) await auditAdmin(user, "admin.banner.delete", { banner_id: d.id }, req);
    return json({ success: deleted, message: deleted ? "Banner deleted." : "Banner not found." });
  }

  if (action === "toggle_banner_active") {
    if (d.id === "") return json({ success: false, message: "Banner ID missing." });
    const active = phpNotEmpty(fields.active);
    const result = await toggleBannerActive(d.id, active, user.id);
    if (result === null) return json({ success: false, message: "Banner not found." });
    await auditAdmin(user, "admin.banner.toggle", { banner_id: d.id, active }, req);
    return json({
      success: true,
      message: active ? "Banner activated." : "Banner deactivated.",
      banner: result,
    });
  }

  if (action === "preview_banner") {
    const { cta } = buildCta(d.cta_text, d.cta_link);
    const html = renderPreview(d.template || "simple-text", d.type || "info", d.title, d.message, cta);
    return json({ success: true, html });
  }

  return json({ success: false, message: "Unknown action." });
}
