import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/report-bug.css";
import { getSessionUser } from "@/lib/auth/guards";
import ReportBugForm from "./ReportBugForm";
import { readCsrfToken } from "@/lib/security/csrf";
export const metadata: Metadata = pageMetadata({
  title: "Report a Bug - Edulari",
  description: "Spotted a technical issue on Edulari? Report it here and we'll investigate.",
  path: "/report-bug",
  noindex: true,
});

export default async function ReportBugPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const success = sp.success === "1";
  const reference = sp.ref ?? "";
  const [user, csrfToken] = await Promise.all([getSessionUser(), readCsrfToken()]);

  return (
    <ReportBugForm
      success={success}
      reference={reference}
      prefillName={user?.name ?? ""}
      prefillEmail={user?.email ?? ""}
      prefillRole={user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Guest"}
      csrfToken={csrfToken}
    />
  );
}
