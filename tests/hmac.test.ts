import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyHmacSha256 } from "@/lib/security/hmac";

describe("hmac verify", () => {
  const secret = "topsecret";
  const body = "order_id|payment_id";
  const good = crypto.createHmac("sha256", secret).update(body).digest("hex");

  it("accepts the correct signature", () => {
    expect(verifyHmacSha256(body, good, secret)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(verifyHmacSha256(body, good.slice(0, -2) + "ff", secret)).toBe(false);
    expect(verifyHmacSha256(body + "x", good, secret)).toBe(false);
    expect(verifyHmacSha256(body, "", secret)).toBe(false);
    expect(verifyHmacSha256(body, good, "wrong")).toBe(false);
  });
});
