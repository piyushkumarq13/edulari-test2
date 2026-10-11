import { sql } from "@/lib/db/client";
import { decryptSensitive } from "@/lib/db/instructor-registration";
import { deleteInstructorDocuments } from "@/lib/instructor/documents";

/**
 * All instructor-application queries used by the admin list and detail pages.
 * Ports the SQL in public/admin/instructor-applications.php and
 * instructor-application-detail.php 1:1 (tagged-template WHERE builder included).
 */

export interface ApplicationListFilters {
  status?: string;
  search?: string;
  subject?: string;
  education?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type ApplicationSortColumn =
  | "submitted_at"
  | "applicant_name"
  | "primary_subject"
  | "highest_education"
  | "years_exp"
  | "status";

export const APPLICATION_SORT_COLUMNS: readonly ApplicationSortColumn[] = [
  "submitted_at",
  "applicant_name",
  "primary_subject",
  "highest_education",
  "years_exp",
  "status",
];

/** PHP $sortSql map (lines 126-133). Each entry is the whitelisted ordering expression. */
const SORT_SQL: Record<ApplicationSortColumn, ReturnType<typeof sql>> = {
  submitted_at: sql`ia.submitted_at`,
  applicant_name: sql`u.name`,
  primary_subject: sql`ia.primary_subject`,
  highest_education: sql`ia.highest_education`,
  years_exp: sql`ip.years_exp`,
  status: sql`ia.status`,
};

/**
 * PHP LIKE comparisons were against MySQL's case-insensitive collation, so the port uses
 * ILIKE for the name/email/subject filters to keep the same behaviour in Postgres.
 * WHERE is built with the same append-fragment idiom as lib/db/admin/reviews.ts.
 */
function whereFor(filters: ApplicationListFilters) {
  let where = sql`WHERE 1 = 1`;
  if (filters.status && filters.status !== "all") {
    where = sql`${where} AND ia.status = ${filters.status}`;
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    where = sql`${where} AND (u.name ILIKE ${like} OR u.email ILIKE ${like} OR ia.primary_subject ILIKE ${like})`;
  }
  if (filters.subject) {
    where = sql`${where} AND ia.primary_subject ILIKE ${`%${filters.subject}%`}`;
  }
  if (filters.education) {
    where = sql`${where} AND ia.highest_education = ${filters.education}`;
  }
  if (filters.dateFrom) {
    where = sql`${where} AND DATE(ia.submitted_at) >= ${filters.dateFrom}::date`;
  }
  if (filters.dateTo) {
    where = sql`${where} AND DATE(ia.submitted_at) <= ${filters.dateTo}::date`;
  }
  return where;
}

export interface ApplicationListRow {
  id: number;
  status: string;
  primary_subject: string;
  skill_level: string | null;
  highest_education: string;
  submitted_at: Date;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  user_id: number;
  applicant_name: string;
  applicant_email: string;
  is_active: boolean;
  email_verified: boolean;
  profile_image: string | null;
  headline: string | null;
  years_exp: number | null;
}

const LIST_COLUMNS = sql`
  SELECT
    ia.id,
    ia.status,
    ia.primary_subject,
    ia.skill_level,
    ia.highest_education,
    ia.submitted_at,
    ia.reviewed_at,
    ia.rejection_reason,
    u.id       AS user_id,
    u.name     AS applicant_name,
    u.email    AS applicant_email,
    u.is_active,
    u.email_verified,
    u.profile_image,
    ip.headline,
    ip.years_exp
  FROM instructor_applications ia
  JOIN users u ON ia.user_id = u.id
  LEFT JOIN instructor_profiles ip ON ip.user_id = ia.user_id`;

export async function listApplications(
  filters: ApplicationListFilters,
  sortCol: ApplicationSortColumn,
  sortDir: "ASC" | "DESC",
  perPage: number,
  offset: number,
): Promise<ApplicationListRow[]> {
  const where = whereFor(filters);
  return sql<ApplicationListRow[]>`
    ${LIST_COLUMNS}
    ${where}
    ORDER BY ${SORT_SQL[sortCol]} ${sql.unsafe(sortDir)}
    LIMIT ${perPage} OFFSET ${offset}`;
}

export async function countApplications(filters: ApplicationListFilters): Promise<number> {
  const where = whereFor(filters);
  const rows = await sql<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt
    FROM instructor_applications ia
    JOIN users u ON ia.user_id = u.id
    ${where}`;
  return Number(rows[0]?.cnt ?? 0);
}

export interface StatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  all: number;
}

/** PHP lines 182-190: per-status counts via GROUP BY + sum for "all". */
export async function getStatusCounts(): Promise<StatusCounts> {
  const rows = await sql<{ status: string; c: string }[]>`
    SELECT status, COUNT(*)::text AS c FROM instructor_applications GROUP BY status`;
  const counts: StatusCounts = { pending: 0, approved: 0, rejected: 0, all: 0 };
  for (const r of rows) {
    if (r.status === "pending" || r.status === "approved" || r.status === "rejected") {
      counts[r.status] = Number(r.c);
    }
  }
  counts.all = counts.pending + counts.approved + counts.rejected;
  return counts;
}

export async function getEducationLevels(): Promise<string[]> {
  const rows = await sql<{ highest_education: string }[]>`
    SELECT DISTINCT highest_education FROM instructor_applications
    WHERE highest_education != '' ORDER BY highest_education`;
  return rows.map((r) => r.highest_education);
}

export interface ApplicationDetailRow {
  id: number;
  user_id: number;
  primary_subject: string;
  secondary_subjects: string | null;
  skill_level: string | null;
  highest_education: string | null;
  field_of_study: string | null;
  institution: string | null;
  graduation_year: number | null;
  certifications: string | null;
  professional_exp: string | null;
  notable_works: string | null;
  target_audience: string | null;
  course_ideas: string | null;
  bio: string | null;
  headline: string | null;
  sample_content_url: string | null;
  full_legal_name: string | null;
  pan_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
  account_holder: string | null;
  skip_payout: number | null;
  revenue_share_ack: boolean | null;
  terms_agreed: boolean | null;
  content_policy: boolean | null;
  govt_id_file: string | null;
  marksheet_file: string | null;
  test_title: string | null;
  test_score: number | null;
  test_time_taken_seconds: number | null;
  status: string | null;
  rejection_reason: string | null;
  submitted_at: Date | null;
  updated_at: Date | null;
  reviewed_at: Date | null;
  applicant_name: string;
  applicant_email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  registration_date: Date | null;
  website: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  years_exp: number | null;
  teaching_style: string | null;
  [key: string]: unknown;
}

/**
 * Detail select from instructor-application-detail.php lines 59-80 (`ia.*` plus user
 * profile columns). Sensitive columns are decrypted here — the review screen and the
 * applicant's own earnings/payout views are the only places they surface.
 */
export async function getApplicationDetail(applicationId: number): Promise<ApplicationDetailRow | null> {
  const rows = await sql<ApplicationDetailRow[]>`
    SELECT
      ia.*,
      u.name     AS applicant_name,
      u.email    AS applicant_email,
      u.role,
      u.is_active,
      u.email_verified,
      u.registration_date,
      ip.headline,
      ip.bio,
      ip.website,
      ip.linkedin_url,
      ip.twitter_url,
      ip.years_exp,
      ip.teaching_style
    FROM instructor_applications ia
    JOIN users u ON ia.user_id = u.id
    LEFT JOIN instructor_profiles ip ON ip.user_id = ia.user_id
    WHERE ia.id = ${applicationId}`;
  const row = rows[0];
  if (!row) return null;
  return decryptSensitive(row);
}

export interface SiblingNavigation {
  prevId: number | null;
  nextId: number | null;
  posLabel: string;
}

/**
 * Detail page quick-prev/next over the 50 most recent applications
 * (lines 87-96 of the PHP). posLabel is "N / total".
 */
export async function getSiblingNavigation(applicationId: number): Promise<SiblingNavigation> {
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM instructor_applications ORDER BY submitted_at DESC LIMIT 50`;
  const ids = rows.map((r) => r.id);
  const pos = ids.indexOf(applicationId);
  if (pos === -1) return { prevId: null, nextId: null, posLabel: "" };
  return {
    prevId: pos > 0 ? ids[pos - 1] : null,
    nextId: pos < ids.length - 1 ? ids[pos + 1] : null,
    posLabel: `${pos + 1} / ${ids.length}`,
  };
}

/**
 * onFailure callback for findAndScoreAbandonedTestTokens(). The PHP abandoned-token scorer
 * updated the application to status='test_failed' with the recorded score/time and deleted
 * its documents when an application row existed; otherwise it inserted a minimal
 * test_failed application row. Mirrored from test_token.php / lib/api-test-helpers.ts.
 */
export async function markInstructorApplicationTestFailed(
  userId: number,
  score: number,
  timeTaken: number,
): Promise<void> {
  const app = await sql<{ id: number; govt_id_file: string | null; marksheet_file: string | null }[]>`
    SELECT id, govt_id_file, marksheet_file FROM instructor_applications WHERE user_id = ${userId}`;
  if (app[0]) {
    await sql`
      UPDATE instructor_applications
      SET status = 'test_failed', test_score = ${score}, test_time_taken_seconds = ${timeTaken}
      WHERE id = ${app[0].id}`;
    await deleteInstructorDocuments(app[0]);
  } else {
    await sql`
      INSERT INTO instructor_applications (user_id, status, test_score, test_time_taken_seconds, submitted_at, updated_at)
      VALUES (${userId}, 'test_failed', ${score}, ${timeTaken}, now(), now())`;
  }
}