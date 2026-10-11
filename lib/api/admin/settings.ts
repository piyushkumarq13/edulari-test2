import { z } from "zod";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import v8 from "node:v8";
import nodemailer from "nodemailer";
import { sql, logDbError } from "@/lib/db/client";
import { getAdminSettings, saveSettingsValues, getDbHealth, getDbVersion } from "@/lib/db/admin/settings";
import { getMaintenanceState, setMaintenanceState } from "@/lib/maintenance";
import { verifyPassword } from "@/lib/auth/passwords";
import { regenerateSessionOnPasswordChange, type SessionUser } from "@/lib/auth/sessions";
import { getClientIp } from "@/lib/security/client-ip";
import { getDeviceInfoFromHeaders } from "@/lib/auth/device";
import { sendPasswordChangedNotificationEmail } from "@/lib/email/settings-senders";
import { auditAdmin } from "@/lib/admin/audit";
import { APP_TIMEZONE } from "@/lib/format";

/**
 * Action handlers for public/admin/settings.php (the POST/AJAX branch, lines 18-358).
 *
 * All 10 actions are ported with identical validation order, messages and side effects. The one
 * deliberate difference (AGENTS.md §4/§9): secret values can no longer be written to disk, so the
 * SMTP / OpenRouter / NVIDIA / Razorpay secrets are read from the environment and never persisted.
 * A submitted secret returns a clear "set the env var instead" message while the non-secret parts
 * of the form are still saved.
 */

const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"] as const;

/** Mirrors `$fieldLimits` in saveSettings() (private/functions/admin.php:919). */
export const FIELD_LIMITS: Array<[string, number]> = [
  ["site_name", 100],
  ["site_url", 255],
  ["admin_email", 254],
  ["smtp_host", 253],
  ["smtp_user", 254],
  ["smtp_pass", 500],
  ["timezone", 60],
  ["currency_code", 10],
];

export type SettingsActionResult = { body: Record<string, unknown>; cookieToken?: string };

const htmlspecialchars = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const json = (body: Record<string, unknown>): SettingsActionResult => ({ body });

/** PHP `filter_var($v, FILTER_VALIDATE_URL)`. */
function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return Boolean(u.protocol) && Boolean(u.host);
  } catch {
    return false;
  }
}

/** PHP `filter_var($v, FILTER_VALIDATE_EMAIL)` (zod's email check is equivalent in practice). */
function isValidEmail(value: string): boolean {
  return z.string().email().safeParse(value).success;
}

/** saveSettings(): length check first, then newline check, per field in map order. */
export function checkFieldLimits(data: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [field, max] of FIELD_LIMITS) {
    const value = data[field];
    if (value === undefined) continue;
    if (value.length > max) {
      errors.push(`Value for '${field}' exceeds the maximum allowed length of ${max} characters.`);
    }
    if (/[\r\n]/.test(value)) {
      errors.push(`Value for '${field}' must not contain newline characters.`);
    }
  }
  return errors;
}

/** Timezone identifiers, equivalent to PHP DateTimeZone::listIdentifiers() (UTC always present). */
function listTimezones(): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = ["UTC"];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  return zones;
}

function phpNotEmpty(value: string | undefined): boolean {
  return Boolean(value) && value !== "0";
}

function fsize(bytes: number): string {
  return `${Math.round((bytes / 1073741824) * 100) / 100} GB`;
}

function serverTimeString(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
}

// ── Per-action zod schemas (shape validation; business rules below keep PHP's exact messages) ──
const generalSchema = z.object({
  site_name: z.string().catch(""),
  site_url: z.string().catch(""),
  admin_email: z.string().catch(""),
  timezone: z.string().catch("UTC"),
  currency_code: z.string().catch("INR"),
});
const smtpSchema = z.object({
  smtp_host: z.string().catch(""),
  smtp_port: z.string().catch("587"),
  smtp_username: z.string().catch(""),
  smtp_password: z.string().catch(""),
  test_email: z.string().catch(""),
});
const securitySchema = z.object({
  hash_cost: z.string().catch("12"),
  session_lifetime: z.string().catch("86400"),
});
const apiSchema = z.object({
  openrouter_api_key: z.string().catch(""),
  nvidia_api_key: z.string().catch(""),
  razorpay_key_id: z.string().catch(""),
  razorpay_key_secret: z.string().catch(""),
  active_ai_provider: z.string().catch("openrouter"),
});
const passwordSchema = z.object({
  current_password: z.string().catch(""),
  new_password: z.string().catch(""),
  confirm_password: z.string().catch(""),
});
const maintenanceSchema = z.object({
  student: z.string().catch(""),
  instructor: z.string().catch(""),
  auto_disable_minutes: z.string().optional(),
});

