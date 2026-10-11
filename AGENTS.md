# EDULARI: PHP to Next.js MIGRATION RULES

You are rebuilding an existing, deployed PHP e-learning platform (Edulari) as a Next.js + Node.js application. Read this whole file at the start of EVERY session, then read `docs/PROGRESS.md` to see where the work stands. These rules apply to every phase.

## 1. Locations

- OLD PHP site (read-only source of truth, never modify it): `C:\Users\piyus\Desktop\htdocs`
  - `public/` = web root (pages, assets, ajax endpoints). `private/` = core logic (auth, db, config, functions, email, api, PHPMailer, oauth). `.htaccess` files = URL rewrites, redirects, security headers.
- NEW project (all work happens here): `C:\Users\piyus\Desktop\htdocs\Edulari`
- Never write outside the Edulari folder. Never edit, move or delete anything in the old site.

## 2. Non-negotiables

1. **Nothing is skipped.** Every page, route, AJAX endpoint, form, function, validation rule, email, cron-like job, edge case, error message and security/privacy feature in the PHP site must exist in the new site with the same behavior. If something is unclear, read the PHP code again; do not guess and do not simplify.
2. **No stubs.** No `TODO`, no placeholder text, no mock or hardcoded data, no "implement later", no empty handlers. If a phase cannot fully finish a feature, say so explicitly in the report instead of faking it.
3. **UI is pixel-identical in intent.** Same layout, alignment, spacing, colors, fonts, font sizes, effects, animations, hover/focus states, icons, images, breakpoints and responsive behavior. See section 12.
4. **Secrets never get copied.** `private/secrets.php`, `private/config.php`, `private/config/b2_config.php`, `private/api/api_config.php` and any other file may contain hardcoded credentials. Read them ONLY to learn the names and purposes of settings. Record names with placeholder values in `.env.example`. Never write real keys, passwords, tokens, API keys or webhook secrets into any file you create, any doc, any log, or your replies. Real values go only in `.env.local`, which is git-ignored.
5. **Security parity or better.** Every protection in the PHP code (CSRF, rate limits, lockouts, session rules, upload validation, role checks, ownership checks, input validation, output escaping, PRG redirects, signature checks) must be reproduced. You may strengthen but never weaken.
6. **Read before you write.** For every PHP file in a phase's scope, read it fully, top to bottom (PHP logic first, then the HTML). Do not rely on file names or summaries.
7. **Work only on the current phase.** Do not start the next phase. Finish, verify, update docs, report, stop.

## 3. Fixed tech stack (do not substitute)

- Next.js (latest stable; check with `npm view next version`), App Router, React, **TypeScript with `strict: true`**, Node.js 20+ runtime. All routes touching DB/crypto/email/payments use the **Node runtime**, never Edge.
- Database: **Supabase Postgres used ONLY as a database.** No Supabase Auth, Storage, Realtime or client SDK in the browser. Access only from the server through the `postgres` npm package (postgres.js). **Connection rule (IPv4-only environment):** Both `DATABASE_URL` and `DIRECT_URL` MUST use the Supabase **Session Pooler** connection string (`aws-0-ap-south-1.pooler.supabase.com`, port `5432`, user `postgres.<project-ref>`). The user-provided values are the same for both (do not split into transaction pooler vs direct). When creating the `postgres` client, use `prepare: false`. Write parameterized SQL (tagged templates) that ports the original PDO queries 1:1. No ORM.
- Auth: **fully custom** (no NextAuth/Auth.js/Passport/Clerk/Firebase). `bcryptjs` for passwords (must verify existing PHP `$2y$` bcrypt hashes), custom sessions, custom OAuth for Google and GitHub using the authorization-code flow with `state` (and PKCE where supported), exactly mirroring `private/oauth.php` behavior.
- Email: **Nodemailer** over SMTP (settings from env). Port every template and sender from `private/email/*` and PHPMailer usage.
- File storage: **Backblaze B2** through its S3-compatible API (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), mirroring `private/functions/b2_storage.php`, `media_urls.php` and `media.php` (proxy/auth layer).
- Payments: **Razorpay** (create order, verify signature, webhook, reconciliation), mirroring the PHP logic.
- Validation: `zod` on every route handler and server action input.
- Markdown: port `private/functions/markdown.php` behavior (`marked` + `sanitize-html`, matching the PHP allow-list).
- No UI frameworks (no Tailwind, MUI, shadcn, Bootstrap). The existing CSS is reused (section 12). Use the same icon library, fonts and third-party scripts the PHP pages use (detect them in `public/partials/head.php` and page files).
- Keep dependencies minimal and pinned. Run `npm audit` at the end of each phase and report high/critical issues.

