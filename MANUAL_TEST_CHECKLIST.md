# EDULARI Manual Test Checklist

**Purpose:** Systematic testing plan for the deployed Vercel site to identify all missing/incomplete features.

**How to use:** Follow each step in order, noting any failures, errors, or missing features.

---

## TEST ENVIRONMENT

- Deployed URL: [User will provide]
- Browser: Chrome/Edge recommended (for DevTools access)
- Test accounts needed: Guest, Student, Instructor (approved), Admin

---

## SECTION 1: PUBLIC PAGES (No login required)

### 1.1 Homepage (/)
- [ ] Page loads without errors
- [ ] Hero section displays with typing animation
- [ ] Featured courses section shows 6 courses
- [ ] Categories section displays 6 categories  
- [ ] Level filter tabs work (Beginner, Intermediate, Advanced)
- [ ] Testimonials carousel rotates automatically
- [ ] "Back to top" button appears after scrolling
- [ ] Wishlist toggle button works (click heart icon)
- [ ] "Add to cart" buttons present on courses
- [ ] JSON-LD structured data present in page source

### 1.2 About Page (/page/about)
- [ ] Page loads successfully
- [ ] Content displays correctly
- [ ] No console errors

### 1.3 Browse Courses (/browse-courses)
- [ ] Page loads without 500 error
- [ ] Search bar functions
- [ ] Filter by category dropdown works
- [ ] Filter by price dropdown works  
- [ ] Filter by level dropdown works
- [ ] Sort options work (Price: Low to High, Price: High to Low, Rating, Name)
- [ ] Pagination shows multiple pages
- [ ] Results update when filters applied
- [ ] "Add to cart" buttons functional
- [ ] Wishlist toggle buttons work

### 1.4 Category Pages (/category/{slug})
- [ ] Navigate to a category page from browse/categoris
- [ ] Shows only courses in that category
- [ ] Breadcrumb navigation correct
- [ ] No 404 errors

### 1.5 Categories Page (/categories)
- [ ] Grid of all categories displays
- [ ] Show more button loads additional categories
- [ ] Sort options work (Name A-Z, Name Z-A, Courses count, Students count)
- [ ] Category links navigate correctly

### 1.6 Course Detail Page (/course/{slug})
- [ ] Course information displays correctly
- [ ] Curriculum/lessons list shows
- [ ] Free preview lessons playable (if any)
- [ ] Instructor profile box displays
- [ ] Reviews section shows reviews
- [ ] "Add to cart" button present
- [ ] Wishlist toggle works
- [ ] Review submission form works (POST action)
- [ ] Star rating selection works
- [ ] Review text input works
- [ ] Submit review creates entry

### 1.7 Instructor Profile (/instructor-profile?id={id})
- [ ] Instructor information displays
- [ ] Courses taught section shows
- [ ] Rating/stars display correctly
- [ ] "Not found" message when invalid id

### 1.8 Contact Page (/contact)
- [ ] Contact form displays
- [ ] Required fields validation works
- [ ] Form submission creates ticket
- [ ] Ticket reference number shown (CT-xxxx)
- [ ] Confirmation message appears
- [ ] Email sent (check inbox)

### 1.9 Track Contact (/track-contact)
- [ ] Form to enter ticket_ref and email
- [ ] Tracking results show ticket status
- [ ] Messages display correctly

### 1.10 Help Center (/help-center)
- [ ] FAQ content displays
- [ ] Categories/sections visible
- [ ] Search if available works

### 1.11 Report Bug (/report-bug)
- [ ] Bug report form displays
- [ ] File attachment upload works
- [ ] Validation on required fields
- [ ] Submission creates bug report
- [ ] Reference number generated
- [ ] CSRF token present in form

### 1.12 Track Bug Report (/track-report)
- [ ] Enter reference and email
- [ ] Display bug report details

### 1.13 Verify Certificate (/verify-certificate)
- [ ] Certificate ID input field
- [ ] Verify button works
- [ ] Valid certificate shows confirmation
- [ ] Invalid ID shows error message

### 1.14 Updates Page (/updates) - Login required
- [ ] Redirect to login if not logged in
- [ ] After login, see notification center
- [ ] Tabs work (All, Unread, Account, Courses, Updates)
- [ ] Mark as read button works (POST)
- [ ] Mark all read button works (POST)
- [ ] Delete notifications works (POST)
- [ ] Notifications load dynamically

