import crypto from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db/client";
import { config } from "@/lib/config";

/**
 * The instructor-registration wizard is anonymous (the visitor has no account yet) and the
 * PHP keeps all of its state in $_SESSION. Serverless has no PHP session store, so this
 * module backs that state with the instructor_reg_sessions table, keyed by a random token
 * in an httpOnly cookie. Only the session *pointers* move here — the wizard's draft content
 * still lives in instructor_applications / instructor_profiles exactly as the PHP does.
 */

const COOKIE = () => config.REG_SESSION_COOKIE_NAME;
const MAX_AGE_SECS = 60 * 60 * 24 * 7;

export interface RegSession {
  token: string;
  userId: number | null;
  step: number;
  awaitingEmailVerify: boolean;
  resumeUserId: number | null;
  resumeEmail: string;
  returnTo: number | null;
  appSubmitted: boolean;
  pendingEmail: string;
  testPassed: boolean;
  testScore: number | null;
}

function empty(token: string): RegSession {
  return {
    token,
    userId: null,
    step: 1,
    awaitingEmailVerify: false,
    resumeUserId: null,
    resumeEmail: "",
    returnTo: null,
    appSubmitted: false,
    pendingEmail: "",
    testPassed: false,
    testScore: null,
  };
}

async function readRow(token: string): Promise<RegSession | null> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT * FROM instructor_reg_sessions WHERE token = ${token}`;
  const r = rows[0];
  if (!r) return null;
  return {
    token,
    userId: r.user_id ? Number(r.user_id) : null,
    step: Number(r.step ?? 1),
    awaitingEmailVerify: Boolean(r.awaiting_email_verify),
    resumeUserId: r.resume_user_id ? Number(r.resume_user_id) : null,
    resumeEmail: (r.resume_email as string) || "",
    returnTo: r.return_to ? Number(r.return_to) : null,
    appSubmitted: Boolean(r.app_submitted),
    pendingEmail: (r.pending_email as string) || "",
    testPassed: Boolean(r.test_passed),
    testScore: r.test_score === null || r.test_score === undefined ? null : Number(r.test_score),
  };
}

export interface RegSessionResult {
  session: RegSession;
  /** True when a brand-new row was created and the caller must set the cookie. */
  isNew: boolean;
}

/** Read the wizard session, creating a row (and needing the cookie set) on first visit. */
export async function getRegSession(): Promise<RegSessionResult> {
  const jar = await cookies();
  const existing = jar.get(COOKIE())?.value ?? "";
  if (existing) {
    const row = await readRow(existing);
    if (row) return { session: row, isNew: false };
  }

  const token = crypto.randomBytes(32).toString("hex");
  await sql`
    INSERT INTO instructor_reg_sessions (token) VALUES (${token})
    ON CONFLICT (token) DO NOTHING`;

  const created = await readRow(token);
  return { session: created ?? empty(token), isNew: true };
}

export function regSessionCookieOptions(token: string) {
  return {
    name: COOKIE(),
    value: token,
    options: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: MAX_AGE_SECS,
    },
  };
}

export async function saveRegSession(patch: Partial<RegSession>): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE())?.value ?? "";
  if (!token) return;

  const sets: string[] = [];
  const vals: Array<string | number | boolean | null> = [];
  const add = (col: string, v: string | number | boolean | null) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };

  if (patch.userId !== undefined) add("user_id", patch.userId);
  if (patch.step !== undefined) add("step", patch.step);
  if (patch.awaitingEmailVerify !== undefined) add("awaiting_email_verify", patch.awaitingEmailVerify);
  if (patch.resumeUserId !== undefined) add("resume_user_id", patch.resumeUserId);
  if (patch.resumeEmail !== undefined) add("resume_email", patch.resumeEmail);
  if (patch.returnTo !== undefined) add("return_to", patch.returnTo);
  if (patch.appSubmitted !== undefined) add("app_submitted", patch.appSubmitted);
  if (patch.pendingEmail !== undefined) add("pending_email", patch.pendingEmail);
  if (patch.testPassed !== undefined) add("test_passed", patch.testPassed);
  if (patch.testScore !== undefined) add("test_score", patch.testScore);

  if (!sets.length) return;
  vals.push(token);
  await sql.unsafe(`UPDATE instructor_reg_sessions SET ${sets.join(", ")} WHERE token = $${vals.length}`, vals);
}

/** Delete the wizard session row (used once the application is submitted). */
export async function destroyRegSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE())?.value ?? "";
  if (token) await sql`DELETE FROM instructor_reg_sessions WHERE token = ${token}`;
}