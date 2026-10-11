const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

export const CURRENCY_CODE = process.env.CURRENCY_CODE ?? "INR";

/**
 * private/config.php line 73 hard-codes `date_default_timezone_set('Asia/Kolkata')`.
 * Vercel runs in UTC, so every "today"/streak/week computation has to be pinned to this
 * zone explicitly or the two sites disagree about what day it is.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

/** Today's calendar date (YYYY-MM-DD) in the site timezone. */
export function todayInSiteTz(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** PHP `date('H')` in the site timezone (0-23). */
export function siteHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false }).format(now);
  return Number(h);
}

function fmt(opts: Intl.DateTimeFormatOptions): (d: Date | string | null | undefined) => string {
  return (d) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: APP_TIMEZONE }).format(date);
  };
}

/** PHP `date('M d, Y')` → "Jan 05, 2026". */
export const formatMonthDayYear = fmt({ month: "short", day: "2-digit", year: "numeric" });
/** PHP `date('d M Y')` → "05 Jan 2026". */
export const formatDayMonthYear = fmt({ day: "2-digit", month: "short", year: "numeric" });
/** PHP `date('F d, Y')` → "January 05, 2026". */
export const formatLongDate = fmt({ month: "long", day: "2-digit", year: "numeric" });
/** PHP `date('M j')` → "Jan 5" (no leading zero). */
export const formatMonthDay = fmt({ month: "short", day: "numeric" });
/** PHP `date('M j, Y')` → "Jan 5, 2026". */
export const formatMonthDayCommaYear = fmt({ month: "short", day: "numeric", year: "numeric" });
/** PHP `date('M d, Y \a\t h:i A')` → "Jan 05, 2026 at 03:24 PM". */
export function formatSubmittedAt(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}
/** Just the year, for the "First Certificate" stat. */
export const formatYear = fmt({ year: "numeric" });
/** PHP `date('g:ia')` for a `TIME` column value ("07:30:00"). */
export function formatClock12(time: string | null | undefined): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]}${suffix}`;
}

/** PHP `date('g:i')` → "7:30". */
export function formatClock12Short(time: string | null | undefined): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`;
}

/** PHP `date('a')` → "am" / "pm". */
export function formatMeridiem(time: string | null | undefined): string {
  if (!time) return "";
  const m = /^(\d{1,2}):/.exec(time.trim());
  if (!m) return "";
  return Number(m[1]) >= 12 ? "pm" : "am";
}

/** learn.php's formatDuration(): "3h 12m" or "12 min". */
export function formatLessonDuration(secs: number): string {
  if (secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  AED: "AED ",
};

export const CURRENCY_DISPLAY_SYMBOL = SYMBOLS[CURRENCY_CODE] ?? `${CURRENCY_CODE} `;

export function siteUrl(path = ""): string {
  return `${SITE_URL}${path}`;
}

/** Star svg path shared by renderStars() and the half-star gradient. */
export const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

/** Split a rating into full/half/empty star counts (mirrors renderStars()). */
export function starParts(rating: number): { full: number; half: number; empty: number } {
  const r = Math.max(0, Math.min(5, rating));
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  return { full, half, empty: 5 - full - half };
}

export const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=240&fit=crop&auto=format";

export function getThumbnailUrl(thumbnail: string | null | undefined): string {
  if (thumbnail) return siteUrl(thumbnail);
  return FALLBACK_THUMBNAIL;
}

const CATEGORY_ICONS: Array<[string, string]> = [
  ["development", "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"],
  ["programming", "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"],
  ["design", "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"],
  ["business", "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"],
  ["marketing", "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"],
  ["data", "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"],
  ["photography", "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 001.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm3 9h12m-6-6a3 3 0 110-6 3 3 0 010 6z"],
  ["music", "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"],
  ["default", "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"],
];

export function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, path] of CATEGORY_ICONS) {
    if (lower.includes(key)) return path;
  }
  return CATEGORY_ICONS[CATEGORY_ICONS.length - 1][1];
}

const LEVEL_BADGES: Record<string, string> = {
  beginner: "badge--beginner",
  intermediate: "badge--intermediate",
  advanced: "badge--advanced",
};

export function getLevelBadgeClass(level: string): string {
  return LEVEL_BADGES[level.toLowerCase()] ?? "badge--beginner";
}

/** Mirrors formatPrice(..., htmlWrap: false) from private/config.php. */
export function formatPrice(price: number): string {
  if (price <= 0) return "Free";
  return `${CURRENCY_DISPLAY_SYMBOL}${price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function strPad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function trimWidth(value: string, width: number): string {
  if (value.length <= width) return value;
  return value.slice(0, width) + "\u2026";
}

/**
 * maskEmail() from private/config.php: keep the first three characters of the local part and
 * replace the rest with asterisks. Used on the instructor students and reviews pages, so a
 * student's address is never shown to an instructor in full.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at === -1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 3) return local + domain;
  return local.slice(0, 3) + "*".repeat(local.length - 3) + domain;
}

/**
 * PHP's number_format($n, $dp). Unlike toLocaleString it keeps trailing zeros and uses a
 * comma thousands separator, which is what the instructor pages print inside `style="..."`.
 */
export function phpNumber(value: number | string | null | undefined, decimals = 0): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${safe < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/**
 * PHP's round() followed by string casting. PHP prints 4.0 as "4" and 0.0 as "0", which the
 * instructor pages rely on when they interpolate progress/percentage values into markup.
 */
export function phpRound(value: number, decimals = 0): string {
  const factor = 10 ** decimals;
  // PHP rounds half away from zero; Math.round rounds half up, so mirror it explicitly.
  const scaled = value * factor;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  const out = (rounded / factor).toFixed(decimals);
  return decimals > 0 ? out.replace(/\.0+$/, "") : out;
}

/** PHP ucfirst(): uppercase only the first character. */
export function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** PHP date('F Y') for a "YYYY-MM" month key -> "October 2026". */
export function monthNameFromKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(d);
}

/** PHP date('h:i A') -> "03:47 PM", used by the earnings sales table. */
export const formatClock12PHPM = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

/**
 * PHP date('d M Y, g:i A') -> "05 Jan 2026, 3:24 PM" — the admin instructor-application
 * detail page prints submitted/reviewed timestamps this way ('d M Y' + 12h no leading zero).
 */
export function formatDayMonthYearCommaTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    day: "2-digit", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

/**
 * The list page's human_time_diff() from public/admin/instructor-applications.php:
 * "Just now", "{n}m ago", "{n}h ago", "{n}d ago", then the month and year ("Jan 2026").
 */
export function humanTimeDiff(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, month: "short", year: "numeric" }).format(d);
}
