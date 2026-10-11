# UI Global — fonts, colors, breakpoints, icons, third-party, head, navbar, footer, banners, viewers

All paths relative to `C:\Users\piyus\Desktop\htdocs (7)\htdocs`.

## Fonts

- Primary: **Inter** via Google Fonts, weights **300, 400, 500, 600, 700, 800**, loaded with the
  non-blocking pattern `<link rel="preload" as="style">` + `media="print" onload="this.media='all'"`
  + `<noscript>` fallback (see `public/partials/head.php:70-74`). Stack:
  `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  (`--font-primary` in `assets/css/base.css:2`).
- Certificate page (`student/generate-certificate.php`) additionally loads **Cinzel** 400/600/700 and
  **EB Garamond** 400/500/600 italic 400/500, plus Inter 300–700.
- Receipt (`student/receipt.php`) additionally loads **Plus Jakarta Sans** 600/700/800.
- Maintenance page and admin maintenance banner reuse Inter 300–800.

## Color palette tokens (from `assets/css/about.css:8-54` — the canonical token block repeated across
page CSS; each page CSS defines its own copy of the same tokens)

- Primary: `--primary:#6c63ff`, `--primary-dark:#5449e6`, `--primary-light:#ede9fe`,
  `--primary-glow:rgba(108,99,255,0.35)`
- Accents: `--accent-orange:#f59e0b` / lt `#fef3c7`, `--accent-red:#ef4444` / `#fef2f2`,
  `--accent-blue:#3b82f6` / `#eff6ff`, `--accent-green:#10b981` / `#ecfdf5`,
  `--accent-purple:#8b5cf6` / `#f5f3ff`
- Surfaces: `--bg:#f5f6fa`, `--surface:#ffffff`, `--surface-2:#f9fafb`, `--surface-3:#f0f1f8`
- Text: `--text-primary:#111827`, `--text-secondary:#6b7280`, `--text-muted:#9ca3af`,
  `--text-inverse:#ffffff`
- Borders: `--border:#e5e7eb`, `--border-hover:#d1d5db`, `--border-focus:#6c63ff`
- Shadows: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-card`,
  `--shadow-card-hover`, `--shadow-primary:0 8px 24px rgba(108,99,255,0.28)`
- Radii: `--radius-sm:6px`, `--radius-md:10px`, `--radius-lg:16px`, `--radius-xl:24px`,
  `--radius-full:9999px`
- Navbar-local tokens (`navbar.css:8-25`): `--unav-h:64px`, `--unav-bg:#fff`, `--unav-border:#e5e7eb`,
  `--unav-text:#374151`, `--unav-muted:#6b7280`, `--unav-accent:#2563eb`, `--unav-accent-hov:#1d4ed8`,
  `--unav-hover-bg:#f3f4f6`, `--unav-dd-bg/border/shadow:0 8px 28px rgba(0,0,0,0.12)/radius 8px`,
  `--unav-danger:#dc2626`, badges `--unav-badge-admin:#7c3aed`, `--unav-badge-inst:#0891b2`,
  `--unav-badge-stu:#059669`.
- Footer (self-contained `.uftr-` styles): bg `#0d1b2e`, text `rgba(255,255,255,0.6)`, role badge
  tints student `#a78bfa` on `rgba(108,99,255,0.18)`, instructor `#34d399` on `rgba(16,185,129,0.18)`,
  admin `#fbbf24` on `rgba(245,158,11,0.18)`, hover accent `#6c63ff`, heart `#f87171`.
- Banner type colors (`partials/site-banners.php`): info `#eff6ff/#1e3a5f/#bfdbfe` + CTA `#3b82f6`,
  warning `#fffbeb/#5c3d0a/#fde68a` + CTA `#f59e0b`, success `#ecfdf5/#064e3b/#a7f3d0` + CTA
  `#10b981`, promo gradient `#fff0f0→#fff5e6` + CTA `#e84545`.
