import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  Truck, 
  Plane, 
  Clock, 
  ClipboardList, 
  MessageSquare, 
  Save, 
  Shield, 
  Plus,
  Trash2,
  Droplet,
  ChevronRight,
  User as UserIcon,
  Zap,
  Activity,
  AlertTriangle,
  UserCheck,
  Calendar,
  X,
  Snowflake,
  PlaneLanding,
  PlaneTakeoff,
  Check,
  XCircle,
  ArrowRightCircle,
  Lock,
  Ban,
  Play,
  CheckCircle,
  Table,
  LayoutGrid,
  Layers,
  Fuel,
  Package,
  ArrowUpDown,
  Sliders
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { MOCK_USERS, EQUIPMENT } from '../constants';
import { User, UserRole, EquipmentType, EquipmentStatus, isDomesticFlight } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useOperationalData, BriefingShift } from '../context/OperationalDataContext';
import { AddAdhocFlightModal, AdhocFlightData } from './AddAdhocFlightModal';
import { haptic } from '../utils/haptics';
import {
  fetchStaffAssignmentHistory,
  runAutoAssignDomestic,
  runAutoAssignDaily,
  runAutoAssignDiesel,
  runAutoAssignJetTransfer,
  runAutoAssignStock,
  sortDomesticCandidates,
  sortDailyCandidates,
  sortDieselCandidates,
  sortJetTransferCandidates,
  sortStockCandidates,
  StaffAssignmentHistory,
  DomesticTeamAssignment,
  isStaffEligible
} from '../services/assignmentEngine';

