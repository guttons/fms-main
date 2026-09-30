import { supabase } from '../supabase';
import { TicketCategory, TicketSequenceConfig } from '../types';
import { activityLogService, LogModule, LogAction } from './activityLogService';

const STORAGE_KEY = 'fms_ticket_sequences_cache';

export const DEFAULT_TICKET_SEQUENCES: Record<TicketCategory, TicketSequenceConfig> = {
  JET_A1: {
    category: 'JET_A1',
    isAutoEnabled: false, // Default is strictly OFF / manual mode
    prefix: 'MLE-',
    formatPattern: '{PREFIX}{NUMBER}',
    paddingLength: 6,
    currentNumber: 100000,
    minNumber: 1,
    maxNumber: 999999,
    description: 'Jet A-1 Operations (Into-Plane Flights, Seaplane bulk, Marine Loading)',
    lastGeneratedTicket: undefined,
    lastGeneratedAt: undefined
  },
  MGO: {
    category: 'MGO',
    isAutoEnabled: false, // Default is strictly OFF / manual mode
    prefix: 'MLE-',
    formatPattern: '{PREFIX}D-{NUMBER}', // e.g. MLE-D-500001
    paddingLength: 6,
    currentNumber: 500000,
    minNumber: 1,
    maxNumber: 999999,
    description: 'MGO, Diesel & Petrol Ground Station Invoices (LFS / AFS)',
    lastGeneratedTicket: undefined,
    lastGeneratedAt: undefined
  },
  PAPER_OFFLINE: {
    category: 'PAPER_OFFLINE',
    isAutoEnabled: false, // Default is strictly OFF / manual mode
    prefix: 'MLE-',
    formatPattern: '{PREFIX}P-{NUMBER}', // e.g. MLE-P-100001
    paddingLength: 6,
    currentNumber: 100000,
    minNumber: 1,
    maxNumber: 999999,
    description: 'Offline Paper Ticket Entry Automated Tracking Sequence',
    lastGeneratedTicket: undefined,
    lastGeneratedAt: undefined
  }
};

const isMissingTableError = (error: any): boolean => {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST200' ||
    error.status === 404 ||
    (error as any).statusCode === 404 ||
    (typeof error.message === 'string' && (
      error.message.includes('does not exist') ||
      error.message.includes('schema cache') ||
      error.message.includes('Not Found') ||
      error.message.includes('not found')
    ))
  );
};

type SequenceListener = (sequences: Record<TicketCategory, TicketSequenceConfig>) => void;

