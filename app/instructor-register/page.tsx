import { redirect } from "next/navigation";
import { getRegSession } from "@/lib/instructor/reg-session";
import { runInstructorMaintenance } from "@/lib/instructor/maintenance";
import { getSessionUser } from "@/lib/auth/guards";
import { redirectBasedOnRole } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

/**
 * /instructor-register entry point. Mirrors public/instructor-register/index.php: a pure
 * redirect dispatcher — logged-in users go to their dashboard, everyone else is sent to
 * their current step (clamped to 1-7).
 */
export default async function InstructorRegisterIndex() {
  const existing = await getSessionUser();
  if (existing) {
    redirectBasedOnRole(existing.role);
  }

  await runInstructorMaintenance();

  const { session, isNew } = await getRegSession();
  if (isNew) {
    redirect(`/api/reg-session?next=${encodeURIComponent("/instructor-register")}`);
  }

  const step = Math.min(Math.max(session.step, 1), 7);
  redirect(`/instructor-register/step-${step}`);
}
