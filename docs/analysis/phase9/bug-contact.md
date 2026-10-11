# Phase 9 — Bug Reports & Contact Submissions (admin) — Reverse-Engineering Spec

Read-only source of truth (OLD PHP site): `C:\Users\piyus\Desktop\htdocs (7)\htdocs`
New project: `C:\Users\piyus\Desktop\htdocs (7)\Edulari`

Files analysed fully:

- `public/admin/bug-reports.php` (267 lines)
- `public/admin/bug-report-detail.php` (477 lines)
- `public/admin/contact-submissions.php` (292 lines)
- `public/admin/contact-submission-detail.php` (507 lines)
- `public/assets/css/admin/bug-reports.css` (196 lines)
- `public/assets/css/admin/bug-report-detail.css` (196 lines)
- `public/assets/css/admin/contact-submissions.css` (450 lines)
- `public/assets/css/admin/contact-submission-detail.css` (587 lines)
- `private/email/email_templates.php` (buildBugStatusEmailSubject/Html/Text, buildContactReplyHtml/Text, contact helpers, shared shell helpers)
- `private/email/email_senders.php` (sendContactReplyEmail)
- `db/migrations/008_contact_bug_notifications.sql`
- Supporting: `public/report-bug.php` (attachment write path), `public/partials/head.php`, `public/navbar.php`, `.htaccess`, `public/.htaccess`

Language of the spec: plain text/markdown. No application code is produced here.

---

## 0. Global facts that all four pages share

### 0.1 Guards / bootstrap

- All four pages start with:
  `require_once '../../private/bootstrap.php';` then `config.php`, `db.php`, `auth.php`, `functions/admin.php`.
- Detail pages additionally require email files:
  - bug report detail: `private/email/mailer.php` + `private/email/email_templates.php`
  - contact detail: `private/email/email_senders.php` (which itself pulls templates + mailer).
- Guard: `requireRole(ROLE_ADMIN);` at the very top of every page, before any data is read.
- `$user = getCurrentUser();` (contact detail names it `$adminUser`).
- `$activeNav` drives the admin navbar active state: `'bug-reports'` (both bug pages), `'contact-submissions'` (both contact pages).

### 0.2 URLs (old) and clean URLs

The site strips `.php` (301) and internally serves `x.php` for `x`. Therefore:

| Old file | Clean URL |
|---|---|
| `public/admin/bug-reports.php` | `/admin/bug-reports` |
| `public/admin/bug-report-detail.php?id=N` | `/admin/bug-report-detail?id=N` |
| `public/admin/contact-submissions.php` | `/admin/contact-submissions` |
| `public/admin/contact-submission-detail.php?id=N` | `/admin/contact-submission-detail?id=N` |

New Next.js routes (App Router, Node runtime, admin-guarded):
`app/(admin)/admin/bug-reports/page.tsx`, `.../bug-report-detail/page.tsx`, `.../contact-submissions/page.tsx`, `.../contact-submission-detail/page.tsx`.
The internal links inside the PHP pages use `bug-report-detail.php?id=` etc.; after port these must resolve to the clean URLs (`/admin/bug-report-detail?id=`) and mutate state through server actions/route handlers, not `.php` links.

### 0.3 Metadata (per page)

- `<html lang="en">`
- `$pageTitle` set per page (below). `<title>` = exact string (escaped).
- `$pageRobots = 'noindex, nofollow';` explicitly on all four.
- No `$pageDescription`, `$pageKeywords`, `$pageCanonical`, OG/Twitter overrides → head.php falls back to title/defaults. Since these are admin/noindex pages, the fallbacks are irrelevant but must not error.
- Open Graph / Twitter meta tags are still emitted by head.php using title + defaults (og:image default `SITE_URL . '/assets/images/og-cover.jpg'`).

### 0.4 Shared `<head>` (partials/head.php)

Every page includes `__DIR__ . '/../partials/head.php'` inside `<head>`. It emits, in order:

1. `<meta charset="UTF-8">`, viewport.
2. `<title>`.
3. `<meta name="robots" content="...">`.
4. OG + Twitter meta block (defaults from title).
5. Google Fonts for Inter (weights 300–800): preconnect to fonts.googleapis.com / fonts.gstatic.com, a `preload as=style`, a stylesheet `media="print" onload="this.media='all'"`, and a `<noscript>` fallback.
6. Favicons + `site.webmanifest`.
7. `<link rel="stylesheet" href="/assets/css/base.css">`.
8. The page `$extraCss` links, one per line, in the array order.

`$extraCss` per page (cascade order matters — must be preserved exactly):

- bug-reports list: `../assets/css/navbar.css`, `../assets/css/admin/dashboard.css`, `../assets/css/admin/bug-reports.css`
- bug-report detail: `../assets/css/navbar.css`, `../assets/css/admin/dashboard.css`, `../assets/css/admin/bug-report-detail.css`
- contact-submissions list: `../assets/css/navbar.css`, `../assets/css/admin/dashboard.css`, `../assets/css/admin/contact-submissions.css`
- contact-submission detail: `../assets/css/navbar.css`, `../assets/css/admin/dashboard.css`, `../assets/css/admin/contact-submission-detail.css`

So global order is: `base.css` → `navbar.css` → `admin/dashboard.css` → page CSS. `dashboard.css` supplies the shared `addash-btn` / `addash-btn--primary|secondary|danger` classes used by these pages — it MUST be loaded before the page CSS.

### 0.5 Chrome

All four pages `include __DIR__ . '/../navbar.php';` right after `<body>` and `include __DIR__ . '/../footer.php';` before `</body>`. Therefore `navbar.css` may be loaded (per AGENTS section 14 rules) and the global `body { padding-top }` from navbar.css applies. Admin navbar shows Bug Reports / Contact Inbox entries.

### 0.6 Font-load inline script — IMPORTANT dead code

Every page ends with an inline script attempting to flip a deferred font stylesheet to `media='all'`:

- bug-reports list: `<script nonce="CSP_NONCE">document.getElementById('fontLoad_1')?.addEventListener('load',function(){this.media='all';});</script>`
- contact-submissions list, both detail pages: `document.getElementById('fontStylesheet')?.addEventListener('load', function () { this.media = 'all'; });`

`head.php` never emits an element with `id="fontStylesheet"` or `id="fontLoad_1"`, so these handlers never attach — they are no-ops. Port behaviour: keep a no-op equivalent (or omit; behaviourally identical). Do NOT add ids that don't exist. `?` optional chaining is used; script is nonce-gated with `CSP_NONCE`.

### 0.7 Timezone / dates

- Display dates use PHP `date()` with the process default timezone (set by `bootstrap.php`/config). The bug pages append the literal string `UTC` to some timestamps (see below) even though `date()` does not convert; this is cosmetic in the source and must be reproduced literally.
- `reporter_ip` / `sender_ip` come from `$_SERVER['REMOTE_ADDR']` (set at submit time on the public pages, not here).

### 0.8 Column facts from migration `008_contact_bug_notifications.sql`

`public.bug_reports`:

| column | type | notes |
|---|---|---|
| id | bigint identity PK | |
| reference | varchar(20) UNIQUE | e.g. `BUG-XXXXXX` |
| reporter_name | varchar(120) | |
| reporter_email | varchar(255) | |
| reporter_role | varchar(30) default 'Guest' | |
| reporter_ip | varchar(45) default '' | |
| issue_type | varchar(30) default 'bug' | |
| page_url | varchar(500) default '' | |
| subject | varchar(255) | |
| description | text | |
| steps | text NULL | |
| expected | text NULL | |
| severity | smallint default 3 | 1..5 |
| severity_label | varchar(20) default 'Moderate' | Low/Minor/Moderate/High/Critical |
| browser | varchar(200) default '' | |
| attachment | varchar(260) NULL | stored random filename |
| status | text CHECK in (open,in_progress,resolved,wont_fix,duplicate) default 'open' | |
| admin_notes | text NULL | |
| resolved_at | timestamptz NULL | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | trigger `trg_bug_reports_updated` |

`public.contact_submissions`:

| column | type | notes |
|---|---|---|
| id | bigint identity PK | |
| ticket_ref | varchar(20) UNIQUE | |
| user_id | bigint NULL REFERENCES users ON DELETE SET NULL | |
| sender_name | varchar(100) | |
| sender_email | varchar(200) | |
| sender_role | varchar(50) default 'Guest' | |
| category | varchar(50) | |
| priority | text CHECK in (low,normal,high,urgent) default 'normal' | |
| subject | varchar(200) | |
| message | text | |
| order_ref | varchar(100) NULL | |
| course_ref | varchar(200) NULL | |
| sender_ip | varchar(45) | |
| status | text CHECK in (open,in_progress,waiting,resolved,closed) default 'open' | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | trigger `trg_contact_submissions_updated` |

