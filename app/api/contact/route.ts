import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { isSameOriginPost, getSessionFromRequest } from "@/lib/security/api";
import { readCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { getClientIp } from "@/lib/security/client-ip";
import { sendMail } from "@/lib/email/transport";

const ALLOWED_CATEGORIES = ["general", "billing", "technical", "course_content", "account", "instructor", "partnership", "feedback", "other"] as const;
const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const schema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  category: z.enum(ALLOWED_CATEGORIES),
  priority: z.enum(ALLOWED_PRIORITIES).default("normal"),
  subject: z.string().trim().min(5),
  message: z.string().trim().min(20).max(5000),
  order_ref: z.string().trim().optional().default(""),
  course_ref: z.string().trim().optional().default(""),
  consent: z.string().optional(),
  website: z.string().optional(),
});

export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return NextResponse.json({ success: false, errors: ["Invalid origin."] }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, errors: ["Invalid request."] }, { status: 400 });
  }

  if (!verifyCsrfToken(await readCsrfToken(), String(body.csrf_token ?? ""))) {
    return NextResponse.json({ success: false, errors: ["Security token mismatch. Please refresh and try again."] }, { status: 403 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => {
      const p = i.path.join(".");
      if (p === "name") return "Please enter your full name (at least 2 characters).";
      if (p === "email") return "Please enter a valid email address.";
      if (p === "category") return "Please select a valid contact category.";
      if (p === "subject") return "Please provide a subject (at least 5 characters).";
      if (p === "message") return "Please write your message (at least 20 characters).";
      return i.message;
    });
    return NextResponse.json({ success: false, errors }, { status: 400 });
  }

  const d = parsed.data;
  if (d.website) {
    // Honeypot: silent success
    return NextResponse.json({ success: true, ticket_ref: "CT-00000000", name: d.name, email: d.email });
  }
  if (!d.consent) {
    return NextResponse.json({ success: false, errors: ["Please confirm you agree to our privacy policy."] }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const rate = await sql<{ cnt: string }[]>`SELECT COUNT(*)::text AS cnt FROM contact_submissions WHERE sender_ip = ${ip} AND created_at > ${hourAgo}`;
  if (Number(rate[0].cnt) >= 5) {
    return NextResponse.json({ success: false, errors: ["Too many messages sent. Please try again later."] }, { status: 429 });
  }

  const user = await getSessionFromRequest();
  const ticketRef = `CT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  await sql`
    INSERT INTO contact_submissions (ticket_ref, user_id, sender_name, sender_email, sender_role, category, priority, subject, message, order_ref, course_ref, sender_ip, status)
    VALUES (${ticketRef}, ${user?.id ?? null}, ${d.name}, ${d.email}, ${user ? user.role : "Guest"}, ${d.category}, ${d.priority}, ${d.subject}, ${d.message}, ${d.order_ref || null}, ${d.course_ref || null}, ${ip}, 'open')
  `;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await sendMail({
    to: process.env.ADMIN_EMAIL ?? process.env.SMTP_FROM_EMAIL ?? "",
    subject: `[Contact] ${d.subject} — ${ticketRef}`,
    html: `<p><strong>${d.name}</strong> (${d.email}) — ${ticketRef}</p><p>${d.message.replace(/\n/g, "<br>")}</p><p>Category: ${d.category} | Priority: ${d.priority} | IP: ${ip}</p><p><a href="${siteUrl}/admin/contact-submissions">Open admin inbox</a></p>`,
  });

  return NextResponse.json({ success: true, ticket_ref: ticketRef, name: d.name, email: d.email });
}
