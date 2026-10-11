import crypto from "node:crypto";
import { sql } from "@/lib/db/client";

/**
 * Port of private/functions/banners.php.
 *
 * The PHP stored banners in private/data/banners.json (a flat array, append order). On serverless
 * there is no writable disk, so the identical object shape is kept in public.site_banners
 * (migration 001). Every read/write below mirrors the original function semantics 1:1 so the admin
 * page, the frontend banner stack and the version-keyed dismiss state keep behaving the same.
 */

export type BannerCta = { text: string; link: string } | null;
export type BannerSchedule = { start_at: string | null; end_at: string | null } | null;

export type BannerRow = {
  id: string;
  version: number;
  template: string;
  type: string;
  title: string;
  message: string;
  audience: string[];
  cta: BannerCta;
  schedule: BannerSchedule;
  resurface_after_days: number | null;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
};

export type BannerInput = {
  title: string;
  message: string;
  template: string;
  type: string;
  audience: string[];
  cta: BannerCta;
  schedule: BannerSchedule;
  resurface_after_days: number | null;
  priority: number;
  active: boolean;
};

type RawRow = {
  id: string;
  version: number;
  template: string;
  type: string;
  title: string;
  message: string;
  audience: unknown;
  cta: unknown;
  schedule: unknown;
  resurface_after_days: number | null;
  active: boolean;
  priority: number;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: number | null;
  updated_by: number | null;
};

/**
 * getAvailableBannerTemplates(): the PHP scandir()'d private/banner-templates/*.php and turned the
 * filename into ucwords(str_replace('-',' ',name)). That is a fixed set of three files, so it is a
 * static registry here (no filesystem access on serverless). Keys and labels are identical.
 */
export const BANNER_TEMPLATES: Record<string, string> = {
  "simple-text": "Simple Text",
  "icon-message": "Icon Message",
  "seasonal-promo": "Seasonal Promo",
};

/** PHP date('Y-m-d H:i:s') formatting of a timestamp, used for the json_encode'd row timestamps. */
function sqlDateTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Order-independent CTA equality, matching PHP's strict array comparison in updateBanner(). */
function sameCta(a: BannerCta, b: BannerCta): boolean {
  if (a === null || b === null) return a === b;
  return a.text === b.text && a.link === b.link;
}

function mapRow(r: RawRow): BannerRow {
  return {
    id: r.id,
    version: Number(r.version) || 1,
    template: r.template ?? "simple-text",
    type: r.type ?? "info",
    title: r.title ?? "",
    message: r.message ?? "",
    audience: Array.isArray(r.audience) ? (r.audience as unknown[]).map((v) => String(v)) : [],
    cta: (r.cta as BannerCta) ?? null,
    schedule: (r.schedule as BannerSchedule) ?? null,
    resurface_after_days: r.resurface_after_days ?? null,
    active: Boolean(r.active),
    priority: Number(r.priority) || 0,
    created_at: sqlDateTime(r.created_at),
    updated_at: sqlDateTime(r.updated_at),
    created_by: r.created_by ?? null,
    updated_by: r.updated_by ?? null,
  };
}

/** getAllBanners(): append order preserved (oldest first), matching the JSON file order. */
export async function getAllBanners(): Promise<BannerRow[]> {
  const rows = await sql<RawRow[]>`
    SELECT id, version, template, type, title, message, audience, cta, schedule,
           resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
    FROM site_banners
    ORDER BY created_at ASC, id ASC
  `;
  return rows.map(mapRow);
}

