import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getStudentStats } from "@/lib/db/commerce";
import { filterCertificates, getCertificatesForStudent } from "@/lib/learning/certificates";
import { formatLongDate, formatYear } from "@/lib/format";
import CertificatesClient from "./CertificatesClient";
import "@/styles/css/student/certificates.css";

export const metadata: Metadata = pageMetadata({
  title: "My Certificates — Edulari",
  description: "Every certificate of achievement you have earned on Edulari.",
  path: "/student/certificates",
  noindex: true,
});

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;
  await getStudentStats(user.id); // PHP loads it; the navbar already shows the counts.

  const search = (sp.search ?? "").trim();
  const all = await getCertificatesForStudent(user.id);
  const rows = filterCertificates(all, search);

  // Oldest issued_at for the "First Certificate" year stat.
  const firstCertificateYear = rows.length > 0 ? formatYear(rows[rows.length - 1].issued_at) : "";

  return (
    <>
      <CertificatesClient
        certificates={rows.map((cert) => ({
          id: Number(cert.id),
          certificate_id: cert.certificate_id,
          course_id: Number(cert.course_id),
          course_name: cert.course_name,
          thumbnail: cert.thumbnail,
          issuedAtLabel: formatLongDate(cert.issued_at),
        }))}
        search={search}
        firstCertificateYear={firstCertificateYear}
      />
      <div className="certs-toast" id="certsToast" aria-live="polite" />
    </>
  );
}