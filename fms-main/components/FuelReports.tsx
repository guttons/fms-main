import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, Download, Calendar, Search, ShieldCheck, RefreshCw, 
  Layers, TrendingUp, TrendingDown, ClipboardList, Anchor, 
  Database, User as UserIcon, X, PlusCircle, CheckCircle, BarChart2,
  Droplet, Fuel, Info
} from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { FuelType, FlightLog, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area, ComposedChart, LineChart, Line } from 'recharts';
import { lookupDipSync, preloadCalibrationData } from '../services/calibrationService';

interface FuelReportsProps {
  user?: User | null;
}

interface ReconciliationLog {
  date: string;
  product: FuelType;
  computerStock: number;
  physicalDip: number;
  variance: number;
  operator: string;
}

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, '${d.getFullYear().toString().substring(2)}`;
};

const CustomScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const volStr = data.y.toLocaleString();
    const durationStr = data.x;
    const airlineName = data.airline || '';
    const flightNo = data.name || '';
    const dateStr = data.date ? ` on ${data.date}` : '';
    
    const labelText = airlineName && flightNo 
      ? `${airlineName} (${flightNo})`
      : (airlineName || flightNo || 'Transaction');

    return (
      <div className="bg-[#1e293b]/95 text-white px-3 py-2 rounded-xl text-xs font-sans flex items-center gap-2 border border-outline shadow-premium backdrop-blur-md">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: payload[0].color || '#f59e0b' }} />
        <span className="font-extrabold uppercase tracking-wide">
          {labelText}: <span className="font-mono text-white">{volStr} L</span> in <span className="font-mono text-white">{durationStr} mins</span>{dateStr}
        </span>
      </div>
    );
  }
  return null;
};

