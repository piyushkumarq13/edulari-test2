# Phase 9 — Admin Banners & Notifications (reverse-engineering spec)

Source of truth (OLD PHP, read-only):
- `htdocs/public/admin/banners.php` (657 lines)
- `htdocs/public/admin/send-notifications.php` (384 lines)
- `htdocs/private/functions/banners.php` (239 lines)
- `htdocs/private/functions/notifications.php` (365 lines)
- `htdocs/private/data/banners.json` (currently `[]`)
- `htdocs/private/banner-templates/simple-text.php`, `seasonal-promo.php`, `icon-message.php`
- `htdocs/public/partials/site-banners.php` (frontend renderer — consumes the same data)
- `htdocs/public/assets/css/admin/banners.css` (649 lines)
- `htdocs/public/assets/css/admin/send-notifications.css` (915 lines) — NOT linked by the page (see §8)
- `htdocs/public/partials/head.php`, `htdocs/public/navbar.php` (shared chrome)

NEW target files:
- `app/(admin)/admin/banners/page.tsx` + `components/admin/banners/*`
- `app/(admin)/admin/send-notifications/page.tsx` + `components/admin/send-notifications/*`
- `app/api/admin/banners/route.ts` + `app/api/admin/banners/[id]/route.ts` (or server actions)
- `app/api/admin/notifications/route.ts`
- `lib/db/banners.ts`, `lib/db/notifications.ts`
- `lib/security/csrf.ts`, `lib/auth/guards.ts` (shared)
- `components/banners/SiteBanners.tsx` (frontend stack, used by navbar layout)
- `styles/admin/banners.css`, `styles/admin/send-notifications.css` (verbatim)
- DB: `site_banners` (001), `notification_messages` + `notification_reads` (008)

---

## 1. Page-level facts

### 1.1 `banners.php` — Announcement Banners (admin)
- Purpose: create/edit/delete/activate/deactivate sitewide announcement banners targeted at roles, with template, type, CTA, schedule, resurface and priority; plus a server-rendered preview.
- NEW URL: `/admin/banners` (legacy `*.php` → 301 clean URL per `.htaccess`).
- Guard: `requireRole(ROLE_ADMIN)` (line 8). Non-admin → existing role-denied behaviour (redirect/logout per `private/auth.php`).
- Title: `'Manage Banners — ' . htmlspecialchars(SITE_NAME) . ' Admin'` → e.g. `Manage Banners — Edulari Admin`.
- Robots: `noindex, nofollow` (`$pageRobots` set explicitly, line 230).
- CSS (cascade order): `head.php` loads `base.css`; `$extraCss = '../assets/css/admin/banners.css'` loads `banners.css`; the included `navbar.php` loads `/assets/css/navbar.css` at line 98. Effective order: `base.css` → `banners.css` → `navbar.css`. `banners.css` DEPENDS on navbar.css variables (`--ad-*`) per its header comment; keep this order (note: it is backwards from the comment, but replicate the actually-applied order and verify in ui-compare).
- `$activeNav = 'banners'` (navbar admin "Banners" item, navbar.php:228, href `SITE_URL . '/admin/banners'`, key `banners`).
- Includes: `bootstrap.php`, `config.php`, `db.php`, `auth.php`, `functions/admin.php`, then `functions/banners.php` (line 14). Renders `partials/head.php`, `navbar.php`, `footer.php`.
- The navbar itself includes `functions/banners.php` and `partials/site-banners.php` (navbar.php:820-821), so the frontend banner stack appears on every page that includes the navbar.

### 1.2 `send-notifications.php` — Send Notifications (admin)
- Purpose: compose a broadcast notification to all / a role / one specific user by email; stores ONE `notification_messages` row per send.
- NEW URL: `/admin/send-notifications`.
- Guard: `requireRole(ROLE_ADMIN)` (line 23).
- Title: `'Send Notifications – ' . htmlspecialchars(SITE_NAME)` (note en-dash `–`).
- Robots: `noindex, nofollow` (line 154).
- Page CSS: the page uses an inline `<style>` block (lines 160-214) for `sn-*` classes; `$extraCss = '../assets/css/navbar.css'` (line 156) duplicates the navbar.css already linked by `navbar.php`. The separately-authored `assets/css/admin/send-notifications.css` is NOT referenced by this page (dead file at runtime). Port the inline styles as the page-authoritative CSS; keep the external file for possible future use but do not rely on it.
- `$activeNav` not set (no admin nav highlight).
- Includes: `bootstrap.php`, `config.php`, `db.php`, `auth.php`, `functions/notifications.php`. Then `partials/head.php`, `navbar.php`, `footer.php`.
- Reached from admin dashboard action card (`dashboard.php:290`, href `send-notifications.php`).

Both pages are admin chrome: navbar + footer, `body` top padding is governed by navbar/site-banners JS.

---

## 2. banners.php — storage, JSON shape, DB mapping

### 2.1 Storage
- OLD: JSON file `private/data/banners.json` (array of banner objects). Function `getBannersFilePath()` = `PRIVATE_PATH . '/data/banners.json'`.
  - `getAllBanners()`: if file missing or invalid JSON → `[]`.
  - `saveAllBanners()`: mkdir `0750` if needed; write to tempnam file, `flock(LOCK_EX)`, rename over target (atomic-ish). `JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES`.
- NEW: `public.site_banners` table (migration `001_extensions_and_helpers.sql`, lines 28-51). Must not use a JSON file (serverless, no local disk).
  - Every read/write in `lib/db/banners.ts` must mirror the function semantics (create/update/delete/toggle/getAll/getActiveForRole).

