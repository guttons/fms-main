/**
 * aiDataEngine.ts — BigQuery Data Query Engine for AI Assistant
 * 
 * Bridges AI intents → BigQuery API calls → structured aggregation results.
 * Provides statistical aggregation with confidence scoring based on sample size.
 */

import { supabaseService } from './supabaseService';
import { FlightLog, BridgingLog } from '../types';
import { ParsedDateRange } from './dateParser';

// ── Types ──────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface AggregationResult {
  metric: string;
  value: number;
  unit: string;
  sampleSize: number;
  dateRange: { start: string; end: string; label: string };
  breakdown?: { label: string; value: number }[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  trendPct?: number;       // Percentage change vs previous period (positive = up)
  trendLabel?: string;     // e.g. "↑ 12% vs previous period"
}

export interface FlightUpliftStats {
  flightNumber: string;
  avgVolume: number;
  medianVolume: number;
  minVolume: number;
  maxVolume: number;
  totalVolume: number;
  stdDeviation: number;
  sampleSize: number;
  confidence: ConfidenceLevel;
  confidenceNote: string;
  recentLogs: { date: string; volume: number; vehicle: string }[];
  aircraftTypes: string[];
  routes: string[];
  operators: string[];
  dateRange: { start: string; end: string; label: string };
  trendPct?: number;
  trendLabel?: string;
}

