-- Migration: Create AOCC Delay Records Log table
CREATE TABLE IF NOT EXISTS public.delay_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operational_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delay_from TEXT NOT NULL,
  operator TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  delay_code TEXT,
  delay_reason TEXT,
  remarks TEXT,
  fuel_team TEXT,
  fuel_team_comment TEXT,
  duty_in_charge TEXT,
  status TEXT DEFAULT 'PENDING',
  flight_log_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for rapid querying and filtering
CREATE INDEX IF NOT EXISTS idx_delay_logs_date ON public.delay_logs (operational_date DESC);
CREATE INDEX IF NOT EXISTS idx_delay_logs_flight ON public.delay_logs (flight_number);
CREATE INDEX IF NOT EXISTS idx_delay_logs_operator ON public.delay_logs (operator);
CREATE INDEX IF NOT EXISTS idx_delay_logs_status ON public.delay_logs (status);

-- Enable Supabase Realtime for instant multi-user synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE public.delay_logs;
