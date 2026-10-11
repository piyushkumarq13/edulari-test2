# Phase 8 — Instructor (part 2): the instructor panel

Numbering note: the user's plan calls this **PHASE 8: INSTRUCTOR (part 2)**. It is checklist
row 6 in `docs/PROGRESS.md` ("Instructor area"). Part 1 (the registration wizard + competency
test) shipped in Phase 7. The admin create/edit-course pages that reuse the course editor land
in the admin phase (row 8); this phase only builds the shared editor.

Sources read in full before writing this file:

- `public/instructor/dashboard.php` (285), `courses.php` (390), `create-course.php` (637),
  `edit-course.php` (869), `course-content.php` (1506), `course-analytics.php` (399),
  `analytics.php` (210), `students.php` (531), `reviews.php` (676), `earnings.php` (527),
  `profile.php` (948)
- `private/functions/analytics.php`, `courses.php`, `sections.php`, `lessons.php`,
  `quizzes.php`, `assignments.php`, `admin.php` (payout read side)
- `public/assets/js/md-editor.js` (297) and `public/ajax-image-upload.php` (36)
- `public/assets/css/instructor/*.css` (11 files, already copied verbatim to `styles/css/instructor/`)
- `public/partials/navbar.php` (instructor link set) and `head.php` (stylesheet order)

---

## 1. Access model

Every page starts with `requireRole(ROLE_INSTRUCTOR)`:

- not logged in -> `/login?reason=...`
- role `admin` -> `/admin/dashboard`
- role `student` -> `/`
- role `instructor` but the latest `instructor_applications.status` is not `approved` ->
  `/instructor-register` (the panel is closed until an admin approves)

That last rule is the existing `requireInstructorApproved()` in `lib/auth/guards.ts`.
Every course-scoped page then re-verifies ownership with `getCourseById($id, $instructorId)`
and redirects to `/instructor/courses` when the course is missing or not owned. **No
instructor may read or mutate another instructor's course, section, lesson, quiz, assignment
or student list.** Ownership is enforced in the query, not in the UI.

`is_featured` is admin-only and is not writable from any instructor form.

## 2. Route map

| PHP | New route | Notes |
|---|---|---|
| `instructor/dashboard.php` | `app/(instructor)/instructor/dashboard/page.tsx` | read-only |
| `instructor/courses.php` | `app/(instructor)/instructor/courses/page.tsx` | POST: publish/unpublish/delete |
| `instructor/create-course.php` | `app/(instructor)/instructor/create-course/page.tsx` | POST -> redirect to content page |
| `instructor/edit-course.php?id=` | `app/(instructor)/instructor/edit-course/[id]/page.tsx` | POST save / remove_thumbnail |
| `instructor/course-content.php?id=` | `app/(instructor)/instructor/course-content/[id]/page.tsx` | section + lesson CRUD |
| `instructor/course-analytics.php?id=` | `app/(instructor)/instructor/course-analytics/[id]/page.tsx` | read-only |
| `instructor/analytics.php` | `app/(instructor)/instructor/analytics/page.tsx` | read-only |
| `instructor/students.php` | `app/(instructor)/instructor/students/page.tsx` | GET filters only |
| `instructor/reviews.php` | `app/(instructor)/instructor/reviews/page.tsx` | GET filters only |
| `instructor/earnings.php` | `app/(instructor)/instructor/earnings/page.tsx` | GET filters only |
| `instructor/profile.php` | `app/(instructor)/instructor/profile/page.tsx` | POST: personal / education / teaching / avatar |
| `ajax-image-upload.php` | `app/api/editor/image/route.ts` | admin+instructor, B2 storage |

POST handlers live in `app/api/instructor/**` route handlers returning
`{ ok, redirect?, error? }`, and the client navigates — the PHP did a `header('Location: ...')`
after each success, so this is Post/Redirect/Get, not a JSON-in-place update.

## 3. Data layer — `lib/db/instructor/*`

Ported 1:1 from the PHP functions, with the same ownership checks.

