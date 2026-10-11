# Edulari security audit

Phase 10 audit. Static analysis of every route handler, page guard and security helper in the
Next.js port, checked against `AGENTS.md` sections 6, 8 and 10 and the OWASP Top 10.
Re-run after any change to `app/api/**` or `proxy.ts`.

## Summary

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | Authorization | PASS | Every mutating route and every protected page has a guard. |
| 2 | CSRF | PASS | 8 gaps found and fixed in Phase 10. |
| 3 | SQL injection | PASS | All queries are postgres.js tagged templates. |
| 4 | XSS | PASS | 2 gaps found and fixed in Phase 10. |
| 5 | Open redirect | PASS | 1 gap found and fixed in Phase 10. |
| 6 | SSRF | PASS | No server-side fetch uses a user-controlled URL. |
| 7 | File upload | PASS | Magic bytes, MIME allow-list, size caps, random names, delete-on-failure. |
| 8 | Rate limits | PASS | Thresholds match the PHP. |
| 9 | Sessions | PASS | SHA-256 hashed tokens, correct cookie flags. |
| 10 | Secrets | PASS | No secret in the repo; `.env.example` is placeholders only. |
| 11 | Headers / CSP | PASS | HSTS, nosniff, frame protection, nonce-based CSP. |
| 12 | Dependencies | PASS (prod) | `npm audit --omit=dev`: 0 vulnerabilities. |

Four gaps were found during this audit and fixed. They are listed in
"Remediations applied in Phase 10" below.

## 1. Authorization

Guard helpers (`lib/security/api.ts`, `lib/auth/guards.ts`, `lib/admin/api.ts`):

| Helper | Meaning |
|---|---|
| `getSessionFromRequest()` | Valid session, returns the user or null |
| `requireApiUser()` / `requireUser()` | Session required |
| `getAdminFromRequest()` / `requireAdmin()` | Session **and** `role = 'admin'` |
| `getApprovedInstructorFromRequest()` / `requireInstructorApproved()` | Session, instructor role, and an **approved** application |
| `authorizeAdmin(req)` | `getAdminFromRequest()` **and** Origin/Host match (for mutations) |

Route groups:

- `app/api/admin/**` — 16 routes, all call `authorizeAdmin` (`lib/admin/api.ts:18`).
- `app/api/instructor/**` — all call `getApprovedInstructorFromRequest` +
  `originMatchesHost` + CSRF. The PHP only checked the role here, so a pending or rejected
  applicant could POST directly; the port closes that gap (strengthening).
- `app/api/student/**`, `app/api/cart/**`, `app/api/wishlist/**`, `app/api/enroll`,
  `app/api/checkout` chain — session, then an explicit role check where the PHP had one.
- `app/api/cron/**` — 4 routes, all require `Authorization: Bearer ${CRON_SECRET}`.
- `app/api/razorpay/webhook` — authenticated by HMAC-SHA256 webhook signature, not a session.
- `app/api/media` — session required, then a per-`type` authorization switch
  (`avatar` owner, `lesson_pdf`/`assignment_file` enrolled-or-owner, `instructor_doc` admin
  only). The B2 object key is read from a database column, never from the request.
- `app/api/contact/track` — public by design, as in the PHP (ticket reference **and** email
  are both required).
- `app/api/site-banners`, `app/api/auth/me`, `app/demo`, `app/logout` — session-optional or
  public by design.

Page guards: every `app/(site)/admin/**/page.tsx` calls `requireAdmin()`, every
`app/(site)/instructor/**/page.tsx` calls `requireInstructorApproved()`, every
`app/(site)/student/**/page.tsx` calls `requireUser()` or `requireRole("student")`.

No mutating route was found without a guard.

## 2. CSRF

Mechanism:

- `proxy.ts:74-86` issues the `edulari_csrf` cookie on the first request of a session.
  It is `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 7-day max-age, and is **never
  rotated on POST** — the exact lifetime semantics of the PHP `$_SESSION` token.
- Server components read it with `readCsrfToken()` and pass it to client components as a
  prop; client components send it back either as a `csrf_token` form field or as the
  `X-CSRF-Token` header.
- Routes compare with `verifyCsrfToken()`, which uses `crypto.timingSafeEqual` over
  equal-length buffers (`lib/security/csrf.ts:10`).

Every state-changing route verifies **both** Origin/Host and the token. The Origin/Host
check alone is not sufficient (DNS rebinding), so the token check is the real control.

## 3. SQL injection

Every statement is a postgres.js tagged template, so values are bound as parameters and
never concatenated: `sql\`SELECT ... WHERE email = ${email}\``.