`public.contact_replies`:

| column | type | notes |
|---|---|---|
| id | bigint identity PK | |
| submission_id | bigint NOT NULL REFERENCES contact_submissions ON DELETE CASCADE | |
| admin_id | bigint NOT NULL | |
| reply_message | text | |
| reply_type | text CHECK in (public,internal) default 'public' | |
| resolution_status | varchar(50) NULL | |
| created_at | timestamptz default now() | |

RLS is enabled on all three tables with REVOKE from `anon`/`authenticated`. All access is server-side only.

`updated_at` note: both `bug_reports` and `contact_submissions` carry a `set_updated_at()` BEFORE UPDATE trigger, BUT the PHP code also sets `updated_at` explicitly in its UPDATE statements (bug detail sets `updated_at = date('Y-m-d H:i:s')`, contact uses `updated_at = NOW()`). The new port must match the PHP's explicit values; the trigger must not override them into a different value. Reconcile during implementation (trigger order may clamp updated_at to the statement time — document the decision so list ordering/detail "Last Updated" matches).

### 0.9 MySQL→Postgres ordering translation (critical)

The list pages depend on MySQL `FIELD()` ordering. Postgres has no `FIELD`; port to `CASE`:

- bug reports ORDER BY:
  `CASE severity_label WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Moderate' THEN 3 WHEN 'Minor' THEN 4 WHEN 'Low' THEN 5 ELSE 6 END,`
  `CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 WHEN 'wont_fix' THEN 4 WHEN 'duplicate' THEN 5 ELSE 6 END,`
  `created_at DESC`
- contact submissions ORDER BY (`open`,`waiting`,`in_progress`) — note this list order differs from the tab order:
  `CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,`
  `CASE status WHEN 'open' THEN 1 WHEN 'waiting' THEN 2 WHEN 'in_progress' THEN 3 WHEN 'resolved' THEN 4 WHEN 'closed' THEN 5 ELSE 6 END,`
  `created_at DESC`

Bug list aggregation (COUNT per status, critical open, total) and contact list (COUNT, reply-count subquery, tabs, urgent-open) are separate queries; run them in parallel with `Promise.all` in the new port.

---

## 1. Page: Bug Reports List — `bug-reports.php`

### 1.1 Purpose / guard / meta

- Purpose: browse, filter, search and open bug reports. Read-only list; all mutation happens on the detail page.
- Guard: `requireRole(ROLE_ADMIN)`.
- `$activeNav = 'bug-reports'`.
- Title: `Bug Reports – Admin | ` + `SITE_NAME` (note the en-dash `–`).
- Robots: `noindex, nofollow`.

### 1.2 Inputs / filters

GET params (all optional):

- `status` default `'all'`; whitelist `['all','open','in_progress','resolved','wont_fix','duplicate']`; invalid → `'all'`.
- `severity` default `'all'`; whitelist `['all','Low','Minor','Moderate','High','Critical']`; invalid → `'all'`. (Values are the human labels, matched against `severity_label`.)
- `type` default `'all'`; whitelist `['all','bug','ui','performance','feature','content','other']`; invalid → `'all'`.
- `search` `trim($_GET['search'] ?? '')`.

WHERE build (starts `1=1`):

- `status != all` → `AND status = ?`
- `severity != all` → `AND severity_label = ?`
- `type != all` → `AND issue_type = ?`
- `search != ''` → `AND (reference LIKE ? OR subject LIKE ? OR reporter_name LIKE ? OR reporter_email LIKE ?)` with `%search%` for all four (parameterized).

Main query columns: `id, reference, reporter_name, reporter_email, reporter_role, issue_type, subject, severity_label, status, created_at`.
(`reporter_role` is selected but not shown in the table.)

### 1.3 Stats / counts