// ── Handlers ────────────────────────────────────────────────────────────────────────────────────
async function updateGeneral(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = generalSchema.parse(fields);
  const siteName = f.site_name.trim();
  const siteUrl = f.site_url.trim();
  const adminEmail = f.admin_email.trim();
  const timezone = f.timezone.trim() || "UTC";
  const currencyCode = f.currency_code.trim().toUpperCase();

  const errors: string[] = [];
  if (siteName === "") errors.push("Site name is required.");
  if (!isValidUrl(siteUrl)) errors.push("Invalid site URL.");
  if (!isValidEmail(adminEmail)) errors.push("Invalid admin e-mail.");
  if (!listTimezones().includes(timezone)) errors.push("Invalid timezone.");
  if (!(ALLOWED_CURRENCIES as readonly string[]).includes(currencyCode)) errors.push("Invalid currency selected.");
  if (errors.length > 0) return json({ success: false, message: errors.join(" ") });

  const saveErrors = checkFieldLimits({
    site_name: siteName,
    site_url: siteUrl,
    admin_email: adminEmail,
    timezone,
    currency_code: currencyCode,
  });
  if (saveErrors.length > 0) return json({ success: false, message: saveErrors.join(" ") });

  await saveSettingsValues({ site_name: siteName, site_url: siteUrl, admin_email: adminEmail, timezone, currency_code: currencyCode });
  await auditAdmin(user, "admin.settings.update_general", { site_name: siteName }, req);
  return json({ success: true, message: "General settings saved successfully." });
}

async function updateSmtp(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = smtpSchema.parse(fields);
  const smtpHost = f.smtp_host.trim();
  const smtpPort = Number.parseInt(f.smtp_port, 10) || 0;
  const smtpUser = f.smtp_username.trim();
  const smtpPassword = f.smtp_password.trim();

  const errors: string[] = [];
  if (smtpHost === "") errors.push("SMTP host is required.");
  if (smtpPort < 1 || smtpPort > 65535) errors.push("SMTP port must be 1–65535.");
  if (smtpUser === "") errors.push("SMTP username is required.");
  if (errors.length > 0) return json({ success: false, message: errors.join(" ") });

  const saveErrors = checkFieldLimits({ smtp_host: smtpHost, smtp_user: smtpUser, smtp_pass: smtpPassword });
  if (saveErrors.length > 0) return json({ success: false, message: saveErrors.join(" ") });

  await saveSettingsValues({ smtp_host: smtpHost, smtp_port: smtpPort, smtp_user: smtpUser });
  await auditAdmin(user, "admin.settings.update_smtp", { smtp_host: smtpHost, smtp_port: smtpPort }, req);

  // The password is a runtime secret: it must be set in the environment, never in app_settings.
  if (smtpPassword !== "") {
    return json({
      success: false,
      message:
        "SMTP host, port and username were saved, but the SMTP password cannot be changed from this page. Set the SMTP_PASSWORD environment variable instead.",
    });
  }
  return json({ success: true, message: "SMTP settings saved successfully." });
}

async function updateSecurity(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = securitySchema.parse(fields);
  const hashCost = Number.parseInt(f.hash_cost, 10) || 0;
  const sessionLifetime = Number.parseInt(f.session_lifetime, 10) || 0;

  const errors: string[] = [];
  if (hashCost < 4 || hashCost > 31) errors.push("Hash cost must be 4–31.");
  if (sessionLifetime < 900) errors.push("Session lifetime must be at least 900 seconds.");
  if (errors.length > 0) return json({ success: false, message: errors.join(" ") });

  await saveSettingsValues({ hash_cost: hashCost, session_lifetime: sessionLifetime });
  await auditAdmin(user, "admin.settings.update_security", { hash_cost: hashCost, session_lifetime: sessionLifetime }, req);
  return json({ success: true, message: "Security settings saved successfully." });
}

