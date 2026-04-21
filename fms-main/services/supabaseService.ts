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
  async getUsers(): Promise<User[] | null> {
    if (!auth.currentUser) return null;

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
  async getTanks(): Promise<Tank[] | null> {
    if (!auth.currentUser) return null;

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
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  // Flight Jobs
  async getFlightJobs(): Promise<FlightJob[] | null> {
    if (!auth.currentUser) return null;

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
  async getFlightLogs(): Promise<FlightLog[] | null> {
    if (!auth.currentUser) return null;

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
    if (!auth.currentUser) return; // Mock success
    const path = 'flight_logs';
    try {
      await addDoc(collection(db, path), {
        flight_number: log.flightNumber,
        aircraft_reg: log.aircraftReg,
        aircraft_type: log.aircraftType,
        stand: log.stand,
        operator_id: log.operatorId,
        vehicle_id: log.vehicleId,
        status: log.status,
        timestamp_arrived: log.timestampArrived,
        timestamp_position: log.timestampPosition,
        timestamp_start: log.timestampStart,
        timestamp_initial_end: log.timestampInitialEnd,
        timestamp_final_start: log.timestampFinalStart,
        timestamp_final_end: log.timestampFinalEnd,
        timestamp_clearance: log.timestampClearance,
        meter_open: log.meterOpen,
        meter_close: log.meterClose,
        volume: log.volume,
        panel_check: log.panelCheck,
        walk_around_check: log.walkAroundCheck,
        appearance_check: log.appearanceCheck,
        water_check: log.waterCheck,
        remarks: log.remarks || ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  // Bridging Logs
  async getBridgingLogs(): Promise<BridgingLog[] | null> {
    if (!auth.currentUser) return null;

    const path = 'bridging_logs';
    try {
      const querySnapshot = await getDocs(collection(db, path));
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
          operatorId: data.operator_id
        } as BridgingLog;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async createBridgingLog(log: Omit<BridgingLog, 'id'>): Promise<void> {
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
        density: log.density,
        temperature: log.temperature,
        operator_id: log.operatorId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  // Alerts
  async getAlerts(): Promise<Alert[] | null> {
    if (!auth.currentUser) return null;

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
  async getEquipment(): Promise<Equipment[] | null> {
    if (!auth.currentUser) return null;

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
    if (!auth.currentUser) return; // Mock success
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
  async getShiftBriefingInfo(date: string) {
    if (!auth.currentUser) return null;

    const path = 'shift_briefing_info';
    try {
      const q = query(collection(db, path), where('date', '==', date));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        return {
          info: data.info || [],
          dieselNeeds: data.diesel_needs || []
        };
      }
      return { info: [], dieselNeeds: [] };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async upsertShiftBriefingInfo(date: string, info: any[], dieselNeeds: string[]) {
    if (!auth.currentUser) return; // Mock success
    const docId = date;
    const path = `shift_briefing_info/${docId}`;
    try {
      const briefingRef = doc(db, 'shift_briefing_info', docId);
      await setDoc(briefingRef, {
        date: date,
        info: info,
        diesel_needs: dieselNeeds
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  }
};
