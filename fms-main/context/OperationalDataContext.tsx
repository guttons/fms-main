
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Equipment, Tank, FlightJob, EquipmentStatus as EqStatus, Alert, FlightLog, StaffMember, UserRole } from '../types';
import { EQUIPMENT, TANKS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS, MOCK_ALERTS } from '../constants';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';

interface ShiftBriefingInfo {
  info: { text: string; type: string; isHighAlert?: boolean }[];
  dieselNeeds: string[];
  staffAssignments?: {
    activeOperators: string[];
    activeOfficers: string[];
    hydrantOpsOfficers: string[];
    dutySupervisor: string;
    shiftInCharge: string;
    attendees?: string[];
  };
}

export type BriefingShift = 'Morning' | 'Evening' | 'Night';

interface OperationalDataContextType {
  equipment: Equipment[];
  tanks: Tank[];
  flightJobs: FlightJob[];
  domesticFlights: any[];
  briefingInfo: ShiftBriefingInfo;
  selectedBriefingShift: BriefingShift;
  setSelectedBriefingShift: (shift: BriefingShift) => void;
  alerts: Alert[];
  flightLogs: FlightLog[];
  isAlertsLoading: boolean;
  updateEquipmentStatus: (id: string, status: EqStatus) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<void>;
  addEquipment: (eq: Omit<Equipment, 'id' | 'lastUpdated'>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  updateTankLevel: (id: string, newLevel: number) => Promise<void>;
  addTank: (tank: Omit<Tank, 'id' | 'lastUpdated'>) => Promise<void>;
  updateTank: (id: string, updates: Partial<Omit<Tank, 'id'>>) => Promise<void>;
  deleteTank: (id: string) => Promise<void>;
  updateBriefingInfo: (info: any[], dieselNeeds: string[], staffAssignments?: any) => Promise<void>;
  updateFlightJob: (id: string, updates: Partial<FlightJob>) => void;
  addFlightJob: (job: FlightJob) => void;
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  acknowledgeAlert: (id: string) => Promise<void>;
  acknowledgeAllAlerts: (ids: string[]) => Promise<void>;
  clearAllAlerts: () => Promise<void>;
  refreshData: () => Promise<void>;
  isLoading: boolean;
  staff: StaffMember[];
  addStaff: (member: Omit<StaffMember, 'id'>) => Promise<void>;
  updateStaff: (id: string, updates: Partial<Omit<StaffMember, 'id'>>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
}

const OperationalDataContext = createContext<OperationalDataContextType | undefined>(undefined);

export const OperationalDataProvider: React.FC<{ children: React.ReactNode; user: any }> = ({ children, user: appUser }) => {
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
      return saved ? JSON.parse(saved) : MOCK_JOBS;
    } catch (e) {
      console.error("Local storage parse failed for jobs", e);
      return MOCK_JOBS;
    }
  });

  const [domesticFlights, setDomesticFlights] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fms_domestic_flights');
      return saved ? JSON.parse(saved) : MOCK_DOMESTIC_FLIGHTS;
    } catch (e) {
      return MOCK_DOMESTIC_FLIGHTS;
    }
  });

  const [selectedBriefingShift, setSelectedBriefingShift] = useState<BriefingShift>(() => {
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

  const [briefingInfo, setBriefingInfo] = useState<ShiftBriefingInfo>(() => {
    const saved = localStorage.getItem(`fms_briefing_info_${selectedBriefingShift}`);
    return saved ? JSON.parse(saved) : {
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
        shiftInCharge: 'u2b'
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
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const pendingAlertHashes = React.useRef<Set<string>>(new Set());
  const replenishmentLocks = React.useRef<Record<string, number>>({});

  // Local sync to localStorage for persistence fallback
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
    localStorage.setItem(`fms_briefing_info_${selectedBriefingShift}`, JSON.stringify(briefingInfo));
  }, [briefingInfo, selectedBriefingShift]);
  
  useEffect(() => {
    localStorage.setItem('fms_selected_shift', selectedBriefingShift);
  }, [selectedBriefingShift]);
  
  useEffect(() => {
    localStorage.setItem('fms_alerts', JSON.stringify(alerts));
  }, [alerts]);


  const refreshData = useCallback(async () => {
    if (!appUser) return;

    try {
      setIsLoading(true);
      setIsAlertsLoading(true);
      const [fetchedTanks, fetchedJobs, fetchedBriefing, fetchedAlerts, fetchedEq, fetchedLogs, fetchedStaff] = await Promise.all([
        supabaseService.getTanks(),
        supabaseService.getFlightJobs(),
        supabaseService.getShiftBriefingInfo(new Date().toISOString().split('T')[0], selectedBriefingShift),
        supabaseService.getAlerts(),
        supabaseService.getEquipment(),
        supabaseService.getFlightLogs(),
        supabaseService.getStaff()
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
      if (fetchedJobs && fetchedJobs.length > 0) setFlightJobs(fetchedJobs);
      if (fetchedBriefing && typeof fetchedBriefing === 'object') {
         // Merge with default staff if missing
         const staff = (fetchedBriefing as any).staffAssignments || {
            activeOperators: ['u3', 'u3b'],
            activeOfficers: ['u1'],
            hydrantOpsOfficers: ['u7'],
            dutySupervisor: 'u2',
            shiftInCharge: 'u2b'
         };
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
      
    } catch (error) {
      console.error('Error refreshing operational data:', error);
    } finally {
      setIsLoading(false);
      setIsAlertsLoading(false);
    }
  }, []);

  // Sync with Supabase when user logs in or shift changes
  useEffect(() => {
    if (appUser) {
      refreshData();
    }
  }, [appUser, selectedBriefingShift, refreshData]);

  // Dedicated Real-time Listeners Effect
  useEffect(() => {
    if (!appUser) {
      // Revert to mock data if signed out
      setEquipment(EQUIPMENT);
      setAlerts(MOCK_ALERTS);
      return;
    }

    console.log("PROVIDER: Initializing live listeners for user:", appUser.id, appUser.role);
    setIsAlertsLoading(true);

    const unsubscribeAlerts = supabaseService.subscribeToAlerts((updatedAlerts) => {
      console.log("SYNC: Alerts received from Supabase. Count:", updatedAlerts.length);
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

    return () => {
      console.log("PROVIDER: Tearing down listeners for user:", appUser.id);
      if (unsubscribeAlerts) unsubscribeAlerts();
      if (unsubscribeEquipment) unsubscribeEquipment();
      if (unsubscribeTanks) unsubscribeTanks();
      if (unsubscribeStaff) unsubscribeStaff();
    };
  }, [appUser]);

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
      const todayDate = new Date().toISOString().split('T')[0];
      try {
        await supabaseService.upsertShiftBriefingInfo(todayDate, selectedBriefingShift, info, dieselNeeds, finalStaff !== undefined ? finalStaff : null);
      } catch (error) {
        console.error('Failed to sync briefing update to Firestore:', error);
      }
    }
  };

  const updateFlightJob = (id: string, updates: Partial<FlightJob>) => {
    setFlightJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  };

  const addFlightJob = (job: FlightJob) => {
    setFlightJobs(prev => [...prev, job]);
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
      // Acknowledge all first so they're removed from views, then wipe local state
      await supabaseService.acknowledgeAllAlerts(allIds);
      setAlerts([]);
      localStorage.setItem('fms_alerts', JSON.stringify([]));
    } catch (error) {
      console.error('Failed to clear all alerts:', error);
      // Fallback: clear locally anyway
      setAlerts([]);
      localStorage.setItem('fms_alerts', JSON.stringify([]));
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

  return (
    <OperationalDataContext.Provider value={{
      equipment: equipment || [],
      tanks: tanks || [],
      flightJobs: flightJobs || [],
      domesticFlights: domesticFlights || [],
      briefingInfo: briefingInfo || { info: [], dieselNeeds: [], staffAssignments: undefined },
      selectedBriefingShift,
      setSelectedBriefingShift,
      updateEquipmentStatus,
      updateEquipment,
      updateTankLevel,
      updateBriefingInfo,
      updateFlightJob,
      addFlightJob,
      createAlert,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      clearAllAlerts,
      refreshData,
      isLoading,
      alerts: alerts || [],
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
      deleteTank
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
