# EDULARI Feature Matrix

Master checklist mapping every PHP file under the old site's `public/` and `private/` 
folders (excluding `PHPMailer/**`, `logs/**`, `uploads/**`) to its new location. This is 
the checklist that `scripts/parity-check.mjs` audits in Phase 10.

Status values: `todo` (not started) | `done` | `partial`. Phase 0 = skeleton only; every row is `todo`.

| Old path | Purpose | New location | Status |
|---|---|---|---|
| `.htaccess` | N/A (static/config) | next.config.ts redirects()/headers() (port rules, Phase 1) | done |
| `private/.cleanup_last_run` | N/A (static/config) | cron_state table (Phase 9) | done |
| `private/.htaccess` | N/A (static/config) | next.config.ts headers()/deploy guards (Phase 1) | done |
| `private/.purge_last_run` | N/A (static/config) | cron_state table (Phase 9) | done |
| `private/.token_cleanup_last_run` | N/A (static/config) | cron_state table (Phase 9) | done |
| `private/api/ai_questions.php` | AI Question Generator * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ * Generates instructor-competency MCQ questions using the configured AI pro... | lib/ai/question-generator.ts | done |
| `private/api/api_config.php` | API Configuration * File: /htdocs/private/api/api_config.php * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ * All external AI API keys and setti... | lib/config.ts + .env.example (Phase 1) | done |
| `private/api/test_token.php` | Generic Test Token Functions * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ * Manages short-lived tokens that gate access to /test/index.php. * ... | lib/instructor/test-tokens.ts | done |
| `private/auth.php` | Authentication functions | lib/auth/* (sessions, guards) | done |
| `private/banner-templates/icon-message.php` | PHP page/module (no docblock) | lib/api/admin/banners.ts (`renderTemplateHtml`, icon-message branch) | done exact glyph map i/!/âœ“/â˜…, classes sbnt-icon-*. |
| `private/banner-templates/seasonal-promo.php` | PHP page/module (no docblock) | lib/api/admin/banners.ts (`renderTemplateHtml`, seasonal-promo branch) | done badge map Info/Notice/Offer/Sale! (default 'promo' â†’ Sale!). |
| `private/banner-templates/simple-text.php` | PHP page/module (no docblock) | lib/api/admin/banners.ts (`renderTemplateHtml`, simple-text branch) | done sbnt-simple-title / sbnt-simple-message. |
| `private/bootstrap.php` | Bootstrap â€“ Session Security * File: /private/bootstrap.php * * Include at the very top of every public PHP page. | lib/auth/bootstrap.ts + middleware.ts (headers/session) | done |
| `private/config.php` | Website configuration settings * File: /htdocs/private/config.php | lib/config.ts (typed env) + .env.example (Phase 1) | done |
| `private/config/b2_config.php` | Backblaze B2 Configuration * * === INSTRUCTIONS === * 1. Log in to https://secure.backblaze.com/b2_buckets.htm * 2. Create a private bucket (or note the existing bucket ID/name) | lib/storage/b2.ts (env names) | done |
| `private/data/banners.json` | Static asset / data file | public.site_banners table (migration 001) + lib/db/admin/banners.ts | done file store replaced by DB (serverless); identical object shape/ids. |
| `private/db.php` | Database connection handler | lib/db/client.ts | done |
| `private/email/email_senders.php` | Email Senders * * One send function per email type. Each function: * 1. Calls createMailer() to get a pre-configured PHPMailer instance. * 2. Sets the recipient, subject, and bo... | lib/email/senders.ts | done |
| `private/email/email_templates.php` | Email Templates â€” Edulari * * All HTML and plain-text body builders for every transactional email. * To add a new email type, add buildXxxHtml() + buildXxxText() here, * then ad... | lib/email/templates.ts | done |
| `private/email/mailer.php` | Mailer Helper * * Central factory for creating a pre-configured PHPMailer instance. * All email-sending functions should call createMailer() instead of * repeating the SMTP setu... | lib/email/mailer.ts | done |
| `private/functions/admin.php` | Admin Dashboard Functions | lib/db/admin/{courses,categories,enrollments,reviews,settings,dashboard,banners,notifications,users}.ts + lib/api/admin/settings.ts | done users CRUD, dashboard stats, categories, enrollments, reviews, settings, banners, notifications. Phase 10 closed the last two: `getBlockedUsers` and `getInstructorAuditSummary` are now in `lib/db/admin/users.ts`. |
| `private/functions/analytics.php` | Analytics Functions for Instructors | lib/db/analytics.ts | done |
| `private/functions/assignments.php` | Assignment Management Functions | lib/db/instructor/assignments.ts + lib/learning/assignments.ts | done Student side (`getAssignmentByLesson`, learn-page form, B2 attachment upload, graded card) + full authoring side (create/update/delete/getById/deleteByLesson) with the same defaults (max_marks=100, passing_marks=40, due_days=7). |
| `private/functions/b2_storage.php` | Backblaze B2 Storage | lib/storage/b2.ts | done cURL replaced by `@aws-sdk/client-s3` (B2 S3-compatible API). `presignPut`/`putObject`/`getObject`/`headObject`/`deleteObject` + `verifyUploadedObject` (HEAD size + ranged GET magic bytes, delete on failure). The `b2StreamFile` proxy is `app/api/media/route.ts`. PHP 'return array, never fatal' contract preserved: callers get null instead of throwing. |
| `private/functions/banners.php` | PHP page/module (no docblock) | lib/db/admin/banners.ts | done getAll/create/update (version bump on title/message/template/type/cta only)/delete/toggle/getActiveBannersForRole + static template registry; logBannerEvent -> auditAdmin/security_events. |
| `private/functions/certificates.php` | Certificate functions | lib/learning/certificates.ts | done + lib/db/learning.ts (certificate reads), app/(student)/student/generate-certificate/*, public verify page. PHP read `courses.certificate_issued/certificate_url`, which no migration creates: certs are derived from `certificates.enrollment_id`. |
| `private/functions/courses.php` | Course Management Functions | lib/db/courses.ts | done |
| `private/functions/instructor_registration.php` | Instructor Registration Functions * * Handles saving the multi-step instructor application to the database. * Requires the instructor_applications and instructor_profiles tables... | lib/db/instructor-registration.ts + lib/instructor/*.ts | done|
| `private/functions/lessons.php` | Lesson Management Functions | lib/db/lessons.ts | done |
| `private/functions/maintenance.php` | Role-scoped Maintenance Mode | lib/maintenance.ts + proxy.ts | done `getMaintenanceStatus`/`setMaintenanceStatus`/`autoDisableMaintenance`/`isPathInMaintenanceScope` ported; the proxy renders the 503 maintenance page with the admin bypass, exactly as checkMaintenanceMode() did. |
| `private/functions/markdown.php` | Lightweight Markdown -> HTML renderer | lib/markdown.ts | done custom regex renderer replaced by `marked` + `sanitize-html` with the same allow-list, per AGENTS.md section 3 (allowed libraries). Same output classes/tags. |
| `private/functions/media_urls.php` | Media URL helpers for B2-backed files. * Provides backward compatibility for existing local-path rows. | lib/storage/media-urls.ts | done |
| `private/functions/notifications.php` | Notification Functions * File: /private/functions/notifications.php * * Architecture: 2-table design * notification_messages â€” stores the message ONCE per broadcast | lib/db/notifications.ts + lib/db/admin/notifications.ts (admin send helpers) | done admin sends (createNotification/ForRole/ForAll, specific â†’ sent_by NULL), no notification_reads on send; reader-side lib/db/notifications.ts done earlier. |
| `private/functions/payment_reconciliation.php` | Layer 3 â€” Self-triggering payment reconciliation ("lazy cron"). * * AEONFREE (shared hosting) has no reliable real cron, so instead of a * scheduler, this piggybacks on ordinary... | lib/payments/reconciliation.ts + app/api/cron/reconcile-payments/route.ts (also triggered lazily from proxy.ts) | done |
| `private/functions/quizzes.php` | Quiz Management Functions | lib/db/instructor/quizzes.ts + lib/learning/quiz.ts | done Student side (getQuizQuestions/getQuizTotalPoints, scoring, attempt + quiz_answers persistence, review) + full authoring side (createQuizQuestion in a transaction, createQuizOption, updateQuizQuestion, updateQuizOptions, deleteQuizQuestion, replaceQuizQuestions). |
| `private/functions/sections.php` | Course Section Management Functions | lib/db/instructor/sections.ts | done |
| `private/functions/student.php` | Student-specific functions | lib/db/enrollments.ts (enrol/wishlist/cart incl. clear/moveToWishlist/wishlistAddToCart/moveAllToCart) + lib/db/commerce.ts (getCart/getWishlist/getStudentStats/purchase history/receipt) + app/course/[slug] (reviews) | done |
| `private/functions/token_cleanup.php` | Token & Attempt Cleanup Functions * * Cleans up expired/stale rows from: * - test_tokens (expired or already used) * - test_failures (ban period has passed) | lib/token-cleanup.ts + app/api/cron/* | done |
| `private/functions/upload_security.php` | Upload Security â€” Deep file content inspection * Called before move_uploaded_file() on every upload in the site. * * Since shared hosting lacks ClamAV, this performs: * 1. Magic... | lib/storage/upload-validation.ts | done |
| `private/oauth.php` | oauth.php â€” OAuth 2.0 helper functions for Google and GitHub * Location: /htdocs/private/oauth.php * * This is a NEW file. Create it at /htdocs/private/oauth.php | lib/auth/oauth.ts | done |
| `private/password_reset.php` | Password reset functions | lib/auth/password-reset.ts | done |
| `private/secrets.php` | secrets.php * Location: /htdocs/private/secrets.php * * This file is safe here because: * 1. The root .htaccess routes ALL requests to /public/ internally, | .env.example placeholders ONLY (never copied verbatim) | done |
| `private/sql/migrations/001_add_test_attempt_started_at.sql` | Static asset / data file | db/migrations/007_instructor_registration.sql | done |
| `public/.htaccess` | N/A (static/config) | next.config.ts headers()/redirects() (port rules, Phase 1) | done |
| `public/account-activation.php` | Redirect if already logged in | app/(auth)/account-activation/page.tsx | done |
| `public/admin/banners.php` | â”€â”€ AJAX/POST handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/banners/page.tsx + components/admin/BannersView.tsx + lib/api/admin/banners.ts + app/api/admin/banners/route.ts | done 5 JSON actions (create/update/delete/toggle/preview), exact validation order + messages, CTA pairing, template preview whitelist, csrf+origin, audit, 400/600ms reload timing, toast. |
| `public/admin/bug-report-detail.php` | â”€â”€ Load report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/bug-report-detail/page.tsx + BugReportDetailClient.tsx + lib/api/admin/bug-reports.ts + app/api/admin/bug-reports/[id]/route.ts + app/api/admin/bug-attachment/route.ts | done full detail port: status/severity switch actions, shared notes textarea, attach preview + download, reply/log-logic, msg_type flash, PRG, csrf+origin, audit. |
| `public/admin/bug-reports.php` | Admin â€“ Bug Reports List * File: /public/admin/bug-reports.php | app/(site)/admin/bug-reports/page.tsx + lib/db/admin/bug-reports.ts + lib/admin/bug-labels.ts | done list server component: filters (status/severity + search), stat cards, native GET forms + links, pagination. Base list API route intentionally skipped (read-only); lists render in-page. |
| `public/admin/categories.php` | Require admin role | app/(site)/admin/categories/page.tsx + CategoriesScripts.tsx + lib/db/admin/categories.ts + app/api/admin/categories/route.ts | done add/edit/delete, slug generation, course counts, csrf+origin, audit, PRG. |
| `public/admin/contact-submission-detail.php` | Admin â€“ Contact Submission Detail & Reply * File: /public/admin/contact-submission-detail.php | app/(site)/admin/contact-submission-detail/page.tsx + ContactSubmissionClient.tsx + lib/api/admin/contact-submissions.ts + app/api/admin/contact-submissions/[id]/route.ts + lib/email/contact-senders.ts | done detail port: reply with char counter + public/internal toggle, quick status buttons, reopen via sidebar (PHP dead link fixed), delete confirm, spam actions, msg_type flash, PRG, csrf+origin, audit. `handleContactDetailPost` returns NextResponse. |
| `public/admin/contact-submissions.php` | Admin â€“ Contact Submissions List * File: /public/admin/contact-submissions.php | app/(site)/admin/contact-submissions/page.tsx + lib/db/admin/contact-submissions.ts + lib/admin/contact-labels.ts | done list server component: filters (category/status/priority/search), stat cards, native GET forms + links, pagination. `listContactSubmissions(filters, limit, offset)`. Base list API route intentionally skipped (read-only). |
| `public/admin/courses.php` | Require admin role | app/(site)/admin/courses/page.tsx + CoursesView.tsx + lib/db/admin/courses.ts | done list, filters, bulk actions, modals, delete/toggle/feature. |
| `public/admin/create-course.php` | Validation | app/(site)/admin/create-course/page.tsx + CreateCourseForm.tsx | done create flow, free/paid toggle, success banner. |
| `public/admin/dashboard.php` | â”€â”€ Require admin role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/dashboard/page.tsx + app/api/admin/dashboard/route.ts + lib/db/admin/dashboard.ts | done platform stats grid, quick actions, recent signups/enrollments, top courses, three confirm-gated maintenance actions (PRG `?msg=`), intended `pending_applications` badge. |
| `public/admin/edit-course.php` | Inline thumbnail upload â€” avoids loading courses.php which conflicts * with admin.php (both define createSlug(), causing Fatal redeclare error). | app/(site)/admin/edit-course/page.tsx + EditCourseForm.tsx | done edit flow, thumbnail upload/clear, sidebar overview, success/error alerts. |
| `public/admin/enrollments.php` | â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/enrollments/page.tsx + EnrollmentsScripts.tsx + lib/db/admin/enrollments.ts + lib/api/admin/enrollments.ts + app/api/admin/enrollments/route.ts | done list/stats/filters, verify RZP payment + enroll, manual enroll, unenroll, csrf+origin, audit. |
| `public/admin/instructor-application-detail.php` | â”€â”€ Handle Approve / Reject / Re-open â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/instructor-application-detail/page.tsx (+ InstructorApplicationDetailClient.tsx, api/admin/instructor-applications/[id]/route.ts) | done |
| `public/admin/instructor-applications.php` | â”€â”€ Handle POST actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/instructor-applications/page.tsx (+ InstructorApplicationsClient.tsx, api/admin/instructor-applications/route.ts) | done |
| `public/admin/reviews.php` | â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/reviews/page.tsx + ReviewsScripts.tsx + lib/db/admin/reviews.ts + lib/api/admin/reviews.ts + app/api/admin/reviews/route.ts | done list/stats/distribution, filters, expand, modals, ajax delete, csrf+origin, audit, revalidate course. |
| `public/admin/send-notifications.php` | Admin: Send Notifications * File: /public/admin/send-notifications.php * * Allows admin to compose and broadcast notifications to: * - All users | app/(site)/admin/send-notifications/page.tsx + components/admin/SendNotificationsView.tsx + lib/api/admin/notifications.ts + lib/db/admin/notifications.ts + app/api/admin/notifications/route.ts | done 6 type tiles, 5 audiences, exact validation order/messages (byte length), one message row, PRG 303 + flash, email toggle/counters/live preview, page inline CSS. |
| `public/admin/serve-doc.php` | Admins only | app/api/media/route.ts (type=instructor_doc, admin-only) | done |
| `public/admin/settings.php` | â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/admin/settings/page.tsx + components/admin/SettingsScripts.tsx + app/api/admin/settings/route.ts + lib/api/admin/settings.ts + lib/db/admin/settings.ts + lib/email/settings-senders.ts | done 10 JSON actions (update_general/smtp/security/api, test_smtp, clear_cache, db_health, change_password, system_info, toggle_maintenance); secrets read from env, never persisted. |
| `public/admin/user-detail.php` | Require admin role | app/(site)/admin/user-detail/page.tsx + UserDetailClient.tsx + lib/api/admin/users.ts + app/api/admin/users/[id]/route.ts | done detail port: block/unblock/reason, role change, password reset email, session kick, audit, csrf+origin. |
| `public/admin/users.php` | Require admin role | app/(site)/admin/users/page.tsx + UsersClient.tsx + lib/db/admin/users.ts + lib/api/admin/users.ts + app/api/admin/users/route.ts | done list/stats/filters/search, bulk actions, pagination, csrf+origin, audit. |
| `public/ajax-image-upload.php` | PHP page/module (no docblock) | app/api/upload/image/route.ts | done |
| `public/assets/css/about.css` | â”€â”€ Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/about.css | done byte-identical copy in styles/css/. |
| `public/assets/css/admin/banners.css` | â”€â”€ PAGE HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/admin/banners.css | done imported by app/(site)/admin/banners/page.tsx (byte-identical copy). |
| `public/assets/css/admin/bug-report-detail.css` | â”€â”€ Back link â”€â”€ | styles/css/admin/bug-report-detail.css | done imported by app/(site)/admin/bug-report-detail/page.tsx (byte-identical copy). |
| `public/assets/css/admin/bug-reports.css` | â”€â”€ Page layout â”€â”€ | styles/css/admin/bug-reports.css | done imported by app/(site)/admin/bug-reports/page.tsx (byte-identical copy). |
| `public/assets/css/admin/categories.css` | Bulk delete btn | styles/css/admin/categories.css | done imported by app/(site)/admin/categories/page.tsx. |
| `public/assets/css/admin/contact-submission-detail.css` | â”€â”€ Page layout â”€â”€ | styles/css/admin/contact-submission-detail.css | done imported by app/(site)/admin/contact-submission-detail/page.tsx (byte-identical copy). |
| `public/assets/css/admin/contact-submissions.css` | â”€â”€ Page layout â”€â”€ | styles/css/admin/contact-submissions.css | done imported by app/(site)/admin/contact-submissions/page.tsx (byte-identical copy). |
| `public/assets/css/admin/courses.css` | â”€â”€ Course cell â”€â”€ | styles/css/admin/courses.css | done imported by app/(site)/admin/courses/page.tsx (byte-identical copy). |
| `public/assets/css/admin/create-course.css` | Page-specific palette | styles/css/admin/create-course.css | done imported by app/(site)/admin/create-course/page.tsx (byte-identical copy). |
| `public/assets/css/admin/dashboard.css` | Specific td variants | styles/css/admin/dashboard.css | done imported by app/(site)/admin/dashboard/page.tsx (byte-identical copy). |
| `public/assets/css/admin/edit-course.css` | Palette | styles/css/admin/edit-course.css | done imported by app/(site)/admin/edit-course/page.tsx (byte-identical copy). |
| `public/assets/css/admin/instructor-application-detail.css` | padding-top removed â€” body in navbar.css handles the fixed navbar offset | styles/css/admin/instructor-application-detail.css | done |
| `public/assets/css/admin/instructor-applications.css` | padding-top removed â€” body in navbar.css handles the fixed navbar offset | styles/css/admin/instructor-applications.css | done |
| `public/assets/css/admin/reviews-enrollments.css` | â”€â”€ Page shell â”€â”€ | styles/css/admin/reviews-enrollments.css | done imported by admin enrollments + reviews pages. |
| `public/assets/css/admin/send-notifications.css` | Brand / accent â€” matches admin red used site-wide | styles/css/admin/send-notifications.css | done copied byte-identical, but the PHP page never linked it (inline `<style>` is authoritative); the Next page reproduces the inline styles, so this file stays unused like the original. |
| `public/assets/css/admin/settings.css` | Page-level tokens â€“ reuse the navbar palette | styles/css/admin/settings.css | done imported by app/(site)/admin/settings/page.tsx (byte-identical copy). |
| `public/assets/css/admin/user-detail.css` | Breadcrumb | styles/css/admin/user-detail.css | done imported by app/(site)/admin/user-detail/page.tsx (byte-identical copy). |
| `public/assets/css/admin/users.css` | â”€â”€ Inputs & Selects â”€â”€ | styles/css/admin/users.css | done imported by app/(site)/admin/users/page.tsx (byte-identical copy). |
| `public/assets/css/auth/account-activation.css` | Brand palette | styles/css/auth/account-activation.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/forgot-password.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/forgot-password.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/instructor-register-success.css` | Brand palette | styles/css/auth/instructor-register-success.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/instructor-register.css` | Brand | styles/css/auth/instructor-register.css | done |
| `public/assets/css/auth/instructor-test.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/instructor-test.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/login.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/login.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/oauth.css` | â”€â”€ OAuth button container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/oauth.css | done byte-identical copy in styles/css/. |
| `public/assets/css/auth/onboarding.css` | Brand palette | styles/css/auth/onboarding.css | done imported verbatim by the onboarding page. |
| `public/assets/css/auth/password-reset-after-verify.css` | Brand palette | styles/css/auth/password-reset-after-verify.css | done |
| `public/assets/css/auth/register-success.css` | Brand palette | styles/css/auth/register-success.css | done |
| `public/assets/css/auth/register.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/register.css | done |
| `public/assets/css/auth/reset-password.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/reset-password.css | done |
| `public/assets/css/auth/verify-email.css` | â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/auth/verify-email.css | done |
| `public/assets/css/base.css` | Stylesheet | styles/css/base.css | done |
| `public/assets/css/browse-courses.css` | Brand palette | styles/css/browse-courses.css | done |
| `public/assets/css/cart-wishlist.css` | Dot-grid overlay | styles/css/cart-wishlist.css | done |
| `public/assets/css/categories.css` | Dot-grid overlay â€” identical to browse-courses hero | styles/css/categories.css | done |
| `public/assets/css/checkout.css` | Decorative grid overlay â€” same as hero | styles/css/checkout.css | done |
| `public/assets/css/contact.css` | â”€â”€ Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/contact.css | done |
| `public/assets/css/course-ai.css` | Course AI Chat floating widget | styles/css/course-ai.css | done imported verbatim; loaded by the learn page and the shared view. |
| `public/assets/css/course.css` | Surfaces | styles/css/course.css | done |
| `public/assets/css/help-center.css` | Search Bar | styles/css/help-center.css | done |
| `public/assets/css/home.css` | Brand palette â€” identical to student pages | styles/css/home.css | done |
| `public/assets/css/instructor-profile.css` | Brand palette | styles/css/instructor-profile.css | done |
| `public/assets/css/instructor/analytics.css` | Stat card | styles/css/instructor/analytics.css | done |
| `public/assets/css/instructor/course-analytics.css` | Page header action buttons | styles/css/instructor/course-analytics.css | done |
| `public/assets/css/instructor/course-content.css` | â”€â”€ Section card â”€â”€ | styles/css/instructor/course-content.css | done |
| `public/assets/css/instructor/courses.css` | Search input with icon | styles/css/instructor/courses.css | done |
| `public/assets/css/instructor/create-course.css` | â”€â”€ Local tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/instructor/create-course.css | done |
| `public/assets/css/instructor/dashboard.css` | Primary CTA button | styles/css/instructor/dashboard.css | done |
| `public/assets/css/instructor/earnings.css` | â”€â”€ Local tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/instructor/earnings.css | done |
| `public/assets/css/instructor/edit-course.css` | â”€â”€ Local tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/instructor/edit-course.css | done |
| `public/assets/css/instructor/profile.css` | Brand â€“ mirrors instructor dashboard palette | styles/css/instructor/profile.css | done |
| `public/assets/css/instructor/reviews.css` | Course badge | styles/css/instructor/reviews.css | done |
| `public/assets/css/instructor/students.css` | â”€â”€ Student cell â”€â”€ | styles/css/instructor/students.css | done |
| `public/assets/css/markdown-styles.css` | â”€â”€ Markdown renderer styles â”€â”€ | styles/css/markdown-styles.css | done |
| `public/assets/css/md-editor.css` | â”€â”€ Markdown WYSIWYG editor â”€â”€ | styles/css/md-editor.css | done |
| `public/assets/css/navbar.css` | â”€â”€ Base variables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/navbar.css | done |
| `public/assets/css/report-bug.css` | â”€â”€ Hero â”€â”€ | styles/css/report-bug.css | done |
| `public/assets/css/security.css` | Card header | styles/css/security.css | done |
| `public/assets/css/student/certificates.css` | Brand palette | styles/css/student/certificates.css | done verbatim. |
| `public/assets/css/student/dashboard.css` | Brand palette | styles/css/student/dashboard.css | done verbatim; the PHP inline `<style>` block (onboarding banner) is kept inline in JSX, byte-identical. |
| `public/assets/css/student/grades.css` | â”€â”€ 1. Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/student/grades.css | done verbatim. |
| `public/assets/css/student/learn.css` | Brand palette | styles/css/student/learn.css | done verbatim. |
| `public/assets/css/student/my-courses.css` | Brand palette | styles/css/student/my-courses.css | done verbatim, including the invalid bare `--navbar-height: 60px;` at line 1854 that Next's CSS parser rejects (inherited defect, documented). |
| `public/assets/css/student/profile.css` | Brand palette | styles/css/student/profile.css | done verbatim. |
| `public/assets/css/student/purchase-history.css` | Brand palette | styles/css/student/purchase-history.css | done |
| `public/assets/css/student/receipt.css` | Stylesheet | styles/css/student/receipt.css | done |
| `public/assets/css/student/schedule.css` | Decorative mini calendar in hero | styles/css/student/schedule.css | done verbatim. |
| `public/assets/css/track-contact.css` | â”€â”€ Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/track-contact.css | done |
| `public/assets/css/track-report.css` | â”€â”€ Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/track-report.css | done |
| `public/assets/css/updates.css` | Accent / interactive | styles/css/updates.css | done |
| `public/assets/css/verify-certificate.css` | Brand palette | styles/css/verify-certificate.css | done verbatim; footer-only chrome (PHP includes footer.php but no navbar.php), so the page lives under (foot). |
| `public/assets/css/video-player.css` | â”€â”€ Edulari reusable video player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | styles/css/video-player.css | done |
| `public/assets/images/ceo_signature.svg` | Static asset / data file | public/assets/images/ceo_signature.svg (copied verbatim) | done |
| `public/assets/images/edulari-logo.png` | Static asset / data file | public/assets/images/edulari-logo.png (copied verbatim) | done |
| `public/assets/images/edulari-stamp.png` | Static asset / data file | public/assets/images/edulari-stamp.png (copied verbatim) | done |
| `public/assets/images/favicon/android-chrome-192x192.png` | Static asset / data file | public/assets/images/favicon/android-chrome-192x192.png (copied verbatim) | done |
| `public/assets/images/favicon/android-chrome-512x512.png` | Static asset / data file | public/assets/images/favicon/android-chrome-512x512.png (copied verbatim) | done |
| `public/assets/images/favicon/apple-touch-icon.png` | Static asset / data file | public/assets/images/favicon/apple-touch-icon.png (copied verbatim) | done |
| `public/assets/images/favicon/favicon-16x16.png` | Static asset / data file | public/assets/images/favicon/favicon-16x16.png (copied verbatim) | done |
| `public/assets/images/favicon/favicon-32x32.png` | Static asset / data file | public/assets/images/favicon/favicon-32x32.png (copied verbatim) | done |
| `public/assets/images/favicon/favicon.ico` | Static asset / data file | public/assets/images/favicon/favicon.ico (copied verbatim) | done |
| `public/assets/images/favicon/site.webmanifest` | Static asset / data file | public/assets/images/favicon/site.webmanifest (copied verbatim) + app/manifest.ts (Phase 11) | done |
| `public/assets/images/verified-badge-footer.png` | Static asset / data file | public/assets/images/verified-badge-footer.png (copied verbatim) | done |
| `public/assets/images/verified-badge.png` | Static asset / data file | public/assets/images/verified-badge.png (copied verbatim) | done |
| `public/assets/js/auth.js` | Password visibility toggle | components/PasswordToggles.tsx | done |
| `public/assets/js/code-highlight.js` | Client script | components/CodeHighlight.tsx | done full port: same keyword tables, same token classes (tok-keyword/tok-comment/tok-string/tok-number), same DOM-ready pass and span-protection logic. |
| `public/assets/js/course-ai.js` | Client script | components/CourseAiChat.tsx + components/CodeHighlight.tsx | done ported to React (send/retry/edit/switch_version/feedback/share, markdown rendering, code highlighting, suggestion chips). |
| `public/assets/js/md-editor.js` | Client script | components/instructor/MarkdownEditor.tsx + lib/markdown-editor.ts | done full port: same toolbar, same link/image/code-block/table modals, same execCommand behaviour, same localStorage draft key, same `window.mdRefresh`, same `simple` mode and htmlToMarkdown/markdownToHtml conversion. |
| `public/assets/js/video-player.js` | Client script | components/VideoPlayer.tsx | done |
| `public/auth/github/callback.php` | GitHub OAuth Callback * Location: /htdocs/public/auth/github/callback.php * * This is a NEW file. Create the directory /htdocs/public/auth/github/ * and place this file inside it. | app/(auth)/oauth/github/callback/route.ts | done |
| `public/auth/google/callback.php` | Google OAuth Callback * Location: /htdocs/public/auth/google/callback.php * * This is a NEW file. Create the directory /htdocs/public/auth/google/ * and place this file inside it. | app/(auth)/oauth/google/callback/route.ts | done |
| `public/browse-courses.php` | Allow public access â€” actions require login | app/(public)/browse-courses/page.tsx | done |
| `public/cart.php` | â”€â”€ Restrict instructors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/cart/page.tsx + app/cart/CartClient.tsx + app/api/cart/{add,remove,move-to-wishlist,checkout} | done |
| `public/categories.php` | Edulari â€“ Public Categories Page * File: /public/categories.php * * Publicly accessible â€” no login required. * Shows all categories with course counts, live search, | app/(public)/categories/page.tsx | done |
| `public/checkout.php` | â”€â”€ Restrict instructors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/checkout/page.tsx + app/checkout/CheckoutClient.tsx + app/api/razorpay/create-order | done |
| `public/contact.php` | Contact Us â€” Public page (all roles including guests) * File: /public/contact.php | app/(public)/contact/page.tsx | done |
| `public/course-ai-shared.php` | Course AI Chat â€” public shared chat view (read-only, no login required) | app/(student)/course-ai-shared/page.tsx + SharedChatClient.tsx | done public read-only share view; unknown or missing slug renders the 404 page. |
| `public/course.php` | Allow public access â€” POST actions require login | app/(public)/course/[slug]/page.tsx | done |
| `public/create-order.php` | â”€â”€ Restrict instructors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/api/razorpay/create-order/route.ts | done |
| `public/demo.php` | PHP page/module (no docblock) | app/demo/route.ts (text/plain, mirrors demo.php's single echoed line) | done |
| `public/footer.php` | Unified Footer â€” All Roles (Guest / Student / Instructor / Admin) * File: /public/footer.php * * Fully self-contained: all CSS is scoped under the `uftr-` prefix * and injected ... | components/footer.tsx | done |
| `public/forgot-password.php` | If user is already logged in, redirect to homepage | app/(auth)/forgot-password/page.tsx | done |
| `public/google85c125c508318c1a.html` | Static asset / data file | public/google85c125c508318c1a.html (copied verbatim) | done |
| `public/help-center.php` | â”€â”€ Current user (optional â€” page is public) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(public)/help-center/page.tsx | done |
| `public/index.php` | Edulari â€“ Homepage * File: /public/index.php * * Completely redesigned standalone homepage. * Uses its own navbar (navbar.php) and self-contained footer. | app/(public)/page.tsx | done |
| `public/instructor-profile.php` | Instructor Profile Page * File: /public/instructor-profile.php * * Public page â€” guests can view. Login required to rate. * URL: /instructor-profile?id=<user_id> | app/(public)/instructor-profile/[slug]/page.tsx | done Phase 4; JSON-LD Person + Course + BreadcrumbList, OG/Twitter, ISR. |
| `public/instructor-register-success.php` | Only allow access if application was just submitted | app/instructor-register-success/page.tsx | done|
| `public/instructor-register/_init.php` | Instructor Registration â€“ Shared Initialiser * File: /public/instructor-register/_init.php * * Every step file does ONE thing at the very top: * require_once __DIR__ . '/_init.p... | lib/instructor/step-page.ts + lib/instructor/reg-session.ts | done|
| `public/instructor-register/_layout_bottom.php` | Instructor Registration â€“ Layout Bottom * File: /public/instructor-register/_layout_bottom.php * * Closes the HTML containers opened by _layout_top.php and outputs the * shared ... | components/instructor/RegShell.tsx (footer scripts) | done|
| `public/instructor-register/_layout_top.php` | Instructor Registration â€“ Layout Top * File: /public/instructor-register/_layout_top.php * * Renders: DOCTYPE â†’ <head> â†’ left panel (step-aware) â†’ step progress bar â†’ error aler... | components/instructor/RegShell.tsx + components/instructor/RegSteps.tsx | done|
| `public/instructor-register/index.php` | Instructor Registration â€“ Entry Point / Router * File: /public/instructor-register/index.php * * Visiting /instructor-register or /instructor-register/ hits this file. * It read... | app/instructor-register/page.tsx + app/api/reg-session/route.ts | done|
| `public/instructor-register/step-1.php` | Instructor Registration â€“ Step 1: Email & Password * File: /public/instructor-register/step-1.php | app/instructor-register/step-1/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-2.php` | Instructor Registration â€“ Step 2: Professional Profile & Bio * File: /public/instructor-register/step-2.php | app/instructor-register/step-2/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-3.php` | Instructor Registration â€“ Step 3: Credentials & Qualifications * File: /public/instructor-register/step-3.php | app/instructor-register/step-3/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-4.php` | Instructor Registration â€“ Step 4: Subject Matter Competency * File: /public/instructor-register/step-4.php | app/instructor-register/step-4/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-5.php` | Instructor Registration â€“ Step 5: Legal & Financial * File: /public/instructor-register/step-5.php | app/instructor-register/step-5/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-6.php` | Instructor Registration â€“ Step 6: Application Review Summary * File: /public/instructor-register/step-6.php * * Handles: * - Showing a full read-only review summary of all previ... | app/instructor-register/step-6/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-7.php` | Instructor Registration â€“ Step 7: Document Upload * File: /public/instructor-register/step-7.php * * Handles: * - Uploading Government ID and Marksheet/Degree certificate | app/instructor-register/step-7/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor-register/step-8.php` | Instructor Registration â€“ Step 8: Test Preview * File: /public/instructor-register/step-8.php * * Handles: * - Shows the user details about the upcoming competency test: | app/instructor-register/step-8/page.tsx + app/api/instructor-register/step/[n]/route.ts | done|
| `public/instructor/analytics.php` | Require instructor role | app/(instructor)/analytics/page.tsx | done |
| `public/instructor/course-analytics.php` | Require instructor role | app/(instructor)/course-analytics/page.tsx | done |
| `public/instructor/course-content.php` | Require instructor role | app/(instructor)/course-content/page.tsx | done |
| `public/instructor/courses.php` | Require instructor role | app/(instructor)/courses/page.tsx | done |
| `public/instructor/create-course.php` | Require instructor role | app/(instructor)/create-course/page.tsx | done |
| `public/instructor/dashboard.php` | Require instructor role | app/(instructor)/dashboard/page.tsx | done |
| `public/instructor/earnings.php` | Require instructor role | app/(instructor)/earnings/page.tsx | done |
| `public/instructor/edit-course.php` | Require instructor role | app/(instructor)/edit-course/page.tsx | done |
| `public/instructor/profile.php` | â”€â”€ Flash message helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(instructor)/profile/page.tsx | done |
| `public/instructor/reviews.php` | Require instructor role | app/(instructor)/reviews/page.tsx | done |
| `public/instructor/students.php` | Require instructor role | app/(instructor)/students/page.tsx | done |
| `public/llms.txt` | Static asset / data file | public/llms.txt (copied verbatim) | done |
| `public/login.php` | Show success message if password was just set | app/(auth)/login/page.tsx | done |
| `public/logout.php` | Require POST + valid CSRF token to prevent logout CSRF attacks | app/api/auth/logout/route.ts | done |
| `public/mark-order-status.php` | Records a client-reported terminal outcome for a Razorpay order that never * reached verify-payment.php â€” either the user dismissed the checkout popup * ('cancelled') or Razorpa... | app/api/razorpay/mark-order-status/route.ts | done |
| `public/media.php` | Block if student maintenance is active | app/api/media/route.ts | done single query-param route (`?type=avatar&key=` / `?type=lesson_pdf&id=` / `?type=assignment_file&id=` / `?type=instructor_doc&id=&field=`), not a `[key]` dynamic segment; the B2 key is a server-stored column so it is never user-supplied. Maintenance scope + per-type authorization enforced. |
| `public/navbar.php` | Unified Navbar â€” All Roles (Guest / Student / Instructor / Admin) * File: /public/navbar.php * * Layout: Coursera-style horizontal sticky top bar for ALL roles. * No sidebar. Sa... | components/navbar.tsx | done |
| `public/page/about.php` | About Us â€” Public page (all roles including guests) * File: /public/page/about.php | app/(public)/about/page.tsx | done |
| `public/partials/admin-maintenance-banner.php` | Admin Maintenance Banner * File: /public/partials/admin-maintenance-banner.php * * Fully self-contained: its own <style> block with a unique "admbn-" * prefix, so it renders ide... | components/AdminMaintenanceBanner.tsx | done |
| `public/partials/file_viewer.php` | Reusable file lesson viewer â€” renders PDF/DOC/DOCX/PPT/PPTX/XLS/XLSX/TXT ZIP/images/MP4/MP3 etc. inline in learn.php. Usage: edulariFileViewer($lessonId, $fileName, $title); | components/FileViewer.tsx | done |
| `public/partials/head.php` | Shared <head> partial * File: /public/partials/head.php * * Expected variables (set by the including page before include): * $pageTitle (string, required â€” page will error if mi... | app/layout.tsx + lib/seo/metadata.ts | done |
| `public/partials/maintenance-page.php` | Guard: this file must NEVER be reachable directly by URL â€” it only * renders when included by checkMaintenanceMode(), which defines * MAINTENANCE_PAGE_RENDER right before includ... | components/maintenance-page.ts (served by proxy.ts, 503) | done |
| `public/partials/site-banners.php` | Everything, including banner 0, tucked behind the navbar â€” just slivers peeking. | components/SiteBanners.tsx | done |
| `public/partials/video_player.php` | Reusable Edulari video player. Usage: edulariVideoPlayer($videoUrl, $title); | components/VideoPlayer.tsx | done |
| `public/password-reset-after-verify.php` | Redirect if already logged in | app/(auth)/password-reset-after-verify/page.tsx | done |
| `public/razorpay-webhook.php` | Razorpay Webhook Endpoint * * Called directly by Razorpay's servers (not the browser) whenever a payment * event occurs â€” this is Layer 2 of the enrollment reliability system. I... | app/api/razorpay/webhook/route.ts | done |
| `public/register-success.php` | â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(auth)/register-success/page.tsx | done |
| `public/register.php` | Already logged-in users are redirected | app/(auth)/register/page.tsx | done |
| `public/report-bug.php` | Report a Bug / Issue â€” Public page (all roles) * File: /public/report-bug.php | app/(public)/report-bug/page.tsx | done |
| `public/reset-password.php` | If user is already logged in, redirect to homepage | app/(auth)/reset-password/page.tsx | done |
| `public/robots.txt` | Static asset / data file | public/robots.txt (copied verbatim) + app/robots.ts (Phase 11) | done |
| `public/security.php` | â”€â”€ Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(public)/security/page.tsx | done |
| `public/sitemap.php` | Dynamic XML Sitemap * File: /htdocs/public/sitemap.php * * Accessible at: https://edulari.zya.me/sitemap.xml * Routed via .htaccess: /sitemap.xml â†’ /public/sitemap.php | app/sitemap.ts | done |
| `public/student/certificates.php` | â”€â”€ Fetch all certificates issued to this student â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/student/certificates/page.tsx + CertificatesClient.tsx | done list, stats strip, certificate cards, verify links. |
| `public/student/check-payment-status.php` | Student self-service "check my payment" endpoint. * * Used from the Purchase History page for orders stuck at 'enrollment_failed' * or 'abandoned'. The student submits the Razor... | app/api/student/check-payment-status/route.ts | done |
| `public/student/course_ai_chat_api.php` | Course AI Chat API â€” Groq-powered * Actions: get_messages, send, retry, edit_message, switch_version, feedback, share, get_share | app/api/student/course-ai/route.ts + lib/ai/course-chat.ts | done get_messages/send/retry/edit_message/switch_version/feedback/share/get_share. CSRF + Origin added; enrolled-student-only access. |
| `public/student/dashboard.php` | Require student role | app/(site)/student/dashboard/page.tsx + DashboardClient.tsx | done continue-learning, stats, streak/heatmap, upcoming deadlines, AI cards, onboarding banner. |
| `public/student/generate-certificate.php` | Verify enrollment | app/(student)/student/generate-certificate/page.tsx + CertificateClient.tsx | done 1122x730 canvas, SVG arc title, QR, share block, scale-to-fit + print CSS. PHP linked a CSS file it never loaded. |
| `public/student/grades.php` | Student Grades Page * File: /public/student/grades.php * * Shows a full academic performance breakdown for every enrolled course: * â€“ Summary stats (avg score, quizzes passed, a... | app/(site)/student/grades/page.tsx + GradesClient.tsx | done per-course panels, weighted average, letter grade, assignment submissions with feedback. |
| `public/student/learn.php` | Require student role | app/(student)/student/learn/page.tsx + LearnClient/LearnSidebar/LearnContent/useLearnBehaviour | done sidebar, topbar, custom video player, markdown/text/pdf, quiz runner, assignment form, AI tutor, time tracking, completion. |
| `public/student/my-courses.php` | â”€â”€ Avatar initials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/student/my-courses/page.tsx + MyCoursesClient.tsx | done enrolled/active tabs, progress bars, hours learned, certificate button when eligible. |
| `public/student/onboarding.php` | Must be logged in as a student | app/(student)/student/onboarding/page.tsx + OnboardingClient.tsx + app/api/student/onboarding/route.ts | done 5 steps, category chips, CSRF-protected POST, redirects once `profile_completed`. |
| `public/student/profile.php` | â”€â”€ Flash message helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/(site)/student/profile/page.tsx + ProfileClient.tsx + app/api/student/profile/route.ts + avatar routes | done three tabs, avatar upload/remove through the B2 image rules, skills, education, goal. |
| `public/student/purchase-history.php` | â”€â”€ Collapse repeated cancelled/failed attempts for the same course(s) â”€â”€â”€â”€â”€â”€ | app/student/purchase-history/page.tsx + PurchaseHistoryClient.tsx | done |
| `public/student/receipt.php` | PHP page/module (no docblock) | app/student/receipt/page.tsx + ReceiptDownload.tsx | done |
| `public/student/schedule-api.php` | Schedule AJAX API * File: /public/student/schedule-api.php * * Actions (POST): * add_plan â€“ insert row into study_plan | app/api/student/schedule/route.ts + lib/db/study-plan.ts | done add_plan/update_plan/toggle_done/delete_plan/get_lessons. CSRF + Origin added (the PHP endpoint had neither). |
| `public/student/schedule.php` | Student Schedule Page * File: /public/student/schedule.php * * Features: * â€“ 7-day week calendar with colour-coded plan chips | app/(site)/student/schedule/page.tsx + ScheduleClient.tsx | done 7-day grid, mini calendar, heatmap, pending tasks, add/edit/toggle/delete. |
| `public/test/index.php` | Fire the appropriate pass-side callback based on on_pass_action. * * @return true| app/test/page.tsx + app/api/test/route.ts | done |
| `public/track-contact.php` | Track Contact Ticket â€” Public page * File: /public/track-contact.php * * Users can look up the status of their submitted contact ticket by entering * their ticket reference and ... | app/(public)/track-contact/page.tsx | done |
| `public/track-report.php` | Track a Bug Report â€” Public page (all roles / guests) * File: /public/track-report.php | app/(public)/track-report/page.tsx | done |
| `public/updates.php` | Updates / Notifications Page * File: /public/updates.php * * Accessible to all logged-in roles: student, instructor, admin. | app/(public)/updates/page.tsx | done |
| `public/verify-certificate.php` | Try to enrich with instructor name via courses table | app/(foot)/verify-certificate/page.tsx + VerifyCertificateClient.tsx + CopyButton.tsx | done Phase 4 page; the certificate lookup now reads the real `certificates` rows written by the Phase 6 generate-certificate flow. |
| `public/verify-email.php` | Don't redirect logged-in users â€” allow verification regardless of login status. | app/(auth)/verify-email/page.tsx | done |
| `public/verify-payment.php` | â”€â”€ Restrict instructors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/api/razorpay/verify-payment/route.ts | done |
| `public/wishlist.php` | â”€â”€ Restrict instructors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ | app/wishlist/page.tsx + app/wishlist/WishlistClient.tsx + app/api/wishlist/action | done |

## Coverage notes

- `_EDULARI_BOOTSTRAP` guard, logging helpers (`logSecurity`/`logUpload`/`logApp` in `private/config.php`) map to `lib/security/events.ts` (security_events table + console).
- `private/uploads/**` (instructor documents) and `public/uploads/**` are NOT listed: they are data, not code. They map to the B2 private bucket in Phase 8.
- `private/PHPMailer/**` and `private/logs/**` are excluded per Phase 0 instructions. Log file contents move to DB/console in Phase 9.
- Secret-bearing files (`private/secrets.php`, PHP `$_ENV` values) are never copied; only env key NAMES go to `.env.example`.
## Phase 1 discoveries (added to inventory notes)
- `public/course-ai-shared.php` (shared chat view) and `scripts/*` cleanup helpers referenced: `cleanupStaleDraftDocs`, `purgeRejectedInstructorData` (15-day staleness, 5h file-throttle) ï¿½ track these under instructor-document purge in the instructor/admin rows.
- `public/admin/bug-report-detail.php` sends inline bug-report emails (see docs/analysis/email.md).
- `public/instructor/profile.php` sets `users.phone` but `phone` exists only on `student_profiles` ï¿½ schema/code mismatch flagged in db-usage.md.
- `docs_scheduled_delete`/`docs_delete_after` columns referenced by AGENTS.md/prompt do not exist in the codebase; actual purge mechanism is the two helpers above.

## Phase 2 artifacts
- `db/migrations/001..010` ï¿½ Postgres schema (all 43 tables + `site_banners`, `cron_state`, `maintenance_logs`, `security_events`, `schema_migrations`).
- `scripts/migrate.ts`, `scripts/create-admin.ts`, `scripts/seed.ts`, `lib/db/client.ts` ï¿½ implemented and verified.
- `docs/analysis/db-mapping.md`, `docs/DB_SETUP.md` ï¿½ written.

## Phase 3 artifacts
- `lib/config.ts`, `lib/security/{crypto,csrf,rate-limit,client-ip,events,headers,api,hmac}.ts`, `lib/auth/{passwords,sessions,guards,tokens,oauth}.ts`, `lib/email/{transport,senders}.ts`, `lib/storage/{b2,upload-validation}.ts`, `lib/markdown.ts`, `lib/notifications.ts`, `lib/maintenance.ts`, `lib/banners.ts`, `lib/token-cleanup.ts`, `lib/db/{client,users,sessions,categories,courses,settings}.ts`
- API routes: `app/api/media`, `app/api/upload/image`, `app/api/notifications{,/read-all,/[id]/read,/[id]/delete}`, `app/api/cron/{token-cleanup,maintenance}`
- `proxy.ts` (CSP nonce + maintenance + admin bypass), `next.config.ts` (legacy redirects + security headers + rewrites), `vercel.json` cron entries, `tests/*` unit tests (27 passing), `vitest.config.ts`

- DECISION (Phase 3/instructor): when porting `public/instructor/profile.php`, use `student_profiles.phone` (join `users`?`student_profiles` via `user_id`); never write `users.phone`.
- DECISION (home): replace placeholder `app/page.tsx` with the real homepage in the public-pages phase.

## Phase 4 artifacts

### Shared layout / SEO
- `app/layout.tsx`, `components/SiteNavbar.tsx`, `components/SiteFooter.tsx`, `components/SiteBanners.tsx`
- `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`
- `app/api/auth/me/route.ts`, `app/api/site-banners/route.ts`
- `lib/db/home.ts` (getFeaturedCourses / getLatestCourses / getPopularCategories / getPlatformStats / getTopRatedCourses / getRecentTestimonials / getWishlistIds)
- `lib/format.ts` (renderStars / getThumbnailUrl / getCategoryIcon / getLevelBadgeClass / formatPrice / strPad2 / trimWidth / currency symbol)

### Public pages (all 14 templates, parity-check clean)
| Old template | New route | Notes |
|---|---|---|
| `public/index.php` | `app/page.tsx` | full port incl. hero typing, counters, scroll-reveal, level filter, testimonials carousel, toast, back-to-top; WebSite + Organization JSON-LD |
| `public/page/about.php` | `app/about/page.tsx` | |
| `public/browse-courses.php` | `app/browse-courses/` + `BrowseClient.tsx` + `BrowseControls.tsx` | filters/sort/view as router pushes |
| `public/categories.php` | `app/categories/` + `CategoriesClient.tsx` | search, letter filter, sort, load more |
| `public/course.php` | `app/course/[slug]/` + `CourseClient.tsx` | wishlist/cart/free-enroll/unenroll/review |
| - | `app/category/[slug]/page.tsx` | clean URL from the category slug |
| `public/instructor-profile.php` | `app/instructor-profile/[slug]/page.tsx` | |
| `public/contact.php` | `app/contact/` + `ContactForm.tsx` | char counter, conditional context fields |
| `public/track-contact.php` | `app/track-contact/` + `TrackContactClient.tsx` | masked email + threaded replies |
| `public/help-center.php` | `app/help-center/` + `HelpCenterClient.tsx` | |
| `public/report-bug.php` | `app/report-bug/` + `ReportBugForm.tsx` | severity slider, upload zone, counters |
| `public/track-report.php` | `app/track-report/` + `TrackReportClient.tsx` + `trackReportConfig.ts` | timeline, callouts, masked email |
| `public/security.php` | `app/security/` + `SecurityClient.tsx` | authenticated page, as in PHP |
| `public/updates.php` | `app/updates/` + `UpdatesClient.tsx` + `MarkAllReadButton.tsx` | |
| `public/demo.php` | `app/demo/page.tsx` | |
| `public/verify-certificate.php` | `app/verify-certificate/` + `VerifyCertificateClient.tsx` + `CopyButton.tsx` | |

### Auth pages
| Old template | New route |
|---|---|
| `public/login.php` | `app/login/` + `LoginForm.tsx` |
| `public/register.php` | `app/register/` + `RegisterForm.tsx` |
| `public/register-success.php` | `app/register-success/page.tsx` |
| `public/account-activation.php` | `app/account-activation/` + `ActivationForm.tsx` |
| `public/verify-email.php` | `app/verify-email/page.tsx` |
| `public/forgot-password.php` | `app/forgot-password/` + `ForgotForm.tsx` |
| `public/reset-password.php` | `app/reset-password/` + `ResetForm.tsx` |
| `public/password-reset-after-verify.php` | `app/password-reset-after-verify/page.tsx` |
| `public/logout.php` | `app/logout/route.ts` |
| `public/auth/google/callback.php`, `public/auth/github/callback.php` | `app/api/auth/oauth/[provider]/` + `/callback/route.ts` |

Shared: `components/AuthShell.tsx`, `components/PasswordToggles.tsx` (port of `public/assets/js/auth.js`).

### API routes added in Phase 4
- `app/api/auth/{login,register,forgot-password,reset-password,resend-verification}`
- `app/api/auth/oauth/[provider]/route.ts`, `app/api/auth/oauth/[provider]/callback/route.ts`
- `app/api/contact/route.ts`, `app/api/contact/track/route.ts`, `app/api/report-bug/route.ts`
- `app/api/security/{change-password,logout-sessions}/route.ts`
- `app/api/wishlist/toggle/route.ts`, `app/api/cart/add/route.ts`, `app/api/enroll/route.ts`, `app/api/course/review/route.ts`

### Libs added in Phase 4
- `lib/auth/device.ts`, `lib/db/enrollments.ts`; extended `lib/auth/sessions.ts` (`revokeAllOtherSessions`, `revokeSessionById`, `regenerateSessionOnPasswordChange`) and `lib/auth/guards.ts` (`requireApiUser`, `requireApiRole`).
- Components replacing the homepage inline script: `components/HeroTyping.tsx`, `components/LatestCoursesFilter.tsx`, `components/TestimonialsCarousel.tsx`, `components/HomeEffects.tsx`, `components/CourseWishlistButton.tsx`, `components/Stars.tsx`.

### Shared partials (Phase 4 prompt "Shared" scope)
| Old partial | New location |
|---|---|
| `public/partials/head.php` | `app/layout.tsx` (fonts, icons, manifest, defaults) + `lib/seo/metadata.ts` (per-page block) |
| `public/partials/maintenance-page.php` | `components/maintenance-page.ts` -> served by `proxy.ts` with 503 |
| `public/partials/admin-maintenance-banner.php` | `components/AdminMaintenanceBanner.tsx` |
| `public/partials/video_player.php` + `public/assets/js/video-player.js` | `components/VideoPlayer.tsx` |
| `public/partials/file_viewer.php` | `components/FileViewer.tsx` |
| `public/assets/js/auth.js` | `components/PasswordToggles.tsx` |

### Tooling
- `scripts/parity-check.mjs` rewritten (PHP-stripping with sentinel, `<body>` scoping, subfolder template resolution, id validation). Result: **14 templates, 0 missing**.
- `scripts/verify-columns.ts` (`npm run verify-columns`) - real Phase 2 task-7 check: every column referenced by any SQL statement in `app/`+`lib/`+`scripts/` validated against `information_schema`. **175 statements, 182 references, 0 missing.**
- `scripts/smoke.ts` (`npm run smoke`) - migrations applied, RLS coverage, policy count, core tables, revoked `anon`/`authenticated` grants, seed rows, trigger function, index count. **All pass.**

### Decisions carried forward
- DECISION: 18 pages that read request-time data outside `<Suspense>` export `instant = false` (required by Cache Components). The homepage does this deliberately so its H1 (the LCP element per `index.php`) and JSON-LD are in the initial HTML.
- DECISION: no service worker was invented - the old site ships none, only `assets/images/favicon/site.webmanifest`.
- DECISION: cart/wishlist/checkout **pages** stay in their own phases; only the AJAX endpoints the public pages call are implemented here. (Superseded in Phase 5: the pages are now ported - see `app/cart/`, `app/wishlist/`, `app/checkout/`.)
- DECISION (Phase 5): never write `users.phone` - it lives on `student_profiles`. `create-order.php` sends `$user['phone'] ?? ''` but `getCurrentUser()` in `private/auth.php` never exposes it, so `contact` is ported as the empty string.
- DECISION (Phase 5): `$_SESSION['flash']` and `$_SESSION['razorpay_order_id'|'razorpay_amount']` become HMAC-signed httpOnly cookies (`lib/payments/flash.ts`, `lib/payments/pending-order.ts`) - a serverless app has no session store, and a signed cookie keeps the client from forging the message or the order binding.
- DECISION (Phase 5): the instructor bounce for `/cart`, `/wishlist` and `/checkout` lives in `proxy.ts` (middleware), because a page cannot attach a cookie to a `redirect()` in the App Router.
- DECISION (Phase 5): `verify-payment.php` answers 200 for a bad CSRF token and for instructors; the port answers 403 while keeping the `message` key the checkout JS reads. Business failures keep the PHP's 200-with-`success:false`.
- DECISION (Phase 5): "No paid courses in your cart." is delivered as `?flash=no_paid_courses`, resolved from a server-side allow-list (`PREDEFINED_FLASH`) so no attacker-controlled text is ever rendered.
- DECISION (Phase 5): `receipt.php` has no navbar/footer, and a nested layout cannot remove the root layout, so the page hides `.unav` / `.uftr-footer` / `.sbn-shell` / `.unav-drawer` with a scoped `<style>` block.
- DECISION (Phase 5): `assets/css/student/navbar.css` is listed in `$extraCss` by cart/wishlist/checkout.php but does not exist in the old site, so it is not imported.
- DECISION: the live FX-rate conversion from `private/config.php` is not ported; `CURRENCY_CODE` defaults to `INR` (the shipped value) and the symbol map is preserved in `lib/format.ts`.
- DECISION: CSRF token reproduced as an `edulari_csrf` httpOnly cookie issued by `proxy.ts` (session-equivalent, never rotated on POST), rendered server-side into forms and compared with `crypto.timingSafeEqual`, plus the Origin/Host check.
- DECISION: `/demo` is a `text/plain` route, matching `demo.php`'s single echoed line (the earlier `page.tsx` "Demo page" was fabricated and removed).
- DECISION: `login.php` / `register.php` set `index, follow` upstream; the port uses `noindex` because AGENTS.md Â§11 requires it for auth flows.
- DECISION: `report-bug.php` renders a CSRF field it never verifies; the port verifies it (PHP bug fixed).
- DECISION: the Phase 4 prompt's "pending instructor" navbar state has no counterpart in `navbar.php`; nothing was invented.

## Phase 5 artifacts

### Libraries
- `lib/payments/razorpay.ts` - `createRazorpayOrder`, `fetchCapturedRazorpayPayment`, `verifyCheckoutSignature`, `verifyWebhookSignature`, `safeCompare`, `RazorpayError`.
- `lib/payments/amounts.ts` - `splitPaidAndFree`, `computeOrderTotalPaise`, `toPaise`, `amountMatches`, `paiseToRupees`, `summarizeCart`.
- `lib/payments/capture.ts` - `processCapturedPayment()` (the one enrollment path for all four layers).
- `lib/payments/reconciliation.ts` - `maybeRunPaymentReconciliation`, `reconcilePendingRazorpayPayments`, `checkAndReconcileOneOrder`, `maybeRunCancelledOrdersCleanup`, `purgeOldCancelledOrders` + the PHP constants.
- `lib/payments/flash.ts`, `lib/payments/pending-order.ts` - the `$_SESSION` stand-ins.
- `lib/db/commerce.ts` - cart / wishlist / stats / order / purchase-history / receipt queries.
- `lib/db/enrollments.ts` - extended with `clearCart`, `moveToWishlist`, `wishlistAddToCart`, `moveAllToCart`.
- `components/FlashMessage.tsx`.

### Pages
- `app/cart/page.tsx` + `app/cart/CartClient.tsx`
- `app/wishlist/page.tsx` + `app/wishlist/WishlistClient.tsx`
- `app/checkout/page.tsx` + `app/checkout/CheckoutClient.tsx`
- `app/student/purchase-history/page.tsx` + `PurchaseHistoryClient.tsx`
- `app/student/receipt/page.tsx` + `ReceiptDownload.tsx`

### API routes
- `app/api/razorpay/create-order/route.ts`
- `app/api/razorpay/verify-payment/route.ts`
- `app/api/razorpay/webhook/route.ts`
- `app/api/razorpay/mark-order-status/route.ts`
- `app/api/student/check-payment-status/route.ts`
- `app/api/cron/reconcile-payments/route.ts` (new; `CRON_SECRET`; `vercel.json` every 5 min)
- `app/api/cart/remove/route.ts`, `app/api/cart/move-to-wishlist/route.ts`, `app/api/cart/checkout/route.ts`
- `app/api/wishlist/action/route.ts`
- `app/api/flash/consume/route.ts`

### Tests / scripts / docs
- `tests/razorpay-signature.test.ts`, `tests/payment-amounts.test.ts`, `tests/process-payment.test.ts`
- `scripts/smoke-phase5.ts` (`npm run smoke:phase5`) - 62 live checks, self-cleaning
- `db/migrations/011_fix_user_sessions_updated_trigger.sql` - fixes the Phase 2 trigger bug that blocked all session validation
- `docs/analysis/phase5.md`, `docs/TESTING_PAYMENTS.md`
- `scripts/parity-check.mjs` - 5 more templates registered (19 total)

## Phase 10 audit reconciliation

Every row above was re-opened in the old PHP site and compared against the new implementation.

- **59 stale rows corrected** (	odo -> done): the work was complete but the matrix was never
  updated after Phase 0/3. Mostly byte-identical asset copies (public/assets/css/**,
  public/assets/images/**, favicons), the two ported client scripts
  (code-highlight.js -> components/CodeHighlight.tsx, md-editor.js ->
  components/instructor/MarkdownEditor.tsx), the three throttle/lock files
  (.cleanup_last_run, .purge_last_run, .token_cleanup_last_run -> cron_state table),
  both .htaccess files (-> 
ext.config.ts + lib/security/headers.ts), and the
  serverless-adapted private files (db.php, secrets.php, pi_config.php,
  2_config.php, 	oken_cleanup.php, upload_security.php, sections.php,
  i_questions.php, 	est_token.php).
- **New-location corrections**: several rows pointed at paths that were never created
  because the code landed elsewhere (lib/db/sections.ts -> lib/db/instructor/sections.ts,
  lib/db/token-cleanup.ts -> lib/token-cleanup.ts, lib/security/upload.ts ->
  lib/storage/upload-validation.ts, lib/ai/config.ts -> lib/config.ts,
  lib/ai/test-token.ts -> lib/instructor/test-tokens.ts,
  lib/storage/b2-config.ts -> lib/storage/b2.ts, lib/db/maintenance.ts ->
  lib/maintenance.ts). The rows now point at the files that actually exist.
- **3 rows corrected to done** after full verification: private/functions/b2_storage.php
  (cURL -> @aws-sdk/client-s3), private/functions/maintenance.php,
  private/functions/markdown.php (custom regex renderer -> marked + sanitize-html,
  required by AGENTS.md section 3, same allow-list and output).
- **2 rows partial -> done**: private/functions/assignments.php and
  private/functions/quizzes.php. Both authoring sides (create/update/delete) were
  believed missing but are fully ported in lib/db/instructor/.
- **private/functions/admin.php partial -> done**: getBlockedUsers() and
  getInstructorAuditSummary() (admin.php:830 and :843) were the only two functions with
  no new counterpart. Both are now ported to lib/db/admin/users.ts.
- **public/media.php**: the row pointed at pp/api/media/[key]/route.ts, which does not
  exist. The port uses a single query-param route (pp/api/media/route.ts) because the B2
  object key is a server-stored column, never user input - there is no dynamic path segment
  to key off.
- **No feature was dropped.** Every PHP file under public/ and private/ (excluding
  PHPMailer/**, logs/**, uploads/**) now has a verified counterpart.
