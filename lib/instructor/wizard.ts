import { z } from "zod";

export const STEP_LABELS: { icon: string; label: string }[] = [
  { icon: "✉️", label: "Account" },
  { icon: "👤", label: "Profile" },
  { icon: "🎓", label: "Credentials" },
  { icon: "📚", label: "Subjects" },
  { icon: "⚖️", label: "Legal" },
  { icon: "📋", label: "Review" },
  { icon: "🪪", label: "Documents" },
  { icon: "📝", label: "Test" },
];

export const PANEL_CONTENT: Record<number, { icon: string; headline: string; desc: string; tips: [string, string][]; trust: [string, string][] }> = {
  1: {
    icon: "✉️",
    headline: 'Create your <span>instructor account</span>',
    desc: "Join thousands of expert instructors sharing their knowledge. Let's start with the basics.",
    tips: [
      ["💡", "Use an email address you check regularly — it's your login."],
      ["🔒", "Your password is encrypted and never shared with anyone."],
      ["⚡", "The whole process takes about 10 minutes."],
    ],
    trust: [],
  },
  2: {
    icon: "👤",
    headline: 'Tell learners about <span>who you are</span>',
    desc: "A great profile headline and bio builds trust with students before they even enrol.",
    tips: [
      ["✍️", "Instructors with a detailed bio get 40% more enrolments."],
      ["🔗", "Adding LinkedIn or your website boosts profile credibility."],
      ["🎯", "Be specific about your expertise and teaching style."],
    ],
    trust: [],
  },
  3: {
    icon: "🎓",
    headline: 'Your <span>credentials</span> matter',
    desc: "Your academic and professional background helps us verify your expertise and builds student confidence.",
    tips: [
      ["📜", "Degrees and certifications make your courses more discoverable."],
      ["💼", "Even self-taught experts qualify — describe your experience."],
      ["🏆", "Notable works (books, talks, projects) set you apart."],
    ],
    trust: [],
  },
  4: {
    icon: "📚",
    headline: 'What will you <span>teach?</span>',
    desc: "Tell us about your subject expertise and the courses you plan to create for your learners.",
    tips: [
      ["🎯", "Focused course ideas perform better than broad topics."],
      ["👥", "Knowing your audience helps us match you with the right students."],
      ["🎬", "A sample content link gives your application a big advantage."],
    ],
    trust: [],
  },
  5: {
    icon: "⚖️",
    headline: 'Secure <span>payout setup</span>',
    desc: "This information is used only for your earnings payouts and tax compliance. It's fully encrypted.",
    tips: [],
    trust: [
      ["🔒", "256-bit SSL encryption on all data"],
      ["👁️", "Only admin team can access your details"],
      ["🗑️", "Documents deleted after review"],
      ["💳", "Bank details can be updated anytime from your dashboard"],
    ],
  },
  6: {
    icon: "📋",
    headline: 'Review your <span>application</span>',
    desc: "Take a moment to review everything you've entered before uploading your documents.",
    tips: [
      ["✏️", "Use the Edit buttons to correct any details before proceeding."],
      ["👀", "Double-check your payout details — they affect your earnings."],
      ["✅", "Once everything looks good, click Continue to upload your documents."],
    ],
    trust: [],
  },
  7: {
    icon: "🪪",
    headline: 'Almost <span>done!</span>',
    desc: "Upload your identity and academic documents for verification. They're deleted automatically after review.",
    tips: [],
    trust: [
      ["🔒", "Documents stored with 256-bit encryption"],
      ["👁️", "Visible only to our admin team"],
      ["🗑️", "Permanently deleted after your application is reviewed"],
      ["⏱️", "Review typically takes 2–3 business days"],
    ],
  },
  8: {
    icon: "📝",
    headline: 'One last step — the <span>competency test</span>',
    desc: "A short subject test to verify your expertise. It's fair, focused, and takes about 15–20 minutes.",
    tips: [
      ["🎯", "Questions are based on your declared subject and skill level."],
      ["⏱️", "You have 60 minutes once you click Start — find a quiet moment."],
      ["✅", "Score 60% or above to pass and complete your application."],
    ],
    trust: [],
  },
};

export const YEARS_EXP_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Less than 1 year" },
  { value: 1, label: "1–2 years" },
  { value: 3, label: "3–5 years" },
  { value: 6, label: "6–10 years" },
  { value: 11, label: "11–15 years" },
  { value: 16, label: "16+ years" },
];

export const YEARS_EXP_REVIEW: Record<number, string> = {
  0: "< 1 yr", 1: "1–2 yrs", 3: "3–5 yrs", 6: "6–10 yrs", 11: "11–15 yrs", 16: "16+ yrs",
};

