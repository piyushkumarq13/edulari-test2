# EDULARI Pages Parity Analysis

## Objective

Identify every missing or incomplete page, endpoint, form handler, and feature by comparing the old PHP site with the new Next.js implementation.

## Approach

1. **Read PHP source files** - Analyze each PHP file completely (logic + HTML)
2. **Compare with Next.js implementation** - Check if all functionality exists
3. **Document gaps** - Create comprehensive list of what's missing/incomplete
4. **Build missing parts** - Implement everything that's missing
5. **Verify parity** - Ensure complete feature match

## Key Files to Analyze

### Public Pages
- `htdocs/index.php` - Homepage with wishlist toggle AJAX
- `htdocs/browse-courses.php` - Search/filter/sort/pagination
- `htdocs/categories.php` - Category grid with load-more
- `htdocs/course.php` - Course detail with reviews, curriculum
- `htdocs/instructor-profile.php` - Public instructor profile
- `htdocs/contact.php`, `track-contact.php` - Contact forms
- `htdocs/help-center.php` - FAQ/help pages
- `htdocs/report-bug.php`, `track-report.php` - Bug reporting
- `htdocs/verify-certificate.php` - Certificate verification
- `htdocs/course-ai-shared.php` - Shared AI chat
- `htdocs/updates.php` - Notifications center (login required)
- `htdocs/security.php` - Security/password management (login required)

### Auth Pages
- `htdocs/login.php` - Login with CSRF, rate limiting, OAuth
- `htdocs/register.php` - Registration with email verification
- `htdocs/register-success.php` - Success page with POST handlers
- `htdocs/account-activation.php` - Polling status check + resend
- `htdocs/verify-email.php` - Email verification link target
- `htdocs/forgot-password.php` - Password reset request
- `htdocs/reset-password.php` - Set new password
- `htdocs/password-reset-after-verify.php` - Post-login reset flow
- `htdocs/logout.php` - Session termination

### Student Area
- `htdocs/student/onboarding.php` - Profile completion wizard
- `htdocs/student/dashboard.php` - Student dashboard
- `htdocs/student/my-courses.php` - Enrolled courses
- `htdocs/student/learn.php` - Learning interface (video, text, pdf, quiz, assignment)
- `htdocs/student/profile.php` - Profile with avatar upload
- `htdocs/student/grades.php` - Grade display
- `htdocs/student/certificates.php` - My certificates
- `htdocs/student/generate-certificate.php` - Certificate canvas generation
- `htdocs/student/schedule.php` - Study planner UI
- `htdocs/student/schedule-api.php` - Schedule API endpoints
- `htdocs/student/purchase-history.php` - Purchase history with payment statuses
- `htdocs/student/receipt.php` - Payment receipt
- `htdocs/student/check-payment-status.php` - Payment polling API
- `htdocs/student/course_ai_chat_api.php` - Course AI chat API

### Cart & Checkout
- `htdocs/cart.php` - Shopping cart with remove/move-to-wishlist
- `htdocs/wishlist.php` - Wishlist management
- `htdocs/checkout.php` - Checkout flow setup
- `htdocs/create-order.php` - Razorpay order creation API
- `htdocs/verify-payment.php` - Payment verification and enrollment
- `htdocs/razorpay-webhook.php` - Razorpay webhook handler
- `htdocs/mark-order-status.php` - Cancelled/failed payment updates

### Instructor Registration Wizard
- `htdocs/instructor-register/_init.php` - Shared init logic
- `htdocs/instructor-register/step-[1-8].php` - 8-step wizard
- `htdocs/instructor-register-success.php` - Application submitted page
- `htdocs/test/index.php` - Competency test interface

