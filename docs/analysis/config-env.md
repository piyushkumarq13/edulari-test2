# config-env.md — Environment & Configuration Analysis (Phase 1)

Phase 1, document-only. Names, purposes and sources only — no values.

## 1. Sources read
- `private/bootstrap.php` — session cookie params, security headers, CSP nonce,
  lazy-cron triggers, maintenance-mode check.
- `private/config.php` — loads secrets, defines all constants, timezone, paths,
  logging helpers, currency/price helpers.
- `private/secrets.php` — populates `$_ENV` (names only, see §3).
- `private/config/b2_config.php` — Backblaze B2 credentials.
- `private/api/api_config.php` — AI provider keys/models/endpoints, test rules,
  AI timeouts.

## 2. bootstrap.php (runtime behavior)
- `session_set_cookie_params`: lifetime 86400, path `/`, domain '', secure,
  httponly, samesite Lax; `session.use_only_cookies=1`,
  `session.gc_maxlifetime=86400`, `session_start()`.
- Security headers (when HTTPS): HSTS `max-age=31536000; includeSubDomains;
  preload`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`.
- CSP per-request nonce (`base64_encode(random_bytes(16))`, constant `CSP_NONCE`).
  script-src: 'self', nonce, cdn.jsdelivr.net, cdnjs.cloudflare.com,
  checkout.razorpay.com, cdn.sheetjs.com, www.youtube.com,
  www.youtube-nocookie.com, player.vimeo.com.
  style-src: 'self' 'unsafe-inline' fonts.googleapis.com + the same CDNs.
  font-src: 'self' fonts.gstatic.com + CDNs.
  img-src: 'self' data: https:.
  connect-src: 'self', api.razorpay.com, accounts.google.com,
  oauth2.googleapis.com, www.googleapis.com, github.com, api.github.com.
  frame-src: 'self', api.razorpay.com, checkout.razorpay.com, youtube domains,
  player.vimeo.com.
- Calls: `maybeRunPaymentReconciliation()`, `maybeRunCancelledOrdersCleanup()`,
  `checkMaintenanceMode()` on every page load.

## 3. secrets.php — `$_ENV` names set
Guard: only loadable when `_EDULARI_BOOTSTRAP` is defined.
- `DB_PASSWORD` — MySQL password for the shared-hosting DB user.
- `SMTP_PASSWORD` — Gmail app password for the outgoing-mail account.
- `RAZORPAY_KEY_SECRET` — Razorpay API secret (signature verification).
- `RAZORPAY_WEBHOOK_SECRET` — separate Razorpay webhook payload secret.
- `OPENROUTER_API_KEY` — OpenRouter chat-completions key (active AI provider).
- `GROQ_API_KEY` — Groq key used by the student course-AI chat API.
- `NVIDIA_KIMI_API_KEY` — NVIDIA NIM Kimi key (inactive provider path).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth web client.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth app.

## 4. config.php — constants
Database:
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (from `$_ENV['DB_PASSWORD']`).

Site:
- `SITE_NAME` ('Edulari'), `SITE_URL` (canonical origin), `ADMIN_EMAIL`.
- `$CONFIG['site_url']`, `$CONFIG['site_name']`, `$CONFIG['support_email']`,
  `$CONFIG['support_name']` derived mirrors.

Security:
- `SESSION_LIFETIME` (86400), `HASH_COST` (bcrypt cost 12).
- `ROLE_ADMIN`, `ROLE_STUDENT`, `ROLE_INSTRUCTOR` ('admin'/'student'/'instructor').

SMTP (PHPMailer):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` ('tls'), `SMTP_AUTH` (true),
  `SMTP_USERNAME`, `SMTP_PASSWORD` (from env), `SMTP_FROM_EMAIL`,
  `SMTP_FROM_NAME` (= SITE_NAME).

Token expiry:
- `VERIFY_TOKEN_EXPIRY_MINS` (30), `PASSWORD_RESET_EXPIRY_MINS` (60).

Payments:
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (env), `RAZORPAY_WEBHOOK_SECRET`
  (env, defaults '').

OAuth:
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (env),
  `GOOGLE_REDIRECT_URI` = SITE_URL . '/auth/google/callback'.