### 2.2 Exact banner object shape (authoritative — from `createBanner()` lines 53-70)
```json
{
  "id": "bnr_<12 hex chars>",
  "version": 1,
  "template": "simple-text",
  "type": "info",
  "title": "",
  "message": "",
  "audience": [],
  "cta": null,
  "schedule": null,
  "resurface_after_days": null,
  "active": true,
  "priority": 0,
  "created_at": "Y-m-d H:i:s",
  "updated_at": "Y-m-d H:i:s",
  "created_by": 123,
  "updated_by": 123
}
```
- `id`: `'bnr_' . bin2hex(random_bytes(6))` → e.g. `bnr_a1b2c3d4e5f6` (12 hex). NEW: generate identically (crypto.randomBytes(6).toString('hex')) so client-side/storage id format and any bookmarks stay stable.
- `cta`: either `null` or `{ "text": string, "link": string }` (both required together).
- `schedule`: either `null` or `{ "start_at": "Y-m-d H:i:s"|null, "end_at": "Y-m-d H:i:s"|null }`; only set when at least one side is non-empty. Empty side stored as `null`.
- `resurface_after_days`: `null` or non-negative integer.
- `created_by` / `updated_by`: `$_SESSION['user_id'] ?? null`.

### 2.3 JSON → `site_banners` column mapping
| JSON field | `site_banners` column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | `bnr_`+hex |
| `version` | `version` | `integer default 1` | bumped on content change |
| `template` | `template` | `text default 'simple-text'` | |
| `type` | `type` | `text default 'info'` | info/warning/success/promo (no CHECK yet — see §4.5) |
| `title` | `title` | `text default ''` | |
| `message` | `message` | `text default ''` | |
| `audience` | `audience` | `jsonb default '[]'` | array of `guest/student/instructor/admin` |
| `cta` | `cta` | `jsonb` (nullable) | `{text,link}` or null |
| `schedule` | `schedule` | `jsonb` (nullable) | `{start_at,end_at}` or null |
| `resurface_after_days` | `resurface_after_days` | `integer` (nullable) | |
| `active` | `active` | `boolean default true` | |
| `priority` | `priority` | `integer default 0` | |
| `created_at` | `created_at` | `timestamptz default now()` | UTC |
| `updated_at` | `updated_at` | `timestamptz default now()` | trigger `trg_site_banners_updated` |
| `created_by` | `created_by` | `bigint` | users.id |
| `updated_by` | `updated_by` | `bigint` | users.id |

Index: `idx_site_banners_active (active)`. RLS enabled, privileges revoked from anon/authenticated.

### 2.4 Business rules (functions/banners.php)
- `createBanner`: defaults `template='simple-text'`, `type='info'`, `active=true` (note: page passes `active` from checkbox, so effective default is whatever POST sends), `priority=(int)`. Appends and saves. Logs `created`. Returns the banner.
- `updateBanner(id,data)`: if `id` not found → `null`. Content-change detection (`oldContent !== newContent`) compares ONLY `title,message,template,type,cta`; if changed, `version += 1`. Other fields updated only when `array_key_exists` in the payload. Sets `updated_at`, `updated_by`. Logs `updated` with `content_changed` + `new_version`. Returns updated banner.
  - IMPORTANT: because `resurface_after_days` is always sent (possibly null) by the page, it overwrites; same for `schedule`, `audience`, `active`, `priority`.
  - `version` bump matters: frontend dismiss state keys on `(id,version)`, so editing content re-shows a dismissed banner.
- `deleteBanner(id)`: splice out, save if found; returns bool. Logs `deleted`.
- `toggleBannerActive(id, active)`: sets `active`, `updated_at`, `updated_by`; returns banner or `null`. Logs `toggled`.
- `getAvailableBannerTemplates()`: scans `PRIVATE_PATH/banner-templates/*.php`, key = filename without extension, label = `ucwords(str_replace('-',' ',name))`. Current files → `simple-text`="Simple Text", `icon-message`="Icon Message", `seasonal-promo`="Seasonal Promo". NEW: hardcode/replace with a static registry (no filesystem scan on serverless). Preserve exact keys+labels.
- `getActiveBannersForRole(?role)`: role defaults `'guest'`. Keep banner only if `active`, and `in_array(role, audience, strict)`, and schedule window passes (`start_at<=now` and `end_at>=now` when set). Sort by `priority` DESC. NEW: role comes from session; guest when unauthenticated. SQL must replicate: `active=true AND audience @> [role] AND (schedule null OR start<=now) AND (schedule null OR end>=now) ORDER BY priority DESC`.
- `logBannerEvent(event, context)`: appends a line to `BANNER_LOG_FILE` (`private/logs/banners.log`): `[Y-m-d H:i:s] BANNER | <event> | <json context>`; context adds `user_id`, `ip` (`REMOTE_ADDR`), `timestamp`. NEW: write to `security_events` (or console) — NEVER to files.

### 2.5 Banner templates (must become React components / render map)
All three receive `$banner` and escape output with `htmlspecialchars`.

1. `simple-text` (label: "Simple Text")
   - `<span class="sbnt-simple-title">{title}</span>` (only if title non-empty)
   - `<span class="sbnt-simple-message">{message}</span>` (only if message non-empty)

