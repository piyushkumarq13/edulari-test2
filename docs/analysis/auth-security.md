# Auth & Security Spec (auth-security.md)

Source files read in full: `private/auth.php` (1137 lines), `private/bootstrap.php`, `private/password_reset.php`, `private/oauth.php`, `private/functions/token_cleanup.php`, `public/login.php`, `public/register.php`, `public/forgot-password.php`, `public/reset-password.php`, `public/verify-email.php`, `public/logout.php`, `public/auth/google/callback.php`, `public/auth/github/callback.php`. Constants verified in `private/config.php`.

## Constants (private/config.php)

- `VERIFY_TOKEN_EXPIRY_MINS = 30` — email verification token lifetime, minutes.
- `PASSWORD_RESET_EXPIRY_MINS = 60` — password reset token lifetime, minutes.
- `ROLE_ADMIN = 'admin'`, `ROLE_STUDENT = 'student'`, `ROLE_INSTRUCTOR = 'instructor'`.
- `SITE_URL = 'https://edulari.zya.me'`, `SITE_NAME = 'Edulari'`, `ADMIN_EMAIL`.
- `GOOGLE_REDIRECT_URI = SITE_URL . '/auth/google/callback'`, `GITHUB_REDIRECT_URI = SITE_URL . '/auth/github/callback'`.

## bcrypt / password hashing

- Registration: `password_hash($password, PASSWORD_DEFAULT)` — auth.php:65. At PHP time this is bcrypt `$2y$` at cost 10 (default). No custom `HASH_COST` anywhere; cost is PHP's default.
- Login verify: `password_verify($password, $user['password'])` — auth.php:227. Handles `$2y$` natively, so existing PHP hashes verify directly.
- Reset: `password_hash($newPassword, PASSWORD_DEFAULT)` — password_reset.php:194.
- Password policy (register.php:42-47, reset-password.php:37-44): min 8 chars, at least one digit (`/[0-9]/`), at least one letter (`/[a-zA-Z]/`), must match confirm field.

## Session cookie (private/bootstrap.php:15-29)

`session_set_cookie_params` array form, all attributes set atomically:

- `lifetime = 86400` (24h)
- `path = '/'`
- `domain = ''` (current host only)
- `secure = true` (HTTPS only)
- `httponly = true`
- `samesite = 'Lax'`

Plus `session.use_only_cookies = 1`, `session.gc_maxlifetime = 86400`, then `session_start()`.

## Session fixation

`session_regenerate_id(true)` called on: successful password login (auth.php:277), OAuth session start (`_oauthStartSession`, auth.php:1123), account-recovery email verification (verify-email.php:52).

## Security headers (bootstrap.php:31-52)

Sent on every request when session starts:
- HSTS `max-age=31536000; includeSubDomains; preload` only when `$_SERVER['HTTPS']` set and not 'off'.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`.
- Per-request CSP with a fresh nonce (`base64_encode(random_bytes(16))`, defined as `CSP_NONCE`):
  - `default-src 'self'`
  - `script-src 'self' 'nonce-...' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://checkout.razorpay.com https://cdn.sheetjs.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`
  - `font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`
  - `img-src 'self' data: https:`
  - `connect-src 'self' https://api.razorpay.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://github.com https://api.github.com`
  - `frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`

blourAll inline `<script>` blocks on pages use `nonce="<?= CSP_NONCE ?>"`.

## createUserSession (auth.php:818-853)

