import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, User as UserIcon, MapPin, Clock, Activity, Search, Filter, 
  Briefcase, ChevronDown, ChevronUp, LogIn, LogOut, Play, CheckCircle, 
  Coffee, Radio, X
} from 'lucide-react';
import { supabase } from '../supabase';
import { useOperationalData } from '../context/OperationalDataContext';
import { User, UserRole, StaffMember, FlightJob, Equipment } from '../types';

interface StaffTrackerProps {
  user: User;
}

const ITP_ROLES = [
  UserRole.ITP_OPERATOR,
  UserRole.ITP_OFFICER,
  UserRole.ITP_HD_OPERATOR,
  UserRole.ITP_SUPERVISOR,
  UserRole.ITP_MANAGER
];

const DEPOT_ROLES = [
  UserRole.DEPOT_OPERATOR,
  UserRole.DEPOT_MANAGER
];

export const StaffTracker: React.FC<StaffTrackerProps> = ({ user }) => {
  const { staff, flightJobs, equipment } = useOperationalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ITP' | 'DEPOT' | 'ALL'>('ITP');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedShift, setSelectedShift] = useState('Morning');

  // Compute status for each staff member based on their `current_status` field (which might be in `staff` if schema allows, or we infer from jobs)
  // Wait, the hook adds `current_status`, `last_active_at`, `current_job_id`, `current_vehicle_id` to the `staff` table.
  // In `StaffMember` type in `types.ts`, these might not be defined explicitly, so we type cast or use `any`.

  const enrichedStaff = useMemo(() => {
    return staff.map((s: any) => {
      // Find active job if status is ON_JOB
      let activeJob = null;
      let activeVehicle = null;

      if (s.current_job_id) {
        activeJob = flightJobs.find(j => j.id === s.current_job_id);
      }
      if (s.current_vehicle_id) {
        activeVehicle = equipment.find(e => e.id === s.current_vehicle_id);
      }

      // Determine time since last active
      let timeSince = '';
      if (s.last_active_at) {
        const diffMs = Date.now() - new Date(s.last_active_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) timeSince = 'Just now';
        else if (diffMins < 60) timeSince = `${diffMins}m ago`;
        else timeSince = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
      }

      return {
        ...s,
        liveStatus: s.current_status || 'OFFLINE',
        activeJob,
        activeVehicle,
        timeSince
      };
    });
  }, [staff, flightJobs, equipment]);

  const filteredStaff = useMemo(() => {
    return enrichedStaff.filter((s: any) => {
      // Role filter
      if (roleFilter === 'ITP' && !ITP_ROLES.includes(s.role as UserRole)) return false;
      if (roleFilter === 'DEPOT' && !DEPOT_ROLES.includes(s.role as UserRole)) return false;

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!s.name.toLowerCase().includes(term) && !s.employeeId?.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    }).sort((a: any, b: any) => {
      const order = { 'ON_JOB': 1, 'ONLINE': 2, 'IDLE': 3, 'ON_BREAK': 4, 'OFFLINE': 5 };
      const aVal = (order as any)[a.liveStatus] || 99;
      const bVal = (order as any)[b.liveStatus] || 99;
      if (aVal !== bVal) return aVal - bVal;
      return a.name.localeCompare(b.name);
    });
  }, [enrichedStaff, roleFilter, searchTerm]);

  const stats = useMemo(() => {
    let onDuty = 0, onJob = 0, idle = 0, offline = 0;
    filteredStaff.forEach((s: any) => {
      if (['ONLINE', 'ON_JOB', 'IDLE', 'ON_BREAK'].includes(s.liveStatus)) onDuty++;
      if (s.liveStatus === 'ON_JOB') onJob++;
      if (s.liveStatus === 'IDLE' || s.liveStatus === 'ONLINE') idle++;
      if (s.liveStatus === 'OFFLINE') offline++;
    });
    return { onDuty, onJob, idle, offline };
  }, [filteredStaff]);

  useEffect(() => {
    if (selectedStaff) {
      const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const { data, error } = await supabase
            .from('staff_activity_log')
            .select('*')
            .eq('staff_id', selectedStaff.id)
            .gte('created_at', todayStart.toISOString())
            .order('created_at', { ascending: false });
            
          if (!error && data) {
            setActivityLogs(data);
          }
        } catch (e) {
          console.warn('[StaffTracker] Failed to fetch activity logs', e);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      fetchLogs();
    }
  }, [selectedStaff]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ONLINE': return 'bg-emerald-500';
      case 'ON_JOB': return 'bg-blue-500';
      case 'IDLE': return 'bg-amber-500';
      case 'ON_BREAK': return 'bg-white/80';
      case 'OFFLINE': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getLogIcon = (type: string) => {
    switch(type) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-emerald-400" />;
      case 'LOGOUT': return <LogOut className="w-4 h-4 text-red-400" />;
      case 'JOB_START': return <Play className="w-4 h-4 text-blue-400" />;
      case 'JOB_COMPLETE': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'STATUS_CHANGE': return <Coffee className="w-4 h-4 text-amber-400" />;
      case 'LOCATION_UPDATE': return <MapPin className="w-4 h-4 text-slate-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-lowest text-on-surface p-4 pb-24 overflow-hidden relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">STAFF TRACKER</h1>
            <p className="text-xs text-on-surface-dim uppercase tracking-widest">Real-time personnel monitoring</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Shift Selector */}
          <div className="flex bg-surface-dim p-1 rounded-xl border border-outline">
            {['Morning', 'Evening', 'Night'].map(shift => (
              <button
                key={shift}
                onClick={() => setSelectedShift(shift)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  selectedShift === shift 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
              >
                {shift}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim" />
            <input 
              type="text"
              placeholder="SEARCH STAFF..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-outline rounded-xl pl-9 pr-4 py-2 text-sm uppercase tracking-wider focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Stats Bar & Filters */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="flex gap-2 p-2 bg-surface/50 backdrop-blur-md rounded-2xl border border-outline">
          <div className="px-4 py-2 flex flex-col items-center justify-center border-r border-outline/50">
            <span className="text-2xl font-black">{stats.onDuty}</span>
            <span className="text-[10px] text-on-surface-dim uppercase tracking-widest">On Duty</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-center justify-center border-r border-outline/50">
            <span className="text-2xl font-black text-blue-400">{stats.onJob}</span>
            <span className="text-[10px] text-on-surface-dim uppercase tracking-widest">On Job</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-center justify-center border-r border-outline/50">
            <span className="text-2xl font-black text-amber-400">{stats.idle}</span>
            <span className="text-[10px] text-on-surface-dim uppercase tracking-widest">Idle</span>
          </div>
          <div className="px-4 py-2 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-red-400/80">{stats.offline}</span>
            <span className="text-[10px] text-on-surface-dim uppercase tracking-widest">Offline</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-on-surface-dim" />
          <div className="flex bg-surface-dim p-1 rounded-xl border border-outline">
            {(['ALL', 'ITP', 'DEPOT'] as const).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  roleFilter === role 
                    ? 'bg-surface text-on-surface shadow-sm border border-outline' 
                    : 'text-on-surface-dim hover:text-on-surface border border-transparent'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar pb-32">
        {filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-dim">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p className="uppercase tracking-widest font-bold">No staff found matching criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStaff.map((s: any) => (
              <div 
                key={s.id}
                onClick={() => setSelectedStaff(s)}
                className={`group cursor-pointer relative bg-surface border border-outline rounded-2xl p-4 shadow-premium hover:border-primary/50 transition-all ${
                  s.liveStatus === 'ON_JOB' ? 'overflow-hidden' : ''
                }`}
              >
                {/* Kinetic border for ON_JOB */}
                {s.liveStatus === 'ON_JOB' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 via-indigo-500 to-blue-400 animate-pulse-slow"></div>
                )}

                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.name} className="w-12 h-12 rounded-full border border-outline object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-surface-dim flex items-center justify-center border border-outline">
                          <UserIcon className="w-6 h-6 text-on-surface-dim" />
                        </div>
                      )}
                      
                      {/* Status Dot */}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface ${getStatusColor(s.liveStatus)} ${
                        ['ONLINE', 'ON_JOB'].includes(s.liveStatus) ? 'animate-pulse' : ''
                      }`}></div>
                    </div>
                    <div>
                      <h3 className="font-bold uppercase tracking-wider text-sm">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-on-surface-dim font-mono">{s.employeeId}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-dim border border-outline/50 uppercase font-bold text-on-surface-dim">
                          {s.role.replace('ITP_', '').replace('DEPOT_', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Specific Content */}
                <div className="mt-3 space-y-2">
                  {s.liveStatus === 'ON_JOB' && s.activeJob ? (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5">
                      <div className="flex items-center gap-2 text-blue-400 mb-1">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Active Task</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-sm font-black tracking-wider text-on-surface">{s.activeJob.flightNumber}</div>
                        <div className="text-xs font-bold text-blue-400">{s.activeVehicle?.name || 'V-?'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className={s.liveStatus === 'OFFLINE' ? 'text-red-400/80' : s.liveStatus === 'ON_BREAK' ? 'text-on-surface-dim' : 'text-emerald-400'}>
                        {s.liveStatus}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-[10px] text-on-surface-dim pt-1 border-t border-outline/30">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.timeSince || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Timeline Slide-up Panel */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-surface border-t border-outline shadow-[0_-10px_40px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-in-out ${
          selectedStaff ? 'translate-y-0' : 'translate-y-full'
        } z-20`}
        style={{ height: '50vh', maxHeight: '400px' }}
      >
        {selectedStaff && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline bg-surface/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-outline overflow-hidden flex-shrink-0">
                  {selectedStaff.avatar ? (
                    <img src={selectedStaff.avatar} alt={selectedStaff.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-surface-dim flex items-center justify-center"><UserIcon className="w-5 h-5 text-on-surface-dim" /></div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold uppercase tracking-wider">{selectedStaff.name}</h3>
                  <p className="text-[10px] text-on-surface-dim tracking-widest">{selectedStaff.employeeId} • Today's Activity</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaff(null)}
                className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center hover:bg-surface-dim/80 text-on-surface-dim transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-dim opacity-50">
                  <Activity className="w-8 h-8 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No activity recorded today</p>
                </div>
              ) : (
                <div className="relative border-l border-outline/50 ml-4 pl-6 pb-4 space-y-6">
                  {activityLogs.map((log: any, idx: number) => {
                    const timeStr = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={log.id || idx} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[31px] w-6 h-6 rounded-full bg-surface border border-outline flex items-center justify-center z-10 shadow-sm">
                          {getLogIcon(log.activity_type)}
                        </div>
                        
                        <div className="flex flex-col gap-0.5 pt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                              {log.activity_type.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-on-surface-dim font-mono">{timeStr}</span>
                          </div>
                          <span className="text-sm text-on-surface-dim">
                            {log.activity_data?.description || `Recorded ${log.activity_type.toLowerCase()} event`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Backdrop for panel */}
      {selectedStaff && (
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 transition-opacity"
          onClick={() => setSelectedStaff(null)}
        />
      )}
    </div>
  );
};
