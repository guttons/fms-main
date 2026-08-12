import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Upload, Download, FileSpreadsheet, Plus, Trash2, CheckCircle2, 
  AlertTriangle, RefreshCw, Search, Calendar, Globe, Clock, Plane, 
  Eye, Check, X, ShieldAlert, Layers, Filter, ToggleLeft, ToggleRight, Pencil
} from 'lucide-react';
import { InternationalSchedule, ScheduleCrossCheckResult, CrossCheckStatus } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { scheduleImportService } from '../services/scheduleImportService';
import type { NotificationType } from '../context/NotificationContext';

interface InternationalScheduleTabProps {
  push: (msg: string, type?: NotificationType) => void;
  confirm: (msg: string, cb: () => void) => void;
  currentUser?: any;
}

export const InternationalScheduleTab: React.FC<InternationalScheduleTabProps> = ({
  push,
  confirm,
  currentUser
}) => {
  const {
    internationalSchedules = [],
    importInternationalSchedules,
    saveInternationalSchedule,
    deleteInternationalSchedule,
    deleteAllInternationalSchedules,
    toggleInternationalScheduleActive,
    crossCheckDailyFlights,
    selectedBriefingDate
  } = useOperationalData();

  const [activeSubTab, setActiveSubTab] = useState<'master' | 'crosscheck'>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const [airlineFilter, setAirlineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [parsedSchedules, setParsedSchedules] = useState<InternationalSchedule[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [uploadFilename, setUploadFilename] = useState('');

  // Add/Edit Manual Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InternationalSchedule | null>(null);

  // Form inputs
  const [flightNumber, setFlightNumber] = useState('');
  const [airlineCode, setAirlineCode] = useState('');
  const [airlineName, setAirlineName] = useState('');
  const [origin, setOrigin] = useState('DXB');
  const [destination, setDestination] = useState('MLE');
  const [sta, setSta] = useState('08:00');
  const [std, setStd] = useState('09:30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [aircraftType, setAircraftType] = useState('B777-300ER');
  const [estimatedUpliftLiters, setEstimatedUpliftLiters] = useState(45000);
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  });

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'INT' | 'DOM'>('ALL');
  const [crossCheckCategoryFilter, setCrossCheckCategoryFilter] = useState<'ALL' | 'INT' | 'DOM'>('ALL');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [activeSubTabTooltip, setActiveSubTabTooltip] = useState<string | null>(null);

  // Dynamic Subtab Pill Measurement
  const masterTabRef = useRef<HTMLButtonElement>(null);
  const crosscheckTabRef = useRef<HTMLButtonElement>(null);
  const [subTabPillStyle, setSubTabPillStyle] = useState<{ left: number; width: number }>({ left: 6, width: 250 });

  useLayoutEffect(() => {
    const updatePill = () => {
      const activeEl = activeSubTab === 'master' ? masterTabRef.current : crosscheckTabRef.current;
      if (activeEl) {
        setSubTabPillStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth
        });
      }
    };
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [activeSubTab, internationalSchedules.length]);

  const triggerSubTabTooltip = (tab: string) => {
    setActiveSubTabTooltip(tab);
    setTimeout(() => setActiveSubTabTooltip(null), 2000);
  };

  const uniqueAirlines = Array.from(
    new Set(internationalSchedules.map(s => scheduleImportService.normalizeAirlineName(s.airlineName)))
  ).sort();

  const uniqueSeasons = Array.from(
    new Set(internationalSchedules.map(s => s.season).filter(Boolean) as string[])
  ).sort();

  const filteredSchedules = internationalSchedules.filter(s => {
    const q = searchQuery.toLowerCase();
    const normalizedAirline = scheduleImportService.normalizeAirlineName(s.airlineName);
    const matchesSearch = 
      s.flightNumber.toLowerCase().includes(q) ||
      s.airlineName.toLowerCase().includes(q) ||
      normalizedAirline.toLowerCase().includes(q) ||
      s.aircraftType.toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q);

    const isDomestic = s.origin !== 'MLE' && s.destination !== 'MLE' ? false : (
      ['NR', 'VP', 'Q2'].some(code => s.flightNumber.startsWith(code)) ||
      ['MANTA', 'FLYME', 'MALDIVIAN'].some(name => s.airlineName.toUpperCase().includes(name))
    );

    const matchesCategory = categoryFilter === 'ALL' ||
      (categoryFilter === 'DOM' && isDomestic) ||
      (categoryFilter === 'INT' && !isDomestic);

    const matchesAirline = airlineFilter === 'ALL' || normalizedAirline === airlineFilter;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' && s.isActive) || 
      (statusFilter === 'INACTIVE' && !s.isActive);
    const matchesSeason = seasonFilter === 'ALL' || s.season === seasonFilter;

    return matchesSearch && matchesCategory && matchesAirline && matchesStatus && matchesSeason;
  });

  const renderRouteBadge = (sch: InternationalSchedule) => {
    const orig = (sch.origin || 'INT').toUpperCase();
    const dest = (sch.destination || 'MLE').toUpperCase();

    if (orig !== 'MLE' && dest === 'MLE') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-surface-container-low border border-outline/40 text-[10px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
          <span className="text-on-surface">{orig}</span>
          <span className="text-[8.5px] font-semibold text-on-surface-dim opacity-40">➔ MLE ➔</span>
          <span className="text-on-surface">{orig}</span>
        </span>
      );
    }
    if (orig === 'MLE' && dest !== 'MLE') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-surface-container-low border border-outline/40 text-[10px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
          <span className="text-[8.5px] font-semibold text-on-surface-dim opacity-40">MLE ➔</span>
          <span className="text-on-surface">{dest}</span>
        </span>
      );
    }
    if (orig !== 'MLE' && dest !== 'MLE') {
      return (
        <span className="px-2.5 py-1 rounded-xl bg-surface-container-low border border-outline/40 text-[10px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
          <span className="text-on-surface">{orig}</span>
          <span className="text-[8.5px] font-semibold text-on-surface-dim opacity-40">➔ MLE ➔</span>
          <span className="text-on-surface">{dest}</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-xl bg-surface-container-low border border-outline/40 text-[10px] font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm">
        <span className="text-on-surface">{orig}</span>
        <span className="text-[8.5px] font-semibold text-on-surface-dim opacity-40">➔</span>
        <span className="text-on-surface">{dest}</span>
      </span>
    );
  };

  // Handle File Upload Select (.xlsx, .xls)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFilename(file.name);
    const uploader = currentUser?.name || 'System Admin';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isExcel) {
      push('Please select a valid MACL Excel schedule workbook (.xlsx or .xls)', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const { schedules, errors, stats } = scheduleImportService.parseScheduleExcel(buffer, file.name, uploader);
          setParsedSchedules(schedules);
          const domCount = schedules.filter(s => s.isDomestic).length;
          const intlCount = schedules.length - domCount;
          const seasonTag = stats.season && stats.season !== 'UNKNOWN' ? ` [${stats.season}]` : '';
          setParseErrors(errors.length > 0 ? errors : [
            `Parsed MACL Schedule${seasonTag}: ${schedules.length} flights (${intlCount} International, ${domCount} Domestic) across ${stats.airlineCount} airlines from Days of OPS & Domestic tabs.`
          ]);
          setPreviewModalOpen(true);
        } catch (err: any) {
          push('Failed to parse Excel file: ' + err.message, 'error');
        }
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (parsedSchedules.length === 0) return;
    try {
      await importInternationalSchedules(parsedSchedules);
      push(`Successfully imported ${parsedSchedules.length} international schedules!`, 'success');
      setPreviewModalOpen(false);
      setParsedSchedules([]);
      setParseErrors([]);
    } catch (err: any) {
      push('Failed to import schedules: ' + err.message, 'error');
    }
  };

  const handleClearAllSchedules = () => {
    confirm(
      'Are you sure you want to delete ALL flight schedules? This will wipe the current schedule registry so you can upload a clean new seasonal schedule.',
      async () => {
        try {
          await deleteAllInternationalSchedules();
          push('All flight schedules cleared successfully.', 'info');
        } catch (err: any) {
          push('Failed to clear schedules: ' + err.message, 'error');
        }
      }
    );
  };

  const handleOpenAddModal = () => {
    setEditingSchedule(null);
    setFlightNumber('');
    setAirlineCode('');
    setAirlineName('');
    setOrigin('DXB');
    setDestination('MLE');
    setSta('08:00');
    setStd('09:30');
    setDaysOfWeek([1, 2, 3, 4, 5, 6, 7]);
    setAircraftType('B777-300ER');
    setEstimatedUpliftLiters(45000);
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    const d = new Date(); d.setDate(d.getDate() + 90);
    setEffectiveTo(d.toISOString().split('T')[0]);
    setModalOpen(true);
  };

  const handleOpenEditModal = (sch: InternationalSchedule) => {
    setEditingSchedule(sch);
    setFlightNumber(sch.flightNumber);
    setAirlineCode(sch.airlineCode || '');
    setAirlineName(sch.airlineName);
    setOrigin(sch.origin);
    setDestination(sch.destination);
    setSta(sch.sta);
    setStd(sch.std);
    setDaysOfWeek(sch.daysOfWeek || [1, 2, 3, 4, 5, 6, 7]);
    setAircraftType(sch.aircraftType);
    setEstimatedUpliftLiters(sch.estimatedUpliftLiters);
    setEffectiveFrom(sch.effectiveFrom);
    setEffectiveTo(sch.effectiveTo);
    setModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) return push('Flight number is required', 'warning');
    if (!airlineName.trim()) return push('Airline name is required', 'warning');

    const item: InternationalSchedule = {
      id: editingSchedule ? editingSchedule.id : `intl-sch-${Date.now()}`,
      flightNumber: flightNumber.toUpperCase(),
      airlineCode: airlineCode.toUpperCase() || flightNumber.slice(0, 2).toUpperCase(),
      airlineName,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      sta,
      std,
      daysOfWeek,
      aircraftType,
      estimatedUpliftLiters: Number(estimatedUpliftLiters) || 45000,
      effectiveFrom,
      effectiveTo,
      isActive: editingSchedule ? editingSchedule.isActive : true,
      uploadedAt: editingSchedule ? editingSchedule.uploadedAt : new Date().toISOString(),
      uploadedBy: currentUser?.name || 'System Admin',
      sourceFilename: editingSchedule ? editingSchedule.sourceFilename : 'Manual Entry'
    };

    try {
      await saveInternationalSchedule(item);
      push(`Schedule ${flightNumber.toUpperCase()} ${editingSchedule ? 'updated' : 'created'} successfully`, 'success');
      setModalOpen(false);
    } catch (err: any) {
      push('Failed to save schedule: ' + err.message, 'error');
    }
  };

  const handleDeleteSchedule = (id: string, flightNo: string) => {
    confirm(`Are you sure you want to delete flight schedule ${flightNo}?`, async () => {
      try {
        await deleteInternationalSchedule(id);
        push(`Flight schedule ${flightNo} deleted`, 'info');
      } catch (err: any) {
        push('Failed to delete schedule: ' + err.message, 'error');
      }
    });
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // Cross check results
  const crossCheckResults = crossCheckDailyFlights(selectedBriefingDate);

  const isItemDomestic = (r: ScheduleCrossCheckResult) => {
    if (r.isDomestic !== undefined) return r.isDomestic;
    const fNo = (r.flightNumber || '').toUpperCase();
    const aName = (r.airlineName || '').toUpperCase();
    if (['NR', 'VP', 'Q2'].some(code => fNo.startsWith(code))) return true;
    if (['MANTA', 'FLYME', 'MALDIVIAN', 'VILLA'].some(name => aName.includes(name))) return true;
    return false;
  };

  const filteredCrossCheckResults = crossCheckResults.filter(r => {
    const isDom = isItemDomestic(r);
    if (crossCheckCategoryFilter === 'INT') return !isDom;
    if (crossCheckCategoryFilter === 'DOM') return isDom;
    return true;
  });

  const getStatusBadge = (status: CrossCheckStatus) => {
    switch (status) {
      case 'MATCHED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-success/10 text-success border border-success/20"><CheckCircle2 className="w-3.5 h-3.5" /> Schedule Confirmed</span>;
      case 'RETIMED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> Retimed Flight</span>;
      case 'AIRCRAFT_SWAP':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20"><RefreshCw className="w-3.5 h-3.5" /> Aircraft Swap</span>;
      case 'UNSCHEDULED_ADDITION':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20"><Plus className="w-3.5 h-3.5" /> Ad-hoc / Unscheduled</span>;
      case 'CANCELLED_OR_MISSING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-error/10 text-error border border-error/20"><AlertTriangle className="w-3.5 h-3.5" /> Expected / Not in FIDS</span>;
    }
  };

  const matchedCount = filteredCrossCheckResults.filter(r => r.status === 'MATCHED').length;
  const retimedCount = filteredCrossCheckResults.filter(r => r.status === 'RETIMED').length;
  const swapCount = filteredCrossCheckResults.filter(r => r.status === 'AIRCRAFT_SWAP').length;
  const missingCount = filteredCrossCheckResults.filter(r => r.status === 'CANCELLED_OR_MISSING').length;
  const adhocCount = filteredCrossCheckResults.filter(r => r.status === 'UNSCHEDULED_ADDITION').length;
  const totalChecked = filteredCrossCheckResults.length;
  const compliancePct = totalChecked > 0 ? Math.round((matchedCount / totalChecked) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="bg-surface-container-low border border-outline rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-black text-on-surface uppercase tracking-wider">
                  Flight Schedules
                </h2>
                <p className="text-xs text-on-surface-dim opacity-70 mt-0.5">
                  Import seasonal master schedules, cross-check live daily flights, and generate predictive fuel uplift forecasts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl kinetic-gradient text-white text-xs font-black uppercase tracking-wider transition-all shadow-premium hover:scale-[1.02] active:scale-95 border-none shrink-0 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" /> Import Schedule
            </button>



            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-black uppercase tracking-wider border border-outline transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-success" /> Add Schedule
            </button>

            <button
              onClick={handleClearAllSchedules}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-error/10 hover:bg-error/20 text-error text-xs font-black uppercase tracking-wider border border-error/30 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              title="Delete all schedules to upload a clean new schedule"
            >
              <Trash2 className="w-4 h-4 text-error" /> Clear All Schedules
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar with Kinetic Gradient Active Pill */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="bg-surface-dim/80 p-1.5 rounded-2xl md:rounded-full border border-white/15 shadow-inner inline-flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveSubTab('master');
                triggerSubTabTooltip('master');
              }}
              className={`flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 rounded-xl md:rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${
                activeSubTab === 'master'
                  ? 'kinetic-gradient text-white shadow-premium scale-[1.01]'
                  : 'text-on-surface-dim hover:text-on-surface hover:bg-surface-container/50'
              }`}
            >
              {activeSubTabTooltip === 'master' && (
                <div className="absolute bottom-full mb-3 bg-surface-container border border-white/15 px-2.5 py-1.5 rounded-xl text-[10px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150 md:hidden">
                  Schedule Registry ({internationalSchedules.length})
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                </div>
              )}
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Schedule Registry ({internationalSchedules.length})</span>
              <span className="md:hidden text-[10px] font-extrabold opacity-90">({internationalSchedules.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('crosscheck');
                triggerSubTabTooltip('crosscheck');
              }}
              className={`flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 rounded-xl md:rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${
                activeSubTab === 'crosscheck'
                  ? 'kinetic-gradient text-white shadow-premium scale-[1.01]'
                  : 'text-on-surface-dim hover:text-on-surface hover:bg-surface-container/50'
              }`}
            >
              {activeSubTabTooltip === 'crosscheck' && (
                <div className="absolute bottom-full mb-3 bg-surface-container border border-white/15 px-2.5 py-1.5 rounded-xl text-[10px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150 md:hidden">
                  Daily Flight Cross-Check
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                </div>
              )}
              <Clock className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Daily Flight Cross-Check</span>
              {retimedCount + swapCount + missingCount > 0 && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 transition-colors ${
                  activeSubTab === 'crosscheck'
                    ? 'bg-amber-400 text-on-warning-container shadow-sm'
                    : 'bg-warning text-on-warning'
                }`}>
                  {retimedCount + swapCount + missingCount} <span className="hidden sm:inline">Alerts</span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: MASTER SCHEDULE REGISTRY */}
      {activeSubTab === 'master' && (
        <div className="space-y-4">
          {/* Controls & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-low border border-outline p-4 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-dim" />
              <input
                type="text"
                placeholder="Search flight #, airline, aircraft..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-container-low border border-outline text-xs text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as any)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-xs text-on-surface focus:outline-none focus:border-primary font-semibold"
              >
                <option value="ALL">All Categories</option>
                <option value="INT">International Only</option>
                <option value="DOM">Domestic Only</option>
              </select>

              <select
                value={seasonFilter}
                onChange={e => setSeasonFilter(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-xs text-on-surface focus:outline-none focus:border-primary font-semibold"
              >
                <option value="ALL">All Seasons ({uniqueSeasons.length})</option>
                {uniqueSeasons.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <select
                value={airlineFilter}
                onChange={e => setAirlineFilter(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Airlines ({uniqueAirlines.length})</option>
                {uniqueAirlines.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedules Data Table */}
          <div className="overflow-x-auto rounded-2xl border border-outline">
            <table className="min-w-[850px] w-full divide-y divide-outline text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Flight #</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Airline</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Route</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STA / STD</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Days of Week</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Aircraft</th>
                  <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Est. Uplift</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Validity Period</th>
                  <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-surface-container-lowest divide-y divide-outline">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-on-surface-dim opacity-70">
                      No international schedules found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map(sch => (
                    <tr key={sch.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-black tracking-wider text-primary">
                        {sch.flightNumber}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-on-surface">{scheduleImportService.normalizeAirlineName(sch.airlineName)}</span>
                          <span className="opacity-50 text-[10px]">({sch.airlineCode})</span>
                          {sch.isDomestic ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-secondary/15 text-secondary border border-secondary/30">
                              DOMESTIC
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-primary/15 text-primary border border-primary/30">
                              INTL
                            </span>
                          )}
                          {sch.season && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              sch.season.toUpperCase().includes('SUMMER')
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : sch.season.toUpperCase().includes('WINTER')
                                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                : 'bg-secondary/15 text-secondary border border-secondary/30'
                            }`}>
                              {sch.season}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-medium">
                        {renderRouteBadge(sch)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-mono font-semibold text-on-surface">
                        {sch.sta} / {sch.std}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5, 6, 7].map(day => {
                            const active = sch.daysOfWeek.includes(day);
                            const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                            return (
                              <span 
                                key={day}
                                className={`w-5 h-5 rounded-md text-[9px] font-black flex items-center justify-center border ${
                                  active 
                                    ? 'bg-primary/20 text-primary border-primary/30' 
                                    : 'bg-surface-container-low text-on-surface-dim opacity-30 border-transparent'
                                }`}
                              >
                                {labels[day - 1]}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-on-surface-dim">
                        {sch.aircraftType}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-mono font-bold text-right text-success">
                        {sch.estimatedUpliftLiters.toLocaleString()} L
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-xs text-on-surface-dim font-mono">
                        {sch.effectiveFrom} ➔ {sch.effectiveTo}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleInternationalScheduleActive(sch.id, !sch.isActive)}
                          className={`px-3 py-1 text-[9px] font-black rounded-xl border uppercase tracking-widest transition-all ${
                            sch.isActive 
                              ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
                              : 'bg-on-surface-dim/10 text-on-surface-dim border-on-surface-dim/20 hover:bg-on-surface-dim/20'
                          }`}
                          title={sch.isActive ? 'Active - Click to Deactivate' : 'Inactive - Click to Activate'}
                        >
                          {sch.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(sch)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest transition-all"
                            title="Edit Schedule"
                          >
                            <Pencil className="w-3.5 h-3.5" /> EDIT
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(sch.id, sch.flightNumber)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-error/10 text-error text-[9px] font-black uppercase tracking-widest transition-all"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> REMOVE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DAILY FLIGHT CROSS-CHECK */}
      {activeSubTab === 'crosscheck' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-surface-container-low border border-outline rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-70">
                Compliance Rate
              </div>
              <div className="text-2xl font-black text-primary mt-2">
                {compliancePct}%
              </div>
              <div className="text-[11px] text-on-surface-dim mt-1">
                {matchedCount} of {totalChecked} Confirmed
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 opacity-80">
                Retimed Flights
              </div>
              <div className="text-2xl font-black text-amber-500 mt-2">
                {retimedCount}
              </div>
              <div className="text-[11px] text-on-surface-dim mt-1">
                STA/STD &gt; 15 min shift
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-primary opacity-80">
                Aircraft Swaps
              </div>
              <div className="text-2xl font-black text-primary mt-2">
                {swapCount}
              </div>
              <div className="text-[11px] text-on-surface-dim mt-1">
                Equipment change
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline rounded-3xl p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-error opacity-80">
                Expected / Missing
              </div>
              <div className="text-2xl font-black text-error mt-2">
                {missingCount}
              </div>
              <div className="text-[11px] text-on-surface-dim mt-1">
                Not in FIDS today
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline rounded-3xl p-5 shadow-sm col-span-2 sm:col-span-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-purple-400 opacity-80">
                Ad-hoc / Unscheduled
              </div>
              <div className="text-2xl font-black text-purple-400 mt-2">
                {adhocCount}
              </div>
              <div className="text-[11px] text-on-surface-dim mt-1">
                Operating today
              </div>
            </div>
          </div>

          {/* Cross Check Details List */}
          <div className="bg-surface-container-low border border-outline rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline/40 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-on-surface">
                  Daily Flight Cross-Check Analysis for {selectedBriefingDate}
                </h3>
                <p className="text-xs text-on-surface-dim opacity-70 mt-0.5">
                  Cross-referencing active daily operational flights with imported seasonal master schedule baselines.
                </p>
              </div>

              {/* Category Filter Pills (ALL / INT / DOM) with Animated Kinetic Gradient Sliding Pill */}
              <div className="bg-surface-dim/80 p-1 rounded-2xl border border-white/15 relative flex items-center w-full sm:w-auto self-stretch sm:self-auto shadow-inner">
                <div
                  className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium ${
                    crossCheckCategoryFilter === 'ALL'
                      ? 'w-[calc(33.333%-2px)] left-1'
                      : crossCheckCategoryFilter === 'INT'
                      ? 'w-[calc(33.333%-2px)] left-[calc(33.333%+1px)]'
                      : 'w-[calc(33.333%-2px)] left-[calc(66.666%+1px)]'
                  }`}
                />
                <button
                  onClick={() => setCrossCheckCategoryFilter('ALL')}
                  className={`flex-1 text-center px-2 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all relative z-10 whitespace-nowrap ${
                    crossCheckCategoryFilter === 'ALL'
                      ? 'text-white'
                      : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  ALL ({crossCheckResults.length})
                </button>
                <button
                  onClick={() => setCrossCheckCategoryFilter('INT')}
                  className={`flex-1 text-center px-2 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all relative z-10 whitespace-nowrap ${
                    crossCheckCategoryFilter === 'INT'
                      ? 'text-white'
                      : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  INT ({crossCheckResults.filter(r => !isItemDomestic(r)).length})
                </button>
                <button
                  onClick={() => setCrossCheckCategoryFilter('DOM')}
                  className={`flex-1 text-center px-2 sm:px-3.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all relative z-10 whitespace-nowrap ${
                    crossCheckCategoryFilter === 'DOM'
                      ? 'text-white'
                      : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  DOM ({crossCheckResults.filter(r => isItemDomestic(r)).length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-outline/30">
              {filteredCrossCheckResults.length === 0 ? (
                <div className="py-12 text-center text-on-surface-dim opacity-80">
                  {internationalSchedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="w-8 h-8 text-amber-400 opacity-60 mb-1" />
                      <p className="font-black text-sm text-on-surface uppercase tracking-wider">No Master Schedules Loaded</p>
                      <p className="text-xs text-on-surface-dim opacity-70 max-w-md">Import a seasonal flight schedule workbook (.xlsx) to run daily cross-check analysis against live FIDS operations.</p>
                    </div>
                  ) : (
                    `No ${crossCheckCategoryFilter === 'INT' ? 'international' : crossCheckCategoryFilter === 'DOM' ? 'domestic' : ''} operational flight data found for cross-checking on ${selectedBriefingDate}.`
                  )}
                </div>
              ) : (
                filteredCrossCheckResults.map(res => (
                  <div key={res.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container-low/30 rounded-2xl p-3 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-primary tracking-wider">{res.flightNumber}</span>
                        <span className="text-xs font-bold text-on-surface-dim">{res.airlineName}</span>
                        {getStatusBadge(res.status)}
                      </div>
                      <p className="text-xs text-on-surface-dim">{res.notes}</p>
                    </div>

                    <div className="flex items-center gap-6 text-xs">
                      <div>
                        <div className="text-[10px] font-black uppercase text-on-surface-dim opacity-60">Scheduled STA/STD</div>
                        <div className="font-mono font-semibold">{res.scheduledSta} / {res.scheduledStd}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black uppercase text-on-surface-dim opacity-60">Actual / FIDS Time</div>
                        <div className="font-mono font-semibold text-primary">{res.actualSta} / {res.actualStd}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black uppercase text-on-surface-dim opacity-60">Scheduled Aircraft</div>
                        <div className="font-semibold">{res.scheduledAircraft}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black uppercase text-on-surface-dim opacity-60">Actual Aircraft</div>
                        <div className="font-semibold text-primary">{res.actualAircraft}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRE-IMPORT PREVIEW MODAL */}
      {previewModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-6 overflow-y-auto">
          <div className="bg-surface border border-outline/60 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl my-auto">
            <div className="p-5 sm:p-6 border-b border-outline/50 flex items-center justify-between bg-surface-container-low/40">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-on-surface flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Schedule Import Preview - {uploadFilename}
                </h3>
                <p className="text-xs text-on-surface-dim mt-0.5">
                  Review parsed rows before committing to system master database.
                </p>
              </div>
              <button onClick={() => setPreviewModalOpen(false)} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
                <X className="w-5 h-5 text-on-surface-dim" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {parseErrors.length > 0 && (
                <div className="p-4 rounded-2xl bg-error/10 border border-error/20 text-xs text-error space-y-1">
                  <div className="font-black uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Parsing Notices & Warnings ({parseErrors.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {parseErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs font-bold text-on-surface-dim flex items-center justify-between">
                <span>Parsed {parsedSchedules.length} valid flight schedule entries ready for import:</span>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-black uppercase">
                  {parsedSchedules.filter(s => s.isDomestic).length} Domestic / {parsedSchedules.filter(s => !s.isDomestic).length} Intl
                </span>
              </div>

              <div className="border border-outline/40 rounded-2xl overflow-x-auto max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="sticky top-0 z-10 bg-surface-container-low font-black text-[10px] uppercase text-on-surface-dim border-b border-outline/40">
                    <tr>
                      <th className="p-3">Flight #</th>
                      <th className="p-3">Airline</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">STA / STD</th>
                      <th className="p-3">Days</th>
                      <th className="p-3">Aircraft</th>
                      <th className="p-3 text-right">Est. Uplift</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/30 font-medium">
                    {parsedSchedules.map((sch, i) => (
                      <tr key={i} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="p-3 font-bold text-primary">{sch.flightNumber}</td>
                        <td className="p-3 font-semibold flex items-center gap-2">
                          <span>{scheduleImportService.normalizeAirlineName(sch.airlineName)}</span>
                          {sch.season && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              sch.season.toUpperCase().includes('SUMMER')
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : sch.season.toUpperCase().includes('WINTER')
                                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                : 'bg-secondary/15 text-secondary border border-secondary/30'
                            }`}>
                              {sch.season}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {renderRouteBadge(sch)}
                        </td>
                        <td className="p-3 font-mono">{sch.sta || '--:--'} / {sch.std || '--:--'}</td>
                        <td className="p-3 font-mono">{sch.daysOfWeek.join(', ')}</td>
                        <td className="p-3">{sch.aircraftType}</td>
                        <td className="p-3 text-right font-mono font-bold text-success">{sch.estimatedUpliftLiters.toLocaleString()} L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-outline/50 flex justify-end gap-3 bg-surface-container-low/40">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-outline text-xs font-black uppercase tracking-wider text-on-surface hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={parsedSchedules.length === 0}
                className="px-5 py-2.5 rounded-xl kinetic-gradient text-white text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 shadow-premium border-none disabled:opacity-50 transition-all"
              >
                Confirm & Save {parsedSchedules.length} Schedules
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD / EDIT MANUAL MODAL */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-6 overflow-y-auto">
          <div className="bg-surface border border-outline/60 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 my-auto">
            <div className="flex items-center justify-between border-b border-outline/40 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-on-surface">
                {editingSchedule ? 'Edit International Schedule' : 'Add International Schedule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-surface-container">
                <X className="w-5 h-5 text-on-surface-dim" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Flight Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="EK652"
                    value={flightNumber}
                    onChange={e => setFlightNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface uppercase focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Airline Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Emirates"
                    value={airlineName}
                    onChange={e => setAirlineName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">IATA Code</label>
                  <input
                    type="text"
                    placeholder="EK"
                    value={airlineCode}
                    onChange={e => setAirlineCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface uppercase focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Origin</label>
                  <input
                    type="text"
                    placeholder="DXB"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface uppercase focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Destination</label>
                  <input
                    type="text"
                    placeholder="MLE"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface uppercase focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">STA (Arrival HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={sta}
                    onChange={e => setSta(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">STD (Departure HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={std}
                    onChange={e => setStd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1.5">Operating Days of Week</label>
                <div className="flex gap-2">
                  {[
                    { d: 1, l: 'Mon' }, { d: 2, l: 'Tue' }, { d: 3, l: 'Wed' },
                    { d: 4, l: 'Thu' }, { d: 5, l: 'Fri' }, { d: 6, l: 'Sat' }, { d: 7, l: 'Sun' }
                  ].map(item => {
                    const selected = daysOfWeek.includes(item.d);
                    return (
                      <button
                        type="button"
                        key={item.d}
                        onClick={() => toggleDayOfWeek(item.d)}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                          selected 
                            ? 'kinetic-gradient text-white border-transparent shadow-sm' 
                            : 'bg-surface-container-low text-on-surface-dim border-outline opacity-50'
                        }`}
                      >
                        {item.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Aircraft Type</label>
                  <input
                    type="text"
                    required
                    placeholder="B777-300ER"
                    value={aircraftType}
                    onChange={e => setAircraftType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Est. Uplift (Liters)</label>
                  <input
                    type="number"
                    required
                    value={estimatedUpliftLiters}
                    onChange={e => setEstimatedUpliftLiters(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Effective From</label>
                  <input
                    type="date"
                    required
                    value={effectiveFrom}
                    onChange={e => setEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-on-surface-dim mb-1">Effective To</label>
                  <input
                    type="date"
                    required
                    value={effectiveTo}
                    onChange={e => setEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline text-on-surface focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline/40">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline text-xs font-black uppercase tracking-wider text-on-surface hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl kinetic-gradient text-white text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 shadow-premium border-none"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
