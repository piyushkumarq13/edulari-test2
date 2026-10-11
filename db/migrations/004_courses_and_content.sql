-- 004_courses_and_content.sql

CREATE TABLE IF NOT EXISTS public.categories (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        varchar(100) NOT NULL,
  slug        varchar(100) NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT categories_slug_unique UNIQUE (slug)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.courses (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instructor_id        bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id          bigint REFERENCES public.categories(id) ON DELETE SET NULL,
  title                varchar(255) NOT NULL,
  slug                 varchar(255) NOT NULL,
  description          text,
  short_description    text,
  thumbnail            varchar(255),
  level                text DEFAULT 'beginner' CHECK (level IN ('beginner','intermediate','advanced')),
  language             varchar(50) DEFAULT 'English',
  duration_hours       integer DEFAULT 0,
  price                numeric(10,2) DEFAULT 0.00,
  is_published         boolean DEFAULT false,
  is_featured          boolean DEFAULT false,
  certificate_enabled  boolean DEFAULT true,
  passing_percentage   integer DEFAULT 70,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  published_at         timestamptz,
  CONSTRAINT courses_slug_unique UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses(category_id);
DROP TRIGGER IF EXISTS trg_courses_updated ON public.courses;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.courses FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.course_sections (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title       varchar(255) NOT NULL,
  description text,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_sections_course ON public.course_sections(course_id);
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_sections FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.lessons (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id      bigint NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  course_id       bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title           varchar(255) NOT NULL,
  content_type    text NOT NULL CHECK (content_type IN ('video','text','pdf','quiz','assignment')),
  content_text    text,
  video_url       varchar(500),
  video_duration  integer DEFAULT 0,
  pdf_file        varchar(255),
  is_free_preview boolean DEFAULT false,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON public.lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons(course_id);
DROP TRIGGER IF EXISTS trg_lessons_updated ON public.lessons;
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lessons FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.assignments (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id              bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  instructions           text NOT NULL,
  max_marks              integer DEFAULT 100,
  passing_marks          integer DEFAULT 40,
  due_days               integer DEFAULT 7,
  allow_late_submission  boolean DEFAULT false,
  created_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson ON public.assignments(lesson_id);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignments FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id     bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  question      text NOT NULL,
  question_type text DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','true_false','short_answer')),
  points        integer DEFAULT 1,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_lesson ON public.quiz_questions(lesson_id);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_questions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct  boolean DEFAULT false,
  sort_order  integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options(question_id);
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_options FROM anon, authenticated;