- `courses.ts` — `createCourse`, `updateCourse`, `deleteCourse`, `toggleCoursePublish`,
  `getCourseById`, `getInstructorCourses`, `getCourseStats`, `getCategories`, `createSlug`,
  `uploadThumbnail` (B2), `ensureUniqueSlug`
- `sections.ts` — `createSection`, `updateSection`, `deleteSection`, `getCourseSections`,
  `reorderSections`
- `lessons.ts` — `createLesson`, `updateLesson`, `deleteLesson`, `getSectionLessons`,
  `getLessonById`, `getCourseLessons`, `reorderLessons`, `uploadLessonPDF` (B2)
- `quizzes.ts` — `createQuizQuestion`, `createQuizOption`, `updateQuizQuestion`,
  `updateQuizOptions`, `deleteQuizQuestion`, `getQuizQuestions`, `getQuizTotalPoints`
- `assignments.ts` — `createAssignment`, `updateAssignment`, `deleteAssignment`,
  `getAssignmentByLesson`, `getAssignmentById`
- `analytics.ts` — `getInstructorOverviewStats`, `getCourseDetailedAnalytics`,
  `getCourseStudentProgress`
- `earnings.ts` — the earnings queries + `getInstructorPayouts`, `getTotalPayoutsForInstructor`
- `reviews.ts` — the two overview aggregates, the two filtered lists, the recent-activity UNION

### 3.1 `createSlug` and slug uniqueness

`createSlug()` lowercases, replaces every `[^a-z0-9-]` run with `-`, collapses `-+` and trims
`-`. Uniqueness is enforced by `ensureUniqueSlug(base, excludeCourseId?)`: if the slug is
taken it appends `-<unix seconds>`, exactly like the PHP. Two courses cannot share a slug and
the DB has a unique index as a backstop. A test drives this directly.

### 3.2 Ownership guards

Every mutating function takes `instructorId` and puts `AND instructor_id = $id` (or
`AND course_id = $id` after a course-ownership check) in the WHERE clause. Nothing is
fetched-then-checked-then-written, so a TOCTOU race cannot leak another instructor's data.

`deleteCourse` runs the PHP's cascade in one transaction: quiz_answers (via attempts of the
course's lessons) -> quiz_attempts -> quiz_options (via questions) -> quiz_questions ->
assignment_submissions -> assignments -> lesson_progress -> lessons -> course_sections ->
enrollments -> course_reviews -> courses, and commits only when the final DELETE affected a row.

### 3.3 Lesson ordering

The PHP has no drag-and-drop: `sort_order` is simply `count(existing lessons in the section)`
on create, and `reorderLessons` / `reorderSections` exist for an order payload but no caller
was found. This phase therefore ports create (append), update (explicit `sort_order`) and the
reorder functions, and renders the list ordered by `(sort_order, id)`. No drag UI is invented,
because the PHP does not have one.

## 4. Course create / edit — shared editor

`components/instructor/course/CourseEditor.tsx` renders the field set used by both pages so
the admin pages can reuse it unchanged. The only differences between create and edit are the
page chrome and which action is posted, both of which are props.

Fields and validation (identical in the PHP for create and edit):

| Field | Rule | PHP error string |
|---|---|---|
| `title` | required, maxlength 150 | `Course title is required.` |
| `short_description` | required, maxlength 250 | `Short description is required.` |
| `description` | optional, markdown | — |
| `what_you_learn`, `requirements` | optional | — (the PHP accepts them but never persists them) |
| `category_id` | required | `Please select a category.` |
| `level` | required, one of beginner/intermediate/advanced | `Please select a course level.` |
| `language` | default `English` | — |
| `duration_hours` | int >= 0 | — |
| `price` | float >= 0, `0` = free | — |
| `certificate_enabled` | checkbox | — |
| `passing_percentage` | int, default 70 | — |

`what_you_learn` and `requirements` are validated and then dropped by the PHP (no column, no
session write). This phase keeps the inputs so the markup matches, and documents the drop in
`docs/PROGRESS.md` rather than inventing columns.

Create redirects to `/instructor/course-content?id=<newId>&created=1`. Edit redirects to
`/instructor/edit-course?id=<id>&success=Course updated successfully!`. When an edit changes
nothing and no thumbnail was uploaded the PHP says `No changes to save.` — preserved,
because `updateCourse` returns the affected-row count by reference.

