-- ============================================================================
-- MACL FMS Security Hardening: Row Level Security (RLS) & Server Time Function
-- ============================================================================

-- 1. Secure staff_passwords Table
ALTER TABLE public.staff_passwords ENABLE ROW LEVEL SECURITY;

-- Drop insecure public policy
DROP POLICY IF EXISTS "Allow all access on staff_passwords" ON public.staff_passwords;
DROP POLICY IF EXISTS "Service role full access on staff_passwords" ON public.staff_passwords;
DROP POLICY IF EXISTS "Staff self manage passwords" ON public.staff_passwords;

-- Restrict to service_role (backend API operations)
CREATE POLICY "Service role full access on staff_passwords"
  ON public.staff_passwords
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view or update only their own password record
CREATE POLICY "Staff self manage passwords"
  ON public.staff_passwords
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = staff_id)
  WITH CHECK (auth.uid()::text = staff_id);


-- 2. Secure staff_auth Table (PIN-based authentication)
ALTER TABLE public.staff_auth ENABLE ROW LEVEL SECURITY;

-- Drop insecure public policies
DROP POLICY IF EXISTS "Allow all access on staff_auth" ON public.staff_auth;
DROP POLICY IF EXISTS "Service role full access" ON public.staff_auth;
DROP POLICY IF EXISTS "Service role full access on staff_auth" ON public.staff_auth;
DROP POLICY IF EXISTS "Staff self access on staff_auth" ON public.staff_auth;

-- Restrict to service_role
CREATE POLICY "Service role full access on staff_auth"
  ON public.staff_auth
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view only their own auth status
CREATE POLICY "Staff self access on staff_auth"
  ON public.staff_auth
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = staff_id);


-- 3. Authoritative Server Time Function for Supabase
-- This provides a resilient database fallback for server time synchronization
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'serverTime', to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'epochMs', floor(extract(epoch from now()) * 1000)
  );
$$;

-- Allow anon and authenticated clients to query server time
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
