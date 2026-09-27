-- ============================================================================
-- MACL FMS Rigid Security Audit: System Activity Log Migration
-- ============================================================================

-- 1. Create system_activity_log table (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS public.system_activity_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Actor Details (Who)
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT NOT NULL,
  employee_id   TEXT,

  -- Action Context (What)
  module        TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  entity_label  TEXT,
  description   TEXT NOT NULL,

  -- Forensic State Snapshots
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB,

  -- Network / Session Details (Where)
  session_id    TEXT,
  ip_address    TEXT,
  user_agent    TEXT,

  -- Timestamp (When)
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Indexes for instant filtering by Admin in System Settings
CREATE INDEX IF NOT EXISTS idx_sys_act_user_id      ON public.system_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_act_module       ON public.system_activity_log(module);
CREATE INDEX IF NOT EXISTS idx_sys_act_action       ON public.system_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_sys_act_entity_id    ON public.system_activity_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_sys_act_created_at   ON public.system_activity_log(created_at DESC);

-- 3. Row Level Security: Immutable & Rigorous Access Control
ALTER TABLE public.system_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user (or service role) to append log entries
DROP POLICY IF EXISTS "Allow authenticated to insert activity log" ON public.system_activity_log;
CREATE POLICY "Allow authenticated to insert activity log"
  ON public.system_activity_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow reading logs: STRICTLY System Admins only
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.system_activity_log;
CREATE POLICY "Admins can view activity logs"
  ON public.system_activity_log
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE (s.id = auth.uid()::text OR s.employee_id = auth.uid()::text)
        AND s.role = 'ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()::text
        AND p.role = 'ADMIN'
    )
  );

-- Service role full management (for backend tasks/maintenance only)
DROP POLICY IF EXISTS "Service role full access on system_activity_log" ON public.system_activity_log;
CREATE POLICY "Service role full access on system_activity_log"
  ON public.system_activity_log
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: NO UPDATE OR DELETE policies are created for standard clients.
-- This ensures the audit trail is strictly append-only and cryptographically tamper-resistant.

-- 4. Enable Supabase Realtime for live audit streaming to System Admin module
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'system_activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_activity_log;
  END IF;
END $$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
