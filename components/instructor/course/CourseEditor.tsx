"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CURRENCY_CODE, CURRENCY_DISPLAY_SYMBOL } from "@/lib/format";
import MarkdownEditor from "@/components/instructor/MarkdownEditor";
import CustomSelect from "./CustomSelect";

export type CourseFormValues = {
  title: string;
  short_description: string;
  description: string;
  category_id: string;
  level: string;
  language: string;
  duration_hours: string;
  price: string;
  certificate_enabled: boolean;
  passing_percentage: string;
  what_you_learn: string;
  requirements: string;
};

export type CategoryOption = { id: number; name: string };

export const COURSE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/**
 * The shared create/edit course form. create-course.php and edit-course.php differ only in
 * their chrome, their card numbering and the preview/thumbnail blocks, so the field set lives
 * here once and the admin pages (Phase 9) mount the same component with `prefix="admin"`.
 *
 * `prefix` selects the CSS class family: "cc" for create-course.css, "ec" for edit-course.css.
 */
export default function CourseEditor({
  prefix,
  action,
  categories,
  values,
  error = "",
  success = "",
  csrfToken,
  courseId,
  showThumbnailPreview = false,
  currentThumbnail = null,
  onThumbRemoved,
}: {
  prefix: string;
  action: string;
  categories: CategoryOption[];
  values: CourseFormValues;
  error?: string;
  success?: string;
  csrfToken: string;
  courseId?: number;
  showThumbnailPreview?: boolean;
  currentThumbnail?: string | null;
  onThumbRemoved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const uploadBoxRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLImageElement | null>(null);
  const [certEnabled, setCertEnabled] = useState(values.certificate_enabled);
  const [dirty, setDirty] = useState(false);

  // ── Thumbnail preview + drag/drop, as in both PHP pages ───────────────────
  useEffect(() => {
    const box = uploadBoxRef.current;
    const input = fileRef.current;
    const preview = previewRef.current;
    if (!input || !preview) return;
    const onChange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = String(e.target?.result ?? "");
        preview.style.display = "block";
        box?.classList.add(`${prefix}-upload-box--has-image`);
      };
      reader.readAsDataURL(file);
      setDirty(true);
    };
    input.addEventListener("change", onChange);
    if (!box) return;
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      box.classList.add(`${prefix}-upload-box--drag`);
    };
    const onLeave = () => box.classList.remove(`${prefix}-upload-box--drag`);
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      box.classList.remove(`${prefix}-upload-box--drag`);
      if (e.dataTransfer?.files.length) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event("change"));
      }
    };
    box.addEventListener("dragover", onOver);
    box.addEventListener("dragleave", onLeave);
    box.addEventListener("drop", onDrop);
    return () => {
      input.removeEventListener("change", onChange);
      box.removeEventListener("dragover", onOver);
      box.removeEventListener("dragleave", onLeave);
      box.removeEventListener("drop", onDrop);
    };
  }, [prefix]);

  // ── Unsaved-changes guard (edit-course.php only) ──────────────────────────
