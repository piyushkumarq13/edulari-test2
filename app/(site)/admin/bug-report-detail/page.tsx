import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { pageMetadata } from "@/lib/seo/metadata";
import { getBugReportById } from "@/lib/db/admin/bug-reports";
import { formatDayMonthYearTime24 } from "@/lib/admin/dates";
import BugReportDetailClient, { type BugReportView } from "./BugReportDetailClient";
import "@/styles/css/admin/dashboard.css";
import "@/styles/css/admin/bug-report-detail.css";

const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Edulari";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const id = Number.parseInt(sp.id ?? "0", 10) || 0;
  const report = id ? await getBugReportById(id) : null;
  return pageMetadata({
    title: report ? `Bug Report ${report.reference} – Admin | ${SITE_NAME}` : `Bug Report – Admin | ${SITE_NAME}`,
    description: "Review a submitted bug report and update its status.",
    path: "/admin/bug-report-detail",
    noindex: true,
  });
}

export default async function AdminBugReportDetailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const id = Number.parseInt(sp.id ?? "0", 10) || 0;
  if (!id) redirect("/admin/bug-reports");

  const report = await getBugReportById(id);
  if (!report) redirect("/admin/bug-reports");

  const csrfToken = await readCsrfToken();

  const view: BugReportView = {
    id: report.id,
    reference: report.reference,
    subject: report.subject,
    issueType: report.issue_type,
    severityLabel: report.severity_label,
    status: report.status,
    reporterName: report.reporter_name,
    reporterEmail: report.reporter_email,
    reporterRole: report.reporter_role || "Guest",
    browser: report.browser || "",
    reporterIp: report.reporter_ip || "",
    pageUrl: report.page_url || "",
    submittedText: report.created_at ? `${formatDayMonthYearTime24(report.created_at)} UTC` : "",
    updatedText: report.updated_at ? `${formatDayMonthYearTime24(report.updated_at)} UTC` : "",
    resolvedAtText: report.resolved_at ? `${formatDayMonthYearTime24(report.resolved_at)} UTC` : null,
    description: report.description,
    steps: report.steps,
    expected: report.expected,
    attachment: report.attachment,
    adminNotes: report.admin_notes,
  };

  return (
    <BugReportDetailClient
      report={view}
      csrfToken={csrfToken}
      flash={sp.msg ?? ""}
      flashType={sp.msg_type ?? ""}
    />
  );
}
