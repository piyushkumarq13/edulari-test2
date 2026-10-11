import { sql, withTransaction } from "@/lib/db/client";

export type OrderStatus = "created" | "enrolled" | "enrollment_failed" | "abandoned" | "failed" | "cancelled";
export type PurchaseStatus = "paid" | "enrollment_failed" | "enrolled" | "refunded";

export const ORDER_STATUSES: OrderStatus[] = ["created", "enrolled", "enrollment_failed", "abandoned", "failed", "cancelled"];
export const PURCHASE_STATUSES: PurchaseStatus[] = ["paid", "enrollment_failed", "enrolled", "refunded"];

export type CourseSnapshot = { course_id: number; title: string; price: number };

export type OrderRow = {
  id: number;
  student_id: number;
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  courses_json: string;
  status: OrderStatus;
  failure_reason: string | null;
  created_at: Date;
};

export type PurchaseRow = {
  id: number;
  student_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  currency: string;
  status: PurchaseStatus;
  enrolled_count: number;
  courses_json: string;
  ip_address: string | null;
  created_at: Date;
};

/** Port of getCart() — cart.*, c.* plus category and instructor names, published only. */
export type CartItem = {
  course_id: number;
  id: number;
  slug: string;
  title: string;
  thumbnail: string | null;
  level: string;
  price: number;
  short_description: string | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number;
  lesson_count: number;
  category_name: string | null;
  instructor_name: string | null;
};

export async function getCart(studentId: number): Promise<CartItem[]> {
  return sql<CartItem[]>`
    SELECT cart.course_id AS course_id, c.id AS id, c.slug AS slug, c.title AS title,
           c.thumbnail AS thumbnail, c.level AS level, c.price AS price,
           c.short_description AS short_description, c.description AS description,
           (SELECT AVG(rating) FROM course_reviews cr WHERE cr.course_id = c.id) AS avg_rating,
           (SELECT COUNT(*) FROM course_reviews cr WHERE cr.course_id = c.id)::int AS review_count,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id)::int AS lesson_count,
           cat.name AS category_name, u.name AS instructor_name
    FROM cart
    JOIN courses c ON cart.course_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE cart.student_id = ${studentId} AND c.is_published = true
    ORDER BY cart.added_at DESC
  `;
}

/** Port of getWishlist() — same shape as getCart(), published only, newest first. */
export async function getWishlist(studentId: number): Promise<CartItem[]> {
  return sql<CartItem[]>`
    SELECT w.course_id AS course_id, c.id AS id, c.slug AS slug, c.title AS title,
           c.thumbnail AS thumbnail, c.level AS level, c.price AS price,
           c.short_description AS short_description, c.description AS description,
           (SELECT AVG(rating) FROM course_reviews cr WHERE cr.course_id = c.id) AS avg_rating,
           (SELECT COUNT(*) FROM course_reviews cr WHERE cr.course_id = c.id)::int AS review_count,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id)::int AS lesson_count,
           cat.name AS category_name, u.name AS instructor_name
    FROM wishlists w
    JOIN courses c ON w.course_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE w.student_id = ${studentId} AND c.is_published = true
    ORDER BY w.created_at DESC
  `;
}

/** Port of getStudentStats() — the four counters the navbar and cart/wishlist use. */
export async function getStudentStats(studentId: number) {
  const rows = await sql<{
    total_courses: number; completed_courses: number;
    wishlist_count: number; cart_count: number; total_spent: string;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM enrollments WHERE student_id = ${studentId}) AS total_courses,
      (SELECT COUNT(*)::int FROM enrollments WHERE student_id = ${studentId} AND completed_at IS NOT NULL) AS completed_courses,
      (SELECT COUNT(*)::int FROM wishlists WHERE student_id = ${studentId}) AS wishlist_count,
      (SELECT COUNT(*)::int FROM cart WHERE student_id = ${studentId}) AS cart_count,
      (SELECT COALESCE(SUM(c.price), 0) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ${studentId}) AS total_spent
  `;
  return rows[0] ?? { total_courses: 0, completed_courses: 0, wishlist_count: 0, cart_count: 0, total_spent: "0" };
}

export async function getCartCourseIds(studentId: number): Promise<number[]> {
  const rows = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${studentId}`;
  return rows.map((r) => r.course_id);
}

export async function getWishlistCourseIds(studentId: number): Promise<number[]> {
  const rows = await sql<{ course_id: number }[]>`SELECT course_id FROM wishlists WHERE student_id = ${studentId}`;
  return rows.map((r) => r.course_id);
}

export async function getEnrolledCourseIds(studentId: number): Promise<number[]> {
  const rows = await sql<{ course_id: number }[]>`SELECT course_id FROM enrollments WHERE student_id = ${studentId}`;
  return rows.map((r) => r.course_id);
}

export async function getCoursePrice(courseId: number): Promise<number | null> {
  const rows = await sql<{ price: number }[]>`SELECT price FROM courses WHERE id = ${courseId}`;
  return rows.length ? Number(rows[0].price) : null;
}

