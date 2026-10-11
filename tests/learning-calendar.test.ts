import { describe, it, expect } from "vitest";
import {
  addDays,
  bucketFor,
  computeStreak,
  daysInMonth,
  heatmapLevel,
  heatmapStart,
  mondayOf,
  monthLeadingBlanks,
  progressClass,
  progressLabel,
  todayYmd,
  weekDays,
  weekWindow,
} from "@/lib/learning/calendar";
import { clampDuration, isValidPlannedDate, normalizePlannedTime } from "@/lib/db/study-plan";
import { buildCertificateId, certificateIdPart, filterCertificates } from "@/lib/learning/certificates";
import { APP_TIMEZONE, formatClock12, formatClock12Short, formatLessonDuration, formatMeridiem } from "@/lib/format";
import { detectRealMime, scanUploadFile } from "@/lib/storage/upload-validation";
import {
  ASSIGNMENT_ALLOWED_MIMES,
  ASSIGNMENT_MAX_BYTES,
  assignmentObjectName,
  sanitizeUploadName,
} from "@/lib/learning/assignments";

const TZ = "Asia/Kolkata";

describe("site-timezone dates", () => {
  it("resolves 'today' in Asia/Kolkata, not UTC", () => {
    // 2026-03-10T18:40:00Z is already 11 Mar in Kolkata (+05:30).
    const instant = new Date("2026-03-10T18:40:00Z");
    expect(todayYmd(instant, TZ)).toBe("2026-03-11");
    expect(todayYmd(instant, "UTC")).toBe("2026-03-10");
  });

  it("starts the week on Monday", () => {
    expect(mondayOf("2026-03-11")).toBe("2026-03-09");
    expect(mondayOf("2026-03-09")).toBe("2026-03-09");
    expect(mondayOf("2026-03-15")).toBe("2026-03-09");
  });

  it("shifts the week window by the offset", () => {
    expect(weekWindow("2026-03-11", 0)).toEqual({ monday: "2026-03-09", sunday: "2026-03-15" });
    expect(weekWindow("2026-03-11", -1)).toEqual({ monday: "2026-03-02", sunday: "2026-03-08" });
    expect(weekWindow("2026-03-11", 1)).toEqual({ monday: "2026-03-16", sunday: "2026-03-22" });
  });

  it("builds seven Monday-first day columns", () => {
    const days = weekDays("2026-03-09");
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ dateStr: "2026-03-09", name: "Mon", num: "9", dow: 1 });
    expect(days[6]).toMatchObject({ dateStr: "2026-03-15", name: "Sun", dow: 0 });
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-11", 0)).toBe("2026-03-11");
  });

  it("derives the heatmap window from 27 days back", () => {
    expect(heatmapStart("2026-03-11")).toBe("2026-02-12");
  });

  it("knows month length and the leading weekday offset", () => {
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(daysInMonth("2024-02-10")).toBe(29);
    expect(daysInMonth("2026-03-10")).toBe(31);
    expect(monthLeadingBlanks("2026-03-01")).toBe(0); // Sunday
    expect(monthLeadingBlanks("2026-03-02")).toBe(1); // Monday
  });

  it("uses the configured site timezone by default", () => {
    expect(APP_TIMEZONE).toBe("Asia/Kolkata");
  });
});

describe("computeStreak", () => {
  it("counts consecutive days back from today", () => {
    expect(computeStreak(["2026-03-11", "2026-03-10", "2026-03-09"], "2026-03-11")).toBe(3);
  });

  it("stops at the first gap", () => {
    expect(computeStreak(["2026-03-11", "2026-03-09"], "2026-03-11")).toBe(1);
  });

  it("returns 0 when the newest date is not today", () => {
    expect(computeStreak(["2026-03-10", "2026-03-09"], "2026-03-11")).toBe(0);
  });

  it("returns 0 with no history", () => {
    expect(computeStreak([], "2026-03-11")).toBe(0);
  });

  it("handles a streak that crosses a month boundary", () => {
    expect(computeStreak(["2026-04-01", "2026-03-31", "2026-03-30"], "2026-04-01")).toBe(3);
  });
});

describe("heatmap levels", () => {
  it("maps counts to the four levels", () => {
    expect(heatmapLevel(0)).toBe(0);
    expect(heatmapLevel(1)).toBe(1);
    expect(heatmapLevel(2)).toBe(2);
    expect(heatmapLevel(3)).toBe(2);
    expect(heatmapLevel(4)).toBe(3);
  });
});

describe("progress buckets (my-courses.php)", () => {
  it("splits at 0 and 100 like the PHP filter", () => {
    expect(bucketFor(0)).toBe("not_started");
    expect(bucketFor(0.4)).toBe("in_progress");
    expect(bucketFor(99.6)).toBe("in_progress");
    expect(bucketFor(100)).toBe("completed");
    expect(bucketFor(120)).toBe("completed");
  });

  it("labels and classes follow the same buckets", () => {
    expect(progressLabel(0)).toBe("Not Started");
    expect(progressClass(0)).toBe("not-started");
    expect(progressLabel(50)).toBe("In Progress");
    expect(progressClass(50)).toBe("in-progress");
    expect(progressLabel(100)).toBe("Completed");
    expect(progressClass(100)).toBe("completed");
  });
});

