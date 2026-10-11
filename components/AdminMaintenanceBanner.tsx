import type { MaintenanceState } from "@/lib/maintenance";

/**
 * Port of public/partials/admin-maintenance-banner.php.
 *
 * Fully self-contained (own <style> with the admbn- prefix) so it renders the
 * same on every admin page regardless of which page CSS is loaded, and sticky
 * just below the fixed navbar (z-index 998 vs the navbar's 999).
 */
export default function AdminMaintenanceBanner({ state }: { state: MaintenanceState }) {
  if (!state.student && !state.instructor) return null;

  const scopes: string[] = [];
  if (state.student) scopes.push("Student");
  if (state.instructor) scopes.push("Instructor");
  const scopeLabel = scopes.length === 2 ? "Student & Instructor" : (scopes[0] ?? "Unknown");

  let autoNote = "";
  if (state.autoDisableAt) {
    const d = new Date(state.autoDisableAt);
    if (!Number.isNaN(d.getTime())) {
      autoNote = ` · Auto-disabling at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;
    }
  }

  return (
    <>
      <style>{`
        .admbn-bar {
            position: sticky;
            top: var(--unav-h, 64px);
            z-index: 998;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            width: 100%;
            padding: 10px 20px;
            background: #f59e0b;
            color: #1e1e2e;
            font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
            font-size: 13.5px;
            font-weight: 600;
            line-height: 1.4;
            box-shadow: 0 2px 6px rgba(0,0,0,.12);
        }
        .admbn-bar svg { flex-shrink: 0; }
        .admbn-bar strong { font-weight: 800; }
        .admbn-link {
            color: #1e1e2e;
            text-decoration: underline;
            font-weight: 700;
            white-space: nowrap;
        }
        .admbn-link:hover { opacity: .8; }
        @media (max-width: 640px) {
            .admbn-bar { font-size: 12.5px; padding: 8px 14px; }
        }
      `}</style>
      <div className="admbn-bar" id="adMaintBanner">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span><strong>Maintenance Mode Active</strong> &middot; Blocking: {scopeLabel}{autoNote}</span>
        <a href="/admin/settings" className="admbn-link">Settings</a>
      </div>
    </>
  );
}
