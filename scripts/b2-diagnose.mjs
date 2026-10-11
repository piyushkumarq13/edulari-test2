/**
 * Works out exactly how far the Backblaze credentials get: which endpoints are
 * permitted for this key and whether the configured bucket is visible at all.
 * Prints endpoint outcomes and Backblaze error codes only - no credentials.
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

const auth = `Basic ${Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`).toString("base64")}`;

async function call(label, pathname, body) {
  try {
    const res = await fetch(`https://api.backblazeb2.com/b2api/v2${pathname}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    let p = {};
    try {
      p = JSON.parse(text);
    } catch {
      /* ignore */
    }
    const ok = res.ok ? "OK  " : "FAIL";
    console.log(`${ok} ${label} -> HTTP ${res.status}${p.status ? ` status ${p.status}` : ""}${p.message ? ` "${p.message}"` : ""}`);
    return p;
  } catch (err) {
    console.log(`FAIL ${label} -> network: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

console.log("\nBackblaze credential probe\n");

const auth1 = await call("b2_authorize_account", "/b2_authorize_account");
if (!auth1?.accountId) {
  console.log("\nThe key cannot authorize at all - B2_KEY_ID / B2_APPLICATION_KEY are wrong or revoked.");
  process.exit(1);
}

const accountId = auth1.accountId;
console.log(`\nauthorized. bucket-scoped capabilities: ${(auth1.allowed?.bucketId ? "bucketId " : "") + (auth1.allowed?.bucketName ? "bucketName " : "") + (auth1.allowed?.capabilities?.length ? `capabilities(${auth1.allowed.capabilities.length})` : "no-capabilities")}\n`);

if (auth1.allowed?.bucketName) {
  console.log("This key is restricted to ONE bucket name; b2_list_buckets is not available to it.");
}

await call("b2_get_bucket (by bucketId)", "/b2_get_bucket", { accountId, bucketId: process.env.B2_BUCKET_ID });
await call("b2_get_bucket (by bucketName)", "/b2_get_bucket", { bucketName: process.env.B2_BUCKET_NAME });
await call("b2_list_buckets", "/b2_list_buckets", { accountId });

console.log("\nIf b2_get_bucket answers 404 for both id and name, the configured bucket no longer");
console.log("exists in the account these credentials belong to - the values copied from");
console.log("b2_config.php are stale. Create a bucket + key at https://secure.backblazeb2.com and");
console.log("update B2_BUCKET_ID / B2_BUCKET_NAME / B2_KEY_ID / B2_APPLICATION_KEY in .env.local.");
console.log("\nNo credential was printed.");
