import "../tests/helpers/env";
import { sql } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/passwords";

/**
 * End-to-end smoke for the instructor panel (Phase 8). It creates an approved instructor,
 * logs in through the real /login route so the session cookie is genuine, then walks every
 * panel page and exercises the course, section, lesson, quiz, assignment and publish writes
 * through the real HTTP endpoints. Everything it creates is removed at the end.
 *
 *   npm start -p 3100
 *   npm run smoke:phase8 -- http://localhost:3100
 */

const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const jar = new Map<string, string>();

function cookieHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res: Response): void {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function req(pathname: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Cookie: cookieHeader() };
  for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k] = v;
  if (method !== "GET" && !headers.Origin && !headers.origin) headers.Origin = BASE;
  const res = await fetch(`${BASE}${pathname}`, { ...init, redirect: "manual", headers });
  absorb(res);
  return res;
}

function csrf(): string {
  return jar.get(process.env.CSRF_COOKIE_NAME ?? "edulari_csrf") ?? "";
}

function form(obj: Record<string, string>): string {
  const p = new URLSearchParams({ csrf_token: csrf(), ...obj });
  return p.toString();
}

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

const ownerId = { value: 0 };
const otherOwnerId = { value: 0 };
const courseId = { value: 0 };

async function cleanup(): Promise<void> {
  if (ownerId.value) {
    await sql`DELETE FROM instructor_payouts WHERE instructor_id = ${ownerId.value}`;
    await sql`DELETE FROM quiz_answers WHERE attempt_id IN (
      SELECT qa.id FROM quiz_attempts qa JOIN lessons l ON l.id = qa.lesson_id
      JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM quiz_attempts WHERE lesson_id IN (
      SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM assignment_submissions WHERE lesson_id IN (
      SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM assignments WHERE lesson_id IN (
      SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM lesson_progress WHERE lesson_id IN (
      SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM enrollments WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM course_reviews WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM quiz_options WHERE question_id IN (
      SELECT q.id FROM quiz_questions q JOIN lessons l ON l.id = q.lesson_id
      JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM quiz_questions WHERE lesson_id IN (
      SELECT l.id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM course_sections WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = ${ownerId.value})`;
    await sql`DELETE FROM courses WHERE instructor_id = ${ownerId.value}`;
    await sql`DELETE FROM instructor_applications WHERE user_id = ${ownerId.value}`;
    await sql`DELETE FROM instructor_profiles WHERE user_id = ${ownerId.value}`;
    await sql`DELETE FROM user_sessions WHERE user_id = ${ownerId.value}`;
    await sql`DELETE FROM users WHERE id = ${ownerId.value}`;
  }
  if (otherOwnerId.value) {
    await sql`DELETE FROM courses WHERE instructor_id = ${otherOwnerId.value}`;
    await sql`DELETE FROM user_sessions WHERE user_id = ${otherOwnerId.value}`;
    await sql`DELETE FROM users WHERE id = ${otherOwnerId.value}`;
  }
}

