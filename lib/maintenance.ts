import { sql } from "@/lib/db/client";

export type MaintenanceState = { student: boolean; instructor: boolean; autoDisableAt?: string | null };

export async function getMaintenanceState(): Promise<MaintenanceState> {
  try {
    const s = await sql<{ setting_value: string }[]>`SELECT setting_value FROM app_settings WHERE setting_key = 'maintenance_student'`;
    const i = await sql<{ setting_value: string }[]>`SELECT setting_value FROM app_settings WHERE setting_key = 'maintenance_instructor'`;
    const a = await sql<{ setting_value: string }[]>`SELECT setting_value FROM app_settings WHERE setting_key = 'maintenance_auto_disable_at'`;
    return {
      student: s.length > 0 && s[0].setting_value === "true",
      instructor: i.length > 0 && i[0].setting_value === "true",
      autoDisableAt: a.length > 0 ? a[0].setting_value : null,
    };
  } catch {
    return { student: false, instructor: false };
  }
}

export async function setMaintenanceState(student: boolean, instructor: boolean, autoDisableAt?: string | null): Promise<void> {
  const upsert = async (key: string, value: string) => {
    await sql`
      INSERT INTO app_settings (setting_key, setting_value) VALUES (${key}, ${value})
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
    `;
  };
  await upsert("maintenance_student", student ? "true" : "false");
  await upsert("maintenance_instructor", instructor ? "true" : "false");
  await upsert("maintenance_auto_disable_at", autoDisableAt ?? "");
  await sql`INSERT INTO maintenance_logs (event, context) VALUES ('set', ${JSON.stringify({ student, instructor, autoDisableAt })}::jsonb)`;
}

/** If maintenance had an auto-disable time that has passed, turn it off and log. */
export async function autoDisableMaintenance(): Promise<{ disabled: boolean; state: MaintenanceState }> {
  const state = await getMaintenanceState();
  if (state.autoDisableAt && state.autoDisableAt !== "" && new Date(state.autoDisableAt).getTime() <= Date.now()) {
    await setMaintenanceState(false, false, null);
    await sql`INSERT INTO maintenance_logs (event, context) VALUES ('auto_disabled', ${JSON.stringify({ previous: state })}::jsonb)`;
    return { disabled: true, state };
  }
  return { disabled: false, state };
}

/** Returns true if the given path requires the visitor to see the maintenance page. */
export function isPathInMaintenanceScope(pathname: string, state: MaintenanceState): boolean {
  if (pathname.startsWith("/student")) return state.student;
  if (pathname.startsWith("/instructor")) return state.instructor;
  // A global maintenance when both are on.
  return state.student && state.instructor && pathname === "/";
}
