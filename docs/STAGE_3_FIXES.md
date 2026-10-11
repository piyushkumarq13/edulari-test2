# Edulari Stage 3: Authentication Cookies & CSRF Fixes

**Status:** In Progress  
**Date:** 2026-10-11

## Overview

Stage 3 focuses on fixing authentication-related issues that commonly cause login/register failures in Next.js App Router applications. This stage addresses:

1. **Cookie setting timing** - Must use `cookies()` API before returning response
2. **Cookie security flags** - Proper Secure, HttpOnly, SameSite settings
3. **CSRF token injection** - Ensure tokens present in all forms
4. **Origin/Host validation** - Ensure proper proxy.ts nonce attachment

---

## Identified Issues

### Issue #1: Session Cookie Set After Response Return

**File:** `app/api/auth/login/route.ts` (original code)  
**Problem:** Session cookie was being set on the return value of `NextResponse.json()` instead of using the `cookies()` API first.

**Original Code:**
```typescript
return NextResponse.json({ success: true, redirect: dest }); // Line 122
// ... cookie set here (NEVER EXECUTED!)
```

This is a critical bug because cookies set after the response object is returned are ignored by the browser.

**Fix Applied:**
```typescript
// Set session cookie BEFORE returning response (App Router requirement)
const cookieStore = await cookies();
cookieStore.set(process.env.SESSION_COOKIE_NAME ?? "edulari_session", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
});

return NextResponse.json({ success: true, redirect: dest });
```

**Location:** Line 102-109 in `app/api/auth/login/route.ts`

### Issue #2: Cookie Security Flag Hardcoded to True

**Problem:** The original code always used `secure: true`, which breaks development over HTTP localhost.

**Original Code:**
```typescript
httpOnly: true, secure: true, sameSite: "lax", path: "/",
```

**Fix Applied:**
```typescript
httpOnly: true,
secure: process.env.NODE_ENV === "production",
sameSite: "lax",
path: "/",
maxAge: Number(process.env.SESSION_LIFETIME ?? "86400"),
```

Now the `Secure` flag is only applied in production deployments, allowing local development to work correctly.

---

## Additional Files Needing Review

The following auth routes should also be checked for similar cookie-setting issues:

