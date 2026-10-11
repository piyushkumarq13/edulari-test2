import type { Metadata } from "next";
import "@/styles/css/admin/categories.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { fetchCategories } from "@/lib/db/admin/categories";
import { phpRound } from "@/lib/format";
import CategoriesScripts from "@/components/admin/CategoriesScripts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Manage Categories — Admin Panel | Edulari",
  description: "Organise your course library with categories.",
  noindex: true,
  canonical: false,
});

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: string; dir?: string; msg?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const search = (sp.search ?? "").trim();
  const sortBy = sp.sort ?? "name";
  const sortDir = (sp.dir ?? "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
  const message = sp.msg ?? "";
  const error = sp.error ?? "";

  const [categoriesRaw, csrfToken] = await Promise.all([
    fetchCategories(search, sortBy, sortDir),
    readCsrfToken(),
  ]);
  const categories = categoriesRaw ?? [];

  const totalCategories = categories.length;
  const totalCourses = categories.reduce((sum, c) => sum + (Number(c.course_count) || 0), 0);
  const emptyCategories = categories.filter((c) => (Number(c.course_count) || 0) === 0).length;
  const avgCourses = totalCategories > 0 ? phpRound(totalCourses / totalCategories, 1) : "0";

  return (
    <main className="cat-page-wrap" id="mainContent">
      <div className="cat-page-inner">
        {/* PAGE HEADER */}
        <div className="cat-page-header">
          <div className="cat-page-title-group">
            <div className="cat-page-icon">
              <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="cat-page-title">Categories</h1>
              <p className="cat-page-subtitle">Organise your course library with categories</p>
            </div>
          </div>
          <button className="cat-btn cat-btn--primary cat-open-modal" data-modal="addModal" aria-label="Add new category">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Add Category
          </button>
        </div>

        {/* ALERTS */}
        {message ? (
          <div className="cat-alert cat-alert--success" role="alert" id="catAlert">
            <div className="cat-alert-icon">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span>{message}</span>
            <button className="cat-alert-close" aria-label="Dismiss">&times;</button>
          </div>
        ) : error ? (
          <div className="cat-alert cat-alert--error" role="alert" id="catAlert">
            <div className="cat-alert-icon">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span>{error}</span>
            <button className="cat-alert-close" aria-label="Dismiss">&times;</button>
          </div>
        ) : null}

        {/* STAT CARDS */}
        <div className="cat-stats-grid">
          <div className="cat-stat-card">
            <div className="cat-stat-icon cat-stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="cat-stat-body">
              <span className="cat-stat-value">{totalCategories}</span>
              <span className="cat-stat-label">Total Categories</span>
            </div>
          </div>
          <div className="cat-stat-card">
            <div className="cat-stat-icon cat-stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="cat-stat-body">
              <span className="cat-stat-value">{totalCourses}</span>
              <span className="cat-stat-label">Total Courses</span>
            </div>
          </div>
          <div className="cat-stat-card">
            <div className="cat-stat-icon cat-stat-icon--amber">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="cat-stat-body">
              <span className="cat-stat-value">{emptyCategories}</span>
              <span className="cat-stat-label">Empty Categories</span>
            </div>
          </div>
          <div className="cat-stat-card">
            <div className="cat-stat-icon cat-stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="cat-stat-body">
              <span className="cat-stat-value">{avgCourses}</span>
              <span className="cat-stat-label">Avg Courses / Category</span>
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="cat-toolbar">
          <form method="GET" action="/admin/categories" className="cat-search-form" role="search" aria-label="Search categories">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input className="cat-search-input" type="search" name="search" placeholder="Search categories…" defaultValue={search} aria-label="Search categories" />
              {search ? (
                <a href="/admin/categories" className="cat-search-clear" aria-label="Clear search">&times;</a>
              ) : null}
            </div>
            <input type="hidden" name="sort" value={sortBy} />
            <input type="hidden" name="dir" value={sortDir} />
            <button type="submit" className="cat-btn cat-btn--secondary">Search</button>
          </form>

          <div className="cat-toolbar-actions">
            <div className="cat-sort-group">
              <label className="cat-sort-label" htmlFor="sortSelect">Sort:</label>
              <select className="cat-select" id="sortSelect" defaultValue={`${sortBy}|${sortDir}`}>
                <option value="name|ASC">Name A–Z</option>
                <option value="name|DESC">Name Z–A</option>
                <option value="course_count|DESC">Most Courses</option>
                <option value="course_count|ASC">Fewest Courses</option>
                <option value="id|DESC">Newest First</option>
                <option value="id|ASC">Oldest First</option>
              </select>
            </div>

            <button className="cat-btn cat-btn--danger cat-bulk-delete-btn" id="bulkDeleteBtn" type="button" disabled>
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Delete Selected (<span id="selectedCount">0</span>)
            </button>
          </div>
        </div>

        {/* CATEGORY TABLE */}
        {categories.length > 0 ? (
          <div className="cat-table-wrap">
            <form method="POST" action="/api/admin/categories" id="bulkForm">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="action" value="bulk_delete" />

              <table className="cat-table" aria-label="Categories list">
                <thead>
                  <tr>
                    <th className="cat-th-check">
                      <input type="checkbox" id="selectAll" className="cat-checkbox" aria-label="Select all" />
                    </th>
                    <th>Category</th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th className="cat-th-center">Total Courses</th>
                    <th className="cat-th-center">Published</th>
                    <th className="cat-th-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const courseCount = Number(cat.course_count) || 0;
                    const publishedCount = Number(cat.published_count) || 0;
                    const catName = cat.name ?? "";
                    const catDesc = cat.description ?? "";
                    const catSlug = cat.slug ?? "";
                    const catId = cat.id;
                    return (
                      <tr className="cat-row" key={catId}>
                        <td className="cat-td-check">
                          <input type="checkbox" name="selected_ids[]" value={catId} className="cat-checkbox cat-row-check" aria-label={`Select ${catName}`} />
                        </td>
                        <td>
                          <div className="cat-name-cell">
                            <div className="cat-name-avatar">{catName.slice(0, 1).toUpperCase()}</div>
                            <div>
                              <span className="cat-name-text">{catName}</span>
                              <span className="cat-id-badge">#{catId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code className="cat-slug">{catSlug}</code>
                        </td>
                        <td className="cat-desc-cell">
                          {catDesc !== "" ? (
                            <span className="cat-desc-text" title={catDesc}>
                              {catDesc.length > 80 ? catDesc.slice(0, 80) + "…" : catDesc}
                            </span>
                          ) : (
                            <span className="cat-empty-desc">No description</span>
                          )}
                        </td>
                        <td className="cat-td-center">
                          <span className={`cat-badge cat-badge--${courseCount > 0 ? "blue" : "gray"}`}>{courseCount}</span>
                        </td>
                        <td className="cat-td-center">
                          <span className={`cat-badge cat-badge--${publishedCount > 0 ? "green" : "gray"}`}>{publishedCount}</span>
                        </td>
                        <td className="cat-td-center">
                          <div className="cat-actions">
                            <button type="button" className="cat-action-btn cat-action-btn--edit cat-open-modal" data-modal="editModal" data-id={catId} data-name={catName} data-description={catDesc} aria-label={`Edit ${catName}`}>
                              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Edit
                            </button>

                            <a href={`/admin/courses?category=${catId}`} className="cat-action-btn cat-action-btn--view" aria-label="View courses">
                              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              Courses
                            </a>

                            <button type="button" className="cat-action-btn cat-action-btn--delete cat-delete-trigger" data-id={catId} data-name={catName} data-count={courseCount} aria-label={`Delete ${catName}`}>
                              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                                <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </form>

            <div className="cat-table-footer">
              <span className="cat-table-info">
                Showing <strong>{categories.length}</strong> categor{categories.length === 1 ? "y" : "ies"}{" "}
                {search ? (
                  <>for &quot;<em>{search}</em>&quot;</>
                ) : null}
              </span>
            </div>
          </div>
        ) : (
          <div className="cat-empty">
            <div className="cat-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" width="40" height="40">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {search ? (
              <>
                <h3 className="cat-empty-title">No categories found</h3>
                <p className="cat-empty-text">No results for &quot;<strong>{search}</strong>&quot;. Try a different term.</p>
                <a href="/admin/categories" className="cat-btn cat-btn--secondary">Clear Search</a>
              </>
            ) : (
              <>
                <h3 className="cat-empty-title">No categories yet</h3>
                <p className="cat-empty-text">Get started by creating your first category to organise your courses.</p>
                <button className="cat-btn cat-btn--primary cat-open-modal" data-modal="addModal">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Create First Category
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ADD MODAL */}
      <div className="cat-modal-overlay" id="addModal" role="dialog" aria-modal="true" aria-labelledby="addModalTitle">
        <div className="cat-modal">
          <div className="cat-modal-header">
            <h2 className="cat-modal-title" id="addModalTitle">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add New Category
            </h2>
            <button className="cat-modal-close" data-close-modal="addModal" aria-label="Close">&times;</button>
          </div>
          <form method="POST" action="/api/admin/categories" className="cat-modal-body" noValidate>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="action" value="create" />

            <div className="cat-form-group">
              <label htmlFor="add_name" className="cat-label">
                Category Name <span className="cat-required">*</span>
              </label>
              <input type="text" id="add_name" name="name" className="cat-input" placeholder="e.g. Web Development" required maxLength={100} autoComplete="off" />
              <span className="cat-input-hint" id="addSlugPreview"></span>
            </div>

            <div className="cat-form-group">
              <label htmlFor="add_description" className="cat-label">Description</label>
              <textarea id="add_description" name="description" className="cat-textarea" rows={3} placeholder="Brief description of this category…" maxLength={500}></textarea>
              <span className="cat-char-count"><span id="addDescCount">0</span> / 500</span>
            </div>

            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn--ghost" data-close-modal="addModal">Cancel</button>
              <button type="submit" className="cat-btn cat-btn--primary">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Create Category
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* EDIT MODAL */}
      <div className="cat-modal-overlay" id="editModal" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
        <div className="cat-modal">
          <div className="cat-modal-header">
            <h2 className="cat-modal-title" id="editModalTitle">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit Category
            </h2>
            <button className="cat-modal-close" data-close-modal="editModal" aria-label="Close">&times;</button>
          </div>
          <form method="POST" action="/api/admin/categories" className="cat-modal-body" noValidate>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="category_id" id="edit_category_id" />

            <div className="cat-form-group">
              <label htmlFor="edit_name" className="cat-label">
                Category Name <span className="cat-required">*</span>
              </label>
              <input type="text" id="edit_name" name="name" className="cat-input" required maxLength={100} autoComplete="off" />
              <span className="cat-input-hint" id="editSlugPreview"></span>
            </div>

            <div className="cat-form-group">
              <label htmlFor="edit_description" className="cat-label">Description</label>
              <textarea id="edit_description" name="description" className="cat-textarea" rows={3} maxLength={500}></textarea>
              <span className="cat-char-count"><span id="editDescCount">0</span> / 500</span>
            </div>

            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn--ghost" data-close-modal="editModal">Cancel</button>
              <button type="submit" className="cat-btn cat-btn--primary">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* DELETE CONFIRM MODAL */}
      <div className="cat-modal-overlay" id="deleteModal" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">
        <div className="cat-modal cat-modal--sm">
          <div className="cat-modal-header cat-modal-header--danger">
            <h2 className="cat-modal-title" id="deleteModalTitle">
              <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Delete Category
            </h2>
            <button className="cat-modal-close" data-close-modal="deleteModal" aria-label="Close">&times;</button>
          </div>
          <div className="cat-modal-body">
            <p className="cat-delete-msg" id="deleteMessage">Are you sure you want to delete this category?</p>
            <div className="cat-delete-warning" id="deleteWarning" style={{ display: "none" }}>
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span id="deleteWarningText"></span>
            </div>
          </div>
          <form method="POST" action="/api/admin/categories" id="deleteForm">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="category_id" id="delete_category_id" />
            <div className="cat-modal-footer">
              <button type="button" className="cat-btn cat-btn--ghost" data-close-modal="deleteModal">Cancel</button>
              <button type="submit" className="cat-btn cat-btn--danger">
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Yes, Delete
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="cat-overlay-backdrop" id="overlayBackdrop"></div>

      <CategoriesScripts />
    </main>
  );
}
