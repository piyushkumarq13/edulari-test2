# Phase 9 — Admin System Settings (`public/admin/settings.php`) → Next.js Port Spec

Source of truth (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\settings.php`
(1,434 lines / 85,330 bytes).
Read fully for this spec:
- `private/functions/admin.php` — `saveSettings()` (line 919) and `saveApiSettings()` (line 1022),
  plus `getSystemSettings()` (line 538).
- `private/functions/maintenance.php` — `getMaintenanceStatus()`, `setMaintenanceStatus()`,
  `disableMaintenance()`, `logMaintenanceEvent()`, `getPageCategory()`, `checkMaintenanceMode()`.
- `private/config.php` (setting NAMES/purposes only), `private/api/api_config.php`,
  `private/secrets.php` (NAMES only — no real values are recorded anywhere in this file).
- `private/email/email_senders.php` `sendPasswordChangedNotificationEmail()` (line 277) and
  `private/email/email_templates.php` `buildPasswordChangedNotificationHtml/Text()` (669/697).
- `public/assets/css/admin/settings.css` (1,102 lines).
- Supporting: `public/partials/head.php`, `public/navbar.php`, `public/footer.php`,
  `public/partials/admin-maintenance-banner.php`, `public/.htaccess`, `private/bootstrap.php`.

Target route (Next App Router): `/admin/settings` (server component for the shell + Node runtime;
client components for the tabs/forms). Legacy `/admin/settings.php` must 301 to `/admin/settings`
(htaccess parity, already covered by the generic `*.php` → clean-URL rule).

> SECURITY NOTE: every real secret value in `secrets.php` / `config.php` / `api_config.php` is
> intentionally NOT copied here. Only names/purposes appear, as placeholders.

---

## 1. Purpose, URL, guard, title, robots, sections

- **Purpose:** Single admin control panel to view/edit platform settings (site name/url/email,
  timezone, display currency), SMTP/email, security (bcrypt cost, session lifetime), database
  health, live system info, admin account password, maintenance mode, and AI/payment API keys.
- **URL:** `/admin/settings` (PHP file `public/admin/settings.php`). All in-page links/relative
  assets resolve under `/admin/`.
- **Requires (top of file, in order):** `private/bootstrap.php`, `private/config.php`,
  `private/db.php`, `private/auth.php`, `private/functions/admin.php`, `private/api/api_config.php`.
- **Access guard:** `requireRole(ROLE_ADMIN);` (admin only; guest/instructor/student denied before
  any HTML output).
- **Page context:** `$user = getCurrentUser();` `$csrfToken = generateCSRFToken();`
  `$activeNav = 'settings';`
- **Page title:** `'System Settings — ' . htmlspecialchars(SITE_NAME) . ' Admin'` →
  `System Settings — {SITE_NAME} Admin` (em-dash U+2014).
- **Robots meta:** explicitly `$pageRobots = 'noindex, nofollow';` (head.php also auto-sets it for
  any `/admin` path).
- **extraCss:** `'../assets/css/admin/settings.css'` (string). Depends on `navbar.css` (which
  declares `--ad-nav-height` and `.ad-page-wrap`) being loaded first by `navbar.php`.
- **Body shell:** `<body>` → `<?php include navbar.php ?>` → `<main class="ad-page-wrap">` →
  `<div class="sts-page">` → … → `<?php include footer.php ?>`.

### Tabs / sections (7)
Sidebar `.sts-tabs[role=tablist]` with buttons `.sts-tab[role=tab][data-tab][aria-controls]`:

| # | `data-tab` | label | panel id | icon (feather) |
|---|---|---|---|---|
| 1 | `general` | General | `sts-panel-general` | info circle |
| 2 | `smtp` | SMTP / Email | `sts-panel-smtp` | mail |
| 3 | `security` | Security | `sts-panel-security` | shield |
| 4 | `database` | Database | `sts-panel-database` | database |
| 5 | `system` | System Info | `sts-panel-system` | monitor |
| 6 | `password` | Change Password | `sts-panel-password` | lock |
| 7 | `api` | API Keys | `sts-panel-api` | code |

`general` starts `.sts-tab--active` + `aria-selected="true"`; its panel starts
`.sts-panel--active`. All other tabs `aria-selected="false"` and panels hidden.

---

## 2. Every setting field, grouped by section

Legend: **secret?** = must be write-only, never echoed. **max** = `maxlength` attribute in HTML
and/or the `$fieldLimits` server cap.

### 2.1 General Settings (`#stsGeneralForm`)
| HTML name | label | type | current source (PHP) | max | secret |
|---|---|---|---|---|---|
| `site_name` | Site Name * | text (`#siteName`) | `SITE_NAME` | 100 | no |
| `site_url` | Site URL * | url (`#siteUrl`) | `SITE_URL` | 255 | no |
| `admin_email` | Admin Email * | email (`#adminEmail`) | `ADMIN_EMAIL` | 254 | no |
| `timezone` | Server Timezone | select (`#timezone`) | `date_default_timezone_get()`; options = `DateTimeZone::listIdentifiers()` | 60 | no |
| `currency_code` | Display Currency | select (`#currencyCode`) | `CURRENCY_CODE` | 10 | no |

- Currency options (value → label, exactly):
  `INR => "₹ INR — Indian Rupee"`, `USD => "$ USD — US Dollar"`, `EUR => "€ EUR — Euro"`,
  `GBP => "£ GBP — British Pound"`, `JPY => "¥ JPY — Japanese Yen"`,
  `AUD => "A$ AUD — Australian Dollar"`, `CAD => "C$ CAD — Canadian Dollar"`,
  `SGD => "S$ SGD — Singapore Dollar"`, `AED => "AED — UAE Dirham"`.
- Hints: site name → "Displayed in emails, page titles and the navbar."; site url → "Must include
  https://"; currency → "Controls how all prices are displayed across the site."
- Button: `.sts-btn--primary` "Save Settings" (floppy icon).

### 2.2 SMTP / Email Configuration (`#stsSmtpForm`)
| name | label | type | source | max | secret |
|---|---|---|---|---|---|
| `smtp_host` | SMTP Host | text (`#smtpHost`) | `SMTP_HOST` | 253 | no |
| `smtp_port` | SMTP Port | number (`#smtpPort`, min 1 max 65535) | `SMTP_PORT` | — | no |
| `smtp_username` | SMTP Username | text (`#smtpUsername`, autocomplete off) | `SMTP_USERNAME` | 254 | no |
| `smtp_password` | SMTP Password | password (`#smtpPassword`, autocomplete off) | `SMTP_PASSWORD` (**write-only**) | 500 | **YES** |
| `test_email` | Send Test Email To | email (`#testEmail`, placeholder `test@example.com`) | — | — | no |

- Password placeholder: `"Already configured — leave blank to keep"` if `SMTP_PASSWORD` non-empty,
  else `"No password set"`. `value=""` always (secret never echoed).
- Port hint: `587 = TLS  |  465 = SSL  |  25 = plain` (uses `&nbsp;|&nbsp;` separators).
- Buttons: `.sts-btn--outline` "Send Test" (`#stsSmtpTestBtn`), `.sts-btn--primary`
  "Save SMTP Settings".

### 2.3 Security Settings (`#stsSecurityForm`)
| name | label | type | source | notes |
|---|---|---|---|---|
| `hash_cost` | Bcrypt Hash Cost (badge `#hashCostBadge` = value) | range (`#hashCost`, min 4 max 20 step 1) | `HASH_COST` | server validates 4–31 |
| `session_lifetime` | Session Lifetime (seconds) | number (`#sessionLifetime`, min 900 step 900) | `SESSION_LIFETIME` | hint shows `gmdate('H\h i\m', SESSION_LIFETIME)` |

- Hash hint: "Higher = more secure but slower. Recommended: 10–14."
- Session hint: `Current: {H\h i\m}. Min 15 min.`
- Maintenance block `.sts-maint-block` (`#stsMaintBlock`, adds `--on` when active) and Clear-cache
  action item `.sts-action-item` are inside this panel (see §4).
- Button: `.sts-btn--primary` "Save Security Settings".

### 2.4 API Keys & Integrations (`#stsApiForm`)
| name | label | type | source | secret |
|---|---|---|---|---|
| `active_ai_provider` | Active AI Provider (radio cards) | radio values `openrouter` \| `nvidia_kimi` | `ACTIVE_AI_PROVIDER` | no |
| `openrouter_api_key` | OpenRouter API Key | password (`#openrouterApiKey`, write-only) | `$_ENV['OPENROUTER_API_KEY']` / `OPENROUTER_API_KEY` | **YES** |
| `nvidia_api_key` | NVIDIA API Key | password (`#nvidiaApiKey`, write-only) | `$_ENV['NVIDIA_KIMI_API_KEY']` | **YES** |
| `razorpay_key_id` | Razorpay Key ID | text (`#razorpayKeyId`) | `RAZORPAY_KEY_ID` | no |
| `razorpay_key_secret` | Razorpay Key Secret | password (`#razorpayKeySecret`, write-only) | `$_ENV['RAZORPAY_KEY_SECRET']` | **YES** |

- Radio cards: `.sts-radio-card` (+ `--active` on selected). Labels: **OpenRouter** /
  "Free & paid models via openrouter.ai"; **NVIDIA Kimi-K2** / "NVIDIA hosted Kimi-K2 model".
  **NOTE:** `.sts-radio-card` / `--active` are used in markup but there is **no CSS rule for them
  in settings.css** — they render unstyled in PHP today. Reproduce as-is (or record as a known
  PHP styling gap) — do not invent styling for parity.
- Secret placeholders: `"Already configured — leave blank to keep"` / `"No key set"` /
  `"No secret set"` (Razorpay secret). `value=""` always.
- Hints include links: `https://openrouter.ai/keys`, `https://build.nvidia.com`,
  `https://dashboard.razorpay.com/app/keys`.
- Button: `.sts-btn--primary` "Save API Keys".

### 2.5 Change Admin Password (`#stsPwForm`, class `sts-form sts-form--narrow`, autocomplete off)
| name | label | type | notes |
|---|---|---|---|
| `current_password` | Current Password * | password (`#currentPassword`, autocomplete `current-password`) | |
| `new_password` | New Password * | password (`#newPassword`, `minlength=8`, autocomplete `new-password`) | strength bar `#stsPwStrength` → `#stsPwStrengthBar` + `#stsPwStrengthLabel` |
| `confirm_password` | Confirm New Password * | password (`#confirmPassword`, autocomplete `new-password`) | match text `#stsPwMatch` |

- Button: `.sts-btn--danger` "Update Password" (lock icon).

### 2.6 Maintenance controls (modal + security block)
| name | type | location |
|---|---|---|
| `student` | boolean (posted `1`/`0`) | toggle; modal `#stsMaintModalStudent` |
| `instructor` | boolean (posted `1`/`0`) | toggle; modal `#stsMaintModalInstructor` |
| `auto_disable_minutes` | int | modal select `#stsMaintModalAuto` (values `""`,`60`,`120`,`240`,`custom`) + number `#stsMaintModalCustomMins` (min 1 max 43200) |

---

## 3. POST actions — field names, save mapping, validation, messages, redirect

**Global POST envelope (runs BEFORE any output):** `Content-Type: application/json`.
CSRF check first:
```php
if (!verifyCSRFToken($_POST['csrf_token'] ?? '')) {
    echo json_encode(['success'=>false,'message'=>'Security token invalid. Refresh the page and try again.']);
    exit;
}
$action = $_POST['action'] ?? '';
```
Every handler `echo json_encode(...)` and `exit`. **There is NO Post/Redirect/Get here** — the page
uses AJAX/fetch returning JSON (unlike dashboard.php). The Next port should keep AJAX JSON for the
in-page UX; but any form that must survive a no-JS reload should still behave safely. (AGENTS §6
PRG rule is satisfied in spirit because POSTs are non-navigational AJAX; document this deviation.)
Unknown action → `{"success":false,"message":"Unknown action."}`.

### 3.1 `action=update_general`
Fields: `site_name`, `site_url`, `admin_email`, `timezone`, `currency_code`.
Validation (joined error list, first non-empty set):
- `site_name === ''` → "Site name is required."
- `!filter_var(site_url, FILTER_VALIDATE_URL)` → "Invalid site URL."
- `!filter_var(admin_email, FILTER_VALIDATE_EMAIL)` → "Invalid admin e-mail."
- `timezone not in DateTimeZone::listIdentifiers()` → "Invalid timezone."
- `currency_code not in ['INR','USD','EUR','GBP','JPY','AUD','CAD','SGD','AED']` → "Invalid currency selected."
- Errors are joined with a single space (`implode(' ', $errors)`).
Calls `saveSettings([...])` passing existing `SMTP_*`, `HASH_COST`, `SESSION_LIFETIME` and
`smtp_pass => ''` (so nothing else is touched).
Success: `{"success":true,"message":"General settings saved successfully."}`.

### 3.2 `action=update_smtp`
Fields: `smtp_host`, `smtp_port` (int), `smtp_username`, `smtp_password`.
- Blank password → keep `SMTP_PASSWORD`.
Validation:
- `smtp_host === ''` → "SMTP host is required."
- `smtp_port < 1 || > 65535` → "SMTP port must be 1–65535."
- `smtp_username === ''` → "SMTP username is required."
Calls `saveSettings([... site_name/site_url/admin_email from constants, timezone = current,
smtp_* from input, hash_cost/session_lifetime from constants])`.
Success: `"SMTP settings saved successfully."`

### 3.3 `action=update_security`
Fields: `hash_cost` (int, default 12), `session_lifetime` (int, default 86400).
- `hash_cost < 4 || > 31` → "Hash cost must be 4–31."
- `session_lifetime < 900` → "Session lifetime must be at least 900 seconds."
Success: `"Security settings saved successfully."`

### 3.4 `action=update_api`
Fields: `openrouter_api_key`, `nvidia_api_key`, `razorpay_key_id`, `razorpay_key_secret`,
`active_ai_provider`.
- Blank `openrouter_api_key` → keep `$_ENV['OPENROUTER_API_KEY']`.
- Blank `nvidia_api_key` → keep `$_ENV['NVIDIA_KIMI_API_KEY']`.
- Blank `razorpay_key_secret` → keep `$_ENV['RAZORPAY_KEY_SECRET']`.
- `razorpay_key_id` is NOT secret (used in frontend JS) → always saved as typed.
- `active_ai_provider` forced to `'openrouter'` unless it is exactly `nvidia_kimi`.
Success: `"API keys saved successfully."`

### 3.5 `action=test_smtp`
Fields: `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`, `test_email`.
- Blank password → keep `SMTP_PASSWORD`.
- `!filter_var(test_email, FILTER_VALIDATE_EMAIL)` → `"Invalid test e-mail address."`
- Uses PHPMailer `isSMTP()`, `SMTPAuth=true`, Host/Username/Password/Port.
  - `port === 465` → `SMTPSecure = PHPMailer::ENCRYPTION_SMIME` (**PHP bug**: SMIME is a signature
    constant, not SSL — intended behaviour is SSL/`ENCRYPTION_SMTPS`; port it as SSL and note fix).
  - else → `SMTPSecure = ENCRYPTION_STARTTLS`.
  - `setFrom(smtp_user, SITE_NAME . ' Admin')`, subject `'[' . SITE_NAME . '] SMTP Test'`, body
    `'SMTP configuration test from ' . SITE_NAME . ' admin panel. If you received this, SMTP is working correctly.'`
- Success: `"Test e-mail sent to {htmlspecialchars(test_email)}."`
- Failure: `"SMTP error: " . $e->getMessage()`

### 3.6 `action=clear_cache` (no fields)
Deletes `sys_get_temp_dir()/sess_*` files except the current `session_id()`.
Success: `"Cache cleared. Removed {n} session file(s)."` (always success:true).
> Serverless: no local temp sessions exist. Port as a no-op/maintenance-cache clear that reports
> a truthful count (e.g. 0) — do not fake `sess_*` deletion. Document decision.

### 3.7 `action=db_health` (no fields)
Queries `information_schema.tables` for the current database, then `COUNT(*)` per table.
Response:
```json
{ "success": true, "message": "All N tables are healthy.",
  "tables": [ { "table": "...", "count": 123, "size_kb": 45.6, "status": "ok" } ] }
```
On a table error: `success:false`, `message:"One or more tables returned errors."`, row `status:"error"`, `count:null`.

### 3.8 `action=change_password`
Fields: `current_password`, `new_password`, `confirm_password`.
- `new_password !== confirm_password` → "New passwords do not match."
- `strlen(new_password) < 8` → "New password must be at least 8 characters."
- Verify current via `password_verify($current_password, dbUser['password'])` → else
  "Current password is incorrect."
- Hash `password_hash(new_password, PASSWORD_BCRYPT, ['cost'=>HASH_COST])`; `UPDATE users SET password=?`.
- `regenerateSessionOnPasswordChange($user['id'])` — kicks all other sessions
  (`kicked_reason='password_changed'`), inserts a fresh active session for the current device and
  updates `$_SESSION['session_token']`.
- `sendPasswordChangedNotificationEmail($user['email'], $user['name'], getClientIpAddress(), getDeviceInfo())` (**line 298**).
Success: `"Password changed successfully. All other devices have been logged out."`
DB exception: `"Database error while updating password."`

### 3.9 `action=system_info` (no fields)
Returns `data`: `php_version`, `server_software`, `os`, `memory_limit`, `upload_max`, `post_max`,
`max_exec_time`, `db_version` (`SELECT VERSION()`), `disk_free`, `disk_total`, `server_time`
(`date('Y-m-d H:i:s T')`). Field names/labels are consumed by JS (see §8).
> Serverless: map each key to a truthful Node/runtime equivalent (e.g. `php_version` → Node
> runtime label; `server_software` → platform; `db_version` → Postgres version). Keep keys/labels
> so the DOM renders identically; never invent values. Document the substitution.

### 3.10 `action=toggle_maintenance`
Fields: `student` (`!empty`), `instructor` (`!empty`), `auto_disable_minutes` (int, optional).
- Neither set → `disableMaintenance()`; response
  `{success:true,message:"Maintenance mode disabled.",maintenance:false,student:false,instructor:false,auto_disable_at:null}`.
- Else compute `autoDisableAt = date('Y-m-d H:i:s', time() + mins*60)` when mins>0, call
  `setMaintenanceStatus(student, instructor, autoDisableAt)`; response
  `{success:true,message:"Maintenance mode {updated|enabled}.",maintenance:true,student,instructor,auto_disable_at}`.
  **PHP bug:** the ternary reads `$maintenanceMode`, which is undefined inside the POST branch
  (defined later only on GET), so it is always falsy → message is always `"Maintenance mode enabled."`
  regardless of prior state. Port the INTENDED wording (`updated` when already on) and note the fix.

### 3.11 `saveSettings()` mapping (`private/functions/admin.php:919`)
Server-side guard `$fieldLimits` (checked BEFORE writing; rejects over-length OR any `\r`/`\n`):
```
site_name 100, site_url 255, admin_email 254, smtp_host 253,
smtp_user 254, smtp_pass 500, timezone 60, currency_code 10
```
Exact errors: `"Value for '{field}' exceeds the maximum allowed length of {max} characters."`
and `"Value for '{field}' must not contain newline characters."`
Writes (regex-replace) into `config.php`:
`SITE_NAME←site_name`, `SITE_URL←site_url`, `ADMIN_EMAIL←admin_email`, `SMTP_HOST←smtp_host`,
`SMTP_PORT←smtp_port`, `SMTP_USERNAME←smtp_user`, `SMTP_FROM_EMAIL←smtp_user`,
`HASH_COST←hash_cost`, `SESSION_LIFETIME←session_lifetime`,
`date_default_timezone_set←timezone`, and (when non-empty) `CURRENCY_CODE←currency_code` +
`CURRENCY_SYMBOL←symbolMap[code]`.
Into `secrets.php` only when `smtp_pass !== ''`: `$_ENV['SMTP_PASSWORD']←smtp_pass`.
Into `api/api_config.php`: `OPENROUTER_SITE_URL←site_url`, `OPENROUTER_SITE_NAME←site_name`.

### 3.12 `saveApiSettings()` mapping (`private/functions/admin.php:1022`)
Into `secrets.php` (only when non-empty): `$_ENV['OPENROUTER_API_KEY']←openrouter_api_key`,
`$_ENV['NVIDIA_KIMI_API_KEY']←nvidia_api_key`, `$_ENV['RAZORPAY_KEY_SECRET']←razorpay_key_secret`.
Into `config.php` (only when non-empty): `RAZORPAY_KEY_ID←razorpay_key_id`.
Into `api/api_config.php`: `ACTIVE_AI_PROVIDER←active_ai_provider`.
No `$fieldLimits` check in `saveApiSettings()` (only `saveSettings()` has it) — note for parity.

---

## 4. Maintenance-mode controls (exact) and NEW mapping

PHP `.maintenance` JSON flag (via `maintenance.php`) shape:
`{ student:bool, instructor:bool, enabled_at:string, enabled_by:int|null, auto_disable_at:string|null }`.
- `getMaintenanceStatus()` auto-disables (unlinks flag + logs `auto_disabled`) when
  `auto_disable_at <= time()`.
- `setMaintenanceStatus($student,$instructor,$autoDisableAt)` writes the flag + logs `enabled`/
  `disabled`. `disableMaintenance()` unlinks + logs `disabled`.
- `checkMaintenanceMode()` (called from bootstrap) never blocks `admin`, `exempt`, `system`
  categories; blocks `public`/`student` when `student` on, and `instructor`/`instructor_onboarding`
  when `instructor` on; returns HTTP 503 + `partials/maintenance-page.php`.
- Admin bypass is unconditional (`$_SESSION['user_role'] === 'admin'`).
- Admin pages show `partials/admin-maintenance-banner.php` (`.admbn-bar`, id `adMaintBanner`) with
  an orange sticky bar and a link to `/admin/settings`.

**NEW port mapping (already implemented, must be reused):**
- Flag storage → `app_settings` rows: `maintenance_student` (`"true"`/`"false"`),
  `maintenance_instructor` (`"true"`/`"false"`), `maintenance_auto_disable_at` (ISO string or `""`).
- Helpers: `lib/maintenance.ts` → `getMaintenanceState()`, `setMaintenanceState(student,instructor,autoDisableAt?)`,
  `autoDisableMaintenance()`, `isPathInMaintenanceScope(pathname,state)`.
- Cron: `app/api/cron/maintenance/route.ts` calls `autoDisableMaintenance()` (CRON_SECRET-guarded).
- `setMaintenanceState()` writes a `maintenance_logs` row (`event='set'`); `autoDisableMaintenance()`
  logs `event='auto_disabled'` (replaces `logMaintenanceEvent()` → `private/logs/maintenance.log`).
- Enforcement in `middleware`/`proxy` layer with admin bypass exactly as PHP.
- `admin-maintenance-banner.php` → shared admin banner component rendering `.admbn-bar` with scope
  label `Student`/`Instructor`/`Student &amp; Instructor` and `· Auto-disabling at HH:MM`, link to
  `/admin/settings` (glyph `&middot;` U+00B7).

**Modal rules (client):** confirm button disabled until at least one scope checked
(`#stsMaintModalConfirm` disabled↔`!(student||instructor)`); `custom` option reveals
`#stsMaintModalCustomWrap`; on Confirm posts `student`/`instructor` `1`/`0` and
`auto_disable_minutes` (only if >0 / non-empty); After success `showToast(msg,'info')` and
`window.location.reload()` after **700 ms**. Enabling opens the modal; disabling posts directly
(no modal).

---

## 5. Password-change flow (trigger clarification)

- **Trigger:** the `change_password` POST action (§3.8) — i.e. the admin changing **their own
  account password** — invokes `sendPasswordChangedNotificationEmail($user['email'], $user['name'],
  getClientIpAddress(), getDeviceInfo())` at **settings.php line 298**.
- **Correction to the brief:** this notification is NOT triggered by changing the **SMTP** password.
  Saving the SMTP password (`update_smtp`) only rewrites `$_ENV['SMTP_PASSWORD']` and sends nothing.
- Email (`email_senders.php:277`): subject `'Your Password Was Changed – ' . SITE_NAME` (en-dash
  U+2013); HTML from `buildPasswordChangedNotificationHtml()`; text from `...Text()`. Rows: Time
  (`date('d M Y, H:i') . ' UTC'`), IP Address, Device (`substr($deviceInfo,0,80)`); warning notice
  linking `SITE_URL/forgot-password`. Also creates an in-app notification
  (`createNotification($userId,'password_changed','Your Password Was Changed', ...)`).
- Fire-and-forget: PHPMailer exceptions are caught and only `error_log`-ed (never surfaced).
- New helpers used: `getClientIpAddress()` (auth.php:651, trusted-proxy aware, fallback
  `REMOTE_ADDR`), `getDeviceInfo()` (auth.php:799, User-Agent trimmed to 255),
  `regenerateSessionOnPasswordChange()` (auth.php:880).
- NEW port: send via Nodemailer sender in `lib/email/senders.ts` with the same subject/wording;
  `regenerateSessionOnPasswordChange` → `lib/auth/sessions.ts`; in-app notification via
  `lib/notifications.ts`. `await`/`after()` the send in serverless.

---

## 6. Security requirements

1. **Role guard:** `requireRole(ROLE_ADMIN)` on the page AND on every settings API route handler.
2. **CSRF:** all 10 POST actions verify `csrf_token` (matches dashboard's `generateCSRFToken`/
   `verifyCSRFToken`); on failure return `{"success":false,"message":"Security token invalid. Refresh the page and try again."}` (JSON, not a 403 page). Port as Origin/Host + token verification.
3. **Secrets are write-only:** all password fields render `value=""`, and blank input means "keep
   existing" (`SMTP_PASSWORD`, `OPENROUTER_API_KEY`, `NVIDIA_KIMI_API_KEY`,
   `RAZORPAY_KEY_SECRET`). Never echo a stored secret into HTML; only a boolean "configured?" is
   used to choose the placeholder text.
