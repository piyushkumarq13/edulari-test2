# db-mapping.md — MySQL → Postgres mapping (Phase 2)

## Type mapping rules applied
- `int(11)` / `int(10) unsigned` AUTO_INCREMENT → `bigint GENERATED ALWAYS AS IDENTITY` (kept as bigint for headroom; bigint is safest for identity PKs coming from `AUTO_INCREMENT=n`).
- `bigint(20) unsigned` AUTO_INCREMENT → `bigint GENERATED ALWAYS AS IDENTITY`.
- `tinyint(1)` 0/1 flags → `boolean` (e.g. `is_active`, `is_blocked`, `is_active`, `is_published`, `is_featured`, `certificate_enabled`, `is_free_preview`, `passed`, `is_read`, `used`, `is_done`, `email_verified`, `is_recovery_mode`, `profile_completed`, `revenue_share_ack`, `terms_agreed`, `content_policy`).
- `tinyint(3) unsigned` used as small counts/steps (`test_score`, `last_completed_step`, `reg_step`, `profile_years_exp`, `severity`, `enrolled_count`, `attempt_count`) → `smallint`.
- `enum(...)` → `text NOT NULL` + `CHECK (col IN (...))` where the original was NOT NULL, else `text` + `CHECK` (nullable). Same default preserved.
- `datetime` / `timestamp [NULL] DEFAULT current_timestamp()` → `timestamptz`; `ON UPDATE current_timestamp()` → `set_updated_at()` BEFORE UPDATE trigger.
- `date` → `date`; `time` → `time`; `smallint(6)` → `smallint`; `year(4)` → `smallint`.
- `decimal(p,s)` → `numeric(p,s)` with identical precision.
- `longtext`/`mediumtext`/`text` → `text`. Columns constrained `json_valid(...)` (`versions`, `questions_data`, `answers_data`, `test_data`) → `jsonb`.
- `varchar(n)` → `varchar(n)`.
- `KEY`/`UNIQUE KEY` → `CREATE INDEX` / `UNIQUE` constraints (same columns, names preserved where practical). FKs added for all logical references (MyISAM had none) with `ON DELETE CASCADE` for owned rows and `ON DELETE SET NULL` for optional references.

## RLS / privileges (applied to every table)
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every table.
- `REVOKE ALL ON <table> FROM anon, authenticated` on every table.
- No RLS policies are defined; only the server-side pooler/postgres user connects (`postgres.js`, no Supabase client SDK).

## New tables (not in MySQL schema)
| Table | Replaces / purpose |
|---|---|
| site_banners | `private/data/banners.json` (file-backed banner store) |
| cron_state | `.cleanup_last_run` / `.token_cleanup_last_run` / `.purge_last_run` marker files |
| maintenance_logs | `private/logs/maintenance.log` |
| security_events | `private/logs/security.log` (+ console on Vercel) |
| schema_migrations | migration bookkeeping |

## Encryption-at-rest columns (AES-256-GCM via DATA_ENCRYPTION_KEY, decrypt in admin/instructor views only)
`instructor_applications.pan_number`, `bank_account`, `ifsc_code`, `account_holder`, `upi_id` — stored as `text` (ciphertext).

## Old migration folded in (not applied twice)
`private/sql/migrations/001_add_test_attempt_started_at.sql` adds `instructor_applications.test_attempt_started_at`. This column is already present in `007_instructor_registration.sql`, so the old migration is NOT re-applied.

## Booleans converted (explicit list)
`users.email_verified`, `users.is_recovery_mode`, `users.profile_completed`, `users.is_active`; `user_sessions.is_active`; `login_attempts.is_blocked`; `registration_blocks.is_blocked`; `account_recovery_attempts.is_blocked`; `email_verification_tokens.source_table` stays text; `instructor_applications.revenue_share_ack`, `terms_agreed`, `content_policy`; `courses.is_published`, `is_featured`, `certificate_enabled`; `lessons.is_free_preview`; `quiz_attempts.passed`; `quiz_options.is_correct`; `quiz_answers.is_correct`; `assignments.allow_late_submission`; `assignment_submissions.status` enum text; `notification_reads.is_read`; `study_plan.is_done`; `site_banners.active`; `test_tokens.used`; `user_sessions.is_active`.

## Verification of code-referenced columns
- db-usage.md (Phase 1) flagged one real schema/code mismatch: `public/instructor/profile.php` sets `users.phone`, but `phone` exists only on `student_profiles.phone` (mysql_schema.txt:529). The Postgres `users` table therefore does NOT add `phone`; the mismatch is preserved as a known issue (fix in the instructor profile page refactor, not silently added to schema).
- No SQL statement in the old code references a table missing from `mysql_schema.txt` (verified in db-usage.md §4). All columns the code uses exist in these Postgres tables (same names preserved).

## Notes / decisions
- `instructor_applications` carries both the application's own `profile_*` columns (vestigial, kept for 1:1) and links to `instructor_profiles` via `user_id`. Both are kept; the runtime app writes to `instructor_profiles`.
- `razorpay_orders.courses_json` and `purchase_history.courses_json` kept as `text` (matching original `longtext` JSON) rather than `jsonb`, to preserve exact PHP `json_decode` semantics.
