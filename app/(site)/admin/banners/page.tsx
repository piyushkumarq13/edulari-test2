import type { Metadata } from "next";
import "@/styles/css/admin/banners.css";
import { pageMetadata } from "@/lib/seo/metadata";
import { requireAdmin } from "@/lib/auth/guards";
import { readCsrfToken } from "@/lib/security/csrf";
import { SITE_NAME } from "@/lib/site";
import { BANNER_TEMPLATES, getAllBanners } from "@/lib/db/admin/banners";
import BannersView from "@/components/admin/BannersView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: `Manage Banners — ${SITE_NAME} Admin`,
  description: "Create and manage sitewide announcement banners targeted at specific audiences.",
  noindex: true,
  canonical: false,
});

export default async function AdminBannersPage() {
  await requireAdmin();
  const [banners, csrfToken] = await Promise.all([getAllBanners(), readCsrfToken()]);
  return <BannersView banners={banners} csrfToken={csrfToken} templates={BANNER_TEMPLATES} />;
}
