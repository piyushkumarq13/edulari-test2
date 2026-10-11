# functions.md — Exhaustive spec of `private/functions/*` + `private/api/ai_questions.php` + `private/api/test_token.php`

Source root (read-only): `C:\Users\piyus\Desktop\htdocs (7)\htdocs\private`
Generated: 2026-10-08. No phase work started.

Global helpers/constants used across the files (defined elsewhere):
- `dbSelect($sql, $params=[])`, `dbSelectOne(...)`, `dbInsert(...)` (returns new id), `dbExecute(...)` (returns affected-row count or false), `getDbConnection()` (PDO), `dbBeginTransaction()/dbCommit()/dbRollback()` — defined in `private/db.php`.
- `logSecurity(string $event, array $context=[])` — `private/config.php:102`, appends JSON line to `SECURITY_LOG_FILE` (`private/logs/security.log`).
- `logUpload(string $event, array $context=[])` — `private/config.php:115`, appends to `private/logs/uploads.log`.
- `isInstructor()` — `private/auth.php:445`, true when logged in and `$_SESSION['user_role'] === ROLE_INSTRUCTOR`.
- Constants (`private/config.php`): `SITE_NAME`, `SITE_URL`, `ADMIN_EMAIL`, `SESSION_LIFETIME` (86400), `HASH_COST` (12), `ROLE_ADMIN/STUDENT/INSTRUCTOR`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CURRENCY_CODE` ('INR'), `ROOT_PATH`, `PUBLIC_PATH`, `PRIVATE_PATH`, `LOG_PATH`, `MAINTENANCE_LOG_FILE`, `BANNER_LOG_FILE`.
- `private/api/api_config.php`: `ACTIVE_AI_PROVIDER` ('openrouter'), `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` ('openrouter/free'), `OPENROUTER_ENDPOINT`, `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME` ('Edulari'), `NVIDIA_KIMI_API_KEY`, `NVIDIA_KIMI_MODEL` ('moonshotai/kimi-k2.6'), `NVIDIA_KIMI_ENDPOINT`, `TEST_QUESTION_COUNT` (10), `TEST_PASS_SCORE` (80), `TEST_TOKEN_TTL_MINS` (30), `AI_CONNECT_TIMEOUT` (10), `AI_REQUEST_TIMEOUT` (45), `AI_MAX_EXEC_TIME` (60). Google/OpenAI/Anthropic constants and `ai_call_openai/anthropic` are commented out.
- `B2_*` constants from `private/config/b2_config.php` (see b2_storage.php).
- Email helpers `sendInstructorApplicationNotification/sendInstructorApprovalEmail/sendInstructorRejectionEmail` from `private/email/email_senders.php`.

---

## admin.php

### getPlatformStats()
- Params: none. Returns assoc array: `total_users, total_students, total_instructors, total_courses, published_courses, pending_courses, total_enrollments, total_revenue, monthly_revenue, recent_signups, recent_enrollments, top_courses`.
- Tables read: `users` (id, role, registration_date, name, email), `courses` (id, is_published, price, title, instructor_id, created_at), `enrollments` (id, enrolled_at, student_id, course_id), `course_reviews` (rating, course_id).
- Rules: monthly_revenue over last 12 months grouped `DATE_FORMAT(...,'%Y-%m')`; recent signups/enrollments LIMIT 10; top courses LIMIT 10 ordered by enrollment_count.
- Side effects: none.
- Callers: `public/admin/dashboard.php`, `public/index.php`.

### getAllUsers($filters = [], $limit = 50, $offset = 0)
- Returns array of user rows plus computed `course_count`, `enrollment_count`.
- Tables read: `users`, `courses` (instructor_id), `enrollments` (student_id).
- Filters: `role` (exact), `search` (LIKE on name/email, `%...%`), `status` (is_active exact).
- Callers: `public/admin/users.php`.

### getUserDetails($userId)
- Returns user row or false. For role `student` adds `enrollments` (join courses/users); for role `instructor` adds `courses` and `stats` (total_students distinct, total_enrollments, total_revenue).
- Tables read: `users`, `enrollments`, `courses`, `course_reviews`.
- Callers: `public/admin/user-detail.php`.

### toggleUserStatus($userId, $active)
- `UPDATE users SET is_active=?` (1/0). Returns dbExecute result (affected count).
- Tables written: `users` (is_active).
- Callers: `public/admin/user-detail.php`, `public/admin/users.php`.

### changeUserRole($userId, $newRole)
- Validates `$newRole` in `['admin','instructor','student']` else false.
- Transaction: update `users.role`; if 0 rows affected rollback+false; then kill sessions: `UPDATE user_sessions SET is_active=0, kicked_reason='role_changed' WHERE user_id=? AND is_active=1`; commit, return affected count. On exception rollback + error_log, return false.
- Callers: `public/admin/user-detail.php`, `public/admin/users.php`.

### deleteUser($userId)
- Transaction via `getDbConnection()` + beginTransaction. Reads `users.role`. If instructor: loop `courses` by `instructor_id`, calls `deleteCourse($course['id'], $userId)` from `courses.php`. If student: delete `lesson_progress`, `quiz_attempts`, `assignment_submissions`, `enrollments` (per enrollment id), then `wishlists`, `cart`, `course_reviews` by `student_id`. Delete `login_attempts` where identifier matches the user's email (`SELECT email FROM users WHERE id=?`). Finally `DELETE FROM users`. commit, true; on exception rollback + error_log, false.
- Callers: `public/admin/user-detail.php`, `public/admin/users.php`.

### getAllCoursesAdmin($filters = [], $limit = 50, $offset = 0)
- Returns courses joined to `users` (instructor_name/email), `categories` (category_name) plus student_count, avg_rating, review_count.
- Filters: `status` (`published`→`is_published=1`, `pending`→0), `search` (LIKE title/description), `instructor`.
- Callers: (none outside definitions found).

### adminDeleteCourse($courseId)
- `intval`, `<=0` → false. Transaction: collect lesson ids; delete `quiz_answers` (via attempt ids of those lessons), `quiz_attempts`, `quiz_options` (via question ids), `quiz_questions`, `assignment_submissions`, `assignments`, `lesson_progress`, `lessons`, `course_sections`, `enrollments`, `course_reviews`, then `courses`. Note: also deletes `quiz_attempts` by `lesson_id` (line 371) and assignment_submissions by `lesson_id`; enrollment-scoped attempts/submissions not matching lesson list are not explicitly deleted. commit, true; exception → rollback + error_log + false.
- Callers: `public/admin/courses.php`.

### getAllEnrollments($limit = 50, $offset = 0)
- Returns enrollments joined to users/courses/instructor.
- Callers: (none outside definitions).

### getAllReviews($limit = 50, $offset = 0)
- Returns `course_reviews` joined to student user, course, instructor.
- Callers: (none outside definitions).

### deleteReview($reviewId)
- `DELETE FROM course_reviews WHERE id=?`.
- Callers: `public/admin/reviews.php`.

### createCategory($name, $description = '')
- `$slug = createSlug($name)`; if taken append `-'.time()`. `INSERT INTO categories (name, slug, description)`.
- Note: duplicated logic also exists as `adminCreateCategory` below. Callers: (none outside definitions).

### updateCategory($categoryId, $data)
- Partial fields `name` (regenerates slug via createSlug, no uniqueness check) and `description`. Returns false if no fields.
- Callers: (none outside definitions).

### deleteCategory($categoryId)
- `UPDATE courses SET category_id=NULL` then delete category.
- Callers: (none outside definitions).

