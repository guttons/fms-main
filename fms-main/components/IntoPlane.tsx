import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FlightLog, User, FlightJob, Equipment, EquipmentStatus, UserRole } from '../types';
import { MOCK_USERS, MOCK_ADHOC_FLIGHTS, PIT_MAPPING } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Users, Lock, Calendar, X, CreditCard, Ban, Eye, Zap, Bell, Droplet, PlaneLanding, PlaneTakeoff, ArrowRightCircle, Check } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { equipmentBadgeClass, equipmentDotClass, getEquipmentHexColor } from '../utils/equipmentColors';
import { useNotification } from '../context/NotificationContext';

import { useOperationalData } from '../context/OperationalDataContext';

interface IntoPlaneProps {
    user: User;
    initialJob?: FlightJob | null;
    onClearInitialJob?: () => void;
    initialVehicleId?: string | null;
    onClearInitialVehicleId?: () => void;
}


const getAirlineName = (flightNumber: string, externalFlights: any[]) => {
  const cleanNo = (flightNumber || '').replace(/\s+/g, '').toLowerCase();
  const matched = (externalFlights || []).find(f => (f.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
  if (matched?.airline) return matched.airline;
  
  // Fallback common mapping
  const code = cleanNo.slice(0, 2).toUpperCase();
  const airlineCodes: Record<string, string> = {
    'EK': 'Emirates',
    'UL': 'SriLankan Airlines',
    'QR': 'Qatar Airways',
    'EY': 'Etihad Airways',
    '6E': 'Indigo',
    'GF': 'Gulf Air',
    'TK': 'Turkish Airlines',
    'FZ': 'Flydubai',
    'SQ': 'Singapore Airlines',
    'SV': 'Saudia',
    'AI': 'Air India',
    'UK': 'Vistara',
    'WY': 'Oman Air',
    'BA': 'British Airways',
    'QTR': 'Qatar Airways',
    'UAE': 'Emirates',
    'Q2': 'Maldivian',
    'NR': 'Manta Air',
    'VP': 'Villa Air'
  };
  return airlineCodes[code] || '';
};

const isOperator = (role: UserRole) => role === UserRole.ITP_OPERATOR || role === UserRole.ITP_SUPERVISOR;

const getFuelColorClass = (volume: number | undefined, maxCapacity: number): string => {
  if (volume === undefined) return 'text-primary';
  
  // Rule for 16K (16000) or 19K (19000)
  if (maxCapacity === 16000 || maxCapacity === 19000) {
    if (volume < 5000) return 'text-error';
    if (volume <= 10000) return 'text-warning';
    return 'text-primary';
  }
  
  // Rule for 58K (58000)
  if (maxCapacity === 58000) {
    if (volume < 10000) return 'text-error';
    if (volume < 20000) return 'text-warning';
    return 'text-primary';
  }
  
  // Default/Fallback logic using percentage
  if (maxCapacity > 0) {
    const pct = (volume / maxCapacity) * 100;
    if (pct < 15) return 'text-error';
    if (pct < 30) return 'text-warning';
    return 'text-primary';
  }
  
  return 'text-primary';
};


const MobileHeader: React.FC<{ 
    user: User, 
    isOnline: boolean, 
    activeFlight: Partial<FlightLog> | null,
    selectedVehicleId: string,
    setSelectedVehicleId: (id: string) => void,
    equipment: Equipment[],
    paymentType: string,
    setPaymentType: (v: string) => void,
    cashRate: string,
    setCashRate: (rate: string) => void
}> = ({ user, isOnline, activeFlight, selectedVehicleId, setSelectedVehicleId, equipment, paymentType, setPaymentType, cashRate, setCashRate }) => (
  <div className="bg-surface text-on-surface p-4 border-b border-outline sticky top-0 z-30 transition-colors shadow-sm flex items-center justify-between gap-3 overflow-hidden">
      <div className="flex items-center flex-1 min-w-0">
          <Truck className="w-5 h-5 mr-3 text-primary animate-pulse flex-shrink-0" />
          
          <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80 leading-none hidden sm:block">Unit</span>
              
              {activeFlight && (
                  <div className="md:hidden flex items-center h-[30px]">
                      <span 
                        className="bg-surface-container-low border-transparent rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-widest leading-none shadow-sm"
                        style={{ color: getEquipmentHexColor(activeFlight.vehicleId) }}
                      >
                          {activeFlight.vehicleId}
                      </span>
                  </div>
              )}

              <div className={`relative ${activeFlight ? 'hidden md:block' : 'block'}`}>
                  <select 
                      value={activeFlight?.vehicleId || selectedVehicleId}
                      disabled={!!activeFlight}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      style={{ color: getEquipmentHexColor(activeFlight?.vehicleId || selectedVehicleId) }}
                      className="bg-surface-container-highest border border-outline rounded-lg py-2 pl-3 pr-8 text-[12px] font-bold shadow-sm appearance-none focus:border-primary transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-fit"
                  >
                        {equipment
                          .filter(eq => {
                            const isRf = eq.id.startsWith('RF');
                            const isHd = eq.id.startsWith('HD');
                            if (isRf) {
                              return (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === selectedVehicleId);
                            }
                            return isHd && (eq.status === EquipmentStatus.AVAILABLE || eq.id === selectedVehicleId);
                          })
                         .map(eq => (
                            <option 
                              key={eq.id} 
                              value={eq.id} 
                              style={{ color: getEquipmentHexColor(eq.id) }}
                              className="bg-surface-dim text-on-surface font-bold uppercase"
                            >
                              {eq.id}
                            </option>
                       ))}
                  </select>
                  <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim rotate-90 pointer-events-none" />
              </div>

              {/* Payment Type Dropdown — hidden once job is active */}
              {!activeFlight && (
                  <div className="flex items-center gap-2">
                      <div className="relative">
                          <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className={`rounded-lg py-2 pl-3 pr-7 text-[11px] font-black shadow-sm appearance-none focus:border-primary transition-all cursor-pointer uppercase tracking-widest border
                                  ${ paymentType === 'VOID'
                                      ? 'bg-error/10 border-error/40 text-error'
                                      : paymentType === 'CASH'
                                      ? 'border-[#22c55e]/50 text-[#22c55e]'
                                      : 'bg-surface-container-highest border-outline text-on-surface-dim'}
                              `}
                              style={paymentType === 'CASH' ? { backgroundColor: 'rgba(34,197,94,0.1)' } : undefined}
                          >
                              <option value="CREDIT" className="bg-surface-dim text-on-surface">CREDIT</option>
                              <option value="CASH" className="bg-surface-dim text-on-surface">CASH</option>
                              <option value="VOID" className="bg-surface-dim text-on-surface">VOID</option>
                          </select>
                          <ChevronRight className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-dim rotate-90 pointer-events-none" />
                      </div>

                      {paymentType === 'CASH' && (
                          <div className="flex items-center space-x-1.5 bg-surface-container-highest border border-outline rounded-lg py-1.5 px-3 shadow-sm">
                              <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Rate: $</span>
                              {user.role === UserRole.ITP_MANAGER ? (
                                  <input 
                                      type="text" 
                                      value={cashRate}
                                      onChange={(e) => setCashRate(e.target.value)}
                                      className="bg-transparent border-none outline-none text-[11px] font-black text-[#22c55e] w-12 p-0 focus:ring-0"
                                      placeholder="0.00"
                                  />
                              ) : (
                                  <span className="text-[11px] font-black text-[#22c55e]">{cashRate}</span>
                              )}
                          </div>
                      )}
                  </div>
              )}
          </div>

          {activeFlight && (
              <div className="flex flex-col md:flex-row md:items-center justify-center ml-3 pl-3 border-l border-outline min-w-0 flex-1">
                  <span className="text-xl font-[900] text-primary tracking-tighter leading-none mb-1 md:mb-0 md:mr-3 flex-shrink-0">{activeFlight.flightNumber}</span>
                  <span className="text-[11px] font-black text-on-surface-dim uppercase tracking-widest truncate">
                      <span className="text-on-surface">{activeFlight.stand}</span>
                      {activeFlight.aircraftType && <span className="mx-1.5 opacity-50">•</span>}
                      {activeFlight.aircraftType && <span className="text-on-surface">{activeFlight.aircraftType}</span>}
                      {activeFlight.aircraftReg && <span className="mx-1.5 opacity-50">•</span>}
                      {activeFlight.aircraftReg && <span className="text-primary">{activeFlight.aircraftReg}</span>}
                  </span>
              </div>
          )}
      </div>

      <div className="flex flex-col items-center flex-shrink-0 ml-1 gap-1">
          <div className={`w-2.5 h-2.5 rounded-full ${equipmentDotClass(activeFlight?.vehicleId || selectedVehicleId)} shadow-premium`} title={isOnline ? 'Synced' : 'Offline'}></div>
          {activeFlight && paymentType !== 'VOID' && (
              <div className="flex flex-col items-center">
                  <span className={`text-[8px] font-black uppercase tracking-widest leading-none
                      ${paymentType === 'CASH' ? 'text-success' : 'text-on-surface-dim opacity-50'}
                  `}>
                      {paymentType}
                  </span>
                  {paymentType === 'CASH' && (
                      <span className="text-[9px] font-black text-primary font-mono mt-0.5">
                          ${cashRate}
                      </span>
                  )}
              </div>
          )}
      </div>
  </div>
);

const ScreenDashboard: React.FC<{ 
    user: User, 
    onStartJob: (job: FlightJob) => void,
    selectedVehicleId: string,
    setSelectedVehicleId: (id: string) => void,
    flightLogs: FlightLog[],
    activeFlight: Partial<FlightLog> | null
}> = ({ user, onStartJob, selectedVehicleId, setSelectedVehicleId, flightLogs, activeFlight }) => {
  const { notify } = useNotification();
  const { 
    flightJobs, 
    rawFlightJobs,
    domesticFlights, 
    staff, 
    alerts, 
    createAlert, 
    deleteAlerts,
    briefingInfo,
    selectedBriefingShift,
    selectedBriefingDate,
    domesticAssignments,
    externalFlights
  } = useOperationalData();
  const [viewMode, setViewMode] = useState<'INT' | 'DOM' | 'ADHOC'>('INT');
  const [filterMyTasks, setFilterMyTasks] = useState(false);

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const s = status.toUpperCase().replace('_', ' ');

    let badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    let IconComponent: React.ComponentType<any> = Clock;

    if (s === 'COMPLETED' || s.includes('COMPLETED') || s.includes('DONE')) {
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]';
      IconComponent = CheckCircle;
    } else if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
      badgeClass = 'bg-orange-500/10 text-orange-500 border-orange-500/30';
      IconComponent = Play;
    } else if (s.includes('DELAY')) {
      badgeClass = 'bg-red-500/10 text-red-500 border-red-500/30 animate-delayed-blink';
      IconComponent = AlertTriangle;
    } else if (s.includes('CANCEL') || s.includes('CNL')) {
      badgeClass = 'bg-red-500/10 text-red-500 border-red-500/20 opacity-70';
      IconComponent = Ban;
    } else if (s.includes('LANDED') || s.includes('ARRIV')) {
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      IconComponent = PlaneLanding;
    } else if (s.includes('DEPART')) {
      badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      IconComponent = PlaneTakeoff;
    } else if (s.includes('BOARDING')) {
      badgeClass = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      IconComponent = ArrowRightCircle;
    } else if (s.includes('GATE') || s.includes('FINAL') || s.includes('CLOSED')) {
      if (s.includes('CHECK-IN CLOSED') || s.includes('CLOSED')) {
        badgeClass = 'bg-pink-500/10 text-pink-500 border-pink-500/30';
        IconComponent = Lock;
      } else {
        badgeClass = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
        IconComponent = Clock;
      }
    } else if (s.includes('ON TIME') || s.includes('ON-TIME') || s.includes('SCH') || s.includes('SCHEDULED') || s.includes('PENDING')) {
      badgeClass = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      IconComponent = Check;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${badgeClass}`}>
        <IconComponent className="w-3.5 h-3.5" />
        <span className="leading-none">{s}</span>
      </span>
    );
  };
  const [activeMenuJobId, setActiveMenuJobId] = useState<string | null>(null);
  
  const shiftRanges: Record<string, { start: string; end: string; crossesMidnight: boolean }> = {
    'Morning': { start: '07:30', end: '16:00', crossesMidnight: false },
    'Evening': { start: '15:00', end: '23:30', crossesMidnight: false },
    'Night': { start: '22:30', end: '08:30', crossesMidnight: true },
  };

  const isFlightInShift = (dep?: string) => {
    if (!dep) return true; // Show flights without DEP always
    const range = shiftRanges[selectedBriefingShift];
    if (!range) return true;
    if (range.crossesMidnight) {
      return dep >= range.start || dep <= range.end;
    }
    return dep >= range.start && dep <= range.end;
  };

  const frozenFlights = briefingInfo?.staffAssignments?.frozenFlights;

  const liveIntlList = (flightJobs || []).filter(f => {
    const isDep = f.type ? f.type === 'departure' : !!f.std;
    return isDep && isFlightInShift(f.std) && (!f.date || f.date === selectedBriefingDate);
  });

  const getStatusForFlightDate = (cleanNo: string, flightDate: string, defaultStatus: string = 'PENDING') => {
    const matchingLog = (flightLogs || []).find(log => {
      if (!log || !log.flightNumber) return false;
      const logNo = (log.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (logNo !== cleanNo) return false;
      const logDate = log.operationalDate || (log.timestampFinalEnd ? log.timestampFinalEnd.split('T')[0] : (log.timestampStart ? log.timestampStart.split('T')[0] : ''));
      return logDate ? logDate === flightDate : true;
    });

    if (matchingLog && matchingLog.status === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (matchingLog && matchingLog.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jobNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jobNo !== cleanNo) return false;
      return j.date ? j.date === flightDate : true;
    });

    if (dbJob && (dbJob.date === flightDate || !dbJob.date) && dbJob.status) {
      return dbJob.status;
    }

    return defaultStatus;
  };

  const intlJobsMap = new Map<string, any>();
  liveIntlList.forEach(f => {
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    const flightDate = f.date ? f.date.split('T')[0] : selectedBriefingDate;
    const computedStatus = getStatusForFlightDate(cleanNo, flightDate, f.status || 'PENDING');
    
    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jNo !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !flightDate || jDate === flightDate;
    });

    const existing = intlJobsMap.get(cleanNo);

    intlJobsMap.set(cleanNo, {
      ...(existing || {}),
      ...f,
      id: dbJob?.id || f.id || existing?.id,
      status: computedStatus,
      fidsStatus: f.status,
      assignedTo: dbJob?.assignedTo || f.assignedTo || existing?.assignedTo || '',
      assignedOfficer: dbJob?.assignedOfficer || f.assignedOfficer || existing?.assignedOfficer || '',
      vehicleId: dbJob?.vehicleId || f.vehicleId || existing?.vehicleId,
      equipmentUsage: dbJob?.equipmentUsage || f.equipmentUsage || existing?.equipmentUsage || 'HYDRANT',
    });
  });

  if (frozenFlights?.intl) {
    frozenFlights.intl.forEach((ff: any) => {
      const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const existing = intlJobsMap.get(cleanNo);
      const flightDate = ff.date ? ff.date.split('T')[0] : selectedBriefingDate;
      const computedStatus = getStatusForFlightDate(cleanNo, flightDate, existing?.status || ff.status || 'PENDING');

      const dbJob = (rawFlightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        return !jDate || !flightDate || jDate === flightDate;
      });

      intlJobsMap.set(cleanNo, {
        ...(existing || {}),
        ...ff,
        id: dbJob?.id || ff.id || existing?.id,
        status: computedStatus,
        fidsStatus: existing?.fidsStatus || ff.status,
        assignedTo: dbJob?.assignedTo || ff.assignedTo || existing?.assignedTo || '',
        assignedOfficer: dbJob?.assignedOfficer || ff.assignedOfficer || existing?.assignedOfficer || '',
        vehicleId: dbJob?.vehicleId || ff.vehicleId || existing?.vehicleId,
        equipmentUsage: dbJob?.equipmentUsage || ff.equipmentUsage || existing?.equipmentUsage || 'HYDRANT',
      });
    });
  }

  const intlJobs = Array.from(intlJobsMap.values())
    .filter((f: any) => f.fidsStatus?.toUpperCase() !== 'CANCELLED')
    .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
  
  const liveDomList = (domesticFlights || []).filter(f => f.type === 'departure' && isFlightInShift(f.std) && (!f.date || f.date === selectedBriefingDate));
  const domJobsMap = new Map<string, any>();
  liveDomList.forEach(f => {
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    const flightDate = f.date || selectedBriefingDate;
    const computedStatus = getStatusForFlightDate(cleanNo, flightDate, f.status || 'PENDING');
    domJobsMap.set(cleanNo, {
      ...f,
      status: computedStatus,
      fidsStatus: f.status
    });
  });

  if (frozenFlights?.domestic) {
    frozenFlights.domestic.forEach((ff: any) => {
      const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const existing = domJobsMap.get(cleanNo);
      const flightDate = ff.date || selectedBriefingDate;
      const computedStatus = getStatusForFlightDate(cleanNo, flightDate, existing?.status || ff.status || 'PENDING');
      domJobsMap.set(cleanNo, {
        ...(existing || {}),
        ...ff,
        status: computedStatus,
        fidsStatus: existing?.fidsStatus || ff.status
      });
    });
  }

  const domesticJobsRaw = Array.from(domJobsMap.values())
    .filter((f: any) => f.fidsStatus?.toUpperCase() !== 'CANCELLED');

  const domesticJobs = domesticJobsRaw.map((df: any) => {
      const assignment = (domesticAssignments || []).find(da => da.team_name === df.assignedTeam);
      return {
          id: df.id,
          flightNumber: df.flightNumber,
          aircraftReg: df.aircraftReg,
          aircraftType: df.aircraftType,
          stand: df.stand,
          sta: df.sta,
          eta: df.eta,
          std: df.std,
          assignedTo: assignment?.op1 || '',
          assignedOfficer: assignment?.op2 || '',
          status: df.status as any,
          fidsStatus: df.fidsStatus,
          assignedTeam: df.assignedTeam,
          vehicleId: df.vehicleId,
          route: df.route,
          isDomestic: true,
      };
  }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));

  const adhocJobsRaw = briefingInfo?.staffAssignments?.adhocFlights !== undefined
    ? briefingInfo.staffAssignments.adhocFlights
    : MOCK_ADHOC_FLIGHTS.filter(f => isFlightInShift(f.sta || f.std) && (!f.date || f.date === selectedBriefingDate));

  const adhocJobs = adhocJobsRaw.map((f: any) => ({
      id: f.id,
      flightNumber: f.flightNumber,
      aircraftReg: f.aircraftReg,
      aircraftType: f.aircraftType,
      stand: f.stand,
      sta: f.sta,
      eta: f.eta,
      std: f.std,
      assignedTo: f.id === 'ah1' ? user.id : 'u3b',
      assignedOfficer: undefined,
      status: f.status as any,
      fidsStatus: f.status,
      route: f.route,
      isAdhoc: true,
      vehicleId: f.vehicleId,
  })).sort((a: any, b: any) => (a.std || a.sta || '').localeCompare(b.std || b.sta || ''));

  const isJobAssignedToUser = (job: FlightJob) => {
    if (!job || !user) return false;
    
    const userTokens = new Set<string>();
    if (user.id) userTokens.add(user.id.toLowerCase());
    if (user.name) userTokens.add(user.name.toLowerCase());

    const staffList = (staff && staff.length > 0 ? staff : MOCK_USERS);
    staffList.forEach(s => {
      if (s.id.toLowerCase() === (user.id || '').toLowerCase() || s.name.toLowerCase() === (user.name || '').toLowerCase()) {
        userTokens.add(s.id.toLowerCase());
        userTokens.add(s.name.toLowerCase());
      }
    });

    const assignedToVal = (job.assignedTo || '').toLowerCase();
    const assignedOfficerVal = (job.assignedOfficer || '').toLowerCase();

    if (!assignedToVal && !assignedOfficerVal) return false;

    if (userTokens.has(assignedToVal) || userTokens.has(assignedOfficerVal)) {
      return true;
    }

    const targetAssignee = staffList.find(s => s.id.toLowerCase() === assignedToVal || s.name.toLowerCase() === assignedToVal);
    if (targetAssignee && (userTokens.has(targetAssignee.id.toLowerCase()) || userTokens.has(targetAssignee.name.toLowerCase()))) {
      return true;
    }

    const targetOfficer = staffList.find(s => s.id.toLowerCase() === assignedOfficerVal || s.name.toLowerCase() === assignedOfficerVal);
    if (targetOfficer && (userTokens.has(targetOfficer.id.toLowerCase()) || userTokens.has(targetOfficer.name.toLowerCase()))) {
      return true;
    }

    return false;
  };

  const filteredIntlJobs = filterMyTasks ? intlJobs.filter(isJobAssignedToUser) : intlJobs;
  const filteredDomesticJobs = filterMyTasks ? domesticJobs.filter(isJobAssignedToUser) : domesticJobs;
  const filteredAdhocJobs = filterMyTasks ? adhocJobs.filter(isJobAssignedToUser) : adhocJobs;

  const activeJobs = 
      viewMode === 'INT' ? filteredIntlJobs : 
      viewMode === 'DOM' ? filteredDomesticJobs : 
      filteredAdhocJobs;

  const isDelayed = (sta?: string, eta?: string) => {
      if (!sta || !eta) return false;
      return eta > sta;
  };

  const renderRoute = (route?: string, customClass = "", isDomestic = false) => {
    if (!route) return null;
    if (isDomestic) {
      const parts = route.split(/\s+/);
      const dest = parts[parts.length - 1];
      return <span className={customClass}>{dest}</span>;
    }
    const parts = route.split(/\s+/);
    return (
      <span className={`inline-flex items-center font-black uppercase tracking-wide ${customClass} select-none`}>
        {parts.map((part, idx) => {
          if (part === 'MLE') {
            return (
              <span key={idx} className="text-[0.75em] text-on-surface-dim opacity-35 mx-[1px] font-bold leading-none relative top-[1px]">
                {part}
              </span>
            );
          }
          if (part === '➔' || part === '->') {
            return (
              <span key={idx} className="opacity-25 mx-[0.5px] font-bold text-[0.8em] leading-none relative top-[0.5px]">
                {part}
              </span>
            );
          }
          return <span key={idx} className="mx-[1px] leading-none">{part}</span>;
        })}
      </span>
    );
  };

  const renderJobCard = (job: FlightJob) => {
      const isAssignedToMe = isJobAssignedToUser(job);
      const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;
      const assignee = usersList.find(u => u.id === job.assignedTo || u.name.toLowerCase() === (job.assignedTo || '').toLowerCase());
      const assigneeName = assignee?.name || job.assignedTo || 'Unassigned';
      const officer = job.assignedOfficer ? usersList.find(u => u.id === job.assignedOfficer || u.name.toLowerCase() === (job.assignedOfficer || '').toLowerCase()) : null;
      const officerName = officer?.name || job.assignedOfficer || null;
      const delayed = isDelayed(job.sta, job.eta);
      
      let displayStatus = 'PENDING';
      if (job.status === 'IN_PROGRESS' || job.status === 'COMPLETED') {
          displayStatus = job.status;
      } else if (delayed) {
          displayStatus = 'DELAYED';
      } else if ((job as any).fidsStatus) {
          displayStatus = (job as any).fidsStatus;
      } else if (job.status) {
          displayStatus = job.status;
      }

      const airlineCode = (job.flightNumber || '').replace(/\s+/g, '').slice(0, 2).toLowerCase();
      const logoUrl = airlineCode.length === 2 ? `https://fis.com.mv/tail/${airlineCode.toUpperCase()}.png` : null;
      const activeAlert = (alerts || []).find(a => 
          !a.acknowledged && 
          (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')) &&
          a.message.includes(job.flightNumber)
      );
      const isAlreadyRequested = !!activeAlert;
      const isNoFuelAlert = activeAlert?.message.toLowerCase().includes('no fuel');

      // Find active vehicle (Eq ID) for in-progress jobs
      let activeEqId = job.vehicleId;
      if (!activeEqId && displayStatus === 'IN_PROGRESS') {
          if (activeFlight && activeFlight.flightNumber === job.flightNumber) {
              activeEqId = activeFlight.vehicleId;
          } else {
              const matchingLog = (flightLogs || []).find(log => log.flightNumber === job.flightNumber && log.status === 'IN_PROGRESS');
              if (matchingLog) {
                  activeEqId = matchingLog.vehicleId;
              }
          }
      }

      const activeEquipmentUsage = job.equipmentUsage || 'HYDRANT';
      const airlineName = getAirlineName(job.flightNumber, externalFlights);

      return (
          <div key={job.id} className={`bg-surface-container-lowest p-6 rounded-2xl relative overflow-hidden transition-all shrink-0 border ${isAssignedToMe ? 'border-primary border-l-[6px] shadow-sm' : 'border-outline opacity-80'}`}>
              <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6 gap-4 w-full relative">
                      <div className="min-w-0 flex-1">
                          <div className="flex flex-col">
                              <div className="flex flex-wrap items-center gap-2">
                                  {/* Yellow gradient stand badge next to flight number on desktop view */}
                                  <div className="hidden md:block bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                                      {job.stand}
                                  </div>
                                  <h3 className="text-2xl sm:text-3xl font-[900] text-on-surface tracking-tighter leading-none">{job.flightNumber}</h3>
                                  
                                  {/* Logo */}
                                  {logoUrl && (
                                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                          <img
                                              src={logoUrl}
                                              alt=""
                                              aria-hidden="true"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              className="w-full h-full object-contain select-none flex-shrink-0"
                                          />
                                      </div>
                                  )}

                                  {/* Mobile-only Airline Name (after logo & flight number) */}
                                  {airlineName && (
                                      <span className="md:hidden text-[11px] font-black text-on-surface-dim opacity-50 uppercase tracking-wider ml-1 self-center">
                                          {airlineName}
                                      </span>
                                  )}

                                  {/* Desktop-only details: type, reg, and route on the same row as flight number after logo */}
                                  <div className="hidden md:flex items-center gap-2.5 text-[11px] sm:text-[12px] font-bold text-on-surface-dim">
                                      <span className="opacity-20">|</span>
                                      <span className="opacity-60">{job.aircraftType}</span>
                                      <span className="opacity-20">|</span>
                                      <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-on-surface-dim border-transparent uppercase tracking-wider">{job.aircraftReg}</span>
                                      {job.route && (
                                          <>
                                              <span className="opacity-20">|</span>
                                              {renderRoute(job.route, "text-primary text-[10px]", job.isDomestic)}
                                          </>
                                      )}
                                  </div>
                              </div>

                              {/* Desktop-only Airline Name (below flight number and logo) */}
                              {airlineName && (
                                  <div className="hidden md:block text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">
                                      {airlineName}
                                  </div>
                              )}
                          </div>

                          {/* Mobile-only details: Stand, type, reg, and route grouped together on the same row */}
                          <div className="flex flex-wrap items-center mt-2 text-on-surface-dim text-[11px] sm:text-[12px] font-bold gap-x-2 gap-y-1.5 md:hidden">
                               <div className="flex items-center whitespace-nowrap">
                                   <MapPin className="w-3.5 h-3.5 mr-1 text-primary opacity-60 shrink-0" />
                                   <span>{job.stand}</span>
                                </div>
                               <span className="opacity-20 shrink-0">|</span>
                               <span className="opacity-60 whitespace-nowrap">{job.aircraftType}</span>
                               <span className="opacity-20 shrink-0">|</span>
                               <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-on-surface-dim border-transparent uppercase tracking-wider whitespace-nowrap">{job.aircraftReg}</span>
                               {job.route && (
                                 <>
                                   <span className="opacity-20 shrink-0">|</span>
                                   {renderRoute(job.route, "text-primary text-[9px] sm:text-[10px] tracking-wide whitespace-nowrap", job.isDomestic)}
                                 </>
                               )}
                          </div>
                      </div>

                      {/* Desktop Center-Aligned Timings (lg+ only) */}
                      <div className="hidden lg:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-4 py-2 rounded-xl border border-outline absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-sm">
                          <div className="flex items-center gap-2">
                              <span className="opacity-40 text-[10px]">STA</span>
                              <span className="text-on-surface text-[14px] font-black tracking-tight">{job.sta || '--:--'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-primary opacity-60 text-[10px]">ETA</span>
                              <span className={`${delayed ? 'text-error' : 'text-primary'} text-[14px] font-black tracking-tight`}>{job.eta || '--:--'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-warning opacity-60 text-[10px]">STD</span>
                              <span className="text-warning text-[14px] font-black tracking-tight">{job.std || '--:--'}</span>
                          </div>
                      </div>

                      {/* Actions row (right-aligned, same row as flight number and logo on mobile) */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-20 relative">
                           {/* requested button to click for ITP MANAGER to send requested alerts to the assigned officer and operator */}
                           {(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && (
                               isAlreadyRequested ? (
                                   <button 
                                       onClick={async () => {
                                           try {
                                               const matchingAlerts = (alerts || []).filter(a => 
                                                   !a.acknowledged && 
                                                   (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')) &&
                                                   a.message.includes(job.flightNumber)
                                               );
                                               if (matchingAlerts.length > 0) {
                                                   await deleteAlerts(matchingAlerts.map(a => a.id));
                                               }
                                               notify(`Cancelled alert request for flight ${job.flightNumber}.`, 'info');
                                           } catch (err) {
                                               console.error(err);
                                               notify('Failed to cancel alert request.', 'error');
                                           }
                                       }}
                                       className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 border border-red-500/25 shadow-sm cursor-pointer"
                                       title={isNoFuelAlert ? "No Fuel Alert Active. Click to Cancel." : "Fuel Request Active. Click to Cancel."}
                                   >
                                       {isNoFuelAlert ? <Ban className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                                   </button>
                               ) : (
                                   <div className="relative">
                                       <button 
                                           onClick={() => setActiveMenuJobId(activeMenuJobId === job.id ? null : job.id)}
                                           className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all bg-amber-500/10 text-amber-500 border border-amber-500/25 hover:bg-amber-500/20 active:scale-95 shadow-sm cursor-pointer"
                                           title="Send Alert Menu"
                                       >
                                           <Bell className="w-5 h-5" />
                                       </button>

                                       {activeMenuJobId === job.id && (
                                           <>
                                               <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuJobId(null); }} />
                                               <div className="absolute right-0 top-12 z-50 w-56 bg-surface border border-outline rounded-xl shadow-premium p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                   <button 
                                                       onClick={async (e) => {
                                                           e.stopPropagation();
                                                           setActiveMenuJobId(null);
                                                           try {
                                                               const alertMeta = {
                                                                   aircraftReg: job.aircraftReg,
                                                                   stand: job.stand,
                                                                   eta: job.eta || job.sta,
                                                                   flightNumber: job.flightNumber
                                                               };

                                                               if (job.assignedTo) {
                                                                   await createAlert({
                                                                       severity: 'critical',
                                                                       alertType: 'REQUEST_FUELING',
                                                                       flightNumber: job.flightNumber,
                                                                       message: `Into-Plane: Alert requested for Flight ${job.flightNumber}${assigneeName ? ` (Operator: ${assigneeName})` : ''}.`,
                                                                       timestamp: new Date().toISOString(),
                                                                       acknowledged: false,
                                                                       targetRole: UserRole.ITP_OPERATOR,
                                                                       assignedStaffId: job.assignedTo,
                                                                       metadata: alertMeta
                                                                   });
                                                               }

                                                               if (job.assignedOfficer) {
                                                                   await createAlert({
                                                                       severity: 'critical',
                                                                       alertType: 'REQUEST_FUELING',
                                                                       flightNumber: job.flightNumber,
                                                                       message: `Into-Plane: Alert requested for Flight ${job.flightNumber}${officerName ? ` (Officer: ${officerName})` : ''}.`,
                                                                       timestamp: new Date().toISOString(),
                                                                       acknowledged: false,
                                                                       targetRole: UserRole.ITP_OFFICER,
                                                                       assignedStaffId: job.assignedOfficer,
                                                                       metadata: alertMeta
                                                                   });
                                                               }

                                                               notify(`High Alert Request Fueling sent for flight ${job.flightNumber}!`, 'success');
                                                           } catch (err) {
                                                               console.error(err);
                                                               notify('Failed to send request alert.', 'error');
                                                           }
                                                       }}
                                                       className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-500 text-on-surface-dim transition-all flex items-center gap-2 cursor-pointer"
                                                   >
                                                       <Bell className="w-3.5 h-3.5" />
                                                       Request Fueling
                                                   </button>
                                                   <button 
                                                       onClick={async (e) => {
                                                           e.stopPropagation();
                                                           setActiveMenuJobId(null);
                                                           try {
                                                               const alertMeta = {
                                                                   aircraftReg: job.aircraftReg,
                                                                   stand: job.stand,
                                                                   eta: job.eta || job.sta,
                                                                   flightNumber: job.flightNumber
                                                               };

                                                               if (job.assignedTo) {
                                                                   await createAlert({
                                                                       severity: 'critical',
                                                                       alertType: 'NO_FUEL',
                                                                       flightNumber: job.flightNumber,
                                                                       message: `Into-Plane: No Fuel required for Flight ${job.flightNumber}${assigneeName ? ` (Operator: ${assigneeName})` : ''}.`,
                                                                       timestamp: new Date().toISOString(),
                                                                       acknowledged: false,
                                                                       targetRole: UserRole.ITP_OPERATOR,
                                                                       assignedStaffId: job.assignedTo,
                                                                       metadata: alertMeta
                                                                   });
                                                               }

                                                               if (job.assignedOfficer) {
                                                                   await createAlert({
                                                                       severity: 'critical',
                                                                       alertType: 'NO_FUEL',
                                                                       flightNumber: job.flightNumber,
                                                                       message: `Into-Plane: No Fuel required for Flight ${job.flightNumber}${officerName ? ` (Officer: ${officerName})` : ''}.`,
                                                                       timestamp: new Date().toISOString(),
                                                                       acknowledged: false,
                                                                       targetRole: UserRole.ITP_OFFICER,
                                                                       assignedStaffId: job.assignedOfficer,
                                                                       metadata: alertMeta
                                                                   });
                                                               }

                                                               notify(`High Alert No-Uplift sent for flight ${job.flightNumber}!`, 'success');
                                                           } catch (err) {
                                                               console.error(err);
                                                               notify('Failed to send No-Uplift alert.', 'error');
                                                           }
                                                       }}
                                                       className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 text-on-surface-dim transition-all flex items-center gap-2 cursor-pointer border-t border-outline/20 pt-2"
                                                   >
                                                       <Ban className="w-3.5 h-3.5" />
                                                       No Fuel Required
                                                   </button>
                                               </div>
                                           </>
                                       )}
                                   </div>
                               )
                           )}

                           {/* play action button only if assigned to me or completed */}
                           {(isAssignedToMe || job.status === 'COMPLETED') && (
                               <button 
                                   onClick={() => {
                                       if (job.status === 'COMPLETED') {
                                           notify(`Log for ${job.flightNumber} is already finalized.`, "info");
                                       } else if (isAssignedToMe) {
                                           onStartJob(job);
                                       }
                                   }}
                                   className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm
                                        ${job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/20' : 'kinetic-gradient text-white hover:scale-[1.05] active:scale-95 shadow-premium'}
                                    `}
                                   title={job.status === 'COMPLETED' ? 'View Log' : 'Start Job'}
                               >
                                   {job.status === 'COMPLETED' ? <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" /> : <Play className="w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] flex-shrink-0 ml-0.5 sm:ml-1" fill="white" color="white" strokeWidth={2.5} />}
                               </button>
                           )}
                      </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline/50 space-y-4">
                      {/* Timings displayed on mobile + tablet view — moved above operator/status */}
                      <div className="grid grid-cols-3 gap-2 p-3 bg-surface-dim rounded-xl border border-outline lg:hidden">
                          <div className="text-center border-r border-outline/30">
                              <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                              <p className="text-[11px] font-[900] text-on-surface">{job.sta || '--:--'}</p>
                          </div>
                          <div className="text-center border-r border-outline/30">
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                              <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{job.eta || '--:--'}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                              <p className="text-[11px] font-[900] text-warning">{job.std || '--:--'}</p>
                          </div>
                      </div>

                      {/* Row 2: Operator/Team/EQ (Left) & Status/Active Fueling (Right) */}
                      <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center text-on-surface-dim font-bold gap-3 flex-wrap">
                               {viewMode === 'INT' && (
                                   <>
                                       <div className="flex items-center">
                                           <div className="w-5 h-5 rounded-md bg-surface-container-low border-transparent flex items-center justify-center mr-2 text-[10px] font-black">
                                               {assigneeName.charAt(0)}
                                           </div>
                                           <span className="text-[10px] uppercase tracking-tight">{assigneeName} <span className="opacity-40 italic font-black text-[8px] ml-0.5">(OP)</span></span>
                                       </div>
                                       {officerName && (
                                           <div className="flex items-center">
                                               <div className="w-5 h-5 rounded-md bg-surface-container-low border-transparent flex items-center justify-center mr-2 text-[10px] font-black text-primary bg-primary/5">
                                                   {officerName.charAt(0)}
                                               </div>
                                               <span className="text-[10px] uppercase tracking-tight">{officerName} <span className="opacity-40 italic font-black text-[8px] ml-0.5">(OFFICER)</span></span>
                                           </div>
                                       )}
                                   </>
                               )}
                               {viewMode === 'DOM' && (job as any).assignedTeam && job.status !== 'PENDING' && (
                                   <div className="flex items-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                                       <Users className="w-3.5 h-3.5 mr-1.5 text-primary opacity-70" />
                                       <span>{(job as any).assignedTeam}</span>
                                   </div>
                               )}
                               {activeEqId && (
                                   <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border shadow-sm animate-in fade-in zoom-in-95 duration-500 shrink-0 ${equipmentBadgeClass(activeEqId)}`}>
                                       <Truck className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase tracking-widest leading-none">{activeEqId}</span>
                                   </div>
                               )}
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                              {displayStatus === 'IN_PROGRESS' && (
                                  <span className="text-[8px] font-black text-warning uppercase tracking-widest animate-pulse">ACTIVE FUELING</span>
                              )}
                              {renderStatusBadge(displayStatus)}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="p-5 flex flex-col space-y-8 pb-24">
      {/* Category Toggle */}
      <div className="flex justify-center items-center mt-2 mb-4">
          <div className="bg-surface-container-low p-1 rounded-[22px] border-transparent flex relative w-full max-w-[370px] sm:max-w-[440px] h-[38px]">
              <div 
                  className={`absolute top-1 bottom-1 w-[calc(33.333%-2.6px)] kinetic-gradient rounded-[18px] transition-all duration-300 ${
                    viewMode === 'INT' ? 'translate-x-0' : 
                    viewMode === 'DOM' ? 'translate-x-[100%] ml-[1px]' : 'translate-x-[200%] ml-[2px]'
                  }`}
              />
              <button 
                  onClick={() => setViewMode('INT')}
                  className={`flex-1 flex items-center justify-center rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em] relative z-10 transition-colors duration-300 ${viewMode === 'INT' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  <span className="hidden sm:inline">International</span>
                  <span className="sm:hidden">INT</span>
              </button>
              <button 
                  onClick={() => setViewMode('DOM')}
                  className={`flex-1 flex items-center justify-center rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em] relative z-10 transition-colors duration-300 ${viewMode === 'DOM' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  <span className="hidden sm:inline">Domestic</span>
                  <span className="sm:hidden">DOM</span>
              </button>
              <button 
                  onClick={() => setViewMode('ADHOC')}
                  className={`flex-1 flex items-center justify-center rounded-[18px] text-[10px] font-black uppercase tracking-[0.12em] relative z-10 transition-colors duration-300 ${viewMode === 'ADHOC' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  <span className="hidden sm:inline">Ad-Hoc</span>
                  <span className="sm:hidden">ADHOC</span>
              </button>
          </div>

          <button 
              onClick={() => setFilterMyTasks(!filterMyTasks)}
              className={`ml-3 px-4 h-[38px] rounded-[22px] border transition-all flex items-center gap-2 justify-center sm:justify-start
                  ${filterMyTasks 
                      ? 'kinetic-gradient text-white border-transparent shadow-premium' 
                      : 'bg-surface-container-low text-on-surface-dim border-outline opacity-70 hover:opacity-100'}
              `}
              title={filterMyTasks ? 'Showing My Tasks' : 'Showing All Tasks'}
          >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  {filterMyTasks ? 'My Tasks Only' : 'All Tasks'}
              </span>
          </button>
      </div>

      <div key={viewMode} className={`space-y-4 animate-in fade-in duration-500 ${viewMode === 'INT' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'}`}>
          <div className="flex justify-between items-center px-1">
              <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                  {viewMode === 'INT' ? 'International Operations' : viewMode === 'DOM' ? 'Domestic Operations' : 'Ad-Hoc Operations'}
              </h2>
              <span className="text-[10px] font-black bg-primary/5 text-primary px-3 py-1 rounded-full border border-primary/10">{activeJobs.length} Flights</span>
          </div>
          <div className="flex flex-col space-y-4">
              {activeJobs.map(renderJobCard)}
          </div>
      </div>
    </div>
  );
};

const ScreenTimestamps: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onTimestamp: (field: keyof FlightLog) => void, 
  onInputChange: (field: keyof FlightLog, value: any) => void,
  onNext: () => void, 
  onBack: () => void,
  user: User,
  getLocalTimeValue: (isoString?: string) => string,
  setManualTime: (field: keyof FlightLog, timeVal: string) => void
}> = ({ activeFlight, onTimestamp, onInputChange, onNext, onBack, user, getLocalTimeValue, setManualTime }) => {
  const { selectedBriefingDate } = useOperationalData();
  return (
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
      <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Schedule
      </button>
      <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase italic">Ramp Arrival <span className="text-primary">& Setup</span></h2>
      
      <div className="space-y-6 flex-1">
          {/* Operational Date */}
          <div className="card-premium p-6 border-outline overflow-hidden">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Operational Date</label>
              <div className="relative">
                  <input
                      type="date"
                      required
                      value={activeFlight?.operationalDate || selectedBriefingDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => onInputChange('operationalDate' as any, e.target.value)}
                      onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                      className="w-full pl-10 pr-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
              </div>
          </div>

          {/* Fuel Type / Product Display */}
          <div className="card-premium p-6 border-outline overflow-hidden">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Fuel Type / Product</label>
              <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center shadow-inner">
                  <Droplet className="w-4 h-4 mr-3 opacity-60" />
                  JET A-1
              </div>
          </div>

          <div className="card-premium p-6 border-outline overflow-hidden">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Delivery Ticket Number</label>
              <div className="flex items-center gap-2 max-w-full overflow-hidden">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">MLE-</span>
                  <input 
                      type="text" 
                      maxLength={6}
                      disabled={isOperator(user.role)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-error placeholder:text-error/20"
                      placeholder="000000"
                      value={activeFlight?.deliveryNumber?.replace('MLE-', '') || ''}
                      onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          onInputChange('deliveryNumber', val ? `MLE-${val}` : '');
                      }}
                  />
              </div>
          </div>

          {activeFlight?.isAdhoc && (
              <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">C/O (Billing Account)</label>
                  <div className="flex items-center gap-2 max-w-full overflow-hidden">
                      <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">C/O-</span>
                      <input 
                          type="text" 
                          disabled={isOperator(user.role)}
                          className="flex-1 min-w-0 text-3xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-primary placeholder:text-primary/10 uppercase tracking-widest"
                          placeholder="ENTER ACCOUNT"
                          value={activeFlight.co?.replace(/^C\/O-/i, '') || ''}
                          onChange={(e) => {
                              const val = e.target.value.replace(/^C\/O-/i, '').toUpperCase();
                              onInputChange('co', val ? `C/O-${val}` : '');
                          }}
                      />
                  </div>
              </div>
          )}

          {activeFlight?.vehicleId?.startsWith('HD') && (
            <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Hydrant PIT Number</label>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                        <span className="text-2xl sm:text-3xl font-mono font-black text-primary opacity-30 shrink-0">J</span>
                        <input 
                            type="text" 
                            disabled={isOperator(user.role)}
                            className="flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-primary placeholder:text-primary/10 uppercase"
                            placeholder="000-0"
                            value={activeFlight?.pitNumber?.startsWith('J') ? activeFlight.pitNumber.substring(1) : (activeFlight?.pitNumber || '')}
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase().replace(/^J/, '');
                                  onInputChange('pitNumber', val ? `J${val}` : '');
                            }}
                            list="pit-suggestions"
                        />
                        <datalist id="pit-suggestions">
                            {PIT_MAPPING.map((m, idx) => (
                                <option key={idx} value={m.pit}>{m.stand}</option>
                            ))}
                        </datalist>
                    </div>
                    {activeFlight.stand && !isOperator(user.role) && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {PIT_MAPPING.filter(m => m.stand === activeFlight.stand).map((m, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => onInputChange('pitNumber', m.pit)}
                                    className="px-3 py-1.5 bg-surface-container-low rounded-lg text-[10px] font-black text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
                                >
                                    {m.pit}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* Operation Alpha (Log Arrived) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampArrived')}
                  disabled={isOperator(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampArrived 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : isOperator(user.role)
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Alpha</span>
                      <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampArrived ? 'text-success' : 'text-on-surface'}`}>
                          LOG ARRIVED
                      </span>
                      {activeFlight?.timestampArrived && (
                          <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                               <Clock className="w-4 h-4 mr-2 opacity-60"/>
                               {new Date(activeFlight.timestampArrived).toLocaleTimeString([], { hour12: false })}
                          </span>
                      )}
                  </div>
                  {!activeFlight?.timestampArrived && <MapPin className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                  {activeFlight?.timestampArrived && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
              </button>
              <div className="card-premium p-6 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-3 text-center">Manual Time</span>
                  <div className="relative w-full">
                      <input 
                          type="time"
                          disabled={isOperator(user.role)}
                          value={activeFlight?.timestampArrived ? getLocalTimeValue(activeFlight.timestampArrived) : ''}
                          onChange={(e) => setManualTime('timestampArrived', e.target.value)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                      />
                  </div>
              </div>
          </div>

          {/* Operation Beta (Position / Connected) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampPosition')}
                  disabled={!activeFlight?.timestampArrived || isOperator(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampPosition 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (!activeFlight?.timestampArrived || isOperator(user.role))
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Beta</span>
                      <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampPosition ? 'text-success' : 'text-on-surface'}`}>
                          POSITION / CONNECTED
                      </span>
                      {activeFlight?.timestampPosition && (
                          <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                               <Clock className="w-4 h-4 mr-2 opacity-60"/>
                               {new Date(activeFlight.timestampPosition).toLocaleTimeString([], { hour12: false })}
                          </span>
                      )}
                  </div>
                  {!activeFlight?.timestampPosition && <Truck className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                  {activeFlight?.timestampPosition && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
              </button>
              <div className="card-premium p-6 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-3 text-center">Manual Time</span>
                  <div className="relative w-full">
                      <input 
                          type="time"
                          disabled={!activeFlight?.timestampArrived || isOperator(user.role)}
                          value={activeFlight?.timestampPosition ? getLocalTimeValue(activeFlight.timestampPosition) : ''}
                          onChange={(e) => setManualTime('timestampPosition', e.target.value)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                      />
                  </div>
              </div>
          </div>

          {/* Operation Gamma (Commenced Pumping) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampStart')}
                  disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isOperator(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampStart 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isOperator(user.role))
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Gamma</span>
                      <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampStart ? 'text-success' : 'text-on-surface'}`}>
                          COMMENCED PUMPING
                      </span>
                       {activeFlight?.timestampStart && (
                          <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                               <Clock className="w-4 h-4 mr-2 opacity-60"/>
                               {new Date(activeFlight.timestampStart).toLocaleTimeString([], { hour12: false })}
                          </span>
                      )}
                  </div>
                  {!activeFlight?.timestampStart && <Play className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                  {activeFlight?.timestampStart && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
              </button>
              <div className="card-premium p-6 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-3 text-center">Manual Time</span>
                  <div className="relative w-full">
                      <input 
                          type="time"
                          disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isOperator(user.role)}
                          value={activeFlight?.timestampStart ? getLocalTimeValue(activeFlight.timestampStart) : ''}
                          onChange={(e) => setManualTime('timestampStart', e.target.value)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                      />
                  </div>
              </div>
          </div>
      </div>

      <button 
          onClick={onNext}
          disabled={!isOperator(user.role) && (!activeFlight?.timestampStart || activeFlight?.deliveryNumber?.replace('MLE-', '').length !== 6)}
          className="mt-8 w-full kinetic-gradient text-white p-4 lg:p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale active:scale-95 transition-all shadow-premium"
      >
          Proceed to Metering <ChevronRight className="ml-3 w-5 h-5" />
      </button>
  </div>
);
};

const ScreenMetering: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onTimestamp: (field: keyof FlightLog) => void, 
  onInputChange: (field: keyof FlightLog, value: any) => void, 
  onNext: () => void, 
  onBack: () => void,
  showTopUp: boolean,
  setShowTopUp: (val: boolean) => void,
  user: User,
  getLocalTimeValue: (isoString?: string) => string,
  setManualTime: (field: keyof FlightLog, timeVal: string) => void
}> = ({ activeFlight, onTimestamp, onInputChange, onNext, onBack, showTopUp, setShowTopUp, user, getLocalTimeValue, setManualTime }) => (
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
       <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Timestamps
       </button>
       <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase">Metering <span className="text-primary italic">& Volume</span></h2>

       <div className="space-y-8">
          <div className="p-6 border border-outline rounded-3xl">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
              <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9,]*"
                  disabled={isOperator(user.role)}
                  className="w-full text-4xl sm:text-6xl font-mono font-black py-4 bg-transparent outline-none border-b-4 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10 disabled:opacity-50"
                  placeholder="000,000"
                  value={activeFlight?.meterOpen !== undefined ? activeFlight.meterOpen.toLocaleString() : ''}
                  onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          onInputChange('meterOpen', val === '' ? 0 : parseFloat(val));
                      }
                  }}
              />
          </div>

          {/* Operation Delta (Initial End) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampInitialEnd')}
                  disabled={activeFlight?.meterOpen === undefined || isOperator(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampInitialEnd 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (activeFlight?.meterOpen === undefined || isOperator(user.role))
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Delta</span>
                      <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampInitialEnd ? 'text-success' : 'text-on-surface'}`}>
                          INITIAL END
                      </span>
                      {activeFlight?.timestampInitialEnd && (
                          <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                               <Clock className="w-4 h-4 mr-2 opacity-60"/>
                               {new Date(activeFlight.timestampInitialEnd).toLocaleTimeString([], { hour12: false })}
                           </span>
                      )}
                  </div>
                  {!activeFlight?.timestampInitialEnd && <Pause className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                  {activeFlight?.timestampInitialEnd && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
              </button>
              <div className="card-premium p-6 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-3 text-center">Manual Time</span>
                  <div className="relative w-full">
                      <input 
                          type="time"
                          disabled={activeFlight?.meterOpen === undefined || isOperator(user.role)}
                          value={activeFlight?.timestampInitialEnd ? getLocalTimeValue(activeFlight.timestampInitialEnd) : ''}
                          onChange={(e) => setManualTime('timestampInitialEnd', e.target.value)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                      />
                  </div>
              </div>
          </div>

          <div className="mt-4 p-4 lg:p-8 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline">
               <label className="block text-[10px] font-black text-on-surface uppercase mb-6 tracking-widest text-center opacity-60">Manual Volume Entry (L)</label>
               <div className="relative w-full max-w-md mx-auto">
                   <input 
                       type="text" 
                       inputMode="numeric"
                       pattern="[0-9,]*"
                       disabled={isOperator(user.role)}
                       className="w-full px-6 lg:px-10 py-4 lg:py-6 bg-surface-lowest border border-outline/50 rounded-[24px] lg:rounded-[32px] text-4xl sm:text-6xl font-[900] text-primary tracking-tighter text-center outline-none focus:border-primary transition-all font-mono disabled:opacity-50"
                       placeholder="0,000"
                       value={activeFlight?.volume ? activeFlight.volume.toLocaleString() : ''}
                       onChange={(e) => {
                           const val = e.target.value.replace(/,/g, '');
                           if (val === '' || /^\d*\.?\d*$/.test(val)) {
                               onInputChange('volume', val === '' ? 0 : parseFloat(val));
                           }
                       }}
                   />
                   <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
               </div>
          </div>

          <div className="card-premium p-6 border-outline bg-surface-dim/40">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Calculated Closing Totalizer</label>
              <div className="text-4xl sm:text-6xl font-mono font-black py-4 text-on-surface-dim tracking-tight">
                  {((typeof activeFlight?.meterOpen === 'number' ? activeFlight.meterOpen : 0) + (typeof activeFlight?.volume === 'number' ? activeFlight.volume : 0)).toLocaleString()}
              </div>
          </div>

          {/* Metering Metrics: PSI & LPM */}
          <div className="grid grid-cols-2 gap-4">
              <div className="p-6 border border-outline rounded-3xl bg-surface-dim/20">
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-40">Pressure (PSI)</label>
                  <input
                      type="text"
                      inputMode="numeric"
                      disabled={isOperator(user.role)}
                      className="w-full text-2xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-20"
                      placeholder="0"
                      value={activeFlight?.psi !== undefined && activeFlight?.psi !== null ? activeFlight.psi : ''}
                      onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              onInputChange('psi' as any, val === '' ? undefined : parseFloat(val));
                          }
                      }}
                  />
              </div>
              <div className="p-6 border border-outline rounded-3xl bg-surface-dim/20">
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-40">Flow Rate (LPM)</label>
                  <input
                      type="text"
                      inputMode="numeric"
                      disabled={isOperator(user.role)}
                      className="w-full text-2xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-20"
                      placeholder="0"
                      value={activeFlight?.lpm !== undefined && activeFlight?.lpm !== null ? activeFlight.lpm : ''}
                      onChange={(e) => {
                          const val = e.target.value.replace(/,/g, '');
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              onInputChange('lpm' as any, val === '' ? undefined : parseFloat(val));
                          }
                      }}
                  />
              </div>
          </div>
       </div>

          <div className="border-t border-outline pt-6">
               <button 
                   onClick={() => { if (!isOperator(user.role)) setShowTopUp(!showTopUp); }} 
                   disabled={isOperator(user.role)}
                   className="text-primary font-black text-[11px] uppercase tracking-widest flex items-center hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
               >
                   {showTopUp ? '- Strike Top-Up Data' : '+ Register Top-Up Event'}
               </button>
               {showTopUp && (
                    <div className="space-y-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-400">
                        {/* Final Start */}
                        <div className="flex gap-4 items-stretch w-full">
                            <button 
                                onClick={() => { if (!isOperator(user.role)) onTimestamp('timestampFinalStart'); }} 
                                disabled={isOperator(user.role)}
                                className={`flex-1 p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                                    ${activeFlight?.timestampFinalStart 
                                        ? 'bg-success/5 border-success text-on-surface' 
                                        : isOperator(user.role)
                                            ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                                            : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                                `}
                            >
                                <div className="relative z-10">
                                    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-1">Top-Up</span>
                                    <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampFinalStart ? 'text-success' : 'text-on-surface'}`}>
                                        FINAL START
                                    </span>
                                    {activeFlight?.timestampFinalStart && (
                                        <span className="block mt-3 font-black text-[10px] uppercase tracking-widest text-success flex items-center">
                                             <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60"/>
                                             {new Date(activeFlight.timestampFinalStart).toLocaleTimeString([], { hour12: false })}
                                         </span>
                                    )}
                                </div>
                                {!activeFlight?.timestampFinalStart && <Play className="absolute right-4 bottom-4 w-12 h-12 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                                {activeFlight?.timestampFinalStart && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-success opacity-10" />}
                            </button>
                            <div className="card-premium p-4 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                                <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-2 text-center">Manual Time</span>
                                <div className="relative w-full">
                                    <input 
                                        type="time"
                                        disabled={isOperator(user.role)}
                                        value={activeFlight?.timestampFinalStart ? getLocalTimeValue(activeFlight.timestampFinalStart) : ''}
                                        onChange={(e) => setManualTime('timestampFinalStart', e.target.value)}
                                        className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Final End */}
                        <div className="flex gap-4 items-stretch w-full">
                            <button 
                                onClick={() => { if (!isOperator(user.role)) onTimestamp('timestampFinalEnd'); }} 
                                disabled={isOperator(user.role)}
                                className={`flex-1 p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                                    ${activeFlight?.timestampFinalEnd 
                                        ? 'bg-success/5 border-success text-on-surface' 
                                        : isOperator(user.role)
                                            ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                                            : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                                `}
                            >
                                <div className="relative z-10">
                                    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-1">Top-Up</span>
                                    <span className={`block text-xl sm:text-2xl font-[900] tracking-tighter ${activeFlight?.timestampFinalEnd ? 'text-success' : 'text-on-surface'}`}>
                                        FINAL END
                                    </span>
                                    {activeFlight?.timestampFinalEnd && (
                                        <span className="block mt-3 font-black text-[10px] uppercase tracking-widest text-success flex items-center">
                                             <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60"/>
                                             {new Date(activeFlight.timestampFinalEnd).toLocaleTimeString([], { hour12: false })}
                                         </span>
                                    )}
                                </div>
                                {!activeFlight?.timestampFinalEnd && <Pause className="absolute right-4 bottom-4 w-12 h-12 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                                {activeFlight?.timestampFinalEnd && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-success opacity-10" />}
                            </button>
                            <div className="card-premium p-4 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                                <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-2 text-center">Manual Time</span>
                                <div className="relative w-full">
                                    <input 
                                        type="time"
                                        disabled={isOperator(user.role)}
                                        value={activeFlight?.timestampFinalEnd ? getLocalTimeValue(activeFlight.timestampFinalEnd) : ''}
                                        onChange={(e) => setManualTime('timestampFinalEnd', e.target.value)}
                                        className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
          </div>

       <div className="mt-auto pt-10">
           <button 
              onClick={onNext}
              disabled={!isOperator(user.role) && (!activeFlight?.volume || activeFlight.volume <= 0)}
              className="w-full kinetic-gradient p-4 lg:p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale shadow-premium active:scale-95 transition-all text-white"
           >
              Final Compliance <ChevronRight className="ml-3 w-5 h-5" />
          </button>
       </div>
  </div>
);

const ScreenQC: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onInputChange: (field: keyof FlightLog, value: any) => void, 
  onSubmit: () => void, 
  onBack: () => void,
  onClose: () => void,
  loading: boolean,
  user: User
}> = ({ activeFlight, onInputChange, onSubmit, onBack, onClose, loading, user }) => {
  const qcCheckDetails: Record<string, { title: string, subtitle: string }> = {
    panelCheck: {
      title: 'Panel Check',
      subtitle: 'Panel Closed & Secured'
    },
    walkAroundCheck: {
      title: 'Walk Around Check',
      subtitle: 'Apron walkaround complete'
    },
    appearanceCheck: {
      title: 'Appearance Check',
      subtitle: 'Clear & bright, no particulates'
    },
    waterCheck: {
      title: 'Water Check',
      subtitle: 'Chemical water detector negative'
    }
  };

  return (
    <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
        <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
           <ChevronLeft className="w-4 h-4 mr-2" /> Back to Metering
        </button>
        <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase">JIG <span className="text-primary italic">Compliance Protocol</span></h2>

        <div className="space-y-4 card-premium p-8 border-outline shadow-inner">
           {['panelCheck', 'walkAroundCheck', 'appearanceCheck', 'waterCheck'].map((check) => {
               const isChecked = !!activeFlight?.[check as keyof FlightLog];
               const isDisabled = isOperator(user.role);
               const details = qcCheckDetails[check];

               return (
                   <label 
                       key={check} 
                       className={`flex items-center p-5 rounded-2xl border-2 transition-all 
                           ${isChecked ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim'} 
                           ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/30'}
                       `}
                   >
                       <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 
                           ${isChecked ? 'bg-success border-success' : 'border-outline bg-surface'}
                       `}>
                           {isChecked && <CheckCircle className="w-4 h-4 text-white" />}
                       </div>
                       <input 
                           type="checkbox" 
                           checked={isChecked} 
                           onChange={(e) => onInputChange(check as keyof FlightLog, e.target.checked)}
                           disabled={isDisabled}
                           className="hidden"
                       />
                       <div className="ml-5">
                           <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">
                               {details.title}
                           </span>
                           <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">
                               {details.subtitle}
                           </span>
                       </div>
                   </label>
               );
           })}
           
           <div className="pt-6">
               <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Task Remarks & Feedback</label>
               <textarea 
                   className="w-full bg-surface-container-low border-2 border-outline rounded-2xl p-5 text-sm font-bold text-on-surface outline-none focus:border-primary transition-all min-h-[120px] placeholder:opacity-20 disabled:opacity-50"
                   placeholder={isOperator(user.role) ? 'No remarks' : 'Enter any operational remarks, delays, or equipment issues...'}
                   value={activeFlight?.remarks || ''}
                   onChange={(e) => onInputChange('remarks', e.target.value)}
                   disabled={isOperator(user.role)}
               />
           </div>
        </div>

        <div className="mt-auto pt-10 space-y-6">
            <div className="bg-warning/5 border border-warning/20 p-6 rounded-3xl flex items-start">
                <AlertTriangle className="w-6 h-6 text-warning mr-4 flex-shrink-0" />
                <p className="text-[11px] font-bold text-on-surface opacity-60 leading-relaxed uppercase tracking-widest">Digital certification required. By committing, you verify JIG compliance and manual safety checks are complete.</p>
            </div>
            
            {isOperator(user.role) ? (
               <button 
                  onClick={onClose}
                  className="w-full bg-surface-lowest text-on-surface-dim border border-outline font-[900] text-[14px] lg:text-[15px] uppercase tracking-[0.3em] flex items-center justify-center p-5 lg:p-7 rounded-3xl shadow-premium hover:bg-surface-container hover:text-primary transition-all active:scale-95"
               >
                  Return to Dashboard
               </button>
            ) : (
               <button 
                  onClick={onSubmit}
                  disabled={loading || !activeFlight?.panelCheck || !activeFlight?.walkAroundCheck || !activeFlight?.appearanceCheck || !activeFlight?.waterCheck}
                  className="w-full kinetic-gradient p-5 lg:p-7 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale shadow-premium active:scale-95 transition-all text-white"
               >
                  {loading ? 'ENCRYPTING & SYNCING...' : (
                      <>
                          <Save className="w-5 h-5 lg:w-6 lg:h-6 mr-4" />
                          AUTHORIZE TASK COMPLETE
                      </>
                  )}
               </button>
            )}
        </div>
   </div>
  );
};

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user, initialJob, onClearInitialJob, initialVehicleId, onClearInitialVehicleId }) => {
  const { notify } = useNotification();
  const { equipment, flightJobs, flightLogs, updateEquipmentStatus, updateEquipment, createAlert, updateFlightJob, externalFlights, staff, refreshData, selectedBriefingDate } = useOperationalData();
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(null);
  const [paymentType, setPaymentType] = useState<'CREDIT' | 'CASH' | 'VOID'>('CREDIT');
  const [cashRate, setCashRate] = useState<string>('1.85');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidForm, setVoidForm] = useState({ date: new Date().toISOString().split('T')[0], deliveryNumber: '' });
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidSuccess, setVoidSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auto-show void modal when VOID selected
  useEffect(() => {
    if (paymentType === 'VOID') setShowVoidModal(true);
    else setShowVoidModal(false);
  }, [paymentType]);

  useEffect(() => {
    if (showVoidModal) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [showVoidModal]);

  const handleSaveVoid = async () => {
    if (voidForm.deliveryNumber.length !== 6) return;
    
    const fullDeliveryNumber = `MLE-${voidForm.deliveryNumber}`;
    const isDuplicate = (flightLogs || []).some(log => log && log.deliveryNumber === fullDeliveryNumber);
    if (isDuplicate) {
      notify(`Delivery ticket number ${fullDeliveryNumber} is already used. Void aborted.`, 'error');
      return;
    }

    setVoidSaving(true);
    try {
      await supabaseService.createFlightLog({
        flightNumber: 'VOID',
        aircraftReg: 'N/A',
        aircraftType: 'N/A',
        stand: 'N/A',
        operatorId: user.id,
        vehicleId: selectedVehicleId,
        status: 'COMPLETED',
        logType: 'FLIGHT' as const,
        deliveryNumber: `MLE-${voidForm.deliveryNumber}`,
        timestampStart: `${voidForm.date}T00:00:00.000Z`,
        timestampClearance: new Date().toISOString(),
        meterOpen: 0,
        meterClose: 0,
        volume: 0,
        panelCheck: false,
        walkAroundCheck: false,
        appearanceCheck: false,
        waterCheck: false,
        remarks: `VOIDED TICKET - ${voidForm.deliveryNumber}`
      });
      setVoidSuccess(true);
      setTimeout(() => {
        setVoidSuccess(false);
        setShowVoidModal(false);
        setPaymentType('CREDIT');
        setVoidForm({ date: new Date().toISOString().split('T')[0], deliveryNumber: '' });
      }, 2000);
    } catch (e) {
      console.error('Void save failed:', e);
    } finally {
      setVoidSaving(false);
    }
  };
  
  const hasStartedRef = React.useRef(false);

  // Auto-start if job passed from dashboard
  useEffect(() => {
    if (initialJob && !hasStartedRef.current) {
      hasStartedRef.current = true;
      const vehicleToUse = initialJob.vehicleId || initialVehicleId || selectedVehicleId;
      startJob(initialJob, vehicleToUse);
      if (onClearInitialJob) onClearInitialJob();
      if (onClearInitialVehicleId) onClearInitialVehicleId();
    }
  }, [initialJob, initialVehicleId]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (initialJob?.vehicleId) return initialJob.vehicleId;
    if (initialVehicleId) return initialVehicleId;
    const saved = localStorage.getItem(`fms_last_selected_vehicle_${user.id}`);
    if (saved) return saved;
    const available = equipment.find(eq => eq.status === EquipmentStatus.AVAILABLE && (eq.id.startsWith('RF') || eq.id.startsWith('HD')));
    return available ? available.id : 'RF-04';
  });

  const changeSelectedVehicleId = (id: string) => {
    setSelectedVehicleId(id);
    localStorage.setItem(`fms_last_selected_vehicle_${user.id}`, id);
  };

  const [showTopUp, setShowTopUp] = useState(false);
  const [equipPickerJob, setEquipPickerJob] = useState<FlightJob | null>(null);
  const [equipPickerSelected, setEquipPickerSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (initialJob && initialJob.vehicleId) {
      setSelectedVehicleId(initialJob.vehicleId);
    }
  }, [initialJob]);

  useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId);
    }
  }, [initialVehicleId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeFlightRef = React.useRef(activeFlight);
  const selectedVehicleIdRef = React.useRef(selectedVehicleId);
  const flightJobsRef = React.useRef(flightJobs);
  const updateEquipmentStatusRef = React.useRef(updateEquipmentStatus);
  const updateFlightJobRef = React.useRef(updateFlightJob);

  useEffect(() => {
    activeFlightRef.current = activeFlight;
  }, [activeFlight]);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    flightJobsRef.current = flightJobs;
  }, [flightJobs]);

  useEffect(() => {
    updateEquipmentStatusRef.current = updateEquipmentStatus;
  }, [updateEquipmentStatus]);

  useEffect(() => {
    updateFlightJobRef.current = updateFlightJob;
  }, [updateFlightJob]);

  useEffect(() => {
    return () => {
      const activeFl = activeFlightRef.current;
      const vehicleId = activeFl?.vehicleId || selectedVehicleIdRef.current;
      const jobs = flightJobsRef.current;

      if (activeFl && vehicleId && !isSubmittingOrCompletingRef.current) {
        // Release equipment status
        updateEquipmentStatusRef.current(vehicleId, EquipmentStatus.AVAILABLE);

        // Revert flight job back to PENDING so it can be re-started
        const cancelledJob = (jobs || []).find(j => j.flightNumber === activeFl.flightNumber && j.status === 'IN_PROGRESS');
        if (cancelledJob) {
          updateFlightJobRef.current(cancelledJob.id, { status: 'PENDING', vehicleId: undefined });
        }
      }
    };
  }, []);

  const startJob = (job: FlightJob, vehicleIdOverride?: string) => {
    const activeVehicleId = vehicleIdOverride || selectedVehicleId;
    const isRfJob = job.equipmentUsage?.toUpperCase() === 'REFUELLER';
    const isHdJob = job.equipmentUsage?.toUpperCase() === 'HYDRANT';
    const isSelectedRf = activeVehicleId?.toUpperCase().startsWith('RF');
    const isSelectedHd = activeVehicleId?.toUpperCase().startsWith('HD');

    if (isRfJob && !isSelectedRf) {
      notify(`This job is assigned as REFUELLER (RF). You must select an RF equipment to start it.`, 'error');
      const rfEquip = (equipment || []).filter(eq => eq.id.startsWith('RF') && (eq.currentVolume || 0) > 0 && eq.status === EquipmentStatus.AVAILABLE);
      const saved = localStorage.getItem(`fms_last_selected_vehicle_${user.id}`);
      const defaultSelected = (saved && rfEquip.some(e => e.id === saved)) ? saved : (rfEquip[0]?.id || '');
      setEquipPickerSelected(defaultSelected);
      setEquipPickerJob(job);
      return;
    }
    if (isHdJob && !isSelectedHd) {
      notify(`This job is assigned as HYDRANT (HD). You must select an HD equipment to start it.`, 'error');
      const hdEquip = (equipment || []).filter(eq => eq.id.startsWith('HD') && eq.status === EquipmentStatus.AVAILABLE);
      const saved = localStorage.getItem(`fms_last_selected_vehicle_${user.id}`);
      const defaultSelected = (saved && hdEquip.some(e => e.id === saved)) ? saved : (hdEquip[0]?.id || '');
      setEquipPickerSelected(defaultSelected);
      setEquipPickerJob(job);
      return;
    }

    // Auto-update Equipment Status to IN_PROGRESS/IN_USE
    updateEquipmentStatus(activeVehicleId, EquipmentStatus.IN_USE);

    // Update flight job status to IN_PROGRESS so Operator Oversight reflects active tasks
    const matchingJob = (flightJobs || []).find(j => j.flightNumber === job.flightNumber && j.status === 'PENDING');
    if (matchingJob) {
      updateFlightJob(matchingJob.id, { status: 'IN_PROGRESS', vehicleId: activeVehicleId, assignedTo: user.id });
    }

    // Fetch last meterClose for this vehicle
    // Use parseFloat to handle both string and number values from BigQuery API
    const parseMeterClose = (v: any) => { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n; };
    const vehicleLogs = (flightLogs || []).filter(log => 
      log && log.vehicleId?.toUpperCase() === activeVehicleId?.toUpperCase() && 
      log.status?.toUpperCase() === 'COMPLETED' &&
      parseMeterClose(log.meterClose) > 0
    );
    const getLogTime = (log: any) => {
      if (log.timestampFinalEnd) return new Date(log.timestampFinalEnd).getTime();
      if (log.timestampClearance) return new Date(log.timestampClearance).getTime();
      if (log.timestampInitialEnd) return new Date(log.timestampInitialEnd).getTime();
      if (log.timestampStart) return new Date(log.timestampStart).getTime();
      if (log.timestampArrived) return new Date(log.timestampArrived).getTime();
      if (log.operationalDate) return new Date(log.operationalDate).getTime();
      return 0;
    };
    const lastLog = [...vehicleLogs].sort((a, b) => getLogTime(b) - getLogTime(a))[0];
    
    const initialMeter = lastLog ? parseMeterClose(lastLog.meterClose) : undefined;

    setSelectedVehicleId(activeVehicleId);

    setActiveFlight({
      flightNumber: job.flightNumber,
      aircraftReg: job.aircraftReg,
      aircraftType: job.aircraftType,
      stand: job.stand,
      operatorId: user.id,
      vehicleId: activeVehicleId,
      status: 'PENDING',
      meterOpen: initialMeter,
      volume: 0,
      panelCheck: false,
      walkAroundCheck: false,
      appearanceCheck: false,
      waterCheck: false,
      remarks: '',
      isAdhoc: job.isAdhoc,
      route: job.route,
      isDomestic: job.isDomestic,
      officer: job.assignedOfficer || '',
      operationalDate: job.date || selectedBriefingDate || new Date().toISOString().split('T')[0],
    });
    navigateToScreen('timestamps');
  };

  const handleTimestamp = (field: keyof FlightLog) => {
    if (!activeFlight) return;

    const TIMESTAMP_SEQUENCE: (keyof FlightLog)[] = [
      'timestampArrived',
      'timestampPosition',
      'timestampStart',
      'timestampInitialEnd',
      'timestampFinalStart',
      'timestampFinalEnd'
    ];

    const FIELD_LABELS: Record<string, string> = {
      timestampArrived: 'Log Arrived',
      timestampPosition: 'Log Position',
      timestampStart: 'Commence Fueling',
      timestampInitialEnd: 'Initial End',
      timestampFinalStart: 'Final Start',
      timestampFinalEnd: 'Final End'
    };

    const index = TIMESTAMP_SEQUENCE.indexOf(field);
    if (index !== -1) {
      const isCurrentlySet = !!activeFlight[field];

      if (isCurrentlySet) {
        // We want to UNDO (clear) this timestamp.
        // We must check if any subsequent timestamp in the sequence is currently set.
        for (let i = index + 1; i < TIMESTAMP_SEQUENCE.length; i++) {
          const subsequentField = TIMESTAMP_SEQUENCE[i];
          if (activeFlight[subsequentField]) {
            notify(`Cannot undo "${FIELD_LABELS[field]}". Please undo "${FIELD_LABELS[subsequentField]}" first.`, 'warning');
            return;
          }
        }
      } else {
        // We want to SET this timestamp.
        // We must check if all previous timestamps in the sequence are currently set.
        for (let i = 0; i < index; i++) {
          const previousField = TIMESTAMP_SEQUENCE[i];
          if (!activeFlight[previousField]) {
            notify(`Cannot log "${FIELD_LABELS[field]}" before "${FIELD_LABELS[previousField]}".`, 'warning');
            return;
          }
        }
      }
    }

    setActiveFlight(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: prev[field] ? undefined : new Date().toISOString()
      };
    });
  };

  const getLocalTimeValue = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const setManualTime = (field: keyof FlightLog, timeVal: string) => {
    if (!activeFlight) return;
    
    if (!timeVal) {
      const TIMESTAMP_SEQUENCE: (keyof FlightLog)[] = [
        'timestampArrived',
        'timestampPosition',
        'timestampStart',
        'timestampInitialEnd',
        'timestampFinalStart',
        'timestampFinalEnd'
      ];
      const FIELD_LABELS: Record<string, string> = {
        timestampArrived: 'Log Arrived',
        timestampPosition: 'Log Position',
        timestampStart: 'Commence Fueling',
        timestampInitialEnd: 'Initial End',
        timestampFinalStart: 'Final Start',
        timestampFinalEnd: 'Final End'
      };
      const index = TIMESTAMP_SEQUENCE.indexOf(field);
      if (index !== -1) {
        for (let i = index + 1; i < TIMESTAMP_SEQUENCE.length; i++) {
          const subsequentField = TIMESTAMP_SEQUENCE[i];
          if (activeFlight[subsequentField]) {
            notify(`Cannot undo "${FIELD_LABELS[field]}". Please undo "${FIELD_LABELS[subsequentField]}" first.`, 'warning');
            return;
          }
        }
      }
      handleInputChange(field, undefined);
      return;
    }

    const TIMESTAMP_SEQUENCE: (keyof FlightLog)[] = [
      'timestampArrived',
      'timestampPosition',
      'timestampStart',
      'timestampInitialEnd',
      'timestampFinalStart',
      'timestampFinalEnd'
    ];
    const FIELD_LABELS: Record<string, string> = {
      timestampArrived: 'Log Arrived',
      timestampPosition: 'Log Position',
      timestampStart: 'Commence Fueling',
      timestampInitialEnd: 'Initial End',
      timestampFinalStart: 'Final Start',
      timestampFinalEnd: 'Final End'
    };
    const index = TIMESTAMP_SEQUENCE.indexOf(field);
    if (index !== -1) {
      const isCurrentlySet = !!activeFlight[field];
      if (!isCurrentlySet) {
        for (let i = 0; i < index; i++) {
          const previousField = TIMESTAMP_SEQUENCE[i];
          if (!activeFlight[previousField]) {
            notify(`Cannot log "${FIELD_LABELS[field]}" before "${FIELD_LABELS[previousField]}".`, 'warning');
            return;
          }
        }
      }
    }

    const dateStr = activeFlight?.operationalDate || new Date().toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeVal.split(':').map(Number);
    
    const localDate = new Date();
    localDate.setFullYear(year, month - 1, day);
    localDate.setHours(hours, minutes, 0, 0);
    handleInputChange(field, localDate.toISOString());
  };

  const isSubmittingOrCompletingRef = React.useRef(false);

  const navigateToScreen = (screen: 'dashboard' | 'timestamps' | 'metering' | 'qc') => {
    setCurrentScreen(screen);
    const state = window.history.state;
    const currentItpScreen = state?.itpScreen || 'dashboard';
    if (currentItpScreen !== screen) {
      window.history.pushState({ fmsActive: true, itpScreen: screen }, '');
    }
  };

  const completeOrCancelJobAndExit = (successMessage?: string) => {
    isSubmittingOrCompletingRef.current = true;
    if (successMessage) {
      notify(successMessage, "success");
    } else {
      // It's a cancel: release equipment and revert flight job status
      const vehicleToRelease = activeFlight?.vehicleId || selectedVehicleId;
      if (vehicleToRelease) {
        updateEquipmentStatus(vehicleToRelease, EquipmentStatus.AVAILABLE);
      }
      // Revert flight job back to PENDING so it can be re-started
      if (activeFlight) {
        const cancelledJob = (flightJobs || []).find(j => j.flightNumber === activeFlight.flightNumber && j.status === 'IN_PROGRESS');
        if (cancelledJob) {
          updateFlightJob(cancelledJob.id, { status: 'PENDING', vehicleId: undefined });
        }
      }
    }
    
    let stepsBack = 0;
    if (currentScreen === 'timestamps') stepsBack = -1;
    else if (currentScreen === 'metering') stepsBack = -2;
    else if (currentScreen === 'qc') stepsBack = -3;

    if (stepsBack < 0) {
      window.history.go(stepsBack);
    } else {
      setActiveFlight(null);
      setCurrentScreen('dashboard');
    }
  };

  const handleBackToDashboard = () => {
    isSubmittingOrCompletingRef.current = true;
    // If a job was started, release the equipment and revert flight job status
    const vehicleToRelease = activeFlight?.vehicleId || selectedVehicleId;
    if (vehicleToRelease) {
      updateEquipmentStatus(vehicleToRelease, EquipmentStatus.AVAILABLE);
    }
    if (activeFlight) {
      const cancelledJob = (flightJobs || []).find(j => j.flightNumber === activeFlight.flightNumber && j.status === 'IN_PROGRESS');
      if (cancelledJob) {
        updateFlightJob(cancelledJob.id, { status: 'PENDING', vehicleId: undefined });
      }
    }
    setActiveFlight(null);
    setCurrentScreen('dashboard');
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isSubmittingOrCompletingRef.current) {
        if (!e.state?.itpScreen || e.state.itpScreen === 'dashboard') {
          isSubmittingOrCompletingRef.current = false;
          setActiveFlight(null);
          setCurrentScreen('dashboard');
        }
        return;
      }

      if (e.state && e.state.fmsActive) {
        const targetScreen = e.state.itpScreen || 'dashboard';
        if (targetScreen !== currentScreen) {
          if (targetScreen === 'dashboard') {
            handleBackToDashboard();
          } else {
            setCurrentScreen(targetScreen);
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen, activeFlight, selectedVehicleId]);

  const handleInputChange = (field: keyof FlightLog, value: any) => {
    setActiveFlight(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-sync Stand with PIT Number
      if (field === 'pitNumber' && value) {
        const mapping = PIT_MAPPING.find(m => m.pit === value || m.pit === `J${value}`);
        if (mapping && mapping.stand !== prev?.stand) {
          updated.stand = mapping.stand;
        }
      }
      
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!activeFlight) return;

    if (selectedVehicleId && selectedVehicleId.startsWith('RF')) {
      const vehicle = (equipment || []).find(eq => eq.id === selectedVehicleId);
      if (vehicle && vehicle.currentVolume !== undefined) {
        const volumeEntered = activeFlight.volume || 0;
        const maxAllowedVolume = vehicle.currentVolume + 500;
        if (volumeEntered > maxAllowedVolume) {
          notify(`Volume delivered (${volumeEntered.toLocaleString()} L) exceeds the refueller's balance fuel volume (${vehicle.currentVolume.toLocaleString()} L) by more than 500 L.`, 'error');
          return;
        }
      }
    }
    
    if (activeFlight.deliveryNumber) {
      try {
        // Fetch fresh logs directly from BigQuery to perform a live uniqueness check
        const latestLogs = await supabaseService.getFlightLogs();
        const isDuplicate = (latestLogs?.logs || []).some(log => log && log.deliveryNumber === activeFlight.deliveryNumber);
        if (isDuplicate) {
          notify(`Delivery ticket number ${activeFlight.deliveryNumber} is already used. Please enter a unique ticket number.`, 'error');
          return;
        }
      } catch (err) {
        console.warn('Failed to verify ticket uniqueness live, falling back to local check:', err);
        const isDuplicate = (flightLogs || []).some(log => log && log.deliveryNumber === activeFlight.deliveryNumber);
        if (isDuplicate) {
          notify(`Delivery ticket number ${activeFlight.deliveryNumber} is already used. Please enter a unique ticket number.`, 'error');
          return;
        }
      }
    }
    
    setLoading(true);
    isSubmittingOrCompletingRef.current = true;
    try {
      let savedRoute = activeFlight.route || '';
      if (activeFlight.isDomestic && savedRoute) {
        const parts = savedRoute.split(/\s+/);
        savedRoute = parts[parts.length - 1];
      }

      const isSeaplaneFlight = 
        (activeFlight as any).category?.toUpperCase() === 'SEA' || 
        (activeFlight as any).flightCategory?.toUpperCase() === 'SEA' || 
        (activeFlight as any).flight_category?.toUpperCase() === 'SEA' || 
        activeFlight.logType === 'SEAPLANE';

      const logToSave: Omit<FlightLog, 'id'> = {
        flightNumber: activeFlight.flightNumber || '',
        aircraftReg: activeFlight.aircraftReg || '',
        aircraftType: activeFlight.aircraftType || '',
        stand: activeFlight.stand || '',
        operatorId: user.id,
        vehicleId: selectedVehicleId,
        status: 'COMPLETED',
        logType: isSeaplaneFlight ? 'SEAPLANE' : 'FLIGHT',
        timestampArrived: activeFlight.timestampArrived,
        timestampPosition: activeFlight.timestampPosition,
        timestampStart: activeFlight.timestampStart,
        timestampInitialEnd: activeFlight.timestampInitialEnd,
        timestampFinalStart: activeFlight.timestampFinalStart,
        timestampFinalEnd: activeFlight.timestampFinalEnd,
        timestampClearance: activeFlight.timestampClearance || new Date().toISOString(),
        meterOpen: activeFlight.meterOpen,
        volume: activeFlight.volume || 0,
        panelCheck: activeFlight.panelCheck || false,
        walkAroundCheck: activeFlight.walkAroundCheck || false,
        appearanceCheck: activeFlight.appearanceCheck || false,
        waterCheck: activeFlight.waterCheck || false,
        remarks: activeFlight.remarks || '',
        meterClose: (activeFlight.meterOpen || 0) + (activeFlight.volume || 0),
        deliveryNumber: activeFlight.deliveryNumber,
        pitNumber: activeFlight.pitNumber,
        co: activeFlight.co,
        isAdhoc: activeFlight.isAdhoc,
        route: savedRoute,
        isDomestic: activeFlight.isDomestic,
        intDom: isSeaplaneFlight ? 'SEA' : (activeFlight.isDomestic ? 'DOM' : 'INT'),
        airline: getAirlineName(activeFlight.flightNumber || '', externalFlights),
        operationalDate: activeFlight.operationalDate || new Date().toISOString().split('T')[0],
        psi: activeFlight.psi,
        lpm: activeFlight.lpm,
        officer: activeFlight.officer || (user.role === UserRole.ITP_OPERATOR ? 'ITP Officer' : user.name),
        operatorName: activeFlight.operatorName || (staff && staff.find(s => s.id === activeFlight.operatorId)?.name) || user.name,
        tacticalOperator: (staff && staff.find(s => s.id === activeFlight.operatorId)?.name) || user.name,
        destination: activeFlight.destination,
        paymentType: paymentType || activeFlight.paymentType || 'CREDIT',
      };

      await supabaseService.createFlightLog(logToSave);
      
      // Update Refueller Payload/Inventory if applicable
      if (selectedVehicleId.startsWith('RF')) {
        const vehicle = equipment.find(eq => eq.id === selectedVehicleId);
        if (vehicle && vehicle.currentVolume !== undefined) {
          const newVolume = Math.max(0, vehicle.currentVolume - (activeFlight.volume || 0));
          const capacity = vehicle.maxCapacity || 20000;
          const isLow = newVolume < 2000 || newVolume < capacity * 0.1;
          
          await updateEquipment(selectedVehicleId, { 
            currentVolume: newVolume,
            status: isLow ? EquipmentStatus.REFUELLING : EquipmentStatus.AVAILABLE 
          });

          if (isLow) {
            // Trigger automatic replenishment request for Depot Operator
            try {
              await createAlert({
                severity: 'medium',
                message: `Replenishment requested for unit ${selectedVehicleId} (Low fuel: ${newVolume.toLocaleString()}L)`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                acknowledged: false,
                targetRole: UserRole.DEPOT_OPERATOR
              });
              notify(`Refueller ${selectedVehicleId} fuel level is low (${newVolume.toLocaleString()}L). Replenishment request triggered automatically.`, 'warning');
            } catch (err) {
              console.error("Auto alert trigger failed:", err);
            }
          }
        } else {
          updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
        }
      } else {
        // Just release hydrant/service equipment
        updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
      }

      // Find matching flight job and mark it as COMPLETED in the database
      const matchingJob = (flightJobs || []).find(job => job.flightNumber === activeFlight.flightNumber && job.status !== 'COMPLETED');
      if (matchingJob) {
        await updateFlightJob(matchingJob.id, { status: 'COMPLETED' });
      }

      await refreshData();
      completeOrCancelJobAndExit("Job Completed & Synced to Database!");
    } catch (error) {
      console.error('Error saving flight log:', error);
      isSubmittingOrCompletingRef.current = false;
      notify('Failed to sync. Please check your secure connection.', "error");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-full flex flex-col bg-surface-container-lowest transition-colors duration-500">
        <MobileHeader 
          user={user} 
          isOnline={isOnline} 
          activeFlight={activeFlight} 
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={changeSelectedVehicleId}
          equipment={equipment}
          paymentType={paymentType}
          setPaymentType={(v) => setPaymentType(v as any)}
          cashRate={cashRate}
          setCashRate={setCashRate}
        />

        {/* Detail Confirmation Modal */}
        {showConfirmModal && activeFlight && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface rounded-3xl border border-outline shadow-premium w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-300 my-auto max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-outline/30 shrink-0">
                <div>
                  <span className="block text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Confirm Authorization</span>
                  <h3 className="text-2xl font-[900] tracking-tighter text-on-surface">REVIEW OPERATIONS LOG</h3>
                </div>
                <button onClick={() => setShowConfirmModal(false)} className="p-2 rounded-xl hover:bg-surface-dim transition-colors">
                  <X className="w-5 h-5 text-on-surface-dim" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin">
                {/* Flight & Equipment Block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-dim/40 p-5 rounded-2xl border border-outline/20">
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Flight Number</span>
                    <span className="text-[12px] font-black text-on-surface uppercase">{activeFlight.flightNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Airline / Customer</span>
                    <span className="text-[12px] font-black text-primary uppercase">{activeFlight.airline || getAirlineName(activeFlight.flightNumber || '', externalFlights) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Reg / Type</span>
                    <span className="text-[12px] font-black text-on-surface uppercase">
                      {(activeFlight.aircraftReg || 'N/A')} / {(activeFlight.aircraftType || 'N/A')}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Parking Stand</span>
                    <span className="text-[12px] font-black text-on-surface uppercase">{activeFlight.stand || 'N/A'}</span>
                  </div>
                </div>

                {/* Metering & Delivery Info */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="card-premium p-4 border-outline/30">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Opening Meter</span>
                    <span className="text-lg font-mono font-black text-on-surface">
                      {activeFlight.meterOpen?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="card-premium p-4 border-outline/30">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Totalizer Volume</span>
                    <span className="text-lg font-mono font-black text-primary">
                      {activeFlight.volume?.toLocaleString() || '0'} L
                    </span>
                  </div>
                  <div className="card-premium p-4 border-outline/30">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Closing Meter</span>
                    <span className="text-lg font-mono font-black text-on-surface">
                      {((activeFlight.meterOpen || 0) + (activeFlight.volume || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="card-premium p-4 border-outline/30">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">PSI</span>
                    <span className="text-lg font-mono font-black text-on-surface">
                      {activeFlight.psi !== undefined && activeFlight.psi !== null ? activeFlight.psi : 'N/A'}
                    </span>
                  </div>
                  <div className="card-premium p-4 border-outline/30">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">LPM</span>
                    <span className="text-lg font-mono font-black text-on-surface">
                      {activeFlight.lpm !== undefined && activeFlight.lpm !== null ? activeFlight.lpm : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Timestamps Listing */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Operations Timeline</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Ramp Arrived', time: activeFlight.timestampArrived },
                      { label: 'Positioned at AC', time: activeFlight.timestampPosition },
                      { label: 'Commence Pumping', time: activeFlight.timestampStart },
                      { label: 'Initial End', time: activeFlight.timestampInitialEnd },
                      { label: 'Top-Up Start', time: activeFlight.timestampFinalStart },
                      { label: 'Top-Up End', time: activeFlight.timestampFinalEnd },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 bg-surface-dim/30 rounded-xl border border-outline/20">
                        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface">{item.label}</span>
                        {item.time ? (
                          <span className="text-[10px] font-black text-success font-mono flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                            {new Date(item.time).toLocaleTimeString([], { hour12: false })}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-on-surface-dim opacity-30 italic">Not Registered</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* QC Compliance & Ticket Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-5 bg-success/5 border border-success/20 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-success">JIG QC Compliance</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase text-on-surface">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span>Panel Check</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span>Walk Around</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span>Appearance</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span>Water Check</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-surface-dim/40 border border-outline/20 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-55">Log Billing & Personnel</h4>
                    <div className="space-y-1.5 text-[10px] font-black uppercase">
                      <div>
                        <span className="opacity-40 tracking-wider">Ticket:</span>{' '}
                        {(() => {
                          const ticket = activeFlight.deliveryNumber || '';
                          if (ticket.startsWith('MLE-')) {
                            const num = ticket.substring(4);
                            return (
                              <span className="font-mono text-on-surface-dim font-black">
                                MLE-<span className="text-sm sm:text-base font-black text-error">{num}</span>
                              </span>
                            );
                          }
                          return <span className="text-on-surface font-black">{ticket || 'PENDING'}</span>;
                        })()}
                      </div>
                      {activeFlight.paymentType && (
                        <div>
                          <span className="opacity-40 tracking-wider">Payment Mode:</span>{' '}
                          <span className="text-warning font-black">{activeFlight.paymentType}</span>
                        </div>
                      )}
                      {activeFlight.co && (
                        <div>
                          <span className="opacity-40 tracking-wider">C/O (Account):</span>{' '}
                          <span className="text-primary">{activeFlight.co}</span>
                        </div>
                      )}
                      {activeFlight.pitNumber && (
                        <div>
                          <span className="opacity-40 tracking-wider">PIT Number:</span>{' '}
                          <span className="text-on-surface">{activeFlight.pitNumber}</span>
                        </div>
                      )}
                      {activeFlight.officer && (
                        <div>
                          <span className="opacity-40 tracking-wider">Officer:</span>{' '}
                          <span className="text-on-surface">{activeFlight.officer}</span>
                        </div>
                      )}
                      {activeFlight.operatorName && (
                        <div>
                          <span className="opacity-40 tracking-wider">Operator Name:</span>{' '}
                          <span className="text-on-surface">{activeFlight.operatorName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {activeFlight.remarks && (
                  <div className="p-4 bg-surface-dim/40 border border-outline/20 rounded-2xl">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-2">Remarks</span>
                    <p className="text-[11px] font-medium text-on-surface italic">{activeFlight.remarks}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-outline/30 shrink-0">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-4 bg-surface-dim border border-outline text-on-surface rounded-2xl font-[900] text-[11px] uppercase tracking-[0.2em] hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-5 h-5 shrink-0" />
                  <span className="hidden sm:inline">Go Back & Edit</span>
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmModal(false);
                    await handleSubmit();
                  }}
                  disabled={loading}
                  className="flex-1 py-4 kinetic-gradient text-white rounded-2xl font-[900] text-[11px] uppercase tracking-[0.2em] shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="font-[900]">SYNCING...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span className="hidden sm:inline">Authorize & Submit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Void Ticket Modal */}
        {showVoidModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface rounded-3xl border border-error/30 shadow-premium w-full max-w-md p-8 animate-in fade-in zoom-in duration-300 my-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="block text-[10px] font-black text-error uppercase tracking-[0.3em] mb-1">Void Operation</span>
                  <h3 className="text-2xl font-[900] tracking-tighter text-on-surface">VOID TICKET</h3>
                </div>
                <button onClick={() => { setShowVoidModal(false); setPaymentType('CREDIT'); }} className="p-2 rounded-xl hover:bg-surface-dim transition-colors">
                  <X className="w-5 h-5 text-on-surface-dim" />
                </button>
              </div>

              {voidSuccess ? (
                <div className="flex flex-col items-center py-8">
                  <CheckCircle className="w-14 h-14 text-success mb-4" />
                  <p className="text-success font-black text-lg uppercase tracking-widest">Ticket Voided</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-60">Operational Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={voidForm.date}
                        onChange={(e) => setVoidForm(p => ({ ...p, date: e.target.value }))}
                        onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                        className="w-full pl-10 pr-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black focus:ring-4 focus:ring-error/10 focus:border-error outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-error opacity-50 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-60">Delivery Ticket Number</label>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-2xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">MLE-</span>
                      <input
                        type="text"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="000000"
                        value={voidForm.deliveryNumber}
                        onChange={(e) => setVoidForm(p => ({ ...p, deliveryNumber: e.target.value.replace(/\D/g,'').slice(0,6) }))}
                        className="flex-1 min-w-0 text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-error transition-all text-error placeholder:text-error/20"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveVoid}
                    disabled={voidForm.deliveryNumber.length !== 6 || voidSaving}
                    className="w-full py-4 bg-error text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
                  >
                    <Ban className="w-4 h-4" />
                    {voidSaving ? 'SAVING...' : 'CONFIRM VOID'}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

        <div className="flex-1">
            {currentScreen === 'dashboard' && (
              <ScreenDashboard 
                user={user} 
                onStartJob={startJob} 
                selectedVehicleId={selectedVehicleId}
                setSelectedVehicleId={changeSelectedVehicleId}
                flightLogs={flightLogs}
                activeFlight={activeFlight}
              />
            )}
            {currentScreen === 'timestamps' && (
              <ScreenTimestamps 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onInputChange={handleInputChange}
                onNext={() => navigateToScreen('metering')}
                onBack={() => window.history.back()}
                user={user}
                getLocalTimeValue={getLocalTimeValue}
                setManualTime={setManualTime}
              />
            )}
            {currentScreen === 'metering' && (
              <ScreenMetering 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onInputChange={handleInputChange}
                onNext={() => navigateToScreen('qc')}
                onBack={() => window.history.back()}
                showTopUp={showTopUp}
                setShowTopUp={setShowTopUp}
                user={user}
                getLocalTimeValue={getLocalTimeValue}
                setManualTime={setManualTime}
              />
            )}
            {currentScreen === 'qc' && (
              <ScreenQC 
                activeFlight={activeFlight} 
                onInputChange={handleInputChange}
                onSubmit={() => setShowConfirmModal(true)}
                onBack={() => window.history.back()}
                onClose={() => completeOrCancelJobAndExit()}
                loading={loading}
                user={user}
              />
            )}
        </div>
        <style>{`
          html.modal-open, html.modal-open body {
            overflow: hidden !important;
            height: 100% !important;
          }
          @media (max-width: 1023px) {
            html.modal-open .sticky.top-0,
            html.modal-open header,
            html.modal-open .fixed.bottom-6 {
              display: none !important;
            }
          }
        `}</style>

        {/* Equipment Picker Modal for IntoPlane Startup Errors */}
        {equipPickerJob && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setEquipPickerJob(null)}
          >
            <div
              className="bg-surface border border-outline rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-outline">
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-70 mb-1">Select Equipment</p>
                  <h3 className="text-lg font-black text-on-surface tracking-tight">{equipPickerJob.flightNumber}</h3>
                  <p className="text-[11px] text-on-surface-dim font-bold mt-0.5">{equipPickerJob.aircraftReg} • Stand {equipPickerJob.stand}</p>
                </div>
                <button
                  onClick={() => setEquipPickerJob(null)}
                  className="w-9 h-9 rounded-xl bg-surface-dim hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors text-on-surface-dim"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Equipment List */}
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {(equipment || [])
                  .filter(eq => {
                    const isRf = eq.id.startsWith('RF');
                    const isHd = eq.id.startsWith('HD');
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER';
                    const isHdJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'HYDRANT';
                    
                    if (isRfJob) {
                      return isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected);
                    }
                    if (isHdJob) {
                      return isHd;
                    }
                    return false;
                  })
                  .map(eq => {
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER';
                    const activeJob = (flightJobs || []).find(fj => fj.status === 'IN_PROGRESS' && fj.vehicleId?.toUpperCase() === eq.id.toUpperCase());
                    const isSelected = equipPickerSelected === eq.id;
                    const isDisabled = !isRfJob && !!activeJob;

                    return (
                      <button
                        key={eq.id}
                        disabled={isDisabled}
                        onClick={() => setEquipPickerSelected(eq.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : isDisabled
                              ? 'opacity-40 cursor-not-allowed border-outline bg-surface-dim'
                              : 'border-outline bg-surface-dim hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'kinetic-gradient border-none text-white' : 'bg-surface border border-outline text-on-surface-dim'}`}>
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className={`text-sm font-black ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{eq.id}</p>
                            <p className="text-[10px] text-on-surface-dim font-bold uppercase tracking-widest">{eq.id.startsWith('RF') ? 'Refueller' : 'Hydrant'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isRfJob ? (
                            <>
                              <p className="text-[10px] text-on-surface-dim font-bold opacity-60 uppercase tracking-widest">Fuel Level</p>
                              <p className={`text-sm font-black font-mono ${getFuelColorClass(eq.currentVolume, eq.maxCapacity)}`}>
                                {eq.currentVolume ? `${eq.currentVolume.toLocaleString()} L` : '0 L'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[10px] text-on-surface-dim font-bold opacity-60 uppercase tracking-widest">Status</p>
                              <p className={`text-sm font-black font-mono ${activeJob ? 'text-error animate-pulse' : 'text-success'}`}>
                                {activeJob ? `In Use: ${activeJob.flightNumber}` : 'Available'}
                              </p>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                {(() => {
                  const list = (equipment || []).filter(eq => {
                    const isRf = eq.id.startsWith('RF');
                    const isHd = eq.id.startsWith('HD');
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER';
                    const isHdJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'HYDRANT';
                    if (isRfJob) return isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected);
                    if (isHdJob) return isHd;
                    return false;
                  });
                  return list.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-on-surface-dim font-bold text-sm">No matching equipment found.</p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-outline flex gap-3">
                <button
                  onClick={() => setEquipPickerJob(null)}
                  className="flex-1 py-3 rounded-2xl border border-outline text-on-surface-dim font-black text-sm hover:bg-surface-dim transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!equipPickerSelected}
                  onClick={() => {
                    if (equipPickerSelected && equipPickerJob) {
                      localStorage.setItem(`fms_last_selected_vehicle_${user.id}`, equipPickerSelected);
                      startJob(equipPickerJob, equipPickerSelected);
                      setEquipPickerJob(null);
                    }
                  }}
                  className="flex-1 py-3 rounded-2xl kinetic-gradient text-white font-black text-sm shadow-premium hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Start Job
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
