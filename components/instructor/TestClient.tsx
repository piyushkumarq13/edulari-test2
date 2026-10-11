"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TestQuestion } from "@/lib/instructor/test-constants";
import { TEST_PASS_SCORE, TEST_QUESTION_COUNT, TEST_TOKEN_TTL_MINS } from "@/lib/instructor/test-constants";
import type { TestState } from "@/lib/api-test-helpers";

export type TestClientProps = TestState & { csrf: string };

/**
 * Port of public/test/index.php: the three-phase page (intro → details → active test),
 * the pass/fail/blocked cards, the one-question-at-a-time runner with answers locked on
 * first selection, the autosave, the countdown timer and the anti-cheat module.
 */
export default function TestClient(props: TestClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "details" | "test">(props.phase);
  const [questions, setQuestions] = useState<TestQuestion[]>(props.questions ?? []);
  const [answers, setAnswers] = useState<Record<string, string>>(props.answers ?? {});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number>(props.remaining_secs || TEST_TOKEN_TTL_MINS * 60);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(props.error ?? "");
  const [generateError, setGenerateError] = useState(props.generate_error ?? "");
  const [result, setResult] = useState(props.result ?? null);
  const [warning, setWarning] = useState<{ title: string; message: string; icon: string; fs: boolean; count: number } | null>(null);
  const [showGate, setShowGate] = useState(false);
  const warnCount = useRef(0);
  const blurCount = useRef(0);
  const loggedRef = useRef(false);

  const logViolation = (type: string) => {
    const fd = new FormData();
    fd.set("csrf_token", props.csrf);
    fd.set("token", props.token);
    fd.set("violation_type", type);
    fetch("/api/test/violation", { method: "POST", body: fd }).catch(() => {});
  };

  const showWarning = (title: string, message: string, icon: string, type: string, isFs = false) => {
    warnCount.current += 1;
    setWarning({ title, message, icon, fs: isFs, count: warnCount.current });
    document.body.style.overflow = "hidden";
    logViolation(type);
  };

  // Redirects driven by the server (pass → success page, invalid → home).
  useEffect(() => {
    if (props.redirect) {
      if (props.redirect === "/") return; // invalid token: the PHP redirected to "/"
      router.push(props.redirect);
    }
  }, [props.redirect, router]);

  // ── Anti-cheat module (ported 1:1 from the PHP inline <script>) ────────────
  useEffect(() => {
    const isGated = phase === "details" || (phase === "test" && questions.length > 0 && !result);
    const isTest = phase === "test" && questions.length > 0 && !result;

    const isFullscreen = () =>
      !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement);

    const enterFullscreen = () => {
      const el = document.documentElement;
      const req = (el as unknown as { requestFullscreen?: () => Promise<void> }).requestFullscreen;
      if (!req) return;
      req.call(el).catch(() => setShowGate(true));
    };

    const setStartState = (enabled: boolean) => {
      const btn = document.getElementById("startTestBtn") as HTMLButtonElement | null;
      const notice = document.getElementById("fsRequiredNotice");
      if (!btn) return;
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.45";
      btn.style.cursor = enabled ? "pointer" : "not-allowed";
      if (notice) notice.style.display = enabled ? "none" : "block";
    };

    const onFsChange = () => {
      if (!isGated) return;
      if (isFullscreen()) {
        setShowGate(false);
        setStartState(true);
        setWarning((w) => (w && w.fs ? null : w));
      } else {
        setStartState(false);
        setShowGate(true);
        if (isTest) {
          showWarning(
            "Fullscreen Required",
            "You have exited fullscreen mode. You must return to fullscreen to continue the test. Click the button below to restore fullscreen.",
            "🖥️",
            "fullscreen_exit",
            true,
          );
        }
      }
    };

    const warnDevTools = () => {
      if (!isGated) return;
      showWarning("Developer Tools Blocked", "Opening developer tools is not permitted during this test. This action has been logged.", "🔧", "devtools_attempt");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "F12") { e.preventDefault(); e.stopPropagation(); warnDevTools(); return; }
      if (ctrl && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) {
        e.preventDefault(); e.stopPropagation(); warnDevTools(); return;
      }
      if (e.altKey && (e.key === "I" || e.key === "i")) { e.preventDefault(); e.stopPropagation(); warnDevTools(); return; }
      if (ctrl && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")) { e.preventDefault(); return; }
      if (ctrl && (e.key === "s" || e.key === "S" || e.key === "a" || e.key === "A")) { e.preventDefault(); return; }
      if (ctrl && (e.key === "p" || e.key === "P")) { e.preventDefault(); showWarning("Printing Disabled", "Printing is not allowed during the test.", "🖨️", "print_attempt"); return; }
      if (ctrl && (e.key === "u" || e.key === "U")) { e.preventDefault(); showWarning("Source Viewing Disabled", "Viewing page source is not allowed during the test.", "🔍", "view_source_attempt"); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
    };

    const onContextMenu = (e: Event) => { e.preventDefault(); };
    const onDragStart = (e: Event) => { e.preventDefault(); };
    const onSelectStart = (e: Event) => {
      const t = (e.target as HTMLElement).tagName?.toLowerCase();
      if (t === "input" || t === "textarea") return;
      e.preventDefault();
    };
    const onBlur = () => { if (isTest) { blurCount.current += 1; logViolation("window_blur_" + blurCount.current); } };
    const onFocus = () => {
      if (isTest && blurCount.current > 0) {
        showWarning("Tab Switch Detected", `You switched away from the test window ${blurCount.current} time(s). This activity is logged and reviewed by your instructor.`, "🔄", "tab_switch");
      }
    };
    const onVisibility = () => { if (isTest && document.hidden) logViolation("tab_hidden"); };

    const patchScreenCapture = () => {
      const md = navigator.mediaDevices;
      if (!md || !md.getDisplayMedia) return;
      const orig = md.getDisplayMedia.bind(md);
      md.getDisplayMedia = (opts: MediaStreamConstraints) => {
        logViolation("screen_capture_attempt");
        showWarning("Screen Recording Detected", "An attempt to share or record your screen was detected. This is strictly prohibited and has been logged.", "📹", "screen_capture_attempt");
        return orig(opts);
      };
    };

    const checkDevTools = () => {
      if (!isGated) return;
      const threshold = 160;
      const wDiff = window.outerWidth - window.innerWidth;
      const hDiff = window.outerHeight - window.innerHeight;
      if ((wDiff > threshold || hDiff > threshold) && !loggedRef.current) {
        loggedRef.current = true;
        warnDevTools();
      } else if (wDiff <= threshold && hDiff <= threshold) {
        loggedRef.current = false;
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("selectstart", onSelectStart, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    patchScreenCapture();
    const devInterval = setInterval(checkDevTools, 1500);

    // Run after paint so this is not a cascading synchronous render.
    const raf = requestAnimationFrame(() => {
      if (!isGated) return;
      if (isFullscreen()) { setShowGate(false); setStartState(true); }
      else { setShowGate(true); setStartState(false); }
    });

    (window as unknown as { __enterFullscreen?: () => void }).__enterFullscreen = enterFullscreen;

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("selectstart", onSelectStart, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(devInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questions.length, result]);

  // ── Countdown timer ───────────────────────────────────────────────────────────
  // The timer auto-submits when it reaches zero, exactly like the PHP interval. The
  // submitter is a ref so the effect does not need it in its dependency list.
  const submitRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (phase !== "test" || questions.length === 0 || result) return;
    const tick = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(tick);
          void submitRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase, questions.length, result]);

  const enterFullscreen = () => {
    const el = document.documentElement;
    const req = (el as unknown as { requestFullscreen?: () => Promise<void> }).requestFullscreen;
    req?.call(el).catch(() => setShowGate(true));
  };

  const dismissWarning = () => {
    logViolation("warning_dismissed");
    setWarning(null);
    document.body.style.overflow = "";
    if (warning?.fs) {
      setShowGate(true);
      enterFullscreen();
    }
  };

  const select = (idx: number, letter: string) => {
    setAnswers((prev) => {
      if (prev[String(idx)]) return prev;
      const next = { ...prev, [String(idx)]: letter };
      const fd = new FormData();
      fd.set("csrf_token", props.csrf);
      fd.set("token", props.token);
      fd.set("autosave_answer", "1");
      fd.set("question_index", String(idx));
      fd.set("option_letter", letter);
      fetch("/api/test/autosave", { method: "POST", body: fd }).catch(() => {});
      return next;
    });
  };

  const goDetails = async () => {
    const fd = new FormData();
    fd.set("csrf_token", props.csrf);
    fd.set("token", props.token);
    fd.set("action", "go_details");
    await fetch("/api/test", { method: "POST", body: fd });
    setPhase("details");
  };

  const goStart = async () => {
    setGenerating(true);
    const fd = new FormData();
    fd.set("csrf_token", props.csrf);
    fd.set("token", props.token);
    fd.set("action", "go_start");
    try {
      const res = await fetch("/api/test", { method: "POST", body: fd });
      const json = (await res.json()) as { state?: typeof props };
      if (json.state) {
        if (json.state.generate_error) { setGenerateError(json.state.generate_error); setPhase("details"); return; }
        setQuestions(json.state.questions);
        setRemaining(json.state.remaining_secs || TEST_TOKEN_TTL_MINS * 60);
        setPhase("test");
        setCurrent(0);
      }
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    const fd = new FormData();
    fd.set("csrf_token", props.csrf);
    fd.set("token", props.token);
    fd.set("action", "submit_test");
    questions.forEach((_, i) => fd.set(`q_${i}`, answers[String(i)] ?? ""));
    const res = await fetch("/api/test", { method: "POST", body: fd });
    const json = (await res.json()) as { state?: typeof props; error?: string };
    if (json.state) {
      if (json.state.redirect && json.state.redirect !== "/") return router.push(json.state.redirect);
      setResult(json.state.result);
      setError(json.state.error);
      setPhase("test");
    } else if (json.error) {
      setError(json.error);
    }
  };

  // Keep the timer able to submit without depending on the closure above.
  useEffect(() => {
    submitRef.current = submit;
  });

  const answeredCount = Object.keys(answers).length;
  const isLast = current === questions.length - 1;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <>
      {/* Fullscreen gate */}
      {showGate && (
        <div id="fullscreenGate" style={{ display: "flex" }}>
          <div className="fs-icon">🖥️</div>
          <h2>Fullscreen Required</h2>
          <p>This test must be taken in fullscreen mode to ensure integrity. Please click the button below to enter fullscreen before you can begin.</p>
          <button className="fs-btn" id="enterFullscreenBtn" onClick={enterFullscreen}>Enter Fullscreen &amp; Continue</button>
        </div>
      )}

      {/* Warning overlay */}
      {warning && (
        <div id="warningOverlay" className="active" role="alertdialog" aria-modal="true" aria-labelledby="warnTitle">
          <div className="warning-box">
            <span className="warn-icon" id="warnIcon">{warning.icon}</span>
            <h3 id="warnTitle">{warning.title}</h3>
            <p id="warnMessage">{warning.message}</p>
            <div className="warn-count" id="warnCount">Warning #{warning.count}</div>
            <button className="warn-dismiss" id="warnDismissBtn" onClick={dismissWarning}>
              {warning.fs ? "🖥️  Return to Fullscreen" : "I Understand — Continue Test"}
            </button>
          </div>
        </div>
      )}

      <div className="spinner-overlay" id="spinnerOverlay" style={{ display: generating ? "flex" : "none" }}>
        <div className="spinner-box">
          <div className="spinner-ring" />
          <p className="spinner-text">Generating your personalised questions…</p>
          <p className="spinner-subtext">Our AI is crafting questions tailored to your subject area. This may take a few seconds.</p>
        </div>
      </div>

      <div className="test-wrapper">
        <header className="test-header">
          <div className="header-logo"><img src="/assets/images/edulari-logo.png" alt="Edulari" /></div>
          <div className="header-info">
            <span className="badge badge-test">{props.test_badge_label}</span>
            {phase === "test" && questions.length > 0 && !result && (
              <span className={`test-timer${remaining <= 120 ? " timer-warning" : ""}`} id="testTimer" data-remaining-seconds={remaining}>
                ⏱ {m}:{String(s).padStart(2, "0")}
              </span>
            )}
          </div>
        </header>

        <div className="test-container">
          {generateError && (
            <div className="card error-card">
              <div className="card-icon">⚠️</div>
              <h2>Test Generation Failed</h2>
              <p>{generateError}</p>
              <a href={props.redirect_fail} className="btn btn-secondary">← Go Back</a>
            </div>
          )}

          {props.blocked && !generateError && (
            <div className="card result-card result-fail">
              <div className="card-icon">🚫</div>
              <h2>Access Temporarily Blocked</h2>
              <p className="result-note" style={{ marginTop: 12 }}>
                You have already attempted this test and did not reach the required passing score.
                Only <strong>one retry</strong> is permitted after a <strong>7-day waiting period</strong>.
              </p>
              <div className="score-display" style={{ marginTop: 16 }}>
                <span className="score-label">🔓 You may retry after: <strong>{props.retry_after ? new Date(props.retry_after).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</strong></span>
              </div>
            </div>
          )}

          {result && !result.passed && !props.blocked && !generateError && (
            <div className="card result-card result-fail">
              <div className="card-icon">😔</div>
              <h2>Test Not Passed</h2>
              <div className="score-display">
                <span className="score-number">{result.score}%</span>
                <span className="score-label">{result.correct} / {result.total} correct &nbsp;·&nbsp; Minimum required: {TEST_PASS_SCORE}%</span>
              </div>
              <p className="result-note" style={{ marginTop: 14 }}>
                You did not reach the minimum passing score. Your account and device have been blocked from retaking this test for <strong>7 days</strong>.
              </p>
              <div className="score-display" style={{ marginTop: 12 }}>
                <span className="score-label">🔓 You may retry after: <strong>{result.retry_date}</strong></span>
              </div>
            </div>
          )}

          {phase === "intro" && !props.blocked && !result && !generateError && (
            <div className="card pretest-card">
              <div className="card-icon">📋</div>
              <h2>Before You Begin</h2>
              <p className="pretest-subhead">You&apos;re about to take the {props.test_title}. Here&apos;s what to expect:</p>
              <div className="pretest-info-grid">
                <div className="info-item"><span className="info-icon">❓</span><div><strong>Questions</strong><span>AI-generated, tailored to your subject area</span></div></div>
                <div className="info-item"><span className="info-icon">⏱️</span><div><strong>Time Limit</strong><span>{TEST_TOKEN_TTL_MINS} minutes</span></div></div>
                <div className="info-item"><span className="info-icon">🎯</span><div><strong>Passing Score</strong><span>{TEST_PASS_SCORE}% or above</span></div></div>
                <div className="info-item"><span className="info-icon">🔒</span><div><strong>Single Use</strong><span>This link is personal and can only be used once</span></div></div>
              </div>
              <div className="pretest-tips" style={{ marginTop: 20 }}>
                <strong>📜 Rules &amp; Regulations:</strong>
                <ul>
                  <li>Do not refresh or close the browser during the test</li>
                  <li>You cannot pause the test once started</li>
                  <li>Each question must be answered before you can proceed</li>
                  <li>The timer starts the moment you click <em>Start Test</em></li>
                  <li>Failing will result in a <strong>7-day block</strong> before you can retry</li>
                  <li>This link is single-use — do not share it</li>
                </ul>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void goDetails(); }}>
                <input type="hidden" name="csrf_token" value={props.csrf} />
                <input type="hidden" name="token" value={props.token} />
                <button type="submit" name="go_details" className="btn btn-primary btn-lg" style={{ marginTop: 24, width: "100%" }}>View Test Details →</button>
              </form>
            </div>
          )}

          {phase === "details" && !generateError && (
            <div className="card pretest-card">
              <div className="card-icon">🎓</div>
              <h2>Your Personalised Test</h2>
              <div className="test-details-block">
                {props.test_subject && <div className="detail-row"><span className="detail-label">Subject</span><span className="detail-value">{props.test_subject}</span></div>}
                {props.test_level && <div className="detail-row"><span className="detail-label">Level</span><span className="detail-value">{props.test_level}</span></div>}
                <div className="detail-row"><span className="detail-label">Format</span><span className="detail-value">Multiple-choice questions ({TEST_QUESTION_COUNT} questions)</span></div>
                <div className="detail-row"><span className="detail-label">Minimum to pass</span><span className="detail-value">{TEST_PASS_SCORE}%</span></div>
                <div className="detail-row"><span className="detail-label">Time allowed</span><span className="detail-value">{TEST_TOKEN_TTL_MINS} minutes</span></div>
              </div>
              <div className="pretest-tips">
                <strong>💡 Tips for success:</strong>
                <ul>
                  <li>Find a quiet place with a stable internet connection</li>
                  <li>Read each question carefully before answering</li>
                  <li>The timer starts the moment you click Start</li>
                  <li>You cannot pause the test once started</li>
                </ul>
              </div>
              {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
              <form onSubmit={(e) => { e.preventDefault(); void goStart(); }}>
                <input type="hidden" name="csrf_token" value={props.csrf} />
                <input type="hidden" name="token" value={props.token} />
                <p style={{ textAlign: "center", fontSize: 16, fontWeight: 600, marginTop: 24, color: "#0f172a" }}>Are you ready to start?</p>
                <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                  Questions are generated by AI when you click Start — this may take a few seconds.
                </p>
                <button type="submit" name="go_start" className="btn btn-primary btn-lg" style={{ width: "100%" }} id="startTestBtn">🚀 Yes, Start Test</button>
                <div id="fsRequiredNotice" style={{ display: "none", marginTop: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "#92400e" }}>
                  ⚠️ <strong>Fullscreen is required</strong> to start the test. Click the button above to enter fullscreen first.
                </div>
              </form>
            </div>
          )}

          {phase === "test" && questions.length > 0 && !result && (
            <>
              <div className="test-intro"><h1>{props.test_title}</h1></div>
              {error && <div className="alert alert-error">{error}</div>}
              <form id="testForm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                <input type="hidden" name="csrf_token" value={props.csrf} />
                <input type="hidden" name="token" value={props.token} />
                {questions.map((q, i) => (
                  <div className="question-card" key={i} id={`qcard-${i}`} style={{ display: i === current ? "block" : "none" }}>
                    <div className="question-number">Question {i + 1} of {questions.length}</div>
                    <p className="question-text">{q.question}</p>
                    <div className="options-grid">
                      {(["A", "B", "C", "D"] as const).map((letter) => {
                        const checked = answers[String(i)] === letter;
                        const locked = Boolean(answers[String(i)]) && !checked;
                        return (
                          <label className={`option-label${checked ? " selected" : ""}`} key={letter} style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto" }}>
                            <input type="radio" id={`q${i}_${letter}`} name={`q_${i}`} value={letter} required
                                   checked={checked} onChange={() => select(i, letter)} />
                            <span className="option-marker">{letter}</span>
                            <span className="option-text">{q.options[letter]}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="progress-bar-wrap">
                  <div className="progress-bar-track"><div className="progress-bar-fill" id="progressFill" style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }} /></div>
                  <span className="progress-label" id="progressLabel">{answeredCount} / {questions.length} answered</span>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button type="button" id="prevBtn" className="btn btn-secondary" disabled={current === 0} onClick={() => { setCurrent((c) => Math.max(0, c - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>← Previous</button>
                  {!isLast && (
                    <button type="button" id="nextBtn" className="btn btn-primary" style={{ flex: 1 }}
                            onClick={() => {
                              if (!answers[String(current)]) { alert("Please select an answer before proceeding."); return; }
                              setCurrent((c) => Math.min(questions.length - 1, c + 1));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}>Next →</button>
                  )}
                </div>
                <div className="submit-row" id="submitRow" style={{ display: isLast ? "flex" : "none", flexDirection: "column", alignItems: "center" }}>
                  <button type="submit" name="submit_test" className="btn btn-primary btn-lg" id="submitBtn" disabled={answeredCount < questions.length}>Submit Test →</button>
                  <p className="submit-note">All questions must be answered before submitting.</p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}