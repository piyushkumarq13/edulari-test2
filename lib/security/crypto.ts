import crypto from "node:crypto";

const ALG = "aes-256-gcm";

function keyBytes(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY ?? "";
  if (raw.length >= 32) return Buffer.from(raw.slice(0, 32), "utf8");
  // Allow base64 input too.
  const b64 = Buffer.from(raw, "base64");
  if (b64.length >= 32) return b64.slice(0, 32);
  throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes or base64 of 32 bytes");
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function isEncrypted(s: string | null | undefined): boolean {
  if (!s) return false;
  try {
    const b = Buffer.from(s, "base64");
    return b.length > 28;
  } catch {
    return false;
  }
}
