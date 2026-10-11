# Phase 5 spec — Student part 1: cart, wishlist, checkout, payments

Written before coding, per the Phase 5 prompt. Sibling analyses: `payments.md`
(Razorpay flow), `functions.md` (`private/functions/student.php`),
`auth-security.md` (session + CSRF), `phase4.md` (shared layer).

## 1. Sources read in full

`public/cart.php` (443), `public/wishlist.php` (375), `public/checkout.php` (473),
`public/create-order.php` (120), `public/verify-payment.php` (163),
`public/razorpay-webhook.php` (101), `public/mark-order-status.php` (63),
`public/student/check-payment-status.php` (177),
`public/student/purchase-history.php` (1206), `public/student/receipt.php` (211),
`private/functions/payment_reconciliation.php` (227),
`private/functions/student.php` (`getCart`, `getStudentStats`, `getWishlist`,
`recordPurchase`, `updatePurchaseStatus`, `updateRazorpayOrderStatus`,
`processCapturedPayment`, `getStudentPurchaseHistory*`, `getPurchaseReceiptData`).

## 2. Layers of the enrollment reliability system

| Layer | Where | Trigger |
|---|---|---|
| 1 | `app/api/razorpay/verify-payment` | browser checkout callback, after the Razorpay popup |
| 2 | `app/api/razorpay/webhook` | Razorpay server, `payment.captured` |
| 3 | `lib/payments/reconciliation.ts#reconcilePendingRazorpayPayments` | cron route + lazy trigger |
| 4 | `lib/payments/reconciliation.ts#purgeOldCancelledOrders` | cron route + lazy trigger |
| manual | `app/api/student/check-payment-status` | student clicks "Check & Enroll" |

All five funnel through the single `processCapturedPayment()` in `lib/payments/capture.ts`.

## 3. Role rules

- `cart`, `wishlist`, `checkout`, `purchase-history`, `receipt`: `requireRole('student')`.
  PHP used `requireLogin()` + an instructor redirect for cart/wishlist/checkout and
  `requireRole(ROLE_STUDENT)` for purchase-history/receipt; the port uses the student
  guard everywhere and redirects instructors, matching the message.
- `create-order` / `verify-payment` block instructors with
  "Instructors are not permitted to purchase courses."
- `check-payment-status` is `ROLE_STUDENT` only.

## 4. Server-side amounts

Client amounts are never trusted. `create-order` recomputes from the cart:
`sum(price of paid items)`, `amountPaise = round(total * 100)`. `verify-payment`
recomputes the same and compares with the stored amount using the PHP tolerance
`abs(expected - paid) > 1` (1 paise).

## 5. Order binding instead of `$_SESSION`

PHP stores `razorpay_order_id` + `razorpay_amount` in `$_SESSION` and `verify-payment`
rejects any order id that does not match the session value. Serverless has no
server session, so the port issues a short-lived, HMAC-signed, httpOnly
`edulari_pending_order` cookie (`orderId:amountPaise`, 30 min) when creating the order
and requires an exact match during verification. A tampered or stale cookie yields the
same "Order mismatch." response.

## 6. Status machines

`razorpay_orders.status`: `created | enrolled | enrollment_failed | abandoned | failed | cancelled`
`purchase_history.status`: `paid | enrollment_failed | enrolled | refunded`

`updateRazorpayOrderStatus()` applies `cancelled`/`failed` **only while the row is still
`created`**, so a late client report can never overwrite `enrolled` or
`enrollment_failed`. Every other status is unconditional. This is the race guard.

## 7. Idempotency

`processCapturedPayment()`:
1. Look up `purchase_history` by `razorpay_payment_id` (unique constraint `uq_payment`).
2. If present and `status = 'enrolled'` -> `{success:true, already_processed:true}`.
3. Else `INSERT ... ON CONFLICT (razorpay_payment_id) DO NOTHING`; if that inserted
   nothing, re-select (a concurrent layer won the race) and short-circuit if enrolled.
4. Enroll every course in **one Postgres transaction**, skipping already-enrolled ones,
   tolerating `Already enrolled in this course`, removing each from the cart.
5. On success: `purchase_history -> enrolled` with the count, order -> `enrolled`.
   On failure: rollback, `enrollment_failed`, order -> `enrollment_failed`.

## 8. Webhook