## 4. Project structure

```
Edulari/
  AGENTS.md
  app/
    (public)/        home, about, browse, categories, course, contact, help-center, ...
    (auth)/          login, register, forgot/reset password, verify-email, oauth callbacks
    (student)/       student pages
    (instructor)/    instructor panel + instructor-register wizard
    (admin)/         admin pages
    api/             route handlers (one folder per feature)
    sitemap.ts  robots.ts  manifest.ts
  components/        shared UI (navbar, footer, banners, video player, md editor, ...)
  lib/
    db/              postgres client, query modules per domain (users.ts, courses.ts, ...)
    auth/            sessions, passwords, oauth, guards (requireUser, requireRole)
    security/        csrf, rate-limit, headers, upload validation, crypto helpers
    email/           mailer, templates, senders
    storage/         b2 client, presign, proxy helpers, media urls
    payments/        razorpay client, signature verify, reconciliation
    ai/              course AI chat + test-question generation
    seo/             metadata helpers, json-ld builders
    config.ts        typed env access (validated at startup with zod)
  styles/            ported CSS (kept per page/area, same class names)
  public/            static assets copied from the PHP site (images, favicon, llms.txt, google verification html, ...)
  db/migrations/     numbered .sql files
  scripts/           migrate, create-admin, parity-check, seed
  docs/              PROGRESS.md, feature-matrix.md, analysis/*.md, DEPLOY.md
  .env.example  .env.local (git-ignored)  vercel.json
```

Use server components by default. Use client components only for real interactivity (forms with live validation, video player, markdown editor, chat, certificate scaling, etc.).

## 5. Database rules (MySQL to Postgres)

The old schema has 43 tables (MyISAM and InnoDB mix). Port ALL of them. The file `docs/schema/mysql_schema.txt` (or the path the user gives you) holds the original `CREATE TABLE` statements.

- Keep table and column names identical (snake_case) so the logic maps 1:1. Integer ids stay integers (`integer generated always as identity`); keep `bigint` where the original is bigint.
- `tinyint` 0/1 flags become `boolean`. Document every mapping in `docs/analysis/db-mapping.md`.
- `enum` becomes `text` + `CHECK` constraint (or a Postgres enum type, pick one and stay consistent).
- `datetime`/`timestamp` becomes `timestamptz` stored in UTC. Read how the PHP code sets its timezone (look for `date_default_timezone_set` and `NOW()` use) and format displayed dates/times exactly as the PHP pages do.
- `longtext` JSON columns (`versions`, `questions_data`, `answers_data`, `test_data`, `courses_json`) become `jsonb`.
- `ON UPDATE CURRENT_TIMESTAMP` becomes a shared `set_updated_at()` trigger.
- Add foreign keys with sensible `ON DELETE` behavior and the indexes from the original (MyISAM had no FKs; add them carefully and note any decision).
- `year(4)` becomes `smallint`. `decimal` stays `numeric` with the same precision.
- Enable Row Level Security on EVERY table with NO policies, and revoke privileges from `anon` and `authenticated`. Only the server connection (service role / pooler user) touches data.
- Sensitive instructor data (`pan_number`, `bank_account`, `ifsc_code`, `upi_id`, `account_holder`): encrypt at rest in the application with AES-256-GCM using a key from env (`DATA_ENCRYPTION_KEY`), store as `text`, decrypt only in the admin review screen and the instructor's own earnings/payout views.
- State that the PHP site kept in FILES must move into the database (see section 9).
  - Every migration is a numbered, re-runnable-safe `.sql` file in `db/migrations`. `npm run db:migrate` applies them in order using `DIRECT_URL` (Session Pooler in this environment) and records applied files in a `schema_migrations` table.
- The database starts EMPTY (fresh start, no data migration). Provide `npm run create-admin` (interactive: name, email, password) to create the first admin, and a seed script only for data the app genuinely needs to function (default `app_settings` rows).

