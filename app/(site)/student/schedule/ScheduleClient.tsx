"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/css/student/schedule.css";

export type PlanChip = {
  planId: number;
  courseId: number;
  lessonId: number | null;
  plannedDate: string;
  plannedTime: string;
  durationMin: number;
  note: string;
  isDone: boolean;
  courseTitle: string;
  lessonTitle: string;
  chipTitle: string;
  timeLabel: string;
  rowTimeLabel: string;
  rowMeridiem: string;
  rowTitle: string;
};

export type ScheduleData = {
  todayStr: string;
  weekOffset: number;
  weekLabel: string;
  csrfToken: string;
  days: { dateStr: string; name: string; num: string; dow: number; plans: PlanChip[] }[];
  todayPlans: PlanChip[];
  stats: { plannedThisWeek: number; doneThisWeek: number; pendingTasks: number; streak: number };
  pendingTasks: { id: number; title: string; type: "quiz" | "assignment"; courseTitle: string; courseId: number }[];
  heatmap: {
    leadingBlanks: number;
    cells: { dateStr: string; level: number; title: string }[];
  };
  heroCalendar: {
    monthLabel: string;
    leadingBlanks: number;
    daysInMonth: number;
    todayNum: number;
    plannedDays: Set<string>;
    monthPrefix: string;
  };
  myCourses: { courseId: number; title: string; thumbnail: string | null; progressPercentage: number }[];
};

type ToastState = { message: string; type: "" | "success" | "error" } | null;

