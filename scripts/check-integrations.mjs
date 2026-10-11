/**
 * Verifies that the credentials in .env.local actually work against each service.
 *
 *   node scripts/check-integrations.mjs
 *
 * Safety: sends no email, creates no payment, creates no file. It performs one
 * authenticated read per service (SMTP AUTH handshake, a Razorpay list call, one
 * 1-token AI completion) and prints PASS/FAIL plus a short reason. No secret, token
 * or full identifier is ever printed.
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
const env = process.env;

const has = (k) => Boolean(env[k] && env[k].trim());
let failures = 0;

function report(ok, label, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  -  ${detail}` : ""}`);
}

console.log("\n=== integration check (no side effects) ===\n");

// ── SMTP ─────────────────────────────────────────────────────────────────────
console.log("SMTP");
if (!has("SMTP_HOST") || !has("SMTP_PASSWORD")) {
  report(false, "smtp configured", "SMTP_HOST or SMTP_PASSWORD empty");
} else {
  const { default: nodemailer } = await import("nodemailer");
  const port = Number(env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
  try {
    await transport.verify();
    report(true, "authenticated", `${env.SMTP_HOST}:${port} as ${String(env.SMTP_USERNAME).slice(0, 2)}***`);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    const code = e.code ?? "";
    report(false, "authenticated", `${code || e.message}`.slice(0, 120));
  }
  transport.close();
}
console.log("");

// ── Razorpay ─────────────────────────────────────────────────────────────────
console.log("Razorpay");
if (!has("RAZORPAY_KEY_ID") || !has("RAZORPAY_KEY_SECRET")) {
  report(false, "keys configured", "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET empty");
} else {
  const mode = env.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "LIVE" : "test";
  console.log(`  ....  key mode: ${mode}${mode === "LIVE" ? "  <-- real money, be careful" : ""}`);
  const auth = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: auth } });
    if (res.status === 200) {
      const body = await res.json();
      report(true, "authenticated", `${mode} mode, ${body.count ?? 0} order(s) visible`);
    } else if (res.status === 401) {
      report(false, "authenticated", "401 - key id/secret pair rejected");
    } else {
      report(false, "authenticated", `unexpected HTTP ${res.status}`);
    }
  } catch (err) {
    report(false, "authenticated", err instanceof Error ? err.message : String(err));
  }
  report(has("RAZORPAY_WEBHOOK_SECRET"), "webhook secret present");
  console.log("");

  // ── AI provider ────────────────────────────────────────────────────────────
  console.log("AI provider");
  const provider = env.ACTIVE_AI_PROVIDER ?? "(unset)";
  console.log(`  ....  ACTIVE_AI_PROVIDER = ${provider}`);
  const aiTargets = {
    openrouter: { key: env.OPENROUTER_API_KEY, url: env.OPENROUTER_ENDPOINT, model: env.OPENROUTER_MODEL },
    groq: { key: env.GROQ_API_KEY, url: env.GROQ_ENDPOINT ?? "https://api.groq.com/openai/v1/chat/completions", model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile" },
    "nvidia_kimi": { key: env.NVIDIA_KIMI_API_KEY, url: env.NVIDIA_KIMI_ENDPOINT, model: env.NVIDIA_KIMI_MODEL },
  };
  const target = aiTargets[provider];
  if (!target) {
    report(false, "AI provider resolvable", `ACTIVE_AI_PROVIDER=${provider} is not one of ${Object.keys(aiTargets).join(", ")}`);
  } else if (!target.key || !target.url) {
    report(false, "AI provider configured", `${provider}: key or endpoint empty`);
  } else {
    try {
      const res = await fetch(target.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${target.key}` },
        body: JSON.stringify({ model: target.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      });
      if (res.ok) report(true, "one-token completion accepted", `${provider} model ${target.model}`);
      else {
        const t = await res.text();
        let msg = `HTTP ${res.status}`;
        try {
          const p = JSON.parse(t);
          msg += ` - ${p?.error?.message ?? p?.message ?? msg}`.slice(0, 120);
        } catch {
          /* keep status only */
        }
        report(false, "one-token completion accepted", msg);
      }
    } catch (err) {
      report(false, "one-token completion accepted", err instanceof Error ? err.message : String(err));
    }
  }
  console.log("");
}

// ── OAuth (presence only; the flow needs a browser) ───────────────────────────
console.log("OAuth");
for (const [provider, idKey, secretKey] of [
  ["Google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["GitHub", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
]) {
  report(has(idKey) && has(secretKey), `${provider} client configured`, has(idKey) ? "" : `${idKey} empty`);
}
console.log(`  ....  redirect URIs are built from NEXT_PUBLIC_SITE_URL; register`);
console.log(`        <site>/api/auth/oauth/google/callback and /api/auth/oauth/github/callback`);
console.log(`        (or the site's /auth/<provider>/callback path - see app/api/auth/oauth/[provider]/route.ts)`);
console.log("");

// ── Database ─────────────────────────────────────────────────────────────────
console.log("Database");
try {
  const { default: postgres } = await import("postgres");
  const sql = postgres(env.DIRECT_URL ?? env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
  const rows = await sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`;
  report(rows[0].n > 0, "reachable", `${rows[0].n} public tables`);
  await sql.end({ timeout: 5 });
} catch (err) {
  report(false, "reachable", err instanceof Error ? err.message : String(err));
}
console.log("");

console.log(`=== ${failures === 0 ? "all checked integrations reachable" : `${failures} check(s) failed`} ===\n`);
process.exit(failures === 0 ? 0 : 1);
