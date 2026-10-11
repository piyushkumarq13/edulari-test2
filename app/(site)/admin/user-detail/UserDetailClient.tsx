"use client";

import { useEffect, useRef, useState } from "react";

export type CourseRow = {
  id: number;
  title: string;
  level: string;
  studentCount: string;
  hasRating: boolean;
  rating: string;
  pricePaid: boolean;
  priceText: string;
  isPublished: boolean;
  created: string;
};

export type EnrollmentRow = {
  id: number;
  courseTitle: string;
  instructorName: string;
  progress: number;
  enrolled: string;
};

export type ActivityItem = {
  kind: "created" | "login" | "course" | "enrollment" | "blocked";
  title: string;
  date: string;
};

export type ProfileData = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  roleBadgeClass: string;
  statusLabel: string;
  statusClass: string;
  isStudent: boolean;
  isInstructor: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  isActive: boolean;
  initials: string;
  avatarUrl: string | null;
  joinedShort: string;
  lastLoginShort: string | null;
  registrationAt: string;
  lastLoginAt: string | null;
  blockNote: string;
  blockReason: string;
  emailVerified: boolean;
  showQuickActions: boolean;
  courses: CourseRow[];
  enrollments: EnrollmentRow[];
  completedCount: number;
  avgProgress: number;
  instructorStats: { totalStudents: string; totalRevenue: string; totalCourses: string; totalEnrollments: string };
  activity: ActivityItem[];
};

type ApiResult = { ok: boolean; message?: string; error?: string; redirect?: string };

const DOT_COLORS: Record<ActivityItem["kind"], string> = {
  created: "ud-timeline-dot--green",
  login: "ud-timeline-dot--blue",
  course: "ud-timeline-dot--orange",
  enrollment: "ud-timeline-dot--purple",
  blocked: "ud-timeline-dot--red",
};

