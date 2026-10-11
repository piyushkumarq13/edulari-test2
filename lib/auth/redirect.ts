import { redirect } from "next/navigation";

/**
 * Send a logged-in user to the dashboard their role belongs in. Mirrors
 * redirectBasedOnRole() in private/auth.php: admin -> /admin/dashboard,
 * instructor -> /instructor/dashboard, everything else -> /.
 */
export function redirectBasedOnRole(role: string): never {
  if (role === "admin") redirect("/admin/dashboard");
  if (role === "instructor") redirect("/instructor/dashboard");
  redirect("/");
}
