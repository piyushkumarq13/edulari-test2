import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  expectedCheckoutSignature,
  safeCompare,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  createRazorpayOrder,
  fetchCapturedRazorpayPayment,
  RazorpayError,
} from "@/lib/payments/razorpay";

const KEY_ID = "rzp_test_key_id";
const KEY_SECRET = "rzp_test_key_secret";
const WEBHOOK_SECRET = "whsec_test_secret";

describe("razorpay signature verification", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("computes the documented checkout HMAC", () => {
    const expected = crypto.createHmac("sha256", KEY_SECRET).update("order_ABC|pay_XYZ").digest("hex");
    expect(expectedCheckoutSignature("order_ABC", "pay_XYZ")).toBe(expected);
  });

  it("accepts a valid checkout signature", () => {
    const sig = expectedCheckoutSignature("order_ABC", "pay_XYZ");
    expect(verifyCheckoutSignature("order_ABC", "pay_XYZ", sig)).toBe(true);
  });

  it("rejects a signature made for a different order id", () => {
    const sig = expectedCheckoutSignature("order_ABC", "pay_XYZ");
    expect(verifyCheckoutSignature("order_TAMPERED", "pay_XYZ", sig)).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const bad = crypto.createHmac("sha256", "wrong_secret").update("order_ABC|pay_XYZ").digest("hex");
    expect(verifyCheckoutSignature("order_ABC", "pay_XYZ", bad)).toBe(false);
  });

  it("rejects empty or malformed inputs", () => {
    expect(verifyCheckoutSignature("", "pay_XYZ", "abc")).toBe(false);
    expect(verifyCheckoutSignature("order_ABC", "", "abc")).toBe(false);
    expect(verifyCheckoutSignature("order_ABC", "pay_XYZ", "")).toBe(false);
  });

  it("does not throw on a length mismatch (timing-safe guard)", () => {
    expect(safeCompare("short", "much_longer_value")).toBe(false);
    expect(safeCompare("same_length_x", "same_length_x")).toBe(true);
  });

  it("verifies the webhook HMAC over the RAW body only", () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
    const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");

    expect(verifyWebhookSignature(raw, sig)).toBe(true);

    // Any byte-level difference (whitespace, key order) must invalidate the signature:
    // this is why the route reads req.text() before JSON.parse().
    const reSpaced = raw.replace("{", "{ ");
    expect(verifyWebhookSignature(reSpaced, sig)).toBe(false);
  });

  it("rejects a webhook signature when the secret is not configured", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const raw = "{}";
    const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
    expect(verifyWebhookSignature(raw, sig)).toBe(false);
  });
});

describe("razorpay order creation", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  });

  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("throws a malformed error when credentials are missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    await expect(
      createRazorpayOrder({ amountPaise: 100, currency: "INR", receipt: "rcpt", notes: {} }),
    ).rejects.toBeInstanceOf(RazorpayError);
  });

  it("sends the server-computed paise amount and returns the order id", async () => {
    let seen: { url?: string; body?: Record<string, unknown>; auth?: string } = {};
    (globalThis as { fetch?: unknown }).fetch = async (url: string, init: RequestInit) => {
      seen = { url, body: JSON.parse(init.body as string), auth: (init.headers as Record<string, string>).Authorization };
      return new Response(JSON.stringify({ id: "order_TEST", amount: 12345, currency: "INR" }), { status: 200 });
    };

    const order = await createRazorpayOrder({ amountPaise: 12345, currency: "INR", receipt: "rcpt_1", notes: { student_id: "7" } });

    expect(order.id).toBe("order_TEST");
    expect(seen.url).toBe("https://api.razorpay.com/v1/orders");
    expect(seen.body?.amount).toBe(12345);
    expect(seen.body?.receipt).toBe("rcpt_1");
    // Basic auth must be base64(KEY_ID:KEY_SECRET).
    expect(seen.auth).toBe(`Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`);
  });

  it("reports a network failure distinctly from an HTTP failure", async () => {
    (globalThis as { fetch?: unknown }).fetch = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(
      createRazorpayOrder({ amountPaise: 100, currency: "INR", receipt: "r", notes: {} }),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("fails when Razorpay answers non-200", async () => {
    (globalThis as { fetch?: unknown }).fetch = async () => new Response("nope", { status: 500 });
    await expect(
      createRazorpayOrder({ amountPaise: 100, currency: "INR", receipt: "r", notes: {} }),
    ).rejects.toMatchObject({ kind: "http" });
  });

  it("fails when the response has no order id", async () => {
    (globalThis as { fetch?: unknown }).fetch = async () => new Response(JSON.stringify({}), { status: 200 });
    await expect(
      createRazorpayOrder({ amountPaise: 100, currency: "INR", receipt: "r", notes: {} }),
    ).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("fetchCapturedRazorpayPayment", () => {
  afterEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("returns the captured payment when one exists", async () => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    (globalThis as { fetch?: unknown }).fetch = async () =>
      new Response(
        JSON.stringify({
          items: [
            { id: "pay_a", order_id: "order_1", amount: 100, currency: "INR", status: "authorized" },
            { id: "pay_b", order_id: "order_1", amount: 100, currency: "INR", status: "captured" },
          ],
        }),
        { status: 200 },
      );

    const payment = await fetchCapturedRazorpayPayment("order_1");
    expect(payment && typeof payment === "object" ? payment.id : null).toBe("pay_b");
  });

  it("returns false when Razorpay confirms nothing was captured", async () => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    (globalThis as { fetch?: unknown }).fetch = async () =>
      new Response(JSON.stringify({ items: [{ id: "pay_a", order_id: "order_1", amount: 100, currency: "INR", status: "failed" }] }), {
        status: 200,
      });

    expect(await fetchCapturedRazorpayPayment("order_1")).toBe(false);
  });

  it("returns null when the API call itself fails (unknown, never 'unpaid')", async () => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    (globalThis as { fetch?: unknown }).fetch = async () => {
      throw new Error("socket hang up");
    };
    expect(await fetchCapturedRazorpayPayment("order_1")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    process.env.RAZORPAY_KEY_ID = KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    (globalThis as { fetch?: unknown }).fetch = async () => new Response("err", { status: 502 });
    expect(await fetchCapturedRazorpayPayment("order_1")).toBeNull();
  });
});
