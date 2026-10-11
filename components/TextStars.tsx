import { starParts } from "@/lib/format";

/**
 * Port of renderStars() in my-courses.php / dashboard.php, which emits the ★ glyph in
 * spans rather than the SVG used by index.php and course.php. The student stylesheets
 * style `.star.filled` / `.star.half` / `.star.empty`, so the class names must differ
 * from components/Stars.tsx on purpose.
 */
export default function TextStars({ rating }: { rating: number }) {
  const { full, half, empty } = starParts(rating);
  return (
    <>
      {Array.from({ length: full }, (_, i) => (
        <span className="star filled" key={`f${i}`}>
          ★
        </span>
      ))}
      {Array.from({ length: half }, (_, i) => (
        <span className="star half" key={`h${i}`}>
          ★
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span className="star empty" key={`e${i}`}>
          ★
        </span>
      ))}
    </>
  );
}