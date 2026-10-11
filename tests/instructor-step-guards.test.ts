import { describe, it, expect } from "vitest";
import { resolveStepGuard, isEditableStep } from "@/lib/instructor/wizard";

/**
 * The wizard step guards, as pure functions. Each rule comes from the PHP per-file guard:
 *   step-1.php : if ($step > 1)               -> forward to $step
 *   step-N.php : if ($step < N)               -> back to max(1, $step)
 *   step-6.php : edit_step_N only for N 2..5
 */
describe("step guards", () => {
  it("allows the step the applicant is actually on", () => {
    for (let n = 1; n <= 8; n++) {
      expect(resolveStepGuard(n, n)).toBeNull();
    }
  });

  it("allows going BACK to any already-completed step (2-8)", () => {
    expect(resolveStepGuard(2, 6)).toBeNull();
    expect(resolveStepGuard(5, 8)).toBeNull();
  });

  it("step-1 forwards to the current step once the wizard has advanced", () => {
    expect(resolveStepGuard(1, 3)).toBe(3);
    expect(resolveStepGuard(1, 8)).toBe(8);
  });

  it("blocks jumping ahead and sends the applicant back to where they are", () => {
    expect(resolveStepGuard(4, 2)).toBe(2);
    expect(resolveStepGuard(8, 7)).toBe(7);
    expect(resolveStepGuard(3, 1)).toBe(1);
  });

  it("never redirects below step 1", () => {
    expect(resolveStepGuard(2, 0)).toBe(1);
    expect(resolveStepGuard(5, -3)).toBe(1);
  });

  it("blocks every step of the test flow when the wizard is still at the start", () => {
    for (let n = 2; n <= 8; n++) {
      expect(resolveStepGuard(n, 1)).toBe(1);
    }
  });
});

describe("edit-mode bounds", () => {
  it("allows editing steps 2 to 5 only", () => {
    expect(isEditableStep(2)).toBe(true);
    expect(isEditableStep(5)).toBe(true);
  });

  it("rejects step 1, step 6+ and non-integers", () => {
    expect(isEditableStep(1)).toBe(false);
    expect(isEditableStep(6)).toBe(false);
    expect(isEditableStep(8)).toBe(false);
    expect(isEditableStep(2.5)).toBe(false);
    expect(isEditableStep(Number.NaN)).toBe(false);
  });
});