import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MOCK_USERS } from '../constants';
import { FileText, Search, Download, Filter, X, Calendar, Plane, Anchor, Droplet, Fuel, Truck, Sailboat } from 'lucide-react';
import { Logo } from './Logo';
import { useOperationalData } from '../context/OperationalDataContext';
import { supabaseService } from '../services/supabaseService';
import { FlightLog, User, UserRole, EquipmentType } from '../types';

const parseGroundLog = (log: FlightLog) => {
  const parts = (log.flightNumber || '').split('-');
  const station = parts[1] || 'LFS';
  const fuelType = parts[2] || 'DIESEL';
  
  const remarks = log.remarks || '';
  const accountMatch = remarks.match(/On account of:\s*([^,)]+)/i);
  const paymentMatch = remarks.match(/Payment:\s*([^,)]+)/i);
  const receivedMatch = remarks.match(/Received by:\s*([^,)]+)/i);
  const equipMatch = remarks.match(/Equipment:\s*([^,)]+)/i);
  
  return {
    station: station === 'LFS' ? 'Landside (LFS)' : 'Airside (AFS)',
    fuelType: fuelType,
    account: accountMatch ? accountMatch[1].trim() : 'N/A',
    paymentMode: paymentMatch ? paymentMatch[1].trim() : 'Credit',
    receivedBy: receivedMatch ? receivedMatch[1].trim() : 'N/A',
    equipmentName: equipMatch ? equipMatch[1].trim() : 'N/A',
  };
};

const parseMarineLog = (log: FlightLog) => {
  const vesselName = (log.flightNumber || '').replace('VESSEL-', '');
  const remarks = log.remarks || '';
  const supervisorMatch = remarks.match(/Supervised by\s+([^)]+)/i);
  return {
    vesselName,
    supervisor: supervisorMatch ? supervisorMatch[1].trim() : 'N/A'
  };
};

interface LogHistoryProps {
  user?: User;
}

