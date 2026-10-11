"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ucfirst } from "@/lib/format";

const STATUS_BADGES: Record<string, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-danger",
};

const API_PATH = "/api/admin/instructor-applications";
const PAGE_PATH = "/admin/instructor-applications";

export interface ApplicationRowView {
  id: number;
  status: string;
  applicantName: string;
  applicantEmail: string;
  profileImage: string | null;
  initials: string;
  avatarColor: string;
  isEmailVerified: boolean;
  primarySubject: string;
  skillLevel: string;
  highestEducation: string;
  expLabel: string;
  submittedDate: string;
  timeAgo: string;
  rejectionReason: string;
  userId: number;
}

export type PageToken =
  | { kind: "prev"; href: string }
  | { kind: "next"; href: string }
  | { kind: "page"; label: string; href: string; active: boolean }
  | { kind: "ellipsis" };

interface Props {
  rows: ApplicationRowView[];
  counts: { pending: number; approved: number; rejected: number };
  totalCount: string;
  rangeFrom: number;
  rangeTo: number;
  perPage: number;
  totalPages: number;
  pageTokens: PageToken[];
  statusFilter: string;
  searchFilter: string;
  subjectFilter: string;
  educFilter: string;
  dateFrom: string;
  dateTo: string;
  educLevels: string[];
  activeFilterCount: number;
  sortCol: string;
  sortDir: "ASC" | "DESC";
  tabHrefs: Record<string, string>;
  sortHrefs: Record<string, string>;
  resetHref: string;
  hasAnyFilter: boolean;
  csrfToken: string;
  initialMessage: string;
  initialError: string;
}

