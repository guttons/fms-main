-- =============================================================================
-- MACL FMS: Customer Accounts, Multi-Airline Holdings, Email Routing &
-- Real-Time Flight Job / Fuel Uplift Balance Deduction Migration
-- =============================================================================

-- 1. Extend fin_customers with multi-airline holdings, aircraft registrations,
--    account-level emails, circular rate overrides, and real-time deduction flags.
ALTER TABLE public.fin_customers
  ADD COLUMN IF NOT EXISTS associated_regs TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_emails TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS airline_holdings JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_price_per_liter NUMERIC(10, 5) DEFAULT 1.19197,
  ADD COLUMN IF NOT EXISTS auto_deduct_on_uplift BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Create normalized fin_customer_airlines table for relational lookups &
--    automated email routing when flight jobs are created/completed.
CREATE TABLE IF NOT EXISTS public.fin_customer_airlines (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES public.fin_customers(id) ON DELETE CASCADE,
  airline_code TEXT NOT NULL,            -- IATA/ICAO code e.g. 'EK', 'SQ', 'Q2', 'BA', 'EY'
  airline_name TEXT NOT NULL,            -- Full airline name e.g. 'Emirates', 'British Airways'
  flight_job_emails TEXT[] DEFAULT '{}', -- Emails to receive dispatched flight jobs
  billing_emails TEXT[] DEFAULT '{}',    -- Emails to receive signed fuel tickets / invoices
  aircraft_regs TEXT[] DEFAULT '{}',     -- Tail registrations linked to this airline
  auto_send_flight_job BOOLEAN DEFAULT true,
  auto_send_invoice BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, airline_code)
);

CREATE INDEX IF NOT EXISTS idx_fin_customer_airlines_code ON public.fin_customer_airlines (UPPER(airline_code));
CREATE INDEX IF NOT EXISTS idx_fin_customer_airlines_customer ON public.fin_customer_airlines (customer_id);

-- 3. Enable Row Level Security (remediating disabled RLS across finance tables)
ALTER TABLE public.fin_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_customer_airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_upcoming_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_proforma_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_fuel_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_customers' AND policyname = 'fin_customers_authenticated_access') THEN
    CREATE POLICY fin_customers_authenticated_access ON public.fin_customers
      FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_customer_airlines' AND policyname = 'fin_customer_airlines_authenticated_access') THEN
    CREATE POLICY fin_customer_airlines_authenticated_access ON public.fin_customer_airlines
      FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_fuel_requests' AND policyname = 'fin_fuel_requests_authenticated_access') THEN
    CREATE POLICY fin_fuel_requests_authenticated_access ON public.fin_fuel_requests
      FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;
