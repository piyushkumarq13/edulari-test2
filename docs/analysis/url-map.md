# URL Map — Edulari PHP → Next.js

All paths relative to `C:\Users\piyus\Desktop\htdocs (7)\htdocs`. Clean URLs assume the Apache
rewrites below. Source of truth: the four `.htaccess` files.

## .htaccess rules (must all be replicated)

### Root `/.htaccess`
1. `RewriteCond %{QUERY_STRING} ^i=1$` → `RewriteRule ^(.*)$ /$1? [R=301,L]` — strips the zya.me
   injected `?i=1` query param (301).
2. `RewriteCond %{THE_REQUEST} \s/+index(\.php)?[\s?]` → `^index(\.php)?$ / [R=301,L]` — `/index` and
   `/index.php` 301 to `/`.
3. `RewriteCond %{HTTPS} off` → `https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]` — force HTTPS (301),
   first.
4. `RewriteCond %{THE_REQUEST} s/public/` → `^public/(.*)$ /$1 [R=301,L]` — `/public/...` 301 to clean.
5. `^sitemap\.xml$ → /public/sitemap.php [L]` (internal).
6. `^course/([a-z0-9-]+)/?$ → /public/course.php?slug=$1 [L,QSA]`.
7. `^category/([a-z0-9-]+)/?$ → /public/browse-courses.php?category=$1 [L,QSA]`.
8. Everything else: `RewriteCond %{REQUEST_URI} !^/public/` → `^(.*)$ /public/$1 [L]` (internal
   front-controller into `/public/`).
9. Headers (all responses, `always`):
   `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: SAMEORIGIN`,
   `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`.
10. `mod_deflate` gzip: html, plain, xml, css, js, json, svg, ttf/otf, woff/woff2.
11. `mod_expires` caching: images/svg/icon/woff/woff2/css/js → 1 year; text/html → 0 seconds.

### `/public/.htaccess`
1. `RewriteCond %{THE_REQUEST} ^[A-Z]+\s([^?]+)\.php [NC]` → strip `.php`: 301 to extensionless URL.
2. Internal: if request is not a dir/file but `<name>.php` exists → serve `$1.php`. So every PHP
   script is reachable by its clean (extensionless) URL.

### `/private/.htaccess`
`Require all denied` (+ legacy `Order deny,allow`/`Deny from all` fallback). No direct HTTP access.

### `/private/uploads/instructor_docs/.htaccess`
`Deny from all` — instructor ID/marksheet files never served directly; only via `admin/serve-doc.php`.

### `/public/uploads/courses/.htaccess`
`php_flag engine off` and `Deny` for php/phtml/phar/php\d/pl/py/cgi/asp/aspx — uploads stay public
(crawlable) but script execution is disabled.

## File → URL map (exhaustive)

Attributes: **Access** — Public (anyone), Guest (login only), Student, Instructor, Admin, OwnerCheck
(ownership-checked), Server (webhook/cron), Internal (shared include / 404-guarded).
**Kind** — Page (HTML) / Endpoint (JSON or binary).

### Top-level `public/`

