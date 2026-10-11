import { putObject, deleteObject } from "@/lib/storage/b2";
import { sql } from "@/lib/db/client";

/**
 * Instructor verification documents (government ID, marksheet). They live in the PRIVATE
 * B2 area under instructor_docs/, keyed the way the PHP named them
 * ({field}_{userId}_{8hex}.{ext}), and are served only through an authorised
 * /api/media branch — never back to the applicant.
 */

export const DOC_ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const DOC_MAX_BYTES = 5 * 1024 * 1024;

const PREFIX = "instructor_docs";

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

function keyFor(field: "govt_id_file" | "marksheet_file", userId: number, filename: string): string {
  const hex = Math.random().toString(16).slice(2, 10);
  return `${PREFIX}/${field}_${userId}_${hex}.${extOf(filename)}`;
}

export interface StoredDoc {
  key: string;
}

export async function storeInstructorDocument(
  field: "govt_id_file" | "marksheet_file",
  userId: number,
  filename: string,
  body: Buffer,
  contentType: string,
): Promise<StoredDoc> {
  const key = keyFor(field, userId, filename);
  await putObject(key, body, contentType);
  return { key };
}

/**
 * Delete the document objects for an application and clear the DB columns.
 * Mirrors _deleteInstructorDocs() — the filenames are cleared even if the object is
 * already gone, so a second run cannot resurrect them.
 */
export async function deleteInstructorDocuments(app: {
  id: number;
  govt_id_file?: string | null;
  marksheet_file?: string | null;
}): Promise<void> {
  const keys = [app.govt_id_file, app.marksheet_file].filter(
    (f): f is string => typeof f === "string" && f.startsWith(PREFIX),
  );
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch {
      // A missing object is fine — the columns are cleared below either way.
    }
  }
  await sql`
    UPDATE instructor_applications SET govt_id_file = NULL, marksheet_file = NULL
    WHERE id = ${app.id}`;
}
