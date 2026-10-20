-- ============================================================================
-- MACL FMS Security Hardening: Comprehensive RLS Lockdown on Finance & Auth Tables
-- ============================================================================

-- 1. Enable Row Level Security across all 10 financial tables previously disabled in finance_migration.sql
ALTER TABLE IF EXISTS public.fin_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_upcoming_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_proforma_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_fuel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_variance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_procurement_prs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_mpd_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fin_customs_shipments ENABLE ROW LEVEL SECURITY;

-- Grant full access to service_role and authenticated staff sessions on fin_* tables
DO $$
DECLARE
  tbl text;
  fin_tables text[] := ARRAY[
    'fin_customers',
    'fin_upcoming_payments',
    'fin_invoices',
    'fin_receipts',
    'fin_proforma_register',
    'fin_fuel_requests',
    'fin_variance_logs',
    'fin_procurement_prs',
    'fin_surcharges',
    'fin_mpd_sales',
    'fin_customs_shipments'
  ];
BEGIN
  FOREACH tbl IN ARRAY fin_tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Service role full access on %I" ON public.%I TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS "Authenticated staff access on %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Authenticated staff access on %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 2. Lock down staff_passwords and staff_auth (remove permissive public USING (true) policies)
ALTER TABLE IF EXISTS public.staff_passwords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on staff_passwords" ON public.staff_passwords;

ALTER TABLE IF EXISTS public.staff_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on staff_auth" ON public.staff_auth;
DROP POLICY IF EXISTS "Service role full access" ON public.staff_auth;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