export const TEACHING_STYLES = ["Project-based", "Lecture-based", "Hands-on / Lab", "Socratic / Discussion", "Mixed"];

export const EDUCATION_LEVELS = [
  "High School Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Professional Certification",
  "Self-taught / Bootcamp",
  "Other",
];

export const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "All Levels"];

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ── zod schemas (server-side validation, mirroring the PHP checks) ────────────────

export const step1Schema = z.object({
  name: z.string().trim().min(1, "Please fill in all required fields."),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter."),
  confirm_password: z.string(),
  terms: z.string().optional(),
}).refine((v) => v.password === v.confirm_password, {
  message: "Passwords do not match.",
  path: ["confirm_password"],
});

export const step2Schema = z.object({
  headline: z.string().trim().min(1, "Professional headline and bio are required.").max(120, "Headline must be 120 characters or fewer."),
  bio: z.string().trim().min(100, "Bio must be at least 100 characters."),
  // Optional in the PHP (only headline and bio are required).
  website: z.string().trim().optional().default(""),
  linkedin: z.string().trim().optional().default(""),
  twitter: z.string().trim().optional().default(""),
  years_exp: z.coerce.number().int().min(0).max(16).catch(0),
  teaching_style: z.string().trim().optional().default(""),
});

export const step3Schema = z.object({
  highest_education: z.string().trim().min(1, "Education details (degree, institution, field of study) are required."),
  institution: z.string().trim().min(1, "Education details (degree, institution, field of study) are required."),
  field_of_study: z.string().trim().min(1, "Education details (degree, institution, field of study) are required."),
  graduation_year: z.coerce.number().int().min(1960).max(new Date().getFullYear()).nullable().optional().or(z.literal("")),
  certifications: z.string().trim().optional().default(""),
  professional_exp: z.string().trim().min(1, "Please describe your professional experience."),
  notable_works: z.string().trim().optional().default(""),
});

export const step4Schema = z.object({
  primary_subject: z.string().trim().min(1, "Primary subject, skill level, and target audience are required."),
  // Optional in the PHP (only primary_subject, skill_level and target_audience are required).
  secondary_subjects: z.string().trim().optional().default(""),
  skill_level: z.string().trim().min(1, "Primary subject, skill level, and target audience are required."),
  target_audience: z.string().trim().min(1, "Primary subject, skill level, and target audience are required."),
  course_ideas: z.string().trim().min(50, "Please describe your course ideas in at least 50 characters."),
  sample_content: z.string().trim().optional().default(""),
});

/**
 * HTML checkboxes submit "1" when ticked and are absent when unticked, so both forms must
 * coerce: "1" -> true, undefined/""/"0" -> false. This matches the PHP, which used
 * isset($_POST['agree_terms']) ? 1 : 0.
 */
const checkbox = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "1" || v === "on");

export const step5Schema = z.object({
  pan_number: z.string().trim().toUpperCase().optional().default(""),
  bank_name: z.string().trim().optional().default(""),
  account_number: z.string().trim().optional().default(""),
  ifsc_code: z.string().trim().toUpperCase().optional().default(""),
  account_holder: z.string().trim().optional().default(""),
  skip_payout: checkbox,
  agree_terms: checkbox,
  agree_quality: checkbox,
  agree_revenue: checkbox,
}).refine((v) => v.agree_terms && v.agree_quality && v.agree_revenue, {
  message: "Please accept all three agreements to continue.",
}).refine(
  (v) => {
    if (v.skip_payout) return true;
    if (!v.pan_number || !v.bank_name || !v.account_number || !v.ifsc_code || !v.account_holder) {
      return false;
    }
    return PAN_RE.test(v.pan_number) && IFSC_RE.test(v.ifsc_code);
  },
  { message: "Invalid PAN number format. Expected format: ABCDE1234F" },
);

export const step7Schema = z.object({
  govt_id_file: z.string().trim(),
  marksheet_file: z.string().trim(),
});

export function formatRetryDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Step-guard. Returns the step the visitor should actually be on, or null when the
 * requested step is allowed. Mirrors the per-file guards in the PHP:
 *   step-1:  if ($step > 1)            -> forward to current step
 *   steps 2-8: if ($step < N)          -> back to the furthest step reached
 * Pure, so the rules are unit-tested directly.
 */
export function resolveStepGuard(requested: number, current: number): number | null {
  if (requested === 1 && current > 1) return current;
  if (requested > 1 && current < requested) return Math.max(1, current);
  return null;
}

/**
 * Which steps the review page (step-6) is allowed to send the applicant back to.
 * The PHP accepted 2..5 only; anything else is ignored.
 */
export function isEditableStep(target: number): boolean {
  return Number.isInteger(target) && target >= 2 && target <= 5;
}
