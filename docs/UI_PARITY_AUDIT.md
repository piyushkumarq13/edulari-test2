# UI parity report

Phase 4 + 5 UI parity fix. Findings are from source comparison plus live DOM inspection of
the Next app; the numeric old-vs-new comparison is **not** in this report because the
machine has no PHP and no MySQL/MariaDB (see section 2).

## 1. How this was measured

| Check | Command | Needs the old site running? |
|---|---|---|
| Per-page stylesheet list + order, old vs new | `npm run php-stylesheet-order` | no |
| Which loaded sheets actually match the markup | `npm run css-usage` | no |
| Does stylesheet order matter at all (selector overlap) | `npm run css-conflicts` | no |
| Which templates render navbar/footer | `npm run php-chrome-map` | no |
| Class/id coverage per template | `npm run parity-check` | no |
| Computed styles, geometry, fonts, screenshots | `npm run ui-compare` | **yes** |
| Same, new site only | `npm run ui-compare -- --site new` | no |

`npm run php-stylesheet-order` now reports `[ok]` for all 26 in-scope templates. The one
exception, `check-payment-status`, is listed as `n/a` on purpose: in the PHP it is a JSON
endpoint (`student/check-payment-status.php`), not a page, and it is ported to
`POST /api/student/check-payment-status` - verified by the Phase 5 live smoke test rather
than by a page comparison.

## 2. Blocker: the old site cannot be run on this machine

- `php -v` - not on PATH
- `C:\xampp\php\php.exe`, `C:\php\php.exe`, `C:\wamp64\bin\php`, `C:\laragon\bin\php` - none exist
- `mysql --version` - not on PATH; no `mysql`/`mariadb` Windows service; no
  `C:\xampp\mysql\bin\mysql.exe`

**To unblock:** install XAMPP, start Apache + MySQL, copy the old site to
`C:\Users\piyus\Desktop\htdocs (7)\_oldsite_run`, point the copy at a local
`edulari_local` database built from `docs/schema/mysql_schema.txt`, neutralise its SMTP
and Razorpay settings, then serve it with
`C:\xampp\php\php.exe -S 127.0.0.1:8080 -t <copy>\public scripts\ui-compare\php-router.php`.
Full instructions, including the MySQL mirror of the demo data, are in
`docs\UI_COMPARE.md` sections 2 and 4. `scripts/ui-compare/php-router.php` is written and
replicates the `.htaccess` clean-URL rewrites that PHP's built-in server does not read.

Until then, the numbers below are structural + live-DOM facts about the new app, not a
measured old-vs-new delta. **No claim of pixel parity is made here.**

## 3. Root causes found and fixed

### 3.1 All 9 auth pages rendered a navbar and footer the PHP does not have

`npm run php-chrome-map` showed the old templates split three ways:

- navbar + footer: 17 templates
- footer only: `verify-certificate.php`
- **no chrome at all: all 9 auth pages**, `receipt.php`, `logout.php`, `demo.php`

The port rendered `SiteBanners` + `SiteNavbar` + `SiteFooter` from the root layout for
every route, so login, register, register-success, account-activation, verify-email,
forgot-password, reset-password, password-reset-after-verify, receipt and logout each
gained a 64px fixed navbar and a full footer the old pages never had.

Fix: root layout now renders chrome nowhere; `app/(site)/layout.tsx` renders
banners + navbar + `navbar.css` + footer, `app/(foot)/layout.tsx` renders footer only, and
the 9 auth pages plus receipt and logout stay at the app root. 17 page directories were
moved into `app/(site)/` and `verify-certificate` into `app/(foot)/`. All 73 route paths
are unchanged (route groups do not appear in URLs).

### 3.2 `navbar.css` was loaded globally, so `body { padding-top: 64px }` hit chrome-less pages

`navbar.css` declares a global `body { padding-top: var(--unav-h) }`. Imported from the
root layout it applied to every page, including the 11 that must have no navbar.

Fix: `navbar.css` is imported only by `app/(site)/layout.tsx`, so it reaches exactly the
17 templates that include `navbar.php`.

### 3.3 `next/font` was overriding the `--font-primary` that `base.css` defines

