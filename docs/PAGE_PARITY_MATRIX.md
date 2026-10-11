# EDULARI: PAGE PARITY MATRIX

This document maps every PHP file from the old site to the new Next.js implementation, tracking status for completeness.

**Legend:**
- **Complete**: Full parity achieved
- **Incomplete**: Exists but missing some features/handlers/edge cases  
- **Missing**: No route exists
- **Intentionally Dropped**: Not a real page (e.g., demo.php)

---

## SUMMARY TABLES

### Public Pages
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |
| Intentionally Dropped | 1 | demo.php |

### Auth Pages & Flows
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Student Area
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Instructor Registration Wizard
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Instructor Panel
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Admin Panel
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Shared Endpoints & Special Routes
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

### Static Files & Includes
| Status | Count | Details |
|--------|-------|---------|
| Complete | 0 | - |
| Incomplete | 0 | - |
| Missing | 0 | - |

---

## 1. PUBLIC PAGES

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 1 | index.php | / | app/(site)/page.tsx | TODO | - |
| 2 | page/about.php | /page/about | app/(site)/about/page.tsx | TODO | - |
| 3 | browse-courses.php | /browse-courses | app/(site)/browse-courses/page.tsx | TODO | - |
| 4 | browse-courses.php | /category/{slug} | app/(site)/category/[slug]/page.tsx | TODO | - |
| 5 | categories.php | /categories | app/(site)/categories/page.tsx | TODO | - |
| 6 | course.php | /course/{slug} | app/(site)/course/[slug]/page.tsx | TODO | - |
| 7 | instructor-profile.php | /instructor-profile?id={id} | app/(site)/instructor-profile/[slug]/page.tsx | TODO | - |
| 8 | contact.php | /contact | app/(site)/contact/page.tsx | TODO | - |
| 9 | track-contact.php | /track-contact | app/(site)/track-contact/page.tsx | TODO | - |
| 10 | help-center.php | /help-center | app/(site)/help-center/page.tsx | TODO | - |
| 11 | report-bug.php | /report-bug | app/(site)/report-bug/page.tsx | TODO | - |
| 12 | track-report.php | /track-report | app/(site)/track-report/page.tsx | TODO | - |
| 13 | verify-certificate.php | /verify-certificate | app/(foot)/verify-certificate/page.tsx | TODO | - |
| 14 | course-ai-shared.php | /course-ai-shared | app/(student)/course-ai-shared/page.tsx | TODO | - |
| 15 | updates.php | /updates | app/(site)/updates/page.tsx | TODO | - |
| 16 | security.php | /security | app/(site)/security/page.tsx | TODO | - |
| 17 | demo.php | /demo | app/demo/route.ts | Intentionally Dropped | - |
| 18 | partials/maintenance-page.php | N/A | proxy.ts + maintenance page | TODO | - |

## 2. AUTH PAGES & FLOWS

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 19 | login.php | /login | app/login/page.tsx | TODO | - |
| 20 | register.php | /register | app/register/page.tsx | TODO | - |
| 21 | register-success.php | /register-success | app/register-success/page.tsx | TODO | - |
| 22 | account-activation.php | /account-activation | app/account-activation/page.tsx + API | TODO | - |
| 23 | verify-email.php | /verify-email?token= | app/verify-email/page.tsx | TODO | - |
| 24 | forgot-password.php | /forgot-password | app/forgot-password/page.tsx | TODO | - |
| 25 | reset-password.php | /reset-password?token= | app/reset-password/page.tsx | TODO | - |
| 26 | password-reset-after-verify.php | /password-reset-after-verify | app/password-reset-after-verify/page.tsx | TODO | - |
| 27 | logout.php | /logout | app/logout/route.ts | TODO | - |
| 28 | auth/google/callback.php | /auth/google/callback | app/api/auth/oauth/[provider]/callback/route.ts | TODO | - |
| 29 | auth/github/callback.php | /auth/github/callback | app/api/auth/oauth/[provider]/callback/route.ts | TODO | - |

