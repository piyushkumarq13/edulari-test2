import { sql } from "./client";
import { encrypt, decrypt, isEncrypted } from "@/lib/security/crypto";
import { sendInstructorApplicationNotification, sendInstructorApprovalEmail, sendInstructorRejectionEmail } from "@/lib/email/senders";
import { logSecurity } from "@/lib/security/events";
import { config } from "@/lib/config";

export type RegStatus = "draft" | "pending" | "approved" | "rejected" | "test_failed";

export interface RegData {
  user_id?: number;
  name?: string;
  email?: string;
  profile?: {
    headline: string;
    bio: string;
    website: string;
    linkedin: string;
    twitter: string;
    years_exp: number;
    teaching_style: string;
  };
  credentials?: {
    highest_education: string;
    institution: string;
    field_of_study: string;
    graduation_year: number | null;
    certifications: string;
    professional_exp: string;
    notable_works: string;
  };
  competency?: {
    primary_subject: string;
    secondary_subjects: string;
    skill_level: string;
    target_audience: string;
    course_ideas: string;
    sample_content: string;
  };
  legal?: {
    full_legal_name: string;
    pan_number: string;
    bank_name: string;
    account_number: string;
    ifsc_code: string;
    account_holder: string;
    upi_id: string;
    skip_payout: number;
    revenue_share_ack: number;
    terms_agreed: number;
    content_policy: number;
  };
  documents?: {
    govt_id_file: string;
    marksheet_file: string;
  };
  test_title?: string;
  test_badge_label?: string;
}

/**
 * The RegData.legal fields that are stored encrypted. These are the RegData names, not the
 * instructor_applications column names: account_number is written to the bank_account
 * column. bank_name is deliberately NOT encrypted - the review screen shows it in clear.
 */
const SENSITIVE_LEGAL_FIELDS = ["pan_number", "account_number", "ifsc_code", "account_holder", "upi_id"] as const;

/** The same list as instructor_applications column names, for decrypting a DB row. */
const SENSITIVE_APP_COLUMNS = ["pan_number", "bank_account", "ifsc_code", "account_holder", "upi_id"] as const;

const EMPTY_PROFILE: NonNullable<RegData["profile"]> = { headline: "", bio: "", website: "", linkedin: "", twitter: "", years_exp: 0, teaching_style: "" };
const EMPTY_CREDENTIALS: NonNullable<RegData["credentials"]> = { highest_education: "", institution: "", field_of_study: "", graduation_year: null, certifications: "", professional_exp: "", notable_works: "" };
const EMPTY_COMPETENCY: NonNullable<RegData["competency"]> = { primary_subject: "", secondary_subjects: "", skill_level: "", target_audience: "", course_ideas: "", sample_content: "" };
const EMPTY_LEGAL: NonNullable<RegData["legal"]> = { full_legal_name: "", pan_number: "", bank_name: "", account_number: "", ifsc_code: "", account_holder: "", upi_id: "", skip_payout: 0, revenue_share_ack: 0, terms_agreed: 0, content_policy: 0 };
const EMPTY_DOCUMENTS: NonNullable<RegData["documents"]> = { govt_id_file: "", marksheet_file: "" };

export function encryptSensitive(legal: RegData["legal"]): RegData["legal"] | undefined {
  if (!legal) return undefined;
  const out: Record<string, unknown> = { ...legal };
  for (const field of SENSITIVE_LEGAL_FIELDS) {
    const value = out[field];
    if (typeof value === "string" && value !== "" && !isEncrypted(value)) {
      out[field] = encrypt(value);
    }
  }
  return out as unknown as RegData["legal"];
}

export function decryptSensitive<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const col of SENSITIVE_APP_COLUMNS) {
    const value = out[col];
    if (typeof value === "string" && isEncrypted(value)) {
      try {
        out[col] = decrypt(value);
      } catch {
        // Leave as-is; a wrong key must not take the page down.
      }
    }
  }
  return out as T;
}

interface AppRow {
  id: number;
  user_id: number;
  govt_id_file: string | null;
  marksheet_file: string | null;
}

