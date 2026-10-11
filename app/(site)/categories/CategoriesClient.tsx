"use client";

import { useState, useMemo } from "react";

type Category = {
  id: number; name: string; slug: string; description: string | null;
  published_count: number; total_count: number; student_count: number; avg_rating: number | null;
};

type Palette = { from: string; to: string; light: string; text: string };

export default function CategoriesClient({ categories, palettes, icons }: { categories: Category[]; palettes: Palette[]; icons: string[] }) {
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(20);

  const filtered = useMemo(() => {
    let pool = categories.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesQ = !q || c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
      const firstLetter = c.name.charAt(0).toUpperCase();
      const matchesL = letter === "all" || firstLetter === letter;
      return matchesQ && matchesL;
    });
    pool = [...pool].sort((a, b) => {
      switch (sort) {
        case "name-desc": return b.name.localeCompare(a.name);
        case "courses-desc": return b.published_count - a.published_count;
        case "courses-asc": return a.published_count - b.published_count;
        case "students-desc": return b.student_count - a.student_count;
        default: return a.name.localeCompare(b.name);
      }
    });
    return pool;
  }, [categories, search, letter, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((L) => categories.some((c) => c.name.charAt(0).toUpperCase() === L));

  return (
    <>
      <div className="cats-toolbar-wrap">
        <div className="cats-toolbar">
          <div className="cats-toolbar-left">
            <p className="cats-result-count" id="catResultCount" aria-live="polite"><strong>{filtered.length}</strong> categories</p>
            <div className="cats-sort-wrap">
              <label htmlFor="catSort" className="cats-sort-lbl">Sort:</label>
              <select id="catSort" className="cats-sort-select" value={sort} onChange={(e) => { setSort(e.target.value); setVisibleCount(20); }}>
                <option value="name-asc">A → Z</option>
                <option value="name-desc">Z → A</option>
                <option value="courses-desc">Most Courses</option>
                <option value="courses-asc">Fewest Courses</option>
                <option value="students-desc">Most Students</option>
              </select>
            </div>
          </div>
          <div className="cats-toolbar-right">
            <div className="cats-view-toggle" role="group" aria-label="View mode">
              <button className={`cats-view-btn ${view === "grid" ? "cats-view-btn--active" : ""}`} id="viewGrid" data-view="grid" title="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
              <button className={`cats-view-btn ${view === "list" ? "cats-view-btn--active" : ""}`} id="viewList" data-view="list" title="List view" aria-pressed={view === "list"} onClick={() => setView("list")}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" /></svg>
              </button>
            </div>
          </div>
        </div>
        <div className="cats-alpha-wrap" role="group" aria-label="Filter by first letter">
          <button className={`cats-alpha-btn ${letter === "all" ? "cats-alpha-btn--active" : ""}`} data-letter="all" onClick={() => { setLetter("all"); setVisibleCount(20); }}>All</button>
          {letters.map((L) => (
            <button key={L} className={`cats-alpha-btn ${letter === L ? "cats-alpha-btn--active" : ""}`} data-letter={L} onClick={() => { setLetter(L); setVisibleCount(20); }}>{L}</button>
          ))}
        </div>
      </div>

      <section className="cats-body" aria-label="Course categories">
        <div className="cats-container">
          {filtered.length === 0 ? (
            <div className="cats-empty" id="catEmpty" aria-live="polite">
              <div className="cats-empty-icon"><svg viewBox="0 0 24 24" fill="none" width="48" height="48"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>
              <h3 className="cats-empty-title">No categories found</h3>
              <p className="cats-empty-text">Try a different search term or browse all categories.</p>
              <button type="button" className="cats-empty-btn" id="catResetBtn" onClick={() => { setSearch(""); setLetter("all"); setVisibleCount(20); }}>Show All Categories</button>
            </div>
          ) : (
            <>
              <div className={`cats-grid ${view === "list" ? "cats-grid--list" : ""}`} id="catGrid" role="list">
                {visible.map((cat, i) => {
                  const palette = palettes[i % palettes.length];
                  const icon = icons[i % icons.length];
                  const rating = cat.avg_rating ? Math.round(cat.avg_rating * 10) / 10 : null;
                  return (
                    <article key={cat.id} className="cat-card" role="listitem" data-name={cat.name.toLowerCase()} data-desc={(cat.description ?? "").toLowerCase()} data-letter={cat.name.charAt(0).toUpperCase()} data-courses={cat.published_count} data-students={cat.student_count} style={{ ["--cat-from" as string]: palette.from, ["--cat-to" as string]: palette.to, ["--cat-light" as string]: palette.light, ["--cat-text" as string]: palette.text } as React.CSSProperties}>
                      <a href={`/category/${cat.slug}`} className="cat-card-link" aria-label={`Browse ${cat.name} courses`}>
                        <div className="cat-card-header">
                          <div className="cat-card-icon"><svg viewBox="0 0 24 24" fill="none" dangerouslySetInnerHTML={{ __html: icon }} /></div>
                          <div className="cat-card-deco" aria-hidden="true"></div>
                        </div>
                        <div className="cat-card-body">
                          <h3 className="cat-card-name">{cat.name}</h3>
                          <p className={`cat-card-desc ${!cat.description ? "cat-card-desc--empty" : ""}`}>{cat.description ? cat.description.slice(0, 90) + (cat.description.length > 90 ? "…" : "") : "Explore courses in this category"}</p>
                          <div className="cat-card-stats">
                            <span className="cat-stat-chip"><strong>{cat.published_count}</strong> {cat.published_count === 1 ? "course" : "courses"}</span>
                            {cat.student_count > 0 && <span className="cat-stat-chip"><strong>{cat.student_count}</strong> students</span>}
                            {rating && <span className="cat-stat-chip cat-stat-chip--rating">{rating.toFixed(1)}</span>}
                          </div>
                        </div>
                        <div className="cat-card-footer">
                          <span className="cat-explore-btn">Explore <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                          {cat.published_count === 0 && <span className="cat-coming-badge">Coming Soon</span>}
                          {cat.published_count > 10 && <span className="cat-popular-badge">Popular</span>}
                        </div>
                      </a>
                    </article>
                  );
                })}
              </div>
              <div className="cats-load-more-wrap" id="catLoadMoreWrap">
                {hasMore && <p className="cats-showing-label" id="catShowingLabel">Showing {visible.length} of {filtered.length} categories</p>}
                {hasMore && (
                  <button type="button" className="cats-load-more-btn" id="catLoadMoreBtn" onClick={() => setVisibleCount((c) => c + 20)}>
                    <span className="cats-lm-text">Load More Categories</span>
                    <svg className="cats-lm-icon" viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