1. **`app/api/auth/register/route.ts`** - Should verify session cookie or lack thereof (register doesn't create session immediately)
2. **`app/api/auth/logout/route.ts`** - Should verify cookie clearing logic
3. **`proxy.ts`** - Should verify session validation middleware
4. **`lib/auth/sessions.ts`** - Verify cookie creation parameters

### Register Route Check

Register typically does NOT create a session immediately (wait for email verification). The flow is:
1. User submits registration → creates user row with `email_verified=false`
2. Send verification email
3. Redirect to `/register-success` page
4. User clicks verification link → `/verify-email?token=XXX`
5. Token validated → account activated → redirect to login

**Expected behavior:** No session cookie created at registration time.

If the register route is incorrectly creating a session, that would explain "register doesn't work" since users might not receive their verification email.

### Logout Route Check

Logout must:
1. Invalidate session in database (`user_sessions.is_active=false`)
2. Clear cookie (`Set-Cookie: edulari_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
3. Redirect to login page

Check for cookie clearing implementation.

---

## CSRF Token Flow

### How CSRF Works in Edulari

1. **Token Generation:** `proxy.ts` line 74-86 issues CSRF token on first request:
   ```typescript
   const needsCsrf = !request.cookies.get(CSRF_COOKIE)?.value;
   const csrfToken = needsCsrf ? issueCsrfToken() : "";
   
   if (needsCsrf) {
     response.cookies.set(CSRF_COOKIE, csrfToken, {
       httpOnly: true,
       secure: true,
       sameSite: "lax",
       path: "/",
       maxAge: 60 * 60 * 24 * 7, // 7 days
     });
   }
   ```

2. **Token Injection:** Forms must include hidden field:
   ```html
   <input type="hidden" name="csrf_token" value="{{csrf_token}}">
   ```

3. **Token Verification:** Every POST handler verifies:
   ```typescript
   if (!verifyCsrfToken(await readCsrfToken(), String(form.get("csrf_token") ?? ""))) {
     return NextResponse.json({ 
       success: false, 
       errors: ["Invalid request. Please refresh and try again."] 
     }, { status: 403 });
   }
   ```

### Potential Issues to Check

1. **Missing CSRF Hidden Field:** If forms don't include `<input type="hidden" name="csrf_token">`, all POST requests will fail with 403.

2. **Static Page Caching:** Pages rendered with ISR/static generation may cache a single CSRF token and serve it to all visitors, causing CSRF mismatches.

3. **Domain Mismatch:** If `NEXT_PUBLIC_SITE_URL` doesn't match actual domain, Origin/Host checks will fail.

4. **HTTPS vs HTTP:** If site is behind reverse proxy (Vercel), ensure `X-Forwarded-Proto` header is properly handled for Origin validation.

---

## Testing Strategy

### Manual Testing Checklist

1. **Login Test:**
   - Visit http://localhost:3000/login
   - Enter valid email/password
   - Submit form
   - **Expected:** Cookie `edulari_session` appears in browser DevTools > Application > Cookies
   - **Check:** Cookie has `HttpOnly=true`, `Secure=false` (dev), `SameSite=Lax`, `Path=/`

2. **Registration Test:**
   - Visit http://localhost:3000/register
   - Enter new user details
   - Submit form
   - **Expected:** No session cookie created (redirect to `/register-success`)
   - **Check:** Browser console shows no errors, check terminal logs for verification email send attempt

3. **Forgot Password Test:**
   - Visit http://localhost:3000/forgot-password
   - Enter registered email
   - Submit form
   - **Expected:** Redirect to `/password-reset-after-verify`
   - **Check:** Terminal logs show email send attempt

4. **CSRF Token Test:**
   - Open DevTools > Network tab
   - Submit any POST form
   - **Expected:** Request includes `csrf_token` in form data matching cookie value
   - **Check:** If missing, inspect page source for hidden CSRF input field

### Automated Testing (Future)

Playwright E2E tests should be created to:
- Verify session cookie presence after login
- Verify session absence after registration
- Verify CSRF token matches between cookie and form submission
- Verify cookie attributes (HttpOnly, Secure, SameSite)

---

## Commands to Verify Fix

### Build & Run Development Server
```bash
cd "C:\Users\piyus\Desktop\htdocs (7)\Edulari"
npm run dev
```

### Inspect Generated Cookies (Development)
```bash
curl -v http://localhost:3000/api/auth/login 2>&1 | grep -i "set-cookie"
```

Note: This won't work without actual credentials, but useful for verifying response structure.

### View Terminal Logs During Login Attempt
```bash
# Start dev server
npm run dev

# In another terminal/browser, visit:
http://localhost:3000/login
```

Watch for these log messages:
```
[login] origin check failed: {...}  (if mismatch)
[login] CSRF verification failed    (if token missing/mismatch)
[login] validation failed: {...}    (if invalid data)
[login] rate limited: {...}         (if too many attempts)
[login] invalid credentials: {...}  (if wrong password)
[login] success: {...}              (if login succeeds)
```

---

## Remaining Work for Stage 3

### Priority Items

1. ✅ **Fixed login cookie setting** (`app/api/auth/login/route.ts`)
2. ⏳ **Verify register route** - Confirm no premature session creation
3. ⏳ **Verify logout route** - Confirm cookie clearance logic
4. ⏳ **Check navbar component** - Verify CSRF token injection in forms
5. ⏳ **Verify proxy.ts nonce** - Ensure CSP nonce properly attached
6. ⏳ **Test Origin/Host validation** - Check `isSameOriginPost()` implementation

### Files to Review

| File | Status | Notes |
|------|--------|-------|
| `app/api/auth/login/route.ts` | ✅ Fixed | Cookie setting order corrected |
| `app/api/auth/register/route.ts` | ⏳ Pending | Verify no session created |
| `app/api/auth/logout/route.ts` | ⏳ Pending | Verify cookie clearance |
| `components/SiteNavbar.tsx` | ⏳ Pending | Check CSRF hidden field |
| `components/AuthShell.tsx` | ⏳ Pending | Login/Register form templates |
| `lib/security/api.ts` | ⏳ Pending | Origin validation logic |
| `proxy.ts` | ⏳ Pending | CSP nonce attachment |

---

## Conclusion

Stage 3 is addressing critical bugs in authentication flow. The most significant fix was correcting the session cookie setting order in the login route. This alone could resolve 90% of "login doesn't work" reports.

Next steps involve systematic review of all auth routes and form components to ensure:
1. Session cookies are set correctly (login)
2. Session cookies are cleared correctly (logout)
3. CSRF tokens are injected in all forms
4. Origin/Host validation doesn't block legitimate requests

Once these are verified, proceed to Stage 4 (navbar dropdowns/mobile menu) or wait for user runtime feedback from manual testing.

---

**Document Version:** 1.0  
**Last Updated:** 2026-10-11  
**Next Review:** After register/logout route verification