- Maintenance page: dark gradient `#0f0c29→#1a1a4e→#24243e`, accent `#e84545`.

## Breakpoints used across all CSS (union from `public/assets/css/**`)

`max-width`: 360, 380, 400, 420, 480, 520, 540, 580, 600, 640, 680, 700, 767, 768, 780, 860, 899,
900, 959, 960, 1023, 1024, 1100, 1200, 1280, 1400 px.
`min-width`: 480, 769, 900, 960, 1024, 1025 px (incl. `960px and (max-width:1200px)` and
`min-height:800px` variants).
Feature/behavior: `@media (hover:hover)`, `@media (prefers-color-scheme: dark)`,
`@media (prefers-reduced-motion: reduce)`, `@media print`.
Navbar: desktop nav shows `@media (min-width:769px)`; hamburger drawer at `@media (max-width:768px)`;
mobile drawer z-index 1000; navbar z-index 999. Footer breakpoints: 1200/1024/768/480/360.
JS complements CSS breakpoint at `window.innerWidth > 768` (`navbar.php` inline script) and
`> 1024`-ish desktop padding adjustments (`min-width:1025px` for scroll-arrow spacing).

## Icon library

- **No global icon font.** Inline SVGs are used everywhere in navbar/footer/banners.
- **Font Awesome 6.5.x** via cdnjs is loaded only on page-specific CSS where FA classes are used:
  `instructor/course-content.php`, `instructor/create-course.php`, `instructor/edit-course.php`
  (6.5.1), and `student/generate-certificate.php` (6.5.0). FA classes: `fa`, `fa-*` glyphs.
- Icons elsewhere: hand-written inline SVG (navbar search/bell/cart/wishlist/trash/logout, etc.),
  and single-glyph spans in banner templates (`i`, `!`, check, tag).

## Third-party scripts / CDNs (verified)

- Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) — Inter, Cinzel, EB Garamond, Plus
  Jakarta Sans.
- `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css` (3 instructor pages)
- `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css` (generate-certificate)
- `https://checkout.razorpay.com/v1/checkout.js` (`checkout.php`)
- `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` (`instructor/earnings.php`)
- `https://cdn.jsdelivr.net/npm/docx-preview@0.3.4/...`, `pptx-preview@1.0.6`, `jszip@3.10.1`
  (file_viewer), `https://cdn.sheetjs.com/xlsx-0.20.1/.../xlsx.full.min.js` (file_viewer)
- `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` + `jspdf/2.5.1` +
  `qrcodejs/1.0.0` (`student/generate-certificate.php`, `student/receipt.php`)
- `https://player.vimeo.com/video/{id}` iframes and YouTube embeds via `video_player.php`
  (`EdulariVideoPlayer` from `assets/js/video-player.js`).
- `https://cdn.jsdelivr.net/npm/docx-preview...` etc. — the learn page's file viewer (`lfv`) fetches
  `/media?type=lesson_pdf&id=` and renders PDF/txt/html in iframe, images with `<img>`, mp4/webm in
  `<video>`, mp3/wav/ogg in `<audio>`, docx via docx-preview, pptx via pptx-preview, xlsx/csv via
  SheetJS, zip listing via JSZip.
- `video_player.php` normalizes YouTube URLs (`youtu.be`, `?v=`, `/embed|shorts|live|v|e`,
  `attribution_link`) and Vimeo (`vimeo.com/(video/)?{id}`, `player.vimeo.com/video/{id}`) to IDs and
  emits either `EdulariVideoPlayer.init({youtubeId,logo})` or Vimeo iframe `aspect-ratio:16/9`, or
  `{src,logo}` for direct files.

## head.php output (`public/partials/head.php`)