4. **Never rewrite files:** the NEW port MUST NOT rewrite `config.php`, `secrets.php` or
   `api_config.php` (impossible/undesirable on serverless). Non-secret settings go to
   `app_settings`; secrets stay in env (`.env.local`) only.
5. **Input validation:** identical checks (§3) + the `$fieldLimits` length/newline guard + zod
   schemas on each route/server action.
6. **Output escaping:** all PHP `htmlspecialchars()` echoes stay escaped in JSX; system-info values
   are inserted as text (JS uses `textContent`/innerHTML with server-origin values only).
7. **Session invalidation:** password change regenerates the session and kicks other devices.
8. **Logging:** maintenance events → `maintenance_logs`; never log secrets.

---

## 7. Full HTML DOM structure (parity inventory)

Top-level: `.sts-page` inside `<main class="ad-page-wrap">`.

- `.sts-page-header`
  - `.sts-page-header__left` → `.sts-page-icon` (22×22 svg gear) + `<div>` with
    `h1.sts-page-title` "System Settings" and `p.sts-page-subtitle` "Configure your platform,
    SMTP, security and more".
  - `.sts-maintenance-pill` (`#stsMaintPill`, `--active` when on) → `.sts-maintenance-dot` +
    `.sts-maintenance-label` (`#stsMaintLabel`; "Maint: Student/Instructor" or "Maintenance OFF") +
    `button.sts-maintenance-btn` (`#stsMaintBtn`).
