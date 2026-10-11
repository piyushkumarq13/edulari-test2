"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetForm({ token, csrfToken }: { token: string; csrfToken: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/auth/reset-password", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(data.redirect);
      return;
    }
    setErrors(data.errors ?? ["Unable to reset password."]);
    setBusy(false);
  };

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {errors.length > 0 && <div className="auth-alert" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <div className="auth-field">
        <label className="auth-label" htmlFor="rp-password">New Password</label>
        <div className="auth-pw-wrap">
          <input className="auth-input" type="password" id="rp-password" name="password" required minLength={8} autoComplete="new-password" />
          <button type="button" className="toggle-password" data-target="rp-password" aria-label="Show password"><i className="fa fa-eye" /></button>
        </div>
        <ul className="auth-reqs">
          <li>At least 8 characters</li>
          <li>One uppercase letter</li>
          <li>One number</li>
          <li>One symbol</li>
        </ul>
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="rp-confirm">Confirm New Password</label>
        <input className="auth-input" type="password" id="rp-confirm" name="confirm_password" required minLength={8} autoComplete="new-password" />
      </div>
      <button className="auth-btn auth-btn--primary auth-btn--lg" type="submit" disabled={busy}>{busy ? "Updating..." : "Update Password"}</button>
    </form>
  );
}
