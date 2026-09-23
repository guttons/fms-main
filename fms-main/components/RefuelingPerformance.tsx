import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { User, FlightLog, FlightJob, isDomesticFlight, cleanRemarks } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { haptic } from '../utils/haptics';
import { DelayRecordsLog } from './DelayRecordsLog';
import { 
  Gauge, 
  Plane, 
  Search, 
  Download, 
  Filter, 
  RefreshCw, 
  Timer, 
  CheckCircle2, 
  FileSpreadsheet, 
  TrendingUp, 
  AlertCircle,
  Globe,
  Home,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface RefuelingPerformanceProps {
  user: User;
}

type PerformanceTab = 'TURNAROUND_MATRIX' | 'DELAY_LOGS';
type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';
type CategoryFilter = 'ALL' | 'INTERNATIONAL' | 'DOMESTIC' | 'ADHOC';

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ALL', label: 'ALL', icon: Layers },
  { id: 'INTERNATIONAL', label: 'INTERNATIONAL', icon: Globe },
  { id: 'DOMESTIC', label: 'DOMESTIC', icon: Home },
  { id: 'ADHOC', label: 'AD-HOC', icon: Zap },
];

const DATE_PRESET_OPTIONS: { id: DatePreset; label: string; shortLabel: string }[] = [
  { id: 'TODAY', label: 'TODAY', shortLabel: 'TODAY' },
  { id: 'YESTERDAY', label: 'YESTERDAY', shortLabel: 'YEST' },
  { id: 'LAST_7_DAYS', label: 'LAST 7 DAYS', shortLabel: '7D' },
  { id: 'THIS_MONTH', label: 'THIS MONTH', shortLabel: 'MONTH' },
  { id: 'ALL', label: 'ALL', shortLabel: 'ALL' },
  { id: 'CUSTOM', label: 'CUSTOM', shortLabel: 'CUSTOM' },
];

const formatDisplayTime = (timeStr?: string): string => {
  if (!timeStr || timeStr === 'N/A' || timeStr === '-') return '--:--';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    return timeStr.trim().slice(0, 5);
  }
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  } catch {}
  return timeStr;
};

const parseToLocalMinutes = (timeVal?: string): number | null => {
  if (!timeVal || timeVal === '--:--' || timeVal === 'N/A' || timeVal === '-') return null;
  if (typeof timeVal === 'string' && timeVal.includes('T')) {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }
  }
  const match = String(timeVal).trim().match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  return null;
};

export interface GTEResult {
  minutes: number | null;
  display: string;
  status: 'SAVED' | 'EXCEEDED' | '--';
  isTight: boolean;    // 0 <= minutes < 20 (subtle highlight)
  isExceeded: boolean; // minutes < 0 (negative highlight, status EXCEEDED)
}

const calculateGTE = (targetTime?: string, clearanceTime?: string): GTEResult => {
  const targetMin = parseToLocalMinutes(targetTime);
  const clearMin = parseToLocalMinutes(clearanceTime);
  if (targetMin === null || clearMin === null) {
    return { minutes: null, display: '--:--', status: '--', isTight: false, isExceeded: false };
  }
  let diff = targetMin - clearMin;
  // Handle midnight crossover if flight spans across midnight
  if (diff < -720) {
    diff += 1440;
  } else if (diff > 720) {
    diff -= 1440;
  }

  const isExceeded = diff < 0;
  const isTight = diff >= 0 && diff < 20;
  const status = isExceeded ? 'EXCEEDED' : 'SAVED';
  const display = (diff >= 0 ? '+' : '') + diff + 'm';

  return { minutes: diff, display, status, isTight, isExceeded };
};

const getMinutesBetween = (startStr?: string, endStr?: string): number | null => {
  if (!startStr || !endStr) return null;
  try {
    let startDate: Date;
    let endDate: Date;

    if (/^\d{2}:\d{2}/.test(startStr) && !startStr.includes('T')) {
      const [sh, sm] = startStr.split(':').map(Number);
      startDate = new Date(2000, 0, 1, sh, sm);
    } else {
      startDate = new Date(startStr);
    }

    if (/^\d{2}:\d{2}/.test(endStr) && !endStr.includes('T')) {
      const [eh, em] = endStr.split(':').map(Number);
      endDate = new Date(2000, 0, 1, eh, em);
      if (endDate < startDate) {
        endDate = new Date(2000, 0, 2, eh, em);
      }
    } else {
      endDate = new Date(endStr);
    }

    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    return isNaN(diff) ? null : Math.round(diff);
  } catch {
    return null;
  }
};

export const getLocalDateString = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getLogDate = (item: any): string => {
  if (item.operationalDate) {
    return String(item.operationalDate).split('T')[0];
  }
  const raw = item.timestampFinalEnd || item.timestampInitialEnd || item.timestampStart || item.timestampClearance || item.created_at || item.date;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return getLocalDateString(d);
    }
    return String(raw).split('T')[0];
  }
  return '';
};

