import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";
import "@/styles/css/categories.css";
import "@/styles/css/browse-courses.css";
import { sql } from "@/lib/db/client";
import { getCategoryBySlug } from "@/lib/db/categories";
import { siteUrl } from "@/lib/format";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return pageMetadata({ title: "Category Not Found", description: "This category could not be found.", noindex: true });
  return pageMetadata({
    title: `${cat.name} Courses — Edulari`,
    description: cat.description ?? `Browse expert-led ${cat.name} courses on Edulari.`,
    path: `/category/${cat.slug}`,
    keywords: `${cat.name.toLowerCase()} courses, ${cat.name.toLowerCase()} online course, learn ${cat.name.toLowerCase()}`,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const rows = await sql<{ id: number; title: string; slug: string; short_description: string | null; thumbnail: string | null; level: string; price: number; instructor_name: string | null; avg_rating: number | null; review_count: number; lesson_count: number; student_count: number }[]>`
    SELECT c.id, c.title, c.slug, c.short_description, c.thumbnail, c.level, c.price,
           u.name as instructor_name,
           (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating,
           (SELECT COUNT(*) FROM course_reviews WHERE course_id = c.id) as review_count,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count,
           (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count
    FROM courses c LEFT JOIN users u ON c.instructor_id = u.id
    WHERE c.is_published = true AND c.category_id = ${cat.id}
    ORDER BY c.created_at DESC
  `;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Categories", item: siteUrl("/categories") },
      { "@type": "ListItem", position: 3, name: cat.name, item: siteUrl(`/category/${cat.slug}`) },
    ],
  };

  return (
    <main className="cats-page" id="catsPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <section className="cats-hero" aria-label={`${cat.name} courses`}>
        <div className="cats-hero-inner">
          <div className="cats-hero-text">
            <a href="/categories" className="cats-hero-badge">
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 12H5M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              All Categories
            </a>
            <h1 className="cats-hero-title">{cat.name}<br /><span className="cats-hero-accent">Courses</span></h1>
            <p className="cats-hero-sub">{cat.description ?? `Explore ${rows.length} expertly curated course${rows.length !== 1 ? "s" : ""} in ${cat.name}.`}</p>
          </div>
          <div className="cats-stats-strip">
            <div className="cats-stat"><span className="cats-stat-num">{rows.length}</span><span className="cats-stat-lbl">Courses</span></div>
          </div>
        </div>
      </section>

      <section className="cats-body" aria-label={`${cat.name} courses`}>
        <div className="cats-container">
          {rows.length === 0 ? (
            <div className="cats-empty">
              <h3 className="cats-empty-title">No courses yet</h3>
              <p className="cats-empty-text">Courses in this category will appear here once they&apos;re published.</p>
              <a href="/browse-courses" className="cats-empty-btn">Browse All Courses</a>
            </div>
          ) : (
            <div className="bc-courses bc-courses--grid">
              {rows.map((c) => (
                <article key={c.id} className="bc-card">
                  <a href={`/course/${c.slug}`} className="bc-card-img-link" tabIndex={-1} aria-hidden="true">
                    <div className="bc-card-img">
                      {c.thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.thumbnail} alt={c.title} loading="lazy" />
                      ) : (
                        <div className="bc-img-placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" /></svg></div>
                      )}
                      <div className="bc-img-overlay">
                        <div className="bc-badges-tl">
                          {c.price === 0 && <span className="bc-badge bc-badge--free">Free</span>}
                        </div>
                        <span className={`bc-badge bc-badge--level bc-badge--${c.level}`}>{c.level.charAt(0).toUpperCase() + c.level.slice(1)}</span>
                      </div>
                    </div>
                  </a>
                  <div className="bc-card-body">
                    <h3 className="bc-card-title"><a href={`/course/${c.slug}`}>{c.title}</a></h3>
                    <p className="bc-card-instructor">{c.instructor_name}</p>
                    <div className="bc-card-rating">
                      <span className="bc-rating-num">{c.avg_rating ? Math.round(c.avg_rating * 10) / 10 : "—"}</span>
                      <span className="bc-rating-cnt">({c.review_count})</span>
                    </div>
                    <div className="bc-card-meta">
                      <span className="bc-meta">{c.lesson_count} lessons</span>
                      <span className="bc-meta">{c.student_count} students</span>
                    </div>
                  </div>
                  <div className="bc-card-footer">
                    <div className="bc-price-wrap">
                      {c.price === 0 ? <span className="bc-price bc-price--free">Free</span> : <span className="bc-price">₹{c.price}</span>}
                    </div>
                    <div className="bc-card-btns">
                      <a href={`/course/${c.slug}`} className="bc-btn bc-btn--ghost">Details</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cats-cta" aria-label="Call to action">
        <div className="cats-cta-inner">
          <div className="cats-cta-text">
            <h2 className="cats-cta-title">Can&apos;t find what you&apos;re looking for?</h2>
            <p className="cats-cta-sub">Browse our full course catalog with advanced filters.</p>
          </div>
          <div className="cats-cta-btns">
            <a href="/browse-courses" className="cats-cta-btn cats-cta-btn--primary">Browse All Courses</a>
          </div>
        </div>
      </section>
    </main>
  );
}
