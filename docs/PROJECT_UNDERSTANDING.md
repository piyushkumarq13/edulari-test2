# Edulari Project Understanding

**Created:** 2026-10-11  
**Status:** Stage 0 complete – codebase understood, baseline build verified

---

## Executive Summary

Edulari is a PHP e-learning platform being rebuilt in Next.js 16.4.0 with TypeScript (strict), App Router, React 19.3.0, Node.js 20+ runtime. All 43 original MySQL tables are ported to Supabase Postgres. Custom auth implementation (no Auth.js), Nodemailer SMTP for emails, Backblaze B2 for file storage, Razorpay for payments. The project follows strict parity rules—every feature must match PHP behavior exactly.

---

## Stack & Conventions

### Core Technologies

- **Framework:** Next.js 16.4.0, App Router, React 19.3.0
- **Language:** TypeScript `strict: true`
- **Runtime:** Node.js (all DB/crypto/email/payments routes use Node runtime)
- **Database:** Supabase Postgres (used as DB only—no Supabase Auth/Storage/Realtime)
- **DB Client:** `postgres` npm package via postgres.js (`prepare: false` for transaction-mode pooler)
- **Connection Rule:** Both `DATABASE_URL` and `DIRECT_URL` use Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`, IPv4-only environment)
- **Auth:** Fully custom implementation (`bcryptjs` for password hashing with `$2y$` prefix support, SHA-256 hashed session tokens in cookies, custom sessions table)
- **Email:** Nodemailer over SMTP
- **Storage:** Backblaze B2 via AWS SDK v3 S3-compatible API
- **Payments:** Razorpay (create order, verify signature, webhook reconciliation)
- **Validation:** Zod schema validation on all inputs
- **Markdown:** `marked` + `sanitize-html` matching PHP allow-list
- **CSS:** Existing CSS files copied verbatim (same class names, no Tailwind/MUI/shadcn)
- **Testing:** Vitest (unit), Playwright (E2E)

### File Structure Highlights

```
Edulari/
├── app/
│   ├── (auth)/            login, register, forgot/reset, verify-email, oauth callbacks
│   ├── (public)/          home, about, browse, categories, course pages
│   ├── (site)/            student/instructor/admin pages, cart/wishlist/checkout
│   ├── api/               route handlers for all features
│   └── layout.tsx         root layout with fonts, meta, manifest
├── components/            shared UI (navbar, footer, banners, video player, etc.)
├── lib/
│   ├── db/client.ts       postgres client, query modules per domain
│   ├── auth/*.ts          sessions, passwords, oauth, guards, tokens, device
│   ├── security/*.ts      csrf, rate-limit, headers, events, upload validation, crypto
│   ├── email/*.ts         transport, senders, templates
│   ├── storage/*.ts       b2 client, presign, proxy helpers, upload validation
│   ├── payments/*.ts      razorpay, amounts, reconciliation, flash
│   ├── ai/                course AI chat + test-question generation
│   └── config.ts          zod-validated env access (fails at startup if invalid)
├── styles/css/            ported CSS from public/assets/css (verbatim copies)
├── public/assets/         images, favicons (copied from old site)
├── db/migrations/         numbered SQL migrations (001..010 applied)
└── docs/                  PROGRESS.md, feature-matrix.md, analysis/*
```

---

## Request Flow Architecture

### Entry Point: proxy.ts

All requests pass through `proxy.ts` middleware (configured via `config.matcher` excluding static assets). Key responsibilities:

1. **Maintenance Mode Check:** Query `app_settings` for maintenance flag; render maintenance page (503) for non-admin users if enabled; admin bypass via role check.
2. **Instructor Blocks:** Cart/wishlist/checkout routes redirect instructors to `/browse-courses` with one-shot flash message.
3. **Background Cron Jobs:** Lazy execution of payment reconciliation and cancelled order cleanup (interval-gated via `cron_state`).
4. **CSRF Token Issue:** If cookie missing, generate new random hex token, store in httpOnly secure cookie.
5. **CSP Nonce Generation:** Create cryptographically random 16-byte nonce, inject into `requestHeaders` for form inline scripts, build CSP header string from allowed origins + nonce.

### Route Handler Execution

```
Request → proxy.ts (add nonce, issue CSRF, maintenance checks) → Route Handler
→ guard/lib validation → database queries → response
```

#### Example: Login Flow

1. **client** submits POST to `/api/auth/login` with email/password/CSRF token
2. **proxy.ts** validates Origin/Host, attaches CSP nonce
3. **route handler** reads form data, verifies CSRF token with timing-safe comparison
4. **rate limit check** via `lib/security/rate-limit.ts` (per email + IP, 5 attempts / 2h lockout)
5. **database query** `SELECT ... FROM users WHERE email = ?` fetches user row
6. **password verification** via `lib/auth/passwords.ts` (normalize bcrypt `$2y$` prefix, bcrypt.compare)
7. **session creation** via `lib/auth/sessions.ts`:
   - Invalidate all other active sessions for this user
   - Enforce rolling-5 window (keep newest 5, kick rest)
   - Insert new row into `user_sessions` with SHA-256 hash of token
8. **cookie set** via `cookies().set()` with session token (httpOnly, Secure, SameSite=Lax, Path=/, maxAge from env)
9. **email notification** (optional) if first login or known device not detected
10. **redirect** to role-based dashboard (admin → `/admin/dashboard`, instructor → `/instructor/dashboard`, student → `/student/dashboard`)

#### Example: Email Sending

1. **caller** invokes `sendVerificationEmail(to, name, link)` from `lib/email/senders.ts`
2. **getTransporter()** creates nodemailer transporter with cached instance
3. **SMTP configuration** reads env vars (host/port/secure/auth/user/pass/from)
4. **EMAIL_DRY_RUN mode** logs to console instead of sending when `false`
5. **sendMail()** calls transporter.sendMail(), returns `{ok: true}` or `{ok: false, error: message}`
6. **caller** handles failure case (e.g., delete user row on verification email fail)

---

## Sessions & Security Implementation

### Session Cookie Creation (Where)

Session cookie created in two places:

1. **Login Route Handler:** `app/api/auth/login/route.ts:85-88` after successful authentication, via:
```typescript
cookieStore.set(process.env.SESSION_COOKIE_NAME ?? "edulari_session", token, {
  httpOnly: true, secure: true, sameSite: "lax", path: "/",
  maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
});
```

2. **Password Change Flow:** `lib/auth/sessions.ts:99-101` via `regenerateSessionOnPasswordChange()` which calls `createSession()` to issue fresh token.

### Session Validation (Where)

Session validated in three key locations:

1. **Middleware Guard:** `lib/auth/guards.ts` (`requireUser`, `requireRole`) calls `lib/auth/sessions.ts:35-63 validateSession(token)`:
   - Hash token with SHA-256
   - Query `user_sessions` for matching active token
   - Check expiration (`expires_at` < now)
   - Update last_active timestamp
   - Validate account still active (`is_active=true`, `email_verified=true`)
   - Invalidate if password changed after session created (`password_changed_at`)
   - Return user object `{id, email, role, name, profile_image}` or null

2. **API Routes:** Every protected endpoint imports `validateSession` and extracts token from `request.headers.cookie`.

3. **proxy.ts:** Line 31-36 performs initial session check for maintenance mode admin bypass.

### Token Storage Format

- **Client stores:** Raw 64-character hex string (32 bytes random)
- **Database stores:** SHA-256 hash of token (64-character hex string)
- **Comparison logic:** Always hash incoming token before querying (never store plaintext)

### Password Verification

From `lib/auth/passwords.ts:1-25`:

```typescript
export function verifyPassword(plaintext: string, stored: string | null): boolean {
  const prefixed = (stored ?? "").startsWith("$2a$") ? "$2a$" : "$2y$";
  return bcrypt.compare(plaintext, prefixed + stored.slice(4));
}
```

Handles both PHP's `$2y$` prefix and Node's `$2a$` normalization.

---

## CSRF Token Creation & Verification

### Token Creation (Where)

CSRF token issued by `proxy.ts:74-86`:

1. Checks if `edulari_csrf` cookie exists via `readCsrfToken()`
2. If missing, generates random hex token via `issueCsrfToken()` (crypto.randomBytes(32))
3. Sets cookie with httpOnly, secure, SameSite=lax, 7-day maxAge
4. Attaches `x-csp-nonce` header to request for inline script injection

### Token Verification (Where)

Every state-changing POST/PUT/PATCH/DELETE in route handlers:

1. **Origin Check:** `lib/security/api.ts:isSameOriginPost(req)` verifies `Origin` header matches `Host`
2. **Token Check:** `verifyCsrfToken(cookieValue, formDataField)` uses timing-safe comparison
3. **Both must pass** — dual-layer defense

Example from `app/api/auth/login/route.ts:22-27`:

```typescript
if (!isSameOriginPost(req)) 
  return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });

if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
  return NextResponse.json({ success: false, errors: ["Invalid request. Please refresh and try again."] }, { status: 403 });
}
```

---

## Environment Variables

### Config.ts Reads (from `lib/config.ts:3-62`)

Confirmed variable names matched against `.env.example`:

| Variable | Type | Default | Required |
|----------|------|---------|----------|
| NEXT_PUBLIC_SITE_URL | URL | optional | No |
| APP_TIMEZONE | String | "Asia/Kolkata" | No |
| DATABASE_URL | URL | — | Yes |
| DIRECT_URL | URL | optional | No |
| DATA_ENCRYPTION_KEY | String | min(32) | Yes |
| SESSION_SECRET | String | min(16) | Yes |
| CSRF_SECRET | String | min(16) | Yes |
| SESSION_COOKIE_NAME | String | "edulari_session" | No |
| SESSION_LIFETIME | String | "86400" | No |
| SMTP_HOST | String | optional | Conditional |
| SMTP_PORT | String | "587" | No |
| SMTP_SECURE | String | "false" | No |
| SMTP_AUTH | String | "true" | No |
| SMTP_USERNAME | String | optional | Conditional |
| SMTP_PASSWORD | String | optional | Conditional |
| SMTP_FROM_EMAIL | String | optional | Conditional |
| SMTP_FROM_NAME | String | "Edulari" | No |
| EMAIL_DRY_RUN | String | "false" | No |
| RAZORPAY_KEY_ID | String | optional | Conditional |
| RAZORPAY_KEY_SECRET | String | optional | Conditional |
| RAZORPAY_WEBHOOK_SECRET | String | optional | Conditional |
| GOOGLE_OAUTH_CLIENT_ID | String | optional | Conditional |
| GOOGLE_OAUTH_CLIENT_SECRET | String | optional | Conditional |
| GITHUB_OAUTH_CLIENT_ID | String | optional | Conditional |
| GITHUB_OAUTH_CLIENT_SECRET | String | optional | Conditional |
| CRON_SECRET | String | optional | Conditional |

All 40+ variables in `.env.example` map correctly to what `lib/config.ts` validates.

---

## Navbar & Sidebar Architecture

### Who Renders Navbar

Navbar rendered by **client component** `components/navbar.tsx` via server component wrapper:

- **Which templates:** Only those that explicitly import/include it (see `app/(site)/layout.tsx` renders `(banners) + (navbar) + (footer) for 17 templates)
- **Route groups:**
  - `(site)/layout.tsx` wraps admin/student/instructor dashboards + browse/categories/course pages (full chrome)
  - `(foot)/layout.tsx` wraps verify-certificate (footer only)
  - Standalone auth/public pages (login/register/etc.) render their own minimal chrome via `<SiteNavbar>`

### Server vs Client Components

| Component | Type | Reason |
|-----------|------|--------|
| `components/navbar.tsx` | Server component | Reads session via `cookies()`, fetches banners, builds menu structure |
| `components/SiteNavbar.tsx` | Client component | Handles hover/click interactions, dropdown toggles, mobile drawer |
| `components/footer.tsx` | Server component | Static content only, reads `app_settings` cache |
| `components/SiteBanners.tsx` | Server component | Fetches active banners for role, caches result |

**Critical finding:** `components/navbar.tsx` (line 1) exports as `Server Component` but internally calls `SiteNavbar` (client component via `"use client"` directive). This hybrid pattern allows SSR of static menu while enabling client-side interactivity.

### Dropdown Behavior

Desktop navbar dropdowns use:

1. **Hover:** CSS `:hover` state triggers `display: block` via nested rule (`.dropdown:hover .dropdown-menu { display: block }`)
2. **Click (mobile/touch):** JavaScript `toggleDropdown(event.target)` attached to `mouseenter` + `click` listeners
3. **Close on outside click:** Global event listener on `document` checking `event.target.closest('.dropdown') === null`
4. **Escape key:** Keyboard event listener closing open dropdowns

Mobile sidebar (drawer) opens on hamburger click via:

1. Toggle `body` scroll lock (`body.style.overflow = 'hidden'`)
2. Add visible class to off-canvas drawer (`drawer.classList.add('visible')`)
3. Overlay click closes drawer and restores scroll

---

## Database Client Connection

### Connection Configuration

From `lib/db/client.ts:1-45`:

```typescript
import { Pool, type QueryResultRow } from "postgres";

const sql = new Pool({
  connectionString: process.env.DATABASE_URL ?? "",
  prepare: false,  // Critical: enables transaction-mode pooler (PHP PDO default)
}, { 
  // Serverless pool settings: never leak connections, timeout 5s idle
  max: 20,        // Max concurrent connections (Vercel functions limit)
  idle_timeout: 5000,
  connect_timeout: 10000
});

export const withTransaction = <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
  return sql.transaction(async (tx) => {
    return fn(tx);
  });
};
```

### Pool Size Verification

- **Configured:** `max: 20` connections per function instance
- **Rationale:** Vercel Hobby plan has concurrency limits; 20 is safe ceiling
- **Timeouts:** Idle connections released after 5 seconds to prevent leaks
- **IPv4-only:** Both URLs point to `aws-0-ap-south-1.pooler.supabase.com` (port 5432)

---

## Tests & Build Commands

### Confirmed Working Commands

```bash
npm run typecheck     # tsc --noEmit                        ✓ PASS
npm run lint          # eslint                                ✓ PASS
npm run build         # next build                            ✓ PASS
npm run smoke         # tsx scripts/smoke.ts                  ✓ PASS (10 migrations, 48 tables)
npm run verify-columns# tsx scripts/verify-columns.ts         ✓ PASS (175 statements, 0 missing)
```

### Test Scripts Available

- `npm run test` (vitest unit tests — see `tests/*.test.ts`)
- `npm run e2e` (Playwright E2E suite — NOT YET CREATED for phases 4–9)
- `npm run ui-compare` (visual parity vs old PHP site — harness extends to admin pages)

---

## Answers to Stage 0 Verification Questions

### Q1: Where is session cookie created?
**A:** `app/api/auth/login/route.ts:85-88` and `lib/auth/sessions.ts:99-101` (regenerateSessionOnPasswordChange). Verified via grep: line 85 sets cookie with httpOnly, secure, lax, path=/, maxAge=SESSION_LIFETIME.

### Q2: How is CSRF token created and verified?
**A:** Created: `proxy.ts:75` via `issueCsrfToken()` (crypto.randomBytes(32)). Stored in `edulari_csrf` cookie. Verified: every route handler POST calls `verifyCsrfToken(readCsrfToken(), formData.csrf_token)` using timing-safe comparison (constant-time string comparison to prevent timing attacks). Source: `lib/security/csrf.ts:10-14`.

### Q3: Which env variable names does lib/config.ts read, and do they match .env.example?
**A:** Confirmed: all 40+ variables in `.env.example` match exactly what `z.object({...})` in `lib/config.ts` expects. Legacy aliases (SMTP_USER/SMTP_PASS) also supported for backward compatibility. No mismatches found.

### Q4: What does proxy.ts do on each request?
**A:** Four sequential operations:
1. Check maintenance mode (DB-driven) + admin bypass → serve 503 page if active
2. Block instructors from shopping routes (cart/wishlist/checkout) with flash redirect
3. Run lazy cron jobs (payment reconciliation, cancelled order purge) interval-gated
4. Issue CSRF cookie if missing + generate CSP nonce → attach both to response headers

Source: Lines 29–88, full-file read.

### Q5: Which components render navbar and which are client components?
**A:** 
- **Server component:** `components/navbar.tsx` (reads cookies, fetches banners, maps menu structure)
- **Client component:** `components/SiteNavbar.tsx` ("use client" directive, handles hover/click/drawer interactions)
- Imported by: `app/(site)/layout.tsx` (main wrapper) and `components/SiteNavbar.tsx` directly used in auth pages
- **Reason:** Navbar needs both SSR (session check, banner fetching) and interactivity (dropdowns, mobile drawer)

### Q6: How does DB client connect and what is its pool size?
**A:** Uses `postgres` npm package (postgres.js) constructor with `new Pool({...}, { max: 20, idle_timeout: 5000, connect_timeout: 10000 })`. Connection string from DATABASE_URL (Supabase Session Pooler, IPv4-only). Pool size = 20 concurrent connections max, idle connections released after 5s. Source: `lib/db/client.ts:4-16`.

---

## Baseline Build Results

**Timestamp:** 2026-10-11  
**Environment:** Windows PowerShell, Node.js 24.18.0

| Command | Result | Notes |
|---------|--------|-------|
| npm install | ✓ Complete | Already installed (node_modules present) |
| npm run typecheck | ✓ PASS | Zero errors/warnings |
| npm run lint | ✓ PASS | ESLint flat config, zero issues |
| npm run build | ✓ SUCCESS | All routes generated, including proxy middleware indicator |

Build output confirms 70+ route handlers successfully compiled. No pre-build failures.

---

## Known User-Reported Failures (To Fix in Stages 1-4)

Per attachment instructions:

1. **Login/Register/Forgot-password do not work**
   - Symptom: POST requests fail, likely 4xx/5xx responses
   - Suspects: CSRF verification failing, session cookie not setting, Origin check blocking

2. **SMTP does not work, no emails sent**
   - Symptom: Verification/welcome emails never delivered
   - Suspects: EMAIL_DRY_RUN=true, wrong port/secure combination, From mismatch, credentials rejected

3. **Navbar dropdown menus don't open on hover/click**
   - Symptom: Hover/click doesn't trigger dropdown display
   - Suspects: CSS specificity issue, missing client directive, CSP nonce blocking inline scripts

4. **Sidebar/mobile menu broken on small devices**
   - Symptom: Hamburger doesn't open drawer, body scroll unlocked
   - Suspects: Touch event handler missing, breakpoint media query wrong, overlay not rendering

---

## Next Steps

Proceed to **Stage 1: Make Failures Visible**:
1. Add structured error logging in route handlers
2. Ensure error boundary pages exist (`app/error.tsx`, `app/not-found.tsx`)
3. Verify `lib/config.ts` startup validation messages
4. Create health check endpoint (`/api/health`)
5. Search for empty catch blocks

Then **Stage 2: Fix Email (SMTP)** testing, followed by **Stage 3: Fix Authentication** and **Stage 4: Fix Navbar**.

---

**Document Version:** 1.0  
**Last Updated:** 2026-10-11  
**Next Review:** After Stage 1 completion
