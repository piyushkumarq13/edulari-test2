# Phase 6 — Student part 2: the learning area

Spec written before coding, per AGENTS.md §13. Every PHP file below was read top to
bottom (PHP logic first, then markup) before any of it was ported.

## 1. Scope (PHP sources)

| PHP file | Bytes | Ported to |
|---|---|---|
| `public/student/onboarding.php` | 16 883 | `app/(student)/onboarding/` |
| `public/student/dashboard.php` | 40 328 | `app/(site)/student/dashboard/` |
| `public/student/my-courses.php` | 24 009 | `app/(site)/student/my-courses/` |
| `public/student/learn.php` | 94 661 | `app/(student)/learn/` |
| `public/student/profile.php` | 46 799 | `app/(site)/student/profile/` |
| `public/student/grades.php` | 38 380 | `app/(site)/student/grades/` |
| `public/student/certificates.php` | 15 226 | `app/(site)/student/certificates/` |
| `public/student/generate-certificate.php` | 31 781 | `app/(student)/generate-certificate/` |
| `public/student/schedule.php` | 46 464 | `app/(site)/student/schedule/` |
| `public/student/schedule-api.php` | 7 595 | `app/api/student/schedule/` |
| `public/student/course_ai_chat_api.php` | 11 583 | `app/api/student/course-ai/` |
| `public/course-ai-shared.php` | 5 400 | `app/(student)/course-ai-shared/` |
| `public/assets/js/video-player.js` | 9 040 | already ported in Phase 4 → `components/VideoPlayer.tsx` |
| `public/assets/js/code-highlight.js` | 3 393 | `components/CodeHighlight.tsx` (new, client) |
| `public/assets/js/course-ai.js` | 10 578 | `components/CourseAiChat.tsx` (new, client) |
| `public/assets/css/student/{learn,my-courses,dashboard,profile,grades,certificates,schedule}.css` | — | already copied verbatim in Phase 0 → `styles/css/student/**` |
| `public/assets/css/{markdown-styles,course-ai}.css` | — | already copied verbatim → `styles/css/**` |
| `private/functions/student.php` | 34 680 | `lib/db/*` + `lib/learning/*` (read side) |
| `private/functions/lessons.php` | 6 220 | read side → `lib/db/learning.ts` |
| `private/functions/quizzes.php` | 3 851 | read side → `lib/db/learning.ts` |
| `private/functions/assignments.php` | 1 710 | read side → `lib/db/learning.ts` |
| `private/functions/certificates.php` | 2 929 | `lib/learning/certificates.ts` |
| `private/functions/sections.php` | 2 181 | read side → `lib/db/learning.ts` |

Out of scope but confirmed while reading: `private/functions/{admin,analytics,banners,
courses,instructor_registration,maintenance,markdown,media_urls,notifications,
payment_reconciliation,token_cleanup,upload_security,b2_storage}.php` are already ported
(Phases 3/4/5) or belong to the instructor/admin phases.

## 2. Chrome map (from `npm run php-chrome-map` logic, verified by reading each file)

- navbar + footer: `dashboard.php`, `my-courses.php`, `profile.php`, `grades.php`,
  `certificates.php`, `schedule.php`
- **no chrome at all**: `learn.php` (own `lp-topbar`), `onboarding.php`,
  `generate-certificate.php` (own `<head>`), `course-ai-shared.php`

Therefore: `app/(site)/student/*` for the six chrome pages, `app/(student)/*` for the
four chrome-less ones. `navbar.css` (which declares the global `body { padding-top }`)
stays in `app/(site)/layout.tsx` only.

Stylesheet order per page (base.css from the root layout, then `$extraCss`, then
`navbar.css` last because `navbar.php` emits it from inside `<body>`):

| PHP | `$extraCss` | literal `<link>` in body |
|---|---|---|
| `onboarding.php` | `/assets/css/auth/onboarding.css` | — |
| `dashboard.php` | `../assets/css/student/dashboard.css` | — |
| `my-courses.php` | `../assets/css/student/my-courses.css` | — |
| `learn.php` | `../assets/css/student/learn.css` | `/assets/css/markdown-styles.css`, `/assets/css/course-ai.css` |
| `profile.php` | `/assets/css/student/profile.css` | — |
| `grades.php` | `/assets/css/student/grades.css` | — |
| `certificates.php` | `/assets/css/student/certificates.css` | — |
| `schedule.php` | `../assets/css/student/schedule.css` | — |
| `generate-certificate.php` | `/assets/css/student/generate-certificate.css` (**file does not exist in the old site**) + a 742-line inline `<style>` | — |

