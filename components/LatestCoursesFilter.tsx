"use client";

import { useCallback, useRef, useState } from "react";

type Level = "all" | "beginner" | "intermediate" | "advanced";

const LEVELS: Array<{ key: Level; label: string }> = [
  { key: "all", label: "All Levels" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

/**
 * Latest-courses level filter. Renders the PHP markup server-side and mirrors
 * the inline script from public/index.php: toggles card visibility by
 * data-level and shows #filterEmpty when nothing matches.
 */
export default function LatestCoursesFilter({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Level>("all");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const apply = useCallback((level: Level) => {
    setActive(level);
    const root = rootRef.current;
    if (!root) return;
    const cards = root.querySelectorAll<HTMLElement>("#latestGrid .course-card");
    let visible = 0;
    cards.forEach((card) => {
      const show = level === "all" || card.getAttribute("data-level") === level;
      card.style.display = show ? "" : "none";
      if (show) visible++;
    });
    const empty = root.querySelector<HTMLElement>("#filterEmpty");
    if (empty) empty.hidden = visible > 0;
  }, []);

  return (
    <div ref={rootRef}>
      <div className="filter-tabs" role="tablist" aria-label="Filter courses by level" data-reveal="fade-up">
        {LEVELS.map(({ key, label }) => (
          <button
            key={key}
            className={`filter-tab ${active === key ? "is-active" : ""}`}
            role="tab"
            aria-selected={active === key}
            data-level={key}
            aria-controls="latestGrid"
            type="button"
            onClick={() => apply(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