- `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (env),
  `GITHUB_REDIRECT_URI` = SITE_URL . '/auth/github/callback'.

Paths/time:
- `date_default_timezone_set('Asia/Kolkata')` — all date display/NOW() is IST;
  the new app stores timestamptz UTC and must format display as IST.
- `ROOT_PATH`, `PUBLIC_PATH`, `PRIVATE_PATH`.

Logging:
- `LOG_PATH` (private/logs), `ERROR_LOG_FILE` (php_errors.log),
  `UPLOAD_LOG_FILE`, `SECURITY_LOG_FILE`, `MAINTENANCE_LOG_FILE`,
  `BANNER_LOG_FILE`. Helpers: `logSecurity` (hashes emails, adds ip/url/user),
  `logUpload`, `logApp`. Also sets `display_errors=0`, `log_errors=1`,
  `error_reporting(E_ALL)`, error_log to ERROR_LOG_FILE.

Currency:
- `CURRENCY_CODE` ('INR'), `CURRENCY_SYMBOL`, `CURRENCY_DISPLAY_SYMBOL`
  (resolved from a fixed currency-symbol map; unknown codes use "CODE ").
- `convertFromINR(float)` — live fx from open.er-api.com when CURRENCY_CODE is
  not INR, cached in session 1h, falls back to INR amount on failure.
- `formatPrice(float, bool)` — 'Free' for <= 0, else symbol + 2-decimal INR-
  converted; wraps in `.price` span classes unless htmlWrap=false.
- `maskEmail()` — keeps first 3 chars of local part + domain.

## 5. b2_config.php — constants
- `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_ID`, `B2_BUCKET_NAME`
  (each: env override with a hardcoded fallback — in the new app these MUST be
  env-only with no fallback).

## 6. api_config.php — constants
- `ACTIVE_AI_PROVIDER` — 'openrouter' ('nvidia_kimi' also supported).
- `OPENROUTER_API_KEY` (env, may be '' with error_log), `OPENROUTER_MODEL`
  ('openrouter/free'), `OPENROUTER_ENDPOINT`, `OPENROUTER_SITE_URL` (= site
  origin), `OPENROUTER_SITE_NAME`.
- `NVIDIA_KIMI_API_KEY` (env, may be ''), `NVIDIA_KIMI_MODEL`,
  `NVIDIA_KIMI_ENDPOINT`.
- Commented-out providers (documented but inactive): Google Gemini
  (`GOOGLE_AI_API_KEY`/`GOOGLE_AI_MODEL`/`GOOGLE_AI_ENDPOINT`), OpenAI
  (`OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_ENDPOINT`), Anthropic
  (`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`/`ANTHROPIC_ENDPOINT`).
- Test rules: `TEST_QUESTION_COUNT` (10), `TEST_PASS_SCORE` (80),
  `TEST_TOKEN_TTL_MINS` (30).
- AI timeouts: `AI_CONNECT_TIMEOUT` (10), `AI_REQUEST_TIMEOUT` (45),
  `AI_MAX_EXEC_TIME` (60).
- Student chat endpoint (`public/student/course_ai_chat_api.php`) reads
  `$_ENV['GROQ_API_KEY']` directly.

## 7. New app — final environment variable list
Map from PHP constants to Vercel env vars (all real values belong only in
.env.local, never committed):

| Env var | Purpose | Used by phase |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | Canonical origin for links, OAuth redirects, emails, sitemap | 1 (links everywhere) |
| SITE_NAME | Display name of the site | any UI/email |
| ADMIN_EMAIL | Support/admin contact email (support_email) | emails, footer |
| DATABASE_URL | Postgres via Supabase Session Pooler, `prepare: false` (postgres.js) | 1 onward |
| DIRECT_URL | Same Session Pooler string; migrations + scripts only | 1 |
| DATA_ENCRYPTION_KEY | AES-256-GCM key for instructor bank/PAN/UPI at rest | 1 (schema), used in instructor/earnings phases |
| SESSION_SECRET | Random secret for session token signing/derivation | 1 (auth) |
| CSRF_SECRET | Random secret for CSRF tokens | 1 (auth) |
| SESSION_COOKIE_NAME | Name of the session cookie | 1 |
| SESSION_LIFETIME | Session seconds (86400) | 1 |
| HASH_COST? | n/a — bcrypt cost 12 becomes a constant in code, not env | — |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_AUTH | Outgoing mail transport | email phase |
| SMTP_USERNAME / SMTP_PASSWORD | Mailbox credentials | email phase |
| SMTP_FROM_EMAIL / SMTP_FROM_NAME | Sender identity | email phase |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET | Payments | payments phase |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Google OAuth | auth phase |
| GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET | GitHub OAuth | auth phase |
| OPENROUTER_API_KEY / OPENROUTER_MODEL / OPENROUTER_ENDPOINT / OPENROUTER_SITE_NAME | Active AI provider | AI phase |
| GROQ_API_KEY / GROQ_MODEL / GROQ_ENDPOINT | Student course-AI chat | AI phase |
| NVIDIA_KIMI_API_KEY / NVIDIA_KIMI_MODEL / NVIDIA_KIMI_ENDPOINT | Standby AI provider | AI phase |
| ACTIVE_AI_PROVIDER | Which provider the AI routes use ('openrouter') | AI phase |
| AI_REQUEST_TIMEOUT / AI_CONNECT_TIMEOUT / AI_MAX_EXEC_TIME | AI call limits | AI phase |
| B2_ENDPOINT / B2_REGION | S3-compatible endpoint config | storage phase |
| B2_BUCKET_NAME / B2_BUCKET_ID / B2_KEY_ID / B2_APPLICATION_KEY | Backblaze B2 bucket + key | storage phase |
| CRON_SECRET | Bearer token guarding /api/cron/* | cron (section 9) |
| CURRENCY_CODE / CURRENCY_SYMBOL | Display currency + symbol (INR/₹ default) | currency parity where shown |

Notes:
- Supabase is used as a plain Postgres database only (postgres.js, transaction-mode
  pooler, `prepare: false`). No Supabase Auth/Storage/Realtime/client SDK.
- `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` collapse into `DATABASE_URL` +
  `DIRECT_URL`; `DB_PASSWORD` no longer exists as a separate var.
- File-based throttles (`.token_cleanup_last_run` etc.) are not env vars — they
  become `cron_state` rows (see maintenance-cron.md).

## Open questions
- Should `RAZORPAY_KEY_ID` remain a public-ish constant as in PHP (it is safe to
  expose) or also become env-only? .env.example currently has it env-only.
- Do we need separate env vars for the commented-out AI providers (Gemini/OpenAI/
  Anthropic)? PHP documents them but never uses them — lean: skip.
- Keeping `CURRENCY_CODE` configurable vs hardcoding INR: PHP supported switching;
  confirm the new app must keep the live FX conversion (open.er-api.com).
- Should `ADMIN_EMAIL` also receive security-event emails, or is it display-only
  support contact? PHP used it as `$CONFIG['support_email']` only.
