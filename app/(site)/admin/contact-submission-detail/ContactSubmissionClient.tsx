"use client";

import { Fragment, useRef, useState } from "react";
import {
  CONTACT_STATUS_META_DETAIL,
  CONTACT_PRIORITY_META_DETAIL,
  categoryLabel,
  contactStatusMeta,
  contactPriorityMeta,
  ucfirst,
} from "@/lib/admin/contact-labels";

export type ContactReplyView = {
  id: number;
  replyType: string;
  adminName: string | null;
  timeText: string;
  message: string;
  resolutionStatus: string | null;
};

export type ContactSubmissionView = {
  id: number;
  ticketRef: string;
  status: string;
  priority: string;
  category: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  message: string;
  orderRef: string | null;
  courseRef: string | null;
  senderIp: string;
  userId: number | null;
  submittedText: string;
  updatedText: string;
  showUpdated: boolean;
  avatarLetter: string;
};

type Props = {
  submission: ContactSubmissionView;
  replies: ContactReplyView[];
  statusOptions: Array<{ value: string; label: string }>;
  siteName: string;
  csrfToken: string;
  flash: string;
  flashType: string;
};

/** PHP nl2br(htmlspecialchars(...)) — newlines become <br/> between text runs. */
function Nl2br({ text }: { text: string }) {
  const lines = text.split(/\r\n|\r|\n/);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}

