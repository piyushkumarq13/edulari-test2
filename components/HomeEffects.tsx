"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COUNTER_DURATION = 1800;
const REVEAL_THRESHOLD = 0.12;
const COUNTER_THRESHOLD = 0.4;

/**
 * Port of the animated counters, scroll-reveal, back-to-top and toast helpers
 * from the page script in public/index.php.
 */
export default function HomeEffects({ onToastReady }: { onToastReady?: (show: (msg: string, type?: "success" | "error") => void) => void }) {
  const toastRef = useRef<HTMLDivElement | null>(null);
  const toastMsgRef = useRef<HTMLSpanElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastType = useRef<string>("success");

  useEffect(() => {
    document.getElementById("fontStylesheet")?.setAttribute("media", "all");

    const counters = document.querySelectorAll<HTMLElement>("[data-count]");
    const counterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const target = parseInt(el.getAttribute("data-count") ?? "0", 10);
          const start = performance.now();

          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / COUNTER_DURATION, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target).toLocaleString() + "+";
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          counterObserver.unobserve(el);
        }
      },
      { threshold: COUNTER_THRESHOLD },
    );
    counters.forEach((c) => counterObserver.observe(c));

    const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealEls.forEach((el) => el.classList.add("revealed"));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            const delay = el.style.getPropertyValue("--delay") || "0ms";
            setTimeout(() => el.classList.add("revealed"), parseInt(delay, 10) || 0);
            revealObserver.unobserve(el);
          }
        },
        { threshold: REVEAL_THRESHOLD },
      );
      revealEls.forEach((el) => revealObserver.observe(el));
    }

    const backToTop = document.getElementById("backToTop");
    const onScroll = () => backToTop?.classList.toggle("is-visible", window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    return () => {
      counterObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const show = useCallback((msg: string, type: "success" | "error" = "success") => {
    const toast = toastRef.current;
    const toastMsg = toastMsgRef.current;
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toastType.current = type;
    toast.className = `toast toast--${type} is-visible`;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }, []);

  useEffect(() => {
    if (onToastReady) onToastReady(show);
  }, [onToastReady, show]);

  const [toastClass, setToastClass] = useState("toast");

  return (
    <>
      <div className={toastClass} id="toast" role="alert" aria-live="polite" aria-atomic="true" ref={(n) => { toastRef.current = n; setToastClass(n?.className ?? "toast"); }}>
        <span className="toast__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="toast__msg" id="toastMsg" ref={toastMsgRef} />
      </div>

      <button className="back-to-top" id="backToTop" aria-label="Scroll back to top" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
