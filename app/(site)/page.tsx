/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/home.css";
import { getSessionUser } from "@/lib/auth/guards";
import {
  getFeaturedCourses,
  getLatestCourses,
  getPlatformStats,
  getPopularCategories,
  getRecentTestimonials,
  getTopRatedCourses,
  getWishlistIds,
  type HomeCourse,
  type PopularCategory,
  type PlatformStats,
  type Testimonial,
} from "@/lib/db/home";
import { formatPrice, getCategoryIcon, getLevelBadgeClass, getThumbnailUrl, siteUrl, strPad2, trimWidth } from "@/lib/format";
import Stars from "@/components/Stars";
import HeroTyping from "@/components/HeroTyping";
import HomeEffects from "@/components/HomeEffects";
import CourseWishlistButton from "@/components/CourseWishlistButton";
import LatestCoursesFilter from "@/components/LatestCoursesFilter";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";

// The homepage is session-dependent (CTA copy, wishlist buttons), so it cannot be
// prerendered. Rendering it blocking (instead of behind <Suspense>) keeps the H1
// - the LCP element, per public/index.php - and the JSON-LD in the initial HTML.
export const metadata: Metadata = pageMetadata({
  title: "Edulari — Learn Without Limits",
  description:
    "Master in-demand skills with expert-led courses in programming, design, business, and more. Join thousands of learners on Edulari.",
  keywords: "online courses, learn programming, web development, UI design, data science, online learning platform, earn certificate, Edulari",
  path: "/",
});

const BRANDS = ["Google", "Microsoft", "Amazon", "Meta", "Netflix", "Spotify", "Airbnb", "Stripe", "Shopify", "Twilio"];