/** Course id -> slug map so purchase history can render clickable course links. */
export async function getCourseSlugs(courseIds: number[]): Promise<Record<number, string>> {
  if (!courseIds.length) return {};
  const rows = await sql<{ id: number; slug: string }[]>`
    SELECT id, slug FROM courses WHERE id IN ${sql(courseIds)}
  `;
  return Object.fromEntries(rows.map((r) => [Number(r.id), r.slug]));
}

export async function insertRazorpayOrder(params: {
  studentId: number;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  courses: CourseSnapshot[];
}): Promise<number | null> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO razorpay_orders (student_id, razorpay_order_id, amount_paise, currency, courses_json)
    VALUES (${params.studentId}, ${params.razorpayOrderId}, ${params.amountPaise}, ${params.currency}, ${JSON.stringify(params.courses)}::text)
    ON CONFLICT (razorpay_order_id) DO NOTHING
    RETURNING id
  `;
  return rows.length ? rows[0].id : null;
}

export async function getOrderByRazorpayId(razorpayOrderId: string): Promise<OrderRow | null> {
  const rows = await sql<OrderRow[]>`
    SELECT id, student_id, razorpay_order_id, amount_paise, currency, courses_json, status, failure_reason, created_at
    FROM razorpay_orders WHERE razorpay_order_id = ${razorpayOrderId}
  `;
  return rows.length ? rows[0] : null;
}

export async function getOrderOwnedBy(razorpayOrderId: string, studentId: number): Promise<OrderRow | null> {
  const rows = await sql<OrderRow[]>`
    SELECT id, student_id, razorpay_order_id, amount_paise, currency, courses_json, status, failure_reason, created_at
    FROM razorpay_orders WHERE razorpay_order_id = ${razorpayOrderId} AND student_id = ${studentId}
  `;
  return rows.length ? rows[0] : null;
}

/**
 * Port of updateRazorpayOrderStatus().
 *
 * `cancelled` / `failed` are reported by the browser and can race the server-side
 * capture flow, so they are only applied while the row is still `created`. Every other
 * status is unconditional.
 */
export async function updateRazorpayOrderStatus(
  razorpayOrderId: string,
  status: OrderStatus,
  reason: string | null = null,
): Promise<boolean> {
  if (!ORDER_STATUSES.includes(status)) return false;

  if (status === "cancelled" || status === "failed") {
    const res = await sql`
      UPDATE razorpay_orders SET status = ${status}, failure_reason = ${reason}
      WHERE razorpay_order_id = ${razorpayOrderId} AND status = 'created'
    `;
    return res.count > 0;
  }

  const res = await sql`
    UPDATE razorpay_orders SET status = ${status} WHERE razorpay_order_id = ${razorpayOrderId}
  `;
  return res.count > 0;
}

export function sanitizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const candidate = raw.split(",")[0]!.trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(candidate);
  if (v4 && v4.slice(1).every((p) => Number(p) <= 255)) return candidate;
  // Basic IPv6 sanity (hex groups, optional :: compression).
  if (/^([0-9a-f]{1,4}:){1,7}(:?[0-9a-f]{1,4}){0,7}$|^::$/.test(candidate.toLowerCase())) return candidate;
  return null;
}

/** Port of recordPurchase() — INSERT IGNORE on razorpay_payment_id. */
export async function recordPurchase(params: {
  studentId: number;
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  courses: CourseSnapshot[];
  ipAddress?: string;
}): Promise<number | null> {
  const ip = sanitizeIp(params.ipAddress);
  const rows = await sql<{ id: number }[]>`
    INSERT INTO purchase_history
      (student_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency, status, courses_json, ip_address)
    VALUES (${params.studentId}, ${params.orderId}, ${params.paymentId}, ${params.amountPaise}, ${params.currency}, 'paid', ${JSON.stringify(params.courses)}::text, ${ip})
    ON CONFLICT (razorpay_payment_id) DO NOTHING
    RETURNING id
  `;
  return rows.length ? rows[0].id : null;
}

/** Port of updatePurchaseStatus(). */
export async function updatePurchaseStatus(purchaseId: number, status: PurchaseStatus, enrolledCount: number): Promise<boolean> {
  if (!PURCHASE_STATUSES.includes(status)) return false;
  const res = await sql`
    UPDATE purchase_history SET status = ${status}, enrolled_count = ${enrolledCount} WHERE id = ${purchaseId}
  `;
  return res.count > 0;
}

export async function getPurchaseByPaymentId(paymentId: string): Promise<Pick<PurchaseRow, "id" | "status" | "enrolled_count" | "student_id" | "razorpay_order_id"> | null> {
  const rows = await sql<Pick<PurchaseRow, "id" | "status" | "enrolled_count" | "student_id" | "razorpay_order_id">[]>`
    SELECT id, status, enrolled_count, student_id, razorpay_order_id
    FROM purchase_history WHERE razorpay_payment_id = ${paymentId}
  `;
  return rows.length ? rows[0] : null;
}

export async function getPurchaseByOrderIdForStudent(orderId: string, studentId: number): Promise<PurchaseRow | null> {
  const rows = await sql<PurchaseRow[]>`
    SELECT id, student_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency,
           status, enrolled_count, courses_json, ip_address, created_at
    FROM purchase_history WHERE razorpay_order_id = ${orderId} AND student_id = ${studentId}
  `;
  return rows.length ? rows[0] : null;
}

/** Port of getPurchaseReceiptData() — ownership checked, enrolled/refunded only. */
export async function getPurchaseReceiptData(orderId: string, studentId: number): Promise<PurchaseRow | null> {
  const row = await getPurchaseByOrderIdForStudent(orderId, studentId);
  if (!row) return null;
  if (row.status !== "enrolled" && row.status !== "refunded") return null;
  return row;
}

export type MergedPurchase = {
  id: string | number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  enrolled_count: number;
  courses: CourseSnapshot[];
  courses_json: string;
  created_at: Date;
  failure_reason: string | null;
};

/**
 * Port of getStudentPurchaseHistoryAll(): purchase_history UNION ALL the
 * razorpay_orders rows still in a non-final state, so a student sees an order before
 * Layer 2/3 confirms it.
 */
export async function getStudentPurchaseHistoryAll(studentId: number): Promise<MergedPurchase[]> {
  const rows = await sql<Omit<MergedPurchase, "courses">[]>`
    SELECT id::text AS id, razorpay_order_id, razorpay_payment_id,
           amount_paise, currency, status, enrolled_count, courses_json, created_at,
           NULL::varchar AS failure_reason
    FROM purchase_history
    WHERE student_id = ${studentId}

    UNION ALL

    SELECT 'pending-' || ro.id::text AS id, ro.razorpay_order_id, '' AS razorpay_payment_id,
           ro.amount_paise, ro.currency,
           (CASE WHEN ro.status = 'created' THEN 'pending' ELSE ro.status END) AS status,
           0 AS enrolled_count, ro.courses_json, ro.created_at, ro.failure_reason
    FROM razorpay_orders ro
    WHERE ro.student_id = ${studentId}
      AND ro.status IN ('created', 'abandoned', 'failed', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM purchase_history ph WHERE ph.razorpay_order_id = ro.razorpay_order_id
      )

    ORDER BY created_at DESC
  `;

  return rows.map((r) => ({
    ...r,
    id: /^\d+$/.test(String(r.id)) ? Number(r.id) : String(r.id),
    courses: parseCourses(r.courses_json),
  }));
}

/** Port of getStudentPurchaseTotalCount() — counts the same combined set. */
export async function getStudentPurchaseTotalCount(studentId: number): Promise<number> {
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM (
      SELECT id FROM purchase_history WHERE student_id = ${studentId}
      UNION ALL
      SELECT ro.id FROM razorpay_orders ro
      WHERE ro.student_id = ${studentId}
        AND ro.status IN ('created', 'abandoned', 'failed', 'cancelled')
        AND NOT EXISTS (SELECT 1 FROM purchase_history ph WHERE ph.razorpay_order_id = ro.razorpay_order_id)
    ) combined
  `;
  return rows[0]?.c ?? 0;
}

