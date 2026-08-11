-- Supabase Migration: Aircraft Registry Table for Automated Lookup & Caching
-- Creates aircraft_registry table to cache aircraft registration to type mappings.

CREATE TABLE IF NOT EXISTS public.aircraft_registry (
  registration VARCHAR(30) PRIMARY KEY,
  aircraft_type VARCHAR(60) NOT NULL,
  icao_code VARCHAR(10),
  airline_name VARCHAR(100),
  source VARCHAR(40) DEFAULT 'PLANESPOTTERS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick case-insensitive lookups
CREATE INDEX IF NOT EXISTS idx_aircraft_registry_reg ON public.aircraft_registry (LOWER(registration));

-- Enable Row Level Security (RLS)
ALTER TABLE public.aircraft_registry ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated & anon users
CREATE POLICY "Allow public read access to aircraft_registry"
  ON public.aircraft_registry FOR SELECT
  USING (true);

-- Allow insert/update to authenticated & anon users for seamless auto-caching
CREATE POLICY "Allow public insert/update to aircraft_registry"
  ON public.aircraft_registry FOR ALL
  USING (true)
  WITH CHECK (true);
