"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WORDS = ["Open Doors", "Build Dreams", "Change Lives", "Unlock Potential"];
const TYPE_MS = 100;
const DELETE_MS = 60;
const HOLD_MS = 2000;
const NEXT_WORD_PAUSE_MS = 400;

/** Port of the hero typing animation from public/index.php. */
export default function HeroTyping() {
  const [text, setText] = useState(WORDS[0]);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let wIdx = 0;
    let cIdx = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const type = () => {
      const word = WORDS[wIdx];
      const current = deleting ? word.slice(0, cIdx - 1) : word.slice(0, cIdx + 1);
      setText(current);
      if (deleting) cIdx--;
      else cIdx++;

      let delay = TYPE_MS;
      if (deleting) delay = DELETE_MS;

      if (!deleting && cIdx === word.length) {
        timer = setTimeout(() => {
          deleting = true;
          timer = setTimeout(type, DELETE_MS);
        }, HOLD_MS);
        return;
      }

      if (deleting && cIdx === 0) {
        deleting = false;
        wIdx = (wIdx + 1) % WORDS.length;
        delay = NEXT_WORD_PAUSE_MS;
      }

      timer = setTimeout(type, delay);
    };

    const start = setTimeout(type, 1200);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, []);

  const onRef = useCallback((node: HTMLSpanElement | null) => {
    ref.current = node;
  }, []);

  return (
    <span className="hero__title-accent" id="typingText" aria-label="Open Doors" ref={onRef}>
      {text}
    </span>
  );
}
