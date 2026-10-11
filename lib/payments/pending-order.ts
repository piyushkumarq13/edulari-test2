import crypto from "node:crypto";

/**
 * Serverless stand-in for the two `$_SESSION` entries create-order.php writes and
 * verify-payment.php requires (`razorpay_order_id`, `razorpay_amount`).
 *
 * The PHP code rejects any order id that does not match the value stored in the
 * session. The port keeps that binding with an HMAC-signed, httpOnly cookie holding
 * `orderId:amountPaise`, so a tampered, stale or foreign value fails the same way.
 */
export const PENDING_ORDER_COOKIE = "edulari_pending_order";
const PENDING_ORDER_MAX_AGE = 30 * 60;

function secret(): string {
  return process.env.SESSION_SECRET ?? "edulari-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

export type PendingOrder = { orderId: string; amountPaise: number };

export function encodePendingOrder(order: PendingOrder): string {
  const payload = Buffer.from(JSON.stringify(order), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodePendingOrder(raw: string | undefined | null): PendingOrder | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  const a = Buffer.from(mac);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingOrder;
    if (typeof parsed?.orderId !== "string" || !/^order_[A-Za-z0-9]+$/.test(parsed.orderId)) return null;
    if (!Number.isInteger(parsed.amountPaise) || parsed.amountPaise <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function pendingOrderCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: PENDING_ORDER_MAX_AGE,
  };
}
