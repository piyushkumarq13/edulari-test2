import SiteFooter from "@/components/SiteFooter";

// The only template with a footer but no navbar: verify-certificate.php renders
// footer.php but never includes navbar.php, and it draws its own in-page nav
// (.vc-nav in verify-certificate.css). navbar.css is therefore NOT imported here.
export default function FooterOnlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
