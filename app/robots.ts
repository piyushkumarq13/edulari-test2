import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://edulari-test.vercel.app";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/instructor", "/student", "/api"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
