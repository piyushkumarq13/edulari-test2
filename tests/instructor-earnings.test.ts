// lib/config.ts validates the environment at import time, so these must be set before the
// modules under test are loaded (import hoisting means this has to be a side-effect import).
import "./helpers/env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@/lib/db/client";
import { createCourse } from "@/lib/db/instructor/courses";
import {
  getEarningsTotals,
  getMonthlyEarnings,
  getTopEarningCourses,
  getRecentSales,
  getAvailableYears,
  getInstructorPayouts,
  getTotalPayoutsForInstructor,
  pendingBalance,
} from "@/lib/db/instructor/earnings";
import { formatPrice, formatClock12PHPM, phpNumber, phpRound, maskEmail } from "@/lib/format";

let ownerId = 0;
let studentId = 0;
let studentId2 = 0;
let paidCourse = 0;
let freeCourse = 0;
let suffix = 0;


beforeAll(async () => {
  suffix = Date.now();
  const [u] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Earn Owner', ${`earn-${suffix}@edulari.test`}, 'x', 'instructor', true, true)
    RETURNING id`;
  const [s] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Earn Student', ${`earn-stu-${suffix}@edulari.test`}, 'x', 'student', true, true)
    RETURNING id`;
  ownerId = u.id;
  studentId = s.id;

  paidCourse = (await createCourse({ instructor_id: ownerId, title: `Paid ${suffix}`, price: 500 }))!;
  freeCourse = (await createCourse({ instructor_id: ownerId, title: `Free ${suffix}`, price: 0 }))!;

  // A unique index covers (course_id, student_id), so the older paid enrollment needs a
  // second student: two paid rows and one free row give the totals something to sum.
  const [s2] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, is_active, email_verified)
    VALUES ('Earn Student Two', ${`earn-stu2-${suffix}@edulari.test`}, 'x', 'student', true, true)
    RETURNING id`;
  studentId2 = s2.id;

  await sql`
    INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
    VALUES (${paidCourse}, ${studentId}, now(), 0)`;
  await sql`
    INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
    VALUES (${paidCourse}, ${studentId2}, now() - interval '40 days', 50)`;
  await sql`
    INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
    VALUES (${freeCourse}, ${studentId}, now() - interval '40 days', 0)`;
});

afterAll(async () => {
  await sql`DELETE FROM instructor_payouts WHERE instructor_id = ${ownerId}`;
  await sql`DELETE FROM courses WHERE instructor_id = ${ownerId}`;
  await sql`DELETE FROM users WHERE id IN ${sql([ownerId, studentId, studentId2].filter(Boolean))}`;
});

describe("earnings calculation", () => {
  it("credits the full course price for every enrollment, with no revenue share", async () => {
    const totals = await getEarningsTotals(ownerId);
    // 500 + 500 paid, and the free enrollment contributes 0.
    expect(totals.total_earnings).toBe(1000);
  });

  it("counts free enrollments as students but not as revenue", async () => {
    const totals = await getEarningsTotals(ownerId);
    expect(totals.total_students).toBe(3);
    expect(totals.this_month).toBe(500);
    expect(totals.this_year).toBe(1000);
  });

  it("buckets every month of the year, leaving empty months at zero", async () => {
    const year = new Date().getUTCFullYear();
    const monthly = await getMonthlyEarnings(ownerId, year);
    expect(monthly).toHaveLength(12);
    expect(monthly.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const currentMonth = monthly.find((m) => m.month === new Date().getUTCMonth() + 1)!;
    expect(currentMonth.revenue).toBe(500);
    expect(currentMonth.sales).toBe(1);
    const empty = monthly.find((m) => m.month === 6)!;
    expect(empty.revenue).toBe(0);
    expect(empty.sales).toBe(0);
  });

  it("ranks courses by summed revenue", async () => {
    const top = await getTopEarningCourses(ownerId);
    expect(top[0].revenue).toBe(1000);
    expect(top[0].enrollments).toBe(2);
    expect(top.some((c) => c.title.startsWith("Free"))).toBe(true);
  });

  it("filters the sales list by month", async () => {
    const year = new Date().getUTCFullYear();
    const all = await getRecentSales(ownerId, year, 0);
    expect(all).toHaveLength(3);
    const onlyCurrent = await getRecentSales(ownerId, year, new Date().getUTCMonth() + 1);
    expect(onlyCurrent).toHaveLength(1);
  });

  it("lists the years that have enrollments", async () => {
    const years = await getAvailableYears(ownerId);
    expect(years).toContain(new Date().getUTCFullYear());
  });
});

describe("payouts and the pending balance", () => {
  it("counts only paid payouts toward the paid-out total", async () => {
    await sql`
      INSERT INTO instructor_payouts (instructor_id, amount, status, payment_method, created_at)
      VALUES (${ownerId}, 100, 'paid', 'UPI', now() - interval '10 days'),
             (${ownerId}, 500, 'pending', 'BANK', now() - interval '2 days'),
             (${ownerId}, 999, 'cancelled', 'BANK', now() - interval '1 day')`;
    expect(await getTotalPayoutsForInstructor(ownerId)).toBe(100);
    const rows = await getInstructorPayouts(ownerId);
    expect(rows).toHaveLength(3);
  });

  it("subtracts only the paid total from the balance", () => {
    expect(pendingBalance(1000, 100)).toBe(900);
    // Pending and cancelled payouts are listed but never reduce the balance.
    expect(pendingBalance(1000, 0)).toBe(1000);
  });

  it("never reports a negative balance", () => {
    expect(pendingBalance(100, 500)).toBe(0);
    expect(pendingBalance(0, 0)).toBe(0);
  });
});

describe("php formatting parity", () => {
  it("formats prices the way formatPrice(x, false) did", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(-5)).toBe("Free");
    expect(formatPrice(1234.5)).toBe("₹1,234.50");
  });

  it("keeps trailing zeros the way number_format did", () => {
    expect(phpNumber(4)).toBe("4");
    expect(phpNumber(4.3, 1)).toBe("4.3");
    expect(phpNumber(4, 1)).toBe("4.0");
    expect(phpNumber(1234567)).toBe("1,234,567");
  });

  it("drops the trailing .0 that PHP's round() string cast removed", () => {
    expect(phpRound(60, 1)).toBe("60");
    expect(phpRound(62.55, 1)).toBe("62.6");
    expect(phpRound(62.54, 1)).toBe("62.5");
    expect(phpRound(0, 1)).toBe("0");
  });

  it("rounds half away from zero like PHP", () => {
    expect(phpRound(2.5, 0)).toBe("3");
    expect(phpRound(-2.5, 0)).toBe("-3");
  });

  it("masks an email the way maskEmail did", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail("nope")).toBe("nope");
    expect(maskEmail("ab@gmail.com")).toBe("ab@gmail.com");
    expect(maskEmail("john.doe123@yahoo.com")).toBe("joh********@yahoo.com");
  });

  it("renders a 12-hour clock with an uppercase meridiem", () => {
    // 09:47 UTC is 15:17 in Asia/Kolkata (+05:30), which is the site's display timezone.
    expect(formatClock12PHPM("2026-02-14T09:47:00.000Z")).toBe("03:17 PM");
    expect(formatClock12PHPM("2026-02-14T02:15:00.000Z")).toBe("07:45 AM");
    expect(formatClock12PHPM(null)).toBe("");
  });
});