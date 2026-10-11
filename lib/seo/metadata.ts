import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? "Edulari";

/** head.php default: SITE_URL . '/assets/images/og-cover.jpg' */
export const OG_IMAGE = `${SITE_URL}/assets/images/og-cover.jpg`;

export type PageMetaInput = {
  title: string;
  description: string;
  /** Clean path, e.g. "/course/slug". Omit to skip the canonical tag. */
  path?: string;
  /**
   * head.php emits `<link rel="canonical">` only when $pageCanonical is set,
   * but ALWAYS emits og:url (falling back to the request URI). Pass
   * `canonical: false` with a `path` to get og:url without the canonical tag.
   */
  canonical?: boolean;
  keywords?: string;
  noindex?: boolean;
  type?: "website" | "article" | "profile";
  /** Optional per-page image override; defaults to the head.php OG image. */
  image?: string;
};

/**
 * Builds the complete per-page metadata that public/partials/head.php emits.
 *
 * head.php always writes: description, keywords (optional), robots, canonical
 * (optional), og:title, og:description, og:image, og:url, og:type, and the full
 * Twitter card set. Next merges `metadata` shallowly per top-level key, so a
 * page that sets `openGraph` without `images` would drop the inherited image -
 * every page therefore builds the whole object through this helper.
 */
export function pageMetadata(input: PageMetaInput): Metadata {
  const { title, description, path, canonical = true, keywords, noindex = false, type = "website", image } = input;
  const url = path ? `${SITE_URL}${path}` : undefined;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    ...(path && canonical ? { alternates: { canonical: path } } : {}),
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: url ?? path,
      images: [{ url: image ?? OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image ?? OG_IMAGE],
    },
  };
}

/** Absolute URL for JSON-LD `item` values (PHP hardcoded SITE_URL in schema.org blocks). */
export function abs(path: string): string {
  return `${SITE_URL}${path}`;
}
