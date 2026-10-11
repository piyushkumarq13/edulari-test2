"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice, phpNumber } from "@/lib/format";

type Category = { id: number; name: string };
type Instructor = { id: number; name: string };

export type EditCourse = {
  id: number;
  instructor_id: number;
  category_id: number | null;
  title: string;
  short_description: string | null;
  description: string | null;
  level: string;
  language: string;
  duration_hours: number;
  price: string;
  is_published: boolean;
  is_featured: boolean;
  certificate_enabled: boolean;
  passing_percentage: number;
  thumbnail: string | null;
  instructor_name: string | null;
  category_name: string | null;
};

type Props = {
  csrfToken: string;
  course: EditCourse;
  createdLabel: string | null;
  updatedLabel: string | null;
  overview: { enrollmentCount: number; reviewCount: number; avgRating: number | null; sectionCount: number; lessonCount: number };
  categories: Category[];
  instructors: Instructor[];
  currencySymbol: string;
  success: string;
};

const slug = (str: string): string =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);

function thumbSrc(key: string | null): string {
  if (!key) return "";
  return key.startsWith("http") ? key : `/media?type=avatar&key=${encodeURIComponent(key)}`;
}

/**
 * edit-course.php. The PHP ran preview/counters/validation/thumbnail preview in inline JS and did a
 * server-side PRG; this keeps identical markup and error strings, posts to /api/admin/courses/[id]
 * and follows the redirect the handler returns.
 */
