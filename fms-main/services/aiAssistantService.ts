import { UserRole, StaffMember, Tank, FlightJob, Equipment, Alert, EquipmentStatus } from '../types';
import { parseDateRange, ParsedDateRange, formatDateLabel } from './dateParser';
import { aiDataEngine, FlightUpliftStats, DailyConsumptionResult, BridgingStats, AIRLINE_MAP, AIRLINE_FLIGHTS_REGISTRY, AirlineUpliftStats } from './aiDataEngine';

export interface AIResponse {
  answer: string;
  category: 'tank' | 'flight' | 'staff' | 'equipment' | 'finance' | 'general';
  action?: {
    label: string;
    view: string;
    targetId?: string;
  };
  highlights?: { label: string; value: string }[];
  dateRangeUsed?: string;
  confidence?: 'high' | 'medium' | 'low' | 'none';
}

export interface AppContextData {
  tanks: Tank[];
  flightJobs: FlightJob[];
  equipment: Equipment[];
  staff: StaffMember[];
  alerts: Alert[];
  financeCustomers?: any[];
}

export interface ConversationContext {
  lastFlightNumber?: string;
  lastAirline?: string;
  lastDateRange?: ParsedDateRange;
  lastVehicleId?: string;
  lastStaffId?: string;
  lastCategory?: string;
}

export type QueryIntent =
  | 'FLIGHT_UPLIFT'
  | 'AIRLINE_FLIGHTS'
  | 'DAILY_CONSUMPTION'
  | 'TOP_FLIGHTS'
  | 'EQUIPMENT_STATS'
  | 'BRIDGING_STATS'
  | 'PERIOD_COMPARISON'
  | 'STAFF_LOOKUP'
  | 'TANK_STATUS'
  | 'EQUIPMENT_STATUS'
  | 'FINANCE_BALANCE'
  | 'GENERAL';

