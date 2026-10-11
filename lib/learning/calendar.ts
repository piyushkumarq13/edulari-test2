/**
 * Pure date helpers for schedule.php and dashboard.php.
 *
 * PHP's `new DateTime('today')`, `'Monday this week'`, `DATE(completed_at)` and the
 * streak walk-back all run in Asia/Kolkata (private/config.php line 73). These helpers
 * take the site timezone from `APP_TIMEZONE` so Vercel's UTC clock cannot shift a day.
 */

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTH_SHORT_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** A plain calendar date; `dateStr` is the YYYY-MM-DD key used as a map index. */
export type CalendarDay = {
  dateStr: string;
  name: string;
  num: string;
  /** 0 = Sunday ... 6 = Saturday, matching PHP's `date('w')`. */
  dow: number;
};

function partsInTz(now: Date, timeZone: string): { y: number; m: number; d: number; dow: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) map[part.type] = part.value;
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    dow: dowMap[map.weekday ?? "Sun"] ?? 0,
  };
}

export function ymd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayYmd(now: Date, timeZone: string): string {
  const p = partsInTz(now, timeZone);
  return ymd(p.y, p.m, p.d);
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Monday of the week containing `dateStr` (PHP: `modify('Monday this week')`). */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  const dow = dt.getUTCDay(); // 0 = Sunday
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, delta);
}

/** schedule.php's `?week=N` window: Monday..Sunday, `weekOffset` 0 = current week. */
export function weekWindow(todayStr: string, weekOffset: number): { monday: string; sunday: string } {
  const monday = addDays(mondayOf(todayStr), weekOffset * 7);
  return { monday, sunday: addDays(monday, 6) };
}

/** The 7 day columns, Monday first, exactly as schedule.php builds them. */
export function weekDays(monday: string): CalendarDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(monday, i);
    return { dateStr, name: MONTH_SHORT_DAY_NAMES[i] ?? "", num: String(Number(dateStr.slice(8, 10))), dow: (i + 1) % 7 };
  });
}

/**
 * Consecutive-day streak walking backwards from today, like schedule.php/dashboard.php:
 * the i-th most recent distinct date must equal today minus i days, else the walk breaks.
 */
export function computeStreak(distinctDatesDesc: string[], todayStr: string): number {
  let streak = 0;
  for (let i = 0; i < distinctDatesDesc.length; i++) {
    if (distinctDatesDesc[i] === addDays(todayStr, -i)) streak++;
    else break;
  }
  return streak;
}

/** schedule.php's heatmap level: 0 none, 1 single, 2 up to three, 4+ = 3. */
export function heatmapLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  return count <= 3 ? 2 : 3;
}

/** Number of days in the month `dateStr` falls in. */
export function daysInMonth(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
}

/** Leading blank cells so a month grid starts on Sunday (PHP `date('w')` on the 1st). */
export function monthLeadingBlanks(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** The heatmap's own start: 27 days before today (schedule.php `modify('-27 days')`). */
export function heatmapStart(todayStr: string): string {
  return addDays(todayStr, -27);
}

/** schedule.php's week label, including the This/Last/Next Week prefixes. */
export function weekLabel(monday: string, sunday: string, weekOffset: number, fmtMonthDay: (s: string) => string, fmtMonthDayCommaYear: (s: string) => string): string {
  const range = `${fmtMonthDay(monday)} – ${fmtMonthDayCommaYear(sunday)}`;
  if (weekOffset === 0) return `This Week: ${range}`;
  if (weekOffset === -1) return `Last Week: ${range}`;
  if (weekOffset === 1) return `Next Week: ${range}`;
  return range;
}

/** my-courses.php's tab buckets, extracted so the counts and the filter cannot drift. */
export type ProgressBucket = "in_progress" | "completed" | "not_started";

export function bucketFor(progressPercentage: number): ProgressBucket {
  const pct = Number(progressPercentage);
  if (pct >= 100) return "completed";
  if (pct > 0) return "in_progress";
  return "not_started";
}

export function progressLabel(pct: number): string {
  if (pct >= 100) return "Completed";
  if (pct > 0) return "In Progress";
  return "Not Started";
}

export function progressClass(pct: number): string {
  if (pct >= 100) return "completed";
  if (pct > 0) return "in-progress";
  return "not-started";
}