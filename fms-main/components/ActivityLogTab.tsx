import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck, Search, Filter, Download, RefreshCw, Calendar,
  ChevronLeft, ChevronRight, Eye, AlertTriangle, Radio,
  Clock, User as UserIcon, Tag, Database, ArrowUpDown, FileText, CheckCircle2,
  Copy, Check
} from 'lucide-react';
import { SystemActivityLog } from '../types';
import { activityLogService, LogModule, LogAction } from '../services/activityLogService';
import { Logo } from './Logo';

interface ActivityLogTabProps {
  currentUser?: any;
  pushNotification?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error' | 'critical') => void;
}

const ACTION_COLORS: Record<string, string> = {
  [LogAction.CREATE]: 'bg-success/10 text-success border-success/20',
  [LogAction.UPDATE]: 'bg-primary/10 text-primary border-primary/20',
  [LogAction.DELETE]: 'bg-error/10 text-error border-error/20',
  [LogAction.ROLE_CHANGE]: 'bg-error/15 text-error border-error/30 font-black ring-1 ring-error/20',
  [LogAction.STATUS_CHANGE]: 'bg-warning/10 text-warning border-warning/20',
  [LogAction.LOGIN]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  [LogAction.LOGOUT]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  [LogAction.ASSIGN]: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  [LogAction.UNASSIGN]: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  [LogAction.START_JOB]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [LogAction.COMPLETE_JOB]: 'bg-emerald-600/10 text-emerald-400 border-emerald-600/20',
  [LogAction.APPROVE]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  [LogAction.REJECT]: 'bg-error/10 text-error border-error/20',
  [LogAction.SYNC]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  [LogAction.IMPORT]: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  [LogAction.EXPORT]: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  [LogAction.PASSWORD_CHANGE]: 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-black',
};