`base.css` is 11 lines and declares its own stack in `:root`:
`--font-primary: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
`app/layout.tsx` used `next/font/google` with `variable: "--font-primary"`, which replaced
that `:root` value with a self-hosted `__Inter_xxxx, __Inter_Fallback_xxxx` stack and
changed the computed `font-family` on every element in the app. The old site loads Inter
from Google Fonts, self-hosting nothing.

Fix: `next/font` removed. `app/layout.tsx` now emits the five link tags from
`head.php` verbatim (both preconnects, the `preload as=style`, the `media="print"`
`onload="this.media='all'"` swap, and the `<noscript>` fallback) through a `<head>` block.
The swap is raw markup rather than a React `onLoad` so it works before hydration, exactly
as in the PHP.

Verified live through the collector in `ui-compare`: the computed `font-family` in use is
now `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

### 3.4 All 8 auth pages imported no CSS at all

`npm run css-usage` showed the pages load stylesheets that supply a lot of matching rules,
none of which were imported:

| page | stylesheet | matching rules |
|---|---|---|
| login | `auth/login.css`, `auth/oauth.css` | 75, 11 |
| register | `auth/register.css`, `auth/oauth.css` | 74, 11 |
| password-reset-after-verify | `auth/password-reset-after-verify.css` | 91 |
| reset-password | `auth/reset-password.css` | 63 |
| forgot-password | `auth/forgot-password.css` | 57 |
| verify-email | `auth/verify-email.css` | 48 |
| register-success | `auth/register-success.css` | 43 |
| account-activation | `auth/account-activation.css` | 42 |

All eight files already existed in `styles/css/auth/` and are byte-identical to the old
site (SHA256 verified for login/oauth/register). The imports were simply missing.

### 3.5 `student/dashboard.css` missing from browse-courses and categories

`browse-courses.php` and `categories.php` both load it, and it contributes 8 and 7
matching rules respectively (the shared hero/banner and button spacing). Not imported.
Added to both pages, before their own stylesheet, matching the PHP order.

### 3.6 `browse-courses.css` missing from the course page

`course.php` loads `browse-courses.css` before `course.css`; it contributes 8 matching
rules there (the shared breadcrumb and filter-chip helpers the course page reuses).
Added.

### 3.7 The course page's 2634-character inline `<style>` was not ported

`course.php` writes a block in `<head>` after the stylesheet links, containing the
override that moves the page from a sidebar offset to the navbar layout:
`body { padding-left: 0 !important }`, `.cp-page-wrap { padding-top: 64px }`,
`.cp-alert` margins, `.cp-hero { margin-top: 0 }`, the `.cp-layout` max-width/padding
block, the whole `.cp-breadcrumb-bar` block, and two responsive breakpoints (960px,
640px). Omitting it left the course page on the sidebar geometry.

Ported verbatim to `app/(site)/course/[slug]/course-page-styles.ts` and injected at the
same cascade position. The `!important` there is the old site's own, kept deliberately.

### 3.8 `register-success.php`'s two inline `<style>` blocks were not ported

`.btn-login` (715 chars) and `.btn-check-status` / `.btn-resend` (1132 chars) are
page-local rules no other stylesheet provides. Both now in the page, verbatim.

### 3.9 The receipt hid the navbar with a CSS override instead of not rendering it

`app/student/receipt/page.tsx` contained
`.unav, .uftr-footer, .sbn-shell, .unav-drawer { display: none !important }` - a patch
hiding chrome that the root layout was adding. `receipt.php` includes neither
`navbar.php` nor `footer.php`, so the correct fix was structural, and with 3.1/3.2 the
page simply never loads them. The override is deleted.

### 3.10 The receipt was missing its display font

`receipt.php` loads
`Inter:wght@300..800` **plus** `Plus+Jakarta+Sans:wght@600;700;800`, and
`styles/css/student/receipt.css` uses `--font-display: 'Plus Jakarta Sans', 'Inter', ...`
for the invoice title, the "Bill To" heading and the footer (lines 149/240/328/334).
Plus Jakarta Sans was never loaded, so those headings silently fell back to Inter. The
page now emits the receipt font URL from `head.php` lines 39-41.

### 3.11 `price.toFixed is not a function` crashed four pages

Found by live probing, not by the comparison tool. `courses.price` is `numeric(10,2)`,
which postgres.js returns as a **string**; `app/(site)/course/[slug]/page.tsx` called
`.toFixed(2)` on it for the JSON-LD `offers.price`. `/course/[slug]`,
`/instructor-profile/[slug]`, `/security` and `/updates` all returned the Next error shell.
Fixed with `toNumber()` from `lib/payments/amounts`. All four now render.

### 3.12 `theme-color` was emitted but head.php has no such meta

`app/layout.tsx` declared `themeColor: "#ffffff"`. `head.php` emits no
`<meta name="theme-color">`. Removed.

## 4. Investigated and deliberately NOT changed

### 4.1 Stylesheet order turns out not to matter - measured, not assumed