async function updateApi(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = apiSchema.parse(fields);
  const openrouterKey = f.openrouter_api_key.trim();
  const nvidiaKey = f.nvidia_api_key.trim();
  const razorpayId = f.razorpay_key_id.trim();
  const razorpaySecret = f.razorpay_key_secret.trim();
  let activeProvider = f.active_ai_provider.trim();

  if (activeProvider !== "openrouter" && activeProvider !== "nvidia_kimi") activeProvider = "openrouter";

  await saveSettingsValues({ active_ai_provider: activeProvider });
  if (razorpayId !== "") await saveSettingsValues({ razorpay_key_id: razorpayId });
  await auditAdmin(user, "admin.settings.update_api", { active_ai_provider: activeProvider }, req);

  if (openrouterKey !== "" || nvidiaKey !== "" || razorpaySecret !== "") {
    return json({
      success: false,
      message:
        "Active AI provider and Razorpay Key ID were saved, but the API secrets cannot be changed from this page. Set OPENROUTER_API_KEY, NVIDIA_KIMI_API_KEY and RAZORPAY_KEY_SECRET in the environment instead.",
    });
  }
  return json({ success: true, message: "API keys saved successfully." });
}

async function testSmtp(fields: Record<string, string>): Promise<SettingsActionResult> {
  const f = smtpSchema.parse(fields);
  const settings = await getAdminSettings();

  const smtpHost = f.smtp_host.trim() || process.env.SMTP_HOST || "";
  const smtpPort = Number.parseInt(f.smtp_port, 10) || Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = f.smtp_username.trim() || process.env.SMTP_USERNAME || process.env.SMTP_USER || "";
  const smtpPass = f.smtp_password.trim() || process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
  const toEmail = f.test_email.trim();

  if (!isValidEmail(toEmail)) return json({ success: false, message: "Invalid test e-mail address." });

  try {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transport.sendMail({
      from: `"${settings.siteName} Admin" <${smtpUser}>`,
      to: toEmail,
      subject: `[${settings.siteName}] SMTP Test`,
      text: `SMTP configuration test from ${settings.siteName} admin panel. If you received this, SMTP is working correctly.`,
    });
    return json({ success: true, message: `Test e-mail sent to ${htmlspecialchars(toEmail)}.` });
  } catch (e) {
    return json({ success: false, message: `SMTP error: ${e instanceof Error ? e.message : String(e)}` });
  }
}

async function clearCache(user: SessionUser, req: Request): Promise<SettingsActionResult> {
  // The PHP cleared PHP session files in sys_get_temp_dir(). Sessions now live in Postgres
  // (AGENTS.md §9: no local disk), so there is nothing to delete on the server.
  await auditAdmin(user, "admin.settings.clear_cache", { removed: 0 }, req);
  return json({ success: true, message: "Cache cleared. Removed 0 session file(s)." });
}

async function dbHealth(): Promise<SettingsActionResult> {
  const { allOk, tables } = await getDbHealth();
  return json({
    success: allOk,
    message: allOk ? `All ${tables.length} tables are healthy.` : "One or more tables returned errors.",
    tables: tables.map((t) => ({
      table: t.table,
      count: t.count,
      size_kb: t.size_kb ?? "N/A",
      status: t.status,
    })),
  });
}

async function changePassword(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = passwordSchema.parse(fields);
  const currentPw = f.current_password;
  const newPw = f.new_password;
  const confirmPw = f.confirm_password;

  if (newPw !== confirmPw) return json({ success: false, message: "New passwords do not match." });
  if (newPw.length < 8) return json({ success: false, message: "New password must be at least 8 characters." });

  const rows = await sql<{ password: string | null }[]>`SELECT password FROM users WHERE id = ${user.id}`;
  if (rows.length === 0 || !verifyPassword(currentPw, rows[0].password)) {
    return json({ success: false, message: "Current password is incorrect." });
  }

  const settings = await getAdminSettings();
  const cost = Number.parseInt(settings.hashCost, 10) || 12;
  const hash = bcrypt.hashSync(newPw, cost);

  try {
    await sql`UPDATE users SET password = ${hash}, password_changed_at = now() WHERE id = ${user.id}`;
    const ip = getClientIp(req.headers);
    const deviceInfo = getDeviceInfoFromHeaders(req.headers);
    const token = await regenerateSessionOnPasswordChange(user.id, ip, deviceInfo);
    await sendPasswordChangedNotificationEmail(user.email, user.name, ip, deviceInfo);
    await auditAdmin(user, "admin.settings.change_password", {}, req);
    return {
      body: { success: true, message: "Password changed successfully. All other devices have been logged out." },
      cookieToken: token,
    };
  } catch (e) {
    logDbError("admin.settings.change_password", e);
    return json({ success: false, message: "Database error while updating password." });
  }
}