2. `icon-message` (label: "Icon Message")
   - `$iconMap = ['info'=>'i','warning'=>'!','success'=>'✓','promo'=>'★']`; `$icon = map[type] ?? 'i'`
   - `<span class="sbnt-icon-icon">{icon}</span>` then `<div class="sbnt-icon-texts">` with `<span class="sbnt-icon-title">{title}</span>` and `<span class="sbnt-icon-message">{message}</span>` (each only if non-empty).
   - Icon characters are literal: `i`, `!`, `✓` (U+2713), `★` (U+2605). Not HTML-escaped in output.

3. `seasonal-promo` (label: "Seasonal Promo")
   - `$badgeMap = ['info'=>'Info','warning'=>'Notice','success'=>'Offer','promo'=>'Sale!']`; `$badge = map[type] ?? 'Offer'`
   - `<span class="sbnt-promo-badge">{badge}</span>` then `<div class="sbnt-promo-texts">` with `<span class="sbnt-promo-title">{title}</span>` and `<span class="sbnt-promo-message">{message}</span>` (each only if non-empty).

Required fields per template: none beyond the global title/message (all template pieces are conditionally rendered). The only enforced requirement is title AND message non-empty (server validation) and ≥1 audience.

### 2.6 Types (visual variants)
`type ∈ {info, warning, success, promo}` — select options in that order. Drives shell class `sbn-type-<type>`, table badge `bnr-type-badge--<type>`, CTA colours, icon glyph and promo badge. `ucfirst(type)` displayed in table badge.

### 2.7 Preview (server action, `action=preview_banner`)
- No persistence. Builds a pseudo-banner `{id:'preview',version:1,template,type,title,message,audience:[],cta,schedule:null,resurface_after_days:null,active:true,priority:0}`.
- Renders `$previewStyle` (a minified inline `<style>` block, reproduced below) + the shell:
  ```html
  <div class="sbn-shell sbn-type-{esc(type)}" data-banner-id="preview" data-version="1" data-resurface-days="">
    <div class="sbn-content">{included template HTML}</div>
    [if cta.text && cta.link] <a class="sbn-cta" href="{esc(link)}">{esc(text)}</a>
    <button type="button" class="sbn-close" aria-label="Dismiss">&times;</button>
  </div>
  ```
- Template is validated against `array_keys(getAvailableBannerTemplates())` (falls back to `simple-text` if unknown) → prevents arbitrary include.
- Returns `{"success":true,"html":"..."}`. The client injects via `innerHTML` into `#bnrPreviewBody` and shows `#bnrPreviewWrap`.
- Full `$previewStyle` (minified, from banners.php:198 — needed verbatim for pixel-identical preview; the production stack in `site-banners.php` has the same rules but formatted + addded `:hover` rules and the fixed-position wrapper):
  ```
  .sbn-shell{display:flex;align-items:center;gap:12px;width:100%;padding:10px 20px;font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13.5px;line-height:1.4}
  .sbn-content{flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
  .sbn-type-info{background:#eff6ff;color:#1e3a5f;border-bottom:1px solid #bfdbfe}
  .sbn-type-warning{background:#fffbeb;color:#5c3d0a;border-bottom:1px solid #fde68a}
  .sbn-type-success{background:#ecfdf5;color:#064e3b;border-bottom:1px solid #a7f3d0}
  .sbn-type-promo{background:linear-gradient(90deg,#fff0f0,#fff5e6);color:#7c2d12;border-bottom:1px solid #fed7aa}
  .sbn-cta{display:inline-flex;align-items:center;padding:5px 14px;border-radius:6px;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0}
  .sbn-type-info .sbn-cta{background:#3b82f6;color:#fff}
  .sbn-type-warning .sbn-cta{background:#f59e0b;color:#1e1e2e}
  .sbn-type-success .sbn-cta{background:#10b981;color:#fff}
  .sbn-type-promo .sbn-cta{background:#e84545;color:#fff}
  .sbn-close{flex-shrink:0;width:24px;height:24px;border:none;background:transparent;font-size:18px;line-height:1;cursor:pointer;opacity:.6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:inherit}
  .sbn-close:hover{opacity:1;background:rgba(0,0,0,.06)}
  .sbnt-simple-title{font-weight:700}
  .sbnt-simple-message{opacity:.85}
  .sbnt-icon-icon{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;font-weight:700}
  .sbn-type-info .sbnt-icon-icon{background:#bfdbfe;color:#1e40af}
  .sbn-type-warning .sbnt-icon-icon{background:#fde68a;color:#92400e}
  .sbn-type-success .sbnt-icon-icon{background:#a7f3d0;color:#065f46}
  .sbn-type-promo .sbnt-icon-icon{background:#fed7aa;color:#9a3412}
  .sbnt-icon-texts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
  .sbnt-icon-title{font-weight:700}
  .sbnt-icon-message{opacity:.85}
  .sbnt-promo-badge{flex-shrink:0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:2px 8px;border-radius:4px}
  .sbn-type-info .sbnt-promo-badge{background:#bfdbfe;color:#1e40af}
  .sbn-type-warning .sbnt-promo-badge{background:#fde68a;color:#92400e}
  .sbn-type-success .sbnt-promo-badge{background:#a7f3d0;color:#065f46}
  .sbn-type-promo .sbnt-promo-badge{background:#fed7aa;color:#9a3412}
  .sbnt-promo-texts{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
  .sbnt-promo-title{font-weight:700}
  .sbnt-promo-message{opacity:.85}
  ```
- `banners.css` overrides `.bnr-preview-body .sbn-shell { position:static !important; box-shadow:none !important; }`.

