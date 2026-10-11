-- 012_instructor_registration_fixes.sql
--
-- Two fixes that the PHP depends on but 007 missed:
--
-- 1. instructor_applications.status is written as 'test_failed' by
--    _callback_instructor_registration_fail() and findAndScoreAbandonedTestTokens(),
--    and selected by purgeRejectedInstructorData(). 007 only allowed
--    ('draft','pending','approved','rejected'), so every test-failure insert raised a
--    CHECK violation. Add the missing status.
--
-- 2. instructor_reg_sessions: the anonymous instructor-registration wizard keeps all of
--    its state in $_SESSION (serverless has no PHP session store). This table is the
--    replacement, keyed by a random token held in an httpOnly cookie. The wizard's draft
--    *content* still lives in instructor_applications / instructor_profiles exactly as the
--    PHP does; only the session pointers move here.

ALTER TABLE public.instructor_applications DROP CONSTRAINT IF EXISTS instructor_applications_status_check;
ALTER TABLE public.instructor_applications
  ADD CONSTRAINT instructor_applications_status_check
  CHECK (status IN ('draft','pending','approved','rejected','test_failed'));

CREATE TABLE IF NOT EXISTS public.instructor_reg_sessions (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token                 varchar(64) NOT NULL,
  user_id               bigint REFERENCES public.users(id) ON DELETE CASCADE,
  step                  smallint NOT NULL DEFAULT 1,
  awaiting_email_verify boolean NOT NULL DEFAULT false,
  resume_user_id        bigint,
  resume_email          varchar(255),
  return_to             smallint,
  app_submitted         boolean NOT NULL DEFAULT false,
  pending_email         varchar(255),
  test_passed           boolean NOT NULL DEFAULT false,
  test_score            smallint,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instructor_reg_sessions_token_unique UNIQUE (token),
  CONSTRAINT instructor_reg_sessions_step_check CHECK (step BETWEEN 1 AND 8)
);
CREATE INDEX IF NOT EXISTS idx_instructor_reg_sessions_token ON public.instructor_reg_sessions(token);
CREATE INDEX IF NOT EXISTS idx_instructor_reg_sessions_user ON public.instructor_reg_sessions(user_id);
DROP TRIGGER IF EXISTS trg_instructor_reg_sessions_updated ON public.instructor_reg_sessions;
CREATE TRIGGER trg_instructor_reg_sessions_updated BEFORE UPDATE ON public.instructor_reg_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.instructor_reg_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_reg_sessions FROM anon, authenticated;
