-- 009_ai_chat.sql

CREATE TABLE IF NOT EXISTS public.course_ai_chats (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id  bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uniq_course_user UNIQUE (course_id, user_id)
);
DROP TRIGGER IF EXISTS trg_course_ai_chats_updated ON public.course_ai_chats;
CREATE TRIGGER trg_course_ai_chats_updated BEFORE UPDATE ON public.course_ai_chats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.course_ai_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_ai_chats FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.course_ai_messages (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id        bigint NOT NULL REFERENCES public.course_ai_chats(id) ON DELETE CASCADE,
  course_id      bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id        bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('user','assistant')),
  content        text NOT NULL,
  versions       jsonb,
  active_version integer NOT NULL DEFAULT 0,
  feedback       text CHECK (feedback IN ('like','dislike')),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_ai_messages_chat ON public.course_ai_messages(chat_id, created_at);
ALTER TABLE public.course_ai_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_ai_messages FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.course_ai_share_links (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug      varchar(16) NOT NULL,
  chat_id   bigint NOT NULL REFERENCES public.course_ai_chats(id) ON DELETE CASCADE,
  user_id   bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT course_ai_share_links_slug_unique UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_course_ai_share_links_chat ON public.course_ai_share_links(chat_id);
ALTER TABLE public.course_ai_share_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_ai_share_links FROM anon, authenticated;
