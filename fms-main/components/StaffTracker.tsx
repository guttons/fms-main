import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, User as UserIcon, MapPin, Clock, Activity, Search, Filter, 
  Briefcase, ChevronDown, ChevronUp, LogIn, LogOut, Play, CheckCircle, 
  Coffee, Radio, X, KeyRound, ShieldAlert, Navigation, Sparkles, RefreshCw, Check,
  ExternalLink, Droplets, Fuel
} from 'lucide-react';
import { supabase } from '../supabase';
import { useOperationalData } from '../context/OperationalDataContext';
import { User, UserRole, StaffMember, FlightJob, Equipment, FlightLog } from '../types';
import { staffAuthService } from '../services/staffAuthService';
import { supabaseService } from '../services/supabaseService';
import { useStaffActivityTracker, ENABLE_REMOTE_STAFF_TRACKING } from '../hooks/useStaffActivityTracker';
import { haptic } from '../utils/haptics';

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

/**
 * Strict staff matching helper across IDs, employee IDs (RC numbers), names, and emails.
 * Avoids false partial matches (e.g. "Mohamed" matching every Maldivian staff).
 */
export const isStaffMatch = (staffMember: any, target?: string | null): boolean => {
  if (!target || !staffMember) return false;
  const t = target.trim().toLowerCase();
  const sId = (staffMember.id || '').trim().toLowerCase();
  const sEmp = (staffMember.employeeId || '').trim().toLowerCase();
  const cleanEmp = sEmp.replace(/^[a-z]-?/i, ''); // "A-6600" -> "6600"
  const cleanTarget = t.replace(/^[a-z]-?/i, '');
  const sName = (staffMember.name || '').trim().toLowerCase();
  const sEmail = (staffMember.email || '').trim().toLowerCase();

  // 1. Direct ID or Employee ID match
  if (t === sId || t === sEmp) return true;
  if (cleanEmp && cleanTarget && cleanEmp === cleanTarget) return true;

  // 2. Direct email match
  if (sEmail && t === sEmail) return true;

  // 3. Direct full name match
  if (sName && t === sName) return true;

  // 4. Tokenized name match: only if sharing at least 2 distinct significant tokens (length >= 3)
  const sTokens = sName.split(/\s+/).filter(tok => tok.length >= 3);
  const tTokens = t.split(/\s+/).filter(tok => tok.length >= 3);
  if (sTokens.length >= 2 && tTokens.length >= 2) {
    const sharedTokens = sTokens.filter(tok => tTokens.includes(tok));
    if (sharedTokens.length >= 2) return true;
  }

  return false;
};

/**
 * Validates whether a flight log occurred on today's operational date
 */
export const isTodayLog = (log: FlightLog, todayDateStr?: string): boolean => {
  if (!log) return false;
  const today = todayDateStr || new Date().toISOString().split('T')[0];
  if (log.operationalDate && log.operationalDate === today) return true;
  if (log.timestampStart && log.timestampStart.startsWith(today)) return true;
  if (log.timestampFinalEnd && log.timestampFinalEnd.startsWith(today)) return true;
  return false;
};

export const SHIFTS = ['Morning', 'Evening', 'Night'] as const;
export const ROLE_FILTERS = ['ALL', 'ITP', 'DEPOT', 'ON_JOB', 'ON_BREAK'] as const;