export const FuelReports: React.FC<FuelReportsProps> = ({ user }) => {
  const { flightLogs, tanks, equipment } = useOperationalData();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'sales' | 'shipments' | 'reconciliation'>('sales');
  
  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('06');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Facility for Stock Summary breakdown
  const [selectedFacility, setSelectedFacility] = useState<'NFF' | 'OFF' | 'SP' | 'FS' | 'MOBILE'>('NFF');

  // Selected Report Date for Stock Summary
  const [stockReportDate, setStockReportDate] = useState<string>('2026-06-30');

  // Fuel Sales sub-tab selection (Jet A-1 vs Diesel & Petrol Combined)
  const [salesFuelType, setSalesFuelType] = useState<'JET_A1' | 'GROUND_FUELS'>('JET_A1');

  // Turnaround View selection (Individual Flights vs Aggregate Avg.)
  const [turnaroundViewJet, setTurnaroundViewJet] = useState<'individual' | 'aggregate'>('individual');
  const [turnaroundViewGround, setTurnaroundViewGround] = useState<'individual' | 'aggregate'>('individual');

  // JET A-1 specific filter states
  const [startDateJet, setStartDateJet] = useState<string>('2026-04-14');
  const [endDateJet, setEndDateJet] = useState<string>('2026-07-14');
  const [compareJet, setCompareJet] = useState<string>('Previous Year');
  const [categoryJet, setCategoryJet] = useState<string>('All Categories');
  const [dayOfWeekJet, setDayOfWeekJet] = useState<string>('All Weekdays');
  const [airlineJet, setAirlineJet] = useState<string>('All Airlines');
  const [flightNoJet, setFlightNoJet] = useState<string>('');

  // DIESEL & PETROL specific filter states
  const [startDateGround, setStartDateGround] = useState<string>('2026-04-14');
  const [endDateGround, setEndDateGround] = useState<string>('2026-07-14');
  const [compareGround, setCompareGround] = useState<string>('Previous Year');
  const [fuelGradeGround, setFuelGradeGround] = useState<string>('All Grades');
  const [facilityGround, setFacilityGround] = useState<string>('All Facilities');
  const [deptGround, setDeptGround] = useState<string>('All Departments');
  const [searchGround, setSearchGround] = useState<string>('');

  // Unique list of airlines populated from actual flightLogs
  const uniqueAirlines = useMemo(() => {
    const set = new Set<string>();
    (flightLogs || []).forEach(l => {
      if (l.airline && !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL')) {
        set.add(l.airline.toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [flightLogs]);

  // JET A-1 Dashboard Dataset Generator
  const jetData = useMemo(() => {
    const start = new Date(startDateJet);
    const end = new Date(endDateJet);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 90;

    const getLogCategory = (l: FlightLog) => {
      const airlineUpper = (l.airline || '').toUpperCase();
      const isSea = l.logType === 'SEAPLANE' || (l.flightNumber || '').startsWith('SEAPLANE');

      if (isSea) {
        return 'Seaplane';
      } else if (airlineUpper.startsWith('EXTRA / ADHOC FLIGHTS')) {
        return l.isDomestic ? 'Ad-hoc Dom' : 'Ad-hoc Int';
      } else if (airlineUpper.startsWith('LOCAL SALES / OTHERS')) {
        return 'Local Sales';
      } else if (l.isDomestic) {
        return 'Domestic';
      } else {
        return 'International';
      }
    };
    
    const filteredLogs = (flightLogs || []).filter(l => {
      const isJet = !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL') && (l.logType === 'FLIGHT' || l.logType === 'SEAPLANE' || !l.logType);
      if (!isJet) return false;

      if (l.operationalDate) {
        const logDate = new Date(l.operationalDate);
        if (logDate < start || logDate > end) return false;
      }

      const logCategory = getLogCategory(l);
      if (categoryJet !== 'All Categories') {
        if (logCategory !== categoryJet) return false;
      }

      if (airlineJet !== 'All Airlines') {
        if (l.airline?.toUpperCase() !== airlineJet.toUpperCase()) return false;
      }

      if (flightNoJet.trim() !== '') {
        if (!l.flightNumber.toLowerCase().includes(flightNoJet.toLowerCase())) return false;
      }

      if (dayOfWeekJet !== 'All Weekdays') {
        if (l.operationalDate) {
          const logDate = new Date(l.operationalDate);
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = days[logDate.getDay()];
          if (dayName !== dayOfWeekJet) return false;
        }
      }

      return true;
    });

    const totalVolume = filteredLogs.reduce((acc, l) => acc + (l.volume || 0), 0);
    const international = filteredLogs.filter(l => getLogCategory(l) === 'International').reduce((acc, l) => acc + (l.volume || 0), 0);
    const domestic = filteredLogs.filter(l => getLogCategory(l) === 'Domestic').reduce((acc, l) => acc + (l.volume || 0), 0);
    const adhocInt = filteredLogs.filter(l => getLogCategory(l) === 'Ad-hoc Int').reduce((acc, l) => acc + (l.volume || 0), 0);
    const adhocDom = filteredLogs.filter(l => getLogCategory(l) === 'Ad-hoc Dom').reduce((acc, l) => acc + (l.volume || 0), 0);
    const seaplane = filteredLogs.filter(l => getLogCategory(l) === 'Seaplane').reduce((acc, l) => acc + (l.volume || 0), 0);
    const localSales = filteredLogs.filter(l => getLogCategory(l) === 'Local Sales').reduce((acc, l) => acc + (l.volume || 0), 0);

    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - diffDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    const prevLogs = (flightLogs || []).filter(l => {
      const isJet = !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL') && (l.logType === 'FLIGHT' || l.logType === 'SEAPLANE' || !l.logType);
      if (!isJet) return false;
      if (l.operationalDate) {
        const logDate = new Date(l.operationalDate);
        if (logDate < prevStart || logDate > prevEnd) return false;
      } else {
        return false;
      }
      
      const logCategory = getLogCategory(l);
      if (categoryJet !== 'All Categories') {
        if (logCategory !== categoryJet) return false;
      }
      if (airlineJet !== 'All Airlines') {
        if (l.airline?.toUpperCase() !== airlineJet.toUpperCase()) return false;
      }
      if (flightNoJet.trim() !== '') {
        if (!l.flightNumber.toLowerCase().includes(flightNoJet.toLowerCase())) return false;
      }
      if (dayOfWeekJet !== 'All Weekdays') {
        if (l.operationalDate) {
          const logDate = new Date(l.operationalDate);
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = days[logDate.getDay()];
          if (dayName !== dayOfWeekJet) return false;
        }
      }
      return true;
    });

    const prevTotalVolume = prevLogs.reduce((acc, l) => acc + (l.volume || 0), 0);
    const volumeGrowth = prevTotalVolume > 0 ? parseFloat((((totalVolume - prevTotalVolume) / prevTotalVolume) * 100).toFixed(1)) : 0.0;

    const currentRefuels = filteredLogs.length;
    const prevRefuels = prevLogs.length;
    const refuelingCountGrowth = prevRefuels > 0 ? parseFloat((((currentRefuels - prevRefuels) / prevRefuels) * 100).toFixed(1)) : 0.0;

    const currentAvg = currentRefuels > 0 ? Math.round(totalVolume / currentRefuels) : 0;
    const prevAvg = prevRefuels > 0 ? Math.round(prevTotalVolume / prevRefuels) : 0;
    const avgVolumeGrowth = prevAvg > 0 ? parseFloat((((currentAvg - prevAvg) / prevAvg) * 100).toFixed(1)) : 0.0;

    const groupVolByDate = (logs: FlightLog[]) => {
      const m: { [date: string]: number } = {};
      logs.forEach(l => {
        const d = l.operationalDate || 'Unknown';
        m[d] = (m[d] || 0) + (l.volume || 0);
      });
      return m;
    };
    const currentDays = groupVolByDate(filteredLogs);
    const prevDays = groupVolByDate(prevLogs);
    const currentPeak = Object.values(currentDays).length > 0 ? Math.max(...Object.values(currentDays)) : 0;
    const prevPeak = Object.values(prevDays).length > 0 ? Math.max(...Object.values(prevDays)) : 0;
    const peakSingleDayGrowth = prevPeak > 0 ? parseFloat((((currentPeak - prevPeak) / prevPeak) * 100).toFixed(1)) : 0.0;

    const getLogDuration = (l: FlightLog) => {
      const startMs = l.timestampStart ? new Date(l.timestampStart).getTime() : 0;
      const endMs = l.timestampFinalEnd ? new Date(l.timestampFinalEnd).getTime() : (l.timestampInitialEnd ? new Date(l.timestampInitialEnd).getTime() : 0);
      let duration = startMs && endMs ? Math.round((endMs - startMs) / (1000 * 60)) : 0;
      if (duration <= 0 || duration > 240) {
        duration = Math.round(15 + (l.volume / 1000));
      }
      return duration;
    };

    const getLogOccupiedTime = (l: FlightLog) => {
      const startMs = l.timestampArrived ? new Date(l.timestampArrived).getTime() : 0;
      const endMs = l.timestampClearance ? new Date(l.timestampClearance).getTime() : 0;
      let duration = startMs && endMs ? Math.round((endMs - startMs) / (1000 * 60)) : 0;
      if (duration <= 0 || duration > 300) {
        duration = getLogDuration(l) + 12;
      }
      return duration;
    };

    const currentTotalRefuelTime = filteredLogs.reduce((acc, l) => acc + getLogDuration(l), 0);
    const currentAvgRefuelTime = currentRefuels > 0 ? parseFloat((currentTotalRefuelTime / currentRefuels).toFixed(1)) : 0;
    const prevTotalRefuelTime = prevLogs.reduce((acc, l) => acc + getLogDuration(l), 0);
    const prevAvgRefuelTime = prevRefuels > 0 ? parseFloat((prevTotalRefuelTime / prevRefuels).toFixed(1)) : 0;
    const refuelingTimeGrowth = prevAvgRefuelTime > 0 ? parseFloat((((currentAvgRefuelTime - prevAvgRefuelTime) / prevAvgRefuelTime) * 100).toFixed(1)) : 0.0;

    const currentTotalOccupiedTime = filteredLogs.reduce((acc, l) => acc + getLogOccupiedTime(l), 0);
    const currentAvgOccupiedTime = currentRefuels > 0 ? parseFloat((currentTotalOccupiedTime / currentRefuels).toFixed(1)) : 0;
    const prevTotalOccupiedTime = prevLogs.reduce((acc, l) => acc + getLogOccupiedTime(l), 0);
    const prevAvgOccupiedTime = prevRefuels > 0 ? parseFloat((prevTotalOccupiedTime / prevRefuels).toFixed(1)) : 0;
    const occupiedTimeGrowth = prevAvgOccupiedTime > 0 ? parseFloat((((currentAvgOccupiedTime - prevAvgOccupiedTime) / prevAvgOccupiedTime) * 100).toFixed(1)) : 0.0;

    const currentActiveHrsFuelling = parseFloat((currentTotalRefuelTime / 60).toFixed(1));
    const prevActiveHrsFuelling = parseFloat((prevTotalRefuelTime / 60).toFixed(1));
    const activeHrsFuellingGrowth = prevActiveHrsFuelling > 0 ? parseFloat((((currentActiveHrsFuelling - prevActiveHrsFuelling) / prevActiveHrsFuelling) * 100).toFixed(1)) : 0.0;

    const currentActiveHrsOccupied = parseFloat((currentTotalOccupiedTime / 60).toFixed(1));
    const prevActiveHrsOccupied = parseFloat((prevTotalOccupiedTime / 60).toFixed(1));
    const activeHrsOccupiedGrowth = prevActiveHrsOccupied > 0 ? parseFloat((((currentActiveHrsOccupied - prevActiveHrsOccupied) / prevActiveHrsOccupied) * 100).toFixed(1)) : 0.0;

    const dailyPatternMap: { [dateStr: string]: { volume: number, count: number } } = {};
    filteredLogs.forEach(l => {
      if (l.operationalDate) {
        dailyPatternMap[l.operationalDate] = dailyPatternMap[l.operationalDate] || { volume: 0, count: 0 };
        dailyPatternMap[l.operationalDate].volume += (l.volume || 0);
        dailyPatternMap[l.operationalDate].count += 1;
      }
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatDateKey = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const dailyPattern = Object.keys(dailyPatternMap).sort().map((dStr, idx, arr) => {
      const volume = dailyPatternMap[dStr].volume;
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, idx - 6); i <= idx; i++) {
        sum += dailyPatternMap[arr[i]].volume;
        count++;
      }
      const avg7Day = Math.round(sum / count);
      return {
        date: formatDateKey(dStr),
        volume,
        avg7Day,
        prevPeriod: Math.round(volume * 0.9)
      };
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sales30DaysMap: { [dateStr: string]: number } = {};
    (flightLogs || []).filter(l => {
      const isJet = !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL') && (l.logType === 'FLIGHT' || l.logType === 'SEAPLANE' || !l.logType);
      return isJet && l.operationalDate && new Date(l.operationalDate) >= thirtyDaysAgo;
    }).forEach(l => {
      sales30DaysMap[l.operationalDate!] = (sales30DaysMap[l.operationalDate!] || 0) + (l.volume || 0);
    });

    const sales30Days = Object.keys(sales30DaysMap).sort().map((dStr, idx, arr) => {
      const volume = sales30DaysMap[dStr];
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, idx - 6); i <= idx; i++) {
        sum += sales30DaysMap[arr[i]];
        count++;
      }
      return {
        date: formatDateKey(dStr),
        volume,
        avg7Day: Math.round(sum / count),
        prevPeriod: Math.round(volume * 0.9)
      };
    });

    const turnaroundIndividual = filteredLogs.map(l => {
      const duration = getLogDuration(l);
      return {
        x: duration,
        y: l.volume,
        name: l.flightNumber || 'Flight',
        airline: l.airline || 'Other Airlines',
        date: l.operationalDate ? formatDateShort(l.operationalDate) : ''
      };
    });

    const groups: { [key: string]: { sumVol: number, sumDur: number, count: number } } = {};
    turnaroundIndividual.forEach(pt => {
      const groupKey = pt.airline || 'Other';
      if (!groups[groupKey]) {
        groups[groupKey] = { sumVol: 0, sumDur: 0, count: 0 };
      }
      groups[groupKey].sumVol += pt.y;
      groups[groupKey].sumDur += pt.x;
      groups[groupKey].count += 1;
    });

    const turnaroundAggregate = Object.keys(groups).map(key => ({
      x: Math.round(groups[key].sumDur / groups[key].count),
      y: Math.round(groups[key].sumVol / groups[key].count),
      name: key,
      airline: key,
      count: groups[key].count,
      date: ''
    }));

    const hourlyPatternMap: { [hour: number]: { volume: number, count: number } } = {};
    for (let i = 0; i < 24; i++) hourlyPatternMap[i] = { volume: 0, count: 0 };
    filteredLogs.forEach(l => {
      if (l.timestampStart) {
        const hour = new Date(l.timestampStart).getHours();
        hourlyPatternMap[hour].volume += (l.volume || 0);
        hourlyPatternMap[hour].count += 1;
      }
    });

    const hourlyPattern = Object.keys(hourlyPatternMap).map(hStr => {
      const h = parseInt(hStr);
      return {
        hour: `${h.toString().padStart(2, '0')}:00`,
        volume: hourlyPatternMap[h].volume,
        count: hourlyPatternMap[h].count
      };
    });

    const eqUsageMap: { [vehicleId: string]: { volume: number, count: number } } = {};
    filteredLogs.forEach(l => {
      const vId = l.vehicleId || 'Unknown Equipment';
      eqUsageMap[vId] = eqUsageMap[vId] || { volume: 0, count: 0 };
      eqUsageMap[vId].volume += (l.volume || 0);
      eqUsageMap[vId].count += 1;
    });

    const eqUsage = Object.keys(eqUsageMap).map(vId => {
      const eqObj = (equipment || []).find(e => e.id === vId);
      const name = eqObj ? eqObj.name : vId;
      return {
        name,
        volume: eqUsageMap[vId].volume,
        count: eqUsageMap[vId].count
      };
    });

    const weeklyPatternMap: { [weekStr: string]: number } = {};
    filteredLogs.forEach(l => {
      if (l.operationalDate) {
        const d = new Date(l.operationalDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const mondayStr = monday.toISOString().split('T')[0];
        weeklyPatternMap[mondayStr] = (weeklyPatternMap[mondayStr] || 0) + (l.volume || 0);
      }
    });

    const weeklyPattern = Object.keys(weeklyPatternMap).sort().map(wStr => ({
      week: formatDateKey(wStr),
      volume: weeklyPatternMap[wStr]
    }));

    const standMap: { [stand: string]: { [cat: string]: number } } = {};
    filteredLogs.forEach(l => {
      const standName = l.stand || 'Unknown';
      standMap[standName] = standMap[standName] || {
        'International': 0,
        'Domestic': 0,
        'Ad-hoc Int': 0,
        'Ad-hoc Dom': 0,
        'Seaplane': 0,
        'Local Sales': 0
      };
      
      const category = getLogCategory(l);
      standMap[standName][category] = (standMap[standName][category] || 0) + (l.volume || 0);
    });

    const standUtilization = Object.keys(standMap).map(stand => ({
      stand,
      ...standMap[stand]
    }));

    const topCustomersMap: { [airline: string]: number } = {};
    filteredLogs.forEach(l => {
      const airlineName = l.airline || 'Other / Unknown';
      topCustomersMap[airlineName] = (topCustomersMap[airlineName] || 0) + (l.volume || 0);
    });
    const topCustomers = Object.keys(topCustomersMap).map(airline => ({
      airline,
      volume: topCustomersMap[airline]
    })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const topFlightsMap: { [flight: string]: number } = {};
    filteredLogs.forEach(l => {
      const flightNum = l.flightNumber || 'Unknown';
      topFlightsMap[flightNum] = (topFlightsMap[flightNum] || 0) + (l.volume || 0);
    });
    const topFlights = Object.keys(topFlightsMap).map(flight => ({
      flight,
      volume: topFlightsMap[flight]
    })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const pieData = [
      { name: 'International', value: international, color: '#002046' },
      { name: 'Domestic', value: domestic, color: '#22c55e' },
      { name: 'Ad-hoc Int', value: adhocInt, color: '#f59e0b' },
      { name: 'Ad-hoc Dom', value: adhocDom, color: '#ef4444' },
      { name: 'Seaplane', value: seaplane, color: '#8b5cf6' },
      { name: 'Local Sales', value: localSales, color: '#94a3b8' }
    ].filter(item => item.value > 0);

    const intAirlinesTable = filteredLogs.filter(l => !l.isDomestic)
      .reduce((acc: any[], l) => {
        const existing = acc.find(x => x.airline === l.airline);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
          existing.avg = Math.round(existing.volume / existing.reps);
        } else {
          acc.push({
            airline: l.airline || 'Other',
            volume: l.volume || 0,
            reps: 1,
            avg: l.volume || 0
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume);

    const flightTable = filteredLogs
      .reduce((acc: any[], l) => {
        const existing = acc.find(x => x.flight === l.flightNumber);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
          existing.avg = Math.round(existing.volume / existing.reps);
        } else {
          acc.push({
            flight: l.flightNumber,
            volume: l.volume || 0,
            reps: 1,
            avg: l.volume || 0
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const pitTable = filteredLogs
      .reduce((acc: any[], l) => {
        const pit = l.pitNumber || 'N/A';
        const existing = acc.find(x => x.pit === pit && x.stand === l.stand);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
        } else {
          acc.push({
            pit,
            stand: l.stand || 'N/A',
            volume: l.volume || 0,
            reps: 1
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume);

    return {
      kpi: { totalVolume, international, domestic, adhocInt, adhocDom, seaplane, localSales },
      growth: {
        volume: volumeGrowth,
        refueling: refuelingCountGrowth,
        avgVol: avgVolumeGrowth,
        peakDay: peakSingleDayGrowth,
        occupiedTime: occupiedTimeGrowth,
        refuelingTime: refuelingTimeGrowth,
        activeHrsOccupied: currentActiveHrsOccupied,
        activeHrsFuelling: currentActiveHrsFuelling,
        currentVol: totalVolume,
        prevVol: prevTotalVolume,
        currentRefuel: currentRefuels,
        prevRefuel: prevRefuels,
        currentAvg,
        prevAvg,
        currentPeak,
        prevPeak,
        currentOccupiedTime: currentAvgOccupiedTime,
        prevOccupiedTime: prevAvgOccupiedTime,
        currentRefuelTime: currentAvgRefuelTime,
        prevRefuelTime: prevAvgRefuelTime,
        currentActiveOccupied: currentActiveHrsOccupied,
        prevActiveOccupied: prevActiveHrsOccupied,
        currentActiveFuelling: currentActiveHrsFuelling,
        prevActiveFuelling: prevActiveHrsFuelling,
      },
      dailyPattern,
      sales30Days,
      turnaroundIndividual,
      turnaroundAggregate,
      hourlyPattern,
      eqUsage,
      weeklyPattern,
      standUtilization,
      topCustomers,
      topFlights,
      pieData,
      tables: { intAirlinesTable, flightTable, pitTable }
    };
  }, [startDateJet, endDateJet, categoryJet, airlineJet, flightNoJet, dayOfWeekJet, flightLogs, equipment]);

  // Combined DIESEL & PETROL Dashboard Dataset Generator
  const groundData = useMemo(() => {
    const start = new Date(startDateGround);
    const end = new Date(endDateGround);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 90;

    const filteredLogs = (flightLogs || []).filter(l => {
      const isGround = l.flightNumber.includes('GROUND') || l.logType === 'FILLING_STATION';
      if (!isGround) return false;

      if (l.operationalDate) {
        const logDate = new Date(l.operationalDate);
        if (logDate < start || logDate > end) return false;
      }

      if (fuelGradeGround !== 'All Grades') {
        const grade = l.remarks || '';
        if (grade.toLowerCase() !== fuelGradeGround.toLowerCase()) return false;
      }

      if (facilityGround !== 'All Facilities') {
        const src = l.pitNumber || '';
        if (!src.toLowerCase().includes(facilityGround.toLowerCase().replace(' station', '').replace(' trucks', ''))) return false;
      }

      if (deptGround !== 'All Departments') {
        const dept = l.airline || '';
        if (dept.toLowerCase() !== deptGround.toLowerCase()) return false;
      }

      if (searchGround.trim() !== '') {
        const q = searchGround.toLowerCase();
        const matchAsset = l.aircraftReg?.toLowerCase().includes(q);
        const matchTrans = l.id?.toLowerCase().includes(q) || l.deliveryNumber?.toLowerCase().includes(q);
        if (!matchAsset && !matchTrans) return false;
      }

      return true;
    });

    const totalVolume = filteredLogs.reduce((acc, l) => acc + (l.volume || 0), 0);
    const dieselVolume = filteredLogs.filter(l => l.remarks?.toLowerCase() === 'diesel').reduce((acc, l) => acc + (l.volume || 0), 0);
    const petrolVolume = filteredLogs.filter(l => l.remarks?.toLowerCase() === 'petrol').reduce((acc, l) => acc + (l.volume || 0), 0);
    
    const gseConsumption = filteredLogs.filter(l => l.airline?.toLowerCase().includes('gse')).reduce((acc, l) => acc + (l.volume || 0), 0);
    const depotGenerator = filteredLogs.filter(l => l.airline?.toLowerCase().includes('generator') || l.airline?.toLowerCase().includes('depot')).reduce((acc, l) => acc + (l.volume || 0), 0);
    const vesselMarine = filteredLogs.filter(l => l.airline?.toLowerCase().includes('vessel') || l.airline?.toLowerCase().includes('marine') || l.airline?.toLowerCase().includes('coast')).reduce((acc, l) => acc + (l.volume || 0), 0);
    const localSales = filteredLogs.filter(l => l.logType === 'FILLING_STATION' && !l.airline).reduce((acc, l) => acc + (l.volume || 0), 0);

    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - diffDays);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    const prevLogs = (flightLogs || []).filter(l => {
      const isGround = l.flightNumber.includes('GROUND') || l.logType === 'FILLING_STATION';
      if (!isGround) return false;
      if (l.operationalDate) {
        const logDate = new Date(l.operationalDate);
        return logDate >= prevStart && logDate <= prevEnd;
      }
      return false;
    });

    const prevTotalVolume = prevLogs.reduce((acc, l) => acc + (l.volume || 0), 0);
    const volumeGrowth = prevTotalVolume > 0 ? parseFloat((((totalVolume - prevTotalVolume) / prevTotalVolume) * 100).toFixed(1)) : 0.0;

    const currentTransactions = filteredLogs.length;
    const prevTransactions = prevLogs.length;
    const transactionsGrowth = prevTransactions > 0 ? parseFloat((((currentTransactions - prevTransactions) / prevTransactions) * 100).toFixed(1)) : 0.0;

    const currentAvg = currentTransactions > 0 ? Math.round(totalVolume / currentTransactions) : 0;
    const prevAvg = prevTransactions > 0 ? Math.round(prevTotalVolume / prevTransactions) : 0;
    const avgGrowth = prevAvg > 0 ? parseFloat((((currentAvg - prevAvg) / prevAvg) * 100).toFixed(1)) : 0.0;

    const groupVolByDate = (logs: FlightLog[]) => {
      const m: { [date: string]: number } = {};
      logs.forEach(l => {
        const d = l.operationalDate || 'Unknown';
        m[d] = (m[d] || 0) + (l.volume || 0);
      });
      return m;
    };
    const currentDays = groupVolByDate(filteredLogs);
    const prevDays = groupVolByDate(prevLogs);
    const currentPeak = Object.values(currentDays).length > 0 ? Math.max(...Object.values(currentDays)) : 0;
    const prevPeak = Object.values(prevDays).length > 0 ? Math.max(...Object.values(prevDays)) : 0;
    const peakGrowth = prevPeak > 0 ? parseFloat((((currentPeak - prevPeak) / prevPeak) * 100).toFixed(1)) : 0.0;

    const getLogDuration = (l: FlightLog) => {
      const startMs = l.timestampStart ? new Date(l.timestampStart).getTime() : 0;
      const endMs = l.timestampFinalEnd ? new Date(l.timestampFinalEnd).getTime() : (l.timestampInitialEnd ? new Date(l.timestampInitialEnd).getTime() : 0);
      let duration = startMs && endMs ? Math.round((endMs - startMs) / (1000 * 60)) : 0;
      if (duration <= 0 || duration > 120) {
        duration = Math.round(3 + (l.volume / 120));
      }
      return duration;
    };

    const currentTotalActiveHrs = parseFloat((filteredLogs.reduce((acc, l) => acc + getLogDuration(l), 0) / 60).toFixed(1));
    const prevTotalActiveHrs = parseFloat((prevLogs.reduce((acc, l) => acc + getLogDuration(l), 0) / 60).toFixed(1));
    const activeHrsGrowth = prevTotalActiveHrs > 0 ? parseFloat((((currentTotalActiveHrs - prevTotalActiveHrs) / prevTotalActiveHrs) * 100).toFixed(1)) : 0.0;

    const dailyPatternMap: { [dateStr: string]: number } = {};
    filteredLogs.forEach(l => {
      if (l.operationalDate) {
        dailyPatternMap[l.operationalDate] = (dailyPatternMap[l.operationalDate] || 0) + (l.volume || 0);
      }
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatDateKey = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()} ${months[d.getMonth()]}`;
    };

    const dailyPattern = Object.keys(dailyPatternMap).sort().map((dStr, idx, arr) => {
      const volume = dailyPatternMap[dStr];
      let sum = 0;
      let count = 0;
      for (let i = Math.max(0, idx - 6); i <= idx; i++) {
        sum += dailyPatternMap[arr[i]];
        count++;
      }
      const avg7Day = Math.round(sum / count);
      return {
        date: formatDateKey(dStr),
        volume,
        avg7Day,
        prevPeriod: Math.round(volume * 0.9)
      };
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sales30DaysMap: { [dateStr: string]: { diesel: number, petrol: number } } = {};
    (flightLogs || []).filter(l => {
      const isGround = l.flightNumber.includes('GROUND') || l.logType === 'FILLING_STATION';
      return isGround && l.operationalDate && new Date(l.operationalDate) >= thirtyDaysAgo;
    }).forEach(l => {
      sales30DaysMap[l.operationalDate!] = sales30DaysMap[l.operationalDate!] || { diesel: 0, petrol: 0 };
      if (l.remarks?.toLowerCase() === 'diesel') {
        sales30DaysMap[l.operationalDate!].diesel += (l.volume || 0);
      } else {
        sales30DaysMap[l.operationalDate!].petrol += (l.volume || 0);
      }
    });

    const sales30Days = Object.keys(sales30DaysMap).sort().map(dStr => {
      const total = sales30DaysMap[dStr].diesel + sales30DaysMap[dStr].petrol;
      return {
        date: formatDateKey(dStr),
        diesel: sales30DaysMap[dStr].diesel,
        petrol: sales30DaysMap[dStr].petrol,
        total,
        avg7Day: Math.round(total * 0.9)
      };
    });

    const turnaroundIndividual = filteredLogs.map(l => {
      const duration = getLogDuration(l);
      return {
        x: duration,
        y: l.volume,
        name: l.aircraftReg || l.flightNumber || 'Asset',
        airline: l.airline || 'Ground Operations',
        date: l.operationalDate ? formatDateShort(l.operationalDate) : ''
      };
    });

    const groups: { [key: string]: { sumVol: number, sumDur: number, count: number } } = {};
    turnaroundIndividual.forEach(pt => {
      const groupKey = pt.airline || 'Other';
      if (!groups[groupKey]) {
        groups[groupKey] = { sumVol: 0, sumDur: 0, count: 0 };
      }
      groups[groupKey].sumVol += pt.y;
      groups[groupKey].sumDur += pt.x;
      groups[groupKey].count += 1;
    });

    const turnaroundAggregate = Object.keys(groups).map(key => ({
      x: Math.round(groups[key].sumDur / groups[key].count),
      y: Math.round(groups[key].sumVol / groups[key].count),
      name: key,
      airline: key,
      count: groups[key].count,
      date: ''
    }));

    const hourlyPatternMap: { [hour: number]: { volume: number, count: number } } = {};
    for (let i = 0; i < 24; i++) hourlyPatternMap[i] = { volume: 0, count: 0 };
    filteredLogs.forEach(l => {
      if (l.timestampStart) {
        const hour = new Date(l.timestampStart).getHours();
        hourlyPatternMap[hour].volume += (l.volume || 0);
        hourlyPatternMap[hour].count += 1;
      }
    });

    const hourlyPattern = Object.keys(hourlyPatternMap).map(hStr => {
      const h = parseInt(hStr);
      return {
        hour: `${h.toString().padStart(2, '0')}:00`,
        volume: hourlyPatternMap[h].volume,
        count: hourlyPatternMap[h].count
      };
    });

    const eqUsageMap: { [pit: string]: { volume: number, count: number } } = {};
    filteredLogs.forEach(l => {
      const src = l.pitNumber || 'Filling Station';
      eqUsageMap[src] = eqUsageMap[src] || { volume: 0, count: 0 };
      eqUsageMap[src].volume += (l.volume || 0);
      eqUsageMap[src].count += 1;
    });

    const eqUsage = Object.keys(eqUsageMap).map(src => ({
      name: src,
      volume: eqUsageMap[src].volume,
      count: eqUsageMap[src].count
    }));

    const weeklyPatternMap: { [weekStr: string]: number } = {};
    filteredLogs.forEach(l => {
      if (l.operationalDate) {
        const d = new Date(l.operationalDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const mondayStr = monday.toISOString().split('T')[0];
        weeklyPatternMap[mondayStr] = (weeklyPatternMap[mondayStr] || 0) + (l.volume || 0);
      }
    });

    const weeklyPattern = Object.keys(weeklyPatternMap).sort().map(wStr => ({
      week: formatDateKey(wStr),
      volume: weeklyPatternMap[wStr]
    }));

    const facilityMap: { [fac: string]: { Diesel: number, Petrol: number } } = {};
    filteredLogs.forEach(l => {
      const facName = l.pitNumber || 'Filling Station';
      facilityMap[facName] = facilityMap[facName] || { Diesel: 0, Petrol: 0 };
      const grade = l.remarks?.toLowerCase() === 'diesel' ? 'Diesel' : 'Petrol';
      facilityMap[facName][grade] += (l.volume || 0);
    });

    const stationUtilization = Object.keys(facilityMap).map(facName => ({
      name: facName,
      Diesel: facilityMap[facName].Diesel,
      Petrol: facilityMap[facName].Petrol
    }));

    const topCustomersMap: { [dept: string]: number } = {};
    filteredLogs.forEach(l => {
      const deptName = l.airline || 'Local Sales';
      topCustomersMap[deptName] = (topCustomersMap[deptName] || 0) + (l.volume || 0);
    });
    const topCustomers = Object.keys(topCustomersMap).map(name => ({
      name,
      volume: topCustomersMap[name]
    })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const topVehiclesMap: { [vType: string]: number } = {};
    filteredLogs.forEach(l => {
      const vType = l.aircraftType || 'GSE Vehicles';
      topVehiclesMap[vType] = (topVehiclesMap[vType] || 0) + (l.volume || 0);
    });
    const topVehicles = Object.keys(topVehiclesMap).map(name => ({
      name,
      volume: topVehiclesMap[name]
    })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const pieData = [
      { name: 'GSE Services', value: gseConsumption, color: '#002046' },
      { name: 'Depot Generators', value: depotGenerator, color: '#f59e0b' },
      { name: 'Vessel / Marine', value: vesselMarine, color: '#22c55e' },
      { name: 'Local Sales / Others', value: localSales, color: '#888888' },
    ].filter(item => item.value > 0);

    const deptTable = filteredLogs
      .reduce((acc: any[], l) => {
        const dept = l.airline || 'Local Sales';
        const existing = acc.find(x => x.dept === dept);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
          existing.avg = Math.round(existing.volume / existing.reps);
        } else {
          acc.push({
            dept,
            volume: l.volume || 0,
            reps: 1,
            avg: l.volume || 0
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume);

    const assetTable = filteredLogs
      .reduce((acc: any[], l) => {
        const asset = l.aircraftReg || 'Unknown';
        const fuel = l.remarks || 'Diesel';
        const existing = acc.find(x => x.asset === asset);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
        } else {
          acc.push({
            asset,
            fuel,
            volume: l.volume || 0,
            reps: 1
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume).slice(0, 10);

    const stationTable = filteredLogs
      .reduce((acc: any[], l) => {
        const station = l.pitNumber || 'Filling Station';
        const existing = acc.find(x => x.station === station);
        if (existing) {
          existing.volume += (l.volume || 0);
          existing.reps += 1;
        } else {
          acc.push({
            station,
            volume: l.volume || 0,
            reps: 1
          });
        }
        return acc;
      }, []).sort((a, b) => b.volume - a.volume);

    return {
      kpi: { totalVolume, dieselVolume, petrolVolume, gseConsumption, depotGenerator, vesselMarine, localSales },
      growth: {
        volume: volumeGrowth,
        transactions: currentTransactions,
        avgVol: avgGrowth,
        peakDay: peakGrowth,
        activeHrs: currentTotalActiveHrs,
        currentVol: totalVolume,
        prevVol: prevTotalVolume,
        currentTransactions,
        prevTransactions,
        currentAvg,
        prevAvg,
        currentPeak,
        prevPeak,
        currentActiveHrs: currentTotalActiveHrs,
        prevActiveHrs: prevTotalActiveHrs,
      },
      dailyPattern,
      sales30Days,
      turnaroundIndividual,
      turnaroundAggregate,
      hourlyPattern,
      eqUsage,
      weeklyPattern,
      stationUtilization,
      topCustomers,
      topVehicles,
      pieData,
      tables: { deptTable, assetTable, stationTable }
    };
  }, [startDateGround, endDateGround, compareGround, fuelGradeGround, facilityGround, deptGround, searchGround, flightLogs, equipment]);

  // Fluctuates volume deterministically based on date to simulate historical reports
  const getHistoricalLevel = (id: string, currentLevel: number, capacity: number, dateStr: string) => {
    if (dateStr === '2026-06-30') return currentLevel;
    let hash = 0;
    const combined = id + dateStr;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    const maxFluctuate = capacity > 0 ? capacity * 0.15 : 10000;
    const offset = (Math.abs(hash) % (maxFluctuate * 2)) - maxFluctuate;
    return Math.max(0, Math.min(capacity > 0 ? capacity : 100000, Math.round(currentLevel + offset)));
  };

  // Triggers browser-native high-fidelity PDF print matching MACL Excel layout
  const handleExportPDF = () => {
    const dateObj = new Date(stockReportDate);
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const getLevel = (id: string, defaultCap: number, currentVol: number) => {
      return getHistoricalLevel(id, currentVol, defaultCap, stockReportDate);
    };

    // Gather Jet A-1 OFF farm details
    const offTanksList = [
      { id: 'tk4', name: 'TK-4', cap: 2200000, current: 450000 },
      { id: 'tk6', name: 'TK-6', cap: 2200000, current: 620000 },
      { id: 'tk7', name: 'TK-7', cap: 3300000, current: 380000 },
      { id: 'tk8', name: 'TK-8', cap: 3300000, current: 710000 },
      { id: 'tk9', name: 'TK-9', cap: 3300000, current: 540000 }
    ];

    const offRefuellersList = [
      { id: 'rf02', name: 'RF-02', cap: 57000, current: 32000 },
      { id: 'rf04', name: 'RF-04', cap: 12000, current: 8000 },
      { id: 'rf06', name: 'RF-06', cap: 57000, current: 45000 },
      { id: 'rf07', name: 'RF-07', cap: 57000, current: 39000 },
      { id: 'rf10', name: 'RF-10', cap: 56000, current: 41000 },
      { id: 'rf11', name: 'RF-11', cap: 13000, current: 9500 },
      { id: 'rf12', name: 'RF-12', cap: 13100, current: 8700 },
      { id: 'rf16', name: 'RF-16', cap: 13000, current: 7200 },
      { id: 'rf17', name: 'RF-17', cap: 20000, current: 15000 }
    ];

    const offTanksData = offTanksList.map(t => {
      const vol = getLevel(t.id, t.cap, t.current);
      const dip = lookupDipSync(t.id, vol, t.cap);
      return { ...t, volume: vol, dip };
    });

    const offRefuellersData = offRefuellersList.map(r => {
      const vol = getLevel(r.id, r.cap, r.current);
      return { ...r, volume: vol, dip: 'NIL' };
    });

    const pr1Vol = getLevel('pr1', 20000, 12000);

    const offTotalJetVolume = offTanksData.reduce((sum, t) => sum + t.volume, 0) +
                             offRefuellersData.reduce((sum, r) => sum + r.volume, 0) +
                             pr1Vol;

    // SPF Seaplane Fuel details
    const spfList = [
      { id: 'spf_e1', name: 'SPF E-1', cap: 35000, current: 32083 },
      { id: 'spf_e2', name: 'SPF E-2', cap: 35000, current: 31973 },
      { id: 'spf_e3', name: 'SPF E-3', cap: 35000, current: 33287 }
    ];
    const spfData = spfList.map(s => {
      const vol = getLevel(s.id, s.cap, s.current);
      return { ...s, volume: vol };
    });
    const spfTotalVolume = spfData.reduce((sum, s) => sum + s.volume, 0);

    // NFF Jet A-1 details
    const nffList = [
      { id: 'tk101', name: 'TK101', cap: 14500000, current: 3150000 },
      { id: 'tk102', name: 'TK102', cap: 14500000, current: 4085000 },
      { id: 'tk103', name: 'TK103', cap: 14500000, current: 2800000 },
      { id: 'tk106', name: 'TK106', cap: 100000, current: 12000 }
    ];
    const nffData = nffList.map(n => {
      const vol = getLevel(n.id, n.cap, n.current);
      const dip = lookupDipSync(n.id, vol, n.cap);
      return { ...n, volume: vol, dip };
    });
    const nffTotalJetVolume = nffData.reduce((sum, n) => sum + n.volume, 0);

    // FSS Combined Jet A-1 Physical Balance
    const fssPhysicalBalance = offTotalJetVolume + spfTotalVolume + nffTotalJetVolume;

    // FSS Stock Summary values
    const salesVol = Math.round(getLevel('sales_jet_day', 600000, 480000));
    const receiptVol = 0;
    
    let hash = 0;
    for (let i = 0; i < stockReportDate.length; i++) {
      hash = stockReportDate.charCodeAt(i) + ((hash << 5) - hash);
    }
    const variation = (Math.abs(hash) % 800) + 400;
    const bookBalance = fssPhysicalBalance - variation;
    const openingStock = bookBalance - receiptVol + salesVol;

    const jetDaysLeft = Math.max(0, Math.round((fssPhysicalBalance - 500000) / 556176));
    const depletionDate = new Date(dateObj);
    depletionDate.setDate(dateObj.getDate() + jetDaysLeft);
    const depletionDateStr = depletionDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');

    const avgTransfer = Math.round(593360 + (hash % 10000));

    // OFF Diesel/Petrol
    const offDieselVol = getLevel('off_diesel_tk', 50000, 32000);
    const offDieselDip = lookupDipSync('tk202', offDieselVol, 50000);

    const offPetrolVol = getLevel('off_petrol_tk', 20000, 15000);
    const offPetrolDip = lookupDipSync('tk301', offPetrolVol, 20000);

    const offDieselTruck02Vol = getLevel('off_dt02', 30000, 17000);

    // LFS Diesel/Petrol
    const lfsDieselVol = getLevel('lfs_diesel', 15000, 3921);
    const lfsPetrolVol = getLevel('lfs_petrol', 10000, 3739);

    // NFF Diesel & Petrol
    const nffDiesel01Vol = getLevel('tk201', 500000, 75000);
    const nffDiesel02Vol = getLevel('tk202', 500000, 68000);
    const nffPetrol01Vol = getLevel('tk301', 50000, 42000);
    const nffPetrol02Vol = getLevel('tk302', 50000, 38000);

    // Historical trends
    const last7DaysSalesData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dateObj);
      d.setDate(dateObj.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      let dHash = 0;
      for (let j = 0; j < dStr.length; j++) {
        dHash = dStr.charCodeAt(j) + ((dHash << 5) - dHash);
      }
      const sVol = Math.round(480000 + (Math.abs(dHash) % 150000));
      last7DaysSalesData.push({
        day: d.toLocaleDateString('en-US', { weekday: 'long' }),
        date: d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'),
        volume: sVol
      });
    }

    const last7DaysTransferData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dateObj);
      d.setDate(dateObj.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      let dHash = 0;
      for (let j = 0; j < dStr.length; j++) {
        dHash = dStr.charCodeAt(j) + ((dHash << 5) - dHash);
      }
      const tVol = Math.round(520000 + (Math.abs(dHash) % 180000));
      last7DaysTransferData.push({
        day: d.toLocaleDateString('en-US', { weekday: 'long' }),
        date: d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-'),
        volume: tVol
      });
    }

    // Build the high-fidelity HTML report
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Stock Summary Report - ${dateFormatted}</title>
  <style>
    @media print {
      @page {
        size: A4 landscape;
        margin: 5mm;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 0;
      font-size: 8px;
      line-height: 1.1;
      color: #333;
      background-color: #fff;
    }
    .container {
      display: grid;
      grid-template-columns: 29% 42% 29%;
      gap: 10px;
      padding: 10px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #1F4E79;
      padding-bottom: 4px;
      margin-bottom: 8px;
      padding: 4px 10px;
    }
    .header-left {
      background-color: #0F2537;
      color: white;
      padding: 5px 12px;
      border-radius: 2px;
    }
    .header-left h1 {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: bold;
    }
    .header-left p {
      margin: 1px 0 0 0;
      font-size: 7px;
      opacity: 0.85;
      text-transform: uppercase;
    }
    .logo-container {
      text-align: right;
    }
    .logo-text {
      font-size: 11px;
      font-weight: 900;
      color: #0056b3;
    }
    .logo-text span {
      color: #00a4e4;
    }
    .date-badge {
      border: 0.75px solid #7f7f7f;
      background-color: #f8f9fa;
      color: #000;
      font-weight: bold;
      padding: 2.5px 8px;
      font-size: 8px;
      display: inline-block;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    th, td {
      border: 0.5px solid #a0a0a0;
      padding: 2px 4px;
      font-size: 7px;
    }
    th {
      font-weight: bold;
      text-transform: uppercase;
      text-align: left;
    }
    .right {
      text-align: right;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: bold;
    }
    .bg-blue { background-color: #003366; color: white; }
    .bg-light-blue { background-color: #1F4E79; color: white; }
    .bg-orange { background-color: #F4B084; color: black; }
    .bg-yellow { background-color: #FFC000; color: black; }
    .bg-cyan { background-color: #00FFFF; color: black; }
    .bg-green { background-color: #70AD47; color: white; }
    .bg-red { background-color: #C00000; color: white; }
    
    .bg-summary-green { background-color: #C6EFCE; color: #006100; font-weight: bold; }
    .bg-total-green { background-color: #E2EFDA; font-weight: bold; }
    .bg-total-dark { background-color: #000000; color: white; font-weight: bold; }
    .bg-total-blue { background-color: #D9E1F2; font-weight: bold; }
    
    .chart-box {
      border: 0.5px solid #bfbfbf;
      padding: 3px;
      margin-bottom: 8px;
      background-color: #fff;
    }
    .chart-header {
      font-size: 8px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 3px;
      color: #333;
    }
    .legend-box {
      border: 0.5px solid #bfbfbf;
      background-color: #f2f2f2;
      padding: 5px;
      margin-top: 8px;
    }
    .legend-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: bold;
      font-size: 7px;
    }
    .legend-color {
      width: 14px;
      height: 8px;
      border: 0.5px solid #333;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Fuel Services</h1>
      <p>Velana International Airport</p>
    </div>
    <div class="logo-container">
      <div class="logo-text">MALDIVES <span>AIRPORTS CO.</span></div>
      <div class="date-badge">DATE: ${dateFormatted}</div>
    </div>
  </div>

  <div class="container">
    <!-- COLUMN 1 -->
    <div>
      <!-- FSS JET A-1 STOCK SUMMARY -->
      <table>
        <thead>
          <tr class="bg-light-blue">
            <th colspan="2">FSS JET A-1 STOCK SUMMARY</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>OPENING STOCK</td>
            <td class="right bold">${openingStock.toLocaleString()}</td>
          </tr>
          <tr>
            <td>RECEIPT</td>
            <td class="right bold">${receiptVol.toLocaleString()}</td>
          </tr>
          <tr>
            <td>SALES</td>
            <td class="right bold">${salesVol.toLocaleString()}</td>
          </tr>
          <tr>
            <td>BOOK BALANCE</td>
            <td class="right bold">${bookBalance.toLocaleString()}</td>
          </tr>
          <tr>
            <td>PHYSICAL BALANCE</td>
            <td class="right bold">${fssPhysicalBalance.toLocaleString()}</td>
          </tr>
          <tr>
            <td class="bold">VARIATION</td>
            <td class="right bg-summary-green">${variation.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- FSS JET A-1 SALES SUMMARY -->
      <table>
        <thead>
          <tr class="bg-green">
            <th colspan="2">FSS JET A-1 SALES SUMMARY</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>DAYS SALE</td>
            <td class="right bold">${salesVol.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Moving average 7 days</td>
            <td class="right bold">556,176</td>
          </tr>
        </tbody>
      </table>

      <!-- FSS JET A-1 ESTIMATED STOCK AVAILABILITY -->
      <table>
        <thead>
          <tr class="bg-light-blue">
            <th colspan="2">FSS JET A-1 ESTIMATED STOCK AVAILABILITY</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #F2F2F2;">
            <td class="bold">STOCK WILL LAST TILL</td>
            <td class="right bold" style="color: #0066cc;">${depletionDateStr}</td>
          </tr>
        </tbody>
      </table>

      <!-- OFF PHYSICAL BALANCE -->
      <table>
        <thead>
          <tr class="bg-orange">
            <th colspan="3" class="bold">OFF PHYSICAL BALANCE</th>
          </tr>
          <tr class="bg-orange" style="font-size: 6px; opacity: 0.9;">
            <th>TANK</th>
            <th class="center">DIP/mm</th>
            <th class="right">QUANTITY/Liters</th>
          </tr>
        </thead>
        <tbody>
          ${offTanksData.map(t => `
            <tr>
              <td>${t.name}</td>
              <td class="center">${t.dip !== null ? t.dip.toLocaleString() : 'NIL'}</td>
              <td class="right font-mono">${t.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          ${offRefuellersData.map(r => `
            <tr>
              <td>${r.name}</td>
              <td class="center">NIL</td>
              <td class="right font-mono">${r.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr>
            <td>HS-01</td>
            <td class="center">NIL</td>
            <td class="right font-mono">0</td>
          </tr>
          <tr>
            <td>HS-02</td>
            <td class="center">NIL</td>
            <td class="right font-mono">0</td>
          </tr>
          <tr>
            <td>PR1</td>
            <td class="center">NIL</td>
            <td class="right font-mono">${pr1Vol.toLocaleString()}</td>
          </tr>
          <tr class="bg-total-green">
            <td colspan="2" class="bold">OFF PHYSICAL BALANCE</td>
            <td class="right bold font-mono">${offTotalJetVolume.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- COLUMN 2 -->
    <div>
      <!-- Sales over the month -->
      <div class="chart-box">
        <div class="chart-header">Sales over the month</div>
        <svg width="100%" height="80" viewBox="0 0 400 100" style="background:#fff;">
          <line x1="30" y1="10" x2="390" y2="10" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="30" x2="390" y2="30" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="50" x2="390" y2="50" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="70" x2="390" y2="70" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="90" x2="390" y2="90" stroke="#ccc" stroke-width="0.75" />
          
          <text x="5" y="15" fill="#777" font-size="6">900,000</text>
          <text x="5" y="55" fill="#777" font-size="6">500,000</text>
          <text x="5" y="95" fill="#777" font-size="6">100,000</text>
          
          <path d="M 35,50 L 65,30 L 95,60 L 125,45 L 155,48 L 185,28 L 215,50 L 245,55 L 275,35 L 305,42 L 335,22 L 365,48 L 390,32" fill="none" stroke="#2b5c8f" stroke-width="1.5" />
          <path d="M 35,46 L 65,45 L 95,47 L 125,45 L 155,44 L 185,42 L 215,45 L 245,46 L 275,45 L 305,44 L 335,41 L 365,43 L 390,42" fill="none" stroke="#e07b22" stroke-width="1.5" />
        </svg>
      </div>

      <!-- Sales fluctuation -->
      <div class="chart-box">
        <div class="chart-header">Sales fluctuation: Past 6 months</div>
        <svg width="100%" height="80" viewBox="0 0 400 100" style="background:#fff;">
          <line x1="30" y1="10" x2="390" y2="10" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="30" x2="390" y2="30" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="50" x2="390" y2="50" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="70" x2="390" y2="70" stroke="#e9e9e9" stroke-width="0.5" />
          <line x1="30" y1="90" x2="390" y2="90" stroke="#ccc" stroke-width="0.75" />
          
          <text x="5" y="15" fill="#777" font-size="6">2,000,000</text>
          <text x="5" y="55" fill="#777" font-size="6">1,000,000</text>
          <text x="5" y="95" fill="#777" font-size="6">200,000</text>
          
          <path d="M 35,65 L 65,45 L 95,55 L 125,35 L 155,75 L 185,60 L 215,40 L 245,65 L 275,50 L 305,45 L 335,60 L 365,55 L 390,70" fill="none" stroke="#2b5c8f" stroke-width="1.25" />
          <path d="M 35,55 L 65,53 L 95,54 L 125,50 L 155,54 L 185,55 L 215,51 L 245,53 L 275,52 L 305,51 L 335,53 L 365,53 L 390,55" fill="none" stroke="#e07b22" stroke-width="1.25" />
        </svg>
      </div>

      <!-- SPF TANKS STATUS -->
      <table>
        <thead>
          <tr class="bg-yellow">
            <th colspan="2">SPF TANKS STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${spfData.map(s => `
            <tr>
              <td>${s.name}</td>
              <td class="right font-mono">${s.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="bg-total-green">
            <td class="bold">SPF PHYSICAL BALANCE</td>
            <td class="right bold font-mono">${spfTotalVolume.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- NFF TANKS STATUS -->
      <table>
        <thead>
          <tr class="bg-cyan">
            <th colspan="3" class="bold">NFF TANKS STATUS</th>
          </tr>
          <tr class="bg-cyan" style="font-size: 6px; opacity: 0.9;">
            <th>TANK</th>
            <th class="center">DIP(mm)</th>
            <th class="right">QUANTITY/Liters</th>
          </tr>
        </thead>
        <tbody>
          ${nffData.map(n => `
            <tr>
              <td>${n.name}</td>
              <td class="center">${n.dip !== null ? n.dip.toLocaleString() : 'NIL'}</td>
              <td class="right font-mono">${n.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr>
            <td>HS-01</td>
            <td class="center">NIL</td>
            <td class="right font-mono">0</td>
          </tr>
          <tr>
            <td>HS-02</td>
            <td class="center">NIL</td>
            <td class="right font-mono">0</td>
          </tr>
          <tr class="bg-total-green">
            <td colspan="2" class="bold">TOTAL</td>
            <td class="right bold font-mono">${nffTotalJetVolume.toLocaleString()}</td>
          </tr>
          <tr class="bg-total-dark">
            <td colspan="2" class="bold">FSS PHYSICAL BALANCE</td>
            <td class="right bold font-mono">${fssPhysicalBalance.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- Legend Box -->
      <div class="legend-box">
        <div class="legend-grid">
          <div class="legend-item"><div class="legend-color bg-yellow"></div>SPF: Seaplane Fuel</div>
          <div class="legend-item"><div class="legend-color bg-cyan"></div>NFF: New Fuel Farm</div>
          <div class="legend-item"><div class="legend-color bg-orange"></div>OFF: Old Fuel Farm</div>
          <div class="legend-item"><div class="legend-color bg-blue"></div>LFS: Landside Fuel</div>
          <div class="legend-item"><div class="legend-color bg-green"></div>Diesel</div>
          <div class="legend-item"><div class="legend-color bg-red"></div>Petrol</div>
        </div>
      </div>
    </div>

    <!-- COLUMN 3 -->
    <div>
      <!-- LAST 7 DAYS JET A-1 SALE -->
      <table>
        <thead>
          <tr class="bg-blue">
            <th colspan="3">LAST 7 DAYS JET A-1 SALE</th>
          </tr>
        </thead>
        <tbody>
          ${last7DaysSalesData.map(s => `
            <tr>
              <td>${s.day}</td>
              <td class="center" style="font-size: 6px; color: #555;">${s.date}</td>
              <td class="right bold font-mono">${s.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="bg-total-blue">
            <td colspan="2" class="bold">AVERAGE</td>
            <td class="right bold font-mono">556,176</td>
          </tr>
        </tbody>
      </table>

      <!-- OFF DIESEL/PETROL TANKS STATUS -->
      <table>
        <thead>
          <tr class="bg-total-dark">
            <th colspan="3">OFF DIESEL/PETROL TANKS STATUS</th>
          </tr>
          <tr class="bg-total-dark" style="font-size: 6px; opacity: 0.9;">
            <th>EQUIPMENT</th>
            <th class="center">DIP/mm</th>
            <th class="right">QUANTITY / LITRES</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #E2EFDA;">
            <td>DIESEL TANK (DT-02)</td>
            <td class="center">${offDieselDip !== null ? offDieselDip.toLocaleString() : 'NIL'}</td>
            <td class="right bold font-mono">${offDieselVol.toLocaleString()}</td>
          </tr>
          <tr class="bg-red" style="color: white;">
            <td colspan="2" class="bold">PETROL TANK</td>
            <td class="right bold font-mono">NIL / DT-01 : 6007</td>
          </tr>
          <tr>
            <td colspan="2">DIESEL TRUCK/DT-01 (L)</td>
            <td class="right bold font-mono">NIL</td>
          </tr>
          <tr>
            <td colspan="2">DIESEL TRUCK/DT-02 (L)</td>
            <td class="right bold font-mono">${offDieselTruck02Vol.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- LFS TANKS STATUS -->
      <table>
        <thead>
          <tr class="bg-blue">
            <th colspan="3">LFS TANKS STATUS</th>
          </tr>
          <tr class="bg-blue" style="font-size: 6px; opacity: 0.9;">
            <th>EQUIPMENT</th>
            <th class="center">DIP/mm</th>
            <th class="right">QUANTITY / LITRES</th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-total-green">
            <td>DIESEL TANK</td>
            <td class="center">620</td>
            <td class="right bold font-mono">${lfsDieselVol.toLocaleString()}</td>
          </tr>
          <tr class="bg-red">
            <td>PETROL TANK</td>
            <td class="center">598</td>
            <td class="right bold font-mono">${lfsPetrolVol.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- OFF JET A-1 ESTIMATED STOCK AVAILABILITY -->
      <table>
        <thead>
          <tr class="bg-orange">
            <th colspan="2">OFF JET A-1 ESTIMATED STOCK AVAILABILITY</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #F2F2F2;">
            <td class="bold">STOCK WILL LAST TILL</td>
            <td class="right bold" style="color: #d35400;">21-Jul-26</td>
          </tr>
        </tbody>
      </table>

      <!-- NFF DIESEL & PETROL TANKS STATUS -->
      <table>
        <thead>
          <tr class="bg-blue" style="background-color: #0F2537;">
            <th colspan="3">NFF DIESEL & PETROL TANKS STATUS</th>
          </tr>
          <tr class="bg-blue" style="background-color: #0F2537; font-size: 6px; opacity: 0.9;">
            <th>TANKS</th>
            <th class="center">DIP/mm</th>
            <th class="right">QUANTITY / LITRES</th>
          </tr>
        </thead>
        <tbody>
          <tr class="bg-total-green">
            <td>TK-201</td>
            <td class="center">372</td>
            <td class="right font-mono">${nffDiesel01Vol.toLocaleString()}</td>
          </tr>
          <tr class="bg-total-green">
            <td>TK-202</td>
            <td class="center">3816</td>
            <td class="right font-mono">${nffDiesel02Vol.toLocaleString()}</td>
          </tr>
          <tr class="bg-red">
            <td>TK-301</td>
            <td class="center">251</td>
            <td class="right font-mono">${nffPetrol01Vol.toLocaleString()}</td>
          </tr>
          <tr class="bg-red">
            <td>TK-302</td>
            <td class="center">674</td>
            <td class="right font-mono">${nffPetrol02Vol.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- LAST 7 DAYS JET A-1 TRANSFER (NFF) -->
      <table>
        <thead>
          <tr class="bg-cyan">
            <th colspan="3">LAST 7 DAYS JET A-1 TRANSFER (NFF)</th>
          </tr>
        </thead>
        <tbody>
          ${last7DaysTransferData.map(t => `
            <tr>
              <td>${t.day}</td>
              <td class="center" style="font-size: 6px; color: #555;">${t.date}</td>
              <td class="right bold font-mono">${t.volume.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="bg-total-blue">
            <td colspan="2" class="bold">AVERAGE</td>
            <td class="right bold font-mono">${avgTransfer.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- FSS JET A-1 ESTIMATED STOCK AVAILABILITY -->
      <table>
        <thead>
          <tr class="bg-cyan">
            <th colspan="2">FSS JET A-1 ESTIMATED STOCK AVAILABILITY</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #F2F2F2;">
            <td class="bold">STOCK WILL LAST TILL</td>
            <td class="right bold" style="color: #008080;">${depletionDateStr}</td>
          </tr>
        </tbody>
      </table>

      <!-- NFF TRANSFER SUMMARY -->
      <table>
        <thead>
          <tr class="bg-cyan">
            <th colspan="2">NFF TRANSFER SUMMARY</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #F2F2F2;">
            <td class="bold">MOVING AVERAGE</td>
            <td class="right bold font-mono">${avgTransfer.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;

    // Write to hidden iframe and print
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 500);
      }, 500);
    }
  };

  // Preload calibration tables
  useEffect(() => {
    preloadCalibrationData();
  }, []);

  // Selected shipment for Figure 1.5 modal view
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  // 1. FUEL SALES MODULE DATA
  const salesSummary = useMemo(() => {
    // Generate sales aggregates based on flight logs
    const totalJetSales = (flightLogs || [])
      .filter(l => !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0);

    const totalDieselSales = (flightLogs || [])
      .filter(l => l.flightNumber.includes('GROUND') && l.flightNumber.includes('DIESEL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0) + 14200; // Adding seed ground station diesel

    const totalPetrolSales = (flightLogs || [])
      .filter(l => l.flightNumber.includes('GROUND') && l.flightNumber.includes('PETROL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0) + 9800; // Adding seed petrol

    return {
      jet: totalJetSales > 0 ? totalJetSales : 12450000, // Fallback to premium mockup scales
      diesel: totalDieselSales,
      petrol: totalPetrolSales,
      total: (totalJetSales > 0 ? totalJetSales : 12450000) + totalDieselSales + totalPetrolSales
    };
  }, [flightLogs]);

  // Monthly breakdowns for Recharts
  const monthlySalesData = useMemo(() => {
    return [
      { month: 'Jan', jet: 10800000, diesel: 180000, petrol: 92000 },
      { month: 'Feb', jet: 11200000, diesel: 195000, petrol: 95000 },
      { month: 'Mar', jet: 12500000, diesel: 210000, petrol: 102000 },
      { month: 'Apr', jet: 11900000, diesel: 175000, petrol: 89000 },
      { month: 'May', jet: 12100000, diesel: 190000, petrol: 93000 },
      { month: 'Jun', jet: salesSummary.jet, diesel: salesSummary.diesel, petrol: salesSummary.petrol }
    ];
  }, [salesSummary]);

  // Carrier based sales report
  const airlineSalesData = useMemo(() => {
    return [
      { airline: 'Emirates', volume: 4500000, flights: 75, share: '36.1%' },
      { airline: 'Qatar Airways', volume: 3200000, flights: 58, share: '25.7%' },
      { airline: 'Singapore Airlines', volume: 2100000, flights: 35, share: '16.8%' },
      { airline: 'British Airways', volume: 1450000, flights: 22, share: '11.6%' },
      { airline: 'SriLankan Airlines', volume: 1200000, flights: 48, share: '9.8%' }
    ];
  }, []);

  // COLORS FOR CELL CHART
  const COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', '#8884d8', '#ff7300'];

  // 2. SHIPMENTS DATA (Tanker receipts - matches Figure 1.5 design values)
  const shipmentLogs = useMemo(() => {
    return [
      {
        id: 'sh-jet-18',
        vesselName: 'MT ALIMAS',
        shipmentNo: 'NS/SHIP-JET A-1/2026/18',
        product: FuelType.JET_A1,
        started: '2026-05-24 12:00',
        completed: '2026-05-26 10:24',
        quantityMt: 17001.051,
        tankBefore103: { dip: 1780, vol: 2533.575, roofCorr: 0, density: 777.2, temp: 26.50, density15: 0.7678, tankTemp: 29.90, vcf: 0.9825, kl15: 2489.237 },
        tankAfter103: { dip: 13493, vol: 15122.230, roofCorr: 0, density: 774.3, temp: 31.00, density15: 0.7829, tankTemp: 28.00, vcf: 0.9867, kl15: 14921.104 },
        tankBefore101: { dip: 3955, vol: 4873.279, roofCorr: 0, density: 777.4, temp: 26.40, density15: 0.7678, tankTemp: 30.60, vcf: 0.9819, kl15: 4785.073 },
        tankAfter101: { dip: 12619, vol: 14200.265, roofCorr: 0, density: 773.4, temp: 31.00, density15: 0.7797, tankTemp: 28.00, vcf: 0.9864, kl15: 14007.141 },
        recSummary: {
          blDensity: 0.7859,
          wcf: 0.7848,
          totalObsM3: 21915.641,
          totalVol15M3: 21653.935,
          usBarrels: 136267,
          longTons: 16725.661,
          metricTons: 16994.066,
          metricTonsBl: 17001.051,
          diffMt: -6.985,
          pctDiff: -0.04
        },
        remarks: 'Bulk discharge completed smoothly. All density tests passed JIG validation.',
        preparedBy: 'Ali Riza, Executive, DEPOT OPERATIONS'
      },
      {
        id: 'sh-diesel-02',
        vesselName: 'MT OCEAN PRIDE',
        shipmentNo: 'NS/SHIP-DIESEL/2026/02',
        product: FuelType.DIESEL,
        started: '2026-05-28 08:30',
        completed: '2026-05-29 16:45',
        quantityMt: 4200.000,
        recSummary: {
          blDensity: 0.8420,
          wcf: 0.8409,
          totalObsM3: 5050.000,
          totalVol15M3: 4980.000,
          usBarrels: 31320,
          longTons: 4125.000,
          metricTons: 4187.600,
          metricTonsBl: 4200.000,
          diffMt: -12.400,
          pctDiff: -0.29
        },
        remarks: 'Diesel gasoil reconciliation within tolerance.',
        preparedBy: 'Hussein Manik, Supervisor, DEPOT OPERATIONS'
      }
    ];
  }, []);

  // 3. CONSOLIDATED FUEL SUMMARY (Reconciliation Tab)
  // Summarize across facilities: Tanks, Refuellers, Hydrant dispensers
  const activeTanksTotal = useMemo(() => {
    const jet = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((sum, t) => sum + getHistoricalLevel(t.id, t.currentLevel, t.capacity, stockReportDate), 0);
    const diesel = (tanks || []).filter(t => t.type === FuelType.DIESEL).reduce((sum, t) => sum + getHistoricalLevel(t.id, t.currentLevel, t.capacity, stockReportDate), 0);
    const petrol = (tanks || []).filter(t => t.type === FuelType.PETROL).reduce((sum, t) => sum + getHistoricalLevel(t.id, t.currentLevel, t.capacity, stockReportDate), 0);
    return { jet, diesel, petrol };
  }, [tanks, stockReportDate]);

  const activeRefuellersTotal = useMemo(() => {
    // Dynamic sum of all refueller capacities/volumes
    const refuellers = (equipment || []).filter(e => e.type === 'Refueller');
    const totalVolume = refuellers.reduce((sum, e) => sum + getHistoricalLevel(e.id, e.currentVolume || 0, e.maxCapacity, stockReportDate), 0);
    return totalVolume;
  }, [equipment, stockReportDate]);

  const hydrantVehiclesCount = useMemo(() => {
    return (equipment || []).filter(e => e.type === 'Hydrant Dispenser' || e.type === 'Hydrant Service').length;
  }, [equipment]);

  // Aggregate current inventory grand total
  const consolidatedInventory = useMemo(() => {
    const totalStorage = activeTanksTotal.jet + activeTanksTotal.diesel + activeTanksTotal.petrol;
    const totalMobile = activeRefuellersTotal; // Refuellers
    return {
      storage: totalStorage,
      mobile: totalMobile,
      grandTotal: totalStorage + totalMobile
    };
  }, [activeTanksTotal, activeRefuellersTotal]);

  // Bulk totals by fuel grade (storage + mobile combined)
  const bulkTotals = useMemo(() => {
    const jetStorage = activeTanksTotal.jet;
    const jetMobile = activeRefuellersTotal;
    const jetTotal = jetStorage + jetMobile;

    const dieselStorage = activeTanksTotal.diesel;
    const dieselMobile = (equipment || [])
      .filter(e => e.type === 'Diesel Truck')
      .reduce((sum, e) => sum + getHistoricalLevel(e.id, e.currentVolume || 0, e.maxCapacity, stockReportDate), 0);
    const dieselTotal = dieselStorage + dieselMobile;

    const petrolTotal = activeTanksTotal.petrol;

    return {
      jet: jetTotal,
      diesel: dieselTotal,
      petrol: petrolTotal
    };
  }, [activeTanksTotal, activeRefuellersTotal, equipment, stockReportDate]);

  // Estimated depletion calculations based on daily averages
  const stockAvailability = useMemo(() => {
    const today = new Date(stockReportDate);
    
    // Jet A-1: 556,176 L/day
    const jetDays = 556176 > 0 ? Math.max(0, Math.round((bulkTotals.jet - 500000) / 556176)) : 0;
    const jetDate = new Date(today);
    jetDate.setDate(today.getDate() + jetDays);

    // Diesel: 15,200 L/day
    const dieselDays = 15200 > 0 ? Math.max(0, Math.round((bulkTotals.diesel - 5000) / 15200)) : 0;
    const dieselDate = new Date(today);
    dieselDate.setDate(today.getDate() + dieselDays);

    // Petrol: 9,800 L/day
    const petrolDays = 9800 > 0 ? Math.max(0, Math.round((bulkTotals.petrol - 2000) / 9800)) : 0;
    const petrolDate = new Date(today);
    petrolDate.setDate(today.getDate() + petrolDays);

    return {
      jet: { days: jetDays, date: jetDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) },
      diesel: { days: dieselDays, date: dieselDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) },
      petrol: { days: petrolDays, date: petrolDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) }
    };
  }, [bulkTotals, stockReportDate]);

  // Facility breakdown mapping
  const facilityItems = useMemo(() => {
    if (selectedFacility === 'MOBILE') {
      const items = (equipment || [])
        .filter(e => e.type === 'Refueller' || e.type === 'Diesel Truck' || e.type === 'Hydrant Service')
        .map(e => {
          const historicalVol = getHistoricalLevel(e.id, e.currentVolume || 0, e.maxCapacity, stockReportDate);
          return {
            id: e.id,
            name: e.name,
            type: e.type === 'Refueller' ? FuelType.JET_A1 : e.type === 'Diesel Truck' ? FuelType.DIESEL : 'Service Asset',
            capacity: e.maxCapacity,
            currentLevel: historicalVol,
            dipHeight: null,
            status: e.status,
            lastUpdated: e.lastUpdated
          };
        });

      // Sort to have JET A-1 first
      return items.sort((a, b) => {
        if (a.type === FuelType.JET_A1 && b.type !== FuelType.JET_A1) return -1;
        if (a.type !== FuelType.JET_A1 && b.type === FuelType.JET_A1) return 1;
        return 0;
      });
    }

    const matchingTanks = (tanks || []).filter(tank => {
      const id = tank.id.toLowerCase();
      if (selectedFacility === 'OFF') {
        return id.includes('off') || ['tk4', 'tk6', 'tk7', 'tk8', 'tk9'].includes(id);
      }
      if (selectedFacility === 'NFF') {
        return id.includes('nff') || ['tk101', 'tk102', 'tk103', 'tk106', 'tk201', 'tk202', 'tk301', 'tk302'].includes(id);
      }
      if (selectedFacility === 'SP') {
        return id.includes('spf');
      }
      if (selectedFacility === 'FS') {
        return id.includes('lfs') || id.includes('afs');
      }
      return false;
    });

    const mapped = matchingTanks.map(t => {
      const historicalVol = getHistoricalLevel(t.id, t.currentLevel, t.capacity, stockReportDate);
      const dip = lookupDipSync(t.id, historicalVol, t.capacity);
      return {
        id: t.id,
        name: t.name,
        type: t.type,
        capacity: t.capacity,
        currentLevel: historicalVol,
        dipHeight: dip,
        status: historicalVol === 0 ? 'Empty' : historicalVol >= t.capacity * 0.95 ? 'Full' : 'Active',
        lastUpdated: t.lastUpdated
      };
    });

    if (selectedFacility === 'NFF') {
      const nffEquipment = (equipment || [])
        .filter(e => e.id === 'HS-01' || e.id === 'HS-02')
        .map(e => {
          const historicalVol = getHistoricalLevel(e.id, e.currentVolume || 0, e.maxCapacity || 0, stockReportDate);
          return {
            id: e.id,
            name: `${e.name} (Hydrant Service)`,
            type: FuelType.JET_A1,
            capacity: e.maxCapacity || 0,
            currentLevel: historicalVol,
            dipHeight: null,
            status: e.status,
            lastUpdated: e.lastUpdated
          };
        });
      mapped.push(...nffEquipment);
    }

    // Sort to have JET A-1 first
    return mapped.sort((a, b) => {
      if (a.type === FuelType.JET_A1 && b.type !== FuelType.JET_A1) return -1;
      if (a.type !== FuelType.JET_A1 && b.type === FuelType.JET_A1) return 1;
      return 0;
    });
  }, [selectedFacility, tanks, equipment, stockReportDate]);

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            FUEL <span className="text-primary italic font-medium ml-3">REPORTS</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: FUEL DISPATCH</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Stock Audits</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline shrink-0 overflow-hidden w-full max-w-[420px] shadow-inner">
          <div 
            className={`absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
              ${activeTab === 'sales' ? 'left-1.5 translate-x-[0%]' : ''}
              ${activeTab === 'shipments' ? 'left-1.5 translate-x-[100%]' : ''}
              ${activeTab === 'reconciliation' ? 'left-1.5 translate-x-[200%]' : ''}
            `}
          />
          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'sales' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Fuel Sales
          </button>
          <button 
            onClick={() => setActiveTab('shipments')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'shipments' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Shipments Details
          </button>
          <button 
            onClick={() => setActiveTab('reconciliation')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'reconciliation' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Stock Summary
          </button>
        </div>
      </div>

      {/* ── TAB 1: FUEL SALES BREAKDOWN ── */}
      {activeTab === 'sales' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Segmented control for Fuel Type switcher with slide animation */}
          <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline shrink-0 overflow-hidden w-full max-w-[420px] shadow-inner mb-6">
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-gradient-to-r from-[#56c8eb] to-[#0ea5e9] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                ${salesFuelType === 'JET_A1' ? 'left-1.5 translate-x-[0%]' : 'left-1.5 translate-x-[100%]'}
              `}
            />
            <button 
              onClick={() => setSalesFuelType('JET_A1')}
              className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
                salesFuelType === 'JET_A1' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
              }`}
            >
              <Droplet className="w-3.5 h-3.5 mr-2" />
              Jet A-1 (Aviation)
            </button>
            <button 
              onClick={() => setSalesFuelType('GROUND_FUELS')}
              className={`flex-1 flex items-center justify-center py-2 text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
                salesFuelType === 'GROUND_FUELS' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 mr-2" />
              Diesel & Petrol (Ground)
            </button>
          </div>

          {/* High Fidelity Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline pb-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-on-surface tracking-tight uppercase">
                FUEL SERVICES DASHBOARD
              </h2>
              <span className="px-3 py-1 bg-black text-white text-xs font-mono font-black tracking-widest uppercase rounded flex items-center">
                <span className="w-1.5 h-3 bg-[#56c8eb] mr-2 inline-block"></span>
                {salesFuelType === 'JET_A1' ? 'JET A-1' : 'DIESEL & PETROL'}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-[#56c8eb] tracking-wider block">MALDIVES AIRPORTS Co.</span>
                <span className="text-[8px] italic text-slate-400 block">your journey • our business</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold text-xs border border-outline">
                VIA
              </div>
            </div>
          </div>

          {/* Dynamic Filters depending on selection */}
          {salesFuelType === 'JET_A1' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 bg-surface-dim/40 p-4 rounded-2xl border border-outline">
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Start Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDateJet} 
                    onChange={(e) => setStartDateJet(e.target.value)} 
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-mono font-bold select-text cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">End Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={endDateJet} 
                    onChange={(e) => setEndDateJet(e.target.value)} 
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-mono font-bold select-text cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Compare To</label>
                <select 
                  value={compareJet} 
                  onChange={(e) => setCompareJet(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  <option value="Previous Year">Previous Year</option>
                  <option value="Last Wk vs Prev Wk">Last Wk vs Prev Wk</option>
                  <option value="Curr Mo vs Last Mo">Curr Mo vs Last Mo</option>
                  <option value="Compare Airlines">Compare Airlines</option>
                  <option value="Compare Flights">Compare Flights</option>
                  <option value="Custom Dates">Custom Dates</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Category</label>
                <select 
                  value={categoryJet} 
                  onChange={(e) => setCategoryJet(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase"
                >
                  <option value="All Categories">All Categories</option>
                  <option value="International">International</option>
                  <option value="Domestic">Domestic</option>
                  <option value="Ad-hoc Int">Ad-hoc Int</option>
                  <option value="Ad-hoc Dom">Ad-hoc Dom</option>
                  <option value="Seaplane">Seaplane</option>
                  <option value="Local Sales">Local Sales</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Day of Week</label>
                <select 
                  value={dayOfWeekJet} 
                  onChange={(e) => setDayOfWeekJet(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  <option value="All Weekdays">All Weekdays</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Airline Name</label>
                <select 
                  value={airlineJet} 
                  onChange={(e) => setAirlineJet(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  <option value="All Airlines">All Airlines</option>
                  {uniqueAirlines.map(airline => (
                    <option key={airline} value={airline}>{airline}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Flight Number</label>
                <input 
                  type="text" 
                  placeholder="All Flights" 
                  value={flightNoJet} 
                  onChange={(e) => setFlightNoJet(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-end">
                <button className="w-12 py-2 bg-gradient-to-br from-[#0ea5e9] to-[#2563eb] hover:from-[#38bdf8] hover:to-[#3b82f6] text-white rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-md border-0 h-[34px]" title="Search">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 bg-surface-dim/40 p-4 rounded-2xl border border-outline">
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Start Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDateGround} 
                    onChange={(e) => setStartDateGround(e.target.value)} 
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-mono font-bold select-text cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">End Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={endDateGround} 
                    onChange={(e) => setEndDateGround(e.target.value)} 
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-mono font-bold select-text cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Compare To</label>
                <select 
                  value={compareGround} 
                  onChange={(e) => setCompareGround(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase cursor-pointer"
                >
                  <option value="Previous Year">Previous Year</option>
                  <option value="Last Wk vs Prev Wk">Last Wk vs Prev Wk</option>
                  <option value="Curr Mo vs Last Mo">Curr Mo vs Last Mo</option>
                  <option value="Compare Airlines">Compare Airlines</option>
                  <option value="Compare Flights">Compare Flights</option>
                  <option value="Custom Dates">Custom Dates</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Fuel Grade</label>
                <select 
                  value={fuelGradeGround} 
                  onChange={(e) => setFuelGradeGround(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase"
                >
                  <option value="All Grades">All Grades</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Facility / Source</label>
                <select 
                  value={facilityGround} 
                  onChange={(e) => setFacilityGround(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase"
                >
                  <option value="All Facilities">All Facilities</option>
                  <option value="Filling Station">Filling Station</option>
                  <option value="Mobile Trucks">Mobile Trucks</option>
                  <option value="Depot Generators">Depot Generators</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Dept / Customer</label>
                <select 
                  value={deptGround} 
                  onChange={(e) => setDeptGround(e.target.value)} 
                  className="px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold uppercase"
                >
                  <option value="All Departments">All Departments</option>
                  <option value="GSE Services">GSE Services</option>
                  <option value="Fire Service">Fire Service</option>
                  <option value="Airside Security">Airside Security</option>
                  <option value="Coast Guard / Vessels">Coast Guard / Vessels</option>
                  <option value="Local Sales / Others">Local Sales / Others</option>
                </select>
              </div>
              <div className="flex flex-col lg:col-span-2">
                <label className="text-[9px] font-black text-on-surface-dim uppercase mb-1 tracking-wider opacity-60">Search Asset / Trans ID</label>
                <div className="flex gap-1.5">
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchGround} 
                    onChange={(e) => setSearchGround(e.target.value)} 
                    className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline rounded-lg text-xs font-bold"
                  />
                  <button className="px-3 py-2 bg-gradient-to-br from-[#0ea5e9] to-[#2563eb] hover:from-[#38bdf8] hover:to-[#3b82f6] text-white rounded-lg flex items-center justify-center transition-all active:scale-95 border-0 h-[34px] w-12" title="Search">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* JET A-1 DASHBOARD UI */}
          {/* ───────────────────────────────────────────────────────────── */}
          {salesFuelType === 'JET_A1' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* KPI Cards (7 cards row) */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="card-premium p-4 border-l-4 border-l-primary flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Total Volume</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.totalVolume.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-blue-600 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">International</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.international.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-green-600 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Domestic</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.domestic.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-orange-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Ad-hoc Int</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.adhocInt.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-red-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Ad-hoc Dom</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.adhocDom.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-purple-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Seaplane</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.seaplane.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-gray-500 flex flex-col justify-between bg-surface-container">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Local Sales</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{jetData.kpi.localSales.toLocaleString()} L</span>
                  </div>
                </div>
              </div>

              {/* Comparison Analysis */}
              <div className="card-premium p-6">
                <div className="border-b border-outline pb-3 mb-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                    Comparison Analysis <span className="text-on-surface-dim font-bold font-mono">({startDateJet} to {endDateJet} vs Previous Period)</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Card 1: Total Volume Growth */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Total Volume Growth</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.volume}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentVol.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevVol.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 2: Refueling Count */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Refueling Count</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-red-600 font-mono flex items-center">
                        <TrendingDown className="w-5 h-5 mr-1" />
                        {jetData.growth.refueling}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentRefuel.toLocaleString()}</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevRefuel.toLocaleString()}</span></p>
                    </div>
                  </div>

                  {/* Card 3: Avg Volume */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Avg Volume</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.avgVol}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentAvg.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevAvg.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 4: Peak Single Day */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Peak Single Day</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-red-600 font-mono flex items-center">
                        <TrendingDown className="w-5 h-5 mr-1" />
                        {jetData.growth.peakDay}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentPeak.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevPeak.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 5: Avg Occupied Time */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Avg Occupied Time</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.occupiedTime}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentOccupiedTime} mins</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevOccupiedTime} mins</span></p>
                    </div>
                  </div>

                  {/* Card 6: Avg Refueling Time */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Avg Refueling Time</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.refuelingTime}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentRefuelTime} mins</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevRefuelTime} mins</span></p>
                    </div>
                  </div>

                  {/* Card 7: Active Hrs (Occupied) */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Active Hrs (Occupied)</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.activeHrsOccupied}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentActiveOccupied} hrs</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevActiveOccupied} hrs</span></p>
                    </div>
                  </div>

                  {/* Card 8: Active Hrs (Fuelling) */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Active Hrs (Fuelling)</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +{jetData.growth.activeHrsFuelling}%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{jetData.growth.currentActiveFuelling} hrs</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{jetData.growth.prevActiveFuelling} hrs</span></p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Daily Fueling Pattern & Sales Last 30 Days */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Daily Fueling Pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Daily Fueling Pattern <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Trend over selected period</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={jetData.dailyPattern}>
                        <defs>
                          <linearGradient id="colorJetVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                        <Area type="monotone" dataKey="volume" name="All Volume" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorJetVolume)" />
                        <Line type="monotone" dataKey="avg7Day" name="7-Day Avg" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="prevPeriod" name="Previous Period" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sales Last 30 Days */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Sales - Last 30 Days <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Daily volumes breakdown</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={jetData.sales30Days}>
                        <defs>
                          <linearGradient id="colorJet30Days" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                        <Area type="monotone" dataKey="volume" name="Daily Volume" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorJet30Days)" />
                        <Line type="monotone" dataKey="avg7Day" name="7-Day Avg" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="prevPeriod" name="Previous Period" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Turnaround Efficiency scatter plot */}
              <div className="card-premium p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                    Turnaround Efficiency <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Volume vs Duration</span>
                  </h3>
                  
                  {/* Segmented slider view switcher */}
                  <div className="relative flex bg-surface-dim p-1 rounded-xl border border-outline shrink-0 overflow-hidden w-[220px] shadow-inner">
                    <div 
                      className="absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-r from-[#56c8eb] to-[#0ea5e9] shadow-md transition-all duration-300 ease-out"
                      style={{
                        width: 'calc(50% - 4px)',
                        transform: `translateX(${turnaroundViewJet === 'aggregate' ? '100%' : '0%'})`
                      }}
                    />
                    <button 
                      onClick={() => setTurnaroundViewJet('individual')}
                      className={`relative z-10 flex-1 py-1 text-[9px] font-black tracking-wider uppercase transition-colors duration-300 rounded-lg ${
                        turnaroundViewJet === 'individual' ? 'text-white' : 'text-on-surface hover:text-primary'
                      }`}
                    >
                      Individual
                    </button>
                    <button 
                      onClick={() => setTurnaroundViewJet('aggregate')}
                      className={`relative z-10 flex-1 py-1 text-[9px] font-black tracking-wider uppercase transition-colors duration-300 rounded-lg ${
                        turnaroundViewJet === 'aggregate' ? 'text-white' : 'text-on-surface hover:text-primary'
                      }`}
                    >
                      Aggregate Avg.
                    </button>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-dim)" />
                      <XAxis type="number" dataKey="x" name="Duration" unit="m" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="y" name="Volume" unit="L" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                      <ZAxis type="number" range={[40, 40]} />
                      <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter 
                        name={turnaroundViewJet === 'individual' ? "Individual Flight" : "Carrier / Group"} 
                        data={turnaroundViewJet === 'individual' ? jetData.turnaroundIndividual : jetData.turnaroundAggregate} 
                        fill={turnaroundViewJet === 'individual' ? "#f59e0b" : "#3b82f6"} 
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hourly Fueling Pattern & Equipment Usage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Fueling Pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Hourly Fueling Pattern <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Distribution across 24 Hours</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={jetData.hourlyPattern}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="hour" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                        <Bar yAxisId="left" dataKey="count" name="Refuel Count" fill="#ef4444" opacity={0.6} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="volume" name="Volume (L)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Equipment Usage */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Equipment Usage <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Refuellers and hydrant dispenser performance</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={jetData.eqUsage}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="name" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                        <Bar yAxisId="left" dataKey="count" name="Refueling Count" fill="#f59e0b" opacity={0.7} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="volume" name="Total Volume (L)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Weekly Fueling Pattern & Stand Utilization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Weekly Fueling Pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Weekly Fueling Pattern <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Weekly sales breakdown</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jetData.weeklyPattern}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="week" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Weekly Volume (L)" fill="none" stroke="#10b981" strokeWidth={1.5} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stand & Pit Utilization */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Stand & Pit Utilization <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Fueling activity by stand</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jetData.standUtilization}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="stand" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '8px', fontWeight: 900 }} />
                        <Bar dataKey="International" stackId="a" fill="#002046" />
                        <Bar dataKey="Domestic" stackId="a" fill="#22c55e" />
                        <Bar dataKey="Ad-hoc Int" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Ad-hoc Dom" stackId="a" fill="#ef4444" />
                        <Bar dataKey="Seaplane" stackId="a" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Customers / Flights / Category Segment */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top 15 Customers (styled as top 10 for clean look) */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">Top Customers</h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jetData.topCustomers} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis dataKey="airline" type="category" tick={{fontSize: 7, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Volume (L)" fill="#002046" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top 15 Flight Numbers */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">Top Flight Numbers</h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={jetData.topFlights} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis dataKey="flight" type="category" tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Volume (L)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Fueling by Category Pie Chart */}
                <div className="card-premium p-6 flex flex-col justify-between">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-4">Fueling by Category</h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={jetData.pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={45} 
                          outerRadius={65} 
                          paddingAngle={3}
                        >
                          {jetData.pieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-outline/45 pt-4 mt-2">
                    {jetData.pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-[8px] font-black uppercase text-on-surface-dim">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detail Tables Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Table 1: International Airlines */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">International Airline Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Airline</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Reps</th>
                          <th className="px-4 py-2.5 text-right">Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {jetData.tables.intAirlinesTable.map((row) => (
                          <tr key={row.airline} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase truncate max-w-[120px]">{row.airline}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                            <td className="px-4 py-2 text-right font-mono text-on-surface-dim">{row.avg.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Flight Number */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">Flight Number Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Flight</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Reps</th>
                          <th className="px-4 py-2.5 text-right">Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {jetData.tables.flightTable.map((row) => (
                          <tr key={row.flight} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase font-mono">{row.flight}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                            <td className="px-4 py-2 text-right font-mono text-on-surface-dim">{row.avg.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 3: Pit Usage */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">Pit & Stand Usage</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Pit ID</th>
                          <th className="px-4 py-2.5">Stand</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Reps</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {jetData.tables.pitTable.map((row) => (
                          <tr key={row.pit} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase font-mono">{row.pit}</td>
                            <td className="px-4 py-2 font-bold text-on-surface-dim">{row.stand}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* DIESEL & PETROL COMBINED DASHBOARD UI */}
          {/* ───────────────────────────────────────────────────────────── */}
          {salesFuelType === 'GROUND_FUELS' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* KPI Cards (7 cards row) */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="card-premium p-4 border-l-4 border-l-primary flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Total volume</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.totalVolume.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-success flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Diesel volume</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.dieselVolume.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-warning flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Petrol volume</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.petrolVolume.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-blue-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">GSE Services</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.gseConsumption.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-purple-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Depot Generator</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.depotGenerator.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-orange-500 flex flex-col justify-between">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Vessels / Marine</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.vesselMarine.toLocaleString()} L</span>
                  </div>
                </div>
                <div className="card-premium p-4 border-l-4 border-l-gray-500 flex flex-col justify-between bg-surface-container">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Local Sales</span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-on-surface font-mono">{groundData.kpi.localSales.toLocaleString()} L</span>
                  </div>
                </div>
              </div>

              {/* Comparison Analysis */}
              <div className="card-premium p-6">
                <div className="border-b border-outline pb-3 mb-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                    Ground Operations Comparison <span className="text-on-surface-dim font-bold font-mono">({startDateGround} to {endDateGround} vs Previous Period)</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  
                  {/* Card 1: Volume Growth */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Volume Growth</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +8.2%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{groundData.growth.currentVol.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{groundData.growth.prevVol.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 2: Fill Transactions */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Fill Count</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +4.5%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{groundData.growth.currentTransactions.toLocaleString()}</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{groundData.growth.prevTransactions.toLocaleString()}</span></p>
                    </div>
                  </div>

                  {/* Card 3: Avg Fill Volume */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Avg Fill Volume</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +3.5%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{groundData.growth.currentAvg.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{groundData.growth.prevAvg.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 4: Peak Single Day */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Peak Single Day</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +12.0%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{groundData.growth.currentPeak.toLocaleString()} L</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{groundData.growth.prevPeak.toLocaleString()} L</span></p>
                    </div>
                  </div>

                  {/* Card 5: Active Hrs */}
                  <div className="bg-surface-dim/30 p-4 rounded-xl border border-outline/65 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Dispense Activity</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-green-600 font-mono flex items-center">
                        <TrendingUp className="w-5 h-5 mr-1" />
                        +5.0%
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-on-surface-dim">
                      <p>Current: <span className="font-mono text-on-surface">{groundData.growth.currentActiveHrs} hrs</span></p>
                      <p>Previous: <span className="font-mono text-on-surface-dim">{groundData.growth.prevActiveHrs} hrs</span></p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Daily Filling Pattern & Sales Last 30 Days */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Daily filling pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Daily Filling Pattern <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Ground fuels daily volumes</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={groundData.dailyPattern}>
                        <defs>
                          <linearGradient id="colorGroundVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                        <Area type="monotone" dataKey="volume" name="All Volume" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGroundVolume)" />
                        <Line type="monotone" dataKey="avg7Day" name="7-Day Avg" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                        <Line type="monotone" dataKey="prevPeriod" name="Previous Period" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sales Last 30 Days (Diesel vs Petrol stacked area) */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Ground Fuel Sales Breakdown <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Diesel vs Petrol comparison (Last 30 Days)</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={groundData.sales30Days}>
                        <defs>
                          <linearGradient id="colorDiesel" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPetrol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                        <Area type="monotone" stackId="1" dataKey="diesel" name="Diesel (Gasoil)" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorDiesel)" />
                        <Area type="monotone" stackId="1" dataKey="petrol" name="Petrol (Mogas)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPetrol)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Turnaround/Filling Efficiency scatter plot */}
              <div className="card-premium p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                    Filling Operational Efficiency <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Liters Filled vs Fill Duration</span>
                  </h3>
                  
                  {/* Segmented slider view switcher */}
                  <div className="relative flex bg-surface-dim p-1 rounded-xl border border-outline shrink-0 overflow-hidden w-[220px] shadow-inner">
                    <div 
                      className="absolute top-1 bottom-1 left-1 rounded-lg bg-gradient-to-r from-[#56c8eb] to-[#0ea5e9] shadow-md transition-all duration-300 ease-out"
                      style={{
                        width: 'calc(50% - 4px)',
                        transform: `translateX(${turnaroundViewGround === 'aggregate' ? '100%' : '0%'})`
                      }}
                    />
                    <button 
                      onClick={() => setTurnaroundViewGround('individual')}
                      className={`relative z-10 flex-1 py-1 text-[9px] font-black tracking-wider uppercase transition-colors duration-300 rounded-lg ${
                        turnaroundViewGround === 'individual' ? 'text-white' : 'text-on-surface hover:text-primary'
                      }`}
                    >
                      Individual
                    </button>
                    <button 
                      onClick={() => setTurnaroundViewGround('aggregate')}
                      className={`relative z-10 flex-1 py-1 text-[9px] font-black tracking-wider uppercase transition-colors duration-300 rounded-lg ${
                        turnaroundViewGround === 'aggregate' ? 'text-white' : 'text-on-surface hover:text-primary'
                      }`}
                    >
                      Aggregate Avg.
                    </button>
                  </div>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-dim)" />
                      <XAxis type="number" dataKey="x" name="Duration" unit="m" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="y" name="Volume" unit="L" tickFormatter={(v) => `${v}`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                      <ZAxis type="number" range={[45, 45]} />
                      <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter 
                        name={turnaroundViewGround === 'individual' ? "Individual Dispense" : "Facility / Group"} 
                        data={turnaroundViewGround === 'individual' ? groundData.turnaroundIndividual : groundData.turnaroundAggregate} 
                        fill={turnaroundViewGround === 'individual' ? "#8b5cf6" : "#3b82f6"} 
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hourly Filling Pattern & Pump/Dispenser Usage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hourly Filling Pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Hourly Filling Distribution <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Dispense count and volume by hour</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={groundData.hourlyPattern}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="hour" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                        <Bar yAxisId="left" dataKey="count" name="Transaction Count" fill="#3b82f6" opacity={0.6} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="volume" name="Volume (L)" stroke="#10b981" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pump / Dispenser Usage */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Station & Pump Usage <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Transaction counts and volumes per dispenser</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={groundData.eqUsage}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="name" tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                        <Bar yAxisId="left" dataKey="count" name="Dispenses" fill="#eab308" opacity={0.7} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="volume" name="Liters Dispensed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Weekly Pattern & Station Utilization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Weekly Pattern */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Weekly Filling Pattern <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Weekly ground fuels consumption</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groundData.weeklyPattern}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="week" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Weekly Volume (L)" fill="none" stroke="#f59e0b" strokeWidth={1.5} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Station & Facility Utilization */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">
                    Facility Utilization Breakdown <span className="text-[10px] text-on-surface-dim font-bold block mt-1 uppercase">Diesel vs Petrol share by facility</span>
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groundData.stationUtilization}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis dataKey="name" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                        <Bar dataKey="Diesel" stackId="a" fill="#22c55e" />
                        <Bar dataKey="Petrol" stackId="a" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Customers / Vehicles / Category Segment */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Customer Departments */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">Top Customer Departments</h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groundData.topCustomers} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{fontSize: 7, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Volume (L)" fill="#002046" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Vehicle Types */}
                <div className="card-premium p-6">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-6">Top Vehicle Types</h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groundData.topVehicles} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                        <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{fontSize: 8}} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{fontSize: 8, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" name="Volume (L)" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category Pie Chart */}
                <div className="card-premium p-6 flex flex-col justify-between">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-wider mb-4">Ground Fuel by Category</h3>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={groundData.pieData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={45} 
                          outerRadius={65} 
                          paddingAngle={3}
                        >
                          {groundData.pieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-outline/45 pt-4 mt-2">
                    {groundData.pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-[8px] font-black uppercase text-on-surface-dim">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detail Tables Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Table 1: Departmental Consumption */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">Departmental Consumption</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Department</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Fills</th>
                          <th className="px-4 py-2.5 text-right">Avg (L)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {groundData.tables.deptTable.map((row) => (
                          <tr key={row.dept} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase truncate max-w-[120px]">{row.dept}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                            <td className="px-4 py-2 text-right font-mono text-on-surface-dim">{row.avg.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Asset Consumption */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">Asset Consumption</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Asset ID</th>
                          <th className="px-4 py-2.5">Fuel</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Fills</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {groundData.tables.assetTable.map((row) => (
                          <tr key={row.asset} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase font-mono">{row.asset}</td>
                            <td className="px-4 py-2 font-bold text-on-surface-dim">{row.fuel}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 3: Station/Pump Utilization */}
                <div className="card-premium overflow-hidden">
                  <div className="px-6 py-4 border-b border-outline bg-surface-dim/40">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-wider">Station & Dispenser Sales</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-surface-dim/60 border-b border-outline text-[9px] font-black text-on-surface-dim uppercase">
                          <th className="px-4 py-2.5">Station / Pump</th>
                          <th className="px-4 py-2.5 text-right">Vol (L)</th>
                          <th className="px-4 py-2.5 text-center">Dispenses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {groundData.tables.stationTable.map((row) => (
                          <tr key={row.station} className="hover:bg-primary/[0.01]">
                            <td className="px-4 py-2 font-black uppercase truncate max-w-[150px]">{row.station}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold">{row.volume.toLocaleString()}</td>
                            <td className="px-4 py-2 text-center font-bold">{row.reps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* ── TAB 2: SHIPMENT DETAILS (Marine Receipts & Figure 1.5 template) ── */}
      {activeTab === 'shipments' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          <div className="card-premium p-6 lg:p-8">
            <h2 className="title-md text-on-surface uppercase tracking-tight font-black mb-6">Marine Tanker Discharge Log Ledger</h2>
            <div className="overflow-x-auto border border-outline rounded-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-dim/60 border-b border-outline">
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Receipt Date</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Vessel Particulars</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Shipment ID</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Fuel Grade</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Quantity (MT)</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {shipmentLogs.map((ship) => (
                    <tr key={ship.id} className="hover:bg-primary/[0.01] transition-colors">
                      <td className="px-8 py-4 text-xs font-bold opacity-60 whitespace-nowrap">{ship.completed.split(' ')[0]}</td>
                      <td className="px-8 py-4 text-xs font-black uppercase text-on-surface">{ship.vesselName}</td>
                      <td className="px-8 py-4 text-[10px] font-black opacity-75">{ship.shipmentNo}</td>
                      <td className="px-8 py-4 text-xs">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase ${
                          ship.product === FuelType.JET_A1 ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                        }`}>
                          {ship.product}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{ship.quantityMt.toLocaleString()} MT</td>
                      <td className="px-8 py-4 text-center">
                        <button 
                          onClick={() => setSelectedShipment(ship)}
                          className="px-4 py-2 kinetic-gradient text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-premium hover:scale-105"
                        >
                          View Receipt (Fig 1.5)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: FUEL STOCK SUMMARY & PHYSICAL RECONCILIATION ── */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">

          {/* Historical Date Selector Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-dim/20 p-5 rounded-2xl border border-outline/50 shadow-sm shrink-0">
            <div>
              <h2 className="text-xs font-black uppercase text-on-surface tracking-[0.2em]">Operational Stock Snapshots</h2>
              <p className="text-[9px] text-on-surface-dim uppercase tracking-wider opacity-60 mt-1">Select reporting date to view previous days' inventory snapshot</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Calendar className="w-4 h-4 text-primary" />
              <input 
                type="date" 
                value={stockReportDate}
                onChange={(e) => setStockReportDate(e.target.value)}
                className="px-4 py-2 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none font-mono text-on-surface select-text cursor-pointer hover:border-primary/50 transition-colors"
              />
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-premium"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          </div>
          
          {/* Consolidated Active Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-primary">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Depot Active Storage</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{(consolidatedInventory.storage / 1000000).toFixed(2)}M L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Bulk Farm Tanks (TK-101/102/103/4/6/7)</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-success">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Refuellers mobile Volume</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{consolidatedInventory.mobile.toLocaleString()} L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Active mobile refueller fleet</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-warning">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Hydrant Vehicles Count</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{hydrantVehiclesCount} HS Vehicles</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Hydrant service/dispenser fleet</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-primary/5 flex flex-col justify-between border border-primary/20 shadow-premium">
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Grand consolidated Stock</span>
              <div>
                <span className="text-2xl font-[900] text-primary font-mono tracking-tighter shadow-glow">{(consolidatedInventory.grandTotal / 1000000).toFixed(2)}M L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Active across entire facility</p>
              </div>
            </div>
          </div>

          {/* Bulk Totals by Fuel Grade */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Jet A-1 Bulk */}
            <div className="card-premium p-6 bg-surface-dim/20 border border-outline/50 flex items-center gap-4">
              <div className="p-3.5 bg-primary/10 rounded-2xl text-primary shrink-0">
                <Droplet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Jet A-1 Combined Stock</span>
                <span className="text-xl font-extrabold text-on-surface font-mono">{bulkTotals.jet.toLocaleString()} L</span>
              </div>
            </div>
            {/* Diesel Bulk */}
            <div className="card-premium p-6 bg-surface-dim/20 border border-outline/50 flex items-center gap-4">
              <div className="p-3.5 bg-success/10 rounded-2xl text-success shrink-0">
                <Fuel className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Diesel Combined Stock</span>
                <span className="text-xl font-extrabold text-on-surface font-mono">{bulkTotals.diesel.toLocaleString()} L</span>
              </div>
            </div>
            {/* Petrol Bulk */}
            <div className="card-premium p-6 bg-surface-dim/20 border border-outline/50 flex items-center gap-4">
              <div className="p-3.5 bg-warning/10 rounded-2xl text-warning shrink-0">
                <Fuel className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Petrol Combined Stock</span>
                <span className="text-xl font-extrabold text-on-surface font-mono">{bulkTotals.petrol.toLocaleString()} L</span>
              </div>
            </div>
          </div>

          {/* Estimated Stock Availability & Depletion Forecasts */}
          <div className="card-premium p-6 lg:p-8 bg-surface-dim/40 border border-outline/80">
            <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center border-b border-outline pb-4">
              <Info className="w-5 h-5 mr-3 text-primary" />
              Estimated Stock Availability & Depletion Forecasts
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Jet A-1 Forecast */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider">Jet A-1 (Aviation)</span>
                  <span className="text-xs font-bold text-primary font-mono">{stockAvailability.jet.days} Days</span>
                </div>
                <div className="h-2 w-full bg-outline/25 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stockAvailability.jet.days < 15 ? 'bg-error animate-pulse' : 'bg-primary'}`} style={{ width: `${Math.min(100, (stockAvailability.jet.days / 45) * 100)}%` }} />
                </div>
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">Stock will last till: <span className="text-on-surface font-bold font-mono">{stockAvailability.jet.date}</span></p>
              </div>
              {/* Diesel Forecast */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider">Diesel (Gasoil)</span>
                  <span className="text-xs font-bold text-success font-mono">{stockAvailability.diesel.days} Days</span>
                </div>
                <div className="h-2 w-full bg-outline/25 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stockAvailability.diesel.days < 10 ? 'bg-error animate-pulse' : 'bg-success'}`} style={{ width: `${Math.min(100, (stockAvailability.diesel.days / 30) * 100)}%` }} />
                </div>
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">Stock will last till: <span className="text-on-surface font-bold font-mono">{stockAvailability.diesel.date}</span></p>
              </div>
              {/* Petrol Forecast */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-on-surface uppercase tracking-wider">Petrol (Mogas)</span>
                  <span className="text-xs font-bold text-warning font-mono">{stockAvailability.petrol.days} Days</span>
                </div>
                <div className="h-2 w-full bg-outline/25 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ${stockAvailability.petrol.days < 10 ? 'bg-error animate-pulse' : 'bg-warning'}`} style={{ width: `${Math.min(100, (stockAvailability.petrol.days / 30) * 100)}%` }} />
                </div>
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">Stock will last till: <span className="text-on-surface font-bold font-mono">{stockAvailability.petrol.date}</span></p>
              </div>
            </div>
          </div>

          {/* Facility Breakdown Section */}
          <div className="card-premium overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-5 border-b border-outline bg-surface-dim/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em]">Facility Inventory Breakdown</h3>
                <p className="text-[10px] text-on-surface-dim uppercase mt-1 opacity-50 tracking-wider">Derived from Stock Management and Equipment Status</p>
              </div>
              
              {/* Facility Navigation Switcher */}
              <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline overflow-hidden w-full max-w-[650px] shadow-inner shrink-0">
                <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(20%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                    ${selectedFacility === 'NFF' ? 'left-1.5 translate-x-[0%]' : ''}
                    ${selectedFacility === 'OFF' ? 'left-1.5 translate-x-[100%]' : ''}
                    ${selectedFacility === 'SP' ? 'left-1.5 translate-x-[200%]' : ''}
                    ${selectedFacility === 'FS' ? 'left-1.5 translate-x-[300%]' : ''}
                    ${selectedFacility === 'MOBILE' ? 'left-1.5 translate-x-[400%]' : ''}
                  `}
                />
                {(['NFF', 'OFF', 'SP', 'FS', 'MOBILE'] as const).map(fac => (
                  <button
                    key={fac}
                    onClick={() => setSelectedFacility(fac)}
                    className={`flex-1 flex items-center justify-center py-2.5 text-[9px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
                      selectedFacility === fac ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
                    }`}
                  >
                    {fac === 'SP' ? 'SEAPLANE FUEL' : fac === 'FS' ? 'FILLING STATIONS' : fac === 'MOBILE' ? 'MOBILE EQ' : fac}
                  </button>
                ))}
              </div>
            </div>

            {/* Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-dim/60 border-b border-outline">
                    <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Asset / Tank ID</th>
                    <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Fuel Grade</th>
                    <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Capacity (L)</th>
                    <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Current Level (L)</th>
                    {selectedFacility !== 'MOBILE' && (
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Dip Sounding (mm)</th>
                    )}
                    <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Ullage (L)</th>
                    <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {facilityItems.map((item) => {
                    const ullage = Math.max(0, item.capacity - item.currentLevel);
                    const cleanName = item.name.replace(/\s*\(NFF\)/gi, '').replace(/\s*\(OFF\)/gi, '');
                    return (
                      <tr key={item.id} className="hover:bg-primary/[0.01] transition-colors">
                        <td className="px-6 py-4 text-xs font-black uppercase text-on-surface">{cleanName}</td>
                        <td className="px-6 py-4 text-xs">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                            item.type === FuelType.JET_A1 ? 'bg-primary/10 text-primary' :
                            item.type === FuelType.DIESEL ? 'bg-success/10 text-success' :
                            item.type === FuelType.PETROL ? 'bg-warning/10 text-warning' : 'bg-outline/20 text-on-surface-dim'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-on-surface">
                          {item.capacity > 0 ? item.capacity.toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-xs font-bold text-on-surface">
                          {item.currentLevel.toLocaleString()}
                        </td>
                        {selectedFacility !== 'MOBILE' && (
                          <td className="px-6 py-4 text-center font-mono text-xs text-on-surface">
                            {item.dipHeight !== null ? (
                              <span className="font-bold text-primary">{item.dipHeight.toLocaleString()}</span>
                            ) : (
                              <span className="text-on-surface-dim opacity-40 italic">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 text-right font-mono text-xs text-on-surface-dim">
                          {item.capacity > 0 ? ullage.toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase ${
                            item.status === 'Active' || item.status === 'Available' || item.status === 'Full'
                              ? 'bg-success/10 text-success' 
                              : item.status === 'Maintenance' || item.status === 'In Use' || item.status === 'Refuelling'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-error/10 text-error'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ── HIGH FIDELITY MACL Figure 1.5 TEMPLATE POPUP MODAL ── */}
      {/* ── HIGH FIDELITY MACL Figure 1.5 TEMPLATE POPUP MODAL ── */}
      {selectedShipment && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface text-on-surface border border-outline w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl rounded-2xl shadow-premium overflow-hidden flex flex-col my-8 relative max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="receipt-modal-header-footer px-8 py-4 border-b border-outline flex justify-between items-center text-on-surface shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">JIG Compliance Document Viewer</span>
              </div>
              <button 
                onClick={() => setSelectedShipment(null)}
                className="p-1.5 rounded-lg text-on-surface-dim hover:text-on-surface hover:bg-on-surface/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content Scroll Area */}
            <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar bg-surface-dim">
              
              {/* Figure 1.5 Replica Layout */}
              <div className="border-[3px] border-black p-6 font-sans text-xs bg-white text-black select-text min-w-[760px] mx-auto shadow-md">
                
                {/* Brand Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                  <div>
                    <h2 className="text-[13px] font-black tracking-tight leading-tight">FUEL SERVICES SECTION</h2>
                    <h3 className="text-[11px] font-bold text-slate-600">VELANA INTERNATIONAL AIRPORT</h3>
                    <h3 className="text-[10px] font-medium text-slate-500">MALDIVES AIRPORTS COMPANY LTD</h3>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="font-extrabold text-[12px] text-blue-900 tracking-wider">MALDIVES AIRPORTS Co.</div>
                    <div className="text-[8px] italic text-slate-400">your journey • our business</div>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center py-4">
                  <h1 className="text-xl font-black tracking-widest uppercase border-b-2 border-black inline-block px-10 pb-1">{selectedShipment.product.toUpperCase()} RECEIPT REPORT</h1>
                </div>

                {/* Vessel Manifest Metadata */}
                <table className="w-full border-collapse border border-black mb-6">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">NAME OF THE TANKER</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.vesselName}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">SHIPMENT NO</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.shipmentNo}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">STARTED</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.started}</td>
                    </tr>
                    <tr>
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">COMPLETED</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.completed}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Dip Tank Readings Table (Figure 1.5 exact replication format) */}
                <table className="w-full border-collapse border border-black text-center mb-6">
                  <thead>
                    <tr className="border-b border-black bg-slate-100">
                      <th className="border-r border-black p-2 font-black rowspan-2 text-left" rowSpan={2}>TANK NO</th>
                      <th className="border-r border-black p-2 font-black colspan-2" colSpan={2}>TANK NO : 103</th>
                      <th className="border-r border-black p-2 font-black colspan-2" colSpan={2}>TANK NO : 101</th>
                      <th className="p-2 font-black w-16" rowSpan={2}></th>
                    </tr>
                    <tr className="border-b border-black bg-slate-50">
                      <th className="border-r border-black p-1.5 font-bold">BEFORE</th>
                      <th className="border-r border-black p-1.5 font-bold">AFTER</th>
                      <th className="border-r border-black p-1.5 font-bold">BEFORE</th>
                      <th className="border-r border-black p-1.5 font-bold">AFTER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Gross Dip MM */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">GROSS DIP <span className="float-right font-medium text-slate-500">MM</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.dip.toLocaleString()}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Table Volume KL */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TABLE VOLUME <span className="float-right font-medium text-slate-500">KL</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vol.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Roof Correction */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">ROOF CORRECTION</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.roofCorr}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Recalculated Volume */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TABLE VOLUME <span className="float-right font-medium text-slate-500">KL</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vol.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Total Observed Volume */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TOTAL OBSERVED VOLUME</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>12,588.655 KL</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>9,326.986 KL</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Observed Density */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">DENSITY OBSERVED</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.density.toFixed(1)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Temperature */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TEMPERATURE <span className="float-right font-medium text-slate-500">°C</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.temp.toFixed(2)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Density at 15 °C */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">DENSITY AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.density15.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.density15.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vcf.toFixed(4)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Tank Temp */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TANK TEMPERATURE <span className="float-right font-medium text-slate-500">°C</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.tankTemp.toFixed(2)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* VCF */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">V.C.F</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vcf.toFixed(4)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* KL at 15 °C */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">KILO LITRES AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.kl15.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Total receipt */}
                    <tr>
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">RECEIPT AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>12,431.867 KL</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>9,222.068 KL</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                  </tbody>
                </table>

                {/* Bottom section: Receipts Summary & Remarks (Double column) */}
                <div className="grid grid-cols-2 gap-6 border border-black p-4">
                  {/* Left Column: Receipts Summary */}
                  <div>
                    <h3 className="font-extrabold border-b border-black pb-1 mb-2 text-center uppercase bg-slate-100">RECEIPTS</h3>
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">B/L DENSITY</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.blDensity.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">W.C.F</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.wcf.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">TOTAL OBSVD. VOLUME / M³</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.totalObsM3.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">TOTAL VOLUME @ 15 °C / M³</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.totalVol15M3.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">US BARRELS @ 60 °F</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.usBarrels.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">LONG TONS (AIR)</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.longTons.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">METRIC TONS (AIR)</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.metricTons.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">METRIC TONS (AIR) B/L</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.metricTonsBl.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">DIFF BETWEEN B/L & OUT TURN</td>
                          <td className="text-right font-mono font-bold text-red-600">{selectedShipment.recSummary?.diffMt.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="font-black py-1">PERCENTAGE DIFFERENCE</td>
                          <td className="text-right font-mono font-black text-red-600">{selectedShipment.recSummary?.pctDiff}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column: Remarks & Prepared By */}
                  <div className="flex flex-col justify-between border-l border-slate-300 pl-4">
                    <div>
                      <h3 className="font-extrabold border-b border-black pb-1 mb-2 text-center uppercase bg-slate-100">REMARKS:</h3>
                      <p className="text-xs text-slate-700 leading-relaxed font-bold italic p-2 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                        {selectedShipment.remarks}
                      </p>
                    </div>

                    <div className="border-t border-slate-300 pt-4 mt-6">
                      <p className="font-black text-slate-400 text-[8px] uppercase tracking-wider">PREPARED BY:</p>
                      <p className="font-black text-blue-900 text-sm italic mt-2">{selectedShipment.preparedBy.split(',')[0]}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedShipment.preparedBy.split(',').slice(1).join(', ')}</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="receipt-modal-header-footer px-8 py-5 border-t border-outline flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setSelectedShipment(null)}
                className="px-6 py-2.5 bg-surface-container border border-outline hover:bg-surface-container-highest text-on-surface rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 hover:scale-105 shadow-sm"
              >
                Close Receipt
              </button>
              <button 
                onClick={() => alert('Initiating secure PDF compilation under MACL standard format...')}
                className="px-6 py-2.5 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all border-none"
              >
                Download PDF Format
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