Raw body via `await req.text()` **before** parsing. `X-Razorpay-Signature` compared with
`HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)` using `timingSafeEqual`. Missing secret
or header -> 400 `Missing signature.`; mismatch -> 400 `Invalid signature.`. Only
`payment.captured` acts. Every other outcome returns **200** so Razorpay does not retry:
`ignored`, `malformed`, `unknown_order`, `already_enrolled`, `ok`, `enrollment_failed`.
No secrets, key ids, signatures or full payment ids are logged — only the order id,
the internal user id and a boolean result.

## 9. Reconciliation constants (verbatim from the PHP, including its TESTING values)

```
RECONCILE_INTERVAL_SECONDS       = 60     (prod intent 900)
RECONCILE_GRACE_SECONDS          = 10     (prod intent 600)
RECONCILE_MAX_ORDERS             = 20
RECONCILE_ABANDON_AFTER          = 120
RECONCILE_RECHECK_WINDOW_SECONDS = 3600
CLEANUP_RETENTION_DAYS           = 10
CLEANUP_INTERVAL_SECONDS         = 21600
```

The lazy trigger is kept: `proxy.ts` calls `maybeRunPaymentReconciliation()` and
`maybeRunCancelledOrdersCleanup()`, both of which are cheap no-ops unless the interval
has elapsed, and both claim the run with a conditional `UPDATE ... WHERE setting_value
= <old>` so concurrent requests cannot double-run. Vercel Cron hits the same functions
through `app/api/cron/reconcile-payments`.

## 10. Pages

| Old | New | Notes |
|---|---|---|
| `cart.php` | `/cart` | item list, order summary, trust badges, flash, empty state; actions `remove`, `move_to_wishlist`, `clear_cart`, `checkout` |
| `wishlist.php` | `/wishlist` | card grid with enrolled / in-cart / normal action states; actions `remove`, `add_to_cart`, `move_all_to_cart` |
| `checkout.php` | `/checkout` | step indicator, secure-payment panel, Razorpay popup, inline success screen |
| `student/purchase-history.php` | `/student/purchase-history` | hero + alert, 4 stat pills, filter bar, sortable table, details modal, check-payment modal |
| `student/receipt.php` | `/student/receipt?order=` | invoice card, ownership-checked, PDF via html2canvas + jsPDF |

CSS: `cart-wishlist.css` + `checkout.css` + `student/purchase-history.css` +
`student/receipt.css`, copied verbatim. `assets/css/student/navbar.css` is requested by
the PHP `$extraCss` but **does not exist in the old site** (latent 404); the port does
not import it.

### Receipt responsiveness (prompt requirement)

`receipt.php` hacks around its own broken layout by capturing the canvas with
`windowWidth: 1024`. The port keeps the desktop look byte-for-byte and additionally
makes `.rcpt-card` fluid below 768 px (meta rows stack, table cells wrap, actions wrap)
via a scoped override on the receipt page only, so the PDF output is unchanged.

## 11. Security

- CSRF on every mutating endpoint (cookie token + `timingSafeEqual`, plus Origin/Host).
- Ownership on every order/receipt lookup (`student_id` in the WHERE clause).
- `check-payment-status` validates `/^order_[A-Za-z0-9]+$/` and enforces a 30 s
  per-order cooldown stored in Postgres (`account_recovery_attempts`-style throttle row)
  because it calls the live Razorpay API.
- `mark-order-status` only accepts `cancelled`/`failed` and only for the caller's own order.
- Amount is always recomputed server-side.
- Webhook secret never leaves the server; `console.error` messages carry no secrets.

## 12. Out of scope

`/student/my-courses`, `/student/learn`, `/student/dashboard` and the rest of the
student area are a later phase; `receipt` and `purchase-history` are in scope because
the prompt lists them.

## 13. Tests

- `tests/payments-signature.test.ts` — checkout signature + webhook signature, valid,
  tampered, wrong secret, timing-safe comparison of equal-length strings.
- `tests/payments-amounts.test.ts` — amount computation: paise rounding, free-item
  exclusion, cart with a mix of free and paid, and the 1-paise tolerance rule.
- `tests/payments-capture.test.ts` — `processCapturedPayment` against a stubbed
  enroller: duplicate client-verify + webhook yields exactly one enrollment and the
  second call reports `already_processed`.