## 3. STUDENT AREA

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 30 | student/onboarding.php | /student/onboarding | app/(student)/student/onboarding/page.tsx | TODO | - |
| 31 | student/dashboard.php | /student/dashboard | app/(site)/student/dashboard/page.tsx | TODO | - |
| 32 | student/my-courses.php | /student/my-courses | app/(site)/student/my-courses/page.tsx | TODO | - |
| 33 | student/learn.php | /student/learn | app/(student)/student/learn/page.tsx | TODO | - |
| 34 | student/profile.php | /student/profile | app/(site)/student/profile/page.tsx | TODO | - |
| 35 | student/grades.php | /student/grades | app/(site)/student/grades/page.tsx | TODO | - |
| 36 | student/certificates.php | /student/certificates | app/(site)/student/certificates/page.tsx | TODO | - |
| 37 | student/generate-certificate.php | /student/generate-certificate | app/(student)/student/generate-certificate/page.tsx | TODO | - |
| 38 | student/schedule.php | /student/schedule | app/(site)/student/schedule/page.tsx | TODO | - |
| 39 | student/schedule-api.php | /student/schedule-api | app/(student)/student/schedule-api/route.ts | TODO | - |
| 40 | student/purchase-history.php | /student/purchase-history | app/(site)/student/purchase-history/page.tsx | TODO | - |
| 41 | student/receipt.php | /student/receipt | app/student/receipt/page.tsx | TODO | - |
| 42 | student/check-payment-status.php | /student/check-payment-status | app/api/student/check-payment-status/route.ts | TODO | - |
| 43 | student/course_ai_chat_api.php | /student/course_ai_chat_api | app/api/student/course-ai/route.ts | TODO | - |
| 44 | cart.php | /cart | app/(site)/cart/page.tsx | TODO | - |
| 45 | wishlist.php | /wishlist | app/(site)/wishlist/page.tsx | TODO | - |
| 46 | checkout.php | /checkout | app/(site)/checkout/page.tsx | TODO | - |
| 47 | create-order.php | /create-order | app/api/razorpay/create-order/route.ts | TODO | - |
| 48 | verify-payment.php | /verify-payment | app/api/razorpay/verify-payment/route.ts | TODO | - |
| 49 | razorpay-webhook.php | /razorpay-webhook | app/api/razorpay/webhook/route.ts | TODO | - |
| 50 | mark-order-status.php | /mark-order-status | app/api/razorpay/mark-order-status/route.ts | TODO | - |

## 4. INSTRUCTOR REGISTRATION WIZARD

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 51 | instructor-register/_init.php | N/A | shared lib | TODO | - |
| 52 | instructor-register/_layout_top.php | N/A | route-group layout | TODO | - |
| 53 | instructor-register/_layout_bottom.php | N/A | route-group layout | TODO | - |
| 54 | instructor-register/index.php | /instructor-register | app/instructor-register/page.tsx | TODO | - |
| 55 | instructor-register/step-1.php | /instructor-register/step-1 | app/instructor-register/step-1/page.tsx | TODO | - |
| 56 | step-2.php | .../step-2 | app/instructor-register/step-2/page.tsx | TODO | - |
| 57 | step-3.php | .../step-3 | app/instructor-register/step-3/page.tsx | TODO | - |
| 58 | step-4.php | .../step-4 | app/instructor-register/step-4/page.tsx | TODO | - |
| 59 | step-5.php | .../step-5 | app/instructor-register/step-5/page.tsx | TODO | - |
| 60 | step-6.php | .../step-6 | app/instructor-register/step-6/page.tsx | TODO | - |
| 61 | step-7.php | .../step-7 | app/instructor-register/step-7/page.tsx | TODO | - |
| 62 | step-8.php | .../step-8 | app/instructor-register/step-8/page.tsx | TODO | - |
| 63 | instructor-register-success.php | /instructor-register-success | app/instructor-register-success/page.tsx | TODO | - |
| 64 | test/index.php | /test?token= | app/test/page.tsx | TODO | - |