### 1.15 Security Page (/security) - Login required
- [ ] Change password form works (POST)
- [ ] Logout other sessions button works (POST)
- [ ] List active sessions displays
- [ ] Logout one session button works (POST)
- [ ] Session management functional

### 1.16 Demo Page (/demo)
- [ ] Should return 404 (intentionally dropped)

---

## SECTION 2: AUTHENTICATION FLOW

### 2.1 Login (/login)
- [ ] Email/password form displays
- [ ] Validate empty fields
- [ ] Login with correct credentials works
- [ ] Wrong credentials shows error
- [ ] Rate limiting kicks in after 5 failed attempts
- [ ] Remember redirect after successful login
- [ ] OAuth Google button present
- [ ] OAuth GitHub button present
- [ ] CSRF token in form
- [ ] "Forgot password" link works

### 2.2 Register (/register)
- [ ] Registration form displays
- [ ] Password strength validation
- [ ] Email format validation
- [ ] Duplicate email rejected
- [ ] Verification email sent
- [ ] Success redirects to register-success page

### 2.3 Register Success (/register-success)
- [ ] Page loads after registration
- [ ] POST handlers functional (check file for actions)

### 2.4 Account Activation (/account-activation)
- [ ] Polling for activation status works
- [ ] Resend verification email button works (POST)
- [ ] Status messages clear

### 2.5 Verify Email (/verify-email?token={})
- [ ] Token parameter in URL
- [ ] Successful verification redirects appropriately
- [ ] Invalid token shows error

