"use client";

import { useEffect, useRef, useState } from "react";
import type { BannerRow } from "@/lib/db/admin/banners";
import { ucfirst } from "@/lib/format";

type BannerResponse = { success?: boolean; message?: string; html?: string };

type Props = {
  banners: BannerRow[];
  csrfToken: string;
  templates: Record<string, string>;
};

type FormState = {
  id: string;
  title: string;
  message: string;
  template: string;
  type: string;
  audiences: string[];
  ctaText: string;
  ctaLink: string;
  scheduleStart: string;
  scheduleEnd: string;
  resurface: string;
  priority: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: "",
  title: "",
  message: "",
  template: "simple-text",
  type: "info",
  audiences: [],
  ctaText: "",
  ctaLink: "",
  scheduleStart: "",
  scheduleEnd: "",
  resurface: "",
  priority: "0",
  active: true,
};

const AUDIENCE_VALUES = ["guest", "student", "instructor", "admin"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** PHP date('M j, Y') on the stored site-local wall clock (no timezone shift). */
function formatScheduleDate(value: string | null): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return value;
  const mon = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${mon} ${Number(m[3])}, ${m[1]}`;
}

/** PHP mb_strimwidth($s, 0, 80, '...') for the banner message column. */
function strimwidth(value: string, width = 80, marker = "..."): string {
  if (value.length <= width) return value;
  return value.slice(0, width - marker.length) + marker;
}

/**
 * Manage Banners (public/admin/banners.php). The PHP rendered everything server-side and drove the
 * modal, toast, preview and row actions with a page-level inline script posting to itself. This
 * keeps the identical markup/classes/ids and behaviour, but the five actions post to
 * /api/admin/banners (JSON), preserving the same toast text, reload delays and preview HTML.
 */
export default function BannersView({ banners, csrfToken, templates }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add New Banner");
  const [action, setAction] = useState<"create_banner" | "update_banner">("create_banner");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [audienceError, setAudienceError] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; show: boolean } | null>(null);

  const toastTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // PHP showToast(): emit, animate in after 10ms, fade out at 4s, remove at 4.3s.
  function showToast(message: string, type: "success" | "error") {
    toastTimers.current.forEach((t) => window.clearTimeout(t));
    toastTimers.current = [];
    setToast({ message, type, show: false });
    toastTimers.current.push(window.setTimeout(() => setToast((t) => (t ? { ...t, show: true } : t)), 10));
    toastTimers.current.push(window.setTimeout(() => setToast((t) => (t ? { ...t, show: false } : t)), 4010));
    toastTimers.current.push(window.setTimeout(() => setToast(null), 4310));
  }

  // PHP postForm(): 200 -> JSON; non-200 -> "Server error (status)."; failure -> "Network error.".
  async function postForm(fd: FormData, cb: (res: BannerResponse) => void) {
    let res: Response;
    try {
      res = await fetch("/api/admin/banners", {
        method: "POST",
        body: fd,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
    } catch {
      cb({ success: false, message: "Network error." });
      return;
    }
    if (res.status !== 200) {
      cb({ success: false, message: `Server error (${res.status}).` });
      return;
    }
    try {
      cb((await res.json()) as BannerResponse);
    } catch {
      cb({ success: false, message: "Invalid server response." });
    }
  }

  function openModal(title: string, nextAction: "create_banner" | "update_banner", banner: BannerRow | null) {
    setModalTitle(title);
    setAction(nextAction);
    setPreviewVisible(false);
    setAudienceError(false);

    if (banner) {
      const start = banner.schedule?.start_at ?? null;
      const end = banner.schedule?.end_at ?? null;
      setForm({
        id: banner.id,
        title: banner.title || "",
        message: banner.message || "",
        template: banner.template || "simple-text",
        type: banner.type || "info",
        audiences: banner.audience ?? [],
        ctaText: banner.cta?.text ?? "",
        ctaLink: banner.cta?.link ?? "",
        // PHP bug: substring(0,16) leaves a space (datetime-local rejects it). Fixed to "T".
        scheduleStart: start ? start.substring(0, 16).replace(" ", "T") : "",
        scheduleEnd: end ? end.substring(0, 16).replace(" ", "T") : "",
        resurface: banner.resurface_after_days != null ? String(banner.resurface_after_days) : "",
        priority: String(banner.priority ?? 0),
        active: banner.active !== false,
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function toggleAudience(value: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      audiences: checked ? [...f.audiences, value] : f.audiences.filter((a) => a !== value),
    }));
  }

  function onPreview() {
    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("action", "preview_banner");
    fd.set("title", form.title);
    fd.set("message", form.message);
    fd.set("template", form.template);
    fd.set("type", form.type);
    fd.set("cta_text", form.ctaText);
    fd.set("cta_link", form.ctaLink);
    void postForm(fd, (res) => {
      if (res.success && res.html) {
        setPreviewHtml(res.html);
        setPreviewVisible(true);
      } else {
        showToast(res.message || "Preview failed.", "error");
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.audiences.length === 0) {
      setAudienceError(true);
      return;
    }
    setAudienceError(false);

    const ctaText = form.ctaText.trim();
    const ctaLink = form.ctaLink.trim();
    if ((ctaText && !ctaLink) || (!ctaText && ctaLink)) {
      showToast("Both CTA text and link must be provided together.", "error");
      return;
    }

    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("action", action);
    fd.set("id", form.id);
    fd.set("title", form.title);
    fd.set("message", form.message);
    fd.set("template", form.template);
    fd.set("type", form.type);
    fd.set("cta_text", form.ctaText);
    fd.set("cta_link", form.ctaLink);
    fd.set("schedule_start", form.scheduleStart);
    fd.set("schedule_end", form.scheduleEnd);
    fd.set("resurface_after_days", form.resurface);
    fd.set("priority", form.priority);
    if (form.active) fd.set("active", "1");
    form.audiences.forEach((a) => fd.append("audience[]", a));

    void postForm(fd, (res) => {
      if (res.success) {
        showToast(res.message || "", "success");
        closeModal();
        window.setTimeout(() => window.location.reload(), 600);
      } else {
        showToast(res.message || "", "error");
      }
    });
  }

  function onEdit(id: string) {
    const banner = banners.find((b) => b.id === id) ?? null;
    if (banner) openModal("Edit Banner", "update_banner", banner);
  }

  function onToggle(banner: BannerRow) {
    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("action", "toggle_banner_active");
    fd.set("id", banner.id);
    fd.set("active", banner.active ? "0" : "1");
    void postForm(fd, (res) => {
      if (res.success) {
        showToast(res.message || "", "success");
        window.setTimeout(() => window.location.reload(), 400);
      } else {
        showToast(res.message || "", "error");
      }
    });
  }

  function onDelete(banner: BannerRow) {
    if (!window.confirm("Delete this banner permanently?")) return;
    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("action", "delete_banner");
    fd.set("id", banner.id);
    void postForm(fd, (res) => {
      if (res.success) {
        showToast(res.message || "", "success");
        window.setTimeout(() => window.location.reload(), 400);
      } else {
        showToast(res.message || "", "error");
      }
    });
  }

  return (
    <>
      <main className="bnr-page-wrap">
        <div className="bnr-page-inner">
          {/* PAGE HEADER */}
          <div className="bnr-page-header">
            <div className="bnr-page-header-left">
              <div className="bnr-page-icon">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="bnr-page-title">Announcement Banners</h1>
                <p className="bnr-page-subtitle">Create and manage sitewide announcement banners targeted at specific audiences</p>
              </div>
            </div>
            <button className="bnr-btn bnr-btn--primary" id="bnrAddBtn" onClick={() => openModal("Add New Banner", "create_banner", null)}>
              + Add New Banner
            </button>
          </div>

          {/* ALERT */}
          <div className="bnr-alert" id="bnrAlert" style={{ display: "none" }} />

          {/* BANNER LIST */}
          {banners.length === 0 ? (
            <div className="bnr-empty">
              <div className="bnr-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="bnr-empty-title">No banners yet</h3>
              <p className="bnr-empty-text">Create your first announcement banner to display across the site.</p>
            </div>
          ) : (
            <div className="bnr-table-wrap">
              <table className="bnr-table">
                <thead>
                  <tr>
                    <th>Banner</th>
                    <th>Type</th>
                    <th>Audience</th>
                    <th>Schedule</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {banners.map((b) => {
                    const sched = b.schedule;
                    const hasSchedule = Boolean(sched && (sched.start_at || sched.end_at));
                    return (
                      <tr data-id={b.id} key={b.id}>
                        <td className="bnr-cell-banner">
                          <div className="bnr-banner-title">{b.title ?? ""}</div>
                          <div className="bnr-banner-message">{strimwidth(b.message ?? "")}</div>
                        </td>
                        <td>
                          <span className={`bnr-type-badge bnr-type-badge--${b.type ?? "info"}`}>{ucfirst(b.type ?? "info")}</span>
                        </td>
                        <td>
                          <div className="bnr-audience-tags">
                            {(b.audience ?? []).map((a) => (
                              <span className="bnr-audience-tag" key={a}>
                                {ucfirst(a)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="bnr-cell-schedule">
                          {hasSchedule ? (
                            <>
                              {formatScheduleDate(sched?.start_at ?? null)} → {formatScheduleDate(sched?.end_at ?? null)}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="bnr-cell-priority">{Number(b.priority ?? 0)}</td>
                        <td>
                          <span className={`bnr-status-dot ${b.active ? "bnr-status-dot--active" : "bnr-status-dot--inactive"}`} />
                          {b.active ? "Active" : "Inactive"}
                        </td>
                        <td className="bnr-cell-actions">
                          <button className="bnr-btn-sm bnr-btn-sm--edit" data-action="edit" data-id={b.id} title="Edit" onClick={() => onEdit(b.id)}>
                            Edit
                          </button>
                          <button
                            className="bnr-btn-sm bnr-btn-sm--toggle"
                            data-action="toggle"
                            data-id={b.id}
                            data-active={b.active ? "1" : "0"}
                            title={b.active ? "Deactivate" : "Activate"}
                            onClick={() => onToggle(b)}
                          >
                            {b.active ? "Deactivate" : "Activate"}
                          </button>
                          <button className="bnr-btn-sm bnr-btn-sm--delete" data-action="delete" data-id={b.id} title="Delete" onClick={() => onDelete(b)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL */}
      <div className="bnr-modal-overlay" id="bnrModalOverlay" style={{ display: modalOpen ? "flex" : "none" }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="bnr-modal" role="dialog" aria-modal="true" aria-label="Banner form">
          <div className="bnr-modal-header">
            <h2 className="bnr-modal-title" id="bnrModalTitle">
              {modalTitle}
            </h2>
            <button className="bnr-modal-close" id="bnrModalClose" aria-label="Close" onClick={closeModal}>
              ×
            </button>
          </div>
          <form id="bnrForm" autoComplete="off" onSubmit={onSubmit}>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="id" id="bnrFormId" value={form.id} readOnly />
            <input type="hidden" name="action" id="bnrFormAction" value={action} readOnly />

            <div className="bnr-modal-body">
              <div className="bnr-field">
                <label className="bnr-label" htmlFor="bnrTitle">
                  Title <span className="bnr-required">*</span>
                </label>
                <input className="bnr-input" type="text" id="bnrTitle" name="title" required maxLength={255} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>

              <div className="bnr-field">
                <label className="bnr-label" htmlFor="bnrMessage">
                  Message <span className="bnr-required">*</span>
                </label>
                <textarea className="bnr-textarea" id="bnrMessage" name="message" required rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
              </div>

              <div className="bnr-row">
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrTemplate">
                    Template
                  </label>
                  <select className="bnr-select" id="bnrTemplate" name="template" value={form.template} onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}>
                    {Object.entries(templates).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrType">
                    Type
                  </label>
                  <select className="bnr-select" id="bnrType" name="type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="promo">Promo</option>
                  </select>
                </div>
              </div>

              <div className="bnr-field">
                <label className="bnr-label">
                  Audience <span className="bnr-required">*</span>
                </label>
                <div className="bnr-checkbox-group">
                  {AUDIENCE_VALUES.map((value) => (
                    <label className="bnr-checkbox-label" key={value}>
                      <input
                        className="bnr-checkbox"
                        type="checkbox"
                        name="audience[]"
                        value={value}
                        checked={form.audiences.includes(value)}
                        onChange={(e) => toggleAudience(value, e.target.checked)}
                      />{" "}
                      {ucfirst(value)}
                    </label>
                  ))}
                </div>
                <div className="bnr-field-error" id="bnrAudienceError" style={{ display: audienceError ? "block" : "none" }}>
                  Select at least one audience.
                </div>
              </div>

              <div className="bnr-field">
                <label className="bnr-label">CTA Button (optional)</label>
                <div className="bnr-row">
                  <input className="bnr-input" type="text" id="bnrCtaText" name="cta_text" placeholder="Button text" value={form.ctaText} onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))} />
                  <input className="bnr-input" type="text" id="bnrCtaLink" name="cta_link" placeholder="Button link (e.g. /browse-courses)" value={form.ctaLink} onChange={(e) => setForm((f) => ({ ...f, ctaLink: e.target.value }))} />
                </div>
              </div>

              <div className="bnr-row">
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrScheduleStart">
                    Schedule Start
                  </label>
                  <input className="bnr-input" type="datetime-local" id="bnrScheduleStart" name="schedule_start" value={form.scheduleStart} onChange={(e) => setForm((f) => ({ ...f, scheduleStart: e.target.value }))} />
                </div>
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrScheduleEnd">
                    Schedule End
                  </label>
                  <input className="bnr-input" type="datetime-local" id="bnrScheduleEnd" name="schedule_end" value={form.scheduleEnd} onChange={(e) => setForm((f) => ({ ...f, scheduleEnd: e.target.value }))} />
                </div>
              </div>

              <div className="bnr-row">
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrResurface">
                    Resurface After (days)
                  </label>
                  <input className="bnr-input" type="number" id="bnrResurface" name="resurface_after_days" min={0} placeholder="Leave blank for permanent dismiss" value={form.resurface} onChange={(e) => setForm((f) => ({ ...f, resurface: e.target.value }))} />
                </div>
                <div className="bnr-field">
                  <label className="bnr-label" htmlFor="bnrPriority">
                    Priority
                  </label>
                  <input className="bnr-input" type="number" id="bnrPriority" name="priority" value={form.priority} min={0} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
                </div>
              </div>

              <div className="bnr-field bnr-field--checkbox">
                <label className="bnr-checkbox-label">
                  <input className="bnr-checkbox" type="checkbox" id="bnrActive" name="active" value="1" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active
                </label>
              </div>

              {/* PREVIEW PANE */}
              <div className="bnr-preview-wrap" id="bnrPreviewWrap" style={{ display: previewVisible ? "block" : "none" }}>
                <div className="bnr-preview-heading">Preview</div>
                <div className="bnr-preview-body" id="bnrPreviewBody" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>

            <div className="bnr-modal-footer">
              <button type="button" className="bnr-btn bnr-btn--secondary" id="bnrPreviewBtn" onClick={onPreview}>
                Preview
              </button>
              <button type="button" className="bnr-btn bnr-btn--secondary" id="bnrModalCancel" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="bnr-btn bnr-btn--primary" id="bnrSubmitBtn">
                {action === "create_banner" ? "Create Banner" : "Update Banner"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {toast ? <div className={`bnr-toast bnr-toast--${toast.type === "error" ? "error" : "success"}${toast.show ? " bnr-toast--show" : ""}`}>{toast.message}</div> : null}
    </>
  );
}
