import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MOCK_USERS } from '../constants';
import { FileText, Search, Download, Filter, X } from 'lucide-react';
import { Logo } from './Logo';
import { useOperationalData } from '../context/OperationalDataContext';
import { supabaseService } from '../services/supabaseService';
import { FlightLog, User, UserRole } from '../types';

interface LogHistoryProps {
  user?: User;
}

export const LogHistory: React.FC<LogHistoryProps> = ({ user }) => {
  const { staff } = useOperationalData();
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
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
      const fetchedLogs = await supabaseService.getFlightLogs();
      setLogs(fetchedLogs);
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
    const matchesSearch = log && (
      log.flightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.aircraftReg.toLowerCase().includes(searchTerm.toLowerCase())
    );

    let matchesDate = true;
    if (filterDate && log.timestampStart) {
      const logDate = new Date(log.timestampStart).toLocaleDateString('en-CA');
      matchesDate = logDate === filterDate;
    }

    return matchesSearch && matchesDate;
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

      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-dim border border-outline rounded-[24px] animate-in slide-in-from-top-2 duration-300">
           <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex flex-col">
                 <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2">Filter By Date</label>
                 <input 
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                    className="bg-surface-lowest border border-outline rounded-xl px-4 py-3 text-[12px] font-bold text-on-surface focus:border-primary outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer cursor-pointer"
                 />
              </div>
              {filterDate && (
                 <button onClick={() => setFilterDate('')} className="mt-6 text-[10px] font-black text-error uppercase tracking-widest hover:underline">Clear Date</button>
              )}
           </div>
           
           <div className="bg-surface-lowest p-4 rounded-xl border border-outline flex flex-col items-end min-w-[200px]">
              <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1">Total Volume (Filtered)</span>
              <span className="text-2xl font-mono font-black text-primary">{totalVolume.toLocaleString()} <span className="text-sm opacity-50">L</span></span>
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
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Timestamp</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Flight ID</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Equipment Used</th>
                  <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Delivery Ticket</th>
                  <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {sortedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-10 py-20 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Zero matches in historical database</td>
                  </tr>
                ) : (
                  sortedLogs.map((log) => {
                      const operatorName = (staff && staff.length > 0 ? staff : MOCK_USERS).find(u => u.id === log.operatorId)?.name || 'Unknown';
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                        <tr 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className={`hover:bg-primary/[0.02] transition-colors group cursor-pointer ${isExpanded ? 'bg-primary/[0.03]' : ''}`}
                        >
                          <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                              {log.timestampStart ? new Date(log.timestampStart).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', hour12: false }) : 'PENDING'}
                          </td>
                          <td className="px-10 py-6">
                              <div className="text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.flightNumber}</div>
                              <div className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-1">{log.aircraftReg} ({log.aircraftType})</div>
                          </td>
                          <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest font-mono">
                              {log.vehicleId || 'N/A'}
                          </td>
                          <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                              {log.volume.toLocaleString()}
                          </td>
                          <td className="px-10 py-6 text-left text-[11px] font-black text-error font-mono tracking-widest">
                              {log.deliveryNumber || 'N/A'}
                          </td>
                          <td className="px-10 py-6 text-right">
                              {canEdit ? (
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
                              <td colSpan={6} className="px-10 py-6">
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
                                       <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Tactical Operator</span>
                                       <span className="text-[11px] font-black text-on-surface uppercase tracking-widest">{operatorName}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 col-span-2">
                                       <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Remarks</span>
                                       <span className="text-[11px] text-on-surface opacity-80">{log.remarks || 'No operational remarks.'}</span>
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                      );
                  })
                )}
              </tbody>
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
                    <input 
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm({...editForm, date: e.target.value})}
                      className="w-full bg-surface-lowest border border-outline rounded-xl px-3 py-2 text-on-surface text-[12px] font-bold focus:border-primary outline-none"
                    />
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