### 2.8 POST actions (AJAX; all return JSON, `Content-Type: application/json; charset=utf-8`)
Request method POST only. CSRF checked first for ALL actions (`$_POST['csrf_token']`). Invalid CSRF → `{"success":false,"message":"Security token invalid. Refresh the page and try again."}` and `exit` (HTTP 200 with JSON; no redirect). Unknown action → `{"success":false,"message":"Unknown action."}`.

| action | fields | success message | failure messages |
|---|---|---|---|
| `create_banner` | title, message, template, type, audience[], cta_text, cta_link, schedule_start, schedule_end, resurface_after_days, priority, active | `Banner created.` (+`banner`) | `Title and message are required.` / `At least one audience must be selected.` / `Both CTA text and link must be provided together.` |
| `update_banner` | id, + same as create | `Banner updated.` (+`banner`) | `Banner ID missing.` / `Title and message are required.` / `At least one audience must be selected.` / `Both CTA text and link must be provided together.` / `Banner not found.` |
| `delete_banner` | id | `Banner deleted.` | `Banner ID missing.` / `Banner not found.` |
| `toggle_banner_active` | id, active | `Banner activated.` / `Banner deactivated.` (+`banner`) | `Banner ID missing.` / `Banner not found.` |
| `preview_banner` | title, message, template, type, cta_text, cta_link | `{"success":true,"html":...}` | (none; no validation, empty title/message allowed in preview) |

Exact validation order/parsing per action (mirror in zod + handler):
- trim all string fields.
- `template` default `'simple-text'`; `type` default `'info'`.
- `audience` = `$_POST['audience']` or `[]`; must be non-empty array (create/update only). Values `guest|student|instructor|admin`.
- `priority = (int)`.
- `active = !empty($_POST['active'])`.
- CTA: if both `cta_text` and `cta_link` non-empty → `{text,link}`; if exactly one non-empty → error; if both empty → `null`.
- Schedule: if either `schedule_start` or `schedule_end` non-empty → `{start_at: start? date('Y-m-d H:i:s', strtotime(start)) : null, end_at: same}`; else `null`.
- `resurface_after_days`: `'' → null`, else `(int)`.
- `preview_banner` ignores audience/priority/active/id.

Redirects: no server redirect for banners (pure AJAX). Client reloads the page after success (`window.location.reload()` after 400-600ms). PRG is effectively client-driven; NEW should use fetch + `router.refresh()` or full reload, preserving the 400/600ms timing for delete/toggle vs 600ms for create/update.

---

## 3. banners.php — full DOM / classes / ids

### 3.1 Page structure
```
main.bnr-page-wrap
  div.bnr-page-inner
    div.bnr-page-header
      div.bnr-page-header-left
        div.bnr-page-icon  (bell svg 22x22, currentColor, stroke-width 2)
        div > h1.bnr-page-title "Announcement Banners"
              p.bnr-page-subtitle "Create and manage sitewide announcement banners targeted at specific audiences"
      button.bnr-btn.bnr-btn--primary #bnrAddBtn "+ Add New Banner"
    div.bnr-alert #bnrAlert style="display:none"
    [empty] div.bnr-empty > div.bnr-empty-icon (bell svg 48x48, stroke-width 1.5)
                          h3.bnr-empty-title "No banners yet"
                          p.bnr-empty-text "Create your first announcement banner to display across the site."
    [else] div.bnr-table-wrap > table.bnr-table
      thead > tr > th: Banner | Type | Audience | Schedule | Priority | Status | Actions
      tbody > tr[data-id]
        td.bnr-cell-banner > div.bnr-banner-title {title} + div.bnr-banner-message {mb_strimwidth(message,0,80,'...')}
        td > span.bnr-type-badge.bnr-type-badge--{type} {ucfirst(type)}
        td > div.bnr-audience-tags > span.bnr-audience-tag {ucfirst(a)} (per audience)
        td.bnr-cell-schedule { "MMM j, Y → MMM j, Y" or "—" }
        td.bnr-cell-priority {priority}
        td > span.bnr-status-dot.bnr-status-dot--{active|inactive} + text Active|Inactive
        td.bnr-cell-actions
          button.bnr-btn-sm.bnr-btn-sm--edit[data-action=edit][data-id][title=Edit] "Edit"
          button.bnr-btn-sm.bnr-btn-sm--toggle[data-action=toggle][data-id][data-active=1|0][title=Deactivate|Activate]
          button.bnr-btn-sm.bnr-btn-sm--delete[data-action=delete][data-id][title=Delete] "Delete"
```
- Schedule display: `start_at` formatted `M j, Y` or `—`; `end_at` same; joined `"{s} → {e}"`. Empty schedule (null or both empty) → `—`.
- Message truncation: `mb_strimwidth(...,0,80,'...')` (multibyte, 80 wide). NEW: replicate width-aware truncation (use a small helper; at minimum 80 chars + `...`).

