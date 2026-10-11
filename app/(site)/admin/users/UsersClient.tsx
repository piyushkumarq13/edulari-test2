"use client";

import { useEffect, useRef, useState } from "react";

export type UserRowView = {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  initials: string;
  roleColor: string;
  isSelf: boolean;
  isActive: boolean;
  isBlocked: boolean;
  activityKind: "instructor" | "student";
  activityLabel: string;
  joined: string;
};

export type PageToken =
  | { kind: "prev"; href: string }
  | { kind: "next"; href: string }
  | { kind: "ellipsis" }
  | { kind: "page"; label: string; href: string; active: boolean };

type Props = {
  rows: UserRowView[];
  totalAll: string;
  totalFiltered: string;
  stats: { students: string; instructors: string; admins: string; active: string; inactive: string };
  page: number;
  totalPages: number;
  rangeFrom: string;
  rangeTo: string;
  pageTokens: PageToken[];
  roleFilter: string;
  searchFilter: string;
  statusFilter: string;
  initialMessage: string;
  csrfToken: string;
};

type ApiResult = { ok: boolean; error?: string; message?: string; redirect?: string };

const ROLE_HINTS: Record<string, { hint: string; info: string }> = {
  student: {
    hint: "Students can enroll in courses.",
    info: "Students can browse, enroll in, and complete courses. They receive certificates upon completion.",
  },
  instructor: {
    hint: "Instructors can create courses.",
    info: "Instructors can create and publish courses, view analytics, and earn from student enrollments.",
  },
  admin: {
    hint: "Admins have full platform access.",
    info: "Admins have complete control over the platform: users, courses, categories, and settings. Use with caution.",
  },
};

const PW_PCT = [0, 20, 40, 60, 80, 100];
const PW_LABELS = ["", "Very Weak", "Weak", "Fair", "Good", "Strong"];
const PW_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

function pwStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
}

