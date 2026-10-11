import type { Metadata } from "next";
// browse-courses.php loads these three in this order (see docs/php-stylesheet-order.json):
//   base.css -> student/dashboard.css -> student/navbar.css (absent upstream) ->
//   browse-courses.css -> navbar.css
// student/dashboard.css is real upstream and supplies 8 matching rules for this page
// (the .bc-* helpers inherit .db-* / .btn-hero / .hero-banner spacing), so omitting it
// changed spacing and button sizing here.
// navbar.css is loaded by app/(site)/layout.tsx, matching navbar.php emitting it last.
import "@/styles/css/student/dashboard.css";
import "@/styles/css/browse-courses.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { sql } from "@/lib/db/client";
import { getSessionFromRequest } from "@/lib/security/api";
import { readCsrfToken } from "@/lib/security/csrf";
import { siteUrl } from "@/lib/format";
import BrowseClient from "./BrowseClient";
import BrowseControls from "./BrowseControls";
export const metadata: Metadata = pageMetadata({
  title: "Browse Courses - Edulari",
  description: "Browse expert-led online courses on Edulari. Filter by category, level, and rating to find the right course for you.",
  path: "/browse-courses",
  keywords: "browse courses, online course catalog, find courses, edulari courses, filter courses",
});

type CourseRow = {
  id: number; title: string; slug: string; short_description: string | null; thumbnail: string | null;
  level: string; price: number; category_name: string | null; instructor_name: string | null;
  student_count: number; avg_rating: number | null; review_count: number; lesson_count: number;
};

export default async function BrowseCoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [user, csrfToken] = await Promise.all([getSessionFromRequest(), readCsrfToken()]);

  const category = sp.category ?? "";
  const level = sp.level ?? "";
  const price = sp.price ?? "";
  const search = sp.search ?? "";
  const sort = sp.sort ?? "newest";
  const view = sp.view === "list" ? "list" : "grid";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const limit = 12;
  const offset = (page - 1) * limit;

  const conds = [sql`c.is_published = true`];
  if (category) {
    conds.push(sql`c.category_id = (SELECT id FROM categories WHERE slug = ${category})`);
  }
  if (level) {
    conds.push(sql`c.level = ${level}`);
  }
  if (price === "free") conds.push(sql`c.price = 0`);
  else if (price === "paid") conds.push(sql`c.price > 0`);
  if (search) {
    const like = `%${search}%`;
    conds.push(sql`(c.title ILIKE ${like} OR c.description ILIKE ${like} OR c.short_description ILIKE ${like})`);
  }

  const whereClause = sql`WHERE ${conds.reduce((acc, c) => sql`${acc} AND ${c}`)}`;
  const sortMap: Record<string, ReturnType<typeof sql.unsafe>> = {
    newest: sql`c.created_at DESC`,
    popular: sql`student_count DESC`,
    rating: sql`avg_rating DESC`,
    price_asc: sql`c.price ASC`,
    price_desc: sql`c.price DESC`,
    title: sql`c.title ASC`,
  };
  const orderBy = sortMap[sort] ?? sortMap.newest;

  const countRow = await sql<{ total: string }[]>`
    SELECT COUNT(*)::text AS total
    FROM courses c
    ${whereClause}
  `;
  const total = Number(countRow[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const courses = await sql<CourseRow[]>`
    SELECT c.id, c.title, c.slug, c.short_description, c.thumbnail, c.level, c.price,
           cat.name as category_name, u.name as instructor_name,
           (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count,
           (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating,
           (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as review_count,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const categories = await sql<{ id: number; name: string; slug: string }[]>`SELECT id, name, slug FROM categories ORDER BY name`;

  let wishlistIds: number[] = [];
  let cartIds: number[] = [];
  let enrolledIds: number[] = [];
  if (user) {
    const w = await sql<{ course_id: number }[]>`SELECT course_id FROM wishlists WHERE student_id = ${user.id}`;
    const c = await sql<{ course_id: number }[]>`SELECT course_id FROM cart WHERE student_id = ${user.id}`;
    const e = await sql<{ course_id: number }[]>`SELECT course_id FROM enrollments WHERE student_id = ${user.id}`;
    wishlistIds = w.map((r) => r.course_id);
    cartIds = c.map((r) => r.course_id);
    enrolledIds = e.map((r) => r.course_id);
  }

  // Ported from browse-courses.php: a two-level breadcrumb (Home -> Browse Courses).
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Browse Courses", item: siteUrl("/browse-courses") },
    ],
  };

  return (
    <main className="bc-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <section className="bc-hero">
        <div className="bc-hero-text">
          <h1 className="bc-hero-title">Explore Our Courses</h1>
          <p className="bc-hero-sub">Grow your skills with <strong>{total}+</strong> expert-led courses across every discipline.</p>
        </div>
        <form method="get" className="bc-hero-search" id="heroSearchForm" action="/browse-courses">
          <div className="bc-search-box">
            <svg className="bc-search-icon" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input type="text" id="searchInput" name="search" className="bc-search-input" placeholder="Search courses, topics, instructors…" defaultValue={search} autoComplete="off" />
            <button type="submit" className="bc-search-submit">Search</button>
          </div>
        </form>
      </section>

      <div className="bc-cat-pills-wrap">
        <div className="bc-cat-pills">
          <a href="/browse-courses" className={`bc-cat-pill ${!category ? "bc-cat-pill--active" : ""}`}>All</a>
          {categories.map((cat) => (
            <a key={cat.id} href={`/browse-courses?category=${cat.slug}`} className={`bc-cat-pill ${category === cat.slug ? "bc-cat-pill--active" : ""}`}>{cat.name}</a>
          ))}
        </div>
      </div>

      <div className="bc-layout">
        <BrowseControls
          categories={categories}
          category={category}
          level={level}
          price={price}
          search={search}
          sort={sort}
          view={view}
          total={total}
          searchParams={sp}
        >
          <BrowseClient courses={JSON.parse(JSON.stringify(courses))} wishlistIds={wishlistIds} cartIds={cartIds} enrolledIds={enrolledIds} userRole={user?.role ?? "guest"} view={view} page={page} totalPages={totalPages} searchParams={sp} csrfToken={csrfToken} />
        </BrowseControls>
      </div>
    </main>
  );
}