- Token: `bin2hex(random_bytes(32))` → 64-char hex string.
- Kicks (deactivates) ALL active sessions for the user: `UPDATE user_sessions SET is_active = 0, kicked_reason = ? WHERE user_id = ? AND is_active = 1` with the passed `$kickedReason` (default `'new_login'`).
- Rolling window: fetches all session rows `ORDER BY created_at DESC`; if `count >= 5`, deletes everything from index 4 onward (keeps 4 newest) via `DELETE FROM user_sessions WHERE id = ?`. Then inserts the new row, so max 5 rows remain.
- Insert: `INSERT INTO user_sessions (user_id, session_token, ip_address, device_info, created_at, last_active, is_active) VALUES (?, ?, ?, ?, NOW(), NOW(), 1)`.
- Columns in use: `id, user_id, session_token, ip_address, device_info, created_at, last_active, is_active, kicked_reason, expires_at` (expires_at read in requireLogin; not set by createUserSession in the PHP code — see Open questions).
- `$_SESSION` fields set by callers: `user_id, user_name, user_email, user_role, logged_in=true, session_token`.
- `kicked_reason` values observed in code: `'new_login'` (default), `'oauth_login'` (auth.php:1129), `'password_changed'` (auth.php:885, password_reset.php:210), `'manual_logout'` (auth.php:401, 929, 946), `'session_expired'` (auth.php:494), `'account_blocked'`, `'email_unverified'` (auth.php:521).

## updateSessionLastActive (auth.php:859-863)

`UPDATE user_sessions SET last_active = NOW() WHERE session_token = ?` on every validated request inside `requireLogin()`.

## requireLogin flow (auth.php:447-543) — exact order

1. If not logged in → `Location: /login`, exit.
2. If `$_SESSION['session_token']` or `$_SESSION['user_id']` missing → destroy session, redirect `/login?reason=session_expired`.
3. DB lookup: `SELECT id, is_active, kicked_reason, expires_at FROM user_sessions WHERE session_token = ? AND user_id = ?`.
4. If no row or `is_active !== 1` → reason = `kicked_reason` if set else `'session_expired'`; destroy session, clear cookie, redirect `/login?reason=<reason>`.
5. Hard expiry: if `expires_at` non-empty and past → set `is_active=0, kicked_reason='session_expired'`, destroy, redirect `/login?reason=session_expired`.
6. Live user re-check: `SELECT is_active, role, email_verified FROM users WHERE id = ?`. If user missing/`is_active !== 1` → reason `'account_blocked'`; elseif `email_verified !== 1` → reason `'email_unverified'`; kill session row (`is_active=0, kicked_reason=reason`), destroy, redirect with that reason.
7. Role sync: if `$_SESSION['user_role'] !== liveUser.role`, overwrite session role from DB (login.php maps `?reason=role_changed` message; PHP sets it via the kicked_reason only when session invalid — note: role change alone does NOT kick, it only syncs the session value).
8. `updateSessionLastActive($token)`.

## Logout (auth.php:396-415, public/logout.php)

- `logoutUser()`: if session token+user_id present, `UPDATE user_sessions SET is_active=0, kicked_reason='manual_logout' WHERE session_token = ? AND user_id = ?`; then `$_SESSION = []`, `session_destroy()`, clear cookie via `setcookie(session_name(), '', time()-42000, path, domain, secure, httponly)` using `session_get_cookie_params()`.
- `logout.php` REQUIRES `POST` + `verifyCSRFToken($_POST['csrf_token'])`, else HTTP 405 + redirect `/dashboard`. This blocks logout CSRF.

## Session history helpers (auth.php:907-950)

- `getUserSessions($userId)` — last 5 rows newest-first (id, session_token, ip_address, device_info, created_at, last_active, is_active, kicked_reason).
- `logoutAllOtherSessions($userId, $currentToken)` — `is_active=0, kicked_reason='manual_logout'` for all except current token.
- `logoutSpecificSession($sessionId, $userId)` — same reason, single row, ownership-checked by user_id.

## Password-change session rotation (auth.php:880-889)

`regenerateSessionOnPasswordChange($userId)` — calls `createUserSession(...,'password_changed')` (kicks all others including old token of current device, inserts fresh row), then syncs new token into `$_SESSION['session_token']` so the current device stays logged in. Used on in-session password change pages. Email-link reset flow (`resetPassword`) instead kicks ALL sessions with reason `'password_changed'` and creates none (password_reset.php:208-213).

## Login flow (loginUser, auth.php:207-305) — exact order

