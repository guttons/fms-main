import { supabase } from '../supabase';
import { ALL_MODULES } from '../constants/moduleRegistry';
import { UserRole } from '../types';

export interface CustomRole {
  id: string;
  name: string;
  displayName: string;
  color?: string;
  description?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  isSystemRole?: boolean;
}

export interface RolePermission {
  id?: string;
  roleName: string;
  moduleKey: string;
  canView: boolean;
  canEdit: boolean;
}

export type PermissionMatrix = Record<string, { canView: boolean; canEdit: boolean }>;

// Comprehensive list of all core system roles for Role Permission & Access Manager
const SEED_CUSTOM_ROLES: CustomRole[] = [
  {
    id: 'role-admin',
    name: UserRole.ADMIN,
    displayName: 'System Admin',
    color: 'bg-error/10 text-error border-error/20',
    description: 'Full unrestricted platform access, user administration, security controls, fleet and system settings',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-itp-manager',
    name: UserRole.ITP_MANAGER,
    displayName: 'ITP Manager',
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Into-plane operations management, staff allocation, schedule oversight and performance metrics',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-depot-manager',
    name: UserRole.DEPOT_MANAGER,
    displayName: 'Depot Manager',
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Fuel farm oversight, tank inventory reconciliation, vessel receipt and bridging supervision',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-itp-supervisor',
    name: UserRole.ITP_SUPERVISOR,
    displayName: 'ITP Supervisor',
    color: 'bg-success/10 text-success border-success/20',
    description: 'Airside shift supervision, job dispatch verification, safety checks and team coordination',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-itp-officer',
    name: UserRole.ITP_OFFICER,
    displayName: 'ITP Officer',
    color: 'bg-warning/10 text-warning border-warning/20',
    description: 'Refueling operations coordination, delivery ticket issuance and flight schedule monitoring',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-itp-operator',
    name: UserRole.ITP_OPERATOR,
    displayName: 'ITP Operator',
    color: 'bg-success/10 text-success border-success/20',
    description: 'Refueller vehicle driver and fueling technician for commercial and ad-hoc aircraft',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-itp-hd-operator',
    name: UserRole.ITP_HD_OPERATOR,
    displayName: 'HD Operator',
    color: 'bg-success/10 text-success border-success/20',
    description: 'Hydrant Dispenser pit connection specialist and high-flow widebody aircraft refueling technician',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-depot-operator',
    name: UserRole.DEPOT_OPERATOR,
    displayName: 'Depot Operator',
    color: 'bg-success/10 text-success border-success/20',
    description: 'Fuel storage technician, tank dipping, pump manifold operation, filtration and bridging loading',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-fuel-mgmt',
    name: UserRole.FUEL_MANAGEMENT,
    displayName: 'Fuel Management',
    color: 'bg-warning/10 text-warning border-warning/20',
    description: 'Overall fuel supply chain analytics, daily reconciliation, performance KPIs and forecasting',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-executive',
    name: UserRole.EXECUTIVE,
    displayName: 'Executive',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    description: 'Airport executive leadership dashboard, revenue insights, route consumption and high-level trends',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-commercial',
    name: UserRole.COMMERCIAL,
    displayName: 'Commercial',
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    description: 'Airline contract pricing, uplift volumes, commercial route analytics and airline accounts',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-finance',
    name: UserRole.FINANCE,
    displayName: 'Finance Manager',
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Billing statements, customer credit limits, monthly invoice consolidation and payment auditing',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-customer',
    name: UserRole.CUSTOMER,
    displayName: 'Aviation Customer',
    color: 'bg-success/10 text-success border-success/20',
    description: 'Airline representative access to view delivery tickets, fuel receipts and sign-off records',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-macl-mgmt',
    name: UserRole.MACL_MANAGEMENT,
    displayName: 'MACL Management',
    color: 'bg-primary/10 text-primary border-primary/20',
    description: 'Airport management executive oversight, flight schedules, commercial reporting and high-level fuel data',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role-fuel-admin',
    name: UserRole.FUEL_ADMINISTRATION,
    displayName: 'Fuel Administration',
    color: 'bg-warning/10 text-warning border-warning/20',
    description: 'Fuel section operational coordinator with access to schedules, into-plane ops, equipment, stock and reports',
    isSystemRole: true,
    createdAt: new Date().toISOString()
  }
];