export default function EditCourseForm({ csrfToken, course, createdLabel, updatedLabel, overview, categories, instructors, currencySymbol, success }: Props) {
  const [instructorId, setInstructorId] = useState(course.instructor_id ? String(course.instructor_id) : "");
  const [title, setTitle] = useState(course.title);
  const [shortDescription, setShortDescription] = useState(course.short_description ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [categoryId, setCategoryId] = useState(course.category_id ? String(course.category_id) : "");
  const [level, setLevel] = useState(course.level);
  const [language, setLanguage] = useState(course.language);
  const [durationHours, setDurationHours] = useState(String(course.duration_hours));
  const [price, setPrice] = useState(course.price);
  const [passing, setPassing] = useState(String(course.passing_percentage));
  const [isPublished, setIsPublished] = useState(course.is_published);
  const [isFeatured, setIsFeatured] = useState(course.is_featured);
  const [certificateEnabled, setCertificateEnabled] = useState(course.certificate_enabled);

  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState(thumbSrc(course.thumbnail));
  const [hasPreview, setHasPreview] = useState(Boolean(course.thumbnail));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(success);
  const [successFading, setSuccessFading] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => {
      setSuccessFading(true);
      setTimeout(() => setSuccessMsg(""), 500);
    }, 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const titleCount = title.length;
  const sdCount = shortDescription.length;
  const descCount = description.length;
  const titleWarn = titleCount > 160;
  const sdWarn = sdCount > 400;

  const slugValue = slug(title) || "—";
  const slugVisible = Boolean(slug(title));

  const priceValue = Number.parseFloat(price);
  const pricePreview = Number.isNaN(priceValue) || priceValue <= 0 ? "🆓 Free course" : `💰 Paid: ${formatPrice(priceValue)}`;

  const passValue = Math.min(100, Math.max(0, Number.parseInt(passing, 10) || 0));
  const passColor = passValue < 40 ? "#dc2626" : passValue < 70 ? "#d97706" : "#16a34a";

  function setFieldError(field: string, msg: string) {
    setErrors((e) => ({ ...e, [field]: msg }));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(f.type)) {
      setFieldError("thumbnail", "Invalid type. Only JPG, PNG, WebP allowed.");
      e.target.value = "";
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setFieldError("thumbnail", "File too large. Max 2 MB.");
      e.target.value = "";
      return;
    }
    setFieldError("thumbnail", "");
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewSrc(String(ev.target?.result ?? ""));
      setHasPreview(true);
    };
    reader.readAsDataURL(f);
  }

  function clearFile() {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
    setFieldError("thumbnail", "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let valid = true;
    const next: Record<string, string> = {};

    const t = title.trim();
    if (!t) {
      next.title = "Course title is required.";
      valid = false;
    } else if (t.length > 200) {
      next.title = "Title must be 200 characters or fewer.";
      valid = false;
    }
    if (!shortDescription.trim()) {
      next["short-desc"] = "Short description is required.";
      valid = false;
    }
    if (!instructorId) {
      next.instructor = "Please select an instructor.";
      valid = false;
    }
    if (Number.parseFloat(price) < 0) {
      next.price = "Price cannot be negative.";
      valid = false;
    }
    const pv = Number.parseInt(passing, 10);
    if (pv < 0 || pv > 100) {
      next.passing = "Must be between 0 and 100.";
      valid = false;
    }

    setErrors(next);
    if (!valid) {
      const first = formRef.current?.querySelector<HTMLElement>(".ec-field--error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setError("");

    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("instructor_id", instructorId);
    fd.set("title", title);
    fd.set("short_description", shortDescription);
    fd.set("description", description);
    fd.set("category_id", categoryId);
    fd.set("level", level);
    fd.set("language", language);
    fd.set("duration_hours", durationHours || "0");
    fd.set("price", price || "0");
    fd.set("passing_percentage", passing);
    if (isPublished) fd.set("is_published", "on");
    if (isFeatured) fd.set("is_featured", "on");
    if (certificateEnabled) fd.set("certificate_enabled", "on");
    if (file) fd.set("thumbnail", file);

    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, { method: "POST", body: fd });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setError(data.error ?? "Failed to update course. Please try again.");
      setSubmitting(false);
    } catch {
      setError("Failed to update course. Please try again.");
      setSubmitting(false);
    }
  }

  const errField = (id: string) => `ec-field${errors[id] ? " ec-field--error" : ""}`;

  return (
    <>
      {successMsg ? (
        <div
          className="ec-alert ec-alert--success"
          role="alert"
          aria-live="polite"
          id="ec-success-alert"
          style={successFading ? { transition: "opacity 0.5s ease", opacity: 0 } : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true" className="ec-alert-icon">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="ec-alert-body">
            <strong>Success!</strong> {successMsg}
          </div>
          <button className="ec-alert-close" aria-label="Dismiss" onClick={() => setSuccessMsg("")}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="ec-alert ec-alert--error" role="alert" aria-live="assertive">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true" className="ec-alert-icon">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="ec-alert-body">
            <strong>Error:</strong> {error}
          </div>
          <button className="ec-alert-close" aria-label="Dismiss" onClick={() => setError("")}>
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ) : null}

      <form method="post" id="editCourseForm" encType="multipart/form-data" noValidate ref={formRef} onSubmit={handleSubmit}>
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div className="ec-layout">
          <div className="ec-form-main">
            {/* Card: Basic Information */}
            <div className="ec-card" id="section-basic">
              <div className="ec-card-header">
                <div className="ec-card-icon ec-card-icon--blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="ec-card-title">Basic Information</h2>
                  <p className="ec-card-desc">Core details that identify your course</p>
                </div>
              </div>
              <div className="ec-card-body">
                {/* Instructor */}
                <div className={errField("instructor")} id="field-instructor">
                  <label className="ec-label" htmlFor="instructor_id">
                    Assign to Instructor
                    <span className="ec-label-required" aria-label="required">*</span>
                  </label>
                  <div className="ec-select-wrap">
                    <select id="instructor_id" name="instructor_id" className="ec-select" required aria-describedby="instructor-error" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                      <option value="">— Select Instructor —</option>
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                    <svg className="ec-select-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="ec-field-error" id="instructor-error" role="alert" aria-live="assertive">{errors.instructor}</span>
                </div>

                {/* Title */}
                <div className={errField("title")} id="field-title">
                  <label className="ec-label" htmlFor="title">
                    Course Title
                    <span className="ec-label-required" aria-label="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="ec-input"
                    placeholder="e.g. Complete PHP & MySQL Development Bootcamp"
                    maxLength={200}
                    required
                    aria-describedby="title-hint title-counter title-error"
                    value={title}
                    autoComplete="off"
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setFieldError("title", title.trim() ? "" : "Course title is required.")}
                  />
                  <div className="ec-field-footer">
                    <span className="ec-hint" id="title-hint">Aim for 60–80 characters. Be specific and compelling.</span>
                    <span className={`ec-char-counter${titleWarn ? " ec-char-counter--warn" : ""}`} id="title-counter" aria-live="polite">
                      <span id="title-count">{titleCount}</span>/200
                    </span>
                  </div>
                  <div className={`ec-slug-preview${slugVisible ? " ec-slug-preview--visible" : ""}`} id="slug-preview" aria-live="polite">
                    <span className="ec-slug-label">URL slug:</span>
                    <span className="ec-slug-value" id="slug-value">{slugValue}</span>
                  </div>
                  <span className="ec-field-error" id="title-error" role="alert" aria-live="assertive">{errors.title}</span>
                </div>

                {/* Short Description */}
                <div className={errField("short-desc")} id="field-short-desc">
                  <label className="ec-label" htmlFor="short_description">
                    Short Description
                    <span className="ec-label-required" aria-label="required">*</span>
                    <span className="ec-label-badge">Shown on course cards</span>
                  </label>
                  <textarea
                    id="short_description"
                    name="short_description"
                    className="ec-input ec-textarea ec-textarea--sm"
                    rows={3}
                    placeholder="A compelling 1–2 sentence summary that convinces students to enroll…"
                    maxLength={500}
                    required
                    aria-describedby="short-desc-hint short-desc-counter short-desc-error"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    onBlur={() => setFieldError("short-desc", shortDescription.trim() ? "" : "Short description is required.")}
                  />
                  <div className="ec-field-footer">
                    <span className="ec-hint" id="short-desc-hint">20–160 characters recommended for best display.</span>
                    <span className={`ec-char-counter${sdWarn ? " ec-char-counter--warn" : ""}`} id="short-desc-counter" aria-live="polite">
                      <span id="short-desc-count">{sdCount}</span>/500
                    </span>
                  </div>
                  <span className="ec-field-error" id="short-desc-error" role="alert" aria-live="assertive">{errors["short-desc"]}</span>
                </div>

                {/* Full Description */}
                <div className="ec-field">
                  <label className="ec-label" htmlFor="description">
                    Full Description
                    <span className="ec-label-optional">(optional)</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    className="ec-input ec-textarea ec-textarea--lg"
                    rows={7}
                    placeholder={"What will students learn? Who is this course for? What are the prerequisites?\n\nUse line breaks to organise your description."}
                    aria-describedby="desc-hint desc-counter"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div className="ec-field-footer">
                    <span className="ec-hint" id="desc-hint">Detailed descriptions improve discoverability and student conversions.</span>
                    <span className="ec-char-counter" id="desc-counter" aria-live="polite">
                      <span id="desc-count">{descCount}</span> chars
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Course Details */}
            <div className="ec-card" id="section-details">
              <div className="ec-card-header">
                <div className="ec-card-icon ec-card-icon--violet" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="ec-card-title">Course Details</h2>
                  <p className="ec-card-desc">Category, level, language &amp; duration</p>
                </div>
              </div>
              <div className="ec-card-body">
                <div className="ec-grid ec-grid--2">
                  <div className="ec-field">
                    <label className="ec-label" htmlFor="category_id">Category</label>
                    <div className="ec-select-wrap">
                      <select id="category_id" name="category_id" className="ec-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                        <option value="">Uncategorized</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <svg className="ec-select-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  <div className="ec-field">
                    <label className="ec-label" htmlFor="level">Level</label>
                    <div className="ec-select-wrap">
                      <select id="level" name="level" className="ec-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                      <svg className="ec-select-chevron" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  <div className="ec-field">
                    <label className="ec-label" htmlFor="language">Language</label>
                    <input type="text" id="language" name="language" className="ec-input" placeholder="e.g. English" value={language} maxLength={50} onChange={(e) => setLanguage(e.target.value)} />
                  </div>

                  <div className="ec-field">
                    <label className="ec-label" htmlFor="duration_hours">Duration (hours)</label>
                    <div className="ec-input-icon-wrap">
                      <svg className="ec-input-icon" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <input type="number" id="duration_hours" name="duration_hours" className="ec-input ec-input--with-icon" min={0} max={9999} placeholder="0" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Pricing & Certification */}
            <div className="ec-card" id="section-pricing">
              <div className="ec-card-header">
                <div className="ec-card-icon ec-card-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="ec-card-title">Pricing &amp; Certification</h2>
                  <p className="ec-card-desc">Set price and passing criteria</p>
                </div>
              </div>
              <div className="ec-card-body">
                <div className="ec-grid ec-grid--2">
                  <div className={errField("price")} id="field-price">
                    <label className="ec-label" htmlFor="price">
                      Price
                      <span className="ec-label-badge ec-label-badge--green">Set 0 for free</span>
                    </label>
                    <div className="ec-input-prefix-wrap">
                      <span className="ec-input-prefix" aria-hidden="true">{currencySymbol}</span>
                      <input type="number" id="price" name="price" className="ec-input ec-input--with-prefix" min={0} step={0.01} max={99999} placeholder="0.00" value={price} aria-describedby="price-error" onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <div className="ec-price-preview" id="price-preview">
                      <span id="price-preview-text">{pricePreview}</span>
                    </div>
                    <span className="ec-field-error" id="price-error" role="alert" aria-live="assertive">{errors.price}</span>
                  </div>

                  <div className={errField("passing")} id="field-passing">
                    <label className="ec-label" htmlFor="passing_percentage">
                      Passing Percentage
                      <span className="ec-label-badge">Quiz threshold</span>
                    </label>
                    <div className="ec-input-suffix-wrap">
                      <input type="number" id="passing_percentage" name="passing_percentage" className="ec-input ec-input--with-suffix" min={0} max={100} placeholder="70" value={passing} aria-describedby="passing-hint passing-error" onChange={(e) => setPassing(e.target.value)} />
                      <span className="ec-input-suffix" aria-hidden="true">%</span>
                    </div>
                    <div className="ec-pass-bar-wrap" aria-hidden="true">
                      <div className="ec-pass-bar">
                        <div className="ec-pass-bar-fill" id="pass-bar-fill" style={{ width: `${passValue}%`, background: passColor }} />
                      </div>
                    </div>
                    <span className="ec-hint" id="passing-hint">Minimum score required to pass quizzes &amp; earn certificate.</span>
                    <span className="ec-field-error" id="passing-error" role="alert" aria-live="assertive">{errors.passing}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Thumbnail */}
            <div className="ec-card" id="section-thumbnail">
              <div className="ec-card-header">
                <div className="ec-card-icon ec-card-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2" />
                    <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="ec-card-title">Course Thumbnail</h2>
                  <p className="ec-card-desc">JPG, PNG or WebP — max 2 MB</p>
                </div>
              </div>
              <div className="ec-card-body">
                <div className="ec-thumbnail-layout">
                  <div className="ec-thumbnail-preview" id="thumbnail-preview-wrap">
                    {hasPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img id="thumbnail-preview-img" src={previewSrc} alt="Current course thumbnail" className="ec-thumbnail-img" />
                    ) : (
                      <>
                        <div className="ec-thumbnail-placeholder" id="thumbnail-placeholder">
                          <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                            <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          </svg>
                          <span>No thumbnail</span>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img id="thumbnail-preview-img" className="ec-thumbnail-img" style={{ display: "none" }} alt="New thumbnail preview" />
                      </>
                    )}
                  </div>

                  <div className="ec-thumbnail-controls">
                    <label className="ec-upload-btn" htmlFor="thumbnail" tabIndex={0}>
                      <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {course.thumbnail ? "Replace Thumbnail" : "Upload Thumbnail"}
                    </label>
                    <input type="file" id="thumbnail" name="thumbnail" accept="image/jpeg,image/png,image/webp" className="ec-file-input" aria-label="Upload course thumbnail" ref={fileRef} onChange={onFileChange} />
                    <p className="ec-upload-hint">Recommended: 1280×720 px (16:9). JPG, PNG, WebP. Max 2 MB.</p>
                    <div className="ec-upload-info" id="upload-info" style={{ display: file ? "flex" : "none" }}>
                      <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span id="upload-filename">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : ""}</span>
                      <button type="button" className="ec-upload-clear" id="upload-clear" aria-label="Remove selected file" onClick={clearFile}>
                        <svg viewBox="0 0 24 24" fill="none" width="12" height="12" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <span className="ec-field-error" id="thumbnail-error" role="alert" aria-live="assertive">{errors.thumbnail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Visibility & Flags */}
            <div className="ec-card" id="section-visibility">
              <div className="ec-card-header">
                <div className="ec-card-icon ec-card-icon--red" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <h2 className="ec-card-title">Visibility &amp; Flags</h2>
                  <p className="ec-card-desc">Control course status and features</p>
                </div>
              </div>
              <div className="ec-card-body">
                <div className="ec-toggles-grid">
                  <label className="ec-toggle-card" htmlFor="is_published">
                    <div className="ec-toggle-card-icon ec-toggle-card-icon--green" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="ec-toggle-card-body">
                      <span className="ec-toggle-card-title">Published</span>
                      <span className="ec-toggle-card-desc">Visible to students on the platform</span>
                    </div>
                    <div className="ec-toggle-switch-wrap">
                      <input type="checkbox" id="is_published" name="is_published" className="ec-toggle-input" role="switch" aria-checked={isPublished} checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                      <span className="ec-toggle-slider" aria-hidden="true" />
                    </div>
                  </label>

                  <label className="ec-toggle-card" htmlFor="is_featured">
                    <div className="ec-toggle-card-icon ec-toggle-card-icon--amber" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="ec-toggle-card-body">
                      <span className="ec-toggle-card-title">Featured</span>
                      <span className="ec-toggle-card-desc">Highlighted on homepage &amp; browse pages</span>
                    </div>
                    <div className="ec-toggle-switch-wrap">
                      <input type="checkbox" id="is_featured" name="is_featured" className="ec-toggle-input" role="switch" aria-checked={isFeatured} checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                      <span className="ec-toggle-slider" aria-hidden="true" />
                    </div>
                  </label>

                  <label className="ec-toggle-card" htmlFor="certificate_enabled">
                    <div className="ec-toggle-card-icon ec-toggle-card-icon--blue" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                        <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
                        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="ec-toggle-card-body">
                      <span className="ec-toggle-card-title">Certificate Enabled</span>
                      <span className="ec-toggle-card-desc">Students earn a certificate on completion</span>
                    </div>
                    <div className="ec-toggle-switch-wrap">
                      <input type="checkbox" id="certificate_enabled" name="certificate_enabled" className="ec-toggle-input" role="switch" aria-checked={certificateEnabled} checked={certificateEnabled} onChange={(e) => setCertificateEnabled(e.target.checked)} />
                      <span className="ec-toggle-slider" aria-hidden="true" />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="ec-form-actions">
              <a href="/admin/courses" className="ec-btn ec-btn--outline">
                <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Cancel
              </a>
              <button type="submit" className="ec-btn ec-btn--primary ec-btn--lg" id="submit-btn" disabled={submitting}>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                {submitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="ec-sidebar" aria-label="Course overview">
            <div className="ec-card ec-card--compact">
              <div className="ec-card-header ec-card-header--sm">
                <h3 className="ec-sidebar-title">Course Overview</h3>
              </div>
              <div className="ec-card-body ec-card-body--compact">
                <div className="ec-stats-grid">
                  <div className="ec-stat">
                    <span className="ec-stat-value">{phpNumber(overview.enrollmentCount)}</span>
                    <span className="ec-stat-label">Enrollments</span>
                  </div>
                  <div className="ec-stat">
                    <span className="ec-stat-value">{overview.avgRating ? `★ ${overview.avgRating}` : "—"}</span>
                    <span className="ec-stat-label">{overview.reviewCount} reviews</span>
                  </div>
                  <div className="ec-stat">
                    <span className="ec-stat-value">{overview.sectionCount}</span>
                    <span className="ec-stat-label">Sections</span>
                  </div>
                  <div className="ec-stat">
                    <span className="ec-stat-value">{overview.lessonCount}</span>
                    <span className="ec-stat-label">Lessons</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ec-card ec-card--compact">
              <div className="ec-card-header ec-card-header--sm">
                <h3 className="ec-sidebar-title">Status</h3>
              </div>
              <div className="ec-card-body ec-card-body--compact">
                <div className="ec-status-list">
                  <div className="ec-status-row">
                    <span className="ec-status-row-label">Visibility</span>
                    {isPublished ? <span className="ec-pill ec-pill--green">Published</span> : <span className="ec-pill ec-pill--gray">Draft</span>}
                  </div>
                  <div className="ec-status-row">
                    <span className="ec-status-row-label">Featured</span>
                    {isFeatured ? <span className="ec-pill ec-pill--amber">Yes</span> : <span className="ec-pill ec-pill--gray">No</span>}
                  </div>
                  <div className="ec-status-row">
                    <span className="ec-status-row-label">Certificate</span>
                    {certificateEnabled ? <span className="ec-pill ec-pill--blue">Enabled</span> : <span className="ec-pill ec-pill--gray">Disabled</span>}
                  </div>
                  <div className="ec-status-row">
                    <span className="ec-status-row-label">Price</span>
                    <span className={`ec-pill ${(Number.parseFloat(price) || 0) === 0 ? "ec-pill--green" : "ec-pill--blue"}`}>
                      {(Number.parseFloat(price) || 0) === 0 ? "Free" : formatPrice(Number.parseFloat(price))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ec-card ec-card--compact">
              <div className="ec-card-header ec-card-header--sm">
                <h3 className="ec-sidebar-title">Quick Links</h3>
              </div>
              <div className="ec-card-body ec-card-body--compact">
                <div className="ec-quick-links">
                  <a href={`/admin/enrollments?course=${course.id}`} className="ec-quick-link">
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    View Enrollments
                  </a>
                  <a href={`/admin/reviews?course=${course.id}`} className="ec-quick-link">
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    View Reviews
                  </a>
                  <a href="/admin/courses" className="ec-quick-link">
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    All Courses
                  </a>
                </div>
              </div>
            </div>

            <div className="ec-card ec-card--compact">
              <div className="ec-card-header ec-card-header--sm">
                <h3 className="ec-sidebar-title">Metadata</h3>
              </div>
              <div className="ec-card-body ec-card-body--compact">
                <div className="ec-meta-list">
                  <div className="ec-meta-row">
                    <span className="ec-meta-label">Course ID</span>
                    <span className="ec-meta-value ec-meta-value--mono">#{course.id}</span>
                  </div>
                  <div className="ec-meta-row">
                    <span className="ec-meta-label">Instructor</span>
                    <span className="ec-meta-value">{course.instructor_name ?? "—"}</span>
                  </div>
                  <div className="ec-meta-row">
                    <span className="ec-meta-label">Category</span>
                    <span className="ec-meta-value">{course.category_name ?? "Uncategorized"}</span>
                  </div>
                  {createdLabel ? (
                    <div className="ec-meta-row">
                      <span className="ec-meta-label">Created</span>
                      <span className="ec-meta-value">{createdLabel}</span>
                    </div>
                  ) : null}
                  {updatedLabel ? (
                    <div className="ec-meta-row">
                      <span className="ec-meta-label">Updated</span>
                      <span className="ec-meta-value">{updatedLabel}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