1. `checkLoginBlock($email, $ip)` → if blocked return `['blocked'=>true,'time_remaining','readable_time']`.
2. `SELECT * FROM users WHERE email = ?`. Not found → `recordFailedLoginAttempt`, return "Invalid email or password."
3. `password_verify` fails → record attempt, same generic message. (Password verified BEFORE checking email_verified, so the error doesn't reveal verification state.)
4. `email_verified == 0` → `['unverified'=>true,'email','message']` (message: "Please verify your email address before logging in...").
5. `is_active == 0` branches:
   - role instructor: latest `instructor_applications` row by `submitted_at DESC`:
     - status `'rejected'` → "Your instructor application has been rejected. Please contact support or reapply."
     - `block_reason === 'admin_blocked'` → "Your instructor account has been suspended. Please contact support."
     - no app or status `'draft'` → `['incomplete_instructor'=>true,'user_id']` (login.php calls `resumeInstructorRegistration(user_id)` and redirects to `/instructor-register/step-N`; else error "We couldn't resume your instructor registration...").
     - else → "Your instructor application is under review. You will receive an email once it is approved."
   - else if `block_reason === 'admin_blocked'` → "Your account has been suspended by an administrator. Please contact support."
   - else → "Your account has been deactivated. Please contact support."
6. Success: `resetLoginAttempts($email,$ip)`; `UPDATE users SET last_login = NOW()`; `session_regenerate_id(true)`; compute `$deviceInfo = getDeviceInfo()`; known-device check; `$newToken = createUserSession($userId, $ip, $deviceInfo, 'new_login')`; populate `$_SESSION` (user_id, user_name, user_email, user_role, logged_in, session_token).
7. New-login notification: send `sendNewLoginNotificationEmail(...)` ONLY IF `$user['last_login'] !== null` (not first-ever login) AND device not known. Suppressed for first login and for devices seen within the last 30 days with same `ip_address` + `device_info` (auth.php:281-287 query: `created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`).

## Login rate limiting (auth.php:311-390)

- Table `login_attempts`: `identifier` (email or IP string), `type` ('email'|'ip'), `attempt_count`, `last_attempt`, `is_blocked`, `block_expires`.
- `recordFailedLoginAttempt($email,$ip)`: for each of email+ip rows, increment count; when `attempt_count >= 5` set `is_blocked=1`, `block_expires = now + 7200` (2 hours). Insert row if missing.
- `checkLoginBlock`: for email row then ip row where `is_blocked=1`: if `block_expires > now` → blocked with `time_remaining` and `formatTimeRemaining`; else reset (`is_blocked=0, attempt_count=0`) and continue.
- `resetLoginAttempts($email,$ip)` on successful login: sets both email and ip rows `attempt_count=0, is_blocked=0, block_expires=NULL`.
- `formatTimeRemaining($s)` (auth.php:341): `"X hours Y minutes"` / `"X minutes Y seconds"` / `"Y seconds"` with proper pluralization.
- login.php also pre-checks `checkLoginBlock($_POST['email'], $_SERVER['REMOTE_ADDR'])` before rendering.

## Registration + registration_blocks (auth.php:576-649, public/register.php)

- Password rule (register.php:42-47): ≥8 chars, ≥1 digit, ≥1 letter, confirm match.
- `registerUser` (auth.php:18-89):
  - validates name/email non-empty, `FILTER_VALIDATE_EMAIL`, email length ≤ 254.
  - Existing user + `email_verified = 0` → logs `ACCOUNT_RECOVERY_ATTEMPT`, returns `['redirect_to_activation'=>true,'email'=>...]` (NO new account, NO delete).
  - Existing verified email → "Email address is already registered."
  - Else insert user: `role=ROLE_STUDENT, registration_date=NOW(), email_verified=0, ip_address=$ip`, password hashed PASSWORD_DEFAULT.
  - `generateAndSendVerificationEmail`; on failure rolls back by `DELETE FROM users WHERE id = ?` and returns the mail error.
- `recordRegistrationAttempt($ip)` (auth.php:611): per-IP row in `registration_blocks` (`ip_address, attempt_count, first_attempt, is_blocked, block_expires`). If `first_attempt` older than 86400s → reset counter to 1. Else if new count `>= 5` → `is_blocked=1, block_expires = now + 86400` (24h), log `REGISTRATION_BLOCKED`. Else increment.
- `checkRegistrationBlock($ip)` (auth.php:576): deletes `is_blocked=1 AND block_expires < NOW()` rows first; if active block → blocked with `readable_time`; expired block → reset.
- On success register.php: `recordRegistrationAttempt($clientIp)`, `$_SESSION['registered_email'] = $email`, redirect `/register-success`.
- Existing-unverified branch: `recordAccountRecoveryAttempt($clientIp, $email)`, stores `$activationToken = bin2hex(random_bytes(16))` in `$_SESSION['activation_tokens'][$activationToken] = ['email','expires'=>time()+1800]`, redirect `/account-activation?token=<token>` (30-minute window).

## Email verification (auth.php:96-195)

- Token: `bin2hex(random_bytes(32))` (64 hex chars). Expiry: `time() + VERIFY_TOKEN_EXPIRY_MINS*60` = 30 minutes.
- Upsert: if a row exists for `user_id` in `email_verification_tokens`, UPDATE token/expires_at/created_at; else INSERT.
- Verify URL: `SITE_URL . '/verify-email?token=' . urlencode($token)`.
- `verifyEmailToken($token)` (auth.php:133): FIRST deletes expired rows; lookup by token; if none → `'invalid'`. Otherwise: `UPDATE users SET email_verified=1`, delete token row, fetch name+email and send `sendWelcomeEmail`, return `['success'=>true,'user_id'=>...]`. **Note: it never actually returns the string `'expired'`** — see Open questions.
- `resendVerificationEmail($email)` (auth.php:170): if no unverified user → return true (no enumeration). If a token row with `expires_at > NOW()` exists, resend the SAME token/URL. Else generate new token and send.
- verify-email.php behavior: does NOT auto-login (comment explains previous auto-login bugs); sets no session for normal users. For `is_recovery_mode=1` users or `$_SESSION['is_account_recovery']`, destroys session, `session_start()`, `session_regenerate_id(true)`, sets `$_SESSION['user_awaiting_password_reset']=$userId, user_email_verified=true, is_account_recovery=true`, logs `ACCOUNT_RECOVERY_EMAIL_VERIFIED`, redirect `/password-reset-after-verify`. Instructor role → status `instructor_pending` ("pending admin review", 2-3 business days). Otherwise status `success` with "Go to Login".
- Does NOT unset `$_SESSION['registered_email']` (register-success.php polling relies on it).
- Logs: `EMAIL_VERIFICATION_ATTEMPTED`, `CLEARING_SESSION_FOR_ACCOUNT_RECOVERY`, `ACCOUNT_RECOVERY_EMAIL_VERIFIED`, `NEW_USER_EMAIL_VERIFIED`.

## Forgot / reset password (private/password_reset.php, public pages)

- `requestPasswordReset($email,$ip)` (password_reset.php:12): `cleanupExpiredResetTokens()`; if rate-limited → return true silently; if no user → return true (no enumeration); `recordPasswordResetAttempt` BEFORE send; token `bin2hex(random_bytes(32))`, expiry `PASSWORD_RESET_EXPIRY_MINS` = 60 min; upsert into `password_resets` on `user_id` (one row per user); email `SITE_URL . '/reset-password?token='`; mail failure → error_log, still return true.
- Rate limit (password_reset.php:88-110): `password_reset_attempts` table rows `(identifier,type,attempt_at)`; max 3 per email identifier AND max 3 per ip identifier within last 600s. Both counted. `recordPasswordResetAttempt` inserts one 'email' and one 'ip' row and deletes rows older than 3600s.
- `verifyPasswordResetToken($token)` (password_reset.php:61): cleanup expired; join password_resets→users; if not found false; if `date('Y-m-d H:i:s') > expires_at` → delete row, false; else `['user_id','name','email']`.
- `resetPassword($token,$newPassword)` (password_reset.php:188): verify; hash with PASSWORD_DEFAULT; UPDATE users.password; **invalidate ALL active sessions** (`is_active=0, kicked_reason='password_changed'`); delete all `password_resets` rows for user; return true. Token is single-use (deleted).
- reset-password.php page: if logged in → redirect `/`; verifies token; on POST validates CSRF, min 8 chars, digit, letter, match; success → `/reset-password?success=1`.
- forgot-password.php: CSRF check, redirect `/forgot-password?success=1` always. UI copy claims "Links expire after 30 minutes" but constant is 60 — see Open questions.
- `adminTriggerPasswordReset($userId,$adminId)` (password_reset.php:138): token + upsert + send with `true` flag (admin variant), audit via error_log "AUDIT: admin {name} (ID) triggered password reset for user ID X from REMOTE_ADDR".
- `cleanupExpiredResetTokens()`: `DELETE FROM password_resets WHERE expires_at < NOW()`.

## Account recovery rate limiting (auth.php:708-789)

- `checkAccountRecoveryBlock($ip)`: deletes `is_blocked=1 AND block_expires<NOW()`; active block → `['blocked'=>true,'time_remaining','readable_time']`; expired → reset.
- `recordAccountRecoveryAttempt($ip,$email)`: per-IP `account_recovery_attempts` (`ip_address, attempt_count, first_attempt, is_blocked, block_expires`). Window = 3600s. If `first_attempt` older than 1h → reset to 1. If count `>= 10` → block for 1800s (30 min), log `ACCOUNT_RECOVERY_BLOCKED` with reason 'Rate limit exceeded'.

## OAuth 2.0 (private/oauth.php, auth.php:956-1137, callbacks)

- No PKCE anywhere in the PHP code — only `state` for CSRF.
- `oauthHttpRequest($url,$data,$headers)`: cURL POST (http_build_query) when `$data` non-empty else GET; `CURLOPT_TIMEOUT=15`, SSL verify peer+host=2, no redirects, JSON decode; null on any error.
- Google:
  - `getGoogleOAuthUrl($state)`: `https://accounts.google.com/o/oauth2/v2/auth?` with `client_id, redirect_uri, response_type=code, scope='openid email profile', state, access_type=online, prompt=select_account`.
  - `exchangeGoogleCode($code)`: POST `https://oauth2.googleapis.com/token` with code/client_id/client_secret/redirect_uri/grant_type=authorization_code → access_token; GET `https://www.googleapis.com/oauth2/v3/userinfo` with Bearer → requires `sub`, `email`, and **truthy `email_verified`**; returns `['id'=>sub, 'email'=>lowercase trimmed, 'name'=>name ?? email, 'avatar'=>picture ?? '']`.
- GitHub:
  - `getGitHubOAuthUrl($state)`: `https://github.com/login/oauth/authorize?` with `client_id, redirect_uri, scope='user:email read:user', state`.
  - `exchangeGitHubCode($code)`: POST `https://github.com/login/oauth/access_token` (Accept: application/json) → access_token; GET `https://api.github.com/user` (Bearer + `User-Agent: Edulari-App`); email: if public profile email present use it, else GET `/user/emails` and pick first entry with `primary && verified`; fail if none. name = `name ?? login ?? email`. Returns `['id'=>profile id, email, name, avatar=>avatar_url]`.
- State handling (login.php:125-129, register.php:80-84): one `$_SESSION['oauth_state']` (bin2hex(random_bytes(16))) created if empty, reused across Google & GitHub buttons and page refreshes. Callbacks (`public/auth/google/callback.php`, `public/auth/github/callback.php`): `unset($_SESSION['oauth_state'])` (single-use), require `hash_equals($expected, $returned)` else `oauthError("Authentication failed. Please try again.")`; `?error=access_denied` → silent redirect /login; missing code → error; success → `loginOrRegisterOAuthUser(provider, id, email, name, avatar, ip)` → `redirectBasedOnRole()`.
- Callback error display: stores `$_SESSION['oauth_error']` (shown once on login.php/register.php), redirects /login. Already-logged-in → `redirectBasedOnRole()`.
- `loginOrRegisterOAuthUser($provider,$providerId,$email,$name,$avatarUrl,$ip)` (auth.php:979-1108):
  1. Returning user (`oauth_provider=? AND oauth_id=?`): if `is_active !== 1` → log `OAUTH_LOGIN_BLOCKED_INACTIVE`, return suspended message; update last_login + avatar_url; `_oauthStartSession($user,$ip)`; log `OAUTH_LOGIN_SUCCESS`; true.
  2. Email exists & unverified → log `OAUTH_EMAIL_LINK_BLOCKED_UNVERIFIED`; refuse with "An unverified account exists with this email..." (anti-hijack).
  3. Email exists & verified & active → link: `UPDATE users SET oauth_provider, oauth_id, avatar_url, last_login=NOW()`; `_oauthStartSession`; log `OAUTH_ACCOUNT_LINKED`; true.
  4. Email exists & inactive → `OAUTH_EMAIL_LINK_BLOCKED_INACTIVE`, suspended message.
  5. New user → INSERT with `password=NULL, role=ROLE_STUDENT, email_verified=1, registration_date=NOW(), ip_address`; send welcome email (try/catch, failure does NOT roll back); log `OAUTH_NEW_USER_REGISTERED`; `_oauthStartSession`; true.
- `_oauthStartSession($user,$ip)` (auth.php:1121-1137): `session_regenerate_id(true)`; `createUserSession($user['id'],$ip,getDeviceInfo(),'oauth_login')`; sets the same `$_SESSION` keys as loginUser. Note: NO last_login-first-login check and NO new-login notification email for OAuth logins, and NO device-known check — unlike loginUser.

## CSRF

- `generateCSRFToken()` (auth.php:565-570): creates `bin2hex(random_bytes(32))` once per session, reuses while set.
- `verifyCSRFToken($token)` (auth.php:560-563): returns false if no session token; else `hash_equals($_SESSION['csrf_token'], $token)`.
- Required on: login POST, register POST, logout POST (405 if fail), forgot-password POST, reset-password POST, resend verification POST.

## Role helpers & redirects (auth.php:442-558)

- `getUserRole()` → `$_SESSION['user_role'] ?? null`; `isAdmin/isStudent/isInstructor` check `isLoggedIn() && role === ROLE_*`; `hasRole($role)` same.
- `requireLogin()` (above), `requireRole($role)` → requireLogin then if session role !== role → `redirectBasedOnRole()`.
- `redirectBasedOnRole()`: admin → `/admin/dashboard`; instructor → `/instructor/dashboard`; default (student) → `/index.php`.
- `getCurrentUser()` returns id/name/email/role/profile_image (profile_image cached statically per request).
- `getStudentProfile($userId)`, `hasCompletedProfile($userId)` (reads `users.profile_completed`).

## IP / device helpers (auth.php:651-675, 799-802)

- `getClientIpAddress()`: `$trustedProxies` array is EMPTY by default (documented for Cloudflare/own LB). X-Forwarded-For is used ONLY if the request's REMOTE_ADDR is exactly in `$trustedProxies` (strict `in_array`, no CIDR matching); then takes the RIGHTMOST forwarded entry, validated as IP. Otherwise falls back to REMOTE_ADDR (validated, else '0.0.0.0').
- `getDeviceInfo()`: `$_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'`, truncated to 255 chars.
- NOTE: `loginUser`/`logout`/`refresh` in login.php use `$_SERVER['REMOTE_ADDR']` directly for login attempts + session IP, NOT `getClientIpAddress()`. Only register/forgot/OAuth use `getClientIpAddress()`.

## Token cleanup (private/functions/token_cleanup.php)

- `cleanupExpiredTokens($force=false)`: throttled to once per 21600s (6h) via `PRIVATE_PATH/.token_cleanup_last_run` file mtime; `$force=true` bypasses. On run, deletes:
  - `test_tokens` where `expires_at < NOW() OR used = 1`
  - `test_failures` where `retry_after < NOW()`
  - `email_verification_tokens` where `expires_at < NOW()`
  - `password_resets` where `expires_at < NOW()`
  - `login_attempts` where `block_expires IS NOT NULL AND block_expires < NOW()` OR (`is_blocked=0 AND last_attempt < NOW() - INTERVAL 30 DAY`)
- Called on every login.php load (token_cleanup.php included, line 15). Throttle file moved to `cron_state` in the new app per AGENTS.md §9.

## logSecurity usage (events observed)

`ACCOUNT_RECOVERY_ATTEMPT` (existing unverified email at register), `REGISTRATION_BLOCKED`, `ACCOUNT_RECOVERY_BLOCKED`, `EMAIL_VERIFICATION_ATTEMPTED`, `CLEARING_SESSION_FOR_ACCOUNT_RECOVERY`, `ACCOUNT_RECOVERY_EMAIL_VERIFIED`, `NEW_USER_EMAIL_VERIFIED`, `OAUTH_LOGIN_SUCCESS`, `OAUTH_LOGIN_BLOCKED_INACTIVE`, `OAUTH_ACCOUNT_LINKED`, `OAUTH_EMAIL_LINK_BLOCKED_UNVERIFIED`, `OAUTH_EMAIL_LINK_BLOCKED_INACTIVE`, `OAUTH_NEW_USER_REGISTERED`. Implementation of `logSecurity` lives elsewhere (writes to `private/logs/security.log`, to become `security_events` table).

## Emails (senders, all via private/email/email_senders.php — read in a later phase)

`sendVerificationEmail`, `sendWelcomeEmail`, `sendNewLoginNotificationEmail`, `sendPasswordResetEmail` (admin variant passes `true`).

## Open questions

1. `verifyEmailToken()` (auth.php:94-161) can never return the string `'expired'` — it only returns `'invalid'` or `['success'=>true,...]`. Yet verify-email.php:94 checks `$result === 'expired'` to render the "Link expired" state. That branch is dead code in the PHP; decide whether to reproduce the dead branch or implement a real expiry check in the port.
2. `user_sessions.expires_at` is read in requireLogin (auth.php:467, 492) but nothing in auth.php or password_reset.php ever sets it — sessions may live forever except via kick. Need to confirm where (if anywhere) `expires_at` is populated in the PHP schema/admin code.
3. `users.blocked`/`block_reason` values: only `'admin_blocked'` is handled explicitly in loginUser; `is_active=0` with other/empty `block_reason` produces the generic "deactivated" message. Confirm the full set of block reasons admin UI can write.
4. `?reason=role_changed` is mapped to a message in login.php:49 but requireLogin never sets `kicked_reason='role_changed'` — it only syncs the role silently. Possibly dead/vestigial; confirm intended behavior.
5. Session lifetime: cookie `lifetime=86400` and `gc_maxlifetime=86400`, but `user_sessions` rows have no hard expiry set (expires_at always NULL from the code paths read) — effectively sessions persist until kicked or browser discards cookie; PHP session store GC may also expire. Confirm intended max session age.
6. forgot-password.php UI text says reset links expire after 30 minutes, but `PASSWORD_RESET_EXPIRY_MINS = 60`. UI copy vs code mismatch.
7. login.php uses raw `$_SERVER['REMOTE_ADDR']` for login-attempt keys and session IP, while other pages use `getClientIpAddress()`. Trusted proxies therefore don't apply to login rate-limiting/self-refresh. Confirm this is intended.
8. GitHub `name` falls back `name ?? login ?? email` then `?: $email` — fine; but if `profile.email` is unverified (public but unverified), GitHub flow trusts it without a `verified` check, unlike Google which requires `email_verified`. Possible security inconsistency in the PHP; do not weaken in the port — flag it.
9. `resendVerificationEmail` and registration-block logic differ per table (`registration_blocks` window 24h/5, `account_recovery_attempts` window 1h/10) — values confirmed from code (auth.php:620,755,763,630,765).
10. `checkLoginBlock` is checked again on POST in login.php before rendering, and `loginUser` checks it first — double invocation is redundant but harmless.
