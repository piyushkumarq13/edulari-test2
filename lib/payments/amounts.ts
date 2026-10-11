/**
 * lib/payments/amounts.ts — every price figure in the buying journey is computed
 * server-side from the database. The client never supplies an amount.
 */

export type PricedItem = { price: number | string | null };

export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function isFree(item: PricedItem): boolean {
  return toNumber(item.price) === 0;
}

export function splitPaidAndFree<T extends PricedItem>(items: T[]): { paidItems: T[]; freeItems: T[] } {
  const paidItems: T[] = [];
  const freeItems: T[] = [];
  for (const item of items) (isFree(item) ? freeItems : paidItems).push(item);
  return { paidItems, freeItems };
}

/** Rupees -> smallest currency unit. Port of `(int)round($total * 100)`. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Server-side order total. Port of the `$total += (float)$item['price']` loop. */
export function computeOrderTotalPaise(items: PricedItem[]): number {
  const { paidItems } = splitPaidAndFree(items);
  let total = 0;
  for (const item of paidItems) total += toNumber(item.price);
  return toPaise(total);
}

/**
 * Amount check from verify-payment.php: `if (abs(expected - paid) > 1) fail`.
 * One paise of tolerance absorbs float rounding; anything larger is a mismatch.
 */
export function amountMatches(expectedPaise: number, paidPaise: number): boolean {
  return Math.abs(expectedPaise - paidPaise) <= 1;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Free-course path used by cart "checkout" and wishlist "add to cart". */
export function summarizeCart<T extends PricedItem>(items: T[]): { itemCount: number; freeCount: number; paidCount: number; subtotal: number } {
  let freeCount = 0;
  let subtotal = 0;
  for (const item of items) {
    if (isFree(item)) freeCount++;
    else subtotal += toNumber(item.price);
  }
  return { itemCount: items.length, freeCount, paidCount: items.length - freeCount, subtotal };
}
