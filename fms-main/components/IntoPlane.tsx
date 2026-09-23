import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FlightLog, User, FlightJob, Equipment, EquipmentStatus, UserRole, isDomesticFlight, cleanRemarks } from '../types';
import { MOCK_USERS, PIT_MAPPING } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Users, Lock, Calendar, X, CreditCard, Ban, Eye, Zap, Bell, BellOff, BellRing, Megaphone, ExternalLink, Droplet, PlaneLanding, PlaneTakeoff, ArrowRightCircle, Check, CheckCheck, RotateCcw, Pencil, Plane, Fuel } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { flightRadarService } from '../services/flightRadarService';
import { getWatchedFlightIds, saveWatchedFlightIds } from '../services/watchedFlightsService';
import { equipmentBadgeClass, equipmentDotClass, getEquipmentHexColor } from '../utils/equipmentColors';
import { useNotification } from '../context/NotificationContext';

import { useOperationalData } from '../context/OperationalDataContext';
import { EditStandModal } from './Schedule';
import { EditFuelRequestModal } from './EditFuelRequestModal';
import { EditAircraftModal } from './EditAircraftModal';
import { cleanAircraftTypeName } from '../services/aircraftLookupService';
import { checkDuplicateTicketAcrossJetA1 } from '../services/ticketValidation';
import { serverTimeService } from '../services/serverTimeService';

interface IntoPlaneProps {
    user: User;
    initialJob?: FlightJob | null;
    onClearInitialJob?: () => void;
    initialVehicleId?: string | null;
    onClearInitialVehicleId?: () => void;
    setActiveView?: (view: string) => void;
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

const formatTimeSafe = (val?: any): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return trimmed;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return '';
};