## 3. Auth and security

- Every page calls `requireRole(ROLE_STUDENT)`; the port uses `requireRole("student")`,
  which redirects an admin to `/admin/dashboard` and an instructor to
  `/instructor/dashboard` (the shared guard).
- Enrollment is re-verified on **every** learn-page request
  (`getCourseContentForStudent()` returns `false` → 302 `/course?id=<id>`; the port
  redirects to `/course/{slug}` when the slug is known, else `/browse-courses`, because
  `/course?id=` is not a real route in the new app — same destination course page).
- CSRF: every form POST carries `csrf_token`, compared with `crypto.timingSafeEqual`
  against the `edulari_csrf` cookie, plus the Origin/Host check.
- **CSRF gaps closed** (the prompt requires it):
  - `schedule-api.php` had none → all four POST actions now require the token.
  - `course_ai_chat_api.php` sent `X-CSRF-Token` but never read it → now verified.
- No lesson, quiz, assignment or certificate is ever readable without an enrollment row
  owned by the session user (ownership check on `enrollments.id`).

## 4. Business rules ported (with the exact numbers)

### `updateCourseProgress()` → `lib/learning/progress.ts#computeProgress`
```
completed = COUNT(lesson_progress WHERE enrollment_id = ? AND completed_at IS NOT NULL)
total     = COUNT(lessons JOIN enrollments ON l.course_id = e.course_id WHERE e.id = ?)
pct       = total > 0 ? round(completed / total * 100) : 0
completed_at = COALESCE(completed_at, now())   -- only when pct >= 100
```
`total` counts **every lesson in the course**, including ones the student never opened.

### `markLessonComplete()`
Existing row → `time_spent_seconds = time_spent_seconds + ?`,
`completed_at = COALESCE(completed_at, NOW())` (never re-stamped). Otherwise INSERT with
`completed_at = NOW()`. Always followed by `updateCourseProgress()`.

### `submitQuizAttempt()` → `lib/learning/quiz.ts#scoreAttempt`
- INSERT `quiz_attempts (enrollment_id, lesson_id, started_at) NOW()` first.
- For **every** question, not just answered ones: `totalPoints += points`.
- `multiple_choice`: the student's answer is the option **id**; correct when
  `option.is_correct`.
- `true_false`: the answer is the literal `'true'` / `'false'`; the correct option is
  the one whose `option_text` is `'True'` / `'False'`. The stored
  `selected_option_id` is that option's id.
- One `quiz_answers` row per question (`selected_option_id` may be NULL).
- `percentage = totalPoints > 0 ? round(earned / total * 100, 2) : 0`.
- Passing percentage comes from `courses.passing_percentage` for the enrollment's
  course, default **70**. `passed = percentage >= passing`.
- UPDATE the attempt row with score/total/percentage/passed/`completed_at = NOW()`.
- On pass only: `markLessonComplete(enrollment, lesson, 0)`.
- Retake: unlimited. `previous_attempt` = latest attempt by `completed_at DESC`; the
  quiz form is hidden once that attempt passed.

### `submitAssignment()`
Existing row → UPDATE `submission_text`, `submitted_at = NOW()`, `status = 'pending'`
(**the grade and the instructor feedback are wiped by design** — a resubmission returns
the submission to `pending`). Otherwise INSERT. `allow_late_submission` and
`due_days` are display-only in the student area; nothing is blocked.

### `hasMetCertificateCriteria()` / `issueCertificate()`
`progress_percentage >= courses.passing_percentage AND courses.certificate_enabled`.
`certificate_id` = `CERT-` + three 4-hex groups (uppercased `random_bytes(2)`),
retried on collision. `course_name` / `student_name` are **snapshots** taken at issue
time. One certificate per `enrollment_id` (UNIQUE). Issuance happens on GET of
`/student/generate-certificate?course=<id>` — the "auto" rule: the first eligible visit
issues it, every later visit returns the same row.

### `getLessonNavigation()`
All lessons of the course ordered by `s.sort_order, l.sort_order` (no id tiebreak);
prev = the row before the current one, next = the first row after it.

