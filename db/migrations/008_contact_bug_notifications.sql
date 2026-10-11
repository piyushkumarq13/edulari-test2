-- 008_contact_bug_notifications.sql

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_ref  varchar(20) NOT NULL,
  user_id     bigint REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name varchar(100) NOT NULL,
  sender_email varchar(200) NOT NULL,
  sender_role varchar(50) NOT NULL DEFAULT 'Guest',
  category    varchar(50) NOT NULL,
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  subject     varchar(200) NOT NULL,
  message     text NOT NULL,
  order_ref   varchar(100),
  course_ref  varchar(200),
  sender_ip   varchar(45) NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_submissions_ticket_unique UNIQUE (ticket_ref)
);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_priority ON public.contact_submissions(priority);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_category ON public.contact_submissions(category);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON public.contact_submissions(sender_email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_ip ON public.contact_submissions(sender_ip);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_user ON public.contact_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON public.contact_submissions(created_at);
DROP TRIGGER IF EXISTS trg_contact_submissions_updated ON public.contact_submissions;
CREATE TRIGGER trg_contact_submissions_updated BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_submissions FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.contact_replies (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id    bigint NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  admin_id         bigint NOT NULL,
  reply_message    text NOT NULL,
  reply_type       text NOT NULL DEFAULT 'public' CHECK (reply_type IN ('public','internal')),
  resolution_status varchar(50),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_replies_submission ON public.contact_replies(submission_id);
CREATE INDEX IF NOT EXISTS idx_contact_replies_admin ON public.contact_replies(admin_id);
ALTER TABLE public.contact_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_replies FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference      varchar(20) NOT NULL,
  reporter_name  varchar(120) NOT NULL,
  reporter_email varchar(255) NOT NULL,
  reporter_role  varchar(30) NOT NULL DEFAULT 'Guest',
  reporter_ip    varchar(45) NOT NULL DEFAULT '',
  issue_type     varchar(30) NOT NULL DEFAULT 'bug',
  page_url       varchar(500) NOT NULL DEFAULT '',
  subject        varchar(255) NOT NULL,
  description    text NOT NULL,
  steps          text,
  expected       text,
  severity       smallint NOT NULL DEFAULT 3,
  severity_label varchar(20) NOT NULL DEFAULT 'Moderate',
  browser        varchar(200) NOT NULL DEFAULT '',
  attachment     varchar(260),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix','duplicate')),
  admin_notes    text,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_reports_reference_unique UNIQUE (reference)
);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_severity ON public.bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_bug_reports_email ON public.bug_reports(reporter_email);
CREATE INDEX IF NOT EXISTS idx_bug_reports_ip ON public.bug_reports(reporter_ip);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON public.bug_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_issue_type ON public.bug_reports(issue_type);
DROP TRIGGER IF EXISTS trg_bug_reports_updated ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_updated BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bug_reports FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.notification_messages (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          varchar(50) NOT NULL,
  title         varchar(255) NOT NULL,
  body          text NOT NULL,
  audience      varchar(20) NOT NULL DEFAULT 'all',
  target_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  sent_by       bigint REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_messages_audience ON public.notification_messages(audience);
CREATE INDEX IF NOT EXISTS idx_notification_messages_target ON public.notification_messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_messages_created ON public.notification_messages(created_at);
ALTER TABLE public.notification_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_messages FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES public.notification_messages(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_read    boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  CONSTRAINT uq_msg_user UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_read ON public.notification_reads(user_id, is_read);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_reads FROM anon, authenticated;