- `$counts[$s]` = `SELECT COUNT(*) FROM bug_reports WHERE status = ?` for each of open, in_progress, resolved, wont_fix, duplicate.
- `$counts['all']` = sum of those five (NOT a COUNT of the table; reports with other statuses don't exist due to CHECK, so equivalent).
- `$criticalOpen` = `COUNT(*) WHERE status='open' AND severity_label='Critical'`.

### 1.4 Static label maps

`$typeLabels` (used in filter select + table type/subject cells):

| key | label |
|---|---|
| bug | `🐛 Bug` |
| ui | `🎨 UI` |
| performance | `⚡ Perf` |
| feature | `💡 Feature` |
| content | `📝 Content` |
| other | `❓ Other` |

`$statusLabels` (used for badges/emoji):

| key | label | icon |
|---|---|---|
| open | Open | 🟡 |
| in_progress | In Progress | 🔵 |
| resolved | Resolved | ✅ |
| wont_fix | Won't Fix | ⛔ |
| duplicate | Duplicate | 🔁 |

### 1.5 DOM structure (exact classes/ids/text)

Root: `<div class="abr-page">`.

1. Header `.abr-page-header`:
   - left `<div>`: `<h1 class="abr-page-title">🐛 Bug Reports</h1>`, `<p class="abr-page-sub">Review and manage all submitted bug reports and issues.</p>`.
   - right `.abr-header-actions`: `<a href="/report-bug" class="addash-btn addash-btn--secondary" target="_blank">` containing an external-link SVG + text `View Report Page`.
2. Stats `.abr-stats` — five `.abr-stat` blocks, each: `.abr-stat-icon` (inline `style` background/color) + wrapper div with `.abr-stat-label` and `.abr-stat-value`.
   - Open — icon 🟡, style `background:#fef9c3;color:#854d0e;` → `$counts['open']`
   - In Progress — 🔵, `background:#ede9fe;color:#5b21b6;` → `$counts['in_progress']`
   - Resolved — ✅, `background:#dcfce7;color:#15803d;` → `$counts['resolved']`
   - Critical Open — 🚨, `background:#fee2e2;color:#991b1b;` → `$criticalOpen`
   - Total — 📋, `background:#f1f5f9;color:#374151;` → `$counts['all']`
3. Tabs `.abr-tabs` — `.abr-tab` anchors (`.abr-tab.active` for current). Each has label text + `<span class="abr-tab-count">`.
   - Tabs order: `all`=`All`; `open`=`🟡 Open`; `in_progress`=`🔵 In Progress`; `resolved`=`✅ Resolved`; `wont_fix`=`⛔ Won't Fix`; `duplicate`=`🔁 Duplicate`.
   - Tab URL: `?` + `http_build_query(array_filter([status=>s, severity=>(filter if not all), type=>(filter if not all), search=>(search)]))` — i.e. keeps severity/type/search, drops empty values. Count shown = `$counts[$s] ?? $counts['all']`.
4. Filters `<form method="GET" class="abr-filters">`:
   - `<input type="hidden" name="status" value="<current status>">`
   - `.abr-search-wrap` containing `.abr-search-icon` (search SVG) and `<input type="text" name="search" class="abr-search-input" placeholder="Search by ref, subject, name or email…" value="<search>">`
   - `<select name="severity" class="abr-select">` with `<option value="all">All Severities</option>` + one option per `Critical,High,Moderate,Minor,Low`, `selected` on match.
   - `<select name="type" class="abr-select">` with `All Types` + `$typeLabels` options (`value` = key, label = emoji label), `selected` on match.
   - `<button type="submit" class="abr-filter-btn">` with funnel SVG + `Filter`.
   - If `search || severity != all || type != all`: `<a href="?status=<status>" class="addash-btn addash-btn--secondary">Clear</a>`.
5. Table card `.abr-table-card`:
   - Empty (`$reports` empty): `.abr-empty` with `<span class="abr-empty-icon">🎉</span>`, `<h3>No reports found</h3>`, `<p>No bug reports match your current filters.</p>`.
   - Else `.abr-table-wrap` > `<table class="abr-table">`.
     - `<thead><tr>` headers exactly: `Reference`, `Subject`, `Reporter`, `Type`, `Severity`, `Status`, `Submitted`, `""` (empty th).
     - Each `<tr>`:
       - col1 `<span class="abr-ref">reference</span>`
       - col2 `.abr-subj` = `mb_strimwidth(subject,0,55,'…')` + `<small>` = type label
       - col3: `<div style="font-weight:600;font-size:.82rem">reporter_name</div>` + `<div class="abr-email">reporter_email</div>`
       - col4: type label
       - col5: `<span class="abr-badge abr-sev--<severity_label>">severity_label</span>`
       - col6: `<span class="abr-badge abr-badge--<status>">icon label</span>`
       - col7 `.abr-date` = `date('d M Y', strtotime(created_at))`
       - col8: `<a href="bug-report-detail.php?id=<id>" class="abr-view-btn">` with eye SVG + `Review`

No pagination on this list (all matching rows rendered).

### 1.6 CSS (`bug-reports.css`) — classes and behaviour

Prefix `abr-`. Page wrapper `max-width:1320px`. Stats grid `repeat(auto-fill,minmax(160px,1fr))`. Tabs are `#6c63ff` accent. Badge colour map:

- `.abr-badge--open` `#fef9c3/#854d0e/#fde68a`
- `.abr-badge--in_progress` `#ede9fe/#5b21b6/#c4b5fd`
- `.abr-badge--resolved` `#dcfce7/#15803d/#86efac`
- `.abr-badge--wont_fix` `#fee2e2/#991b1b/#fca5a5`
- `.abr-badge--duplicate` `#f3f4f6/#374151/#d1d5db`
- `.abr-sev--Low` and `.abr-sev--Minor` `#d1fae5/#065f46/#6ee7b7`
- `.abr-sev--Moderate` `#fef3c7/#92400e/#fcd34d`
- `.abr-sev--High` `#ffedd5/#9a3412/#fdba74`
- `.abr-sev--Critical` `#fee2e2/#991b1b/#fca5a5`

`.abr-flash` + `@keyframes abrFadeIn`, `.abr-flash.success`/`.error` exist in CSS but are unused on this page (no flash is rendered here).

Responsive `@media (max-width:768px)`: padding reduced, header column, stats 2 cols, columns 4 (Type) and 5 (Severity) hidden.

### 1.7 Inline script

Only the no-op font-load handler (see 0.6) — uses id `fontLoad_1`.

---

## 2. Page: Bug Report Detail — `bug-report-detail.php`

### 2.1 Purpose / guard / meta

- Purpose: view one bug report, change its status (with a note emailed to the reporter), open the attachment.
- Guard: `requireRole(ROLE_ADMIN)`; requires mailer + templates.
- `$activeNav = 'bug-reports'`.
- Title: `Bug Report <reference> – Admin | <SITE_NAME>` (`htmlspecialchars($report['reference'])`).
- Robots: `noindex, nofollow`.

### 2.2 Load + query

- `$id = (int)($_GET['id'] ?? 0);` if `!$id` → `header('Location: bug-reports.php'); exit;`
- `SELECT * FROM bug_reports WHERE id = ?`; if not found → redirect to `bug-reports.php`.
- Flash: if `$_GET['msg']` set, `$message = htmlspecialchars($_GET['msg'])`. (Note the source escapes on read and escapes AGAIN on output → double-encoded entities. Reproduce the visible result or intentionally de-duplicate; document in PROGRESS. Intended behaviour: show the plain message once.)

### 2.3 POST actions (exact field names, messages, redirects)

Method check: `$_SERVER['REQUEST_METHOD'] === 'POST'`.

CSRF: `verifyCSRFToken($_POST['csrf_token'] ?? '')`. On failure:
`$message = 'Invalid security token. Please refresh and try again.'; $msgType = 'error';`

Fields read:
- `$_POST['action']` (string)
- `$_POST['admin_notes']` = `trim(...)` (hidden input, injected from the shared textarea by JS)
- `$_POST['csrf_token']`

Action whitelist: `['resolve','in_progress','reopen','wont_fix','duplicate']`; otherwise `$message='Unknown action.'; $msgType='error';` (no redirect; re-renders page).

Action → status map:

| POST `action` | new `status` |
|---|---|
| resolve | resolved |
| in_progress | in_progress |
| reopen | open |
| wont_fix | wont_fix |
| duplicate | duplicate |

UPDATE (parameterized):

```
UPDATE bug_reports
SET status = ?, admin_notes = ?, updated_at = ?
[ , resolved_at = ? ]         -- see rules
WHERE id = ?
```

- `updated_at` = `date('Y-m-d H:i:s')` (server local time; stored text timestamp).
- `admin_notes` is ALWAYS overwritten with the posted note (may be empty → empty string; column is `text NULL`, so an empty string is written, not NULL).
- `resolved_at`:
  - when new status is `resolved`: set to `date('Y-m-d H:i:s')`.
  - when the REPORT WAS `resolved` and new status is anything else (i.e. reopening/changing away): set to `NULL`.
  - all other transitions: leave `resolved_at` untouched.
- If `dbExecute(...)` returns `false` (failure): `$message='Failed to update the report. Please try again.'; $msgType='error';` (no redirect).

On success:
1. Reload `$report = SELECT * FROM bug_reports WHERE id = ?`.
2. Email the reporter (try/catch, failures logged via `error_log('[BugReport] Status email failed: ...')`, `$emailSent=false`):
   - `$mail = createMailer();`
   - `$mail->addAddress($report['reporter_email'], $report['reporter_name']);`
   - `$mail->isHTML(true);`
   - `$mail->Subject = buildBugStatusEmailSubject($newStatus, $report['subject'], $report['reference']);`
   - `$mail->Body = buildBugStatusEmailHtml($report['reporter_name'], $report['subject'], $report['reference'], $newStatus, $adminNotes);`
   - `$mail->AltBody = buildBugStatusEmailText(...same args...);`
   - `$mail->send(); $emailSent = true;`
3. Human message per new status (`$statusLabels`):

   | new status | message fragment |
   |---|---|
   | resolved | `Resolved` |
   | in_progress | `marked In Progress` |
   | open | `Reopened` |
   | wont_fix | `marked Won't Fix` |
   | duplicate | `marked as Duplicate` |

   `$message = "Report {$lbl} successfully." . ($emailSent ? ' Reporter notified by email.' : ' (Email notification failed — check logs.)');`
4. PRG: `$qs = http_build_query(array_merge($_GET, ['msg' => $message])); header("Location: ?$qs"); exit;`
   (Keeps existing GET params, e.g. `id`, and adds `msg`.)

### 2.4 Status / severity / type config (for rendering + email)

`$statusConfig` (icon/label/color/bg/border) — used for header badge and current-status block:

| status | label | icon | color | bg | border |
|---|---|---|---|---|---|
| open | Open | 🟡 | #854d0e | #fef9c3 | #fde68a |
| in_progress | In Progress | 🔵 | #5b21b6 | #ede9fe | #c4b5fd |
| resolved | Resolved | ✅ | #15803d | #dcfce7 | #86efac |
| wont_fix | Won't Fix | ⛔ | #991b1b | #fee2e2 | #fca5a5 |
| duplicate | Duplicate | 🔁 | #374151 | #f3f4f6 | #d1d5db |

`$severityColors`: Low/Minor `#065f46/#d1fae5/#6ee7b7`; Moderate `#92400e/#fef3c7/#fcd34d`; High `#9a3412/#ffedd5/#fdba74`; Critical `#991b1b/#fee2e2/#fca5a5`. Fallback Moderate.

`$typeLabels` (detail variant, longer than list): `bug`=`🐛 Bug/Error`, `ui`=`🎨 UI Problem`, `performance`=`⚡ Performance`, `feature`=`💡 Feature Request`, `content`=`📝 Wrong Content`, `other`=`❓ Other`.

### 2.5 Action-button visibility rules (sidebar)

Given current status `$s = $report['status']`:

- **Mark as Resolved** (`action=resolve`) shown when `$s !== 'resolved'`.
- **Mark as In Progress** (`action=in_progress`) shown when `$s` is `open` OR `wont_fix` OR `duplicate`.
- **Reopen** (`action=reopen`) shown when `$s !== 'open'`.
- **Won't Fix** (`action=wont_fix`) shown when `$s !== 'wont_fix'`; form has `class="js-confirm-action" data-msg="Mark as Won't Fix? Reporter will be notified."`.
- **Mark as Duplicate** (`action=duplicate`) shown when `$s !== 'duplicate'`; `class="js-confirm-action" data-msg="Mark as Duplicate? Reporter will be notified."`.

Every action form contains: `csrf_token` hidden, `action` hidden, `<input type="hidden" name="admin_notes" id="notes_<action>">` (empty). Resolve/in_progress/reopen forms use `class="js-inject-notes"` (no confirm).

Button CSS classes: `abrd-action-btn` + `abrd-btn--resolve` / `abrd-btn--progress` / `abrd-btn--reopen` / `abrd-btn--wontfix` / `abrd-btn--duplicate`.

Below buttons: `<p style="font-size:.72rem;color:#94a3b8;text-align:center;margin-top:.25rem">All actions send an email notification to the reporter.</p>`

### 2.6 DOM structure (exact classes/ids/text)

Root `<div class="abrd-page">`.

1. Back link `<a href="bug-reports.php" class="abrd-back">` chevron SVG + `Back to Bug Reports`.
2. Optional flash `.abrd-flash <success|error>`: class is `abrd-flash <?= $msgType ?>` (so `abrd-flash success` / `abrd-flash error`, matching CSS `.abrd-flash.success/.error`). Contains a success check SVG (when success) or an alert-circle SVG (otherwise) then the escaped message.
3. Header `.abrd-header`:
   - `.abrd-ref` = reference
   - `.abrd-title` = subject
   - `.abrd-badges`: three `.abrd-badge` spans with inline `background/color/border-color`:
     - status badge (`$sCfg` colours, `icon label`)
     - severity badge — `background:$sevCfg bg;color:$sevCfg color;border-color:$sevCfg border`, text `⚡ <severity_label>`
     - type badge — `background:#ede9fe;color:#5b21b6;border-color:#c4b5fd`, text = `$typeLabels[issue_type]`
4. Layout `.abrd-layout` (grid `1fr 320px`).
   - **Main `.abrd-main`**:
     - Card "Reporter Information": `.abrd-card` > `.abrd-card-head` (`.abrd-card-head-icon` style `background:#ede9fe;color:#6c63ff;` with 👤) + text `Reporter Information`; `.abrd-card-body` > `.abrd-grid` of `.abrd-detail-label`/`.abrd-detail-value` pairs:
       - `Full Name` → reporter_name
       - `Email` → mailto link (`style="color:#6c63ff;"`)
       - `Role` → reporter_role or `Guest` (via `?:`)
       - `Browser` → browser or `—`
       - `IP Address` → reporter_ip or `—`
       - `Page / URL` → page_url or `—`
       - `Submitted` → `date('d M Y, H:i', strtotime(created_at)) . ' UTC'` or `—`
       - `Last Updated` → same format for updated_at or `—`
       - `Resolved At` (conditional on resolved_at) → same format + ` UTC`
     - Card "Issue Details": head icon `background:#fef3c7;color:#92400e;` (📋) + text `Issue Details`; body:
       - `.abrd-text-label` `Description` + `.abrd-text-block` = description (escaped, `white-space:pre-wrap`)
       - if `steps` non-empty: `<div style="margin-top:1rem">` > label `Steps to Reproduce` + `.abrd-text-block`
       - if `expected` non-empty: same wrapper, label `Expected Behaviour`
       - if `attachment` non-empty: label `Attachment` + `<a href="/serve-attachment.php?file=<urlencode(attachment)>" target="_blank" style="display:inline-flex;align-items:center;gap:5px;font-size:.83rem;color:#6c63ff;font-weight:600;margin-top:4px;">` with paperclip SVG + attachment filename.
     - Card "Current Admin Note (sent to reporter)" (only if `admin_notes` non-empty): head icon `background:#d1fae5;color:#15803d;` (💬) + that exact title; body `.abrd-text-block` = admin_notes.
   - **Sidebar `<aside>`**:
     - `.abrd-action-card` > `.abrd-action-head` `⚡ Actions` > `.abrd-action-body`:
       - `.abrd-current-status`: `.abrd-current-label` `Current Status`; `.abrd-current-val` (`style="color:<sCfg color>"`) = `icon label`.
       - `.abrd-notes-wrap`: `<label class="abrd-notes-label" for="sharedNotes">Note to Reporter <span style="font-weight:400;color:#cbd5e1">(optional)</span></label>`; `<textarea id="sharedNotes" class="abrd-notes-textarea" placeholder="Add a message that will be included in the email notification to the reporter…">` prefilled with `admin_notes`; `.abrd-notes-hint` = `This note will appear in the status update email sent to the reporter.`
       - `<hr style="border:none;border-top:1px solid #f1f5f9;margin:.25rem 0">`
       - action forms per 2.5, each seeded with the SVG icons shown in source.
       - the "All actions send an email…" paragraph.
     - Card "Quick Links": head icon `background:#f1f5f9;color:#374151;` (🔗) + `Quick Links`; `.abrd-card-body` (`style="display:flex;flex-direction:column;gap:.5rem"`) with three links:
       - `mailto:<reporter_email>` — `Email Reporter Directly` (envelope SVG, `color:#6c63ff;font-weight:600`)
       - `/track-report?ref=<reference>` target `_blank` — `View Reporter's Track Page` (search SVG)
       - `bug-reports.php` — `Back to All Reports` (`color:#64748b`)

### 2.7 Inline scripts (exact behaviour)

```
(function () {
  function injectNotes(form) {
    const notes = document.getElementById('sharedNotes').value;
    const hidden = form.querySelector('input[name="admin_notes"]');
    if (hidden) hidden.value = notes;
  }
  document.querySelectorAll('.js-inject-notes').forEach(f =>
    f.addEventListener('submit', function () { injectNotes(this); }));
  document.querySelectorAll('.js-confirm-action').forEach(f =>
    f.addEventListener('submit', function (e) {
      if (!confirm(f.dataset.msg || 'Are you sure?')) { e.preventDefault(); return; }
      injectNotes(this);
    }));
})();
document.getElementById('fontStylesheet')?.addEventListener('load', function(){ this.media='all'; });
```

In Next.js: copy the shared textarea value into the submitted `admin_notes` for every action; confirm dialogs for wont_fix/duplicate with those exact strings; no confirm for resolve/in_progress/reopen.

### 2.7 CSS (`bug-report-detail.css`)

Prefix `abrd-`. Layout `grid-template-columns:1fr 320px; gap:1.5rem`. Action card `position:sticky; top:84px`. Buttons: `--resolve` `#16a34a`; `--progress` `#6c63ff`; `--reopen` white/grey; `--wontfix` white with `#dc2626` text/border; `--duplicate` white/grey. `.abrd-text-block` uses `white-space:pre-wrap`, bg `#f8fafc`. Flash keyframes `abrdFade`. Responsive: at ≤900px layout single column and action card `position:static`; at ≤600px padding/title shrink. (`.abrd-log*` timeline classes exist but are unused by the markup.)

---

## 3. Page: Contact Submissions List — `contact-submissions.php`

### 3.1 Purpose / guard / meta

- Purpose: browse, filter, paginate and open contact tickets.
- Guard: `requireRole(ROLE_ADMIN)`.
- `$activeNav = 'contact-submissions'`.
- Title: `Contact Submissions – Admin | <SITE_NAME>`.
- Robots: `noindex, nofollow`.

### 3.2 Inputs / filters

- `status` default `'all'`; whitelist `['all','open','in_progress','waiting','resolved','closed']`; invalid → `'all'`.
- `category` default `'all'`; whitelist `['all','general','billing','technical','course_content','account','instructor','partnership','feedback','other']`; invalid → `'all'`.
- `priority` default `'all'`; whitelist `['all','low','normal','high','urgent']`; invalid → `'all'`.
- `search` `trim`.
- `page` `max(1,(int)($_GET['page'] ?? 1))`; `$perPage = 25`; `$offset = (page-1)*perPage`.

WHERE: `1=1` + optional `AND status=?`, `AND category=?`, `AND priority=?`; search → `AND (ticket_ref LIKE ? OR subject LIKE ? OR sender_name LIKE ? OR sender_email LIKE ?)` with `%search%`.

Queries:
- Total: `SELECT COUNT(*) FROM contact_submissions WHERE <where>`.
- `$totalPages = max(1, ceil(total / perPage))`.
- Rows: `SELECT cs.*, (SELECT COUNT(*) FROM contact_replies cr WHERE cr.submission_id = cs.id) AS reply_count FROM contact_submissions cs WHERE <where> ORDER BY <ordering> LIMIT $perPage OFFSET $offset`. (`$perPage`/`$offset` are interpolated integers.)
- Status counts: `COUNT(*) WHERE status=?` for each of open, in_progress, waiting, resolved, closed; `all` = sum.
- `$urgentOpen` = `COUNT(*) WHERE status='open' AND priority='urgent'`.

### 3.3 Static label maps

`$categoryLabels`:

| key | label |
|---|---|
| general | General Inquiry |
| billing | Billing & Payments |
| technical | Technical Issue |
| course_content | Course Content |
| account | Account & Profile |
| instructor | Instructor Support |
| partnership | Partnership / Business |
| feedback | Feedback & Suggestions |
| other | Other |

`$statusMeta` (label + CSS class): open→`Open`/`acs-badge--open`; in_progress→`In Progress`/`acs-badge--progress`; waiting→`Waiting`/`acs-badge--waiting`; resolved→`Resolved`/`acs-badge--resolved`; closed→`Closed`/`acs-badge--closed`.

`$priorityMeta`: low→`Low`/`acs-pri--low`; normal→`Normal`/`acs-pri--normal`; high→`High`/`acs-pri--high`; urgent→`Urgent`/`acs-pri--urgent`.

Row fallbacks: unknown status → `ucfirst(status)` + `acs-badge--open`; unknown priority → `ucfirst(priority)` + `acs-pri--normal`; unknown category → `ucfirst(category)`.

### 3.4 DOM structure

Root `<div class="acs-page">`.

1. Header `.acs-page-header`: left `<h1 class="acs-page-title">💬 Contact Submissions</h1>` + `<p class="acs-page-sub">Manage and respond to all user inquiries and support tickets.</p>`; right `.acs-header-actions` with `<a href="/contact" class="addash-btn addash-btn--secondary" target="_blank">` external-link SVG + `View Contact Page`.
2. Stats `.acs-stats` — `.acs-stat` blocks (icon + label + value):
   - Open — 🟡 `background:#fef9c3;color:#854d0e;`
   - In Progress — 🔵 `background:#ede9fe;color:#5b21b6;`
   - Waiting on User — 🟠 `background:#ffedd5;color:#9a3412;`
   - Resolved — 🟢 `background:#dcfce7;color:#166534;`
   - Urgent Open — 🚨 `background:#fee2e2;color:#991b1b;` — rendered ONLY when `$urgentOpen > 0`; the block also gets extra class `acs-stat--urgent`.
3. Tabs `.acs-tabs`: `.acs-tab` (`acs-tab--active` current). Order/labels: `all`=All, `open`=Open, `in_progress`=In Progress, `waiting`=Waiting, `resolved`=Resolved, `closed`=Closed. Each has `<span class="acs-tab-count">` = count (or `$total` for `all`). URL = `?` + `http_build_query(array_merge($_GET, ['status'=>s,'page'=>1]))` (keeps all filters, resets to page 1).
4. Filters `<form method="GET" class="acs-filters">`:
   - hidden `status`
   - `<input type="text" name="search" class="acs-filter-input" placeholder="Search by name, email, subject, or ref…" value="<search>">`
   - `<select name="category" class="acs-filter-select">` first option `All Categories` (value `all`) then `$categoryLabels`; `selected` on match.
   - `<select name="priority" class="acs-filter-select">`: `All Priorities` (all), `Urgent`, `High`, `Normal`, `Low`; `selected` on match.
   - `<button type="submit" class="addash-btn addash-btn--primary">` search SVG + `Filter`.
   - Clear link (if any filter active): `<a href="?status=<status>" class="addash-btn addash-btn--secondary">Clear</a>`.
5. Empty: `.acs-empty` with a chat SVG + `<p>No submissions match your filters.</p>`.
6. Else `.acs-table-wrap` > `<table class="acs-table">`:
   - Headers: `Ticket Ref`, `From`, `Subject`, `Category`, `Priority`, `Status`, `Replies`, `Submitted`, `""`.
   - Row `<tr class="acs-row[ acs-row--urgent]">`; `acs-row--urgent` added when `priority==='urgent' && status==='open'`.
     - col1 `<code class="acs-ref">ticket_ref</code>`
     - col2 `.acs-sender`: `.acs-sender-name` + `.acs-sender-email`
     - col3 `.acs-subject` subject
     - col4 `<span class="acs-cat">` category label
     - col5 `<span class="acs-pri <class>">label</span>`
     - col6 `<span class="acs-badge <class>">label</span>`
     - col7 `.acs-reply-count` int reply_count
     - col8 `.acs-date` = `date('M j, Y', strtotime(created_at))`
     - col9 `<a href="contact-submission-detail.php?id=<id>" class="addash-btn addash-btn--secondary acs-view-btn">View →</a>`
7. Pagination `.acs-pagination` (only if `$totalPages > 1`): one `.acs-page-btn` per page 1..N (`acs-page-btn--active` for current), each URL = `?` + `http_build_query(array_merge($_GET,['page'=>p]))`; then `<span class="acs-page-info">Page <current> of <totalPages> (<total> total)</span>`. `$baseUrl` is computed but unused.

### 3.5 CSS (`contact-submissions.css`)

Prefix `acs-`. Accent is **red `#e84545`** (not purple). Tabs active `#e84545`. Filters focus `#e84545`. `.acs-ref` monospace pill (`DM Mono, monospace, ui-monospace`) red. Badge colours: open `#fef9c3/#854d0e/#fde68a`; progress `#ede9fe/#5b21b6/#c4b5fd`; waiting `#ffedd5/#9a3412/#fdba74`; resolved `#dcfce7/#15803d/#86efac`; closed `#f3f4f6/#374151/#d1d5db`. Priority: low `#d1fae5/#065f46/#6ee7b7`; normal `#e0f2fe/#075985/#7dd3fc`; high `#ffedd5/#9a3412/#fdba74`; urgent `#fee2e2/#991b1b/#fca5a5`. `.acs-row--urgent td` bg `#fff8f8 !important`, hover `#fff0f0 !important`. `.acs-table { min-width:760px }`. Responsive: ≤1024px hide col4 (Category); ≤768px header column, stats 2 cols, filters stacked, hide col5 (Priority) and col7 (Replies); ≤480px tweaks.

### 3.6 Inline script

Only the no-op font-load handler (`fontStylesheet`).

Note: `contact-submissions.php` forwards `msg=deleted` from the detail-page delete, but this list page DOES NOT read or display any `$_GET['msg']`. So after delete the user lands on the list with no flash. Reproduce: either match this (no banner) or improve; document if changed.

---

## 4. Page: Contact Submission Detail — `contact-submission-detail.php`

### 4.1 Purpose / guard / meta

- Purpose: view a ticket thread, reply publicly or add an internal note, change status, delete the ticket.
- Guard: `requireRole(ROLE_ADMIN)`; requires `email_senders.php`.
- `$activeNav = 'contact-submissions'`.
- `$adminUser = getCurrentUser();`
- Title: `<ticket_ref> – Admin | <SITE_NAME>` (escaped ticket_ref).
- Robots: `noindex, nofollow`.

### 4.2 Load + query

- `$id = (int)($_GET['id'] ?? 0);` if `!$id` → redirect `contact-submissions.php`.
- `SELECT * FROM contact_submissions WHERE id = ?`; if not found → redirect.
- Flash: `$_GET['msg']` → `$flash = htmlspecialchars(...)`, `$flashType` default empty (class becomes `acsd-flash--` if set only via GET; successful actions pass no type then redirect, so the GET-`msg` flash is rendered with class `acsd-flash--` — matching neither success nor error CSS. Reproduce visible behaviour; see 4.4.)

### 4.3 POST actions (exact field names, messages, redirects)

Method check POST. CSRF `verifyCSRFToken($_POST['csrf_token'] ?? '')`. Failure:
`$flash = 'Security token mismatch. Please refresh and try again.'; $flashType = 'error';` (no redirect).

`$action = $_POST['action'] ?? '';`

**A) `action === 'reply'`**