No `sql.unsafe()` call interpolates user input. Dynamic `ORDER BY` / `LIMIT` are chosen
from a fixed allow-list of `sql` fragments (`app/(site)/browse-courses/page.tsx:58-66`),
not from a raw string, so an attacker cannot inject an ordering clause.

## 4. XSS

`dangerouslySetInnerHTML` is used in a small number of deliberate places, all of which
were reviewed:

| Location | Content | Safe because |
|---|---|---|
| `LearnContent.tsx`, `SharedChatClient.tsx`, `course/[slug]/page.tsx` | `renderMarkdown(...)` | `marked` + `sanitize-html` allow-list (`lib/markdown.ts`) |
| `BannersView.tsx` | preview HTML | every interpolated value is escaped by `esc()` server-side (`lib/api/admin/banners.ts`) |
| `CategoriesClient.tsx`, `RegShell.tsx` | static SVG / static copy | no user data |
| `layout.tsx`, `register-success`, `course/[slug]`, `send-notifications` | static CSS strings | no user data |
| JSON-LD `<script>` blocks | `JSON.stringify(...)` | safe serialization |

React escapes all other interpolated text by default. No `dangerouslySetInnerHTML` receives
unsanitized user input after the Phase 10 fix.

## 5. Open redirect

Redirect targets are validated before use. `redirect` must be a local path
(`app/api/auth/login/route.ts:97`), and `next` must be a local path
(`app/api/reg-session/route.ts:16`). Role-based destinations come from a fixed table
(`lib/auth/redirect.ts`). Admin PRG redirects are built from `Referer` and re-anchored to
`SITE_URL` (`lib/api/admin/redirect.ts:12-29`).

## 6. SSRF

No server-side fetch takes a user-controlled URL. Outbound requests are to fixed or
env-configured hosts only: `lib/ai/course-chat.ts`, `lib/ai/question-generator.ts`
(AI provider endpoints), `lib/payments/razorpay.ts` (`api.razorpay.com`),
`lib/auth/oauth.ts` (Google/GitHub), and `lib/storage/b2.ts` (the B2 endpoint). The B2
object key is a database column, never request input, so `/api/media` cannot be used to
reach an internal host.

## 7. File upload

`lib/storage/upload-validation.ts` reproduces `upload_security.php`:

1. size cap,
2. MIME allow-list,
3. **magic-byte** confirmation against the file signature (`detectRealMime`),
4. scan for embedded PHP/script/`eval` patterns.

Applied at every upload route: `/api/upload/image`, `/api/editor/image`,
`/api/student/profile/avatar`, `/api/instructor/profile`, `/api/instructor/course`,
`/api/admin/courses`, `/api/instructor/course/[id]/content`, `/api/instructor-register/step/[n]`.

Filenames are regenerated with `crypto.randomUUID()` — user filenames never reach storage.

Large files use a presigned PUT to B2 followed by `verifyUploadedObject()`
(`lib/storage/b2.ts:75-102`): a HEAD for size, a ranged GET to confirm magic bytes, and a
**delete** if verification fails, so a bad object is never recorded in the database.

Private documents (instructor ID, marksheets) live in a private bucket and are served only
through `/api/media` with an authorization check. Public assets (avatars, thumbnails) are
served through the same proxy so the URLs stay cacheable.

## 8. Rate limits

`lib/security/rate-limit.ts`, all state kept in Postgres because serverless has no shared
memory:

| Flow | Limit | Window / block | Tracked by |
|---|---|---|---|
| Login | 5 attempts | 2 h block | email + IP |
| Registration | 5 attempts | 24 h window, 24 h block | IP |
| Password reset | 3 attempts | 10 min window | email + IP |
| Account recovery | 5 attempts | 2 h block | IP |
| Contact form | 5 messages | 1 h | IP |

## 9. Sessions

