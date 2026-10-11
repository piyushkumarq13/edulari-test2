/**
 * Derives the two Backblaze values the port needs but the old site never stored:
 *
 *   B2_ENDPOINT  s3-compatible endpoint, https://s3.<region>.backblazeb2.com
 *   B2_REGION    the bucket's region, e.g. us-west-004
 *
 * Backblaze does not let a bucket name be turned into an endpoint locally, so this
 * calls the documented bucket-info API with the credentials already in .env.local.
 * Read-only, and it prints no secret - only the derived region/endpoint.
 *
 *   node scripts/derive-b2.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ENV_LOCAL = path.join(process.cwd(), ".env.local");

for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const { B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME } = process.env;

for (const [k, v] of [["B2_KEY_ID", B2_KEY_ID], ["B2_APPLICATION_KEY", B2_APPLICATION_KEY], ["B2_BUCKET_NAME", B2_BUCKET_NAME]]) {
  if (!v) {
    console.error(`derive-b2: ${k} is empty in .env.local - cannot continue.`);
    process.exit(1);
  }
}

const auth = `Basic ${Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString("base64")}`;

async function b2(pathname, body = {}) {
  const res = await fetch(`https://api.backblazeb2.com/b2api/v2${pathname}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let status = "(unparsed)";
    let message = "";
    try {
      const p = JSON.parse(text);
      status = p.status ?? status;
      message = p.message ?? "";
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}, status ${status}${message ? ` - ${message}` : ""}`);
  }
  return JSON.parse(text);
}

// Step 1: authorize to learn the accountId (b2_authorize_account).
// Step 2: b2_get_bucket for the one bucket this key is scoped to. A bucket-restricted
// application key cannot call b2_list_buckets (Backblaze answers with a confusing
// "should go to a host name for B2_API"), but b2_get_bucket is permitted.
let accountId = process.env.B2_ACCOUNT_ID;
let bucket;

try {
  const auth1 = await b2("/b2_authorize_account");
  accountId = accountId || auth1.accountId;
  bucket = process.env.B2_BUCKET_ID
    ? await b2("/b2_get_bucket", { accountId, bucketId: process.env.B2_BUCKET_ID })
    : await b2("/b2_get_bucket", { accountId, bucketName: B2_BUCKET_NAME });
} catch (err) {
  console.error(`derive-b2: Backblaze rejected the lookup - ${err instanceof Error ? err.message : String(err)}.`);
  console.error("The key may lack bucket-read scope, or the account may be paused.");
  process.exit(1);
}

if (bucket.bucketName && bucket.bucketName !== B2_BUCKET_NAME) {
  console.error(`derive-b2: B2_BUCKET_ID and B2_BUCKET_NAME in .env.local point at different buckets.`);
  console.error("Not printing either name; reconcile them before continuing.");
  process.exit(1);
}

const region = bucket.location;
const endpoint = `https://s3.${region}.backblazeb2.com`;

console.log(`\nbucket name   : ${B2_BUCKET_NAME}`);
console.log(`bucket region : ${region}`);
console.log(`S3 endpoint   : ${endpoint}\n`);

// Backblaze also needs a short-lived S3 token per request; the port handles that in
// lib/storage/b2.ts, so nothing else is derived here.

// Append (never clobber) the two derived keys.
let raw = fs.readFileSync(ENV_LOCAL, "utf8");
const have = new Set(
  raw
    .split(/\r?\n/)
    .map((l) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l)?.[1])
    .filter(Boolean),
);

const lines = [];
if (!have.has("B2_ENDPOINT")) lines.push(`B2_ENDPOINT=${endpoint}`);
if (!have.has("B2_REGION")) lines.push(`B2_REGION=${region}`);

if (lines.length) {
  raw = raw.replace(/\s*$/, "");
  raw += `\n\n# --- derived from the Backblaze bucket-info API (bucket region) ---\n${lines.join("\n")}\n`;
  fs.writeFileSync(ENV_LOCAL, raw, "utf8");
  for (const l of lines) console.log(`  + ${l.split("=")[0]}`);
} else {
  console.log("B2_ENDPOINT / B2_REGION already set - nothing written.");
}