Fields:
- `reply_message` = `trim(strip_tags($_POST['reply_message'] ?? ''))`
- `new_status` = `$_POST['new_status'] ?? $submission['status']`
- `reply_type` = `$_POST['reply_type'] ?? 'public'`

Whitelists (invalid → fallback, no error):
- statuses `['open','in_progress','waiting','resolved','closed']`; invalid → current submission status.
- types `['public','internal']`; invalid → `'public'`.

Validation:
- empty OR `mb_strlen < 5` → `$flash='Reply message is too short (minimum 5 characters).'; $flashType='error';`
- `mb_strlen > 10000` → `$flash='Reply is too long (max 10 000 characters).'; $flashType='error';` (note the space in `10 000`).
- (The HTML `textarea` also has `maxlength="10000"` and `required`.)

On success:
1. INSERT into `contact_replies` `(submission_id, admin_id, reply_message, reply_type, resolution_status, created_at)` VALUES `(?, ?, ?, ?, ?, NOW())` with:
   - submission_id = `$id`
   - admin_id = `(int)$adminUser['id']`
   - reply_message
   - reply_type
   - resolution_status = `($newStatus !== $submission['status']) ? $newStatus : null`
   - created_at = `NOW()`
2. UPDATE `contact_submissions SET status = ?, updated_at = NOW() WHERE id = ?` using `$newStatus`.
3. Email ONLY when `$replyType === 'public' && $saved` (a truthy insert result):
   `sendContactReplyEmail($submission['sender_email'], $submission['sender_name'], $submission['subject'], $submission['ticket_ref'], $replyMsg, $newStatus);`
   (Post-update, `$newStatus` is the value sent to the email; the submission row is NOT reloaded, but `$submission['subject']`/`ticket_ref` are unchanged so this is fine.)
