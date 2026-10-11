# payments.md — Razorpay payments (exhaustive)

## Sources read in full
- `public/create-order.php` (120 lines)
- `public/verify-payment.php` (163 lines)
- `public/razorpay-webhook.php` (101 lines)
- `public/mark-order-status.php` (63 lines)
- `public/student/check-payment-status.php` (177 lines)
- `private/functions/payment_reconciliation.php` (227 lines)
- `private/functions/student.php` — `getCart` (L551), `recordPurchase` (L639), `updatePurchaseStatus` (L678), `updateRazorpayOrderStatus` (L693), `processCapturedPayment` (L726), `getStudentPurchaseHistory` (L821), `isEnrolled` (L89)

## Tables touched
- `razorpay_orders` — `student_id`, `razorpay_order_id`, `amount_paise`, `currency`, `courses_json`, `status`, `failure_reason`, `created_at`
- `purchase_history` — `student_id`, `razorpay_order_id`, `razorpay_payment_id`, `amount_paise`, `currency`, `status`, `enrolled_count`, `courses_json`, `ip_address`, `created_at`
- `cart`, `courses` (via `getCart`), `enrollments` (via `enrollStudent`), `app_settings` (`last_payment_reconcile_run`, `last_cleanup_run`)

## Role & purchase rules (create-order.php)
- `requireLogin()` then `isInstructor()` blocked: `'Instructors are not permitted to purchase courses.'`
- CSRF: `X-CSRF-TOKEN` header verified via `verifyCSRFToken`, else `'Invalid request.'`
- Cart via `getCart($user['id'])` (joins `courses`, `is_published = 1`, plus category/instructor names); split into `$paidItems` (`price > 0`) and free items (`price == 0`).
- `if (empty($paidItems))` → `{'error':'No paid items in cart'}`.
- Total computed server-side from DB cart prices: `$total += (float)$item['price']`; `$amountPaise = (int)round($total * 100)`. Client amount never trusted.
- The "student cannot buy owned course" rule: enforced at cart-add/enroll time and inside `processCapturedPayment` via `isEnrolled` check (`enrollStudent` returning 'Already enrolled in this course' is tolerated); verify-payment enrolls all paid+free cart items together.

## Razorpay order creation (create-order.php L41–105)
- POST `https://api.razorpay.com/v1/orders` with basic auth `RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`, 30s timeout.
- Payload: `{amount: $amountPaise, currency: CURRENCY_CODE, receipt: 'rcpt_' . $user['id'] . '_' . time(), notes: {student_id: (string)$user['id']}}`.
- Errors: curl error → `'Could not reach payment server. Please try again.'`; non-200 → `'Failed to create payment order. Please try again.'`; missing `id` → `'Invalid response from payment server.'` (all logged via `error_log`, response returned without internals).
- Session stored for later verification: `$_SESSION['razorpay_order_id']`, `$_SESSION['razorpay_amount']`.
- `courses_json` snapshot (`course_id`, `title`, `price` only, `JSON_UNESCAPED_UNICODE`) inserted into `razorpay_orders` with `dbInsert`; failure logged, not fatal.
- Response to JS: `{order_id, amount, currency, key: RAZORPAY_KEY_ID, name: SITE_NAME, email: $user['email'], contact: $user['phone'] ?? ''}`.

## verify-payment.php (Layer 1 — browser checkout callback)
- `requireLogin()`; instructors blocked (same message, `success:false` shape). CSRF header check.
- Input accepted from JSON body (`php://input`), falling back to `$_POST`; fields `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` (trimmed).
- Missing payment_id/signature → `'Payment data missing. Please try again.'`
- Order id fallback to `$_SESSION['razorpay_order_id']`; session order id MUST equal provided id else `'Order mismatch.'`
- Signature: `hash_hmac('sha256', $razorpay_order_id . '|' . $razorpay_payment_id, RAZORPAY_KEY_SECRET)`, compared with `hash_equals`; mismatch → `'Payment signature invalid.'`
- Amount check: recompute `$expectedPaise` from current cart paid items; `$_SESSION['razorpay_amount']` must be within 1 paise (`abs(...) > 1` fails) else `'Payment amount mismatch. Please contact support.'`
- Client IP sanitized (first `X-Forwarded-For` entry, validated with `FILTER_VALIDATE_IP`, else empty).
- Calls the single shared entry point `processCapturedPayment($user['id'], $order_id, $payment_id, $paidPaise, $coursesForEnrollment /* paid + free merged */, $clientIp)`.
- On failure: generic `'Payment was received but enrollment failed. Please contact support and reference your account email.'` On success: session payment vars unset, returns `{success:true, payment_id, amount (rupees = paise/100), enrolled_count, courses:[{title,price,thumbnail}]}`. No redirect — JS shows success screen.
- Logging: only internal user id and success/enrolled counts; never payment identifiers or signatures.

