"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotForm({ csrfToken }: { csrfToken: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/auth/forgot-password", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.success) {
      router.push(data.redirect);
      return;
    }
    setErrors(data.errors ?? ["Unable to process request."]);
    setBusy(false);
  };

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {errors.length > 0 && <div className="auth-alert" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      <div className="auth-field">
        <label className="auth-label" htmlFor="fp-email">Email Address</label>
        <input className="auth-input" type="email" id="fp-email" name="email" required autoComplete="email" />
      </div>
      <button className="auth-btn auth-btn--primary auth-btn--lg" type="submit" disabled={busy}>{busy ? "Sending..." : "Send Reset Link"}</button>
    </form>
  );
}
