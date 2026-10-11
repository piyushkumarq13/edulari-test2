# Phase 9 — Admin Categories / Enrollments / Reviews → Next.js Port Spec

Source of truth (read-only):
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\categories.php` (906 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\enrollments.php` (924 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\reviews.php` (603 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\assets\css\admin\categories.css` (1036 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\assets\css\admin\reviews-enrollments.css` (897 lines)

Related read files: `public/partials/head.php`, `public/navbar.php`, `public/footer.php`,
`private/functions/admin.php`, `private/functions/student.php`, `private/auth.php`,
`private/config.php`, `docs/schema/mysql_schema.txt`.

Target routes (Next App Router, server components, Node runtime):
- `/admin/categories`
- `/admin/enrollments`
- `/admin/reviews`

Legacy PHP URLs `/admin/categories.php`, `/admin/enrollments.php`, `/admin/reviews.php` must
301-redirect to the clean URLs (htaccess parity, `next.config` `redirects()`).

> **CSS FACT (verified):** `reviews.css` and `enrollments.css` **do not exist** in the repo and are
> **not loaded**. The header comment inside `reviews-enrollments.css` says "For reviews: also add
> reviews.css / For enrollments also add enrollments.css", but that is stale documentation. Both
> `enrollments.php` and `reviews.php` set `$extraCss = '../assets/css/admin/reviews-enrollments.css'`
> and nothing else. The new pages must load exactly: `base.css` (head) → `navbar.css` (navbar.php)
> → `reviews-enrollments.css`/`categories.css`. Do NOT create the missing files.

---

# SHARED CONTEXT (all three pages)

### Includes (in order)
Categories: `../../private/bootstrap.php`, `config.php`, `db.php`, `auth.php`, then (after guard)
`functions/admin.php`.
Enrollments: `bootstrap.php`, `config.php`, `db.php`, `auth.php`, `functions/admin.php`,
`functions/student.php` (before guard).
Reviews: `bootstrap.php`, `config.php`, `db.php`, `auth.php`, `functions/admin.php`.

### Guard
`requireRole(ROLE_ADMIN);` on all three (`private/auth.php:545`). It calls `requireLogin()` then,
if `$_SESSION['user_role'] !== 'admin'`, `redirectBasedOnRole()` → `/admin/dashboard` for admin,
`/instructor/dashboard` for instructor, `/` fallback; guests → `/login`. Admin-only; no non-admin
ever sees HTML. In Next: server guard `requireRole('admin')` before render.

### Context vars
`$user = getCurrentUser();` and `$activeNav` = `'categories'` / `'enrollments'` / `'reviews'`
(legacy nav key used by navbar active-link detection).

### Page chrome
Each page includes `../partials/head.php` in `<head>`, then `<body>` → `../navbar.php` →
`<main>` → page markup → page `<script>` → `../footer.php`.
- `head.php` loads (in order): meta charset/viewport, title, robots, OG/Twitter tags, Google
  **Inter** font (300–800), favicon set, `/assets/css/base.css`.
- `navbar.php` loads `/assets/css/navbar.css` and renders the full admin navbar
  (admin links: Dashboard, Users, Courses▾, Applications, Enrollments, Categories, Reviews,
  Bug Reports, Contact Inbox, Settings, Banners, Support▾) plus the admin maintenance banner
  and site banners. **Navbar is per-template** — only pages that include `navbar.php` may load
  `navbar.css` (it declares global `body { padding-top }`).
- Footer partial included last.
- Root CSS vars: `:root { --ad-nav-height: 64px }` (declared in both CSS files; must load
  `navbar.css` first because `--ad-*` vars / `.ad-page-wrap` come from it).

### Fonts
Only **Inter** is loaded. `categories.css` references `'DM Mono', monospace` for
`.cat-id-badge`, `.cat-slug`, `.cat-input-hint`, `.cat-color-preview`, but DM Mono is never
loaded → falls back to the generic monospace stack. Preserve as-is.

### Dead code to preserve (parity)
Every page ends with
`document.getElementById('fontStylesheet')?.addEventListener('load', ...)`. There is **no**
element with `id="fontStylesheet"` in `head.php`, so this is a no-op. Port as harmless no-op.

### CSP nonce
All inline `<script>` tags use `nonce="<?= CSP_NONCE ?>"` (`CSP_NONCE` defined in
`private/bootstrap.php:42`, random per-request). In Next use the app's CSP nonce mechanism.

### Timezone / date rendering
`date()` uses the PHP default timezone (server). Displayed formats:
- Categories: none.
- Enrollments: `date('M d, Y', strtotime($enrolled_at))` and `date('h:i A', ...)` in the table;
  `date('F d, Y – h:i A', ...)` (en dash) in the detail modal data attributes.
- Reviews: `date('M d, Y')` + `date('h:i A')`; modal `date('F d, Y – h:i A')`.
Store `timestamptz` UTC; format with the same pattern (month abbreviations, 12-hour AM/PM).

### Money helper
`formatPrice(float $price, bool $htmlWrap = true)` (`private/config.php:229`): price ≤ 0 returns
`'Free'`; otherwise converts INR and returns `CURRENCY_DISPLAY_SYMBOL . number_format($converted, 2)`.
Pages call it with `$htmlWrap = false` (plain string). Port conversion + symbol logic.

---

# PAGE 1 — CATEGORIES (`public/admin/categories.php`)

## 1. Purpose / URL / guard / title / robots
- **Purpose:** CRUD for course categories. Header stat cards, searchable/sortable table, bulk
  selection + bulk delete, create/edit modal, single delete confirm modal.
- **URL:** `/admin/categories` (file at `public/admin/categories.php`; links are relative).
- **Guard:** `requireRole(ROLE_ADMIN)` (line 8). `$activeNav = 'categories'`.
- **Title:** `'Manage Categories — Admin Panel'` (**em dash U+2014**, no site name).
- **Robots:** `$pageRobots = 'noindex, nofollow';` (explicit; head would also auto-set it).
- **CSS:** `../assets/css/admin/categories.css` (`$extraCss`), loaded after `base.css`.
  `navbar.css` loaded by navbar include.
- **No** canonical/description/keywords/OG overrides.

## 2. Local helper functions (defined IN PAGE, not admin.php)
> **SURPRISE:** The page defines its **own** `fetchCategories()` and `generateSlug()` and does
> **not** call `getAllCategories()`, `adminCreateCategory()`, `adminUpdateCategory()` or
> `adminDeleteCategory()` from `admin.php`. The admin.php versions (`createCategory`,
> `updateCategory`, `deleteCategory`, `createSlug`, `getAllCategories`, `adminCreateCategory`,
> `adminUpdateCategory`, `adminDeleteCategory`) are **unused by this page**. Both slug algorithms
> differ subtly (see below). Port the page's inline logic.

### `fetchCategories($search = '', $sortBy = 'name', $sortDir = 'ASC')`
- Whitelists `$sortBy` ∈ `['id','name','slug','course_count']` else `'name'`.
- Whitelists `$sortDir` ∈ `['ASC','DESC']` else `'ASC'`.
- SQL:
  ```sql
  SELECT c.id, c.name, c.slug, c.description,
         (SELECT COUNT(*) FROM courses WHERE category_id = c.id)                      AS course_count,
         (SELECT COUNT(*) FROM courses WHERE category_id = c.id AND is_published = 1) AS published_count
  FROM categories c
  ```
- `course_count` ordering uses `ORDER BY course_count {dir}, c.name ASC`; other sorts use
  `ORDER BY c.{sortBy} {dir}`.
- If `$search` non-empty: `WHERE (c.name LIKE ? OR c.description LIKE ? OR c.slug LIKE ?)` with
  `'%'.$search.'%'` ×3. Returns `dbSelect(...)`. `false` is coerced to `[]` by the caller.

### `generateSlug($name, $excludeId = null)`
1. `strtolower(trim($name))`
2. strip every char not in `[a-z0-9\s-]`
3. `\s+` → `-`
4. `-+` → `-`
5. `trim($slug, '-')`
6. `SELECT id FROM categories WHERE slug = ?` (`AND id != ?` if `$excludeId`) — if a row exists,
   append `'-' . time()` (Unix seconds). **No loop/counter** — a second collision in the same
   second still produces a duplicate suffix (DB unique key would then reject).

> Compare `admin.php createSlug()` (line 550): replaces non `[a-z0-9-]` with `-` **before**
> collapsing, so it converts spaces and punctuation both to `-` (differs from page version which
> converts spaces to `-` but deletes punctuation). `adminUpdateCategory` regenerates slug on every
> update; page `update` passes `$excludeId = $catId` (so editing without renaming keeps slug).
> Port the **page** version.

## 3. GET params
| Param | Type | Allowed / default | Use |
|---|---|---|---|
| `msg` | string | free text | success flash; `htmlspecialchars($_GET['msg'])` then echoed |
| `search` | string | free text, trimmed | filter (LIKE name/description/slug) |
| `sort` | string | `id,name,slug,course_count` (whitelisted) | sort column |
| `dir` | string | `ASC`/`DESC` (ucfirst check) | sort direction |

- `$search = trim($_GET['search'] ?? '')`.
- `$sortBy = $_GET['sort'] ?? 'name'`.
- `$sortDir = strtoupper($_GET['dir'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC'`.

## 4. POST actions
All POST bodies are `application/x-www-form-urlencoded`, `method="POST"`, and **require a valid
CSRF token** (`csrf_token`). On invalid token:
`error = "Invalid request token. Please refresh and try again."`, `messageType='error'` (no redirect).
`$action = $_POST['action'] ?? ''`.

### 4.1 `action=create`
- Fields: `csrf_token`, `action=create`, `name` (trim), `description` (trim).
- Validation: `empty($name)` → `error = "Category name is required."`.
- Else `$slug = generateSlug($name)`; `dbInsert("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)", [$name,$slug,$description])`.
- Success: `$message = "Category " . htmlspecialchars($name) . " created successfully."` then
  `header('Location: categories.php?msg=' . urlencode($message))`, exit (**PRG**).
- Failure: `error = "Failed to create category. Please try again."`.

### 4.2 `action=update`
- Fields: `csrf_token`, `action=update`, `category_id`, `name` (trim), `description` (trim).
- Validation: `empty($name) || $catId <= 0` → `error = "Category name and a valid ID are required."`.
  (`$catId = intval($_POST['category_id'] ?? 0)`.)
- Else `$slug = generateSlug($name, $catId)`;
  `dbExecute("UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?", [$name,$slug,$description,$catId])`.
- Success condition: `$result !== false` (**0 rows affected still counts as success**).
  Message `"Category updated successfully."`, PRG redirect.
- Failure: `error = "Failed to update category. Please try again."`.

### 4.3 `action=delete`
- Fields: `csrf_token`, `action=delete`, `category_id`.
- `$catId = intval(...)`; if `<= 0` → `error = "Invalid category ID."`.
- Else count courses: `SELECT COUNT(*) AS cnt FROM courses WHERE category_id = ?`; guard
  `false`/`null` → count 0.
- If `count > 0` → `UPDATE courses SET category_id = NULL WHERE category_id = ?` (reassign to NULL).
- `DELETE FROM categories WHERE id = ?`. Success if `!== false`:
  `$note = $courseCount > 0 ? " {$courseCount} course(s) were unassigned." : ""`;
  `$message = "Category deleted successfully.{$note}"`, PRG redirect.
- Failure: `error = "Failed to delete category. Please try again."`.

### 4.4 `action=bulk_delete`
- Fields: `csrf_token`, `action=bulk_delete`, `selected_ids[]` (array).
- `$ids = array_values(array_filter(array_map('intval', (array)$_POST['selected_ids'])));`
- If empty → `error = "No categories selected for deletion."`.
- Else placeholders (`?,?,…`):
  `UPDATE courses SET category_id = NULL WHERE category_id IN (...)` then
  `DELETE FROM categories WHERE id IN (...)`.
  `$count = ($deleted !== false) ? (int)$deleted : count($ids);`
  `$message = "{$count} category/categories deleted successfully."`, PRG redirect.

> **POST redirect target** is relative `categories.php?msg=...` → in Next use
> `redirect('/admin/categories?msg=' + encodeURIComponent(msg))`.

## 5. DB reads (columns)
Tables: `categories` (`id`,`name`,`slug`,`description`,`created_at`), `courses`
(`category_id`,`is_published`, plus count). Derived on page:
- `$totalCategories = count($categories)`
- `$totalCourses = array_sum(course_count)`
- `$emptyCategories = count(course_count === 0)`
- `$avgCourses = $totalCategories > 0 ? round($totalCourses / $totalCategories, 1) : 0`
- `$published_count` per row (books) shown as "Published".

Schema reference (`mysql_schema.txt:88`): `categories(id int AI, name varchar(100) NOT NULL,
slug varchar(100) NOT NULL UNIQUE, description text NULL, created_at datetime DEFAULT NOW)`.
`courses.category_id int NULL`, `courses.is_published tinyint(4) DEFAULT 0`,
`courses.title varchar(255)`, `courses.slug varchar(255) UNIQUE`.

## 6. Validations & security
- CSRF on every POST (create/update/delete/bulk_delete). No CSRF bypass.
- Role guard admin-only (server).
- `name` required (create + update); `description` optional but DB null allowed; input `maxlength`
  100 (name) / 500 (description) enforced client-side only (server does not enforce length).
- Slug collisions resolved by appending `-{time()}`; DB unique on `slug` remains the hard gate.
- Output escaped: names/slug/description escaped with `htmlspecialchars`; data-* use
  `htmlspecialchars(..., ENT_QUOTES|ENT_HTML5, 'UTF-8')`; delete modal writes via `textContent`.
- Delete reassigns courses to `category_id = NULL` (does **not** delete courses).
- **No self-protection / cannot-delete-last / ownership checks** — any admin may delete any category.

## 7. Full DOM structure (classes & ids)

### Page shell
- `main.cat-page-wrap#mainContent` → `div.cat-page-inner`
  - `div.cat-page-header`
    - `div.cat-page-title-group` → `div.cat-page-icon` (folder SVG) ; `div` → `h1.cat-page-title` "Categories" ; `p.cat-page-subtitle` "Organise your course library with categories"
    - `button.cat-btn.cat-btn--primary.cat-open-modal[data-modal="addModal"][aria-label="Add new category"]` (+ plus SVG) "Add Category"
  - Alert (only if `$message` or `$error`):
    `div.cat-alert.cat-alert--success#catAlert[role=alert]` **or** `div.cat-alert.cat-alert--error#catAlert` → `div.cat-alert-icon` (check / alert SVG) ; `span` (escaped text) ; `button.cat-alert-close[aria-label="Dismiss"]` `&times;`
  - `div.cat-stats-grid` → 4 × `div.cat-stat-card`:
    1. `div.cat-stat-icon.cat-stat-icon--blue` + `div.cat-stat-body` → `span.cat-stat-value` totalCategories, `span.cat-stat-label` "Total Categories"
    2. `--green` → `span.cat-stat-value` totalCourses, label "Total Courses"
    3. `--amber` → `span.cat-stat-value` emptyCategories, label "Empty Categories"
    4. `--purple` → `span.cat-stat-value` avgCourses, label "Avg Courses / Category"
  - `div.cat-toolbar`
    - `form.cat-search-form[method=GET][role=search][aria-label="Search categories"]`
      - `div.cat-search-wrap` → `svg.cat-search-icon[aria-hidden]` ; `input.cat-search-input[type=search][name=search][placeholder="Search categories…"][value]` ; if `$search`: `a.cat-search-clear[href="categories.php"][aria-label="Clear search"]` `&times;`
      - `input[type=hidden][name=sort][value]`, `input[type=hidden][name=dir][value]`
      - `button.cat-btn.cat-btn--secondary[type=submit]` "Search"
    - `div.cat-toolbar-actions`
      - `div.cat-sort-group` → `label.cat-sort-label[for=sortSelect]` "Sort:" ; `select.cat-select#sortSelect` options (value → text):
        `name|ASC` Name A–Z · `name|DESC` Name Z–A · `course_count|DESC` Most Courses ·
        `course_count|ASC` Fewest Courses · `id|DESC` Newest First · `id|ASC` Oldest First
        (one marked `selected` matching current sort/dir)
      - `button.cat-btn.cat-btn--danger.cat-bulk-delete-btn#bulkDeleteBtn[type=button][disabled]` (trash SVG) "Delete Selected (" `span#selectedCount` "0" ")"
  - If categories:
    - `div.cat-table-wrap` → `form#bulkForm[method=POST]`
      - hidden `csrf_token` ; hidden `action=bulk_delete`
      - `table.cat-table[aria-label="Categories list"]`
        - `thead > tr`: `th.cat-th-check` (`input#selectAll.cat-checkbox[aria-label="Select all"]`) · `th` Category · `th` Slug · `th` Description · `th.cat-th-center` Total Courses · `th.cat-th-center` Published · `th.cat-th-center` Actions
        - `tbody` → per row `tr.cat-row`:
          - `td.cat-td-check` → `input.cat-checkbox.cat-row-check[name="selected_ids[]"][value=id][aria-label="Select {name}"]`
          - `td` → `div.cat-name-cell` → `div.cat-name-avatar` (first letter uppercased via `mb_strtoupper(mb_substr(name,0,1))`) ; `div` → `span.cat-name-text` name · `span.cat-id-badge` "#{id}"
          - `td` → `code.cat-slug` slug
          - `td.cat-desc-cell` → if desc: `span.cat-desc-text[title=full]` (truncated `mb_substr(0,80).'…'` when `mb_strlen>80`) else `span.cat-empty-desc` "No description"
          - `td.cat-td-center` → `span.cat-badge.cat-badge--blue` if count>0 else `--gray`
          - `td.cat-td-center` → `span.cat-badge.cat-badge--green` if published>0 else `--gray`
          - `td.cat-td-center` → `div.cat-actions`:
            - `button.cat-action-btn.cat-action-btn--edit.cat-open-modal[data-modal=editModal][data-id][data-name][data-description]` (edit SVG) "Edit"
            - `a.cat-action-btn.cat-action-btn--view[href="courses.php?category={id}"][aria-label="View courses"]` (eye SVG) "Courses"
            - `button.cat-action-btn.cat-action-btn--delete.cat-delete-trigger[data-id][data-name][data-count]` (trash SVG) "Delete"
      - `div.cat-table-footer` → `span.cat-table-info`: "Showing <strong>{count}</strong> categor{y|ies}" + if search: ` for "<em>{search}</em>"`
  - Else (`div.cat-empty`):
    - `div.cat-empty-icon` (folder-plus SVG)
    - if search: `h3.cat-empty-title` "No categories found" ; `p.cat-empty-text` `No results for "<strong>{search}</strong>". Try a different term.` ; `a.cat-btn.cat-btn--secondary[href="categories.php"]` "Clear Search"
    - else: `h3.cat-empty-title` "No categories yet" ; `p.cat-empty-text` "Get started by creating your first category to organise your courses." ; `button.cat-btn.cat-btn--primary.cat-open-modal[data-modal=addModal]` "Create First Category"

### Add modal
`div.cat-modal-overlay#addModal[role=dialog][aria-modal=true][aria-labelledby=addModalTitle]`
→ `div.cat-modal` → `div.cat-modal-header` → `h2.cat-modal-title#addModalTitle` (plus SVG) "Add New Category" ; `button.cat-modal-close[data-close-modal=addModal][aria-label="Close"]` `&times;`
`form.cat-modal-body[method=POST][novalidate]`:
- hidden `csrf_token` ; hidden `action=create`
- `div.cat-form-group` → `label.cat-label[for=add_name]` "Category Name " `span.cat-required` "*" ; `input#add_name.cat-input[type=text][name=name][placeholder="e.g. Web Development"][required][maxlength=100][autocomplete=off]` ; `span.cat-input-hint#addSlugPreview`
- `div.cat-form-group` → `label.cat-label[for=add_description]` "Description" ; `textarea#add_description.cat-textarea[name=description][rows=3][placeholder="Brief description of this category…"][maxlength=500]` ; `span.cat-char-count` → `span#addDescCount` "0" " / 500"
- `div.cat-modal-footer` → `button.cat-btn.cat-btn--ghost[data-close-modal=addModal][type=button]` "Cancel" ; `button.cat-btn.cat-btn--primary[type=submit]` (plus SVG) "Create Category"

### Edit modal
`div.cat-modal-overlay#editModal[...]` → `h2.cat-modal-title#editModalTitle` (edit SVG) "Edit Category" ; close `[data-close-modal=editModal]`.
form body hidden: `csrf_token`, `action=update`, `category_id#edit_category_id`.
- `label[for=edit_name]` ; `input#edit_name.cat-input[name=name][required][maxlength=100][autocomplete=off]` ; `span.cat-input-hint#editSlugPreview`
- `label[for=edit_description]` ; `textarea#edit_description.cat-textarea[name=description][rows=3][maxlength=500]` ; `span.cat-char-count` → `span#editDescCount`
- footer: "Cancel" ghost + `button.cat-btn.cat-btn--primary[type=submit]` (save SVG) "Save Changes"

### Delete confirm modal
`div.cat-modal-overlay#deleteModal[...]` → `div.cat-modal.cat-modal--sm`:
- `div.cat-modal-header.cat-modal-header--danger` → `h2.cat-modal-title#deleteModalTitle` (warning SVG) "Delete Category" ; close `[data-close-modal=deleteModal]`
- `div.cat-modal-body` → `p.cat-delete-msg#deleteMessage` "Are you sure you want to delete this category?" (JS overrides) ; `div.cat-delete-warning#deleteWarning[style="display:none"]` → alert SVG ; `span#deleteWarningText`
- `form#deleteForm[method=POST]` hidden `csrf_token`, `action=delete`, `category_id#delete_category_id` ; `div.cat-modal-footer` → "Cancel" ghost + `button.cat-btn.cat-btn--danger[type=submit]` (trash SVG) "Yes, Delete"

### Backdrop
`div.cat-overlay-backdrop#overlayBackdrop`

### CSS classes present but UNUSED in markup (color picker remnants)
`.cat-color-dot`, `.cat-color-wrap`, `.cat-color-input`, `.cat-color-preview`,
`.cat-form-row`, `.cat-form-row--halves`, `.cat-form-group--full`. Keep the CSS (verbatim) even
though markup does not use them.

## 8. Inline `<script>` (IIFE, `'use strict'`)
- **`toSlug(str)`** — mirrors `generateSlug` client-side for live preview.
- **Modal helpers:** `openModal(id)` adds `cat-modal-overlay--open`, shows `#overlayBackdrop`
  (`cat-overlay-backdrop--visible`), sets `body.overflow=hidden`, focuses first input/textarea
  after 80 ms. `closeModal(id)`; `closeAll()` removes all open + backdrop.
- **Open triggers:** `.cat-open-modal` click → if `data-modal==='editModal'` call
  `populateEditModal(btn)`, then `openModal(target)`.
- **`populateEditModal(btn)`** sets `#edit_category_id`, `#edit_name`, `#edit_description` from
  `data-id`/`data-name`/`data-description` (writes `.value`, never innerHTML), updates char count
  and slug preview.
- **Slug previews:** input on `#add_name`/`#edit_name` → `#addSlugPreview`/`#editSlugPreview`
  text `'Slug: ' + slug` (empty when blank).
- **Char counters:** `#add_description`→`#addDescCount`, `#edit_description`→`#editDescCount`.
- **Delete trigger** (`.cat-delete-trigger`): sets `#delete_category_id`, sets
  `#deleteMessage.textContent = 'Are you sure you want to delete "' + name + '"? This action cannot be undone.'`;
  if `data-count > 0` shows `#deleteWarning` (`display:flex`) with
  `warnTxt = count + ' course(s) will be unassigned from this category.'` else hides it; opens delete modal.
- **Bulk select:** `#selectAll` change toggles all `.cat-row-check`; each row-check change unchecks
  `#selectAll` if unchecked; `updateBulkUI()` sets `#selectedCount` and toggles
  `#bulkDeleteBtn.disabled`.
- **Bulk delete:** `#bulkDeleteBtn` click → if n=0 return; `confirm('Delete ' + n + ' selected categor' + (n===1?'y':'ies') + '? Courses will be unassigned.')`; if OK `#bulkForm.submit()`.
- **Sort select** `#sortSelect` change → split value on `|` → set URL `sort`/`dir` → navigate.
- **Alert close** `.cat-alert-close` → remove parent.
- **Auto-dismiss** `#catAlert` after 5000 ms: fade opacity/translate, remove after 420 ms.
- **Close** via `[data-close-modal]`, backdrop click = `closeAll`, `Escape` = `closeAll`.

## 9. Public-page revalidation
Category create/update/delete/bulk-delete change public navigation, category listing and course
grouping. **Must** call on-demand revalidation:
`revalidateTag('categories')`, and `revalidatePath`/tag for `/` (home), `/categories`,
`/browse-courses`, `/category/{slug}` (all slugs of affected categories — for delete, revalidate
the deleted slug too). Slug changes also change `/category/{slug}` URLs. Confirm at build which
public pages render categories (home, categories, browse, category detail) and revalidate all
of them.

## 10. Port checklist (categories)
See global checklist at end; also: reassign courses→NULL on single AND bulk delete; slug
`-{time()}` collision rule; `$result !== false` update semantics; 5 s auto-dismiss; sort delimiter
`|`; data-* ENT_QUOTES|ENT_HTML5; `#mainContent` id; rename of column to `is_published`.

---

# PAGE 2 — ENROLLMENTS (`public/admin/enrollments.php`)

## 1. Purpose / URL / guard / title / robots
- **Purpose:** View/filter/paginate all enrollments; manual free enroll of a student; force
  unenroll (deletes all progress); verify a Razorpay payment id and re-enroll.
- **URL:** `/admin/enrollments`. `$activeNav = 'enrollments'`.
- **Guard:** `requireRole(ROLE_ADMIN)` (line 9). Also requires `functions/student.php`.
- **Title:** `'Enrollments – Admin | ' . htmlspecialchars(SITE_NAME)` (**en dash U+2013** = `–`).
- **Robots:** `noindex, nofollow`.
- **CSS:** `../assets/css/admin/reviews-enrollments.css`.
- Renders its **own** toast element `#enToast` (not the `.cat-alert` pattern).

## 2. GET params / filters / pagination
| Param | Type | Default | Use |
|---|---|---|---|
| `search` | string, trimmed | `''` | `(u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)`, `'%'.$search.'%'` ×3 |
| `course_id` | int | 0 | `e.course_id = ?` when > 0 (filter select `name="course_id"`) |
| `page` | int | 1 | `max(1, intval(...))`; `$perPage = 20`; `$offset = (page-1)*20` |

- `$totalPages = max(1, ceil($total/$perPage))`; then `$page = min($page, $totalPages)`.
- `$whereSQL = WHERE ... AND ...` built from clauses.
- Dropdown data:
  - `$students = SELECT id, name, email FROM users WHERE role = 'student' ORDER BY name`
  - `$courses  = SELECT id, title, price FROM courses ORDER BY title`
- `$csrfToken = generateCSRFToken();`

## 3. POST actions (all AJAX, JSON)
Trigger: `$_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax'])` → sets
`Content-Type: application/json`. CSRF required (`csrf_token`); on fail
`{"success":false,"message":"Invalid CSRF token."}`. Unknown action →
`{"success":false,"message":"Unknown action."}` (HTTP 200 for all).

### 3.1 `enroll` (`enroll=1`, plus `ajax=1`, `csrf_token`, `student_id`, `course_id`)
Calls `adminEnrollStudent(intval(student_id), intval(course_id))`:
- `'already_enrolled'` → `{success:false, message:"This student is already enrolled in that course."}`
- truthy → `{success:true, message:"Student enrolled successfully."}`
- else → `{success:false, message:"Enrollment failed. Make sure IDs are valid."}`

`adminEnrollStudent` (`admin.php:676`): if enrollment exists for (student,course) → `'already_enrolled'`;
if user id not found with `role='student'` → false; if course not found → false; else
`INSERT INTO enrollments (student_id, course_id, enrolled_at, progress_percentage) VALUES (?, ?, NOW(), 0)`.

### 3.2 `unenroll` (`unenroll=1`, `enrollment_id`)
Calls `adminUnenrollStudent(intval(enrollment_id))` → true/false:
- true → `{success:true, message:"Student unenrolled successfully."}`
- false → `{success:false, message:"Failed to unenroll student."}`

`adminUnenrollStudent` (`admin.php:699`): inside a transaction deletes
`lesson_progress`, `quiz_attempts`, `assignment_submissions`, then the `enrollments` row, commit;
on exception `error_log("Admin unenroll error: " . msg)`, rollback, false.
> **SURPRISE:** does **not** delete `certificates` rows, and does not touch `purchase_history`.

### 3.3 `verify_and_enroll` (`verify_and_enroll=1`, `payment_id`)
- `$paymentId = trim(...)`; empty → `"Payment ID is required."`
- Format gate: `preg_match('/^pay_[A-Za-z0-9]{14,}$/', $paymentId)` else
  `"Invalid Payment ID format."` (client mirrors with `/^pay_[A-Za-z0-9]{14,}$/`).
- `$purchase = getPurchaseByPaymentId($paymentId);` (admin mode — **no student_id filter**;
  joins users → adds `student_name`, `student_email`; decodes `courses_json` into `courses[]`).
  - null → `"No verified payment found with that Payment ID."`
  - `status==='enrolled'` → `"Student is already enrolled for this payment. No action needed."`
  - `status==='refunded'` → `"This payment was refunded. Cannot enroll."`
- Transaction: for each `$purchase['courses']` entry with `course_id >= 1`:
  - if `isEnrolled($purchase['student_id'], $cId)` → `$skipped++`, continue.
  - else `enrollStudent($purchase['student_id'], $cId)`; success → `$enrolled++`; failure whose
    message !== `'Already enrolled in this course'` → push `"Course ID {id}: {message}"` to errors.
  - commit; on exception rollback + `error_log('Admin verify_and_enroll failed: ' . msg)` +
    `"Enrollment failed due to a server error. Check error logs."`
- `updatePurchaseStatus((int)$purchase['id'], 'enrolled', $enrolled + $skipped);`
- Success message: `"Done. Student: {$studentLabel}. Enrolled in {$enrolled} course(s)."` where
  `$studentLabel = htmlspecialchars($purchase['student_name'].' ('.$purchase['student_email'].')')`.
  If `$skipped>0` append `" {$skipped} already enrolled (skipped)."`. If errors append
  `' Errors: '.implode(', ', $errors)`.

> `enrollStudent` (`student.php:100`) blocks instructors (`isInstructor()` → "Instructors cannot
> enroll in courses."), returns `Already enrolled in this course` when present, else inserts.
> `isEnrolled` (`student.php:89`) returns row (or false). `updatePurchaseStatus`
> (`student.php:678`) whitelists statuses `['paid','enrollment_failed','enrolled']`.

## 4. DB reads (columns)
- Count query joins `enrollments e` → `users u` (student) → `courses c` → `users i` (instructor).
- Row query columns: `e.id, e.enrolled_at, e.progress_percentage, u.id AS student_id,
  u.name AS student_name, u.email AS student_email, c.id AS course_id, c.title AS course_title,
  c.price, i.name AS instructor_name`. `ORDER BY e.enrolled_at DESC LIMIT ? OFFSET ?`.
- Summary stats (unfiltered):
  - `totalEnrollments = COUNT(*) FROM enrollments`
  - `totalRevenue = COALESCE(SUM(c.price),0) FROM enrollments e JOIN courses c ON e.course_id=c.id`
  - `avgProgress = ROUND(AVG(progress_percentage),1) FROM enrollments` (rendered `{n}%`)
  - `freeEnrollments = COUNT(*) ... WHERE c.price = 0`
- Schema (`mysql_schema.txt:243`): `enrollments(id, course_id, student_id, enrolled_at datetime
  DEFAULT NOW, completed_at datetime NULL, progress_percentage int DEFAULT 0, final_grade
  decimal(5,2) NULL; UNIQUE(course_id,student_id))`.

## 5. Validations & security
- Admin-only guard.
- CSRF on all three AJAX actions.
- `enroll`: IDs cast with `intval`; `adminEnrollStudent` re-validates student role == 'student'
  and course existence (server-side). No ownership concerns (admin).
- `unenroll`: enrollment id intval; no existence pre-check (deleting missing id returns true —
  the progress DELETEs just affect 0 rows).
- `verify_and_enroll`: payment-id regex, status guards, per-course `isEnrolled` idempotency,
  transactional with rollback, server-side enrollment (amount/price never trusted from client).
- No bulk actions on this page.

## 6. Full DOM structure (classes & ids)

### Page shell
- `main.ad-page-wrap` → `div.en-page-inner`
  - `div.en-page-header` → `div` → `h1.en-page-title` "Enrollments" ; `p.en-page-subtitle` "Manage student course enrollments, track progress, and enroll students manually."
    , plus action `div[style="display:flex;gap:.6rem;flex-wrap:wrap;"]`:
    - `button.en-btn.en-btn--outline[data-modal="enVerifyPaymentModal"]` (check SVG) "Verify Payment"
    - `button.en-btn.en-btn--primary[data-modal="enEnrollModal"]` (plus SVG) "Enroll Student"
  - `div.en-toast#enToast[role=alert][aria-live=polite]`
  - `div.en-stats-grid` → 4 × `div.en-stat-card`:
    1. `en-stat-card--primary` → `div.en-stat-icon` ; `div.en-stat-body` → `span.en-stat-label` "Total Enrollments" ; `span.en-stat-value` `number_format(totalEnrollments)`
    2. `en-stat-card--green` → "Total Revenue" ; `formatPrice(totalRevenue,false)`
    3. `en-stat-card--blue` → "Avg. Progress" ; value + `span.en-stat-unit` "%"
    4. `en-stat-card--orange` → "Free Enrollments" ; `number_format(freeEnrollments)`
  - `div.en-filter-bar`
    - `form.en-filter-form#enFilterForm[method=get]`
      - `div.en-filter-search` → `svg.en-filter-search-icon` ; `input.en-filter-input[type=text][name=search][placeholder="Search student name, email, or course…"][autocomplete=off][value]` ; if search `a.en-filter-clear[href="?..."][title="Clear search"]` `✕` (href rebuilt from `$_GET` with `search=''`, `page=1`)
      - `div.en-filter-selects` → `select.en-select#enCourseFilter[name=course_id]` ("All Courses" value=0 + course options, selected) ; `button.en-btn.en-btn--outline[type=submit]` (filter SVG) "Filter" ; if search||courseId `a.en-btn.en-btn--ghost[href="enrollments.php"]` "Clear All"
    - `div.en-filter-results` → "Showing <strong>{count(rows)}</strong> of <strong>{total}</strong> enrollment{s}" + if filtered `span.en-filter-badge` "Filtered"
  - If empty: `div.en-empty` (doc SVG) ; `h3` "No enrollments found" ; `p` (`"Try adjusting your filters."` if filtered else `"No enrollments yet."`) ; if filtered `a.en-btn.en-btn--primary[href="enrollments.php"][style="margin-top:1rem;"]` "Clear Filters"
  - Else `div.en-table-wrap` → `table.en-table#enTable`
    - `thead > tr`: `th.en-th.en-th--id` "#" · `en-th--date` Enrolled · `en-th--student` Student · `en-th--course` Course · `en-th--instructor` Instructor · `en-th--price` Amount · `en-th--progress` Progress · `en-th--actions` Actions
    - `tbody#enTableBody` → per row `tr.en-tr#en-row-{id}`:
      - `td.en-td.en-td--id` → `span.en-id-badge` id
      - `td.en-td--date` → `span.en-date-primary` `M d, Y` ; `span.en-date-secondary` `h:i A`
      - `td.en-td--student` → `div.en-person` → `div.en-avatar[aria-hidden]` (first letter upper) ; `div` → `div.en-person-name` ; `div.en-person-email`
      - `td.en-td--course` → `a.en-course-link[href="courses.php?highlight={course_id}"]` title
      - `td.en-td--instructor` → instructor name
      - `td.en-td--price` → if `price==0` `span.en-badge.en-badge--free` "Free" else `span.en-price` `formatPrice(price,false)`
      - `td.en-td--progress` → `div.en-progress-wrap` → `div.en-progress-bar` → `div.en-progress-fill` (`--complete` if ≥100, `--mid` if ≥50, else none; `style="width:{prog}%"`) ; `span.en-progress-label` (`--complete` if ≥100) text `"✓ {prog}%"` or `"{prog}%"`
      - `td.en-td--actions` → `button.en-btn-icon.en-btn-icon--view.js-view-detail[title="View details"]` with data: `data-enrollment-id`, `data-student`, `data-email`, `data-course`, `data-instructor`, `data-price` (Free or formatted), `data-progress`, `data-date` (`F d, Y – h:i A`) ; `button.en-btn-icon.en-btn-icon--delete.js-unenroll[title="Unenroll student"]` with `data-enrollment-id`, `data-student`, `data-course`
  - Pagination (`nav.en-pagination[aria-label="Enrollment pages"]` when totalPages>1):
    `a.en-page-btn.en-page-btn--arrow` prev `‹` ; optional `span.en-page-ellipsis` "1 …" ;
    `a.en-page-btn` (`.en-page-btn--active` if current, `aria-current=page|false`) ; optional `span.en-page-ellipsis` "… {totalPages}" ; next `›`.
    > **URL builder bug (port as-is or fix + note):** `$qs` sets `$q['course'] = $courseId` while the filter param is `course_id`, so pagination links **drop the course filter** (search + page preserved). Recommended: preserve intended behavior using `course_id`. Note in PROGRESS.

### Verify Payment modal
`div.en-modal-overlay#enVerifyPaymentModal[role=dialog][aria-modal=true][aria-labelledby=enVerifyPaymentTitle][hidden]`
→ `div.en-modal` → `div.en-modal-header` → `h2.en-modal-title#enVerifyPaymentTitle` (check SVG) "Verify Payment & Re-enroll" ; `button.en-modal-close[data-close-verify][aria-label="Close"]` `✕`
→ `div.en-modal-body`:
- `p.en-modal-hint` text: "Use this when a student paid but was not enrolled due to a technical error. Enter their Razorpay Payment ID (starts with `pay_`) to look up the verified payment record and enroll them instantly." (contains `<code>pay_</code>`)
- `div.en-form-group[style="margin-top:1rem;"]` → `label.en-form-label[for=enVerifyPaymentInput]` "Razorpay Payment ID " `span.en-required` "*" ; `input#enVerifyPaymentInput.en-form-select[type=text][placeholder="pay_XXXXXXXXXXXXXXXX"][maxlength=32][style="font-family:monospace;letter-spacing:.03em;"][autocomplete=off]` ; `div.en-form-error#enVerifyPaymentErr`
- `div#enVerifyResultBox[hidden][style="margin-top:1rem;padding:.85rem 1rem;border-radius:6px;font-size:.9rem;line-height:1.5;"]`
→ `div.en-modal-footer` → `button.en-btn.en-btn--ghost[data-close-verify]` "Cancel" ; `button.en-btn.en-btn--primary#enVerifySubmitBtn` (search SVG) "Look Up & Enroll"

### Enroll Student modal
`div.en-modal-overlay#enEnrollModal[...][hidden]` → `h2.en-modal-title#enEnrollTitle` (plus SVG) "Enroll Student" ; close `[data-close-modal=enEnrollModal]`
→ body: `p.en-modal-hint` "Manually enrolls a student for free, bypassing payment." ; `div.en-form-grid`:
- `div.en-form-group` → `label.en-form-label[for=enStudentSelect]` "Student " required ; `select#enStudentSelect.en-form-select[required]` option `""` "— Select Student —" + students `"{name} ({email})"` ; `div.en-form-error#enStudentErr`
- `div.en-form-group` → `label[for=enCourseSelect]` "Course " required ; `select#enCourseSelect.en-form-select[required]` option `""` "— Select Course —" + courses with `data-price`, text `title ({price})` or `(Free)` ; `div.en-form-error#enCourseErr`
- `div.en-enroll-preview#enPreview[hidden]` (check SVG) + `span#enPreviewText`
→ footer: "Cancel" ghost + `button.en-btn.en-btn--primary#enSubmitBtn` (plus SVG) "Enroll Student"

### Enrollment Detail modal
`div.en-modal-overlay#enDetailModal[...][hidden]` → `h2.en-modal-title#enDetailTitle` "Enrollment Details" ; close.
body: `div.en-detail-grid` rows each `div.en-detail-row` → `span.en-detail-label` + `span.en-detail-val#...`:
Enrollment ID `#enDetailId` · Student `#enDetailStudent` · Email `#enDetailEmail` · Course `#enDetailCourse` · Instructor `#enDetailInstructor` · Amount Paid `#enDetailPrice` · Enrolled On `#enDetailDate`.
Then `div.en-detail-progress-section` → `div.en-detail-progress-header` → `span.en-detail-label` "Course Progress" + `span.en-detail-progress-pct#enDetailProgressPct` ; `div.en-progress-bar.en-progress-bar--lg` → `div.en-progress-fill#enDetailProgressBar[style="width:0%"]`.
footer: "Close" ghost + `button.en-btn.en-btn--danger#enDetailUnenrollBtn` (trash SVG) "Unenroll".

### Confirm Unenroll modal
`div.en-modal-overlay#enUnenrollModal[...][hidden]` → `div.en-modal.en-modal--sm` → `div.en-modal-header.en-modal-header--danger` → `h2.en-modal-title#enUnenrollTitle` "Unenroll Student?" ; close.
body: `p.en-modal-warn-text` "You are about to unenroll <strong id=enUnenrollStudent></strong> from <strong id=enUnenrollCourse></strong>. All progress data (lessons, quizzes, assignments) will be permanently deleted." ; `div.en-warn-box` (warning SVG) "This action cannot be undone."
footer: "Cancel" ghost + `button.en-btn.en-btn--danger#enConfirmUnenrollBtn` "Yes, Unenroll".

## 7. Inline `<script>`
- **Globals:** `const CSRF = <?= json_encode($csrfToken) ?>;`, `pendingUnenrollId`, `pendingUnenrollSource`.
- **`showToast(msg,type)`** sets `#enToast` text, className `en-toast en-toast--{type} en-toast--show`, auto-hide after **3500 ms**.
- **Modal helpers** `openModal(id)` (remove `hidden`, add `--open`, body overflow hidden) / `closeModal(id)`.
- **Enroll preview** `updatePreview()` on student/course select change → `#enPreviewText` = `sText + ' → ' + cText`, show preview when both set.
- **`submitEnroll()`:** clears errors; if no student → "Please select a student."; no course → "Please select a course."; disables button text "Enrolling…"; `fetch(window.location.pathname, {method:'POST', body: URLSearchParams({ajax:1, enroll:1, csrf_token, student_id, course_id})})`; on success closes modal, resets selects, toast, `setTimeout(()=>location.reload(), 1200)`; on fail toast error; catch → "Network error. Please try again."
- **`openDetailModal(btn)`** copies data-* into detail spans/pct, sets bar width/class, copies id/student/course onto `#enDetailUnenrollBtn`, opens modal.
- **`confirmUnenroll(btn)`** from table: sets pending + `#enUnenrollStudent`/`#enUnenrollCourse`, opens confirm.
- **`confirmUnenrollFromModal()`** from detail: copies from `#enDetailUnenrollBtn`, closes detail, opens confirm.
- **`executeUnenroll()`** button text "Unenrolling…", fetch `{ajax:1, unenroll:1, csrf_token, enrollment_id}`; on success close modal, animate row `#en-row-{id}` opacity/translateX then remove after **320 ms**, toast; on fail toast; catch → close, restore, network error toast.
- **Verify payment:** `closeVerifyModal()` resets input/err/box/button; `submitVerifyPayment()` client-checks empty → "Please enter a Payment ID." and regex → `'Payment IDs start with "pay_" and are at least 18 characters.'`; fetch `{ajax:1, verify_and_enroll:1, csrf_token, payment_id}`; shows `#enVerifyResultBox` with success colors (`#f0fdf4` / `#86efac` / `#166534`) or error (`#fef2f2` / `#fca5a5` / `#991b1b`); toast "Enrollment complete." on success.
- **Listeners:** `[data-modal]` click → `openModal`; `[data-close-verify]` → `closeVerifyModal`; `#enVerifySubmitBtn`; `#enCourseFilter` change → `this.form.submit()`; `#enTableBody` click delegation (`.js-view-detail` → detail, `.js-unenroll` → confirm); `[data-close-modal]`; `#enSubmitBtn`; `#enDetailUnenrollBtn`; `#enConfirmUnenrollBtn`; backdrop click closes; `Escape` closes all open.

## 8. Public-page revalidation
Enrollment changes do NOT change public marketing pages in the PHP app. If the public course page
displays learner/enrollment counts (verify in the public-course phase), revalidate that course's
tag on enroll/unenroll. Otherwise: **no public revalidation required**.

## 9. Port checklist (enrollments)
See global checklist; also: AJAX-actions-only (no PRG), exact JSON messages, `pay_` regex both
sides, transactional verify+enroll with per-course idempotency, detail data-* set, progress color
thresholds 50/100, toast 3500 ms, row removal 320 ms, pagination `course` key bug, `#enToast`.

---

# PAGE 3 — REVIEWS (`public/admin/reviews.php`)

## 1. Purpose / URL / guard / title / robots
- **Purpose:** Moderate all course reviews; stat summary with rating distribution; filter by
  search/course/rating; view full review modal; delete review (AJAX).
- **URL:** `/admin/reviews`. `$activeNav = 'reviews'`.
- **Guard:** `requireRole(ROLE_ADMIN)` (line 8).
- **Title:** `'Manage Reviews – Admin | ' . htmlspecialchars(SITE_NAME)` (**en dash U+2013**).
- **Robots:** `noindex, nofollow`.
- **CSS:** `../assets/css/admin/reviews-enrollments.css`.
- Own toast `#rvToast`.

## 2. GET params / filters / pagination
| Param | Type | Default | Use |
|---|---|---|---|
| `search` | string, trimmed | `''` | `(u.name LIKE ? OR c.title LIKE ? OR r.review_text LIKE ?)`, ×3 |
| `rating` | int | 0 | `r.rating = ?` when `rating >= 1 && rating <= 5` |
| `course_id` | int | 0 | `r.course_id = ?` when > 0 |
| `page` | int | 1 | `max(1,...)`, `$perPage = 20`, `$offset = (page-1)*20` |

- `$totalPages = max(1, ceil($total/$perPage))`; `$page = min($page, $totalPages)`.
- `$coursesList = SELECT id, title FROM courses ORDER BY title`.
- `$csrfToken = generateCSRFToken();`

## 3. POST action (AJAX delete)
Trigger: `isset($_POST['ajax_delete'])` → JSON content type. CSRF required (`csrf_token`);
fail → `{"success":false,"message":"Invalid CSRF token."}`.
`$deleted = deleteReview(intval($_POST['review_id']));`
→ `{"success": (bool)$deleted, "message": $deleted ? "Review deleted." : "Delete failed."}`.
`deleteReview` (`admin.php:476`): `DELETE FROM course_reviews WHERE id = ?` returns rowCount.
No bulk delete on this page.

## 4. DB reads (columns)
- Count query joins `course_reviews r` → `users u` (student) → `courses c` → `users i`
  (instructor), applying `$whereSQL`.
- Row query columns: `r.id, r.rating, r.review_text, r.created_at, u.name AS student_name,
  u.email AS student_email, c.title AS course_title, c.id AS course_id, i.name AS instructor_name`.
  `ORDER BY r.created_at DESC LIMIT ? OFFSET ?`.
- Rating summary (ALWAYS full dataset, unfiltered):
  `SELECT rating, COUNT(*) AS cnt FROM course_reviews GROUP BY rating ORDER BY rating DESC`
  → `$ratingMap[rating] = cnt`.
- `$totalAllReviews = COUNT(*) FROM course_reviews`.
- `$avgRating = totalAllReviews ? ROUND(AVG(rating),1) : 0`.
- Schema (`mysql_schema.txt:210`): `course_reviews(id, course_id, student_id, rating int CHECK
  rating BETWEEN 1 AND 5, review_text text NULL, created_at datetime DEFAULT NOW)`.

## 5. Validations & security
- Admin-only guard.
- CSRF on delete; `review_id` intval; delete by PK (no ownership — admin may delete any review).
- Output escaped with `htmlspecialchars`; modal fields via `textContent` (stars built with
  `createElement`, not innerHTML).
- **Rating is never trusted from client** — read-only display.

## 6. Full DOM structure (classes & ids)

### Page shell
- `main.ad-page-wrap` → `div.rv-page-inner`
  - `div.rv-page-header` → `div` → `h1.rv-page-title` "Course Reviews" ; `p.rv-page-subtitle` "Moderate and manage all student reviews across every course."
  - `div.rv-toast#rvToast[role=alert][aria-live=polite]`
  - `div.rv-stats-grid`:
    - `div.rv-stat-card.rv-stat-card--total` → `div.rv-stat-icon` (star polygon SVG) ; `div.rv-stat-body` → `span.rv-stat-label` "Total Reviews" ; `span.rv-stat-value` `number_format(totalAllReviews)`
    - `div.rv-stat-card.rv-stat-card--avg` → "Average Rating" ; value `avgRating` + `span.rv-stat-unit` " / 5"
    - For `$s = 5; $s >= 4; $s--` (renders **two** cards, 5 then 4):
      `div.rv-stat-card` → `div.rv-stat-icon.rv-stat-icon--stars` text `str_repeat('★',$s)` ; `div.rv-stat-body` → `span.rv-stat-label` "{s}-Star Reviews" ; `span.rv-stat-value` `number_format(ratingMap[s] ?? 0)` ; if `totalAllReviews>0`: `div.rv-stat-bar` → `div.rv-stat-bar-fill[style="width:{round(map/total*100)}%"]`
  - `div.rv-filter-bar`
    - `form.rv-filter-form#rvFilterForm[method=get]`
      - `div.rv-filter-search` → `svg.rv-filter-search-icon` ; `input.rv-filter-input[type=text][name=search][placeholder="Search student, course, or review text…"][autocomplete=off][value]` ; if search `a.rv-filter-clear[href="?..."][title="Clear search"]` `✕`
      - `div.rv-filter-selects`:
        - `select.rv-select.js-filter-submit[name=course_id]` "All Courses" + course options (selected)
        - `select.rv-select.js-filter-submit[name=rating]` "All Ratings" value 0 + options 5→1 text `"{r} Star{s}"`
        - `button.rv-btn.rv-btn--primary[type=submit]` (filter SVG) "Filter"
        - if search||rating||courseId: `a.rv-btn.rv-btn--ghost[href="reviews.php"]` "Clear All"
    - `div.rv-filter-results` → "Showing <strong>{count(rows)}</strong> of <strong>{total}</strong> review{s}" + if filtered `span.rv-filter-badge` "Filtered"
  - If empty: `div.rv-empty` (star SVG) ; `h3` "No reviews found" ; `p` (`"Try adjusting your filters."` if search||rating else `"There are no reviews yet."`) ; if search||rating `a.rv-btn.rv-btn--primary[href="reviews.php"][style="margin-top:1rem;"]` "Clear Filters"
  - Else `div.rv-table-wrap` → `table.rv-table#rvTable`
    - `thead > tr`: `th.rv-th.rv-th--date` Date · `rv-th--student` Student · `rv-th--course` Course · `rv-th--instructor` Instructor · `rv-th--rating` Rating · `rv-th--review` Review · `rv-th--actions` Actions
    - `tbody#rvTableBody` → per row `tr.rv-tr#rv-row-{id}`:
      - `td.rv-td.rv-td--date` → `span.rv-date-primary` `M d, Y` ; `span.rv-date-secondary` `h:i A`
      - `td.rv-td--student` → `div.rv-person` → `div.rv-avatar[aria-hidden]` (first letter upper) ; `div` → `div.rv-person-name` ; `div.rv-person-email`
      - `td.rv-td--course` → `a.rv-course-link[href="courses.php?highlight={course_id}"]` title
      - `td.rv-td--instructor` → instructor name
      - `td.rv-td--rating` → `div.rv-stars-wrap` → `div.rv-stars[aria-label="{rating} out of 5 stars"]` → for i=1..5 `span.rv-star.rv-star--filled` (i≤rating) or `.rv-star--empty`, text `★` ; `span.rv-rating-num` `"{rating}.0"`
      - `td.rv-td--review` → `div.rv-review-text` → `span.rv-review-preview` (preview) ; if text length>120: `button.rv-expand-btn[data-full][data-preview][type=button]` "Read more"
        > preview computed AFTER `htmlspecialchars`: `$text = htmlspecialchars(review_text)`, `$preview = mb_strlen($text)>120 ? mb_substr($text,0,120).'…' : $text`, `$hasMore = mb_strlen($text)>120`. Length counts HTML entities. Port the same (or document improvement).
      - `td.rv-td--actions` → `button.rv-btn-icon.rv-btn-icon--view.js-view-review[title="View full review"]` data: `data-review-id`, `data-student`, `data-course`, `data-rating`, `data-text`, `data-date` (`F d, Y – h:i A`) ; `button.rv-btn-icon.rv-btn-icon--delete.js-delete-review[title="Delete review"]` data: `data-review-id`, `data-student`
  - Pagination (`nav.rv-pagination[aria-label="Review pages"]` when totalPages>1): same structure as enrollments with `rv-` classes/`‹`/`›`/`rv-page-ellipsis`.
    > **URL builder bug (port as-is or fix + note):** `$qs` includes only `page`, `search`, `rating`
    > — `course_id` filter is **dropped** on pagination.

### View Review modal
`div.rv-modal-overlay#rvViewModal[role=dialog][aria-modal=true][aria-labelledby=rvModalTitle][hidden]`
→ `div.rv-modal` → `div.rv-modal-header` → `h2.rv-modal-title#rvModalTitle` "Review Detail" ; close `[data-close-modal=rvViewModal]`
→ `div.rv-modal-body`:
- `div.rv-modal-meta` → rows `div.rv-modal-meta-row` → `span.rv-modal-label` + `span.rv-modal-val#...`:
  Student `#rvModalStudent` · Course `#rvModalCourse` · Date `#rvModalDate` · Rating `#rvModalStars` (`.rv-modal-val.rv-modal-stars`)
- `div.rv-modal-review-text#rvModalText`
→ `div.rv-modal-footer` → "Close" ghost ; `button.rv-btn.rv-btn--danger#rvModalDeleteBtn` (trash SVG) "Delete Review"

### Confirm Delete modal
`div.rv-modal-overlay#rvDeleteModal[...][hidden]` → `div.rv-modal.rv-modal--sm` → `div.rv-modal-header.rv-modal-header--danger` → `h2.rv-modal-title#rvDeleteTitle` "Delete Review?" ; close.
body: `p.rv-modal-warn-text` "You are about to permanently delete the review left by <strong id=rvDeleteStudent></strong>. This action cannot be undone."
footer: "Cancel" ghost ; `button.rv-btn.rv-btn--danger#rvConfirmDeleteBtn` "Yes, Delete"

## 7. Inline `<script>`
- **Globals:** `const CSRF_TOKEN = <?= json_encode($csrfToken) ?>;`, `pendingDeleteId`, `pendingDeleteModal`.
- **`showToast(msg,type)`** → `#rvToast` className `rv-toast rv-toast--{type} rv-toast--show`, auto-hide **3500 ms**.
- **Modal helpers** `openModal(id)` (remove hidden, add `--open`, body overflow hidden, focus `.rv-modal`), `closeModal(id)`.
- **`openReviewModal(btn)`** fills student/course/date/text; builds `#rvModalStars` with 5 `span.rv-star` (`--filled`/`--empty`) then appends text `" {r}.0"` via `insertAdjacentText`; copies `data-review-id`/`data-student` onto `#rvModalDeleteBtn`; opens modal.
- **`confirmDeleteFromModal()`** / **`confirmDelete(btn)`** set `pendingDeleteId`/modal source + `#rvDeleteStudent`, open confirm (from modal: closes view first).
- **`executeDelete()`** button "Deleting…"; fetch `{ajax_delete:1, csrf_token, review_id}`; on success close, animate `#rv-row-{id}` opacity/translateX then remove after **320 ms**, toast "Review deleted successfully."; on fail toast `data.message || 'Delete failed.'`; catch → close + "Network error. Please try again."
- **Expand text** (document click delegation `.rv-expand-btn`): toggles `span = btn.previousElementSibling` between `data-full` and `data-preview`, button text "Read more" ↔ "Read less".
- **Escapes/close:** backdrop click; `Escape` closes all open.
- **Listeners:** `fontStylesheet` no-op; `.js-filter-submit` change → `this.form.submit()`; `.js-view-review` → open modal; `.js-delete-review` → confirm delete; `[data-close-modal]`; `#rvModalDeleteBtn`; `#rvConfirmDeleteBtn`.

## 8. Public-page revalidation
Deleting a review changes a course's public rating (and review list). Must revalidate:
`revalidateTag('reviews')` and the affected `/course/{slug}` (need `course_id` → slug lookup),
plus `/browse-courses`/`/categories` if ratings are shown there. PHP itself does no cache work;
add revalidation for ISR parity with the public course page.

## 9. Port checklist (reviews)
See global checklist; also: rating distribution counts fixed to 5★/4★ cards only; `avgRating`
`/ 5`; stars built via DOM; delete AJAX; expand 120-char threshold; pagination drops course_id;
`#rvToast`.

---

# CROSS-CUTTING: FUNCTION REFERENCE (private/functions)

### admin.php (relevant)
| Function | Line | Used by page? | Behavior |
|---|---|---|---|
| `getAllCategories()` | 560 | **No** (categories.php has its own fetch) | `SELECT * FROM categories ORDER BY name` |
| `createCategory($name,$description='')` | 483 | **No** | createSlug + collision `-time()` + INSERT |
| `updateCategory($id,$data)` | 501 | **No** | dynamic fields; regenerates slug on name |
| `deleteCategory($id)` | 527 | **No** | courses→NULL, DELETE |
| `createSlug($string)` | 550 | **No** | different regex from page version |
| `adminCreateCategory($name,$desc='')` | 567 | **No** | duplicate of createCategory |
| `adminUpdateCategory($id,$name,$desc)` | 588 | **No** | regenerate slug (no exclude) |
| `adminDeleteCategory($id)` | 609 | **No** | courses→NULL, DELETE |
| `getAllEnrollments($limit=50,$offset=0)` | 438 | **No** (page builds own query) | enrollments join details |
| `getAllReviews($limit=50,$offset=0)` | 457 | **No** (page builds own query) | reviews join details |
| `deleteReview($id)` | 476 | **Yes** (reviews) | `DELETE FROM course_reviews WHERE id=?` |
| `adminEnrollStudent($studentId,$courseId)` | 676 | **Yes** (enrollments) | see §3.1 |
| `adminUnenrollStudent($enrollmentId)` | 699 | **Yes** (enrollments) | see §3.2 |

> The page-local `fetchCategories`/`generateSlug` are the source of truth for categories. In the
> Next port, put category reads/writes in `lib/db/categories.ts` (mirroring page SQL), reviews in
> `lib/db/reviews.ts` (`deleteReview`), enrollments in `lib/db/enrollments.ts`
> (`adminEnrollStudent`, `adminUnenrollStudent`, plus the list/count/stats queries). Keep
> `admin.php`'s duplicate functions only if referenced elsewhere (grep before deletion).

### student.php (relevant)
| Function | Line | Behavior |
|---|---|---|
| `isEnrolled($studentId,$courseId)` | 89 | returns enrollment row or false |
| `enrollStudent($studentId,$courseId)` | 100 | blocks instructors; dup check; INSERT; returns `['success'=>..., 'enrollment_id'=>...]` |
| `updatePurchaseStatus($purchaseId,$status,$count)` | 678 | whitelist `['paid','enrollment_failed','enrolled']` |
| `getPurchaseByPaymentId($paymentId,$studentId=0)` | 948 | admin mode (studentId=0) joins users, decodes `courses_json`, adds `amount_rupees` |

---

# SURPRISES / GOTCHAS (must be handled, not dropped)

1. **No `reviews.css` / `enrollments.css`** exist; both pages use only `reviews-enrollments.css`.
   The file's own comment is stale. Do not create the missing sheets.
2. **categories.php ignores admin.php category helpers** and defines its own
   `fetchCategories`/`generateSlug` with a **different** regex/collision rule than admin.php.
3. **Category delete/bulk-delete reassign courses to `category_id = NULL`** (never delete courses).
   Bulk uses `selected_ids[]`; count semantics `deleted !== false ? deleted : count(ids)`.
4. **Update success = `!== false`** (0 rows affected is success). `dbInsert` truthy check on create.
5. **Slug collision suffix = `-{time()}`** (Unix seconds), no loop; DB unique on `slug`.
6. **Pagination bugs:** enrollments `$qs` uses key `course` (filter is `course_id`) → filter lost;
   reviews `$qs` omits `course_id` → filter lost. Port intended behavior (preserve filters) and
   note the change in PROGRESS.
7. **Unenroll does not delete `certificates`** and ignores `purchase_history`.
8. **`verify_and_enroll`** is admin-only, `pay_`-format-gated, transactional, per-course
   idempotent, and updates `purchase_history.status='enrolled'`.
9. **No bulk actions** on enrollments or reviews; only categories has bulk delete.
10. **Review preview length is measured after `htmlspecialchars`** (entities count toward 120).
11. **Two dead `fontStylesheet` load listeners** (no matching element) — harmless no-ops.
12. **`DM Mono` referenced but never loaded** → monospace fallback in categories.css.
13. **Navbar is per-template** and declares global `body { padding-top }`; load `navbar.css` only
    where `navbar.php` is included (all three pages include it).
14. **No `description`/`keywords`/canonical/OG** set by these pages; robots forced noindex.
15. **`getPurchaseByPaymentId` called with no student filter** for admin — returns any student's
    purchase by payment id (admin verification by design).

---

# PORT CHECKLIST (all three pages)

Common
- [ ] Server `requireRole('admin')` guard on `/admin/categories`, `/admin/enrollments`,
      `/admin/reviews`; guests/other roles redirected exactly as `redirectBasedOnRole()`.
- [ ] `noindex, nofollow` metadata on all three; titles exactly:
      `Manage Categories — Admin Panel` (em dash), `Enrollments – Admin | {SITE_NAME}` (en dash),
      `Manage Reviews – Admin | {SITE_NAME}` (en dash).
- [ ] Load CSS in order: `base.css` → `navbar.css` → `categories.css` / `reviews-enrollments.css`
      (verbatim class names; keep unused color-picker rules in categories.css).
- [ ] Shared navbar + footer + admin maintenance banner + site banners render identically.
- [ ] CSRF token verified on every state-changing request; per-request CSP nonce on inline JS.
- [ ] Dates formatted `M d, Y` / `h:i A` and modal `F d, Y – h:i A` (en dash).
- [ ] Money `formatPrice(price,false)` with "Free" for ≤ 0.

Categories
- [ ] GET `search`,`sort`(whitelist),`dir`; GET `msg` flash.
- [ ] POST create/update/delete/bulk_delete with exact messages + PRG redirects.
- [ ] Slug: page algorithm + `-{time()}` collision; update excludes own id.
- [ ] Delete/bulk reassign courses to NULL; message `"Category ... created/updated/deleted..."`,
      `"N category/categories deleted successfully."`, `" N course(s) were unassigned."`.
- [ ] Stat cards (4), toolbar (search/sort/bulk), table (7 cols), empty states (2 variants).
- [ ] 3 modals (add/edit/delete) + backdrop; data-* with `ENT_QUOTES|ENT_HTML5`.
- [ ] Inline JS: modal open/close, slug preview, char count, delete confirm + warning,
      bulk select/delete confirm, sort navigation, alert close, 5 s auto-dismiss.
- [ ] Revalidate home/categories/browse/category slugs on any change.

Enrollments
- [ ] GET `search`,`course_id`,`page` (perPage 20); filter form; results line; clear links.
- [ ] 4 stat cards (Total Enrollments, Total Revenue, Avg. Progress %, Free Enrollments).
- [ ] Table 8 cols with progress bar (50/100 color), Free badge, view/unenroll icon buttons.
- [ ] AJAX `enroll` / `unenroll` / `verify_and_enroll` with exact JSON messages + CSRF.
- [ ] Modals: enroll (live preview + validation), detail, confirm unenroll, verify payment.
- [ ] Inline JS: toast (3500 ms), fetch flows, row removal (320 ms), filter auto-submit,
      table event delegation, Escape/backdrop close.
- [ ] Preserve/fix pagination `course_id` filter; note decision.
- [ ] Public revalidation only if course pages show enrollment counts.

Reviews
- [ ] GET `search`,`rating`(1–5),`course_id`,`page` (perPage 20); auto-submit selects.
- [ ] Stat cards: Total, Average `/5`, 5★ and 4★ distribution bars.
- [ ] Table: date, student, course, instructor, star rating (5 spans + `{r}.0`), review preview
      with "Read more"/"Read less" (>120 chars), view/delete icon buttons.
- [ ] AJAX delete `ajax_delete` with exact messages + CSRF; yes/no confirm modal; view modal.
- [ ] Inline JS: toast (3500 ms), star building, expand toggle, row removal (320 ms), Escape.
- [ ] Preserve/fix pagination `course_id` filter; revalidate course/browse on delete.

Verification
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` pass.
- [ ] `npm run php-stylesheet-order`, `npm run css-usage`, `npm run css-conflicts`,
      `npm run php-chrome-map` clean for these pages.
- [ ] `npm run ui-compare -- --page admin-categories` / `admin-enrollments` / `admin-reviews`
      at all viewports, results into `docs/UI_PARITY_REPORT.md` (or state `--site new` only if
      the old site cannot run).
- [ ] Update `docs/PROGRESS.md` and `docs/feature-matrix.md`.
