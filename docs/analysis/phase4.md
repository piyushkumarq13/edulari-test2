# Phase 4 spec — Shared layout, public pages, authentication pages

Written before coding, per the Phase 4 prompt ("read each PHP file fully, then write
docs/analysis/phase4.md with its spec before coding"). Sibling analyses:
`ui-global.md` (fonts/palette/breakpoints/navbar), `url-map.md` (every URL + access
level), `auth-security.md` (exact auth rules), `payments.md`, `storage-media.md`.

## 1. Shared layer

### 1.1 `public/partials/head.php` (91 lines)

Always emits, in order: `charset`, `viewport`, `<title>` (page errors if `$pageTitle`
is empty), `description`, `keywords` (optional), `robots`, `canonical` (only when
`$pageCanonical` is set), the full Open Graph set, the full Twitter card set,
Google-Fonts preconnect/preload/print-swap, six favicon/manifest links, `base.css`,
then each `$extraCss` file in array order.

Details that matter for parity:

- `robots` defaults to `noindex, nofollow` for `/admin*`, otherwise `index, follow`.
- `og:image` defaults to `SITE_URL . '/assets/images/og-cover.jpg'`.
- `og:url` defaults to `SITE_URL . $_SERVER['REQUEST_URI']` (always present).
- `og:type` defaults to `website`; `twitter:card` defaults to `summary_large_image`.
- The stylesheet link carries **no** `id`, yet every page script calls
  `document.getElementById('fontStylesheet')` — a PHP no-op bug. The port keeps the
  harmless guard.
- JSON-LD is **not** in head.php; it is per page. The layout therefore emits no
  layout-level JSON-LD.

Mapping: `app/layout.tsx` (Inter via `next/font`, AGENTS.md §11 overrides the raw
Google Fonts link), `lib/seo/metadata.ts#pageMetadata()` for the per-page block.

### 1.2 `public/navbar.php` (~1360 lines)

Branches on `$_unavRole` only: admin / instructor / student / guest. There is **no**
"pending instructor" state in the PHP (the Phase 4 prompt asks for one; it does not
exist upstream, so nothing is invented). Each branch is rendered twice — once for the
desktop dropdown region (~lines 40-500) and once for the mobile drawer (~lines
500-760) — plus a notifications dropdown and a scroll-arrow behaviour.

Mapping: `components/SiteNavbar.tsx` (client), data from `/api/auth/me` and
`/api/notifications`.

### 1.3 `public/footer.php`, `public/partials/site-banners.php`

Mapping: `components/SiteFooter.tsx`, `components/SiteBanners.tsx` (banner templates
live in `private/banner-templates/`).

### 1.4 `public/partials/maintenance-page.php` (100 lines)

A complete standalone document with its own `<head>`, inline `<style>`, dark gradient
background and a pulsing status dot. `checkMaintenanceMode()` defines
`MAINTENANCE_PAGE_RENDER` before including it; a direct URL hit returns 404.

Mapping: `components/maintenance-page.ts` (`renderMaintenancePage()`) returned from
`proxy.ts` with status 503.

### 1.5 `public/partials/admin-maintenance-banner.php` (65 lines)

Self-contained `admbn-*` banner, `position: sticky; top: var(--unav-h, 64px)`,
`z-index: 998` (just under the navbar's 999), lists which scopes are blocked plus the
auto-disable time, links to `/admin/settings`. Renders nothing when maintenance is off.

Mapping: `components/AdminMaintenanceBanner.tsx`.

### 1.6 `public/partials/video_player.php` + `assets/js/video-player.js`

`edulariVideoPlayer()` resolves YouTube / Vimeo / self-hosted sources and renders an
`evp-*` shell with custom controls (play, seek, time, volume, speed select, fullscreen).
The JS uses the YouTube IFrame API with `host: youtube-nocookie.com`, `controls: 0`,
speeds `[0.5, 0.75, 1, 1.25, 1.5, 2]` with index 2 preselected, an `edulari-logo.png`
centre button, and two distinct error strings (YouTube vs self-hosted).

Mapping: `components/VideoPlayer.tsx` (+ `styles/css/video-player.css`).

### 1.7 `public/partials/file_viewer.php` (87 lines)

`edulariFileViewer()` renders a toolbar plus a per-extension viewer, all through
`/media?type=lesson_pdf&id=`: pdf/txt/html → iframe; images → `<img>`; mp4/webm →
`<video>`; mp3/wav/ogg → `<audio>`; docx/pptx/xlsx/xls/csv/zip → CDN renderers
(docx-preview 0.3.4, pptx-preview 1.0.6, SheetJS 0.20.1, JSZip 3.10.1); anything else →
a "Preview is not available" note. All fetches use `credentials: "same-origin"`.

Mapping: `components/FileViewer.tsx`.

### 1.8 `assets/js/auth.js` (20 lines)

Delegates clicks on `.toggle-password[data-target]`, toggling the input type and
swapping `fa-eye` / `fa-eye-slash`.

Mapping: `components/PasswordToggles.tsx`.

## 2. Public pages (14 templates)

| Old template | Route | Notes |
|---|---|---|
| `public/index.php` | `/` | 1665 lines. Hero (badge, typing H1, search + popular tags, role CTAs, visual card, badges, rings, wave), brands strip, animated stats, categories, featured, latest + level filter, how-it-works, top-rated, features + mockup, testimonials carousel, instructor banner, final CTA, toast, back-to-top. WebSite + Organization JSON-LD. |
| `public/page/about.php` | `/about` | Founder story, stats, values, CTA. |
| `public/browse-courses.php` | `/browse-courses` | GET filters (category, level, price, search), 6 sort modes, grid/list view, 12-per-page pagination, wishlist + cart per card. |
| `public/categories.php` | `/categories` | Search, letter filter, sort, load-more (20 at a time), grid/list toggle. |
| — | `/category/[slug]` | Clean URL from the category slug. |
| `public/course.php` | `/course/[slug]` | JSON-LD Course + BreadcrumbList, accordion curriculum, free-preview gating, enrolled state with progress, wishlist/cart/free-enroll/unenroll, review form (enrolled only), related courses. |
| `public/instructor-profile.php` | `/instructor-profile/[slug]` | Stats, bio, course grid. |
| `public/contact.php` | `/contact` | 9 categories, 4 priorities, conditional `order_ref` (billing) / `course_ref` (course_content, technical) fields, live 5000-char counter, honeypot, consent. |
| `public/track-contact.php` | `/track-contact` | Reference + email lookup, threaded replies, masked email, status pills. |
| `public/help-center.php` | `/help-center` | Search, category cards, FAQ accordion, support cards. |
| `public/report-bug.php` | `/report-bug` | 6 issue-type pills, severity slider 1-5 with live label/colour, upload zone, per-field counters, honeypot, consent. |
| `public/track-report.php` | `/track-report` | Idle / error / found states, status banner, 4-step timeline, status callouts, admin note, masked email. |
| `public/security.php` | `/security` | **Requires login** (redirects to `/login` otherwise). Password change, strength meter, requirement checklist, session list with per-session and bulk logout, login history. |
| `public/updates.php` | `/updates` | **Requires login.** Filter tabs, accordion cards, mark-read / mark-all-read / delete. |
| `public/demo.php` | `/demo` | `echo "FTP deploy test successful - " . date(...)` — raw text, no HTML. Ported as a `text/plain` route. |
| `public/verify-certificate.php` | `/verify-certificate` | Public lookup, valid/invalid result panels, seal rings, copy buttons, print, trust badges. |

## 3. Auth pages

`login.php`, `register.php`, `register-success.php`, `account-activation.php`,
`verify-email.php`, `forgot-password.php`, `reset-password.php`,
`password-reset-after-verify.php`, `logout.php`, `auth/google/callback.php`,
`auth/github/callback.php`.

Behaviour comes from `docs/analysis/auth-security.md`: bcrypt verify with `$2y$`
prefix normalisation, 5-attempt / 2-hour lockout by email and IP, registration block
5 / 24h, verification token 30 min, reset token 60 min single-use, recovery mode,
session token stored as SHA-256, single-session kick with `kicked_reason`,
`password_changed_at` invalidation, blocked-user handling, role redirects.

## 4. Form security (from reading the PHP)

- **CSRF**: `verifyCSRFToken()` / `generateCSRFToken()` in `private/auth.php` store a
  32-byte hex token in `$_SESSION` and compare with `hash_equals`. The PHP forms that
  **verify** it: `contact.php:38`, `security.php:31`, `course.php:121`, `login.php`
  (x2), `register.php`, `forgot-password.php`, `reset-password.php`,
  `account-activation.php`. `report-bug.php` renders the hidden field but never checks
  it (PHP bug — the port checks it and this is recorded in PROGRESS.md).
- Port design: the token lives in an `edulari_csrf` httpOnly cookie issued by
  `proxy.ts` on first request (never rotated on POST, mirroring the session value).
  Server components read it and render the hidden field; route handlers compare it with
  `crypto.timingSafeEqual`. Origin/Host is verified in addition, per AGENTS.md §6.
- **Rate limits**: contact 5/IP/hour, bug reports, login 5/2h, registration 5/24h.
- **PRG**: every form POST returns a redirect target that the client navigates to.
- **Emails**: verification, welcome, password reset, contact acknowledgment, bug report.

## 5. SEO (AGENTS.md §11)

`generateMetadata` on every page via `lib/seo/metadata.ts#pageMetadata()`, which emits
the complete head.php-equivalent block (description, keywords, robots, canonical,
og:title/description/image/url/type, twitter card/title/description/image). `canonical`
is omitted where the PHP sets no `$pageCanonical`, but `og:url` is still emitted —
matching head.php, hence the `canonical: false` + `path` combination.

`noindex` is applied to auth flows and to `/security` and `/updates` per AGENTS.md §11
(note: `login.php` and `register.php` set `index, follow` upstream — the port follows
AGENTS.md, which is authoritative, and this deviation is recorded in PROGRESS.md).

Plus `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`, and the legacy `.php`
redirect rules in `next.config.ts`.

**No service worker was invented**: the old site ships none — `head.php` has no
registration and there is no `service-worker.js` in `public/`. PWA parity is therefore
the manifest link only, which `app/layout.tsx` now emits.

## 6. Out of scope

Cart, wishlist and checkout pages; payments; student, instructor and admin areas.
Only the AJAX endpoints the public pages call are implemented
(`/api/cart/add`, `/api/wishlist/toggle`, `/api/enroll`, `/api/course/review`).

## 7. Verification checklist (Phase 4 prompt)

- `npx tsc --noEmit`
- `npx eslint --max-warnings 0 .`
- `npx vitest run`
- `npx next build`
- `node scripts/parity-check.mjs` — all 14 templates, zero missing class/id
- `npx tsx scripts/verify-columns.ts` — every column referenced in `app/`+`lib/` exists
- `npm run smoke` — migrations, RLS, core tables, revoked grants, seed data
- fetch every public + auth page from `npm run dev` and confirm title, description,
  canonical, Open Graph, Twitter, robots, manifest, favicons, JSON-LD and H1
