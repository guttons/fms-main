import { FlightLog } from '../types';
import { supabaseService } from './supabaseService';

export interface TicketValidationResult {
  isDuplicate: boolean;
  message?: string;
  matchedLog?: Partial<FlightLog>;
}

export const normalizeTicketDigits = (ticket?: string): string => {
  if (!ticket) return '';
  return ticket.replace(/\D/g, '');
};

export const formatTicketNumber = (digitsOrTicket?: string): string => {
  if (!digitsOrTicket) return '';
  const digits = digitsOrTicket.replace(/\D/g, '');
  return digits ? `MLE-${digits}` : '';
};

/**
 * Validates delivery ticket numbers across all 3 Jet A-1 operations sections:
 * 1. Into-Plane (Commercial & Domestic Flights)
 * 2. Seaplane Operations
 * 3. Marine Loading Operations
 *
 * Checks in-memory context logs, localStorage recent cache, and live BigQuery.
 */
export const checkDuplicateTicketAcrossJetA1 = async (
  ticketInput: string,
  excludeLogId?: string,
  localLogs: FlightLog[] = [],
  existingDeliveryNumber?: string
): Promise<TicketValidationResult> => {
  if (!ticketInput) return { isDuplicate: false };

  const cleanTicket = ticketInput.trim();
  const digits = normalizeTicketDigits(cleanTicket);
  if (!digits || digits.length < 4) {
    return { isDuplicate: false };
  }

  // If the ticket number has not changed from the record's existing ticket, it is valid
  if (existingDeliveryNumber) {
    const existingDigits = normalizeTicketDigits(existingDeliveryNumber);
    if (existingDigits && existingDigits === digits) {
      return { isDuplicate: false };
    }
  }

  const formattedTicket = formatTicketNumber(digits);

  const matchesCandidate = (log?: Partial<FlightLog>): boolean => {
    if (!log || !log.deliveryNumber) return false;
    if (excludeLogId && log.id && log.id === excludeLogId) return false;
    if (existingDeliveryNumber && log.deliveryNumber && log.deliveryNumber === existingDeliveryNumber) return false;

    const logDigits = normalizeTicketDigits(log.deliveryNumber);
    if (logDigits && logDigits === digits) return true;

    const normLog = (log.deliveryNumber || '').replace(/\s+/g, '').toUpperCase();
    const normClean = cleanTicket.replace(/\s+/g, '').toUpperCase();
    return normLog === normClean || normLog === formattedTicket;
  };

  const getSectionName = (log: Partial<FlightLog>): string => {
    const type = (log.logType || '').toUpperCase();
    const fn = (log.flightNumber || '').toUpperCase();
    if (type === 'SEAPLANE' || fn.startsWith('SEAPLANE')) return 'Seaplane';
    if (type === 'MARINE' || fn.startsWith('VESSEL')) return 'Marine Loading';
    return 'Into-Plane';
  };

  // 1. Check local flight logs from context
  if (localLogs && localLogs.length > 0) {
    const match = localLogs.find(matchesCandidate);
    if (match) {
      const section = getSectionName(match);
      return {
        isDuplicate: true,
        matchedLog: match,
        message: `Delivery ticket number ${formattedTicket || cleanTicket} is already used in ${section} (${match.flightNumber || match.deliveryNumber}). Please enter a unique ticket number.`
      };
    }
  }

  // 2. Check localStorage recent cache
  try {
    const rawCache = localStorage.getItem('fms_recent_flight_logs');
    if (rawCache) {
      const parsed: FlightLog[] = JSON.parse(rawCache);
      if (Array.isArray(parsed)) {
        const match = parsed.find(matchesCandidate);
        if (match) {
          const section = getSectionName(match);
          return {
            isDuplicate: true,
            matchedLog: match,
            message: `Delivery ticket number ${formattedTicket || cleanTicket} is already used in ${section} (${match.flightNumber || match.deliveryNumber}). Please enter a unique ticket number.`
          };
        }
      }
    }
  } catch (e) {
    console.warn('[ticketValidation] Failed to check localStorage cache:', e);
  }

  // 3. Live check against BigQuery operations-log (covers Into-Plane, Seaplane, and Marine Loading)
  try {
    const res = await supabaseService.getFlightLogs({ searchTerm: digits, limit: 20 });
    const liveMatch = (res?.logs || []).find(matchesCandidate);
    if (liveMatch) {
      const section = getSectionName(liveMatch);
      return {
        isDuplicate: true,
        matchedLog: liveMatch,
        message: `Delivery ticket number ${formattedTicket || cleanTicket} is already used in ${section} (${liveMatch.flightNumber || liveMatch.deliveryNumber}). Please enter a unique ticket number.`
      };
    }
  } catch (err) {
    console.warn('[ticketValidation] Live BigQuery check failed, fallback to local checks:', err);
  }

  return { isDuplicate: false };
};
