import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/track-report.css";
import { sql } from "@/lib/db/client";
import TrackReportClient from "./TrackReportClient";
export const metadata: Metadata = pageMetadata({
  title: "Track Report - Edulari",
  description: "Track the status of your bug reports and see updates from the Edulari team.",
  path: "/track-report",
  keywords: "track bug report, report status, bug reference",
});

export default async function TrackReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rawRef = (sp.ref ?? "").trim();
  let report: Record<string, unknown> | null = null;
  let error = "";
  let ref = "";

  if (rawRef !== "") {
    ref = rawRef.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!/^BUG-[A-Z0-9]{6}$/.test(ref)) {
      error = "Invalid reference format. It should look like BUG-A1B2C3.";
    } else {
      const rows = await sql<Record<string, unknown>[]>`
        SELECT reference, reporter_name, reporter_email, issue_type, subject, description, steps, expected,
               severity_label, status, browser, page_url, created_at, updated_at, resolved_at, admin_notes
        FROM bug_reports WHERE reference = ${ref}
      `;
      report = rows.length ? rows[0] : null;
      if (!report) error = `No report found for reference ${ref}. Please double-check and try again.`;
    }
  }

  return (
    <>
      <section className="tr-hero">
        <div className="tr-hero-noise" />
        <div className="tr-hero-inner">
          <div className="tr-hero-pill">
            <span className="tr-hero-pill-dot" />
            Report Tracker
          </div>
          <h1>Track your bug report</h1>
          <p>Enter your reference number to see live status and admin updates.</p>

          <form method="GET" action="/track-report" className="tr-search-form">
            <div className="tr-search-box">
              <span className="tr-search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </span>
              <input
                type="text"
                name="ref"
                className="tr-search-input"
                placeholder="BUG-A1B2C3"
                defaultValue={ref}
                maxLength={10}
                autoComplete="off"
                spellCheck={false}
                aria-label="Report reference number"
              />
              <button type="submit" className="tr-search-btn">Track</button>
            </div>
          </form>
        </div>
      </section>

      <TrackReportClient reference={ref} error={error} report={report} />
    </>
  );
}
