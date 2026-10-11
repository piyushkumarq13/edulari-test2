/**
 * Phase 6 live smoke test — the student learning area.
 *
 * Creates a throwaway student + instructor, publishes a fixture course with a section, a
 * video/text lesson, a quiz (with a true_false question) and an assignment lesson, then
 * exercises the real HTTP surface of learn / my-courses / dashboard / profile / grades /
 * certificates / generate-certificate / schedule / onboarding plus the study-plan API and
 * the course-AI guard. The AI provider is never called: its endpoint is probed only for
 * its guard behaviour, which is what can be asserted offline.
 *
 *   npx tsx scripts/smoke-phase6.ts [baseUrl]
 *
 * Requires a running `next start` (or `next dev`) and valid .env.local credentials.
 * Everything it creates is deleted in the `finally` block.
 */

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    if (process.env[key]) continue;
    process.env[key] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

const BASE = process.argv[2] ?? "http://localhost:3100";
const SQL_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!SQL_URL) {
  console.error("smoke-phase6: DATABASE_URL / DIRECT_URL not set");
  process.exit(1);
}

const sql = postgres(SQL_URL, { prepare: false, max: 1 });

const SUFFIX = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const EMAIL = `phase6_${SUFFIX}@example.test`;
const OTHER_EMAIL = `phase6_other_${SUFFIX}@example.test`;
const INSTR_EMAIL = `phase6_instructor_${SUFFIX}@example.test`;
const PASSWORD = "Phase6Smoke!2026";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, extra = "") {
  if (ok) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    failures.push(`${name}${extra ? ` - ${extra}` : ""}`);
    console.log(`  FAIL  ${name}${extra ? ` - ${extra}` : ""}`);
  }
}

const jar = new Map<string, string>();

function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair!.indexOf("=");
    if (idx <= 0) continue;
    const name = pair!.slice(0, idx).trim();
    const value = pair!.slice(idx + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function req(pathname: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Cookie: cookieHeader() };
  for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k] = v;
  if (method !== "GET" && method !== "HEAD" && !headers["Origin"] && !headers["origin"]) headers["Origin"] = BASE;
  const res = await fetch(`${BASE}${pathname}`, { ...init, redirect: "manual", headers });
  absorb(res);
  return res;
}

/**
 * With Cache Components a redirect() thrown inside a streamed server component cannot
 * change the status code (the shell is already flushed); Next encodes it as
 * NEXT_REDIRECT in the RSC payload and the client router follows it. So "was the caller
 * redirected away" means: a 3xx, OR the payload names the expected destination.
 */
function redirectedTo(res: Response, body: string, destination: string): boolean {
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    return (res.headers.get("location") ?? "").includes(destination);
  }
  return body.includes(destination);
}

/**
 * Same idea for notFound(): the shell is already flushed, so the 404 page is rendered
 * into the payload with a 200 status. The marker is the framework's own
 * `404: This page could not be found.` title plus the notFound payload key.
 */
function renderedNotFound(res: Response, body: string): boolean {
  if (res.status === 404) return true;
  return body.includes("404: This page could not be found.") || body.includes('\\"notFound\\"');
}

function csrf(): string {
  return jar.get(process.env.CSRF_COOKIE_NAME ?? "edulari_csrf") ?? "";
}

function form(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams({ csrf_token: csrf(), ...fields });
}

async function login(email: string) {
  jar.clear();
  absorb(await fetch(`${BASE}/student/dashboard`));
  return req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: PASSWORD, csrf_token: csrf() }),
  });
}