4. Flash:
   - internal: `'Internal note saved.'`
   - public: `'Reply sent and user notified via email.'`
   Both `$flashType='success'`.
5. PRG: `$qs = http_build_query(array_merge($_GET, ['msg' => $flash])); header("Location: ?$qs"); exit;`

**B) `action === 'change_status'`** (no reply)

- `new_status` whitelist `['open','in_progress','waiting','resolved','closed']`; invalid → current status.
- UPDATE `contact_submissions SET status = ?, updated_at = NOW() WHERE id = ?`.
- `$flash = 'Ticket status updated to ' . ucfirst(str_replace('_', ' ', $newStatus)) . '.'; $flashType='success';` → PRG redirect.
- Examples: `Ticket status updated to In progress.`, `Ticket status updated to Waiting.`, `Ticket status updated to Resolved.`

**C) `action === 'delete'`**

- `DELETE FROM contact_replies WHERE submission_id = ?` then `DELETE FROM contact_submissions WHERE id = ?`.
- `header('Location: contact-submissions.php?msg=deleted'); exit;` (list page shows nothing for `msg`).

**IMPORTANT — evidence-based negative findings (do not invent):**
- There is **NO priority-change POST action** in this page. Priority is only displayed and filterable on the list.
- There is **NO assign / assignee action** anywhere in this page (no `assigned_to` column, no admin assignment).
- There are exactly three POST actions: `reply`, `change_status`, `delete`.

