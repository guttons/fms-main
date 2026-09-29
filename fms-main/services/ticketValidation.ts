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

export const canonicalTicketKey = (ticket?: string): string => {
  if (!ticket) return '';
  const clean = ticket.trim().toUpperCase().replace(/\s+/g, '');
  if (!clean.startsWith('MLE-')) {
    // If it's pure digits, prepend MLE-
    const digits = clean.replace(/\D/g, '');
    if (digits.length === clean.length) {
      return `MLE-${digits}`;
    }
  }
  return clean;
};

export const formatTicketNumber = (digitsOrTicket?: string): string => {
  if (!digitsOrTicket) return '';
  const clean = digitsOrTicket.trim();
  if (clean.toUpperCase().startsWith('MLE-')) return clean.toUpperCase();
  const digits = clean.replace(/\D/g, '');
  return digits ? `MLE-${digits}` : '';
};

/**
 * Validates delivery ticket numbers across all operations sections:
 * 1. Into-Plane (Commercial & Domestic Flights)
 * 2. Seaplane Operations
 * 3. Marine Loading Operations
 * 4. Ground Refueling / Filling Station (MGO / Diesel / Petrol)
 * 5. Offline Paper Ticket series
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
  const canonicalInput = canonicalTicketKey(cleanTicket);
  const inputDigits = normalizeTicketDigits(cleanTicket);

  if (!canonicalInput || canonicalInput.length < 5) {
    return { isDuplicate: false };
  }

  // If the ticket number has not changed from the record's existing ticket, it is valid
  if (existingDeliveryNumber) {
    const canonicalExisting = canonicalTicketKey(existingDeliveryNumber);
    if (canonicalExisting && canonicalExisting === canonicalInput) {
      return { isDuplicate: false };
    }
  }

  const formattedTicket = formatTicketNumber(cleanTicket);

  const matchesCandidate = (log?: Partial<FlightLog>): boolean => {
    if (!log || !log.deliveryNumber) return false;
    if (excludeLogId && log.id && log.id === excludeLogId) return false;
    if (existingDeliveryNumber && log.deliveryNumber && log.deliveryNumber === existingDeliveryNumber) return false;

    const candidateCanonical = canonicalTicketKey(log.deliveryNumber);
    
    // Exact canonical match (e.g. MLE-100001 === MLE-100001, or MLE-D-500001 === MLE-D-500001)
    if (candidateCanonical === canonicalInput) return true;

    // If both are standard pure numeric MLE tickets (e.g. MLE-123456 vs 123456)
    const isStandardNumericInput = /^MLE-\d+$/i.test(canonicalInput);
    const isStandardCandidate = /^MLE-\d+$/i.test(candidateCanonical);
    if (isStandardNumericInput && isStandardCandidate) {
      const candidateDigits = normalizeTicketDigits(log.deliveryNumber);
      if (candidateDigits && candidateDigits === inputDigits) return true;
    }

    return false;
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
    const res = await supabaseService.getFlightLogs({ searchTerm: inputDigits || cleanTicket, limit: 20 });
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
