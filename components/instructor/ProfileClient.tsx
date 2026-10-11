"use client";

import { useEffect, useState } from "react";

type Opt = [string, string];

export type ProfileProps = {
  activeTab: "personal" | "education" | "teaching";
  csrfToken: string;
  initialNotice: { type: "success" | "error"; msg: string } | null;
  user: { name: string; email: string; phone: string; avatarUrl: string | null; initials: string };
  stats: { totalCourses: number; totalStudents: number; avgRating: string; totalRevenue: number; revenueLabel: string };
  profile: {
    headline: string; bio: string; website: string; linkedin_url: string; twitter_url: string;
    years_exp: number; teaching_style: string;
  };
  application: {
    highest_education: string; institution: string; field_of_study: string; graduation_year: string;
    certifications: string; professional_exp: string; notable_works: string;
    primary_subject: string; secondary_subjects: string; skill_level: string;
    target_audience: string; course_ideas: string;
  };
  options: { education: Opt[]; teachingStyle: Opt[]; skillLevel: Opt[] };
};

const SAVE_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const LOCK_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="14" height="14" className="ipf-lock-icon" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * profile.php's client behaviour: the tab bar, the avatar upload/remove controls, the radio
 * card highlight, the bio character counter and the auto-dismissing alert. The three panels
 * are always rendered (the PHP relied on `.ipf-panel { display: none }`), so only the
 * `--active` modifier changes.
 */
