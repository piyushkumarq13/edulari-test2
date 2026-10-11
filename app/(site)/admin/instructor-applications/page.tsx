import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import { getAvatarUrl } from "@/lib/storage/media-urls";
import { formatDayMonthYear, humanTimeDiff, phpNumber } from "@/lib/format";
import { maybeCleanupStaleDraftDocs, maybePurgeRejectedInstructorData } from "@/lib/instructor/maintenance";
import { findAndScoreAbandonedTestTokens } from "@/lib/instructor/test-tokens";
import {
  listApplications,
  countApplications,
  getStatusCounts,
  getEducationLevels,
  markInstructorApplicationTestFailed,
  APPLICATION_SORT_COLUMNS,
  type ApplicationListFilters,
  type ApplicationSortColumn,
} from "@/lib/db/admin/instructor-applications";
import InstructorApplicationsClient, {
  type ApplicationRowView,
  type PageToken,
} from "./InstructorApplicationsClient";
import "@/styles/css/admin/instructor-applications.css";

export const metadata: Metadata = pageMetadata({
  title: "Instructor Applications — Admin",
  description: "Review, approve or reject instructor applications from your platform.",
  path: "/admin/instructor-applications",
  noindex: true,
});

export const dynamic = "force-dynamic";

const AVATAR_COLORS = ["#e84545", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

/** PHP crc32() (email addresses are ASCII, so code-unit iteration matches byte-wise). */
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

/** PHP list page `$initials` (first char + char after last space). */
function nameInitials(name: string): string {
  const first = name.charAt(0);
  const lastSpace = name.lastIndexOf(" ");
  const initials = first + (lastSpace === -1 ? "" : name.charAt(lastSpace + 1));
  return initials.toUpperCase();
}

/** PHP list `$expLabel` short variant. */
function expLabelShort(yearsExp: number | null): string {
  const y = yearsExp == null ? null : Number(yearsExp);
  switch (y) {
    case 0:
      return "< 1 yr";
    case 1:
      return "1–2 yrs";
    case 3:
      return "3–5 yrs";
    case 6:
      return "6–10 yrs";
    case 11:
      return "11–15 yrs";
    case 16:
      return "16+ yrs";
    default:
      return `${y ?? "?"} yrs`;
  }
}

function qsFrom(map: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(map)) if (v !== "") q.set(k, v);
  return q.toString();
}

function buildPageTokens(page: number, totalPages: number, base: Record<string, string>): PageToken[] {
  const href = (p: number) => {
    const m = { ...base, page: String(p) };
    return `/admin/instructor-applications?${qsFrom(m)}`;
  };
  const tokens: PageToken[] = [];
  if (page > 1) tokens.push({ kind: "prev", href: href(page - 1) });

  const range = 2;
  const start = Math.max(1, page - range);
  const end = Math.min(totalPages, page + range);
  if (start > 1) {
    tokens.push({ kind: "page", label: "1", href: href(1), active: page === 1 });
    if (start > 2) tokens.push({ kind: "ellipsis" });
  }
  for (let i = start; i <= end; i++) {
    tokens.push({ kind: "page", label: String(i), href: href(i), active: i === page });
  }
  if (end < totalPages) {
    if (end < totalPages - 1) tokens.push({ kind: "ellipsis" });
    tokens.push({ kind: "page", label: String(totalPages), href: href(totalPages), active: page === totalPages });
  }
  if (page < totalPages) tokens.push({ kind: "next", href: href(page + 1) });
  return tokens;
}

