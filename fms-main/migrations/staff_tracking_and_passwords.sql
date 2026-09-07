-- Migration: staff_tracking_and_passwords
-- Run this in your Supabase SQL Editor

-- 1. Staff Passwords Table
CREATE TABLE IF NOT EXISTS public.staff_passwords (
    staff_id TEXT PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    must_change_password BOOLEAN DEFAULT false,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_password_change TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_passwords_staff_id ON public.staff_passwords(staff_id);

ALTER TABLE public.staff_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on staff_passwords" ON public.staff_passwords;
CREATE POLICY "Allow all access on staff_passwords" ON public.staff_passwords FOR ALL USING (true) WITH CHECK (true);

-- 2. Staff Activity Log Table
CREATE TABLE IF NOT EXISTS public.staff_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_activity_staff_id ON public.staff_activity_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_created ON public.staff_activity_log(created_at DESC);

ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on staff_activity_log" ON public.staff_activity_log;
CREATE POLICY "Allow all access on staff_activity_log" ON public.staff_activity_log FOR ALL USING (true) WITH CHECK (true);

-- 3. Live tracking columns on staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'OFFLINE';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS current_job_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS current_vehicle_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS current_location JSONB;

-- 4. Staff PIN Auth Table (Optional PIN-based authentication)
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

ALTER TABLE public.staff_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on staff_auth" ON public.staff_auth;
CREATE POLICY "Allow all access on staff_auth" ON public.staff_auth FOR ALL USING (true) WITH CHECK (true);

-- 5. Enhanced columns on alerts table
ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS alert_type TEXT,
  ADD COLUMN IF NOT EXISTS flight_number TEXT,
  ADD COLUMN IF NOT EXISTS assigned_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS sender_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- 6. Enable Realtime on staff_activity_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'staff_activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_activity_log;
  END IF;
END $$;

-- 7. Instruct PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
