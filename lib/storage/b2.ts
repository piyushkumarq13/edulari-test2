import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { scanUpload } from "./upload-validation";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION ?? "us-east-005";
  if (!endpoint) throw new Error("B2_ENDPOINT is not set");
  client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: process.env.B2_KEY_ID ?? "", secretAccessKey: process.env.B2_APPLICATION_KEY ?? "" },
    forcePathStyle: true,
  });
  return client;
}

export const B2_BUCKET = process.env.B2_BUCKET_NAME ?? "";

export async function presignPut(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
  const command = new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

export async function getObject(key: string, range?: string): Promise<{ body: unknown; contentType?: string; contentLength?: number; status: number; acceptRanges?: string }> {
  const command = new GetObjectCommand({ Bucket: B2_BUCKET, Key: key, Range: range });
  const output = await getClient().send(command);
  return { body: output.Body, contentType: output.ContentType, contentLength: output.ContentLength, status: output.$metadata.httpStatusCode ?? 200, acceptRanges: output.AcceptRanges };
}

export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const out = await getClient().send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: key }));
    return { size: out.ContentLength ?? 0, contentType: out.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key }));
}

/**
 * Direct (non-presigned) PUT, used for the small uploads that fit inside a request body:
 * the student avatar and the assignment attachment. Mirrors b2UploadFile()'s
 * `BUCKET/prefix/filename` key shape.
 */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

async function readRange(key: string, range: string): Promise<Buffer> {
  const out = await getClient().send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: key, Range: range }));
  const chunks: Buffer[] = [];
  for await (const chunk of out.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export type VerifyUploadResult = { ok: boolean; message: string; size: number; mime: string };

/**
 * Server-side verification after a presigned PUT (AGENTS.md section 8):
 * HEAD for the size, a ranged GET for the magic bytes, then the same
 * scanUpload() rules the direct-upload path uses. The object is deleted from B2
 * if any check fails, so a bad object is never recorded in the database.
 */
export async function verifyUploadedObject(
  key: string,
  opts: { allowedMimes: string[]; maxBytes: number; context: string },
): Promise<VerifyUploadResult> {
  const head = await headObject(key);
  if (!head) {
    return { ok: false, message: "Uploaded object not found.", size: 0, mime: "" };
  }
  if (head.size === 0) {
    await deleteObject(key);
    return { ok: false, message: "Uploaded file is empty.", size: head.size, mime: "" };
  }
  if (head.size > opts.maxBytes) {
    await deleteObject(key);
    return { ok: false, message: `File too large. Max ${(opts.maxBytes / 1048576).toFixed(1)} MB.`, size: head.size, mime: head.contentType ?? "" };
  }

  // Magic-byte window: read the first 64 KB (enough for every signature + pattern scan head).
  const probeLength = Math.min(head.size, 65536);
  const probe = await readRange(key, `bytes=0-${probeLength - 1}`);
  const scan = scanUpload(probe, opts.allowedMimes, opts.context, opts.maxBytes);
  if (!scan.safe) {
    await deleteObject(key);
    return { ok: false, message: scan.message, size: head.size, mime: scan.mime };
  }

  return { ok: true, message: "OK", size: head.size, mime: scan.mime };
}
