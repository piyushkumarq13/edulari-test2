# Phase 7 spec — Instructor part 1: registration wizard + competency test

Scope per the user. Old PHP root: `C:\Users\piyus\Desktop\htdocs (7)\htdocs`.

## Files to port

| PHP | Role |
|---|---|
| `public/instructor-register/index.php` | redirect dispatcher |
| `public/instructor-register/_init.php` | shared initialiser (maintenance, redirects, session, CSRF, step labels, `old()`) |
| `public/instructor-register/_layout_top.php` | DOCTYPE/head + step-aware left panel + stepper + error alert |
| `public/instructor-register/_layout_bottom.php` | closing markup + all shared wizard JS |
| `public/instructor-register/step-1.php` … `step-8.php` | the 8 wizard steps |
| `public/instructor-register-success.php` | post-submission confirmation |
| `public/test/index.php` | competency test (intro → details → test → result) |
| `private/functions/instructor_registration.php` | save/approve/reject/draft/resume/cleanup/purge |
| `private/api/test_token.php` | token create/validate/consume/markStarted/saveAnswers/score/block |
| `private/api/ai_questions.php` | question generation (prompt + 3 providers + JSON parser) |
| `private/functions/token_cleanup.php` | expired-token deletion |

## Migration fix required first

`db/migrations/007_instructor_registration.sql` line 32 restricts
`instructor_applications.status` to `('draft','pending','approved','rejected')`, but the PHP
writes `status = 'test_failed'` (`_callback_instructor_registration_fail`,
`findAndScoreAbandonedTestTokens`) and selects it (`purgeRejectedInstructorData`).
Every test-failure insert would raise a CHECK violation. New migration **012**:
add `test_failed` to the CHECK constraint.

## New table (serverless replacement for `$_SESSION`)

The wizard is **anonymous** (no login yet) and keeps all its state in `$_SESSION`.
Serverless has no PHP session store, so a new table holds it, keyed by a random token in an
httpOnly cookie `edulari_reg_session` (SameSite=Lax, Path=/, Secure):

```sql
CREATE TABLE instructor_reg_sessions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token                varchar(64) NOT NULL UNIQUE,
  user_id              bigint REFERENCES users(id) ON DELETE CASCADE,
  step                 smallint NOT NULL DEFAULT 1,
  awaiting_email_verify boolean NOT NULL DEFAULT false,
  resume_user_id       bigint,
  resume_email         varchar(255),
  return_to            smallint,
  app_submitted        boolean NOT NULL DEFAULT false,
  pending_email        varchar(255),
  test_passed          boolean NOT NULL DEFAULT false,
  test_score           smallint,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
```
Wizard draft *content* still lives in `instructor_applications` / `instructor_profiles`
exactly as the PHP does (`saveInstructorDraft` on every step) — only the session pointers move.

## State diagram

