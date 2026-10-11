import type { MetadataRoute } from "next";
import { sql } from "@/lib/db/client";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://edulari.example.com";

  let courses: Array<{ slug: string; updated_at: Date | null }> = [];
  let categories: Array<{ slug: string }> = [];
  try {
    courses = await sql<{ slug: string; updated_at: Date | null }[]>`SELECT slug, updated_at FROM courses WHERE is_published = true ORDER BY updated_at DESC`;
    categories = await sql<{ slug: string }[]>`SELECT slug FROM categories ORDER BY name`;
  } catch {
    courses = [];
    categories = [];
  }

  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/browse-courses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/help-center`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/verify-certificate`, changeFrequency: "monthly", priority: 0.3 },
  ];
  for (const c of categories) {
    routes.push({ url: `${base}/category/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const co of courses) {
    routes.push({ url: `${base}/course/${co.slug}`, lastModified: co.updated_at ?? undefined, changeFrequency: "weekly", priority: 0.8 });
  }
  return routes;
}
