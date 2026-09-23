
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Equipment, Tank, FlightJob, EquipmentStatus as EqStatus, Alert, FlightLog, StaffMember, UserRole, Vessel, ShipmentData, InternationalSchedule, ScheduleCrossCheckResult, PredictiveUpliftForecast, isDomesticFlight, DelayLog } from '../types';
import { EQUIPMENT, TANKS, MOCK_ALERTS } from '../constants';
import { supabaseService } from '../services/supabaseService';
import { scheduleImportService } from '../services/scheduleImportService';
import { supabase } from '../supabase';
import { sendNativeNotification } from '../utils/pwa';
import { cleanAircraftTypeName } from '../services/aircraftLookupService';

import { INITIAL_STAFF_LIST } from '../constants/staffList';

interface ShiftBriefingInfo {
  info: { text: string; type: string; isHighAlert?: boolean }[];
  dieselNeeds: string[];
  staffAssignments?: {
    activeOperators: string[];
    activeOfficers: string[];
    hydrantOpsOfficers: string[];
    dutySupervisor?: string;
    shiftInCharge?: string;
    dutySupervisors?: string[];
    shiftInCharges?: string[];
    attendees?: string[];
    dailyCompleted?: string[];
    frozenFlights?: {
      intl?: any[];
      domestic?: any[];
      adhoc?: any[];
    } | null;
    adhocFlights?: any[];
    staffStatuses?: Record<string, string>;
  };
}

export type BriefingInfo = ShiftBriefingInfo;

export type BriefingShift = 'Morning' | 'Evening' | 'Night';