## 5. INSTRUCTOR PANEL

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 65 | instructor/dashboard.php | /instructor/dashboard | app/(site)/instructor/dashboard/page.tsx | TODO | - |
| 66 | instructor/courses.php | /instructor/courses | app/(site)/instructor/courses/page.tsx | TODO | - |
| 67 | instructor/create-course.php | /instructor/create-course | app/(site)/instructor/create-course/page.tsx | TODO | - |
| 68 | instructor/edit-course.php | /instructor/edit-course?id= | app/(site)/instructor/edit-course/page.tsx | TODO | - |
| 69 | instructor/course-content.php | /instructor/course-content?id= | app/(site)/instructor/course-content/page.tsx | TODO | - |
| 70 | instructor/course-analytics.php | /instructor/course-analytics | app/(site)/instructor/course-analytics/page.tsx | TODO | - |
| 71 | instructor/analytics.php | /instructor/analytics | app/(site)/instructor/analytics/page.tsx | TODO | - |
| 72 | instructor/students.php | /instructor/students | app/(site)/instructor/students/page.tsx | TODO | - |
| 73 | instructor/reviews.php | /instructor/reviews | app/(site)/instructor/reviews/page.tsx | TODO | - |
| 74 | instructor/earnings.php | /instructor/earnings | app/(site)/instructor/earnings/page.tsx | TODO | - |
| 75 | instructor/profile.php | /instructor/profile | app/(site)/instructor/profile/page.tsx | TODO | - |

## 6. ADMIN PANEL

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 76 | admin/dashboard.php | /admin/dashboard | app/(site)/admin/dashboard/page.tsx | TODO | - |
| 77 | admin/users.php | /admin/users | app/(site)/admin/users/page.tsx | TODO | - |
| 78 | admin/user-detail.php | /admin/user-detail?id= | app/(site)/admin/user-detail/page.tsx | TODO | - |
| 79 | admin/instructor-applications.php | /admin/instructor-applications | app/(site)/admin/instructor-applications/page.tsx | TODO | - |
| 80 | admin/instructor-application-detail.php | /admin/instructor-application-detail?id= | app/(site)/admin/instructor-application-detail/page.tsx | TODO | - |
| 81 | admin/serve-doc.php | /admin/serve-doc | app/api/admin/serve-doc/route.ts | TODO | - |
| 82 | admin/courses.php | /admin/courses | app/(site)/admin/courses/page.tsx | TODO | - |
| 83 | admin/create-course.php | /admin/create-course | app/(site)/admin/create-course/page.tsx | TODO | - |
| 84 | admin/edit-course.php | /admin/edit-course?id= | app/(site)/admin/edit-course/page.tsx | TODO | - |
| 85 | admin/categories.php | /admin/categories | app/(site)/admin/categories/page.tsx | TODO | - |
| 86 | admin/enrollments.php | /admin/enrollments | app/(site)/admin/enrollments/page.tsx | TODO | - |
| 87 | admin/reviews.php | /admin/reviews | app/(site)/admin/reviews/page.tsx | TODO | - |
| 88 | admin/banners.php | /admin/banners | app/(site)/admin/banners/page.tsx | TODO | - |
| 89 | admin/send-notifications.php | /admin/send-notifications | app/(site)/admin/send-notifications/page.tsx | TODO | - |
| 90 | admin/settings.php | /admin/settings | app/(site)/admin/settings/page.tsx | TODO | - |
| 91 | admin/bug-reports.php | /admin/bug-reports | app/(site)/admin/bug-reports/page.tsx | TODO | - |
| 92 | admin/bug-report-detail.php | /admin/bug-report-detail?id= | app/(site)/admin/bug-report-detail/page.tsx | TODO | - |
| 93 | admin/contact-submissions.php | /admin/contact-submissions | app/(site)/admin/contact-submissions/page.tsx | TODO | - |
| 94 | admin/contact-submission-detail.php | /admin/contact-submission-detail?id= | app/(site)/admin/contact-submission-detail/page.tsx | TODO | - |