const STAFF_STATUS_PRESETS = [
  { id: 'SL', label: 'SL', color: 'bg-amber-500/10 text-amber-500 border border-amber-500/30' },
  { id: 'FRL', label: 'FRL', color: 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/30' },
  { id: 'UNFIT', label: 'UNFIT', color: 'bg-red-500/10 text-red-500 border border-red-500/30' },
  { id: 'EXTRA', label: 'EXTRA', color: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' },
  { id: 'OFF', label: 'OFF', color: 'bg-slate-500/10 text-slate-400 border border-slate-500/30' },
  { id: 'CLASS', label: 'CLASS', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-400/40' },
  { id: 'TRAIN', label: 'TRAIN', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' },
  { id: 'AB', label: 'AB', color: 'bg-rose-500/10 text-rose-500 border border-rose-500/30' },
  { id: 'LATE', label: 'LATE', color: 'bg-orange-500/10 text-orange-500 border border-orange-500/30' }
];

interface ShiftBriefingProps {
  user?: any;
  isSidebarCollapsed?: boolean;
}

export const ShiftBriefing: React.FC<ShiftBriefingProps> = ({ user, isSidebarCollapsed }) => {
  const { notify } = useNotification();
  const { 
    equipment, 
    briefingInfo, 
    updateBriefingInfo, 
    selectedBriefingShift, 
    setSelectedBriefingShift, 
    staff,
    selectedBriefingDate,
    setSelectedBriefingDate,
    flightJobs,
    domesticFlights,
    domesticAssignments,
    updateDomesticAssignment
  } = useOperationalData();
  const activeStaff = staff && staff.length > 0 ? staff : MOCK_USERS;
  const todayStr = new Date().toISOString().split('T')[0];
  const isHistoricalView = selectedBriefingDate < todayStr;

  const [historyMap, setHistoryMap] = useState<Map<string, StaffAssignmentHistory>>(new Map());

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      const allStaffIds = activeStaff.map(s => s.id);
      const map = await fetchStaffAssignmentHistory(allStaffIds);
      if (isMounted) {
        setHistoryMap(map);
      }
    };
    loadHistory();
    return () => { isMounted = false; };
  }, [activeStaff, selectedBriefingDate]);

  const getRankInRoles = (staffId: string, roles: UserRole[], type: 'DOM' | 'DAILY' | 'DIESEL' | 'JET' | 'STOCK') => {
    const compatibleStaffIds = activeStaff
      .filter(u => roles.includes(u.role))
      .map(u => u.id);

    if (type === 'DOM') {
      const sorted = sortDomesticCandidates(compatibleStaffIds, historyMap);
      const rankIdx = sorted.findIndex(id => id === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    } else if (type === 'DAILY') {
      const sorted = sortDailyCandidates(compatibleStaffIds, historyMap);
      const rankIdx = sorted.findIndex(id => id === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    } else if (type === 'DIESEL') {
      const sorted = sortDieselCandidates(compatibleStaffIds, historyMap);
      const rankIdx = sorted.findIndex(id => id === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    } else if (type === 'STOCK') {
      const sorted = sortStockCandidates(compatibleStaffIds, historyMap);
      const rankIdx = sorted.findIndex(id => id === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    } else {
      const sorted = sortJetTransferCandidates(compatibleStaffIds, historyMap);
      const rankIdx = sorted.findIndex(id => id === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    }
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

  const getIntlFlightTimeLabel = (flight: any) => {
    const parts: string[] = [];
    // Show STA, but if ETA differs from STA then show ETA only
    if (flight.sta || flight.eta) {
      if (flight.eta && flight.sta && flight.eta !== flight.sta) {
        parts.push(`ETA: ${flight.eta}`);
      } else if (flight.sta) {
        parts.push(`STA: ${flight.sta}`);
      }
    }
    if (flight.std) {
      parts.push(`STD: ${flight.std}`);
    }
    return parts.join(' • ');
  };

  const getDomesticFlightTimeLabel = (flight: any) => {
    if (flight.std) return `DEP: ${flight.std}`;
    return '';
  };

  const getBriefingStatusStyle = (status?: string) => {
    if (!status) return 'bg-surface border border-outline text-on-surface-dim';
    const s = status.toUpperCase();
    if (s === 'COMPLETED') {
      return 'bg-success/10 text-success border border-success/10';
    }
    if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
      return 'bg-amber-500/10 text-amber-500 animate-pulse-subtle border border-amber-500/10';
    }
    if (s.includes('DELAY')) {
      return 'bg-amber-500/10 text-amber-500 border border-amber-500/10';
    }
    if (s.includes('CANCEL') || s.includes('CNL')) {
      return 'bg-error/10 text-error border border-error/10';
    }
    if (s.includes('LANDED') || s.includes('DEPARTED') || s.includes('ARRIV')) {
      return 'bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20';
    }
    if (s.includes('BOARDING') || s.includes('GATE') || s.includes('FINAL') || s.includes('CLOSED')) {
      return 'bg-warning/10 text-warning border border-warning/10';
    }
    return 'bg-surface border border-outline text-on-surface-dim';
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

  const intlFlightsToRender = frozenFlights?.intl 
    ? (() => {
        const frozenMap = new Map<string, any>();
        frozenFlights.intl.filter((ff: any) => !isDomesticFlight(ff) && !isAdhocFlight(ff)).forEach((ff: any) => {
          const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          frozenMap.set(cleanNo, ff);
        });
        (flightJobs || []).filter(j => !isDomesticFlight(j) && !isAdhocFlight(j) && (!j.date || j.date.split('T')[0] === selectedBriefingDate)).forEach((j: any) => {
          const cleanNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          if (!frozenMap.has(cleanNo)) {
            frozenMap.set(cleanNo, j);
          } else {
            const existing = frozenMap.get(cleanNo);
            frozenMap.set(cleanNo, { ...existing, ...j, status: j.status || existing.status });
          }
        });
        return Array.from(frozenMap.values()).filter((f: any) => {
          const isDep = f.type ? f.type === 'departure' : !!f.std;
          return !isDomesticFlight(f) && !isAdhocFlight(f) && isDep && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate) && (isHistoricalView || (f.status !== 'COMPLETED' && f.status?.toUpperCase() !== 'CANCELLED'));
        }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
      })()
    : (flightJobs || []).filter(f => {
        const isDep = f.type ? f.type === 'departure' : !!f.std;
        return !isDomesticFlight(f) && !isAdhocFlight(f) && isDep && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate) && (isHistoricalView || (f.status !== 'COMPLETED' && f.status?.toUpperCase() !== 'CANCELLED'));
      }).sort((a, b) => (a.std || '').localeCompare(b.std || ''));

  const domesticFlightsToRender = frozenFlights?.domestic 
    ? (() => {
        const frozenMap = new Map<string, any>();
        frozenFlights.domestic.forEach((ff: any) => {
          const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          frozenMap.set(cleanNo, ff);
        });
        (domesticFlights || []).forEach((j: any) => {
          const cleanNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          if (!frozenMap.has(cleanNo)) {
            frozenMap.set(cleanNo, j);
          } else {
            const existing = frozenMap.get(cleanNo);
            frozenMap.set(cleanNo, { ...existing, status: j.status || existing.status });
          }
        });
        // Merge active domestic jobs from flightJobs
        (flightJobs || []).filter(j => isDomesticFlight(j) && (!j.date || j.date.split('T')[0] === selectedBriefingDate)).forEach((j: any) => {
          const cleanNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          const existing = frozenMap.get(cleanNo);
          if (existing) {
            frozenMap.set(cleanNo, { ...existing, ...j, status: j.status || existing.status });
          }
        });
        return Array.from(frozenMap.values()).filter((f: any) => {
          return f.type === 'departure' && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate) && (isHistoricalView || (f.status !== 'COMPLETED' && f.status?.toUpperCase() !== 'CANCELLED'));
        }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));
      })()
    : (domesticFlights || []).map(f => {
        const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const liveJob = (flightJobs || []).find(j => {
          if (!j || !j.flightNumber) return false;
          const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
          if (jNo !== cleanNo) return false;
          const jDate = j.date ? j.date.split('T')[0] : '';
          return !jDate || jDate === selectedBriefingDate;
        });
        return liveJob ? { ...f, ...liveJob, status: liveJob.status || f.status } : f;
      }).filter(f => {
        return f.type === 'departure' && isFlightInShift(f.std) && (!f.date || f.date.split('T')[0] === selectedBriefingDate) && (isHistoricalView || (f.status !== 'COMPLETED' && f.status?.toUpperCase() !== 'CANCELLED'));
      }).sort((a, b) => (a.std || '').localeCompare(b.std || ''));

  const adhocFlightsToRender = (briefingInfo?.staffAssignments?.adhocFlights || [])
    .filter((f: any) => f && f.id !== 'ah1' && f.id !== 'ah2')
    .map((f: any) => {
      const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
      const liveJob = (flightJobs || []).find(j => {
        if (!j || !j.flightNumber) return false;
        const jNo = (j.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        if (jNo !== cleanNo) return false;
        const jDate = j.date ? j.date.split('T')[0] : '';
        return !jDate || jDate === selectedBriefingDate;
      });
      return liveJob ? { ...f, ...liveJob, status: liveJob.status || f.status } : f;
    });

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[2];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[monthIndex] || '';
    return `${day}-${month}`;
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isUnfreezeConfirmOpen, setIsUnfreezeConfirmOpen] = useState(false);
  
  // Collapse states for Flight cards
  const [isIntlCollapsed, setIsIntlCollapsed] = useState(true);
  const [isDomesticCollapsed, setIsDomesticCollapsed] = useState(true);
  const [isAdhocCollapsed, setIsAdhocCollapsed] = useState(true);

  // Collapse states for other cards
  const [isOperatorsCollapsed, setIsOperatorsCollapsed] = useState(false);
  const [isOfficersCollapsed, setIsOfficersCollapsed] = useState(false);
  const [isHydrantCollapsed, setIsHydrantCollapsed] = useState(false);
  const [isStaffingCollapsed, setIsStaffingCollapsed] = useState(false);
  const [isFleetCollapsed, setIsFleetCollapsed] = useState(false);
  const [isAttendanceCollapsed, setIsAttendanceCollapsed] = useState(false);

  // Add Ad-Hoc Flight modal state
  const [isAddAdhocModalOpen, setIsAddAdhocModalOpen] = useState(false);

  const userRoleStr = (user?.role || '').toUpperCase();
  const isItpStaffRole = [
    UserRole.ITP_OFFICER,
    UserRole.ITP_OPERATOR,
    UserRole.ITP_SUPERVISOR,
    UserRole.ITP_HD_OPERATOR,
    'ITP_OFFICER',
    'ITP_OPERATOR',
    'ITP_SUPERVISOR',
    'ITP_HD_OPERATOR'
  ].includes(userRoleStr as any);

  const isManagerOrAdmin = [UserRole.ITP_MANAGER, UserRole.ADMIN, 'ITP_MANAGER', 'ADMIN'].includes(userRoleStr);
  const canEdit = isManagerOrAdmin && !isItpStaffRole && !isHistoricalView;
  const canDelete = canEdit;
  const isViewOnly = !canEdit;

  const formattedBriefingDate = new Date(selectedBriefingDate + 'T00:00:00').toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });
  const [currentTime] = useState(new Date().toLocaleTimeString('en-GB', { 
    hour: '2-digit', minute: '2-digit' 
  }));

  // Local state for editing, initialized from context
  const [additionalInfo, setAdditionalInfo] = useState(briefingInfo?.info || []);
  const [dieselNeeds, setDieselNeeds] = useState<string[]>(briefingInfo?.dieselNeeds || []);
  const [dailyCompleted, setDailyCompleted] = useState<string[]>(briefingInfo?.staffAssignments?.dailyCompleted || []);
  interface StaffAssignments {
    activeOperators: string[];
    activeOfficers: string[];
    hydrantOpsOfficers: string[];
    dutySupervisor?: string;
    shiftInCharge?: string;
    dutySupervisors?: string[];
    shiftInCharges?: string[];
    attendees?: string[];
    dailyCompleted?: string[];
    frozenFlights?: {
      intl?: any[];
      domestic?: any[];
      adhoc?: any[];
    } | null;
    adhocFlights?: any[];
    staffStatuses?: Record<string, string>;
    domesticTeams?: DomesticTeamAssignment[];
    equipmentAssignments?: Record<string, { op1: string; op2: string }>;
    dieselAssignments?: Record<string, { op1: string; op2: string }>;
    stockAssignment?: { staffId: string };
    jetTransfer?: { op1: string; op2: string; enabled: boolean };
  }

  const getInitialStaffAssignments = (): StaffAssignments => {
    const s = briefingInfo?.staffAssignments;
    if (!s) {
      return {
        activeOperators: [],
        activeOfficers: [],
        hydrantOpsOfficers: [],
        dutySupervisors: [],
        shiftInCharges: []
      };
    }
    
    const dutySupervisors = s.dutySupervisors 
      ? s.dutySupervisors 
      : s.dutySupervisor 
        ? [s.dutySupervisor] 
        : [];
        
    const shiftInCharges = s.shiftInCharges 
      ? s.shiftInCharges 
      : s.shiftInCharge 
        ? [s.shiftInCharge] 
        : [];

    return {
      ...s,
      dutySupervisors,
      shiftInCharges
    };
  };

  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>(getInitialStaffAssignments());

  const [attendees, setAttendees] = useState<string[]>(briefingInfo?.staffAssignments?.attendees || []);
  const [staffStatuses, setStaffStatuses] = useState<Record<string, string>>(briefingInfo?.staffAssignments?.staffStatuses || {});
  const [activeDropdownStaffId, setActiveDropdownStaffId] = useState<string | null>(null);

  const getDefaultDomesticTeams = () => {
    const defaultCount = selectedBriefingShift === 'Night' ? 1 : selectedBriefingShift === 'Evening' ? 2 : 3;
    return [
      { id: 't1', name: 'Team 1', op1: '', op2: '' },
      { id: 't2', name: 'Team 2', op1: '', op2: '' },
      { id: 't3', name: 'Team 3', op1: '', op2: '' }
    ].slice(0, defaultCount);
  };

  const [domesticTeams, setDomesticTeams] = useState<DomesticTeamAssignment[]>(
    briefingInfo?.staffAssignments?.domesticTeams || getDefaultDomesticTeams()
  );
  const [equipmentAssignments, setEquipmentAssignments] = useState<Record<string, { op1: string; op2: string }>>(
    briefingInfo?.staffAssignments?.equipmentAssignments || {}
  );
  const [dieselAssignments, setDieselAssignments] = useState<Record<string, { op1: string; op2: string }>>(
    briefingInfo?.staffAssignments?.dieselAssignments || {}
  );
  const [stockAssignment, setStockAssignment] = useState<{ staffId: string }>(
    briefingInfo?.staffAssignments?.stockAssignment || { staffId: '' }
  );
  const [nightCarriedDailyAssignments, setNightCarriedDailyAssignments] = useState<Record<string, { op1: string; op2: string }>>({});
  const [jetTransfer, setJetTransfer] = useState<{ op1: string; op2: string; enabled: boolean }>(
    briefingInfo?.staffAssignments?.jetTransfer || { op1: '', op2: '', enabled: false }
  );
  const [isAutoAssigningDomestic, setIsAutoAssigningDomestic] = useState(false);
  const [isAutoAssigningFleet, setIsAutoAssigningFleet] = useState(false);
  const [isAutoAssigningJetTransfer, setIsAutoAssigningJetTransfer] = useState(false);
  const [isAutoAssigningStock, setIsAutoAssigningStock] = useState(false);
  const [assignmentTableTab, setAssignmentTableTab] = useState<'domestic' | 'jet' | 'daily' | 'diesel' | 'stock' | 'all'>('domestic');
  const [assignmentViewMode, setAssignmentViewMode] = useState<'table' | 'card'>('table');

  // Close dropdown on outside click
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveDropdownStaffId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const uniqueStaff = Array.from(new Set([
    ...staffAssignments.activeOperators,
    ...staffAssignments.activeOfficers,
    ...staffAssignments.hydrantOpsOfficers,
    ...(staffAssignments.dutySupervisors || []),
    ...(staffAssignments.shiftInCharges || [])
  ].filter(Boolean)));

  const presentCount = uniqueStaff.filter(id => attendees.includes(id)).length;

  const itpUniqueStaff = uniqueStaff.filter(id => {
    const user = activeStaff.find(u => u.id === id);
    return user && user.role.startsWith('ITP_');
  });

  const itpPresentCount = itpUniqueStaff.filter(id => attendees.includes(id)).length;

  // Sync local state when context changes (e.g., on load or shift switch)
  useEffect(() => {
    if (briefingInfo) {
      setAdditionalInfo(briefingInfo.info || []);
      setDieselNeeds(briefingInfo.dieselNeeds || []);
      if (briefingInfo.staffAssignments) {
        const s = briefingInfo.staffAssignments;
        const dutySupervisors = s.dutySupervisors 
          ? s.dutySupervisors 
          : s.dutySupervisor 
            ? [s.dutySupervisor] 
            : [];
            
        const shiftInCharges = s.shiftInCharges 
          ? s.shiftInCharges 
          : s.shiftInCharge 
            ? [s.shiftInCharge] 
            : [];

        const normalized: StaffAssignments = {
          ...s,
          dutySupervisors,
          shiftInCharges
        };

        setStaffAssignments(prev => {
          if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
          return normalized;
        });
        setAttendees(prev => {
          const next = s.attendees || [];
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setDailyCompleted(prev => {
          const next = s.dailyCompleted || [];
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        setStaffStatuses(prev => {
          const next = s.staffStatuses || {};
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });

        const defaultTeams = getDefaultDomesticTeams();
        const baseTeams = (s.domesticTeams && Array.isArray(s.domesticTeams) && s.domesticTeams.length > 0)
          ? s.domesticTeams
          : defaultTeams;

        const mergedTeams = baseTeams.map(team => {
          const dbTeam = (domesticAssignments || []).find(d => d.team_name === team.name);
          return {
            ...team,
            op1: dbTeam?.operator1_id !== undefined ? (dbTeam.operator1_id || dbTeam.op1 || '') : team.op1,
            op2: dbTeam?.operator2_id !== undefined ? (dbTeam.operator2_id || dbTeam.op2 || '') : team.op2,
          };
        });
        setDomesticTeams(mergedTeams);

        if (s.equipmentAssignments && typeof s.equipmentAssignments === 'object') {
          setEquipmentAssignments(s.equipmentAssignments);
        } else {
          setEquipmentAssignments({});
        }

        if (s.dieselAssignments && typeof s.dieselAssignments === 'object') {
          setDieselAssignments(s.dieselAssignments);
        } else {
          setDieselAssignments({});
        }

        if (s.stockAssignment) {
          setStockAssignment(s.stockAssignment);
        } else {
          setStockAssignment({ staffId: '' });
        }

        if (s.jetTransfer) {
          setJetTransfer(s.jetTransfer);
        } else {
          setJetTransfer({ op1: '', op2: '', enabled: false });
        }
      } else {
        setStaffAssignments(prev => {
          const empty = { activeOperators: [], activeOfficers: [], hydrantOpsOfficers: [], dutySupervisors: [], shiftInCharges: [] };
          return JSON.stringify(prev) === JSON.stringify(empty) ? prev : empty;
        });
        setAttendees([]);
        setDailyCompleted([]);
        setStaffStatuses({});

        const fallback = getDefaultDomesticTeams().map(team => {
          const dbTeam = (domesticAssignments || []).find(d => d.team_name === team.name);
          return dbTeam ? { ...team, op1: dbTeam.operator1_id || dbTeam.op1 || '', op2: dbTeam.operator2_id || dbTeam.op2 || '' } : team;
        });
        setDomesticTeams(fallback);
        setEquipmentAssignments({});
        setDieselAssignments({});
        setStockAssignment({ staffId: '' });
        setJetTransfer({ op1: '', op2: '', enabled: false });
      }
    }
  }, [briefingInfo, domesticAssignments, selectedBriefingShift]);

  // Effect to sync equipment assignments from DB (equipment_assignments table)
  useEffect(() => {
    let isMounted = true;
    const loadDbEquipmentAssignments = async () => {
      try {
        const isEvening = selectedBriefingShift === 'Evening';
        const shiftType = isEvening ? 'DIESEL' : 'DAILY';
        const dbAssignments = await supabaseService.getEquipmentAssignments(selectedBriefingDate, shiftType);
        if (isMounted && dbAssignments && dbAssignments.length > 0) {
          const map: Record<string, { op1: string; op2: string }> = {};
          dbAssignments.forEach(d => {
            if (d.operator1_id || d.operator2_id) {
              map[d.equipment_id] = { op1: d.operator1_id || '', op2: d.operator2_id || '' };
            }
          });
          if (Object.keys(map).length > 0) {
            if (isEvening) {
              setDieselAssignments(prev => {
                const next = { ...prev };
                Object.entries(map).forEach(([k, v]) => {
                  if (v.op1 || v.op2) next[k] = v;
                });
                return next;
              });
            } else {
              setEquipmentAssignments(prev => {
                const next = { ...prev };
                Object.entries(map).forEach(([k, v]) => {
                  if (v.op1 || v.op2) next[k] = v;
                });
                return next;
              });
            }
          }
        }
      } catch (err) {
        console.warn('[ShiftBriefing] Error loading equipment assignments from DB:', err);
      }
    };
    loadDbEquipmentAssignments();
    return () => { isMounted = false; };
  }, [selectedBriefingShift, selectedBriefingDate]);

  // Effect to carry forward Night shift's DAILY inspection assignments and completion to Morning shift
  useEffect(() => {
    if (selectedBriefingShift === 'Morning') {
      let isMounted = true;
      (async () => {
        try {
          // Check today's night shift and previous day's night shift
          const nightBriefing = await supabaseService.getShiftBriefingInfo(selectedBriefingDate, 'Night');
          const nightEq = nightBriefing?.staffAssignments?.equipmentAssignments;
          const nightCompleted = nightBriefing?.staffAssignments?.dailyCompleted;

          const curDate = new Date(selectedBriefingDate + 'T00:00:00');
          curDate.setDate(curDate.getDate() - 1);
          const prevDateStr = curDate.toISOString().split('T')[0];
          const prevNight = await supabaseService.getShiftBriefingInfo(prevDateStr, 'Night');
          const prevNightEq = prevNight?.staffAssignments?.equipmentAssignments;
          const prevNightCompleted = prevNight?.staffAssignments?.dailyCompleted;

          const combinedNightEq: Record<string, { op1: string; op2: string }> = {};
          if (prevNightEq) {
            Object.entries(prevNightEq).forEach(([k, v]) => {
              const val = v as { op1?: string; op2?: string } | null | undefined;
              if (val && (val.op1 || val.op2)) {
                combinedNightEq[k] = { op1: val.op1 || '', op2: val.op2 || '' };
              }
            });
          }
          if (nightEq) {
            Object.entries(nightEq).forEach(([k, v]) => {
              const val = v as { op1?: string; op2?: string } | null | undefined;
              if (val && (val.op1 || val.op2)) {
                combinedNightEq[k] = { op1: val.op1 || '', op2: val.op2 || '' };
              }
            });
          }

          if (isMounted && Object.keys(combinedNightEq).length > 0) {
            setNightCarriedDailyAssignments(combinedNightEq);
            setEquipmentAssignments(prev => {
              const merged = { ...prev };
              Object.entries(combinedNightEq).forEach(([k, v]) => {
                if (v.op1 || v.op2) {
                  merged[k] = v;
                }
              });
              return merged;
            });

            // Mark all equipment assigned in night shift as COMPLETED in morning shift
            const nightEqIds = Object.keys(combinedNightEq);
            const allCompleted = Array.from(new Set([
              ...(nightCompleted || []),
              ...(prevNightCompleted || []),
              ...nightEqIds
            ]));
            setDailyCompleted(prev => Array.from(new Set([...prev, ...allCompleted])));
          }
        } catch (err) {
          console.warn('[ShiftBriefing] Error combining Night shift DAILY assignments:', err);
        }
      })();
      return () => { isMounted = false; };
    } else {
      setNightCarriedDailyAssignments({});
    }
  }, [selectedBriefingShift, selectedBriefingDate]);

  // Tab validation per shift
  useEffect(() => {
    const allowed = selectedBriefingShift === 'Night'
      ? ['domestic', 'daily', 'stock', 'all']
      : selectedBriefingShift === 'Evening'
      ? ['domestic', 'diesel', 'jet', 'all']
      : ['domestic', 'daily', 'all'];

    if (!allowed.includes(assignmentTableTab)) {
      setAssignmentTableTab('domestic');
    }
  }, [selectedBriefingShift, assignmentTableTab]);

  const handleStaffAssignmentsUpdate = (updater: (prev: StaffAssignments) => StaffAssignments) => {
    const updated = updater(staffAssignments);
    setStaffAssignments(updated);
    updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...updated,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      frozenFlights: briefingInfo?.staffAssignments?.frozenFlights || null,
      adhocFlights: briefingInfo?.staffAssignments?.adhocFlights || []
    });
  };



  const [remarks, setRemarks] = useState('Safety first. Ensure all grounding cables are checked before each operation.');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // If already frozen, keep those flights. If unfrozen (null or undefined), freeze the current live flights.
      const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
      const frozenToSave = existingFrozen ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: []
      };
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams,
        equipmentAssignments,
        frozenFlights: frozenToSave,
        adhocFlights: adhocFlightsToRender
      });
      notify('Shift briefing saved successfully!', 'success');
    } catch (error) {
      console.error("Failed to save shift briefing:", error);
      notify('Failed to save shift briefing.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetFlights = () => {
    setIsUnfreezeConfirmOpen(true);
  };

  const confirmResetFlights = async () => {
    setIsUnfreezeConfirmOpen(false);
    setIsSaving(true);
    try {
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams,
        equipmentAssignments,
        frozenFlights: null
      });
      notify('Flights successfully reset to live feed!', 'success');
    } catch (error) {
      console.error("Failed to reset flights:", error);
      notify('Failed to reset flights.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFlightFromBriefing = async (category: 'intl' | 'domestic' | 'adhoc', jobId: string) => {
    const currentIntl = intlFlightsToRender;
    const currentDomestic = domesticFlightsToRender;
    const currentAdhoc = adhocFlightsToRender;

    const updatedIntl = category === 'intl' ? currentIntl.filter((f: any) => f.id !== jobId) : currentIntl;
    const updatedDomestic = category === 'domestic' ? currentDomestic.filter((f: any) => f.id !== jobId) : currentDomestic;
    const updatedAdhoc = category === 'adhoc' ? currentAdhoc.filter((f: any) => f.id !== jobId) : currentAdhoc;

    setIsSaving(true);
    try {
      // If it is a real database flight job, delete it from the database so it won't reappear on unfreeze/refresh
      const isDbJob = (flightJobs || []).some(j => j.id === jobId && !j.isVirtual);
      if (isDbJob) {
        try {
          await supabaseService.deleteFlightJob(jobId);
          console.log(`Deleted database flight job: ${jobId}`);
        } catch (dbErr) {
          console.warn(`Could not delete database flight job: ${jobId}`, dbErr);
        }
      }

      if (category === 'adhoc') {
        await updateBriefingInfo(additionalInfo, dieselNeeds, {
          ...staffAssignments,
          attendees,
          staffStatuses,
          dailyCompleted,
          domesticTeams,
          equipmentAssignments,
          adhocFlights: updatedAdhoc
        });
      } else {
        await updateBriefingInfo(additionalInfo, dieselNeeds, {
          ...staffAssignments,
          attendees,
          staffStatuses,
          dailyCompleted,
          domesticTeams,
          equipmentAssignments,
          frozenFlights: {
            intl: updatedIntl,
            domestic: updatedDomestic,
            adhoc: []
          }
        });
      }
      notify('Flight removed from briefing.', 'success');
    } catch (error) {
      console.error("Failed to delete flight from briefing:", error);
      notify('Failed to delete flight from briefing.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAdhocFlight = async (flightData: AdhocFlightData) => {
    const newAdhoc = {
      id: `ah-custom-${Date.now()}`,
      flightNumber: flightData.flightNumber,
      std: flightData.std,
      sta: '---',
      route: flightData.destination,
      destination: flightData.destination,
      stand: '---',
      status: 'PENDING',
      isAdhoc: true,
      aircraftReg: flightData.aircraftReg,
      aircraftType: flightData.aircraftType,
      co: flightData.co,
      operatorName: flightData.operatorName,
      date: selectedBriefingDate
    };

    const updatedAdhoc = [...adhocFlightsToRender, newAdhoc];

    setIsSaving(true);
    try {
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams,
        equipmentAssignments,
        adhocFlights: updatedAdhoc
      });
      notify('Ad-hoc flight added successfully!', 'success');
      setIsAddAdhocModalOpen(false);
    } catch (err) {
      console.error('Failed to add ad-hoc flight:', err);
      notify('Failed to add ad-hoc flight.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const rfHdEquipment = (equipment || []).filter(eq => 
    eq && (eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER)
  );

  const handleAutoAssignDomestic = async () => {
    if (isHistoricalView || !canEdit) return;
    setIsAutoAssigningDomestic(true);
    try {
      const targetTeamNames = domesticTeams.map(t => t.name);
      const newTeams = runAutoAssignDomestic({
        activeOperators: staffAssignments.activeOperators || [],
        activeOfficers: staffAssignments.activeOfficers || [],
        staffStatuses,
        attendees,
        historyMap,
        targetTeamNames
      });

      setDomesticTeams(newTeams);

      const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams: newTeams,
        equipmentAssignments,
        jetTransfer,
        frozenFlights: existingFrozen !== undefined ? existingFrozen : {
          intl: intlFlightsToRender,
          domestic: domesticFlightsToRender,
          adhoc: adhocFlightsToRender
        }
      });

      for (const t of newTeams) {
        await updateDomesticAssignment(t.name, t.op1, t.op2);
      }

      notify('Domestic teams auto-assigned successfully based on fair rotation!', 'success');
    } catch (err) {
      console.error('Auto-assign domestic failed:', err);
      notify('Failed to auto-assign domestic teams.', 'error');
    } finally {
      setIsAutoAssigningDomestic(false);
    }
  };

  const handleAddOptionalDomesticTeam = async () => {
    if (isHistoricalView || !canEdit) return;
    let nextTeamName = '';
    let nextTeamId = '';
    if (selectedBriefingShift === 'Evening') {
      if (domesticTeams.some(t => t.name === 'Team 3')) return;
      nextTeamName = 'Team 3';
      nextTeamId = 't3';
    } else if (selectedBriefingShift === 'Night') {
      if (domesticTeams.some(t => t.name === 'Team 2')) return;
      nextTeamName = 'Team 2';
      nextTeamId = 't2';
    } else {
      if (domesticTeams.length >= 3) return;
      const nextNum = domesticTeams.length + 1;
      nextTeamName = `Team ${nextNum}`;
      nextTeamId = `t${nextNum}`;
    }

    const updated = [...domesticTeams, { id: nextTeamId, name: nextTeamName, op1: '', op2: '' }];
    setDomesticTeams(updated);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams: updated,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
    notify(`${nextTeamName} added to Domestic Squadron!`, 'success');
  };

  const handleRemoveOptionalDomesticTeam = async (teamName: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = domesticTeams.filter(t => t.name !== teamName);
    setDomesticTeams(updated);
    await updateDomesticAssignment(teamName, '', '');

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams: updated,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
    notify(`${teamName} removed from Domestic Squadron.`, 'info');
  };

  const handleAutoAssignJetTransfer = async () => {
    if (isHistoricalView || !canEdit) return;
    setIsAutoAssigningJetTransfer(true);
    try {
      const domesticAssignees = new Set<string>();
      domesticTeams.forEach(t => {
        if (t.op1) domesticAssignees.add(t.op1);
        if (t.op2) domesticAssignees.add(t.op2);
      });

      const assigned = runAutoAssignJetTransfer({
        activeOperators: staffAssignments.activeOperators || [],
        activeOfficers: staffAssignments.activeOfficers || [],
        domesticAssignees,
        staffStatuses,
        attendees,
        historyMap
      });

      const updatedJet = {
        op1: assigned.op1,
        op2: assigned.op2,
        enabled: true
      };
      setJetTransfer(updatedJet);

      const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams,
        equipmentAssignments,
        jetTransfer: updatedJet,
        frozenFlights: existingFrozen !== undefined ? existingFrozen : {
          intl: intlFlightsToRender,
          domestic: domesticFlightsToRender,
          adhoc: adhocFlightsToRender
        }
      });

      notify('Jet Transfer personnel auto-assigned successfully based on fair rotation!', 'success');
    } catch (err) {
      console.error('Jet Transfer auto-assignment failed:', err);
      notify('Failed to auto-assign Jet Transfer.', 'error');
    } finally {
      setIsAutoAssigningJetTransfer(false);
    }
  };

  const handleJetTransferAssignmentChange = async (roleSlot: 'op1' | 'op2', staffId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = {
      ...jetTransfer,
      [roleSlot]: staffId,
      enabled: true
    };
    setJetTransfer(updated);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      jetTransfer: updated,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleToggleJetTransferEnabled = async () => {
    if (isHistoricalView || !canEdit) return;
    const updated = {
      ...jetTransfer,
      enabled: !jetTransfer.enabled
    };
    setJetTransfer(updated);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      jetTransfer: updated,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleDomesticAssignmentChange = async (teamId: string, roleSlot: 'op1' | 'op2', staffId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = domesticTeams.map(t => {
      if (t.id === teamId) {
        return { ...t, [roleSlot]: staffId };
      }
      return t;
    });

    setDomesticTeams(updated);

    const changedTeam = updated.find(t => t.id === teamId);
    if (changedTeam) {
      await updateDomesticAssignment(changedTeam.name, changedTeam.op1, changedTeam.op2);
    }

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams: updated,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleClearDomesticTeam = async (teamId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = domesticTeams.map(t => t.id === teamId ? { ...t, op1: '', op2: '' } : t);
    setDomesticTeams(updated);

    const team = domesticTeams.find(t => t.id === teamId);
    if (team) {
      await updateDomesticAssignment(team.name, '', '');
    }

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams: updated,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleClearAllDomestic = async () => {
    if (isHistoricalView || !canEdit) return;
    const updated = domesticTeams.map(t => ({ ...t, op1: '', op2: '' }));
    setDomesticTeams(updated);

    for (const t of domesticTeams) {
      await updateDomesticAssignment(t.name, '', '');
    }

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams: updated,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
    notify('All domestic team assignments cleared.', 'info');
  };

  const handleClearJetTransfer = async () => {
    if (isHistoricalView || !canEdit) return;
    const updated = { ...jetTransfer, op1: '', op2: '' };
    setJetTransfer(updated);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      jetTransfer: updated,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
    notify('Jet Transfer assignments cleared.', 'info');
  };

  const handleToggleDailyCompleted = async (eqId: string) => {
    if (isHistoricalView || !canEdit) return;
    const newDailyCompleted = dailyCompleted.includes(eqId)
      ? dailyCompleted.filter(id => id !== eqId)
      : [...dailyCompleted, eqId];

    setDailyCompleted(newDailyCompleted);
    const existingFrozenDaily = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted: newDailyCompleted,
      domesticTeams,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozenDaily !== undefined ? existingFrozenDaily : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleToggleDieselNeed = async (eqId: string) => {
    if (isHistoricalView || !canEdit) return;
    const newDieselNeeds = dieselNeeds.includes(eqId)
      ? dieselNeeds.filter(id => id !== eqId)
      : [...dieselNeeds, eqId];

    setDieselNeeds(newDieselNeeds);
    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, newDieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleClearDailyAssignment = async (eqId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = { ...equipmentAssignments };
    delete updated[eqId];
    setEquipmentAssignments(updated);

    await supabaseService.upsertEquipmentAssignment(
      selectedBriefingDate,
      eqId,
      'DAILY',
      '',
      ''
    );

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments: updated,
      dieselAssignments,
      stockAssignment,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleClearDieselAssignment = async (eqId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = { ...dieselAssignments };
    delete updated[eqId];
    setDieselAssignments(updated);

    await supabaseService.upsertEquipmentAssignment(
      selectedBriefingDate,
      eqId,
      'DIESEL',
      '',
      ''
    );

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      dieselAssignments: updated,
      stockAssignment,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleAutoAssignFleet = async (targetType?: 'DAILY' | 'DIESEL') => {
    if (isHistoricalView || !canEdit) return;
    setIsAutoAssigningFleet(true);
    try {
      const domesticAssignees = new Set<string>();
      domesticTeams.forEach(t => {
        if (t.op1) domesticAssignees.add(t.op1);
        if (t.op2) domesticAssignees.add(t.op2);
      });
      if (jetTransfer.enabled) {
        if (jetTransfer.op1) domesticAssignees.add(jetTransfer.op1);
        if (jetTransfer.op2) domesticAssignees.add(jetTransfer.op2);
      }
      if (stockAssignment.staffId) {
        domesticAssignees.add(stockAssignment.staffId);
      }

      const shiftType = targetType || (selectedBriefingShift === 'Evening' ? 'DIESEL' : 'DAILY');

      if (shiftType === 'DIESEL') {
        const updatedDiesel = runAutoAssignDiesel({
          equipment: rfHdEquipment,
          dieselNeeds,
          activeOperators: staffAssignments.activeOperators || [],
          activeOfficers: staffAssignments.activeOfficers || [],
          hydrantOpsOfficers: staffAssignments.hydrantOpsOfficers || [],
          domesticAssignees,
          staffStatuses,
          attendees,
          historyMap
        });

        setDieselAssignments(updatedDiesel);

        for (const [eqId, val] of Object.entries(updatedDiesel)) {
          await supabaseService.upsertEquipmentAssignment(
            selectedBriefingDate,
            eqId,
            'DIESEL',
            val.op1 || '',
            val.op2 || ''
          );
        }

        const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
        await updateBriefingInfo(additionalInfo, dieselNeeds, {
          ...staffAssignments,
          attendees,
          staffStatuses,
          dailyCompleted,
          domesticTeams,
          equipmentAssignments,
          dieselAssignments: updatedDiesel,
          stockAssignment,
          jetTransfer,
          frozenFlights: existingFrozen !== undefined ? existingFrozen : {
            intl: intlFlightsToRender,
            domestic: domesticFlightsToRender,
            adhoc: adhocFlightsToRender
          }
        });

        notify('Evening shift diesel operators auto-assigned successfully!', 'success');
      } else {
        // Daily auto-assign: preserve night carried forward assignments if in morning shift
        const existingToPreserve = selectedBriefingShift === 'Morning'
          ? { ...nightCarriedDailyAssignments, ...equipmentAssignments }
          : undefined;

        const updatedDaily = runAutoAssignDaily({
          equipment: rfHdEquipment,
          activeOperators: staffAssignments.activeOperators || [],
          activeOfficers: staffAssignments.activeOfficers || [],
          hydrantOpsOfficers: staffAssignments.hydrantOpsOfficers || [],
          domesticAssignees,
          staffStatuses,
          attendees,
          historyMap,
          existingAssignments: existingToPreserve
        });

        setEquipmentAssignments(updatedDaily);

        for (const [eqId, val] of Object.entries(updatedDaily)) {
          await supabaseService.upsertEquipmentAssignment(
            selectedBriefingDate,
            eqId,
            'DAILY',
            val.op1 || '',
            val.op2 || ''
          );
        }

        const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
        await updateBriefingInfo(additionalInfo, dieselNeeds, {
          ...staffAssignments,
          attendees,
          staffStatuses,
          dailyCompleted,
          domesticTeams,
          equipmentAssignments: updatedDaily,
          dieselAssignments,
          stockAssignment,
          jetTransfer,
          frozenFlights: existingFrozen !== undefined ? existingFrozen : {
            intl: intlFlightsToRender,
            domestic: domesticFlightsToRender,
            adhoc: adhocFlightsToRender
          }
        });

        notify('Equipment daily check inspectors auto-assigned successfully!', 'success');
      }
    } catch (err) {
      console.error('Fleet auto-assignment failed:', err);
      notify('Failed to auto-assign fleet equipment.', 'error');
    } finally {
      setIsAutoAssigningFleet(false);
    }
  };

  const handleDailyAssignmentChange = async (eqId: string, roleSlot: 'op1' | 'op2', staffId: string) => {
    if (isHistoricalView || !canEdit) return;
    const current = equipmentAssignments[eqId] || { op1: '', op2: '' };
    const updatedSlot = { ...current, [roleSlot]: staffId };
    const updated = {
      ...equipmentAssignments,
      [eqId]: updatedSlot
    };
    setEquipmentAssignments(updated);

    await supabaseService.upsertEquipmentAssignment(
      selectedBriefingDate,
      eqId,
      'DAILY',
      updatedSlot.op1 || '',
      updatedSlot.op2 || ''
    );

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments: updated,
      dieselAssignments,
      stockAssignment,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleDieselAssignmentChange = async (eqId: string, staffId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updated = {
      ...dieselAssignments,
      [eqId]: { op1: staffId, op2: '' }
    };
    setDieselAssignments(updated);

    await supabaseService.upsertEquipmentAssignment(
      selectedBriefingDate,
      eqId,
      'DIESEL',
      staffId,
      ''
    );

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      dieselAssignments: updated,
      stockAssignment,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleEquipmentAssignmentChange = async (eqId: string, roleSlot: 'op1' | 'op2', staffId: string, type?: 'DAILY' | 'DIESEL') => {
    if (type === 'DIESEL' || (type === undefined && selectedBriefingShift === 'Evening')) {
      await handleDieselAssignmentChange(eqId, staffId);
    } else {
      await handleDailyAssignmentChange(eqId, roleSlot, staffId);
    }
  };

  const handleClearEquipmentAssignment = async (eqId: string) => {
    if (selectedBriefingShift === 'Evening') {
      await handleClearDieselAssignment(eqId);
    } else {
      await handleClearDailyAssignment(eqId);
    }
  };

  const handleAutoAssignStock = async () => {
    if (isHistoricalView || !canEdit) return;
    setIsAutoAssigningStock(true);
    try {
      const domesticAssignees = new Set<string>();
      domesticTeams.forEach(t => {
        if (t.op1) domesticAssignees.add(t.op1);
        if (t.op2) domesticAssignees.add(t.op2);
      });

      const assignedStaffId = runAutoAssignStock({
        activeOfficers: staffAssignments.activeOfficers || [],
        hydrantOpsOfficers: staffAssignments.hydrantOpsOfficers || [],
        domesticAssignees,
        staffStatuses,
        attendees,
        historyMap
      });

      const updatedStock = { staffId: assignedStaffId };
      setStockAssignment(updatedStock);

      const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        staffStatuses,
        dailyCompleted,
        domesticTeams,
        equipmentAssignments,
        dieselAssignments,
        stockAssignment: updatedStock,
        jetTransfer,
        frozenFlights: existingFrozen !== undefined ? existingFrozen : {
          intl: intlFlightsToRender,
          domestic: domesticFlightsToRender,
          adhoc: adhocFlightsToRender
        }
      });

      if (assignedStaffId) {
        notify('Stock duty officer auto-assigned successfully!', 'success');
      } else {
        notify('No eligible officers available for stock duty.', 'info');
      }
    } catch (err) {
      console.error('Stock auto-assignment failed:', err);
      notify('Failed to auto-assign stock duty.', 'error');
    } finally {
      setIsAutoAssigningStock(false);
    }
  };

  const handleStockAssignmentChange = async (staffId: string) => {
    if (isHistoricalView || !canEdit) return;
    const updatedStock = { staffId };
    setStockAssignment(updatedStock);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      dieselAssignments,
      stockAssignment: updatedStock,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const handleClearStockAssignment = async () => {
    if (isHistoricalView || !canEdit) return;
    const updatedStock = { staffId: '' };
    setStockAssignment(updatedStock);

    const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
    await updateBriefingInfo(additionalInfo, dieselNeeds, {
      ...staffAssignments,
      attendees,
      staffStatuses,
      dailyCompleted,
      domesticTeams,
      equipmentAssignments,
      dieselAssignments,
      stockAssignment: updatedStock,
      jetTransfer,
      frozenFlights: existingFrozen !== undefined ? existingFrozen : {
        intl: intlFlightsToRender,
        domestic: domesticFlightsToRender,
        adhoc: adhocFlightsToRender
      }
    });
  };

  const renderOptionalTeamButton = () => {
    if (isHistoricalView || !canEdit) return null;
    if (selectedBriefingShift === 'Evening') {
      if (domesticTeams.some(t => t.name === 'Team 3')) {
        return (
          <button
            onClick={() => handleRemoveOptionalDomesticTeam('Team 3')}
            className="px-3 py-1.5 bg-error/10 text-error hover:bg-error hover:text-white border border-error/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-none shrink-0"
            title="Remove optional Team 3 from Evening Domestic Squadron"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Team 3</span>
          </button>
        );
      } else {
        return (
          <button
            onClick={handleAddOptionalDomesticTeam}
            className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-none shrink-0"
            title="Add optional 3rd team for Evening shift"
          >
            <Plus className="w-3 h-3" />
            <span>+ Add Team 3 (Optional)</span>
          </button>
        );
      }
    }

    if (selectedBriefingShift === 'Night') {
      if (domesticTeams.some(t => t.name === 'Team 2')) {
        return (
          <button
            onClick={() => handleRemoveOptionalDomesticTeam('Team 2')}
            className="px-3 py-1.5 bg-error/10 text-error hover:bg-error hover:text-white border border-error/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-none shrink-0"
            title="Remove optional Team 2 from Night Domestic Squadron"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Team 2</span>
          </button>
        );
      } else {
        return (
          <button
            onClick={handleAddOptionalDomesticTeam}
            className="px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-none shrink-0"
            title="Add optional 2nd team for Night shift"
          >
            <Plus className="w-3 h-3" />
            <span>+ Add Team 2 (Optional)</span>
          </button>
        );
      }
    }

    if (selectedBriefingShift === 'Morning' && domesticTeams.length < 3) {
      return (
        <button
          onClick={handleAddOptionalDomesticTeam}
          className="px-3 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white border border-sky-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-none shrink-0"
          title="Add Team to Morning Domestic Squadron"
        >
          <Plus className="w-3 h-3" />
          <span>+ Add Team {domesticTeams.length + 1}</span>
        </button>
      );
    }

    return null;
  };

  const renderDomesticSquadron = () => {
    return (
      <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden group w-full hover-glow-primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 w-full">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="p-4 badge-custom-primary rounded-2xl transition-all shadow-sm">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Domestic Squadron Assignments</h3>
                <span className="badge-custom-primary px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider">
                  {domesticTeams.length} {domesticTeams.length === 1 ? 'TEAM' : 'TEAMS'}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-1">
                Fair shift rotation based on prior domestic date, shift &amp; cyclic team allocation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {renderOptionalTeamButton()}
            {!isHistoricalView && canEdit && (
              <button
                onClick={handleAutoAssignDomestic}
                disabled={isAutoAssigningDomestic}
                className="px-4 py-2.5 kinetic-gradient text-white rounded-xl active:scale-95 hover:scale-105 transition-all flex items-center justify-center space-x-2 border border-sky-400/30 cursor-pointer shrink-0 shadow-premium"
                title="Automatically assign present Operators and Officers using fair rotation hierarchy"
              >
                <Zap className={`w-4 h-4 ${isAutoAssigningDomestic ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {isAutoAssigningDomestic ? 'Assigning...' : 'Auto-Assign Teams'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
          {domesticTeams.map((team, idx) => {
            const op1Hist = team.op1 ? historyMap.get(team.op1)?.lastDomestic : undefined;
            const op2Hist = team.op2 ? historyMap.get(team.op2)?.lastDomestic : undefined;

            const op1Rank = team.op1 ? getRankInRoles(team.op1, [UserRole.ITP_OPERATOR], 'DOM') : null;
            const op2Rank = team.op2 ? getRankInRoles(team.op2, [UserRole.ITP_OFFICER], 'DOM') : null;

            const eligibleOps = activeStaff.filter(u => 
              (staffAssignments.activeOperators || []).includes(u.id) && u.role === UserRole.ITP_OPERATOR
            );
            const eligibleOffs = activeStaff.filter(u => 
              (staffAssignments.activeOfficers || []).includes(u.id) && u.role === UserRole.ITP_OFFICER
            );

            // Deduplicate: Exclude staff already assigned in any other domestic field
            const otherAssignedForOp1 = new Set<string>();
            domesticTeams.forEach(t => {
              if (t.id === team.id) {
                if (t.op2) otherAssignedForOp1.add(t.op2);
              } else {
                if (t.op1) otherAssignedForOp1.add(t.op1);
                if (t.op2) otherAssignedForOp1.add(t.op2);
              }
            });
            const availableOps = eligibleOps.filter(op => op.id === team.op1 || !otherAssignedForOp1.has(op.id));

            const otherAssignedForOp2 = new Set<string>();
            domesticTeams.forEach(t => {
              if (t.id === team.id) {
                if (t.op1) otherAssignedForOp2.add(t.op1);
              } else {
                if (t.op1) otherAssignedForOp2.add(t.op1);
                if (t.op2) otherAssignedForOp2.add(t.op2);
              }
            });
            const availableOffs = eligibleOffs.filter(off => off.id === team.op2 || !otherAssignedForOp2.has(off.id));

            return (
              <div 
                key={team.id}
                className="bg-surface-dim border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
                    <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-mono text-on-surface-dim opacity-50 uppercase tracking-widest">
                      Group {idx + 1}
                    </span>
                    {canEdit && (team.op1 || team.op2) && (
                      <button
                        onClick={() => handleClearDomesticTeam(team.id)}
                        className="p-1 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                        title="Clear team assignments"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 flex items-center justify-between">
                    <span>RF Operator</span>
                    {op1Rank && op1Rank !== '-' && (
                      <span className="text-primary font-mono text-[8.5px]">Rank #{op1Rank}</span>
                    )}
                  </label>
                  <select
                    value={team.op1}
                    disabled={!canEdit}
                    onChange={(e) => handleDomesticAssignmentChange(team.id, 'op1', e.target.value)}
                    className={`bg-surface border border-white/10 rounded-xl p-2.5 text-[12px] font-bold text-on-surface outline-none w-full transition-colors ${
                      !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-primary'
                    }`}
                  >
                    <option value="" className="text-on-surface-dim italic">-- Select Operator --</option>
                    {availableOps.map(op => {
                      const tag = staffStatuses[op.id];
                      const isTagLate = tag === 'LATE';
                      const isIgnored = tag && !isTagLate;
                      return (
                        <option key={op.id} value={op.id}>
                          {op.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {team.op1 && (
                    <div className="text-[8.5px] font-mono text-on-surface-dim opacity-75 pt-0.5 flex items-center gap-1.5 flex-wrap">
                      {op1Hist ? (
                        <>
                          <span className="text-on-surface font-bold">Last: {formatDateShort(op1Hist.date)}</span>
                          <span className="px-1 py-0.2 rounded bg-surface border border-white/10 uppercase">{op1Hist.shift}</span>
                          <span className="px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 uppercase">{op1Hist.team}</span>
                        </>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                          Never Assigned (Top Priority)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 flex items-center justify-between">
                    <span>Officer</span>
                    {op2Rank && op2Rank !== '-' && (
                      <span className="text-cyan-400 font-mono text-[8.5px]">Rank #{op2Rank}</span>
                    )}
                  </label>
                  <select
                    value={team.op2}
                    disabled={!canEdit}
                    onChange={(e) => handleDomesticAssignmentChange(team.id, 'op2', e.target.value)}
                    className={`bg-surface border border-white/10 rounded-xl p-2.5 text-[12px] font-bold text-on-surface outline-none w-full transition-colors ${
                      !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                    }`}
                  >
                    <option value="" className="text-on-surface-dim italic">-- Select Officer --</option>
                    {availableOffs.map(off => {
                      const tag = staffStatuses[off.id];
                      const isTagLate = tag === 'LATE';
                      const isIgnored = tag && !isTagLate;
                      return (
                        <option key={off.id} value={off.id}>
                          {off.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {team.op2 && (
                    <div className="text-[8.5px] font-mono text-on-surface-dim opacity-75 pt-0.5 flex items-center gap-1.5 flex-wrap">
                      {op2Hist ? (
                        <>
                          <span className="text-on-surface font-bold">Last: {formatDateShort(op2Hist.date)}</span>
                          <span className="px-1 py-0.2 rounded bg-surface border border-white/10 uppercase">{op2Hist.shift}</span>
                          <span className="px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">{op2Hist.team}</span>
                        </>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                          Never Assigned (Top Priority)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderJetTransferCard = () => {
    const op1Hist = jetTransfer.op1 ? historyMap.get(jetTransfer.op1)?.lastJetTransfer : undefined;
    const op2Hist = jetTransfer.op2 ? historyMap.get(jetTransfer.op2)?.lastJetTransfer : undefined;

    const op1Rank = jetTransfer.op1 ? getRankInRoles(jetTransfer.op1, [UserRole.ITP_OPERATOR], 'JET') : null;
    const op2Rank = jetTransfer.op2 ? getRankInRoles(jetTransfer.op2, [UserRole.ITP_OFFICER], 'JET') : null;

    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOps = activeStaff.filter(u => 
      (staffAssignments.activeOperators || []).includes(u.id) && 
      u.role === UserRole.ITP_OPERATOR && 
      !domesticAssignees.has(u.id)
    );
    const eligibleOffs = activeStaff.filter(u => 
      (staffAssignments.activeOfficers || []).includes(u.id) && 
      u.role === UserRole.ITP_OFFICER && 
      !domesticAssignees.has(u.id)
    );

    return (
      <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden group w-full hover-glow-primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 w-full">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="p-4 badge-custom-cyan rounded-2xl transition-all shadow-sm">
              <Fuel className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Jet Fuel Transfer Task</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                  jetTransfer.enabled ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-surface border border-white/10 text-on-surface-dim'
                }`}>
                  {jetTransfer.enabled ? 'Active Task' : 'Optional Task'}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-1">
                Fair rotation between Active Operators &amp; Officers (Excluding Domestic Assignees)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={handleToggleJetTransferEnabled}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                    jetTransfer.enabled 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30' 
                      : 'bg-surface border-white/10 text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  {jetTransfer.enabled ? '✓ Task Enabled' : '+ Enable Task'}
                </button>
                <button
                  onClick={handleAutoAssignJetTransfer}
                  disabled={isAutoAssigningJetTransfer}
                  className="px-4 py-2 kinetic-gradient text-white rounded-xl active:scale-95 hover:scale-105 transition-all flex items-center justify-center space-x-2 border border-sky-400/30 cursor-pointer shrink-0 shadow-premium"
                  title="Automatically assign Jet Transfer Operator & Officer"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningJetTransfer ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningJetTransfer ? 'Assigning...' : 'Auto-Assign Jet'}
                  </span>
                </button>
                {(jetTransfer.op1 || jetTransfer.op2) && (
                  <button
                    onClick={handleClearJetTransfer}
                    className="p-2 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-xl transition-all cursor-pointer"
                    title="Clear Jet Transfer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
          {/* Operator Slot */}
          <div className="bg-surface-dim border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-cyan-400/30 transition-all shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Transfer Operator
                </span>
              </div>
              {op1Rank && op1Rank !== '-' && (
                <span className="text-cyan-400 font-mono text-[9px] font-bold">Rank #{op1Rank}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <select
                value={jetTransfer.op1}
                disabled={!canEdit}
                onChange={(e) => handleJetTransferAssignmentChange('op1', e.target.value)}
                className={`bg-surface border border-white/10 rounded-xl p-2.5 text-[12px] font-bold text-on-surface outline-none w-full transition-colors ${
                  !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                }`}
              >
                <option value="" className="text-on-surface-dim italic">-- Select Transfer Operator --</option>
                {eligibleOps.map(op => {
                  const tag = staffStatuses[op.id];
                  const isTagLate = tag === 'LATE';
                  const isIgnored = tag && !isTagLate;
                  return (
                    <option key={op.id} value={op.id} disabled={op.id === jetTransfer.op2}>
                      {op.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                    </option>
                  );
                })}
              </select>

              {jetTransfer.op1 && (
                <div className="text-[8.5px] font-mono text-on-surface-dim opacity-75 pt-0.5 flex items-center gap-1.5 flex-wrap">
                  {op1Hist ? (
                    <>
                      <span className="text-on-surface font-bold">Last: {formatDateShort(op1Hist.date)}</span>
                      {op1Hist.shift && (
                        <span className="px-1 py-0.2 rounded bg-surface border border-white/10 uppercase">{op1Hist.shift}</span>
                      )}
                    </>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                      Never Assigned (Top Priority)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Officer Slot */}
          <div className="bg-surface-dim border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-cyan-400/30 transition-all shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Transfer Officer
                </span>
              </div>
              {op2Rank && op2Rank !== '-' && (
                <span className="text-cyan-400 font-mono text-[9px] font-bold">Rank #{op2Rank}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <select
                value={jetTransfer.op2}
                disabled={!canEdit}
                onChange={(e) => handleJetTransferAssignmentChange('op2', e.target.value)}
                className={`bg-surface border border-white/10 rounded-xl p-2.5 text-[12px] font-bold text-on-surface outline-none w-full transition-colors ${
                  !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                }`}
              >
                <option value="" className="text-on-surface-dim italic">-- Select Transfer Officer --</option>
                {eligibleOffs.map(off => {
                  const tag = staffStatuses[off.id];
                  const isTagLate = tag === 'LATE';
                  const isIgnored = tag && !isTagLate;
                  return (
                    <option key={off.id} value={off.id} disabled={off.id === jetTransfer.op1}>
                      {off.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                    </option>
                  );
                })}
              </select>

              {jetTransfer.op2 && (
                <div className="text-[8.5px] font-mono text-on-surface-dim opacity-75 pt-0.5 flex items-center gap-1.5 flex-wrap">
                  {op2Hist ? (
                    <>
                      <span className="text-on-surface font-bold">Last: {formatDateShort(op2Hist.date)}</span>
                      {op2Hist.shift && (
                        <span className="px-1 py-0.2 rounded bg-surface border border-white/10 uppercase">{op2Hist.shift}</span>
                      )}
                    </>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                      Never Assigned (Top Priority)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDomesticTable = () => {
    return (
      <div className="space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-dim/60 p-3.5 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2 badge-custom-primary rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Domestic Squadron Roster
                </span>
                <span className="badge-custom-primary px-2 py-0.5 rounded-full text-[9px] font-black">
                  {domesticTeams.length} {domesticTeams.length === 1 ? 'Team' : 'Teams'} Active
                </span>
              </div>
              <p className="text-[9.5px] text-on-surface-dim font-bold opacity-60 uppercase tracking-wider">
                Fair cyclic rotation based on prior domestic date &amp; shift tie-breaker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {renderOptionalTeamButton()}
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={handleAutoAssignDomestic}
                  disabled={isAutoAssigningDomestic}
                  className="px-3.5 py-2 kinetic-gradient text-white rounded-xl active:scale-95 hover:scale-105 transition-all flex items-center space-x-2 border border-sky-400/30 cursor-pointer shadow-premium shrink-0"
                  title="Auto-Assign active domestic teams"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningDomestic ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningDomestic ? 'Assigning...' : 'Auto-Assign Domestic'}
                  </span>
                </button>
                {domesticTeams.some(t => t.op1 || t.op2) && (
                  <button
                    onClick={handleClearAllDomestic}
                    className="px-3 py-2 bg-surface hover:bg-error/10 text-on-surface-dim hover:text-error border border-white/10 hover:border-error/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    title="Clear all domestic team assignments"
                  >
                    Clear All
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-dim/40 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-lowest/80 text-[10px] font-black uppercase tracking-wider text-on-surface-dim border-b border-white/10">
                <th className="py-3.5 px-4 font-black">Squadron Team</th>
                <th className="py-3.5 px-4 font-black">RF Operator</th>
                <th className="py-3.5 px-4 font-black">Officer</th>
                <th className="py-3.5 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {domesticTeams.map((team, idx) => {
                const op1Hist = team.op1 ? historyMap.get(team.op1)?.lastDomestic : undefined;
                const op2Hist = team.op2 ? historyMap.get(team.op2)?.lastDomestic : undefined;
                const op1Rank = team.op1 ? getRankInRoles(team.op1, [UserRole.ITP_OPERATOR], 'DOM') : null;
                const op2Rank = team.op2 ? getRankInRoles(team.op2, [UserRole.ITP_OFFICER], 'DOM') : null;

                const eligibleOps = activeStaff.filter(u => 
                  (staffAssignments.activeOperators || []).includes(u.id) && u.role === UserRole.ITP_OPERATOR
                );
                const eligibleOffs = activeStaff.filter(u => 
                  (staffAssignments.activeOfficers || []).includes(u.id) && u.role === UserRole.ITP_OFFICER
                );

                // Deduplicate: Exclude staff already assigned in other domestic slots
                const otherAssignedForOp1 = new Set<string>();
                domesticTeams.forEach(t => {
                  if (t.id === team.id) {
                    if (t.op2) otherAssignedForOp1.add(t.op2);
                  } else {
                    if (t.op1) otherAssignedForOp1.add(t.op1);
                    if (t.op2) otherAssignedForOp1.add(t.op2);
                  }
                });
                const availableOps = eligibleOps.filter(op => op.id === team.op1 || !otherAssignedForOp1.has(op.id));

                const otherAssignedForOp2 = new Set<string>();
                domesticTeams.forEach(t => {
                  if (t.id === team.id) {
                    if (t.op1) otherAssignedForOp2.add(t.op1);
                  } else {
                    if (t.op1) otherAssignedForOp2.add(t.op1);
                    if (t.op2) otherAssignedForOp2.add(t.op2);
                  }
                });
                const availableOffs = eligibleOffs.filter(off => off.id === team.op2 || !otherAssignedForOp2.has(off.id));

                return (
                  <tr key={team.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(14,165,233,0.5)]"></div>
                        <span className="font-[900] text-[13px] text-on-surface">{team.name}</span>
                      </div>
                      <div className="text-[9.5px] font-mono text-on-surface-dim opacity-60 uppercase pl-5">
                        Group {idx + 1}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-xs">
                      <select
                        value={team.op1}
                        disabled={!canEdit}
                        onChange={(e) => handleDomesticAssignmentChange(team.id, 'op1', e.target.value)}
                        className={`w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-[12px] font-bold text-on-surface outline-none transition-colors ${
                          !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-primary'
                        }`}
                      >
                        <option value="" className="text-on-surface-dim italic">-- Unassigned Operator --</option>
                        {availableOps.map(op => {
                          const tag = staffStatuses[op.id];
                          const isTagLate = tag === 'LATE';
                          const isIgnored = tag && !isTagLate;
                          return (
                            <option key={op.id} value={op.id}>
                              {op.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {team.op1 && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                          {op1Rank && op1Rank !== '-' && (
                            <span className="text-primary font-bold">Rank #{op1Rank}</span>
                          )}
                          {op1Hist ? (
                            <span className="text-on-surface-dim opacity-75">
                              Last: {formatDateShort(op1Hist.date)} ({op1Hist.shift}) [{op1Hist.team}]
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">Never Assigned</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-xs">
                      <select
                        value={team.op2}
                        disabled={!canEdit}
                        onChange={(e) => handleDomesticAssignmentChange(team.id, 'op2', e.target.value)}
                        className={`w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-[12px] font-bold text-on-surface outline-none transition-colors ${
                          !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                        }`}
                      >
                        <option value="" className="text-on-surface-dim italic">-- Unassigned Officer --</option>
                        {availableOffs.map(off => {
                          const tag = staffStatuses[off.id];
                          const isTagLate = tag === 'LATE';
                          const isIgnored = tag && !isTagLate;
                          return (
                            <option key={off.id} value={off.id}>
                              {off.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {team.op2 && (
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                          {op2Rank && op2Rank !== '-' && (
                            <span className="text-cyan-400 font-bold">Rank #{op2Rank}</span>
                          )}
                          {op2Hist ? (
                            <span className="text-on-surface-dim opacity-75">
                              Last: {formatDateShort(op2Hist.date)} ({op2Hist.shift}) [{op2Hist.team}]
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold">Never Assigned</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top text-right">
                      {canEdit && (team.op1 || team.op2) && (
                        <button
                          onClick={() => handleClearDomesticTeam(team.id)}
                          className="p-2 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-xl transition-all cursor-pointer inline-flex items-center"
                          title="Clear this team assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderJetTransferTable = () => {
    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOps = activeStaff.filter(u => 
      (staffAssignments.activeOperators || []).includes(u.id) && 
      u.role === UserRole.ITP_OPERATOR && 
      !domesticAssignees.has(u.id)
    );
    const eligibleOffs = activeStaff.filter(u => 
      (staffAssignments.activeOfficers || []).includes(u.id) && 
      u.role === UserRole.ITP_OFFICER && 
      !domesticAssignees.has(u.id)
    );

    const op1Hist = jetTransfer.op1 ? historyMap.get(jetTransfer.op1)?.lastJetTransfer : undefined;
    const op2Hist = jetTransfer.op2 ? historyMap.get(jetTransfer.op2)?.lastJetTransfer : undefined;
    const op1Rank = jetTransfer.op1 ? getRankInRoles(jetTransfer.op1, [UserRole.ITP_OPERATOR], 'JET') : null;
    const op2Rank = jetTransfer.op2 ? getRankInRoles(jetTransfer.op2, [UserRole.ITP_OFFICER], 'JET') : null;

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-dim/60 p-3.5 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2 badge-custom-cyan rounded-xl">
              <Fuel className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Jet Fuel Transfer Task
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  jetTransfer.enabled ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-surface border border-white/10 text-on-surface-dim'
                }`}>
                  {jetTransfer.enabled ? 'Active Task' : 'Optional / Standby'}
                </span>
              </div>
              <p className="text-[9.5px] text-on-surface-dim font-bold opacity-60 uppercase tracking-wider">
                Excludes staff assigned to Domestic Squadron • Fair rotation by date &amp; shift
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={handleToggleJetTransferEnabled}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                    jetTransfer.enabled 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30' 
                      : 'bg-surface border-white/10 text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  {jetTransfer.enabled ? '✓ Task Enabled' : '+ Enable Task'}
                </button>
                <button
                  onClick={handleAutoAssignJetTransfer}
                  disabled={isAutoAssigningJetTransfer}
                  className="px-3.5 py-2 kinetic-gradient text-white rounded-xl active:scale-95 hover:scale-105 transition-all flex items-center space-x-2 border border-sky-400/30 cursor-pointer shadow-premium shrink-0"
                  title="Auto-Assign Jet Transfer personnel"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningJetTransfer ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningJetTransfer ? 'Assigning...' : 'Auto-Assign Jet'}
                  </span>
                </button>
                {(jetTransfer.op1 || jetTransfer.op2) && (
                  <button
                    onClick={handleClearJetTransfer}
                    className="px-3 py-2 bg-surface hover:bg-error/10 text-on-surface-dim hover:text-error border border-white/10 hover:border-error/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    title="Clear Jet Transfer assignment"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-dim/40 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-lowest/80 text-[10px] font-black uppercase tracking-wider text-on-surface-dim border-b border-white/10">
                <th className="py-3.5 px-4 font-black">Operation / Task</th>
                <th className="py-3.5 px-4 font-black">Transfer Operator</th>
                <th className="py-3.5 px-4 font-black">Transfer Officer</th>
                <th className="py-3.5 px-4 font-black text-right">Task Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr className="hover:bg-surface-container/50 transition-colors">
                <td className="py-3.5 px-4 align-top">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${jetTransfer.enabled ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-on-surface-dim opacity-40'}`}></div>
                    <span className="font-[900] text-[13px] text-on-surface">JET TRANSFER</span>
                  </div>
                  <div className="text-[9.5px] font-mono text-on-surface-dim opacity-60 uppercase pl-5">
                    NFF to OFF Transfer
                  </div>
                </td>

                <td className="py-3.5 px-4 align-top max-w-xs">
                  <select
                    value={jetTransfer.op1}
                    disabled={!canEdit}
                    onChange={(e) => handleJetTransferAssignmentChange('op1', e.target.value)}
                    className={`w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-[12px] font-bold text-on-surface outline-none transition-colors ${
                      !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                    }`}
                  >
                    <option value="" className="text-on-surface-dim italic">-- Unassigned Operator --</option>
                    {eligibleOps.map(op => {
                      const tag = staffStatuses[op.id];
                      const isTagLate = tag === 'LATE';
                      const isIgnored = tag && !isTagLate;
                      return (
                        <option key={op.id} value={op.id} disabled={op.id === jetTransfer.op2}>
                          {op.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {jetTransfer.op1 && (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                      {op1Rank && op1Rank !== '-' && (
                        <span className="text-cyan-400 font-bold">Rank #{op1Rank}</span>
                      )}
                      {op1Hist ? (
                        <span className="text-on-surface-dim opacity-75">
                          Last: {formatDateShort(op1Hist.date)} ({op1Hist.shift || '—'})
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">Never Assigned</span>
                      )}
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4 align-top max-w-xs">
                  <select
                    value={jetTransfer.op2}
                    disabled={!canEdit}
                    onChange={(e) => handleJetTransferAssignmentChange('op2', e.target.value)}
                    className={`w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-[12px] font-bold text-on-surface outline-none transition-colors ${
                      !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                    }`}
                  >
                    <option value="" className="text-on-surface-dim italic">-- Unassigned Officer --</option>
                    {eligibleOffs.map(off => {
                      const tag = staffStatuses[off.id];
                      const isTagLate = tag === 'LATE';
                      const isIgnored = tag && !isTagLate;
                      return (
                        <option key={off.id} value={off.id} disabled={off.id === jetTransfer.op1}>
                          {off.name} {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {jetTransfer.op2 && (
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                      {op2Rank && op2Rank !== '-' && (
                        <span className="text-cyan-400 font-bold">Rank #{op2Rank}</span>
                      )}
                      {op2Hist ? (
                        <span className="text-on-surface-dim opacity-75">
                          Last: {formatDateShort(op2Hist.date)} ({op2Hist.shift || '—'})
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">Never Assigned</span>
                      )}
                    </div>
                  )}
                </td>

                <td className="py-3.5 px-4 align-top text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                    jetTransfer.enabled 
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                      : 'bg-surface border border-white/10 text-on-surface-dim opacity-60'
                  }`}>
                    {jetTransfer.enabled ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDailyTable = () => {
    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOpsStaff = activeStaff.filter(u => 
      (staffAssignments.activeOperators || []).includes(u.id) && u.role === UserRole.ITP_OPERATOR
    );
    const eligibleOffsStaff = activeStaff.filter(u => 
      (staffAssignments.activeOfficers || []).includes(u.id) && u.role === UserRole.ITP_OFFICER
    );
    const eligibleHydrantStaff = activeStaff.filter(u => 
      (staffAssignments.hydrantOpsOfficers || []).includes(u.id)
    );

    const completedCount = rfHdEquipment.filter(eq => dailyCompleted.includes(eq.id)).length;

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-dim/60 p-3.5 rounded-2xl border border-outline">
          <div className="flex items-center space-x-3">
            <div className="p-2 badge-custom-success rounded-xl">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Equipment Daily Safety Checks
                </span>
                <span className="badge-custom-success px-2 py-0.5 rounded-full text-[9px] font-black">
                  {completedCount} / {rfHdEquipment.length} Checked
                </span>
              </div>
              <p className="text-[9.5px] text-on-surface-dim font-bold opacity-60 uppercase tracking-wider">
                RF: Operator &amp; Officer • HD: Hydrant Ops Officer • Excludes Domestic staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={() => handleAutoAssignFleet('DAILY')}
                  disabled={isAutoAssigningFleet}
                  className="px-3.5 py-2 kinetic-gradient text-white rounded-xl active:scale-95 hover:scale-105 transition-all flex items-center space-x-2 border border-sky-400/30 cursor-pointer shadow-premium shrink-0"
                  title="Auto-Assign equipment safety check inspectors"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningFleet ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningFleet ? 'Assigning...' : 'Auto-Assign Daily'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-dim/40 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-lowest/80 text-[10px] font-black uppercase tracking-wider text-on-surface-dim border-b border-white/10">
                <th className="py-3.5 px-4 font-black">Equipment</th>
                <th className="py-3.5 px-4 font-black">Daily Check</th>
                <th className="py-3.5 px-4 font-black">Inspector / Operator</th>
                <th className="py-3.5 px-4 font-black">Officer / Hydrant Officer</th>
                <th className="py-3.5 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rfHdEquipment.map((eq) => {
                const isHd = eq.type === EquipmentType.HYDRANT_DISPENSER;
                const isOutOfService = eq.status === EquipmentStatus.OUT_OF_SERVICE;
                const isFromNight = Boolean(nightCarriedDailyAssignments[eq.id]?.op1 || nightCarriedDailyAssignments[eq.id]?.op2);
                const isDailyDone = dailyCompleted.includes(eq.id) || isFromNight;
                const assignedOp1 = equipmentAssignments[eq.id]?.op1 || '';
                const assignedOp2 = equipmentAssignments[eq.id]?.op2 || '';

                const op1Hist = assignedOp1 ? historyMap.get(assignedOp1)?.lastDaily : undefined;
                const op2Hist = assignedOp2 ? historyMap.get(assignedOp2)?.lastDaily : undefined;
                const op1Rank = assignedOp1 ? getRankInRoles(assignedOp1, isHd ? [UserRole.ITP_OFFICER] : [UserRole.ITP_OPERATOR], 'DAILY') : null;
                const op2Rank = assignedOp2 ? getRankInRoles(assignedOp2, [UserRole.ITP_OFFICER], 'DAILY') : null;

                return (
                  <tr key={eq.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="py-3 px-4 align-middle">
                      <div className="flex items-center space-x-2">
                        <span className="font-[900] text-[13px] text-on-surface">{eq.id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                          isHd ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'badge-custom-primary'
                        }`}>
                          {isHd ? 'HD' : 'RF'}
                        </span>
                        {isFromNight && (
                          <span className="px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            Night Shift
                          </span>
                        )}
                      </div>
                      <div className={`text-[9px] font-mono ${isOutOfService ? 'text-error font-bold' : 'text-on-surface-dim opacity-60'}`}>
                        {eq.status}
                      </div>
                    </td>

                    <td className="py-3 px-4 align-middle">
                      {isOutOfService ? (
                        <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-error/10 text-error border border-white/10 inline-block">
                          Out of Service
                        </span>
                      ) : isFromNight ? (
                        <div
                          className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default select-none shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                          title="Daily check completed on Night Shift (Carry-Forward)"
                        >
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>COMPLETED</span>
                        </div>
                      ) : (
                        <button
                          disabled={!canEdit}
                          onClick={() => handleToggleDailyCompleted(eq.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center space-x-1.5 ${
                            !canEdit ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'
                          } ${
                            isDailyDone
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-surface border-white/10 text-on-surface-dim opacity-50 hover:opacity-100'
                          }`}
                          title="Click to toggle check completion"
                        >
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span>{isDailyDone ? 'COMPLETED' : 'PENDING'}</span>
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle max-w-xs">
                      {isOutOfService ? (
                        <span className="text-[10px] font-bold text-error/60 italic">No slot (Out of service)</span>
                      ) : isHd ? (
                        <div className="text-[10px] font-bold text-on-surface-dim opacity-40 italic">
                          — (HD Inspected by Officer)
                        </div>
                      ) : isFromNight ? (
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface border border-white/10 text-on-surface text-[11px] font-bold">
                          <span className="truncate">{activeStaff.find(s => s.id === assignedOp1)?.name || assignedOp1 || 'Night Operator'}</span>
                          <span className="text-[8px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-2 shrink-0">
                            Night Shift
                          </span>
                        </div>
                      ) : (
                        <div>
                          <select
                            value={assignedOp1}
                            disabled={!canEdit}
                            onChange={(e) => handleDailyAssignmentChange(eq.id, 'op1', e.target.value)}
                            className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                              !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-primary'
                            }`}
                          >
                            <option value="" className="text-on-surface-dim italic">-- Operator --</option>
                            {eligibleOpsStaff.map(op => {
                              const isDom = domesticAssignees.has(op.id);
                              const tag = staffStatuses[op.id];
                              const isLate = tag === 'LATE';
                              return (
                                <option key={op.id} value={op.id}>
                                  {op.name} {isDom ? '(Domestic)' : tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {assignedOp1 && (
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                              {op1Rank && op1Rank !== '-' && (
                                <span className="text-primary font-bold">Rank #{op1Rank}</span>
                              )}
                              {op1Hist ? (
                                <span className="text-on-surface-dim opacity-75">Last: {formatDateShort(op1Hist.date)}</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">Never Assigned</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle max-w-xs">
                      {isOutOfService ? (
                        <span className="text-[10px] font-bold text-error/60 italic">No slot (Out of service)</span>
                      ) : isHd ? (
                        isFromNight ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface border border-white/10 text-on-surface text-[11px] font-bold">
                            <span className="truncate">{activeStaff.find(s => s.id === assignedOp1)?.name || assignedOp1 || 'Night Hydrant Officer'}</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-2 shrink-0">
                              Night Shift
                            </span>
                          </div>
                        ) : (
                          <div>
                            <select
                              value={assignedOp1}
                              disabled={!canEdit}
                              onChange={(e) => handleDailyAssignmentChange(eq.id, 'op1', e.target.value)}
                              className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                                !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-amber-500'
                              }`}
                            >
                              <option value="" className="text-on-surface-dim italic">-- Hydrant Officer --</option>
                              {eligibleHydrantStaff.map(st => {
                                const isDom = domesticAssignees.has(st.id);
                                const tag = staffStatuses[st.id];
                                const isLate = tag === 'LATE';
                                return (
                                  <option key={st.id} value={st.id}>
                                    {st.name} {isDom ? '(Domestic)' : tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                            {assignedOp1 && (
                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                                {op1Rank && op1Rank !== '-' && (
                                  <span className="text-amber-400 font-bold">Rank #{op1Rank}</span>
                                )}
                                {op1Hist ? (
                                  <span className="text-on-surface-dim opacity-75">Last: {formatDateShort(op1Hist.date)}</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">Never Assigned</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      ) : isFromNight ? (
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface border border-white/10 text-on-surface text-[11px] font-bold">
                          <span className="truncate">{activeStaff.find(s => s.id === assignedOp2)?.name || assignedOp2 || 'Night Officer'}</span>
                          <span className="text-[8px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-2 shrink-0">
                            Night Shift
                          </span>
                        </div>
                      ) : (
                        <div>
                          <select
                            value={assignedOp2}
                            disabled={!canEdit}
                            onChange={(e) => handleDailyAssignmentChange(eq.id, 'op2', e.target.value)}
                            className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                              !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-cyan-400'
                            }`}
                          >
                            <option value="" className="text-on-surface-dim italic">-- Officer --</option>
                            {eligibleOffsStaff.map(off => {
                              const isDom = domesticAssignees.has(off.id);
                              const tag = staffStatuses[off.id];
                              const isLate = tag === 'LATE';
                              return (
                                <option key={off.id} value={off.id}>
                                  {off.name} {isDom ? '(Domestic)' : tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {assignedOp2 && (
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                              {op2Rank && op2Rank !== '-' && (
                                <span className="text-cyan-400 font-bold">Rank #{op2Rank}</span>
                              )}
                              {op2Hist ? (
                                <span className="text-on-surface-dim opacity-75">Last: {formatDateShort(op2Hist.date)}</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">Never Assigned</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 align-middle text-right">
                      {canEdit && !isOutOfService && !isFromNight && (assignedOp1 || assignedOp2) && (
                        <button
                          onClick={() => handleClearDailyAssignment(eq.id)}
                          className="p-1.5 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                          title="Clear assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDieselTable = () => {
    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOpsStaff = activeStaff.filter(u => 
      (staffAssignments.activeOperators || []).includes(u.id) && u.role === UserRole.ITP_OPERATOR
    );
    const eligibleHydrantStaff = activeStaff.filter(u => 
      (staffAssignments.hydrantOpsOfficers || []).includes(u.id)
    );

    // Filter strictly to equipment requiring diesel that are NOT out of service
    const dieselEquipment = rfHdEquipment.filter(eq => 
      dieselNeeds.includes(eq.id) && eq.status !== EquipmentStatus.OUT_OF_SERVICE
    );

    const neededCount = dieselEquipment.length;

    // Track assigned staff across diesel slots to prevent duplicate selection
    const alreadyAssignedDiesel = new Set<string>();
    Object.entries(dieselAssignments).forEach(([eqId, assign]) => {
      if (assign?.op1) alreadyAssignedDiesel.add(assign.op1);
    });

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-dim/60 p-3.5 rounded-2xl border border-outline">
          <div className="flex items-center space-x-3">
            <div className="p-2 badge-custom-warning rounded-xl">
              <Droplet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Equipment Diesel Refuelling
                </span>
                <span className="badge-custom-warning px-2 py-0.5 rounded-full text-[9px] font-black">
                  {neededCount} Requiring Diesel
                </span>
              </div>
              <p className="text-[9.5px] text-on-surface-dim font-bold opacity-60 uppercase tracking-wider">
                Evening Refuelling • RF: 1 Operator • HD: 1 Hydrant Ops Officer • Excludes Domestic staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={() => handleAutoAssignFleet('DIESEL')}
                  disabled={isAutoAssigningFleet || neededCount === 0}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl active:scale-95 transition-all flex items-center space-x-2 border border-amber-500/30 cursor-pointer shadow-none shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Auto-Assign diesel refuelling personnel"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningFleet ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningFleet ? 'Assigning...' : 'Auto-Assign Diesel'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-dim/40 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-lowest/80 text-[10px] font-black uppercase tracking-wider text-on-surface-dim border-b border-white/10">
                <th className="py-3.5 px-4 font-black">Equipment</th>
                <th className="py-3.5 px-4 font-black">Diesel Requirement</th>
                <th className="py-3.5 px-4 font-black">Assigned Diesel Staff</th>
                <th className="py-3.5 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {dieselEquipment.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Droplet className="w-8 h-8 text-amber-400/40" />
                      <span className="text-xs font-black uppercase tracking-wider text-on-surface">No Equipment Marked for Diesel</span>
                      <span className="text-[10px] text-on-surface-dim font-bold opacity-60">
                        Mark equipment requiring diesel in Fleet Status using the DIESEL button.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                dieselEquipment.map((eq) => {
                  const isHd = eq.type === EquipmentType.HYDRANT_DISPENSER;
                  const assignedStaffId = dieselAssignments[eq.id]?.op1 || '';
                  const staffHist = assignedStaffId ? historyMap.get(assignedStaffId)?.lastDiesel : undefined;
                  const staffRank = assignedStaffId ? getRankInRoles(assignedStaffId, isHd ? [UserRole.ITP_HD_OPERATOR] : [UserRole.ITP_OPERATOR], 'DIESEL') : null;

                  return (
                    <tr key={eq.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center space-x-2">
                          <span className="font-[900] text-[13px] text-on-surface">{eq.id}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase ${
                            isHd ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'badge-custom-primary'
                          }`}>
                            {isHd ? 'HD' : 'RF'}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-on-surface-dim opacity-60">
                          {eq.status}
                        </div>
                      </td>

                      <td className="py-3 px-4 align-middle">
                        <button
                          disabled={!canEdit}
                          onClick={() => handleToggleDieselNeed(eq.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center space-x-1.5 ${
                            !canEdit ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'
                          } bg-amber-500/20 text-amber-400 border-amber-500/40`}
                          title="Click to toggle diesel requirement"
                        >
                          <Droplet className="w-3.5 h-3.5 shrink-0" />
                          <span>DIESEL REQUIRED</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 align-middle max-w-sm">
                        {isHd ? (
                          <div>
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-amber-400/80 mb-0.5 block">
                              HD Hydrant Ops Officer
                            </label>
                            <select
                              value={assignedStaffId}
                              disabled={!canEdit}
                              onChange={(e) => handleDieselAssignmentChange(eq.id, e.target.value)}
                              className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                                !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-amber-500'
                              }`}
                            >
                              <option value="" className="text-on-surface-dim italic">-- Hydrant Ops Officer --</option>
                              {eligibleHydrantStaff
                                .filter(st => (!alreadyAssignedDiesel.has(st.id) || st.id === assignedStaffId) && !domesticAssignees.has(st.id))
                                .map(st => {
                                  const tag = staffStatuses[st.id];
                                  const isLate = tag === 'LATE';
                                  return (
                                    <option key={st.id} value={st.id}>
                                      {st.name} {tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                                    </option>
                                  );
                                })}
                            </select>
                            {assignedStaffId && (
                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                                {staffRank && staffRank !== '-' && (
                                  <span className="text-amber-400 font-bold">Rank #{staffRank}</span>
                                )}
                                {staffHist ? (
                                  <span className="text-on-surface-dim opacity-75">Last: {formatDateShort(staffHist.date)}</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">Never Assigned</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-primary/80 mb-0.5 block">
                              RF Operator
                            </label>
                            <select
                              value={assignedStaffId}
                              disabled={!canEdit}
                              onChange={(e) => handleDieselAssignmentChange(eq.id, e.target.value)}
                              className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                                !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-primary'
                              }`}
                            >
                              <option value="" className="text-on-surface-dim italic">-- Active Operator --</option>
                              {eligibleOpsStaff
                                .filter(op => (!alreadyAssignedDiesel.has(op.id) || op.id === assignedStaffId) && !domesticAssignees.has(op.id))
                                .map(op => {
                                  const tag = staffStatuses[op.id];
                                  const isLate = tag === 'LATE';
                                  return (
                                    <option key={op.id} value={op.id}>
                                      {op.name} {tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                                    </option>
                                  );
                                })}
                            </select>
                            {assignedStaffId && (
                              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                                {staffRank && staffRank !== '-' && (
                                  <span className="text-primary font-bold">Rank #{staffRank}</span>
                                )}
                                {staffHist ? (
                                  <span className="text-on-surface-dim opacity-75">Last: {formatDateShort(staffHist.date)}</span>
                                ) : (
                                  <span className="text-emerald-400 font-bold">Never Assigned</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 align-middle text-right">
                        {canEdit && assignedStaffId && (
                          <button
                            onClick={() => handleClearDieselAssignment(eq.id)}
                            className="p-1.5 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                            title="Clear assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStockCard = () => {
    const assignedStaffId = stockAssignment.staffId || '';
    const staffHist = assignedStaffId ? historyMap.get(assignedStaffId)?.lastStock : undefined;
    const staffRank = assignedStaffId ? getRankInRoles(assignedStaffId, [UserRole.ITP_OFFICER, UserRole.ITP_HD_OPERATOR], 'STOCK') : null;

    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOfficers = activeStaff.filter(u => 
      ((staffAssignments.activeOfficers || []).includes(u.id) || (staffAssignments.hydrantOpsOfficers || []).includes(u.id)) &&
      (u.role === UserRole.ITP_OFFICER || u.role === UserRole.ITP_HD_OPERATOR) &&
      !domesticAssignees.has(u.id)
    );

    return (
      <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden group w-full hover-glow-primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 w-full">
          <div className="flex items-center space-x-4 sm:space-x-5">
            <div className="p-4 badge-custom-purple rounded-2xl transition-all shadow-sm">
              <Package className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Stock Duty</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                  assignedStaffId ? 'badge-custom-primary' : 'bg-surface border border-outline text-on-surface-dim'
                }`}>
                  {assignedStaffId ? 'Assigned' : '1 Slot Available'}
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-1">
                Night Shift • 1 Officer or Hydrant Ops Officer slot (Excludes Domestic Assignees)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={handleAutoAssignStock}
                  disabled={isAutoAssigningStock}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl active:scale-95 transition-all flex items-center justify-center space-x-2 border border-purple-500/30 cursor-pointer shrink-0 shadow-none"
                  title="Automatically assign Stock Duty Officer using fair rotation"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningStock ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningStock ? 'Assigning...' : 'Auto-Assign Stock'}
                  </span>
                </button>
                {assignedStaffId && (
                  <button
                    onClick={handleClearStockAssignment}
                    className="p-2 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-xl transition-all cursor-pointer"
                    title="Clear Stock Duty assignment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="max-w-md relative z-10">
          <div className="bg-surface-dim border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-purple-400/30 transition-all shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]"></div>
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Stock Officer
                </span>
              </div>
              {staffRank && staffRank !== '-' && (
                <span className="text-purple-400 font-mono text-[9px] font-bold">Rank #{staffRank}</span>
              )}
            </div>

            <div className="space-y-1.5">
              <select
                value={assignedStaffId}
                disabled={!canEdit}
                onChange={(e) => handleStockAssignmentChange(e.target.value)}
                className={`bg-surface border border-white/10 rounded-xl p-2.5 text-[12px] font-bold text-on-surface outline-none w-full transition-colors ${
                  !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-purple-400'
                }`}
              >
                <option value="" className="text-on-surface-dim italic">-- Select Stock Officer / HD Officer --</option>
                {eligibleOfficers.map(st => {
                  const tag = staffStatuses[st.id];
                  const isTagLate = tag === 'LATE';
                  const isIgnored = tag && !isTagLate;
                  return (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role === UserRole.ITP_HD_OPERATOR ? 'HD Officer' : 'Officer'}) {isIgnored ? `(${tag} - Excluded)` : isTagLate ? '(LATE)' : ''}
                    </option>
                  );
                })}
              </select>

              {assignedStaffId && (
                <div className="text-[8.5px] font-mono text-on-surface-dim opacity-75 pt-0.5 flex items-center gap-1.5 flex-wrap">
                  {staffHist ? (
                    <>
                      <span className="text-on-surface font-bold">Last Stock: {formatDateShort(staffHist.date)}</span>
                      {staffHist.shift && (
                        <span className="px-1 py-0.2 rounded bg-surface border border-white/10 uppercase">{staffHist.shift}</span>
                      )}
                    </>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                      Never Assigned (Top Priority)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStockTable = () => {
    const domesticAssignees = new Set<string>();
    domesticTeams.forEach(t => {
      if (t.op1) domesticAssignees.add(t.op1);
      if (t.op2) domesticAssignees.add(t.op2);
    });

    const eligibleOfficers = activeStaff.filter(u => 
      ((staffAssignments.activeOfficers || []).includes(u.id) || (staffAssignments.hydrantOpsOfficers || []).includes(u.id)) &&
      (u.role === UserRole.ITP_OFFICER || u.role === UserRole.ITP_HD_OPERATOR) &&
      !domesticAssignees.has(u.id)
    );

    const assignedStaffId = stockAssignment.staffId || '';
    const staffHist = assignedStaffId ? historyMap.get(assignedStaffId)?.lastStock : undefined;
    const staffRank = assignedStaffId ? getRankInRoles(assignedStaffId, [UserRole.ITP_OFFICER, UserRole.ITP_HD_OPERATOR], 'STOCK') : null;

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-dim/60 p-3.5 rounded-2xl border border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2 badge-custom-purple rounded-xl">
              <Package className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-[900] text-on-surface uppercase tracking-wider">
                  Stock Duty Allocation
                </span>
                <span className="badge-custom-purple px-2 py-0.5 rounded-full text-[9px] font-black">
                  1 Slot
                </span>
              </div>
              <p className="text-[9.5px] text-on-surface-dim font-bold opacity-60 uppercase tracking-wider">
                Night Shift • Officer or Hydrant Ops Officer • Fair rotation based on last stock duty date &amp; shift
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isHistoricalView && canEdit && (
              <>
                <button
                  onClick={handleAutoAssignStock}
                  disabled={isAutoAssigningStock}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl active:scale-95 transition-all flex items-center space-x-2 border border-purple-500/30 cursor-pointer shadow-none shrink-0"
                  title="Auto-Assign stock duty officer"
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningStock ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isAutoAssigningStock ? 'Assigning...' : 'Auto-Assign Stock'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface-dim/40 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-lowest/80 text-[10px] font-black uppercase tracking-wider text-on-surface-dim border-b border-white/10">
                <th className="py-3.5 px-4 font-black">Duty Name</th>
                <th className="py-3.5 px-4 font-black">Shift</th>
                <th className="py-3.5 px-4 font-black">Assigned Officer / Hydrant Ops Officer</th>
                <th className="py-3.5 px-4 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr className="hover:bg-surface-container/50 transition-colors">
                <td className="py-3 px-4 align-middle">
                  <div className="flex items-center space-x-2">
                    <span className="font-[900] text-[13px] text-on-surface">STOCK</span>
                    <span className="badge-custom-purple px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase">
                      Night Duty
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-on-surface-dim opacity-60">
                    Stock Inventory / Verification
                  </div>
                </td>

                <td className="py-3 px-4 align-middle">
                  <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-block">
                    Night Shift
                  </span>
                </td>

                <td className="py-3 px-4 align-middle max-w-sm">
                  <div>
                    <label className="text-[8.5px] font-black uppercase tracking-widest text-purple-400/80 mb-0.5 block">
                      Officer or HD Officer
                    </label>
                    <select
                      value={assignedStaffId}
                      disabled={!canEdit}
                      onChange={(e) => handleStockAssignmentChange(e.target.value)}
                      className={`w-full bg-surface border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-on-surface outline-none transition-colors ${
                        !canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-purple-400'
                      }`}
                    >
                      <option value="" className="text-on-surface-dim italic">-- Select Officer / HD Officer --</option>
                      {eligibleOfficers.map(st => {
                        const tag = staffStatuses[st.id];
                        const isLate = tag === 'LATE';
                        return (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.role === UserRole.ITP_HD_OPERATOR ? 'HD Officer' : 'Officer'}) {tag && !isLate ? `(${tag})` : isLate ? '(LATE)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {assignedStaffId && (
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[8.5px] font-mono">
                        {staffRank && staffRank !== '-' && (
                          <span className="text-purple-400 font-bold">Rank #{staffRank}</span>
                        )}
                        {staffHist ? (
                          <span className="text-on-surface-dim opacity-75">
                            Last: {formatDateShort(staffHist.date)} ({staffHist.shift || '—'})
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">Never Assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>

                <td className="py-3 px-4 align-middle text-right">
                  {canEdit && assignedStaffId && (
                    <button
                      onClick={handleClearStockAssignment}
                      className="p-1.5 text-on-surface-dim hover:text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                      title="Clear assignment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderOperationalAssignmentsSection = () => {
    // Determine shift-specific tabs per user requirements:
    // - Night shift: DOMESTIC, DAILY, STOCK, ALL TABLES
    // - Morning shift: DOMESTIC, DAILY, ALL TABLES
    // - Evening shift: DOMESTIC, DIESEL, JET TRANSFER, ALL TABLES
    const tabs = (() => {
      if (selectedBriefingShift === 'Night') {
        return [
          { id: 'domestic', label: 'DOMESTIC', count: `${domesticTeams.length} Teams`, icon: Users },
          { id: 'daily', label: 'DAILY', count: `${dailyCompleted.length}/${rfHdEquipment.length}`, icon: UserCheck },
          { id: 'stock', label: 'STOCK', count: stockAssignment.staffId ? '1 Assigned' : '1 Slot', icon: Package },
          { id: 'all', label: 'ALL TABLES', count: 'Executive', icon: Layers }
        ];
      }
      if (selectedBriefingShift === 'Evening') {
        const dieselCount = rfHdEquipment.filter(e => dieselNeeds.includes(e.id) && e.status !== EquipmentStatus.OUT_OF_SERVICE).length;
        return [
          { id: 'domestic', label: 'DOMESTIC', count: `${domesticTeams.length} Teams`, icon: Users },
          { id: 'diesel', label: 'DIESEL', count: `${dieselCount} Needed`, icon: Droplet },
          { id: 'jet', label: 'JET TRANSFER', count: jetTransfer.enabled ? 'Active' : 'Optional', icon: Fuel },
          { id: 'all', label: 'ALL TABLES', count: 'Executive', icon: Layers }
        ];
      }
      // Morning Shift default:
      return [
        { id: 'domestic', label: 'DOMESTIC', count: `${domesticTeams.length} Teams`, icon: Users },
        { id: 'daily', label: 'DAILY', count: `${dailyCompleted.length}/${rfHdEquipment.length}`, icon: UserCheck },
        { id: 'all', label: 'ALL TABLES', count: 'Executive', icon: Layers }
      ];
    })();

    return (
      <div className="card-premium p-5 sm:p-8 space-y-6 relative overflow-hidden group w-full hover-glow-primary">
        {/* Hub Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 badge-custom-primary rounded-2xl shadow-sm">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-on-surface">
                  OPERATIONAL TASK ASSIGNMENTS
                </h3>
                <span className="badge-custom-primary px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase">
                  {selectedBriefingShift} Shift
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim opacity-60 uppercase tracking-widest mt-1">
                {assignmentViewMode === 'table'
                  ? selectedBriefingShift === 'Night'
                    ? 'Interactive editable spreadsheets for Domestic, Daily Checks & Stock Duty'
                    : selectedBriefingShift === 'Evening'
                    ? 'Interactive editable spreadsheets for Domestic, Diesel & Jet Transfer'
                    : 'Interactive editable spreadsheets for Domestic & Daily Equipment Checks'
                  : 'Tactical operational cards with automated fair rotation allocation'}
              </p>
            </div>
          </div>

          {/* View Mode Toggle: [ Table View | Card View ] */}
          <div className="relative grid grid-cols-2 bg-surface-dim p-1 rounded-xl border border-white/10 shrink-0 self-start md:self-auto shadow-xs">
            <div 
              className="absolute top-1 bottom-1 rounded-lg kinetic-gradient transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform pointer-events-none"
              style={{
                width: 'calc(50% - 4px)',
                left: '4px',
                transform: `translateX(${assignmentViewMode === 'table' ? '0%' : '100%'})`
              }}
            />
            <button
              type="button"
              onClick={() => { haptic('TAP'); setAssignmentViewMode('table'); }}
              className={`relative z-10 flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer select-none active:scale-95 ${
                assignmentViewMode === 'table'
                  ? 'text-white'
                  : 'text-on-surface-dim hover:text-on-surface'
              }`}
            >
              <Table className="w-3.5 h-3.5 shrink-0" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => { haptic('TAP'); setAssignmentViewMode('card'); }}
              className={`relative z-10 flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-200 cursor-pointer select-none active:scale-95 ${
                assignmentViewMode === 'card'
                  ? 'text-white'
                  : 'text-on-surface-dim hover:text-on-surface'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>Card View</span>
            </button>
          </div>
        </div>

        {/* If Table View, show Task Tabs */}
        {assignmentViewMode === 'table' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = assignmentTableTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAssignmentTableTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-surface-lowest text-primary border-sky-400/40 shadow-sm'
                      : 'bg-surface-dim/60 text-on-surface-dim border-white/10 hover:border-white/20 hover:text-on-surface'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black ${
                    isActive ? 'bg-primary/20 text-primary border border-sky-400/30' : 'bg-surface/80 border border-white/10 text-on-surface-dim'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content rendering based on View Mode */}
        {assignmentViewMode === 'table' ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {assignmentTableTab === 'domestic' && renderDomesticTable()}
            {assignmentTableTab === 'jet' && selectedBriefingShift === 'Evening' && renderJetTransferTable()}
            {assignmentTableTab === 'daily' && (selectedBriefingShift === 'Morning' || selectedBriefingShift === 'Night') && renderDailyTable()}
            {assignmentTableTab === 'diesel' && selectedBriefingShift === 'Evening' && renderDieselTable()}
            {assignmentTableTab === 'stock' && selectedBriefingShift === 'Night' && renderStockTable()}
            {assignmentTableTab === 'all' && (
              <div className="space-y-8">
                {renderDomesticTable()}
                {selectedBriefingShift === 'Evening' && (
                  <>
                    <div className="border-t border-white/10 pt-6">
                      {renderDieselTable()}
                    </div>
                    <div className="border-t border-white/10 pt-6">
                      {renderJetTransferTable()}
                    </div>
                  </>
                )}
                {(selectedBriefingShift === 'Morning' || selectedBriefingShift === 'Night') && (
                  <div className="border-t border-white/10 pt-6">
                    {renderDailyTable()}
                  </div>
                )}
                {selectedBriefingShift === 'Night' && (
                  <div className="border-t border-white/10 pt-6">
                    {renderStockTable()}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-200">
            {renderDomesticSquadron()}
            {selectedBriefingShift === 'Evening' && renderJetTransferCard()}
            {selectedBriefingShift === 'Night' && renderStockCard()}
          </div>
        )}
      </div>
    );
  };


  const renderStaffSelect = (value: string, roles: UserRole[], label: string, onSelect: (id: string) => void) => {
    const roleUsers = activeStaff.filter(u => roles.includes(u.role));
    return (
      <div className="flex flex-col space-y-2">
        <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">{label}</label>
        <select 
          value={value}
          disabled={!canEdit}
          onChange={(e) => onSelect(e.target.value)}
          className={`bg-surface-dim border border-outline rounded-xl p-3 text-[13px] font-bold text-on-surface outline-none transition-colors appearance-none shadow-sm ${!canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer focus:border-primary'}`}
        >
          <option value="" className="bg-surface-dim text-on-surface">-- Unassigned --</option>
          {roleUsers.map(u => (
            <option key={u.id} value={u.id} className="bg-surface-dim text-on-surface">{u.name}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderStaffSelectArray = (values: string[], roles: UserRole[], label: string, dotColor: string, themeType: 'primary' | 'success' | 'warning', onUpdate: (newValues: string[]) => void) => {
    const roleUsers = activeStaff.filter(u => roles.includes(u.role));
    return (
      <div className="flex flex-col space-y-3">
        <div className="flex justify-between items-center mb-1">
           <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">{label}</label>
           {canEdit && (
             <button onClick={() => onUpdate([...values, ''])} className={`transition-all p-1 flex items-center space-x-1 rounded-md px-2 badge-custom-${themeType} hover:opacity-80`}>
               <Plus className="w-3 h-3" />
               <span className="text-[9px] font-bold uppercase tracking-wider">Add</span>
             </button>
           )}
         </div>
        {values.length === 0 ? (
          <div className="text-[10px] font-bold opacity-20 uppercase italic text-center py-4 border border-dashed border-outline rounded-xl">No {label.toLowerCase()} assigned</div>
        ) : values.map((val, idx) => (
          <div key={idx} className="flex flex-col bg-surface-dim border border-outline rounded-xl p-3 focus-within:border-primary/50 transition-colors">
            <div className="flex items-center space-x-3 w-full">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}></div>
              <select 
                value={val}
                disabled={!canEdit}
                onChange={(e) => {
                  const newVals = [...values];
                  newVals[idx] = e.target.value;
                  onUpdate(newVals);
                }}
                className={`bg-transparent text-[13px] font-bold text-on-surface outline-none appearance-none flex-1 py-2 ${!canEdit ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
              >
                <option value="" className="bg-surface-dim text-on-surface-dim italic">Select Staff...</option>
                {roleUsers.filter(u => !values.includes(u.id) || u.id === val).map(u => (
                  <option key={u.id} value={u.id} className="bg-surface-dim text-on-surface font-normal not-italic">{u.name}</option>
                ))}
              </select>
              {val && (
                <div className="relative inline-block shrink-0">
                  {(() => {
                    const currentStatus = staffStatuses[val];
                    const statusPreset = STAFF_STATUS_PRESETS.find(p => p.id === currentStatus);
                    const dropdownKey = `${label}-${val}-${idx}`;
                    
                    if (!statusPreset && !canEdit) return null;
                    
                    return (
                      <>
                        <button
                          disabled={!canEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownStaffId(activeDropdownStaffId === dropdownKey ? null : dropdownKey);
                          }}
                          className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider transition-all ${
                            statusPreset 
                              ? statusPreset.color 
                              : 'bg-surface-lowest border border-dashed border-outline text-on-surface-dim opacity-40 ' + (canEdit ? 'hover:opacity-100' : '')
                          } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {statusPreset ? statusPreset.label : '+ TAG'}
                        </button>
                        
                        {canEdit && activeDropdownStaffId === dropdownKey && (
                          <div 
                            className="absolute right-0 mt-1 bg-surface-lowest border border-outline rounded-2xl p-1 shadow-premium w-24 flex flex-col space-y-0.5 z-[100] animate-in fade-in slide-in-from-top-1 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STAFF_STATUS_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  setStaffStatuses(prev => ({ ...prev, [val]: preset.id }));
                                  setActiveDropdownStaffId(null);
                                }}
                                className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-center transition-all ${preset.color} hover:brightness-110 active:scale-95`}
                              >
                                {preset.label}
                              </button>
                            ))}
                            {currentStatus && (
                              <button
                                onClick={() => {
                                  setStaffStatuses(prev => {
                                    const next = { ...prev };
                                    delete next[val];
                                    return next;
                                  });
                                  setActiveDropdownStaffId(null);
                                }}
                                className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-center text-error hover:bg-error/10 active:scale-95 border border-transparent"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {canEdit && (
                <button 
                  onClick={() => {
                    const newVals = values.filter((_, i) => i !== idx);
                    onUpdate(newVals);
                  }}
                  className="p-2 text-error/40 hover:text-error hover:bg-error/10 rounded-lg transition-colors flex-shrink-0"
                  title="Remove Assignment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {val && roleUsers.some(u => u.id === val) && staffStatuses[val] === 'LATE' && (() => {
              const hist = historyMap.get(val);
              if (hist) {
                const domRank = getRankInRoles(val, roles, 'DOM');
                const dailyRank = getRankInRoles(val, roles, 'DAILY');
                const formattedDomDate = formatDateShort(hist.lastDomestic?.date);
                const formattedDailyDate = formatDateShort(hist.lastDaily?.date);
                const isHydrant = label === "Hydrant Officers";
                return (
                  <div className="text-[10px] font-black text-on-surface-dim opacity-75 mt-2 pl-5 border-t border-outline/20 pt-2 tracking-wider uppercase flex flex-wrap items-center gap-x-3 gap-y-1">
                    {!isHydrant && (
                      <>
                        <div>
                          DOM: <span className="text-on-surface font-[900]">{formattedDomDate}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black ml-1.5 badge-custom-${themeType}`}>{domRank}</span>
                        </div>
                        <div className="h-3.5 w-[1px] bg-outline/20 hidden sm:block"></div>
                      </>
                    )}
                    <div>
                      DAILY: <span className="text-on-surface font-[900]">{formattedDailyDate}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black ml-1.5 badge-custom-${themeType}`}>{dailyRank}</span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ))}
      </div>
    );
  };

  const renderStrategicBriefingPoints = () => {
    return (
      <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 relative overflow-hidden group w-full hover-glow-primary">
        <div className="flex items-center justify-between relative z-10 w-full">
          <div className="flex items-center space-x-5">
            <div className="p-4 badge-custom-primary rounded-2xl transition-all">
              <ClipboardList className="w-7 h-7" />
            </div>
            <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Strategic Briefing Points</h3>
          </div>
          {!isHistoricalView && canEdit && (
            <button 
              onClick={() => setAdditionalInfo([...additionalInfo, { text: '', type: 'standard' }])}
              className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all border border-primary/20 flex items-center space-x-2 px-4 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Add Point</span>
            </button>
          )}
        </div>
        
        <div className="space-y-6 relative z-10">
          {additionalInfo.map((info, i) => (
            <div key={i} className={`flex items-start space-x-3 sm:space-x-6 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] border transition-all duration-300 shadow-sm ${
              info.isHighAlert || info.type === 'critical'
              ? 'bg-error/5 border-error/20 text-on-surface ring-2 ring-error/10' 
              : 'bg-surface-dim border-outline text-on-surface hover:border-primary/30 hover:bg-surface-container'
            }`}>
              <div className={`mt-2 h-3 w-3 rounded-full flex-shrink-0 ${
                info.isHighAlert || info.type === 'critical'
                  ? 'bg-error shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse-subtle'
                  : 'bg-primary shadow-[0_0_15px_rgba(14,165,233,0.3)]'
              }`}></div>
              <div className="flex-1 space-y-2">
                <input 
                  type="text"
                  placeholder="Enter briefing directive..."
                  value={info.text}
                  readOnly={isHistoricalView || !canEdit}
                  onChange={(e) => {
                    if (isHistoricalView || !canEdit) return;
                    const newInfo = [...additionalInfo];
                    newInfo[i].text = e.target.value;
                    setAdditionalInfo(newInfo);
                  }}
                  className={`bg-transparent border-none focus:ring-0 p-0 m-0 w-full text-base font-bold placeholder:opacity-20 selection:bg-primary/20 text-on-surface ${isHistoricalView || !canEdit ? 'cursor-default' : ''}`}
                />
              </div>
              {!isHistoricalView && canEdit && (
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      const newInfo = [...additionalInfo];
                      newInfo[i].isHighAlert = !newInfo[i].isHighAlert;
                      setAdditionalInfo(newInfo);
                    }}
                    title="Toggle High Alert"
                    className={`p-2 rounded-lg transition-all ${info.isHighAlert ? 'bg-error text-white shadow-lg shadow-error/30' : 'bg-surface hover:bg-error/10 text-on-surface-dim hover:text-error opacity-40 hover:opacity-100'}`}
                  >
                    <Zap className={`w-4 h-4 ${info.isHighAlert ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={() => {
                      const newInfo = additionalInfo.filter((_, idx) => idx !== i);
                      setAdditionalInfo(newInfo);
                    }}
                    title="Deactivate Point"
                    className="p-2 bg-surface hover:bg-error/10 text-on-surface-dim hover:text-error rounded-lg opacity-40 hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {(info.isHighAlert || info.type === 'critical') && <AlertTriangle className="w-5 h-5 text-error opacity-40 flex-shrink-0" />}
                </div>
              )}
              {isHistoricalView && (info.isHighAlert || info.type === 'critical') && (
                <AlertTriangle className="w-5 h-5 text-error opacity-40 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getUserName = (id: string) => activeStaff.find(u => u.id === id)?.name || 'Unassigned';
  const isValidStaff = (id?: string) => !!id && id.trim() !== '' && activeStaff.some(u => u.id === id);

  const activeOperatorsCount = (staffAssignments.activeOperators || []).filter(isValidStaff).length;
  const activeOfficersCount = (staffAssignments.activeOfficers || []).filter(isValidStaff).length;
  const hydrantOpsOfficersCount = (staffAssignments.hydrantOpsOfficers || []).filter(isValidStaff).length;
  const staffingManagementCount = (staffAssignments.dutySupervisors || []).filter(isValidStaff).length + (staffAssignments.shiftInCharges || []).filter(isValidStaff).length;
  
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
    <div className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-10 animate-in fade-in duration-700 min-h-screen relative overflow-y-auto overflow-x-hidden custom-scrollbar transition-colors">
      
      {/* Dynamic Background Pulse */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-64 -mt-64 pointer-events-none"></div>

      {/* Tactical Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10 relative z-10">
        <div className="space-y-4 w-full">
          <div className="flex items-center space-x-5">
            <div className={`hidden sm:block text-white p-4 rounded-2xl shadow-premium transform hover:scale-110 transition-transform ${isHistoricalView ? 'bg-amber-500/80' : 'kinetic-gradient'}`}>
              <Shield className="w-8 h-8" />
            </div>
            <div className="w-full">
              <h1 className="headline-lg tracking-tighter mb-1 uppercase">
                SHIFT INFRASTRUCTURE <span className={`font-medium italic ${isHistoricalView ? 'text-amber-400' : 'text-primary'}`}>BRIEFING</span>
              </h1>
              {(isHistoricalView || isViewOnly) && (
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  {isHistoricalView ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/30">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">HISTORY MODE — READ ONLY</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/30">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">BRIEFING VIEW ONLY</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                {/* Shift Tabs */}
                <div className="bg-surface-dim p-1 rounded-xl border border-outline shadow-inner relative flex w-full md:w-fit overflow-hidden">
                  <div 
                    className={`absolute top-1 bottom-1 rounded-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
                      ${isHistoricalView ? 'bg-amber-500/70' : 'kinetic-gradient'}
                      ${selectedBriefingShift === 'Morning' ? 'left-1 w-[calc(33.33%-2px)] sm:w-[180px] translate-x-0' : ''}
                      ${selectedBriefingShift === 'Evening' ? 'left-1 w-[calc(33.33%-2px)] sm:w-[180px] translate-x-[100%] sm:translate-x-[180px]' : ''}
                      ${selectedBriefingShift === 'Night' ? 'left-1 w-[calc(33.33%-2px)] sm:w-[180px] translate-x-[200%] sm:translate-x-[360px]' : ''}
                    `}
                  />
                  {[
                    { id: 'Morning', label: 'Morning (07:30-16:00)' },
                    { id: 'Evening', label: 'Evening (15:00-23:30)' },
                    { id: 'Night', label: 'Night (22:30-08:30)' }
                  ].map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedBriefingShift(shift.id as any)}
                      className={`flex-1 sm:w-[180px] flex items-center justify-center py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
                        selectedBriefingShift === shift.id ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
                      }`}
                    >
                      <span className="hidden sm:inline">{shift.label}</span>
                      <span className="inline sm:hidden">{shift.id}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full md:w-auto">
                  {/* Date Picker */}
                  <div className={`relative flex items-center border rounded-xl shadow-inner focus-within:border-primary transition-colors flex-1 md:flex-none min-w-[200px] sm:min-w-[230px] px-3.5 py-2.5 cursor-pointer ${
                    isHistoricalView 
                      ? 'bg-amber-500/5 border-amber-500/30 focus-within:border-amber-500' 
                      : 'bg-surface-dim border-outline'
                  }`}>
                    <Calendar className={`w-4 h-4 mr-2.5 shrink-0 ${isHistoricalView ? 'text-amber-400' : 'text-primary'}`} />
                    <span className="text-[11px] font-black text-on-surface uppercase tracking-wider whitespace-nowrap">
                      {formatDateWithWeekday(selectedBriefingDate)}
                    </span>
                    <input 
                      type="date"
                      id="briefing-date-picker"
                      value={selectedBriefingDate}
                      max={todayStr}
                      onChange={(e) => setSelectedBriefingDate(e.target.value)}
                      onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>

                  {/* Return to Today button — shown only in history mode */}
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: Operations & Personnel */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* BRIEFING ATTENDANCE CARD (SUMMARY) */}
          <div className="card-premium p-5 sm:p-8 space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center space-x-4 min-w-0">
                <button
                  disabled={!canEdit}
                  onClick={() => {
                    setIsAttendanceModalOpen(true);
                  }}
                  className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                    !canEdit 
                      ? 'badge-custom-primary opacity-50 cursor-default' 
                      : 'badge-custom-primary hover:scale-105 active:scale-95 cursor-pointer'
                  }`}
                  title={canEdit ? "Mark Attendance" : "Attendance View Only"}
                >
                  <UserCheck className="w-6 h-6" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em] truncate">Briefing Attendance</h3>
                  <p className="text-[10px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-1 truncate">Manage shift briefing attendance</p>
                </div>
              </div>
            </div>

            {itpUniqueStaff.length === 0 ? (
              <div className="text-[10px] font-bold opacity-30 uppercase italic text-center py-6 border border-dashed border-outline rounded-2xl">
                Assign ITP staff above to track briefing attendance.
              </div>
            ) : (() => {
              const itpStaffList = itpUniqueStaff.map(id => activeStaff.find(u => u.id === id)).filter(Boolean);

              // Group assigned ITP staff
              const assignedOperators = itpStaffList.filter(u => u.role === UserRole.ITP_OPERATOR || u.role === UserRole.ITP_SUPERVISOR);
              const assignedOfficers = itpStaffList.filter(u => u.role === UserRole.ITP_OFFICER);
              const assignedHydrantOps = itpStaffList.filter(u => u.role === UserRole.ITP_HD_OPERATOR);
              const assignedManagement = itpStaffList.filter(u => u.role === UserRole.ITP_MANAGER || u.role === UserRole.ADMIN);

              const assignedOthers = itpStaffList.filter(u => 
                u.role !== UserRole.ITP_OPERATOR &&
                u.role !== UserRole.ITP_SUPERVISOR &&
                u.role !== UserRole.ITP_OFFICER &&
                u.role !== UserRole.ITP_HD_OPERATOR &&
                u.role !== UserRole.ITP_MANAGER &&
                u.role !== UserRole.ADMIN
              );

              // Group present count
              const presentOperators = assignedOperators.filter(u => attendees.includes(u.id)).length;
              const presentOfficers = assignedOfficers.filter(u => attendees.includes(u.id)).length;
              const presentHydrantOps = assignedHydrantOps.filter(u => attendees.includes(u.id)).length;
              const presentManagement = assignedManagement.filter(u => attendees.includes(u.id)).length;
              const presentOthers = assignedOthers.filter(u => attendees.includes(u.id)).length;

              const summaries = [
                { label: 'Operators', present: presentOperators, total: assignedOperators.length, theme: 'success' },
                { label: 'Officers', present: presentOfficers, total: assignedOfficers.length, theme: 'primary' },
                { label: 'Hydrant Ops', present: presentHydrantOps, total: assignedHydrantOps.length, theme: 'warning' },
                { label: 'Management', present: presentManagement, total: assignedManagement.length, theme: 'primary' }
              ];

              if (assignedOthers.length > 0) {
                summaries.push({ label: 'Other Staff', present: presentOthers, total: assignedOthers.length, theme: 'primary' });
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">
                      Present Staff ({itpPresentCount} of {itpUniqueStaff.length})
                    </span>
                    {itpUniqueStaff.length > 0 && (
                      <span className="text-[9px] font-bold text-success uppercase tracking-widest bg-success/10 border border-success/20 px-2.5 py-1.5 rounded-md">
                        {itpPresentCount === itpUniqueStaff.length ? 'ALL PRESENT' : 'PARTIAL ATTENDANCE'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
                    {summaries.map(s => {
                      if (s.total === 0) return null;
                      return (
                        <div key={s.label} className="bg-surface-dim border border-outline rounded-xl p-2.5 px-3 flex items-center justify-between sm:justify-start sm:space-x-2.5 shadow-sm min-w-0">
                          <span className="text-[9px] sm:text-[10px] font-black text-on-surface-dim uppercase tracking-wider truncate">{s.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-[900] border shrink-0 badge-custom-${s.theme}`}>
                            {s.present} of {s.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            {/* International Flights Card */}
            <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 group hover-glow-primary w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsIntlCollapsed(!isIntlCollapsed)}
                    className="p-3 badge-custom-primary rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isIntlCollapsed ? "Expand" : "Collapse"}
                  >
                    <Plane className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">
                    {isSidebarCollapsed ? 'International Ops' : 'INT OPS'}
                  </h3>
                </div>
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="badge-custom-primary px-4 py-1.5 rounded-full text-[10px] font-black">{intlFlightsToRender.length}</span>
                    {frozenFlights && canEdit && (
                      <button
                        onClick={handleResetFlights}
                        className="p-1.5 bg-error/10 text-error border border-error rounded-full hover:bg-error hover:text-white transition-all shrink-0 flex items-center justify-center cursor-pointer"
                        title="Reset frozen flights to live feed"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!isIntlCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {intlFlightsToRender.map((job) => (
                    <div key={job.id} className="flex flex-col p-5 bg-surface-dim border border-outline rounded-3xl group/item hover:bg-surface-container hover:border-sky-400/30 transition-all cursor-default shadow-sm hover:shadow-md w-full">
                      <div className="flex justify-between items-center w-full mb-1">
                        <div className="flex items-center space-x-2">
                          <div className="text-base font-black tracking-tight text-on-surface">{job.flightNumber}</div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteFlightFromBriefing('intl', job.id)}
                              className="p-1 text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                              title="Remove flight from briefing"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {renderStatusBadge(job.status)}
                      </div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">
                        {getIntlFlightTimeLabel(job)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Domestic Flights Card */}
            <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 group hover-glow-primary w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsDomesticCollapsed(!isDomesticCollapsed)}
                    className="p-3 badge-custom-primary rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isDomesticCollapsed ? "Expand" : "Collapse"}
                  >
                    <Activity className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">
                    {isSidebarCollapsed ? 'Domestic Ops' : 'DOM OPS'}
                  </h3>
                </div>
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="badge-custom-primary px-4 py-1.5 rounded-full text-[10px] font-black">{domesticFlightsToRender.length}</span>
                    {frozenFlights && canEdit && (
                      <button
                        onClick={handleResetFlights}
                        className="p-1.5 bg-error/10 text-error border border-error rounded-full hover:bg-error hover:text-white transition-all shrink-0 flex items-center justify-center cursor-pointer"
                        title="Reset frozen flights to live feed"
                      >
                        <Snowflake className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!isDomesticCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {domesticFlightsToRender.map((flight) => (
                    <div key={flight.id} className="flex flex-col p-5 bg-surface-dim border border-outline rounded-3xl group/item hover:bg-surface-container hover:border-sky-400/30 transition-all cursor-default shadow-sm hover:shadow-md w-full">
                      <div className="flex justify-between items-center w-full mb-1">
                        <div className="flex items-center space-x-2">
                          <div className="text-base font-black tracking-tight text-on-surface">{flight.flightNumber}</div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteFlightFromBriefing('domestic', flight.id)}
                              className="p-1 text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                              title="Remove flight from briefing"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {renderStatusBadge(flight.status)}
                      </div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">
                        {getDomesticFlightTimeLabel(flight)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ad-Hoc Flights Card */}
            <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 group hover-glow-warning w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsAdhocCollapsed(!isAdhocCollapsed)}
                    className="p-3 badge-custom-warning rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isAdhocCollapsed ? "Expand" : "Collapse"}
                  >
                    <Zap className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Ad-Hoc Flights</h3>
                </div>
                <div className="flex items-center space-x-2.5">
                  {canEdit && (
                    <button
                      onClick={() => setIsAddAdhocModalOpen(true)}
                      className="transition-all p-1 flex items-center justify-center rounded-md px-2.5 badge-custom-warning hover:opacity-80 cursor-pointer shrink-0"
                      title="Add Ad-Hoc Flight"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className="badge-custom-warning px-4 py-1.5 rounded-full text-[10px] font-black">{adhocFlightsToRender.length}</span>
                </div>
              </div>
              {!isAdhocCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {adhocFlightsToRender.map((flight) => (
                    <div key={flight.id} className="flex flex-col p-5 bg-surface-dim border border-outline rounded-3xl group/item hover:bg-surface-container hover:border-amber-500/30 transition-all cursor-default shadow-sm hover:shadow-md w-full">
                      <div className="flex justify-between items-center w-full mb-1">
                        <div className="flex items-center space-x-2">
                          <div className="text-base font-black tracking-tight text-on-surface">{flight.flightNumber}</div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteFlightFromBriefing('adhoc', flight.id)}
                              className="p-1 text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer"
                              title="Remove flight from briefing"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {renderStatusBadge(flight.status)}
                      </div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">
                        DEP: {flight.std || '--:--'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PERSONNEL SECTOR: Split into 4 Separate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Active Operators Card */}
            <div className={`card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-success relative ${activeDropdownStaffId?.startsWith('Operators') ? 'z-50' : 'z-10'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsOperatorsCollapsed(!isOperatorsCollapsed)}
                    className="p-3 badge-custom-success rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isOperatorsCollapsed ? "Expand" : "Collapse"}
                  >
                    <Users className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Operators</h3>
                </div>
                <span className="badge-custom-success px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{activeOperatorsCount} STAFF</span>
              </div>
              {!isOperatorsCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.activeOperators, [UserRole.ITP_OPERATOR], "Operators", "bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]", 'success', (newVals) => handleStaffAssignmentsUpdate(prev => ({...prev, activeOperators: newVals})))}
                </div>
              )}
            </div>

            {/* Active Officers Card */}
            <div className={`card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary relative ${activeDropdownStaffId?.startsWith('Officers') ? 'z-50' : 'z-10'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsOfficersCollapsed(!isOfficersCollapsed)}
                    className="p-3 badge-custom-primary rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isOfficersCollapsed ? "Expand" : "Collapse"}
                  >
                    <Shield className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Officers</h3>
                </div>
                <span className="badge-custom-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{activeOfficersCount} STAFF</span>
              </div>
              {!isOfficersCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.activeOfficers, [UserRole.ITP_OFFICER], "Officers", "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]", 'primary', (newVals) => handleStaffAssignmentsUpdate(prev => ({...prev, activeOfficers: newVals})))}
                </div>
              )}
            </div>

            {/* Hydrant Ops Officers Card */}
            <div className={`card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-warning relative ${activeDropdownStaffId?.startsWith('Hydrant Officers') ? 'z-50' : 'z-10'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsHydrantCollapsed(!isHydrantCollapsed)}
                    className="p-3 badge-custom-warning rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isHydrantCollapsed ? "Expand" : "Collapse"}
                  >
                    <Droplet className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Hydrant Ops Officers</h3>
                </div>
                <span className="badge-custom-warning px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{hydrantOpsOfficersCount} STAFF</span>
              </div>
              {!isHydrantCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.hydrantOpsOfficers, [UserRole.ITP_HD_OPERATOR], "Hydrant Officers", "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]", 'warning', (newVals) => handleStaffAssignmentsUpdate(prev => ({...prev, hydrantOpsOfficers: newVals})))}
                </div>
              )}
            </div>

            {/* Supervisors & Managers Card */}
            <div className={`card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary relative ${
              (activeDropdownStaffId?.startsWith('Duty Supervisor') || activeDropdownStaffId?.startsWith('Shift In-Charge')) ? 'z-50' : 'z-10'
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setIsStaffingCollapsed(!isStaffingCollapsed)}
                    className="p-3 badge-custom-primary rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                    title={isStaffingCollapsed ? "Expand" : "Collapse"}
                  >
                    <UserCheck className="w-6 h-6" />
                  </button>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Staffing Management</h3>
                </div>
                <span className="badge-custom-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">
                  {staffingManagementCount} STAFF
                </span>
              </div>
              {!isStaffingCollapsed && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(
                    staffAssignments.dutySupervisors || [],
                    [UserRole.ITP_SUPERVISOR],
                    "Duty Supervisor",
                    "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]",
                    'primary',
                    (newVals) => handleStaffAssignmentsUpdate(prev => ({ ...prev, dutySupervisors: newVals }))
                  )}
                  {renderStaffSelectArray(
                    staffAssignments.shiftInCharges || [],
                    [UserRole.ITP_MANAGER],
                    "Shift In-Charge",
                    "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]",
                    'primary',
                    (newVals) => handleStaffAssignmentsUpdate(prev => ({ ...prev, shiftInCharges: newVals }))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block w-full space-y-6 sm:space-y-8">
            {renderStrategicBriefingPoints()}
            {renderOperationalAssignmentsSection()}
          </div>
        </div>

        {/* RIGHT COLUMN: Equipment & Remarks (Separated from Staffing) */}
        <div className="col-span-12 lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Equipment Readiness (Fleet Status) */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 group max-w-md mx-auto lg:max-w-none w-full hover-glow-primary">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
              <div className="flex items-center space-x-5">
                <button 
                  onClick={() => setIsFleetCollapsed(!isFleetCollapsed)}
                  className="p-4 badge-custom-primary rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                  title={isFleetCollapsed ? "Expand" : "Collapse"}
                >
                  <Truck className="w-7 h-7" />
                </button>
                <div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Fleet Status (RF/HD)</h3>
                  <p className="text-[9px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-0.5">
                    {selectedBriefingShift === 'Evening' ? 'Diesel Refueling Duty' : 'Daily Safety Inspections'}
                  </p>
                </div>
              </div>

              {!isHistoricalView && canEdit && (
                <button
                  onClick={() => handleAutoAssignFleet()}
                  disabled={isAutoAssigningFleet}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl active:scale-95 transition-all flex items-center space-x-1.5 border border-amber-500/30 cursor-pointer shrink-0 shadow-none"
                  title={selectedBriefingShift === 'Evening' ? 'Auto-assign evening diesel refueling personnel' : 'Auto-assign daily equipment safety inspectors'}
                >
                  <Zap className={`w-3.5 h-3.5 ${isAutoAssigningFleet ? 'animate-spin' : ''}`} />
                  <span className="text-[9px] font-black uppercase tracking-wider">
                    {isAutoAssigningFleet ? 'Assigning...' : selectedBriefingShift === 'Evening' ? 'Auto Diesel' : 'Auto Daily'}
                  </span>
                </button>
              )}
            </div>

            {!isFleetCollapsed && (
              <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2 duration-200">
                {rfHdEquipment.map((eq) => {
                  const needsDiesel = dieselNeeds.includes(eq.id);

                  return (
                    <div key={eq.id} className="bg-surface-dim border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 group/eq hover:bg-surface-container hover:border-sky-400/30 transition-all cursor-default shadow-sm hover:shadow-md">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-[14px] font-[900] text-on-surface">{eq.id}</span>
                            <div className={`text-[10px] font-black uppercase tracking-widest opacity-80 ${
                              eq.status === EquipmentStatus.AVAILABLE   ? 'text-success' :
                              eq.status === EquipmentStatus.IN_USE       ? 'text-primary' :
                              eq.status === EquipmentStatus.REFUELLING   ? 'text-warning' :
                              'text-error'
                            }`}>{eq.status}</div>
                          </div>
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            eq.status === EquipmentStatus.AVAILABLE
                              ? 'bg-success animate-pulse-subtle shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                              : eq.status === EquipmentStatus.IN_USE
                              ? 'bg-primary animate-pulse-subtle shadow-[0_0_10px_rgba(86,200,235,0.4)]'
                              : eq.status === EquipmentStatus.REFUELLING
                              ? 'bg-warning animate-pulse-subtle shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                              : 'bg-error shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                          }`}></div>
                        </div>
                        
                        {selectedBriefingShift === 'Evening' ? (
                          <button 
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              const newDieselNeeds = dieselNeeds.includes(eq.id) 
                                ? dieselNeeds.filter(id => id !== eq.id) 
                                : [...dieselNeeds, eq.id];
                              
                              setDieselNeeds(newDieselNeeds);
                              const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
                              updateBriefingInfo(additionalInfo, newDieselNeeds, {
                                ...staffAssignments,
                                attendees,
                                staffStatuses,
                                dailyCompleted,
                                domesticTeams,
                                equipmentAssignments,
                                dieselAssignments,
                                stockAssignment,
                                jetTransfer,
                                frozenFlights: existingFrozen !== undefined ? existingFrozen : {
                                  intl: intlFlightsToRender,
                                  domestic: domesticFlightsToRender,
                                  adhoc: adhocFlightsToRender
                                }
                              });
                            }}
                            className={`w-full flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                              needsDiesel 
                              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent' 
                              : 'bg-surface border-white/10 text-on-surface-dim opacity-50 ' + (canEdit ? 'hover:opacity-100 hover:border-amber-500/30' : 'cursor-default')
                            }`}
                          >
                            <Droplet className={`w-3 h-3 ${needsDiesel ? 'animate-bounce' : ''}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">DIESEL</span>
                          </button>
                        ) : (
                          (() => {
                            const isDailyCompleted = dailyCompleted.includes(eq.id) || (selectedBriefingShift === 'Morning' && Boolean(nightCarriedDailyAssignments[eq.id]?.op1 || nightCarriedDailyAssignments[eq.id]?.op2));
                            const isLockedFromNight = selectedBriefingShift === 'Morning' && Boolean(nightCarriedDailyAssignments[eq.id]?.op1 || nightCarriedDailyAssignments[eq.id]?.op2);
                            return (
                              <button 
                                disabled={!canEdit || isLockedFromNight}
                                onClick={() => {
                                  if (!canEdit || isLockedFromNight) return;
                                  const newDailyCompleted = dailyCompleted.includes(eq.id) 
                                    ? dailyCompleted.filter(id => id !== eq.id) 
                                    : [...dailyCompleted, eq.id];
                                  
                                  setDailyCompleted(newDailyCompleted);
                                  const existingFrozenDaily = briefingInfo?.staffAssignments?.frozenFlights;
                                  updateBriefingInfo(additionalInfo, dieselNeeds, {
                                    ...staffAssignments,
                                    attendees,
                                    staffStatuses,
                                    dailyCompleted: newDailyCompleted,
                                    domesticTeams,
                                    equipmentAssignments,
                                    dieselAssignments,
                                    stockAssignment,
                                    jetTransfer,
                                    frozenFlights: existingFrozenDaily !== undefined ? existingFrozenDaily : {
                                      intl: intlFlightsToRender,
                                      domestic: domesticFlightsToRender,
                                      adhoc: adhocFlightsToRender
                                    }
                                  });
                                }}
                                className={`w-full flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                                  isDailyCompleted 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-transparent' 
                                  : 'bg-surface border-white/10 text-on-surface-dim opacity-50 ' + (canEdit ? 'hover:opacity-100 hover:border-warning/30' : 'cursor-default')
                                }`}
                              >
                                <UserCheck className="w-3 h-3 shrink-0" />
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider truncate">
                                  DAILY: {isDailyCompleted ? 'COMPLETED' : 'PENDING'}
                                </span>
                              </button>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Strategic Briefing Points & Operational Assignments (Mobile Only) */}
          <div className="block lg:hidden w-full space-y-6 sm:space-y-8">
            {renderStrategicBriefingPoints()}
            {renderOperationalAssignmentsSection()}
          </div>

          {/* Ongoing Tasks & Remarks (Separated into its own space) */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 group max-w-md mx-auto lg:max-w-none w-full hover-glow-primary">
            <div className="flex items-center space-x-5">
              <div className="p-4 badge-custom-primary rounded-2xl transition-all">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Task Remarks</h3>
            </div>
            <textarea 
              value={remarks}
              readOnly={!canEdit}
              onChange={(e) => {
                if (canEdit) setRemarks(e.target.value);
              }}
              className={`w-full bg-surface-dim border border-outline rounded-2xl sm:rounded-[32px] p-4 sm:p-8 text-[15px] font-bold text-on-surface opacity-80 focus:border-primary focus:bg-surface-container outline-none min-h-[220px] resize-none transition-all shadow-inner focus:shadow-md ${!canEdit ? 'cursor-default focus:border-outline' : ''}`}
              placeholder="Enter comprehensive shift remarks here..."
            />
          </div>

        </div>
      </div>

      {canEdit ? (
        <div className="flex justify-center pt-8 border-t border-outline relative z-10">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-command px-12 py-5 rounded-3xl shadow-premium group hover:scale-[1.02] active:scale-95 bg-primary text-white transition-all font-black uppercase tracking-widest text-[11px] flex items-center justify-center space-x-3 w-full sm:w-auto"
          >
            <Save className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
            {isSaving ? 'ARCHIVING OPS DATA...' : 'AUTHORIZE & COMMIT'}
          </button>
        </div>
      ) : !isHistoricalView ? (
        <div className="flex justify-center pt-8 border-t border-outline relative z-10">
          <div className="flex items-center space-x-3 px-6 py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Shift Briefing View Only (ITP Staff)</span>
          </div>
        </div>
      ) : null}
      {isHistoricalView && (
        <div className="flex items-center justify-center gap-4 pt-8 border-t border-outline relative z-10">
          <div className="flex items-center space-x-3 px-6 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">Viewing Historical Record — {formattedBriefingDate}</span>
          </div>
          <button
            onClick={() => setSelectedBriefingDate(todayStr)}
            className="flex items-center space-x-2 px-6 py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-2xl text-primary transition-all"
          >
            <Clock className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-widest">Return to Today</span>
          </button>
        </div>
      )}

      {/* Attendance Modal */}
      {isAttendanceModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-surface-lowest/70 backdrop-blur-md transition-opacity" 
            onClick={() => setIsAttendanceModalOpen(false)}
          ></div>
          
          {/* Modal content */}
          <div className="card-premium p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col space-y-6 relative z-10 shadow-2xl border border-outline scale-in-center animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-outline pb-4 shrink-0">
              <div>
                <h2 className="text-base font-black uppercase tracking-widest text-on-surface">Mark Briefing Attendance</h2>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1.5">
                  Date: {formattedBriefingDate} | Shift: {selectedBriefingShift}
                </p>
              </div>
              <button 
                onClick={() => setIsAttendanceModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-lg text-on-surface-dim hover:text-on-surface transition-colors border border-outline/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6 custom-scrollbar">
              {itpUniqueStaff.length === 0 ? (
                <div className="text-[11px] font-bold opacity-40 uppercase italic text-center py-12 border border-dashed border-outline rounded-3xl">
                  No ITP staff assigned to this shift yet. Please make assignments above before logging attendance.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Assigned Shift Personnel</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {itpUniqueStaff.map((id) => {
                      const user = activeStaff.find(u => u.id === id);
                      if (!user) return null;
                      const isPresent = attendees.includes(id);
                      
                      return (
                        <div 
                          key={id} 
                          onClick={() => {
                            if (isPresent) {
                              setAttendees(prev => prev.filter(att => att !== id));
                            } else {
                              setAttendees(prev => [...prev, id]);
                            }
                          }}
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${
                            isPresent 
                              ? 'bg-success/5 border-success/30 hover:border-success/50 hover:bg-success/10' 
                              : 'bg-surface-dim border-outline hover:border-outline-active hover:bg-surface-container'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-surface-lowest border border-outline flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {user.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[12px] font-black text-on-surface truncate uppercase tracking-tight">{user.name}</p>
                              <p className="text-[8px] font-bold text-on-surface-dim opacity-50 uppercase tracking-wider truncate">{user.role.replace('_', ' ')}</p>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            isPresent 
                              ? 'bg-success border-success text-white' 
                              : 'border-outline text-transparent'
                          }`}>
                            <UserCheck className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-outline shrink-0">
              <button 
                onClick={() => setIsAttendanceModalOpen(false)}
                className="px-6 py-3 border border-outline rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-surface-dim transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const existingFrozenAttendance = briefingInfo?.staffAssignments?.frozenFlights;
                  const frozenToSave = existingFrozenAttendance ? existingFrozenAttendance : {
                    intl: intlFlightsToRender,
                    domestic: domesticFlightsToRender,
                    adhoc: []
                  };
                  await updateBriefingInfo(additionalInfo, dieselNeeds, {
                    ...staffAssignments,
                    attendees,
                    staffStatuses,
                    dailyCompleted,
                    domesticTeams,
                    equipmentAssignments,
                    frozenFlights: frozenToSave,
                    adhocFlights: adhocFlightsToRender
                  });
                  notify('Attendance log updated successfully!', 'success');
                  setIsAttendanceModalOpen(false);
                }}
                className="btn-command px-6 py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Attendance Log</span>
                <span className="inline sm:hidden">Save</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Unfreeze Confirmation Modal */}
      {isUnfreezeConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-surface-lowest/70 backdrop-blur-md transition-opacity" 
            onClick={() => setIsUnfreezeConfirmOpen(false)}
          ></div>
          
          {/* Modal content */}
          <div className="card-premium p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl border border-outline scale-in-center animate-in fade-in zoom-in duration-200 flex flex-col space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center space-x-3 text-error">
              <div className="p-2 bg-error/10 border border-error/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-on-surface">Unfreeze Live Feed?</h2>
            </div>

            {/* Modal Body */}
            <div className="text-[11px] text-on-surface-dim uppercase tracking-wider leading-relaxed">
              Are you sure you want to unfreeze/reset flights to the live FIDS feed? This will load any newly updated departures.
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center space-x-3 pt-2">
              <button
                onClick={() => setIsUnfreezeConfirmOpen(false)}
                className="px-4 py-2.5 bg-surface-dim hover:bg-surface-container text-on-surface-dim hover:text-on-surface border border-outline rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetFlights}
                className="px-4 py-2.5 bg-error hover:bg-error/80 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-error/20"
              >
                Yes, Unfreeze
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Add Ad-hoc Flight Modal */}
      <AddAdhocFlightModal
        isOpen={isAddAdhocModalOpen}
        onClose={() => setIsAddAdhocModalOpen(false)}
        onAdd={handleAddAdhocFlight}
        notify={notify}
      />
    </div>
  );
};


