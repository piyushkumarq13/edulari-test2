import { sql } from "@/lib/db/client";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await sql<{ setting_value: string }[]>`SELECT setting_value FROM app_settings WHERE setting_key = ${key}`;
  return rows.length ? rows[0].setting_value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (setting_key, setting_value) VALUES (${key}, ${value})
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
  `;
}
