"use client";

import { useEffect, useRef } from "react";

/**
 * Port of the flash block in cart.php / wishlist.php.
 *
 * The message text arrives from the server as a signed httpOnly cookie, so this
 * component only renders and dismisses it. It fires the consume request on mount so
 * the message disappears on the next page load, exactly like the PHP
 * `unset($_SESSION['flash'])`.
 */
export default function FlashMessage({ msg, type, csrfToken }: { msg: string; type: "success" | "error" | "info"; csrfToken: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/flash/consume", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrfToken } }).catch(() => {});
    // A message delivered via ?flash=<key> is stripped from the URL after display so
    // a refresh does not show it again.
    if (window.location.search.includes("flash=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("flash");
      window.history.replaceState({}, "", url.toString());
    }
  }, [csrfToken]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => {
      el.style.opacity = "0";
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`flash flash--${type}`} id="flashMsg" role="alert" ref={ref}>
      <svg viewBox="0 0 24 24" fill="none">
        {type === "success" ? (
          <>
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span>{msg}</span>
      <button className="flash-close" aria-label="Dismiss" onClick={() => ref.current?.remove()}>
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
