# maintenance-cron.md — Lazy jobs, periodic cleanup & maintenance mode (Phase 1)

Scope: every lazy/periodic job in the old PHP site, how it is triggered, throttled,
and what it deletes. All run "on request" because the host (shared hosting) had no
reliable real cron. Document-only; no values copied.

## 1. Payment reconciliation (Layer 3) — private/functions/payment_reconciliation.php

Trigger:
- `maybeRunPaymentReconciliation()` is called on EVERY page load from
  `private/bootstrap.php` (line 60), so effectively piggybacks on all traffic.

Throttle marker:
- Row `app_settings.setting_key = 'last_payment_reconcile_run'` (unix timestamp string).
- `RECONCILE_INTERVAL_SECONDS = 60` in current code, with an in-file note saying to
  revert to 900 (15 min) before going live. Code as-shipped wins: 60s.
- Claim-by-UPDATE: `UPDATE app_settings ... WHERE setting_key=... AND setting_value <old>`
  so a concurrent request that already claimed the run exits.

Work (runs via `register_shutdown_function('reconcilePendingRazorpayPayments')`,
i.e. AFTER the page response is flushed, so visitors are not slowed):
- Selects `razorpay_orders` rows where status IN ('created','enrollment_failed'),
  OR status IN ('cancelled','failed') with created_at within the last
  `RECONCILE_RECHECK_WINDOW_SECONDS = 3600` seconds, AND older than
  `RECONCILE_GRACE_SECONDS = 10` seconds (note says intended 600), oldest first,
  `LIMIT RECONCILE_MAX_ORDERS = 20`.
- For each: `checkAndReconcileOneOrder()` → `fetchCapturedRazorpayPayment()`
  (GET `https://api.razorpay.com/v1/orders/{orderId}/payments`, basic auth with
  key id/secret, 15s timeout).
  - API error/unknown (null) → skip, try next run; never changed off an unknown state.
  - Confirmed no captured payment (false) → only rows still 'created'/
    'enrollment_failed' and age >= `RECONCILE_ABANDON_AFTER = 120` seconds
    (comment says intended 30 minutes) get status 'abandoned'. 'cancelled'/'failed'
    rows are re-checked within the 1h window but never downgraded to abandoned.
  - Captured payment found → `processCapturedPayment(student_id, order_id,
    payment_id, amount, courses from courses_json)` enrollments path.
- `error_log(...)` lines only (php_errors.log). No separate log file.
- No admin manual-force flag for this one (only the lazy trigger).

## 2. Cancelled/failed order purge (Layer 4) — same file, bottom

Trigger:
- `maybeRunCancelledOrdersCleanup()` from `private/bootstrap.php` line 61.

Throttle marker:
- Row `app_settings.setting_key = 'last_cleanup_run'`. Seeds itself with
  `INSERT IGNORE ... '0'` on first run. `CLEANUP_INTERVAL_SECONDS = 21600` (6 hours).
- Same claim-by-conditional-UPDATE race guard.

Work (shutdown function `purgeOldCancelledOrders()`):
- `DELETE FROM razorpay_orders WHERE status IN ('cancelled','failed')
  AND created_at < NOW() - INTERVAL CLEANUP_RETENTION_DAYS DAY`
  (`CLEANUP_RETENTION_DAYS = 10`).
- `error_log('Layer 4 cleanup: purged ...')` when rows were deleted.
- Display grouping of cancelled/failed orders on purchase history is separate
  and never deletes.

## 3. Token & attempt cleanup — private/functions/token_cleanup.php

Trigger:
- `cleanupExpiredTokens()` called from `public/login.php:15` on every login page
  view, and from `public/admin/dashboard.php:50` with `cleanupExpiredTokens(true)`
  (admin manual force → skips throttle).

Throttle marker:
- File `PRIVATE_PATH/.token_cleanup_last_run`; throttled to 21600s (6 hours).
  On force, throttle check is skipped and the marker is still refreshed.

Deletes:
- `test_tokens` WHERE expires_at < NOW() OR used = 1
- `test_failures` WHERE retry_after < NOW()
- `email_verification_tokens` WHERE expires_at < NOW()
- `password_resets` WHERE expires_at < NOW()
- `login_attempts` WHERE (block_expires IS NOT NULL AND block_expires < NOW())
  OR (is_blocked = 0 AND last_attempt < NOW() - INTERVAL 30 DAY)
  (unblocked rows kept 30 days for rate-limit history)