### getSystemSettings()
- Returns SITE_NAME, SITE_URL, ADMIN_EMAIL, total_users count, `'storage_used' => 'N/A'`.
- Callers: `public/admin/settings.php`.

### createSlug($string)
- Lowercase, trim, `preg_replace('/[^a-z0-9-]/','-')`, collapse `-+`, trim `-`. NOTE: also defined in `courses.php` (duplicate).
- Callers: `public/admin/edit-course.php`, and used by createCategory/createCourse/admin category helpers.

### getAllCategories()
- All categories ORDER BY name.
- Callers: `public/admin/create-course.php`, `public/admin/edit-course.php`.

### adminCreateCategory($name, $description = '')
- Same slug logic as createSlug inline; uniqueness check then `-time()`; INSERT.
- Callers: (none outside definitions).

### adminUpdateCategory($categoryId, $name, $description)
- Rebuild slug from name, conflict-check excluding self, append `-time()` if conflict; UPDATE name/slug/description.
- Callers: (none outside definitions).

### adminDeleteCategory($categoryId)
- Nulls course category_id, deletes category.
- Callers: (none outside definitions).

### adminGetCourse($courseId)
- Course row + instructor_name + category_name. Callers: `public/admin/edit-course.php`.

### adminUpdateCourse($courseId, $data)
- Allowed fields: title, description, short_description, category_id, level, language, duration_hours, price, certificate_enabled, passing_percentage, thumbnail, instructor_id, is_published, is_featured. Updates slug when title set (slugify + uniqueness else `-time()`). No instructor ownership check. Callers: `public/admin/edit-course.php`.

### adminEnrollStudent($studentId, $courseId)
- Duplicate check → 'already_enrolled'; user must be role 'student' else false; course must exist else false. INSERT enrollment with NOW(), progress 0. Callers: `public/admin/enrollments.php`.

### adminUnenrollStudent($enrollmentId)
- Transaction delete lesson_progress/quiz_attempts/assignment_submissions/enrollments; rollback+error_log on exception. Callers: `public/admin/enrollments.php`.

### adminCreateCourse($data)
- Slug from title (+`-time()` on conflict). INSERT with `is_published=0`, defaults certificate_enabled 1, passing_percentage 70. Callers: `public/admin/create-course.php`.

### blockUser(int $userId, string $reason = ''): bool
- Transaction: `UPDATE users SET is_active=0, block_reason='admin_blocked', block_note=? WHERE id=? AND role != 'admin'`; if 0 rows → rollback+false. Kill all active sessions (`kicked_reason='admin_blocked'`). Commit true; exception rollback+error_log+false. Callers: `public/admin/user-detail.php`, `public/admin/users.php`.

### unblockUser(int $userId): bool
- `UPDATE users SET is_active=1, block_reason=NULL, block_note=NULL`. Callers: user-detail/users.

### getPendingApplicationsCount(): int
- COUNT instructor_applications WHERE status='pending'. Callers: (admin dashboard likely; no explicit grep hit).

### getRevenueSummary(int $days = 30): array
- enrollments+revenue over last N days; default `{enrollments:0, revenue:0}` when no row.

### adminToggleCoursePublish(int $courseId, bool $publish): bool
- Sets `is_published` 1/0.

### getBlockedUsers(): array
- users WHERE is_active=0 AND block_reason='admin_blocked', ORDER BY name.

### getInstructorAuditSummary(int $userId): array
- Latest instructor_applications row (status, submitted_at, reviewed_at, rejection_reason) + total_courses/total_students/total_revenue for instructor.

### getInstructorPayouts(int $instructorId): array
- instructor_payouts rows newest first. Callers: `public/instructor/earnings.php`.

### getTotalPayoutsForInstructor(int $instructorId): float
- SUM amount WHERE status='paid'. Callers: `public/instructor/earnings.php`.

### createPayout(int $instructorId, float $amount, string $method = '', string $ref = '', string $note = ''): bool
- INSERT instructor_payouts (instructor_id, amount, payment_method, reference_no, note, status='paid', paid_at=NOW()).

### cancelPayout(int $payoutId): bool
- `UPDATE instructor_payouts SET status='cancelled' WHERE id=? AND status='pending'`.

### saveSettings(array $data): array
- Validates lengths (site_name 100, site_url 255, admin_email 254, smtp_host 253, smtp_user 254, smtp_pass 500, timezone 60, currency_code 10) and rejects `\r`/`\n` in those fields; errors array returned early.
- Rewrites `private/config.php` via regex replace of `define('SITE_NAME'|SITE_URL|ADMIN_EMAIL|SMTP_HOST|SMTP_PORT|SMTP_USERNAME|SMTP_FROM_EMAIL|HASH_COST|SESSION_LIFETIME)` and `date_default_timezone_set(...)`; currency_code whitelist `['INR','USD','EUR','GBP','JPY','AUD','CAD','SGD','AED']` with symbol map; writes with `LOCK_EX`.
- If `smtp_pass !== ''`, rewrites `$_ENV['SMTP_PASSWORD']` in `private/secrets.php`.
- Rewrites `OPENROUTER_SITE_URL`/`OPENROUTER_SITE_NAME` in `private/api/api_config.php`.
- Side effects: file writes to config.php/secrets.php/api_config.php. Callers: `public/admin/settings.php`.

### saveApiSettings(array $data): array
- Rewrites `$_ENV['OPENROUTER_API_KEY']`, `$_ENV['NVIDIA_KIMI_API_KEY']`, `$_ENV['RAZORPAY_KEY_SECRET']` in secrets.php (only for non-empty values); `RAZORPAY_KEY_ID` in config.php; `ACTIVE_AI_PROVIDER` in api_config.php. LOCK_EX writes. Callers: `public/admin/settings.php`.

---

## analytics.php

### getInstructorOverviewStats($instructorId)
- Returns `total_courses, published_courses, total_students (distinct), total_revenue, avg_course_rating (2dp), recent_enrollments (10), monthly_revenue (6 months), top_courses (5, published only)`.
- Tables read: courses, enrollments, course_reviews, users.
- Callers: `public/instructor/analytics.php`, `public/instructor/dashboard.php`, `public/instructor/profile.php`.

### getCourseDetailedAnalytics($courseId, $instructorId)
- Verifies ownership (`courses.id AND instructor_id`) else false. Returns `enrollment_trend (30 days, DATE(enrolled_at))`, `completion_rate` (completed_at NOT NULL / total *100, 2dp), `progress_distribution` buckets Not Started/0-25/25-50/50-75/75-99/Completed, `lesson_completion_stats` (declared key, always empty — no query), `quiz_performance` (per quiz-type lesson attempt_count and avg score), `student_demographics` (declared, never populated).
- Tables read: courses, enrollments, lessons, quiz_attempts.
- Callers: `public/instructor/course-analytics.php`.

### getCourseStudentProgress($courseId, $instructorId, $limit = 50, $offset = 0)
- Ownership check else false. Returns enrollments w/ student name/email and total_lessons count.
- Callers: `public/instructor/course-analytics.php`.

---

## assignments.php

### createAssignment($data)
- INSERT assignments (lesson_id, instructions, max_marks ?? 100, passing_marks ?? 40, due_days ?? 7, allow_late_submission ?? 0). Callers: `public/instructor/course-content.php`.

### updateAssignment($assignmentId, $data)
- Whitelist: instructions, max_marks, passing_marks, due_days, allow_late_submission. False when no fields. Callers: course-content.php.

### deleteAssignment($assignmentId)
- DELETE by id. (No external callers found.)

