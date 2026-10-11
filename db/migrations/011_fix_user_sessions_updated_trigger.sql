-- Phase 5 fix: user_sessions has no updated_at column (it uses last_active),
-- so attaching set_updated_at() made EVERY UPDATE on the table fail with
-- `record "new" has no field "updated_at"`. That broke session validation
-- (which writes last_active) and therefore every authenticated request.
--
-- The table does not need the trigger; last_active is written explicitly by
-- lib/auth/sessions.ts. Fix it in place so the correction also applies to
-- databases already migrated from 002.

DROP TRIGGER IF EXISTS trg_user_sessions_updated ON public.user_sessions;

-- Keep set_updated_at() attached only to tables that actually have updated_at.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT tg.tgisinternal
      AND n.nspname = 'public'
      AND tg.tgfoid = 'public.set_updated_at()'::regprocedure
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name = 'updated_at'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%_updated ON public.%I', t.relname, t.relname);
  END LOOP;
END $$;
