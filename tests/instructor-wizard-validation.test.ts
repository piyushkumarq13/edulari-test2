import { describe, it, expect } from "vitest";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  PAN_RE,
  IFSC_RE,
} from "@/lib/instructor/wizard";

/**
 * Server-side validation rules for the wizard steps. Every rule mirrors a check in the
 * PHP step files (step-1.php … step-5.php); the messages are the PHP messages so the UI
 * stays identical.
 */

describe("step 1 — account", () => {
  const base = { name: "Asha Rao", email: "asha@example.com", password: "secret12", confirm_password: "secret12" };

  it("accepts a valid submission", () => {
    expect(step1Schema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const r = step1Schema.safeParse({ ...base, email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Please enter a valid email address.");
  });

  it("rejects mismatched passwords", () => {
    const r = step1Schema.safeParse({ ...base, confirm_password: "different12" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Passwords do not match.");
  });

  it("requires at least 8 characters", () => {
    const r = step1Schema.safeParse({ ...base, password: "a1b2c3d", confirm_password: "a1b2c3d" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Password must be at least 8 characters long.");
  });

  it("requires at least one digit", () => {
    const r = step1Schema.safeParse({ ...base, password: "abcdefgh", confirm_password: "abcdefgh" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Password must contain at least one number.");
  });

  it("requires at least one letter", () => {
    const r = step1Schema.safeParse({ ...base, password: "12345678", confirm_password: "12345678" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Password must contain at least one letter.");
  });
});

describe("step 2 — profile", () => {
  const base = {
    headline: "Senior Web Developer",
    bio: "x".repeat(120),
    website: "",
    linkedin: "",
    twitter: "",
    years_exp: "3",
    teaching_style: "Mixed",
  };

  it("accepts a valid submission", () => {
    expect(step2Schema.safeParse(base).success).toBe(true);
  });

  it("requires the headline and bio", () => {
    const r = step2Schema.safeParse({ ...base, headline: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Professional headline and bio are required.");
  });

  it("caps the headline at 120 characters", () => {
    const r = step2Schema.safeParse({ ...base, headline: "y".repeat(121) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Headline must be 120 characters or fewer.");
  });

  it("requires a bio of at least 100 characters", () => {
    const r = step2Schema.safeParse({ ...base, bio: "z".repeat(99) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Bio must be at least 100 characters.");
  });
});

describe("step 3 — credentials", () => {
  const base = {
    highest_education: "Master's Degree",
    institution: "IIT Delhi",
    field_of_study: "Computer Science",
    graduation_year: "2015",
    certifications: "",
    professional_exp: "Ten years building web products.",
    notable_works: "",
  };

  it("accepts a valid submission", () => {
    expect(step3Schema.safeParse(base).success).toBe(true);
  });

  it("requires degree, institution and field of study", () => {
    const r = step3Schema.safeParse({ ...base, institution: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Education details (degree, institution, field of study) are required.");
  });

  it("requires professional experience", () => {
    const r = step3Schema.safeParse({ ...base, professional_exp: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Please describe your professional experience.");
  });

  it("rejects a graduation year outside 1960..current", () => {
    expect(step3Schema.safeParse({ ...base, graduation_year: "1959" }).success).toBe(false);
    const nextYear = String(new Date().getFullYear() + 1);
    expect(step3Schema.safeParse({ ...base, graduation_year: nextYear }).success).toBe(false);
  });
});

describe("step 4 — competency", () => {
  const base = {
    primary_subject: "Web Development",
    secondary_subjects: "React, Node.js",
    skill_level: "Intermediate",
    target_audience: "Working professionals",
    course_ideas: "i".repeat(60),
    sample_content: "",
  };

  it("accepts a valid submission", () => {
    expect(step4Schema.safeParse(base).success).toBe(true);
  });

  it("requires subject, skill level and audience", () => {
    const r = step4Schema.safeParse({ ...base, skill_level: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Primary subject, skill level, and target audience are required.");
  });

  it("requires at least 50 characters of course ideas", () => {
    const r = step4Schema.safeParse({ ...base, course_ideas: "i".repeat(49) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Please describe your course ideas in at least 50 characters.");
  });
});

describe("step 5 — legal & payout", () => {
  const base = {
    pan_number: "ABCDE1234F",
    bank_name: "State Bank of India",
    account_number: "1234567890",
    ifsc_code: "SBIN0001234",
    account_holder: "Asha Rao",
    skip_payout: false,
    agree_terms: true,
    agree_quality: true,
    agree_revenue: true,
  };

  it("accepts a valid payout submission", () => {
    expect(step5Schema.safeParse(base).success).toBe(true);
  });

  it("requires all three agreements", () => {
    const r = step5Schema.safeParse({ ...base, agree_revenue: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Please accept all three agreements to continue.");
  });

  it("rejects a malformed PAN", () => {
    const r = step5Schema.safeParse({ ...base, pan_number: "ABC1234F" });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed IFSC", () => {
    const r = step5Schema.safeParse({ ...base, ifsc_code: "SBIN000123" });
    expect(r.success).toBe(false);
  });

  it("allows skipping the payout details entirely", () => {
    expect(step5Schema.safeParse({ ...base, skip_payout: true, pan_number: "", bank_name: "", account_number: "", ifsc_code: "", account_holder: "" }).success).toBe(true);
  });

  it("still requires the agreements when the payout is skipped", () => {
    expect(step5Schema.safeParse({ ...base, skip_payout: true, agree_quality: false }).success).toBe(false);
  });

  it("PAN and IFSC patterns match the PHP regexes exactly", () => {
    expect(PAN_RE.test("ABCDE1234F")).toBe(true);
    expect(PAN_RE.test("abcde1234f")).toBe(false);
    expect(IFSC_RE.test("SBIN0001234")).toBe(true);
    // The PHP requires the 5th character to be a literal 0.
    expect(IFSC_RE.test("SBIN1001234")).toBe(false);
  });
});