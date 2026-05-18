import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, query, where, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { User, Tank, FlightLog, BridgingLog, Alert, FlightJob, Equipment } from '../types';
import { TANKS, MOCK_USERS, MOCK_JOBS, RECENT_LOGS, MOCK_ALERTS, MOCK_DOMESTIC_FLIGHTS, EQUIPMENT } from '../constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

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

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const supabaseService = {
  // Users
  async getUsers(): Promise<User[]> {
    if (!auth.currentUser) return [];

    const path = 'users';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  // Tanks
  async getTanks(): Promise<Tank[]> {
    if (!auth.currentUser) return [];

    const path = 'tanks';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          type: data.type,
          capacity: data.capacity,
          currentLevel: data.current_level,
          safeMinLevel: data.safe_min_level,
          lastUpdated: data.last_updated
        } as Tank;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async updateTankLevel(id: string, newLevel: number): Promise<void> {
    if (!auth.currentUser) return; // Mock success
    const path = `tanks/${id}`;
    try {
      const tankRef = doc(db, 'tanks', id);
      await updateDoc(tankRef, {
        current_level: newLevel,
        last_updated: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Firestore updateTankLevel failed, continuing with local state update:', error);
    }
  },

  // Flight Jobs
  async getFlightJobs(): Promise<FlightJob[]> {
    if (!auth.currentUser) return [];

    const path = 'flight_jobs';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          flightNumber: data.flight_number,
          aircraftReg: data.aircraft_reg,
          aircraftType: data.aircraft_type,
          stand: data.stand,
          assignedTo: data.assigned_to,
          status: data.status
        } as FlightJob;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  // Flight Logs
  async getFlightLogs(): Promise<FlightLog[]> {
    if (!auth.currentUser) return [];

    const path = 'flight_logs';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          flightNumber: data.flight_number,
          aircraftReg: data.aircraft_reg,
          aircraftType: data.aircraft_type,
          stand: data.stand,
          operatorId: data.operator_id,
          vehicleId: data.vehicle_id,
          status: data.status,
          timestampArrived: data.timestamp_arrived,
          timestampPosition: data.timestamp_position,
          timestampStart: data.timestamp_start,
          timestampInitialEnd: data.timestamp_initial_end,
          timestampFinalStart: data.timestamp_final_start,
          timestampFinalEnd: data.timestamp_final_end,
          timestampClearance: data.timestamp_clearance,
          meterOpen: data.meter_open,
          meterClose: data.meter_close,
          volume: data.volume,
          panelCheck: data.panel_check,
          walkAroundCheck: data.walk_around_check,
          appearanceCheck: data.appearance_check,
          waterCheck: data.water_check
        } as FlightLog;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async createFlightLog(log: Omit<FlightLog, 'id'>): Promise<void> {
    const path = 'flight_logs';
    
    // 1. Sync to BigQuery (Primary Record for Into-Plane)
    try {
      await this.syncToBigQuery('into_plane_refuelling', log);
    } catch (bqError) {
      console.error('BigQuery Sync Failed:', bqError);
      // We continue to Firebase as a fallback
    }

    // 2. Save to Firestore (Real-time cache/fallback)
    if (!auth.currentUser) return; 

    try {
      await addDoc(collection(db, path), {
        flight_number: log.flightNumber || '',
        aircraft_reg: log.aircraftReg || '',
        aircraft_type: log.aircraftType || '',
        stand: log.stand || '',
        operator_id: log.operatorId || '',
        vehicle_id: log.vehicleId || '',
        status: log.status || 'PENDING',
        delivery_number: log.deliveryNumber || null,
        pit_number: log.pitNumber || null,
        timestamp_arrived: log.timestampArrived ?? null,
        timestamp_position: log.timestampPosition ?? null,
        timestamp_start: log.timestampStart ?? null,
        timestamp_initial_end: log.timestampInitialEnd ?? null,
        timestamp_final_start: log.timestampFinalStart ?? null,
        timestamp_final_end: log.timestampFinalEnd ?? null,
        timestamp_clearance: log.timestampClearance ?? null,
        meter_open: log.meterOpen ?? 0,
        meter_close: log.meterClose ?? 0,
        volume: log.volume ?? 0,
        panel_check: log.panelCheck ?? false,
        walk_around_check: log.walkAroundCheck ?? false,
        appearance_check: log.appearanceCheck ?? false,
        water_check: log.waterCheck ?? false,
        remarks: log.remarks || '',
        created_at: new Date().toISOString()
      });
    } catch (error) {
      // If Firestore fails (permissions, etc.), we don't throw if BigQuery succeeded
      console.warn('Firestore fallback save failed (Permissions or Config):', error instanceof Error ? error.message : error);
    }
  },

  async updateFlightLog(id: string, updates: Partial<FlightLog>): Promise<void> {
    if (!auth.currentUser) return;
    const path = `flight_logs/${id}`;
    try {
      const logRef = doc(db, 'flight_logs', id);
      const dbUpdates: any = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.volume !== undefined) dbUpdates.volume = updates.volume;
      if (updates.meterOpen !== undefined) dbUpdates.meter_open = updates.meterOpen;
      if (updates.meterClose !== undefined) dbUpdates.meter_close = updates.meterClose;
      
      await updateDoc(logRef, dbUpdates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  // Bridging Logs
  async getBridgingLogs(): Promise<BridgingLog[]> {
    if (!auth.currentUser) return localBridgingLogs;

    const path = 'bridging_logs';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      if (querySnapshot.empty) return localBridgingLogs;
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sourceTankId: data.source_tank_id,
          vehicleId: data.vehicle_id,
          volume: data.volume,
          startTime: data.start_time,
          endTime: data.end_time,
          visualCheckPassed: data.visual_check_passed,
          cwdCheckPassed: data.cwd_check_passed,
          density: data.density,
          temperature: data.temperature,
          operatorId: data.operator_id,
          date: data.date
        } as BridgingLog;
      });
    } catch (error) {
      console.warn('Firestore getBridgingLogs failed, falling back to localBridgingLogs:', error);
      return localBridgingLogs;
    }
  },

  async createBridgingLog(log: Omit<BridgingLog, 'id'>): Promise<void> {
    const id = `bl-${Date.now()}`;
    const newLog: BridgingLog = { id, ...log };
    localBridgingLogs.unshift(newLog); // Prepend to the local memory array!

    if (!auth.currentUser) return; // Mock success
    const path = 'bridging_logs';
    try {
      await addDoc(collection(db, path), {
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
        date: log.date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Firestore fallback save failed (Permissions or Config) for bridging log:', error);
    }
  },

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    if (!auth.currentUser) return [];

    const path = 'alerts';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  subscribeToAlerts(callback: (alerts: Alert[]) => void) {
    if (!auth.currentUser) return () => {};
    const path = 'alerts';

    const q = query(collection(db, path));
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      callback(alerts);
    }, (error) => {
      console.error('Alerts Subscription Error:', error);
    });
  },

  async acknowledgeAlert(id: string): Promise<void> {
    if (!auth.currentUser) return; // Mock success
    const path = `alerts/${id}`;
    try {
      const alertRef = doc(db, 'alerts', id);
      await updateDoc(alertRef, { acknowledged: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async acknowledgeAllAlerts(ids: string[]): Promise<void> {
    if (!auth.currentUser) return; // Mock success
    const path = 'alerts/bulk';
    try {
      await Promise.all(ids.map(id => {
        const alertRef = doc(db, 'alerts', id);
        return updateDoc(alertRef, { acknowledged: true });
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async createAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    if (!auth.currentUser) {
      console.warn("User not authenticated. Simulating successful alert creation locally.");
      return;
    }
    const path = 'alerts';
    try {
      await addDoc(collection(db, path), {
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        acknowledged: alert.acknowledged,
        targetRole: alert.targetRole || null,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async checkActiveReplenishRequest(eqId: string): Promise<boolean> {
    if (!auth.currentUser) return false;
    const path = 'alerts';
    try {
      const q = query(
        collection(db, path), 
        where('acknowledged', '==', false),
        where('message', '==', `Replenishment requested for unit ${eqId}`)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return false;
    }
  },

  // Equipment
  async getEquipment(): Promise<Equipment[]> {
    if (!auth.currentUser) return [];

    const path = 'equipment';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      if (querySnapshot.empty) return EQUIPMENT;
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as Equipment;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async updateEquipmentStatus(id: string, status: string): Promise<void> {
    if (!auth.currentUser) return; // Mock success
    const path = `equipment/${id}`;
    try {
      const eqRef = doc(db, 'equipment', id);
      await setDoc(eqRef, {
        status: status,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<void> {
    if (!auth.currentUser) return; // Mock success
    const path = `equipment/${id}`;
    try {
      const eqRef = doc(db, 'equipment', id);
      await setDoc(eqRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  subscribeToEquipment(callback: (equipment: Equipment[]) => void) {
    if (!auth.currentUser) return () => {};
    const path = 'equipment';

    const q = query(collection(db, path));
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(EQUIPMENT);
        return;
      }
      const equipment = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      callback(equipment);
    }, (error) => {
      console.error('Equipment Subscription Error:', error);
    });
  },

  // Domestic Assignments
  async getDomesticAssignments(date: string) {
    if (!auth.currentUser) return null;

    const path = 'domestic_assignments';
    try {
      const q = query(collection(db, path), where('assignment_date', '==', date));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async upsertDomesticAssignment(date: string, teamName: string, op1: string, op2: string) {
    if (!auth.currentUser) return; 
    const docId = `${date}_${teamName}`;
    const path = `domestic_assignments/${docId}`;
    try {
      const assignmentRef = doc(db, 'domestic_assignments', docId);
      await setDoc(assignmentRef, {
        assignment_date: date,
        team_name: teamName,
        operator1_id: op1,
        operator2_id: op2
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  // Equipment Assignments
  async getEquipmentAssignments(date: string, shiftType: string) {
    if (!auth.currentUser) return null;

    const path = 'equipment_assignments';
    try {
      const q = query(collection(db, path), 
        where('assignment_date', '==', date),
        where('shift_type', '==', shiftType)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async upsertEquipmentAssignment(date: string, eqId: string, shiftType: string, op1: string, op2: string) {
    if (!auth.currentUser) return; // Mock success
    const docId = `${date}_${eqId}_${shiftType}`;
    const path = `equipment_assignments/${docId}`;
    try {
      const assignmentRef = doc(db, 'equipment_assignments', docId);
      await setDoc(assignmentRef, {
        assignment_date: date,
        equipment_id: eqId,
        shift_type: shiftType,
        operator1_id: op1,
        operator2_id: op2
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  // Shift Briefing
  async getShiftBriefingInfo(date: string, shift: string) {
    if (!auth.currentUser) return null;

    const path = 'shift_briefing_info';
    try {
      const docId = `${date}_${shift}`;
      const q = query(collection(db, path), where('date', '==', date), where('shift', '==', shift));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        return {
          info: data.info || [],
          dieselNeeds: data.diesel_needs || [],
          staffAssignments: data.staff_assignments || null
        };
      }
      // Fallback: try getting by the old date-only ID for backwards compatibility
      const oldQ = query(collection(db, path), where('date', '==', date));
      const oldQuerySnapshot = await getDocs(oldQ);
      if (!oldQuerySnapshot.empty) {
        const data = oldQuerySnapshot.docs[0].data();
        // Only return old data if it doesn't have a specific shift assigned yet
        if (!data.shift) {
           return {
             info: data.info || [],
             dieselNeeds: data.diesel_needs || [],
             staffAssignments: data.staff_assignments || null
           };
        }
      }
      return { info: [], dieselNeeds: [], staffAssignments: null };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async upsertShiftBriefingInfo(date: string, shift: string, info: any[], dieselNeeds: string[], staffAssignments: any) {
    if (!auth.currentUser) return;
    const docId = `${date}_${shift}`;
    const path = `shift_briefing_info/${docId}`;
    try {
      const briefingRef = doc(db, 'shift_briefing_info', docId);
      await setDoc(briefingRef, {
        date: date,
        shift: shift,
        info: info,
        diesel_needs: dieselNeeds,
        staff_assignments: staffAssignments
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  },

  // BigQuery Sync (Operational Data Warehouse)
  async syncToBigQuery(table: string, data: any): Promise<void> {
    // In a real production environment, this would hit a cloud function or an API endpoint 
    // that proxies the request to BigQuery using the Google Cloud SDK.
    console.log(`[BigQuery Sync] Syncing to table: ${table}`, data);
    
    try {
      // Simulate API call to BigQuery proxy
      // await fetch('https://api.your-system.com/v1/bigquery/sync', { ... });
      
      // For this demo/development phase, we log the intent.
      return Promise.resolve();
    } catch (error) {
      console.error('BigQuery Sync Failed:', error);
      throw error;
    }
  }
};
