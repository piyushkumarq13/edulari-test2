-- 007_instructor_registration.sql

CREATE TABLE IF NOT EXISTS public.instructor_applications (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                   bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  highest_education         varchar(80) NOT NULL DEFAULT '',
  institution              varchar(150) NOT NULL DEFAULT '',
  field_of_study            varchar(150) NOT NULL DEFAULT '',
  graduation_year           smallint,
  certifications            text,
  professional_exp          text NOT NULL,
  notable_works             text,
  primary_subject           varchar(100) NOT NULL DEFAULT '',
  secondary_subjects        varchar(255),
  skill_level               varchar(30) NOT NULL DEFAULT '',
  target_audience           varchar(255) NOT NULL DEFAULT '',
  course_ideas              text NOT NULL,
  sample_content_url        varchar(255),
  full_legal_name           varchar(150) NOT NULL DEFAULT '',
  pan_number                text,   -- AES-256-GCM encrypted at rest
  bank_account              text,   -- AES-256-GCM encrypted at rest
  ifsc_code                 text,   -- AES-256-GCM encrypted at rest
  account_holder            text,   -- AES-256-GCM encrypted at rest
  upi_id                    text,   -- AES-256-GCM encrypted at rest
  revenue_share_ack         boolean NOT NULL DEFAULT false,
  terms_agreed              boolean NOT NULL DEFAULT false,
  content_policy            boolean NOT NULL DEFAULT false,
  govt_id_file              varchar(255),
  marksheet_file            varchar(255),
  docs_scheduled_delete     timestamptz,
  docs_delete_after         timestamptz,
  status                    text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected')),
  rejection_reason          text,
  submitted_at              timestamptz DEFAULT now(),
  reviewed_at               timestamptz,
  updated_at                timestamptz DEFAULT now(),
  test_score                smallint NOT NULL DEFAULT 0,
  test_time_taken_seconds   integer,
  test_attempt_started_at   timestamptz,  -- folded from private/sql/migrations/001 (applied once, not twice)
  last_completed_step       smallint NOT NULL DEFAULT 1,
  reg_step                  smallint NOT NULL DEFAULT 1,
  profile_headline          varchar(120),
  profile_bio               text,
  profile_website           varchar(255),
  profile_linkedin          varchar(255),
  profile_twitter           varchar(255),
  profile_years_exp         smallint DEFAULT 0,
  profile_teach_style       varchar(50),
  CONSTRAINT instructor_applications_user_unique UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_instructor_applications_status ON public.instructor_applications(status);
DROP TRIGGER IF EXISTS trg_instructor_applications_updated ON public.instructor_applications;
CREATE TRIGGER trg_instructor_applications_updated BEFORE UPDATE ON public.instructor_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.instructor_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_applications FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.test_tokens (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token              varchar(64) NOT NULL,
  expires_at         timestamptz NOT NULL,
  used               boolean NOT NULL DEFAULT false,
  started_at         timestamptz,
  questions_data     jsonb,
  answers_data       jsonb,
  started_ip         varchar(45),
  last_autosave_at   timestamptz,
  test_data          jsonb NOT NULL,
  answers_updated_at timestamptz,
  on_pass_action     varchar(64) NOT NULL DEFAULT 'instructor_registration',
  redirect_pass      varchar(255) NOT NULL DEFAULT '/instructor-register-success',
  redirect_fail      varchar(255) NOT NULL DEFAULT '/instructor-register',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_tokens_token_unique UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS idx_test_tokens_token ON public.test_tokens(token);
CREATE INDEX IF NOT EXISTS idx_test_tokens_user ON public.test_tokens(user_id);
ALTER TABLE public.test_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_tokens FROM anon, authenticated;
