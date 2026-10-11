import crypto from "node:crypto";

export const FLASH_COOKIE = "edulari_flash";
const FLASH_MAX_AGE = 60;

export type FlashType = "success" | "error" | "info";
export type Flash = { msg: string; type: FlashType };

function secret(): string {
  return process.env.SESSION_SECRET ?? "edulari-dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

/**
 * Port of the PHP one-shot `$_SESSION['flash']` mechanism used by cart.php and
 * wishlist.php.
 *
 * PHP stores the message in the session and unsets it on read. A serverless app has
 * no session store, so the flash travels in an httpOnly cookie that is HMAC-signed
 * with SESSION_SECRET: a client cannot forge or edit the message, and it is deleted
 * as soon as it is read.
 */
export function encodeFlash(flash: Flash): string {
  const payload = Buffer.from(JSON.stringify(flash), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeFlash(raw: string | undefined | null): Flash | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Flash;
    if (typeof parsed?.msg !== "string" || parsed.msg.length > 500) return null;
    const type: FlashType = parsed.type === "error" || parsed.type === "info" ? parsed.type : "success";
    return { msg: parsed.msg, type };
  } catch {
    return null;
  }
}

export function flashCookieOptions() {
  return {
    httpOnly: true as const,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: FLASH_MAX_AGE,
  };
}

/**
 * Messages a page may request by key (`?flash=<key>`) when it cannot write the
 * cookie itself — the App Router forbids cookie writes during a server render.
 * Only these server-defined strings exist, so the query parameter carries no
 * attacker-controlled text.
 */
export const PREDEFINED_FLASH: Record<string, Flash> = {
  no_paid_courses: { msg: "No paid courses in your cart.", type: "info" },
};
