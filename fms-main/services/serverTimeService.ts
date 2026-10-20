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
const MALDIVES_OFFSET_MS = 5 * 3600 * 1000; // Indian/Maldives is permanently UTC+5 (no DST)

export interface MaldivesTimeParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
}

class ServerTimeService {
  private serverOffsetMs: number = 0;
  private monotonicBaseClientMs: number = 0;
  private wallBaseClientMs: number = 0;
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
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[ServerTime] Network reconnected; resynchronizing clock...');
        this.syncTime();
      });
    }

    // Resync immediately when mobile/tablet PWA wakes from sleep or background
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncTime();
        }
      });
    }

    // Periodic synchronization
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.syncTime();
      }
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Performs high-precision clock synchronization with the server.
   */
  public async syncTime(): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;

    const clientStart = Date.now();

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
      if (!serverEpoch) {
        try {
          const { data, error } = await supabase.rpc('get_server_time');
          if (!error && data && data.epochMs) {
            serverEpoch = Number(data.epochMs);
          }
        } catch {
          // Fall through to HTTP Date header fallback
        }
      }

      // 3. Tertiary Fallback: HTTP Date Header from Supabase REST endpoint
      if (!serverEpoch) {
        try {
          const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pzyrstehoesmhwkhtoxd.supabase.co';
          if (anonKey && supabaseUrl) {
            const headStart = Date.now();
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
              // Compensate for 1-second HTTP Date header quantization by adding 500ms midpoint
              serverEpoch = new Date(serverDateHeader).getTime() + 500 + Math.floor((Date.now() - headStart) / 2);
            }
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
        this.wallBaseClientMs = clientEnd;
        this.monotonicBaseServerMs = estimatedServerNow;

        try {
          localStorage.setItem('fms_server_time_offset_ms', this.serverOffsetMs.toString());
        } catch {}

        console.log(
          `[ServerTime] Clock synchronized. RTT: ${rtt}ms, Server Offset: ${this.serverOffsetMs}ms, ` +
          `Server Time: ${new Date(estimatedServerNow).toISOString()} (MVT Date: ${this.getServerDate()})`
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
   * Leverages monotonic performance.now() to prevent client clock tampering,
   * while detecting mobile/tablet sleep drift where performance.now() pauses.
   */
  public getServerEpochMs(): number {
    if (this.monotonicBaseClientMs > 0 && this.monotonicBaseServerMs > 0) {
      const monotonicElapsed = performance.now() - this.monotonicBaseClientMs;
      const wallElapsed = Date.now() - this.wallBaseClientMs;
      // If tablet slept and performance.now() paused relative to wall clock (>5s divergence),
      // use wall clock + serverOffsetMs and trigger an immediate background resync.
      if (Math.abs(wallElapsed - monotonicElapsed) > 5000) {
        if (!this.isSyncing) {
          void this.syncTime();
        }
        return Date.now() + this.serverOffsetMs;
      }
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
   * Returns authoritative server date string (YYYY-MM-DD) in Maldives Standard Time (UTC+5).
   * Fixes the 00:00-04:59 MVT midnight bug where UTC .toISOString() returned yesterday's date.
   */
  public getServerDate(timeZone: string = 'Indian/Maldives'): string {
    if (timeZone === 'Indian/Maldives') {
      const mvtDate = new Date(this.getServerEpochMs() + MALDIVES_OFFSET_MS);
      return mvtDate.toISOString().split('T')[0];
    }
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(this.getServerTime());
    } catch {
      const mvtDate = new Date(this.getServerEpochMs() + MALDIVES_OFFSET_MS);
      return mvtDate.toISOString().split('T')[0];
    }
  }

  /**
   * Returns YYYY-MM-DD in Maldives Standard Time (UTC+5) offset by `daysOffset` days from server time.
   */
  public getRelativeDate(daysOffset: number): string {
    const mvtDate = new Date(this.getServerEpochMs() + MALDIVES_OFFSET_MS + daysOffset * 86400000);
    return mvtDate.toISOString().split('T')[0];
  }

  /**
   * Returns broken-down calendar and clock parts in Maldives Standard Time (UTC+5),
   * completely independent of the client browser's configured OS timezone.
   */
  public getMaldivesParts(epochMs?: number): MaldivesTimeParts {
    const targetEpoch = epochMs !== undefined ? epochMs : this.getServerEpochMs();
    const mvt = new Date(targetEpoch + MALDIVES_OFFSET_MS);
    return {
      year: mvt.getUTCFullYear(),
      month: mvt.getUTCMonth() + 1,
      day: mvt.getUTCDate(),
      hour: mvt.getUTCHours(),
      minute: mvt.getUTCMinutes(),
      second: mvt.getUTCSeconds(),
    };
  }

  /**
   * Converts a Maldives operational date (YYYY-MM-DD) and local time (HH:mm or HH:mm:ss)
   * into an authoritative UTC ISO string, immune to client device timezone settings.
   */
  public toMaldivesIso(dateStr: string, timeStr: string): string {
    const cleanDate = (dateStr || this.getServerDate()).trim().split('T')[0];
    const cleanTime = (timeStr || this.getServerTimeString()).trim();
    const normalizedTime = /^\d{2}:\d{2}$/.test(cleanTime) ? `${cleanTime}:00` : cleanTime;
    const parsed = new Date(`${cleanDate}T${normalizedTime}+05:00`);
    if (isNaN(parsed.getTime())) {
      return this.getServerIso();
    }
    return parsed.toISOString();
  }

  /**
   * Formats authoritative server time to HH:mm (24-hour format) in Maldives (UTC+5) or specified timezone.
   */
  public getServerTimeString(timeZone: string = 'Indian/Maldives', hour12: boolean = false): string {
    if (timeZone === 'Indian/Maldives' && !hour12) {
      const { hour, minute } = this.getMaldivesParts();
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    try {
      return this.getServerTime().toLocaleTimeString('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12
      });
    } catch {
      const { hour, minute } = this.getMaldivesParts();
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
