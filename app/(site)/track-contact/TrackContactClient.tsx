"use client";

import { useState } from "react";

type Reply = { reply_message: string; reply_type: string; resolution_status: string | null; admin_name: string | null; created_at: string };

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

const STATUS_META: Record<string, { label: string; icon: string; className: string }> = {
  open: { label: "Open", icon: "\u{1F7E1}", className: "status--open" },
  in_progress: { label: "In Progress", icon: "\u{1F7E1}", className: "status--progress" },
  resolved: { label: "Resolved", icon: "\u2705", className: "status--resolved" },
  closed: { label: "Closed", icon: "\u2716", className: "status--closed" },
  waiting: { label: "Waiting on You", icon: "\u23F3", className: "status--waiting" },
};

function phpDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

export default function TrackContactClient({
  prefillRef,
  prefillEmail,
  ticket,
  replies,
}: {
  prefillRef: string;
  prefillEmail: string;
  ticket: Record<string, unknown> | null;
  replies: Reply[];
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [found, setFound] = useState(ticket);
  const [items, setItems] = useState(replies);
  const [searched, setSearched] = useState(ticket !== null);

  const lookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ref = String(fd.get("ticket_ref") ?? "").toUpperCase().trim();
    const email = String(fd.get("email") ?? "").trim();
    if (!ref) return setErrors(["Please enter your ticket reference."]);
    if (!email) return setErrors(["Please enter a valid email address."]);
    setErrors([]);
    const res = await fetch(`/api/contact/track?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setSearched(true);
    if (data.ticket) {
      setFound(data.ticket);
      setItems(data.replies ?? []);
    } else {
      setFound(null);
      setItems([]);
      setErrors(["No ticket found with that reference and email."]);
    }
  };

  const status = found ? (STATUS_META[String(found.status)] ?? { label: String(found.status), icon: "\u25CF", className: "status--open" }) : null;

  return (
    <main className="tct-page">
      <section className="tct-hero">
        <div className="tct-hero-inner">
          <h1 className="tct-hero-title">Track Your Ticket</h1>
          <p className="tct-hero-sub">Enter your ticket reference and the email you used.</p>
        </div>
      </section>

      <div className="tct-wrap">
        <div className="tct-search-card">
          <form method="get" action="/track-contact" className="tct-search-form" onSubmit={lookup}>
            {errors.length > 0 ? <div className="tct-alert tct-alert--error" role="alert"><ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div> : null}
            <div className="tct-field">
              <label className="tct-label" htmlFor="ticket_ref">Ticket Reference</label>
              <input id="ticket_ref" name="ticket_ref" className="tct-input tct-input--mono" placeholder="CT-XXXXXXXX" defaultValue={prefillRef} required />
            </div>
            <div className="tct-field">
              <label className="tct-label" htmlFor="email">Email Address</label>
              <input id="email" name="email" type="email" className="tct-input" placeholder="The email you used when contacting us" defaultValue={prefillEmail} required />
            </div>
            <button className="tct-btn tct-btn--primary" type="submit">Look Up</button>
          </form>
        </div>

        {searched ? (
          found ? (
            <div className="tct-ticket">
              <div className="tct-ticket-head">
                <div className="tct-ticket-head-left">
                  <span className="tct-ticket-ref">{String(found.ticket_ref)}</span>
                  <span className={`tct-status ${status?.className}`}>{status?.icon} {status?.label}</span>
                </div>
                <span className="tct-ticket-date">Submitted {new Date(String(found.created_at)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>

              <div className="tct-ticket-meta">
                <div className="tct-meta-item">
                  <span className="tct-meta-label">Subject</span>
                  <span className="tct-meta-value">{String(found.subject)}</span>
                </div>
                <div className="tct-meta-item">
                  <span className="tct-meta-label">Category</span>
                  <span className="tct-meta-value">{CATEGORY_LABELS[String(found.category)] ?? String(found.category)}</span>
                </div>
                <div className="tct-meta-item">
                  <span className="tct-meta-label">Priority</span>
                  <span className={`tct-meta-value tct-priority tct-priority--${String(found.priority)}`}>
                    {String(found.priority).charAt(0).toUpperCase() + String(found.priority).slice(1)}
                  </span>
                </div>
                {String(found.updated_at) !== String(found.created_at) ? (
                  <div className="tct-meta-item">
                    <span className="tct-meta-label">Last Updated</span>
                    <span className="tct-meta-value">{phpDate(String(found.updated_at))}</span>
                  </div>
                ) : null}
              </div>

              <div className="tct-thread">
                <div className="tct-thread-item tct-thread-item--user">
                  <div className="tct-thread-avatar tct-thread-avatar--user">
                    {String(found.sender_name).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="tct-thread-bubble">
                    <div className="tct-thread-bubble-head">
                      <span className="tct-thread-author">{String(found.sender_name)}</span>
                      <span className="tct-thread-time">{phpDate(String(found.created_at))}</span>
                    </div>
                    <div className="tct-thread-body">{String(found.message)}</div>
                  </div>
                </div>

                {items.map((r, i) => (
                  <div key={i} className={`tct-thread-item tct-thread-item--${r.reply_type === "internal" ? "internal" : "admin"}`}>
                    {r.reply_type !== "internal" ? (
                      <>
                        <div className="tct-thread-avatar tct-thread-avatar--admin">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <div className="tct-thread-bubble tct-thread-bubble--admin">
                          <div className="tct-thread-bubble-head">
                            <span className="tct-thread-author">Edulari Support</span>
                            <span className="tct-thread-time">{phpDate(r.created_at)}</span>
                          </div>
                          <div className="tct-thread-body">{r.reply_message}</div>
                          {r.resolution_status ? (
                            <div className="tct-reply-resolution">
                              Status changed to: <strong>{r.resolution_status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}</strong>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {found.status === "resolved" || found.status === "closed" ? (
                <div className="tct-resolved-note">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  This ticket has been {String(found.status)}. If your issue isn&apos;t resolved, please <a href="/contact" className="tct-link">submit a new ticket</a>.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="tct-not-found">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <h2>Ticket Not Found</h2>
              <p>No ticket matched that reference and email combination. Please double-check both and try again.</p>
              <a href="/contact" className="tct-btn tct-btn--primary">Submit a New Request</a>
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}
