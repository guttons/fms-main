import { supabase } from '../supabase';
import { User, Tank, FlightLog, BridgingLog, Alert, FlightJob, Equipment, StaffMember, UserRole, EquipmentStatus } from '../types';
import { CustomerAccount, UpcomingPayment, Invoice, Receipt, ProformaRecord, FuelRequest, MonthEndVariance, ProcurementPR, SurchargeRecord, MpdSale, CustomsShipment } from '../context/FinanceDataContext';
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

  async addFlightJob(job: FlightJob): Promise<void> {
    const row = {
      id: job.id,
      flight_number: job.flightNumber,
      aircraft_reg: job.aircraftReg,
      aircraft_type: job.aircraftType,
      stand: job.stand,
      sta: job.sta || null,
      eta: job.eta || null,
      std: job.std || null,
      assigned_to: job.assignedTo || null,
      assigned_officer: job.assignedOfficer || null,
      equipment_usage: job.equipmentUsage || null,
      status: job.status,
      vehicle_id: job.vehicleId || null,
      remarks: job.remarks || null,
      delivery_number: job.deliveryNumber || null,
      pit_number: job.pitNumber || null
    };

    const { error } = await supabase.from('flight_jobs').insert([row]);
    if (error) {
      console.error('[Supabase] addFlightJob failed:', error);
      throw error;
    }
  },

  async updateFlightJob(id: string, updates: Partial<FlightJob>): Promise<void> {
    const row: Record<string, any> = {};
    if ('flightNumber' in updates) row.flight_number = updates.flightNumber;
    if ('aircraftReg' in updates) row.aircraft_reg = updates.aircraftReg;
    if ('aircraftType' in updates) row.aircraft_type = updates.aircraftType;
    if ('stand' in updates) row.stand = updates.stand;
    if ('sta' in updates) row.sta = updates.sta;
    if ('eta' in updates) row.eta = updates.eta;
    if ('std' in updates) row.std = updates.std;
    if ('assignedTo' in updates) row.assigned_to = updates.assignedTo;
    if ('assignedOfficer' in updates) row.assigned_officer = updates.assignedOfficer;
    if ('equipmentUsage' in updates) row.equipment_usage = updates.equipmentUsage;
    if ('status' in updates) row.status = updates.status;
    if ('vehicleId' in updates) row.vehicle_id = updates.vehicleId;
    if ('remarks' in updates) row.remarks = updates.remarks;
    if ('deliveryNumber' in updates) row.delivery_number = updates.deliveryNumber;
    if ('pitNumber' in updates) row.pit_number = updates.pitNumber;

    const { error } = await supabase.from('flight_jobs').update(row).eq('id', id);
    if (error) {
      console.error('[Supabase] updateFlightJob failed:', error);
      throw error;
    }
  },

  subscribeToFlightJobs(callback: (jobs: FlightJob[]) => void) {
    const channel = supabase
      .channel('flight_jobs-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flight_jobs' },
        async () => {
          const jobs = await supabaseService.getFlightJobs();
          callback(jobs);
        }
      )
      .subscribe();

    supabaseService.getFlightJobs().then(callback);

    return () => {
      supabase.removeChannel(channel);
    };
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

  async deleteAlerts(ids: string[]): Promise<void> {
    const { error } = await supabase.from('alerts').delete().in('id', ids);
    if (error) {
      console.error('[Supabase] deleteAlerts failed:', error);
      throw error;
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
  },

  // ── Finance & Billing Module ───────────────────────────────────────────────
  async getFinCustomers(): Promise<CustomerAccount[]> {
    const { data, error } = await supabase.from('fin_customers').select('*').order('name');
    if (error) {
      console.error('[Supabase] getFinCustomers failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      name: row.name,
      classification: row.classification,
      openingBalance: Number(row.opening_balance),
      paymentsReceived: Number(row.payments_received),
      advanceBalance: Number(row.advance_balance),
      creditLimit: Number(row.credit_limit),
      estimated5DaysSales: Number(row.estimated_5_days_sales),
      runningBalance: Number(row.running_balance),
      outstandingReceipts: Number(row.outstanding_receipts),
      openingBalanceLiters: row.opening_balance_liters ? Number(row.opening_balance_liters) : undefined,
      balanceLiters: row.balance_liters ? Number(row.balance_liters) : undefined,
      associatedAirlines: row.associated_airlines || []
    } as CustomerAccount));
  },

  async upsertFinCustomers(custs: CustomerAccount[]): Promise<void> {
    const rows = custs.map(c => ({
      id: c.id,
      name: c.name,
      classification: c.classification,
      opening_balance: c.openingBalance,
      payments_received: c.paymentsReceived,
      advance_balance: c.advanceBalance,
      credit_limit: c.creditLimit,
      estimated_5_days_sales: c.estimated5DaysSales,
      running_balance: c.runningBalance,
      outstanding_receipts: c.outstandingReceipts,
      opening_balance_liters: c.openingBalanceLiters ?? null,
      balance_liters: c.balanceLiters ?? null,
      associated_airlines: c.associatedAirlines || null
    }));
    const { error } = await supabase.from('fin_customers').upsert(rows);
    if (error) {
      console.error('[Supabase] upsertFinCustomers failed:', error);
      throw error;
    }
  },

  async getFinUpcomingPayments(): Promise<UpcomingPayment[]> {
    const { data, error } = await supabase.from('fin_upcoming_payments').select('*').order('upload_date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinUpcomingPayments failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      referenceNumber: row.reference_number,
      amount: Number(row.amount),
      uploadDate: row.upload_date,
      status: row.status,
      swiftCopyUrl: row.swift_copy_url
    } as UpcomingPayment));
  },

  async createFinUpcomingPayment(payment: UpcomingPayment): Promise<void> {
    const row = {
      id: payment.id,
      customer_id: payment.customerId,
      customer_name: payment.customerName,
      reference_number: payment.referenceNumber,
      amount: payment.amount,
      upload_date: payment.uploadDate,
      status: payment.status,
      swift_copy_url: payment.swiftCopyUrl || null
    };
    const { error } = await supabase.from('fin_upcoming_payments').insert([row]);
    if (error) {
      console.error('[Supabase] createFinUpcomingPayment failed:', error);
      throw error;
    }
  },

  async updateFinUpcomingPayment(id: string, updates: Partial<UpcomingPayment>): Promise<void> {
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('swiftCopyUrl' in updates) row.swift_copy_url = updates.swiftCopyUrl;

    const { error } = await supabase.from('fin_upcoming_payments').update(row).eq('id', id);
    if (error) {
      console.error('[Supabase] updateFinUpcomingPayment failed:', error);
      throw error;
    }
  },

  async getFinInvoices(): Promise<Invoice[]> {
    const { data, error } = await supabase.from('fin_invoices').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinInvoices failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      classification: row.classification,
      amount: Number(row.amount),
      period: row.period,
      date: row.date,
      status: row.status,
      remainingAmount: Number(row.remaining_amount)
    } as Invoice));
  },

  async createFinInvoice(invoice: Invoice): Promise<void> {
    const row = {
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      customer_id: invoice.customerId,
      customer_name: invoice.customerName,
      classification: invoice.classification,
      amount: invoice.amount,
      period: invoice.period,
      date: invoice.date,
      status: invoice.status,
      remaining_amount: invoice.remainingAmount
    };
    const { error } = await supabase.from('fin_invoices').insert([row]);
    if (error) {
      console.error('[Supabase] createFinInvoice failed:', error);
      throw error;
    }
  },

  async upsertFinInvoices(invoices: Invoice[]): Promise<void> {
    const rows = invoices.map(i => ({
      id: i.id,
      invoice_number: i.invoiceNumber,
      customer_id: i.customerId,
      customer_name: i.customerName,
      classification: i.classification,
      amount: i.amount,
      period: i.period,
      date: i.date,
      status: i.status,
      remaining_amount: i.remainingAmount
    }));
    const { error } = await supabase.from('fin_invoices').upsert(rows);
    if (error) {
      console.error('[Supabase] upsertFinInvoices failed:', error);
      throw error;
    }
  },

  async getFinReceipts(): Promise<Receipt[]> {
    const { data, error } = await supabase.from('fin_receipts').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinReceipts failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      receiptNumber: row.receipt_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: Number(row.amount),
      date: row.date,
      status: row.status,
      remainingAmount: Number(row.remaining_amount)
    } as Receipt));
  },

  async createFinReceipt(receipt: Receipt): Promise<void> {
    const row = {
      id: receipt.id,
      receipt_number: receipt.receiptNumber,
      customer_id: receipt.customerId,
      customer_name: receipt.customerName,
      amount: receipt.amount,
      date: receipt.date,
      status: receipt.status,
      remaining_amount: receipt.remainingAmount
    };
    const { error } = await supabase.from('fin_receipts').insert([row]);
    if (error) {
      console.error('[Supabase] createFinReceipt failed:', error);
      throw error;
    }
  },

  async upsertFinReceipts(receipts: Receipt[]): Promise<void> {
    const rows = receipts.map(r => ({
      id: r.id,
      receipt_number: r.receiptNumber,
      customer_id: r.customerId,
      customer_name: r.customerName,
      amount: r.amount,
      date: r.date,
      status: r.status,
      remaining_amount: r.remainingAmount
    }));
    const { error } = await supabase.from('fin_receipts').upsert(rows);
    if (error) {
      console.error('[Supabase] upsertFinReceipts failed:', error);
      throw error;
    }
  },

  async getFinProformaRegister(): Promise<ProformaRecord[]> {
    const { data, error } = await supabase.from('fin_proforma_register').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinProformaRegister failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      date: row.date,
      customerId: row.customer_id,
      customerName: row.customer_name,
      amount: Number(row.amount),
      period: row.period,
      invoiceNumber: row.invoice_number
    } as ProformaRecord));
  },

  async createFinProforma(record: ProformaRecord): Promise<void> {
    const row = {
      id: record.id,
      date: record.date,
      customer_id: record.customerId,
      customer_name: record.customerName,
      amount: record.amount,
      period: record.period,
      invoice_number: record.invoiceNumber
    };
    const { error } = await supabase.from('fin_proforma_register').insert([row]);
    if (error) {
      console.error('[Supabase] createFinProforma failed:', error);
      throw error;
    }
  },

  async getFinFuelRequests(): Promise<FuelRequest[]> {
    const { data, error } = await supabase.from('fin_fuel_requests').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinFuelRequests failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      deliveryNumber: row.delivery_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: row.date,
      quantityLiters: Number(row.quantity_liters),
      pricePerLiter: Number(row.price_per_liter),
      amount: Number(row.amount),
      aircraftReg: row.aircraft_reg,
      status: row.status,
      categorySector: row.category_sector,
      operator: row.operator,
      flightNumber: row.flight_number,
      aircraftType: row.aircraft_type,
      refuelTimePosition: row.refuel_time_position,
      refuelTimeCommence: row.refuel_time_commence,
      refuelTimeComplete: row.refuel_time_complete,
      memoLine: row.memo_line,
      currency: row.currency,
      circularRate: Number(row.circular_rate),
      discounts: Number(row.discounts),
      gst: Number(row.gst),
      transactionType: row.transaction_type,
      cogsAccount: row.cogs_account,
      invoiceNumber: row.invoice_number
    } as FuelRequest));
  },

  async createFinFuelRequest(request: FuelRequest): Promise<void> {
    const row = {
      id: request.id,
      delivery_number: request.deliveryNumber,
      customer_id: request.customerId,
      customer_name: request.customerName,
      date: request.date,
      quantity_liters: request.quantityLiters,
      price_per_liter: request.pricePerLiter,
      amount: request.amount,
      aircraft_reg: request.aircraftReg,
      status: request.status,
      category_sector: request.categorySector,
      operator: request.operator,
      flight_number: request.flightNumber,
      aircraft_type: request.aircraftType,
      refuel_time_position: request.refuelTimePosition,
      refuel_time_commence: request.refuelTimeCommence,
      refuel_time_complete: request.refuelTimeComplete,
      memo_line: request.memoLine,
      currency: request.currency,
      circular_rate: request.circularRate,
      discounts: request.discounts,
      gst: request.gst,
      transaction_type: request.transactionType,
      cogs_account: request.cogsAccount,
      invoice_number: request.invoiceNumber || null
    };
    const { error } = await supabase.from('fin_fuel_requests').insert([row]);
    if (error) {
      console.error('[Supabase] createFinFuelRequest failed:', error);
      throw error;
    }
  },

  async updateFinFuelRequest(id: string, updates: Partial<FuelRequest>): Promise<void> {
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('invoiceNumber' in updates) row.invoice_number = updates.invoiceNumber;

    const { error } = await supabase.from('fin_fuel_requests').update(row).eq('id', id);
    if (error) {
      console.error('[Supabase] updateFinFuelRequest failed:', error);
      throw error;
    }
  },

  async getFinVarianceLogs(): Promise<MonthEndVariance[]> {
    const { data, error } = await supabase.from('fin_variance_logs').select('*').order('month', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinVarianceLogs failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      month: row.month,
      fuelType: row.fuel_type,
      fmsStockLiters: Number(row.fms_stock_liters),
      oracleStockLiters: Number(row.oracle_stock_liters),
      salesQuantityLiters: Number(row.sales_quantity_liters),
      variancePercentage: Number(row.variance_percentage),
      status: row.status,
      physicalCheckUploaded: row.physical_check_uploaded,
      notes: row.notes
    } as MonthEndVariance));
  },

  async createFinVarianceLog(log: MonthEndVariance): Promise<void> {
    const row = {
      id: log.id,
      month: log.month,
      fuel_type: log.fuelType,
      fms_stock_liters: log.fmsStockLiters,
      oracle_stock_liters: log.oracleStockLiters,
      sales_quantity_liters: log.salesQuantityLiters,
      variance_percentage: log.variancePercentage,
      status: log.status,
      physical_check_uploaded: log.physicalCheckUploaded,
      notes: log.notes || null
    };
    const { error } = await supabase.from('fin_variance_logs').insert([row]);
    if (error) {
      console.error('[Supabase] createFinVarianceLog failed:', error);
      throw error;
    }
  },

  async updateFinVarianceLog(id: string, updates: Partial<MonthEndVariance>): Promise<void> {
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('physicalCheckUploaded' in updates) row.physical_check_uploaded = updates.physicalCheckUploaded;
    if ('notes' in updates) row.notes = updates.notes;

    const { error } = await supabase.from('fin_variance_logs').update(row).eq('id', id);
    if (error) {
      console.error('[Supabase] updateFinVarianceLog failed:', error);
      throw error;
    }
  },

  async getFinProcurementPRs(): Promise<ProcurementPR[]> {
    const { data, error } = await supabase.from('fin_procurement_prs').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinProcurementPRs failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      prNumber: row.pr_number,
      date: row.date,
      fuelType: row.fuel_type,
      quantityLiters: Number(row.quantity_liters),
      plattsRate: Number(row.platts_rate),
      fobValue: Number(row.fob_value),
      vendorInvoiceVerified: row.vendor_invoice_verified,
      poNumber: row.po_number,
      oracleInvoiceNumber: row.oracle_invoice_number,
      status: row.status
    } as ProcurementPR));
  },

  async createFinProcurementPR(pr: ProcurementPR): Promise<void> {
    const row = {
      id: pr.id,
      pr_number: pr.prNumber,
      date: pr.date,
      fuel_type: pr.fuelType,
      quantity_liters: pr.quantityLiters,
      platts_rate: pr.plattsRate,
      fob_value: pr.fobValue,
      vendor_invoice_verified: pr.vendorInvoiceVerified,
      po_number: pr.poNumber || null,
      oracle_invoice_number: pr.oracleInvoiceNumber || null,
      status: pr.status
    };
    const { error } = await supabase.from('fin_procurement_prs').insert([row]);
    if (error) {
      console.error('[Supabase] createFinProcurementPR failed:', error);
      throw error;
    }
  },

  async updateFinProcurementPR(id: string, updates: Partial<ProcurementPR>): Promise<void> {
    const row: Record<string, any> = {};
    if ('status' in updates) row.status = updates.status;
    if ('vendorInvoiceVerified' in updates) row.vendor_invoice_verified = updates.vendorInvoiceVerified;
    if ('poNumber' in updates) row.po_number = updates.poNumber;
    if ('oracleInvoiceNumber' in updates) row.oracle_invoice_number = updates.oracleInvoiceNumber;

    const { error } = await supabase.from('fin_procurement_prs').update(row).eq('id', id);
    if (error) {
      console.error('[Supabase] updateFinProcurementPR failed:', error);
      throw error;
    }
  },

  async getFinSurcharges(): Promise<SurchargeRecord[]> {
    const { data, error } = await supabase.from('fin_surcharges').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinSurcharges failed:', error);
      return [];
    }
    return data.map(row => ({
      grnNumber: row.grn_number,
      originalValue: Number(row.original_value),
      surchargeAmount: Number(row.surcharge_amount),
      notes: row.notes,
      date: row.date
    } as SurchargeRecord));
  },

  async createFinSurcharge(surcharge: SurchargeRecord): Promise<void> {
    const row = {
      grn_number: surcharge.grnNumber,
      original_value: surcharge.originalValue,
      surcharge_amount: surcharge.surchargeAmount,
      notes: surcharge.notes,
      date: surcharge.date
    };
    const { error } = await supabase.from('fin_surcharges').insert([row]);
    if (error) {
      console.error('[Supabase] createFinSurcharge failed:', error);
      throw error;
    }
  },

  async getFinMpdSales(): Promise<MpdSale[]> {
    const { data, error } = await supabase.from('fin_mpd_sales').select('*').order('date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinMpdSales failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      deliveryNo: row.delivery_no,
      date: row.date,
      customerName: row.customer_name,
      operatorName: row.operator_name,
      regNo: row.reg_no,
      dieselLiters: Number(row.diesel_liters),
      petrolLiters: Number(row.petrol_liters),
      rateDiesel: Number(row.rate_diesel),
      ratePetrol: Number(row.rate_petrol),
      amountDiesel: Number(row.amount_diesel),
      amountPetrol: Number(row.amount_petrol),
      invoiceNumber: row.invoice_number,
      classification: row.classification,
      type: row.type,
      cogsAccount: row.cogs_account
    } as MpdSale));
  },

  async createFinMpdSale(sale: MpdSale): Promise<void> {
    const row = {
      id: sale.id,
      delivery_no: sale.deliveryNo,
      date: sale.date,
      customer_name: sale.customerName,
      operator_name: sale.operatorName,
      reg_no: sale.regNo,
      diesel_liters: sale.dieselLiters,
      petrol_liters: sale.petrolLiters,
      rate_diesel: sale.rateDiesel,
      rate_petrol: sale.ratePetrol,
      amount_diesel: sale.amountDiesel,
      amount_petrol: sale.amountPetrol,
      invoice_number: sale.invoiceNumber || null,
      classification: sale.classification,
      type: sale.type,
      cogs_account: sale.cogsAccount
    };
    const { error } = await supabase.from('fin_mpd_sales').insert([row]);
    if (error) {
      console.error('[Supabase] createFinMpdSale failed:', error);
      throw error;
    }
  },

  async getFinCustomsShipments(): Promise<CustomsShipment[]> {
    const { data, error } = await supabase.from('fin_customs_shipments').select('*').order('arrival_date', { ascending: false });
    if (error) {
      console.error('[Supabase] getFinCustomsShipments failed:', error);
      return [];
    }
    return data.map(row => ({
      id: row.id,
      shipmentNumber: row.shipment_number,
      bFormNumber: row.b_form_number,
      arrivalDate: row.arrival_date,
      quantityLiters: Number(row.quantity_liters),
      fobValue: Number(row.fob_value),
      conversionFactor: row.conversion_factor,
      metricTons: Number(row.metric_tons),
      dutyPaid: Number(row.duty_paid),
      royaltyRatePercent: Number(row.royalty_rate_percent),
      royaltyAmount: Number(row.royalty_amount)
    } as CustomsShipment));
  },

  async createFinCustomsShipment(shipment: CustomsShipment): Promise<void> {
    const row = {
      id: shipment.id,
      shipment_number: shipment.shipmentNumber,
      b_form_number: shipment.bFormNumber,
      arrival_date: shipment.arrivalDate,
      quantity_liters: shipment.quantityLiters,
      fob_value: shipment.fobValue,
      conversion_factor: shipment.conversionFactor,
      metric_tons: shipment.metricTons,
      duty_paid: shipment.dutyPaid,
      royalty_rate_percent: shipment.royaltyRatePercent,
      royalty_amount: shipment.royaltyAmount
    };
    const { error } = await supabase.from('fin_customs_shipments').insert([row]);
    if (error) {
      console.error('[Supabase] createFinCustomsShipment failed:', error);
      throw error;
    }
  },

  async getExternalFlights(): Promise<any[]> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/external-flights`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.flights || [];
      }
      throw new Error(`BigQuery API proxy returned status ${res.status}`);
    } catch (error) {
      console.warn('[BigQuery] getExternalFlights via proxy failed, trying direct fetch:', error);
      try {
        const res = await fetch('https://www.fis.com.mv/api/flights');
        if (res.ok) {
          const data = await res.json();
          return data.flights || [];
        }
      } catch (directError) {
        console.error('[BigQuery] getExternalFlights direct fetch also failed:', directError);
      }
      return [];
    }
  }
};
