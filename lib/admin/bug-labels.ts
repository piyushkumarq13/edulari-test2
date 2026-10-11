/**
 * Shared label maps for the admin bug-report pages (list + detail), ported from
 * public/admin/bug-reports.php (lines 70-81) and
 * public/admin/bug-report-detail.php (lines 126-143).
 */

/** List-page type labels. */
export const BUG_TYPE_LABELS_LIST: Record<string, string> = {
  bug: "🐛 Bug",
  ui: "🎨 UI",
  performance: "⚡ Perf",
  feature: "💡 Feature",
  content: "📝 Content",
  other: "❓ Other",
};

/** Detail-page type labels. */
export const BUG_TYPE_LABELS_DETAIL: Record<string, string> = {
  bug: "🐛 Bug/Error",
  ui: "🎨 UI Problem",
  performance: "⚡ Performance",
  feature: "💡 Feature Request",
  content: "📝 Wrong Content",
  other: "❓ Other",
};

/** List-page status labels (icon + label). */
export const BUG_STATUS_LABELS: Record<string, { label: string; icon: string }> = {
  open: { label: "Open", icon: "🟡" },
  in_progress: { label: "In Progress", icon: "🔵" },
  resolved: { label: "Resolved", icon: "✅" },
  wont_fix: { label: "Won't Fix", icon: "⛔" },
  duplicate: { label: "Duplicate", icon: "🔁" },
};

export type BugStatusConfig = { label: string; icon: string; color: string; bg: string; border: string };

/** Detail-page status config (label + colours). */
export const BUG_STATUS_CONFIG: Record<string, BugStatusConfig> = {
  open: { label: "Open", icon: "🟡", color: "#854d0e", bg: "#fef9c3", border: "#fde68a" },
  in_progress: { label: "In Progress", icon: "🔵", color: "#5b21b6", bg: "#ede9fe", border: "#c4b5fd" },
  resolved: { label: "Resolved", icon: "✅", color: "#15803d", bg: "#dcfce7", border: "#86efac" },
  wont_fix: { label: "Won't Fix", icon: "⛔", color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
  duplicate: { label: "Duplicate", icon: "🔁", color: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
};

/** Detail-page severity colours. */
export const BUG_SEVERITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  Low: { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" },
  Minor: { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7" },
  Moderate: { color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  High: { color: "#9a3412", bg: "#ffedd5", border: "#fdba74" },
  Critical: { color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
};

export function bugStatusConfig(status: string): BugStatusConfig {
  return BUG_STATUS_CONFIG[status] ?? BUG_STATUS_CONFIG.open;
}
