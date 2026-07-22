import { fmsDb, OutboxItem } from './db';
import { supabase } from '../supabase';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

type SyncStatusListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private pendingCount: number = 0;
  private lastSyncedAt: string | null = localStorage.getItem('fms_last_synced_at');
  private lastError: string | null = null;
  private listeners: Set<SyncStatusListener> = new Set();
  private syncTimer: any = null;

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    this.updatePendingCount();

    // Periodic auto-sync every 30 seconds if online
    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.flushOutbox();
      }
    }, 30000);
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncEngineStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try { cb(status); } catch (e) { console.error('[SyncEngine] Listener error:', e); }
    });
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    console.log(`[SyncEngine] Network status changed to: ${online ? 'ONLINE' : 'OFFLINE'}`);
    this.notify();
    if (online) {
      this.flushOutbox();
    }
  }

  async updatePendingCount(): Promise<number> {
    try {
      const items = await fmsDb.getPendingOutbox();
      this.pendingCount = items.length;
      this.notify();
      return this.pendingCount;
    } catch (e) {
      console.warn('[SyncEngine] Failed to get pending count:', e);
      return 0;
    }
  }

  async flushOutbox(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    try {
      const items = await fmsDb.getPendingOutbox();
      this.pendingCount = items.length;
      if (items.length === 0) {
        this.isSyncing = false;
        this.notify();
        return;
      }

      this.isSyncing = true;
      this.lastError = null;
      this.notify();

      console.log(`[SyncEngine] Flushing ${items.length} outbox item(s) to server...`);

      for (const item of items) {
        if (!this.isOnline) break;

        await fmsDb.updateOutboxItem(item.id, { syncStatus: 'SYNCING' });

        try {
          await this.processOutboxItem(item);
          await fmsDb.removeOutboxItem(item.id);
          console.log(`[SyncEngine] Successfully synced item ${item.id} (${item.entityType}:${item.action})`);
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.error(`[SyncEngine] Error syncing item ${item.id}:`, err);
          const nextRetry = item.retryCount + 1;
          await fmsDb.updateOutboxItem(item.id, {
            syncStatus: nextRetry >= 5 ? 'FAILED' : 'PENDING',
            retryCount: nextRetry,
            lastError: errMsg
          });
          this.lastError = `Item ${item.entityType} failed: ${errMsg}`;
        }
      }

      const remaining = await fmsDb.getPendingOutbox();
      this.pendingCount = remaining.length;
      this.lastSyncedAt = new Date().toISOString();
      localStorage.setItem('fms_last_synced_at', this.lastSyncedAt);
    } catch (err: any) {
      console.error('[SyncEngine] Global outbox flush error:', err);
      this.lastError = err?.message || 'Outbox flush failed';
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  private async processOutboxItem(item: OutboxItem): Promise<void> {
    const { entityType, action, payload } = item;

    switch (entityType) {
      case 'tank': {
        if (action === 'UPDATE') {
          const { error } = await supabase.from('tanks').update(payload).eq('id', item.entityId);
          if (error) throw error;
        } else if (action === 'INSERT') {
          const { error } = await supabase.from('tanks').insert([payload]);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from('tanks').delete().eq('id', item.entityId);
          if (error) throw error;
        }
        break;
      }
      case 'flight_job': {
        if (action === 'UPDATE') {
          const { error } = await supabase.from('flight_jobs').update(payload).eq('id', item.entityId);
          if (error) throw error;
        } else if (action === 'INSERT') {
          const { error } = await supabase.from('flight_jobs').insert([payload]);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from('flight_jobs').delete().eq('id', item.entityId);
          if (error) throw error;
        }
        break;
      }
      case 'bridging_log': {
        if (action === 'INSERT') {
          const { error } = await supabase.from('bridging_logs').insert([payload]);
          if (error) throw error;
        }
        break;
      }
      case 'staff': {
        if (action === 'UPDATE') {
          const { error } = await supabase.from('staff').update(payload).eq('id', item.entityId);
          if (error) throw error;
        } else if (action === 'INSERT') {
          const { error } = await supabase.from('staff').insert([payload]);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from('staff').delete().eq('id', item.entityId);
          if (error) throw error;
        }
        break;
      }
      case 'equipment': {
        if (action === 'UPDATE') {
          const { error } = await supabase.from('equipment').update(payload).eq('id', item.entityId);
          if (error) throw error;
        } else if (action === 'INSERT') {
          const { error } = await supabase.from('equipment').insert([payload]);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from('equipment').delete().eq('id', item.entityId);
          if (error) throw error;
        }
        break;
      }
      case 'vessel': {
        if (action === 'UPDATE') {
          const { error } = await supabase.from('vessels').update(payload).eq('id', item.entityId);
          if (error) throw error;
        } else if (action === 'INSERT') {
          const { error } = await supabase.from('vessels').insert([payload]);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from('vessels').delete().eq('id', item.entityId);
          if (error) throw error;
        }
        break;
      }
      default:
        console.warn(`[SyncEngine] Unknown entity type: ${entityType}`);
    }
  }
}

export const syncEngine = new SyncEngine();
