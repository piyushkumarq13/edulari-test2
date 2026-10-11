-- 005_learning.sql

CREATE TABLE IF NOT EXISTS public.enrollments (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id          bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id         bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrolled_at        timestamptz DEFAULT now(),
  completed_at       timestamptz,
  progress_percentage integer DEFAULT 0,
  final_grade        numeric(5,2),
  CONSTRAINT enrollments_unique_enrollment UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enrollments FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id      bigint NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id          bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at       timestamptz,
  time_spent_seconds integer DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  CONSTRAINT lesson_progress_unique UNIQUE (enrollment_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_progress FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id bigint NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id     bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  score         integer DEFAULT 0,
  total_points  integer DEFAULT 0,
  percentage    numeric(5,2) DEFAULT 0.00,
  passed        boolean DEFAULT false,
  started_at    timestamptz DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment ON public.quiz_attempts(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson ON public.quiz_attempts(lesson_id);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_attempts FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id          bigint NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id         bigint NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id  bigint REFERENCES public.quiz_options(id) ON DELETE SET NULL,
  is_correct          boolean DEFAULT false,
  points_earned       integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON public.quiz_answers(question_id);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_answers FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id   bigint NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id       bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  submission_text text,
  attachment_file varchar(255),
  submitted_at    timestamptz DEFAULT now(),
  marks_obtained  integer,
  feedback        text,
  status          text DEFAULT 'pending' CHECK (status IN ('pending','graded','returned')),
  graded_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_assignment_sub_enrollment ON public.assignment_submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_sub_lesson ON public.assignment_submissions(lesson_id);
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_submissions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.certificates (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certificate_id varchar(32) NOT NULL,
  enrollment_id  bigint NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  student_id     bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id      bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  course_name    varchar(255) NOT NULL,
  student_name   varchar(255) NOT NULL,
  issued_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_certificate_id UNIQUE (certificate_id),
  CONSTRAINT uq_enrollment UNIQUE (enrollment_id)
);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course ON public.certificates(course_id);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.certificates FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.course_reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_student ON public.course_reviews(student_id);
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_reviews FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.instructor_ratings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instructor_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id    bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note          varchar(200),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT uq_student_instructor UNIQUE (student_id, instructor_id)
);
CREATE INDEX IF NOT EXISTS idx_instructor_ratings_instructor ON public.instructor_ratings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_ratings_student ON public.instructor_ratings(student_id);
DROP TRIGGER IF EXISTS trg_instructor_ratings_updated ON public.instructor_ratings;
CREATE TRIGGER trg_instructor_ratings_updated BEFORE UPDATE ON public.instructor_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.instructor_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_ratings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.study_plan (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id   bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id    bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id    bigint REFERENCES public.lessons(id) ON DELETE SET NULL,
  planned_date date NOT NULL,
  planned_time time,
  duration_min smallint DEFAULT 30,
  note         varchar(255),
  is_done      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_plan_student_date ON public.study_plan(student_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_study_plan_course ON public.study_plan(course_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_lesson ON public.study_plan(lesson_id);
DROP TRIGGER IF EXISTS trg_study_plan_updated ON public.study_plan;
CREATE TRIGGER trg_study_plan_updated BEFORE UPDATE ON public.study_plan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.study_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_plan FROM anon, authenticated;
