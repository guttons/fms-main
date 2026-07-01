-- =============================================================================
-- FMS Vessel Registry Migration
-- Run this in the Supabase SQL Editor to create the vessels table
-- =============================================================================

-- 1. Vessels table
CREATE TABLE IF NOT EXISTS public.vessels (
  id TEXT PRIMARY KEY DEFAULT ('vessel-' || extract(epoch from now())::bigint::text || '-' || floor(random() * 1000)::int::text),
  name TEXT NOT NULL UNIQUE,
  imo TEXT,
  flag TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by name
CREATE INDEX IF NOT EXISTS idx_vessels_name ON public.vessels (name);

-- RLS policies
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Allow public read on vessels'
  ) THEN
    CREATE POLICY "Allow public read on vessels"
      ON public.vessels FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vessels' AND policyname = 'Allow authenticated all on vessels'
  ) THEN
    CREATE POLICY "Allow authenticated all on vessels"
      ON public.vessels FOR ALL USING (true);
  END IF;
END $$;

-- Enable realtime for vessels so changes are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.vessels;

-- Seed default vessels
INSERT INTO public.vessels (id, name, imo, flag, status)
VALUES
  ('vessel-mt-ocean-pride', 'MT OCEAN PRIDE', '9876543', 'Singapore', 'active'),
  ('vessel-mt-nordic-spirit', 'MT NORDIC SPIRIT', '9876544', 'Panama', 'active'),
  ('vessel-mt-alimas', 'MT ALIMAS', '9876545', 'Maldives', 'active'),
  ('vessel-mt-neon', 'MT NEON', '9876546', 'Maldives', 'active')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- DONE! The vessels table is now available for the System Admin panel.
-- =============================================================================
