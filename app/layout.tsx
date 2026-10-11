import type { Metadata, Viewport } from "next";
import "@/styles/css/base.css";

// public/partials/head.php emits the Inter webfont as a non-blocking stylesheet
// (media="print" + inline onload swap) with a <noscript> fallback. Reproducing it
// verbatim matters for parity twice over:
//
//  1. The swap must not need JavaScript, so it is emitted as raw markup in <head>
//     rather than as a React onLoad handler (which would only attach after hydration).
//  2. base.css declares --font-primary in :root, so the variable must NOT be
//     overridden. The previous next/font Inter used variable: "--font-primary", which
//     replaced that :root value with a self-hosted stack and changed the computed
//     font-family on every element.
const FONT_INTER = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap";

const HEAD_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="preload" as="style" href="${FONT_INTER}">`,
  `<link rel="stylesheet" href="${FONT_INTER}" media="print" onload="this.media='all'">`,
  `<noscript><link rel="stylesheet" href="${FONT_INTER}"></noscript>`,
].join("\n");

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const OG_IMAGE = `${SITE_URL}/assets/images/og-cover.jpg`;

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: "Edulari",
  description: "Edulari - e-learning platform",
  manifest: "/assets/images/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/assets/images/favicon/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/assets/images/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/images/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/images/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/assets/images/favicon/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "Edulari",
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

// head.php has no theme-color meta, so none is emitted here.
// head.php uses `initial-scale=1.0`; Next normalises this to `initial-scale=1`,
// which parses identically.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Site chrome (banners / navbar / footer) is deliberately NOT rendered here.
// navbar.php is only included by the templates that use it, and it emits navbar.css
// from inside <body>. Routing that per-template is done with route-group layouts:
//   app/(site)/layout.tsx  -> banners + navbar + navbar.css + footer  (17 templates)
//   app/(foot)/layout.tsx  -> footer only                            (verify-certificate)
//   everything else        -> no chrome, matching the bare templates
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head dangerouslySetInnerHTML={{ __html: HEAD_LINKS }} />
      <body>{children}</body>
    </html>
  );
}
