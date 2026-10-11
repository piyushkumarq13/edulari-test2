-- 001_extensions_and_helpers.sql
-- Shared helpers + migration bookkeeping. Idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- updated_at maintenance trigger (replaces MySQL ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tracks applied migration files (used by scripts/migrate.ts)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filename    text NOT NULL UNIQUE,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schema_migrations FROM anon, authenticated;

-- New table: replaces private/data/banners.json (file-backed)
CREATE TABLE IF NOT EXISTS public.site_banners (
  id              text PRIMARY KEY,
  version         integer NOT NULL DEFAULT 1,
  template        text NOT NULL DEFAULT 'simple-text',
  type            text NOT NULL DEFAULT 'info',
  title           text NOT NULL DEFAULT '',
  message         text NOT NULL DEFAULT '',
  audience        jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta             jsonb,
  schedule        jsonb,
  resurface_after_days integer,
  active          boolean NOT NULL DEFAULT true,
  priority        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      bigint,
  updated_by      bigint
);
CREATE INDEX IF NOT EXISTS idx_site_banners_active ON public.site_banners(active);
DROP TRIGGER IF EXISTS trg_site_banners_updated ON public.site_banners;
CREATE TRIGGER trg_site_banners_updated BEFORE UPDATE ON public.site_banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.site_banners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_banners FROM anon, authenticated;

-- New table: replaces .cleanup_last_run / .token_cleanup_last_run / .purge_last_run marker files
CREATE TABLE IF NOT EXISTS public.cron_state (
  key       text PRIMARY KEY,
  last_run  timestamptz,
  meta      jsonb
);
ALTER TABLE public.cron_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_state FROM anon, authenticated;

-- New table: replaces private/logs/maintenance.log
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event      text NOT NULL,
  context    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_created ON public.maintenance_logs(created_at);
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maintenance_logs FROM anon, authenticated;

-- New table: replaces private/logs/security.log
CREATE TABLE IF NOT EXISTS public.security_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event      text NOT NULL,
  context    jsonb,
  ip_address varchar(45),
  user_id    bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_event ON public.security_events(event);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM anon, authenticated;
