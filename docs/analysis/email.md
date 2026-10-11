# Email System Analysis

Source files (read-only PHP site `C:\Users\piyus\Desktop\htdocs (7)\htdocs`):
- `private/email/mailer.php`
- `private/email/email_templates.php`
- `private/email/email_senders.php`
- Callers: `private/auth.php`, `private/password_reset.php`, `private/functions/instructor_registration.php`, `public/login.php`, `public/register-success.php`, `public/contact.php`, `public/security.php`, `public/admin/settings.php`, `public/admin/contact-submission-detail.php`, `public/report-bug.php`, `public/admin/bug-report-detail.php`

## Mailer (`private/email/mailer.php`)

`createMailer()` returns a PHPMailer instance (exceptions mode), SMTP via
`SMTP_HOST`, `SMTP_PORT` (587), `SMTP_SECURE` (`tls`), `SMTP_AUTH` (true),
`SMTP_USERNAME`, `SMTP_PASSWORD` (from `$_ENV`, populated by `secrets.php`).
CharSet UTF-8. `setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME)` where
`SMTP_FROM_NAME` = `SITE_NAME`. All settings are constants in `private/config.php`
except the password, which comes from env (`SMTP_PASSWORD`). New port: Nodemailer
with the same host/port/TLS/auth/from semantics.

## Shared layout (`email_templates.php`)