async function systemInfo(): Promise<SettingsActionResult> {
  let dbVersion = "N/A";
  try {
    dbVersion = await getDbVersion();
  } catch {
    dbVersion = "N/A";
  }

  let memoryLimit = "N/A";
  try {
    memoryLimit = `${Math.round(v8.getHeapStatistics().heap_size_limit / 1048576)} MB`;
  } catch {
    memoryLimit = "N/A";
  }

  let diskFree = "N/A";
  let diskTotal = "N/A";
  try {
    const root = process.platform === "win32" ? `${process.env.SystemDrive ?? "C:"}\\` : "/";
    const st = fs.statfsSync(root);
    diskFree = fsize(Number(st.bavail) * Number(st.bsize));
    diskTotal = fsize(Number(st.blocks) * Number(st.bsize));
  } catch {
    diskFree = "N/A";
    diskTotal = "N/A";
  }

  return json({
    success: true,
    data: {
      php_version: process.version,
      server_software: `node ${process.version}`,
      os: `${process.platform} ${process.arch}`,
      memory_limit: memoryLimit,
      upload_max: "4.5 MB",
      post_max: "4.5 MB",
      max_exec_time: "30s",
      db_version: dbVersion,
      disk_free: diskFree,
      disk_total: diskTotal,
      server_time: serverTimeString(),
    },
  });
}

async function toggleMaintenance(fields: Record<string, string>, user: SessionUser, req: Request): Promise<SettingsActionResult> {
  const f = maintenanceSchema.parse(fields);
  const student = phpNotEmpty(f.student);
  const instructor = phpNotEmpty(f.instructor);
  const autoMins = f.auto_disable_minutes !== undefined ? Number.parseInt(f.auto_disable_minutes, 10) || 0 : 0;

  if (!student && !instructor) {
    await setMaintenanceState(false, false, null);
    await auditAdmin(user, "admin.settings.toggle_maintenance", { maintenance: false }, req);
    return json({
      success: true,
      message: "Maintenance mode disabled.",
      maintenance: false,
      student: false,
      instructor: false,
      auto_disable_at: null,
    });
  }

  const prior = await getMaintenanceState();
  const wasOn = Boolean(prior.student || prior.instructor);
  const autoDisableAt = autoMins > 0 ? new Date(Date.now() + autoMins * 60000).toISOString() : null;

  await setMaintenanceState(student, instructor, autoDisableAt);
  await auditAdmin(user, "admin.settings.toggle_maintenance", { maintenance: true, student, instructor, auto_disable_at: autoDisableAt }, req);

  return json({
    success: true,
    message: `Maintenance mode ${wasOn ? "updated" : "enabled"}.`,
    maintenance: true,
    student,
    instructor,
    auto_disable_at: autoDisableAt,
  });
}

export async function handleSettingsAction(
  action: string,
  fields: Record<string, string>,
  user: SessionUser,
  req: Request,
): Promise<SettingsActionResult> {
  switch (action) {
    case "update_general":
      return updateGeneral(fields, user, req);
    case "update_smtp":
      return updateSmtp(fields, user, req);
    case "update_security":
      return updateSecurity(fields, user, req);
    case "update_api":
      return updateApi(fields, user, req);
    case "test_smtp":
      return testSmtp(fields);
    case "clear_cache":
      return clearCache(user, req);
    case "db_health":
      return dbHealth();
    case "change_password":
      return changePassword(fields, user, req);
    case "system_info":
      return systemInfo();
    case "toggle_maintenance":
      return toggleMaintenance(fields, user, req);
    default:
      return json({ success: false, message: "Unknown action." });
  }
}
