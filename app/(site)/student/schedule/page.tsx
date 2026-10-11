import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { getStudentCourses } from "@/lib/db/learning";
import {
  getDoneDatesDesc,
  getHeatmapCounts,
  getPendingTasks,
  getWeekPlans,
  getWeekStats,
} from "@/lib/db/study-plan";
import {
  addDays,
  computeStreak,
  daysInMonth,
  heatmapLevel,
  heatmapStart,
  monthLeadingBlanks,
  todayYmd,
  weekDays,
  weekWindow,
} from "@/lib/learning/calendar";
import { APP_TIMEZONE, formatClock12, formatClock12Short, formatMeridiem, formatMonthDay, formatMonthDayCommaYear } from "@/lib/format";
import ScheduleClient, { type ScheduleData } from "./ScheduleClient";
import "@/styles/css/student/schedule.css";

export const metadata: Metadata = pageMetadata({
  title: "My Schedule – Edulari",
  description: "Plan your study sessions, track your progress and stay on top of deadlines.",
  path: "/student/schedule",
  noindex: true,
});

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;

  const rawWeek = sp.week ?? "0";
  const weekOffset = Number.parseInt(rawWeek, 10);
  const week = Number.isFinite(weekOffset) ? weekOffset : 0;

  const now = new Date();
  const todayStr = todayYmd(now, APP_TIMEZONE);
  const { monday, sunday } = weekWindow(todayStr, week);

  const [weekPlans, pendingTasks, heatmapCounts, weekStat, doneDates, myCourses, csrfToken] = await Promise.all([
    getWeekPlans(user.id, monday, sunday),
    getPendingTasks(user.id),
    getHeatmapCounts(user.id, heatmapStart(todayStr), todayStr),
    getWeekStats(user.id, monday, sunday),
    getDoneDatesDesc(user.id),
    getStudentCourses(user.id),
    readCsrfToken(),
  ]);

  const days = weekDays(monday).map((day) => ({
    ...day,
    plans: weekPlans
      .filter((p) => p.planned_date === day.dateStr)
      .map((p) => ({
        planId: Number(p.id),
        courseId: Number(p.course_id),
        lessonId: p.lesson_id === null ? null : Number(p.lesson_id),
        plannedDate: p.planned_date,
        plannedTime: p.planned_time ?? "",
        durationMin: Number(p.duration_min ?? 30),
        note: p.note ?? "",
        isDone: p.is_done,
        courseTitle: p.course_title,
        lessonTitle: p.lesson_title ?? "",
        chipTitle: p.lesson_title || p.course_title,
        timeLabel: formatClock12(p.planned_time),
        rowTimeLabel: formatClock12Short(p.planned_time) || "—",
        rowMeridiem: formatMeridiem(p.planned_time),
        rowTitle: p.lesson_title || "General Study",
      })),
  }));

  const heatmapStartDate = heatmapStart(todayStr);
  const leadingBlanks = monthLeadingBlanks(heatmapStartDate);

  const data: ScheduleData = {
    todayStr,
    weekOffset: week,
    weekLabel: buildWeekLabel(week, monday, sunday),
    csrfToken,
    days,
    todayPlans: days.find((d) => d.dateStr === todayStr)?.plans ?? [],
    stats: {
      plannedThisWeek: weekStat.planned_total,
      doneThisWeek: weekStat.done_total,
      pendingTasks: pendingTasks.length,
      streak: computeStreak(doneDates, todayStr),
    },
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type,
      courseTitle: t.course_title,
      courseId: t.course_id,
    })),
    heatmap: {
      leadingBlanks,
      cells: Array.from({ length: 28 }, (_, i) => {
        const dateStr = addDays(heatmapStartDate, i);
        const count = heatmapCounts.get(dateStr) ?? 0;
        return {
          dateStr,
          level: heatmapLevel(count),
          title:
            count > 0
              ? `${count} session${count > 1 ? "s" : ""} on ${formatMonthDay(dateStr)}`
              : formatMonthDay(dateStr),
        };
      }),
    },
    heroCalendar: {
      monthLabel: new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" }).format(now),
      leadingBlanks: monthLeadingBlanks(todayStr),
      daysInMonth: daysInMonth(todayStr),
      todayNum: Number(todayStr.slice(8, 10)),
      plannedDays: new Set(heatmapCounts.keys()),
      monthPrefix: todayStr.slice(0, 8),
    },
    myCourses: myCourses.map((c) => ({
      courseId: Number(c.course_id),
      title: c.title,
      thumbnail: c.thumbnail,
      progressPercentage: Number(c.progress_percentage ?? 0),
    })),
  };

  return <ScheduleClient {...data} />;
}

function buildWeekLabel(weekOffset: number, monday: string, sunday: string): string {
  const range = `${formatMonthDay(monday)} – ${formatMonthDayCommaYear(sunday)}`;
  if (weekOffset === 0) return `This Week: ${range}`;
  if (weekOffset === -1) return `Last Week: ${range}`;
  if (weekOffset === 1) return `Next Week: ${range}`;
  return range;
}