Returns array table => rows deleted; `[]` if throttled. No log file; caller may
report counts in the admin UI.

## 4. Stale draft instructor docs cleanup — private/functions/instructor_registration.php:503

Trigger:
- `cleanupStaleDraftDocs()` from `public/instructor-register/_init.php:33` and
  `public/admin/instructor-applications.php:11`;
  `cleanupStaleDraftDocs(true)` manual force from `public/admin/dashboard.php:28`.

Throttle marker:
- File `PRIVATE_PATH/.cleanup_last_run`; throttled to 18000s (5 hours).
  (Docblocks are inconsistent: the function comment says "once per 24 hours" and
  another says 15 days retention — the actual code constant is 18000s/5h.
  Constant to port: 18000.)

Deletes:
- Rows in `instructor_applications` with status IN ('draft','test_failed') AND
  (govt_id_file IS NOT NULL OR marksheet_file IS NOT NULL) AND
  updated_at < NOW() - INTERVAL 15 DAY.
- For each: `_deleteInstructorDocs($app)` removes the uploaded govt_id/marksheet
  files from disk; returns count of apps cleaned. Does NOT delete the application
  row itself (that is purgeRejectedInstructorData's job).

## 5. Rejected instructor data purge — private/functions/instructor_registration.php:552

Trigger:
- `purgeRejectedInstructorData()` from `public/instructor-register/_init.php:34`
  and `public/admin/instructor-applications.php:12`;
  `purgeRejectedInstructorData(true)` from `public/admin/dashboard.php:39`.

Throttle marker:
- File `PRIVATE_PATH/.purge_last_run`; throttled to 18000s (5 hours)
  (comment says 5 hours — consistent).

Deletes/cleans per target row:
- Targets: `instructor_applications` WHERE status IN ('rejected','test_failed')
  OR (status='draft' AND updated_at < NOW() - INTERVAL 15 DAY).
- 1. `_deleteInstructorDocs($app)` removes uploaded doc files from disk.
- 2. DELETE instructor_profiles row for the user.
- 3. DELETE instructor_applications row for the user.
- 4. UPDATE users SET role='student', is_active=1, block_reason=NULL,
  block_note=NULL (keeps id, email, name, password, email_verified; because the
  email remains verified, that user cannot re-register as instructor via the
  Step-1 email check).
- Returns number of users purged.

## 6. Maintenance mode — private/functions/maintenance.php

State file:
- `ROOT_PATH/.maintenance` — JSON:
  `{ "student": bool, "instructor": bool, "enabled_at": "Y-m-d H:i:s",
     "enabled_by": <session user_id or null>, "auto_disable_at": string|null }`
  written with JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES.

API:
- `getMaintenanceStatus(): ?array` — null if no file or invalid JSON or missing
  student/instructor keys. If `auto_disable_at` set and <= now: unlinks the file,
  logs 'auto_disabled' event, returns null (lazy auto-disable on read).
- `setMaintenanceStatus(student, instructor, autoDisableAt=null)` — writes the JSON
  above; if both false, unlinks the file and logs 'disabled'. Logged 'enabled'
  with scope and auto_disable_at.
- `disableMaintenance()` — unlink + 'disabled' log.
- `logMaintenanceEvent(event, context)` — appends
  `[ts] MAINTENANCE | event | {json with user_id, ip, timestamp}` to
  `MAINTENANCE_LOG_FILE` (LOG_PATH/maintenance.log).
- Admin UI: `public/admin/settings.php:343` calls setMaintenanceStatus from the
  settings form; `:378` loads current status into the form.

Scope categorization — `getPageCategory($requestUri)`:
- Strips trailing '/', and a leading '/public' prefix.
- 'system': /razorpay-webhook(.php), /create-order(.php), /verify-payment(.php),
  /mark-order-status(.php), /track-contact(.php), /track-report(.php),
  /sitemap(.php), /robots.txt — always reachable.
- 'admin': any path starting /admin — never blocked.
- 'exempt': /login, /register, /register-success, /forgot-password,
  /reset-password, /password-reset-after-verify, /verify-email,
  /account-activation, /logout (with or without .php), plus everything under
  /auth/ (OAuth callbacks) — never blocked.
- 'instructor_onboarding': /instructor-register*, /instructor-register-success,
  /test and /test/* — gated by the INSTRUCTOR scope.
- 'student': /student/* — gated by the STUDENT scope.
- 'instructor': /instructor/* — gated by the INSTRUCTOR scope.
- everything else: 'public' — gated by the STUDENT scope.

Enforcement — `checkMaintenanceMode()` (called from bootstrap.php every page):
- If status null → return.
- Admin bypass: `$_SESSION['user_role'] === 'admin'` → return.
- Categories admin/exempt/system → never blocked.
- If 'public' or 'student' and status.student → block.
- If 'instructor' or 'instructor_onboarding' and status.instructor → block.
- On block: http_response_code(503), define MAINTENANCE_PAGE_RENDER,
  include ROOT_PATH/public/partials/maintenance-page.php, exit.
- public/partials/maintenance-page.php refuses direct hits: if
  MAINTENANCE_PAGE_RENDER is not defined it returns a plain 404.
- public/media.php (lesson_pdf) returns 503 JSON when student maintenance is on.

Admin banner:
- public/navbar.php:810-817 includes public/partials/admin-maintenance-banner.php
  only when a scope is active (via getMaintenanceStatus()); the banner is a
  sticky top amber (#f59e0b) bar: "Maintenance Mode Active · Blocking: <Student|
  Instructor|Student & Instructor> · Auto-disabling at HH:MM" (uses
  auto_disable_at time), with a link to /admin/settings. Self-contained styles
  with `admbn-` prefix, sticky below navbar (`--unav-h`).

## 7. Cron-state/log files that must move to the DB (per section 9 of AGENTS.md)

| PHP file/marker | Moves to |
| --- | --- |
| `PRIVATE_PATH/.cleanup_last_run` | `cron_state` row (e.g. key `cleanup_stale_draft_docs`) |
| `PRIVATE_PATH/.token_cleanup_last_run` | `cron_state` row (`token_cleanup`) |
| `PRIVATE_PATH/.purge_last_run` | `cron_state` row (`purge_rejected_instructor_data`) |
| `app_settings.last_payment_reconcile_run` | keep (already a setting) or `cron_state` row |
| `app_settings.last_cleanup_run` | keep (already a setting) or `cron_state` row |
| `ROOT_PATH/.maintenance` (JSON flag) | `app_settings` row or dedicated maintenance row/column; same JSON shape |
| `LOG_PATH/maintenance.log` | `maintenance_logs` table + console |
| `LOG_PATH/php_errors.log` | `security_events`/console per event type |
| `LOG_PATH/security.log` | `security_events` table |
| `LOG_PATH/uploads.log`, `banners.log` | equivalent tab; check usage in storage/banner phases |

## 8. New-app equivalents (Vercel)

- Vercel Cron routes under `app/api/cron/*` protected by `CRON_SECRET`
  (`Authorization: Bearer`): payment reconcile sweep, cancelled-order purge,
  token cleanup, stale draft docs cleanup, rejected instructor purge.
- Keep the PHP "lazy on request" fallback for each job (same throttle windows and
  same claim-by-conditional-update semantics) so a missed cron tick self-heals.
- vercel.json schedules each route; note Hobby plan allows at most daily cron —
  the lazy fallback is therefore mandatory in that configuration (DEPLOY.md).
- Maintenance mode: DB-driven, checked in middleware/proxy (`middleware.ts` or
  `proxy.ts` per installed Next version) with the same category gating and admin
  bypass; admin banner and 503 page preserved; media route keeps 503 JSON.

## Open questions

- Code as-shipped uses RECONCILE_INTERVAL_SECONDS=60 and RECONCILE_GRACE_SECONDS=10
  and RECONCILE_ABANDON_AFTER=120 with comments saying 900/600/30min for live.
  Which values should the new app ship with — the in-file comments (likely the
  live intent) or the as-written constants?
- Docblocks for cleanupStaleDraftDocs say "once per 24 hours"/"once per 15 days"
  in places; actual throttle is 18000s (5h). Port 5h (code) and document.
- Should the reconcile abandon-window note ("30 minutes") govern the new cron,
  or the shipped 120s?
- `docs_delete_after`/`docs_scheduled_delete` were mentioned in the brief but
  do NOT exist in the old codebase (grep found no references) — confirm they are
  genuinely absent and no scheduling of document deletion existed.
- Maintenance auto-disable uses the PHP server's local clock (time()); with
  timestamptz + UTC in Postgres the comparison must be UTC — confirm intended
  semantics for `auto_disable_at` (stored timezone) in the new app.
- admin/dashboard.php force-runs all three cleanups with no CSRF/rate-limit
  beyond auth — preserve exact behavior (admin-only) in the new admin dashboard.