### 4.4 Replies load

`SELECT r.*, u.name AS admin_name FROM contact_replies r LEFT JOIN users u ON u.id = r.admin_id WHERE r.submission_id = ? ORDER BY r.created_at ASC`.

`$csrfToken = generateCSRFToken();`

### 4.5 Static label maps

`$categoryLabels` identical to the list. `$statusMeta` uses detail classes: open→`acsd-status--open`; in_progress→`acsd-status--progress`; waiting→`acsd-status--waiting`; resolved→`acsd-status--resolved`; closed→`acsd-status--closed`. `$priorityMeta` uses `acsd-pri--low|normal|high|urgent`. Fallbacks: unknown status → `ucfirst` + `acsd-status--open`; unknown priority → `ucfirst` + `acsd-pri--normal`.

### 4.6 DOM structure

Root `<div class="acsd-page">`.

1. Breadcrumb `.acsd-breadcrumb` > `<a href="contact-submissions.php" class="acsd-back">` arrow-left SVG + `Back to Submissions`.
2. Flash (if `$flash`): `<div class="acsd-flash acsd-flash--<flashType>">escaped flash</div>`.
3. Layout `.acsd-layout` (grid `1fr 300px`).
   - **Main `.acsd-main`**:
     - `.acsd-ticket-head`: `.acsd-ticket-head-left` with `<code class="acsd-ref">ticket_ref</code>`, `<span class="acsd-status <class>">label</span>`, `<span class="acsd-pri <class>">label</span>`; and `<span class="acsd-ticket-date">Submitted <date></span>` where date = `date('M j, Y \a\t g:i A', strtotime(created_at))` (e.g. `Oct 10, 2026 at 3:04 PM`).
     - `<h1 class="acsd-subject">subject</h1>`.
     - Thread `.acsd-thread`:
       - **Original message** `.acsd-msg .acsd-msg--user`: avatar `.acsd-msg-avatar .acsd-msg-avatar--user` = `strtoupper(substr(sender_name,0,1))`; body `.acsd-msg-body` with `.acsd-msg-head` (`<strong>sender_name</strong>`, `.acsd-msg-role` = sender_role or `Guest`, `.acsd-msg-time` = created date) and `.acsd-msg-text` = `nl2br(htmlspecialchars(message))`; optional `.acsd-msg-meta`: `Order Ref: <code>order_ref</code>` and `Course: <code>course_ref</code>` when non-empty.
       - **Replies** loop `.acsd-msg .acsd-msg--<admin|internal>` (internal when `reply_type==='internal'`):
         - avatar: `.acsd-msg-avatar .acsd-msg-avatar--admin` with user SVG (public) OR `.acsd-msg-avatar--internal` with lock SVG (internal).
         - `.acsd-msg-head`: `<strong>` = `🔒 Internal Note` (internal) or `<SITE_NAME> Support` (public); `.acsd-msg-role` = `admin_name ?? 'Admin'`; `.acsd-msg-time` = created date.
         - `.acsd-msg-text` = `nl2br(htmlspecialchars(reply_message))`.
         - if `resolution_status` non-empty: `.acsd-status-change` = `Status → <strong>{ucfirst(str_replace('_',' ',resolution_status))}</strong>`.
     - Reply box: if `$submission['status'] !== 'closed'`:
       - `.acsd-reply-box` > `<h3 class="acsd-reply-title">Reply to User</h3>` > `<form method="POST" id="replyForm">`:
         - hidden `csrf_token`, hidden `action=reply`.
         - `.acsd-reply-type` with two `<label class="acsd-reply-type-opt">` each containing a hidden radio (`name="reply_type"`, values `public` (checked) / `internal`) and a `.acsd-reply-type-label acsd-reply-type-label--public|--internal` with send / lock SVGs and text `Send to User` / `Internal Note`.
         - `<textarea name="reply_message" id="replyMessage" class="acsd-reply-textarea" rows="6" placeholder="Write your reply or internal note here…" required maxlength="10000">`.
         - `.acsd-reply-char`: `<span id="replyCharCount">0</span> / 10,000`.
         - `.acsd-reply-footer`: `.acsd-reply-status-wrap` with `<label class="acsd-label" for="new_status">Update Status</label>` and `<select name="new_status" id="new_status" class="acsd-select">` (options = `$statusMeta`, `selected` on current status); `<button type="submit" class="addash-btn addash-btn--primary" id="replySubmitBtn">` send SVG + `Send Reply`.
     - Else (closed): `.acsd-closed-note` = `This ticket is closed. <a href="?id=<id>" class="acsd-link js-reopen-ticket">Reopen it</a> to add a reply.`
   - **Sidebar `<aside class="acsd-sidebar">`**:
     - Card "Quick Status Change": `<form method="POST">` hidden csrf + `action=change_status`; `<select name="new_status" class="acsd-select acsd-select--full">` (all statuses, current selected); `<button type="submit" class="addash-btn addash-btn--secondary acsd-btn-full mt-2">Update Status</button>`.
     - Card "Ticket Details" `.acsd-dl` (dt/dd): Reference (`<code class="acsd-ref-sm">`), Category, Priority (badge), Status (badge), Submitted (date), Last Updated (only if `updated_at !== created_at`), Replies (`count($replies)`).
     - Card "Sender Info" `.acsd-dl`: Name; Email (mailto `.acsd-link`); Role (`sender_role ?? 'Guest'`); IP (if non-empty, `<code>`); User Account → `user-detail.php?id=<user_id>` link text `View Profile →` (only if `user_id` non-empty).
     - Card "References" (only if `order_ref` or `course_ref` non-empty): Order Ref `<code>` / Course.
     - Danger card `.acsd-sidebar-card .acsd-sidebar-card--danger`: title `.acsd-sidebar-card-title--danger` = `Danger Zone`; `<form method="POST" class="js-delete-ticket">` hidden csrf + `action=delete`; `<button class="addash-btn addash-btn--danger acsd-btn-full">` trash SVG + `Delete Ticket`.

### 4.7 Inline scripts (exact behaviour)

- Char counter: on `input` on `#replyMessage`, set `#replyCharCount` to `len.toLocaleString()`, and set colour to `#dc2626` when `len > 9000` (else clear).
- Reply-type toggle: on change of radios, rewrite `#replySubmitBtn` innerHTML to lock SVG + `Save Note` (internal) or send SVG + `Send Reply` (public). (Also references a `<span>` in the button that does not exist — dead line; the innerHTML overwrite is what takes effect.)
- Reopen link `.js-reopen-ticket` click: sets the FIRST `[name=new_status]` element to `'open'` (it links to `?id=<id>` so the page reloads; setting the select is cosmetic before navigation).
- Delete form `.js-delete-ticket` submit: `confirm('Permanently delete this ticket and all replies? This cannot be undone.')`, `preventDefault` if cancelled.
- Font-load no-op (`fontStylesheet`).

