import { sql } from "@/lib/db/client";

export type Banner = {
  id: string;
  template: string;
  type: string;
  title: string;
  message: string;
  audience: string[] | unknown;
  cta: unknown;
  schedule: unknown;
  active: boolean;
  priority: number;
};

export async function getActiveBanners(role: string | null): Promise<Banner[]> {
  const rows = await sql<Banner[]>`
    SELECT id, template, type, title, message, audience, cta, schedule, active, priority
    FROM site_banners
    WHERE active = true
    ORDER BY priority DESC, created_at DESC
  `;
  // Filter by audience: array may contain "all" or the role, or be empty (treat as all).
  return rows.filter((b) => {
    const aud = Array.isArray(b.audience) ? (b.audience as string[]) : [];
    return aud.includes("all") || (role !== null && aud.includes(role)) || aud.length === 0;
  });
}