/** Single banner by id (used by the edit/save path). */
export async function getBanner(id: string): Promise<BannerRow | null> {
  const rows = await sql<RawRow[]>`
    SELECT id, version, template, type, title, message, audience, cta, schedule,
           resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
    FROM site_banners WHERE id = ${id} LIMIT 1
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/** createBanner(): id is 'bnr_' + 12 hex chars from random_bytes(6), exactly as the PHP. */
export async function createBanner(data: BannerInput, userId: number | null): Promise<BannerRow> {
  const id = `bnr_${crypto.randomBytes(6).toString("hex")}`;
  const rows = await sql<RawRow[]>`
    INSERT INTO site_banners
      (id, version, template, type, title, message, audience, cta, schedule,
       resurface_after_days, active, priority, created_by, updated_by)
    VALUES (
      ${id}, 1,
      ${data.template || "simple-text"}, ${data.type || "info"},
      ${data.title}, ${data.message},
      ${sql.json(data.audience)},
      ${data.cta === null ? null : sql.json(data.cta)},
      ${data.schedule === null ? null : sql.json(data.schedule)},
      ${data.resurface_after_days}, ${data.active}, ${data.priority},
      ${userId}, ${userId}
    )
    RETURNING id, version, template, type, title, message, audience, cta, schedule,
              resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
  `;
  return mapRow(rows[0]);
}

/**
 * updateBanner(): the version bump watches ONLY title, message, template, type and cta. Audience,
 * schedule, priority, active and resurface are written but never bump the version, so a banner a
 * user has dismissed (dismiss state is keyed on id+version) stays dismissed after those edits.
 * Returns null when the id does not exist.
 */
export async function updateBanner(
  id: string,
  data: BannerInput,
  userId: number | null,
): Promise<BannerRow | null> {
  const existing = await getBanner(id);
  if (!existing) return null;

  const nextTemplate = data.template || existing.template;
  const nextType = data.type || existing.type;
  const nextCta = data.cta;

  // PHP compares $oldContent !== $newContent (strict array compare, order-independent), so a banner
  // keeps its version — and a user's dismiss state — unless title/message/template/type/cta change.
  // jsonb returns object keys in a canonical order, so cta is compared field-by-field to avoid a
  // false positive when only the key order differs.
  const contentChanged =
    existing.title !== data.title ||
    existing.message !== data.message ||
    existing.template !== nextTemplate ||
    existing.type !== nextType ||
    !sameCta(existing.cta, nextCta);
  const version = contentChanged ? (Number(existing.version) || 0) + 1 : existing.version;

  const rows = await sql<RawRow[]>`
    UPDATE site_banners SET
      version = ${version},
      template = ${nextTemplate},
      type = ${nextType},
      title = ${data.title},
      message = ${data.message},
      audience = ${sql.json(data.audience)},
      cta = ${nextCta === null ? null : sql.json(nextCta)},
      schedule = ${data.schedule === null ? null : sql.json(data.schedule)},
      resurface_after_days = ${data.resurface_after_days},
      active = ${data.active},
      priority = ${data.priority},
      updated_by = ${userId}
    WHERE id = ${id}
    RETURNING id, version, template, type, title, message, audience, cta, schedule,
              resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/** deleteBanner(): true when a row was removed, false when the id was not found. */
export async function deleteBanner(id: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM site_banners WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/** toggleBannerActive(): sets active (updated_at via trigger, matching updated_at = now()). */
export async function toggleBannerActive(
  id: string,
  active: boolean,
  userId: number | null,
): Promise<BannerRow | null> {
  const rows = await sql<RawRow[]>`
    UPDATE site_banners SET active = ${active}, updated_by = ${userId}
    WHERE id = ${id}
    RETURNING id, version, template, type, title, message, audience, cta, schedule,
              resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

/**
 * getActiveBannersForRole(): active banners whose audience contains the role, inside their
 * schedule window, highest priority first. Role defaults to 'guest'. Mirrors
 * getActiveBannersForRole() in functions/banners.php (audience match is strict, so a banner with
 * an empty audience is NOT shown, unlike the older browser-side filter).
 */
export async function getActiveBannersForRole(role: string | null): Promise<BannerRow[]> {
  const forRole = role ?? "guest";
  const rows = await sql<RawRow[]>`
    SELECT id, version, template, type, title, message, audience, cta, schedule,
           resurface_after_days, active, priority, created_at, updated_at, created_by, updated_by
    FROM site_banners
    WHERE active = true
      AND audience @> ${sql.json([forRole])}::jsonb
      AND (schedule IS NULL
           OR schedule->>'start_at' IS NULL
           OR (schedule->>'start_at')::timestamp <= (now() AT TIME ZONE 'Asia/Kolkata'))
      AND (schedule IS NULL
           OR schedule->>'end_at' IS NULL
           OR (schedule->>'end_at')::timestamp >= (now() AT TIME ZONE 'Asia/Kolkata'))
    ORDER BY priority DESC, created_at ASC, id ASC
  `;
  return rows.map(mapRow);
}
