"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  courseId: number;
  initiallyWishlisted: boolean;
  enabled: boolean;
  size?: 18 | 16;
};

const HEART_PATH = "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z";

export default function CourseWishlistButton({ courseId, initiallyWishlisted, enabled, size = 18 }: Props) {
  const [active, setActive] = useState(initiallyWishlisted);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  if (!enabled) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setActive(data.in_wishlist);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`course-card__wishlist ${active ? "is-active" : ""}`}
      data-course-id={courseId}
      aria-label={`${active ? "Remove from" : "Add to"} wishlist`}
      aria-pressed={active ? "true" : "false"}
      type="button"
      disabled={busy}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" width={size} height={size} aria-hidden="true">
        <path d={HEART_PATH} />
      </svg>
    </button>
  );
}
