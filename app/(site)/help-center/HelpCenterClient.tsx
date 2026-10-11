"use client";

import { useState } from "react";

type FAQ = { cat: string; q: string; a: string };

const CATEGORIES = [
  { id: "getting-started", name: "Getting Started", desc: "Account setup, profile, and your first steps on Edulari.", color: "#6c63ff", bg: "#ede9fe", count: 6 },
  { id: "courses", name: "Courses & Learning", desc: "Enrolling, accessing content, and tracking your progress.", color: "#10b981", bg: "#d1fae5", count: 8 },
  { id: "quizzes", name: "Quizzes & Assignments", desc: "Attempt limits, retries, scoring rules and deadlines.", color: "#f59e0b", bg: "#fef3c7", count: 5 },
  { id: "certificates", name: "Certificates", desc: "Earning, downloading, and sharing your completion certificates.", color: "#8b5cf6", bg: "#ede9fe", count: 4 },
  { id: "billing", name: "Payments & Billing", desc: "Refunds, invoices, payment methods and pricing questions.", color: "#ef4444", bg: "#fef2f2", count: 5 },
  { id: "account", name: "Account & Profile", desc: "Password, email, notifications and privacy settings.", color: "#ec4899", bg: "#fdf2f8", count: 6 },
];

export default function HelpCenterClient({ faqs }: { faqs: FAQ[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = faqs.filter((f) => {
    if (filter !== "all" && f.cat !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }
    return true;
  });

  const toggle = (idx: number) => {
    setOpenId(openId === idx ? null : idx);
  };

  return (
    <>
      <section className="hc-hero">
        <div className="hc-hero-inner">
          <div className="hc-hero-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
            Help Center
          </div>
          <h1>How can we help you?</h1>
          <p>Find answers, guides and everything you need to make the most of Edulari.</p>
          <div className="hc-search-wrap">
            <svg className="hc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input id="hcSearchInput" type="text" className="hc-search-input" placeholder="Search articles, topics, or questions…" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" aria-label="Search help articles" />
            <button className="hc-search-btn" id="hcSearchBtn" onClick={() => setSearch(search)}>Search</button>
          </div>
          <div className="hc-popular">
            <span className="hc-popular-label">Popular:</span>
            {["certificate", "payment", "quiz", "enroll", "password"].map((tag) => (
              <span key={tag} className="hc-popular-tag" data-hc-quick={tag} role="button" tabIndex={0} onClick={() => setSearch(tag)}>{tag === "certificate" ? "Get certificate" : tag === "payment" ? "Payment & billing" : tag === "quiz" ? "Failed a quiz" : tag === "enroll" ? "Enroll in course" : "Reset password"}</span>
            ))}
          </div>
        </div>
      </section>

      <main className="hc-page">
        <div id="hcSearchResults" className="hc-search-results" role="region" aria-live="polite" hidden={search.trim() === ""}>
          <p className="hc-search-results-title" id="hcResultsLabel">{filtered.length} result{filtered.length === 1 ? "" : "s"} for &ldquo;{search}&rdquo;</p>
          <div id="hcResultsList">
            {filtered.slice(0, 10).map((f, i) => (
              <div key={`r${i}`} className="hc-search-result-item">
                <div className="hc-search-result-title">{f.q}</div>
                <div className="hc-search-result-excerpt">{f.a.slice(0, 140)}{f.a.length > 140 ? "…" : ""}</div>
              </div>
            ))}
          </div>
        </div>

        <section id="hcCategories">
          <h2 className="hc-section-title">Browse by Topic</h2>
          <div className="hc-categories">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="hc-cat-card" style={{ ["--cat-color" as string]: cat.color, ["--cat-bg" as string]: cat.bg }} onClick={() => { setFilter(cat.id); document.getElementById("hcFaqList")?.scrollIntoView({ behavior: "smooth" }); }}>
                <div className="hc-cat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div>
                <div className="hc-cat-name">{cat.name}</div>
                <div className="hc-cat-desc">{cat.desc}</div>
                <div className="hc-cat-count" style={{ color: cat.color }}>{cat.count} articles</div>
              </div>
            ))}
          </div>
        </section>

        <div className="hc-two-col">
          <section>
            <h2 className="hc-section-title">Frequently Asked Questions</h2>
            <div className="hc-faq-wrap">
              <div className="hc-faq-header">
                <div className="hc-faq-tabs" id="hcFaqTabs">
                  {["all", "getting-started", "courses", "quizzes", "certificates", "billing", "account"].map((f) => (
                    <button key={f} className={`hc-faq-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f === "all" ? "All" : f.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</button>
                  ))}
                </div>
              </div>
              <div id="hcFaqList">
                {filtered.length === 0 && <p>No results found.</p>}
                {filtered.map((f, idx) => (
                  <div key={idx} className="hc-accordion-item">
                    <button className="hc-accordion-btn" aria-expanded={openId === idx} onClick={() => toggle(idx)}>
                      {f.q}
                      <svg className="hc-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {openId === idx && (
                      <div className="hc-accordion-body">{f.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside id="contact">
            <h2 className="hc-section-title">Get Support</h2>
            <div className="hc-contact-stack">
              <div className="hc-contact-card">
                <div className="hc-contact-card-head">
                  <div className="hc-contact-card-icon" style={{ background: "#ede9fe", color: "#6c63ff" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
                  <div><div className="hc-contact-card-title">Live Chat</div><div className="hc-contact-card-sub">Fastest response</div></div>
                </div>
                <p>Chat with our support team and get answers in real time — usually under 5 minutes.</p>
                <button className="hc-contact-btn primary" id="hcChatBtn" onClick={() => alert("Live chat coming soon! Please email support for now.")}>Start Chat</button>
                <div className="hc-status-indicator"><span className="hc-status-dot"></span>Support team is online</div>
              </div>
              <div className="hc-contact-card">
                <div className="hc-contact-card-head">
                  <div className="hc-contact-card-icon" style={{ background: "#d1fae5", color: "#10b981" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></div>
                  <div><div className="hc-contact-card-title">Email Support</div><div className="hc-contact-card-sub">Reply within 24 hours</div></div>
                </div>
                <p>Send us a detailed message and our team will get back to you within one business day.</p>
                <a href="mailto:support@edulari-test.vercel.app" className="hc-contact-btn outline">Email Us</a>
              </div>
              <div className="hc-contact-card">
                <div className="hc-contact-card-head">
                  <div className="hc-contact-card-icon" style={{ background: "#fef3c7", color: "#f59e0b" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg></div>
                  <div><div className="hc-contact-card-title">Report a Bug</div><div className="hc-contact-card-sub">Something not working?</div></div>
                </div>
                <p>Spotted a technical issue? Let us know with details and a screenshot if possible.</p>
                <a href="/report-bug" className="hc-contact-btn outline" style={{ color: "#f59e0b", borderColor: "#f59e0b" }}>Report Bug</a>
              </div>
            </div>
          </aside>
        </div>

        <section>
          <h2 className="hc-section-title">Quick Links</h2>
          <div className="hc-quick-links">
            {[
              { href: "/student/dashboard", label: "Student Dashboard", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
              { href: "/student/my-courses", label: "My Courses", icon: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" },
              { href: "/student/certificates", label: "My Certificates", icon: "M12 8a6 6 0 100 12 6 6 0 000-12zM15.5 12.9L17 22l-5-3-5 3 1.5-9.1" },
              { href: "/student/profile", label: "Profile & Settings", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" },
              { href: "/browse-courses", label: "Browse All Courses", icon: "M11 11a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" },
              { href: "/track-report", label: "Track My Report", icon: "M11 11a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="hc-quick-link">
                <div className="hc-quick-link-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={l.icon} /></svg></div>
                {l.label}
                <span className="hc-quick-link-arrow">→</span>
              </a>
            ))}
          </div>
        </section>

        <div className="hc-helpful" id="hcHelpful">
          <h3>Was this page helpful?</h3>
          <p>Your feedback helps us improve our support resources.</p>
          <div className="hc-helpful-btns">
            <button className="hc-helpful-btn yes" onClick={() => { const el = document.getElementById("hcHelpful"); if (el) el.innerHTML = "<h3>Thanks for the feedback!</h3><p>Great to hear the Help Center was useful.</p>"; }}>Yes, it helped</button>
            <button className="hc-helpful-btn no" onClick={() => { const el = document.getElementById("hcHelpful"); if (el) el.innerHTML = "<h3>Thanks — we'll work on it!</h3><p>Your feedback helps us improve our support articles.</p>"; }}>Needs improvement</button>
          </div>
        </div>
      </main>
    </>
  );
}