## 6. Authentication, sessions, security (must mirror `private/auth.php`, `bootstrap.php`, `oauth.php`, `password_reset.php`)

- Read `private/auth.php`, `bootstrap.php`, `password_reset.php`, `oauth.php`, `functions/token_cleanup.php` completely and document every rule in `docs/analysis/auth-security.md` BEFORE coding: password policy, bcrypt cost, login attempt thresholds and block durations (email and IP), registration blocks, account recovery attempts, recovery mode, email verification expiry, reset token expiry and single-use rules, session lifetime and device/kick rules (`user_sessions`, `kicked_reason`), blocked-user handling (`is_active`, `block_reason`, `block_note`), `password_changed_at` session invalidation, role checks.
- Sessions: cryptographically random token in an `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie. Store only the SHA-256 hash of the token in `user_sessions.session_token`. Validate on every protected request (server-side guard functions in `lib/auth`). Do not use JWT as the session.
- All rate limits and lockouts are stored in Postgres (serverless has no shared memory) using the existing attempt tables, with the same thresholds and windows as the PHP code.
- CSRF: every state-changing request (POST/PUT/PATCH/DELETE, server actions included) verifies Origin/Host AND a CSRF token wherever the PHP forms used one. Close the gaps noted in the PHP code (for example any API endpoints that lacked CSRF, like the study-plan API).
- Post/Redirect/Get after every form POST, as in the PHP site, so refresh never resubmits.
- Role enforcement in a single reusable guard (student, instructor, admin), applied server-side on every page and API route. Preserve special rules (for example instructors blocked from student purchase flows, instructors needing approval, ownership checks on courses/lessons/submissions).
- Never reveal whether an email exists in forgot-password / login errors if the PHP did not.
- Security headers via `next.config` (`Content-Security-Policy` allowing only the origins actually used, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection) replicating `.htaccess`/`bootstrap.php` headers.
- Escape/sanitize all user content on output (React escapes by default; for markdown/HTML content use the sanitizer). No `dangerouslySetInnerHTML` with unsanitized data.
- Security events (what `private/logs/security.log` captured) go to a `security_events` table plus `console` (Vercel logs). Never log passwords, tokens or full card/bank data.

## 7. Email (Nodemailer)

- Port every email in `private/email/email_templates.php`, `email_senders.php`, `mailer.php` with identical subject lines, wording, HTML layout, links and sender names. Build links from `NEXT_PUBLIC_SITE_URL`.
- SMTP host/port/user/pass/from come from env. In serverless always `await` the send (or use `after()` from `next/server`) so the function does not terminate early. Handle failures the same way the PHP code did (fail silently vs show error), per case.

## 8. Uploads, media and storage

- Read `private/functions/upload_security.php`, `b2_storage.php`, `media_urls.php`, `public/media.php`, `public/ajax-image-upload.php`, `private/config/b2_config.php`, and `admin/serve-doc.php`. Keep EVERY validation rule (allowed types, size caps, magic-byte/MIME checks, image re-encoding or stripping if present, filename sanitizing, random names).
- Vercel limits request bodies to about 4.5 MB. Small uploads (avatars, small images) go through a server route with full validation. Larger files (PDFs, lesson files) use presigned PUT URLs direct to B2, followed by a server-side verification step (HEAD for size, ranged GET for magic bytes, delete the object if it fails) before the file is recorded in the database.
- Public assets (avatars, course thumbnails) are served through the same proxy/URL scheme as the PHP site so they stay SEO-friendly and cache-friendly (long `Cache-Control`, ETag). Private files (instructor ID documents, marksheets, assignment attachments, gated PDFs) live in a private bucket and are served only through authenticated, authorized routes (admin viewer, owner, or enrolled student) with the same checks as the PHP code. Support HTTP Range requests where the PHP proxy did.
- Course thumbnails and any other file that lived on the PHP server's local disk (`public/uploads`, `private/uploads`) also go to B2.

## 9. Serverless (Vercel) rules: no local disk, no long-running processes

The PHP site wrote state to files. Move ALL of it:
- `private/data/banners.json` and banner templates -> `site_banners` table + components.
- Admin settings page that rewrites files / `app_settings` -> `app_settings` table only.
- `.cleanup_last_run`, `.token_cleanup_last_run`, `.purge_last_run`, `maintenance.log` -> a `cron_state` table and `maintenance_logs` table.
- `php_errors.log`, `security.log` -> `security_events` / console.
- `public/sitemap.php` and any file it writes -> dynamic `app/sitemap.ts` (no file writes).
- Maintenance mode (`partials/maintenance-page.php`, `admin-maintenance-banner.php`) -> DB-driven setting checked in the proxy/middleware layer (use the convention of the installed Next.js version: `middleware.ts` or `proxy.ts`), with admin bypass exactly as before.
- Scheduled work (token cleanup, abandoned order reconciliation, scheduled deletion of instructor documents `docs_scheduled_delete`/`docs_delete_after`, maintenance) -> Vercel Cron routes under `app/api/cron/*`, protected by `CRON_SECRET` (verify the `Authorization: Bearer` header). Also keep the "lazy cleanup on request" behavior where the PHP did it. Configure schedules in `vercel.json` and note Vercel Hobby limits cron to once per day (document this in `docs/DEPLOY.md`).
- Set `export const maxDuration` on long routes (AI chat, payment verification, uploads). Stream AI responses where the PHP experience was streamed or incremental.
- Recommended region: `bom1` (Mumbai) in `vercel.json`, with the Supabase project in a nearby region (ap-south-1), to minimize latency for Indian users.

## 10. Payments (Razorpay)

Mirror `create-order.php`, `verify-payment.php`, `razorpay-webhook.php`, `mark-order-status.php`, `student/check-payment-status.php`, `private/functions/payment_reconciliation.php`:
- Prices and amounts always computed server-side from the database, never trusted from the client; amount in paise.
- Verify checkout signature with HMAC-SHA256 and `crypto.timingSafeEqual`. Webhook reads the RAW body (`await req.text()`) and verifies `X-Razorpay-Signature` before parsing.
- Idempotency: unique `razorpay_payment_id` in `purchase_history`; enrollment creation inside a single Postgres transaction; handle duplicate webhook + client-verify races exactly as the PHP does (statuses `created/enrolled/enrollment_failed/abandoned/failed/cancelled`, `paid/enrolled/enrollment_failed/refunded`).
- Role rule: instructors cannot buy; students cannot buy a course they already own; free courses follow the PHP free-enrollment path.
- Keep cancelled/failed payment visibility in purchase history and the receipt page.

## 11. SEO, speed and Google ranking (high priority)

- Public pages (home, about, browse, categories, category/[slug], course/[slug], instructor profile, help center, security, updates, verify-certificate, contact, report-bug, track pages) are server-rendered. Course/category/browse pages use ISR (`revalidate`) plus on-demand revalidation (`revalidateTag`/`revalidatePath`) when instructors or admins change courses, categories, reviews or banners.
- Per-page `generateMetadata`: title, description, canonical URL, Open Graph, Twitter Card, robots directives. Port every JSON-LD block from the PHP pages exactly (Organization, Course, BreadcrumbList, FAQ, etc.) as server-rendered `<script type="application/ld+json">`.
- Private/authenticated pages (student, instructor, admin, auth flows, checkout, receipts) get `noindex`.
- `app/sitemap.ts` (dynamic, includes published courses and categories), `app/robots.ts` matching `public/robots.txt`, `public/llms.txt` copied, the Google Search Console verification HTML file copied to `public/` unchanged, `manifest.ts` + service worker replicating the existing PWA install support.
- **URL parity:** keep every public URL the same. The PHP site already uses clean URLs (`.php` is stripped; `/course/{slug}`, `/category/{slug}`, `/sitemap.xml`). Replicate `.htaccess` redirects in `next.config` `redirects()` (permanent 301): any legacy `*.php` URL to its clean URL, `index`/`index.php` to `/`, `/public/...` to `/...`, plus HTTPS and the `?i=1` stripping rule. Read BOTH `.htaccess` files and `public/.htaccess` and port every rule.
- Performance: no layout shift, fonts through `next/font` (same families and weights as the PHP pages), images with explicit dimensions, `next/image` or `<img>` with width/height and lazy loading where it does not change appearance, minimal client JS, `Cache-Control` on proxied media, avoid waterfalls (parallel queries with `Promise.all`), indexes on hot queries. Target Lighthouse 90+ on public pages.

## 12. UI parity method (you cannot view images, so work from source)

- Reuse the existing CSS files from `public/assets/css/**` verbatim. Keep the same class names, CSS variables, media queries, keyframes and values. Import them per page/area (or globally for `base.css`, `navbar.css`) in the same cascade order the PHP pages linked them. Do not "clean up", rename, convert to Tailwind, or restyle.
- Port each PHP template's HTML to JSX 1:1: same element tree, same classes, same ids, same inline styles (converted to React style objects with identical values), same attributes, same text, same icons, same `alt`/`aria` attributes. Convert `<?= ... ?>` output to JSX expressions, PHP loops/conditions to JS equivalents.
- Port every JS file and inline `<script>` (`auth.js`, `code-highlight.js`, `course-ai.js`, `md-editor.js`, `video-player.js`, page-level scripts) into client components/hooks with identical behavior, timings, animations and event handling. Keep third-party libraries the PHP site loaded.
- Copy all images/fonts/icons/favicons from `public/assets/**` into the new `public/` keeping filenames.
- Shared pieces (head partial, navbar, footer, site banners, video player, file viewer, maintenance page) become shared components used identically by every page that used them.
- Special pages need extra care and exact reproduction: certificate page (fixed 1056x748 canvas, scale-to-fit script, embedded base64 assets, SVG arc text), receipt, student learn page, homepage animations, course detail layout, instructor wizard layout.
- Parity check script: `scripts/parity-check.mjs` extracts every class name and id from each PHP template's markup and checks that each appears in the corresponding new JSX/CSS; it lists missing ones. Run it at the end of every UI phase and fix all misses.

## 13. Workflow rules

- Maintain `docs/PROGRESS.md` (phase status, decisions, open issues) and `docs/feature-matrix.md` (every PHP file and every function in `private/functions/*` mapped to the new file(s), with status `done` / `partial` / `todo` and notes). Update both at the end of every phase.
- Before coding in a phase, read every PHP file in that phase's scope and write a short spec to `docs/analysis/<phase>.md` listing: purpose, inputs, DB tables touched, business rules, validations, security checks, emails sent, redirects, edge cases. Use it as the checklist while building.
- At the end of each phase: run `npm run typecheck`, `npm run lint`, `npm run build`. All must pass with zero errors. Fix everything before reporting.
- Write small, focused modules. Reuse shared code instead of duplicating it. Comments only where logic is non-obvious.
- If the PHP code has a bug or a vulnerability, port the INTENDED behavior and note the fix in `docs/PROGRESS.md`. Never silently drop a feature.
- Final report format for every phase (plain text): files created, features completed (mapped to PHP files), anything partial or blocked, security notes, commands the user should run, and what the user must provide (env values, SQL to run in Supabase).
- Plain text only in reports. The user's tooling cannot display images, so describe any visual detail in words.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 14. UI PARITY GATE

UI PARITY GATE: every phase that builds pages must run `npm run ui-compare` for its pages and reach zero mismatches above tolerance at all viewports before reporting. Results go into `docs\UI_PARITY_REPORT.md`.

Practical notes:
- `docs/UI_COMPARE.md` explains how to run the old PHP site copy, how to seed both sides, and how to read the report. Run `npm run ui-compare -- --page <id>` to limit the run.
- Tolerance is 1px for positions and sizes; colours are compared exactly.
- When PHP or MySQL is unavailable, `npm run ui-compare -- --site new` still records the applied stylesheet list, the fonts in use, page height, horizontal overflow and a screenshot per page+viewport. That alone catches a missing stylesheet, a wrong font stack or an extra navbar, but it cannot produce a numeric old-vs-new verdict. Say so explicitly in the phase report instead of claiming parity was measured.
- Structural pre-checks that need no running old site, and that catch the most common regressions: `npm run php-stylesheet-order` (per-page stylesheet order vs the new imports), `npm run css-usage` (which loaded sheets actually match the markup), `npm run css-conflicts` (does stylesheet order matter at all), `npm run php-chrome-map` (which templates render navbar/footer).
- A page's chrome is per template, not global: only the PHP templates that `include navbar.php` may load `navbar.css` or render the navbar, because that file declares a global `body { padding-top }`.