### 2.6 Forgot Password (/forgot-password)
- [ ] Email input form
- [ ] Validation works
- [ ] Email sent with reset link
- [ ] Privacy guarantee (no error if email doesn't exist)

### 2.7 Reset Password (/reset-password?token={})
- [ ] Token in URL parameter
- [ ] New password form displays
- [ ] Password validation works
- [ ] Reset succeeds, redirects to login

### 2.8 Password Reset After Verify (/password-reset-after-verify)
- [ ] Appears after email verified (logged in state)
- [ ] Change password action (POST)
- [ ] Skip password reset button works

### 2.9 Logout (/logout)
- [ ] POST request terminates session
- [ ] Redirects to homepage/login
- [ ] Session invalidated in database

### 2.10 OAuth Flows
- **Google OAuth:**
  - [ ] Click Google button → Google consent screen
  - [ ] Return to site with account created/logged in
  - [ ] State parameter used for security
  
- **GitHub OAuth:**
  - [ ] Same flow as Google

---

## SECTION 3: STUDENT AREA (Login + Student role)

### 3.1 Onboarding (/student/onboarding)
- [ ] Forces redirect if profile_completed=false
- [ ] Profile completion form (name, phone, bio?)
- [ ] Save works (POST)
- [ ] Completes onboarding flow

### 3.2 Student Dashboard (/student/dashboard)
- [ ] Stats cards show enrolled courses, progress, etc.
- [ ] Quick actions functional
- [ ] Recent activity displays
- [ ] Maintenance banner if admin

### 3.3 My Courses (/student/my-courses)
- [ ] List of enrolled courses
- [ ] Progress bars visible
- [ ] Course cards clickable
- [ ] Continue learning button works

### 3.4 Learn Page (/student/learn)
- [ ] Course curriculum sidebar
- [ ] Lesson content displays
- [ ] Video player works (YouTube/Vimeo/self-hosted)
- [ ] PDF viewer functional
- [ ] Text content displays
- [ ] Quiz mode works (submit answers, score displayed)
- [ ] Assignment submission works (file upload)
- [ ] Progress tracking saves
- [ ] Navigation between lessons works
- [ ] Previous/Next lesson buttons
- [ ] Completion marks completed lessons

### 3.5 Student Profile (/student/profile)
- [ ] Edit personal info (POST)
- [ ] Upload avatar (POST - file upload to B2)
- [ ] Remove avatar button
- [ ] Save changes and redirect

### 3.6 Grades (/student/grades)
- [ ] Course grades display
- [ ] Quiz scores shown
- [ ] Assignment grades shown
- [ ] Passing/failing indicators

### 3.7 Certificates (/student/certificates)
- [ ] List of earned certificates
- [ ] View certificate links
- [ ] Download PDF option

### 3.8 Generate Certificate (/student/generate-certificate)
- [ ] Canvas element renders
- [ ] Certificate data populated (student name, course, date)
- [ ] Scale-to-fit logic correct
- [ ] Print function works
- [ ] Base64 assets embedded
- [ ] SVG arc text (if used)

### 3.9 Schedule / Study Planner (/student/schedule)
- [ ] Weekly calendar view
- [ ] Add lesson button (POST)
- [ ] Update lesson times (POST)
- [ ] Delete lesson (POST)
- [ ] Toggle done checkbox
- [ ] Saves to database
- [ ] API endpoints work independently

### 3.10 Purchase History (/student/purchase-history)
- [ ] List of all purchases
- [ ] Includes paid/enrolled, cancelled, failed statuses
- [ ] Receipt view button
- [ ] Dates and amounts shown

### 3.11 Receipt (/student/receipt)
- [ ] Payment details display
- [ ] Razorpay transaction ID shown
- [ ] Course purchased shown
- [ ] Amount paid
- [ ] Receipt download (PDF)
- [ ] Email sent if applicable

### 3.12 Check Payment Status (/student/check-payment-status)
- [ ] Polling endpoint returns current status
- [ ] Transitions through states (pending→paid/enrolled/failed)

### 3.13 Course AI Chat (/student/course_ai_chat_api)
- [ ] Send message (POST)
- [ ] Retry previous message
- [ ] Edit message and resend
- [ ] Feedback thumbs up/down
- [ ] Switch version (basic/premium)
- [ ] Get chat history
- [ ] Share chat link generation
- [ ] Get shared chat (public read-only)
- [ ] Streaming responses

---

## SECTION 4: CART & CHECKOUT

### 4.1 Cart (/cart)
- [ ] Course cards in cart
- [ ] Remove button (POST)
- [ ] Move to wishlist button (POST)
- [ ] Move all to cart from wishlist
- [ ] Proceed to checkout button
- [ ] Total price calculation
- [ ] Quantity adjustment if applicable

### 4.2 Wishlist (/wishlist)
- [ ] Wishlist courses display
- [ ] Remove individual (POST)
- [ ] Move to cart button (POST)
- [ ] Move all to cart
- [ ] Add to cart button

### 4.3 Checkout (/checkout)
- [ ] Cart summary shown
- [ ] Course details verified
- [ ] Price confirmed (server-side)
- [ ] Create Razorpay order initiates
- [ ] Razorpay popup opens
- [ ] Payment interface
- [ ] Verify payment on submit

### 4.4 Razorpay Integration
- **Create Order API:**
  - [ ] Server computes amount (not from client)
  - [ ] Order created in database
  - [ ] Returns order_id for Razorpay
  
- **Verify Payment API:**
  - [ ] Signature verification (HMAC-SHA256)
  - [ ] Idempotency check (prevent duplicate enrollments)
  - [ ] Transaction in Postgres DB
  - [ ] Enrollment created
   
- **Webhook Handler:**
  - [ ] Raw body reading (not parsed first)
  - [ ] Signature verification (X-Razorpay-Signature header)
  - [ ] Idempotent processing
  - [ ] Updates purchase_history and enrollments
  
- **Mark Order Status API:**
  - [ ] Cancelled status update
  - [ ] Failed status update
  - [ ] Only authenticated requests

---

## SECTION 5: INSTRUCTOR REGISTRATION WIZARD

### 5.1 Wizard Entry (/instructor-register)
- [ ] Redirects to current step based on application status
- [ ] Progress indicator

### 5.2 Step 1-8 (Multi-step wizard)
Each step should have:
- [ ] Form displays correctly
- [ ] Validation on save
- [ ] Back button navigates to previous step
- [ ] Continue/Save button progresses wizard
- [ ] Data persists between steps
- [ ] Error messages clear

### 5.3 Specific Steps
- **Step 1:** Basic info (personal details)
- **Step 2:** Education background
- **Step 3:** Professional experience
- **Step 4:** Teaching philosophy
- **Step 5:** Social media links
- **Step 6:** Portfolio/projects
- **Step 7:** Documents (PAN, bank, ID proof upload)
- **Step 8:** Start competency test

### 5.4 Competency Test (/test?token={})
- [ ] Token authentication
- [ ] Questions display
- [ ] Multiple choice selection
- [ ] Autosave during test
- [ ] Submit test functionality
- [ ] Violation tracking
- [ ] Results stored in database
- [ ] "Attempt started at" timestamp

### 5.5 Registration Success (/instructor-register-success)
- [ ] Application submitted message
- [ ] Next steps explained
- [ ] Wait for approval notification

---

## SECTION 6: INSTRUCTOR PANEL (Approved Instructors)

### 6.1 Instructor Dashboard (/instructor/dashboard)
- [ ] Platform stats (courses, students, earnings)
- [ ] Quick actions visible
- [ ] Recent activity
- [ ] Pending applications badge (shouldn't see this)

### 6.2 Courses (/instructor/courses)
- [ ] List of instructor's courses
- [ ] Publish/unpublish toggle (POST)
- [ ] Delete course button (POST)
- [ ] Create new course button
- [ ] Course stats per row

### 6.3 Create Course (/instructor/create-course)
- [ ] Course title, description
- [ ] Category selection
- [ ] Price setting
- [ ] Free/paid toggle
- [ ] Thumbnail upload
- [ ] Create form submission
- [ ] Success redirect to course-content

### 6.4 Edit Course (/instructor/edit-course)
- [ ] Pre-populated fields
- [ ] Update functionality
- [ ] Thumbnail manage/upload
- [ ] Remove thumbnail option
- [ ] Success/error messages

### 6.5 Course Content (/instructor/course-content)
- **Sections:**
  - [ ] Add section (POST)
  - [ ] Edit section title
  - [ ] Reorder sections (drag/drop + API)
  - [ ] Delete section (with lessons)
  
- **Lessons (5 types):**
  - [ ] Text lesson creator (title, content markdown editor)
  - [ ] Video lesson (YouTube embed, Vimeo, self-hosted URL)
  - [ ] PDF lesson (file upload to B2)
  - [ ] Quiz assignment
  - [ ] Assignment task
  
- **Quiz Builder:**
  - [ ] Add quiz questions
  - [ ] Multiple choice options
  - [ ] Set correct answer
  - [ ] Points/marks allocation
  
- **Assignment Builder:**
  - [ ] Create assignment details
  - [ ] Max marks, passing marks
  - [ ] Due days configuration
  
- **All CRUD operations:**
  - [ ] Each lesson editable
  - [ ] Lessons deletable
  - [ ] Reordering works
  - [ ] Preserves all data

### 6.6 Course Analytics (/instructor/course-analytics)
- [ ] Enrollments count
- [ ] Revenue for course
- [ ] Ratings average
- [ ] Progress statistics

### 6.7 Analytics (/instructor/analytics)
- [ ] Overall performance metrics
- [ ] Trends over time
- [ ] Charts/graphs if present

### 6.8 Students (/instructor/students)
- [ ] List of enrolled students
- [ ] Student names/emails
- [ ] Enrollment dates
- [ ] Progress overview

### 6.9 Reviews (/instructor/reviews)
- [ ] Course reviews received
- [ ] Review text and ratings
- [ ] Response option if available

### 6.10 Earnings (/instructor/earnings)
- [ ] Total earnings display
- [ ] Breakdown by course
- [ ] Payment status
- [ ] Sensitive data (bank details) encrypted in DB

### 6.11 Instructor Profile (/instructor/profile)
- [ ] Save personal info (POST)
- [ ] Save education (POST)
- [ ] Save teaching info (POST)
- [ ] Upload avatar (B2 upload)
- [ ] Remove avatar
- [ ] Success messages

---

## SECTION 7: ADMIN PANEL (Admin Role Required)

### 7.1 Admin Dashboard (/admin/dashboard)
- [ ] Platform statistics grid
- [ ] Total users, courses, enrollments, revenue
- [ ] Recent signups
- [ ] Top courses list
- [ ] Pending instructor applications count
- [ ] Quick maintenance actions (gated confirmations)

### 7.2 Users (/admin/users)
- [ ] User list with pagination
- [ ] Search by email/name
- [ ] Filter by role/status
- [ ] Delete user action
- [ ] Bulk actions

### 7.3 User Detail (/admin/user-detail?id={})
- [ ] User information displayed
- [ ] Block user (POST)
- [ ] Unblock user (POST)
- [ ] Reason/note for block
- [ ] Change role (Student ↔ Instructor ↔ Admin)
- [ ] Delete user (POST)
- [ ] Reset password (email sent)
- [ ] Toggle active status
- [ ] Session management (kick sessions)
- [ ] Audit log of changes

### 7.4 Instructor Applications (/admin/instructor-applications)
- [ ] List pending applications
- [ ] Approve all (bulk) button
- [ ] Reject all (bulk) button
- [ ] Individual approve/reject buttons
- [ ] Filter/search applications

### 7.5 Instructor Application Detail (/admin/instructor-application-detail?id={})
- [ ] Full application data displayed
- [ ] Documents preview/download
- [ ] Approve action (POST) → activates account, notifies applicant
- [ ] Reject action (POST) → reopens application, notifies applicant
- [ ] Decision notes

### 7.6 Serve Doc (/admin/serve-doc) - API
- [ ] Private document serving (instructor IDs, marksheets)
- [ ] Authorization check (admin only)
- [ ] Range headers supported
- [ ] B2 proxy with proper cache headers

### 7.7 Admin Courses (/admin/courses)
- [ ] List all courses
- [ ] Delete course (POST)
- [ ] Publish/unpublish toggle
- [ ] Feature/unfeature toggle
- [ ] Filters (status, category)

### 7.8 Admin Create Course (/admin/create-course)
- [ ] Full course creation
- [ ] Similar to instructor create but with admin overrides

### 7.9 Admin Edit Course (/admin/edit-course)
- [ ] Edit any course
- [ ] Override instructor settings
- [ ] Thumbnail management

### 7.10 Categories (/admin/categories)
- [ ] List categories with course counts
- [ ] Create category (POST)
- [ ] Edit category (POST)
- [ ] Delete category (POST)
- [ ] Bulk delete
- [ ] Slug auto-generation

### 7.11 Enrollments (/admin/enrollments)
- [ ] List all enrollments
- [ ] Filters (course, student, status)
- [ ] Verify Razorpay payment + enroll manually (POST)
- [ ] Manual enrollment (POST)
- [ ] Unenroll student (POST)
- [ ] Payment details view

### 7.12 Reviews (/admin/reviews)
- [ ] All course reviews
- [ ] Moderation actions (delete if inappropriate)
- [ ] Statistics/distribution charts
- [ ] Filters (rating, course, date)

### 7.13 Banners (/admin/banners)
- [ ] Banner list
- [ ] Create banner (POST) with template selection
- [ ] Update banner (POST)
- [ ] Delete banner (POST)
- [ ] Toggle active/inactive (POST)
- [ ] Preview banner functionality
- [ ] Template rendering (simple-text, icon-message, seasonal-promo)
- [ ] CTA pairing validation

### 7.14 Send Notifications (/admin/send-notifications)
- [ ] Compose notification message
- [ ] Audience selection (All, Students, Instructors, Specific user)
- [ ] Type selection (Account, Courses, Updates, etc.)
- [ ] Character limit enforcement
- [ ] Email toggle (send email or just in-app)
- [ ] Live preview
- [ ] Send (POST) → creates notification, sends emails
- [ ] PRG redirect with success message

### 7.15 Settings (/admin/settings)
Ten separate actions:
- [ ] Update general settings
- [ ] Update SMTP settings
- [ ] Update security settings
- [ ] Update API settings
- [ ] Test SMTP connection
- [ ] Clear cache
- [ ] Database health check
- [ ] System info
- [ ] Toggle maintenance mode
- [ ] Change admin password

Secrets from env never persisted.

### 7.16 Bug Reports (/admin/bug-reports)
- [ ] List all bug reports
- [ ] Filter by type, status, severity
- [ ] Pagination
- [ ] Link to detail page

### 7.17 Bug Report Detail (/admin/bug-report-detail?id={})
- [ ] Full bug report displayed
- [ ] Status change actions
- [ ] Severity change actions
- [ ] Admin notes textarea
- [ ] Reply/notify user (email)
- [ ] Attachment preview/download
- [ ] Log entries for changes

### 7.18 Contact Submissions (/admin/contact-submissions)
- [ ] List all contact tickets
- [ ] Filter by category, status, priority
- [ ] Stat cards
- [ ] Link to detail page

### 7.19 Contact Submission Detail (/admin/contact-submission-detail?id={})
- [ ] Ticket details
- [ ] Reply action (POST) - public or internal note
- [ ] Email sender with reply
- [ ] Quick status change buttons
- [ ] Reopen ticket (fix dead link from PHP)
- [ ] Delete ticket
- [ ] Spam/mark-as-spam actions
- [ ] Character counter for reply
- [ ] MSG_TYPE flash after actions

---

## SECTION 8: SHARED COMPONENTS

### 8.1 Navbar
- [ ] Logo displays
- [ ] Links render based on role (Guest/Student/Instructor/Admin)
- [ ] Dropdown menus functional:
  - Guest: Contact, Support
  - Student: Explore, Notifications
  - Instructor: Messages placeholder
  - Admin: Support
- [ ] Notification bell shows unread count
- [ ] User profile dropdown
- [ ] Mobile hamburger menu works
- [ ] Responsive breakpoints correct

### 8.2 Footer
- [ ] All footer links present and working:
  - Browse courses (all variants)
  - About
  - Verify certificate
  - Instructor register
  - Student dashboard links
  - Instructor links
  - Admin links
  - Contact/help links
- [ ] Copyright notice
- [ ] Social media links if any

### 8.3 Site Banners
- [ ] Banners appear on homepage
- [ ] Templates render correctly (icon glyphs, seasonal badges)
- [ ] Active banners only
- [ ] Role-based filtering (guest/student/instructor)
- [ ] CTA buttons work
- [ ] Click tracking logged

### 8.4 Video Player
- [ ] YouTube videos play
- [ ] Vimeo videos play
- [ ] Self-hosted videos play
- [ ] Controls visible (play/pause, volume, fullscreen)
- [ ] Speed options (0.5x, 1x, 1.5x, 2x)
- [ ] Error handling for broken sources

### 8.5 File Viewer
- [ ] PDF files render in-browser
- [ ] Word documents (.docx) preview
- [ ] PowerPoint (.pptx) preview
- [ ] Excel files (xlsx/xls/csv) preview
- [ ] Images display
- [ ] ZIP archives extract preview
- [ ] Audio files play
- [ ] Video files play
- [ ] Fallback note for unsupported formats

### 8.6 Admin Maintenance Banner
- [ ] Sticky banner under navbar
- [ ] Red background, white text
- [ ] Shows only to admins when maintenance mode on
- [ ] Dismissal (temporarily hidden for session)

---

## SECTION 9: API ENDPOINTS

### 9.1 Contact API (/api/contact)
- [ ] POST creates ticket_ref (CT-xxxx)
- [ ] Sends acknowledgment email
- [ ] CSRF validation

### 9.2 Contact Track API (/api/contact/track)
- [ ] GET retrieves ticket by ref + email

### 9.3 Report Bug API (/api/report-bug)
- [ ] POST creates bug report
- [ ] File attachment upload (B2)
- [ ] Reference number returned
- [ ] CSRF validation

### 9.4 Wishlist APIs
- [/api/wishlist/toggle](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\wishlist\WishlistClient.tsx#L14-L14)
  - [ ] POST toggles add/remove
  - [ ] Returns current state
  
- [/api/wishlist/action](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\wishlist\WishlistClient.tsx#L30-L30)
  - [ ] POST bulk actions (move to cart)

### 9.5 Cart APIs
- [/api/cart/add](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\CartClient.tsx#L216-L222)
  - [ ] POST adds course to cart
  - [ ] Validates student role
  
- [/api/cart/remove](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\CartClient.tsx#L224-L230)
  - [ ] POST removes item
  
- [/api/cart/checkout](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\checkout\CheckoutClient.tsx#L312-L312)
  - [ ] POST prepares checkout session
  
- [/api/cart/move-to-wishlist](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\CartClient.tsx#L232-L238)
  - [ ] POST moves item to wishlist

### 9.6 Course Review API (/api/course/review)
- [ ] POST creates/updates review
- [ ] ON CONFLICT handling (replace old review)
- [ ] Correct column names (review_text, not review)
- [ ] No updated_at column reference

### 9.7 Enroll API (/api/enroll)
- [ ] POST enrolls in free course
- [ | Creates enrollment record

### 9.8 Security APIs
- [/api/security/change-password](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\security\SecurityClient.tsx#L123-L135)
  - [ ] POST validates old password, sets new
  
- [/api/security/logout-sessions](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\security\SecurityClient.tsx#L137-L143)
  - [ ] POST kicks specific session or all others

### 9.9 Notifications APIs
- [/api/notifications](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\updates\UpdatesClient.tsx#L83-L87)
  - [ ] GET fetches user's notifications
  - [ ] Pagination support
  
- [/api/notifications/read](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\updates\UpdatesClient.tsx#L89-L93)
  - [ ] POST marks single as read
  
- [/api/notifications/read-all](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\updates\UpdatesClient.tsx#L95-L99)
  - [ ] POST marks all as read
  
- [/api/notifications/[id]/delete](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\updates\UpdatesClient.tsx#L101-L107)
  - [ ] DELETE removes notification

### 9.10 Site Banners API (/api/site-banners)
- [ ] GET returns active banners for role
- [ ] Cache headers set

### 9.11 Media API (/api/media)
- [ ] Avatar streaming (public)
- [ ] Lesson PDF proxy (authenticated + enrollment required)
- [ ] Range requests supported
- [ ] Cache-Control headers
- [ ] B2 proxy with authorization

### 9.12 Upload Image API (/api/upload/image)
- [ ] Magic byte validation
- [ ] MIME type allow-list
- [ ] Size limits enforced
- [ ] Malicious pattern detection
- [ ] Upload to B2
- [ ] Post-upload verification (HEAD + ranged GET)
- [ ] Delete on failure

### 9.13 Cron Jobs
- [/api/cron/token-cleanup](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\update\UpdateCard.tsx#L221-L227)
  - [ ] Protected by CRON_SECRET header
  - [ ] Cleans expired test_tokens
  - [ ] Cleans used tokens
  - [ ] Clears old failures
  
- [/api/cron/maintenance](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\update\UpdateCard.tsx#L229-L229)
  - [ ] Cleanup stale draft docs (15 days)
  - [ ] Purge rejected instructor data
  - [ ] Throttle via cron_state table
  
- [/api/cron/reconcile-payments](file://C:\Users\piyus\Desktop\htdocs%20(7)\Edulari\app\(site)\update\UpdateCard.tsx#L231-L231)
  - [ ] Handle abandoned orders
  - [ ] Update purchase_history statuses

---

## SECTION 10: LEGACY REDIRECTS

Check these in next.config.ts:
- [ ] *.php URLs → 301 to clean URL
- [ ] /index.php → / (301)
- [ ] /[anything].php → /{anything} (301)
- [ ] /public/* → /* (301)
- [ ] /?i=1 → / (301, strip query)
- [ ] HTTP → HTTPS (301)

Test by requesting old .php URLs in browser.

---

## SECTION 11: EMAIL VERIFICATION

For each scenario, verify emails arrive (check SMTP logs):

- [ ] New user registration welcome email
- [ ] Email verification email
- [ ] Password reset email
- [ ] Instructor application submitted
- [ ] Instructor application approved
- [ ] Instructor application rejected
- [ ] New login notification (from different device/IP)
- [ ] Contact ticket acknowledgment
- [ ] Bug report confirmation
- [ ] Notification broadcasts (when sent)

---

## SECTION 12: ERROR HANDLING

- [ ] 404 page for non-existent routes
- [ ] Forms show appropriate validation errors
- [ ] Database errors don't expose secrets
- [ ] CSRF rejection shows generic message
- [ ] Rate limiting shows appropriate message
- [ ] Authentication redirects preserve return URL
- [ ] Authorization denied (403) for unauthorized access

---

## SECTION 13: SECURITY CHECKS

- [ ] CSRF tokens present on all state-changing forms
- [ ] Rate limiting actually blocks after threshold
- [ ] Role checks prevent unauthorized access
- [ ] Ownership checks (can't edit someone else's course)
- [ ] Session invalidation on password change
- [ ] Blocked users can't access site
- [ ] Password hashes match PHP format ($2y$)
- [ ] Sensitive data encrypted in DB (instructor bank details)

---

## TESTING NOTES

**Date tested:** ___________

**Tester:** ___________

**Major issues found:**
1. _________________________
2. _________________________
3. _________________________

**Minor issues/typos:**
- List all spelling mistakes, wording issues, UI inconsistencies

**Missing features:**
- Document any functionality present in PHP but absent in Next.js

**Improvements:**
- Note any UX enhancements observed (only if safe to implement)

---

**END OF CHECKLIST**
