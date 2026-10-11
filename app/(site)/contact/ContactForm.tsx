"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General Inquiry",
  billing: "Billing & Payments",
  technical: "Technical Issue",
  course_content: "Course Content",
  account: "Account & Profile",
  instructor: "Instructor Support",
  partnership: "Partnership / Business",
  feedback: "Feedback & Suggestions",
  other: "Other",
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low — Not urgent" },
  { value: "normal", label: "Normal — Within 24h" },
  { value: "high", label: "High — Needs attention" },
  { value: "urgent", label: "Urgent — Critical issue" },
];

const ORDER_CATEGORIES = ["billing"];
const COURSE_CATEGORIES = ["course_content", "technical"];
const WARN_AT = 4500;
const LIMIT_AT = 5000;

export default function ContactForm({ prefill, csrfToken }: { prefill: { name: string; email: string }; csrfToken: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const showOrder = ORDER_CATEGORIES.includes(category);
  const showCourse = COURSE_CATEGORIES.includes(category);
  const showAny = showOrder || showCourse;
  const len = message.length;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (honeypot) return; // bot
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(fd.entries())),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(`/contact?success=1&ref=${encodeURIComponent(data.ticket_ref)}&name=${encodeURIComponent(data.name)}&email=${encodeURIComponent(data.email)}`);
      return;
    }
    setErrors(data.errors ?? ["Something went wrong. Please try again."]);
    setSubmitting(false);
  };

  return (
    <form method="POST" action="/contact" className="ct-form" id="contactForm" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {errors.length > 0 ? (
        <div className="ct-alert ct-alert--error" role="alert">
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      ) : null}

      <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

      <div className="ct-form-row">
        <div className="ct-field">
          <label className="ct-label" htmlFor="name">Full Name <span className="ct-required">*</span></label>
          <input type="text" id="name" name="name" className="ct-input" placeholder="Your full name" defaultValue={prefill.name} required maxLength={100} autoComplete="name" />
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="email">Email Address <span className="ct-required">*</span></label>
          <input type="email" id="email" name="email" className="ct-input" placeholder="your@email.com" defaultValue={prefill.email} required maxLength={200} autoComplete="email" />
        </div>
      </div>

      <div className="ct-form-row">
        <div className="ct-field">
          <label className="ct-label" htmlFor="category">Category <span className="ct-required">*</span></label>
          <select id="category" name="category" className="ct-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">— Select a category —</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="ct-field">
          <label className="ct-label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="ct-select" defaultValue="normal">
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor="subject">Subject <span className="ct-required">*</span></label>
        <input type="text" id="subject" name="subject" className="ct-input" placeholder="Brief summary of your inquiry" required maxLength={200} />
      </div>

      <div className="ct-context-fields" id="contextFields" style={{ display: showAny ? "block" : "none" }}>
        <div className="ct-field" id="orderRefField" style={{ display: showOrder ? "block" : "none" }}>
          <label className="ct-label" htmlFor="order_ref">Order / Transaction Reference</label>
          <input type="text" id="order_ref" name="order_ref" className="ct-input" placeholder="e.g. ORD-XXXXXX" maxLength={100} />
          <span className="ct-field-hint">Helps us locate your transaction faster.</span>
        </div>
        <div className="ct-field" id="courseRefField" style={{ display: showCourse ? "block" : "none" }}>
          <label className="ct-label" htmlFor="course_ref">Course Name / ID</label>
          <input type="text" id="course_ref" name="course_ref" className="ct-input" placeholder="e.g. course name or URL slug" maxLength={200} />
        </div>
      </div>

      <div className="ct-field">
        <label className="ct-label" htmlFor="message">
          Message <span className="ct-required">*</span>
          <span className={`ct-char-count ${len > WARN_AT ? "ct-char-count--warn" : ""} ${len >= LIMIT_AT ? "ct-char-count--limit" : ""}`} id="charCount">
            {len.toLocaleString()} / 5,000
          </span>
        </label>
        <textarea
          id="message"
          name="message"
          className="ct-textarea"
          placeholder="Describe your question or issue in detail…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={5000}
          rows={6}
        />
      </div>

      <div className="ct-field ct-field--checkbox">
        <label className="ct-checkbox-label">
          <input type="checkbox" name="consent" className="ct-checkbox" />
          <span className="ct-checkbox-custom" />
          <span className="ct-checkbox-text">
            I agree to Edulari&apos;s <a href="/privacy-policy" target="_blank" rel="noreferrer" className="ct-link">Privacy Policy</a> and consent to my data being used to respond to this inquiry.
          </span>
        </label>
      </div>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--full" id="submitBtn" disabled={submitting}>
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
