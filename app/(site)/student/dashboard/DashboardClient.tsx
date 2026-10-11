"use client";

import { useEffect } from "react";
import TextStars from "@/components/TextStars";
import { DAY_NAMES, addDays } from "@/lib/learning/calendar";
import "@/styles/css/student/dashboard.css";

export type DashboardData = {
  userName: string;
  firstName: string;
  greeting: string;
  justOnboarded: boolean;
  showOnboardBanner: boolean;
  totalCourses: number;
  completedCourses: number;
  wishlistCount: number;
  cartCount: number;
  totalHours: number;
  completedLessons: number;
  learningDays: number;
  streak: number;
  activeDates: string[];
  today: string;
  overallPct: number;
  inProgressCount: number;
  notStartedCount: number;
  recentCourses: {
    courseId: number;
    title: string;
    slug: string;
    thumbnail: string | null;
    categoryName: string | null;
    categorySlug: string;
    instructorName: string;
    progressPercentage: number;
    totalLessons: number;
    completedLessons: number;
  }[];
  firstContinueCourseId: number | null;
  completedCoursesCards: {
    courseId: number;
    title: string;
    thumbnail: string | null;
    instructorName: string;
    certificateEnabled: boolean;
    hasCertificate: boolean;
  }[];
  completedCount: number;
  personalised: boolean;
  recommended: {
    id: number;
    title: string;
    slug: string;
    thumbnail: string | null;
    categoryName: string | null;
    instructorName: string;
    avgRating: number;
    studentCount: number;
    lessonCount: number;
    priceLabel: string;
  }[];
  wishlistPreview: { courseId: number; slug: string; title: string; thumbnail: string | null; priceLabel: string }[];
  weekStat: { planned_total: number; done_total: number };
  timezone: string;
};

