import crypto from "node:crypto";
import { sql } from "@/lib/db/client";

/**
 * Port of private/functions/certificates.php.
 *
 * Criteria: enrollment.progress_percentage >= courses.passing_percentage AND
 * courses.certificate_enabled. The public id is CERT-XXXX-XXXX-XXXX (three 4-hex groups
 * from random_bytes(2), uppercased, retried on collision). course_name / student_name
 * are snapshots taken at issue time and never refreshed.
 */

export type Certificate = {
  id: number;
  certificate_id: string;
  enrollment_id: number;
  student_id: number;
  course_id: number;
  course_name: string;
  student_name: string;
  issued_at: Date;
};

export const CERTIFICATE_ID_PREFIX = "CERT-";

/** 4 uppercase hex chars, exactly like substr(bin2hex(random_bytes(2)), 0, 4). */
export function certificateIdPart(randomBytes: () => Buffer = () => crypto.randomBytes(2)): string {
  return randomBytes().toString("hex").slice(0, 4).toUpperCase();
}

export function buildCertificateId(part1: string, part2: string, part3: string): string {
  return `${CERTIFICATE_ID_PREFIX}${part1}-${part2}-${part3}`;
}

export async function hasMetCertificateCriteria(studentId: number, courseId: number): Promise<boolean> {
  const rows = await sql<{
    progress_percentage: number;
    passing_percentage: number;
    certificate_enabled: boolean;
  }[]>`
    SELECT e.progress_percentage, c.passing_percentage, c.certificate_enabled
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    WHERE e.student_id = ${studentId} AND e.course_id = ${courseId}
  `;
  if (rows.length === 0) return false;
  const row = rows[0];
  if (!row.certificate_enabled) return false;
  return Number(row.progress_percentage) >= Number(row.passing_percentage);
}

/** Port of getCertificateByEnrollment(). */
export async function getCertificateByEnrollment(studentId: number, courseId: number): Promise<Certificate | null> {
  const rows = await sql<Certificate[]>`
    SELECT cert.* FROM certificates cert
    JOIN enrollments e ON cert.enrollment_id = e.id
    WHERE e.student_id = ${studentId} AND e.course_id = ${courseId}
  `;
  return rows[0] ?? null;
}

/** Port of getCertificateById(). */
export async function getCertificateByCertificateId(certificateId: string): Promise<Certificate | null> {
  const rows = await sql<Certificate[]>`SELECT * FROM certificates WHERE certificate_id = ${certificateId}`;
  return rows[0] ?? null;
}

async function certificateIdExists(certificateId: string): Promise<boolean> {
  const rows = await sql<{ id: number }[]>`SELECT id FROM certificates WHERE certificate_id = ${certificateId}`;
  return rows.length > 0;
}

/**
 * Port of issueCertificate(): returns the existing certificate when there is one, else
 * mints a collision-free id and snapshots the names. Returns null without an enrollment.
 */
export async function issueCertificate(
  studentId: number,
  courseId: number,
  studentName: string,
  courseName: string,
): Promise<Certificate | null> {
  const enrollments = await sql<{ id: number }[]>`
    SELECT id FROM enrollments WHERE student_id = ${studentId} AND course_id = ${courseId}
  `;
  if (enrollments.length === 0) return null;
  const enrollmentId = Number(enrollments[0].id);

  const existing = await sql<Certificate[]>`SELECT * FROM certificates WHERE enrollment_id = ${enrollmentId}`;
  if (existing.length) return existing[0];

  let certificateId = "";
  for (let i = 0; i < 10; i++) {
    const candidate = buildCertificateId(certificateIdPart(), certificateIdPart(), certificateIdPart());
    if (!(await certificateIdExists(candidate))) {
      certificateId = candidate;
      break;
    }
  }
  if (certificateId === "") return null;

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO certificates
      (certificate_id, enrollment_id, student_id, course_id, course_name, student_name, issued_at)
    VALUES (${certificateId}, ${enrollmentId}, ${studentId}, ${courseId}, ${courseName}, ${studentName}, now())
    RETURNING id
  `;
  if (inserted.length === 0) return null;

  const rows = await sql<Certificate[]>`SELECT * FROM certificates WHERE id = ${inserted[0].id}`;
  return rows[0] ?? null;
}

export type CertificateListRow = Certificate & { thumbnail: string | null; course_id: number };

/** certificates.php's list query (cert.* plus the course thumbnail). */
export async function getCertificatesForStudent(studentId: number): Promise<CertificateListRow[]> {
  return sql<CertificateListRow[]>`
    SELECT cert.*, c.thumbnail, cert.course_id AS course_id
    FROM certificates cert
    LEFT JOIN courses c ON cert.course_id = c.id
    WHERE cert.student_id = ${studentId}
    ORDER BY cert.issued_at DESC
  `;
}

/** certificates.php's client-side search: course_name OR certificate_id, case-insensitive. */
export function filterCertificates<T extends { course_name: string; certificate_id: string }>(
  rows: T[],
  search: string,
): T[] {
  if (search.trim() === "") return rows;
  const needle = search.trim().toLowerCase();
  return rows.filter(
    (c) => c.course_name.toLowerCase().includes(needle) || c.certificate_id.toLowerCase().includes(needle),
  );
}