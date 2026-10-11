import { sql } from "@/lib/db/client";
import { config } from "@/lib/config";
import { purgeStaleDraftDocs, purgeRejectedInstructorData } from "@/lib/db/instructor-registration";

/**
 * The PHP ran these two jobs lazily on every wizard page load, throttled by timestamp
 * files (.cleanup_last_run, .purge_last_run). The throttle state moves to cron_state and
 * the same jobs are also wired to Vercel Cron.
 *
 * Throttles (from the PHP): stale draft docs 30 minutes, rejected purge 5 hours.
 */

const DRAFT_DOCS_KEY = "instructor_draft_doc_cleanup";
const REJECTED_PURGE_KEY = "instructor_rejected_purge";

async function lastRun(key: string): Promise<number> {
  const rows = await sql<{ last_run: Date | null }[]>`SELECT last_run FROM cron_state WHERE key = ${key}`;
  return rows[0]?.last_run ? new Date(rows[0].last_run).getTime() : 0;
}

async function markRun(key: string): Promise<void> {
  await sql`
    INSERT INTO cron_state (key, last_run) VALUES (${key}, now())
    ON CONFLICT (key) DO UPDATE SET last_run = now()`;
}

/** Delete documents belonging to drafts / test_failed applications older than 15 days. */
export async function maybeCleanupStaleDraftDocs(force = false): Promise<number> {
  const intervalMs = config.DRAFT_DOC_CLEANUP_INTERVAL_SECS * 1000;
  if (!force && Date.now() - (await lastRun(DRAFT_DOCS_KEY)) < intervalMs) return 0;
  await markRun(DRAFT_DOCS_KEY);
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  return purgeStaleDraftDocs(cutoff);
}

/** Purge instructor data for rejected / test_failed users, converting them to students. */
export async function maybePurgeRejectedInstructorData(force = false): Promise<number> {
  const intervalMs = config.REJECTED_PURGE_INTERVAL_SECS * 1000;
  if (!force && Date.now() - (await lastRun(REJECTED_PURGE_KEY)) < intervalMs) return 0;
  await markRun(REJECTED_PURGE_KEY);
  return purgeRejectedInstructorData();
}

/** Run both lazily, exactly as _init.php did. Never throws into the request path. */
export async function runInstructorMaintenance(): Promise<void> {
  try {
    await maybeCleanupStaleDraftDocs();
  } catch {
    // throttled maintenance must never break the wizard
  }
  try {
    await maybePurgeRejectedInstructorData();
  } catch {
    // ditto
  }
}
