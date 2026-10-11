import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { notFound } from "next/navigation";
// course.php order: base.css -> browse-courses.css -> course.css ->
// markdown-styles.css -> navbar.css. browse-courses.css contributes 8 matching rules
// here (the shared .bc-breadcrumb / filter-chip helpers the course page reuses).
// navbar.css comes from app/(site)/layout.tsx.
import "@/styles/css/browse-courses.css";
import "@/styles/css/course.css";
import "@/styles/css/markdown-styles.css";
import COURSE_PAGE_STYLES from "./course-page-styles";
import { sql } from "@/lib/db/client";
import { getSessionFromRequest } from "@/lib/security/api";
import { readCsrfToken } from "@/lib/security/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { siteUrl } from "@/lib/format";
// courses.price is numeric(10,2), which postgres.js returns as a string.
import { toNumber } from "@/lib/payments/amounts";
import CourseClient from "./CourseClient";
type CourseRow = {
  id: number; title: string; slug: string; description: string | null; short_description: string | null;
  thumbnail: string | null; level: string; language: string; price: number; certificate_enabled: boolean;
  category_id: number | null; category_name: string | null; instructor_id: number; instructor_name: string | null;
  avg_rating: number | null; student_count: number; updated_at: Date;
};

type SectionRow = { id: number; title: string; sort_order: number };
type LessonRow = { id: number; title: string; content_type: string; video_duration: number; is_free_preview: boolean; sort_order: number };
type ReviewRow = { id: number; student_name: string; rating: number; review_text: string | null; created_at: Date };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const rows = await sql<CourseRow[]>`SELECT id, title, slug, short_description, description, thumbnail FROM courses WHERE slug = ${slug} AND is_published = true`;
  if (rows.length === 0) return pageMetadata({ title: "Course Not Found", description: "This course could not be found.", noindex: true });
  const c = rows[0];
  const desc = c.short_description ?? c.description?.slice(0, 160) ?? "";
  const courseMetaImage = c.thumbnail ? `${siteUrl()}${c.thumbnail}` : undefined;
  return pageMetadata({
    title: `${c.title} — Edulari`,
    description: desc,
    path: `/course/${c.slug}`,
    type: "article",
    ...(courseMetaImage ? { image: courseMetaImage } : {}),
  });
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, csrfToken] = await Promise.all([getSessionFromRequest(), readCsrfToken()]);

  const courseRows = await sql<CourseRow[]>`
    SELECT c.*, cat.name as category_name, u.name as instructor_name,
           (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating,
           (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    WHERE c.slug = ${slug} AND c.is_published = true
  `;
  if (courseRows.length === 0) notFound();
  const course = courseRows[0];

  const sections = await sql<SectionRow[]>`SELECT id, title, sort_order FROM course_sections WHERE course_id = ${course.id} ORDER BY sort_order, id`;
  const lessonsBySection: Record<number, LessonRow[]> = {};
  for (const s of sections) {
    const lessons = await sql<LessonRow[]>`SELECT id, title, content_type, video_duration, is_free_preview, sort_order FROM lessons WHERE section_id = ${s.id} AND course_id = ${course.id} ORDER BY sort_order, id`;
    lessonsBySection[s.id] = lessons;
  }

  const reviews = await sql<ReviewRow[]>`SELECT r.id, u.name as student_name, r.rating, r.review_text, r.created_at FROM course_reviews r JOIN users u ON u.id = r.student_id WHERE r.course_id = ${course.id} ORDER BY r.created_at DESC LIMIT 6`;

  const myReview = user
    ? (await sql<{ rating: number; review_text: string | null }[]>`
        SELECT rating, review_text FROM course_reviews WHERE course_id = ${course.id} AND student_id = ${user.id}
      `)[0] ?? null
    : null;

  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 5; i >= 1; i--) {
    const r = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM course_reviews WHERE course_id = ${course.id} AND rating = ${i}`;
    ratingDist[i] = Number(r[0]?.count ?? 0);
  }
  const totalReviews = Object.values(ratingDist).reduce((a, b) => a + b, 0);

  const related = await sql<CourseRow[]>`
    SELECT c.id, c.title, c.slug, c.thumbnail, c.price, u.name as instructor_name,
           (SELECT AVG(rating) FROM course_reviews WHERE course_id = c.id) as avg_rating
    FROM courses c LEFT JOIN users u ON c.instructor_id = u.id
    WHERE c.is_published = true AND c.category_id = ${course.category_id} AND c.id != ${course.id}
    ORDER BY RANDOM() LIMIT 3
  `;

  const enrollment = user ? await sql<{ progress_percentage: number; completed_at: Date | null }[]>`SELECT progress_percentage, completed_at FROM enrollments WHERE student_id = ${user.id} AND course_id = ${course.id}` : [];
  const isEnrolled = enrollment.length > 0;
  const inWishlist = user ? await sql<{ id: number }[]>`SELECT id FROM wishlists WHERE student_id = ${user.id} AND course_id = ${course.id}` : [];

  const totalLessons = Object.values(lessonsBySection).reduce((a, l) => a + l.length, 0);
  const freePreviewCount = Object.values(lessonsBySection).flat().filter((l) => l.is_free_preview).length;
  const avgRating = course.avg_rating ? Math.round(course.avg_rating * 10) / 10 : 0;
  const isFree = course.price === 0;
  const isInstructor = user?.role === "instructor";

  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.short_description ?? course.description ?? "",
    url: siteUrl(`/course/${course.slug}`),
    image: course.thumbnail ?? siteUrl("/assets/images/og-default.png"),
    provider: { "@type": "Organization", name: "Edulari", url: siteUrl("") },
    instructor: { "@type": "Person", name: course.instructor_name ?? "Edulari" },
    inLanguage: "en",
    offers: { "@type": "Offer", price: toNumber(course.price).toFixed(2), priceCurrency: "INR", availability: "https://schema.org/InStock", url: siteUrl(`/course/${course.slug}`) },
    ...(totalReviews > 0 && avgRating > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(avgRating), reviewCount: String(totalReviews), bestRating: "5", worstRating: "1" } } : {}),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Courses", item: siteUrl("/browse-courses") },
      ...(course.category_name ? [{ "@type": "ListItem", position: 2, name: course.category_name, item: siteUrl(`/category/${course.category_id}`) }] : []),
      { "@type": "ListItem", position: course.category_name ? 3 : 2, name: course.title, item: siteUrl(`/course/${course.slug}`) },
    ],
  };

  const learnPoints = (course.description ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8);
  const renderedDesc = renderMarkdown(course.description ?? "");

  return (
    <div className="cp-page-wrap">
      {/* course.php writes this <style> in <head> after the stylesheet links. */}
      <style dangerouslySetInnerHTML={{ __html: COURSE_PAGE_STYLES }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <div className="cp-breadcrumb-bar">
        <div className="cp-breadcrumb-bar-inner">
          <a href="/browse-courses" className="cp-bc-link">Courses</a>
          {course.category_name && (
            <>
              <svg className="cp-bc-sep" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <a href={`/category/${course.category_id}`} className="cp-bc-link">{course.category_name}</a>
            </>
          )}
          <svg className="cp-bc-sep" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span className="cp-bc-current">{course.title.slice(0, 60)}</span>
        </div>
      </div>

      <main className="cp-main">
        <section className="cp-hero">
          <div className="cp-hero-inner">
            <div className="cp-hero-content">
              {course.category_name && <a href={`/category/${course.category_id}`} className="cp-hero-cat">{course.category_name}</a>}
              <h1 className="cp-hero-title">{course.title}</h1>
              {course.short_description && <p className="cp-hero-subtitle">{course.short_description}</p>}
              <div className="cp-hero-meta-row">
                {avgRating > 0 && (
                  <>
                    <div className="cp-hero-rating">
                      <span className="cp-rating-num">{avgRating}</span>
                      <span className="cp-rating-count">({totalReviews} ratings)</span>
                    </div>
                    <span className="cp-meta-sep">•</span>
                  </>
                )}
                <span className="cp-hero-stat">{course.student_count.toLocaleString()} students</span>
                <span className="cp-meta-sep">•</span>
                <span className="cp-hero-stat">{totalLessons} lessons</span>
              </div>
              <div className="cp-hero-bottom-row">
                <div className="cp-hero-instructor">
                  <span className="cp-instructor-avatar-sm">{(course.instructor_name ?? "I").slice(0, 1).toUpperCase()}</span>
                  <span>by <a href={`/instructor-profile/${course.instructor_id}`}>{course.instructor_name ?? "Instructor"}</a></span>
                </div>
                <div className="cp-hero-badges">
                  <span className={`cp-badge cp-badge--level cp-badge--${course.level}`}>{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</span>
                  <span className="cp-badge cp-badge--lang">{course.language}</span>
                  {course.certificate_enabled && <span className="cp-badge cp-badge--cert">Certificate</span>}
                </div>
              </div>
            </div>
            {course.thumbnail && (
              <div className="cp-hero-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={course.thumbnail} alt={course.title} />
              </div>
            )}
          </div>
        </section>

        <div className="cp-layout">
          <div className="cp-body-top">
            {learnPoints.length > 0 && (
              <section className="cp-section cp-learn" id="overview">
                <h2 className="cp-section-title">What You&apos;ll Learn</h2>
                <div className="cp-learn-grid">
                  {learnPoints.map((point, i) => (
                    <div key={i} className="cp-learn-item">
                      <span className="cp-learn-check"><svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="cp-section" id="curriculum">
              <div className="cp-section-header">
                <h2 className="cp-section-title">Course Content</h2>
                <div className="cp-curriculum-meta">
                  <span>{sections.length} sections</span>
                  <span className="cp-meta-dot">•</span>
                  <span>{totalLessons} lessons</span>
                  {freePreviewCount > 0 && <><span className="cp-meta-dot">•</span><span className="cp-free-preview-note">{freePreviewCount} free previews</span></>}
                </div>
              </div>
              <div className="cp-curriculum-list" id="curriculumList">
                {sections.map((s, sIdx) => (
                  <div key={s.id} className={`cp-acc-item ${sIdx === 0 ? "cp-acc-item--open" : ""}`}>
                    <button className="cp-acc-trigger" type="button" aria-expanded={sIdx === 0}>
                      <span className="cp-acc-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
                      <span className="cp-acc-title">{s.title}</span>
                      <span className="cp-acc-count">{lessonsBySection[s.id]?.length ?? 0} lessons</span>
                    </button>
                    <div className="cp-acc-body">
                      <ul className="cp-lesson-list">
                        {(lessonsBySection[s.id] ?? []).map((lesson) => (
                          <li key={lesson.id} className="cp-lesson-item">
                            <span className={`cp-lesson-icon cp-lesson-icon--${lesson.content_type}`}>
                              {lesson.content_type === "video" && <svg viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>}
                              {lesson.content_type === "quiz" && <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
                              {lesson.content_type === "assignment" && <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>}
                              {!["video", "quiz", "assignment"].includes(lesson.content_type) && <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" /></svg>}
                            </span>
                            <span className="cp-lesson-title">{lesson.title}</span>
                            <span className="cp-lesson-right">
                              {lesson.is_free_preview && !isEnrolled && <span className="cp-lesson-preview">Preview</span>}
                              {lesson.video_duration > 0 && <span className="cp-lesson-dur">{Math.floor(lesson.video_duration / 60)} min</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="cp-section" id="requirements">
              <h2 className="cp-section-title">Requirements</h2>
              <ul className="cp-req-list">
                <li>Basic computer skills and internet connection</li>
                <li>No prior experience needed — this course starts from the basics</li>
                <li>Willingness to learn and practice regularly</li>
              </ul>
            </section>

            <section className="cp-section" id="description">
              <h2 className="cp-section-title">Course Description</h2>
              <div className="cp-desc-body cp-desc-collapsed" id="descBody" dangerouslySetInnerHTML={{ __html: renderedDesc }} />
              <button className="cp-desc-toggle" id="descToggle" type="button">Show more</button>
            </section>

            <section className="cp-section" id="instructor">
              <h2 className="cp-section-title">Your Instructor</h2>
              <div className="cp-instructor-card">
                <div className="cp-instructor-avatar">{(course.instructor_name ?? "I").slice(0, 2).toUpperCase()}</div>
                <div className="cp-instructor-info">
                  <h3 className="cp-instructor-name">{course.instructor_name ?? "Instructor"}</h3>
                  <p className="cp-instructor-role">Expert Instructor</p>
                  <a href={`/instructor-profile/${course.instructor_id}`} className="cp-btn cp-btn--outline cp-btn--view-profile">View Full Profile</a>
                </div>
              </div>
            </section>
          </div>

          <aside className="cp-sidebar" id="enroll-card">
            <CourseClient
              courseId={course.id}
              isEnrolled={isEnrolled}
              progress={enrollment[0]?.progress_percentage ?? 0}
              completedAt={enrollment[0]?.completed_at ? new Date(enrollment[0].completed_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : null}
              isFree={isFree}
              price={course.price}
              inWishlist={inWishlist.length > 0}
              isInstructor={isInstructor}
              totalLessons={totalLessons}
              sectionsCount={sections.length}
              freePreviewCount={freePreviewCount}
              certificateEnabled={course.certificate_enabled}
              durationStr={`${totalLessons} lessons`}
              csrfToken={csrfToken}
            />
          </aside>

          <div className="cp-body-bottom">
            <section className="cp-section" id="reviews">
              <h2 className="cp-section-title">Student Reviews</h2>
              {totalReviews > 0 ? (
                <>
                  <div className="cp-rating-summary">
                    <div className="cp-rating-big">
                      <span className="cp-rating-big-num">{avgRating}</span>
                      <span className="cp-rating-big-label">Course Rating</span>
                    </div>
                    <div className="cp-rating-bars">
                      {[5, 4, 3, 2, 1].map((i) => {
                        const pct = totalReviews > 0 ? Math.round((ratingDist[i] / totalReviews) * 100) : 0;
                        return (
                          <div key={i} className="cp-rating-bar-row">
                            <div className="cp-rbar-track"><div className="cp-rbar-fill" style={{ width: `${pct}%` }}></div></div>
                            <span className="cp-rbar-pct">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="cp-reviews-grid">
                    {reviews.map((r) => (
                      <div key={r.id} className="cp-review-card">
                        <div className="cp-review-header">
                          <div className="cp-review-avatar">{r.student_name.slice(0, 1).toUpperCase()}</div>
                          <div className="cp-review-meta">
                            <p className="cp-review-name">{r.student_name}</p>
                            <div className="cp-review-stars">
                              <span>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                              <span className="cp-review-date">{new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                        <p className="cp-review-text">{r.review_text}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="cp-reviews-empty"><p>No reviews yet. Be the first to review this course!</p></div>
              )}

              {isEnrolled && (
                <div className="cp-write-review">
                  <h3 className="cp-write-review-title">{myReview ? "Update Your Review" : "Write a Review"}</h3>
                  <form method="post" className="cp-review-form" action="/api/course/review">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <input type="hidden" name="course_id" value={course.id} />
                    <div className="cp-star-picker" id="starPicker">
                      <p className="cp-star-label">Your Rating</p>
                      <div className="cp-star-inputs">
                        {[5, 4, 3, 2, 1].map((i) => (
                          <span key={i}>
                            <input type="radio" name="rating" id={`star${i}`} value={i} defaultChecked={myReview?.rating === i} />
                            <label htmlFor={`star${i}`} aria-label={`${i} star${i > 1 ? "s" : ""}`}>★</label>
                          </span>
                        ))}
                      </div>
                    </div>
                    <textarea name="review_text" className="cp-review-textarea" placeholder="Share your experience with this course..." rows={4} defaultValue={myReview?.review_text ?? ""} required />
                    <button type="submit" className="cp-btn cp-btn--primary">{myReview ? "Update Review" : "Submit Review"}</button>
                  </form>
                </div>
              )}
            </section>

            {related.length > 0 && (
              <section className="cp-section" id="related">
                <h2 className="cp-section-title">More Courses Like This</h2>
                <div className="cp-related-grid">
                  {related.map((rc) => (
                    <a key={rc.id} href={`/course/${rc.slug}`} className="cp-related-card">
                      <div className="cp-related-thumb">
                        {rc.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={rc.thumbnail} alt={rc.title} />
                        ) : (
                          <div className="cp-related-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" /></svg></div>
                        )}
                      </div>
                      <div className="cp-related-body">
                        <p className="cp-related-title">{rc.title.slice(0, 60)}</p>
                        <p className="cp-related-instructor">{rc.instructor_name}</p>
                        <div className="cp-related-footer">
                          {rc.avg_rating && <span className="cp-related-rating">★ {Math.round(rc.avg_rating * 10) / 10}</span>}
                          <span className="cp-related-price">{rc.price === 0 ? "Free" : `₹${rc.price}`}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