### getAssignmentByLesson($lessonId)
- SELECT WHERE lesson_id. Callers: course-content.php (and student.php's getLessonForStudent).

### getAssignmentById($assignmentId)
- SELECT by id. (No external callers found.)

---

## b2_storage.php
Uses `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_ID`, `B2_BUCKET_NAME` from `private/config/b2_config.php`. All return arrays, never throws; errors logged via `error_log`.

### b2EncodeFileName(string $fileName): string
- `rawurlencode` each path segment, join with `/`.

### b2Authorize(): array
- Session cache `$_SESSION['b2_auth_cache']` with `expires_at = time()+82800` (23h). Else POST `https://api.backblazeb2.com/b2api/v2/b2_authorize_account` with Basic auth, timeout 30. Returns `['success','apiUrl','authToken','downloadUrl','message']`.

### b2GetUploadUrl(string $authToken, string $apiUrl): array
- POST `{apiUrl}/b2api/v2/b2_get_upload_url` with `{bucketId: B2_BUCKET_ID}`. Returns uploadUrl/uploadAuthToken.

### b2UploadFile(string $localTmpPath, string $destFileName, string $mimeType): array
- Full flow: authorize → get_upload_url → POST file bytes with headers `X-Bz-File-Name` (encoded), `X-Bz-Content-Sha1` (sha1_file), Content-Type; timeout 120. Returns fileId/fileName.
- Callers: `public/instructor/profile.php`, `public/student/profile.php`, and `lessons.php::uploadLessonPDF`.

### b2StreamFile(string $fileName)
- Authorize; GET `{downloadUrl}/file/{B2_BUCKET_NAME}/{encoded name}` with auth token. On error: 500 JSON / 404 JSON + exit. On success emits headers: Content-Type (B2's, fallback by extension map, octet-stream default), Content-Disposition inline for `['pdf','mp4','webm','mp3','jpg','jpeg','png','gif','webp','txt']` else attachment; Cache-Control `public, max-age=31536000, immutable`; echoes body; exit. Callers: `public/media.php`.

### b2DeleteFile(string $fileName, string $fileId): array
- POST b2_delete_file_version.

### b2GetFileIdByName(string $fileName): ?string
- b2_list_file_names with startFileName+maxFileCount 1; matches exact fileName.

### b2DeleteOldFile(?string $key): void
- Skips empty, keys starting with `/` (local paths), and when not configured; looks up id and deletes; logs failures.
- Callers: `public/instructor/profile.php`, `public/student/profile.php`, lessons.php upload.

### isB2Configured(): bool
- True when B2_KEY_ID and B2_APPLICATION_KEY are defined, non-empty, not placeholder values. Callers: profile.php files, lessons.php.

---

## banners.php
No DB; file-backed: `PRIVATE_PATH/data/banners.json` (`getBannersFilePath()`). Requires config.php (PRIVATE_PATH).

### getBannersFilePath(): string — returns `PRIVATE_PATH . '/data/banners.json'`.

### getAllBanners(): array — decode JSON file; returns [] on missing/invalid.

### saveAllBanners(array $banners): void
- mkdir 0750 if needed; tempnam('bnr_'); JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES; flock LOCK_EX; rename over target.

### createBanner(array $data): array
- ID `'bnr_' . bin2hex(random_bytes(6))`; defaults: version 1, template 'simple-text', type 'info', title/message '', audience [], cta null, schedule null, resurface_after_days null, active true, priority (int) ?? 0, created_at/updated_at `date('Y-m-d H:i:s')`, created_by/updated_by `$_SESSION['user_id'] ?? null`. Appends, saves, `logBannerEvent('created', ...)`. Callers: `public/admin/banners.php`.

### updateBanner(string $id, array $data): ?array
- Updates title/message/template/type/cta (cta only when key present), audience/schedule/resurface_after_days/active/priority when keys present; bumps `version` only when content (title/message/template/type/cta) changed; logs 'updated' with content_changed + new_version. Returns banner or null.

### deleteBanner(string $id): bool — removes, saves, logs 'deleted'.

### toggleBannerActive(string $id, bool $active): ?array — sets active/updated_at/updated_by, logs 'toggled'.

### getAvailableBannerTemplates(): array
- scandir `PRIVATE_PATH/banner-templates`, filter `.php`, name => ucwords(str_replace('-',' ',name)). Callers: `public/admin/banners.php`, `public/partials/site-banners.php`.

### getActiveBannersForRole(?string $role): array
- role null → 'guest'. Filter: banner.active truthy, role in audience, schedule.start_at <= now (when set), schedule.end_at >= now; sort by priority desc. Callers: `public/partials/site-banners.php`.

### logBannerEvent(string $event, array $context = []): void
- Defaults context user_id from session, ip from REMOTE_ADDR, timestamp; writes `BANNER | event | json` via error_log(3) to BANNER_LOG_FILE else LOG_PATH/banners.log else PRIVATE_PATH/logs/banners.log.

---

## certificates.php

### hasMetCertificateCriteria($studentId, $courseId)
- Join enrollments+courses; false if no row or `certificate_enabled` falsy; true when `(int)progress_percentage >= (int)passing_percentage`. Callers: `public/student/generate-certificate.php`, `public/student/learn.php`.

### getCertificateByEnrollment($studentId, $courseId)
- Find enrollment id; return certificates row for that enrollment_id or null. Callers: `public/student/learn.php`.

### getCertificateById($certificateId)
- SELECT by `certificate_id` string. Callers: `public/verify-certificate.php`.

### issueCertificate($studentId, $courseId, $studentName, $courseName)
- Enrollment required; existing certificate returned as-is (idempotent). Generates `CERT-XXXX-XXXX-XXXX` (3× 4 uppercase hex chars from random_bytes(2)) with uniqueness retry loop. INSERT certificates (certificate_id, enrollment_id, student_id, course_id, course_name, student_name, issued_at NOW()). Returns fresh row or false. Callers: `public/student/generate-certificate.php`.

---

## courses.php

### createCourse($data)
- slug via createSlug, `-time()` on conflict. INSERT courses with columns instructor_id, category_id, title, slug, description, short_description, level, language, duration_hours, price, certificate_enabled (?? 1), passing_percentage (?? 70). Callers: `public/instructor/create-course.php`.

### updateCourse($courseId, $data, $instructorId, &$rowsAffected = null)
- Ownership via getCourseById; whitelist title, description, short_description, category_id, level, language, duration_hours, price, certificate_enabled, passing_percentage, thumbnail. Returns true even on 0 changed rows; sets by-ref `$rowsAffected`; false on query failure/no fields. Callers: `public/instructor/edit-course.php`.

### deleteCourse($courseId, $instructorId)
- Ownership check else false. Transaction: delete quiz_options/quiz_questions (join via lessons.course_id), assignments, lessons, course_sections, enrollments, course_reviews, then courses (by id+instructor_id); a no-op `DELETE pr ... WHERE 1=0` on password_resets. commit only when rowCount>0 else rollback. PDOException → rollback + error_log + false. Callers: `public/instructor/courses.php`, admin.php deleteUser.

### toggleCoursePublish($courseId, $instructorId, $publish = true)
- Sets is_published 1/0 and published_at to `date('Y-m-d H:i:s')` or NULL. Callers: `public/instructor/courses.php`.

### getCourseById($courseId, $instructorId = null)
- course row + category_name; optional instructor ownership filter. Callers: instructor course-analytics/course-content/courses/edit-course.

### getInstructorCourses($instructorId, $filters = [])
- WHERE instructor_id; filters status published/draft, search LIKE title/description; student_count and avg_rating subselects. Callers: `public/instructor/courses.php`.

### getCourseStats($courseId, $instructorId)
- Ownership; returns total_students, completed_students (completed_at NOT NULL), avg_progress (2dp), avg_rating, total_reviews, total_revenue. Callers: `public/instructor/course-analytics.php`.

### getCategories()
- All categories. Callers: instructor create-course/edit-course, browse-courses.

### createSlug($string) — same slugify (duplicate of admin.php).

### getCourseSectionsPublic($courseId) — sections ORDER BY sort_order, id. (No external callers found.)

### getSectionLessonsPublic($sectionId, $includeContent = false)
- Fields: all (`l.*`) when $includeContent else id/title/content_type/video_duration/is_free_preview/sort_order. (No external callers found.)

### uploadThumbnail($file, $courseId)
- Whitelists image/jpeg,png,webp; `scanUploadedFile($file, $allowedTypes, 'course_thumbnail', 2*1024*1024)`; local dir `public/uploads/courses/`, filename `course_{id}_{time}.{ext}`, ext map jpeg→jpg; updates `courses.thumbnail`. Returns `['success','path']` or `['success'=>false,'message']`. Callers: instructor create-course/edit-course.

---

## instructor_registration.php
Requires `PRIVATE_PATH/email/email_senders.php`. Tables: `instructor_profiles`, `instructor_applications`, `users`.

### saveInstructorApplication(array $data, int $testScore = 0, int $testTimeTaken = 0): bool|string
- Requires `$data['user_id']` and a `users` row with role ROLE_INSTRUCTOR. Upserts instructor_profiles (headline, bio, website, linkedin_url, twitter_url, years_exp int, teaching_style). Upserts instructor_applications with credentials (highest_education, institution, field_of_study, graduation_year?int, certifications, professional_exp, notable_works), competency (primary_subject, secondary_subjects, skill_level, target_audience, course_ideas, sample_content_url), legal (full_legal_name, pan_number, bank_account, ifsc_code, account_holder, upi_id, revenue_share_ack/terms_agreed/content_policy ints, govt_id_file, marksheet_file), test_score, test_time_taken_seconds; status forced 'pending', submitted_at NOW(). Sends admin notification email. Callers: `public/test/index.php`.

### approveInstructorApplication(int $applicationId): bool|string
- Load app + user; sets `users.is_active=1`; `instructor_applications.status='approved', reviewed_at=NOW()`; deletes doc files via `_deleteInstructorDocs`; sends approval email. Callers: instructor-applications admin pages.

### rejectInstructorApplication(int $applicationId, string $reason = ''): bool|string
- Sets `users.is_active=0, block_reason='application_rejected'`; application status 'rejected', rejection_reason, reviewed_at; deletes docs; sends rejection email.

### _deleteInstructorDocs(array $app): void
- Unlinks `govt_id_file`/`marksheet_file` (basename) from `PRIVATE_PATH/uploads/instructor_docs/`; NULLs both columns in DB.

### saveInstructorDraft(int $userId, array $data, int $currentStep): bool
- Upsert instructor_profiles when profile present; merge credentials/competency/legal/documents (only non-empty) into instructor_applications plus `last_completed_step = $currentStep`; insert path uses status 'draft', submitted_at NOW(). Callers: instructor-register steps 2,3,4,5,7.

### loadInstructorDraft(int $userId): array
- Returns `['step'=>int,'data'=>[...]]`, default step 2 empty. Requires users.email_verified. Maps profile row (step≥3), credentials (step≥4), competency (step≥5), legal (step≥6), documents; step = max of deduced vs `last_completed_step`. (No external callers found — used by resumeInstructorRegistration.)

### isInstructorRegistrationResumable(int $userId): bool
- role must be ROLE_INSTRUCTOR, email_verified=1, is_active=0; latest application must be absent or status 'draft' (pending/rejected/test_failed NOT resumable). Callers: `public/instructor-register/step-1.php`.

### resumeInstructorRegistration(int $userId): int
- If resumable: hydrates `$_SESSION['instructor_reg_data']`, `$_SESSION['instructor_reg_step']`, `$_SESSION['instructor_pending_user_id']`; unsets `instructor_awaiting_email_verify`; logs `INSTRUCTOR_REGISTRATION_RESUMED`; returns step. Else returns 0. Callers: step-1.php, `_init.php`, login.php.

### cleanupStaleDraftDocs(bool $force = false): int
- Throttle: `PRIVATE_PATH/.cleanup_last_run`, skip when `time()-filemtime < 18000` (comment says 24h; actual constant 18000s = 5h — note for parity). Deletes doc files for instructor_applications with status IN ('draft','test_failed'), files present, `updated_at < NOW() - INTERVAL 15 DAY`. Callers: admin dashboard, instructor-applications, instructor-register `_init.php`.

### purgeRejectedInstructorData(bool $force = false): int
- Throttle file `.purge_last_run`, same 18000s window. Targets applications with status 'rejected'/'test_failed' OR ('draft' AND updated_at older than 15 days): deletes doc files, deletes instructor_profiles and instructor_applications rows, sets users to `role='student', is_active=1, block_reason=NULL, block_note=NULL` (keeps id/email/name/password/email_verified). Returns count. Callers: admin dashboard, instructor-applications, `_init.php`.

---

## lessons.php

### createLesson($data)
- INSERT lessons (section_id, course_id, title, content_type, content_text ?? null, video_url ?? null, video_duration ?? 0, pdf_file ?? null, is_free_preview ?? 0, sort_order ?? 0). Callers: course-content.php.

### updateLesson($lessonId, $courseId, $data)
- Whitelist: section_id, title, content_type, content_text, video_url, video_duration, pdf_file, is_free_preview, sort_order. WHERE id AND course_id.

### deleteLesson($lessonId, $courseId) — DELETE id+course_id.

### getSectionLessons($sectionId, $courseId) — ORDER BY sort_order, id.

### getLessonById($lessonId, $courseId = null) — optional course filter.

### getCourseLessons($courseId) — join course_sections, ORDER BY s.sort_order, l.sort_order.

### reorderLessons($sectionId, $lessonOrders)
- For each [lessonId=>order], UPDATE sort_order WHERE id AND section_id. Returns true. (No external callers found.)

### uploadLessonPDF($file, $lessonId)
- Extension whitelist with MIME map (pdf/doc/docx/ppt/pptx/xls/xlsx/txt/zip/mp4/webm/mp3/jpg/jpeg/png/gif/webp) including alt-MIME aliases (e.g. docx/pptx/xlsx accept 'application/zip'). `scanUploadedFile(..., 'lesson_file', 50*1024*1024)`. Deletes prior file (`b2DeleteOldFile` on lessons.pdf_file). If B2 configured: b2UploadFile to `lessons/lesson_{id}_{time}.{ext}`. Else local `public/uploads/lessons/`. Updates `lessons.pdf_file`. Callers: course-content.php.

---

## maintenance.php

### getMaintenanceStatus(): ?array
- Reads `ROOT_PATH/.maintenance` JSON; requires keys `student` and `instructor`; null otherwise. If `auto_disable_at` in past: unlink, log 'auto_disabled', return null. Else return data. Callers: settings.php, admin-maintenance-banner.php, media.php, navbar.php, checkMaintenanceMode.

### setMaintenanceStatus(bool $student, bool $instructor, ?string $autoDisableAt = null): void
- Both false → delete flag file, log 'disabled'. Else write JSON {student, instructor, enabled_at, enabled_by `$_SESSION['user_id']??null`, auto_disable_at} and log 'enabled'. Callers: settings.php.

### disableMaintenance(): void — unlink flag, log 'disabled'. Callers: settings.php.

### logMaintenanceEvent(string $event, array $context = []): void — same pattern as banners logger; file `maintenance.log`.

### getPageCategory(string $requestUri): string
- parse path, strip `/public` prefix, rtrim '/'. 'system' for webhook/create-order/verify-payment/mark-order-status/track-*/sitemap/robots.txt. 'admin' for `/admin*`. 'exempt' for login/register/register-success/forgot/reset/verify-email/account-activation/logout and any `/auth/` path. 'instructor_onboarding' for `/instructor-register*`, instructor-register-success, `/test` paths. 'student' for `/student/`. 'instructor' for `/instructor/`. Else 'public'.

### checkMaintenanceMode(): void
- No-op when no flag or `$_SESSION['user_role']==='admin'`. Categories 'admin'/'exempt'/'system' never blocked. Blocks ('public'|'student') when status.student, or ('instructor'|'instructor_onboarding') when status.instructor: `http_response_code(503)`, define MAINTENANCE_PAGE_RENDER, include `ROOT_PATH/public/partials/maintenance-page.php`, exit. Callers: `private/bootstrap.php`, `public/partials/maintenance-page.php`.

---

## markdown.php

### renderMarkdown(string $text): string
- Normalizes CRLF; protects fenced code ```` ```lang ```` blocks (escaped via htmlspecialchars ENT_QUOTES, wrapped `<pre class="md-code"><code class="language-{lang|text}" data-lang=...>`); htmlspecialchars-escapes everything else; inline code `` `x` `` → `<code class="md-inline-code">`; tables via pipe-line regex (header th row, `|---|` separator skipped, `<table class="md-table">`); headings h1–h6 (`#`*i + space); hr for `-{3,}`/`\*{3,}`/`_{3,}` (`<hr class="md-hr">`); blockquotes `> ` → `<blockquote class="md-quote">`; unordered lists `-/*/+` → `<ul><li>`; ordered `N.` → `<ol><li>`; `**/__` → strong; `++` → `<u>`; `*/* italic` and `_em_`; `~~` → `<s>`; images `![alt](src)` → `<img class="md-img" loading="lazy">`; links `[t](url)` → `<a target="_blank" rel="noopener noreferrer">`; paragraphs wrapped in `<p>` with `<br>` per line; `\x00CODE{n}\x00` placeholders restored last. Output is safe (raw HTML escaped). Callers: `public/student/learn.php`, `public/course-ai-shared.php`, `public/course.php`.

---

## media_urls.php

### getAvatarUrl(?string $profileImageValue): string
- '' for empty. Full http(s) URLs returned as-is. Values starting with `/` (legacy local paths) returned as-is. Otherwise treated as B2 key and returned as `/media?type=avatar&key={rawurlencoded}`. Callers: many pages (admin users detail, instructor profile/students/reviews, student profile/learn, instructor-profile.php, navbar.php).

### getLessonPdfUrl(int $lessonId): string — returns `/media?type=lesson_pdf&id={lessonId}`. (No external callers found — check learn page integration.)

---

## notifications.php
- Guard: `if (!defined('SITE_URL')) { http_response_code(403); exit; }`. Types enumerated in header comment: welcome, password_reset, password_changed, new_login, instructor_approved, instructor_rejected, promotional, general, featured_course, new_course, recommendation, announcement.

### _notifVisibilityClause(int $userId, string $role): array
- Returns WHERE `(m.audience='all' OR m.audience=? OR (m.audience='specific' AND m.target_user_id=?)) AND (r.deleted_at IS NULL OR r.deleted_at > NOW())` with params [role, userId]. NOTE: other queries in this file use only `r.deleted_at IS NULL` — slight inconsistency.

### _getUserRole(int $userId): string — users.role, fallback 'student'.

### createNotification(int $userId, string $type, string $title, string $body): int|false
- INSERT notification_messages (type, title, body, audience='specific', target_user_id, sent_by NULL). Callers: `private/email/email_senders.php`, `public/admin/send-notifications.php`.

### createNotificationForRole(string $role, string $type, string $title, string $body, int $sentBy = 0): int
- audience=$role, target NULL, sent_by null when 0; returns 1/0. Callers: send-notifications.php.

### createNotificationForAll(string $type, string $title, string $body, int $sentBy = 0): int
- audience='all'. Callers: send-notifications.php.

### getUnreadNotificationCount(int $userId): int
- LEFT JOIN notification_reads per user; counts where audience matches, `r.deleted_at IS NULL`, COALESCE(r.is_read,0)=0. Callers: navbar.php, updates.php.

### getRecentNotifications(int $userId, int $limit = 5): array — LIMIT cast to int. Callers: navbar.php.

### getAllNotifications(int $userId): array — all, newest first. Callers: updates.php.

### getNotificationById(int $notifId, int $userId): ?array — single visible message. (No external callers found.)

### markNotificationRead(int $notifId, int $userId): bool
- INSERT INTO notification_reads (message_id, user_id, is_read) VALUES (?,?,1) ON DUPLICATE KEY UPDATE is_read=1. Callers: updates.php.

### markAllNotificationsRead(int $userId): bool — loops visible unread ids doing the upsert. Callers: updates.php.

### deleteNotificationForUser(int $notifId, int $userId): bool — upsert sets deleted_at=NOW(), is_read=1. Callers: updates.php.

### notificationTypeLabel(string $type): string — match map above; default 'Notification'. Callers: navbar.php, updates.php.

---

## payment_reconciliation.php
Constants: `RECONCILE_INTERVAL_SECONDS = 60` (comment: production should be 900), `RECONCILE_GRACE_SECONDS = 10` (prod 600), `RECONCILE_MAX_ORDERS = 20`, `RECONCILE_ABANDON_AFTER = 120` (comment says 30 minutes), `RECONCILE_RECHECK_WINDOW_SECONDS = 3600`, `CLEANUP_RETENTION_DAYS = 10`, `CLEANUP_INTERVAL_SECONDS = 21600`.

### maybeRunPaymentReconciliation(): void
- Reads app_settings 'last_payment_reconcile_run'; exits if within interval; CAS-update to claim (UPDATE ... WHERE setting_value = lastRun); registers `reconcilePendingRazorpayPayments` via register_shutdown_function. Callers: `private/bootstrap.php`.

### reconcilePendingRazorpayPayments(): void
- Selects razorpay_orders where status IN ('created','enrollment_failed') OR (status IN ('cancelled','failed') AND created within 3600s), AND created_at older than 10s grace, ORDER BY created_at ASC LIMIT 20. Calls checkAndReconcileOneOrder per row.

### maybeRunCancelledOrdersCleanup(): void
- Same lazy-cron pattern with key 'last_cleanup_run' (INSERT IGNORE seed '0'), interval 21600s, shutdown handler `purgeOldCancelledOrders`. Callers: bootstrap.php.

### purgeOldCancelledOrders(): void
- DELETE FROM razorpay_orders WHERE status IN ('cancelled','failed') AND created_at < NOW() - INTERVAL 10 DAY; error_log on success.

### fetchCapturedRazorpayPayment(string $orderId)
- GET `https://api.razorpay.com/v1/orders/{orderId}/payments` with RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET basic auth, timeout 15. Returns first captured payment; false when reachable and none captured; null on transport/HTTP error (caller must not treat as "no payment"). Callers: `public/student/check-payment-status.php`, plus checkAndReconcileOneOrder.

### checkAndReconcileOneOrder(array $orderRow): void
- null → skip. false (no captured payment): only for status 'created'/'enrollment_failed' rows older than RECONCILE_ABANDON_AFTER (120s) → updateRazorpayOrderStatus(orderId,'abandoned') + error_log. captured: decode courses_json, call `processCapturedPayment(student_id, orderId, payment.id, payment.amount, courses)`, error_log result.

---

## quizzes.php

### createQuizQuestion($data)
- INSERT quiz_questions (lesson_id, question, question_type ?? 'multiple_choice', points ?? 1, sort_order ?? 0). If multiple_choice and options present, create option per entry (text, is_correct ?? 0, index). If true_false: two options 'True'/'False' with correctness from `$data['correct_answer'] === 'true'/'false'`. Callers: course-content.php.

### createQuizOption($questionId, $text, $isCorrect = 0, $sortOrder = 0) — INSERT quiz_options.

### updateQuizQuestion($questionId, $data)
- Whitelist question, points, sort_order. (No external callers found.)

### updateQuizOptions($questionId, $options)
- DELETE existing options for question, re-insert each (text, is_correct ?? 0, index). (No external callers found.)

### deleteQuizQuestion($questionId) — DELETE by id. (No external callers found.)

### getQuizQuestions($lessonId)
- Questions ORDER BY sort_order,id; each gets `options` (quiz_options ORDER BY sort_order,id). Callers: course-content.php, student.php learn/quiz flow.

### getQuestionById($questionId) — row + options. (No external callers found.)

### getQuizTotalPoints($lessonId): int|mixed — SUM(points). Callers: course-content.php.

---

## sections.php

### createSection($courseId, $title, $description = '', $sortOrder = 0) — INSERT course_sections. Callers: course-content.php.

### updateSection($sectionId, $courseId, $data)
- Whitelist title, description, sort_order; WHERE id AND course_id. Callers: course-content.php.

### deleteSection($sectionId, $courseId) — Callers: course-content.php.

### getCourseSections($courseId, $instructorId = null)
- When instructorId given, verify course ownership else return []. Sections ORDER BY sort_order, id. Callers: course-content.php.

### reorderSections($courseId, $sectionOrders) — per-id sort_order updates. (No external callers found.)

---

## student.php
Requires quizzes.php, assignments.php, certificates.php.

### getAllPublishedCourses($filters = [], $limit = 20, $offset = 0)
- WHERE is_published=1; filters: category (category_id), level, search (LIKE title/description/short_description), price ('free' → price=0, 'paid' → price>0). Subselects student_count, avg_rating, review_count, lesson_count. ORDER created_at DESC LIMIT/OFFSET. Callers: student dashboard.

### getCourseDetails($courseId)
- Published courses only; joins categories, users, instructor_profiles; COALESCE chain for instructor_bio/headline(default 'Expert Instructor')/avatar; plus student_count, avg_rating, review_count, lesson_count, total_duration (video), instructor_total_students/courses, instructor_avg_rating (ROUND 1). Callers: student generate-certificate/learn, course.php.

### isEnrolled($studentId, $courseId)
- Returns enrollment row (id, progress_percentage, enrolled_at, completed_at) or false. Used widely.

### enrollStudent($studentId, $courseId)
- Blocks when `isInstructor()`; duplicate check → `['success'=>false,'message'=>'Already enrolled in this course']`; INSERT enrollments NOW(), progress 0. Callers: admin enrollments, cart.php, course.php, wishlist.php, plus processCapturedPayment.

### unenrollStudent($studentId, $courseId)
- Verifies enrollment belongs to student; transaction deletes lesson_progress/quiz_attempts/assignment_submissions/enrollments. Callers: course.php.

### getStudentCourses($studentId)
- Enrollments + course + category + instructor, total_lessons subselect, completed_lessons via lesson_progress join enrollments. Callers: student dashboard/my-courses/schedule.

### getCourseContentForStudent($courseId, $studentId)
- Enrollment check; sections with lessons LEFT JOINed to lesson_progress (completed_at, time_spent_seconds), quiz_attempts (score, percentage, passed, completed_at), assignment_submissions (status, marks_obtained). Callers: student learn.php.

### getLessonForStudent($lessonId, $courseId, $studentId)
- Enrollment check; lesson + section_title + progress; if quiz: questions via getQuizQuestions + previous_attempt (latest quiz_attempts by completed_at); if assignment: assignment via getAssignmentByLesson + submission; navigation prev/next. Callers: learn.php.

### getLessonNavigation($courseId, $sectionId, $currentLessonId)
- Flat ordered list (sections.sort_order, lessons.sort_order); returns ['prev'=>?, 'next'=>?]. (Internal.)

### markLessonComplete($enrollmentId, $lessonId, $timeSpent = 0)
- First completion → INSERT lesson_progress (enrollment_id, lesson_id, completed_at NOW(), time_spent_seconds); else `time_spent_seconds = time_spent_seconds + ?`, completed_at COALESCE. Then updateCourseProgress. Callers: learn.php (also called by submitQuizAttempt on pass).

### updateCourseProgress($enrollmentId)
- percentage = completed/total lessons (0 when total 0), rounded; completed_at set to now when >=100 (COALESCE — never overwrites). UPDATE enrollments progress_percentage, completed_at.

### submitQuizAttempt($enrollmentId, $lessonId, $answers)
- INSERT quiz_attempts (enrollment_id, lesson_id, started_at NOW()). Per question: multiple_choice → selected option id + correct when option.is_correct; true_false → compares to 'True'/'False' text; computes points; INSERT quiz_answers. percentage = earned/total*100 (2dp). passing from courses.passing_percentage (default 70). UPDATE quiz_attempts score/total_points/percentage/passed/completed_at. If passed → markLessonComplete. Returns attempt_id/score/total/percentage/passed.

### submitAssignment($enrollmentId, $lessonId, $data)
- Uses `$data['submission_text']`; existing → UPDATE text/submitted_at/status='pending'; else INSERT. Callers: learn.php.

### isInWishlist / addToWishlist / removeFromWishlist / getWishlist
- addToWishlist blocks instructors, no-op when present; getWishlist joins courses published + avg_rating. Callers: index/browse/cart/course/wishlist/dashboard.

### addToCart($studentId, $courseId)
- Blocks instructors; no-op when present; refuses when already enrolled; INSERT. Callers: browse-courses, course, wishlist. getCart joins published courses ordered by cart.added_at DESC. removeFromCart by student/course.

### getCourseReviews($courseId, $limit = 10) — latest 10 with student name. Callers: course.php.

### submitReview($studentId, $courseId, $rating, $reviewText)
- Requires enrollment; existing review → UPDATE rating/review_text/created_at=NOW(); else INSERT. Callers: course.php.

### getStudentStats($studentId)
- total_courses, completed_courses, wishlist_count, cart_count, total_spent (SUM c.price). Callers: many student pages + public pages.

### recordPurchase(int $studentId, string $orderId, string $paymentId, int $amountPaise, string $currency, array $courses, string $ipAddress = '')
- IP validated via filter_var (IPv6 ok) else null. Courses snapshot keeps only course_id/title/price. `INSERT IGNORE INTO purchase_history (... status 'paid', courses_json, ip_address)`. Returns new id or false.

### updatePurchaseStatus(int $purchaseId, string $status, int $enrolledCount): bool
- Allowed: paid, enrollment_failed, enrolled.

### updateRazorpayOrderStatus(string $razorpayOrderId, string $status, ?string $reason = null): bool
- Allowed: created, enrolled, enrollment_failed, abandoned, failed, cancelled. For cancelled/failed: only applied while current status='created' (race guard) and sets failure_reason. Callers: check-payment-status.php, mark-order-status.php, checkAndReconcileOneOrder, processCapturedPayment.

### processCapturedPayment(int $studentId, string $razorpayOrderId, string $razorpayPaymentId, int $amountPaise, array $courses, string $ipAddress = ''): array
- Idempotency: if purchase_history row for payment_id already status 'enrolled' → success already_processed. recordPurchase (race-safe via INSERT IGNORE; re-fetch on conflict). Transaction: for each course, skip falsy ids; enrollStudent unless enrolled (failure other than 'Already enrolled...' throws); removeFromCart; commit. On success: purchase status 'enrolled' + enrolled_count, order status 'enrolled'. On exception: rollback, purchase status 'enrollment_failed', order 'enrollment_failed', error_log, `['success'=>false, ...]`. Single enrollment code path used by verify-payment (Layer 1), webhook (Layer 2), reconciliation (Layer 3), student check-payment-status.

### getStudentPurchaseHistory(int $studentId, int $limit = 50, int $offset = 0): array
- UNION of purchase_history + razorpay_orders rows with status IN ('created','abandoned','failed','cancelled') and no matching purchase_history (orders' 'created' displayed as 'pending'). Each row: courses decoded from courses_json, `amount_rupees = number_format(amount_paise/100, 2)`, raw JSON removed.

### getStudentPurchaseHistoryAll(int $studentId): array — same union without LIMIT/OFFSET (collapse duplicates before pagination). Callers: student purchase-history.php.

### getStudentPurchaseTotalCount(int $studentId): int — matching count (union subquery).

### getPurchaseReceiptData(int $studentId, string $orderId): ?array
- Only status 'enrolled' or 'refunded'; decodes courses, amount_rupees. Callers: student receipt.php.

### getPurchaseByPaymentId(string $paymentId, int $studentId = 0): ?array
- Non-empty paymentId; student-scoped query when studentId>0 else joins users for student_name/email (admin use). Callers: admin enrollments.php.

---

## token_cleanup.php

### cleanupExpiredTokens(bool $force = false): array
- Throttle `PRIVATE_PATH/.token_cleanup_last_run`, window 21600s (6h). Deletes: test_tokens where expires_at<NOW() OR used=1; test_failures where retry_after<NOW(); email_verification_tokens expired; password_resets expired; login_attempts where block expired OR (not blocked AND last_attempt older than 30 days). Returns table=>count map (or [] when throttled). Callers: admin dashboard.php, login.php.

---

## upload_security.php
Constants: `FILE_SIGNATURES` (jpeg/png/webp-"RIFF"/gif/pdf magic bytes) and `MALICIOUS_PATTERNS` (`<?php`, `<?=`, `<script`, `javascript:`, `eval(`, `base64_decode(`, `system(`, `exec(`, `passthru(`, `shell_exec(`, `popen(`, `proc_open(`).

### scanUploadedFile(array $file, array $allowedMimes, string $context = 'upload', int $maxBytes = 0): array
- Returns `['safe'=>bool,'message'=>string,'mime'=>string]`.
- 1. `$file['error'] !== UPLOAD_ERR_OK` → reject + log UPLOAD_ERROR.
- 2. `is_uploaded_file` fail → NOT_UPLOADED_FILE.
- 3. maxBytes>0: filesize check → FILE_TOO_LARGE.
- 4. finfo real MIME must be in $allowedMimes (strict) else MIME_REJECTED + logSecurity BAD_MIME_UPLOAD.
- 5. Magic-byte check on first 1024 bytes for types present in FILE_SIGNATURES else MAGIC_BYTE_FAIL + MAGIC_BYTE_MISMATCH security log.
- 6. Full-content case-insensitive scan for MALICIOUS_PATTERNS → MALICIOUS_UPLOAD_BLOCKED security log.
- 7. Pass → logUpload SCAN_PASSED with size. Callers: instructor create-course/edit-course (via uploadThumbnail), instructor/student profile avatar, student learn (assignment), ajax-image-upload.php.

---

## private/api/ai_questions.php

### generateTestQuestions(array $regData): array
- Saves then raises `max_execution_time` to AI_MAX_EXEC_TIME (60). Builds prompt via buildQuestionPrompt. Switch on ACTIVE_AI_PROVIDER: 'openrouter' → ai_call_openrouter, 'google' → ai_call_google, 'nvidia_kimi' → ai_call_nvidia_kimi, default throws RuntimeException('Unknown AI provider: '). Parse via parseQuestionsFromJSON, restore prior max_execution_time (NOTE: restore is skipped on exception — parity note). Callers: public/test/index.php.

### buildQuestionPrompt(array $d): string
- Extracts profile/credentials/competency from $regData; subject (default 'General'), secondary_subjects, skill_level (default 'intermediate'), target_audience (default 'general learners'), course_ideas, education, field, certs, years_exp, bio. Prompt asks for exactly TEST_QUESTION_COUNT (10) 4-option MCQs as raw JSON `[{question, options:{A,B,C,D}, answer}]`, no markdown fences.

### ai_call_google(string $prompt): string
- JSON POST to GOOGLE_AI_ENDPOINT with contents/parts and generationConfig temperature 0.7, maxOutputTokens 2048, timeout AI_REQUEST_TIMEOUT (45), connect 10. SSL: first attempt verifies peer (VERIFYHOST 2); on errno 60/77/CURLE_SSL_* retries with VERIFYPEER false. Non-200 → RuntimeException with Google's error.message; empty text → RuntimeException. Extracts `candidates[0].content.parts[0].text`.

### ai_call_nvidia_kimi(string $prompt): string
- OpenAI-compatible POST to NVIDIA_KIMI_ENDPOINT with model NVIDIA_KIMI_MODEL, temperature 0.6, top_p 0.9, max_tokens 4096, stream false, Authorization Bearer NVIDIA_KIMI_API_KEY. Same SSL-fallback pattern. Extracts `choices[0].message.content`.

### ai_call_openrouter(string $prompt): string
- Model fallback chain: OPENROUTER_MODEL ('openrouter/free'), then 'openai/gpt-oss-120b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free', 'openai/gpt-oss-20b:free'. For each: POST OPENROUTER_ENDPOINT with temperature 0.7, max_tokens 4096, headers `Authorization: Bearer OPENROUTER_API_KEY`, `HTTP-Referer: OPENROUTER_SITE_URL`, `X-Title: OPENROUTER_SITE_NAME`. Per-model SSL fallback; curl/HTTP/empty-content failures log and continue to next model; logs which model succeeded and warns on finish_reason 'length'. Throws after all fail: 'All AI models failed. Last error: ...'.

### parseQuestionsFromJSON(string $raw): array
- Strips leading/trailing ``` fences, finds first '[', json_decode; on failure salvages via recursive-regex object extraction `\{(?:[^{}]|(?R))*\}` filtering objects with 'question'. Validates each: non-empty question, options.A/B/C/D set, answer in A–D (case-insensitive); normalises trims and uppercase answer. Throws RuntimeException when nothing valid. Logs raw response (first 1000 chars).
- Stub `ai_call_openai` exists only inside a /* */ block.

---

## private/api/test_token.php
Tables: `test_tokens` (user_id, token, expires_at, used, test_data JSON, on_pass_action default 'instructor_registration', redirect_pass, redirect_fail, created_at, started_at, expires, questions_data, started_ip, last_autosave_at, answers_data), `test_failures` (user_id, ip_address, context default 'instructor_registration', failed_at, retry_after).

### createTestToken(int $userId, array $testData, string $onPassAction = 'instructor_registration', string $redirectPass = '/instructor-register-success', string $redirectFail = '/instructor-register/step-6'): string
- Prior token for user+action: if it has started_at NOT NULL → return existing token; else delete it. New token `bin2hex(random_bytes(32))` (64 hex). INSERT with expires_at = NOW() + TEST_TOKEN_TTL_MINS (30), used 0, test_data json, redirects, created_at NOW(). Callers: `public/instructor-register/step-8.php`.

### validateTestToken(string $token): array|false
- Row where used=0 AND (expires_at > NOW() OR started_at IS NOT NULL). Decodes test_data. False otherwise. Callers: public/test/index.php.

### consumeTestToken(string $token): bool
- `UPDATE ... SET used=1 WHERE token=? AND used=0`, true only when exactly 1 row affected.

### deleteTestToken(string $token): void

### markTestStarted(string $token, array $questions, string $ip, int $ttlMins = TEST_TOKEN_TTL_MINS): void
- `UPDATE ... SET started_at=NOW(), expires_at=NOW()+? MIN, questions_data=?, started_ip=? WHERE token=? AND started_at IS NULL`; logs on failure.

### saveTestAnswers(string $token, int $questionIndex, string $optionLetter): array
- Loads questions_data/answers_data/last_autosave_at; validates index range and option key presence; rate limit: rejects when NOW() < last_autosave_at + 1 SECOND ('rate_limited'); merges answer into answers_data, sets last_autosave_at=NOW(). Reasons: token_not_found, invalid_question_index, invalid_option, rate_limited, write_failed. Does not check IP (caller does).

### computeTestScore(array $questions, array $answers): array
- Pure. correct = answers[i] uppercased equals q.answer; total = count(questions); score = round(correct/total*100) or 0. Returns ['correct','total','score'].

### findAndScoreAbandonedTestTokens(): int
- Tokens with used=0, started_at set, NOW() > expires_at. Per token: score via computeTestScore, time_taken via TIMESTAMPDIFF(SECOND, started_at, NOW()); consumeTestToken (skip if already consumed); delete prior test_failures for user/IP/context and insert new with 7-day retry_after; upsert instructor_applications status 'test_failed' with test_score/test_time_taken_seconds (insert when missing); deleteTestToken. Callers: admin instructor-applications.php, public/test/index.php.

### recordTestFailure(int $userId, string $ip, string $context = 'instructor_registration'): void
- Deletes rows matching user_id OR ip_address for context, inserts failed_at NOW(), retry_after NOW()+7 DAY.

### checkTestFailureBlock(int $userId, string $ip, string $context = 'instructor_registration'): array
- Returns ['blocked'=>bool, 'retry_after'=>string|null] when any matching row has retry_after > NOW() (latest). Callers: instructor-register `_init.php`, test/index.php.

---

## Cross-file dependencies
- courses.php ↔ admin.php (deleteUser calls deleteCourse; duplicate createSlug).
- student.php requires quizzes.php/assignments.php/certificates.php; used by payment_reconciliation.php.
- instructor_registration.php uses email senders (email_senders.php) and `logSecurity`.
- b2_storage.php depends on config/b2_config.php; lessons.php and profile pages depend on b2_storage + media_urls + upload_security.
- notifications.php requires config-derived SITE_URL + PRIVATE_PATH/db.php.
- payment_reconciliation.php requires config.php, db.php, auth.php, student.php (processCapturedPayment, updateRazorpayOrderStatus).
- api files depend on api_config.php and db.php.
- All markdown/media URLs hinge on `/media` proxy (public/media.php) and the B2 layer.

## Side-effect inventory (for parity porting)
- Emails sent: approveInstructorApplication, rejectInstructorApplication, saveInstructorApplication (admin notification), plus email_senders.php usages.
- Files written/deleted: banners.json (banners.php), .maintenance (maintenance.php), throttle files .cleanup_last_run/.purge_last_run/.token_cleanup_last_run, config.php/secrets.php/api_config.php (admin saveSettings/saveApiSettings), local uploads (courses thumbnails, lessons, instructor docs) and B2 objects (b2UploadFile/b2DeleteOldFile).
- B2 calls: authorize, get_upload_url, upload, download stream, delete, list.
- Security logs: config.php logSecurity via BAD_MIME_UPLOAD, MAGIC_BYTE_MISMATCH, MALICIOUS_UPLOAD_BLOCKED, INSTRUCTOR_REGISTRATION_RESUMED.
- Session changes: b2Authorize caches `$_SESSION['b2_auth_cache']`; resumeInstructorRegistration sets instructor_reg_* + instructor_pending_user_id; changeUserRole/blockUser kill sessions (kicked_reason).
- Shutdown hooks: maybeRunPaymentReconciliation/maybeRunCancelledOrdersCleanup register_shutdown_function handlers.

## Open questions
1. `cleanupStaleDraftDocs` comment says "once per 24 hours" but code uses 18000s; `purgeRejectedInstructorData` comment says "once every 5 hours" and code also uses 18000s — is 18000 intended for both (5h) or is one a bug? (instructor_registration.php:503-561).
2. `_notifVisibilityClause` tests `r.deleted_at IS NULL OR r.deleted_at > NOW()`, while every other query in notifications.php filters only `r.deleted_at IS NULL`. Which is canonical for the Next.js port? (notifications.php:52 vs 164/194).
3. `RECONCILE_ABANDON_AFTER = 120` but comment says "30 minutes"; also `RECONCILE_INTERVAL_SECONDS`/`RECONCILE_GRACE_SECONDS` are marked TESTING — confirm production values (900/600/1800?) before porting. (payment_reconciliation.php:17-20).
4. `generateTestQuestions` does not restore the previous `max_execution_time` when ai_call_* throws — intended or bug? (ai_questions.php:45-48).
5. `getCourseDetailedAnalytics` declares `lesson_completion_stats` and `student_demographics` but never populates them — drop or implement in the port? (analytics.php:127-129).
6. `getLessonPdfUrl`, `getCourseSectionsPublic`, `getSectionLessonsPublic`, `deleteAssignment`, `getAssignmentById`, `updateQuizQuestion`, `updateQuizOptions`, `deleteQuizQuestion`, `getQuestionById`, `reorderLessons`, `reorderSections`, `getCourseSections` ownership nuance, `deleteNotificationForUser` vs `_notifVisibilityClause`, `getStudentPurchaseHistory` (non-All), `getStudentPurchaseTotalCount`, `getNotificationById`: no direct external callers found via grep — confirm they are dead code or called indirectly (e.g. from includes).
7. `media_urls.php` `getLessonPdfUrl` assumes `/media?type=lesson_pdf` exists; verify the avatar path uses `/media?type=avatar` (confirmed via public/media.php only for type=avatar/stream? check media.php handlers when porting).
8. `uploadThumbnail` in courses.php writes to local `public/uploads/courses/` even when B2 is configured, whereas lessons.php `uploadLessonPDF` prefers B2 — intentional asymmetry (thumbnails local, lesson files B2)? Confirm before porting. (courses.php:351 vs lessons.php:171-193).
9. The MD parser in markdown.php escapes HTML before processing (allow-listing is different from a typical marked+sanitize-html pipeline); ensure the Next.js port matches this exact regex-based behavior, not a generic library. (markdown.php:9-107).
10. `saveInstructorDraft` insert path lacks `status` in the generated column list? Re-check: it sets `status` via SQL literal `'draft'` — confirm Postgres port maps it identically. (instructor_registration.php:343-347).
11. b2StreamFile lacks HTTP Range support in the PHP code — AGENTS.md says support Range "where the PHP proxy did"; since PHP did not, confirm Range can be omitted or must be added. (b2_storage.php:193-253).
