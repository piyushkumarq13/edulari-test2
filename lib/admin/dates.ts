import { APP_TIMEZONE } from "@/lib/format";

/**
 * Server-side date formatters matching the PHP `date()` patterns used by the
 * admin bug/contact pages. Values are stored as timestamptz (UTC); we render
 * them in the site timezone (the twin of the PHP `date_default_timezone_set`),
 * so the displayed clock matches the legacy pages.
 */

function parts(date: Date, locale: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const list = new Intl.DateTimeFormat(locale, { timeZone: APP_TIMEZONE, ...options }).formatToParts(date);
  const out: Record<string, string> = {};
  for (const p of list) if (p.type !== "literal") out[p.type] = p.value;
  return out;
}

/** PHP `date('d M Y, H:i', …)` — e.g. `11 Oct 2026, 14:30`. */
export function formatDayMonthYearTime24(date: Date): string {
  const p = parts(date, "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** PHP `date('M j, Y \a\t g:i A', …)` — e.g. `Oct 11, 2026 at 2:30 PM`. */
export function formatMonthDayYearAtTime(date: Date): string {
  const p = parts(date, "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${p.month} ${p.day}, ${p.year} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
}
