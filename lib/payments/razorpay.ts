import crypto from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
};

export class RazorpayError extends Error {
  constructor(message: string, readonly kind: "network" | "http" | "malformed") {
    super(message);
    this.name = "RazorpayError";
  }
}

function keySecret(): { id: string; secret: string } {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!id || !secret) throw new RazorpayError("Razorpay credentials are not configured", "malformed");
  return { id, secret };
}

function authHeader(): string {
  const { id, secret } = keySecret();
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/** POST /v1/orders — mirrors the curl block in create-order.php. */
export async function createRazorpayOrder(params: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
  timeoutMs?: number;
}): Promise<RazorpayOrder> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader() },
      body: JSON.stringify({
        amount: params.amountPaise,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
      }),
      signal: AbortSignal.timeout(params.timeoutMs ?? 30000),
      cache: "no-store",
    });
  } catch (err) {
    throw new RazorpayError(err instanceof Error ? err.message : "network error", "network");
  }

  if (!res.ok) {
    // The response body can contain the key id; never surface it to logs or clients.
    throw new RazorpayError(`Razorpay order creation failed with HTTP ${res.status}`, "http");
  }

  const body = (await res.json()) as RazorpayOrder;
  if (!body?.id) throw new RazorpayError("Razorpay returned an order without an id", "malformed");
  return body;
}

/**
 * GET /v1/orders/{id}/payments — port of fetchCapturedRazorpayPayment().
 *
 * Three distinct states the caller MUST handle separately:
 *   - object : a captured payment was found
 *   - false  : Razorpay was reached and confirms nothing was captured
 *   - null   : the call itself failed (unknown — never treat as "no payment")
 */
export async function fetchCapturedRazorpayPayment(orderId: string, timeoutMs = 15000): Promise<RazorpayPayment | false | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/payments`, {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    console.error(`[razorpay] payment lookup failed for an order (HTTP ${res.status})`);
    return null;
  }

  let data: { items?: RazorpayPayment[] };
  try {
    data = (await res.json()) as { items?: RazorpayPayment[] };
  } catch {
    return null;
  }

  for (const payment of data.items ?? []) {
    if (payment.status === "captured") return payment;
  }
  return false;
}

/** Length-checked, timing-safe string comparison (never throws on length mismatch). */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET). */
export function expectedCheckoutSignature(orderId: string, paymentId: string, secret = process.env.RAZORPAY_KEY_SECRET ?? ""): string {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!orderId || !paymentId || !signature) return false;
  return safeCompare(expectedCheckoutSignature(orderId, paymentId), signature);
}

/** Webhook signature: HMAC-SHA256(raw body, WEBHOOK_SECRET). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ""): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeCompare(expected, signature);
}
