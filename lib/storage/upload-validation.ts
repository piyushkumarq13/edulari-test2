/**
 * Port of private/functions/upload_security.php.
 *
 * The PHP does four things, in this order:
 *   1. PHP's own upload-error check
 *   2. a size cap
 *   3. `finfo(FILEINFO_MIME_TYPE)` — a content sniff, NOT the browser's Content-Type
 *   4. magic-byte verification, but only for the MIME types in FILE_SIGNATURES
 *      (the images and PDF). doc/docx/zip/txt have no entry and skip step 4.
 *   5. a full-file scan for embedded PHP/script markers
 *
 * `scanUpload` reproduces that for the contexts Phase 3/4 needed (images + PDF).
 * `detectRealMime` / `scanUploadFile` extend it to the document types the assignment
 * attachment allows, which is what learn.php's scanUploadedFile() call passes in.
 */

const SIGS: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
  "image/gif": [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
};

const MALICIOUS = [
  "<?php", "<?=", "<script", "javascript:", "eval(", "base64_decode(",
  "system(", "exec(", "passthru(", "shell_exec(", "popen(", "proc_open(",
].map((s) => s.toLowerCase());

function startsWithAny(buf: Buffer, sigs: number[][]): boolean {
  return sigs.some((sig) => sig.every((b, i) => buf[i] === b));
}

/** OLE2 compound-file header — legacy .doc/.ppt/.xls, which finfo calls application/msword. */
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** Local-file-header magic — every zip container, including .docx/.xlsx/.pptx. */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];
const ZIP_SPANNED = [0x50, 0x4b, 0x07, 0x08];

/**
 * Content sniff standing in for PHP's `finfo(FILEINFO_MIME_TYPE)`. Only the MIME types
 * this site actually accepts are recognised; anything else returns null and is rejected
 * by the allow-list, exactly as `in_array($realMime, $allowedMimes)` does.
 */
export function detectRealMime(buffer: Buffer): string | null {
  if (buffer.length === 0) return null;

  for (const [mime, sigs] of Object.entries(SIGS)) {
    if (sigs.some((sig) => sig.every((b, i) => buffer[i] === b))) return mime;
  }
  if (buffer.length > 12 && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (startsWithAny(buffer, [OLE2])) return "application/msword";
  if (startsWithAny(buffer, [ZIP]) || startsWithAny(buffer, [ZIP_EMPTY]) || startsWithAny(buffer, [ZIP_SPANNED])) {
    return "application/zip";
  }

  // finfo's text/plain branch: no NUL byte in the first block and mostly printable.
  const head = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (!head.includes(0)) {
    let printable = 0;
    for (const byte of head) {
      if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte !== 127)) printable++;
    }
    if (head.length > 0 && printable / head.length >= 0.9) return "text/plain";
  }

  return null;
}

export type ScanResult = { safe: boolean; message: string; mime: string };

export function scanUpload(buffer: Buffer, allowedMimes: string[], context: string, maxBytes = 0): ScanResult {
  void context;
  if (maxBytes > 0 && buffer.length > maxBytes) {
    return { safe: false, message: `File too large. Max ${(maxBytes / 1048576).toFixed(1)} MB.`, mime: "" };
  }
  const detected = detectRealMime(buffer);
  if (!detected || !allowedMimes.includes(detected)) {
    return { safe: false, message: "File type not allowed.", mime: detected ?? "unknown" };
  }
  // Magic-byte confirmation only for the types FILE_SIGNATURES covers.
  if (SIGS[detected] && !startsWithAny(buffer, SIGS[detected] ?? [])) {
    return { safe: false, message: "File content does not match its type.", mime: detected };
  }
  const lower = buffer.toString("latin1").toLowerCase();
  for (const pat of MALICIOUS) {
    if (lower.includes(pat)) {
      return { safe: false, message: "File contains disallowed content and was rejected.", mime: detected };
    }
  }
  return { safe: true, message: "OK", mime: detected };
}

/**
 * The full scanUploadedFile() sequence with the PHP's exact message strings.
 * Used for the assignment attachment, whose allow-list spans PDF, DOC, DOCX, ZIP and TXT.
 */
export function scanUploadFile(
  buffer: Buffer,
  allowedMimes: string[],
  context: string,
  maxBytes = 0,
): ScanResult {
  void context;
  if (maxBytes > 0 && buffer.length > maxBytes) {
    const limitMB = Math.round((maxBytes / 1048576) * 10) / 10;
    return { safe: false, message: `File is too large. Maximum allowed size is ${limitMB} MB.`, mime: "" };
  }

  const realMime = detectRealMime(buffer);
  if (!realMime || !allowedMimes.includes(realMime)) {
    return { safe: false, message: "File type not allowed.", mime: realMime ?? "unknown" };
  }

  if (SIGS[realMime] && !startsWithAny(buffer, SIGS[realMime] ?? [])) {
    return { safe: false, message: "File content does not match its type.", mime: realMime };
  }

  const lower = buffer.toString("latin1").toLowerCase();
  for (const pat of MALICIOUS) {
    if (lower.includes(pat)) {
      return { safe: false, message: "File contains disallowed content and was rejected.", mime: realMime };
    }
  }

  return { safe: true, message: "OK", mime: realMime };
}