## processCapturedPayment (student.php L726–815)
- Idempotency: fetch `purchase_history` row by `razorpay_payment_id`; if `status === 'enrolled'`, no-op `{success:true, already_processed:true, enrolled_count}`.
- Insert via `recordPurchase` (`INSERT IGNORE`, status `'paid'`, validated IP, clean course snapshot, `CURRENCY_CODE` fallback `'INR'`). If insert returns false (concurrent insert): re-fetch; if that row is already `enrolled`, return already_processed; else continue with existing id.
- Enrollment loop inside `dbBeginTransaction()`: for each course, `isEnrolled` check (skip), `enrollStudent` (tolerating exact message `'Already enrolled in this course'`, otherwise throw), `removeFromCart` per course. `dbCommit()`.
- Success: `updatePurchaseStatus($purchaseId, 'enrolled', $enrolledCount)`; `updateRazorpayOrderStatus($razorpayOrderId, 'enrolled')`; return `{success:true, already_processed:false, enrolled_count}`.
- Failure: `dbRollback()`; `updatePurchaseStatus(..., 'enrollment_failed', 0)`; `updateRazorpayOrderStatus(..., 'enrollment_failed')`; `error_log` with payment id + student id; return `{success:false, already_processed:false, message:'Enrollment failed.'}`.

## updateRazorpayOrderStatus (student.php L693–713)
- Allowed: `created | enrolled | enrollment_failed | abandoned | failed | cancelled`.
- Safety rule for `cancelled`/`failed`: only applied `WHERE status = 'created'` (`set status, failure_reason`), so a late browser report can never overwrite `enrolled`/`enrollment_failed`. All other statuses set unconditionally.

## razorpay-webhook.php (Layer 2 — server-to-server)
- No session/login; trust established purely by signature.
- Raw body read FIRST via `file_get_contents('php://input')`; header `X-Razorpay-Signature`; expected = `hash_hmac('sha256', $rawBody, RAZORPAY_WEBHOOK_SECRET)`; `hash_equals`; missing secret/header → 400 `'Missing signature.'`; mismatch → 400 `'Invalid signature.'`
- Event must be `payment.captured`, else 200 `{status:'ignored'}`.
- Malformed payload (no `payload.payment.entity.order_id`/`id`) → 200 `{status:'malformed'}`.
- Look up `razorpay_orders` by `razorpay_order_id`; not found → 200 `{status:'unknown_order'}`.
- `status === 'enrolled'` → 200 `{status:'already_enrolled'}` (Layer 1 already handled it).
- Else `$courses = json_decode($orderRow['courses_json'])`; `processCapturedPayment($student_id, order_id, payment_id, $amountPaise, $courses)` (no IP). 200 `{status: 'ok'|'enrollment_failed'}`.
- Ack semantics: every non-actionable case returns 200 so Razorpay does not retry; only signature failures return 400.

## mark-order-status.php (client telemetry)
- `requireLogin()`, CSRF check, JSON body `{razorpay_order_id, status, reason}`.
- Only `cancelled`/`failed` allowed; order must belong to `$user['id']` (`'Order not found.'`); reason truncated to 255 chars.
- `updateRazorpayOrderStatus` applies only-if-still-`created` rule; returns `{success:true, applied: bool}`.