export const RefuelingPerformance: React.FC<RefuelingPerformanceProps> = ({ user }) => {
  const { flightLogs, flightJobs, refreshData, isLoading, delayLogs, selectedBriefingDate } = useOperationalData();

  // Active View Tab: Performance Matrix vs AOCC Delay Records Log
  const [activeTab, setActiveTab] = useState<PerformanceTab>('TURNAROUND_MATRIX');

  // Fast map for detecting flights with AOCC delay logs
  const delayFlightMap = useMemo(() => {
    const map = new Map<string, any>();
    (delayLogs || []).forEach(d => {
      const cleanNo = d.flightNumber.replace(/\s+/g, '').toUpperCase();
      if (cleanNo) map.set(cleanNo, d);
    });
    return map;
  }, [delayLogs]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<CategoryFilter | null>(null);
  const [logRev, setLogRev] = useState(0);

  // Real-time synchronization across active operations
  useEffect(() => {
    const handleLogEvent = () => setLogRev(prev => prev + 1);
    window.addEventListener('fms:flight-log-created', handleLogEvent);
    window.addEventListener('fms:flight-log-updated', handleLogEvent);
    window.addEventListener('fms:flight-log-deleted', handleLogEvent);
    return () => {
      window.removeEventListener('fms:flight-log-created', handleLogEvent);
      window.removeEventListener('fms:flight-log-updated', handleLogEvent);
      window.removeEventListener('fms:flight-log-deleted', handleLogEvent);
    };
  }, []);

  // Quick refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Radio button slider references & states for Category and Date filters
  const categoryBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [categorySlider, setCategorySlider] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const dateBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [dateSlider, setDateSlider] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const updateSliders = useCallback(() => {
    const catIdx = CATEGORY_OPTIONS.findIndex(c => c.id === selectedCategory);
    const catBtn = categoryBtnRefs.current[catIdx];
    if (catBtn) {
      setCategorySlider({
        left: catBtn.offsetLeft,
        width: catBtn.offsetWidth,
        ready: true,
      });
    }

    const dateIdx = DATE_PRESET_OPTIONS.findIndex(p => p.id === datePreset);
    const dateBtn = dateBtnRefs.current[dateIdx];
    if (dateBtn) {
      setDateSlider({
        left: dateBtn.offsetLeft,
        width: dateBtn.offsetWidth,
        ready: true,
      });
    }
  }, [selectedCategory, datePreset]);

  useEffect(() => {
    updateSliders();
    const frame = requestAnimationFrame(updateSliders);
    const timer = setTimeout(updateSliders, 150);
    window.addEventListener('resize', updateSliders);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('resize', updateSliders);
    };
  }, [updateSliders]);

  // Merge flightLogs with corresponding flightJobs to resolve STD, TOBT, FRT, Clearance, and Category (O(N) indexed)
  const enrichedLogs = useMemo(() => {
    let allLogs = [...(flightLogs || [])];
    try {
      const rawCache = localStorage.getItem('fms_recent_flight_logs');
      if (rawCache) {
        const cachedLogs: FlightLog[] = JSON.parse(rawCache);
        if (Array.isArray(cachedLogs) && cachedLogs.length > 0) {
          const existingIds = new Set(allLogs.map(l => l.id));
          const existingDelivs = new Set(allLogs.filter(l => l.deliveryNumber).map(l => l.deliveryNumber));
          cachedLogs.forEach(cl => {
            if (!existingIds.has(cl.id) && (!cl.deliveryNumber || !existingDelivs.has(cl.deliveryNumber))) {
              allLogs.unshift(cl);
            }
          });
        }
      }
    } catch {}

    const rawLogs = allLogs.filter(l => !l.logType || l.logType.toUpperCase() === 'FLIGHT');

    // Index flightJobs into O(1) lookup Maps to eliminate redundant lookups
    const jobsByFlightAndDate = new Map<string, FlightJob>();
    const jobsByFlight = new Map<string, FlightJob>();

    (flightJobs || []).forEach(j => {
      if (j.flightNumber) {
        const fnUpper = j.flightNumber.replace(/\s+/g, '').toUpperCase();
        const d = (j.date || j.id.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '').split('T')[0];
        if (d) {
          jobsByFlightAndDate.set(`${fnUpper}__${d}`, j);
        }
        if (!jobsByFlight.has(fnUpper)) {
          jobsByFlight.set(fnUpper, j);
        }
      }
    });

    return rawLogs.map(log => {
      const fnUpper = (log.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      const opDate = (log.operationalDate || (log as any).date || '').split('T')[0];
      const matchingJob = (opDate ? jobsByFlightAndDate.get(`${fnUpper}__${opDate}`) : undefined) || jobsByFlight.get(fnUpper);

      const computedFuelEnd = log.timestampFinalEnd || log.timestampInitialEnd;
      const stdVal = log.std || matchingJob?.std || '';
      const tobtVal = log.tobt || matchingJob?.tobt || '';
      const clearanceVal = log.timestampClearance || matchingJob?.timestampClearance || '';

      // Determine Category: Ad-Hoc, Domestic, or International
      const isAdhoc = !!(log.isAdhoc || (matchingJob as any)?.isAdhoc || (log.co && /^C\/O-/i.test(log.co)));
      const isDomestic = !isAdhoc && !!(log.isDomestic || (matchingJob as any)?.isDomestic || log.intDom === 'DOM' || isDomesticFlight(log) || isDomesticFlight(matchingJob));
      const category: 'INTERNATIONAL' | 'DOMESTIC' | 'ADHOC' = isAdhoc ? 'ADHOC' : (isDomestic ? 'DOMESTIC' : 'INTERNATIONAL');

      // Target departure for GTE calculation: Use TOBT if given, else STD
      const targetDeparture = tobtVal || stdVal;
      const gte = calculateGTE(targetDeparture, clearanceVal);
      const cleanedRemarks = cleanRemarks(log.remarks || matchingJob?.remarks || '');

      return {
        ...log,
        airline: log.co || log.airline || (matchingJob as any)?.airline || (matchingJob as any)?.co || 'N/A',
        category,
        std: stdVal,
        tobt: tobtVal,
        frtAirline: log.frtAirline || matchingJob?.frtAirline || '',
        frtAocc: log.frtAocc || matchingJob?.frtAocc || '',
        frtFor: log.frtFor || matchingJob?.frtFor || '',
        fuelEnd: computedFuelEnd,
        timestampClearance: clearanceVal,
        targetDeparture,
        gte,
        remarks: cleanedRemarks,
      };
    });
  }, [flightLogs, flightJobs, logRev]);

  // Dynamic Date string anchors based on client's local date
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateString(d);
  }, []);
  const monthStartStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  // Step 1: Filter enriched logs by the active date preset / custom date range
  const dateFilteredLogs = useMemo(() => {
    return enrichedLogs.filter(item => {
      const logDate = getLogDate(item);
      const createdDate = item.created_at ? String(item.created_at).split('T')[0] : '';
      const rawTs = item.timestampClearance || item.timestampFinalEnd || item.timestampStart || item.timestampArrived;
      const timestampDate = rawTs ? getLocalDateString(new Date(rawTs)) : '';

      if (datePreset === 'TODAY') {
        const matchesToday = 
          (logDate && (
            logDate === todayStr || 
            (selectedBriefingDate && logDate === selectedBriefingDate)
          )) ||
          (createdDate && (createdDate === todayStr || (selectedBriefingDate && createdDate === selectedBriefingDate))) ||
          (timestampDate && (timestampDate === todayStr || (selectedBriefingDate && timestampDate === selectedBriefingDate)));
        if (!matchesToday) return false;
      } else if (datePreset === 'YESTERDAY') {
        if (logDate && logDate !== yesterdayStr) return false;
      } else if (datePreset === 'LAST_7_DAYS') {
        if (logDate && (logDate < sevenDaysAgoStr || logDate > todayStr)) return false;
      } else if (datePreset === 'THIS_MONTH') {
        if (logDate && (logDate < monthStartStr || logDate > todayStr)) return false;
      } else if (datePreset === 'ALL') {
        return true;
      } else if (datePreset === 'CUSTOM') {
        if (customStartDate && logDate && logDate < customStartDate) return false;
        if (customEndDate && logDate && logDate > customEndDate) return false;
      }
      return true;
    });
  }, [enrichedLogs, datePreset, todayStr, yesterdayStr, sevenDaysAgoStr, monthStartStr, customStartDate, customEndDate, selectedBriefingDate]);

  // Step 2: Category counts based on the active date filter!
  // When TODAY is selected, ALL / INT / DOM / AD-HOC will count TODAY's flights!
  const categoryCounts = useMemo(() => {
    let intl = 0;
    let dom = 0;
    let adhoc = 0;
    dateFilteredLogs.forEach(item => {
      if (item.category === 'INTERNATIONAL') intl++;
      else if (item.category === 'DOMESTIC') dom++;
      else if (item.category === 'ADHOC') adhoc++;
    });
    return { all: dateFilteredLogs.length, intl, dom, adhoc };
  }, [dateFilteredLogs]);

  // Unique Airline options for active date window
  const airlineOptions = useMemo(() => {
    const set = new Set<string>();
    dateFilteredLogs.forEach(l => {
      if (l.airline && l.airline !== 'N/A') set.add(l.airline);
    });
    return Array.from(set).sort();
  }, [dateFilteredLogs]);

  // Step 3: Apply Search Query, Category Filter, and Airline Filter
  const filteredData = useMemo(() => {
    return dateFilteredLogs.filter(item => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAirline = (item.airline || '').toLowerCase().includes(q);
        const matchFlight = (item.flightNumber || '').toLowerCase().includes(q);
        const matchReg = (item.aircraftReg || '').toLowerCase().includes(q);
        const matchRemarks = (item.remarks || '').toLowerCase().includes(q);
        if (!matchAirline && !matchFlight && !matchReg && !matchRemarks) {
          return false;
        }
      }

      // 2. Category Filter (International, Domestic, Ad-Hoc)
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // 3. Airline Filter
      if (selectedAirline !== 'ALL' && item.airline !== selectedAirline) {
        return false;
      }

      return true;
    });
  }, [dateFilteredLogs, searchQuery, selectedCategory, selectedAirline]);

  // Pagination State (Solves performance bottleneck & lag on large datasets)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedAirline, datePreset, customStartDate, customEndDate]);

  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredData.length / pageSize));

  const paginatedData = useMemo(() => {
    if (pageSize === 'ALL') return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalPumpingMins = 0;
    let validPumpingCount = 0;

    let totalClearanceMins = 0;
    let validClearanceCount = 0;

    let savedCount = 0;
    let exceededCount = 0;
    let tightCount = 0;

    let intlCount = 0;
    let domCount = 0;
    let adhocCount = 0;

    filteredData.forEach(item => {
      if (item.category === 'INTERNATIONAL') intlCount++;
      else if (item.category === 'DOMESTIC') domCount++;
      else if (item.category === 'ADHOC') adhocCount++;

      // Pumping duration: timestampStart to fuelEnd
      if (item.timestampStart && item.fuelEnd) {
        const diff = getMinutesBetween(item.timestampStart, item.fuelEnd);
        if (diff !== null && diff > 0 && diff < 300) {
          totalPumpingMins += diff;
          validPumpingCount++;
        }
      }

      // Clearance turnaround: fuelEnd to timestampClearance
      if (item.fuelEnd && item.timestampClearance) {
        const diff = getMinutesBetween(item.fuelEnd, item.timestampClearance);
        if (diff !== null && diff >= 0 && diff < 180) {
          totalClearanceMins += diff;
          validClearanceCount++;
        }
      }

      // GTE Performance
      if (item.gte.minutes !== null) {
        if (item.gte.isExceeded) {
          exceededCount++;
        } else {
          savedCount++;
          if (item.gte.isTight) {
            tightCount++;
          }
        }
      }
    });

    const totalWithGte = savedCount + exceededCount;
    const gteAdherenceRate = totalWithGte > 0 ? Math.round((savedCount / totalWithGte) * 100) : 100;
    const avgPumping = validPumpingCount > 0 ? Math.round(totalPumpingMins / validPumpingCount) : 0;
    const avgClearance = validClearanceCount > 0 ? Math.round(totalClearanceMins / validClearanceCount) : 0;

    return {
      totalFlights: filteredData.length,
      intlCount,
      domCount,
      adhocCount,
      savedCount,
      exceededCount,
      tightCount,
      totalWithGte,
      gteAdherenceRate,
      avgPumping,
      avgClearance,
    };
  }, [filteredData]);

  // Export CSV Handler including GTE and STATUS columns
  const handleExportCSV = () => {
    const headers = [
      'AIRLINE',
      'FLIGHT',
      'CATEGORY',
      'STD',
      'TOBT',
      'FRT AIRLINE',
      'FRT AOCC',
      'FRT FOR',
      'ARRIVED',
      'POSITIONED',
      'INITIAL SET',
      'INITIAL END',
      'FINAL SET',
      'FINAL END',
      'FUEL END',
      'CLEARANCE',
      'GTE',
      'STATUS',
      'REMARKS'
    ];

    const rows = filteredData.map(item => {
      const fuelEndTime = formatDisplayTime(item.fuelEnd);
      return [
        item.airline || 'N/A',
        item.flightNumber || 'N/A',
        item.category,
        item.std || '--:--',
        item.tobt || '--:--',
        item.frtAirline || '--:--',
        item.frtAocc || '--:--',
        item.frtFor || '--:--',
        formatDisplayTime(item.timestampArrived),
        formatDisplayTime(item.timestampPosition),
        formatDisplayTime(item.timestampStart),
        formatDisplayTime(item.timestampInitialEnd),
        formatDisplayTime(item.timestampFinalStart),
        formatDisplayTime(item.timestampFinalEnd),
        fuelEndTime,
        formatDisplayTime(item.timestampClearance),
        item.gte.display,
        item.gte.status,
        (item.remarks || '').replace(/"/g, '""')
      ].map(val => `"${val}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Refueling_Performance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="card-premium p-6 sm:p-8 border-outline flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-premium">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                  Aviation Into-Plane Analytics
                </span>
                <span className="px-2 py-0.5 rounded-md bg-success/15 text-success border border-success/20 text-[9px] font-black tracking-widest uppercase">
                  Audited Live
                </span>
                <span 
                  className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/20 text-[9px] font-black tracking-widest uppercase cursor-help hidden sm:inline-flex"
                  title="Showing active cached operational dataset (latest 10,000 records dynamically loaded from the 137k+ BigQuery historical archive for maximum client speed)"
                >
                  {enrichedLogs.length.toLocaleString()} Active Cached (137k+ BigQuery)
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-[900] text-on-surface tracking-tighter uppercase italic">
                Refuelling <span className="text-primary">Performance</span>
              </h1>
            </div>
          </div>
          <p className="text-xs font-bold text-on-surface-dim opacity-70 max-w-2xl">
            Real-time compliance monitoring for Target Off-Block Times (TOBT), Fuel Request Times (FRT), Ground Time Exceeded (GTE) duration, and turnaround telemetry.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 z-10 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="px-4 py-2.5 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl text-xs font-black uppercase tracking-wider text-on-surface flex items-center gap-2 transition-all active:scale-95"
            title="Refresh logs from database"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span>Sync</span>
          </button>

          {activeTab === 'TURNAROUND_MATRIX' && (
            <button
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="px-5 py-2.5 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-premium hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Tab Switcher: Turnaround Matrix vs AOCC Delay Records Log */}
      <div className="flex items-center gap-2 p-1.5 bg-surface-dim/60 border border-outline rounded-2xl w-full sm:w-fit backdrop-blur-sm">
        <button
          type="button"
          onClick={() => {
            haptic('TAP');
            setActiveTab('TURNAROUND_MATRIX');
          }}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'TURNAROUND_MATRIX'
              ? 'kinetic-gradient text-white shadow-premium'
              : 'text-on-surface-dim hover:text-on-surface font-bold'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Turnaround Matrix</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
            activeTab === 'TURNAROUND_MATRIX' ? 'bg-black/20 text-white' : 'bg-surface text-on-surface-dim border border-outline/40'
          }`}>
            {filteredData.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic('TAP');
            setActiveTab('DELAY_LOGS');
          }}
          className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'DELAY_LOGS'
              ? 'kinetic-gradient text-white shadow-premium'
              : 'text-on-surface-dim hover:text-on-surface font-bold'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>AOCC Delay Records Log</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
            activeTab === 'DELAY_LOGS' ? 'bg-black/20 text-white' : 'bg-surface text-on-surface-dim border border-outline/40'
          }`}>
            {(delayLogs || []).length}
          </span>
        </button>
      </div>

      {activeTab === 'TURNAROUND_MATRIX' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Flights */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Total Refueled
            </span>
            <div className="text-3xl font-[900] font-mono text-on-surface tracking-tight">
              {kpis.totalFlights}
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-60">
              Intl: {kpis.intlCount} • Dom: {kpis.domCount} • Ad-Hoc: {kpis.adhocCount}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Plane className="w-6 h-6" />
          </div>
        </div>

        {/* Ground Time Saved vs Exceeded */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Ground Time Status
            </span>
            <div className="text-3xl font-[900] font-mono text-success tracking-tight flex items-baseline gap-2">
              <span>{kpis.savedCount}</span>
              <span className="text-xs font-sans font-bold text-success/80 uppercase">Saved</span>
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-60">
              {kpis.exceededCount > 0 ? (
                <span className="text-error font-black">{kpis.exceededCount} Exceeded Ground Time</span>
              ) : (
                <span>Zero ground time overruns</span>
              )}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
            kpis.exceededCount > 0 
              ? 'bg-error/10 text-error border-error/20' 
              : 'bg-success/10 text-success border-success/20'
          }`}>
            {kpis.exceededCount > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
          </div>
        </div>

        {/* GTE Adherence / On-Time Clearance */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              GTE On-Time Rate
            </span>
            <div className={`text-3xl font-[900] font-mono tracking-tight ${
              kpis.gteAdherenceRate >= 90 ? 'text-success' : kpis.gteAdherenceRate >= 75 ? 'text-warning' : 'text-error'
            }`}>
              {kpis.gteAdherenceRate}%
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-60">
              {kpis.tightCount > 0 ? `${kpis.tightCount} tight (<20m buffer)` : 'Cleared on schedule'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center border border-warning/20">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Average Pumping Duration */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Avg Pumping Time
            </span>
            <div className="text-3xl font-[900] font-mono text-primary tracking-tight">
              {kpis.avgPumping} <span className="text-sm font-sans font-bold text-on-surface-dim">min</span>
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-50">
              Avg Clearance: {kpis.avgClearance} min
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Timer className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="card-premium p-4 sm:p-5 border-outline space-y-3 sm:space-y-4">
        {/* Row 1: Search Bar & Category Filter Tabs & Airline Select */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
          {/* Search bar */}
          <div className="relative w-full xl:flex-1 xl:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flight #, airline, reg, remarks..."
              className="w-full pl-11 pr-4 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface placeholder:text-on-surface-dim/40 focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Controls: Category Filter Tabs & Airline Select */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Category Filter Tabs with Animated Radio Kinetic Slider */}
            <div 
              className="relative flex items-center bg-surface-dim/90 p-1 rounded-2xl border border-outline shadow-inner select-none w-full sm:w-auto shrink-0"
            >
              {/* Animated Kinetic Gradient Radio Slider */}
              {categorySlider.ready && (
                <div 
                  className="absolute top-1 bottom-1 rounded-xl kinetic-gradient shadow-premium transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform pointer-events-none"
                  style={{
                    left: `${categorySlider.left}px`,
                    width: `${categorySlider.width}px`,
                  }}
                />
              )}

              {CATEGORY_OPTIONS.map((cat, idx) => {
                const isSelected = selectedCategory === cat.id;
                const IconComponent = cat.icon;
                const count = 
                  cat.id === 'ALL' ? categoryCounts.all :
                  cat.id === 'INTERNATIONAL' ? categoryCounts.intl :
                  cat.id === 'DOMESTIC' ? categoryCounts.dom : categoryCounts.adhoc;
                const isHovered = hoveredCat === cat.id;

                return (
                  <button
                    key={cat.id}
                    ref={el => { categoryBtnRefs.current[idx] = el; }}
                    type="button"
                    onClick={() => {
                      haptic('TAP');
                      setSelectedCategory(cat.id);
                      setHoveredCat(cat.id);
                      setTimeout(() => setHoveredCat(null), 1500);
                    }}
                    onMouseEnter={() => setHoveredCat(cat.id)}
                    onMouseLeave={() => setHoveredCat(null)}
                    onTouchStart={() => setHoveredCat(cat.id)}
                    onTouchEnd={() => setTimeout(() => setHoveredCat(null), 1500)}
                    className={`group relative z-10 flex-1 sm:flex-initial px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 select-none ${
                      isSelected
                        ? 'text-white'
                        : 'text-on-surface-dim hover:text-on-surface'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{cat.label}</span>
                    <span className={`hidden sm:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-mono transition-colors ${
                      isSelected 
                        ? 'bg-black/25 text-white font-black' 
                        : 'bg-surface text-on-surface-dim border border-outline/50'
                    }`}>
                      {count}
                    </span>

                    {/* Mobile Tooltip (Floating Popover) */}
                    <div 
                      className={`absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-surface-container text-on-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xl pointer-events-none transition-all duration-150 z-50 flex items-center gap-1.5 sm:hidden ${
                        isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95 pointer-events-none'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className="text-primary font-mono font-bold">({count})</span>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface-container border-r border-b border-outline rotate-45" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Airline Select Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <Filter className="w-4 h-4 text-on-surface-dim opacity-50 shrink-0" />
              <select
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer uppercase"
              >
                <option value="ALL">All Airlines ({airlineOptions.length})</option>
                {airlineOptions.map(airline => (
                  <option key={airline} value={airline}>
                    {airline}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Date Presets & Custom Range with Animated Radio Kinetic Slider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-outline/50">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-50 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" /> DATE:
            </span>

            {/* Date Preset Radio Button Segmented Control */}
            <div 
              className="relative flex items-center bg-surface-dim/90 p-1 rounded-2xl border border-outline shadow-inner select-none overflow-x-auto scrollbar-none w-full sm:w-auto"
            >
              {/* Animated Kinetic Gradient Radio Slider */}
              {dateSlider.ready && (
                <div 
                  className="absolute top-1 bottom-1 rounded-xl kinetic-gradient shadow-premium transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform pointer-events-none"
                  style={{
                    left: `${dateSlider.left}px`,
                    width: `${dateSlider.width}px`,
                  }}
                />
              )}

              {DATE_PRESET_OPTIONS.map((preset, idx) => {
                const isSelected = datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    ref={el => { dateBtnRefs.current[idx] = el; }}
                    type="button"
                    onClick={() => {
                      haptic('TAP');
                      setDatePreset(preset.id);
                    }}
                    className={`relative z-10 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors duration-200 whitespace-nowrap cursor-pointer active:scale-95 select-none ${
                      isSelected
                        ? 'text-white font-black'
                        : 'text-on-surface-dim hover:text-on-surface font-bold'
                    }`}
                  >
                    <span className="sm:hidden">{preset.shortLabel}</span>
                    <span className="hidden sm:inline">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {datePreset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3 animate-in fade-in duration-200 w-full sm:w-auto">
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Matrix Table with GTE and STATUS columns */}
      <div className="card-premium border-outline overflow-hidden shadow-premium">
        <div className="p-4 bg-surface-dim/40 border-b border-outline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-on-surface">
              Performance Matrix
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-dim text-[10px] font-mono font-bold text-on-surface-dim border border-outline">
              {filteredData.length} records
            </span>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-on-surface-dim opacity-70">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success"></span> SAVED
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> &lt;20m Buffer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error"></span> EXCEEDED (Minus)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1350px]">
            <thead>
              <tr className="bg-surface-container/60 border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                <th className="px-4 py-3.5 sticky left-0 bg-surface-container z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">FLIGHT</th>
                <th className="px-3 py-3.5 text-center bg-warning/5 text-warning font-black">STD</th>
                <th className="px-3 py-3.5 text-center bg-primary/5 text-primary font-black">TOBT</th>
                <th className="px-3 py-3.5 text-center">FRT AIRLINE</th>
                <th className="px-3 py-3.5 text-center">FRT AOCC</th>
                <th className="px-3 py-3.5 text-center font-black text-primary">FRT FOR</th>
                <th className="px-3 py-3.5 text-center">ARRIVED</th>
                <th className="px-3 py-3.5 text-center">POSITIONED</th>
                <th className="px-3 py-3.5 text-center text-success font-black">INITIAL SET</th>
                <th className="px-3 py-3.5 text-center">INITIAL END</th>
                <th className="px-3 py-3.5 text-center">FINAL SET</th>
                <th className="px-3 py-3.5 text-center text-error font-black">FINAL END</th>
                <th className="px-3 py-3.5 text-center bg-error/5 text-error font-black">FUEL END</th>
                <th className="px-3 py-3.5 text-center bg-primary/5 text-primary font-black">CLEARANCE</th>
                <th className="px-3 py-3.5 text-center font-black bg-surface-container/80 text-on-surface border-x border-outline/60" title="Ground Time Exceeded buffer (Target Departure minus Clearance)">
                  GTE
                </th>
                <th className="px-3 py-3.5 text-center font-black bg-surface-container/80 text-on-surface border-r border-outline/60">
                  STATUS
                </th>
                <th className="px-5 py-3.5 min-w-[180px]">REMARKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline text-xs">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-6 py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-3">
                      <AlertCircle className="w-10 h-10 text-on-surface-dim opacity-30 mx-auto" />
                      <p className="text-xs font-black uppercase tracking-widest text-on-surface-dim">
                        No flight records found matching filters
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedAirline('ALL');
                          setSelectedCategory('ALL');
                          setDatePreset('ALL');
                        }}
                        className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wider hover-kinetic-gradient active:scale-95 transition-all"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const fuelEndTime = formatDisplayTime(item.fuelEnd);
                  const clearanceTime = formatDisplayTime(item.timestampClearance);
                  const isVoid = String(item.intDom || '').toUpperCase() === 'VOID' || String(item.remarks || '').toUpperCase().includes('CANCELLED');
                  const delayReport = delayFlightMap.get(item.flightNumber.replace(/\s+/g, '').toUpperCase());

                  return (
                    <tr 
                      key={item.id || idx} 
                      className={`hover:bg-primary/[0.03] transition-colors ${
                        item.gte.isExceeded 
                          ? 'bg-error/[0.03]' 
                          : idx % 2 === 0 ? 'bg-surface/30' : 'bg-surface-dim/20'
                      }`}
                    >
                      {/* 1. FLIGHT with Airline Tooltip + conditional Category Badge (Sticky column) */}
                      <td className="px-4 py-3.5 sticky left-0 bg-surface z-10 hover:z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                          <div className="group/airline relative inline-flex items-center">
                            <span 
                              className="font-mono font-[900] tracking-tight text-primary uppercase cursor-pointer hover:text-primary-light transition-colors"
                            >
                              {item.flightNumber}
                            </span>
                            {/* Airline Tooltip Popover - Opens below so it never goes behind the sticky table header */}
                            <div className="absolute top-full left-0 mt-1.5 hidden group-hover/airline:flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container text-on-surface border border-outline rounded-lg text-[10px] font-bold shadow-2xl pointer-events-none z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
                              <div className="absolute -top-1 left-3 w-1.5 h-1.5 bg-surface-container border-l border-t border-outline rotate-45" />
                              <span className="text-on-surface-dim opacity-70 text-[9px] uppercase tracking-wider">Airline:</span>
                              <span className="text-primary font-black uppercase">{item.airline || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Only show category badge when viewing ALL categories */}
                          {selectedCategory === 'ALL' && (
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-sans font-black tracking-wider uppercase ${
                              item.category === 'ADHOC'
                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                : item.category === 'DOMESTIC'
                                  ? 'bg-success/15 text-success border border-success/25'
                                  : 'bg-primary/15 text-primary border border-primary/25'
                            }`}>
                              {item.category === 'ADHOC' ? 'ADHOC' : item.category === 'DOMESTIC' ? 'DOM' : 'INT'}
                            </span>
                          )}

                          {/* AOCC Delay Logged Badge indicator */}
                          {delayReport && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('DELAY_LOGS');
                                setSearchQuery(item.flightNumber);
                              }}
                              className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 transition-all inline-flex items-center gap-1 cursor-pointer"
                              title={`AOCC Delay Logged (Code ${delayReport.delayCode || 'N/A'}) - Click to view`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>DELAY</span>
                            </button>
                          )}

                          {isVoid && (
                            <span className="px-1 py-0.2 rounded text-[8px] bg-error/15 text-error font-sans font-black">
                              VOID
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. STD */}
                      <td className="px-3 py-3.5 font-mono text-center font-black text-warning bg-warning/5">
                        {item.std || '--:--'}
                      </td>

                      {/* 3. TOBT */}
                      <td className="px-3 py-3.5 font-mono text-center font-black text-primary bg-primary/5">
                        {item.tobt || '--:--'}
                      </td>

                      {/* 4. FRT AIRLINE */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface-dim">
                        {item.frtAirline || '--:--'}
                      </td>

                      {/* 5. FRT AOCC */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface-dim">
                        {item.frtAocc || '--:--'}
                      </td>

                      {/* 6. FRT FOR */}
                      <td className="px-3 py-3.5 font-mono text-center font-bold text-primary">
                        {item.frtFor || '--:--'}
                      </td>

                      {/* 7. ARRIVED */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface">
                        {formatDisplayTime(item.timestampArrived)}
                      </td>

                      {/* 8. POSITIONED */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface">
                        {formatDisplayTime(item.timestampPosition)}
                      </td>

                      {/* 9. INITIAL SET */}
                      <td className="px-3 py-3.5 font-mono text-center font-bold text-success">
                        {formatDisplayTime(item.timestampStart)}
                      </td>

                      {/* 10. INITIAL END */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface-dim">
                        {formatDisplayTime(item.timestampInitialEnd)}
                      </td>

                      {/* 11. FINAL SET */}
                      <td className="px-3 py-3.5 font-mono text-center text-on-surface-dim">
                        {formatDisplayTime(item.timestampFinalStart)}
                      </td>

                      {/* 12. FINAL END */}
                      <td className="px-3 py-3.5 font-mono text-center font-bold text-error">
                        {formatDisplayTime(item.timestampFinalEnd)}
                      </td>

                      {/* 13. FUEL END */}
                      <td className="px-3 py-3.5 font-mono text-center font-[900] text-error bg-error/5">
                        {fuelEndTime}
                      </td>

                      {/* 14. CLEARANCE */}
                      <td className="px-3 py-3.5 font-mono text-center font-black text-primary bg-primary/5">
                        {clearanceTime}
                      </td>

                      {/* 15. GTE (Ground Time Exceeded buffer) */}
                      <td className="px-3 py-3.5 font-mono text-center border-l border-outline/50 bg-surface-container/30">
                        {item.gte.minutes === null ? (
                          <span className="text-on-surface-dim opacity-40 font-mono text-xs">--:--</span>
                        ) : (
                          <span 
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono inline-block font-black transition-all ${
                              item.gte.isExceeded 
                                ? 'bg-error/20 text-error border border-error/40 shadow-sm' 
                                : item.gte.isTight
                                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                  : 'text-success font-bold bg-success/10 border border-success/20'
                            }`}
                            title={`Target Departure: ${item.targetDeparture || 'N/A'} | Clearance: ${clearanceTime} | Buffer: ${item.gte.minutes}m`}
                          >
                            {item.gte.display}
                          </span>
                        )}
                      </td>

                      {/* 16. STATUS (SAVED or EXCEEDED) */}
                      <td className="px-3 py-3.5 text-center border-r border-outline/50 bg-surface-container/30">
                        {item.gte.status === '--' ? (
                          <span className="text-on-surface-dim opacity-40 font-mono text-xs">--</span>
                        ) : item.gte.status === 'EXCEEDED' ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-error/15 text-error border border-error/30 shadow-sm inline-flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            EXCEEDED
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-success/15 text-success border border-success/30 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            SAVED
                          </span>
                        )}
                      </td>

                      {/* 17. REMARKS */}
                      <td className="px-5 py-3.5 text-xs text-on-surface-dim">
                        <span className="line-clamp-2 max-w-xs" title={item.remarks}>
                          {item.remarks || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-surface-dim/40 border-t border-outline flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-on-surface-dim">
            <span>
              Showing <strong className="text-on-surface">{filteredData.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'ALL' ? filteredData.length : pageSize) + 1}</strong> to{' '}
              <strong className="text-on-surface">
                {pageSize === 'ALL' ? filteredData.length : Math.min(currentPage * pageSize, filteredData.length)}
              </strong>{' '}
              of <strong className="text-primary font-bold">{filteredData.length.toLocaleString()}</strong> records
            </span>
            <div className="flex items-center gap-1.5 ml-2 border-l border-outline/50 pl-3">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-surface-dim border border-outline rounded-lg text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="ALL">All</option>
              </select>
            </div>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-outline bg-surface-dim hover:bg-surface text-on-surface-dim hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-outline bg-surface-dim hover:bg-surface text-on-surface-dim hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-bold text-on-surface font-mono">
                Page <span className="text-primary font-black">{currentPage}</span> of{' '}
                <span className="font-black">{totalPages}</span>
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-outline bg-surface-dim hover:bg-surface text-on-surface-dim hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-outline bg-surface-dim hover:bg-surface text-on-surface-dim hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  ) : (
    <DelayRecordsLog
      user={user}
      onInspectFlightInMatrix={(flightNum) => {
        setActiveTab('TURNAROUND_MATRIX');
        setSearchQuery(flightNum);
      }}
    />
  )}
</div>
);
};
