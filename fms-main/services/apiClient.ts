import { supabase } from '../supabase';
import { Tank, FlightJob, Equipment, StaffMember, Alert, Vessel, AirlineMaster, FlightMaster, AircraftMaster, AirlineHierarchyNode, InternationalSchedule, DelayLog } from '../types';
import { CustomerAccount, UpcomingPayment, Invoice, Receipt, ProformaRecord, FuelRequest, MonthEndVariance, ProcurementPR, SurchargeRecord, MpdSale, CustomsShipment } from '../context/FinanceDataContext';

// Deduplication map for concurrent GET requests
const inFlightRequests = new Map<string, Promise<any>>();

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_BIGQUERY_API_URL;
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost && envUrl && envUrl.includes('localhost')) {
    return envUrl;
  }
  return (envUrl && !envUrl.includes('localhost')) 
    ? envUrl 
    : 'https://fms-bigquery-api-808402455416.us-central1.run.app';
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
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
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : '/' + path}`;

  // Deduplicate concurrent GET requests
  const cacheKey = `${method}:${url}`;
  if (method === 'GET' && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const exec = async (): Promise<T> => {
    const authHeaders = await getAuthHeaders();
    const headers = {
      ...authHeaders,
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errorBody.error || `HTTP error ${res.status}`);
    }

    return res.json() as Promise<T>;
  };

  if (method === 'GET') {
    const promise = exec().finally(() => inFlightRequests.delete(cacheKey));
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return exec();
}

export const api = {
  // ── Tanks ──────────────────────────────────────────────────────────────────
  tanks: {
    getAll: async () => {
      const data = await apiFetch<{ tanks: Tank[] }>('/tanks');
      return data.tanks || [];
    },
    getById: async (id: string) => {
      const data = await apiFetch<{ tank: Tank }>(`/tanks/${encodeURIComponent(id)}`);
      return data.tank;
    },
    create: (tank: Partial<Tank>) => apiFetch<{ tank: Tank }>('/tanks', {
      method: 'POST',
      body: JSON.stringify(tank)
    }),
    update: (id: string, updates: Partial<Tank>) => apiFetch<{ success: boolean }>(`/tanks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/tanks/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    getCalibration: async (tankId: string) => {
      const data = await apiFetch<{ points: Array<{ id: string; tankId: string; heightCm: number; volumeLiters: number }> }>(`/tanks/${encodeURIComponent(tankId)}/calibration`);
      return data.points || [];
    },
    addCalibration: (tankId: string, heightCm: number, volumeLiters: number) => apiFetch(`/tanks/${encodeURIComponent(tankId)}/calibration`, {
      method: 'POST',
      body: JSON.stringify({ heightCm, volumeLiters })
    }),
    deleteCalibration: (tankId: string, pointId: string) => apiFetch(`/tanks/${encodeURIComponent(tankId)}/calibration/${encodeURIComponent(pointId)}`, {
      method: 'DELETE'
    })
  },

  // ── Flight Jobs ────────────────────────────────────────────────────────────
  flightJobs: {
    getAll: async (filters?: { status?: string; flightNumber?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.flightNumber) params.append('flightNumber', filters.flightNumber);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<{ jobs: FlightJob[] }>(`/flight-jobs${query}`);
      return data.jobs || [];
    },
    create: (job: FlightJob) => apiFetch<{ job: FlightJob }>('/flight-jobs', {
      method: 'POST',
      body: JSON.stringify(job)
    }),
    update: (id: string, updates: Partial<FlightJob>) => apiFetch<{ success: boolean; job: FlightJob }>(`/flight-jobs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/flight-jobs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    clearAll: () => apiFetch<{ success: boolean }>('/flight-jobs', {
      method: 'DELETE'
    })
  },

  // ── Equipment ──────────────────────────────────────────────────────────────
  equipment: {
    getAll: async () => {
      const data = await apiFetch<{ equipment: Equipment[] }>('/equipment');
      return data.equipment || [];
    },
    create: (eq: Partial<Equipment>) => apiFetch<{ equipment: Equipment }>('/equipment', {
      method: 'POST',
      body: JSON.stringify(eq)
    }),
    update: (id: string, updates: Partial<Equipment>) => apiFetch<{ success: boolean; equipment: Equipment }>(`/equipment/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    updateStatus: (id: string, status: string) => apiFetch<{ success: boolean }>(`/equipment/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/equipment/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },

  // ── Staff ──────────────────────────────────────────────────────────────────
  staff: {
    getAll: async () => {
      const data = await apiFetch<{ staff: StaffMember[] }>('/staff');
      return data.staff || [];
    },
    find: async (identifier: string) => {
      const data = await apiFetch<{ staff: StaffMember }>(`/staff/find?identifier=${encodeURIComponent(identifier)}`);
      return data.staff;
    },
    create: (member: Partial<StaffMember>) => apiFetch<{ staff: StaffMember }>('/staff', {
      method: 'POST',
      body: JSON.stringify(member)
    }),
    update: (id: string, updates: Partial<StaffMember>) => apiFetch<{ success: boolean; staff: StaffMember }>(`/staff/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/staff/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },

  // ── Alerts ─────────────────────────────────────────────────────────────────
  alerts: {
    getAll: async (unacknowledgedOnly = false) => {
      const query = unacknowledgedOnly ? '?unacknowledgedOnly=true' : '';
      const data = await apiFetch<{ alerts: Alert[] }>(`/alerts${query}`);
      return data.alerts || [];
    },
    create: (alert: Partial<Alert>) => apiFetch<{ alert: Alert }>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert)
    }),
    acknowledge: (id: string, ackData?: { acknowledgedAt?: string; acknowledgedBy?: string }) => apiFetch<{ success: boolean }>(`/alerts/${encodeURIComponent(id)}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify(ackData || {})
    }),
    acknowledgeBulk: (ids: string[], ackData?: { acknowledgedAt?: string; acknowledgedBy?: string }) => apiFetch<{ success: boolean }>('/alerts/acknowledge-bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, ...ackData })
    }),
    deleteBulk: (ids: string[]) => apiFetch<{ success: boolean }>('/alerts/delete-bulk', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
  },

  // ── Vessels ────────────────────────────────────────────────────────────────
  vessels: {
    getAll: async () => {
      const data = await apiFetch<{ vessels: Vessel[] }>('/vessels');
      return data.vessels || [];
    },
    create: (vessel: Partial<Vessel>) => apiFetch<{ vessel: Vessel }>('/vessels', {
      method: 'POST',
      body: JSON.stringify(vessel)
    }),
    update: (id: string, updates: Partial<Vessel>) => apiFetch<{ success: boolean; vessel: Vessel }>(`/vessels/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/vessels/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },

  // ── Master Data ────────────────────────────────────────────────────────────
  master: {
    getAirlines: async () => {
      const data = await apiFetch<{ airlines: AirlineMaster[] }>('/master/airlines');
      return data.airlines || [];
    },
    createAirline: (airline: Partial<AirlineMaster>) => apiFetch<{ airline: AirlineMaster }>('/master/airlines', {
      method: 'POST',
      body: JSON.stringify(airline)
    }),
    updateAirline: (id: string, updates: Partial<AirlineMaster>) => apiFetch<{ success: boolean; airline: AirlineMaster }>(`/master/airlines/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    deleteAirline: (id: string) => apiFetch<{ success: boolean }>(`/master/airlines/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    getFlights: async (airlineId?: string) => {
      const query = airlineId ? `?airlineId=${encodeURIComponent(airlineId)}` : '';
      const data = await apiFetch<{ flights: FlightMaster[] }>(`/master/flights${query}`);
      return data.flights || [];
    },
    createFlight: (flight: Partial<FlightMaster>) => apiFetch<{ flight: FlightMaster }>('/master/flights', {
      method: 'POST',
      body: JSON.stringify(flight)
    }),
    updateFlight: (id: string, updates: Partial<FlightMaster>) => apiFetch<{ success: boolean; flight: FlightMaster }>(`/master/flights/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    deleteFlight: (id: string) => apiFetch<{ success: boolean }>(`/master/flights/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    getAircraft: async (airlineId?: string) => {
      const query = airlineId ? `?airlineId=${encodeURIComponent(airlineId)}` : '';
      const data = await apiFetch<{ aircraft: AircraftMaster[] }>(`/master/aircraft${query}`);
      return data.aircraft || [];
    },
    createAircraft: (aircraft: Partial<AircraftMaster>) => apiFetch<{ aircraft: AircraftMaster }>('/master/aircraft', {
      method: 'POST',
      body: JSON.stringify(aircraft)
    }),
    updateAircraft: (id: string, updates: Partial<AircraftMaster>) => apiFetch<{ success: boolean; aircraft: AircraftMaster }>(`/master/aircraft/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    deleteAircraft: (id: string) => apiFetch<{ success: boolean }>(`/master/aircraft/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    getHierarchy: async () => {
      const data = await apiFetch<{ hierarchy: AirlineHierarchyNode[] }>('/master/hierarchy');
      return data.hierarchy || [];
    },
    seed: (data: { airlines?: any[]; flights?: any[]; aircraft?: any[] }) => apiFetch<{ success: boolean }>('/master/seed', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ── International Schedules ────────────────────────────────────────────────
  schedules: {
    getAll: async (filters?: { flightNumber?: string; airlineName?: string; isActive?: boolean }) => {
      const params = new URLSearchParams();
      if (filters?.flightNumber) params.append('flightNumber', filters.flightNumber);
      if (filters?.airlineName) params.append('airlineName', filters.airlineName);
      if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<{ schedules: InternationalSchedule[] }>(`/schedules${query}`);
      return data.schedules || [];
    },
    save: (schedule: InternationalSchedule) => apiFetch<{ schedule: InternationalSchedule }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule)
    }),
    bulkSave: (schedules: InternationalSchedule[]) => apiFetch<{ success: boolean; count: number }>('/schedules/bulk', {
      method: 'POST',
      body: JSON.stringify({ schedules })
    }),
    toggleActive: (id: string, isActive: boolean) => apiFetch<{ success: boolean }>(`/schedules/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
    clearAll: () => apiFetch<{ success: boolean }>('/schedules', {
      method: 'DELETE'
    })
  },

  // ── Shift Briefing & Assignments ───────────────────────────────────────────
  shiftBriefing: {
    get: async (date: string, shift: string) => {
      const data = await apiFetch<{ briefing: { info: any[]; dieselNeeds: string[]; staffAssignments: any } }>(`/shift-briefing?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`);
      return data.briefing;
    },
    save: (date: string, shift: string, info: any[], dieselNeeds: string[], staffAssignments: any) => apiFetch<{ success: boolean }>('/shift-briefing', {
      method: 'POST',
      body: JSON.stringify({ date, shift, info, dieselNeeds, staffAssignments })
    }),
    clearAll: () => apiFetch<{ success: boolean }>('/shift-briefing', {
      method: 'DELETE'
    }),
    getDomesticAssignments: async (date: string) => {
      const data = await apiFetch<{ assignments: any[] }>(`/shift-briefing/assignments/domestic?date=${encodeURIComponent(date)}`);
      return data.assignments || [];
    },
    saveDomesticAssignment: (date: string, teamName: string, op1: string, op2: string) => apiFetch<{ success: boolean }>('/shift-briefing/assignments/domestic', {
      method: 'POST',
      body: JSON.stringify({ date, teamName, op1, op2 })
    }),
    getEquipmentAssignments: async (date: string, shiftType?: string) => {
      const query = shiftType ? `&shiftType=${encodeURIComponent(shiftType)}` : '';
      const data = await apiFetch<{ assignments: any[] }>(`/shift-briefing/assignments/equipment?date=${encodeURIComponent(date)}${query}`);
      return data.assignments || [];
    },
    saveEquipmentAssignment: (date: string, eqId: string, shiftType: string, op1: string, op2: string) => apiFetch<{ success: boolean }>('/shift-briefing/assignments/equipment', {
      method: 'POST',
      body: JSON.stringify({ date, eqId, shiftType, op1, op2 })
    })
  },

  // ── Delay Logs ─────────────────────────────────────────────────────────────
  delayLogs: {
    getAll: async (filters?: { startDate?: string; endDate?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.status) params.append('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<{ logs: DelayLog[] }>(`/delay-logs${query}`);
      return data.logs || [];
    },
    create: async (log: Omit<DelayLog, 'id'>) => {
      const data = await apiFetch<{ log: DelayLog }>('/delay-logs', {
        method: 'POST',
        body: JSON.stringify(log)
      });
      return data.log;
    },
    update: (id: string, updates: Partial<DelayLog>) => apiFetch<{ success: boolean; log: DelayLog }>(`/delay-logs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => apiFetch<{ success: boolean }>(`/delay-logs/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    })
  },

  // ── Finance Collections ────────────────────────────────────────────────────
  finance: {
    getCustomers: async () => {
      const data = await apiFetch<{ customers: CustomerAccount[] }>('/finance/customers');
      return data.customers || [];
    },
    upsertCustomers: (customers: CustomerAccount[]) => apiFetch<{ success: boolean }>('/finance/customers/upsert', {
      method: 'POST',
      body: JSON.stringify({ customers })
    }),
    getUpcomingPayments: async () => {
      const data = await apiFetch<{ payments: UpcomingPayment[] }>('/finance/upcoming-payments');
      return data.payments || [];
    },
    createUpcomingPayment: (payment: UpcomingPayment) => apiFetch<{ success: boolean }>('/finance/upcoming-payments', {
      method: 'POST',
      body: JSON.stringify(payment)
    }),
    updateUpcomingPayment: (id: string, updates: Partial<UpcomingPayment>) => apiFetch<{ success: boolean }>(`/finance/upcoming-payments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    getInvoices: async () => {
      const data = await apiFetch<{ invoices: Invoice[] }>('/finance/invoices');
      return data.invoices || [];
    },
    createInvoice: (invoice: Invoice) => apiFetch<{ success: boolean }>('/finance/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice)
    }),
    upsertInvoices: (invoices: Invoice[]) => apiFetch<{ success: boolean }>('/finance/invoices/upsert-bulk', {
      method: 'POST',
      body: JSON.stringify({ invoices })
    }),
    getReceipts: async () => {
      const data = await apiFetch<{ receipts: Receipt[] }>('/finance/receipts');
      return data.receipts || [];
    },
    createReceipt: (receipt: Receipt) => apiFetch<{ success: boolean }>('/finance/receipts', {
      method: 'POST',
      body: JSON.stringify(receipt)
    }),
    upsertReceipts: (receipts: Receipt[]) => apiFetch<{ success: boolean }>('/finance/receipts/upsert-bulk', {
      method: 'POST',
      body: JSON.stringify({ receipts })
    }),
    getProforma: async () => {
      const data = await apiFetch<{ records: ProformaRecord[] }>('/finance/proforma');
      return data.records || [];
    },
    createProforma: (record: ProformaRecord) => apiFetch<{ success: boolean }>('/finance/proforma', {
      method: 'POST',
      body: JSON.stringify(record)
    }),
    getFuelRequests: async () => {
      const data = await apiFetch<{ requests: FuelRequest[] }>('/finance/fuel-requests');
      return data.requests || [];
    },
    createFuelRequest: (request: FuelRequest) => apiFetch<{ success: boolean }>('/finance/fuel-requests', {
      method: 'POST',
      body: JSON.stringify(request)
    }),
    updateFuelRequest: (id: string, updates: Partial<FuelRequest>) => apiFetch<{ success: boolean }>(`/finance/fuel-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    getVariances: async () => {
      const data = await apiFetch<{ logs: MonthEndVariance[] }>('/finance/variances');
      return data.logs || [];
    },
    createVariance: (log: MonthEndVariance) => apiFetch<{ success: boolean }>('/finance/variances', {
      method: 'POST',
      body: JSON.stringify(log)
    }),
    updateVariance: (id: string, updates: Partial<MonthEndVariance>) => apiFetch<{ success: boolean }>(`/finance/variances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    getProcurement: async () => {
      const data = await apiFetch<{ prs: ProcurementPR[] }>('/finance/procurement');
      return data.prs || [];
    },
    createProcurement: (pr: ProcurementPR) => apiFetch<{ success: boolean }>('/finance/procurement', {
      method: 'POST',
      body: JSON.stringify(pr)
    }),
    updateProcurement: (id: string, updates: Partial<ProcurementPR>) => apiFetch<{ success: boolean }>(`/finance/procurement/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
    getSurcharges: async () => {
      const data = await apiFetch<{ surcharges: SurchargeRecord[] }>('/finance/surcharges');
      return data.surcharges || [];
    },
    createSurcharge: (surcharge: SurchargeRecord) => apiFetch<{ success: boolean }>('/finance/surcharges', {
      method: 'POST',
      body: JSON.stringify(surcharge)
    }),
    getMpdSales: async () => {
      const data = await apiFetch<{ sales: MpdSale[] }>('/finance/mpd-sales');
      return data.sales || [];
    },
    createMpdSale: (sale: MpdSale) => apiFetch<{ success: boolean }>('/finance/mpd-sales', {
      method: 'POST',
      body: JSON.stringify(sale)
    }),
    getCustoms: async () => {
      const data = await apiFetch<{ shipments: CustomsShipment[] }>('/finance/customs');
      return data.shipments || [];
    },
    createCustoms: (shipment: CustomsShipment) => apiFetch<{ success: boolean }>('/finance/customs', {
      method: 'POST',
      body: JSON.stringify(shipment)
    })
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    getServiceTank: async () => {
      const data = await apiFetch<{ tankId: string | null }>('/settings/service-tank');
      return data.tankId;
    },
    setServiceTank: (tankId: string) => apiFetch<{ success: boolean }>('/settings/service-tank', {
      method: 'POST',
      body: JSON.stringify({ tankId })
    })
  },

  // ── Activity Logs ──────────────────────────────────────────────────────────
  activityLogs: {
    getAll: async (filters?: { module?: string; action?: string; userId?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.module) params.append('module', filters.module);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.limit) params.append('limit', String(filters.limit));
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiFetch<{ logs: any[] }>(`/activity-logs${query}`);
      return data.logs || [];
    },
    log: (logData: any) => apiFetch<{ success: boolean }>('/activity-logs', {
      method: 'POST',
      body: JSON.stringify(logData)
    })
  }
};
