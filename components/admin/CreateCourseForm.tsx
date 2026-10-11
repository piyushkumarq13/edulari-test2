"use client";

import { useMemo, useRef, useState } from "react";

type Instructor = { id: number; name: string; email: string | null };
type Category = { id: number; name: string };

type Props = {
  csrfToken: string;
  categories: Category[];
  instructors: Instructor[];
  currencySymbol: string;
  currencyCode: string;
};

const LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Japanese",
  "Korean",
  "Chinese (Simplified)",
  "Russian",
  "Italian",
  "Dutch",
  "Turkish",
  "Polish",
  "Other",
];

const LEVEL_EMOJI: Record<string, string> = { beginner: "🟢", intermediate: "🟡", advanced: "🔴" };

function buildSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type FieldErrors = {
  instructor?: string;
  title?: string;
  short_description?: string;
  price?: string;
  passing?: string;
  duration?: string;
};

/**
 * The create-course.php form. The PHP drove preview/counters/validation/price toggle with inline JS;
 * this keeps the same markup and behaviour (same error strings, same preview text, same Free/Paid
 * name-swap on the two price inputs) using React state.
 */
export default function CreateCourseForm({ csrfToken, categories, instructors, currencySymbol, currencyCode }: Props) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [level, setLevel] = useState("beginner");
  const [language, setLanguage] = useState("English");
  const [durationHours, setDurationHours] = useState("0");
  const [pricingType, setPricingType] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("0.00");
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [passing, setPassing] = useState("70");

  const [instructorId, setInstructorId] = useState(0);
  const [instructorSearch, setInstructorSearch] = useState("");
  const [instructor, setInstructor] = useState<Instructor | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);

  const slug = buildSlug(title);
  const filteredInstructors = useMemo(() => {
    const q = instructorSearch.toLowerCase().trim();
    if (!q) return instructors;
    return instructors.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.email ?? "").toLowerCase().includes(q),
    );
  }, [instructors, instructorSearch]);

  const previewTitle = title.trim() || "Course title will appear here";
  const previewDesc = shortDescription.trim() || "Short description will appear here…";
  const previewLevel = `${LEVEL_EMOJI[level] ?? ""} ${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  const previewCategory = categoryId ? (categories.find((c) => String(c.id) === categoryId)?.name ?? "Uncategorized") : "Uncategorized";
  const previewDuration = `${Number.parseInt(durationHours, 10) || 0}h`;
  const previewPrice =
    pricingType === "free" ? "Free" : Number.parseFloat(price || "0") === 0 ? "Free" : `${currencySymbol}${(Number.parseFloat(price) || 0).toFixed(2)}`;

  function selectInstructor(item: Instructor) {
    setInstructorId(item.id);
    setInstructor(item);
    setErrors((e) => ({ ...e, instructor: undefined }));
  }

  function clearInstructor() {
    setInstructorId(0);
    setInstructor(null);
    setInstructorSearch("");
  }

  function validate(): boolean {
    let hasError = false;
    const next: FieldErrors = {};

    if (!instructorId || instructorId === 0) {
      next.instructor = "Please select an instructor.";
      hasError = true;
    }
    const t = title.trim();
    if (!t) {
      next.title = "Course title is required.";
      hasError = true;
    } else if (t.length < 5) {
      next.title = "Title must be at least 5 characters.";
      hasError = true;
    }
    const sd = shortDescription.trim();
    if (!sd) {
      next.short_description = "Short description is required.";
      hasError = true;
    } else if (sd.length < 20) {
      next.short_description = "Must be at least 20 characters.";
      hasError = true;
    }
    if (pricingType === "paid" && Number.parseFloat(price) < 0) {
      next.price = "Price cannot be negative.";
      hasError = true;
    }
    const ppv = Number.parseInt(passing, 10);
    if (Number.isNaN(ppv) || ppv < 0 || ppv > 100) {
      next.passing = "Must be between 0 and 100.";
      hasError = true;
    }
    if (Number.parseInt(durationHours, 10) < 0) {
      next.duration = "Duration cannot be negative.";
      hasError = true;
    }

    setErrors(next);
    return !hasError;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) {
      const first = formRef.current?.querySelector<HTMLElement>(".cc-field-error:not(:empty), .cc-instructor-empty:not(:empty)");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError("");

    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("instructor_id", String(instructorId));
    fd.set("category_id", categoryId);
    fd.set("title", title);
    fd.set("short_description", shortDescription);
    fd.set("description", description);
    fd.set("level", level);
    fd.set("language", language);
    fd.set("duration_hours", durationHours || "0");
    fd.set("price", pricingType === "free" ? "0" : price || "0");
    if (certificateEnabled) fd.set("certificate_enabled", "on");
    fd.set("passing_percentage", passing);

    try {
      const res = await fetch("/api/admin/courses", { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setError(data.error ?? "Failed to create course. Please try again.");
      setSubmitting(false);
    } catch {
      setError("Failed to create course. Please try again.");
      setSubmitting(false);
    }
  }

  const titleWarn = title.length >= 180;
  const sdWarn = shortDescription.length >= 450;

  return (
    <>
      {error ? (
        <div className="cc-alert cc-alert--error" role="alert" aria-live="assertive">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true" className="cc-alert-icon">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="cc-alert-body">
            <strong>Error:</strong> {error}
          </div>
          <button className="cc-alert-close" aria-label="Dismiss alert" onClick={() => setError("")}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <form method="post" id="createCourseForm" noValidate ref={formRef} onSubmit={handleSubmit}>
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div className="cc-form-layout">
          <div className="cc-form-main">
            {/* Card: Basic Information */}
            <div className="cc-card" id="section-basic">
              <div className="cc-card-header">
                <div className="cc-card-header-icon cc-card-header-icon--blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Basic Information</h2>
                  <p className="cc-card-desc">Core details that identify your course</p>
                </div>
              </div>
              <div className="cc-card-body">
                {/* Course Title */}
                <div className="cc-field" id="field-title">
                  <label className="cc-label" htmlFor="title">
                    Course Title
                    <span className="cc-label-required" aria-label="required">*</span>
                  </label>
                  <div className="cc-input-wrap">
                    <input
                      type="text"
                      id="title"
                      name="title"
                      className={`cc-input${errors.title ? " cc-input--error" : ""}`}
                      placeholder="e.g. Complete PHP & MySQL Development Bootcamp"
                      maxLength={200}
                      required
                      aria-describedby="title-hint title-counter"
                      value={title}
                      autoComplete="off"
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => {
                        const t = title.trim();
                        setErrors((er) => ({
                          ...er,
                          title: !t ? "Course title is required." : t.length < 5 ? "Title must be at least 5 characters." : undefined,
                        }));
                      }}
                    />
                  </div>
                  <div className="cc-field-footer">
                    <span className="cc-hint" id="title-hint">Aim for 60–80 characters. Be specific and compelling.</span>
                    <span className={`cc-char-counter${titleWarn ? " cc-char-counter--warn" : ""}`} id="title-counter" aria-live="polite">
                      <span id="title-count">{title.length}</span>/200
                    </span>
                  </div>
                  <div className="cc-slug-preview" id="slug-preview" aria-live="polite" style={{ display: "flex" }}>
                    <span className="cc-slug-label">URL slug:</span>
                    <span className="cc-slug-value" id="slug-value">{slug || "—"}</span>
                  </div>
                  <span className="cc-field-error" id="title-error" role="alert" aria-live="assertive">{errors.title}</span>
                </div>

                {/* Short Description */}
                <div className="cc-field" id="field-short-desc">
                  <label className="cc-label" htmlFor="short_description">
                    Short Description
                    <span className="cc-label-required" aria-label="required">*</span>
                    <span className="cc-label-badge">Shown on course cards</span>
                  </label>
                  <textarea
                    id="short_description"
                    name="short_description"
                    className={`cc-input cc-textarea cc-textarea--sm${errors.short_description ? " cc-input--error" : ""}`}
                    rows={3}
                    placeholder="A compelling 1–2 sentence summary that convinces students to enroll…"
                    maxLength={500}
                    required
                    aria-describedby="short-desc-hint short-desc-counter"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    onBlur={() => {
                      const t = shortDescription.trim();
                      setErrors((er) => ({
                        ...er,
                        short_description: !t ? "Short description is required." : t.length < 20 ? "Must be at least 20 characters." : undefined,
                      }));
                    }}
                  />
                  <div className="cc-field-footer">
                    <span className="cc-hint" id="short-desc-hint">20–160 characters recommended for best display across all devices.</span>
                    <span className={`cc-char-counter${sdWarn ? " cc-char-counter--warn" : ""}`} id="short-desc-counter" aria-live="polite">
                      <span id="short-desc-count">{shortDescription.length}</span>/500
                    </span>
                  </div>
                  <span className="cc-field-error" id="short-desc-error" role="alert" aria-live="assertive">{errors.short_description}</span>
                </div>

                {/* Full Description */}
                <div className="cc-field">
                  <label className="cc-label" htmlFor="description">
                    Full Description
                    <span className="cc-label-optional">(Optional — can add later)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    className="cc-input cc-textarea cc-textarea--lg"
                    rows={6}
                    placeholder={"What will students learn? Who is this course for? What are the prerequisites? What topics are covered?\n\nUse line breaks to organise your description."}
                    aria-describedby="desc-hint"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div className="cc-field-footer">
                    <span className="cc-hint" id="desc-hint">Detailed descriptions improve discoverability and student conversions.</span>
                    <span className="cc-char-counter" id="desc-counter" aria-live="polite">
                      <span id="desc-count">{description.length.toLocaleString()}</span> chars
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Course Details */}
            <div className="cc-card" id="section-details">
              <div className="cc-card-header">
                <div className="cc-card-header-icon cc-card-header-icon--violet" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Course Details</h2>
                  <p className="cc-card-desc">Classification, difficulty, and duration</p>
                </div>
              </div>
              <div className="cc-card-body">
                <div className="cc-grid cc-grid--2">
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="category_id">Category</label>
                    <div className="cc-select-wrap">
                      <select id="category_id" name="category_id" className="cc-select" aria-describedby="cat-hint" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">— Uncategorized —</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <svg className="cc-select-icon" viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="cc-hint" id="cat-hint">Helps students find your course</span>
                  </div>

                  <div className="cc-field">
                    <label className="cc-label" htmlFor="level">Difficulty Level</label>
                    <div className="cc-select-wrap">
                      <select id="level" name="level" className="cc-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="beginner">🟢 Beginner</option>
                        <option value="intermediate">🟡 Intermediate</option>
                        <option value="advanced">🔴 Advanced</option>
                      </select>
                      <svg className="cc-select-icon" viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="cc-grid cc-grid--2">
                  <div className="cc-field">
                    <label className="cc-label" htmlFor="language">Language</label>
                    <div className="cc-select-wrap">
                      <select id="language" name="language" className="cc-select" aria-describedby="lang-hint" value={language} onChange={(e) => setLanguage(e.target.value)}>
                        {LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                      <svg className="cc-select-icon" viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="cc-hint" id="lang-hint">Primary language of course content</span>
                  </div>

                  <div className="cc-field" id="field-duration">
                    <label className="cc-label" htmlFor="duration_hours">Estimated Duration</label>
                    <div className="cc-input-unit-wrap">
                      <input
                        type="number"
                        id="duration_hours"
                        name="duration_hours"
                        className={`cc-input cc-input--unit${errors.duration ? " cc-input--error" : ""}`}
                        min={0}
                        max={9999}
                        value={durationHours}
                        aria-describedby="duration-hint"
                        onChange={(e) => setDurationHours(e.target.value)}
                      />
                      <span className="cc-input-unit">hrs</span>
                    </div>
                    <span className="cc-hint" id="duration-hint">Approximate total hours of video/content</span>
                    <span className="cc-field-error" id="duration-error" role="alert" aria-live="assertive">{errors.duration}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Pricing & Monetisation */}
            <div className="cc-card" id="section-pricing">
              <div className="cc-card-header">
                <div className="cc-card-header-icon cc-card-header-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Pricing</h2>
                  <p className="cc-card-desc">Set 0 to offer this course for free</p>
                </div>
              </div>
              <div className="cc-card-body">
                <div className="cc-pricing-toggle" role="group" aria-label="Pricing type">
                  <button
                    type="button"
                    className={`cc-pricing-opt${pricingType === "free" ? " cc-pricing-opt--active" : ""}`}
                    id="opt-free"
                    aria-pressed={pricingType === "free"}
                    data-type="free"
                    onClick={() => setPricingType("free")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    Free
                  </button>
                  <button
                    type="button"
                    className={`cc-pricing-opt${pricingType === "paid" ? " cc-pricing-opt--active" : ""}`}
                    id="opt-paid"
                    aria-pressed={pricingType === "paid"}
                    data-type="paid"
                    onClick={() => setPricingType("paid")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                      <line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Paid
                  </button>
                </div>

                <div className="cc-field" id="price-field" style={{ display: pricingType === "free" ? "none" : undefined }}>
                  <label className="cc-label" htmlFor="price">Course Price ({currencySymbol})</label>
                  <div className="cc-input-unit-wrap">
                    <span className="cc-input-prefix">{currencySymbol}</span>
                    <input
                      type="number"
                      id="price"
                      name={pricingType === "free" ? undefined : "price"}
                      className={`cc-input cc-input--prefixed${errors.price ? " cc-input--error" : ""}`}
                      min={0}
                      step={0.01}
                      value={price}
                      placeholder="999.00"
                      aria-describedby="price-hint"
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <span className="cc-hint" id="price-hint">Displayed in {currencyCode} ({currencySymbol})</span>
                  <span className="cc-field-error" id="price-error" role="alert" aria-live="assertive">{errors.price}</span>
                </div>
                <input type="hidden" id="price-hidden" name={pricingType === "free" ? "price" : undefined} value="0" />
              </div>
            </div>

            {/* Card: Certificate & Assessment */}
            <div className="cc-card" id="section-cert">
              <div className="cc-card-header">
                <div className="cc-card-header-icon cc-card-header-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Certificate &amp; Assessment</h2>
                  <p className="cc-card-desc">Completion certificate and quiz pass threshold</p>
                </div>
              </div>
              <div className="cc-card-body">
                <label className="cc-toggle-row" htmlFor="certificate_enabled">
                  <div className="cc-toggle-info">
                    <span className="cc-toggle-title">Enable Certificate of Completion</span>
                    <span className="cc-toggle-desc">Students receive a certificate when they finish the course</span>
                  </div>
                  <div className="cc-toggle-switch">
                    <input
                      type="checkbox"
                      id="certificate_enabled"
                      name="certificate_enabled"
                      className="cc-toggle-input"
                      role="switch"
                      aria-checked={certificateEnabled}
                      checked={certificateEnabled}
                      onChange={(e) => setCertificateEnabled(e.target.checked)}
                    />
                    <span className="cc-toggle-thumb" aria-hidden="true" />
                  </div>
                </label>

                <div className="cc-field" id="passing-field">
                  <label className="cc-label" htmlFor="passing_percentage">Quiz Passing Percentage</label>
                  <div className="cc-range-wrap">
                    <input
                      type="range"
                      id="passing_range"
                      className="cc-range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.min(100, Math.max(0, Number.parseInt(passing, 10) || 0))}
                      aria-label="Passing percentage slider"
                      onChange={(e) => setPassing(e.target.value)}
                    />
                    <div className="cc-input-unit-wrap cc-range-input-wrap">
                      <input
                        type="number"
                        id="passing_percentage"
                        name="passing_percentage"
                        className={`cc-input cc-input--unit cc-input--sm${errors.passing ? " cc-input--error" : ""}`}
                        min={0}
                        max={100}
                        value={passing}
                        aria-describedby="pass-hint"
                        onChange={(e) => setPassing(e.target.value)}
                      />
                      <span className="cc-input-unit">%</span>
                    </div>
                  </div>
                  <span className="cc-hint" id="pass-hint">Minimum score required to pass quizzes (0 = no minimum)</span>
                  <span className="cc-field-error" id="passing-error" role="alert" aria-live="assertive">{errors.passing}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="cc-form-sidebar">
            <div className="cc-card cc-card--sticky" id="section-instructor">
              <div className="cc-card-header cc-card-header--compact">
                <div className="cc-card-header-icon cc-card-header-icon--red" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Instructor</h2>
                  <p className="cc-card-desc">Who owns this course</p>
                </div>
              </div>
              <div className="cc-card-body cc-card-body--compact">
                <div className="cc-field" id="field-instructor">
                  <label className="cc-label" htmlFor="instructor_id">
                    Assign Instructor
                    <span className="cc-label-required" aria-label="required">*</span>
                  </label>
                  <div className="cc-instructor-search">
                    <div className="cc-input-wrap cc-input-wrap--icon" style={{ display: instructor ? "none" : undefined }}>
                      <svg className="cc-input-icon" viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        type="text"
                        id="instructor-search"
                        className="cc-input cc-input--with-icon"
                        placeholder="Search instructors…"
                        autoComplete="off"
                        role="combobox"
                        aria-label="Search instructor list"
                        aria-controls="instructor-list"
                        aria-expanded={false}
                        value={instructorSearch}
                        onChange={(e) => setInstructorSearch(e.target.value)}
                      />
                    </div>
                    <div className="cc-instructor-list" id="instructor-list" role="listbox" aria-label="Instructors" style={{ display: instructor ? "none" : undefined }}>
                      {instructors.length === 0 ? (
                        <div className="cc-instructor-empty">
                          No instructors found. <a href="/admin/users">Add an instructor</a> first.
                        </div>
                      ) : (
                        filteredInstructors.map((inst) => (
                          <div
                            className="cc-instructor-item"
                            key={inst.id}
                            role="option"
                            aria-selected={instructorId === inst.id}
                            data-id={inst.id}
                            data-name={inst.name}
                            data-email={inst.email ?? ""}
                            tabIndex={0}
                            onClick={() => selectInstructor(inst)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectInstructor(inst);
                              }
                            }}
                          >
                            <div className="cc-instructor-avatar" aria-hidden="true">{inst.name.charAt(0).toUpperCase()}</div>
                            <div className="cc-instructor-info">
                              <span className="cc-instructor-name">{inst.name}</span>
                              {inst.email ? <span className="cc-instructor-email">{inst.email}</span> : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <input type="hidden" id="instructor_id" name="instructor_id" value={instructorId} required />
                  <div className="cc-instructor-selected" id="instructor-selected" style={{ display: instructor ? "flex" : "none" }} aria-live="polite">
                    <div className="cc-instructor-selected-avatar" id="instructor-selected-avatar" aria-hidden="true">
                      {instructor ? instructor.name.charAt(0).toUpperCase() : ""}
                    </div>
                    <div className="cc-instructor-selected-info">
                      <span className="cc-instructor-selected-name" id="instructor-selected-name">{instructor?.name}</span>
                      <span className="cc-instructor-selected-email" id="instructor-selected-email">{instructor?.email ?? ""}</span>
                    </div>
                    <button type="button" className="cc-instructor-clear" id="instructor-clear" aria-label="Clear instructor selection" onClick={clearInstructor}>
                      <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <span className="cc-field-error" id="instructor-error" role="alert" aria-live="assertive">{errors.instructor}</span>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div className="cc-card" id="preview-card">
              <div className="cc-card-header cc-card-header--compact">
                <div className="cc-card-header-icon cc-card-header-icon--slate" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h2 className="cc-card-title">Live Preview</h2>
                  <p className="cc-card-desc">How students will see this course</p>
                </div>
              </div>
              <div className="cc-card-body cc-card-body--compact">
                <div className="cc-preview-card">
                  <div className="cc-preview-thumb" aria-hidden="true">
                    <svg viewBox="0 0 64 48" fill="none" width="64" height="48">
                      <rect width="64" height="48" rx="6" fill="#f1f5f9" />
                      <path d="M24 16l16 8-16 8V16z" fill="#94a3b8" />
                    </svg>
                  </div>
                  <div className="cc-preview-body">
                    <div className="cc-preview-badges">
                      <span className="cc-preview-level" id="preview-level">{previewLevel}</span>
                      <span className="cc-preview-category" id="preview-category">{previewCategory}</span>
                    </div>
                    <p className="cc-preview-title" id="preview-title">{previewTitle}</p>
                    <p className="cc-preview-desc" id="preview-desc">{previewDesc}</p>
                    <div className="cc-preview-meta">
                      <span id="preview-duration">{previewDuration}</span>
                      <span>·</span>
                      <span id="preview-language">{language}</span>
                      <span>·</span>
                      <span id="preview-price">{previewPrice}</span>
                    </div>
                    <div className="cc-preview-cert" id="preview-cert" style={{ display: certificateEnabled ? "flex" : "none" }}>
                      <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
                        <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Certificate included
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="cc-actions-card">
              <div className="cc-form-status" id="form-status" aria-live="polite">
                <div className="cc-status-dot cc-status-dot--draft" aria-hidden="true" />
                <span>Will be saved as <strong>Draft</strong></span>
              </div>
              <button type="submit" className={`cc-btn cc-btn--primary cc-btn--full${submitting ? " cc-btn--loading" : ""}`} id="submit-btn" disabled={submitting}>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span id="submit-btn-text">{submitting ? "Creating course…" : "Create Course"}</span>
              </button>
              <a href="/admin/courses" className="cc-btn cc-btn--ghost cc-btn--full">Cancel</a>
              <p className="cc-actions-note">
                After creating, you can add sections, lessons, quizzes, and a thumbnail in <strong>Edit Course</strong>.
              </p>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
