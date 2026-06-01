import { supabase } from '../supabase';
import { User, Tank, FlightLog, BridgingLog, Alert, FlightJob, Equipment, StaffMember, UserRole, EquipmentStatus } from '../types';
import { TANKS, MOCK_USERS, MOCK_JOBS, EQUIPMENT } from '../constants';

const localBridgingLogs: BridgingLog[] = [
  {
    id: 'mock-bl-1',
    sourceTankId: 'tk101',
    vehicleId: 'RF-02',
    volume: 15000,
    startTime: '08:30',
    endTime: '09:00',
    visualCheckPassed: true,
    cwdCheckPassed: true,
    density: 0.8005,
    temperature: 24.5,
    operatorId: 'System Admin',
    date: new Date().toISOString().split('T')[0]
  },
  {
    id: 'mock-bl-2',
    sourceTankId: 'tk102',
    vehicleId: 'RF-04',
    volume: 18000,
    startTime: '09:45',
    endTime: '10:15',
    visualCheckPassed: true,
    cwdCheckPassed: true,
    density: 0.7998,
    temperature: 25.1,
    operatorId: 'System Admin',
    date: new Date().toISOString().split('T')[0]
  }
];

let localStaff: StaffMember[] = [];
let localEquipment: Equipment[] = [];
let localTanks: Tank[] = [];

const staffCallbacks = new Set<(staff: StaffMember[]) => void>();
const equipmentCallbacks = new Set<(eq: Equipment[]) => void>();
const tanksCallbacks = new Set<(tanks: Tank[]) => void>();

const triggerStaffCallbacks = () => {
  const list = [...localStaff];
  staffCallbacks.forEach(cb => {
    try { cb(list); } catch (e) { console.error('Error in staff callback:', e); }
  });
};

const triggerEquipmentCallbacks = () => {
  const list = [...localEquipment];
  equipmentCallbacks.forEach(cb => {
    try { cb(list); } catch (e) { console.error('Error in equipment callback:', e); }
  });
};

const triggerTanksCallbacks = () => {
  const list = [...localTanks];
  tanksCallbacks.forEach(cb => {
    try { cb(list); } catch (e) { console.error('Error in tank callback:', e); }
  });
};

