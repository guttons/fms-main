-- Staff Activity Log
CREATE TABLE IF NOT EXISTS public.staff_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_activity_staff_id ON public.staff_activity_log(staff_id);
CREATE INDEX idx_staff_activity_created ON public.staff_activity_log(created_at DESC);

-- Add live status columns to existing staff table
ALTER TABLE public.staff 
  ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS current_job_id TEXT,
  ADD COLUMN IF NOT EXISTS current_vehicle_id TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_location JSONB;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_activity_log;
