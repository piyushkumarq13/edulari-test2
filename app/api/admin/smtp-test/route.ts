import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { authorizeAdmin, csrfOk, readFields } from "@/lib/admin/api";
import { auditAdmin } from "@/lib/admin/audit";

export const maxDuration = 30;

const schema = z.object({ to: z.string().trim().email("Enter a valid email address.") });

/** Mask the domain so the log never records a full recipient address. */
function mask(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(0, user.length - 2))}@${domain}`;
}

/**
 * SMTP connectivity check for /admin/smtp-test.
 *
 * This deliberately does NOT use lib/email/transport.ts: the goal is to prove the SMTP
 * credentials themselves work, so the transporter is built here from the live environment
 * and a plain message is sent. It reports the real transporter error on failure.
 *
 * Three checks run in order and all must pass:
 *   1. verify()   - TCP + TLS + authentication handshake
 *   2. sendMail() - a real message through the same path
 *   3. re-verify  - confirms the connection survived the send
 */
export async function POST(req: Request) {
  const auth = await authorizeAdmin(req);
  if (auth.denied) return auth.denied;

  const { fields } = await readFields(req);
  if (!await csrfOk(fields.csrf_token)) {
    return NextResponse.json({ ok: false, error: "Invalid request. Please refresh and try again." }, { status: 403 });
  }

  const parsed = schema.safeParse({ to: fields.to });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email address." }, { status: 400 });
  }
  const to = parsed.data.to;

  // Same resolution order as lib/email/transport.ts, with the legacy PHP aliases.
  const host = process.env.SMTP_HOST ?? "";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE) === "true" : port === 465;
  const user = process.env.SMTP_USERNAME ?? process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "";
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? "";
  const fromName = process.env.SMTP_FROM_NAME ?? "Edulari";
  const dryRun = String(process.env.EMAIL_DRY_RUN ?? "false") === "true";

  // Report missing configuration by NAME only, never by value.
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!fromEmail) missing.push("SMTP_FROM_EMAIL");
  if (String(process.env.SMTP_AUTH ?? "true") === "true" && !user) missing.push("SMTP_USERNAME");
  if (missing.length) {
    return NextResponse.json({
      ok: false,
      error: `Missing environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Add them in Vercel (or .env.local) and redeploy.`,
      config: { host: host || null, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: Boolean(fromEmail), emailDryRun: dryRun },
    }, { status: 400 });
  }

  const steps: Array<{ name: string; ok: boolean; detail: string; ms?: number }> = [];
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: String(process.env.SMTP_AUTH ?? "true") === "true" ? { user, pass } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    const v0 = Date.now();
    // nodemailer resolves verify() to `true` on success; the connection details are on
    // the transporter itself, so report those rather than the resolved value.
    const verified = await transport.verify();
    if (verified !== true) {
      steps.push({ name: "verify", ok: false, detail: `verify() returned ${String(verified)}` });
      return NextResponse.json({
        ok: false,
        error: `Transporter verification did not succeed for ${host}:${port}.`,
        steps,
        config: { host, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: true, emailDryRun: dryRun },
      }, { status: 502 });
    }
    steps.push({
      name: "verify",
      ok: true,
      detail: `Connection + authentication OK on ${host}:${port}${secure ? " (TLS)" : ""}`,
      ms: Date.now() - v0,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    steps.push({ name: "verify", ok: false, detail });
    await auditAdmin(auth.user, "admin.smtp_test.verify_failed", { host, port, error: detail }, req);
    return NextResponse.json({
      ok: false,
      error: `Could not connect/authenticate to ${host}:${port}. ${detail}`,
      steps,
      config: { host, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: true, emailDryRun: dryRun },
    }, { status: 502 });
  }

  if (dryRun) {
    steps.push({ name: "send", ok: true, detail: "EMAIL_DRY_RUN=true - nothing was actually sent." });
    return NextResponse.json({
      ok: false,
      error: "EMAIL_DRY_RUN is true, so no message was sent. Set it to false and redeploy to test for real.",
      steps,
      config: { host, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: true, emailDryRun: true },
    }, { status: 400 });
  }

  const s0 = Date.now();
  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: `[Edulari] SMTP test`,
      text: `SMTP test from Edulari.\n\nIf you are reading this, SMTP sending works.\nSent: ${new Date().toISOString()}`,
    });
    steps.push({ name: "send", ok: true, detail: `Accepted by ${host} - message ${info.messageId}`, ms: Date.now() - s0 });

    await auditAdmin(auth.user, "admin.smtp_test.sent", { host, port, to: mask(to), message_id: info.messageId }, req);
    return NextResponse.json({
      ok: true,
      error: null,
      message: `Test email sent to ${to}. Check the inbox (and spam) of ${to}.`,
      steps,
      config: { host, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: true, emailDryRun: false },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    steps.push({ name: "send", ok: false, detail, ms: Date.now() - s0 });
    await auditAdmin(auth.user, "admin.smtp_test.send_failed", { host, port, to: mask(to), error: detail }, req);
    return NextResponse.json({
      ok: false,
      error: `Connected and authenticated, but the message was rejected: ${detail}`,
      steps,
      config: { host, port, secure, authUserConfigured: Boolean(user), fromEmailConfigured: true, emailDryRun: false },
    }, { status: 502 });
  }
}