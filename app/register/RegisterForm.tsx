"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPageClient({ csrfToken }: { csrfToken: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(0);
  const router = useRouter();

  const onInput = (v: string) => {
    const checks = [v.length >= 8, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)];
    setScore(checks.filter(Boolean).length);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/auth/register", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(data.redirect);
      return;
    }
    setErrors(data.errors ?? ["Unable to register."]);
    setBusy(false);
  };

  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#6c63ff"];

  return (
    <form className="auth-form" onSubmit={onSubmit} id="registerForm" noValidate>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {errors.length > 0 && <div className="auth-alert" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="auth-field">
        <label className="auth-label" htmlFor="reg-name">Full Name</label>
        <input className="auth-input" type="text" id="reg-name" name="name" required minLength={2} autoComplete="name" />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="reg-email">Email Address</label>
        <input className="auth-input" type="email" id="reg-email" name="email" required autoComplete="email" />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="reg-password">Password</label>
        <div className="auth-pw-wrap">
          <input className="auth-input" type="password" id="reg-password" name="password" required autoComplete="new-password" onChange={(e) => onInput(e.target.value)} />
          <button type="button" className="toggle-password" data-target="reg-password" aria-label="Show password"><i className="fa fa-eye" /></button>
        </div>
        <div className="auth-strength"><span style={{ width: `${score * 25}%`, background: colors[Math.max(0, score - 1)] }} /></div>
        <div className="auth-strength-label" style={{ color: score ? colors[Math.max(0, score - 1)] : undefined }}>{score ? labels[Math.max(0, score - 1)] : ""}</div>
        <ul className="auth-reqs">
          <li className={score >= 1 ? "met" : ""}>At least 8 characters</li>
          <li className={score >= 2 ? "met" : ""}>One uppercase letter</li>
          <li className={score >= 3 ? "met" : ""}>One number</li>
          <li className={score >= 4 ? "met" : ""}>One symbol</li>
        </ul>
      </div>
      <label className="auth-consent"><input type="checkbox" name="consent" required /> I agree to the Terms and Privacy Policy.</label>
      <button className="auth-btn auth-btn--primary auth-btn--lg" type="submit" disabled={busy}>{busy ? "Creating…" : "Create Account"}</button>
      <div className="auth-divider"><span>or sign up with</span></div>
      <div className="auth-oauth">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="auth-oauth-btn auth-oauth-btn--google" href="/api/auth/oauth/google"><span className="auth-oauth-logo">G</span> Google</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="auth-oauth-btn auth-oauth-btn--github" href="/api/auth/oauth/github"><span className="auth-oauth-logo">GH</span> GitHub</a>
      </div>
    </form>
  );
}
