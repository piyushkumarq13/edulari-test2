/**
 * One-shot migrator: copies credential VALUES from the old PHP site's config files
 * into Edulari/.env.local.
 *
 *   node migrate-secrets.mjs
 *
 * Hygiene rules this script obeys:
 *   - It prints only the KEY NAMES it wrote. Never a value.
 *   - It never overwrites a key that already has a value in .env.local.
 *   - It only writes to .env.local, which is gitignored.
 *   - It does not touch .env.example (placeholders only, by design).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OLD = "C:\\Users\\piyus\\Desktop\\htdocs (7)\\htdocs";
const ENV_LOCAL = path.join(process.cwd(), ".env.local");

// ── 1. Parse the PHP sources into { PHP_CONSTANT: value } ────────────────────

function readFileOrDie(p) {
  if (!fs.existsSync(p)) throw new Error(`missing source file: ${p}`);
  return fs.readFileSync(p, "utf8");
}

/** secrets.php stores values as $_ENV['KEY'] = 'value'; */
function parseEnvAssignments(src) {
  const out = {};
  const re = /\$_ENV\[\s*['"]([A-Za-z0-9_]+)['"]\s*\]\s*=\s*(['"])((?:\\.|(?!\2).)*)\2\s*;/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = unescapePhp(m[3]);
  return out;
}

/**
 * config.php / b2_config.php / api_config.php use define('KEY', 'value');
 * Entries whose value references $_ENV are skipped - secrets.php already holds those.
 *
 * EXCEPTION: `define('K', $_ENV['K'] ?? 'literal')` (used by b2_config.php for the
 * "fill in the real values below" defaults) is resolved to the fallback literal, which
 * is where the real Backblaze credentials actually live in this checkout.
 */
function parseDefines(src) {
  const out = {};
  const re = /define\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[3].includes("$") || m[3].includes("getenv")) continue;
    out[m[1]] = unescapePhp(m[3]);
  }
  return out;
}

/** define('K', $_ENV['K'] ?? 'literal') -> K = literal */
function parseEnvFallbackDefines(src) {
  const out = {};
  const re = /define\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*\$_ENV\[\s*['"][A-Za-z0-9_]+['"]\s*\]\s*\?\?\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[3].length) out[m[1]] = unescapePhp(m[3]);
  }
  return out;
}

/** integer defines (SMTP_PORT) */
function parseIntDefines(src) {
  const out = {};
  const re = /define\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*(\d+)\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = m[2];
  return out;
}

/** boolean defines (SMTP_AUTH / SMTP_SECURE) */
function parseBoolDefines(src) {
  const out = {};
  const re = /define\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*(true|false)\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) out[m[1]] = m[2];
  return out;
}

