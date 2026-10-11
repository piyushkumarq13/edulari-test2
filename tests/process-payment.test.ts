import { describe, it, expect, vi } from "vitest";
import { processCapturedPayment, type EnrollmentOps } from "@/lib/payments/capture";
import { sanitizeIp } from "@/lib/db/commerce";

const ORDER_ID = "order_TEST123";
const PAYMENT_ID = "pay_TEST123";
const STUDENT_ID = 42;
const AMOUNT = 100000;

const COURSES = [
  { course_id: 1, title: "Course A", price: 500 },
  { course_id: 2, title: "Course B", price: 500 },
];

function makeOps(enrolled = new Set<number>()): EnrollmentOps & { enrolled: number[]; removed: [number, number][] } {
  const enrolledIds = new Set(enrolled);
  const ops = {
    enrolled: [] as number[],
    removed: [] as [number, number][],
    async isEnrolled(_studentId: number, courseId: number) {
      return enrolledIds.has(courseId);
    },
    async enroll(_studentId: number, courseId: number) {
      ops.enrolled.push(courseId);
      enrolledIds.add(courseId);
      return { success: true };
    },
    async removeFromCart(_studentId: number, courseId: number) {
      ops.removed.push([_studentId, courseId]);
    },
  };
  return ops;
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    record: vi.fn(async () => 7),
    updatePurchase: vi.fn(async () => true),
    updateOrder: vi.fn(async () => true),
    findByPaymentId: vi.fn(async () => null as { id: number; status: string; enrolled_count: number } | null),
    transaction: async <T,>(fn: (t: unknown) => Promise<T>) => fn(null),
    ...overrides,
  } as never;
}

describe("processCapturedPayment idempotency", () => {
  it("records the purchase, enrolls every course and removes them from the cart", async () => {
    const ops = makeOps();
    const d = deps();

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "1.2.3.4", ops, d);

    expect(result).toEqual({ success: true, already_processed: false, enrolled_count: 2 });
    expect(ops.enrolled).toEqual([1, 2]);
    expect(ops.removed).toEqual([
      [STUDENT_ID, 1],
      [STUDENT_ID, 2],
    ]);
  });

  it("is idempotent: a second call for the same payment does nothing", async () => {
    const ops = makeOps();
    const d = deps({
      findByPaymentId: vi.fn(async () => ({ id: 7, status: "enrolled", enrolled_count: 2 })),
    });

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "", ops, d);

    expect(result).toEqual({ success: true, already_processed: true, enrolled_count: 2 });
    expect(ops.enrolled).toEqual([]);
  });

  it("skips courses the student already owns but still clears them from the cart", async () => {
    const ops = makeOps(new Set([1]));
    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "", ops, deps());

    expect(result.enrolled_count).toBe(1);
    expect(ops.enrolled).toEqual([2]);
    expect(ops.removed).toHaveLength(2);
  });

  it("re-reads the purchase when a concurrent layer inserted it first (webhook + client race)", async () => {
    const ops = makeOps();
    let reads = 0;
    const d = deps({
      // INSERT returned no id (unique violation on razorpay_payment_id) -> race lost.
      record: vi.fn(async () => null),
      findByPaymentId: vi.fn(async () => {
        reads += 1;
        return reads === 1 ? null : { id: 9, status: "paid", enrolled_count: 0 };
      }),
    });

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "", ops, d);

    expect(result.success).toBe(true);
    expect(result.already_processed).toBe(false);
    expect(ops.enrolled).toEqual([1, 2]);
  });

  it("marks the order and purchase as enrollment_failed when the transaction throws", async () => {
    const ops = makeOps();
    const updateOrder = vi.fn(async () => true);
    const updatePurchase = vi.fn(async () => true);
    const d = deps({
      transaction: async () => {
        throw new Error("deadlock detected");
      },
      updateOrder,
      updatePurchase,
    });

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "", ops, d);

    expect(result.success).toBe(false);
    expect(result.enrolled_count).toBe(0);
    expect(updatePurchase).toHaveBeenCalledWith(7, "enrollment_failed", 0);
    expect(updateOrder).toHaveBeenCalledWith(ORDER_ID, "enrollment_failed");
  });

  it("treats an ALREADY_ENROLLED error as success (idempotent re-enrollment)", async () => {
    const ops: EnrollmentOps = {
      isEnrolled: async () => false,
      enroll: async () => ({ success: false, message: "Already enrolled in this course" }),
      removeFromCart: async () => {},
    };

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, [COURSES[0]!], "", ops, deps());
    expect(result.success).toBe(true);
  });

  it("rolls back enrollment (no order status change to enrolled) on a genuine failure", async () => {
    const ops: EnrollmentOps = {
      isEnrolled: async () => false,
      enroll: async () => ({ success: false, message: "FK violation" }),
      removeFromCart: async () => {},
    };
    const updateOrder = vi.fn(async () => true);

    const result = await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, [COURSES[0]!], "", ops, deps({ updateOrder }));

    expect(result.success).toBe(false);
    expect(updateOrder).not.toHaveBeenCalledWith(ORDER_ID, "enrolled");
    expect(updateOrder).toHaveBeenCalledWith(ORDER_ID, "enrollment_failed");
  });

  it("ignores entries with an invalid course id", async () => {
    const ops = makeOps();
    const result = await processCapturedPayment(
      STUDENT_ID,
      ORDER_ID,
      PAYMENT_ID,
      AMOUNT,
      [{ course_id: 0, title: "bad", price: 10 }],
      "",
      ops,
      deps(),
    );

    expect(result.success).toBe(true);
    expect(ops.enrolled).toEqual([]);
  });

  it("passes the raw client IP through to recordPurchase (which sanitises it)", async () => {
    const ops = makeOps();
    const record = vi.fn(async (params: { ipAddress?: string }) => { void params; return 7; });
    await processCapturedPayment(STUDENT_ID, ORDER_ID, PAYMENT_ID, AMOUNT, COURSES, "1.2.3.4, 5.6.7.8", ops, deps({ record }));
    expect((record.mock.calls[0] as [{ ipAddress: string }])[0]).toMatchObject({ ipAddress: "1.2.3.4, 5.6.7.8" });
  });
});

describe("sanitizeIp", () => {
  it("keeps the first address from an X-Forwarded-For chain", () => {
    expect(sanitizeIp("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
  });

  it("rejects values that are not IPs (no injection into the inet column)", () => {
    expect(sanitizeIp("not-an-ip")).toBeNull();
    expect(sanitizeIp("999.1.1.1")).toBeNull();
    expect(sanitizeIp("1.2.3.4; DROP TABLE users")).toBeNull();
    expect(sanitizeIp("")).toBeNull();
    expect(sanitizeIp(undefined)).toBeNull();
  });

  it("accepts a plain IPv4 and a compressed IPv6", () => {
    expect(sanitizeIp("192.168.1.1")).toBe("192.168.1.1");
    expect(sanitizeIp("2001:db8::1")).toBe("2001:db8::1");
  });
});