async function findApp(userId: number): Promise<AppRow | null> {
  const rows = await sql<AppRow[]>`
    SELECT id, user_id, govt_id_file, marksheet_file
    FROM instructor_applications WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

async function findProfile(userId: number): Promise<{ id: number } | null> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM instructor_profiles WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export interface SaveApplicationResult {
  ok: boolean;
  error?: string;
}

/**
 * Save the completed application. Creates the instructor_profiles row and the
 * instructor_applications row, sets status='pending', and notifies the admin.
 * Mirrors saveInstructorApplication() in private/functions/instructor_registration.php.
 */
export async function saveInstructorApplication(
  data: RegData,
  testScore = 0,
  testTimeTaken = 0,
): Promise<SaveApplicationResult> {
  const userId = data.user_id ?? 0;
  if (!userId) return { ok: false, error: "Session expired. Please start registration again." };

  const user = await sql<{ id: number; role: string }[]>`
    SELECT id, role FROM users WHERE id = ${userId} AND role = 'instructor'`;
  if (!user[0]) return { ok: false, error: "User account not found. Please start registration again." };

  // Merge per field: test_data is persisted JSON that may predate a field being added, so a
  // partial object must fall back to the empty default rather than binding undefined into SQL.
  const profile = { ...EMPTY_PROFILE, ...(data.profile ?? {}) };
  const credentials = { ...EMPTY_CREDENTIALS, ...(data.credentials ?? {}) };
  const competency = { ...EMPTY_COMPETENCY, ...(data.competency ?? {}) };
  const legal = { ...EMPTY_LEGAL, ...(data.legal ?? {}) };
  const documents = { ...EMPTY_DOCUMENTS, ...(data.documents ?? {}) };

  const profileData = [
    profile.headline ?? "",
    profile.bio ?? "",
    profile.website ?? "",
    profile.linkedin ?? "",
    profile.twitter ?? "",
    Math.trunc(profile.years_exp ?? 0),
    profile.teaching_style ?? "",
  ];

  const existingProfile = await findProfile(userId);
  if (existingProfile) {
    await sql`
      UPDATE instructor_profiles SET
        headline = ${profileData[0]}, bio = ${profileData[1]}, website = ${profileData[2]},
        linkedin_url = ${profileData[3]}, twitter_url = ${profileData[4]},
        years_exp = ${profileData[5]}, teaching_style = ${profileData[6]}
      WHERE user_id = ${userId}`;
  } else {
    await sql`
      INSERT INTO instructor_profiles (user_id, headline, bio, website, linkedin_url, twitter_url, years_exp, teaching_style)
      VALUES (${userId}, ${profileData[0]}, ${profileData[1]}, ${profileData[2]}, ${profileData[3]}, ${profileData[4]}, ${profileData[5]}, ${profileData[6]})`;
  }

  const encLegal = encryptSensitive(legal);

  const highestEducation = credentials.highest_education;
  const institution = credentials.institution;
  const fieldOfStudy = credentials.field_of_study;
  const graduationYear = credentials.graduation_year ? Math.trunc(credentials.graduation_year) : null;
  const certifications = credentials.certifications;
  const professionalExp = credentials.professional_exp;
  const notableWorks = credentials.notable_works;
  const primarySubject = competency.primary_subject;
  const secondarySubjects = competency.secondary_subjects;
  const skillLevel = competency.skill_level;
  const targetAudience = competency.target_audience;
  const courseIdeas = competency.course_ideas;
  const sampleContentUrl = competency.sample_content;
  const fullLegalName = legal.full_legal_name;
  const pan = encLegal?.pan_number ?? "";
  const bankAccount = encLegal?.account_number ?? "";
  const bankName = legal.bank_name ?? "";
  const ifsc = encLegal?.ifsc_code ?? "";
  const holder = encLegal?.account_holder ?? "";
  const upi = encLegal?.upi_id ?? "";
  const revenueAck = Boolean(legal.revenue_share_ack);
  const termsAgreed = Boolean(legal.terms_agreed);
  const contentPolicy = Boolean(legal.content_policy);
  const skipPayout = Boolean(legal.skip_payout);
  const govtIdFile = documents.govt_id_file;
  const marksheetFile = documents.marksheet_file;

  const existingApp = await findApp(userId);

  try {
    if (existingApp) {
      await sql`
        UPDATE instructor_applications SET
          highest_education = ${highestEducation}, institution = ${institution},
          field_of_study = ${fieldOfStudy}, graduation_year = ${graduationYear},
          certifications = ${certifications}, professional_exp = ${professionalExp},
          notable_works = ${notableWorks}, primary_subject = ${primarySubject},
          secondary_subjects = ${secondarySubjects}, skill_level = ${skillLevel},
          target_audience = ${targetAudience}, course_ideas = ${courseIdeas},
          sample_content_url = ${sampleContentUrl}, full_legal_name = ${fullLegalName},
          pan_number = ${pan}, bank_account = ${bankAccount}, bank_name = ${bankName}, ifsc_code = ${ifsc},
          account_holder = ${holder}, upi_id = ${upi},
          revenue_share_ack = ${revenueAck}, terms_agreed = ${termsAgreed},
          content_policy = ${contentPolicy},
          govt_id_file = ${govtIdFile}, marksheet_file = ${marksheetFile},
          test_score = ${testScore}, test_time_taken_seconds = ${testTimeTaken},
          status = 'pending', submitted_at = now(), updated_at = now()
        WHERE user_id = ${userId}`;
    } else {
      await sql`
        INSERT INTO instructor_applications (
          user_id, highest_education, institution, field_of_study, graduation_year,
          certifications, professional_exp, notable_works, primary_subject,
          secondary_subjects, skill_level, target_audience, course_ideas,
          sample_content_url, full_legal_name, pan_number, bank_account, bank_name, ifsc_code,
          account_holder, upi_id, revenue_share_ack, terms_agreed, content_policy, skip_payout,
          govt_id_file, marksheet_file, test_score, test_time_taken_seconds,
          status, submitted_at, updated_at
        ) VALUES (
          ${userId}, ${highestEducation}, ${institution}, ${fieldOfStudy}, ${graduationYear},
          ${certifications}, ${professionalExp}, ${notableWorks}, ${primarySubject},
          ${secondarySubjects}, ${skillLevel}, ${targetAudience}, ${courseIdeas},
          ${sampleContentUrl}, ${fullLegalName}, ${pan}, ${bankAccount}, ${bankName}, ${ifsc},
          ${holder}, ${upi}, ${revenueAck}, ${termsAgreed}, ${contentPolicy}, ${skipPayout},
          ${govtIdFile}, ${marksheetFile}, ${testScore}, ${testTimeTaken},
          'pending', now(), now()
        )`;
    }
  } catch (err) {
    console.error("[instructor-registration] application save failed", err);
    void logSecurity("INSTRUCTOR_APPLICATION_SAVE_FAILED", { userId });
    return { ok: false, error: "Registration failed. Please try again later." };
  }

  void sendInstructorApplicationNotification(adminEmail(), data.email ?? "", data.name ?? "", testScore);
  return { ok: true };
}

/**
 * Approve an application: activate the user, mark the application approved, delete the
 * uploaded documents and email the instructor. Mirrors approveInstructorApplication().
 */
export async function approveInstructorApplication(applicationId: number): Promise<SaveApplicationResult> {
  const app = await sql<AppRow[]>`SELECT * FROM instructor_applications WHERE id = ${applicationId}`;
  const row = app[0];
  if (!row) return { ok: false, error: "Application not found." };

  await sql`UPDATE users SET is_active = 1 WHERE id = ${row.user_id}`;
  await sql`UPDATE instructor_applications SET status = 'approved', reviewed_at = now() WHERE id = ${applicationId}`;

  const { deleteInstructorDocuments } = await import("@/lib/instructor/documents");
  await deleteInstructorDocuments(row);

  const user = await sql<{ email: string; name: string }[]>`SELECT email, name FROM users WHERE id = ${row.user_id}`;
  if (user[0]) void sendInstructorApprovalEmail(user[0].email, user[0].name);
  return { ok: true };
}

/**
 * Reject an application: deactivate the user (block_reason='application_rejected'), record
 * the reason, delete the documents and email the instructor.
 * Mirrors rejectInstructorApplication().
 */
export async function rejectInstructorApplication(
  applicationId: number,
  reason = "",
): Promise<SaveApplicationResult> {
  const app = await sql<AppRow[]>`SELECT * FROM instructor_applications WHERE id = ${applicationId}`;
  const row = app[0];
  if (!row) return { ok: false, error: "Application not found." };

  await sql`UPDATE users SET is_active = 0, block_reason = 'application_rejected' WHERE id = ${row.user_id}`;
  await sql`UPDATE instructor_applications SET status = 'rejected', rejection_reason = ${reason}, reviewed_at = now() WHERE id = ${applicationId}`;

  const { deleteInstructorDocuments } = await import("@/lib/instructor/documents");
  await deleteInstructorDocuments(row);

  const user = await sql<{ email: string; name: string }[]>`SELECT email, name FROM users WHERE id = ${row.user_id}`;
  if (user[0]) void sendInstructorRejectionEmail(user[0].email, user[0].name, reason);
  return { ok: true };
}

/** Persist a partial draft after a step. Mirrors saveInstructorDraft(). */
export async function saveInstructorDraft(
  userId: number,
  data: RegData,
  currentStep: number,
): Promise<boolean> {
  if (!userId) return false;

  // `hasX` records whether the caller supplied the section at all, so a step never blanks a
  // field another step owns. The merged objects keep every binding defined for SQL.
  const hasProfile = Boolean(data.profile && Object.keys(data.profile).length);
  const hasCredentials = Boolean(data.credentials && Object.keys(data.credentials).length);
  const hasCompetency = Boolean(data.competency && Object.keys(data.competency).length);
  const hasLegal = Boolean(data.legal && Object.keys(data.legal).length);

  const profile = { ...EMPTY_PROFILE, ...(data.profile ?? {}) };
  const credentials = { ...EMPTY_CREDENTIALS, ...(data.credentials ?? {}) };
  const competency = { ...EMPTY_COMPETENCY, ...(data.competency ?? {}) };
  const legal = { ...EMPTY_LEGAL, ...(data.legal ?? {}) };
  const documents = { ...EMPTY_DOCUMENTS, ...(data.documents ?? {}) };

  if (hasProfile) {
    const vals = [
      profile.headline ?? "", profile.bio ?? "", profile.website ?? "", profile.linkedin ?? "",
      profile.twitter ?? "", Math.trunc(profile.years_exp ?? 0), profile.teaching_style ?? "",
    ];
    const existing = await findProfile(userId);
    if (existing) {
      await sql`
        UPDATE instructor_profiles SET
          headline=${vals[0]}, bio=${vals[1]}, website=${vals[2]}, linkedin_url=${vals[3]},
          twitter_url=${vals[4]}, years_exp=${vals[5]}, teaching_style=${vals[6]}
        WHERE user_id = ${userId}`;
    } else {
      await sql`
        INSERT INTO instructor_profiles (user_id, headline, bio, website, linkedin_url, twitter_url, years_exp, teaching_style)
        VALUES (${userId}, ${vals[0]}, ${vals[1]}, ${vals[2]}, ${vals[3]}, ${vals[4]}, ${vals[5]}, ${vals[6]})`;
    }
  }

  const encLegal = encryptSensitive(legal);
  const hasGovtId = Boolean(documents.govt_id_file);
  const hasMarksheet = Boolean(documents.marksheet_file);

  // No early return: the step reached is always persisted, exactly as in the PHP
  // ("Always persist the current step reached"). Every other column is guarded by hasX so a
  // step that owns no data section cannot blank a field another step already wrote.
  const existing = await findApp(userId);
  const gradYear = credentials.graduation_year ? Math.trunc(credentials.graduation_year) : null;

  if (existing) {
    // Each section is written only when the caller supplied it, so a step never blanks a
    // field another step owns. `hasX` guards every conditional branch.
    await sql`
      UPDATE instructor_applications SET
        highest_education = CASE WHEN ${hasCredentials} THEN ${credentials.highest_education} ELSE highest_education END,
        institution = CASE WHEN ${hasCredentials} THEN ${credentials.institution} ELSE institution END,
        field_of_study = CASE WHEN ${hasCredentials} THEN ${credentials.field_of_study} ELSE field_of_study END,
        graduation_year = CASE WHEN ${hasCredentials} THEN ${gradYear} ELSE graduation_year END,
        certifications = CASE WHEN ${hasCredentials} THEN ${credentials.certifications} ELSE certifications END,
        professional_exp = CASE WHEN ${hasCredentials} THEN ${credentials.professional_exp} ELSE professional_exp END,
        notable_works = CASE WHEN ${hasCredentials} THEN ${credentials.notable_works} ELSE notable_works END,
        primary_subject = CASE WHEN ${hasCompetency} THEN ${competency.primary_subject} ELSE primary_subject END,
        secondary_subjects = CASE WHEN ${hasCompetency} THEN ${competency.secondary_subjects} ELSE secondary_subjects END,
        skill_level = CASE WHEN ${hasCompetency} THEN ${competency.skill_level} ELSE skill_level END,
        target_audience = CASE WHEN ${hasCompetency} THEN ${competency.target_audience} ELSE target_audience END,
        course_ideas = CASE WHEN ${hasCompetency} THEN ${competency.course_ideas} ELSE course_ideas END,
        sample_content_url = CASE WHEN ${hasCompetency} THEN ${competency.sample_content} ELSE sample_content_url END,
        full_legal_name = CASE WHEN ${hasLegal} THEN ${legal.full_legal_name} ELSE full_legal_name END,
        pan_number = CASE WHEN ${hasLegal} THEN ${encLegal?.pan_number ?? ""} ELSE pan_number END,
        bank_account = CASE WHEN ${hasLegal} THEN ${encLegal?.account_number ?? ""} ELSE bank_account END,
        bank_name = CASE WHEN ${hasLegal} THEN ${legal.bank_name ?? ""} ELSE bank_name END,
        skip_payout = CASE WHEN ${hasLegal} THEN ${Boolean(legal.skip_payout)} ELSE skip_payout END,
        ifsc_code = CASE WHEN ${hasLegal} THEN ${encLegal?.ifsc_code ?? ""} ELSE ifsc_code END,
        account_holder = CASE WHEN ${hasLegal} THEN ${encLegal?.account_holder ?? ""} ELSE account_holder END,
        upi_id = CASE WHEN ${hasLegal} THEN ${encLegal?.upi_id ?? ""} ELSE upi_id END,
        revenue_share_ack = CASE WHEN ${hasLegal} THEN ${Boolean(legal.revenue_share_ack)} ELSE revenue_share_ack END,
        terms_agreed = CASE WHEN ${hasLegal} THEN ${Boolean(legal.terms_agreed)} ELSE terms_agreed END,
        content_policy = CASE WHEN ${hasLegal} THEN ${Boolean(legal.content_policy)} ELSE content_policy END,
        govt_id_file = CASE WHEN ${hasGovtId} THEN ${documents.govt_id_file} ELSE govt_id_file END,
        marksheet_file = CASE WHEN ${hasMarksheet} THEN ${documents.marksheet_file} ELSE marksheet_file END,
        last_completed_step = ${currentStep},
        updated_at = now()
      WHERE user_id = ${userId}`;
  } else {
    await sql`
      INSERT INTO instructor_applications (
        user_id, highest_education, institution, field_of_study, graduation_year,
        certifications, professional_exp, notable_works, primary_subject,
        secondary_subjects, skill_level, target_audience, course_ideas,
        sample_content_url, full_legal_name, pan_number, bank_account, bank_name, ifsc_code,
        account_holder, upi_id, revenue_share_ack, terms_agreed, content_policy, skip_payout,
        govt_id_file, marksheet_file, last_completed_step, status, submitted_at, updated_at
      ) VALUES (
        ${userId},
        ${hasCredentials ? credentials.highest_education : ""},
        ${hasCredentials ? credentials.institution : ""},
        ${hasCredentials ? credentials.field_of_study : ""},
        ${hasCredentials ? gradYear : null},
        ${hasCredentials ? credentials.certifications : ""},
        ${hasCredentials ? credentials.professional_exp : ""},
        ${hasCredentials ? credentials.notable_works : ""},
        ${hasCompetency ? competency.primary_subject : ""},
        ${hasCompetency ? competency.secondary_subjects : ""},
        ${hasCompetency ? competency.skill_level : ""},
        ${hasCompetency ? competency.target_audience : ""},
        ${hasCompetency ? competency.course_ideas : ""},
        ${hasCompetency ? competency.sample_content : ""},
        ${hasLegal ? legal.full_legal_name : ""},
        ${hasLegal ? encLegal?.pan_number ?? "" : ""},
        ${hasLegal ? encLegal?.account_number ?? "" : ""},
        ${hasLegal ? legal.bank_name ?? "" : ""},
        ${hasLegal ? encLegal?.ifsc_code ?? "" : ""},
        ${hasLegal ? encLegal?.account_holder ?? "" : ""},
        ${hasLegal ? encLegal?.upi_id ?? "" : ""},
        ${hasLegal ? Boolean(legal.revenue_share_ack) : false},
        ${hasLegal ? Boolean(legal.terms_agreed) : false},
        ${hasLegal ? Boolean(legal.content_policy) : false},
        ${hasLegal ? Boolean(legal.skip_payout) : false},
        ${documents.govt_id_file},
        ${documents.marksheet_file},
        ${currentStep}, 'draft', now(), now()
      )`;
  }
  return true;
}

/**
 * Build the draft payload for a user. Mirrors loadInstructorDraft(): the resume step is
 * derived from whichever section is populated, then last_completed_step wins if it is
 * further along.
 */
export async function loadInstructorDraft(userId: number): Promise<{ step: number; data: RegData }> {
  const fallback = { step: 2, data: {} as RegData };

  const user = await sql<{ name: string; email: string; email_verified: boolean }[]>`
    SELECT name, email, email_verified FROM users WHERE id = ${userId}`;
  if (!user[0] || !user[0].email_verified) return fallback;

  const app = await sql<Record<string, unknown>[]>`SELECT * FROM instructor_applications WHERE user_id = ${userId}`;
  const profile = await sql<Record<string, unknown>[]>`SELECT * FROM instructor_profiles WHERE user_id = ${userId}`;

  const data: RegData = { user_id: userId, name: user[0].name, email: user[0].email };
  let resumeStep = 2;

  const p = profile[0];
  if (p) {
    data.profile = {
      headline: (p.headline as string) ?? "",
      bio: (p.bio as string) ?? "",
      website: (p.website as string) ?? "",
      linkedin: (p.linkedin_url as string) ?? "",
      twitter: (p.twitter_url as string) ?? "",
      years_exp: Number(p.years_exp ?? 0),
      teaching_style: (p.teaching_style as string) ?? "",
    };
    resumeStep = 3;
  }

  const a = app[0];
  if (a) {
    if (a.highest_education) {
      data.credentials = {
        highest_education: a.highest_education as string,
        institution: (a.institution as string) ?? "",
        field_of_study: (a.field_of_study as string) ?? "",
        graduation_year: a.graduation_year ? Number(a.graduation_year) : null,
        certifications: (a.certifications as string) ?? "",
        professional_exp: (a.professional_exp as string) ?? "",
        notable_works: (a.notable_works as string) ?? "",
      };
      resumeStep = 4;
    }
    if (a.primary_subject) {
      data.competency = {
        primary_subject: a.primary_subject as string,
        secondary_subjects: (a.secondary_subjects as string) ?? "",
        skill_level: (a.skill_level as string) ?? "",
        target_audience: (a.target_audience as string) ?? "",
        course_ideas: (a.course_ideas as string) ?? "",
        sample_content: (a.sample_content_url as string) ?? "",
      };
      resumeStep = 5;
    }
    // The PHP guards this block on `!empty($app['full_legal_name'])`, but no form ever posts that
    // field, so the legal section (agreements + payout summary) was unreachable and resumeStep
    // could never reach 6. The intended guard is "the applicant filled in step 5 at all".
    const hasLegalSection = Boolean(
      a.pan_number || a.bank_account || a.ifsc_code || a.account_holder || a.upi_id
      || Number(a.terms_agreed) || Number(a.content_policy) || Number(a.revenue_share_ack) || a.skip_payout,
    );
    if (hasLegalSection) {
      const dec = decryptSensitive(a);
      data.legal = {
        full_legal_name: (dec.full_legal_name as string) ?? "",
        pan_number: (dec.pan_number as string) ?? "",
        bank_name: (dec.bank_name as string) ?? "",
        account_number: (dec.bank_account as string) ?? "",
        ifsc_code: (dec.ifsc_code as string) ?? "",
        account_holder: (dec.account_holder as string) ?? "",
        upi_id: (dec.upi_id as string) ?? "",
        skip_payout: Number(a.skip_payout ?? 0),
        revenue_share_ack: Number(a.revenue_share_ack ?? 0),
        terms_agreed: Number(a.terms_agreed ?? 0),
        content_policy: Number(a.content_policy ?? 0),
      };
      resumeStep = 6;
    }
    if (a.govt_id_file || a.marksheet_file) {
      data.documents = {
        govt_id_file: (a.govt_id_file as string) ?? "",
        marksheet_file: (a.marksheet_file as string) ?? "",
      };
    }
    const lcs = Number(a.last_completed_step ?? 0);
    if (lcs > resumeStep) resumeStep = lcs;
  }

  return { step: resumeStep, data };
}

/**
 * Whether a draft is genuinely resumable: role is instructor, email verified, never
 * activated, and the application (if any) never left 'draft'.
 * Mirrors isInstructorRegistrationResumable().
 */
export async function isInstructorRegistrationResumable(userId: number): Promise<boolean> {
  const user = await sql<{ id: number; role: string; email_verified: boolean; is_active: boolean }[]>`
    SELECT id, role, email_verified, is_active FROM users WHERE id = ${userId}`;
  const u = user[0];
  if (!u) return false;
  if (u.role !== "instructor") return false;
  if (!u.email_verified) return false;
  if (u.is_active) return false;

  const app = await sql<{ status: string }[]>`
    SELECT status FROM instructor_applications WHERE user_id = ${userId} ORDER BY submitted_at DESC LIMIT 1`;
  return !app[0] || app[0].status === "draft";
}

/** Delete uploaded document objects + clear the columns. Mirrors _deleteInstructorDocs(). */
export async function purgeStaleDraftDocs(now: Date): Promise<number> {
  const rows = await sql<AppRow[]>`
    SELECT id, user_id, govt_id_file, marksheet_file FROM instructor_applications
    WHERE status IN ('draft', 'test_failed')
      AND (govt_id_file IS NOT NULL OR marksheet_file IS NOT NULL)
      AND updated_at < ${now}`;
  if (!rows.length) return 0;

  const { deleteInstructorDocuments } = await import("@/lib/instructor/documents");
  let count = 0;
  for (const row of rows) {
    await deleteInstructorDocuments(row);
    count++;
  }
  return count;
}

/**
 * Purge all instructor data for rejected / test_failed users, converting them to active
 * students. Keeps users.id, email, name, password and email_verified.
 * Mirrors purgeRejectedInstructorData().
 */
export async function purgeRejectedInstructorData(): Promise<number> {
  const targets = await sql<AppRow[]>`SELECT * FROM instructor_applications WHERE status IN ('rejected', 'test_failed')`;
  if (!targets.length) return 0;

  const { deleteInstructorDocuments } = await import("@/lib/instructor/documents");
  let count = 0;
  for (const app of targets) {
    await deleteInstructorDocuments(app);
    await sql`DELETE FROM instructor_profiles WHERE user_id = ${app.user_id}`;
    await sql`DELETE FROM instructor_applications WHERE id = ${app.id}`;
    await sql`
      UPDATE users SET role = 'student', is_active = 1, block_reason = NULL, block_note = NULL
      WHERE id = ${app.user_id}`;
    count++;
  }
  return count;
}

export function adminEmail(): string {
  return config.ADMIN_EMAIL ?? "admin@edulari.test";
}
