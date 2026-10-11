/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages */
"use client";

import { useEffect, useState, type JSX } from "react";

type Item = { label: string; href?: string; key?: string; dropdown?: Array<{ label: string; href: string; key?: string }> };

function linksFor(role: string | null): Item[] {
  if (!role || role === "guest") {
    return [
      { label: "Explore Courses", href: "/browse-courses", key: "courses" },
      { label: "Categories", href: "/categories", key: "categories" },
      { label: "How It Works", href: "#", key: "how-it-works" },
      { label: "Verify Certificate", href: "/verify-certificate", key: "verify" },
      { label: "Teach With Us", href: "/instructor-register", key: "teach" },
      { label: "Contact", key: "contact-menu", dropdown: [
        { label: "Contact Us", href: "/contact", key: "contact" },
        { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
      ]},
      { label: "Support", key: "support", dropdown: [
        { label: "Help Center", href: "/help-center", key: "help-center" },
        { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
        { label: "Track Report", href: "/track-report", key: "track-report" },
      ]},
    ];
  }
  if (role === "student") {
    return [
      { label: "Explore", key: "explore", dropdown: [
        { label: "Browse All Courses", href: "/browse-courses", key: "browse" },
        { label: "Categories", href: "/categories", key: "categories" },
        { label: "Verify Certificate", href: "/verify-certificate", key: "verify" },
      ]},
      { label: "Dashboard", href: "/student/dashboard", key: "dashboard" },
      { label: "My Learning", href: "/student/my-courses", key: "my-courses" },
      { label: "Certificates", href: "/student/certificates", key: "certificates" },
      { label: "My Schedule", href: "/student/schedule", key: "schedule" },
      { label: "Grades", href: "/student/grades", key: "grades" },
      { label: "Assignments", href: "#", key: "assignments" },
      { label: "Contact", key: "contact-menu", dropdown: [
        { label: "Contact Us", href: "/contact", key: "contact" },
        { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
      ]},
      { label: "Support", key: "support", dropdown: [
        { label: "Help Center", href: "/help-center", key: "help-center" },
        { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
        { label: "Track Report", href: "/track-report", key: "track-report" },
      ]},
    ];
  }
  if (role === "instructor") {
    return [
      { label: "Dashboard", href: "/instructor/dashboard", key: "dashboard" },
      { label: "My Courses", key: "courses-menu", dropdown: [
        { label: "All Courses", href: "/instructor/courses", key: "my-courses" },
        { label: "Create New Course", href: "/instructor/create-course", key: "create-course" },
        { label: "Course Analytics", href: "/instructor/course-analytics", key: "course-analytics" },
      ]},
      { label: "Students", href: "/instructor/students", key: "students" },
      { label: "Analytics", href: "/instructor/analytics", key: "analytics" },
      { label: "Earnings", href: "/instructor/earnings", key: "earnings" },
      { label: "Reviews", href: "/instructor/reviews", key: "reviews" },
      { label: "Messages", href: "#", key: "messages" },
      { label: "Contact", key: "contact-menu", dropdown: [
        { label: "Contact Us", href: "/contact", key: "contact" },
        { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
      ]},
      { label: "Support", key: "support", dropdown: [
        { label: "Help Center", href: "/help-center", key: "help-center" },
        { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
        { label: "Track Report", href: "/track-report", key: "track-report" },
      ]},
    ];
  }
  return [
    { label: "Dashboard", href: "/admin/dashboard", key: "dashboard" },
    { label: "Users", href: "/admin/users", key: "users" },
    { label: "Courses", key: "courses-menu", dropdown: [
      { label: "All Courses", href: "/admin/courses", key: "courses" },
      { label: "Create Course", href: "/admin/create-course", key: "create-course" },
    ]},
    { label: "Applications", href: "/admin/instructor-applications", key: "instructor-applications" },
    { label: "Enrollments", href: "/admin/enrollments", key: "enrollments" },
    { label: "Categories", href: "/admin/categories", key: "categories" },
    { label: "Reviews", href: "/admin/reviews", key: "reviews" },
    { label: "Bug Reports", href: "/admin/bug-reports", key: "bug-reports" },
    { label: "Contact Inbox", href: "/admin/contact-submissions", key: "contact-submissions" },
    { label: "Settings", href: "/admin/settings", key: "settings" },
    { label: "Banners", href: "/admin/banners", key: "banners" },
    { label: "Support", key: "support", dropdown: [
      { label: "Help Center", href: "/help-center", key: "help-center" },
      { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
      { label: "Track Report", href: "/track-report", key: "track-report" },
    ]},
  ];
}

export default function SiteNavbar(): JSX.Element {
  const [role, setRole] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<Array<{ id: number; title: string }>>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setRole(d.role ?? "guest")).catch(() => setRole("guest"));
  }, []);

  useEffect(() => {
    if (role && role !== "guest") {
      fetch("/api/notifications").then((r) => r.json()).then((d) => {
        setUnread(d.unreadCount ?? 0);
        setNotifs((d.notifications ?? []).slice(0, 5).map((n: { id: number; title: string }) => ({ id: n.id, title: n.title })));
      }).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    const handler = () => {
      const nav = document.getElementById("unavNav");
      nav?.classList.toggle("unav-scrolled", window.scrollY > 4);
    };
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Fix dropdown hover/touch behavior
  const handleDropdownMouseEnter = (index: number) => {
    setOpenIdx(index);
  };
  
  const handleDropdownMouseLeave = () => {
    setOpenIdx(null);
  };

  const items = linksFor(role);

  return (
    <nav className="unav" id="unavNav" role="navigation" aria-label="Main navigation">
      <div className="unav-inner">
        <button className="unav-hamburger" id="unavHamburger" aria-label="Toggle navigation menu" aria-expanded={drawerOpen} aria-controls="unavDrawer" onClick={() => setDrawerOpen((v) => !v)}>
          <span></span><span></span><span></span>
        </button>

        <a href="/" className="unav-brand" aria-label="Edulari — homepage">
          <img src="/assets/images/edulari-logo.png" alt="Edulari" />
        </a>

        <div className="unav-links-wrap" id="unavLinksWrap">
          <button className="unav-scroll-arrow unav-scroll-arrow--prev" aria-label="Scroll navigation left" tabIndex={-1}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="unav-links-scroll" id="unavLinksScroll">
            <div className="unav-links" role="list">
              {items.map((it, i) => it.dropdown ? (
                <div 
                  className="unav-dd-wrap" 
                  key={i} 
                  role="listitem"
                  onMouseEnter={() => handleDropdownMouseEnter(i)}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  <button 
                    className="unav-link" 
                    aria-haspopup="true" 
                    aria-expanded={openIdx === i} 
                    aria-controls={`unavDd${i}`}
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  >
                    {it.label}
                    <svg className="unav-chev" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <div 
                    className={`unav-dd ${openIdx === i ? "unav-open" : ""}`} 
                    id={`unavDd${i}`} 
                    role="menu" 
                    aria-label={`${it.label} menu`}
                  >
                    {it.dropdown!.map((sub, j) => (
                      <a key={j} href={sub.href} className="unav-dd-item" role="menuitem">{sub.label}</a>
                    ))}
                  </div>
                </div>
              ) : (
                <a key={i} href={it.href} className="unav-link" role="listitem">{it.label}</a>
              ))}
            </div>
          </div>
          <button className="unav-scroll-arrow unav-scroll-arrow--next" aria-label="Scroll navigation right" tabIndex={-1}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="unav-actions">
          {role && role !== "guest" && (
            <div className="unav-dd-wrap">
              <button className="unav-link" aria-label="Notifications" onClick={() => setNotifOpen((v) => !v)}>
                &#128276;{unread > 0 ? ` ${unread}` : ""}
              </button>
              {notifOpen && (
                <div className="unav-dd">
                  {notifs.length === 0 && <span className="unav-dd-item">No notifications</span>}
                  {notifs.map((n) => (
                    <a key={n.id} href="#" className="unav-dd-item" onClick={() => fetch("/api/notifications/read-all", { method: "POST" }).then(() => setUnread(0))}>{n.title}</a>
                  ))}
                </div>
              )}
            </div>
          )}
          {role === "guest" && (
            <>
              <a href="/login" className="unav-link">Login</a>
              <a href="/register" className="unav-link">Sign Up</a>
            </>
          )}
          {role && role !== "guest" && (
            <a href="/logout" className="unav-link">Logout</a>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="unav-drawer" id="unavDrawer">
          {items.flatMap((it, i) => it.dropdown ? it.dropdown!.map((sub, j) => (
            <a key={`${i}-${j}`} href={sub.href} className="unav-dd-item" onClick={() => setDrawerOpen(false)}>{sub.label}</a>
          )) : [<a key={i} href={it.href} className="unav-dd-item" onClick={() => setDrawerOpen(false)}>{it.label}</a>])}
        </div>
      )}
    </nav>
  );
}