- `.sts-stats-row` → 4 × `.sts-stat-card` (`.sts-stat-icon.sts-stat-icon--{blue|green|orange|purple}`
  + `.sts-stat-body` `.sts-stat-value` + `.sts-stat-label`): Total Users
  (`number_format(tableCounts['users'])`), Total Courses (`courses`), Enrollments (`enrollments`),
  Reviews (`course_reviews`).
- `.sts-layout` → `aside.sts-sidebar` > `nav.sts-tabs[role=tablist][aria-label="Settings sections"]`
  (7 `.sts-tab` buttons) + `.sts-panels` with the 7 `<section class="sts-panel" role="tabpanel">`.
- **Cards:** `.sts-card` > `.sts-card-header` (`.sts-card-title`, `.sts-card-desc`; optional
  `.sts-card-header--flex` on Database/System) + form/body.
- **Forms:** `.sts-form` (+ `--narrow`), `.sts-form-row` (+ `--2`), `.sts-field`, `.sts-label`,
  `.sts-req`, `.sts-input` (+ `--pw`), `.sts-select`, `.sts-hint`, `.sts-pw-wrap`,
  `button.sts-pw-toggle[data-target]` with `.sts-eye-show`/`.sts-eye-hide`.
- **Buttons:** `.sts-btn` + `--primary` / `--outline` / `--danger`; `.sts-form-actions`.
  Save buttons: General "Save Settings", SMTP "Send Test" + "Save SMTP Settings", Security
  "Save Security Settings", Password "Update Password", API "Save API Keys".