export default function ContactSubmissionClient({
  submission,
  replies,
  statusOptions,
  siteName,
  csrfToken,
  flash,
  flashType,
}: Props) {
  const [replyMessage, setReplyMessage] = useState("");
  const [replyType, setReplyType] = useState<"public" | "internal">("public");
  const [replyStatus, setReplyStatus] = useState(submission.status);

  const sidebarFormRef = useRef<HTMLFormElement>(null);
  const sidebarSelectRef = useRef<HTMLSelectElement>(null);

  const sm = contactStatusMeta(CONTACT_STATUS_META_DETAIL, submission.status, "acsd-status--open");
  const pm = contactPriorityMeta(CONTACT_PRIORITY_META_DETAIL, submission.priority, "acsd-pri--normal");
  const cat = categoryLabel(submission.category);
  const isInternal = replyType === "internal";
  const charLen = replyMessage.length;

  return (
    <div className="acsd-page">
      <div className="acsd-breadcrumb">
        <a href="/admin/contact-submissions" className="acsd-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back to Submissions
        </a>
      </div>

      {flash ? <div className={`acsd-flash acsd-flash--${flashType}`}>{flash}</div> : null}

      <div className="acsd-layout">
        <div className="acsd-main">
          <div className="acsd-ticket-head">
            <div className="acsd-ticket-head-left">
              <code className="acsd-ref">{submission.ticketRef}</code>
              <span className={`acsd-status ${sm.class}`}>{sm.label}</span>
              <span className={`acsd-pri ${pm.class}`}>{pm.label}</span>
            </div>
            <span className="acsd-ticket-date">Submitted {submission.submittedText}</span>
          </div>

          <h1 className="acsd-subject">{submission.subject}</h1>

          <div className="acsd-thread">
            <div className="acsd-msg acsd-msg--user">
              <div className="acsd-msg-avatar acsd-msg-avatar--user">{submission.avatarLetter}</div>
              <div className="acsd-msg-body">
                <div className="acsd-msg-head">
                  <strong>{submission.senderName}</strong>
                  <span className="acsd-msg-role">{submission.senderRole || "Guest"}</span>
                  <span className="acsd-msg-time">{submission.submittedText}</span>
                </div>
                <div className="acsd-msg-text"><Nl2br text={submission.message} /></div>
                {submission.orderRef ? (
                  <div className="acsd-msg-meta">Order Ref: <code>{submission.orderRef}</code></div>
                ) : null}
                {submission.courseRef ? (
                  <div className="acsd-msg-meta">Course: <code>{submission.courseRef}</code></div>
                ) : null}
              </div>
            </div>

            {replies.map((reply) => {
              const internal = reply.replyType === "internal";
              return (
                <div key={reply.id} className={`acsd-msg acsd-msg--${internal ? "internal" : "admin"}`}>
                  {internal ? (
                    <div className="acsd-msg-avatar acsd-msg-avatar--internal">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                  ) : (
                    <div className="acsd-msg-avatar acsd-msg-avatar--admin">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                  )}
                  <div className="acsd-msg-body">
                    <div className="acsd-msg-head">
                      <strong>{internal ? "🔒 Internal Note" : `${siteName} Support`}</strong>
                      <span className="acsd-msg-role">{reply.adminName ?? "Admin"}</span>
                      <span className="acsd-msg-time">{reply.timeText}</span>
                    </div>
                    <div className="acsd-msg-text"><Nl2br text={reply.message} /></div>
                    {reply.resolutionStatus ? (
                      <div className="acsd-status-change">
                        Status → <strong>{ucfirst(reply.resolutionStatus.replace(/_/g, " "))}</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {submission.status !== "closed" ? (
            <div className="acsd-reply-box">
              <h3 className="acsd-reply-title">Reply to User</h3>
              <form method="POST" id="replyForm">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="action" value="reply" />

                <div className="acsd-reply-type">
                  <label className="acsd-reply-type-opt">
                    <input
                      type="radio"
                      name="reply_type"
                      value="public"
                      checked={replyType === "public"}
                      onChange={() => setReplyType("public")}
                    />
                    <span className="acsd-reply-type-label acsd-reply-type-label--public">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      Send to User
                    </span>
                  </label>
                  <label className="acsd-reply-type-opt">
                    <input
                      type="radio"
                      name="reply_type"
                      value="internal"
                      checked={replyType === "internal"}
                      onChange={() => setReplyType("internal")}
                    />
                    <span className="acsd-reply-type-label acsd-reply-type-label--internal">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      Internal Note
                    </span>
                  </label>
                </div>

                <textarea
                  name="reply_message"
                  id="replyMessage"
                  className="acsd-reply-textarea"
                  rows={6}
                  placeholder="Write your reply or internal note here…"
                  required
                  maxLength={10000}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <div className="acsd-reply-char">
                  <span id="replyCharCount" style={charLen > 9000 ? { color: "#dc2626" } : undefined}>{charLen.toLocaleString()}</span> / 10,000
                </div>

                <div className="acsd-reply-footer">
                  <div className="acsd-reply-status-wrap">
                    <label className="acsd-label" htmlFor="new_status">Update Status</label>
                    <select
                      name="new_status"
                      id="new_status"
                      className="acsd-select"
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                    >
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="addash-btn addash-btn--primary" id="replySubmitBtn">
                    {isInternal ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        Save Note
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="acsd-closed-note">
              This ticket is closed.{" "}
              <a
                href={`?id=${submission.id}`}
                className="acsd-link js-reopen-ticket"
                onClick={(e) => {
                  e.preventDefault();
                  if (sidebarSelectRef.current) sidebarSelectRef.current.value = "open";
                  sidebarFormRef.current?.submit();
                }}
              >
                Reopen it
              </a>{" "}
              to add a reply.
            </div>
          )}
        </div>

        <aside className="acsd-sidebar">
          <div className="acsd-sidebar-card">
            <h3 className="acsd-sidebar-card-title">Quick Status Change</h3>
            <form method="POST" ref={sidebarFormRef}>
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="action" value="change_status" />
              <select name="new_status" ref={sidebarSelectRef} className="acsd-select acsd-select--full" defaultValue={submission.status}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button type="submit" className="addash-btn addash-btn--secondary acsd-btn-full mt-2">Update Status</button>
            </form>
          </div>

          <div className="acsd-sidebar-card">
            <h3 className="acsd-sidebar-card-title">Ticket Details</h3>
            <dl className="acsd-dl">
              <dt>Reference</dt>
              <dd><code className="acsd-ref-sm">{submission.ticketRef}</code></dd>
              <dt>Category</dt>
              <dd>{cat}</dd>
              <dt>Priority</dt>
              <dd><span className={`acsd-pri ${pm.class}`}>{pm.label}</span></dd>
              <dt>Status</dt>
              <dd><span className={`acsd-status ${sm.class}`}>{sm.label}</span></dd>
              <dt>Submitted</dt>
              <dd>{submission.submittedText}</dd>
              {submission.showUpdated ? (
                <>
                  <dt>Last Updated</dt>
                  <dd>{submission.updatedText}</dd>
                </>
              ) : null}
              <dt>Replies</dt>
              <dd>{replies.length}</dd>
            </dl>
          </div>

          <div className="acsd-sidebar-card">
            <h3 className="acsd-sidebar-card-title">Sender Info</h3>
            <dl className="acsd-dl">
              <dt>Name</dt>
              <dd>{submission.senderName}</dd>
              <dt>Email</dt>
              <dd><a href={`mailto:${submission.senderEmail}`} className="acsd-link">{submission.senderEmail}</a></dd>
              <dt>Role</dt>
              <dd>{submission.senderRole || "Guest"}</dd>
              {submission.senderIp ? (
                <>
                  <dt>IP</dt>
                  <dd><code>{submission.senderIp}</code></dd>
                </>
              ) : null}
              {submission.userId ? (
                <>
                  <dt>User Account</dt>
                  <dd><a href={`/admin/user-detail?id=${submission.userId}`} className="acsd-link">View Profile →</a></dd>
                </>
              ) : null}
            </dl>
          </div>

          {submission.orderRef || submission.courseRef ? (
            <div className="acsd-sidebar-card">
              <h3 className="acsd-sidebar-card-title">References</h3>
              <dl className="acsd-dl">
                {submission.orderRef ? (
                  <>
                    <dt>Order Ref</dt>
                    <dd><code>{submission.orderRef}</code></dd>
                  </>
                ) : null}
                {submission.courseRef ? (
                  <>
                    <dt>Course</dt>
                    <dd>{submission.courseRef}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div className="acsd-sidebar-card acsd-sidebar-card--danger">
            <h3 className="acsd-sidebar-card-title acsd-sidebar-card-title--danger">Danger Zone</h3>
            <form
              method="POST"
              className="js-delete-ticket"
              onSubmit={(e) => {
                if (!window.confirm("Permanently delete this ticket and all replies? This cannot be undone.")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="action" value="delete" />
              <button type="submit" className="addash-btn addash-btn--danger acsd-btn-full">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                Delete Ticket
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
