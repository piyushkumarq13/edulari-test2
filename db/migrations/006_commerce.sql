-- 006_commerce.sql

CREATE TABLE IF NOT EXISTS public.cart (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id  bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  added_at   timestamptz DEFAULT now(),
  CONSTRAINT unique_cart UNIQUE (student_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_course ON public.cart(course_id);
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cart FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.wishlists (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id  bigint NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_wishlist UNIQUE (student_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlists_course ON public.wishlists(course_id);
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wishlists FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id        bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_order_id varchar(64) NOT NULL,
  amount_paise      integer NOT NULL,
  currency          varchar(10) NOT NULL DEFAULT 'INR',
  courses_json      text NOT NULL,
  status            text NOT NULL DEFAULT 'created' CHECK (status IN ('created','enrolled','enrollment_failed','abandoned','failed','cancelled')),
  failure_reason    varchar(255),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT razorpay_orders_order_unique UNIQUE (razorpay_order_id)
);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status_created ON public.razorpay_orders(status, created_at);
DROP TRIGGER IF EXISTS trg_razorpay_orders_updated ON public.razorpay_orders;
CREATE TRIGGER trg_razorpay_orders_updated BEFORE UPDATE ON public.razorpay_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.razorpay_orders FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.purchase_history (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id          bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  razorpay_order_id   varchar(100) NOT NULL,
  razorpay_payment_id varchar(100) NOT NULL,
  amount_paise        integer NOT NULL,
  currency            varchar(10) NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','enrollment_failed','enrolled','refunded')),
  enrolled_count      smallint NOT NULL DEFAULT 0,
  courses_json        text NOT NULL,
  ip_address          varchar(45),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment UNIQUE (razorpay_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_purchase_history_student ON public.purchase_history(student_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_order ON public.purchase_history(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_status ON public.purchase_history(status);
DROP TRIGGER IF EXISTS trg_purchase_history_updated ON public.purchase_history;
CREATE TRIGGER trg_purchase_history_updated BEFORE UPDATE ON public.purchase_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_history FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.instructor_payouts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instructor_id  bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount         numeric(10,2) NOT NULL,
  currency       varchar(10) NOT NULL DEFAULT 'INR',
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  payment_method varchar(100),
  reference_no   varchar(255),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_instructor_payouts_instructor ON public.instructor_payouts(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_payouts_status ON public.instructor_payouts(status);
ALTER TABLE public.instructor_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instructor_payouts FROM anon, authenticated;
