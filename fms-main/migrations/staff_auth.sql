-- Staff Authentication (PIN-based)
CREATE TABLE IF NOT EXISTS public.staff_auth (
  staff_id TEXT PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  must_change_pin BOOLEAN DEFAULT true,
  last_pin_change TIMESTAMPTZ,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.staff_auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.staff_auth FOR ALL USING (true);
