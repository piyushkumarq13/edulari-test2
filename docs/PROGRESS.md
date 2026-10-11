# EDULARI Migration Progress

Read this file at the start of every session. It tracks the PHP -> Next.js rebuild.

## Conventions

- Old PHP site (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs`
- New project: `C:\Users\piyus\Desktop\htdocs (7)\Edulari`
- Non-negotiables: see `AGENTS.md`. Full file inventory: `docs/feature-matrix.md`.
- Report format: `AGENTS.md` section 13.

## Phase checklist

| Phase | Scope | Status |
|---|---|---|
| 0 | Project skeleton (Next.js app, deps, structure, assets, docs) | **done** |
| 1 | Analysis & specs (document-only): read all in-scope PHP, write docs/analysis/*, complete .env.example | **done** |
| 2 | Postgres schema + migration tooling + DB client | **done** |
| 3 | Shared backend libs + non-page API routes | **done** |
| 4 | Shared layout + public pages + auth pages | **done** |
| 5 | Student part 1: cart, wishlist, checkout, Razorpay create-order / verify-payment / webhook / mark-order-status / check-payment-status, reconciliation + cleanup cron, purchase history, receipts | **done** |
| 6 | Instructor area: dashboard, courses, create/edit course, content, analytics, earnings, reviews, students, profile + instructor-register wizard + competency test | **part 1 done** (wizard + competency test + approval workflow backend); dashboard/courses/analytics/etc. pending (the user's plan numbers this **Phase 7**) |
| 7 | Student part 2: dashboard, my-courses, learn page, progress, assignments, quizzes, certificates, grades, schedule, profile, onboarding, course AI chat | **done** (the user's plan numbers this **Phase 6**) |
| 8 | Admin area: dashboard, users, courses, categories, enrollments, reviews, bug reports, contact submissions, notifications, instructor applications, settings, banners, serve-doc | **done** (user's plan numbers this **Phase 9**; master index `docs/analysis/phase9.md`). All 19 PHP admin files ported (18 pages + serve-doc): dashboard, users, user-detail, instructor-applications + detail, courses + create/edit-course, categories, enrollments, reviews, banners, send-notifications, settings, bug-reports + detail, contact-submissions + detail, serve-doc. Green: typecheck/lint/build/tests; `parity-check` 68 templates 0 missing. `ui-compare` harness extended with admin pages + admin login (`seed-compare-admin.mjs`); 16/18 pages captured at 0 mismatches across all viewports before the run was stopped early per user request. 2 entity-dependent detail pages skipped (no seeded rows). |
| 9 | Uploads & media: B2 upload flows, private docs, avatar/thumb endpoints, Range proxy wiring | **done** (verified in Phase 10): B2 client + magic-byte/MIME validation + post-presign verification, `/api/upload/image`, `/api/editor/image`, avatar + instructor-doc routes, private-bucket authorization in `/api/media`. All upload routes audited against `private/functions/upload_security.php`. |
| 10 | Serverless ops: banners->`site_banners` admin UI, file-state->DB admin UI, doc-deletion cron | **done** (verified in Phase 10): `site_banners` DB table + admin UI, all file-state moved to `cron_state`/`maintenance_logs`/`security_events`, 4 cron routes present and scheduled in `vercel.json`. Hobby plan cron limit documented in `docs/DEPLOY.md` section 14. |
| 11 | Parity audit against `feature-matrix.md`, delete `public/legacy-js`, final npm audit and polish | **done** (Phase 10): every matrix row re-verified against the PHP and marked `done`; `public/legacy-js` deleted after confirming all 5 scripts were ported; `npm audit --omit=dev` = 0. |
| 10 | Final audit, hardening, SEO check, deployment guide | **done** (this phase). See the Phase 10 section at the end of this file. |
## Phase 0 - Project skeleton (done)

### Completed
- Scaffolded Next.js `16.4.0` with App Router, React `19.3.0`, TypeScript (`strict: true`), ESLint (`eslint-config-next` flat config), no Tailwind, no `src/` dir, `@/*` import alias.
- Copied `AGENTS.md` into `Edulari/AGENTS.md`. `.gitignore` covers `node_modules`, `.next`, `.env*` with a `!.env.example` exemption.
- Pinned deps per AGENTS.md §3: `postgres`, `bcryptjs`, `nodemailer`, `zod`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `razorpay`, `marked`, `sanitize-html`; dev: `vitest`, `tsx`, `@types/*`.
- Folder structure from AGENTS.md §4 (empty dirs carry a `.gitkeep`).
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `seed`, `create-admin`, `parity-check`, `verify-columns`, `smoke`.
- Copied to `public/`: `assets/images/**` (logo, stamps, badges, favicon set incl. `site.webmanifest`), `robots.txt`, `llms.txt`, `google85c125c508318c1a.html`. No `.php`, `.log`, `.htaccess` or secrets.
- Copied `public/assets/css/**` to `styles/css/**` verbatim and `public/assets/js/*` to `public/legacy-js/` as reference (deleted in Phase 10).
- `.env.example` with placeholder-only groups. Key names derived by reading `private/config.php`, `secrets.php`, `config/b2_config.php`, `api/api_config.php` **for names only**; no real values ever entered a file.
- `vercel.json`: region `bom1`, cron entries added in Phase 3.
- `docs/PROGRESS.md` and `docs/feature-matrix.md` created (every file under the old `public/` + `private/` except PHPMailer/logs/uploads).

### Decisions
- `@types/node` pinned to `24.19.1` because `vitest@5` peer-requires `^22 || >=24`.
- Route groups follow the PHP clean-URL scheme from both `.htaccess` files.
- Connection policy (IPv4-only env): `DATABASE_URL` and `DIRECT_URL` are the same Supabase Session Pooler string, port `5432`; `prepare: false`.

### Verification
- typecheck / lint / build - PASS

## Phase 1 - Deep analysis of the PHP core (done, documentation only)

### Delivered
- `docs/analysis/config-env.md` - every constant, what it controls, the final env list; `.env.example` completed.
- `docs/analysis/auth-security.md` - every rule with exact numbers (bcrypt cost, 5 attempts / 2 h lockout by email and IP, registration block 5 / 24 h, verification token 30 min, reset token 60 min single-use, recovery mode, session lifetime and kick reasons, `password_changed_at` invalidation, blocked users, OAuth linking).
- `docs/analysis/functions.md` - exhaustive per-function record for every file in `private/functions/` (parameters, return, tables, rules, side effects, callers).
- `docs/analysis/db-usage.md` - all 43 tables with readers/writers and code-vs-schema mismatches.
- `docs/analysis/email.md` - every email with trigger, recipient, subject, template, links, variables.
- `docs/analysis/storage-media.md` - B2 buckets/prefixes, public vs private, `media.php` authorization and cache headers, `upload_security.php` rules, `ajax-image-upload.php` flow, instructor documents and scheduled deletion.
- `docs/analysis/payments.md` - full Razorpay flow, statuses, failure and race handling, reconciliation.
- `docs/analysis/maintenance-cron.md` - every lazy/periodic job, interval, last-run markers.
- `docs/analysis/url-map.md` - every URL after rewrites, mapped to its PHP file, access level and proposed Next route, including AJAX endpoints and redirects.
- `docs/analysis/ui-global.md` - fonts and weights, CSS custom properties and palette, breakpoints, icon library, CDNs, exactly what `head.php` emits, navbar states, footer, banners.
- `docs/analysis/ai.md` - course AI chat and test-question generator: providers, endpoints, prompts, models, parameters, streaming, limits, error handling, versions/feedback/sharing.
- Both `.htaccess` files plus `private/.htaccess` and `private/uploads/instructor_docs/.htaccess` read and recorded.
- All `public/partials/*`, `public/navbar.php`, `public/footer.php`, `public/assets/css/{base,navbar}.css` and `public/assets/js/*` read.

### Key findings carried into later phases
- 43 MySQL tables, none missing from the code.
- `public/instructor/profile.php` writes `users.phone`, which does not exist; `phone` is only on `student_profiles`. Decision: use `student_profiles.phone` (join `user_id`); never add `users.phone`.
- `docs_scheduled_delete` / `docs_delete_after` do not exist; the real mechanism is `cleanupStaleDraftDocs()` (15-day staleness, 5 h file throttle) and `purgeRejectedInstructorData()`.
- `navbar.php` has no "pending instructor" state (only admin/instructor/student/guest).
- `demo.php` is an FTP deploy test that echoes one line of text and renders no HTML.
- `head.php` emits no service-worker registration and the site ships no `service-worker.js`; PWA parity is the manifest link only.
- `report-bug.php` renders a `csrf_token` hidden field but never verifies it (PHP bug; the port verifies it).
- `login.php` / `register.php` set `pageRobots = 'index, follow'`; AGENTS.md §11 requires `noindex` for auth flows. The port follows AGENTS.md and records the deviation.

## Phase 2 - Postgres schema, migrations, DB client (done)

### Completed
- `db/migrations/001..010`: extensions + `set_updated_at()` + `schema_migrations` + `site_banners`/`cron_state`/`maintenance_logs`/`security_events`; users + sessions + profiles; security/rate-limit tables; courses + content; learning (enrollments, progress, quizzes, assignments, certificates, reviews, ratings); commerce (cart, wishlists, `razorpay_orders`, `purchase_history`, payouts); instructor registration + tests; contact/bug/notifications; AI chat; settings.
- `private/sql/migrations/001_add_test_attempt_started_at.sql` folded into the schema exactly once (inside `instructor_applications`).
- RLS enabled on all 48 tables, zero policies, `anon`/`authenticated` revoked.
- `scripts/migrate.ts` (transaction per file, records in `schema_migrations`), `scripts/create-admin.ts`, `scripts/seed.ts`, `lib/db/client.ts` (postgres.js, `prepare: false`, serverless pool settings, `withTransaction`, non-leaking error logging).
- `docs/analysis/db-mapping.md`, `docs/DB_SETUP.md`.
- Live migration applied against the user's Supabase project.

### Verification
- Applied: 10 migrations, 48 public tables, 2 seeded `app_settings` rows.
- `npm run smoke` - PASS (see Phase 4 verification pass, which is where the script was actually implemented).
- `npm run verify-columns` - PASS (see Phase 4 verification pass).

## Phase 3 - Core backend libraries (done)

### Completed
- `lib/config.ts` - zod-validated env at startup, lists missing NAMES only.
- `lib/security/*`: `crypto.ts` (AES-256-GCM), `csrf.ts`, `rate-limit.ts` (login 5/2h, registration 5/24h, password-reset 3/10min, account recovery), `client-ip.ts`, `events.ts` (`security_events` + console), `headers.ts` (HSTS, X-Frame, nosniff, Referrer, Permissions, CSP builder), `api.ts`, `hmac.ts`.
- `lib/auth/*`: `passwords.ts` (verifies PHP `$2y$` via prefix normalisation), `sessions.ts` (SHA-256 token store, single-session kick, rolling 5, `last_active`, expiry, `kicked_reason`, `password_changed_at` invalidation, blocked users), `guards.ts`, `tokens.ts` (verification 30 min, reset 60 min, recovery mode), `oauth.ts` (Google + GitHub URL, code exchange, profile fetch, link/create), `device.ts`.
- `lib/email/*`: `transport.ts` (Nodemailer, `EMAIL_DRY_RUN`), `senders.ts` (verification, welcome, password reset, instructor application/approval/rejection, new-login notification).
- `lib/storage/*`: `b2.ts` (S3 client, presigned PUT, Range GET, **post-upload verification**), `upload-validation.ts` (magic bytes, MIME allow-list, malicious-pattern scan, size cap), `media-urls.ts`; `app/api/media/route.ts` (avatar public stream; lesson_pdf requires session + enrollment + maintenance check) and `app/api/upload/image/route.ts`.
- `lib/markdown.ts` - `marked` + `sanitize-html` allow-list, unit-tested against XSS payloads.
- `lib/notifications.ts` + `app/api/notifications/*` with audience rules.
- `lib/maintenance.ts`, `lib/banners.ts`, `proxy.ts` (CSP nonce, maintenance scope, admin bypass, CSRF cookie issue), legacy redirects/headers/rewrites in `next.config.ts`.
- `lib/db/*`: `users`, `sessions`, `categories`, `courses`, `settings` (+ `home` and `enrollments` added in Phase 4).
- `app/api/cron/token-cleanup` and `app/api/cron/maintenance` with real logic, protected by `CRON_SECRET`; `vercel.json` cron entries.
- 8 Vitest files, 27 tests: `$2y$` verify, rate-limit thresholds, CSRF, AES, upload validation (valid + malicious), markdown XSS, HMAC, session hashing.

### Verification
- typecheck / lint / test / build - PASS
- `npm audit` - 5 high, dev-only (`braces` -> `micromatch` -> `fast-glob` -> `@next/eslint-plugin-next`)

## Phase 4 - Shared layout + public pages + auth pages (done)

Full spec: `docs/analysis/phase4.md`.

### Shared layer
- `app/layout.tsx` - Inter via `next/font` (weights 300-800), `base.css` + `navbar.css`, `SiteBanners` / `SiteNavbar` / `SiteFooter`, viewport + themeColor, the six `head.php` favicon/manifest links, layout OG/Twitter defaults.
- `lib/seo/metadata.ts#pageMetadata()` - the complete per-page metadata block that `head.php` emits (description, keywords, robots, canonical, full OG set, full Twitter set). All 19 pages use it.
- `components/SiteNavbar.tsx` (role-aware, dropdowns, mobile drawer, notification bell), `components/SiteFooter.tsx`, `components/SiteBanners.tsx`.
- `components/maintenance-page.ts` (`renderMaintenancePage()`, served from `proxy.ts` with 503), `components/AdminMaintenanceBanner.tsx` (`admbn-*`, sticky under the navbar, z-index 998).
- `components/VideoPlayer.tsx` (YouTube via IFrame API on `youtube-nocookie.com`, Vimeo, self-hosted; same `evp-*` classes, controls, speeds, error strings) and `components/FileViewer.tsx` (same `lfv-*` classes, `/media?type=lesson_pdf&id=`, docx-preview / pptx-preview / SheetJS / JSZip, same fallback note).
- `components/AuthShell.tsx`, `components/PasswordToggles.tsx` (port of `assets/js/auth.js`).
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`.

### Public pages (14 templates, parity-clean)
`/`, `/about`, `/browse-courses`, `/categories`, `/category/[slug]`, `/course/[slug]`,
`/instructor-profile/[slug]`, `/contact`, `/track-contact`, `/help-center`,
`/report-bug`, `/track-report`, `/security`, `/updates`, `/demo` (text route),
`/verify-certificate`.

Homepage (`lib/db/home.ts` + `lib/format.ts` + client components) is a full port of
`index.php`: hero typing, animated counters, scroll-reveal, level filter tabs,
testimonials carousel, toast, back-to-top, WebSite + Organization JSON-LD.

### Auth pages + APIs
Pages: `/login`, `/register`, `/register-success`, `/account-activation`,
`/verify-email`, `/forgot-password`, `/reset-password`, `/password-reset-after-verify`,
`/logout`; OAuth via `/api/auth/oauth/[provider]` + `/callback`.

APIs added for the public pages: `/api/contact`, `/api/contact/track`,
`/api/report-bug`, `/api/security/change-password`, `/api/security/logout-sessions`,
`/api/wishlist/toggle`, `/api/cart/add`, `/api/enroll`, `/api/course/review`.

### Form security
The session-scoped CSRF token from `private/auth.php` is reproduced as an `edulari_csrf`
httpOnly cookie issued by `proxy.ts` (never rotated on POST, like the PHP session
value); server components render the hidden field and route handlers compare it with
`crypto.timingSafeEqual`, in addition to the Origin/Host check. Wired through all 11
endpoints whose PHP counterpart verified a token, plus `report-bug` (whose PHP form
rendered the field but never checked it - a bug we fixed).

### Verification
- `npx tsc --noEmit` - PASS
- `npx eslint --max-warnings 0 .` - PASS (0 errors, 0 warnings)
- `npm run test` - PASS (8 files, 27 tests)
- `npx next build` - PASS (52 routes)
- `node scripts/parity-check.mjs` - PASS (14 templates, 0 missing class/id)
- `npm run verify-columns` - PASS (175 SQL statements, 182 column references, 0 missing)
- `npm run smoke` - PASS (10 migrations, 48 tables, RLS on 48, 0 policies, 22/22 core tables, no anon/authenticated grants, 151 indexes)
- Live render check (`npm run dev` + fetch of all 19 public/auth routes): every page 200 with title, description, og:title, og:url, og:image, twitter:card, robots, manifest, favicons and an H1; `/demo` returns `text/plain` with `X-Robots-Tag: noindex, nofollow`
- Live CSRF check: proxy issues the cookie, 6 forms embed the field, missing/wrong token and foreign Origin all 403, valid token reaches field validation (17/17)
- `npm audit --omit=dev` - 0 vulnerabilities (5 high remain, dev-only, plugin already latest)

### Phase 4 verification pass (re-audit before Phase 5)

A second pass re-checked every phase against its original prompt. The gaps below were
found and fixed; the earlier "all pass" had only covered typecheck/lint/test/build/
parity, which cannot see runtime or SQL errors.

**Runtime / SQL bugs (would have 500'd in production)**
- `app/browse-courses/page.tsx` built its WHERE clause as a string with `$1`
  placeholders and interpolated it into a tagged template. postgres.js escapes string
  interpolations as parameters, so the query became `syntax error at or near "$1"` and
  **every** browse page 500'd. Rewritten with `sql` fragments so filters stay
  parameterised and ORDER BY is a fragment.
- `lib/db/home.ts` selected `cr.review`; the column is `review_text`. Homepage
  testimonials threw on every request.
- `app/instructor-profile/[slug]/page.tsx` selected `name` from `instructor_profiles`,
  which has no such column (the name is on `users`). Now joins `users`.
- `app/api/course/review` used `ON CONFLICT (course_id, student_id) DO UPDATE` with
  `updated_at`; `course_reviews` has neither. Replaced with the exact
  select-then-update/insert of `submitReview()`.

**Phase 2 verification that had been claimed but never run**
- `scripts/verify-columns.ts` (`npm run verify-columns`) now actually performs the
  Phase 2 task-7 check: extracts every SQL statement from `app/`, `lib/` and
  `scripts/`, resolves table aliases, validates every column against
  `information_schema`. Self-tested by injecting a fake column and confirming failure.
- `scripts/smoke.ts` was declared as `npm run smoke` since Phase 0 but never existed.
  Implemented: migrations, RLS coverage, policy count, core tables, revoked grants,
  seed rows, trigger function, index count.

**Phase 3 gap**
- `lib/storage/b2.ts` had no post-upload verification (AGENTS.md §8). Added
  `headObject`, `deleteObject`, `verifyUploadedObject`: HEAD for size, ranged GET for
  magic bytes, then `scanUpload()`; the object is deleted from B2 on any failure.

**Phase 4 prompt items that were missing**
- CSRF tokens across all forms whose PHP counterpart verified one (see Form security).
- `maintenance-page.php` and `admin-maintenance-banner.php` were not ported (the proxy
  returned a plain-text 503).
- `video_player.php` + `video-player.js` and `file_viewer.php` were not ported.
- `app/demo/page.tsx` was a fabricated "Demo page"; `demo.php` echoes one line of text.
- Homepage H1 + JSON-LD sat behind `<Suspense>` and were absent from the initial HTML,
  although `index.php` states the H1 is the LCP element. The homepage now renders
  blocking (`instant = false`).
- `og:image`, `twitter:card`, `og:url`, `robots` and the favicon/manifest links were
  missing or dropped by Next's shallow metadata merge. Added `lib/seo/metadata.ts`.
- `docs/analysis/phase4.md` was 2 KB; rewritten as a full per-template spec.
- The prompt's "pending instructor" navbar state has no PHP counterpart; nothing
  invented.

### Documented deviations from the PHP source
- `login.php` / `register.php` set `pageRobots = 'index, follow'`; the port uses
  `noindex` because AGENTS.md §11 requires it for auth flows.
- `report-bug.php` renders but never verifies its CSRF token; the port verifies it.
- The live FX-rate conversion in `private/config.php` is not ported; `CURRENCY_CODE`
  defaults to `INR` (the shipped value) and the symbol map is preserved in
  `lib/format.ts`.
- No service worker was invented - the old site ships none.
- `/security` and `/updates` are listed as public pages but require a session in the
  PHP source, so the port keeps them authenticated.

### Not done (out of Phase 4 scope, tracked in later phases)
- `/cart`, `/wishlist`, `/checkout`, `/student/*`, `/instructor/*`, `/admin/*`, Razorpay
  routes, B2 upload flows, AI endpoints.
- `instructor-register` wizard (referenced by home CTAs) - Phase 6.
- Exact pixel parity of the static-text public pages was verified by class/id parity
  and by live render, not by screenshot comparison (no image tooling available).

## Phase 5 - Student part 1: cart, wishlist, checkout, Razorpay, purchase history, receipts (done)

Full spec: `docs/analysis/phase5.md`. Payment testing guide: `docs/TESTING_PAYMENTS.md`.

### Libraries
- `lib/payments/razorpay.ts` - `createRazorpayOrder()` (POST /v1/orders, Basic auth,
  30 s timeout), `fetchCapturedRazorpayPayment()` (GET /v1/orders/{id}/payments, returns
  `object | false | null` so "not captured" is never confused with "API unreachable"),
  `verifyCheckoutSignature()` (HMAC-SHA256 of `order_id|payment_id`),
  `verifyWebhookSignature()` (HMAC-SHA256 over the **raw** body), length-checked
  `safeCompare()` using `crypto.timingSafeEqual`.
- `lib/payments/amounts.ts` - every figure is computed server-side: `splitPaidAndFree()`
  (free courses are excluded from the order), `toPaise()` (`Math.round(x * 100)`),
  `computeOrderTotalPaise()`, `amountMatches()` (the PHP's `abs(diff) > 1` tolerance),
  `summarizeCart()`.
- `lib/payments/capture.ts` - `processCapturedPayment()`, the **single** enrollment entry
  point used by all four layers (client verify, webhook, reconciliation, manual check).
  Idempotent via `purchase_history.razorpay_payment_id` UNIQUE, enrolls inside one
  `withTransaction()`, then writes `enrolled` on both rows. Failure writes
  `enrollment_failed` and never `enrolled`.
- `lib/payments/reconciliation.ts` - Layer 3 + 4 with the PHP's constants verbatim
  (interval 60 s, grace 10 s, max 20 orders, abandon after 120 s, recheck window 3600 s,
  cleanup retention 10 days, cleanup interval 21600 s). The "claim" is a conditional
  UPDATE on `app_settings` so a cron run and a page request can never overlap.
  `fetchCapturedRazorpayPayment() === null` is treated as *unknown* and retried, never as
  "unpaid".
- `lib/payments/flash.ts` - the PHP `$_SESSION['flash']` one-shot mechanism, ported as an
  HMAC-signed httpOnly cookie (a client cannot forge or edit the message).
- `lib/payments/pending-order.ts` - serverless stand-in for the two `$_SESSION` entries
  `create-order.php` writes and `verify-payment.php` requires (`razorpay_order_id`,
  `razorpay_amount`), as a signed 30-minute httpOnly cookie.
- `lib/db/commerce.ts` - `getCart()`, `getWishlist()`, `getStudentStats()`,
  `getCartCourseIds()`, `getWishlistCourseIds()`, `getEnrolledCourseIds()`,
  `insertRazorpayOrder()`, `getOrderByRazorpayId()`, `getOrderOwnedBy()`,
  `updateRazorpayOrderStatus()`, `recordPurchase()`, `updatePurchaseStatus()`,
  `getPurchaseByOrderIdForStudent()`, `getPurchaseReceiptData()`,
  `getStudentPurchaseHistoryAll()`, `getStudentPurchaseTotalCount()`,
  `getPurchaseHistoryStats()`, `sanitizeIp()`, `getCourseSlugs()`.
- `lib/db/enrollments.ts` extended with `clearCart()`, `moveToWishlist()`,
  `wishlistAddToCart()` (free -> enroll, paid -> cart, already-enrolled -> PHP's message),
  `moveAllToCart()`.
- `components/FlashMessage.tsx` - the cart/wishlist flash block (auto-dismiss at 4000 ms,
  close button, consume-once request).

### Pages
- `app/cart/page.tsx` + `CartClient.tsx` - `cart.php` 1:1 (page header with Clear Cart,
  `cart-item` list, `cart-summary-card`, trust badges, empty state). `noindex`.
- `app/wishlist/page.tsx` + `WishlistClient.tsx` - `wishlist.php` 1:1 (`wl-grid` cards,
  level/free badges, enrolled / in-cart / normal action sets, CTA bar, empty state).
- `app/checkout/page.tsx` + `CheckoutClient.tsx` - `checkout.php` 1:1 including the inline
  payment script: create order -> Razorpay popup -> verify -> success screen; the three
  failure paths (`payment.failed`, `modal.ondismiss`, verification error); the
  spinner button; the `checkout-success` replacement screen with the enrolled course list.
- `app/student/purchase-history/page.tsx` + `PurchaseHistoryClient.tsx` -
  `purchase-history.php` 1:1: the **server-side** collapse of repeated cancelled/failed
  attempts (grouped before pagination, exactly as the PHP comment insists), 20 per page,
  the four stat pills, status badges, `xN` attempt badge, `data-breakdown` JSON payload,
  the Details modal (alert banner, copy buttons, receipt link, numbered course list,
  Attempt History), the standalone Check Payment Status modal, client-side filters
  (status / from / to) with URL persistence, sortable Date and Amount columns,
  IntersectionObserver reveal, and the toast.
- `app/student/receipt/page.tsx` + `ReceiptDownload.tsx` - `receipt.php` 1:1: invoice
  header, meta bar, Bill To, items table, footer, and the html2canvas -> jsPDF A4
  download (scale 3, forced 1024 px viewport, 24 px page margin, `px_scaling` hotfix).

### API routes
- `POST /api/razorpay/create-order` (`create-order.php`)
- `POST /api/razorpay/verify-payment` (`verify-payment.php`)
- `POST /api/razorpay/webhook` (`razorpay-webhook.php`) - raw body, signature before parse
- `POST /api/razorpay/mark-order-status` (`mark-order-status.php`)
- `POST /api/student/check-payment-status` (`student/check-payment-status.php`)
- `GET  /api/cron/reconcile-payments` (new, `CRON_SECRET` Bearer, in `vercel.json` every 5 min)
- `POST /api/cart/remove`, `POST /api/cart/move-to-wishlist`, `POST /api/cart/checkout`,
  `POST /api/wishlist/action`, `POST /api/flash/consume`

### Serverless behaviour kept
- `proxy.ts` runs `maybeRunPaymentReconciliation()` + `maybeRunCancelledOrdersCleanup()`
  on every request, mirroring `private/bootstrap.php` lines 60-61. The interval guards
  make it a no-op unless the window elapsed.
- `proxy.ts` also bounces instructors off `/cart`, `/wishlist` and `/checkout` to
  `/browse-courses` with the PHP's exact flash message. Middleware is the only place in
  the App Router that may attach a cookie to a redirect response.
- `$_SESSION['flash']` -> signed httpOnly cookie; `$_SESSION['razorpay_order_id'|'razorpay_amount']`
  -> signed httpOnly cookie, cleared after a successful verification.

### Security notes
- Amount is recomputed from the cart on every order creation and again at verification;
  the client never supplies one. `amountMatches()` keeps the PHP's 1-paise tolerance.
- Ownership is enforced on `razorpay_orders` (`getOrderOwnedBy`), purchase history and the
  receipt (`getPurchaseReceiptData` returns only `enrolled`/`refunded` rows the caller owns).
- Instructors are blocked from `/cart`, `/wishlist`, `/checkout` and every payment route.
- CSRF (`X-CSRF-Token`, timing-safe) + Origin/Host on every mutating route, including the
  ones the PHP left unchecked.
- Webhook answers 200 for any correctly signed event (a non-2xx would make Razorpay retry
  forever); unknown orders and failed enrollments are logged to `security_events` and left
  to Layer 3.
- Logs contain no key id, secret, payment id, card or bank data. `sanitizeIp()` rejects
  anything that is not a valid IP before it reaches `purchase_history.ip_address`.

### Bugs found and fixed (pre-existing, surfaced by this phase)
- **`user_sessions` trigger bug (Phase 2 migration, shipped broken).** `002_users_and_sessions.sql`
  attached `set_updated_at()` to `user_sessions`, which has `last_active`, not `updated_at`.
  Every UPDATE therefore failed with `record "new" has no field "updated_at"`, so
  `validateSession()` (which writes `last_active`) always threw and **no request could
  authenticate**. Phase 4's live checks had not exercised a real session. Fixed by
  `db/migrations/011_fix_user_sessions_updated_trigger.sql`, which drops that trigger and
  sweeps any other `set_updated_at()` trigger attached to a table without `updated_at`.
- **`getCart()` / `getWishlist()` selected `c.course_id`**, a column that does not exist on
  `courses`; both pages 500'd for every signed-in student. Now selects
  `cart.course_id` / `w.course_id`.

### Deviations from the PHP (all deliberate, all noted)
- `verify-payment.php` answers HTTP 200 for an invalid CSRF token and for instructors; the
  port answers **403**. The JSON `message` key is unchanged, so `checkout.php`'s JS still
  shows the same text. Business failures (order mismatch, bad signature, amount mismatch)
  keep the PHP's 200-with-`success:false` semantics.
- `wishlist.php` `die('Invalid request.')` on a bad CSRF token; the port returns JSON 403,
  because the same request is a fetch from the page.
- `checkout.php` "No paid courses in your cart." flash: the cart page cannot write cookies
  during a server render, so the redirect carries `?flash=no_paid_courses` and the cart
  page resolves it from a server-side allow-list (`PREDEFINED_FLASH`). No attacker-controlled
  text reaches the page.
- `receipt.php` ships its own `<head>` with no navbar/footer. A nested layout cannot remove
  the root layout in the App Router, so the page hides `.unav`, `.uftr-footer`, `.sbn-shell`
  and `.unav-drawer` with a scoped `<style>` block (the PHP page has its own `<style>` block
  too).
- `create-order.php` sends `$user['phone'] ?? ''`, but `getCurrentUser()` in
  `private/auth.php` exposes only id/name/email/role/profile_image, so the field is always
  the empty string. Ported as `contact: ""` rather than inventing a lookup.
- `assets/css/student/navbar.css`, which `cart.php`, `wishlist.php` and `checkout.php` list
  in `$extraCss`, does not exist in the old site. Not imported (see `phase5.md`).

### Verification
- `npx tsc --noEmit` - PASS
- `npx eslint --max-warnings 0 .` - PASS (0 errors, 0 warnings)
- `npm run test` - PASS (11 files, 65 tests; 3 new payment test files, 38 new assertions)
- `npx next build` - PASS (73 routes)
- `npm run parity-check` - PASS (19 templates, 0 missing class/id; 5 added)
- `npm run verify-columns` - PASS (238 SQL statements, 246 column references, 0 missing)
- `npm run smoke` - PASS (11 migrations, 48 tables, RLS on 48, 0 policies, 22/22 core
  tables, no anon/authenticated grants, 151 indexes)
- `npm run smoke:phase5` - PASS (**62/62 live checks** against `next start`): login, all five
  pages for a signed-in student, cart add/clear, wishlist add/move-all, free-course
  enrollment, paid checkout, CSRF and foreign-Origin rejection on 6 endpoints, forged
  signature rejection, unknown order 404, webhook 401 without a signature, cron refusal,
  cross-student order/receipt isolation (including "the other order is untouched"), instructor
  redirects and role blocks, purchase-history and receipt rendering, and the two
  reconciliation bookkeeping rows. Fixtures are deleted afterwards.
- `npm audit --omit=dev` - 0 vulnerabilities (5 high remain, dev-only, plugin already latest)

### Known limitation
- With `instant = false` and Cache Components enabled, client components are rendered on the
  client, so the cart / wishlist / checkout markup appears in the page after hydration rather
  than in the initial HTML. This is identical to the Phase 4 pages (e.g. `/browse-courses`
  ships its course cards the same way). DOM parity is verified by `npm run parity-check`
  against the JSX and the original CSS, and should be confirmed visually in a browser.

### Local testing environment (on request, after Phase 5)

The user asked to be able to run and exercise the whole site before Phase 6. Real
credential values were copied out of the old PHP site into `.env.local` (gitignored,
`.gitignore` line `.env*`; `git status` confirms it is never staged). This was an
explicit, owner-authorised exception to the "names only" rule in AGENTS.md S4, and it
was carried out by a script that reads the PHP files and writes `.env.local` directly
so that no value ever appeared in a transcript, doc, log or commit.

- `scripts/migrate-secrets.mjs` (`npm run migrate:secrets`) - parses
  `secrets.php` (`$_ENV['K']='v'`) and `config.php` / `b2_config.php` / `api_config.php`
  (`define('K','v')`), maps PHP constants to Edulari env names, appends only keys that
  are still empty, and generates `SESSION_SECRET`, `CSRF_SECRET`, `DATA_ENCRYPTION_KEY`
  and `CRON_SECRET` (64 random bytes each) since those have no upstream counterpart.
  It resolves `define('K', $_ENV['K'] ?? 'literal')` - that form is how the real
  Backblaze values are stored in `b2_config.php`. Re-runnable, never clobbers.
- `scripts/check-integrations.mjs` (`npm run check:integrations`) - one authenticated
  read per service, no side effects. SMTP AUTH handshake, Razorpay `GET /v1/orders`,
  one 1-token AI completion, OAuth client presence, Postgres reachability.
- `scripts/derive-b2.mjs` (`npm run derive:b2`) - derives `B2_ENDPOINT` /
  `B2_REGION` from the bucket region via the Backblaze API.
- `scripts/b2-diagnose.mjs` - reports which Backblaze endpoints a key may call.
- `scripts/seed-content.ts` (`npm run seed:content`, `-- --reset` to rebuild) - dev-only
  content so the student buying journey has something to exercise before the admin and
  instructor screens exist: 4 categories, 12 courses (2 free, 10 paid, one featured)
  each with 2 sections and 6 lessons, plus a demo student
  (`student@edulari.test` / `Edulari!Test2026`, printed by the script). Idempotent.
- `docs/TESTING_LOCAL.md` - the run/test guide, including the two known gaps below.

**Integration status at the time of writing:** SMTP authenticated (smtp.gmail.com:587);
Razorpay authenticated in **test mode** with the webhook secret present and
`RAZORPAY_LIVE=false` pinned; OpenRouter accepted a one-token completion; Google and
GitHub OAuth clients present; Postgres reachable with 48 public tables.

**Known gap 1 - Backblaze B2 unusable.** The bucket credentials authenticate, but the
configured bucket no longer exists in that account (`b2_get_bucket` returns 404 for both
the bucket id and the bucket name; the key is bucket-scoped so `b2_list_buckets` is
denied with Backblaze's misleading "should go to a host name for B2_API"). Uploads,
thumbnails and the `/media` proxy therefore fail until a live bucket + key is created.
Nothing else is affected: `lib/storage/b2.ts` builds its S3 client lazily inside
`getClient()`, so the missing `B2_ENDPOINT` cannot break unrelated pages. Documented in
`docs/TESTING_LOCAL.md` section 5.

**Known gap 2 - OAuth callback paths differ.** The PHP used `/auth/{provider}/callback`;
the port builds `${NEXT_PUBLIC_SITE_URL}/api/auth/oauth/{provider}/callback`. Both
providers must have the new URL registered before sign-in works. `NEXT_PUBLIC_SITE_URL`
currently holds the production host, so OAuth exercises the production redirect URI.
Documented in `docs/TESTING_LOCAL.md` section 6.

**Re-verified after the change:** typecheck PASS, lint PASS, tests PASS (11 files, 65
tests), parity-check PASS (19 templates), verify-columns PASS (250 references, including
the new scripts), build PASS, smoke PASS, and smoke:phase5 PASS (62/62 live checks
against a server booted with the copied credentials).
## UI PARITY FIX (Phases 4 + 5) - done

Findings and evidence: `docs/UI_PARITY_AUDIT.md`. Harness: `docs/UI_COMPARE.md`.
Tool output (regenerated on every run): `docs/UI_PARITY_REPORT.md`.

### Blocker, stated plainly
No PHP and no MySQL/MariaDB on this machine (`php` not on PATH, no `C:\xampp`, no
`mysql` service), so the old site could not be served and the numeric old-vs-new
pixel/computed-style comparison was NOT run. Per the UI PARITY GATE, that is recorded as
unmeasured rather than claimed as parity. Everything below is from source comparison plus
live DOM inspection of the new app.

### Root causes fixed
1. **All 9 auth pages rendered a navbar + footer the PHP does not have.** `npm run
   php-chrome-map` proved the old templates split three ways: navbar+footer (17), footer
   only (verify-certificate), and no chrome at all (9 auth pages, receipt, logout, demo).
   Root layout now renders no chrome; `app/(site)/layout.tsx` (17 pages) and
   `app/(foot)/layout.tsx` (verify-certificate) do. All 73 route paths unchanged.
2. **`navbar.css` loaded globally**, so its `body { padding-top: 64px }` hit the 11
   chrome-less pages. Now imported only by `app/(site)/layout.tsx`.
3. **`next/font` overrode `--font-primary`**, which `base.css` itself declares in `:root`
   (that file is 11 lines). Removed; `head.php`'s five Inter link tags are now emitted
   verbatim via a `<head>` block, so the swap works pre-hydration. Verified live: computed
   `font-family` is now `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
   sans-serif`.
4. **All 8 auth pages imported no CSS.** 460-odd matching rules were being dropped
   (`auth/login.css` 75, `auth/register.css` 74, `auth/password-reset-after-verify.css` 91,
   `auth/reset-password.css` 63, `auth/forgot-password.css` 57, `auth/verify-email.css` 48,
   `auth/register-success.css` 43, `auth/account-activation.css` 42). The files were
   already ported byte-identical; only the imports were missing.
5. **`student/dashboard.css` missing** from browse-courses (8 matching rules) and
   categories (7).
6. **`browse-courses.css` missing** from the course page (8 matching rules).
7. **`course.php`'s 2634-char inline `<style>` not ported** - the sidebar->navbar override
   (`body{padding-left:0!important}`, `.cp-page-wrap{padding-top:64px}`, `.cp-alert` margins,
   `.cp-hero{margin-top:0}`, the `.cp-layout` max-width/padding block, `.cp-breadcrumb-bar`,
   and the 960px + 640px breakpoints). Now in `course-page-styles.ts`, injected at the same
   cascade position, `!important` and all.
8. **`register-success.php`'s two inline `<style>` blocks not ported** (`.btn-login` 715 chars,
   `.btn-check-status`/`.btn-resend` 1132 chars).
9. **Receipt hid the navbar with a CSS override.** `receipt.php` has no chrome, so the fix
   was structural; the `!important` hide block is deleted and the smoke test now asserts
   the markup is absent rather than hidden.
10. **Receipt missing Plus Jakarta Sans.** `receipt.css` uses
    `--font-display: 'Plus Jakarta Sans', ...` for the invoice title / "Bill To" / footer,
    and `receipt.php` loads it. It was never loaded, so those headings fell back to Inter.
11. **`price.toFixed is not a function` crashed 4 pages.** `numeric(10,2)` returns a string
    from postgres.js; the course page called `.toFixed(2)` for JSON-LD `offers.price`, so
    `/course/[slug]`, `/instructor-profile/[slug]`, `/security` and `/updates` all returned
    the error shell. Fixed with `toNumber()`. Found by live probing, not by the tool.
12. **`theme-color` meta emitted** but `head.php` has none. Removed.

### Investigated, deliberately not changed
- **Stylesheet order does not matter.** `navbar.php` emits `navbar.css` from inside
  `<body>`, so it is always last upstream while the port loaded it first. `npm run
  css-conflicts` (added) proves the only overlaps are the global `body{padding-top}` and
  `from`/`to` keyframe steps, which never interact - so no ordering workaround was added.
- **`DM Mono` / `JetBrains Mono`** are declared in about/contact/track/categories/
  purchase-history/receipt CSS but never loaded by any PHP file; both sites fall back to
  generic `monospace`. Match, not a difference.
- **No `next/image` anywhere** - every image is a plain `<img>`, so nothing is being
  re-wrapped.
- **All 69 stylesheets are byte-identical** to `public/assets/css/**` (SHA256 spot-check).
- **`instructor-profile` is structurally different and UNRESOLVED**: the PHP renders a
  two-column `.ip-body` grid with a sidebar plus a JS `.sidebar-hidden` toggle; the port
  renders `.ip-page` + `.ip-hero` with no sidebar. Recorded in the audit, not hidden.

### Added tooling (all runnable without the old site)
- `npm run ui-compare` - Playwright + pixelmatch + pngjs harness. 18 viewports (the 8
  required + every breakpoint found in the CSS), 31 page/viewport targets, element pairing
  by signature, ~60 computed properties, 1px tolerance, exact colours, full-page
  screenshots + 5-largest-region naming, new-site-only mode. `scripts/ui-compare/`.
- `npm run php-stylesheet-order` - per-page stylesheet list, old vs new, with chrome and
  existence checks. **All 26 in-scope templates now report `[ok]`**; `check-payment-status`
  is `n/a` by design (it is a JSON endpoint upstream).
- `npm run css-usage` - which loaded sheets actually match the page markup.
- `npm run css-conflicts` - selector/property overlap analysis, i.e. does order matter.
- `npm run php-chrome-map` - which templates include navbar.php / footer.php.
- `scripts/ui-compare/php-router.php` - replicates the `.htaccess` clean-URL rewrites so
  PHP's built-in server can serve the old site.
- `npm run seed:content -- --dump-sql <file>` - emits a MySQL mirror of the demo data for
  the local MariaDB, using bcryptjs hashes that PHP `password_verify()` accepts.
- `docs/UI_COMPARE.md`, `docs/UI_PARITY_AUDIT.md`, `docs/UI_PARITY_REPORT.md`.
- **UI PARITY GATE section 14 added to BOTH AGENTS.md files.**

### Verification after the fix
typecheck PASS | lint PASS (0 warnings) | tests PASS (11 files, 65 tests) |
parity-check PASS (19 templates) | verify-columns PASS (250 refs) | smoke PASS |
build PASS (73 routes) | smoke:phase5 PASS (64/64 live checks, up from 62 - the two new
checks assert the receipt ships no chrome markup).
Live probe of all 30 in-scope routes: no error shells, and the navbar/footer split matches
`php-chrome-map` exactly (navbar+footer on the 17, footer-only on verify-certificate, none
on the auth pages / receipt / demo).
## Phase 6 - Student part 2: dashboard, my-courses, learn, progress, quizzes,
## assignments, certificates, grades, schedule, profile, onboarding, course AI (done)

> **BLOCKER FOUND AND FIXED FIRST.** This phase could not be verified until a project-wide
> rendering defect was found and fixed. See "BLOCKER FOUND AND FIXED" at the end of this
> file for the full write-up; the summary is that `cacheComponents` + `export const instant
> false` made Next 16.4.0 fetch every authenticated page's CSS and never apply it, so the
> whole authenticated site rendered unstyled while `ui-compare` reported 0 mismatches.
> Disabling Cache Components and stripping `instant` from the 34 pages fixed it.

Numbering note: the user calls this phase **PHASE 6: STUDENT (part 2)**. The checklist above
was written earlier with the student part 2 work as row 7; that row is now done and this
section records it under the user's numbering. The instructor-area row is still pending, so
do not read the two numbers as the same scope.

Spec: `docs/analysis/phase6.md` (read before coding, per AGENTS.md 13).

### Libraries
- `lib/db/learning.ts` - enrollment + lesson queries, progress upsert/recompute, quiz
  questions/options, attempts and `quiz_answers`, assignment + submission rows, course
  rating map for the learn page.
- `lib/db/study-plan.ts` - `study_plan` CRUD plus `getWeekPlans` / `getHeatmapCounts` /
  `getDoneDatesDesc`. All `is_done` comparisons are boolean (`is_done = true`), because
  `tinyint(1)` became `boolean` in migration 001 and `= 1` is a type error in Postgres.
  `planned_date` is a `date`, so it is selected as `::text` for the PHP string comparisons.
- `lib/learning/progress.ts` - `markLessonComplete`, time accumulation, percentage
  recompute, `completed_at` stamping at 100%, streak helper.
- `lib/learning/quiz.ts` - question loading, scoring, pass/fail, review payload. Every
  posted option id is checked against the lesson's own option ids before it is stored.
- `lib/learning/grades.ts` - quiz + assignment weighting, letter grade, per-course panels.
- `lib/learning/certificates.ts` - eligibility, certificate id generation, issuance,
  certificate + verify lookups.
- `lib/learning/calendar.ts` - week grid, heatmap buckets, done-date map, streaks.
- `lib/learning/assignments.ts` - submission create/update, B2 attachment, grading fields.
- `lib/ai/course-chat.ts` - Groq call, message/version persistence, retry, edit, switch
  version, feedback, share slug + password, public share read.
- `lib/format.ts` + `lib/config.ts` - `APP_TIMEZONE` (default `Asia/Kolkata`) and the
  date/streak/week helpers. PHP called `date_default_timezone_set`; Vercel runs UTC, so
  every day boundary is computed in the site timezone explicitly.

### Pages (10 templates, parity-clean)
- `app/(site)/student/dashboard/` - navbar + footer, as in the PHP template.
- `app/(site)/student/my-courses/`
- `app/(site)/student/profile/`
- `app/(site)/student/grades/`
- `app/(site)/student/certificates/`
- `app/(site)/student/schedule/`
- `app/(student)/student/learn/` - **no** navbar or footer, as in `student/learn.php`.
- `app/(student)/student/generate-certificate/` - bare, like the PHP template.
- `app/(student)/student/onboarding/` - bare, like the PHP template.
- `app/(student)/course-ai-shared/` - bare public share view.
The `(site)` vs `(student)` split is not cosmetic: `app/(site)/layout.tsx` imports
`navbar.css`, which declares a global `body { padding-top }`, so the bare PHP templates must
not sit in that group. `scripts/php-chrome-map.mjs` now gates this automatically.

### API routes
- `app/api/student/learn/route.ts` - mark_complete, lesson_progress, submit_quiz,
  submit_assignment. zod-validated, Origin + CSRF checked, PRG redirects.
- `app/api/student/onboarding/route.ts`, `app/api/student/profile/route.ts`,
  `app/api/student/profile/avatar/route.ts`, `app/api/student/profile/avatar/remove/route.ts`
- `app/api/student/schedule/route.ts` - the PHP `schedule-api.php`.
- `app/api/student/course-ai/route.ts` - the PHP `course_ai_chat_api.php`.
- `app/api/media/route.ts` - extended with the `assignment_file` branch, authorized to the
  enrolled student only.

### Components
`CourseAiChat.tsx`, `CodeHighlight.tsx`, `TextStars.tsx`, plus the learn-page
`LearnClient` / `LearnSidebar` / `LearnContent` / `useLearnBehaviour` split.

### Security notes
- CSRF + Origin added to the study-plan and course-AI APIs. The PHP versions had neither.
- Quiz submission drops any option id that does not belong to the lesson being submitted;
  PHP stored whatever was posted.
- Resubmitting an assignment now clears `marks_obtained`, `feedback` and `graded_at`.
  PHP set only `status = 'pending'` and left the old grade visible on a pending
  submission. Ported as the intended behaviour; noted as a fix.
- The learn page gates on enrollment only. PHP's `is_free_preview` check is not applied
  to students.
- Assignment attachments go to B2 and are served only through the authorized
  `/api/media?type=assignment_file&id=...` branch.

### Bugs found and fixed (pre-existing, surfaced by this phase)
- **Certificates were never readable.** `generate-certificate.php` reads
  `courses.certificate_issued` / `courses.certificate_url`, and the public verify page
  queries `certificates` by the same non-existent columns. No migration creates them, so
  the PHP site always showed "not found". The new flow writes real rows in `certificates`
  and resolves every certificate by `enrollment_id`.
- **`getQuizTotalPoints` vs stored attempts.** Ported as-is; the percentage is computed from
  the attempt rows.
- **Assignment attachments on local disk.** PHP wrote to `private/uploads`; Vercel has no
  disk, so they move to B2 under `assignments/`.
- **Postgres boolean/date typing.** `is_done = 1` (MySQL) is invalid against a `boolean`
  column; `planned_date` comes back as a `Date`, not the string PHP compared against.

### Deviations from the PHP (all deliberate, all noted)
- Certificate canvas is **1122x730**, the value in the PHP source. The prompt said
  1056x748; the source was used.
- `generate-certificate.php` links `assets/css/student/generate-certificate.css` but never
  renders it. The file's rules were extracted byte-for-byte from the PHP inline `<style>`
  block and are now actually applied.
- `my-courses.css` is byte-identical to the PHP original and contains an invalid bare
  `--navbar-height: 60px;` declaration at line 1854. Next's CSS parser reports it as the
  only build warning. The file was left untouched on purpose: "fixing" it would diverge
  from the deployed stylesheet.

### Verification
- `typecheck` PASS, `lint` (max-warnings 0) PASS, `vitest` 13 files / 122 tests PASS.
- `next build` PASS. One inherited warning, from the PHP `my-courses.css` defect above.
- `parity-check` PASS: 29 templates, no missing class or id.
- `php-stylesheet-order` PASS for every Phase 6 page.
- `php-chrome-map` PASS, including the new route-group gate.
- `verify-columns` PASS: 405 statements, 346 column references.
- `smoke` (base) PASS.
- `smoke:phase6` **PASS: 108 / 108 live checks**, self-cleaning. Covers the enrollment
  gate, mark_complete + progress recompute + time accumulation, quiz scoring (wrong
  answer, forged option id, true/false, pass/fails the lesson), the post-redirect result and
  review panels, assignment submit/resubmit/grade, 100% completion + single certificate
  issuance + the public verify page, all six study-plan actions plus the CSRF/Origin
  rejections, profile save + avatar removal + onboarding, the course-AI guards, the 404
  share view, cross-student isolation on learn / generate-certificate / grades /
  certificates, and the instructor guard.
- `smoke:phase6` asserts redirects and 404s through the payload rather than the status
  code: with Cache Components the shell is flushed before `redirect()` / `notFound()` run,
  so the response is a 200 carrying `NEXT_REDIRECT` or the 404 page. The browser follows
  both correctly; only the status line differs from PHP.

### Known limitations (environmental, not code)
- B2 uploads and the Groq provider are not exercised by the offline smoke run: the suite
  stubs the storage and provider layers. Live B2 and Groq behaviour needs `npm run ui-compare`
  style manual checks with real credentials.
- `npm run ui-compare` cannot produce a numeric old-vs-new verdict in this environment
  (the PHP site and MySQL are not running), so it recorded the new-site side only.

### Not done (out of Phase 6 scope, tracked in later phases)
- `private/functions/assignments.php` / `quizzes.php` authoring endpoints - instructor area.
- `private/api/ai_questions.php` competency question generator - instructor area.
- No student-facing instructor-rating form exists in the PHP source, so none was built.
  The read-only course rating map on the learn page is done.
- Password / security settings and the course review endpoint were already delivered in
  earlier phases.

## BLOCKER FOUND AND FIXED: every authenticated page rendered unstyled (done)

### Symptom
`npm run ui-compare` reported **0 mismatches** on every page while the pages were in fact
completely unstyled: `getComputedStyle(document.body).fontFamily` was `"Times New Roman"`,
`--font-primary` was empty, and the only stylesheets in the DOM were the Google-fonts link
plus two inline `<style>` blocks. Page heights were ~1000px regardless of viewport.

### Root cause
`next.config.ts` enabled `cacheComponents: true` + `partialPrefetching: true`, and 34 pages
declared `export const instant = false;` (a Cache Components segment config). Under that
combination Next 16.4.0 emits the route's stylesheets as `<link rel="preload" as="style">`
only and never writes the matching `<link rel="stylesheet">`, so the CSS files are fetched
(HTTP 200) but never applied. Confirmed by bisection with throwaway probe routes:

| probe page | cookies() | DB query | requireUser() | app CSS applied |
|---|---|---|---|---|
| `/css-probe` | yes | no | no | yes (4 links) |
| `/css-probe-db` | yes | yes | no | yes (4 links) |
| `/css-probe` (redirected) | yes | yes | yes | **no (0 links)** |
| `/student/dashboard` (live) | yes | yes | yes | **no (0 links)** |

It is a framework bug in `next@16.4.0` (the latest stable; `npm view next version` = 16.4.0,
no newer patch exists), not a bug in the ported code. It predates this phase: `/cart`,
`/checkout`, `/wishlist`, `/purchase-history` and `/security` were equally affected.

### Fix
`cacheComponents: false` and `partialPrefetching: false` in `next.config.ts`, and
`export const instant = false;` stripped from all 34 `page.tsx` files (it is a Cache
Components-only export and is rejected at build time without that flag). ISR / `revalidate`
/ on-demand revalidation are unaffected - they do not depend on Cache Components.

After the fix, on `/student/dashboard`: 3 same-origin stylesheets applied, computed font
`Inter, system-ui, -apple-system, "Segoe UI", sans-serif`, 6 stylesheets in the DOM.

### Why the gate did not catch it (and now does)
The comparator only diffs DOM structure and computed styles. With no CSS there is no layout
to diff, so an unstyled page compares equal to another unstyled page. Three changes make it
loud:

- `collect.mjs` now records `appliedStylesheets` (same-origin sheets with readable rules)
  and `preloadedOnlyStylesheets` (requested but never attached).
- `compare.mjs` fails the run when a page has rendered content but zero applied
  stylesheets, and prints a `BLOCKER` section naming the page and the missing files.
- The collector skips `script/style/noscript/svg/template` when collecting fonts, which had
  been reporting `"Times New Roman"` (the browser default on `<script>`) as a used font.
- `loginState` logs in via `/login` and sends the `Origin` header. It previously read the
  CSRF cookie from `/cart` and sent no `Origin`, so login returned 403, every
  "authenticated" page was captured as a redirect payload, and the run reported
  "logged in" anyway. It now verifies the session cookie actually landed.

### Verification after the fix
- `typecheck`, `lint --max-warnings 0`, `vitest` (13 files / 122 tests): PASS
- `next build`: PASS (one inherited warning - the PHP `my-courses.css` defect)
- `parity-check` (29 templates), `verify-columns`, `php-stylesheet-order`,
  `php-chrome-map` (incl. the new route-group gate): PASS
- `smoke`, `smoke:phase6`: **108 / 108** PASS
- `npm run ui-compare -- --site new` for all 9 Phase 6 pages at all 32 viewports:
  **0 mismatches, 0 unstyled pages** (previously all 9 were unstyled)
- `cart`, `checkout`, `wishlist`, `purchase-history`, `security` also re-checked: styled

## Phase 7 (plan row 6) - Instructor part 1: registration wizard + competency test

Numbering note: the user calls this phase **PHASE 7: INSTRUCTOR (part 1)**. It covers
`instructor-register/step-1` .. `step-8`, `instructor-register-success`, `test`, and the
backend that drives them. The instructor dashboard / course builder / analytics / earnings /
reviews / students / profile pages are **not** in this part.

### Files created
- `docs/analysis/phase7.md` - spec, state diagram, guard table, storage/token/encryption rules.
- `db/migrations/012_instructor_registration_fixes.sql` - adds `test_failed` to the
  application-status CHECK, creates `instructor_reg_sessions` (anonymous wizard state).
- `db/migrations/013_instructor_application_bank_name.sql` - adds `instructor_applications.bank_name`.
- `db/migrations/014_instructor_application_skip_payout.sql` - adds `instructor_applications.skip_payout`.
- `lib/instructor/{reg-session,test-tokens,test-constants,documents,maintenance,wizard,step-page}.ts`
- `lib/db/instructor-registration.ts`, `lib/api-test-helpers.ts`, `lib/ai/question-generator.ts`,
  `lib/auth/redirect.ts`
- `app/api/reg-session/route.ts`, `app/api/instructor-register/step/[n]/route.ts`,
  `app/api/test/{route,autosave/route,violation/route}.ts`,
  `app/api/cron/instructor-maintenance/route.ts`
- `app/instructor-register/{page,step-1..step-8}`, `app/instructor-register-success/page.tsx`,
  `app/test/page.tsx`
- `components/instructor/{RegShell,RegSteps,Step6ReviewClient,TestClient}.tsx`
- `tests/instructor-{wizard-validation,step-guards,competency,test-tokens}.test.ts`,
  `tests/helpers/env.ts`, `scripts/smoke-phase7.ts`, `scripts/ensure-preview-props.mjs`

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/instructor-register/index.php` | `app/instructor-register/page.tsx` (+ `app/api/reg-session/route.ts`) |
| `public/instructor-register/step-1..8.php` | `app/instructor-register/step-N/page.tsx` + `app/api/instructor-register/step/[n]/route.ts` |
| `public/instructor-register-success.php` | `app/instructor-register-success/page.tsx` |
| `public/test/index.php` | `app/test/page.tsx` + `app/api/test/route.ts` |
| `private/functions/instructor_registration.php` | `lib/db/instructor-registration.ts`, `lib/instructor/*.ts` |
| `private/functions/upload_security.php` (docs rules) | `lib/security/upload_validation.ts` + step-7 route |
| `private/functions/b2_storage.php` / `media.php` | `lib/instructor/documents.ts` + `app/api/media/route.ts` |
| `private/functions/token_cleanup.php` (test tokens) | `lib/instructor/maintenance.ts` + `app/api/cron/instructor-maintenance/route.ts` |
| `private/api/*` question generation | `lib/ai/question-generator.ts` |
| `admin/serve-doc.php` | `app/api/media/route.ts` (`instructor_doc`, admin only) |

### State machine
`draft` -> `pending` (test passed, application saved) -> `approved` | `rejected`.
A failed test writes `test_failed` and the documents are deleted. Rejected/test_failed rows are
purged back to `student` by the maintenance cron. Approve/reject functions also flip
`users.is_active` and `block_reason='application_rejected'`, delete the B2 documents and send
the approval/rejection emails.

### Security
- Anonymous wizard state lives in `instructor_reg_sessions` keyed by an httpOnly/Secure/SameSite=Lax
  cookie; the cookie holds the raw token and the row keeps only its SHA-256 hash.
- `pan_number`, `bank_account`, `ifsc_code`, `account_holder`, `upi_id` are AES-256-GCM encrypted
  (`DATA_ENCRYPTION_KEY`). `bank_name` is stored in clear on purpose, exactly as the PHP treated it.
- Documents go to a private B2 bucket; `/api/media` serves them to admins only.
- Test tokens are consumed with `UPDATE ... WHERE used = false RETURNING *`; expiry, the 7-day
  failure cooldown and the abandoned-token scan all read the **server** clock (`now()`).
- One attempt only: `step-8` checks both a live token and `test_attempt_started_at`.
- CSRF + Origin checks on every POST (the wizard forms all carried a CSRF token in the PHP).

### PHP bugs fixed (intended behaviour ported)
1. `full_legal_name` is posted by **no** PHP form, yet `loadInstructorRegistrationData()` gates the
   whole legal block on `!empty($app['full_legal_name'])`. Result in the PHP: the step-6 legal
   section never rendered and `resumeStep` could never reach 6. Fixed by gating on "step 5 was
   filled in at all".
2. `bank_name` was validated on step 5 but written nowhere (no column), so the review's
   `✓ <bank> — ••••1234` branch was dead. Added `bank_name` (migration 013).
3. `skip_payout` was posted and kept only in `$_SESSION`, so the review's "To be added later"
   branch was dead too. Added `skip_payout` (migration 014).
4. React emits `<strong>{score}%</strong>` as `100<!-- -->%`, which is not byte-identical to the
   PHP output. Interpolated into one expression so the markup matches.

### Environment notes
- `EMAIL_DRY_RUN=true` is used by `scripts/smoke-phase7.ts` so no real mail is sent.
- `scripts/ensure-preview-props.mjs` runs after `next build`: `next@16.4.0`'s
  `next start` loads `.next/server/preview-props.json` unconditionally, and the build only writes
  it on a branch this App Router project never takes. Writing `{}` restores a correct boot and
  changes nothing (the project has no partial pre-rendered routes). Delete once Next ships a fix.

### Verification
- `typecheck`: PASS
- `lint --max-warnings 0`: PASS
- `vitest`: **17 files / 187 tests** PASS
- `next build`: PASS (one inherited warning - the PHP `my-courses.css` defect)
- `smoke:phase7`: **79 / 79** PASS
- `smoke` (base): PASS
- `parity-check`: OK, **39 templates**, no missing class/id
- `php-stylesheet-order`, `php-chrome-map`, `verify-columns` (421 column refs): PASS
- `npm audit`: 5 high advisories, all inside `eslint-config-next` ->
  `@next/eslint-plugin-next` (dev dependencies only, never shipped). `next` and
  `eslint-config-next` are already the latest published version (16.4.0), so
  `npm audit fix --force` would only force a downgrade/breaking change. Not applied.

## Phase 8 - Instructor panel (part 2): DONE

All eleven instructor panel pages are ported: dashboard, courses, create-course, edit-course,
course-content, course-analytics, analytics, students, reviews, earnings and profile. The Phase 7
registration side and this phase together complete the instructor experience; admin work is untouched.

### Files created / changed
- `lib/db/instructor/`: courses, sections, lessons, quizzes, assignments, analytics, reviews, earnings
- `lib/api/instructor/`: course-actions (create/save/publish/unpublish/delete/thumbnail), parse-quiz
- `lib/revalidate.ts`, `lib/markdown-editor.ts`, `lib/security/api.ts`, `lib/auth/guards.ts`
- `app/(site)/instructor/**/page.tsx` (11 pages)
- `app/api/instructor/course/**`, `app/api/instructor/profile/route.ts`, `app/api/editor/image/route.ts`
- `components/instructor/`: MarkdownEditor, StudentsTable, ReviewsClient, EarningsChart, ProfileClient,
  course/{CourseEditor, CustomSelect, CourseRowActions, CoursePublishButton, CourseContentClient,
  LessonModal, DangerZone}
- `tests/`: instructor-course-slug, instructor-ownership, instructor-quiz-builder, instructor-earnings
- `scripts/smoke-phase8.ts` (`npm run smoke:phase8`)

### Verification
- `typecheck`: PASS
- `lint --max-warnings 0`: PASS
- `vitest`: **21 files / 250 tests** (222 passed, 28 pre-existing skips) PASS
- `next build`: PASS (inherited PHP `my-courses.css` warning only)
- `smoke:phase8`: **55 / 55** PASS (stable across repeated runs)
- `smoke:phase7`: **79 / 79** PASS
- `parity-check`: OK, **50 templates**, no missing class/id
- `php-stylesheet-order`, `php-chrome-map`, `css-usage`, `css-conflicts`, `verify-columns`
  (468 column refs): PASS

### PHP bugs fixed (intended behaviour ported)
1. **Instructor phone was never saved.** `profile.php` ran `UPDATE users SET phone = ?` but no
   instructor table has a `phone` column (it exists only on `student_profiles`), so the statement
   raised an error every save. The new code does not invent the column and does not attempt the write.
2. **Course save always reported success.** MySQL returned 0 affected rows for an unchanged UPDATE;
   Postgres reports the row regardless, so `updateCourse()` now compares the incoming values with the
   stored row first (booleans and numerics normalised, since a form always posts strings). This restores
   the PHP "No changes to save." branch.
3. **Instructor API routes only checked the role.** A pending or rejected applicant could POST directly
   to create or mutate courses even though the pages redirected them. All instructor mutation routes now
   use `getApprovedInstructorFromRequest()`, which requires the latest application to be approved.
4. **Quiz questions could not be validated server-side.** Points must be 1-100, a multiple-choice question
   needs at least two options and exactly one correct answer; `parseQuizQuestions` now throws
   `QuizValidationError` and the content route returns the message.
5. **Changing a lesson's content type left stale data.** Switching away from quiz/assignment left the old
   questions/assignment attached. They are now removed, so the student view cannot show an unanswerable quiz.
6. **Instructor review links pointed at the course id.** `/course/[slug]` only accepts a slug, so every
   "course reviewed" link 404'd. The review query now returns the slug and the link uses it.
7. **Renamed courses only revalidated the old URL.** The new slug is now revalidated too.

### Other decisions
- Course editor submits over `fetch` and follows the server's `{ redirect }`; a native form post would
  have dumped the user on raw JSON. The editor image upload now sends the CSRF token (the cookie is
  httpOnly, so the token is passed down from the server component).
- `CourseEditor` takes a `prefix` string, so the admin create/edit pages can reuse it unchanged in Phase 9.
- `vitest.config.ts` now serialises test files: every suite shares one Postgres pooler connection, so
  concurrent runs produced deadlocks and lock timeouts that looked like logic failures.
- `verify-columns` no longer checks bare select-list tokens for an aliased single table
  (`FROM lessons l` was reporting the alias `l` as a missing column).

### Not done / limitations
- The admin review UI (list applications, view decrypted documents, approve/reject buttons) is
  **Phase 8** and is not started. Only the backend functions exist.
- Live B2 uploads, live SMTP and live AI question generation are not exercised offline; the smoke
  seeds question/token rows directly.
- Numeric old-vs-new pixel parity could not be measured (no running PHP/MySQL). The structural
  gates and `ui-compare --site new` were used instead.

## Phase 9 - Admin courses part: courses.php, create-course.php, edit-course.php (done)

Hand-ported the three admin course templates. Admin pages live under `app/(site)/admin/**` so they
inherit the `(site)` layout chrome (navbar + footer), matching the PHP templates that include both.

### Files created
- `lib/db/admin/courses.ts` - admin course DB layer (list/stats/options/CRUD/overview/cascade delete)
- `lib/api/admin/courses.ts` - create/list actions and edit-save action, PHP-order validation + audit
- `app/api/admin/courses/route.ts`, `app/api/admin/courses/[id]/route.ts` - Node runtime POST handlers
- `components/admin/CoursesView.tsx` - manage-courses list client (filters, bulk, modals, alerts)
- `app/(site)/admin/courses/page.tsx` - list server page
- `components/admin/CreateCourseForm.tsx`, `app/(site)/admin/create-course/page.tsx` - create flow
- `components/admin/EditCourseForm.tsx`, `app/(site)/admin/edit-course/page.tsx` - edit flow

### Deviations from the PHP (all deliberate, all noted)
1. **`adminUpdateCourse` reports success on an unchanged save.** MySQL returned 0 affected rows for a
   no-op UPDATE, which the old page treated as a failure; Postgres reports the row either way, so the
   ported function returns success whenever the course exists and the statement runs. (Same class of
   fix as Phase 8's `updateCourse`.)
2. **`edit-course.php` alert-close used an undefined `qsa()` helper**, so the inline close button threw
   and the 5s auto-dismiss never ran. The intended behavior (close button + 5s auto-dismiss with fade)
   is ported.
3. **B2 thumbnail cleanup.** When a new thumbnail is uploaded the previous object is deleted from B2
   (no local-disk leftovers, per section 9).
4. **Revalidation + audit added.** Mutations call `revalidatePublicCoursePages(slug)` and `auditAdmin`
   (`admin.course.create|update|delete|toggle_publish|feature|bulk`), strengthening, not weakening.
5. **Forms submit over `fetch` and follow the handler's `{ redirect }`**, so a native POST never dumps
   raw JSON (CSRF token passed from the server component since the cookie is httpOnly).
6. **List actions keep PRG.** Native list forms are intercepted and re-issued to the API, which returns
   the same redirect targets the PHP used (`?msg=...`).

### Verification
- `npx tsc --noEmit`: PASS (zero errors)

### Not done / limitations
- The rest of the Phase 9 admin area (dashboard, users, enrollments, reviews, categories,
  instructor-applications, settings, banners) and the UI-parity gate are not part of this batch.
- Numeric old-vs-new pixel parity could not be measured (no running PHP/MySQL).

## Phase 9 - Admin part: categories.php, enrollments.php, reviews.php (done)

Hand-ported the three admin management templates. Spec: `docs/analysis/phase9/categories-enrollments-reviews.md`.
Admin pages live under `app/(site)/admin/**` so they inherit the `(site)` chrome (navbar + footer),
matching the PHP templates that include both.

### Files created
- `lib/db/admin/categories.ts`, `lib/db/admin/enrollments.ts`, `lib/db/admin/reviews.ts` - admin DB layers
- `lib/api/admin/enrollments.ts` (`enrollStudentAction`, `unenrollStudentAction`, `verifyAndEnrollAction`,
  `PAYMENT_ID_RE`), `lib/api/admin/reviews.ts` (`deleteReviewAction`)
- `app/api/admin/categories/route.ts` (PRG 303 with `?msg=`/`?error=`), `app/api/admin/enrollments/route.ts`
  (JSON 200), `app/api/admin/reviews/route.ts` (JSON 200, `ajax_delete`)
- `app/(site)/admin/layout.tsx` (AdminMaintenanceBanner + children)
- `components/admin/CategoriesScripts.tsx` + `app/(site)/admin/categories/page.tsx`
- `components/admin/EnrollmentsScripts.tsx` + `app/(site)/admin/enrollments/page.tsx`
- `components/admin/ReviewsScripts.tsx` + `app/(site)/admin/reviews/page.tsx`

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/categories.php` | `app/(site)/admin/categories/page.tsx` + `CategoriesScripts.tsx` + `app/api/admin/categories/route.ts` |
| `public/admin/enrollments.php` | `app/(site)/admin/enrollments/page.tsx` + `EnrollmentsScripts.tsx` + `app/api/admin/enrollments/route.ts` |
| `public/admin/reviews.php` | `app/(site)/admin/reviews/page.tsx` + `ReviewsScripts.tsx` + `app/api/admin/reviews/route.ts` |
| `private/functions/admin.php` (category/enrollment/review fns) | `lib/db/admin/{categories,enrollments,reviews}.ts` + `lib/api/admin/*` |

### Security
- Every route calls `authorizeAdmin(req)` (session + admin role AND Origin/Host check) and `csrfOk(token)`
  (POST forms carry the CSRF token read from the httpOnly cookie). Mutations write `auditAdmin` rows.
- Payment verification in the enroll flow re-validates the payment id server-side (`pay_[A-Za-z0-9]{14,}`),
  reads the amount from the DB, and runs inside a transaction with a duplicate/idempotency guard.
- Legacy `/admin/{categories,enrollments,reviews}.php` already 301 to the clean URLs via the generic
  `/:path*.php` rule in `next.config.ts`; no config change was needed.

### PHP bugs fixed (intended behaviour ported)
1. **Double HTML-escaping.** The PHP double-escaped student labels/names when embedding them in JSON
   replies (`verify_and_enroll` message) and in `data-*` attributes (`data-text`/`data-full`/`data-preview`)
   and page messages. The port renders the raw value with a single React escape, which is the intended output.
2. **Enrollments pagination dropped the course filter.** The PHP paginator reused a buggy `course` key
   instead of `course_id`, so paging lost the active course filter. The port preserves `course_id` across pages.
3. **Reviews expand threshold** is computed on the raw review text (not the `htmlspecialchars`'d text the
   PHP measured), so the 120-char read-more cutoff matches the visible characters.

### Parity method / limitations
- Structural gates pass: `php-stylesheet-order`, `php-chrome-map`, `css-conflicts`.
- The `ui-compare` harness (`scripts/ui-compare/config.mjs`) does **not** list admin pages in `PAGES` and
  only supports one non-admin compare account, so no numeric old-vs-new pixel verdict exists for these
  pages. As AGENTS section 14 allows, no parity claim is made here beyond the structural gates.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint .`: 0 errors (2 pre-existing warnings in `CreateCourseForm.tsx`/`EditCourseForm.tsx`, not new)
- `next build`: PASS; new routes present (`/admin/categories`, `/admin/enrollments`, `/admin/reviews`,
  `/api/admin/categories`, `/api/admin/enrollments`, `/api/admin/reviews`)

### Not done / limitations
- The remaining Phase 9 admin area (dashboard, users, instructor-applications, settings, banners,
  notifications, bug/contact, serve-doc) is not part of this batch.
- Numeric old-vs-new pixel parity could not be measured (admin pages not covered by `ui-compare`).

## Phase 9 - Admin part: instructor-applications.php, instructor-application-detail.php (done)

### Files created / changed
- `app/(site)/admin/instructor-applications/page.tsx` - list/queue (server component)
- `app/(site)/admin/instructor-applications/InstructorApplicationsClient.tsx` - interactive client
- `app/(site)/admin/instructor-application-detail/page.tsx` - review screen (server component)
- `app/(site)/admin/instructor-application-detail/InstructorApplicationDetailClient.tsx` - interactive client
- `app/api/admin/instructor-applications/route.ts` - POST (approve / reject / bulk_approve / bulk_reject)
- `app/api/admin/instructor-applications/[id]/route.ts` - POST (approve / reject)
- `lib/db/admin/instructor-applications.ts` - all queries (list/count/status counts/education levels/detail+decrypt/sibling nav/abandoned-test-failed upsert)
- `lib/api/admin/instructor-applications.ts` - zod schemas, PRG `redirectAfter`, both POST handlers, audit rows
- `lib/email/templates.ts` - `emailShell` + helpers + instructor approval/rejection HTML/Text builders
- `lib/email/senders.ts` - `sendInstructorApprovalEmail` / `sendInstructorRejectionEmail` (exact subjects, HTML/Text, in-app notifications)
- `lib/format.ts` - added `formatDayMonthYearCommaTime` (PHP `date('d M Y, g:i A')`) and `humanTimeDiff` (PHP `human_time_diff`)

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/instructor-applications.php` | `app/(site)/admin/instructor-applications/page.tsx` + `InstructorApplicationsClient.tsx` + `app/api/admin/instructor-applications/route.ts` |
| `public/admin/instructor-application-detail.php` | `app/(site)/admin/instructor-application-detail/page.tsx` + `InstructorApplicationDetailClient.tsx` + `app/api/admin/instructor-applications/[id]/route.ts` |
| `public/admin/serve-doc.php` | `app/api/media/route.ts` (`?type=instructor_doc&id=&field=`, admin-only; already existed) |
| list/detail SQL + `private/functions/instructor_registration.php` approve/reject | `lib/db/admin/instructor-applications.ts` + existing `lib/db/instructor-registration.ts` |
| `private/email/{email_templates,email_senders}.php` | `lib/email/templates.ts` + `lib/email/senders.ts` |

### Security
- Every route runs `authorizeAdmin(req)` (session + admin role AND Origin/Host check) then `csrfOk(token)`
  (both pages render the CSRF token read from the httpOnly `edulari_csrf` cookie); successes/failures are audited.
- Admin guard runs FIRST on the list page; the PHP ran `cleanupStaleDraftDocs()` / `purgeRejectedInstructorData()`
  / `findAndScoreAbandonedTestTokens()` before `requireRole` (an unauthenticated visitor could trigger them).
- Doc serving stays admin-only and non-enumerable through `app/api/media` (field is whitelisted to the two columns).
- PAN and bank account are masked server-side; the full value ships only in `data-full` for the client reveal,
  exactly like the PHP (page is admin-only). Sensitive columns are AES-256-GCM decrypted only on this screen.
- Reject reason is hard-limited to 1000 chars server-side (zod) - a hardening over the PHP (which only set
  `maxlength` on the detail textarea and had no server-side limit).

### Port decisions / deviations (deliberate)
1. **Route group** is `app/(site)/admin/...` (not the `app/(admin)` in the spec's skeleton), matching the
   existing admin pages (`users`, `user-detail`, `categories`); `(site)/layout.tsx` already renders the
   navbar/footer these two PHP templates include.
2. **PRG via native form POST -> API routes -> 303** back to the Referer (replaying the current query string
   then overlaying `msg`/`error`), mirroring PHP `header("Location: ?" . http_build_query(array_merge($_GET, [...])))`.
3. **Detail `msg_type` carried across the redirect.** The PHP set `$msgType` but only carried `msg`, so a
   rejection flash rendered success-styled; the port carries `msg_type` so rejections render danger-typed.
4. **Rejection email/text includes the reason.** The PHP `sendInstructorRejectionEmail` passed only `$name` to
   the Text builder (reason missing from the AltBody); the port includes the reason in both HTML and Text.
5. `LIKE` (MySQL, case-insensitive) ported as `ILIKE` in Postgres; date filters use `DATE(...)::date`.
6. `bank_name` / `skip_payout` are not displayed (same as PHP); no invented UI.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint` (the changed files): 0 errors, 0 warnings
- `next build`: not run for this batch (per the agreed phase scope: typecheck only)

### Not done / limitations
- Numeric old-vs-new pixel parity could not be measured; admin pages are not in the `ui-compare` `PAGES`
  list. Structural gates (`php-chrome-map`, `php-stylesheet-order`) cover the two templates; no numeric claim made.
- The remaining Phase 9 admin pages (dashboard, users, settings, banners, notifications, bug/contact) remain.

## Phase 9 - Admin part: settings.php (done)

### Files created
- `app/(site)/admin/settings/page.tsx` - server component, 7 tab panels + maintenance modal + toast (1:1 markup port)
- `components/admin/SettingsScripts.tsx` - the whole inline `<script>` ported to a client `useEffect`
- `app/api/admin/settings/route.ts` - `POST` (nodejs runtime, `maxDuration = 30`), 10 JSON actions
- `lib/api/admin/settings.ts` - zod schemas + all 10 action handlers (exact PHP messages/order)
- `lib/db/admin/settings.ts` - `getAdminSettings` / `saveSettingsValues` / `getTableCounts` / `getDbHealth` / `getDbVersion`
- `lib/email/settings-senders.ts` - `sendPasswordChangedNotificationEmail` (+ HTML/Text builders)

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/settings.php` POST branch (10 actions) | `app/api/admin/settings/route.ts` + `lib/api/admin/settings.ts` |
| `public/admin/settings.php` markup + inline JS | `app/(site)/admin/settings/page.tsx` + `components/admin/SettingsScripts.tsx` |
| `getSystemSettings()` / `saveSettings()` / `saveApiSettings()` (`private/functions/admin.php`) | `lib/db/admin/settings.ts` + `lib/api/admin/settings.ts` |
| `sendPasswordChangedNotificationEmail()` + `buildPasswordChangedNotification*()` | `lib/email/settings-senders.ts` |
| `public/assets/css/admin/settings.css` | `styles/css/admin/settings.css` (already copied, byte-identical) |

### Port decisions / deviations (deliberate)
1. **Secrets can never be persisted** (AGENTS.md §4/§9). Where the PHP rewrote `config.php` / `api_config.php` /
   `$_ENV`, the port reads the secret from the environment and refuses to store it: a submitted SMTP / OpenRouter /
   NVIDIA / Razorpay secret returns `success:false` with a message naming the env var, while the non-secret parts
   (host/port/username, Razorpay Key ID, active provider) are still saved. A blank secret leaves the env untouched
   and the action succeeds normally.
2. **AJAX target** moved from the page URL to `/api/admin/settings`; response JSON shapes are unchanged.
   The CSRF failure still returns HTTP 200 JSON with the exact PHP text, and `authorizeAdmin` (role + Origin/Host)
   runs before it.
3. **change_password sets `password_changed_at = now()`** in addition to regenerating the session. The PHP only
   regenerated the session; the extra column write is a hardening consistent with `lib/auth/sessions.ts`
   (which already invalidates sessions older than `password_changed_at`). The new session is returned as
   `cookieToken` and set as the httpOnly cookie by the route.
4. **`clear_cache` is a no-op** ("Removed 0 session file(s)."): PHP deleted `sess_*` files from `sys_get_temp_dir()`,
   but sessions are in Postgres now, so there is no server disk to clear.
5. **system_info maps PHP values to truthful Node equivalents** (same keys/labels): `php_version`/`server_software`
   -> `process.version`; `os` -> `process.platform`; `memory_limit` -> V8 heap limit; `upload_max`/`post_max`
   -> `4.5 MB` (Vercel body cap); `max_exec_time` -> `30s` (matches the route `maxDuration`); `db_version` ->
   `SELECT version()`; `disk_free`/`disk_total` -> `fs.statfsSync`; `server_time` -> `Intl` in `APP_TIMEZONE`.
6. **Timezones** use `Intl.supportedValuesOf("timeZone")` (equivalent to `DateTimeZone::listIdentifiers()`);
   the current timezone is always prepended if absent so it stays selectable.
7. **PRG note:** the PHP's AJAX actions intentionally answered JSON in place (no redirect). That behaviour is
   preserved; PRG applies to the plain-form admin pages, not to this fetch-based one.

### Security
- `authorizeAdmin(req)` (session + admin role AND Origin/Host) -> CSRF token check -> dispatch, all server-side.
- Every mutating action writes an `admin.settings.*` row via `auditAdmin` (the PHP wrote most of these to
  `security.log`; the rest were unlogged).
- `change_password` verifies the current password with `verifyPassword` (handles PHP `$2y$` hashes) before writing.
- Secrets are never read back into the DOM; the page only shows an "already configured" placeholder from a boolean.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint` (the six changed files): 0 errors, 0 warnings
- `next build`: not run for this batch (per the agreed phase scope: typecheck + lint only)
- Structural gates: `php-chrome-map` / `php-stylesheet-order` do not cover admin pages, so no numeric claim.

### Not done / limitations
- Numeric old-vs-new pixel parity was not measured (admin pages are not in the `ui-compare` `PAGES` list).
- The remaining Phase 9 admin pages (dashboard, users, banners, notifications, bug/contact) remain.

## Phase 9 - Admin part: dashboard.php (done)

### Files created
- `app/(site)/admin/dashboard/page.tsx` - server component (full `addash-*` DOM port: stat cards, quick actions, two recent tables, top courses, maintenance cards).
- `app/api/admin/dashboard/route.ts` - `POST` (nodejs runtime, `maxDuration = 30`) for the three maintenance actions.

### Existing pieces reused (already in the tree)
- `lib/db/admin/dashboard.ts` (`getPlatformStats`, `getPendingApplicationsCount`).
- `lib/instructor/maintenance.ts` (`maybeCleanupStaleDraftDocs`, `maybePurgeRejectedInstructorData`).
- `lib/token-cleanup.ts` (`cleanupExpiredTokens`), `components/admin/ConfirmForm.tsx`, `lib/format.ts` (`formatPrice`, `formatMonthDayYear`).

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/dashboard.php` markup | `app/(site)/admin/dashboard/page.tsx` |
| `public/admin/dashboard.php` POST actions | `app/api/admin/dashboard/route.ts` |
| `getPlatformStats()` / `getPendingApplicationsCount()` (`private/functions/admin.php`) | `lib/db/admin/dashboard.ts` |
| `cleanupStaleDraftDocs`/`purgeRejectedInstructorData` (`private/functions/instructor_registration.php`) | `lib/instructor/maintenance.ts` |
| `cleanupExpiredTokens` (`private/functions/token_cleanup.php`) | `lib/token-cleanup.ts` |
| `public/assets/css/admin/dashboard.css` | `styles/css/admin/dashboard.css` (already copied, byte-identical) |

### Port decisions / deviations (deliberate)
1. **`pending_applications` badge is now live (intended behaviour).** The PHP read
   `$stats['pending_applications']`, but `getPlatformStats()` never returned that key, so the
   Applications badge was dead code and `getPendingApplicationsCount()` (admin.php:797) was never
   called. Per AGENTS.md ("port the INTENDED behaviour and note the fix") the page now calls
   `getPendingApplicationsCount()` and shows the badge when the count is > 0.
2. **PRG via API route.** The PHP posted to the page itself; the three forms now post to
   `/api/admin/dashboard`, which runs `authorizeAdmin` then the CSRF check and answers 303 to
   `/admin/dashboard?msg=…`. The CSRF failure path keeps the exact PHP contract
   (HTTP 403 + `Security token mismatch. Refresh the page and try again.`).
3. **`?msg=` prefix routing** ported verbatim (`Cleanup done` / `Purge done` / `Token cleanup`,
   first match wins); the matching flash renders in the same maintenance card as the PHP.
4. **Maintenance functions take `force = true`** so they run on demand (the throttles otherwise
   apply). This mirrors `cleanupStaleDraftDocs(true)` etc.; the file-based throttle state lives in
   `cron_state` (serverless rule §9).
5. **`formatPrice` plain form** (`format.ts` mirrors `formatPrice(..., htmlWrap:false)`): `Free`
   for ≤ 0, else the currency symbol + 2-dp amount.
6. **`date('M d, Y')`** ported via `formatMonthDayYear`, pinned to `APP_TIMEZONE`.
7. **Ratings** `round($avg, 1)` ported as `Math.round(x * 10) / 10`.
8. **Links** relative PHP hrefs (`users.php`, `courses.php?status=pending`, …) mapped to `/admin/…`.
9. **No-op `#fontStylesheet` line dropped** (the element never existed in `head.php`; guarded by `?.`).
10. Staff actions audited (`admin.dashboard.run_cleanup|run_purge|run_token_cleanup`), matching the
    admin audit convention used elsewhere in the port.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint` (the two new files): 0 errors, 0 warnings
- `next build`: not run (agreed batch scope: typecheck + lint only)
- Structural gates: `php-chrome-map` / `php-stylesheet-order` do not cover admin pages, so no numeric claim.

### Not done / limitations
- Numeric old-vs-new pixel parity was not measured (admin pages are not in the `ui-compare` `PAGES` list).
- The remaining Phase 9 admin pages (users, bug/contact) remain.

## Phase 9 - Admin part: banners.php + send-notifications.php (done)

### Files created
- `lib/db/admin/banners.ts` - `getAllBanners`, `getBanner`, `createBanner`, `updateBanner`, `deleteBanner`,
  `toggleBannerActive`, `getActiveBannersForRole`, `BANNER_TEMPLATES` + types.
- `lib/api/admin/banners.ts` - `bannersPost` dispatching the five PHP actions
  (create_banner / update_banner / delete_banner / toggle_banner_active / preview_banner); zod input,
  CTA pairing, datetime-local -> "Y-m-d H:i:s", template whitelist, server-rendered preview HTML.
- `app/api/admin/banners/route.ts` - `POST` (nodejs runtime).
- `app/(site)/admin/banners/page.tsx` - server component; `requireAdmin()`, imports `banners.css`.
- `components/admin/BannersView.tsx` - full `bnr-*` DOM port + client behaviour (modal, toast, preview,
  row actions).
- `lib/db/admin/notifications.ts` - admin send helpers: `createNotificationForAll` / `ForRole` /
  `ForSpecific`, `findActiveUserIdByEmail`, `notificationTypeLabel`.
- `lib/api/admin/notifications.ts` - `notificationsPost` with PRG (303 to `/admin/send-notifications?msg=|?error=`).
- `lib/admin/notification-options.ts` - client-safe `NOTIF_TYPES` + `AUDIENCE_OPTIONS` (shared by the
  handler and the form without pulling the server graph into the client bundle).
- `app/api/admin/notifications/route.ts` - `POST` (nodejs runtime).
- `app/(site)/admin/send-notifications/page.tsx` - server component; `requireAdmin()`, renders the
  page-authoritative inline `<style>` + `SendNotificationsView`.
- `components/admin/SendNotificationsView.tsx` - type tiles, audience select, email toggle, char
  counters, live preview.

### Existing pieces reused
- `lib/admin/api.ts` (`authorizeAdmin`, `csrfOk`, `readFields`), `lib/admin/audit.ts` (`auditAdmin`),
  `lib/db/client.ts` (`sql`), `lib/security/csrf.ts` (`readCsrfToken`), `lib/seo/metadata.ts`
  (`pageMetadata`), `lib/site.ts` (`SITE_NAME`), `lib/auth/guards.ts` (`requireAdmin`),
  `lib/format.ts` (`ucfirst`), `styles/css/admin/{banners,send-notifications}.css`.

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/banners.php` markup + inline `<script>` | `app/(site)/admin/banners/page.tsx` + `components/admin/BannersView.tsx` |
| `public/admin/banners.php` POST actions | `lib/api/admin/banners.ts` + `app/api/admin/banners/route.ts` |
| `private/functions/banners.php` | `lib/db/admin/banners.ts` |
| `private/banner-templates/*.php` | `lib/api/admin/banners.ts` (`renderTemplateHtml`) |
| `private/data/banners.json` | `public.site_banners` (no file store) |
| `public/admin/send-notifications.php` markup + inline `<script>` | `app/(site)/admin/send-notifications/page.tsx` + `components/admin/SendNotificationsView.tsx` |
| `public/admin/send-notifications.php` handler | `lib/api/admin/notifications.ts` + `app/api/admin/notifications/route.ts` |
| `private/functions/notifications.php` admin senders | `lib/db/admin/notifications.ts` |
| `$notifTypes` / `$audienceOptions` | `lib/admin/notification-options.ts` |

### Port decisions / deviations (deliberate)
1. **Preview `<style>` is reproduced verbatim** (banners.php:198). The preview HTML is built
   server-side and injected with `dangerouslySetInnerHTML`; the HTML string is fully escaped
   (`esc` = PHP `htmlspecialchars` with ENT_QUOTES) and the template is whitelisted
   (`BANNER_TEMPLATES`) so there is no traversal / injection surface.
2. **Live-site banner rendering was already ported** in an earlier phase (`components/SiteBanners.tsx`
   + `app/api/site-banners/route.ts`); this phase only adds the admin management + DB writes it reads.
3. **Version bump parity:** `updateBanner` bumps `version` only when title/message/template/type/cta
   change (PHP `!==` array compare). Because jsonb returns canonical key order, CTA equality is
   compared field-by-field (`sameCta`) rather than `JSON.stringify`, avoiding a false-positive bump
   that would re-show a user's dismissed banner.
4. **Schedule window** uses `(schedule->>'start_at')::timestamp <= (now() AT TIME ZONE 'Asia/Kolkata')`,
   exactly mirroring `strtotime(local)` vs `time()` in `getActiveBannersForRole()`.
5. **`logBannerEvent` -> `auditAdmin`** (`admin.banner.create|update|delete|toggle` and
   `admin.notification.send`) into `security_events` (serverless rule 9; no more `banners.log`).
6. **CSRF difference preserved:** banners answered JSON on CSRF failure (HTTP 200,
   "Security token invalid. Refresh the page and try again."); send-notifications stored a flash and
   redirected ("Security token mismatch. Please refresh and try again.").
7. **Documented PHP bug fixed:** the edit modal did `schedule.start_at.substring(0,16)` leaving a
   space that `datetime-local` rejects; the value is now `YYYY-MM-DDTHH:MM`.
8. **`strlen` (bytes)** for send-notifications title/body limits reproduced with
   `Buffer.byteLength(..., "utf8")`.
9. **`send-notifications.css` stays unused** (the PHP page never linked it; the inline block is
   authoritative). The Next page reproduces the inline styles and does not import the external file.
10. **`is_active` is a Postgres boolean**, so the specific-user lookup uses `is_active = true`
    (the old MySQL `= 1` would not compile against the ported schema).
11. Only the six admin-sendable notification types exist (no `admin_broadcast`); a "specific" send
    stores `sent_by = NULL` even though an admin triggered it (PHP quirk, preserved).

### Security
- `requireAdmin()` guards both pages; `authorizeAdmin(req)` (session + admin role + Origin/Host) guards
  both routes; CSRF token verified after it in each handler.
- No new secrets; banner/notification content is user data, stored raw and escaped on output.
- RLS already enabled with no policies on `site_banners`, `notification_messages`, `notification_reads`.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint` (the 11 changed/new files): 0 errors, 0 warnings
- `next build`: not run (agreed batch scope: typecheck + lint only)
- `parity-check`: OK (52 templates, no missing class/id)
- Structural gates (`php-stylesheet-order`, `php-chrome-map`) do not cover admin pages, so no numeric
  claim; `css-conflicts` shows no real order-dependent overlap between `navbar.css` and `banners.css`
  (the flagged `from`/`to` "selectors" are `@keyframes` blocks, a known false positive).

### Not done / limitations
- Numeric old-vs-new pixel parity was not measured (the two admin pages are not in the `ui-compare`
  `PAGES` list). New-site-only facts would need a running dev server + Playwright.
- `strimwidth` for the table message column counts JS UTF-16 units, whereas PHP `mb_strimwidth` is
  width-aware; identical for ASCII, may differ for CJK. Noted as a documented divergence.
- The remaining Phase 9 admin pages (users/user-detail, bug reports, contact submissions) remain.

## Phase 9 - Admin part: bug-reports.php, bug-report-detail.php, contact-submissions.php, contact-submission-detail.php (done)

Spec: `docs/analysis/phase9/bug-contact.md`. Hand-ported the four admin templates (list + detail for
bug reports and for contact submissions). Much of the page interaction happens in client components
(`BugReportDetailClient`, `ContactSubmissionClient`) because the PHP detail pages are driven by large
inline `<script>` blocks; the two list pages are read-only server components.

### Files created
- `lib/admin/bug-labels.ts` - `BUG_TYPE_LABELS_LIST`/`_DETAIL`, `BUG_STATUS_LABELS`, `BUG_STATUS_CONFIG`,
  `BUG_SEVERITY_COLORS`, `bugStatusConfig`.
- `lib/admin/contact-labels.ts` - `CONTACT_CATEGORY_LABELS`, `CONTACT_STATUS_META_LIST`/`_DETAIL`,
  `CONTACT_PRIORITY_META_LIST`/`_DETAIL`, `CONTACT_STATUS_OPTIONS`, `ucfirst`, `categoryLabel`.
- `lib/admin/dates.ts` - local `formatDayMonthYearTime24` (`d M Y, H:i`) and `formatMonthDayYearAtTime`
  (`M j, Y at h:mm AM`) in `APP_TIMEZONE` (the PHP pages date formats; `lib/format.ts` has no such formatter).
- `lib/db/admin/bug-reports.ts` - list/count/mutations + `findBugReportByAttachment`.
- `lib/db/admin/contact-submissions.ts` - list/count/detail/mutations, `listContactSubmissions(filters, limit, offset)`.
- `lib/api/admin/redirect.ts` - shared `redirectAfter`/`redirectTo` (303 PRG; replays Referer params, `extra` wins).
- `lib/api/admin/bug-reports.ts`, `lib/api/admin/contact-submissions.ts` - per-action POST handlers
  (both rewritten to return `NextResponse`).
- `app/api/admin/bug-reports/[id]/route.ts`, `app/api/admin/contact-submissions/[id]/route.ts`,
  `app/api/admin/bug-attachment/route.ts` - Node-runtime POST handlers + attachment GET.
- `app/(site)/admin/bug-reports/page.tsx`, `app/(site)/admin/contact-submissions/page.tsx` - list server components.
- `app/(site)/admin/bug-report-detail/page.tsx` + `BugReportDetailClient.tsx`,
  `app/(site)/admin/contact-submission-detail/page.tsx` + `ContactSubmissionClient.tsx`.
- `lib/email/bug-status.ts`, `lib/email/contact-senders.ts` (incl. `sendContactReplyEmail`),
  `lib/email/shell-extra.ts` (`esc`/`nl2br`/`emailFallbackLink`/`emailDataTable`).
- CSS copied byte-identical earlier: `styles/css/admin/{bug-reports,bug-report-detail,contact-submissions,contact-submission-detail}.css`.

### PHP -> new mapping
| PHP | New |
|---|---|
| `public/admin/bug-reports.php` | `app/(site)/admin/bug-reports/page.tsx` + `lib/db/admin/bug-reports.ts` + `lib/admin/bug-labels.ts` |
| `public/admin/bug-report-detail.php` | `app/(site)/admin/bug-report-detail/page.tsx` + `BugReportDetailClient.tsx` + `app/api/admin/bug-reports/[id]/route.ts` + `app/api/admin/bug-attachment/route.ts` |
| `public/admin/contact-submissions.php` | `app/(site)/admin/contact-submissions/page.tsx` + `lib/db/admin/contact-submissions.ts` + `lib/admin/contact-labels.ts` |
| `public/admin/contact-submission-detail.php` | `app/(site)/admin/contact-submission-detail/page.tsx` + `ContactSubmissionClient.tsx` + `app/api/admin/contact-submissions/[id]/route.ts` + `lib/email/contact-senders.ts` |
| inline bug-report status emails | `lib/email/bug-status.ts` + `lib/email/shell-extra.ts` |
| contact reply email logic | `lib/email/contact-senders.ts` |

### Security
- Every route runs `authorizeAdmin(req)` (session + admin role AND Origin/Host) then `csrfOk(token)`;
  list pages run `requireAdmin()` server-side before rendering. Successes/failures are audited
  (`admin.bug_report.*`, `admin.contact.*` rows).
- The attachment route validates the filename with `^[A-Za-z0-9._-]+$` (rejects `..`, slashes, path
  traversal) AND requires a `bug_reports` row whose `attachment` column equals the name, so it can never
  read an arbitrary bucket key. It streams the private-bucket object `bug_reports/<file>` with HTTP Range
  passthrough and `inline` disposition.
- Reply emails for contact submissions go out over SMTP via the shared `sendMail` transport; the detail
  page replies and logs per the PHP flow (public/internal reply toggle).

### Port decisions / deviations (deliberate)
1. **Base list API routes skipped.** The PHP list pages are read-only server components; no
   `app/api/admin/{bug-reports,contact-submissions}/route.ts` was created. Lists render in-page.
2. **`redirectAfter`/`redirectTo` extracted** to `lib/api/admin/redirect.ts` (303 PRG) and reused by both
   detail handlers.
3. **`msg_type` carried across the redirect (PHP bug fixed).** The PHP detail pages set `$msgType` but
   only carried `msg` in the Location header, so error flashes rendered with success styling. The port
   carries `msg_type` so the flash colour matches the outcome.
4. **Single HTML-escape of `msg`.** The PHP double-escaped flash/error messages (htmlspecialchars applied
   twice through the message + alert builders); the port renders the raw value with one React escape.
5. **`handleContactDetailPost` returns `Promise<NextResponse>`.** The PHP contact handler was typed
   `Promise<void>` yet returned; the port types it correctly.
6. **Contact "reopen" restored.** The PHP detail page's `js-reopen-ticket` anchor was a dead link (it set
   the select value then GET-navigated to the same page without posting). The port prevents default and
   submits the sidebar `change_status` form with `status=open` - the intended behaviour.
7. **Bug attachment download restored.** The PHP linked to `/serve-attachment.php?file=…`, a route that
   does not exist in the codebase; the port implements the intended inline download via
   `app/api/admin/bug-attachment` instead.
8. **Detail pages are whole-page client components** (the established `user-detail` pattern), because the
   PHP behaviours are client-side; the server page still runs `requireAdmin()` and owns the initial data.
9. **Status/severity quick-actions use a shared notes textarea** (the PHP shared `admin_notes` value across
   every form); `window.confirm` gates `wont_fix`/`duplicate`, matching the PHP `confirm()` prompts.
10. **Time labels** for bug/contact detail rows use the local `lib/admin/dates.ts` formatters pinned to
    `APP_TIMEZONE` (`date_default_timezone_set` equivalent).

### Known gap (documented, not introduced here)
- `app/api/report-bug/route.ts` (student-side, earlier phase) never populates `bug_reports.attachment`
  because that flow has no upload, so the admin detail page's attachment preview/download link only
  appears when a row actually has an attachment file on B2. Noted in PROGRESS.md; not part of this batch.

### Verification
- `tsc --noEmit`: PASS (zero errors)
- `eslint` (the new/changed files): 0 errors, 0 warnings
- `next build`: PASS - routes present: `/admin/bug-reports`, `/admin/bug-report-detail`,
  `/admin/contact-submissions`, `/admin/contact-submission-detail`, `/api/admin/bug-reports/[id]`,
  `/api/admin/contact-submissions/[id]`, `/api/admin/bug-attachment`.
- Class check: 150 literal classes; only `?`/`currentPage` (template artifacts) plus the three
  intentional non-CSS tokens (`abrd-main`, `acsd-main` structural wrappers, `js-reopen-ticket` JS hook)
  flagged; every dynamic prefix (`abr-badge--`, `acsd-*`, …) resolves in the ported CSS.

### Not done / limitations
- Numeric old-vs-new pixel parity was not measured (admin pages are not in the `ui-compare` `PAGES`
  list; `php-stylesheet-order`/`php-chrome-map` likewise cover public pages only). Structural gates were
  used instead and the four CSS files are byte-identical copies.
[resolved] users.php / user-detail.php now live at `app/(site)/admin/users/*` and
`app/(site)/admin/user-detail/*` and are recorded `done` in `docs/feature-matrix.md` (rows 73/74 and
the `users.css`/`user-detail.css` rows 92/93), which were updated during the Phase 9 close-out.

[phase 9 close-out] All 19 PHP admin files are now ported and documented; bug reports (list + detail)
and contact submissions (list + detail) are closed by this phase. The Phase 9 master index is
`docs/analysis/phase9.md`. `npm run parity-check` was extended with all 18 admin page pairs and passes
with zero missing classes/ids (68 templates).

## Phase 10 - Final audit, hardening, SEO check, deployment guide (done)

Audit phase. Proved nothing was skipped, closed the gaps the audits found, and produced the
deployment material. No new pages were built.

### 1. Feature audit - docs/feature-matrix.md is now 100% done

Every row was re-opened in the old PHP site and compared with the port. Result: **0 rows
remain 	odo or partial**.

- **59 rows were stale** - the work was already done but the matrix was never updated. Mostly
  byte-identical asset copies, the two ported client scripts, the three throttle files
  (-> cron_state), both .htaccess files, and the serverless-adapted private files.
- **7 rows pointed at files that do not exist** and now point at the real ones:
  lib/db/sections.ts -> lib/db/instructor/sections.ts, lib/db/token-cleanup.ts ->
  lib/token-cleanup.ts, lib/security/upload.ts -> lib/storage/upload-validation.ts,
  lib/ai/config.ts -> lib/config.ts, lib/ai/test-token.ts ->
  lib/instructor/test-tokens.ts, lib/storage/b2-config.ts -> lib/storage/b2.ts,
  lib/db/maintenance.ts -> lib/maintenance.ts. Also pp/api/media/[key]/route.ts ->
  pp/api/media/route.ts (the port uses query params, not a dynamic segment, because the
  B2 key is a database column and never user input).
- **getBlockedUsers() and getInstructorAuditSummary()** (dmin.php:830, :843) were the
  only two functions in the whole PHP codebase with no counterpart. Both are now ported to
  lib/db/admin/users.ts.
- ssignments.php and quizzes.php were marked partial; the authoring sides are in fact
  complete in lib/db/instructor/, so they are now done.

### 2. UI audit

- parity-check: **OK, 68 templates, 0 missing class/id.**
- php-stylesheet-order, php-chrome-map, css-usage: **no failures.**
- All **72 CSS files are byte-identical** to public/assets/css/** (verified by SHA256), so
  every media query, font weight, colour variable and keyframe is preserved by construction.
- All **12 images/favicons** present. The two logo <img> tags without width/height
  match 
avbar.php / ooter.php exactly and are sized in CSS, so this is parity, not a
  regression.
- **public/legacy-js deleted** after confirming all 5 scripts have verified ports:
  uth.js -> PasswordToggles.tsx, code-highlight.js -> CodeHighlight.tsx,
  course-ai.js -> CourseAiChat.tsx, md-editor.js -> MarkdownEditor.tsx +
  lib/markdown-editor.ts, ideo-player.js -> VideoPlayer.tsx. Nothing in pp/,
  components/, proxy.ts or 
ext.config.ts referenced the directory.

### 3. Security audit - docs/SECURITY_AUDIT.md

All 12 OWASP areas reviewed with file/line evidence. **4 real gaps found and fixed:**

1. **CSRF missing on 8 mutating routes** - /api/cart/add, /api/enroll,
   /api/wishlist/toggle, /api/notifications/read-all, /api/notifications/[id]/read,
   /api/notifications/[id]/delete, /api/student/check-payment-status,
   /api/flash/consume. These checked Origin/Host only. Added erifyCsrfToken(...) to each
   and threaded the token through CourseClient, BrowseClient, UpdatesClient,
   MarkAllReadButton and FlashMessage.
2. **Open redirect** - /api/auth/login echoed the caller's edirect field into the JSON
   response and LoginForm passed it to outer.push. Now only a local path
   (startsWith("/") and not //) is honoured.
3. **XSS** - RegSteps.tsx rendered error strings (which embed the user's email) through
   dangerouslySetInnerHTML at two sites. Both now render as React text children.
4. dmin.php had two unported functions (see above).

Accepted risks are written up in the document: img-src https: (needed for
instructor-supplied thumbnails), 5 dev-only ESLint advisories, and no numeric old-vs-new UI
verdict while the PHP stack is unavailable.

### 4. SEO audit - docs/SEO_AUDIT.md, 
pm run seo:audit

The audit compares the JSON-LD block count per page against **the original PHP template**,
so a page can neither gain nor lose structured data. **Result: no failures.** 4 issues fixed:

1. **22 JSON-LD blocks hardcoded https://edulari.example.com** while <link rel=canonical>
   correctly used NEXT_PUBLIC_SITE_URL. Breadcrumbs pointed Google at a domain that does
   not exist. All now call siteUrl().
2. **/browse-courses and /contact had lost their JSON-LD** during the port, although
   rowse-courses.php emits a BreadcrumbList and contact.php a ContactPage. Both
   restored.
3. **Redirect rule ordering was wrong.** /:path*.php was listed first, so /index.php
   became /index and /public/index.php became /public/index. Rules are now ordered like
   .htaccess with the generic strip last.
4. **?i=1 was only stripped from /**, but the PHP rewrites ^(.*)$. Now matches
   /:path*.

Core Web Vitals: 574 KB of first-party JS on the homepage (gzipped on the wire) is the main
open risk; each interactive component exists for PHP parity so none were removed. Documented
rather than "fixed", because removing them would break parity.

### 5. Smoke tests

- scripts/smoke-routes.mjs (**new**, 
pm run smoke:routes) - **95 checks, all passing**:
  19 public routes 200, 40 protected pages redirect when logged out, 32 mutating APIs abort
  the write without an Origin, 4 cron routes 401 with no/wrong secret.
- scripts/smoke.ts (existing) - database checks still pass.
- Two initial "failures" were **wrong test expectations, not bugs**: /api/student/profile
  is a native form POST that answers 303 + error flash (Post/Redirect/Get, as in
  profile.php) rather than 403, and /test is gated by a single-use ?token=, not by a
  session, exactly like 	est/index.php. Both are now encoded correctly with the reasoning
  in comments.

### 6. Cron

All 4 routes exist and match docs/analysis/maintenance-cron.md: 	oken-cleanup (03:00),
maintenance (03:30), econcile-payments (*/5), instructor-maintenance (04:00). All
are in ercel.json. The **Vercel Hobby one-cron-per-day limit** and its consequence for the
5-minute reconciliation schedule are documented in docs/DEPLOY.md section 14, along with the
proxy.ts lazy trigger that keeps reconciliation working on Hobby.

