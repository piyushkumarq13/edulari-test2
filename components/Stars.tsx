import { STAR_PATH, starParts } from "@/lib/format";

let gradientSeq = 0;

function StarSvg({ kind, gradId }: { kind: "full" | "half" | "empty"; gradId?: string }) {
  if (kind === "half" && gradId) {
    return (
      <svg className="star star--half" viewBox="0 0 20 20" aria-hidden="true">
        <defs>
          <linearGradient id={gradId}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#e5e7eb" />
          </linearGradient>
        </defs>
        <path d={STAR_PATH} fill={`url(#${gradId})`} />
      </svg>
    );
  }
  return (
    <svg className={`star star--${kind}`} viewBox="0 0 20 20" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

/** Port of renderStars() from public/index.php. */
export default function Stars({ rating }: { rating: number }) {
  const { full, half, empty } = starParts(rating);
  const gradId = `hg_${++gradientSeq}`;
  return (
    <>
      {Array.from({ length: full }, (_, i) => <StarSvg key={`f${i}`} kind="full" />)}
      {half ? <StarSvg key="h" kind="half" gradId={gradId} /> : null}
      {Array.from({ length: empty }, (_, i) => <StarSvg key={`e${i}`} kind="empty" />)}
    </>
  );
}