### Learning streak / dashboard maths
`total_hours = round(SUM(time_spent_seconds) / 3600, 1)`,
`learning_days = COUNT(DISTINCT DATE(completed_at))`, streak = consecutive distinct
learn dates counting back from **today**, breaking at the first mismatch.
`overall_pct = round(completed_courses / total_courses * 100)`.
Schedule streak = consecutive `study_plan.planned_date` values with `is_done = 1`,
same walk-back rule.

### Grades (`grades.php`)
Per enrollment:
- gradable lessons = `lessons.content_type IN ('quiz','assignment')`
- quiz weight = `quiz_attempts.total_points` **or 10 when falsy**; earned =
  `percentage / 100 * weight`
- assignment counts only when `status = 'graded' AND max_marks > 0`; weight =
  `max_marks`, earned = `marks_obtained`
- `weightedAvg = round(earned / totalWeight * 100, 1)`, `null` when `totalWeight = 0`
- letters: ≥90 A, ≥80 B, ≥70 C, ≥60 D, else F; `—` / `grade-none` when null
- `passStatus = weightedAvg >= courses.passing_percentage (default 70) ? 'pass' : 'fail'`
- global average = mean of the non-null per-course averages, 1 dp
Attempt history rows use `quiz_attempts` ordered `lesson_id, completed_at DESC`.

### Study plan (`schedule-api.php`)
- `duration_min = max(5, min(480, int(value) || 30))`
- `course_id` and `planned_date` are mandatory; the date must parse as `Y-m-d`
- the student must be enrolled in the course (for both add and update)
- `ownPlan(planId, uid)` gates update/delete/toggle; a foreign id answers
  `{"success":false,"message":"Session not found."}`
- `toggle_done` returns the new `is_done`
- date strings are validated with a real `Date`, not a regex

## 5. Timezone

`private/config.php` line 73 hard-codes `date_default_timezone_set('Asia/Kolkata')`
(an admin setting can rewrite it — Phase 8). Every "today" computation (streaks, week
boundaries, `submitted_at` display, `M j – M j, Y` labels) must therefore run in
**Asia/Kolkata** and not in the server's UTC. `lib/format.ts` gains
`APP_TIMEZONE` (env, default `Asia/Kolkata`) plus `formatDate*` helpers built on
`Intl.DateTimeFormat` with an explicit `timeZone`, so Vercel (UTC) renders exactly what
PHP (IST) rendered.

## 6. Course AI chat

Provider **Groq**, `POST ${GROQ_ENDPOINT}`, `Authorization: Bearer ${GROQ_API_KEY}`,
model `GROQ_MODEL` (`llama-3.3-70b-versatile`), `temperature 0.7`,
`max_tokens 4096`, `stream false`, 60 s total / 15 s connect. Errors →
`{error: 'Groq error: <message>'}` (the PHP let them bubble as a 500; the port returns
a JSON error the widget can display).

Prompt shape is kept byte-for-byte from `buildPrompt()`:
```
You are an AI tutor for the course '{title}'. [Course description: {first 500 chars}. ]
Answer the student's questions about this course. Use Markdown formatting.

Conversation so far:
Tutor: ...
Student: ...
Tutor:
```
Actions `get_messages | send | retry | edit_message | switch_version | feedback |
share | get_share` with the same semantics as `docs/analysis/ai.md`, including
`versions` (`[{content, created_at}]`), `active_version`, the feedback toggle-to-null,
the single `bin2hex(random_bytes(4))` slug per chat, and the regeneration of the next
assistant reply after a user edit.

The shared view stays public, `noindex`, and uses its **own** minimal `renderMarkdown()`
(HTML-escape first, then the regex chain) — not `lib/markdown.ts` — because that is what
the PHP renders. `code-highlight.js` is ported to a client component that runs the same
`DOMContentLoaded` pass over `pre.md-code code`.

`export const maxDuration = 60` on the chat route (AGENTS.md §9).

## 7. Known PHP defects and how they are handled

1. **`my-courses.php` / `dashboard.php` read `certificate_issued` and `certificate_url`
   from `c.*`.** Neither column exists on `courses` in MySQL or Postgres, so both
   `if` branches are permanently false and the certificate button never rendered. The
   port derives them from a `LEFT JOIN certificates ON certificates.enrollment_id =
   enrollments.id`, which is plainly the intent, and keeps the same class names.