- **Security extras:** `.sts-maint-block` (`#stsMaintBlock`) with `.sts-maint-block__left`
  (svg + `<strong>Maintenance Mode</strong>` + `#stsMaintStatus`) and
  `button#stsMaintToggleBtn`; `.sts-action-item` with `strong` "Clear Session Cache" + span
  "Remove stale server-side sessions from the temp directory" + `button#stsClearCacheBtn` "Clear Cache".
- **Database panel:** `.sts-table-wrap` > `table.sts-table#stsDbTable` with `thead` (Table/Records/
  Size (KB)/Status) and one `<tr>` per table: `.sts-table-name` (svg + name), count cell,
  `.sts-table-size` "—", `.sts-badge-status.sts-badge-status--ok` "OK". Header has
  `button#stsDbHealthBtn` "Run Health Check".
- **System panel:** `.sts-sysinfo-grid#stsSysGrid` initial `.sts-sysinfo-loading` (`.sts-spinner`
  + "Loading system info…"); header has `button#stsSysRefreshBtn` "Refresh". JS fills
  `.sts-sysinfo-item` (`.sts-sysinfo-icon`, `.sts-sysinfo-label`, `.sts-sysinfo-value`).
- **Password panel:** `#stsPwStrength` (`.sts-pw-strength`) > `#stsPwStrengthBar`
  (`.sts-pw-strength-bar`), `#stsPwStrengthLabel` (`.sts-pw-strength-label`), `#stsPwMatch`
  (`.sts-pw-match`).
