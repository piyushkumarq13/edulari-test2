# Phase 9 — Instructor Applications (Admin) — Reverse-Engineering Spec

Source of truth (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs`
Target: Next.js App Router (TS, strict), Node runtime, no ORM, postgres.js.

Files covered (read fully):

| PHP file | Purpose |
|---|---|
| `public/admin/instructor-applications.php` | Admin list/queue of instructor applications (996 lines) |
| `public/admin/instructor-application-detail.php` | Admin review screen for one application (1081 lines) |
| `public/admin/serve-doc.php` | Admin-only streaming of govt-id / marksheet (46 lines) |
| `private/functions/instructor_registration.php` | `approveInstructorApplication`, `rejectInstructorApplication`, `_deleteInstructorDocs`, `cleanupStaleDraftDocs`, `purgeRejectedInstructorData` (+ save/draft/load helpers) |
| `private/api/test_token.php` | `findAndScoreAbandonedTestTokens` + scoring/expiry logic |
| `private/api/api_config.php` | `TEST_PASS_SCORE = 80`, `TEST_TOKEN_TTL_MINS = 30` |
| `private/email/email_senders.php` | `sendInstructorApprovalEmail`, `sendInstructorRejectionEmail` |
| `private/email/email_templates.php` | `buildInstructorApproval/RejectionEmailHtml/Text` |
| `public/assets/css/admin/instructor-applications.css` | List page CSS (`ia-` prefix, 1264 lines) |
| `public/assets/css/admin/instructor-application-detail.css` | Detail page CSS (`iad-` prefix, 1308 lines) |

Chrome: both pages `include '../navbar.php'` then `include '../footer.php'`. `head.php` loads `/assets/css/base.css` + page `$extraCss`; navbar.css is loaded by `navbar.php` (its `body { padding-top }` offset is why both CSS files blank out `.ad-page-wrap` padding). `$activeNav = 'instructor-applications'` (navbar key matches `Applications` link `/admin/instructor-applications`).

> IMPORTANT — existing Next port overlap (already partly implemented, must reconcile):
> - `app/api/media/route.ts` already handles `type=instructor_doc` (admin-only, `id` + `field` param).
> - `lib/instructor/documents.ts` already owns the `instructor_docs/` B2 prefix.
> - `docs/PROGRESS.md:773` already maps `admin/serve-doc.php` → `app/api/media/route.ts`.
> This spec is for the two admin PAGES + the admin-facing functions; where the port already exists, match its conventions.

---

## 1. Page identity, guard, URL, robots

### 1a. `admin/instructor-applications.php`
- URL (clean): `/admin/instructor-applications` (`.php` stripped by `.htaccess`).
- Guard: `requireRole(ROLE_ADMIN)` at line 15 — MUST be moved so it is the FIRST thing after bootstrap (see Surprise #1).
- Before the guard (line 11–13) the page runs three side-effect jobs: `cleanupStaleDraftDocs()`, `purgeRejectedInstructorData()`, `findAndScoreAbandonedTestTokens()`.
- Title: `'Instructor Applications – ' . SITE_NAME` (head.php escapes it).
- Robots: `noindex, nofollow` (explicitly set on both pages; head.php also auto-noindexes `/admin`).
- Extra CSS: `/assets/css/admin/instructor-applications.css` (authored as `../assets/...`, resolves to `/assets/...`).
- Body class: none. Wrapper: `<main class="ad-page-wrap"><div class="ia-page"><div class="ia-inner">…`.

### 1b. `admin/instructor-application-detail.php`
- URL (clean): `/admin/instructor-application-detail?id=<id>`.
- Guard: `requireRole(ROLE_ADMIN)` at line 10.
- `id = intval($_GET['id'] ?? 0)`; if falsy → `302 Location: instructor-applications.php`.
- If the application row is not found → `302 Location: instructor-applications.php`.
- Title: `'Application #' . $appId . ' — ' . SITE_NAME`.
- Robots: `noindex, nofollow`.
- Extra CSS: `/assets/css/admin/instructor-application-detail.css`.
- Wrapper: `<div class="ad-page-wrap"><main class="iad-page"><div class="iad-inner">…`.

---

## 2. GET params / filters / flash

### List page GET
| Param | Type | Default | Behaviour |
|---|---|---|---|
| `status` | string | `pending` | `all` disables the WHERE status clause; any other value is bound as `ia.status = ?`. Known values: `pending`, `approved`, `rejected`, `test_failed`, `draft`, `all`. |
| `search` | string (trimmed) | `''` | LIKE `%v%` against `u.name` OR `u.email` OR `ia.primary_subject`. |
| `subject` | string (trimmed) | `''` | LIKE `%v%` against `ia.primary_subject`. |
| `education` | string (trimmed) | `''` | exact `ia.highest_education = ?`. Options come from `SELECT DISTINCT highest_education … WHERE highest_education != '' ORDER BY highest_education`. |
| `date_from` | `YYYY-MM-DD` | `''` | `DATE(ia.submitted_at) >= ?`. |
| `date_to` | `YYYY-MM-DD` | `''` | `DATE(ia.submitted_at) <= ?`. |
| `sort` | enum | `submitted_at` | Whitelist `[submitted_at, applicant_name, primary_subject, highest_education, years_exp, status]`, else `submitted_at`. |
| `dir` | `ASC`/`DESC` | `DESC` | uppercased; anything but `ASC` → `DESC`. |
| `page` | int ≥ 1 | `1` | `max(1, intval)`. |
| `per_page` | int | `20` | `max(10, min(100, intval))`. Options offered: 10/20/50/100. |
| `msg` | string | — | flash success text; output via `htmlspecialchars`. |

`$offset = ($page-1)*$perPage`. `$totalPages = max(1, ceil($totalCount/$perPage))`.

`$activeFilters` (the exact query string carried between tabs / search / pagination / sort) = non-empty of: `status, search, subject, education, date_from, date_to`, plus `per_page` only if `!=20`, `sort` only if `!=submitted_at`, `dir` only if `!=DESC`. Tabs/pagination drop `page` before rebuilding.

### Detail page GET
| Param | Type | Notes |
|---|---|---|
| `id` | int | required; otherwise redirect to list. |
| `msg` | string | flash; `htmlspecialchars`. |
| `#overview` / `#credentials` / `#competency` / `#legal` | hash | client restores the tab. |

---

## 3. POST actions (exact fields, values, messages, redirects)

All POST handlers first run `verifyCSRFToken($_POST['csrf_token'] ?? '')`. On failure: `$error = "Invalid request. Please try again."` and the page re-renders (no redirect).

### 3a. List page POST (`instructor-applications.php`)
`$appId = intval($_POST['application_id'] ?? 0)`, `$action = $_POST['action'] ?? ''`.

| `action` | Fields | Message on success | Redirect |
|---|---|---|---|
| `approve` | `csrf_token`, `application_id`, `action=approve` | `"Application approved and instructor notified."` | `header("Location: ?" . http_build_query(array_merge($_GET, ['msg'=>$message])))` (PRG back to list) |
| `reject` | `csrf_token`, `application_id`, `action=reject`, `rejection_reason` (trimmed, optional) | `"Application rejected."` | same PRG |
| `bulk_approve` | `csrf_token`, `action=bulk_approve`, `selected_ids[]` (array of ids) | `"$ok application(s) approved."` (+ `" $fail action(s) failed."` if `$fail>0`) | same PRG |
| `bulk_reject` | `csrf_token`, `action=bulk_reject`, `selected_ids[]`, `bulk_rejection_reason` (trimmed, shared) | `"$ok application(s) rejected."` (+ failures suffix) | same PRG |

Bulk loops ids; skips `id<=0`; calls the same functions; counts ok/fail. On a function error (string) the loop continues and counts a failure — but per-row error strings are NOT surfaced (only the summary).

If `approve`/`reject` returns a string (error, e.g. `"Application not found."`) → `$error = <string>` and the page re-renders.

### 3b. Detail page POST (`instructor-application-detail.php`)
| `action` | Fields | Message | Redirect |
|---|---|---|---|
| `approve` | `csrf_token`, `action=approve` (no `application_id`; id is from GET) | `"Application approved successfully. The instructor has been notified by email."`, `$msgType='success'` | PRG `?<GET>+msg` |
| `reject` | `csrf_token`, `action=reject`, `rejection_reason` (trimmed, optional, `maxlength=1000` client-side) | `"Application rejected. The applicant has been notified."`, `$msgType='danger'` | PRG `?<GET>+msg` |

There is NO re-open / undo handler despite the comment `"— Approve / Reject / Re-open —"`. Only `approve` and `reject` exist.

### 3c. What `approveInstructorApplication($id)` does end-to-end (`instructor_registration.php:141`)
1. `SELECT ia.*, u.email, u.name FROM instructor_applications ia JOIN users u ON ia.user_id=u.id WHERE ia.id=?` → if none, return `"Application not found."`.
2. `UPDATE users SET is_active = 1 WHERE id = <user_id>`.
   - **Does NOT change `users.role`.** The applicant was already created with `role = ROLE_INSTRUCTOR` during registration; approval only flips `is_active`.
   - **Does NOT reset `block_reason` / `block_note`.**
3. `UPDATE instructor_applications SET status='approved', reviewed_at=NOW() WHERE id=?`.
4. `_deleteInstructorDocs($app)` → deletes both doc files from disk and sets `govt_id_file=NULL, marksheet_file=NULL`.
5. `sendInstructorApprovalEmail($app['email'], $app['name'])` → SMTP send + in-app notification.
6. Returns `true`. No session mutation, no admin-session side effects.

### 3d. What `rejectInstructorApplication($id, $reason)` does (`instructor_registration.php:177`)
1. `SELECT ia.*, u.email, u.name, u.id AS user_id …` → if none, `"Application not found."`.
2. `UPDATE users SET is_active = 0, block_reason = 'application_rejected' WHERE id = <user_id>`.
   - `block_note` untouched; `role` untouched (stays `instructor`).
3. `UPDATE instructor_applications SET status='rejected', rejection_reason=?, reviewed_at=NOW() WHERE id=?` — reason stored in `instructor_applications.rejection_reason` (may be `''`).
4. `_deleteInstructorDocs($app)`.
5. `sendInstructorRejectionEmail($app['email'], $app['name'], $reason)` → SMTP + in-app notification.
6. Returns `true`.

### 3e. `_deleteInstructorDocs(array $app)` (`:212`)
For each of `govt_id_file`, `marksheet_file`: if non-empty, `basename()` it, unlink `PRIVATE_PATH . '/uploads/instructor_docs/' . basename` if present (`@unlink`). Then `UPDATE instructor_applications SET govt_id_file=NULL, marksheet_file=NULL WHERE id=?`. In the Next port: delete the B2 objects and NULL both columns.

### 3f. `cleanupStaleDraftDocs(bool $force=false)` (`:503`)
- Throttle file `PRIVATE_PATH/.cleanup_last_run`; skips if run `< 18000s` ago (comment says 24h — actual is 5h; **throttle value is the truth**). In Next: `cron_state` table (`cron_state` key `instructor_doc_cleanup`).
- Selects apps `status IN ('draft','test_failed') AND (govt_id_file IS NOT NULL OR marksheet_file IS NOT NULL) AND updated_at < NOW() - INTERVAL 15 DAY`.
- Calls `_deleteInstructorDocs` per row; returns count.

### 3g. `purgeRejectedInstructorData(bool $force=false)` (`:552`)
- Throttle `PRIVATE_PATH/.purge_last_run`, `< 18000s` (5h).
- Targets: `status IN ('rejected','test_failed')` OR (`status='draft' AND updated_at < NOW()-15 DAY`).
- Per target: `_deleteInstructorDocs` → `DELETE FROM instructor_profiles WHERE user_id=?` → `DELETE FROM instructor_applications WHERE user_id=?` → `UPDATE users SET role='student', is_active=1, block_reason=NULL, block_note=NULL WHERE id=?` (keeps id/email/name/password/email_verified).
- **Consequence:** rejected/test_failed applications and profiles are destroyed and the user silently becomes an active student. Because `email_verified=1` remains, the existing Step-1 email check blocks them from re-registering as instructor. This runs *before* `requireRole` on every list-page load (throttled).

### 3h. `findAndScoreAbandonedTestTokens()` (`test_token.php:253`)
- Selects `test_tokens WHERE used=0 AND started_at IS NOT NULL AND NOW()>expires_at`.
- For each: recompute score from `questions_data`/`answers_data`; time = `TIMESTAMPDIFF(SECOND, started_at, NOW())`; atomically `consumeTestToken` (skip if already consumed); delete+insert a `test_failures` row (`context = on_pass_action`, `retry_after NOW()+7 DAY`); upsert `instructor_applications` (`status='test_failed'`, `test_score`, `test_time_taken_seconds`, `updated_at`) — insert with `submitted_at=NOW()` if no row; `deleteTestToken`.
- Called lazily from the list page (before guard) each load.

---

## 4. Full application field inventory

### `instructor_applications` (aliased `ia.*` on detail; subset on list)
`id`, `user_id`, `status` (`pending`/`approved`/`rejected`/`test_failed`/`draft`), `primary_subject`, `secondary_subjects`, `skill_level`, `target_audience`, `course_ideas`, `sample_content_url`, `highest_education`, `institution`, `field_of_study`, `graduation_year`, `certifications`, `professional_exp`, `notable_works`, `full_legal_name`, `pan_number`, `bank_account`, `ifsc_code`, `account_holder`, `upi_id`, `revenue_share_ack`, `terms_agreed`, `content_policy`, `govt_id_file`, `marksheet_file`, `test_score`, `test_time_taken_seconds`, `rejection_reason`, `submitted_at`, `reviewed_at`, `last_completed_step`, `updated_at` (+ `created_at` if present in schema).

### `instructor_profiles` (LEFT JOIN on `user_id`)
`headline`, `bio`, `website`, `linkedin_url`, `twitter_url`, `years_exp`, `teaching_style`.

### `users`
`name` (→ `applicant_name`), `email` (→ `applicant_email`), `role`, `is_active`, `email_verified`, `registration_date`, `profile_image` (list only), `block_reason`, `block_note`.

### Derived / computed
- `initials`, avatar color, `expLabel`, `human_time_diff`, `testPassed = test_score >= TEST_PASS_SCORE (80)`, `allPoliciesAgreed = revenue_share_ack && terms_agreed && content_policy`.

### Sensitive encrypted fields (at-rest AES-256-GCM in the port)
Displayed on the **Legal & Financial** tab, decrypted server-side before render:
- `full_legal_name` — plain text.
- `pan_number` — **masked**: `str_repeat('•', max(0, strlen-4)) . substr(-4)`; `data-full` holds the real value; "Show" button toggles.
- `bank_account` — **masked** same pattern; reveal button only shown if non-empty.
- `ifsc_code` — plain text.
- `upi_id` — plain text.
- `account_holder` — plain text.

**NOT displayed anywhere on these admin pages:** `bank_name`, `skip_payout`. Note: `step-5.php` collects `bank_name` and `skip_payout` into `$_SESSION['…']['legal']`, but `saveInstructorApplication`/`saveInstructorDraft` **do not persist them** (no mapping in `$appData`). Port decision required: if the columns exist, persist + display consistently; if not, this is a PHP gap to record in PROGRESS (do not silently invent UI).

---

## 5. Document serving

### PHP `admin/serve-doc.php`
- Guard: `requireRole(ROLE_ADMIN)`.
- `$requestedFile = basename($_GET['file'] ?? '')`, `$appId = intval($_GET['app'] ?? 0)`.
- Missing either → `400 "Invalid request."`.
- Anti-enumeration: `SELECT govt_id_file, marksheet_file FROM instructor_applications WHERE id=?`; if row missing OR `$requestedFile` not strictly in `[govt_id_file, marksheet_file]` → `403 "Access denied."`.
- Path `PRIVATE_PATH . '/uploads/instructor_docs/' . $requestedFile`; missing → `404 "File not found."`.
- MIME map: `jpg/jpeg→image/jpeg`, `png→image/png`, `webp→image/webp`, `pdf→application/pdf`, else `application/octet-stream`.
- Headers: `Content-Type`, `Content-Disposition: inline; filename="<requestedFile>"`, `X-Content-Type-Options: nosniff`, `Content-Length: filesize`. Then `readfile`.
- No CSRF (safe GET), no Range support, no caching header, filename echoed unescaped in the header (safe because `basename`).

### Next port (already present)
`GET /api/media?type=instructor_doc&id=<appId>&field=govt_id_file|marksheet_file`, Node runtime, admin-only; picks the column, streams from B2 private bucket with `Content-Disposition: inline; filename=<key basename>`, `Cache-Control: private, max-age=3600`, `Accept-Ranges`. Detail page must emit these links (mapping below) instead of `serve-doc.php`. Keep the anti-enumeration spirit: field is whitelisted to the two columns; admin gate preserved.

Detail-page doc links (PHP → Next):
- Govt ID: `/admin/serve-doc.php?file=<urlencode(govt_id_file)>&app=<id>` → `/api/media?type=instructor_doc&id=<id>&field=govt_id_file`, `target="_blank" rel="noopener"`.
- Marksheet: same with `field=marksheet_file`.

---

## 6. Validations & security checks

- **CSRF:** `verifyCSRFToken()` on every POST (list + detail + bulk). Redirect never happens on CSRF failure.
- **Role:** `requireRole(ROLE_ADMIN)` on every page/route; `serve-doc`/media also admin-only.
- **Anti-enumeration:** filename must equal the app's own doc column (section 5).
- **SQL:** all filters/ids parameterized; only the whitelisted `sort` column and `ASC|DESC` are interpolated.
- **Reason length:** **no server-side limit.** Detail textarea `maxlength="1000"`; list reject textarea has no maxlength; `rejection_reason` DB column length governs truncation. Port should add zod `.max(1000)` on the detail path (and pick a limit for the list) — note as an intentional hardening.
- **Output:** all user data goes through `htmlspecialchars`; long text uses `nl2br(htmlspecialchars(...))` (bio, course_ideas, certifications, notable_works).
- **PRG:** both pages redirect after successful POST.
- **Sensitive masking:** PAN/account masked server-side; reveal is client-side from `data-full` (full value is in the DOM regardless of mask — same as PHP; acceptable because page is admin-only).
- **Surprise #1 (fix in port):** on the list page the three maintenance jobs run at lines 11–13 **before** `requireRole` — an unauthenticated visitor triggers them. The port must run guards first, then throttled jobs (ideally as cron; lazy-run only for admins).
- **Surprise #2:** reject is effectively temporary — `purgeRejectedInstructorData` deletes rejected rows/profiles within one throttle window of any list-page load and converts the user back to `student`, clearing `block_reason`. Both behaviours must be reproduced (or deliberately re-scoped) and documented.

---

## 7. Emails + in-app notifications

Senders (`email_senders.php`), all fire-and-forget (errors only logged).

### `sendInstructorApprovalEmail(email, name)` — `:161`
- `addAddress($email,$name)`, HTML.
- **Subject:** `🎉 Your Instructor Application has been Approved – ` + `SITE_NAME`.
- Body `buildInstructorApprovalEmailHtml(name)` — badge "✅ APPLICATION APPROVED", heading "Congratulations, {firstName}!", subtitle "You're now an approved instructor on {SITE_NAME}", paragraph, feature list (create course / build students / earn revenue / track performance), button to `SITE_URL/login` "Log In & Start Teaching →", notice, shell subject "Great news — your instructor application on {SITE_NAME} has been approved!".
- AltBody `buildInstructorApprovalEmailText(name)`.
- In-app: `SELECT id FROM users WHERE email=? LIMIT 1` → `createNotification(user_id, 'instructor_approved', 'Your Instructor Application has been Approved! 🎉', "Hi {name},\n\nCongratulations! Your instructor application has been reviewed and approved. You can now create and publish courses on {SITE_NAME}.\n\nHead to your instructor dashboard to get started.")`.

### `sendInstructorRejectionEmail(email, name, reason='')` — `:195`
- **Subject:** `Update on Your Instructor Application – ` + `SITE_NAME`.
- Body `buildInstructorRejectionEmailHtml(name, reason)` — badge "ℹ️ APPLICATION UPDATE", heading "Update on your application", subtitle, paragraphs; if reason non-empty a "📝 Feedback from our review team:" block with escaped reason; feature list (certifications / sample content / portfolio); contact notice with `ADMIN_EMAIL`.
- AltBody `buildInstructorRejectionEmailText(name, reason)` (includes `Feedback: {reason}` when present).
- In-app: `createNotification(user_id, 'instructor_rejected', 'Update on Your Instructor Application', "Hi {name},\n\nThank you for applying to become an instructor on {SITE_NAME}. After reviewing your application, we are unable to approve it at this time." [+ "\n\nReason: {reason}"] + "\n\nYou are welcome to reapply in the future.")`.

`createNotification(int $userId, string $type, string $title, string $body)` from `private/functions/notifications.php:85`.

---

## 8. HTML DOM structure (for parity)

### List page (`ia-` prefix)
```
main.ad-page-wrap > div.ia-page > div.ia-inner
  div.ia-page-header
    div > h1.ia-page-title (svg check + "Instructor Applications") + p.ia-page-subtitle
    div.ia-header-stats > 3× div.ia-stat-chip.ia-stat-{pending|approved|rejected} > span.ia-stat-num + span.ia-stat-lbl
  div.ia-alert.ia-alert-success|error (conditional) > svg + text + button.ia-alert-close
  div.ia-tabs[role=tablist]
    a.ia-tab(.ia-tab--active)[role=tab][aria-selected] > label + span.ia-tab-count   (4 tabs: all/pending/approved/rejected)
  div.ia-filters-wrap
    form#filtersForm.ia-filters-form[method=get]
      input[type=hidden][name=status]
      div.ia-search-group > svg.ia-search-icon + input.ia-search-input[name=search] + (button.ia-search-clear.js-search-clear)
      button.ia-btn.ia-btn-outline.ia-filter-toggle#filterToggle[aria-expanded] > svg + "Filters" + (span.ia-filter-badge)
      button[type=submit].ia-btn.ia-btn-primary > svg + "Search"
    div.ia-adv-filters#advFilters[style display:grid when active]
      form.ia-adv-form[method=get]
        hidden status (+hidden search)
        div.ia-adv-field > label.ia-label + input#subjectFilter.ia-input[name=subject]
        div.ia-adv-field > label + select#educFilter.ia-input[name=education] (All Levels + distinct)
        div.ia-adv-field > label + input#dateFrom.ia-input[type=date][name=date_from]
        div.ia-adv-field > label + input#dateTo.ia-input[type=date][name=date_to]
        div.ia-adv-field.ia-adv-field--actions > button[submit].ia-btn-primary "Apply" + a.ia-btn-ghost "Reset"
  div.ia-bulk-bar#bulkBar[aria-hidden]                    (slides open when rows checked)
    span.ia-bulk-info > span#bulkCount + " application(s) selected"
    div.ia-bulk-actions
      form#bulkApproveForm[method=post] (csrf, action=bulk_approve, div#bulkApproveIds) + button.ia-btn.ia-btn-success.ia-btn-sm.js-bulk-approve "✓ Approve Selected"
      button.ia-btn.ia-btn-danger.ia-btn-sm.js-bulk-reject "✕ Reject Selected"
      button.ia-btn.ia-btn-ghost.ia-btn-sm.js-clear-selection "Cancel"
  div.ia-card
    div.ia-table-toolbar > div.ia-results-info ("Showing X–Y of N applications" / "No applications found") + div.ia-toolbar-right > label.ia-per-page-label + select#perPageSelect.ia-per-page-select
    (empty) div.ia-empty > div.ia-empty-icon(svg) + h3.ia-empty-title + p.ia-empty-desc + optional a.ia-btn-outline "Clear Filters"
    (rows) div.ia-table-wrap > table.ia-table#applicationsTable
      thead > tr > th.ia-th-check(input#selectAll.ia-checkbox) / th.ia-th-id "#" / th sort links (Applicant, Subject, Education, Experience, Submitted, Status — each a.ia-sort-link + sort svg) / th.ia-th-actions "Actions"
      tbody > tr.ia-row[data-id][data-status]
        td.ia-td-check > (pending only) input.ia-checkbox.ia-row-check[value=id]
        td.ia-td-id
        td.ia-td-applicant > div.ia-applicant > div.ia-avatar[style background] +(img|initials) + div.ia-applicant-info > span.ia-applicant-name + span.ia-applicant-email + (!verified) span.ia-badge.ia-badge-xs.ia-badge-orange "⚠ Unverified"
        td.ia-td-subject > span.ia-subject-name + (span.ia-subject-level)
        td.ia-td-education
        td.ia-td-exp > span.ia-exp-badge
        td.ia-td-date > span.ia-date-primary (d M Y) + span.ia-date-secondary (timeAgo)
        td.ia-td-status > span.ia-badge.badge-{warning|success|danger} (ucfirst status) + (rejected+reason) button.ia-reason-btn.js-reason-btn[data-reason]
        td.ia-td-actions > div.ia-actions
           a.ia-btn-outline.ia-btn-sm "View" (→ instructor-application-detail?id=)
           (pending) form.ia-inline-form[data-confirm-action=approve][data-confirm-name] (csrf, application_id, action=approve) button.ia-btn-success.ia-btn-sm "Approve"
                     button.ia-btn-danger.ia-btn-sm.js-reject-btn[data-app-id][data-app-name] "Reject"
           (approved) a.ia-btn-ghost.ia-btn-sm "Profile" (→ users?id=user_id)
    (mobile) div.ia-mobile-list#mobileList > div.ia-mobile-card
       header: ia-applicant (avatar sm + name/email) + span.ia-badge
       body: div.ia-mobile-meta (Subject/Education/Submitted)
       footer: a.ia-btn-outline "View" + (pending) form approve + button.js-reject-btn
  nav.ia-pagination (when totalPages>1): prev arrow / numbered page btns (.ia-page-btn--active / .ia-page-btn--disabled) / ellipsis.ia-page-ellipsis / next arrow
MODALS (always in DOM):
  div.ia-modal-overlay#rejectModal (form#rejectForm: csrf, application_id#rejectAppId, action=reject, textarea#rejectReason[name=rejection_reason])
  div.ia-modal-overlay#bulkRejectModal (form#bulkRejectForm: csrf, action=bulk_reject, div#bulkRejectIds, textarea#bulkRejectReason[name=bulk_rejection_reason])
  div.ia-modal-overlay#reasonModal (.ia-modal--sm, p#reasonText)
include footer.php
```

### Detail page (`iad-` prefix)
```
include navbar.php
div.ad-page-wrap > main.iad-page > div.iad-inner
  div.iad-topbar
    div.iad-topbar-left > a.iad-back-btn "Back to Applications" + div.iad-breadcrumb (Applications > #id)
    div.iad-app-nav[role=navigation] > (prev a.iad-app-nav-btn) span.iad-app-nav-pos (pos/total) (next a.iad-app-nav-btn)
  div.iad-page-head > div.iad-page-head-left (h1.iad-page-title svg + "Application #id"; p.iad-page-subtitle "Submitted {date}" + span.iad-time-chip) + span.iad-badge.iad-badge--{warning|success|danger} "{icon} {label}"
  div.iad-alert#iadAlert (success/danger; button.iad-alert-close.js-dismiss-alert)
  div.iad-layout  (grid 300px + 1fr)
    aside.iad-sidebar
      div.iad-card.iad-profile-card
        div.iad-profile-head: div.iad-avatar (initials), h2.iad-profile-name, p.iad-profile-email, (p.iad-profile-headline), div.iad-social-row (a.iad-social-btn Website / --linkedin LinkedIn / --twitter Twitter)
        div.iad-card-body > dl.iad-meta-list rows: Email Verified (pill), Account Status (pill), Registered, Submitted, (Reviewed), Experience, (Teaching Style)
      (if test_score !== null) div.iad-card.iad-score-card--pass|fail
        header "Competency Test Score"
        body.iad-score-body > div.iad-score-circle (svg.iad-score-ring two circles, dashoffset=round(207.3*(1-score/100)), rotate(-90 40 40)) + div.iad-score-inner (.iad-score-num + .iad-score-pct)
          p.iad-score-verdict--pass "✓ Passed" | --fail "✗ Below Pass Mark"
          p.iad-score-threshold "Pass mark: 80%"
      (if docs) div.iad-card "Verification Documents"
        div.iad-sensitive-banner "Sensitive — handle with care. Deleted after decision."
        div.iad-doc-btns > a.iad-doc-btn "Government ID" … + a.iad-doc-btn "Marksheet / Degree" …
      div.iad-card.iad-decision-card.iad-decision-card--{status} "Admin Decision"
        (pending) p.iad-decision-hint; form#approveForm (csrf, action=approve) button.iad-btn--success.iad-btn--full[data-modal=approveModal] "Approve Application"
                  div.iad-reject-wrap#rejectWrap > button#rejectToggle.iad-reject-toggle.iad-btn--outline-danger[aria-expanded] "Reject Application"
                        div.iad-reject-panel#rejectPanel[hidden] > form#rejectForm (csrf, action=reject) label.iad-form-label + textarea#rejectReason[name=rejection_reason][maxlength=1000] + div.iad-char-count span#rejectCharCount "/1000" + div.iad-form-row (button[data-toggle-reject] "Cancel", button[data-modal=rejectModal].iad-btn--danger "Confirm Rejection")
        (approved) div.iad-status-display--approved (✅ + "Application Approved" + "Reviewed on …") + a.iad-btn--outline.iad-btn--full "View User Profile →" (→ users?search=email)
        (rejected) div.iad-status-display--rejected (❌ + "Application Rejected" + reviewed) + (reason) div.iad-rejection-reason p+blockquote.iad-text-block | p.iad-empty-note "No rejection reason was provided."
    div.iad-content[role=main]
      div.iad-tabs[role=tablist] 4× button.iad-tab[data-tab=overview|credentials|competency|legal]
      div#tab-overview.iad-tab-panel--active
        div.iad-quick-stats 4× div.iad-qstat (icon+val+lbl): Experience, Test Score (N/A if null), Policies (All Signed/Incomplete), Email (Verified/Unverified)
        (bio) iad-card "Professional Bio" blockquote (nl2br)
        (course_ideas) iad-card "Course Plans & Ideas" blockquote
        iad-card "Application Timeline" ol.iad-timeline (Account Registered / Application Submitted / Admin Review / Decision) with dot state classes
      div#tab-credentials.iad-tab-panel[hidden]
        "Education & Qualifications" info-grid: Highest Education, Field of Study, Institution, Graduation Year
        (certifications) card; "Professional Experience" card; (notable_works) card
      div#tab-competency.iad-tab-panel[hidden]
        "Subject Matter Details" info-grid: Primary Subject, Skill Level Taught, (Secondary Subjects full), Target Audience full
        (sample_content_url) "Sample Content" card with a.iad-sample-link
        (test_score!==null) "Competency Test Result" card: div.iad-score-bar-wrap (labels, div.iad-score-bar[role=progressbar] > div.iad-score-bar-fill--pass|fail[style width] + div.iad-score-bar-marker[style left=80%], p.iad-score-result--pass|fail)
      div#tab-legal.iad-tab-panel[hidden]
        div.iad-sensitive-banner--lg "Sensitive Information"
        iad-card "Identity Details": Full Legal Name, PAN Number (masked)
        iad-card "Bank & Payment Details": Account Holder, Bank Account Number (masked), IFSC Code, UPI ID
        iad-card "Policy Agreements": ul.iad-policy-list 3× li.iad-policy-item--agreed|missing (icon/text/status) + (if !all) div.iad-policy-warning
MODALS (hidden):
  div.iad-modal-overlay#approveModal (.iad-modal--success) "Approve Application?" body + Cancel + button[data-submit-form=approveForm] "Yes, Approve"
  div.iad-modal-overlay#rejectModal (.iad-modal--danger) "Reject Application?" body + Cancel + button[data-submit-form=rejectForm] "Yes, Reject"
include footer.php
```

Exact static text to preserve (non-exhaustive): page subtitles, empty-state copy ("No applications found", "Try adjusting your search or filter criteria.", "There are no {status} applications at the moment.", "Clear Filters"), bulk bar ("N application(s) selected", "✓ Approve Selected", "✕ Reject Selected", "Cancel"), modal titles/bodies/hints ("Provide a rejection reason (optional). The applicant will be notified by email.", "Leave blank to reject without a reason message.", "Rejection Reason (applied to all)", "Optional shared reason…", "Reject All Selected", "(No reason provided)"), decision hint, sensitive banners, policy labels, timeline labels, score verdict strings, "View User Profile →", "Back to Applications".

---

## 9. Inline `<script>` (both pages, `<script nonce="<?= CSP_NONCE ?>">`)

### List page
- Dismiss `.ia-alert-close` (remove closest `.ia-alert`).
- Advanced filter toggle `#filterToggle`/`#advFilters` (grid↔none, `aria-expanded`, `--active`; auto-open when any adv filter active via PHP `json_encode`).
- `changePerPage(val)` sets `per_page`, resets `page=1`, navigates.
- Selection helpers `getChecked()`, `updateBulkBar()`, `clearSelection()`; `#selectAll` toggles all `.ia-row-check`; per-row change recomputes indeterminate/all-checked.
- `submitBulk(action)` confirm → inject `selected_ids[]` hidden inputs into `#bulkApproveForm`, set action `bulk_approve`/`bulk_reject`, submit.
- `openBulkRejectModal()`, `openRejectModal(appId,name)`, `showReasonModal(reason)`, modal open/close helpers, backdrop click + Escape close, `confirmAction(type,name)`, 5s alert auto-dismiss, clickable `.ia-row` → detail page, `#perPageSelect` change, `.js-search-clear` submits, `.js-bulk-*`, `[data-confirm-action]` submit guard, `.js-reason-btn`, `.js-reject-btn`, `[data-close-modal]`.
- `#fontStylesheet` load event sets `media='all'` (font swap).

### Detail page
- `switchTab(btn, tabKey)` toggles `.iad-tab`/`.iad-tab-panel`, `history.replaceState('#…')`.
- Hash restore IIFE for `['overview','credentials','competency','legal']`.
- `toggleRejectPanel()`, reject char counter (`#rejectReason` → `#rejectCharCount`).
- `openModal(id)`/`closeModal(id)`, backdrop + Escape close, `toggleMask(btn)` reveal/hide from `data-full`, 6s alert auto-dismiss, delegated click handler (`.js-dismiss-alert`, `.js-reveal-btn`, `.iad-tab`), `[data-modal]`, `[data-close-modal]`, `[data-submit-form]`, `#rejectToggle`, `[data-toggle-reject]`, `#fontStylesheet` load.
- Port as client components/hooks; note `nonce` and the `#fontStylesheet` lookup.

---

## 10. Test-score display logic

- `TEST_PASS_SCORE = 80` (`private/api/api_config.php:63`); `TEST_TOKEN_TTL_MINS = 30`.
- Constant lives in `api_config.php`; the port has `lib/instructor/test-constants.ts` — reuse it. Env-ise only if the value is configurable (it is a hardcoded define; keep 80 unless a settings row exists).
- `$testScore = isset($app['test_score']) ? (int)$app['test_score'] : null;` → NULL column ⇒ `null` ⇒ all score cards/bars hidden. `0` ⇒ shown as `0%`.
- `$testPassed = $testScore !== null && $testScore >= 80`.
- Badges/colours: pass → green (`--iad-success`), fail → red (`--iad-danger`); ring offset `round(207.3 * (1 - score/100))`; competency bar width = `score%`, marker at `left: 80%`; verdict text "✓ Passed" vs "✗ Below Pass Mark"; result "✓ Passed — meets minimum competency requirement" vs "✗ Did not meet the minimum score of 80%"; quick-stat Test Score shows `"{score}%"` or `"N/A"`.

---

## PORT CHECKLIST

- [ ] `app/(admin)/admin/instructor-applications/page.tsx` — server component; guard admin FIRST, then lazily run the three maintenance jobs (throttled via `cron_state`); render full DOM parity with `ia-` classes.
- [ ] `app/(admin)/admin/instructor-application-detail/page.tsx` (or `[id]`) — guard admin; full `iad-` DOM parity; server-select `ia.*` + user + profile.
- [ ] Import both CSS files verbatim into `styles/`/per-page, cascade after `base.css` + `navbar.css`; keep `$activeNav` navbar state.
- [ ] Server actions (or `app/api/admin/instructor-applications/*` routes) for `approve`, `reject`, `bulk_approve`, `bulk_reject` with zod + CSRF + admin guard + PRG.
- [ ] Port `approveInstructorApplication` exactly: `users.is_active=1` (do NOT touch role/block_reason), `status='approved'`, `reviewed_at=now()`, delete docs, email + notification.
- [ ] Port `rejectInstructorApplication` exactly: `users.is_active=0, block_reason='application_rejected'` (block_note untouched), `status='rejected'`, `rejection_reason`, `reviewed_at`, delete docs, email + notification.
- [ ] Port `_deleteInstructorDocs` → B2 delete + NULL both columns.
- [ ] Port `cleanupStaleDraftDocs` (15-day draft/test_failed docs) and `purgeRejectedInstructorData` (delete app+profile, user→student, clear block) with 5h throttle in `cron_state`; also wire `app/api/cron/*` equivalents.
- [ ] Port `findAndScoreAbandonedTestTokens` (expired started tokens → test_failed + 7-day `test_failures`).
- [ ] Emails: exact subjects, HTML/Text builders, senders, and in-app notifications (`instructor_approved`, `instructor_rejected`).
- [ ] Document serving via existing `app/api/media?type=instructor_doc` (admin-only, `field` whitelist); detail page links swapped to it.
- [ ] Decrypt sensitive fields only in this admin screen; mask PAN/bank server-side; expose full value in `data-full` for reveal; keep AES-256-GCM at rest.
- [ ] Reproduce all GET filters/sort/pagination, counts, tabs, bulk bar, modals, and every inline script behaviour (tabs, reveal, char counter, modal open/close, auto-dismiss, row click, per-page, select-all).
- [ ] Add zod `max(1000)` (or agreed limit) on reject reason (hardening over PHP).
- [ ] Write the decisions/gaps (jobs-before-guard, purge of rejected data, `bank_name`/`skip_payout` non-persistence, no server reason limit) into `docs/PROGRESS.md` and `docs/feature-matrix.md`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` clean; run `npm run ui-compare` + structural pre-checks for both pages and record in `docs/UI_PARITY_REPORT.md`.