### 3.2 Modal (always in DOM, `style="display:none"`)
```
div.bnr-modal-overlay #bnrModalOverlay
  div.bnr-modal[role=dialog][aria-modal=true][aria-label="Banner form"]
    div.bnr-modal-header > h2.bnr-modal-title #bnrModalTitle + button.bnr-modal-close #bnrModalClose aria-label=Close "&times;"
    form#bnrForm[autocomplete=off]
      input[type=hidden][name=csrf_token] value={csrf}
      input[type=hidden][name=id] #bnrFormId
      input[type=hidden][name=action] #bnrFormAction value="create_banner"
      div.bnr-modal-body
        .bnr-field > label.bnr-label[for=bnrTitle] "Title *" + input.bnr-input#bnrTitle[name=title][required][maxlength=255]
        .bnr-field > label.bnr-label[for=bnrMessage] "Message *" + textarea.bnr-textarea#bnrMessage[name=message][required][rows=3]
        .bnr-row
          .bnr-field > label[for=bnrTemplate] "Template" + select.bnr-select#bnrTemplate[name=template] {templates}
          .bnr-field > label[for=bnrType] "Type" + select.bnr-select#bnrType[name=type] info|warning|success|promo
        .bnr-field > label.bnr-label "Audience *" + div.bnr-checkbox-group (4 labels):
          label.bnr-checkbox-label > input.bnr-checkbox[type=checkbox][name="audience[]"][value=guest] " Guest"
          ... student, instructor, admin
          + div.bnr-field-error#bnrAudienceError style="display:none" "Select at least one audience."
        .bnr-field > label "CTA Button (optional)" + div.bnr-row:
          input.bnr-input#bnrCtaText[name=cta_text][placeholder="Button text"]
          input.bnr-input#bnrCtaLink[name=cta_link][placeholder="Button link (e.g. /browse-courses)"]
        .bnr-row:
          .bnr-field > label[for=bnrScheduleStart] "Schedule Start" + input.bnr-input#bnrScheduleStart[type=datetime-local][name=schedule_start]
          .bnr-field > label[for=bnrScheduleEnd]   "Schedule End"   + input.bnr-input#bnrScheduleEnd[type=datetime-local][name=schedule_end]
        .bnr-row:
          .bnr-field > label[for=bnrResurface] "Resurface After (days)" + input.bnr-input#bnrResurface[type=number][name=resurface_after_days][min=0][placeholder="Leave blank for permanent dismiss"]
          .bnr-field > label[for=bnrPriority]  "Priority"            + input.bnr-input#bnrPriority[type=number][name=priority][value=0][min=0]
        .bnr-field.bnr-field--checkbox > label.bnr-checkbox-label > input.bnr-checkbox#bnrActive[type=checkbox][name=active][value=1][checked] "Active"
        div.bnr-preview-wrap#bnrPreviewWrap style="display:none"
          div.bnr-preview-heading "Preview"
          div.bnr-preview-body#bnrPreviewBody
      div.bnr-modal-footer
        button.bnr-btn.bnr-btn--secondary#bnrPreviewBtn[type=button] "Preview"
        button.bnr-btn.bnr-btn--secondary#bnrModalCancel[type=button] "Cancel"
        button.bnr-btn.bnr-btn--primary#bnrSubmitBtn[type=submit] "Create Banner"
```
- Audience checkbox list in the markup is `guest, student, instructor, admin` (note: the task brief said all/student/instructor/admin; the actual UI uses **Guest**, not "all").
- The form's hidden `id`/`action` distinguish create vs update; `#bnrSubmitBtn` label toggles `Create Banner` / `Update Banner`.

### 3.3 Toast / alert
- `showToast(message,type)`: removes any existing `.bnr-toast`; appends `div.bnr-toast.bnr-toast--success|error` (textContent) to `body`; adds `.bnr-toast--show` after 10ms; removes class at 4000ms then removes node at +300ms.
- `showAlert` (unused by default flow except defined) writes `#bnrAlert` and auto-hides after 5s with a 0.4s fade.

---

## 4. send-notifications.php — details

### 4.1 Notification types (radio tiles) — `$notifTypes` (commented list, lines 13-15 & 29-36)
- `announcement` = "Announcement"
- `general` = "General"
- `promotional` = "Promotional"
- `featured_course` = "Featured Course"
- `new_course` = "New Course"
- `recommendation` = "Recommendation"
(Despite the doc comment also mentioning welcome/password_* /instructor_* /new_login — those are system types inserted elsewhere; only the six above are admin-sendable.)

### 4.2 Audience options — `$audienceOptions`
- `all` = "All Users"
- `student` = "Students Only"
- `instructor` = "Instructors Only"
- `admin` = "Admins Only"
- `specific` = "Specific User (by email)"
Select placeholder option value `""` label "— Select audience —".

### 4.3 Validation (exact, in order; first failure wins)
1. CSRF invalid → `sn_error = "Security token mismatch. Please refresh and try again."`, redirect to `$_SERVER['PHP_SELF']`.
2. `!array_key_exists($type,$notifTypes)` → `"Please select a valid notification type."`
3. `strlen($title) < 3` → `"Title must be at least 3 characters."`
4. `strlen($title) > 255` → `"Title must not exceed 255 characters."`
5. `strlen($body) < 5` → `"Message body is too short."`
6. `!array_key_exists($audience,$audienceOptions)` → `"Please select a valid audience."`
7. `audience==='specific' && empty($email)` → `"Please enter the user's email address."`
8. specific + no active user → `"No active user found with that email address."`
Note: `strlen` (bytes) not `mb_strlen`; `title` maxlength=255 on the input; body has no max length.

### 4.4 Send logic
- `$adminId = (int)($user['id'] ?? 0)`.
- `all` → `createNotificationForAll($type,$title,$body,$adminId)`.
- `student|instructor|admin` → `createNotificationForRole($audience,$type,$title,$body,$adminId)`.
- `specific` → `SELECT id FROM users WHERE email = ? AND is_active = 1 LIMIT 1`; on match `createNotification((int)target['id'],$type,$title,$body)`, `sentCount = result ? 1 : 0`.
- `sentCount>0` → session success `"Notification sent successfully to {label}. (1 record stored)"` where label ∈ {`all users`,`all students`,`all instructors`,`all admins`, the email, else `selected users`}.
- else → `"No users matched the selected audience, or the send failed."`
- Always PRG redirect to `$_SERVER['PHP_SELF']`.

