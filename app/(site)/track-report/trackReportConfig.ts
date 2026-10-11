type StatusCfg = {
  label: string; sublabel: string; color: string; bg: string; border: string; gradient: string;
  icon: string; heroIcon: string; step: number; pct: number; active: number; terminal: boolean; good: boolean;
};

export const STATUS_CONFIG: Record<string, StatusCfg> = {
  open: { label: "Open", sublabel: "Your report is in our queue", color: "#d97706", bg: "#fffbeb", border: "#fcd34d", gradient: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", icon: "\u{1F7E1}", heroIcon: "\u{1F4EC}", step: 1, pct: 20, active: 1, terminal: false, good: true },
  in_progress: { label: "In Progress", sublabel: "Our team is actively investigating", color: "#5b21b6", bg: "#f5f3ff", border: "#c4b5fd", gradient: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", icon: "\u{1F535}", heroIcon: "\u{1F50D}", step: 2, pct: 60, active: 2, terminal: false, good: true },
  resolved: { label: "Resolved", sublabel: "This issue has been fixed", color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7", gradient: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", icon: "✅", heroIcon: "\u{1F389}", step: 3, pct: 100, active: 3, terminal: true, good: true },
  wont_fix: { label: "Won't Fix", sublabel: "This issue has been reviewed and closed", color: "#991b1b", bg: "#fff5f5", border: "#fca5a5", gradient: "linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)", icon: "⛔", heroIcon: "\u{1F4CB}", step: 3, pct: 100, active: 3, terminal: true, good: false },
  duplicate: { label: "Duplicate", sublabel: "Already tracked under another report", color: "#374151", bg: "#f9fafb", border: "#d1d5db", gradient: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)", icon: "\u{1F501}", heroIcon: "\u{1F517}", step: 3, pct: 100, active: 3, terminal: true, good: false },
};

export const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  Low: { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7", dot: "#10b981" },
  Minor: { color: "#065f46", bg: "#d1fae5", border: "#6ee7b7", dot: "#10b981" },
  Moderate: { color: "#92400e", bg: "#fef3c7", border: "#fcd34d", dot: "#f59e0b" },
  High: { color: "#9a3412", bg: "#ffedd5", border: "#fdba74", dot: "#f97316" },
  Critical: { color: "#7f1d1d", bg: "#fee2e2", border: "#fca5a5", dot: "#ef4444" },
};

export const ISSUE_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  bug: { icon: "\u{1F41B}", label: "Bug / Error" },
  ui: { icon: "\u{1F3A8}", label: "UI Problem" },
  performance: { icon: "⚡", label: "Performance" },
  feature: { icon: "\u{1F4A1}", label: "Feature Request" },
  content: { icon: "\u{1F4DD}", label: "Wrong Content" },
  other: { icon: "❓", label: "Other Issue" },
};

export const TIMELINE_STEPS = [
  { icon: "\u{1F4E8}", label: "Submitted", desc: "Report received" },
  { icon: "\u{1F440}", label: "Under Review", desc: "Being reviewed" },
  { icon: "\u{1F527}", label: "In Progress", desc: "Fix in progress" },
  { icon: "✅", label: "Resolved", desc: "Issue closed" },
] as const;

/** Mirrors date('d M Y, H:i', ...) . ' UTC' from track-report.php. */
export function utcStamp(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${p(d.getUTCDate())} ${month} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/** Masks the reporter email exactly like track-report.php does. */
export function maskEmail(raw: string | null): string {
  if (!raw) return "";
  const [local = "", domain = ""] = raw.split("@", 2);
  return `${local.slice(0, 2)}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
}