useEffect(() => {
      const form = formRef.current;
      if (!form) return;
      const mark = () => setDirty(true);
      form.addEventListener("input", mark);
      form.addEventListener("change", mark);
      return () => {
        form.removeEventListener("input", mark);
        form.removeEventListener("change", mark);
      };
    }, []);

    // Warn before leaving with unsaved edits, as edit-course.php did.
    useEffect(() => {
      if (!dirty) return;
      const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

  // ── Required-select validation before submit, as the PHP did ──────────────
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onSubmit = (e: Event) => {
      let valid = true;
      const wrapper = form.querySelector<HTMLElement>(`.${prefix}-custom-select--error`);
      form.querySelectorAll<HTMLSelectElement>("select[required]").forEach((sel) => {
        const w = (sel as HTMLSelectElement).closest<HTMLElement>(`.${prefix}-custom-select`);
        if (!sel.value) {
          valid = false;
          w?.classList.add(`${prefix}-custom-select--error`);
        } else {
          w?.classList.remove(`${prefix}-custom-select--error`);
        }
      });
      if (!valid) {
        e.preventDefault();
        wrapper?.querySelector<HTMLButtonElement>(`.${prefix}-custom-select__trigger`)?.focus();
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [prefix]);

  // The mutation endpoints answer with JSON ({ ok, error?, redirect? }). A native form post
  // would drop the user on that raw JSON, so submit over fetch and follow the redirect the
  // server hands back, keeping the PHP's post/redirect/get flow.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(action, { method: "POST", body: new FormData(e.currentTarget) });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
      if (data.redirect) {
        setDirty(false);
        window.location.href = data.redirect;
        return;
      }
      setSubmitError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: "", label: "Select category…" },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];
  const levelOptions = [
    { value: "", label: "Select level…" },
    ...COURSE_LEVELS.map((l) => ({ value: l.value, label: l.label })),
  ];

  return (
    <>
      {error ? (
        <div className={`${prefix}-alert ${prefix}-alert--error`} role="alert">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          {error}
        </div>
      ) : null}
      {success ? (
        <div className={`${prefix}-alert ${prefix}-alert--success`} role="alert">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {success}
        </div>
      ) : null}

      <form
        id="mainForm"
        ref={formRef}
        className={`${prefix}-form`}
        method="post"
        action={action}
        encType="multipart/form-data"
        noValidate
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />
        {courseId ? <input type="hidden" name="course_id" value={courseId} /> : null}

        {submitError ? (
          <div className={`${prefix}-alert ${prefix}-alert--error`} role="alert">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>{submitError}</span>
          </div>
        ) : null}

        <div className={`${prefix}-grid`}>
          {/* ── LEFT column ── */}
          <div className={`${prefix}-col`}>
            <div className={`${prefix}-card`}>
              <h2 className={`${prefix}-card-title`}>
                <span className={`${prefix}-card-num`}>1</span> Basic Information
              </h2>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="title">
                  Course Title <span className={`${prefix}-required`}>*</span>
                </label>
                <input
                  className={`${prefix}-input`}
                  type="text"
                  id="title"
                  name="title"
                  maxLength={150}
                  placeholder="e.g. Complete Web Development Bootcamp"
                  required
                  defaultValue={values.title}
                />
                <span className={`${prefix}-field-hint`}>Clear, descriptive title (max 150 chars)</span>
              </div>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="short_description">
                  Short Description <span className={`${prefix}-required`}>*</span>
                </label>
                <textarea
                  className={`${prefix}-input ${prefix}-textarea ${prefix}-textarea--sm`}
                  id="short_description"
                  name="short_description"
                  maxLength={250}
                  rows={3}
                  placeholder="A brief summary shown in course listings…"
                  required
                  defaultValue={values.short_description}
                />
                <span className={`${prefix}-field-hint`}>
                  Shown in search results and cards (max 250 chars)
                </span>
              </div>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="description">
                  Full Description
                </label>
                <MarkdownEditor name="description" defaultValue={values.description} rows={prefix === "cc" ? 7 : 8} simple={prefix === "cc"} csrfToken={csrfToken} />
              </div>
            </div>

            {/* Learning outcomes: the PHP collects these but never persists them. */}
            <div className={`${prefix}-card`}>
              <h2 className={`${prefix}-card-title`}>
                <span className={`${prefix}-card-num`}>2</span> Learning Outcomes
              </h2>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="what_you_learn">
                  What Students Will Learn
                </label>
                <textarea
                  className={`${prefix}-input ${prefix}-textarea ${prefix}-textarea--sm`}
                  id="what_you_learn"
                  name="what_you_learn"
                  rows={4}
                  defaultValue={values.what_you_learn}
                  placeholder={"• Build real-world projects\n• Master modern JavaScript\n• Deploy apps to the cloud"}
                />
                <span className={`${prefix}-field-hint`}>List key takeaways, one per line</span>
              </div>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="requirements">
                  Requirements / Prerequisites
                </label>
                <textarea
                  className={`${prefix}-input ${prefix}-textarea ${prefix}-textarea--sm`}
                  id="requirements"
                  name="requirements"
                  rows={3}
                  defaultValue={values.requirements}
                  placeholder={"• Basic computer skills\n• No prior programming experience needed"}
                />
                <span className={`${prefix}-field-hint`}>What students should know before enrolling</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT column ── */}
          <div className={`${prefix}-col`}>
            <div className={`${prefix}-card`}>
              <h2 className={`${prefix}-card-title`}>
                <span className={`${prefix}-card-num`}>3</span> Course Details
              </h2>
              <div className={`${prefix}-two-fields`}>
                <div className={`${prefix}-field`}>
                  <label className={`${prefix}-label`} htmlFor="category_id">
                    Category <span className={`${prefix}-required`}>*</span>
                  </label>
                  <CustomSelect
                    name="category_id"
                    prefix={prefix}
                    id="category_id"
                    required
                    options={categoryOptions}
                    defaultValue={values.category_id}
                    ariaLabel="Category"
                  />
                </div>
                <div className={`${prefix}-field`}>
                  <label className={`${prefix}-label`} htmlFor="level">
                    Level <span className={`${prefix}-required`}>*</span>
                  </label>
                  <CustomSelect
                    name="level"
                    prefix={prefix}
                    id="level"
                    required
                    options={levelOptions}
                    defaultValue={values.level}
                    ariaLabel="Level"
                  />
                </div>
              </div>
              <div className={`${prefix}-two-fields`}>
                <div className={`${prefix}-field`}>
                  <label className={`${prefix}-label`} htmlFor="language">
                    Language
                  </label>
                  <input className={`${prefix}-input`} type="text" id="language" name="language" defaultValue={values.language} />
                </div>
                <div className={`${prefix}-field`}>
                  <label className={`${prefix}-label`} htmlFor="duration_hours">
                    Duration (hours)
                  </label>
                  <input className={`${prefix}-input`} type="number" id="duration_hours" name="duration_hours" min="0" step="0.5" defaultValue={values.duration_hours} />
                </div>
              </div>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-label`} htmlFor="price">
                  Price ({CURRENCY_CODE})
                </label>
                <div className={`${prefix}-price-wrap`}>
                  <span className={`${prefix}-price-sym`}>{CURRENCY_DISPLAY_SYMBOL}</span>
                  <input
                    className={`${prefix}-input ${prefix}-input--price`}
                    type="number"
                    id="price"
                    name="price"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={values.price}
                  />
                </div>
                <span className={`${prefix}-field-hint`}>
                  {prefix === "cc" ? "Enter 0 to offer the course for free" : "Set to 0 for a free course"}
                </span>
              </div>
            </div>

            {/* Thumbnail */}
            {showThumbnailPreview && currentThumbnail ? (
              <div className={`${prefix}-card`}>
                <h2 className={`${prefix}-card-title`}>
                  <span className={`${prefix}-card-num`}>2</span> Course Thumbnail
                </h2>
                <div className={`${prefix}-current-thumb`}>
                  <p className={`${prefix}-label`}>Current Thumbnail</p>
                  <div className={`${prefix}-thumb-wrap`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentThumbnail} alt="Current thumbnail" className={`${prefix}-thumb-img`} />
                    <RemoveThumbnailButton prefix={prefix} csrfToken={csrfToken} courseId={courseId!} onRemoved={onThumbRemoved} />
                  </div>
                </div>
                <ThumbnailField prefix={prefix} uploadBoxRef={uploadBoxRef} fileRef={fileRef} previewRef={previewRef} label="Replace Thumbnail" />
              </div>
            ) : (
              <div className={`${prefix}-card`}>
                <h2 className={`${prefix}-card-title`}>
                  <span className={`${prefix}-card-num`}>4</span> Course Thumbnail
                </h2>
                <ThumbnailField prefix={prefix} uploadBoxRef={uploadBoxRef} fileRef={fileRef} previewRef={previewRef} label="Upload Image" />
              </div>
            )}

            <div className={`${prefix}-card`}>
              <h2 className={`${prefix}-card-title`}>
                <span className={`${prefix}-card-num`}>{prefix === "cc" ? "5" : "4"}</span> Certificate Settings
              </h2>
              <div className={`${prefix}-field`}>
                <label className={`${prefix}-toggle-label`} htmlFor="certificate_enabled">
                  <input
                    className={`${prefix}-toggle-input`}
                    type="checkbox"
                    id="certificate_enabled"
                    name="certificate_enabled"
                    checked={certEnabled}
                    onChange={(e) => setCertEnabled(e.target.checked)}
                  />
                  <span className={`${prefix}-toggle-track`}>
                    <span className={`${prefix}-toggle-thumb`} />
                  </span>
                  <span className={`${prefix}-toggle-text`}>Enable Certificate of Completion</span>
                </label>
              </div>
              <div className={`${prefix}-field`} id="passingField" style={{ display: certEnabled ? undefined : "none" }}>
                <label className={`${prefix}-label`} htmlFor="passing_percentage">
                  Minimum Passing Score (%)
                </label>
                <input className={`${prefix}-input`} type="number" id="passing_percentage" name="passing_percentage" min="0" max="100" defaultValue={values.passing_percentage} />
                <span className={`${prefix}-field-hint`}>
                  {prefix === "cc"
                    ? "Students must score at or above this threshold to earn their certificate"
                    : "Students must reach this score to earn the certificate"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

function ThumbnailField({
  prefix,
  uploadBoxRef,
  fileRef,
  previewRef,
  label,
}: {
  prefix: string;
  uploadBoxRef: React.RefObject<HTMLDivElement | null>;
  fileRef: React.RefObject<HTMLInputElement | null>;
  previewRef: React.RefObject<HTMLImageElement | null>;
  label: string;
}) {
  return (
    <div className={`${prefix}-field`}>
      <label className={`${prefix}-label`} htmlFor="thumbnail">
        {label}
      </label>
      <div className={`${prefix}-upload-box`} id="uploadBox" ref={uploadBoxRef}>
        <svg viewBox="0 0 24 24" fill="none" width="32" height="32" className={`${prefix}-upload-icon`}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className={`${prefix}-upload-text`}>
          {prefix === "cc" ? "Click or drag an image here" : "Click or drag image to upload"}
        </p>
        <p className={`${prefix}-upload-hint`}>
          {prefix === "cc" ? "JPG, PNG, WebP · 1280×720 recommended · Max 2 MB" : "JPG, PNG, WebP · 1280×720 · Max 2 MB"}
        </p>
        <input className={`${prefix}-upload-input`} type="file" id="thumbnail" name="thumbnail" accept="image/*" ref={fileRef} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="thumbPreview" className={`${prefix}-upload-preview`} ref={previewRef} src="" alt={prefix === "cc" ? "Thumbnail preview" : "New thumbnail preview"} />
      </div>
    </div>
  );
}

function RemoveThumbnailButton({
  prefix,
  csrfToken,
  courseId,
  onRemoved,
}: {
  prefix: string;
  csrfToken: string;
  courseId: number;
  onRemoved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`${prefix}-remove-thumb-btn`}
      id="removeThumbBtn"
      title="Remove thumbnail"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Are you sure you want to remove the course thumbnail? This cannot be undone.")) return;
        setBusy(true);
        const fd = new FormData();
        fd.append("csrf_token", csrfToken);
        fd.append("course_id", String(courseId));
        fd.append("action", "remove_thumbnail");
        try {
          await fetch(`/api/instructor/course/${courseId}`, { method: "POST", body: fd });
          onRemoved?.();
          window.location.reload();
        } catch {
          window.alert("Failed to remove thumbnail. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}