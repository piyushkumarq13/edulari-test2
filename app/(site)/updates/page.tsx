import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import "@/styles/css/updates.css";
import { requireUser } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { listForUser, unreadCount } from "@/lib/notifications";
import UpdatesClient from "./UpdatesClient";
import MarkAllReadButton from "./MarkAllReadButton";
export const metadata: Metadata = pageMetadata({
  title: "Updates & Notifications - Edulari",
  description: "View and manage your notifications.",
  noindex: true,
});

export default async function UpdatesPage() {
  const user = await requireUser();
  const [notifications, unread, csrfToken] = await Promise.all([listForUser(user.id, 50, 0), unreadCount(user.id), readCsrfToken()]);

  return (
    <main className="upd-wrap">
      <div className="upd-header">
        <div className="upd-header-left">
          <div className="upd-title-row">
            <h1 className="upd-title">Updates</h1>
            {unread > 0 && <span className="upd-badge" id="updUnreadBadge">{unread} new</span>}
          </div>
          <p className="upd-subtitle">{notifications.length} notification{notifications.length !== 1 ? "s" : ""} total</p>
        </div>
        {notifications.length > 0 && (
          <div className="upd-header-actions">
            <MarkAllReadButton disabled={unread === 0} csrfToken={csrfToken} />
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="upd-empty">
          <div className="upd-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" width="26" height="26" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </div>
          <h3>No notifications yet</h3>
          <p>You&apos;re all caught up! Check back later for updates.</p>
        </div>
      ) : (
        <UpdatesClient notifications={JSON.parse(JSON.stringify(notifications))} csrfToken={csrfToken} />
      )}

      <div className="upd-toast" id="updToast" role="status" aria-live="polite"></div>
    </main>
  );
}
