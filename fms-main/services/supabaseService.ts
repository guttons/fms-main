import { supabase } from '../supabase';
import { User, Tank, FlightLog, BridgingLog, Alert, FlightJob, Equipment, StaffMember, UserRole, EquipmentStatus, Vessel, AirlineMaster, FlightMaster, AircraftMaster, AirlineHierarchyNode } from '../types';
import { CustomerAccount, UpcomingPayment, Invoice, Receipt, ProformaRecord, FuelRequest, MonthEndVariance, ProcurementPR, SurchargeRecord, MpdSale, CustomsShipment } from '../context/FinanceDataContext';
import { TANKS, MOCK_USERS, EQUIPMENT } from '../constants';
import { INITIAL_STAFF_LIST } from '../constants/staffList';
import { fmsDb } from './db';
import { syncEngine } from './syncEngine';
import masterDbData from './masterDbData.json';

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
let localVessels: Vessel[] = [];

const staffCallbacks = new Set<(staff: StaffMember[]) => void>();
const equipmentCallbacks = new Set<(eq: Equipment[]) => void>();
const tanksCallbacks = new Set<(tanks: Tank[]) => void>();
const vesselCallbacks = new Set<(vessels: Vessel[]) => void>();

const triggerVesselCallbacks = () => {
  const list = [...localVessels];
  vesselCallbacks.forEach(cb => {
    try { cb(list); } catch (e) { console.error('Error in vessel callback:', e); }
  });
};

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

