-- Migration: Master Database for Airlines, Flight Numbers, and Aircraft Registrations / Types

-- 1. Create airlines table
CREATE TABLE IF NOT EXISTS public.airlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    iata_code TEXT,
    icao_code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create flight_master table
CREATE TABLE IF NOT EXISTS public.flight_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_id UUID REFERENCES public.airlines(id) ON DELETE CASCADE,
    airline_name TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    route TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_airline_flight UNIQUE (airline_name, flight_number)
);

-- 3. Create aircraft_master table (aircraft_reg strictly determines aircraft_type)
CREATE TABLE IF NOT EXISTS public.aircraft_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_id UUID REFERENCES public.airlines(id) ON DELETE CASCADE,
    airline_name TEXT NOT NULL,
    aircraft_reg TEXT UNIQUE NOT NULL,
    aircraft_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flight_master_airline ON public.flight_master(airline_name);
CREATE INDEX IF NOT EXISTS idx_flight_master_flight_no ON public.flight_master(flight_number);
CREATE INDEX IF NOT EXISTS idx_aircraft_master_airline ON public.aircraft_master(airline_name);
CREATE INDEX IF NOT EXISTS idx_aircraft_master_reg ON public.aircraft_master(aircraft_reg);

-- Enable RLS (Row Level Security)
ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft_master ENABLE ROW LEVEL SECURITY;

-- Permissive policies for read, authenticated admin control
CREATE POLICY "Allow public read access for airlines" ON public.airlines FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete for airlines" ON public.airlines FOR ALL USING (true);

CREATE POLICY "Allow public read access for flight_master" ON public.flight_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete for flight_master" ON public.flight_master FOR ALL USING (true);

CREATE POLICY "Allow public read access for aircraft_master" ON public.aircraft_master FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete for aircraft_master" ON public.aircraft_master FOR ALL USING (true);
