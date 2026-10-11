# EDULARI: COMPLETE PHP PAGE INVENTORY (source: htdocs (7).zip)

Purpose: the master checklist of EVERY page, endpoint, include and special file in the old PHP site, so nothing is missed in the Next.js rebuild. The old site root is `C:\Users\piyus\Desktop\htdocs (7)\htdocs`. All paths below are relative to its `public\` folder unless they start with `private\`.

Totals found: 103 PHP files under `public\` (19 admin, 11 instructor, 14 student, 12 instructor-register wizard files, the rest public, auth, endpoints and includes) and 36 PHP files under `private\` (excluding PHPMailer).

URL rules from the `.htaccess` files (all must exist in the new site):
- Every `*.php` is served without the extension: `/login` = `login.php`. A request that includes `.php` is 301-redirected to the clean URL.
- `/course/{slug}` = `course.php?slug={slug}` (slug: lowercase letters, digits, hyphens).
- `/category/{slug}` = `browse-courses.php?category={slug}`.
- `/sitemap.xml` = `sitemap.php`.
- `/index` and `/index.php` 301 to `/`. A query string of exactly `?i=1` is stripped with a 301. `/public/...` 301 to `/...`. HTTP 301 to HTTPS.
- Directories map to their `index.php` (for example `/instructor-register` and `/test`).
- `private\` is not web-accessible.

Legend for "Access": G = guest or anyone, L = must be logged in, S = student, I = approved instructor, A = admin. "Kind": PAGE = renders HTML, ENDPOINT = JSON/redirect/file only, INCLUDE = shared piece with no URL of its own.

---

## 1. PUBLIC PAGES (anyone)

| # | Old file | URL | Kind | Access | What it does / inline actions to port | Suggested Next.js route |
|---|---|---|---|---|---|---|
| 1 | index.php | / | PAGE | G | Home page. Has an inline POST action `toggle_wishlist` (JSON). Hero, featured courses, categories, animations. | app/(public)/page.tsx + api route for toggle_wishlist |
| 2 | page/about.php | /page/about | PAGE | G | About Us | app/(public)/page/about/page.tsx |
| 3 | browse-courses.php | /browse-courses and /category/{slug} | PAGE | G | Search, filter (category, price, level, rating), sort, pagination, cart and wishlist buttons (POST) | app/(public)/browse-courses/page.tsx and category/[slug]/page.tsx |
| 4 | categories.php | /categories | PAGE | G | Category grid, sort options (name, courses, students; asc and desc), load-more | app/(public)/categories/page.tsx |
| 5 | course.php | /course/{slug} | PAGE | G | Course detail: curriculum, free preview lessons, reviews, instructor box, enroll, add to cart, wishlist, review submit (POST) | app/(public)/course/[slug]/page.tsx |
| 6 | instructor-profile.php | /instructor-profile?id={id} | PAGE | G | Public instructor profile; has a POST (instructor rating); "Instructor Not Found" state | app/(public)/instructor-profile/page.tsx |
| 7 | contact.php | /contact | PAGE | G | Contact form, creates a ticket (ticket_ref CT-xxxx), acknowledgment email | app/(public)/contact/page.tsx |
| 8 | track-contact.php | /track-contact | PAGE | G | Track a ticket by reference and email (POST) | app/(public)/track-contact/page.tsx |
| 9 | help-center.php | /help-center | PAGE | G | Help center and FAQ | app/(public)/help-center/page.tsx |
| 10 | report-bug.php | /report-bug | PAGE | G | Bug report form with attachment (POST), reference number, email | app/(public)/report-bug/page.tsx |
| 11 | track-report.php | /track-report | PAGE | G | Track a bug report by reference | app/(public)/track-report/page.tsx |
| 12 | verify-certificate.php | /verify-certificate | PAGE | G | Verify a certificate by ID | app/(public)/verify-certificate/page.tsx |
| 13 | course-ai-shared.php | /course-ai-shared?s={slug} (check exact query param in file) | PAGE | G | Public read-only shared AI chat | app/(public)/course-ai-shared/page.tsx |
| 14 | updates.php | /updates (and /updates?id={id}) | PAGE | L | Notifications center. Inline POST actions: `mark_read`, `mark_all_read`, `delete`. Category tabs (all, unread, account, courses, updates). | app/(public)/updates/page.tsx |
| 15 | security.php | /security | PAGE | L | Security and password page. Inline POST actions: `change_password`, `logout_other_sessions`, `logout_one_session`. Active sessions list. | app/(public)/security/page.tsx |
| 16 | demo.php | /demo | PAGE | G | NOT a real page: it only prints "FTP deploy test successful" with the date. Do NOT port it. Make /demo return 404. | none (document in matrix as intentionally dropped) |
| 17 | partials/maintenance-page.php | shown when maintenance mode is on | INCLUDE+PAGE | G | Maintenance page (HTTP 503) | proxy + app/maintenance/page.tsx |

## 2. AUTH PAGES AND FLOWS

| # | Old file | URL | Kind | Access | Details | Next.js |
|---|---|---|---|---|---|---|
| 18 | login.php | /login | PAGE | G | Login, 2 POST handlers (password login and a second action; read file), lockout, OAuth buttons | app/(auth)/login |
| 19 | register.php | /register | PAGE | G | Register, verification email | app/(auth)/register |
| 20 | register-success.php | /register-success | PAGE | G | "Email Verified" success page (has POST) | app/(auth)/register-success |
| 21 | account-activation.php | /account-activation | PAGE+ENDPOINT | G | "Activate Your Account": inline JSON actions `check_status` (polling) and `resend_verification` | app/(auth)/account-activation + api |
| 22 | verify-email.php | /verify-email?token= | PAGE | G | Email verification link target | app/(auth)/verify-email |
| 23 | forgot-password.php | /forgot-password | PAGE | G | Request reset link | app/(auth)/forgot-password |
| 24 | reset-password.php | /reset-password?token= | PAGE | G | Set new password | app/(auth)/reset-password |
| 25 | password-reset-after-verify.php | /password-reset-after-verify | PAGE | L | Actions `change_password`, `skip_password_reset` | app/(auth)/password-reset-after-verify |
| 26 | logout.php | /logout | ENDPOINT | L | POST logout, then redirect | app/(auth)/logout route handler |
| 27 | auth/google/callback.php | /auth/google/callback | ENDPOINT | G | Google OAuth callback (also the start of the flow, check file) | app/auth/google/callback/route.ts |
| 28 | auth/github/callback.php | /auth/github/callback | ENDPOINT | G | GitHub OAuth callback | app/auth/github/callback/route.ts |

## 3. STUDENT AREA (role: student) under /student/

| # | Old file | URL | Kind | Details / inline actions | Next.js |
|---|---|---|---|---|---|
| 29 | student/onboarding.php | /student/onboarding | PAGE | Complete your profile (POST); forced redirect when profile_completed is false | app/(student)/student/onboarding |
| 30 | student/dashboard.php | /student/dashboard | PAGE | "My Dashboard" | .../dashboard |
| 31 | student/my-courses.php | /student/my-courses | PAGE | Enrolled courses with progress | .../my-courses |
| 32 | student/learn.php | /student/learn?c=&s=&d=&b= (params are short: check file; `b`, `d`, `s` found) | PAGE | Learning interface for all lesson types (video, text, pdf, quiz, assignment), POST for progress, quiz, assignment submit | .../learn |
| 33 | student/profile.php | /student/profile | PAGE | Actions `save_profile`, `upload_avatar`, `remove_avatar` | .../profile |
| 34 | student/grades.php | /student/grades | PAGE | Grades | .../grades |
| 35 | student/certificates.php | /student/certificates | PAGE | My certificates | .../certificates |
| 36 | student/generate-certificate.php | /student/generate-certificate | PAGE | The certificate itself (1056x748 canvas, scale-to-fit, print) | .../generate-certificate |
| 37 | student/schedule.php | /student/schedule | PAGE | Study planner UI | .../schedule |
| 38 | student/schedule-api.php | /student/schedule-api | ENDPOINT | Actions `get_lessons`, `add_plan`, `update_plan`, `delete_plan`, `toggle_done` | api/student/schedule |
| 39 | student/purchase-history.php | /student/purchase-history | PAGE (+json) | Purchases including failed and cancelled | .../purchase-history |
| 40 | student/receipt.php | /student/receipt | PAGE | Payment receipt | .../receipt |
| 41 | student/check-payment-status.php | /student/check-payment-status | ENDPOINT | JSON polling of payment status | api/student/check-payment-status |
| 42 | student/course_ai_chat_api.php | /student/course_ai_chat_api | ENDPOINT | Actions `send`, `retry`, `edit_message`, `feedback`, `switch_version`, `get_messages`, `share`, `get_share` | api/student/course-ai-chat |
| 43 | cart.php | /cart | PAGE | Cart (POST remove, move to wishlist, etc.) | app/(student)/cart |
| 44 | wishlist.php | /wishlist | PAGE | Wishlist (POST) | app/(student)/wishlist |
| 45 | checkout.php | /checkout | PAGE (+4 json branches) | Checkout, creates the Razorpay flow in the browser | app/(student)/checkout |
| 46 | create-order.php | /create-order | ENDPOINT | Creates the Razorpay order | api/payments/create-order |
| 47 | verify-payment.php | /verify-payment | ENDPOINT | Verifies the payment signature, enrolls | api/payments/verify |
| 48 | razorpay-webhook.php | /razorpay-webhook | ENDPOINT | Razorpay webhook (raw body, signature) | api/payments/webhook |
| 49 | mark-order-status.php | /mark-order-status | ENDPOINT | Marks order cancelled or failed | api/payments/mark-status |

## 4. INSTRUCTOR REGISTRATION WIZARD (role: logged-in user applying) under /instructor-register/

| # | Old file | URL | Kind | Details | Next.js |
|---|---|---|---|---|---|
| 50 | instructor-register/_init.php | none | INCLUDE | Shared init, guards and step enforcement | shared lib |
| 51 | instructor-register/_layout_top.php | none | INCLUDE | Wizard layout top (html head, progress bar) | route-group layout |
| 52 | instructor-register/_layout_bottom.php | none | INCLUDE | Wizard layout bottom | route-group layout |
| 53 | instructor-register/index.php | /instructor-register | PAGE | Entry; redirects to the current step | app/(instructor-register)/instructor-register |
| 54 | instructor-register/step-1.php | /instructor-register/step-1 | PAGE | Actions: save, `cancel_resume` | step-1 |
| 55 | step-2.php | .../step-2 | PAGE | Actions: save, `back` | step-2 |
| 56 | step-3.php | .../step-3 | PAGE | Actions: save, `back` | step-3 |
| 57 | step-4.php | .../step-4 | PAGE | Actions: save, `back` | step-4 |
| 58 | step-5.php | .../step-5 | PAGE | Actions: save, `back` | step-5 |
| 59 | step-6.php | .../step-6 | PAGE | Actions: save, `continue` | step-6 |
| 60 | step-7.php | .../step-7 | PAGE | Documents upload, action | step-7 |
| 61 | step-8.php | .../step-8 | PAGE | Actions `start_test`, `back`; creates the test token | step-8 |
| 62 | instructor-register-success.php | /instructor-register-success | PAGE | "Application Submitted" | app/(instructor-register)/instructor-register-success |
| 63 | test/index.php | /test?token= | PAGE+ENDPOINT | The competency test; handles JSON autosave and submit; contexts `instructor_registration` and `student_quiz` (on_pass_action) | app/test |

## 5. INSTRUCTOR PANEL (role: instructor, approved) under /instructor/

| # | Old file | URL | Kind | Inline actions | Next.js |
|---|---|---|---|---|---|
| 64 | instructor/dashboard.php | /instructor/dashboard | PAGE | | .../dashboard |
| 65 | instructor/courses.php | /instructor/courses | PAGE | `publish`, `unpublish`, `delete` | .../courses |
| 66 | instructor/create-course.php | /instructor/create-course | PAGE | POST | .../create-course |
| 67 | instructor/edit-course.php | /instructor/edit-course?id= | PAGE | POST, `remove_thumbnail` | .../edit-course |
| 68 | instructor/course-content.php | /instructor/course-content?id= | PAGE | Many POST actions: sections, lessons (5 types), quiz builder, assignment builder, reorder, delete (read file for the full list) | .../course-content |
| 69 | instructor/course-analytics.php | /instructor/course-analytics | PAGE | | .../course-analytics |
| 70 | instructor/analytics.php | /instructor/analytics | PAGE | | .../analytics |
| 71 | instructor/students.php | /instructor/students | PAGE | | .../students |
| 72 | instructor/reviews.php | /instructor/reviews | PAGE | | .../reviews |
| 73 | instructor/earnings.php | /instructor/earnings | PAGE | | .../earnings |
| 74 | instructor/profile.php | /instructor/profile | PAGE | `save_personal`, `save_education`, `save_teaching`, `upload_avatar`, `remove_avatar` | .../profile |

## 6. ADMIN PANEL (role: admin) under /admin/

| # | Old file | URL | Kind | Inline actions | Next.js |
|---|---|---|---|---|---|
| 75 | admin/dashboard.php | /admin/dashboard | PAGE | POST | .../dashboard |
| 76 | admin/users.php | /admin/users | PAGE | delete, search, filters | .../users |
| 77 | admin/user-detail.php | /admin/user-detail?id= | PAGE (+json) | `block_user`, `unblock_user`, `change_role`, `delete_user`, `reset_password`, `toggle_status` | .../user-detail |
| 78 | admin/instructor-applications.php | /admin/instructor-applications | PAGE | `approve`, `reject`, `bulk_approve`, `bulk_reject` | .../instructor-applications |
| 79 | admin/instructor-application-detail.php | /admin/instructor-application-detail?id= | PAGE | `approve`, `reject` | .../instructor-application-detail |
| 80 | admin/serve-doc.php | /admin/serve-doc | ENDPOINT | Streams a private ID or marksheet document to admin | api/admin/serve-doc |
| 81 | admin/courses.php | /admin/courses | PAGE | delete, publish and feature toggles | .../courses |
| 82 | admin/create-course.php | /admin/create-course | PAGE | POST | .../create-course |
| 83 | admin/edit-course.php | /admin/edit-course?id= | PAGE | POST | .../edit-course |
| 84 | admin/categories.php | /admin/categories | PAGE | `create`, `update`, `delete`, `bulk_delete` | .../categories |
| 85 | admin/enrollments.php | /admin/enrollments | PAGE (+json) | POST | .../enrollments |
| 86 | admin/reviews.php | /admin/reviews | PAGE (+json) | moderation | .../reviews |
| 87 | admin/banners.php | /admin/banners | PAGE (+json) | `create_banner`, `update_banner`, `delete_banner`, `toggle_banner_active`, `preview_banner` | .../banners |
| 88 | admin/send-notifications.php | /admin/send-notifications | PAGE | POST; audiences all, students, instructors, specific user; types | .../send-notifications |
| 89 | admin/settings.php | /admin/settings | PAGE (+json) | `update_general`, `update_smtp`, `update_security`, `update_api`, `test_smtp`, `toggle_maintenance`, `clear_cache`, `db_health`, `system_info`, `change_password` | .../settings |
| 90 | admin/bug-reports.php | /admin/bug-reports | PAGE | filter by type, status, severity | .../bug-reports |
| 91 | admin/bug-report-detail.php | /admin/bug-report-detail?id= | PAGE | status workflow, admin notes (POST) | .../bug-report-detail |
| 92 | admin/contact-submissions.php | /admin/contact-submissions | PAGE | list, filters | .../contact-submissions |
| 93 | admin/contact-submission-detail.php | /admin/contact-submission-detail?id= | PAGE | `change_status`, `reply` (public or internal, emails the sender), `delete` | .../contact-submission-detail |

## 7. SHARED ENDPOINTS AND SPECIAL ROUTES

| # | Old file | URL | Details | Next.js |
|---|---|---|---|---|
| 94 | media.php | /media?type=avatar or lesson_pdf&... | Proxies Backblaze B2 files with authorization and cache headers | app/api/media |
| 95 | ajax-image-upload.php | /ajax-image-upload | Image upload endpoint for the markdown editor | app/api/upload/image (+ rewrite for the old URL) |
| 96 | sitemap.php | /sitemap.xml | Dynamic sitemap | app/sitemap.ts |
| 97 | footer.php | none | INCLUDE: footer with link sets per role (see section 9) | components/Footer |
| 98 | navbar.php | none | INCLUDE: navbar per role (see section 9) | components/Navbar |
| 99 | partials/head.php | none | INCLUDE: head, meta, fonts, CSS, JSON-LD | app/layout.tsx |
| 100 | partials/site-banners.php + private\banner-templates\ (simple-text, icon-message, seasonal-promo) | none | Banner rendering | components/SiteBanners |
| 101 | partials/admin-maintenance-banner.php | none | Banner shown to admins while maintenance mode is on | components |
| 102 | partials/video_player.php | none | Custom video player markup | components/VideoPlayer |
| 103 | partials/file_viewer.php | none | Viewer for pdf, images, docx, pptx, xls(x), csv, txt, zip, audio and video files | components/FileViewer |

## 8. STATIC FILES AND SPECIAL FILES (must exist in the new site's public\ folder or as routes)

- `robots.txt`, `llms.txt`, `google85c125c508318c1a.html` (Google Search Console verification, must stay at the root URL).
- `assets/images/`: edulari-logo.png, edulari-stamp.png, verified-badge.png, verified-badge-footer.png, ceo_signature.svg, and `favicon/` (android-chrome-192x192.png, android-chrome-512x512.png, apple-touch-icon.png, favicon-16x16.png, favicon-32x32.png, favicon.ico, site.webmanifest). Keep the same URLs.
- `assets/js/`: auth.js, code-highlight.js, course-ai.js, md-editor.js, video-player.js (all must be ported to client code with the same behavior).
- `assets/css/`: 72 stylesheets (base.css, navbar.css, markdown-styles.css, md-editor.css, video-player.css, course-ai.css, home.css and every page and area stylesheet under admin\, auth\, instructor\, student\).
- `uploads/courses/` (old local course thumbnails; in the new site they live in Backblaze B2).
- `private\uploads\instructor_docs\` (old local storage of ID documents; in the new site they live in the private B2 bucket).

## 9. NAVIGATION LINK TARGETS (every link below must open a working page; a missing target means a missing page)

NAVBAR, guest: /browse-courses, /categories, "How It Works" (# placeholder), /verify-certificate, /instructor-register, Contact menu (/contact, /track-contact), Support menu (/help-center, /report-bug, /track-report), /login, /register, /cart and /wishlist (redirect to /login for guests).
NAVBAR, student: Explore menu (/browse-courses, /categories, /verify-certificate), /student/dashboard, /student/my-courses, /student/certificates, /student/schedule, /student/grades, "Assignments" (# placeholder), Contact menu, Support menu, /cart, /wishlist, /student/purchase-history, /student/profile, /security, notifications (/updates and /updates?id=).
NAVBAR, instructor: /instructor/dashboard, My Courses menu (/instructor/courses, /instructor/create-course, /instructor/course-analytics), /instructor/students, /instructor/analytics, /instructor/earnings, /instructor/reviews, "Messages" (# placeholder), Contact menu, Support menu, /instructor/profile, /instructor-profile?id={own id}, /security.
NAVBAR, admin: /admin/dashboard, /admin/users, Courses menu (/admin/courses, /admin/create-course), /admin/instructor-applications, /admin/enrollments, /admin/categories, /admin/reviews, /admin/bug-reports, /admin/contact-submissions, /admin/settings, /admin/banners, Support menu, /security.
FOOTER: /browse-courses, /browse-courses?sort=rating, /browse-courses?price=free, /page/about, /verify-certificate, /instructor-register, /instructor/dashboard, /instructor/create-course, /instructor/analytics, /register, /login, /help-center, /student/dashboard, /student/my-courses, /student/certificates, /student/profile, /student/grades, /instructor/courses, /instructor/students, /instructor/earnings, /admin/dashboard, /admin/users, /admin/courses, /admin/settings, /admin/instructor-applications, /admin/bug-reports, /contact, /report-bug, /track-report.
The "#" placeholders (How It Works, Assignments, Messages) are placeholders in the PHP site too; keep them as they are.

## 10. PRIVATE LIBRARIES (not pages, but every function must exist in the new lib\)

private\bootstrap.php, config.php, secrets.php, db.php, auth.php, oauth.php, password_reset.php, config\b2_config.php, api\api_config.php, api\test_token.php, api\ai_questions.php, email\email_senders.php, email\email_templates.php, email\mailer.php, banner-templates\*.php, data\banners.json, and functions\: admin, analytics, assignments, b2_storage, banners, certificates, courses, instructor_registration, lessons, maintenance, markdown, media_urls, notifications, payment_reconciliation, quizzes, sections, student, token_cleanup, upload_security. Marker files `.cleanup_last_run`, `.purge_last_run`, `.token_cleanup_last_run` (periodic jobs; in the new site they are cron routes and a cron_state table).

## 11. DATABASE-DRIVEN FEATURES THAT HAVE NO PAGE OF THEIR OWN BUT MUST EXIST

Notifications dropdown (list, mark read, mark all read, delete), recovery mode, session kicking, rate limiting and lockouts, scheduled deletion of instructor documents, abandoned order reconciliation, token cleanup, certificate issuance, auto-enrollment after payment, email sending (all templates in email_templates.php).