export default function ProfileClient(props: ProfileProps) {
  const [tab, setTab] = useState(props.activeTab);
  const [bioLen, setBioLen] = useState(props.profile.bio.length);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(props.initialNotice);
  const [highest, setHighest] = useState(props.application.highest_education);
  const [skill, setSkill] = useState(props.application.skill_level);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onScroll = () => {
      const bar = document.getElementById("ipfTabsBar");
      const hero = document.querySelector(".ipf-hero");
      if (!bar || !hero) return;
      bar.classList.toggle("ipf-tabs-bar--stuck", hero.getBoundingClientRect().bottom <= 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const post = async (action: string, fd: FormData, successMsg: string) => {
    try {
      const res = await fetch("/api/instructor/profile", { method: "POST", body: fd });
      const json = (await res.json()) as { redirect?: string; error?: string };
      if (json.redirect) {
        window.location.href = json.redirect;
        return;
      }
      setNotice({ type: "error", msg: json.error || "Something went wrong." });
    } catch {
      setNotice({ type: "error", msg: "Something went wrong." });
    }
    void successMsg;
  };

  const uploadAvatar = (file: File) => {
    const fd = new FormData();
    fd.append("csrf_token", props.csrfToken);
    fd.append("action", "upload_avatar");
    fd.append("avatar", file);
    void post("upload_avatar", fd, "Profile picture updated!");
  };

  const removeAvatar = () => {
    if (!window.confirm("Remove your profile picture?")) return;
    const fd = new FormData();
    fd.append("csrf_token", props.csrfToken);
    fd.append("action", "remove_avatar");
    void post("remove_avatar", fd, "Profile picture removed.");
  };

  const maxGraduationYear = new Date().getFullYear() + 5;

  return (
    <>
      <div className="ipf-hero">
        <div className="ipf-hero__inner">
          <div className="ipf-hero__avatar-wrap">
            <div className="ipf-avatar" id="avatarWrap">
              {props.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.user.avatarUrl} alt={props.user.name} className="ipf-avatar__img" id="avatarImg" />
              ) : (
                <div className="ipf-avatar__initials" id="avatarInitials">{props.user.initials}</div>
              )}
              <label className="ipf-avatar__overlay" id="avatarOverlay" aria-label="Change profile photo">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Change</span>
                <input
                  type="file"
                  id="avatarInput"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="ipf-avatar-file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
              </label>
            </div>

            {props.user.avatarUrl ? (
              <button type="button" className="ipf-avatar__remove-btn" id="removeAvatarBtn" onClick={removeAvatar}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Remove photo
              </button>
            ) : null}
          </div>

          <div className="ipf-hero__info">
            <div className="ipf-hero__name-row">
              <h1 className="ipf-hero__name">{props.user.name}</h1>
              <span className="ipf-hero__badge">Instructor</span>
            </div>
            {props.profile.headline ? <p className="ipf-hero__headline">{props.profile.headline}</p> : null}
            <p className="ipf-hero__email">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {props.user.email}
            </p>
            <div className="ipf-hero__social">
              {props.profile.website ? (
                <a href={props.profile.website} target="_blank" rel="noopener noreferrer" className="ipf-social-link" title="Website">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="2" /></svg>
                </a>
              ) : null}
              {props.profile.linkedin_url ? (
                <a href={props.profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="ipf-social-link" title="LinkedIn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 014 0v4M11 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </a>
              ) : null}
              {props.profile.twitter_url ? (
                <a href={props.profile.twitter_url} target="_blank" rel="noopener noreferrer" className="ipf-social-link" title="Twitter / X">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.4 5.6 3.9 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              ) : null}
            </div>
          </div>

          <div className="ipf-hero__stats">
            <div className="ipf-hero__stat">
              <span className="ipf-hero__stat-value">{props.stats.totalCourses}</span>
              <span className="ipf-hero__stat-label">Courses</span>
            </div>
            <div className="ipf-hero__stat-divider" />
            <div className="ipf-hero__stat">
              <span className="ipf-hero__stat-value">{props.stats.totalStudents}</span>
              <span className="ipf-hero__stat-label">Students</span>
            </div>
            <div className="ipf-hero__stat-divider" />
            <div className="ipf-hero__stat">
              <span className="ipf-hero__stat-value">{props.stats.avgRating}</span>
              <span className="ipf-hero__stat-label">Avg Rating</span>
            </div>
            {props.stats.totalRevenue > 0 ? (
              <>
                <div className="ipf-hero__stat-divider" />
                <div className="ipf-hero__stat">
                  <span className="ipf-hero__stat-value">{props.stats.revenueLabel}</span>
                  <span className="ipf-hero__stat-label">Revenue</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ipf-tabs-bar" id="ipfTabsBar" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          className={`ipf-tab${tab === "personal" ? " ipf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "personal"}
          aria-controls="panel-personal"
          id="tab-personal"
          data-tab="personal"
          onClick={() => setTab("personal")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Personal Info</span>
        </button>

        <button
          type="button"
          className={`ipf-tab${tab === "education" ? " ipf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "education"}
          aria-controls="panel-education"
          id="tab-education"
          data-tab="education"
          onClick={() => setTab("education")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Education</span>
        </button>

        <button
          type="button"
          className={`ipf-tab${tab === "teaching" ? " ipf-tab--active" : ""}`}
          role="tab"
          aria-selected={tab === "teaching"}
          aria-controls="panel-teaching"
          id="tab-teaching"
          data-tab="teaching"
          onClick={() => setTab("teaching")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
            <rect x="3" y="3" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 21h8M12 16v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Teaching</span>
        </button>
      </div>

      <div className="ipf-content-wrap">
        {notice ? (
          <div className={`ipf-alert ipf-alert--${notice.type}`} id="ipfAlert" role="alert">
            {notice.type === "success" ? (
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
            <span>{notice.msg}</span>
            <button type="button" className="ipf-alert__close" aria-label="Dismiss" onClick={() => setNotice(null)}>&times;</button>
          </div>
        ) : null}

        {/* ── Personal ── */}
        <section className={`ipf-panel${tab === "personal" ? " ipf-panel--active" : ""}`} id="panel-personal" role="tabpanel" aria-labelledby="tab-personal">
          <div className="ipf-panel__header">
            <div className="ipf-panel__icon ipf-panel__icon--blue" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="ipf-panel__title">Personal Information</h2>
              <p className="ipf-panel__subtitle">Your public profile, bio and social links.</p>
            </div>
          </div>

          <form
            id="personalForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.append("csrf_token", props.csrfToken);
              fd.append("action", "save_personal");
              void post("save_personal", fd, "Personal details updated successfully!");
            }}
          >
            <div className="ipf-form-grid">
              <div className="ipf-field">
                <label className="ipf-label">Full Name</label>
                <div className="ipf-input-locked-wrap">
                  {LOCK_SVG}
                  <input className="ipf-input ipf-input--readonly" type="text" value={props.user.name} disabled aria-describedby="name-hint" readOnly />
                </div>
                <p className="ipf-hint" id="name-hint">Name cannot be changed. Contact support if needed.</p>
              </div>

              <div className="ipf-field">
                <label className="ipf-label">Email Address</label>
                <div className="ipf-input-locked-wrap">
                  {LOCK_SVG}
                  <input className="ipf-input ipf-input--readonly" type="email" value={props.user.email} disabled aria-describedby="email-hint" readOnly />
                </div>
                <p className="ipf-hint" id="email-hint">Email cannot be changed. Contact support if needed.</p>
              </div>

              <div className="ipf-field">
                <label className="ipf-label" htmlFor="phone">Phone Number</label>
                <input className="ipf-input" type="tel" id="phone" name="phone" defaultValue={props.user.phone} placeholder="+91 98765 43210" maxLength={20} autoComplete="tel" />
              </div>

              <div className="ipf-field">
                <label className="ipf-label" htmlFor="years_exp">Years of Experience</label>
                <input className="ipf-input" type="number" id="years_exp" name="years_exp" defaultValue={props.profile.years_exp} min="0" max="60" placeholder="e.g. 5" />
              </div>

              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="headline">Professional Headline</label>
                <input className="ipf-input" type="text" id="headline" name="headline" defaultValue={props.profile.headline} placeholder="e.g. Senior Software Engineer & Full-Stack Educator" maxLength={160} />
              </div>

              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="bio">
                  Professional Bio
                  <span className="ipf-char-counter" id="bioCounter">{`${bioLen}/1500`}</span>
                </label>
                <textarea
                  className="ipf-textarea"
                  id="bio"
                  name="bio"
                  rows={6}
                  defaultValue={props.profile.bio}
                  placeholder="Share your background, expertise and teaching philosophy…"
                  maxLength={1500}
                  aria-describedby="bio-hint bioCounter"
                  onChange={(e) => setBioLen(e.target.value.length)}
                />
                <p className="ipf-hint" id="bio-hint">This appears on your public instructor profile.</p>
              </div>
            </div>

            <div className="ipf-section-divider"><span>Social Links</span></div>

            <div className="ipf-form-grid">
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="website">Website</label>
                <div className="ipf-input-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15" className="ipf-input-icon" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" stroke="currentColor" strokeWidth="2" /></svg>
                  <input className="ipf-input ipf-input--with-icon" type="url" id="website" name="website" defaultValue={props.profile.website} placeholder="https://yourwebsite.com" maxLength={255} />
                </div>
              </div>

              <div className="ipf-field">
                <label className="ipf-label" htmlFor="linkedin_url">LinkedIn</label>
                <div className="ipf-input-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15" className="ipf-input-icon" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 014 0v4M11 10v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <input className="ipf-input ipf-input--with-icon" type="url" id="linkedin_url" name="linkedin_url" defaultValue={props.profile.linkedin_url} placeholder="https://linkedin.com/in/username" maxLength={255} />
                </div>
              </div>

              <div className="ipf-field">
                <label className="ipf-label" htmlFor="twitter_url">Twitter / X</label>
                <div className="ipf-input-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="15" height="15" className="ipf-input-icon" aria-hidden="true"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.4 5.6 3.9 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <input className="ipf-input ipf-input--with-icon" type="url" id="twitter_url" name="twitter_url" defaultValue={props.profile.twitter_url} placeholder="https://twitter.com/username" maxLength={255} />
                </div>
              </div>

              <div className="ipf-field">
                <label className="ipf-label" htmlFor="teaching_style">Teaching Style</label>
                <select className="ipf-select" id="teaching_style" name="teaching_style" defaultValue={props.profile.teaching_style}>
                  <option value="">— Select style —</option>
                  {props.options.teachingStyle.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ipf-panel__footer">
              <button type="submit" className="ipf-btn ipf-btn--primary">
                {SAVE_SVG}
                Save Changes
              </button>
            </div>
          </form>
        </section>

        {/* ── Education ── */}
        <section className={`ipf-panel${tab === "education" ? " ipf-panel--active" : ""}`} id="panel-education" role="tabpanel" aria-labelledby="tab-education">
          <div className="ipf-panel__header">
            <div className="ipf-panel__icon ipf-panel__icon--green" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="ipf-panel__title">Education &amp; Credentials</h2>
              <p className="ipf-panel__subtitle">Your academic background and professional certifications.</p>
            </div>
          </div>

          <form
            id="educationForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.append("csrf_token", props.csrfToken);
              fd.append("action", "save_education");
              void post("save_education", fd, "Education & credentials updated successfully!");
            }}
          >
            <fieldset className="ipf-fieldset">
              <legend className="ipf-label">Highest Education Level</legend>
              <div className="ipf-radio-grid">
                {props.options.education.map(([val, label]) => (
                  <label key={val} className={`ipf-radio-card${highest === val ? " ipf-radio-card--selected" : ""}`}>
                    <input type="radio" name="highest_education" value={val} checked={highest === val} onChange={() => setHighest(val)} />
                    <span className="ipf-radio-card__label">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="ipf-form-grid ipf-form-grid--mt">
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="institution">Institution / University</label>
                <input className="ipf-input" type="text" id="institution" name="institution" defaultValue={props.application.institution} placeholder="e.g. IIT Delhi" maxLength={255} />
              </div>
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="field_of_study">Field of Study</label>
                <input className="ipf-input" type="text" id="field_of_study" name="field_of_study" defaultValue={props.application.field_of_study} placeholder="e.g. Computer Science" maxLength={255} />
              </div>
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="graduation_year">Graduation Year</label>
                <input className="ipf-input" type="number" id="graduation_year" name="graduation_year" defaultValue={props.application.graduation_year} min="1960" max={maxGraduationYear} placeholder="e.g. 2018" />
              </div>
              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="certifications">Certifications &amp; Licenses</label>
                <textarea className="ipf-textarea" id="certifications" name="certifications" rows={3} defaultValue={props.application.certifications} placeholder="List any professional certifications, e.g. AWS Certified Developer, PMP, CFA…" maxLength={1000} />
              </div>
              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="professional_exp">Professional Experience</label>
                <textarea className="ipf-textarea" id="professional_exp" name="professional_exp" rows={4} defaultValue={props.application.professional_exp} placeholder="Describe your professional work experience relevant to your teaching subjects…" maxLength={1500} />
              </div>
              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="notable_works">Notable Works / Portfolio</label>
                <textarea className="ipf-textarea" id="notable_works" name="notable_works" rows={3} defaultValue={props.application.notable_works} placeholder="Books, articles, open-source projects, YouTube channels, portfolio links…" maxLength={1000} />
              </div>
            </div>

            <div className="ipf-panel__footer">
              <button type="submit" className="ipf-btn ipf-btn--primary">
                {SAVE_SVG}
                Save Changes
              </button>
            </div>
          </form>
        </section>

        {/* ── Teaching ── */}
        <section className={`ipf-panel${tab === "teaching" ? " ipf-panel--active" : ""}`} id="panel-teaching" role="tabpanel" aria-labelledby="tab-teaching">
          <div className="ipf-panel__header">
            <div className="ipf-panel__icon ipf-panel__icon--amber" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="20" height="20">
                <rect x="3" y="3" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M8 21h8M12 16v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="ipf-panel__title">Teaching &amp; Subject Expertise</h2>
              <p className="ipf-panel__subtitle">What you teach and who you teach it to.</p>
            </div>
          </div>

          <form
            id="teachingForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.append("csrf_token", props.csrfToken);
              fd.append("action", "save_teaching");
              void post("save_teaching", fd, "Teaching details updated successfully!");
            }}
          >
            <div className="ipf-form-grid">
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="primary_subject">Primary Subject Area</label>
                <input className="ipf-input" type="text" id="primary_subject" name="primary_subject" defaultValue={props.application.primary_subject} placeholder="e.g. Web Development" maxLength={255} />
              </div>
              <div className="ipf-field">
                <label className="ipf-label" htmlFor="secondary_subjects">Secondary Subjects</label>
                <input className="ipf-input" type="text" id="secondary_subjects" name="secondary_subjects" defaultValue={props.application.secondary_subjects} placeholder="e.g. React, Node.js, SQL" maxLength={255} />
              </div>
            </div>

            <fieldset className="ipf-fieldset ipf-fieldset--mt">
              <legend className="ipf-label">Subject Expertise Level</legend>
              <div className="ipf-level-grid">
                {props.options.skillLevel.map(([val, label]) => (
                  <label key={val} className={`ipf-level-card${skill === val ? " ipf-level-card--selected" : ""}`}>
                    <input type="radio" name="skill_level" value={val} checked={skill === val} onChange={() => setSkill(val)} />
                    <span className="ipf-level-card__title">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="ipf-form-grid ipf-form-grid--mt">
              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="target_audience">Target Audience</label>
                <textarea className="ipf-textarea" id="target_audience" name="target_audience" rows={3} defaultValue={props.application.target_audience} placeholder="Who are your ideal students? E.g. beginners in programming, working professionals wanting to upskill…" maxLength={500} />
              </div>
              <div className="ipf-field ipf-field--span2">
                <label className="ipf-label" htmlFor="course_ideas">Course Ideas &amp; Plans</label>
                <textarea className="ipf-textarea" id="course_ideas" name="course_ideas" rows={4} defaultValue={props.application.course_ideas} placeholder="Describe courses you plan to create or already teach…" maxLength={1000} />
              </div>
            </div>

            <div className="ipf-panel__footer">
              <button type="submit" className="ipf-btn ipf-btn--primary">
                {SAVE_SVG}
                Save Changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}