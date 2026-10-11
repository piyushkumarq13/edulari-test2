import { describe, it, expect } from "vitest";
import { formatTimeRemaining, shouldBlockLogin, shouldBlockRegistration, shouldLimitPasswordReset } from "@/lib/security/rate-limit";

describe("rate-limit thresholds", () => {
  it("blocks login only at >=5 failed attempts", () => {
    expect(shouldBlockLogin(4)).toBe(false);
    expect(shouldBlockLogin(5)).toBe(true);
    expect(shouldBlockLogin(7)).toBe(true);
  });

  it("blocks registration only when >=5 attempts occur within 24h", () => {
    const now = Date.now();
    const within = now - 1000 * 60 * 60; // 1h ago
    const outside = now - 25 * 60 * 60 * 1000; // 25h ago
    expect(shouldBlockRegistration(5, within, now)).toBe(true);
    expect(shouldBlockRegistration(4, within, now)).toBe(false);
    expect(shouldBlockRegistration(5, outside, now)).toBe(false);
  });

  it("limits password reset at >=3 attempts", () => {
    expect(shouldLimitPasswordReset(2)).toBe(false);
    expect(shouldLimitPasswordReset(3)).toBe(true);
  });

  it("formats remaining time", () => {
    expect(formatTimeRemaining(65)).toBe("1 minute 5 seconds");
    expect(formatTimeRemaining(3700)).toBe("1 hour 1 minute");
    expect(formatTimeRemaining(5)).toBe("5 seconds");
  });
});
