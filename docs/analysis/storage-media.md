# storage-media.md — Uploads & Media (exhaustive)

## Sources read in full
- `private/functions/b2_storage.php` (381 lines)
- `private/functions/media_urls.php` (51 lines)
- `private/functions/upload_security.php` (121 lines)
- `private/config/b2_config.php` (15 lines)
- `public/media.php` (110 lines)
- `public/ajax-image-upload.php` (36 lines)
- `public/admin/serve-doc.php` (46 lines)
- `public/instructor-register/step-7.php` (upload block L47–131)
- `private/functions/instructor_registration.php` (`_deleteInstructorDocs` L212, `cleanupStaleDraftDocs` L503, `purgeRejectedInstructorData` L552)
- `public/admin/dashboard.php`, `public/admin/instructor-applications.php`, `public/instructor-register/_init.php` (callers)
- `.htaccess` files: `private/uploads/instructor_docs/.htaccess`, `public/uploads/courses/.htaccess`, `private/.htaccess`

## B2 config (b2_config.php)
- `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_ID`, `B2_BUCKET_NAME`, each overridable via `$_ENV` (values from env in production). `isB2Configured()` returns false for missing or `'YOUR_*'` placeholder values. Bucket name default is `edulari` (single private bucket for everything — public-ness is enforced by the app, not by bucket policy).

## b2_storage.php API (all return arrays, never throw; every call authorizes first)
- `b2Authorize()`: Basic auth against `b2_authorize_account`; result cached in `$_SESSION['b2_auth_cache']` with `expires_at = time() + 82800` (23h; B2 tokens live ~24h). Returns `{success, apiUrl, authToken, downloadUrl, message}`.
- `b2GetUploadUrl($authToken, $apiUrl)`: per-file upload URL + temp token for `B2_BUCKET_ID`.
- `b2UploadFile($localTmpPath, $destFileName, $mimeType)`: sha1 of file, then POST to upload URL with headers `Authorization`, `X-Bz-File-Name: b2EncodeFileName(...)` (rawurlencode per segment, preserving `/`), `Content-Type`, `X-Bz-Content-Sha1`. Returns `{success, fileId, fileName, message}`.
- `b2StreamFile($fileName)`: server-side proxy download — GET `{downloadUrl}/file/{B2_BUCKET_NAME}/{encoded name}` with auth header; on non-200 → 404 JSON. Content-Type taken from B2, fallback to extension map (pdf/mp4/webm/mp3/jpg/jpeg/png/gif/webp/txt/html/docx/doc/zip/pptx/ppt/xls/xlsx/wav/ogg). `Content-Disposition: inline` for pdf/media/images/txt else `attachment`, `filename="basename"`, `Content-Length`, `Cache-Control: public, max-age=31536000, immutable`. `exit`s after output.
- `b2DeleteFile($fileName, $fileId)` via `b2_delete_file_version`; `b2GetFileIdByName` via `b2_list_file_names` (startFileName, maxFileCount 1, exact match); `b2DeleteOldFile($key)` deletes only B2 keys (strings not starting with `/` and B2 configured), failures logged never blocking.

## media_urls.php
- `getAvatarUrl($profileImageValue)`: `http(s)://` → as-is (OAuth avatars); starts with `/` → legacy local path as-is; otherwise B2 key → `/media?type=avatar&key=<rawurlencode>` (empty → `''`).
- `getLessonPdfUrl($lessonId)`: always `/media?type=lesson_pdf&id=<id>`.

## media.php (public proxy/authorization layer)
- `type=avatar&key=`: requires non-empty `key` (400 JSON otherwise), then `b2StreamFile($key)` — public, no auth.
- `type=lesson_pdf&id=`:
  1. Student maintenance check: `getMaintenanceStatus()`; if `maint['student']` truthy → 503 JSON `'Service temporarily unavailable due to maintenance.'`
  2. `$lessonId = (int)$_GET['id']`, `<= 0` → 400 `'Invalid lesson ID.'`
  3. `getCurrentUser()` falsy → 401 `'Authentication required.'`
  4. Lesson fetched (`course_id, pdf_file`); missing/empty pdf → 404.
  5. `isEnrolled($currentUser['id'], $lesson['course_id'])` false → 403 `'You are not enrolled in this course.'`
  6. Backward compat: `pdf_file` starting with `/` → local file under `PUBLIC_PATH`, extension → mime map (pdf/txt/html/jpg/jpeg/png/gif/webp/mp4/webm/mp3/wav/ogg/zip/doc/docx/pptx/ppt/xls/xlsx, else octet-stream), `Content-Disposition: inline`, `Cache-Control: private, max-age=3600`, `readfile`. Otherwise B2 key → `b2StreamFile`.
- Unknown type → 400 `'Unknown media type.'`

## upload_security.php (scanUploadedFile — called before every move_uploaded_file)
- `FILE_SIGNATURES`: jpeg `\xFF\xD8\xFF`; png `\x89PNG\r\n\x1A\n`; webp `RIFF`; gif `GIF87a`/`GIF89a`; pdf `%PDF-`.
- `MALICIOUS_PATTERNS` (case-insensitive, substring over LOWERCASED FULL file bytes): `<?php`, `<?=`, `<script`, `javascript:`, `eval(`, `base64_decode(`, `system(`, `exec(`, `passthru(`, `shell_exec(`, `popen(`, `proc_open(`.
- Checks in order: `UPLOAD_ERR_OK`; `is_uploaded_file`; size cap (if `$maxBytes > 0`, `filesize` check with MB message); `finfo` real MIME must be in `$allowedMimes`; first-1KB magic-byte check vs `FILE_SIGNATURES[$realMime]`; full-content malicious pattern scan. Each rejection logs via `logUpload(...)` and, where noted, `logSecurity(...)` with context, original filename, detected MIME, pattern.
- Returns `['safe' => bool, 'message' => string, 'mime' => string]`. All-pass logs `SCAN_PASSED`.