describe("study plan input rules", () => {
  it("clamps the duration to 5..480 with a 30 default", () => {
    expect(clampDuration(0)).toBe(30);
    expect(clampDuration(1)).toBe(5);
    expect(clampDuration(45)).toBe(45);
    expect(clampDuration(9999)).toBe(480);
    expect(clampDuration(Number.NaN)).toBe(30);
  });

  it("rejects impossible calendar dates, like DateTime::createFromFormat", () => {
    expect(isValidPlannedDate("2026-03-11")).toBe(true);
    expect(isValidPlannedDate("2026-02-30")).toBe(false);
    expect(isValidPlannedDate("2026-13-01")).toBe(false);
    expect(isValidPlannedDate("2026-3-1")).toBe(false);
    expect(isValidPlannedDate("")).toBe(false);
    expect(isValidPlannedDate("2024-02-29")).toBe(true);
  });

  it("normalises a time input and rejects out-of-range values", () => {
    expect(normalizePlannedTime("7:05")).toBe("07:05:00");
    expect(normalizePlannedTime("07:05")).toBe("07:05:00");
    expect(normalizePlannedTime("")).toBeNull();
    expect(normalizePlannedTime(null)).toBeNull();
    expect(normalizePlannedTime("25:00")).toBeNull();
    expect(normalizePlannedTime("07:99")).toBeNull();
  });
});

describe("assignment attachment naming", () => {
  it("sanitises the basename to [A-Za-z0-9._-]", () => {
    expect(sanitizeUploadName("my report (final).pdf")).toBe("my_report__final_.pdf");
    expect(sanitizeUploadName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadName("C:\\temp\\notes.txt")).toBe("notes.txt");
  });

  it("prefixes with time and user id like the PHP", () => {
    expect(assignmentObjectName(1770000000, 42, "my file.pdf")).toBe("1770000000_42_my_file.pdf");
  });
});

describe("assignment attachment scanning", () => {
  const pdf = Buffer.from("%PDF-1.4\n...");
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32, 1)]);
  const txt = Buffer.from("just some plain text answer\n", "utf8");

  it("sniffs the MIME types the allow-list covers", () => {
    expect(detectRealMime(pdf)).toBe("application/pdf");
    expect(detectRealMime(zip)).toBe("application/zip");
    expect(detectRealMime(txt)).toBe("text/plain");
  });

  it("accepts every allowed attachment type", () => {
    expect(scanUploadFile(pdf, ASSIGNMENT_ALLOWED_MIMES, "assignment", ASSIGNMENT_MAX_BYTES).safe).toBe(true);
    expect(scanUploadFile(zip, ASSIGNMENT_ALLOWED_MIMES, "assignment", ASSIGNMENT_MAX_BYTES).safe).toBe(true);
    expect(scanUploadFile(txt, ASSIGNMENT_ALLOWED_MIMES, "assignment", ASSIGNMENT_MAX_BYTES).safe).toBe(true);
  });

  it("rejects a type outside the allow-list", () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    const r = scanUploadFile(png, ASSIGNMENT_ALLOWED_MIMES, "assignment", ASSIGNMENT_MAX_BYTES);
    expect(r.safe).toBe(false);
    expect(r.message).toBe("File type not allowed.");
  });

  it("rejects an oversized file with the PHP's wording", () => {
    // 1 KB cap -> round(1/1048576, 1) === 0 -> "Maximum allowed size is 0 MB."
    const big = Buffer.concat([pdf, Buffer.alloc(2000, 0x20)]);
    const r = scanUploadFile(big, ASSIGNMENT_ALLOWED_MIMES, "assignment", 1024);
    expect(r.safe).toBe(false);
    expect(r.message).toBe("File is too large. Maximum allowed size is 0 MB.");
  });

  it("rejects an embedded PHP tag", () => {
    const evil = Buffer.concat([pdf, Buffer.from("\n<?php system('rm -rf /'); ?>")]);
    const r = scanUploadFile(evil, ASSIGNMENT_ALLOWED_MIMES, "assignment", ASSIGNMENT_MAX_BYTES);
    expect(r.safe).toBe(false);
    expect(r.message).toBe("File contains disallowed content and was rejected.");
  });
});

describe("certificates", () => {
  it("mints four uppercase hex characters per group", () => {
    const part = certificateIdPart(() => Buffer.from([0xab, 0xcd]));
    expect(part).toBe("ABCD");
    expect(certificateIdPart(() => Buffer.from([0x00, 0xff]))).toBe("00FF");
  });

  it("builds CERT-XXXX-XXXX-XXXX", () => {
    expect(buildCertificateId("AAAA", "BBBB", "CCCC")).toBe("CERT-AAAA-BBBB-CCCC");
  });

  it("searches by course name or certificate id, case-insensitively", () => {
    const rows = [
      { course_name: "Advanced SQL", certificate_id: "CERT-AAAA-1111-2222" },
      { course_name: "React Basics", certificate_id: "CERT-BBBB-3333-4444" },
    ];
    expect(filterCertificates(rows, "sql")).toHaveLength(1);
    expect(filterCertificates(rows, "CERT-bbbb")).toHaveLength(1);
    expect(filterCertificates(rows, "  ")).toHaveLength(2);
    expect(filterCertificates(rows, "nothing")).toHaveLength(0);
  });
});

describe("display formatting", () => {
  it("formats a TIME column the way the PHP pages do", () => {
    expect(formatClock12("07:05:00")).toBe("7:05am");
    expect(formatClock12("19:30:00")).toBe("7:30pm");
    expect(formatClock12("00:00:00")).toBe("12:00am");
    expect(formatClock12("12:00:00")).toBe("12:00pm");
    expect(formatClock12(null)).toBe("");
    expect(formatClock12Short("07:05:00")).toBe("7:05");
    expect(formatMeridiem("19:30:00")).toBe("pm");
  });

  it("formats a lesson duration", () => {
    expect(formatLessonDuration(0)).toBe("");
    expect(formatLessonDuration(-5)).toBe("");
    expect(formatLessonDuration(45)).toBe("0 min");
    expect(formatLessonDuration(12 * 60 + 45)).toBe("12 min");
    expect(formatLessonDuration(3600 + 12 * 60)).toBe("1h 12m");
  });
});