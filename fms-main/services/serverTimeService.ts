/**
 * MACL Fuel Management System - Authoritative Server Time Service
 * 
 * Provides centralized, tamper-resistant time synchronization across all operational
 * modules (IntoPlane fueling logs, alert dispatches, shift briefing, delay records).
 * 
 * Uses Network Time Protocol (NTP) round-trip time (RTT) compensation and
 * high-resolution monotonic clock (`performance.now()`) to prevent local client clock
 * manipulation, time zone shifts, or device clock skew from corrupting audit records.
 */

import { supabase } from '../supabase';

const API_BASE_URL = import.meta.env.VITE_BIGQUERY_API_URL || 'http://localhost:8080';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Resync every 5 minutes

class ServerTimeService {
  private serverOffsetMs: number = 0;
  private monotonicBaseClientMs: number = 0;
  private monotonicBaseServerMs: number = 0;
  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private syncTimer: any = null;
  private listeners: Set<(date: Date) => void> = new Set();

  constructor() {
    // Load last known offset from local storage if available
    try {
      const savedOffset = localStorage.getItem('fms_server_time_offset_ms');
      if (savedOffset !== null) {
        this.serverOffsetMs = parseInt(savedOffset, 10) || 0;
      }
    } catch {
      this.serverOffsetMs = 0;
    }
  }

  /**
   * Initializes time synchronization and sets up auto-resync.
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    await this.syncTime();

    // Resync when browser regains network connectivity
    window.addEventListener('online', () => {
      console.log('[ServerTime] Network reconnected; resynchronizing clock...');
      this.syncTime();
    });

    // Periodic synchronization
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      this.syncTime();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Performs high-precision clock synchronization with the server.
   */
  public async syncTime(): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;

    const clientStart = Date.now();
    const monotonicStart = performance.now();

    try {
      let serverEpoch: number | null = null;

      // 1. Primary: Query Express Cloud Run API /server-time
      try {
        const response = await fetch(`${API_BASE_URL}/server-time`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data.epochMs === 'number') {
            serverEpoch = data.epochMs;
          } else if (data.serverTime) {
            serverEpoch = new Date(data.serverTime).getTime();
          }
        }
      } catch (err) {
        // Fall through to secondary fallback
      }

      // 2. Secondary Fallback: Supabase RPC get_server_time (only if the function exists)
      // NOTE: This RPC may not be deployed — errors are suppressed silently.
      if (!serverEpoch) {
        try {
          const { data, error } = await supabase.rpc('get_server_time');
          if (!error && data && data.epochMs) {
            serverEpoch = Number(data.epochMs);
          }
          // If error (404 / function not found), fall through silently
        } catch {
          // Fall through to HTTP Date header fallback
        }
      }

      // 3. Tertiary Fallback: HTTP Date Header from Supabase REST endpoint
      if (!serverEpoch) {
        try {
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6eXJzdGVob2VzbWh3a2h0b3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMzc3NzUsImV4cCI6MjA5NDkxMzc3NX0.itHESCbXktM7ZVUuB4BhI_UB7qH8IGVM1ZYnml8pxBk';
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pzyrstehoesmhwkhtoxd.supabase.co';
          const res = await fetch(`${supabaseUrl}/rest/v1/equipment?select=id&limit=1`, {
            method: 'HEAD',
            cache: 'no-store',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            }
          });
          const serverDateHeader = res.headers.get('date');
          if (serverDateHeader) {
            serverEpoch = new Date(serverDateHeader).getTime();
          }
        } catch {}
      }

      if (serverEpoch && !isNaN(serverEpoch)) {
        const clientEnd = Date.now();
        const monotonicEnd = performance.now();
        const rtt = clientEnd - clientStart; // Round trip time in ms

        // NTP formula: Server time estimated at clientEnd is serverEpoch + RTT / 2
        const estimatedServerNow = serverEpoch + Math.floor(rtt / 2);
        this.serverOffsetMs = estimatedServerNow - clientEnd;
        this.monotonicBaseClientMs = monotonicEnd;
        this.monotonicBaseServerMs = estimatedServerNow;

        try {
          localStorage.setItem('fms_server_time_offset_ms', this.serverOffsetMs.toString());
        } catch {}

        console.log(
          `[ServerTime] Clock synchronized. RTT: ${rtt}ms, Server Offset: ${this.serverOffsetMs}ms, ` +
          `Server Time: ${new Date(estimatedServerNow).toISOString()}`
        );

        this.notifyListeners();
        this.isSyncing = false;
        return true;
      }

      console.warn('[ServerTime] All server time sources unreachable. Using cached offset.');
    } catch (err) {
      console.warn('[ServerTime] Sync failed, maintaining previous offset:', err);
    } finally {
      this.isSyncing = false;
    }

    return false;
  }

  /**
   * Returns authoritative server epoch time in milliseconds.
   * Leverages monotonic performance.now() to prevent client clock tampering.
   */
  public getServerEpochMs(): number {
    if (this.monotonicBaseClientMs > 0 && this.monotonicBaseServerMs > 0) {
      const monotonicElapsed = performance.now() - this.monotonicBaseClientMs;
      return Math.round(this.monotonicBaseServerMs + monotonicElapsed);
    }
    return Date.now() + this.serverOffsetMs;
  }

  /**
   * Returns authoritative server Date instance.
   */
  public getServerTime(): Date {
    return new Date(this.getServerEpochMs());
  }

  /**
   * Returns authoritative server ISO timestamp (UTC), e.g., "2026-09-20T06:55:00.123Z".
   */
  public getServerIso(): string {
    return this.getServerTime().toISOString();
  }

  /**
   * Returns authoritative server date string (YYYY-MM-DD).
   */
  public getServerDate(): string {
    return this.getServerIso().split('T')[0];
  }

  /**
   * Formats authoritative server time to HH:mm (24-hour format) in local or specified timezone.
   */
  public getServerTimeString(timeZone: string = 'Indian/Maldives', hour12: boolean = false): string {
    try {
      return this.getServerTime().toLocaleTimeString('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12
      });
    } catch {
      return this.getServerTime().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
    }
  }

  /**
   * Returns whether authoritative time has been synchronized with the main server.
   */
  public isSynchronized(): boolean {
    return this.monotonicBaseServerMs > 0;
  }

  /**
   * Returns the offset in milliseconds between server time and client device clock.
   */
  public getOffsetMs(): number {
    return this.serverOffsetMs;
  }

  /**
   * Subscribe to clock update notifications.
   */
  public subscribe(callback: (date: Date) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const current = this.getServerTime();
    this.listeners.forEach(cb => {
      try { cb(current); } catch {}
    });
  }
}

export const serverTimeService = new ServerTimeService();
