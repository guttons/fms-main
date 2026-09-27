import { supabase } from '../supabase';
import { SystemActivityLog, User, StaffMember } from '../types';

export const LogModule = {
  AUTH: 'AUTH',
  STAFF: 'STAFF',
  EQUIPMENT: 'EQUIPMENT',
  TANKS: 'TANKS',
  VESSELS: 'VESSELS',
  FLIGHT_JOBS: 'FLIGHT_JOBS',
  FLIGHT_LOG: 'FLIGHT_LOG',
  DELAY_LOG: 'DELAY_LOG',
  SHIFT_BRIEFING: 'SHIFT_BRIEFING',
  FINANCE: 'FINANCE',
  SCHEDULE: 'SCHEDULE',
  FLIGHT_MASTER: 'FLIGHT_MASTER',
  SYSTEM_SETTINGS: 'SYSTEM_SETTINGS',
  INTO_PLANE: 'INTO_PLANE',
  BRIDGING: 'BRIDGING',
  TANKER_DISCHARGE: 'TANKER_DISCHARGE',
  STOCK: 'STOCK',
  SEAPLANE: 'SEAPLANE',
} as const;

export type LogModuleType = typeof LogModule[keyof typeof LogModule];

export const LogAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  ASSIGN: 'ASSIGN',
  UNASSIGN: 'UNASSIGN',
  START_JOB: 'START_JOB',
  COMPLETE_JOB: 'COMPLETE_JOB',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  SYNC: 'SYNC',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
} as const;

export type LogActionType = typeof LogAction[keyof typeof LogAction];

export interface LogActionPayload {
  module: LogModuleType | string;
  action: LogActionType | string;
  entity_type?: string;
  entity_id?: string;
  entity_label?: string;
  description: string;
  before_state?: Record<string, any> | null;
  after_state?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

// Generate or retrieve persistent browser session ID
function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('fms_session_id');
    if (!sid) {
      sid = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('fms_session_id', sid);
    }
    return sid;
  } catch {
    return `sess-${Date.now()}`;
  }
}

// Local cache helper
const LOCAL_STORAGE_KEY = 'fms_system_activity_logs';
function getLocalLogs(): SystemActivityLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLog(entry: SystemActivityLog) {
  try {
    const existing = getLocalLogs();
    const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, 500);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fms:activity-logged', { detail: entry }));
    }
  } catch (e) {
    console.warn('[ActivityLog] Local persistence warning:', e);
  }
}

let tableChecked = false;
let tableExistsInSupabase = true;