function unescapePhp(s) {
  return s.replace(/\\(['"\\])/g, "$1").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

const secrets = parseEnvAssignments(readFileOrDie(path.join(OLD, "private", "secrets.php")));
const configSrc = readFileOrDie(path.join(OLD, "private", "config.php"));
const b2Src = readFileOrDie(path.join(OLD, "private", "config", "b2_config.php"));
const apiSrc = readFileOrDie(path.join(OLD, "private", "api", "api_config.php"));

const constants = {
  ...parseDefines(configSrc),
  ...parseIntDefines(configSrc),
  ...parseBoolDefines(configSrc),
  ...parseDefines(b2Src),
  ...parseEnvFallbackDefines(b2Src),
  ...parseDefines(apiSrc),
  ...parseIntDefines(apiSrc),
  ...parseBoolDefines(apiSrc),
  ...parseEnvFallbackDefines(apiSrc),
};
const merged = { ...constants, ...secrets }; // secrets.php wins

// config.php defines SMTP_FROM_NAME as SITE_NAME rather than a literal.
if (!merged.SMTP_FROM_NAME && merged.SITE_NAME) merged.SMTP_FROM_NAME = merged.SITE_NAME;

// ── 2. PHP constant -> Edulari env name ──────────────────────────────────────

const MAP = [
  // identity / site
  ["SITE_NAME", "SITE_NAME"],
  ["SITE_URL", "NEXT_PUBLIC_SITE_URL"],
  ["ADMIN_EMAIL", "ADMIN_EMAIL"],
  ["CURRENCY_CODE", "CURRENCY_CODE"],
  ["CURRENCY_SYMBOL", "CURRENCY_SYMBOL"],
  ["SESSION_LIFETIME", "SESSION_LIFETIME"],
  // mail
  ["SMTP_HOST", "SMTP_HOST"],
  ["SMTP_PORT", "SMTP_PORT"],
  ["SMTP_SECURE", "SMTP_SECURE"],
  ["SMTP_AUTH", "SMTP_AUTH"],
  ["SMTP_USERNAME", "SMTP_USERNAME"],
  ["SMTP_PASSWORD", "SMTP_PASSWORD"],
  ["SMTP_FROM_EMAIL", "SMTP_FROM_EMAIL"],
  ["SMTP_FROM_NAME", "SMTP_FROM_NAME"],
  // storage
  ["B2_BUCKET_NAME", "B2_BUCKET_NAME"],
  ["B2_BUCKET_ID", "B2_BUCKET_ID"],
  ["B2_KEY_ID", "B2_KEY_ID"],
  ["B2_APPLICATION_KEY", "B2_APPLICATION_KEY"],
  // payments
  ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_ID"],
  ["RAZORPAY_KEY_SECRET", "RAZORPAY_KEY_SECRET"],
  ["RAZORPAY_WEBHOOK_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
  // oauth
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"],
  ["GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET"],
  ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_ID"],
  ["GITHUB_CLIENT_SECRET", "GITHUB_CLIENT_SECRET"],
  // ai
  ["ACTIVE_AI_PROVIDER", "ACTIVE_AI_PROVIDER"],
  ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY"],
  ["OPENROUTER_ENDPOINT", "OPENROUTER_ENDPOINT"],
  ["OPENROUTER_MODEL", "OPENROUTER_MODEL"],
  ["OPENROUTER_SITE_NAME", "OPENROUTER_SITE_NAME"],
  ["GROQ_API_KEY", "GROQ_API_KEY"],
  ["NVIDIA_KIMI_API_KEY", "NVIDIA_KIMI_API_KEY"],
  ["NVIDIA_KIMI_ENDPOINT", "NVIDIA_KIMI_ENDPOINT"],
  ["NVIDIA_KIMI_MODEL", "NVIDIA_KIMI_MODEL"],
  ["AI_CONNECT_TIMEOUT", "AI_CONNECT_TIMEOUT"],
  ["AI_REQUEST_TIMEOUT", "AI_REQUEST_TIMEOUT"],
  ["AI_MAX_EXEC_TIME", "AI_MAX_EXEC_TIME"],
];

// ── 3. Read what .env.local already has ──────────────────────────────────────

const existing = new Map();
let existingRaw = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, "utf8") : "";
for (const line of existingRaw.split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
  if (m) existing.set(m[1], m[2].trim());
}
const isSet = (k) => {
  const v = existing.get(k);
  return v !== undefined && v !== "" && v !== '""' && v !== "''";
};

// ── 4. Build the lines to append ─────────────────────────────────────────────

function encodeValue(v) {
  const s = String(v).replace(/\r\n|\r|\n/g, " ");
  if (s === "") return '""';
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const appended = [];
const skipped = [];
const missingSource = [];

for (const [phpKey, envName] of MAP) {
  if (isSet(envName)) {
    skipped.push(envName);
    continue;
  }
  const value = merged[phpKey];
  if (value === undefined || value === "") {
    missingSource.push(`${envName} (no ${phpKey} in PHP)`);
    continue;
  }
  appended.push(`${envName}=${encodeValue(value)}`);
}

// Values that have no upstream counterpart at all. 64 random bytes, hex encoded.
function freshHex() {
  return crypto.randomBytes(32).toString("hex");
}
const GENERATED = [
  ["SESSION_SECRET", () => freshHex()],
  ["CSRF_SECRET", () => freshHex()],
  ["DATA_ENCRYPTION_KEY", () => freshHex()],
  ["CRON_SECRET", () => freshHex()],
];
for (const [envName, gen] of GENERATED) {
  if (isSet(envName)) {
    skipped.push(envName);
    continue;
  }
  appended.push(`${envName}=${gen()}`);
}

// ── 5. Append (never clobber) ────────────────────────────────────────────────

const header = [
  "",
  "# ---------------------------------------------------------------------------",
  "# Copied from the old PHP site on demand so the full stack can be exercised.",
  "# secrets.php -> $_ENV[], config.php / b2_config.php / api_config.php -> define().",
  "# This file is gitignored. Never commit it.",
  "# ---------------------------------------------------------------------------",
].join("\n");

if (appended.length) {
  const block = `${existingRaw.replace(/\s*$/, "")}\n${header}\n${appended.join("\n")}\n`;
  fs.writeFileSync(ENV_LOCAL, block, "utf8");
}

// ── 6. Report names only ─────────────────────────────────────────────────────

const after = new Map();
for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
  if (m) after.set(m[1], m[2].trim());
}

console.log(`\nwrote ${appended.length} key(s) to .env.local:`);
for (const line of appended) console.log(`  + ${line.split("=")[0]}`);

console.log(`\nalready set, left untouched (${skipped.length}):`);
console.log(`  ${skipped.join(", ") || "(none)"}`);

if (missingSource.length) {
  console.log(`\nnot found in the PHP sources (${missingSource.length}) - set these yourself:`);
  for (const m of missingSource) console.log(`  ! ${m}`);
}

const stillEmpty = [...after.keys()].filter((k) => !isSet(k) && !missingSource.some((m) => m.startsWith(k)));
console.log(`\n.env.local now has ${after.size} keys.`);
console.log(`values were never printed.`);
void stillEmpty;