## student/check-payment-status.php (manual retry)
- `requireRole(ROLE_STUDENT)`; CSRF; order id must match `/^order_[A-Za-z0-9]+$/`.
- Per-order session rate limit: key `ph_check_<order_id>`, 30s cooldown (`"Please wait {$wait}s..."`).
- Ownership #1 `purchase_history`: `enrolled` → success message; other than `enrollment_failed` → `'This order isn\'t eligible for a re-check.'`; `enrollment_failed` → retry `processCapturedPayment` with stored payment id/amount/courses.
- Ownership #2 `razorpay_orders`: `enrolled` → success; not found → generic not-found message.
- Grace guard: `created` and age `< RECONCILE_GRACE_SECONDS` → `{status:'pending', 'Your payment is still being confirmed...'}`.
- Else `fetchCapturedRazorpayPayment($orderId)`: null (API error) → try-again message, no status change; found → `processCapturedPayment`; false (confirmed none) → `updateRazorpayOrderStatus($orderId, 'abandoned')` with support message.

## payment_reconciliation.php (Layer 3/4 lazy cron)
Constants (NOTE: file says TESTING values, "revert before going live"):
- `RECONCILE_INTERVAL_SECONDS = 60` (prod note: 900)
- `RECONCILE_GRACE_SECONDS = 10` (prod note: 600)
- `RECONCILE_MAX_ORDERS = 20`
- `RECONCILE_ABANDON_AFTER = 120` (comment says "30 minutes", prod intent 1800)
- `RECONCILE_RECHECK_WINDOW_SECONDS = 3600`
- `CLEANUP_RETENTION_DAYS = 10`, `CLEANUP_INTERVAL_SECONDS = 21600` (6h)

`maybeRunPaymentReconciliation()` (called per page load from bootstrap.php):
- Read `app_settings.last_payment_reconcile_run`; skip if within interval; claim under conditional `UPDATE ... WHERE setting_value = ?` (optimistic concurrency — losers of the race return); `register_shutdown_function('reconcilePendingRazorpayPayments')` so work runs after response flush.

`reconcilePendingRazorpayPayments()`:
- Select stale orders: `status IN ('created','enrollment_failed')` OR (`status IN ('cancelled','failed')` AND `created_at > NOW() - INTERVAL 3600 SECOND`), AND `created_at < NOW() - INTERVAL grace SECOND`, oldest first, `LIMIT 20`; call `checkAndReconcileOneOrder` per row.

`checkAndReconcileOneOrder($orderRow)`:
- `fetchCapturedRazorpayPayment`: GET `/v1/orders/{id}/payments` with basic auth, 15s timeout. Returns: payment array if any item `status === 'captured'`; `false` if reachable but none; `null` on curl error or non-200 (never treated as "no payment").
- null → return, retry next run.
- false → only for `created`/`enrollment_failed` rows, if age `>= RECONCILE_ABANDON_AFTER` → mark `abandoned`. `cancelled`/`failed` rows are NOT downgraded to abandoned (only brief recheck within 1h window for late captures).
- captured → `processCapturedPayment` with courses_json, payment id, amount.

`maybeRunCancelledOrdersCleanup()` / `purgeOldCancelledOrders()`:
- Same lazy-cron claim pattern via `app_settings.last_cleanup_run` (seeded with `INSERT IGNORE ... '0'` if missing); deletion `DELETE FROM razorpay_orders WHERE status IN ('cancelled','failed') AND created_at < NOW() - INTERVAL 10 DAY`; logs only when deleted>0.

## purchase history display merge (student.php L821+)
- `getStudentPurchaseHistory` UNIONs `purchase_history` rows with still-`created` `razorpay_orders` rows (synthesized `pending-{id}` rows, `status:'pending'` when `created`), so students see orders before Layer 2/3 confirms them.

## Failure/race matrix (as implemented)
- Duplicate webhook + client verify: both call `processCapturedPayment`; idempotency key is `purchase_history.razorpay_payment_id`; second caller gets `already_processed:true`. Webhook also short-circuits on `razorpay_orders.status === 'enrolled'`.
- Client reports cancelled/failed while webhook captured: `updateRazorpayOrderStatus` only applies cancelled/failed from `created`, and `processCapturedPayment` sets `enrolled` regardless — enrolled wins if server flow already set a terminal resolved state.
- Enrollment throws mid-loop: rollback removes any `enrollStudent`/enrollment rows from that transaction; purchase row → `enrollment_failed`; order → `enrollment_failed`; purchasable state remains paid (money taken) and retryable via check-payment-status/reconciliation.
- cURL/API down in reconciliation: rows untouched, retried on next sweep; check-payment-status returns retry message.
- Webhook arrives with bad signature: 400, nothing changes.