`navbar.php` emits its `<link>` from **inside `<body>`**, so `navbar.css` is always the
last stylesheet the browser applies, while the port loads it from a layout before the
page's own CSS. Before restructuring, `npm run css-conflicts` was run to find out whether
that reordering changes anything.

It does not. The only overlaps between `navbar.css` and any other stylesheet are:

- the global `body { padding-top }` rule, and
- `from` / `to` keyframe steps (`[opacity, transform]`) - identical selector strings in
  different `@keyframes` blocks, which never interact.

No class or id is styled by both `navbar.css` and a page stylesheet. So the ordering
difference has **zero** visual effect, and no ordering workaround was added. The fix that
did matter was 3.2: not loading `navbar.css` at all on the chrome-less pages.

### 4.2 `DM Mono` and `JetBrains Mono` are declared but never loaded upstream

`about.css`, `contact.css`, `track-contact.css`, `track-report.css`, `categories.css`
declare `font-family: 'DM Mono', monospace`; `student/purchase-history.css` and
`student/receipt.css` declare `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`.
No PHP file loads any of them, and `head.php` only loads Inter. Both sites therefore
render those elements in the generic `monospace` fallback. The collector confirms the new
site's computed stack is `DM Mono, monospace` - identical behaviour, no fix needed.

### 4.3 The per-page stylesheet files are the original files

All 69 stylesheets in `styles/css/` are byte-identical to `public/assets/css/**` in the old
site (spot-verified by SHA256 for `auth/login.css`, `auth/oauth.css`, `auth/register.css`).
No CSS was edited, converted or re-scoped. Class names are unchanged.

### 4.4 No `next/image` anywhere

Confirmed by scanning `app/` and `components/`: every image is a plain `<img>` with the
same attributes the PHP uses, so no next/image wrapper is changing width/height/object-fit
on any page.

### 4.5 Instructor profile is structurally different, and that is a known gap

`instructor-profile.php` renders a two-column `.ip-body` grid with a sidebar and a JS tab
toggle that adds `.sidebar-hidden`, plus a 59-character inline
`.ip-body.sidebar-hidden { grid-template-columns: 1fr; }`. The port renders `.ip-page` +
`.ip-hero` and has no `.ip-body` or sidebar toggle at all. This is a real, unresolved
structural difference, not a CSS-import problem. It is recorded here rather than hidden.
It needs a markup re-port, which is larger than this fix pass.

## 5. Differences left, and why

| difference | reason |
|---|---|
| `initial-scale=1.0` (PHP) vs `initial-scale=1` (Next) | Next normalises the viewport meta. Identical parse; cannot be overridden without emitting a duplicate meta. |
| Next injects its own `<script>`/CSS-chunk `<link>` tags | Framework output. The CSS **files** applied are identical, which is what `php-stylesheet-order` verifies. |
| Client components paint after hydration on `/cart`, `/wishlist`, `/checkout`, `/student/purchase-history` | Next 16 with Cache Components renders these on the client. Identical to how Phase 4's pages already behaved; the comparator waits for `networkidle` + `document.fonts.ready` so both sides are measured settled. |
| `instructor-profile` sidebar layout missing | Unresolved structural gap, section 4.5. |
| Order IDs, payment IDs, timestamps, review counts, `[data-count]` counters | Data/time derived. Masked to an empty string on both sides by `MASK_SELECTORS`. |

## 6. What the user must run

To get the numeric comparison in this report (section 2 explains why it is missing):

1. Install XAMPP; start Apache and MySQL.
2. Copy the old site to `C:\Users\piyus\Desktop\htdocs (7)\_oldsite_run` and point that
   copy at a local `edulari_local` database; neutralise its SMTP and Razorpay settings.
   Never point the copy at production.
3. Serve it on 8080 with `scripts\ui-compare\php-router.php`.
4. `npm run seed:content -- --dump-sql scripts\ui-compare\seed-mysql.sql`, then import that
   file into `edulari_local`.
5. `Copy-Item scripts\ui-compare\.env.compare.example scripts\ui-compare\.env.compare`,
   fill in the student login, `INSTRUCTOR_SLUG` and `ORDER_ID`.
6. `npm run build && npm start`, then `npm run ui-compare`.
7. Fix what `docs\UI_PARITY_REPORT.md` lists, and re-run until it is clean.

`docs\UI_PARITY_REPORT.md` is regenerated by the tool, so the findings in sections 3-5 of
this file will be replaced by the measured report on the first full run. The structural
checks in section 1 remain valid in the meantime.