| PHP file | Old clean URL | Access | Next.js route | Kind |
|---|---|---|---|---|
| `index.php` | `/` | Public | `app/(public)/page.tsx` | Page |
| `browse-courses.php` | `/browse-courses` (+`?sort/category/price`) | Public | `app/(public)/browse-courses/page.tsx` | Page |
| `categories.php` | `/categories` | Public | `app/(public)/categories/page.tsx` | Page |
| `course.php` | `/course/{slug}` (via rewrite; `?slug=` also) | Public | `app/(public)/course/[slug]/page.tsx` | Page |
| `category/{slug}` | `/category/{slug}` → browse-courses?category= | Public | `app/(public)/category/[slug]/page.tsx` | Page (renders browse) |
| `instructor-profile.php` | `/instructor-profile?id=` | Public | `app/(public)/instructor-profile/page.tsx` | Page |
| `about.php` (also `page/about.php`) | `/page/about` | Public | `app/(public)/page/about/page.tsx` (keep `/page/about` URL) | Page |
| `contact.php` | `/contact` | Public (guest submit + logged-in) | `app/(public)/contact/page.tsx` | Page |
| `help-center.php` | `/help-center` | Public | `app/(public)/help-center/page.tsx` | Page |
| `security.php` | `/security` | Guest or logged-in (password change/security page) | `app/(auth)/security/page.tsx` or `(public)/security` | Page |
| `updates.php` | `/updates` | Logged-in (notifications list) | `app/(student)/updates/page.tsx` (or shared) | Page |
| `verify-certificate.php` | `/verify-certificate` | Public | `app/(public)/verify-certificate/page.tsx` | Page |
| `report-bug.php` | `/report-bug` | Public | `app/(public)/report-bug/page.tsx` | Page |
| `track-contact.php` | `/track-contact` | Public (ticket lookup) | `app/(public)/track-contact/page.tsx` | Page |
| `track-report.php` | `/track-report` | Public (bug ticket lookup) | `app/(public)/track-report/page.tsx` | Page |
| `demo.php` | `/demo` | — (FTP deploy test echoing timestamp) | drop or `scripts/` note; do NOT ship | Internal/dev |
| `course-ai-shared.php` | `/course-ai-shared?slug=` | Public (shared read-only AI chat) | `app/(public)/course-ai-shared/page.tsx` | Page |

### Auth pages (`public/*.php`)

| PHP file | Old clean URL | Access | Next.js route | Kind |
|---|---|---|---|---|
| `login.php` | `/login` | Guest | `app/(auth)/login/page.tsx` | Page |
| `register.php` | `/register` | Guest | `app/(auth)/register/page.tsx` | Page |
| `forgot-password.php` | `/forgot-password` | Guest | `app/(auth)/forgot-password/page.tsx` | Page |
| `reset-password.php` | `/reset-password` | Token link | `app/(auth)/reset-password/page.tsx` | Page |
| `verify-email.php` | `/verify-email` | Token link | `app/(auth)/verify-email/page.tsx` | Page |
| `account-activation.php` | `/account-activation` | Token link | `app/(auth)/account-activation/page.tsx` | Page |
| `register-success.php` | `/register-success` | Guest | `app/(auth)/register-success/page.tsx` | Page |
| `password-reset-after-verify.php` | `/password-reset-after-verify` | Token | `app/(auth)/password-reset-after-verify/page.tsx` | Page |
| `auth/google/callback.php` | `/auth/google/callback` | Server (OAuth redirect) | `app/api/auth/google/callback/route.ts`? or `app/(auth)/auth/google/callback/route.ts` | Endpoint |
| `auth/github/callback.php` | `/auth/github/callback` | Server | `app/api/auth/github/callback/route.ts` (or `(auth)` route) | Endpoint |

### Commerce / payment flow

| PHP file | Old clean URL | Access | Next.js route | Kind |
|---|---|---|---|---|
| `cart.php` | `/cart` | Student (guest redirected) | `app/(student)/cart/page.tsx` | Page |
| `wishlist.php` | `/wishlist` | Student (guest redirected) | `app/(student)/wishlist/page.tsx` | Page |
| `checkout.php` | `/checkout` | Student (instructors blocked) | `app/(student)/checkout/page.tsx` | Page |
| `create-order.php` | `/create-order` | Student (JSON) | `app/api/payments/create-order/route.ts` | Endpoint |
| `verify-payment.php` | `/verify-payment` | Student (JSON/POST) | `app/api/payments/verify-payment/route.ts` | Endpoint |
| `mark-order-status.php` | `/mark-order-status` | Student (JSON) | `app/api/payments/mark-order-status/route.ts` | Endpoint |
| `razorpay-webhook.php` | `/razorpay-webhook` | Server (Razorpay) | `app/api/payments/razorpay-webhook/route.ts` | Endpoint |
| `logout.php` | `/logout` (POST + CSRF) | Logged-in | `app/api/auth/logout/route.ts` (+ server action) | Endpoint |
| `media.php` | `/media?type=avatar|lesson_pdf|…` | Auth/Owner/Student-maintainance-aware | `app/api/media/route.ts` (same query params) | Endpoint (binary) |
| `ajax-image-upload.php` | `/ajax-image-upload` | Logged-in (image upload) | `app/api/uploads/image/route.ts` | Endpoint |
| `sitemap.php` | `/sitemap.xml` | Public | `app/sitemap.ts` | Endpoint (XML) |
| `robots.txt` | `/robots.txt` | Public | `app/robots.ts` (or static copy) | Endpoint |
| `llms.txt` | `/llms.txt` | Public | `public/llms.txt` (static) | Static |
| `site.webmanifest` | `/assets/images/favicon/site.webmanifest` | Public | `app/manifest.ts` (or static) | Endpoint |
| `google85c125c508318c1a.html` | `/google85c125c508318c1a.html` | Public | `public/google….html` verbatim | Static |

