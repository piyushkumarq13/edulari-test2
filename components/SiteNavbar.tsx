/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";

type DropdownItem = { label: string; href: string; key?: string };
type NavItem = { label: string; href?: string; key?: string; dropdown?: DropdownItem[] };

function linksFor(role: string | null): NavItem[] {
  if (!role || role === "guest") {
    return [
      { label: "Explore Courses", href: "/browse-courses", key: "courses" },
      { label: "Categories", href: "/categories", key: "categories" },
      { label: "How It Works", href: "#", key: "how-it-works" },
      { label: "Verify Certificate", href: "/verify-certificate", key: "verify" },
      { label: "Teach With Us", href: "/instructor-register", key: "teach" },
      { 
        label: "Contact", 
        key: "contact-menu", 
        dropdown: [
          { label: "Contact Us", href: "/contact", key: "contact" },
          { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
        ]
      },
      { 
        label: "Support", 
        key: "support",
        dropdown: [
          { label: "Help Center", href: "/help-center", key: "help-center" },
          { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
          { label: "Track Report", href: "/track-report", key: "track-report" },
        ]
      },
    ];
  }
  if (role === "student") {
    return [
      { 
        label: "Explore", 
        key: "explore",
        dropdown: [
          { label: "Browse All Courses", href: "/browse-courses", key: "browse" },
          { label: "Categories", href: "/categories", key: "categories" },
          { label: "Verify Certificate", href: "/verify-certificate", key: "verify" },
        ]
      },
      { label: "Dashboard", href: "/student/dashboard", key: "dashboard" },
      { label: "My Learning", href: "/student/my-courses", key: "my-courses" },
      { label: "Certificates", href: "/student/certificates", key: "certificates" },
      { label: "My Schedule", href: "/student/schedule", key: "schedule" },
      { label: "Grades", href: "/student/grades", key: "grades" },
      { label: "Assignments", href: "#", key: "assignments" },
      { 
        label: "Contact", 
        key: "contact-menu",
        dropdown: [
          { label: "Contact Us", href: "/contact", key: "contact" },
          { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
        ]
      },
      { 
        label: "Support", 
        key: "support",
        dropdown: [
          { label: "Help Center", href: "/help-center", key: "help-center" },
          { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
          { label: "Track Report", href: "/track-report", key: "track-report" },
        ]
      },
    ];
  }
  if (role === "instructor") {
    return [
      { label: "Dashboard", href: "/instructor/dashboard", key: "dashboard" },
      { 
        label: "My Courses", 
        key: "courses-menu",
        dropdown: [
          { label: "All Courses", href: "/instructor/courses", key: "my-courses" },
          { label: "Create New Course", href: "/instructor/create-course", key: "create-course" },
          { label: "Course Analytics", href: "/instructor/course-analytics", key: "course-analytics" },
        ]
      },
      { label: "Students", href: "/instructor/students", key: "students" },
      { label: "Analytics", href: "/instructor/analytics", key: "analytics" },
      { label: "Earnings", href: "/instructor/earnings", key: "earnings" },
      { label: "Reviews", href: "/instructor/reviews", key: "reviews" },
      { label: "Messages", href: "#", key: "messages" },
      { 
        label: "Contact", 
        key: "contact-menu",
        dropdown: [
          { label: "Contact Us", href: "/contact", key: "contact" },
          { label: "Track My Ticket", href: "/track-contact", key: "track-contact" },
        ]
      },
      { 
        label: "Support", 
        key: "support",
        dropdown: [
          { label: "Help Center", href: "/help-center", key: "help-center" },
          { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
          { label: "Track Report", href: "/track-report", key: "track-report" },
        ]
      },
    ];
  }
  // Admin
  return [
    { label: "Dashboard", href: "/admin/dashboard", key: "dashboard" },
    { label: "Users", href: "/admin/users", key: "users" },
    { 
      label: "Courses", 
      key: "courses-menu",
      dropdown: [
        { label: "All Courses", href: "/admin/courses", key: "courses" },
        { label: "Create Course", href: "/admin/create-course", key: "create-course" },
      ]
    },
    { label: "Applications", href: "/admin/instructor-applications", key: "instructor-applications" },
    { label: "Enrollments", href: "/admin/enrollments", key: "enrollments" },
    { label: "Categories", href: "/admin/categories", key: "categories" },
    { label: "Reviews", href: "/admin/reviews", key: "reviews" },
    { label: "Bug Reports", href: "/admin/bug-reports", key: "bug-reports" },
    { label: "Contact Inbox", href: "/admin/contact-submissions", key: "contact-submissions" },
    { label: "Settings", href: "/admin/settings", key: "settings" },
    { label: "Banners", href: "/admin/banners", key: "banners" },
    { 
      label: "Support", 
      key: "support",
      dropdown: [
        { label: "Help Center", href: "/help-center", key: "help-center" },
        { label: "Report a Bug", href: "/report-bug", key: "report-bug" },
        { label: "Track Report", href: "/track-report", key: "track-report" },
      ]
    },
  ];
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  profile_image?: string;
}

export default function SiteNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<Array<{ id: number; title: string; type: string; created_at: string; is_read: boolean }>>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollPrevRef = useRef<HTMLButtonElement | null>(null);
  const scrollNextRef = useRef<HTMLButtonElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.user) setUser(d.user as User);
    }).catch(() => {});

    fetch("/api/security/csrf-token").then((r) => r.json()).then((d) => {
      if (d.token) setCsrfToken(d.token);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "instructor") {
      fetch("/api/notifications").then((r) => r.json()).then((d) => {
        if (Array.isArray(d.notifications)) {
          setUnreadCount(d.unreadCount ?? 0);
          setRecentNotifs((d.notifications ?? []).slice(0, 5));
        }
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    function handleScroll() {
      const nav = document.getElementById("unavNav");
      nav?.classList.toggle("unav-scrolled", window.scrollY > 6);
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      
      // Close all dropdowns unless clicking inside them
      let clickedInsideAny = false;
      dropdownRefs.current.forEach((ref) => {
        if (ref?.contains(target)) clickedInsideAny = true;
      });
      
      const notifBtn = document.getElementById("unavNotifBtn");
      const notifDd = document.getElementById("unavNotifDd");
      if (notifBtn?.contains(target) || notifDd?.contains(target)) clickedInsideAny = true;
      
      const profileBtn = document.getElementById("unavProfileBtn");
      const profileCard = document.getElementById("unavProfileCard");
      if (profileBtn?.contains(target) || profileCard?.contains(target)) clickedInsideAny = true;

      if (!clickedInsideAny) {
        closeAllDropdowns();
        setNotifOpen(false);
        setProfileOpen(false);
        document.body.style.overflow = "";
      }
    }
    
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAllDropdowns();
        setDrawerOpen(false);
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        document.body.style.overflow = "";
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  function getInitials(name: string): string {
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0]?.toUpperCase() || "?";
    const second = parts[1]?.[0]?.toUpperCase() || "";
    return first + second;
  }

  function closeAllDropdowns() {
    setOpenDropdown(null);
  }

  function toggleDropdown(index: number) {
    setOpenDropdown(openDropdown === index ? null : index);
  }

  function getAvatarUrl(imageName?: string): string {
    if (imageName) return `/api/media?type=avatar&id=${user?.id}&file=${encodeURIComponent(imageName)}`;
    return "";
  }

  function markAllNotificationsRead() {
    fetch("/api/notifications/read-all", { method: "POST" }).then(() => {
      setUnreadCount(0);
      setRecentNotifs([]);
    }).catch(() => {});
  }

  function logout() {
    if (!csrfToken) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/logout";
    const tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = "csrf_token";
    tokenInput.value = csrfToken;
    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();
  }

  const items = linksFor(user?.role ?? "guest");
  const isGuest = !user || user.role === "guest";

  return (
    <>
      <link rel="stylesheet" href="/assets/css/navbar.css" />
      
      <nav className="unav" id="unavNav" role="navigation" aria-label="Main navigation">
        <div className="unav-inner">
          {/* Hamburger */}
          <button 
            className="unav-hamburger" 
            id="unavHamburger"
            aria-label="Toggle navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="unavDrawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <span></span><span></span><span></span>
          </button>

          {/* Brand */}
          <a href="/" className="unav-brand" aria-label="Edulari — homepage">
            <img src="/assets/images/edulari-logo.png" alt="Edulari" />
          </a>

          {/* Desktop nav links with scroll arrows */}
          <div className="unav-links-wrap" id="unavLinksWrap">
            <button 
              className="unav-scroll-arrow unav-scroll-arrow--prev"
              id="unavScrollPrev"
              aria-label="Scroll navigation left"
              tabIndex={-1}
              ref={(el) => scrollPrevRef.current = el}
              onClick={() => scrollContainerRef.current?.scrollBy({ left: -160, behavior: 'smooth' })}
            >
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="unav-links-scroll" id="unavLinksScroll" ref={(el) => scrollContainerRef.current = el}>
              <div className="unav-links" role="list">
                {items.map((navItem, i) => {
                  const isActive = window.location.pathname === navItem.href || window.location.pathname.startsWith((navItem.href ?? '#') + '/');
                  
                  if (navItem.dropdown) {
                    return (
                      <div 
                        key={i}
                        className="unav-dd-wrap"
                        role="listitem"
                        onMouseEnter={() => window.innerWidth > 768 && setOpenDropdown(i)}
                        onMouseLeave={() => window.innerWidth > 768 && setOpenDropdown(null)}
                      >
                        <button
                          className={`unav-link${openDropdown === i ? " unav-open" : ""}`}
                          id={`unavDd${i}Btn`}
                          aria-haspopup="true"
                          aria-expanded={openDropdown === i}
                          aria-controls={`unavDd${i}`}
                          onClick={() => toggleDropdown(i)}
                        >
                          {navItem.label}
                          <svg className="unav-chev" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        
                        <div 
                          className={`unav-dd${openDropdown === i ? " unav-open" : ""}`}
                          id={`unavDd${i}`}
                          role="menu"
                          aria-label={`${navItem.label} menu`}
                          ref={(el) => dropdownRefs.current.push(el)}
                        >
                          {navItem.dropdown.map((sub, j) => {
                            const subActive = window.location.pathname === sub.href || window.location.pathname.startsWith(sub.href!.substring(1) + '/');
                            return (
                              <a 
                                key={j} 
                                href={sub.href}
                                className={`unav-dd-item${subActive ? " unav-active" : ""}`}
                                role="menuitem"
                                onClick={() => {
                                  closeAllDropdowns();
                                  if (window.innerWidth <= 768) setDrawerOpen(false);
                                }}
                              >
                                {sub.label}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <a 
                      key={i} 
                      href={navItem.href}
                      className={`unav-link${isActive ? " unav-active" : ""}`}
                      role="listitem"
                    >
                      {navItem.label}
                    </a>
                  );
                })}
              </div>
            </div>

            <button 
              className="unav-scroll-arrow unav-scroll-arrow--next"
              id="unavScrollNext"
              aria-label="Scroll navigation right"
              tabIndex={-1}
              ref={(el) => scrollNextRef.current = el}
              onClick={() => scrollContainerRef.current?.scrollBy({ left: 160, behavior: 'smooth' })}
            >
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Right actions */}
          <div className="unav-actions">
            {/* Search icon */}
            <button 
              className="unav-icon-btn" 
              id="unavSearchBtn"
              aria-label="Search (Ctrl+K)"
              aria-expanded={searchOpen}
              aria-controls="unavSearchModal"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {!isGuest && (
              <>
                {/* Wishlist icon */}
                <a 
                  href="/wishlist" 
                  className="unav-icon-btn unav-cart-btn"
                  aria-label="Wishlist"
                >
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                </a>

                {/* Cart icon */}
                <a 
                  href="/cart" 
                  className="unav-icon-btn unav-cart-btn"
                  aria-label="Cart"
                >
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>

                {/* Notification bell */}
                <div className="unav-notif-wrap">
                  <button
                    className="unav-icon-btn"
                    id="unavNotifBtn"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                    aria-expanded={notifOpen}
                    aria-haspopup="true"
                    aria-controls="unavNotifDd"
                    onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    {unreadCount > 0 && <span className="unav-notif-dot" aria-hidden="true"></span>}
                  </button>

                  {notifOpen && (
                    <div className="unav-notif-dd unav-open" id="unavNotifDd" role="menu" aria-label="Notifications">
                      <div className="unav-notif-head">
                        <div className="unav-notif-head-left">
                          <span>Notifications</span>
                          {unreadCount > 0 && <span className="unav-notif-count-badge">{unreadCount} new</span>}
                        </div>
                        {unreadCount > 0 && (
                          <button 
                            className="unav-notif-mark-all"
                            id="unavMarkAllRead"
                            onClick={() => markAllNotificationsRead()}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="unav-notif-body">
                        {recentNotifs.length === 0 && <div className="unav-notif-empty">No notifications yet</div>}
                        {recentNotifs.map((n) => (
                          <a
                            key={n.id}
                            href={`/updates?id=${n.id}`}
                            className={`unav-notif-item${!n.is_read ? " unav-notif-item--unread" : ""}`}
                            role="menuitem"
                            onClick={() => setNotifOpen(false)}
                          >
                            <div className="unav-notif-item-title">{n.title}</div>
                            <div className="unav-notif-item-meta">
                              {n.type} · {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </a>
                        ))}
                      </div>
                      <div className="unav-notif-footer">
                        <a href="/updates" className="unav-notif-view-all">View all updates →</a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar → profile dropdown */}
                <div className="unav-profile-wrap">
                  <button
                    className="unav-avatar-btn"
                    id="unavProfileBtn"
                    aria-label={`Account menu for ${user?.name}`}
                    aria-haspopup="true"
                    aria-expanded={profileOpen}
                    aria-controls="unavProfileCard"
                    onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                  >
                    {user?.profile_image ? (
                      <img 
                        src={getAvatarUrl(user.profile_image)} 
                        alt={user.name}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <span className={`unav-avatar-initials${!user?.profile_image ? "" : " hidden"}`}>{getInitials(user?.name ?? "User")}</span>
                  </button>

                  {profileOpen && (
                    <div className="unav-pd unav-open" id="unavProfileCard" role="menu" aria-label="Account menu" ref={(el) => dropdownRefs.current.push(el)}>
                      {/* Card header */}
                      <div className="unav-pd-head">
                        <div className="unav-pd-avatar" aria-hidden="true">
                          {user?.profile_image ? (
                            <img 
                              src={getAvatarUrl(user.profile_image)} 
                              alt={user.name ?? "User"}
                            />
                          ) : null}
                          {!user?.profile_image && <span>{getInitials(user?.name ?? "User")}</span>}
                        </div>
                        <div>
                          <p className="unav-pd-name">{user?.name}</p>
                          <p className="unav-pd-email">{user?.email}</p>
                          <span className={`unav-pd-badge unav-pd-badge--${user?.role}`}>
                            {user?.role === "admin" ? "Administrator" : user?.role === "instructor" ? "Instructor" : "Student"}
                          </span>
                        </div>
                      </div>

                      <div className="unav-pd-body">
                        {/* Account group */}
                        <div className="unav-pd-grp">
                          <a 
                            href={user?.role === "admin" ? "#" : user?.role === "instructor" ? "/instructor/profile" : "/student/profile"}
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                            My Profile
                          </a>

                          <a 
                            href="/updates" 
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Updates
                          </a>

                          {user?.role === "admin" && (
                            <a 
                              href="/admin/settings" 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/>
                              </svg>
                              Settings
                            </a>
                          )}

                          <a 
                            href="/security" 
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                            Security &amp; Password
                          </a>
                        </div>

                        {/* Student extras */}
                        {user?.role === "student" && (
                          <div className="unav-pd-grp">
                            <a 
                              href="/student/certificates" 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2"/>
                                <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              </svg>
                              Accomplishments
                            </a>
                            <a 
                              href="/student/purchase-history" 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                                <path d="M1 10h22" stroke="currentColor" strokeWidth="2"/>
                              </svg>
                              My Purchases
                            </a>
                          </div>
                        )}

                        {/* Instructor extras */}
                        {user?.role === "instructor" && (
                          <div className="unav-pd-grp">
                            <a 
                              href={`/instructor-profile?id=${user.id}`} 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                                <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              Public Profile
                            </a>
                            <a 
                              href="#" 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              Payout Settings
                            </a>
                          </div>
                        )}

                        {/* Admin extras */}
                        {user?.role === "admin" && (
                          <div className="unav-pd-grp">
                            <a 
                              href="#" 
                              className="unav-pd-item" 
                              role="menuitem"
                              onClick={() => setProfileOpen(false)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Audit Log
                            </a>
                          </div>
                        )}

                        {/* Support group */}
                        <div className="unav-pd-grp">
                          <a 
                            href="/help-center" 
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Help Center
                          </a>
                          <a 
                            href="/report-bug" 
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="2"/>
                              <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Report a Bug
                          </a>
                          <a 
                            href="/track-report" 
                            className="unav-pd-item" 
                            role="menuitem"
                            onClick={() => setProfileOpen(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <line x1="9" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Track My Report
                          </a>
                        </div>

                        {/* Sign Out */}
                        <div className="unav-pd-grp">
                          <button 
                            className="unav-pd-item unav-pd-item--danger" 
                            role="menuitem"
                            onClick={() => { setProfileOpen(false); logout(); }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Log Out
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </>
            )}

            {isGuest && (
              <>
                <a href="/login" className="unav-btn-ghost">Log In</a>
                <a href="/register" className="unav-btn-primary">Sign Up</a>
              </>
            )}
          </div>
        </div>

        {/* Mobile Drawer */}
        <div className={`unav-drawer${drawerOpen ? " unav-open" : ""}`} id="unavDrawer" aria-hidden={!drawerOpen}>
          {user && (
            <a 
              href={user.role === "admin" ? "#" : user.role === "instructor" ? "/instructor/profile" : "/student/profile"}
              className="unav-drawer-user"
              role="menuitem"
              onClick={() => setDrawerOpen(false)}
            >
              <div className="unav-drawer-avatar" aria-hidden="true">
                {user.profile_image ? (
                  <img src={getAvatarUrl(user.profile_image)} alt={user.name ?? "User"} />
                ) : null}
                {!user.profile_image && <span>{getInitials(user.name ?? "User")}</span>}
              </div>
              <div>
                <div className="unav-drawer-username">{user.name}</div>
                <div className="unav-drawer-role">{user.role === "admin" ? "Administrator" : user.role === "instructor" ? "Instructor" : "Student"}</div>
              </div>
              <svg className="unav-drawer-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          )}

          <div className="unav-drawer-links" role="menu">
            {items.map((navItem, i) => {
              if (navItem.dropdown) {
                return (
                  <div key={i} className="unav-drawer-acc">
                    <button className="unav-drawer-acc-btn" aria-expanded="false" aria-controls={`unavDrAcc${i}`}>
                      {navItem.label}
                      <svg className="unav-drawer-acc-chev" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <div className="unav-drawer-acc-panel" id={`unavDrAcc${i}`} hidden>
                      {navItem.dropdown.map((sub, j) => (
                        <a 
                          key={j} 
                          href={sub.href}
                          className="unav-drawer-link"
                          role="menuitem"
                          onClick={() => setDrawerOpen(false)}
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <a 
                  key={i} 
                  href={navItem.href}
                  className="unav-drawer-link"
                  role="menuitem"
                  onClick={() => setDrawerOpen(false)}
                >
                  {navItem.label}
                </a>
              );
            })}

            {user && user.role !== "admin" && user.role !== "instructor" && (
              <>
                <div className="unav-drawer-sep" role="separator"></div>
                
                <a href="/wishlist" className="unav-drawer-link" role="menuitem">
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                  Wishlist
                </a>
                
                <a href="/cart" className="unav-drawer-link" role="menuitem">
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Cart
                </a>
              </>
            )}

            {user && (
              <>
                <div className="unav-drawer-sep" role="separator"></div>
                
                <a href="/security" className="unav-drawer-link" role="menuitem">Security &amp; Password</a>
                <a href="#" className="unav-drawer-link" role="menuitem">Notification Preferences</a>
                
                {user.role === "student" && (
                  <>
                    <a href="/student/certificates" className="unav-drawer-link" role="menuitem">Accomplishments</a>
                    <a href="/student/purchase-history" className="unav-drawer-link" role="menuitem">My Purchases</a>
                  </>
                )}
                
                {user.role === "instructor" && (
                  <>
                    <a href={`/instructor-profile?id=${user.id}`} className="unav-drawer-link" role="menuitem">Public Profile</a>
                    <a href="#" className="unav-drawer-link" role="menuitem">Payout Settings</a>
                  </>
                )}
                
                {user.role === "admin" && (
                  <a href="#" className="unav-drawer-link" role="menuitem">Audit Log</a>
                )}

                <div className="unav-drawer-sep" role="separator"></div>
                
                <a href="/help-center" className="unav-drawer-link" role="menuitem">Help Center</a>
                <a href="/report-bug" className="unav-drawer-link" role="menuitem">Report a Bug</a>
                <a href="/track-report" className="unav-drawer-link" role="menuitem">Track My Report</a>

                <div className="unav-drawer-sep" role="separator"></div>

                <button className="unav-drawer-link unav-drawer-link--danger" role="menuitem" onClick={logout}>Log Out</button>
              </>
            )}

            {isGuest && (
              <>
                <div className="unav-drawer-sep" role="separator"></div>
                
                <a href="/login" className="unav-drawer-link" role="menuitem">Log In</a>
                <a href="/register" className="unav-drawer-link unav-drawer-link--signup" role="menuitem">Sign Up</a>
                
                <div className="unav-drawer-sep" role="separator"></div>
                
                <a href="/login" className="unav-drawer-link" role="menuitem">
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                  Wishlist
                </a>
                <a href="/login" className="unav-drawer-link" role="menuitem">
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Cart
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Search Modal */}
      <div className={`unav-search-modal${searchOpen ? " unav-open" : ""}`} id="unavSearchModal" role="dialog" aria-modal="true" aria-label="Search" aria-hidden={!searchOpen}>
        <div className="unav-search-box" role="document">
          <div className="unav-search-field">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input 
              type="search"
              className="unav-search-input"
              id="unavSearchInput"
              placeholder="Search courses, topics, instructors…"
              autoComplete="off"
              aria-label="Search"
              ref={searchInputRef}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = searchInputRef.current?.value.trim();
                  if (q) window.location.href = `/browse-courses?search=${encodeURIComponent(q)}`;
                }
              }}
            />
            <button 
              className="unav-search-submit" 
              type="button"
              aria-label="Submit search"
              onClick={() => {
                const q = searchInputRef.current?.value.trim();
                if (q) window.location.href = `/browse-courses?search=${encodeURIComponent(q)}`;
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <p className="unav-search-hint">
            Press <kbd>Enter</kbd> to search · <kbd>Esc</kbd> to close
          </p>
        </div>
      </div>

      <script nonce="" dangerouslySetInnerHTML={{ __html: `
        // Mobile accordion interactions
        document.querySelectorAll('.unav-drawer-acc-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var isExpanded = btn.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.unav-drawer-acc-btn').forEach(function(b) {
              var p = document.getElementById(b.getAttribute('aria-controls'));
              if (b !== btn && p) {
                b.setAttribute('aria-expanded', 'false');
                p.hidden = true;
              }
            });
            btn.setAttribute('aria-expanded', (!isExpanded).toString());
            var panel = document.getElementById(btn.getAttribute('aria-controls'));
            if (panel) panel.hidden = isExpanded;
          });
        });

        // CSS class visibility instead of display:none
        setTimeout(function() {
          var css = document.createElement('style');
          css.textContent = '.unav-drawer-acc-panel:not([hidden]) { display: block; }';
          document.head.appendChild(css);
        }, 0);
      `}} />
    </>
  );
}