```
                 ┌──────────────────────────────────────────────┐
                 │  GET /instructor-register  (index.php)       │
                 │  logged in?  ──yes──▶ redirectBasedOnRole() │
                 │  step = clamp(session.step,1,7)             │
                 └───────────────┬──────────────────────────────┘
                                 ▼  redirect /instructor-register/step-N
   ┌──────────────────────────────────────────────────────────────────────┐
   │ step-1  Account                                                     │
   │  POST ──▶ check_email_verified ─▶ step 2                            │
   │       ──▶ resume_password_submit ─▶ step = resumeInstructorRegistration│
   │       ──▶ cancel_resume                                          │
   │       ──▶ (create) ─▶ users row (role=instructor, email_verified=0,│
   │                       is_active=0) + verification email            │
   │                       ─▶ awaiting_email_verify, step 1             │
   └──────┬───────────────────────────────────────────────────────────────┘
          ▼  (blocked by IP ─▶ "Registration Blocked" card)
   ┌──────────────────────────────────────────────────────────────────────┐
   │ step-2  Profile     save draft(step 2) ─▶ step 3                   │
   │ step-3  Credentials save draft(step 3) ─▶ step 4                   │
   │ step-4  Subjects    save draft(step 4) ─▶ step 5                   │
   │ step-5  Legal       save draft(step 5) ─▶ step 6   (PAN/IFSC enc)  │
   │ step-6  Review  ─continue─▶ step 7                                  │
   │            └─edit_step_N─▶ return_to=6 ─▶ step N (editMode)       │
   │ step 7  Documents  upload govt_id + marksheet (B2 private)         │
   │                     save draft(7) ─▶ step 8                        │
   └──────┬───────────────────────────────────────────────────────────────┘
          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ step-8  Test preview                                                │
   │  POST back ─▶ step 7                                                │
   │  POST start_test:                                                   │
   │    email not verified ─▶ step 1 + awaiting_email_verify             │
   │    test_attempt_started_at set ─▶ live token? resume : error        │
   │    existing started token ─▶ resume that token                      │
   │    else createTestToken() ─▶ /test/?token=…                         │
   └──────┬───────────────────────────────────────────────────────────────┘
          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ /test/?token=T                                                      │
   │  no token ─▶ /                       │
   │  invalid  ─▶ /  (+ test_token_error)                                │
   │  blocked  ─▶ "Access Temporarily Blocked" card                      │
   │  started_at set & expired ─▶ scoreAndFinalizeTest() ─▶ result/fail  │
   │  started_at set & alive ─▶ render from DB                           │
   │  session questions exist ─▶ jump to test                            │
   │  POST go_details ─▶ phase details                                  │
   │  POST go_start ─▶ generateTestQuestions() ─▶ markTestStarted()      │
   │                  ─▶ instructor_applications.test_attempt_started_at  │
   │  POST autosave_answer ─▶ saveTestAnswers() (rate-limited 1/s)       │
   │  POST log_violation ─▶ security_events (JSON-safe)                  │
   │  POST submit_test ─▶ scoreAndFinalizeTest()                         │
   └──────┬───────────────────────────────────────────────────────────────┘
          ▼
   score >= 80 ─▶ saveInstructorApplication() ─▶ admin email ─▶ /instructor-register-success
   score <  80 ─▶ recordTestFailure() + status='test_failed' + docs deleted
                 ─▶ "Test Not Passed" card with 7-day retry date
```

## Guard conditions (every one)

| # | Guard | Behaviour when violated |
|---|---|---|
| G1 | logged-in user hits any wizard URL | `redirectBasedOnRole()` → admin/student dashboard |
| G2 | step-N with `step < N` | redirect to `step-max(1,step)` (cannot jump ahead) |
| G3 | step-1 with `step > 1` | redirect to current step |
| G4 | step-8 with `step < 8` | redirect to `step-max(1,step)` |
| G5 | any POST without valid CSRF | error "Invalid request. Please refresh and try again." |
| G6 | email not verified on steps 2–8 | reset to step 1 + `awaiting_email_verify` |
| G7 | IP block (`test_failures` 7-day) on step 1 | "Registration Blocked" card, no account creation |
| G8 | resume requested but account not resumable | error, clear resume keys, link to /login |
| G9 | step-8 start_test with `test_attempt_started_at` set and no live token | "already completed its one competency test attempt" |
| G10 | `edit_step_N` with N outside 2–5 | ignored (no redirect) |
| G11 | step-7 file: MIME not in {jpeg,png,webp,pdf} or > 5 MB or upload error | per-field error list |
| G12 | `/test` with empty token | redirect `/` |
| G13 | `/test` token invalid/expired/used | redirect `/` + `test_token_error` |
| G14 | `/test` IP/user blocked | "Access Temporarily Blocked" card, no test |
| G15 | `/test` submit_test with no questions | "No questions found. Please go back and try again." |
| G16 | `/test` submit_test token now invalid | "Your test session has expired. Please request a new test link." |
| G17 | autosave: unknown token / bad index / bad option / < 1 s since last | JSON `{ok:false,reason}` |
| G18 | scoring: token already consumed | delete token, return without side effects |

## Step validation rules (server-side, zod)

- **step-1**: name/email/password/confirm required; valid RFC email; passwords match;
  password ≥ 8 chars, ≥ 1 digit, ≥ 1 letter.
  - Existing **verified** user with resumable draft → offer resume (do NOT block).
  - Existing verified user otherwise → "already registered, sign in".
  - Existing unverified user → delete the row + its verification tokens, recreate.