export default function InstructorApplicationsClient(props: Props) {
  const {
    rows,
    counts,
    totalCount,
    rangeFrom,
    rangeTo,
    perPage,
    totalPages,
    pageTokens,
    statusFilter,
    searchFilter,
    subjectFilter,
    educFilter,
    dateFrom,
    dateTo,
    educLevels,
    activeFilterCount,
    sortCol,
    sortDir,
    tabHrefs,
    sortHrefs,
    resetHref,
    hasAnyFilter,
    csrfToken,
    initialMessage,
    initialError,
  } = props;

  const router = useRouter();

  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(initialError);
  const [selected, setSelected] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  const [rejectApp, setRejectApp] = useState<{ id: number; name: string } | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [reasonView, setReasonView] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"bulk_approve" | "bulk_reject">("bulk_approve");

  const searchFormRef = useRef<HTMLFormElement>(null);
  const bulkFormRef = useRef<HTMLFormElement>(null);

  const pendingIds = useMemo(() => rows.filter((r) => r.status === "pending").map((r) => r.id), [rows]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const selectAllChecked = pendingIds.length > 0 && pendingIds.every((id) => selectedSet.has(id));
  const selectAllIndeterminate = !selectAllChecked && pendingIds.some((id) => selectedSet.has(id));

  // Auto-dismiss alerts after 5s (PHP setTimeout at the bottom of the list inline JS).
  useEffect(() => {
    if (!message && !error) return;
    const t = setTimeout(() => {
      setMessage("");
      setError("");
    }, 5000);
    return () => clearTimeout(t);
  }, [message, error]);

  // Lock body scroll while any of the three modals is open.
  useEffect(() => {
    const open = rejectApp !== null || bulkRejectOpen || reasonView !== null;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [rejectApp, bulkRejectOpen, reasonView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRejectApp(null);
        setBulkRejectOpen(false);
        setReasonView(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const focusFirst = (root: HTMLElement | null) => {
    if (!root) return;
    setTimeout(() => {
      const el = root.querySelector<HTMLElement>(
        "textarea, input:not([type=hidden]), button:not(.ia-modal-close)",
      );
      el?.focus();
    }, 50);
  };

  const toggleRow = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectAllChecked) {
      setSelected((prev) => prev.filter((id) => !pendingIds.includes(id)));
    } else {
      setSelected([...new Set([...selected, ...pendingIds])]);
    }
  };

  const submitBulk = (action: "bulk_approve" | "bulk_reject") => {
    if (!selected.length) return;
    const msg = `${action === "bulk_approve" ? "Approve" : "Reject"} ${selected.length} application(s)?`;
    if (!window.confirm(msg)) return;
    setBulkAction(action);
    // Let the reactive hidden inputs render, then submit natively.
    requestAnimationFrame(() => bulkFormRef.current?.requestSubmit());
  };

  const openRejectModal = (id: number, name: string) => {
    setRejectApp({ id, name });
  };

  const openBulkRejectModal = () => {
    if (!selected.length) return;
    setBulkRejectOpen(true);
  };

  const openReasonModal = (reason: string) => {
    setReasonView(reason || "(No reason provided)");
  };

  const clearSelection = () => setSelected([]);

  const onRowClick = (e: React.MouseEvent<HTMLTableRowElement>, id: number) => {
    if (e.target instanceof Element && e.target.closest("a, button, form, input")) return;
    router.push(`/admin/instructor-application-detail?id=${id}`);
  };

  const sortIcon = (col: string) => {
    if (col !== sortCol) {
      return (
        <svg className="sort-icon neutral" viewBox="0 0 24 24" width="12" height="12">
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    }
    const arrow = sortDir === "ASC" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7";
    return (
      <svg className="sort-icon active" viewBox="0 0 24 24" width="12" height="12">
        <path d={arrow} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  };

  const changePerPage = (val: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("per_page", val);
    url.searchParams.set("page", "1");
    router.push(url.pathname + url.search);
  };

  return (
    <>
      <main className="ad-page-wrap">
        <div className="ia-page">
          <div className="ia-inner">
            {/* ── Page Header ── */}
            <div className="ia-page-header">
              <div>
                <h1 className="ia-page-title">
                  <svg viewBox="0 0 24 24" fill="none" width="26" height="26" aria-hidden="true">
                    <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Instructor Applications
                </h1>
                <p className="ia-page-subtitle">Review, approve or reject instructor applications from your platform.</p>
              </div>
              <div className="ia-header-stats">
                <div className="ia-stat-chip ia-stat-pending">
                  <span className="ia-stat-num">{counts.pending}</span>
                  <span className="ia-stat-lbl">Pending</span>
                </div>
                <div className="ia-stat-chip ia-stat-approved">
                  <span className="ia-stat-num">{counts.approved}</span>
                  <span className="ia-stat-lbl">Approved</span>
                </div>
                <div className="ia-stat-chip ia-stat-rejected">
                  <span className="ia-stat-num">{counts.rejected}</span>
                  <span className="ia-stat-lbl">Rejected</span>
                </div>
              </div>
            </div>

            {/* ── Alerts ── */}
            {message && !error && (
              <div className="ia-alert ia-alert-success" role="alert">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {message}
                <button className="ia-alert-close" aria-label="Dismiss" onClick={() => setMessage("")}>&times;</button>
              </div>
            )}
            {error && (
              <div className="ia-alert ia-alert-error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                {error}
                <button className="ia-alert-close" aria-label="Dismiss" onClick={() => setError("")}>&times;</button>
              </div>
            )}

            {/* ── Status Tabs ── */}
            <div className="ia-tabs" role="tablist" aria-label="Filter by status">
              {(["all", "pending", "approved", "rejected"] as const).map((s) => {
                const labels: Record<string, string> = {
                  all: "All Applications",
                  pending: "Pending",
                  approved: "Approved",
                  rejected: "Rejected",
                };
                return (
                  <a
                    key={s}
                    href={tabHrefs[s]}
                    className={statusFilter === s ? "ia-tab ia-tab--active" : "ia-tab"}
                    role="tab"
                    aria-selected={statusFilter === s ? "true" : "false"}
                  >
                    {labels[s]}
                    <span className="ia-tab-count">{s === "all" ? counts.pending + counts.approved + counts.rejected : counts[s as keyof Omit<typeof counts, "all">]}</span>
                  </a>
                );
              })}
            </div>

            {/* ── Search & Filters ── */}
            <div className="ia-filters-wrap">
              <form
                method="get"
                action={PAGE_PATH}
                className="ia-filters-form"
                id="filtersForm"
                ref={searchFormRef}
              >
                <input type="hidden" name="status" value={statusFilter} />

                {/* Search */}
                <div className="ia-search-group">
                  <svg className="ia-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <input
                    type="text"
                    name="search"
                    className="ia-search-input"
                    placeholder="Search name, email or subject…"
                    defaultValue={searchFilter}
                    autoComplete="off"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      className="ia-search-clear js-search-clear"
                      aria-label="Clear search"
                      onClick={() => {
                        const input = searchFormRef.current?.querySelector<HTMLInputElement>('[name=search]');
                        if (input) input.value = "";
                        searchFormRef.current?.submit();
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Advanced filters toggle */}
                <button
                  type="button"
                  className={`ia-btn ia-btn-outline ia-filter-toggle${filtersOpen ? " ia-filter-toggle--active" : ""}`}
                  id="filterToggle"
                  aria-expanded={filtersOpen ? "true" : "false"}
                  aria-controls="advFilters"
                  onClick={() => setFiltersOpen((o) => !o)}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                  Filters
                  {activeFilterCount > 0 && <span className="ia-filter-badge">{activeFilterCount}</span>}
                </button>

                <button type="submit" className="ia-btn ia-btn-primary">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  Search
                </button>
              </form>

              {/* Advanced filters panel */}
              <div className="ia-adv-filters" id="advFilters" style={{ display: filtersOpen ? "grid" : "none" }}>
                <form method="get" action={PAGE_PATH} className="ia-adv-form">
                  <input type="hidden" name="status" value={statusFilter} />
                  {searchFilter && <input type="hidden" name="search" value={searchFilter} />}

                  <div className="ia-adv-field">
                    <label className="ia-label" htmlFor="subjectFilter">Subject</label>
                    <input type="text" id="subjectFilter" name="subject" className="ia-input" placeholder="e.g. Python, Design…" defaultValue={subjectFilter} />
                  </div>

                  <div className="ia-adv-field">
                    <label className="ia-label" htmlFor="educFilter">Education Level</label>
                    <select id="educFilter" name="education" className="ia-input" defaultValue={educFilter}>
                      <option value="">All Levels</option>
                      {educLevels.map((el) => (
                        <option key={el} value={el}>{el}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ia-adv-field">
                    <label className="ia-label" htmlFor="dateFrom">From Date</label>
                    <input type="date" id="dateFrom" name="date_from" className="ia-input" defaultValue={dateFrom} />
                  </div>

                  <div className="ia-adv-field">
                    <label className="ia-label" htmlFor="dateTo">To Date</label>
                    <input type="date" id="dateTo" name="date_to" className="ia-input" defaultValue={dateTo} />
                  </div>

                  <div className="ia-adv-field ia-adv-field--actions">
                    <button type="submit" className="ia-btn ia-btn-primary">Apply</button>
                    <a href={resetHref} className="ia-btn ia-btn-ghost">Reset</a>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Bulk bar ── */}
            <div className={selected.length ? "ia-bulk-bar ia-bulk-bar--visible" : "ia-bulk-bar"} id="bulkBar" aria-hidden={selected.length === 0 ? "true" : "false"}>
              <span className="ia-bulk-info">
                <span id="bulkCount">{selected.length}</span> application(s) selected
              </span>
              <div className="ia-bulk-actions">
                <form method="post" action={API_PATH} id="bulkApproveForm" ref={bulkFormRef}>
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="action" value={bulkAction} />
                  <div id="bulkApproveIds">
                    {selected.map((id) => (
                      <input key={id} type="hidden" name="selected_ids[]" value={id} />
                    ))}
                  </div>
                  <button type="button" className="ia-btn ia-btn-success ia-btn-sm js-bulk-approve" onClick={() => submitBulk("bulk_approve")}>
                    ✓ Approve Selected
                  </button>
                </form>
                <button type="button" className="ia-btn ia-btn-danger ia-btn-sm js-bulk-reject" onClick={openBulkRejectModal}>
                  ✕ Reject Selected
                </button>
                <button type="button" className="ia-btn ia-btn-ghost ia-btn-sm js-clear-selection" onClick={clearSelection}>
                  Cancel
                </button>
              </div>
            </div>

            {/* ── Table Card ── */}
            <div className="ia-card">
              {/* Table toolbar */}
              <div className="ia-table-toolbar">
                <div className="ia-results-info">
                  {totalCount !== "0" ? (
                    <>
                      Showing <strong>{rangeFrom}–{rangeTo}</strong>
                      of <strong>{totalCount}</strong> applications
                    </>
                  ) : (
                    "No applications found"
                  )}
                </div>
                <div className="ia-toolbar-right">
                  <label className="ia-per-page-label" htmlFor="perPageSelect">Per page:</label>
                  <select
                    id="perPageSelect"
                    className="ia-per-page-select"
                    value={perPage}
                    onChange={(e) => changePerPage(e.target.value)}
                  >
                    {[10, 20, 50, 100].map((pp) => (
                      <option key={pp} value={pp}>{pp}</option>
                    ))}
                  </select>
                </div>
              </div>

              {rows.length === 0 ? (
                /* Empty state */
                <div className="ia-empty">
                  <div className="ia-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h3 className="ia-empty-title">No applications found</h3>
                  <p className="ia-empty-desc">
                    {hasAnyFilter ? (
                      "Try adjusting your search or filter criteria."
                    ) : (
                      <>There are no {statusFilter !== "all" ? statusFilter : ""} applications at the moment.</>
                    )}
                  </p>
                  {hasAnyFilter && (
                    <a href={resetHref} className="ia-btn ia-btn-outline" style={{ marginTop: "1rem" }}>Clear Filters</a>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="ia-table-wrap">
                    <table className="ia-table" id="applicationsTable">
                      <thead>
                        <tr>
                          <th className="ia-th-check">
                            <input
                              type="checkbox"
                              id="selectAll"
                              className="ia-checkbox"
                              aria-label="Select all"
                              checked={selectAllChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = selectAllIndeterminate;
                              }}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th className="ia-th-id">#</th>
                          <th>
                            <a href={sortHrefs.applicant_name} className="ia-sort-link">
                              Applicant {sortIcon("applicant_name")}
                            </a>
                          </th>
                          <th>
                            <a href={sortHrefs.primary_subject} className="ia-sort-link">
                              Subject {sortIcon("primary_subject")}
                            </a>
                          </th>
                          <th>
                            <a href={sortHrefs.highest_education} className="ia-sort-link">
                              Education {sortIcon("highest_education")}
                            </a>
                          </th>
                          <th>
                            <a href={sortHrefs.years_exp} className="ia-sort-link">
                              Experience {sortIcon("years_exp")}
                            </a>
                          </th>
                          <th>
                            <a href={sortHrefs.submitted_at} className="ia-sort-link">
                              Submitted {sortIcon("submitted_at")}
                            </a>
                          </th>
                          <th>
                            <a href={sortHrefs.status} className="ia-sort-link">
                              Status {sortIcon("status")}
                            </a>
                          </th>
                          <th className="ia-th-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((app) => (
                          <tr
                            key={app.id}
                            className="ia-row"
                            data-id={app.id}
                            data-status={app.status}
                            style={{ cursor: "pointer" }}
                            onClick={(e) => onRowClick(e, app.id)}
                          >
                            <td className="ia-td-check">
                              {app.status === "pending" && (
                                <input
                                  type="checkbox"
                                  className="ia-checkbox ia-row-check"
                                  value={app.id}
                                  aria-label={`Select application from ${app.applicantName}`}
                                  checked={selectedSet.has(app.id)}
                                  onChange={() => toggleRow(app.id)}
                                />
                              )}
                            </td>
                            <td className="ia-td-id">{app.id}</td>
                            <td className="ia-td-applicant">
                              <div className="ia-applicant">
                                <div className="ia-avatar" style={{ background: app.avatarColor }} aria-hidden="true">
                                  {app.profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={app.profileImage} alt={app.applicantName} />
                                  ) : (
                                    app.initials
                                  )}
                                </div>
                                <div className="ia-applicant-info">
                                  <span className="ia-applicant-name">{app.applicantName}</span>
                                  <span className="ia-applicant-email">{app.applicantEmail}</span>
                                  {!app.isEmailVerified && (
                                    <span className="ia-badge ia-badge-xs ia-badge-orange" title="Email not verified">⚠ Unverified</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="ia-td-subject">
                              <span className="ia-subject-name">{app.primarySubject}</span>
                              {app.skillLevel && <span className="ia-subject-level">{app.skillLevel}</span>}
                            </td>
                            <td className="ia-td-education">{app.highestEducation}</td>
                            <td className="ia-td-exp">
                              <span className="ia-exp-badge">{app.expLabel}</span>
                            </td>
                            <td className="ia-td-date">
                              <span className="ia-date-primary">{app.submittedDate}</span>
                              <span className="ia-date-secondary">{app.timeAgo}</span>
                            </td>
                            <td className="ia-td-status">
                              <span className={`ia-badge ${STATUS_BADGES[app.status] ?? "badge-info"}`}>
                                {ucfirst(app.status)}
                              </span>
                              {app.status === "rejected" && app.rejectionReason && (
                                <button
                                  className="ia-reason-btn js-reason-btn"
                                  data-reason={app.rejectionReason}
                                  title="View rejection reason"
                                  aria-label="View rejection reason"
                                  onClick={() => openReasonModal(app.rejectionReason)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                                </button>
                              )}
                            </td>
                            <td className="ia-td-actions">
                              <div className="ia-actions">
                                <a
                                  href={`/admin/instructor-application-detail?id=${app.id}`}
                                  className="ia-btn ia-btn-outline ia-btn-sm"
                                  title="View full application"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>
                                  View
                                </a>

                                {app.status === "pending" ? (
                                  <>
                                    <form
                                      method="post"
                                      action={API_PATH}
                                      className="ia-inline-form"
                                      data-confirm-action="approve"
                                      data-confirm-name={app.applicantName}
                                      onSubmit={(e) => {
                                        if (!window.confirm(`Approve application from "${app.applicantName}"?`)) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <input type="hidden" name="csrf_token" value={csrfToken} />
                                      <input type="hidden" name="application_id" value={app.id} />
                                      <input type="hidden" name="action" value="approve" />
                                      <button type="submit" className="ia-btn ia-btn-success ia-btn-sm" title="Approve application">
                                        <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        Approve
                                      </button>
                                    </form>
                                    <button
                                      className="ia-btn ia-btn-danger ia-btn-sm js-reject-btn"
                                      title="Reject application"
                                      data-app-id={app.id}
                                      data-app-name={app.applicantName}
                                      onClick={() => openRejectModal(app.id, app.applicantName)}
                                    >
                                      <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                                      Reject
                                    </button>
                                  </>
                                ) : app.status === "approved" ? (
                                  <a href={`/admin/users?id=${app.userId}`} className="ia-btn ia-btn-ghost ia-btn-sm" title="View instructor profile">
                                    <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" /></svg>
                                    Profile
                                  </a>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="ia-mobile-list" id="mobileList">
                    {rows.map((app) => (
                      <div className="ia-mobile-card" key={app.id}>
                        <div className="ia-mobile-card-header">
                          <div className="ia-applicant">
                            <div className="ia-avatar ia-avatar--sm" style={{ background: app.avatarColor }}>
                              {app.initials}
                            </div>
                            <div className="ia-applicant-info">
                              <span className="ia-applicant-name">{app.applicantName}</span>
                              <span className="ia-applicant-email">{app.applicantEmail}</span>
                            </div>
                          </div>
                          <span className={`ia-badge ${STATUS_BADGES[app.status] ?? ""}`}>{ucfirst(app.status)}</span>
                        </div>
                        <div className="ia-mobile-card-body">
                          <div className="ia-mobile-meta">
                            <span><strong>Subject:</strong> {app.primarySubject}</span>
                            <span><strong>Education:</strong> {app.highestEducation}</span>
                            <span><strong>Submitted:</strong> {app.submittedDate}</span>
                          </div>
                        </div>
                        <div className="ia-mobile-card-footer">
                          <a href={`/admin/instructor-application-detail?id=${app.id}`} className="ia-btn ia-btn-outline ia-btn-sm">View</a>
                          {app.status === "pending" && (
                            <>
                              <form
                                method="post"
                                action={API_PATH}
                                className="ia-inline-form"
                                data-confirm-action="approve"
                                data-confirm-name={app.applicantName}
                                onSubmit={(e) => {
                                  if (!window.confirm(`Approve application from "${app.applicantName}"?`)) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                <input type="hidden" name="csrf_token" value={csrfToken} />
                                <input type="hidden" name="application_id" value={app.id} />
                                <input type="hidden" name="action" value="approve" />
                                <button type="submit" className="ia-btn ia-btn-success ia-btn-sm">✓ Approve</button>
                              </form>
                              <button
                                className="ia-btn ia-btn-danger ia-btn-sm js-reject-btn"
                                data-app-id={app.id}
                                data-app-name={app.applicantName}
                                onClick={() => openRejectModal(app.id, app.applicantName)}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <nav className="ia-pagination" aria-label="Page navigation">
                {pageTokens.map((token, i) => {
                  if (token.kind === "prev") {
                    return (
                      <a key={i} href={token.href} className="ia-page-btn" aria-label="Previous page">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    );
                  }
                  if (token.kind === "next") {
                    return (
                      <a key={i} href={token.href} className="ia-page-btn" aria-label="Next page">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    );
                  }
                  if (token.kind === "ellipsis") {
                    return <span key={i} className="ia-page-ellipsis">…</span>;
                  }
                  return token.active ? (
                    <span key={i} className="ia-page-btn ia-page-btn--active" aria-current="page">{token.label}</span>
                  ) : (
                    <a key={i} href={token.href} className="ia-page-btn">{token.label}</a>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </main>

      {/* ═══════════════════ MODALS ═══════════════════ */}

      {/* Single Reject Modal */}
      <div className={rejectApp ? "ia-modal-overlay ia-modal-overlay--open" : "ia-modal-overlay"} id="rejectModal" role="dialog" aria-modal="true" aria-labelledby="rejectModalTitle">
        <div
          className="ia-modal"
          ref={(el) => {
            if (rejectApp) focusFirst(el);
          }}
        >
          <div className="ia-modal-header">
            <h3 className="ia-modal-title" id="rejectModalTitle">Reject Application</h3>
            <button className="ia-modal-close js-close-modal" data-modal-id="rejectModal" aria-label="Close modal" onClick={() => setRejectApp(null)}>&times;</button>
          </div>
          <p className="ia-modal-desc" id="rejectModalDesc">
            {rejectApp ? `Rejecting application from ${rejectApp.name}. A reason will be emailed to the applicant.` : ""}
          </p>
          <form method="post" action={API_PATH} id="rejectForm">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="application_id" id="rejectAppId" value={rejectApp?.id ?? ""} />
            <input type="hidden" name="action" value="reject" />
            <div className="ia-modal-field">
              <label className="ia-label" htmlFor="rejectReason">Rejection Reason</label>
              <textarea
                id="rejectReason"
                name="rejection_reason"
                className="ia-textarea"
                placeholder="e.g. Incomplete credentials, does not meet quality standards, insufficient experience…"
                rows={4}
              />
              <p className="ia-field-hint">Leave blank to reject without a reason message.</p>
            </div>
            <div className="ia-modal-actions">
              <button type="button" className="ia-btn ia-btn-ghost" data-close-modal="rejectModal" onClick={() => setRejectApp(null)}>Cancel</button>
              <button type="submit" className="ia-btn ia-btn-danger">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bulk Reject Modal */}
      <div className={bulkRejectOpen ? "ia-modal-overlay ia-modal-overlay--open" : "ia-modal-overlay"} id="bulkRejectModal" role="dialog" aria-modal="true" aria-labelledby="bulkRejectTitle">
        <div
          className="ia-modal"
          ref={(el) => {
            if (bulkRejectOpen) focusFirst(el);
          }}
        >
          <div className="ia-modal-header">
            <h3 className="ia-modal-title" id="bulkRejectTitle">Bulk Reject Applications</h3>
            <button className="ia-modal-close" data-close-modal="bulkRejectModal" aria-label="Close modal" onClick={() => setBulkRejectOpen(false)}>&times;</button>
          </div>
          <p className="ia-modal-desc" id="bulkRejectDesc">
            Rejecting <strong id="bulkRejectCount">{selected.length}</strong> selected application(s).
          </p>
          <form method="post" action={API_PATH} id="bulkRejectForm">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="action" value="bulk_reject" />
            <div id="bulkRejectIds">
              {selected.map((id) => (
                <input key={id} type="hidden" name="selected_ids[]" value={id} />
              ))}
            </div>
            <div className="ia-modal-field">
              <label className="ia-label" htmlFor="bulkRejectReason">Rejection Reason (applied to all)</label>
              <textarea id="bulkRejectReason" name="bulk_rejection_reason" className="ia-textarea" placeholder="Optional shared reason…" rows={3} />
            </div>
            <div className="ia-modal-actions">
              <button type="button" className="ia-btn ia-btn-ghost" data-close-modal="bulkRejectModal" onClick={() => setBulkRejectOpen(false)}>Cancel</button>
              <button type="submit" className="ia-btn ia-btn-danger">Reject All Selected</button>
            </div>
          </form>
        </div>
      </div>

      {/* Reason View Modal */}
      <div className={reasonView !== null ? "ia-modal-overlay ia-modal-overlay--open" : "ia-modal-overlay"} id="reasonModal" role="dialog" aria-modal="true" aria-labelledby="reasonModalTitle">
        <div className="ia-modal ia-modal--sm">
          <div className="ia-modal-header">
            <h3 className="ia-modal-title" id="reasonModalTitle">Rejection Reason</h3>
            <button className="ia-modal-close" data-close-modal="reasonModal" aria-label="Close modal" onClick={() => setReasonView(null)}>&times;</button>
          </div>
          <p className="ia-reason-text" id="reasonText">{reasonView ?? ""}</p>
          <div className="ia-modal-actions ia-modal-actions--right">
            <button type="button" className="ia-btn ia-btn-primary" data-close-modal="reasonModal" onClick={() => setReasonView(null)}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}