// Default permissions for all core system roles
const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionMatrix> = {
  [UserRole.ADMIN]: {
    dashboard: { canView: true, canEdit: true },
    schedule: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    stock: { canView: true, canEdit: true },
    bridging: { canView: true, canEdit: true },
    'marine-loading': { canView: true, canEdit: true },
    marine: { canView: true, canEdit: true },
    seaplane: { canView: true, canEdit: true },
    'lfs-afs': { canView: true, canEdit: true },
    performance: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
    'commercial-reports': { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: true },
    executive: { canView: true, canEdit: true },
    finance: { canView: true, canEdit: true },
    'customer-portal': { canView: true, canEdit: true },
    'staff-tracker': { canView: true, canEdit: true },
    'system-admin': { canView: true, canEdit: true },
  },
  [UserRole.ITP_MANAGER]: {
    dashboard: { canView: true, canEdit: true },
    'staff-tracker': { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    schedule: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
    performance: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
  },
  [UserRole.DEPOT_MANAGER]: {
    dashboard: { canView: true, canEdit: true },
    stock: { canView: true, canEdit: true },
    bridging: { canView: true, canEdit: true },
    'marine-loading': { canView: true, canEdit: true },
    seaplane: { canView: true, canEdit: true },
    'lfs-afs': { canView: true, canEdit: true },
    marine: { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
  },
  [UserRole.ITP_SUPERVISOR]: {
    dashboard: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
  },
  [UserRole.ITP_OFFICER]: {
    dashboard: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    schedule: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
  },
  [UserRole.ITP_OPERATOR]: {
    dashboard: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
  },
  [UserRole.ITP_HD_OPERATOR]: {
    dashboard: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
  },
  [UserRole.DEPOT_OPERATOR]: {
    dashboard: { canView: true, canEdit: true },
    stock: { canView: true, canEdit: true },
    bridging: { canView: true, canEdit: true },
    'marine-loading': { canView: true, canEdit: true },
    seaplane: { canView: true, canEdit: true },
    'lfs-afs': { canView: true, canEdit: true },
    marine: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
  },
  [UserRole.FUEL_MANAGEMENT]: {
    dashboard: { canView: true, canEdit: true },
    briefing: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    history: { canView: true, canEdit: true },
    performance: { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
    executive: { canView: true, canEdit: true },
    'commercial-reports': { canView: true, canEdit: true },
    finance: { canView: true, canEdit: true },
  },
  [UserRole.EXECUTIVE]: {
    dashboard: { canView: true, canEdit: false },
    executive: { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: false },
    'depot-reports': { canView: true, canEdit: false },
    'commercial-reports': { canView: true, canEdit: false },
    finance: { canView: true, canEdit: false },
  },
  [UserRole.COMMERCIAL]: {
    'commercial-reports': { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
    finance: { canView: true, canEdit: true },
  },
  [UserRole.FINANCE]: {
    finance: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
  },
  [UserRole.CUSTOMER]: {
    'customer-portal': { canView: true, canEdit: false },
  },
  [UserRole.MACL_MANAGEMENT]: {
    dashboard: { canView: true, canEdit: false },
    schedule: { canView: true, canEdit: false },
    executive: { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: false },
    'depot-reports': { canView: true, canEdit: false },
    'commercial-reports': { canView: true, canEdit: true },
    history: { canView: true, canEdit: false }
  },
  [UserRole.FUEL_ADMINISTRATION]: {
    dashboard: { canView: true, canEdit: true },
    schedule: { canView: true, canEdit: true },
    intoplane: { canView: true, canEdit: true },
    equipment: { canView: true, canEdit: true },
    stock: { canView: true, canEdit: false },
    history: { canView: true, canEdit: true },
    performance: { canView: true, canEdit: true },
    'depot-reports': { canView: true, canEdit: true },
    forecasting: { canView: true, canEdit: false }
  }
};

class RoleService {
  private getLocalRoles(): CustomRole[] {
    try {
      const stored = localStorage.getItem('fms_custom_roles_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, CustomRole>();
          SEED_CUSTOM_ROLES.forEach(s => map.set(s.name, s));
          parsed.forEach((p: CustomRole) => map.set(p.name, { ...map.get(p.name), ...p }));
          return Array.from(map.values());
        }
      }
    } catch {}
    return SEED_CUSTOM_ROLES;
  }

  private saveLocalRoles(roles: CustomRole[]): void {
    try {
      localStorage.setItem('fms_custom_roles_v1', JSON.stringify(roles));
    } catch {}
  }

  private getLocalPermissions(): Record<string, PermissionMatrix> {
    try {
      const stored = localStorage.getItem('fms_role_permissions_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
        }
      }
    } catch {}
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }

  private saveLocalPermissions(permissions: Record<string, PermissionMatrix>): void {
    try {
      localStorage.setItem('fms_role_permissions_v1', JSON.stringify(permissions));
    } catch {}
  }

  /**
   * Fetch all roles (combines Supabase with local fallback)
   */
  async getRoles(): Promise<CustomRole[]> {
    try {
      const { data, error } = await supabase.from('custom_roles').select('*').order('created_at');
      if (!error && data && data.length > 0) {
        const mapped: CustomRole[] = data.map(r => ({
          id: r.id,
          name: r.name,
          displayName: r.display_name,
          color: r.color,
          description: r.description,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          isSystemRole: Object.values(UserRole).includes(r.name as UserRole)
        }));

        // Merge with all seed roles so system roles are always present
        const map = new Map<string, CustomRole>();
        SEED_CUSTOM_ROLES.forEach(seed => map.set(seed.name, seed));
        mapped.forEach(m => map.set(m.name, { ...map.get(m.name), ...m }));

        const merged = Array.from(map.values());
        this.saveLocalRoles(merged);
        return merged;
      }
    } catch (err) {
      console.warn('[RoleService] Supabase getRoles warning, using local fallback:', err);
    }
    return this.getLocalRoles();
  }

  /**
   * Fetch permissions matrix for a specific role
   */
  async getPermissionsForRole(roleName: string): Promise<PermissionMatrix> {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_name', roleName);

      if (!error && data && data.length > 0) {
        const matrix: PermissionMatrix = {};
        data.forEach(p => {
          matrix[p.module_key] = { canView: !!p.can_view, canEdit: !!p.can_edit };
        });
        const allLocal = this.getLocalPermissions();
        allLocal[roleName] = matrix;
        this.saveLocalPermissions(allLocal);
        return matrix;
      }
    } catch (err) {
      console.warn('[RoleService] Supabase getPermissions warning, using local fallback:', err);
    }

    const localAll = this.getLocalPermissions();
    return localAll[roleName] || DEFAULT_ROLE_PERMISSIONS[roleName] || {};
  }

  /**
   * Create or update a role and its module permissions
   */
  async saveRole(
    roleData: { id?: string; name: string; displayName: string; color?: string; description?: string },
    permissions: PermissionMatrix,
    authorName = 'System Admin'
  ): Promise<CustomRole> {
    const formattedName = roleData.name.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const existingRoles = this.getLocalRoles();
    const existingIndex = existingRoles.findIndex(r => r.name === formattedName || (roleData.id && r.id === roleData.id));

    const roleRecord: CustomRole = {
      id: roleData.id || `cr-${Date.now()}`,
      name: formattedName,
      displayName: roleData.displayName.trim(),
      color: roleData.color || 'bg-primary/10 text-primary border-primary/20',
      description: roleData.description?.trim() || '',
      createdBy: authorName,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex !== -1 ? existingRoles[existingIndex].createdAt : new Date().toISOString(),
      isSystemRole: Object.values(UserRole).includes(formattedName as UserRole)
    };

    if (existingIndex !== -1) {
      existingRoles[existingIndex] = roleRecord;
    } else {
      existingRoles.push(roleRecord);
    }
    this.saveLocalRoles(existingRoles);

    // Save permissions locally
    const allLocalPerms = this.getLocalPermissions();
    allLocalPerms[formattedName] = permissions;
    this.saveLocalPermissions(allLocalPerms);

    // Try Supabase sync
    try {
      const payloadRole = {
        name: roleRecord.name,
        display_name: roleRecord.displayName,
        color: roleRecord.color,
        description: roleRecord.description,
        created_by: authorName,
        updated_at: new Date().toISOString()
      };
      await supabase.from('custom_roles').upsert([payloadRole], { onConflict: 'name' });

      // Upsert permissions rows
      const permRows = Object.entries(permissions).map(([moduleKey, perm]) => ({
        role_name: formattedName,
        module_key: moduleKey,
        can_view: perm.canView,
        can_edit: perm.canEdit,
        updated_at: new Date().toISOString()
      }));

      if (permRows.length > 0) {
        await supabase.from('role_permissions').upsert(permRows, { onConflict: 'role_name,module_key' });
      }
    } catch (e) {
      console.warn('[RoleService] Supabase saveRole offline fallback active:', e);
    }

    return roleRecord;
  }

  /**
   * Delete a custom role
   */
  async deleteRole(roleName: string): Promise<void> {
    const roles = this.getLocalRoles().filter(r => r.name !== roleName);
    this.saveLocalRoles(roles);

    const allPerms = this.getLocalPermissions();
    delete allPerms[roleName];
    this.saveLocalPermissions(allPerms);

    try {
      await supabase.from('custom_roles').delete().eq('name', roleName);
      await supabase.from('role_permissions').delete().eq('role_name', roleName);
    } catch (e) {
      console.warn('[RoleService] Supabase deleteRole offline fallback active:', e);
    }
  }
}

export const roleService = new RoleService();