Every email body HTML is wrapped by `emailShell($bodyContent, $previewText = '')`:
`<!DOCTYPE html>`, meta viewport, inline CSS reset (`*{margin:0;padding:0;box-sizing:border-box}`,
table/mso tweaks, img reset, body font stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`, background `#f0f4f8`, color `#1a2f4a`),
`@media (max-width:600px)` responsive overrides on `.email-wrapper/.email-card/.email-header/.email-body/.email-footer/.btn-main/.stat-row td`.
Hidden preview-text div (`display:none;max-height:0...` with `&zwnj;` padding).
Outer wrapper table `email-wrapper` (padding 40px 16px) centers a `email-card`
(max-width 600px, white, radius 16px, `box-shadow:0 4px 24px rgba(15,76,129,.10)`, overflow hidden).
Header `email-header`: gradient `linear-gradient(135deg,#0f4c81 0%,#0d3d6b 50%,#051d3a 100%)`,
padding 36px 40px, centered "edulari" wordmark link to `SITE_URL` (`edu` white 28px/800, `lari` colored `#00b4d8`).
Body `email-body` padding 40px 40px 32px containing `$bodyContent`.
1px divider `#e0ecf5` with `padding:0 40px`.
Footer `email-footer` padding 24px 40px 32px centered: `© {year} {SITE_NAME} · All rights reserved` and link to `SITE_URL`.

Reusable body builders (all keep exact HTML):
- `emailButton($url, $label, $color = '#0f4c81')` — centered box-shadowed button, class `btn-main`.
- `emailFallbackLink($url)` — "Or paste this link into your browser:" + link.
- `emailNotice($icon, $text, $bg = '#e8f0fe', $border = '#0f4c81')` — tinted info box, 4px left border.
- `emailDataTable($rows)` — 2-col table, alternating row backgrounds `#f7fafd`/`#ffffff`, label col width 40%.
- `emailHeading($icon, $text)` — h1 22px/800 `#0f1f3a`.
- `emailSubtitle($text)` — 14px `#6b80a0`.
- `emailP($text, $extraStyle = '')` — 15px `#2a4060` line-height 1.7.
- `emailFeatureList($items)` — icon + text rows.

Timestamps inside emails: `date('d M Y, H:i') . ' UTC'`; years via `date('Y')`.
First-name extraction: `htmlspecialchars(explode(' ', trim($name))[0], ENT_QUOTES, 'UTF-8')`.
All user-supplied values are escaped with `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` before interpolation; messages in contact/bug blocks use `nl2br(htmlspecialchars(...))`.

## Senders (`email_senders.php`)

Convention: functions returning `bool|string` return `true` on success or a
user-safe error string on failure; everything else is fire-and-forget `void`,
errors only `error_log`'d. Several also mirror to in-app notifications via
`createNotification($userId, $type, $title, $body)` after selecting the user id by email.

### 1. sendVerificationEmail(email, name, verifyUrl) — bool|string
- Trigger: registration (`private/auth.php:124` registration flow), resend via
  `resendVerificationEmail()` (`auth.php:190`, used by `login.php:70` and `register-success.php:129`).
- Recipient: the new user. Subject: `Verify Your Email – {SITE_NAME}`.
- HTML: `buildVerificationEmailHtml($name, $verifyUrl)`; Text: `buildVerificationEmailText($name, $verifyUrl)`.
- Variables: first name, `VERIFY_TOKEN_EXPIRY_MINS` mention, `verifyUrl` in button + fallback link, ignore-this-email notice.
- Failure: returns `"Failed to send verification email. Please try again later."`.

### 2. sendWelcomeEmail(email, name) — void (fire-and-forget)
- Trigger: email verification success (`auth.php:157`) and OAuth sign-in path (`auth.php:1086`).
- Subject: `Welcome to {SITE_NAME}! 🎉`.
- HTML: `buildWelcomeEmailHtml($name)`; Text: `buildWelcomeEmailText($name)`.
- Variables: first name, CTA to `{SITE_URL}/browse-courses`, feature list (browse/enrol/track/instructors).
- Side effect: in-app notification type `welcome` with fixed body.
- Failure: `error_log` only.

### 3. sendPasswordResetEmail(email, name, resetUrl, adminInitiated=false) — bool|string
- Trigger: forgot-password (`private/password_reset.php:48`) and admin-initiated reset (`password_reset.php:163` passes `true`).
- Subject: `Reset Your Password – {SITE_NAME}`.
- HTML: `buildPasswordResetEmailHtml($name, $resetUrl, $adminInitiated)`; Text: `buildPasswordResetEmailText(...)`.
- Variables: first name, `resetUrl`, admin-initiated vs self-requested copy, "expires in 15 minutes", warning notice.
- Side effect: in-app notification type `password_reset` (text differs for admin-initiated).
- Failure: returns `"Failed to send reset email. Please try again later."`.

### 4. sendInstructorApplicationNotification(userId, name, email, testScore=0) — void
- Trigger: instructor registration submitted (`private/functions/instructor_registration.php:128`).
- Recipient: `ADMIN_EMAIL`. Subject: `[{SITE_NAME}] New Instructor Application – {name}`.
- HTML: `buildInstructorApplicationNotificationHtml($userId, $name, $email, $testScore)`; Text: `buildInstructorApplicationNotificationText($name, $email)`.
- Variables: applicant name/email/User ID, submitted time UTC, test score % + PASSED/FAILED badge (pass mark `TEST_PASS_SCORE`), CTA to `{SITE_URL}/admin/instructor-applications`.
- Failure: `error_log` only.

### 5. sendInstructorApprovalEmail(email, name) — void
- Trigger: admin approves application (`instructor_registration.php:169`).
- Subject: `🎉 Your Instructor Application has been Approved – {SITE_NAME}`.
- HTML: `buildInstructorApprovalEmailHtml($name)`; Text: `buildInstructorApprovalEmailText($name)`.
- Variables: first name, "APPLICATION APPROVED" badge, CTA to `{SITE_URL}/login`.
- Side effect: in-app notification `instructor_approved`.
- Failure: `error_log` only.

### 6. sendInstructorRejectionEmail(email, name, reason='') — void
- Trigger: admin rejects application (`instructor_registration.php:203`).
- Subject: `Update on Your Instructor Application – {SITE_NAME}`.
- HTML: `buildInstructorRejectionEmailHtml($name, $reason)`; Text: `buildInstructorRejectionEmailText($name, $reason)`.
- Variables: first name, optional escaped reason box, `ADMIN_EMAIL` contact line, empty `reason` → no feedback block.
- Side effect: in-app notification `instructor_rejected` (includes reason when present).
- Failure: `error_log` only.

### 7. sendNewLoginNotificationEmail(email, name, ip, deviceInfo) — void
- Trigger: a login invalidates other sessions (`auth.php:301`).
- Subject: `New Sign-In Detected – {SITE_NAME}`.
- HTML: `buildNewLoginNotificationHtml($name, $ip, $deviceInfo)`; Text: `...Text(...)`.
- Variables: first name, UTC time, escaped IP, deviceInfo truncated to 80 chars, `{SITE_URL}/forgot-password` link.
- Side effect: in-app notification `new_login`.
- Failure: `error_log` only.

### 8. sendPasswordChangedNotificationEmail(email, name, ip, deviceInfo) — void
- Trigger: password change from Security page (`public/security.php:55`) and admin settings (`public/admin/settings.php:298`).
- Subject: `Your Password Was Changed – {SITE_NAME}`.
- HTML: `buildPasswordChangedNotificationHtml(...)`; Text builder with same args.
- Variables: first name, UTC time, IP, deviceInfo (80 chars), forgot-password link.
- Side effect: in-app notification `password_changed`.
- Failure: `error_log` only.

### 9. sendContactConfirmationEmail(email, name, subject, ticketRef, category) — void
- Trigger: contact form submission (`public/contact.php:128`).
- Subject: `We received your message – {SITE_NAME} [{ticketRef}]`.
- HTML: `buildContactConfirmationHtml(...)`; Text: `buildContactConfirmationText(...)`.
- Variables: first name, subject, ticketRef, category label via `_contactCategoryLabel()`, `{SITE_URL}/track-contact?ref={ticketRef}` (urlencoded), response-time notice.
- Failure: `error_log` only.

### 10. sendContactAdminNotificationEmail(senderName, senderEmail, subject, category, priority, ticketRef, message) — void
- Trigger: contact form submission (`public/contact.php:131`).
- Recipient: `ADMIN_EMAIL` as `"{SITE_NAME} Admin"`. Subject: `[{PRIORITY-UPPER}] New Contact: {subject} [{ticketRef}]`.
- HTML: `buildContactAdminNotificationHtml(...)`; Text: `buildContactAdminNotificationText(...)`.
- Variables: priority color badge (low/normal/high/urgent), message truncated to 500 chars (HTML) / 800 (text), CTA `{SITE_URL}/admin/contact-submissions`.
- Failure: `error_log` only.

### 11. sendContactReplyEmail(email, name, subject, ticketRef, replyMsg, newStatus) — void
- Trigger: admin replies to a ticket with `replyType === 'public'` (`public/admin/contact-submission-detail.php:80`). Internal notes do NOT email.
- Subject: `Re: {subject} [{ticketRef}] – {SITE_NAME}`.
- HTML: `buildContactReplyHtml(...)`; Text: `buildContactReplyText(...)`.
- Variables: first name, status label via `_contactStatusLabel()`, `nl2br(htmlspecialchars(replyMsg))`, resolved/closed → green notice else follow-up notice, track link `{SITE_URL}/track-contact?ref={ticketRef}`.
- Failure: `error_log` only.

### 12. Bug report to admin (inline in `public/report-bug.php:163-188`, no `sendX` wrapper)
- Trigger: bug report POST succeeds (DB row inserted, even if insert fails they still try email).
- Recipient: `ADMIN_EMAIL` as "Edulari Admin", `addReplyTo($email, $name)`, optional screenshot attachment (`screenshot.{safeExt}` from validated upload path).
- Subject: `[Bug Report] [{sevLabel}] {subject} — {reportRef}`.
- HTML: `buildBugReportEmailHtml(name, email, role, issueType, page, subject, description, steps, expected, sevLabel, sevColor, browser, reportRef)`; Text: `buildBugReportEmailText(...)` (note: text version takes `sevColor` out — one fewer arg).
- Variables: `reportRef`, severity badge color (`sevColor`, bg from `sevBgMap`), type label from `issueType` map, role default Guest, page/browser/steps/expected default "Not provided", description/steps/expected via `nl2br(htmlspecialchars())`.
- Failure: `error_log('[BugReport] Email send failed: ...')`, `$emailSent` stays false.

### 13. Bug report confirmation to reporter (`public/report-bug.php:190-201`)
- Subject: `We received your report — {reportRef} | {SITE_NAME}`.
- HTML: `buildBugConfirmationEmailHtml($name, $subject, $reportRef)`; Text: `buildBugConfirmationEmailText(...)`.
- Variables: first name, `reportRef` chip, Issue / Status "🟡 Under Review" / Response"Within 1–2 business days", Help Center link `{SITE_URL}/student/help-center`.
- Failure: `error_log` only.

### 14. Bug report status update (`public/admin/bug-report-detail.php:75-102`)
- Trigger: admin changes a report's status (any of open/in_progress/resolved/wont_fix/duplicate).
- Recipient: `reporter_email`, `reporter_name`.
- Subject: `buildBugStatusEmailSubject($newStatus, $subject, $reference)` →
  `[{reference}] Your report has been {phrase} — {subject-truncated-60-chars…}` with phrases resolved→"resolved", in_progress→"now being investigated", open→"reopened", wont_fix→"closed (won't fix)", duplicate→"closed (duplicate)".
- HTML: `buildBugStatusEmailHtml(reporterName, subject, reference, newStatus, adminNotes='')`; Text: `buildBugStatusEmailText(...)`.
- Variables: per-status config (icon, label, colors, badge text, heading, sub, intro, extra block), summary data table (Reference, Issue, New Status, Updated `date('d M Y, H:i') . ' UTC'`), optional admin-notes block, CTA `{SITE_URL}/track-report?ref={reference}` (urlencoded).
- Failure: `error_log('[BugReport] Status email failed: ...')`.

## Constants referenced (from `private/config.php`)

- `SITE_NAME`, `SITE_URL`, `ADMIN_EMAIL` (env-free constant in config.php; editable via admin settings page which rewrites `config.php` — to be replaced by `app_settings` DB rows / env).
- `VERIFY_TOKEN_EXPIRY_MINS` = 30, `TEST_PASS_SCORE` = 80 (from `api_config.php`), `SMTP_HOST/PORT/SECURE/AUTH/USERNAME/PASSWORD/FROM_EMAIL/FROM_NAME`.

## WhatsApp/SMS or other channels

None found — email is the only transactional channel.

## Open questions

- Bug report emails bypass `email_senders.php` (inline `$mail = createMailer()` in two page files) — preserve behavior but a Next port should unify them into senders; confirm intended.
- `buildBugReportEmailText()` signature omits `sevColor` (11 args) while HTML takes 13 — confirm deliberate.
- `sendWelcomeEmail` in `auth.php:1086` (OAuth) — verify the exact OAuth branch sends it only on first verification.
- `ADMIN_EMAIL` is hardcoded in `config.php` and rewritten by an admin settings page; decide env var vs DB-driven value in the new schema.
- Booking/payment/enrollment emails: none exist in the PHP codebase (no `create-order`/`verify-payment` email side effects found) — confirm no payment emails are expected.
- `_contactCategoryLabel` map and priority color maps should move into shared constants; confirm category/status slugs are canonical in DB.
