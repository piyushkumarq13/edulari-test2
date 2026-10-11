import "@/styles/css/navbar.css";
import SiteNavbar from "@/components/SiteNavbar";
import SiteFooter from "@/components/SiteFooter";
import SiteBanners from "@/components/SiteBanners";

// Templates that include navbar.php (and therefore receive navbar.css and the
// `body { padding-top: 64px }` that navbar.css declares):
//   index.php, page/about.php, browse-courses.php, categories.php, course.php,
//   instructor-profile.php, contact.php, track-contact.php, help-center.php,
//   report-bug.php, track-report.php, security.php, updates.php,
//   cart.php, wishlist.php, checkout.php, student/purchase-history.php
//
// navbar.css is imported HERE rather than in app/layout.tsx because it must not be
// loaded by the templates that have no navbar (the auth pages and the receipt);
// loading it globally also applied its global `body { padding-top }` rule to them.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteBanners />
      <SiteNavbar />
      {children}
      <SiteFooter />
    </>
  );
}
