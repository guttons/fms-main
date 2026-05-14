
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Equipment, Tank, FlightJob, EquipmentStatus as EqStatus, Alert, FlightLog } from '../types';
import { EQUIPMENT, TANKS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS, MOCK_ALERTS } from '../constants';
import { supabaseService } from '../services/supabaseService';
import { auth } from '../firebase';

interface ShiftBriefingInfo {
  info: { text: string; type: string; isHighAlert?: boolean }[];
  dieselNeeds: string[];
}

interface OperationalDataContextType {
  equipment: Equipment[];
  tanks: Tank[];
  flightJobs: FlightJob[];
  domesticFlights: any[];
  briefingInfo: ShiftBriefingInfo;
  alerts: Alert[];
  flightLogs: FlightLog[];
  isAlertsLoading: boolean;
  updateEquipmentStatus: (id: string, status: EqStatus) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => Promise<void>;
  updateTankLevel: (id: string, newLevel: number) => Promise<void>;
  updateBriefingInfo: (info: any[], dieselNeeds: string[]) => Promise<void>;
  updateFlightJob: (id: string, updates: Partial<FlightJob>) => void;
  addFlightJob: (job: FlightJob) => void;
  createAlert: (alert: Omit<Alert, 'id'>) => Promise<boolean>;
  acknowledgeAlert: (id: string) => Promise<void>;
  acknowledgeAllAlerts: (ids: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  isLoading: boolean;
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

  const [briefingInfo, setBriefingInfo] = useState<ShiftBriefingInfo>(() => {
    const saved = localStorage.getItem('fms_briefing_info');
    return saved ? JSON.parse(saved) : {
      info: [
        { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'critical', isHighAlert: true },
        { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'standard' },
        { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'standard' },
        { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'standard' },
        { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'standard' },
      ],
      dieselNeeds: []
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
    localStorage.setItem('fms_briefing_info', JSON.stringify(briefingInfo));
  }, [briefingInfo]);
  
  useEffect(() => {
    localStorage.setItem('fms_alerts', JSON.stringify(alerts));
  }, [alerts]);


  const refreshData = useCallback(async () => {
    if (!appUser) return;

    try {
      setIsLoading(true);
      setIsAlertsLoading(true);
      const [fetchedTanks, fetchedJobs, fetchedBriefing, fetchedAlerts, fetchedEq, fetchedLogs] = await Promise.all([
        supabaseService.getTanks(),
        supabaseService.getFlightJobs(),
        supabaseService.getShiftBriefingInfo(new Date().toISOString().split('T')[0]),
        supabaseService.getAlerts(),
        supabaseService.getEquipment(),
        supabaseService.getFlightLogs()
      ]);

      if (fetchedTanks && fetchedTanks.length > 0) setTanks(fetchedTanks);
      if (fetchedJobs && fetchedJobs.length > 0) setFlightJobs(fetchedJobs);
      if (fetchedBriefing && typeof fetchedBriefing === 'object') setBriefingInfo(fetchedBriefing as any);
      if (fetchedEq && fetchedEq.length > 0) {
        setEquipment(prev => {
          return EQUIPMENT.map(mock => {
            const live = fetchedEq.find(f => f.id === mock.id);
            return live ? { ...mock, ...live } : mock;
          });
        });
      }
      if (fetchedAlerts && Array.isArray(fetchedAlerts)) setAlerts(fetchedAlerts);
      if (fetchedLogs && Array.isArray(fetchedLogs)) setFlightLogs(fetchedLogs);
      
    } catch (error) {
      console.error('Error refreshing operational data:', error);
    } finally {
      setIsLoading(false);
      setIsAlertsLoading(false);
    }
  }, []);

  // Sync with Firestore when user logs in
  useEffect(() => {
    if (appUser) {
      refreshData();
    }
  }, [appUser, refreshData]);

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
      console.log("SYNC: Alerts received from Firestore. Count:", updatedAlerts.length);
      setAlerts(updatedAlerts);
      setIsAlertsLoading(false);
    });

    const unsubscribeEquipment = supabaseService.subscribeToEquipment((updatedEq) => {
      console.log("SYNC: Equipment received from Firestore. Count:", updatedEq.length);
      if (updatedEq && updatedEq.length > 0) {
        setEquipment(prev => {
          return EQUIPMENT.map(mock => {
            const live = updatedEq.find(f => f.id === mock.id);
            return live ? { ...mock, ...live } : mock;
          });
        });
      }
    });

    return () => {
      console.log("PROVIDER: Tearing down listeners for user:", appUser.id);
      if (unsubscribeAlerts) unsubscribeAlerts();
      if (unsubscribeEquipment) unsubscribeEquipment();
    };
  }, [appUser]);

  const updateEquipmentStatus = async (id: string, status: EqStatus) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, status, lastUpdated: new Date().toISOString() } : eq
    ));

    if (auth.currentUser) {
      try {
        await supabaseService.updateEquipmentStatus(id, status);
      } catch (error) {
        console.error('Failed to sync equipment status to Firestore:', error);
      }
    }
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, ...updates, lastUpdated: new Date().toISOString() } : eq
    ));

    if (auth.currentUser) {
      try {
        await supabaseService.updateEquipment(id, updates);
      } catch (error) {
        console.error('Failed to sync equipment update to Firestore:', error);
      }
    }
  };

  const updateTankLevel = async (id: string, newLevel: number) => {
    setTanks(prev => prev.map(t => 
      t.id === id ? { ...t, currentLevel: newLevel, lastUpdated: new Date().toISOString() } : t
    ));

    if (auth.currentUser) {
      try {
        await supabaseService.updateTankLevel(id, newLevel);
      } catch (error) {
        console.error('Failed to sync tank update to Firestore:', error);
      }
    }
  };

  const updateBriefingInfo = async (info: any[], dieselNeeds: string[]) => {
    setBriefingInfo({ info, dieselNeeds });

    if (appUser) {
      const todayDate = new Date().toISOString().split('T')[0];
      try {
        await supabaseService.upsertShiftBriefingInfo(todayDate, info, dieselNeeds);
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
      const now = Date.now();
      const lastRequest = replenishmentLocks.current[vehicleId] || 0;
      const COOLDOWN = 5000; // 5 seconds

      // Block if requested in the last 5 seconds (frontend cooldown)
      if (now - lastRequest < COOLDOWN) {
        console.warn(`Replenishment lock active for ${vehicleId}. Blocking duplicate.`);
        return false;
      }
      
      // Also check existing alerts
      const alreadyRequested = (alerts || []).some(a => 
        !a.acknowledged && a.message.includes(`unit ${vehicleId}`)
      );
      
      if (alreadyRequested) {
        console.warn(`Alert already exists for ${vehicleId}. Blocking.`);
        return false;
      }

      replenishmentLocks.current[vehicleId] = now;
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

  return (
    <OperationalDataContext.Provider value={{
      equipment: equipment || [],
      tanks: tanks || [],
      flightJobs: flightJobs || [],
      domesticFlights: domesticFlights || [],
      briefingInfo: briefingInfo || { info: [], dieselNeeds: [] },
      updateEquipmentStatus,
      updateEquipment,
      updateTankLevel,
      updateBriefingInfo,
      updateFlightJob,
      addFlightJob,
      createAlert,
      acknowledgeAlert,
      acknowledgeAllAlerts,
      refreshData,
      isLoading,
      alerts: alerts || [],
      flightLogs: flightLogs || [],
      isAlertsLoading
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