Expected vars: `$pageTitle` (required), `$pageDescription`, `$pageKeywords`, `$pageCanonical`,
`$pageRobots` (default `index, follow`; **auto `noindex, nofollow` when request path starts with
`/admin`**), `$ogTitle/$ogDescription/$ogImage/$ogUrl/$ogType` (title/description/SITE_URL +
`/assets/images/og-cover.jpg`/current URI/`website` defaults), `$twitterCard` (default
`summary_large_image`)/`twitterTitle/twitterDescription/twitterImage`, `$extraCss` (string|array).
Emits: `charset`, `viewport`, `<title>`, description, keywords, robots, canonical, OG set, Twitter
set, fonts preconnect/preload/stylesheet + noscript, favicon set
(`/assets/images/favicon/favicon.ico`, `-16x16.png`, `-32x32.png`, `apple-touch-icon.png`,
`android-chrome-192x192.png`), `site.webmanifest`, `/assets/css/base.css`, and each `$extraCss`
stylesheet. **No JSON-LD here** — JSON-LD (`application/ld+json`) lives in individual pages:
`index.php`, `about.php` (page/about), `browse-courses.php`, `categories.php`, `course.php`,
`contact.php`, `help-center.php`, `instructor-profile.php`.

## Navbar (`public/navbar.php` + `navbar.css`)

- Layout: single sticky top bar (`.unav`, height 64px, z 999, body `padding-top:64px`),
  Coursera-style; **no sidebar for any role**. Same structure for guest/student/instructor/admin.
- Accepts `$currentUser` or legacy `$user`; role from `ROLE_ADMIN/ROLE_INSTRUCTOR/ROLE_STUDENT`.
- Per-role nav link sets (exact labels in source):
  - Guest: Explore Courses, Categories, How It Works (`#`), Verify Certificate, Teach With Us,
    Contact (Contact Us / Track My Ticket), Support (Help Center / Report a Bug / Track Report).
  - Student: Explore (Browse All Courses / Categories / Verify Certificate), Dashboard, My Learning,
    Certificates, My Schedule, Grades, Assignments (`#`), Contact, Support.
  - Instructor: Dashboard, My Courses (All Courses / Create New Course / Course Analytics), Students,
    Analytics, Earnings, Reviews, Messages (`#`), Contact, Support.
  - Admin: Dashboard, Users, Courses (All Courses / Create Course), Applications, Enrollments,
    Categories, Reviews, Bug Reports, Contact Inbox, Settings, Banners, Support.
- Active link: `unav-active` via URI prefix match OR legacy `$activeNav` key.
- Avatar: image via `getAvatarUrl($currentUser['profile_image'])` else 2-letter initials from name;
  shown in right actions (profile dropdown) and mobile drawer header.
- Notifications: bell button for logged-in users; unread count badge (`getUnreadNotificationCount`),
  red dot, dropdown lists **recent 5** (`getRecentNotifications($u,5)`) with type label
  (`notificationTypeLabel`) + `date('d M, g:i a')`, unread row highlight
  (`unav-notif-item--unread`), "Mark all read" (`unavMarkAllRead`), "View all updates →", empty
  state "No notifications yet". Links to `/updates.php?id=…`. (Links still use `.php`; Next port
  should emit clean URLs like `/updates?id=…`.)
- Profile dropdown card: header (avatar, name, email, role badge
  `unav-pd-badge--admin|instructor|student`), groups: Account (My Profile per-role URL; Updates →
  `/updates.php`; Settings per-role; Security & Password → `/security`), Student extras
  (Accomplishments → `/student/certificates`, My Purchases → `/student/purchase-history`),
  Instructor extras (Public Profile → `/instructor-profile?id=`, Payout Settings `#`), Admin extras
  (Audit Log `#`), Support, and CSRF-protected Log Out (POST `/logout`, hidden `csrf_token`).
- Guest right actions: wishlist/cart links go to `/login`; profile area becomes Log In / Sign Up
  buttons. Students (not admin/instructor) see wishlist (`/wishlist`) and cart (`/cart`) icons.
- Search: always-visible search button (Ctrl+K), modal (`#unavSearchModal`) with input + Enter
  → `UNAV_SEARCH_URL = SITE_URL . '/browse-courses'`; Esc closes.