- **API panel:** `.sts-radio-card` labels, `.sts-pw-wrap` secret inputs.
- **Maintenance modal (outside `.sts-page`):** `.sts-modal-overlay#stsMaintModal` (display:none) >
  `.sts-modal[role=dialog][aria-labelledby=stsMaintModalTitle]` >
  `.sts-modal-header` (h2 `#stsMaintModalTitle` "Enable Maintenance Mode" + `button.sts-modal-close#stsMaintModalClose`)
  + `.sts-modal-body` (two `label.sts-modal-check` — Student / Instructor with
  `.sts-modal-check-mark`, `input#stsMaintModalStudent`, `#stsMaintModalInstructor`; then field with
  `select#stsMaintModalAuto` options Manual only/1 hour(60)/2 hours(120)/4 hours(240)/Custom minutes
  and `#stsMaintModalCustomWrap` > `input#stsMaintModalCustomMins` number min1 max43200)
  + `.sts-modal-footer` (`.sts-btn--outline#stsMaintModalCancel` "Cancel",
  `.sts-btn--primary#stsMaintModalConfirm` "Enable Maintenance" `disabled`).
- **Toast (outside):** `div.sts-toast#stsToast[role=alert][aria-live=polite]` >
  `span.sts-toast-icon#stsToastIcon` + `span.sts-toast-msg#stsToastMsg`.

