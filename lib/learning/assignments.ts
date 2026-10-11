import { sql } from "@/lib/db/client";
import { putObject, deleteObject } from "@/lib/storage/b2";
import { scanUploadFile } from "@/lib/storage/upload-validation";

/**
 * Port of submitAssignment() from private/functions/student.php, plus the fix for the
 * bug where learn.php uploads the attachment and then throws it away (see
 * docs/analysis/phase6.md section 7.2).
 *
 * PHP behaviour that is preserved exactly:
 *  - an existing submission is UPDATED with the new text, `submitted_at = NOW()` and
 *    `status = 'pending'` — a resubmission therefore discards the grade and feedback;
 *  - `due_days` and `allow_late_submission` are display-only on the student side, so
 *    nothing is rejected for being late.
 */

export const ASSIGNMENT_MAX_BYTES = 10 * 1024 * 1024;

/** learn.php's scanUploadedFile() allow-list, verbatim. */
export const ASSIGNMENT_ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "text/plain",
];

/** learn.php's `preg_replace('/[^a-zA-Z0-9._-]/', '_', basename(...))`. */
export function sanitizeUploadName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export type SubmissionInput = {
  submissionText: string;
  /** Raw bytes + original filename of the optional attachment. */
  attachment?: { buffer: Buffer; originalName: string } | null;
};

export type SubmitAssignmentResult = {
  submissionId: number;
  attachmentFile: string | null;
  attachmentName: string | null;
  attachmentError: string | null;
};

/** PHP: `time() . '_' . $userId . '_' . <sanitised basename>`. */
export function assignmentObjectName(nowSeconds: number, userId: number, originalName: string): string {
  return `${nowSeconds}_${userId}_${sanitizeUploadName(originalName)}`;
}

export async function submitAssignment(
  enrollmentId: number,
  lessonId: number,
  userId: number,
  input: SubmissionInput,
): Promise<SubmitAssignmentResult> {
  let attachmentFile: string | null = null;
  let attachmentName: string | null = null;
  let attachmentError: string | null = null;

  if (input.attachment && input.attachment.buffer.length > 0) {
    const scan = scanUploadFile(
      input.attachment.buffer,
      ASSIGNMENT_ALLOWED_MIMES,
      "assignment",
      ASSIGNMENT_MAX_BYTES,
    );

    if (scan.safe) {
      const objectName = assignmentObjectName(Math.floor(Date.now() / 1000), userId, input.attachment.originalName);
      const key = `assignments/${objectName}`;
      try {
        await putObject(key, input.attachment.buffer, scan.mime);
        attachmentFile = key;
        attachmentName = sanitizeUploadName(input.attachment.originalName);
      } catch {
        attachmentError = "Failed to upload attachment. Please try again.";
      }
    } else {
      attachmentError = scan.message;
    }
  }

  const existing = await sql<{ id: number; attachment_file: string | null }[]>`
    SELECT id, attachment_file FROM assignment_submissions
    WHERE enrollment_id = ${enrollmentId} AND lesson_id = ${lessonId}
  `;

  let submissionId: number;

  if (existing.length) {
    // Keep a previously stored attachment when this submission carries none.
    const keepFile = attachmentFile ?? existing[0].attachment_file;
    // PHP sets status = 'pending' on resubmission but leaves the old marks_obtained /
    // feedback / graded_at in place, so a re-graded-looking submission stays visible on a
    // pending one. Intended behaviour is ported here: the grade is cleared with the status.
    await sql`
      UPDATE assignment_submissions
      SET submission_text = ${input.submissionText},
          attachment_file = ${keepFile},
          submitted_at = now(),
          status = 'pending',
          marks_obtained = NULL,
          feedback = NULL,
          graded_at = NULL
      WHERE id = ${existing[0].id}
    `;
    submissionId = Number(existing[0].id);
    if (attachmentFile === null && existing[0].attachment_file && keepFile === existing[0].attachment_file) {
      // unchanged, nothing to do
    } else if (existing[0].attachment_file && existing[0].attachment_file !== keepFile) {
      await deleteObject(existing[0].attachment_file).catch(() => undefined);
    }
  } else {
    const inserted = await sql<{ id: number }[]>`
      INSERT INTO assignment_submissions (enrollment_id, lesson_id, submission_text, attachment_file, submitted_at)
      VALUES (${enrollmentId}, ${lessonId}, ${input.submissionText}, ${attachmentFile}, now())
      RETURNING id
    `;
    submissionId = Number(inserted[0].id);
  }

  return { submissionId, attachmentFile, attachmentName, attachmentError };
}