const isReadOnly = (role?: UserRole) => 
  role === UserRole.EXECUTIVE || 
  role === UserRole.COMMERCIAL || 
  role === UserRole.FINANCE || 
  role === UserRole.CUSTOMER;

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
    setCashRate: (rate: string) => void,
    onEditActiveAircraft?: () => void,
    onEditActiveStand?: () => void
}> = ({ user, isOnline, activeFlight, selectedVehicleId, setSelectedVehicleId, equipment, paymentType, setPaymentType, cashRate, setCashRate, onEditActiveAircraft, onEditActiveStand }) => (
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
                  <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-black text-on-surface-dim uppercase tracking-widest truncate flex items-center">
                          <span className="text-on-surface">{activeFlight.stand || 'TBA'}</span>
                          {onEditActiveStand && (
                              <button
                                  type="button"
                                  onClick={onEditActiveStand}
                                  className="p-1 ml-0.5 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-60 hover:opacity-100 flex-shrink-0 cursor-pointer"
                                  title="Edit Parking Stand"
                              >
                                  <Pencil className="w-2.5 h-2.5" />
                              </button>
                          )}
                          {activeFlight.aircraftType && <span className="mx-1.5 opacity-50">•</span>}
                          {activeFlight.aircraftType && <span className="text-on-surface">{cleanAircraftTypeName(activeFlight.aircraftType)}</span>}
                          {activeFlight.aircraftReg && activeFlight.aircraftReg !== '8Q-TBA' && !activeFlight.aircraftReg.startsWith('8Q-DOM') && (
                              <>
                                  <span className="mx-1.5 opacity-50">•</span>
                                  <span className="text-primary">{activeFlight.aircraftReg}</span>
                              </>
                          )}
                      </span>
                      {onEditActiveAircraft && (
                          <button
                              type="button"
                              onClick={onEditActiveAircraft}
                              className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-60 hover:opacity-100 flex-shrink-0 cursor-pointer"
                              title="Edit Aircraft Type & Registration"
                          >
                              <Pencil className="w-3 h-3" />
                          </button>
                      )}
                  </div>
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
    activeFlight: Partial<FlightLog> | null,
    onResumeActiveFlight?: () => void,
    onCancelActiveFlight?: (job?: FlightJob) => void
}> = ({ user, onStartJob, selectedVehicleId, setSelectedVehicleId, flightLogs, activeFlight, onResumeActiveFlight, onCancelActiveFlight }) => {
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
    externalFlights,
    internationalSchedules,
    updateFlightJob
  } = useOperationalData();
  const [viewMode, setViewMode] = useState<'INT' | 'DOM' | 'ADHOC'>('INT');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [editingAircraftJob, setEditingAircraftJob] = useState<FlightJob | null>(null);
  const [editingStandJob, setEditingStandJob] = useState<FlightJob | null>(null);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => getWatchedFlightIds(user.id));
  const [localDomesticAssignments, setLocalDomesticAssignments] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fms_domestic_assignments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        const data = await supabaseService.getDomesticAssignments(todayDate);
        if (data && data.length > 0) {
          setLocalDomesticAssignments(data);
          localStorage.setItem('fms_domestic_assignments', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Failed to load domestic assignments in IntoPlane:', err);
      }
    };
    loadAssignments();
  }, []);

  const toggleWatch = useCallback((flightNumber: string) => {
    setWatchedIds(prev => {
      const next = new Set(prev);
      if (next.has(flightNumber)) {
        next.delete(flightNumber);
      } else {
        next.add(flightNumber);
      }
      saveWatchedFlightIds(user.id, next);
      return next;
    });
  }, [user.id]);

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
  const [activeDetailsJobId, setActiveDetailsJobId] = useState<string | null>(null);

  // Local cache for flight fuel dispatch status and timings to guarantee instantaneous UI updates
  const [dispatchCache, setDispatchCache] = useState<Record<string, {
    status: 'REQUEST_FUELING' | 'NO_FUEL';
    requestedTime: string;
    requestedAt?: string;
    acknowledged?: boolean;
    acknowledgedTime?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('fms_flight_fuel_dispatches');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const migrated: Record<string, any> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          migrated[k] = {
            status: v,
            requestedTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            acknowledged: false
          };
        } else if (v && typeof v === 'object') {
          migrated[k] = v;
        }
      }
      return migrated;
    } catch {
      return {};
    }
  });

  const updateDispatchCache = useCallback((
    cleanFlight: string, 
    record: {
      status: 'REQUEST_FUELING' | 'NO_FUEL';
      requestedTime: string;
      requestedAt?: string;
      acknowledged?: boolean;
      acknowledgedTime?: string;
      acknowledgedAt?: string;
      acknowledgedBy?: string;
    } | null
  ) => {
    setDispatchCache(prev => {
      const next = { ...prev };
      if (record === null) {
        delete next[cleanFlight];
      } else {
        next[cleanFlight] = record;
      }
      try {
        localStorage.setItem('fms_flight_fuel_dispatches', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist dispatch cache', e);
      }
      return next;
    });
  }, []);

  const handleSendFuelAlert = useCallback(async (job: FlightJob, alertType: 'REQUEST_FUELING' | 'NO_FUEL') => {
    const cleanFlight = (job.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    const timeNow = serverTimeService.getServerTimeString();
    const isoNow = serverTimeService.getServerIso();

    // Clear any prior alerts (including old cancellations or stale alerts) for this flight
    const staleAlerts = (alerts || []).filter(a => {
      const aType = a.alertType || '';
      const isDispatch = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' || aType === 'ALERT_CANCELLED';
      if (!isDispatch) return false;
      const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (aFlt && aFlt === cleanFlight) return true;
      const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
      return msgClean.includes(cleanFlight);
    });
    if (staleAlerts.length > 0) {
      try {
        await deleteAlerts(staleAlerts.map(a => a.id));
      } catch (e) {
        console.warn('Failed to delete old alerts', e);
      }
    }

    // Set cache with requested timestamp
    updateDispatchCache(cleanFlight, {
      status: alertType,
      requestedTime: timeNow,
      requestedAt: isoNow,
      acknowledged: false
    });

    const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;
    const assignee = usersList.find(u => u.id === job.assignedTo || u.name.toLowerCase() === (job.assignedTo || '').toLowerCase());
    const assigneeName = assignee?.name || job.assignedTo || null;
    const officer = job.assignedOfficer ? usersList.find(u => u.id === job.assignedOfficer || u.name.toLowerCase() === (job.assignedOfficer || '').toLowerCase()) : null;
    const officerName = officer?.name || job.assignedOfficer || null;

    const alertMeta = {
      aircraftReg: job.aircraftReg,
      stand: job.stand,
      eta: job.eta || job.sta,
      flightNumber: job.flightNumber,
      requestedTime: timeNow,
      requestedAt: isoNow
    };

    let dispatched = false;
    const isNoFuel = alertType === 'NO_FUEL';
    const label = isNoFuel ? 'No Fuel required' : 'Fueling Requested';

    try {
      const alertSeverity: 'critical' | 'warning' = isNoFuel ? 'warning' : 'critical';

      if (job.assignedTo) {
        await createAlert({
          severity: alertSeverity,
          alertType,
          flightNumber: job.flightNumber,
          message: `Into-Plane: ${label} for Flight ${job.flightNumber}${assigneeName ? ` (Operator: ${assigneeName})` : ''}.`,
          timestamp: isoNow,
          acknowledged: false,
          targetRole: UserRole.ITP_OPERATOR,
          assignedStaffId: job.assignedTo,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
        dispatched = true;
      }

      if (job.assignedOfficer) {
        await createAlert({
          severity: alertSeverity,
          alertType,
          flightNumber: job.flightNumber,
          message: `Into-Plane: ${label} for Flight ${job.flightNumber}${officerName ? ` (Officer: ${officerName})` : ''}.`,
          timestamp: isoNow,
          acknowledged: false,
          targetRole: UserRole.ITP_OFFICER,
          assignedStaffId: job.assignedOfficer,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
        dispatched = true;
      }

      if (!dispatched) {
        await createAlert({
          severity: alertSeverity,
          alertType,
          flightNumber: job.flightNumber,
          message: `Into-Plane: ${label} for Flight ${job.flightNumber} (Stand ${job.stand || 'TBA'}).`,
          timestamp: isoNow,
          acknowledged: false,
          targetRole: UserRole.ITP_OPERATOR,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
      }

      notify(
        isNoFuel
          ? `No-Fuel alert sent for flight ${job.flightNumber}.`
          : `Fuel Request sent for flight ${job.flightNumber}!`,
        'success'
      );
    } catch (err) {
      console.error('Failed to send fuel alert:', err);
      notify('Failed to dispatch alert.', 'error');
    }
  }, [alerts, createAlert, deleteAlerts, notify, staff, updateDispatchCache, user.id, user.name]);

  const handleCancelAlert = useCallback(async (job: FlightJob) => {
    const cleanFlight = (job.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    updateDispatchCache(cleanFlight, null);

    try {
      // 1. Delete all existing dispatch alerts for this flight
      const matchingAlerts = (alerts || []).filter(a => {
        const aType = a.alertType || '';
        const isDispatchType = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' ||
          (a.message && (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')));
        if (!isDispatchType) return false;

        const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
        if (aFlt && aFlt === cleanFlight) return true;
        const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
        return msgClean.includes(cleanFlight);
      });

      if (matchingAlerts.length > 0) {
        await deleteAlerts(matchingAlerts.map(a => a.id));
      }

      // 2. Dispatch ALERT_CANCELLED alert so assigned staff gets cancellation notice
      const cancelTime = serverTimeService.getServerTimeString();
      const alertMeta = {
        aircraftReg: job.aircraftReg,
        stand: job.stand,
        eta: job.eta || job.sta,
        flightNumber: job.flightNumber,
        cancelledAt: cancelTime,
        cancelledBy: user.name
      };

      let dispatchedCancel = false;
      const cancelIso = serverTimeService.getServerIso();
      if (job.assignedTo) {
        await createAlert({
          severity: 'warning',
          alertType: 'ALERT_CANCELLED',
          flightNumber: job.flightNumber,
          message: `ALERT CANCELLED: Dispatch alert for Flight ${job.flightNumber} has been cancelled by Manager ${user.name}.`,
          timestamp: cancelIso,
          acknowledged: false,
          targetRole: UserRole.ITP_OPERATOR,
          assignedStaffId: job.assignedTo,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
        dispatchedCancel = true;
      }
      if (job.assignedOfficer) {
        await createAlert({
          severity: 'warning',
          alertType: 'ALERT_CANCELLED',
          flightNumber: job.flightNumber,
          message: `ALERT CANCELLED: Dispatch alert for Flight ${job.flightNumber} has been cancelled by Manager ${user.name}.`,
          timestamp: cancelIso,
          acknowledged: false,
          targetRole: UserRole.ITP_OFFICER,
          assignedStaffId: job.assignedOfficer,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
        dispatchedCancel = true;
      }
      if (!dispatchedCancel) {
        await createAlert({
          severity: 'warning',
          alertType: 'ALERT_CANCELLED',
          flightNumber: job.flightNumber,
          message: `ALERT CANCELLED: Dispatch alert for Flight ${job.flightNumber} (Stand ${job.stand || 'TBA'}) cancelled by Manager.`,
          timestamp: cancelIso,
          acknowledged: false,
          targetRole: UserRole.ITP_OPERATOR,
          senderId: user.id,
          senderName: user.name,
          metadata: alertMeta
        });
      }

      notify(`Cancelled alert for flight ${job.flightNumber}. Crew notified.`, 'info');
    } catch (err) {
      console.error('Failed to cancel alert:', err);
      notify('Failed to cancel alert request.', 'error');
    }
  }, [alerts, createAlert, deleteAlerts, notify, updateDispatchCache, user.id, user.name]);
  
  const shiftRanges: Record<string, { start: string; end: string; crossesMidnight: boolean }> = {
    'Morning': { start: '07:30', end: '16:00', crossesMidnight: false },
    'Evening': { start: '15:00', end: '23:30', crossesMidnight: false },
    'Night': { start: '22:30', end: '08:30', crossesMidnight: true },
  };

  const isFlightInShift = (dep?: string) => {
    if (!dep) return true; // Show flights without DEP always
    const timeStr = dep.slice(0, 5);
    const range = shiftRanges[selectedBriefingShift];
    if (!range) return true;
    if (range.crossesMidnight) {
      return timeStr >= range.start || timeStr <= range.end;
    }
    return timeStr >= range.start && timeStr <= range.end;
  };

  const frozenFlights = briefingInfo?.staffAssignments?.frozenFlights;

  const isAdhocFlight = (f: any) => {
    if (!f) return false;
    if (f.isAdhoc) return true;
    if (typeof f.id === 'string' && f.id.startsWith('ah-')) return true;
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    return (briefingInfo?.staffAssignments?.adhocFlights || []).some(
      (af: any) => af && (af.id === f.id || (af.flightNumber && af.flightNumber.replace(/\s+/g, '').toLowerCase() === cleanNo))
    );
  };

  const liveIntlList = (flightJobs || []).filter(f => {
    const isDep = f.type ? f.type === 'departure' : !!f.std;
    return !isDomesticFlight(f) && !isAdhocFlight(f) && isDep && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate);
  });

  const getStatusForFlightDate = (cleanNo: string, flightDate: string, defaultStatus: string = 'PENDING') => {
    const cleanNoUpper = (cleanNo || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const cleanNoCompact = cleanNoUpper.replace(/([A-Z]+)0+([0-9]+)/, '$1$2');

    const matchesNo = (otherFn?: string) => {
      if (!cleanNoUpper || !otherFn) return false;
      const norm = otherFn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      return norm === cleanNoUpper || norm.replace(/([A-Z]+)0+([0-9]+)/, '$1$2') === cleanNoCompact;
    };

    // Retrieve locally blacklisted deleted log IDs so deleted logs never falsely mark flights as COMPLETED
    let deletedSet = new Set<string>();
    try {
      const rawDel = typeof window !== 'undefined' ? localStorage.getItem('fms_deleted_log_ids') : null;
      if (rawDel) {
        const delIds = JSON.parse(rawDel);
        if (Array.isArray(delIds)) deletedSet = new Set(delIds);
      }
    } catch {}

    const matchingLog = (flightLogs || []).find(log => {
      if (!log || !log.flightNumber) return false;
      if (deletedSet.has(log.id) || (log.deliveryNumber && deletedSet.has(log.deliveryNumber))) return false;
      if (!matchesNo(log.flightNumber)) return false;
      if (log.status !== 'COMPLETED' && log.status !== 'IN_PROGRESS') return false;
      const logDate = log.operationalDate ? log.operationalDate.split('T')[0] : (log.timestampFinalEnd ? log.timestampFinalEnd.split('T')[0] : (log.timestampStart ? log.timestampStart.split('T')[0] : ''));
      if (logDate && flightDate && logDate !== flightDate) return false;
      return true;
    });

    if (matchingLog && matchingLog.status === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (matchingLog && matchingLog.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    if (activeFlight && matchesNo(activeFlight.flightNumber) && activeFlight.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    const liveJob = (flightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      if (!matchesNo(j.flightNumber)) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !flightDate || jDate === flightDate;
    });

    if (liveJob && liveJob.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      if (!matchesNo(j.flightNumber)) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return jDate ? jDate === flightDate : true;
    });

    if (dbJob && dbJob.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    // A job cannot be COMPLETED if there is no completed log in flightLogs!
    if (!matchingLog || matchingLog.status !== 'COMPLETED') {
      return 'PENDING';
    }

    return liveJob?.status || dbJob?.status || defaultStatus;
  };

  const intlJobsMap = new Map<string, any>();
  liveIntlList.forEach(f => {
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    const flightDate = f.date ? f.date.split('T')[0] : selectedBriefingDate;
    const computedStatus = getStatusForFlightDate(cleanNo, flightDate, f.status || 'PENDING');
    
    const liveJob = (flightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jNo !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      if (jDate && flightDate && jDate !== flightDate) return false;
      return !jDate || !flightDate || jDate === flightDate;
    });

    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jNo !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      if (jDate && flightDate && jDate !== flightDate) return false;
      return !jDate || !flightDate || jDate === flightDate;
    });

    const existing = intlJobsMap.get(cleanNo);

    intlJobsMap.set(cleanNo, {
      ...(existing || {}),
      ...f,
      id: liveJob?.id || dbJob?.id || f.id || existing?.id,
      status: computedStatus,
      fidsStatus: f.status,
      std: liveJob?.std || dbJob?.std || existing?.std || f.std || ((f as any).type === 'departure' ? (f as any).scheduledTime : '') || (f as any).scheduledTime || '',
      tobt: liveJob?.tobt || dbJob?.tobt || existing?.tobt || f.tobt || '',
      frtAirline: liveJob?.frtAirline || dbJob?.frtAirline || existing?.frtAirline || f.frtAirline || '',
      frtAocc: liveJob?.frtAocc || dbJob?.frtAocc || existing?.frtAocc || f.frtAocc || '',
      frtFor: liveJob?.frtFor || dbJob?.frtFor || existing?.frtFor || f.frtFor || '',
      assignedTo: (liveJob && liveJob.assignedTo !== undefined && liveJob.assignedTo !== null)
        ? liveJob.assignedTo
        : (dbJob && dbJob.assignedTo !== undefined && dbJob.assignedTo !== null)
        ? dbJob.assignedTo
        : (f.assignedTo || existing?.assignedTo || ''),
      assignedOfficer: (liveJob && liveJob.assignedOfficer !== undefined && liveJob.assignedOfficer !== null)
        ? liveJob.assignedOfficer
        : (dbJob && dbJob.assignedOfficer !== undefined && dbJob.assignedOfficer !== null)
        ? dbJob.assignedOfficer
        : (f.assignedOfficer || existing?.assignedOfficer || ''),
      vehicleId: liveJob?.vehicleId !== undefined ? liveJob.vehicleId : (dbJob?.vehicleId !== undefined ? dbJob.vehicleId : (f.vehicleId || existing?.vehicleId)),
      equipmentUsage: liveJob?.equipmentUsage || dbJob?.equipmentUsage || f.equipmentUsage || existing?.equipmentUsage || 'HYDRANT',
    });
  });

  if (frozenFlights?.intl) {
    frozenFlights.intl.filter((ff: any) => !isDomesticFlight(ff) && !isAdhocFlight(ff)).forEach((ff: any) => {
      const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const existing = intlJobsMap.get(cleanNo);
      const flightDate = ff.date ? ff.date.split('T')[0] : selectedBriefingDate;
      const computedStatus = getStatusForFlightDate(cleanNo, flightDate, existing?.status || ff.status || 'PENDING');

      const liveJob = (flightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return !jDate || !flightDate || jDate === flightDate;
      });

      const dbJob = (rawFlightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return !jDate || !flightDate || jDate === flightDate;
      });

      intlJobsMap.set(cleanNo, {
        ...(existing || {}),
        ...ff,
        id: liveJob?.id || dbJob?.id || ff.id || existing?.id,
        status: computedStatus,
        fidsStatus: existing?.fidsStatus || ff.status,
        std: liveJob?.std || dbJob?.std || existing?.std || ff.std || (ff.type === 'departure' ? ff.scheduledTime : '') || ff.scheduledTime || '',
        tobt: liveJob?.tobt || dbJob?.tobt || existing?.tobt || ff.tobt || '',
        frtAirline: liveJob?.frtAirline || dbJob?.frtAirline || existing?.frtAirline || ff.frtAirline || '',
        frtAocc: liveJob?.frtAocc || dbJob?.frtAocc || existing?.frtAocc || ff.frtAocc || '',
        frtFor: liveJob?.frtFor || dbJob?.frtFor || existing?.frtFor || ff.frtFor || '',
        assignedTo: (liveJob && liveJob.assignedTo !== undefined && liveJob.assignedTo !== null)
          ? liveJob.assignedTo
          : (dbJob && dbJob.assignedTo !== undefined && dbJob.assignedTo !== null)
          ? dbJob.assignedTo
          : (ff.assignedTo || existing?.assignedTo || ''),
        assignedOfficer: (liveJob && liveJob.assignedOfficer !== undefined && liveJob.assignedOfficer !== null)
          ? liveJob.assignedOfficer
          : (dbJob && dbJob.assignedOfficer !== undefined && dbJob.assignedOfficer !== null)
          ? dbJob.assignedOfficer
          : (ff.assignedOfficer || existing?.assignedOfficer || ''),
        vehicleId: liveJob?.vehicleId !== undefined ? liveJob.vehicleId : (dbJob?.vehicleId !== undefined ? dbJob.vehicleId : (ff.vehicleId || existing?.vehicleId)),
        equipmentUsage: liveJob?.equipmentUsage || dbJob?.equipmentUsage || ff.equipmentUsage || existing?.equipmentUsage || 'HYDRANT',
      });
    });
  }

  const intlJobs = Array.from(intlJobsMap.values())
    .filter((f: any) => f.fidsStatus?.toUpperCase() !== 'CANCELLED')
    .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
  
  const liveDomList = (domesticFlights || []).filter(f => f.type === 'departure' && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate));
  const domJobsMap = new Map<string, any>();
  liveDomList.forEach(f => {
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    const flightDate = f.date ? f.date.split('T')[0] : selectedBriefingDate;
    const computedStatus = getStatusForFlightDate(cleanNo, flightDate, f.status || 'PENDING');

    const liveJob = (flightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jNo !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !flightDate || jDate === flightDate;
    });

    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      if (jNo !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !flightDate || jDate === flightDate;
    });

    domJobsMap.set(cleanNo, {
      ...f,
      status: computedStatus,
      fidsStatus: f.status,
      std: liveJob?.std || dbJob?.std || f.std || (f.type === 'departure' ? f.scheduledTime : '') || f.scheduledTime || '',
    });
  });

  if (frozenFlights?.domestic) {
    frozenFlights.domestic.forEach((ff: any) => {
      const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const existing = domJobsMap.get(cleanNo);
      const flightDate = ff.date ? ff.date.split('T')[0] : selectedBriefingDate;
      const computedStatus = getStatusForFlightDate(cleanNo, flightDate, existing?.status || ff.status || 'PENDING');

      const liveJob = (flightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        return !jDate || !flightDate || jDate === flightDate;
      });

      const dbJob = (rawFlightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        return !jDate || !flightDate || jDate === flightDate;
      });

      domJobsMap.set(cleanNo, {
        ...(existing || {}),
        ...ff,
        status: computedStatus,
        fidsStatus: existing?.fidsStatus || ff.status,
        std: liveJob?.std || dbJob?.std || existing?.std || ff.std || (ff.type === 'departure' ? ff.scheduledTime : '') || ff.scheduledTime || '',
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
          std: df.std || (df.type === 'departure' ? df.scheduledTime : '') || df.scheduledTime || '',
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

  const adhocJobsRaw = (briefingInfo?.staffAssignments?.adhocFlights || [])
    .filter((f: any) => f && f.id !== 'ah1' && f.id !== 'ah2');

  const adhocJobs = adhocJobsRaw.map((f: any) => {
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    const flightDate = f.date ? f.date.split('T')[0] : selectedBriefingDate;
    const matchJob = (flightJobs || []).find(j => {
      if ((j.flightNumber || '').replace(/\s+/g, '').toLowerCase() !== cleanNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      if (jDate && flightDate && jDate !== flightDate) return false;
      return !jDate || !flightDate || jDate === flightDate;
    });
    const merged = matchJob ? { ...f, ...matchJob } : f;
    const computedStatus = getStatusForFlightDate(cleanNo, flightDate, merged.status || 'PENDING');
    return {
      ...merged,
      id: merged.id,
      flightNumber: merged.flightNumber,
      aircraftReg: merged.aircraftReg,
      aircraftType: merged.aircraftType,
      stand: merged.stand,
      sta: merged.sta,
      eta: merged.eta,
      std: merged.std,
      assignedTo: merged.assignedTo || '',
      assignedOfficer: merged.assignedOfficer || '',
      status: computedStatus as any,
      fidsStatus: computedStatus,
      route: merged.route,
      isAdhoc: true,
      vehicleId: merged.vehicleId,
      co: merged.co || f.co,
      operatorName: merged.operatorName || f.operatorName,
    };
  }).sort((a: any, b: any) => (a.std || a.sta || '').localeCompare(b.std || b.sta || ''));

  const isDomesticTeamMember = useMemo(() => {
    if (!user) return false;

    // Check cached myTeam for instant detection
    try {
      const savedMyTeam = localStorage.getItem('fms_my_domestic_team');
      if (savedMyTeam) {
        const parsed = JSON.parse(savedMyTeam);
        const teamName = (parsed?.team_name || '').toLowerCase();
        if (teamName.includes('team 1') || teamName.includes('team 2') || teamName.includes('team 3')) {
          const op1 = (parsed?.operator1_id || parsed?.op1 || '').toLowerCase();
          const op2 = (parsed?.operator2_id || parsed?.op2 || '').toLowerCase();
          const uid = (user.id || '').toLowerCase();
          const uname = (user.name || '').toLowerCase();
          if ((uid && (op1 === uid || op2 === uid)) || (uname && (op1 === uname || op2 === uname))) {
            return true;
          }
        }
      }
    } catch (e) {}

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

    const allAssignments = [
      ...(domesticAssignments || []),
      ...(localDomesticAssignments || [])
    ];

    return allAssignments.some(da => {
      const teamName = (da.team_name || '').toLowerCase();
      const isTargetTeam = teamName.includes('team 1') || teamName.includes('team 2') || teamName.includes('team 3');
      if (!isTargetTeam) return false;

      const op1 = (da.operator1_id || da.op1 || '').toLowerCase();
      const op2 = (da.operator2_id || da.op2 || '').toLowerCase();
      if (!op1 && !op2) return false;

      if (userTokens.has(op1) || userTokens.has(op2)) return true;
      const targetOp1 = staffList.find(s => s.id.toLowerCase() === op1 || s.name.toLowerCase() === op1);
      if (targetOp1 && (userTokens.has(targetOp1.id.toLowerCase()) || userTokens.has(targetOp1.name.toLowerCase()))) return true;
      const targetOp2 = staffList.find(s => s.id.toLowerCase() === op2 || s.name.toLowerCase() === op2);
      if (targetOp2 && (userTokens.has(targetOp2.id.toLowerCase()) || userTokens.has(targetOp2.name.toLowerCase()))) return true;
      return false;
    });
  }, [user, domesticAssignments, localDomesticAssignments, staff]);

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
  const filteredDomesticJobs = filterMyTasks ? (isDomesticTeamMember ? domesticJobs : domesticJobs.filter(isJobAssignedToUser)) : domesticJobs;
  const filteredAdhocJobs = filterMyTasks ? (isDomesticTeamMember ? adhocJobs : adhocJobs.filter(isJobAssignedToUser)) : adhocJobs;

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
      const isManagerOrAdmin = user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN;
      const isDomesticOrAdhoc = !!(job.isDomestic || (job as any).isAdhoc || isDomesticFlight(job) || viewMode === 'DOM' || viewMode === 'ADHOC');
      const isAdhocFlightJob = !!((job as any).isAdhoc || (typeof job.id === 'string' && job.id.startsWith('ah-')) || viewMode === 'ADHOC' || (briefingInfo?.staffAssignments?.adhocFlights || []).some((af: any) => af && (af.id === job.id || (af.flightNumber && af.flightNumber.replace(/\s+/g, '').toLowerCase() === (job.flightNumber || '').replace(/\s+/g, '').toLowerCase()))));
      const adhocCo = (job as any).co || (briefingInfo?.staffAssignments?.adhocFlights || []).find((af: any) => af && (af.id === job.id || (af.flightNumber && af.flightNumber.replace(/\s+/g, '').toLowerCase() === (job.flightNumber || '').replace(/\s+/g, '').toLowerCase())))?.co;
      const canLogFlight = isAssignedToMe || isManagerOrAdmin || (isDomesticTeamMember && isDomesticOrAdhoc);
      const canEditAircraft = isAssignedToMe || isManagerOrAdmin || (isDomesticTeamMember && isDomesticOrAdhoc);
      const canEditStand = isManagerOrAdmin;
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
      const cleanFlight = (job.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      
      // Find related dispatch alerts (unacknowledged or acknowledged), sorted newest first
      const relatedAlerts = (alerts || []).filter(a => {
          const aType = a.alertType || '';
          const isDispatchType = aType === 'REQUEST_FUELING' || aType === 'NO_FUEL' ||
              (a.message && (a.message.toLowerCase().includes('requested') || a.message.toLowerCase().includes('no fuel')));
          if (!isDispatchType) return false;

          const aFlt = (a.flightNumber || a.metadata?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
          if (aFlt && aFlt === cleanFlight) return true;
          const msgClean = (a.message || '').replace(/\s+/g, '').toUpperCase();
          return msgClean.includes(cleanFlight);
      }).sort((a, b) => new Date(b.timestamp || b.acknowledgedAt || 0).getTime() - new Date(a.timestamp || a.acknowledgedAt || 0).getTime());

      const latestAlert = relatedAlerts[0];
      const unackAlert = relatedAlerts.find(a => !a.acknowledged);
      const cached = cleanFlight ? dispatchCache[cleanFlight] : undefined;

      let dispatchStatus: 'REQUEST_FUELING' | 'NO_FUEL' | null = null;
      let isDispatchAcknowledged = false;
      let dispatchRequestedTime = '';
      let dispatchAcknowledgedTime = '';
      let dispatchAcknowledgedBy = '';

      if (unackAlert) {
          dispatchStatus = (unackAlert.alertType === 'NO_FUEL' || (unackAlert.message && unackAlert.message.toLowerCase().includes('no fuel')))
              ? 'NO_FUEL'
              : 'REQUEST_FUELING';
          isDispatchAcknowledged = false;
          dispatchRequestedTime = formatTimeSafe(unackAlert.metadata?.requestedTime || unackAlert.metadata?.requestedAt || unackAlert.timestamp) || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      } else if (latestAlert && latestAlert.acknowledged) {
          dispatchStatus = (latestAlert.alertType === 'NO_FUEL' || (latestAlert.message && latestAlert.message.toLowerCase().includes('no fuel')))
              ? 'NO_FUEL'
              : 'REQUEST_FUELING';
          isDispatchAcknowledged = true;
          dispatchRequestedTime = formatTimeSafe(latestAlert.metadata?.requestedTime || latestAlert.metadata?.requestedAt || latestAlert.timestamp) || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const ackDate = latestAlert.acknowledgedAt || latestAlert.acknowledged_at || latestAlert.metadata?.acknowledgedAt || latestAlert.metadata?.acknowledgedTime || cached?.acknowledgedTime || cached?.acknowledgedAt;
          if (ackDate) {
              dispatchAcknowledgedTime = formatTimeSafe(ackDate);
          }
          if (!dispatchAcknowledgedTime) {
              dispatchAcknowledgedTime = formatTimeSafe(latestAlert.timestamp) || dispatchRequestedTime || '--:--';
          }
          dispatchAcknowledgedBy = latestAlert.acknowledgedBy || latestAlert.metadata?.acknowledgedBy || cached?.acknowledgedBy || 'Crew';
      } else if (cached) {
          dispatchStatus = cached.status;
          isDispatchAcknowledged = !!cached.acknowledged;
          dispatchRequestedTime = formatTimeSafe(cached.requestedTime || cached.requestedAt);
          dispatchAcknowledgedTime = formatTimeSafe(cached.acknowledgedTime || cached.acknowledgedAt);
          if (isDispatchAcknowledged && !dispatchAcknowledgedTime) {
              dispatchAcknowledgedTime = dispatchRequestedTime || '--:--';
          }
          dispatchAcknowledgedBy = cached.acknowledgedBy || '';
      }

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
      const isWatched = watchedIds.has(job.flightNumber);
      const isIntl = viewMode === 'INT' && !isDomesticFlight(job) && !(job as any).isAdhoc;
      const inboundFlightNumber = isIntl ? flightRadarService.resolveInboundFlightNumber(job, externalFlights, internationalSchedules) : job.flightNumber;

      return (
          <div key={job.id} className={`bg-surface-container-lowest p-4 sm:p-5 rounded-2xl relative transition-all shrink-0 border ${isAssignedToMe ? 'border-primary border-l-[6px] shadow-sm' : isDomesticOrAdhoc ? 'border-outline-variant hover:border-outline shadow-sm' : 'border-outline opacity-80'} ${activeMenuJobId === job.id || activeDetailsJobId === job.id ? 'z-40' : 'z-10'}`}>
              <div className="relative z-10">
                  {/* Job Card Header */}
                  <div className={isDomesticOrAdhoc ? "w-full relative" : "mb-2.5 sm:mb-3 w-full relative"}>
                      {/* Top Row: Flight number & stand on left, Action buttons on right (mobile & desktop aligned) */}
                      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                              {/* Stand badge & Flight Number (always grouped together on the same row) */}
                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                  {/* Yellow gradient stand badge next to flight number */}
                                  <div 
                                      onClick={canEditStand ? (e) => { e.stopPropagation(); setEditingStandJob(job); } : undefined}
                                      className={`flex items-center gap-1 bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider shrink-0 ${
                                          canEditStand ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                                      }`}
                                      title={canEditStand ? "Click to change stand" : undefined}
                                  >
                                      <span>{job.stand || 'TBA'}</span>
                                      {canEditStand && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                                  </div>

                                  {/* Flight Number */}
                                  <h3 className="text-2xl sm:text-3xl font-[900] text-on-surface tracking-tighter leading-none shrink-0 whitespace-nowrap">{job.flightNumber}</h3>
                              </div>

                              {/* Domestic airline logo & name next to flight number */}
                              {(job.isDomestic || isDomesticFlight(job) || viewMode === 'DOM') ? (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                      {logoUrl && (
                                          <div className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center">
                                              <img
                                                  src={logoUrl}
                                                  alt=""
                                                  aria-hidden="true"
                                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                  className="w-full h-full object-contain select-none"
                                              />
                                          </div>
                                      )}
                                      {airlineName && (
                                          <span className="text-[11px] sm:text-xs font-black text-on-surface-dim opacity-70 uppercase tracking-wider whitespace-nowrap">
                                              {airlineName}
                                          </span>
                                      )}
                                  </div>
                              ) : (
                                  /* Tail Logo right next to flight number (desktop only for international; mobile displays logo on row 2) */
                                  logoUrl && (
                                      <div className="hidden md:flex w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 items-center justify-center">
                                          <img
                                              src={logoUrl}
                                              alt=""
                                              aria-hidden="true"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              className="w-full h-full object-contain select-none flex-shrink-0"
                                          />
                                      </div>
                                  )
                              )}

                              {/* Dispatch Status Badge (Rendered AFTER airline logo, NO glow, NO bounce) */}
                              {dispatchStatus === 'REQUEST_FUELING' && (
                                  <div 
                                      className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wider uppercase shrink-0 select-none border shadow-sm ${
                                          isDispatchAcknowledged
                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                              : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                                      }`}
                                      title={
                                          isDispatchAcknowledged 
                                              ? `Fuel Requested at ${dispatchRequestedTime || '--:--'} • Acknowledged at ${dispatchAcknowledgedTime || '--:--'}${dispatchAcknowledgedBy ? ` by ${dispatchAcknowledgedBy}` : ''}`
                                              : `Fuel Requested at ${dispatchRequestedTime || '--:--'} • Pending Crew Acknowledgment`
                                      }
                                  >
                                      {isDispatchAcknowledged ? (
                                          <>
                                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                                              <span>FUEL REQ</span>
                                              {dispatchAcknowledgedTime ? (
                                                  <span className="opacity-90 font-mono text-[9px]">✓ {dispatchAcknowledgedTime}</span>
                                              ) : (
                                                  <span className="opacity-90 font-mono text-[9px]">✓ ACK</span>
                                              )}
                                          </>
                                      ) : (
                                          <>
                                              <Fuel className="w-3 h-3 text-rose-400" />
                                              <span>FUEL REQ</span>
                                              {dispatchRequestedTime && <span className="opacity-80 font-mono text-[9px]">{dispatchRequestedTime}</span>}
                                          </>
                                      )}
                                  </div>
                              )}
                              {dispatchStatus === 'NO_FUEL' && (
                                  <div 
                                      className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wider uppercase shrink-0 select-none border shadow-sm ${
                                          isDispatchAcknowledged
                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                              : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                                      }`}
                                      title={
                                          isDispatchAcknowledged 
                                              ? `No Fuel confirmed at ${dispatchRequestedTime || '--:--'} • Acknowledged at ${dispatchAcknowledgedTime || '--:--'}${dispatchAcknowledgedBy ? ` by ${dispatchAcknowledgedBy}` : ''}`
                                              : `No Fuel confirmed at ${dispatchRequestedTime || '--:--'} • Pending Crew Acknowledgment`
                                      }
                                  >
                                      {isDispatchAcknowledged ? (
                                          <>
                                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                                              <span>NO FUEL</span>
                                              {dispatchAcknowledgedTime ? (
                                                  <span className="opacity-90 font-mono text-[9px]">✓ {dispatchAcknowledgedTime}</span>
                                              ) : (
                                                  <span className="opacity-90 font-mono text-[9px]">✓ ACK</span>
                                              )}
                                          </>
                                      ) : (
                                          <>
                                              <Ban className="w-3 h-3 text-amber-400" />
                                              <span>NO FUEL</span>
                                              {dispatchRequestedTime && <span className="opacity-80 font-mono text-[9px]">{dispatchRequestedTime}</span>}
                                          </>
                                      )}
                                  </div>
                              )}

                              {/* Desktop-only details: reg, type, and route */}
                              <div className="hidden md:flex items-center gap-2.5 text-[11px] sm:text-[12px] font-bold text-on-surface-dim">
                                  <span className="opacity-20">|</span>
                                  <span className="font-black text-on-surface tracking-tight">{job.aircraftReg}</span>
                                  <span className="opacity-20">|</span>
                                  <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-on-surface-dim border-transparent uppercase tracking-wider">{job.aircraftType}</span>
                                  {canEditAircraft && (
                                      <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingAircraftJob(job); }}
                                          className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-60 hover:opacity-100 cursor-pointer"
                                          title="Edit Aircraft Type & Registration"
                                      >
                                          <Pencil className="w-3 h-3" />
                                      </button>
                                  )}
                                  {job.route && (
                                      <>
                                          <span className="opacity-20">|</span>
                                          {renderRoute(job.route, "text-primary text-[10px]", job.isDomestic || (job as any).isAdhoc)}
                                      </>
                                  )}
                              </div>
                          </div>

                          {/* Desktop Center-Aligned Timings (lg+ only) */}
                          {isDomesticOrAdhoc ? (
                              <div className="hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-3.5 py-1.5 rounded-xl border border-outline absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-sm pointer-events-none">
                                  <span className="text-warning opacity-60 text-[10px]">STD</span>
                                  <span className="text-warning text-[14px] font-black tracking-tight">{job.std || '--:--'}</span>
                              </div>
                          ) : (
                              <div className="hidden lg:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-4 py-2 rounded-xl border border-outline absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-sm pointer-events-none">
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
                          )}

                          {/* Action buttons (compact on mobile to sit next to flight number) */}
                          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 z-20 relative">
                               {/* Track and Alert buttons: ONLY shown for International flights, hidden for Domestic & Ad-Hoc */}
                               {isIntl && (
                                   <>
                                       {/* Track on FlightRadar24 live map using resolved INBOUND flight number */}
                                       <button 
                                           type="button"
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               window.open(flightRadarService.getFlightWebUrl(inboundFlightNumber), '_blank', 'noopener,noreferrer');
                                           }}
                                           className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 active:scale-95 border border-sky-500/25 shadow-sm cursor-pointer"
                                           title={`Track inbound flight ${inboundFlightNumber} live on FlightRadar24 map`}
                                       >
                                           <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                                       </button>

                                       {/* Personal ETA Arrival Alert Watch Toggle */}
                                       <button 
                                           type="button"
                                           onClick={(e) => {
                                               e.stopPropagation();
                                               if (isAssignedToMe) {
                                                   notify(`Flight ${job.flightNumber} is assigned to you. High ETA alerts are active automatically.`, 'info');
                                                   return;
                                               }
                                               toggleWatch(job.flightNumber);
                                               if (isWatched) {
                                                   notify(`ETA alert watch disabled for ${job.flightNumber}.`, 'info');
                                               } else {
                                                   notify(`ETA alert notifications enabled for ${job.flightNumber}!`, 'success');
                                               }
                                           }}
                                            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all border shadow-sm cursor-pointer active:scale-95 ${
                                                isAssignedToMe
                                                    ? 'bg-violet-500/10 text-violet-400 border-violet-500/25 hover:bg-violet-500/20'
                                                    : isWatched
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-sm hover:bg-emerald-500/20'
                                                    : 'bg-surface-container-high/40 text-on-surface-dim hover:text-on-surface hover:bg-surface-container border-outline'
                                            }`}
                                            title={
                                                isAssignedToMe
                                                    ? 'Assigned to you - ETA alerts are active automatically'
                                                    : isWatched
                                                    ? `ETA Alert Watch active for ${job.flightNumber}. Click to turn off.`
                                                    : `Turn on ETA alerts for ${job.flightNumber}`
                                            }
                                        >
                                            {isAssignedToMe ? (
                                                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                                            ) : isWatched ? (
                                                <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                                            ) : (
                                                <BellOff className="w-4 h-4 sm:w-5 sm:h-5 opacity-40 hover:opacity-70 transition-opacity" />
                                            )}
                                        </button>

                                        {/* ITP MANAGER Fuel Alert Dispatch Menu Button (Distinct States) */}
                                        {(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && (
                                            dispatchStatus ? (
                                                /* ACTIVE / ACKNOWLEDGED DISPATCH BUTTON (Opens anchored popover) */
                                                <div className="relative">
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuJobId(null);
                                                            setActiveDetailsJobId(activeDetailsJobId === job.id ? null : job.id);
                                                        }}
                                                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer relative shrink-0 ${
                                                            isDispatchAcknowledged
                                                                ? 'bg-emerald-600 text-white border border-emerald-400/60 hover:bg-emerald-500'
                                                                : dispatchStatus === 'REQUEST_FUELING'
                                                                    ? 'bg-rose-600 text-white font-black border border-rose-400 hover:bg-rose-500'
                                                                    : 'bg-amber-500 text-slate-950 font-black border border-amber-400 hover:bg-amber-400'
                                                        }`}
                                                        title={
                                                            isDispatchAcknowledged
                                                                ? `${dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No-Fuel'} ACKNOWLEDGED by ${dispatchAcknowledgedBy || 'crew'} at ${dispatchAcknowledgedTime || '--:--'} (Req ${dispatchRequestedTime || '--:--'}). Click for options.`
                                                                : `${dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No-Fuel'} PENDING since ${dispatchRequestedTime || '--:--'}. Click for options.`
                                                        }
                                                    >
                                                        {isDispatchAcknowledged ? (
                                                            <CheckCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                                        ) : dispatchStatus === 'REQUEST_FUELING' ? (
                                                            <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                                        ) : (
                                                            <Ban className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
                                                        )}

                                                        {/* Static badge pip indicator (NO ping, NO neon glow) */}
                                                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-slate-900 ${
                                                                isDispatchAcknowledged ? 'bg-emerald-300' : dispatchStatus === 'REQUEST_FUELING' ? 'bg-rose-300' : 'bg-amber-300'
                                                            }`}></span>
                                                        </span>
                                                    </button>

                                                    {activeDetailsJobId === job.id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setActiveDetailsJobId(null); 
                                                                }} 
                                                            />
                                                            <div 
                                                                className="absolute right-0 top-12 z-50 w-64 max-w-[calc(100vw-3rem)] bg-surface border border-outline rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 text-on-surface"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {/* Header */}
                                                                <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <span className="text-xs font-black tracking-tight truncate">{job.flightNumber}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                                                            isDispatchAcknowledged
                                                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                                                : dispatchStatus === 'REQUEST_FUELING'
                                                                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                        }`}>
                                                                            {isDispatchAcknowledged ? 'Acknowledged' : 'Pending Ack'}
                                                                        </span>
                                                                    </div>
                                                                    <button 
                                                                        type="button" 
                                                                        onClick={(e) => { e.stopPropagation(); setActiveDetailsJobId(null); }}
                                                                        className="p-1 rounded-lg hover:bg-surface-container text-on-surface-dim hover:text-on-surface cursor-pointer shrink-0"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>

                                                                {/* Timings */}
                                                                <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] border border-outline-variant">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-on-surface-dim font-medium">Type:</span>
                                                                        <span className="font-bold text-on-surface">
                                                                            {dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No Fuel Required'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-on-surface-dim font-medium">Stand:</span>
                                                                        <span className="font-bold text-on-surface">{job.stand || 'TBA'}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-on-surface-dim font-medium">Requested:</span>
                                                                        <span className="font-mono font-bold text-on-surface">
                                                                            {dispatchRequestedTime || '--:--'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-on-surface-dim font-medium">Acknowledged:</span>
                                                                        <span className={`font-mono font-bold ${isDispatchAcknowledged ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                            {isDispatchAcknowledged ? (dispatchAcknowledgedTime || '--:--') : 'Awaiting Crew'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Actions */}
                                                                <div className="flex flex-col gap-1.5 pt-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            setActiveDetailsJobId(null);
                                                                            await handleCancelAlert(job);
                                                                        }}
                                                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                                                                    >
                                                                        <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                                        <span>Cancel Alert</span>
                                                                    </button>

                                                                    {dispatchStatus === 'REQUEST_FUELING' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            setActiveDetailsJobId(null);
                                                                            await handleSendFuelAlert(job, 'NO_FUEL');
                                                                        }}
                                                                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                                                                    >
                                                                        <Ban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                                        <span>Switch to No Fuel</span>
                                                                    </button>
                                                                    )}

                                                                    {dispatchStatus === 'NO_FUEL' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                setActiveDetailsJobId(null);
                                                                                await handleSendFuelAlert(job, 'REQUEST_FUELING');
                                                                            }}
                                                                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/25 hover:bg-rose-600/25 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                                                                        >
                                                                            <Fuel className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                                            <span>Switch to Fuel Request</span>
                                                                        </button>
                                                                    )}

                                                                    {!isDispatchAcknowledged && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                setActiveDetailsJobId(null);
                                                                                await handleSendFuelAlert(job, dispatchStatus!);
                                                                            }}
                                                                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-outline-variant active:scale-95"
                                                                        >
                                                                            {dispatchStatus === 'REQUEST_FUELING' ? (
                                                                                <Fuel className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                                            ) : (
                                                                                <Ban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                                            )}
                                                                            <span>Re-send Alert</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                /* STATE 1: IDLE (Clean Megaphone icon only - NO REQ text) */
                                                <div className="relative">
                                                   <button 
                                                       type="button"
                                                       onClick={(e) => {
                                                           e.stopPropagation();
                                                           setActiveDetailsJobId(null);
                                                           setActiveMenuJobId(activeMenuJobId === job.id ? null : job.id);
                                                       }}
                                                       className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 active:scale-95 shadow-sm cursor-pointer relative shrink-0"
                                                       title="Manager: Dispatch Fuel Request / No-Fuel to Crew"
                                                   >
                                                       <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
                                                   </button>

                                                   {activeMenuJobId === job.id && (
                                                       <>
                                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuJobId(null); }} />
                                                            <div className="absolute right-0 top-12 z-50 w-56 bg-surface border border-outline rounded-xl shadow-premium p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                <button 
                                                                    type="button"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        setActiveMenuJobId(null);
                                                                        await handleSendFuelAlert(job, 'REQUEST_FUELING');
                                                                    }}
                                                                    className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 text-on-surface-dim transition-all flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <Fuel className="w-4 h-4 text-rose-400" />
                                                                    <span>Request Fueling</span>
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        setActiveMenuJobId(null);
                                                                        await handleSendFuelAlert(job, 'NO_FUEL');
                                                                    }}
                                                                    className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-400 text-on-surface-dim transition-all flex items-center gap-2 cursor-pointer border-t border-outline-variant pt-2"
                                                                >
                                                                    <Ban className="w-4 h-4 text-amber-400" />
                                                                    <span>No Fuel Required</span>
                                                                </button>
                                                                {displayStatus === 'IN_PROGRESS' && (canLogFlight || user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && onCancelActiveFlight && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMenuJobId(null);
                                                                            onCancelActiveFlight(job);
                                                                        }}
                                                                        className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-error/10 text-error hover:text-error transition-all flex items-center gap-2 cursor-pointer border-t border-outline-variant pt-2"
                                                                    >
                                                                        <Ban className="w-4 h-4 text-error" />
                                                                        <span>Cancel Fueling / Revert</span>
                                                                    </button>
                                                                )}
                                                           </div>
                                                        </>
                                                   )}
                                               </div>
                                           )
                                       )}
                                       
                                   </>
                               )}

                                 {/* Status badge near play button: HIDDEN on mobile for all flights; on desktop shown ONLY for DOM and AD-HOC */}
                                 {isDomesticOrAdhoc && (
                                     <div className="hidden md:flex items-center gap-1.5 shrink-0">
                                         {displayStatus === 'IN_PROGRESS' && (
                                             <span className="text-[8px] font-black text-warning uppercase tracking-widest animate-pulse">ACTIVE FUELING</span>
                                         )}
                                         {renderStatusBadge(displayStatus)}
                                     </div>
                                 )}

                                 {/* Revert fueling button if flight is currently IN_PROGRESS */}
                                 {displayStatus === 'IN_PROGRESS' && (canLogFlight || user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && onCancelActiveFlight && (
                                     <button 
                                         type="button"
                                         onClick={(e) => {
                                             e.stopPropagation();
                                             onCancelActiveFlight(job);
                                         }}
                                         className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer bg-error/10 hover:bg-error text-error hover:text-white border border-error/20 hover:border-error active:scale-95"
                                         title="Revert Fueling to Pending"
                                     >
                                         <Ban className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                                     </button>
                                 )}

                                {/* play action button if assigned to me, manager/admin, or completed */}
                                {(canLogFlight || job.status === 'COMPLETED') && (
                                    <button 
                                        onClick={() => {
                                            if (job.status === 'COMPLETED') {
                                                notify(`Log for ${job.flightNumber} is already finalized.`, "info");
                                            } else if (canLogFlight) {
                                                onStartJob(job);
                                            }
                                        }}
                                         className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer
                                              ${job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/20' : 'kinetic-gradient text-white hover:scale-[1.05] active:scale-95 shadow-premium'}
                                         `}
                                         title={job.status === 'COMPLETED' ? 'View Log' : displayStatus === 'IN_PROGRESS' ? 'Resume Fueling' : 'Start Job'}
                                     >
                                         {job.status === 'COMPLETED' ? <ChevronRight className="w-5 h-5 sm:w-7 sm:h-7 stroke-[3]" /> : <Play className="w-[18px] h-[18px] sm:w-[24px] sm:h-[24px] flex-shrink-0 ml-0.5" fill="white" color="white" strokeWidth={2.5} />}
                                     </button>
                                  )}
                            </div>
                          </div>

                      {/* Row 2 on Mobile: */}
                      {isDomesticOrAdhoc ? (
                          /* For Domestic / Ad-hoc: Reg + Type + Destination + STD (ALL ON ONE ROW) */
                          <div className="flex items-center gap-2 mt-2 text-on-surface-dim text-[11px] font-bold md:hidden overflow-x-auto no-scrollbar whitespace-nowrap">
                              {job.aircraftReg && job.aircraftReg !== '8Q-TBA' && !job.aircraftReg.startsWith('8Q-DOM') && (
                                  <>
                                      <span className="font-black text-on-surface tracking-tight whitespace-nowrap">{job.aircraftReg}</span>
                                      <span className="opacity-20 shrink-0">|</span>
                                  </>
                              )}
                              <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] font-black text-on-surface-dim border-transparent uppercase tracking-wider whitespace-nowrap">{cleanAircraftTypeName(job.aircraftType)}</span>
                              {canEditAircraft && (
                                  <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setEditingAircraftJob(job); }}
                                      className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-60 hover:opacity-100 cursor-pointer"
                                      title="Edit Aircraft Type & Registration"
                                  >
                                      <Pencil className="w-3 h-3" />
                                  </button>
                              )}
                              {job.route && (
                                  <>
                                      <span className="opacity-20 shrink-0">|</span>
                                      {renderRoute(job.route, "text-primary text-[9px] tracking-wide whitespace-nowrap", true)}
                                  </>
                              )}
                              {isAdhocFlightJob && (
                                  <>
                                      <span className="opacity-20 shrink-0">|</span>
                                      <span className="text-warning font-black text-[10px] tracking-wider whitespace-nowrap">STD {job.std || '--:--'}</span>
                                  </>
                              )}
                          </div>
                      ) : (
                          /* For International: Tail Logo + Airline Name + Reg + Type + Route */
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-on-surface-dim text-[11px] font-bold md:hidden">
                              {logoUrl && (
                                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                      <img
                                          src={logoUrl}
                                          alt=""
                                          aria-hidden="true"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          className="w-full h-full object-contain select-none"
                                      />
                                  </div>
                              )}
                              {airlineName && (
                                  <span className="text-[11px] font-black text-on-surface-dim opacity-70 uppercase tracking-wider">
                                      {airlineName}
                                  </span>
                              )}
                              {job.aircraftReg && job.aircraftReg !== '8Q-TBA' && !job.aircraftReg.startsWith('8Q-DOM') && (
                                  <>
                                      <span className="opacity-20 shrink-0">|</span>
                                      <span className="font-black text-on-surface tracking-tight whitespace-nowrap">{job.aircraftReg}</span>
                                  </>
                              )}
                              <span className="opacity-20 shrink-0">|</span>
                              <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] font-black text-on-surface-dim border-transparent uppercase tracking-wider whitespace-nowrap">{cleanAircraftTypeName(job.aircraftType)}</span>
                              {canEditAircraft && (
                                  <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setEditingAircraftJob(job); }}
                                      className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-60 hover:opacity-100 cursor-pointer"
                                      title="Edit Aircraft Type & Registration"
                                  >
                                      <Pencil className="w-3 h-3" />
                                  </button>
                              )}
                              {job.route && (
                                  <>
                                      <span className="opacity-20 shrink-0">|</span>
                                      {renderRoute(job.route, "text-primary text-[9px] tracking-wide whitespace-nowrap", false)}
                                  </>
                              )}
                          </div>
                      )}

                      {/* Row 3 on Mobile for Domestic / Ad-hoc: Bottom Left (C/O or STD / activeEq) + Bottom Right (Status Badge) */}
                      {isDomesticOrAdhoc && (
                          <div className="flex items-center justify-between gap-2 mt-2 pt-0.5 md:hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                  {isAdhocFlightJob ? (
                                      adhocCo ? (
                                          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider truncate">
                                              <span className="text-primary/70">C/O:</span>
                                              <span className="text-on-surface truncate">{adhocCo}</span>
                                          </div>
                                      ) : null
                                  ) : (
                                      <>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                              <span className="text-[9px] font-black text-warning/70 uppercase tracking-widest">STD</span>
                                              <span className="text-[13px] sm:text-sm font-[900] text-warning tracking-tight">{job.std || '--:--'}</span>
                                          </div>
                                          {activeEqId && (
                                              <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border shadow-sm shrink-0 ${equipmentBadgeClass(activeEqId)}`}>
                                                  <Truck className="w-3 h-3" />
                                                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">{activeEqId}</span>
                                              </div>
                                          )}
                                      </>
                                  )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                  {displayStatus === 'IN_PROGRESS' && (
                                      <span className="text-[8px] font-black text-warning uppercase tracking-widest animate-pulse">ACTIVE FUELING</span>
                                  )}
                                  {renderStatusBadge(displayStatus)}
                              </div>
                          </div>
                      )}

                      {/* Desktop-only Airline Name (below flight number) for International */}
                      {airlineName && !(job.isDomestic || isDomesticFlight(job) || viewMode === 'DOM') && (
                          <div className="hidden md:block text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">
                              {airlineName}
                          </div>
                      )}

                      {/* Desktop-only C/O for Ad-hoc (below flight number) */}
                      {isAdhocFlightJob && adhocCo && (
                          <div className="hidden md:block text-[10px] font-black uppercase tracking-widest mt-1">
                              <span className="text-primary/70">C/O:</span> <span className="text-on-surface-dim font-black">{adhocCo}</span>
                          </div>
                      )}
                  </div>

                  {/* Compact Bottom Details (International flights only) */}
                  {!isDomesticOrAdhoc && (
                    <div className="mt-2.5 pt-2.5 border-t border-outline/40 space-y-2.5">
                      {/* Timings displayed on mobile + tablet view */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 bg-surface-dim rounded-xl border border-outline lg:hidden">
                          <div className="text-center border-r border-outline/30">
                              <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-0.5">STA</p>
                              <p className="text-[11px] font-[900] text-on-surface">{job.sta || '--:--'}</p>
                          </div>
                          <div className="text-center border-r border-outline/30">
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                              <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{job.eta || '--:--'}</p>
                          </div>
                          <div className="text-center">
                              <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-0.5">STD</p>
                              <p className="text-[11px] font-[900] text-warning">{job.std || '--:--'}</p>
                          </div>
                      </div>

                      {/* Row 2: Operator/Team/EQ (Left) & Status Badge (Right) */}
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
                               {activeEqId && (
                                   <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-md border shadow-sm animate-in fade-in zoom-in-95 duration-500 shrink-0 ${equipmentBadgeClass(activeEqId)}`}>
                                       <Truck className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase tracking-widest leading-none">{activeEqId}</span>
                                   </div>
                               )}
                          </div>

                          {/* Right: Status badge for International on desktop and mobile */}
                          <div className="flex items-center gap-1.5 shrink-0">
                              {displayStatus === 'IN_PROGRESS' && (
                                  <span className="text-[8px] font-black text-warning uppercase tracking-widest animate-pulse hidden sm:inline">ACTIVE FUELING</span>
                              )}
                              {renderStatusBadge(displayStatus)}
                          </div>
                      </div>
                    </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="p-5 flex flex-col space-y-8 pb-24">
      {/* Active Fueling Alert & Quick Resume / Cancel Banner */}
      {activeFlight && activeFlight.status === 'IN_PROGRESS' && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-premium animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-warning/20 text-warning rounded-xl flex items-center justify-center shrink-0">
              <Fuel className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-on-surface uppercase tracking-tight">{activeFlight.flightNumber}</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-warning/20 text-warning border border-warning/40">
                  Active Refueling Session
                </span>
              </div>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-70 uppercase tracking-wider mt-0.5 truncate">
                Unit {activeFlight.vehicleId} • Stand {activeFlight.stand || 'TBA'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {onCancelActiveFlight && (
              <button
                type="button"
                onClick={() => onCancelActiveFlight?.(activeFlight as any)}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-surface-container hover:bg-surface-container-high text-on-surface-dim hover:text-error border border-outline transition-all cursor-pointer"
              >
                Cancel Session
              </button>
            )}
            {onResumeActiveFlight && (
              <button
                type="button"
                onClick={onResumeActiveFlight}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider kinetic-gradient text-white shadow-premium hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Fueling</span>
              </button>
            )}
          </div>
        </div>
      )}

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

      {editingAircraftJob && (
        <EditAircraftModal
          flightNumber={editingAircraftJob.flightNumber}
          initialType={editingAircraftJob.aircraftType}
          initialReg={editingAircraftJob.aircraftReg}
          onClose={() => setEditingAircraftJob(null)}
          onSave={async (newType, newReg) => {
            try {
              await updateFlightJob(editingAircraftJob.id, {
                aircraftType: newType,
                aircraftReg: newReg
              });
              notify(`Updated aircraft for flight ${editingAircraftJob.flightNumber} to ${newType} (${newReg})`, 'success');
            } catch (err) {
              console.error(err);
              notify('Failed to update aircraft details', 'error');
            }
          }}
        />
      )}

      {editingStandJob && (
        <EditStandModal
          flightNumber={editingStandJob.flightNumber}
          currentStand={editingStandJob.stand || ''}
          onClose={() => setEditingStandJob(null)}
          onSave={async (newStand) => {
            try {
              const jobId = editingStandJob.id || ((flightJobs || []).find(j => j.flightNumber === editingStandJob.flightNumber)?.id);
              if (jobId) {
                await updateFlightJob(jobId, { stand: newStand });
              }
              if (activeFlight && (activeFlight.id === editingStandJob.id || activeFlight.flightNumber === editingStandJob.flightNumber)) {
                activeFlight.stand = newStand;
              }
              notify(`Flight ${editingStandJob.flightNumber} stand changed to ${newStand}`, 'success');
            } catch (err) {
              console.error(err);
              notify('Failed to update flight stand', 'error');
            }
          }}
        />
      )}
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
  setManualTime: (field: keyof FlightLog, timeVal: string) => void,
  onEditFrt?: () => void
}> = ({ activeFlight, onTimestamp, onInputChange, onNext, onBack, user, getLocalTimeValue, setManualTime, onEditFrt }) => {
  const { selectedBriefingDate } = useOperationalData();
  return (
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
      <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Schedule
      </button>
      <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase italic">Ramp Arrival <span className="text-primary">& Setup</span></h2>
      
      <div className="space-y-6 flex-1">
          {/* Top Row: Operational Date (Left) & Aircraft Details (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Operational Date */}
              <div className="card-premium p-6 border-outline overflow-hidden md:col-span-5 lg:col-span-4 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Operational Date</label>
                  </div>
                  <div>
                      <span className="hidden sm:block text-[9px] font-black text-transparent select-none uppercase tracking-widest mb-1.5 opacity-0">Date</span>
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
              </div>

              {/* Aircraft Details */}
              <div className="card-premium p-6 border-outline overflow-hidden md:col-span-7 lg:col-span-8 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Aircraft Details</label>
                      <Plane className="w-4 h-4 text-primary opacity-50" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-60">Aircraft Type</span>
                          <input
                              type="text"
                              value={activeFlight?.aircraftType || ''}
                              onChange={(e) => onInputChange('aircraftType', e.target.value.toUpperCase())}
                              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[12px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                          />
                      </div>
                      <div>
                          <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-60">Aircraft Registration</span>
                          <input
                              type="text"
                              value={activeFlight?.aircraftReg || ''}
                              onChange={(e) => onInputChange('aircraftReg', e.target.value.toUpperCase())}
                              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[12px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-primary"
                          />
                      </div>
                  </div>
              </div>
          </div>

          <div className="card-premium p-6 border-outline overflow-hidden">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Delivery Ticket Number</label>
              <div className="flex items-center gap-2 max-w-full overflow-hidden">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">MLE-</span>
                  <input 
                      type="text" 
                      maxLength={6}
                      disabled={isReadOnly(user.role)}
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
              <>
                  <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                      <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">C/O (Billing Account)</label>
                      <div className="flex items-center gap-2 max-w-full overflow-hidden">
                          <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">C/O-</span>
                          <input 
                              type="text" 
                              disabled={isReadOnly(user.role)}
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

                  <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                      <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Operator Name</label>
                      <input 
                          type="text" 
                          disabled={isReadOnly(user.role)}
                          className="w-full text-2xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:text-on-surface/20 uppercase tracking-widest"
                          placeholder="ENTER OPERATOR NAME"
                          value={activeFlight.operatorName || ''}
                          onChange={(e) => {
                              onInputChange('operatorName', e.target.value.toUpperCase());
                          }}
                      />
                  </div>
              </>
          )}

          {activeFlight?.vehicleId?.startsWith('HD') && (
            <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Hydrant PIT Number</label>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                        <span className="text-2xl sm:text-3xl font-mono font-black text-primary opacity-30 shrink-0">J</span>
                        <input 
                            type="text" 
                            disabled={isReadOnly(user.role)}
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
                    {activeFlight.stand && !isReadOnly(user.role) && (
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
          {/* Flight Departure & Fuel Request Information Banner */}
          {activeFlight && (
            <div className="card-premium p-4 sm:p-5 border-outline bg-surface-container-lowest/90 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="block text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-50">
                      Departure Timings
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditFrt && onEditFrt()}
                      className="px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                      title="Edit Departure & Fuel Request Timings"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-warning font-black text-xs">
                      STD: {activeFlight.std || '--:--'}
                    </span>
                    {activeFlight.tobt && (
                      <span className="font-mono text-amber-400 font-black text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        TOBT: {activeFlight.tobt}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeFlight.frtAirline && (
                  <span className="px-2.5 py-1 bg-surface-dim rounded-lg border border-outline text-[10px] font-mono">
                    <strong className="text-on-surface-dim font-bold opacity-60">FRT Airline: </strong>
                    <span className="text-on-surface font-black">{activeFlight.frtAirline}</span>
                  </span>
                )}
                {activeFlight.frtAocc && (
                  <span className="px-2.5 py-1 bg-surface-dim rounded-lg border border-outline text-[10px] font-mono">
                    <strong className="text-on-surface-dim font-bold opacity-60">FRT AOCC: </strong>
                    <span className="text-on-surface font-black">{activeFlight.frtAocc}</span>
                  </span>
                )}
                {activeFlight.frtFor && (
                  <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg border border-primary/20 text-[10px] font-mono font-black">
                    <strong className="opacity-70">FRT For: </strong>
                    <span>{activeFlight.frtFor}</span>
                  </span>
                )}
                {!activeFlight.frtAirline && !activeFlight.frtAocc && !activeFlight.frtFor && (
                  <button
                    type="button"
                    onClick={() => onEditFrt && onEditFrt()}
                    className="px-2.5 py-1 bg-surface-dim hover:bg-surface-container rounded-lg border border-outline text-[10px] text-on-surface-dim hover:text-on-surface font-bold transition-colors cursor-pointer"
                  >
                    + Add FRT
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Operation Alpha (Log Arrived) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampArrived')}
                  disabled={isReadOnly(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampArrived 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : isReadOnly(user.role)
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
                          disabled={isReadOnly(user.role)}
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
                  disabled={!activeFlight?.timestampArrived || isReadOnly(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampPosition 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (!activeFlight?.timestampArrived || isReadOnly(user.role))
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
                          disabled={!activeFlight?.timestampArrived || isReadOnly(user.role)}
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
                  disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isReadOnly(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampStart 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isReadOnly(user.role))
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
                          disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart || isReadOnly(user.role)}
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
          disabled={!isReadOnly(user.role) && (!activeFlight?.timestampStart || activeFlight?.deliveryNumber?.replace('MLE-', '').length !== 6)}
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
                  disabled={isReadOnly(user.role)}
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
                  disabled={activeFlight?.meterOpen === undefined || isReadOnly(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampInitialEnd 
                          ? 'bg-success/5 border-success text-on-surface' 
                          : (activeFlight?.meterOpen === undefined || isReadOnly(user.role))
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
                          disabled={activeFlight?.meterOpen === undefined || isReadOnly(user.role)}
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
                       disabled={isReadOnly(user.role)}
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
                      disabled={isReadOnly(user.role)}
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
                      disabled={isReadOnly(user.role)}
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
                   onClick={() => { if (!isReadOnly(user.role)) setShowTopUp(!showTopUp); }} 
                   disabled={isReadOnly(user.role)}
                   className="text-primary font-black text-[11px] uppercase tracking-widest flex items-center hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
               >
                   {showTopUp ? '- Strike Top-Up Data' : '+ Register Top-Up Event'}
               </button>
               {showTopUp && (
                    <div className="space-y-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-400">
                        {/* Final Start */}
                        <div className="flex gap-4 items-stretch w-full">
                            <button 
                                onClick={() => { if (!isReadOnly(user.role)) onTimestamp('timestampFinalStart'); }} 
                                disabled={isReadOnly(user.role)}
                                className={`flex-1 p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                                    ${activeFlight?.timestampFinalStart 
                                        ? 'bg-success/5 border-success text-on-surface' 
                                        : isReadOnly(user.role)
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
                                        disabled={isReadOnly(user.role)}
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
                                onClick={() => { if (!isReadOnly(user.role)) onTimestamp('timestampFinalEnd'); }} 
                                disabled={isReadOnly(user.role)}
                                className={`flex-1 p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                                    ${activeFlight?.timestampFinalEnd 
                                        ? 'bg-success/5 border-success text-on-surface' 
                                        : isReadOnly(user.role)
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
                                        disabled={isReadOnly(user.role)}
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
              disabled={!isReadOnly(user.role) && (!activeFlight?.volume || activeFlight.volume <= 0)}
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
  onTimestamp?: (field: keyof FlightLog) => void,
  setManualTime?: (field: keyof FlightLog, val: string) => void,
  getLocalTimeValue?: (iso?: string) => string,
  onSubmit: () => void, 
  onBack: () => void,
  onClose: () => void,
  loading: boolean,
  user: User
}> = ({ activeFlight, onInputChange, onTimestamp, setManualTime, getLocalTimeValue, onSubmit, onBack, onClose, loading, user }) => {
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
               const isDisabled = isReadOnly(user.role);
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

           {/* Operation Clearance (Log Clearance Time) */}
           <div className="pt-4 border-t border-outline/40">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-50">
                 Safety & Ramp Clearance Milestone
              </label>
              <div className="flex gap-4 items-stretch w-full">
                  <button 
                      type="button"
                      onClick={() => onTimestamp ? onTimestamp('timestampClearance') : undefined}
                      disabled={isReadOnly(user.role)}
                      className={`flex-1 p-5 sm:p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group
                          ${activeFlight?.timestampClearance 
                              ? 'bg-success/5 border-success text-on-surface' 
                              : isReadOnly(user.role)
                                  ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                                  : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                      `}
                  >
                      <div className="relative z-10">
                          <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-1">Safety Milestone</span>
                          <span className={`block text-lg sm:text-xl font-[900] tracking-tighter ${activeFlight?.timestampClearance ? 'text-success' : 'text-on-surface'}`}>
                              LOG CLEARANCE TIME
                          </span>
                          {activeFlight?.timestampClearance && (
                              <span className="block mt-2 font-black text-[10px] uppercase tracking-widest text-success flex items-center">
                                   <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60"/>
                                   {new Date(activeFlight.timestampClearance).toLocaleTimeString([], { hour12: false })}
                              </span>
                          )}
                      </div>
                      {!activeFlight?.timestampClearance && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
                      {activeFlight?.timestampClearance && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-success opacity-10" />}
                  </button>
                  <div className="card-premium p-4 border-outline flex flex-col justify-center items-center w-36 sm:w-44 shrink-0">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-2 text-center">Manual Time</span>
                      <div className="relative w-full">
                          <input 
                              type="time"
                              disabled={isReadOnly(user.role)}
                              value={activeFlight?.timestampClearance && getLocalTimeValue ? getLocalTimeValue(activeFlight.timestampClearance) : ''}
                              onChange={(e) => setManualTime ? setManualTime('timestampClearance', e.target.value) : undefined}
                              className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                          />
                      </div>
                  </div>
              </div>
           </div>

            {/* Task Remarks & Operational Notes */}
            <div className="pt-4 border-t border-outline/40">
               <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-50">
                  Task Remarks & Operational Notes
               </label>
               <textarea 
                 className="w-full bg-surface-dim border border-outline rounded-2xl p-4 text-xs font-bold text-on-surface outline-none focus:border-primary transition-all min-h-[90px] placeholder:opacity-30 disabled:opacity-50"
                 placeholder={isReadOnly(user.role) ? 'No remarks' : 'Enter any operational remarks, delays, or equipment notes...'}
                 value={cleanRemarks(activeFlight?.remarks)}
                 onChange={(e) => onInputChange('remarks', e.target.value)}
                 disabled={isReadOnly(user.role)}
               />
            </div>
        </div>

        <div className="mt-auto pt-10 space-y-6">
            <div className="bg-warning/5 border border-warning/20 p-6 rounded-3xl flex items-start">
                <AlertTriangle className="w-6 h-6 text-warning mr-4 flex-shrink-0" />
                <p className="text-[11px] font-bold text-on-surface opacity-60 leading-relaxed uppercase tracking-widest">Digital certification required. By committing, you verify JIG compliance and manual safety checks are complete.</p>
            </div>
            
            {isReadOnly(user.role) ? (
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

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user, initialJob, onClearInitialJob, initialVehicleId, onClearInitialVehicleId, setActiveView }) => {
  const { notify } = useNotification();
  const { equipment, flightJobs, rawFlightJobs, flightLogs, updateEquipmentStatus, updateEquipment, createAlert, updateFlightJob, updateFlightLog, externalFlights, staff, refreshData, selectedBriefingDate, tanks, updateTankLevel, serviceTankId, briefingInfo, internationalSchedules, addFlightLogEntry } = useOperationalData();
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(() => {
    try {
      const saved = localStorage.getItem(`fms_active_flight_${user?.id || ''}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const originViewRef = React.useRef<string | null>(null);
  const [paymentType, setPaymentType] = useState<'CREDIT' | 'CASH' | 'VOID'>('CREDIT');
  const [cashRate, setCashRate] = useState<string>('1.85');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidForm, setVoidForm] = useState({ date: new Date().toISOString().split('T')[0], deliveryNumber: '' });
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidSuccess, setVoidSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEditActiveAircraft, setShowEditActiveAircraft] = useState(false);
  const [showEditActiveStand, setShowEditActiveStand] = useState(false);
  const [showEditActiveFrt, setShowEditActiveFrt] = useState(false);

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
    const ticketVal = await checkDuplicateTicketAcrossJetA1(fullDeliveryNumber, undefined, flightLogs);
    if (ticketVal.isDuplicate) {
      notify(ticketVal.message || `Delivery ticket number ${fullDeliveryNumber} is already used. Void aborted.`, 'error');
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
  
  const lastProcessedJobKeyRef = React.useRef<string | null>(null);

  // Auto-start if job passed from dashboard or schedule
  useEffect(() => {
    if (initialJob) {
      const jobKey = `${initialJob.id || ''}_${initialJob.flightNumber || ''}_${initialJob.vehicleId || initialVehicleId || ''}`;
      if (lastProcessedJobKeyRef.current !== jobKey) {
        lastProcessedJobKeyRef.current = jobKey;
        originViewRef.current = (initialJob as any).originView || 'schedule';
        const vehicleToUse = initialJob.vehicleId || initialVehicleId || selectedVehicleId;
        startJob(initialJob, vehicleToUse);
        setTimeout(() => {
          if (onClearInitialJob) onClearInitialJob();
          if (onClearInitialVehicleId) onClearInitialVehicleId();
        }, 50);
      }
    } else {
      lastProcessedJobKeyRef.current = null;
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
  const activeJobRef = React.useRef<{ jobId?: string; flightNumber?: string; vehicleId?: string } | null>(null);
  const isSubmittingOrCompletingRef = React.useRef(false);

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

  const cancelActiveFlightJob = (targetJob?: FlightJob) => {
    // Guard against React SyntheticEvent being passed when invoked directly by onClick
    const isEvent = targetJob && ('nativeEvent' in (targetJob as any) || typeof (targetJob as any).preventDefault === 'function');
    const validTargetJob = isEvent ? undefined : targetJob;
    const currentActive = activeFlightRef.current || activeFlight;
    const jobToCancel = validTargetJob || currentActive;
    const currentJobInfo = activeJobRef.current;
    const targetVehicleId = jobToCancel?.vehicleId || currentActive?.vehicleId || currentJobInfo?.vehicleId || selectedVehicleIdRef.current || selectedVehicleId;

    // 1. Release equipment back to AVAILABLE
    if (targetVehicleId) {
      updateEquipmentStatusRef.current(targetVehicleId, EquipmentStatus.AVAILABLE);
    }

    // 2. Revert flight job back to PENDING so it can be re-started without active fueling
    const rawFlightNo = jobToCancel?.flightNumber || currentActive?.flightNumber || currentJobInfo?.flightNumber || '';
    const normFlightNo = rawFlightNo.replace(/\s+/g, '').toUpperCase();
    const knownJobId = (jobToCancel as any)?.jobId || (jobToCancel as any)?.id || (currentActive as any)?.jobId || (currentActive as any)?.id || currentJobInfo?.jobId;

    const allJobs = flightJobsRef.current || flightJobs || [];
    const matching = allJobs.find(j => 
      (knownJobId && j.id === knownJobId) ||
      (normFlightNo && (j.flightNumber || '').replace(/\s+/g, '').toUpperCase() === normFlightNo && j.status !== 'COMPLETED')
    );

    const finalJobId = matching?.id || knownJobId || (normFlightNo ? `fj-${normFlightNo}` : undefined);
    if (finalJobId || normFlightNo) {
      updateFlightJobRef.current(finalJobId || normFlightNo, { 
        status: 'PENDING', 
        vehicleId: '',
        flightNumber: rawFlightNo || matching?.flightNumber
      });
    }

    const currentActiveNo = (currentActive?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    if (!validTargetJob || (currentActiveNo && (!normFlightNo || currentActiveNo === normFlightNo)) || !currentActiveNo) {
      try {
        localStorage.removeItem(`fms_active_flight_${user?.id || ''}`);
      } catch {}

      activeJobRef.current = null;
      activeFlightRef.current = null;
      setActiveFlight(null);
    }

    notify(`Fueling for ${rawFlightNo || 'flight'} cancelled and status reverted.`, 'success');
  };

  const isMountedRef = React.useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startJob = (job: FlightJob, vehicleIdOverride?: string) => {
    // If this flight is already active in local session, directly resume to timestamps
    const cleanJobNo = (job.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    const cleanActiveNo = (activeFlight?.flightNumber || '').replace(/\s+/g, '').toUpperCase();
    if (activeFlight && cleanActiveNo === cleanJobNo) {
      navigateToScreen('timestamps');
      return;
    }

    const activeVehicleId = vehicleIdOverride || selectedVehicleId;
    const isDomFlight = !!job.isDomestic || isDomesticFlight(job);
    const isRfJob = job.equipmentUsage?.toUpperCase() === 'REFUELLER' || isDomFlight;
    const isHdJob = job.equipmentUsage?.toUpperCase() === 'HYDRANT';
    const isSelectedRf = activeVehicleId?.toUpperCase().startsWith('RF');
    const isSelectedHd = activeVehicleId?.toUpperCase().startsWith('HD');

    if (!activeVehicleId) {
      notify(`Please select an equipment to start this flight.`, 'warning');
      const rfEquip = (equipment || []).filter(eq => (isRfJob ? eq.id.startsWith('RF') : true) && (eq.currentVolume || 0) > 0 && eq.status === EquipmentStatus.AVAILABLE);
      const saved = localStorage.getItem(`fms_last_selected_vehicle_${user.id}`);
      const defaultSelected = (saved && rfEquip.some(e => e.id === saved)) ? saved : (rfEquip[0]?.id || '');
      setEquipPickerSelected(defaultSelected);
      setEquipPickerJob(job);
      return;
    }

    if (isRfJob && !isSelectedRf) {
      notify(`This job requires a REFUELLER (RF). You must select an RF equipment to start it.`, 'error');
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
    const targetFlightDate = job.date ? job.date.split('T')[0] : selectedBriefingDate;
    const normJobNo = (job.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const matchingJob = (flightJobs || []).find(j => 
      (job.id && j.id === job.id) ||
      ((j.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === normJobNo && (!j.date || j.date.split('T')[0] === targetFlightDate))
    );
    const matchingRawJob = (rawFlightJobs || []).find(j => 
      (job.id && j.id === job.id) ||
      ((j.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === normJobNo && (!j.date || j.date.split('T')[0] === targetFlightDate))
    );
    const targetJobId = matchingJob?.id || matchingRawJob?.id || job.id || (normJobNo ? `fj-${normJobNo}` : `fj-${Date.now()}`);
    const effectiveAssignee = matchingJob?.assignedTo || matchingRawJob?.assignedTo || job.assignedTo || (user.role === UserRole.ITP_OPERATOR || user.role === UserRole.ITP_HD_OPERATOR ? user.id : '');

    const cleanFlightNo = normJobNo;
    const matchingExternal = (externalFlights || []).find(ef => 
      (ef.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo && (ef.type === 'departure' || !ef.type)
    ) || (externalFlights || []).find(ef => 
      (ef.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo
    );
    const matchingSchedule = (internationalSchedules || []).find(sch => 
      (sch.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo
    );

    const matchingFrozen = [
      ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.intl || []),
      ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.domestic || []),
      ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.adhoc || [])
    ].find((f: any) => f && (
      (job.id && f.id === job.id) ||
      ((f.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === normJobNo && (!f.date || f.date.split('T')[0] === targetFlightDate))
    ));

    const externalStd = matchingExternal?.std || (matchingExternal?.type === 'departure' ? matchingExternal?.scheduledTime : '') || matchingExternal?.scheduledTime || '';
    const resolvedStd = job.std || (job as any).scheduledTime || matchingJob?.std || (matchingJob as any)?.scheduledTime || matchingRawJob?.std || (matchingRawJob as any)?.scheduledTime || matchingFrozen?.std || (matchingFrozen as any)?.scheduledTime || externalStd || matchingSchedule?.std || '';
    const resolvedTobt = job.tobt || matchingJob?.tobt || matchingRawJob?.tobt || matchingFrozen?.tobt || (matchingExternal as any)?.tobt || '';
    const resolvedFrtAirline = job.frtAirline || matchingJob?.frtAirline || matchingRawJob?.frtAirline || matchingFrozen?.frtAirline || '';
    const resolvedFrtAocc = job.frtAocc || matchingJob?.frtAocc || matchingRawJob?.frtAocc || matchingFrozen?.frtAocc || '';
    const resolvedFrtFor = job.frtFor || matchingJob?.frtFor || matchingRawJob?.frtFor || matchingFrozen?.frtFor || '';

    if (targetJobId) {
      updateFlightJob(targetJobId, { 
        status: 'IN_PROGRESS', 
        vehicleId: activeVehicleId, 
        assignedTo: effectiveAssignee,
        flightNumber: job.flightNumber,
        aircraftReg: job.aircraftReg || matchingJob?.aircraftReg || matchingRawJob?.aircraftReg,
        aircraftType: job.aircraftType || matchingJob?.aircraftType || matchingRawJob?.aircraftType,
        stand: job.stand || matchingJob?.stand || matchingRawJob?.stand,
        sta: job.sta || matchingJob?.sta || matchingRawJob?.sta,
        eta: job.eta || matchingJob?.eta || matchingRawJob?.eta,
        std: resolvedStd,
        tobt: resolvedTobt,
        frtAirline: resolvedFrtAirline,
        frtAocc: resolvedFrtAocc,
        frtFor: resolvedFrtFor,
        date: targetFlightDate,
        route: job.route || matchingJob?.route || matchingRawJob?.route,
        isDomestic: isDomFlight,
        isAdhoc: job.isAdhoc
      });
    }

    activeJobRef.current = {
      jobId: targetJobId,
      flightNumber: job.flightNumber,
      vehicleId: activeVehicleId
    };

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

    const matchingAdhoc = (briefingInfo?.staffAssignments?.adhocFlights || []).find((af: any) => 
      af && (af.id === job.id || (af.flightNumber && af.flightNumber.replace(/\s+/g, '').toLowerCase() === (job.flightNumber || '').replace(/\s+/g, '').toLowerCase()))
    );
    const resolvedCo = (job as any).co || matchingAdhoc?.co || '';
    const resolvedOperatorName = job.isAdhoc ? ((job as any).operatorName || matchingAdhoc?.operatorName || '') : '';

    const flightData = {
      id: targetJobId,
      jobId: targetJobId,
      flightNumber: job.flightNumber,
      aircraftReg: (job.aircraftReg && job.aircraftReg !== '8Q-TBA' && !job.aircraftReg.startsWith('8Q-DOM')) ? job.aircraftReg : ((matchingJob?.aircraftReg && matchingJob.aircraftReg !== '8Q-TBA' && !matchingJob.aircraftReg.startsWith('8Q-DOM')) ? matchingJob.aircraftReg : ''),
      aircraftType: cleanAircraftTypeName(job.aircraftType || matchingJob?.aircraftType || (isDomFlight ? 'ATR' : 'A320')),
      stand: job.stand || matchingJob?.stand || '---',
      operatorId: effectiveAssignee,
      vehicleId: activeVehicleId,
      status: 'IN_PROGRESS',
      meterOpen: initialMeter,
      volume: 0,
      panelCheck: false,
      walkAroundCheck: false,
      appearanceCheck: false,
      waterCheck: false,
      remarks: cleanRemarks(job.remarks || ''),
      isAdhoc: job.isAdhoc,
      route: job.route || matchingJob?.route,
      isDomestic: isDomFlight,
      officer: job.assignedOfficer || matchingJob?.assignedOfficer || '',
      operationalDate: targetFlightDate || new Date().toISOString().split('T')[0],
      std: resolvedStd,
      tobt: resolvedTobt,
      frtAirline: resolvedFrtAirline,
      frtAocc: resolvedFrtAocc,
      frtFor: resolvedFrtFor,
      timestampClearance: job.timestampClearance,
      co: resolvedCo,
      operatorName: resolvedOperatorName,
    };
    setActiveFlight(flightData as any);
    try {
      localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify(flightData));
    } catch {}
    navigateToScreen('timestamps');
  };

  const handleTimestamp = (field: keyof FlightLog) => {
    if (!activeFlight) return;

    if (field === 'timestampClearance') {
      if (!activeFlight.timestampStart && !activeFlight.timestampInitialEnd) {
        notify('Cannot log Clearance before fueling has commenced or completed.', 'warning');
        return;
      }
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
      const nextVal = prev[field] ? undefined : serverTimeService.getServerIso();
      if (field === 'timestampClearance') {
        const targetId = prev.id || (prev as any).jobId;
        if (targetId) {
          updateFlightJob(targetId, { timestampClearance: nextVal });
        }
      }
      return {
        ...prev,
        [field]: nextVal
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
      if (field === 'timestampClearance') {
        const targetId = activeFlight.id || (activeFlight as any).jobId;
        if (targetId) {
          updateFlightJob(targetId, { timestampClearance: undefined });
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
    const isoVal = localDate.toISOString();
    handleInputChange(field, isoVal);

    if (field === 'timestampClearance') {
      const targetId = activeFlight.id || (activeFlight as any).jobId;
      if (targetId) {
        updateFlightJob(targetId, { timestampClearance: isoVal });
      }
    }
  };

  const navigateToScreen = (screen: 'dashboard' | 'timestamps' | 'metering' | 'qc') => {
    setCurrentScreen(screen);
    const state = window.history.state;
    const currentItpScreen = state?.itpScreen || 'dashboard';
    if (currentItpScreen !== screen) {
      window.history.pushState({ fmsActive: true, fmsView: 'intoplane', itpScreen: screen }, '');
    }
  };

  const handleBackToTimestamps = () => {
    setCurrentScreen('timestamps');
    if (window.history.state?.itpScreen) {
      window.history.replaceState({ fmsActive: true, fmsView: 'intoplane', itpScreen: 'timestamps' }, '');
    }
  };

  const handleBackToMetering = () => {
    setCurrentScreen('metering');
    if (window.history.state?.itpScreen) {
      window.history.replaceState({ fmsActive: true, fmsView: 'intoplane', itpScreen: 'metering' }, '');
    }
  };

  const completeOrCancelJobAndExit = (successMessage?: string) => {
    isSubmittingOrCompletingRef.current = true;
    try {
      localStorage.removeItem(`fms_active_flight_${user?.id || ''}`);
    } catch {}
    if (successMessage) {
      notify(successMessage, "success");
      activeJobRef.current = null;
      activeFlightRef.current = null;
      setActiveFlight(null);
    } else {
      cancelActiveFlightJob();
    }
    
    setCurrentScreen('dashboard');

    if (window.history.state?.itpScreen) {
      window.history.replaceState({ fmsActive: true, fmsView: 'intoplane', itpScreen: 'dashboard' }, '');
    }

    if (originViewRef.current && setActiveView) {
      const prev = originViewRef.current;
      originViewRef.current = null;
      setActiveView(prev);
    }

    setTimeout(() => {
      isSubmittingOrCompletingRef.current = false;
    }, 200);
  };

  const handleBackToDashboard = () => {
    isSubmittingOrCompletingRef.current = true;
    cancelActiveFlightJob();
    setCurrentScreen('dashboard');

    if (window.history.state?.itpScreen) {
      window.history.replaceState({ fmsActive: true, fmsView: 'intoplane', itpScreen: 'dashboard' }, '');
    }

    if (originViewRef.current && setActiveView) {
      const prev = originViewRef.current;
      originViewRef.current = null;
      setActiveView(prev);
    }

    setTimeout(() => {
      isSubmittingOrCompletingRef.current = false;
    }, 150);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isSubmittingOrCompletingRef.current) {
        setActiveFlight(null);
        setCurrentScreen('dashboard');
        return;
      }

      const targetScreen = e.state?.itpScreen;
      if (targetScreen && ['timestamps', 'metering', 'qc'].includes(targetScreen)) {
        if (targetScreen !== currentScreen) {
          setCurrentScreen(targetScreen);
        }
      } else {
        // Popped back to dashboard (or out of ITP sub-screens)
        if (currentScreen !== 'dashboard') {
          cancelActiveFlightJob();
          setCurrentScreen('dashboard');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentScreen]);

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
      const ticketVal = await checkDuplicateTicketAcrossJetA1(activeFlight.deliveryNumber, undefined, flightLogs);
      if (ticketVal.isDuplicate) {
        notify(ticketVal.message || `Delivery ticket number ${activeFlight.deliveryNumber} is already used. Please enter a unique ticket number.`, 'error');
        return;
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

      const cleanFlightNo = (activeFlight.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const matchingJob = (flightJobs || []).find(job => 
        (activeFlight.id && job.id === activeFlight.id) || 
        ((job.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo)
      );
      const matchingRawJob = (rawFlightJobs || []).find(job => 
        (activeFlight.id && job.id === activeFlight.id) || 
        ((job.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo)
      );
      const matchingExternal = (externalFlights || []).find(ef => 
        (ef.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo && (ef.type === 'departure' || !ef.type)
      ) || (externalFlights || []).find(ef => 
        (ef.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo
      );
      const matchingFrozen = [
        ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.intl || []),
        ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.domestic || []),
        ...((briefingInfo as any)?.staffAssignments?.frozenFlights?.adhoc || [])
      ].find((f: any) => f && (
        (activeFlight.id && f.id === activeFlight.id) ||
        ((f.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo)
      ));
      const matchingSchedule = (internationalSchedules || []).find(sch => 
        (sch.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFlightNo
      );

      const externalStd = matchingExternal?.std || (matchingExternal?.type === 'departure' ? matchingExternal?.scheduledTime : '') || matchingExternal?.scheduledTime || '';
      const resolvedStd = activeFlight.std || (activeFlight as any).scheduledTime || matchingJob?.std || (matchingJob as any)?.scheduledTime || matchingRawJob?.std || (matchingRawJob as any)?.scheduledTime || matchingFrozen?.std || (matchingFrozen as any)?.scheduledTime || externalStd || matchingSchedule?.std || '';
      const resolvedTobt = activeFlight.tobt || matchingJob?.tobt || matchingRawJob?.tobt || matchingFrozen?.tobt || (matchingExternal as any)?.tobt || '';
      const resolvedFrtAirline = activeFlight.frtAirline || matchingJob?.frtAirline || matchingRawJob?.frtAirline || matchingFrozen?.frtAirline || '';
      const resolvedFrtAocc = activeFlight.frtAocc || matchingJob?.frtAocc || matchingRawJob?.frtAocc || matchingFrozen?.frtAocc || '';
      const resolvedFrtFor = activeFlight.frtFor || matchingJob?.frtFor || matchingRawJob?.frtFor || matchingFrozen?.frtFor || '';

      // Operator Name is strictly for ad-hoc entries (not staff name)
      const resolvedOperatorName = activeFlight.isAdhoc ? (activeFlight.operatorName || '') : '';

      // Officer vs RF Operator resolution based on vehicle type and assignment
      const isHd = selectedVehicleId?.toUpperCase().startsWith('HD') || activeFlight?.vehicleId?.toUpperCase().startsWith('HD');
      const isRf = selectedVehicleId?.toUpperCase().startsWith('RF') || activeFlight?.vehicleId?.toUpperCase().startsWith('RF');

      const opStaff = (staff || []).find(s => 
        s.id === activeFlight.operatorId || 
        s.id === matchingJob?.assignedTo || 
        s.name.toLowerCase() === (activeFlight.operatorId || '').toLowerCase()
      );
      const assignedOpName = opStaff?.name || (activeFlight.operatorId && !activeFlight.operatorId.startsWith('st-') ? activeFlight.operatorId : user.name);

      const officerRaw = activeFlight.officer || matchingJob?.assignedOfficer || '';
      const officerStaff = (staff || []).find(s => 
        s.id === officerRaw || 
        s.name.toLowerCase() === (officerRaw || '').toLowerCase()
      );
      const assignedOfficerName = officerStaff?.name || (officerRaw && !officerRaw.startsWith('st-') && officerRaw !== 'ITP Officer' ? officerRaw : '');

      let resolvedOfficer = '';
      let resolvedTacticalOperator = '';

      if (isHd) {
        // If 2 distinct staff are assigned (officer AND operator)
        if (assignedOfficerName && assignedOpName && assignedOfficerName.toLowerCase() !== assignedOpName.toLowerCase() && assignedOfficerName !== 'ITP Officer') {
          resolvedOfficer = assignedOfficerName;
          resolvedTacticalOperator = assignedOpName;
        } else {
          // Exactly 1 staff assigned on HD:
          // Enter the staff name to Officer field only and leave RF Operator field blank!
          resolvedOfficer = (assignedOfficerName && assignedOfficerName !== 'ITP Officer') ? assignedOfficerName : (assignedOpName || user.name);
          resolvedTacticalOperator = '';
        }
      } else if (isRf) {
        // Refueller:
        resolvedTacticalOperator = assignedOpName || user.name;
        resolvedOfficer = (assignedOfficerName && assignedOfficerName.toLowerCase() !== assignedOpName.toLowerCase() && assignedOfficerName !== 'ITP Officer')
          ? assignedOfficerName
          : '';
      } else {
        // Seaplane / other:
        resolvedOfficer = (assignedOfficerName && assignedOfficerName !== 'ITP Officer') ? assignedOfficerName : (assignedOpName || user.name);
        resolvedTacticalOperator = isSeaplaneFlight ? '' : (assignedOpName || user.name);
      }

      const newLogId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const logToSave: FlightLog = {
        id: newLogId,
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
        std: resolvedStd,
        tobt: resolvedTobt,
        frtAirline: resolvedFrtAirline,
        frtAocc: resolvedFrtAocc,
        frtFor: resolvedFrtFor,
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
        created_at: new Date().toISOString(),
        psi: activeFlight.psi,
        lpm: activeFlight.lpm,
        officer: resolvedOfficer,
        operatorName: resolvedOperatorName,
        tacticalOperator: resolvedTacticalOperator,
        destination: activeFlight.destination,
        paymentType: paymentType || activeFlight.paymentType || 'CREDIT',
      };

      // Optimistically push into in-memory state so user sees it right away in Log History
      if (addFlightLogEntry) {
        addFlightLogEntry({ ...logToSave });
      }

      // Collect auxiliary promises to run concurrently with BigQuery save
      const auxPromises: Promise<any>[] = [];

      const logPromise = supabaseService.createFlightLog(logToSave);

      // Update Refueller Payload/Inventory if applicable
      if (selectedVehicleId.startsWith('RF')) {
        const vehicle = equipment.find(eq => eq.id === selectedVehicleId);
        if (vehicle && vehicle.currentVolume !== undefined) {
          const newVolume = Math.max(0, vehicle.currentVolume - (activeFlight.volume || 0));
          const capacity = vehicle.maxCapacity || 20000;
          const isLow = newVolume < 2000 || newVolume < capacity * 0.1;
          
          auxPromises.push(updateEquipment(selectedVehicleId, { 
            currentVolume: newVolume,
            status: isLow ? EquipmentStatus.REFUELLING : EquipmentStatus.AVAILABLE 
          }));

          if (isLow) {
            // Trigger automatic replenishment request for Depot Operator
            try {
              createAlert({
                severity: 'medium',
                message: `Replenishment requested for unit ${selectedVehicleId} (Low fuel: ${newVolume.toLocaleString()}L)`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                acknowledged: false,
                targetRole: UserRole.DEPOT_OPERATOR
              }).catch(err => console.error("Auto alert trigger failed:", err));
              notify(`Refueller ${selectedVehicleId} fuel level is low (${newVolume.toLocaleString()}L). Replenishment request triggered automatically.`, 'warning');
            } catch (err) {
              console.error("Auto alert trigger failed:", err);
            }
          }
        } else {
          updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
        }
      } else {
        // Hydrant dispensation: deduct from active service tank (defaults to tk101)
        const targetTank = (tanks || []).find(t => t.id === serviceTankId) || (tanks || []).find(t => t.id === 'tk101');
        if (targetTank && activeFlight.volume) {
          const newLevel = Math.max(0, targetTank.currentLevel - (activeFlight.volume || 0));
          auxPromises.push(updateTankLevel(targetTank.id, newLevel));
        }
        // Release hydrant/service equipment
        updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
      }

      // Find matching flight job and mark it as COMPLETED in the database
      const completedJobId = matchingJob?.id || matchingRawJob?.id || activeFlight.id;
      if (completedJobId) {
        auxPromises.push(updateFlightJob(completedJobId, { 
          status: 'COMPLETED',
          timestampClearance: logToSave.timestampClearance,
          vehicleId: selectedVehicleId,
          deliveryNumber: activeFlight.deliveryNumber,
          std: resolvedStd || activeFlight.std || undefined,
          tobt: resolvedTobt || activeFlight.tobt || undefined,
          frtAirline: resolvedFrtAirline || activeFlight.frtAirline || undefined,
          frtAocc: resolvedFrtAocc || activeFlight.frtAocc || undefined,
          frtFor: resolvedFrtFor || activeFlight.frtFor || undefined
        }));
      }

      // Concurrently wait for BigQuery and Supabase writes
      await Promise.all([logPromise, ...auxPromises]);

      // Refresh in background so user doesn't wait
      refreshData().catch(e => console.warn('[IntoPlane] Background refresh failed:', e));
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
          onEditActiveAircraft={() => setShowEditActiveAircraft(true)}
          onEditActiveStand={(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) ? () => setShowEditActiveStand(true) : undefined}
        />

        {showEditActiveAircraft && activeFlight && (
          <EditAircraftModal
            flightNumber={activeFlight.flightNumber || ''}
            initialType={activeFlight.aircraftType}
            initialReg={activeFlight.aircraftReg}
            onClose={() => setShowEditActiveAircraft(false)}
            onSave={async (newType, newReg) => {
              setActiveFlight(prev => prev ? ({ ...prev, aircraftType: newType, aircraftReg: newReg }) : null);
              const matching = (flightJobs || []).find(j => j.flightNumber === activeFlight.flightNumber);
              if (matching) {
                await updateFlightJob(matching.id, { aircraftType: newType, aircraftReg: newReg });
              }
              notify(`Aircraft updated to ${newType} (${newReg})`, 'success');
            }}
          />
        )}

        {showEditActiveStand && activeFlight && (
          <EditStandModal
            flightNumber={activeFlight.flightNumber || ''}
            currentStand={activeFlight.stand || ''}
            onClose={() => setShowEditActiveStand(false)}
            onSave={async (newStand) => {
              setActiveFlight(prev => prev ? ({ ...prev, stand: newStand }) : null);
              const matching = (flightJobs || []).find(j => j.flightNumber === activeFlight.flightNumber);
              if (matching) {
                await updateFlightJob(matching.id, { stand: newStand });
              }
              notify(`Flight ${activeFlight.flightNumber} stand updated to ${newStand}`, 'success');
            }}
          />
        )}

        {showEditActiveFrt && activeFlight && (
          <EditFuelRequestModal
            flight={{
              id: activeFlight.id || (activeFlight as any).jobId || '',
              flightNumber: activeFlight.flightNumber || '',
              stand: activeFlight.stand || '',
              aircraftReg: activeFlight.aircraftReg || '',
              aircraftType: activeFlight.aircraftType || '',
              std: activeFlight.std || '',
              tobt: activeFlight.tobt || '',
              frtAirline: activeFlight.frtAirline || '',
              frtAocc: activeFlight.frtAocc || '',
              frtFor: activeFlight.frtFor || '',
              status: activeFlight.status || 'IN_PROGRESS',
              date: activeFlight.operationalDate || '',
            } as any}
            onClose={() => setShowEditActiveFrt(false)}
            onSave={async (updates) => {
              // 1. Update activeFlight local state
              setActiveFlight(prev => prev ? ({ ...prev, ...updates }) : null);
              try {
                const raw = localStorage.getItem(`fms_active_flight_${user?.id || ''}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify({ ...parsed, ...updates }));
                }
              } catch {}

              // 2. Update flight_jobs table
              const cleanFn = (activeFlight.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const matchingJob = (flightJobs || []).find(j => 
                (activeFlight.id && j.id === activeFlight.id) ||
                ((j.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFn)
              );
              const targetJobId = matchingJob?.id || activeFlight.id || (activeFlight as any).jobId;
              if (targetJobId) {
                await updateFlightJob(targetJobId, updates);
              }

              // 3. Retrospectively sync with saved flight log if any exists
              const matchingLogs = (flightLogs || []).filter(l => 
                l && l.flightNumber && l.flightNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFn
              );
              for (const ml of matchingLogs) {
                if (ml.id && updateFlightLog) {
                  try {
                    await updateFlightLog(ml.id, updates);
                  } catch (e) {}
                }
              }

              notify(`Timings updated for ${activeFlight.flightNumber}`, 'success');
            }}
          />
        )}

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
                onResumeActiveFlight={() => navigateToScreen('timestamps')}
                onCancelActiveFlight={cancelActiveFlightJob}
              />
            )}
            {currentScreen === 'timestamps' && (
              <ScreenTimestamps 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onInputChange={handleInputChange}
                onNext={() => navigateToScreen('metering')}
                onBack={handleBackToDashboard}
                user={user}
                getLocalTimeValue={getLocalTimeValue}
                setManualTime={setManualTime}
                onEditFrt={() => setShowEditActiveFrt(true)}
              />
            )}
            {currentScreen === 'metering' && (
              <ScreenMetering 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onInputChange={handleInputChange}
                onNext={() => navigateToScreen('qc')}
                onBack={handleBackToTimestamps}
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
                onTimestamp={handleTimestamp}
                setManualTime={setManualTime}
                getLocalTimeValue={getLocalTimeValue}
                onSubmit={() => setShowConfirmModal(true)}
                onBack={handleBackToMetering}
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
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER' || equipPickerJob?.isDomestic || isDomesticFlight(equipPickerJob);
                    const isHdJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'HYDRANT';
                    
                    if (isRfJob) {
                      return isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected);
                    }
                    if (isHdJob) {
                      return isHd;
                    }
                    return (isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected)) || isHd;
                  })
                  .map(eq => {
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER' || equipPickerJob?.isDomestic || isDomesticFlight(equipPickerJob);
                    const isActuallyInUse = eq.status !== EquipmentStatus.AVAILABLE && eq.status === EquipmentStatus.IN_USE;
                    const activeJob = isActuallyInUse ? (flightJobs || []).find(fj => fj.status === 'IN_PROGRESS' && fj.vehicleId?.toUpperCase() === eq.id.toUpperCase()) : null;
                    const isSelected = equipPickerSelected === eq.id;
                    const isDisabled = !isRfJob && (isActuallyInUse || eq.status === EquipmentStatus.MAINTENANCE || eq.status === EquipmentStatus.OUT_OF_SERVICE);

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
                              <p className={`text-sm font-black font-mono ${isActuallyInUse ? 'text-error animate-pulse' : 'text-success'}`}>
                                {isActuallyInUse ? (activeJob ? `In Use: ${activeJob.flightNumber}` : 'In Use') : 'Available'}
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
                    const isRfJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'REFUELLER' || equipPickerJob?.isDomestic || isDomesticFlight(equipPickerJob);
                    const isHdJob = equipPickerJob?.equipmentUsage?.toUpperCase() === 'HYDRANT';
                    if (isRfJob) return isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected);
                    if (isHdJob) return isHd;
                    return (isRf && (eq.currentVolume || 0) > 0 && (eq.status === EquipmentStatus.AVAILABLE || eq.id === equipPickerSelected)) || isHd;
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