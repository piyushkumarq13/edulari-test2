import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/verify-certificate.css";
import { sql } from "@/lib/db/client";
import VerifyCertificateClient from "./VerifyCertificateClient";
export const metadata: Metadata = pageMetadata({
  title: "Verify Certificate - Edulari",
  description: "Instantly verify the authenticity of any Edulari certificate using its unique Certificate ID.",
  path: "/verify-certificate",
  keywords: "verify certificate, certificate verification, authentic certificate, edulari certificate",
});

export default async function VerifyCertificatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const searchId = (sp.id ?? "").trim();
  let cert: Record<string, unknown> | null = null;

  if (searchId !== "") {
    const rows = await sql<Record<string, unknown>[]>`SELECT * FROM certificates WHERE certificate_id = ${searchId}`;
    if (rows.length > 0) {
      cert = rows[0];
      const extra = await sql<{ instructor_name: string | null }[]>`SELECT u.name AS instructor_name FROM courses c LEFT JOIN users u ON u.id = c.instructor_id WHERE c.id = ${cert.course_id as number}`;
      cert.instructor_name = extra[0]?.instructor_name ?? null;
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const verifyBaseUrl = `${siteUrl}/verify-certificate`;
  const shareUrl = cert ? `${verifyBaseUrl}?id=${encodeURIComponent(String(cert.certificate_id))}` : "";

  return (
    <VerifyCertificateClient
      searchId={searchId}
      searched={searchId !== ""}
      cert={cert}
      shareUrl={shareUrl}
      verifyBaseUrl={verifyBaseUrl}
    />
  );
}
