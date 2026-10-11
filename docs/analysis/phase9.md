# Phase 9 — Admin Area (master index)

> Numbering note: the in-repo `docs/PROGRESS.md` checklist labels the admin area **Phase 8**
> and reserves "Phase 9" for uploads/media ops. The user's build plan calls the admin area
> **Phase 9**. This document and the `docs/analysis/phase9/*` sub-specs use the **user's plan
> numbering (Phase 9 = Admin)**. When reading PROGRESS.md, "Phase 8 admin" == "Phase 9" here.

Source of truth (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs\public\admin\`
Target route group: `app/(site)/admin/**` (server components + client islands).

---

## 1. Scope

Every file in `public/admin/` — **19 PHP files** = 18 page templates + `serve-doc.php`:

banners, bug-report-detail, bug-reports, categories, contact-submission-detail,
contact-submissions, courses, create-course, dashboard, edit-course, enrollments,
instructor-application-detail, instructor-applications, reviews, send-notifications,
serve-doc, settings, user-detail, users.

None are skipped. The read-only list pages (bug-reports, contact-submissions) intentionally
have no POST API route — the PHP list pages are GET/render only.

---

## 2. Foundation decisions (shared by all admin pages)

- **Chrome.** Admin pages live under `app/(site)/admin/layout.tsx`, so they inherit the public
  site chrome: `SiteBanners` + `SiteNavbar` + `SiteFooter`. `SiteNavbar` already renders the
  admin nav links and derives the active item from the pathname. **Known divergence:**
  `SiteFooter` is the simplified public footer; the PHP admin pages used a compact
  `uftr-footer--admin` role-strip variant. This is an inherited divider from earlier phases, not
  introduced here; flagged for the Phase 11 parity audit.
- **Guard.** Every admin page runs `requireAdmin()` server-side before rendering; every admin
  API route runs `authorizeAdmin(req)` (session + admin role + Origin/Host) and then
  `csrfOk(token)` for state changes. Failures are audited.
- **Audit.** All admin mutations write `security_events` rows (`admin.*` namespaces) via
  `lib/admin/audit.ts`.
- **PRG.** State-changing forms use Post/Redirect/Get (303) exactly where the PHP did, carrying
  the same `?msg=`/`?msg_type=` flags.
- **No file writes / no secrets.** Settings and banners persist to Postgres only
  (`app_settings`, `site_banners`), never to disk. Secrets are read from env and never echoed;
  blank secret fields leave the stored value unchanged.
- **Dates.** Admin-formatted timestamps use `lib/admin/dates.ts` pinned to `APP_TIMEZONE`
  (the `date_default_timezone_set` equivalent).
- **Detail pages** that are fully client-driven are whole-page client components
  (`UserDetailClient`, `BugReportDetailClient`, `ContactSubmissionClient`,
  `InstructorApplicationDetailClient`); the server page still owns `requireAdmin()` and the
  initial data fetch.

---

## 3. Per-group specs (checklists that were followed while building)

| Group | Spec file |
|---|---|
| Dashboard | `docs/analysis/phase9/dashboard.md` |
| Users + user-detail | (see this file §4; no separate sub-spec) |
| Instructor applications | `docs/analysis/phase9/instructor-applications.md` |
| Courses + create/edit | `docs/analysis/phase9/courses.md` |
| Categories + enrollments + reviews | `docs/analysis/phase9/categories-enrollments-reviews.md` |
| Banners + send-notifications | `docs/analysis/phase9/banners-notifications.md` |
| Settings | `docs/analysis/phase9/settings.md` |
| Bug reports + contact submissions | `docs/analysis/phase9/bug-contact.md` |

---

## 4. PHP → new file mapping

Paths are relative to `Edulari/`. Route pages are `app/(site)/admin/<x>/page.tsx`.

| PHP (`public/admin/…` or private) | Route | API route | DB lib | API/logic lib | Client component | CSS |
|---|---|---|---|---|---|---|
| `dashboard.php` | dashboard | `api/admin/dashboard/route.ts` | `lib/db/admin/dashboard.ts` | — | — | `admin/dashboard.css` |
| `users.php` | users | `api/admin/users/route.ts` | `lib/db/admin/users.ts` | `lib/api/admin/users.ts` | `UsersClient.tsx` | `admin/users.css` |
| `user-detail.php` | user-detail | `api/admin/users/[id]/route.ts` | `lib/db/admin/users.ts` | `lib/api/admin/users.ts` | `UserDetailClient.tsx` | `admin/user-detail.css` |
| `instructor-applications.php` | instructor-applications | `api/admin/instructor-applications/route.ts` | `lib/db/admin/instructor-applications.ts` | `lib/api/admin/instructor-applications.ts` | `InstructorApplicationsClient.tsx` | `admin/instructor-applications.css` |
| `instructor-application-detail.php` | instructor-application-detail | `api/admin/instructor-applications/[id]/route.ts` | `lib/db/admin/instructor-applications.ts` | `lib/api/admin/instructor-applications.ts` | `InstructorApplicationDetailClient.tsx` | `admin/instructor-application-detail.css` |
| `courses.php` | courses | `api/admin/courses/route.ts` | `lib/db/admin/courses.ts` | `lib/api/admin/courses.ts` | `CoursesView.tsx` | `admin/courses.css` |
| `create-course.php` | create-course | `api/admin/courses/route.ts` (POST) | `lib/db/admin/courses.ts` | `lib/api/admin/courses.ts` | `CreateCourseForm.tsx` | `admin/create-course.css` |
| `edit-course.php` | edit-course | `api/admin/courses/[id]/route.ts` | `lib/db/admin/courses.ts` | `lib/api/admin/courses.ts` | `EditCourseForm.tsx` | `admin/edit-course.css` |
| `categories.php` | categories | `api/admin/categories/route.ts` | `lib/db/admin/categories.ts` | — | `CategoriesScripts.tsx` | `admin/categories.css` |
| `enrollments.php` | enrollments | `api/admin/enrollments/route.ts` | `lib/db/admin/enrollments.ts` | `lib/api/admin/enrollments.ts` | `EnrollmentsScripts.tsx` | `admin/reviews-enrollments.css` |
| `reviews.php` | reviews | `api/admin/reviews/route.ts` | `lib/db/admin/reviews.ts` | `lib/api/admin/reviews.ts` | `ReviewsScripts.tsx` | `admin/reviews-enrollments.css` |
| `banners.php` | banners | `api/admin/banners/route.ts` | `lib/db/admin/banners.ts` | `lib/api/admin/banners.ts` | `BannersView.tsx` | `admin/banners.css` |
| `send-notifications.php` | send-notifications | `api/admin/notifications/route.ts` | `lib/db/admin/notifications.ts` | `lib/api/admin/notifications.ts` | `SendNotificationsView.tsx` | `admin/send-notifications.css` (unused, see §6) |
| `settings.php` | settings | `api/admin/settings/route.ts` | `lib/db/admin/settings.ts` | `lib/api/admin/settings.ts` | `SettingsScripts.tsx` | `admin/settings.css` |
| `bug-reports.php` | bug-reports | *(none; read-only)* | `lib/db/admin/bug-reports.ts` | `lib/admin/bug-labels.ts` | — | `admin/bug-reports.css` |
| `bug-report-detail.php` | bug-report-detail | `api/admin/bug-reports/[id]/route.ts` + `api/admin/bug-attachment/route.ts` | `lib/db/admin/bug-reports.ts` | `lib/api/admin/bug-reports.ts`, `lib/email/bug-status.ts` | `BugReportDetailClient.tsx` | `admin/bug-report-detail.css` |
| `contact-submissions.php` | contact-submissions | *(none; read-only)* | `lib/db/admin/contact-submissions.ts` | `lib/admin/contact-labels.ts` | — | `admin/contact-submissions.css` |
| `contact-submission-detail.php` | contact-submission-detail | `api/admin/contact-submissions/[id]/route.ts` | `lib/db/admin/contact-submissions.ts` | `lib/api/admin/contact-submissions.ts`, `lib/email/contact-senders.ts` | `ContactSubmissionClient.tsx` | `admin/contact-submission-detail.css` |
| `serve-doc.php` (private docs) | — | `api/media/route.ts` (`type=instructor_doc`, admin-only) | — | `lib/storage/*` | — | — |

**Shared admin modules**
- `lib/admin/audit.ts` — `security_events` writer.
- `lib/admin/api.ts` — `authorizeAdmin`, `csrfOk`, response helpers.
- `lib/admin/dates.ts` — timezone-pinned formatters.
- `lib/admin/bug-labels.ts`, `lib/admin/contact-labels.ts`, `lib/admin/notification-options.ts` — label maps.
- `components/admin/ConfirmForm.tsx` — confirm-gated POST form.
- `app/(site)/admin/layout.tsx` — wraps `AdminMaintenanceBanner`.

**API routes total:** 16 files under `app/api/admin/**` + `api/media` (serve-doc) + `api/admin/bug-attachment`.

---

## 5. Security model

- Server-side `requireAdmin()` on all 18 pages; `authorizeAdmin(req)` (session + role + Origin/Host)
  then `csrfOk(token)` on every mutating admin route.
- Ownership/role rules preserved: instructors cannot buy; admin-only document access; per-row
  checks before mutation.
- Output escaping: React auto-escapes; flash/error messages rendered once (fixing PHP double-escape).
- Uploaded/attachment access: bug attachment route validates filename `^[A-Za-z0-9._-]+$` and
  requires the `bug_reports.attachment` row to equal it, so it can never read an arbitrary bucket key;
  streams the private object with Range passthrough.
- Secrets: env-only; blank secret submissions are ignored (stored value unchanged).

---

## 6. Deliberate deviations (consolidated)

1. **Read-only list pages have no POST API route** (bug-reports, contact-submissions) — mirrors
   the PHP GET/render-only pages.
2. **Banner settings store to `site_banners`**, not `private/data/banners.json` (serverless).
3. **Settings store to `app_settings`**, never rewrite config files; secrets env-only.
4. **Bug `msg_type` carried across the redirect** (PHP set `$msgType` but dropped it, so error
   flashes styled as success) — ported the intended behaviour.
5. **Single HTML-escape of flash messages** vs the PHP double-escape.
6. **Contact "reopen" restored**: the PHP `js-reopen-ticket` link was dead (GET-navigated without
   posting); the port submits the sidebar `change_status` form with `status=open`.
7. **Bug attachment download restored**: PHP linked to `/serve-attachment.php` which does not exist;
   the port implements the intended inline download via `api/admin/bug-attachment`.
8. **`send-notifications.css` unused** — like the PHP page's inline `<style>`, which is authoritative;
   the port reproduces the inline styles.
9. **`handleContactDetailPost` returns `NextResponse`** (PHP typed `void` yet returned).
10. **Admin course create/edit are hand-ported** (not the shared `CourseEditor`), matching the PHP
    pages' conflicting redeclare behaviour.
11. **Chrome**: inherited `(site)` layout (see §2) — `SiteFooter` is the simplified public footer,
    not the PHP admin `uftr-footer--admin` role strip.

---

## 7. Gate results (this phase)

- `npm run typecheck` — PASS (zero errors)
- `npm run lint` — PASS (0 errors, 0 warnings)
- `npm run build` — PASS (all admin routes present)
- `npm run test -- --run tests/admin-rules.test.ts` — PASS (14/14). Full suite: PASS (250 tests).
- `npm run parity-check` — **OK (68 templates, no missing class/id)**. The admin page pairs were
  added to `scripts/parity-check.mjs`; all 18 admin templates now checked alongside the prior 50.

Not measured: numeric old-vs-new pixel parity (`ui-compare`). Admin pages are not in the `ui-compare`
`PAGES` list, and the old PHP/MySQL stack is not available offline, so no numeric verdict is claimed.
Structural coverage relied on `parity-check` + byte-identical CSS copies.

---

## 8. Open items / limitations

- Pixel parity for admin pages not numerically measured (see §7).
- Inherited navbar/footer chrome divergence (footer role-strip).
- `app/api/report-bug/route.ts` (student flow, earlier phase) never populates
  `bug_reports.attachment`, so the admin detail attachment link only appears when a row has an
  attachment object on B2. Pre-existing; not part of this phase.
- Live B2/SMTP/Razorpay calls cannot be exercised offline.