## ajax-image-upload.php (TinyMCE/editor images)
- `getCurrentUser()` must exist and have role `admin` or `instructor`, else 403 `'Not allowed.'`
- `$_FILES['file']` present and `UPLOAD_ERR_OK`, else `'No file uploaded.'`
- `scanUploadedFile(..., ['image/jpeg','image/png','image/webp','image/gif'], 'editor_image', 5 * 1024 * 1024)`.
- Destination `public/uploads/editor/` (created 0755 if missing); name `editor_<time>_<4 random bytes hex>.<ext>` (ext mapped from verified MIME: jpg/png/webp/gif, default jpg).
- `move_uploaded_file` → `{success:true, url:'/uploads/editor/<name>'}`; failure → `{success:false, 'Upload failed.'}`.
- NOTE: editor images are stored on LOCAL DISK in the PHP app, not B2.

## admin/serve-doc.php (private instructor documents)
- `requireRole(ROLE_ADMIN)`.
- `$requestedFile = basename($_GET['file'])` (basename strips traversal), `$appId = intval($_GET['app'])`; either missing → 400 `'Invalid request.'`
- Anti-enumeration: row fetched from `instructor_applications`; `$requestedFile` MUST equal that application's `govt_id_file` or `marksheet_file`, else 403 `'Access denied.'` Missing file → 404.
- Served from `PRIVATE_PATH . '/uploads/instructor_docs/'`, mime map jpg/jpeg/png/webp/pdf else octet-stream; `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Content-Length`, `readfile`. Admin-only access; instructors/students never get a URL to these files.

## Instructor document flow (step-7.php + instructor_registration.php)
- Uploads go to `PRIVATE_PATH . '/uploads/instructor_docs/'` (NOT public web root). Allowed MIMEs `image/jpeg, image/png, image/webp, application/pdf` via finfo on tmp file, max size 5 MB (`5 * 1024 * 1024`), `UPLOAD_ERR_OK`; filename `{field}_{userId}_{16 hex chars}.{ext}`. Both fields (`govt_id`, `marksheet`) required unless a saved draft already has them. Old replaced files unlinked; new files moved; filenames saved to session + `saveInstructorDraft(..., step 7)`. No `scanUploadedFile` magic-byte scan on this path — only finfo MIME + size + error (gap vs upload_security).
- Scheduled deletion does NOT use `docs_scheduled_delete`/`docs_delete_after` columns (those names appear nowhere in the codebase — the AGENTS.md mention is aspirational). Actual mechanism:
  - On approval: docs are served to admin during review, then on REJECTION `_deleteInstructorDocs($app)` unlinks `govt_id_file`/`marksheet_file` and NULLs the DB columns.
  - `cleanupStaleDraftDocs($force=false)`: throttled to once/5h via `PRIVATE_PATH/.cleanup_last_run` (note: comment says 24h, code uses 18000s = 5h); deletes files for rows with `status IN ('draft','test_failed')` AND `updated_at < NOW() - INTERVAL 15 DAY` having either doc set. Called non-forced on every `instructor-applications.php` admin load and every instructor-register `_init.php`; forced (`run_cleanup=1`) from admin dashboard POST.
  - `purgeRejectedInstructorData($force=false)`: same 5h throttle via `.purge_last_run`; targets `status IN ('rejected','test_failed')` OR draft older than 15 days; deletes remaining doc files, `instructor_profiles` row, `instructor_applications` row, and resets user to `role='student', is_active=1, block_reason=NULL, block_note=NULL` (keeps identity; email remains verified so re-registering as instructor is blocked by the step-1 email check).
- `private/uploads/instructor_docs/.htaccess`: `Deny from all` — no direct web access; only `admin/serve-doc.php` reads them.

## .htaccess notes
- `public/uploads/courses/.htaccess`: `php_flag engine off` + deny on `\.(php|phtml|phar|php\d|pl|py|cgi|asp|aspx)$` — thumbnails remain publicly readable/crawlable (SEO), script execution blocked.
- `private/.htaccess`: full deny for everything under `private/` (defense in depth behind root rewrite).
- `private/uploads/instructor_docs/.htaccess`: `Deny from all`.

## Serverless (Vercel) implications noted
- All B2 access via S3-compatible SDK recommended (AGENTS.md); keep `/media?type=avatar` and `/media?type=lesson_pdf&id=` proxy URL scheme identical.
- `.cleanup_last_run`, `.token_cleanup_last_run`, `.purge_last_run` throttle files must move to DB (`cron_state` table) — local disk state is not serverless-safe.
- Editor images (`/uploads/editor/`), course thumbnails (`/uploads/courses/`), and instructor docs (`/private/uploads/instructor_docs/`) all live on local disk today → must move to B2; the serve/authorization checks above must be preserved, including the serve-doc filename-ownership anti-enumeration check and lesson_pdf enrollment gate.
- Small uploads keep full `scanUploadedFile` parity (magic bytes, MIME allowlist, malicious pattern scan, size cap, logging).
