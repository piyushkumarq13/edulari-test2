/**
 * Admin-sendable notification types and audience options, shared by the server route handler and
 * the client form. Kept in a client-safe module (no DB/Next imports) so the form can import them
 * without pulling the server-only handler graph into the browser bundle.
 *
 * Both maps preserve the exact order and labels of send-notifications.php ($notifTypes and
 * $audienceOptions).
 */

export const NOTIF_TYPES: Record<string, string> = {
  announcement: "Announcement",
  general: "General",
  promotional: "Promotional",
  featured_course: "Featured Course",
  new_course: "New Course",
  recommendation: "Recommendation",
};

export const AUDIENCE_OPTIONS: Record<string, string> = {
  all: "All Users",
  student: "Students Only",
  instructor: "Instructors Only",
  admin: "Admins Only",
  specific: "Specific User (by email)",
};
