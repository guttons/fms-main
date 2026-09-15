-- Migration: Add Fuel Request Time (FRT), TOBT, and Clearance fields to flight_jobs
-- Description: Enables recording of TOBT (Target Off-Block Time / DEP STD updates),
--              FRT Airline, FRT AOCC, FRT For, and Clearance timestamp.

ALTER TABLE public.flight_jobs 
  ADD COLUMN IF NOT EXISTS tobt TEXT,
  ADD COLUMN IF NOT EXISTS frt_airline TEXT,
  ADD COLUMN IF NOT EXISTS frt_aocc TEXT,
  ADD COLUMN IF NOT EXISTS frt_for TEXT,
  ADD COLUMN IF NOT EXISTS timestamp_clearance TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_flight_jobs_tobt ON public.flight_jobs (tobt);
