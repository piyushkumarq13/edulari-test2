import { describe, expect, it } from "vitest";

// Phase 9 admin write-rule parity. These are pure validations ported from the PHP admin pages;
// testing them guards the exact messages and thresholds that pages and API routes rely on.
import { PAYMENT_ID_RE } from "@/lib/api/admin/enrollments";
import { buildCta } from "@/lib/api/admin/banners";
import { checkFieldLimits, FIELD_LIMITS } from "@/lib/api/admin/settings";
import { stripTags, codePointLength } from "@/lib/api/admin/contact-submissions";
import { bugStatusConfig } from "@/lib/admin/bug-labels";

describe("admin verify_and_enroll payment id rule", () => {
  it("matches the PHP regex pay_[A-Za-z0-9]{14,}", () => {
    expect(PAYMENT_ID_RE.test("pay_pbQrXf3t9XsYv7KbNcWxE2oLm1")).toBe(true);
    expect(PAYMENT_ID_RE.test("pay_12345678901234")).toBe(true);
  });

  it("rejects anything that does not match", () => {
    expect(PAYMENT_ID_RE.test("")).toBe(false);
    expect(PAYMENT_ID_RE.test("pay_short")).toBe(false); // < 14 chars
    expect(PAYMENT_ID_RE.test("pay_has-dashes-1234567890")).toBe(false); // hyphen not allowed
    expect(PAYMENT_ID_RE.test("PAY_12345678901234")).toBe(false); // uppercase prefix not allowed
    expect(PAYMENT_ID_RE.test("order_12345678901234")).toBe(false);
    expect(PAYMENT_ID_RE.test("pay_123456789 01234")).toBe(false);
  });
});

describe("banner CTA pairing rule (private/functions/banners.php)", () => {
  it("returns a CTA only when both fields are present", () => {
    expect(buildCta("Enroll Now", "https://edulari.com/course/x")).toEqual({
      cta: { text: "Enroll Now", link: "https://edulari.com/course/x" },
      error: null,
    });
  });

  it("rejects a half-filled CTA with the exact PHP message", () => {
    expect(buildCta("Enroll Now", "").error).toBe("Both CTA text and link must be provided together.");
    expect(buildCta("", "https://edulari.com").error).toBe("Both CTA text and link must be provided together.");
  });

  it("no-op when both are empty", () => {
    expect(buildCta("", "")).toEqual({ cta: null, error: null });
  });
});

describe("settings $fieldLimits (saveSettings)", () => {
  it("enforces the exact per-field maxima", () => {
    const map = Object.fromEntries(FIELD_LIMITS);
    expect(map).toMatchObject({
      site_name: 100,
      site_url: 255,
      admin_email: 254,
      smtp_host: 253,
      smtp_user: 254,
      smtp_pass: 500,
      timezone: 60,
      currency_code: 10,
    });
  });

  it("flags an over-long value before the newline check", () => {
    const errors = checkFieldLimits({ site_name: "x".repeat(101) });
    expect(errors).toEqual([
      "Value for 'site_name' exceeds the maximum allowed length of 100 characters.",
    ]);
  });

  it("rejects newlines in any mapped field", () => {
    const errors = checkFieldLimits({ site_url: "https://x.com/\n.invalid" });
    expect(errors).toContain("Value for 'site_url' must not contain newline characters.");
  });

  it("ignores fields that were not posted", () => {
    expect(checkFieldLimits({})).toEqual([]);
  });
});

describe("contact reply message rules (contact-submission-detail.php)", () => {
  it("strip_tags removes markup but keeps text", () => {
    expect(stripTags('<p onclick="x">Hello <b>admin</b></p>')).toBe("Hello admin");
    expect(stripTags("<script>alert(1)</script>No tag")).toBe("alert(1)No tag");
  });

  it("length is measured in code points like PHP mb_strlen", () => {
    // A surrogate pair is two UTF-16 units but ONE code point — exactly what mb_strlen counts.
    expect(codePointLength("\u{1F600}abcd")).toBe(5);
    expect([..."\u{1F600}abcd"].length).toBe(5);
    // A combining mark is its own code point, so mb_strlen = 2, not grapheme-count 1.
    expect(codePointLength("e\u0301")).toBe(2);
  });

  it("the minimum stays 5 characters and the maximum 10,000", () => {
    expect(codePointLength("hi")).toBe(2);
    expect(codePointLength("h".repeat(5))).toBe(5);
    expect(codePointLength("x".repeat(10001))).toBe(10001);
  });
});

describe("bug detail status fallback", () => {
  it("falls back to the open badge for an unknown status", () => {
    expect(bugStatusConfig("banana")).toBe(bugStatusConfig("open"));
  });

  it("has config for every allowed status", () => {
    for (const s of ["open", "in_progress", "resolved", "wont_fix", "duplicate"]) {
      expect(bugStatusConfig(s).label).toBeTruthy();
    }
  });
});