class TicketGeneratorService {
  private inMemoryCache: Record<TicketCategory, TicketSequenceConfig> = { ...DEFAULT_TICKET_SEQUENCES };
  private listeners: Set<SequenceListener> = new Set();
  private isLoaded = false;
  private isDbTableAvailable = true;

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.inMemoryCache = {
          JET_A1: { ...DEFAULT_TICKET_SEQUENCES.JET_A1, ...(parsed.JET_A1 || {}) },
          MGO: { ...DEFAULT_TICKET_SEQUENCES.MGO, ...(parsed.MGO || {}) },
          PAPER_OFFLINE: { ...DEFAULT_TICKET_SEQUENCES.PAPER_OFFLINE, ...(parsed.PAPER_OFFLINE || {}) },
        };
      }
    } catch (e) {
      console.warn('[TicketGenerator] Failed to load cached sequence config from localStorage', e);
    }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryCache));
    } catch (e) {
      console.warn('[TicketGenerator] Failed to save sequence config to localStorage', e);
    }
  }

  private notifyListeners(): void {
    const copy = { ...this.inMemoryCache };
    this.listeners.forEach(cb => {
      try {
        cb(copy);
      } catch (err) {
        console.error('[TicketGenerator] Error in listener callback:', err);
      }
    });
  }

  public subscribe(callback: SequenceListener): () => void {
    this.listeners.add(callback);
    callback({ ...this.inMemoryCache });
    return () => {
      this.listeners.delete(callback);
    };
  }

  public formatTicket(pattern: string, prefix: string, number: number, padding: number): string {
    const formattedNum = String(number).padStart(padding, '0');
    return pattern
      .replace('{PREFIX}', prefix || 'MLE-')
      .replace('{NUMBER}', formattedNum);
  }

  public async getSequences(forceRefresh = false): Promise<Record<TicketCategory, TicketSequenceConfig>> {
    if (this.isLoaded && !forceRefresh) {
      return { ...this.inMemoryCache };
    }

    if (forceRefresh) {
      this.isDbTableAvailable = true;
    }

    try {
      // 1. Try fetching from public.ticket_sequences table
      if (this.isDbTableAvailable) {
        const { data, error } = await supabase
          .from('ticket_sequences')
          .select('*');

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach((row: any) => {
            const cat = row.category as TicketCategory;
            if (this.inMemoryCache[cat]) {
              this.inMemoryCache[cat] = {
                category: cat,
                isAutoEnabled: !!row.is_auto_enabled,
                prefix: row.prefix ?? 'MLE-',
                formatPattern: row.format_pattern ?? DEFAULT_TICKET_SEQUENCES[cat].formatPattern,
                paddingLength: row.padding_length ?? 6,
                currentNumber: Number(row.current_number) || DEFAULT_TICKET_SEQUENCES[cat].currentNumber,
                minNumber: Number(row.min_number) || 1,
                maxNumber: Number(row.max_number) || 999999,
                description: row.description ?? DEFAULT_TICKET_SEQUENCES[cat].description,
                lastGeneratedTicket: row.last_generated_ticket,
                lastGeneratedAt: row.last_generated_at,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by
              };
            }
          });
          this.isLoaded = true;
          this.saveToLocalStorage();
          this.notifyListeners();
          return { ...this.inMemoryCache };
        } else if (error && isMissingTableError(error)) {
          // Table doesn't exist yet, flag and fallback to app_settings
          this.isDbTableAvailable = false;
        }
      }

      // 2. Fallback: app_settings table
      const { data: settingData, error: settingError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'ticket_sequences')
        .maybeSingle();

      if (!settingError && settingData?.value) {
        const remote = settingData.value;
        (['JET_A1', 'MGO', 'PAPER_OFFLINE'] as TicketCategory[]).forEach(cat => {
          if (remote[cat]) {
            this.inMemoryCache[cat] = {
              ...DEFAULT_TICKET_SEQUENCES[cat],
              ...remote[cat]
            };
          }
        });
      }
    } catch (err) {
      console.warn('[TicketGenerator] Remote fetch failed, using local/cached state:', err);
    }

    this.isLoaded = true;
    this.saveToLocalStorage();
    this.notifyListeners();
    return { ...this.inMemoryCache };
  }

  public previewNextTicket(category: TicketCategory): string {
    const config = this.inMemoryCache[category] || DEFAULT_TICKET_SEQUENCES[category];
    const nextNum = config.currentNumber + 1;
    return this.formatTicket(config.formatPattern, config.prefix, nextNum, config.paddingLength);
  }

  public isAutoEnabled(category: TicketCategory): boolean {
    return !!(this.inMemoryCache[category]?.isAutoEnabled);
  }

  public async updateSequence(
    category: TicketCategory,
    updates: Partial<TicketSequenceConfig>,
    currentUser?: any
  ): Promise<TicketSequenceConfig> {
    const current = this.inMemoryCache[category] || DEFAULT_TICKET_SEQUENCES[category];
    const updated: TicketSequenceConfig = {
      ...current,
      ...updates,
      category,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.employeeId || 'System Admin'
    };

    const beforeState = { ...current };
    this.inMemoryCache[category] = updated;
    this.saveToLocalStorage();
    this.notifyListeners();

    // Persist to database
    try {
      if (this.isDbTableAvailable) {
        const { error } = await supabase
          .from('ticket_sequences')
          .upsert({
            category: updated.category,
            is_auto_enabled: updated.isAutoEnabled,
            prefix: updated.prefix,
            format_pattern: updated.formatPattern,
            padding_length: updated.paddingLength,
            current_number: updated.currentNumber,
            min_number: updated.minNumber,
            max_number: updated.maxNumber,
            description: updated.description,
            updated_at: updated.updatedAt,
            updated_by: updated.updatedBy
          });

        if (error) {
          if (isMissingTableError(error)) {
            this.isDbTableAvailable = false;
          } else {
            console.error('[TicketGenerator] Error upserting to ticket_sequences:', error);
          }
        }
      }

      // Mirror to app_settings as persistent backup
      await supabase
        .from('app_settings')
        .upsert({
          key: 'ticket_sequences',
          value: this.inMemoryCache,
          updated_at: new Date().toISOString()
        });

      // Audit log
      if (currentUser) {
        activityLogService.logAction(currentUser, {
          module: LogModule.SYSTEM_SETTINGS,
          action: LogAction.UPDATE,
          entity_type: 'ticket_sequences',
          entity_id: category,
          entity_label: `${category} Numbering Configuration`,
          description: `Admin updated ticket sequence for ${category}: autoEnabled=${updated.isAutoEnabled}, prefix=${updated.prefix}, pattern=${updated.formatPattern}, currentNumber=${updated.currentNumber}`,
          before_state: beforeState,
          after_state: updated
        });
      }
    } catch (err) {
      console.error('[TicketGenerator] Persistence error:', err);
    }

    return updated;
  }

  public async generateNextTicket(
    category: TicketCategory,
    operatorId = 'Operator',
    forceAuto = false
  ): Promise<{ success: boolean; ticketNumber?: string; isAutoEnabled: boolean; message?: string }> {
    const config = this.inMemoryCache[category] || DEFAULT_TICKET_SEQUENCES[category];

    // If auto-generation is disabled and not forced, return manual mode
    if (!config.isAutoEnabled && !forceAuto) {
      return {
        success: false,
        isAutoEnabled: false,
        message: 'Auto-generation is disabled. Manual ticket entry is active.'
      };
    }

    // Try calling the atomic database RPC
    try {
      const { data, error } = await supabase.rpc('generate_next_ticket_number', {
        p_category: category,
        p_operator_id: operatorId,
        p_force_auto: forceAuto
      });

      if (!error && data && data.success) {
        // Update local cache with newly returned number
        this.inMemoryCache[category].currentNumber = Number(data.sequence_number);
        this.inMemoryCache[category].lastGeneratedTicket = data.ticket_number;
        this.inMemoryCache[category].lastGeneratedAt = new Date().toISOString();
        this.saveToLocalStorage();
        this.notifyListeners();

        return {
          success: true,
          ticketNumber: data.ticket_number,
          isAutoEnabled: true
        };
      }
    } catch (rpcErr) {
      console.warn('[TicketGenerator] Atomic RPC unavailable, proceeding with optimistic sequence generation:', rpcErr);
    }

    // Client-side / Offline fallback generation
    const nextNum = config.currentNumber + 1;
    const ticket = this.formatTicket(config.formatPattern, config.prefix, nextNum, config.paddingLength);

    config.currentNumber = nextNum;
    config.lastGeneratedTicket = ticket;
    config.lastGeneratedAt = new Date().toISOString();
    config.updatedBy = operatorId;

    this.inMemoryCache[category] = config;
    this.saveToLocalStorage();
    this.notifyListeners();

    // Async sync update to DB
    this.updateSequence(category, { currentNumber: nextNum, lastGeneratedTicket: ticket }, { name: operatorId }).catch(console.error);

    return {
      success: true,
      ticketNumber: ticket,
      isAutoEnabled: true
    };
  }

  public detectMaxExistingTicket(
    category: TicketCategory,
    logs: any[] = []
  ): number {
    let maxNum = 0;
    const regexMap: Record<TicketCategory, RegExp> = {
      JET_A1: /MLE-?(\d+)/i,
      MGO: /MLE-?D?-?(\d+)/i,
      PAPER_OFFLINE: /MLE-?P?-?(\d+)/i
    };

    const targetRegex = regexMap[category] || /\d+/;

    (logs || []).forEach(log => {
      const t = log?.deliveryNumber || log?.invoiceNumber;
      if (!t || typeof t !== 'string') return;

      const upper = t.toUpperCase();
      if (category === 'PAPER_OFFLINE' && !upper.includes('P')) return;
      if (category === 'MGO' && (!upper.includes('D') && log?.station !== 'LFS' && log?.station !== 'AFS')) return;

      const match = upper.match(targetRegex);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNum && val < 9999999) {
          maxNum = val;
        }
      }
    });

    return maxNum;
  }
}

export const ticketGeneratorService = new TicketGeneratorService();