### `public/student/`

| File | URL | Access | Next.js | Kind |
|---|---|---|---|---|
| `dashboard.php` | `/student/dashboard` | Student | `(student)/student/dashboard` | Page |
| `my-courses.php` | `/student/my-courses` | Student | Page | Page |
| `learn.php` | `/student/learn` (`?id=`) | Student (enrolled) | `(student)/student/learn` | Page |
| `certificates.php` | `/student/certificates` | Student | Page | Page |
| `generate-certificate.php` | `/student/generate-certificate` | Student | Page (uses html2canvas/jspdf/qrcodejs/font-awesome) | Page |
| `grades.php` | `/student/grades` | Student | Page | Page |
| `schedule.php` | `/student/schedule` | Student | Page | Page |
| `schedule-api.php` | `/student/schedule-api` | Student (JSON) | `api/student/schedule/route.ts` | Endpoint |
| `course_ai_chat_api.php` | `/student/course_ai_chat_api` | Student (JSON, Groq AI) | `api/student/course-ai-chat/route.ts` | Endpoint |
| `check-payment-status.php` | `/student/check-payment-status` | Student (JSON, reconciles via Razorpay) | `api/student/check-payment-status/route.ts` | Endpoint |
| `onboarding.php` | `/student/onboarding` | Student | Page | Page |
| `profile.php` | `/student/profile` | Student | Page | Page |
| `purchase-history.php` | `/student/purchase-history` | Student | Page | Page |
| `receipt.php` | `/student/receipt` | Student (owner) | Page | Page |

### `public/instructor/`

| File | URL | Access | Next.js | Kind |
|---|---|---|---|---|
| `dashboard.php` | `/instructor/dashboard` | Instructor | `(instructor)/...` | Page |
| `courses.php` | `/instructor/courses` | Instructor | Page | Page |
| `create-course.php` | `/instructor/create-course` | Instructor | Page (font-awesome CSS CDN) | Page |
| `edit-course.php` | `/instructor/edit-course` | Instructor | Page | Page |
| `course-content.php` | `/instructor/course-content` | Instructor | Page | Page |
| `students.php` | `/instructor/students` | Instructor | Page | Page |
| `analytics.php` | `/instructor/analytics` | Instructor | Page | Page |
| `course-analytics.php` | `/instructor/course-analytics` | Instructor | Page | Page |
| `earnings.php` | `/instructor/earnings` (Chart.js CDN) | Instructor | Page/chart client component | Page |
| `reviews.php` | `/instructor/reviews` | Instructor | Page | Page |
| `profile.php` | `/instructor/profile` | Instructor | Page | Page |

### `public/admin/` (all `requireRole(ROLE_ADMIN)`, robots noindex)