// Persistent storage helpers for User UI Staff Edits (ensures manual UI edits are NEVER reverted)
function getUserEdits(): Record<string, Partial<StaffMember>> {
  try {
    const raw = localStorage.getItem('fms_staff_user_edits');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUserEdit(id: string, updates: Partial<StaffMember>) {
  try {
    const edits = getUserEdits();
    edits[id] = { ...(edits[id] || {}), ...updates };
    localStorage.setItem('fms_staff_user_edits', JSON.stringify(edits));
  } catch (e) {
    console.warn('[Supabase] Failed to save user staff edit:', e);
  }
}

function removeUserEdit(id: string) {
  try {
    const edits = getUserEdits();
    delete edits[id];
    localStorage.setItem('fms_staff_user_edits', JSON.stringify(edits));
  } catch (e) {}
}

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
    try {
      const { data, error } = await supabase.from('tanks').select('*').order('name');
      if (!error && data && data.length > 0) {
        localTanks = data.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          capacity: Number(row.capacity),
          currentLevel: Number(row.current_level),
          safeMinLevel: Number(row.safe_min_level),
          lastUpdated: row.last_updated
        } as Tank));
        // Cache to IndexedDB
        await fmsDb.bulkPut('tanks', localTanks);
        return localTanks;
      }
    } catch (e) {
      console.warn('[Supabase] Network query failed for getTanks, checking IndexedDB cache:', e);
    }

    // Fallback to IndexedDB
    const cached = await fmsDb.getAll<Tank>('tanks');
    if (cached && cached.length > 0) {
      localTanks = cached;
      return localTanks;
    }

    if (localTanks.length === 0) localTanks = TANKS;
    await fmsDb.bulkPut('tanks', localTanks);
    return localTanks;
  },

  async updateTankLevel(id: string, newLevel: number): Promise<void> {
    const index = localTanks.findIndex(t => t.id === id);
    const lastUpdated = new Date().toISOString();
    if (index !== -1) {
      localTanks[index] = { ...localTanks[index], currentLevel: newLevel, lastUpdated };
      triggerTanksCallbacks();
      await fmsDb.put('tanks', localTanks[index]);
    }

    const payload = { current_level: newLevel, last_updated: lastUpdated };

    // Enqueue mutation to IndexedDB Outbox
    await fmsDb.enqueueOutbox({
      action: 'UPDATE',
      entityType: 'tank',
      entityId: id,
      payload,
      idempotencyKey: `tank-lvl-${id}-${Date.now()}`
    });

    // Attempt background sync
    syncEngine.flushOutbox().catch(err => console.warn('[Outbox] Background sync queued offline:', err));
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
    try {
      const { data, error } = await supabase.from('flight_jobs').select('*');
      if (!error && data && data.length > 0) {
        const jobs = data.map(row => {
          let dateVal: string | undefined = undefined;
          let routeVal: string | undefined = undefined;
          let isDomesticVal: boolean | undefined = undefined;
          let isAdhocVal: boolean | undefined = undefined;
          let typeVal: 'arrival' | 'departure' | undefined = undefined;
          let remarksVal = row.remarks || '';

          if (row.remarks && row.remarks.startsWith('{"_fms_meta":')) {
            try {
              const meta = JSON.parse(row.remarks);
              dateVal = meta.date;
              routeVal = meta.route;
              isDomesticVal = meta.isDomestic;
              isAdhocVal = meta.isAdhoc;
              typeVal = meta.type;
              remarksVal = meta.remarks || '';
            } catch (e) {}
          }

          return {
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
            remarks: remarksVal,
            deliveryNumber: row.delivery_number,
            pitNumber: row.pit_number,
            date: dateVal,
            route: routeVal,
            isDomestic: isDomesticVal,
            isAdhoc: isAdhocVal,
            type: typeVal
          } as FlightJob;
        });

        // Cache in IndexedDB
        await fmsDb.bulkPut('flight_jobs', jobs);
        return jobs;
      }
    } catch (e) {
      console.warn('[Supabase] getFlightJobs network query failed, falling back to IndexedDB:', e);
    }

    // Offline fallback from IndexedDB
    const cachedJobs = await fmsDb.getAll<FlightJob>('flight_jobs');
    return cachedJobs || [];
  },

  async addFlightJob(job: FlightJob): Promise<void> {
    // 1. Write to local IndexedDB immediately
    await fmsDb.put('flight_jobs', job);

    const metaString = JSON.stringify({
      _fms_meta: true,
      date: job.date,
      route: job.route,
      isDomestic: job.isDomestic,
      isAdhoc: job.isAdhoc,
      type: job.type,
      remarks: job.remarks || ''
    });

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
      remarks: metaString,
      delivery_number: job.deliveryNumber || null,
      pit_number: job.pitNumber || null
    };

    // 2. Queue mutation in outbox
    await fmsDb.enqueueOutbox({
      action: 'INSERT',
      entityType: 'flight_job',
      entityId: job.id,
      payload: row,
      idempotencyKey: `fj-ins-${job.id}-${Date.now()}`
    });

    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
  },

  async updateFlightJob(id: string, updates: Partial<FlightJob>): Promise<void> {
    // 1. Update local IndexedDB
    const existing = await fmsDb.get<FlightJob>('flight_jobs', id);
    if (existing) {
      await fmsDb.put('flight_jobs', { ...existing, ...updates });
    }

    const row: Record<string, any> = {};
    if ('flightNumber' in updates) row.flight_number = updates.flightNumber;
    if ('aircraftReg' in updates) row.aircraft_reg = updates.aircraftReg;
    if ('aircraftType' in updates) row.aircraft_type = updates.aircraftType;
    if ('stand' in updates) row.stand = updates.stand;
    if ('sta' in updates) row.sta = updates.sta === undefined ? null : updates.sta;
    if ('eta' in updates) row.eta = updates.eta === undefined ? null : updates.eta;
    if ('std' in updates) row.std = updates.std === undefined ? null : updates.std;
    if ('assignedTo' in updates) row.assigned_to = updates.assignedTo === undefined ? null : updates.assignedTo;
    if ('assignedOfficer' in updates) row.assigned_officer = updates.assignedOfficer === undefined ? null : updates.assignedOfficer;
    if ('equipmentUsage' in updates) row.equipment_usage = updates.equipmentUsage;
    if ('status' in updates) row.status = updates.status;
    if ('vehicleId' in updates) row.vehicle_id = updates.vehicleId === undefined ? null : updates.vehicleId;
    if ('remarks' in updates || 'date' in updates || 'route' in updates || 'isDomestic' in updates || 'isAdhoc' in updates || 'type' in updates) {
      const metaString = JSON.stringify({
        _fms_meta: true,
        date: updates.date,
        route: updates.route,
        isDomestic: updates.isDomestic,
        isAdhoc: updates.isAdhoc,
        type: updates.type,
        remarks: updates.remarks || ''
      });
      row.remarks = metaString;
    }
    if ('deliveryNumber' in updates) row.delivery_number = updates.deliveryNumber === undefined ? null : updates.deliveryNumber;
    if ('pitNumber' in updates) row.pit_number = updates.pitNumber === undefined ? null : updates.pitNumber;

    // 2. Queue outbox
    await fmsDb.enqueueOutbox({
      action: 'UPDATE',
      entityType: 'flight_job',
      entityId: id,
      payload: row,
      idempotencyKey: `fj-upd-${id}-${Date.now()}`
    });

    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
  },

  async deleteFlightJob(id: string): Promise<void> {
    await fmsDb.delete('flight_jobs', id);
    await fmsDb.enqueueOutbox({
      action: 'DELETE',
      entityType: 'flight_job',
      entityId: id,
      payload: null,
      idempotencyKey: `fj-del-${id}-${Date.now()}`
    });
    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
  },

  async clearAllFlightJobs(): Promise<void> {
    const { error } = await supabase.from('flight_jobs').delete().neq('id', '');
    if (error) {
      console.error('[Supabase] clearAllFlightJobs failed:', error);
      throw error;
    }
  },

  async clearAllBriefingInfo(): Promise<void> {
    const { error } = await supabase.from('shift_briefing_info').delete().neq('id', '');
    if (error) {
      console.error('[Supabase] clearAllBriefingInfo failed:', error);
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
    const envUrl = import.meta.env.VITE_BIGQUERY_API_URL;
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (envUrl && envUrl.includes('localhost') && !isLocalhost) {
      return 'https://fms-bigquery-api-808402455416.us-central1.run.app';
    }
    return envUrl || 'https://fms-bigquery-api-808402455416.us-central1.run.app';
  },

  async _bqAuthHeaders(): Promise<Record<string, string>> {
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'apikey': anonKey
    };

    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data?.session) {
          session = data.session;
        }
      }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        headers['Authorization'] = `Bearer ${anonKey}`;
      }
    } catch (e) {
      headers['Authorization'] = `Bearer ${anonKey}`;
    }
    return headers;
  },

  async getFlightLogs(filters?: { 
    startDate?: string; 
    endDate?: string; 
    searchTerm?: string;
    logType?: string;
    flightCategory?: string;
    equipmentId?: string;
    page?: number;
    limit?: number;
    sortField?: string;
    sortOrder?: string;
  }): Promise<{ logs: FlightLog[]; totalCount: number; totalVolume: number }> {
    console.log('[BigQuery API] GET /operations-log');
    try {
      const headers = await this._bqAuthHeaders();
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            queryParams.append(key, String(val));
          }
        });
      }
      
      const queryString = queryParams.toString();
      const url = `${this._bqBase()}/operations-log${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`BigQuery GET failed: ${res.status}`);
      const data = await res.json();
      return {
        logs: (data.logs || []) as FlightLog[],
        totalCount: data.totalCount || 0,
        totalVolume: data.totalVolume || 0
      };
    } catch (error) {
      console.warn('[BigQuery] getFlightLogs unavailable – returning cached/empty data.', (error as Error)?.message || '');
      return { logs: [], totalCount: 0, totalVolume: 0 };
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
    
    // Check if it's a local/mock bridging log first
    const localIdx = localBridgingLogs.findIndex(log => log.id === id);
    if (localIdx > -1) {
      localBridgingLogs.splice(localIdx, 1);
      console.log(`[Local] Deleted local bridging log: ${id}`);
      return;
    }

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

  async getBridgingLogs(filters?: { 
    startDate?: string; 
    endDate?: string; 
    searchTerm?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: BridgingLog[]; totalCount: number; totalVolume: number }> {
    console.log('[BigQuery API] GET /refueler-loading-log');
    try {
      const headers = await this._bqAuthHeaders();
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            queryParams.append(key, String(val));
          }
        });
      }

      const queryString = queryParams.toString();
      const url = `${this._bqBase()}/refueler-loading-log${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`BigQuery GET refueler-loading-log failed: ${res.status}`);
      const data = await res.json();
      const logs = (data.logs || []).map((row: any) => {
        const clean = (val: any) => (val && typeof val === 'object' && 'value' in val) ? val.value : val;
        return {
          id: row.id,
          sourceTankId: row.source_tank_id,
          vehicleId: row.vehicle_id,
          volume: Number(row.volume),
          startTime: clean(row.start_time) || '',
          endTime: clean(row.end_time) || '',
          date: clean(row.date),
          visualCheckPassed: !!row.visual_check_passed,
          cwdCheckPassed: !!row.cwd_check_passed,
          density: row.density ? Number(row.density) : undefined,
          temperature: row.temperature ? Number(row.temperature) : undefined,
          operatorId: row.operator_name || '',
          supervisorId: row.supervisor_name || '',
          remarks: row.remarks || '',
          isDeleted: !!row.is_deleted,
          co: row.co || ''
        };
      });
      const localBridgingVolume = localBridgingLogs.reduce((sum, l) => sum + (l.volume || 0), 0);
      return { 
        logs: [...logs, ...localBridgingLogs], 
        totalCount: (data.totalCount || 0) + localBridgingLogs.length,
        totalVolume: (data.totalVolume || 0) + localBridgingVolume
      };
    } catch (error) {
      console.warn('[BigQuery] getBridgingLogs failed, falling back to localBridgingLogs:', error);
      const localBridgingVolume = localBridgingLogs.reduce((sum, l) => sum + (l.volume || 0), 0);
      return { logs: localBridgingLogs, totalCount: localBridgingLogs.length, totalVolume: localBridgingVolume };
    }
  },

  async createBridgingLog(log: Omit<BridgingLog, 'id'>): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/refueler-loading-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error(`BigQuery POST failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] createBridgingLog saved successfully.');
    } catch (error) {
      console.error('[BigQuery] createBridgingLog failed:', error);
      throw error;
    }
  },

  async updateBridgingLog(id: string, updates: Partial<BridgingLog>): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/refueler-loading-log/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`BigQuery PATCH failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] updateBridgingLog saved successfully.');
    } catch (error) {
      console.error('[BigQuery] updateBridgingLog failed:', error);
      throw error;
    }
  },

  async deleteBridgingLog(id: string): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/refueler-loading-log/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`BigQuery DELETE failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] deleteBridgingLog completed.');
    } catch (error) {
      console.error('[BigQuery] deleteBridgingLog failed:', error);
      throw error;
    }
  },

  // ── Filling Station Logs ───────────────────────────────────────────────────
  async getFillingStationLogs(filters?: { 
    startDate?: string; 
    endDate?: string; 
    searchTerm?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: FlightLog[]; totalCount: number; totalVolume: number }> {
    console.log('[BigQuery API] GET /filling-station-log');
    try {
      const headers = await this._bqAuthHeaders();
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            queryParams.append(key, String(val));
          }
        });
      }

      const queryString = queryParams.toString();
      const url = `${this._bqBase()}/filling-station-log${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`BigQuery GET filling-station-log failed: ${res.status}`);
      const data = await res.json();
      const logs = (data.logs || []).map((row: any) => {
        const clean = (val: any) => (val && typeof val === 'object' && 'value' in val) ? val.value : val;
        const rowDate = clean(row.date);
        return {
          id: row.id,
          flightNumber: `GROUND-${row.station}-${row.fuel_type.toUpperCase()}`,
          aircraftReg: row.vehicle_reg.toUpperCase(),
          aircraftType: 'GROUND VEHICLE',
          stand: row.station === 'LFS' ? 'LANDSIDE STATION' : 'AIRSIDE STATION',
          operatorId: row.operator_id || 'System Admin',
          vehicleId: row.vehicle_reg.toUpperCase(),
          status: 'COMPLETED',
          logType: 'FILLING_STATION' as any,
          deliveryNumber: row.invoice_number ? `MLE-${row.invoice_number}` : undefined,
          timestampStart: `${rowDate}T08:00:00.000Z`,
          timestampFinalEnd: `${rowDate}T16:00:00.000Z`,
          timestampClearance: clean(row.created_at) || new Date().toISOString(),
          meterOpen: 0,
          meterClose: Number(row.volume),
          volume: Number(row.volume),
          panelCheck: true,
          walkAroundCheck: true,
          appearanceCheck: true,
          waterCheck: true,
          remarks: `Ground support refuel: ${row.vehicle_reg} loaded with ${row.volume}L ${row.fuel_type} (On account of: ${row.driver_name || 'N/A'}, Payment: ${row.payment_mode || 'Credit'}, Received by: ${row.received_by || 'N/A'}, Equipment: ${row.equipment_name || 'N/A'})`
        };
      });
      return { logs, totalCount: data.totalCount || 0, totalVolume: data.totalVolume || 0 };
    } catch (error) {
      console.warn('[BigQuery] getFillingStationLogs failed:', error);
      return { logs: [], totalCount: 0, totalVolume: 0 };
    }
  },

  async createFillingStationLog(log: any): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/filling-station-log`, {
        method: 'POST',
        headers,
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error(`BigQuery POST failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] createFillingStationLog saved successfully.');
    } catch (error) {
      console.error('[BigQuery] createFillingStationLog failed:', error);
      throw error;
    }
  },

  async updateFillingStationLog(id: string, updates: any): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/filling-station-log/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`BigQuery PATCH failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] updateFillingStationLog saved successfully.');
    } catch (error) {
      console.error('[BigQuery] updateFillingStationLog failed:', error);
      throw error;
    }
  },

  async deleteFillingStationLog(id: string): Promise<void> {
    try {
      const headers = await this._bqAuthHeaders();
      const res = await fetch(`${this._bqBase()}/filling-station-log/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`BigQuery DELETE failed: ${res.status} ${await res.text()}`);
      console.log('[BigQuery] deleteFillingStationLog completed.');
    } catch (error) {
      console.error('[BigQuery] deleteFillingStationLog failed:', error);
      throw error;
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

  async getStaff(forceRefresh = false): Promise<StaffMember[]> {
    if (localStaff.length > 0 && !forceRefresh) {
      return localStaff;
    }

    const mergedMap = new Map<string, StaffMember>();

    // Step 1: Base map from code definitions (INITIAL_STAFF_LIST)
    INITIAL_STAFF_LIST.forEach(s => mergedMap.set(s.id, s));

    // Step 2: Fetch remote database records from Supabase
    try {
      const { data, error } = await supabase.from('staff').select('*').order('name');
      if (!error && data && data.length > 0) {
        data.forEach(row => {
          const dbStaff: StaffMember = {
            id: row.id,
            name: row.name,
            role: row.role as UserRole,
            employeeId: row.employee_id,
            phone: row.phone,
            email: row.email,
            status: row.status as 'active' | 'inactive',
            joinDate: row.join_date || new Date().toISOString(),
            avatar: row.avatar
          };
          const existing = mergedMap.get(dbStaff.id);
          if (existing) {
            mergedMap.set(dbStaff.id, { ...existing, ...dbStaff });
          } else {
            mergedMap.set(dbStaff.id, dbStaff);
          }
        });
      }
    } catch (e) {
      console.warn('[Supabase] Remote staff fetch warning:', e);
    }

    // Step 3: ABSOLUTE TOP PRIORITY: User UI Edits (fms_staff_user_edits)
    // Edits made in the Staff Management UI overwrite everything else so they NEVER revert!
    const userEdits = getUserEdits();
    Object.entries(userEdits).forEach(([id, edits]) => {
      const existing = mergedMap.get(id);
      if (existing) {
        mergedMap.set(id, { ...existing, ...edits });
      } else if (edits.name && edits.role) {
        mergedMap.set(id, edits as StaffMember);
      }
    });

    localStaff = Array.from(mergedMap.values());
    await fmsDb.bulkPut('staff', localStaff);
    try { localStorage.setItem('fms_staff_list_v3', JSON.stringify(localStaff)); } catch (e) {}

    // Synchronize current merged staff records to remote Supabase PostgreSQL DB
    const staffDataToUpsert = localStaff.map(user => ({
      id: user.id,
      name: user.name,
      role: user.role,
      employee_id: user.employeeId,
      phone: user.phone || null,
      email: user.email || null,
      status: user.status || 'active',
      join_date: user.joinDate || new Date().toISOString(),
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`
    }));

    try {
      await supabase.from('staff').upsert(staffDataToUpsert);
      console.log('[Supabase] Staff table successfully synchronized in remote DB!');
    } catch (err) {
      console.warn('[Supabase] Staff remote upsert error:', err);
    }

    return localStaff;
  },

  async syncStaffWithCode(): Promise<StaffMember[]> {
    console.log('[Supabase] Synchronizing staff list with database and user edits...');
    return this.getStaff(true);
  },

  async findStaffByEmailOrRc(identifier: string): Promise<StaffMember | null> {
    if (!identifier) return null;
    const staffList = await this.getStaff();
    const clean = identifier.trim().toLowerCase();
    
    // Match exact RC Number / employeeId (e.g. "a-3046", "35075", "a-6600") OR Email (e.g. "mohamed.ashhad@macl.aero")
    const match = staffList.find(s => {
      const empId = (s.employeeId || '').trim().toLowerCase();
      const email = (s.email || '').trim().toLowerCase();
      return empId === clean || email === clean || empId.replace('-', '') === clean.replace('-', '');
    });

    return match || null;
  },

  async addStaff(member: Omit<StaffMember, 'id'>): Promise<void> {
    const newId = `st-${Date.now()}`;
    const newMember: StaffMember = {
      id: newId,
      ...member,
      avatar: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`
    };
    localStaff.push(newMember);
    saveUserEdit(newId, newMember);
    try { localStorage.setItem('fms_staff_list_v3', JSON.stringify(localStaff)); } catch (e) {}
    triggerStaffCallbacks();

    await fmsDb.put('staff', newMember);

    const payload = {
      id: newId,
      name: member.name,
      role: member.role,
      employee_id: member.employeeId,
      phone: member.phone || null,
      email: member.email || null,
      status: member.status,
      avatar: newMember.avatar
    };

    try {
      const { error } = await supabase.from('staff').insert([payload]);
      if (error) console.warn('[Supabase] Direct addStaff error:', error);
    } catch (e) {
      console.warn('[Supabase] Direct addStaff failed:', e);
    }

    await fmsDb.enqueueOutbox({
      action: 'INSERT',
      entityType: 'staff',
      entityId: newId,
      payload,
      idempotencyKey: `staff-ins-${newId}-${Date.now()}`
    });
    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
  },

  async updateStaff(id: string, updates: Partial<Omit<StaffMember, 'id'>>): Promise<void> {
    const index = localStaff.findIndex(s => s.id === id);
    if (index !== -1) {
      localStaff[index] = { ...localStaff[index], ...updates };
      saveUserEdit(id, updates); // Save edit permanently in user edits map!
      try { localStorage.setItem('fms_staff_list_v3', JSON.stringify(localStaff)); } catch (e) {}
      triggerStaffCallbacks();
      await fmsDb.put('staff', localStaff[index]);
    }

    const row: Record<string, any> = {};
    if ('name' in updates) row.name = updates.name;
    if ('role' in updates) row.role = updates.role;
    if ('employeeId' in updates) row.employee_id = updates.employeeId;
    if ('phone' in updates) row.phone = updates.phone;
    if ('email' in updates) row.email = updates.email;
    if ('status' in updates) row.status = updates.status;
    if ('avatar' in updates) row.avatar = updates.avatar;

    try {
      const { error } = await supabase.from('staff').update(row).eq('id', id);
      if (error) console.warn('[Supabase] Direct updateStaff error:', error);
    } catch (e) {
      console.warn('[Supabase] Direct updateStaff failed:', e);
    }

    await fmsDb.enqueueOutbox({
      action: 'UPDATE',
      entityType: 'staff',
      entityId: id,
      payload: row,
      idempotencyKey: `staff-upd-${id}-${Date.now()}`
    });
    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
  },

  async deleteStaff(id: string): Promise<void> {
    const index = localStaff.findIndex(s => s.id === id);
    if (index !== -1) {
      localStaff.splice(index, 1);
      removeUserEdit(id);
      try { localStorage.setItem('fms_staff_list_v3', JSON.stringify(localStaff)); } catch (e) {}
      triggerStaffCallbacks();
      await fmsDb.delete('staff', id);
    }

    try {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) console.warn('[Supabase] Direct deleteStaff error:', error);
    } catch (e) {
      console.warn('[Supabase] Direct deleteStaff failed:', e);
    }

    await fmsDb.enqueueOutbox({
      action: 'DELETE',
      entityType: 'staff',
      entityId: id,
      payload: null,
      idempotencyKey: `staff-del-${id}-${Date.now()}`
    });
    syncEngine.flushOutbox().catch(e => console.warn('[Outbox] Background sync queued offline:', e));
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
      const res = await fetch(`${this._bqBase()}/external-flights`, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return data.flights || [];
      }
      throw new Error(`BigQuery API proxy returned status ${res.status}`);
    } catch (error) {
      console.warn('[BigQuery] getExternalFlights unavailable –', (error as Error)?.message || '');
      return [];
    }
  },

  // ── App Settings (Service Tank) ─────────────────────────────────────────────
  async getServiceTank(): Promise<string | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'service_tank')
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] getServiceTank failed:', error);
      return null;
    }
    if (data && data.value && typeof data.value === 'object' && 'tankId' in data.value) {
      return (data.value as any).tankId;
    }
    return null;
  },

  async setServiceTank(tankId: string): Promise<void> {
    const { error } = await supabase.from('app_settings').upsert({
      key: 'service_tank',
      value: { tankId },
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.error('[Supabase] setServiceTank failed:', error);
      throw error;
    }
  },

  subscribeToAppSettings(callback: (key: string, value: any) => void) {
    const channel = supabase
      .channel('app_settings-changes-' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload: any) => {
          const row = payload.new;
          if (row && row.key) {
            callback(row.key, row.value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // ── Vessels (CRUD, Admin Panel) ──────────────────────────────────────────────
  subscribeToVessels(callback: (vessels: Vessel[]) => void) {
    const channel = supabase
      .channel('vessels-changes-' + Date.now() + '-' + Math.floor(Math.random() * 1000))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vessels' },
        async () => {
          const vessels = await supabaseService.getVessels();
          callback(vessels);
        }
      )
      .subscribe();

    supabaseService.getVessels().then(callback);
    vesselCallbacks.add(callback);

    return () => {
      supabase.removeChannel(channel);
      vesselCallbacks.delete(callback);
    };
  },

  async getVessels(): Promise<Vessel[]> {
    const { data, error } = await supabase.from('vessels').select('*').order('name');
    if (error) {
      console.warn('[Supabase] getVessels failed:', error);
      return localVessels;
    }
    if (!data || data.length === 0) {
      return localVessels;
    }
    localVessels = data.map(row => ({
      id: row.id,
      name: row.name,
      imo: row.imo,
      flag: row.flag,
      status: row.status as 'active' | 'inactive',
      created_at: row.created_at
    }));
    return localVessels;
  },

  async addVessel(vessel: Omit<Vessel, 'id' | 'created_at'>): Promise<void> {
    const newId = `vessel-${Date.now()}`;
    const newVessel: Vessel = {
      id: newId,
      ...vessel,
    };
    localVessels.push(newVessel);
    triggerVesselCallbacks();

    const row = {
      name: vessel.name,
      imo: vessel.imo || null,
      flag: vessel.flag || null,
      status: vessel.status,
    };
    const { error } = await supabase.from('vessels').insert([row]);
    if (error) {
      localVessels = localVessels.filter(v => v.id !== newId);
      triggerVesselCallbacks();
      console.error('[Supabase] addVessel failed:', error);
      throw error;
    }
  },

  async updateVessel(id: string, updates: Partial<Omit<Vessel, 'id'>>): Promise<void> {
    const index = localVessels.findIndex(v => v.id === id);
    let original: Vessel | null = null;
    if (index !== -1) {
      original = { ...localVessels[index] };
      localVessels[index] = { ...localVessels[index], ...updates };
      triggerVesselCallbacks();
    }

    const row: Record<string, any> = {};
    if ('name' in updates) row.name = updates.name;
    if ('imo' in updates) row.imo = updates.imo;
    if ('flag' in updates) row.flag = updates.flag;
    if ('status' in updates) row.status = updates.status;

    const { error } = await supabase.from('vessels').update(row).eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localVessels[index] = original;
        triggerVesselCallbacks();
      }
      console.error('[Supabase] updateVessel failed:', error);
      throw error;
    }
  },

  async deleteVessel(id: string): Promise<void> {
    const index = localVessels.findIndex(v => v.id === id);
    let original: Vessel | null = null;
    if (index !== -1) {
      original = { ...localVessels[index] };
      localVessels.splice(index, 1);
      triggerVesselCallbacks();
    }

    const { error } = await supabase.from('vessels').delete().eq('id', id);
    if (error) {
      if (index !== -1 && original) {
        localVessels.splice(index, 0, original);
        triggerVesselCallbacks();
      }
      console.error('[Supabase] deleteVessel failed:', error);
      throw error;
    }
  },

  // ── Airline & Aircraft Master DB ──────────────────────────────────────────────
  unmigratedTables: new Set<string>(['airlines', 'flight_master', 'aircraft_master']),

  async getAirlines(): Promise<AirlineMaster[]> {
    if (!this.unmigratedTables.has('airlines')) {
      try {
        const { data, error } = await supabase.from('airlines').select('*').order('name');
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('airlines');
          }
        } else if (data && data.length > 0) {
          const result: AirlineMaster[] = data.map(row => ({
            id: row.id,
            name: row.name,
            iataCode: row.iata_code || undefined,
            icaoCode: row.icao_code || undefined,
            category: row.category || 'INT',
            isActive: row.is_active ?? true,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          await fmsDb.bulkPut('airlines', result);
          return this.dedupeAirlines(result);
        }
      } catch (e) {
        this.unmigratedTables.add('airlines');
      }
    }
    const cached = await fmsDb.getAll<AirlineMaster>('airlines');
    if (cached && cached.length > 0) return this.dedupeAirlines(cached);
    try {
      const raw = localStorage.getItem('fms_master_airlines');
      const parsed = raw ? JSON.parse(raw) : [];
      if (parsed && parsed.length > 0) return this.dedupeAirlines(parsed);
    } catch (e) {}

    // Auto-seed from bundled master dataset for initial cross-device load
    await this.bulkSeedMasterDB(masterDbData as any[]);
    const freshlySeeded = await fmsDb.getAll<AirlineMaster>('airlines');
    return this.dedupeAirlines(freshlySeeded);
  },

  async clearMasterDB(): Promise<void> {
    try {
      localStorage.removeItem('fms_master_airlines');
      localStorage.removeItem('fms_master_flights');
      localStorage.removeItem('fms_master_aircrafts');
      const allA = await fmsDb.getAll<any>('airlines');
      for (const a of allA) await fmsDb.delete('airlines', a.id);
      const allF = await fmsDb.getAll<any>('flight_master');
      for (const f of allF) await fmsDb.delete('flight_master', f.id);
      const allAc = await fmsDb.getAll<any>('aircraft_master');
      for (const ac of allAc) await fmsDb.delete('aircraft_master', ac.id);
    } catch (e) {}
  },

  async bulkSeedMasterDB(airlineList: Array<{
    airline_name: string;
    category: 'INT' | 'DOM';
    iata?: string;
    icao?: string;
    flights: string[];
    aircrafts: Array<{ aircraft_reg: string; aircraft_type: string }>;
  }>): Promise<{ airlinesCount: number; flightsCount: number; aircraftsCount: number }> {
    await this.clearMasterDB();

    const airlinesToPut: AirlineMaster[] = [];
    const flightsToPut: FlightMaster[] = [];
    const aircraftsToPut: AircraftMaster[] = [];

    for (const item of airlineList) {
      const name = (item.airline_name || '').trim();
      if (!name) continue;
      const u = name.toUpperCase();

      // Rule 1: Exclude EXTRA / ADHOC, LOCAL SALES, OTHERS, MACL
      if (u.includes('EXTRA') || u.includes('ADHOC') || u.includes('LOCAL SALES') || u.includes('OTHERS') || u.includes('MALDIVES AIRPORTS') || u.includes('MACL')) continue;

      // Rule 2: Exclude anything with 0 Registered Aircrafts
      if (!item.aircrafts || item.aircrafts.length === 0) continue;

      const cleanName = (u === 'MALDIVIAN DOMESTIC' || u.includes('ISLAND AVIATION') || u === 'IAS') ? 'Maldivian' : name;
      const airlineId = `airline-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      airlinesToPut.push({
        id: airlineId,
        name: cleanName,
        iataCode: item.iata?.toUpperCase().trim() || undefined,
        icaoCode: item.icao?.toUpperCase().trim() || undefined,
        category: item.category || 'INT',
        isActive: true,
        createdAt: new Date().toISOString()
      });

      for (const fltNo of (item.flights || [])) {
        const cleanFlt = fltNo.trim().toUpperCase();
        if (!cleanFlt) continue;
        const flightId = `flt-${airlineId}-${cleanFlt}`;
        flightsToPut.push({
          id: flightId,
          airlineId,
          airlineName: cleanName,
          flightNumber: cleanFlt,
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }

      for (const ac of (item.aircrafts || [])) {
        const reg = ac.aircraft_reg?.trim().toUpperCase();
        if (!reg) continue;
        const acId = `ac-${reg.replace(/[^a-z0-9]/gi, '-')}`;
        aircraftsToPut.push({
          id: acId,
          airlineId,
          airlineName: cleanName,
          aircraftReg: reg,
          aircraftType: ac.aircraft_type || 'Unknown',
          isActive: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    const dedupedAirlines = this.dedupeAirlines(airlinesToPut);
    const dedupedFlights = this.dedupeFlights(flightsToPut);
    const dedupedAircrafts = this.dedupeAircrafts(aircraftsToPut);

    await fmsDb.bulkPut('airlines', dedupedAirlines);
    await fmsDb.bulkPut('flight_master', dedupedFlights);
    await fmsDb.bulkPut('aircraft_master', dedupedAircrafts);

    try {
      localStorage.setItem('fms_master_airlines', JSON.stringify(dedupedAirlines));
      localStorage.setItem('fms_master_flights', JSON.stringify(dedupedFlights));
      localStorage.setItem('fms_master_aircrafts', JSON.stringify(dedupedAircrafts));
    } catch (e) {}

    // Attempt Supabase cloud batch upsert for central cross-device sync
    if (!this.unmigratedTables.has('airlines')) {
      try {
        const aRows = dedupedAirlines.map(a => ({
          id: a.id,
          name: a.name,
          iata_code: a.iataCode || null,
          icao_code: a.icaoCode || null,
          category: a.category || 'INT',
          is_active: a.isActive
        }));
        const { error: aErr } = await supabase.from('airlines').upsert(aRows);
        if (aErr && (aErr.code === 'PGRST205' || aErr.message?.includes('schema cache'))) {
          this.unmigratedTables.add('airlines');
        }
      } catch (e) {
        this.unmigratedTables.add('airlines');
      }
    }

    if (!this.unmigratedTables.has('flight_master')) {
      try {
        const fRows = dedupedFlights.map(f => ({
          id: f.id,
          airline_id: f.airlineId,
          airline_name: f.airlineName,
          flight_number: f.flightNumber,
          is_active: f.isActive
        }));
        const { error: fErr } = await supabase.from('flight_master').upsert(fRows);
        if (fErr && (fErr.code === 'PGRST205' || fErr.message?.includes('schema cache'))) {
          this.unmigratedTables.add('flight_master');
        }
      } catch (e) {
        this.unmigratedTables.add('flight_master');
      }
    }

    if (!this.unmigratedTables.has('aircraft_master')) {
      try {
        const acRows = dedupedAircrafts.map(ac => ({
          id: ac.id,
          airline_id: ac.airlineId,
          airline_name: ac.airlineName,
          aircraft_reg: ac.aircraftReg,
          aircraft_type: ac.aircraftType,
          is_active: ac.isActive
        }));
        const { error: acErr } = await supabase.from('aircraft_master').upsert(acRows);
        if (acErr && (acErr.code === 'PGRST205' || acErr.message?.includes('schema cache'))) {
          this.unmigratedTables.add('aircraft_master');
        }
      } catch (e) {
        this.unmigratedTables.add('aircraft_master');
      }
    }

    return {
      airlinesCount: dedupedAirlines.length,
      flightsCount: dedupedFlights.length,
      aircraftsCount: dedupedAircrafts.length
    };
  },

  dedupeAirlines(list: AirlineMaster[]): AirlineMaster[] {
    const map = new Map<string, AirlineMaster>();
    for (const item of list) {
      let name = item.name.trim();
      const u = name.toUpperCase();
      if (u === 'MALDIVIAN DOMESTIC' || u.includes('ISLAND AVIATION') || u === 'IAS') name = 'Maldivian';
      if (u.includes('FLYME') || u.includes('VILLA AIR')) name = 'Villa Air';
      const key = name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { ...item, name });
      }
    }
    return Array.from(map.values());
  },

  async addAirline(name: string, iataCode?: string, icaoCode?: string, category: 'INT' | 'DOM' = 'INT'): Promise<AirlineMaster> {
    const cleanName = name.trim();
    const existing = await this.getAirlines();
    const existingItem = existing.find(a => a.name.toUpperCase() === cleanName.toUpperCase());

    if (existingItem) {
      const updated = {
        ...existingItem,
        iataCode: iataCode?.toUpperCase().trim() || existingItem.iataCode,
        icaoCode: icaoCode?.toUpperCase().trim() || existingItem.icaoCode,
        category: category || existingItem.category || 'INT'
      };
      await this.updateAirline(existingItem.id, updated);
      return updated;
    }

    const row = {
      name: cleanName,
      iata_code: iataCode?.toUpperCase().trim() || null,
      icao_code: icaoCode?.toUpperCase().trim() || null,
      category: category,
      is_active: true
    };

    if (!this.unmigratedTables.has('airlines')) {
      try {
        const { data, error } = await supabase.from('airlines').insert([row]).select().single();
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('airlines');
          }
        } else if (data) {
          const created: AirlineMaster = {
            id: data.id,
            name: data.name,
            iataCode: data.iata_code || undefined,
            icaoCode: data.icao_code || undefined,
            category: data.category || category,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
          await fmsDb.put('airlines', created);
          return created;
        }
      } catch (e) {
        this.unmigratedTables.add('airlines');
      }
    }

    // Local Fallback
    const created: AirlineMaster = {
      id: `airline-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: cleanName,
      iataCode: iataCode?.toUpperCase().trim() || undefined,
      icaoCode: icaoCode?.toUpperCase().trim() || undefined,
      category: category,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await fmsDb.put('airlines', created);
    const updatedList = this.dedupeAirlines([...existing, created]);
    try { localStorage.setItem('fms_master_airlines', JSON.stringify(updatedList)); } catch (e) {}
    return created;
  },

  async updateAirline(id: string, updates: Partial<AirlineMaster>): Promise<void> {
    if (!this.unmigratedTables.has('airlines')) {
      const row: Record<string, any> = {};
      if ('name' in updates && updates.name) row.name = updates.name.trim();
      if ('iataCode' in updates) row.iata_code = updates.iataCode?.toUpperCase().trim() || null;
      if ('icaoCode' in updates) row.icao_code = updates.icaoCode?.toUpperCase().trim() || null;
      if ('category' in updates) row.category = updates.category;
      if ('isActive' in updates) row.is_active = updates.isActive;

      try {
        const { error } = await supabase.from('airlines').update(row).eq('id', id);
        if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          this.unmigratedTables.add('airlines');
        }
      } catch (e) {
        this.unmigratedTables.add('airlines');
      }
    }

    const existing = await this.getAirlines();
    const idx = existing.findIndex(a => a.id === id || a.name.toUpperCase() === (updates.name || '').toUpperCase());
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      await fmsDb.put('airlines', existing[idx]);
      try { localStorage.setItem('fms_master_airlines', JSON.stringify(existing)); } catch (e) {}
    }
  },

  async deleteAirline(id: string): Promise<void> {
    if (!this.unmigratedTables.has('airlines')) {
      try {
        await supabase.from('airlines').delete().eq('id', id);
      } catch (e) {}
    }
    await fmsDb.delete('airlines', id);
    const existing = await this.getAirlines();
    const filtered = existing.filter(a => a.id !== id);
    try { localStorage.setItem('fms_master_airlines', JSON.stringify(filtered)); } catch (e) {}
  },

  async getFlightMaster(): Promise<FlightMaster[]> {
    if (!this.unmigratedTables.has('flight_master')) {
      try {
        const { data, error } = await supabase.from('flight_master').select('*').order('flight_number');
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('flight_master');
          }
        } else if (data && data.length > 0) {
          const result: FlightMaster[] = data.map(row => ({
            id: row.id,
            airlineId: row.airline_id,
            airlineName: row.airline_name,
            flightNumber: row.flight_number,
            route: row.route || undefined,
            isActive: row.is_active ?? true,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          await fmsDb.bulkPut('flight_master', result);
          return this.dedupeFlights(result);
        }
      } catch (e) {
        this.unmigratedTables.add('flight_master');
      }
    }
    const cached = await fmsDb.getAll<FlightMaster>('flight_master');
    if (cached && cached.length > 0) return this.dedupeFlights(cached);
    try {
      const raw = localStorage.getItem('fms_master_flights');
      return this.dedupeFlights(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return [];
    }
  },

  dedupeFlights(list: FlightMaster[]): FlightMaster[] {
    const map = new Map<string, FlightMaster>();
    for (const item of list) {
      let airlineName = item.airlineName.trim();
      const u = airlineName.toUpperCase();
      if (u === 'MALDIVIAN DOMESTIC' || u.includes('ISLAND AVIATION') || u === 'IAS') airlineName = 'Maldivian';
      if (u.includes('FLYME') || u.includes('VILLA AIR')) airlineName = 'Villa Air';
      const key = `${airlineName.toUpperCase()}|${item.flightNumber.trim().toUpperCase()}`;
      if (!map.has(key)) map.set(key, { ...item, airlineName });
    }
    return Array.from(map.values());
  },

  async addFlightMaster(airlineId: string, airlineName: string, flightNumber: string, route?: string): Promise<FlightMaster> {
    const cleanFlt = flightNumber.toUpperCase().trim();
    const cleanAirline = airlineName.trim();
    const existing = await this.getFlightMaster();
    const existingItem = existing.find(f => f.airlineName.toUpperCase() === cleanAirline.toUpperCase() && f.flightNumber.toUpperCase() === cleanFlt);

    if (existingItem) {
      const updated = {
        ...existingItem,
        route: route?.trim() || existingItem.route
      };
      await this.updateFlightMaster(existingItem.id, updated);
      return updated;
    }

    const row = {
      airline_id: airlineId,
      airline_name: cleanAirline,
      flight_number: cleanFlt,
      route: route?.trim() || null,
      is_active: true
    };

    if (!this.unmigratedTables.has('flight_master')) {
      try {
        const { data, error } = await supabase.from('flight_master').insert([row]).select().single();
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('flight_master');
          }
        } else if (data) {
          const created: FlightMaster = {
            id: data.id,
            airlineId: data.airline_id,
            airlineName: data.airline_name,
            flightNumber: data.flight_number,
            route: data.route || undefined,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
          await fmsDb.put('flight_master', created);
          return created;
        }
      } catch (e) {
        this.unmigratedTables.add('flight_master');
      }
    }

    // Local Fallback
    const created: FlightMaster = {
      id: `flt-${cleanAirline.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${cleanFlt.toLowerCase()}`,
      airlineId,
      airlineName: cleanAirline,
      flightNumber: cleanFlt,
      route: route?.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await fmsDb.put('flight_master', created);
    const updatedList = this.dedupeFlights([...existing, created]);
    try { localStorage.setItem('fms_master_flights', JSON.stringify(updatedList)); } catch (e) {}
    return created;
  },

  async updateFlightMaster(id: string, updates: Partial<FlightMaster>): Promise<void> {
    if (!this.unmigratedTables.has('flight_master')) {
      const row: Record<string, any> = {};
      if ('flightNumber' in updates && updates.flightNumber) row.flight_number = updates.flightNumber.toUpperCase().trim();
      if ('route' in updates) row.route = updates.route?.trim() || null;
      if ('isActive' in updates) row.is_active = updates.isActive;

      try {
        const { error } = await supabase.from('flight_master').update(row).eq('id', id);
        if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          this.unmigratedTables.add('flight_master');
        }
      } catch (e) {
        this.unmigratedTables.add('flight_master');
      }
    }

    const existing = await this.getFlightMaster();
    const idx = existing.findIndex(f => f.id === id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      await fmsDb.put('flight_master', existing[idx]);
      try { localStorage.setItem('fms_master_flights', JSON.stringify(existing)); } catch (e) {}
    }
  },

  async deleteFlightMaster(id: string): Promise<void> {
    if (!this.unmigratedTables.has('flight_master')) {
      try {
        await supabase.from('flight_master').delete().eq('id', id);
      } catch (e) {}
    }
    await fmsDb.delete('flight_master', id);
    const existing = await this.getFlightMaster();
    const filtered = existing.filter(f => f.id !== id);
    try { localStorage.setItem('fms_master_flights', JSON.stringify(filtered)); } catch (e) {}
  },

  async getAircraftMaster(): Promise<AircraftMaster[]> {
    if (!this.unmigratedTables.has('aircraft_master')) {
      try {
        const { data, error } = await supabase.from('aircraft_master').select('*').order('aircraft_reg');
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('aircraft_master');
          }
        } else if (data && data.length > 0) {
          const result: AircraftMaster[] = data.map(row => ({
            id: row.id,
            airlineId: row.airline_id,
            airlineName: row.airline_name,
            aircraftReg: row.aircraft_reg,
            aircraftType: row.aircraft_type,
            isActive: row.is_active ?? true,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          await fmsDb.bulkPut('aircraft_master', result);
          return this.dedupeAircrafts(result);
        }
      } catch (e) {
        this.unmigratedTables.add('aircraft_master');
      }
    }
    const cached = await fmsDb.getAll<AircraftMaster>('aircraft_master');
    if (cached && cached.length > 0) return this.dedupeAircrafts(cached);
    try {
      const raw = localStorage.getItem('fms_master_aircrafts');
      return this.dedupeAircrafts(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return [];
    }
  },

  dedupeAircrafts(list: AircraftMaster[]): AircraftMaster[] {
    const map = new Map<string, AircraftMaster>();
    for (const item of list) {
      let airlineName = item.airlineName.trim();
      const u = airlineName.toUpperCase();
      if (u === 'MALDIVIAN DOMESTIC' || u.includes('ISLAND AVIATION') || u === 'IAS') airlineName = 'Maldivian';
      if (u.includes('FLYME') || u.includes('VILLA AIR')) airlineName = 'Villa Air';
      const key = item.aircraftReg.trim().toUpperCase();
      if (!map.has(key)) map.set(key, { ...item, airlineName });
    }
    return Array.from(map.values());
  },

  async addAircraftMaster(airlineId: string, airlineName: string, aircraftReg: string, aircraftType: string): Promise<AircraftMaster> {
    const cleanReg = aircraftReg.toUpperCase().trim();
    const cleanType = aircraftType.trim();
    const cleanAirline = airlineName.trim();
    const existing = await this.getAircraftMaster();
    const existingItem = existing.find(a => a.aircraftReg.toUpperCase() === cleanReg);

    if (existingItem) {
      const updated = {
        ...existingItem,
        aircraftType: cleanType,
        airlineName: cleanAirline
      };
      await this.updateAircraftMaster(existingItem.id, updated);
      return updated;
    }

    const row = {
      airline_id: airlineId,
      airline_name: cleanAirline,
      aircraft_reg: cleanReg,
      aircraft_type: cleanType,
      is_active: true
    };

    if (!this.unmigratedTables.has('aircraft_master')) {
      try {
        const { data, error } = await supabase.from('aircraft_master').insert([row]).select().single();
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            this.unmigratedTables.add('aircraft_master');
          }
        } else if (data) {
          const created: AircraftMaster = {
            id: data.id,
            airlineId: data.airline_id,
            airlineName: data.airline_name,
            aircraftReg: data.aircraft_reg,
            aircraftType: data.aircraft_type,
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
          await fmsDb.put('aircraft_master', created);
          return created;
        }
      } catch (e) {
        this.unmigratedTables.add('aircraft_master');
      }
    }

    // Local Fallback
    const created: AircraftMaster = {
      id: `ac-${cleanReg.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      airlineId,
      airlineName: cleanAirline,
      aircraftReg: cleanReg,
      aircraftType: cleanType,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await fmsDb.put('aircraft_master', created);
    const updatedList = this.dedupeAircrafts([...existing, created]);
    try { localStorage.setItem('fms_master_aircrafts', JSON.stringify(updatedList)); } catch (e) {}
    return created;
  },

  async updateAircraftMaster(id: string, updates: Partial<AircraftMaster>): Promise<void> {
    if (!this.unmigratedTables.has('aircraft_master')) {
      const row: Record<string, any> = {};
      if ('aircraftReg' in updates && updates.aircraftReg) row.aircraft_reg = updates.aircraftReg.toUpperCase().trim();
      if ('aircraftType' in updates && updates.aircraftType) row.aircraft_type = updates.aircraftType.trim();
      if ('isActive' in updates) row.is_active = updates.isActive;

      try {
        const { error } = await supabase.from('aircraft_master').update(row).eq('id', id);
        if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          this.unmigratedTables.add('aircraft_master');
        }
      } catch (e) {
        this.unmigratedTables.add('aircraft_master');
      }
    }

    const existing = await this.getAircraftMaster();
    const idx = existing.findIndex(a => a.id === id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updates };
      await fmsDb.put('aircraft_master', existing[idx]);
      try { localStorage.setItem('fms_master_aircrafts', JSON.stringify(existing)); } catch (e) {}
    }
  },

  async deleteAircraftMaster(id: string): Promise<void> {
    if (!this.unmigratedTables.has('aircraft_master')) {
      try {
        await supabase.from('aircraft_master').delete().eq('id', id);
      } catch (e) {}
    }
    await fmsDb.delete('aircraft_master', id);
    const existing = await this.getAircraftMaster();
    const filtered = existing.filter(a => a.id !== id);
    try { localStorage.setItem('fms_master_aircrafts', JSON.stringify(filtered)); } catch (e) {}
  },

  async getMasterDBHierarchy(): Promise<AirlineHierarchyNode[]> {
    const [rawAirlines, rawFlights, rawAircrafts] = await Promise.all([
      this.getAirlines(),
      this.getFlightMaster(),
      this.getAircraftMaster()
    ]);

    const airlines = this.dedupeAirlines(rawAirlines);
    const flights = this.dedupeFlights(rawFlights);
    const aircrafts = this.dedupeAircrafts(rawAircrafts);

    const hierarchy: AirlineHierarchyNode[] = airlines.map(airline => {
      const airlineFlights = flights.filter(f => f.airlineId === airline.id || f.airlineName.toLowerCase() === airline.name.toLowerCase());
      const airlineAircrafts = aircrafts.filter(a => a.airlineId === airline.id || a.airlineName.toLowerCase() === airline.name.toLowerCase());

      return {
        airline,
        flights: this.dedupeFlights(airlineFlights),
        aircrafts: this.dedupeAircrafts(airlineAircrafts)
      };
    });

    return hierarchy;
  }
};