Every class above must appear verbatim in the JSX and be backed by
`public/assets/css/admin/settings.css` (copied to `styles/.../settings.css` unchanged, imported in
cascade after `navbar.css`/`base.css`).

---

## 8. Inline `<script>` behaviour (nonce block)

Namespace IIFE, `'use strict'`. Helpers `qs`/`qsa`. Toast `showToast(msg,type)`
(`success|error|info`), sets `.sts-toast.sts-toast--{type}.sts-toast--show`, type icon SVG, auto
hides after **4500 ms**. `postForm(data,cb)` appends `csrf_token` and `fetch(window.location.href,
{method:'POST',body})`, JSON, network error → toast "Network error. Please try again.".

1. `document.getElementById('fontLoad_1')?.addEventListener('load', …media='all')` — element does
   not exist (no-op; safe to drop or keep harmlessly).
2. **Tabs:** on click, toggle `.sts-tab--active` + `aria-selected`, show
   `#sts-panel-{data-tab}`; if tab is `system`, call `loadSysInfo()`.
3. **General form** submit → `update_general`.
4. **SMTP form** submit → `update_smtp`.
5. **SMTP test** `#stsSmtpTestBtn` → disables, text "Sending…", posts `test_smtp`, restores label
   with the paper-plane SVG.
6. **Security form** submit → `update_security`.
7. **Hash slider** `#hashCost` input → updates `#hashCostBadge` text.
8. **Clear cache** `#stsClearCacheBtn` → posts `clear_cache`, disables during.
9. **Maintenance modal:** `openMaintModal()` resets checkboxes/select/confirm; `closeMaintModal()`;
   `updateMaintConfirmBtn()` enables confirm when a scope is checked; select `custom` reveals custom
   wrap; overlay click / close / cancel close; Confirm posts `toggle_maintenance` then
   `maintUpdateUI`; `bindMaintToggle()` on `#stsMaintBtn` and `#stsMaintToggleBtn` (on→disable
   directly, off→open modal). `maintUpdateUI()` updates pill + security block text/classes and
   reloads after 700 ms. (Warning: block styling uses `sts-maint-block--on`.)
