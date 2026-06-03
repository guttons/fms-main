import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { MOCK_USERS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS, EQUIPMENT } from '../constants';
import { User, UserRole, EquipmentType, EquipmentStatus } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useOperationalData } from '../context/OperationalDataContext';

export const ShiftBriefing: React.FC = () => {
  const { notify } = useNotification();
  const { 
    equipment, 
    briefingInfo, 
    updateBriefingInfo, 
    selectedBriefingShift, 
    setSelectedBriefingShift, 
    staff,
    selectedBriefingDate,
    setSelectedBriefingDate
  } = useOperationalData();
  const activeStaff = staff && staff.length > 0 ? staff : MOCK_USERS;
  const [isSaving, setIsSaving] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

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
  }

  const [staffAssignments, setStaffAssignments] = useState<StaffAssignments>(briefingInfo?.staffAssignments || {
    activeOperators: ['u3', 'u3b'],
    activeOfficers: ['u1'],
    hydrantOpsOfficers: ['u7'],
    dutySupervisor: 'u2',
    shiftInCharge: 'u2b'
  });

  const [attendees, setAttendees] = useState<string[]>(briefingInfo?.staffAssignments?.attendees || []);

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

  const [ongoingTasks, setOngoingTasks] = useState({
    int: 'Preparing for morning wave of arrivals',
    dom: '3 teams active for Dash-8 operations',
    adhoc: 'No adhoc requests currently',
    vvip: 'VVIP flight expected at 14:00'
  });

  const [remarks, setRemarks] = useState('Safety first. Ensure all grounding cables are checked before each operation.');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBriefingInfo(additionalInfo, dieselNeeds, {
        ...staffAssignments,
        attendees,
        dailyCompleted
      });
      notify('Shift briefing saved successfully!', 'success');
    } catch (error) {
      console.error("Failed to save shift briefing:", error);
      notify('Failed to save shift briefing.', 'error');
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
          <option value="" className="bg-surface-container">-- Unassigned --</option>
          {roleUsers.map(u => (
            <option key={u.id} value={u.id} className="bg-surface-container">{u.name}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderStaffSelectArray = (values: string[], roles: UserRole[], label: string, dotColor: string, onUpdate: (newValues: string[]) => void) => {
    const roleUsers = activeStaff.filter(u => roles.includes(u.role));
    return (
      <div className="flex flex-col space-y-3">
        <div className="flex justify-between items-center mb-1">
           <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">{label}</label>
           <button onClick={() => onUpdate([...values, ''])} className="text-primary hover:text-primary/70 transition-colors p-1 flex items-center space-x-1 border border-primary/20 rounded-md px-2 bg-primary/5">
             <Plus className="w-3 h-3" />
             <span className="text-[9px] font-bold uppercase tracking-wider">Add</span>
           </button>
        </div>
        {values.length === 0 ? (
          <div className="text-[10px] font-bold opacity-20 uppercase italic text-center py-4 border border-dashed border-outline rounded-xl">No {label.toLowerCase()} assigned</div>
        ) : values.map((val, idx) => (
          <div key={idx} className="flex items-center space-x-3 bg-surface-dim border border-outline rounded-xl p-2 pl-4 focus-within:border-primary/50 transition-colors">
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
              <option value="" className="bg-surface-container text-on-surface-dim italic">Select Staff...</option>
              {roleUsers.map(u => (
                <option key={u.id} value={u.id} className="bg-surface-container text-on-surface font-normal not-italic">{u.name}</option>
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
        ))}
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
                <div className={`flex items-center space-x-3 border rounded-xl p-2.5 shadow-inner focus-within:border-primary transition-colors w-full md:w-auto ${
                  isHistoricalView 
                    ? 'bg-amber-500/5 border-amber-500/30 focus-within:border-amber-500' 
                    : 'bg-surface-dim border-outline'
                }`}>
                  <Calendar className={`w-4 h-4 shrink-0 ${isHistoricalView ? 'text-amber-400' : 'text-primary'}`} />
                  <input 
                    type="date"
                    id="briefing-date-picker"
                    value={selectedBriefingDate}
                    max={todayStr}
                    onChange={(e) => setSelectedBriefingDate(e.target.value)}
                    className="bg-transparent text-[11px] font-black text-on-surface outline-none cursor-pointer w-full md:w-auto min-w-[130px]"
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
            {/* International Flights Card */}
            <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 group hover:border-primary/20 max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors">
                    <Plane className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">International Ops</h3>
                </div>
                <span className="bg-surface-dim px-4 py-1.5 rounded-full text-[10px] font-black opacity-40 group-hover:opacity-100 transition-opacity">{MOCK_JOBS.length} UNITS</span>
              </div>
              <div className="space-y-4">
                {MOCK_JOBS.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-5 bg-surface-dim border border-outline rounded-3xl group/item hover:bg-surface-container hover:border-primary/20 transition-all cursor-default shadow-sm hover:shadow-md">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-[20px] kinetic-gradient text-white flex items-center justify-center font-black text-base shadow-lg group-hover/item:scale-105 transition-transform">
                        {job.stand}
                      </div>
                      <div>
                        <div className="text-base font-black tracking-tight text-on-surface">{job.flightNumber}</div>
                        <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">{job.aircraftType}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${
                      job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/10' : 
                      job.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500 animate-pulse-subtle border border-amber-500/10' : 'bg-on-surface/5 opacity-40 border border-transparent'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Domestic Flights Card */}
            <div className="card-premium p-5 sm:p-8 space-y-6 sm:space-y-8 group hover:border-primary/20 max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Domestic Ops</h3>
                </div>
                <span className="bg-surface-dim px-4 py-1.5 rounded-full text-[10px] font-black opacity-40">ACTIVE STREAM</span>
              </div>
              <div className="space-y-4">
                {MOCK_DOMESTIC_FLIGHTS.slice(0, 4).map((flight) => (
                  <div key={flight.id} className="flex items-center justify-between p-5 bg-surface-dim border border-outline rounded-3xl group/item hover:bg-surface-container hover:border-primary/20 transition-all cursor-default shadow-sm hover:shadow-md">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-[20px] kinetic-gradient text-white flex items-center justify-center font-black text-base shadow-lg group-hover/item:scale-105 transition-transform">
                        {flight.stand}
                      </div>
                      <div>
                        <div className="text-base font-black tracking-tight text-on-surface">{flight.flightNumber}</div>
                        <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">ETA: {flight.eta}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${
                      flight.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/10' : 
                      flight.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500 animate-pulse-subtle border border-amber-500/10' : 'bg-on-surface/5 opacity-40 border border-transparent'
                    }`}>
                      {flight.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PERSONNEL SECTOR: Split into 4 Separate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
            {/* Active Operators Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-success/5 rounded-xl">
                    <Users className="w-6 h-6 text-success" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Operators</h3>
                </div>
                <span className="bg-surface-dim border border-outline px-3 py-1 rounded-full text-[10px] font-black opacity-60 group-hover:opacity-100 transition-opacity">{staffAssignments.activeOperators.length} STAFF</span>
              </div>
              {renderStaffSelectArray(staffAssignments.activeOperators, [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.DEPOT_OPERATOR], "Operators", "bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]", (newVals) => setStaffAssignments(prev => ({...prev, activeOperators: newVals})))}
            </div>

            {/* Active Officers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/5 rounded-xl">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Officers</h3>
                </div>
                <span className="bg-surface-dim border border-outline px-3 py-1 rounded-full text-[10px] font-black opacity-60 group-hover:opacity-100 transition-opacity">{staffAssignments.activeOfficers.length} STAFF</span>
              </div>
              {renderStaffSelectArray(staffAssignments.activeOfficers, [UserRole.ITP_OFFICER, UserRole.ADMIN], "Officers", "bg-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]", (newVals) => setStaffAssignments(prev => ({...prev, activeOfficers: newVals})))}
            </div>

            {/* Hydrant Ops Officers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-amber-500/5 rounded-xl">
                    <Droplet className="w-6 h-6 text-amber-500" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Hydrant Ops Officers</h3>
                </div>
                <span className="bg-surface-dim border border-outline px-3 py-1 rounded-full text-[10px] font-black opacity-60 group-hover:opacity-100 transition-opacity">{staffAssignments.hydrantOpsOfficers.length} STAFF</span>
              </div>
              {renderStaffSelectArray(staffAssignments.hydrantOpsOfficers, [UserRole.ITP_OFFICER, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OPERATOR], "Hydrant Officers", "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]", (newVals) => setStaffAssignments(prev => ({...prev, hydrantOpsOfficers: newVals})))}
            </div>

            {/* Supervisors & Managers Card */}
            <div className="card-premium p-5 sm:p-8 space-y-4 sm:space-y-6 group max-w-md mx-auto md:max-w-none w-full">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/5 rounded-xl">
                    <UserCheck className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Staffing Management</h3>
                </div>
                <span className="bg-surface-dim border border-outline px-3 py-1 rounded-full text-[10px] font-black opacity-60 group-hover:opacity-100 transition-opacity">2 STAFF</span>
              </div>
              <div className="space-y-6">
                {renderStaffSelect(staffAssignments.dutySupervisor, [UserRole.ITP_MANAGER], "Duty Supervisor", (id) => setStaffAssignments(prev => ({ ...prev, dutySupervisor: id })))}
                {/* Manager or Incharge will be same - using ITP_MANAGER role for Shift In-Charge selection */}
                {renderStaffSelect(staffAssignments.shiftInCharge, [UserRole.ITP_MANAGER, UserRole.DEPOT_MANAGER], "Shift In-Charge", (id) => setStaffAssignments(prev => ({ ...prev, shiftInCharge: id })))}
              </div>
            </div>
          </div>

          {/* BRIEFING ATTENDANCE CARD (SUMMARY) */}
          <div className="card-premium p-5 sm:p-8 space-y-6 group max-w-md mx-auto md:max-w-none w-full">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/5 rounded-xl">
                  <UserCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Briefing Attendance</h3>
                  <p className="text-[10px] text-on-surface-dim opacity-50 uppercase tracking-widest mt-1">Manage shift briefing attendance</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsAttendanceModalOpen(true)}
                className="p-2.5 bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 rounded-xl flex items-center space-x-2 px-4 shadow-sm"
              >
                <UserCheck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Mark Attendance</span>
              </button>
            </div>

            {(() => {
              const uniqueStaff = Array.from(new Set([
                ...staffAssignments.activeOperators,
                ...staffAssignments.activeOfficers,
                ...staffAssignments.hydrantOpsOfficers,
                staffAssignments.dutySupervisor,
                staffAssignments.shiftInCharge
              ].filter(Boolean)));

              const presentCount = uniqueStaff.filter(id => attendees.includes(id)).length;

              if (uniqueStaff.length === 0) {
                return (
                  <div className="text-[10px] font-bold opacity-30 uppercase italic text-center py-6 border border-dashed border-outline rounded-2xl">
                    Assign staff above to track briefing attendance.
                  </div>
                );
              }

              const presentUsers = uniqueStaff
                .map(id => activeStaff.find(u => u.id === id))
                .filter(Boolean)
                .filter(u => attendees.includes(u!.id));

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider">
                      Present Staff ({presentCount} of {uniqueStaff.length})
                    </span>
                    <span className="text-[9px] font-bold text-success uppercase tracking-widest bg-success/10 border border-success/20 px-2 py-1 rounded-md">
                      {uniqueStaff.length > 0 && presentCount === uniqueStaff.length ? 'ALL PRESENT' : 'PARTIAL ATTENDANCE'}
                    </span>
                  </div>

                  {presentUsers.length === 0 ? (
                    <div className="text-[10px] font-bold opacity-30 uppercase italic text-center py-4 border border-dashed border-outline rounded-xl">
                      No staff marked present yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {presentUsers.map((user: any) => (
                        <div 
                          key={user.id} 
                          className="flex items-center space-x-2 bg-surface-dim border border-outline rounded-xl p-2 px-3"
                          title={`${user.name} (${user.role.replace('_', ' ')})`}
                        >
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-5 h-5 rounded-md object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-md bg-surface-lowest border border-outline flex items-center justify-center font-bold text-[9px] uppercase">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-[11px] font-black text-on-surface uppercase tracking-tight truncate max-w-[100px]">{user.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Tactical Briefing Points */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 relative overflow-hidden group max-w-5xl mx-auto lg:mx-0 w-full">
            <div className="flex items-center justify-between relative z-10 w-full">
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-primary/5 rounded-2xl">
                  <ClipboardList className="w-7 h-7 text-primary" />
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
        </div>

        {/* RIGHT COLUMN: Equipment & Remarks (Separated from Staffing) */}
        <div className="col-span-12 lg:col-span-4 space-y-6 sm:space-y-8">
          
          {/* Equipment Readiness (Fleet Status) */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 group max-w-md mx-auto lg:max-w-none w-full">
            <div className="flex items-center space-x-5">
              <div className="p-4 bg-primary/5 rounded-2xl">
                <Truck className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Fleet Status (RF/HD)</h3>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {rfHdEquipment.map((eq) => {
                const needsDiesel = dieselNeeds.includes(eq.id);
                return (
                  <div key={eq.id} className="bg-surface-dim border border-outline rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 group/eq hover:bg-surface-container hover:border-primary/20 transition-all cursor-default shadow-sm hover:shadow-md">
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
                          updateBriefingInfo(additionalInfo, newDieselNeeds, {
                            ...staffAssignments,
                            attendees,
                            dailyCompleted
                          });
                        }}
                        className={`flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                          needsDiesel 
                          ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20' 
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
                              updateBriefingInfo(additionalInfo, dieselNeeds, {
                                ...staffAssignments,
                                attendees,
                                dailyCompleted: newDailyCompleted
                              });
                            }}
                            className={`flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                              isDailyCompleted 
                              ? 'bg-success text-white border-success-600 shadow-lg shadow-success-500/20' 
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
          </div>

          {/* Ongoing Tasks & Remarks (Separated into its own space) */}
          <div className="card-premium p-5 sm:p-10 space-y-6 sm:space-y-10 group max-w-md mx-auto lg:max-w-none w-full">
            <div className="flex items-center space-x-5">
              <div className="p-4 bg-primary/5 rounded-2xl">
                <MessageSquare className="w-7 h-7 text-primary" />
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
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              {(() => {
                const uniqueStaff = Array.from(new Set([
                  ...staffAssignments.activeOperators,
                  ...staffAssignments.activeOfficers,
                  ...staffAssignments.hydrantOpsOfficers,
                  staffAssignments.dutySupervisor,
                  staffAssignments.shiftInCharge
                ].filter(Boolean)));

                if (uniqueStaff.length === 0) {
                  return (
                    <div className="text-[11px] font-bold opacity-40 uppercase italic text-center py-12 border border-dashed border-outline rounded-3xl">
                      No staff assigned to this shift yet. Please make assignments above before logging attendance.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">Assigned Shift Personnel</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {uniqueStaff.map((id) => {
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
                );
              })()}
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
                  await updateBriefingInfo(additionalInfo, dieselNeeds, {
                    ...staffAssignments,
                    attendees,
                    dailyCompleted
                  });
                  notify('Attendance log updated successfully!', 'success');
                  setIsAttendanceModalOpen(false);
                }}
                className="btn-command px-6 py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Attendance Log</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};


