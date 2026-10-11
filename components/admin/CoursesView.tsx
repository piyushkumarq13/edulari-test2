"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminCourseRow, AdminCourseStats } from "@/lib/db/admin/courses";
import { formatPrice, phpNumber } from "@/lib/format";

type Filters = {
  status: string;
  search: string;
  instructor: string;
  category: string;
  featured: string;
};

type Props = {
  csrfToken: string;
  courses: AdminCourseRow[];
  stats: AdminCourseStats;
  totalCount: number;
  page: number;
  totalPages: number;
  limit: number;
  offset: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: Filters;
  instructors: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  message: string;
};

/**
 * The Manage Courses list (courses.php). The PHP drove the table, dropdowns, delete/bulk modals and
 * PRG forms with inline JS; this keeps the same markup and behaviour, but the forms post to
 * /api/admin/courses over fetch and then follow the redirect the handler returns.
 */
export default function CoursesView({
  csrfToken,
  courses,
  stats,
  totalCount,
  page,
  totalPages,
  limit,
  offset,
  sortBy,
  sortDir,
  filters,
  instructors,
  categories,
  message,
}: Props) {
  const [message_, setMessage] = useState(message);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCourseRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alertFading, setAlertFading] = useState(false);

  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const backdropVisible = deleteTarget !== null || bulkDeleteOpen;

  // PHP: #pageAlert auto-dismisses after 5s (fade 0.4s then removed).
  useEffect(() => {
    if (!message_) return;
    const t = setTimeout(() => {
      setAlertFading(true);
      setTimeout(() => {
        setMessage("");
        setAlertFading(false);
      }, 400);
    }, 5000);
    return () => clearTimeout(t);
  }, [message_]);

  // PHP: openModal() focuses the first focusable control after 50ms.
  useEffect(() => {
    if (!deleteTarget && !bulkDeleteOpen) return;
    const modal = document.getElementById(deleteTarget ? "deleteModal" : "bulkDeleteModal");
    if (!modal) return;
    const first = modal.querySelector<HTMLElement>("button, [href], input, select, textarea");
    const t = setTimeout(() => first?.focus(), 50);
    return () => clearTimeout(t);
  }, [deleteTarget, bulkDeleteOpen]);

  useEffect(() => {
    document.body.style.overflow = backdropVisible ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [backdropVisible]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.length > 0 && selected.length < courses.length;
      selectAllRef.current.checked = courses.length > 0 && selected.length === courses.length;
    }
  }, [selected, courses.length]);

  async function post(fd: FormData) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/courses", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (data.error) setError(data.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function actionForm(entries: Record<string, string>): FormData {
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    for (const [k, v] of Object.entries(entries)) fd.append(k, v);
    return fd;
  }

  const allChecked = courses.length > 0 && selected.length === courses.length;

  function toggleAll(checked: boolean) {
    setSelected(checked ? courses.map((c) => c.id) : []);
  }

  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function applyBulk() {
    const select = document.getElementById("bulkActionSelect") as HTMLSelectElement | null;
    const action = select?.value ?? "";
    if (!action) {
      window.alert("Please select a bulk action first.");
      select?.focus();
      return;
    }
    if (selected.length === 0) {
      window.alert("No courses selected. Please check at least one course.");
      return;
    }
    if (action === "delete") {
      setBulkDeleteOpen(true);
      return;
    }
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    fd.append("bulk_action", action);
    selected.forEach((id) => fd.append("selected_ids[]", String(id)));
    void post(fd);
  }

  function confirmBulkDelete() {
    const fd = new FormData();
    fd.append("csrf_token", csrfToken);
    fd.append("bulk_action", "delete");
    selected.forEach((id) => fd.append("selected_ids[]", String(id)));
    setBulkDeleteOpen(false);
    void post(fd);
  }

  // Pagination link builder (courses.php's $qBase + page).
  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.instructor) params.set("instructor", filters.instructor);
    if (filters.category) params.set("category", filters.category);
    if (filters.featured) params.set("featured", filters.featured);
    params.set("sort", sortBy);
    params.set("dir", sortDir);
    params.set("per_page", String(limit));
    params.set("page", String(target));
    return `?${params.toString()}`;
  }

  const isFiltered = Boolean(
    filters.search || filters.status || filters.instructor || filters.category || filters.featured,
  );

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  return (
    <>
      <main className="crs-page-wrap" id="mainContent">
        <div className="crs-page-inner">
          {/* ── PAGE HEADER ── */}
          <div className="crs-page-header">
            <div className="crs-page-title-group">
              <div className="crs-page-icon">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h1 className="crs-page-title">Manage Courses</h1>
                <p className="crs-page-subtitle">View, publish, feature, and manage all platform courses</p>
              </div>
            </div>
            <a href="/admin/create-course" className="crs-btn crs-btn--primary">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Create Course
            </a>
          </div>

          {/* ── ALERTS ── */}
          {message_ ? (
            <div
              className="crs-alert crs-alert--success"
              role="alert"
              id="pageAlert"
              style={alertFading ? { transition: "opacity 0.4s ease, transform 0.4s ease", opacity: 0, transform: "translateY(-6px)" } : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" className="crs-alert-icon">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{message_}</span>
              <button className="crs-alert-close" aria-label="Dismiss" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          ) : error ? (
            <div
              className="crs-alert crs-alert--error"
              role="alert"
              id="pageAlert"
              style={alertFading ? { transition: "opacity 0.4s ease, transform 0.4s ease", opacity: 0, transform: "translateY(-6px)" } : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" className="crs-alert-icon">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
              <button className="crs-alert-close" aria-label="Dismiss" onClick={() => setError("")}>
                ×
              </button>
            </div>
          ) : null}

          {/* ── STAT CARDS ── */}
          <div className="crs-stats-grid">
            <div className="crs-stat-card">
              <div className="crs-stat-icon crs-stat-icon--blue">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="crs-stat-body">
                <span className="crs-stat-value">{phpNumber(stats.total)}</span>
                <span className="crs-stat-label">Total Courses</span>
              </div>
            </div>
            <div className="crs-stat-card">
              <div className="crs-stat-icon crs-stat-icon--green">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="crs-stat-body">
                <span className="crs-stat-value">{phpNumber(stats.published)}</span>
                <span className="crs-stat-label">Published</span>
              </div>
            </div>
            <div className="crs-stat-card">
              <div className="crs-stat-icon crs-stat-icon--amber">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="crs-stat-body">
                <span className="crs-stat-value">{phpNumber(stats.featured)}</span>
                <span className="crs-stat-label">Featured</span>
              </div>
            </div>
            <div className="crs-stat-card">
              <div className="crs-stat-icon crs-stat-icon--purple">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="crs-stat-body">
                <span className="crs-stat-value">{phpNumber(stats.total_students)}</span>
                <span className="crs-stat-label">Total Enrollments</span>
              </div>
            </div>
          </div>

          {/* ── TABLE CARD ── */}
          <div className="crs-table-card">
            {/* Filter Toolbar */}
            <div className="crs-toolbar">
              <form method="get" className="crs-filter-form" id="filterForm">
                <div className="crs-search-wrap">
                  <span className="crs-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="search"
                    id="searchInput"
                    className="crs-search-input"
                    placeholder="Search title, description, instructor…"
                    defaultValue={filters.search}
                    autoComplete="off"
                  />
                  {filters.search ? (
                    <button
                      type="button"
                      className="crs-search-clear"
                      aria-label="Clear"
                      onClick={() => {
                        const inp = document.getElementById("searchInput") as HTMLInputElement | null;
                        if (inp) inp.value = "";
                        (document.getElementById("filterForm") as HTMLFormElement | null)?.submit();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>

                <div className="crs-filter-row">
                  <select name="status" className="crs-select" defaultValue={filters.status} onChange={autoSubmit}>
                    <option value="">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select name="instructor" className="crs-select" defaultValue={filters.instructor} onChange={autoSubmit}>
                    <option value="">All Instructors</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>

                  <select name="category" className="crs-select" defaultValue={filters.category} onChange={autoSubmit}>
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <select name="featured" className="crs-select" defaultValue={filters.featured} onChange={autoSubmit}>
                    <option value="">Featured: All</option>
                    <option value="yes">Featured Only</option>
                    <option value="no">Not Featured</option>
                  </select>

                  <select name="sort" className="crs-select" defaultValue={sortBy} onChange={autoSubmit}>
                    <option value="created_at">Newest First</option>
                    <option value="title">Title A–Z</option>
                    <option value="student_count">Most Students</option>
                    <option value="price">Price</option>
                    <option value="avg_rating">Top Rated</option>
                  </select>

                  <select name="dir" className="crs-select" defaultValue={sortDir} onChange={autoSubmit}>
                    <option value="desc">↓ Desc</option>
                    <option value="asc">↑ Asc</option>
                  </select>

                  <select name="per_page" className="crs-select" defaultValue={String(limit)} onChange={autoSubmit}>
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                  </select>

                  <button type="submit" className="crs-btn crs-btn--secondary crs-btn--sm">
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Filter
                  </button>

                  {isFiltered ? (
                    <a href="/admin/courses" className="crs-btn crs-btn--ghost crs-btn--sm">
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Clear
                    </a>
                  ) : null}
                </div>
              </form>
            </div>

            {/* Bulk Action Bar */}
            <div className={`crs-bulk-bar${selected.length > 0 ? " crs-bulk-bar--visible" : ""}`} id="bulkBar" aria-live="polite">
              <form method="post" id="bulkForm" onSubmit={(e) => e.preventDefault()}>
                <div id="bulkIdsContainer" />
                <div className="crs-bulk-inner">
                <span className="crs-bulk-count" id="bulkCount">
                  {selected.length} selected
                </span>
                <select name="bulk_action" id="bulkActionSelect" className="crs-select crs-select--sm" defaultValue="">
                  <option value="">— Bulk Action —</option>
                  <option value="publish">Publish</option>
                  <option value="unpublish">Unpublish</option>
                  <option value="feature">Mark as Featured</option>
                  <option value="unfeature">Remove Featured</option>
                  <option value="delete">Delete</option>
                </select>
                <button type="button" className="crs-btn crs-btn--primary crs-btn--sm" id="applyBulkBtn" onClick={applyBulk}>
                  Apply
                </button>
                <button
                  type="button"
                  className="crs-btn crs-btn--ghost crs-btn--sm"
                  id="clearSelectionBtn"
                  onClick={() => setSelected([])}
                >
                  Deselect All
                </button>
                </div>
              </form>
            </div>

            {/* Table Info Row */}
            <div className="crs-table-info-row">
              <span className="crs-results-count">
                {totalCount > 0 ? (
                  <>
                    Showing {phpNumber(offset + 1)}–{phpNumber(Math.min(offset + limit, totalCount))} of {phpNumber(totalCount)} course
                    {totalCount !== 1 ? "s" : ""}
                  </>
                ) : (
                  "No courses found"
                )}
              </span>
            </div>

            {courses.length > 0 ? (
              <>
                <div className="crs-table-scroll">
                  <table className="crs-table" id="coursesTable">
                    <thead>
                      <tr>
                        <th className="crs-th-check">
                          <input
                            type="checkbox"
                            className="crs-checkbox"
                            id="selectAll"
                            aria-label="Select all"
                            ref={selectAllRef}
                            checked={allChecked}
                            onChange={(e) => toggleAll(e.target.checked)}
                          />
                        </th>
                        <th>Course</th>
                        <th>Instructor</th>
                        <th>Category</th>
                        <th className="crs-th-num">Price</th>
                        <th className="crs-th-num">Students</th>
                        <th className="crs-th-num">Rating</th>
                        <th>Status</th>
                        <th className="crs-th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr className="crs-row" data-id={course.id} key={course.id}>
                          <td className="crs-td-check">
                            <input
                              type="checkbox"
                              className="crs-checkbox crs-row-check"
                              value={course.id}
                              aria-label={`Select ${course.title}`}
                              checked={selected.includes(course.id)}
                              onChange={(e) => toggleOne(course.id, e.target.checked)}
                            />
                          </td>
                          <td className="crs-td-course">
                            <div className="crs-course-cell">
                              {course.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb(course.thumbnail)} alt={course.title} className="crs-thumb" loading="lazy" />
                              ) : (
                                <div className="crs-thumb crs-thumb--placeholder">
                                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                              )}
                              <div className="crs-course-info">
                                <span className="crs-course-title">{course.title}</span>
                                <div className="crs-course-meta">
                                  <span className="crs-id-tag">#{course.id}</span>
                                  {course.is_featured ? <span className="crs-badge crs-badge--featured">★ Featured</span> : null}
                                  {Number(course.review_count) > 0 ? (
                                    <span className="crs-review-count">
                                      {Number(course.review_count)} review{Number(course.review_count) !== 1 ? "s" : ""}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="crs-instructor-cell">
                              <span className="crs-instructor-name">{course.instructor_name ?? "—"}</span>
                              {course.instructor_email ? <span className="crs-instructor-email">{course.instructor_email}</span> : null}
                            </div>
                          </td>
                          <td>
                            <span className="crs-category-badge">{course.category_name ?? "Uncategorized"}</span>
                          </td>
                          <td className="crs-td-num">
                            <span className="crs-price">{formatPrice(Number(course.price))}</span>
                          </td>
                          <td className="crs-td-num">
                            <span className="crs-students">{phpNumber(Number(course.student_count))}</span>
                          </td>
                          <td className="crs-td-num">
                            {course.avg_rating && Number(course.avg_rating) > 0 ? (
                              <div className="crs-rating">
                                <svg viewBox="0 0 24 24" fill="#f59e0b" width="13" height="13">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                {phpNumber(Number(course.avg_rating), 1)}
                              </div>
                            ) : (
                              <span className="crs-no-rating">—</span>
                            )}
                          </td>
                          <td>
                            {course.is_published ? (
                              <span className="crs-status crs-status--published">
                                <span className="crs-status-dot" />Published
                              </span>
                            ) : (
                              <span className="crs-status crs-status--pending">
                                <span className="crs-status-dot" />Pending
                              </span>
                            )}
                          </td>
                          <td className="crs-td-actions">
                            <div className="crs-action-group">
                              <a href={`/admin/edit-course?id=${course.id}`} className="crs-action-btn crs-action-btn--edit" title="Edit course">
                                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Edit
                              </a>

                              <div className={`crs-more-wrap${openDropdown === course.id ? " crs-more-wrap--open" : ""}`} data-dropdown>
                                <button
                                  type="button"
                                  className="crs-more-btn"
                                  title="More actions"
                                  aria-haspopup="true"
                                  aria-expanded={openDropdown === course.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdown((cur) => (cur === course.id ? null : course.id));
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                                    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                                  </svg>
                                </button>
                                <div className="crs-dropdown" role="menu">
                                  <form
                                    method="post"
                                    className="crs-dropdown-form"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      void post(actionForm({ course_id: String(course.id), status: String(course.is_published ? 1 : 0), toggle_publish: "1" }));
                                    }}
                                  >
                                    <input type="hidden" name="csrf_token" value={csrfToken} />
                                    <input type="hidden" name="course_id" value={course.id} />
                                    <input type="hidden" name="status" value={course.is_published ? 1 : 0} />
                                    <button type="submit" name="toggle_publish" className="crs-dropdown-item" role="menuitem">
                                      {course.is_published ? (
                                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                      ) : (
                                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                                        </svg>
                                      )}
                                      {course.is_published ? "Unpublish" : "Publish"}
                                    </button>
                                  </form>

                                  <form
                                    method="post"
                                    className="crs-dropdown-form"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      void post(
                                        actionForm(
                                          course.is_featured
                                            ? { course_id: String(course.id), unfeature: "1" }
                                            : { course_id: String(course.id), feature: "1" },
                                        ),
                                      );
                                    }}
                                  >
                                    <input type="hidden" name="csrf_token" value={csrfToken} />
                                    <input type="hidden" name="course_id" value={course.id} />
                                    {!course.is_featured ? (
                                      <button type="submit" name="feature" className="crs-dropdown-item" role="menuitem">
                                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Mark as Featured
                                      </button>
                                    ) : (
                                      <button type="submit" name="unfeature" className="crs-dropdown-item" role="menuitem">
                                        <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#f59e0b" fill="#fef3c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Remove Featured
                                      </button>
                                    )}
                                  </form>

                                  <a href={`/admin/enrollments?course_id=${course.id}`} className="crs-dropdown-item" role="menuitem">
                                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    View Enrollments
                                  </a>

                                  <a href={`/admin/reviews?course_id=${course.id}`} className="crs-dropdown-item" role="menuitem">
                                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    View Reviews
                                  </a>

                                  <div className="crs-dropdown-divider" role="separator" />

                                  <button
                                    type="button"
                                    className="crs-dropdown-item crs-dropdown-item--danger crs-delete-trigger"
                                    data-course-id={course.id}
                                    data-course-title={course.title}
                                    data-student-count={Number(course.student_count)}
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenDropdown(null);
                                      setDeleteTarget(course);
                                    }}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                                      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    Delete Course
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 ? (
                  <div className="crs-pagination">
                    <span className="crs-pagination-info">
                      Page {page} of {totalPages}
                    </span>
                    <div className="crs-pagination-btns">
                      {page > 1 ? (
                        <a href={pageHref(page - 1)} className="crs-btn crs-btn--ghost crs-btn--sm" aria-label="Previous page">
                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Prev
                        </a>
                      ) : null}

                      {start > 1 ? (
                        <>
                          <a href={pageHref(1)} className="crs-btn crs-btn--ghost crs-btn--sm">
                            1
                          </a>
                          {start > 2 ? <span className="crs-pagination-ellipsis">…</span> : null}
                        </>
                      ) : null}

                      {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((i) => (
                        <a
                          key={i}
                          href={pageHref(i)}
                          className={`crs-btn crs-btn--sm ${i === page ? "crs-btn--primary" : "crs-btn--ghost"}`}
                          aria-current={i === page ? "page" : undefined}
                        >
                          {i}
                        </a>
                      ))}

                      {end < totalPages ? (
                        <>
                          {end < totalPages - 1 ? <span className="crs-pagination-ellipsis">…</span> : null}
                          <a href={pageHref(totalPages)} className="crs-btn crs-btn--ghost crs-btn--sm">
                            {totalPages}
                          </a>
                        </>
                      ) : null}

                      {page < totalPages ? (
                        <a href={pageHref(page + 1)} className="crs-btn crs-btn--ghost crs-btn--sm" aria-label="Next page">
                          Next
                          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="crs-empty">
                <div className="crs-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" width="36" height="36">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {isFiltered ? (
                  <>
                    <h3 className="crs-empty-title">No courses match your filters</h3>
                    <p className="crs-empty-text">Try adjusting your search or filter criteria.</p>
                    <a href="/admin/courses" className="crs-btn crs-btn--secondary">
                      Clear Filters
                    </a>
                  </>
                ) : (
                  <>
                    <h3 className="crs-empty-title">No courses yet</h3>
                    <p className="crs-empty-text">Get started by creating the first course on the platform.</p>
                    <a href="/admin/create-course" className="crs-btn crs-btn--primary">
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      Create Course
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <div className={`crs-modal-overlay${deleteTarget ? " crs-modal-overlay--open" : ""}`} id="deleteModal" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">
        <div className="crs-modal">
          <div className="crs-modal-header crs-modal-header--danger">
            <h2 className="crs-modal-title" id="deleteModalTitle">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Delete Course
            </h2>
            <button className="crs-modal-close" id="closeDeleteModal" aria-label="Close" onClick={() => setDeleteTarget(null)}>
              ×
            </button>
          </div>
          <div className="crs-modal-body">
            <p className="crs-modal-msg" id="deleteMessage">
              {deleteTarget ? `Are you sure you want to permanently delete "${deleteTarget.title}"?` : "Are you sure you want to permanently delete this course?"}
            </p>
            <div className="crs-modal-warning" id="deleteWarning">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span id="deleteWarningText">
                {deleteTarget && Number(deleteTarget.student_count) > 0
                  ? `${Number(deleteTarget.student_count)} enrolled student(s) will lose access. All lessons, sections, quizzes, and reviews will be permanently removed. This cannot be undone.`
                  : "This will permanently remove all lessons, sections, quizzes, and reviews. This action cannot be undone."}
              </span>
            </div>
            <form
              method="post"
              id="deleteForm"
              onSubmit={(e) => {
                e.preventDefault();
                if (deleteTarget) void post(actionForm({ course_id: String(deleteTarget.id), delete: "1" }));
              }}
            >
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="course_id" id="deleteCourseId" value={deleteTarget?.id ?? ""} />
              <input type="hidden" name="delete" value="1" />
              <div className="crs-modal-footer">
                <button type="button" className="crs-btn crs-btn--ghost" id="cancelDeleteBtn" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="crs-btn crs-btn--danger">
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Delete Permanently
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className={`crs-modal-backdrop${backdropVisible ? " crs-modal-backdrop--visible" : ""}`} id="modalBackdrop" onClick={() => { setDeleteTarget(null); setBulkDeleteOpen(false); }} />

      {/* ── BULK DELETE CONFIRM MODAL ── */}
      <div className={`crs-modal-overlay${bulkDeleteOpen ? " crs-modal-overlay--open" : ""}`} id="bulkDeleteModal" role="dialog" aria-modal="true" aria-labelledby="bulkDeleteModalTitle">
        <div className="crs-modal">
          <div className="crs-modal-header crs-modal-header--danger">
            <h2 className="crs-modal-title" id="bulkDeleteModalTitle">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Bulk Delete Courses
            </h2>
            <button className="crs-modal-close" id="closeBulkDeleteModal" aria-label="Close" onClick={() => setBulkDeleteOpen(false)}>
              ×
            </button>
          </div>
          <div className="crs-modal-body">
            <p className="crs-modal-msg" id="bulkDeleteMessage">
              {`You are about to permanently delete ${selected.length} course(s). This action cannot be undone.`}
            </p>
            <div className="crs-modal-warning">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>All lessons, enrollments, quizzes, and reviews for the selected courses will be permanently deleted. This cannot be undone.</span>
            </div>
            <div className="crs-modal-footer">
              <button type="button" className="crs-btn crs-btn--ghost" id="cancelBulkDeleteBtn" onClick={() => setBulkDeleteOpen(false)}>
                Cancel
              </button>
              <button type="button" className="crs-btn crs-btn--danger" id="confirmBulkDeleteBtn" onClick={confirmBulkDelete}>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Delete All Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Course thumbnails are B2 keys served through the media proxy (same as the instructor list). */
function thumb(key: string): string {
  return key.startsWith("http") ? key : `/media?type=avatar&key=${encodeURIComponent(key)}`;
}

function autoSubmit(e: React.ChangeEvent<HTMLSelectElement>) {
  e.currentTarget.form?.submit();
}
