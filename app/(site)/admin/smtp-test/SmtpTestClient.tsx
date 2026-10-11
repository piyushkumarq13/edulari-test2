"use client";

import { useState } from "react";

type Step = { name: string; ok: boolean; detail: string; ms?: number };
type Result = { ok: boolean; error: string | null; message?: string; steps: Step[] };

export default function SmtpTestClient({ csrfToken }: { csrfToken: string }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);

    const fd = new FormData();
    fd.set("csrf_token", csrfToken);
    fd.set("to", to.trim());

    try {
      const res = await fetch("/api/admin/smtp-test", {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: fd,
        credentials: "same-origin",
      });
      const data = (await res.json()) as Result;
      setResult(data);
      if (data.ok) setTo("");
    } catch {
      setResult({ ok: false, error: "Could not reach the server.", steps: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="smt-form" onSubmit={send}>
        <div>
          <label className="sts-label" htmlFor="smtTo">Send test email to</label>
          <input
            className="sts-input"
            id="smtTo"
            type="email"
            name="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="smt-row-actions">
          <button className="sts-btn sts-btn--primary" type="submit" disabled={busy || to.trim() === ""}>
            {busy ? "Testing…" : "Send test email"}
          </button>
          {busy && <span className="smt-hint" style={{ margin: 0 }}>Waiting for the SMTP server…</span>}
        </div>
      </form>

      {result && (
        <div className={result.ok ? "smt-result smt-result--ok" : "smt-result smt-result--err"} role="status">
          <strong>{result.ok ? "PASS" : "FAIL"}</strong>{" — "}
          {result.ok ? result.message : result.error}

          {result.steps.length > 0 && (
            <ul className="smt-steps">
              {result.steps.map((s) => (
                <li key={s.name} className={s.ok ? "smt-step smt-step--ok" : "smt-step smt-step--err"}>
                  <span className="smt-step__tag">{s.ok ? "OK" : "FAIL"}</span>
                  <span>
                    <span className="smt-code">{s.name}</span>{" — "}
                    {s.detail}
                    {typeof s.ms === "number" ? ` (${s.ms}ms)` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}