### 4.8 CSS (`contact-submission-detail.css`)

Prefix `acsd-`. Accent red `#e84545`. Layout `grid 1fr 300px`, sidebar `position:sticky; top:84px`. Message bubbles: user white; admin `background:#fdf8ff;border-color:#e9d5ff` and `flex-direction:row-reverse` (right aligned); internal `background:#fffbeb;border:1.5px dashed #fcd34d`. Avatars: user `#e84545`; admin `#7c3aed`; internal `#d97706`. Message bodies use `white-space:pre-wrap`. Reply-type selected states: public `#eff6ff/#3b82f6/#1d4ed8`; internal `#fffbeb/#f59e0b/#92400e`. Flash keyframe `acsdFadeIn`. Responsive: ≤960px single column, sidebar reordered above thread (`order:-1`) and laid out as an auto-fill grid (danger card spans all columns); ≤640px sidebar back to column, subject/ticket-head shrink, `acsd-msg--admin` returns to left-aligned, message time hidden; ≤400px reply-type stack.

---

## 5. Emails

### 5.1 Shared shell helpers (`email_templates.php`)

All templates are wrapped by `emailShell($body, $previewText)`:

- Full HTML doc; hide preview text in a hidden div (`color:#f0f4f8`) with `&nbsp;&zwnj;` padding.
- Card `max-width:600px`, radius 16, shadow `0 4px 24px rgba(15,76,129,.10)`.
- Header gradient `linear-gradient(135deg,#0f4c81 0%,#0d3d6b 50%,#051d3a 100%)`; wordmark `edu` white + `lari` `#00b4d8`, links to `SITE_URL`.
- Body padding `40px 40px 32px`; divider `#e0ecf5`; footer copyright `© <year> <SITE_NAME> · All rights reserved` + site link.
- Responsive `@media (max-width:600px)` tweaks.

Helpers: `emailButton($url,$label,$color='#0f4c81')`, `emailFallbackLink($url)` (`Or paste this link into your browser:`), `emailNotice($icon,$text,$bg,$border)` (left-border 4px block), `emailDataTable($rows)` (zebra `#f7fafd`/`#fff`, label col 40%), `emailHeading($icon,$text)` (h1 22px `#0f1f3a`), `emailSubtitle($text)`, `emailP($text,$extraStyle='')`, `emailFeatureList($items)`.

### 5.2 Bug status email (sent by bug-report-detail)

`buildBugStatusEmailSubject($newStatus, $subject, $reference)`:

```
$statusPhrases = [
  'resolved'    => 'resolved',
  'in_progress' => 'now being investigated',
  'open'        => 'reopened',
  'wont_fix'    => "closed (won't fix)",
  'duplicate'   => 'closed (duplicate)',
];
return '[' . $reference . '] Your report has been ' . $phrase . ' — ' . mb_strimwidth($subject, 0, 60, '…');
```

`buildBugStatusEmailHtml($reporterName,$subject,$reference,$newStatus,$adminNotes='')`:

- `$trackUrl = SITE_URL . '/track-report?ref=' . urlencode($reference)`.
- `$firstName` = first word of reporterName (escaped).
- Per-status config (icon/label/color/bg/border/badge/heading/sub/intro/extra):

| status | icon | label | badge | heading |
|---|---|---|---|---|
| resolved | ✅ | Resolved | `APPLICATION RESOLVED` | `Your report has been resolved!` |
| in_progress | 🔵 | In Progress | `UNDER INVESTIGATION` | `We're working on your report` |
| open | 🟡 | Reopened | `REPORT REOPENED` | `Your report has been reopened` |
| wont_fix | ⛔ | Won't Fix | `CLOSED — WON'T FIX` | `An update on your report` |
| duplicate | 🔁 | Duplicate | `CLOSED — DUPLICATE` | `Your report has been marked as a duplicate` |

(colours match the on-page status config; `sub`/`intro`/`extra` strings exactly as in source lines 985–1056, including the resolved feature list and the wont_fix/duplicate/ in_progress notices with their inline links to `/report-bug`, `/help-center`.)

- Structure: centred status badge pill → `emailHeading` → `emailSubtitle` → `emailP('Hi <strong>first</strong>,')` → `emailP(intro)` → `emailDataTable([Reference,$eRef],[Issue,$eSubject],[New Status,icon <strong>label</strong>],[Updated, date('d M Y, H:i').' UTC'])` → optional admin-note block (`background:#f0f6fb;border-left:4px solid #0f4c81`, label `💬 Note from the <SITE_NAME> Team:`, `nl2br(htmlspecialchars(adminNotes))`) when `trim(adminNotes)` non-empty → `extra` → `emailButton($trackUrl,'Track Your Report →','#6c63ff')` → `emailFallbackLink`.
- previewText: `<icon> Your report <reference> is <lowercased label> — <subject trimmed 60>`.

`buildBugStatusEmailText(...)`: plain-text variant; `$statusLabels` = `RESOLVED ✅ / IN PROGRESS 🔵 / REOPENED 🟡 / WON'T FIX ⛔ / DUPLICATE 🔁`; optional note block `Note from the <SITE_NAME> Team:`; ends `Track your report online:\n<trackUrl>\n\nThank you for helping improve <SITE_NAME>.\n\n— The <SITE_NAME> Team`.

Failure handling: the sender wraps in try/catch and `error_log`s; the page reports "(Email notification failed — check logs.)". In the port, `await` the Nodemailer send (or `after()`), fail silently to the log, and use the same user-facing message.

### 5.3 Contact reply email (sent by contact-submission-detail)

`sendContactReplyEmail($email,$name,$subject,$ticketRef,$replyMsg,$newStatus)` (`email_senders.php`):

```
$mail = createMailer();
$mail->addAddress($email, $name);
$mail->isHTML(true);
$mail->Subject = 'Re: ' . $subject . ' [' . $ticketRef . '] – ' . SITE_NAME;
$mail->Body    = buildContactReplyHtml($name,$subject,$ticketRef,$replyMsg,$newStatus);
$mail->AltBody = buildContactReplyText($name,$subject,$ticketRef,$replyMsg,$newStatus);
$mail->send();
```

Wrapped in try/catch `\PHPMailer\PHPMailer\Exception`, logs `Contact reply email failed for {email}: ...` (fire-and-forget; the caller does not surface failure).

`buildContactReplyHtml($name,$subject,$ticketRef,$replyMsg,$newStatus)`:

- `$trackUrl = SITE_URL . '/track-contact?ref=' . urlencode($ticketRef)`.
- `_contactStatusLabel($newStatus)`: open→`Open 🔵`; in_progress→`In Progress 🟡`; waiting→`Waiting on You 🟠`; resolved→`Resolved ✅`; closed→`Closed ⚫`.
- `$isResolved = in_array($newStatus, ['resolved','closed'])`.
- Structure: `emailHeading('💬','Reply from <SITE_NAME> Support')` → `emailSubtitle("We've responded to your inquiry [ticketRef].")` → `emailP Hi <strong>first</strong>,` → `emailP Our support team has replied…` → `emailDataTable([Ticket Reference],[Subject],[New Status,statusLabel],[Replied, date('d M Y, H:i').' UTC'])` → reply block (`background:#f0f6fb;border-left:4px solid #0f4c81`, label `💬 Message from <SITE_NAME> Support:`, `nl2br(htmlspecialchars($replyMsg))`) → notice: resolved/closed → `✅ Your ticket has been marked as <strong>statusLabel</strong>. If your issue isn't fully resolved, please <a /contact>submit a new ticket</a>.` (`#f0fdf4`/`#16a34a`); otherwise `↩️ If you have follow-up questions, you can track your ticket and view the full thread anytime.` (`#e8f4fd`/`#0f4c81`) → `emailButton($trackUrl,'View Full Ticket Thread →')` → `emailFallbackLink`.
- previewText: `Reply from <SITE_NAME> Support on "<subject trimmed 60>"`.

`buildContactReplyText(...)`: plain-text variant ending with `If your issue isn't resolved, please submit a new ticket:\nSITE_URL/contact\n\n— The <SITE_NAME> Support Team`.

---

## 6. Bug attachment serve mechanism — exact PHP behaviour + port requirement

### 6.1 How a bug attachment is created (submit side, `public/report-bug.php`)

