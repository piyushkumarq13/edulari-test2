"use client";

import { useState } from "react";
import { NOTIF_TYPES, AUDIENCE_OPTIONS } from "@/lib/admin/notification-options";

type Props = {
  csrfToken: string;
  successMsg: string;
  errorMsg: string;
};

/**
 * Send Notifications (public/admin/send-notifications.php). The form is a classic POST + PRG to
 * /api/admin/notifications (the handler 303s back with ?msg/?error), so refresh never resubmits.
 * The page-level inline script (email-field toggle, character counters, live preview) is ported
 * here with identical behaviour; the inline <style> block lives in the server page.
 */
export default function SendNotificationsView({ csrfToken, successMsg, errorMsg }: Props) {
  const [type, setType] = useState("");
  const [audience, setAudience] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewBody, setPreviewBody] = useState("");

  const emailVisible = audience === "specific";

  function onPreview() {
    if (!title.trim() && !body.trim()) {
      setPreviewVisible(false);
      return;
    }
    setPreviewTitle(title.trim() || "(no title)");
    setPreviewBody(body.trim() || "(no message)");
    setPreviewVisible(true);
    requestAnimationFrame(() => {
      document.getElementById("snPreview")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (previewVisible) setPreviewTitle(value.trim() || "(no title)");
  }

  function onBodyChange(value: string) {
    setBody(value);
    if (previewVisible) setPreviewBody(value.trim() || "(no message)");
  }

  return (
    <main className="sn-wrap">
      <h1 className="sn-title">Send Notification</h1>
      <p className="sn-subtitle">Compose and broadcast a notification to users on the platform.</p>

      {successMsg ? (
        <div className="sn-alert sn-alert--success" role="alert">
          {successMsg}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="sn-alert sn-alert--error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <div className="sn-card">
        <form method="POST" action="/api/admin/notifications" id="snForm" autoComplete="off">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          {/* ── Notification Type ── */}
          <div className="sn-field">
            <span className="sn-label">Notification Type</span>
            <div className="sn-type-grid">
              {Object.entries(NOTIF_TYPES).map(([slug, label]) => (
                <label className="sn-type-opt" key={slug}>
                  <input type="radio" name="type" value={slug} checked={type === slug} required onChange={(e) => setType(e.target.value)} />
                  <span className="sn-type-label">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="sn-divider" />

          {/* ── Audience ── */}
          <div className="sn-field">
            <label htmlFor="snAudience" className="sn-label">
              Send To
            </label>
            <select name="audience" id="snAudience" className="sn-select" required value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="">— Select audience —</option>
              {Object.entries(AUDIENCE_OPTIONS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* ── Specific email (shown only when audience = specific) ── */}
          <div className={`sn-field sn-email-field${emailVisible ? " visible" : ""}`} id="snEmailField">
            <label htmlFor="snEmail" className="sn-label">
              User Email
            </label>
            <input type="email" name="email" id="snEmail" className="sn-input" placeholder="user@example.com" value={email} required={emailVisible} onChange={(e) => setEmail(e.target.value)} />
            <p className="sn-hint">The notification will be sent only to this user.</p>
          </div>

          <hr className="sn-divider" />

          {/* ── Title ── */}
          <div className="sn-field">
            <label htmlFor="snTitle" className="sn-label">
              Title <span style={{ color: "#e53e3e" }}>*</span>
            </label>
            <input type="text" name="title" id="snTitle" className="sn-input" maxLength={255} required placeholder="e.g. New Course: Introduction to Python" value={title} onChange={(e) => onTitleChange(e.target.value)} />
            <div className="sn-char-count">
              <span id="snTitleCount">{title.length}</span> / 255
            </div>
          </div>

          {/* ── Body ── */}
          <div className="sn-field">
            <label htmlFor="snBody" className="sn-label">
              Message <span style={{ color: "#e53e3e" }}>*</span>
            </label>
            <textarea name="body" id="snBody" className="sn-textarea" required placeholder="Write the full notification message here…" value={body} onChange={(e) => onBodyChange(e.target.value)} />
            <div className="sn-char-count">
              <span id="snBodyCount">{body.length}</span> characters
            </div>
          </div>

          {/* ── Live Preview ── */}
          <div className={`sn-preview${previewVisible ? " visible" : ""}`} id="snPreview">
            <div className="sn-preview-label">Preview</div>
            <div className="sn-preview-title" id="snPreviewTitle">
              {previewTitle}
            </div>
            <div className="sn-preview-body" id="snPreviewBody">
              {previewBody}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="sn-footer">
            <button type="button" className="sn-btn-preview" id="snPreviewBtn" onClick={onPreview}>
              Preview
            </button>
            <button type="submit" className="sn-btn-submit">
              Send Notification
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