### 4.5 The INSERT (functions/notifications.php) — CONFIRMATION
There is **no `admin_broadcast` type**. The exact inserts:
```
createNotification (specific):
  INSERT INTO notification_messages (type,title,body,audience,target_user_id,sent_by)
  VALUES (?,?,?,'specific',?,NULL)

createNotificationForRole:
  INSERT INTO notification_messages (type,title,body,audience,target_user_id,sent_by)
  VALUES (?,?,?,?,NULL,?)          -- audience = the role string; sent_by = $sentBy ?: null

createNotificationForAll:
  INSERT INTO notification_messages (type,title,body,audience,target_user_id,sent_by)
  VALUES (?,?,?,'all',NULL,?)
```
- `type` = one of the six admin types (or system types for other callers). Audience column values: `all` | `student` | `instructor` | `admin` | `specific`.
- **It does NOT create notification_reads rows.** Reads/deletes are per-user and created lazily only when the user reads/deletes (`markNotificationRead`, `deleteNotificationForUser`). Confirmed also by the success text "(1 record stored)".
- `sent_by` for specific sends is always `NULL` (even though admin triggered it) — preserve this quirk.
- Return values diverge intentionally: `createNotification` returns insert id/false; the role/all wrappers return `1`/`0`.

### 4.6 Reads / visibility (for parity of the frontend + updates page)
- Visibility clause (used by count/recent/all/byId):
  `(m.audience='all' OR m.audience=?role OR (m.audience='specific' AND m.target_user_id=?userId)) AND (r.deleted_at IS NULL OR r.deleted_at > NOW())`
  - count additionally requires `COALESCE(r.is_read,0)=0`; LEFT JOIN reads on `message_id && user_id`.
- `_getUserRole(userId)`: `SELECT role FROM users WHERE id=? LIMIT 1`, fallback `'student'`.
- `markNotificationRead`: `INSERT INTO notification_reads (message_id,user_id,is_read) VALUES (?,?,1) ON DUPLICATE KEY UPDATE is_read=1` → port to `INSERT ... ON CONFLICT (message_id,user_id) DO UPDATE SET is_read=true`.
- `markAllNotificationsRead`: selects unread visible ids then upserts each; returns true.
- `deleteNotificationForUser`: upsert `is_read=1, deleted_at=NOW()`.
- `notificationTypeLabel(type)`: welcome→Welcome, password_reset→Password Reset, password_changed→Security Alert, new_login→Security Alert, instructor_approved/rejected→Application, promotional→Promotion, general→General, featured_course→Featured Course, new_course→New Course, recommendation→Recommendation, announcement→Announcement, default→Notification.

### 4.7 Full DOM / classes
```
main.sn-wrap
  h1.sn-title "Send Notification"
  p.sn-subtitle "Compose and broadcast a notification to users on the platform."
  [flash] div.sn-alert.sn-alert--success[role=alert] {successMsg}
  [flash] div.sn-alert.sn-alert--error[role=alert] {errorMsg}
  div.sn-card
    form#snForm[method=POST][action=""][autocomplete=off]
      input[type=hidden][name=csrf_token]
      div.sn-field > span.sn-label "Notification Type" + div.sn-type-grid:
        label.sn-type-opt (per type, radio checked if $_POST['type']===slug)
          input[type=radio][name=type][value=slug][required]
          span.sn-type-label {label}
      hr.sn-divider
      div.sn-field > label.sn-label[for=snAudience] "Send To" + select#snAudience.sn-select[name=audience][required]
        option value="" "— Select audience —" + options
      div.sn-field.sn-email-field#snEmailField
        label.sn-label[for=snEmail] "User Email"
        input#snEmail.sn-input[type=email][name=email][placeholder=user@example.com][value=$_POST['email']]
        p.sn-hint "The notification will be sent only to this user."
      hr.sn-divider
      div.sn-field > label.sn-label[for=snTitle] "Title *" + input#snTitle.sn-input[name=title][maxlength=255][required][placeholder="e.g. New Course: Introduction to Python"] + div.sn-char-count > span#snTitleCount "0" + " / 255"
      div.sn-field > label.sn-label[for=snBody] "Message *" + textarea#snBody.sn-textarea[name=body][required][placeholder="Write the full notification message here…"] + div.sn-char-count > span#snBodyCount "0" + " characters"
      div.sn-preview#snPreview > div.sn-preview-label "Preview" + div.sn-preview-title#snPreviewTitle + div.sn-preview-body#snPreviewBody
      div.sn-footer > button.sn-btn-preview#snPreviewBtn[type=button] "Preview" + button.sn-btn-submit[type=submit] "Send Notification"
```
- Page uses radio tiles (`sn-type-grid` / `sn-type-opt` / `sn-type-label`) — the external `send-notifications.css` styles them with `data-type="<slug>"` selectors and icons, but the page's markup has **no `data-type` attribute and no `.sn-type-icon`**, so those CSS rules would not apply. The inline `<style>` in the page is what actually renders. The task brief requested reading that CSS file; record that it is aspirational/unused. NEW: prefer the page's inline styles for pixel parity; if the external CSS is adopted later, add `data-type` + icons in the same change.
- There is no "recent-sent list" table in this template (the brief asked to list one; the page contains none). Recent notifications are surfaced only via the navbar dropdown (`updates.php`). Record this absence explicitly — do not invent a table.

