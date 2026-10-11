"use client";

import { useRouter } from "next/navigation";

type Category = { id: number; name: string; slug: string };

type Props = {
  categories: Category[];
  category: string;
  level: string;
  price: string;
  search: string;
  sort: string;
  view: string;
  total: number;
  searchParams: Record<string, string | undefined>;
  children: React.ReactNode;
};

export default function BrowseControls({ categories, category, level, price, search, sort, view, total, searchParams, children }: Props) {
  const router = useRouter();

  const navigate = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    mutate(params);
    params.delete("page");
    router.push("/browse-courses?" + params.toString());
  };

  const submitFilters = () => {
    const form = document.getElementById("filterForm") as HTMLFormElement | null;
    form?.submit();
  };

  const viewUrl = (v: string) => {
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(searchParams)) {
      if (val) params.set(k, val);
    }
    params.set("view", v);
    params.set("page", "1");
    return "/browse-courses?" + params.toString();
  };

  return (
    <>
      <aside className="bc-filters" id="filtersPanel">
        <div className="bc-filters-hd">
          <span className="bc-filters-hd-title">Filters</span>
          <button type="button" className="bc-filter-close-btn" id="filterClose" aria-label="Close filters">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <a href="/browse-courses" className="bc-clear-link">Clear all</a>
        </div>
        <form method="get" id="filterForm" action="/browse-courses">
          {search ? <input type="hidden" name="search" value={search} /> : null}
          <div className="bc-filter-group">
            <button type="button" className="bc-fg-toggle" aria-expanded="true"><span>Category</span></button>
            <div className="bc-fg-body">
              <label className="bc-radio-item"><input type="radio" name="category" value="" defaultChecked={!category} onChange={submitFilters} /><span>All Categories</span></label>
              {categories.map((cat) => (
                <label key={cat.id} className="bc-radio-item"><input type="radio" name="category" value={cat.slug} defaultChecked={category === cat.slug} onChange={submitFilters} /><span>{cat.name}</span></label>
              ))}
            </div>
          </div>
          <div className="bc-filter-group">
            <button type="button" className="bc-fg-toggle" aria-expanded="true"><span>Level</span></button>
            <div className="bc-fg-body">
              {(["beginner", "intermediate", "advanced"] as const).map((val) => (
                <label key={val} className="bc-check-item">
                  <input
                    type="checkbox"
                    name="level"
                    value={val}
                    defaultChecked={level === val}
                    onChange={() => navigate((p) => { if (level === val) p.delete("level"); else p.set("level", val); })}
                  />
                  <span className={`bc-level-dot bc-level-dot--${val}`} />
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className="bc-filter-group">
            <button type="button" className="bc-fg-toggle" aria-expanded="true"><span>Price</span></button>
            <div className="bc-fg-body">
              <label className="bc-radio-item"><input type="radio" name="price" value="" defaultChecked={!price} onChange={submitFilters} /><span>All Prices</span></label>
              <label className="bc-radio-item"><input type="radio" name="price" value="free" defaultChecked={price === "free"} onChange={submitFilters} /><span>Free Only</span></label>
              <label className="bc-radio-item"><input type="radio" name="price" value="paid" defaultChecked={price === "paid"} onChange={submitFilters} /><span>Paid Only</span></label>
            </div>
          </div>
          <button type="submit" className="bc-apply-filters-btn">Apply Filters</button>
        </form>
      </aside>

      <div className="bc-filter-overlay" id="filterOverlay" />

      <section className="bc-results">
        <div className="bc-toolbar">
          <div className="bc-toolbar-left">
            <button type="button" className="bc-filter-toggle-btn" id="filterToggle">Filters</button>
            <p className="bc-result-count"><strong>{total}</strong> course{total !== 1 ? "s" : ""}</p>
          </div>
          <div className="bc-toolbar-right">
            <div className="bc-sort">
              <label htmlFor="sortSelect" className="bc-sort-label">Sort by</label>
              <select
                id="sortSelect"
                className="bc-sort-select"
                defaultValue={sort}
                onChange={(e) => router.push("/browse-courses?" + (() => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") p.set(k, v); p.set("sort", e.target.value); return p.toString(); })())}
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="title">A to Z</option>
              </select>
            </div>
            <div className="bc-view-btns">
              <a href={viewUrl("grid")} className={`bc-view-btn ${view === "grid" ? "bc-view-btn--active" : ""}`} title="Grid view" aria-label="Grid view">▦</a>
              <a href={viewUrl("list")} className={`bc-view-btn ${view === "list" ? "bc-view-btn--active" : ""}`} title="List view" aria-label="List view">☰</a>
            </div>
          </div>
        </div>

        {children}
      </section>
    </>
  );
}
