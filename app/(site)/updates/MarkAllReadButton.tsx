"use client";

import { useRouter } from "next/navigation";

export default function MarkAllReadButton({ disabled, csrfToken }: { disabled: boolean; csrfToken: string }) {
  const router = useRouter();

  const onClick = async () => {
    const res = await fetch("/api/notifications/read-all", { method: "POST", headers: { "X-CSRF-Token": csrfToken } });
    if (res.ok) router.refresh();
  };

  return (
    <button className="upd-btn" id="updMarkAllBtn" type="button" disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Mark all read</span>
    </button>
  );
}
