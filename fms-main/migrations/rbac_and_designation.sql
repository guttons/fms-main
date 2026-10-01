-- ==============================================================================
-- FMS Database Migration: Staff Designation & Dynamic RBAC Roles
-- ==============================================================================

-- 1. Add designation / position column to staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS designation TEXT;

-- 2. Backfill initial designations from role if empty
UPDATE public.staff SET designation =
  CASE role
    WHEN 'ADMIN'             THEN 'System Administrator'
    WHEN 'ITP_MANAGER'       THEN 'ITP Manager'
    WHEN 'ITP_SUPERVISOR'    THEN 'ITP Supervisor'
    WHEN 'ITP_OFFICER'       THEN 'ITP Officer'
    WHEN 'ITP_OPERATOR'      THEN 'ITP Operator'
    WHEN 'ITP_HD_OPERATOR'   THEN 'Hydrant Dispenser Operator'
    WHEN 'DEPOT_MANAGER'     THEN 'Depot Manager'
    WHEN 'DEPOT_OPERATOR'    THEN 'Depot Operator'
    WHEN 'FUEL_MANAGEMENT'   THEN 'Fuel Management'
    WHEN 'EXECUTIVE'         THEN 'Executive'
    WHEN 'FINANCE'           THEN 'Finance Manager'
    WHEN 'COMMERCIAL'        THEN 'Commercial Officer'
    WHEN 'CUSTOMER'          THEN 'Aviation Customer'
    WHEN 'MACL_MANAGEMENT'   THEN 'MACL Management'
    WHEN 'FUEL_ADMINISTRATION' THEN 'Fuel Administration'
    ELSE role
  END
WHERE designation IS NULL OR TRIM(designation) = '';

-- 3. Create custom_roles table for System Admin dynamic role management
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  color        TEXT DEFAULT 'bg-primary/10 text-primary border-primary/20',
  description  TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   TEXT NOT NULL REFERENCES public.custom_roles(name) ON DELETE CASCADE,
  module_key  TEXT NOT NULL,
  can_view    BOOLEAN DEFAULT FALSE,
  can_edit    BOOLEAN DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (role_name, module_key)
);

-- 5. Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated or all internal client access
DROP POLICY IF EXISTS "Allow read custom_roles" ON public.custom_roles;
CREATE POLICY "Allow read custom_roles" ON public.custom_roles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write custom_roles" ON public.custom_roles;
CREATE POLICY "Allow write custom_roles" ON public.custom_roles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read role_permissions" ON public.role_permissions;
CREATE POLICY "Allow read role_permissions" ON public.role_permissions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write role_permissions" ON public.role_permissions;
CREATE POLICY "Allow write role_permissions" ON public.role_permissions
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert seed custom roles if not present
INSERT INTO public.custom_roles (name, display_name, color, description)
VALUES 
  ('ADMIN', 'System Admin', 'bg-error/10 text-error border-error/20', 'Full unrestricted platform access, user administration, security controls, fleet and system settings'),
  ('ITP_MANAGER', 'ITP Manager', 'bg-primary/10 text-primary border-primary/20', 'Into-plane operations management, staff allocation, schedule oversight and performance metrics'),
  ('DEPOT_MANAGER', 'Depot Manager', 'bg-primary/10 text-primary border-primary/20', 'Fuel farm oversight, tank inventory reconciliation, vessel receipt and bridging supervision'),
  ('ITP_SUPERVISOR', 'ITP Supervisor', 'bg-success/10 text-success border-success/20', 'Airside shift supervision, job dispatch verification, safety checks and team coordination'),
  ('ITP_OFFICER', 'ITP Officer', 'bg-warning/10 text-warning border-warning/20', 'Refueling operations coordination, delivery ticket issuance and flight schedule monitoring'),
  ('ITP_OPERATOR', 'ITP Operator', 'bg-success/10 text-success border-success/20', 'Refueller vehicle driver and fueling technician for commercial and ad-hoc aircraft'),
  ('ITP_HD_OPERATOR', 'HD Operator', 'bg-success/10 text-success border-success/20', 'Hydrant Dispenser pit connection specialist and high-flow widebody aircraft refueling technician'),
  ('DEPOT_OPERATOR', 'Depot Operator', 'bg-success/10 text-success border-success/20', 'Fuel storage technician, tank dipping, pump manifold operation, filtration and bridging loading'),
  ('FUEL_MANAGEMENT', 'Fuel Management', 'bg-warning/10 text-warning border-warning/20', 'Overall fuel supply chain analytics, daily reconciliation, performance KPIs and forecasting'),
  ('EXECUTIVE', 'Executive', 'bg-purple-500/10 text-purple-400 border-purple-500/20', 'Airport executive leadership dashboard, revenue insights, route consumption and high-level trends'),
  ('COMMERCIAL', 'Commercial', 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', 'Airline contract pricing, uplift volumes, commercial route analytics and airline accounts'),
  ('FINANCE', 'Finance Manager', 'bg-primary/10 text-primary border-primary/20', 'Billing statements, customer credit limits, monthly invoice consolidation and payment auditing'),
  ('CUSTOMER', 'Aviation Customer', 'bg-success/10 text-success border-success/20', 'Airline representative access to view delivery tickets, fuel receipts and sign-off records'),
  ('MACL_MANAGEMENT', 'MACL Management', 'bg-primary/10 text-primary border-primary/20', 'Airport senior management oversight, flight schedules, commercial reporting and high-level fuel data'),
  ('FUEL_ADMINISTRATION', 'Fuel Administration', 'bg-warning/10 text-warning border-warning/20', 'Fuel section operational coordinator with access to schedules, into-plane ops, equipment, stock and reports')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

