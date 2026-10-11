"use client";

import { useState } from "react";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
};

const CAT_ICON: Record<string, string> = {
  security: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  account: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
  promo: "M23 6l-9.5 9.5-5-5L1 18",
  course: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z",
  instructor: "M12 8a4 4 0 100 8 4 4 0 000-8z",
  general: "M12 22a10 10 0 100-20 10 10 0 000 20z",
};

function iconCat(type: string): string {
  if (["new_login", "password_changed", "password_reset"].includes(type)) return "security";
  if (type === "welcome") return "account";
  if (["promotional", "recommendation"].includes(type)) return "promo";
  if (["new_course", "featured_course"].includes(type)) return "course";
  if (["instructor_approved", "instructor_rejected"].includes(type)) return "instructor";
  return "general";
}

function filterCat(type: string): string {
  if (["new_login", "password_changed", "password_reset", "welcome"].includes(type)) return "account";
  if (["new_course", "featured_course"].includes(type)) return "courses";
  return "updates";
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function UpdatesClient({ notifications, csrfToken }: { notifications: Notification[]; csrfToken: string }) {
  const [cards, setCards] = useState(notifications);
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const unread = cards.filter((c) => !c.is_read).length;

  const markRead = async (id: number) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, is_read: true } : c)));
    await fetch("/api/notifications/" + id + "/read", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
  };

  const deleteNotif = async (id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await fetch("/api/notifications/" + id + "/delete", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
  };

  const toggle = (id: number) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
      const card = cards.find((c) => c.id === id);
      if (card && !card.is_read) markRead(id);
    }
  };

  const filtered = cards.filter((c) => {
    if (filter === "all") return true;
    if (filter === "unread") return !c.is_read;
    return filterCat(c.type) === filter;
  });

  const catCounts: Record<string, number> = { all: cards.length, unread, account: 0, courses: 0, updates: 0 };
  for (const c of cards) catCounts[filterCat(c.type)]++;

  return (
    <>
      <div className="upd-filters" role="tablist" aria-label="Filter notifications">
        {(["all", "unread", "account", "courses", "updates"] as const).map((key) => (
          <button key={key} className={`upd-filter-btn ${filter === key ? "is-active" : ""}`} type="button" role="tab" data-filter={key} aria-selected={filter === key} onClick={() => setFilter(key)}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
            <span className="upd-filter-count">{catCounts[key]}</span>
          </button>
        ))}
      </div>

      <div className="upd-list" id="updList">
        {filtered.length === 0 && <div className="upd-no-results" id="updNoResults">No notifications in this category.</div>}
        {filtered.map((n) => {
          const cat = iconCat(n.type);
          const isOpen = openId === n.id;
          return (
            <div id={`notif-${n.id}`} key={n.id} className={`upd-card ${!n.is_read ? "is-unread" : ""} ${isOpen ? "is-open" : ""}`} data-id={n.id} data-unread={!n.is_read ? "1" : "0"} data-cat={filterCat(n.type)}>
              <div className="upd-row" role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => toggle(n.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(n.id); } }}>
                <div className={`upd-icon upd-icon--${cat}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="17" height="17"><path d={CAT_ICON[cat]} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                </div>
                <div className="upd-row-text">
                  <div className="upd-row-title">{n.title}</div>
                  <div className="upd-row-meta">
                    <span className="upd-tag">{n.type}</span>
                    <span>{timeAgo(n.created_at)}</span>
                  </div>
                </div>
                {!n.is_read && <div className="upd-dot" aria-label="Unread"></div>}
                <svg className="upd-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true"><polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              {isOpen && (
                <div className="upd-body" id={`body-${n.id}`} role="region" aria-label="Notification details">
                  <div className="upd-body-inner">{n.body}</div>
                  <div className="upd-body-footer">
                    <button className="upd-action-btn upd-action-btn--delete" type="button" onClick={() => deleteNotif(n.id)} aria-label="Delete this notification">
                      <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
