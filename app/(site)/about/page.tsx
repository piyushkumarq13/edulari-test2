import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { siteUrl } from "@/lib/format";
import "@/styles/css/about.css";

export const metadata: Metadata = pageMetadata({
  title: "About Us - Edulari",
  description: "Learn about Edulari, our mission to make quality education accessible to everyone, and meet our Founder & CEO, Piyush Chaurasiya.",
  path: "/about",
  keywords: "about edulari, online learning platform, e-learning company, our story, Piyush Chaurasiya",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Us — Edulari",
  url: siteUrl("/about"),
  description: "Learn about Edulari, our mission to make quality education accessible to everyone.",
  mainEntity: {
    "@type": "EducationalOrganization",
    name: "Edulari",
    url: siteUrl("/"),
    founder: {
      "@type": "Person",
      name: "Piyush Chaurasiya",
      jobTitle: "Founder & CEO",
      description: "Currently pursuing a B.Tech in Computer Engineering with a specialization in Artificial Intelligence and Machine Learning.",
    },
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl("/") },
    { "@type": "ListItem", position: 2, name: "About Us", item: siteUrl("/about") },
  ],
};

export default function AboutPage() {
  return (
    <main className="ab-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <section className="ab-hero">
        <div className="ab-hero-inner">
          <div className="ab-hero-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Our Story
          </div>
          <h1 className="ab-hero-title">About <span className="ab-hero-accent">Edulari</span></h1>
          <p className="ab-hero-sub">We&apos;re on a mission to make quality education accessible, practical, and genuinely enjoyable — for every learner, everywhere.</p>
          <div className="ab-hero-stats">
            <div className="ab-hero-stat"><span className="ab-hero-stat-num">100%</span><span className="ab-hero-stat-label">Learner-first approach</span></div>
            <div className="ab-hero-stat-divider"></div>
            <div className="ab-hero-stat"><span className="ab-hero-stat-num">24/7</span><span className="ab-hero-stat-label">Platform availability</span></div>
            <div className="ab-hero-stat-divider"></div>
            <div className="ab-hero-stat"><span className="ab-hero-stat-num">1</span><span className="ab-hero-stat-label">Mission: your growth</span></div>
          </div>
        </div>
      </section>

      <div className="ab-layout">
        <section className="ab-section ab-story">
          <div className="ab-story-grid">
            <div className="ab-story-text">
              <span className="ab-eyebrow">Why we exist</span>
              <h2 className="ab-section-title">Learning shouldn&apos;t be complicated.</h2>
              <p className="ab-story-para">Edulari was built on a simple idea: everyone deserves access to skills that actually move their life forward — without the noise, the clutter, or the price tag of traditional education.</p>
              <p className="ab-story-para">We bring together passionate instructors, practical course content, and a clean, distraction-free learning experience so you can focus on what matters most — actually learning.</p>
              <div className="ab-story-points">
                <div className="ab-story-point"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Practical, real-world courses</span></div>
                <div className="ab-story-point"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Built and maintained with care</span></div>
                <div className="ab-story-point"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Constantly evolving with learner feedback</span></div>
              </div>
            </div>
            <div className="ab-story-visual" aria-hidden="true">
              <div className="ab-story-card ab-story-card--1"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg><span>Structured Courses</span></div>
              <div className="ab-story-card ab-story-card--2"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg><span>Expert Instructors</span></div>
              <div className="ab-story-card ab-story-card--3"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Trusted Certificates</span></div>
            </div>
          </div>
        </section>

        <section className="ab-section ab-founder">
          <span className="ab-eyebrow ab-eyebrow--center">The Person Behind It</span>
          <h2 className="ab-section-title ab-section-title--center">Meet Our Founder &amp; CEO</h2>
          <div className="ab-founder-card">
            <div className="ab-founder-avatar" aria-hidden="true"><span>PC</span></div>
            <div className="ab-founder-info">
              <h3 className="ab-founder-name">Piyush Chaurasiya</h3>
              <p className="ab-founder-role">Founder &amp; CEO, Edulari</p>
              <div className="ab-founder-tags">
                <span className="ab-founder-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>B.Tech, Computer Engineering</span>
                <span className="ab-founder-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2a10 10 0 0 1 10 10h-10z"/><circle cx="12" cy="12" r="4"/></svg>Specialization: AI &amp; Machine Learning</span>
              </div>
              <p className="ab-founder-bio">Piyush Chaurasiya is the Founder and CEO of Edulari. He is currently pursuing a Bachelor of Technology (B.Tech) in Computer Engineering, with a specialization in Artificial Intelligence and Machine Learning. Driven by a passion for accessible education and technology, he founded Edulari with a vision to make quality learning available to everyone, everywhere.</p>
              <blockquote className="ab-founder-quote">&ldquo;I believe technology and education, combined thoughtfully, can give anyone the tools to build the life they want. That belief is why Edulari exists.&rdquo;<cite>— Piyush Chaurasiya</cite></blockquote>
            </div>
          </div>
        </section>

        <section className="ab-section ab-values">
          <span className="ab-eyebrow ab-eyebrow--center">What Drives Us</span>
          <h2 className="ab-section-title ab-section-title--center">Our Core Values</h2>
          <div className="ab-values-grid">
            <div className="ab-value-card"><div className="ab-value-icon ab-value-icon--blue"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><h3 className="ab-value-title">Quality First</h3><p className="ab-value-text">Every course is built with care, accuracy, and a genuine focus on learning outcomes.</p></div>
            <div className="ab-value-card"><div className="ab-value-icon ab-value-icon--green"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><h3 className="ab-value-title">Accessibility</h3><p className="ab-value-text">Learning should be available to anyone, anywhere, on any device — no barriers.</p></div>
            <div className="ab-value-card"><div className="ab-value-icon ab-value-icon--purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div><h3 className="ab-value-title">Innovation</h3><p className="ab-value-text">We keep improving our platform with modern technology, including AI-driven learning tools.</p></div>
            <div className="ab-value-card"><div className="ab-value-icon ab-value-icon--orange"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div><h3 className="ab-value-title">Learner Trust</h3><p className="ab-value-text">Transparency, honest communication, and real support whenever you need it.</p></div>
          </div>
        </section>

        <section className="ab-section ab-cta">
          <div className="ab-cta-card">
            <h2 className="ab-cta-title">Ready to start learning?</h2>
            <p className="ab-cta-sub">Explore our courses and take the next step toward your goals today.</p>
            <div className="ab-cta-actions">
              <a href="/browse-courses" className="ab-btn ab-btn--primary">Explore Courses</a>
              <a href="/contact" className="ab-btn ab-btn--ghost">Contact Us</a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