export default function UserDetailClient({ data, csrfToken }: { data: ProfileData; csrfToken: string }) {
  const [activeTab, setActiveTab] = useState("tabOverview");
  const [modal, setModal] = useState<null | "modalBlock" | "modalRole" | "modalConfirm">(null);
  const [blockNote, setBlockNote] = useState("");
  const [role, setRole] = useState(data.role);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [pending, setPending] = useState<{ params: Record<string, string>; redirectOnSuccess: boolean } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error"; show: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.style.overflow = modal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modal) setModal(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => (t ? { ...t, show: false } : t)), 4500);
  }

  function doAction(params: Record<string, string>, redirectOnSuccess = false) {
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    Object.entries(params).forEach(([k, v]) => fd.append(k, v));
    fetch(`/api/admin/users/${data.id}`, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: fd,
    })
      .then((r) => r.json() as Promise<ApiResult>)
      .then((res) => {
        if (res.ok) {
          showToast(res.message ?? "", "success");
          if (redirectOnSuccess && res.redirect) {
            setTimeout(() => {
              window.location.href = res.redirect as string;
            }, 1200);
          } else {
            setTimeout(() => window.location.reload(), 1200);
          }
        } else {
          showToast(res.message ?? res.error ?? "Action failed.", "error");
        }
      })
      .catch(() => showToast("Network error. Please try again.", "error"));
  }

  function askConfirm(message: string, params: Record<string, string>, redirectOnSuccess = false) {
    setConfirmMsg(message);
    setPending({ params, redirectOnSuccess });
    setModal("modalConfirm");
  }

  return (
    <>
      <div className={"ud-toast" + (toast ? ` ud-toast--${toast.type}` + (toast.show ? " ud-toast--show" : "") : "")} id="udToast" role="alert" aria-live="polite">
        <span className="ud-toast__icon" id="udToastIcon">
          {toast?.type === "success" ? (
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : toast ? (
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : null}
        </span>
        <span className="ud-toast__msg" id="udToastMsg">{toast?.msg ?? ""}</span>
        <button className="ud-toast__close" id="udToastClose" aria-label="Close notification" onClick={() => setToast((t) => (t ? { ...t, show: false } : t))}>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <main className="ud-page-wrap">
        <div className="ud-page-inner">
          <div className="ud-top-bar">
            <nav className="ud-breadcrumb" aria-label="Breadcrumb">
              <a href="/admin/dashboard" className="ud-breadcrumb__link">Dashboard</a>
              <span className="ud-breadcrumb__sep" aria-hidden="true">›</span>
              <a href="/admin/users" className="ud-breadcrumb__link">Users</a>
              <span className="ud-breadcrumb__sep" aria-hidden="true">›</span>
              <span className="ud-breadcrumb__current">{data.name}</span>
            </nav>

            <div className="ud-top-actions">
              <a href="/admin/users" className="ud-btn ud-btn--ghost">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Back to Users
              </a>
            </div>
          </div>

          <div className="ud-page-header">
            <div className="ud-page-title-group">
              <div className="ud-page-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
              </div>
              <div>
                <h1 className="ud-page-title">User Detail</h1>
                <p className="ud-page-subtitle">Viewing full profile for <strong>{data.name}</strong></p>
              </div>
            </div>
          </div>

          <div className="ud-grid">
            <aside className="ud-sidebar">
              <div className="ud-card ud-profile-card">
                <div className="ud-profile-card__cover" aria-hidden="true" />

                <div className="ud-profile-card__body">
                  <div className="ud-avatar ud-avatar--lg" aria-hidden="true">
                    {data.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.avatarUrl} alt={data.name} />
                    ) : (
                      <span>{data.initials}</span>
                    )}
                  </div>

                  <h2 className="ud-profile-name">{data.name}</h2>
                  <p className="ud-profile-email">{data.email}</p>

                  <div className="ud-profile-badges">
                    <span className={`ud-badge ${data.roleBadgeClass}`}>{data.roleLabel}</span>
                    <span className={`ud-status-pill ${data.statusClass}`}>
                      <span className="ud-status-dot" />
                      {data.statusLabel}
                    </span>
                  </div>

                  {data.isBlocked && data.blockNote ? (
                    <div className="ud-block-reason">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" /></svg>
                      <span>Block note: {data.blockNote}</span>
                    </div>
                  ) : null}
                </div>

                <div className="ud-profile-info">
                  <div className="ud-info-row">
                    <span className="ud-info-label">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" /><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" /><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" /></svg>
                      Joined
                    </span>
                    <span className="ud-info-value">{data.joinedShort}</span>
                  </div>
                  <div className="ud-info-row">
                    <span className="ud-info-label">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      Last Login
                    </span>
                    <span className="ud-info-value">{data.lastLoginShort ? data.lastLoginShort : <em>Never</em>}</span>
                  </div>
                  <div className="ud-info-row">
                    <span className="ud-info-label">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.61 3.39 2 2 0 013.6 1.22h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.96a16 16 0 006.13 6.13l.95-.95a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" /></svg>
                      User ID
                    </span>
                    <span className="ud-info-value">#{data.id}</span>
                  </div>
                </div>
              </div>

              {data.showQuickActions ? (
                <div className="ud-card ud-actions-card">
                  <h3 className="ud-card__title">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" /></svg>
                    Quick Actions
                  </h3>

                  <div className="ud-actions-list">
                    {!data.isBlocked ? (
                      <button
                        className={`ud-action-btn ${data.isActive ? "ud-action-btn--warning" : "ud-action-btn--success"}`}
                        data-action="toggle_status"
                        data-user-id={data.id}
                        data-csrf={csrfToken}
                        onClick={() => doAction({ action: "toggle_status" })}
                      >
                        {data.isActive ? (
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                        {data.isActive ? "Deactivate User" : "Activate User"}
                      </button>
                    ) : null}

                    {!data.isAdmin ? (
                      data.isBlocked ? (
                        <button
                          className="ud-action-btn ud-action-btn--success"
                          data-action="unblock_user"
                          data-user-id={data.id}
                          data-csrf={csrfToken}
                          onClick={() => doAction({ action: "unblock_user" })}
                        >
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                          Unblock User
                        </button>
                      ) : (
                        <button className="ud-action-btn ud-action-btn--danger-outline" id="btnBlockUser" data-user-id={data.id} onClick={() => setModal("modalBlock")}>
                          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" /></svg>
                          Block User
                        </button>
                      )
                    ) : null}

                    <button className="ud-action-btn ud-action-btn--info" id="btnChangeRole" data-user-id={data.id} data-current-role={data.role} onClick={() => setModal("modalRole")}>
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      Change Role
                    </button>

                    <button
                      className="ud-action-btn ud-action-btn--info"
                      data-action="reset_password"
                      data-user-id={data.id}
                      data-csrf={csrfToken}
                      data-confirm={`Send a password reset link to ${data.name}'s email?`}
                      onClick={() => askConfirm(`Send a password reset link to ${data.name}'s email?`, { action: "reset_password" })}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      Reset Password
                    </button>

                    <button
                      className="ud-action-btn ud-action-btn--danger"
                      data-action="delete_user"
                      data-user-id={data.id}
                      data-csrf={csrfToken}
                      data-confirm={`Permanently delete ${data.name}? This cannot be undone.`}
                      onClick={() => askConfirm(`Permanently delete ${data.name}? This cannot be undone.`, { action: "delete_user" }, true)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      Delete User
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>

            <div className="ud-main">
              <div className="ud-tabs" role="tablist" aria-label="User detail sections">
                <button className={"ud-tab" + (activeTab === "tabOverview" ? " ud-tab--active" : "")} role="tab" aria-selected={activeTab === "tabOverview"} aria-controls="tabOverview" id="tabBtnOverview" onClick={() => setActiveTab("tabOverview")}>
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /></svg>
                  Overview
                </button>

                {data.isInstructor ? (
                  <button className={"ud-tab" + (activeTab === "tabCourses" ? " ud-tab--active" : "")} role="tab" aria-selected={activeTab === "tabCourses"} aria-controls="tabCourses" id="tabBtnCourses" onClick={() => setActiveTab("tabCourses")}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                    Courses
                    {data.courses.length > 0 ? <span className="ud-tab-badge">{data.courses.length}</span> : null}
                  </button>
                ) : null}

                {data.isStudent ? (
                  <button className={"ud-tab" + (activeTab === "tabEnrollments" ? " ud-tab--active" : "")} role="tab" aria-selected={activeTab === "tabEnrollments"} aria-controls="tabEnrollments" id="tabBtnEnrollments" onClick={() => setActiveTab("tabEnrollments")}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                    Enrollments
                    {data.enrollments.length > 0 ? <span className="ud-tab-badge">{data.enrollments.length}</span> : null}
                  </button>
                ) : null}

                <button className={"ud-tab" + (activeTab === "tabActivity" ? " ud-tab--active" : "")} role="tab" aria-selected={activeTab === "tabActivity"} aria-controls="tabActivity" id="tabBtnActivity" onClick={() => setActiveTab("tabActivity")}>
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Activity
                </button>
              </div>

              <div className={"ud-tab-panel" + (activeTab === "tabOverview" ? "" : " ud-tab-panel--hidden")} id="tabOverview" role="tabpanel" aria-labelledby="tabBtnOverview">
                {data.isInstructor ? (
                  <div className="ud-stats-grid">
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--blue">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.instructorStats.totalStudents}</div>
                        <div className="ud-stat-label">Total Students</div>
                      </div>
                    </div>
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--green">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.instructorStats.totalRevenue}</div>
                        <div className="ud-stat-label">Total Revenue</div>
                      </div>
                    </div>
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--orange">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.instructorStats.totalCourses}</div>
                        <div className="ud-stat-label">Total Courses</div>
                      </div>
                    </div>
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--red">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.instructorStats.totalEnrollments}</div>
                        <div className="ud-stat-label">Total Enrollments</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {data.isStudent && data.enrollments.length > 0 ? (
                  <div className="ud-stats-grid">
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--blue">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.enrollments.length}</div>
                        <div className="ud-stat-label">Courses Enrolled</div>
                      </div>
                    </div>
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--green">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.completedCount}</div>
                        <div className="ud-stat-label">Completed</div>
                      </div>
                    </div>
                    <div className="ud-stat-card">
                      <div className="ud-stat-icon ud-stat-icon--orange">
                        <svg viewBox="0 0 24 24" fill="none" width="20" height="20"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div>
                        <div className="ud-stat-value">{data.avgProgress}%</div>
                        <div className="ud-stat-label">Avg Progress</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="ud-card">
                  <h3 className="ud-card__title">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
                    Profile Information
                  </h3>
                  <div className="ud-detail-grid">
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Full Name</span>
                      <span className="ud-detail-value">{data.name}</span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Email Address</span>
                      <span className="ud-detail-value">{data.email}</span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Role</span>
                      <span className="ud-detail-value">
                        <span className={`ud-badge ${data.roleBadgeClass}`}>{data.roleLabel}</span>
                      </span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Account Status</span>
                      <span className="ud-detail-value">
                        <span className={`ud-status-pill ${data.statusClass}`}>
                          <span className="ud-status-dot" />
                          {data.statusLabel}
                        </span>
                      </span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Registration Date</span>
                      <span className="ud-detail-value">{data.registrationAt}</span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Last Login</span>
                      <span className="ud-detail-value">
                        {data.lastLoginAt ? data.lastLoginAt : <em style={{ color: "#94a3b8" }}>Never logged in</em>}
                      </span>
                    </div>
                    <div className="ud-detail-field">
                      <span className="ud-detail-label">Email Verified</span>
                      <span className="ud-detail-value">
                        {data.emailVerified ? (
                          <span className="ud-inline-badge ud-inline-badge--success">✓ Verified</span>
                        ) : (
                          <span className="ud-inline-badge ud-inline-badge--warn">Unverified</span>
                        )}
                      </span>
                    </div>
                    {data.blockReason ? (
                      <div className="ud-detail-field">
                        <span className="ud-detail-label">Block Reason</span>
                        <span className="ud-detail-value" style={{ color: "#dc2626" }}>{data.blockReason}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {data.isInstructor ? (
                <div className={"ud-tab-panel" + (activeTab === "tabCourses" ? "" : " ud-tab-panel--hidden")} id="tabCourses" role="tabpanel" aria-labelledby="tabBtnCourses">
                  <div className="ud-card">
                    <h3 className="ud-card__title">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      Instructor Courses
                      <span className="ud-count-chip">{data.courses.length}</span>
                    </h3>

                    {data.courses.length > 0 ? (
                      <div className="ud-table-wrap">
                        <table className="ud-table">
                          <thead>
                            <tr>
                              <th>Course Title</th>
                              <th>Students</th>
                              <th>Avg Rating</th>
                              <th>Price</th>
                              <th>Status</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.courses.map((course) => (
                              <tr key={course.id}>
                                <td>
                                  <div className="ud-course-cell">
                                    <span className="ud-course-title">{course.title}</span>
                                    {course.level ? <span className="ud-level-chip">{course.level}</span> : null}
                                  </div>
                                </td>
                                <td>
                                  <span className="ud-num-badge">{course.studentCount}</span>
                                </td>
                                <td>
                                  {course.hasRating ? (
                                    <span className="ud-rating">
                                      <svg viewBox="0 0 24 24" fill="#f59e0b" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                      {course.rating}
                                    </span>
                                  ) : (
                                    <span className="ud-na">N/A</span>
                                  )}
                                </td>
                                <td>
                                  <span className={course.pricePaid ? "price price--paid" : "price price--free"}>{course.priceText}</span>
                                </td>
                                <td>
                                  <span className={`ud-status-chip ${course.isPublished ? "ud-status-chip--published" : "ud-status-chip--draft"}`}>
                                    {course.isPublished ? "Published" : "Draft"}
                                  </span>
                                </td>
                                <td>{course.created}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="ud-empty-state">
                        <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        <p>No courses created yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {data.isStudent ? (
                <div className={"ud-tab-panel" + (activeTab === "tabEnrollments" ? "" : " ud-tab-panel--hidden")} id="tabEnrollments" role="tabpanel" aria-labelledby="tabBtnEnrollments">
                  <div className="ud-card">
                    <h3 className="ud-card__title">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                      Enrolled Courses
                      <span className="ud-count-chip">{data.enrollments.length}</span>
                    </h3>

                    {data.enrollments.length > 0 ? (
                      <div className="ud-table-wrap">
                        <table className="ud-table">
                          <thead>
                            <tr>
                              <th>Course</th>
                              <th>Instructor</th>
                              <th>Progress</th>
                              <th>Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.enrollments.map((enr) => (
                              <tr key={enr.id}>
                                <td>
                                  <span className="ud-course-title">{enr.courseTitle}</span>
                                </td>
                                <td>{enr.instructorName}</td>
                                <td>
                                  <div className="ud-progress-cell">
                                    <div className="ud-progress-bar">
                                      <div className="ud-progress-fill" style={{ width: `${enr.progress}%` }} />
                                    </div>
                                    <span className="ud-progress-label">{enr.progress}%</span>
                                  </div>
                                </td>
                                <td>{enr.enrolled}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="ud-empty-state">
                        <svg viewBox="0 0 24 24" fill="none" width="40" height="40"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                        <p>No course enrollments yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className={"ud-tab-panel" + (activeTab === "tabActivity" ? "" : " ud-tab-panel--hidden")} id="tabActivity" role="tabpanel" aria-labelledby="tabBtnActivity">
                <div className="ud-card">
                  <h3 className="ud-card__title">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Activity Summary
                  </h3>
                  <div className="ud-activity-timeline">
                    {data.activity.map((item) => (
                      <div className="ud-timeline-item" key={`${item.kind}-${item.title}`}>
                        <div className={`ud-timeline-dot ${DOT_COLORS[item.kind]}`} />
                        <div className="ud-timeline-content">
                          <span className="ud-timeline-title">{item.title}</span>
                          {item.date ? <span className="ud-timeline-date">{item.date}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className={"ud-modal-backdrop" + (modal === "modalBlock" ? " ud-modal-backdrop--open" : "")} id="modalBlock" aria-hidden={modal !== "modalBlock"} role="dialog" aria-modal="true" aria-labelledby="modalBlockTitle" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="ud-modal">
          <div className="ud-modal__header">
            <h3 className="ud-modal__title" id="modalBlockTitle">Block User</h3>
            <button className="ud-modal__close" data-close-modal="modalBlock" aria-label="Close" onClick={() => setModal(null)}>
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="ud-modal__body">
            <p className="ud-modal__desc">Blocking this user will prevent them from logging in. You can unblock at any time.</p>
            <label className="ud-form-label" htmlFor="blockNoteInput">Block Reason <span className="ud-optional">(optional)</span></label>
            <textarea id="blockNoteInput" className="ud-textarea" rows={3} placeholder="e.g. Violated community guidelines…" value={blockNote} onChange={(e) => setBlockNote(e.target.value)} />
          </div>
          <div className="ud-modal__footer">
            <button className="ud-btn ud-btn--ghost" data-close-modal="modalBlock" onClick={() => setModal(null)}>Cancel</button>
            <button
              className="ud-btn ud-btn--danger"
              id="confirmBlockBtn"
              data-action="block_user"
              data-user-id={data.id}
              data-csrf={csrfToken}
              onClick={() => {
                const note = blockNote.trim();
                setModal(null);
                doAction({ action: "block_user", block_note: note });
              }}
            >
              Block User
            </button>
          </div>
        </div>
      </div>

      <div className={"ud-modal-backdrop" + (modal === "modalRole" ? " ud-modal-backdrop--open" : "")} id="modalRole" aria-hidden={modal !== "modalRole"} role="dialog" aria-modal="true" aria-labelledby="modalRoleTitle" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="ud-modal">
          <div className="ud-modal__header">
            <h3 className="ud-modal__title" id="modalRoleTitle">Change Role</h3>
            <button className="ud-modal__close" data-close-modal="modalRole" aria-label="Close" onClick={() => setModal(null)}>
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="ud-modal__body">
            <p className="ud-modal__desc">Select the new role for <strong>{data.name}</strong>.</p>
            <label className="ud-form-label" htmlFor="roleSelect">New Role</label>
            <select id="roleSelect" className="ud-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="ud-modal__footer">
            <button className="ud-btn ud-btn--ghost" data-close-modal="modalRole" onClick={() => setModal(null)}>Cancel</button>
            <button
              className="ud-btn ud-btn--primary"
              id="confirmRoleBtn"
              data-action="change_role"
              data-user-id={data.id}
              data-csrf={csrfToken}
              onClick={() => {
                setModal(null);
                doAction({ action: "change_role", new_role: role });
              }}
            >
              Update Role
            </button>
          </div>
        </div>
      </div>

      <div className={"ud-modal-backdrop" + (modal === "modalConfirm" ? " ud-modal-backdrop--open" : "")} id="modalConfirm" aria-hidden={modal !== "modalConfirm"} role="dialog" aria-modal="true" aria-labelledby="modalConfirmTitle" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="ud-modal">
          <div className="ud-modal__header">
            <h3 className="ud-modal__title" id="modalConfirmTitle">Confirm Action</h3>
            <button className="ud-modal__close" data-close-modal="modalConfirm" aria-label="Close" onClick={() => setModal(null)}>
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="ud-modal__body">
            <p id="modalConfirmMsg" className="ud-modal__desc">{confirmMsg}</p>
          </div>
          <div className="ud-modal__footer">
            <button className="ud-btn ud-btn--ghost" data-close-modal="modalConfirm" onClick={() => setModal(null)}>Cancel</button>
            <button
              className="ud-btn ud-btn--danger"
              id="confirmActionBtn"
              onClick={() => {
                const p = pending;
                setModal(null);
                if (p) doAction(p.params, p.redirectOnSuccess);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