/** Port of public/student/schedule.php (lines 211-899). */
export default function ScheduleClient(d: ScheduleData) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [plannedDate, setPlannedDate] = useState(d.todayStr);
  const [plannedTime, setPlannedTime] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [note, setNote] = useState("");
  const [modalTitle, setModalTitle] = useState("Add Study Session");
  const [saveLabel, setSaveLabel] = useState("Save Session");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [lessons, setLessons] = useState<{ id: number; title: string }[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const lessonCache = useRef<Record<number, { id: number; title: string }[]>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const planIndex = useMemo(() => {
    const map: Record<number, PlanChip> = {};
    for (const day of d.days) for (const plan of day.plans) map[plan.planId] = plan;
    return map;
  }, [d.days]);

  const showToast = useCallback((message: string, type: "" | "success" | "error" = "") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const loadLessons = useCallback(async (targetCourse: string, selectedId?: string) => {
    if (!targetCourse) {
      setLessons([]);
      return;
    }
    const id = Number(targetCourse);
    if (lessonCache.current[id]) {
      setLessons(lessonCache.current[id]);
      if (selectedId) setLessonId(selectedId);
      return;
    }
    setLessonsLoading(true);
    try {
      const res = await fetch(`/api/student/schedule?action=get_lessons&course_id=${id}`, {
        credentials: "same-origin",
        headers: { "X-CSRF-Token": d.csrfToken },
      });
      const data = (await res.json()) as { lessons?: { id: number; title: string }[] };
      const list = data.lessons ?? [];
      lessonCache.current[id] = list;
      setLessons(list);
      if (selectedId) setLessonId(selectedId);
    } catch {
      setLessons([]);
    } finally {
      setLessonsLoading(false);
    }
  }, [d.csrfToken]);

  function resetForm() {
    setEditingId(null);
    setCourseId("");
    setLessonId("");
    setPlannedDate(d.todayStr);
    setPlannedTime("");
    setDurationMin("30");
    setNote("");
  }

  function openAddModal(date?: string, presetCourseId?: number) {
    resetForm();
    setModalTitle("Add Study Session");
    setSaveLabel("Save Session");
    if (date) setPlannedDate(date);
    if (presetCourseId) {
      setCourseId(String(presetCourseId));
      void loadLessons(String(presetCourseId));
    }
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  }

  function openEditModal(planId: number) {
    const plan = planIndex[planId];
    if (!plan) return;
    resetForm();
    setModalTitle("Edit Study Session");
    setSaveLabel("Update Session");
    setEditingId(planId);
    setPlannedDate(plan.plannedDate);
    setPlannedTime(plan.plannedTime.slice(0, 5));
    setDurationMin(String(plan.durationMin));
    setNote(plan.note);
    setCourseId(String(plan.courseId));
    void loadLessons(String(plan.courseId), plan.lessonId === null ? "" : String(plan.lessonId));
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    setModalOpen(false);
    document.body.style.overflow = "";
  }

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveLabel("Saving…");

    const fd = new FormData();
    fd.append("csrf_token", d.csrfToken);
    fd.append("action", editingId ? "update_plan" : "add_plan");
    fd.append("plan_id", editingId === null ? "" : String(editingId));
    fd.append("course_id", courseId);
    fd.append("lesson_id", lessonId);
    fd.append("planned_date", plannedDate);
    fd.append("planned_time", plannedTime);
    fd.append("duration_min", durationMin);
    fd.append("note", note);

    try {
      const res = await fetch("/api/student/schedule", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (data.success) {
        showToast(editingId ? "Session updated!" : "Session added!", "success");
        closeModal();
        setTimeout(() => window.location.reload(), 600);
        return;
      }
      showToast(data.message || "Something went wrong.", "error");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
      setSaveLabel(editingId ? "Update Session" : "Save Session");
    }
  }

  async function toggleDone(planId: number, btn: HTMLButtonElement) {
    const fd = new FormData();
    fd.append("csrf_token", d.csrfToken);
    fd.append("action", "toggle_done");
    fd.append("plan_id", String(planId));
    try {
      const res = await fetch("/api/student/schedule", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json()) as { success: boolean; is_done?: boolean };
      if (!data.success) return;
      const row = document.getElementById(`plan-row-${planId}`);
      const isDone = !!data.is_done;
      row?.classList.toggle("done", isDone);
      btn.classList.toggle("active", isDone);
      btn.title = isDone ? "Mark undone" : "Mark done";
      showToast(isDone ? "✅ Marked as done!" : "Marked as not done", isDone ? "success" : "");
    } catch {
      showToast("Network error. Please try again.", "error");
    }
  }

  async function deletePlan(planId: number) {
    if (!window.confirm("Remove this study session?")) return;
    const fd = new FormData();
    fd.append("csrf_token", d.csrfToken);
    fd.append("action", "delete_plan");
    fd.append("plan_id", String(planId));
    try {
      const res = await fetch("/api/student/schedule", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json()) as { success: boolean };
      if (!data.success) return;
      const row = document.getElementById(`plan-row-${planId}`);
      if (row) {
        row.style.transition = "opacity 0.3s, transform 0.3s";
        row.style.opacity = "0";
        row.style.transform = "translateX(20px)";
        setTimeout(() => row.remove(), 350);
      }
      showToast("Session removed.");
    } catch {
      showToast("Network error. Please try again.", "error");
    }
  }

  return (
    <>
      <main className="sc-page">
        <section className="sc-hero">
          <div className="sc-hero-text">
            <p className="sc-hero-eyebrow">Learning Planner</p>
            <h1 className="sc-hero-title">My Schedule</h1>
            <p className="sc-hero-sub">
              Plan your study sessions, track your progress, and stay on top of deadlines — all in one place.
            </p>
            <div className="sc-hero-actions">
              <button className="btn-hero-primary" id="openAddModal" onClick={() => openAddModal()}>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add Study Session
              </button>
            </div>
          </div>
          <div className="sc-hero-illustration" aria-hidden="true">
            <div className="sc-hero-cal">
              <div className="sc-hero-cal-head">{d.heroCalendar.monthLabel}</div>
              <div className="sc-hero-cal-grid">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
                {Array.from({ length: d.heroCalendar.leadingBlanks }, (_, i) => (
                  <span key={`blank${i}`} />
                ))}
                {Array.from({ length: d.heroCalendar.daysInMonth }, (_, i) => {
                  const n = i + 1;
                  const num = String(n).padStart(2, "0");
                  const cls = n === d.heroCalendar.todayNum
                    ? "num today"
                    : d.heroCalendar.plannedDays.has(`${d.heroCalendar.monthPrefix}${num}`)
                      ? "num has-plan"
                      : "num";
                  return <span className={cls} key={n}>{n}</span>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="sc-stats">
          <div className="sc-stat">
            <div className="sc-stat-icon sc-stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="sc-stat-info">
              <p className="sc-stat-value">{d.stats.plannedThisWeek}</p>
              <p className="sc-stat-label">Planned This Week</p>
            </div>
          </div>
          <div className="sc-stat">
            <div className="sc-stat-icon sc-stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="sc-stat-info">
              <p className="sc-stat-value">{d.stats.doneThisWeek}</p>
              <p className="sc-stat-label">Completed This Week</p>
            </div>
          </div>
          <div className="sc-stat">
            <div className="sc-stat-icon sc-stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="sc-stat-info">
              <p className="sc-stat-value">{d.stats.pendingTasks}</p>
              <p className="sc-stat-label">Pending Tasks</p>
            </div>
          </div>
          <div className="sc-stat">
            <div className="sc-stat-icon sc-stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 7 7.5 7 12a5 5 0 0010 0c0-2-1-4-2-5 0 2-1.5 3-2 3-.5 0-1-.5-1-1 0-2.5 2-5 2-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="sc-stat-info">
              <p className="sc-stat-value">
                {d.stats.streak}
                <small style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text-secondary)" }}> days</small>
              </p>
              <p className="sc-stat-label">🔥 Study Streak</p>
            </div>
          </div>
        </section>

        <div className="sc-grid">
          <div className="sc-main">
            <div className="card">
              <div className="card-body">
                <div className="sc-week-nav">
                  <p className="sc-week-label">{d.weekLabel}</p>
                  <div className="sc-week-btns">
                    <a href={`?week=${d.weekOffset - 1}`} className="sc-week-btn" title="Previous week">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                    {d.weekOffset !== 0 ? (
                      <a href="?week=0" className="sc-today-btn">
                        Today
                      </a>
                    ) : null}
                    <a href={`?week=${d.weekOffset + 1}`} className="sc-week-btn" title="Next week">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                </div>

                <div className="sc-week-grid">
                  {d.days.map((day) => (
                    <div className="sc-day-col" key={day.dateStr}>
                      <div
                        className={`sc-day-head ${day.dateStr === d.todayStr ? "today" : ""}`}
                        data-date={day.dateStr}
                        title={`Add plan for ${day.dateStr}`}
                      >
                        <div className="sc-day-name">{day.name}</div>
                        <div className="sc-day-num">{day.num}</div>
                        {day.plans.length > 0 ? (
                          <div className="sc-day-dot-row">
                            {Array.from({ length: Math.min(3, day.plans.length) }, (_, i) => (
                              <div className="sc-day-dot" key={i} />
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="sc-day-body">
                        {day.plans.map((plan) => (
                          <div
                            className={`sc-plan-chip ${plan.isDone ? "done" : ""}`}
                            data-plan-id={plan.planId}
                            key={plan.planId}
                            title={plan.chipTitle}
                          >
                            {plan.timeLabel ? <div className="sc-plan-chip-time">{plan.timeLabel}</div> : null}
                            <div className="sc-plan-chip-title">{plan.chipTitle}</div>
                          </div>
                        ))}

                        {day.dateStr >= d.todayStr ? (
                          <button className="sc-add-chip" data-date={day.dateStr} title="Add session" onClick={() => openAddModal(day.dateStr)}>
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <span>Add</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card sc-today-plan">
              <div className="card-body">
                <div className="card-header">
                  <h2 className="card-title">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Today&apos;s Plan
                    {d.todayPlans.length > 0 ? (
                      <span style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "2px 10px", borderRadius: "99px", fontSize: ".72rem", fontWeight: 700 }}>
                        {d.todayPlans.length}
                      </span>
                    ) : null}
                  </h2>
                  <button className="btn-add-plan" data-date={d.todayStr} onClick={() => openAddModal(d.todayStr)}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Add Session
                  </button>
                </div>

                {d.todayPlans.length === 0 ? (
                  <div className="sc-today-empty">
                    <div className="sc-today-empty-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="sc-today-empty-title">No sessions planned for today</p>
                    <p className="sc-today-empty-sub">Add a study session to stay on track with your learning goals.</p>
                  </div>
                ) : (
                  <div className="sc-plan-list" id="todayPlanList">
                    {d.todayPlans.map((plan) => (
                      <div className={`sc-plan-row ${plan.isDone ? "done" : ""}`} id={`plan-row-${plan.planId}`} key={plan.planId}>
                        <div className="sc-plan-time-block">
                          <span className="sc-plan-time-val">
                            {plan.rowTimeLabel}
                            <br />
                            <small>{plan.rowMeridiem}</small>
                          </span>
                          {plan.durationMin ? <span className="sc-plan-time-dur">{plan.durationMin}min</span> : null}
                        </div>
                        <div className="sc-plan-info">
                          <p className="sc-plan-row-course">{plan.courseTitle}</p>
                          <p className="sc-plan-row-title">{plan.rowTitle}</p>
                          {plan.note ? <p className="sc-plan-row-note">{plan.note}</p> : null}
                        </div>
                        <div className="sc-plan-row-actions">
                          <button
                            className={`sc-action-btn sc-action-btn--check ${plan.isDone ? "active" : ""}`}
                            data-plan-id={plan.planId}
                            title={plan.isDone ? "Mark undone" : "Mark done"}
                            onClick={(e) => void toggleDone(plan.planId, e.currentTarget)}
                          >
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            className="sc-action-btn sc-action-btn--edit"
                            data-plan-id={plan.planId}
                            title="Edit"
                            onClick={() => openEditModal(plan.planId)}
                          >
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            className="sc-action-btn sc-action-btn--delete"
                            data-plan-id={plan.planId}
                            title="Delete"
                            onClick={() => void deletePlan(plan.planId)}
                          >
                            <svg viewBox="0 0 24 24" fill="none">
                              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="sc-side">
            <div className="card">
              <div className="card-body card-body--sm">
                <div className="card-header">
                  <h2 className="card-title">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Pending Tasks
                  </h2>
                  {d.pendingTasks.length > 0 ? (
                    <span style={{ background: "var(--accent-orange-lt)", color: "#92400e", padding: "2px 10px", borderRadius: "99px", fontSize: ".72rem", fontWeight: 700 }}>
                      {d.pendingTasks.length}
                    </span>
                  ) : null}
                </div>

                {d.pendingTasks.length === 0 ? (
                  <div className="sc-empty" style={{ padding: "1.5rem 1rem" }}>
                    <div className="sc-empty-icon" style={{ width: 48, height: 48 }}>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                    <p style={{ fontSize: ".875rem", fontWeight: 700, color: "var(--text-primary)" }}>All caught up! 🎉</p>
                    <p style={{ fontSize: ".78rem", color: "var(--text-secondary)" }}>No pending quizzes or assignments.</p>
                  </div>
                ) : (
                  <div className="sc-tasks">
                    {d.pendingTasks.map((task) => (
                      <div className="sc-task-item" key={`${task.type}-${task.id}`}>
                        <div className={`sc-task-badge sc-task-badge--${task.type}`}>
                          {task.type === "quiz" ? (
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                        <div className="sc-task-info">
                          <p className="sc-task-label">{task.title}</p>
                          <p className="sc-task-meta">
                            {task.courseTitle} · {task.type === "quiz" ? "Quiz" : "Assignment"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-body card-body--sm">
                <div className="card-header">
                  <h2 className="card-title">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Study Activity
                  </h2>
                </div>
                <div className="sc-heatmap-days">
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                    <span key={i}>{label}</span>
                  ))}
                </div>
                <div className="sc-heatmap-grid">
                  {Array.from({ length: d.heatmap.leadingBlanks }, (_, i) => (
                    <div className="sc-heatmap-cell" style={{ opacity: 0 }} key={`pad${i}`} />
                  ))}
                  {d.heatmap.cells.map((cell) => (
                    <div className="sc-heatmap-cell" data-level={cell.level} title={cell.title} key={cell.dateStr} />
                  ))}
                </div>
                <div className="sc-heatmap-legend">
                  <span>Less</span>
                  <div className="sc-heatmap-legend-cells">
                    {[0, 1, 2, 3].map((level) => (
                      <div className="sc-heatmap-legend-cell" data-level={level} key={level} />
                    ))}
                  </div>
                  <span>More</span>
                </div>
              </div>
            </div>

            {d.myCourses.length > 0 ? (
              <div className="card">
                <div className="card-body card-body--sm">
                  <div className="card-header">
                    <h2 className="card-title">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                      My Courses
                    </h2>
                    <a href="/student/my-courses" className="card-link">
                      View All
                    </a>
                  </div>
                  <div className="sc-course-list">
                    {d.myCourses.slice(0, 5).map((course) => (
                      <div
                        className="sc-course-item"
                        data-course-id={course.courseId}
                        title="Plan study for this course"
                        key={course.courseId}
                        onClick={() => openAddModal(undefined, course.courseId)}
                      >
                        <div className="sc-course-thumb">
                          {course.thumbnail ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={course.thumbnail} alt={course.title} loading="lazy" />
                          ) : (
                            <div className="sc-course-thumb-placeholder">
                              <svg viewBox="0 0 24 24" fill="none">
                                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M6.5 2H20v20H6.5A2.2 2.2 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="sc-course-info">
                          <p className="sc-course-title">{course.title}</p>
                          <div className="sc-course-progress-bar">
                            <div className="sc-course-progress-fill" style={{ width: `${course.progressPercentage}%` }} />
                          </div>
                        </div>
                        <span className="sc-course-pct">{course.progressPercentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </main>

      <div className={`sc-modal-overlay ${modalOpen ? "open" : ""}`} id="scModalOverlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <button className="sc-modal-close" title="Close" onClick={closeModal}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="sc-modal-title" id="modalTitle">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span id="modalTitleText">{modalTitle}</span>
          </h2>

          <form id="scPlanForm" onSubmit={submitPlan}>
            <input type="hidden" id="planId" name="plan_id" value={editingId === null ? "" : String(editingId)} />

            <div className="sc-form-grid">
              <div className="sc-form-group sc-form-group--full">
                <label className="sc-form-label" htmlFor="planCourse">
                  Course <span style={{ color: "var(--accent-red)" }}>*</span>
                </label>
                <select
                  className="sc-form-select"
                  id="planCourse"
                  name="course_id"
                  required
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setLessonId("");
                    void loadLessons(e.target.value);
                  }}
                >
                  <option value="">Select a course…</option>
                  {d.myCourses.map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sc-form-group sc-form-group--full">
                <label className="sc-form-label" htmlFor="planLesson">
                  Lesson <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <select className="sc-form-select" id="planLesson" name="lesson_id" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                  <option value="">{lessonsLoading ? "Loading…" : "General study session"}</option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sc-form-group">
                <label className="sc-form-label" htmlFor="planDate">
                  Date <span style={{ color: "var(--accent-red)" }}>*</span>
                </label>
                <input
                  className="sc-form-input"
                  type="date"
                  id="planDate"
                  name="planned_date"
                  value={plannedDate}
                  required
                  min={d.todayStr}
                  onChange={(e) => setPlannedDate(e.target.value)}
                />
              </div>

              <div className="sc-form-group">
                <label className="sc-form-label" htmlFor="planTime">
                  Time <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input className="sc-form-input" type="time" id="planTime" name="planned_time" value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} />
              </div>

              <div className="sc-form-group">
                <label className="sc-form-label" htmlFor="planDuration">
                  Duration (min)
                </label>
                <input
                  className="sc-form-input"
                  type="number"
                  id="planDuration"
                  name="duration_min"
                  min={5}
                  max={480}
                  value={durationMin}
                  placeholder="30"
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              </div>

              <div className="sc-form-group">
                <label className="sc-form-label" htmlFor="planNote">
                  Note <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  className="sc-form-input"
                  type="text"
                  id="planNote"
                  name="note"
                  maxLength={255}
                  placeholder="e.g. Focus on chapter 3"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="sc-modal-actions">
              <button type="button" className="btn-modal-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn-modal-save" id="modalSaveBtn" disabled={saving}>
                {saveLabel}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className={`sc-toast ${toast ? `show${toast.type ? ` sc-toast--${toast.type}` : ""}` : ""}`} id="scToast" role="alert" aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span id="scToastMsg">{toast?.message ?? ""}</span>
      </div>
    </>
  );
}