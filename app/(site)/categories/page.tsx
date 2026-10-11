import type { Metadata } from "next";
// categories.php loads base.css -> student/dashboard.css -> categories.css -> navbar.css.
// student/dashboard.css contributes 7 matching rules here (hero/banner + button spacing).
// navbar.css comes from app/(site)/layout.tsx.
import "@/styles/css/student/dashboard.css";
import "@/styles/css/categories.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { sql } from "@/lib/db/client";
import CategoriesClient from "./CategoriesClient";
import { siteUrl } from "@/lib/format";
export const metadata: Metadata = pageMetadata({
  title: "Course Categories - Edulari",
  description: "Explore course categories on Edulari - from programming and design to business and data science. Find expert-led courses in your area of interest.",
  path: "/categories",
  keywords: "course categories, browse topics, programming courses, design courses, business courses",
});

type CategoryRow = {
  id: number; name: string; slug: string; description: string | null;
  published_count: number; total_count: number; student_count: number; avg_rating: number | null;
};

const PALETTES = [
  { from: "#6c63ff", to: "#8b5cf6", light: "#ede9fe", text: "#5449e6" },
  { from: "#10b981", to: "#059669", light: "#d1fae5", text: "#065f46" },
  { from: "#f59e0b", to: "#d97706", light: "#fef3c7", text: "#92400e" },
  { from: "#3b82f6", to: "#2563eb", light: "#dbeafe", text: "#1e40af" },
  { from: "#ec4899", to: "#db2777", light: "#fce7f3", text: "#9d174d" },
  { from: "#14b8a6", to: "#0d9488", light: "#ccfbf1", text: "#115e59" },
  { from: "#f97316", to: "#ea580c", light: "#ffedd5", text: "#9a3412" },
  { from: "#8b5cf6", to: "#7c3aed", light: "#ede9fe", text: "#4c1d95" },
  { from: "#06b6d4", to: "#0891b2", light: "#cffafe", text: "#164e63" },
  { from: "#ef4444", to: "#dc2626", light: "#fee2e2", text: "#991b1b" },
  { from: "#84cc16", to: "#65a30d", light: "#f7fee7", text: "#365314" },
  { from: "#a78bfa", to: "#7c3aed", light: "#f3e8ff", text: "#5b21b6" },
];

const ICONS = [
  "M16 18l6-6-6-6M8 6l-6 6 6 6",
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "M18 20V10M12 20V4M6 20v-6",
  "M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586",
  "M9 18V5l12-2v13",
  "M9 3H15M9 3V14L4 21H20L15 14V3",
  "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z",
  "M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20",
  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  "M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h4M1 14h4",
  "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
];

export default async function CategoriesPage() {
  const categories = await sql<CategoryRow[]>`
    SELECT c.id, c.name, c.slug, c.description,
           (SELECT COUNT(*) FROM courses WHERE category_id = c.id AND is_published = true) AS published_count,
           (SELECT COUNT(*) FROM courses WHERE category_id = c.id) AS total_count,
           (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e JOIN courses co ON co.id = e.course_id WHERE co.category_id = c.id) AS student_count,
           (SELECT AVG(cr.rating) FROM course_reviews cr JOIN courses co ON co.id = cr.course_id WHERE co.category_id = c.id) AS avg_rating
    FROM categories c ORDER BY c.name ASC
  `;

  const stats = await sql<{ total_categories: string; total_courses: string; total_students: string; total_instructors: string }[]>`
    SELECT
      (SELECT COUNT(*)::text FROM categories) AS total_categories,
      (SELECT COUNT(*)::text FROM courses WHERE is_published = true) AS total_courses,
      (SELECT COUNT(*)::text FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*)::text FROM users WHERE role = 'instructor') AS total_instructors
  `;

  const s = stats[0] ?? { total_categories: "0", total_courses: "0", total_students: "0", total_instructors: "0" };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Categories", item: siteUrl("/categories") },
    ],
  };

  return (
    <main className="cats-page" id="catsPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <section className="cats-hero" aria-label="Categories hero">
        <div className="cats-hero-inner">
          <div className="cats-hero-text">
            <span className="cats-hero-badge">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" /></svg>
              {Number(s.total_categories).toLocaleString()} Categories Available
            </span>
            <h1 className="cats-hero-title">Explore Learning<br /><span className="cats-hero-accent">Categories</span></h1>
            <p className="cats-hero-sub">Discover your passion. Browse {Number(s.total_categories).toLocaleString()} expertly curated categories covering {Number(s.total_courses).toLocaleString()}+ courses across every discipline.</p>
          </div>
          <div className="cats-search-wrap" role="search" aria-label="Search categories">
            <div className="cats-search-box">
              <svg className="cats-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input type="text" id="catSearchInput" className="cats-search-input" placeholder="Search categories…" autoComplete="off" spellCheck={false} aria-label="Search categories" />
              <button type="button" className="cats-search-clear" id="catSearchClear" aria-label="Clear search" style={{ display: "none" }}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <p className="cats-search-hint" id="catSearchHint" aria-live="polite"></p>
          </div>
          <div className="cats-stats-strip">
            <div className="cats-stat"><span className="cats-stat-num">{Number(s.total_categories).toLocaleString()}</span><span className="cats-stat-lbl">Categories</span></div>
            <div className="cats-stat-div" aria-hidden="true"></div>
            <div className="cats-stat"><span className="cats-stat-num">{Number(s.total_courses).toLocaleString()}+</span><span className="cats-stat-lbl">Courses</span></div>
            <div className="cats-stat-div" aria-hidden="true"></div>
            <div className="cats-stat"><span className="cats-stat-num">{Number(s.total_students).toLocaleString()}+</span><span className="cats-stat-lbl">Students</span></div>
            <div className="cats-stat-div" aria-hidden="true"></div>
            <div className="cats-stat"><span className="cats-stat-num">{Number(s.total_instructors).toLocaleString()}+</span><span className="cats-stat-lbl">Instructors</span></div>
          </div>
        </div>
      </section>

      <CategoriesClient categories={JSON.parse(JSON.stringify(categories))} palettes={PALETTES} icons={ICONS} />

      <section className="cats-cta" aria-label="Call to action">
        <div className="cats-cta-inner">
          <div className="cats-cta-text">
            <h2 className="cats-cta-title">Can&apos;t find what you&apos;re looking for?</h2>
            <p className="cats-cta-sub">Browse our full course catalog with advanced filters — by level, price, rating, and more.</p>
          </div>
          <div className="cats-cta-btns">
            <a href="/browse-courses" className="cats-cta-btn cats-cta-btn--primary">Browse All Courses</a>
            <a href="/register" className="cats-cta-btn cats-cta-btn--secondary">Sign Up Free</a>
          </div>
        </div>
      </section>
    </main>
  );
}