## 7. SHARED ENDPOINTS & SPECIAL ROUTES

| # | Old File | URL | New Route | Status | What's Missing/Wrong |
|---|----------|-----|-----------|--------|----------------------|
| 95 | media.php | /media | app/api/media/route.ts | TODO | - |
| 96 | ajax-image-upload.php | /ajax-image-upload | app/api/upload/image/route.ts (+ rewrite) | TODO | - |
| 97 | sitemap.php | /sitemap.xml | app/sitemap.ts | TODO | - |
| 98 | footer.php | N/A | components/Footer | TODO | - |
| 99 | navbar.php | N/A | components/SiteNavbar | TODO | - |
| 100 | partials/head.php | N/A | app/layout.tsx | TODO | - |
| 101 | partials/site-banners.php | N/A | components/SiteBanners | TODO | - |
| 102 | partials/admin-maintenance-banner.php | N/A | components/AdminMaintenanceBanner | TODO | - |
| 103 | partials/video_player.php | N/A | components/VideoPlayer | TODO | - |
| 104 | partials/file_viewer.php | N/A | components/FileViewer | TODO | - |

---

## LEGACY REDIRECTS (from .htaccess files)

All of these must exist in next.config.ts redirects():
- *.php → clean URL (301)
- /index.php → / (301)
- /[anything].php → /{anything} (301)
- /public/... → /... (301)
- /?i=1 → / (301, strip query)
- HTTP → HTTPS (301)

TODO: Verify all redirects are implemented

---

## NAVIGATION LINK AUDIT

Every link target below must work (no 404):

### Guest Navbar
- /browse-courses ✓
- /categories ✓
- /verify-certificate ✓
- /instructor-register ✓
- Contact menu: /contact, /track-contact ✓
- Support menu: /help-center, /report-bug, /track-report ✓
- /login ✓
- /register ✓
- /cart → /login (guest redirect) ✓
- /wishlist → /login (guest redirect) ✓

### Student Navbar
- Explore menu: /browse-courses, /categories, /verify-certificate ✓
- /student/dashboard ✓
- /student/my-courses ✓
- /student/certificates ✓
- /student/schedule ✓
- /student/grades ✓
- Contact menu ✓
- Support menu ✓
- /cart ✓
- /wishlist ✓
- /student/purchase-history ✓
- /student/profile ✓
- /security ✓
- /updates ✓

### Instructor Navbar
- /instructor/dashboard ✓
- My Courses menu: /instructor/courses, /instructor/create-course ✓
- /instructor/course-content?id=X ✓
- /instructor/course-analytics ✓
- /instructor/students ✓
- /instructor/analytics ✓
- /instructor/earnings ✓
- /instructor/reviews ✓
- Contact menu ✓
- Support menu ✓
- /instructor/profile ✓
- /instructor-profile?id={own id} ✓
- /security ✓

### Admin Navbar
- /admin/dashboard ✓
- /admin/users ✓
- Courses menu: /admin/courses, /admin/create-course ✓
- /admin/instructor-applications ✓
- /admin/enrollments ✓
- /admin/categories ✓
- /admin/reviews ✓
- /admin/bug-reports ✓
- /admin/contact-submissions ✓
- /admin/settings ✓
- /admin/banners ✓
- Support menu ✓
- /security ✓

### Footer Links (all role variants)
TODO: Verify all footer links resolve

---

## STATUS KEY

- **Complete**: Fully ported with all handlers, validation, security, edge cases
- **Incomplete**: Basic page exists but missing some functionality
- **Missing**: No route or component created yet
- **Intentionally Dropped**: Not needed in new site (documented)

Start filling out this matrix by reading each PHP file and verifying the corresponding Next.js implementation matches completely.