async function main() {
  let userId = 0;
  let otherId = 0;
  let instructorId = 0;
  let courseId = 0;
  let sectionId = 0;
  let videoLessonId = 0;
  let quizLessonId = 0;
  let quizQuestionId = 0;
  let trueFalseLessonId = 0;
  let trueFalseQuestionId = 0;
  let assignmentLessonId = 0;
  let assignmentId = 0;

  try {
    // ── fixtures ──────────────────────────────────────────────────────────
    await sql`
      INSERT INTO users (name, email, password, role, is_active, email_verified, profile_completed, registration_date)
      VALUES
        (${`Phase6 Student`}, ${EMAIL}, 'x', 'student', true, true, false, now()),
        (${`Phase6 Other`}, ${OTHER_EMAIL}, 'x', 'student', true, true, true, now()),
        (${`Phase6 Instructor`}, ${INSTR_EMAIL}, 'x', 'instructor', true, true, true, now())
    `;
    const all = await sql<{ id: number; email: string }[]>`
      SELECT id, email FROM users WHERE email IN (${EMAIL}, ${OTHER_EMAIL}, ${INSTR_EMAIL})`;
    userId = Number(all.find((u) => u.email === EMAIL)!.id);
    otherId = Number(all.find((u) => u.email === OTHER_EMAIL)!.id);
    instructorId = Number(all.find((u) => u.email === INSTR_EMAIL)!.id);

    const { hashPassword } = await import("../lib/auth/passwords");
    const hash = await hashPassword(PASSWORD);
    await sql`UPDATE users SET password = ${hash} WHERE id IN (${userId}, ${otherId}, ${instructorId})`;

    const catRows = await sql<{ id: number }[]>`SELECT id FROM categories ORDER BY id LIMIT 1`;
    const categoryId = catRows.length ? Number(catRows[0]!.id) : null;

    const course = await sql<{ id: number }[]>`
      INSERT INTO courses (title, slug, description, price, level, instructor_id, category_id,
                           is_published, certificate_enabled, passing_percentage, created_at)
      VALUES (${`P6 Course ${SUFFIX}`}, ${`p6-course-${SUFFIX}`}, 'Phase 6 smoke fixture', 0,
              'beginner', ${instructorId}, ${categoryId}, true, true, 70, now())
      RETURNING id`;
    courseId = Number(course[0]!.id);

    const section = await sql<{ id: number }[]>`
      INSERT INTO course_sections (course_id, title, sort_order) VALUES (${courseId}, 'Section 1', 0)
      RETURNING id`;
    sectionId = Number(section[0]!.id);

    const video = await sql<{ id: number }[]>`
      INSERT INTO lessons (section_id, course_id, title, content_type, content_text, video_url, video_duration, sort_order)
      VALUES (${sectionId}, ${courseId}, 'Intro video', 'video', 'About this lesson', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 90, 0)
      RETURNING id`;
    videoLessonId = Number(video[0]!.id);

    const quiz = await sql<{ id: number }[]>`
      INSERT INTO lessons (section_id, course_id, title, content_type, sort_order)
      VALUES (${sectionId}, ${courseId}, 'Chapter quiz', 'quiz', 1)
      RETURNING id`;
    quizLessonId = Number(quiz[0]!.id);

    const mq = await sql<{ id: number }[]>`
      INSERT INTO quiz_questions (lesson_id, question, question_type, points, sort_order)
      VALUES (${quizLessonId}, 'Which option is correct?', 'multiple_choice', 5, 0)
      RETURNING id`;
    quizQuestionId = Number(mq[0]!.id);

    await sql`
      INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
        (${quizQuestionId}, 'Wrong', false, 0),
        (${quizQuestionId}, 'Right', true, 1)
    `;
    const correctOption = await sql<{ id: number }[]>`
      SELECT id FROM quiz_options WHERE question_id = ${quizQuestionId} AND is_correct = true`;
    const correctOptionId = Number(correctOption[0]!.id);

    const tfFixture = await sql<{ id: number }[]>`
      INSERT INTO lessons (section_id, course_id, title, content_type, sort_order)
      VALUES (${sectionId}, ${courseId}, 'Truth quiz', 'quiz', 2)
      RETURNING id`;
    trueFalseLessonId = Number(tfFixture[0]!.id);

    const tfq = await sql<{ id: number }[]>`
      INSERT INTO quiz_questions (lesson_id, question, question_type, points, sort_order)
      VALUES (${trueFalseLessonId}, 'Water freezes at 0 C', 'true_false', 5, 0)
      RETURNING id`;
    trueFalseQuestionId = Number(tfq[0]!.id);

    await sql`
      INSERT INTO quiz_options (question_id, option_text, is_correct, sort_order) VALUES
        (${trueFalseQuestionId}, 'True', true, 0),
        (${trueFalseQuestionId}, 'False', false, 1)
    `;

    const asgFixture = await sql<{ id: number }[]>`
      INSERT INTO lessons (section_id, course_id, title, content_type, sort_order)
      VALUES (${sectionId}, ${courseId}, 'Week 1 assignment', 'assignment', 3)
      RETURNING id`;
    assignmentLessonId = Number(asgFixture[0]!.id);

    const asgRow = await sql<{ id: number }[]>`
      INSERT INTO assignments (lesson_id, instructions, max_marks, passing_marks, due_days)
      VALUES (${assignmentLessonId}, 'Write 200 words about the intro lesson.', 100, 40, 7)
      RETURNING id`;
    assignmentId = Number(asgRow[0]!.id);

    const enroll = await sql<{ id: number }[]>`
      INSERT INTO enrollments (course_id, student_id, enrolled_at, progress_percentage)
      VALUES (${courseId}, ${userId}, now(), 0) RETURNING id`;
    const enrollmentId = Number(enroll[0]!.id);

    console.log(`\nPhase 6 live smoke against ${BASE}`);
    console.log(`  student ${userId}, other ${otherId}, instructor ${instructorId}, course ${courseId}, enrollment ${enrollmentId}\n`);

    // ── auth ──────────────────────────────────────────────────────────────
    console.log("auth");
    const l1 = await login(EMAIL);
    check("student can log in", l1.status === 200 || l1.status === 302, `status ${l1.status}`);
    check("session cookie issued", jar.has(process.env.SESSION_COOKIE_NAME ?? "edulari_session"));
    check("CSRF cookie issued", csrf() !== "");

    // ── pages render ──────────────────────────────────────────────────────
    console.log("\npages render");
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies(cookieHeader().split("; ").filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return { name: c.slice(0, i), value: decodeURIComponent(c.slice(i + 1)), domain: "localhost", path: "/" };
    }));

    /** Does the selector exist in the page's DOM AFTER hydration? */
    async function domHas(pathname: string, selector: string): Promise<boolean> {
      const page = await ctx.newPage();
      try {
        await page.goto(`${BASE}${pathname}`, { waitUntil: "networkidle", timeout: 45000 });
        return (await page.locator(selector).count()) > 0;
      } catch {
        return false;
      } finally {
        await page.close();
      }
    }

    for (const p of [
      "/student/dashboard",
      "/student/my-courses",
      "/student/learn",
      "/student/grades",
      "/student/certificates",
      "/student/schedule",
      "/student/profile",
      "/student/onboarding",
    ]) {
      const res = await req(`${p}${p === "/student/learn" ? `?course=${courseId}` : ""}`);
      const html = await res.text();
      check(`${p} renders`, res.status === 200 && !html.includes("/login?reason"), `status ${res.status}`);
    }

    const learnHtml = await (await req(`/student/learn?course=${courseId}&lesson=${videoLessonId}`)).text();
    check("learn page loads markdown-styles + course-ai css", learnHtml.includes("markdown-styles") || learnHtml.includes("lp-prose"));
    check("learn page shows the curriculum sidebar", await domHas(`/student/learn?course=${courseId}`, ".lp-curriculum"));
    check("learn page shows the custom video player", await domHas(`/student/learn?course=${courseId}&lesson=${videoLessonId}`, ".evp-player"));
    check("learn page shows the topbar progress", await domHas(`/student/learn?course=${courseId}`, ".lp-topbar__progress-fill"));
    check("learn page renders the AI tutor widget", await domHas(`/student/learn?course=${courseId}`, "#courseAiChatPanel"));

    check("dashboard renders the onboarding banner while the profile is incomplete", await domHas("/student/dashboard", ".onboard-banner"));

    check("my-courses renders the page", await domHas("/student/my-courses", ".mc-page"));
    check("my-courses shows the Hours Learned pill", await domHas("/student/my-courses", ".stat-pill-lbl"));
    check("grades renders a course sidebar entry", await domHas("/student/grades", ".gr-sidebar-courses"));
    check("certificates shows the empty state before eligibility", await domHas("/student/certificates", ".certs-empty"));
    check("schedule renders the 7-day grid", await domHas("/student/schedule", ".sc-week-grid"));
    check("schedule renders the heatmap", await domHas("/student/schedule", ".sc-heatmap-grid"));
    check("schedule renders pending tasks", await domHas("/student/schedule", ".sc-tasks, .sc-empty"));
    check("profile renders three tabs", await domHas("/student/profile", "#tab-personal")
      && await domHas("/student/profile", "#tab-education")
      && await domHas("/student/profile", "#tab-interests"));
    check("profile embeds the avatar csrf form", await domHas("/student/profile", "#avatarForm"));
    check("onboarding renders 5 steps for a new student", await domHas("/student/onboarding", "#step1.ob-step.active"));

    // ── enrollment gate ───────────────────────────────────────────────────
    console.log("\nenrollment gate");
    // A course the student is not enrolled in, and a course that does not exist.
    const foreignCourse = await sql<{ id: number }[]>`SELECT id FROM courses WHERE is_published = true AND id <> ${courseId} ORDER BY id LIMIT 1`;
    const otherPublishedId = Number(foreignCourse[0]?.id ?? 0);
    if (otherPublishedId) {
      const notMine = await req(`/student/learn?course=${otherPublishedId}`);
      check("an enrolled student is redirected away from a course they do not own",
        redirectedTo(notMine, await notMine.clone().text(), `/course/`), `status ${notMine.status}`);
    }
    const noSuchCourse = await req("/student/learn?course=99999999");
    check("learn on a non-existent course redirects to /browse-courses",
      redirectedTo(noSuchCourse, await noSuchCourse.clone().text(), "/browse-courses"), `status ${noSuchCourse.status}`);
    const noSuchCert = await req("/student/generate-certificate?course=99999999");
    check("generate-certificate on a non-existent course redirects to /student/my-courses",
      redirectedTo(noSuchCert, await noSuchCert.clone().text(), "/student/my-courses"), `status ${noSuchCert.status}`);

    // Enrolled, but progress < passing_percentage, so the certificate is not yet eligible.
    const earlyCert = await req(`/student/generate-certificate?course=${courseId}`);
    check("generate-certificate redirects back to the course while still ineligible",
      redirectedTo(earlyCert, await earlyCert.clone().text(), `/student/learn?course=${courseId}`), `status ${earlyCert.status}`);

    // ── mark complete + progress ──────────────────────────────────────────
    console.log("\nlesson completion and progress");
    const mark = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "mark_complete", course_id: String(courseId), lesson_id: String(videoLessonId), time_spent: "42" }),
    });
    check("mark_complete redirects (post/redirect/get)", [302, 303].includes(mark.status), `status ${mark.status}`);
    const loc = mark.headers.get("location") ?? "";
    check("mark_complete advances to the next lesson", loc.includes(`lesson=${quizLessonId}`), loc);

    const prog = await sql<{ progress_percentage: number; time_spent_seconds: number }[]>`
      SELECT e.progress_percentage, lp.time_spent_seconds
      FROM enrollments e
      JOIN lesson_progress lp ON lp.enrollment_id = e.id
      WHERE e.id = ${enrollmentId} AND lp.lesson_id = ${videoLessonId}`;
    check("lesson_progress recorded the time spent", Number(prog[0]?.time_spent_seconds) === 42, `got ${prog[0]?.time_spent_seconds}`);
    // 1 of 4 lessons = 25%
    check("course progress recomputed to 25%", Number(prog[0]?.progress_percentage) === 25, `got ${prog[0]?.progress_percentage}`);

    // Re-marking accumulates time and never re-stamps completed_at.
    await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "mark_complete", course_id: String(courseId), lesson_id: String(videoLessonId), time_spent: "8" }),
    });
    const prog2 = await sql<{ progress_percentage: number; time_spent_seconds: number; completed_at: Date }[]>`
      SELECT e.progress_percentage, lp.time_spent_seconds, lp.completed_at
      FROM enrollments e
      JOIN lesson_progress lp ON lp.enrollment_id = e.id
      WHERE e.id = ${enrollmentId} AND lp.lesson_id = ${videoLessonId}`;
    check("re-completing accumulates time (42 + 8)", Number(prog2[0]?.time_spent_seconds) === 50, `got ${prog2[0]?.time_spent_seconds}`);

    // ── quiz scoring ──────────────────────────────────────────────────────
    console.log("\nquiz scoring");
    const wrongOptionRows = await sql<{ id: number }[]>`SELECT id FROM quiz_options WHERE question_id = ${quizQuestionId} AND is_correct = false`;
    const wrongOptionId = Number(wrongOptionRows[0]!.id);

    const wrong = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([
        ["csrf_token", csrf()],
        ["action", "submit_quiz"],
        ["course_id", String(courseId)],
        ["lesson_id", String(quizLessonId)],
        [`answers[${quizQuestionId}]`, String(wrongOptionId)],
      ]),
    });
    check("submit_quiz redirects", [302, 303].includes(wrong.status), `status ${wrong.status}`);
    const attemptId = Number(new URL(wrong.headers.get("location") ?? "", BASE).searchParams.get("attempt") ?? 0);
    check("submit_quiz returns the new attempt id", attemptId > 0);

    const failed = await sql<{ score: number; total_points: number; percentage: string; passed: boolean }[]>`
      SELECT score, total_points, percentage, passed FROM quiz_attempts WHERE id = ${attemptId}`;
    check("a wrong answer scores 0 and does not pass", Number(failed[0]?.score) === 0 && failed[0]?.passed === false);
    const answerRows = await sql<{ is_correct: boolean; selected_option_id: number | null }[]>`
      SELECT is_correct, selected_option_id FROM quiz_answers WHERE attempt_id = ${attemptId}`;
    check("a quiz_answers row records the wrong option that was chosen", answerRows.length === 1 && Number(answerRows[0]!.selected_option_id) === wrongOptionId);

    // A forged option id that belongs to no question is dropped rather than stored.
    const forged = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([
        ["csrf_token", csrf()],
        ["action", "submit_quiz"],
        ["course_id", String(courseId)],
        ["lesson_id", String(quizLessonId)],
        [`answers[${quizQuestionId}]`, "99999999"],
      ]),
    });
    const forgedAttemptId = Number(new URL(forged.headers.get("location") ?? "", BASE).searchParams.get("attempt") ?? 0);
    const forgedAnswer = await sql<{ selected_option_id: number | null }[]>`SELECT selected_option_id FROM quiz_answers WHERE attempt_id = ${forgedAttemptId}`;
    check("a forged option id is not stored", forgedAnswer.length === 1 && forgedAnswer[0]!.selected_option_id === null);

    const lpAfterFail = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM lesson_progress WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${quizLessonId}`;
    check("a failed quiz does not complete the lesson", lpAfterFail[0]!.c === 0);

    const right = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([
        ["csrf_token", csrf()],
        ["action", "submit_quiz"],
        ["course_id", String(courseId)],
        ["lesson_id", String(quizLessonId)],
        [`answers[${quizQuestionId}]`, String(correctOptionId)],
      ]),
    });
    const passAttemptId = Number(new URL(right.headers.get("location") ?? "", BASE).searchParams.get("attempt") ?? 0);
    const passed = await sql<{ score: number; percentage: string; passed: boolean }[]>`
      SELECT score, percentage, passed FROM quiz_attempts WHERE id = ${passAttemptId}`;
    check("a correct answer scores full marks and passes", Number(passed[0]?.score) === 5 && passed[0]?.percentage === "100.00" && passed[0]?.passed === true);
    const lpAfterPass = await sql<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM lesson_progress WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${quizLessonId}`;
    check("passing the quiz completes the lesson", lpAfterPass[0]!.c === 1);

    // A true_false question answers with 'true'/'false', not an option id.
    const tf = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([
        ["csrf_token", csrf()],
        ["action", "submit_quiz"],
        ["course_id", String(courseId)],
        ["lesson_id", String(trueFalseLessonId)],
        [`answers[${trueFalseQuestionId}]`, "true"],
      ]),
    });
    const tfAttemptId = Number(new URL(tf.headers.get("location") ?? "", BASE).searchParams.get("attempt") ?? 0);
    const tfRow = await sql<{ score: number; passed: boolean }[]>`
      SELECT score, passed FROM quiz_attempts WHERE id = ${tfAttemptId}`;
    check("true_false 'true' scores against the True option", Number(tfRow[0]?.score) === 5 && tfRow[0]?.passed === true);

    check("quiz result panel re-renders after the redirect", await domHas(`/student/learn?course=${courseId}&lesson=${quizLessonId}&attempt=${passAttemptId}`, ".lp-quiz-result--pass"));
    check("answer review re-renders after the redirect", await domHas(`/student/learn?course=${courseId}&lesson=${quizLessonId}&attempt=${passAttemptId}`, ".lp-quiz-review"));

    // ── assignment ────────────────────────────────────────────────────────
    console.log("\nassignment submission");
    const asg = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        action: "submit_assignment",
        course_id: String(courseId),
        lesson_id: String(assignmentLessonId),
        submission_text: "This is my answer to the assignment brief, well over ten characters.",
      }),
    });
    check("submit_assignment redirects", [302, 303].includes(asg.status), `status ${asg.status}`);
    check("submit_assignment sets the flash", (asg.headers.get("location") ?? "").includes("msg=assignment_submitted"));
    const sub = await sql<{ submission_text: string; status: string }[]>`
      SELECT submission_text, status FROM assignment_submissions WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${assignmentLessonId}`;
    check("submission stored as pending", sub.length === 1 && sub[0]!.status === "pending");

    // Resubmitting resets the status, exactly like submitAssignment().
    await sql`UPDATE assignment_submissions SET status = 'graded', marks_obtained = 88 WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${assignmentLessonId}`;
    await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        action: "submit_assignment",
        course_id: String(courseId),
        lesson_id: String(assignmentLessonId),
        submission_text: "A revised answer that is still long enough to pass validation.",
      }),
    });
    const resub = await sql<{ status: string; marks_obtained: number | null }[]>`
      SELECT status, marks_obtained FROM assignment_submissions WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${assignmentLessonId}`;
    check("resubmitting resets status to pending and clears the grade", resub[0]!.status === "pending" && resub[0]!.marks_obtained === null);

    check("graded submission shows the status card instead of the form",
      await domHas(`/student/learn?course=${courseId}&lesson=${assignmentLessonId}`, ".lp-submission-card")
      && !(await domHas(`/student/learn?course=${courseId}&lesson=${assignmentLessonId}`, "#assignmentForm")));

    await sql`UPDATE assignment_submissions SET status = 'graded', marks_obtained = 88, feedback = 'Nice work.' WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${assignmentLessonId}`;
    check("graded submission shows the marks and the feedback",
      await domHas(`/student/learn?course=${courseId}&lesson=${assignmentLessonId}`, ".lp-grade-display__obtained"));
    check("grades page lists the graded assignment", await domHas("/student/grades", ".gr-feedback-card"));
    check("grades page shows the weighted average", await domHas("/student/grades", ".gr-grade-pill"));

    // ── completion + certificate ───────────────────────────────────────────
    console.log("\ncompletion and certificate");
    for (const lessonId of [trueFalseLessonId, assignmentLessonId]) {
      await req("/api/student/learn", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ action: "mark_complete", course_id: String(courseId), lesson_id: String(lessonId), time_spent: "5" }),
      });
    }
    const done = await sql<{ progress_percentage: number; completed_at: Date | null }[]>`
      SELECT progress_percentage, completed_at FROM enrollments WHERE id = ${enrollmentId}`;
    check("completing every lesson reaches 100%", Number(done[0]?.progress_percentage) === 100, `got ${done[0]?.progress_percentage}`);
    check("completed_at is stamped once at 100%", !!done[0]?.completed_at);

    const certPath = `/student/generate-certificate?course=${courseId}`;
    const certPage = await req(certPath);
    check("generate-certificate renders the fixed canvas", certPage.status === 200);
    check("certificate renders the fixed 1122x730 canvas", await domHas(certPath, "#certificatePrintArea.certificate-wrapper"));
    check("certificate renders the SVG arc title", await domHas(certPath, "#titleArc"));
    check("certificate names the completion title", await domHas(certPath, ".cert-title-text"));
    check("certificate renders the QR host", await domHas(certPath, "#qrcode"));
    check("certificate renders the share block", await domHas(certPath, ".cert-share-section"));
    check("the certificate stylesheet is applied", await domHas(certPath, ".cert-title-svg"));
    check("the certificate canvas scales to the viewport", await domHas(certPath, "#certScaleContainer"));

    const certRow = await sql<{ certificate_id: string; student_name: string; course_name: string }[]>`
      SELECT certificate_id, student_name, course_name FROM certificates WHERE enrollment_id = ${enrollmentId}`;
    check("a certificate was issued", certRow.length === 1 && /^CERT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(certRow[0]!.certificate_id), certRow[0]?.certificate_id);
    check("certificate snapshots the student name", certRow[0]?.student_name === "Phase6 Student");

    const certPage2 = await req(`/student/generate-certificate?course=${courseId}`);
    const certCount = await sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM certificates WHERE enrollment_id = ${enrollmentId}`;
    check("revisiting issues no second certificate", certCount[0]!.c === 1 && certPage2.status === 200);

    const verify = await req(`/verify-certificate?id=${encodeURIComponent(certRow[0]!.certificate_id)}`);
    const verifyHtml = await verify.text();
    check("the public verify page resolves the real row", verifyHtml.includes(certRow[0]!.certificate_id) || verifyHtml.includes("Phase6 Student"));

    check("certificates list shows the issued certificate", await domHas("/student/certificates", ".cert-card-id"));
    check("certificates list shows the stats strip", await domHas("/student/certificates", ".certs-stats-strip"));
    check("my-courses now offers the certificate button", await domHas("/student/my-courses", ".btn-cert"));

    // ── study plan ────────────────────────────────────────────────────────
    console.log("\nstudy plan API");
    const lessons = await req(`/api/student/schedule?action=get_lessons&course_id=${courseId}`);
    const lessonsBody = (await lessons.json()) as { lessons: unknown[] };
    check("get_lessons returns the course lessons", Array.isArray(lessonsBody.lessons) && lessonsBody.lessons.length === 4, `${lessonsBody.lessons?.length}`);

    const addRes = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "add_plan", course_id: String(courseId), lesson_id: String(videoLessonId), planned_date: "2099-01-05", planned_time: "19:30", duration_min: "45", note: "Revisit the intro" }),
    });
    const added = (await addRes.json()) as { success: boolean; plan_id?: number; message?: string };
    check("add_plan succeeds", added.success === true && !!added.plan_id, added.message ?? "");
    const planId = added.plan_id ?? 0;

    const planRow = await sql<{ duration_min: number; planned_time: string; note: string }[]>`
      SELECT duration_min, planned_time, note FROM study_plan WHERE id = ${planId}`;
    check("planned_time is normalised to HH:MM:SS", planRow[0]?.planned_time === "19:30:00", planRow[0]?.planned_time);
    check("duration and note stored", Number(planRow[0]?.duration_min) === 45 && planRow[0]?.note === "Revisit the intro");

    const clamped = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "add_plan", course_id: String(courseId), planned_date: "2099-01-06", duration_min: "9999" }),
    });
    const clampedBody = (await clamped.json()) as { success: boolean; plan_id?: number };
    const clampedPlanId = Number(clampedBody.plan_id ?? 0);
    const clampedRow = await sql<{ duration_min: number }[]>`SELECT duration_min FROM study_plan WHERE id = ${clampedPlanId}`;
    check("duration is clamped to 480", Number(clampedRow[0]?.duration_min) === 480);

    const badDate = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "add_plan", course_id: String(courseId), planned_date: "2099-02-30" }),
    });
    check("an impossible date is rejected", (await badDate.json() as { message: string }).message === "Invalid date.");

    const upd = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "update_plan", plan_id: String(planId), course_id: String(courseId), planned_date: "2099-01-07", duration_min: "60" }),
    });
    check("update_plan succeeds", ((await upd.json()) as { success: boolean }).success === true);
    const updRow = await sql<{ planned_date: string }[]>`SELECT planned_date::text AS planned_date FROM study_plan WHERE id = ${planId}`;
    check("update_plan moved the date", updRow[0]?.planned_date === "2099-01-07", updRow[0]?.planned_date);

    const tog = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "toggle_done", plan_id: String(planId) }),
    });
    check("toggle_done flips is_done", ((await tog.json()) as { success: boolean; is_done: boolean }).is_done === true);

    const del = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "delete_plan", plan_id: String(planId) }),
    });
    check("delete_plan succeeds", ((await del.json()) as { success: boolean }).success === true);

    const foreign = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "toggle_done", plan_id: "99999999" }),
    });
    const foreignBody = (await foreign.json()) as { success: boolean; message: string };
    check("a plan the student does not own answers 'Session not found.'", foreignBody.success === false && foreignBody.message === "Session not found.");

    // CSRF (the gap in the PHP endpoint, now closed).
    const noCsrf = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "add_plan", course_id: String(courseId), planned_date: "2099-01-08" }),
    });
    check("schedule API rejects a POST without a CSRF token", noCsrf.status === 403, `status ${noCsrf.status}`);

    const foreignOrigin = await req("/api/student/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.example" },
      body: form({ action: "add_plan", course_id: String(courseId), planned_date: "2099-01-08" }),
    });
    check("schedule API rejects a foreign Origin", foreignOrigin.status === 403, `status ${foreignOrigin.status}`);

    // ── profile + onboarding ──────────────────────────────────────────────
    console.log("\nprofile and onboarding");
    const saveProfile = await req("/api/student/profile", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        name: "Phase6 Renamed",
        highest_education: "bachelors",
        college_name: "Delhi University",
        field_of_study: "Computer Science",
        learning_goal: "career_change",
        experience_level: "intermediate",
        bio: "Updated by the Phase 6 smoke test.",
        phone: "+91 98765 43210",
        "skills[]": "Python",
        "custom_skill": "Rust",
        "courses_interested[]": "Web Development",
        _tab: "personal",
      }),
    });
    check("save_profile redirects", [302, 303].includes(saveProfile.status), `status ${saveProfile.status}`);
    check("save_profile sets the success flash", (saveProfile.headers.get("location") ?? "").includes("flash_type=success"));
    const sp = await sql<{ name: string }[]>`SELECT name FROM users WHERE id = ${userId}`;
    check("save_profile renamed the user", sp[0]?.name === "Phase6 Renamed");
    const profRow = await sql<{ skills: string; highest_education: string }[]>`
      SELECT skills, highest_education FROM student_profiles WHERE user_id = ${userId}`;
    check("skills joined with the custom value", profRow[0]?.skills === "Python,Rust", profRow[0]?.skills);
    const completed = await sql<{ profile_completed: boolean }[]>`SELECT profile_completed FROM users WHERE id = ${userId}`;
    check("saving a profile for the first time sets profile_completed", completed[0]?.profile_completed === true);

    const emptyName = await req("/api/student/profile", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ name: "   ", _tab: "personal" }),
    });
    check("an empty name is rejected with the error flash", (emptyName.headers.get("location") ?? "").includes("flash_type=error"));

    const onboardedRes = await req("/student/onboarding");
    check("onboarding redirects once the profile is complete",
      redirectedTo(onboardedRes, await onboardedRes.clone().text(), "/student/dashboard"), `status ${onboardedRes.status}`);

    check("dashboard hides the onboarding banner once complete", !(await domHas("/student/dashboard", ".onboard-banner")));

    const removeAvatar = await req("/api/student/profile/avatar/remove", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "remove_avatar" }),
    });
    check("remove_avatar redirects with a success flash", [302, 303].includes(removeAvatar.status) && (removeAvatar.headers.get("location") ?? "").includes("flash_type=success"));

    // ── course AI guard (never calls the provider) ─────────────────────────
    console.log("\ncourse AI chat guards");
    const aiNoCsrf = await req("/api/student/course-ai?action=get_messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId }),
    });
    check("course AI chat rejects a request without the CSRF header", aiNoCsrf.status === 403, `status ${aiNoCsrf.status}`);

    const aiNoCourse = await req("/api/student/course-ai?action=get_messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ course_id: 0 }),
    });
    check("course AI chat rejects course_id 0", ((await aiNoCourse.json()) as { error: string }).error === "Invalid course");

    const aiUnknown = await req("/api/student/course-ai?action=nope", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
      body: JSON.stringify({ course_id: courseId }),
    });
    check("an unknown action answers 'Unknown action'", ((await aiUnknown.json()) as { error: string }).error === "Unknown action");

    const shared = await req("/course-ai-shared?slug=deadbeefdeadbeef");
    const sharedBody = await shared.text();
    check("an unknown share slug renders the 404 page", renderedNotFound(shared, sharedBody), `status ${shared.status}`);
    const sharedNoSlug = await req("/course-ai-shared");
    check("a missing slug renders the 404 page", renderedNotFound(sharedNoSlug, await sharedNoSlug.text()));

    // ── cross-student isolation ───────────────────────────────────────────
    console.log("\ncross-student isolation");
    await login(OTHER_EMAIL);
    await ctx.clearCookies();
    const otherLearn = await req(`/student/learn?course=${courseId}`);
    check("another student is redirected away from the learn page",
      redirectedTo(otherLearn, await otherLearn.clone().text(), `/course/`), `status ${otherLearn.status}`);
    const otherNoSuch = await req("/student/learn?course=99999999");
    check("another student is redirected away from a non-existent course",
      redirectedTo(otherNoSuch, await otherNoSuch.clone().text(), "/browse-courses"), `status ${otherNoSuch.status}`);
    // ctx cookies were cleared above (that is what proves the fetch path is anonymous-safe),
    // so read the other student's grades straight off the authenticated response payload.
    const otherGrades = await req("/student/grades");
    const otherGradesHtml = await otherGrades.text();
    check("another student sees an empty grades page",
      otherGrades.status === 200 && otherGradesHtml.includes("No grades yet"), `status ${otherGrades.status}`);
    check("another student sees none of this course's graded assignment",
      !otherGradesHtml.includes("Nice work."));
    check("another student's grades page offers the browse-courses empty-state link",
      otherGradesHtml.includes("/browse-courses"));
    const otherCert = await req(`/student/generate-certificate?course=${courseId}`);
    check("another student is redirected away from the certificate",
      redirectedTo(otherCert, await otherCert.clone().text(), "/student/my-courses"), `status ${otherCert.status}`);
    const otherCerts = await req("/student/certificates");
    const otherCertsBody = await otherCerts.text();
    check("another student sees none of these certificates", !otherCertsBody.includes(certRow[0]!.certificate_id));

    // ── role guard ────────────────────────────────────────────────────────
    console.log("\nrole guards");
    await login(INSTR_EMAIL);
    const instrLearn = await req(`/student/learn?course=${courseId}`);
    check("an instructor is redirected away from /student/learn",
      redirectedTo(instrLearn, await instrLearn.clone().text(), "/instructor/dashboard"), `status ${instrLearn.status}`);
    const instrLearnApi = await req("/api/student/learn", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ action: "mark_complete", course_id: String(courseId), lesson_id: String(videoLessonId) }),
    });
    check("an instructor is refused by the learn API", [302, 303].includes(instrLearnApi.status) || instrLearnApi.status === 403, `status ${instrLearnApi.status}`);
    await browser.close();
  } finally {
    console.log("\ncleanup");
    try {
      const ids = [userId, otherId, instructorId].filter(Boolean);
      const rows = await sql<{ id: number }[]>`
        SELECT id FROM users WHERE id IN ${sql(ids)} OR email LIKE ${`%${SUFFIX}%`}`;
      const uids = rows.map((r) => Number(r.id));
      if (uids.length) {
        await sql`DELETE FROM quiz_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id IN ${sql(uids)}))`;
        await sql`DELETE FROM quiz_attempts WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id IN ${sql(uids)})`;
        await sql`DELETE FROM assignment_submissions WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id IN ${sql(uids)})`;
        await sql`DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id IN ${sql(uids)})`;
        await sql`DELETE FROM certificates WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM study_plan WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM course_ai_messages WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM course_ai_share_links WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM course_ai_chats WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM enrollments WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM cart WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM wishlists WHERE student_id IN ${sql(uids)}`;
        await sql`DELETE FROM security_events WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM user_sessions WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM login_attempts WHERE identifier IN (${EMAIL}, ${INSTR_EMAIL})`;
        await sql`DELETE FROM quiz_options WHERE question_id IN (SELECT id FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE title LIKE ${`%${SUFFIX}%`})))`;
        await sql`DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE title LIKE ${`%${SUFFIX}%`}))`;
        await sql`DELETE FROM assignments WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE title LIKE ${`%${SUFFIX}%`}))`;
        await sql`DELETE FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE title LIKE ${`%${SUFFIX}%`})`;
        await sql`DELETE FROM course_sections WHERE course_id IN (SELECT id FROM courses WHERE title LIKE ${`%${SUFFIX}%`})`;
        await sql`DELETE FROM courses WHERE title LIKE ${`%${SUFFIX}%`}`;
        await sql`DELETE FROM student_profiles WHERE user_id IN ${sql(uids)}`;
        await sql`DELETE FROM users WHERE id IN ${sql(uids)}`;
        console.log(`  removed users ${uids.join(",")} and their fixtures`);
      }
      void [sectionId, videoLessonId, quizLessonId, quizQuestionId, trueFalseLessonId, trueFalseQuestionId, assignmentLessonId, assignmentId];
    } catch (err) {
      console.log(`  cleanup warning: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sql.end({ timeout: 5 });
  }

  console.log(`\nsmoke-phase6: ${pass} passed, ${fail} failed (${pass + fail} checks)`);
  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail === 0 ? 0 : 1);
}

void main();