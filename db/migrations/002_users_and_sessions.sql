-- 002_users_and_sessions.sql

CREATE TABLE IF NOT EXISTS public.users (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                 varchar(255) NOT NULL,
  email                varchar(255) NOT NULL,
  password             varchar(255),
  oauth_provider       varchar(20),
  oauth_id             varchar(255),
  avatar_url           varchar(512),
  registration_date    timestamptz DEFAULT now(),
  last_login           timestamptz,
  email_verified       boolean DEFAULT true,
  is_recovery_mode     boolean DEFAULT false,
  ip_address           varchar(45),
  profile_completed    boolean NOT NULL DEFAULT false,
  role                 varchar(20) NOT NULL DEFAULT 'student',
  bio                  text,
  profile_image        varchar(255),
  is_active            boolean DEFAULT true,
  block_reason         varchar(50),
  block_note           varchar(255),
  password_changed_at  timestamptz,
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_id)
);
CREATE INDEX IF NOT EXISTS idx_users_is_recovery_mode ON public.users(is_recovery_mode);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_token varchar(64) NOT NULL,
  ip_address    varchar(45) NOT NULL DEFAULT '',
  device_info   varchar(255) NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_active   timestamptz NOT NULL DEFAULT now(),
  is_active     boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,
  kicked_reason varchar(50),
  CONSTRAINT user_sessions_token_unique UNIQUE (session_token)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
DROP TRIGGER IF EXISTS trg_user_sessions_updated ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_updated BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_sessions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.student_profiles (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            bigint NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  highest_education  text CHECK (highest_education IN ('high_school','diploma','bachelors','masters','phd','other')),
  college_name       varchar(255),
  field_of_study     varchar(255),
  courses_interested varchar(1000),
  skills             varchar(1000),
  learning_goal      text CHECK (learning_goal IN ('career_change','skill_upgrade','personal_interest','academic','other')),
  experience_level   text CHECK (experience_level IN ('beginner','intermediate','advanced')),
  bio                text,
  phone              varchar(20),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_student_profiles_updated ON public.student_profiles;
CREATE TRIGGER trg_student_profiles_updated BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_profiles FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.instructor_profiles (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  headline       varchar(120) NOT NULL DEFAULT '',
  bio            text NOT NULL,
  website        varchar(255),
  linkedin_url   varchar(255),
  twitter_url    varchar(255),
  years_exp      smallint NOT NULL DEFAULT 0,
  teaching_style varchar(50),
  avatar_url     varchar(255),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_instructor_profiles_updated ON public.instructor_profiles;
CREATE TRIGGER trg_instructor_profiles_updated BEFORE UPDATE ON public.instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_profiles FROM anon, authenticated;
