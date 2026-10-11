"use client";

import { useEffect, useRef, useState } from "react";

type Testimonial = {
  rating: number;
  review: string | null;
  student_name: string;
  course_title: string;
  course_slug: string;
  created_at: string;
};

const AUTO_MS = 5500;
const SWIPE_THRESHOLD = 50;

/** Port of the testimonials carousel inline script from public/index.php. */
export default function TestimonialsCarousel({ testimonials, renderStars }: { testimonials: Testimonial[]; renderStars: (rating: number) => React.ReactNode }) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStart = useRef(0);
  const count = testimonials.length;

  const goTo = (idx: number) => {
    setCurrent((idx + count) % count);
  };

  const startAuto = () => {
    stopAuto();
    timerRef.current = setInterval(() => setCurrent((prev) => (prev + 1) % count), AUTO_MS);
  };

  const stopAuto = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (count === 0) return;
    startAuto();
    return stopAuto;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count === 0) return null;

  const resetAuto = () => startAuto();

  return (
    <div
      className="testimonials-carousel"
      id="testimonialsCarousel"
      aria-roledescription="carousel"
      aria-label="Student testimonials"
      onMouseEnter={stopAuto}
      onMouseLeave={resetAuto}
      onFocus={stopAuto}
      onBlur={resetAuto}
    >
      <div
        className="testimonials-track"
        id="testimonialsTrack"
        ref={trackRef}
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const delta = touchStart.current - e.changedTouches[0].clientX;
          if (Math.abs(delta) > SWIPE_THRESHOLD) {
            goTo(current + (delta > 0 ? 1 : -1));
            resetAuto();
          }
        }}
      >
        {testimonials.map((t, i) => (
          <article
            key={i}
            className={`testimonial-card ${i === current ? "is-active" : ""}`}
            aria-roledescription="slide"
            aria-label={`Testimonial ${i + 1} of ${count}`}
          >
            <div className="testimonial-card__stars" aria-label={`Rating: ${t.rating} out of 5`}>
              {renderStars(t.rating)}
            </div>
            <blockquote className="testimonial-card__text">{t.review}</blockquote>
            <footer className="testimonial-card__footer">
              <div className="testimonial-card__avatar" aria-hidden="true">
                {(t.student_name || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="testimonial-card__author">
                <strong>{t.student_name}</strong>
                <span>
                  <a href={`/course/${t.course_slug}`}>{t.course_title}</a>
                </span>
              </div>
            </footer>
          </article>
        ))}
      </div>

      <div className="carousel-controls">
        <button className="carousel-btn carousel-btn--prev" id="carouselPrev" aria-label="Previous testimonial" type="button" onClick={() => { goTo(current - 1); resetAuto(); }}>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="carousel-dots" id="carouselDots" role="tablist" aria-label="Select testimonial">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`carousel-dot ${i === current ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Testimonial ${i + 1}`}
              onClick={() => { goTo(i); resetAuto(); }}
            />
          ))}
        </div>
        <button className="carousel-btn carousel-btn--next" id="carouselNext" aria-label="Next testimonial" type="button" onClick={() => { goTo(current + 1); resetAuto(); }}>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
