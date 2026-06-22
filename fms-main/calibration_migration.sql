-- =============================================================================
-- FMS Calibration & App Settings Migration
-- Run this in the Supabase SQL Editor to create the required tables
-- =============================================================================

-- 1. Tank Calibrations table
-- Stores dip height (mm) to volume (liters) mappings for each tank
CREATE TABLE IF NOT EXISTS public.tank_calibrations (
  id SERIAL PRIMARY KEY,
  tank_id TEXT NOT NULL,
  dip_mm INTEGER NOT NULL,
  volume_liters NUMERIC NOT NULL,
  UNIQUE(tank_id, dip_mm)
);

-- Index for fast lookups by tank_id + dip_mm
CREATE INDEX IF NOT EXISTS idx_tank_calibrations_lookup 
  ON public.tank_calibrations (tank_id, dip_mm);

-- RLS policies
ALTER TABLE public.tank_calibrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tank_calibrations' AND policyname = 'Allow public read on tank_calibrations'
  ) THEN
    CREATE POLICY "Allow public read on tank_calibrations" 
      ON public.tank_calibrations FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tank_calibrations' AND policyname = 'Allow authenticated insert on tank_calibrations'
  ) THEN
    CREATE POLICY "Allow authenticated insert on tank_calibrations" 
      ON public.tank_calibrations FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tank_calibrations' AND policyname = 'Allow authenticated delete on tank_calibrations'
  ) THEN
    CREATE POLICY "Allow authenticated delete on tank_calibrations" 
      ON public.tank_calibrations FOR DELETE USING (true);
  END IF;
END $$;


-- 2. App Settings table (key-value store for global app settings)
-- Used for: service tank selection, and future global settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow public read on app_settings'
  ) THEN
    CREATE POLICY "Allow public read on app_settings" 
      ON public.app_settings FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow authenticated all on app_settings'
  ) THEN
    CREATE POLICY "Allow authenticated all on app_settings" 
      ON public.app_settings FOR ALL USING (true);
  END IF;
END $$;

-- Enable realtime for app_settings so service tank changes are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Seed default service tank
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('service_tank', '{"tankId": "tk101"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- DONE! Next steps:
-- 1. Run the "Seed Calibration Data" action from the System Admin panel
--    to populate tank_calibrations from the CSV data.
-- =============================================================================