- Optional single file field `name="attachment"`.
- Allowed MIME types: `image/jpeg, image/png, image/gif, image/webp, application/pdf`.
- Max size `5 * 1024 * 1024` (5 MB).
- Extension sanitised: `preg_replace('/[^a-zA-Z0-9]/','',$ext)`.
- Upload dir: `PRIVATE_PATH . '/uploads/bug_reports/'` (created `0755` if missing) — i.e. on the PHP server's **private** disk, outside the web root.
- Stored filename: `'br_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $safeExt` (unguessable random name).
- The DB column `bug_reports.attachment` stores ONLY the filename (`$attachName`), never a path.
- The same file is also attached to the admin notification email via `$mail->addAttachment($attachPath, 'screenshot.' . $safeExt)`.

### 6.2 How it is "served" (detail side, `bug-report-detail.php`)

- Link: `<a href="/serve-attachment.php?file=<urlencode($report['attachment'])>" target="_blank">` + the filename as the link text.
- **CRITICAL FINDING:** `serve-attachment.php` **does not exist** anywhere in the PHP tree (verified: no file named `serve-attachment.php`; the only serve script is `admin/serve-doc.php`; no `.htaccess` rule maps `serve-attachment`). `private/uploads/bug_reports/` also does not exist (only `private/uploads/instructor_docs/` exists). Therefore the current live link is a **broken/dangling endpoint** — clicking "Attachment" 404s. There is no PHP code that streams the bug file to the admin.

### 6.3 Port requirement

Because the reference endpoint is missing, the new port must implement the INTENDED behaviour (authorized admin-only download), not the broken one:

- Store bug attachments in **Backblaze B2** (private bucket/prefix `bug_reports/`), keeping the same random `br_<time>_<hex>.<ext>` naming and the same validation (type, 5 MB, extension sanitising).
- Persist only the object key in `bug_reports.attachment` (as PHP did).
- Serve through an **authorized route** equivalent to `serve-attachment.php`, e.g. `app/api/media/bug-report/[file]/route.ts` or a branch of the existing `/api/media` proxy: `requireRole(ROLE_ADMIN)` server-side, verify the key belongs to a `bug_reports` row, then stream from B2 with the same content-type/cache semantics the media proxy uses (private file → no public caching; support HTTP Range if the media proxy does). Never expose a raw public B2 URL.
- Note this gap in `docs/PROGRESS.md` as "PHP endpoint missing; ported intended authorized download."

---

## 7. Security / validation summary (parity checklist items)

- Admin guard on every route (`requireRole(ROLE_ADMIN)`) server-side; no client-side-only checks.
- CSRF token verified on every POST (bug detail: `Invalid security token…`; contact detail: `Security token mismatch…`). New port: verify Origin/Host AND token (server actions included).
- All filter/action values whitelisted; invalid values silently fall back (filters) or produce a specific error (unknown action).
- Parameterized SQL for all user input (`search`, ids, filters). The only interpolation is the numeric `$perPage`/`$offset`.
- Output escaped with `htmlspecialchars(ENT_QUOTES)`; `nl2br(htmlspecialchars(...))` for message bodies; reply input additionally `strip_tags`'d on save.
- Reply: required, min 5 chars, max 10000 chars (server + `required`/`maxlength` client).
- PRG after every successful POST (bug detail and contact detail reply/status). Delete redirects to the list.
- Email to reporter only on public replies; internal notes never emailed. Bug status changes always email.
- Never reveal more than the PHP does; log failures only.
- Double-escaped `$_GET['msg']` behaviour noted (0.2/2.2/4.2) — document any intentional de-duplication.

---

## 8. New-file mapping proposal (for the implementation phase)

- `app/(admin)/admin/bug-reports/page.tsx` — server component list; filters from `searchParams`; a small client component for nothing (form is plain GET) — filter form can be a plain `<form>`; font-load handler not needed.
- `app/(admin)/admin/bug-report-detail/page.tsx` — server component; a client `BugActions` component ports the shared-notes injection + confirm dialogs and posts to a server action `updateBugStatus`.
- `app/(admin)/admin/contact-submissions/page.tsx` — server list + pagination.
- `app/(admin)/admin/contact-submission-detail/page.tsx` — server component; client `ContactReplyForm` (char counter, reply-type toggle label) + server actions `replyToSubmission`, `changeSubmissionStatus`, `deleteSubmission`.
- `lib/db/bugReports.ts`, `lib/db/contactSubmissions.ts` — postgres.js tagged queries (list, counts, detail, insert reply, updates).
- `lib/email/bugStatus.ts`, `lib/email/contactReply.ts` — Nodemailer ports of the builders/senders; shared shell helpers `lib/email/shell.ts`.
- `styles/admin/bug-reports.css`, `bug-report-detail.css`, `contact-submissions.css`, `contact-submission-detail.css` — copied verbatim; imported in the same order after `base.css`, `navbar.css`, `admin/dashboard.css`.
- `app/api/media/bug-report/[file]/route.ts` (or `/api/media` branch) — admin-authorized B2 stream.

---

## 9. PORT CHECKLIST

1. Create 4 admin routes under `app/(admin)/admin/…` with `requireRole(ROLE_ADMIN)` guard and Node runtime; titles `Bug Reports – Admin | {SITE_NAME}`, `Bug Report {ref} – Admin | {SITE_NAME}`, `Contact Submissions – Admin | {SITE_NAME}`, `{ticket_ref} – Admin | {SITE_NAME}`; all `robots: noindex, nofollow`; `activeNav` equivalents in navbar.
2. Import CSS verbatim in order: `base.css` → `navbar.css` → `admin/dashboard.css` → page CSS; render navbar + footer chrome on all four.
3. Bug list: status/severity/type/search filters with whitelists + fallback to `all`; stats (Open/In Progress/Resolved/Critical Open/Total); tabs (All/🟡Open/🔵In Progress/✅Resolved/⛔Won't Fix/🔁Duplicate) with counts and filter-preserving URLs; table columns (Reference/Subject(55-char)/Reporter/Type/Severity/Status/Submitted/Action); `d M Y` dates; empty state; 768px column hiding; translate `FIELD()` to `CASE`.
4. Bug detail: load by id with redirect when missing; POST actions resolve/in_progress/reopen/wont_fix/duplicate; set `status`,`admin_notes`,`updated_at`; `resolved_at` set on resolve and cleared on leaving resolved; PRG with exact success/failure messages; send status email; conditional buttons (resolve when !=resolved; in_progress when open/wont_fix/duplicate; reopen when !=open; wont_fix when !=wont_fix; duplicate when !=duplicate); shared-notes injection + confirm dialogs for wont_fix/duplicate.
5. Contact list: status/category/priority/search filters + whitelists; pagination 25/page + all page buttons + `Page X of Y (N total)`; stats incl. conditional Urgent Open; tabs; table (Ticket Ref/From/Subject/Category/Priority/Status/Replies/Submitted/View); urgent-open row highlight; empty state; `M j, Y` dates; responsive column hiding.
6. Contact detail: load by id with redirect; POST reply (min 5 / max 10000, status+type whitelists, `resolution_status` only when changed), change_status, delete (replies then submission → list); PRG with exact flash strings; send reply email ONLY for public replies; thread rendering (user/admin/internal bubbles, avatars, status-change notes, order/course refs); reply form hidden when closed with reopen link; sidebar (quick status, details, sender info, references, danger delete with confirm); char counter (red >9000) and reply-type button label toggle.
7. Port email builders 1:1: `buildBugStatusEmailSubject` phrases (`resolved`/`now being investigated`/`reopened`/`closed (won't fix)`/`closed (duplicate)`), `buildBugStatusEmailHtml`/`Text`, `sendContactReplyEmail` + `buildContactReplyHtml`/`Text`, and the shared shell helpers; subjects `Re: {subject} [{ref}] – {SITE_NAME}`; `await` sends; log failures like PHP.
8. Implement bug attachment download as an admin-authorized B2-backed media route (PHP `serve-attachment.php` is missing); keep the `br_<time>_<hex>.<ext>` naming and type/5MB validation; document the gap in PROGRESS.
9. Reproduce exact static text, placeholders, emoji, inline styles, SVG icons, class names and ids (parity-check via `scripts/parity-check.mjs`); run `npm run ui-compare` for these four pages and record results in `docs/UI_PARITY_REPORT.md`.
10. Reconcile the `set_updated_at()` trigger vs PHP's explicit `updated_at` writes so displayed "Last Updated" values match; run `npm run typecheck`, `npm run lint`, `npm run build`; update `docs/PROGRESS.md` and `docs/feature-matrix.md`.