Thumbnail upload: `image/jpeg|png|webp`, 2 MB cap, full `scanUploadedFile` parity
(MIME + magic bytes + malicious-pattern scan), stored in B2 under `courses/course_<id>_<ts>.<ext>`,
old key deleted. `remove_thumbnail` is its own POST action.

## 5. Course content — sections, lessons, quizzes, assignments

Section CRUD is `add_section` / `delete_section` with the ownership-scoped helpers.

A lesson is one of five types. The modal is a client component driven by the same state
machine as the PHP (`content_type` change toggles the field block, quiz questions are an
accordion array, one card per question):

- **video** — `video_url` (normalised through `edulariYoutubeId`, the PHP's paste-a-link
  resolver) + `video_duration` in seconds
- **text** — `content_text` through the markdown editor
- **pdf** — `pdf_file`, allow-list `pdf/doc/docx/ppt/pptx/xls/xlsx/txt/zip/mp4/webm/mp3/
  jpg/jpeg/png/gif/webp`, 50 MB cap, B2 key `lessons/lesson_<id>_<ts>.<ext>`, old file deleted
- **quiz** — `quiz_questions[i][question|type|options|points|correct_option|correct_answer]`;
  multiple-choice stores one `quiz_options` row per option with `is_correct`, true/false stores
  `True`/`False` options from `correct_answer`
- **assignment** — `assignment_instructions`, `max_marks` (100), `passing_marks` (40),
  `due_days` (7), `allow_late_submission`

`is_free_preview` is a checkbox on every lesson type.

Editing a quiz lesson deletes and recreates every question, matching the PHP exactly (the
student's attempts keep their `quiz_answers` rows via `question_id`; this is the PHP's
behaviour and is recorded, not silently changed).

Ownership: `updateLesson`/`deleteLesson` are scoped by `id AND course_id`, and the section id
supplied for a move is validated against the same course.

## 6. Markdown editor

`components/instructor/MarkdownEditor.tsx` is a client component that enhances a hidden
`<textarea name=...>` with the `mde-wrap` / `mde-toolbar` / `mde-editor` DOM that
`md-editor.js` builds, so `styles/css/md-editor.css` applies unchanged:

- toolbar order: undo, redo, bold, italic, underline, strikethrough, h1, h2, h3, bullets,
  numbered, quote, link, image, rule, code, table — `image`, `code` and `table` are hidden when
  `data-md-tools="simple"`
- preview is **client-side** `markdownToHtml()`; there is no server render endpoint
- on form submit the editor is converted back with `htmlToMarkdown()` and written into the
  hidden textarea
