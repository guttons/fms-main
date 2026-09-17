import React, { useState, useMemo, useCallback } from 'react';
import { User, DelayLog, DelaySource, FlightLog, FlightJob, isDomesticFlight } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { haptic } from '../utils/haptics';
import { 
  Clock, 
  Search, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Filter, 
  Calendar, 
  FileSpreadsheet, 
  Plane, 
  MessageSquare, 
  X, 
  Save, 
  Layers, 
  Globe, 
  Home, 
  Zap, 
  Eye, 
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface DelayRecordsLogProps {
  user: User;
  onInspectFlightInMatrix?: (flightNumber: string) => void;
}

export const DELAY_FROM_OPTIONS: { id: string; label: string; icon: any; color: string }[] = [
  { id: 'INTERNATIONAL (AOCC/AIRLINE)', label: 'INTERNATIONAL (AOCC/AIRLINE)', icon: Globe, color: 'text-primary' },
  { id: 'DOMESTIC (AOCC)', label: 'DOMESTIC (AOCC)', icon: Home, color: 'text-success' },
  { id: 'INT/DOM (MALDIVIAN)', label: 'INT/DOM (MALDIVIAN)', icon: Zap, color: 'text-purple-400' },
];

export const COMMON_DELAY_CODES = [
  { code: '31', reason: 'AIRCRAFT REFUELLING / DE-FUELLING', category: 'Fuel' },
  { code: '93', reason: 'AIRCRAFT ROTATION / LATE ARRIVAL OF INBOUND AIRCRAFT', category: 'Operational' },
  { code: '89', reason: 'CENTRAL GROUND HANDLING / RESTRICTION', category: 'Handling' },
  { code: '41', reason: 'AIRCRAFT DEFECTS / TECHNICAL CHECKS', category: 'Technical' },
  { code: '11', reason: 'LATE CHECK-IN / PASSENGER BOARDING', category: 'Passenger' },
  { code: '71', reason: 'DEPARTURE STATION WEATHER CONDITIONS', category: 'Weather' },
  { code: '81', reason: 'AIR TRAFFIC CONTROL RESTRICTIONS (ATFM EN-ROUTE)', category: 'ATC' },
];

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM';

export const DelayRecordsLog: React.FC<DelayRecordsLogProps> = ({ user, onInspectFlightInMatrix }) => {
  const { delayLogs, createDelayLog, updateDelayLog, deleteDelayLog, flightLogs, flightJobs, staff } = useOperationalData();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RESPONDED'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DelayLog | null>(null);
  const [quickCommentRecord, setQuickCommentRecord] = useState<DelayLog | null>(null);
  const [quickCommentText, setQuickCommentText] = useState('');
  const [telemetryRecord, setTelemetryRecord] = useState<{ delay: DelayLog; flightLog?: FlightLog; flightJob?: FlightJob } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<DelayLog | null>(null);

  // New / Edit Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    delayFrom: 'INTERNATIONAL (AOCC/AIRLINE)' as DelaySource,
    operator: '',
    flightNumber: '',
    delayCode: '',
    delayReason: '',
    remarks: '',
    fuelTeam: '',
    fuelTeamComment: '',
    dutyInCharge: user.name || '',
    status: 'PENDING' as 'PENDING' | 'RESPONDED' | 'DISPUTED' | 'ACCEPTED',
    flightLogId: ''
  });

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      delayFrom: 'INTERNATIONAL (AOCC/AIRLINE)',
      operator: '',
      flightNumber: '',
      delayCode: '',
      delayReason: '',
      remarks: '',
      fuelTeam: '',
      fuelTeamComment: '',
      dutyInCharge: user.name || '',
      status: 'PENDING',
      flightLogId: ''
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingRecord(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (record: DelayLog) => {
    setEditingRecord(record);
    setFormData({
      date: record.date,
      delayFrom: record.delayFrom,
      operator: record.operator,
      flightNumber: record.flightNumber,
      delayCode: record.delayCode,
      delayReason: record.delayReason,
      remarks: record.remarks || '',
      fuelTeam: record.fuelTeam || '',
      fuelTeamComment: record.fuelTeamComment || '',
      dutyInCharge: record.dutyInCharge || user.name || '',
      status: record.status || 'PENDING',
      flightLogId: record.flightLogId || ''
    });
    setShowAddModal(true);
  };

  // Autocomplete flight logic: When a user enters or picks a flight number, auto-detect Airline, Delay From, and Fuel Team
  const handleFlightSelect = (flightNum: string) => {
    const clean = flightNum.trim().toUpperCase();
    setFormData(prev => {
      const next = { ...prev, flightNumber: clean };
      
      // Look in flightLogs or flightJobs for match
      const matchingLog = (flightLogs || []).find(fl => fl.flightNumber.toUpperCase() === clean);
      const matchingJob = (flightJobs || []).find(fj => fj.flightNumber.toUpperCase() === clean);

      if (matchingLog) {
        next.flightLogId = matchingLog.id;
        if (matchingLog.airline) next.operator = matchingLog.airline;
        const assignedCrew = [matchingLog.tacticalOperator, matchingLog.operatorName, matchingLog.vehicleId].filter(Boolean).join(' / ');
        if (assignedCrew) next.fuelTeam = assignedCrew;
      } else if (matchingJob) {
        if (matchingJob.aircraftReg) next.operator = matchingJob.aircraftReg;
        if (matchingJob.vehicleId) next.fuelTeam = matchingJob.vehicleId;
      }

      // Auto categorize Delay From
      if (clean.startsWith('Q2') || clean.startsWith('MALDIVIAN')) {
        next.delayFrom = 'INT/DOM (MALDIVIAN)';
        if (!next.operator) next.operator = 'Island Aviation Services (Maldivian)';
      } else if (clean.startsWith('VP') || clean.startsWith('NR')) {
        next.delayFrom = 'DOMESTIC (AOCC)';
        if (!next.operator) next.operator = clean.startsWith('VP') ? 'Flyme / Villa Air' : 'Manta Air';
      } else {
        next.delayFrom = 'INTERNATIONAL (AOCC/AIRLINE)';
      }

      return next;
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.flightNumber || !formData.operator) return;

    const autoStatus = formData.fuelTeamComment?.trim() ? 'RESPONDED' : 'PENDING';

    try {
      if (editingRecord) {
        await updateDelayLog(editingRecord.id, {
          ...formData,
          status: formData.status === 'PENDING' && formData.fuelTeamComment?.trim() ? 'RESPONDED' : formData.status
        });
      } else {
        await createDelayLog({
          ...formData,
          status: autoStatus
        });
      }
      setShowAddModal(false);
      resetForm();
      setEditingRecord(null);
    } catch (err) {
      console.error('Error saving delay log:', err);
    }
  };

  const handleQuickCommentSave = async () => {
    if (!quickCommentRecord) return;
    try {
      await updateDelayLog(quickCommentRecord.id, {
        fuelTeamComment: quickCommentText,
        dutyInCharge: quickCommentRecord.dutyInCharge || user.name || '',
        status: quickCommentText.trim() ? 'RESPONDED' : 'PENDING'
      });
      setQuickCommentRecord(null);
      setQuickCommentText('');
    } catch (err) {
      console.error('Error saving comment:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDelayLog(recordToDelete.id);
      setRecordToDelete(null);
    } catch (err) {
      console.error('Error deleting delay log:', err);
    }
  };

  // Inspection of fueling turnaround telemetry for a flight
  const handleInspectTelemetry = (delay: DelayLog) => {
    const cleanNo = delay.flightNumber.replace(/\s+/g, '').toUpperCase();
    const flightLog = (flightLogs || []).find(fl => fl.flightNumber.replace(/\s+/g, '').toUpperCase() === cleanNo);
    const flightJob = (flightJobs || []).find(fj => fj.flightNumber.replace(/\s+/g, '').toUpperCase() === cleanNo);
    setTelemetryRecord({ delay, flightLog, flightJob });
  };

  // Date filtering logic
  const filteredData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return (delayLogs || []).filter(item => {
      // Date preset
      if (datePreset === 'TODAY' && item.date !== todayStr) return false;
      if (datePreset === 'YESTERDAY' && item.date !== yesterdayStr) return false;
      if (datePreset === 'LAST_7_DAYS') {
        const itemDate = new Date(item.date);
        if (itemDate < sevenDaysAgo) return false;
      }
      if (datePreset === 'THIS_MONTH') {
        const itemDate = new Date(item.date);
        if (itemDate < firstOfMonth) return false;
      }
      if (datePreset === 'CUSTOM') {
        if (customStartDate && item.date < customStartDate) return false;
        if (customEndDate && item.date > customEndDate) return false;
      }

      // Source filter
      if (sourceFilter !== 'ALL' && item.delayFrom !== sourceFilter) return false;

      // Status filter
      if (statusFilter === 'PENDING' && item.status === 'RESPONDED') return false;
      if (statusFilter === 'RESPONDED' && item.status !== 'RESPONDED') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.flightNumber.toLowerCase().includes(q) ||
          item.operator.toLowerCase().includes(q) ||
          (item.delayCode && item.delayCode.toLowerCase().includes(q)) ||
          (item.delayReason && item.delayReason.toLowerCase().includes(q)) ||
          (item.remarks && item.remarks.toLowerCase().includes(q)) ||
          (item.fuelTeam && item.fuelTeam.toLowerCase().includes(q)) ||
          (item.fuelTeamComment && item.fuelTeamComment.toLowerCase().includes(q)) ||
          (item.dutyInCharge && item.dutyInCharge.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [delayLogs, datePreset, customStartDate, customEndDate, sourceFilter, statusFilter, searchQuery]);

  // KPI Calculations
  const totalCount = filteredData.length;
  const fuelAttributedCount = filteredData.filter(d => (d.delayCode === '31' || d.delayReason.toLowerCase().includes('fuel'))).length;
  const pendingCount = filteredData.filter(d => !d.fuelTeamComment?.trim()).length;
  const respondedCount = totalCount - pendingCount;
  const responseRate = totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 100;

  // Export CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const headers = [
      'DATE',
      'DELAY FROM',
      'OPERATOR',
      'FLIGHT',
      'DELAY CODE',
      'DELAY REASON',
      'REMARKS',
      'FUEL TEAM',
      'FUEL TEAM COMMENT',
      'DUTY IN-CHARGE',
      'STATUS'
    ];

    const rows = filteredData.map(item => [
      item.date,
      item.delayFrom,
      item.operator,
      item.flightNumber,
      item.delayCode || '-',
      item.delayReason || '-',
      item.remarks || '-',
      item.fuelTeam || '-',
      item.fuelTeamComment || '-',
      item.dutyInCharge || '-',
      item.status || 'PENDING'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MACL_AOCC_Delay_Log_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Delays */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Total Delays Logged
            </span>
            <div className="text-2xl sm:text-3xl font-[900] text-on-surface font-mono tracking-tight">
              {totalCount}
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-70">
              Reported from AOCC & Airlines
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Fuel Attributed */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Fuel Attributed (Code 31)
            </span>
            <div className="text-2xl sm:text-3xl font-[900] font-mono tracking-tight text-amber-500">
              {fuelAttributedCount}
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-70">
              {totalCount > 0 ? `${Math.round((fuelAttributedCount / totalCount) * 100)}% of reported delays` : '0%'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Response */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Pending Fuel Comment
            </span>
            <div className={`text-2xl sm:text-3xl font-[900] font-mono tracking-tight ${pendingCount > 0 ? 'text-error' : 'text-success'}`}>
              {pendingCount}
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-70">
              {pendingCount > 0 ? 'Requires investigation' : 'All delays responded'}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${pendingCount > 0 ? 'bg-error/10 text-error border-error/20' : 'bg-success/10 text-success border-success/20'}`}>
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Response Rate */}
        <div className="card-premium p-5 border-outline flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-60">
              Investigation Rate
            </span>
            <div className="text-2xl sm:text-3xl font-[900] font-mono tracking-tight text-success">
              {responseRate}%
            </div>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-70">
              {respondedCount} of {totalCount} investigated
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center border border-success/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Actions */}
      <div className="card-premium p-4 sm:p-5 border-outline space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-on-surface-dim opacity-40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flight, operator, code, remarks, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface placeholder:text-on-surface-dim placeholder:opacity-40 outline-none focus:border-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-dim hover:text-on-surface">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-premium hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Log Delay Record</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="px-4 py-2 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl text-xs font-black uppercase tracking-wider text-on-surface flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Source Dropdown & Date Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-outline/50">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Delay Source Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim opacity-70">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer"
              >
                <option value="ALL">ALL SOURCES</option>
                {DELAY_FROM_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim opacity-70">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="PENDING">PENDING FUEL COMMENT</option>
                <option value="RESPONDED">INVESTIGATED & ANSWERED</option>
              </select>
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-dim border border-outline rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
            {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'THIS_MONTH', 'ALL', 'CUSTOM'] as DatePreset[]).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                  datePreset === preset
                    ? 'kinetic-gradient text-white shadow-sm'
                    : 'text-on-surface-dim hover:text-on-surface font-bold'
                }`}
              >
                {preset === 'LAST_7_DAYS' ? '7D' : preset === 'THIS_MONTH' ? 'MONTH' : preset}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {datePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-dim">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Delay Records Table (Matching exactly the 9 columns of user attachment) */}
      <div className="card-premium border-outline overflow-hidden shadow-premium">
        <div className="p-4 bg-surface-dim/40 border-b border-outline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-on-surface">
              AOCC Delay Records Matrix
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface-dim text-[10px] font-mono font-bold text-on-surface-dim border border-outline">
              {filteredData.length} records
            </span>
          </div>
          <span className="text-[10px] font-bold text-on-surface-dim opacity-60 uppercase tracking-widest hidden sm:inline">
            Click flight or eye icon to inspect fueling turnaround telemetry
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-outline bg-surface-container/60 text-on-surface uppercase tracking-wider font-black text-[10px] select-none">
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[200px]">Delay From</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[140px]">Operator</th>
                <th className="px-3 py-3.5 border-r border-outline/50 min-w-[100px] text-center">Flight</th>
                <th className="px-3 py-3.5 border-r border-outline/50 min-w-[90px] text-center">Delay Code</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[200px]">Delay Reason</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[220px]">Remarks</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[150px]">Fuel Team</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[250px]">Fuel Team's Comment</th>
                <th className="px-4 py-3.5 border-r border-outline/50 min-w-[130px]">Duty In-Charge</th>
                <th className="px-3 py-3.5 text-center min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/40 font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-on-surface-dim">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Clock className="w-10 h-10 opacity-30" />
                      <p className="font-bold text-sm">No delay records found</p>
                      <p className="text-xs opacity-60 max-w-sm">
                        No delay reports match your current filter criteria. Click "Log Delay Record" to register an AOCC or Airline report.
                      </p>
                      <button
                        onClick={handleOpenAdd}
                        className="mt-2 px-4 py-2 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        Log Delay Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => {
                  const isFuelDelay = item.delayCode === '31' || item.delayReason.toLowerCase().includes('fuel');
                  const hasComment = !!item.fuelTeamComment?.trim();

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-primary/[0.03] transition-colors ${
                        isFuelDelay 
                          ? 'bg-amber-500/[0.04]' 
                          : idx % 2 === 0 ? 'bg-surface/30' : 'bg-surface-dim/20'
                      }`}
                    >
                      {/* 1. DELAY FROM */}
                      <td className="px-4 py-3.5 border-r border-outline/50">
                        <span className="font-black text-[11px] text-on-surface uppercase tracking-tight">
                          {item.delayFrom}
                        </span>
                        <span className="block text-[9px] font-mono text-on-surface-dim opacity-60">
                          {item.date}
                        </span>
                      </td>

                      {/* 2. OPERATOR */}
                      <td className="px-4 py-3.5 border-r border-outline/50 font-bold text-on-surface">
                        {item.operator}
                      </td>

                      {/* 3. FLIGHT */}
                      <td className="px-3 py-3.5 border-r border-outline/50 font-mono font-[900] text-center text-primary">
                        <button
                          onClick={() => handleInspectTelemetry(item)}
                          className="hover:underline inline-flex items-center justify-center gap-1 mx-auto"
                          title="Inspect Fueling Turnaround Telemetry"
                        >
                          {item.flightNumber}
                          <Eye className="w-3 h-3 opacity-60" />
                        </button>
                      </td>

                      {/* 4. DELAY CODE */}
                      <td className="px-3 py-3.5 border-r border-outline/50 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded-md font-black text-xs ${
                          item.delayCode === '31' 
                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                            : 'bg-surface-dim text-on-surface border border-outline'
                        }`}>
                          {item.delayCode || '-'}
                        </span>
                      </td>

                      {/* 5. DELAY REASON */}
                      <td className="px-4 py-3.5 border-r border-outline/50 font-semibold text-on-surface">
                        <span className="line-clamp-2 max-w-xs" title={item.delayReason}>
                          {item.delayReason || '-'}
                        </span>
                      </td>

                      {/* 6. REMARKS */}
                      <td className="px-4 py-3.5 border-r border-outline/50 text-on-surface-dim text-xs">
                        <span className="line-clamp-2 max-w-xs" title={item.remarks}>
                          {item.remarks || '-'}
                        </span>
                      </td>

                      {/* 7. FUEL TEAM */}
                      <td className="px-4 py-3.5 border-r border-outline/50 font-mono text-xs text-on-surface">
                        {item.fuelTeam || '-'}
                      </td>

                      {/* 8. FUEL TEAM'S COMMENT */}
                      <td className="px-4 py-3.5 border-r border-outline/50 text-xs">
                        {hasComment ? (
                          <div className="group/comment relative">
                            <p className="line-clamp-2 text-on-surface font-medium italic" title={item.fuelTeamComment}>
                              "{item.fuelTeamComment}"
                            </p>
                            <button
                              onClick={() => {
                                setQuickCommentRecord(item);
                                setQuickCommentText(item.fuelTeamComment || '');
                              }}
                              className="text-[9px] font-black uppercase text-primary hover:underline mt-0.5 inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-2.5 h-2.5" /> Edit Response
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setQuickCommentRecord(item);
                              setQuickCommentText('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <Plus className="w-3 h-3" /> Add Response
                          </button>
                        )}
                      </td>

                      {/* 9. DUTY IN-CHARGE */}
                      <td className="px-4 py-3.5 border-r border-outline/50 text-xs font-bold text-on-surface">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3 text-primary opacity-60" />
                          {item.dutyInCharge || '-'}
                        </span>
                      </td>

                      {/* 10. ACTIONS */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-dim hover:text-primary transition-colors"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRecordToDelete(item)}
                            className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-dim hover:text-error transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create / Edit Delay Record */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          <div 
            className="bg-surface-container border border-outline rounded-3xl max-w-2xl w-full mx-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 sm:p-8 pb-4 border-b border-outline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-[900] text-on-surface tracking-tight uppercase">
                    {editingRecord ? 'Edit Delay Record' : 'Log AOCC / Airline Delay Record'}
                  </h3>
                  <p className="text-[10px] font-bold text-on-surface-dim opacity-60 uppercase tracking-widest">
                    Formal delay investigation & telemetry cross-check
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveForm} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 sm:p-8 py-5 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Operational Date */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Date of Operation *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>

                  {/* Delay From */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Delay From *
                    </label>
                    <select
                      value={formData.delayFrom}
                      onChange={(e) => setFormData({ ...formData, delayFrom: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary"
                    >
                      {DELAY_FROM_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                      <option value="OTHER / CHARTER">OTHER / CHARTER</option>
                    </select>
                  </div>

                  {/* Flight Number */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Flight Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter flight number..."
                      value={formData.flightNumber}
                      onChange={(e) => handleFlightSelect(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-black text-primary uppercase outline-none focus:border-primary"
                    />
                    <span className="block text-[9px] text-on-surface-dim opacity-60 mt-1">
                      Auto-populates operator and fuel crew if found in logs
                    </span>
                  </div>

                  {/* Operator / Airline */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Operator / Airline *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Airline or operator..."
                      value={formData.operator}
                      onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>

                  {/* Delay Code */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Delay Code (IATA / AOCC)
                    </label>
                    <input
                      type="text"
                      placeholder="Delay code..."
                      value={formData.delayCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = COMMON_DELAY_CODES.find(c => c.code === code);
                        setFormData({
                          ...formData,
                          delayCode: code,
                          delayReason: match ? match.reason : formData.delayReason
                        });
                      }}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface outline-none focus:border-primary"
                    />
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {COMMON_DELAY_CODES.slice(0, 4).map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setFormData({ ...formData, delayCode: c.code, delayReason: c.reason })}
                          className="px-1.5 py-0.5 rounded bg-surface-dim text-[8px] font-mono font-bold text-primary hover:bg-primary/10 border border-outline"
                        >
                          Code {c.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delay Reason */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Delay Reason *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Description of delay reason..."
                      value={formData.delayReason}
                      onChange={(e) => setFormData({ ...formData, delayReason: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Remarks from AOCC */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                    AOCC / Airline Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="AOCC or airline operational remarks..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fuel Team */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Fuel Team / Equipment
                    </label>
                    <input
                      type="text"
                      placeholder="Dispenser / Refueller or crew..."
                      value={formData.fuelTeam}
                      onChange={(e) => setFormData({ ...formData, fuelTeam: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>

                  {/* Duty In-Charge */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                      Duty In-Charge
                    </label>
                    <input
                      type="text"
                      placeholder="Duty Officer in-charge..."
                      value={formData.dutyInCharge}
                      onChange={(e) => setFormData({ ...formData, dutyInCharge: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Fuel Team Comment */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                    Fuel Team's Comment / Defense Response
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Official investigation findings and operational response..."
                    value={formData.fuelTeamComment}
                    onChange={(e) => setFormData({ ...formData, fuelTeamComment: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex gap-3 p-6 sm:p-8 py-4 border-t border-outline justify-end flex-shrink-0 bg-surface-dim/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline text-xs font-black uppercase tracking-wider text-on-surface hover:bg-surface-dim transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-premium hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {editingRecord ? 'Update Record' : 'Save Delay Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Fuel Team Comment Modal */}
      {quickCommentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          <div 
            className="bg-surface-container border border-outline rounded-3xl max-w-lg w-full mx-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-3 border-b border-outline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-[900] text-on-surface tracking-tight uppercase">
                    Fuel Team's Response
                  </h3>
                  <span className="text-[10px] font-mono text-primary font-black">
                    Flight {quickCommentRecord.flightNumber} ({quickCommentRecord.operator})
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setQuickCommentRecord(null)}
                className="p-1.5 rounded-lg text-on-surface-dim hover:text-on-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 py-4 overflow-y-auto space-y-4 flex-1">
              <div className="p-3 bg-surface-dim/40 rounded-xl border border-outline/40 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">Reported Delay</span>
                <p className="text-xs font-bold text-on-surface">
                  Code {quickCommentRecord.delayCode || 'N/A'}: {quickCommentRecord.delayReason}
                </p>
                {quickCommentRecord.remarks && (
                  <p className="text-[10px] text-on-surface-dim italic">
                    Remarks: {quickCommentRecord.remarks}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1.5">
                  Official Response / Investigation Remarks
                </label>
                <textarea
                  rows={4}
                  autoFocus
                  placeholder="Enter operational response..."
                  value={quickCommentText}
                  onChange={(e) => setQuickCommentText(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 py-4 border-t border-outline justify-end flex-shrink-0 bg-surface-dim/30">
              <button
                type="button"
                onClick={() => setQuickCommentRecord(null)}
                className="px-4 py-2 rounded-xl border border-outline text-xs font-black uppercase tracking-wider text-on-surface hover:bg-surface-dim cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickCommentSave}
                className="px-5 py-2 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-premium cursor-pointer"
              >
                Save Response
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Fueling Turnaround Inspection Drawer / Modal */}
      {telemetryRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          <div 
            className="bg-surface-container border border-outline rounded-3xl max-w-xl w-full mx-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-3 border-b border-outline flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Plane className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-[900] text-on-surface tracking-tight uppercase">
                    Fueling Turnaround Telemetry
                  </h3>
                  <span className="text-[10px] font-mono text-primary font-black">
                    Flight {telemetryRecord.delay.flightNumber} • {telemetryRecord.delay.operator}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setTelemetryRecord(null)}
                className="p-1.5 rounded-lg text-on-surface-dim hover:text-on-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 py-4 overflow-y-auto space-y-4 flex-1">
              {/* Delay Details Recap */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">AOCC Delay Report</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 font-mono font-black text-[10px]">
                    Code {telemetryRecord.delay.delayCode || '-'}
                  </span>
                </div>
                <p className="text-xs font-bold text-on-surface">
                  {telemetryRecord.delay.delayReason}
                </p>
                {telemetryRecord.delay.remarks && (
                  <p className="text-[10px] text-on-surface-dim italic">
                    Remarks: {telemetryRecord.delay.remarks}
                  </p>
                )}
              </div>

              {/* Flight Milestones from FlightLog */}
              {telemetryRecord.flightLog ? (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-70">
                    Actual Recorded Fueling Milestones
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">STD</span>
                      <span className="font-mono text-xs font-black text-warning">
                        {telemetryRecord.flightLog.std || '--:--'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">TOBT</span>
                      <span className="font-mono text-xs font-black text-primary">
                        {telemetryRecord.flightLog.tobt || '--:--'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">FRT Airline</span>
                      <span className="font-mono text-xs font-bold text-on-surface">
                        {telemetryRecord.flightLog.frtAirline || '--:--'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">Pumping Start</span>
                      <span className="font-mono text-xs font-black text-on-surface">
                        {telemetryRecord.flightLog.timestampStart ? new Date(telemetryRecord.flightLog.timestampStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">Fuel End</span>
                      <span className="font-mono text-xs font-black text-success">
                        {telemetryRecord.flightLog.timestampFinalEnd || telemetryRecord.flightLog.timestampInitialEnd ? new Date(telemetryRecord.flightLog.timestampFinalEnd || telemetryRecord.flightLog.timestampInitialEnd!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-surface-dim/50 rounded-xl border border-outline/50">
                      <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60">Clearance</span>
                      <span className="font-mono text-xs font-black text-primary">
                        {telemetryRecord.flightLog.timestampClearance ? new Date(telemetryRecord.flightLog.timestampClearance).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-dim/30 rounded-xl border border-outline/50 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-on-surface-dim">Vehicle / Dispenser:</span>
                      <span className="font-mono font-bold text-on-surface">{telemetryRecord.flightLog.vehicleId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-dim">Volume Uplifted:</span>
                      <span className="font-mono font-bold text-primary">{(telemetryRecord.flightLog.volume || 0).toLocaleString()} L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-dim">Operator / Officer:</span>
                      <span className="font-bold text-on-surface">{telemetryRecord.flightLog.tacticalOperator || telemetryRecord.flightLog.operatorName || '-'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-surface-dim/30 rounded-2xl border border-outline text-center text-on-surface-dim space-y-1">
                  <AlertCircle className="w-8 h-8 opacity-40 mx-auto" />
                  <p className="font-bold text-xs">No matching Into-Plane flight log found for {telemetryRecord.delay.flightNumber}</p>
                  <p className="text-[10px] opacity-60">The flight may not have had an active digital into-plane log recorded on this date.</p>
                </div>
              )}
            </div>

            <div className="p-6 py-4 border-t border-outline flex justify-end flex-shrink-0 bg-surface-dim/30">
              <button
                type="button"
                onClick={() => setTelemetryRecord(null)}
                className="px-5 py-2 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-hidden">
          <div 
            className="bg-surface-container border border-outline rounded-3xl p-6 sm:p-8 max-w-sm w-full mx-auto shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center border border-error/20 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-[900] text-on-surface uppercase">Delete Delay Record?</h3>
              <p className="text-xs text-on-surface-dim opacity-70">
                Are you sure you want to delete the delay record for <span className="font-mono font-bold text-primary">{recordToDelete.flightNumber}</span>?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline text-xs font-black uppercase tracking-wider text-on-surface hover:bg-surface-dim cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 bg-error text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
