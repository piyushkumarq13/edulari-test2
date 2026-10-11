"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Option = [string, string];

/** Port of public/student/onboarding.php (lines 131-375). */
export default function OnboardingClient({
  csrfToken,
  skillOptions,
  interestOptions,
  educationOptions,
  goalOptions,
  levelOptions,
}: {
  csrfToken: string;
  skillOptions: string[];
  interestOptions: string[];
  educationOptions: Option[];
  goalOptions: Option[];
  levelOptions: Option[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const [selected, setSelected] = useState<Record<string, string>>({});

  function showStep(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pick(name: string, value: string) {
    setSelected((prev) => ({ ...prev, [name]: value }));
  }

  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className="ob-wrapper">
      <Link href="/" className="ob-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/edulari-logo.png" alt="Edulari" />
      </Link>

      <div className="ob-progress-bar" id="progressBar">
        <div className="ob-progress-fill" id="progressFill" style={{ width: `${pct}%` }} />
      </div>
      <p className="ob-progress-label" id="progressLabel">
        Step <span id="stepNum">{step}</span> of {totalSteps}
      </p>

      <form method="post" action="/api/student/onboarding" id="onboardingForm">
        <input type="hidden" name="csrf_token" value={csrfToken} />

        {/* ── STEP 1 — Education ── */}
        <div className={`ob-step ${step === 1 ? "active" : ""}`} id="step1">
          <div className="ob-card">
            <div className="ob-step-icon">🎓</div>
            <h2>What&apos;s your education background?</h2>
            <p className="ob-step-sub">This helps us personalise your learning path.</p>

            <div className="ob-field">
              <label>Highest Education</label>
              <div className="ob-radio-grid">
                {educationOptions.map(([value, label]) => (
                  <label
                    className={`ob-radio-card ${selected.highest_education === value ? "selected" : ""}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="highest_education"
                      value={value}
                      defaultChecked={selected.highest_education === value}
                      onChange={() => pick("highest_education", value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="ob-field">
              <label htmlFor="college_name">College / University Name</label>
              <input type="text" id="college_name" name="college_name" placeholder="e.g. Delhi University" maxLength={255} />
            </div>

            <div className="ob-field">
              <label htmlFor="field_of_study">Field of Study / Stream</label>
              <input type="text" id="field_of_study" name="field_of_study" placeholder="e.g. Computer Science, Commerce" maxLength={255} />
            </div>
          </div>
          <div className="ob-nav">
            <span />
            <button type="button" className="ob-btn-next" data-ob="next" data-step={1} onClick={() => showStep(2)}>
              Next &rarr;
            </button>
          </div>
        </div>

        {/* ── STEP 2 — Learning Goal ── */}
        <div className={`ob-step ${step === 2 ? "active" : ""}`} id="step2">
          <div className="ob-card">
            <div className="ob-step-icon">🎯</div>
            <h2>What&apos;s your main learning goal?</h2>
            <p className="ob-step-sub">We&apos;ll recommend courses aligned to your goal.</p>

            <div className="ob-radio-list">
              {goalOptions.map(([value, label]) => (
                <label className={`ob-radio-row ${selected.learning_goal === value ? "selected" : ""}`} key={value}>
                  <input
                    type="radio"
                    name="learning_goal"
                    value={value}
                    defaultChecked={selected.learning_goal === value}
                    onChange={() => pick("learning_goal", value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ob-nav">
            <button type="button" className="ob-btn-back" data-ob="prev" data-step={2} onClick={() => showStep(1)}>
              &larr; Back
            </button>
            <button type="button" className="ob-btn-next" data-ob="next" data-step={2} onClick={() => showStep(3)}>
              Next &rarr;
            </button>
          </div>
        </div>

        {/* ── STEP 3 — Experience Level ── */}
        <div className={`ob-step ${step === 3 ? "active" : ""}`} id="step3">
          <div className="ob-card">
            <div className="ob-step-icon">📊</div>
            <h2>How would you rate your current experience?</h2>
            <p className="ob-step-sub">Be honest — there are no wrong answers!</p>

            <div className="ob-level-grid">
              {levelOptions.map(([value, label]) => (
                <label className={`ob-level-card ${selected.experience_level === value ? "selected" : ""}`} key={value}>
                  <input
                    type="radio"
                    name="experience_level"
                    value={value}
                    defaultChecked={selected.experience_level === value}
                    onChange={() => pick("experience_level", value)}
                  />
                  <span className="ob-level-title">{ucfirst(value)}</span>
                  <span className="ob-level-desc">{label.split("—")[1]?.trim() ?? ""}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="ob-nav">
            <button type="button" className="ob-btn-back" data-ob="prev" data-step={3} onClick={() => showStep(2)}>
              &larr; Back
            </button>
            <button type="button" className="ob-btn-next" data-ob="next" data-step={3} onClick={() => showStep(4)}>
              Next &rarr;
            </button>
          </div>
        </div>

        {/* ── STEP 4 — Skills & Course Interests ── */}
        <div className={`ob-step ${step === 4 ? "active" : ""}`} id="step4">
          <div className="ob-card">
            <div className="ob-step-icon">💡</div>
            <h2>Your skills &amp; interests</h2>
            <p className="ob-step-sub">Select all that apply — pick as many as you like.</p>

            <div className="ob-field">
              <label>Skills you already have</label>
              <div className="ob-chip-grid">
                {skillOptions.map((skill) => (
                  <label className="ob-chip" key={skill}>
                    <input type="checkbox" name="skills[]" value={skill} />
                    <span>{skill}</span>
                  </label>
                ))}
              </div>
              <input type="text" name="custom_skill" placeholder="+ Add another skill…" className="ob-custom-input" maxLength={100} />
            </div>

            <div className="ob-field" style={{ marginTop: 24 }}>
              <label>Courses / topics you&apos;re interested in</label>
              <div className="ob-chip-grid">
                {interestOptions.map((name) => (
                  <label className="ob-chip" key={name}>
                    <input type="checkbox" name="courses_interested[]" value={name} />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
              <input type="text" name="custom_course" placeholder="+ Other interest…" className="ob-custom-input" maxLength={100} />
            </div>
          </div>
          <div className="ob-nav">
            <button type="button" className="ob-btn-back" data-ob="prev" data-step={4} onClick={() => showStep(3)}>
              &larr; Back
            </button>
            <button type="button" className="ob-btn-next" data-ob="next" data-step={4} onClick={() => showStep(5)}>
              Next &rarr;
            </button>
          </div>
        </div>

        {/* ── STEP 5 — Bio & Contact ── */}
        <div className={`ob-step ${step === 5 ? "active" : ""}`} id="step5">
          <div className="ob-card">
            <div className="ob-step-icon">👤</div>
            <h2>Almost done! A little about you</h2>
            <p className="ob-step-sub">All fields on this step are optional.</p>

            <div className="ob-field">
              <label htmlFor="bio">Short Bio</label>
              <textarea id="bio" name="bio" rows={3} placeholder="Tell us a bit about yourself…" maxLength={500} />
            </div>

            <div className="ob-field">
              <label htmlFor="phone">Phone Number</label>
              <input type="tel" id="phone" name="phone" placeholder="+91 98765 43210" maxLength={20} />
            </div>
          </div>
          <div className="ob-nav">
            <button type="button" className="ob-btn-back" data-ob="prev" data-step={5} onClick={() => showStep(4)}>
              &larr; Back
            </button>
            <button type="submit" className="ob-btn-submit">
              🚀 Start Learning!
            </button>
          </div>
        </div>
      </form>

      <div className="ob-skip">
        <a
          href="/student/dashboard?skip=1"
          id="skipLink"
          onClick={(e) => {
            e.preventDefault();
            if (window.confirm("You can always complete your profile later from your dashboard. Skip for now?")) {
              router.push("/student/dashboard?skip=1");
            }
          }}
        >
          Skip for now — I&apos;ll do this later
        </a>
      </div>
    </div>
  );
}

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}