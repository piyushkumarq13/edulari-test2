import AdminMaintenanceBanner from "@/components/AdminMaintenanceBanner";
import { getMaintenanceState } from "@/lib/maintenance";

/**
 * Rails the admin pages the same way navbar.php railed the admin area in PHP: an
 * admin-maintenance banner sits directly under the fixed navbar when maintenance mode is on.
 * Auth/role enforcement stays per page (each page calls requireAdmin() itself), matching the
 * PHP, where navbar.php never gated access.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = await getMaintenanceState();
  return (
    <>
      <AdminMaintenanceBanner state={state} />
      {children}
    </>
  );
}