| File | URL | Access | Next.js | Kind |
|---|---|---|---|---|
| `dashboard.php` | `/admin/dashboard` | Admin | `(admin)/admin/dashboard` | Page |
| `users.php` | `/admin/users` | Admin | Page | Page |
| `user-detail.php` | `/admin/user-detail?id=` | Admin | `(admin)/admin/user-detail` | Page |
| `courses.php` | `/admin/courses` | Admin | Page | Page |
| `create-course.php` | `/admin/create-course` | Admin | Page | Page |
| `edit-course.php` | `/admin/edit-course` | Admin | Page | Page |
| `enrollments.php` | `/admin/enrollments` | Admin | Page | Page |
| `categories.php` | `/admin/categories` | Admin | Page | Page |
| `reviews.php` | `/admin/reviews` | Admin | Page | Page |
| `banners.php` | `/admin/banners` | Admin | Page | Page |
| `settings.php` | `/admin/settings` | Admin (Razorpay keys, maintenance) | Page | Page |
| `instructor-applications.php` | `/admin/instructor-applications` | Admin | Page | Page |
| `instructor-application-detail.php` | `/admin/instructor-application-detail?id=` | Admin | Page | Page |
| `bug-reports.php` | `/admin/bug-reports` | Admin | Page | Page |
| `bug-report-detail.php` | `/admin/bug-report-detail?id=` | Admin | Page | Page |
| `contact-submissions.php` | `/admin/contact-submissions` | Admin | Page | Page |
| `contact-submission-detail.php` | `/admin/contact-submission-detail?id=` | Admin | Page | Page |
| `send-notifications.php` | `/admin/send-notifications` | Admin | Page | Page |
| `serve-doc.php` | `/admin/serve-doc?file=&app=` | Admin (ownership-verified doc download) | `api/admin/serve-doc/route.ts` | Endpoint |

### `public/instructor-register/` (wizard)

| File | URL | Access | Next.js | Kind |
|---|---|---|---|---|
| `index.php` | `/instructor-register` | Guest/logged-in | `(public)/instructor-register` | Page |
| `step-1.php` … `step-8.php` | `/instructor-register/step-N` | Applicant | `(public)/instructor-register/step-N` | Page |
| `_init.php`, `_layout_top.php`, `_layout_bottom.php` | not routable (includes) | Internal | shared layout components | Internal |
| `instructor-register-success.php` | `/instructor-register-success` | Applicant | `(auth)` or `(public)` page | Page |

### Other

| File | URL | Access | Next.js | Kind |
|---|---|---|---|---|
| `test/index.php` (1517-line instructor test taken via token) | `/test?token=` | Token-bearing (redirects logged-in users) | `(public)/test` page | Page |
| `public/page/about.php` | `/page/about` | Public | as above | Page |
| `private/api/ai_questions.php`, `test_token.php`, `api_config.php` | (required by `test/`) | Internal | `lib/api` modules | Internal |
| `partials/head.php`, `navbar.php`, `footer.php`, `site-banners.php`, `maintenance-page.php`, `admin-maintenance-banner.php`, `file_viewer.php`, `video_player.php` | not routable | Internal shared includes | `components/`, `lib/` | Internal |
| `uploads/**` (under `public/uploads/courses`) | `/uploads/courses/...` | Public assets, no PHP exec | migrate to B2 via `/media` proxy | Static |

### Redirect matrix (from PHP logic — inputs needed; these routes currently 301 or guard in PHP)

- `login.php` → logged-in users redirected to role dashboard (`redirectBasedOnRole()`)
- `register.php`, `forgot-password.php`, similar guest pages redirect if logged in
- `/index`, `/index.php` → `/` (301)
- Any `*.php` URL → extensionless (301)
- `/public/...` → `/...` (301)
- `http://` → `https://` (301); `?i=1` stripped (301)
- `/test` with no/invalid token → `/`
- `media.php?type=lesson_pdf` blocked with 503 JSON when student maintenance on
- `cart`, `wishlist`, `checkout`, `student/*`, `instructor/*`, `admin/*` guard by role with redirect to `/login` or role area
- OAuth callbacks redirect on error/success

## Open questions

- Exactly which PHP routes rely on GET-based CSRF-less POST forms (e.g. `logout`) and must be matched by Next.js server actions — needs per-file pass in Phase 2.
- `/security` page role rules (guest vs logged-in) were inferred; confirm guards.
- `/demo.php` is an FTP deploy test; confirm safe to drop rather than port.
- `/test/index.php` is 1517 lines with embedded question renderer; confirm if it should be ported as-is or rebuilt from the token flow spec.
- Whether `/updates` should live under student, shared by all roles, or its own group.
- `public/page/about.php` — confirm canonical stays `/page/about` (footer links to it).
- Manifest currently static at `/assets/images/favicon/site.webmanifest`; decide mirror at same path vs `app/manifest.ts` with redirect.
- Webhook/cron endpoints need raw-body handling under App Router route handlers — confirm `req.text()` raw behavior with the payments phase.