10. **DB health** `#stsDbHealthBtn` → "Checking…" spinner, posts `db_health`, updates
    `#stsDbTable tbody` rows (count/size/status badge `--ok`/`--error`), toast.
11. **System info** `#stsSysRefreshBtn` + `loadSysInfo()` render the 11 `.sts-sysinfo-item` with
    emoji icons (🖥🌐💻🧠📤📋⏱🗄💾📦🕐) and labels PHP Version / Server Software / OS / Memory Limit /
    Upload Max Size / POST Max Size / Max Exec Time / MySQL Version / Disk Free / Disk Total /
    Server Time.
12. **Password strength:** score = (len≥8)+(len≥12)+(has upper)+(has digit)+(has symbol); width
    `min(score*20,100)%`; class/label `weak`(≤1)/`fair`(≤3)/`strong`.
13. **Password match:** `#stsPwMatch` "✓ Passwords match" (`--ok`) / "✗ Passwords do not match"
    (`--err`).
14. **Password form** submit: client-checks match + length then posts `change_password`; on success
    resets form/bar/label/match.
15. **API form** submit → `update_api` (guarded `qs('#stsApiForm') && …`).
16. **AI provider radios:** change → move `.sts-radio-card--active` to closest card.
17. **Password show/hide:** every `.sts-pw-toggle` toggles `input#data-target` type and swaps
    `.sts-eye-show`/`.sts-eye-hide` display.

**Absent in this page (do not invent):** there are **no copy-to-clipboard buttons** and **no
unsaved-changes/beforeunload warnings**. The task's mention of them does not apply here.

---

## 9. Explicit PHP constant/file-write → NEW env / app_settings mapping

**RULE: `config.php`, `secrets.php` and `api_config.php` are NEVER read from or rewritten by the
Next.js port. Non-secret values live in `app_settings`; secrets live only in `.env.local`.**