export const LogHistory: React.FC<LogHistoryProps> = ({ user }) => {
  const { staff, equipment } = useOperationalData();
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterFuelType, setFilterFuelType] = useState('ALL');
  const [filterEquipment, setFilterEquipment] = useState('ALL');
  const [filterStation, setFilterStation] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedLogType, setSelectedLogType] = useState<string>(() => {
    const defaultTab = localStorage.getItem('fms_log_history_default_tab');
    if (defaultTab) {
      localStorage.removeItem('fms_log_history_default_tab');
      return defaultTab;
    }
    return 'FLIGHT';
  });

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Tooltip auto-clear effect
  useEffect(() => {
    if (activeTooltip) {
      const timer = setTimeout(() => {
        setActiveTooltip(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeTooltip]);

  const resolveLogType = (log: FlightLog): string => {
    if (log.logType) return log.logType;
    const num = log.flightNumber || '';
    if (num.startsWith('SEAPLANE')) return 'SEAPLANE';
    if (num.startsWith('GROUND-')) return 'FILLING_STATION';
    if (num.startsWith('VESSEL-')) return 'MARINE';
    return 'FLIGHT';
  };
  
  const [editingLog, setEditingLog] = useState<FlightLog | null>(null);
  const [editForm, setEditForm] = useState({
    flightNumber: '',
    aircraftReg: '',
    aircraftType: '',
    stand: '',
    deliveryNumber: '',
    volume: 0,
    meterOpen: 0,
    meterClose: 0,
    remarks: '',
    date: '',
    timeArrived: '',
    timePosition: '',
    timeStart: '',
    timeEnd: ''
  });
  const [saving, setSaving] = useState(false);

  const canEdit = user?.role === UserRole.ITP_MANAGER || user?.role === UserRole.ADMIN;

  const getLocalDatePart = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
    } catch {
      return '';
    }
  };

  const getLocalTimePart = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        if (isoString.includes(':')) {
          const parts = isoString.split(':');
          return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
        return '';
      }
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const combineDateAndTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date(year, month - 1, day, hours, minutes);
      return date.toISOString();
    } catch {
      return '';
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--:--';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        if (isoString.includes(':')) return isoString;
        return '--:--:--';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return isoString || '--:--:--';
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [fetchedFlightLogs, fetchedBridgingLogs] = await Promise.all([
        supabaseService.getFlightLogs(),
        supabaseService.getBridgingLogs()
      ]);

      const mappedBridgingLogs: FlightLog[] = (fetchedBridgingLogs || []).map(blog => ({
        id: blog.id,
        flightNumber: `LOAD-${blog.vehicleId}`,
        aircraftReg: blog.sourceTankId,
        aircraftType: 'REFUELLER LOADING',
        stand: 'DEPOT',
        operatorId: blog.operatorId,
        vehicleId: blog.vehicleId,
        status: 'COMPLETED',
        deliveryNumber: blog.id,
        operationalDate: blog.date,
        logType: 'BRIDGING' as any,
        timestampStart: blog.startTime ? combineDateAndTime(blog.date || '', blog.startTime) : undefined,
        timestampFinalEnd: blog.endTime ? combineDateAndTime(blog.date || '', blog.endTime) : undefined,
        volume: blog.volume,
        remarks: `QC Visual: ${blog.visualCheckPassed ? 'PASS' : 'FAIL'}, CWD: ${blog.cwdCheckPassed ? 'PASS' : 'FAIL'}` + (blog.density ? `, Density: ${blog.density}` : '') + (blog.temperature ? `, Temp: ${blog.temperature}` : ''),
        visualCheckPassed: blog.visualCheckPassed,
        cwdCheckPassed: blog.cwdCheckPassed,
        density: blog.density,
        temperature: blog.temperature
      } as any));

      setLogs([...(fetchedFlightLogs || []), ...mappedBridgingLogs]);
    } catch (error) {
      console.error('Error fetching logs from Firebase:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (editingLog) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [editingLog]);

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    
    // Validate ticket number to exactly 6 digits
    const cleanTicket = editForm.deliveryNumber.replace(/\D/g, '');
    if (cleanTicket.length !== 6) return;

    setSaving(true);
    try {
      await supabaseService.updateFlightLog(editingLog.id, {
        flightNumber: editForm.flightNumber,
        aircraftReg: editForm.aircraftReg,
        aircraftType: editForm.aircraftType,
        stand: editForm.stand,
        deliveryNumber: `MLE-${cleanTicket}`,
        volume: Number(editForm.volume),
        meterOpen: Number(editForm.meterOpen),
        meterClose: Number(editForm.meterClose),
        remarks: editForm.remarks,
        timestampArrived: combineDateAndTime(editForm.date, editForm.timeArrived),
        timestampPosition: combineDateAndTime(editForm.date, editForm.timePosition),
        timestampStart: combineDateAndTime(editForm.date, editForm.timeStart),
        timestampInitialEnd: combineDateAndTime(editForm.date, editForm.timeEnd)
      });
      setEditingLog(null);
      await fetchLogs();
    } catch (error) {
      console.error('Error updating log:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!editingLog) return;
    if (!window.confirm('Are you absolutely sure you want to delete this operational log record? This action is permanent.')) return;

    setSaving(true);
    try {
      await supabaseService.deleteFlightLog(editingLog.id);
      setEditingLog(null);
      await fetchLogs();
    } catch (error) {
      console.error('Error deleting log:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredLogs = (logs || []).filter(log => {
    if (!log) return false;
    
    const logType = resolveLogType(log);
    const matchesType = logType === selectedLogType;

    const matchesSearch = (
      log.flightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.aircraftReg.toLowerCase().includes(searchTerm.toLowerCase())
    );

    let logDateStr = '';
    if (log.timestampStart) {
      logDateStr = getLocalDatePart(log.timestampStart);
    } else if (log.operationalDate) {
      logDateStr = log.operationalDate.includes('T') ? getLocalDatePart(log.operationalDate) : log.operationalDate;
    }

    let matchesDate = true;
    if (logDateStr) {
      if (filterStartDate && logDateStr < filterStartDate) {
        matchesDate = false;
      }
      if (filterEndDate && logDateStr > filterEndDate) {
        matchesDate = false;
      }
    } else if (filterStartDate || filterEndDate) {
      matchesDate = false;
    }

    let matchesFuelType = true;
    if (selectedLogType === 'FILLING_STATION' && filterFuelType !== 'ALL') {
      const parsed = parseGroundLog(log);
      matchesFuelType = parsed.fuelType === filterFuelType;
    }

    let matchesStation = true;
    if (selectedLogType === 'FILLING_STATION' && filterStation !== 'ALL') {
      const parts = (log.flightNumber || '').split('-');
      const stationCode = parts[1] || 'LFS';
      matchesStation = stationCode === filterStation;
    }

    let matchesEquipment = true;
    if (selectedLogType === 'BRIDGING' && filterEquipment !== 'ALL') {
      matchesEquipment = log.vehicleId === filterEquipment;
    }

    return matchesType && matchesSearch && matchesDate && matchesFuelType && matchesStation && matchesEquipment;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const aVal = a.deliveryNumber || '';
    const bVal = b.deliveryNumber || '';
    if (!aVal && !bVal) return 0;
    if (!aVal) return 1;
    if (!bVal) return -1;
    return bVal.localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
  });

  const totalVolume = sortedLogs.reduce((sum, log) => sum + (log.volume || 0), 0);

  const isValidTicket = editForm.deliveryNumber.replace(/\D/g, '').length === 6;

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            OPERATION <span className="text-primary italic font-medium ml-3">ARCHIVE</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: TASK CONTROL</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Historical Engagement Audit</span>
          </div>
        </div>
        <div className="flex space-x-4 w-full md:w-auto">
             <div className="relative flex-1 md:w-72">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <input 
                    type="text" 
                    placeholder="SEARCH TASK REGISTRY..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                />
             </div>
             <button 
                 onClick={() => setShowFilters(!showFilters)}
                 className={`p-4 rounded-2xl transition-all border ${showFilters ? 'bg-primary text-white border-primary' : 'bg-surface-dim text-on-surface-dim border-outline hover:bg-primary/5'}`}
             >
                <Filter className="w-5 h-5" />
             </button>
             {user && ![UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER].includes(user.role) && (
               <button className="flex items-center justify-center p-4 sm:px-8 sm:py-4 kinetic-gradient text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all">
                  <Download className="w-5 h-5 sm:w-4 sm:h-4 sm:mr-3" />
                  <span className="hidden sm:inline">EXPORT CSV</span>
               </button>
             )}
        </div>
      </div>

      {/* Log Type Filter Tabs */}
      <div className="bg-surface-dim p-1.5 rounded-[22px] border border-outline relative flex w-full overflow-x-visible md:overflow-x-auto no-scrollbar shadow-inner max-w-fit mx-auto md:mx-0">
        {/* Mobile/tablet sliding indicator */}
        <div
          className={`absolute top-1.5 bottom-1.5 rounded-[18px] kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium md:hidden will-change-transform w-[60px]
            ${selectedLogType === 'FLIGHT'          ? 'left-1.5 translate-x-0' : ''}
            ${selectedLogType === 'SEAPLANE'        ? 'left-1.5 translate-x-[60px]' : ''}
            ${selectedLogType === 'MARINE'          ? 'left-1.5 translate-x-[120px]' : ''}
            ${selectedLogType === 'FILLING_STATION' ? 'left-1.5 translate-x-[180px]' : ''}
            ${selectedLogType === 'BRIDGING'        ? 'left-1.5 translate-x-[240px]' : ''}
          `}
        />
        {/* Desktop sliding indicator */}
        <div
          className={`absolute top-1.5 bottom-1.5 rounded-[18px] kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium hidden md:block w-[calc(20%-2.4px)] will-change-transform
            ${selectedLogType === 'FLIGHT'          ? 'translate-x-0' : ''}
            ${selectedLogType === 'SEAPLANE'        ? 'translate-x-[100%]' : ''}
            ${selectedLogType === 'MARINE'          ? 'translate-x-[200%]' : ''}
            ${selectedLogType === 'FILLING_STATION' ? 'translate-x-[300%]' : ''}
            ${selectedLogType === 'BRIDGING'        ? 'translate-x-[400%]' : ''}
          `}
        />
        {[
          { id: 'FLIGHT', label: 'Into-Plane', icon: Plane, w: 'w-[60px] md:w-[160px]' },
          { id: 'SEAPLANE', label: 'Seaplane', icon: Sailboat, w: 'w-[60px] md:w-[160px]' },
          { id: 'MARINE', label: 'Marine Loading', icon: Anchor, w: 'w-[60px] md:w-[160px]' },
          { id: 'FILLING_STATION', label: 'Filling Stations', icon: Fuel, w: 'w-[60px] md:w-[160px]' },
          { id: 'BRIDGING', label: 'Refueller Loading', icon: Truck, w: 'w-[60px] md:w-[160px]' },
        ].map((tab) => {
          const isActive = selectedLogType === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedLogType(tab.id);
                setFilterFuelType('ALL');
                setFilterEquipment('ALL');
                setFilterStation('ALL');
                setActiveTooltip(tab.label);
              }}
              className={`${tab.w} flex-shrink-0 flex items-center justify-center py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors duration-300 active:scale-95 ${
                isActive
                  ? 'text-white font-black'
                  : 'text-on-surface-dim opacity-75 hover:text-on-surface'
              }`}
            >
              {/* Tooltip */}
              {activeTooltip === tab.label && (
                <div className="absolute bottom-full mb-3 bg-surface-container border border-outline px-2.5 py-1.5 rounded-xl text-[9px] font-black text-on-surface uppercase tracking-widest shadow-premium z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200 md:hidden">
                  {tab.label}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-surface-container" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-outline -z-10 mt-[1px]" />
                </div>
              )}

              <Icon className="w-4 h-4 md:hidden" />
              <span className="hidden md:inline">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div className="flex flex-col gap-6 p-6 bg-surface-dim border border-outline rounded-[24px] animate-in slide-in-from-top-2 duration-300">
           <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedLogType === 'FILLING_STATION' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6 items-end`}>
              {/* Start Date */}
              <div className="flex flex-col">
                 <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">Start Date</label>
                 <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
                    <input 
                       type="date"
                       value={filterStartDate}
                       onChange={(e) => setFilterStartDate(e.target.value)}
                       onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                       className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-outline rounded-xl text-[12px] font-bold text-on-surface focus:border-primary outline-none cursor-pointer"
                    />
                 </div>
              </div>

              {/* End Date */}
              <div className="flex flex-col">
                 <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">End Date</label>
                 <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
                    <input 
                       type="date"
                       value={filterEndDate}
                       onChange={(e) => setFilterEndDate(e.target.value)}
                       onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                       className="w-full pl-10 pr-4 py-3 bg-surface-lowest border border-outline rounded-xl text-[12px] font-bold text-on-surface focus:border-primary outline-none cursor-pointer"
                    />
                 </div>
              </div>

              {/* Fuel Type Dropdown (only on FILLING_STATION) */}
              {selectedLogType === 'FILLING_STATION' && (
                 <div className="flex flex-col">
                    <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">Fuel Type</label>
                    <select
                       value={filterFuelType}
                       onChange={(e) => setFilterFuelType(e.target.value)}
                       className="w-full px-4 py-3 bg-surface-lowest border border-outline rounded-xl text-[12px] font-bold text-on-surface focus:border-primary outline-none cursor-pointer"
                    >
                       <option value="ALL">ALL FUEL TYPES</option>
                       <option value="DIESEL">DIESEL</option>
                       <option value="PETROL">PETROL</option>
                    </select>
                 </div>
              )}

              {/* Station Dropdown (only on FILLING_STATION) */}
              {selectedLogType === 'FILLING_STATION' && (
                 <div className="flex flex-col">
                    <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">Station</label>
                    <select
                       value={filterStation}
                       onChange={(e) => setFilterStation(e.target.value)}
                       className="w-full px-4 py-3 bg-surface-lowest border border-outline rounded-xl text-[12px] font-bold text-on-surface focus:border-primary outline-none cursor-pointer"
                    >
                       <option value="ALL">ALL STATIONS</option>
                       <option value="AFS">AIRSIDE (AFS)</option>
                       <option value="LFS">LANDSIDE (LFS)</option>
                    </select>
                 </div>
              )}

              {/* Refueller Equipment Dropdown (only on BRIDGING) */}
              {selectedLogType === 'BRIDGING' && (
                 <div className="flex flex-col">
                    <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">Refueller Equipment</label>
                    <select
                       value={filterEquipment}
                       onChange={(e) => setFilterEquipment(e.target.value)}
                       className="w-full px-4 py-3 bg-surface-lowest border border-outline rounded-xl text-[12px] font-bold text-on-surface focus:border-primary outline-none cursor-pointer"
                    >
                       <option value="ALL">ALL REFUELLERS</option>
                       {(equipment || []).filter(eq => eq.type === EquipmentType.REFUELLER).map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.id}</option>
                       ))}
                    </select>
                 </div>
              )}

              {/* Clear Filters / Volume Summary */}
              <div className={`flex items-end justify-between sm:col-span-2 lg:col-span-1 gap-4 ${selectedLogType === 'FILLING_STATION' ? 'lg:col-start-5' : 'lg:col-start-4'}`}>
                 {(filterStartDate || filterEndDate || (selectedLogType === 'FILLING_STATION' && (filterFuelType !== 'ALL' || filterStation !== 'ALL')) || (selectedLogType === 'BRIDGING' && filterEquipment !== 'ALL')) && (
                    <button 
                       onClick={() => {
                          setFilterStartDate('');
                          setFilterEndDate('');
                          setFilterFuelType('ALL');
                          setFilterEquipment('ALL');
                          setFilterStation('ALL');
                       }} 
                       className="text-[10px] font-black text-error uppercase tracking-widest hover:underline flex items-center justify-center p-3 rounded-xl bg-error/10 hover:bg-error/20 md:bg-transparent md:p-0 md:h-[46px]"
                       title="Clear Filters"
                    >
                       <X className="w-4 h-4 md:mr-1.5" />
                       <span className="hidden md:inline">Clear Filters</span>
                    </button>
                 )}
                 <div className="bg-surface-lowest p-4 rounded-xl border border-outline flex flex-col items-end min-w-[150px] ml-auto">
                    <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1">Total Volume</span>
                    <span className="text-xl font-mono font-black text-primary">{totalVolume.toLocaleString()} <span className="text-[10px] opacity-50">L</span></span>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="p-32 flex flex-col items-center justify-center">
            <Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)] mb-6" />
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-40 animate-pulse">Syncing Archive Database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim/50 border-b border-outline">
                  {selectedLogType === 'FLIGHT' && (
                    <>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Timestamp</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Flight No</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Aircraft Reg / Type</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Stand</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Equipment</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Ticket</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                    </>
                  )}
                  {selectedLogType === 'SEAPLANE' && (
                    <>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Date</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Operator</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Pump ID</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Ticket</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                    </>
                  )}
                  {selectedLogType === 'FILLING_STATION' && (
                    <>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Date</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Station</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Product</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Vehicle Reg</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Invoice</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                    </>
                  )}
                  {selectedLogType === 'MARINE' && (
                    <>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Date</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Vessel Name</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Source RF</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Meter Open</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Meter Close</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Ticket</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                    </>
                  )}
                  {selectedLogType === 'BRIDGING' && (
                    <>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Date</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Source Tank</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Refueller</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Time (Start / End)</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {sortedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={selectedLogType === 'FLIGHT' || selectedLogType === 'MARINE' ? 8 : (selectedLogType === 'FILLING_STATION' ? 7 : 6)} className="px-10 py-20 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Zero matches in historical database</td>
                  </tr>
                ) : (
                  sortedLogs.map((log) => {
                      const operatorName = (staff && staff.length > 0 ? staff : MOCK_USERS).find(u => u.id === log.operatorId)?.name || 'Unknown';
                      const isExpanded = expandedLogId === log.id;
                      
                      const seaplaneOp = log.flightNumber.replace('SEAPLANE-', '');
                      const pumpId = log.vehicleId || log.aircraftReg.replace('PUMP-', '');
                      
                      const groundData = parseGroundLog(log);
                      const marineData = parseMarineLog(log);
                      
                      const colSpanCount = selectedLogType === 'FLIGHT' || selectedLogType === 'MARINE' ? 8 : (selectedLogType === 'FILLING_STATION' ? 7 : 6);

                      return (
                        <React.Fragment key={log.id}>
                        <tr 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className={`hover:bg-primary/[0.02] transition-colors group cursor-pointer ${isExpanded ? 'bg-primary/[0.03]' : ''}`}
                        >
                          {/* FLIGHT View */}
                          {selectedLogType === 'FLIGHT' && (
                            <>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                                  {log.timestampStart ? new Date(log.timestampStart).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: false }) : 'PENDING'}
                              </td>
                              <td className="px-10 py-6 text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">
                                  {log.flightNumber}
                              </td>
                              <td className="px-10 py-6">
                                  <div className="text-xs font-black text-on-surface uppercase tracking-widest">{log.aircraftReg}</div>
                                  <div className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-0.5">{log.aircraftType}</div>
                              </td>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim uppercase tracking-widest">
                                  {log.stand}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                                  {log.vehicleId}
                              </td>
                              <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                                  {log.volume.toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-left text-[11px] font-black text-error font-mono tracking-widest">
                                  {log.deliveryNumber || 'N/A'}
                              </td>
                            </>
                          )}

                          {/* SEAPLANE View */}
                          {selectedLogType === 'SEAPLANE' && (
                            <>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                                  {log.timestampStart ? new Date(log.timestampStart).toLocaleDateString([], { dateStyle: 'short' }) : 'PENDING'}
                              </td>
                              <td className="px-10 py-6 text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">
                                  {seaplaneOp}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                                  {pumpId}
                              </td>
                              <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                                  {log.volume.toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-left text-[11px] font-black text-error font-mono tracking-widest">
                                  {log.deliveryNumber || 'N/A'}
                              </td>
                            </>
                          )}

                          {/* FILLING_STATION View */}
                          {selectedLogType === 'FILLING_STATION' && (
                            <>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                                  {log.timestampStart ? new Date(log.timestampStart).toLocaleDateString([], { dateStyle: 'short' }) : 'PENDING'}
                              </td>
                              <td className="px-10 py-6 text-xs font-black text-on-surface uppercase tracking-widest">
                                  {groundData.station}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                                  {groundData.fuelType}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                                  {log.aircraftReg}
                              </td>
                              <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                                  {log.volume.toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-left text-[11px] font-black text-error font-mono tracking-widest">
                                  {log.deliveryNumber || 'N/A'}
                              </td>
                            </>
                          )}

                          {/* MARINE View */}
                          {selectedLogType === 'MARINE' && (
                            <>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                                  {log.timestampStart ? new Date(log.timestampStart).toLocaleDateString([], { dateStyle: 'short' }) : 'PENDING'}
                              </td>
                              <td className="px-10 py-6 text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">
                                  {marineData.vesselName}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                                  {log.vehicleId}
                              </td>
                              <td className="px-10 py-6 text-right text-xs font-bold text-on-surface-dim font-mono">
                                  {(log.meterOpen || 0).toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-right text-xs font-bold text-on-surface-dim font-mono">
                                  {(log.meterClose || 0).toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                                  {log.volume.toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-left text-[11px] font-black text-error font-mono tracking-widest">
                                  {log.deliveryNumber || 'N/A'}
                              </td>
                            </>
                          )}

                          {/* BRIDGING View */}
                          {selectedLogType === 'BRIDGING' && (
                            <>
                              <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                                  {log.operationalDate ? new Date(log.operationalDate).toLocaleDateString([], { dateStyle: 'short' }) : 'PENDING'}
                              </td>
                              <td className="px-10 py-6 text-xs font-black text-on-surface uppercase tracking-widest">
                                  {log.aircraftReg /* sourceTankId */}
                              </td>
                              <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                                  {log.vehicleId}
                              </td>
                              <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                                  {log.volume.toLocaleString()}
                              </td>
                              <td className="px-10 py-6 text-left text-[11px] font-black text-on-surface-dim font-mono tracking-widest">
                                  {log.timestampStart ? formatTime(log.timestampStart) : '--:--'} / {log.timestampFinalEnd ? formatTime(log.timestampFinalEnd) : '--:--'}
                              </td>
                            </>
                          )}

                          {/* Edit / Details Action Cell (always the last column) */}
                          <td className="px-10 py-6 text-right">
                              {canEdit && resolveLogType(log) !== 'BRIDGING' ? (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingLog(log);
                                    const primaryDate = getLocalDatePart(log.timestampStart || log.timestampArrived || log.timestampPosition || log.timestampInitialEnd) || new Date().toISOString().split('T')[0];
                                    setEditForm({
                                      flightNumber: log.flightNumber || '',
                                      aircraftReg: log.aircraftReg || '',
                                      aircraftType: log.aircraftType || '',
                                      stand: log.stand || '',
                                      deliveryNumber: log.deliveryNumber ? log.deliveryNumber.replace('MLE-', '') : '',
                                      volume: log.volume || 0,
                                      meterOpen: log.meterOpen || 0,
                                      meterClose: log.meterClose || 0,
                                      remarks: log.remarks || '',
                                      date: primaryDate,
                                      timeArrived: getLocalTimePart(log.timestampArrived),
                                      timePosition: getLocalTimePart(log.timestampPosition),
                                      timeStart: getLocalTimePart(log.timestampStart),
                                      timeEnd: getLocalTimePart(log.timestampInitialEnd)
                                    });
                                  }} 
                                  className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all"
                                >
                                  EDIT
                                </button>
                              ) : (
                                <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all">
                                  {isExpanded ? 'HIDE' : 'DETAILS'}
                                </button>
                              )}
                          </td>
                        </tr>
                        {isExpanded && (
                           <tr className="bg-surface-dim/30 border-b border-outline">
                              <td colSpan={colSpanCount} className="px-10 py-6">
                                 {/* Into-Plane details */}
                                 {selectedLogType === 'FLIGHT' && (
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Arrived</span>
                                         <span className="text-[11px] font-mono text-on-surface">{formatTime(log.timestampArrived)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Positioned</span>
                                         <span className="text-[11px] font-mono text-on-surface">{formatTime(log.timestampPosition)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Dispense Start</span>
                                         <span className="text-[11px] font-mono text-success">{formatTime(log.timestampStart)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Dispense End</span>
                                         <span className="text-[11px] font-mono text-error">{formatTime(log.timestampInitialEnd)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Panel check</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${log.panelCheck ? 'text-success' : 'text-error'}`}>{log.panelCheck ? 'CLOSED' : 'OPEN'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Appearance</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${log.appearanceCheck ? 'text-success' : 'text-error'}`}>{log.appearanceCheck ? 'CLEAR & BRIGHT' : 'FAIL'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Water Check</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${log.waterCheck ? 'text-success' : 'text-error'}`}>{log.waterCheck ? 'FREE' : 'FAIL'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Tactical Operator</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{operatorName}</span>
                                      </div>
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-4">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Remarks</span>
                                         <span className="text-[11px] text-on-surface opacity-80">{log.remarks || 'No operational remarks.'}</span>
                                      </div>
                                   </div>
                                 )}

                                 {/* Seaplane details */}
                                 {selectedLogType === 'SEAPLANE' && (
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Operator Name</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{seaplaneOp}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Infrastructure Registry</span>
                                         <span className="text-[11px] font-mono text-on-surface">PUMP-{pumpId}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Pumping Window</span>
                                         <span className="text-[11px] font-mono text-on-surface">08:00 - 16:00</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Database Sync Time</span>
                                         <span className="text-[11px] font-mono text-on-surface">{log.timestampClearance ? new Date(log.timestampClearance).toLocaleString() : 'N/A'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-4">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Remarks</span>
                                         <span className="text-[11px] text-on-surface opacity-80">{log.remarks || 'No operational remarks.'}</span>
                                      </div>
                                   </div>
                                 )}

                                 {/* Filling Station details */}
                                 {selectedLogType === 'FILLING_STATION' && (
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Station Location</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{groundData.station}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Product Delivered</span>
                                         <span className="text-[11px] font-black text-primary uppercase tracking-widest">{groundData.fuelType}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">On account of</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{groundData.account}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Payment Mode</span>
                                         <span className="text-[11px] font-black text-success uppercase tracking-widest">{groundData.paymentMode}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Received By</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{groundData.receivedBy}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Equipment Reference</span>
                                         <span className="text-[11px] text-on-surface font-bold">{groundData.equipmentName}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Recorded By</span>
                                         <span className="text-[11px] text-on-surface font-bold">{operatorName}</span>
                                      </div>
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-4">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Remarks</span>
                                         <span className="text-[11px] text-on-surface opacity-80">{log.remarks || 'No operational remarks.'}</span>
                                      </div>
                                   </div>
                                 )}

                                 {/* Marine details */}
                                 {selectedLogType === 'MARINE' && (
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Vessel Name</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{marineData.vesselName}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Source Refueller</span>
                                         <span className="text-[11px] font-mono text-on-surface">{log.vehicleId}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Opening Meter</span>
                                         <span className="text-[11px] font-mono text-on-surface">{(log.meterOpen || 0).toLocaleString()} L</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Closing Meter</span>
                                         <span className="text-[11px] font-mono text-on-surface">{(log.meterClose || 0).toLocaleString()} L</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Visual check</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${log.appearanceCheck ? 'text-success' : 'text-error'}`}>{log.appearanceCheck ? 'PASS' : 'FAIL'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Water verification</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${log.waterCheck ? 'text-success' : 'text-error'}`}>{log.waterCheck ? 'PASS' : 'FAIL'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Verifying Officer</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{marineData.supervisor}</span>
                                      </div>
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-4">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Remarks</span>
                                         <span className="text-[11px] text-on-surface opacity-80">{log.remarks || 'No operational remarks.'}</span>
                                      </div>
                                   </div>
                                 )}

                                 {/* Bridging details */}
                                 {selectedLogType === 'BRIDGING' && (
                                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Source Tank</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{log.aircraftReg /* sourceTankId */}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Target Refueller</span>
                                         <span className="text-[11px] font-mono text-on-surface">{log.vehicleId}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Start Time</span>
                                         <span className="text-[11px] font-mono text-on-surface">{formatTime(log.timestampStart)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">End Time</span>
                                         <span className="text-[11px] font-mono text-on-surface">{formatTime(log.timestampFinalEnd)}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC Visual Check</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${(log as any).visualCheckPassed ? 'text-success' : 'text-error'}`}>{(log as any).visualCheckPassed ? 'PASS' : 'FAIL'}</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">QC CWD Check</span>
                                         <span className={`text-[11px] font-black uppercase tracking-widest ${(log as any).cwdCheckPassed ? 'text-success' : 'text-error'}`}>{(log as any).cwdCheckPassed ? 'PASS' : 'FAIL'}</span>
                                      </div>
                                      {(log as any).density !== undefined && (
                                        <div className="flex flex-col gap-1">
                                           <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Observed Density</span>
                                           <span className="text-[11px] font-mono text-on-surface">{(log as any).density} kg/L</span>
                                        </div>
                                      )}
                                      {(log as any).temperature !== undefined && (
                                        <div className="flex flex-col gap-1">
                                           <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Observed Temperature</span>
                                           <span className="text-[11px] font-mono text-on-surface">{(log as any).temperature} °C</span>
                                        </div>
                                      )}
                                      <div className="flex flex-col gap-1 col-span-2 md:col-span-4">
                                         <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Recorded Operator / Supervisor</span>
                                         <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{log.operatorId}</span>
                                      </div>
                                   </div>
                                 )}
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                      );
                  })
                )}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingLog && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-surface-container rounded-[24px] sm:rounded-[32px] border border-outline shadow-2xl relative max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header: fixed/sticky */}
            <div className="p-5 sm:p-8 pb-4 border-b border-outline relative shrink-0">
              <button 
                onClick={() => setEditingLog(null)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-surface-dim text-on-surface hover:bg-error/10 hover:text-error transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="headline-sm text-on-surface mb-1 tracking-tighter">Edit Operational Log</h3>
              <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Modify details for Ticket: {editingLog.deliveryNumber || 'MLE-XXXXXX'}</p>
            </div>

            {/* Content: Scrollable */}
            <div className="p-5 sm:p-8 pt-4 overflow-y-auto space-y-6 flex-1">
              {/* Flight Info Grid */}
              <div>
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-3">Flight & Aircraft Details</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Flight Number</label>
                    <input 
                      type="text"
                      value={editForm.flightNumber}
                      onChange={e => setEditForm({...editForm, flightNumber: e.target.value})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Aircraft Reg</label>
                    <input 
                      type="text"
                      value={editForm.aircraftReg}
                      onChange={e => setEditForm({...editForm, aircraftReg: e.target.value})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Aircraft Type</label>
                    <input 
                      type="text"
                      value={editForm.aircraftType}
                      onChange={e => setEditForm({...editForm, aircraftType: e.target.value})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Stand</label>
                    <input 
                      type="text"
                      value={editForm.stand}
                      onChange={e => setEditForm({...editForm, stand: e.target.value})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery & Volumetrics */}
              <div>
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-3">Delivery & Meter Readings</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Ticket Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[12px] font-black text-on-surface-dim font-mono">MLE-</span>
                      <input 
                        type="text"
                        maxLength={6}
                        value={editForm.deliveryNumber}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setEditForm({...editForm, deliveryNumber: val});
                        }}
                        className="w-full bg-surface-lowest border border-outline rounded-xl pl-12 pr-3 py-2 text-error font-mono text-[12px] font-black focus:border-primary outline-none"
                        placeholder="000000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Volume (Liters)</label>
                    <input 
                      type="number"
                      value={editForm.volume}
                      onChange={e => setEditForm({...editForm, volume: e.target.valueAsNumber || 0})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Meter Open</label>
                    <input 
                      type="number"
                      value={editForm.meterOpen}
                      onChange={e => setEditForm({...editForm, meterOpen: e.target.valueAsNumber || 0})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Meter Close</label>
                    <input 
                      type="number"
                      value={editForm.meterClose}
                      onChange={e => setEditForm({...editForm, meterClose: e.target.valueAsNumber || 0})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Timings */}
              <div>
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-3">Operation Timing Specifications</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Operation Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50 pointer-events-none" />
                      <input 
                        type="date"
                        value={editForm.date}
                        onChange={e => setEditForm({...editForm, date: e.target.value})}
                        onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                        className="w-full pl-10 pr-4 py-2 bg-surface-lowest border border-outline rounded-xl text-on-surface text-[12px] font-bold focus:border-primary outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Arrived</label>
                      <input 
                        type="time"
                        value={editForm.timeArrived}
                        onChange={e => setEditForm({...editForm, timeArrived: e.target.value})}
                        className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Positioned</label>
                      <input 
                        type="time"
                        value={editForm.timePosition}
                        onChange={e => setEditForm({...editForm, timePosition: e.target.value})}
                        className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Dispense Start</label>
                      <input 
                        type="time"
                        value={editForm.timeStart}
                        onChange={e => setEditForm({...editForm, timeStart: e.target.value})}
                        className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5">Dispense End</label>
                      <input 
                        type="time"
                        value={editForm.timeEnd}
                        onChange={e => setEditForm({...editForm, timeEnd: e.target.value})}
                        className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-widest mb-2">Remarks</label>
                <textarea 
                  value={editForm.remarks}
                  onChange={e => setEditForm({...editForm, remarks: e.target.value})}
                  rows={2}
                  className="w-full bg-surface-lowest border border-outline rounded-xl px-4 py-3 text-on-surface text-[12px] font-bold focus:border-primary outline-none resize-none"
                  placeholder="Enter any additional details or remarks..."
                />
              </div>
            </div>

            {/* Footer: sticky/fixed */}
            <div className="p-5 sm:p-8 pt-4 border-t border-outline shrink-0 flex gap-4">
              <button 
                type="button"
                onClick={handleDeleteLog}
                disabled={saving}
                className="flex-1 bg-error/10 border border-error/30 text-error hover:bg-error hover:text-white font-black uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 text-[11px] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? 'Processing...' : 'Delete Record'}
              </button>
              <button 
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || !isValidTicket}
                className="flex-[2] kinetic-gradient text-white font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-premium hover:shadow-glow transition-all active:scale-95 text-[11px] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Log Record'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <style>{`
        @media (max-width: 1023px) {
          html.modal-open .sticky.top-0,
          html.modal-open header,
          html.modal-open .fixed.bottom-6 {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
