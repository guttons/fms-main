import { Tank, FlightJob, FlightLog, BridgingLog, StaffMember, Equipment, Vessel } from '../types';
import { CustomerAccount } from '../context/FinanceDataContext';

export interface OutboxItem {
  id: string; // UUID or timestamp string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SYNC_STATUS';
  entityType: 'tank' | 'flight_job' | 'flight_log' | 'bridging_log' | 'customer' | 'staff' | 'equipment' | 'vessel' | 'shift_briefing';
  entityId: string;
  payload: any;
  timestamp: string;
  idempotencyKey: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SUCCESS';
  retryCount: number;
  lastError?: string;
}

export interface CalibrationPoint {
  id?: string;
  tankId: string;
  heightCm: number;
  volumeLiters: number;
}

export interface FlightCustomerMapping {
  key: string; // flightNumber or aircraftReg (normalized upper case)
  type: 'FLIGHT' | 'AIRCRAFT_REG';
  customerId: string;
  customerName: string;
  classification: 'ADVANCE' | 'CREDIT' | 'CASH';
}

const DB_NAME = 'MACL_FMS_OFFLINE_DB';
const DB_VERSION = 1;

class FMSDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create Object Stores if they don't exist
        if (!db.objectStoreNames.contains('tanks')) {
          db.createObjectStore('tanks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('flight_jobs')) {
          const fjStore = db.createObjectStore('flight_jobs', { keyPath: 'id' });
          fjStore.createIndex('status', 'status', { unique: false });
          fjStore.createIndex('flightNumber', 'flightNumber', { unique: false });
        }
        if (!db.objectStoreNames.contains('flight_logs')) {
          const flStore = db.createObjectStore('flight_logs', { keyPath: 'id' });
          flStore.createIndex('flightJobId', 'flightJobId', { unique: false });
        }
        if (!db.objectStoreNames.contains('bridging_logs')) {
          db.createObjectStore('bridging_logs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customer_accounts')) {
          const custStore = db.createObjectStore('customer_accounts', { keyPath: 'id' });
          custStore.createIndex('classification', 'classification', { unique: false });
        }
        if (!db.objectStoreNames.contains('flight_customer_mappings')) {
          const mapStore = db.createObjectStore('flight_customer_mappings', { keyPath: 'key' });
          mapStore.createIndex('customerId', 'customerId', { unique: false });
        }
        if (!db.objectStoreNames.contains('calibration_charts')) {
          const calStore = db.createObjectStore('calibration_charts', { keyPath: 'id', autoIncrement: true });
          calStore.createIndex('tankId', 'tankId', { unique: false });
        }
        if (!db.objectStoreNames.contains('equipment')) {
          db.createObjectStore('equipment', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('staff')) {
          db.createObjectStore('staff', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vessels')) {
          db.createObjectStore('vessels', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('app_meta')) {
          db.createObjectStore('app_meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.error('[IndexedDB] Failed to open database:', e);
        reject((e.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.initDB();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // ── Generic CRUD Helpers ───────────────────────────────────────────────────

  async getAll<T>(storeName: string): Promise<T[]> {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] getAll ${storeName} failed:`, err);
      return [];
    }
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    try {
      const store = await this.getStore(storeName, 'readonly');
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`[IndexedDB] get ${storeName}/${key} failed:`, err);
      return null;
    }
  }

  async put<T>(storeName: string, value: T): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error(`[IndexedDB] put ${storeName} failed:`, err);
    }
  }

  async bulkPut<T>(storeName: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    try {
      const db = await this.initDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDB] bulkPut ${storeName} failed:`, err);
    }
  }

  async delete(storeName: string, key: string): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error(`[IndexedDB] delete ${storeName}/${key} failed:`, err);
    }
  }

  // ── Master DB: Customer Account & Flight/Reg Categorization ────────────────

  async indexCustomerMappings(customers: CustomerAccount[]): Promise<void> {
    const mappings: FlightCustomerMapping[] = [];

    for (const cust of customers) {
      // Save customer record
      await this.put('customer_accounts', cust);

      // Index associated flight numbers if present
      if (cust.associatedAirlines && cust.associatedAirlines.length > 0) {
        for (const code of cust.associatedAirlines) {
          const normKey = code.toUpperCase().trim();
          mappings.push({
            key: normKey,
            type: 'FLIGHT',
            customerId: cust.id,
            customerName: cust.name,
            classification: cust.classification
          });
        }
      }
    }

    if (mappings.length > 0) {
      await this.bulkPut('flight_customer_mappings', mappings);
    }
  }

  async mapFlightOrRegToCustomer(key: string, customerId: string, customerName: string, classification: 'ADVANCE' | 'CREDIT' | 'CASH', type: 'FLIGHT' | 'AIRCRAFT_REG'): Promise<void> {
    const normKey = key.toUpperCase().trim();
    const mapping: FlightCustomerMapping = {
      key: normKey,
      type,
      customerId,
      customerName,
      classification
    };
    await this.put('flight_customer_mappings', mapping);
  }

  async getCustomerForFlightOrReg(flightNumber?: string, aircraftReg?: string): Promise<{ customer: CustomerAccount | null; mapping: FlightCustomerMapping | null }> {
    try {
      // 1. Try flight number lookup
      if (flightNumber) {
        const cleanFlight = flightNumber.toUpperCase().trim();
        const mapping = await this.get<FlightCustomerMapping>('flight_customer_mappings', cleanFlight);
        if (mapping) {
          const cust = await this.get<CustomerAccount>('customer_accounts', mapping.customerId);
          return { customer: cust, mapping };
        }
        // Extract airline prefix (e.g. "EK" from "EK650", "BA" from "BA123")
        const match = cleanFlight.match(/^([A-Z0-9]{2,3})\d+/);
        if (match) {
          const airlineCode = match[1];
          const prefixMapping = await this.get<FlightCustomerMapping>('flight_customer_mappings', airlineCode);
          if (prefixMapping) {
            const cust = await this.get<CustomerAccount>('customer_accounts', prefixMapping.customerId);
            return { customer: cust, mapping: prefixMapping };
          }
        }
      }

      // 2. Try Aircraft Registration / Tail Number lookup
      if (aircraftReg) {
        const cleanReg = aircraftReg.toUpperCase().trim();
        const mapping = await this.get<FlightCustomerMapping>('flight_customer_mappings', cleanReg);
        if (mapping) {
          const cust = await this.get<CustomerAccount>('customer_accounts', mapping.customerId);
          return { customer: cust, mapping };
        }
      }

      return { customer: null, mapping: null };
    } catch (err) {
      console.warn('[IndexedDB] getCustomerForFlightOrReg failed:', err);
      return { customer: null, mapping: null };
    }
  }

  // ── Outbox Queue Methods ───────────────────────────────────────────────────

  async enqueueOutbox(item: Omit<OutboxItem, 'id' | 'timestamp' | 'syncStatus' | 'retryCount'>): Promise<OutboxItem> {
    const fullItem: OutboxItem = {
      ...item,
      id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      syncStatus: 'PENDING',
      retryCount: 0
    };
    await this.put('outbox', fullItem);
    return fullItem;
  }

  async getPendingOutbox(): Promise<OutboxItem[]> {
    const all = await this.getAll<OutboxItem>('outbox');
    return all.filter(item => item.syncStatus === 'PENDING' || item.syncStatus === 'FAILED');
  }

  async updateOutboxItem(id: string, updates: Partial<OutboxItem>): Promise<void> {
    const existing = await this.get<OutboxItem>('outbox', id);
    if (existing) {
      await this.put('outbox', { ...existing, ...updates });
    }
  }

  async removeOutboxItem(id: string): Promise<void> {
    await this.delete('outbox', id);
  }

  async clearOutbox(): Promise<void> {
    const db = await this.initDB();
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').clear();
  }
}

export const fmsDb = new FMSDatabase();
