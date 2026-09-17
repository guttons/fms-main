import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MOCK_USERS, EQUIPMENT } from '../constants';
import { UserRole, EquipmentType, FlightJob, isDomesticFlight } from '../types';
import { Calendar, Zap, Plane, Clock, Users, Truck, MapPin, ChevronDown, Droplet, Settings, Home, Radio, RefreshCw, PlaneLanding, PlaneTakeoff, Check, XCircle, ArrowRightCircle, AlertTriangle, Lock, Ban, Play, CheckCircle, Globe, X, Pencil } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { BriefingShift } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';

export const COMMON_MLE_STANDS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9',
  '1R', 'ST 1', '1L',
  '2R', 'ST 2', '2L',
  '3R', 'ST 3', '3L',
  '4R', 'ST 4', '4L',
  '5R', 'ST 5', '5L',
  '6R', 'ST 6', '6L',
  '7R', 'ST 7', '7L',
  '8R', 'ST 8', '8L',
  '9R', 'ST 9', '9L',
  'A10', 'A11', 'A12',
  'N', 'E'
];

export const EditStandModal: React.FC<{
  flightNumber: string;
  currentStand: string;
  onClose: () => void;
  onSave: (newStand: string) => Promise<void> | void;
}> = ({ flightNumber, currentStand, onClose, onSave }) => {
  const [stand, setStand] = useState(currentStand || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stand.trim()) return;
    setSaving(true);
    try {
      await onSave(stand.trim().toUpperCase());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-premium text-on-surface animate-in zoom-in-95 duration-200 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Change Flight Stand</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">{flightNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">
              Assigned Stand / Bay
            </label>
            <input
              type="text"
              required
              value={stand}
              onChange={(e) => setStand(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono"
            />
          </div>

          <div>
            <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-2 opacity-50">
              Quick Select MLE Stands
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              {COMMON_MLE_STANDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStand(s)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer ${
                    stand.toUpperCase() === s
                      ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 border-amber-500 font-black shadow-sm'
                      : 'bg-surface-dim border-outline text-on-surface-dim hover:border-primary/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-surface-dim border border-outline text-on-surface-dim hover:text-on-surface rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !stand.trim()}
              className="flex-1 py-3.5 kinetic-gradient text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-premium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Updating...' : 'Confirm Stand'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export const EditFuelRequestModal: React.FC<{
  flight: FlightJob;
  onClose: () => void;
  onSave: (updates: {
    std?: string;
    tobt?: string;
    frtAirline?: string;
    frtAocc?: string;
    frtFor?: string;
  }) => Promise<void> | void;
}> = ({ flight, onClose, onSave }) => {
  const [std, setStd] = useState(flight.std || '');
  const [tobt, setTobt] = useState(flight.tobt || '');
  const [frtAirline, setFrtAirline] = useState(flight.frtAirline || '');
  const [frtAocc, setFrtAocc] = useState(flight.frtAocc || '');
  const [frtFor, setFrtFor] = useState(flight.frtFor || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        std: std.trim() || undefined,
        tobt: tobt.trim() || undefined,
        frtAirline: frtAirline.trim() || undefined,
        frtAocc: frtAocc.trim() || undefined,
        frtFor: frtFor.trim() || undefined
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-premium text-on-surface animate-in zoom-in-95 duration-200 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Departure & Fuel Request Timings</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                {flight.flightNumber} • STAND {flight.stand} • {flight.aircraftReg || flight.aircraftType || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
                Scheduled Dep (STD)
              </label>
              <input
                type="text"
                placeholder="HH:MM"
                value={std}
                onChange={(e) => setStd(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono text-on-surface"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1.5 font-bold">
                TOBT (DEP STD Change)
              </label>
              <input
                type="text"
                placeholder="HH:MM"
                value={tobt}
                onChange={(e) => setTobt(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-dim border border-amber-500/40 rounded-2xl text-[13px] font-black tracking-wider focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-mono text-amber-400"
              />
              <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Target Off-Block Time</span>
            </div>
          </div>

          <div className="p-4 bg-surface-dim/50 border border-outline/60 rounded-2xl space-y-3">
            <span className="block text-[9px] font-black text-primary uppercase tracking-widest">
              Fuel Request Times (FRT)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT Airline
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtAirline}
                  onChange={(e) => setFrtAirline(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Airline Request</span>
              </div>

              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT AOCC
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtAocc}
                  onChange={(e) => setFrtAocc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">AOCC Request</span>
              </div>

              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT For
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtFor}
                  onChange={(e) => setFrtFor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Requested For</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-surface-dim border border-outline text-on-surface-dim hover:text-on-surface rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 kinetic-gradient text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-premium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Timings'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

interface ScheduleProps {
  user?: any;
  onStartJob?: (job: FlightJob) => void;
}

export const Schedule: React.FC<ScheduleProps> = ({ user, onStartJob }) => {
  const { notify } = useNotification();
  const [editingStandFlight, setEditingStandFlight] = useState<any | null>(null);
  const [editingFrtFlight, setEditingFrtFlight] = useState<FlightJob | null>(null);
  const isItpManagerOrAdmin = user?.role === UserRole.ITP_MANAGER || user?.role === UserRole.ADMIN;
  const {
    equipment,
    flightJobs,
    rawFlightJobs,
    briefingInfo,
    updateFlightJob,
    addFlightJob,
    deleteFlightJob,
    flightLogs,
    updateFlightLog,
    staff,
    selectedBriefingShift,
    setSelectedBriefingShift,
    domesticAssignments,
    updateDomesticAssignment,
    externalFlights,
    isExternalFlightsLoading,
    refreshExternalFlights,
    domesticFlights,
    selectedBriefingDate,
    setSelectedBriefingDate,
    crossCheckDailyFlights
  } = useOperationalData();
  const todayDate = selectedBriefingDate;
  const todayStr = new Date().toISOString().split('T')[0];
  const isHistoricalView = selectedBriefingDate < todayStr;

  const crossCheckResults = crossCheckDailyFlights ? crossCheckDailyFlights(todayDate) : [];
  const retimedCount = crossCheckResults.filter(r => r.status === 'RETIMED').length;
  const swapCount = crossCheckResults.filter(r => r.status === 'AIRCRAFT_SWAP').length;
  const missingCount = crossCheckResults.filter(r => r.status === 'CANCELLED_OR_MISSING').length;
  const matchedCount = crossCheckResults.filter(r => r.status === 'MATCHED').length;
  const compliancePct = crossCheckResults.length > 0 ? Math.round((matchedCount / crossCheckResults.length) * 100) : 100;
  const [activeTab, setActiveTab] = useState<'international' | 'domestic' | 'adhoc' | 'equipment' | 'status' | 'live'>('international');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerTooltip = (tabKey: string) => {
    setActiveTooltip(tabKey);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setActiveTooltip(null);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const [configuringFlightId, setConfiguringFlightId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<any>(null);

  const [fidsType, setFidsType] = useState<'arrival' | 'departure'>('arrival');
  const [fidsCategory, setFidsCategory] = useState<'all' | 'international' | 'domestic'>('all');
  const [fidsSearchQuery, setFidsSearchQuery] = useState('');

  // Fetch live flights on load
  useEffect(() => {
    refreshExternalFlights();
  }, [refreshExternalFlights]);

  const isFlightImported = (flightNo: string) => {
    const cleanNo = (flightNo || '').replace(/\s+/g, '').toLowerCase();
    return flightJobs.some(job => (job.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
  };

  const getLogoUrl = (flightNumber?: string) => {
    if (!flightNumber) return null;
    const airlineCode = flightNumber.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    return airlineCode.length === 2 ? `https://fis.com.mv/tail/${airlineCode}.png` : null;
  };

  const getFidsStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('landed') || s.includes('departed') || s.includes('arrive')) {
      return 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20';
    }
    if (s.includes('cancel') || s.includes('cnl')) {
      return 'bg-error/10 text-error border-error/20';
    }
    if (s.includes('delay') || s.includes('final') || s.includes('closed') || s.includes('boarding') || s.includes('gate')) {
      return 'bg-warning/10 text-warning border-warning/20';
    }
    return 'bg-surface-dim text-on-surface-dim border-outline opacity-60';
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-surface-dim text-on-surface-dim border-outline';
    const s = status.toUpperCase();
    if (s === 'COMPLETED') {
      return 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]';
    }
    if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
      return 'bg-warning/10 text-warning border-warning/20';
    }
    if (s.includes('DELAY')) {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    if (s.includes('CANCEL') || s.includes('CNL')) {
      return 'bg-error/10 text-error border-error/20';
    }
    if (s.includes('LANDED') || s.includes('DEPARTED') || s.includes('ARRIV')) {
      return 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20';
    }
    if (s.includes('BOARDING') || s.includes('GATE') || s.includes('FINAL') || s.includes('CLOSED')) {
      return 'bg-warning/10 text-warning border-warning/20';
    }
    return 'bg-surface-dim text-on-surface-dim border-outline';
  };

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

  const handleImportClick = (flight: any) => {
    if (isHistoricalView) return;
    const s = (flight.status || '').toLowerCase();
    if (s.includes('cancel') || s.includes('cnl')) {
      return;
    }
    // Calculate route: Origin -> Male (MLE) or Male (MLE) -> Destination
    const routeStr = flight.type === 'arrival'
      ? `${flight.originCode || flight.origin || ''} ➔ MLE`
      : `MLE ➔ ${flight.destinationCode || flight.destination || ''}`;

    const staVal = flight.type === 'arrival' ? flight.scheduledTime : '';
    const stdVal = flight.type === 'departure' ? flight.scheduledTime : '';
    const etaVal = flight.type === 'arrival' ? flight.estimatedTime || flight.scheduledTime : '';

    setPrefillData({
      flightNumber: flight.flightNumber || '',
      route: routeStr,
      stand: flight.gate || '', // Pull only gate as a stand as requested by user
      sta: staVal,
      eta: etaVal,
      std: stdVal,
      isDomestic: isDomesticFlight(flight),
      type: flight.type
    });

    setIsModalOpen(true);
  };

  const handleUnimportClick = async (flightNo: string) => {
    if (isHistoricalView) return;
    const cleanNo = (flightNo || '').replace(/\s+/g, '').toLowerCase();
    const job = flightJobs.find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
    if (job) {
      try {
        await deleteFlightJob(job.id);
      } catch (error) {
        console.error("Failed to unimport flight job:", error);
      }
    }
  };

  const filteredFidsFlights = useMemo(() => {
    return (externalFlights || [])
      .filter((f: any) => {
        // Type filter (arrival / departure)
        if (f.type !== fidsType) return false;

        // Category filter (all / international / domestic)
        if (fidsCategory !== 'all' && f.category !== fidsCategory) return false;

        // Search query
        if (fidsSearchQuery) {
          const q = fidsSearchQuery.toLowerCase();
          const matchFlight = (f.flightNumber || '').toLowerCase().includes(q);
          const matchAirline = (f.airline || '').toLowerCase().includes(q);
          const matchOrigin = (f.origin || '').toLowerCase().includes(q);
          const matchDest = (f.destination || '').toLowerCase().includes(q);
          return matchFlight || matchAirline || matchOrigin || matchDest;
        }

        return true;
      });
  }, [externalFlights, fidsType, fidsCategory, fidsSearchQuery]);

  const handleAddFlight = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const formData = new FormData(target);
    const flight = formData.get('flight') as string;
    const route = formData.get('route') as string;
    const ac = formData.get('ac') as string;
    const stand = formData.get('stand') as string;
    const sta = formData.get('sta') as string;
    const eta = formData.get('eta') as string;
    const std = formData.get('std') as string;
    const tobt = formData.get('tobt') as string;
    const frtAirline = formData.get('frtAirline') as string;
    const frtAocc = formData.get('frtAocc') as string;
    const frtFor = formData.get('frtFor') as string;

    if (!flight || !route || !ac || !stand || !sta || !eta || !std) return;

    try {
      await addFlightJob({
        id: `fj-${Date.now()}`,
        flightNumber: flight,
        aircraftReg: ac,
        aircraftType: ac,
        stand,
        sta,
        eta,
        std,
        tobt: tobt?.trim() || undefined,
        frtAirline: frtAirline?.trim() || undefined,
        frtAocc: frtAocc?.trim() || undefined,
        frtFor: frtFor?.trim() || undefined,
        assignedTo: '',
        status: 'PENDING',
        date: todayDate,
        route,
        isDomestic: prefillData?.isDomestic ?? isDomesticFlight({ flightNumber: flight }),
        isAdhoc: false,
        type: prefillData?.type || (sta ? 'arrival' : 'departure')
      });
      setIsModalOpen(false);
      setPrefillData(null);
      target.reset();
    } catch (error) {
      console.error("Failed to add flight job:", error);
    }
  };

  const isDelayed = (sta?: string, eta?: string) => {
    if (!sta || !eta) return false;
    const [staH, staM] = sta.split(':').map(Number);
    const [etaH, etaM] = eta.split(':').map(Number);
    return (etaH * 60 + etaM) > (staH * 60 + staM);
  };

  const renderRoute = (route?: string, textSize = "text-sm", isDomestic = false) => {
    if (!route) return <span className={`${textSize} font-black tracking-tight text-on-surface-dim opacity-30`}>---</span>;
    if (isDomestic) {
      const parts = route.split(/\s+/);
      const dest = parts[parts.length - 1];
      return <span className={`${textSize} font-black text-primary`}>{dest}</span>;
    }
    const parts = route.split(/\s+/);
    return (
      <div className={`flex items-center ${textSize} font-black tracking-tight select-none`}>
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
      </div>
    );
  };

  // Shift time ranges for filtering flights
  const shiftRanges: Record<BriefingShift, { start: string; end: string; crossesMidnight: boolean }> = {
    'Morning': { start: '07:30', end: '16:00', crossesMidnight: false },
    'Evening': { start: '15:00', end: '23:30', crossesMidnight: false },
    'Night': { start: '22:30', end: '08:30', crossesMidnight: true },
  };

  const isFlightInShift = (dep?: string) => {
    if (!dep) return true; // Show flights without DEP always
    const timeStr = dep.slice(0, 5);
    const range = shiftRanges[selectedBriefingShift];
    if (range.crossesMidnight) {
      return timeStr >= range.start || timeStr <= range.end;
    }
    return timeStr >= range.start && timeStr <= range.end;
  };

  const isAdhocFlight = (f: any) => {
    if (!f) return false;
    if (f.isAdhoc) return true;
    if (typeof f.id === 'string' && f.id.startsWith('ah-')) return true;
    const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
    return (briefingInfo?.staffAssignments?.adhocFlights || []).some(
      (af: any) => af && (af.id === f.id || (af.flightNumber && af.flightNumber.replace(/\s+/g, '').toLowerCase() === cleanNo))
    );
  };

  const scheduledFlights = useMemo(() => {
    const frozen = briefingInfo?.staffAssignments?.frozenFlights;

    // Filter live flight jobs for today in the selected shift (international only)
    const liveFiltered = (flightJobs || []).filter(f => {
      const isDep = f.type ? f.type === 'departure' : !!f.std;
      const matchesDate = !f.date || f.date.split('T')[0] === todayDate;
      return !isDomesticFlight(f) && !isAdhocFlight(f) && isDep && isFlightInShift(f.std) && matchesDate;
    });

    if (frozen?.intl && frozen.intl.length > 0) {
      // Create a map starting from live flights so no live FIDS flight is ever dropped
      const flightMap = new Map<string, any>();
      liveFiltered.forEach(f => {
        const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        flightMap.set(cleanNo, f);
      });

      // Merge frozen flights onto the map (ensure domestic and adhoc flights are excluded)
      frozen.intl.filter((ff: any) => !isDomesticFlight(ff) && !isAdhocFlight(ff)).forEach((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const existing = flightMap.get(cleanNo);
        const liveJob = (flightJobs || []).find(fj => {
          const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          const jDate = fj.date ? fj.date.split('T')[0] : '';
          if (jDate && todayDate && jDate !== todayDate) return false;
          const dateMatch = !jDate || !todayDate || jDate === todayDate;
          return dateMatch && (c === cleanNo || (fj.id && (fj.id === ff.id || fj.id === existing?.id)));
        });

        const rawDbJob = (rawFlightJobs || []).find(j => {
          const c = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          const jDate = j.date ? j.date.split('T')[0] : '';
          if (jDate && todayDate && jDate !== todayDate) return false;
          const dateMatch = !jDate || !todayDate || jDate === todayDate;
          return dateMatch && (c === cleanNo || j.id === ff.id || j.id === existing?.id);
        });

        const effectiveStatus = (rawDbJob && (rawDbJob.status === 'IN_PROGRESS' || rawDbJob.status === 'COMPLETED'))
          ? rawDbJob.status
          : (liveJob && (liveJob.status === 'IN_PROGRESS' || liveJob.status === 'COMPLETED'))
          ? liveJob.status
          : (existing?.status || ff.status || rawDbJob?.status || liveJob?.status || 'PENDING');

        flightMap.set(cleanNo, {
          ...(existing || {}),
          ...ff,
          // Preserve any live db updates such as status, stand, assignments, vehicle, or timings
          stand: rawDbJob?.stand || liveJob?.stand || existing?.stand || ff.stand,
          status: effectiveStatus,
          std: rawDbJob?.std || liveJob?.std || existing?.std || ff.std,
          tobt: rawDbJob?.tobt || liveJob?.tobt || existing?.tobt || ff.tobt,
          frtAirline: rawDbJob?.frtAirline || liveJob?.frtAirline || existing?.frtAirline || ff.frtAirline,
          frtAocc: rawDbJob?.frtAocc || liveJob?.frtAocc || existing?.frtAocc || ff.frtAocc,
          frtFor: rawDbJob?.frtFor || liveJob?.frtFor || existing?.frtFor || ff.frtFor,
          assignedTo: (rawDbJob && rawDbJob.assignedTo !== undefined && rawDbJob.assignedTo !== null)
            ? rawDbJob.assignedTo
            : (liveJob && liveJob.assignedTo !== undefined && liveJob.assignedTo !== null)
            ? liveJob.assignedTo
            : (existing && existing.assignedTo !== undefined && existing.assignedTo !== null)
            ? existing.assignedTo
            : (ff.assignedTo || ''),
          assignedOfficer: (rawDbJob && rawDbJob.assignedOfficer !== undefined && rawDbJob.assignedOfficer !== null)
            ? rawDbJob.assignedOfficer
            : (liveJob && liveJob.assignedOfficer !== undefined && liveJob.assignedOfficer !== null)
            ? liveJob.assignedOfficer
            : (existing && existing.assignedOfficer !== undefined && existing.assignedOfficer !== null)
            ? existing.assignedOfficer
            : (ff.assignedOfficer || ''),
          vehicleId: rawDbJob?.vehicleId !== undefined ? rawDbJob.vehicleId : (liveJob?.vehicleId !== undefined ? liveJob.vehicleId : (existing?.vehicleId || ff.vehicleId)),
        });
      });

      const seenKeys = new Set<string>();
      return Array.from(flightMap.values()).filter(f => {
        if (!f.id || seenKeys.has(f.id)) return false;
        seenKeys.add(f.id);
        return true;
      }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
    }

    // Reconcile non-frozen flights with any live job updates strictly matching the operational date
    const reconciledLive = liveFiltered.map(f => {
      const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const flightDate = f.date ? f.date.split('T')[0] : todayDate;
      const liveJob = (flightJobs || []).find(fj => {
        const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = fj.date ? fj.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || (fj.id && fj.id === f.id)) && (!jDate || !flightDate || jDate === flightDate);
      });
      const rawDbJob = (rawFlightJobs || []).find(j => {
        const c = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || j.id === f.id) && (!jDate || !flightDate || jDate === flightDate);
      });
      const effectiveStatus = (rawDbJob && (rawDbJob.status === 'IN_PROGRESS' || rawDbJob.status === 'COMPLETED'))
        ? rawDbJob.status
        : (liveJob && (liveJob.status === 'IN_PROGRESS' || liveJob.status === 'COMPLETED'))
        ? liveJob.status
        : (f.status || rawDbJob?.status || liveJob?.status || 'PENDING');

      if (liveJob || rawDbJob) {
        return {
          ...f,
          stand: rawDbJob?.stand || liveJob?.stand || f.stand,
          status: effectiveStatus,
          std: rawDbJob?.std || liveJob?.std || f.std,
          tobt: rawDbJob?.tobt || liveJob?.tobt || f.tobt,
          frtAirline: rawDbJob?.frtAirline || liveJob?.frtAirline || f.frtAirline,
          frtAocc: rawDbJob?.frtAocc || liveJob?.frtAocc || f.frtAocc,
          frtFor: rawDbJob?.frtFor || liveJob?.frtFor || f.frtFor,
          assignedTo: (rawDbJob && rawDbJob.assignedTo !== undefined && rawDbJob.assignedTo !== null)
            ? rawDbJob.assignedTo
            : (liveJob && liveJob.assignedTo !== undefined && liveJob.assignedTo !== null)
            ? liveJob.assignedTo
            : (f.assignedTo || ''),
          assignedOfficer: (rawDbJob && rawDbJob.assignedOfficer !== undefined && rawDbJob.assignedOfficer !== null)
            ? rawDbJob.assignedOfficer
            : (liveJob && liveJob.assignedOfficer !== undefined && liveJob.assignedOfficer !== null)
            ? liveJob.assignedOfficer
            : (f.assignedOfficer || ''),
          vehicleId: rawDbJob?.vehicleId !== undefined ? rawDbJob.vehicleId : (liveJob?.vehicleId !== undefined ? liveJob.vehicleId : f.vehicleId),
        };
      }
      return f;
    });

    const seenKeys = new Set<string>();
    return reconciledLive.filter(f => {
      if (!f.id || seenKeys.has(f.id)) return false;
      seenKeys.add(f.id);
      return true;
    }).sort((a, b) => (a.std || '').localeCompare(b.std || ''));
  }, [flightJobs, rawFlightJobs, selectedBriefingShift, todayDate, briefingInfo]);

  const domesticFlightsToRender = useMemo(() => {
    const frozen = briefingInfo?.staffAssignments?.frozenFlights;

    const liveFiltered = (domesticFlights || []).filter(f => {
      const isDep = f.type ? f.type === 'departure' : !!f.std;
      const matchesDate = !f.date || f.date.split('T')[0] === todayDate;
      return isDep && isFlightInShift(f.std) && matchesDate;
    });

    if (frozen?.domestic && frozen.domestic.length > 0) {
      const flightMap = new Map<string, any>();
      liveFiltered.forEach(f => {
        const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        flightMap.set(cleanNo, f);
      });

      frozen.domestic.forEach((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const existing = flightMap.get(cleanNo);
        const liveJob = (flightJobs || []).find(fj => {
          const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          const jDate = fj.date ? fj.date.split('T')[0] : '';
          if (jDate && todayDate && jDate !== todayDate) return false;
          return (c === cleanNo || (fj.id && (fj.id === ff.id || fj.id === existing?.id))) && (!jDate || !todayDate || jDate === todayDate);
        });
        const rawDbJob = (rawFlightJobs || []).find(fj => {
          const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          const jDate = fj.date ? fj.date.split('T')[0] : '';
          if (jDate && todayDate && jDate !== todayDate) return false;
          return (c === cleanNo || (fj.id && (fj.id === ff.id || fj.id === existing?.id))) && (!jDate || !todayDate || jDate === todayDate);
        });
        const effectiveStatus = (rawDbJob && (rawDbJob.status === 'IN_PROGRESS' || rawDbJob.status === 'COMPLETED'))
          ? rawDbJob.status
          : (liveJob && (liveJob.status === 'IN_PROGRESS' || liveJob.status === 'COMPLETED'))
          ? liveJob.status
          : (existing?.status || ff.status || 'PENDING');

        flightMap.set(cleanNo, {
          ...(existing || {}),
          ...ff,
          stand: rawDbJob?.stand || liveJob?.stand || existing?.stand || ff.stand,
          status: effectiveStatus,
          vehicleId: rawDbJob?.vehicleId || liveJob?.vehicleId || existing?.vehicleId || ff.vehicleId,
        });
      });

      return Array.from(flightMap.values()).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
    }

    return [...liveFiltered].map(f => {
      const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const flightDate = f.date ? f.date.split('T')[0] : todayDate;
      const liveJob = (flightJobs || []).find(fj => {
        const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = fj.date ? fj.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || (fj.id && fj.id === f.id)) && (!jDate || !flightDate || jDate === flightDate);
      });
      const rawDbJob = (rawFlightJobs || []).find(fj => {
        const c = (fj.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = fj.date ? fj.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || (fj.id && fj.id === f.id)) && (!jDate || !flightDate || jDate === flightDate);
      });
      const effectiveStatus = (rawDbJob && (rawDbJob.status === 'IN_PROGRESS' || rawDbJob.status === 'COMPLETED'))
        ? rawDbJob.status
        : (liveJob && (liveJob.status === 'IN_PROGRESS' || liveJob.status === 'COMPLETED'))
        ? liveJob.status
        : (f.status || 'PENDING');
      return {
        ...f,
        status: effectiveStatus,
        vehicleId: rawDbJob?.vehicleId || liveJob?.vehicleId || f.vehicleId
      };
    }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
  }, [domesticFlights, flightJobs, rawFlightJobs, selectedBriefingShift, todayDate, briefingInfo]);

  const adhocFlightsToRender = useMemo(() => {
    const raw = (briefingInfo?.staffAssignments?.adhocFlights || [])
      .filter((af: any) => af && af.id !== 'ah1' && af.id !== 'ah2');
    return raw.map((af: any) => {
      const cleanNo = (af.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const flightDate = af.date ? af.date.split('T')[0] : todayDate;
      const matchJob = (flightJobs || []).find(j => {
        const c = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || j.id === af.id) && (!jDate || !flightDate || jDate === flightDate);
      });
      const rawDbJob = (rawFlightJobs || []).find(j => {
        const c = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const jDate = j.date ? j.date.split('T')[0] : '';
        if (jDate && flightDate && jDate !== flightDate) return false;
        return (c === cleanNo || j.id === af.id) && (!jDate || !flightDate || jDate === flightDate);
      });
      return {
        ...af,
        ...(matchJob || {}),
        status: rawDbJob?.status || matchJob?.status || af.status || 'PENDING',
        vehicleId: rawDbJob?.vehicleId || matchJob?.vehicleId || af.vehicleId
      };
    });
  }, [briefingInfo, flightJobs, rawFlightJobs, todayDate]);

  const domesticTeams = [
    { id: 't1', name: 'Team 1', op1: '', op2: '' },
    { id: 't2', name: 'Team 2', op1: '', op2: '' },
    { id: 't3', name: 'Team 3', op1: '', op2: '' },
  ].map(team => {
    const dbTeam = (domesticAssignments || []).find(d => d.team_name === team.name);
    return dbTeam ? { ...team, op1: dbTeam.operator1_id || dbTeam.op1 || '', op2: dbTeam.operator2_id || dbTeam.op2 || '' } : team;
  });

  const currentShiftLabel = selectedBriefingShift === 'Evening' ? 'DIESEL' : 'DAILY';
  const [dieselNeeds, setDieselNeeds] = useState<string[]>(briefingInfo?.dieselNeeds || []);

  const rfHdEquipment = (equipment || []).filter(eq =>
    eq && (eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER)
  );

  const [equipmentAssignments, setEquipmentAssignments] = useState(
    (rfHdEquipment || []).map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '', shift_type: currentShiftLabel, eqType: eq.type }))
  );

  // Filter operators by those marked present (attendees) in the selected briefing shift
  const allStaff = (staff && staff.length > 0 ? staff : MOCK_USERS);
  const briefingAttendees = briefingInfo?.staffAssignments?.attendees || [];

  const operators = (() => {
    if (briefingAttendees.length > 0) {
      return briefingAttendees
        .map(id => allStaff.find(u => u.id === id))
        .filter((u): u is typeof allStaff[0] => !!u)
        .filter(u => u.role.startsWith('ITP_'));
    }
    
    // Fallback if no attendees are marked present yet: show all assigned staff in the briefing
    const briefingStaffIds = briefingInfo?.staffAssignments ? Array.from(new Set([
      ...(briefingInfo.staffAssignments.activeOperators || []),
      ...(briefingInfo.staffAssignments.activeOfficers || []),
      ...(briefingInfo.staffAssignments.hydrantOpsOfficers || []),
      briefingInfo.staffAssignments.dutySupervisor,
      briefingInfo.staffAssignments.shiftInCharge
    ].filter(Boolean))) : [];

    if (briefingStaffIds.length > 0) {
      return briefingStaffIds
        .map(id => allStaff.find(u => u.id === id))
        .filter((u): u is typeof allStaff[0] => !!u)
        .filter(u => u.role.startsWith('ITP_'));
    }

    // Secondary fallback: all ITP staff roles
    return allStaff.filter(u => [
      UserRole.ITP_OPERATOR,
      UserRole.ITP_HD_OPERATOR,
      UserRole.ITP_SUPERVISOR,
      UserRole.ITP_OFFICER,
      UserRole.ITP_MANAGER
    ].includes(u.role));
  })();

  const getStaffInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Filter operators for Status Board: only show staff from the selected shift
  // based on the staffs on International allocations assigned
  const statusBoardOperators = useMemo(() => {
    const allStaff = (staff && staff.length > 0 ? staff : MOCK_USERS);
    const assignedIds = new Set<string>();

    scheduledFlights.forEach((f: any) => {
      if (f.assignedTo) assignedIds.add(f.assignedTo);
      if (f.assignedOfficer) assignedIds.add(f.assignedOfficer);
    });

    if (assignedIds.size === 0) {
      return [];
    }

    return Array.from(assignedIds)
      .map(id => allStaff.find(u => u.id === id) || operators.find(u => u.id === id))
      .filter((u): u is typeof allStaff[0] => !!u);
  }, [scheduledFlights, staff, operators]);

  useEffect(() => {
    if (briefingInfo?.dieselNeeds) {
      setDieselNeeds(briefingInfo.dieselNeeds);
    }
  }, [briefingInfo?.dieselNeeds]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Load Equipment Assignments
        const equipmentData = await supabaseService.getEquipmentAssignments(todayDate, currentShiftLabel);

        if (equipmentData && equipmentData.length > 0) {
          setEquipmentAssignments(prev => prev.map(eq => {
            const dbEq = equipmentData.find(d => d.equipment_id === eq.eqNumber);
            if (dbEq) {
              return { ...eq, op1: dbEq.operator1_id || '', op2: dbEq.operator2_id || '', shift_type: dbEq.shift_type };
            }
            return { ...eq, op1: '', op2: '' };
          }));
        } else {
          setEquipmentAssignments(prev => prev.map(eq => ({ ...eq, op1: '', op2: '' })));
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
      }
    };
    loadAssignments();
  }, [currentShiftLabel, todayDate, rfHdEquipment.length]);

  const handleAssignFlight = (flightId: string, field: 'assignedTo' | 'assignedOfficer' | 'equipmentUsage', value: string, flightMeta?: any) => {
    if (isHistoricalView) return;
    const meta = flightMeta || (scheduledFlights || []).find((f: any) => f.id === flightId) || (flightJobs || []).find(f => f.id === flightId);
    const resolvedFlightNumber = meta?.flightNumber || (flightId.startsWith('departure-') || flightId.startsWith('arrival-') ? flightId.split('-')[1] : undefined);
    const resolvedDate = meta?.date ? meta.date.split('T')[0] : (flightId.startsWith('departure-') || flightId.startsWith('arrival-') ? flightId.split('-')[2] : todayDate);
    updateFlightJob(flightId, { 
      [field]: value,
      flightNumber: resolvedFlightNumber,
      date: resolvedDate || todayDate
    });
  };

  const handleSaveStand = async (newStand: string) => {
    if (!editingStandFlight) return;
    try {
      await updateFlightJob(editingStandFlight.id, { stand: newStand });
      notify(`Flight ${editingStandFlight.flightNumber} stand changed to ${newStand}`, 'success');
    } catch (err) {
      console.error('Failed to update stand:', err);
      notify('Failed to update flight stand. Please try again.', 'error');
    }
  };

  const handleSaveFrt = async (updates: {
    std?: string;
    tobt?: string;
    frtAirline?: string;
    frtAocc?: string;
    frtFor?: string;
  }) => {
    if (!editingFrtFlight) return;
    try {
      await updateFlightJob(editingFrtFlight.id, updates);

      // Retrospectively sync with saved flight log in BigQuery/state if flight was already completed/logged
      const cleanEditingFlight = (editingFrtFlight.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      const flightDate = editingFrtFlight.date ? editingFrtFlight.date.split('T')[0] : todayDate;

      const matchingLogs = (flightLogs || []).filter(log => {
        if (!log || !log.flightNumber) return false;
        const logFlight = log.flightNumber.replace(/\s+/g, '').toUpperCase();
        if (logFlight !== cleanEditingFlight) return false;
        const logDate = log.operationalDate ? log.operationalDate.split('T')[0] : '';
        if (logDate && flightDate && logDate !== flightDate) return false;
        return true;
      });

      for (const log of matchingLogs) {
        if (log.id && updateFlightLog) {
          try {
            await updateFlightLog(log.id, {
              std: updates.std,
              tobt: updates.tobt,
              frtAirline: updates.frtAirline,
              frtAocc: updates.frtAocc,
              frtFor: updates.frtFor,
            });
          } catch (logErr) {
            console.warn(`[Schedule] Could not update saved flight log ${log.id} with FRT:`, logErr);
          }
        }
      }

      notify(`Timings & FRT updated for Flight ${editingFrtFlight.flightNumber}`, 'success');
    } catch (err) {
      console.error('Failed to update timings & FRT:', err);
      notify('Failed to update timings. Please try again.', 'error');
    }
  };

  const handleAssignDomestic = async (teamId: string, opIndex: 1 | 2, userId: string) => {
    if (isHistoricalView) return;
    const team = domesticTeams.find(t => t.id === teamId);
    if (team) {
      const newOp1 = opIndex === 1 ? userId : team.op1;
      const newOp2 = opIndex === 2 ? userId : team.op2;
      try {
        await updateDomesticAssignment(team.name, newOp1, newOp2);
      } catch (error) {
        console.error("Failed to save domestic assignment:", error);
      }
    }
  };

  const handleAssignEquipment = async (eqId: string, opIndex: 1 | 2, userId: string) => {
    if (isHistoricalView) return;
    const updatedEqs = equipmentAssignments.map(eq => {
      if (eq.id === eqId) {
        return opIndex === 1 ? { ...eq, op1: userId } : { ...eq, op2: userId };
      }
      return eq;
    });
    setEquipmentAssignments(updatedEqs);

    const eq = updatedEqs.find(e => e.id === eqId);
    if (eq) {
      try {
        await supabaseService.upsertEquipmentAssignment(todayDate, eq.eqNumber, currentShiftLabel, eq.op1, eq.op2);
      } catch (error) {
        console.error("Failed to save equipment assignment:", error);
      }
    }
  };



  const renderOperatorSelect = (value: string, onChange: (val: string) => void, disabled?: boolean) => {
    const isDisabled = disabled || isHistoricalView;
    const isAssigned = Boolean(value && (operators.some(op => op.id === value) || allStaff.some(s => s.id === value)));
    const extraStaff = (value && !operators.some(op => op.id === value)) ? allStaff.find(s => s.id === value) : null;

    return (
      <div className="relative group/select">
        <select
          value={isAssigned ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={`block w-full text-[10px] font-bold rounded-xl focus:border-primary px-3 py-2 border uppercase tracking-wider appearance-none transition-colors ${
            isDisabled
              ? 'bg-surface-dim/40 text-on-surface-dim/40 border-outline/30 cursor-not-allowed select-none opacity-40'
              : isAssigned
                ? 'bg-surface-dim text-on-surface border-outline'
                : 'bg-surface-dim text-error border-outline'
          }`}
        >
          <option value="" className="bg-surface-dim text-error font-bold">-- UNASSIGNED --</option>
          {operators.map(op => (
            <option key={op.id} value={op.id} className="bg-surface-dim text-on-surface">{op.name.toUpperCase()}</option>
          ))}
          {extraStaff && (
            <option key={extraStaff.id} value={extraStaff.id} className="bg-surface-dim text-on-surface">
              {extraStaff.name.toUpperCase()}
            </option>
          )}
        </select>
        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-dim pointer-events-none ${isDisabled ? 'opacity-20' : 'opacity-40'}`} />
      </div>
    );
  };

  const tabLabels: Record<string, string> = {
    international: 'International',
    domestic: 'Domestic',
    adhoc: 'Ad-Hoc',
    equipment: currentShiftLabel,
    status: 'Status Board',
    live: 'Live Feed'
  };

  const tooltipPositions: Record<string, string> = {
    international: 'calc(8.333% + 5px)',
    domestic: 'calc(25% + 3px)',
    adhoc: 'calc(41.666% + 1px)',
    equipment: 'calc(58.333% - 1px)',
    status: 'calc(75% - 3px)',
    live: 'calc(91.666% - 5px)'
  };

  const formatDateWithWeekday = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const dayStr = String(day).padStart(2, '0');
    return `${weekday}, ${dayStr}-${monthName}-${year}`;
  };

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            SHIFT <span className="text-primary italic font-medium ml-3">OPERATIONS</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em]">FUEL SERVICES HUB</span>
            <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Fleet Deployment Active</span>
            {isHistoricalView && (
              <>
                <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                <div className="flex items-center space-x-2 px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/30">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">HISTORY MODE — READ ONLY</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {/* Date Picker */}
            <div className={`relative flex items-center border rounded-xl shadow-inner focus-within:border-primary transition-colors flex-1 sm:flex-none w-full sm:w-auto min-w-[200px] sm:min-w-[230px] px-3.5 py-2.5 cursor-pointer ${isHistoricalView ? 'bg-amber-500/5 border-amber-500/30 focus-within:border-amber-500' : 'bg-surface-dim border-outline'}`}>
              <Calendar className={`w-4 h-4 mr-2.5 shrink-0 ${isHistoricalView ? 'text-amber-400' : 'text-primary'}`} />
              <span className="text-[11px] font-black text-on-surface uppercase tracking-wider whitespace-nowrap">
                {formatDateWithWeekday(selectedBriefingDate)}
              </span>
              <input
                type="date"
                id="schedule-date-picker"
                value={selectedBriefingDate}
                max={todayStr}
                onChange={(e) => setSelectedBriefingDate(e.target.value)}
                onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Return to Today */}
            {isHistoricalView && (
              <button
                onClick={() => setSelectedBriefingDate(todayStr)}
                className="flex items-center space-x-2 px-3 sm:px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-amber-400 transition-all shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Return to Today</span>
              </button>
            )}
          </div>

          {/* Shift Selector */}
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedBriefingShift || ""}
              onChange={(e) => setSelectedBriefingShift(e.target.value as BriefingShift)}
              className="w-full sm:w-auto appearance-none px-6 py-3 pr-10 kinetic-gradient text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-premium cursor-pointer outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="Morning" className="bg-surface-dim text-on-surface">Morning (07:30-16:00)</option>
              <option value="Evening" className="bg-surface-dim text-on-surface">Evening (15:00-23:30)</option>
              <option value="Night" className="bg-surface-dim text-on-surface">Night (22:30-08:30)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative">
        <div className="bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner relative flex w-full md:w-fit overflow-x-visible md:overflow-x-auto scrollbar-none">
          <div
            className={`absolute top-1.5 bottom-1.5 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
              ${activeTab === 'international' ? 'w-[calc(16.666%-2px)] left-1.5 md:w-[140px] md:translate-x-0' : ''}
              ${activeTab === 'domestic' ? 'w-[calc(16.666%-2px)] left-[calc(16.666%+4px)] md:w-[110px] md:left-1.5 md:translate-x-[140px]' : ''}
              ${activeTab === 'adhoc' ? 'w-[calc(16.666%-2px)] left-[calc(33.333%+2px)] md:w-[110px] md:left-1.5 md:translate-x-[250px]' : ''}
              ${activeTab === 'equipment' ? 'w-[calc(16.666%-2px)] left-[50%] md:w-[110px] md:left-1.5 md:translate-x-[360px]' : ''}
              ${activeTab === 'status' ? 'w-[calc(16.666%-2px)] left-[calc(66.666%-2px)] md:w-[150px] md:left-1.5 md:translate-x-[470px]' : ''}
              ${activeTab === 'live' ? 'w-[calc(16.666%-2px)] left-[calc(83.333%-4px)] md:w-[150px] md:left-1.5 md:translate-x-[620px]' : ''}
            `}
          />
          <button
            onClick={() => {
              setActiveTab('international');
              triggerTooltip('international');
            }}
            className={`flex-1 md:w-[140px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'international' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'international' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                International
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:block whitespace-nowrap">International</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('domestic');
              triggerTooltip('domestic');
            }}
            className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'domestic' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'domestic' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                Domestic
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:block whitespace-nowrap">Domestic</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('adhoc');
              triggerTooltip('adhoc');
            }}
            className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'adhoc' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'adhoc' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                Ad-Hoc
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:block whitespace-nowrap">Ad-Hoc</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('equipment');
              triggerTooltip('equipment');
            }}
            className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'equipment' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'equipment' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                {currentShiftLabel}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            {currentShiftLabel === 'DIESEL' ? (
              <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            ) : (
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            )}
            <span className="hidden md:block whitespace-nowrap">{currentShiftLabel}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('status');
              triggerTooltip('status');
            }}
            className={`flex-1 md:w-[150px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'status' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'status' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                Status Board
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:block whitespace-nowrap">Status Board</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('live');
              triggerTooltip('live');
            }}
            className={`flex-1 md:w-[150px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${activeTab === 'live' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
          >
            {activeTooltip === 'live' && (
              <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                Live Feed
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
              </div>
            )}
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden md:block whitespace-nowrap">Live Feed</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="md:bg-surface md:rounded-3xl md:border md:border-outline md:overflow-hidden md:shadow-sm relative">
        <div key={activeTab}>
          {/* International Ops */}
          {activeTab === 'international' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500 space-y-4">

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-outline">
                  <thead className="bg-surface-dim">
                    <tr>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">FLIGHT / TASK</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">REG / TYPE / ROUTE</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TIMINGS</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">OPERATOR ASSIGNED</th>
                      <th className="px-4 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-outline text-on-surface">
                    {scheduledFlights.map((item, idx) => {
                      const logoUrl = getLogoUrl(item.flightNumber);
                      const delayed = isDelayed(item.sta, item.eta);
                      const activeEquipmentUsage = item.equipmentUsage || 'HYDRANT';
                      const isDeparted = (item.status || '').toUpperCase() === 'DEPARTED';
                      return (
                        <tr key={item.id} className={`hover:bg-primary/[0.02] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {/* Yellow gradient stand badge */}
                              <div 
                                onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(item); } : undefined}
                                className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                  isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500 shadow-md' : ''
                                }`}
                                title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                              >
                                <span>{item.stand}</span>
                                {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xl font-[900] tracking-tighter italic">{item.flightNumber}</span>
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
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-6">
                              <div>
                                <div className="text-sm font-black tracking-tight">{item.aircraftReg}</div>
                                <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{item.aircraftType}</div>
                              </div>
                              <div className="h-6 w-[1px] bg-outline/30" />
                              <div>
                                {renderRoute(item.route)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div 
                              onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtFlight(item); } : undefined}
                              className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest bg-surface-dim/30 px-3.5 py-2 rounded-full border border-outline w-fit ${
                                isItpManagerOrAdmin ? 'cursor-pointer hover:border-primary/60 hover:bg-surface-dim/70 active:scale-[0.98] transition-all' : ''
                              }`}
                              title={isItpManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-on-surface-dim opacity-40">STA</span>
                                <span className="text-on-surface text-xs font-black tracking-tight">{(item as any).sta || '--:--'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</span>
                                <span className={`${delayed ? 'text-error' : 'text-primary'} text-xs font-black tracking-tight`}>{item.eta || '--:--'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-warning opacity-60">STD</span>
                                <span className="text-warning text-xs font-black tracking-tight">{(item as any).std || '--:--'}</span>
                              </div>
                              {item.tobt && (
                                <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                                  <span className="opacity-70 text-[9px]">TOBT</span>
                                  <span className="text-xs font-black tracking-tight">{item.tobt}</span>
                                </div>
                              )}
                              {(item.frtAirline || item.frtAocc || item.frtFor) && (
                                <div className="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20 text-[9px]">
                                  <span className="opacity-70">FRT</span>
                                  <span>{item.frtFor || item.frtAirline || item.frtAocc}</span>
                                </div>
                              )}
                              {isItpManagerOrAdmin && (
                                <Clock className="w-3 h-3 text-primary opacity-50 hover:opacity-100 transition-opacity ml-0.5" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap w-[320px]">
                            {activeEquipmentUsage === 'REFUELLER' ? (
                              <div className="flex space-x-2">
                                <div className="flex-1">
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                  {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val, item), isDeparted)}
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                                  {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val, item), isDeparted)}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val, item), isDeparted)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end items-center gap-3">
                              {renderStatusBadge(item.status)}
                              <button 
                                onClick={() => handleAssignFlight(item.id, 'equipmentUsage', activeEquipmentUsage === 'HYDRANT' ? 'REFUELLER' : 'HYDRANT', item)} 
                                className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all shrink-0 cursor-pointer ${
                                  activeEquipmentUsage === 'HYDRANT' 
                                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent' 
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent'
                                }`}
                              >
                                {activeEquipmentUsage === 'HYDRANT' ? 'HD' : 'RF'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-4">
                {scheduledFlights.map((item) => {
                  const logoUrl = getLogoUrl(item.flightNumber);
                  const delayed = isDelayed(item.sta, item.eta);
                  const activeEquipmentUsage = item.equipmentUsage || 'HYDRANT';
                  const isDeparted = (item.status || '').toUpperCase() === 'DEPARTED';
                  return (
                    <div key={item.id} className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-outline group transition-all w-full shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center min-w-0">
                          <div className="flex items-center gap-3">
                            {/* Yellow gradient stand badge */}
                            <div 
                              onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(item); } : undefined}
                              className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                              }`}
                              title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                            >
                              <span>{item.stand}</span>
                              {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{item.flightNumber}</h3>
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
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-0.5">
                                <span>{item.aircraftReg} • {item.aircraftType}</span>
                                {item.route && (
                                  <>
                                    <span>•</span>
                                    {renderRoute(item.route, "text-[10px]", true)}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtFlight(item); } : undefined}
                        className={`grid ${item.tobt ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mb-6 p-3 bg-surface-dim rounded-xl border border-outline ${
                          isItpManagerOrAdmin ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''
                        }`}
                        title={isItpManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                      >
                        <div className="text-center border-r border-outline/30">
                          <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                          <p className="text-[11px] font-[900] text-on-surface">{(item as any).sta || '--:--'}</p>
                        </div>
                        <div className="text-center border-r border-outline/30">
                          <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                          <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{item.eta}</p>
                        </div>
                        <div className={`text-center ${item.tobt ? 'border-r border-outline/30' : ''}`}>
                          <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                          <p className="text-[11px] font-[900] text-warning">{(item as any).std || '--:--'}</p>
                        </div>
                        {item.tobt && (
                          <div className="text-center">
                            <p className="text-[8px] font-black text-amber-400 opacity-80 uppercase tracking-widest mb-1">TOBT</p>
                            <p className="text-[11px] font-[900] text-amber-400">{item.tobt}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Assigned Crew</label>
                          <button 
                            onClick={() => handleAssignFlight(item.id, 'equipmentUsage', activeEquipmentUsage === 'HYDRANT' ? 'REFUELLER' : 'HYDRANT', item)} 
                            className={`px-3 py-1 text-[8px] font-black uppercase rounded transition-all cursor-pointer ${
                              activeEquipmentUsage === 'HYDRANT' 
                                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent' 
                                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent'
                            }`}
                          >
                            {activeEquipmentUsage === 'HYDRANT' ? 'HD' : 'RF'}
                          </button>
                        </div>
                        {activeEquipmentUsage === 'REFUELLER' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                              {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val, item), isDeparted)}
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                              {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val, item), isDeparted)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                            {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val, item), isDeparted)}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline/30">
                        <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Status</span>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(item.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Domestic Ops */}
          {activeTab === 'domestic' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4 md:space-y-6 md:p-8 lg:p-10">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                Squadron Assignments
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
                {domesticTeams.map((team, idx) => (
                  <div key={team.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                    <div className="flex items-center mb-8">
                      <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                        <Users className="w-5 h-5 text-on-surface" />
                      </div>
                      <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{team.name}</h4>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">RF OPERATOR</label>
                        {renderOperatorSelect(team.op1, (val) => handleAssignDomestic(team.id, 1, val))}
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">OFFICER</label>
                        {renderOperatorSelect(team.op2, (val) => handleAssignDomestic(team.id, 2, val))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block bg-surface-lowest border border-outline rounded-[32px] overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-outline">
                    <thead className="bg-surface-dim">
                      <tr>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TASK ID</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ASSET / SECTOR</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STD</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline text-on-surface">
                      {domesticFlightsToRender.map((flight, idx) => {
                        const logoUrl = getLogoUrl(flight.flightNumber);
                        return (
                          <tr key={flight.id} className={`hover:bg-primary/[0.01] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {/* Yellow gradient stand badge */}
                                <div 
                                  onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(flight); } : undefined}
                                  className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                    isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                                  }`}
                                  title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                                >
                                  <span>{flight.stand}</span>
                                  {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-lg font-[900] italic tracking-tighter">{flight.flightNumber}</span>
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
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="text-sm font-black tracking-tight">{flight.aircraftType}</div>
                              <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                <span>{flight.aircraftReg}</span>
                                {flight.route && (
                                  <>
                                    <span>•</span>
                                    {renderRoute(flight.route, "text-[10px]", true)}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center text-sm font-black">
                                <Clock className="w-4 h-4 mr-2.5 opacity-40" />
                                {flight.std || '--:--'}
                              </div>
                            </td>

                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(flight.status)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-4">
                {domesticFlightsToRender.map((flight) => {
                  const logoUrl = getLogoUrl(flight.flightNumber);
                  const delayed = isDelayed(flight.sta, flight.eta);
                  return (
                    <div key={flight.id} className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-outline group transition-all w-full shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center min-w-0">
                          <div className="flex items-center gap-3">
                            <div 
                              onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(flight); } : undefined}
                              className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                              }`}
                              title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                            >
                              <span>{flight.stand}</span>
                              {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{flight.flightNumber}</h3>
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
                              </div>
                              <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                                <span>{flight.aircraftReg}</span>
                                <span>•</span>
                                <span>{flight.aircraftType}</span>
                                {flight.route && (
                                  <>
                                    <span>•</span>
                                    {renderRoute(flight.route, "text-[10px]", true)}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center items-center p-3 bg-surface-dim rounded-xl border border-outline">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                          <p className="text-[14px] font-[900] text-warning">{flight.std || '--:--'}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline/30">
                        <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Status</span>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(flight.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ad-Hoc Assignments */}
          {activeTab === 'adhoc' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4 md:space-y-6 md:p-8 lg:p-10">
              {/* Desktop View */}
              <div className="hidden md:block bg-surface-lowest border border-outline rounded-[32px] overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-outline">
                    <thead className="bg-surface-dim">
                      <tr>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TASK ID</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ASSET / SECTOR</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STD</th>
                        <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline text-on-surface">
                      {adhocFlightsToRender.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-on-surface-dim font-bold text-xs uppercase tracking-wider">
                            No ad-hoc flights scheduled for this shift
                          </td>
                        </tr>
                      ) : (
                        adhocFlightsToRender.map((flight, idx) => {
                        const logoUrl = getLogoUrl(flight.flightNumber);
                        return (
                          <tr key={flight.id} className={`hover:bg-primary/[0.01] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {/* Yellow gradient stand badge */}
                                <div 
                                  onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(flight); } : undefined}
                                  className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                    isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                                  }`}
                                  title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                                >
                                  <span>{flight.stand}</span>
                                  {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-lg font-[900] italic tracking-tighter">{flight.flightNumber}</span>
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
                                  <span className="ml-2 bg-amber-500/10 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/20">
                                    Ad-Hoc
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="text-sm font-black tracking-tight text-on-surface">{flight.aircraftReg}</div>
                              <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                <span>{flight.aircraftType}</span>
                                {flight.route && (
                                  <>
                                    <span>•</span>
                                    {renderRoute(flight.route, "text-[10px]", true)}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center text-sm font-black text-warning">
                                <Clock className="w-4 h-4 mr-2.5 opacity-40" />
                                {flight.std || '--:--'}
                              </div>
                            </td>

                            <td className="px-4 py-6 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {renderStatusBadge(flight.status)}
                              </div>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden space-y-4">
                {adhocFlightsToRender.length === 0 ? (
                  <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline text-center">
                    <p className="text-on-surface-dim font-bold text-xs uppercase tracking-wider">No ad-hoc flights scheduled for this shift</p>
                  </div>
                ) : (
                  adhocFlightsToRender.map((flight) => {
                  const logoUrl = getLogoUrl(flight.flightNumber);
                  return (
                    <div key={flight.id} className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-outline group transition-all w-full shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center min-w-0">
                          <div className="flex items-center gap-3">
                            <div 
                              onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingStandFlight(flight); } : undefined}
                              className={`bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider flex items-center gap-1 ${
                                isItpManagerOrAdmin ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all ring-1 ring-amber-400/40 hover:ring-amber-500' : ''
                              }`}
                              title={isItpManagerOrAdmin ? "Click to change stand" : undefined}
                            >
                              <span>{flight.stand}</span>
                              {isItpManagerOrAdmin && <Pencil className="w-2.5 h-2.5 opacity-60" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{flight.flightNumber}</h3>
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
                                <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/20">
                                  Ad-Hoc
                                </span>
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-on-surface font-black">{flight.aircraftReg}</span>
                                <span className="text-on-surface-dim opacity-40">•</span>
                                <span className="text-on-surface-dim opacity-40 font-bold">{flight.aircraftType}</span>
                                {flight.route && (
                                  <>
                                    <span className="text-on-surface-dim opacity-40">•</span>
                                    {renderRoute(flight.route, "text-[10px]", true)}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={isItpManagerOrAdmin ? (e) => { e.stopPropagation(); setEditingFrtFlight(flight); } : undefined}
                        className={`flex items-center justify-between mb-6 p-3 bg-surface-dim rounded-xl border border-outline ${
                          isItpManagerOrAdmin ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''
                        }`}
                        title={isItpManagerOrAdmin ? "Click to record / edit DEP STD, TOBT, and FRT" : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest">STD</p>
                          <p className="text-[12px] font-[900] text-warning">{flight.std || '--:--'}</p>
                        </div>
                        {flight.tobt && (
                          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/30">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-80">TOBT</p>
                            <p className="text-[11px] font-[900]">{flight.tobt}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline/30">
                        <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Status</span>
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(flight.status)}
                        </div>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>
          )}

          {/* Equipment Assignments */}
          {activeTab === 'equipment' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                  <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                  Tactical Fleet Assignment - {currentShiftLabel}
                </h3>
              </div>

              <div className="space-y-12">
                {['Refueller', 'Hydrant Dispenser'].map(type => {
                  const eqs = equipmentAssignments.filter(eq => (currentShiftLabel === 'DAILY' || dieselNeeds.includes(eq.eqNumber)) && eq.eqType === type);
                  if (eqs.length === 0) return null;
                  return (
                    <div key={type}>
                      <h4 className="text-xs font-black text-on-surface-dim uppercase tracking-[0.3em] mb-6 border-b border-outline pb-2">
                        {type === 'Refueller' ? 'Refuellers (RF)' : 'Hydrant Dispensers (HD)'}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                        {eqs.map(eq => (
                          <div key={eq.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center">
                                <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                                  <Truck className="w-5 h-5 text-on-surface" />
                                </div>
                                <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{eq.eqNumber}</h4>
                              </div>
                              {dieselNeeds.includes(eq.eqNumber) && (
                                <div className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 shadow-sm animate-pulse">
                                  <Droplet className="w-3 h-3" />
                                  <span className="text-[8px] font-black uppercase tracking-widest">DIESEL</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-6">
                              <div>
                                <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Operator</label>
                                {renderOperatorSelect(eq.op1, (val) => handleAssignEquipment(eq.id, 1, val))}
                              </div>
                              {type === 'Refueller' && currentShiftLabel !== 'DIESEL' && (
                                <div>
                                  <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Officer</label>
                                  {renderOperatorSelect(eq.op2, (val) => handleAssignEquipment(eq.id, 2, val))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Board */}
          {activeTab === 'status' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-6 lg:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline">
                <div className="flex items-center">
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                    <span className="w-1.5 h-6 bg-primary rounded-full mr-3.5"></span>
                    Operator Task Boards
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-surface-dim border border-outline text-on-surface-dim">
                    {selectedBriefingShift} Shift
                  </span>
                  <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">
                    {statusBoardOperators.length} Personnel Active
                  </span>
                </div>
              </div>

              {statusBoardOperators.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-outline bg-surface-dim/20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-dim border border-outline flex items-center justify-center text-on-surface-dim opacity-50">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-on-surface uppercase tracking-wider">
                      No Personnel Allocated in {selectedBriefingShift} Shift
                    </h4>
                    <p className="text-[11px] text-on-surface-dim opacity-50 max-w-sm">
                      Assign operators or officers to flights in the International tab to track their live status here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                  {statusBoardOperators.map((op) => {
                    const rawOpTasks = scheduledFlights.filter((j: any) => j.assignedTo === op.id || j.assignedOfficer === op.id);
                    const opTasks = rawOpTasks.map((t: any) => {
                      const normNo = (t.flightNumber || '').replace(/\s+/g, '').toUpperCase();
                      const tDate = t.date ? t.date.split('T')[0] : selectedBriefingDate;
                      const live = (flightJobs || []).find(fj => {
                        const fjDate = fj.date ? fj.date.split('T')[0] : '';
                        const dateMatches = !fjDate || !tDate || fjDate === tDate;
                        return dateMatches && ((t.id && fj.id === t.id) || ((fj.flightNumber || '').replace(/\s+/g, '').toUpperCase() === normNo));
                      });
                      if (live) {
                        return { ...t, status: live.status || t.status, vehicleId: live.vehicleId || t.vehicleId };
                      }
                      return t;
                    });
                    const liveAssigned = (flightJobs || []).find(fj => {
                      const fjDate = fj.date ? fj.date.split('T')[0] : '';
                      const dateMatches = !fjDate || !selectedBriefingDate || fjDate === selectedBriefingDate;
                      return dateMatches && 
                        (fj.assignedTo === op.id || fj.assignedOfficer === op.id) && 
                        (fj.status || '').toUpperCase().replace(/[\s_]+/g, '_') === 'IN_PROGRESS';
                    });
                    const activeTask = liveAssigned || opTasks.find((j: any) => (j.status || '').toUpperCase().replace(/[\s_]+/g, '_') === 'IN_PROGRESS');
                    const pendingCount = opTasks.filter((j: any) => { 
                      const s = (j.status || '').toUpperCase().replace(/[\s_]+/g, '_'); 
                      return s !== 'COMPLETED' && s !== 'IN_PROGRESS'; 
                    }).length;
                    const doneCount = opTasks.filter((j: any) => { 
                      const s = (j.status || '').toUpperCase().replace(/[\s_]+/g, '_'); 
                      return s === 'COMPLETED'; 
                    }).length;

                    const eqAssignment = equipmentAssignments.find(a => a.op1 === op.id || a.op2 === op.id);
                    const domAssignment = domesticTeams.find(a => a.op1 === op.id || a.op2 === op.id);
                    const initials = getStaffInitials(op.name);

                    return (
                      <div
                        key={op.id}
                        className="card-premium p-3 sm:p-3.5 rounded-xl border border-outline hover:border-primary/30 transition-all group relative overflow-hidden flex flex-col justify-between space-y-2.5 bg-surface"
                      >
                        {/* Top glow hover effect */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                        {/* Header: Avatar, Name/Role, Status Badge */}
                        <div className="flex items-center justify-between gap-2 relative z-10">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {op.avatar ? (
                              <img
                                src={op.avatar}
                                alt=""
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                  (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                                }}
                                className="w-8 h-8 rounded-lg border border-outline shadow-sm group-hover:scale-105 transition-transform shrink-0 object-cover"
                              />
                            ) : null}
                            <div className={`${op.avatar ? 'hidden' : ''} w-8 h-8 rounded-lg border border-outline bg-surface-dim text-on-surface font-[900] text-[10px] flex items-center justify-center tracking-wider shrink-0 shadow-sm`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-[900] text-on-surface uppercase tracking-tight truncate" title={op.name}>
                                {op.name}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[8px] font-[900] border uppercase tracking-wider shrink-0 transition-all ${
                              activeTask
                                ? 'bg-success/10 text-success border-success/30 shadow-[0_0_8px_rgba(34,197,94,0.15)]'
                                : 'bg-surface-dim text-on-surface-dim border-outline opacity-60'
                            }`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTask ? 'bg-success animate-pulse' : 'bg-on-surface-dim opacity-40'}`} />
                            <span className="whitespace-nowrap">
                              {activeTask ? (
                                <>{activeTask.flightNumber}{activeTask.vehicleId && <span className="ml-1 opacity-60">({activeTask.vehicleId})</span>}</>
                              ) : 'Standby'}
                            </span>
                          </div>
                        </div>

                        {/* Equipment / Assignment Badge if any */}
                        {(eqAssignment || domAssignment) && (
                          <div className="flex items-center gap-1.5 bg-surface-dim/50 border border-outline/50 px-2 py-1 rounded-lg text-[9px] font-black text-on-surface relative z-10">
                            {eqAssignment ? (
                              <>
                                <Truck className="w-3 h-3 text-primary opacity-70 shrink-0" />
                                <span className="uppercase tracking-wider">{eqAssignment.eqNumber}</span>
                                <span className="opacity-40 text-[8px]">({eqAssignment.eqType})</span>
                                <span className="text-[8px] text-on-surface-dim opacity-40 uppercase tracking-widest ml-auto">{eqAssignment.shift_type || 'Active'}</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-3 h-3 text-primary opacity-70 shrink-0" />
                                <span className="uppercase tracking-wider text-primary truncate">{domAssignment?.name}</span>
                                <span className="text-[8px] text-primary opacity-50 uppercase tracking-widest ml-auto">Domestic</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Mini stats: Total / Pending / Done */}
                        <div className="grid grid-cols-3 gap-1 bg-surface-dim/40 p-1.5 rounded-xl border border-outline/40 relative z-10">
                          <div className="flex flex-col items-center py-0.5">
                            <span className="text-xs sm:text-sm font-[900] text-on-surface leading-none">{opTasks.length}</span>
                            <span className="text-[7.5px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-0.5">Total</span>
                          </div>
                          <div className="flex flex-col items-center py-0.5 border-x border-outline/30">
                            <span className="text-xs sm:text-sm font-[900] text-warning leading-none">{pendingCount}</span>
                            <span className="text-[7.5px] font-black text-warning opacity-70 uppercase tracking-widest mt-0.5">Pending</span>
                          </div>
                          <div className="flex flex-col items-center py-0.5">
                            <span className="text-xs sm:text-sm font-[900] text-success leading-none">{doneCount}</span>
                            <span className="text-[7.5px] font-black text-success opacity-70 uppercase tracking-widest mt-0.5">Done</span>
                          </div>
                        </div>

                        {/* Flight Tasks Chips */}
                        <div className="relative z-10 pt-0.5">
                          {opTasks.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto custom-scrollbar">
                              {opTasks.map(job => {
                                const delayed = isDelayed(job.sta, job.eta);
                                const ds = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
                                const statusColor = ds === 'COMPLETED'
                                  ? 'bg-success/15 text-success border-success/30'
                                  : ds === 'IN_PROGRESS'
                                    ? 'bg-warning/15 text-warning border-warning/30 animate-pulse'
                                    : ds === 'DELAYED'
                                      ? 'bg-error/15 text-error border-error/30 animate-pulse'
                                      : 'bg-surface-dim text-on-surface-dim border-outline/60';
                                return (
                                  <div
                                    key={job.id}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8.5px] font-bold ${statusColor}`}
                                    title={`${job.flightNumber} | ${job.aircraftType || ''} | ${job.vehicleId || ''} | ${ds}`}
                                  >
                                    <Plane className="w-2.5 h-2.5 opacity-50 shrink-0" />
                                    <span className="font-black italic">{job.flightNumber}</span>
                                    {job.vehicleId && (
                                      <span className="text-[7.5px] font-black opacity-70">({job.vehicleId})</span>
                                    )}
                                    <span className="text-[7px] font-black opacity-80 uppercase ml-0.5">
                                      {ds === 'IN_PROGRESS' ? 'IN PROG' : ds === 'COMPLETED' ? 'DONE' : ds}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[8.5px] font-bold text-on-surface-dim/40 text-center py-0.5 uppercase tracking-wider">
                              No flights assigned
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
{/* Live Airport Feed */}
          {activeTab === 'live' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500 p-4 md:p-8 space-y-6">
              {/* Header controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-dim p-4 rounded-2xl border border-outline">
                <div className="flex flex-row items-center justify-between w-full lg:w-auto gap-3">
                  {/* Arrivals / Departures toggle */}
                  <div className="relative flex items-center bg-surface p-1 rounded-xl border border-outline w-[90px] sm:w-[240px] h-[38px] select-none shrink-0">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg kinetic-gradient transition-all duration-300 ease-out"
                      style={{
                        left: fidsType === 'arrival' ? '4px' : 'calc(50% + 2px)',
                        width: 'calc(50% - 6px)',
                      }}
                    />
                    <button
                      onClick={() => setFidsType('arrival')}
                      data-tooltip="Arrivals"
                      className={`custom-tooltip relative z-10 w-1/2 h-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${fidsType === 'arrival'
                        ? 'text-white'
                        : 'text-on-surface-dim hover:text-on-surface'
                        }`}
                    >
                      <PlaneLanding className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Arrivals</span>
                    </button>
                    <button
                      onClick={() => setFidsType('departure')}
                      data-tooltip="Departures"
                      className={`custom-tooltip relative z-10 w-1/2 h-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${fidsType === 'departure'
                        ? 'text-white'
                        : 'text-on-surface-dim hover:text-on-surface'
                        }`}
                    >
                      <PlaneTakeoff className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Departures</span>
                    </button>
                  </div>

                  {/* Category filters (MOBILE VERSION: hidden on lg) */}
                  <div className="lg:hidden relative flex items-center bg-surface p-1 rounded-xl border border-outline w-[130px] h-[38px] select-none shrink-0">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg kinetic-gradient transition-all duration-300 ease-out"
                      style={{
                        left: fidsCategory === 'all'
                          ? '4px'
                          : fidsCategory === 'international'
                            ? 'calc(33.33% + 2px)'
                            : 'calc(66.66% + 2px)',
                        width: 'calc(33.33% - 6px)',
                      }}
                    />
                    {['all', 'international', 'domestic'].map((cat) => {
                      const IconComponent = cat === 'all' ? Globe : cat === 'international' ? Plane : Home;
                      return (
                        <button
                          key={cat}
                          onClick={() => setFidsCategory(cat as any)}
                          data-tooltip={cat}
                          className={`custom-tooltip relative z-10 w-1/3 h-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${fidsCategory === cat
                            ? 'text-white'
                            : 'text-on-surface-dim hover:text-on-surface'
                            }`}
                        >
                          <IconComponent className="w-4 h-4 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right container (Desktop toggles + search + refresh) */}
                <div className="flex flex-row items-center justify-between lg:justify-end gap-4 w-full lg:w-auto">
                  {/* Category filters (DESKTOP VERSION: hidden on mobile) */}
                  <div className="hidden lg:flex relative items-center bg-surface p-1 rounded-xl border border-outline w-[420px] h-[38px] select-none shrink-0">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg kinetic-gradient transition-all duration-300 ease-out"
                      style={{
                        left: fidsCategory === 'all'
                          ? '4px'
                          : fidsCategory === 'international'
                            ? 'calc(33.33% + 2px)'
                            : 'calc(66.66% + 2px)',
                        width: 'calc(33.33% - 6px)',
                      }}
                    />
                    {['all', 'international', 'domestic'].map((cat) => {
                      const IconComponent = cat === 'all' ? Globe : cat === 'international' ? Plane : Home;
                      return (
                        <button
                          key={cat}
                          onClick={() => setFidsCategory(cat as any)}
                          data-tooltip={cat}
                          className={`custom-tooltip relative z-10 w-1/3 h-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 ${fidsCategory === cat
                            ? 'text-white'
                            : 'text-on-surface-dim hover:text-on-surface'
                            }`}
                        >
                          <IconComponent className="w-4 h-4 shrink-0" />
                          <span className="hidden sm:inline">{cat}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 lg:flex-none">
                    <input
                      type="text"
                      value={fidsSearchQuery}
                      onChange={(e) => setFidsSearchQuery(e.target.value)}
                      placeholder="SEARCH FLIGHT..."
                      className="w-full lg:w-48 pl-4 pr-10 py-2.5 bg-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-wider outline-none focus:border-primary transition-all"
                    />
                    {fidsSearchQuery && (
                      <button
                        onClick={() => setFidsSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-dim hover:text-on-surface text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Refresh */}
                  <button
                    onClick={() => refreshExternalFlights()}
                    disabled={isExternalFlightsLoading}
                    className={`p-2.5 bg-surface border border-outline hover:border-primary/30 rounded-xl text-on-surface-dim hover:text-on-surface transition-all ${isExternalFlightsLoading ? 'animate-spin' : ''}`}
                    title="Refresh Live Data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* FIDS Table / Feed */}
              {isExternalFlightsLoading && externalFlights.length === 0 ? (
                <div className="px-6 py-20 flex flex-col items-center justify-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-60" />
                  <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Fetching live airport data...</p>
                </div>
              ) : filteredFidsFlights.length === 0 ? (
                <div className="px-6 py-20 border border-dashed border-outline rounded-[32px] flex flex-col items-center justify-center text-center opacity-50">
                  <Plane className="w-10 h-10 text-on-surface-dim opacity-30 mb-4" />
                  <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em]">No flights found</p>
                  <p className="text-[9px] font-medium text-on-surface-dim opacity-60 uppercase tracking-wider mt-1">Try adjusting your filters or search query</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-outline shadow-sm">
                  <table className="min-w-full divide-y divide-outline">
                    <thead className="bg-surface-dim">
                      <tr>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Airline</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Flight</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">{fidsType === 'arrival' ? 'Origin' : 'Destination'}</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Scheduled</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Estimated</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Gate</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Terminal</th>
                        <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Live Status</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-outline">
                      {filteredFidsFlights.map((flight, idx) => {
                        const isImported = isFlightImported(flight.flightNumber);
                        const importedJob = flightJobs.find(job => (job.flightNumber || '').replace(/\s+/g, '').toLowerCase() === (flight.flightNumber || '').replace(/\s+/g, '').toLowerCase());
                        const statusColor = getFidsStatusColor(flight.status);
                        const airlineCode = (flight.airlineCode || flight.flightNumber || '').replace(/\s+/g, '').slice(0, 2).toUpperCase();

                        return (
                          <tr key={flight.id || idx} className="hover:bg-primary/[0.01] transition-colors group">
                            {/* Airline */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-dim border border-outline flex items-center justify-center font-black text-[10px] text-on-surface-dim uppercase overflow-hidden relative">
                                  {airlineCode ? (
                                    <>
                                      <img
                                        src={`https://fis.com.mv/tail/${airlineCode}.png`}
                                        alt={flight.airlineCode}
                                        onError={(e) => { (e.target as any).style.display = 'none'; }}
                                        className="w-full h-full object-contain p-1 absolute inset-0 bg-surface-dim z-10"
                                      />
                                      <span className="group-hover:scale-110 transition-transform relative z-0">{flight.airlineCode || flight.airline?.slice(0, 2)}</span>
                                    </>
                                  ) : (
                                    <span className="group-hover:scale-110 transition-transform">{flight.airlineCode || flight.airline?.slice(0, 2)}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[11px] font-black text-on-surface uppercase tracking-tight">{flight.airline}</p>
                                  <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{flight.category}</p>
                                </div>
                              </div>
                            </td>
                            {/* Flight Number */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-[14px] font-[900] text-on-surface italic tracking-tight uppercase">{flight.flightNumber}</span>
                            </td>
                            {/* Route */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-3.5 h-3.5 text-on-surface-dim opacity-30 shrink-0" />
                                <span className="text-[12px] font-black text-on-surface uppercase tracking-wide">
                                  {fidsType === 'arrival'
                                    ? `${flight.origin} (${flight.originCode || '---'})`
                                    : `${flight.destination} (${flight.destinationCode || '---'})`
                                  }
                                </span>
                              </div>
                            </td>
                            {/* Scheduled */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-xs font-mono font-bold text-on-surface">{flight.scheduledTime}</span>
                            </td>
                            {/* Estimated */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`text-xs font-mono font-bold ${flight.estimatedTime && flight.estimatedTime !== flight.scheduledTime ? 'text-warning' : 'text-on-surface-dim opacity-50'}`}>
                                {flight.estimatedTime || flight.scheduledTime}
                              </span>
                            </td>
                            {/* Gate */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-xs font-black text-on-surface-dim uppercase">
                                {importedJob?.stand || flight.gate || '---'}
                              </span>
                            </td>
                            {/* Terminal */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-xs font-black text-on-surface-dim opacity-60 uppercase">{flight.terminal || '---'}</span>
                            </td>
                            {/* Status */}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {renderStatusBadge(flight.status || 'Scheduled')}
                            </td>
                            {/* Action */}
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              {isImported ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-success/10 text-success border border-success/20">
                                    Imported
                                  </span>
                                  {[UserRole.ITP_MANAGER, UserRole.ADMIN].includes(user?.role) && (
                                    <button
                                      onClick={() => handleUnimportClick(flight.flightNumber)}
                                      className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error text-[9px] font-black uppercase tracking-widest rounded-lg border border-error/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                      Unimport
                                    </button>
                                  )}
                                </div>
                              ) : flight.status && (flight.status.toLowerCase().includes('cancel') || flight.status.toLowerCase().includes('cnl')) ? (
                                renderStatusBadge('Cancelled')
                              ) : (
                                <button
                                  onClick={() => handleImportClick(flight)}
                                  className="px-4 py-2 kinetic-gradient text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-premium"
                                >
                                  Import to FMS
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Flight Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setIsModalOpen(false); setPrefillData(null); }}>
          <div className="bg-surface-lowest rounded-[40px] shadow-2xl w-full max-w-lg p-10 border border-outline relative overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

            <h3 className="text-3xl font-[900] text-on-surface mb-8 tracking-tighter uppercase italic relative z-10">INITIATE TASK</h3>
            <form key={prefillData ? `${prefillData.flightNumber}-${prefillData.sta}-${prefillData.std}` : 'empty'} onSubmit={handleAddFlight} className="space-y-8 relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Flight Identity</label>
                  <input name="flight" defaultValue={prefillData?.flightNumber || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Route</label>
                  <input name="route" defaultValue={prefillData?.route || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Airframe</label>
                  <input name="ac" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Tactical Stand</label>
                  <input name="stand" defaultValue={prefillData?.stand || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STA</label>
                  <input name="sta" type="time" defaultValue={prefillData?.sta || ''} required={!prefillData?.std} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">ETA</label>
                  <input name="eta" type="time" defaultValue={prefillData?.eta || ''} required={!prefillData?.std} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STD</label>
                  <input name="std" type="time" defaultValue={prefillData?.std || ''} required={!prefillData?.sta} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                </div>
              </div>

              {/* Optional TOBT and FRT inputs */}
              <div className="p-5 bg-surface-dim/40 rounded-2xl border border-outline/50 space-y-4">
                <span className="block text-[10px] font-black text-primary uppercase tracking-widest">
                  Target Off-Block & Fuel Request Times (Optional)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-amber-500 uppercase mb-2 tracking-wider">TOBT</label>
                    <input name="tobt" type="time" placeholder="HH:MM" className="w-full px-4 py-3 bg-surface border border-amber-500/30 rounded-xl text-[11px] font-black tracking-wider focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-mono text-amber-400" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-wider opacity-60">FRT Airline</label>
                    <input name="frtAirline" type="time" placeholder="HH:MM" className="w-full px-4 py-3 bg-surface border border-outline rounded-xl text-[11px] font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-wider opacity-60">FRT AOCC</label>
                    <input name="frtAocc" type="time" placeholder="HH:MM" className="w-full px-4 py-3 bg-surface border border-outline rounded-xl text-[11px] font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-wider opacity-60">FRT For</label>
                    <input name="frtFor" type="time" placeholder="HH:MM" className="w-full px-4 py-3 bg-surface border border-outline rounded-xl text-[11px] font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-5 mt-10">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setPrefillData(null); }}
                  className="px-8 py-4 text-[10px] font-black text-on-surface-dim hover:text-on-surface uppercase tracking-[0.2em] transition-all"
                >
                  ABORT
                </button>
                <button
                  type="submit"
                  className="px-10 py-4 kinetic-gradient text-white font-[900] text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
                >
                  CONFIRM DEPLOYMENT
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {editingStandFlight && (
        <EditStandModal
          flightNumber={editingStandFlight.flightNumber}
          currentStand={editingStandFlight.stand}
          onClose={() => setEditingStandFlight(null)}
          onSave={handleSaveStand}
        />
      )}

      {editingFrtFlight && (
        <EditFuelRequestModal
          flight={editingFrtFlight}
          onClose={() => setEditingFrtFlight(null)}
          onSave={handleSaveFrt}
        />
      )}

      {isModalOpen && (
        <style>{`
          .modal-open, .modal-open body {
            overflow: hidden !important;
            height: 100% !important;
          }
          .modal-open #bottom-nav,
          .modal-open header,
          .modal-open #sidebar {
            display: none !important;
          }
        `}</style>
      )}
    </div>
  );
};