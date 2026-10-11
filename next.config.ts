import type { NextConfig } from "next";
import { securityHeaders } from "@/lib/security/headers";

const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false,
  // The floating red "N" badge is Next.js's development tools indicator. It is dev-only
  // (it is never rendered by `next start` or a production build), but it sits on top of
  // the page while developing and overlaps the bottom-left of the layout, so switch it
  // off entirely. `false` disables the whole indicator, not just its position.
  devIndicators: false,
async redirects() {
    // Order matters and mirrors .htaccess + public/.htaccess: the specific rules come
    // first and the generic ".php" strip comes LAST. Next.js applies the first matching
    // redirect, so listing /:path*.php first would swallow /index.php (-> /index) and
    // /public/index.php (-> /public/index) before the rules below could ever run.
    return [
      // zya.me hosting appends ?i=1 - strip it from ANY path (root .htaccess rule 1
      // matches ^(.*)$, not just "/"). Redirecting to the same path drops the query.
      {
        source: "/:path*",
        has: [{ type: "query", key: "i", value: "1" }],
        destination: "/:path*",
        permanent: true,
      },
      // /index and /index.php -> / (root .htaccess rule 2).
      { source: "/index.php", destination: "/", permanent: true },
      { source: "/index", destination: "/", permanent: true },
      // /public/anything -> /anything (root .htaccess rule 4). The .php variants are
      // listed before the bare prefix so /public/about.php 301s straight to /about
      // instead of bouncing through /about.php.
      { source: "/public/index.php", destination: "/", permanent: true },
      { source: "/public/index", destination: "/", permanent: true },
      { source: "/public/:path*.php", destination: "/:path*", permanent: true },
      { source: "/public/:path*", destination: "/:path*", permanent: true },
      // Generic clean-URL strip (public/.htaccess rule 1). Must stay last.
      { source: "/:path*.php", destination: "/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/media", destination: "/api/media" },
      { source: "/ajax-image-upload.php", destination: "/api/upload/image" },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