const STAT_ITEMS = [
  { key: "total_students", label: "Active Learners", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8m14 4v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75", color: "--primary" },
  { key: "total_courses", label: "Courses Available", icon: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z", color: "--secondary" },
  { key: "total_instructors", label: "Expert Instructors", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", color: "--accent-orange" },
  { key: "total_reviews", label: "Student Reviews", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", color: "--accent-pink" },
] as const;

const STEPS = [
  { num: "01", title: "Create Your Account", desc: "Sign up for free in seconds. No credit card needed to get started.", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  { num: "02", title: "Choose Your Course", desc: "Browse thousands of courses by topic, level, or instructor.", icon: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" },
  { num: "03", title: "Learn at Your Pace", desc: "Access videos, quizzes, and assignments anytime, anywhere.", icon: "M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" },
  { num: "04", title: "Earn Your Certificate", desc: "Complete the course and download a shareable certificate.", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
] as const;

const FEATURES = [
  { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "Verified Certificates", desc: "Earn industry-recognised certificates upon course completion." },
  { icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2", title: "Learn on Any Device", desc: "Fully responsive — desktop, tablet, or smartphone." },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Lifetime Access", desc: "Buy once, revisit whenever you need a refresher." },
  { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", title: "Expert Community", desc: "Join discussion forums and get help from instructors and peers." },
  { icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", title: "Quality Assured", desc: "Every course is reviewed by our quality team before publishing." },
] as const;

const MOCK_COURSES = [
  { name: "JavaScript Mastery", pct: 78, color: "#6c63ff" },
  { name: "UI/UX Fundamentals", pct: 45, color: "#10b981" },
  { name: "Python Data Science", pct: 92, color: "#f59e0b" },
  { name: "React & Next.js", pct: 30, color: "#6c63ff" },
] as const;

const PERKS = ["Earn from every enrolment", "Full analytics dashboard", "Built-in quizzes & certificates", "Marketing & SEO support"] as const;

function ArrowIcon({ w = 18 }: { w?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={w} height={w} aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CourseCard({
  course,
  isStudent,
  wishlistIds,
  showLessonsMeta,
  delay,
}: {
  course: HomeCourse;
  isStudent: boolean;
  wishlistIds: number[];
  showLessonsMeta: boolean;
  delay: number;
}) {
  const rating = Number(course.avg_rating ?? 0);
  const inWishlist = wishlistIds.includes(course.id);
  return (
    <article className="course-card" data-level={course.level.toLowerCase()} data-reveal="fade-up" style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <CourseWishlistButton courseId={course.id} initiallyWishlisted={inWishlist} enabled={isStudent} size={18} />
      <a href={`/course/${encodeURIComponent(course.slug)}`} className="course-card__thumb-link" tabIndex={-1} aria-hidden="true">
        <div className="course-card__thumb">
          <img src={getThumbnailUrl(course.thumbnail)} alt={course.title} loading="lazy" width={400} height={240} />
          <div className="course-card__thumb-overlay">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Preview</span>
          </div>
          {course.level ? (
            <span className={`level-badge ${getLevelBadgeClass(course.level)}`}>
              {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
            </span>
          ) : null}
        </div>
      </a>
      <div className="course-card__body">
        {course.category_name ? <span className="course-card__category">{course.category_name}</span> : null}
        <h3 className="course-card__title">
          <a href={`/course/${encodeURIComponent(course.slug)}`}>{course.title}</a>
        </h3>
        <p className="course-card__instructor">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          </svg>
          {course.instructor_name ?? "Instructor"}
        </p>
        <div className="course-card__rating" aria-label={`Rating: ${rating.toFixed(1)} out of 5`}>
          <span className="course-card__rating-num">{rating.toFixed(1)}</span>
          <div className="stars" aria-hidden="true"><Stars rating={rating} /></div>
          <span className="course-card__review-count">({course.review_count.toLocaleString("en-IN")})</span>
        </div>
        <div className="course-card__meta">
          {showLessonsMeta && course.lesson_count ? (
            <span>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {course.lesson_count} lessons
            </span>
          ) : null}
          {course.student_count ? (
            <span>
              <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              </svg>
              {course.student_count.toLocaleString("en-IN")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="course-card__footer">
        <span className={`price ${course.price === 0 ? "price--free" : "price--paid"}`}>{formatPrice(course.price)}</span>
        <a href={`/course/${encodeURIComponent(course.slug)}`} className="btn btn--primary btn--sm">
          {course.price === 0 ? "Enroll Free" : "View Course"}
        </a>
      </div>
    </article>
  );
}

function Hero({ stats, role }: { stats: PlatformStats; role: string | null }) {
  return (
    <section className="hero" id="hero" aria-label="Welcome to Edulari">
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__blob hero__blob--1" />
        <div className="hero__blob hero__blob--2" />
        <div className="hero__blob hero__blob--3" />
        <div className="hero__grid" />
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={`hero__particle hero__particle--${i + 1}`} aria-hidden="true" />
        ))}
      </div>

      <div className="container">
        <div className="hero__inner">
          <div className="hero__content">
            <div className="hero__badge">
              <span className="hero__badge-dot" aria-hidden="true" />
              <span>
                Trusted by <strong>{stats.total_students.toLocaleString("en-IN")}+</strong> learners worldwide
              </span>
            </div>

            <h1 className="hero__title">
              Build Skills That
              <br />
              <HeroTyping />
              <br />
              to Your Future
            </h1>

            <p className="hero__desc">
              Learn from world-class instructors at your own pace. Earn certificates, grow your career, and join a thriving
              community of curious minds.
            </p>

            <form className="hero__search" action="/browse-courses" method="GET" role="search">
              <div className="hero__search-wrap">
                <svg className="hero__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input type="search" name="search" placeholder="What do you want to learn today?" autoComplete="off" maxLength={200} aria-label="Search courses" />
                <button type="submit" className="hero__search-btn">
                  <span>Search</span>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className="hero__search-tags" aria-label="Popular searches">
                <span>Popular:</span>
                <a href="/browse-courses?search=python">Python</a>
                <a href="/browse-courses?search=web+development">Web Dev</a>
                <a href="/browse-courses?search=ui+design">UI Design</a>
                <a href="/browse-courses?search=data+science">Data Science</a>
                <a href="/browse-courses?search=javascript">JavaScript</a>
              </div>
            </form>

            <div className="hero__ctas">
              {!role ? (
                <>
                  <a href="/register" className="btn btn--primary btn--lg">Start Learning Free <ArrowIcon /></a>
                  <a href="/browse-courses" className="btn btn--outline btn--lg">Explore Courses</a>
                </>
              ) : role === "student" ? (
                <>
                  <a href="/browse-courses" className="btn btn--primary btn--lg">Browse Courses <ArrowIcon /></a>
                  <a href="/student/my-courses" className="btn btn--outline btn--lg">My Courses</a>
                </>
              ) : (
                <a href="/browse-courses" className="btn btn--primary btn--lg">Explore Courses</a>
              )}
            </div>
          </div>

          <div className="hero__visual" aria-hidden="true">
            <div className="hero__visual-inner">
              <div className="hero__card hero__card--main">
                <div className="hero__card-thumb">
                  <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="280" height="160" rx="12" fill="url(#cardGrad)" />
                    <defs>
                      <linearGradient id="cardGrad" x1="0" y1="0" x2="280" y2="160" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#1e3a5f" />
                        <stop offset="1" stopColor="#0f1f3a" />
                      </linearGradient>
                    </defs>
                    <circle cx="140" cy="78" r="36" fill="rgba(108,99,255,0.15)" stroke="#6c63ff" strokeWidth="1.5" />
                    <polygon points="132,65 132,91 155,78" fill="#6c63ff" />
                    <rect x="40" y="126" width="200" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
                    <rect x="80" y="138" width="120" height="6" rx="3" fill="rgba(255,255,255,0.05)" />
                  </svg>
                </div>
                <div className="hero__card-body">
                  <div className="hero__card-rating">
                    <span className="hero__card-star" aria-hidden="true">★</span>
                    <strong>4.9</strong>
                    <div className="hero__card-bar"><div className="hero__card-fill" style={{ width: "96%" }} /></div>
                    <span className="hero__card-count">12.4k</span>
                  </div>
                  <p className="hero__card-title">Complete Web Dev Bootcamp</p>
                  <div className="hero__card-meta">
                    <span>42 lessons</span>
                    <span aria-hidden="true">•</span>
                    <span>24 hours</span>
                  </div>
                </div>
              </div>

              <div className="hero__badge-card hero__badge-card--cert">
                <div className="hero__badge-icon hero__badge-icon--green">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div><strong>Certificate Earned!</strong><span>Web Development</span></div>
              </div>

              <div className="hero__badge-card hero__badge-card--students">
                <div className="hero__badge-icon hero__badge-icon--purple">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div><strong>{stats.total_students.toLocaleString("en-IN")}+</strong><span>Active Learners</span></div>
              </div>

              <div className="hero__badge-card hero__badge-card--rating">
                <div className="hero__badge-icon hero__badge-icon--amber">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div><strong>Top Rated</strong><span>4.9 ★ avg</span></div>
              </div>

              <div className="hero__ring hero__ring--1" aria-hidden="true" />
              <div className="hero__ring hero__ring--2" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className="hero__wave" aria-hidden="true">
        <svg viewBox="0 0 1440 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 70L60 58C120 47 240 23 360 18C480 13 600 27 720 34C840 41 960 41 1080 34C1200 27 1320 13 1380 7L1440 0V70H0Z" fill="var(--surface)" />
        </svg>
      </div>
    </section>
  );
}

function BrandsStrip() {
  return (
    <section className="brands-strip" aria-label="Trusted by learners from top companies">
      <div className="container">
        <p className="brands-strip__label">Our learners work at top companies</p>
        <div className="brands-strip__track" aria-hidden="true">
          {BRANDS.map((brand) => (<div key={brand} className="brand-item">{brand}</div>))}
        </div>
      </div>
    </section>
  );
}

function StatsSection({ stats }: { stats: PlatformStats }) {
  return (
    <section className="stats-section" id="stats" aria-label="Platform statistics">
      <div className="container">
        <div className="stats-grid">
          {STAT_ITEMS.map((item) => (
            <div key={item.key} className="stat-card" data-reveal="fade-up">
              <div className="stat-card__icon" style={{ "--stat-color": `var(${item.color})` } as React.CSSProperties} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                  <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="stat-card__body">
                <span
                  className="stat-card__value"
                  data-count={stats[item.key]}
                  aria-label={`${stats[item.key].toLocaleString("en-IN")} ${item.label}`}
                >
                  0
                </span>
                <span className="stat-card__label">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ categories }: { categories: PopularCategory[] }) {
  return (
    <section className="section categories-section" id="categories" aria-labelledby="categories-title">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <span className="section-eyebrow">Browse by Topic</span>
          <h2 className="section-title" id="categories-title">Explore Top Categories</h2>
          <p className="section-desc">Find the perfect course in your area of interest and start learning today.</p>
        </div>

        {categories.length > 0 ? (
          <div className="categories-grid" role="list">
            {categories.map((cat, index) => (
              <a
                key={cat.id}
                href={`/category/${encodeURIComponent(cat.slug)}`}
                className="category-card"
                role="listitem"
                data-reveal="fade-up"
                style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                aria-label={`${cat.name}, ${cat.course_count} courses`}
              >
                <div className="category-card__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                    <path d={getCategoryIcon(cat.name)} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="category-card__body">
                  <h3 className="category-card__name">{cat.name}</h3>
                  <span className="category-card__count">
                    {cat.course_count.toLocaleString("en-IN")} course{cat.course_count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="category-card__arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Categories coming soon. <a href="/browse-courses">Browse all courses</a>.</p>
          </div>
        )}

        <div className="section-cta" data-reveal="fade-up">
          <a href="/browse-courses" className="btn btn--outline btn--lg">View All Courses <ArrowIcon /></a>
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({ courses, isStudent, wishlistIds }: { courses: HomeCourse[]; isStudent: boolean; wishlistIds: number[] }) {
  if (courses.length === 0) return null;
  return (
    <section className="section courses-section" aria-labelledby="featured-title">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <span className="section-eyebrow">Hand-picked for you</span>
          <h2 className="section-title" id="featured-title">Featured Courses</h2>
          <p className="section-desc">Curated by our team for quality, relevance, and real-world impact.</p>
        </div>
        <div className="courses-grid courses-grid--3">
          {courses.map((course, i) => (
            <CourseCard key={course.id} course={course} isStudent={isStudent} wishlistIds={wishlistIds} showLessonsMeta delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestSection({ courses, isStudent, wishlistIds }: { courses: HomeCourse[]; isStudent: boolean; wishlistIds: number[] }) {
  return (
    <section className="section courses-section courses-section--latest" id="latest-courses" aria-labelledby="latest-title">
      <div className="container">
        <div className="section-header-flex" data-reveal="fade-up">
          <div>
            <span className="section-eyebrow">Fresh content</span>
            <h2 className="section-title" id="latest-title">Latest Courses</h2>
          </div>
          <a href="/browse-courses" className="btn btn--outline btn--sm">View All <ArrowIcon w={16} /></a>
        </div>

        <LatestCoursesFilter>
          {courses.length > 0 ? (
            <>
              <div className="courses-grid courses-grid--4" id="latestGrid" role="tabpanel" aria-label="Course listing">
                {courses.map((course, i) => (
                  <CourseCard key={course.id} course={course} isStudent={isStudent} wishlistIds={wishlistIds} showLessonsMeta={false} delay={(i % 4) * 80} />
                ))}
              </div>
              <p className="filter-empty" id="filterEmpty" aria-live="polite" hidden>
                No courses found for this level. <a href="/browse-courses">Browse all courses</a>.
              </p>
            </>
          ) : (
            <div className="empty-state" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" aria-hidden="true">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>No Courses Yet</h3>
              <p>Courses are being added. Check back soon!</p>
            </div>
          )}
        </LatestCoursesFilter>
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section className="section how-section" id="how-it-works" aria-labelledby="how-title">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <span className="section-eyebrow">Simple process</span>
          <h2 className="section-title" id="how-title">Learning Made Easy</h2>
          <p className="section-desc">From sign-up to certificate in four simple steps.</p>
        </div>
        <div className="how-grid">
          {STEPS.map((step, i) => (
            <div key={step.num} className="how-step" data-reveal="fade-up" style={{ "--delay": `${i * 120}ms` } as React.CSSProperties}>
              <div className="how-step__connector" aria-hidden="true" />
              <div className="how-step__num" aria-hidden="true">{step.num}</div>
              <div className="how-step__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path d={step.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="how-step__title">{step.title}</h3>
              <p className="how-step__desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopRatedSection({ courses }: { courses: HomeCourse[] }) {
  if (courses.length === 0) return null;
  return (
    <section className="section top-rated-section" aria-labelledby="top-rated-title">
      <div className="container">
        <div className="section-header-flex" data-reveal="fade-up">
          <div>
            <span className="section-eyebrow">Highest rated</span>
            <h2 className="section-title" id="top-rated-title">Top Rated Courses</h2>
          </div>
          <a href="/browse-courses?sort=rating" className="btn btn--outline btn--sm">See All <ArrowIcon w={16} /></a>
        </div>
        <div className="top-rated-list">
          {courses.map((course, idx) => {
            const rating = Number(course.avg_rating ?? 0);
            return (
              <a
                key={course.id}
                href={`/course/${encodeURIComponent(course.slug)}`}
                className="top-rated-item"
                data-reveal="fade-right"
                style={{ "--delay": `${idx * 80}ms` } as React.CSSProperties}
                aria-label={`${course.title}, rated ${rating.toFixed(1)} out of 5`}
              >
                <span className="top-rated-item__rank" aria-hidden="true">{strPad2(idx + 1)}</span>
                <div className="top-rated-item__thumb" aria-hidden="true">
                  <img src={getThumbnailUrl(course.thumbnail)} alt={`${course.title || "Course"} course thumbnail`} loading="lazy" width={72} height={52} />
                </div>
                <div className="top-rated-item__info">
                  <h4>{course.title}</h4>
                  <p>{course.instructor_name ?? ""}</p>
                  <div className="stars" aria-hidden="true"><Stars rating={rating} /></div>
                </div>
                <div className="top-rated-item__price">
                  <span className={`price ${course.price === 0 ? "price--free" : "price--paid"}`}>{formatPrice(course.price)}</span>
                  <span className="top-rated-item__rating-val">{rating.toFixed(1)} ★</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="section features-section" aria-labelledby="features-title">
      <div className="container">
        <div className="features-inner">
          <div className="features-text" data-reveal="fade-right">
            <span className="section-eyebrow">Why choose us</span>
            <h2 className="section-title" id="features-title">Everything You Need to Succeed</h2>
            <p className="section-desc">We designed every part of the learning experience to help you grow faster and smarter.</p>
            <ul className="features-list">
              {FEATURES.map((f) => (
                <li key={f.title} className="features-list__item">
                  <div className="features-list__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22">
                      <path d={f.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div><strong>{f.title}</strong><p>{f.desc}</p></div>
                </li>
              ))}
            </ul>
          </div>

          <div className="features-visual" data-reveal="fade-left" aria-hidden="true">
            <div className="mockup">
              <div className="mockup__bar">
                <span className="mockup__dot mockup__dot--red" />
                <span className="mockup__dot mockup__dot--amber" />
                <span className="mockup__dot mockup__dot--green" />
                <span className="mockup__title">My Learning Dashboard</span>
              </div>
              <div className="mockup__body">
                <div className="mockup__stat-row">
                  <div className="mockup__stat"><span className="mockup__stat-val">4</span><span className="mockup__stat-lbl">In Progress</span></div>
                  <div className="mockup__stat"><span className="mockup__stat-val">12</span><span className="mockup__stat-lbl">Completed</span></div>
                  <div className="mockup__stat"><span className="mockup__stat-val">3</span><span className="mockup__stat-lbl">Certificates</span></div>
                </div>
                <p className="mockup__section-label">Current Courses</p>
                {MOCK_COURSES.map((mc) => (
                  <div key={mc.name} className="mockup__course-row">
                    <div className="mockup__course-name">{mc.name}</div>
                    <div className="mockup__bar-wrap">
                      <div className="mockup__bar-fill" style={{ width: `${mc.pct}%`, background: mc.color }} />
                    </div>
                    <span className="mockup__pct">{mc.pct}%</span>
                  </div>
                ))}
                <div className="mockup__cert-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
                    <circle cx="12" cy="8" r="6" strokeLinecap="round" />
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>New certificate ready!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;
  const data = testimonials.map((t) => ({
    rating: Number(t.rating),
    review: trimWidth(t.review_text ?? "", 200),
    student_name: t.student_name,
    course_title: trimWidth(t.course_title, 55),
    course_slug: t.course_slug,
    created_at: t.created_at.toISOString(),
  }));
  return (
    <section className="section testimonials-section" aria-labelledby="testimonials-title">
      <div className="container">
        <div className="section-header" data-reveal="fade-up">
          <span className="section-eyebrow">Student voices</span>
          <h2 className="section-title" id="testimonials-title">What Our Learners Say</h2>
          <p className="section-desc">Real reviews from real students who transformed their careers.</p>
        </div>
        <TestimonialsCarousel testimonials={data} renderStars={(rating) => <Stars rating={rating} />} />
      </div>
    </section>
  );
}

function InstructorBanner({ stats }: { stats: PlatformStats }) {
  return (
    <section className="instructor-banner" aria-labelledby="instructor-title">
      <div className="instructor-banner__bg" aria-hidden="true">
        <div className="instructor-banner__blob instructor-banner__blob--1" />
        <div className="instructor-banner__blob instructor-banner__blob--2" />
      </div>
      <div className="container">
        <div className="instructor-banner__inner">
          <div className="instructor-banner__text" data-reveal="fade-right">
            <h2 id="instructor-title">Share Your Knowledge<br />with the World</h2>
            <p>Join thousands of instructors and build a passive income by teaching what you love. Create your first course in minutes.</p>
            <ul className="instructor-perks">
              {PERKS.map((perk) => (
                <li key={perk}>
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {perk === "Marketing & SEO support" ? "Marketing & SEO support" : perk}
                </li>
              ))}
            </ul>
            <a href="/instructor-register" className="btn btn--white btn--lg">Start Teaching Today <ArrowIcon /></a>
          </div>
          <div className="instructor-banner__visual" data-reveal="fade-left" aria-hidden="true">
            <div className="instructor-icon-ring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="instructor-stat-card instructor-stat-card--1"><strong>$2,400</strong><span>avg monthly earnings</span></div>
            <div className="instructor-stat-card instructor-stat-card--2"><strong>{stats.total_instructors.toLocaleString("en-IN")}+</strong><span>active instructors</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection({ stats, role }: { stats: PlatformStats; role: string | null }) {
  return (
    <section className="cta-section" aria-labelledby="cta-title">
      <div className="cta-section__bg" aria-hidden="true">
        <div className="cta-section__blob cta-section__blob--1" />
        <div className="cta-section__blob cta-section__blob--2" />
      </div>
      <div className="container">
        <div className="cta-section__inner" data-reveal="fade-up">
          <h2 className="cta-section__title" id="cta-title">Ready to Start Your<br />Learning Journey?</h2>
          <p className="cta-section__desc">
            Join {stats.total_students.toLocaleString("en-IN")}+ learners. Build skills that matter. Start for free today.
          </p>
          <div className="cta-section__actions">
            {!role ? (
              <>
                <a href="/register" className="btn btn--white btn--lg">Get Started Free</a>
                <a href="/login" className="btn btn--ghost-white btn--lg">I Have an Account</a>
              </>
            ) : role === "student" ? (
              <>
                <a href="/browse-courses" className="btn btn--white btn--lg">Browse Courses</a>
                <a href="/student/my-courses" className="btn btn--ghost-white btn--lg">My Learning</a>
              </>
            ) : role === "instructor" ? (
              <a href="/instructor/create-course" className="btn btn--white btn--lg">Create a Course</a>
            ) : (
              <a href="/admin/dashboard" className="btn btn--white btn--lg">Admin Dashboard</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

async function HomeData() {
  const user = await getSessionUser();
  const [stats, popularCategories, featuredCourses, latestCourses, topRated, testimonials, wishlistIds] = await Promise.all([
    getPlatformStats(),
    getPopularCategories(8),
    getFeaturedCourses(6),
    getLatestCourses(8),
    getTopRatedCourses(4),
    getRecentTestimonials(6),
    user ? getWishlistIds(user.id) : Promise.resolve([] as number[]),
  ]);

  const role = user?.role ?? null;
  const isStudent = role === "student";

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Edulari",
    url: `${siteUrl()}/`,
    description: "Master in-demand skills with expert-led courses in programming, design, business, and more.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/browse-courses?search={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Edulari",
    url: `${siteUrl()}/`,
    description: "Online learning platform offering expert-led courses in programming, design, business, and more.",
    logo: { "@type": "ImageObject", url: `${siteUrl()}/assets/images/edulari-logo.png`, width: 200, height: 60 },
    sameAs: [
      "https://www.facebook.com/edulari",
      "https://twitter.com/edulari",
      "https://www.linkedin.com/company/edulari",
      "https://www.instagram.com/edulari",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${siteUrl()}/contact`,
      availableLanguage: "English",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <Hero stats={stats} role={role} />
      <BrandsStrip />
      <StatsSection stats={stats} />
      <CategoriesSection categories={popularCategories} />
      <FeaturedSection courses={featuredCourses} isStudent={isStudent} wishlistIds={wishlistIds} />
      <LatestSection courses={latestCourses} isStudent={isStudent} wishlistIds={wishlistIds} />
      <HowSection />
      <TopRatedSection courses={topRated} />
      <FeaturesSection />
      <TestimonialsSection testimonials={testimonials} />
      {!role || isStudent ? <InstructorBanner stats={stats} /> : null}
      <CtaSection stats={stats} role={role} />
      <HomeEffects />
    </>
  );
}

export default async function HomePage() {
  return (
    <main id="main-content">
      <HomeData />
    </main>
  );
}