### 4.8 Inline `<script>` behaviour (send-notifications)
- `toggleEmailField()`: if `#snAudience.value === 'specific'` → add `.visible` to `#snEmailField` and set `emailInput.required = true`; else remove `.visible` and `required=false`. Runs on `change` and once on load (preserves POST-back selected state). Note inline `<style>` uses `.sn-email-field{display:none}` / `.visible{display:block}`.
- Character counters: `#snTitleCount` = title length, `#snBodyCount` = body length; updated on `input` and once on load.
- Preview: `#snPreviewBtn` click → if title and body both empty, hide preview; else set `#snPreviewTitle` = title || `"(no title)"`, `#snPreviewBody` = body || `"(no message)"`, add `.visible`, `scrollIntoView({behavior:'smooth',block:'nearest'})`.
- Live update: while preview is visible, title/body `input` updates the preview text (with the same fallbacks).
- NEW: replicate as a client component; no AJAX (classic form POST + PRG). CSRF via hidden input.

---

## 5. Security summary

### banners.php
- Role guard `requireRole(ROLE_ADMIN)` server-side.
- CSRF: `verifyCSRFToken($_POST['csrf_token'])` for **every** POST action before any work. Token from `generateCSRFToken()` embedded in the form and injected into JS-built FormData for toggle/delete/preview. Preserve/strengthen (Next: Origin/Host + token).
- Output escaping: all banner fields `htmlspecialchars` in table/preview. Titles/messages stored raw (NO sanitization, no max length beyond form `maxlength=255` on title; message unbounded). NEW: store raw but ALWAYS escape on output; do not strip HTML (parity), but since React escapes by default this is safe. Add `maxlength=255` parity for title in zod (max 255) and no max on message.
- Template include whitelist prevents path traversal (`in_array` against known template keys).
- IDs generated with `random_bytes`. `created_by/updated_by` from session.
- Audit logging via `logBannerEvent` → must become DB/console.
- No rate limiting on banner actions in PHP (admin-only). Keep admin-only; optionally add same.

### send-notifications.php
- Role guard `requireRole(ROLE_ADMIN)`.
- CSRF verified; on mismatch sets session flash + redirect (PRG), unlike banners (JSON). NEW should mirror: server action returns error state and re-renders, or redirect preserving flash.
- Title/body stored raw (HTML NOT sanitized) — output-escaping happens in the reader (`updates.php`/navbar). Preserve intended behaviour; escape on output.
- Length rules: title 3..255 bytes; body ≥5 bytes, no max. Enforce with zod.
- Specific-user existence check does not reveal role, only "No active user found with that email address." (admin-only, acceptable).
- No rate limiting in PHP (admin-only).

### Shared
- Session-based admin auth; all DB access server-side; RLS enabled with no policies; revoke from anon/authenticated.
- Do not log secrets; banner/notification content is user data, log only ids/events.

---

## 6. Inline `<script>` behaviour (banners.php)

- `qs`/`qsa` helpers; `allBanners = <?= json_encode($allBanners) ?>` embedded (client needs the full array for edit modal). NEW: pass as prop / fetch, never inline unsanitized HTML.
- `postForm(fd, cb)`: `XMLHttpRequest` POST to `window.location.href`, header `X-Requested-With: XMLHttpRequest`; on 200 JSON.parse (fallback "Invalid server response."), non-200 → `"Server error (status)."`, onerror → `"Network error."`. NEW: replicate message strings.
- `openModal(title, action, banner)`:
  - set `#bnrModalTitle`, `#bnrFormAction`, `#bnrSubmitBtn` text (create vs update), hide preview.
  - edit: fill id/title/message/template/type/cta text+link/priority/active/resurface; schedule `start_at`/`end_at` sliced `.substring(0,16)` for `datetime-local`; check audience boxes by `banner.audience.indexOf(value)!==-1`.
  - create: `#bnrForm.reset()`, clear id, `#bnrActive.checked=true`, `#bnrPriority='0'`.
  - hide `#bnrAudienceError`; show `#bnrModalOverlay` (`display:flex`).
- `closeModal()`: hide overlay.
- Add button → `openModal('Add New Banner','create_banner',null)`.
- Modal close/cancel and overlay-click-outside (`e.target === overlay`) → close.
- Preview button → FormData of `#bnrForm`, set action `preview_banner`, delete `id` and `csrf_token`, re-append token, POST; on success set `#bnrPreviewBody.innerHTML = html` and show `#bnrPreviewWrap`; else toast error.
- Submit → prevent default; require ≥1 audience checkbox (else show `#bnrAudienceError` and abort); require both-or-neither CTA (else toast `"Both CTA text and link must be provided together."`); POST; on success toast + close + reload after 600ms; else toast error.
- Toggle → build FormData (token, action `toggle_banner_active`, id, active = inverted `data-active`); success → toast + reload after 400ms.
- Delete → `confirm('Delete this banner permanently?')`; FormData (token, `delete_banner`, id); success → toast + reload after 400ms.
- NEW: convert to a client component. `confirm`/`alert` semantics preserved. Use fetch; keep exact message strings and reload timings.

---

## 7. PHP file/state that must move to DB (serverless)

- `private/data/banners.json` → `site_banners` (done in 001).
- `private/banner-templates/*.php` filesystem scan (`getAvailableBannerTemplates`) → static registry in code (no `scandir`).
- `private/logs/banners.log` (`BANNER_LOG_FILE`) from `logBannerEvent` → `security_events` table + `console`.
- PHP session flash keys `sn_success`/`sn_error` → Next flash mechanism (cookie or one-time query param) for the PRG.
- Any client dismiss state is already in `localStorage` (`sbn_dismissed_<id>` with `{version,dismissedAt}`) — that is browser state, keep as-is; it is version-keyed off the DB `version` column.
- No local temp files or locks needed (DB row-level writes replace file flock).