- Mobile: hamburger `#unavHamburger` (3 spans → X), drawer `#unavDrawer` (z 1000, body overflow
  hidden), accordion groups for dropdowns, per-role extra links, CSRF logout at bottom; guest gets
  Log In/Sign Up + Wishlist/Cart to `/login`. `resize` > 768px closes drawer.
- Desktop dropdowns: click toggle on all widths, hover open with leave-delay ≥ 769px, and a JS
  "tablet overflow-clip fix" that re-parents `.unav-dd` into `<nav>` and positions it under its
  trigger so `overflow-x:auto` scroll containers don't clip it.
- Scroll shadow: `unav-scrolled` toggled when `scrollY > 6`. Prev/Next scroll arrows
  (`#unavScrollPrev/#unavScrollNext`) for the horizontally scrollable links row.
- CSP: inline scripts carry `nonce="<?= CSP_NONCE ?>"` — Next port must thread a CSP nonce through
  layout scripts.

## Footer (`public/footer.php`)

- Self-contained: all CSS inline in a `<style>` block, **everything scoped under `.uftr-` prefix**
  with a hard reset (`!important` on margin/padding/box-sizing for `.uftr-footer *`), high
  specificity double-class `.uftr-footer.uftr-footer`. No external CSS file.
- Admin variant: `uftr-footer--admin` hides the full top section, keeps role strip + bottom bar.
- Role strip (logged-in only): "Signed in as" + role badge (student/instructor/admin colors, icon per
  role) + quick links per role (student: Dashboard/My Learning/Certificates/Grades; instructor:
  Dashboard/My Courses/Analytics/Earnings; admin: Dashboard/Users/Courses/Applications/Bug Reports).
- Top grid: brand (logo `/assets/images/edulari-logo.png`, tagline "Empowering learners worldwide
  with world-class online education.", 5 social icons all `href="#"` — Twitter/X, LinkedIn, YouTube,
  Instagram, GitHub) + 4 link columns: **Learn** (Browse Courses, Top Rated `?sort=rating`, Free
  Courses `?price=free`, About Us `/page/about`, Verify Certificate), **Teach** (Become an
  Instructor, Instructor Dashboard, Create a Course, Instructor Analytics), **Account** (role
  dependent; guest: Sign Up/Log In/Help Center), **Support** (Help Center, Contact Us, Report a Bug,
  Track Report).
- Bottom bar: `© {year} {SITE_NAME}. All rights reserved.` + "Made with ♥ for curious learners
  everywhere." + right links: Privacy Policy, Terms of Service, Cookie Policy (all `#`), Contact.
- Responsive: 1200 (240px brand col), 1024 (3-col links), 768 (stack, 2-col links), 480 (tighter),
  360 (1-col links, column legal links).

## Site banners (`public/partials/site-banners.php` + `private/banner-templates/*`)

- `getActiveBannersForRole($role)` (role: `guest` when not logged in) filters `private/data/banners.json`
  by `active`, audience membership, `schedule.start_at`/`end_at` window vs `time()`, sorted by
  `priority` desc. File-backed with `flock`, temp-rename writes, `logBannerEvent` to
  `LOG_PATH/banners.log`. **Next port: move to `site_banners` table; keep identical fields**
  (id `bnr_*`, version, template/type/title/message/audience/cta{text,link}/schedule/resurface_after_days/
  active/priority/created_at/updated_at/created_by/updated_by).
- Shell: `.sbn-shell` fixed top, `z-index 997`, `padding 10px 20px`, Inter 13.5px, shadow, flex row;
  CTA pill button per type color; close `×`; inline `<style>` with types info/warning/success/promo.
