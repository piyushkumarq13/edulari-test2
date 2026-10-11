"use client";

import { useEffect, useRef, useState } from "react";
import "@/styles/css/student/profile.css";

type Option = [string, string];

type Profile = {
  highestEducation: string;
  collegeName: string;
  fieldOfStudy: string;
  learningGoal: string;
  experienceLevel: string;
  bio: string;
  phone: string;
};

/** Port of public/student/profile.php (lines 280-809). */
export default function ProfileClient({
  userName,
  userEmail,
  avatarUrl,
  profile,
  savedSkills,
  savedCourses,
  skillOptions,
  interestOptions,
  educationOptions,
  goalOptions,
  levelOptions,
  activeTab,
  csrfToken,
  flashType,
  flashMessage,
  stats,
}: {
  userName: string;
  userEmail: string;
  avatarUrl: string;
  profile: Profile;
  savedSkills: string[];
  savedCourses: string[];
  skillOptions: string[];
  interestOptions: string[];
  educationOptions: Option[];
  goalOptions: Option[];
  levelOptions: Option[];
  activeTab: string;
  csrfToken: string;
  flashType: string;
  flashMessage: string;
  stats: { enrolled: number; completed: number; wishlist: number };
}) {
  const [tab, setTab] = useState(activeTab);
  const tabsBarRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFormRef = useRef<HTMLFormElement | null>(null);
  const removeAvatarFormRef = useRef<HTMLFormElement | null>(null);

  // Sticky tab bar shadow once the hero has scrolled out.
  useEffect(() => {
    const onScroll = () => {
      const hero = heroRef.current;
      const bar = tabsBarRef.current;
      if (!hero || !bar) return;
      bar.classList.toggle("pf-tabs-bar--stuck", hero.getBoundingClientRect().bottom <= 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Alert auto-dismiss after 5 s.
  useEffect(() => {
    if (!alertRef.current) return;
    const t = setTimeout(() => dismissAlert(alertRef.current), 5000);
    return () => clearTimeout(t);
  }, []);

  const customSavedSkills = savedSkills.filter((s) => !skillOptions.includes(s));
  const customSavedCourses = savedCourses.filter((c) => !interestOptions.includes(c));

  function activateTab(target: string) {
    setTab(target);
    try {
      sessionStorage.setItem("pf_active_tab", target);
    } catch {
      /* storage blocked */
    }
    const input = document.getElementById("activeTabInput") as HTMLInputElement | null;
    if (input) input.value = target;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", target);
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <main className="pf-main">
      <div className="pf-hero" ref={heroRef}>
        <div className="pf-hero__inner">
          <div className="pf-hero__avatar-wrap">
            <div className="pf-avatar" id="avatarWrap">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt={userName} className="pf-avatar__img" id="avatarImg" />
              ) : (
                <div className="pf-avatar__initials" id="avatarInitials">
                  {initialsOf(userName)}
                </div>
              )}
              <button
                type="button"
                className="pf-avatar__overlay"
                id="avatarOverlay"
                aria-label="Change profile photo"
                onClick={() => avatarInputRef.current?.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Change</span>
              </button>
            </div>

            <form
              method="post"
              action="/api/student/profile/avatar"
              encType="multipart/form-data"
              id="avatarForm"
              className="pf-avatar-form"
              aria-hidden="true"
              ref={avatarFormRef}
            >
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="file" name="avatar" id="avatarInput" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} ref={avatarInputRef} />
            </form>

            {avatarUrl ? (
              <form method="post" action="/api/student/profile/avatar/remove" id="removeAvatarForm" aria-hidden="true" ref={removeAvatarFormRef}>
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="action" value="remove_avatar" />
                <button
                  type="button"
                  className="pf-avatar__remove-btn"
                  id="removeAvatarBtn"
                  onClick={() => {
                    if (window.confirm("Remove your profile picture?")) removeAvatarFormRef.current?.submit();
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Remove photo
                </button>
              </form>
            ) : null}
          </div>

          <div className="pf-hero__info">
            <h1 className="pf-hero__name">{userName}</h1>
            <p className="pf-hero__email">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {userEmail}
            </p>
            <span className="pf-hero__badge">Student</span>
          </div>

          <div className="pf-hero__stats">
            <div className="pf-hero__stat">
              <span className="pf-hero__stat-value">{stats.enrolled}</span>
              <span className="pf-hero__stat-label">Enrolled</span>
            </div>
            <div className="pf-hero__stat-divider" />
            <div className="pf-hero__stat">
              <span className="pf-hero__stat-value">{stats.completed}</span>
              <span className="pf-hero__stat-label">Completed</span>
            </div>
            <div className="pf-hero__stat-divider" />
            <div className="pf-hero__stat">
              <span className="pf-hero__stat-value">{stats.wishlist}</span>
              <span className="pf-hero__stat-label">Wishlist</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pf-tabs-bar" id="pfTabsBar" role="tablist" aria-label="Profile sections" ref={tabsBarRef}>
        <button
          className={`pf-tab ${tab === "personal" ? "pf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "personal" ? "true" : "false"}
          aria-controls="panel-personal"
          id="tab-personal"
          data-tab="personal"
          onClick={() => activateTab("personal")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Personal Info</span>
        </button>

        <button
          className={`pf-tab ${tab === "education" ? "pf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "education" ? "true" : "false"}
          aria-controls="panel-education"
          id="tab-education"
          data-tab="education"
          onClick={() => activateTab("education")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Education</span>
        </button>

        <button
          className={`pf-tab ${tab === "interests" ? "pf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "interests" ? "true" : "false"}
          aria-controls="panel-interests"
          id="tab-interests"
          data-tab="interests"
          onClick={() => activateTab("interests")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Skills &amp; Interests</span>
        </button>
      </div>

      <div className="pf-content-wrap">
        {flashType && flashMessage ? (
          <div className={`pf-alert pf-alert--${flashType}`} id="pfAlert" role="alert" ref={alertRef}>
            {flashType === "success" ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            <span>{flashMessage}</span>
            <button
              type="button"
              className="pf-alert__close"
              aria-label="Dismiss"
              onClick={() => dismissAlert(alertRef.current)}
            >
              &times;
            </button>
          </div>
        ) : null}

        <form method="post" action="/api/student/profile" id="profileForm" noValidate>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <input type="hidden" name="_tab" value={tab} id="activeTabInput" defaultValue={tab} />

          <section className={`pf-panel ${tab === "personal" ? "pf-panel--active" : ""}`} id="panel-personal" role="tabpanel" aria-labelledby="tab-personal">
            <div className="pf-panel__header">
              <div className="pf-panel__icon pf-panel__icon--blue" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="pf-panel__title">Personal Information</h2>
                <p className="pf-panel__subtitle">Your name, bio and contact details.</p>
              </div>
            </div>

            <div className="pf-form-grid">
              <div className="pf-field pf-field--span2">
                <label className="pf-label" htmlFor="name">
                  Full Name <span className="pf-required" aria-label="required">*</span>
                </label>
                <input className="pf-input" type="text" id="name" name="name" defaultValue={userName} placeholder="Your full name" maxLength={100} required autoComplete="name" />
              </div>

              <div className="pf-field pf-field--span2">
                <label className="pf-label">Email Address</label>
                <div className="pf-input-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" className="pf-input-icon" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input className="pf-input pf-input--with-icon pf-input--readonly" type="email" value={userEmail} disabled aria-describedby="email-hint" />
                </div>
                <p className="pf-hint" id="email-hint">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <div className="pf-field">
                <label className="pf-label" htmlFor="phone">
                  Phone Number
                </label>
                <input className="pf-input" type="tel" id="phone" name="phone" defaultValue={profile.phone} placeholder="+91 98765 43210" maxLength={20} autoComplete="tel" />
              </div>

              <div className="pf-field pf-field--span2">
                <label className="pf-label" htmlFor="bio">
                  Short Bio
                </label>
                <textarea className="pf-textarea" id="bio" name="bio" rows={4} defaultValue={profile.bio} placeholder="Tell us a bit about yourself…" maxLength={500} aria-describedby="bio-hint" />
                <p className="pf-hint" id="bio-hint">
                  Max 500 characters.
                </p>
              </div>
            </div>

            <PanelFooter />
          </section>

          <section className={`pf-panel ${tab === "education" ? "pf-panel--active" : ""}`} id="panel-education" role="tabpanel" aria-labelledby="tab-education">
            <div className="pf-panel__header">
              <div className="pf-panel__icon pf-panel__icon--green" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="pf-panel__title">Education Background</h2>
                <p className="pf-panel__subtitle">Helps us personalise your learning path.</p>
              </div>
            </div>

            <fieldset className="pf-fieldset">
              <legend className="pf-label">Highest Education Level</legend>
              <div className="pf-radio-grid">
                {educationOptions.map(([value, label]) => (
                  <label className={`pf-radio-card ${profile.highestEducation === value ? "pf-radio-card--selected" : ""}`} key={value}>
                    <input type="radio" name="highest_education" value={value} defaultChecked={profile.highestEducation === value} />
                    <span className="pf-radio-card__label">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="pf-form-grid pf-form-grid--mt">
              <div className="pf-field">
                <label className="pf-label" htmlFor="college_name">
                  College / University
                </label>
                <input className="pf-input" type="text" id="college_name" name="college_name" defaultValue={profile.collegeName} placeholder="e.g. Delhi University" maxLength={255} />
              </div>
              <div className="pf-field">
                <label className="pf-label" htmlFor="field_of_study">
                  Field of Study
                </label>
                <input className="pf-input" type="text" id="field_of_study" name="field_of_study" defaultValue={profile.fieldOfStudy} placeholder="e.g. Computer Science" maxLength={255} />
              </div>
            </div>

            <fieldset className="pf-fieldset pf-fieldset--mt">
              <legend className="pf-label">Main Learning Goal</legend>
              <div className="pf-goal-list">
                {goalOptions.map(([value, label]) => (
                  <label className={`pf-goal-row ${profile.learningGoal === value ? "pf-goal-row--selected" : ""}`} key={value}>
                    <input type="radio" name="learning_goal" value={value} defaultChecked={profile.learningGoal === value} />
                    <span className="pf-goal-row__text">{label}</span>
                    <svg className="pf-goal-row__check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="pf-fieldset pf-fieldset--mt">
              <legend className="pf-label">Experience Level</legend>
              <div className="pf-level-grid">
                {levelOptions.map(([value, label]) => (
                  <label className={`pf-level-card ${profile.experienceLevel === value ? "pf-level-card--selected" : ""}`} key={value}>
                    <input type="radio" name="experience_level" value={value} defaultChecked={profile.experienceLevel === value} />
                    <span className="pf-level-card__title">{ucfirst(value)}</span>
                    <span className="pf-level-card__desc">{label.split("—")[1]?.trim() ?? ""}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <PanelFooter />
          </section>

          <section className={`pf-panel ${tab === "interests" ? "pf-panel--active" : ""}`} id="panel-interests" role="tabpanel" aria-labelledby="tab-interests">
            <div className="pf-panel__header">
              <div className="pf-panel__icon pf-panel__icon--amber" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="pf-panel__title">Skills &amp; Interests</h2>
                <p className="pf-panel__subtitle">Used to personalise your course recommendations.</p>
              </div>
            </div>

            <fieldset className="pf-fieldset">
              <legend className="pf-label">Skills you already have</legend>
              <div className="pf-chip-grid" role="group" aria-label="Select your skills">
                {skillOptions.map((skill) => (
                  <label className={`pf-chip ${savedSkills.includes(skill) ? "pf-chip--selected" : ""}`} key={skill}>
                    <input type="checkbox" name="skills[]" value={skill} defaultChecked={savedSkills.includes(skill)} />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>
              <input className="pf-input pf-input--custom" type="text" name="custom_skill" defaultValue={customSavedSkills.join(", ")} placeholder="+ Add another skill…" maxLength={100} aria-label="Add a custom skill" />
            </fieldset>

            <fieldset className="pf-fieldset pf-fieldset--mt">
              <legend className="pf-label">Course topics you&apos;re interested in</legend>
              <div className="pf-chip-grid" role="group" aria-label="Select your course interests">
                {interestOptions.map((cat) => (
                  <label className={`pf-chip ${savedCourses.includes(cat) ? "pf-chip--selected" : ""}`} key={cat}>
                    <input type="checkbox" name="courses_interested[]" value={cat} defaultChecked={savedCourses.includes(cat)} />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
              <input className="pf-input pf-input--custom" type="text" name="custom_course" defaultValue={customSavedCourses.join(", ")} placeholder="+ Other interest…" maxLength={100} aria-label="Add a custom course interest" />
            </fieldset>

            <PanelFooter />
          </section>
        </form>
      </div>
    </main>
  );
}

function PanelFooter() {
  return (
    <div className="pf-panel__footer">
      <button type="submit" className="pf-btn pf-btn--primary">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        Save Changes
      </button>
    </div>
  );
}

function dismissAlert(alertEl: HTMLElement | null) {
  if (!alertEl) return;
  alertEl.style.opacity = "0";
  alertEl.style.transform = "translateY(-6px)";
  setTimeout(() => alertEl.remove(), 350);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(" ");
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}