interface OperationalDataContextType {
  equipment: Equipment[];
  tanks: Tank[];
  flightJobs: FlightJob[];
  rawFlightJobs: FlightJob[];
  domesticFlights: any[];
  externalFlights: any[];
  isExternalFlightsLoading: boolean;
  refreshExternalFlights: () => Promise<void>;
  briefingInfo: ShiftBriefingInfo;
  selectedBriefingShift: BriefingShift;
  setSelectedBriefingShift: (shift: BriefingShift) => void;
  selectedBriefingDate: string;
  setSelectedBriefingDate: (date: string) => void;
  alerts: Alert[];
  domesticAssignments: any[];
  flightLogs: FlightLog[];
  isAlertsLoading: boolean;
  shipments: ShipmentData[];
  updateShipment: (index: number, fields: Partial<ShipmentData>) => void;
  addShipment: () => void;
  removeShipment: () => void;
  updateEquipmentStatus: (id: string, status: EqStatus) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<void>;
  addEquipment: (eq: Omit<Equipment, 'id' | 'lastUpdated'>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  updateTankLevel: (id: string, newLevel: number) => Promise<void>;
  addTank: (tank: Omit<Tank, 'id' | 'lastUpdated'>) => Promise<void>;
  updateTank: (id: string, updates: Partial<Omit<Tank, 'id'>>) => Promise<void>;
  deleteTank: (id: string) => Promise<void>;
  updateBriefingInfo: (info: any[], dieselNeeds: string[], staffAssignments?: any) => Promise<void>;
  updateFlightJob: (id: string, updates: Partial<FlightJob>) => Promise<void>;
  addFlightJob: (job: FlightJob) => Promise<void>;
  deleteFlightJob: (id: string) => Promise<void>;
  updateFlightLog: (id: string, updates: Partial<FlightLog>) => Promise<void>;
  addFlightLogEntry: (log: FlightLog) => void;
  deleteFlightLogEntry: (id: string, fallbackFlightNumber?: string, fallbackDeliveryNumber?: string) => void;
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  acknowledgeAlert: (id: string, staffName?: string) => Promise<void>;
  acknowledgeAllAlerts: (ids: string[]) => Promise<void>;
  clearAllAlerts: () => Promise<void>;
  deleteAlerts: (ids: string[]) => Promise<void>;
  updateDomesticAssignment: (teamName: string, op1: string, op2: string) => Promise<void>;
  refreshData: () => Promise<void>;
  isLoading: boolean;
  staff: StaffMember[];
  addStaff: (member: Omit<StaffMember, 'id'>) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Omit<StaffMember, 'id'>>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  vessels: Vessel[];
  addVessel: (vessel: Omit<Vessel, 'id' | 'created_at'>) => Promise<void>;
  updateVessel: (id: string, updates: Partial<Omit<Vessel, 'id'>>) => Promise<void>;
  deleteVessel: (id: string) => Promise<void>;
  serviceTankId: string;
  setServiceTankId: (tankId: string) => Promise<void>;
  internationalSchedules: InternationalSchedule[];
  importInternationalSchedules: (schedules: InternationalSchedule[]) => Promise<void>;
  saveInternationalSchedule: (schedule: InternationalSchedule) => Promise<void>;
  deleteInternationalSchedule: (id: string) => Promise<void>;
  deleteAllInternationalSchedules: () => Promise<void>;
  toggleInternationalScheduleActive: (id: string, isActive: boolean) => Promise<void>;
  crossCheckDailyFlights: (dateStr?: string) => ScheduleCrossCheckResult[];
  getPredictiveUpliftForecast: (startDateStr?: string, daysCount?: number, categoryFilter?: 'ALL' | 'INT' | 'DOM') => PredictiveUpliftForecast[];
  delayLogs: DelayLog[];
  createDelayLog: (log: Omit<DelayLog, 'id'>) => Promise<DelayLog>;
  updateDelayLog: (id: string, updates: Partial<DelayLog>) => Promise<void>;
  deleteDelayLog: (id: string) => Promise<void>;
}

const OperationalDataContext = createContext<OperationalDataContextType | undefined>(undefined);

const mapDomesticAssignments = (data: any[]) => {
  return data.map(da => ({
    ...da,
    op1: da.operator1_id || da.op1 || '',
    op2: da.operator2_id || da.op2 || '',
    operator1_id: da.operator1_id || da.op1 || '',
    operator2_id: da.operator2_id || da.op2 || ''
  }));
};

const INITIAL_SHIPMENTS: ShipmentData[] = [
  {
    id: '168',
    shipmentNumber: '168 Delivery',
    shipmentNoCode: 'NS/SHIP-JET A-1/168',
    vessel: 'MT.ALIMAS',
    arrivalDate: '2026-06-12',
    isConfirmed: true,
    isCancelled: false,
    orderQtyMt: 10000,
    averageSales: 552887,
    deadStock: 2500000
  },
  {
    id: '169',
    shipmentNumber: '169 Delivery',
    shipmentNoCode: 'NS/SHIP-JET A-1/169',
    vessel: 'MT.NEON',
    arrivalDate: '2026-07-14',
    isConfirmed: false,
    isCancelled: false,
    orderQtyMt: 13000,
    averageSales: 665000,
    deadStock: 2500000
  },
  {
    id: '170',
    shipmentNumber: '170 Delivery',
    shipmentNoCode: 'NS/SHIP-JET A-1/170',
    vessel: 'MT.NEON',
    arrivalDate: '2026-08-02',
    isConfirmed: false,
    isCancelled: false,
    orderQtyMt: 11000,
    averageSales: 745000,
    deadStock: 2500000
  },
  {
    id: '171',
    shipmentNumber: '171 Delivery',
    shipmentNoCode: 'NS/SHIP-JET A-1/171',
    vessel: 'MT.NEON',
    arrivalDate: '2026-08-21',
    isConfirmed: false,
    isCancelled: false,
    orderQtyMt: 10000,
    averageSales: 732000,
    deadStock: 2500000
  },
  {
    id: '172',
    shipmentNumber: '172 Delivery',
    shipmentNoCode: 'NS/SHIP-JET A-1/172',
    vessel: 'MT.NEON',
    arrivalDate: '2026-09-09',
    isConfirmed: false,
    isCancelled: false,
    orderQtyMt: 10000,
    averageSales: 727000,
    deadStock: 2500000
  }
];

// ── Helper: Deduplicate Alerts and Identify Redundant IDs ────────────────────
export const deduplicateAlerts = (rawAlerts: Alert[]): { uniqueAlerts: Alert[]; duplicateIds: string[] } => {
  if (!Array.isArray(rawAlerts)) return { uniqueAlerts: [], duplicateIds: [] };

  // 1. Sort raw alerts so UNACKNOWLEDGED alerts ALWAYS take priority over acknowledged ones,
  // and newer alerts take priority over older ones.
  const sorted = [...rawAlerts].sort((a, b) => {
    // Unacknowledged (false) comes before acknowledged (true)
    if (!a.acknowledged && b.acknowledged) return -1;
    if (a.acknowledged && !b.acknowledged) return 1;
    // Then newest first
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const seen = new Set<string>();
  const uniqueAlerts: Alert[] = [];
  const duplicateIds: string[] = [];

  for (const alert of sorted) {
    if (!alert || !alert.id) continue;

    const cleanFlight = (alert.flightNumber || alert.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    const type = alert.alertType || 'GENERAL';
    const target = alert.assignedStaffId || alert.targetRole || 'ALL';
    // Distinguish acknowledged from unacknowledged so historical alerts NEVER purge an active alert!
    const ackState = alert.acknowledged ? 'ACK' : 'UNACK';

    let dedupeKey: string;
    if (['LANDED', 'ETA_15MIN', 'ETA_5MIN', 'REQUEST_FUELING', 'NO_FUEL', 'ALERT_CANCELLED'].includes(type) && cleanFlight) {
      // For tactical alerts on a flight, deduplicate by type, flight number, target, and ackState
      dedupeKey = `${type}:${cleanFlight}:${target}:${ackState}`;
    } else {
      // For general alerts, deduplicate by message, target, and ackState
      dedupeKey = `${type}:${target}:${(alert.message || '').trim()}:${ackState}`;
    }

    if (seen.has(dedupeKey)) {
      duplicateIds.push(alert.id);
    } else {
      seen.add(dedupeKey);
      uniqueAlerts.push(alert);
    }
  }

  return { uniqueAlerts, duplicateIds };
};

const getSentAlertsCache = (type: string, dateStr: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`fms_sent_${type.toLowerCase()}_${dateStr}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const persistSentAlertToCache = (type: string, dateStr: string, key: string) => {
  try {
    const cacheKey = `fms_sent_${type.toLowerCase()}_${dateStr}`;
    const set = getSentAlertsCache(type, dateStr);
    set.add(key);
    localStorage.setItem(cacheKey, JSON.stringify(Array.from(set)));
  } catch {}
};

export const OperationalDataProvider: React.FC<{ children: React.ReactNode; user: any }> = ({ children, user: appUser }) => {
  const [shipments, setShipments] = useState<ShipmentData[]>(() => {
    try {
      const saved = localStorage.getItem('fms_shipments');
      return saved ? JSON.parse(saved) : INITIAL_SHIPMENTS;
    } catch (e) {
      console.error("Local storage parse failed for shipments", e);
      return INITIAL_SHIPMENTS;
    }
  });
  const [equipment, setEquipment] = useState<Equipment[]>(() => {
    try {
      const saved = localStorage.getItem('fms_equipment');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved data with mock data to ensure structural integrity (e.g., missing 'type' or 'maxCapacity')
        return EQUIPMENT.map(mock => {
          const live = parsed.find((p: any) => p.id === mock.id);
          return live ? { ...mock, ...live } : mock;
        });
      }
      return EQUIPMENT;
    } catch (e) {
      console.error("Local storage parse failed for equipment", e);
      return EQUIPMENT;
    }
  });

  const [tanks, setTanks] = useState<Tank[]>(() => {
    try {
      const saved = localStorage.getItem('fms_tanks');
      return saved ? JSON.parse(saved) : TANKS;
    } catch (e) {
      console.error("Local storage parse failed for tanks", e);
      return TANKS;
    }
  });

  const [flightJobs, setFlightJobs] = useState<FlightJob[]>(() => {
    try {
      const saved = localStorage.getItem('fms_flight_jobs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Local storage parse failed for jobs", e);
      return [];
    }
  });

  const [domesticFlights, setDomesticFlights] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fms_domestic_flights');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [externalFlights, setExternalFlights] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fms_external_flights_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [delayLogs, setDelayLogs] = useState<DelayLog[]>(() => {
    try {
      const saved = localStorage.getItem('fms_delay_logs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isExternalFlightsLoading, setIsExternalFlightsLoading] = useState(false);

  const findRelatedArrival = (depFlight: any, allFlights: any[]) => {
    if (!depFlight.flightNumber) return null;
    const depCode = depFlight.airlineCode || depFlight.flightNumber.split(' ')[0];
    const depNumStr = depFlight.flightNumber.replace(/[^\d]/g, '');
    const depNum = depNumStr ? parseInt(depNumStr, 10) : null;
    
    const arrivals = allFlights.filter((f: any) => {
      if (f.type !== 'arrival') return false;
      if (f.date !== depFlight.date) return false;
      const arrCode = f.airlineCode || f.flightNumber.split(' ')[0];
      return arrCode && depCode && arrCode.toUpperCase() === depCode.toUpperCase();
    });
    
    if (arrivals.length === 0) return null;
    
    let bestMatch: any = null;
    let bestScore = -1;
    
    arrivals.forEach((arr: any) => {
      let score = 0;
      const arrNumStr = arr.flightNumber.replace(/[^\d]/g, '');
      const arrNum = arrNumStr ? parseInt(arrNumStr, 10) : null;
      
      if (depNum !== null && arrNum !== null) {
        const diff = depNum - arrNum;
        if (diff === 1) {
          score += 100; // e.g. UL 102 matched to UL 101 arrival
        } else if (diff === 0) {
          score += 50;  // same flight number
        } else if (Math.abs(diff) < 5) {
          score += 20;
        }
      }
      
      const sta = arr.scheduledTime;
      const std = depFlight.scheduledTime;
      if (sta && std) {
        const [staH, staM] = sta.split(':').map(Number);
        const [stdH, stdM] = std.split(':').map(Number);
        const staMin = staH * 60 + staM;
        const stdMin = stdH * 60 + stdM;
        const timeDiff = stdMin - staMin;
        
        if (timeDiff > 0 && timeDiff <= 240) {
          score += (240 - timeDiff) / 10; // prefer closer time
        } else if (timeDiff > 0) {
          score += 5;
        } else {
          score -= 50;
        }
      }
      
      if (arr.gate && depFlight.gate && arr.gate === depFlight.gate) {
        score += 30;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = arr;
      }
    });
    
    return bestMatch;
  };

  const getMergedFidsStatus = (f: any, liveFlightsList: any[]) => {
    let resolvedFidsStatus = f.status || 'PENDING';
    if (f.type === 'departure') {
      const related = findRelatedArrival(f, liveFlightsList);
      if (related && related.status) {
        const arrStatus = (related.status || '').toUpperCase();
        const depStatus = (f.status || '').toUpperCase();
        if (arrStatus.includes('LAND') || arrStatus.includes('ARRIV')) {
          const isGateOrOnTime = 
            depStatus.includes('GATE') || 
            depStatus.includes('CLOSE') || 
            depStatus.includes('TIME') || 
            depStatus.includes('SCH') || 
            depStatus.includes('PENDING') ||
            !depStatus;
          if (isGateOrOnTime) {
            resolvedFidsStatus = related.status;
          }
        }
      }
    }
    return resolvedFidsStatus;
  };

  const [internationalSchedules, setInternationalSchedules] = useState<InternationalSchedule[]>([]);

  const [selectedBriefingShift, setSelectedBriefingShiftState] = useState<BriefingShift>(() => {
    try {
      const saved = localStorage.getItem('fms_selected_shift');
      if (saved) return saved as BriefingShift;
    } catch(e) {}
    
    // Auto-detect current shift based on time
    const hour = new Date().getHours();
    const min = new Date().getMinutes();
    const time = hour + min / 60;
    
    // Morning: 07:30 (7.5) to 16:00 (16.0)
    // Evening: 15:00 (15.0) to 23:30 (23.5)
    // Night: 22:30 (22.5) to 08:30 (8.5)
    if (time >= 7.5 && time < 15.0) return 'Morning';
    if (time >= 15.0 && time < 22.5) return 'Evening';
    return 'Night';
  });

  const [selectedBriefingDate, setSelectedBriefingDateState] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const loadIntlSchedules = async () => {
      try {
        const data = await supabaseService.getInternationalSchedules();
        setInternationalSchedules(data);
      } catch (e) {
        console.error('Failed to load international schedules:', e);
      }
    };
    loadIntlSchedules();
  }, []);

  const mergedFlightJobs = useMemo(() => {
    let activeExternal = externalFlights;
    if (!activeExternal || activeExternal.length === 0) {
      try {
        const cached = localStorage.getItem('fms_external_flights_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeExternal = parsed;
          }
        }
      } catch (e) {}
    }

    if (!activeExternal || activeExternal.length === 0) {
      return flightJobs.filter(job => !isDomesticFlight(job));
    }
    const dbJobs = flightJobs.filter(job => !['j1', 'j2', 'j3', 'j4'].includes(job.id) && !isDomesticFlight(job));
    const merged = [...dbJobs];
    const liveIntl = activeExternal.filter((f: any) => {
      if (f.category?.toLowerCase() !== 'international' || isDomesticFlight(f)) return false;
      const statusLower = (f.status || '').toLowerCase();
      return !(statusLower.includes('cancel') || statusLower.includes('cnl'));
    });

    const getStatusFromFids = (fidsStatus?: string, currentStatus?: string) => {
      const current = currentStatus || 'PENDING';
      if (current === 'IN_PROGRESS' || current === 'COMPLETED') {
        return current;
      }
      if (!fidsStatus) {
        return current;
      }
      return fidsStatus.toUpperCase();
    };

    liveIntl.forEach((lf: any) => {
      const lfNumNorm = (lf.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const lfDateStr = lf.date ? lf.date.split('T')[0] : selectedBriefingDate;
      const existingJobIdx = merged.findIndex(
        (job) => {
          if (lf.id && job.id === lf.id) return true;
          const jobNumNorm = (job.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          if (!jobNumNorm || !lfNumNorm || jobNumNorm !== lfNumNorm) return false;
          const jobDateStr = job.date ? job.date.split('T')[0] : '';
          return !jobDateStr || !lfDateStr || jobDateStr === lfDateStr;
        }
      );

      let staVal = lf.type === 'arrival' ? (lf.scheduledTime || lf.sta || '') : '';
      let stdVal = (lf.type === 'departure' ? lf.scheduledTime : '') || lf.std || (lf.type !== 'arrival' ? lf.scheduledTime : '') || '';
      let etaVal = lf.type === 'arrival' ? (lf.estimatedTime || lf.scheduledTime) : '';
      let standVal = lf.gate || '';
      
      let routeStr = lf.type === 'arrival' 
        ? `${lf.originCode || lf.origin || ''} ➔ MLE`
        : `MLE ➔ ${lf.destinationCode || lf.destination || ''}`;

      if (lf.type === 'departure') {
        const related = findRelatedArrival(lf, liveIntl);
        if (related) {
          staVal = related.scheduledTime;
          etaVal = related.estimatedTime || related.scheduledTime;
          const originStr = related.originCode || related.origin || '';
          routeStr = `${originStr} ➔ MLE ➔ ${lf.destinationCode || lf.destination || ''}`;
          if (!standVal && related.gate) {
            standVal = related.gate;
          }
        }
      }

      const schMatch = (internationalSchedules || []).find((s: InternationalSchedule) => {
        const cleanS = (s.flightNumber || '').replace(/[\s\-\/]/g, '').toUpperCase();
        const cleanL = (lf.flightNumber || '').replace(/[\s\-\/]/g, '').toUpperCase();
        if (cleanS === cleanL) return true;
        const depS = scheduleImportService.parseMaclDepartureFlightNo(cleanS);
        const depL = scheduleImportService.parseMaclDepartureFlightNo(cleanL);
        if (depS === depL) return true;
        
        const parseFlt = (flt: string) => {
          const clean = (flt || '').replace(/[\s\-\/]/g, '').toUpperCase();
          const match = clean.match(/^([A-Z]{2,3}|[A-Z0-9]{2})(0*\d+)$/);
          if (match) return { code: match[1], num: parseInt(match[2], 10) };
          return null;
        };

        const pS = parseFlt(cleanS) || parseFlt(depS);
        const pL = parseFlt(cleanL) || parseFlt(depL);
        if (pS && pL && pS.code === pL.code) {
          if (Math.abs(pS.num - pL.num) <= 2) return true;
          const strS = String(pS.num);
          const strL = String(pL.num);
          if (strS.startsWith(strL) || strL.startsWith(strS)) return true;
        }
        return false;
      });

      const fallbackAc = scheduleImportService.getSmartAircraftFallback(lf.flightNumber, routeStr);
      const rawAc = schMatch?.aircraftType || (lf.aircraftType && !lf.aircraftType.toUpperCase().includes('WIDEBODY') ? lf.aircraftType : fallbackAc);
      const matchedAcType = scheduleImportService.normalizeAircraftType(rawAc);
      const resolvedFids = getMergedFidsStatus(lf, liveIntl);

      if (existingJobIdx !== -1) {
        const currentStatus = merged[existingJobIdx].status;
        const newStatus = getStatusFromFids(resolvedFids, currentStatus);

        merged[existingJobIdx] = {
          ...merged[existingJobIdx],
          aircraftType: (merged[existingJobIdx].aircraftType && !['A320', 'Widebody Heavy', 'Widebody'].includes(merged[existingJobIdx].aircraftType)) ? scheduleImportService.normalizeAircraftType(merged[existingJobIdx].aircraftType) : matchedAcType,
          aircraftReg: (merged[existingJobIdx].aircraftReg && merged[existingJobIdx].aircraftReg !== '8Q-TBA' && !merged[existingJobIdx].aircraftReg.startsWith('8Q-DOM')) ? merged[existingJobIdx].aircraftReg : ((lf.aircraftReg && lf.aircraftReg !== '8Q-TBA' && !lf.aircraftReg.startsWith('8Q-DOM')) ? lf.aircraftReg : ''),
          sta: staVal || merged[existingJobIdx].sta,
          eta: etaVal || merged[existingJobIdx].eta,
          std: stdVal || merged[existingJobIdx].std,
          stand: (merged[existingJobIdx].stand && merged[existingJobIdx].stand !== '---') ? merged[existingJobIdx].stand : (standVal || '---'),
          route: routeStr || merged[existingJobIdx].route,
          date: lfDateStr || (merged[existingJobIdx].date ? merged[existingJobIdx].date.split('T')[0] : selectedBriefingDate),
          type: lf.type || merged[existingJobIdx].type,
          status: newStatus,
          fidsStatus: resolvedFids
        };
      } else {
        const newStatus = getStatusFromFids(resolvedFids, 'PENDING');
        merged.push({
          id: lf.id || `fj-live-${lf.flightNumber}-${lf.scheduledTime}`,
          flightNumber: lf.flightNumber,
          aircraftReg: (lf.aircraftReg && lf.aircraftReg !== '8Q-TBA' && !lf.aircraftReg.startsWith('8Q-DOM')) ? lf.aircraftReg : '',
          aircraftType: matchedAcType,
          stand: standVal || '---',
          sta: staVal,
          eta: etaVal,
          std: stdVal,
          assignedTo: '',
          assignedOfficer: '',
          equipmentUsage: 'HYDRANT',
          status: newStatus,
          route: routeStr,
          isVirtual: true,
          date: lfDateStr,
          type: lf.type,
          fidsStatus: resolvedFids
        });
      }
    });
    const seenIds = new Set<string>();
    return merged.filter(job => {
      if (!job.id || seenIds.has(job.id)) return false;
      seenIds.add(job.id);
      return true;
    });
  }, [flightJobs, externalFlights, internationalSchedules, selectedBriefingDate]);

  const mergedDomesticFlights = useMemo(() => {
    let activeExternal = externalFlights;
    if (!activeExternal || activeExternal.length === 0) {
      try {
        const cached = localStorage.getItem('fms_external_flights_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeExternal = parsed;
          }
        }
      } catch (e) {}
    }

    if (!activeExternal || activeExternal.length === 0) {
      return domesticFlights;
    }
    const liveDom = activeExternal.filter((f: any) => {
      if (f.category?.toLowerCase() !== 'domestic' && !isDomesticFlight(f)) return false;
      const statusLower = (f.status || '').toLowerCase();
      return !(statusLower.includes('cancel') || statusLower.includes('cnl'));
    });
    const domFromLive = liveDom.map((f: any, idx: number) => {
      let staVal = f.type === 'arrival' ? f.scheduledTime : '';
      let stdVal = f.type === 'departure' ? f.scheduledTime : '';
      let etaVal = f.type === 'arrival' ? (f.estimatedTime || f.scheduledTime) : '';

      let routeStr = f.type === 'arrival' 
        ? `${f.originCode || f.origin || ''} ➔ MLE`
        : `MLE ➔ ${f.destinationCode || f.destination || ''}`;

      if (f.type === 'departure') {
        const related = findRelatedArrival(f, liveDom);
        if (related) {
          staVal = related.scheduledTime;
          etaVal = related.estimatedTime || related.scheduledTime;
          const originStr = related.originCode || related.origin || '';
          routeStr = `${originStr} ➔ MLE ➔ ${f.destinationCode || f.destination || ''}`;
        }
      }

      const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const fDateStr = f.date ? f.date.split('T')[0] : selectedBriefingDate;
      const matchingJob = flightJobs.find((j: any) => 
        (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo &&
        (!j.date || j.date.split('T')[0] === fDateStr)
      );

      const schMatch = (internationalSchedules || []).find((s: InternationalSchedule) => {
        const cleanS = (s.flightNumber || '').replace(/[\s\-]/g, '').toUpperCase();
        const cleanF = (f.flightNumber || '').replace(/[\s\-]/g, '').toUpperCase();
        return cleanS === cleanF;
      });

      const resolvedFids = getMergedFidsStatus(f, liveDom);
      let status = 'PENDING';
      const currentStatus = matchingJob?.status;

      if (currentStatus === 'IN_PROGRESS' || currentStatus === 'COMPLETED') {
        status = currentStatus;
      } else {
        status = resolvedFids.toUpperCase();
      }

      const cleanMatchReg = (matchingJob?.aircraftReg && matchingJob.aircraftReg !== '8Q-TBA' && !matchingJob.aircraftReg.startsWith('8Q-DOM')) ? matchingJob.aircraftReg : '';
      const cleanFReg = (f.aircraftReg && f.aircraftReg !== '8Q-TBA' && !f.aircraftReg.startsWith('8Q-DOM')) ? f.aircraftReg : '';
      const rawAcType = matchingJob?.aircraftType || schMatch?.aircraftType || f.aircraftType || 'ATR';

      return {
        id: f.id || `dom-${f.flightNumber}-${f.scheduledTime}-${idx}`,
        flightNumber: f.flightNumber,
        aircraftReg: cleanMatchReg || cleanFReg || '',
        aircraftType: cleanAircraftTypeName(rawAcType),
        stand: matchingJob?.stand || f.gate || 'D01',
        assignedTeam: `Team ${(idx % 3) + 1}`,
        status,
        fidsStatus: resolvedFids,
        sta: staVal,
        eta: etaVal,
        std: stdVal,
        route: routeStr,
        date: fDateStr,
        type: f.type,
        isDomestic: true,
        vehicleId: currentStatus === 'IN_PROGRESS' ? matchingJob?.vehicleId : undefined
      };
    });

    const existingDomNos = new Set(liveDom.map((f: any) => (f.flightNumber || '').replace(/\s+/g, '').toLowerCase()));
    const extraDomJobs = flightJobs
      .filter(j => isDomesticFlight(j) && !existingDomNos.has((j.flightNumber || '').replace(/\s+/g, '').toLowerCase()))
      .map((j, idx) => ({
        ...j,
        assignedTeam: (j as any).assignedTeam || `Team ${((liveDom.length + idx) % 3) + 1}`,
        isDomestic: true
      }));

    return [...domFromLive, ...extraDomJobs];
  }, [domesticFlights, externalFlights, flightJobs, internationalSchedules, selectedBriefingDate]);

  const refreshExternalFlights = useCallback(async () => {
    try {
      setIsExternalFlightsLoading(true);
      const flights = await supabaseService.getExternalFlights();
      setExternalFlights(flights);
    } catch (error) {
      console.error('Error fetching external flights:', error);
    } finally {
      setIsExternalFlightsLoading(false);
    }
  }, []);

  const setSelectedBriefingShift = (shift: BriefingShift) => {
    setBriefingInfo(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        staffAssignments: prev.staffAssignments ? {
          ...prev.staffAssignments,
          adhocFlights: []
        } : {
          activeOperators: [],
          activeOfficers: [],
          hydrantOpsOfficers: [],
          dutySupervisor: '',
          shiftInCharge: '',
          adhocFlights: []
        }
      };
    });
    setSelectedBriefingShiftState(shift);
  };

  const setSelectedBriefingDate = (date: string) => {
    setBriefingInfo(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        staffAssignments: prev.staffAssignments ? {
          ...prev.staffAssignments,
          adhocFlights: []
        } : {
          activeOperators: [],
          activeOfficers: [],
          hydrantOpsOfficers: [],
          dutySupervisor: '',
          shiftInCharge: '',
          adhocFlights: []
        }
      };
    });
    setSelectedBriefingDateState(date);
  };

  const [briefingInfo, setBriefingInfo] = useState<ShiftBriefingInfo>(() => {
    const saved = localStorage.getItem(`fms_briefing_info_${selectedBriefingDate}_${selectedBriefingShift}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.staffAssignments && parsed.staffAssignments.adhocFlights === undefined) {
          parsed.staffAssignments.adhocFlights = [];
        }
        return parsed;
      } catch (e) {}
    }
    return {
      info: [
        { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'critical', isHighAlert: true },
        { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'standard' },
        { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'standard' },
        { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'standard' },
        { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'standard' },
      ],
      dieselNeeds: [],
      staffAssignments: {
        activeOperators: [],
        activeOfficers: [],
        hydrantOpsOfficers: [],
        dutySupervisors: [],
        shiftInCharges: [],
        adhocFlights: []
      }
    };
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    try {
      const saved = localStorage.getItem('fms_alerts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateAlerts(parsed).uniqueAlerts;
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [flightLogs, setFlightLogs] = useState<FlightLog[]>(() => {
    try {
      const saved = localStorage.getItem('fms_recent_flight_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [domesticAssignments, setDomesticAssignments] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fms_domestic_assignments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [staff, setStaff] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('fms_staff_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_STAFF_LIST;
  });
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);

  const [serviceTankId, setServiceTankIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('fms_service_tank') || 'tk101';
    } catch (e) {
      return 'tk101';
    }
  });

  const setServiceTankId = async (tankId: string) => {
    setServiceTankIdState(tankId);
    localStorage.setItem('fms_service_tank', tankId);
    if (appUser) {
      try {
        await supabaseService.setServiceTank(tankId);
      } catch (error) {
        console.error('Failed to sync service tank to Supabase:', error);
      }
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const pendingAlertHashes = React.useRef<Set<string>>(new Set());
  const initialAlertsLoadedRef = React.useRef(false);
  const loadedAlertIdsRef = React.useRef<Set<string>>(new Set());
  const replenishmentLocks = React.useRef<Record<string, number>>({});
  const prevFlightStatusesRef = React.useRef<Map<string, string>>(new Map());
  const todayDateStr = new Date().toISOString().split('T')[0];
  const landedAlertsSentRef = React.useRef<Set<string>>(getSentAlertsCache('landed', todayDateStr));

  // Sync alerts to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('fms_alerts', JSON.stringify(alerts));
    } catch (e) {}
  }, [alerts]);

  // Local sync to localStorage for persistence fallback
  useEffect(() => {
    localStorage.setItem('fms_shipments', JSON.stringify(shipments));
  }, [shipments]);

  const updateShipment = (index: number, fields: Partial<ShipmentData>) => {
    setShipments(prev => prev.map((s, i) => i === index ? { ...s, ...fields } : s));
  };

  const addShipment = () => {
    setShipments(prev => {
      const lastShipment = prev[prev.length - 1];
      const match = lastShipment ? lastShipment.shipmentNumber.match(/(\d+)/) : null;
      const lastNum = match ? parseInt(match[1], 10) : 172;
      const nextNum = lastNum + 1;
      
      const lastDate = lastShipment ? new Date(lastShipment.arrivalDate) : new Date();
      lastDate.setDate(lastDate.getDate() + 19);
      const nextArrivalDate = lastDate.toISOString().split('T')[0];

      return [
        ...prev,
        {
          id: String(nextNum),
          shipmentNumber: `${nextNum} Delivery`,
          shipmentNoCode: `NS/SHIP-JET A-1/${nextNum}`,
          vessel: lastShipment ? lastShipment.vessel : 'MT.NEON',
          arrivalDate: nextArrivalDate,
          isConfirmed: false,
          isCancelled: false,
          orderQtyMt: lastShipment ? lastShipment.orderQtyMt : 10000,
          averageSales: lastShipment ? lastShipment.averageSales : 700000,
          deadStock: 2500000
        }
      ];
    });
  };

  const removeShipment = () => {
    setShipments(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    localStorage.setItem('fms_equipment', JSON.stringify(equipment));
  }, [equipment]);

  useEffect(() => {
    localStorage.setItem('fms_tanks', JSON.stringify(tanks));
  }, [tanks]);

  useEffect(() => {
    localStorage.setItem('fms_flight_jobs', JSON.stringify(flightJobs));
  }, [flightJobs]);

  useEffect(() => {
    localStorage.setItem('fms_domestic_flights', JSON.stringify(domesticFlights));
  }, [domesticFlights]);

  useEffect(() => {
    localStorage.setItem(`fms_briefing_info_${selectedBriefingDate}_${selectedBriefingShift}`, JSON.stringify(briefingInfo));
  }, [briefingInfo, selectedBriefingDate, selectedBriefingShift]);
  
  useEffect(() => {
    localStorage.setItem('fms_selected_shift', selectedBriefingShift);
  }, [selectedBriefingShift]);

  useEffect(() => {
    localStorage.setItem('fms_selected_briefing_date', selectedBriefingDate);
  }, [selectedBriefingDate]);

  useEffect(() => {
    localStorage.setItem('fms_service_tank', serviceTankId);
  }, [serviceTankId]);

  useEffect(() => {
    const saved = localStorage.getItem(`fms_briefing_info_${selectedBriefingDate}_${selectedBriefingShift}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.staffAssignments && parsed.staffAssignments.adhocFlights === undefined) {
          parsed.staffAssignments.adhocFlights = [];
        }
        setBriefingInfo(parsed);
      } catch (e) {
        // fallback
      }
    } else {
      setBriefingInfo({
        info: [
          { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'critical', isHighAlert: true },
          { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'standard' },
          { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'standard' },
          { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'standard' },
          { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'standard' },
        ],
        dieselNeeds: [],
        staffAssignments: {
          activeOperators: [],
          activeOfficers: [],
          hydrantOpsOfficers: [],
          dutySupervisor: '',
          shiftInCharge: '',
          adhocFlights: []
        }
      });
    }
  }, [selectedBriefingDate, selectedBriefingShift]);


  const refreshData = useCallback(async () => {
    if (!appUser) return;

    try {
      setIsLoading(true);
      setIsAlertsLoading(true);
      
      // Fetch external flights in parallel without blocking
      refreshExternalFlights();

      const [fetchedTanks, fetchedJobs, fetchedBriefing, fetchedAlerts, fetchedEq, fetchedLogs, fetchedStaff, fetchedDomAssign, fetchedDelays] = await Promise.all([
        supabaseService.getTanks(),
        supabaseService.getFlightJobs(),
        supabaseService.getShiftBriefingInfo(selectedBriefingDate, selectedBriefingShift),
        supabaseService.getAlerts(),
        supabaseService.getEquipment(),
        supabaseService.getFlightLogs({ limit: 500 }),
        supabaseService.getStaff(),
        supabaseService.getDomesticAssignments(selectedBriefingDate),
        supabaseService.getDelayLogs()
      ]);

      if (fetchedTanks && fetchedTanks.length > 0) {
        setTanks(prev => {
          const liveIds = new Set(fetchedTanks.map(t => t.id));
          const mappedLive = fetchedTanks.map(live => {
            const mock = TANKS.find(t => t.id === live.id);
            return mock ? { ...mock, ...live } : live;
          });
          const fallbackMocks = TANKS.filter(mock => !liveIds.has(mock.id));
          return [...mappedLive, ...fallbackMocks];
        });
      }
      if (fetchedJobs) setFlightJobs(fetchedJobs);
      if (fetchedBriefing && typeof fetchedBriefing === 'object') {
         // Merge with default staff if missing
          const staff = (fetchedBriefing as any).staffAssignments || {
            activeOperators: [],
            activeOfficers: [],
            hydrantOpsOfficers: [],
            dutySupervisor: '',
            shiftInCharge: ''
          };
         if (staff.adhocFlights === undefined) {
           staff.adhocFlights = [];
         }
         setBriefingInfo({ ...(fetchedBriefing as any), staffAssignments: staff });
      }
      if (fetchedEq && fetchedEq.length > 0) {
        setEquipment(prev => {
          const liveIds = new Set(fetchedEq.map(e => e.id));
          const mappedLive = fetchedEq.map(live => {
            const mock = EQUIPMENT.find(m => m.id === live.id);
            return mock ? { ...mock, ...live } : live;
          });
          const fallbackMocks = EQUIPMENT.filter(mock => !liveIds.has(mock.id));
          return [...mappedLive, ...fallbackMocks];
        });
      }
      if (fetchedAlerts && Array.isArray(fetchedAlerts)) {
        const { uniqueAlerts, duplicateIds } = deduplicateAlerts(fetchedAlerts);
        if (duplicateIds.length > 0) {
          console.log(`[Alert Cleanup] Purging ${duplicateIds.length} duplicate alerts from Supabase...`);
          supabaseService.deleteAlerts(duplicateIds).catch(err => console.warn('[Alert Cleanup] Error deleting duplicate alerts:', err));
        }
        setAlerts(uniqueAlerts);
      }
      if (fetchedLogs) {
        let logsList: FlightLog[] = [];
        if (Array.isArray(fetchedLogs)) {
          logsList = fetchedLogs;
        } else if (fetchedLogs.logs && Array.isArray(fetchedLogs.logs)) {
          logsList = fetchedLogs.logs;
        }

        // Merge any recently created logs from local cache that may not have committed to BigQuery SELECT query yet
        try {
          const cached = localStorage.getItem('fms_recent_flight_logs');
          if (cached) {
            const recentLogs: FlightLog[] = JSON.parse(cached);
            if (Array.isArray(recentLogs) && recentLogs.length > 0) {
              const fetchedIds = new Set(logsList.map(l => l.id));
              const fetchedDelivs = new Set(logsList.filter(l => l.deliveryNumber).map(l => l.deliveryNumber));
              const missingRecent = recentLogs.filter(l => 
                !fetchedIds.has(l.id) && 
                (!l.deliveryNumber || !fetchedDelivs.has(l.deliveryNumber))
              );
              if (missingRecent.length > 0) {
                logsList = [...missingRecent, ...logsList];
              }
            }
          }
        } catch (e) {
          console.warn('[OperationalData] Error merging cached flight logs:', e);
        }

        // Filter out any locally blacklisted deleted log IDs so stale server responses don't resurrect them
        try {
          const rawDel = localStorage.getItem('fms_deleted_log_ids');
          if (rawDel) {
            const delIds: string[] = JSON.parse(rawDel);
            if (Array.isArray(delIds) && delIds.length > 0) {
              const delSet = new Set(delIds);
              logsList = logsList.filter(l => !delSet.has(l.id) && (!l.deliveryNumber || !delSet.has(l.deliveryNumber)));
            }
          }
        } catch (e) {}

        setFlightLogs(logsList);
      }
      if (fetchedStaff && fetchedStaff.length > 0) setStaff(fetchedStaff);
      if (fetchedDelays && Array.isArray(fetchedDelays)) setDelayLogs(fetchedDelays);
      // Fetch service tank setting
      try {
        const savedServiceTank = await supabaseService.getServiceTank();
        if (savedServiceTank) {
          setServiceTankIdState(savedServiceTank);
          localStorage.setItem('fms_service_tank', savedServiceTank);
        }
      } catch (e) {
        console.warn('Failed to fetch service tank setting:', e);
      }
      let finalDomAssign = fetchedDomAssign;
      if (!finalDomAssign || finalDomAssign.length === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (todayStr !== selectedBriefingDate) {
          try {
            const todayAssign = await supabaseService.getDomesticAssignments(todayStr);
            if (todayAssign && todayAssign.length > 0) {
              finalDomAssign = todayAssign;
            }
          } catch (e) {}
        }
      }
      if (finalDomAssign && Array.isArray(finalDomAssign) && finalDomAssign.length > 0) {
        const mapped = mapDomesticAssignments(finalDomAssign);
        setDomesticAssignments(mapped);
        localStorage.setItem('fms_domestic_assignments', JSON.stringify(mapped));
      }
      
    } catch (error) {
      console.error('Error refreshing operational data:', error);
    } finally {
      setIsLoading(false);
      setIsAlertsLoading(false);
    }
  }, [selectedBriefingDate, selectedBriefingShift, refreshExternalFlights]);

  // Sync with Supabase when user logs in, selected shift or date changes
  useEffect(() => {
    if (appUser) {
      refreshData();
    }
  }, [appUser, selectedBriefingShift, selectedBriefingDate, refreshData]);

  // Listen to Supabase auth changes to trigger a refresh of external flights when session is loaded
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        refreshExternalFlights();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [refreshExternalFlights]);

  // Dedicated Real-time Listeners Effect
  useEffect(() => {
    if (!appUser) {
      // Revert to mock data if signed out
      setEquipment(EQUIPMENT);
      setAlerts(MOCK_ALERTS);
      initialAlertsLoadedRef.current = false;
      loadedAlertIdsRef.current.clear();
      return;
    }

    console.log("PROVIDER: Initializing live listeners for user:", appUser.id, appUser.role);
    setIsAlertsLoading(true);

    const unsubscribeAppSettings = supabaseService.subscribeToAppSettings((key, value) => {
      if (key === 'service_tank' && value?.tankId) {
        setServiceTankIdState(value.tankId);
      }
      if (key === 'master_schedules' && value && Array.isArray(value.schedules)) {
        console.log("SYNC: Master schedules received from Supabase across devices. Count:", value.schedules.length);
        setInternationalSchedules(value.schedules);
      }
    });

    const unsubscribeAlerts = supabaseService.subscribeToAlerts((updatedAlerts) => {
      console.log("SYNC: Alerts received from Supabase. Count:", updatedAlerts.length);
      
      const { uniqueAlerts, duplicateIds } = deduplicateAlerts(updatedAlerts);

      if (duplicateIds.length > 0) {
        console.log(`[Alert Cleanup] Purging ${duplicateIds.length} duplicate alerts from Supabase:`, duplicateIds);
        supabaseService.deleteAlerts(duplicateIds).catch(err => {
          console.warn('[Alert Cleanup] Error deleting duplicate alerts:', err);
        });
      }

      if (!initialAlertsLoadedRef.current) {
        // Record existing alert IDs on startup to avoid spamming the user
        const existingIds = new Set(uniqueAlerts.map(a => a.id));
        loadedAlertIdsRef.current = existingIds;
        initialAlertsLoadedRef.current = true;
      } else {
        // Notify for any new, unacknowledged alerts
        uniqueAlerts.forEach((alert) => {
          if (!loadedAlertIdsRef.current.has(alert.id)) {
            loadedAlertIdsRef.current.add(alert.id);
            if (!alert.acknowledged) {
              sendNativeNotification('New FMS Alert', alert.message);
            }
          }
        });
      }

      setAlerts(uniqueAlerts);
      setIsAlertsLoading(false);
    });

    const unsubscribeEquipment = supabaseService.subscribeToEquipment((updatedEq) => {
      console.log("SYNC: Equipment received from Supabase. Count:", updatedEq.length);
      if (updatedEq && updatedEq.length > 0) {
        setEquipment(prev => {
          const liveIds = new Set(updatedEq.map(e => e.id));
          const mappedLive = updatedEq.map(live => {
            const mock = EQUIPMENT.find(m => m.id === live.id);
            return mock ? { ...mock, ...live } : live;
          });
          const fallbackMocks = EQUIPMENT.filter(mock => !liveIds.has(mock.id));
          return [...mappedLive, ...fallbackMocks];
        });
      }
    });

    const unsubscribeTanks = supabaseService.subscribeToTanks((updatedTanks) => {
      console.log("SYNC: Tanks received from Supabase. Count:", updatedTanks.length);
      if (updatedTanks && updatedTanks.length > 0) {
        setTanks(prev => {
          const liveIds = new Set(updatedTanks.map(t => t.id));
          const mappedLive = updatedTanks.map(live => {
            const mock = TANKS.find(t => t.id === live.id);
            return mock ? { ...mock, ...live } : live;
          });
          const fallbackMocks = TANKS.filter(mock => !liveIds.has(mock.id));
          return [...mappedLive, ...fallbackMocks];
        });
      }
    });

    const unsubscribeStaff = supabaseService.subscribeToStaff((updatedStaff) => {
      console.log("SYNC: Staff received from Supabase. Count:", updatedStaff.length);
      if (updatedStaff && updatedStaff.length > 0) {
        setStaff(updatedStaff);
      }
    });

    const unsubscribeFlightJobs = supabaseService.subscribeToFlightJobs((updatedJobs) => {
      console.log("SYNC: Flight jobs received from Supabase. Count:", updatedJobs.length);
      if (updatedJobs) {
        setFlightJobs(updatedJobs);
      }
    });

    const unsubscribeVessels = supabaseService.subscribeToVessels((updatedVessels) => {
      console.log("SYNC: Vessels received from Supabase. Count:", updatedVessels.length);
      if (updatedVessels) {
        setVessels(updatedVessels);
      }
    });

    const channelDomAssign = supabase
      .channel('public:domestic_assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'domestic_assignments' }, () => {
        console.log("SYNC: postgres change on domestic_assignments for date:", selectedBriefingDate);
        supabaseService.getDomesticAssignments(selectedBriefingDate).then(data => {
          if (data) setDomesticAssignments(mapDomesticAssignments(data));
        });
      })
      .subscribe();

    const channelBriefing = supabase
      .channel('public:shift_briefing_info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_briefing_info' }, () => {
        console.log("SYNC: postgres change on shift_briefing_info for date & shift:", selectedBriefingDate, selectedBriefingShift);
        supabaseService.getShiftBriefingInfo(selectedBriefingDate, selectedBriefingShift).then(data => {
          if (data && typeof data === 'object') {
            const staff = (data as any).staffAssignments || {
              activeOperators: [],
              activeOfficers: [],
              hydrantOpsOfficers: [],
              dutySupervisors: [],
              shiftInCharges: []
            };
            if (staff.adhocFlights === undefined) {
              staff.adhocFlights = [];
            }
            setBriefingInfo({ ...(data as any), staffAssignments: staff });
          }
        });
      })
      .subscribe();

    const channelDelayLogs = supabase
      .channel('public:delay_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delay_logs' }, () => {
        supabaseService.getDelayLogs().then(data => {
          if (data) setDelayLogs(data);
        });
      })
      .subscribe();

    return () => {
      console.log("PROVIDER: Tearing down listeners for user:", appUser.id);
      if (unsubscribeAppSettings) unsubscribeAppSettings();
      if (unsubscribeAlerts) unsubscribeAlerts();
      if (unsubscribeEquipment) unsubscribeEquipment();
      if (unsubscribeTanks) unsubscribeTanks();
      if (unsubscribeStaff) unsubscribeStaff();
      if (unsubscribeFlightJobs) unsubscribeFlightJobs();
      if (unsubscribeVessels) unsubscribeVessels();
      if (channelDomAssign) channelDomAssign.unsubscribe();
      if (channelBriefing) channelBriefing.unsubscribe();
      if (channelDelayLogs) channelDelayLogs.unsubscribe();
    };
  }, [appUser, selectedBriefingDate, selectedBriefingShift]);

  const updateEquipmentStatus = async (id: string, status: EqStatus) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, status, lastUpdated: new Date().toISOString() } : eq
    ));

    if (appUser) {
      try {
        await supabaseService.updateEquipmentStatus(id, status);
      } catch (error) {
        console.error('Failed to sync equipment status to Supabase:', error);
      }
    }
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, ...updates, lastUpdated: new Date().toISOString() } : eq
    ));

    if (appUser) {
      try {
        await supabaseService.updateEquipment(id, updates);
      } catch (error) {
        console.error('Failed to sync equipment update to Supabase:', error);
      }
    }
  };

  const updateTankLevel = async (id: string, newLevel: number) => {
    setTanks(prev => prev.map(t => 
      t.id === id ? { ...t, currentLevel: newLevel, lastUpdated: new Date().toISOString() } : t
    ));

    if (appUser) {
      try {
        await supabaseService.updateTankLevel(id, newLevel);
      } catch (error) {
        console.error('Failed to sync tank update to Supabase:', error);
      }
    }
  };

  const updateBriefingInfo = async (info: any[], dieselNeeds: string[], staffAssignments?: any) => {
    let finalStaff = staffAssignments;
    setBriefingInfo(prev => {
      if (staffAssignments === undefined) {
        finalStaff = prev?.staffAssignments;
      }
      return { info, dieselNeeds, staffAssignments: finalStaff };
    });

    if (appUser) {
      try {
        await supabaseService.upsertShiftBriefingInfo(selectedBriefingDate, selectedBriefingShift, info, dieselNeeds, finalStaff !== undefined ? finalStaff : null);
      } catch (error) {
        console.error('Failed to sync briefing update to Supabase:', error);
      }
    }
  };

  const updateFlightJob = async (id: string, updates: Partial<FlightJob>) => {
    let targetFlightNo = updates.flightNumber || '';

    // If flightNumber was not explicitly provided in updates, look it up by ID
    if (!targetFlightNo) {
      const foundInDb = flightJobs.find(j => j.id === id);
      const foundInVirtual = (mergedFlightJobs || []).find(j => j.id === id)
        || (mergedDomesticFlights || []).find(j => j.id === id)
        || (externalFlights || []).find((j: any) => j.id === id)
        || (briefingInfo?.staffAssignments?.frozenFlights?.intl || []).find((j: any) => j.id === id)
        || (briefingInfo?.staffAssignments?.frozenFlights?.domestic || []).find((j: any) => j.id === id)
        || (briefingInfo?.staffAssignments?.adhocFlights || []).find((j: any) => j.id === id);
      targetFlightNo = foundInDb?.flightNumber || foundInVirtual?.flightNumber || '';

      if (!targetFlightNo && typeof id === 'string' && id.includes('-')) {
        const parts = id.split('-');
        if ((parts[0] === 'departure' || parts[0] === 'arrival' || parts[0] === 'fj') && parts[1]) {
          targetFlightNo = parts[1];
        }
      }
    }

    const cleanUpdatesFlight = (targetFlightNo || '').replace(/\s+/g, '').toLowerCase();

    const updatesDate = updates.date ? updates.date.split('T')[0] : '';
    const targetDate = updatesDate || selectedBriefingDate;

    const existingJob = flightJobs.find(j => {
      if (j.id === id) return true;
      const jDate = j.date ? j.date.split('T')[0] : '';
      if (jDate && targetDate && jDate !== targetDate) return false;
      if (!cleanUpdatesFlight) return false;
      const jFlight = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jFlight !== cleanUpdatesFlight) return false;
      return true;
    });

    if (existingJob) {
      targetFlightNo = existingJob.flightNumber || targetFlightNo;
    }
    const isDbJob = !!existingJob;

    if (!isDbJob) {
      const matchByFlightOrId = (j: any) => {
        if (!j) return false;
        if (j.id === id) return true;
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && targetDate && jDate !== targetDate) return false;
        if (cleanUpdatesFlight && (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanUpdatesFlight) {
          return true;
        }
        return false;
      };

      const virtualJob = (mergedFlightJobs || []).find(matchByFlightOrId) 
        || (mergedDomesticFlights || []).find(matchByFlightOrId)
        || (briefingInfo?.staffAssignments?.adhocFlights || []).find(matchByFlightOrId);

      const finalFlightNum = updates.flightNumber || virtualJob?.flightNumber || targetFlightNo;
      if (!finalFlightNum) {
        console.warn('Cannot create flight job without flightNumber for id:', id);
        return;
      }

      const resolvedDate = virtualJob?.date ? virtualJob.date.split('T')[0] : targetDate;
      const isDom = isDomesticFlight(virtualJob || {}) || isDomesticFlight(updates) || isDomesticFlight({ flightNumber: finalFlightNum });
      const isAdhoc = !!(virtualJob?.isAdhoc || updates.isAdhoc || (virtualJob?.id && String(virtualJob.id).startsWith('ah-')));

      const fallbackId = cleanUpdatesFlight ? `fj-${cleanUpdatesFlight}-${targetDate}` : `fj-${Date.now()}`;
      const safeJobId = (virtualJob?.id && !flightJobs.some(fj => fj.id === virtualJob.id && fj.date && fj.date.split('T')[0] !== targetDate))
        ? virtualJob.id
        : (id || fallbackId);

      const fullJob: FlightJob = {
        ...virtualJob,
        ...updates,
        id: safeJobId,
        flightNumber: finalFlightNum,
        aircraftReg: updates.aircraftReg !== undefined ? updates.aircraftReg : ((virtualJob?.aircraftReg && virtualJob.aircraftReg !== '8Q-TBA' && !virtualJob.aircraftReg.startsWith('8Q-DOM')) ? virtualJob.aircraftReg : ''),
        aircraftType: cleanAircraftTypeName(updates.aircraftType || virtualJob?.aircraftType || (isDom ? 'ATR' : 'A320')),
        stand: updates.stand || virtualJob?.stand || '---',
        sta: updates.sta || virtualJob?.sta || (virtualJob?.type === 'arrival' ? (virtualJob as any)?.scheduledTime : '') || '',
        eta: updates.eta || virtualJob?.eta || '',
        std: updates.std || virtualJob?.std || (virtualJob?.type === 'departure' ? (virtualJob as any)?.scheduledTime : '') || (virtualJob as any)?.scheduledTime || '',
        status: updates.status || virtualJob?.status || 'PENDING',
        equipmentUsage: updates.equipmentUsage || virtualJob?.equipmentUsage || (isDom ? 'REFUELLER' : 'HYDRANT'),
        isDomestic: isDom,
        isAdhoc: isAdhoc,
        co: updates.co !== undefined ? updates.co : (virtualJob?.co || ''),
        operatorName: updates.operatorName !== undefined ? updates.operatorName : (virtualJob?.operatorName || ''),
        date: resolvedDate,
        isVirtual: undefined
      };

      setFlightJobs(prev => {
        const normNo = (fullJob.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jobDate = (fullJob.date || '').split('T')[0];
        const existsIdx = prev.findIndex(j => 
          j.id === fullJob.id || 
          ((j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === normNo && (!jobDate || !j.date || j.date.split('T')[0] === jobDate))
        );
        if (existsIdx !== -1) {
          const next = [...prev];
          next[existsIdx] = { ...next[existsIdx], ...fullJob };
          return next;
        }
        return [...prev, fullJob];
      });

      try {
        await supabaseService.addFlightJob(fullJob);
      } catch (error) {
        console.error('Failed to create flight job in Supabase from virtual:', error);
      }
    } else {
      const cleanTarget = (targetFlightNo || '').replace(/\s+/g, '').toLowerCase();
      setFlightJobs(prev => prev.map(job => {
        const matchesId = job.id === id || (existingJob && job.id === existingJob.id);
        if (matchesId) {
          return { ...job, ...updates };
        }
        const jDate = job.date ? job.date.split('T')[0] : '';
        if (jDate && targetDate && jDate !== targetDate) return job;
        const matchesFlightNo = cleanTarget && (job.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanTarget;
        if (matchesFlightNo) {
          return { ...job, ...updates };
        }
        return job;
      }));
    }

    // Also update frozenFlights in briefingInfo state if it exists
    let updatedBriefing = false;
    let newBriefingInfo = briefingInfo;

    if (briefingInfo?.staffAssignments?.frozenFlights) {
      const frozen = briefingInfo.staffAssignments.frozenFlights;
      const normTarget = (targetFlightNo || '').replace(/\s+/g, '').toLowerCase();
      const matchFlight = (f: any) => {
        if (f.id === id) return true;
        if (!normTarget) return false;
        const fNorm = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (fNorm !== normTarget) return false;
        const fDate = f.date ? f.date.split('T')[0] : '';
        return !fDate || !targetDate || fDate === targetDate;
      };

      let updatedIntl = frozen.intl;
      let updatedDomestic = frozen.domestic;
      let updatedAdhoc = frozen.adhoc;

      if (frozen.intl && frozen.intl.some(matchFlight)) {
        updatedIntl = frozen.intl.map((f: any) => matchFlight(f) ? { ...f, ...updates } : f);
        updatedBriefing = true;
      }
      if (frozen.domestic && frozen.domestic.some(matchFlight)) {
        updatedDomestic = frozen.domestic.map((f: any) => matchFlight(f) ? { ...f, ...updates } : f);
        updatedBriefing = true;
      }
      if (frozen.adhoc && frozen.adhoc.some(matchFlight)) {
        updatedAdhoc = frozen.adhoc.map((f: any) => matchFlight(f) ? { ...f, ...updates } : f);
        updatedBriefing = true;
      }

      if (updatedBriefing) {
        newBriefingInfo = {
          ...briefingInfo,
          staffAssignments: {
            ...briefingInfo.staffAssignments,
            frozenFlights: {
              ...frozen,
              intl: updatedIntl,
              domestic: updatedDomestic,
              adhoc: updatedAdhoc
            }
          }
        };
        setBriefingInfo(newBriefingInfo);
      }
    }

    if (briefingInfo?.staffAssignments?.adhocFlights) {
      const normTarget = (targetFlightNo || '').replace(/\s+/g, '').toLowerCase();
      const matchFlight = (f: any) => {
        if (f.id === id) return true;
        if (!normTarget) return false;
        const fNorm = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (fNorm !== normTarget) return false;
        const fDate = f.date ? f.date.split('T')[0] : '';
        return !fDate || !targetDate || fDate === targetDate;
      };

      if (briefingInfo.staffAssignments.adhocFlights.some(matchFlight)) {
        const updatedAdhocList = briefingInfo.staffAssignments.adhocFlights.map((f: any) => matchFlight(f) ? { ...f, ...updates } : f);
        updatedBriefing = true;
        newBriefingInfo = {
          ...(newBriefingInfo || briefingInfo),
          staffAssignments: {
            ...(newBriefingInfo?.staffAssignments || briefingInfo.staffAssignments),
            adhocFlights: updatedAdhocList
          }
        };
        setBriefingInfo(newBriefingInfo);
      }
    }

    try {
      if (isDbJob) {
        await supabaseService.updateFlightJob(existingJob?.id || id, updates);
      }
      if (updatedBriefing && newBriefingInfo && newBriefingInfo.staffAssignments) {
        await supabaseService.upsertShiftBriefingInfo(
          selectedBriefingDate,
          selectedBriefingShift,
          newBriefingInfo.info,
          newBriefingInfo.dieselNeeds,
          newBriefingInfo.staffAssignments
        );
      }
    } catch (error) {
      console.error('Failed to sync flight job update to Supabase:', error);
    }
  };

  const addFlightJob = async (job: FlightJob) => {
    setFlightJobs(prev => {
      if (prev.some(j => j.id === job.id)) return prev;
      return [...prev, job];
    });

    if (appUser) {
      try {
        await supabaseService.addFlightJob(job);
      } catch (error) {
        console.error('Failed to add flight job to Supabase:', error);
      }
    }
  };

  const updateFlightLog = async (id: string, updates: Partial<FlightLog>) => {
    setFlightLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    try {
      await supabaseService.updateFlightLog(id, updates);
    } catch (error) {
      console.error('Failed to update flight log in BigQuery:', error);
      throw error;
    }
  };

  const addFlightLogEntry = useCallback((log: FlightLog) => {
    setFlightLogs(prev => {
      const idx = prev.findIndex(l => 
        l.id === log.id || 
        (log.deliveryNumber && l.deliveryNumber === log.deliveryNumber) ||
        (log.flightNumber && log.operationalDate && l.flightNumber === log.flightNumber && l.operationalDate === log.operationalDate)
      );
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...log };
        return next;
      }
      return [log, ...prev];
    });

    // Also persist in fms_recent_flight_logs
    try {
      const raw = localStorage.getItem('fms_recent_flight_logs');
      const recent: FlightLog[] = raw ? JSON.parse(raw) : [];
      const deduped = recent.filter(l => 
        l.id !== log.id && 
        (!log.deliveryNumber || l.deliveryNumber !== log.deliveryNumber)
      );
      deduped.unshift(log);
      localStorage.setItem('fms_recent_flight_logs', JSON.stringify(deduped.slice(0, 100)));
    } catch (e) {}
  }, []);

  const deleteFlightLogEntry = useCallback((id: string, fallbackFlightNumber?: string, fallbackDeliveryNumber?: string) => {
    let fn = fallbackFlightNumber || '';
    let dn = fallbackDeliveryNumber || '';
    if (!fn || !dn) {
      const found = flightLogs.find(l => l.id === id);
      if (found) {
        if (!fn) fn = found.flightNumber || '';
        if (!dn) dn = found.deliveryNumber || '';
      }
    }
    const cleanTargetNo = fn ? fn.replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';
    const cleanTargetCompact = cleanTargetNo.replace(/([A-Z]+)0+([0-9]+)/, '$1$2');

    const matchesTargetFlight = (testFn?: string) => {
      if (!cleanTargetNo || !testFn) return false;
      const norm = testFn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (!norm) return false;
      if (norm === cleanTargetNo || norm.replace(/([A-Z]+)0+([0-9]+)/, '$1$2') === cleanTargetCompact) return true;
      return false;
    };

    // 0. Blacklist in fms_deleted_log_ids
    try {
      const rawDel = localStorage.getItem('fms_deleted_log_ids');
      const delIds: string[] = rawDel ? JSON.parse(rawDel) : [];
      if (id && !delIds.includes(id)) delIds.push(id);
      if (dn && !delIds.includes(dn)) delIds.push(dn);
      localStorage.setItem('fms_deleted_log_ids', JSON.stringify(delIds.slice(-500)));
    } catch {}

    // 1. Remove deleted log from flightLogs state
    setFlightLogs(prev => prev.filter(l => {
      if (l.id === id) return false;
      if (dn && l.deliveryNumber && l.deliveryNumber === dn) return false;
      if (cleanTargetNo && matchesTargetFlight(l.flightNumber)) return false;
      return true;
    }));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fms:flight-log-deleted', {
        detail: { id, flightNumber: fn, deliveryNumber: dn }
      }));
    }

    // 2. Reset flightJobs in state and update Supabase flight_jobs table
    if (cleanTargetNo || dn) {
      setFlightJobs(fjPrev => fjPrev.map(j => {
        const matchFn = matchesTargetFlight(j.flightNumber);
        const matchDeliv = dn && j.deliveryNumber === dn;
        if (matchFn || matchDeliv) {
          if (j.id) {
            supabaseService.updateFlightJob(j.id, {
              status: 'PENDING',
              vehicleId: undefined,
              deliveryNumber: undefined,
              timestampClearance: undefined
            }).catch(e => console.warn('[deleteFlightLogEntry] Error resetting flight job in Supabase:', e));
          }
          return {
            ...j,
            status: 'PENDING',
            vehicleId: undefined,
            deliveryNumber: undefined,
            timestampClearance: undefined
          };
        }
        return j;
      }));

      // 3. Reset in briefingInfo state AND briefingInfo.staffAssignments.adhocFlights AND sync to Supabase
      setBriefingInfo(biPrev => {
        if (!biPrev?.staffAssignments) return biPrev;
        const frozen = biPrev.staffAssignments.frozenFlights;
        const adhoc = biPrev.staffAssignments.adhocFlights;
        const matchF = (f: any) => matchesTargetFlight(f.flightNumber) || (dn && f.deliveryNumber === dn);
        const resetFlight = (f: any) => matchF(f) ? { ...f, status: 'PENDING', vehicleId: undefined, deliveryNumber: undefined, timestampClearance: undefined } : f;

        const updatedFrozen = frozen ? {
          ...frozen,
          intl: (frozen.intl || []).map(resetFlight),
          domestic: (frozen.domestic || []).map(resetFlight),
          adhoc: (frozen.adhoc || []).map(resetFlight)
        } : undefined;

        const updatedAdhoc = (adhoc || []).map(resetFlight);

        const newBriefing: BriefingInfo = {
          ...biPrev,
          staffAssignments: {
            ...biPrev.staffAssignments,
            ...(updatedFrozen ? { frozenFlights: updatedFrozen } : {}),
            adhocFlights: updatedAdhoc
          }
        };

        // Persist synchronously to localStorage so reloads keep it reset
        try {
          localStorage.setItem(`fms_briefing_info_${selectedBriefingDate}_${selectedBriefingShift}`, JSON.stringify(newBriefing));
        } catch (e) {}

        // Persist to Supabase shift_briefing_info
        supabaseService.upsertShiftBriefingInfo(
          selectedBriefingDate,
          selectedBriefingShift,
          newBriefing.info,
          newBriefing.dieselNeeds,
          newBriefing.staffAssignments
        ).catch(e => console.warn('[deleteFlightLogEntry] Error updating briefing in Supabase:', e));

        return newBriefing;
      });
    }

    // 4. Remove from fms_recent_flight_logs in localStorage
    try {
      const raw = localStorage.getItem('fms_recent_flight_logs');
      if (raw) {
        const recent: FlightLog[] = JSON.parse(raw);
        const cleanFallback = cleanTargetNo;
        const filtered = recent.filter(l => {
          if (l.id === id) return false;
          if (dn && l.deliveryNumber && l.deliveryNumber === dn) return false;
          if (cleanFallback && l.flightNumber) {
            const lNo = (l.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
            if (lNo === cleanFallback || lNo.replace(/([A-Z]+)0+([0-9]+)/, '$1$2') === cleanTargetCompact) {
              return false;
            }
          }
          return true;
        });
        localStorage.setItem('fms_recent_flight_logs', JSON.stringify(filtered));
      }
    } catch (e) {}
  }, [flightLogs, selectedBriefingDate, selectedBriefingShift]);

  // Real-time listener for newly created, updated & deleted flight logs across components
  useEffect(() => {
    const handleNewLog = (e: Event) => {
      const customEvent = e as CustomEvent<FlightLog>;
      if (customEvent && customEvent.detail) {
        addFlightLogEntry(customEvent.detail);
      }
    };
    const handleUpdatedLog = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; updates: Partial<FlightLog> }>;
      if (customEvent && customEvent.detail?.id) {
        updateFlightLog(customEvent.detail.id, customEvent.detail.updates);
      }
    };
    const handleDeletedLog = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; flightNumber?: string; deliveryNumber?: string }>;
      if (customEvent && customEvent.detail?.id) {
        deleteFlightLogEntry(customEvent.detail.id, customEvent.detail.flightNumber, customEvent.detail.deliveryNumber);
      }
    };
    window.addEventListener('fms:flight-log-created', handleNewLog);
    window.addEventListener('fms:flight-log-updated', handleUpdatedLog);
    window.addEventListener('fms:flight-log-deleted', handleDeletedLog);
    return () => {
      window.removeEventListener('fms:flight-log-created', handleNewLog);
      window.removeEventListener('fms:flight-log-updated', handleUpdatedLog);
      window.removeEventListener('fms:flight-log-deleted', handleDeletedLog);
    };
  }, [addFlightLogEntry, updateFlightLog, deleteFlightLogEntry]);

  const deleteFlightJob = async (id: string) => {
    const jobToDelete = flightJobs.find(j => j.id === id);
    setFlightJobs(prev => prev.filter(j => j.id !== id));

    if (jobToDelete && briefingInfo?.staffAssignments?.frozenFlights) {
      const cleanNo = (jobToDelete.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const existingFrozen = briefingInfo.staffAssignments.frozenFlights;
      let changed = false;

      const newIntl = (existingFrozen.intl || []).filter((f: any) => {
        const match = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo;
        if (match) changed = true;
        return !match;
      });
      const newDomestic = (existingFrozen.domestic || []).filter((f: any) => {
        const match = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo;
        if (match) changed = true;
        return !match;
      });
      const newAdhoc = (existingFrozen.adhoc || []).filter((f: any) => {
        const match = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo;
        if (match) changed = true;
        return !match;
      });

      if (changed) {
        const updatedStaffAssignments = {
          ...briefingInfo.staffAssignments,
          frozenFlights: {
            ...existingFrozen,
            intl: newIntl,
            domestic: newDomestic,
            adhoc: newAdhoc
          }
        };
        await updateBriefingInfo(briefingInfo.info || [], briefingInfo.dieselNeeds || [], updatedStaffAssignments);
      }
    }

    if (appUser) {
      try {
        await supabaseService.deleteFlightJob(id);
      } catch (error) {
        console.error('Failed to sync delete flight job to Supabase:', error);
      }
    }
  };

  const createAlert = async (alertData: Omit<Alert, 'id'>): Promise<boolean> => {
    // Generate a unique hash for general duplicate prevention
    const alertHash = `${alertData.message}-${alertData.targetRole || ''}-${alertData.assignedStaffId || ''}`;
    
    // REPLENISHMENT LOCK: Specific guard for vehicle requests
    const replenishmentMatch = alertData.message.match(/unit (RF-\d+)/);
    const vehicleId = replenishmentMatch ? replenishmentMatch[1] : null;

    if (vehicleId) {
      // Only apply the request lock for REQUEST-type alerts (not completion alerts)
      const isRequestAlert = alertData.message.toLowerCase().includes('requested');
      
      if (isRequestAlert) {
        const now = Date.now();
        const lastRequest = replenishmentLocks.current[vehicleId] || 0;
        const COOLDOWN = 5000; // 5 seconds

        // Block if requested in the last 5 seconds (frontend cooldown)
        if (now - lastRequest < COOLDOWN) {
          console.warn(`Replenishment lock active for ${vehicleId}. Blocking duplicate.`);
          return false;
        }
        
        // Also check existing unacknowledged REQUEST alerts (not completion alerts)
        const alreadyRequested = (alerts || []).some(a => 
          !a.acknowledged && 
          a.message.toLowerCase().includes('requested') &&
          a.message.includes(`unit ${vehicleId}`)
        );
        
        if (alreadyRequested) {
          console.warn(`Alert already exists for ${vehicleId}. Blocking.`);
          return false;
        }

        replenishmentLocks.current[vehicleId] = now;
      }
    }

    // TACTICAL FLIGHT ALERTS DUPLICATE GUARD
    if (alertData.alertType && ['LANDED', 'ETA_15MIN', 'ETA_5MIN', 'REQUEST_FUELING', 'NO_FUEL'].includes(alertData.alertType)) {
      const cleanFlt = (alertData.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      const duplicateExists = (alerts || []).some(a => {
        if (a.acknowledged) return false; // Acknowledged or past alerts must NEVER block new requests!
        if (a.alertType !== alertData.alertType) return false;
        const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
        if (cleanFlt && aFlt && cleanFlt !== aFlt) return false;
        if (cleanFlt && !aFlt) return false;
        if (alertData.assignedStaffId && a.assignedStaffId === alertData.assignedStaffId) return true;
        if (alertData.targetRole && a.targetRole === alertData.targetRole) return true;
        return a.message === alertData.message;
      });

      if (duplicateExists || pendingAlertHashes.current.has(alertHash)) {
        console.warn(`[Duplicate Blocked] Active unacknowledged ${alertData.alertType} alert already exists for ${alertData.flightNumber}`);
        return false;
      }
    }

    // GENERAL DUPLICATE GUARD: Check current state + pending Ref
    const isDuplicate = (alerts || []).some(a => 
      !a.acknowledged && 
      a.message === alertData.message && 
      a.targetRole === alertData.targetRole
    ) || pendingAlertHashes.current.has(alertHash);

    if (isDuplicate) {
      console.warn('Duplicate alert blocked in context:', alertData.message);
      return false;
    }

    pendingAlertHashes.current.add(alertHash);

    try {
      await supabaseService.createAlert(alertData);
      // Immediately refresh alerts for local consistency
      const rawUpdatedAlerts = await supabaseService.getAlerts();
      const { uniqueAlerts, duplicateIds } = deduplicateAlerts(rawUpdatedAlerts || []);
      if (duplicateIds.length > 0) {
        supabaseService.deleteAlerts(duplicateIds).catch(console.warn);
      }
      setAlerts(uniqueAlerts);
      return true;
    } catch (error) {
      console.error('Failed to create alert:', error);
      if (vehicleId) delete replenishmentLocks.current[vehicleId];
      throw error;
    } finally {
      pendingAlertHashes.current.delete(alertHash);
    }
  };

  // ── Auto-Detect Flight Status Transitions to LANDED / ARRIVED ───────────────
  useEffect(() => {
    if (!mergedFlightJobs || mergedFlightJobs.length === 0) return;

    const todayDate = new Date().toISOString().split('T')[0];

    mergedFlightJobs.forEach(job => {
      if (!job.flightNumber) return;
      const cleanNo = job.flightNumber.replace(/\s+/g, '').toUpperCase();
      const currentStatus = (job.fidsStatus || job.status || '').toUpperCase();
      const jobKey = job.id || `${cleanNo}-${job.type || 'flt'}`;

      const hasObservedBefore = prevFlightStatusesRef.current.has(jobKey);
      const prevStatus = prevFlightStatusesRef.current.get(jobKey);
      prevFlightStatusesRef.current.set(jobKey, currentStatus);

      // Guard 1: If this flight was not previously observed in this session,
      // record its status and do NOT fire a landed alert on initial load or refresh!
      if (!hasObservedBefore) {
        return;
      }

      // Check if newly transitioned to LANDED / ARRIVED
      const isLanded = currentStatus.includes('LAND') || currentStatus.includes('ARRIV');
      const wasLanded = prevStatus ? (prevStatus.includes('LAND') || prevStatus.includes('ARRIV')) : false;

      const jobDate = (job.date ? job.date.split('T')[0] : '') || todayDate;
      const alertKey = `${cleanNo}-${jobDate}-LANDED`;

      // Guard 2: Persistent memory + localStorage cache
      if (landedAlertsSentRef.current.has(alertKey)) {
        return;
      }

      // Guard 3: Database flight_jobs column flag
      if (job.landed_alert_sent) {
        landedAlertsSentRef.current.add(alertKey);
        persistSentAlertToCache('landed', todayDate, alertKey);
        return;
      }

      // Guard 4: Check if an alert for this flight with alertType === 'LANDED' already exists
      const alreadyInAlerts = alerts.some(a => 
        a.alertType === 'LANDED' && 
        ((a.flightNumber && a.flightNumber.replace(/\s+/g, '').toUpperCase() === cleanNo) || 
         (a.message && a.message.replace(/\s+/g, '').toUpperCase().includes(cleanNo)))
      );
      if (alreadyInAlerts) {
        landedAlertsSentRef.current.add(alertKey);
        persistSentAlertToCache('landed', todayDate, alertKey);
        return;
      }

      if (isLanded && !wasLanded) {
        // Only trigger if flight has assigned staff
        if (job.assignedTo || job.assignedOfficer) {
          landedAlertsSentRef.current.add(alertKey);
          persistSentAlertToCache('landed', todayDate, alertKey);

          // Mark job in database so no other client or session triggers it
          if (job.id && flightJobs.some(fj => fj.id === job.id)) {
            updateFlightJob(job.id, { landed_alert_sent: true } as any).catch(console.warn);
          }

          const alertMeta = {
            stand: job.stand || 'TBA',
            aircraftReg: job.aircraftReg || '',
            eta: job.eta || job.sta || '',
            flightNumber: job.flightNumber
          };

          // Send to assigned operator
          if (job.assignedTo) {
            createAlert({
              alertType: 'LANDED',
              severity: 'medium',
              flightNumber: job.flightNumber,
              message: `✈️ LANDED: Flight ${job.flightNumber} has landed at Stand ${job.stand || 'TBA'}.`,
              timestamp: new Date().toISOString(),
              acknowledged: false,
              targetRole: UserRole.ITP_OPERATOR,
              assignedStaffId: job.assignedTo,
              metadata: alertMeta
            }).catch(err => console.warn('[LANDED Alert] Failed to send to operator:', err));
          }

          // Send to assigned officer if different from operator
          if (job.assignedOfficer && job.assignedOfficer !== job.assignedTo) {
            createAlert({
              alertType: 'LANDED',
              severity: 'medium',
              flightNumber: job.flightNumber,
              message: `✈️ LANDED: Flight ${job.flightNumber} has landed at Stand ${job.stand || 'TBA'}.`,
              timestamp: new Date().toISOString(),
              acknowledged: false,
              targetRole: UserRole.ITP_OFFICER,
              assignedStaffId: job.assignedOfficer,
              metadata: alertMeta
            }).catch(err => console.warn('[LANDED Alert] Failed to send to officer:', err));
          }
        }
      }
    });
  }, [mergedFlightJobs, alerts, flightJobs]);

  const acknowledgeAlert = async (id: string, staffName?: string) => {
    try {
      const nowIso = new Date().toISOString();
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const targetAlert = (alerts || []).find(a => a.id === id);
      const cleanFlt = (targetAlert?.flightNumber || targetAlert?.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      
      const ackMeta = {
        acknowledgedAt: nowIso,
        acknowledgedTime: nowTime,
        acknowledgedBy: staffName || appUser?.name || 'Staff'
      };

      // Batch acknowledge all matching tactical alerts for this flight
      const matchingIds = (alerts || [])
        .filter(a => {
          if (a.id === id) return true;
          if (targetAlert?.alertType && ['LANDED', 'ETA_15MIN', 'ETA_5MIN', 'REQUEST_FUELING', 'NO_FUEL', 'ALERT_CANCELLED'].includes(targetAlert.alertType)) {
            const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
            return a.alertType === targetAlert.alertType && (!cleanFlt || !aFlt || aFlt === cleanFlt);
          }
          return false;
        })
        .map(a => a.id);

      await supabaseService.acknowledgeAllAlerts(matchingIds, ackMeta);
      setAlerts(prev => prev.map(a => {
        if (!matchingIds.includes(a.id)) return a;
        return { 
          ...a, 
          acknowledged: true,
          acknowledgedAt: nowIso,
          acknowledged_at: nowIso,
          acknowledgedBy: ackMeta.acknowledgedBy,
          metadata: {
            ...(a.metadata || {}),
            ...ackMeta
          }
        };
      }));

      // Also update local storage dispatch cache if it matches a flight
      if (cleanFlt) {
        try {
          const raw = localStorage.getItem('fms_flight_fuel_dispatches');
          const cache = raw ? JSON.parse(raw) : {};
          if (cache[cleanFlt]) {
            cache[cleanFlt] = {
              ...(typeof cache[cleanFlt] === 'object' ? cache[cleanFlt] : { type: cache[cleanFlt] }),
              acknowledged: true,
              acknowledgedTime: nowTime,
              acknowledgedAt: nowIso,
              acknowledgedBy: staffName || appUser?.name || 'Staff'
            };
            localStorage.setItem('fms_flight_fuel_dispatches', JSON.stringify(cache));
          }
        } catch {}
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  };

  const acknowledgeAllAlerts = async (ids: string[]) => {
    try {
      const nowIso = new Date().toISOString();
      const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      await supabaseService.acknowledgeAllAlerts(ids, { acknowledgedAt: nowIso, acknowledgedTime: nowTime });
      setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, acknowledged: true, acknowledgedAt: nowIso, acknowledged_at: nowIso } : a));
    } catch (error) {
      console.error('Failed to acknowledge all alerts:', error);
      throw error;
    }
  };

  const clearAllAlerts = async () => {
    try {
      const allIds = (alerts || []).map(a => a.id);
      if (allIds.length === 0) return;
      // Delete all alerts from Supabase, then wipe local state
      await supabaseService.deleteAlerts(allIds);
      setAlerts([]);
      localStorage.setItem('fms_alerts', JSON.stringify([]));
    } catch (error) {
      console.error('Failed to clear all alerts:', error);
      // Fallback: clear locally anyway
      setAlerts([]);
      localStorage.setItem('fms_alerts', JSON.stringify([]));
    }
  };

  const deleteAlerts = async (ids: string[]) => {
    try {
      await supabaseService.deleteAlerts(ids);
      setAlerts(prev => prev.filter(a => !ids.includes(a.id)));
    } catch (error) {
      console.error('Failed to delete alerts:', error);
      throw error;
    }
  };

  const addStaff = async (member: Omit<StaffMember, 'id'>) => {
    await supabaseService.addStaff(member);
  };

  const updateStaff = async (id: string, updates: Partial<Omit<StaffMember, 'id'>>) => {
    await supabaseService.updateStaff(id, updates);
  };

  const deleteStaff = async (id: string) => {
    await supabaseService.deleteStaff(id);
  };

  const updateDomesticAssignment = async (teamName: string, op1: string, op2: string) => {
    setDomesticAssignments(prev => {
      let updated: any[];
      const existingIdx = prev.findIndex(da => da.team_name === teamName);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { 
          ...copy[existingIdx], 
          op1, 
          op2, 
          operator1_id: op1, 
          operator2_id: op2 
        };
        updated = copy;
      } else {
        updated = [...prev, { 
          date: selectedBriefingDate, 
          assignment_date: selectedBriefingDate,
          team_name: teamName, 
          op1, 
          op2, 
          operator1_id: op1, 
          operator2_id: op2 
        }];
      }
      localStorage.setItem('fms_domestic_assignments', JSON.stringify(updated));
      return updated;
    });

    if (appUser) {
      try {
        await supabaseService.upsertDomesticAssignment(selectedBriefingDate, teamName, op1, op2);
      } catch (error) {
        console.error('Failed to sync domestic assignment to Supabase:', error);
      }
    }
  };

  const addEquipment = async (eq: Omit<Equipment, 'id' | 'lastUpdated'>) => {
    await supabaseService.addEquipment(eq);
  };

  const deleteEquipment = async (id: string) => {
    await supabaseService.deleteEquipment(id);
  };

  const addTank = async (tank: Omit<Tank, 'id' | 'lastUpdated'>) => {
    await supabaseService.addTank(tank);
  };

  const updateTank = async (id: string, updates: Partial<Omit<Tank, 'id'>>) => {
    await supabaseService.updateTank(id, updates);
  };

  const deleteTank = async (id: string) => {
    await supabaseService.deleteTank(id);
  };

  const addVessel = async (vessel: Omit<Vessel, 'id' | 'created_at'>) => {
    await supabaseService.addVessel(vessel);
  };

  const updateVessel = async (id: string, updates: Partial<Omit<Vessel, 'id'>>) => {
    await supabaseService.updateVessel(id, updates);
  };

  const deleteVessel = async (id: string) => {
    await supabaseService.deleteVessel(id);
  };

  const importInternationalSchedules = async (schedules: InternationalSchedule[]) => {
    await supabaseService.bulkSaveInternationalSchedules(schedules);
    const updated = await supabaseService.getInternationalSchedules();
    setInternationalSchedules(updated);
  };

  const saveInternationalSchedule = async (schedule: InternationalSchedule) => {
    await supabaseService.saveInternationalSchedule(schedule);
    const updated = await supabaseService.getInternationalSchedules();
    setInternationalSchedules(updated);
  };

  const deleteInternationalSchedule = async (id: string) => {
    await supabaseService.deleteInternationalSchedule(id);
    const updated = await supabaseService.getInternationalSchedules();
    setInternationalSchedules(updated);
  };

  const deleteAllInternationalSchedules = async () => {
    await supabaseService.deleteAllInternationalSchedules();
    setInternationalSchedules([]);
  };

  const toggleInternationalScheduleActive = async (id: string, isActive: boolean) => {
    await supabaseService.toggleInternationalScheduleActive(id, isActive);
    const updated = await supabaseService.getInternationalSchedules();
    setInternationalSchedules(updated);
  };

  const crossCheckDailyFlights = (dateStr?: string): ScheduleCrossCheckResult[] => {
    const targetDate = dateStr || selectedBriefingDate || new Date().toISOString().split('T')[0];
    return scheduleImportService.crossCheckDailyFlights(
      targetDate,
      mergedFlightJobs || [],
      internationalSchedules || []
    );
  };

  const getPredictiveUpliftForecast = (startDateStr?: string, daysCount: number = 14, categoryFilter: 'ALL' | 'INT' | 'DOM' = 'ALL'): PredictiveUpliftForecast[] => {
    const targetDate = startDateStr || new Date().toISOString().split('T')[0];
    return scheduleImportService.generatePredictiveUpliftForecast(
      targetDate,
      daysCount,
      internationalSchedules || [],
      flightLogs || [],
      categoryFilter
    );
  };

  const createDelayLog = async (log: Omit<DelayLog, 'id'>) => {
    const created = await supabaseService.createDelayLog(log);
    setDelayLogs(prev => [created, ...prev.filter(r => r.id !== created.id)]);
    return created;
  };

  const updateDelayLog = async (id: string, updates: Partial<DelayLog>) => {
    await supabaseService.updateDelayLog(id, updates);
    setDelayLogs(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
  };

  const deleteDelayLog = async (id: string) => {
    await supabaseService.deleteDelayLog(id);
    setDelayLogs(prev => prev.filter(r => r.id !== id));
  };

  return (
    <OperationalDataContext.Provider value={{
      equipment: equipment || [],
      tanks: tanks || [],
      flightJobs: mergedFlightJobs || [],
      rawFlightJobs: flightJobs || [],
      domesticFlights: mergedDomesticFlights || [],
      externalFlights: externalFlights || [],
      isExternalFlightsLoading,
      refreshExternalFlights,
      briefingInfo: briefingInfo || { info: [], dieselNeeds: [], staffAssignments: undefined },
      selectedBriefingShift,
      setSelectedBriefingShift,
      selectedBriefingDate,
      setSelectedBriefingDate,
      updateEquipmentStatus,
      updateEquipment,
      updateTankLevel,
      updateBriefingInfo,
      updateFlightJob,
      addFlightJob,
      deleteFlightJob,
      updateFlightLog,
      addFlightLogEntry,
      deleteFlightLogEntry,
      createAlert,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      clearAllAlerts,
      deleteAlerts,
      refreshData,
      isLoading,
      alerts: alerts || [],
      domesticAssignments: domesticAssignments || [],
      updateDomesticAssignment,
      flightLogs: flightLogs || [],
      isAlertsLoading,
      staff: staff || [],
      addStaff,
      updateStaff,
      deleteStaff,
      addEquipment,
      deleteEquipment,
      addTank,
      updateTank,
      deleteTank,
      vessels: vessels || [],
      addVessel,
      updateVessel,
      deleteVessel,
      shipments: shipments || [],
      updateShipment,
      addShipment,
      removeShipment,
      serviceTankId,
      setServiceTankId,
      internationalSchedules: internationalSchedules || [],
      importInternationalSchedules,
      saveInternationalSchedule,
      deleteInternationalSchedule,
      deleteAllInternationalSchedules,
      toggleInternationalScheduleActive,
      crossCheckDailyFlights,
      getPredictiveUpliftForecast,
      delayLogs: delayLogs || [],
      createDelayLog,
      updateDelayLog,
      deleteDelayLog
    }}>
      {children}
    </OperationalDataContext.Provider>
  );
};

export const useOperationalData = () => {
  const context = useContext(OperationalDataContext);
  if (context === undefined) {
    throw new Error('useOperationalData must be used within an OperationalDataProvider');
  }
  return context;
};