2. **`submitAssignment()` ignores `attachment_path` / `attachment_name`.** learn.php
   writes the uploaded file to `private/uploads/assignments/` and then drops it on the
   floor — `assignment_submissions.attachment_file` is never written. The port uploads
   to B2 under `assignments/`, stores the key in `attachment_file`, and serves it
   through `/api/media?type=assignment_file&id=<submissionId>` to the owner student, the
   course instructor, or an admin. Validation is unchanged (5 MIME allow-list, 10 MB,
   magic-byte + malicious-pattern scan).
3. **Quiz submit has no PRG** (PHP re-renders the result on the POST response). The port
   records the attempt and 303-redirects to `?attempt=<id>`; the page then rebuilds the
   identical `lp-quiz-result` + `lp-quiz-review` markup from the stored attempt. Refresh
   can no longer resubmit — strictly stronger.
4. **`schedule-api.php` and `course_ai_chat_api.php` have no CSRF check.** Closed, as the
   prompt requires.
5. **`generate-certificate.php` links a stylesheet that does not exist.** All of its CSS
   is in the inline `<style>` block; that block is ported verbatim into a
   `<CertificateStyles/>` component injected at the same cascade position. No file is
   invented.
6. **Canvas size.** The prompt says "1056x748"; the source uses `.certificate-wrapper
   { width: 1122px; height: 730px }`, `CERT_W = 1122`, `CERT_H = 730`, and
   html2canvas/jsPDF at `1122 × 794`. The **source wins**; the numbers are used verbatim.
7. **`unenrollStudent()`** is defined in `student.php` but called by no page in the PHP
   site. Ported to `lib/db/enrollments.ts` (already done in Phase 5) as a library; no UI
   is invented.
8. **`is_free_preview`** is only ever read by `instructor/course-content.php`. The student
   learn page gates purely on enrollment, so the port does the same — no free-preview
   branch is added to the student side.
9. **No notification triggers exist** for student events in the PHP source (grep for
   `createNotification` under `public/student/` returns nothing). Nothing is invented;
   `lib/notifications.ts` is simply not called from the learning area.

## 8. Validation rules (zod) per endpoint

| Endpoint | Rules |
|---|---|
| `POST /api/student/learn` `mark_complete` | `course_id` int > 0, `lesson_id` int > 0, `time_spent` int ≥ 0 |
| `POST /api/student/learn` `submit_quiz` | `answers` record of question-id → option-id-or-`true`/`false`; each id must belong to the lesson |
| `POST /api/student/learn` `submit_assignment` | `submission_text` 1…20000 chars (the PHP textarea has `required minlength="10"`); optional file |
| `POST /api/student/onboarding` | enums from the six option lists, `bio` ≤ 500, `phone` ≤ 20, `college_name`/`field_of_study` ≤ 255, skills/courses joined ≤ 1000 |
| `POST /api/student/profile` | same, plus `name` 1…100 |
| `POST /api/student/profile/avatar` | image only (jpeg/png/webp/gif), 2 MB, magic bytes + scan |
| `POST /api/student/schedule` | `course_id` > 0, `planned_date` real `YYYY-MM-DD`, `planned_time` `HH:MM` or empty, `duration_min` clamped 5…480, `note` ≤ 255 |
| `POST /api/student/course-ai` | `course_id` > 0; per-action payload; `content` 1…8000 |

## 9. Empties and edges

- No enrollment → learn page redirects; generate-certificate redirects to
  `/student/my-courses`; grades/dashboard render their empty states.
- Course with zero lessons → learn page renders `lp-empty-hero`; `progress_percentage`
  stays 0.
- Quiz with zero questions → `lp-empty-state` "No questions are available for this
  quiz yet."; the submit button stays disabled until every question is answered.
- Assignment lesson with no `assignments` row → `lp-empty-state` "Assignment details
  are not yet available."
- Assignment lesson with an existing submission → status card only, no form.
- `?msg=` on the learn page is compared against the literal `assignment_submitted`; any
  other value is ignored (the PHP escaped and echoed it verbatim — an XSS-adjacent
  reflection that the port does not reproduce).
- `?onboarded=1` on the dashboard shows the welcome toast once and is then replaced out
  of the URL bar, exactly like the PHP `history.replaceState`.
- `?completed=1` on the learn page shows the congratulation alert and its certificate CTA.