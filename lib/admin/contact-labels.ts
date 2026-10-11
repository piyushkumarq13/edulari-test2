/**
 * Shared label maps for the admin contact-submission pages (list + detail),
 * ported from public/admin/contact-submissions.php (lines 85-108) and
 * public/admin/contact-submission-detail.php (lines 141-164).
 */

export const CONTACT_CATEGORY_LABELS: Record<string, string> = {
  general: "General Inquiry",
  billing: "Billing & Payments",
  technical: "Technical Issue",
  course_content: "Course Content",
  account: "Account & Profile",
  instructor: "Instructor Support",
  partnership: "Partnership / Business",
  feedback: "Feedback & Suggestions",
  other: "Other",
};

export type ContactMeta = { label: string; class: string };

/** List-page status badge classes (acs-badge--*). */
export const CONTACT_STATUS_META_LIST: Record<string, ContactMeta> = {
  open: { label: "Open", class: "acs-badge--open" },
  in_progress: { label: "In Progress", class: "acs-badge--progress" },
  waiting: { label: "Waiting", class: "acs-badge--waiting" },
  resolved: { label: "Resolved", class: "acs-badge--resolved" },
  closed: { label: "Closed", class: "acs-badge--closed" },
};

/** List-page priority classes (acs-pri--*). */
export const CONTACT_PRIORITY_META_LIST: Record<string, ContactMeta> = {
  low: { label: "Low", class: "acs-pri--low" },
  normal: { label: "Normal", class: "acs-pri--normal" },
  high: { label: "High", class: "acs-pri--high" },
  urgent: { label: "Urgent", class: "acs-pri--urgent" },
};

/** Detail-page status classes (acsd-status--*). */
export const CONTACT_STATUS_META_DETAIL: Record<string, ContactMeta> = {
  open: { label: "Open", class: "acsd-status--open" },
  in_progress: { label: "In Progress", class: "acsd-status--progress" },
  waiting: { label: "Waiting", class: "acsd-status--waiting" },
  resolved: { label: "Resolved", class: "acsd-status--resolved" },
  closed: { label: "Closed", class: "acsd-status--closed" },
};

/** Detail-page priority classes (acsd-pri--*). */
export const CONTACT_PRIORITY_META_DETAIL: Record<string, ContactMeta> = {
  low: { label: "Low", class: "acsd-pri--low" },
  normal: { label: "Normal", class: "acsd-pri--normal" },
  high: { label: "High", class: "acsd-pri--high" },
  urgent: { label: "Urgent", class: "acsd-pri--urgent" },
};

/** The five select options, in the PHP order, for the reply / status selects. */
export const CONTACT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function ucfirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function categoryLabel(category: string): string {
  return CONTACT_CATEGORY_LABELS[category] ?? ucfirst(category.replace(/_/g, " "));
}

export function contactStatusMeta(map: Record<string, ContactMeta>, status: string, fallbackClass: string): ContactMeta {
  return map[status] ?? { label: ucfirst(status), class: fallbackClass };
}

export function contactPriorityMeta(map: Record<string, ContactMeta>, priority: string, fallbackClass: string): ContactMeta {
  return map[priority] ?? { label: ucfirst(priority), class: fallbackClass };
}