- Token: `crypto.randomBytes(32).toString("hex")`, stored only as a SHA-256 hash
  (`lib/auth/sessions.ts:4-9`). No JWT.
- Cookie: `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `maxAge = SESSION_LIFETIME`
  (24 h default).
- On validation the session checks `is_active`, `expires_at` and `password_checked_at`
  (`lib/auth/sessions.ts:35-61`).
- A new login keeps a rolling window of 5 sessions and marks the rest `is_active = false`,
  which is how the PHP "kick other devices" rule is expressed.
- `password_changed_at` invalidates every older session.

## 10. Secrets

A repository-wide grep for `sk_live`, `AIza`, `ghp_`, `xox*`, `BEGIN ... PRIVATE KEY`
and `AKIA...` returns nothing. `.env.example` contains only placeholders. Real values live
in `.env.local`, which is git-ignored (see `.gitignore`).

The old `private/secrets.php`, `private/config.php`, `private/config/b2_config.php` and
`private/api/api_config.php` were read **only** to learn the variable names and their
meaning; no value was ever copied into any file created by this migration.

## 11. Headers and CSP

`lib/security/headers.ts`, applied by `proxy.ts:87` on every response:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` |
| `Content-Security-Policy` | nonce-based `script-src`, explicit `style-src` / `font-src` / `img-src` / `connect-src` / `frame-src` |

The CSP allows only the origins the site actually uses: Razorpay checkout, Google/GitHub
OAuth, the AI provider, YouTube/Vimeo embeds, Google Fonts and the icon CDNs the PHP pages
loaded. `script-src` uses a per-request nonce, so an injected `<script>` without that nonce
cannot execute.

## 12. Dependencies

| Command | Result |
|---|---|
| `npm audit --omit=dev` | **0 vulnerabilities** |
| `npm audit` (includes dev) | 5 high, all in `braces` -> `micrematch` -> `fast-glob` -> `@next/eslint-plugin-next` -> `eslint-config-next` |

The 5 dev advisories are a stack-exhaustion DoS in a build-time glob matcher reached only
through ESLint. `npm audit fix --force` would downgrade `eslint-config-next` to 14.2.35,
which is incompatible with Next.js 16. These packages are not shipped to production and are
not reachable at runtime, so they are accepted. **Re-check when upgrading ESLint.**

## Remediations applied in Phase 10

| # | Gap | Fix |
|---|-----|-----|
| 1 | 8 mutating routes checked Origin/Host but not the CSRF token: `/api/cart/add`, `/api/enroll`, `/api/wishlist/toggle`, `/api/notifications/read-all`, `/api/notifications/[id]/read`, `/api/notifications/[id]/delete`, `/api/student/check-payment-status`, `/api/flash/consume` | Added `verifyCsrfToken(await readCsrfToken(), req.headers.get("x-csrf-token"))` to each route and threaded the token through the calling client components (`CourseClient`, `BrowseClient`, `UpdatesClient`, `MarkAllReadButton`, `FlashMessage`). |
| 2 | Open redirect: `/api/auth/login` echoed the caller-supplied `redirect` field into the JSON response, which `LoginForm` passed straight to `router.push` | `redirect` is now accepted only when it starts with `/` and not `//`, otherwise the role-based default is used (`app/api/auth/login/route.ts:97`). |
| 3 | XSS: `components/instructor/RegSteps.tsx` rendered error strings (which can embed the user's email) through `dangerouslySetInnerHTML` at two sites | Both now render as React text children, so React escapes them. |
| 4 | `private/functions/admin.php` had no counterpart for `getBlockedUsers()` and `getInstructorAuditSummary()` (admin.php:830, :843) | Ported to `lib/db/admin/users.ts`. Not a vulnerability, but an unverified gap in feature parity. |

## Accepted risks

- **`img-src` allows `https:`.** Course thumbnails and instructor-supplied images can live on
  any HTTPS host, as in the PHP. This permits tracking pixels in image slots but no script
  execution. Tightening it would break instructor-supplied thumbnails.
- **5 dev-dependency advisories** in the ESLint chain — see section 12.
- **`--site new` UI comparison** cannot produce an old-vs-new verdict while the PHP stack is
  unavailable; see `docs/UI_PARITY_REPORT.md`.