import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";

const KNOWN_PHP_2Y = "$2y$10$ND5O7DbnPeAgZUrQOmHWO.IFwcxqm5C1luDkLn3YxVPkAfl5Z4Sam"; // bcrypt of "password123"

describe("passwords", () => {
  it("verifies a PHP $2y$ bcrypt hash", () => {
    expect(verifyPassword("password123", KNOWN_PHP_2Y)).toBe(true);
  });

  it("rejects the wrong password for a $2y$ hash", () => {
    expect(verifyPassword("not-the-password", KNOWN_PHP_2Y)).toBe(false);
  });

  it("hashPassword produces a verifiable hash", () => {
    const h = hashPassword("secret123");
    expect(verifyPassword("secret123", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("returns false for missing/garbage stored hash", () => {
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