export const supabaseService = {
  // ── Auth & Users ────────────────────────────────────────────────────────────
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.warn('[Supabase] getUsers failed, falling back to mocks:', error);
      return MOCK_USERS;
    }
    if (!data || data.length === 0) return MOCK_USERS;
    return data.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role as UserRole,
      avatar: row.avatar
    }));
  },

  // ── Tanks ───────────────────────────────────────────────────────────────────
  async getTanks(): Promise<Tank[]> {
    const { data, error } = await supabase.from('tanks').select('*').order('name');
    if (error) {
      console.warn('[Supabase] getTanks failed, falling back to static constants:', error);
      if (localTanks.length === 0) localTanks = TANKS;
      return localTanks;
    }
    if (!data || data.length === 0) {
      if (localTanks.length === 0) localTanks = TANKS;
      return localTanks;
    }
    localTanks = data.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      capacity: Number(row.capacity),
      currentLevel: Number(row.current_level),
      safeMinLevel: Number(row.safe_min_level),
      lastUpdated: row.last_updated
    } as Tank));
    return localTanks;
  },

  async updateTankLevel(id: string, newLevel: number): Promise<void> {
    const index = localTanks.findIndex(t => t.id === id);
    let original: Tank | null = null;
    if (index !== -1) {
      original = { ...localTanks[index] };
      localTanks[index] = { ...localTanks[index], currentLevel: newLevel, lastUpdated: new Date().toISOString() };
      triggerTanksCallbacks();
    }

    const { error } = await supabase.from('tanks').update({
      current_level: newLevel,
      last_updated: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      if (index !== -1 && original) {
        localTanks[index] = original;
        triggerTanksCallbacks();
      }
      console.error('[Supabase] updateTankLevel failed:', error);
    }
  },

  subscribeToTanks(callback: (tanks: Tank[]) => void) {
    const channel = supabase
      .channel('tanks-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tanks' },
        async () => {
          const tanks = await supabaseService.getTanks();
          callback(tanks);
        }
      )
      .subscribe();

    supabaseService.getTanks().then(callback);
    tanksCallbacks.add(callback);

    return () => {
      supabase.removeChannel(channel);
      tanksCallbacks.delete(callback);
    };
  },

  async addTank(tank: Omit<Tank, 'id' | 'lastUpdated'>): Promise<void> {
    const cleanId = tank.name.toUpperCase().trim();
    const newTank: Tank = {
      id: cleanId,
      ...tank,
      name: cleanId,
      lastUpdated: new Date().toISOString()
    };
    localTanks.push(newTank);
    triggerTanksCallbacks();

    const row = {
      id: cleanId,
      name: cleanId,
      type: tank.type,
      capacity: tank.capacity,
      current_level: tank.currentLevel,
      safe_min_level: tank.safeMinLevel,
    };
    const { error } = await supabase.from('tanks').insert([row]);
    if (error) {
      localTanks = localTanks.filter(t => t.id !== cleanId);
      triggerTanksCallbacks();
      console.error('[Supabase] addTank failed:', error);
      throw error;
    }
  },

  async updateTank(id: string, updates: Partial<Omit<Tank, 'id'>>): Promise<void> {
    const index = localTanks.findIndex(t => t.id === id);
    let original: Tank | null = null;
    if (index !== -1) {
      original = { ...localTanks[index] };
      localTanks[index] = { ...localTanks[index], ...updates, lastUpdated: new Date().toISOString() };
      triggerTanksCallbacks();
    }

    const row: Record<string, any> = {
      last_updated: new Date().toISOString()
    };
    if ('name' in updates) row.name = updates.name;
    if ('type' in updates) row.type = updates.type;
    if ('capacity' in updates) row.capacity = updates.capacity;
    if ('currentLevel' in updates) row.current_level = updates.currentLevel;
    if ('safeMinLevel' in updates) row.safe_min_level = updates.safeMinLevel;

    const { error } = await supabase.from('tanks').update(row).eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localTanks[index] = original;
        triggerTanksCallbacks();
      }
      console.error('[Supabase] updateTank failed:', error);
      throw error;
    }
  },

  async deleteTank(id: string): Promise<void> {
    const index = localTanks.findIndex(t => t.id === id);
    let original: Tank | null = null;
    if (index !== -1) {
      original = { ...localTanks[index] };
      localTanks.splice(index, 1);
      triggerTanksCallbacks();
    }

    const { error } = await supabase.from('tanks').delete().eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localTanks.splice(index, 0, original);
        triggerTanksCallbacks();
      }
      console.error('[Supabase] deleteTank failed:', error);
      throw error;
    }
  },

  // ── Flight Jobs ─────────────────────────────────────────────────────────────
  async getFlightJobs(): Promise<FlightJob[]> {
    const { data, error } = await supabase.from('flight_jobs').select('*');
    if (error) {
      console.warn('[Supabase] getFlightJobs failed, falling back to mocks:', error);
      return MOCK_JOBS;
    }
    if (!data || data.length === 0) return MOCK_JOBS;
    return data.map(row => ({
      id: row.id,
      flightNumber: row.flight_number,
      aircraftReg: row.aircraft_reg,
      aircraftType: row.aircraft_type,
      stand: row.stand,
      sta: row.sta,
      eta: row.eta,
      std: row.std,
      assignedTo: row.assigned_to,
      assignedOfficer: row.assigned_officer,
      equipmentUsage: row.equipment_usage,
      status: row.status,
      vehicleId: row.vehicle_id,
      remarks: row.remarks,
      deliveryNumber: row.delivery_number,
      pitNumber: row.pit_number
    } as FlightJob));
  },

  // ── BigQuery Cloud Run API Helper & Operations Logs ────────────────────────
  _bqBase(): string {
    return (
      import.meta.env.VITE_BIGQUERY_API_URL ||
      'http://localhost:8080'
    );
  },

  async _bqAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        console.warn(
          '[BigQuery] No active Supabase session found. The Authorization header is empty. ' +
          'Please ensure that "Anonymous Sign-ins" are enabled in your Supabase Dashboard (Authentication > Providers > Anonymous).'
        );
      }
    } catch (e) {
      console.warn('[BigQuery] Could not get Supabase access token:', e);
    }
    return headers;
  },

  async getFlightLogs(): Promise<FlightLog[]> {
    console.log('[BigQuery API] GET /operations-log');
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/operations-log`, { headers });
      if (!res.ok) throw new Error(`BigQuery GET failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return data.logs as FlightLog[];
    } catch (error) {
      console.error('[BigQuery] getFlightLogs error:', error);
      return [];
    }
  },

  async createFlightLog(log: Omit<FlightLog, 'id'>): Promise<void> {
    console.log('[BigQuery API] POST /operations-log');
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/operations-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error(`BigQuery POST failed: ${res.status} ${await res.text()}`);
    } catch (error) {
      console.error('[BigQuery] createFlightLog error:', error);
      throw error;
    }
  },

  async updateFlightLog(id: string, updates: Partial<FlightLog>): Promise<void> {
    console.log(`[BigQuery API] PATCH /operations-log/${id}`);
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/operations-log/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`BigQuery PATCH failed: ${res.status} ${await res.text()}`);
    } catch (error) {
      console.error('[BigQuery] updateFlightLog error:', error);
      throw error;
    }
  },

  async deleteFlightLog(id: string): Promise<void> {
    console.log(`[BigQuery API] DELETE /operations-log/${id}`);
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/operations-log/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`BigQuery DELETE failed: ${res.status} ${await res.text()}`);
    } catch (error) {
      console.error('[BigQuery] deleteFlightLog error:', error);
      throw error;
    }
  },

  // ── Bridging Logs ──────────────────────────────────────────────────────────
  async getBridgingLogs(): Promise<BridgingLog[]> {
    const { data, error } = await supabase
      .from('bridging_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] getBridgingLogs failed, falling back to localBridgingLogs:', error);
      return localBridgingLogs;
    }
    if (!data || data.length === 0) return localBridgingLogs;
    return data.map(row => ({
      id: row.id,
      sourceTankId: row.source_tank_id,
      vehicleId: row.vehicle_id,
      volume: Number(row.volume),
      startTime: row.start_time,
      endTime: row.end_time,
      visualCheckPassed: row.visual_check_passed,
      cwdCheckPassed: row.cwd_check_passed,
      density: row.density ? Number(row.density) : undefined,
      temperature: row.temperature ? Number(row.temperature) : undefined,
      operatorId: row.operator_id,
      date: row.date
    } as BridgingLog));
  },

  async createBridgingLog(log: Omit<BridgingLog, 'id'>): Promise<void> {
    const row = {
      source_tank_id: log.sourceTankId,
      vehicle_id: log.vehicleId,
      volume: log.volume,
      start_time: log.startTime,
      end_time: log.endTime,
      visual_check_passed: log.visualCheckPassed,
      cwd_check_passed: log.cwdCheckPassed,
      density: log.density ?? null,
      temperature: log.temperature ?? null,
      operator_id: log.operatorId,
      date: log.date || new Date().toISOString().split('T')[0]
    };

    const id = `bl-${Date.now()}`;
    localBridgingLogs.unshift({ id, ...log });

    const { error } = await supabase.from('bridging_logs').insert([row]);
    if (error) {
      console.error('[Supabase] createBridgingLog failed:', error);
    }
  },

  // ── Alerts ──────────────────────────────────────────────────────────────────
  async getAlerts(): Promise<Alert[]> {
    const { data, error } = await supabase.from('alerts').select('*').order('timestamp', { ascending: false });
    if (error) {
      console.error('[Supabase] getAlerts failed:', error);
      return [];
    }
    if (!data || data.length === 0) return [];
    return data.map(row => ({
      id: row.id,
      severity: row.severity,
      message: row.message,
      // Convert stored ISO timestamp to a human-readable HH:MM string for the UI
      timestamp: row.timestamp
        ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : row.timestamp,
      acknowledged: row.acknowledged,
      targetRole: row.target_role
    } as Alert));
  },

  subscribeToAlerts(callback: (alerts: Alert[]) => void) {
    const channel = supabase
      .channel('alerts-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        async () => {
          const alerts = await supabaseService.getAlerts();
          callback(alerts);
        }
      )
      .subscribe();

    supabaseService.getAlerts().then(callback);

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async acknowledgeAlert(id: string): Promise<void> {
    const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
    if (error) {
      console.error('[Supabase] acknowledgeAlert failed:', error);
    }
  },

  async acknowledgeAllAlerts(ids: string[]): Promise<void> {
    const { error } = await supabase.from('alerts').update({ acknowledged: true }).in('id', ids);
    if (error) {
      console.error('[Supabase] acknowledgeAllAlerts failed:', error);
    }
  },

  async createAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    const row = {
      severity: alert.severity,
      message: alert.message,
      // Always use a full ISO 8601 timestamp for the DB column (timestamptz).
      // The caller may pass a display-only HH:MM string which is invalid for Postgres.
      timestamp: new Date().toISOString(),
      acknowledged: alert.acknowledged,
      target_role: alert.targetRole || null
    };
    const { error } = await supabase.from('alerts').insert([row]);
    if (error) {
      console.error('[Supabase] createAlert failed:', error);
    }
  },

  async checkActiveReplenishRequest(eqId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('alerts')
      .select('id')
      .eq('acknowledged', false)
      .eq('message', `Replenishment requested for unit ${eqId}`);

    if (error) {
      console.error('[Supabase] checkActiveReplenishRequest failed:', error);
      return false;
    }
    return (data || []).length > 0;
  },

  // ── Equipment ───────────────────────────────────────────────────────────────
  async getEquipment(): Promise<Equipment[]> {
    const { data, error } = await supabase.from('equipment').select('*').order('name');
    if (error) {
      console.warn('[Supabase] getEquipment failed, falling back to static constants:', error);
      if (localEquipment.length === 0) localEquipment = EQUIPMENT;
      return localEquipment;
    }
    if (!data || data.length === 0) {
      if (localEquipment.length === 0) localEquipment = EQUIPMENT;
      return localEquipment;
    }
    localEquipment = data.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      currentVolume: Number(row.current_volume),
      maxCapacity: Number(row.max_capacity),
      lastUpdated: row.last_updated,
      maintenanceDetails: row.maintenance_details
    } as Equipment));
    return localEquipment;
  },

  async updateEquipmentStatus(id: string, status: EquipmentStatus): Promise<void> {
    const index = localEquipment.findIndex(e => e.id === id);
    let original: Equipment | null = null;
    if (index !== -1) {
      original = { ...localEquipment[index] };
      localEquipment[index] = { ...localEquipment[index], status, lastUpdated: new Date().toISOString() };
      triggerEquipmentCallbacks();
    }

    const { error } = await supabase.from('equipment').update({
      status: status,
      last_updated: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      if (index !== -1 && original) {
        localEquipment[index] = original;
        triggerEquipmentCallbacks();
      }
      console.error('[Supabase] updateEquipmentStatus failed:', error);
    }
  },

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<void> {
    const index = localEquipment.findIndex(e => e.id === id);
    let original: Equipment | null = null;
    if (index !== -1) {
      original = { ...localEquipment[index] };
      localEquipment[index] = { ...localEquipment[index], ...updates, lastUpdated: new Date().toISOString() };
      triggerEquipmentCallbacks();
    }

    const row: Record<string, any> = {
      last_updated: new Date().toISOString()
    };
    if ('name' in updates) row.name = updates.name;
    if ('type' in updates) row.type = updates.type;
    if ('status' in updates) row.status = updates.status;
    if ('currentVolume' in updates) row.current_volume = updates.currentVolume;
    if ('maxCapacity' in updates) row.max_capacity = updates.maxCapacity;
    if ('maintenanceDetails' in updates) row.maintenance_details = updates.maintenanceDetails;

    const { error } = await supabase.from('equipment').update(row).eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localEquipment[index] = original;
        triggerEquipmentCallbacks();
      }
      console.error('[Supabase] updateEquipment failed:', error);
    }
  },

  subscribeToEquipment(callback: (equipment: Equipment[]) => void) {
    const channel = supabase
      .channel('equipment-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipment' },
        async () => {
          const equipment = await supabaseService.getEquipment();
          callback(equipment);
        }
      )
      .subscribe();

    supabaseService.getEquipment().then(callback);
    equipmentCallbacks.add(callback);

    return () => {
      supabase.removeChannel(channel);
      equipmentCallbacks.delete(callback);
    };
  },

  async addEquipment(eq: Omit<Equipment, 'id' | 'lastUpdated'>): Promise<void> {
    const cleanId = eq.name.toUpperCase().trim();
    const newEq: Equipment = {
      id: cleanId,
      ...eq,
      name: cleanId,
      lastUpdated: new Date().toISOString()
    };
    localEquipment.push(newEq);
    triggerEquipmentCallbacks();

    const row = {
      id: cleanId,
      name: cleanId,
      type: eq.type,
      status: eq.status,
      current_volume: eq.currentVolume,
      max_capacity: eq.maxCapacity,
      maintenance_details: eq.maintenanceDetails || null
    };
    const { error } = await supabase.from('equipment').insert([row]);
    if (error) {
      localEquipment = localEquipment.filter(e => e.id !== cleanId);
      triggerEquipmentCallbacks();
      console.error('[Supabase] addEquipment failed:', error);
      throw error;
    }
  },

  async deleteEquipment(id: string): Promise<void> {
    const index = localEquipment.findIndex(e => e.id === id);
    let original: Equipment | null = null;
    if (index !== -1) {
      original = { ...localEquipment[index] };
      localEquipment.splice(index, 1);
      triggerEquipmentCallbacks();
    }

    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localEquipment.splice(index, 0, original);
        triggerEquipmentCallbacks();
      }
      console.error('[Supabase] deleteEquipment failed:', error);
      throw error;
    }
  },

  // ── Domestic & Equipment Assignments ────────────────────────────────────────
  async getDomesticAssignments(date: string) {
    const { data, error } = await supabase
      .from('domestic_assignments')
      .select('*')
      .eq('assignment_date', date);

    if (error) {
      console.error('[Supabase] getDomesticAssignments failed:', error);
      return null;
    }
    return data;
  },

  async upsertDomesticAssignment(date: string, teamName: string, op1: string, op2: string) {
    const docId = `${date}_${teamName}`;
    const { error } = await supabase.from('domestic_assignments').upsert({
      id: docId,
      assignment_date: date,
      team_name: teamName,
      operator1_id: op1,
      operator2_id: op2
    });
    if (error) {
      console.error('[Supabase] upsertDomesticAssignment failed:', error);
    }
  },

  async getEquipmentAssignments(date: string, shiftType: string) {
    const { data, error } = await supabase
      .from('equipment_assignments')
      .select('*')
      .eq('assignment_date', date)
      .eq('shift_type', shiftType);

    if (error) {
      console.error('[Supabase] getEquipmentAssignments failed:', error);
      return null;
    }
    return data;
  },

  async upsertEquipmentAssignment(date: string, eqId: string, shiftType: string, op1: string, op2: string) {
    const docId = `${date}_${eqId}_${shiftType}`;
    const { error } = await supabase.from('equipment_assignments').upsert({
      id: docId,
      assignment_date: date,
      equipment_id: eqId,
      shift_type: shiftType,
      operator1_id: op1,
      operator2_id: op2
    });
    if (error) {
      console.error('[Supabase] upsertEquipmentAssignment failed:', error);
    }
  },

  // ── Shift Briefings ─────────────────────────────────────────────────────────
  async getShiftBriefingInfo(date: string, shift: string) {
    const docId = `${date}_${shift}`;
    const { data, error } = await supabase
      .from('shift_briefing_info')
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] getShiftBriefingInfo failed:', error);
      return { info: [], dieselNeeds: [], staffAssignments: null };
    }
    if (data) {
      return {
        info: data.info || [],
        dieselNeeds: data.diesel_needs || [],
        staffAssignments: data.staff_assignments || null
      };
    }
    return { info: [], dieselNeeds: [], staffAssignments: null };
  },

  async upsertShiftBriefingInfo(date: string, shift: string, info: any[], dieselNeeds: string[], staffAssignments: any) {
    const docId = `${date}_${shift}`;
    const { error } = await supabase.from('shift_briefing_info').upsert({
      id: docId,
      date: date,
      shift: shift,
      info: info,
      diesel_needs: dieselNeeds,
      staff_assignments: staffAssignments
    });
    if (error) {
      console.error('[Supabase] upsertShiftBriefingInfo failed:', error);
    }
  },

  // ── Staff (CRUD, Admin Panel) ───────────────────────────────────────────────
  subscribeToStaff(callback: (staff: StaffMember[]) => void) {
    const channel = supabase
      .channel('staff-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        async () => {
          const staff = await supabaseService.getStaff();
          callback(staff);
        }
      )
      .subscribe();

    supabaseService.getStaff().then(callback);
    staffCallbacks.add(callback);

    return () => {
      supabase.removeChannel(channel);
      staffCallbacks.delete(callback);
    };
  },

  async getStaff(): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (error) {
      console.warn('[Supabase] getStaff failed, falling back to mocks:', error);
      if (localStaff.length === 0) {
        localStaff = MOCK_USERS.map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          employeeId: `EMP-${u.id.toUpperCase()}`,
          status: 'active',
          joinDate: new Date().toISOString(),
          avatar: u.avatar
        }));
      }
      return localStaff;
    }
    if (!data || data.length === 0) {
      if (localStaff.length === 0) {
        localStaff = MOCK_USERS.map(u => ({
          id: u.id,
          name: u.name,
          role: u.role,
          employeeId: `EMP-${u.id.toUpperCase()}`,
          status: 'active',
          joinDate: new Date().toISOString(),
          avatar: u.avatar
        }));
      }
      return localStaff;
    }
    localStaff = data.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role as UserRole,
      employeeId: row.employee_id,
      phone: row.phone,
      email: row.email,
      status: row.status as 'active' | 'inactive',
      joinDate: row.join_date || new Date().toISOString(),
      avatar: row.avatar
    } as StaffMember));
    return localStaff;
  },

  async addStaff(member: Omit<StaffMember, 'id'>): Promise<void> {
    const newId = `st-${Date.now()}`;
    const newMember: StaffMember = {
      id: newId,
      ...member,
      avatar: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`
    };
    localStaff.push(newMember);
    triggerStaffCallbacks();

    const row = {
      name: member.name,
      role: member.role,
      employee_id: member.employeeId,
      phone: member.phone || null,
      email: member.email || null,
      status: member.status,
      avatar: newMember.avatar
    };
    const { error } = await supabase.from('staff').insert([row]);
    if (error) {
      localStaff = localStaff.filter(s => s.id !== newId);
      triggerStaffCallbacks();
      console.error('[Supabase] addStaff failed:', error);
      throw error;
    }
  },

  async updateStaff(id: string, updates: Partial<Omit<StaffMember, 'id'>>): Promise<void> {
    const index = localStaff.findIndex(s => s.id === id);
    let original: StaffMember | null = null;
    if (index !== -1) {
      original = { ...localStaff[index] };
      localStaff[index] = { ...localStaff[index], ...updates };
      triggerStaffCallbacks();
    }

    const row: Record<string, any> = {};
    if ('name' in updates) row.name = updates.name;
    if ('role' in updates) row.role = updates.role;
    if ('employeeId' in updates) row.employee_id = updates.employeeId;
    if ('phone' in updates) row.phone = updates.phone;
    if ('email' in updates) row.email = updates.email;
    if ('status' in updates) row.status = updates.status;
    if ('avatar' in updates) row.avatar = updates.avatar;

    const { error } = await supabase.from('staff').update(row).eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localStaff[index] = original;
        triggerStaffCallbacks();
      }
      console.error('[Supabase] updateStaff failed:', error);
      throw error;
    }
  },

  async deleteStaff(id: string): Promise<void> {
    const index = localStaff.findIndex(s => s.id === id);
    let original: StaffMember | null = null;
    if (index !== -1) {
      original = { ...localStaff[index] };
      localStaff.splice(index, 1);
      triggerStaffCallbacks();
    }

    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localStaff.splice(index, 0, original);
        triggerStaffCallbacks();
      }
      console.error('[Supabase] deleteStaff failed:', error);
      throw error;
    }
  },

  // ── BigQuery Sync ──────────────────────────────────────────────────────────
  async syncToBigQuery(table: string, data: any): Promise<void> {
    console.log(`[BigQuery Sync] Syncing ${table} to BigQuery proxy...`);
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/operations-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...data, _targetTable: table }),
      });
      if (!res.ok) {
        console.error(`[BigQuery Sync] Sync failed for table ${table}: ${res.status}`);
      }
    } catch (error) {
      console.error('[BigQuery Sync] Error:', error);
    }
  }
};
