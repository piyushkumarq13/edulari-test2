# Phase 9 — Admin Course Pages (courses.php, create-course.php, edit-course.php) Reverse-Engineering Spec

Scope: port the three PHP admin course pages and their CSS to Next.js App Router + TypeScript with pixel/behavior parity.
Specification only — no application code was written in this phase. Use this file as the checklist while building.

## 1. Sources (read fully)

Old site (read-only):
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\courses.php` (1104 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\create-course.php` (1153 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\edit-course.php` (1157 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private\functions\admin.php` (1094 lines; course functions at 298, 342, 560, 623, 637, 719, 820)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\assets\css\admin\courses.css` (1094 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\assets\css\admin\create-course.css` (1453 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\assets\css\admin\edit-course.css` (1128 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\partials\head.php`, `public\navbar.php`

New project (compare/reuse):
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\components\instructor\course\CourseEditor.tsx` (545 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\components\instructor\course\CustomSelect.tsx`, `RemoveThumbnailButton` (inside CourseEditor)
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\lib\api\instructor\course-actions.ts` (240 lines)
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\app\api\instructor\course\route.ts`, `[id]\route.ts`, `[id]\content\route.ts`
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\lib\db\instructor\courses.ts`
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\app\(site)\instructor\create-course\page.tsx`, `edit-course\page.tsx`
- `C:\Users\piyus\Desktop\htdocs (7)\Edulari\styles\css\admin\courses.css|create-course.css|edit-course.css` (these already exist — check: line counts 1094/1452/1128, i.e. verbatim ports of the PHP CSS; verify they match the PHP files byte-for-except-BOM before relying on them)

NEW admin area does NOT exist yet: there is no `app/(site)/admin`, no `app/api/admin`, no `lib/db/admin/`. All of Phase 9 must be built from scratch; do NOT start from the instructor phase files unthinkingly — see §8 differences.

## 2. Shared chrome (all three pages)

- Guard: `requireRole(ROLE_ADMIN)` as the first thing after includes. Protected pages only. In Next: server guard in each page AND API route (admin role).
- Includes per page (order matters):
  1. `bootstrap.php`, `config.php`, `db.php`, `auth.php`, `functions/admin.php`
  2. `$activeNav = 'courses'` then `include navbar.php` (navbar loads `/assets/css/navbar.css`, uses `$activeNav` for the admin left rail highlight)
  3. `head.php` which sets: `<title>{$pageTitle}</title>`, robots from `$pageRobots` (all three: `noindex, nofollow`), links `/assets/css/base.css` THEN `$extraCss`.
  4. `footer.php` at the very end.
- CSS cascade order: base.css → navbar.css (via navbar.php) → page css. Keep identical cascade in the new pages.
- Fonts: base.css loads DM Sans + DM Mono via a `#fontStylesheet` `<link media="print" onload=...>`. Every page ends its inline `<script>` with:
  `document.getElementById('fontStylesheet')?.addEventListener('load', function() { this.media = 'all'; });`
- All inline `<script>` blocks use `nonce="<?= CSP_NONCE ?>"`. In Next this becomes a client component mounted in the page (no nonce needed; CSP configured in next.config / headers must permit `'self'` + the fonts/icon origins, matching bootstrap.php CSP).
- All `formatPrice()` calls: display formatted price (₹ 1,234.00 style). Currency via `CURRENCY_CODE`, `CURRENCY_DISPLAY_SYMBOL`, `CURRENCY_SYMBOL` from config.

### Extract from head.php
- Inputs: `$pageTitle` (required), `$pageDescription` optional, `$pageRobots` optional (admin pages pass `noindex, nofollow`), `$extraCss` optional string|array.
- Output order: charset, viewport, favicon, title, robots meta, (description/og/twitter optional — NOT used by admin pages), `#fontStylesheet` font link, `/assets/css/base.css`, then each `$extraCss` href.
- Admin pages pass `$extraCss` as exactly one stylesheet path: `../assets/css/admin/courses.css` (courses), `../assets/css/admin/create-course.css`, `../assets/css/admin/edit-course.css`.

## 3. courses.php — Manage Courses list

### Purpose / URL / metadata
- URL: `/admin/courses` (PHP: `admin/courses.php`). `$pageTitle = 'Manage Courses – Admin'`; robots `noindex, nofollow`.
- GET params: `status`, `search`, `instructor`, `category`, `featured`, `sort`, `dir`, `page`, `per_page`, `msg` (success message), error displayed inline.

### GET handling (filters, sort, pagination)
- `msg` from `$_GET['msg']` is `htmlspecialchars`-ed and shown as a success alert (`crs-alert crs-alert--success`).
- Filters map:
  - `status`: `published` → `c.is_published = 1`; `pending` → `c.is_published = 0`.
  - `search`: `(c.title LIKE %t% OR c.description LIKE %t% OR u.name LIKE %t%)` — note: also searches the instructor's NAME (unlike `getAllCoursesAdmin` which searches only title/description).
  - `instructor`: `c.instructor_id = ?` (int).
  - `category`: `c.category_id = ?` (int).
  - `featured`: `yes` → `c.is_featured = 1`; `no` → `c.is_featured = 0`.
- Sort: whitelist `['created_at','title','student_count','price','avg_rating']`, default `created_at`; `dir` whitelist `asc|desc`, default `desc`.
- Pagination: `page` ≥ 1; `per_page` ∈ {10,20,50,100} default 20; `totalPages = max(1, ceil(total/limit))`; `page = min(page, totalPages)`; offset recomputed after clamp.
- Stats cards query (single SELECT against `courses c`):
  `COUNT(*) AS total, SUM(is_published) AS published, SUM(is_featured) AS featured, COALESCE(SUM((SELECT COUNT(*) FROM enrollments WHERE course_id = c.id)),0) AS total_students` — no WHERE, counts ALL courses. Displayed via `number_format()`.
- Main listing SELECT (reuse for both where-count and listing):
  ```
  SELECT c.*, u.name AS instructor_name, u.email AS instructor_email, cat.name AS category_name,
    (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) AS student_count,
    (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) AS avg_rating,
    (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) AS review_count
  FROM courses c
  LEFT JOIN users u ON c.instructor_id = u.id
  LEFT JOIN categories cat ON c.category_id = cat.id
  {where} ORDER BY {safeSortCol} {dir} LIMIT ? OFFSET ?
  ```
- Support lists: `SELECT id, name FROM users WHERE role='instructor' ORDER BY name`; `SELECT id, name FROM categories ORDER BY name`.
- When `$courses` empty: if any filter set → "No courses match your filters" + Clear Filters link; else → "No courses yet" + Create Course CTA.

### POST handling (side effects — port as route handlers)
All POST forms carry `csrf_token` (verified via `verifyCSRFToken`); failure sets `$error = "Invalid request. Please try again."` (rendered inline, no redirect).
Single-course actions (`course_id = intval($_POST['course_id'])`):
- `delete` present → `adminDeleteCourse($courseId)` (transact.) → redirect `courses.php?msg=Course deleted successfully.` (urlencoded). On failure inline error "Failed to delete course. Please try again."
- `toggle_publish` → `$newStatus = intval($_POST['status']) === 1 ? 0 : 1`; `UPDATE courses SET is_published = ? WHERE id = ?` → redirect `msg=Course status updated.`
- `feature` → `UPDATE courses SET is_featured = 1 WHERE id = ?` → `msg=Course marked as featured.`
- `unfeature` → `UPDATE courses SET is_featured = 0 WHERE id = ?` → `msg=Course removed from featured.`
Bulk actions (`bulk_action` + `selected_ids[]`, each `intval`, filter >0):
- `publish` → `UPDATE courses SET is_published = 1 WHERE id IN (…)` → `msg={n} course(s) published.`
- `unpublish` → idem `is_published = 0` → `msg={n} course(s) unpublished.`
- `feature` → `is_featured = 1` → `msg={n} course(s) marked as featured.`
- `unfeature` → `is_featured = 0` → `msg={n} course(s) removed from featured.`
- `delete` → loop `adminDeleteCourse` counting successes → `msg={deleted} course(s) deleted successfully.`
- unknown `bulk_action` → inline error "Invalid bulk action."; empty ids → "No valid courses selected."
After single or bulk delete, publish, feature, unfeature, or status toggle the resulting page must be revalidated (course/category pages). Listing page itself is admin-only (no index).

### adminDeleteCourse (admin.php:342) — transactional cascade
BEGIN; collect lesson ids for course; then delete in this order:
1. `quiz_answers` by attempt ids of quiz_attempts of those lessons
2. `quiz_attempts` by lesson ids
3. `quiz_options` by question ids of quiz_questions of those lessons
4. `quiz_questions` by lesson ids
5. `assignment_submissions` by lesson ids
6. `assignments` by lesson ids
7. `lesson_progress` by lesson ids
8. `lessons` by course_id
9. `course_sections` by course_id
10. `enrollments` by course_id
11. `course_reviews` by course_id
12. `courses` by id (course itself)
COMMIT. On exception: `error_log("Admin delete course error: ...")`, rollback, return false.
Also: deleted course thumbnail + any B2 objects should be deleted (port intent; PHP only deleted DB rows).

### getAdminCourseStats etc.
- `getAllCoursesAdmin($filters=[], $limit=50, $offset=0)` (admin.php:298) exists but is NOT used by courses.php (the page inlines its own query). Port it anyway in `lib/db/admin/courses.ts` for other admin pages? It is used nowhere else in old site — can skip if unused, but AGENTS parity says port every function; mark `partial` (function defined, unused) or port as helper.
- `adminToggleCoursePublish` (820) also unused by this page. List in feature-matrix as available helper.

### Table markup (DOM to reproduce 1:1)
Header:
- `.crs-page-wrap#mainContent > .crs-page-inner`
- `.crs-page-header`: `.crs-page-title-group` (`.crs-page-icon` w/ graduation-cap SVG ×22, `h1.crs-page-title` "Manage Courses", `p.crs-page-subtitle` "View, publish, feature, and manage all platform courses") + `<a class="crs-btn crs-btn--primary" href=create-course.php>` "+ Create Course" (plus icon svg 16×16).
- `.crs-alert.crs-alert--success` (icon + span message + `.crs-alert-close` ×) when `$message`; else `.crs-alert--error` when `$error`.
- `.crs-stats-grid` with 4 `.crs-stat-card`s: blue Total Courses (number_format), green Published, amber Featured, purple Total Enrollments (users icon).
Toolbar:
- `.crs-table-card > .crs-toolbar > form#filterForm.crs-filter-form (method=get)`:
  - `.crs-search-wrap`: `.crs-search-icon` (magnifier 15×15), `input#searchInput.crs-search-input[name=search]` placeholder "Search title, description, instructor…" value=`$_GET['search']`, plus `.crs-search-clear` "×" button only when a search is present.
  - `.crs-filter-row` with the following `<select class="crs-select">` in order, each auto-submitting on change:
    1. `name=status` — "" All Statuses / published Published / pending Pending
    2. `name=instructor` — "" All Instructors + instructors list (shows `id` value, name text)
    3. `name=category` — "" All Categories + categories
    4. `name=featured` — "" Featured: All / yes Featured Only / no Not Featured
    5. `name=sort` — created_at Newest First / title Title A–Z / student_count Most Students / price Price / avg_rating Top Rated
    6. `name=dir` — desc "↓ Desc" / asc "↑ Asc"
    7. `name=per_page` — 10,20,50,100 "n / page"
    8. `button.crs-btn.crs-btn--secondary.crs-btn--sm` with funnel SVG 14×14 + "Filter"
    9. conditional `a.crs-btn.crs-btn--ghost.crs-btn--sm` "×  Clear" (present when any filter set, href=`courses.php`)
- `.crs-bulk-bar#bulkBar` (hidden until selection): inner `form#bulkForm (method=post)` with hidden `csrf_token`, `div#bulkIdsContainer`, `.crs-bulk-inner` = `span.crs-bulk-count#bulkCount "0 selected"`, `select#bulkActionSelect.crs-select.crs-select--sm[name=bulk_action]` ("— Bulk Action —", Publish, Unpublish, Mark as Featured, Remove Featured, Delete), `button.crs-btn.crs-btn--primary.crs-btn--sm#applyBulkBtn` "Apply", `button.crs-btn.crs-btn--ghost.crs-btn--sm#clearSelectionBtn` "Deselect All".
- `.crs-table-info-row > span.crs-results-count`: "Showing {start}–{end} of {count} course(s)" or "No courses found".
- `.crs-table-scroll > table.crs-table#coursesTable`:
  thead: `th.crs-th-check` (checkbox `input#selectAll.crs-checkbox` aria-label "Select all"), `th` Course, Instructor, Category, `th.crs-th-num` Price, Students, Rating, Status, `th.crs-th-actions` Actions.
  tbody `tr.crs-row[data-id]`:
  - `td.crs-td-check`: `input.crs-checkbox.crs-row-check` value=course id aria-label "Select {title}".
  - `td.crs-td-course`: `.crs-course-cell` = thumbnail `img.crs-thumb[loading=lazy]` (src=`course['thumbnail']`) OR `.crs-thumb.crs-thumb--placeholder` (book svg); `.crs-course-info` = `span.crs-course-title` (title) + `.crs-course-meta` = `span.crs-id-tag "#{id}"`, conditional `span.crs-badge.crs-badge--featured "★ Featured"`, conditional `span.crs-review-count "{n} review(s)"` only when review_count>0.
  - next `td`: `.crs-instructor-cell` = `span.crs-instructor-name` + optional `span.crs-instructor-email`.
  - next `td`: `span.crs-category-badge` (name or "Uncategorized").
  - `td.crs-td-num`: `span.crs-price` = `formatPrice(price)`.
  - `td.crs-td-num`: `span.crs-students` = `number_format(student_count)`.
  - `td.crs-td-num`: if avg_rating>0 → `.crs-rating` (filled star svg fill #f59e0b 13×13 + `number_format(avg,1)`); else `span.crs-no-rating "—"`.
  - next `td`: `span.crs-status.crs-status--published|pending` with `span.crs-status-dot` + "Published"/"Pending".
  - `td.crs-td-actions`: `.crs-action-group` =
    - `a.crs-action-btn.crs-action-btn--edit[href=edit-course.php?id={id}]` (pencil svg 14×14) "Edit"
    - `.crs-more-wrap[data-dropdown]` = `button.crs-more-btn[aria-haspopup=true][aria-expanded=false]` (3-dot svg) + `.crs-dropdown[role=menu]` containing, IN THIS ORDER:
      1. `form.crs-dropdown-form (method=post)`: hidden csrf_token, course_id, status(=is_published), `button.crs-dropdown-item[role=menuitem][name=toggle_publish]` → eye/eye-off svg + "Unpublish"/"Publish"
      2. `form.crs-dropdown-form`: csrf_token, course_id, `button[role=menuitem]` `name=feature` or `name=unfeature` (star svg) "Mark as Featured"/"Remove Featured" (unfeature star uses fill #fef3c7, stroke #f59e0b)
      3. `a.crs-dropdown-item[role=menuitem][href=enrollments.php?course_id={id}]` users svg "View Enrollments"
      4. `a.crs-dropdown-item[role=menuitem][href=reviews.php?course_id={id}]` star svg "View Reviews"
      5. `div.crs-dropdown-divider[role=separator]`
      6. `button.crs-dropdown-item.crs-dropdown-item--danger.crs-delete-trigger[data-course-id][data-course-title][data-student-count][role=menuitem]` trash svg "Delete Course"
- Pagination `.crs-pagination` (only when totalPages>1): `span.crs-pagination-info "Page {page} of {totalPages}"` + `.crs-pagination-btns` with Prev/1/…/window-of-5 around current/…/last/Next. Query preserved via `http_build_query` merging existing filters + page. Current page button `crs-btn--primary` with `aria-current="page"`.
- Empty state `.crs-empty`: `.crs-empty-icon` (book svg 36×36), `h3.crs-empty-title`, `p.crs-empty-text`, CTA.

### Modals (2)
`#deleteModal.crs-modal-overlay[role=dialog][aria-modal=true][aria-labelledby=deleteModalTitle]`:
- `.crs-modal > .crs-modal-header.crs-modal-header--danger`: title `h2.crs-modal-title#deleteModalTitle` (warning-circle svg) "Delete Course" + `button.crs-modal-close#closeDeleteModal` "×".
- `.crs-modal-body`: `p.crs-modal-msg#deleteMessage` "Are you sure you want to permanently delete this course?"; `div.crs-modal-warning#deleteWarning` (triangle-alert svg 16×16) `span#deleteWarningText` "This will permanently remove all lessons, sections, enrollments, quizzes, and reviews. This action cannot be undone."; `form#deleteForm (method=post)` with hidden `csrf_token`, `course_id#deleteCourseId`, `delete` value=1; `.crs-modal-footer` with `button.crs-btn.crs-btn--ghost#cancelDeleteBtn` "Cancel" + submit `button.crs-btn.crs-btn--danger` (trash svg) "Delete Permanently".
`#bulkDeleteModal.crs-modal-overlay[role=dialog]`:
- header title `#bulkDeleteModalTitle` "Bulk Delete Courses" + `#closeBulkDeleteModal` ×.
- body: `p.crs-modal-msg#bulkDeleteMessage` "You are about to delete multiple courses."; warning block (static text "All lessons, enrollments, quizzes, and reviews for the selected courses will be permanently deleted. This cannot be undone."); `.crs-modal-footer` with `#cancelBulkDeleteBtn` "Cancel" + `button#confirmBulkDeleteBtn.crs-btn.crs-btn--danger` (trash svg) "Delete All Selected".
- After both: `<div class="crs-modal-backdrop" id="modalBackdrop"></div>`.

### Inline JS (port to client component/hook, identical behavior)
- Helpers `qs/qsa`.
- Delete modal: opening a `.crs-delete-trigger` sets `#deleteCourseId`, switches `#deleteMessage` to `'Are you sure you want to permanently delete "<title>"?'`, and `#deleteWarningText` to either `{n} enrolled student(s) will lose access. All lessons, sections, quizzes, and reviews will be permanently removed. This cannot be undone.` (when studentCount>0) or the static default. Opens and focuses first focusable. Close via ×, Cancel, backdrop click, Escape. `crs-modal-overlay--open` + `crs-modal-backdrop--visible` classes, `body.style.overflow='hidden'`.
- Bulk selection: `getChecked()` reads `'.crs-row-check:checked'`; toggles `#bulkBar.crs-bulk-bar--visible`, `#bulkCount`, `#selectAll` indeterminate/checked; `Deselect All` clears.
- Apply: if no action → `alert('Please select a bulk action first.')`; if no ids → `alert('No courses selected. Please check at least one course.')`; if action==='delete' → set `#bulkDeleteMessage` to `'You are about to permanently delete {n} course(s). This action cannot be undone.'` + open modal; else submitBulkForm directly. Confirm deletes: `submitBulkForm('delete', ids)`. `submitBulkForm` writes hidden `input[name="selected_ids[]"]` per id into `#bulkIdsContainer` then submits `#bulkForm`.
- Row dropdowns (`[data-dropdown]`): toggle `.crs-more-wrap--open`, sync `aria-expanded`, close siblings; close-all on outside click and Escape; close when any `.crs-dropdown-form` submits.
- Search clear button: clear `#searchInput`, submit `#filterForm`.
- Filter auto-submit: `#filterForm select.crs-select` on change → submit.
- Alert close handlers; auto-dismiss `#pageAlert` after 5000ms (`opacity 0`, `translateY(-6px)`, then remove).
- Message display strings are EXACT strings above (with counts) — reuse word-for-word.

## 4. create-course.php — Create Course (admin)

### Purpose / URL / metadata
- URL: `/admin/courses/create` (PHP `admin/create-course.php`). Title: `'Create Course — Admin | ' . SITE_NAME`; robots noindex,nofollow. Nav active `courses`.
- On `GET ?success=1&id=N`: renders success banner (see below); no form.

### Data load
- `$categories = getAllCategories()` (= `SELECT * FROM categories ORDER BY name`).
- `$instructors = dbSelect("SELECT id, name, email FROM users WHERE role = 'instructor' ORDER BY name")`.

### POST handling + validation (order matters)
Build `$data`:
```
instructor_id       = intval($_POST['instructor_id'])
category_id         = $_POST['category_id'] ?: null
title               = trim($_POST['title'])
short_description   = trim($_POST['short_description'])
description         = trim($_POST['description'])
level               = $_POST['level'] ?? 'beginner'
language            = trim($_POST['language'] ?? 'English')
duration_hours      = intval($_POST['duration_hours'] ?? 0)
price               = floatval($_POST['price'] ?? 0)
certificate_enabled = isset($_POST['certificate_enabled']) ? 1 : 0
passing_percentage  = intval($_POST['passing_percentage'] ?? 70)
```
Validation order + messages (check in this sequence):
1. CSRF fail → error "Invalid request. Please try again."
2. `instructor_id <= 0` → "Please select an instructor."
3. empty title → "Course title is required."
4. `strlen(title) < 5` → "Course title must be at least 5 characters."
5. `strlen(title) > 200` → "Course title must not exceed 200 characters."
6. empty short_description → "Short description is required."
7. `strlen(short_description) < 20` → "Short description must be at least 20 characters."
8. `strlen(short_description) > 500` → "Short description must not exceed 500 characters."
9. `price < 0` → "Price cannot be negative."
10. `passing_percentage < 0 || > 100` → "Passing percentage must be between 0 and 100."
11. `duration_hours < 0` → "Duration cannot be negative."
12. On success: `$newId = adminCreateCourse($data)`; redirect `create-course.php?success=1&id={$newId}` (PRG). Else error "Failed to create course. Please try again."
- On re-render (validation error), fields keep their `$_POST` values (server-side round-trip) AND the free/paid toggle is restored to "paid" when `$_POST['price'] > 0`.

### adminCreateCourse (admin.php:719)
- Slug from title: lowercase, replace `[^a-z0-9-]`→`-`, collapse `-+`→`-`, trim `-`. If slug exists → append `-{time()}`.
- INSERT into `courses (instructor_id, category_id, title, slug, description, short_description, level, language, duration_hours, price, certificate_enabled, passing_percentage, is_published)` VALUES `(…, 0)` — note: **publishes as DRAFT (is_published=0)**.
- `category_id` uses `$data['category_id'] ?: null`.

### Success banner (fresh load after redirect)
`.cc-success-banner[role=alert][aria-live=polite]`: `.cc-success-icon` (check-circle svg 28×28) + `.cc-success-body` (`p.cc-success-title` "Course Created Successfully!", `p.cc-success-text` "Your course has been saved as a draft. Add sections, lessons, and media to get it ready for students.") + `.cc-success-actions` with 3 links: `a.cc-btn.cc-btn--primary[href=edit-course.php?id={newId}]` (pen svg 15×15) "Add Content & Details"; `a.cc-btn.cc-btn--ghost[href=create-course.php]` "Create Another Course"; `a.cc-btn.cc-btn--outline[href=courses.php]` "View All Courses".

### Header
- `.cc-page-header` > `.cc-page-header-left`: `a.cc-back-btn[aria-label="Back to courses"][href=courses.php]` (chevron-left svg 16×16) "Back to Courses"; `.cc-page-title-group`: `.cc-page-icon` (plus svg 22×22) + `h1.cc-page-title` "Create New Course" + `p.cc-page-subtitle` 'Saved as <strong>Draft</strong> — publish after adding content in Edit Course'.
- Steps indicator `.cc-steps[role=list][aria-label="Course creation steps"]`: 3 `.cc-step` items with `.cc-step-num` ("1" active `aria-current=step`, "2" upcoming, "3" upcoming) + `.cc-step-label` "Basic Info"/"Content"/"Publish", joined by `.cc-step-connector`s.

### Form layout
`form#createCourseForm[method=post][novalidate]` containing hidden `csrf_token` + `.cc-form-layout` = `.cc-form-main` (left) + `.cc-form-sidebar` (right).

Left column cards (order):
1. **`#section-basic` Basic Information** — `.cc-card-header` with `.cc-card-header-icon.cc-card-header-icon--blue` (file svg 16×16), `h2.cc-card-title` "Basic Information", `p.cc-card-desc` "Core details that identify your course". Body `.cc-card-body`:
   - Course Title: `#field-title`: `label.cc-label[for=title]` "Course Title" + `span.cc-label-required[aria-label=required]` "*"; `.cc-input-wrap > input#title[name=title].cc-input[type=text][placeholder="e.g. Complete PHP & MySQL Development Bootcamp"][maxlength=200][required][aria-describedby="title-hint title-counter"][autocomplete=off]` value=`$_POST['title']`; `.cc-field-footer` = `span.cc-hint#title-hint` "Aim for 60–80 characters. Be specific and compelling." + `span.cc-char-counter#title-counter[aria-live=polite]` containing `span#title-count "0"` + "/200". `.cc-slug-preview#slug-preview[aria-live=polite]` = `span.cc-slug-label` "URL slug:" + `span.cc-slug-value#slug-value` "—". `span.cc-field-error#title-error[role=alert][aria-live=assertive]`.
   - Short Description: `#field-short-desc` label "Short Description *" + `span.cc-label-badge` "Shown on course cards"; `textarea#short_description[name=short_description].cc-input.cc-textarea.cc-textarea--sm[rows=3][maxlength=500][required][aria-describedby="short-desc-hint short-desc-counter"]` placeholder "A compelling 1–2 sentence summary that convinces students to enroll…"; footer hint `#short-desc-hint` "20–160 characters recommended for best display across all devices." + counter `#short-desc-count/500`; `#short-desc-error`.
   - Full Description: label "Full Description" + `span.cc-label-optional` "(Optional — can add later)"; `textarea#description[name=description].cc-input.cc-textarea.cc-textarea--lg[rows=6]` placeholder "What will students learn? Who is this course for? What are the prerequisites? What topics are covered?\n\nUse line breaks to organise your description."; footer `#desc-hint` "Detailed descriptions improve discoverability and student conversions." + `#desc-counter` "0 chars".
2. **`#section-details` Course Details** — violet clock icon; desc "Classification, difficulty, and duration". Body:
   - `.cc-grid.cc-grid--2` Category: `div.cc-field` label `[for=category_id]` "Category"; `.cc-select-wrap > select#category_id[name=category_id].cc-select[aria-describedby=cat-hint]` with first option `value=""` "— Uncategorized —" then categories; `.cc-select-icon` chevron svg 15×15; `span.cc-hint#cat-hint` "Helps students find your course".
     Level: label "Difficulty Level"; `select#level[name=level].cc-select` options: "🟢 Beginner", "🟡 Intermediate", "🔴 Advanced" (values beginner/intermediate/advanced, default beginner); chevron icon.
   - `.cc-grid.cc-grid--2` Language: `select#language[name=language].cc-select` — 16 options in order: English, Hindi, Spanish, French, German, Portuguese, Arabic, Japanese, Korean, Chinese (Simplified), Russian, Italian, Dutch, Turkish, Polish, Other (default English); `.cc-hint#lang-hint` "Primary language of course content". Duration: `#field-duration` label "Estimated Duration"; `.cc-input-unit-wrap > input#duration_hours[name=duration_hours].cc-input.cc-input--unit[type=number][min=0][max=9999]` value `intval($_POST['duration_hours'])` + `span.cc-input-unit` "hrs"; hint `#duration-hint` "Approximate total hours of video/content"; `#duration-error`.
3. **`#section-pricing` Pricing** — green "currency" icon (¥/₹ sign svg), title "Pricing", desc "Set 0 to offer this course for free". Body:
   - `.cc-pricing-toggle[role=group][aria-label="Pricing type"]` = `button.cc-pricing-opt.cc-pricing-opt--active#opt-free[type=button][aria-pressed=true][data-type=free]` (heart svg 18×18) "Free" + `button.cc-pricing-opt#opt-paid[aria-pressed=false][data-type=paid]` (wallet/rect svg) "Paid".
   - `#price-field.cc-field[style=display:none]` (hidden when free): `label.cc-label[for=price]` "Course Price ({currency})"; `.cc-input-unit-wrap` = `span.cc-input-prefix` currency + `input#price[name=price].cc-input.cc-input--prefixed[type=number][min=0][step=0.01][placeholder=999.00]` value `number_format(price,2,'.','')`; hint `#price-hint` "Displayed in {code} ({symbol})"; `#price-error`.
   - `input#price-hidden[name=price][type=hidden][value=0]` (this is how the free price is submitted).
4. **`#section-cert` Certificate & Assessment** — amber award icon; title "Certificate & Assessment", desc "Completion certificate and quiz pass threshold". Body:
   - `label.cc-toggle-row[for=certificate_enabled]` = `.cc-toggle-info` (`span.cc-toggle-title` "Enable Certificate of Completion", `span.cc-toggle-desc` "Students receive a certificate when they finish the course") + `.cc-toggle-switch` = `input#certificate_enabled[name=certificate_enabled].cc-toggle-input[type=checkbox][role=switch][aria-checked=true]` (checked by default when no POST title) + `span.cc-toggle-thumb`.
   - `#passing-field.cc-field`: `label.cc-label[for=passing_percentage]` "Quiz Passing Percentage"; `.cc-range-wrap` = `input#passing_range.cc-range[type=range][min=0][max=100][step=5][aria-label="Passing percentage slider"]` value `intval($_POST['passing_percentage'] ?? 70)` + `.cc-input-unit-wrap.cc-range-input-wrap` (`input#passing_percentage[name=passing_percentage].cc-input.cc-input--unit.cc-input--sm[type=number][min=0][max=100]` value 70 + `span.cc-input-unit` "%"); hint `#pass-hint` "Minimum score required to pass quizzes (0 = no minimum)"; `#passing-error`.

Right column `.cc-form-sidebar`:
- **`#section-instructor` Assign Instructor** (`.cc-card.cc-card--sticky`) red user-plus icon; title "Instructor", desc "Who owns this course". Body `.cc-card-body.cc-card-body--compact`:
  - `#field-instructor`: `label.cc-label[for=instructor_id]` "Assign Instructor *"; `.cc-instructor-search` = `.cc-input-wrap.cc-input-wrap--icon` (`.cc-input-icon` magnifier svg 15×15 + `input#instructor-search.cc-input.cc-input--with-icon[type=text][autocomplete=off][aria-label="Search instructor list"][aria-controls=instructor-list][aria-expanded=false]` placeholder "Search instructors…") + `div.cc-instructor-list#instructor-list[role=listbox][aria-label=Instructors]`: if empty → `.cc-instructor-empty` 'No instructors found. <a href="users.php">Add an instructor</a> first.'; else each instructor `.cc-instructor-item[role=option][aria-selected=false][data-id][data-name][data-email][tabindex=0]` = `.cc-instructor-avatar` (first letter uppercase) + `.cc-instructor-info` (`span.cc-instructor-name` name + optional `span.cc-instructor-email` email).
  - `input#instructor_id[name=instructor_id][type=hidden]` value `intval($_POST['instructor_id'])` **required**.
  - `#instructor-selected.cc-instructor-selected[style=display:none][aria-live=polite]` = `.cc-instructor-selected-avatar#instructor-selected-avatar` + `.cc-instructor-selected-info` (`#instructor-selected-name`, `#instructor-selected-email`) + `button.cc-instructor-clear#instructor-clear[type=button][aria-label="Clear instructor selection"]` (X svg 13×13).
  - `span.cc-field-error#instructor-error`.
- **`#preview-card` Live Preview** slate eye icon; title "Live Preview", desc "How students will see this course". Body: `.cc-preview-card` = `.cc-preview-thumb[aria-hidden=true]` (play-button placeholder svg 64×48) + `.cc-preview-body` (`.cc-preview-badges` = `span.cc-preview-level#preview-level "🟢 Beginner"` + `span.cc-preview-category#preview-category "Uncategorized"`; `p.cc-preview-title#preview-title "Course title will appear here"`; `p.cc-preview-desc#preview-desc "Short description will appear here…"`; `.cc-preview-meta` = `#preview-duration "0h"` · `#preview-language "English"` · `#preview-price "Free"`; `.cc-preview-cert#preview-cert` (award svg 12×12) "Certificate included").
- **`.cc-actions-card`**: `.cc-form-status#form-status[aria-live=polite]` = `.cc-status-dot.cc-status-dot--draft` + "Will be saved as <strong>Draft</strong>"; `button.crs-btn… submit#submit-btn.cc-btn.cc-btn--primary.cc-btn--full` (plus svg 16×16 + `span#submit-btn-text "Create Course"`); `a.cc-btn.cc-btn--ghost.cc-btn--full[href=courses.php]` "Cancel"; `p.cc-actions-note` "After creating, you can add sections, lessons, quizzes, and a thumbnail in <strong>Edit Course</strong>."

### Inline JS (port fully)
- helpers `esc`, `debounce`, `buildSlug` (PHP-mirror).
- Character counters: `#title/#title-count` warning at 180+ (adds `.cc-char-counter--warn`); `#short_description/#short-desc-count` warn at 450; description `#desc-count` (toLocaleString).
- Slug preview: on title debounced 200ms → show slug in `#slug-value`, `#slug-preview.style.display='flex'`.
- Live preview updates (change/input debounced 150ms): title, short description, level (`{emoji} {Capitalized}`), category (text or "Uncategorized"), duration (`{n}h`), language, price ("Free" if free-pricing or 0 else `symbol + toFixed(2)`), cert visibility (`#preview-cert` display flex/none).
- Pricing toggle `setPricingType('free'|'paid')`: toggles aria-pressed/`.cc-pricing-opt--active`, shows/hides `#price-field`, and swaps which input carries `name="price"` (`#price` gets `name=''` when free; `#price-hidden` gets `name='price'` when free). Init: paid if `$_POST['price'] > 0` else free.
- Range ↔ number sync: `#passing_range` input → `#passing_percentage.value = range.value`; number input clamped 0..100 → range.
- Certificate toggle: keeps passing field visible regardless (per code comment), syncs `aria-checked`.
- Instructor search/select: debounced filter (name+email `includes`), click/keyboard (Enter/Space) select → hidden `#instructor_id`, shows selected panel, hides search+list; clear button resets all; pre-select from `$_POST['instructor_id']`.
- Client validation (on submit, then first-error `scrollIntoView({behavior:'smooth',block:'center'})`): instructor required ("Please select an instructor."), title required/"Title must be at least 5 characters."/no max check client-side, short desc required/"Must be at least 20 characters.", price ≥ 0 when paid ("Price cannot be negative."), passing 0..100 ("Must be between 0 and 100."), duration ≥ 0 ("Duration cannot be negative."). On success disables `#submit-btn` (text "Creating course…", class `cc-btn--loading`).
- Blur inline validation for title and short description.
- `.cc-textarea` auto-resize: `height auto → max(scrollHeight, 80)+'px'` on input.
- `.cc-alert-close` removes parent.
- Trailing fontStylesheet listener.

## 5. edit-course.php — Edit Course (admin)

### Purpose / URL / metadata
- URL: `/admin/courses/{id}/edit` (PHP `edit-course.php?id=N`). Title `'Edit Course — ' . course['title'] . ' | Admin'`; robots noindex,nofollow. Nav active `courses`.
- `courseId = intval($_GET['id'])` → `adminGetCourse($courseId)`; if missing → `header("Location: courses.php")` redirect.

### Data load
- `$categories = getAllCategories()`; `$instructors = dbSelect("SELECT id, name FROM users WHERE role='instructor' ORDER BY name")`.
- Counts: enrollments (`SELECT COUNT(*) FROM enrollments WHERE course_id=?`), reviews (`COUNT(*) + AVG(rating)` → round 1dp or null), sections (`course_sections`), lessons (lessons JOINed through course_sections). All safely default 0 when dbSelectOne returns false.

### POST handling (edit)
Build `$data` (same as create PLUS):
```
is_published = isset($_POST['is_published']) ? 1 : 0
is_featured  = isset($_POST['is_featured'])  ? 1 : 0
```
Validation order: CSRF ("Invalid request. Please try again.") → empty title ("Course title is required.") → empty short_description ("Short description is required.") → `instructor_id <= 0` ("Please select an instructor.") → passing 0..100 ("Passing percentage must be between 0 and 100.") → `price < 0` ("Price cannot be negative."). NOTE title length 5/200 checks are NOT re-run on edit (only non-empty).
- Thumbnail upload handled BEFORE the update: if `$_FILES['thumbnail']` error===UPLOAD_ERR_OK and tmp_name non-empty → `adminUploadThumbnail(...)`; on failure error = message from upload, skipping the update.
- If no upload error: `adminUpdateCourse($courseId, $data)` → success string "Course updated successfully.", then **PRG preserving query string+success**: `$qs = http_build_query(array_merge($_GET, ['success'=>$success])); header("Location: ?$qs")`. Else error "Failed to update course. Please try again."
- `$_GET['success']` shown on load (htmlspecialchars).

### adminUpdateCourse (admin.php:637)
- Allowed fields (whitelist): title, description, short_description, category_id, level, language, duration_hours, price, certificate_enabled, passing_percentage, thumbnail, instructor_id, is_published, is_featured. Builds `SET` dynamically from present keys.
- If title present → regenerate slug (same slug algorithm) + uniqueness check `WHERE slug = ? AND id != ?` (append `-{time()}` if taken) and set it.
- Returns `dbExecute(...)` result (updates in place).

### Success/error alert (mirrors create but `ec-` prefix, `#ec-success-alert` auto-dismiss after 5000ms)

### Header
- `.ec-page-header` > `.ec-page-header-left`: `a.ec-back-btn[aria-label="Back to courses"][href=courses.php]` (chevron) "Back to Courses"; `.ec-page-icon` (pen svg 22×22) + `h1.ec-page-title` "Edit Course" + `p.ec-page-subtitle` 'ID #N &nbsp;·&nbsp;' + status badges (`span.ec-status-badge.ec-status-badge--published` "Published" | `--draft` "Draft") + optional `span.ec-status-badge.ec-status-badge--featured` "Featured".
- Right: `a.ec-btn.ec-btn--ghost[href=courses.php]` (X svg 15×15) "Discard" + `button.ec-btn.ec-btn--primary[type=submit][form=editCourseForm]` (save svg 15×15) "Save Changes".

### Form (`form#editCourseForm[method=post][enctype="multipart/form-data"][novalidate]`)
Hidden `csrf_token`. `.ec-layout` = `.ec-form-main` + `.ec-sidebar`.

Main cards:
1. **Basic Information** (blue file icon) with instructor select FIRST in the main column:
   - `#field-instructor`: `label.ec-label[for=instructor_id]` "Assign to Instructor *"; `.ec-select-wrap` = `select#instructor_id[name=instructor_id].ec-select[required][aria-describedby=instructor-error]` — first option value="" "— Select Instructor —", then instructors (`id`→name), preselected by `course['instructor_id']` + `.ec-select-chevron` svg 16×16; `span.ec-field-error#instructor-error`.
   - Title (`#field-title`): `input#title[name=title].ec-input[type=text][maxlength=200][required][aria-describedby="title-hint title-counter title-error"]` placeholder same as create, value course title, autocomplete off; footer `#title-hint` "Aim for 60–80 characters. Be specific and compelling." + counter `#title-count/200`; `.ec-slug-preview#slug-preview` with `#slug-value` (JS fills from title, `#slug-value` substring(0,80)); `#title-error`.
   - Short Description (`#field-short-desc`): label + badge "Shown on course cards"; `textarea#short_description.ec-input.ec-textarea.ec-textarea--sm[rows=3][maxlength=500][required][aria-describedby="short-desc-hint short-desc-counter short-desc-error"]`; hint `#short-desc-hint` "20–160 characters recommended for best display."; counter `#short-desc-count/500`; `#short-desc-error`.
   - Full Description: `textarea#description.ec-input.ec-textarea.ec-textarea--lg[rows=7]` + hint `#desc-hint` + counter `#desc-count` "0 chars", label suffix "(optional)".
2. **Course Details** (violet info circle icon, "Category, level, language & duration"): `.ec-grid.ec-grid--2`:
   - Category: label "Category"; `select#category_id[name=category_id].ec-select` first option value="" "Uncategorized" then list; `.ec-select-chevron`.
   - Level: `select#level[name=level].ec-select` — options "Beginner" value=beginner, "Intermediate", "Advanced" (NO emoji here, unlike create page).
   - Language: `input#language[name=language].ec-input[type=text][maxlength=50][placeholder="e.g. English"]` (free text, not select!)
   - Duration: `#field-duration` label "Duration (hours)"; `.ec-input-icon-wrap` = `.ec-input-icon` (clock svg 16×16) + `input#duration_hours[name=duration_hours].ec-input.ec-input--with-icon[type=number][min=0][max=9999][placeholder=0]` value `(string)$course['duration_hours']`.
3. **Pricing & Certification** (green currency icon, "Set price and passing criteria"): `.ec-grid.ec-grid--2`:
   - Price `#field-price`: label "Price" + `span.ec-label-badge.ec-label-badge--green` "Set 0 for free"; `.ec-input-prefix-wrap` = `span.ec-input-prefix[aria-hidden=true]` currency + `input#price[name=price].ec-input.ec-input--with-prefix[type=number][min=0][step=0.01][max=99999][placeholder=0.00][aria-describedby=price-error]` value `(string)$course['price']`. `.ec-price-preview#price-preview` = `span#price-preview-text` "🆓 Free course" OR "💰 Paid: {formatPrice(price,false)}". `#price-error`.
   - Passing Percentage `#field-passing`: label "Passing Percentage" + badge "Quiz threshold"; `.ec-input-suffix-wrap` = `input#passing_percentage[name=passing_percentage].ec-input.ec-input--with-suffix[type=number][min=0][max=100][placeholder=70][aria-describedby="passing-hint passing-error"]` value course value + `span.ec-input-suffix[aria-hidden=true]` "%"; `.ec-pass-bar-wrap[aria-hidden=true]` = `.ec-pass-bar` > `.ec-pass-bar-fill#pass-bar-fill[style="width:{min(100,int)}%"]`; hint `#passing-hint` "Minimum score required to pass quizzes & earn certificate."; `#passing-error`.
4. **Course Thumbnail** (amber image icon, "JPG, PNG or WebP — max 2 MB"): `.ec-thumbnail-layout` =
   - `.ec-thumbnail-preview#thumbnail-preview-wrap`: if thumbnail → `img#thumbnail-preview-img.ec-thumbnail-img` (current) + `.ec-thumbnail-overlay[aria-hidden=true]` (pen svg 24×24 "Change Image"); else → `.ec-thumbnail-placeholder#thumbnail-placeholder` (image svg 36×36 "No thumbnail") + `img#thumbnail-preview-img[style=display:none][alt="New thumbnail preview"]`.
   - `.ec-thumbnail-controls`: `label.ec-upload-btn[for=thumbnail][tabindex=0]` (upload svg 16×16) "{Replace Thumbnail|Upload Thumbnail}"; `input#thumbnail[name=thumbnail][type=file][accept="image/jpeg,image/png,image/webp"].ec-file-input[aria-label="Upload course thumbnail"]`; `p.ec-upload-hint` "Recommended: 1280×720 px (16:9). JPG, PNG, WebP. Max 2 MB."; `.ec-upload-info#upload-info[style=display:none]` (file svg 14×14 + `span#upload-filename` + `button.ec-upload-clear#upload-clear[type=button][aria-label="Remove selected file"]` X svg 12×12); `span.ec-field-error#thumbnail-error`.
5. **Visibility & Flags** (red eye icon, "Control course status and features"): `.ec-toggles-grid` of 3 `label.ec-toggle-card[for=…]` cards, each `.ec-toggle-card-icon` (variant `--green`/`--amber`/`--blue`), `.ec-toggle-card-body` (`.ec-toggle-card-title` + `.ec-toggle-card-desc`), `.ec-toggle-switch-wrap` (`input.ec-toggle-input[type=checkbox][role=switch][aria-checked]` + `span.ec-toggle-slider`):
   - `#is_published` "Published" / "Visible to students on the platform" (checked when published)
   - `#is_featured` "Featured" / "Highlighted on homepage & browse pages"
   - `#certificate_enabled` "Certificate Enabled" / "Students earn a certificate on completion"
6. **Form Actions** `.ec-form-actions`: `a.ec-btn.ec-btn--outline[href=courses.php]` (X svg) "Cancel" + `button#submit-btn.ec-btn.ec-btn--primary.ec-btn--lg[type=submit]` (save svg 16×16) "Save Changes".

Sidebar `.ec-sidebar[aria-label="Course overview"]`:
- **Course Overview** (compact card): `.ec-stats-grid` of 4 `.ec-stat`s: `span.ec-stat-value` `number_format(enrollments)` / `"★ "+avgRating` or `"—"` / sectionCount / lessonCount with labels "Enrollments", "{n} reviews", "Sections", "Lessons".
- **Status**: `.ec-status-list` rows `#Visibility` (`.ec-pill.ec-pill--green` "Published" | `.ec-pill.ec-pill--gray` "Draft"), `#Featured` (`.ec-pill.ec-pill--amber` "Yes" | gray "No"), `#Certificate` (`.ec-pill.ec-pill--blue` "Enabled" | gray "Disabled"), `#Price` (`.ec-pill.ec-pill--green` "Free" | `.ec-pill.ec-pill--blue` `formatPrice(price,false)`).
- **Quick Links** `.ec-quick-links`: `a.ec-quick-link[href=enrollments.php?course={id}]` users svg "View Enrollments"; `a[href=reviews.php?course={id}]` star svg "View Reviews"; `a[href=courses.php]` book svg "All Courses".
- **Metadata** `.ec-meta-list` rows: Course ID (`#{{id}}`, value `--mono`), Instructor (`instructor_name ?? '—'`), Category (`category_name ?? 'Uncategorized'`), Created (`date('M j, Y', strtotime(created_at))` when set), Updated (same when set).

### Inline JS (port fully)
- helpers `byId`, `setError(fieldId,msg)` toggles `ec-field--error` on `#field-{fieldId}` parent and text in `#fieldId-error`.
- Counters: title warn at 160+, short-desc warn at 400+, description plain.
- Slug: `makeSlug` → lowercase, remove `[^a-z0-9\s-]`, collapse spaces/hyphens, `.substring(0,80)`. On input, sets `#slug-value`, toggles `ec-slug-preview--visible` when non-empty.
- Price preview: input → "🆓 Free course" if NaN/≤0 else "💰 Paid: {symbol}{val.toFixed(2)}".
- Passing bar: input → `width=val%`, color `#dc2626` (<40), `#d97706` (<70), `#16a34a` (≥70).
- Toggle switches: `change` → sync `aria-checked`.
- Thumbnail picker: on change validate MIME ∈ {image/jpeg, image/png, image/webp} → error "Invalid type. Only JPG, PNG, WebP allowed." + clear input; size > 2MB → "File too large. Max 2 MB." + clear; else FileReader preview into `#thumbnail-preview-img` (display '') + hide placeholder; show `#upload-info` with `"{name} ({sizeKB} KB)"`. `#upload-clear` resets input + hides info + clears error.
- Submit validation (preventDefault on fail, scroll to first `.ec-field--error`): title required/"Course title is required."→>200 "Title must be 200 characters or fewer."; short desc required; instructor required; price ≥0; passing 0..100. On valid: disabled + "Saving…".
- Blur validation for title and short desc.
- `.ec-alert-close` removes parent; `#ec-success-alert` (id present only on success) fades out after 5000ms (opacity transition 0.5s, then remove).
- Trailing fontStylesheet listener.

### adminUploadThumbnail (inline in edit-course.php:14)
- Allowed MIME: image/jpeg, image/png, image/webp (via `scanUploadedFile` from `private/functions/upload_security.php` — see section 6.2 of DB/STALEMENT notes; port upload_security rules: magic-byte scan, extension/MIME reconciliation, "course_thumbnail" purpose).
- Max size: 2 MB. Failure messages come from `scan` result.
- Upload dir: `public/uploads/courses/` (B2 in new site), filename `course_{id}_{time}.{ext}` (ext from MIME map jpg/png/webp). On success `UPDATE courses SET thumbnail = ?` with dbPath `/uploads/courses/{filename}` → `{success:true, path}`. Else `{success:false, message:'Upload failed. Check server write permissions.'}`.

## 6. admin.php functions relevant to this phase (port to lib/db/admin/+lib/api/admin/)

| Function | Line | Behavior | Port target |
|---|---|---|---|
| `getAllCoursesAdmin($filters=[],$limit=50,$offset=0)` | 298 | status published/pending filter; search title|description LIKE; instructor_id; SELECT w/ subqueries student_count/avg_rating/review_count + instructor_name/email + category_name; ORDER created_at DESC; LIMIT/OFFSET | `lib/db/admin/courses.ts: listCoursesAdmin` |
| `adminDeleteCourse($id)` | 342 | transactional cascade (see §3) | `lib/db/admin/courses.ts: adminDeleteCourse` + B2 object cleanup |
| `getAllCategories()` | 560 | `SELECT * FROM categories ORDER BY name` | reuse `lib/db/instructor/courses.ts: getCategories` |
| `adminGetCourse($id)` | 623 | `SELECT c.*, u.name instructor_name, cat.name category_name FROM courses c LEFT JOIN users u LEFT JOIN categories cat WHERE c.id=?` (no ownership check) | `lib/db/admin/courses.ts: adminGetCourse` |
| `adminUpdateCourse($id,$data)` | 637 | whitelisted fields + slug regen on title change | `lib/db/admin/courses.ts: adminUpdateCourse` |
| `adminCreateCourse($data)` | 719 | slug gen + INSERT as draft (is_published=0), category_id `?: null` | `lib/db/admin/courses.ts: adminCreateCourse` |
| `getPendingApplicationsCount()` | 797 | count instructor_applications status='pending' (NOT used by these 3 pages; used by admin dashboard/navbar badge) | existing/new admin helper |
| `adminToggleCoursePublish($id,$publish)` | 820 | `UPDATE courses SET is_published=? WHERE id=?` (NOT used by these pages; courses.php inlines the toggle) | helper in admin course module |

## 7. CSS files
- `courses.css`: `crs-` prefixed. Variables (define via `:root`): `--crs-primary: #e84545; --crs-...` plus reuse of navbar vars. Defines page-wrap/padding-top (navbar-dependent), header, stat cards, toolbar/selects, table (thumb 56×38, badge colors #e84545 featured, green published/pending amber), bulk bar (sticky), dropdown menu, modal (fixed overlay, backdrop blur), empty state, pagination. Port verbatim; keep file name `admin/courses.css`.
- `create-course.css`: `cc-` prefix; vars `--cc-primary:#e84545; --cc-blue:#2563eb; --cc-violet:#8b5cf6; --cc-green:#22c55e; --cc-amber:#f59e0b; --cc-red:#ef4444; --cc-slate:#64748b; --cc-bg:#f8fafc; --cc-card:#fff; --cc-border:#e5e7eb; --cc-text:#0f172a...`; also `.cc-range-input-wrap`, `--select` , and importantly the toggle/select/range styles for the widgets above. Also `ad-page-wrap` reset (relies on navbar.css).
- `edit-course.css`: `ec-` prefix; analogous vars `--ec-primary` etc. Thumbnail/sidebar/toggle-card/pill styles.
- IMPORTANT: Both create/edit CSS depend on `navbar.css` being loaded first (the `.ad-page-wrap` / `--ad-*` vars / body padding-top). In the new project, verify `styles/css/admin/courses.css|create-course.css|edit-course.css` are byte-identical imports of the three PHP CSS files (line counts match as noted). Do not partially restyle.

## 8. Comparison with existing new-project instructor implementation (KEY DECISIONS)

The instructor phase built an editor (`CourseEditor.tsx` + `CustomSelect.tsx` + custom `instructor/{create,edit}-course.css`) whose markup does NOT match the admin PHP pages:

| Aspect | Admin PHP (this phase) | Existing CourseEditor (instructor) |
|---|---|---|
| page id | `createCourseForm` / `editCourseForm` | `mainForm` |
| wrapper classes | `.cc-page-wrap.ad-page-wrap`, `.cc-page-inner`, `.cc-card`, `.cc-card-header`, `.cc-card-title`, `.cc-select-wrap`, `.cc-toggle-row/-switch/-thumb`, `.cc-range`, `.cc-pricing-toggle`, `.cc-instructor-search`, `.cc-preview-*`, `.cc-actions-card` … | `.cc-grid`, `.cc-col`, `.cc-card`, `.cc-card-title` + `.cc-card-num`, `.cc-custom-select`, `.cc-toggle-track/-thumb` (checkbox-in-label), `.cc-price-wrap`, `.cc-upload-box` … |
| edit prefix | `ec-` (`.ec-layout`, `.ec-card`, `.ec-select-wrap`, `.ec-toggle-card`, `.ec-pass-bar`, `.ec-pill`, `.ec-sidebar` …) | `ec-` (`.ec-card`, `.ec-custom-select`, `.ec-price-wrap`, `.ec-toggle-track`, `.ec-current-thumb` …) |
| field set | admin create has NO learning outcomes, NO what_you_learn/requirements (they exist only in editor); admin edit has direct `select#instructor_id` (native), `input#language` text, `is_published`/`is_featured` toggles, thumbnail block, no what_you_learn | has what_you_learn/requirements (collected but NOT persisted — commented "the PHP collects these but never persists them"); has `language` text input; certificate toggle; passing field hidden unless cert enabled; thumbnail upload |
| instructor picker | create: searchable custom list (`.cc-instructor-search`), edit: native `select#instructor_id` | none (instructor_id = session user) |
| payload fields | + `instructor_id`, `is_published`, `is_featured` | + none of those |
| title max | 200 chars (`maxlength=200`, validation ≤200) | 150 (`maxLength=150`) |
| short desc max | 500 | 250 |
| duration | `type=number min=0 max=9999` int, `intval` | `min=0 step=0.5`, coerce int catch 0 |
| price | free/paid toggle, hidden `price` remap, `max=99999` on edit | no toggle, always `price`, `step=0.01`, no max |
| passing % | create: range slider + number; edit: number + bar; both ALWAYS visible | only shown when cert toggled on |
| level options | create: emoji (🟢🟡🔴); edit: plain text | plain via COURSE_LEVELS |
| submit mechanism | classic multipart POST, server re-render on validation fail, PRG on success | fetch/JSON; redirect handed back by server |
| CSRF | hidden `csrf_token` in every form (incl. bulk + delete + dropdown forms) | hidden `csrf_token` present; origin+token verified |
| success string | "Course updated successfully." / create success banner | "Course updated successfully!" (bang), no create banner |

Implications to record for phase owner:
1. The admin pages must be built as DIRECT 1:1 ports of the PHP markup/JS (per §12/§14 parity gate), NOT by dropping `CourseEditor` in as-is. `CourseEditor` was written for the instructor UX and its classes (e.g. `cc-custom-select`, `cc-upload-box`, `cc-price-wrap`, `cc-toggle-track`, `cc-actions`) do not exist in the verbatim admin CSS, and its field set omits `instructor_id`, `is_published`, `is_featured` and the pricing toggle.
2. If SOME reuse of `CustomSelect`/`CourseEditor` is desired, it must be limited to renamed/superset variants that emit the exact admin classes and the exact admin field set, then re-run parity script. Default recommendation: hand-port the three pages to JSX with the exact classes/ids from §3–§5 and port the inline scripts to client components. Document any deviation in PROGRESS.md.
3. The new admin API must be a new module `lib/api/admin/course-actions.ts` (NOT `lib/api/instructor/course-actions.ts`), sharing: `courseSchema`-equivalent zod schema per admin validations above (note length diffs), origin+CSRF checks, and `scanUploadFile` + B2 store for thumbnails. Add `lib/db/admin/courses.ts` with the six functions in §6. Reuse `revalidatePublicCoursePages` on create/update/delete/feature/unfeature/publish/unpublish/bulk.
4. Admin payload `instructor_id` optional on create? No — required (validation first rule). On edit, mandatory select. Accept a string→int coercion for `instructor_id`, `category_id` (nullable), `is_published`/`is_featured` checkbox transform.
5. Role guard for admin: use/PORT `requireRole` equivalent (`requireAdmin`) in both pages and API routes. Instructor guards (`requireInstructorApproved`, `getApprovedInstructorFromRequest`) must NOT be used for admin routes.
6. Thumbnail storage: PHP wrote to `public/uploads/courses/{course_id}_{time}.{ext}` on the app server. New site must store in B2 (matching `media_urls.php` semantics) and store the returned path in `courses.thumbnail`. When a course is deleted, delete its B2 thumbnail object too (PHP didn't, but port the intended "files removed with course" behavior — note in PROGRESS).
7. Toggles must revalidate; bulk changes too.

## 9. Port plan (roadmap for implementation phase)

New files:
- `app/(site)/admin/courses/page.tsx` — server component: `requireAdmin()`, run stats + listing queries, handle `msg`, render table; ISR off (`force-dynamic`, admin).
- `app/(site)/admin/courses/create/page.tsx` — server component: `requireAdmin()`, load categories+instructors; render success banner on `?success=1&id=`, else empty form; client component port of create-course JS.
- `app/(site)/admin/courses/[id]/edit/page.tsx` — server component: `requireAdmin()`, `adminGetCourse`, redirect to `/admin/courses` on missing; counts; form + client JS port.
- `app/api/admin/courses/route.ts` — POST create (`createCourseAction` for admin).
- `app/api/admin/courses/[id]/route.ts` — POST save/publish/unpublish/feature/unfeature/delete + thumbnail upload; follow PHP messages.
- `app/api/admin/courses/bulk/route.ts` — POST bulk publish/unpublish/feature/unfeature/delete (mirror exact messages).
- `lib/db/admin/courses.ts` — the §6 ports.
- `lib/api/admin/course-actions.ts` — zod schemas + handlers, CSRF origin+token, B2 thumbnail store, revalidate.
- Client components (admin area): `admin/courses/CourseList.tsx` (list interactions: filters auto-submit, bulk bar, dropdowns, modals, alerts, pagination), `admin/courses/CreateCourseForm.tsx` (JS port), `admin/courses/EditCourseForm.tsx` (JS port incl. thumbnail client validation + upload info + pass bar + toggles + warnings). MarkdownEditor is NOT used on the admin create/edit pages (plain textarea), so do not import it there.
- Guards: reuse/extend `lib/auth/guards` with `requireAdmin` (portal) if absent.
- CSS: import `@/styles/css/admin/courses.css`, `create-course.css`, `edit-course.css` and `base.css`+`navbar.css` in the admin layout in the same order as PHP.

## 10. Edge cases / notes flagged
- `courses.php` search also matches instructor name (`u.name LIKE`) — getAllCoursesAdmin does NOT. Keep the page behavior.
- Pagination clamps `page` to `totalPages` and recomputes offset.
- `msg` values contain single quotes in some paths? No — all use `urlencode`; messages contain no quotes. Keep exact strings (with counts like `2 course(s) published.`).
- On bulk delete success message uses the COUNT OF SUCCESSES (`$deleted`), not the count of selected ids (a failed deletion is silently skipped).
- Admin create ignores `what_you_learn`/`requirements` entirely (no such POST fields); editor's learning-outcomes card must NOT appear on admin pages.
- `edit-course.php` free/paid is NOT a toggle — price input + `#price-preview` only; passing hint differs ("Quiz threshold").
- `formatPrice((float)$course['price'])` (1 arg) on listing vs `formatPrice(..., false)` (2 args, no suffix) in edit sidebar — preserve exactly.
- Dates: `date('M j, Y', strtotime(...))` — replicate timezone behavior (site uses a fixed timezone from bootstrap/config; dates stored UTC in new DB).
- `language` on edit is a text input (max 50); on create it is a 16-option select. Modal/EDGE: editing a course whose language is not in the list is fine on edit but create must default English.
- Client validation on create does NOT re-check the 200/500 length caps (only server does) — mirror exactly.
- `#passing-field` on create is always visible even when cert disabled (PHP comment says so). On edit passing is a separate card; no dependency on cert.
- Upload validation messages ("Invalid type. Only JPG, PNG, WebP allowed." / "File too large. Max 2 MB.") are client-side only; server also runs `scanUploadedFile`.

## 11. Emails
- None of the three pages send emails. Rendering/porting must not add any.

## 12. Security recap (parity or better)
- Role gate admin on page + API.
- CSRF token on every state-changing form incl. row dropdowns, bulk form, delete forms, create/edit forms. Verify token AND origin/host.
- PRG after every successful POST (create, edit, delete, toggle, feature, unfeature, bulk).
- Escape all user data on output (title/description/instructor names go through `htmlspecialchars` today; React escaping covers it — never `dangerouslySetInnerHTML` these).
- Thumbnail upload: MIME allowlist + 2 MB cap + magic-byte scan (scanUploadedFile port) + randomized/server-generated filename.
- `noindex, nofollow` on all three pages.
- Bulk/loop delete must run in a transaction per course (already the case).
- Revalidate public pages after any write that changes is_published/is_featured/title/price/thumbnail.