- `localStorage` draft key `mde_draft_<textarea id|name>` stores the editor HTML and is
  cleared on submit (the PHP's `clearLessonDraft()` also clears it on modal close)
- `window.mdRefresh[<name>]` is replaced by a prop/ref so the lesson modal can re-render the
  editor after loading a saved lesson
- the only keyboard behaviour is Backspace inside an empty `pre`, which removes the block
- the image modal's file path posts to `/api/editor/image` and inserts the returned URL

`app/api/editor/image/route.ts` mirrors `ajax-image-upload.php`: role must be `admin` or
`instructor` (403 `Not allowed.`), missing file -> `No file uploaded.`, the same 5 MB
`image/jpeg|png|webp|gif` scan, storage in B2 under `editor/editor_<ts>_<hex>.<ext>`,
response `{ success, url }`. `ajax-image-upload.php` had no CSRF check; this route requires
one because AGENTS.md forbids weakening CSRF.

## 7. Analytics, students, reviews, earnings

`getInstructorOverviewStats` returns total/published courses, distinct students,
`SUM(courses.price)` over enrollments, the 2dp average course rating, six months of revenue,
the top five published courses, and ten recent enrollments.

`getCourseDetailedAnalytics` returns the 30-day enrollment trend, the completion rate, the
six-bucket progress distribution and the per-quiz attempt/score table.

`students.php` filters by `search` (name/email LIKE), `course`, `progress`
(`not_started|in_progress|completed`) and sorts by `last_enrollment|name|progress`. The course
dropdown lists published courses only.

`reviews.php` has two tabs (`course`, `personal`) over `course_reviews` and
`instructor_ratings`, filters by course/rating/search and sorts newest/oldest/highest/lowest.
The tab links deliberately **drop the course filter** and keep search/rating/sort, because
that is what the PHP href does.

`earnings.php` has **no revenue share**: the instructor is credited 100 % of `courses.price`
per enrollment row. There is no platform fee, no paise conversion, no tax deduction and no
refund netting anywhere in the PHP. `pending balance = max(0, earned - paid)` where `paid` is
`SUM(instructor_payouts.amount) WHERE status='paid'`; pending and cancelled payout rows appear
in the history table but never count as paid out. Amounts are INR rupees straight from
`courses.price`.

MySQL `YEAR()/MONTH()` are evaluated in Asia/Kolkata on the live site, so the Postgres port
uses `EXTRACT(YEAR FROM enrolled_at AT TIME ZONE 'Asia/Kolkata')` to match, not UTC.

The monthly revenue chart is Chart.js 4.4.0 from `cdn.jsdelivr.net`, a bar dataset
(`Revenue ($)`) plus a line dataset (`Sales`) on a second y-axis. That host is already in the
CSP `script-src`.

## 8. Profile

Four POST actions, each a PRG redirect to `?tab=personal|education|teaching` with a
single-slot flash message: `save_personal` (also updates `users.phone`; bio > 1500 chars is
rejected inline with `Bio cannot exceed 1 500 characters.`), `save_education`,
`save_teaching` (both update the `instructor_applications` row), `upload_avatar` and
`remove_avatar`.

Avatar: `image/jpeg|png|webp|gif`, 2 MB cap, B2 key `avatars/inst_<userId>_<ts>.<ext>`,
old key deleted first. The legacy local-disk fallback disappears — Vercel has no writable
disk — and B2 is already the configured target.

All three panels are always rendered; `.ipf-panel--active` toggles the visible one, because
the PHP relies on CSS `display:none` rather than conditional markup.

## 9. Revalidation

Any write that changes what a public page shows calls, in the route handler:

- `revalidatePath('/course/<slug>')` after a course is created, edited or published
- `revalidatePath('/browse-courses')`, `revalidatePath('/categories')` and `revalidatePath('/')`
  after a course title/slug/category/price/published change, so home, browse and the category
  listing pick it up
- `revalidatePath('/instructor-profile/<userId>')` after a profile save or avatar change

## 10. PHP bugs found (intended behaviour is ported, noted in PROGRESS.md)

1. `profile.php` reads `$stats['avg_rating']`, but `getInstructorOverviewStats()` produces
   `avg_course_rating`, so the hero "Avg Rating" always rendered `0.0`. Ported as
   `avg_course_rating`.
2. `getInstructorOverviewStats().top_courses` LEFT JOINs `enrollments` **and**
   `course_reviews` and groups only by `c.id`, so `COUNT(e.id)` is multiplied by the number of
   reviews. The count and average are computed correctly in the port.
3. `getCourseDetailedAnalytics().quiz_performance` averages `quiz_attempts.score` (raw points)
   and the template prints a `%`. The port averages `percentage`.
4. `create-course.php` collects `what_you_learn` and `requirements` and never stores them.
   Kept in the form, documented as dropped.

## 11. Tests

`tests/instructor-course-slug.test.ts`, `tests/instructor-ownership.test.ts`,
`tests/instructor-quiz-builder.test.ts` and `tests/instructor-earnings.test.ts` cover slug
generation and uniqueness, cross-instructor access denial for every mutating helper, quiz
question/option validation (multiple choice and true/false, correct-answer index, points),
and the earnings calculation including the paid/pending balance and the no-revenue-share rule.

## 12. Verification

`typecheck`, `lint --max-warnings 0`, `vitest`, `next build`, `parity-check`,
`php-stylesheet-order`, `php-chrome-map`, `css-usage` and `verify-columns`.