export default async function AdminInstructorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Session + admin role guard FIRST: the PHP list page ran its three lazy maintenance
  // jobs before requireRole (a security bug); the port guards the page first and runs the
  // jobs here, throttled by cron_state.
  await requireAdmin();
  await maybeCleanupStaleDraftDocs();
  await maybePurgeRejectedInstructorData();
  await findAndScoreAbandonedTestTokens(markInstructorApplicationTestFailed);

  const sp = await searchParams;

  // ── Filters & pagination ───────────────────────────────────────────────
  const statusFilter = sp.status ?? "pending";
  const searchFilter = (sp.search ?? "").trim();
  const subjectFilter = (sp.subject ?? "").trim();
  const educFilter = (sp.education ?? "").trim();
  const dateFrom = (sp.date_from ?? "").trim();
  const dateTo = (sp.date_to ?? "").trim();

  let sortCol: ApplicationSortColumn = "submitted_at";
  if ((APPLICATION_SORT_COLUMNS as readonly string[]).includes(sp.sort ?? "")) {
    sortCol = sp.sort as ApplicationSortColumn;
  }
  const sortDir: "ASC" | "DESC" = (sp.dir ?? "").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const perPage = Math.max(10, Math.min(100, Number(sp.per_page ?? 20) || 20));
  const offset = (page - 1) * perPage;

  const filters: ApplicationListFilters = {
    status: statusFilter,
    search: searchFilter,
    subject: subjectFilter,
    education: educFilter,
    dateFrom,
    dateTo,
  };

  const [rows, totalCount, counts, educLevels, csrfToken] = await Promise.all([
    listApplications(filters, sortCol, sortDir, perPage, offset),
    countApplications(filters),
    getStatusCounts(),
    getEducationLevels(),
    readCsrfToken(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  // ── Active filter map (PHP $activeFilters, drop empty values + defaults) ─
  const activeFilters: Record<string, string> = {};
  activeFilters.status = statusFilter;
  if (searchFilter) activeFilters.search = searchFilter;
  if (subjectFilter) activeFilters.subject = subjectFilter;
  if (educFilter) activeFilters.education = educFilter;
  if (dateFrom) activeFilters.date_from = dateFrom;
  if (dateTo) activeFilters.date_to = dateTo;
  if (perPage !== 20) activeFilters.per_page = String(perPage);
  if (sortCol !== "submitted_at") activeFilters.sort = sortCol;
  if (sortDir !== "DESC") activeFilters.dir = sortDir;

  const activeFilterCount = [subjectFilter !== "", educFilter !== "", dateFrom !== "", dateTo !== ""].filter(Boolean).length;

  // Tabs keep the other filters but switch the status (PHP lines 298-308).
  const tabHrefs: Record<string, string> = {};
  for (const s of ["all", "pending", "approved", "rejected"]) {
    tabHrefs[s] = `/admin/instructor-applications?${qsFrom({ ...activeFilters, status: s })}`;
  }

  // Sort headers (PHP sortUrl: toggle ASC/DESC, reset to page 1).
  const sortHrefs: Record<string, string> = {};
  for (const col of APPLICATION_SORT_COLUMNS) {
    const dir = col === sortCol && sortDir === "ASC" ? "DESC" : "ASC";
    sortHrefs[col] = `/admin/instructor-applications?${qsFrom({
      ...activeFilters,
      sort: col,
      dir,
      page: "1",
    })}`;
  }

  const hasAnyFilter = Boolean(searchFilter || subjectFilter || educFilter || dateFrom || dateTo);
  const resetHref = `/admin/instructor-applications?status=${encodeURIComponent(statusFilter)}`;

  const paginationBase: Record<string, string> = {};
  for (const [k, v] of Object.entries(activeFilters)) {
    if (k === "page") continue;
    if (v !== "") paginationBase[k] = v;
  }

  const view: ApplicationRowView[] = rows.map((app) => {
    const yearsExp = app.years_exp == null ? null : Number(app.years_exp);
    return {
      id: app.id,
      status: app.status,
      applicantName: app.applicant_name,
      applicantEmail: app.applicant_email,
      profileImage: app.profile_image ? getAvatarUrl(app.profile_image) : null,
      initials: nameInitials(app.applicant_name),
      avatarColor: AVATAR_COLORS[crc32(app.applicant_email) % AVATAR_COLORS.length],
      isEmailVerified: Boolean(app.email_verified),
      primarySubject: app.primary_subject,
      skillLevel: app.skill_level ?? "",
      highestEducation: app.highest_education,
      expLabel: expLabelShort(yearsExp),
      submittedDate: formatDayMonthYear(app.submitted_at),
      timeAgo: humanTimeDiff(app.submitted_at),
      rejectionReason: app.rejection_reason ?? "",
      userId: app.user_id,
    };
  });

  return (
    <InstructorApplicationsClient
      rows={view}
      counts={{ pending: counts.pending, approved: counts.approved, rejected: counts.rejected }}
      totalCount={phpNumber(totalCount)}
      rangeFrom={totalCount === 0 ? 0 : offset + 1}
      rangeTo={Math.min(offset + perPage, totalCount)}
      perPage={perPage}
      totalPages={totalPages}
      pageTokens={buildPageTokens(page, totalPages, paginationBase)}
      statusFilter={statusFilter}
      searchFilter={searchFilter}
      subjectFilter={subjectFilter}
      educFilter={educFilter}
      dateFrom={dateFrom}
      dateTo={dateTo}
      educLevels={educLevels}
      activeFilterCount={activeFilterCount}
      sortCol={sortCol}
      sortDir={sortDir}
      tabHrefs={tabHrefs}
      sortHrefs={sortHrefs}
      resetHref={resetHref}
      hasAnyFilter={hasAnyFilter}
      csrfToken={csrfToken}
      initialMessage={sp.msg ?? ""}
      initialError={sp.error ?? ""}
    />
  );
}