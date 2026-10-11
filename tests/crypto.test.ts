import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, isEncrypted } from "@/lib/security/crypto";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef"; // 32 chars
});

describe("aes-256-gcm", () => {
  it("encrypts and decrypts", () => {
    const enc = encrypt("sensitive-pan-123");
    expect(enc).not.toContain("sensitive");
    expect(isEncrypted(enc)).toBe(true);
    expect(decrypt(enc)).toBe("sensitive-pan-123");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("isEncrypted returns false for plain text / short / garbage", () => {
    expect(isEncrypted("hello")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });
});
