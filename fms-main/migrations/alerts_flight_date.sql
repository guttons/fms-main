-- Migration: Add flight_date to alerts table and add indexes for daily filtering
-- Run this in your Supabase SQL Editor

ALTER TABLE public.alerts 
  ADD COLUMN IF NOT EXISTS flight_date DATE;

-- Best-effort backfill for existing alerts based on their timestamp (Maldives is UTC+5)
UPDATE public.alerts
SET flight_date = (timestamp + INTERVAL '5 hours')::date
WHERE flight_date IS NULL AND timestamp IS NOT NULL;

-- Create indexes for fast date-scoped queries
CREATE INDEX IF NOT EXISTS idx_alerts_flight_date ON public.alerts(flight_date);
CREATE INDEX IF NOT EXISTS idx_alerts_flight_number_date ON public.alerts(flight_number, flight_date);
CREATE INDEX IF NOT EXISTS idx_alerts_unack_date ON public.alerts(acknowledged, flight_date);