export const StaffTracker: React.FC<StaffTrackerProps> = ({ user }) => {
  const { staff, flightJobs, equipment, flightLogs: contextFlightLogs } = useOperationalData();
  const [remoteFlightLogs, setRemoteFlightLogs] = useState<FlightLog[]>([]);
  const [remoteStaffList, setRemoteStaffList] = useState<StaffMember[]>([]);
  const [onlinePresenceMap, setOnlinePresenceMap] = useState<Map<string, any>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ITP' | 'DEPOT' | 'ON_JOB' | 'ON_BREAK'>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedShift, setSelectedShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [currentUserStatus, setCurrentUserStatus] = useState<string>(() => {
    try {
      return localStorage.getItem('fms_staff_status_' + user.id) || 'ONLINE';
    } catch {
      return 'ONLINE';
    }
  });

  // Supervisor Password Reset Modal state
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [newTempPassword, setNewTempPassword] = useState('macl2026');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Self activity tracking
  const { 
    updateStatus, 
    startLocationTracking, 
    stopLocationTracking, 
    isTrackingLocation, 
    logActivity,
    currentLocation
  } = useStaffActivityTracker({
    user,
    isAuthenticated: true,
    skipLifecycle: true
  });

  // Access guard: Staff Tracker is visible only to ITP Managers and Admins
  const isAuthorized = user.role === UserRole.ITP_MANAGER || user.role === UserRole.ADMIN;

  // 1. Subscribe to Supabase Realtime Presence channel for instantaneous multi-device tracking
  useEffect(() => {
    const channel = supabase.channel('fms_staff_presence_monitor');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newMap = new Map<string, any>();
        Object.values(state).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((p: any) => {
              if (p.id) newMap.set(p.id, p);
              if (p.employeeId) newMap.set(p.employeeId, p);
            });
          }
        });
        setOnlinePresenceMap(newMap);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        async () => {
          try {
            const fresh = await supabaseService.getStaff(true);
            if (fresh && fresh.length > 0) setRemoteStaffList(fresh);
          } catch (e) {
            console.warn('[StaffTracker] Realtime staff update failed:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Poll Supabase staff table every 10 seconds as a reliable background fallback
  const fetchFreshStaff = useCallback(async () => {
    try {
      const fresh = await supabaseService.getStaff(true);
      if (fresh && fresh.length > 0) {
        setRemoteStaffList(fresh);
      }
    } catch (err) {
      console.warn('[StaffTracker] Remote staff poll:', err);
    }
  }, []);

  useEffect(() => {
    fetchFreshStaff();
    const interval = setInterval(fetchFreshStaff, 10000);
    return () => clearInterval(interval);
  }, [fetchFreshStaff]);

  // Fetch today's flight logs from Supabase API to ensure completed liters and flight counts are 100% accurate
  const loadTodayFlightLogs = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await supabaseService.getFlightLogs({ 
        startDate: todayStr, 
        endDate: todayStr,
        limit: 200 
      });
      if (res && res.logs && res.logs.length > 0) {
        setRemoteFlightLogs(res.logs);
      }
    } catch (err) {
      console.warn('[StaffTracker] Failed to load remote flight logs:', err);
    }
  }, []);

  useEffect(() => {
    loadTodayFlightLogs();
  }, [loadTodayFlightLogs]);

  // Combined flight logs (context + remote)
  const allFlightLogs = useMemo(() => {
    const combined = [...(contextFlightLogs || []), ...(remoteFlightLogs || [])];
    const seen = new Set<string>();
    return combined.filter(log => {
      const key = log.id || `${log.flightNumber}-${log.timestampStart || log.operationalDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [contextFlightLogs, remoteFlightLogs]);

  const isSupervisorOrAdmin = useMemo(() => {
    return [
      UserRole.ADMIN,
      UserRole.ITP_MANAGER,
      UserRole.DEPOT_MANAGER,
      UserRole.ITP_SUPERVISOR,
      UserRole.ITP_OFFICER
    ].includes(user.role);
  }, [user.role]);

  // Compute enriched staff data with real-time multi-device sync and today-only metrics
  const enrichedStaff = useMemo(() => {
    const effectiveStaff = remoteStaffList.length > 0 ? remoteStaffList : staff;
    const todayStr = new Date().toISOString().split('T')[0];

    return effectiveStaff.map((s: any) => {
      // Check active in-progress job
      const activeJob = flightJobs.find(j => 
        (j.status === 'IN_PROGRESS' || j.status === 'ASSIGNED') &&
        (isStaffMatch(s, j.assignedTo) || isStaffMatch(s, j.assignedOfficer))
      ) || null;

      // Find vehicle assigned
      let activeVehicle: Equipment | null = null;
      if (activeJob && activeJob.vehicleId) {
        activeVehicle = equipment.find(e => e.id === activeJob.vehicleId || e.name === activeJob.vehicleId) || null;
      }

      // Today's completed flight operations (STRICTLY TODAY — no mock/historical logs)
      const matchedFlightLogs = allFlightLogs.filter(log => {
        return (
          isTodayLog(log, todayStr) &&
          (
            isStaffMatch(s, log.operatorId) ||
            isStaffMatch(s, log.operatorName) ||
            isStaffMatch(s, log.officer) ||
            isStaffMatch(s, log.tacticalOperator)
          )
        );
      });

      const matchedCompletedJobs = flightJobs.filter(j => {
        return (
          j.status === 'COMPLETED' &&
          (isStaffMatch(s, j.assignedTo) || isStaffMatch(s, j.assignedOfficer))
        );
      });

      // Deduplicate completed flight numbers
      const completedFlightNumbers = new Set<string>();
      let totalVolumeLitersToday = 0;

      matchedFlightLogs.forEach(log => {
        if (log.flightNumber) completedFlightNumbers.add(log.flightNumber);
        totalVolumeLitersToday += Number(log.volume || (log as any).grossLiters || (log as any).quantity || 0);
      });

      matchedCompletedJobs.forEach(job => {
        if (job.flightNumber && !completedFlightNumbers.has(job.flightNumber)) {
          completedFlightNumbers.add(job.flightNumber);
          totalVolumeLitersToday += Number((job as any).volume || (job as any).grossLiters || (job as any).quantity || 0);
        }
      });

      const completedJobsTodayCount = completedFlightNumbers.size;

      // Real-time presence from other devices
      const presence = onlinePresenceMap.get(s.id) || (s.employeeId ? onlinePresenceMap.get(s.employeeId) : null);
      const dbStatus = s.current_status || s.currentStatus || 'OFFLINE';
      const lastActive = presence?.lastActive || s.last_active_at || s.lastActiveAt;

      let isRecentlyActive = false;
      if (lastActive) {
        const diffMs = Date.now() - new Date(lastActive).getTime();
        isRecentlyActive = diffMs < 15 * 60 * 1000; // Active within past 15 mins
      }

      // Determine live duty status accurately
      let liveStatus = 'OFFLINE';
      if (activeJob && activeJob.status === 'IN_PROGRESS') {
        liveStatus = 'ON_JOB';
      } else if (presence) {
        liveStatus = presence.status || 'ONLINE';
      } else if (s.id === user.id) {
        liveStatus = currentUserStatus;
      } else if (isRecentlyActive && ['ONLINE', 'IDLE', 'ON_BREAK'].includes(dbStatus)) {
        liveStatus = dbStatus;
      } else if (dbStatus === 'ON_JOB' && activeJob) {
        liveStatus = 'ON_JOB';
      } else {
        liveStatus = 'OFFLINE';
      }

      // Read real location (from presence, Supabase, or local state if current user)
      const loc = (s.id === user.id && currentLocation) 
        ? currentLocation 
        : presence?.location || s.current_location || s.currentLocation || null;

      // Determine time since last active
      let timeSince = '';
      if (presence) {
        timeSince = 'Active now (Live)';
      } else if (s.id === user.id) {
        timeSince = 'Active now';
      } else if (lastActive) {
        const diffMs = Date.now() - new Date(lastActive).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) timeSince = 'Active now';
        else if (diffMins < 60) timeSince = `${diffMins}m ago`;
        else timeSince = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
      } else {
        timeSince = 'Offline';
      }

      return {
        ...s,
        liveStatus,
        activeJob,
        activeVehicle,
        completedJobsTodayCount,
        totalVolumeToday: totalVolumeLitersToday,
        current_location: loc,
        timeSince
      };
    });
  }, [remoteStaffList, staff, flightJobs, equipment, allFlightLogs, onlinePresenceMap, user.id, currentLocation, currentUserStatus]);

  const filteredStaff = useMemo(() => {
    return enrichedStaff.filter((s: any) => {
      // Role & status filter
      if (roleFilter === 'ITP' && !ITP_ROLES.includes(s.role as UserRole)) return false;
      if (roleFilter === 'DEPOT' && !DEPOT_ROLES.includes(s.role as UserRole)) return false;
      if (roleFilter === 'ON_JOB' && s.liveStatus !== 'ON_JOB') return false;
      if (roleFilter === 'ON_BREAK' && s.liveStatus !== 'ON_BREAK') return false;

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = s.name.toLowerCase().includes(term);
        const matchId = (s.employeeId || '').toLowerCase().includes(term);
        const matchFlight = s.activeJob?.flightNumber?.toLowerCase().includes(term);
        const matchStand = s.activeJob?.stand?.toLowerCase().includes(term);
        const matchZone = (s.current_location?.zone || '').toLowerCase().includes(term);
        if (!matchName && !matchId && !matchFlight && !matchStand && !matchZone) return false;
      }
      return true;
    }).sort((a: any, b: any) => {
      const order: Record<string, number> = { 'ON_JOB': 1, 'ONLINE': 2, 'IDLE': 3, 'ON_BREAK': 4, 'OFFLINE': 5 };
      const aVal = order[a.liveStatus] || 99;
      const bVal = order[b.liveStatus] || 99;
      if (aVal !== bVal) return aVal - bVal;
      return a.name.localeCompare(b.name);
    });
  }, [enrichedStaff, roleFilter, searchTerm]);

  const stats = useMemo(() => {
    let onDuty = 0, onJob = 0, idle = 0, onBreak = 0, offline = 0;
    enrichedStaff.forEach((s: any) => {
      if (['ONLINE', 'ON_JOB', 'IDLE', 'ON_BREAK'].includes(s.liveStatus)) onDuty++;
      if (s.liveStatus === 'ON_JOB') onJob++;
      if (s.liveStatus === 'IDLE' || s.liveStatus === 'ONLINE') idle++;
      if (s.liveStatus === 'ON_BREAK') onBreak++;
      if (s.liveStatus === 'OFFLINE') offline++;
    });
    return { onDuty, onJob, idle, onBreak, offline };
  }, [enrichedStaff]);

  // Fetch real activity timeline for selected staff member
  useEffect(() => {
    if (selectedStaff) {
      const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const timeline: any[] = [];

          // 1. Read local activity logs if present
          try {
            const local = localStorage.getItem(`fms_staff_activity_${selectedStaff.id}`);
            if (local) {
              const parsed = JSON.parse(local);
              if (Array.isArray(parsed)) timeline.push(...parsed);
            }
          } catch (_) {}

          // 2. Query staff_activity_log from Supabase only if remote tracking is enabled
          if (ENABLE_REMOTE_STAFF_TRACKING) {
            const { data: dbLogs, error: dbError } = await supabase
              .from('staff_activity_log')
              .select('*')
              .or(`staff_id.eq.${selectedStaff.id},staff_id.eq.${selectedStaff.employeeId}`)
              .gte('created_at', todayStart.toISOString())
              .order('created_at', { ascending: false });

            if (!dbError && dbLogs && dbLogs.length > 0) {
              timeline.push(...dbLogs);
            }
          }

          // 2. Add real completed operations from today's flight logs
          const todayStr = new Date().toISOString().split('T')[0];
          const staffLogs = allFlightLogs.filter(log => 
            isTodayLog(log, todayStr) && (
              isStaffMatch(selectedStaff, log.operatorId) ||
              isStaffMatch(selectedStaff, log.operatorName) ||
              isStaffMatch(selectedStaff, log.officer) ||
              isStaffMatch(selectedStaff, log.tacticalOperator)
            )
          );

          staffLogs.forEach(log => {
            const vol = Number(log.volume || (log as any).grossLiters || 0);
            timeline.push({
              id: `log-complete-${log.id || log.flightNumber}-${log.timestampStart}`,
              activity_type: 'JOB_COMPLETE',
              activity_data: { 
                description: `Completed fueling flight ${log.flightNumber} at Stand ${log.stand || 'Apron'} • ${vol.toLocaleString()} L dispensed` 
              },
              created_at: log.timestampFinalEnd || log.timestampStart || log.operationalDate || new Date().toISOString()
            });
          });

          // 3. Add active in-progress job if currently refueling
          if (selectedStaff.activeJob) {
            timeline.push({
              id: `active-${selectedStaff.activeJob.id}`,
              activity_type: 'JOB_START',
              activity_data: { 
                description: `Commenced fueling flight ${selectedStaff.activeJob.flightNumber} at Stand ${selectedStaff.activeJob.stand || 'N/A'}` 
              },
              created_at: selectedStaff.activeJob.eta || new Date().toISOString()
            });
          }

          // 4. Add location fix if staff member shared location
          if (selectedStaff.current_location) {
            timeline.push({
              id: `loc-${selectedStaff.id}`,
              activity_type: 'LOCATION_SHARED',
              activity_data: { 
                description: `Airfield positioning active at ${selectedStaff.current_location.zone || 'Velana Airfield'} (±${selectedStaff.current_location.accuracy || 5}m)` 
              },
              created_at: selectedStaff.current_location.timestamp || new Date().toISOString()
            });
          }

          // 5. Add login event ONLY if staff member is online/on duty today, using real last active time
          const hasLogin = timeline.some(t => t.activity_type === 'LOGIN');
          if (!hasLogin && ['ONLINE', 'ON_JOB', 'ON_BREAK'].includes(selectedStaff.liveStatus)) {
            timeline.push({
              id: `login-${selectedStaff.id}`,
              activity_type: 'LOGIN',
              activity_data: { 
                description: `Signed in for shift duty (${selectedShift} Shift)` 
              },
              created_at: selectedStaff.last_active_at || selectedStaff.lastActiveAt || new Date().toISOString()
            });
          }

          // Sort chronologically descending
          timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          setActivityLogs(timeline);
        } catch (e) {
          console.warn('[StaffTracker] Activity logs fetch:', e);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      fetchLogs();
    }
  }, [selectedStaff, allFlightLogs, selectedShift]);

  const handleSelfStatusChange = async (newStatus: string) => {
    haptic('TAP');
    setCurrentUserStatus(newStatus);
    try {
      localStorage.setItem('fms_staff_status_' + user.id, newStatus);
    } catch (e) {}
    await updateStatus(newStatus);
    await logActivity('STATUS_CHANGE', { newStatus });
  };

  const handleSupervisorResetPassword = async () => {
    if (!selectedStaff || !newTempPassword) return;
    setIsResettingPassword(true);
    try {
      const res = await staffAuthService.setPassword(selectedStaff.id, newTempPassword, true);
      if (res.success) {
        setPasswordResetSuccess(true);
        haptic('SUCCESS');
        setTimeout(() => {
          setPasswordResetSuccess(false);
          setShowPasswordResetModal(false);
        }, 2000);
      }
    } catch (e) {
      console.error('Password reset failed:', e);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ON_JOB': return 'bg-blue-500';
      case 'ONLINE': return 'bg-emerald-500';
      case 'IDLE': return 'bg-emerald-500';
      case 'ON_BREAK': return 'bg-amber-500';
      case 'OFFLINE': return 'bg-slate-400 opacity-60';
      default: return 'bg-slate-400';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'LOGIN': return <LogIn className="w-3.5 h-3.5 text-emerald-500" />;
      case 'LOGOUT': return <LogOut className="w-3.5 h-3.5 text-slate-400" />;
      case 'STATUS_CHANGE': return <Radio className="w-3.5 h-3.5 text-amber-500" />;
      case 'JOB_START': return <Play className="w-3.5 h-3.5 text-blue-500" />;
      case 'JOB_COMPLETE': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case 'LOCATION_SHARED':
      case 'LOCATION_UPDATE': return <Navigation className="w-3.5 h-3.5 text-primary" />;
      default: return <Activity className="w-3.5 h-3.5 text-primary" />;
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-surface">
        <div className="w-16 h-16 rounded-3xl bg-error/10 border border-error/20 flex items-center justify-center text-error mb-4">
          <ShieldAlert className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-[900] uppercase text-on-surface tracking-tight">Access Restricted</h2>
        <p className="text-xs text-on-surface-dim mt-2 max-w-sm">
          The Individual Staff Tracker is an executive supervisory module restricted to ITP Managers and System Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface p-4 sm:p-6 md:p-8 overflow-hidden">
      
      {/* ─────────────────────────────────────────────────────────────────
          HEADER BAR
         ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-outline">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-[900] tracking-tight uppercase text-on-surface">
              INDIVIDUAL STAFF TRACKER
            </h1>
          </div>
          <p className="text-xs text-on-surface-dim font-bold uppercase tracking-wider">
            Real-time Personnel Airfield Positioning, Duty Status & Flight Dispensing Records
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Shift Selector with animated kinetic slider */}
          <div className="relative grid grid-cols-3 bg-surface-container-low p-1 rounded-2xl border border-outline w-full sm:w-[280px] h-[38px] shadow-xs">
            <div 
              className="absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform"
              style={{
                width: 'calc((100% - 8px) / 3)',
                left: '4px',
                transform: `translateX(${SHIFTS.indexOf(selectedShift) * 100}%)`
              }}
            />
            {SHIFTS.map(shift => (
              <button
                key={shift}
                type="button"
                onClick={() => { haptic('TAP'); setSelectedShift(shift); }}
                className={`relative z-10 flex items-center justify-center rounded-xl text-[11px] font-black uppercase tracking-[0.1em] transition-colors duration-300 active:scale-95 cursor-pointer select-none ${
                  selectedShift === shift 
                    ? 'text-white' 
                    : 'text-on-surface-dim opacity-70 hover:opacity-100'
                }`}
              >
                {shift}
              </button>
            ))}
          </div>
          
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-50" />
            <input 
              type="text"
              placeholder="SEARCH STAFF, FLIGHT, STAND, ZONE..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-outline rounded-xl pl-9 pr-4 py-2 text-xs uppercase tracking-wider focus:border-primary outline-none transition-colors placeholder:text-on-surface-dim/40"
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MY DUTY STATUS WIDGET (Self-Tracking for Logged-In User)
         ───────────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-outline rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface ${currentUserStatus === 'ON_BREAK' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-on-surface uppercase">{user.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase tracking-wider">
                  You ({user.role.replace(/_/g, ' ')})
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Shift: {selectedShift}</span>
                <span>•</span>
                <span>Status: <strong className={currentUserStatus === 'ON_BREAK' ? "text-amber-500 uppercase" : "text-emerald-500 uppercase"}>
                  {currentUserStatus === 'ON_BREAK' ? 'On Break' : 'On Duty'}
                </strong></span>
                {currentLocation?.zone && (
                  <>
                    <span>•</span>
                    <span className="text-primary font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary" /> {currentLocation.zone}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick status actions with clear active distinguishability */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSelfStatusChange('ONLINE')}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                currentUserStatus !== 'ON_BREAK'
                  ? 'bg-emerald-500 text-white shadow-md ring-2 ring-emerald-400/40 hover:bg-emerald-600'
                  : 'bg-surface-container-high/40 hover:bg-surface-container text-on-surface-dim hover:text-on-surface border border-outline font-bold'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${currentUserStatus !== 'ON_BREAK' ? 'bg-white animate-pulse' : 'bg-emerald-500/50'}`}></div>
              Available
            </button>
            <button
              type="button"
              onClick={() => handleSelfStatusChange('ON_BREAK')}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                currentUserStatus === 'ON_BREAK'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400/40 hover:bg-amber-400'
                  : 'bg-surface-container-high/40 hover:bg-surface-container text-on-surface-dim hover:text-on-surface border border-outline font-bold'
              }`}
            >
              <Coffee className={`w-3.5 h-3.5 ${currentUserStatus === 'ON_BREAK' ? 'text-slate-950' : 'opacity-60'}`} />
              Break
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('TAP');
                if (isTrackingLocation) stopLocationTracking();
                else startLocationTracking();
              }}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 ${
                isTrackingLocation 
                  ? 'kinetic-gradient text-white shadow-premium' 
                  : 'bg-surface-container-high/40 text-on-surface-dim hover:text-on-surface border border-outline hover:bg-surface-container font-bold'
              }`}
            >
              <Navigation className={`w-3.5 h-3.5 ${isTrackingLocation ? 'animate-spin' : ''}`} />
              {isTrackingLocation ? 'GPS Tracking Active' : 'Enable GPS'}
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          STATS BAR & ROLE FILTERS
         ───────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-5">
        <div className="flex gap-2 p-2 bg-surface/60 backdrop-blur-md rounded-2xl border border-outline overflow-x-auto custom-scrollbar">
          <div className="px-4 py-1.5 flex flex-col items-center justify-center border-r border-outline flex-shrink-0">
            <span className="text-xl font-black text-on-surface">{stats.onDuty}</span>
            <span className="text-[9px] text-on-surface-dim uppercase tracking-wider">On Duty</span>
          </div>
          <div className="px-4 py-1.5 flex flex-col items-center justify-center border-r border-outline flex-shrink-0">
            <span className="text-xl font-black text-blue-500">{stats.onJob}</span>
            <span className="text-[9px] text-on-surface-dim uppercase tracking-wider">On Flight Job</span>
          </div>
          <div className="px-4 py-1.5 flex flex-col items-center justify-center border-r border-outline flex-shrink-0">
            <span className="text-xl font-black text-emerald-500">{stats.idle}</span>
            <span className="text-[9px] text-on-surface-dim uppercase tracking-wider">Idle / Avail</span>
          </div>
          <div className="px-4 py-1.5 flex flex-col items-center justify-center border-r border-outline flex-shrink-0">
            <span className="text-xl font-black text-amber-500">{stats.onBreak}</span>
            <span className="text-[9px] text-on-surface-dim uppercase tracking-wider">On Break</span>
          </div>
          <div className="px-4 py-1.5 flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-xl font-black text-slate-400">{stats.offline}</span>
            <span className="text-[9px] text-on-surface-dim uppercase tracking-wider">Offline</span>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <Filter className="w-3.5 h-3.5 text-on-surface-dim flex-shrink-0" />
          <div className="relative grid grid-cols-5 bg-surface-container-low p-1 rounded-2xl border border-outline flex-shrink-0 min-w-[350px] sm:min-w-[420px] h-[38px] shadow-xs">
            <div 
              className="absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform"
              style={{
                width: 'calc((100% - 8px) / 5)',
                left: '4px',
                transform: `translateX(${ROLE_FILTERS.indexOf(roleFilter) * 100}%)`
              }}
            />
            {ROLE_FILTERS.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => { haptic('TAP'); setRoleFilter(role); }}
                className={`relative z-10 flex items-center justify-center px-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors duration-300 cursor-pointer select-none active:scale-95 ${
                  roleFilter === role 
                    ? 'text-white' 
                    : 'text-on-surface-dim opacity-70 hover:opacity-100'
                }`}
              >
                {role.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          STAFF GRID
         ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar pb-24">
        {filteredStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-dim border border-dashed border-outline rounded-3xl p-6">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="uppercase tracking-widest text-xs font-bold">No staff matching current filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredStaff.map((s: any) => (
              <div 
                key={s.id}
                onClick={() => { haptic('TAP'); setSelectedStaff(s); }}
                className={`group cursor-pointer relative bg-surface border border-outline rounded-2xl p-4 shadow-sm hover:border-primary/50 hover:shadow-md transition-all ${
                  s.liveStatus === 'ON_JOB' ? 'border-blue-500/40' : ''
                }`}
              >
                {s.liveStatus === 'ON_JOB' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-2xl"></div>
                )}

                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.name} className="w-11 h-11 rounded-xl border border-outline object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20">
                          {s.employeeId ? s.employeeId.replace('A-', '') : 'ST'}
                        </div>
                      )}
                      
                      {/* Status Indicator Dot */}
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface ${getStatusColor(s.liveStatus)} ${
                        ['ONLINE', 'ON_JOB'].includes(s.liveStatus) ? 'animate-pulse' : ''
                      }`}></div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black uppercase tracking-wider text-xs text-on-surface truncate group-hover:text-primary transition-colors">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-on-surface-dim font-mono">{s.employeeId}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-dim border border-outline uppercase font-bold text-on-surface-dim">
                          {s.role.replace('ITP_', '').replace('DEPOT_', '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Specific Content */}
                <div className="mt-2 space-y-2">
                  {s.liveStatus === 'ON_JOB' && s.activeJob ? (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2.5">
                      <div className="flex items-center justify-between text-blue-500 mb-1">
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                          <Radio className="w-3 h-3 animate-pulse" /> Current Flight
                        </span>
                        <span className="text-[9px] font-mono font-bold">{s.activeJob.stand || 'Stand ?'}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <div className="text-xs font-black tracking-wider text-on-surface">{s.activeJob.flightNumber}</div>
                        <div className="text-[10px] font-bold text-blue-500">{s.activeVehicle?.name || 'Hydrant Dispenser'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                      <span className={s.liveStatus === 'OFFLINE' ? 'text-red-400' : s.liveStatus === 'ON_BREAK' ? 'text-amber-500' : 'text-emerald-500'}>
                        {s.liveStatus.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-on-surface-dim font-normal">
                        {s.completedJobsTodayCount > 0 
                          ? `${s.completedJobsTodayCount} flights • ${s.totalVolumeToday.toLocaleString()} L` 
                          : 'No flights today'}
                      </span>
                    </div>
                  )}

                  {/* Location Chip if available */}
                  {s.current_location?.zone && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md w-fit max-w-full">
                      <MapPin className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{s.current_location.zone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-[9px] text-on-surface-dim pt-2 border-t border-outline">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.timeSince || 'Offline'}</span>
                    <span className="text-primary font-bold group-hover:underline">Track Dossier →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          INDIVIDUAL STAFF DOSSIER & TRACKING INSPECTOR MODAL
         ───────────────────────────────────────────────────────────────── */}
      {selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedStaff(null)}>
          <div className="bg-surface border border-outline rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="p-5 border-b border-outline bg-surface-dim/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedStaff.avatar ? (
                    <img src={selectedStaff.avatar} alt="" className="w-12 h-12 rounded-2xl border border-outline object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20">
                      {selectedStaff.employeeId?.replace('A-', '') || 'ST'}
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface ${getStatusColor(selectedStaff.liveStatus)}`}></div>
                </div>
                <div>
                  <h3 className="font-black text-base uppercase text-on-surface tracking-tight leading-tight">
                    {selectedStaff.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-on-surface-dim font-mono">{selectedStaff.employeeId}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-surface border border-outline uppercase font-bold text-on-surface-dim">
                      {selectedStaff.role.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setSelectedStaff(null)}
                className="w-8 h-8 rounded-full bg-surface-dim border border-outline flex items-center justify-center text-on-surface-dim hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              
              {/* Live Duty & Assignment Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-dim rounded-2xl border border-outline">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider block mb-1">
                    Live Duty Status
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(selectedStaff.liveStatus)}`}></div>
                    <span className="text-xs font-black text-on-surface uppercase">
                      {selectedStaff.liveStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[9px] text-on-surface-dim block mt-1">
                    {selectedStaff.timeSince || 'Offline'}
                  </span>
                </div>

                <div className="p-3 bg-surface-dim rounded-2xl border border-outline">
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider block mb-1">
                    Shift Activity Today
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-on-surface">{selectedStaff.completedJobsTodayCount}</span>
                    <span className="text-[10px] text-on-surface-dim font-bold">flights completed</span>
                  </div>
                  <span className="text-[9px] text-primary font-mono font-bold block mt-0.5">
                    {selectedStaff.totalVolumeToday.toLocaleString()} LITRES dispensed
                  </span>
                </div>
              </div>

              {/* Airfield Positioning Section */}
              {selectedStaff.current_location ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <div className="flex items-center justify-between text-emerald-500 text-[10px] font-black uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 animate-pulse" /> Live Airfield Location
                    </span>
                    <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[8.5px]">GPS Active</span>
                  </div>
                  <p className="text-xs font-black text-on-surface uppercase mb-1">
                    {selectedStaff.current_location.zone || 'Velana Airfield'}
                  </p>
                  <div className="flex items-center justify-between text-[9px] text-on-surface-dim font-mono">
                    <span>
                      {selectedStaff.current_location.lat?.toFixed(4)}, {selectedStaff.current_location.lng?.toFixed(4)}
                    </span>
                    <span>Accuracy: ±{selectedStaff.current_location.accuracy || 5}m</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-surface-dim/40 border border-dashed border-outline rounded-2xl text-center text-[10px] font-bold text-on-surface-dim opacity-60">
                  Airfield location not shared by staff member yet
                </div>
              )}

              {/* Current Active Assignment */}
              {selectedStaff.activeJob ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl">
                  <div className="flex items-center justify-between text-blue-500 text-[10px] font-black uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 animate-pulse" /> Active Refueling Job</span>
                    <span>Status: {selectedStaff.activeJob.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] text-on-surface-dim block uppercase">Flight</span>
                      <span className="font-black text-on-surface">{selectedStaff.activeJob.flightNumber}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-dim block uppercase">Stand / Bay</span>
                      <span className="font-black text-on-surface">{selectedStaff.activeJob.stand || 'Stand ?'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-dim block uppercase">Aircraft Reg</span>
                      <span className="font-mono font-bold text-on-surface">{selectedStaff.activeJob.aircraftReg || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-on-surface-dim block uppercase">Vehicle Assigned</span>
                      <span className="font-bold text-blue-500">{selectedStaff.activeVehicle?.name || selectedStaff.activeJob.vehicleId || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-surface-dim/60 border border-dashed border-outline rounded-2xl text-center text-xs text-on-surface-dim">
                  Currently available — no active flight refueling assignment
                </div>
              )}

              {/* Supervisor Actions: Password Reset & Controls */}
              {isSupervisorOrAdmin && (
                <div className="p-4 bg-surface-dim border border-outline rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Supervisor Controls
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => { setShowPasswordResetModal(true); setPasswordResetSuccess(false); }}
                      className="flex-1 py-3 px-4 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-premium hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset Password
                    </button>
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Today's Activity Timeline
                </h4>

                {isLoadingLogs ? (
                  <div className="py-8 flex justify-center">
                    <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="p-6 text-center bg-surface-dim/50 rounded-2xl border border-dashed border-outline">
                    <Clock className="w-6 h-6 text-on-surface-dim opacity-30 mx-auto mb-2" />
                    <p className="text-xs font-bold text-on-surface-dim uppercase tracking-wider">
                      No operations recorded for today's shift
                    </p>
                    <p className="text-[10px] text-on-surface-dim opacity-50 mt-1">
                      Staff member has not performed any flight fuelings or logged in yet.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l border-outline ml-3 pl-5 space-y-4">
                    {activityLogs.map((log, idx) => (
                      <div key={log.id || idx} className="relative">
                        <div className="absolute -left-[27px] w-5 h-5 rounded-full bg-surface border border-outline flex items-center justify-center shadow-xs">
                          {getLogIcon(log.activity_type)}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                              {log.activity_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[9px] font-mono text-on-surface-dim">
                              {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-dim mt-0.5">
                            {log.activity_data?.description || JSON.stringify(log.activity_data || {})}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-outline bg-surface-dim/20 flex justify-end">
              <button
                onClick={() => setSelectedStaff(null)}
                className="py-2.5 px-6 rounded-xl kinetic-gradient text-white text-xs font-black uppercase tracking-wider shadow-premium hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          SUPERVISOR PASSWORD RESET MODAL
         ───────────────────────────────────────────────────────────────── */}
      {showPasswordResetModal && selectedStaff && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-outline rounded-[28px] w-full max-w-sm p-6 shadow-2xl relative">
            <h3 className="text-sm font-[900] text-on-surface uppercase tracking-wider mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> Reset Password
            </h3>
            <p className="text-[11px] text-on-surface-dim mb-4">
              Set a temporary password for <strong className="text-on-surface">{selectedStaff.name}</strong> ({selectedStaff.employeeId}). They will be required to change it on their next sign-in.
            </p>

            {passwordResetSuccess ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-bold flex items-center gap-2 mb-4">
                <Check className="w-4 h-4" /> Password reset successfully!
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-on-surface-dim block mb-1">
                    Temporary Password
                  </label>
                  <input 
                    type="text"
                    value={newTempPassword}
                    onChange={e => setNewTempPassword(e.target.value)}
                    className="w-full bg-surface-dim border border-outline rounded-xl px-3 py-2 text-xs font-mono tracking-wider focus:border-primary outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowPasswordResetModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container border border-outline text-[10px] font-black uppercase text-on-surface-dim hover:text-on-surface hover:scale-95 active:scale-90 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSupervisorResetPassword}
                    disabled={isResettingPassword || !newTempPassword}
                    className="flex-1 py-2.5 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-wider shadow-premium hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isResettingPassword ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
