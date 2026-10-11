import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatDayMonthYear, formatDayMonthYearCommaTime, humanTimeDiff } from "@/lib/format";
import { TEST_PASS_SCORE } from "@/lib/instructor/test-constants";
import { YEARS_EXP_REVIEW } from "@/lib/instructor/wizard";
import {
  getApplicationDetail,
  getSiblingNavigation,
} from "@/lib/db/admin/instructor-applications";
import InstructorApplicationDetailClient, {
  type ApplicationDetailView,
  type SiblingView,
} from "./InstructorApplicationDetailClient";
import "@/styles/css/admin/instructor-application-detail.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const appId = /^\d+$/.test(String(sp.id ?? "")) ? Number(sp.id) : 0;
  return pageMetadata({
    title: appId > 0 ? `Application #${appId} — Admin` : "Application — Admin",
    description: "Review a single instructor application.",
    path: "/admin/instructor-application-detail",
    noindex: true,
  });
}

const AVATAR_COLORS = ["#e84545", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

/** PHP crc32() (ASCII emails, so code-unit iteration matches byte-wise). */
function crc32(str: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i);
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** First char + char after last space (PHP detail page). */
function nameInitials(name: string): string {
  const first = name.charAt(0);
  const lastSpace = name.lastIndexOf(" ");
  return (first + (lastSpace === -1 ? "" : name.charAt(lastSpace + 1))).toUpperCase();
}

/** PHP list/detail `$expLabel`: skill-band labels from the wizard options. */
function expLabel(yearsExp: number | null): string {
  const y = yearsExp == null ? null : Number(yearsExp);
  return YEARS_EXP_REVIEW[y as keyof typeof YEARS_EXP_REVIEW] ?? `${y ?? "?"} yrs`;
}

/** PHP masking: `str_repeat('•', len-4) . substr(-4)`. */
function maskValue(value: string | null): { masked: string; full: string | null } {
  if (!value) return { masked: "", full: null };
  return {
    masked: "\u2022".repeat(Math.max(0, value.length - 4)) + value.slice(-4),
    full: value,
  };
}

const STATUS_META: Record<
  string,
  { label: string; badge: string; icon: string; card: string; iconSvg: string }
> = {
  pending: {
    label: "Pending Review",
    badge: "iad-badge--warning",
    icon: "⋯",
    card: "iad-decision-card--pending",
    iconSvg: "clock",
  },
  approved: {
    label: "Approved",
    badge: "iad-badge--success",
    icon: "✓",
    card: "iad-decision-card--approved",
    iconSvg: "check",
  },
  rejected: {
    label: "Rejected",
    badge: "iad-badge--danger",
    icon: "✕",
    card: "iad-decision-card--rejected",
    iconSvg: "x",
  },
  test_failed: {
    label: "Test Failed",
    badge: "iad-badge--danger",
    icon: "✕",
    card: "iad-decision-card--rejected",
    iconSvg: "x",
  },
  draft: {
    label: "Draft",
    badge: "iad-badge--warning",
    icon: "⋯",
    card: "iad-decision-card--pending",
    iconSvg: "clock",
  },
};

export default async function AdminInstructorApplicationDetailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const applicationId = /^\d+$/.test(String(sp.id ?? "")) ? Number(sp.id) : 0;
  if (applicationId <= 0) redirect("/admin/instructor-applications");

  const detail = await getApplicationDetail(applicationId);
  if (!detail) redirect("/admin/instructor-applications");

  const [nav, csrfToken] = await Promise.all([getSiblingNavigation(applicationId), readCsrfToken()]);

  const testScore = detail.test_score == null ? null : Number(detail.test_score);
  const testPassed = testScore !== null && testScore >= TEST_PASS_SCORE;
  const allPoliciesAgreed = Boolean(detail.revenue_share_ack && detail.terms_agreed && detail.content_policy);
  const status = (detail.status ?? "pending") as keyof typeof STATUS_META;
  const statusMeta = STATUS_META[status] ?? STATUS_META.pending;

  const pan = maskValue(detail.pan_number);
  const bank = maskValue(detail.bank_account);
  const hasDocs = Boolean(detail.govt_id_file || detail.marksheet_file);

  const view: ApplicationDetailView = {
    id: detail.id,
    applicantName: detail.applicant_name,
    applicantEmail: detail.applicant_email,
    headline: detail.headline ?? "",
    avatarInitials: nameInitials(detail.applicant_name),
    avatarColor: AVATAR_COLORS[crc32(detail.applicant_email) % AVATAR_COLORS.length],
    website: detail.website,
    linkedinUrl: detail.linkedin_url,
    twitterUrl: detail.twitter_url,
    emailVerified: detail.email_verified,
    isActive: detail.is_active,
    expLabel: expLabel(detail.years_exp),
    teachingStyle: detail.teaching_style ?? "",
    registeredDate: formatDayMonthYear(detail.registration_date),
    submittedFull: formatDayMonthYearCommaTime(detail.submitted_at),
    submittedDay: formatDayMonthYear(detail.submitted_at),
    timeAgo: humanTimeDiff(detail.submitted_at),
    reviewedAt: detail.reviewed_at ? formatDayMonthYearCommaTime(detail.reviewed_at) : null,
    primarySubject: detail.primary_subject,
    skillLevel: detail.skill_level ?? "",
    secondarySubjects: detail.secondary_subjects ?? "",
    targetAudience: detail.target_audience ?? "",
    courseIdeas: detail.course_ideas ?? "",
    sampleContentUrl: detail.sample_content_url ?? "",
    highestEducation: detail.highest_education ?? "",
    fieldOfStudy: detail.field_of_study ?? "",
    institution: detail.institution ?? "",
    graduationYear: detail.graduation_year,
    certifications: detail.certifications ?? "",
    professionalExp: detail.professional_exp ?? "",
    notableWorks: detail.notable_works ?? "",
    bio: detail.bio ?? "",
    fullLegalName: detail.full_legal_name ?? "",
    panMasked: pan.masked,
    panFull: pan.full ?? "",
    bankMasked: bank.masked,
    bankFull: bank.full ?? "",
    ifscCode: detail.ifsc_code ?? "",
    upiId: detail.upi_id ?? "",
    accountHolder: detail.account_holder ?? "",
    revenueShareAck: Boolean(detail.revenue_share_ack),
    termsAgreed: Boolean(detail.terms_agreed),
    contentPolicy: Boolean(detail.content_policy),
    allPoliciesAgreed,
    testScore,
    testPassed,
    testTimeTakenSeconds: detail.test_time_taken_seconds,
    status,
    statusLabel: statusMeta.label,
    statusBadge: statusMeta.badge,
    statusIcon: statusMeta.icon,
    statusIconSvg: statusMeta.iconSvg,
    decisionCard: statusMeta.card,
    govtIdUrl: detail.govt_id_file
      ? `/api/media?type=instructor_doc&id=${detail.id}&field=govt_id_file`
      : null,
    marksheetUrl: detail.marksheet_file
      ? `/api/media?type=instructor_doc&id=${detail.id}&field=marksheet_file`
      : null,
    hasDocs,
    rejectionReason: detail.rejection_reason ?? "",
  };

  const siblingView: SiblingView = {
    prevId: nav.prevId,
    nextId: nav.nextId,
    posLabel: nav.posLabel,
  };

  return (
    <InstructorApplicationDetailClient
      view={view}
      siblings={siblingView}
      csrfToken={csrfToken}
      initialMessage={sp.msg ?? ""}
      initialError={sp.error ?? ""}
      initialMsgType={sp.msg_type === "danger" ? "danger" : "success"}
    />
  );
}