- **step-2**: headline required ≤ 120; bio required ≥ 100.
- **step-3**: highest_education, institution, field_of_study, professional_exp required.
- **step-4**: primary_subject, skill_level, target_audience required; course_ideas ≥ 50.
- **step-5**: all three agreement checkboxes required; unless `skip_payout`:
  PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`, bank_name,
  account_number, account_holder required.
- **step-6**: no field validation; navigation only.
- **step-7**: both documents required unless already saved (filenames persisted).
- **step-8**: no field validation; token lifecycle only.

## Encryption at rest

`pan_number`, `bank_account`, `ifsc_code`, `account_holder`, `upi_id` are encrypted with
`lib/security/crypto.ts` (`aes-256-gcm`, `DATA_ENCRYPTION_KEY`) before being written to
`instructor_applications`, and decrypted only in the admin review screen (Phase 8) and the
instructor's own earnings/payout views. `bank_name` is **not** encrypted (the PHP displays it
unmasked in the review summary). `skip_payout` is not encrypted.

## Documents (B2 private area)

- Prefix `instructor_docs/`, keys `govt_id_<userId>_<16hex>.<ext>` and
  `marksheet_<userId>_<16hex>.<ext>` — same shape as the PHP (`{field}_{userId}_{8hex}.{ext}`).
- Server route with `scanUpload` (magic-byte check via `detectRealMime`), 5 MB cap,
  MIME allow-list `image/jpeg|image/png|image/webp|application/pdf`, then `putObject`.
- Served only through an authenticated, authorised `/api/media?type=instructor_doc&id=…`
  branch (admin in Phase 8; the applicant never re-downloads their own documents — the PHP
  does not serve them back either).
- On approval/rejection the B2 objects are deleted and the DB columns cleared
  (PHP `_deleteInstructorDocs`).

## Time authority

Server clock is the only authority. `started_at`/`expires_at`/`time_taken` are computed with
`now()` in Postgres (the PHP used SQL `NOW()` for exactly this reason). Test TTL 30 min
(`TEST_TOKEN_TTL_MINS`). Note the PHP UI text says "60 minutes" — the port renders the same
text for parity but enforces 30; documented in the report.

## Scoring

`correct` = count of `strtoupper(trim(answers[i])) === questions[i].answer`;
`score = round(correct/total*100)`; pass = `score >= 80` (`TEST_PASS_SCORE`).
Note step-8's static text says "60% or above" while the enforced pass mark is 80 — ported
as-is for parity, documented.

## Emails

Already ported in `lib/email/senders.ts`; called at exactly the PHP points:
- `sendVerificationEmail` — step-1 account creation.
- `sendInstructorApplicationNotification` — test pass → `saveInstructorApplication`.
- `sendInstructorApprovalEmail` / `sendInstructorRejectionEmail` — admin review (Phase 8),
  implemented in `lib/db/instructor-registration.ts` now so the pass path can call them.

## Anti-cheat on the test page

Port the JS module 1:1: fullscreen gate (the only dismissal path), warning overlay with
counter, keydown blocking (F12, Ctrl/Cmd+Shift+I/J/C, Alt+I, Ctrl+C/X/S/A/P/U, Escape),
contextmenu/dragstart/selectstart blocking, window blur/focus (tab switch), visibilitychange,
`getDisplayMedia` patch, devtools size heuristic, one-question-at-a-time navigation with
answers locked on first select, countdown timer that auto-submits, and the violation logger
POSTing to `log_violation` (recorded in `security_events`).

## Route layout

All phase-7 pages are **bare** (no navbar/footer in the PHP). They go in the existing bare
route group alongside the auth pages; `instructor-register-success.php` and `test/index.php`
include `head.php` (font links + base.css) which the root layout already provides.

## Tests (vitest)

- Wizard step guards (G2/G3/G4) and `edit_step_N` bounds (G10).
- Resume rules (`isInstructorRegistrationResumable`) incl. pending/rejected/test_failed not resumable.
- Step validation rules per step (PAN, IFSC, password, lengths).
- Token creation: existing started token returned, unstored row deleted.
- Atomic token consumption: N concurrent consumers → exactly one wins.
- Time authority: time taken derived from `started_at`, never from the client.
- Score calculation: rounding, empty answers, case/whitespace normalisation.
- Block: user OR IP, 7-day window, cleared rows ignored.
- JSON question parser: fence stripping, truncation salvage, option validation.

## Out of scope (Phase 8)

Admin list/approve/reject UI and `serve-doc`; the approval/reject *functions* are ported here
because the test callbacks call them.
