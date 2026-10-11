import { z } from "zod";
import { auditAdmin } from "@/lib/admin/audit";
import { hashPassword } from "@/lib/auth/passwords";
import { issuePasswordResetToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email/senders";
import type { SessionUser } from "@/lib/auth/sessions";
import {
  blockUser,
  changeUserRole,
  createUser,
  deleteUser,
  emailExists,
  getUserActiveStatus,
  getUserBasic,
  isValidRole,
  toggleUserStatus,
  unblockUser,
} from "@/lib/db/admin/users";

export type ActionResult = { ok: boolean; error?: string; redirect?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ucfirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Post/Redirect/Get target for the list page. */
function listRedirect(message: string): string {
  return `/admin/users?msg=${encodeURIComponent(message)}`;
}

const addUserSchema = z.object({
  new_name: z.string().trim().min(1, "Name, email, and password are required."),
  new_email: z.string().trim().min(1, "Name, email, and password are required."),
  new_password: z.string().min(1, "Name, email, and password are required."),
  new_user_role: z.string().default("student"),
});

/** Port of the `add_user` branch in admin/users.php. */
export async function addUserAction(
  fields: Record<string, string>,
  admin: SessionUser,
  req: Request,
): Promise<ActionResult> {
  const parsed = addUserSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Name, email, and password are required." };
  }
  const { new_name: name, new_email: email, new_password: password, new_user_role: role } = parsed.data;

  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please provide a valid email address." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!isValidRole(role)) return { ok: false, error: "Invalid role selected." };
  if (await emailExists(email)) return { ok: false, error: "A user with that email address already exists." };

  const isActive = fields.new_is_active !== undefined;
  const newUserId = await createUser({ name, email, passwordHash: hashPassword(password), role, isActive });
  if (!newUserId) return { ok: false, error: "Failed to create user. Please try again." };

  await auditAdmin(admin, "admin.user.create", { target_user_id: newUserId, role }, req);
  const message = `User ${name} created successfully as ${ucfirst(role)}.`;
  return { ok: true, message, redirect: listRedirect(message) };
}

/** Port of the `bulk_action` branch in admin/users.php. */
export async function bulkActionAction(
  form: FormData,
  admin: SessionUser,
  req: Request,
): Promise<ActionResult> {
  const bulkAction = String(form.get("bulk_action") ?? "");
  const ids = form
    .getAll("bulk_ids")
    .map((v) => Number(v))
    .filter((id) => Number.isInteger(id) && id > 0 && id !== admin.id);

  let count = 0;
  for (const bid of ids) {
    if (bulkAction === "activate") {
      if (await toggleUserStatus(bid, true)) count++;
    } else if (bulkAction === "deactivate") {
      if (await toggleUserStatus(bid, false)) count++;
    } else if (bulkAction === "delete") {
      if (await deleteUser(bid)) count++;
    } else if (bulkAction === "block") {
      if (await blockUser(bid, "Bulk admin action")) count++;
    }
  }

  if (count > 0) {
    await auditAdmin(admin, "admin.user.bulk", { bulk_action: bulkAction, count }, req);
    const message = `Bulk action applied to ${count} user(s).`;
    return { ok: true, message, redirect: listRedirect(message) };
  }
  return { ok: false, error: "No users were affected. You cannot modify your own account via bulk actions." };
}

/** Admin-triggered reset — token + email + audit. Returns true or an error string. */
async function adminTriggerPasswordReset(userId: number, admin: SessionUser): Promise<true | string> {
  const user = await getUserBasic(userId);
  if (!user) return "User not found.";

  const token = await issuePasswordResetToken(userId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendPasswordResetEmail(user.email, user.name, resetUrl, true);
  if (!sent.ok) return "Failed to send reset email. Please try again.";

  await auditAdmin(admin, "admin.user.reset_password", { target_user_id: userId });
  return true;
}

/** Port of the AJAX action switch in admin/user-detail.php. */
export async function userActionAction(
  fields: Record<string, string>,
  admin: SessionUser,
  req: Request,
): Promise<ActionResult> {
  const targetId = Number(fields.user_id ?? 0);
  const action = fields.action ?? "";

  switch (action) {
    case "toggle_status": {
      const current = await getUserActiveStatus(targetId);
      if (current === null) return { ok: false, error: "Failed to update status." };
      const newStatus = !current;
      if (!(await toggleUserStatus(targetId, newStatus))) return { ok: false, error: "Failed to update status." };
      await auditAdmin(admin, "admin.user.toggle_status", { target_user_id: targetId, active: newStatus }, req);
      return {
        ok: true,
        message: newStatus ? "User activated successfully." : "User deactivated successfully.",
        redirect: listRedirect("User status updated successfully."),
      };
    }
    case "block_user": {
      const note = (fields.block_note ?? "").trim();
      if (!(await blockUser(targetId, note))) {
        return { ok: false, error: "Failed to block user. Admins cannot be blocked." };
      }
      await auditAdmin(admin, "admin.user.block", { target_user_id: targetId }, req);
      return { ok: true, message: "User has been blocked.", redirect: listRedirect("User has been blocked.") };
    }
    case "unblock_user": {
      if (!(await unblockUser(targetId))) return { ok: false, error: "Failed to unblock user." };
      await auditAdmin(admin, "admin.user.unblock", { target_user_id: targetId }, req);
      return {
        ok: true,
        message: "User has been unblocked.",
        redirect: listRedirect("User has been unblocked and can log in again."),
      };
    }
    case "change_role": {
      const newRole = (fields.new_role ?? "").trim();
      if (!(await changeUserRole(targetId, newRole))) return { ok: false, error: "Failed to update role." };
      await auditAdmin(admin, "admin.user.change_role", { target_user_id: targetId, new_role: newRole }, req);
      return {
        ok: true,
        message: `Role updated to ${ucfirst(newRole)}.`,
        redirect: listRedirect(`User role updated to ${ucfirst(newRole)}.`),
      };
    }
    case "reset_password": {
      const result = await adminTriggerPasswordReset(targetId, admin);
      if (result !== true) return { ok: false, error: result };
      return {
        ok: true,
        message: "Password reset email sent to the user.",
        redirect: listRedirect("Password reset email sent to the user."),
      };
    }
    case "delete_user": {
      if (targetId === admin.id) return { ok: false, error: "You cannot delete your own account." };
      if (!(await deleteUser(targetId))) return { ok: false, error: "Failed to delete user." };
      await auditAdmin(admin, "admin.user.delete", { target_user_id: targetId }, req);
      return { ok: true, message: "User deleted successfully.", redirect: listRedirect("User deleted successfully.") };
    }
    default:
      return { ok: false, error: "Unknown action." };
  }
}
