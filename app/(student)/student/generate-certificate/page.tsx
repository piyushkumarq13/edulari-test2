import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { formatDayMonthYear } from "@/lib/format";
import { findEnrollment, getCourseDetail } from "@/lib/db/learning";
import { issueCertificate, hasMetCertificateCriteria } from "@/lib/learning/certificates";
import { SITE_NAME } from "@/lib/site";
import CertificateClient from "./CertificateClient";
import "@/styles/css/student/generate-certificate.css";

export const metadata: Metadata = {
  title: `Certificate of Completion — ${SITE_NAME}`,
  description: "Your Edulari certificate of completion.",
  robots: { index: false, follow: false },
};

/**
 * Port of public/student/generate-certificate.php.
 *
 * The canvas is 1122 x 730 px internally (CERT_W/CERT_H in the PHP) and the html2canvas /
 * jsPDF export runs at 1122 x 794. All of the styling is the inline <style> block in the
 * PHP - /assets/css/student/generate-certificate.css does not exist in the old site - so
 * it is carried across verbatim in CERTIFICATE_STYLES.
 */
export default async function GenerateCertificatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireRole("student");
  const sp = await searchParams;
  const raw = sp.course ?? "0";
  const courseId = Number.parseInt(raw, 10);
  if (!courseId || !Number.isFinite(courseId)) redirect("/student/my-courses");

  const enrollment = await findEnrollment(user.id, courseId);
  if (!enrollment) redirect("/student/my-courses");

  const courseInfo = await getCourseDetail(courseId);
  if (!courseInfo) redirect("/student/my-courses");

  if (!(await hasMetCertificateCriteria(user.id, courseId))) {
    redirect(`/student/learn?course=${courseId}`);
  }

  const certificate = await issueCertificate(user.id, courseId, user.name, courseInfo.title);
  if (!certificate) redirect(`/student/learn?course=${courseId}`);

  const issuedDate = formatDayMonthYear(certificate.issued_at);
  const enrolledDate = enrollment.enrolled_at ? formatDayMonthYear(enrollment.enrolled_at) : issuedDate;
  const completedDate = enrollment.completed_at ? formatDayMonthYear(enrollment.completed_at) : issuedDate;

  return (
    <CertificateClient
      courseId={courseId}
      certificateId={certificate.certificate_id}
      studentName={certificate.student_name}
      courseName={certificate.course_name}
      issuedDate={issuedDate}
      enrolledDate={enrolledDate}
      completedDate={completedDate}
    />
  );
}