### 7. Deployment guide

docs/DEPLOY.md: Supabase setup and migrations, every environment variable with what it is
for, Vercel project settings and region, custom domain, Google/GitHub OAuth redirect URIs,
the Razorpay webhook URL/events/secret, B2 CORS for presigned uploads plus bucket privacy,
SMTP setup, Search Console, PWA, rollback via Vercel promote-to-production, and a
post-launch checklist.

**Section 9 is mandatory:** the old site kept live credentials in private/secrets.php, so
all 11 secrets (DB, SMTP, Razorpay key + webhook, Google, GitHub, B2, AI keys, CRON,
SESSION, DATA_ENCRYPTION) must be rotated before go-live, with the warning that changing
DATA_ENCRYPTION_KEY makes existing encrypted instructor rows unreadable.

### 8. Cleanup

- public/legacy-js removed.
- README rewritten with setup steps and every script documented.
- .gitignore verified: .env* ignored, .env.example and .env.compare.example exempt,
  scripts/ui-compare/.env.compare ignored.
- All 12 dependencies verified as used; no unused packages removed.
- SESSION_SECRET / DATA_ENCRYPTION_KEY dev fallbacks are safe because lib/config.ts
  validates them with zod at startup and throws (naming only the variable, never its value).

### Final gates

| Gate | Result |
|---|---|
| 
pm run typecheck | PASS |
| 
pm run lint | PASS (0 errors, 0 warnings) |
| 
pm test | PASS - 264/264, 22 files |
| 
pm run build | PASS - 96 static pages |
| 
pm run smoke | PASS |
| 
pm run smoke:routes | PASS - 95 checks |
| 
pm run seo:audit | PASS - no failures |
| 
pm run parity-check | PASS - 68 templates, 0 missing |
| 
pm audit --omit=dev | 0 vulnerabilities |
