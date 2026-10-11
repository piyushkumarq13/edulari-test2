"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, type ReactNode } from "react";
import { STEP_LABELS, PANEL_CONTENT } from "@/lib/instructor/wizard";

export interface RegShellProps {
  step: number;
  displayStep: number;
  children: ReactNode;
  error?: string;
  showAutosave?: boolean;
}

/**
 * The chrome shared by every wizard step. Mirrors the markup produced by
 * _layout_top.php + _layout_bottom.php: a sticky step-aware left panel, the 8-dot
 * stepper, the auto-save indicator, the error alert, and the wizard JavaScript
 * (password toggle, strength meter, char counters, tag input, collapsible, file
 * preview, drag-and-drop, autosave flash, submit loading effect, scroll reset).
 */
export default function RegShell({ step, displayStep, children, error, showAutosave }: RegShellProps) {
  const panel = PANEL_CONTENT[displayStep] ?? PANEL_CONTENT[1];

  return (
    <>
      <div className="instructor-reg-wrapper">
        <div className="reg-panel">
          <div className="reg-panel__blob-1" />
          <div className="reg-panel__blob-2" />
          <div className="reg-panel__header">
            <div className="panel-logo">
              <img src="/assets/images/edulari-logo.png" alt="Edulari" />
            </div>
          </div>
          <div className="reg-panel__body">
            <div className="panel-step-content active">
              <div className="panel-step-heading-row">
                <div className="panel-step-visual">{panel.icon}</div>
                <div
                  className="panel-step-headline"
                  dangerouslySetInnerHTML={{ __html: panel.headline }}
                />
              </div>
              <p className="panel-step-desc">{panel.desc}</p>
              {panel.tips.length > 0 && (
                <div className="panel-step-tips">
                  {panel.tips.map(([icon, text]) => (
                    <div className="panel-step-tip" key={text}>
                      <span className="panel-step-tip-icon">{icon}</span>
                      <span className="panel-step-tip-text">{text}</span>
                    </div>
                  ))}
                </div>
              )}
              {panel.trust.length > 0 && (
                <div className="panel-trust-badges">
                  {panel.trust.map(([icon, text]) => (
                    <div className="panel-trust-badge" key={text}>
                      <span className="panel-trust-badge-icon">{icon}</span>
                      <span className="panel-trust-badge-text">{text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="panel-perks">
              <div className="perk-item">💰 Earn up to 70% revenue share</div>
              <div className="perk-item">🌍 Reach learners worldwide</div>
              <div className="perk-item">🛠️ Full course-creation toolkit</div>
              <div className="perk-item">📊 Detailed earnings dashboard</div>
            </div>
          </div>
        </div>

        <div className="reg-form-side">
          <div className="reg-form-container">
            <div className="reg-logo-mobile">
              <img src="/assets/images/edulari-logo.png" alt="Edulari" />
            </div>

            <div className="step-progress">
              {STEP_LABELS.map((s, idx) => {
                const i = idx + 1;
                const dotClass = i === displayStep ? "active" : i < displayStep || i <= step ? "done" : "";
                return (
                  <div className={`progress-step ${dotClass}`} key={s.label}>
                    <div className="progress-dot">
                      {dotClass === "done" && i !== displayStep ? "✓" : i}
                    </div>
                    <div className="progress-label">{s.label}</div>
                  </div>
                );
              })}
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${displayStep === 1 ? 0 : Math.round(((displayStep - 1) / 7) * 100)}%` }}
                />
              </div>
            </div>

            {showAutosave && (
              <div className="autosave-indicator" id="autosaveIndicator">
                <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M13.5 4.5L6.5 11.5L2.5 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Progress saved
              </div>
            )}

            {error && !error.includes("<a ") && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                {error}
              </div>
            )}
            {error && error.includes("<a ") && (
              <div className="alert alert-error">
                <span className="alert-icon">⚠️</span>
                <span dangerouslySetInnerHTML={{ __html: sanitizeMessage(error) }} />
              </div>
            )}

            {children}
          </div>
        </div>
      </div>
      <WizardScript />
    </>
  );
}

/**
 * The wizard error messages are authored here, not taken from user input, and the only
 * markup they may contain is the sign-in link the PHP also embedded.
 */
function sanitizeMessage(message: string): string {
  return message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/href="\/login"/g, 'href="/login"')
    .replace(/&amp;lt;a href=&quot;\/login&amp;quot;&gt;/g, '<a href="/login">')
    .replace(/&amp;lt;\/a&amp;gt;/g, "</a>");
}

/** Every script from _layout_bottom.php, ported 1:1. */
function WizardScript() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // ── Password Visibility Toggle ─────────────────────────────────────────
    const togglePassword = (fieldId: string, btn: HTMLElement) => {
      const input = document.getElementById(fieldId) as HTMLInputElement | null;
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "👁️";
      } else {
        input.type = "password";
        btn.textContent = "🙈";
      }
    };
    const clickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest("[data-toggle-pw]") as HTMLElement | null;
      if (btn) togglePassword(btn.getAttribute("data-toggle-pw") ?? "", btn);
    };
    document.addEventListener("click", clickHandler);

    // ── Password Strength Meter ───────────────────────────────────────────
    const pwInput = document.getElementById("password") as HTMLInputElement | null;
    if (pwInput) {
      const group = pwInput.closest(".form-group");
      const wrap = document.createElement("div");
      wrap.className = "password-strength-wrap";
      wrap.innerHTML =
        '<div class="password-strength-bar"><div class="password-strength-fill" id="pwStrFill"></div></div>' +
        '<span class="password-strength-label" id="pwStrLabel"></span>';
      const hint = group?.querySelector(".field-hint");
      if (hint && group) group.insertBefore(wrap, hint);
      else group?.appendChild(wrap);

      const fill = document.getElementById("pwStrFill");
      const label = document.getElementById("pwStrLabel");
      const evaluate = (pw: string) => {
        if (!pw) return { cls: "", text: "" };
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^a-zA-Z0-9]/.test(pw)) score++;
        if (score <= 1) return { cls: "weak", text: "Weak password" };
        if (score <= 2) return { cls: "fair", text: "Fair password" };
        return { cls: "strong", text: "Strong password" };
      };
      const onPwInput = () => {
        const r = evaluate(pwInput.value);
        if (fill) fill.className = "password-strength-fill " + r.cls;
        if (label) label.className = "password-strength-label " + r.cls;
        if (label) label.textContent = r.text;
      };
      pwInput.addEventListener("input", onPwInput);
    }

    // ── Live Character Counters ───────────────────────────────────────────
    document.querySelectorAll<HTMLElement>(".char-counter[data-target]").forEach((el) => {
      const target = document.getElementById(el.getAttribute("data-target") ?? "") as HTMLInputElement | HTMLTextAreaElement | null;
      const min = parseInt(el.getAttribute("data-min") || "0", 10);
      const max = parseInt(el.getAttribute("data-max") || "0", 10);
      if (!target) return;
      const update = () => {
        const len = target.value.length;
        el.classList.remove("near-limit", "at-limit", "met");
        if (max) {
          const remaining = max - len;
          if (remaining < 0) {
            el.classList.add("at-limit");
            el.textContent = Math.abs(remaining) + " over limit";
          } else {
            if (remaining <= Math.ceil(max * 0.15)) el.classList.add("near-limit");
            el.textContent = len + " / " + max + " characters";
          }
        } else if (min) {
          const pct = len / min;
          if (len >= min) {
            el.classList.add("met");
            el.textContent = "✓ " + len + " characters (minimum met)";
          } else {
            if (pct >= 0.75) el.classList.add("near-limit");
            el.textContent = len + " / " + min + " min characters";
          }
        }
      };
      target.addEventListener("input", update);
      update();
    });

    // ── PAN / IFSC Auto-uppercase ──────────────────────────────────────────
    ["pan_number", "ifsc_code"].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) {
        el.addEventListener("input", () => {
          el.value = el.value.toUpperCase();
        });
      }
    });

    // ── Tag Input Widget ───────────────────────────────────────────────────
    const hidden = document.getElementById("secondary_subjects") as HTMLInputElement | null;
    const wrapper = document.getElementById("tagInputWrapper");
    if (hidden && wrapper) {
      const textInput = wrapper.querySelector(".tag-text-input") as HTMLInputElement | null;
      if (textInput) {
        const getTags = () =>
          hidden.value ? hidden.value.split(",").map((t) => t.trim()).filter(Boolean) : [];
        const setTags = (tags: string[]) => {
          hidden.value = tags.join(", ");
        };
        const renderChips = () => {
          wrapper.querySelectorAll(".tag-chip").forEach((c) => c.remove());
          getTags().forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "tag-chip";
            const label = document.createElement("span");
            label.textContent = tag;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "tag-chip-remove";
            btn.setAttribute("aria-label", "Remove " + tag);
            btn.textContent = "✕";
            btn.addEventListener("click", () => {
              setTags(getTags().filter((t) => t !== tag));
              renderChips();
            });
            chip.appendChild(label);
            chip.appendChild(btn);
            wrapper.insertBefore(chip, textInput);
          });
        };
        const addTag = (value: string) => {
          const tag = value.trim().replace(/,/g, "").substring(0, 40);
          if (!tag) return;
          const tags = getTags();
          if (!tags.includes(tag) && tags.length < 15) {
            tags.push(tag);
            setTags(tags);
            renderChips();
          }
          textInput.value = "";
        };
        textInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(textInput.value);
          } else if (e.key === "Backspace" && !textInput.value) {
            const tags = getTags();
            if (tags.length) {
              tags.pop();
              setTags(tags);
              renderChips();
            }
          }
        });
        textInput.addEventListener("blur", () => {
          if (textInput.value.trim()) addTag(textInput.value);
        });
        wrapper.addEventListener("click", () => textInput.focus());
        renderChips();
      }
    }

    // ── Collapsible Section ────────────────────────────────────────────────
    document.querySelectorAll<HTMLButtonElement>(".collapsible-toggle").forEach((btn) => {
      const body = document.getElementById(btn.getAttribute("aria-controls") ?? "");
      if (!body) return;
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        body.classList.toggle("open", !expanded);
      });
      const hasValue = Array.from(body.querySelectorAll("input, textarea")).some(
        (f) => (f as HTMLInputElement).value.trim(),
      );
      if (hasValue) {
        btn.setAttribute("aria-expanded", "true");
        body.classList.add("open");
      }
    });

    // ── File Upload Preview ────────────────────────────────────────────────
    const previewFile = (input: HTMLInputElement, previewId: string, nameId: string) => {
      const nameEl = document.getElementById(nameId);
      const previewWrap = document.getElementById(previewId);
      const box = input.closest(".file-upload-box");
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      const sizeKB = String(Math.round(file.size / 1024));
      if (nameEl) {
        nameEl.innerHTML = "";
        const check = document.createElement("span");
        check.textContent = "✅ ";
        const strong = document.createElement("strong");
        strong.textContent = file.name;
        nameEl.appendChild(check);
        nameEl.appendChild(strong);
        nameEl.appendChild(document.createTextNode(` (${sizeKB} KB)`));
        nameEl.style.display = "flex";
      }
      box?.classList.add("file-selected-state");
      if (previewWrap) previewWrap.innerHTML = "";
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (isImage && previewWrap) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.createElement("img");
          img.className = "file-preview-img";
          img.src = String((e.target as FileReader).result ?? "");
          img.alt = "Preview";
          previewWrap.appendChild(img);
        };
        reader.readAsDataURL(file);
      } else if (isPdf && previewWrap) {
        const div = document.createElement("div");
        div.className = "file-preview-pdf";
        const icon = document.createElement("span");
        icon.className = "pdf-icon";
        icon.textContent = "📄";
        div.appendChild(icon);
        const text = document.createElement("span");
        text.textContent = ` ${file.name} (${sizeKB} KB)`;
        div.appendChild(text);
        previewWrap.appendChild(div);
      }
    };
    const changeHandler = (e: Event) => {
      const input = (e.target as HTMLElement).closest("input[type=file][data-preview]") as HTMLInputElement | null;
      if (input) previewFile(input, input.getAttribute("data-preview") ?? "", input.getAttribute("data-name") ?? "");
    };
    document.addEventListener("change", changeHandler);

    // ── Drag-and-drop Styling ─────────────────────────────────────────────
    document.querySelectorAll<HTMLElement>(".file-upload-box").forEach((box) => {
      box.addEventListener("dragover", (e) => {
        e.preventDefault();
        box.classList.add("drag-over");
      });
      box.addEventListener("dragleave", () => box.classList.remove("drag-over"));
      box.addEventListener("drop", (e) => {
        e.preventDefault();
        box.classList.remove("drag-over");
        const input = box.querySelector("input[type=file]") as HTMLInputElement | null;
        const dt = (e as DragEvent).dataTransfer;
        if (input && dt && dt.files.length) {
          input.files = dt.files;
          input.dispatchEvent(new Event("change"));
        }
      });
      box.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (t === box || t.classList.contains("file-upload-prompt") || t.closest(".file-upload-prompt")) {
          box.querySelector<HTMLInputElement>("input[type=file]")?.click();
        }
      });
    });

    // ── Auto-save Indicator ───────────────────────────────────────────────
    const indicator = document.getElementById("autosaveIndicator");
    if (indicator) {
      setTimeout(() => {
        indicator.classList.add("show");
        setTimeout(() => indicator.classList.remove("show"), 2800);
      }, 600);
    }

    // ── Form Submit Loading Effect ────────────────────────────────────────
    document.querySelectorAll("form").forEach((form) => {
      form.addEventListener("submit", () => {
        const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"].btn-primary');
        if (!submitBtn) return;
        if (!submitBtn.querySelector(".btn-label")) {
          const span = document.createElement("span");
          span.className = "btn-label";
          span.innerHTML = submitBtn.innerHTML;
          submitBtn.innerHTML = "";
          submitBtn.appendChild(span);
        }
        submitBtn.classList.add("is-loading");
        submitBtn.setAttribute("disabled", "disabled");
      });
    });

    // ── Reset panel/page scroll position on every step load ───────────────
    const resetScroll = () => {
      const panelBody = document.querySelector(".reg-panel__body");
      const formSide = document.querySelector(".reg-form-side");
      if (panelBody) panelBody.scrollTop = 0;
      if (formSide) formSide.scrollTop = 0;
      window.scrollTo(0, 0);
    };
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    resetScroll();
    window.addEventListener("pageshow", resetScroll);

    return () => {
      document.removeEventListener("click", clickHandler);
      document.removeEventListener("change", changeHandler);
    };
  }, []);

  return null;
}