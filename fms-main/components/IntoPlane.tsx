import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FlightLog, User, FlightJob, Equipment, EquipmentStatus, UserRole, isDomesticFlight, cleanRemarks } from '../types';
import { MOCK_USERS, PIT_MAPPING } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, AlertCircle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Users, Lock, Calendar, X, CreditCard, Ban, Eye, Zap, Bell, BellOff, BellRing, Megaphone, ExternalLink, Droplet, PlaneLanding, PlaneTakeoff, ArrowRightCircle, Check, CheckCheck, RotateCcw, Pencil, Plane, Fuel, FileText, Printer, Mail, Share2 } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { flightRadarService } from '../services/flightRadarService';
import { getWatchedFlightIds, saveWatchedFlightIds } from '../services/watchedFlightsService';
import { equipmentBadgeClass, equipmentDotClass, getEquipmentHexColor } from '../utils/equipmentColors';
import { useNotification } from '../context/NotificationContext';

import { useOperationalData } from '../context/OperationalDataContext';
import { EditFuelRequestModal } from './EditFuelRequestModal';
import { EditAircraftModal } from './EditAircraftModal';
import { cleanAircraftTypeName, normalizeRegistration } from '../services/aircraftLookupService';
import { checkDuplicateTicketAcrossJetA1 } from '../services/ticketValidation';
import { serverTimeService } from '../services/serverTimeService';
import { SignatureAcknowledgment } from './SignatureAcknowledgment';
import { generateInvoiceHtml, generateInvoicePdfFile, openPrintInvoice, sendInvoiceEmail, shareInvoice, getInvoiceEmailDetails } from '../services/invoicePdfService';
import { EmailDispatchModal } from './EmailDispatchModal';
import { useFuelDispatch } from '../hooks/useFuelDispatch';
import { useFinanceData } from '../context/FinanceDataContext';

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
                          {(() => {
                            const isDomOrAdhoc = isDomesticFlight(activeFlight as any) || (activeFlight as any).isDomestic || (activeFlight as any).isAdhoc;
                            return !isDomOrAdhoc ? (
                              <span className="group/hdrstand inline-flex items-center mr-1">
                                <span className="text-on-surface">{activeFlight.stand || 'TBA'}</span>
                                {onEditActiveStand && (
                                  <button
                                    type="button"
                                    onClick={onEditActiveStand}
                                    className="p-1 ml-0.5 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-0 group-hover/hdrstand:opacity-100 flex-shrink-0 cursor-pointer"
                                    title="Edit Aircraft Details & Stand"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ) : null;
                          })()}
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
                          <div className="group/hdrac inline-flex items-center">
                            <button
                                type="button"
                                onClick={onEditActiveAircraft}
                                className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-0 group-hover/hdrac:opacity-100 flex-shrink-0 cursor-pointer"
                                title="Edit Aircraft Details"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                          </div>
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
    updateFlightJob,
    updateFlightLog
  } = useOperationalData();
  const { getDispatchState } = useFuelDispatch(user);
  const [viewMode, setViewMode] = useState<'INT' | 'DOM' | 'ADHOC'>('INT');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [editingJob, setEditingJob] = useState<FlightJob | null>(null);
  const [editingFrtJob, setEditingFrtJob] = useState<FlightJob | null>(null);

  const handleSaveCardFrt = async (jobToEdit: FlightJob, updates: {
    std?: string;
    tobt?: string;
    frtAirline?: string;
    frtAocc?: string;
    frtFor?: string;
  }) => {
    try {
      const cleanUpdates: Partial<FlightJob> = {
        std: updates.std !== undefined ? updates.std.trim() : undefined,
        tobt: updates.tobt !== undefined ? updates.tobt.trim() : undefined,
        frtAirline: updates.frtAirline !== undefined ? updates.frtAirline.trim() : undefined,
        frtAocc: updates.frtAocc !== undefined ? updates.frtAocc.trim() : undefined,
        frtFor: updates.frtFor !== undefined ? updates.frtFor.trim() : undefined,
      };

      const targetJobId = jobToEdit.id || (flightJobs || []).find(j => j.flightNumber === jobToEdit.flightNumber)?.id;
      if (targetJobId) {
        await updateFlightJob(targetJobId, cleanUpdates);
      }

      // If matches activeFlight, update activeFlight state & local storage
      if (activeFlight && (activeFlight.id === jobToEdit.id || activeFlight.flightNumber === jobToEdit.flightNumber)) {
        Object.assign(activeFlight, cleanUpdates);
        try {
          const raw = localStorage.getItem(`fms_active_flight_${user?.id || ''}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify({ ...parsed, ...cleanUpdates }));
          }
        } catch {}
      }

      // Retrospectively sync with saved flight logs if already logged
      const rawFlight = jobToEdit.flightNumber || '';
      const cleanFn = rawFlight.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const compactFn = cleanFn.replace(/([A-Z]+)0+([0-9]+)/, '$1$2');

      const matchesFn = (fn?: string) => {
        if (!fn) return false;
        const c = fn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return c === cleanFn || c.replace(/([A-Z]+)0+([0-9]+)/, '$1$2') === compactFn;
      };

      const matchingLogs = (flightLogs || []).filter(l => l && matchesFn(l.flightNumber));
      for (const ml of matchingLogs) {
        if (ml.id && updateFlightLog) {
          try {
            await updateFlightLog(ml.id, cleanUpdates as any);
          } catch (e) {
            console.warn(`[IntoPlane] Could not update saved flight log ${ml.id}:`, e);
          }
        }
      }

      notify(`Timings updated for ${jobToEdit.flightNumber}`, 'success');
    } catch (err) {
      console.error('[IntoPlane] Failed to update card timings:', err);
      notify('Failed to update timings.', 'error');
    }
  };

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

    const liveJob = (flightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      if (!matchesNo(j.flightNumber)) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !flightDate || jDate === flightDate;
    });

    const dbJob = (rawFlightJobs || []).find(j => {
      if (!j || !j.flightNumber) return false;
      if (!matchesNo(j.flightNumber)) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return jDate ? jDate === flightDate : true;
    });

    if (matchingLog && matchingLog.status === 'COMPLETED') {
      return 'COMPLETED';
    }

    // If authoritative DB job or live job is explicitly set to PENDING, never override with IN_PROGRESS
    if ((dbJob && dbJob.status === 'PENDING') || (liveJob && liveJob.status === 'PENDING')) {
      return 'PENDING';
    }

    if (matchingLog && matchingLog.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    if (activeFlight && matchesNo(activeFlight.flightNumber) && activeFlight.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    if (liveJob && liveJob.status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

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
      aircraftType: dbJob?.aircraftType || liveJob?.aircraftType || existing?.aircraftType || f.aircraftType,
      aircraftReg: dbJob?.aircraftReg || liveJob?.aircraftReg || existing?.aircraftReg || f.aircraftReg,
      status: computedStatus,
      fidsStatus: f.status,
      std: liveJob?.std || dbJob?.std || existing?.std || f.std || ((f as any).type === 'departure' ? (f as any).scheduledTime : '') || (f as any).scheduledTime || '',
      tobt: liveJob?.tobt || dbJob?.tobt || existing?.tobt || f.tobt || '',
      frtAirline: liveJob?.frtAirline || dbJob?.frtAirline || existing?.frtAirline || f.frtAirline || '',
      frtAocc: liveJob?.frtAocc || dbJob?.frtAocc || existing?.frtAocc || f.frtAocc || '',
      frtFor: liveJob?.frtFor || dbJob?.frtFor || existing?.frtFor || f.frtFor || '',
      assignedTo: (dbJob && dbJob.assignedTo !== undefined)
        ? (dbJob.assignedTo || '')
        : (liveJob && !liveJob.isVirtual && liveJob.assignedTo !== undefined)
        ? (liveJob.assignedTo || '')
        : (f.assignedTo || existing?.assignedTo || ''),
      assignedOfficer: (() => {
        const usage = dbJob?.equipmentUsage || liveJob?.equipmentUsage || f.equipmentUsage || existing?.equipmentUsage || 'HYDRANT';
        const raw = (dbJob && dbJob.assignedOfficer !== undefined)
          ? (dbJob.assignedOfficer || '')
          : (liveJob && !liveJob.isVirtual && liveJob.assignedOfficer !== undefined)
          ? (liveJob.assignedOfficer || '')
          : (f.assignedOfficer || existing?.assignedOfficer || '');
        return (usage === 'REFUELLER' && raw && !/^u\d+b?$/i.test(raw)) ? raw : '';
      })(),
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
        aircraftType: dbJob?.aircraftType || liveJob?.aircraftType || existing?.aircraftType || ff.aircraftType,
        aircraftReg: dbJob?.aircraftReg || liveJob?.aircraftReg || existing?.aircraftReg || ff.aircraftReg,
        status: computedStatus,
        fidsStatus: existing?.fidsStatus || ff.status,
        std: liveJob?.std || dbJob?.std || existing?.std || ff.std || (ff.type === 'departure' ? ff.scheduledTime : '') || ff.scheduledTime || '',
        tobt: liveJob?.tobt || dbJob?.tobt || existing?.tobt || ff.tobt || '',
        frtAirline: liveJob?.frtAirline || dbJob?.frtAirline || existing?.frtAirline || ff.frtAirline || '',
        frtAocc: liveJob?.frtAocc || dbJob?.frtAocc || existing?.frtAocc || ff.frtAocc || '',
        frtFor: liveJob?.frtFor || dbJob?.frtFor || existing?.frtFor || ff.frtFor || '',
        assignedTo: (dbJob && dbJob.assignedTo !== undefined)
          ? (dbJob.assignedTo || '')
          : (liveJob && !liveJob.isVirtual && liveJob.assignedTo !== undefined)
          ? (liveJob.assignedTo || '')
          : (ff.assignedTo || existing?.assignedTo || ''),
        assignedOfficer: (() => {
          const usage = dbJob?.equipmentUsage || liveJob?.equipmentUsage || ff.equipmentUsage || existing?.equipmentUsage || 'HYDRANT';
          const raw = (dbJob && dbJob.assignedOfficer !== undefined)
            ? (dbJob.assignedOfficer || '')
            : (liveJob && !liveJob.isVirtual && liveJob.assignedOfficer !== undefined)
            ? (liveJob.assignedOfficer || '')
            : (ff.assignedOfficer || existing?.assignedOfficer || '');
          return (usage === 'REFUELLER' && raw && !/^u\d+b?$/i.test(raw)) ? raw : '';
        })(),
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
      const isRefueller = job.equipmentUsage === 'REFUELLER';
      const isMockOfficer = !job.assignedOfficer || /^u\d+b?$/i.test(job.assignedOfficer);
      const officer = (isRefueller && !isMockOfficer) ? usersList.find(u => u.id === job.assignedOfficer || u.name.toLowerCase() === (job.assignedOfficer || '').toLowerCase()) : null;
      const officerName = officer?.name || null;
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
      const {
          dispatchStatus,
          isDispatchAcknowledged,
          dispatchRequestedTime,
          dispatchAcknowledgedTime,
          dispatchAcknowledgedBy
      } = getDispatchState(job);

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
          <div key={job.id} className={`bg-surface-container-lowest p-4 sm:p-5 rounded-2xl relative transition-all shrink-0 border ${isAssignedToMe ? 'border-primary border-l-[6px] shadow-sm' : isDomesticOrAdhoc ? 'border-outline-variant hover:border-outline shadow-sm' : 'border-outline opacity-80'} z-10`}>
              <div className="relative z-10">
                  {/* Job Card Header */}
                  <div className={isDomesticOrAdhoc ? "w-full relative" : "mb-2.5 sm:mb-3 w-full relative"}>
                      {/* Top Row: Flight number & stand on left, Action buttons on right (mobile & desktop aligned) */}
                      <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                              {/* Stand badge & Flight Number (always grouped together on the same row) */}
                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                  {/* Yellow gradient stand badge next to flight number (international only) */}
                                  {!isDomesticOrAdhoc && (
                                    <div 
                                      onClick={canEditStand ? (e) => { e.stopPropagation(); setEditingJob(job); } : undefined}
                                      className={`group/stand flex items-center gap-1 bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider shrink-0 ${
                                          canEditStand ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                                      }`}
                                      title={canEditStand ? "Click to edit aircraft & stand" : undefined}
                                    >
                                        <span>{job.stand || 'TBA'}</span>
                                        {canEditStand && <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/stand:opacity-100 transition-opacity" />}
                                    </div>
                                  )}

                                  {/* Flight Number */}
                                  <h3 className="text-2xl sm:text-3xl font-[900] text-on-surface tracking-tighter leading-none shrink-0 whitespace-nowrap">{job.flightNumber}</h3>

                                  {/* Tail Logo right next to flight number (visible on both mobile and desktop) */}
                                  {!(job.isDomestic || isDomesticFlight(job) || viewMode === 'DOM') && logoUrl && (
                                      <div className="flex w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 items-center justify-center">
                                          <img
                                              src={logoUrl}
                                              alt=""
                                              aria-hidden="true"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              className="w-full h-full object-contain select-none flex-shrink-0"
                                          />
                                      </div>
                                  )}
                              </div>

                              {/* Domestic airline logo & name next to flight number */}
                              {(job.isDomestic || isDomesticFlight(job) || viewMode === 'DOM') && (
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
                              <div className="group/ac hidden md:flex items-center gap-2.5 text-[11px] sm:text-[12px] font-bold text-on-surface-dim">
                                  <span className="opacity-20">|</span>
                                  <span className="font-black text-on-surface tracking-tight">{job.aircraftReg}</span>
                                  <span className="opacity-20">|</span>
                                  <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-on-surface-dim border-transparent uppercase tracking-wider">{job.aircraftType}</span>
                                  {canEditAircraft && (
                                      <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingJob(job); }}
                                          className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-0 group-hover/ac:opacity-100 cursor-pointer"
                                          title={isDomesticOrAdhoc ? "Edit Aircraft Details" : "Edit Aircraft & Stand"}
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
                              <div 
                                  onClick={isManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtJob(job); } : undefined}
                                  className={`hidden lg:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-3.5 py-1.5 rounded-xl border border-outline absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-sm ${
                                      isManagerOrAdmin ? 'cursor-pointer hover:border-primary/60 hover:bg-surface-dim/70 active:scale-[0.98] transition-all pointer-events-auto' : 'pointer-events-none'
                                  }`}
                                  title={isManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                              >
                                  <span className="text-warning opacity-60 text-[10px]">STD</span>
                                  <span className="text-warning text-[14px] font-black tracking-tight">{job.std || '--:--'}</span>
                                  {job.tobt && (
                                      <span className="font-mono text-amber-400 font-black text-xs bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                          TOBT {job.tobt}
                                      </span>
                                  )}
                              </div>
                          ) : (
                              <div 
                                  onClick={isManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtJob(job); } : undefined}
                                  className={`hidden lg:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-4 py-2 rounded-xl border border-outline absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-sm ${
                                      isManagerOrAdmin ? 'cursor-pointer hover:border-primary/60 hover:bg-surface-dim/70 active:scale-[0.98] transition-all pointer-events-auto' : 'pointer-events-none'
                                  }`}
                                  title={isManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                              >
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
                                  {job.tobt && (
                                      <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                          <span className="text-amber-500 text-[10px]">TOBT</span>
                                          <span className="text-amber-400 text-[13px] font-black">{job.tobt}</span>
                                      </div>
                                  )}
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
                                         className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer bg-error/10 hover:bg-error text-error hover:text-white border border-white/20 hover:border-white/40 active:scale-95"
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
                                                const matchingLog = (flightLogs || []).find(l => l && l.flightNumber === job.flightNumber && l.status === 'COMPLETED');
                                                if (matchingLog) {
                                                    openPrintInvoice(matchingLog, user);
                                                } else {
                                                    notify(`Log for ${job.flightNumber} is finalized.`, "info");
                                                }
                                            } else if (canLogFlight) {
                                                onStartJob(job);
                                            }
                                        }}
                                         className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer
                                              ${job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white' : 'kinetic-gradient text-white hover:scale-[1.05] active:scale-95 shadow-premium'}
                                         `}
                                         title={job.status === 'COMPLETED' ? 'View / Print Invoice (PDF)' : displayStatus === 'IN_PROGRESS' ? 'Resume Fueling' : 'Start Job'}
                                     >
                                         {job.status === 'COMPLETED' ? <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : <Play className="w-[18px] h-[18px] sm:w-[24px] sm:h-[24px] flex-shrink-0 ml-0.5" fill="white" color="white" strokeWidth={2.5} />}
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
                                      onClick={(e) => { e.stopPropagation(); setEditingJob(job); }}
                                      className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                      title="Edit Aircraft Details"
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
                                      <span 
                                          onClick={isManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtJob(job); } : undefined}
                                          className={`text-warning font-black text-[10px] tracking-wider whitespace-nowrap ${isManagerOrAdmin ? 'cursor-pointer hover:underline' : ''}`}
                                          title={isManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                                      >
                                          STD {job.std || '--:--'}
                                      </span>
                                  </>
                              )}
                          </div>
                      ) : (
                          /* For International: Airline Name + Reg + Type + Route */
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-on-surface-dim text-[11px] font-bold md:hidden">
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
                                      onClick={(e) => { e.stopPropagation(); setEditingJob(job); }}
                                      className="p-1 rounded-md hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                      title="Edit Aircraft & Stand"
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
                                          <div 
                                              onClick={isManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtJob(job); } : undefined}
                                              className={`flex items-center gap-1.5 shrink-0 ${isManagerOrAdmin ? 'cursor-pointer hover:opacity-80 p-0.5 rounded' : ''}`}
                                              title={isManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                                          >
                                              <span className="text-[9px] font-black text-warning/70 uppercase tracking-widest">STD</span>
                                              <span className="text-[13px] sm:text-sm font-[900] text-warning tracking-tight">{job.std || '--:--'}</span>
                                              {job.tobt && (
                                                  <span className="font-mono text-amber-400 font-black text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                                      TOBT {job.tobt}
                                                  </span>
                                              )}
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
                      <div 
                          onClick={isManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtJob(job); } : undefined}
                          className={`grid ${job.tobt ? 'grid-cols-4' : 'grid-cols-3'} gap-2 p-2.5 bg-surface-dim rounded-xl border border-outline lg:hidden ${
                              isManagerOrAdmin ? 'cursor-pointer hover:border-primary/50 transition-colors pointer-events-auto' : ''
                          }`}
                          title={isManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                      >
                          <div className="text-center border-r border-outline/30">
                              <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-0.5">STA</p>
                              <p className="text-[11px] font-[900] text-on-surface">{job.sta || '--:--'}</p>
                          </div>
                          <div className="text-center border-r border-outline/30">
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                              <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{job.eta || '--:--'}</p>
                          </div>
                          <div className={`text-center ${job.tobt ? 'border-r border-outline/30' : ''}`}>
                              <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-0.5">STD</p>
                              <p className="text-[11px] font-[900] text-warning">{job.std || '--:--'}</p>
                          </div>
                          {job.tobt && (
                              <div className="text-center">
                                  <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5">TOBT</p>
                                  <p className="text-[11px] font-[900] text-amber-400">{job.tobt}</p>
                              </div>
                          )}
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

      {editingJob && (
        <EditAircraftModal
          flightNumber={editingJob.flightNumber}
          initialType={editingJob.aircraftType}
          initialReg={editingJob.aircraftReg}
          initialStand={editingJob.stand}
          isDomestic={editingJob.isDomestic || isDomesticFlight(editingJob)}
          isAdhoc={(editingJob as any).isAdhoc}
          onClose={() => setEditingJob(null)}
          onSave={async (newType, newReg, newStand) => {
            try {
              const jobId = editingJob.id || ((flightJobs || []).find(j => j.flightNumber === editingJob.flightNumber)?.id);
              const updates: any = {
                aircraftType: newType,
                aircraftReg: newReg,
                flightNumber: editingJob.flightNumber,
                date: editingJob.date || selectedBriefingDate,
                userEditedAircraftType: true
              };
              if (newStand !== undefined) {
                updates.stand = newStand;
              }
              if (jobId) {
                await updateFlightJob(jobId, updates);
              }
              if (activeFlight && (activeFlight.id === editingJob.id || activeFlight.flightNumber === editingJob.flightNumber)) {
                activeFlight.aircraftType = newType;
                activeFlight.aircraftReg = newReg;
                if (newStand !== undefined) {
                  activeFlight.stand = newStand;
                }
              }
              const standMsg = newStand ? `, Stand ${newStand}` : '';
              notify(`Flight ${editingJob.flightNumber} updated: ${newType}${newReg ? ` (${newReg})` : ''}${standMsg}`, 'success');
              setEditingJob(null);
            } catch (err) {
              console.error(err);
              notify('Failed to update flight details', 'error');
            }
          }}
        />
      )}

      {editingFrtJob && (user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && (
        <EditFuelRequestModal
          flight={editingFrtJob}
          onClose={() => setEditingFrtJob(null)}
          onSave={async (updates) => {
            await handleSaveCardFrt(editingFrtJob, updates);
          }}
        />
      )}
    </div>
  );
};

const NumpadTimeInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, disabled, className }) => {
  const [localVal, setLocalVal] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(value || '');
    }
  }, [value, isFocused]);

  // Also sync if value was cleared or set externally while focused via button tap
  useEffect(() => {
    if (value !== localVal && (value === '' || (value && value.length === 5 && localVal.replace(/\D/g, '').length !== 4))) {
      setLocalVal(value || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length === 0) {
      setLocalVal('');
      if (value) onChange('');
      return;
    }

    const formatted = digits.length >= 3
      ? `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
      : digits;
    setLocalVal(formatted);

    if (digits.length === 4) {
      const hh = Math.min(23, parseInt(digits.slice(0, 2), 10));
      const mm = Math.min(59, parseInt(digits.slice(2, 4), 10));
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      setLocalVal(validTime);
      onChange(validTime);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const digits = localVal.replace(/\D/g, '');
    if (digits.length === 0) {
      if (value) onChange('');
      setLocalVal('');
      return;
    }
    if (digits.length === 3) {
      const hh = Math.min(23, parseInt(`0${digits[0]}`, 10));
      const mm = Math.min(59, parseInt(digits.slice(1, 3), 10));
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      setLocalVal(validTime);
      onChange(validTime);
      return;
    }
    if (digits.length === 4) {
      const hh = Math.min(23, parseInt(digits.slice(0, 2), 10));
      const mm = Math.min(59, parseInt(digits.slice(2, 4), 10));
      const validTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      setLocalVal(validTime);
      onChange(validTime);
      return;
    }
    // Incomplete 1-2 digits on blur: revert to external value
    setLocalVal(value || '');
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9:]*"
      maxLength={5}
      placeholder="HH:MM"
      disabled={disabled}
      value={localVal}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
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
  const { notify } = useNotification();
  const { selectedBriefingDate, isTicketAutoEnabled, previewNextTicketNumber } = useOperationalData();
  const isAutoJetA1 = isTicketAutoEnabled('JET_A1');
  const isAutoPaper = isTicketAutoEnabled('PAPER_OFFLINE');
  const [isPaperMode, setIsPaperMode] = useState<boolean>(() => {
    return !!(activeFlight?.deliveryNumber && activeFlight.deliveryNumber.startsWith('MLE-P-'));
  });
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const isHdVehicle = !!(activeFlight?.vehicleId?.startsWith('HD') || activeFlight?.equipmentUsage === 'HYDRANT');
  const isTypeValid = !!(activeFlight?.aircraftType && activeFlight.aircraftType.trim().length >= 2);
  const cleanReg = activeFlight?.aircraftReg?.trim();
  const isRegValid = !!(cleanReg && cleanReg.length >= 3 && cleanReg !== '8Q-TBA' && !cleanReg.startsWith('8Q-DOM'));
  const cleanPit = activeFlight?.pitNumber?.trim();
  const isPitValid = !isHdVehicle || !!(cleanPit && cleanPit !== 'J' && cleanPit.length >= 3);
  const isDeliveryValid = isAutoJetA1 || (!!activeFlight?.deliveryNumber && activeFlight.deliveryNumber.replace(/^MLE-(P-)?/i, '').length >= 4);
  const isGammaValid = !!activeFlight?.timestampStart;

  const isFormValid = isReadOnly(user.role) || (isTypeValid && isRegValid && isPitValid && isDeliveryValid && isGammaValid);

  const handleProceed = () => {
    if (isReadOnly(user.role)) {
      onNext();
      return;
    }

    setShowValidationErrors(true);

    if (!isTypeValid) {
      notify('Please enter a valid Aircraft Type (e.g. A320, B737) before proceeding.', 'warning');
      return;
    }

    if (!isRegValid) {
      notify('Please enter a valid Aircraft Registration (e.g. 8Q-IAI, A6-EEO) before proceeding.', 'warning');
      return;
    }

    if (!isDeliveryValid) {
      notify('Please enter a valid Delivery Ticket Number (minimum 4 digits) before proceeding.', 'warning');
      return;
    }

    if (isHdVehicle && !isPitValid) {
      notify('Please enter or select a Hydrant PIT Number (e.g. J120-1) for this Hydrant Dispenser.', 'warning');
      return;
    }

    if (!isGammaValid) {
      notify('Please log Operation Gamma (Commenced Pumping) before proceeding to metering.', 'warning');
      return;
    }

    onNext();
  };

  useEffect(() => {
    if (isAutoJetA1 && !activeFlight?.deliveryNumber) {
      const initialTicket = previewNextTicketNumber('JET_A1');
      onInputChange('deliveryNumber', initialTicket);
    }
  }, [isAutoJetA1, activeFlight?.deliveryNumber, previewNextTicketNumber, onInputChange]);

  const handleTogglePaperMode = (enabled: boolean) => {
    setIsPaperMode(enabled);
    if (enabled) {
      if (isAutoPaper) {
        onInputChange('deliveryNumber', previewNextTicketNumber('PAPER_OFFLINE'));
      } else {
        onInputChange('deliveryNumber', 'MLE-P-');
      }
    } else {
      if (isAutoJetA1) {
        onInputChange('deliveryNumber', previewNextTicketNumber('JET_A1'));
      } else {
        onInputChange('deliveryNumber', '');
      }
    }
  };
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
                          <div className="flex justify-between items-center mb-1.5">
                              <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">
                                  Aircraft Type <span className="text-error font-black">*</span>
                              </span>
                              {showValidationErrors && !isTypeValid && (
                                  <span className="text-[9px] font-bold text-error flex items-center gap-1 animate-in fade-in">
                                      <AlertCircle className="w-3 h-3" /> Required
                                  </span>
                              )}
                          </div>
                          <input
                              type="text"
                              required
                              placeholder="e.g. B737, A320"
                              value={activeFlight?.aircraftType || ''}
                              onChange={(e) => onInputChange('aircraftType', e.target.value.toUpperCase())}
                              className={`w-full px-4 py-3 bg-surface-dim border rounded-2xl text-[12px] font-black uppercase tracking-wider focus:ring-4 outline-none transition-all ${
                                  showValidationErrors && !isTypeValid 
                                      ? 'border-error focus:ring-error/15 text-error placeholder:text-error/30 ring-1 ring-error/30' 
                                      : 'border-outline focus:ring-primary/10 focus:border-primary text-on-surface'
                              }`}
                          />
                      </div>
                      <div>
                          <div className="flex justify-between items-center mb-1.5">
                              <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">
                                  Aircraft Registration <span className="text-error font-black">*</span>
                              </span>
                              {showValidationErrors && !isRegValid && (
                                  <span className="text-[9px] font-bold text-error flex items-center gap-1 animate-in fade-in">
                                      <AlertCircle className="w-3 h-3" /> Required
                                  </span>
                              )}
                          </div>
                          <input
                              type="text"
                              required
                              placeholder="e.g. 8Q-IAI, A6-EEO"
                              value={activeFlight?.aircraftReg && activeFlight.aircraftReg !== '8Q-TBA' && !activeFlight.aircraftReg.startsWith('8Q-DOM') ? activeFlight.aircraftReg : ''}
                              onChange={(e) => onInputChange('aircraftReg', e.target.value.toUpperCase())}
                              onBlur={(e) => {
                                  const normalized = normalizeRegistration(e.target.value.toUpperCase());
                                  if (normalized && normalized !== e.target.value) {
                                      onInputChange('aircraftReg', normalized);
                                  }
                              }}
                              className={`w-full px-4 py-3 bg-surface-dim border rounded-2xl text-[12px] font-black uppercase tracking-wider focus:ring-4 outline-none transition-all ${
                                  showValidationErrors && !isRegValid 
                                      ? 'border-error focus:ring-error/15 text-error placeholder:text-error/30 ring-1 ring-error/30' 
                                      : 'border-outline focus:ring-primary/10 focus:border-primary text-primary'
                              }`}
                          />
                      </div>
                  </div>
              </div>
          </div>

          <div className="card-premium p-6 border-outline overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">
                      Delivery Ticket Number
                    </label>
                    {isAutoJetA1 && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        isPaperMode ? 'bg-success/10 text-success border border-success/20' : 'bg-primary/10 text-primary border border-primary/20'
                      }`}>
                        {isPaperMode ? 'AUTO: PAPER TICKET' : 'AUTO-GENERATED: JET A-1'}
                      </span>
                    )}
                  </div>

                  {/* Option to toggle Paper / Offline Ticket */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-on-surface-dim hover:text-on-surface transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={isPaperMode}
                      disabled={isReadOnly(user.role)}
                      onChange={e => handleTogglePaperMode(e.target.checked)}
                      className="rounded border-outline text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Paper / Offline Ticket</span>
                  </label>
              </div>

              {isAutoJetA1 && !isPaperMode ? (
                <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                  <div className="text-4xl sm:text-5xl font-mono font-black text-error">
                    {activeFlight?.deliveryNumber || previewNextTicketNumber('JET_A1')}
                  </div>
                  <span className="text-[9px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline shrink-0">
                    System Assigned
                  </span>
                </div>
              ) : isPaperMode && isAutoPaper ? (
                <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                  <div className="text-4xl sm:text-5xl font-mono font-black text-success">
                    {activeFlight?.deliveryNumber || previewNextTicketNumber('PAPER_OFFLINE')}
                  </div>
                  <span className="text-[9px] font-black text-success/80 uppercase tracking-widest bg-success/10 px-3 py-1.5 rounded-xl border border-success/20 shrink-0">
                    Auto Paper Series
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 max-w-full overflow-hidden">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">
                      {isPaperMode ? 'MLE-P-' : 'MLE-'}
                    </span>
                    <input 
                        type="text" 
                        maxLength={isPaperMode ? 8 : 6}
                        disabled={isReadOnly(user.role)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-error placeholder:text-error/20"
                        placeholder="000000"
                        value={
                          isPaperMode
                            ? (activeFlight?.deliveryNumber?.replace(/^MLE-P-/i, '') || '')
                            : (activeFlight?.deliveryNumber?.replace(/^MLE-/i, '') || '')
                        }
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            const prefix = isPaperMode ? 'MLE-P-' : 'MLE-';
                            onInputChange('deliveryNumber', val ? `${prefix}${val}` : '');
                        }}
                    />
                </div>
              )}
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

          {isHdVehicle && (
            <div className={`card-premium p-6 border-2 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 ${
                showValidationErrors && !isPitValid ? 'border-error/60 bg-error/5' : 'border-outline'
            }`}>
                <div className="flex justify-between items-center mb-4">
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">
                        Hydrant PIT Number <span className="text-error font-black">*</span>
                    </label>
                    {showValidationErrors && !isPitValid && (
                        <span className="text-[10px] font-bold text-error flex items-center gap-1 animate-in fade-in">
                            <AlertCircle className="w-3.5 h-3.5" /> PIT Number is required
                        </span>
                    )}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                        <span className={`text-2xl sm:text-3xl font-mono font-black shrink-0 ${
                            showValidationErrors && !isPitValid ? 'text-error opacity-60' : 'text-primary opacity-30'
                        }`}>J</span>
                        <input 
                            type="text" 
                            disabled={isReadOnly(user.role)}
                            className={`flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 transition-all uppercase ${
                                showValidationErrors && !isPitValid 
                                    ? 'border-error text-error placeholder:text-error/20' 
                                    : 'border-outline focus:border-primary text-primary placeholder:text-primary/10'
                            }`}
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
                    {activeFlight?.stand && !isReadOnly(user.role) && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {PIT_MAPPING.filter(m => m.stand === activeFlight.stand).map((m, idx) => {
                                const isSelected = activeFlight?.pitNumber === m.pit;
                                return (
                                    <button 
                                        key={idx}
                                        onClick={() => onInputChange('pitNumber', m.pit)}
                                        className={`px-3.5 py-2 rounded-xl text-[11px] font-black tracking-wider border transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'kinetic-gradient text-white border-transparent shadow-md scale-[1.03]' 
                                                : 'bg-surface-container-low text-primary border-primary/20 hover:bg-primary/10'
                                        }`}
                                    >
                                        {m.pit}
                                    </button>
                                );
                            })}
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
                    {(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && onEditFrt && (
                      <button
                        type="button"
                        onClick={() => onEditFrt && onEditFrt()}
                        className="px-1.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                        title="Edit Departure & Fuel Request Timings"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
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
                  (user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && onEditFrt ? (
                    <button
                      type="button"
                      onClick={() => onEditFrt && onEditFrt()}
                      className="px-2.5 py-1 bg-surface-dim hover:bg-surface-container rounded-lg border border-outline text-[10px] text-on-surface-dim hover:text-on-surface font-bold transition-colors cursor-pointer"
                    >
                      + Add FRT
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-on-surface-dim opacity-40 italic">
                      No FRT recorded
                    </span>
                  )
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
                          ? 'bg-success/5 border-success text-on-surface hover:border-error/40' 
                          : isReadOnly(user.role)
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <div className="flex items-center justify-between">
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Alpha</span>
                          {activeFlight?.timestampArrived && !isReadOnly(user.role) && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-error opacity-60 group-hover:opacity-100 transition-opacity">
                                  Tap to undo
                              </span>
                          )}
                      </div>
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
                      <NumpadTimeInput 
                          disabled={isReadOnly(user.role)}
                          value={activeFlight?.timestampArrived ? getLocalTimeValue(activeFlight.timestampArrived) : ''}
                          onChange={(val) => setManualTime('timestampArrived', val)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30"
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
                          ? 'bg-success/5 border-success text-on-surface hover:border-error/40' 
                          : (!activeFlight?.timestampArrived || isReadOnly(user.role))
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <div className="flex items-center justify-between">
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Beta</span>
                          {activeFlight?.timestampPosition && !isReadOnly(user.role) && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-error opacity-60 group-hover:opacity-100 transition-opacity">
                                  Tap to undo
                              </span>
                          )}
                      </div>
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
                      <NumpadTimeInput 
                          disabled={!activeFlight?.timestampArrived || isReadOnly(user.role)}
                          value={activeFlight?.timestampPosition ? getLocalTimeValue(activeFlight.timestampPosition) : ''}
                          onChange={(val) => setManualTime('timestampPosition', val)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30 disabled:opacity-40"
                      />
                  </div>
              </div>
          </div>

          {/* Operation Gamma (Commenced Pumping) */}
          <div className="flex gap-4 items-stretch w-full">
              <button 
                  onClick={() => onTimestamp('timestampStart')}
                  disabled={!activeFlight?.timestampPosition || isReadOnly(user.role)}
                  className={`flex-1 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                      ${activeFlight?.timestampStart 
                          ? 'bg-success/5 border-success text-on-surface hover:border-error/40' 
                          : (!activeFlight?.timestampPosition || isReadOnly(user.role))
                              ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                              : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                  `}
              >
                  <div className="relative z-10">
                      <div className="flex items-center justify-between">
                          <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Gamma</span>
                          {activeFlight?.timestampStart && !isReadOnly(user.role) && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-error opacity-60 group-hover:opacity-100 transition-opacity">
                                  Tap to undo
                              </span>
                          )}
                      </div>
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
                      <NumpadTimeInput 
                          disabled={!activeFlight?.timestampPosition || isReadOnly(user.role)}
                          value={activeFlight?.timestampStart ? getLocalTimeValue(activeFlight.timestampStart) : ''}
                          onChange={(val) => setManualTime('timestampStart', val)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30 disabled:opacity-40"
                      />
                  </div>
              </div>
          </div>
      </div>

      {showValidationErrors && !isFormValid && !isReadOnly(user.role) && (
        <div className="mt-6 p-4 rounded-2xl bg-error/10 border border-error/30 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-error uppercase tracking-wider block">Required Information Missing</span>
            <ul className="list-disc list-inside text-on-surface-dim font-medium space-y-0.5 text-[11px]">
              {!isTypeValid && <li>Aircraft Type is required (e.g. A320, B737)</li>}
              {!isRegValid && <li>Aircraft Registration is required and cannot be TBA (e.g. 8Q-IAI)</li>}
              {isHdVehicle && !isPitValid && <li>Hydrant PIT Number is required for Hydrant Dispensers (e.g. J120-1)</li>}
              {!isDeliveryValid && <li>Delivery Ticket Number is required (min. 4 digits)</li>}
              {!isGammaValid && <li>Operation Gamma (Commenced Pumping) must be logged</li>}
            </ul>
          </div>
        </div>
      )}

      <button 
          onClick={handleProceed}
          className={`mt-6 w-full text-white p-4 lg:p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center active:scale-95 transition-all shadow-premium cursor-pointer ${
            isFormValid 
              ? 'kinetic-gradient hover:opacity-95' 
              : 'bg-gradient-to-r from-slate-700 to-slate-800 opacity-90 hover:opacity-100 border border-outline'
          }`}
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

          {/* Metering Metrics: PSI & LPM (Placed above INITIAL END) */}
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
                      <NumpadTimeInput 
                          disabled={activeFlight?.meterOpen === undefined || isReadOnly(user.role)}
                          value={activeFlight?.timestampInitialEnd ? getLocalTimeValue(activeFlight.timestampInitialEnd) : ''}
                          onChange={(val) => setManualTime('timestampInitialEnd', val)}
                          className="w-full text-center px-3 py-2 bg-surface-dim border border-outline rounded-xl text-sm font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30 disabled:opacity-40"
                      />
                  </div>
              </div>
          </div>

          {/* Register Top-Up Event (Placed above Manual Volume Entry) */}
          <div className="pt-2">
               <button 
                   type="button"
                   onClick={() => { if (!isReadOnly(user.role)) setShowTopUp(!showTopUp); }} 
                   disabled={isReadOnly(user.role)}
                   className={`w-full p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                     showTopUp || activeFlight?.timestampFinalStart || activeFlight?.timestampFinalEnd
                       ? 'bg-primary/10 border-primary/50 text-primary shadow-sm'
                       : 'bg-surface-dim/40 hover:bg-primary/5 border-dashed border-primary/30 hover:border-primary/60 text-on-surface'
                   }`}
               >
                   <div className="flex items-center gap-3.5 text-left">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                         showTopUp || activeFlight?.timestampFinalStart || activeFlight?.timestampFinalEnd
                           ? 'kinetic-gradient text-white shadow-sm'
                           : 'bg-primary/10 text-primary group-hover:scale-105'
                       }`}>
                           <Zap className="w-5 h-5" />
                       </div>
                       <div>
                           <span className="block text-xs sm:text-sm font-[900] uppercase tracking-wider text-on-surface group-hover:text-primary transition-colors">
                               {showTopUp ? 'Hide Top-Up Event' : 'Register Top-Up Event'}
                           </span>
                           <span className="block text-[9px] font-bold uppercase tracking-widest text-on-surface-dim opacity-60 mt-0.5">
                               {activeFlight?.timestampFinalStart || activeFlight?.timestampFinalEnd
                                 ? 'Secondary pumping timestamps recorded'
                                 : 'Optional secondary fueling start & end timestamps'}
                           </span>
                       </div>
                   </div>
                   <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0 ${
                     showTopUp
                       ? 'bg-surface border-outline text-on-surface-dim'
                       : 'bg-primary/15 border-primary/30 text-primary group-hover:bg-primary group-hover:text-white'
                   }`}>
                       {showTopUp ? 'Collapse' : '+ Add Top-Up'}
                   </div>
               </button>
               {showTopUp && (
                    <div className="space-y-4 mt-4 p-4 sm:p-5 rounded-3xl bg-surface-dim/25 border border-outline/50 animate-in fade-in slide-in-from-top-4 duration-300">
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
                                    <NumpadTimeInput 
                                        disabled={isReadOnly(user.role)}
                                        value={activeFlight?.timestampFinalStart ? getLocalTimeValue(activeFlight.timestampFinalStart) : ''}
                                        onChange={(val) => setManualTime('timestampFinalStart', val)}
                                        className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30"
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
                                    <NumpadTimeInput 
                                        disabled={isReadOnly(user.role)}
                                        value={activeFlight?.timestampFinalEnd ? getLocalTimeValue(activeFlight.timestampFinalEnd) : ''}
                                        onChange={(val) => setManualTime('timestampFinalEnd', val)}
                                        className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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

  const isSignatureValid = !!activeFlight?.signatureDataUrl && !!activeFlight?.signerName?.trim();
  const isQcValid = !!activeFlight?.panelCheck && !!activeFlight?.walkAroundCheck && !!activeFlight?.appearanceCheck && !!activeFlight?.waterCheck;

  return (
    <div className="p-1 sm:p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
        <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors px-2 sm:px-0">
           <ChevronLeft className="w-4 h-4 mr-2" /> Back to Metering
        </button>
        <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase px-2 sm:px-0">JIG <span className="text-primary italic">Compliance Protocol</span></h2>

        <div className="space-y-6 p-2 sm:p-8 sm:card-premium sm:border sm:border-outline sm:shadow-inner bg-transparent sm:bg-surface-container-lowest rounded-none sm:rounded-3xl border-0">
           <div className="space-y-4">
             {['panelCheck', 'walkAroundCheck', 'appearanceCheck', 'waterCheck'].map((check) => {
                 const isChecked = !!activeFlight?.[check as keyof FlightLog];
                 const isDisabled = isReadOnly(user.role);
                 const details = qcCheckDetails[check];

                 return (
                     <label 
                         key={check} 
                         className={`flex items-center p-4 sm:p-5 rounded-2xl border-2 transition-all 
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
                         <div className="ml-4 sm:ml-5">
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

            {/* Customer / Flight Crew Full-Screen Signature & Declaration */}
            <div className="pt-6 border-t border-outline/40">
              <SignatureAcknowledgment
                fullScreenSection={true}
                signerName={activeFlight?.signerName || ''}
                onSignerNameChange={(val) => onInputChange('signerName', val.toUpperCase())}
                signerDesignation={activeFlight?.signerDesignation || ''}
                onSignerDesignationChange={(val) => onInputChange('signerDesignation', val)}
                signerEmail={activeFlight?.signerEmail || ''}
                onSignerEmailChange={(val) => onInputChange('signerEmail', val)}
                signatureDataUrl={activeFlight?.signatureDataUrl || null}
                onSignatureChange={(val) => {
                  onInputChange('signatureDataUrl', val);
                  onInputChange('signedAt', val ? new Date().toISOString() : undefined);
                  onInputChange('declarationConfirmed', !!val);
                }}
                disabled={isReadOnly(user.role)}
                designationPresets={[
                  'Captain (PIC)',
                  'First Officer',
                  'Aircraft Maintenance Engineer',
                  'Ground Handler Rep'
                ]}
                declarationText="I hereby acknowledge and certify receipt of the specified fuel volume into the aircraft. All quality control procedures, meter readings, and safety clearances have been verified and accepted."
                title="Customer / Flight Crew Acknowledgment"
                subtitle="Official Into-Plane Fueling Certification"
              />
            </div>

           {/* Operation Clearance (Log Clearance Time) — Placed after Signature Section */}
           <div className="pt-6 border-t border-outline/40">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-3 opacity-50">
                 Safety & Ramp Clearance Milestone
              </label>
              <div className="flex gap-3 sm:gap-4 items-stretch w-full">
                  <button 
                      type="button"
                      onClick={() => onTimestamp ? onTimestamp('timestampClearance') : undefined}
                      disabled={isReadOnly(user.role)}
                      className={`flex-1 p-4 sm:p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group
                          ${activeFlight?.timestampClearance 
                              ? 'bg-success/5 border-success text-on-surface' 
                              : isReadOnly(user.role)
                                  ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                                  : 'bg-surface-container-lowest border-outline hover:border-primary active:scale-[0.98]'}
                      `}
                  >
                      <div className="relative z-10">
                          <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-1">Safety Milestone</span>
                          <span className={`block text-base sm:text-xl font-[900] tracking-tighter ${activeFlight?.timestampClearance ? 'text-success' : 'text-on-surface'}`}>
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
                  <div className="card-premium p-3 sm:p-4 border-outline flex flex-col justify-center items-center w-32 sm:w-44 shrink-0">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-2 text-center">Manual Time</span>
                      <div className="relative w-full">
                          <NumpadTimeInput 
                              disabled={isReadOnly(user.role)}
                              value={activeFlight?.timestampClearance && getLocalTimeValue ? getLocalTimeValue(activeFlight.timestampClearance) : ''}
                              onChange={(val) => setManualTime ? setManualTime('timestampClearance', val) : undefined}
                              className="w-full text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono font-black focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-on-surface placeholder:text-on-surface-dim/30"
                          />
                      </div>
                  </div>
              </div>
           </div>
        </div>

        <div className="mt-auto pt-6 sm:pt-10 space-y-4 sm:space-y-6 px-2 sm:px-0">
            <div className="bg-warning/5 border border-warning/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex items-start">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-warning mr-3 sm:mr-4 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[11px] font-bold text-on-surface opacity-60 leading-relaxed uppercase tracking-widest">Digital certification required. By committing, you verify JIG compliance, fuel appearance checks, and representative signature are complete.</p>
            </div>
            
            {isReadOnly(user.role) ? (
               <button 
                  onClick={onClose}
                  className="w-full bg-surface-lowest text-on-surface-dim border border-outline font-[900] text-[14px] lg:text-[15px] uppercase tracking-[0.3em] flex items-center justify-center p-5 lg:p-7 rounded-3xl shadow-premium hover:bg-surface-container hover:text-primary transition-all active:scale-95"
               >
                  Return to Dashboard
               </button>
            ) : (
               <div className="space-y-2">
                 <button 
                    onClick={onSubmit}
                    disabled={loading || !isQcValid || !isSignatureValid}
                    className="w-full kinetic-gradient p-5 lg:p-7 rounded-2xl sm:rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale shadow-premium active:scale-95 transition-all text-white cursor-pointer"
                 >
                    {loading ? 'ENCRYPTING & SYNCING...' : (
                        <>
                            <Save className="w-5 h-5 lg:w-6 lg:h-6 mr-3 sm:mr-4" />
                            AUTHORIZE TASK COMPLETE
                        </>
                    )}
                 </button>
                 {!isSignatureValid && (
                    <div className="flex items-center justify-center gap-2 text-amber-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-center py-1 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Customer / Flight Crew signature and full name are required to authorize</span>
                    </div>
                 )}
               </div>
            )}
        </div>
   </div>
  );
};

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user, initialJob, onClearInitialJob, initialVehicleId, onClearInitialVehicleId, setActiveView }) => {
  const { notify } = useNotification();
  const { resolveCustomerByFlightOrAirline } = useFinanceData();
  const { equipment, flightJobs, rawFlightJobs, flightLogs, updateEquipmentStatus, updateEquipment, createAlert, updateFlightJob, updateFlightLog, externalFlights, staff, refreshData, selectedBriefingDate, tanks, updateTankLevel, serviceTankId, briefingInfo, internationalSchedules, addFlightLogEntry, isTicketAutoEnabled, generateTicketNumber } = useOperationalData();
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(() => {
    try {
      const saved = localStorage.getItem(`fms_active_flight_${user?.id || ''}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        const flightDate = parsed?.operationalDate || (parsed?.timestampStart ? parsed.timestampStart.split('T')[0] : '');
        if (flightDate && flightDate !== today) {
          localStorage.removeItem(`fms_active_flight_${user?.id || ''}`);
          return null;
        }
        return parsed;
      }
      return null;
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
  const [completedInvoiceLog, setCompletedInvoiceLog] = useState<FlightLog | null>(null);
  const [invoiceModalEmail, setInvoiceModalEmail] = useState<string>('');
  const [prebuiltInvoicePdf, setPrebuiltInvoicePdf] = useState<File | null>(null);
  const [isSharingPdf, setIsSharingPdf] = useState<boolean>(false);
  const [showInvoiceEmailModal, setShowInvoiceEmailModal] = useState<boolean>(false);
  const invoiceEmailInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showEditActiveFlight, setShowEditActiveFlight] = useState(false);
  const [showEditActiveFrt, setShowEditActiveFrt] = useState(false);

  const activeAccountResolution = useMemo(() => {
    if (!activeFlight?.flightNumber && !activeFlight?.aircraftReg && !activeFlight?.airline && !activeFlight?.co) {
      return { customer: undefined, airlineHolding: undefined, emails: [] as string[] };
    }
    return resolveCustomerByFlightOrAirline(
      activeFlight.flightNumber,
      activeFlight.airline,
      activeFlight.aircraftReg,
      activeFlight.co
    );
  }, [activeFlight?.flightNumber, activeFlight?.airline, activeFlight?.aircraftReg, activeFlight?.co, resolveCustomerByFlightOrAirline]);

  const completedAccountResolution = useMemo(() => {
    if (!completedInvoiceLog) {
      return { customer: undefined, airlineHolding: undefined, emails: [] as string[] };
    }
    return resolveCustomerByFlightOrAirline(
      completedInvoiceLog.flightNumber,
      completedInvoiceLog.airline,
      completedInvoiceLog.aircraftReg,
      completedInvoiceLog.co
    );
  }, [completedInvoiceLog, resolveCustomerByFlightOrAirline]);

  // Auto-populate signerEmail from the customer account's airline email directory if empty
  useEffect(() => {
    if (activeFlight && !activeFlight.signerEmail && activeAccountResolution.emails.length > 0) {
      setActiveFlight(prev => prev && !prev.signerEmail ? { ...prev, signerEmail: activeAccountResolution.emails[0] } : prev);
    }
  }, [activeFlight?.flightNumber, activeFlight?.aircraftReg, activeAccountResolution.emails]);

  // Pre-generate the .pdf File as soon as the Delivery Invoice Ready modal opens so Share / Email is instant
  useEffect(() => {
    if (completedInvoiceLog) {
      const defaultEmail = completedInvoiceLog.signerEmail || completedAccountResolution.emails[0] || '';
      setInvoiceModalEmail(defaultEmail);
      setPrebuiltInvoicePdf(null);
      generateInvoicePdfFile(completedInvoiceLog, user)
        .then(file => setPrebuiltInvoicePdf(file))
        .catch(err => console.warn('[IntoPlane] Prebuild invoice PDF warning:', err));
    } else {
      setPrebuiltInvoicePdf(null);
    }
  }, [completedInvoiceLog?.id, completedInvoiceLog?.deliveryNumber, user, completedAccountResolution.emails]);

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
        const timer = setTimeout(() => {
          startJob(initialJob, vehicleToUse);
          if (onClearInitialJob) onClearInitialJob();
          if (onClearInitialVehicleId) onClearInitialVehicleId();
        }, 0);
        return () => clearTimeout(timer);
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

  const [showTopUp, setShowTopUp] = useState<boolean>(() => !!(activeFlight?.timestampFinalStart || activeFlight?.timestampFinalEnd));
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
    if (activeFlight && activeFlight.flightNumber) {
      try {
        localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify(activeFlight));
        const normNo = (activeFlight.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const fDate = activeFlight.operationalDate || selectedBriefingDate || new Date().toISOString().split('T')[0];
        if (normNo) {
          localStorage.setItem(`fms_flight_draft_${normNo}_${fDate}`, JSON.stringify(activeFlight));
        }
      } catch {}
    }
  }, [activeFlight, user?.id, selectedBriefingDate]);

  // Always scroll to top when proceeding between flight job pages
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTop = 0;
        mainEl.scrollTo?.({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      }
    } catch {}
  }, [currentScreen]);

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

  const cancelActiveFlightJob = async (targetJob?: FlightJob) => {
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
    const normFlightNo = rawFlightNo.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const knownJobId = (jobToCancel as any)?.jobId || (jobToCancel as any)?.id || (currentActive as any)?.jobId || (currentActive as any)?.id || currentJobInfo?.jobId;
    const targetFlightDate = (jobToCancel as any)?.date ? (jobToCancel as any).date.split('T')[0] : (currentActive?.operationalDate || selectedBriefingDate);

    // 3. Clear active flight state and matching sessions from localStorage
    try {
      localStorage.removeItem(`fms_active_flight_${user?.id || ''}`);
      if (normFlightNo) {
        localStorage.removeItem(`fms_flight_draft_${normFlightNo}_${targetFlightDate}`);
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('fms_active_flight_') || key.startsWith('fms_flight_draft_'))) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed && normFlightNo && (parsed.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase() === normFlightNo) {
                localStorage.removeItem(key);
              }
            } catch {}
          }
        }
      }
    } catch {}

    const currentActiveNo = (currentActive?.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!validTargetJob || (currentActiveNo && (!normFlightNo || currentActiveNo === normFlightNo)) || !currentActiveNo) {
      activeJobRef.current = null;
      activeFlightRef.current = null;
      setActiveFlight(null);
    }

    // 4. Match ALL corresponding jobs in memory for this flight & date
    const allJobs = flightJobsRef.current || flightJobs || [];
    const rawJobs = rawFlightJobs || [];
    const pool = [...allJobs, ...rawJobs];
    
    const matchingJobs = pool.filter(j => {
      if (!j) return false;
      if (knownJobId && j.id === knownJobId) return true;
      const jNorm = (j.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (!normFlightNo || jNorm !== normFlightNo) return false;
      const jDate = j.date ? j.date.split('T')[0] : '';
      return !jDate || !targetFlightDate || jDate === targetFlightDate;
    });

    const targetIdsToUpdate = new Set<string>();
    if (knownJobId) targetIdsToUpdate.add(knownJobId);
    matchingJobs.forEach(j => { if (j.id) targetIdsToUpdate.add(j.id); });
    if (targetIdsToUpdate.size === 0 && normFlightNo) {
      targetIdsToUpdate.add(`fj-${normFlightNo}`);
    }

    // Update in React context (updates flightJobs, rawFlightJobs, briefingInfo.staffAssignments.frozenFlights)
    for (const jId of targetIdsToUpdate) {
      updateFlightJobRef.current(jId, { 
        status: 'PENDING', 
        vehicleId: '',
        flightNumber: rawFlightNo,
        date: targetFlightDate
      });
    }

    // 5. Update in Supabase across all matching IDs
    for (const jId of targetIdsToUpdate) {
      try {
        await supabaseService.updateFlightJob(jId, {
          status: 'PENDING',
          vehicleId: '',
          flightNumber: rawFlightNo,
          date: targetFlightDate
        });
      } catch (err) {
        console.warn('[IntoPlane] Direct revert to Supabase warning for id:', jId, err);
      }
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
      if (activeFlight.timestampFinalStart || activeFlight.timestampFinalEnd) {
        setShowTopUp(true);
      }
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

    // Check if there is a saved draft for this flight job on this date
    const resolvedOpDate = targetFlightDate || new Date().toISOString().split('T')[0];
    let savedDraft: Partial<FlightLog> | null = null;
    try {
      const rawDraft = normJobNo ? localStorage.getItem(`fms_flight_draft_${normJobNo}_${resolvedOpDate}`) : null;
      if (rawDraft) {
        savedDraft = JSON.parse(rawDraft);
      }
    } catch {}

    const baseReg = (job.aircraftReg && job.aircraftReg !== '8Q-TBA' && !job.aircraftReg.startsWith('8Q-DOM')) ? job.aircraftReg : ((matchingJob?.aircraftReg && matchingJob.aircraftReg !== '8Q-TBA' && !matchingJob.aircraftReg.startsWith('8Q-DOM')) ? matchingJob.aircraftReg : '');

    const flightData = {
      id: targetJobId,
      jobId: targetJobId,
      flightNumber: job.flightNumber,
      aircraftReg: savedDraft?.aircraftReg || baseReg,
      aircraftType: savedDraft?.aircraftType || cleanAircraftTypeName(job.aircraftType || matchingJob?.aircraftType || (isDomFlight ? 'ATR' : 'A320')),
      stand: savedDraft?.stand || job.stand || matchingJob?.stand || '---',
      operatorId: effectiveAssignee,
      vehicleId: activeVehicleId,
      status: 'IN_PROGRESS',
      meterOpen: savedDraft?.meterOpen !== undefined ? savedDraft.meterOpen : initialMeter,
      volume: savedDraft?.volume !== undefined ? savedDraft.volume : 0,
      psi: savedDraft?.psi,
      lpm: savedDraft?.lpm,
      deliveryNumber: savedDraft?.deliveryNumber,
      pitNumber: savedDraft?.pitNumber,
      timestampArrived: savedDraft?.timestampArrived,
      timestampPosition: savedDraft?.timestampPosition,
      timestampStart: savedDraft?.timestampStart,
      timestampInitialEnd: savedDraft?.timestampInitialEnd,
      timestampFinalStart: savedDraft?.timestampFinalStart,
      timestampFinalEnd: savedDraft?.timestampFinalEnd,
      panelCheck: savedDraft?.panelCheck ?? false,
      walkAroundCheck: savedDraft?.walkAroundCheck ?? false,
      appearanceCheck: savedDraft?.appearanceCheck ?? false,
      waterCheck: savedDraft?.waterCheck ?? false,
      remarks: savedDraft?.remarks !== undefined ? savedDraft.remarks : cleanRemarks(job.remarks || ''),
      signerName: savedDraft?.signerName,
      signerDesignation: savedDraft?.signerDesignation,
      signerEmail: savedDraft?.signerEmail,
      signatureDataUrl: savedDraft?.signatureDataUrl,
      signedAt: savedDraft?.signedAt,
      declarationConfirmed: savedDraft?.declarationConfirmed,
      isAdhoc: job.isAdhoc,
      route: job.route || matchingJob?.route,
      isDomestic: isDomFlight,
      officer: job.assignedOfficer || matchingJob?.assignedOfficer || '',
      operationalDate: resolvedOpDate,
      std: resolvedStd,
      tobt: resolvedTobt,
      frtAirline: resolvedFrtAirline,
      frtAocc: resolvedFrtAocc,
      frtFor: resolvedFrtFor,
      timestampClearance: savedDraft?.timestampClearance || job.timestampClearance,
      co: savedDraft?.co || resolvedCo,
      operatorName: savedDraft?.operatorName || resolvedOperatorName,
    };
    setShowTopUp(!!(flightData.timestampFinalStart || flightData.timestampFinalEnd));
    setActiveFlight(flightData as any);
    try {
      localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify(flightData));
      if (normJobNo) {
        localStorage.setItem(`fms_flight_draft_${normJobNo}_${resolvedOpDate}`, JSON.stringify(flightData));
      }
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
    const currentActive = activeFlightRef.current || activeFlight;
    const normNo = (currentActive?.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const fDate = currentActive?.operationalDate || selectedBriefingDate || new Date().toISOString().split('T')[0];
    try {
      localStorage.removeItem(`fms_active_flight_${user?.id || ''}`);
      if (normNo) {
        localStorage.removeItem(`fms_flight_draft_${normNo}_${fDate}`);
      }
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
    // Preserve activeFlight and draft in localStorage so resuming the flight job restores all entered data
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
        setCurrentScreen('dashboard');
        return;
      }

      const targetScreen = e.state?.itpScreen;
      if (targetScreen && ['timestamps', 'metering', 'qc'].includes(targetScreen)) {
        if (targetScreen !== currentScreen) {
          setCurrentScreen(targetScreen);
        }
      } else {
        // Popped back to dashboard (or out of ITP sub-screens) — preserve activeFlight & draft
        if (currentScreen !== 'dashboard') {
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
    
    let finalDeliveryNumber = activeFlight.deliveryNumber;
    if (isTicketAutoEnabled('JET_A1')) {
      const isPaper = activeFlight.deliveryNumber?.startsWith('MLE-P-');
      const cat = isPaper ? 'PAPER_OFFLINE' : 'JET_A1';
      const genRes = await generateTicketNumber(cat, user.name || user.id);
      if (genRes.success && genRes.ticketNumber) {
        finalDeliveryNumber = genRes.ticketNumber;
      }
    }

    if (!activeFlight.signatureDataUrl || !activeFlight.signerName?.trim()) {
      notify('Customer / Flight Crew signature and full name are required before finalizing the fueling log.', 'warning');
      return;
    }

    if (finalDeliveryNumber) {
      // Exclude any ghost optimistic entry for the currently active flight in case a prior save attempt failed
      const currentNormFn = (activeFlight.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const currentOpDate = activeFlight.operationalDate || selectedBriefingDate || new Date().toISOString().split('T')[0];
      const logsForValidation = (flightLogs || []).filter(l => {
        if (!l) return false;
        const lFn = (l.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const lDate = l.operationalDate || (l.timestampStart ? l.timestampStart.split('T')[0] : '');
        // If this is the exact same active flight on the same date being retried, don't block its own retry
        if (currentNormFn && lFn === currentNormFn && (!lDate || lDate === currentOpDate) && l.deliveryNumber === finalDeliveryNumber) {
          return false;
        }
        return true;
      });
      const ticketVal = await checkDuplicateTicketAcrossJetA1(finalDeliveryNumber, activeFlight.id, logsForValidation);
      if (ticketVal.isDuplicate) {
        notify(ticketVal.message || `Delivery ticket number ${finalDeliveryNumber} is already used. Please enter a unique ticket number.`, 'error');
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
        deliveryNumber: finalDeliveryNumber,
        pitNumber: activeFlight.pitNumber,
        co: activeFlight.co || (activeFlight.isAdhoc ? activeFlight.airline : undefined),
        isAdhoc: activeFlight.isAdhoc,
        route: savedRoute,
        isDomestic: activeFlight.isDomestic,
        intDom: isSeaplaneFlight ? 'SEA' : (activeFlight.isDomestic ? 'DOM' : 'INT'),
        airline: (activeFlight.airline && activeFlight.airline !== 'Maldivian' && activeFlight.airline !== 'N/A')
          ? activeFlight.airline
          : (activeFlight.isAdhoc
              ? (activeFlight.co || activeFlight.operatorName || 'GENERAL AVIATION')
              : (getAirlineName(activeFlight.flightNumber || '', externalFlights) || activeFlight.airline || 'N/A')),
        operationalDate: activeFlight.operationalDate || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        psi: activeFlight.psi,
        lpm: activeFlight.lpm,
        officer: resolvedOfficer,
        operatorName: resolvedOperatorName,
        tacticalOperator: resolvedTacticalOperator,
        destination: activeFlight.destination,
        paymentType: paymentType || activeFlight.paymentType || 'CREDIT',
        signatureDataUrl: activeFlight.signatureDataUrl || undefined,
        signerName: activeFlight.signerName ? activeFlight.signerName.toUpperCase() : undefined,
        signerDesignation: activeFlight.signerDesignation || undefined,
        signerEmail: activeFlight.signerEmail || undefined,
        signedAt: activeFlight.signatureDataUrl ? (activeFlight.signedAt || new Date().toISOString()) : undefined,
        declarationConfirmed: !!activeFlight.signatureDataUrl,
        invoiceSavedAt: new Date().toISOString(),
      };

      // Cache signature metadata for immediate/future invoice generation
      if (activeFlight.signatureDataUrl) {
        try {
          const sigPayload = {
            signatureDataUrl: activeFlight.signatureDataUrl,
            signerName: (activeFlight.signerName || '').toUpperCase(),
            signerDesignation: activeFlight.signerDesignation,
            signerEmail: activeFlight.signerEmail,
            signedAt: activeFlight.signedAt || new Date().toISOString()
          };
          if (finalDeliveryNumber) {
            localStorage.setItem(`fms_sig_${finalDeliveryNumber}`, JSON.stringify(sigPayload));
          }
          if (newLogId) {
            localStorage.setItem(`fms_sig_${newLogId}`, JSON.stringify(sigPayload));
          }
        } catch (e) {}
      }

      // 1. Save to BigQuery first BEFORE mutating in-memory flightLogs or marking the job COMPLETED.
      // This guarantees that if the network call fails, no ghost ticket number is left in memory.
      const savedLog = await supabaseService.createFlightLog(logToSave);

      // 2. Now that BigQuery save succeeded, push into in-memory state so user sees it right away in Log History
      if (addFlightLogEntry) {
        addFlightLogEntry({ ...savedLog });
      }

      // 3. Collect auxiliary inventory & job completion promises
      const auxPromises: Promise<any>[] = [];

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
      const completionFlightDate = logToSave.operationalDate || activeFlight.operationalDate || selectedBriefingDate;
      if (completedJobId) {
        auxPromises.push(updateFlightJob(completedJobId, { 
          status: 'COMPLETED',
          flightNumber: activeFlight.flightNumber,
          date: completionFlightDate,
          timestampClearance: logToSave.timestampClearance,
          vehicleId: selectedVehicleId,
          deliveryNumber: finalDeliveryNumber,
          std: resolvedStd || activeFlight.std || undefined,
          tobt: resolvedTobt || activeFlight.tobt || undefined,
          frtAirline: resolvedFrtAirline || activeFlight.frtAirline || undefined,
          frtAocc: resolvedFrtAocc || activeFlight.frtAocc || undefined,
          frtFor: resolvedFrtFor || activeFlight.frtFor || undefined
        }));

        // Direct update to Supabase for immediate cross-module sync
        supabaseService.updateFlightJob(completedJobId, {
          status: 'COMPLETED',
          flightNumber: activeFlight.flightNumber,
          date: completionFlightDate,
          vehicleId: selectedVehicleId,
          deliveryNumber: finalDeliveryNumber
        }).catch(e => console.warn('[IntoPlane] Direct completion update to Supabase warning:', e));
      }

      await Promise.all(auxPromises);

      // Refresh in background so user doesn't wait
      refreshData().catch(e => console.warn('[IntoPlane] Background refresh failed:', e));
      const finalizedLog: FlightLog = { ...savedLog };
      try {
        finalizedLog.invoiceHtml = generateInvoiceHtml(finalizedLog, user);
      } catch (invErr) {
        console.warn('[IntoPlane] Invoice HTML generation error:', invErr);
      }
      completeOrCancelJobAndExit("Job Completed & Synced to Database!");
      setCompletedInvoiceLog(finalizedLog);
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
          onEditActiveAircraft={() => setShowEditActiveFlight(true)}
          onEditActiveStand={(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) ? () => setShowEditActiveFlight(true) : undefined}
        />

        {showEditActiveFlight && activeFlight && (
          <EditAircraftModal
            flightNumber={activeFlight.flightNumber || ''}
            initialType={activeFlight.aircraftType}
            initialReg={activeFlight.aircraftReg}
            initialStand={activeFlight.stand}
            isDomestic={isDomesticFlight(activeFlight as any) || (activeFlight as any).isDomestic}
            isAdhoc={(activeFlight as any).isAdhoc}
            onClose={() => setShowEditActiveFlight(false)}
            onSave={async (newType, newReg, newStand) => {
              setActiveFlight(prev => {
                if (!prev) return null;
                const next = { ...prev, aircraftType: newType, aircraftReg: newReg };
                if (newStand !== undefined) {
                  next.stand = newStand;
                }
                return next;
              });
              const cleanNo = (activeFlight.flightNumber || '').replace(/\s+/g, '').toLowerCase();
              const matching = (flightJobs || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
              const targetId = matching?.id || activeFlight.id || `fj-${cleanNo}-${activeFlight.operationalDate || selectedBriefingDate}`;
              const updates: any = {
                aircraftType: newType,
                aircraftReg: newReg,
                flightNumber: activeFlight.flightNumber,
                date: activeFlight.operationalDate || selectedBriefingDate,
                userEditedAircraftType: true
              };
              if (newStand !== undefined) {
                updates.stand = newStand;
              }
              await updateFlightJob(targetId, updates);
              const standMsg = newStand ? `, Stand ${newStand}` : '';
              notify(`Flight ${activeFlight.flightNumber} updated: ${newType}${newReg ? ` (${newReg})` : ''}${standMsg}`, 'success');
              setShowEditActiveFlight(false);
            }}
          />
        )}

        {showEditActiveFrt && activeFlight && (user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) && (
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
              const cleanUpdates = {
                std: updates.std !== undefined ? updates.std.trim() : undefined,
                tobt: updates.tobt !== undefined ? updates.tobt.trim() : undefined,
                frtAirline: updates.frtAirline !== undefined ? updates.frtAirline.trim() : undefined,
                frtAocc: updates.frtAocc !== undefined ? updates.frtAocc.trim() : undefined,
                frtFor: updates.frtFor !== undefined ? updates.frtFor.trim() : undefined,
              };

              // 1. Update activeFlight local state
              setActiveFlight(prev => prev ? ({ ...prev, ...cleanUpdates }) : null);
              try {
                const raw = localStorage.getItem(`fms_active_flight_${user?.id || ''}`);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  localStorage.setItem(`fms_active_flight_${user?.id || ''}`, JSON.stringify({ ...parsed, ...cleanUpdates }));
                }
              } catch {}

              // 2. Update flight_jobs table
              const rawFlight = activeFlight.flightNumber || '';
              const cleanFn = rawFlight.replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const compactFn = cleanFn.replace(/([A-Z]+)0+([0-9]+)/, '$1$2');

              const matchesFn = (fn?: string) => {
                if (!fn) return false;
                const c = fn.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                return c === cleanFn || c.replace(/([A-Z]+)0+([0-9]+)/, '$1$2') === compactFn;
              };

              const matchingJob = (flightJobs || []).find(j => 
                (activeFlight.id && j.id === activeFlight.id) ||
                matchesFn(j.flightNumber)
              );
              const targetJobId = matchingJob?.id || activeFlight.id || (activeFlight as any).jobId;
              if (targetJobId) {
                await updateFlightJob(targetJobId, cleanUpdates);
              }

              // 3. Retrospectively sync with saved flight log if any exists
              const matchingLogs = (flightLogs || []).filter(l => 
                l && matchesFn(l.flightNumber)
              );
              for (const ml of matchingLogs) {
                if (ml.id && updateFlightLog) {
                  try {
                    await updateFlightLog(ml.id, cleanUpdates as any);
                  } catch (e) {
                    console.warn(`[IntoPlane] Could not update saved flight log ${ml.id}:`, e);
                  }
                }
              }

              notify(`Timings updated for ${activeFlight.flightNumber}`, 'success');
            }}
          />
        )}

        {/* Detail Confirmation Modal */}
        {showConfirmModal && activeFlight && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-hidden">
            <div className="bg-surface rounded-2xl sm:rounded-3xl border border-outline shadow-premium w-full max-w-2xl p-4 sm:p-7 animate-in fade-in zoom-in duration-300 my-auto max-h-[92dvh] flex flex-col overflow-hidden">
              <div className="flex items-start sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-outline/30 shrink-0">
                <div className="min-w-0">
                  <span className="block text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-0.5 sm:mb-1">Confirm Authorization</span>
                  <h3 className="text-lg sm:text-2xl font-[900] tracking-tight sm:tracking-tighter text-on-surface leading-tight">REVIEW OPERATIONS LOG</h3>
                </div>
                <button onClick={() => setShowConfirmModal(false)} className="p-2 rounded-xl hover:bg-surface-dim transition-colors shrink-0">
                  <X className="w-5 h-5 text-on-surface-dim" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden py-3.5 sm:py-5 space-y-4 sm:space-y-5 scrollbar-thin">
                {/* Flight & Equipment Block */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-surface-dim/40 p-3.5 sm:p-5 rounded-2xl border border-outline/20">
                  <div className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Flight Number</span>
                    <span className="block text-[12px] font-black text-on-surface uppercase truncate">{activeFlight.flightNumber || 'N/A'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Airline / Customer</span>
                    <span className="block text-[12px] font-black text-primary uppercase truncate">{activeFlight.airline || getAirlineName(activeFlight.flightNumber || '', externalFlights) || 'N/A'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Reg / Type</span>
                    <span className="block text-[12px] font-black text-on-surface uppercase truncate">
                      {(activeFlight.aircraftReg || 'N/A')} / {(activeFlight.aircraftType || 'N/A')}
                    </span>
                  </div>
                  {!(isDomesticFlight(activeFlight as any) || (activeFlight as any).isDomestic || (activeFlight as any).isAdhoc) && (
                    <div className="min-w-0">
                      <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Parking Stand</span>
                      <span className="block text-[12px] font-black text-on-surface uppercase truncate">{activeFlight.stand || 'N/A'}</span>
                    </div>
                  )}
                </div>

                {/* Metering & Delivery Info (4 cards: 2x2 on mobile, 4-col on desktop) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                  <div className="card-premium p-3 sm:p-4 border-outline/30 min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Opening Meter</span>
                    <span className="block text-base sm:text-lg font-mono font-black text-on-surface truncate">
                      {activeFlight.meterOpen?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="card-premium p-3 sm:p-4 border-outline/30 min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Totalizer Volume</span>
                    <span className="block text-base sm:text-lg font-mono font-black text-primary truncate">
                      {activeFlight.volume?.toLocaleString() || '0'} L
                    </span>
                  </div>
                  <div className="card-premium p-3 sm:p-4 border-outline/30 min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Closing Meter</span>
                    <span className="block text-base sm:text-lg font-mono font-black text-on-surface truncate">
                      {((activeFlight.meterOpen || 0) + (activeFlight.volume || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="card-premium p-3 sm:p-4 border-outline/30 min-w-0 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">PSI</span>
                      <span className="block text-base sm:text-lg font-mono font-black text-on-surface truncate">
                        {activeFlight.psi !== undefined && activeFlight.psi !== null && String(activeFlight.psi) !== '' ? activeFlight.psi : 'N/A'}
                      </span>
                    </div>
                    <div className="w-px h-7 bg-outline/30 shrink-0" />
                    <div className="min-w-0 flex-1 text-right">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">LPM</span>
                      <span className="block text-base sm:text-lg font-mono font-black text-on-surface truncate">
                        {activeFlight.lpm !== undefined && activeFlight.lpm !== null && String(activeFlight.lpm) !== '' ? activeFlight.lpm : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timestamps Listing */}
                <div className="space-y-2.5 sm:space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Operations Timeline</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { label: 'Ramp Arrived', time: activeFlight.timestampArrived },
                      { label: 'Positioned at AC', time: activeFlight.timestampPosition },
                      { label: 'Commence Pumping', time: activeFlight.timestampStart },
                      { label: 'Initial End', time: activeFlight.timestampInitialEnd },
                      { label: 'Top-Up Start', time: activeFlight.timestampFinalStart },
                      { label: 'Top-Up End', time: activeFlight.timestampFinalEnd },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2.5 sm:p-3.5 bg-surface-dim/30 rounded-xl border border-outline/20 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-on-surface truncate">{item.label}</span>
                        {item.time ? (
                          <span className="text-[10px] font-black text-success font-mono flex items-center shrink-0">
                            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                            {new Date(item.time).toLocaleTimeString([], { hour12: false })}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-on-surface-dim opacity-30 italic shrink-0">Not Registered</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* QC Compliance & Ticket Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
                  <div className="p-3.5 sm:p-5 bg-success/5 border border-success/20 rounded-2xl space-y-2.5 sm:space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-success">JIG QC Compliance</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase text-on-surface">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        <span>Panel Check</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        <span>Walk Around</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        <span>Appearance</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        <span>Water Check</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3.5 sm:p-5 bg-surface-dim/40 border border-outline/20 rounded-2xl space-y-2.5 sm:space-y-3">
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
                  <div className="p-3.5 sm:p-4 bg-surface-dim/40 border border-outline/20 rounded-2xl">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1.5">Remarks</span>
                    <p className="text-[11px] font-medium text-on-surface italic break-words">{activeFlight.remarks}</p>
                  </div>
                )}

                {/* Declaration of Acknowledgment & Signature */}
                <SignatureAcknowledgment
                  signerName={activeFlight.signerName || ''}
                  onSignerNameChange={(val) => handleInputChange('signerName', val.toUpperCase())}
                  signerDesignation={activeFlight.signerDesignation || ''}
                  onSignerDesignationChange={(val) => handleInputChange('signerDesignation', val)}
                  signerEmail={activeFlight.signerEmail || ''}
                  onSignerEmailChange={(val) => handleInputChange('signerEmail', val)}
                  signatureDataUrl={activeFlight.signatureDataUrl || null}
                  onSignatureChange={(val) => {
                    handleInputChange('signatureDataUrl', val);
                    handleInputChange('signedAt', val ? new Date().toISOString() : undefined);
                    handleInputChange('declarationConfirmed', !!val);
                  }}
                  designationPresets={[
                    'Captain (PIC)',
                    'First Officer',
                    'Aircraft Maintenance Engineer',
                    'Ground Handler Rep'
                  ]}
                  declarationText="I hereby acknowledge and certify receipt of the specified fuel volume into the aircraft. All quality control procedures, meter readings, and safety clearances have been verified and accepted."
                  title="Customer / Flight Crew Acknowledgment"
                  subtitle="Official Into-Plane Fueling Certification"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 sm:gap-4 pt-3 sm:pt-4 border-t border-outline/30 shrink-0">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3.5 sm:py-4 px-3 bg-surface-dim border border-outline text-on-surface rounded-2xl font-[900] text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.2em] hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="sm:hidden">Edit</span>
                  <span className="hidden sm:inline">Go Back & Edit</span>
                </button>
                <button
                  onClick={async () => {
                    setShowConfirmModal(false);
                    await handleSubmit();
                  }}
                  disabled={loading || !activeFlight.signatureDataUrl || !activeFlight.signerName?.trim()}
                  className="flex-[1.5] sm:flex-1 py-3.5 sm:py-4 px-3 kinetic-gradient text-white rounded-2xl font-[900] text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.2em] shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-40 disabled:grayscale"
                >
                  {loading ? (
                    <span className="font-[900]">SYNCING...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="sm:hidden">Authorize & Save</span>
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
            {currentScreen !== 'dashboard' && activeAccountResolution.customer && (
              <div className="mx-4 sm:mx-5 mt-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/25 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                        Linked Customer Account
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${
                        activeAccountResolution.customer.classification === 'ADVANCE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : activeAccountResolution.customer.classification === 'CREDIT'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {activeAccountResolution.customer.classification}
                      </span>
                      {activeAccountResolution.airlineHolding && (
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-outline text-[9px] font-mono font-black text-on-surface">
                          {activeAccountResolution.airlineHolding.code} • {activeAccountResolution.airlineHolding.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-black text-on-surface truncate mt-0.5">
                      {activeAccountResolution.customer.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="text-right">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">
                      Live Balance (Auto-Deduct)
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                      ${(activeAccountResolution.customer.classification === 'ADVANCE'
                        ? activeAccountResolution.customer.advanceBalance
                        : activeAccountResolution.customer.runningBalance
                      ).toLocaleString()}
                      {activeAccountResolution.customer.balanceLiters
                        ? ` • ${activeAccountResolution.customer.balanceLiters.toLocaleString()} L`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                onEditFrt={(user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN) ? () => setShowEditActiveFrt(true) : undefined}
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
          @media (max-width: 767px) {
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

        {/* Post-Completion Invoice Modal with Print, Email & Share */}
        {completedInvoiceLog && createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
            onClick={() => setCompletedInvoiceLog(null)}
          >
            <div
              className="bg-surface border border-outline rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-outline/30 flex items-center justify-between bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-success/15 text-success flex items-center justify-center shrink-0">
                    <CheckCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-success">
                      Operations Log Finalized & Synced
                    </span>
                    <h3 className="text-xl font-[900] tracking-tight text-on-surface">
                      DELIVERY INVOICE READY
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedInvoiceLog(null)}
                  className="w-9 h-9 rounded-xl bg-surface-dim hover:bg-surface-container text-on-surface-dim hover:text-on-surface flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-dim border border-outline/30">
                  <div>
                    <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">
                      Official Delivery Ticket
                    </span>
                    <span className="text-lg font-black text-rose-500 tracking-wider">
                      {completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">
                      Total Fuel Uplift
                    </span>
                    <span className="text-lg font-black text-primary">
                      {completedInvoiceLog.volume ? completedInvoiceLog.volume.toLocaleString() : '0'} L
                    </span>
                  </div>
                </div>

                {completedAccountResolution.customer && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                    <div>
                      <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-400">
                        Real-Time Account Balance Deducted
                      </span>
                      <span className="text-xs font-black text-on-surface">
                        {completedAccountResolution.customer.name}
                        {completedAccountResolution.airlineHolding ? ` (${completedAccountResolution.airlineHolding.code})` : ''}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      Bal: ${(completedAccountResolution.customer.classification === 'ADVANCE'
                        ? completedAccountResolution.customer.advanceBalance
                        : completedAccountResolution.customer.runningBalance
                      ).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                    <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Flight No</span>
                    <span className="font-black text-on-surface text-sm">{completedInvoiceLog.flightNumber}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                    <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Aircraft</span>
                    <span className="font-black text-on-surface text-sm">{completedInvoiceLog.aircraftReg} ({completedInvoiceLog.aircraftType})</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                    <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Stand / PIT</span>
                    <span className="font-bold text-on-surface">Stand {completedInvoiceLog.stand}{completedInvoiceLog.pitNumber ? ` • Pit ${completedInvoiceLog.pitNumber}` : ''}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                    <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Signer / Representative</span>
                    <span className="font-bold text-on-surface truncate block">{completedInvoiceLog.signerName || 'Flight Crew'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/30 space-y-2">
                  <label className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">
                    Representative / Airline Email (for Instant Invoice Dispatch)
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                      ref={invoiceEmailInputRef}
                      type="email"
                      value={invoiceModalEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceModalEmail(val);
                        setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: val } : prev));
                      }}
                      placeholder="Enter representative email address..."
                      className="w-full bg-transparent text-xs font-bold text-on-surface outline-none placeholder:text-on-surface-dim/40"
                    />
                  </div>
                  {completedAccountResolution.emails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline/20">
                      <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60 self-center mr-1">
                        Account Emails:
                      </span>
                      {completedAccountResolution.emails.map((emailAddr) => (
                        <button
                          key={emailAddr}
                          type="button"
                          onClick={() => {
                            setInvoiceModalEmail(emailAddr);
                            setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: emailAddr } : prev));
                          }}
                          className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border transition-all cursor-pointer ${
                            invoiceModalEmail === emailAddr
                              ? 'bg-primary text-white border-primary'
                              : 'bg-surface-dim text-on-surface-dim border-outline hover:border-primary/40 hover:text-on-surface'
                          }`}
                        >
                          {emailAddr}
                        </button>
                      ))}
                      {completedAccountResolution.emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const allJoined = completedAccountResolution.emails.join(', ');
                            setInvoiceModalEmail(allJoined);
                            setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: allJoined } : prev));
                          }}
                          className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer"
                        >
                          All ({completedAccountResolution.emails.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 pt-2 space-y-2 border-t border-outline/20">
                <button
                  type="button"
                  onClick={() => openPrintInvoice(completedInvoiceLog, user)}
                  className="w-full py-4 kinetic-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-premium hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="sm:hidden">Print / Save PDF</span>
                  <span className="hidden sm:inline">Print / Save PDF Invoice (FORM NO: G-001)</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInvoiceEmailModal(true);
                    }}
                    className="flex-1 py-3 px-4 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl font-black text-[11px] uppercase tracking-wider text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-primary shrink-0" />
                    <span>Email to Rep</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSharingPdf}
                    onClick={async () => {
                      setIsSharingPdf(true);
                      try {
                        const res = await shareInvoice(completedInvoiceLog, user, prebuiltInvoicePdf);
                        if (res === 'downloaded') {
                          notify('Invoice PDF downloaded to your device.', 'success');
                        }
                      } catch {
                        notify('Could not share PDF invoice.', 'error');
                      } finally {
                        setIsSharingPdf(false);
                      }
                    }}
                    className="flex-1 py-3 px-4 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl font-black text-[11px] uppercase tracking-wider text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{isSharingPdf ? 'Sharing...' : 'Share PDF'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCompletedInvoiceLog(null)}
                  className="w-full py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-dim hover:text-on-surface transition-colors cursor-pointer mt-1"
                >
                  Done & Return to Dashboard
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Dedicated Email Dispatcher Modal for Delivery Invoice */}
        {showInvoiceEmailModal && completedInvoiceLog && (() => {
          const emailDetails = getInvoiceEmailDetails(
            completedInvoiceLog,
            invoiceModalEmail || completedInvoiceLog.signerEmail
          );
          return (
            <EmailDispatchModal
              isOpen={true}
              onClose={() => setShowInvoiceEmailModal(false)}
              title={`Email Delivery Invoice — ${completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}`}
              subtitle={`Form No: G-001 • Uplift: ${completedInvoiceLog.volume?.toLocaleString() || 0} L`}
              flightNumber={completedInvoiceLog.flightNumber}
              airlineName={completedInvoiceLog.airline || completedAccountResolution.customer?.name}
              defaultTo={invoiceModalEmail || emailDetails.to}
              availableEmails={completedAccountResolution.emails}
              subject={emailDetails.subject}
              bodyText={emailDetails.bodyText}
              pdfAttachment={prebuiltInvoicePdf}
              pdfFilename={`${completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}.pdf`}
            />
          );
        })()}
    </div>
  );
};