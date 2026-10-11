// lib/config.ts validates the environment at import time, so these must be set before the
// modules under test are loaded (import hoisting means this has to be a side-effect import).
import "./helpers/env";
import { describe, it, expect } from "vitest";
import { computeTestScore } from "@/lib/instructor/test-constants";
import { parseQuestionsFromJSON, AiError } from "@/lib/ai/question-generator";
import {
  STEP_LABELS,
  PANEL_CONTENT,
  YEARS_EXP_REVIEW,
} from "@/lib/instructor/wizard";
import { decryptSensitive, encryptSensitive } from "@/lib/db/instructor-registration";

const Q = (answer: string) => ({
  question: `Q${answer}`,
  options: { A: "a", B: "b", C: "c", D: "d" },
  answer,
});

describe("scoring", () => {
  it("counts correct answers and rounds the percentage", () => {
    // 2 of 3 correct = 66.67% -> 67
    const questions = [Q("A"), Q("B"), Q("C")];
    const r = computeTestScore(questions, { "0": "A", "1": "B", "2": "D" });
    expect(r.correct).toBe(2);
    expect(r.total).toBe(3);
    expect(r.score).toBe(67);
  });

  it("normalises case and whitespace before comparing", () => {
    const questions = [Q("A"), Q("B")];
    expect(computeTestScore(questions, { "0": " a ", "1": "\tb\n" }).correct).toBe(2);
  });

  it("treats a missing answer as wrong", () => {
    expect(computeTestScore([Q("A"), Q("B")], { "0": "A" }).correct).toBe(1);
    expect(computeTestScore([Q("A")], {}).correct).toBe(0);
  });

  it("returns 0 for an empty question set", () => {
    expect(computeTestScore([], {})).toEqual({ correct: 0, total: 0, score: 0 });
  });

  it("gives a perfect score when everything is right", () => {
    const questions = [Q("A"), Q("B"), Q("C"), Q("D")];
    expect(computeTestScore(questions, { "0": "A", "1": "B", "2": "C", "3": "D" }).score).toBe(100);
  });
});

describe("AI question parser", () => {
  const valid = '[{"question":"What is X?","options":{"A":"1","B":"2","C":"3","D":"4"},"answer":"b"}]';

  it("parses a clean JSON array", () => {
    const q = parseQuestionsFromJSON(valid);
    expect(q).toHaveLength(1);
    expect(q[0].answer).toBe("B");
    expect(q[0].question).toBe("What is X?");
  });

  it("strips markdown fences", () => {
    const q = parseQuestionsFromJSON("```json\n" + valid + "\n```");
    expect(q).toHaveLength(1);
  });

  it("salvages complete objects from a truncated response", () => {
    const truncated = '[{"question":"A?","options":{"A":"1","B":"2","C":"3","D":"4"},"answer":"A"},{"question":"B?","optio';
    const q = parseQuestionsFromJSON(truncated);
    expect(q.length).toBeGreaterThanOrEqual(1);
    expect(q[0].answer).toBe("A");
  });

  it("drops a question that is missing an option", () => {
    const bad = '[{"question":"Q?","options":{"A":"1","B":"2","C":"3"},"answer":"A"}]';
    expect(() => parseQuestionsFromJSON(bad)).toThrow(AiError);
  });

  it("drops a question whose answer is not A-D", () => {
    const bad = '[{"question":"Q?","options":{"A":"1","B":"2","C":"3","D":"4"},"answer":"E"}]';
    expect(() => parseQuestionsFromJSON(bad)).toThrow(AiError);
  });

  it("throws when there is no JSON array at all", () => {
    expect(() => parseQuestionsFromJSON("sorry, I cannot help")).toThrow(AiError);
  });
});

describe("wizard constants", () => {
  it("has exactly 8 step labels with icons", () => {
    expect(STEP_LABELS).toHaveLength(8);
    expect(STEP_LABELS.every((s) => s.label && s.icon)).toBe(true);
  });

  it("has panel content for every step 1-8", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(PANEL_CONTENT[n]).toBeDefined();
      expect(PANEL_CONTENT[n].headline).toContain("<span>");
    }
  });

  it("maps every years_exp option to a review label", () => {
    for (const v of [0, 1, 3, 6, 11, 16]) {
      expect(YEARS_EXP_REVIEW[v]).toBeTruthy();
    }
  });
});

describe("sensitive field encryption", () => {
  const legal = {
    full_legal_name: "Asha Rao",
    pan_number: "ABCDE1234F",
    bank_name: "State Bank of India",
    account_number: "1234567890",
    ifsc_code: "SBIN0001234",
    account_holder: "Asha Rao",
    upi_id: "asha@upi",
    skip_payout: 0,
    revenue_share_ack: 1,
    terms_agreed: 1,
    content_policy: 1,
  };

  it("encrypts the sensitive columns and leaves the rest readable", () => {
    const enc = encryptSensitive(legal)!;
    expect(enc.pan_number).not.toBe("ABCDE1234F");
    expect(enc.ifsc_code).not.toBe("SBIN0001234");
    expect(enc.account_number).not.toBe("1234567890");
    expect(enc.account_holder).not.toBe("Asha Rao");
    expect(enc.upi_id).not.toBe("asha@upi");
    // Non-sensitive fields must stay as typed.
    expect(enc.full_legal_name).toBe("Asha Rao");
    expect(enc.bank_name).toBe("State Bank of India");
  });

  it("round-trips back to the original values", () => {
    const enc = encryptSensitive(legal)!;
    const dec = decryptSensitive({
      full_legal_name: enc.full_legal_name,
      pan_number: enc.pan_number,
      bank_account: enc.account_number,
      ifsc_code: enc.ifsc_code,
      account_holder: enc.account_holder,
      upi_id: enc.upi_id,
    });
    expect(dec.pan_number).toBe("ABCDE1234F");
    expect(dec.bank_account).toBe("1234567890");
    expect(dec.ifsc_code).toBe("SBIN0001234");
    expect(dec.account_holder).toBe("Asha Rao");
    expect(dec.upi_id).toBe("asha@upi");
  });

  it("leaves plaintext values untouched (idempotent)", () => {
    const once = encryptSensitive(legal)!;
    const twice = encryptSensitive(once)!;
    expect(twice.pan_number).toBe(once.pan_number);
  });
});