/** Port of public/student/dashboard.php (lines 261-758). */
export default function DashboardClient(d: DashboardData) {
  // Welcome toast: auto-dismiss after 6 s and strip ?onboarded=1 from the URL bar.
  useEffect(() => {
    if (!d.justOnboarded) return;
    const toast = document.getElementById("welcomeToast");
    const t1 = setTimeout(() => {
      if (!toast) return;
      toast.style.opacity = "0";
      toast.style.transition = "opacity .4s";
      setTimeout(() => toast.remove(), 400);
    }, 6000);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", "/student/dashboard");
    }
    return () => clearTimeout(t1);
  }, [d.justOnboarded]);

  // Ring geometry: r=48 for the hero (0.754 of the circumference is visible after the
  // stroke is clipped) and r=40 for the sidebar overview ring.
  const heroCircum = 2 * Math.PI * 40;
  const circum = 2 * Math.PI * 40;
  const dash = circum * (d.overallPct / 100);
  // dashboard.php: the last 7 days, oldest first, dotted when a lesson was completed.
  const streakDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(d.today, -6 + i);
    return { dateStr, active: d.activeDates.includes(dateStr) };
  });

  return (
    <>
      {d.justOnboarded ? (
        <div className="welcome-toast" id="welcomeToast">
          <div className="welcome-toast-icon">🎉</div>
          <div>
            <p className="welcome-toast-title">Profile complete!</p>
            <p className="welcome-toast-sub">Your dashboard is now personalised just for you.</p>
          </div>
          <button
            className="welcome-toast-close"
            onClick={() => document.getElementById("welcomeToast")?.remove()}
          >
            ✕
          </button>
        </div>
      ) : null}

      <main className="db-page">
        {d.showOnboardBanner ? (
          <div className="onboard-banner">
            <div className="onboard-banner-left">
              <div className="onboard-banner-emoji">🎯</div>
              <div>
                <p className="onboard-banner-title">
                  Complete your profile to unlock personalised course recommendations!
                </p>
                <p className="onboard-banner-sub">Answer 5 quick questions — takes about 2 minutes.</p>
              </div>
            </div>
            <a href="/student/onboarding" className="onboard-banner-btn">
              Complete Profile &rarr;
            </a>
          </div>
        ) : null}

        <section className="hero-banner">
          <div className="hero-text">
            <p className="hero-greeting">
              {d.greeting}, {d.firstName}! 👋
            </p>
            <h1 className="hero-title">Ready to keep learning?</h1>
            <p className="hero-sub">
              {d.inProgressCount > 0 ? (
                <>
                  You have <strong>{d.inProgressCount}</strong> course{d.inProgressCount !== 1 ? "s" : ""} in progress. Keep the
                  momentum going!
                </>
              ) : (
                "Start your learning journey today and unlock new skills!"
              )}
            </p>
            <div className="hero-actions">
              {d.firstContinueCourseId !== null ? (
                <a href={`/student/learn?course=${d.firstContinueCourseId}`} className="btn-hero">
                  Continue Learning
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ) : null}
              <a href="/browse-courses" className="btn-hero-outline">
                Explore Courses
              </a>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="hero-blob" />
            <div className="hero-ring-wrap">
              <svg className="hero-ring-svg" viewBox="0 0 120 120">
                <circle className="hero-ring-bg" cx="60" cy="60" r="48" fill="none" strokeWidth="8" />
                <circle
                  className="hero-ring-progress"
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  strokeWidth="8"
                  strokeDasharray={`${Math.round(heroCircum * (d.overallPct / 100) * 0.754 * 100) / 100} ${Math.round(heroCircum * 0.754 * 100) / 100}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="hero-ring-label">
                <span className="hero-ring-pct">{d.overallPct}%</span>
                <span className="hero-ring-sub">Done</span>
              </div>
            </div>
          </div>
        </section>

        <section className="stats-row">
          <div className="stat-card">
            <div className="stat-icon stat-icon--blue">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <p className="stat-value">{d.totalCourses}</p>
              <p className="stat-label">Enrolled</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--green">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <p className="stat-value">{d.completedCourses}</p>
              <p className="stat-label">Completed</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--orange">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <p className="stat-value">{d.totalHours}h</p>
              <p className="stat-label">Learned</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--purple">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <p className="stat-value">{d.completedLessons}</p>
              <p className="stat-label">Lessons Done</p>
            </div>
          </div>
          <div className="stat-card stat-card--streak">
            <div className="stat-icon stat-icon--fire">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2C12 2 7 7.5 7 12a5 5 0 0010 0c0-2-1-4-2-5 0 2-1.5 3-2 3-.5 0-1-.5-1-1 0-2.5 2-5 2-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <p className="stat-value">
                {d.streak}
                <span className="stat-unit">days</span>
              </p>
              <p className="stat-label">🔥 Streak</p>
            </div>
          </div>
        </section>

        <div className="db-grid">
          <div className="db-main">
            <section className="card section-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Continue Learning
                </h2>
                <a href="/student/my-courses" className="card-link">
                  View All
                </a>
              </div>

              {d.recentCourses.length > 0 ? (
                <div className="course-list">
                  {d.recentCourses.map((course) => (
                    <div className="course-list-item" key={course.courseId}>
                      <div className="course-thumb">
                        {course.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={course.thumbnail} alt={course.title} loading="lazy" />
                        ) : (
                          <div className="thumb-placeholder">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="course-list-info">
                        <p className="course-category">
                          <a href={`/category/${course.categorySlug}`}>{course.categoryName ?? "General"}</a>
                        </p>
                        <h3 className="course-list-title">
                          <a href={`/course/${course.slug}`}>{course.title}</a>
                        </h3>
                        <p className="course-instructor">by {course.instructorName}</p>
                        <div className="progress-wrap">
                          <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${course.progressPercentage}%` }} />
                          </div>
                          <span className="progress-label">{course.progressPercentage}%</span>
                        </div>
                        <p className="lesson-count">
                          {course.completedLessons}/{course.totalLessons} lessons completed
                        </p>
                      </div>
                      <div className="course-list-action">
                        <a href={`/student/learn?course=${course.courseId}`} className="btn-continue">
                          {course.progressPercentage > 0 ? "Continue" : "Start"}
                          <svg viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="empty-title">No courses yet</p>
                  <p className="empty-sub">Start your learning journey by enrolling in a course.</p>
                  <a href="/browse-courses" className="btn-primary">
                    Browse Courses
                  </a>
                </div>
              )}
            </section>

            {d.completedCoursesCards.length > 0 ? (
              <section className="card section-card">
                <div className="card-header">
                  <h2 className="card-title">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Completed Courses
                  </h2>
                  <span className="card-badge">{d.completedCount}</span>
                </div>
                <div className="completed-grid">
                  {d.completedCoursesCards.map((course) => (
                    <a href={`/student/learn?course=${course.courseId}`} className="completed-card" key={course.courseId}>
                      <div className="completed-thumb">
                        {course.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={course.thumbnail} alt={course.title} loading="lazy" />
                        ) : (
                          <div className="thumb-placeholder small">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                        <div className="completed-badge">✓</div>
                      </div>
                      <div className="completed-info">
                        <p className="completed-title">{course.title}</p>
                        <p className="completed-instructor">by {course.instructorName}</p>
                        {course.certificateEnabled && course.hasCertificate ? (
                          <a href={`/student/generate-certificate?course=${course.courseId}`} className="cert-pill">
                            🏆 View Certificate
                          </a>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="card section-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Recommended For You
                  {d.personalised ? <span className="personalised-badge">✨ Personalised</span> : null}
                </h2>
                <a href="/browse-courses" className="card-link">
                  See All
                </a>
              </div>
              {d.recommended.length > 0 ? (
                <div className="rec-grid">
                  {d.recommended.map((course) => (
                    <a href={`/course/${course.slug}`} className="rec-card" key={course.id}>
                      <div className="rec-thumb">
                        {course.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={course.thumbnail} alt={course.title} loading="lazy" />
                        ) : (
                          <div className="thumb-placeholder rec">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                        {course.categoryName ? <span className="rec-cat-badge">{course.categoryName}</span> : null}
                      </div>
                      <div className="rec-info">
                        <h3 className="rec-title">{course.title}</h3>
                        <p className="rec-instructor">by {course.instructorName}</p>
                        <div className="rec-meta">
                          <div className="rec-stars">
                            <TextStars rating={course.avgRating} />
                            <span className="rec-rating-val">{course.avgRating > 0 ? course.avgRating.toFixed(1) : "New"}</span>
                          </div>
                          <span className="rec-students">{course.studentCount.toLocaleString("en-IN")} students</span>
                        </div>
                        <div className="rec-footer">
                          <span className="rec-price">{course.priceLabel}</span>
                          <span className="rec-lessons">{course.lessonCount} lessons</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p className="empty-title">No recommendations yet</p>
                  <p className="empty-sub">Check back soon for personalized suggestions.</p>
                </div>
              )}
            </section>
          </div>

          <aside className="db-side">
            <div className="card side-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Learning Overview
                </h2>
              </div>
              <div className="overview-ring-wrap">
                <div className="ring-container">
                  <svg className="ring-svg" viewBox="0 0 100 100">
                    <circle className="ring-bg" cx="50" cy="50" r="40" fill="none" strokeWidth="8" />
                    <circle
                      className="ring-progress"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      strokeWidth="8"
                      strokeDasharray={`${Math.round(dash * 100) / 100} ${Math.round(circum * 100) / 100}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="ring-label">
                    <span className="ring-pct">{d.overallPct}%</span>
                    <span className="ring-sub">Complete</span>
                  </div>
                </div>
              </div>
              <div className="overview-stats">
                <div className="ov-stat">
                  <span className="ov-dot ov-dot--blue" />
                  <span className="ov-label">In Progress</span>
                  <span className="ov-val">{d.inProgressCount}</span>
                </div>
                <div className="ov-stat">
                  <span className="ov-dot ov-dot--green" />
                  <span className="ov-label">Completed</span>
                  <span className="ov-val">{d.completedCourses}</span>
                </div>
                <div className="ov-stat">
                  <span className="ov-dot ov-dot--gray" />
                  <span className="ov-label">Not Started</span>
                  <span className="ov-val">{d.notStartedCount}</span>
                </div>
              </div>
            </div>

            <div className="card side-card streak-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C12 2 7 7.5 7 12a5 5 0 0010 0c0-2-1-4-2-5 0 2-1.5 3-2 3-.5 0-1-.5-1-1 0-2.5 2-5 2-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Learning Streak
                </h2>
              </div>
              <div className="streak-display">
                <div className="streak-number">{d.streak}</div>
                <div className="streak-info">
                  <p className="streak-label">Day Streak 🔥</p>
                  <p className="streak-sub">{d.learningDays} total active days</p>
                </div>
              </div>
              <div className="streak-days">
                {streakDays.map((day) => (
                  <div className={`streak-day ${day.active ? "streak-day--active" : ""}`} key={day.dateStr}>
                    <div className="streak-dot" />
                    <span>{DAY_NAMES[weekdayOf(day.dateStr)]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card side-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  My Activity
                </h2>
              </div>
              <div className="activity-items">
                <div className="activity-item">
                  <div className="activity-icon activity-icon--yellow">
                    <svg viewBox="0 0 24 24" fill="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="activity-text">
                    <p className="activity-val">{d.learningDays} days</p>
                    <p className="activity-label">Active learning days</p>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon activity-icon--blue">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="activity-text">
                    <p className="activity-val">{d.totalHours}h</p>
                    <p className="activity-label">Total time learned</p>
                  </div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon activity-icon--green">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="activity-text">
                    <p className="activity-val">{d.completedLessons}</p>
                    <p className="activity-label">Lessons completed</p>
                  </div>
                </div>
              </div>
            </div>

            {d.wishlistPreview.length > 0 ? (
              <div className="card side-card">
                <div className="card-header">
                  <h2 className="card-title">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Wishlist
                  </h2>
                  <a href="/wishlist" className="card-link">
                    View All
                  </a>
                </div>
                <div className="wishlist-items">
                  {d.wishlistPreview.map((item) => (
                    <a href={`/course/${item.slug}`} className="wishlist-item" key={item.courseId}>
                      <div className="wishlist-thumb">
                        {item.thumbnail ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.thumbnail} alt={item.title} loading="lazy" />
                        ) : (
                          <div className="thumb-placeholder tiny">
                            <svg viewBox="0 0 24 24" fill="none">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="wishlist-info">
                        <p className="wishlist-title">{item.title}</p>
                        <p className="wishlist-price">{item.priceLabel}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="card side-card">
              <div className="card-header">
                <h2 className="card-title">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points="13 2 13 9 20 9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                  Quick Links
                </h2>
              </div>
              <div className="quick-links">
                <a href="/student/my-courses" className="quick-link">
                  <span className="ql-icon ql-icon--blue">📚</span>
                  <span>All My Courses</span>
                  <svg className="ql-arrow" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="/browse-courses" className="quick-link">
                  <span className="ql-icon ql-icon--purple">🔍</span>
                  <span>Browse Courses</span>
                  <svg className="ql-arrow" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="/cart" className="quick-link">
                  <span className="ql-icon ql-icon--orange">🛒</span>
                  <span>
                    My Cart {d.cartCount > 0 ? <span className="ql-count">({d.cartCount})</span> : null}
                  </span>
                  <svg className="ql-arrow" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="/wishlist" className="quick-link">
                  <span className="ql-icon ql-icon--pink">❤️</span>
                  <span>
                    Wishlist {d.wishlistCount > 0 ? <span className="ql-count">({d.wishlistCount})</span> : null}
                  </span>
                  <svg className="ql-arrow" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                {d.showOnboardBanner ? (
                  <a href="/student/onboarding" className="quick-link">
                    <span className="ql-icon ql-icon--green">🎯</span>
                    <span>Complete Profile</span>
                    <svg className="ql-arrow" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

/** PHP date('w'): 0 = Sunday. */
function weekdayOf(dateStr: string): number {
  const [y, m, dd] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, dd ?? 1)).getUTCDay();
}