export const activityLogService = {
  /**
   * Check whether the dedicated system_activity_log table exists in Supabase.
   */
  async checkTableStatus(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_activity_log')
        .select('id')
        .limit(1);
      if (error && (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist'))) {
        tableExistsInSupabase = false;
        tableChecked = true;
        return false;
      }
      tableExistsInSupabase = true;
      tableChecked = true;
      return true;
    } catch {
      tableExistsInSupabase = false;
      tableChecked = true;
      return false;
    }
  },

  /**
   * Log an activity anywhere in the system.
   * This is guaranteed to be non-blocking and will never throw.
   */
  async logAction(
    user: User | StaffMember | { id: string; name: string; role: string; employeeId?: string } | null | undefined,
    payload: LogActionPayload
  ): Promise<SystemActivityLog | null> {
    // If no user context provided, attempt fallback from active session
    let currentUser = user;
    if (!currentUser) {
      try {
        const stored = localStorage.getItem('fms_logged_in_user');
        if (stored) currentUser = JSON.parse(stored);
      } catch {}
    }

    if (!currentUser) {
      // System background action
      currentUser = {
        id: 'SYSTEM',
        name: 'System Automation',
        role: 'SYSTEM',
        employeeId: 'SYS'
      };
    }

    const empId = (currentUser as any).employeeId || (currentUser as any).employee_id || null;
    const entryId = `sal-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const fullLog: SystemActivityLog = {
      id: entryId,
      user_id: currentUser.id || 'UNKNOWN',
      user_name: currentUser.name || 'Unknown User',
      user_role: currentUser.role || 'UNKNOWN',
      employee_id: empId,
      module: payload.module,
      action: payload.action,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      entity_label: payload.entity_label || null,
      description: payload.description,
      before_state: payload.before_state || null,
      after_state: payload.after_state || null,
      metadata: payload.metadata || null,
      session_id: getSessionId(),
      ip_address: null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      created_at: now
    };

    // 1. Immediately save to local high-speed cache
    saveLocalLog(fullLog);

    // 2. Insert into Supabase
    try {
      const { data, error } = await supabase
        .from('system_activity_log')
        .insert([{
          user_id: fullLog.user_id,
          user_name: fullLog.user_name,
          user_role: fullLog.user_role,
          employee_id: fullLog.employee_id,
          module: fullLog.module,
          action: fullLog.action,
          entity_type: fullLog.entity_type,
          entity_id: fullLog.entity_id,
          entity_label: fullLog.entity_label,
          description: fullLog.description,
          before_state: fullLog.before_state,
          after_state: fullLog.after_state,
          metadata: fullLog.metadata,
          session_id: fullLog.session_id,
          user_agent: fullLog.user_agent,
          created_at: fullLog.created_at
        }])
        .select();

      if (error) {
        // Fallback to staff_activity_log if table does not exist yet
        if (error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          tableExistsInSupabase = false;
          await (supabase.from('staff_activity_log').insert([{
            staff_id: fullLog.user_id,
            activity_type: `[${fullLog.module}] ${fullLog.action}`,
            activity_data: {
              ...fullLog,
              _system_audit: true
            }
          }] as any) as any).catch(() => {});
        } else {
          console.warn('[ActivityLog] Supabase insert note:', error.message);
        }
      } else if (data && data[0]?.id) {
        fullLog.id = data[0].id;
        tableExistsInSupabase = true;
      }
    } catch (err) {
      console.warn('[ActivityLog] Network save fallback:', err);
    }

    return fullLog;
  },

  /**
   * Fetch activity logs with full pagination and multi-parameter filters.
   */
  async getActivityLogs(filters?: {
    page?: number;
    limit?: number;
    module?: string;
    action?: string;
    userId?: string;
    searchTerm?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: SystemActivityLog[]; totalCount: number; isSupabaseConnected: boolean }> {
    const page = filters?.page || 0;
    const limit = filters?.limit || 50;
    const offset = page * limit;

    // Check table existence first
    const isTableReady = tableChecked ? tableExistsInSupabase : await this.checkTableStatus();

    if (isTableReady) {
      try {
        let query = supabase
          .from('system_activity_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });

        if (filters?.module && filters.module !== 'ALL') {
          query = query.eq('module', filters.module);
        }
        if (filters?.action && filters.action !== 'ALL') {
          query = query.eq('action', filters.action);
        }
        if (filters?.userId && filters.userId !== 'ALL') {
          query = query.or(`user_id.eq.${filters.userId},employee_id.eq.${filters.userId}`);
        }
        if (filters?.startDate) {
          query = query.gte('created_at', `${filters.startDate}T00:00:00Z`);
        }
        if (filters?.endDate) {
          query = query.lte('created_at', `${filters.endDate}T23:59:59Z`);
        }
        if (filters?.searchTerm && filters.searchTerm.trim()) {
          const s = filters.searchTerm.trim();
          query = query.or(`description.ilike.%${s}%,entity_label.ilike.%${s}%,user_name.ilike.%${s}%,employee_id.ilike.%${s}%`);
        }

        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (!error && data) {
          return {
            logs: data as SystemActivityLog[],
            totalCount: count || data.length,
            isSupabaseConnected: true
          };
        }
      } catch (e) {
        console.warn('[ActivityLog] Direct query failed, falling back to cache:', e);
      }
    }

    // Fallback: Query from staff_activity_log + local cache
    let combinedLogs: SystemActivityLog[] = [...getLocalLogs()];

    try {
      const { data: staffData, error: staffErr } = await supabase
        .from('staff_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!staffErr && staffData) {
        staffData.forEach((row: any) => {
          if (row.activity_data?._system_audit) {
            combinedLogs.push({
              ...row.activity_data,
              id: row.id,
              created_at: row.created_at
            });
          } else {
            // General staff activity entry
            combinedLogs.push({
              id: row.id,
              user_id: row.staff_id,
              user_name: row.activity_data?.userName || row.staff_id,
              user_role: row.activity_data?.role || 'STAFF',
              employee_id: row.staff_id,
              module: LogModule.AUTH,
              action: row.activity_type,
              entity_type: 'staff_session',
              entity_id: row.staff_id,
              entity_label: row.staff_id,
              description: `Staff activity: ${row.activity_type} (${JSON.stringify(row.activity_data || {})})`,
              before_state: null,
              after_state: row.activity_data || null,
              metadata: null,
              session_id: null,
              ip_address: null,
              user_agent: null,
              created_at: row.created_at
            });
          }
        });
      }
    } catch {}

    // Deduplicate combined logs by ID
    const uniqueMap = new Map<string, SystemActivityLog>();
    combinedLogs.forEach(item => {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    let filtered = Array.from(uniqueMap.values());

    // Sort descending
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply filters
    if (filters?.module && filters.module !== 'ALL') {
      filtered = filtered.filter(l => l.module === filters.module);
    }
    if (filters?.action && filters.action !== 'ALL') {
      filtered = filtered.filter(l => l.action === filters.action);
    }
    if (filters?.userId && filters.userId !== 'ALL') {
      filtered = filtered.filter(l => l.user_id === filters.userId || l.employee_id === filters.userId);
    }
    if (filters?.startDate) {
      const start = new Date(`${filters.startDate}T00:00:00Z`).getTime();
      filtered = filtered.filter(l => new Date(l.created_at).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(`${filters.endDate}T23:59:59Z`).getTime();
      filtered = filtered.filter(l => new Date(l.created_at).getTime() <= end);
    }
    if (filters?.searchTerm && filters.searchTerm.trim()) {
      const s = filters.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(l =>
        (l.description || '').toLowerCase().includes(s) ||
        (l.entity_label || '').toLowerCase().includes(s) ||
        (l.user_name || '').toLowerCase().includes(s) ||
        (l.employee_id || '').toLowerCase().includes(s)
      );
    }

    const totalCount = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      totalCount,
      isSupabaseConnected: isTableReady
    };
  },

  /**
   * Realtime subscription for live streaming in System Admin Activity Log tab.
   */
  subscribeToLogs(onNewLog: (log: SystemActivityLog) => void) {
    const channelName = `sys_act_log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_activity_log' },
        payload => {
          if (payload.new) {
            onNewLog(payload.new as SystemActivityLog);
          }
        }
      )
      .subscribe();

    // Also listen for local events (e.g. cross-tab or immediate optimistic)
    const handleLocalEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) onNewLog(detail);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('fms:activity-logged', handleLocalEvent);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('fms:activity-logged', handleLocalEvent);
      }
    };
  },

  /**
   * Export activity logs to CSV file for auditing and regulatory inspection.
   */
  exportToCSV(logs: SystemActivityLog[], filenamePrefix = 'fms_activity_audit') {
    if (!logs || logs.length === 0) return;

    const headers = [
      'Timestamp (UTC)',
      'Timestamp (Local)',
      'Module',
      'Action',
      'Personnel Name',
      'RC / Employee ID',
      'Role',
      'Entity Type',
      'Entity ID',
      'Entity Label',
      'Description',
      'Session ID',
      'User Agent'
    ];

    const rows = logs.map(l => [
      l.created_at,
      new Date(l.created_at).toLocaleString(),
      l.module,
      l.action,
      l.user_name,
      l.employee_id || '',
      l.user_role,
      l.entity_type || '',
      l.entity_id || '',
      l.entity_label || '',
      l.description.replace(/"/g, '""'),
      l.session_id || '',
      (l.user_agent || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