### Instructor Panel
- `htdocs/instructor/dashboard.php` - Instructor dashboard
- `htdocs/instructor/courses.php` - Course management
- `htdocs/instructor/create-course.php` - Create course
- `htdocs/instructor/edit-course.php` - Edit course
- `htdocs/instructor/course-content.php` - Content editor (sections, lessons, quizzes, assignments)
- `htdocs/instructor/course-analytics.php` - Course analytics
- `htdocs/instructor/analytics.php` - Overall analytics
- `htdocs/instructor/students.php` - Student enrollments
- `htdocs/instructor/reviews.php` - Course reviews
- `htdocs/instructor/earnings.php` - Earnings view
- `htdocs/instructor/profile.php` - Instructor profile with avatar

### Admin Panel
- `htdocs/admin/dashboard.php` - Platform stats
- `htdocs/admin/users.php` - User management
- `htdocs/admin/user-detail.php` - User details with actions
- `htdocs/admin/instructor-applications.php` - Pending applications
- `htdocs/admin/instructor-application-detail.php` - Approve/reject
- `htdocs/admin/serve-doc.php` - Private doc serving API
- `htdocs/admin/courses.php` - Course management
- `htdocs/admin/create-course.php` - Create course
- `htdocs/admin/edit-course.php` - Edit course
- `htdocs/admin/categories.php` - Category CRUD
- `htdocs/admin/enrollments.php` - Enrollment management
- `htdocs/admin/reviews.php` - Review moderation
- `htdocs/admin/banners.php` - Banner management
- `htdocs/admin/send-notifications.php` - Notification broadcasting
- `htdocs/admin/settings.php` - Site settings (multi-action)
- `htdocs/admin/bug-reports.php` - Bug report list
- `htdocs/admin/bug-report-detail.php` - Bug report details
- `htdocs/admin/contact-submissions.php` - Contact submissions list
- `htdocs/admin/contact-submission-detail.php` - Contact submission details

### Shared Endpoints
- `htdocs/media.php` - Media proxy (avatar, lesson_pdf)
- `htdocs/ajax-image-upload.php` - Image upload for MD editor
- `public/sitemap.php` - Dynamic sitemap generation

### Special Routes
- `.htaccess` redirects (legacy .php URLs → clean URLs)
- Maintenance mode page

### Includes/Components
- `partials/head.php` - Page head, fonts, CSS, meta tags
- `partials/navbar.php` - Role-aware navigation
- `partials/footer.php` - Footer with role-based links
- `partials/site-banners.php` - Banners rendering
- `partials/admin-maintenance-banner.php` - Admin banner in maintenance mode
- `partials/video_player.php` - Video player markup
- `partials/file_viewer.php` - File viewer markup

## Analysis Method

For each PHP file:

1. **Read the PHP logic first** - Understand what data is fetched, what mutations happen, what validations are performed
2. **Trace database access** - Note all tables/columns used
3. **Identify inline actions** - POST handlers, AJAX endpoints, JSON responses
4. **Map to Next.js equivalent** - Find corresponding route(s), components, API handlers
5. **Compare implementations** - Check:
   - All form fields present with same validation
   - All POST actions/handlers exist
   - All error messages match
   - Same security checks (CSRF, rate limits, role checks)
   - Same redirect behavior (PRG pattern)
   - Same success/error states
   - Database queries produce same results
6. **Record findings** - Document as Complete, Incomplete, or Missing

## Known Gaps from PROGRESS.md

From reading PROGRESS.md, these areas need attention:

1. **Stage 3 fixes mentioned**: Various runtime bugs found after initial build
2. **Navbar dropdown issues** - Fixed in Stage 4
3. **Terminal error spam** - Filtered by NODE_ENV in Stage 8
4. **Login/Register/SMTP issues** - Improved logging added but may have runtime problems

## Next Steps

This analysis document will be populated as we systematically review each PHP file against its Next.js counterpart. Priority areas:

1. Critical user flows (login, register, checkout, payment verification)
2. Complex interactive pages (course content editor, learning interface)
3. Multi-action admin pages (settings with 10+ actions)
4. API endpoints (especially payment webhooks)
5. Shared components (navbar, footer, video player, file viewer)
