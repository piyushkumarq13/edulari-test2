// Loads .env.local/.env before any module that reads the environment (lib/config.ts
// validates it at import time, and lib/db/client.ts connects on first use).
import "../tests/helpers/env";
import { sql } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/passwords";
import { consumeEmailVerificationToken } from "@/lib/auth/tokens";

/**
 * End-to-end smoke for the instructor-registration wizard and the competency test.
 * It drives the real HTTP routes against a running server, exactly like a browser would,
 * and cleans up everything it creates.
 *
 *   npm start -p 3100
 *   npm run smoke:phase7 -- http://localhost:3100
 */

const BASE = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");

const jar = new Map();
function cookieHeader(): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
function absorb(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair!.indexOf("=");
    if (i <= 0) continue;
    const name = pair!.slice(0, i).trim();
    const value = pair!.slice(i + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}
function csrf(): string {
  return jar.get(process.env.CSRF_COOKIE_NAME ?? "edulari_csrf") ?? "";
}

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

async function req(pathname: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { Cookie: cookieHeader() };
  for (const [k, v] of Object.entries((init.headers ?? {}) as Record<string, string>)) headers[k] = v;
  if (method !== "GET" && !headers.Origin && !headers.origin) headers.Origin = BASE;
  const res = await fetch(`${BASE}${pathname}`, { ...init, redirect: "manual", headers });
  absorb(res);
  return res;
}

/** Follow the wizard's own redirects so the assertion sees the rendered page. */
async function getFollowing(pathname: string, hops = 0): Promise<Response> {
  const res = await req(pathname);
  if (res.status >= 300 && res.status < 400 && hops < 6) {
    const loc = res.headers.get("location");
    if (loc) {
      absorb(res);
      return getFollowing(loc.startsWith("http") ? loc : new URL(loc, BASE).pathname + new URL(loc, BASE).search, hops + 1);
    }
  }
  return res;
}

function form(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams({ csrf_token: csrf(), ...fields });
}

async function main() {
  console.log(`Phase 7 smoke against ${BASE}\n`);

  const email = `phase7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@edulari.test`;
  const password = "Test12345";
  let userId = 0;
  let token = "";

// ── CSRF + session bootstrap ───────────────────────────────────────────────
console.log("session bootstrap");
  const boot = await req("/instructor-register");
  check("the wizard index redirects", boot.status === 307, `status ${boot.status}`);

  // The first visit bounces through /api/reg-session, which creates the row and sets the
  // cookie, then returns to the requested step. Follow that hop explicitly.
  const hop = await req("/api/reg-session?next=%2Finstructor-register%2Fstep-1");
  check("the session bootstrap sets the reg cookie and forwards", hop.status === 307, `status ${hop.status}`);
  check("the reg session cookie was issued", Boolean(jar.get(process.env.REG_SESSION_COOKIE_NAME ?? "edulari_reg_session")));

  const page = await req("/instructor-register/step-1");
  const html = await page.text();
  check("step 1 renders", page.status === 200 && html.includes("Create your instructor account"));
  check("the 8-dot stepper is rendered", (html.match(/class="progress-step/g) ?? []).length === 8);
  check("the CSRF cookie was issued", csrf().length === 64, `len ${csrf().length}`);
  check("the left panel copy is present", html.includes("Create your") && html.includes("instructor account"));
  check("the perks list is present", html.includes("Earn up to 70% revenue share"));

  // ── Guards ─────────────────────────────────────────────────────────────────
  console.log("\nstep guards");
  for (const n of [2, 4, 6, 8]) {
    const res = await getFollowing(`/instructor-register/step-${n}`);
    const html2 = await res.text();
    const shown = /<h1[^>]*>([^<]*)<\/h1>/.exec(html2)?.[1] ?? "";
    check(`step ${n} is blocked before the wizard starts`, shown.includes("Create your instructor account"), shown);
  }

  const badOrigin = await fetch(`${BASE}/api/instructor-register/step/2`, {
    method: "POST",
    redirect: "manual",
    headers: { Cookie: cookieHeader(), Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ headline: "x".repeat(120), bio: "y".repeat(120) }),
  });
  check("a foreign Origin is refused", badOrigin.status === 403, `status ${badOrigin.status}`);

  const noCsrf = await fetch(`${BASE}/api/instructor-register/step/2`, {
    method: "POST",
    redirect: "manual",
    headers: { Cookie: cookieHeader(), Origin: BASE, "Content-Type": "application/x-www-form-urlencoded" },
    body: "headline=x&bio=y",
  });
  check("a missing CSRF token is refused", noCsrf.status === 403, `status ${noCsrf.status}`);

  // ── Step 1: create the account ─────────────────────────────────────────────
  console.log("\nstep 1 — account");
  const created = await req("/api/instructor-register/step/1", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ name: "Phase Seven", email, password, confirm_password: password, terms: "on" }),
  });
  const createdJson = (await created.json()) as { ok: boolean; redirect?: string; error?: string };
  check("the account is created", createdJson.ok === true && createdJson.redirect === "/instructor-register/step-1", JSON.stringify(createdJson));

  const users = await sql<{ id: number; role: string; is_active: boolean; email_verified: boolean }[]>`
    SELECT id, role, is_active, email_verified FROM users WHERE email = ${email}`;
  userId = Number(users[0]?.id ?? 0);
  check("the user row exists with role=instructor, inactive, unverified",
    Boolean(userId) && users[0].role === "instructor" && users[0].is_active === false && users[0].email_verified === false,
    JSON.stringify(users[0]));

  const verifyPage = await req("/instructor-register/step-1");
  const verifyHtml = await verifyPage.text();
  check("the verify-email gate is shown", verifyHtml.includes("Check your inbox") && verifyHtml.includes("Verified My Email"));

  // Verify the email through the real token table, then continue.
  const vtokens = await sql<{ token: string }[]>`SELECT token FROM email_verification_tokens WHERE user_id = ${userId}`;
  const consumed = await consumeEmailVerificationToken(vtokens[0].token);
  check("the email verification token is consumable", consumed.ok);

  const proceed = await req("/api/instructor-register/step/1", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ check_email_verified: "1" }),
  });
  const proceedJson = (await proceed.json()) as { redirect?: string };
  check("verification advances to step 2", proceedJson.redirect === "/instructor-register/step-2", JSON.stringify(proceedJson));

  const step2Page = await req("/instructor-register/step-2");
  const step2Html = await step2Page.text();
  check("step 2 renders", step2Page.status === 200 && step2Html.includes("Professional Profile"));
  check("step 2 has the years-of-experience select", step2Html.includes('id="years_exp"'));
  check("step 2 has the collapsible social links", step2Html.includes('aria-controls="socialLinksBody"'));

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 2 — profile");
  const badBio = await req("/api/instructor-register/step/2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ headline: "Senior Web Developer", bio: "too short", years_exp: "3", teaching_style: "Mixed" }),
  });
  const badBioJson = (await badBio.json()) as { error?: string };
  check("a short bio is rejected", badBioJson.error === "Bio must be at least 100 characters.", badBioJson.error);

  const step2 = await req("/api/instructor-register/step/2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      headline: "Senior Web Developer & React Specialist",
      bio: "I have spent twelve years building web products and teaching engineers how to ship reliable front-end code. ".repeat(2),
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/example",
      twitter: "https://twitter.com/example",
      years_exp: "6",
      teaching_style: "Project-based",
    }),
  });
  const step2Json = (await step2.json()) as { redirect?: string };
  check("step 2 saves and advances to step 3", step2Json.redirect === "/instructor-register/step-3", JSON.stringify(step2Json));

  const profile = await sql<{ headline: string; years_exp: number; teaching_style: string }[]>`
    SELECT headline, years_exp, teaching_style FROM instructor_profiles WHERE user_id = ${userId}`;
  check("the instructor_profiles draft was written", profile[0]?.headline === "Senior Web Developer & React Specialist" && Number(profile[0]?.years_exp) === 6);
  check("last_completed_step advanced to 2",
    Number((await sql<{ last_completed_step: number }[]>`SELECT last_completed_step FROM instructor_applications WHERE user_id = ${userId}`)[0]?.last_completed_step) === 2);

  // ── Step 3 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 3 — credentials");
  const step3 = await req("/api/instructor-register/step/3", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      highest_education: "Master's Degree",
      institution: "IIT Delhi",
      field_of_study: "Computer Science",
      graduation_year: "2015",
      certifications: "AWS Certified",
      professional_exp: "Ten years building web platforms.",
      notable_works: "",
    }),
  });
  check("step 3 saves and advances to step 4", ((await step3.json()) as { redirect?: string }).redirect === "/instructor-register/step-4");

  // ── Step 4 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 4 — subjects");
  const badIdeas = await req("/api/instructor-register/step/4", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ primary_subject: "Web Development", skill_level: "Intermediate", target_audience: "Professionals", course_ideas: "short" }),
  });
  const badIdeasJson = (await badIdeas.json()) as { error?: string };
  check("short course ideas are rejected", badIdeasJson.error === "Please describe your course ideas in at least 50 characters.", badIdeasJson.error ?? "no error");

  const step4 = await req("/api/instructor-register/step/4", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      primary_subject: "Web Development",
      secondary_subjects: "React, Node.js",
      skill_level: "Intermediate",
      target_audience: "Working professionals",
      course_ideas: "I want to build two courses: a practical React course and a production Node.js API course.",
      sample_content: "https://example.com/sample",
    }),
  });
  check("step 4 saves and advances to step 5", ((await step4.json()) as { redirect?: string }).redirect === "/instructor-register/step-5");

  const step5Page = await req("/instructor-register/step-5");
  const step5Html = await step5Page.text();
  check("step 5 renders the trust banner", step5Page.status === 200 && step5Html.includes("Your data is protected"));
  check("step 5 has all three agreement checkboxes",
    step5Html.includes('id="agree_terms"') && step5Html.includes('id="agree_quality"') && step5Html.includes('id="agree_revenue"'));

  // ── Step 5 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 5 — legal & payout");
  const noAgree = await req("/api/instructor-register/step/5", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ skip_payout: "1" }),
  });
  const noAgreeJson = (await noAgree.json()) as { error?: string };
  check("all three agreements are required", noAgreeJson.error === "Please accept all three agreements to continue.", noAgreeJson.error ?? "no error");

  const badPan = await req("/api/instructor-register/step/5", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      pan_number: "BAD", bank_name: "SBI", account_number: "1234", ifsc_code: "SBIN0001234",
      account_holder: "Phase Seven", agree_terms: "1", agree_quality: "1", agree_revenue: "1",
    }),
  });
  const badPanJson = (await badPan.json()) as { error?: string };
  check("a malformed PAN is rejected", badPanJson.error === "Invalid PAN number format. Expected format: ABCDE1234F", badPanJson.error ?? "no error");

  const badIfsc = await req("/api/instructor-register/step/5", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      pan_number: "ABCDE1234F", bank_name: "SBI", account_number: "1234", ifsc_code: "SBIN123",
      account_holder: "Phase Seven", agree_terms: "1", agree_quality: "1", agree_revenue: "1",
    }),
  });
  check("a malformed IFSC is rejected", !((await badIfsc.json()) as { ok: boolean }).ok);

  const step5 = await req("/api/instructor-register/step/5", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      pan_number: "ABCDE1234F", bank_name: "State Bank of India", account_number: "1234567890",
      ifsc_code: "SBIN0001234", account_holder: "Phase Seven",
      agree_terms: "1", agree_quality: "1", agree_revenue: "1",
    }),
  });
  const step5Json = (await step5.json()) as { redirect?: string; error?: string };
  check("step 5 saves and advances to step 6", step5Json.redirect === "/instructor-register/step-6", JSON.stringify(step5Json));

  const app1 = await sql<{ pan_number: string; bank_account: string; ifsc_code: string; account_holder: string }[]>`
    SELECT pan_number, bank_account, ifsc_code, account_holder FROM instructor_applications WHERE user_id = ${userId}`;
  check("the PAN is encrypted at rest", Boolean(app1[0]?.pan_number) && app1[0].pan_number !== "ABCDE1234F");
  check("the bank account is encrypted at rest", app1[0]?.bank_account !== "1234567890");
  check("the IFSC is encrypted at rest", app1[0]?.ifsc_code !== "SBIN0001234");
  check("the account holder is encrypted at rest", app1[0]?.account_holder !== "Phase Seven");

  const { decryptSensitive } = await import("@/lib/db/instructor-registration");
  const dec = decryptSensitive(app1[0]);
  check("the encrypted values decrypt back", dec.pan_number === "ABCDE1234F" && dec.bank_account === "1234567890" && dec.ifsc_code === "SBIN0001234");

  // ── Step 6 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 6 — review");
  const step6Page = await req("/instructor-register/step-6");
  const step6Html = await step6Page.text();
  check("step 6 renders the review summary", step6Page.status === 200 && step6Html.includes("Application Review"));
  check("the review shows the profile", step6Html.includes("Senior Web Developer &amp; React Specialist"));
