-- 003_security_rate_limit.sql

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier    varchar(255) NOT NULL,
  type          text NOT NULL CHECK (type IN ('email','ip')),
  attempt_count integer DEFAULT 0,
  last_attempt  timestamptz,
  is_blocked    boolean DEFAULT false,
  block_expires timestamptz
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier,type);
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_attempts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.registration_blocks (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address    varchar(45) NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 1,
  first_attempt timestamptz NOT NULL DEFAULT now(),
  block_expires timestamptz,
  is_blocked    boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_reg_ip UNIQUE (ip_address)
);
ALTER TABLE public.registration_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_blocks FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.account_recovery_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_address    varchar(45) NOT NULL,
  attempt_count integer DEFAULT 0,
  first_attempt timestamptz DEFAULT now(),
  is_blocked    boolean DEFAULT false,
  block_expires timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT account_recovery_attempts_ip_unique UNIQUE (ip_address)
);
CREATE INDEX IF NOT EXISTS idx_ara_ip ON public.account_recovery_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_ara_blocked ON public.account_recovery_attempts(is_blocked);
DROP TRIGGER IF EXISTS trg_ara_updated ON public.account_recovery_attempts;
CREATE TRIGGER trg_ara_updated BEFORE UPDATE ON public.account_recovery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.account_recovery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_recovery_attempts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier  varchar(255) NOT NULL,
  type        text NOT NULL CHECK (type IN ('email','ip')),
  attempt_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pra_identifier_type ON public.password_reset_attempts(identifier,type);
CREATE INDEX IF NOT EXISTS idx_pra_attempt_at ON public.password_reset_attempts(attempt_at);
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_attempts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.password_resets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON public.password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token);
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_resets FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_table text NOT NULL DEFAULT 'unverified_users' CHECK (source_table IN ('unverified_users','users')),
  token        varchar(64) NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT evt_token_unique UNIQUE (token),
  CONSTRAINT evt_user_unique UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_evt_expires ON public.email_verification_tokens(expires_at);
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_verification_tokens FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.test_failures (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address  varchar(45) NOT NULL,
  context     varchar(64) NOT NULL DEFAULT 'instructor_registration',
  failed_at   timestamptz NOT NULL DEFAULT now(),
  retry_after timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_test_failures_user ON public.test_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_test_failures_ip ON public.test_failures(ip_address);
ALTER TABLE public.test_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_failures FROM anon, authenticated;