export interface DailyConsumptionResult {
  totalVolume: number;
  totalMass: number;
  flightCount: number;
  dailyAvg: number;
  dayCount: number;
  byDay: { date: string; volume: number; count: number }[];
  topFlights: { flightNumber: string; totalVolume: number; count: number }[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  dateRange: { start: string; end: string; label: string };
}

export interface BridgingStats {
  totalVolume: number;
  loadCount: number;
  avgVolume: number;
  byVehicle: { vehicleId: string; totalVolume: number; count: number }[];
  byTank: { tankId: string; totalVolume: number; count: number }[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  dateRange: { start: string; end: string; label: string };
}

export interface AirlineUpliftStats {
  airlineName: string;
  airlineCode: string;
  totalVolume: number;
  totalMass: number;
  flightCount: number;
  distinctFlights: {
    flightNumber: string;
    totalVolume: number;
    avgVolume: number;
    minVolume: number;
    maxVolume: number;
    count: number;
    aircraftTypes: string[];
    routes: string[];
  }[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  dateRange: { start: string; end: string; label: string };
}

export const AIRLINE_MAP: Record<string, { code: string; name: string; prefix: string }> = {
  'emirates': { code: 'EK', name: 'Emirates', prefix: 'EK' },
  'ek': { code: 'EK', name: 'Emirates', prefix: 'EK' },
  'aeroflot': { code: 'SU', name: 'Aeroflot', prefix: 'SU' },
  'su': { code: 'SU', name: 'Aeroflot', prefix: 'SU' },
  'singapore': { code: 'SQ', name: 'Singapore Airlines', prefix: 'SQ' },
  'singapore airlines': { code: 'SQ', name: 'Singapore Airlines', prefix: 'SQ' },
  'sq': { code: 'SQ', name: 'Singapore Airlines', prefix: 'SQ' },
  'qatar': { code: 'QR', name: 'Qatar Airways', prefix: 'QR' },
  'qatar airways': { code: 'QR', name: 'Qatar Airways', prefix: 'QR' },
  'qr': { code: 'QR', name: 'Qatar Airways', prefix: 'QR' },
  'srilankan': { code: 'UL', name: 'SriLankan Airlines', prefix: 'UL' },
  'sri lankan': { code: 'UL', name: 'SriLankan Airlines', prefix: 'UL' },
  'ul': { code: 'UL', name: 'SriLankan Airlines', prefix: 'UL' },
  'british airways': { code: 'BA', name: 'British Airways', prefix: 'BA' },
  'british': { code: 'BA', name: 'British Airways', prefix: 'BA' },
  'ba': { code: 'BA', name: 'British Airways', prefix: 'BA' },
  'maldivian': { code: 'Q2', name: 'Maldivian (IAS)', prefix: 'Q2' },
  'island aviation': { code: 'Q2', name: 'Maldivian (IAS)', prefix: 'Q2' },
  'ias': { code: 'Q2', name: 'Maldivian (IAS)', prefix: 'Q2' },
  'q2': { code: 'Q2', name: 'Maldivian (IAS)', prefix: 'Q2' },
  'flydubai': { code: 'FZ', name: 'Flydubai', prefix: 'FZ' },
  'fz': { code: 'FZ', name: 'Flydubai', prefix: 'FZ' },
  'etihad': { code: 'EY', name: 'Etihad Airways', prefix: 'EY' },
  'ey': { code: 'EY', name: 'Etihad Airways', prefix: 'EY' },
  'indigo': { code: '6E', name: 'IndiGo', prefix: '6E' },
  '6e': { code: '6E', name: 'IndiGo', prefix: '6E' },
  'turkish': { code: 'TK', name: 'Turkish Airlines', prefix: 'TK' },
  'tk': { code: 'TK', name: 'Turkish Airlines', prefix: 'TK' },
  'malaysia': { code: 'MH', name: 'Malaysia Airlines', prefix: 'MH' },
  'mh': { code: 'MH', name: 'Malaysia Airlines', prefix: 'MH' },
  'airasia': { code: 'AK', name: 'AirAsia', prefix: 'AK' },
  'ak': { code: 'AK', name: 'AirAsia', prefix: 'AK' },
  'gulf air': { code: 'GF', name: 'Gulf Air', prefix: 'GF' },
  'gf': { code: 'GF', name: 'Gulf Air', prefix: 'GF' },
  'oman air': { code: 'WY', name: 'Oman Air', prefix: 'WY' },
  'wy': { code: 'WY', name: 'Oman Air', prefix: 'WY' },
  'edelweiss': { code: 'WK', name: 'Edelweiss Air', prefix: 'WK' },
  'wk': { code: 'WK', name: 'Edelweiss Air', prefix: 'WK' },
  'condor': { code: 'DE', name: 'Condor', prefix: 'DE' },
  'de': { code: 'DE', name: 'Condor', prefix: 'DE' },
  'neos': { code: 'NO', name: 'Neos', prefix: 'NO' },
  'no': { code: 'NO', name: 'Neos', prefix: 'NO' },
  'air france': { code: 'AF', name: 'Air France', prefix: 'AF' },
  'af': { code: 'AF', name: 'Air France', prefix: 'AF' },
  'air india': { code: 'AI', name: 'Air India', prefix: 'AI' },
  'ai': { code: 'AI', name: 'Air India', prefix: 'AI' },
};

export const AIRLINE_FLIGHTS_REGISTRY: Record<string, { flightNumber: string; aircraft: string; route: string; defaultAvgLiters: number }[]> = {
  'SU': [
    { flightNumber: 'SU321', aircraft: 'Boeing 777-300ER / Airbus A350-900', route: 'MLE ➔ SVO (Moscow Sheremetyevo)', defaultAvgLiters: 44500 },
    { flightNumber: 'SU320', aircraft: 'Airbus A350-900 / Boeing 777-300ER', route: 'SVO ➔ MLE (Moscow Sheremetyevo)', defaultAvgLiters: 43800 },
    { flightNumber: 'SU322', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ SVO (Moscow Sheremetyevo)', defaultAvgLiters: 44200 },
    { flightNumber: 'SU323', aircraft: 'Boeing 777-300ER', route: 'SVO ➔ MLE (Moscow Sheremetyevo)', defaultAvgLiters: 44000 },
    { flightNumber: 'SU324', aircraft: 'Airbus A350-900', route: 'MLE ➔ SVO (Moscow Sheremetyevo)', defaultAvgLiters: 43900 },
    { flightNumber: 'SU325', aircraft: 'Airbus A350-900', route: 'SVO ➔ MLE (Moscow Sheremetyevo)', defaultAvgLiters: 43700 },
    { flightNumber: 'SU520', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ LED (St. Petersburg)', defaultAvgLiters: 45200 },
    { flightNumber: 'SU521', aircraft: 'Boeing 777-300ER', route: 'LED ➔ MLE (St. Petersburg)', defaultAvgLiters: 44800 },
  ],
  'EK': [
    { flightNumber: 'EK650', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ DXB (Dubai Intl)', defaultAvgLiters: 38200 },
    { flightNumber: 'EK651', aircraft: 'Boeing 777-300ER', route: 'DXB ➔ MLE (Dubai Intl)', defaultAvgLiters: 37800 },
    { flightNumber: 'EK652', aircraft: 'Boeing 777-300ER / Airbus A380', route: 'MLE ➔ DXB (Dubai Intl)', defaultAvgLiters: 38900 },
    { flightNumber: 'EK653', aircraft: 'Boeing 777-300ER', route: 'DXB ➔ MLE (Dubai Intl)', defaultAvgLiters: 38100 },
    { flightNumber: 'EK658', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ CMB ➔ DXB', defaultAvgLiters: 24500 },
    { flightNumber: 'EK659', aircraft: 'Boeing 777-300ER', route: 'DXB ➔ CMB ➔ MLE', defaultAvgLiters: 24200 },
  ],
  'SQ': [
    { flightNumber: 'SQ437', aircraft: 'Airbus A350-900', route: 'MLE ➔ SIN (Singapore Changi)', defaultAvgLiters: 32500 },
    { flightNumber: 'SQ438', aircraft: 'Airbus A350-900', route: 'SIN ➔ MLE (Singapore Changi)', defaultAvgLiters: 32200 },
    { flightNumber: 'SQ451', aircraft: 'Airbus A350-900', route: 'MLE ➔ SIN (Singapore Changi)', defaultAvgLiters: 32800 },
    { flightNumber: 'SQ452', aircraft: 'Airbus A350-900', route: 'SIN ➔ MLE (Singapore Changi)', defaultAvgLiters: 32400 },
  ],
  'QR': [
    { flightNumber: 'QR670', aircraft: 'Boeing 777-300ER', route: 'DOH ➔ MLE (Doha Hamad)', defaultAvgLiters: 34100 },
    { flightNumber: 'QR671', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ DOH (Doha Hamad)', defaultAvgLiters: 34600 },
    { flightNumber: 'QR674', aircraft: 'Airbus A350-900', route: 'DOH ➔ MLE (Doha Hamad)', defaultAvgLiters: 34200 },
    { flightNumber: 'QR675', aircraft: 'Airbus A350-900', route: 'MLE ➔ DOH (Doha Hamad)', defaultAvgLiters: 34500 },
    { flightNumber: 'QR676', aircraft: 'Airbus A350-1000', route: 'DOH ➔ MLE (Doha Hamad)', defaultAvgLiters: 35100 },
    { flightNumber: 'QR677', aircraft: 'Airbus A350-1000', route: 'MLE ➔ DOH (Doha Hamad)', defaultAvgLiters: 35400 },
  ],
  'UL': [
    { flightNumber: 'UL101', aircraft: 'Airbus A320neo / A330-300', route: 'CMB ➔ MLE (Colombo)', defaultAvgLiters: 14100 },
    { flightNumber: 'UL102', aircraft: 'Airbus A320neo / A330-300', route: 'MLE ➔ CMB (Colombo)', defaultAvgLiters: 14500 },
    { flightNumber: 'UL103', aircraft: 'Airbus A330-300', route: 'CMB ➔ MLE (Colombo)', defaultAvgLiters: 16200 },
    { flightNumber: 'UL104', aircraft: 'Airbus A330-300', route: 'MLE ➔ CMB (Colombo)', defaultAvgLiters: 16800 },
  ],
  'BA': [
    { flightNumber: 'BA060', aircraft: 'Boeing 777-200ER / 787-9', route: 'LHR ➔ MLE (London Heathrow)', defaultAvgLiters: 51200 },
    { flightNumber: 'BA061', aircraft: 'Boeing 777-200ER / 787-9', route: 'MLE ➔ LHR (London Heathrow)', defaultAvgLiters: 52000 },
  ],
  'Q2': [
    { flightNumber: 'Q2100', aircraft: 'ATR 72-600 / Dash 8-300', route: 'MLE ➔ GAN (Gan Intl)', defaultAvgLiters: 3200 },
    { flightNumber: 'Q2102', aircraft: 'ATR 72-600', route: 'MLE ➔ DRV (Dharavandhoo)', defaultAvgLiters: 1800 },
    { flightNumber: 'Q2700', aircraft: 'Airbus A321-200', route: 'MLE ➔ MAA (Chennai)', defaultAvgLiters: 12500 },
    { flightNumber: 'Q2702', aircraft: 'Airbus A320-200', route: 'MLE ➔ TRV (Trivandrum)', defaultAvgLiters: 11800 },
    { flightNumber: 'Q2706', aircraft: 'Airbus A320-200', route: 'MLE ➔ BKK (Bangkok)', defaultAvgLiters: 24500 },
  ],
  'FZ': [
    { flightNumber: 'FZ1569', aircraft: 'Boeing 737 MAX 8', route: 'DXB ➔ MLE (Dubai)', defaultAvgLiters: 21500 },
    { flightNumber: 'FZ1570', aircraft: 'Boeing 737 MAX 8', route: 'MLE ➔ DXB (Dubai)', defaultAvgLiters: 21800 },
  ],
  'EY': [
    { flightNumber: 'EY278', aircraft: 'Boeing 787-9 Dreamliner', route: 'AUH ➔ MLE (Abu Dhabi)', defaultAvgLiters: 31200 },
    { flightNumber: 'EY279', aircraft: 'Boeing 787-9 Dreamliner', route: 'MLE ➔ AUH (Abu Dhabi)', defaultAvgLiters: 31600 },
  ],
  '6E': [
    { flightNumber: '6E1127', aircraft: 'Airbus A320neo', route: 'BOM ➔ MLE (Mumbai)', defaultAvgLiters: 13800 },
    { flightNumber: '6E1128', aircraft: 'Airbus A320neo', route: 'MLE ➔ BOM (Mumbai)', defaultAvgLiters: 14200 },
    { flightNumber: '6E1131', aircraft: 'Airbus A321neo', route: 'DEL ➔ MLE (Delhi)', defaultAvgLiters: 17500 },
    { flightNumber: '6E1132', aircraft: 'Airbus A321neo', route: 'MLE ➔ DEL (Delhi)', defaultAvgLiters: 17900 },
  ],
  'TK': [
    { flightNumber: 'TK730', aircraft: 'Airbus A330-300 / A350-900', route: 'IST ➔ MLE (Istanbul)', defaultAvgLiters: 48500 },
    { flightNumber: 'TK731', aircraft: 'Airbus A330-300 / A350-900', route: 'MLE ➔ IST (Istanbul)', defaultAvgLiters: 49200 },
  ]
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getConfidence(sampleSize: number): { level: ConfidenceLevel; note: string } {
  if (sampleSize >= 20) return { level: 'high', note: `High confidence (${sampleSize} records)` };
  if (sampleSize >= 5) return { level: 'medium', note: `Medium confidence (${sampleSize} records — limited dataset)` };
  if (sampleSize >= 1) return { level: 'low', note: `Low confidence (${sampleSize} records — very limited data, interpret with caution)` };
  return { level: 'none', note: 'No matching records found in the specified date range.' };
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.round(Math.sqrt(avgSquaredDiff));
}

function getLogVolume(log: FlightLog): number {
  if (log.volume && log.volume > 0) return log.volume;
  if (log.meterOpen !== undefined && log.meterClose !== undefined && log.meterClose > log.meterOpen) {
    return log.meterClose - log.meterOpen;
  }
  return 0;
}

function getLogDate(log: FlightLog): string {
  if (log.operationalDate) return log.operationalDate;
  if (log.timestampClearance) return log.timestampClearance.split('T')[0];
  if (log.timestampStart) return log.timestampStart.split('T')[0];
  if (log.created_at) return log.created_at.split('T')[0];
  return '';
}

/**
 * Compute previous period date range for trend comparison.
 * e.g. if range is Jul 1-15 (15 days), previous period is Jun 16-30.
 */
function getPreviousPeriod(range: ParsedDateRange): { startDate: string; endDate: string } {
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const durationMs = end.getTime() - start.getTime() + 86400000; // inclusive
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 86400000);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
}

// ── Data Engine ─────────────────────────────────────────────────────────────

export const aiDataEngine = {

  /**
   * Fetch flight logs from BigQuery with date range and optional filters.
   */
  async queryFlightLogs(dateRange: ParsedDateRange, filters?: {
    flightNumber?: string;
    vehicleId?: string;
    operatorId?: string;
    logType?: string;
    airlinePrefix?: string;
    airlineName?: string;
  }): Promise<FlightLog[]> {
    try {
      const searchTerm = filters?.flightNumber || filters?.airlinePrefix || filters?.airlineName || filters?.vehicleId || undefined;
      const result = await supabaseService.getFlightLogs({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        searchTerm,
        logType: filters?.logType,
        equipmentId: filters?.vehicleId,
        limit: 500, // Reasonable cap for AI analysis
      });
      
      let logs = result.logs;

      // Apply additional client-side filters if needed
      if (filters?.flightNumber) {
        const code = filters.flightNumber.toUpperCase().replace(/\s+/g, '');
        logs = logs.filter(l => {
          const logCode = l.flightNumber.toUpperCase().replace(/\s+/g, '');
          return logCode === code || logCode.includes(code);
        });
      }

      if (filters?.airlinePrefix || filters?.airlineName) {
        const prefix = (filters.airlinePrefix || '').toUpperCase().trim();
        const name = (filters.airlineName || '').toLowerCase().trim();
        logs = logs.filter(l => {
          const fn = l.flightNumber.toUpperCase().replace(/\s+/g, '');
          const al = (l.airline || '').toLowerCase();
          const matchesPrefix = prefix ? fn.startsWith(prefix) : false;
          const matchesName = name ? al.includes(name) || fn.toLowerCase().includes(name) : false;
          return matchesPrefix || matchesName;
        });
      }

      if (filters?.operatorId) {
        const opId = filters.operatorId.toLowerCase();
        logs = logs.filter(l => 
          (l.operatorId || '').toLowerCase().includes(opId) ||
          (l.operatorName || '').toLowerCase().includes(opId)
        );
      }

      // Filter out zero-volume records
      return logs.filter(l => getLogVolume(l) > 0);
    } catch (error) {
      console.warn('[AI Data Engine] queryFlightLogs failed:', error);
      return [];
    }
  },

  /**
   * Compute aggregated statistics for all flight numbers belonging to an airline.
   */
  async aggregateByAirline(airlineTerm: string, dateRange: ParsedDateRange): Promise<AirlineUpliftStats> {
    const term = airlineTerm.toLowerCase().trim();
    const info = AIRLINE_MAP[term] || { code: term.toUpperCase().slice(0, 2), name: airlineTerm, prefix: term.toUpperCase().slice(0, 2) };

    const logs = await this.queryFlightLogs(dateRange, { airlinePrefix: info.prefix, airlineName: info.name });
    const { level, note } = getConfidence(logs.length);

    const totalVolume = logs.reduce((acc, l) => acc + getLogVolume(l), 0);

    // Group logs by distinct flight number
    const byFlightMap: Record<string, {
      volumes: number[];
      aircraftTypes: Set<string>;
      routes: Set<string>;
    }> = {};

    logs.forEach(l => {
      const fn = l.flightNumber.toUpperCase().replace(/\s+/g, '');
      if (!byFlightMap[fn]) {
        byFlightMap[fn] = { volumes: [], aircraftTypes: new Set(), routes: new Set() };
      }
      const vol = getLogVolume(l);
      if (vol > 0) byFlightMap[fn].volumes.push(vol);
      if (l.aircraftType) byFlightMap[fn].aircraftTypes.add(l.aircraftType);
      if (l.route || l.destination) byFlightMap[fn].routes.add(l.route || l.destination || '');
    });

    const distinctFlights = Object.entries(byFlightMap)
      .map(([flightNumber, d]) => {
        const sorted = d.volumes.sort((a, b) => a - b);
        const flightTotal = sorted.reduce((a, b) => a + b, 0);
        return {
          flightNumber,
          totalVolume: Math.round(flightTotal),
          avgVolume: sorted.length > 0 ? Math.round(flightTotal / sorted.length) : 0,
          minVolume: sorted.length > 0 ? sorted[0] : 0,
          maxVolume: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
          count: sorted.length,
          aircraftTypes: Array.from(d.aircraftTypes),
          routes: Array.from(d.routes),
        };
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);

    return {
      airlineName: info.name,
      airlineCode: info.code,
      totalVolume: Math.round(totalVolume),
      totalMass: Math.round(totalVolume * 0.80),
      flightCount: logs.length,
      distinctFlights,
      confidence: level,
      confidenceNote: note,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
    };
  },

  /**
   * Fetch bridging logs from BigQuery with date range.
   */
  async queryBridgingLogs(dateRange: ParsedDateRange, filters?: {
    vehicleId?: string;
    tankId?: string;
  }): Promise<BridgingLog[]> {
    try {
      const result = await supabaseService.getBridgingLogs({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        searchTerm: filters?.vehicleId || filters?.tankId || undefined,
        limit: 500,
      });

      let logs = result.logs;

      if (filters?.vehicleId) {
        const vid = filters.vehicleId.toUpperCase();
        logs = logs.filter(l => l.vehicleId.toUpperCase().includes(vid));
      }
      if (filters?.tankId) {
        const tid = filters.tankId.toUpperCase();
        logs = logs.filter(l => l.sourceTankId.toUpperCase().includes(tid));
      }

      return logs.filter(l => l.volume > 0);
    } catch (error) {
      console.warn('[AI Data Engine] queryBridgingLogs failed:', error);
      return [];
    }
  },

  /**
   * Compute uplift statistics for a specific flight number.
   */
  async aggregateUpliftByFlight(flightNumber: string, dateRange: ParsedDateRange): Promise<FlightUpliftStats> {
    const logs = await this.queryFlightLogs(dateRange, { flightNumber });
    const volumes = logs.map(l => getLogVolume(l)).sort((a, b) => a - b);
    const { level, note } = getConfidence(volumes.length);

    const total = volumes.reduce((a, b) => a + b, 0);
    const avg = volumes.length > 0 ? Math.round(total / volumes.length) : 0;
    const median = computeMedian(volumes);
    const stdDev = computeStdDev(volumes, avg);

    // Get recent logs for display (last 5)
    const recentLogs = logs
      .sort((a, b) => (getLogDate(b) || '').localeCompare(getLogDate(a) || ''))
      .slice(0, 5)
      .map(l => ({
        date: getLogDate(l),
        volume: getLogVolume(l),
        vehicle: l.vehicleId || 'N/A',
      }));

    // Unique aircraft types, routes, operators
    const aircraftTypes = Array.from(new Set(logs.map(l => l.aircraftType).filter(Boolean))) as string[];
    const routes = Array.from(new Set(logs.map(l => l.route || l.destination).filter(Boolean))) as string[];
    const operators = Array.from(new Set(logs.map(l => l.operatorName || l.operatorId).filter(Boolean))) as string[];

    // Compute trend vs previous period
    let trendPct: number | undefined;
    let trendLabel: string | undefined;
    if (volumes.length >= 3) {
      try {
        const prevPeriod = getPreviousPeriod(dateRange);
        const prevLogs = await this.queryFlightLogs(
          { startDate: prevPeriod.startDate, endDate: prevPeriod.endDate, label: 'Previous Period' },
          { flightNumber }
        );
        const prevVolumes = prevLogs.map(l => getLogVolume(l));
        if (prevVolumes.length >= 2) {
          const prevAvg = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
          if (prevAvg > 0) {
            trendPct = Math.round(((avg - prevAvg) / prevAvg) * 1000) / 10;
            const arrow = trendPct >= 0 ? '↑' : '↓';
            trendLabel = `${arrow} ${Math.abs(trendPct)}% vs previous period (${prevVolumes.length} flights)`;
          }
        }
      } catch {
        // Trend computation is optional
      }
    }

    return {
      flightNumber: flightNumber.toUpperCase(),
      avgVolume: avg,
      medianVolume: median,
      minVolume: volumes.length > 0 ? volumes[0] : 0,
      maxVolume: volumes.length > 0 ? volumes[volumes.length - 1] : 0,
      totalVolume: total,
      stdDeviation: stdDev,
      sampleSize: volumes.length,
      confidence: level,
      confidenceNote: note,
      recentLogs,
      aircraftTypes,
      routes,
      operators,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
      trendPct,
      trendLabel,
    };
  },

  /**
   * Compute daily fuel consumption totals across all operations.
   */
  async aggregateDailyConsumption(dateRange: ParsedDateRange): Promise<DailyConsumptionResult> {
    const logs = await this.queryFlightLogs(dateRange);
    const { level, note } = getConfidence(logs.length);

    const totalVolume = logs.reduce((acc, l) => acc + getLogVolume(l), 0);

    // Group by day
    const byDayMap: Record<string, { volume: number; count: number }> = {};
    logs.forEach(l => {
      const date = getLogDate(l);
      if (!date) return;
      if (!byDayMap[date]) byDayMap[date] = { volume: 0, count: 0 };
      byDayMap[date].volume += getLogVolume(l);
      byDayMap[date].count += 1;
    });

    const byDay = Object.entries(byDayMap)
      .map(([date, data]) => ({ date, volume: Math.round(data.volume), count: data.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dayCount = byDay.length || 1;

    // Top flights by volume
    const byFlightMap: Record<string, { totalVolume: number; count: number }> = {};
    logs.forEach(l => {
      const fn = l.flightNumber.toUpperCase().replace(/\s+/g, '');
      if (!byFlightMap[fn]) byFlightMap[fn] = { totalVolume: 0, count: 0 };
      byFlightMap[fn].totalVolume += getLogVolume(l);
      byFlightMap[fn].count += 1;
    });

    const topFlights = Object.entries(byFlightMap)
      .map(([flightNumber, data]) => ({
        flightNumber,
        totalVolume: Math.round(data.totalVolume),
        count: data.count,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    return {
      totalVolume: Math.round(totalVolume),
      totalMass: Math.round(totalVolume * 0.80),
      flightCount: logs.length,
      dailyAvg: Math.round(totalVolume / dayCount),
      dayCount,
      byDay,
      topFlights,
      confidence: level,
      confidenceNote: note,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
    };
  },

  /**
   * Compute per-operator performance metrics.
   */
  async aggregateByOperator(dateRange: ParsedDateRange): Promise<AggregationResult & { operators: { name: string; volume: number; count: number }[] }> {
    const logs = await this.queryFlightLogs(dateRange);
    const { level, note } = getConfidence(logs.length);

    const byOpMap: Record<string, { volume: number; count: number }> = {};
    logs.forEach(l => {
      const op = l.operatorName || l.operatorId || 'Unknown';
      if (!byOpMap[op]) byOpMap[op] = { volume: 0, count: 0 };
      byOpMap[op].volume += getLogVolume(l);
      byOpMap[op].count += 1;
    });

    const operators = Object.entries(byOpMap)
      .map(([name, data]) => ({ name, volume: Math.round(data.volume), count: data.count }))
      .sort((a, b) => b.volume - a.volume);

    return {
      metric: 'Operator Performance',
      value: operators.length,
      unit: 'operators',
      sampleSize: logs.length,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
      confidence: level,
      confidenceNote: note,
      operators,
    };
  },

  /**
   * Compute per-equipment usage and volume stats.
   */
  async aggregateByEquipment(vehicleId: string, dateRange: ParsedDateRange): Promise<AggregationResult & { 
    flightLogs: number; bridgingLogs: number; totalFlightVolume: number; totalBridgingVolume: number 
  }> {
    const [flightLogs, bridgingLogs] = await Promise.all([
      this.queryFlightLogs(dateRange, { vehicleId }),
      this.queryBridgingLogs(dateRange, { vehicleId }),
    ]);

    const totalSample = flightLogs.length + bridgingLogs.length;
    const { level, note } = getConfidence(totalSample);
    const totalFlightVolume = Math.round(flightLogs.reduce((acc, l) => acc + getLogVolume(l), 0));
    const totalBridgingVolume = Math.round(bridgingLogs.reduce((acc, l) => acc + l.volume, 0));

    return {
      metric: `Equipment Usage — ${vehicleId.toUpperCase()}`,
      value: totalFlightVolume + totalBridgingVolume,
      unit: 'Liters',
      sampleSize: totalSample,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
      confidence: level,
      confidenceNote: note,
      flightLogs: flightLogs.length,
      bridgingLogs: bridgingLogs.length,
      totalFlightVolume,
      totalBridgingVolume,
    };
  },

  /**
   * Rank flights by total fuel uplifted within a date range.
   */
  async getTopFlightsByVolume(dateRange: ParsedDateRange, limit: number = 10): Promise<{
    flights: { flightNumber: string; totalVolume: number; avgVolume: number; count: number }[];
    totalVolume: number;
    confidence: ConfidenceLevel;
    confidenceNote: string;
    dateRange: { start: string; end: string; label: string };
  }> {
    const logs = await this.queryFlightLogs(dateRange);
    const { level, note } = getConfidence(logs.length);

    const byFlightMap: Record<string, { totalVolume: number; count: number }> = {};
    logs.forEach(l => {
      const fn = l.flightNumber.toUpperCase().replace(/\s+/g, '');
      if (!byFlightMap[fn]) byFlightMap[fn] = { totalVolume: 0, count: 0 };
      byFlightMap[fn].totalVolume += getLogVolume(l);
      byFlightMap[fn].count += 1;
    });

    const flights = Object.entries(byFlightMap)
      .map(([flightNumber, data]) => ({
        flightNumber,
        totalVolume: Math.round(data.totalVolume),
        avgVolume: Math.round(data.totalVolume / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);

    const totalVolume = Math.round(logs.reduce((acc, l) => acc + getLogVolume(l), 0));

    return {
      flights,
      totalVolume,
      confidence: level,
      confidenceNote: note,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
    };
  },

  /**
   * Compute bridging/loading statistics.
   */
  async aggregateBridgingStats(dateRange: ParsedDateRange, filters?: {
    vehicleId?: string;
    tankId?: string;
  }): Promise<BridgingStats> {
    const logs = await this.queryBridgingLogs(dateRange, filters);
    const { level, note } = getConfidence(logs.length);

    const totalVolume = Math.round(logs.reduce((acc, l) => acc + l.volume, 0));

    // Group by vehicle
    const byVehicleMap: Record<string, { totalVolume: number; count: number }> = {};
    logs.forEach(l => {
      const vid = l.vehicleId.toUpperCase();
      if (!byVehicleMap[vid]) byVehicleMap[vid] = { totalVolume: 0, count: 0 };
      byVehicleMap[vid].totalVolume += l.volume;
      byVehicleMap[vid].count += 1;
    });

    // Group by tank
    const byTankMap: Record<string, { totalVolume: number; count: number }> = {};
    logs.forEach(l => {
      const tid = l.sourceTankId.toUpperCase();
      if (!byTankMap[tid]) byTankMap[tid] = { totalVolume: 0, count: 0 };
      byTankMap[tid].totalVolume += l.volume;
      byTankMap[tid].count += 1;
    });

    return {
      totalVolume,
      loadCount: logs.length,
      avgVolume: logs.length > 0 ? Math.round(totalVolume / logs.length) : 0,
      byVehicle: Object.entries(byVehicleMap)
        .map(([vehicleId, d]) => ({ vehicleId, totalVolume: Math.round(d.totalVolume), count: d.count }))
        .sort((a, b) => b.totalVolume - a.totalVolume),
      byTank: Object.entries(byTankMap)
        .map(([tankId, d]) => ({ tankId, totalVolume: Math.round(d.totalVolume), count: d.count }))
        .sort((a, b) => b.totalVolume - a.totalVolume),
      confidence: level,
      confidenceNote: note,
      dateRange: { start: dateRange.startDate, end: dateRange.endDate, label: dateRange.label },
    };
  },

  /**
   * Period-over-period comparison for a metric.
   */
  async comparePeriods(
    dateRange1: ParsedDateRange,
    dateRange2: ParsedDateRange,
    flightNumber?: string,
  ): Promise<{
    period1: { label: string; totalVolume: number; flightCount: number; avgVolume: number };
    period2: { label: string; totalVolume: number; flightCount: number; avgVolume: number };
    changePct: number;
    changeLabel: string;
    confidence: ConfidenceLevel;
    confidenceNote: string;
  }> {
    const [logs1, logs2] = await Promise.all([
      this.queryFlightLogs(dateRange1, flightNumber ? { flightNumber } : undefined),
      this.queryFlightLogs(dateRange2, flightNumber ? { flightNumber } : undefined),
    ]);

    const vol1 = logs1.reduce((acc, l) => acc + getLogVolume(l), 0);
    const vol2 = logs2.reduce((acc, l) => acc + getLogVolume(l), 0);
    const avg1 = logs1.length > 0 ? Math.round(vol1 / logs1.length) : 0;
    const avg2 = logs2.length > 0 ? Math.round(vol2 / logs2.length) : 0;

    const changePct = vol1 > 0 ? Math.round(((vol2 - vol1) / vol1) * 1000) / 10 : 0;
    const arrow = changePct >= 0 ? '↑' : '↓';
    const changeLabel = `${arrow} ${Math.abs(changePct)}%`;

    const totalSample = logs1.length + logs2.length;
    const { level, note } = getConfidence(totalSample);

    return {
      period1: { label: dateRange1.label, totalVolume: Math.round(vol1), flightCount: logs1.length, avgVolume: avg1 },
      period2: { label: dateRange2.label, totalVolume: Math.round(vol2), flightCount: logs2.length, avgVolume: avg2 },
      changePct,
      changeLabel,
      confidence: level,
      confidenceNote: note,
    };
  },
};