const bankRow = await sql<{ bank_name: string }[]>`SELECT bank_name FROM instructor_applications WHERE user_id = ${userId}`;
  check("the review shows the masked bank account",
    step6Html.includes("State Bank of India") && step6Html.includes("7890"),
    `db=${JSON.stringify(bankRow[0]?.bank_name)}`);
  check("the locked account row is present", step6Html.includes('🔒 Locked'));
  check("the hidden edit form exists", step6Html.includes('id="reviewEditForm"'));
  check("edit buttons post edit_step_N", step6Html.includes('value="edit_step_2"') && step6Html.includes('value="edit_step_5"'));

  const cont = await req("/api/instructor-register/step/6", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "continue" }),
  });
  check("continue advances to step 7", ((await cont.json()) as { redirect?: string }).redirect === "/instructor-register/step-7");

  // Edit mode: jump back to step 2 and confirm the return-to-6 behaviour.
  const editJump = await req("/api/instructor-register/step/6", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "edit_step_2" }),
  });
  check("edit_step_2 jumps back to step 2", ((await editJump.json()) as { redirect?: string }).redirect === "/instructor-register/step-2");

  const backToReview = await req("/api/instructor-register/step/2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      headline: "Principal Web Developer",
      bio: "A much longer biography that comfortably clears the one hundred character minimum. ".repeat(2),
      years_exp: "11", teaching_style: "Mixed",
    }),
  });
  check("saving in edit mode returns to step 6", ((await backToReview.json()) as { redirect?: string }).redirect === "/instructor-register/step-6");

  const editProfile = await sql<{ headline: string }[]>`SELECT headline FROM instructor_profiles WHERE user_id = ${userId}`;
  check("the edit was persisted", editProfile[0]?.headline === "Principal Web Developer");

  const outOfRange = await req("/api/instructor-register/step/6", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "edit_step_8" }),
  });
  check("edit_step_8 is ignored (outside 2..5)", ((await outOfRange.json()) as { redirect?: string }).redirect === undefined);

  // Back to step 7 for the document upload.
  await req("/api/instructor-register/step/6", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "continue" }),
  });

  const step7Page = await req("/instructor-register/step-7");
  const step7Html = await step7Page.text();
  check("step 7 renders", step7Page.status === 200 && step7Html.includes("Document Upload"));
  check("both file inputs are present", step7Html.includes('id="govt_id"') && step7Html.includes('id="marksheet"'));

  // ── Step 7 (documents, B2 not configured -> rejected before any write) ─────
  console.log("\nstep 7 — documents");
  const badUpload = await req("/api/instructor-register/step/7", {
    method: "POST",
    body: (() => {
      const fd = new FormData();
      fd.set("csrf_token", csrf());
      fd.set("govt_id", new Blob(["not really an image"], { type: "text/plain" }), "notes.txt");
      fd.set("marksheet", new Blob([Buffer.from("%PDF-1.4\n%fake")], { type: "application/pdf" }), "marks.pdf");
      return fd;
    })(),
  });
  const badUploadJson = (await badUpload.json()) as { ok: boolean };
  check("a disallowed file type is rejected", badUploadJson.ok === false);
  const stillDraft = await sql<{ govt_id_file: string | null }[]>`SELECT govt_id_file FROM instructor_applications WHERE user_id = ${userId}`;
  check("a rejected upload writes no filename", !stillDraft[0]?.govt_id_file);

  // ── Step 8 ─────────────────────────────────────────────────────────────────
  console.log("\nstep 8 — test preview");
  // Move the wizard forward without documents so step 8 is reachable (B2 is not
  // configured in this environment, so the upload step cannot complete).
  await sql`UPDATE instructor_reg_sessions SET step = 8 WHERE token = ${jar.get(process.env.REG_SESSION_COOKIE_NAME ?? "edulari_reg_session") ?? ""}`;

  const step8Page = await req("/instructor-register/step-8");
  const step8Html = await step8Page.text();
  check("step 8 renders the test preview", step8Page.status === 200 && step8Html.includes("Your Competency Test"));
  check("step 8 shows the subject", step8Html.includes("Web Development"));
  check("step 8 shows the passing score text", step8Html.includes("60% or above"));
  check("step 8 shows the rules", step8Html.includes("multiple-choice"));
  check("step 8 has the back button id", step8Html.includes('id="step8BackBtn"'));

  const start = await req("/api/instructor-register/step/8", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "start_test" }),
  });
  const startJson = (await start.json()) as { redirect?: string };
  check("start_test issues a test token", Boolean(startJson.redirect?.startsWith("/test?token=")), JSON.stringify(startJson));
  token = new URL(startJson.redirect ?? "", BASE).searchParams.get("token") ?? "";

  const tokRow = await sql<{ user_id: number; used: boolean; started_at: Date | null; redirect_pass: string; on_pass_action: string }[]>`
    SELECT user_id, used, started_at, redirect_pass, on_pass_action FROM test_tokens WHERE token = ${token}`;
  check("the token row belongs to the applicant", Number(tokRow[0]?.user_id) === userId);
  check("the token starts unstarted and unused", tokRow[0]?.used === false && tokRow[0]?.started_at === null);
  check("the token carries the pass redirect", tokRow[0]?.redirect_pass === "/instructor-register-success");
  check("the token carries the instructor callback", tokRow[0]?.on_pass_action === "instructor_registration");

  // ── One-test-per-user ──────────────────────────────────────────────────────
  console.log("\none attempt per user");
  const attempt1 = await sql<{ test_attempt_started_at: Date | null }[]>`
    SELECT test_attempt_started_at FROM instructor_applications WHERE user_id = ${userId}`;
  check("no attempt has been started yet", attempt1[0]?.test_attempt_started_at === null);

  await sql`UPDATE test_tokens SET started_at = now(), started_ip = '1.2.3.4' WHERE token = ${token}`;
  await sql`UPDATE instructor_applications SET test_attempt_started_at = now() WHERE user_id = ${userId}`;

  const second = await req("/api/instructor-register/step/8", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "start_test" }),
  });
  const secondJson = (await second.json()) as { redirect?: string; error?: string };
  check("a second start resumes the live token, never a second one", secondJson.redirect === `/test?token=${token}`, JSON.stringify(secondJson));

  const tokenCount = await sql<{ c: string }[]>`
    SELECT count(*)::text AS c FROM test_tokens WHERE user_id = ${userId} AND on_pass_action = 'instructor_registration'`;
  check("no second token row was created", Number(tokenCount[0].c) === 1, `count ${tokenCount[0].c}`);

  await sql`DELETE FROM test_tokens WHERE user_id = ${userId}`;
  await sql`UPDATE instructor_applications SET test_attempt_started_at = now() WHERE user_id = ${userId}`;
  const noLive = await req("/api/instructor-register/step/8", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ action: "start_test" }),
  });
  const noLiveJson = (await noLive.json()) as { error?: string };
  check("with no live token the one-attempt rule is enforced",
    noLiveJson.error === "This account has already completed its one competency test attempt.", noLiveJson.error);

  // ── Test page guards ───────────────────────────────────────────────────────
  console.log("\ntest page guards");
  const noTok = await req("/test");
  check("a token-less /test renders without an error", noTok.status === 200);

  const badTok = await req(`/test?token=${"0".repeat(64)}`);
  const badHtml = await badTok.text();
  check("an unknown token renders the invalid path", badTok.status === 200 && !/question-card/.test(badHtml));

  // ── Test page: token resume ────────────────────────────────────────────────
  console.log("\ntest page");
  token = (await sql<{ token: string }[]>`SELECT token FROM test_tokens WHERE user_id = ${userId} AND used = false LIMIT 1`)[0]?.token ?? "";
  if (token) {
    const introPage = await req(`/test?token=${token}`);
    const introHtml = await introPage.text();
    check("the intro phase renders", introPage.status === 200 && introHtml.includes("Before You Begin"));
    check("the fullscreen gate is present", introHtml.includes("fullscreenGate") || introHtml.includes("Fullscreen Required"));
    check("the single-use rule is shown", introHtml.includes("can only be used once"));

    // go_details
    const details = await req("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ token, action: "go_details" }),
    });
    check("go_details is accepted", details.status === 200 && ((await details.json()) as { ok: boolean }).ok === true);

    // autosave guards (before start, questions are empty -> invalid index)
    const autosaveBad = await req("/api/test/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ token, autosave_answer: "1", question_index: "0", option_letter: "A" }),
    });
    const autosaveJson = (await autosaveBad.json()) as { ok: boolean; reason?: string };
    check("autosave before start is rejected", autosaveJson.ok === false, JSON.stringify(autosaveJson));

    const noCsrfAutosave = await fetch(`${BASE}/api/test/autosave`, {
      method: "POST",
      redirect: "manual",
      headers: { Cookie: cookieHeader(), Origin: BASE, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, question_index: "0", option_letter: "A" }),
    });
    check("autosave without CSRF is refused", noCsrfAutosave.status === 403, `status ${noCsrfAutosave.status}`);

    const violation = await req("/api/test/violation", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ token, violation_type: "devtools_attempt" }),
    });
    check("violation logging is accepted", ((await violation.json()) as { ok: boolean }).ok === true);
  }

  // ── Failure path ───────────────────────────────────────────────────────────
  console.log("\ntest failure path");
  if (token) {
    await sql`
      UPDATE test_tokens
      SET started_at = now() - interval '5 minutes',
          expires_at = now() + interval '30 minutes',
          questions_data = ${sql.json([
            { question: "Q1?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" },
            { question: "Q2?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "B" },
          ])}::jsonb,
          answers_data = ${sql.json({ "0": "D", "1": "D" })}::jsonb
      WHERE token = ${token}`;

    // Submit two wrong answers -> fail.
    const submit = await req("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ token, action: "submit_test", q_0: "D", q_1: "D" }),
    });
    const submitJson = (await submit.json()) as { state?: { result?: { passed: boolean; score: number; correct: number; total: number; retry_date: string }; redirect?: string } };
    check("two wrong answers fail the test", submitJson.state?.result?.passed === false, JSON.stringify(submitJson.state?.result));
    check("the score is 0 of 2", submitJson.state?.result?.score === 0 && submitJson.state?.result?.correct === 0);
    check("a retry date is returned", Boolean(submitJson.state?.result?.retry_date));

    const failed = await sql<{ status: string; test_score: number }[]>`
      SELECT status, test_score FROM instructor_applications WHERE user_id = ${userId}`;
    check("the application is marked test_failed", failed[0]?.status === "test_failed", failed[0]?.status);
    check("the failing score is stored", Number(failed[0]?.test_score) === 0);

    const block = await sql<{ c: string }[]>`
      SELECT count(*)::text AS c FROM test_failures WHERE user_id = ${userId}`;
    check("a 7-day cooldown row was written", Number(block[0].c) >= 1);

    const gone = await sql<{ c: string }[]>`
      SELECT count(*)::text AS c FROM test_tokens WHERE user_id = ${userId}`;
    check("the token was consumed and deleted", Number(gone[0].c) === 0);

    const blockedPage = await req("/instructor-register/step-1");
    const blockedHtml = await blockedPage.text();
    check("the IP block now blocks registration", blockedHtml.includes("Registration Blocked"), "expected the block card");
  }

  // ── Pass path ──────────────────────────────────────────────────────────────
  console.log("\ntest pass path");
  const passUser = await sql<{ id: number }[]>`
    INSERT INTO users (name, email, password, role, email_verified, is_active)
    VALUES ('Phase Seven Pass', ${`phase7-pass-${Date.now()}@edulari.test`}, ${await hashPassword("Test12345")}, 'instructor', true, false)
    RETURNING id`;
  const passId = Number(passUser[0].id);

  await sql`
    INSERT INTO instructor_profiles (user_id, headline, bio) VALUES (${passId}, 'Head', ${"bio ".repeat(40)})`;
  await sql`
    INSERT INTO instructor_applications
      (user_id, highest_education, institution, field_of_study, professional_exp,
       primary_subject, skill_level, target_audience, course_ideas, full_legal_name, status)
    VALUES (${passId}, 'Master''s Degree', 'IIT', 'CS', 'Ten years', 'Web Development', 'Intermediate', 'Pros', ${"ideas ".repeat(20)}, 'Phase Seven Pass', 'draft')`;

  const passToken = (await sql<{ token: string }[]>`
    INSERT INTO test_tokens (user_id, token, expires_at, used, test_data, on_pass_action, redirect_pass, redirect_fail, started_at, questions_data, answers_data, started_ip)
    VALUES (
      ${passId}, ${"a".repeat(64)}, now() + interval '30 minutes', false,
      ${sql.json({
        user_id: passId,
        name: "Phase Seven Pass",
        email: `phase7-pass-${Date.now()}@edulari.test`,
        test_title: "Instructor Competency Test",
        test_badge_label: "📝 Competency Test",
        profile: { headline: "Senior Developer", bio: "Ten years building web products for Indian learners.", website: "https://example.test", linkedin: "https://linkedin.example/in/pass", twitter: "https://x.com/pass", years_exp: 6, teaching_style: "Practical, project-first" },
        credentials: { highest_education: "Masters Degree", institution: "IIT", field_of_study: "CS", graduation_year: 2015, certifications: "AWS", professional_exp: "Ten years", notable_works: "Portal A" },
        competency: { primary_subject: "Web Development", secondary_subjects: "React", skill_level: "Intermediate", target_audience: "Pros", course_ideas: "Build a SaaS", sample_content: "Sample chapter" },
        legal: { full_legal_name: "Phase Seven Pass", pan_number: "ABCDE1234F", bank_name: "SBI", account_number: "1234567890", ifsc_code: "SBIN0001234", account_holder: "Phase Seven Pass", upi_id: "", skip_payout: 0, revenue_share_ack: 1, terms_agreed: 1, content_policy: 1 },
        documents: { govt_id_file: "", marksheet_file: "" },
      })},
      'instructor_registration', '/instructor-register-success', '/instructor-register/step-8',
      now() - interval '3 minutes',
      ${sql.json([
        { question: "Q1?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" },
        { question: "Q2?", options: { A: "a", B: "b", C: "c", "D": "d" }, answer: "B" },
      ])},
      ${sql.json({})},
      '5.6.7.8'
    ) RETURNING token`)[0].token;

  const passSubmit = await req("/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrf_token: csrf(), token: passToken, action: "submit_test", q_0: "A", q_1: "B" }),
  });
  const passJson = (await passSubmit.json()) as { state?: { redirect?: string } };
  check("two correct answers pass the test", passJson.state?.redirect === "/instructor-register-success", JSON.stringify(passJson.state));

  const approved = await sql<{ status: string; test_score: number; test_time_taken_seconds: number }[]>`
    SELECT status, test_score, test_time_taken_seconds FROM instructor_applications WHERE user_id = ${passId}`;
  check("the application is pending review", approved[0]?.status === "pending", approved[0]?.status);
  check("the passing score is stored", Number(approved[0]?.test_score) === 100);
  check("the time taken is recorded from the server clock", Number(approved[0]?.test_time_taken_seconds) >= 175);

  const successPage = await req("/instructor-register-success");
  const successHtml = await successPage.text();
  check("the success page confirms the submission", successPage.status === 200 && successHtml.includes("Application Submitted"));
  check("the success page shows the score", successHtml.includes("Score: <strong>100%"));

  const gonePass = await sql<{ c: string }[]>`
    SELECT count(*)::text AS c FROM test_tokens WHERE user_id = ${passId}`;
  check("the token was consumed on pass", Number(gonePass[0].c) === 0);

  const successAgain = await req("/instructor-register-success");
  check("the success page is one-shot (refresh redirects)", successAgain.status === 307, `status ${successAgain.status}`);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\ncleanup");
  for (const id of [userId, passId].filter(Boolean)) {
    await sql`DELETE FROM test_tokens WHERE user_id = ${id}`;
    await sql`DELETE FROM test_failures WHERE user_id = ${id}`;
    await sql`DELETE FROM instructor_applications WHERE user_id = ${id}`;
    await sql`DELETE FROM instructor_profiles WHERE user_id = ${id}`;
    await sql`DELETE FROM email_verification_tokens WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
  for (const t of [...jar.keys()]) jar.delete(t);
  console.log(`  removed users ${[userId, passId].filter(Boolean).join(", ")} and their fixtures`);

  console.log(`\nsmoke-phase7: ${pass} passed, ${fail} failed (${pass + fail} checks)`);
  if (failures.length) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  await sql.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  try { await sql.end(); } catch {}
  process.exit(1);
});