const MODULE_COLORS: Record<string, string> = {
  [LogModule.AUTH]: 'text-amber-400',
  [LogModule.STAFF]: 'text-cyan-400',
  [LogModule.EQUIPMENT]: 'text-blue-400',
  [LogModule.TANKS]: 'text-emerald-400',
  [LogModule.VESSELS]: 'text-teal-400',
  [LogModule.FLIGHT_JOBS]: 'text-sky-400',
  [LogModule.FLIGHT_LOG]: 'text-indigo-400',
  [LogModule.DELAY_LOG]: 'text-orange-400',
  [LogModule.SHIFT_BRIEFING]: 'text-violet-400',
  [LogModule.FINANCE]: 'text-yellow-400',
  [LogModule.SCHEDULE]: 'text-pink-400',
  [LogModule.FLIGHT_MASTER]: 'text-purple-400',
  [LogModule.SYSTEM_SETTINGS]: 'text-rose-400',
  [LogModule.INTO_PLANE]: 'text-blue-300',
  [LogModule.BRIDGING]: 'text-lime-400',
  [LogModule.TANKER_DISCHARGE]: 'text-cyan-300',
  [LogModule.STOCK]: 'text-emerald-300',
  [LogModule.SEAPLANE]: 'text-sky-300',
};

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ currentUser, pushNotification }) => {
  const [logs, setLogs] = useState<SystemActivityLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSupabaseLive, setIsSupabaseLive] = useState(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Filters
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const limit = 30;

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState<SystemActivityLog | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch logs
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await activityLogService.getActivityLogs({
        page,
        limit,
        module: moduleFilter,
        action: actionFilter,
        searchTerm,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setLogs(res.logs);
      setTotalCount(res.totalCount);
      setIsSupabaseLive(res.isSupabaseConnected);
    } catch (err) {
      console.warn('[ActivityLogTab] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, moduleFilter, actionFilter, searchTerm, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime subscription
  useEffect(() => {
    if (!isLiveStreaming) return;

    const unsubscribe = activityLogService.subscribeToLogs((newLog) => {
      // Prepend if matches current filter
      setLogs((prev) => {
        if (prev.some((l) => l.id === newLog.id)) return prev;
        const matchesModule = moduleFilter === 'ALL' || newLog.module === moduleFilter;
        const matchesAction = actionFilter === 'ALL' || newLog.action === actionFilter;
        if (matchesModule && matchesAction) {
          return [newLog, ...prev.slice(0, limit - 1)];
        }
        return prev;
      });
      setTotalCount((c) => c + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [isLiveStreaming, moduleFilter, actionFilter, limit]);

  // Export CSV
  const handleExportCSV = async () => {
    try {
      // Fetch full current filtered set up to 1000 items
      const res = await activityLogService.getActivityLogs({
        page: 0,
        limit: 1000,
        module: moduleFilter,
        action: actionFilter,
        searchTerm,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      activityLogService.exportToCSV(res.logs, `macl_fms_security_audit_${moduleFilter.toLowerCase()}`);
      if (pushNotification) {
        pushNotification(`Successfully exported ${res.logs.length} audit records to CSV.`, 'success');
      }
    } catch (e) {
      if (pushNotification) pushNotification('Failed to export activity logs.', 'error');
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setModuleFilter('ALL');
    setActionFilter('ALL');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const hasActiveFilters = moduleFilter !== 'ALL' || actionFilter !== 'ALL' || searchTerm || startDate || endDate;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const sqlMigrationCode = `-- Run this in Supabase SQL Editor if table is not yet created:
CREATE TABLE IF NOT EXISTS public.system_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  employee_id TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_label TEXT,
  description TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sys_act_created_at ON public.system_activity_log(created_at DESC);
ALTER TABLE public.system_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated to insert activity log" ON public.system_activity_log FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Admins can view activity logs" ON public.system_activity_log FOR SELECT TO authenticated, anon USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_activity_log;
NOTIFY pgrst, 'reload schema';`;

  return (
    <div className="space-y-6">
      {/* Table status banner if Supabase dedicated table is running on local/fallback mode */}
      {!isSupabaseLive && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-400">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Active Buffer Mode Enabled</p>
              <p className="text-[10px] text-on-surface-dim opacity-80">
                Audit logs are actively captured in high-speed local memory & staff audit records. Run the migration to enable full cloud table archiving.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-300 border border-amber-500/30 whitespace-nowrap transition-all"
          >
            View SQL Migration
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-on-surface uppercase tracking-tight flex items-center gap-2">
                System Activity & Security Tracker
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20 font-black">
                  Admin Exclusive
                </span>
              </h2>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest mt-0.5">
                Full-system forensic audit trail • {totalCount} Recorded Events
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Live Stream Toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${
              isLiveStreaming
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-surface-container-low text-on-surface-dim border-outline opacity-60'
            }`}
            title={isLiveStreaming ? 'Live real-time stream active' : 'Live stream paused'}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{isLiveStreaming ? 'Live Stream' : 'Paused'}</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchLogs()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-surface-container border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest text-on-surface hover:text-primary transition-all active:scale-95"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export to CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-premium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-low/40 p-4 rounded-2xl border border-outline/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-on-surface-dim opacity-40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              placeholder="Search description, personnel, RC, entity..."
              className="w-full text-[10px] font-bold bg-surface-container-lowest border border-outline/50 rounded-xl pl-9 pr-4 py-2 text-on-surface focus:border-primary outline-none"
            />
          </div>

          {/* Module Filter */}
          <div className="relative">
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(0);
              }}
              className="w-full text-[10px] font-black uppercase tracking-wider bg-surface-container-lowest border border-outline/50 rounded-xl px-3 py-2 text-on-surface appearance-none cursor-pointer focus:border-primary outline-none"
            >
              <option value="ALL">All Modules</option>
              {Object.entries(LogModule).map(([key, val]) => (
                <option key={key} value={val}>
                  {key.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              className="w-full text-[10px] font-black uppercase tracking-wider bg-surface-container-lowest border border-outline/50 rounded-xl px-3 py-2 text-on-surface appearance-none cursor-pointer focus:border-primary outline-none"
            >
              <option value="ALL">All Actions</option>
              {Object.entries(LogAction).map(([key, val]) => (
                <option key={key} value={val}>
                  {key.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker Start */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
              className="w-full text-[10px] font-bold bg-surface-container-lowest border border-outline/50 rounded-xl px-3 py-1.5 text-on-surface focus:border-primary outline-none"
              title="From Date"
            />
          </div>
        </div>

        {/* Filter Badges & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-outline/30 text-[10px]">
            <span className="font-bold text-on-surface-dim opacity-70">
              Active filters applied • Showing filtered results
            </span>
            <button
              onClick={handleResetFilters}
              className="font-black text-primary hover:underline uppercase tracking-wider"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)]" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface-container-lowest rounded-2xl border border-outline/30 text-on-surface-dim opacity-50">
          <ShieldCheck className="w-12 h-12 mb-3 text-primary opacity-40" />
          <p className="text-sm font-black uppercase tracking-widest">No activity log entries found</p>
          <p className="text-[10px] mt-1 uppercase tracking-widest">
            {hasActiveFilters ? 'Try broadening your search or reset filters' : 'Actions across the system will appear here automatically'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm">
          <table className="min-w-full divide-y divide-outline/40">
            <thead className="bg-surface-container-low/70">
              <tr>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Timestamp (Local)</th>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Personnel (Who)</th>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Module</th>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Action</th>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Target Entity</th>
                <th className="px-5 py-3.5 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Activity Description</th>
                <th className="px-5 py-3.5 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Forensics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/30 font-medium">
              {logs.map((log) => {
                const actionBadgeClass = ACTION_COLORS[log.action] || 'bg-surface-container-low text-on-surface-dim border-outline';
                const moduleTextColor = MODULE_COLORS[log.module] || 'text-on-surface';
                const dateObj = new Date(log.created_at);
                const timeString = isNaN(dateObj.getTime()) ? log.created_at : dateObj.toLocaleTimeString();
                const dateString = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString();

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-primary/[0.03] transition-colors group cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-mono text-[11px] font-bold text-on-surface leading-tight">
                        {timeString}
                      </div>
                      <div className="text-[9px] text-on-surface-dim opacity-50 uppercase font-mono">
                        {dateString}
                      </div>
                    </td>

                    {/* Personnel */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-[10px] uppercase shrink-0">
                          {log.user_name ? log.user_name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div className="text-xs font-black text-on-surface uppercase tracking-tight flex items-center gap-1.5">
                            {log.user_name}
                            {log.employee_id && (
                              <span className="text-[9px] text-on-surface-dim opacity-60 font-mono">
                                ({log.employee_id})
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest">
                            {log.user_role?.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Module */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${moduleTextColor}`}>
                        {log.module?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg border uppercase tracking-widest ${actionBadgeClass}`}>
                        {log.action?.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Target Entity */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {log.entity_label ? (
                        <div className="text-[11px] font-bold text-on-surface font-mono">
                          {log.entity_label}
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-dim opacity-30 uppercase font-mono">—</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5 max-w-md">
                      <p className="text-xs text-on-surface-dim group-hover:text-on-surface transition-colors line-clamp-2">
                        {log.description}
                      </p>
                    </td>

                    {/* Forensic Details button */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-primary/10 border border-outline hover:border-primary/20 text-on-surface-dim hover:text-primary text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
          Showing {logs.length > 0 ? page * limit + 1 : 0}–{Math.min((page + 1) * limit, totalCount)} of {totalCount} records
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4 text-on-surface" />
          </button>
          <span className="text-[10px] font-black text-on-surface uppercase tracking-widest px-3">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4 text-on-surface" />
          </button>
        </div>
      </div>

      {/* Forensic Inspection Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-surface border border-outline rounded-3xl w-full max-w-2xl shadow-premium max-h-[90vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-outline/50 flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">
                    Forensic Activity Details
                  </h3>
                  <p className="text-[9px] font-mono text-on-surface-dim opacity-50 uppercase">
                    Record ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl hover:bg-surface-container-low text-on-surface-dim hover:text-on-surface transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline/40">
                  <div className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest">Personnel</div>
                  <div className="text-xs font-black text-on-surface uppercase mt-1 truncate">{selectedLog.user_name}</div>
                  <div className="text-[9px] text-on-surface-dim opacity-50 font-mono">{selectedLog.employee_id || selectedLog.user_id}</div>
                </div>

                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline/40">
                  <div className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest">Role</div>
                  <div className="text-xs font-black text-primary uppercase mt-1 truncate">{selectedLog.user_role?.replace('_', ' ')}</div>
                </div>

                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline/40">
                  <div className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest">Module</div>
                  <div className="text-xs font-black text-on-surface uppercase mt-1 truncate">{selectedLog.module?.replace('_', ' ')}</div>
                </div>

                <div className="bg-surface-container-low p-3 rounded-2xl border border-outline/40">
                  <div className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest">Action</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-[8px] font-black rounded border uppercase ${ACTION_COLORS[selectedLog.action] || ''}`}>
                    {selectedLog.action?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Description Box */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-outline/40 space-y-1">
                <div className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest">Audit Event Summary</div>
                <div className="text-sm font-bold text-on-surface">{selectedLog.description}</div>
                {selectedLog.entity_label && (
                  <div className="text-[10px] text-primary font-mono font-bold mt-1">
                    Target Entity: {selectedLog.entity_label} ({selectedLog.entity_type || 'record'})
                  </div>
                )}
              </div>

              {/* State Snapshots (Before vs After) */}
              {(selectedLog.before_state || selectedLog.after_state) && (
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                    Forensic State Comparison
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Before */}
                    <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline/40">
                      <div className="text-[9px] font-black text-error uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Before Mutation</span>
                        <span className="text-[8px] opacity-60">{selectedLog.before_state ? 'Captured' : 'Initial State'}</span>
                      </div>
                      <pre className="text-[10px] font-mono text-on-surface-dim overflow-x-auto p-2 bg-surface-container-low rounded-xl max-h-48 custom-scrollbar">
                        {selectedLog.before_state ? JSON.stringify(selectedLog.before_state, null, 2) : 'null (New Record)'}
                      </pre>
                    </div>

                    {/* After */}
                    <div className="bg-surface-container-lowest p-3 rounded-2xl border border-outline/40">
                      <div className="text-[9px] font-black text-success uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>After Mutation</span>
                        <span className="text-[8px] opacity-60">{selectedLog.after_state ? 'Saved' : 'Purged'}</span>
                      </div>
                      <pre className="text-[10px] font-mono text-on-surface-dim overflow-x-auto p-2 bg-surface-container-low rounded-xl max-h-48 custom-scrollbar">
                        {selectedLog.after_state ? JSON.stringify(selectedLog.after_state, null, 2) : 'null (Deleted)'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Network / Session Metadata */}
              <div className="bg-surface-container-low/50 p-3 rounded-2xl border border-outline/30 space-y-1.5 text-[9px] font-mono text-on-surface-dim opacity-70">
                <div>Timestamp: <strong className="text-on-surface">{selectedLog.created_at}</strong></div>
                {selectedLog.session_id && <div>Session ID: <strong className="text-on-surface">{selectedLog.session_id}</strong></div>}
                {selectedLog.user_agent && <div className="truncate">User Agent: {selectedLog.user_agent}</div>}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-outline/50 flex justify-end bg-surface-container-low/30">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline text-[10px] font-black uppercase tracking-widest text-on-surface transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowSqlModal(false)}
        >
          <div
            className="bg-surface border border-outline rounded-3xl w-full max-w-xl shadow-premium my-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">
                Supabase SQL Migration Script
              </h3>
              <button onClick={() => setShowSqlModal(false)} className="text-on-surface-dim hover:text-on-surface">✕</button>
            </div>

            <p className="text-[10px] text-on-surface-dim">
              Paste this SQL into your Supabase Dashboard &gt; SQL Editor to create the immutable <code>system_activity_log</code> table with Row Level Security.
            </p>

            <pre className="text-[10px] font-mono p-3 bg-surface-container-low rounded-xl border border-outline/40 overflow-x-auto max-h-60 custom-scrollbar text-on-surface">
              {sqlMigrationCode}
            </pre>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlMigrationCode);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="px-4 py-2 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-premium"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
