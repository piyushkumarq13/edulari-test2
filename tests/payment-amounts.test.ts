import { describe, it, expect } from "vitest";
import { amountMatches, computeOrderTotalPaise, isFree, paiseToRupees, splitPaidAndFree, summarizeCart, toPaise } from "@/lib/payments/amounts";

describe("server-side amount computation", () => {
  it("converts rupees to paise with rounding", () => {
    expect(toPaise(99.99)).toBe(9999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1499)).toBe(149900);
  });

  it("excludes free courses from the order total", () => {
    const items = [{ price: 499 }, { price: 0 }, { price: 501 }];
    // 499 + 0 + 501 = 1000 rupees -> 100000 paise; the free course adds nothing.
    expect(computeOrderTotalPaise(items)).toBe(100000);
  });

  it("treats a course priced 0 as free", () => {
    expect(isFree({ price: 0 })).toBe(true);
    expect(isFree({ price: "0.00" })).toBe(true);
    expect(isFree({ price: 1 })).toBe(false);
  });

  it("ignores null/unparseable prices rather than producing NaN", () => {
    expect(computeOrderTotalPaise([{ price: null }, { price: "abc" }, { price: 10 }])).toBe(1000);
  });

  it("splits paid and free items", () => {
    const { paidItems, freeItems } = splitPaidAndFree([{ price: 0 }, { price: 10 }, { price: 0 }]);
    expect(paidItems).toHaveLength(1);
    expect(freeItems).toHaveLength(2);
  });

  it("applies the ±1 paise tolerance from verify-payment.php", () => {
    expect(amountMatches(100000, 100000)).toBe(true);
    expect(amountMatches(100000, 100001)).toBe(true);
    expect(amountMatches(100000, 99999)).toBe(true);
    expect(amountMatches(100000, 100002)).toBe(false);
    expect(amountMatches(100000, 99000)).toBe(false);
  });

  it("converts paise back to rupees for the receipt/success screen", () => {
    expect(paiseToRupees(100000)).toBe(1000);
    expect(paiseToRupees(9999)).toBe(99.99);
  });

  it("summarizes the cart for the order-summary card", () => {
    expect(summarizeCart([{ price: 0 }, { price: 100 }, { price: 50 }])).toEqual({
      itemCount: 3,
      freeCount: 1,
      paidCount: 2,
      subtotal: 150,
    });
  });

  it("reports zero subtotal for an all-free cart (free enrollment path)", () => {
    const s = summarizeCart([{ price: 0 }, { price: 0 }]);
    expect(s.subtotal).toBe(0);
    expect(s.paidCount).toBe(0);
    expect(s.freeCount).toBe(2);
  });
});
