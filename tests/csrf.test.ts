import { describe, it, expect } from "vitest";
import { issueCsrfToken, verifyCsrfToken, originMatchesHost } from "@/lib/security/csrf";

describe("csrf", () => {
  it("issues a 64-char hex token and verifies it", () => {
    const t = issueCsrfToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCsrfToken(t, t)).toBe(true);
    expect(verifyCsrfToken(t, "deadbeef")).toBe(false);
    expect(verifyCsrfToken(undefined, t)).toBe(false);
    expect(verifyCsrfToken(t, undefined)).toBe(false);
  });

  it("originMatchesHost", () => {
    expect(originMatchesHost("https://edulari.example.com", "edulari.example.com")).toBe(true);
    expect(originMatchesHost("https://evil.com", "edulari.example.com")).toBe(false);
    expect(originMatchesHost(null, "edulari.example.com")).toBe(false);
    expect(originMatchesHost("not-a-url", "edulari.example.com")).toBe(false);
  });
});
