# Testing the Razorpay payment flow (Phase 5)

Plain text guide. Never put real keys in this file, in a commit, or in a ticket —
real values live only in `.env.local` (git-ignored) and in the Vercel project
settings.

## 1. Environment values you must supply

```
RAZORPAY_KEY_ID=            # Test key id from the Razorpay dashboard
RAZORPAY_KEY_SECRET=        # Test key secret (server only, never exposed to the browser)
RAZORPAY_WEBHOOK_SECRET=    # Webhook secret from Razorpay > Settings > Webhooks
RAZORPAY_LIVE=false
CRON_SECRET=                # any long random string; protects /api/cron/reconcile-payments
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

The browser only ever receives `RAZORPAY_KEY_ID` (through
`POST /api/razorpay/create-order`). `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` must never be prefixed with `NEXT_PUBLIC_`.

## 2. Local run

    npm run dev

Use http://localhost:3000. Razorpay test checkout works on localhost, but the
Razorpay dashboard cannot deliver webhooks to it — see section 5.

## 3. Card / UPI test credentials

Razorpay's test mode accepts any of these without a real charge:

- Card: 4111 1111 1111 1111, any future expiry, any CVV, any name
- UPI:   success@razorpay (always succeeds)
- UPI:   failure@razorpay (always fails)

Full list: Razorpay dashboard > Payments > Test Cards / Test UPI IDs.

## 4. Manual happy path

1. Register or log in as a student.
2. Open a paid course and press "Add to Cart". Open a free course and add it too.
3. Go to /cart. Confirm the order summary shows "Free courses", "Paid courses",
   "Subtotal" and "Total" matching the values shown on the page.
4. Press "Proceed to Checkout".
5. Press "Pay <amount> Now". The Razorpay popup opens with the amount from the
   server (never from a client-supplied figure).
6. Pay with 4111 1111 1111 1111.
7. The page is replaced by the green "Payment Successful!" screen showing the
   Payment ID, the amount paid, the number of courses enrolled and the enrolled
   course list.
8. You are redirected nowhere automatically. Use "Done - Go to My Courses" and
   confirm the free course from step 2 is ALSO enrolled (the PHP enrolls paid and
   free items together).
9. Open /student/purchase-history. The row shows status "Enrolled" and a badge
   count equal to the number of paid courses in the order.
10. Click "View Details", then "Download Receipt". A PDF is saved as
    `Receipt-order_XXXXXXXXXXXX.pdf`.

## 5. Webhook delivery

Webhooks need a public HTTPS URL. Use a tunnel, for example:

    ngrok http 3000

Then in Razorpay > Settings > Webhooks add:

- URL:            https://<tunnel-host>/api/razorpay/webhook
- Secret:         the same value as RAZORPAY_WEBHOOK_SECRET
- Events:         payment.captured
- Active:         Enabled

Verify by hand:

    curl -X POST https://<your-host>/api/razorpay/webhook ^
      -H "Content-Type: application/json" ^
      -H "X-Razorpay-Signature: <wrong>" ^
      -d "{\"event\":\"payment.captured\"}"

Expected: HTTP 401 and `{ "ok": false }`. A correct signature with an unknown
order returns HTTP 200 with `{ "ok": true, "ignored": true }`.

## 6. Duplicate / race tests (Layer 1 vs Layer 2)

The same payment can arrive from the browser (verify-payment) and the webhook at
the same time. Enrollment must happen exactly once.

1. Complete a payment but stop the network request to /api/razorpay/verify-payment
   (browser devtools "Offline" immediately after the popup closes).
2. Confirm the payment reached Razorpay (dashboard > Payments).
3. Reload /checkout or /cart. Press "Proceed to Checkout" then "Pay" again and
   dismiss the popup (this marks the old order cancelled, not the paid one).
4. Open /student/purchase-history and press "Check Payment Status", paste the
   paid Order ID, press "Check & Enroll".
5. Expected: "Enrolled in N course(s)." and the page reloads with a single
   "Enrolled" row. No duplicate rows, no duplicate enrollments.

## 7. Abandoned order test (Layer 3)

1. Press "Proceed to Checkout" and dismiss the Razorpay popup.
2. The order is marked `cancelled` with reason `cancelled_by_user`.
3. It appears in /student/purchase-history as "Cancelled" / "No payment recorded".
4. If you close the popup without the status report reaching the server (offline
   mode), the order stays `created`. Wait for
   `RECONCILE_ABANDON_AFTER` (120 seconds) plus the reconciliation interval
   (60 seconds) and reload: the row becomes "Incomplete" (status `abandoned`).
   To force it without waiting, call the cron route:

       curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-host>/api/cron/reconcile-payments

   Expected JSON: `{ "ok": true, "ran_reconcile": true, "summary": { "scanned": 1, ... }, "purged": 0 }`.

## 8. Amount mismatch and tampering (must all fail)

- Change the amount in the Razorpay popup by intercepting the network request to
  /api/razorpay/verify-payment. Expected: "Payment amount mismatch. Please
  contact support." No enrollment.
- Verify with a signature generated from a different key secret. Expected:
  "Payment signature invalid." No enrollment.
- Verify with the Order ID of another student's order. Expected: "Order
  mismatch." (ownership + pending-order cookie binding).
- Replay a previous successful verify-payment request within the cookie lifetime.
  Expected: idempotent success, `already_processed` true, no duplicate
  enrollment.
- POST /api/razorpay/create-order, /api/razorpay/verify-payment,
  /api/cart/remove, /api/cart/checkout or /api/wishlist/action without the
  `X-CSRF-Token` header. Expected: HTTP 403.
- Send any of them with an `Origin` header from another host. Expected: HTTP 403.

## 9. Role rules

- Log in as an instructor and open /cart, /wishlist or /checkout. Expected:
  redirected to /browse-courses with the flash "Instructors cannot access ...".
- POST /api/razorpay/create-order as an instructor. Expected: HTTP 403.

## 10. Automated tests

    npm run typecheck
    npm run lint
    npm test
    npm run parity-check

`tests/razorpay-signature.test.ts`, `tests/payment-amounts.test.ts` and
`tests/process-payment.test.ts` cover signature verification (including raw-body
webhook bytes), server-side amount computation with free-course exclusion, the
+/-1 paise tolerance, and enrollment idempotency for the client-verify / webhook
race.

## 11. Production checklist before going live

- Set `RAZORPAY_LIVE=true` and swap in the LIVE key id/secret. Test keys must
  never serve real traffic.
- Register the real production webhook URL and confirm the secret matches.
- Set `CRON_SECRET` to a long random value in Vercel (it is sent automatically by
  Vercel Cron as `Authorization: Bearer <CRON_SECRET>`).
- Note: Vercel Hobby plans allow cron jobs only once per day. The
  `/api/cron/reconcile-payments` schedule in vercel.json is every 5 minutes,
  which requires a Pro plan. On Hobby, the lazy trigger in `proxy.ts` still runs
  the sweep on real traffic, so reconciliation is never fully off - but the
  resolution is coarser. See docs/DEPLOY.md.