function CheckIcon({ color = "currentColor", width = 18, height = 18 }: { color?: string; width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={width} height={height} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="22 4 12 14.01 9 11.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function UsersClient(props: Props) {
  const { rows, csrfToken } = props;

  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(props.initialMessage);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [pw, setPw] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [roleHint, setRoleHint] = useState(ROLE_HINTS.student.hint);
  const [roleInfo, setRoleInfo] = useState(ROLE_HINTS.student.info);
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const selectableIds = rows.filter((r) => !r.isSelf).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  // Auto-dismiss the alert after 8s, mirroring users.php.
  useEffect(() => {
    const alert = alertRef.current;
    if (!alert) return;
    const timer = setTimeout(() => {
      alert.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      alert.style.opacity = "0";
      alert.style.transform = "translateY(-8px)";
      setTimeout(() => alert.parentElement?.removeChild(alert), 500);
    }, 8000);
    return () => clearTimeout(timer);
  }, [message, error]);

  // Lock body scroll while the add-user modal is open.
  useEffect(() => {
    document.body.style.overflow = addOpen ? "hidden" : "";
    if (addOpen) nameRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
    };
  }, [addOpen]);

  // Close dropdowns on outside click / Escape.
  useEffect(() => {
    function onDocClick() {
      setOpenDropdown(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setAddOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function runUserAction(id: number, body: Record<string, string>): void {
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    Object.entries(body).forEach(([k, v]) => fd.append(k, v));
    setError("");
    fetch(`/api/admin/users/${id}`, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: fd,
    })
      .then((r) => r.json() as Promise<ApiResult>)
      .then((data) => {
        if (data.ok) {
          window.location.href = data.redirect ?? "/admin/users";
        } else {
          setError(data.error ?? "Action failed.");
        }
      })
      .catch(() => setError("Network error. Please try again."));
  }

  function onToggleStatus(row: UserRowView) {
    const verb = row.isActive ? "Deactivate" : "Activate";
    if (window.confirm(`${verb} this user?`)) runUserAction(row.id, { action: "toggle_status" });
  }

  function onBlock(row: UserRowView) {
    const reason = window.prompt("Reason for blocking (optional):");
    if (reason === null) return;
    if (window.confirm("Block this user?")) runUserAction(row.id, { action: "block_user", block_note: reason });
  }

  function onUnblock(row: UserRowView) {
    if (window.confirm("Unblock this user?")) runUserAction(row.id, { action: "unblock_user" });
  }

  function onChangeRole(row: UserRowView, newRole: string) {
    if (window.confirm(`Change this user's role to ${newRole.charAt(0).toUpperCase()}${newRole.slice(1)}?`)) {
      runUserAction(row.id, { action: "change_role", new_role: newRole });
    }
  }

  function onReset(row: UserRowView) {
    if (window.confirm("Send a password reset link to this user's email?")) {
      runUserAction(row.id, { action: "reset_password" });
    }
  }

  function onDelete(row: UserRowView) {
    if (window.confirm("Delete this user permanently? This cannot be undone.")) {
      runUserAction(row.id, { action: "delete_user" });
    }
  }

  function onSelectAll(checked: boolean) {
    setSelected(checked ? selectableIds : []);
  }

  function onToggleRow(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  function onBulkApply() {
    if (!bulkAction || selected.length === 0) return;
    const msg =
      bulkAction === "delete"
        ? `⚠️ Permanently delete ${selected.length} user(s)? This cannot be undone!`
        : `Apply "${bulkAction}" to ${selected.length} user(s)?`;
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.append("action", "bulk_action");
    fd.append("csrf_token", csrfToken);
    fd.append("bulk_action", bulkAction);
    selected.forEach((id) => fd.append("bulk_ids", String(id)));
    setError("");
    fetch("/api/admin/users", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" }, body: fd })
      .then((r) => r.json() as Promise<ApiResult>)
      .then((data) => {
        if (data.ok) window.location.href = data.redirect ?? "/admin/users";
        else setError(data.error ?? "Action failed.");
      })
      .catch(() => setError("Network error. Please try again."));
  }

  function onAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("action", "add_user");
    fd.set("csrf_token", csrfToken);
    if (!fd.has("new_is_active")) fd.delete("new_is_active");
    setError("");
    setSubmitting(true);
    fetch("/api/admin/users", { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" }, body: fd })
      .then((r) => r.json() as Promise<ApiResult>)
      .then((data) => {
        if (data.ok) window.location.href = data.redirect ?? "/admin/users";
        else setError(data.error ?? "Failed to create user. Please try again.");
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setSubmitting(false));
  }

  const strength = pw ? pwStrength(pw) : 0;

  return (
    <>
      <main className="usr-page-wrap">
        <div className="usr-page-inner">
          <div className="usr-page-header">
            <div className="usr-page-title-group">
              <div className="usr-page-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="usr-page-title">Manage Users</h1>
                <p className="usr-page-subtitle">
                  {props.totalAll} total users &mdash; {props.totalFiltered} shown
                </p>
              </div>
            </div>
            <button className="usr-btn usr-btn--primary" id="usrAddUserBtn" aria-haspopup="dialog" onClick={() => setAddOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add User
            </button>
          </div>

          {message ? (
            <div className="usr-alert usr-alert--success" role="alert" id="usrAlert" ref={alertRef}>
              <CheckIcon />
              <span>{message}</span>
              <button className="usr-alert-close" aria-label="Dismiss" onClick={() => setMessage("")}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="usr-alert usr-alert--error" role="alert" id="usrAlert" ref={alertRef}>
              <ErrorIcon />
              <span>{error}</span>
              <button className="usr-alert-close" aria-label="Dismiss" onClick={() => setError("")}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : null}

          <div className="usr-stats-grid">
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--total">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.totalAll}</span>
                <span className="usr-stat-label">Total Users</span>
              </div>
            </div>
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--student">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.stats.students}</span>
                <span className="usr-stat-label">Students</span>
              </div>
            </div>
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--instructor">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.stats.instructors}</span>
                <span className="usr-stat-label">Instructors</span>
              </div>
            </div>
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--admin">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.stats.admins}</span>
                <span className="usr-stat-label">Admins</span>
              </div>
            </div>
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--active">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.stats.active}</span>
                <span className="usr-stat-label">Active</span>
              </div>
            </div>
            <div className="usr-stat-card">
              <div className="usr-stat-icon usr-stat-icon--inactive">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="usr-stat-info">
                <span className="usr-stat-value">{props.stats.inactive}</span>
                <span className="usr-stat-label">Inactive/Blocked</span>
              </div>
            </div>
          </div>

          <div className="usr-filter-card">
            <form method="get" action="/admin/users" className="usr-filter-form" id="usrFilterForm">
              <div className="usr-filter-group">
                <label className="usr-filter-label" htmlFor="usrSearch">Search</label>
                <div className="usr-input-icon-wrap">
                  <svg className="usr-input-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    id="usrSearch"
                    name="search"
                    className="usr-input"
                    placeholder="Name or email…"
                    defaultValue={props.searchFilter}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="usr-filter-group">
                <label className="usr-filter-label" htmlFor="usrRole">Role</label>
                <select id="usrRole" name="role" className="usr-select" defaultValue={props.roleFilter}>
                  <option value="">All Roles</option>
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="usr-filter-group">
                <label className="usr-filter-label" htmlFor="usrStatus">Status</label>
                <select id="usrStatus" name="status" className="usr-select" defaultValue={props.statusFilter}>
                  <option value="">All Status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              <div className="usr-filter-actions">
                <button type="submit" className="usr-btn usr-btn--primary">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Filter
                </button>
                <a href="/admin/users" className="usr-btn usr-btn--ghost">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Clear
                </a>
              </div>
            </form>
          </div>

          <form id="usrBulkForm" onSubmit={(e) => e.preventDefault()}>
            <div className={"usr-bulk-bar" + (selected.length > 0 ? " usr-bulk-bar--active" : "")} id="usrBulkBar" aria-live="polite">
              <span className="usr-bulk-count" id="usrBulkCount">{selected.length} selected</span>
              <select name="bulk_action" className="usr-select usr-select--sm" id="usrBulkAction" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                <option value="">Bulk Action…</option>
                <option value="activate">Activate</option>
                <option value="deactivate">Deactivate</option>
                <option value="block">Block</option>
                <option value="delete">Delete</option>
              </select>
              <button type="button" className="usr-btn usr-btn--sm usr-btn--danger" id="usrBulkApply" disabled={selected.length === 0 || !bulkAction} onClick={onBulkApply}>
                Apply
              </button>
              <button
                type="button"
                className="usr-btn usr-btn--sm usr-btn--ghost"
                id="usrBulkClear"
                onClick={() => {
                  setSelected([]);
                  setBulkAction("");
                }}
              >
                Clear Selection
              </button>
            </div>

            <div className="usr-table-card">
              <div className="usr-table-wrap">
                <table className="usr-table" id="usrTable">
                  <thead>
                    <tr>
                      <th className="usr-th usr-th--check">
                        <label className="usr-checkbox-wrap" aria-label="Select all users">
                          <input type="checkbox" id="usrSelectAll" className="usr-checkbox" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} />
                          <span className="usr-checkbox-custom" aria-hidden="true" />
                        </label>
                      </th>
                      <th className="usr-th">User</th>
                      <th className="usr-th usr-th--hide-sm">Role</th>
                      <th className="usr-th usr-th--hide-sm">Status</th>
                      <th className="usr-th usr-th--hide-md">Activity</th>
                      <th className="usr-th usr-th--hide-md">Joined</th>
                      <th className="usr-th usr-th--actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="usr-empty">
                          <div className="usr-empty-inner">
                            <svg viewBox="0 0 24 24" fill="none" width="40" height="40" aria-hidden="true">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            <p>No users found matching your filters.</p>
                            <a href="/admin/users" className="usr-btn usr-btn--ghost usr-btn--sm">Clear filters</a>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      rows.map((u) => {
                        const statusClass = u.isBlocked ? "blocked" : u.isActive ? "active" : "inactive";
                        const statusLabel = u.isBlocked ? "Blocked" : u.isActive ? "Active" : "Inactive";
                        return (
                          <tr key={u.id} className={"usr-tr" + (u.isSelf ? " usr-tr--self" : "")} data-uid={u.id}>
                            <td className="usr-td usr-td--check">
                              <label className="usr-checkbox-wrap" aria-label={`Select ${u.name}`}>
                                <input
                                  type="checkbox"
                                  name="bulk_ids"
                                  value={u.id}
                                  className="usr-checkbox usr-row-check"
                                  disabled={u.isSelf}
                                  title={u.isSelf ? "Cannot select your own account" : undefined}
                                  checked={selected.includes(u.id)}
                                  onChange={(e) => onToggleRow(u.id, e.target.checked)}
                                />
                                <span className="usr-checkbox-custom" aria-hidden="true" />
                              </label>
                            </td>

                            <td className="usr-td usr-td--user">
                              <div className="usr-user-cell">
                                <div className={`usr-avatar usr-avatar--${u.roleColor}`} aria-hidden="true">
                                  {u.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={u.avatarUrl} alt={u.name} />
                                  ) : (
                                    u.initials
                                  )}
                                </div>
                                <div className="usr-user-info">
                                  <span className="usr-user-name">
                                    {u.name}
                                    {u.isSelf ? <span className="usr-badge usr-badge--you">You</span> : null}
                                  </span>
                                  <span className="usr-user-email">{u.email}</span>
                                  <div className="usr-mobile-meta">
                                    <span className={`usr-badge usr-badge--${u.role}`}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
                                    <span className={`usr-badge usr-badge--${statusClass}`}>{statusLabel}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="usr-td usr-th--hide-sm">
                              <span className={`usr-badge usr-badge--${u.role}`}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</span>
                            </td>

                            <td className="usr-td usr-th--hide-sm">
                              <span className={`usr-badge usr-badge--${statusClass}`}>
                                <span className="usr-badge-dot" /> {statusLabel}
                              </span>
                            </td>

                            <td className="usr-td usr-th--hide-md">
                              <span className="usr-activity">
                                {u.activityKind === "instructor" ? (
                                  <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                )}
                                {u.activityLabel}
                              </span>
                            </td>

                            <td className="usr-td usr-th--hide-md">
                              <span className="usr-date">{u.joined}</span>
                            </td>

                            <td className="usr-td usr-td--actions">
                              <div className="usr-action-group">
                                <a href={`/admin/user-detail?id=${u.id}`} className="usr-action-btn usr-action-btn--view" title="View user details">
                                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                                  </svg>
                                  <span>View</span>
                                </a>

                                <div className="usr-dropdown-wrap" data-dropdown="true">
                                  <button
                                    type="button"
                                    className="usr-action-btn usr-action-btn--more"
                                    title="More actions"
                                    aria-haspopup="true"
                                    aria-expanded={openDropdown === u.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdown((cur) => (cur === u.id ? null : u.id));
                                    }}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                                      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                                      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                                      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                                    </svg>
                                    <span className="sr-only">More</span>
                                  </button>

                                  <div className={"usr-dropdown" + (openDropdown === u.id ? " usr-dropdown--open" : "")} role="menu" onClick={(e) => e.stopPropagation()}>
                                    <div className="usr-dropdown-section usr-dropdown-section--label">Change Role</div>
                                    {["student", "instructor", "admin"]
                                      .filter((r) => r !== u.role)
                                      .map((r) => (
                                        <div className="usr-dd-form" key={r}>
                                          <button type="button" className="usr-dropdown-item js-confirm-btn" onClick={() => onChangeRole(u, r)}>
                                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" />
                                            </svg>
                                            Make {r.charAt(0).toUpperCase() + r.slice(1)}
                                          </button>
                                        </div>
                                      ))}

                                    <div className="usr-dropdown-divider" role="separator" />

                                    {u.role === "instructor" && u.isActive && !u.isBlocked ? (
                                      <div className="usr-dd-form js-block-form">
                                        <button type="button" className="usr-dropdown-item usr-dropdown-item--warn" onClick={() => onBlock(u)}>
                                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                          Block User
                                        </button>
                                      </div>
                                    ) : u.isBlocked ? (
                                      <div className="usr-dd-form">
                                        <button type="button" className="usr-dropdown-item usr-dropdown-item--success js-confirm-btn" onClick={() => onUnblock(u)}>
                                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                          Unblock User
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="usr-dd-form">
                                        <button type="button" className={`usr-dropdown-item ${u.isActive ? "usr-dropdown-item--warn" : "usr-dropdown-item--success"} js-confirm-btn`} onClick={() => onToggleStatus(u)}>
                                          {u.isActive ? (
                                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                          ) : (
                                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                          )}
                                          {u.isActive ? "Deactivate" : "Activate"}
                                        </button>
                                      </div>
                                    )}

                                    <div className="usr-dd-form">
                                      <button type="button" className="usr-dropdown-item js-confirm-btn" onClick={() => onReset(u)}>
                                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M17 1l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M7 23l-4-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                                        Reset Password
                                      </button>
                                    </div>

                                    {!u.isSelf ? (
                                      <>
                                        <div className="usr-dropdown-divider" role="separator" />
                                        <div className="usr-dd-form">
                                          <button type="button" className="usr-dropdown-item usr-dropdown-item--danger js-confirm-btn" onClick={() => onDelete(u)}>
                                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            Delete User
                                          </button>
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {props.totalPages > 1 ? (
                <div className="usr-pagination">
                  <span className="usr-pagination-info">
                    Showing {props.rangeFrom}–{props.rangeTo} of {props.totalFiltered} users
                  </span>
                  <div className="usr-pagination-links" role="navigation" aria-label="Pagination">
                    {props.pageTokens.map((t, i) => {
                      if (t.kind === "ellipsis") return <span className="usr-page-ellipsis" key={`e${i}`}>…</span>;
                      if (t.kind === "prev") {
                        return (
                          <a href={t.href} className="usr-page-btn" aria-label="Previous page" key="prev">
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </a>
                        );
                      }
                      if (t.kind === "next") {
                        return (
                          <a href={t.href} className="usr-page-btn" aria-label="Next page" key="next">
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </a>
                        );
                      }
                      return (
                        <a
                          href={t.href}
                          key={`p${t.label}`}
                          className={"usr-page-btn" + (t.active ? " usr-page-btn--active" : "")}
                          aria-current={t.active ? "page" : undefined}
                        >
                          {t.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </main>

      <div className={"usr-modal-overlay" + (addOpen ? " usr-modal-overlay--open" : "")} id="usrAddUserModal" role="dialog" aria-modal="true" aria-labelledby="usrModalTitle" aria-hidden={!addOpen}>
        <div className="usr-modal">
          <div className="usr-modal-header">
            <div className="usr-modal-title-group">
              <div className="usr-modal-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="16" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="usr-modal-title" id="usrModalTitle">Add New User</h2>
            </div>
            <button className="usr-modal-close" id="usrModalClose" aria-label="Close modal" onClick={() => setAddOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form method="post" className="usr-modal-form" id="usrAddUserForm" onSubmit={onAddUser} noValidate>
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div className="usr-modal-body">
              <div className="usr-form-row">
                <div className="usr-form-group">
                  <label className="usr-form-label" htmlFor="newName">Full Name <span className="usr-required">*</span></label>
                  <input ref={nameRef} type="text" id="newName" name="new_name" className="usr-input" placeholder="John Doe" required maxLength={100} autoComplete="name" />
                  <span className="usr-form-hint">Display name shown on the platform.</span>
                </div>
                <div className="usr-form-group">
                  <label className="usr-form-label" htmlFor="newEmail">Email Address <span className="usr-required">*</span></label>
                  <input type="email" id="newEmail" name="new_email" className="usr-input" placeholder="user@example.com" required maxLength={150} autoComplete="email" />
                  <span className="usr-form-hint">Must be unique. Used for login.</span>
                </div>
              </div>

              <div className="usr-form-row">
                <div className="usr-form-group">
                  <label className="usr-form-label" htmlFor="newPassword">Password <span className="usr-required">*</span></label>
                  <div className="usr-input-pw-wrap">
                    <input
                      type={pwVisible ? "text" : "password"}
                      id="newPassword"
                      name="new_password"
                      className="usr-input"
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                    <button type="button" className="usr-pw-toggle" aria-label="Toggle password visibility" data-target="newPassword" onClick={() => setPwVisible((v) => !v)}>
                      <svg className="usr-eye-open" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: pwVisible ? "none" : undefined }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                      <svg className="usr-eye-shut" viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ display: pwVisible ? undefined : "none" }}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                  <div className="usr-pw-strength" id="usrPwStrength" aria-live="polite">
                    <div className="usr-pw-bar"><span id="usrPwBarFill" style={{ width: pw ? `${PW_PCT[strength]}%` : "0", background: pw ? PW_COLORS[strength] : undefined }} /></div>
                    <span id="usrPwLabel" style={{ color: pw ? PW_COLORS[strength] : undefined }}>{pw ? PW_LABELS[strength] : ""}</span>
                  </div>
                </div>
                <div className="usr-form-group">
                  <label className="usr-form-label" htmlFor="newUserRole">Assign Role <span className="usr-required">*</span></label>
                  <select
                    id="newUserRole"
                    name="new_user_role"
                    className="usr-select"
                    required
                    defaultValue="student"
                    onChange={(e) => {
                      const data = ROLE_HINTS[e.target.value] ?? { hint: "", info: "" };
                      setRoleHint(data.hint);
                      setRoleInfo(data.info);
                    }}
                  >
                    <option value="student">🎓 Student</option>
                    <option value="instructor">📋 Instructor</option>
                    <option value="admin">🛡️ Admin</option>
                  </select>
                  <span className="usr-form-hint" id="usrRoleHint">{roleHint}</span>
                </div>
              </div>

              <div className="usr-form-group">
                <label className="usr-toggle-label">
                  <span>Set account as active immediately</span>
                  <div className="usr-toggle-switch">
                    <input type="checkbox" name="new_is_active" id="newIsActive" defaultChecked />
                    <span className="usr-toggle-track" aria-hidden="true" />
                  </div>
                </label>
              </div>

              <div className="usr-role-info" id="usrRoleInfo">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <span id="usrRoleInfoText">{roleInfo}</span>
              </div>
            </div>

            <div className="usr-modal-footer">
              <button type="button" className="usr-btn usr-btn--ghost" id="usrModalCancel" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" name="add_user" className="usr-btn usr-btn--primary" id="usrAddUserSubmit">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Create User
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
