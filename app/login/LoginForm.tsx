"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ reason, redirect, csrfToken }: { reason: string; redirect: string; csrfToken: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/auth/login", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(data.redirect);
      router.refresh();
      return;
    }
    if (data.unverified) router.push(`/account-activation?email=${encodeURIComponent(String(fd.get("email")))}`);
    else if (data.resumeInstructor) router.push("/instructor-register");
    setErrors(data.errors ?? ["Unable to log in."]);
    setBusy(false);
  };

  return (
    <form className="auth-form" onSubmit={onSubmit} id="loginForm" noValidate>
      {reason ? <div className="auth-alert" role="alert">You were signed out ({reason.replace(/_/g, " ")}). Please log in again.</div> : null}
      {errors.length > 0 && <div className="auth-alert" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <input type="hidden" name="redirect" value={redirect} />
      <div className="auth-field">
        <label className="auth-label" htmlFor="login-email">Email Address</label>
        <input className="auth-input" type="email" id="login-email" name="email" required autoComplete="email" />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="login-password">Password</label>
        <div className="auth-pw-wrap">
          <input className="auth-input" type="password" id="login-password" name="password" required autoComplete="current-password" />
          <button type="button" className="toggle-password" data-target="login-password" aria-label="Show password"><i className="fa fa-eye" /></button>
        </div>
      </div>
      <button className="auth-btn auth-btn--primary auth-btn--lg" type="submit" disabled={busy}>{busy ? "Signing in…" : "Log In"}</button>
      <div className="auth-divider"><span>or continue with</span></div>
      <div className="auth-oauth">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="auth-oauth-btn auth-oauth-btn--google" href="/api/auth/oauth/google"><span className="auth-oauth-logo">G</span> Google</a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="auth-oauth-btn auth-oauth-btn--github" href="/api/auth/oauth/github"><span className="auth-oauth-logo">GH</span> GitHub</a>
      </div>
    </form>
  );
}
