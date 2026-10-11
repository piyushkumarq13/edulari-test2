import { describe, it, expect } from "vitest";
import { hashSessionToken, createSessionToken } from "@/lib/auth/sessions";

describe("session token hashing", () => {
  it("createSessionToken returns 64-char hex", () => {
    expect(createSessionToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashSessionToken is deterministic and never returns the raw token", () => {
    const raw = "abc123secret";
    const h = hashSessionToken(raw);
    expect(h).toBe(hashSessionToken(raw));
    expect(h).not.toBe(raw);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken("other")).not.toBe(h);
  });
});
