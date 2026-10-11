import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost, getSessionFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/client-ip";
import { sendMail } from "@/lib/email/transport";

const schema = z.object({
  reporter_name: z.string().trim().min(2),
  reporter_email: z.string().trim().email(),
  issue_type: z.string().trim().default("bug"),
  subject: z.string().trim().min(5),
  description: z.string().trim().min(20),
  steps: z.string().trim().optional().default(""),
  expected: z.string().trim().optional().default(""),
  severity: z.coerce.number().int().min(1).max(5).default(3),
  browser: z.string().trim().optional().default(""),
  page_url: z.string().trim().optional().default(""),
  consent: z.string().optional(),
  website: z.string().optional(),
});

const SEVERITY_LABEL: Record<number, string> = { 1: "Trivial", 2: "Minor", 3: "Moderate", 4: "Major", 5: "Critical" };

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ success: false, errors: ["Invalid request."] }, { status: 400 }); }

  // report-bug.php renders a csrf_token field but never verifies it (PHP bug); we check it.
  if (!verifyCsrfToken(await readCsrfToken(), String(body.csrf_token ?? ""))) {
    return NextResponse.json({ success: false, errors: ["Security token mismatch. Please refresh and try again."] }, { status: 403 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => {
      const p = i.path.join(".");
      if (p === "reporter_name") return "Please enter your full name (at least 2 characters).";
      if (p === "reporter_email") return "Please enter a valid email address.";
      if (p === "subject") return "Please provide a subject (at least 5 characters).";
      if (p === "description") return "Please describe the issue in at least 20 characters.";
      if (p === "severity") return "Severity must be between 1 and 5.";
      return i.message;
    });
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  const d = parsed.data;
  if (d.website) return NextResponse.json({ success: true, reference: "BUG-000000" });
  if (!d.consent) return NextResponse.json({ success: false, errors: ["Please confirm the consent checkbox."] }, { status: 400 });

  const user = await getSessionFromRequest();
  const ip = getClientIp(req.headers);
  const reference = `BUG-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const severityLabel = SEVERITY_LABEL[d.severity] ?? "Moderate";

  await sql`
    INSERT INTO bug_reports (reference, reporter_name, reporter_email, reporter_role, reporter_ip, issue_type, page_url, subject, description, steps, expected, severity, severity_label, browser, status)
    VALUES (${reference}, ${d.reporter_name}, ${d.reporter_email}, ${user ? user.role : "Guest"}, ${ip}, ${d.issue_type}, ${d.page_url || ""}, ${d.subject}, ${d.description}, ${d.steps || null}, ${d.expected || null}, ${d.severity}, ${severityLabel}, ${d.browser || ""}, 'open')
  `;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await sendMail({
    to: process.env.ADMIN_EMAIL ?? process.env.SMTP_FROM_EMAIL ?? "",
    subject: `[Bug] ${d.subject} — ${reference}`,
    html: `<p><strong>${reference}</strong> — ${severityLabel}</p><p>${d.description.replace(/\n/g, "<br>")}</p><p>Reporter: ${d.reporter_name} (${d.reporter_email}) — IP ${ip}</p><p><a href="${siteUrl}/admin/bug-reports">Open admin bug list</a></p>`,
  });

  await sendMail({
    to: d.reporter_email,
    toName: d.reporter_name,
    subject: `We received your report — ${reference}`,
    html: `<p>Hi ${d.reporter_name},</p><p>Thanks for reporting this. Your reference is <strong>${reference}</strong>.</p><p><a href="${siteUrl}/track-report?ref=${reference}">Track this report</a></p>`,
  });

  return NextResponse.json({ success: true, reference });
}
