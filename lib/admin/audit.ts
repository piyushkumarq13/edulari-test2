import { logSecurity } from "@/lib/security/events";
import type { SessionUser } from "@/lib/auth/sessions";

/**
 * AGENTS.md §6/§13: every sensitive admin action must leave an audit trail. The PHP wrote some of
 * these to private/logs/security.log via logSecurity(); the rest (role changes, blocks, approvals,
 * deletions, settings writes) were previously unlogged. The port records all of them in
 * security_events with the acting admin so an action can never be anonymous.
 */
export async function auditAdmin(
  admin: SessionUser,
  action: string,
  context: Record<string, unknown> = {},
  req?: Request,
): Promise<void> {
  await logSecurity(action, { ...context, user_id: admin.id, admin_email: admin.email, actor: "admin" }, req);
}
