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
  Snowflake
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { MOCK_USERS, MOCK_ADHOC_FLIGHTS, EQUIPMENT } from '../constants';
import { User, UserRole, EquipmentType, EquipmentStatus } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useOperationalData, BriefingShift } from '../context/OperationalDataContext';

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
    domesticFlights
  } = useOperationalData();
  const activeStaff = staff && staff.length > 0 ? staff : MOCK_USERS;
  const canDelete = user?.role && [UserRole.ITP_MANAGER, UserRole.ADMIN].includes(user.role);

  const staffHistory = [
    { staffId: 'u3', lastDomestic: { date: '2026-06-09', shift: 'Morning', team: 'Team 1' }, lastDaily: { date: '2026-06-09', shift: 'Morning' }},
    { staffId: 'u3b', lastDomestic: { date: '2026-06-08', shift: 'Evening', team: 'Team 2' }, lastDaily: { date: '2026-06-09', shift: 'Morning' }},
    { staffId: 'u7', lastDomestic: { date: '2026-06-08', shift: 'Morning', team: 'Team 1' }, lastDaily: { date: '2026-06-08', shift: 'Night' }},
    { staffId: 'u1', lastDomestic: { date: '2026-06-07', shift: 'Night', team: 'Team 3' }, lastDaily: { date: '2026-06-08', shift: 'Evening' }},
    { staffId: 'u2', lastDomestic: { date: '2026-06-07', shift: 'Morning', team: 'Team 2' }, lastDaily: { date: '2026-06-07', shift: 'Morning' }},
  ];

  const sortHistory = (a: any, b: any) => {
    // 1. Date ascending (oldest date first / ranked 1)
    const dateComp = a.lastDomestic.date.localeCompare(b.lastDomestic.date);
    if (dateComp !== 0) return dateComp;
    
    // 2. Shift weight ascending (Morning=1 < Evening=2 < Night=3)
    const shiftWeight = (s: string) => s === 'Morning' ? 1 : s === 'Evening' ? 2 : 3;
    const shiftComp = shiftWeight(a.lastDomestic.shift) - shiftWeight(b.lastDomestic.shift);
    if (shiftComp !== 0) return shiftComp;

    // 3. Team weight ascending (Team 1=1 < Team 2=2 < Team 3=3)
    const teamWeight = (t: string) => t === 'Team 1' ? 1 : t === 'Team 2' ? 2 : 3;
    return teamWeight(a.lastDomestic.team || '') - teamWeight(b.lastDomestic.team || '');
  };

  const sortDailyHistory = (a: any, b: any) => {
    // 1. Date ascending (oldest date first / ranked 1)
    const dateComp = a.lastDaily.date.localeCompare(b.lastDaily.date);
    if (dateComp !== 0) return dateComp;
    
    // 2. Shift weight ascending (Morning=1 < Evening=2 < Night=3)
    const shiftWeight = (s: string) => s === 'Morning' ? 1 : s === 'Evening' ? 2 : 3;
    return shiftWeight(a.lastDaily.shift) - shiftWeight(b.lastDaily.shift);
  };

  const rankedStaffList = [...staffHistory].sort(sortHistory);
  const rankedDailyStaffList = [...staffHistory].sort(sortDailyHistory);

  const getRankInRoles = (staffId: string, roles: UserRole[], type: 'DOM' | 'DAILY') => {
    // 1. Get all staff members who have one of the compatible roles
    const compatibleStaffIds = activeStaff
      .filter(u => roles.includes(u.role))
      .map(u => u.id);

    // 2. Filter staffHistory to only include these compatible staff
    const filteredHistory = staffHistory.filter(h => compatibleStaffIds.includes(h.staffId));

    // 3. Sort them using the appropriate sorting function
    if (type === 'DOM') {
      const sorted = [...filteredHistory].sort(sortHistory);
      const rankIdx = sorted.findIndex(h => h.staffId === staffId);
      return rankIdx !== -1 ? rankIdx + 1 : '-';
    } else {
      const sorted = [...filteredHistory].sort(sortDailyHistory);
      const rankIdx = sorted.findIndex(h => h.staffId === staffId);
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
    const range = shiftRanges[selectedBriefingShift];
    if (range.crossesMidnight) {
      return dep >= range.start || dep <= range.end;
    }
    return dep >= range.start && dep <= range.end;
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
    if (!status) return 'bg-surface border border-white/10 text-on-surface-dim';
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
    return 'bg-surface border border-white/10 text-on-surface-dim';
  };

  const frozenFlights = briefingInfo?.staffAssignments?.frozenFlights;

  const intlFlightsToRender = frozenFlights?.intl 
    ? frozenFlights.intl.map((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const liveJob = (flightJobs || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        return liveJob ? { ...ff, status: liveJob.status } : ff;
      }).filter((f: any) => f.status !== 'COMPLETED' && f.status !== 'IN_PROGRESS' && f.status?.toUpperCase() !== 'CANCELLED')
    : (flightJobs || []).filter(f => {
        const isDep = f.type ? f.type === 'departure' : !!f.std;
        return isDep && isFlightInShift(f.std) && f.date === selectedBriefingDate && f.status !== 'COMPLETED' && f.status !== 'IN_PROGRESS' && f.status?.toUpperCase() !== 'CANCELLED';
      }).sort((a, b) => (a.std || '').localeCompare(b.std || ''));

  const domesticFlightsToRender = frozenFlights?.domestic 
    ? frozenFlights.domestic.map((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const liveJob = (domesticFlights || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        return liveJob ? { ...ff, status: liveJob.status } : ff;
      }).filter((f: any) => f.status !== 'COMPLETED' && f.status !== 'IN_PROGRESS' && f.status?.toUpperCase() !== 'CANCELLED')
    : (domesticFlights || []).filter(f => f.type === 'departure' && isFlightInShift(f.std) && f.date === selectedBriefingDate && f.status !== 'COMPLETED' && f.status !== 'IN_PROGRESS' && f.status?.toUpperCase() !== 'CANCELLED')
      .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));

  const adhocFlightsToRender = briefingInfo?.staffAssignments?.adhocFlights !== undefined
    ? briefingInfo.staffAssignments.adhocFlights
    : MOCK_ADHOC_FLIGHTS.filter(f => isFlightInShift(f.sta || f.std) && (!f.date || f.date === selectedBriefingDate));

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
  const [isIntlCollapsed, setIsIntlCollapsed] = useState(false);
  const [isDomesticCollapsed, setIsDomesticCollapsed] = useState(false);
  const [isAdhocCollapsed, setIsAdhocCollapsed] = useState(false);

  // Collapse states for other cards
  const [isOperatorsCollapsed, setIsOperatorsCollapsed] = useState(false);
  const [isOfficersCollapsed, setIsOfficersCollapsed] = useState(false);
  const [isHydrantCollapsed, setIsHydrantCollapsed] = useState(false);
  const [isStaffingCollapsed, setIsStaffingCollapsed] = useState(false);
  const [isFleetCollapsed, setIsFleetCollapsed] = useState(false);
  const [isAttendanceCollapsed, setIsAttendanceCollapsed] = useState(false);

  // Add Ad-Hoc Flight modal states
  const [isAddAdhocModalOpen, setIsAddAdhocModalOpen] = useState(false);
  const [adhocFlightNumber, setAdhocFlightNumber] = useState('');
  const [adhocEta, setAdhocEta] = useState('');
  const [adhocStd, setAdhocStd] = useState('');
  const [adhocStand, setAdhocStand] = useState('F10');
  const [adhocReg, setAdhocReg] = useState('8Q-ADH');
  const [adhocType, setAdhocType] = useState('B737');

  const todayStr = new Date().toISOString().split('T')[0];
  const isHistoricalView = selectedBriefingDate < todayStr;

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
    dutySupervisor: string;
    shiftInCharge: string;
    attendees?: string[];
    dailyCompleted?: string[];
    frozenFlights?: {
      intl?: any[];
      domestic?: any[];
      adhoc?: any[];
    } | null;
    adhocFlights?: any[];
  }

  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>(briefingInfo?.staffAssignments || {
    activeOperators: ['u3b'],
    activeOfficers: ['u3'],
    hydrantOpsOfficers: ['u7'],
    dutySupervisor: 'u2',
    shiftInCharge: 'u11'
  });

  const [attendees, setAttendees] = useState<string[]>(briefingInfo?.staffAssignments?.attendees || []);

  const uniqueStaff = Array.from(new Set([
    ...staffAssignments.activeOperators,
    ...staffAssignments.activeOfficers,
    ...staffAssignments.hydrantOpsOfficers,
    staffAssignments.dutySupervisor,
    staffAssignments.shiftInCharge
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
        setStaffAssignments(briefingInfo.staffAssignments);
        setAttendees(briefingInfo.staffAssignments.attendees || []);
        setDailyCompleted(briefingInfo.staffAssignments.dailyCompleted || []);
      } else {
        setAttendees([]);
        setDailyCompleted([]);
      }
    }
  }, [briefingInfo]);



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
        dailyCompleted,
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
        dailyCompleted,
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
          dailyCompleted,
          adhocFlights: updatedAdhoc
        });
      } else {
        await updateBriefingInfo(additionalInfo, dieselNeeds, {
          ...staffAssignments,
          attendees,
          dailyCompleted,
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

  const handleAddAdhocFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adhocFlightNumber.trim()) return;

    const newAdhoc = {
      id: `ah-custom-${Date.now()}`,
      flightNumber: adhocFlightNumber.trim(),
      eta: adhocEta || '---',
      std: adhocStd || '---',
      sta: adhocEta || '---',
      route: 'MLE',
      stand: adhocStand || '---',
      status: 'PENDING',
      isAdhoc: true,
      aircraftReg: adhocReg || '---',
      aircraftType: adhocType || '---',
      date: selectedBriefingDate
    };

    const updatedAdhoc = [...adhocFlightsToRender, newAdhoc];

    setIsSaving(true);
    try {
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        dailyCompleted,
        adhocFlights: updatedAdhoc
      });
      notify('Ad-hoc flight added successfully!', 'success');
      setIsAddAdhocModalOpen(false);
      setAdhocFlightNumber('');
      setAdhocEta('');
      setAdhocStd('');
      setAdhocStand('F10');
      setAdhocReg('8Q-ADH');
      setAdhocType('B737');
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


  const renderStaffSelect = (value: string, roles: UserRole[], label: string, onSelect: (id: string) => void) => {
    const roleUsers = activeStaff.filter(u => roles.includes(u.role));
    return (
      <div className="flex flex-col space-y-2">
        <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">{label}</label>
        <select 
          value={value}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-surface-dim border border-outline rounded-xl p-3 text-[13px] font-bold text-on-surface outline-none focus:border-primary transition-colors cursor-pointer appearance-none shadow-sm"
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
           <button onClick={() => onUpdate([...values, ''])} className={`transition-all p-1 flex items-center space-x-1 rounded-md px-2 badge-custom-${themeType} hover:opacity-80`}>
             <Plus className="w-3 h-3" />
             <span className="text-[9px] font-bold uppercase tracking-wider">Add</span>
           </button>
         </div>
        {values.length === 0 ? (
          <div className="text-[10px] font-bold opacity-20 uppercase italic text-center py-4 border border-dashed border-outline rounded-xl">No {label.toLowerCase()} assigned</div>
        ) : values.map((val, idx) => (
          <div key={idx} className="flex flex-col bg-surface-dim border border-outline rounded-xl p-3 focus-within:border-primary/50 transition-colors">
            <div className="flex items-center space-x-3 w-full">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}></div>
              <select 
                value={val}
                onChange={(e) => {
                  const newVals = [...values];
                  newVals[idx] = e.target.value;
                  onUpdate(newVals);
                }}
                className="bg-transparent text-[13px] font-bold text-on-surface outline-none cursor-pointer appearance-none flex-1 py-2"
              >
                <option value="" className="bg-surface-dim text-on-surface-dim italic">Select Staff...</option>
                {roleUsers.map(u => (
                  <option key={u.id} value={u.id} className="bg-surface-dim text-on-surface font-normal not-italic">{u.name}</option>
                ))}
              </select>
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
            </div>
            {val && roleUsers.some(u => u.id === val) && (() => {
              const hist = staffHistory.find(h => h.staffId === val);
              if (hist) {
                const domRank = getRankInRoles(val, roles, 'DOM');
                const dailyRank = getRankInRoles(val, roles, 'DAILY');
                const formattedDomDate = formatDateShort(hist.lastDomestic.date);
                const formattedDailyDate = formatDateShort(hist.lastDaily.date);
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
          {!isHistoricalView && (
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
                  readOnly={isHistoricalView}
                  onChange={(e) => {
                    if (isHistoricalView) return;
                    const newInfo = [...additionalInfo];
                    newInfo[i].text = e.target.value;
                    setAdditionalInfo(newInfo);
                  }}
                  className={`bg-transparent border-none focus:ring-0 p-0 m-0 w-full text-base font-bold placeholder:opacity-20 selection:bg-primary/20 text-on-surface ${isHistoricalView ? 'cursor-default' : ''}`}
                />
              </div>
              {!isHistoricalView && (
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
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center space-x-2 px-3 py-1 bg-surface-dim rounded-full border border-outline">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{formattedBriefingDate} | {currentTime}</span>
                </div>
                {isHistoricalView ? (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/10 rounded-full border border-amber-500/30">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">HISTORY MODE — READ ONLY</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 bg-success/10 rounded-full border border-success/20">
                    <div className="dot-live"></div>
                    <span className="hidden sm:inline text-[10px] font-black text-success uppercase tracking-widest ml-1">SYSTEMS ACTIVE</span>
                  </div>
                )}
              </div>
              
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

                {/* Date Picker */}
                <div className={`relative flex items-center border rounded-xl shadow-inner focus-within:border-primary transition-colors w-full md:w-auto ${
                  isHistoricalView 
                    ? 'bg-amber-500/5 border-amber-500/30 focus-within:border-amber-500' 
                    : 'bg-surface-dim border-outline'
                }`}>
                  <Calendar className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none shrink-0 ${isHistoricalView ? 'text-amber-400' : 'text-primary'}`} />
                  <input 
                    type="date"
                    id="briefing-date-picker"
                    value={selectedBriefingDate}
                    max={todayStr}
                    onChange={(e) => setSelectedBriefingDate(e.target.value)}
                    onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                    className="bg-transparent text-[11px] font-black text-on-surface outline-none cursor-pointer w-full md:w-auto min-w-[130px] pl-9 pr-3 py-2"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                {/* Return to Today button — shown only in history mode */}
                {isHistoricalView && (
                  <button
                    onClick={() => setSelectedBriefingDate(todayStr)}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-amber-400 transition-all shrink-0"
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

      <div className="grid grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: Operations & Personnel */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* BRIEFING ATTENDANCE CARD (SUMMARY) */}
          <div className="card-premium p-5 sm:p-8 space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center space-x-4 min-w-0">
                <button
                  onClick={() => {
                    setIsAttendanceModalOpen(true);
                  }}
                  className="p-3 badge-custom-primary rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                  title="Mark Attendance"
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
                { label: 'Operators', present: presentOperators, total: assignedOperators.length },
                { label: 'Officers', present: presentOfficers, total: assignedOfficers.length },
                { label: 'Hydrant Ops', present: presentHydrantOps, total: assignedHydrantOps.length },
                { label: 'Management', present: presentManagement, total: assignedManagement.length }
              ];

              if (assignedOthers.length > 0) {
                summaries.push({ label: 'Other Staff', present: presentOthers, total: assignedOthers.length });
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
                  <div className="flex flex-wrap gap-3">
                    {summaries.map(s => {
                      if (s.total === 0) return null;
                      return (
                        <div key={s.label} className="bg-surface-dim border border-outline rounded-xl p-3 px-4 flex items-center space-x-2.5 shadow-sm">
                          <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">{s.label}</span>
                          <span className="text-xs font-black text-on-surface bg-surface-lowest px-2 py-0.5 rounded-md border border-outline/50">
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
                    {frozenFlights && (
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
                        <div className={`whitespace-nowrap text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${getBriefingStatusStyle(job.status)}`}>
                          {job.status.replace('_', ' ')}
                        </div>
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
                    {frozenFlights && (
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
                        <div className={`whitespace-nowrap text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${getBriefingStatusStyle(flight.status)}`}>
                          {flight.status.replace('_', ' ')}
                        </div>
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
                  <button
                    onClick={() => setIsAddAdhocModalOpen(true)}
                    className="transition-all p-1 flex items-center justify-center rounded-md px-2.5 badge-custom-warning hover:opacity-80 cursor-pointer shrink-0"
                    title="Add Ad-Hoc Flight"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
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
                        <div className={`whitespace-nowrap text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${getBriefingStatusStyle(flight.status)}`}>
                          {flight.status.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">
                        ETA: {flight.eta} • DEP: {flight.std}
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
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-success">
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
                <span className="badge-custom-success px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{staffAssignments.activeOperators.length} STAFF</span>
              </div>
              {!isOperatorsCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.activeOperators, [UserRole.ITP_OPERATOR], "Operators", "bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]", 'success', (newVals) => setStaffAssignments(prev => ({...prev, activeOperators: newVals})))}
                </div>
              )}
            </div>

            {/* Active Officers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary">
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
                <span className="badge-custom-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{staffAssignments.activeOfficers.length} STAFF</span>
              </div>
              {!isOfficersCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.activeOfficers, [UserRole.ITP_OFFICER], "Officers", "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]", 'primary', (newVals) => setStaffAssignments(prev => ({...prev, activeOfficers: newVals})))}
                </div>
              )}
            </div>

            {/* Hydrant Ops Officers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-warning">
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
                <span className="badge-custom-warning px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">{staffAssignments.hydrantOpsOfficers.length} STAFF</span>
              </div>
              {!isHydrantCollapsed && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelectArray(staffAssignments.hydrantOpsOfficers, [UserRole.ITP_HD_OPERATOR], "Hydrant Officers", "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]", 'warning', (newVals) => setStaffAssignments(prev => ({...prev, hydrantOpsOfficers: newVals})))}
                </div>
              )}
            </div>

            {/* Supervisors & Managers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full hover-glow-primary">
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
                <span className="badge-custom-primary px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap shrink-0">2 STAFF</span>
              </div>
              {!isStaffingCollapsed && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                  {renderStaffSelect(staffAssignments.dutySupervisor, [UserRole.ITP_MANAGER, UserRole.ITP_SUPERVISOR], "Duty Supervisor", (id) => setStaffAssignments(prev => ({ ...prev, dutySupervisor: id })))}
                  {/* Manager or Shift In-Charge selection - using ITP_MANAGER role */}
                  {renderStaffSelect(staffAssignments.shiftInCharge, [UserRole.ITP_MANAGER, UserRole.ITP_SUPERVISOR], "Shift In-Charge", (id) => setStaffAssignments(prev => ({ ...prev, shiftInCharge: id })))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:block w-full">
            {renderStrategicBriefingPoints()}
          </div>
        </div>

        {/* RIGHT COLUMN: Equipment & Remarks (Separated from Staffing) */}
        <div className="col-span-12 lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Equipment Readiness (Fleet Status) */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 group max-w-md mx-auto lg:max-w-none w-full hover-glow-primary">
            <div className="flex items-center space-x-5">
              <button 
                onClick={() => setIsFleetCollapsed(!isFleetCollapsed)}
                className="p-4 badge-custom-primary rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                title={isFleetCollapsed ? "Expand" : "Collapse"}
              >
                <Truck className="w-7 h-7" />
              </button>
              <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Fleet Status (RF/HD)</h3>
            </div>
            {!isFleetCollapsed && (
              <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2 duration-200">
                {rfHdEquipment.map((eq) => {
                  const needsDiesel = dieselNeeds.includes(eq.id);
                  return (
                    <div key={eq.id} className="bg-surface-dim border border-outline rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 group/eq hover:bg-surface-container hover:border-sky-400/30 transition-all cursor-default shadow-sm hover:shadow-md">
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
                          onClick={() => {
                            const newDieselNeeds = dieselNeeds.includes(eq.id) 
                              ? dieselNeeds.filter(id => id !== eq.id) 
                              : [...dieselNeeds, eq.id];
                            
                            setDieselNeeds(newDieselNeeds);
                            const existingFrozen = briefingInfo?.staffAssignments?.frozenFlights;
                            updateBriefingInfo(additionalInfo, newDieselNeeds, {
                              ...staffAssignments,
                              attendees,
                              dailyCompleted,
                              frozenFlights: existingFrozen !== undefined ? existingFrozen : {
                                intl: intlFlightsToRender,
                                domestic: domesticFlightsToRender,
                                adhoc: adhocFlightsToRender
                              }
                            });
                          }}
                          className={`flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                            needsDiesel 
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent' 
                            : 'bg-surface border-outline text-on-surface-dim opacity-40 hover:opacity-100 hover:border-amber-500/30'
                          }`}
                        >
                          <Droplet className={`w-3 h-3 ${needsDiesel ? 'animate-bounce' : ''}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest">DIESEL</span>
                        </button>
                      ) : (
                        (() => {
                          const isDailyCompleted = dailyCompleted.includes(eq.id);
                          return (
                            <button 
                              onClick={() => {
                                const newDailyCompleted = dailyCompleted.includes(eq.id) 
                                  ? dailyCompleted.filter(id => id !== eq.id) 
                                  : [...dailyCompleted, eq.id];
                                
                                setDailyCompleted(newDailyCompleted);
                                const existingFrozenDaily = briefingInfo?.staffAssignments?.frozenFlights;
                                updateBriefingInfo(additionalInfo, dieselNeeds, {
                                  ...staffAssignments,
                                  attendees,
                                  dailyCompleted: newDailyCompleted,
                                  frozenFlights: existingFrozenDaily !== undefined ? existingFrozenDaily : {
                                    intl: intlFlightsToRender,
                                    domestic: domesticFlightsToRender,
                                    adhoc: adhocFlightsToRender
                                  }
                                });
                              }}
                              className={`flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                                isDailyCompleted 
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border-transparent' 
                                : 'bg-surface border-outline text-on-surface-dim opacity-40 hover:opacity-100 hover:border-warning/30'
                              }`}
                            >
                              <UserCheck className="w-3 h-3 shrink-0" />
                              <span className="text-[9px] font-black uppercase tracking-widest truncate">
                                DAILY: {isDailyCompleted ? 'COMPLETED' : 'PENDING'}
                              </span>
                            </button>
                          );
                        })()
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Strategic Briefing Points (Mobile Only) */}
          <div className="block lg:hidden w-full">
            {renderStrategicBriefingPoints()}
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
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-surface-dim border border-outline rounded-2xl sm:rounded-[32px] p-4 sm:p-8 text-[15px] font-bold text-on-surface opacity-80 focus:border-primary focus:bg-surface-container outline-none min-h-[220px] resize-none transition-all shadow-inner focus:shadow-md"
              placeholder="Enter comprehensive shift remarks here..."
            />
          </div>

        </div>
      </div>

      {/* AUTHORIZE & COMMIT BUTTON — hidden in history mode */}
      {!isHistoricalView && (
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
      )}
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
                    dailyCompleted,
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
      {isAddAdhocModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-surface-lowest/70 backdrop-blur-md transition-opacity" 
            onClick={() => setIsAddAdhocModalOpen(false)}
          ></div>
          <div className="card-premium p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl border border-outline scale-in-center animate-in fade-in zoom-in duration-200 flex flex-col space-y-6">
            <div className="flex justify-between items-start border-b border-outline pb-4 shrink-0">
              <div>
                <h2 className="text-base font-black uppercase tracking-widest text-on-surface">Add Ad-Hoc Flight</h2>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1.5">
                  Input details for the ad-hoc flight
                </p>
              </div>
              <button 
                onClick={() => setIsAddAdhocModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded-lg text-on-surface-dim hover:text-on-surface transition-colors border border-outline/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdhocFlight} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Flight Number *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. AH 001"
                  value={adhocFlightNumber}
                  onChange={(e) => setAdhocFlightNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">ETA (Time)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 14:30"
                    value={adhocEta}
                    onChange={(e) => setAdhocEta(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">DEP / STD (Time)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 15:30"
                    value={adhocStd}
                    onChange={(e) => setAdhocStd(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Stand</label>
                  <input 
                    type="text"
                    placeholder="F10"
                    value={adhocStand}
                    onChange={(e) => setAdhocStand(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Reg</label>
                  <input 
                    type="text"
                    placeholder="8Q-ADH"
                    value={adhocReg}
                    onChange={(e) => setAdhocReg(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Type</label>
                  <input 
                    type="text"
                    placeholder="B737"
                    value={adhocType}
                    onChange={(e) => setAdhocType(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddAdhocModalOpen(false)}
                  className="px-4 py-2.5 bg-surface-dim hover:bg-surface-container text-on-surface-dim hover:text-on-surface border border-outline rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-warning text-slate-950 hover:bg-warning-hover rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-warning/20 disabled:opacity-50"
                >
                  {isSaving ? 'Adding...' : 'Add Flight'}
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


