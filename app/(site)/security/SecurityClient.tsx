"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SecurityClient({ csrfToken }: { csrfToken: string }) {
  const [showStrength, setShowStrength] = useState(false);
  const [strengthScore, setStrengthScore] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const [reqs, setReqs] = useState({ len: false, upper: false, num: false, sym: false });

  const checkPassword = (val: string) => {
    if (!val) {
      setShowStrength(false);
      setReqs({ len: false, upper: false, num: false, sym: false });
      return;
    }
    setShowStrength(true);
    const hasLen = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasSym = /[^A-Za-z0-9]/.test(val);
    const score = [hasLen, hasUpper, hasNum, hasSym].filter(Boolean).length;
    setReqs({ len: hasLen, upper: hasUpper, num: hasNum, sym: hasSym });
    setStrengthScore(score);
    const labels = ["Weak", "Fair", "Good", "Strong"];
    setStrengthLabel(labels[Math.max(0, score - 1)]);
  };

  const togglePw = (id: string) => {
    const inp = document.getElementById(id) as HTMLInputElement | null;
    if (inp) inp.type = inp.type === "password" ? "text" : "password";
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors([]);
    setSuccess("");
    const res = await fetch("/api/security/change-password", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.success) {
      setSuccess(data.message);
      e.currentTarget.reset();
      setShowStrength(false);
      router.refresh();
      return;
    }
    setErrors(data.errors ?? ["Unable to update your password."]);
  };

  return (
    <>
      <form onSubmit={onSubmit} id="passwordForm" className="sec-form" noValidate>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <div className="sec-form-stack">
          <div className="sec-field">
            <label className="sec-label" htmlFor="current_password">Current Password</label>
            <div className="sec-pw-wrap">
              <input className="sec-input" type="password" id="current_password" name="current_password" placeholder="Enter current password" autoComplete="current-password" required />
              <button type="button" className="sec-pw-toggle" onClick={() => togglePw("current_password")} aria-label="Toggle password visibility">
                <svg className="sec-eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>
          <div className="sec-form-row">
            <div className="sec-field">
              <label className="sec-label" htmlFor="new_password">New Password</label>
              <div className="sec-pw-wrap">
                <input className="sec-input" type="password" id="new_password" name="new_password" placeholder="Min. 8 characters" autoComplete="new-password" required onInput={(e) => checkPassword((e.target as HTMLInputElement).value)} />
                <button type="button" className="sec-pw-toggle" onClick={() => togglePw("new_password")} aria-label="Toggle password visibility">
                  <svg className="sec-eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="sec-field">
              <label className="sec-label" htmlFor="confirm_password">Confirm New Password</label>
              <div className="sec-pw-wrap">
                <input className="sec-input" type="password" id="confirm_password" name="confirm_password" placeholder="Repeat new password" autoComplete="new-password" required />
                <button type="button" className="sec-pw-toggle" onClick={() => togglePw("confirm_password")} aria-label="Toggle password visibility">
                  <svg className="sec-eye-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        {showStrength ? (
          <div className="sec-strength" id="strengthWrap" style={{ display: "block" }} aria-live="polite">
            <div className="sec-strength__track">
              <div className="sec-strength__fill" id="strengthFill" style={{ width: `${(strengthScore / 4) * 100}%` }} />
            </div>
            <span className="sec-strength__label" id="strengthLabel">{strengthLabel}</span>
          </div>
        ) : (
          <div className="sec-strength" id="strengthWrap" style={{ display: "none" }} aria-live="polite">
            <div className="sec-strength__track"><div className="sec-strength__fill" id="strengthFill" /></div>
            <span className="sec-strength__label" id="strengthLabel" />
          </div>
        )}
        <ul className="sec-reqs" id="pwReqs" aria-label="Password requirements">
          <li className={`sec-req ${reqs.len ? "is-met" : ""}`} id="req-len">At least 8 characters</li>
          <li className={`sec-req ${reqs.upper ? "is-met" : ""}`} id="req-upper">One uppercase letter (A-Z)</li>
          <li className={`sec-req ${reqs.num ? "is-met" : ""}`} id="req-num">One number (0-9)</li>
          <li className={`sec-req ${reqs.sym ? "is-met" : ""}`} id="req-sym">One symbol (!@#$...)</li>
        </ul>
        {errors.length > 0 ? <div className="sec-alert sec-alert--error" id="secAlert" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
        {success ? <div className="sec-alert sec-alert--success" id="secAlert" role="status">{success}</div> : null}
        <div className="sec-card__footer">
          <button type="submit" className="sec-btn sec-btn--danger" disabled={busy}>{busy ? "Updating..." : "Update Password"}</button>
          <p className="sec-card__footer-note">All other logged-in devices will be signed out.</p>
        </div>
      </form>
    </>
  );
}
