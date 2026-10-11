import { sql } from "@/lib/db/client";

/**
 * earnings.php credits the instructor 100 % of courses.price for every enrollment row.
 * There is no platform fee, no revenue-share constant, no paise conversion and no tax
 * deduction anywhere in the PHP, so nothing is subtracted here either.
 */
export type EarningsTotals = {
  total_earnings: number;
  this_month: number;
  this_year: number;
  total_students: number;
};

export async function getEarningsTotals(instructorId: number): Promise<EarningsTotals> {
  const [total, month, year, students] = await Promise.all([
    sql<{ total: string | null }[]>`
      SELECT SUM(c.price) AS total
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE c.instructor_id = ${instructorId}`,
    sql<{ total: string | null }[]>`
      SELECT SUM(c.price) AS total
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE c.instructor_id = ${instructorId}
        AND date_trunc('month', e.enrolled_at AT TIME ZONE 'Asia/Kolkata')
            = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')`,
    sql<{ total: string | null }[]>`
      SELECT SUM(c.price) AS total
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE c.instructor_id = ${instructorId}
        AND EXTRACT(YEAR FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata')
            = EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Kolkata')`,
    sql<{ total: string }[]>`
      SELECT COUNT(*)::text AS total
      FROM enrollments e JOIN courses c ON e.course_id = c.id
      WHERE c.instructor_id = ${instructorId}`,
  ]);
  return {
    total_earnings: Number(total[0]?.total ?? 0),
    this_month: Number(month[0]?.total ?? 0),
    this_year: Number(year[0]?.total ?? 0),
    total_students: Number(students[0]?.total ?? 0),
  };
}

export type MonthlyRow = { month: number; revenue: number; sales: number };

/** The twelve-month series the earnings chart plots. Months with no sales stay at 0. */
export async function getMonthlyEarnings(instructorId: number, year: number): Promise<MonthlyRow[]> {
  const rows = await sql<Array<{ month: string; revenue: string; sales: string }>>`
    SELECT EXTRACT(MONTH FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata')::text AS month,
           COALESCE(SUM(c.price), 0) AS revenue,
           COUNT(*)::text AS sales
    FROM enrollments e JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
      AND EXTRACT(YEAR FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata') = ${year}
    GROUP BY 1 ORDER BY 1 ASC
  `;
  const byMonth = new Map(rows.map((r) => [Number(r.month), r]));
  const out: MonthlyRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const row = byMonth.get(m);
    out.push({ month: m, revenue: Number(row?.revenue ?? 0), sales: Number(row?.sales ?? 0) });
  }
  return out;
}

export type TopCourseEarning = {
  title: string;
  price: number | string;
  enrollments: number;
  revenue: number;
};

/** The five highest-earning courses; revenue is summed over their enrollments. */
export async function getTopEarningCourses(instructorId: number): Promise<TopCourseEarning[]> {
  const rows = await sql<Array<{ title: string; price: string; enrollments: string; revenue: string }>>`
    SELECT c.title, c.price,
           COUNT(e.id)::text AS enrollments,
           COALESCE(SUM(c.price), 0) AS revenue
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
    GROUP BY c.id
    ORDER BY revenue DESC
    LIMIT 5
  `;
  return rows.map((r) => ({
    title: r.title,
    price: r.price,
    enrollments: Number(r.enrollments),
    revenue: Number(r.revenue),
  }));
}

export type SaleRow = {
  enrolled_at: Date;
  student_name: string;
  course_title: string;
  price: number | string;
};

/** The Sales Transactions table, scoped by year and optionally month (0 = all months). */
export async function getRecentSales(
  instructorId: number,
  year: number,
  month: number,
): Promise<SaleRow[]> {
  return sql<SaleRow[]>`
    SELECT e.enrolled_at, u.name AS student_name, c.title AS course_title, c.price
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
      AND EXTRACT(YEAR FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata') = ${year}
      ${month > 0
        ? sql`AND EXTRACT(MONTH FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata') = ${month}`
        : sql``}
    ORDER BY e.enrolled_at DESC
    LIMIT 50
  `;
}

/** The years that have at least one enrollment for this instructor, newest first. */
export async function getAvailableYears(instructorId: number): Promise<number[]> {
  const rows = await sql<Array<{ yr: string }>>`
    SELECT DISTINCT EXTRACT(YEAR FROM e.enrolled_at AT TIME ZONE 'Asia/Kolkata')::text AS yr
    FROM enrollments e JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
    ORDER BY yr DESC
  `;
  return rows.map((r) => Number(r.yr));
}

export type PayoutRow = {
  id: number;
  instructor_id: number;
  amount: number | string;
  currency: string | null;
  status: string;
  payment_method: string | null;
  reference_no: string | null;
  note: string | null;
  created_at: Date;
  paid_at: Date | null;
};

/** getInstructorPayouts($instructorId) — newest first. */
export async function getInstructorPayouts(instructorId: number): Promise<PayoutRow[]> {
  return sql<PayoutRow[]>`
    SELECT * FROM instructor_payouts
    WHERE instructor_id = ${instructorId}
    ORDER BY created_at DESC
  `;
}

/** getTotalPayoutsForInstructor($instructorId) — only rows already marked paid. */
export async function getTotalPayoutsForInstructor(instructorId: number): Promise<number> {
  const rows = await sql<{ total: string }[]>`
    SELECT COALESCE(SUM(amount), 0) AS total FROM instructor_payouts
    WHERE instructor_id = ${instructorId} AND status = 'paid'
  `;
  return Number(rows[0]?.total ?? 0);
}

/**
 * pendingBalance = max(0, earned - paidOut). Pending and cancelled payout rows are listed in
 * the history table but never counted as paid out, matching getTotalPayoutsForInstructor().
 */
export function pendingBalance(totalEarned: number, totalPaidOut: number): number {
  return Math.max(0, totalEarned - totalPaidOut);
}