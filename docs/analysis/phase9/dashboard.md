# Phase 9 — Admin Dashboard (`public/admin/dashboard.php`) → Next.js Port Spec

Source of truth (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\dashboard.php` (580 lines)
Related read files: `public/partials/head.php`, `public/partials/admin-maintenance-banner.php`,
`public/navbar.php`, `public/footer.php`, `public/assets/css/admin/dashboard.css`.

Target route (Next App Router): `/admin/dashboard` (server component, Node runtime).
Legacy PHP URL `/admin/dashboard.php` must 301-redirect to `/admin/dashboard` (htaccess parity).

---

## 1. Purpose, URL, access guard, title, robots

- **Purpose:** Admin landing page. Shows platform-wide statistics (users, courses, enrollments,
  revenue), quick action shortcuts, recent signups/enrollments, top performing courses, and three
  irreversible maintenance actions (doc cleanup, purge rejected instructors, token cleanup).
- **URL:** `/admin/dashboard` (PHP file lives at `public/admin/dashboard.php`; page uses relative
  links so it must be mounted under `/admin/`).
- **Requires (top of file, in order):**
  - `private/bootstrap.php`
  - `private/config.php`
  - `private/db.php`
  - `private/auth.php`
  - `private/functions/admin.php`
  - `private/functions/instructor_registration.php`
  - `private/functions/token_cleanup.php`
- **Access guard:** `requireRole(ROLE_ADMIN);` (from `private/auth.php`). Admin role only; any
  other role / guest is denied by the guard before any HTML.
- **Page context:** `$user = getCurrentUser();`, `$activeNav = 'dashboard';` (legacy nav key),
  `$csrfToken = generateCSRFToken();`.
- **Page title:** `'Admin Dashboard — ' . htmlspecialchars(SITE_NAME)` → renders as
  `Admin Dashboard — {SITE_NAME}` (em-dash U+2014 between the words).
- **Robots meta:** explicitly set `$pageRobots = 'noindex, nofollow';` (head.php would also
  auto-set `noindex, nofollow` for any `/admin` path — same result).
- **No canonical / description / keywords / OG overrides** are set, so head.php defaults apply.
- Body background `#f1f5f9`; base text `#1e1e2e` (from `dashboard.css`).

---

## 2. DB queries / data reads

The page itself calls only these functions; SQL lives in the source files (do not re-derive here).

### Directly called by dashboard.php
| PHP function | Source | Notes |
|---|---|---|
| `getPlatformStats()` | `private/functions/admin.php:11` | Builds the whole `$stats` array (runs 7 queries). |
| `cleanupStaleDraftDocs(true)` | `private/functions/instructor_registration.php:503` | Force-run doc cleanup; returns int deleted. |
| `purgeRejectedInstructorData(true)` | `private/functions/instructor_registration.php:552` | Force-run purge; returns int purged. |
| `cleanupExpiredTokens(true)` | `private/functions/token_cleanup.php:23` | Force-run token cleanup; returns `array table=>count`. |

### `getPlatformStats()` returns / page reads these keys
- Scalars: `total_users`, `total_students`, `total_instructors`, `total_courses`,
  `published_courses`, `pending_courses`, `total_enrollments`, `total_revenue`.
- `monthly_revenue` — computed by the function but **never used** on this page.
- `recent_signups` — rows read: `name`, `email`, `role`, `registration_date` (and `id`, unused).
- `recent_enrollments` — rows read: `student_name`, `course_title`, `price`.
- `top_courses` — rows read: `title`, `instructor_name`, `enrollment_count`, `revenue`,
  `avg_rating`.
- **`pending_applications` is read by the template but is NOT produced by `getPlatformStats()`.**
  Because the check is `!empty($stats['pending_applications'])`, the Applications badge simply
  never renders. `getPendingApplicationsCount()` (`admin.php:797`) exists but is not called here.
  See "Surprises" in §7.

### Indirect (from included partials)
- `navbar.php`: `getUnreadNotificationCount($id)`, `getRecentNotifications($id,5)`,
  `notificationTypeLabel()` (`private/functions/notifications.php`), `getAvatarUrl()`
  (`private/functions/media_urls.php`).
- `navbar.php`: `getMaintenanceStatus()` (`private/functions/maintenance.php`) then includes
  `partials/admin-maintenance-banner.php`.
- `navbar.php`: `private/functions/banners.php` + `partials/site-banners.php`.
- `footer.php`: no DB.

---

## 3. GET query parameters → the three banner messages

Single param: **`?msg=`** (string). Processed only after the POST handlers:

```php
if (isset($_GET['msg'])) {
    $m = $_GET['msg'];
    if (strpos($m, 'Cleanup done') === 0)      $cleanupMessage = htmlspecialchars($m);
    elseif (strpos($m, 'Purge done') === 0)     $purgeMessage = htmlspecialchars($m);
    elseif (strpos($m, 'Token cleanup') === 0)  $tokenCleanupMessage = htmlspecialchars($m);
}
```

- Exact **prefix strings** compared with `strpos(..., 0) === 0`:
  - `Cleanup done`  → sets `$cleanupMessage`
  - `Purge done`    → sets `$purgeMessage`
  - `Token cleanup` → sets `$tokenCleanupMessage`
- First match wins (`elseif`). A message not matching any prefix is silently ignored.
- `htmlspecialchars($m)` here uses PHP defaults; the template then calls `htmlspecialchars()`
  **again** when echoing (double-escaping). The generated strings contain only
  `— ( ) . , : '` and letters/digits/spaces, so double-escape produces no visible difference —
  but note the behaviour for parity.
- Note the cleanup/purge prefixes include "done" while the token prefix is just `Token cleanup`
  (which also matches `Token cleanup done — ...`).

---

## 4. POST actions

### CSRF gate (applies to every POST, before any handler)
```php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verifyCSRFToken($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        die('Security token mismatch. Refresh the page and try again.');
    }
}
```
- Hidden field name: `csrf_token`. Value: `generateCSRFToken()`.
- On mismatch: **403** + exact body text `Security token mismatch. Refresh the page and try again.`

### 4.1 `run_cleanup`
- Condition: `isset($_POST['run_cleanup']) && $_POST['run_cleanup'] === '1'`.
- Calls: `$deleted = cleanupStaleDraftDocs(true);`
- Success message (`$deleted > 0`):
  `Cleanup done — removed doc files from {deleted} application(s).`
- Failure/zero message:
  `Cleanup done — no stale files found.`
- Redirect (then `exit`): `Location: dashboard.php?msg=` + `urlencode($cleanupMessage)`

### 4.2 `run_purge`
- Condition: `isset($_POST['run_purge']) && $_POST['run_purge'] === '1'`.
- Calls: `$purged = purgeRejectedInstructorData(true);`
- Success message (`$purged > 0`):
  `Purge done — cleared instructor data for {purged} rejected/failed user(s). They are now active students.`
- Failure/zero message:
  `Purge done — no rejected/failed users found to purge.`
- Redirect (then `exit`): `Location: dashboard.php?msg=` + `urlencode($purgeMessage)`

### 4.3 `run_token_cleanup`
- Condition: `isset($_POST['run_token_cleanup']) && $_POST['run_token_cleanup'] === '1'`.
- Calls: `$counts = cleanupExpiredTokens(true); $total = array_sum($counts);`
- If `$total > 0`:
  - `$details = implode(', ', array_map(fn($table,$n) => "{n} from {table}", array_keys($counts), $counts));`
  - Message: `Token cleanup done — deleted {total} expired row(s): {details}.`
  - (e.g. `2 from test_tokens, 1 from login_attempts`)
- Else: `Token cleanup done — nothing to delete.`
- Redirect (then `exit`): `Location: dashboard.php?msg=` + `urlencode($tokenCleanupMessage)`
- Order of table keys = order returned by `cleanupExpiredTokens()`:
  `test_tokens`, `test_failures`, `email_verification_tokens`, `password_resets`, `login_attempts`.

**Note:** the em-dash `—` (U+2014) is used in every success/failure message. All three handlers
use Post/Redirect/Get and `exit`, so refresh never resubmits. Handler order in the file is
CSRF → cleanup → purge → token → GET `?msg`.

---

## 5. Body DOM tree (pixel/DOM parity)

`<body>` → navbar include → `<main class="ad-page-wrap">` → `<div class="addash-page-inner">`.
(`.ad-page-wrap` and the CSS variables come from `navbar.css`, which is loaded by `navbar.php`;
`dashboard.css` depends on navbar.css being loaded first.)

### 5.1 Page header — `.addash-page-header`
- `<div>` (no class):
  - `<h1 class="addash-page-title">Admin Dashboard</h1>`
  - `<p class="addash-page-subtitle">` text:
    `Welcome back, {firstWordOfName}.` newline `Here's what's happening on the platform.`
    where `{firstWordOfName}` = `htmlspecialchars(explode(' ', $user['name'])[0])`.
- `<div class="addash-header-actions">`:
  1. `<a href="instructor-applications.php" class="addash-btn addash-btn--secondary">`
     - SVG `viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true"`:
       - `<path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
       - `<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
     - Text `Applications`
     - **Conditional**: if `!empty($stats['pending_applications']) && > 0` →
       `<span class="addash-badge-count">{pending_applications}</span>` (dead in practice, see §7)
  2. `<a href="courses.php?status=pending" class="addash-btn addash-btn--primary">`
     - SVG `viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true"`:
       - `<polyline points="9 11 12 14 22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
       - `<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
     - Text `Review Courses`
     - **Conditional**: if `!empty($stats['pending_courses']) && > 0` →
       `<span class="addash-badge-count addash-badge-count--light">{pending_courses}</span>`

### 5.2 Stats grid — `.addash-stats-grid` (4 × `.addash-stat-card`)
Each card = `<div class="addash-stat-icon addash-stat-icon--{color}" aria-hidden="true">` (SVG
22×22) + `<div class="addash-stat-body">` with `span.addash-stat-label`, `span.addash-stat-value`,
`span.addash-stat-sub`.

1. **Total Users** — icon `--blue`:
   - `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-width="2" stroke-linecap="round"/>`
   - `<circle cx="9" cy="7" r="4" stroke-width="2"/>`
   - `<path d="M23 21v-2a4 4 0 00-3-3.87" stroke-width="2" stroke-linecap="round"/>`
   - `<path d="M16 3.13a4 4 0 010 7.75" stroke-width="2" stroke-linecap="round"/>`
   - label `Total Users`; value `number_format($stats['total_users'])`;
     sub: `number_format(total_students) students` `·` `number_format(total_instructors) instructors`
     (`&middot;` entity between).
2. **Total Courses** — icon `--violet`:
   - `<path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke-width="2" stroke-linecap="round"/>`
   - `<path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke-width="2" stroke-linejoin="round"/>`
   - label `Total Courses`; value `number_format(total_courses)`;
     sub: `number_format(published_courses) published` `·`
     `<span class="addash-stat-warning">number_format(pending_courses) pending</span>`.
3. **Total Enrollments** — icon `--teal`:
   - `<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-width="2" stroke-linejoin="round"/>`
   - `<polyline points="14 2 14 8 20 8" stroke-width="2" stroke-linejoin="round"/>`
   - `<line x1="16" y1="13" x2="8" y2="13" stroke-width="2" stroke-linecap="round"/>`
   - `<line x1="16" y1="17" x2="8" y2="17" stroke-width="2" stroke-linecap="round"/>`
   - label `Total Enrollments`; value `number_format(total_enrollments)`; sub `All-time enrollments`.
4. **Total Revenue** — icon `--green`:
   - `<line x1="12" y1="1" x2="12" y2="23" stroke-width="2" stroke-linecap="round"/>`
   - `<path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-width="2" stroke-linecap="round"/>`
   - label `Total Revenue`; value `formatPrice((float)$stats['total_revenue'], false)`;
     sub `Platform-wide earnings`.

### 5.3 Quick Actions — `<section class="addash-section">`
- `<h2 class="addash-section-title">Quick Actions</h2>`
- `<div class="addash-actions-grid">` with **7** `<a class="addash-action-card">` (26×26 icons in
  `div.addash-action-icon.addash-action-icon--{color}`, then `div.addash-action-body` with
  `span.addash-action-title` + `span.addash-action-desc`):

| # | href | icon color | title | desc | icon SVG |
|---|---|---|---|---|---|
| 1 | `users.php?action=create` | `--blue` | `Add User` | `Create a new instructor or admin account` | user-plus (path `M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2`, circle `9 7 4`, line `19 8→19 14`, line `16 11→22 11`) |
| 2 | `categories.php?action=create` | `--violet` | `Add Category` | `Create a new course category` | folder-plus (path `M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z`, line `12 11→12 17`, line `9 14→15 14`) |
| 3 | `courses.php?status=pending` | `--orange` | `Review Courses` | `{number_format(pending_courses)} course(s) awaiting approval` | same checklist SVG as header button 2 |
| 4 | `instructor-applications.php` | `--teal` | `Applications` | `Review instructor applications` | same checklist SVG as header button 1 |
| 5 | `enrollments.php` | `--green` | `Enrollments` | `View and manage all enrollments` | file-text SVG (same as Total Enrollments) |
| 6 | `reviews.php` | `--yellow` | `Reviews` | `Monitor course ratings & reviews` (`&amp;`) | star polygon `points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"` |
| 7 | `send-notifications.php` | `--blue` | `Send Notification` | `Broadcast updates to users` | bell (`path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"`, `path d="M13.73 21a2 2 0 01-3.46 0"`) |

All action SVGs: `viewBox="0 0 24 24" fill="none" width="26" height="26"`, icon wrapper has
`aria-hidden="true"`; strokes `currentColor` width 2.

### 5.4 Two-column layout — `<div class="addash-two-col">`

**Recent Signups** — `<section class="addash-section">`
- `<div class="addash-section-header"><h2 class="addash-section-title">Recent Signups</h2><a href="users.php" class="addash-link-more">View all</a></div>`
- `<div class="addash-table-wrap"><table class="addash-table">`
- `<thead><tr><th>User</th><th>Role</th><th>Joined</th></tr></thead>`
- `<tbody>` **if `!empty(recent_signups)`** → `foreach`:
  - `<td class="addash-td-user">`
    - `<div class="addash-user-avatar" aria-hidden="true">{strtoupper(substr(name,0,1))}</div>`
    - `<div><span class="addash-user-name">{htmlspecialchars(name)}</span><span class="addash-user-email">{htmlspecialchars(email)}</span></div>`
  - `<td>` → `<span class="addash-badge addash-badge--{danger|warning|info}">{ucfirst(htmlspecialchars(role))}</span>`
    where `role==='admin'→danger`, `'instructor'→warning`, else `info`.
  - `<td class="addash-td-date">{date('M d, Y', strtotime(registration_date))}</td>`
- **else** → `<tr><td colspan="3" class="addash-td-empty">No recent signups.</td></tr>`

**Recent Enrollments** — `<section class="addash-section">`
- header: `Recent Enrollments` + `<a href="enrollments.php" class="addash-link-more">View all</a>`
- `<thead><tr><th>Student</th><th>Course</th><th>Amount</th></tr></thead>`
- **if `!empty(recent_enrollments)`** → `foreach`:
  - `<td class="addash-td-user">`
    - `<div class="addash-user-avatar addash-user-avatar--teal" aria-hidden="true">{strtoupper(substr(student_name ?? '?',0,1))}</div>`
    - `<span class="addash-user-name">{htmlspecialchars(student_name ?? '—')}</span>`
  - `<td class="addash-td-course">{htmlspecialchars(course_title)}</td>`
  - `<td class="addash-td-amount">{formatPrice((float)price, false)}</td>`
- **else** → `<td colspan="3" class="addash-td-empty">No recent enrollments.</td>`

### 5.5 Top Performing Courses — `<section class="addash-section">`
- header: `Top Performing Courses` + `<a href="courses.php" class="addash-link-more">View all courses</a>`
- `<thead><tr><th>Course</th><th>Instructor</th><th>Enrollments</th><th>Revenue</th><th>Rating</th></tr></thead>`
- **if `!empty(top_courses)`** → `foreach`:
  - `<td class="addash-td-bold">{htmlspecialchars(title)}</td>`
  - `<td>{htmlspecialchars(instructor_name)}</td>`
  - `<td><span class="addash-pill">{number_format(enrollment_count)}</span></td>`
  - `<td class="addash-td-amount">{formatPrice((float)(revenue ?? 0), false)}</td>`
  - `<td class="addash-td-rating">`
    - if `avg_rating` truthy → `<span class="addash-stars" aria-label="{round(avg_rating,1)} stars">{round(avg_rating,1)} ★</span>`
    - else → `<span class="addash-td-empty-cell">N/A</span>`
- **else** → `<td colspan="5" class="addash-td-empty">No course data available.</td>`

### 5.6 Maintenance — `<section class="addash-section addash-section--maintenance">`
- `<h2 class="addash-section-title addash-section-title--danger">` + warning-triangle SVG
  (`viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true"`:
  `path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"`,
  `line 12 9→12 13`, `line 12 17→12.01 17`) + text `Maintenance`
- `<p class="addash-maintenance-note">These actions are irreversible. Use them only when you know what you're doing.</p>`
- `<div class="addash-maintenance-grid">` with 3 × `.addash-maintenance-card`:
  Each card: `.addash-maintenance-card-header` > `.addash-maintenance-icon` (20×20 SVG) + div with
  `span.addash-maintenance-title` + `span.addash-maintenance-desc`; then optional alert; then form.

  1. **Doc Cleanup** — icon trash SVG (`polyline 3 6 5 6 21 6`; `path M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6`; `path M10 11v6M14 11v6`; `path M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2`).
     desc: `Delete uploaded doc files from drafts and failed applications older than 15&nbsp;days.`
     - if `$cleanupMessage` → `<div class="addash-alert addash-alert--success">{htmlspecialchars(cleanupMessage)}</div>`
     - `<form method="POST" class="js-confirm-form" data-confirm="Run cleanup and delete stale doc files now?">`
       hidden `csrf_token`, hidden `run_cleanup=1`,
       `<button type="submit" class="addash-btn addash-btn--danger-outline">Run Doc Cleanup</button>`
  2. **Purge Rejected Instructors** — icon x-circle SVG (`circle cx=12 cy=12 r=10`; `line 15 9→9 15`; `line 9 9→15 15`).
     desc: `Wipes profile &amp; application data for rejected/test-failed users. Converts them to students. Email is kept to block re-registration.`
     - if `$purgeMessage` → `.addash-alert.addash-alert--success` with `htmlspecialchars(purgeMessage)`
     - form `data-confirm` (contains literal newlines `\n\n`):
       `This will permanently delete all instructor profile and application data for rejected and test-failed users, and convert them to active students.\n\nTheir email is kept so they cannot re-register as instructor.\n\nContinue?`
       hidden `csrf_token`, hidden `run_purge=1`,
       button `.addash-btn.addash-btn--danger-outline` `Purge Rejected / Failed Data`
  3. **Token Cleanup** — icon lock SVG (`rect x=3 y=11 width=18 height=11 rx=2 ry=2`; `path M7 11V7a5 5 0 0110 0v4`).
     desc: `Deletes expired test tokens, email/password reset tokens, expired bans, and old login attempt records.`
     - if `$tokenCleanupMessage` → `.addash-alert.addash-alert--success` with `htmlspecialchars(tokenCleanupMessage)`
     - form `data-confirm="Delete all expired tokens and stale login attempt records now?"`
       hidden `csrf_token`, hidden `run_token_cleanup=1`,
       button `.addash-btn.addash-btn--danger-outline` `Run Token Cleanup`

### 5.7 Scripts + footer
- Inline `<script nonce="<?= CSP_NONCE ?>">` (see §6).
- `<?php include __DIR__ . '/../footer.php'; ?>` — renders the admin-compact footer
  (`footer class="uftr-footer uftr-footer--admin"`), role strip + bottom bar only (top marketing
  grid hidden by `.uftr-footer--admin`). Full markup is in `public/footer.php`.
- Navbar markup (admin variant): rendered by `public/navbar.php` (full top nav + mobile drawer +
  search modal + notification/profile dropdowns). It also loads `navbar.css`.

---

## 6. extraCss + inline script

- **`$extraCss = '../assets/css/admin/dashboard.css';`** (string, not array). head.php emits:
  `<link rel="stylesheet" href="../assets/css/admin/dashboard.css">` (relative; from `/admin/`
  resolves to `/assets/css/admin/dashboard.css`). In Next, import `styles/.../dashboard.css`.
- **Inline script** (verbatim behaviour):
  ```js
  (function () {
      document.querySelectorAll('.js-confirm-form').forEach(function (form) {
          form.addEventListener('submit', function (e) {
              if (!confirm(form.dataset.confirm)) e.preventDefault();
          });
      });
  })();
  document.getElementById('fontStylesheet')?.addEventListener('load', function() { this.media = 'all'; });
  ```
  - Attaches a submit handler to **every `.js-confirm-form`**; cancelling the native `confirm()`
    prevents submission. `data-confirm` is read from `form.dataset.confirm`.
  - The second statement targets `#fontStylesheet`, which **does not exist** in head.php (the
    Inter font link uses an inline `onload` and has no id) — it is a no-op guarded by `?.`.
  - Port as a client component that binds submit handlers (or an inline handler on submit).

---

## 7. Functions not in `admin.php` (source files)

| Symbol | Source file |
|---|---|
| `formatPrice(float, bool)` | `private/config.php:229` |
| `cleanupStaleDraftDocs(bool)` | `private/functions/instructor_registration.php:503` |
| `purgeRejectedInstructorData(bool)` | `private/functions/instructor_registration.php:552` |
| `cleanupExpiredTokens(bool)` | `private/functions/token_cleanup.php:23` |
| `requireRole`, `getCurrentUser`, `generateCSRFToken`, `verifyCSRFToken` | `private/auth.php` |
| `SITE_NAME`, `SITE_URL`, `CSP_NONCE`, `ROLE_ADMIN` | `private/config.php` / `private/bootstrap.php` |
| `getMaintenanceStatus` | `private/functions/maintenance.php:7` |
| `getUnreadNotificationCount`, `getRecentNotifications`, `notificationTypeLabel` | `private/functions/notifications.php` |
| `getAvatarUrl` | `private/functions/media_urls.php:19` |
| site banners renderer | `private/functions/banners.php` + `public/partials/site-banners.php` |

### Surprises / porting notes
- **`pending_applications` badge is dead code:** `getPlatformStats()` never returns that key, so
  the Applications badge never appears. Also the count is *not* fetched via
  `getPendingApplicationsCount()`. Port the intended behaviour OR reproduce exact behaviour —
  decide and document; the AGENTS.md rule says port INTENDED behaviour and note the fix. Intent
  is clearly to show pending instructor applications.
- **Double-escaped flash messages:** `?msg=` values are `htmlspecialchars()`-ed then echoed
  through `htmlspecialchars()` again. Harmless for the generated strings but replicate safely.
- **Throttle side effect of `true`:** all three maintenance functions take `$force=true`, so they
  skip their file-based throttle AND still write the `.cleanup_last_run` / `.purge_last_run` /
  `.token_cleanup_last_run` timestamp files. On serverless these files must be replaced by a
  DB-backed `cron_state`-style record (per AGENTS §9).
- `formatPrice(..., false)` returns a **plain string** (no `<span class="price">`), e.g.
  `Free` for ≤0 or `{CURRENCY_DISPLAY_SYMBOL}{number_format(convertFromINR(price),2)}`.
- **Relative links**: all in-page links are relative (`users.php`, `courses.php?...`,
  `instructor-applications.php`, `enrollments.php`, `reviews.php`, `send-notifications.php`,
  `categories.php?action=create`). The Next port must map these to `/admin/...` routes.
- `strtoupper(substr(...,0,1))` on names: byte-based, not multibyte; replicate.
- Dates use `date('M d, Y')` server-side and `round(x,1)` for ratings.

---

## 8. head.php include mechanism (shared head)

`public/partials/head.php` requires `$pageTitle` (raises `E_USER_ERROR` if empty). Emits, in order:

1. `<meta charset="UTF-8">`
2. `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
3. `<title>{htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8')}</title>`
4. Optional `<meta name="description">` (if `$pageDescription`), optional `<meta name="keywords">`.
5. `<meta name="robots">` — `$pageRobots` if set, else `noindex, nofollow` for `/admin*`, else
   `index, follow`.
6. Optional `<link rel="canonical">` (if `$pageCanonical`).
7. **Open Graph** (all always emitted): `og:title`, `og:description`, `og:image`
   (default `SITE_URL . '/assets/images/og-cover.jpg'`), `og:url`
   (default `SITE_URL . $_SERVER['REQUEST_URI']`), `og:type` (default `website`).
8. **Twitter** (always): `twitter:card` (default `summary_large_image`), `twitter:title`,
   `twitter:description`, `twitter:image`.
9. Fonts (Google Fonts **Inter** weights `300;400;500;600;700;800`):
   - `<link rel="preconnect" href="https://fonts.googleapis.com">`
   - `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
   - `<link rel="preload" as="style" href="…/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">`
   - `<link rel="stylesheet" href="…" media="print" onload="this.media='all'">`
   - `<noscript>` fallback stylesheet link.
10. Favicons/manifest: `favicon.ico`; `favicon-16x16.png`; `favicon-32x32.png`;
    `apple-touch-icon.png` (180); `android-chrome-192x192.png`; `site.webmanifest`. (All under
    `/assets/images/favicon/`.)
11. `<link rel="stylesheet" href="/assets/css/base.css">`
12. `$extraCss` (string or array) → one `<link rel="stylesheet">` per entry.

**Not emitted by head.php:** `navbar.css` (emitted by `navbar.php` at runtime) and the footer's
scoped `<style>` (emitted by `footer.php`). No JS is emitted by head.php — page JS and navbar JS
are inline `<script nonce>` blocks.

Next.js port: implement as a shared `<Head>`/metadata helper + a global CSS import list; use
`next/font` for Inter; copy the favicon files and `site.webmanifest` unchanged; keep `noindex,
nofollow` on this route via `metadata.robots`.

---

## PORT CHECKLIST

- [ ] Route `/admin/dashboard`, server-rendered, Node runtime, admin-only guard (mirror `requireRole(ROLE_ADMIN)`), `noindex, nofollow`.
- [ ] Title `Admin Dashboard — {SITE_NAME}`; no canonical/description/OG overrides.
- [ ] Port `getPlatformStats()` query module with identical output keys/sorting/limits (incl. unused `monthly_revenue`).
- [ ] Decide + document the `pending_applications` badge intent (currently a PHP no-op bug).
- [ ] Render crumbs/links mapped to `/admin/users`, `/admin/categories`, `/admin/courses?status=pending`, `/admin/instructor-applications`, `/admin/enrollments`, `/admin/reviews`, `/admin/send-notifications`.
- [ ] Reproduce the full DOM tree with every `addash-*` class, id-less SVGs (exact viewBox/path), static text and `aria-hidden` attributes.
- [ ] Reproduce the three badges (`addash-badge--danger/warning/info`), pill, stars, empty-state cells.
- [ ] Implement POST handlers `run_cleanup` / `run_purge` / `run_token_cleanup` with CSRF gate (403 + exact message), correct function calls with `force=true`, exact em-dash messages, and PRG redirect to `?msg=`.
- [ ] Reproduce `?msg=` prefix matching (`Cleanup done`, `Purge done`, `Token cleanup`) → correct banner.
- [ ] Port `cleanupStaleDraftDocs`, `purgeRejectedInstructorData`, `cleanupExpiredTokens` behaviours; replace file throttles with DB state (serverless).
- [ ] Client component: `.js-confirm-form` submit `confirm()` guard (no-op `#fontStylesheet` line can be dropped or kept harmlessly).
- [ ] Include navbar (admin variant) + admin maintenance banner + admin-compact footer exactly as PHP.
- [ ] Load `base.css`, `navbar.css`, `dashboard.css` in the same cascade order; import Inter via `next/font`.
- [ ] Run `npm run ui-compare` for this page and record results in `docs\UI_PARITY_REPORT.md`.