export type PurchaseHistoryStats = { totalSpent: number; enrolledCount: number; failedCount: number };

export async function getPurchaseHistoryStats(studentId: number): Promise<PurchaseHistoryStats> {
  const rows = await sql<{ total_spent: string; enrolled_count: number; failed_count: number; abandoned_count: number }[]>`
    SELECT
      (SELECT COALESCE(SUM(amount_paise), 0) FROM purchase_history WHERE student_id = ${studentId} AND status <> 'refunded') AS total_spent,
      (SELECT COUNT(*)::int FROM purchase_history WHERE student_id = ${studentId} AND status = 'enrolled') AS enrolled_count,
      (SELECT COUNT(*)::int FROM purchase_history WHERE student_id = ${studentId} AND status = 'enrollment_failed') AS failed_count,
      (SELECT COUNT(*)::int FROM razorpay_orders ro
        WHERE ro.student_id = ${studentId} AND ro.status = 'abandoned'
          AND NOT EXISTS (SELECT 1 FROM purchase_history ph WHERE ph.razorpay_order_id = ro.razorpay_order_id)) AS abandoned_count
  `;
  const r = rows[0];
  return {
    totalSpent: Number(r?.total_spent ?? 0) / 100,
    enrolledCount: r?.enrolled_count ?? 0,
    failedCount: (r?.failed_count ?? 0) + (r?.abandoned_count ?? 0),
  };
}

export function parseCourses(json: string | null | undefined): CourseSnapshot[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as CourseSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Runs `fn` inside a transaction; used by processCapturedPayment(). */
export { withTransaction };