---

## 8. Notable discrepancies / porting cautions (record, do not silently "fix")

1. Page audience UI uses **Guest** (`value="guest"`), not `all` — unlike send-notifications audiences (`all`). Keep separate vocabularies.
2. `send-notifications.css` is NOT loaded by `send-notifications.php` (inline styles win). The external file references `data-type` and `.sn-type-icon` that the markup lacks.
3. `send-notifications.php` sets `$extraCss = '../assets/css/navbar.css'`, but `navbar.php` already links navbar.css → duplicate stylesheet on that page.
4. `banners.php` does not set navbar.css but relies on `navbar.php` linking it; `banners.css` header comment says navbar.css must load first, yet the applied cascade is base → banners → navbar. Verify computed result in ui-compare.
5. `updateBanner` version bump only watches title/message/template/type/cta; changing audience/schedule/priority/active/resurface does NOT bump version (dismissed banners stay hidden). Preserve.
6. `createNotification` for specific sends stores `sent_by = NULL` even though an admin triggered it. Preserve.
7. `strlen` (bytes) vs mb length for send-notifications validation — replicate byte semantics (zod `.max` uses JS code units; document the tiny divergence, or count UTF-8 bytes to match exactly).
8. No `CHECK` constraint yet on `site_banners.type`/`audience`; optionally add `CHECK (type IN (...))` when adding migration, but note it may reject legacy values.
9. `banners.php` has no "reorder" endpoint — ordering is only via the numeric `priority` field and `ORDER BY priority DESC`. There is no drag-reorder.
10. The task brief mentions an "all/student/instructor/admin" banner audience and a "recent-sent table" on send-notifications; neither exists verbatim (banner audience includes `guest`; no recent-sent table). Spec reflects the actual code.

---

## PORT CHECKLIST

Database
- [ ] `site_banners`, `notification_messages`, `notification_reads` migrations applied (001, 008); RLS on, privileges revoked.
- [ ] Optional `CHECK` on `site_banners.type` / audience values documented in `db-mapping.md`.

lib/db
- [ ] `banners.ts`: getAllBanners, createBanner (`bnr_`+12hex), updateBanner (content-change version bump on title/message/template/type/cta only), deleteBanner, toggleBannerActive, getActiveBannersForRole (priority DESC + schedule window + audience match), static template registry.
- [ ] `notifications.ts`: createNotification / ForRole / ForAll (exact INSERT columns + audience values, specific→sent_by NULL), getUnreadCount, getRecent, getAll, getById, markRead, markAllRead, deleteForUser (ON CONFLICT upserts), notificationTypeLabel.

Admin: banners (`app/(admin)/admin/banners`)
- [ ] Server guard requireRole admin; title `Manage Banners — Edulari Admin`; robots noindex,nofollow; navbar activeNav `banners`.
- [ ] Table DOM + classes/ids (`bnr-*`) reproduced 1:1 incl. type badge, audience tags, schedule format `M j, Y → M j, Y`, 80-width message trim, status dot, action buttons.
- [ ] Modal form 1:1 (fields, ids, maxlength=255, audience checkboxes guest/student/instructor/admin, CTA, datetime-local schedule, resurface, priority, active).
- [ ] Actions create_banner/update_banner/delete_banner/toggle_banner_active/preview_banner with exact messages + validation order + CTA pairing rule.
- [ ] Preview renders template shell HTML server-side against template whitelist; `$previewStyle` reproduced.
- [ ] CSRF on all POSTs; JSON responses; toast + reload timing (400/600ms); confirm dialog text.
- [ ] Three templates as React render map (`simple-text`, `icon-message`, `seasonal-promo`) with exact glyphs/badges/classes.

Admin: send-notifications (`app/(admin)/admin/send-notifications`)
- [ ] Guard admin; title `Send Notifications – Edulari`; noindex,nofollow.
- [ ] Six type radio tiles; five audience options incl. specific.
- [ ] Validation exact order/messages (title 3..255, body ≥5, valid type/audience, specific email, active-user lookup).
- [ ] INSERT via the three helpers (one row; NO notification_reads rows).
- [ ] PRG with flash success `"Notification sent successfully to {label}. (1 record stored)"` / error strings.
- [ ] Inline script behaviour: email show/hide + required, char counters, preview toggle + live update + fallbacks `(no title)`/`(no message)`.

Frontend / shared
- [ ] `SiteBanners` component from `partials/site-banners.php` (fixed stack, collapse/peek scroll states, localStorage dismiss keyed by id+version+resurface days) used by navbar layout.
- [ ] navbar notifications dropdown + `updates.php` consumption unaffected (roles visibility clause).

CSS / parity
- [ ] `banners.css` + `send-notifications.css` copied verbatim; inline `sn-*` styles reproduced; confirm cascade order per page.
- [ ] Run `npm run ui-compare` for both admin pages (and a navbar page for SiteBanners) at all viewports; record in `docs/UI_PARITY_REPORT.md`; note unavailable old-site limitations if any.
- [ ] `php-stylesheet-order`, `css-usage`, `css-conflicts`, `php-chrome-map` pass for these templates.

Docs / build
- [ ] `docs/feature-matrix.md` + `PROGRESS.md` updated; discrepancies §8 recorded.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` pass.
