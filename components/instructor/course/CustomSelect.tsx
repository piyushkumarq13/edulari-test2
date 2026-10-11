"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The custom select dropdown that create-course.php and edit-course.php attach to every
 * `.cc-select` / `.ec-select`. Reproduced as a real <select> (so the value is submitted and
 * the PHP required-field check still works) with a styled trigger layered on top, matching the
 * original markup: wrapper > native select + trigger button + options panel.
 *
 * `prefix` is "cc" or "ec" so the same component emits the right class names on each page.
 */
export default function CustomSelect({
  name,
  options,
  defaultValue = "",
  prefix,
  required = false,
  id,
  ariaLabel,
  onChange,
  invalid = false,
}: {
  name: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  defaultValue?: string;
  prefix: string;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
  onChange?: (value: string) => void;
  invalid?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [value, setValue] = useState(defaultValue);

  const triggerText =
    options.find((o) => o.value === value)?.label ??
    options.find((o) => o.value === "")?.label ??
    "";

  const close = () => {
    setOpen(false);
    setUp(false);
    setHighlight(-1);
  };

  const choose = (v: string) => {
    setValue(v);
    onChange?.(v);
    close();
  };

  // Measures the panel against the space above and below the trigger, exactly as the PHP's
  // openDropdown() did, then caps maxHeight so a long list scrolls instead of overflowing.
  const measureAndOpen = () => {
    const trigger = wrapRef.current?.querySelector<HTMLElement>(`.${prefix}-custom-select__trigger`);
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    panel.style.maxHeight = "none";
    panel.style.visibility = "hidden";
    panel.style.display = "block";
    const fullH = panel.scrollHeight;
    panel.style.maxHeight = "";
    panel.style.visibility = "";
    panel.style.display = "";
    const shouldUp = spaceBelow < fullH && spaceAbove > spaceBelow;
    setUp(shouldUp);
    panel.style.maxHeight = `${Math.min(fullH, Math.max(120, (shouldUp ? spaceAbove : spaceBelow) - 8))}px`;
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        wrapRef.current?.querySelector<HTMLButtonElement>(`.${prefix}-custom-select__trigger`)?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) =>
          e.key === "ArrowDown" ? Math.min(options.length - 1, h + 1) : Math.max(0, h - 1),
        );
      }
      if (e.key === "Enter" && highlight >= 0) {
        e.preventDefault();
        choose(options[highlight].value);
        wrapRef.current?.querySelector<HTMLButtonElement>(`.${prefix}-custom-select__trigger`)?.focus();
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlight, options, prefix]);

  return (
    <div
      ref={wrapRef}
      className={[
        `${prefix}-custom-select`,
        up ? `${prefix}-custom-select--up` : "",
        open ? `${prefix}-custom-select--open` : "",
        invalid ? `${prefix}-custom-select--error` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <select
        ref={selectRef}
        id={id}
        name={name}
        className={`${prefix}-select`}
        required={required}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => choose(e.target.value)}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`${prefix}-custom-select__trigger`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else measureAndOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) close();
            else measureAndOpen();
          }
        }}
      >
        <span>{triggerText}</span>
        <span className={`${prefix}-chevron`}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div ref={panelRef} className={`${prefix}-custom-select__options`} role="listbox">
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              data-index={i}
              aria-selected={o.value === value}
              onClick={(e) => {
                e.stopPropagation();
                choose(o.value);
              }}
              className={[
                `${prefix}-custom-select__option`,
                o.value === "" ? `${prefix}-custom-select__option--placeholder` : "",
                o.value === value ? `${prefix}-custom-select__option--selected` : "",
                i === highlight ? `${prefix}-custom-select__option--highlighted` : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {o.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}