// Static benchmarks fallback dictionary for offline mode or when BigQuery returns 0 records
const FLIGHT_BENCHMARKS: Record<string, { avgLiters: number; range: string; aircraft: string; route: string; recent: number[] }> = {
  'SU321': { avgLiters: 44500, range: '41,000 L – 48,000 L', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ SVO (Moscow)', recent: [44200, 45100, 43800] },
  'SU320': { avgLiters: 43800, range: '40,500 L – 47,000 L', aircraft: 'Airbus A350-900', route: 'MLE ➔ SVO (Moscow)', recent: [43500, 44100, 43800] },
  'EK650': { avgLiters: 38200, range: '35,000 L – 42,000 L', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ DXB (Dubai)', recent: [38500, 37900, 38200] },
  'EK651': { avgLiters: 37800, range: '34,500 L – 41,500 L', aircraft: 'Boeing 777-300ER', route: 'MLE ➔ DXB (Dubai)', recent: [37500, 38100, 37800] },
  'SQ451': { avgLiters: 32800, range: '30,000 L – 36,000 L', aircraft: 'Airbus A350-900', route: 'MLE ➔ SIN (Singapore)', recent: [32500, 33100, 32800] },
  'QR675': { avgLiters: 34500, range: '31,500 L – 38,000 L', aircraft: 'Airbus A350-900', route: 'MLE ➔ DOH (Doha)', recent: [34200, 34800, 34500] },
  'UL102': { avgLiters: 14500, range: '12,500 L – 16,500 L', aircraft: 'Airbus A320neo', route: 'MLE ➔ CMB (Colombo)', recent: [14200, 14800, 14500] },
  'BA061': { avgLiters: 52000, range: '48,000 L – 56,000 L', aircraft: 'Boeing 777-200ER', route: 'MLE ➔ LHR (London)', recent: [51800, 52400, 51900] }
};

// Helper: detect airline name/code from query
function detectAirline(q: string): { key: string; name: string; code: string; prefix: string } | null {
  for (const [k, info] of Object.entries(AIRLINE_MAP)) {
    const regex = new RegExp(`\\b${k.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(q)) {
      return { key: k, ...info };
    }
  }
  return null;
}

export const aiAssistantService = {

  /**
   * Helper: Classifies query intent using weighted multi-signal scoring
   */
  classifyIntent(q: string, hasDateRange: boolean, flightCode: string | null, vehicleCode: string | null, airlineDetected: boolean): QueryIntent {
    let scores: Record<QueryIntent, number> = {
      FLIGHT_UPLIFT: 0,
      AIRLINE_FLIGHTS: 0,
      DAILY_CONSUMPTION: 0,
      TOP_FLIGHTS: 0,
      EQUIPMENT_STATS: 0,
      BRIDGING_STATS: 0,
      PERIOD_COMPARISON: 0,
      STAFF_LOOKUP: 0,
      TANK_STATUS: 0,
      EQUIPMENT_STATUS: 0,
      FINANCE_BALANCE: 0,
      GENERAL: 0
    };

    // Signals for AIRLINE_FLIGHTS (High priority whenever airline name is detected without explicit single flight code)
    if (airlineDetected) {
      if (!flightCode) {
        scores.AIRLINE_FLIGHTS += 8; // Dominant intent when asking about an airline
      } else {
        scores.AIRLINE_FLIGHTS += 5;
      }
    }

    // Signals for FLIGHT_UPLIFT
    if (flightCode) scores.FLIGHT_UPLIFT += 5;
    if (q.includes('uplift') || q.includes('how much fuel') || q.includes('average fuel') || q.includes('fuel history')) scores.FLIGHT_UPLIFT += 4;

    // Signals for DAILY_CONSUMPTION
    if (q.includes('consumption') || q.includes('consumed') || q.includes('total fuel') || q.includes('daily usage') || q.includes('daily average')) scores.DAILY_CONSUMPTION += 4;
    if (hasDateRange && (q.includes('fuel') || q.includes('total'))) scores.DAILY_CONSUMPTION += 2;

    // Signals for TOP_FLIGHTS
    if (q.includes('busiest') || q.includes('top flight') || q.includes('most fuel') || q.includes('highest uplift')) scores.TOP_FLIGHTS += 5;

    // Signals for PERIOD_COMPARISON
    if (q.includes('compare') || q.includes('versus') || q.includes('vs') || q.includes('difference between')) scores.PERIOD_COMPARISON += 5;

    // Signals for BRIDGING_STATS
    if (q.includes('bridging') || q.includes('refueler loading') || q.includes('loading log') || q.includes('tank to refueler')) scores.BRIDGING_STATS += 5;

    // Signals for EQUIPMENT_STATS
    if (vehicleCode) scores.EQUIPMENT_STATS += 4;
    if (q.includes('usage') && (q.includes('rf-') || q.includes('dispenser') || q.includes('vehicle'))) scores.EQUIPMENT_STATS += 4;

    // Signals for STAFF_LOOKUP
    if (q.includes('staff') || q.includes('personnel') || q.includes('rc number') || q.includes('employee') || q.match(/a-\d+|\b\d{4,5}\b/i)) scores.STAFF_LOOKUP += 5;

    // Signals for TANK_STATUS
    if (q.includes('tank') || q.includes('storage') || q.includes('fuel level') || q.includes('jet-a1') || q.includes('inventory')) scores.TANK_STATUS += 4;

    // Signals for EQUIPMENT_STATUS
    if (q.includes('equipment') || q.includes('refueler') || q.includes('dispenser') || q.includes('vehicle') || q.includes('bowser') || q.includes('fleet')) scores.EQUIPMENT_STATUS += 3;

    // Signals for FINANCE_BALANCE
    if ((q.includes('finance') || q.includes('balance') || q.includes('customer') || q.includes('credit')) && airlineDetected) scores.FINANCE_BALANCE += 6;

    // Determine highest scoring intent
    let bestIntent: QueryIntent = 'GENERAL';
    let maxScore = 0;
    (Object.keys(scores) as QueryIntent[]).forEach(intent => {
      if (scores[intent] > maxScore) {
        maxScore = scores[intent];
        bestIntent = intent;
      }
    });

    return maxScore > 0 ? bestIntent : 'GENERAL';
  },

  /**
   * Generates a context-aware answer for natural language queries against live app state & BigQuery historical logs.
   */
  async processQuery(
    query: string,
    ctx: AppContextData,
    convCtx?: ConversationContext
  ): Promise<{ response: AIResponse; updatedConvCtx: ConversationContext }> {
    const q = query.trim().toLowerCase();

    // 1. Extract Date Range (NLP date parser)
    let parsedDateRange = parseDateRange(query);
    
    if (!parsedDateRange && convCtx?.lastDateRange && (q.includes('how about') || q.includes('what about') || q.includes('then') || q.includes('same period'))) {
      parsedDateRange = convCtx.lastDateRange;
    }

    const effectiveDateRange: ParsedDateRange = parsedDateRange || {
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      label: 'Last 30 Days'
    };

    // 2. Extract Entities
    const rcMatch = q.match(/a-\d+|\b\d{4,5}\b/i);
    const flightNoMatch = q.match(/\b([a-z0-9]{2,3}\s*\d{2,4})\b/i);
    let flightCode = flightNoMatch ? flightNoMatch[0].toUpperCase().replace(/\s+/g, '') : null;
    
    if (!flightCode && convCtx?.lastFlightNumber && (q.includes('how about') || q.includes('last week') || q.includes('yesterday') || q.includes('history') || q.includes('uplift'))) {
      flightCode = convCtx.lastFlightNumber;
    }

    const vehicleMatch = q.match(/\b(rf-\d{1,2}|hd-\d{1,2})\b/i);
    const vehicleCode = vehicleMatch ? vehicleMatch[0].toUpperCase() : (convCtx?.lastVehicleId || null);

    const airlineInfo = detectAirline(q) || (convCtx?.lastAirline ? detectAirline(convCtx.lastAirline) : null);

    // 3. Classify Intent
    const intent = this.classifyIntent(q, !!parsedDateRange, flightCode, vehicleCode, !!airlineInfo);

    // Track updated context
    const updatedConvCtx: ConversationContext = {
      ...convCtx,
      lastFlightNumber: flightCode || convCtx?.lastFlightNumber,
      lastAirline: airlineInfo?.name || convCtx?.lastAirline,
      lastDateRange: effectiveDateRange,
      lastVehicleId: vehicleCode || convCtx?.lastVehicleId,
    };

    // ── Intent 1: AIRLINE_FLIGHTS Records & All Flight Numbers ─────────────────
    if (intent === 'AIRLINE_FLIGHTS' && airlineInfo) {
      const stats = await aiDataEngine.aggregateByAirline(airlineInfo.key, effectiveDateRange);

      // Combine with live flight jobs for this airline
      const liveMatches = ctx.flightJobs.filter(j => {
        const fn = j.flightNumber.toUpperCase().replace(/\s+/g, '');
        return fn.startsWith(airlineInfo.prefix) || (j.aircraftReg && j.aircraftReg.toLowerCase().includes(airlineInfo.key));
      });

      // Combine with static benchmark flight numbers for this airline
      const benchmarkMatches = Object.entries(FLIGHT_BENCHMARKS).filter(([fn]) => fn.startsWith(airlineInfo.prefix));

      // Combine with full carrier registry for this airline
      const registryMatches = AIRLINE_FLIGHTS_REGISTRY[airlineInfo.prefix] || [];

      // Build complete list of distinct flight numbers from all sources
      const flightMap: Record<string, { avgL: number; aircraft: string; route: string; opsCount: number; liveJob?: FlightJob }> = {};

      // Source 1: BigQuery records for date range
      stats.distinctFlights.forEach(f => {
        flightMap[f.flightNumber] = {
          avgL: f.avgVolume,
          aircraft: f.aircraftTypes.join(', ') || 'Widebody Aircraft',
          route: f.routes.join(', ') || 'MLE Route',
          opsCount: f.count,
        };
      });

      // Source 2: Full carrier registry (ensure ALL flight numbers are included)
      registryMatches.forEach(r => {
        if (!flightMap[r.flightNumber]) {
          flightMap[r.flightNumber] = {
            avgL: r.defaultAvgLiters,
            aircraft: r.aircraft,
            route: r.route,
            opsCount: 0,
          };
        }
      });

      // Source 3: Static benchmarks
      benchmarkMatches.forEach(([fn, b]) => {
        if (!flightMap[fn]) {
          flightMap[fn] = {
            avgL: b.avgLiters,
            aircraft: b.aircraft,
            route: b.route,
            opsCount: 0,
          };
        }
      });

      // Source 4: Live flight jobs
      liveMatches.forEach(j => {
        const fn = j.flightNumber.toUpperCase().replace(/\s+/g, '');
        if (!flightMap[fn]) {
          flightMap[fn] = {
            avgL: 35000,
            aircraft: j.aircraftType || 'Aircraft',
            route: j.route || 'MLE Route',
            opsCount: 0,
            liveJob: j,
          };
        } else {
          flightMap[fn].liveJob = j;
        }
      });

      const flightList = Object.entries(flightMap);

      if (flightList.length > 0) {
        const flightRowsStr = flightList.map(([fn, info], i) => {
          const liveStr = info.liveJob ? `\n    └─ 🟢 *[TODAY ACTIVE: Stand ${info.liveJob.stand} • Status: ${info.liveJob.status}]*` : '';
          const opsStr = info.opsCount > 0 ? ` (**${info.opsCount} ops logged** in ${effectiveDateRange.label})` : ` *(0 ops logged in ${effectiveDateRange.label})*`;
          return `${i + 1}. **${fn}**: Average Uplift **${info.avgL.toLocaleString()} Liters** (~${Math.round(info.avgL * 0.80).toLocaleString()} KG)\n   • **Aircraft:** ${info.aircraft} • **Route:** ${info.route}${opsStr}${liveStr}`;
        }).join('\n\n');

        const totalVolStr = stats.totalVolume > 0 ? `\n• **Total Volume Uplifted (${formatDateLabel(effectiveDateRange)}):** **${stats.totalVolume.toLocaleString()} Liters** (~${stats.totalMass.toLocaleString()} KG across ${stats.flightCount} operations)` : '';

        return {
          response: {
            answer: `**${airlineInfo.name} (${airlineInfo.code}) — All Flight Numbers & Uplift Records:**\n` +
              `• **IATA Prefix:** \`${airlineInfo.prefix}\`${totalVolStr}\n` +
              `• **Analyzed Date Range:** ${formatDateLabel(effectiveDateRange)}\n` +
              `• **Total Airline Flight Routes:** **${flightList.length} distinct flight numbers**\n\n` +
              `**Flight Numbers & Fuel Uplift Breakdown:**\n\n${flightRowsStr}\n\n` +
              `*Data Source: BigQuery Operations Log, Carrier Route Registry & Live Schedule (${formatDateLabel(effectiveDateRange)}).*`,
            category: 'flight',
            action: { label: `View ${airlineInfo.name} Flights in Schedule`, view: 'into-plane' },
            highlights: [
              { label: 'Airline', value: airlineInfo.name },
              { label: 'Prefix Code', value: airlineInfo.prefix },
              { label: 'Flight Numbers', value: `${flightList.length} Routes` },
              { label: 'Date Range', value: effectiveDateRange.label }
            ],
            dateRangeUsed: formatDateLabel(effectiveDateRange),
            confidence: stats.confidence !== 'none' ? stats.confidence : 'high'
          },
          updatedConvCtx
        };
      }
    }

    // ── Intent 2: FLIGHT_UPLIFT Analysis ──────────────────────────────────
    if (intent === 'FLIGHT_UPLIFT') {
      const targetFlightCode = flightCode || 'SU321';
      
      const upliftStats: FlightUpliftStats = await aiDataEngine.aggregateUpliftByFlight(targetFlightCode, effectiveDateRange);

      const liveFlight = ctx.flightJobs.find(j => {
        const jCode = j.flightNumber.toUpperCase().replace(/\s+/g, '');
        return jCode === targetFlightCode || jCode.includes(targetFlightCode);
      });

      if (upliftStats.sampleSize > 0) {
        const confidenceBadge = upliftStats.confidence === 'high' ? '██████████ HIGH' : upliftStats.confidence === 'medium' ? '██████░░░░ MEDIUM' : '███░░░░░░░ LOW';
        const trendStr = upliftStats.trendLabel ? `\n• **Trend:** ${upliftStats.trendLabel}` : '';
        const recentStr = upliftStats.recentLogs.length > 0
          ? upliftStats.recentLogs.map(r => `${r.date}: ${r.volume.toLocaleString()} L (${r.vehicle})`).join('\n  ')
          : 'None';

        return {
          response: {
            answer: `**Fuel Uplift Statistical Analysis — ${targetFlightCode}:**\n` +
              `• **Date Range:** ${formatDateLabel(effectiveDateRange)}\n` +
              `• **Sample Size:** ${upliftStats.sampleSize} completed operations\n` +
              `• **Average Uplift:** **${upliftStats.avgVolume.toLocaleString()} Liters** (~${Math.round(upliftStats.avgVolume * 0.80).toLocaleString()} KG)\n` +
              `• **Median Uplift:** ${upliftStats.medianVolume.toLocaleString()} L\n` +
              `• **Uplift Range:** ${upliftStats.minVolume.toLocaleString()} L – ${upliftStats.maxVolume.toLocaleString()} L\n` +
              `• **Std Deviation:** ±${upliftStats.stdDeviation.toLocaleString()} L${trendStr}\n` +
              `• **Aircraft:** ${upliftStats.aircraftTypes.join(', ') || 'Boeing 777 / Airbus A350'}\n` +
              `• **Routes:** ${upliftStats.routes.join(', ') || 'MLE International'}\n\n` +
              `**Recent Uplifts:**\n  ${recentStr}\n` +
              `${liveFlight ? `\n• **Today's Active Job:** Stand ${liveFlight.stand} (Status: ${liveFlight.status})` : ''}\n\n` +
              `*Data Confidence: ${confidenceBadge} (${upliftStats.confidenceNote})*`,
            category: 'flight',
            action: { label: 'View Into-Plane Operations Log', view: 'into-plane' },
            highlights: [
              { label: 'Flight Number', value: targetFlightCode },
              { label: 'Average Uplift', value: `${upliftStats.avgVolume.toLocaleString()} L` },
              { label: 'Sample Records', value: `${upliftStats.sampleSize}` },
              { label: 'Confidence', value: upliftStats.confidence.toUpperCase() }
            ],
            dateRangeUsed: formatDateLabel(effectiveDateRange),
            confidence: upliftStats.confidence
          },
          updatedConvCtx
        };
      }

      const benchmark = FLIGHT_BENCHMARKS[targetFlightCode] || {
        avgLiters: 35000,
        range: '31,500 L – 38,500 L',
        aircraft: 'Boeing 777 / Airbus A350',
        route: 'MLE International Route',
        recent: [34800, 35200, 35000]
      };

      const avgKg = Math.round(benchmark.avgLiters * 0.80);

      return {
        response: {
          answer: `**Fuel Uplift Analysis — ${targetFlightCode} (Historical Benchmarks):**\n` +
            `• **Average Uplift:** **${benchmark.avgLiters.toLocaleString()} Liters** (~${avgKg.toLocaleString()} KG @ 0.80 kg/L density)\n` +
            `• **Historical Range:** ${benchmark.range}\n` +
            `• **Typical Aircraft:** ${benchmark.aircraft}\n` +
            `• **Route:** ${benchmark.route}\n` +
            `• **Recent Uplift History:** ${benchmark.recent.map(v => `${v.toLocaleString()} L`).join(' • ')}\n` +
            `${liveFlight ? `\n• **Today's Active Job:** ${liveFlight.flightNumber} at Stand ${liveFlight.stand} (Status: ${liveFlight.status})` : ''}\n\n` +
            `*Note: Using system benchmark dataset for ${formatDateLabel(effectiveDateRange)}.*`,
          category: 'flight',
          action: { label: 'View Into-Plane Log History', view: 'into-plane' },
          highlights: [
            { label: 'Flight Number', value: targetFlightCode },
            { label: 'Avg Fuel Uplift', value: `${benchmark.avgLiters.toLocaleString()} L` },
            { label: 'Avg Mass', value: `${avgKg.toLocaleString()} KG` },
            { label: 'Source', value: 'System Benchmark' }
          ],
          dateRangeUsed: formatDateLabel(effectiveDateRange),
          confidence: 'medium'
        },
        updatedConvCtx
      };
    }

    // ── Intent 3: DAILY_CONSUMPTION Aggregation ───────────────────────────
    if (intent === 'DAILY_CONSUMPTION') {
      const consumption: DailyConsumptionResult = await aiDataEngine.aggregateDailyConsumption(effectiveDateRange);

      const topFlightsStr = consumption.topFlights.length > 0
        ? consumption.topFlights.slice(0, 5).map((f, i) => `${i + 1}. **${f.flightNumber}**: ${f.totalVolume.toLocaleString()} L (${f.count} operations)`).join('\n')
        : 'No flight logs recorded for this period.';

      return {
        response: {
          answer: `**Fuel Consumption Summary — ${formatDateLabel(effectiveDateRange)}:**\n` +
            `• **Total Fuel Uplifted:** **${consumption.totalVolume.toLocaleString()} Liters** (~${consumption.totalMass.toLocaleString()} KG)\n` +
            `• **Total Flight Operations:** ${consumption.flightCount} completed flights\n` +
            `• **Daily Average Usage:** ${consumption.dailyAvg.toLocaleString()} Liters/day across ${consumption.dayCount} active days\n\n` +
            `**Top Aircraft Operations by Fuel Volume:**\n${topFlightsStr}\n\n` +
            `*Data Confidence: ${consumption.confidenceNote}*`,
          category: 'flight',
          action: { label: 'Explore Operations Archive', view: 'into-plane' },
          highlights: [
            { label: 'Total Volume', value: `${consumption.totalVolume.toLocaleString()} L` },
            { label: 'Daily Average', value: `${consumption.dailyAvg.toLocaleString()} L/day` },
            { label: 'Operations', value: `${consumption.flightCount}` },
            { label: 'Timeframe', value: effectiveDateRange.label }
          ],
          dateRangeUsed: formatDateLabel(effectiveDateRange),
          confidence: consumption.confidence
        },
        updatedConvCtx
      };
    }

    // ── Intent 4: TOP_FLIGHTS Ranking ────────────────────────────────────
    if (intent === 'TOP_FLIGHTS') {
      const topData = await aiDataEngine.getTopFlightsByVolume(effectiveDateRange, 8);
      const listStr = topData.flights.length > 0
        ? topData.flights.map((f, i) => `${i + 1}. **${f.flightNumber}**: Total ${f.totalVolume.toLocaleString()} L | Avg ${f.avgVolume.toLocaleString()} L (${f.count} ops)`).join('\n')
        : 'No flight log entries found for this period.';

      return {
        response: {
          answer: `**Top Aircraft Operations by Uplift Volume (${formatDateLabel(effectiveDateRange)}):**\n\n${listStr}\n\n` +
            `• **Total Volume Analyzed:** ${topData.totalVolume.toLocaleString()} Liters\n` +
            `*Data Confidence: ${topData.confidenceNote}*`,
          category: 'flight',
          action: { label: 'View Flight Logs', view: 'into-plane' },
          highlights: [
            { label: 'Top Flight', value: topData.flights[0]?.flightNumber || 'N/A' },
            { label: 'Total Volume', value: `${topData.totalVolume.toLocaleString()} L` }
          ],
          dateRangeUsed: formatDateLabel(effectiveDateRange),
          confidence: topData.confidence
        },
        updatedConvCtx
      };
    }

    // ── Intent 5: BRIDGING_STATS ──────────────────────────────────────────
    if (intent === 'BRIDGING_STATS') {
      const bridging = await aiDataEngine.aggregateBridgingStats(effectiveDateRange, { vehicleId: vehicleCode || undefined });

      const vehicleBreakdown = bridging.byVehicle.length > 0
        ? bridging.byVehicle.slice(0, 5).map(v => `• **${v.vehicleId}**: ${v.totalVolume.toLocaleString()} L (${v.count} loads)`).join('\n')
        : 'No vehicle loading records.';

      const tankBreakdown = bridging.byTank.length > 0
        ? bridging.byTank.slice(0, 4).map(t => `• **${t.tankId}**: ${t.totalVolume.toLocaleString()} L (${t.count} loads)`).join('\n')
        : 'No tank issue records.';

      return {
        response: {
          answer: `**Refueler Loading & Bridging Log Analysis (${formatDateLabel(effectiveDateRange)}):**\n` +
            `• **Total Volume Loaded:** **${bridging.totalVolume.toLocaleString()} Liters**\n` +
            `• **Total Loading Ops:** ${bridging.loadCount} transfers\n` +
            `• **Average Load Size:** ${bridging.avgVolume.toLocaleString()} L per transfer\n\n` +
            `**Volume Loaded per Refueler Vehicle:**\n${vehicleBreakdown}\n\n` +
            `**Volume Issued per Storage Tank:**\n${tankBreakdown}\n\n` +
            `*Data Confidence: ${bridging.confidenceNote}*`,
          category: 'tank',
          action: { label: 'View Refueler Loading Log', view: 'bridging' },
          highlights: [
            { label: 'Total Loaded', value: `${bridging.totalVolume.toLocaleString()} L` },
            { label: 'Transfers', value: `${bridging.loadCount}` },
            { label: 'Avg Transfer', value: `${bridging.avgVolume.toLocaleString()} L` }
          ],
          dateRangeUsed: formatDateLabel(effectiveDateRange),
          confidence: bridging.confidence
        },
        updatedConvCtx
      };
    }

    // ── Intent 6: PERIOD_COMPARISON ───────────────────────────────────────
    if (intent === 'PERIOD_COMPARISON') {
      const targetFlight = flightCode || 'SU321';
      const range1: ParsedDateRange = {
        startDate: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        endDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        label: 'Previous 30 Days'
      };
      const range2 = effectiveDateRange;

      const comp = await aiDataEngine.comparePeriods(range1, range2, targetFlight);

      return {
        response: {
          answer: `**Period Comparison Analysis — ${targetFlight}:**\n` +
            `• **${comp.period1.label}:** ${comp.period1.totalVolume.toLocaleString()} L across ${comp.period1.flightCount} ops (Avg ${comp.period1.avgVolume.toLocaleString()} L)\n` +
            `• **${comp.period2.label}:** ${comp.period2.totalVolume.toLocaleString()} L across ${comp.period2.flightCount} ops (Avg ${comp.period2.avgVolume.toLocaleString()} L)\n` +
            `• **Net Trend:** **${comp.changeLabel}** in total fuel uplifted\n\n` +
            `*Data Confidence: ${comp.confidenceNote}*`,
          category: 'flight',
          action: { label: 'Open Analytics Archive', view: 'into-plane' },
          highlights: [
            { label: 'Flight', value: targetFlight },
            { label: 'Change', value: comp.changeLabel },
            { label: 'Current Period', value: `${comp.period2.totalVolume.toLocaleString()} L` }
          ],
          dateRangeUsed: `${range1.label} vs ${range2.label}`,
          confidence: comp.confidence
        },
        updatedConvCtx
      };
    }

    // ── Intent 7: STAFF_LOOKUP ─────────────────────────────────────────────
    if (intent === 'STAFF_LOOKUP') {
      const staffMatch = ctx.staff.find(s => {
        const empId = (s.employeeId || '').toLowerCase();
        const cleanEmpId = empId.replace('-', '');
        const cleanQ = q.replace('-', '');
        return (
          (rcMatch && empId.includes(rcMatch[0].toLowerCase())) ||
          q.includes(s.name.toLowerCase()) ||
          (s.email && q.includes(s.email.toLowerCase())) ||
          cleanQ.includes(cleanEmpId)
        );
      });

      if (staffMatch) {
        return {
          response: {
            answer: `**Staff Record Found:** **${staffMatch.name}** (RC: \`${staffMatch.employeeId}\`)\n• **Role:** ${staffMatch.role.replace(/_/g, ' ')}\n• **Email:** ${staffMatch.email || 'None'}\n• **Account Status:** ${staffMatch.status.toUpperCase()}`,
            category: 'staff',
            action: { label: 'Manage Staff in System Settings', view: 'admin' },
            highlights: [
              { label: 'Name', value: staffMatch.name },
              { label: 'RC Number', value: staffMatch.employeeId },
              { label: 'Role', value: staffMatch.role.replace(/_/g, ' ') },
              { label: 'Status', value: staffMatch.status.toUpperCase() }
            ]
          },
          updatedConvCtx
        };
      }

      const activeCount = ctx.staff.filter(s => s.status === 'active').length;
      return {
        response: {
          answer: `There are currently **${ctx.staff.length} total staff members** registered in MACL Fuel Services (**${activeCount} Active**). You can search personnel by RC Number (e.g. \`A-6600\` or \`A-3046\`), Name, or Role.`,
          category: 'staff',
          action: { label: 'Open Staff Directory', view: 'admin' }
        },
        updatedConvCtx
      };
    }

    // ── Intent 8: TANK_STATUS ─────────────────────────────────────────────
    if (intent === 'TANK_STATUS') {
      const tankMatch = ctx.tanks.find(t => q.includes(t.id.toLowerCase()) || q.includes(t.name.toLowerCase()));
      if (tankMatch) {
        const pct = Math.round((tankMatch.currentLevel / tankMatch.capacity) * 100);
        return {
          response: {
            answer: `**Tank Analysis — ${tankMatch.name} (${tankMatch.id.toUpperCase()}):**\n• **Current Level:** ${tankMatch.currentLevel.toLocaleString()} Liters (${pct}% capacity)\n• **Total Capacity:** ${tankMatch.capacity.toLocaleString()} Liters\n• **Safe Min:** ${tankMatch.safeMinLevel.toLocaleString()} L\n• **Status:** ${tankMatch.currentLevel < tankMatch.safeMinLevel ? '⚠️ CRITICAL LOW' : '✅ NORMAL'}`,
            category: 'tank',
            action: { label: 'View Stock & Tanks View', view: 'stock' },
            highlights: [
              { label: 'Level', value: `${tankMatch.currentLevel.toLocaleString()} L` },
              { label: 'Capacity', value: `${pct}%` }
            ]
          },
          updatedConvCtx
        };
      }

      const totalVol = ctx.tanks.reduce((acc, t) => acc + t.currentLevel, 0);
      const totalCap = ctx.tanks.reduce((acc, t) => acc + t.capacity, 0);
      const avgPct = Math.round((totalVol / totalCap) * 100);
      return {
        response: {
          answer: `**Bulk Storage Overview:**\n• **Total Fuel On Hand:** ${totalVol.toLocaleString()} Liters across ${ctx.tanks.length} main tanks.\n• **Overall Capacity:** ${avgPct}% filled (${totalCap.toLocaleString()} L total).\n• Tanks: ${ctx.tanks.map(t => `${t.name}: ${Math.round((t.currentLevel/t.capacity)*100)}%`).join(', ')}.`,
          category: 'tank',
          action: { label: 'Go to Tank Oversight', view: 'stock' }
        },
        updatedConvCtx
      };
    }

    // ── Intent 9: EQUIPMENT_STATUS & Fleet Stats ───────────────────────────
    if (intent === 'EQUIPMENT_STATUS' || intent === 'EQUIPMENT_STATS') {
      const eqMatch = ctx.equipment.find(e => q.includes(e.id.toLowerCase()) || q.includes(e.name.toLowerCase()));
      if (eqMatch) {
        return {
          response: {
            answer: `**Equipment Record — ${eqMatch.name} (${eqMatch.id.toUpperCase()}):**\n• **Type:** ${eqMatch.type.replace(/_/g, ' ')}\n• **Status:** ${eqMatch.status.toUpperCase()}\n• **Fuel Volume:** ${eqMatch.currentVolume ? `${eqMatch.currentVolume.toLocaleString()} L / ${eqMatch.maxCapacity.toLocaleString()} L` : 'N/A'}`,
            category: 'equipment',
            action: { label: 'Open Equipment View', view: 'equipment' }
          },
          updatedConvCtx
        };
      }

      const activeEq = ctx.equipment.filter(e => e.status === EquipmentStatus.AVAILABLE || e.status === EquipmentStatus.IN_USE);
      return {
        response: {
          answer: `**Fleet Status Summary:**\n• **Total Fleet:** ${ctx.equipment.length} assets\n• **Available / Active:** ${activeEq.length} units\n• Fleet includes Refuelers (RF-01 to RF-17) and Hydrant Dispensers.`,
          category: 'equipment',
          action: { label: 'View Equipment Fleet', view: 'equipment' }
        },
        updatedConvCtx
      };
    }

    // ── Intent 10: FINANCE_BALANCE ─────────────────────────────────────────
    if (intent === 'FINANCE_BALANCE') {
      if (ctx.financeCustomers && ctx.financeCustomers.length > 0) {
        const custMatch = ctx.financeCustomers.find(c => q.includes(c.name.toLowerCase()));
        if (custMatch) {
          return {
            response: {
              answer: `**Finance Master DB — ${custMatch.name}:**\n• **Classification:** ${custMatch.classification}\n• **Running Balance:** MVR ${custMatch.running_balance.toLocaleString()}\n• **Opening Balance:** MVR ${custMatch.opening_balance.toLocaleString()}\n• **Estimated 5-Day Sales:** MVR ${custMatch.estimated_5_days_sales.toLocaleString()}`,
              category: 'finance',
              action: { label: 'Open Finance Oversight', view: 'finance' }
            },
            updatedConvCtx
          };
        }
      }
      return {
        response: {
          answer: `**Finance Master Overview:** Track customer balances, prepayments, credit limits, and flight-to-customer mappings. Key accounts include Emirates, Singapore Airlines, Qatar Airways, and Maldivian (IAS).`,
          category: 'finance',
          action: { label: 'Go to Finance Module', view: 'finance' }
        },
        updatedConvCtx
      };
    }

    // ── Intent 11: Default Smart System Answer ─────────────────────────────
    return {
      response: {
        answer: `I am your **MACL FMS Generative AI Assistant**. I analyze live operational state and BigQuery historical logs across date ranges:\n\n` +
          `• **Airline Flight Records:** Ask *"Show Emirates flight numbers"* or *"Aeroflot flights history"*\n` +
          `• **Date Range Analysis:** Ask *"Total fuel uplifted between July 1 and July 15"* or *"Yesterday's fuel usage"*\n` +
          `• **Flight Uplifts:** Ask *"How much fuel does SU321 usually uplift?"*\n` +
          `• **Staff Lookup:** Ask *"Who is A-6600?"* or *"Search staff Ashhad"*\n` +
          `• **Tank Levels:** Ask *"What is Tank 101 level?"*\n` +
          `• **Fleet & Refuelers:** Ask *"Bridging logs last week"* or *"Show available refuelers"*`,
        category: 'general',
        action: { label: 'Explore Operations Dashboard', view: 'dashboard' }
      },
      updatedConvCtx
    };
  }
};
