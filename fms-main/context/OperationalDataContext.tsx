
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Equipment, Tank, FlightJob, EquipmentStatus as EqStatus, Alert, FlightLog, StaffMember, UserRole, Vessel, ShipmentData } from '../types';
import { EQUIPMENT, TANKS, MOCK_ALERTS } from '../constants';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';
import { sendNativeNotification } from '../utils/pwa';

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
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  acknowledgeAlert: (id: string) => Promise<void>;
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

  const [externalFlights, setExternalFlights] = useState<any[]>([]);
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

  const mergedFlightJobs = useMemo(() => {
    if (!externalFlights || externalFlights.length === 0) {
      return flightJobs;
    }
    const dbJobs = flightJobs.filter(job => !['j1', 'j2', 'j3', 'j4'].includes(job.id));
    const merged = [...dbJobs];
    const liveIntl = externalFlights.filter((f: any) => {
      if (f.category?.toLowerCase() !== 'international') return false;
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
      const existingJobIdx = merged.findIndex(
        (job) => 
          (job.flightNumber || '').replace(/\s+/g, '').toLowerCase() === lfNumNorm &&
          (!job.date || job.date === lf.date)
      );

      let staVal = lf.type === 'arrival' ? lf.scheduledTime : '';
      let stdVal = lf.type === 'departure' ? lf.scheduledTime : '';
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

      const resolvedFids = getMergedFidsStatus(lf, liveIntl);

      if (existingJobIdx !== -1) {
        const currentStatus = merged[existingJobIdx].status;
        const newStatus = getStatusFromFids(resolvedFids, currentStatus);

        merged[existingJobIdx] = {
          ...merged[existingJobIdx],
          sta: staVal || merged[existingJobIdx].sta,
          eta: etaVal || merged[existingJobIdx].eta,
          std: stdVal || merged[existingJobIdx].std,
          stand: standVal || merged[existingJobIdx].stand,
          route: routeStr || merged[existingJobIdx].route,
          date: lf.date || merged[existingJobIdx].date,
          type: lf.type || merged[existingJobIdx].type,
          status: newStatus,
          fidsStatus: resolvedFids
        };
      } else {
        const newStatus = getStatusFromFids(resolvedFids, 'PENDING');
        merged.push({
          id: lf.id || `fj-live-${lf.flightNumber}-${lf.scheduledTime}`,
          flightNumber: lf.flightNumber,
          aircraftReg: '8Q-TBA',
          aircraftType: 'A320',
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
          date: lf.date,
          type: lf.type,
          fidsStatus: resolvedFids
        });
      }
    });
    return merged;
  }, [flightJobs, externalFlights]);

  const mergedDomesticFlights = useMemo(() => {
    if (!externalFlights || externalFlights.length === 0) {
      return domesticFlights;
    }
    const liveDom = externalFlights.filter((f: any) => {
      if (f.category?.toLowerCase() !== 'domestic') return false;
      const statusLower = (f.status || '').toLowerCase();
      return !(statusLower.includes('cancel') || statusLower.includes('cnl'));
    });
    return liveDom.map((f: any, idx: number) => {
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
      const matchingJob = flightJobs.find((j: any) => 
        (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo &&
        (!j.date || j.date === f.date)
      );

      const resolvedFids = getMergedFidsStatus(f, liveDom);
      let status = 'PENDING';
      const currentStatus = matchingJob?.status;

      if (currentStatus === 'IN_PROGRESS' || currentStatus === 'COMPLETED') {
        status = currentStatus;
      } else {
        status = resolvedFids.toUpperCase();
      }

      return {
        id: f.id || `dom-${f.flightNumber}-${f.scheduledTime}-${idx}`,
        flightNumber: f.flightNumber,
        aircraftReg: f.aircraftReg || `8Q-DOM${idx}`,
        aircraftType: f.aircraftType || 'Dash 8',
        stand: f.gate || 'D01',
        assignedTeam: `Team ${(idx % 3) + 1}`,
        status,
        fidsStatus: resolvedFids,
        sta: staVal,
        eta: etaVal,
        std: stdVal,
        route: routeStr,
        date: f.date,
        type: f.type
      };
    });
  }, [domesticFlights, externalFlights, flightJobs]);

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
        activeOperators: ['u3', 'u3b'],
        activeOfficers: ['u1'],
        hydrantOpsOfficers: ['u7'],
        dutySupervisor: 'u2',
        shiftInCharge: 'u2b',
        adhocFlights: []
      }
    };
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    try {
      const saved = localStorage.getItem('fms_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [flightLogs, setFlightLogs] = useState<FlightLog[]>([]);
  const [domesticAssignments, setDomesticAssignments] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF_LIST);
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
          activeOperators: ['u3b'],
          activeOfficers: ['u3'],
          hydrantOpsOfficers: ['u7'],
          dutySupervisor: 'u2',
          shiftInCharge: 'u11',
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

      const [fetchedTanks, fetchedJobs, fetchedBriefing, fetchedAlerts, fetchedEq, fetchedLogs, fetchedStaff, fetchedDomAssign] = await Promise.all([
        supabaseService.getTanks(),
        supabaseService.getFlightJobs(),
        supabaseService.getShiftBriefingInfo(selectedBriefingDate, selectedBriefingShift),
        supabaseService.getAlerts(),
        supabaseService.getEquipment(),
        supabaseService.getFlightLogs(),
        supabaseService.getStaff(),
        supabaseService.getDomesticAssignments(selectedBriefingDate)
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
            activeOperators: ['u3b'],
            activeOfficers: ['u3'],
            hydrantOpsOfficers: ['u7'],
            dutySupervisor: 'u2',
            shiftInCharge: 'u11'
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
      if (fetchedAlerts && Array.isArray(fetchedAlerts)) setAlerts(fetchedAlerts);
      if (fetchedLogs && Array.isArray(fetchedLogs)) setFlightLogs(fetchedLogs);
      if (fetchedStaff && fetchedStaff.length > 0) setStaff(fetchedStaff);
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
      if (fetchedDomAssign && Array.isArray(fetchedDomAssign)) {
        setDomesticAssignments(mapDomesticAssignments(fetchedDomAssign));
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
    });

    const unsubscribeAlerts = supabaseService.subscribeToAlerts((updatedAlerts) => {
      console.log("SYNC: Alerts received from Supabase. Count:", updatedAlerts.length);
      
      if (!initialAlertsLoadedRef.current) {
        // Record existing alert IDs on startup to avoid spamming the user
        const existingIds = new Set(updatedAlerts.map(a => a.id));
        loadedAlertIdsRef.current = existingIds;
        initialAlertsLoadedRef.current = true;
      } else {
        // Notify for any new, unacknowledged alerts
        updatedAlerts.forEach((alert) => {
          if (!loadedAlertIdsRef.current.has(alert.id)) {
            loadedAlertIdsRef.current.add(alert.id);
            if (!alert.acknowledged) {
              sendNativeNotification('New FMS Alert', alert.message);
            }
          }
        });
      }

      setAlerts(updatedAlerts);
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
    };
  }, [appUser, selectedBriefingDate]);

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
    const isDbJob = flightJobs.some(j => j.id === id);

    if (!isDbJob) {
      const virtualJob = mergedFlightJobs.find(j => j.id === id);
      if (virtualJob) {
        const fullJob: FlightJob = {
          ...virtualJob,
          ...updates,
          isVirtual: undefined
        };
        setFlightJobs(prev => [...prev, fullJob]);
        if (appUser) {
          try {
            await supabaseService.addFlightJob(fullJob);
          } catch (error) {
            console.error('Failed to create flight job in Supabase from virtual:', error);
          }
        }
        return;
      }
    }

    setFlightJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));

    // Also update frozenFlights in briefingInfo state if it exists
    let updatedBriefing = false;
    let newBriefingInfo = briefingInfo;

    if (briefingInfo?.staffAssignments?.frozenFlights) {
      const frozen = briefingInfo.staffAssignments.frozenFlights;
      let updatedIntl = frozen.intl;
      let updatedDomestic = frozen.domestic;
      let updatedAdhoc = frozen.adhoc;

      if (frozen.intl && frozen.intl.some((f: any) => f.id === id)) {
        updatedIntl = frozen.intl.map((f: any) => f.id === id ? { ...f, ...updates } : f);
        updatedBriefing = true;
      }
      if (frozen.domestic && frozen.domestic.some((f: any) => f.id === id)) {
        updatedDomestic = frozen.domestic.map((f: any) => f.id === id ? { ...f, ...updates } : f);
        updatedBriefing = true;
      }
      if (frozen.adhoc && frozen.adhoc.some((f: any) => f.id === id)) {
        updatedAdhoc = frozen.adhoc.map((f: any) => f.id === id ? { ...f, ...updates } : f);
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

    if (appUser) {
      try {
        await supabaseService.updateFlightJob(id, updates);
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
    const alertHash = `${alertData.message}-${alertData.targetRole}`;
    
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
      const updatedAlerts = await supabaseService.getAlerts();
      setAlerts(updatedAlerts || []);
      return true;
    } catch (error) {
      console.error('Failed to create alert:', error);
      if (vehicleId) delete replenishmentLocks.current[vehicleId];
      throw error;
    } finally {
      pendingAlertHashes.current.delete(alertHash);
    }
  };

  const acknowledgeAlert = async (id: string) => {
    try {
      await supabaseService.acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  };

  const acknowledgeAllAlerts = async (ids: string[]) => {
    try {
      await supabaseService.acknowledgeAllAlerts(ids);
      setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, acknowledged: true } : a));
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
        return copy;
      } else {
        return [...prev, { 
          date: selectedBriefingDate, 
          assignment_date: selectedBriefingDate,
          team_name: teamName, 
          op1, 
          op2, 
          operator1_id: op1, 
          operator2_id: op2 
        }];
      }
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
      setServiceTankId
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