async function main(): Promise<void> {
  console.log(`Phase 8 smoke against ${BASE}`);

  section("fixture");
  const email = `phase8-${Date.now()}@edulari.test`;
  const password = "Test12345";
  const [u] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, email_verified, is_active, registration_date)
    VALUES ('Phase Eight Instructor', ${email}, ${await hashPassword(password)}, 'instructor', true, true, now())
    RETURNING id`;
  ownerId.value = u.id;
  const [app] = await sql<{ id: number }[]>`
    INSERT INTO instructor_applications
      (user_id, status, professional_exp, course_ideas, target_audience, primary_subject, skill_level, submitted_at, updated_at)
    VALUES (${ownerId.value}, 'approved', ${"ten years ".repeat(10)}, ${"web dev ".repeat(10)},
            ${"beginners ".repeat(10)}, 'Web Development', 'intermediate', now(), now())
    RETURNING id`;
  check("an approved instructor fixture exists", Boolean(u.id) && Boolean(app.id));

  await sql`
    INSERT INTO instructor_profiles (user_id, headline, bio, years_exp)
    VALUES (${ownerId.value}, 'Senior Web Developer', ${"bio ".repeat(40)}, 6)`;

  const [cat] = await sql<{ id: number }[]>`SELECT id FROM categories ORDER BY id LIMIT 1`;

  section("login");
  const loginPage = await req("/login");
  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ email, password }),
  });
  const loginJson = (await login.json().catch(() => ({}))) as { success?: boolean; errors?: string[] };
  check("login succeeds for the approved instructor", loginJson.success === true, JSON.stringify(loginJson));
  check("a session cookie is issued", jar.has(process.env.SESSION_COOKIE_NAME ?? "edulari_session"), loginPage.status === 200 ? "login page ok" : "login page " + loginPage.status);

  section("panel pages");
  const pages: Array<[string, string]> = [
    ["/instructor/dashboard", "Welcome back"],
    ["/instructor/courses", "My Courses"],
    ["/instructor/create-course", "Create New Course"],
    ["/instructor/analytics", "Analytics"],
    ["/instructor/students", "My Students"],
    ["/instructor/reviews", "My Reviews"],
    ["/instructor/earnings", "Earnings"],
    ["/instructor/profile", "Personal Info"],
  ];
  for (const [path, needle] of pages) {
    const res = await req(path);
    const html = await res.text();
    check(`${path} renders`, res.status === 200 && html.includes(needle), `status ${res.status}`);
  }

  const dash = await (await req("/instructor/dashboard")).text();
  check("the dashboard shows the overview stats", dash.includes("Total Courses") && dash.includes("Average Rating"));
  const earn = await (await req("/instructor/earnings")).text();
  check("earnings shows the four KPIs and the payout card", earn.includes("Total Earnings") && earn.includes("Payout History"));
  const prof = await (await req("/instructor/profile")).text();
  check("profile renders all three panels", prof.includes("panel-personal") && prof.includes("panel-education") && prof.includes("panel-teaching"));

  section("create a course");
  const created = await req("/api/instructor/course", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      title: `Phase Eight Course ${Date.now()}`,
      short_description: "A course created by the Phase 8 smoke test.",
      description: "# Overview\n\nBody text.",
      category_id: String(cat.id),
      level: "intermediate",
      language: "English",
      duration_hours: "6",
      price: "499",
      certificate_enabled: "1",
      passing_percentage: "70",
    }),
  });
  const createdJson = (await created.json()) as { redirect?: string; error?: string };
  check("create redirects to the content page", Boolean(createdJson.redirect?.includes("/instructor/course-content?id=")), JSON.stringify(createdJson));
  courseId.value = Number(new URL(createdJson.redirect ?? "http://x/?id=0", BASE).searchParams.get("id") ?? 0);
  check("the course row exists", courseId.value > 0);

  const row = await sql<{ slug: string; is_published: boolean; price: string }[]>`
    SELECT slug, is_published, price FROM courses WHERE id = ${courseId.value}`;
  check("the slug was generated from the title", /^phase-eight-course-\d+$/.test(row[0]?.slug ?? ""), row[0]?.slug);
  check("a new course starts as a draft", row[0]?.is_published === false);

  section("validation");
  const noTitle = await req("/api/instructor/course", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ title: "", short_description: "x", category_id: String(cat.id), level: "beginner" }),
  });
  const noTitleJson = (await noTitle.json()) as { error?: string };
  check("a missing title is rejected", noTitleJson.error === "Course title is required.", JSON.stringify(noTitleJson));

  // Ownership is denied by the query filter, so the course belongs to a second instructor.
  const [other] = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, email_verified, is_active, registration_date)
    VALUES ('Other Instructor', ${`phase8-other-${Date.now()}@edulari.test`}, 'x', 'instructor', true, true, now())
    RETURNING id`;
  otherOwnerId.value = other.id;
  const foreign = await sql<{ id: number }[]>`
    INSERT INTO courses (instructor_id, title, slug, level, language, duration_hours, price, is_published, certificate_enabled, passing_percentage, created_at, updated_at)
    VALUES (${other.id}, 'Not Mine', ${`not-mine-${Date.now()}`}, 'beginner', 'English', 0, 0, false, true, 70, now(), now())
    RETURNING id`;
  const foreignEdit = await req(`/api/instructor/course/${foreign[0].id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "save", title: "Hijacked", short_description: "x", category_id: String(cat.id), level: "beginner" }),
  });
  const foreignJson = (await foreignEdit.json()) as { ok?: boolean; error?: string };
  check("another instructor's course cannot be edited", foreignJson.ok === false && Boolean(foreignJson.error), JSON.stringify(foreignJson));
  const stillThere = await sql<{ title: string }[]>`SELECT title FROM courses WHERE id = ${foreign[0].id}`;
  check("the foreign course is untouched", stillThere[0]?.title === "Not Mine");
  await sql`DELETE FROM courses WHERE id = ${foreign[0].id}`;

  section("content management");
  const addSection = await req(`/api/instructor/course/${courseId.value}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ add_section: "1", section_title: "Introduction" }),
  });
  const sectionJson = (await addSection.json()) as { redirect?: string };
  check("a section can be added", sectionJson.redirect?.includes("Section%20added%20successfully") === true, JSON.stringify(sectionJson));
  const sections = await sql<{ id: number }[]>`SELECT id FROM course_sections WHERE course_id = ${courseId.value}`;
  check("the section row exists", sections.length === 1);
  const sectionId = sections[0].id;

  const addLesson = await req(`/api/instructor/course/${courseId.value}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ add_lesson: "1", section_id: String(sectionId), lesson_title: "Welcome video", content_type: "video", video_url: "https://youtu.be/dQw4w9WgXcQ", video_duration: "212", is_free_preview: "1" }),
  });
  const lessonJson = (await addLesson.json()) as { redirect?: string };
  check("a video lesson can be added", lessonJson.redirect?.includes("Lesson%20added%20successfully") === true, JSON.stringify(lessonJson));
  const lessons = await sql<{ id: number; video_url: string; is_free_preview: boolean; sort_order: number }[]>`
    SELECT id, video_url, is_free_preview, sort_order FROM lessons WHERE course_id = ${courseId.value}`;
  check("the YouTube URL was normalised", lessons[0]?.video_url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", lessons[0]?.video_url);
  check("the free preview flag was stored", lessons[0]?.is_free_preview === true);

  const addQuiz = await req(`/api/instructor/course/${courseId.value}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrf_token: csrf(),
      add_lesson: "1",
      section_id: String(sectionId),
      lesson_title: "Basics quiz",
      content_type: "quiz",
      "quiz_questions[0][question]": "Which is 2 + 2?",
      "quiz_questions[0][type]": "multiple_choice",
      "quiz_questions[0][points]": "2",
      "quiz_questions[0][options][0]": "3",
      "quiz_questions[0][options][1]": "4",
      "quiz_questions[0][correct_option]": "1",
      "quiz_questions[1][question]": "Water is wet.",
      "quiz_questions[1][type]": "true_false",
      "quiz_questions[1][points]": "1",
      "quiz_questions[1][correct_answer]": "true",
    }).toString(),
  });
  check("a quiz lesson can be added", ((await addQuiz.json()) as { redirect?: string }).redirect?.includes("Lesson%20added") === true);
  const quizRows = await sql<{ id: number }[]>`
    SELECT l.id FROM lessons l WHERE l.course_id = ${courseId.value} AND l.content_type = 'quiz'`;
  const quizQuestions = await sql<{ question: string; question_type: string }[]>`
    SELECT question, question_type FROM quiz_questions WHERE lesson_id = ${quizRows[0].id} ORDER BY sort_order`;
  check("both questions were stored", quizQuestions.length === 2, JSON.stringify(quizQuestions));
  const quizOptions = await sql<{ option_text: string; is_correct: boolean }[]>`
    SELECT qo.option_text, qo.is_correct FROM quiz_options qo
    JOIN quiz_questions qq ON qq.id = qo.question_id WHERE qq.lesson_id = ${quizRows[0].id} ORDER BY qo.question_id, qo.sort_order`;
  const mcOptions = quizOptions.filter((o) => o.option_text === "3" || o.option_text === "4");
  check("multiple choice stored 2 options with one correct", mcOptions.length === 2 && mcOptions.filter((o) => o.is_correct).length === 1, JSON.stringify(mcOptions));
  const tfOptions = quizOptions.filter((o) => o.option_text === "True" || o.option_text === "False");
  check("true/false stored one correct option", tfOptions.length === 2 && tfOptions.filter((o) => o.is_correct).length === 1, JSON.stringify(tfOptions));
  check("true/false stored True and False", tfOptions.some((o) => o.option_text === "True") && tfOptions.some((o) => o.option_text === "False"));

  const addAssignment = await req(`/api/instructor/course/${courseId.value}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ add_lesson: "1", section_id: String(sectionId), lesson_title: "Homework", content_type: "assignment", assignment_instructions: "Submit a summary.", max_marks: "50", passing_marks: "20", due_days: "5" }),
  });
  check("an assignment lesson can be added", ((await addAssignment.json()) as { redirect?: string }).redirect?.includes("Lesson%20added") === true);
  const assignment = await sql<{ max_marks: number; passing_marks: number; due_days: number }[]>`
    SELECT max_marks, passing_marks, due_days FROM assignments WHERE lesson_id IN (
      SELECT id FROM lessons WHERE course_id = ${courseId.value} AND content_type = 'assignment')`;
  check("the assignment stores its marks and due days", assignment[0]?.max_marks === 50 && assignment[0]?.passing_marks === 20 && assignment[0]?.due_days === 5);

  const contentPage = await req(`/instructor/course-content?id=${courseId.value}`);
  const contentHtml = await contentPage.text();
  check("the content page lists the sections and lessons", contentHtml.includes("Introduction") && contentHtml.includes("Welcome video"));
  // React separates adjacent text nodes with a <!-- --> comment, so match on the numbers
  // and the labels rather than on one contiguous run of text.
  const flat = contentHtml.replace(/<!-- -->/g, "");
  check(
    "the content page shows the quiz and assignment badges",
    flat.includes("2 questions · 3 pts") && flat.includes("50 marks · 5 days"),
    "badge text missing",
  );

  section("publish and analytics");
  const publish = await req(`/api/instructor/course/${courseId.value}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "publish" }),
  });
  const publishJson = (await publish.json()) as { redirect?: string };
  check("publishing redirects back to the list", publishJson.redirect?.startsWith("/instructor/courses?msg=") === true, JSON.stringify(publishJson));
  const published = await sql<{ is_published: boolean; published_at: Date | null }[]>`
    SELECT is_published, published_at FROM courses WHERE id = ${courseId.value}`;
  check("the course is published with a timestamp", published[0]?.is_published === true && Boolean(published[0]?.published_at));

  const ca = await req(`/instructor/course-analytics?id=${courseId.value}`);
  const caHtml = await ca.text();
  check("course analytics renders", ca.status === 200 && caHtml.includes("Total Students") && caHtml.includes("Quiz Performance"), `status ${ca.status}`);
  check("course analytics lists the quiz", caHtml.includes("Basics quiz"));

  const edit = await req(`/instructor/edit-course?id=${courseId.value}`);
  const editHtml = await edit.text();
  check("edit course renders with the saved values", edit.status === 200 && editHtml.includes("Phase Eight Course") && editHtml.includes("499"), `status ${edit.status}`);
  check("edit course shows the published badge", editHtml.includes("Published"));

  const listed = await req("/instructor/courses?status=published");
  const listedHtml = await listed.text();
  check("the published course appears in the filtered list", listedHtml.includes("Phase Eight Course"));

  section("delete cascade");
  const del = await req(`/api/instructor/course/${courseId.value}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "delete", confirm_delete: "yes" }),
  });
  const delJson = (await del.json()) as { redirect?: string };
  check("delete redirects back to the list", delJson.redirect?.startsWith("/instructor/courses?msg=") === true, JSON.stringify(delJson));
  const leftovers = await sql<{ id: number }[]>`SELECT id FROM courses WHERE id = ${courseId.value}`;
  check("the course row is gone", leftovers.length === 0);
  const orphans = await sql<{ lesson_count: string; section_count: string; question_count: string; assignment_count: string }[]>`
    SELECT
      (SELECT COUNT(*) FROM lessons WHERE course_id = ${courseId.value})::text AS lesson_count,
      (SELECT COUNT(*) FROM course_sections WHERE course_id = ${courseId.value})::text AS section_count,
      (SELECT COUNT(*) FROM quiz_questions WHERE lesson_id NOT IN (SELECT id FROM lessons))::text AS question_count,
      (SELECT COUNT(*) FROM assignments WHERE lesson_id NOT IN (SELECT id FROM lessons))::text AS assignment_count`;
  check(
    "no lessons, sections, questions or assignments were orphaned",
    orphans[0]?.lesson_count === "0" &&
      orphans[0]?.section_count === "0" &&
      orphans[0]?.question_count === "0" &&
      orphans[0]?.assignment_count === "0",
    JSON.stringify(orphans[0]),
  );
  courseId.value = 0;

  section("profile writes");
  const saveProfile = await req("/api/instructor/profile", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "save_personal", phone: "+91 99999 88888", bio: "Updated bio ".repeat(20), headline: "Lead Educator", website: "https://example.test", teaching_style: "project" }),
  });
  const profileJson = (await saveProfile.json()) as { redirect?: string };
  check("saving the personal tab redirects", profileJson.redirect?.startsWith("/instructor/profile?tab=personal") === true, JSON.stringify(profileJson));
  const savedProfile = await sql<{ headline: string; website: string; teaching_style: string }[]>`
    SELECT headline, website, teaching_style FROM instructor_profiles WHERE user_id = ${ownerId.value}`;
  check("the profile fields were written", savedProfile[0]?.headline === "Lead Educator" && savedProfile[0]?.website === "https://example.test" && savedProfile[0]?.teaching_style === "project");
  
  

  const longBio = await req("/api/instructor/profile", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "save_personal", bio: "x".repeat(1501) }),
  });
  check("a bio over 1500 characters is rejected", ((await longBio.json()) as { error?: string }).error === "Bio cannot exceed 1 500 characters.");

  const saveEducation = await req("/api/instructor/profile", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "save_education", highest_education: "masters", institution: "IIT", field_of_study: "CS", graduation_year: "2015" }),
  });
  check("saving the education tab redirects", ((await saveEducation.json()) as { redirect?: string }).redirect?.startsWith("/instructor/profile?tab=education") === true);
  const edu = await sql<{ highest_education: string; institution: string }[]>`
    SELECT highest_education, institution FROM instructor_applications WHERE user_id = ${ownerId.value}`;
  check("the education fields were written", edu[0]?.highest_education === "masters" && edu[0]?.institution === "IIT");

  section("csrf");
  const noCsrf = await req("/api/instructor/course", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title: "No token", short_description: "x", category_id: String(cat.id), level: "beginner" }).toString(),
  });
  check("a POST without a CSRF token is refused", noCsrf.status === 403, `status ${noCsrf.status}`);
  const badOrigin = await fetch(`${BASE}/api/instructor/course`, {
    method: "POST",
    redirect: "manual",
    headers: { Cookie: cookieHeader(), Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ title: "x", short_description: "x", category_id: String(cat.id), level: "beginner" }),
  });
  check("a foreign Origin is refused", badOrigin.status === 403, `status ${badOrigin.status}`);

  section("filters");
  const filtered = await req("/instructor/students?progress=completed&sort=name");
  check("the students filters accept a GET query", filtered.status === 200, `status ${filtered.status}`);
  const reviewsTab = await req("/instructor/reviews?tab=personal");
  check("the reviews personal tab renders", reviewsTab.status === 200 && (await reviewsTab.clone().text()).includes("Personal Ratings"));
  const earningsYear = await req(`/instructor/earnings?year=${new Date().getUTCFullYear()}&month=0`);
  check("the earnings filters render", earningsYear.status === 200, `status ${earningsYear.status}`);
}

main()
  .catch((err) => {
    console.error(err);
    fail++;
    failures.push(`threw: ${err instanceof Error ? err.message : String(err)}`);
  })
  .finally(async () => {
    console.log("\ncleanup");
    try {
      await cleanup();
      console.log(`  removed user ${ownerId.value} and its fixtures`);
    } catch (err) {
      console.error("cleanup failed", err);
    }
    await sql.end();
    console.log("\n================================================");
    console.log(`smoke-phase8: ${pass} passed, ${fail} failed (${pass + fail} checks)`);
    if (failures.length) {
      console.log("\nfailures:");
      for (const f of failures) console.log(`  - ${f}`);
    }
    process.exit(fail > 0 ? 1 : 0);
  });