| PHP field / constant (written by save*) | Purpose | NEW destination |
|---|---|---|
| `SITE_NAME` (config.php) | site name | `app_settings.site_name` (display); optional env `SITE_NAME` fallback |
| `SITE_URL` (config.php) | canonical base URL | `app_settings.site_url`; env `NEXT_PUBLIC_SITE_URL` fallback |
| `ADMIN_EMAIL` (config.php) | support/admin email | `app_settings.admin_email`; env `ADMIN_EMAIL` fallback |
| `date_default_timezone_set()` (config.php) | tz | `app_settings.timezone`; env `APP_TIMEZONE` fallback |
| `CURRENCY_CODE` + `CURRENCY_SYMBOL` (config.php) | display currency | `app_settings.currency_code`; symbol derived in `lib/format.ts` (no stored symbol) |
| `SMTP_HOST` (config.php) | SMTP host | `app_settings.smtp_host` (non-secret) / env `SMTP_HOST` |
| `SMTP_PORT` (config.php) | SMTP port | `app_settings.smtp_port` / env `SMTP_PORT` |
| `SMTP_USERNAME` + `SMTP_FROM_EMAIL` (config.php) | SMTP user/from | `app_settings.smtp_user` / env `SMTP_USER` + `SMTP_FROM_EMAIL` |
| `SMTP_PASSWORD`→`$_ENV['SMTP_PASSWORD']` (secrets.php) | SMTP secret | **env `SMTP_PASS` only** (write-only in UI) |
| `HASH_COST` (config.php) | bcrypt cost | `app_settings.hash_cost` (used by `lib/auth/passwords.ts`) |
| `SESSION_LIFETIME` (config.php) | session TTL | `app_settings.session_lifetime`; env `SESSION_LIFETIME` fallback |
| `OPENROUTER_SITE_URL`/`OPENROUTER_SITE_NAME` (api_config.php) | AI headers | derived from `site_url`/`site_name` at runtime (no rewrite) |
| `OPENROUTER_API_KEY` (secrets.php) | AI secret | **env `OPENROUTER_API_KEY` only** |
| `NVIDIA_KIMI_API_KEY` (secrets.php) | AI secret | **env `NVIDIA_KIMI_API_KEY` only** |
| `RAZORPAY_KEY_ID` (config.php) | payment public key | env `RAZORPAY_KEY_ID` (non-secret; may mirror to `app_settings`) |
| `RAZORPAY_KEY_SECRET` (secrets.php) | payment secret | **env `RAZORPAY_KEY_SECRET` only** |
| `ACTIVE_AI_PROVIDER` (api_config.php) | provider toggle | `app_settings.active_ai_provider`; env `ACTIVE_AI_PROVIDER` fallback |
| `.maintenance` file (maintenance.php) | maintenance flag | `app_settings.maintenance_student` / `maintenance_instructor` / `maintenance_auto_disable_at` |
| `private/logs/maintenance.log` | maint log | `maintenance_logs` table |
| `sys_get_temp_dir()` sessions | clear cache | no-op/truthful count (no local sessions) |

**Open decision (do not fake):** since env cannot be mutated at runtime on Vercel, saving a **new
SMTP password / API key secret** through this UI cannot change the running env. The port must
either (a) render these secret fields read-only with a clear note that secrets are managed via env,
or (b) accept the value and explicitly report it could not be persisted. Pick one, implement fully,
and document in `docs/PROGRESS.md`. Do not silently succeed.

---

## PORT CHECKLIST

- [ ] Route `/admin/settings` (server shell + Node runtime), admin-only guard (`requireRole(ROLE_ADMIN)`), `noindex, nofollow`, title `System Settings — {SITE_NAME} Admin`.
- [ ] Mount under `/admin/`; add legacy `/admin/settings.php` → `/admin/settings` 301 (already covered by generic rule).
- [ ] Import `base.css`, `navbar.css`, `settings.css` in the PHP cascade order; copy `settings.css` unchanged; Inter via `next/font`.
- [ ] Render the full DOM inventory (§7): header, maintenance pill, 4 stat cards, sidebar with 7 tabs, all 7 panels, modal, toast — every `sts-*` class and id verbatim.
- [ ] Reproduce all static text, hints, placeholders ("Already configured — leave blank to keep"), hints with links, and em-dash/en-dash characters.
- [ ] Implement 10 POST actions (§3) with CSRF JSON gate + exact success/error messages: `update_general`, `update_smtp`, `update_security`, `update_api`, `test_smtp`, `clear_cache`, `db_health`, `change_password`, `system_info`, `toggle_maintenance`.
- [ ] Reproduce validations exactly, incl. `$fieldLimits` length + `[\r\n]` newline guard and its exact error strings.
- [ ] Secrets write-only: blank = keep existing; never echo secrets; show only "configured?" placeholder.
- [ ] Switch persistence to `app_settings` + env (§9); NEVER rewrite `config.php`/`secrets.php`/`api_config.php`. Resolve the secret-save-vs-env open decision explicitly.
- [ ] Maintenance: map to `maintenance_student`/`maintenance_instructor`/`maintenance_auto_disable_at`, `setMaintenanceState()`/`autoDisableMaintenance()`; preserve admin bypass + banner (`admbn-bar`).
- [ ] Password change: bcrypt verify/hash with `hash_cost`, session regeneration (kick others), send `sendPasswordChangedNotificationEmail` (subject `Your Password Was Changed – {SITE_NAME}`, en-dash) + in-app notification.
- [ ] Port the inline JS (§8) as a client component: tabs, forms, SMTP test, slider badge, clear cache, maintenance modal + 700 ms reload, DB health, system info (11 items), password strength/match, radio highlight, show/hide toggles. No copy buttons / no unsaved warnings (none exist).
- [ ] Note/port fixes for PHP bugs: `ENCRYPTION_SMIME` on port 465 (use SSL); always-"enabled" maintenance message; unstyled `.sts-radio-card`.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run build`; run `npm run ui-compare -- --page settings` and record in `docs/UI_PARITY_REPORT.md`.