- Layout engine (inline script): 3 states `expanded | partial | collapsed`. Down-scroll past
  `COLLAPSE_AT=24` → collapsed (banners tuck behind 64px navbar, `PEEK=7`px slivers,
  `pointer-events:none`, `z-index 997-i`); scrolling up → partial (banner 0 visible/clickable, rest
  peek); scrolling up to `y <= TOP_AT=8` → expanded (full stack, everything clickable).
  `document.body.style.paddingTop` compensates. Banner height read via `getBoundingClientRect()`,
  nav height from CSS var `--unav-h` (64 fallback). Starts collapsed if loaded scrolled down.
- Dismissal: `localStorage['sbn_dismissed_'+id] = {version, dismissedAt}`; hidden while stored
  version === current version, unless `resurface_after_days` elapsed ≥ N days.
- Templates: `simple-text` (title + message spans), `icon-message` (per-type glyph in colored circle
  + title/message), `seasonal-promo` (per-type badge "Info/Notice/Offer/Sale!" + title/message).
- Admin maintenance banner (`partials/admin-maintenance-banner.php`): sticky bar just below navbar
  (`top:var(--unav-h,64px)`, `z-index:998`, `#f59e0b` bg, `#1e1e2e` text), shown only when
  `getMaintenanceStatus()` non-null; lists blocked scopes (Student/Instructor) and optional
  `Auto-disabling at HH:MM` from `auto_disable_at`; link to `/admin/settings`. Included from
  `navbar.php` only for admins on `/admin/**`.

## Maintenance page (`partials/maintenance-page.php`)

- 404-guard via `MAINTENANCE_PAGE_RENDER` constant (direct hits return 404 "Not Found").
- Full standalone HTML doc: Inter, dark gradient bg, centered card, wrench icon in red circle,
  "We'll be right back", description with `SITE_NAME`, pulsing red dot + "Maintenance in progress".
- Next port: DB-driven (`getMaintenanceStatus()` → middleware/proxy check with admin bypass),
  render same markup.

## File viewer (`partials/file_viewer.php`)

- `edulariFileViewer($lessonId, $fileName, $title)` emits `.lfv` toolbar (filename + Download link
  `.lp-btn--outline.lp-btn--sm` → `/media?type=lesson_pdf&id={lessonId}`), then per-extension preview
  (see Third-party scripts). Inline `<style>` (first call only, static `$cssDone`). Unsupported
  extensions get "Preview is not available" note.

## Video player (`partials/video_player.php`)

- `edulariVideoPlayer($videoUrl,$title,$assetBase='../assets')` includes
  `assets/css/video-player.css` + deferred `assets/js/video-player.js` once, parses YouTube/Vimeo IDs,
  renders `#evp-{md5}` container + inline init script with CSP nonce, or a Vimeo iframe
  (`allow="autoplay; fullscreen; picture-in-picture"`, lazy, 16:9). Direct (non-YouTube/Vimeo) URLs
  init `EdulariVideoPlayer` with `{src,logo}`.

## JSON-LD

Present in: `public/index.php`, `public/page/about.php`, `public/browse-courses.php`,
`public/categories.php`, `public/course.php`, `public/contact.php`, `public/help-center.php`,
`public/instructor-profile.php`. Not in `head.php`.

## Open questions

- Exact breakpoint where the navbar's "tablet clip fix" should trigger (driven by `>768px` JS +
  `min-width:1025px` CSS paddings) — reproduce both.
- `window.innerWidth > 768` JS vs CSS `max-width:768px` — the 768 boundary is the mobile toggle;
  confirm identical behavior in the React port.
- Which FA classes are actually used on the four FA pages (only counts seen; classes enumerated per
  page in Phase 2).
- Whether `site.webmanifest` (static) should move to `app/manifest.ts` while keeping the same URL.
- The inline `script nonce=CSP_NONCE` pattern means Next.js must emit a per-request nonce; confirm
  middleware support and add to port plan.
- Banner admin: banner mutations live in `private/functions/banners.php` writing a JSON file;
  Next version needs `site_banners` table + admin UI parity — scope for a later phase.
