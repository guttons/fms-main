
import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar, ComposedChart
} from 'recharts';
import { MOCK_ALERTS, MOCK_USERS, MOCK_ADHOC_FLIGHTS } from '../constants';
import { FuelType, Tank, User, UserRole, FlightJob, Equipment, EquipmentStatus as EqStatus, EquipmentType } from '../types';
import { AlertTriangle, AlertOctagon, TrendingDown, TrendingUp, Activity, Droplet, Users, Clock, Plane, LayoutDashboard, MapPin, CheckCircle, Truck, Play, Thermometer, CloudSun, Wind, RefreshCw, Send, Globe, Anchor, ShoppingBag, Database, Eye, ChevronRight, ChevronDown } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { equipmentBadgeClass, equipmentDotClass, equipmentBadgeSoftClass } from '../utils/equipmentColors';
import { TankStatusGrid } from './TankStatusGrid';

// Mock Data for Charts
const HOURLY_DATA_INT = [
  { hour: '06:00', flights: 2, volume: 15000 },
  { hour: '08:00', flights: 5, volume: 45000 },
  { hour: '10:00', flights: 8, volume: 72000 },
  { hour: '12:00', flights: 6, volume: 54000 },
  { hour: '14:00', flights: 10, volume: 90000 },
  { hour: '16:00', flights: 12, volume: 108000 },
  { hour: '18:00', flights: 9, volume: 81000 },
];

const HOURLY_DATA_DOM = [
  { hour: '06:00', flights: 4, volume: 12000 },
  { hour: '08:00', flights: 7, volume: 21000 },
  { hour: '10:00', flights: 12, volume: 36000 },
  { hour: '12:00', flights: 10, volume: 30000 },
  { hour: '14:00', flights: 15, volume: 45000 },
  { hour: '16:00', flights: 13, volume: 39000 },
  { hour: '18:00', flights: 8, volume: 24000 },
];

const HOURLY_DATA = [
  { hour: '06:00', jetA1: 4000, diesel: 200, flights: 2 },
  { hour: '08:00', jetA1: 12000, diesel: 500, flights: 5 },
  { hour: '10:00', jetA1: 25000, diesel: 300, flights: 8 },
  { hour: '12:00', jetA1: 18000, diesel: 400, flights: 6 },
  { hour: '14:00', jetA1: 32000, diesel: 600, flights: 10 },
  { hour: '16:00', jetA1: 45000, diesel: 500, flights: 12 },
  { hour: '18:00', jetA1: 28000, diesel: 300, flights: 9 },
];

const FLIGHT_PERFORMANCE = [
  { name: 'On Time', value: 85, color: '#22c55e' },
  { name: 'Delayed', value: 10, color: '#f59e0b' },
  { name: 'Critical', value: 5, color: '#ef4444' },
];

interface DashboardProps {
  user: User;
  setActiveView: (view: string) => void;
  onStartJob?: (job: FlightJob, vehicleId?: string) => void;
  onSelectEquipment?: (eqId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, setActiveView, onStartJob, onSelectEquipment }) => {
  const { tanks = [], equipment = [], briefingInfo, flightJobs = [], domesticFlights = [], alerts = [], createAlert, acknowledgeAlert, staff = [], updateEquipmentStatus, domesticAssignments, selectedBriefingShift, serviceTankId, selectedBriefingDate, flightLogs = [] } = useOperationalData();
  const { notify } = useNotification();
  // Logic to determine initial view and if switching is allowed

  // Logic to determine initial view and if switching is allowed
  const isItpManager = user?.role === UserRole.ITP_MANAGER;
  const isItpOperator = user ? [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(user.role) : false;
  const isDualRole = user ? [UserRole.ADMIN, UserRole.EXECUTIVE].includes(user.role) : false;
  const isDepotRole = user ? [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(user.role) : false;
  
  const [viewMode, setViewMode] = useState<'ITP' | 'DEPOT'>(isDepotRole ? 'DEPOT' : 'ITP');
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [isAssetsCollapsed, setIsAssetsCollapsed] = useState(false);

  const userAlerts = (alerts || []).filter(a => {
    if (!user) return false;

    // Targeted request/no-fuel alerts: only visible to assigned operator/officer, or supervisors
    const msgLower = (a.message || '').toLowerCase();
    const isRequestAlert = msgLower.includes('alert requested') || msgLower.includes('no fuel');
    if (isRequestAlert && ![UserRole.ADMIN, UserRole.ITP_MANAGER].includes(user.role)) {
      const isDomestic = (domesticFlights || []).some(df => msgLower.includes((df.flightNumber || '').toLowerCase()));
      if (isDomestic) {
        const isUserInDomesticTeam = (domesticAssignments || []).some(da => da.op1 === user.id || da.op2 === user.id);
        if (!isUserInDomesticTeam) return false;
      } else {
        const hasOperator = msgLower.includes('(operator:');
        const hasOfficer = msgLower.includes('(officer:');
        const hasName = msgLower.includes(user.name.toLowerCase());
        if ((hasOperator || hasOfficer) && !hasName) return false;
      }
    }

    if (isDualRole) return true;
    if (a.targetRole === user.role) return true;
    if (isDepotRole && [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(a.targetRole as UserRole)) return true;
    return !a.targetRole;
  });

  const [myDomesticTeam, setMyDomesticTeam] = useState<any>(null);
  const [myEquipment, setMyEquipment] = useState<any>(null);
  const [shiftBriefingInfo, setShiftBriefingInfo] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [allEquipmentAssignments, setAllEquipmentAssignments] = useState<any[]>([]);
  const [allDomesticAssignments, setAllDomesticAssignments] = useState<any[]>([]);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [selectedEquipments, setSelectedEquipments] = useState<Record<string, string>>({});

  const [completedAllocationIds, setCompletedAllocationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`fms_completed_allocations_${user?.id || ''}`);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const handleCompleteAllocation = (id: string) => {
    const updated = [...completedAllocationIds, id];
    setCompletedAllocationIds(updated);
    try {
      localStorage.setItem(`fms_completed_allocations_${user?.id || ''}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save completed allocation", e);
    }
    notify("Shift allocation marked as completed.", "success");
  };

  // Rotation timer for dashboard cards (5 categories for Uplift)
  useEffect(() => {
    const interval = setInterval(() => {
      setRotationIndex(prev => (prev + 1) % 5);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isDelayed = (sta?: string, eta?: string) => {
    if (!sta || !eta) return false;
    return eta > sta;
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        
        // Fetch ALL assignments for Manager/Admin oversight
        const domesticData = await supabaseService.getDomesticAssignments(todayDate);
        const dailyEq = await supabaseService.getEquipmentAssignments(todayDate, 'DAILY');
        const dieselEq = await supabaseService.getEquipmentAssignments(todayDate, 'DIESEL');
        
        setAllDomesticAssignments(domesticData || []);
        setAllEquipmentAssignments([...(dailyEq || []), ...(dieselEq || [])]);

        if (isItpOperator) {
          // Filter for current user specific tasks
          const myTeam = domesticData?.find(d => d.operator1_id === user.id || d.operator2_id === user.id);
          if (myTeam) setMyDomesticTeam(myTeam);

          const allEq = [...(dailyEq || []), ...(dieselEq || [])];
          const myEqs = allEq.filter(d => d.operator1_id === user.id || d.operator2_id === user.id);
          if (myEqs.length > 0) setMyEquipment(myEqs);
        }
      } catch (error) {
        console.error("Error fetching assignments", error);
      }
    };
    fetchAssignments();
  }, [isItpOperator, user.id, viewMode, briefingInfo]);



  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await acknowledgeAlert(id);
    } catch (error) {
      console.error("Failed to acknowledge alert", error);
    }
  };

  const totalJetA1 = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.currentLevel, 0);
  const maxJetA1 = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.capacity, 0);
  const percentage = maxJetA1 > 0 ? Math.round((totalJetA1 / maxJetA1) * 100) : 0;

  const stockData = [
    { name: 'Available', value: totalJetA1 },
    { name: 'Ullage (Empty)', value: maxJetA1 - totalJetA1 },
  ];

  const operators = (staff && staff.length > 0 ? staff : MOCK_USERS).filter(u => [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_OFFICER, UserRole.ITP_SUPERVISOR].includes(u.role));

  // --- Sub-Component: Operator Dashboard (My Tasks) ---
  const renderOperatorDashboard = () => {
    // STRICT filtering for RBAC: Only show jobs assigned to current user (operator or officer)
    const myTasks = flightJobs
      .filter((job: FlightJob) => job.assignedTo === user.id || job.assignedOfficer === user.id)
      .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));


    const myDomesticFlights = myDomesticTeam 
      ? domesticFlights
          .filter((f: any) => f.assignedTeam === myDomesticTeam.team_name)
          .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''))
      : [];

    const visibleEquipment = myEquipment 
      ? myEquipment.filter((eq: any) => !completedAllocationIds.includes(eq.id)) 
      : [];
    
    const hasAnyTasks = myTasks.length > 0 || myDomesticTeam || visibleEquipment.length > 0;

    return (
      <div className="space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto p-4 lg:p-0">
        {/* Welcome Message - above all others */}
        <div className={`transition-all duration-1000 overflow-hidden ${showWelcome ? 'max-h-40 opacity-100 mb-4 lg:mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
           <div className="card-premium p-6 lg:p-8 border-outline flex items-center justify-between shadow-glow">
               <div>
                   <h2 className="title-lg text-on-surface">Operations Hub</h2>
                   <p className="text-on-surface-dim font-bold italic tracking-tight">Welcome back, <span className="text-primary">{user.name}</span></p>
               </div>
               <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-black border border-primary/20 flex items-center text-[10px] uppercase tracking-widest">
                   <Clock className="w-4 h-4 mr-2" />
                   {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
               </div>
           </div>
        </div>

        {/* Modern Stats Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
            <div className="hidden sm:flex card-premium p-4 lg:p-6 border-outline flex-col justify-center items-center text-center group hover:bg-primary/5 transition-colors">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Avg Refuel Time</span>
                <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-on-surface">18</span>
                    <span className="text-xs font-bold text-primary italic">MIN</span>
                </div>
            </div>
            <div className="hidden sm:flex card-premium p-6 border-outline flex-col justify-center items-center text-center group hover:bg-success/5 transition-colors">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Shift Progress</span>
                <div className="w-full h-1.5 bg-outline rounded-full mt-2 overflow-hidden">
                    <div className="bg-success h-full w-[65%]" />
                </div>
                <span className="text-[10px] font-black text-success mt-2 uppercase">65% DONE</span>
            </div>
            
            {/* Rotating Weather/Wind Card */}
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group hover:bg-warning/5 transition-all duration-500 overflow-hidden relative">
                <div className={`transition-all duration-500 transform ${rotationIndex % 2 === 0 ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 absolute'}`}>
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Wind Velocity</span>
                  <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black text-on-surface">08</span>
                      <span className="text-xs font-bold text-warning italic">KTS</span>
                  </div>
                </div>
                <div className={`transition-all duration-500 transform ${rotationIndex % 2 === 1 ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 absolute'}`}>
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Weather</span>
                  <div className="flex items-center space-x-2">
                      <CloudSun className="w-5 h-5 text-warning" />
                      <span className="text-sm font-black text-on-surface uppercase">29°C / Clear</span>
                  </div>
                </div>
            </div>

            {/* Rotating Tank/Density Card */}
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group hover:bg-primary/5 transition-all duration-500 overflow-hidden relative">
                <div className={`transition-all duration-500 transform ${rotationIndex % 2 === 0 ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 absolute'}`}>
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Service Tank</span>
                  <div className="flex items-center space-x-2">
                      <Droplet className="w-4 h-4 text-primary" />
                      <span className="text-sm font-black text-on-surface uppercase tracking-tight">
                        {tanks.find(t => t.id === serviceTankId)?.name?.replace(/\s\((NFF|OFF)\)/i, '') || 'TK-101'}
                      </span>
                  </div>
                </div>
                <div className={`transition-all duration-500 transform ${rotationIndex % 2 === 1 ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0 absolute'}`}>
                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Density</span>
                  <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-success" />
                      <span className="text-sm font-black text-on-surface uppercase tracking-tight">0.801 kg/m³</span>
                  </div>
                </div>
            </div>
        </div>

        {/* Available Equipment Section - categorized RF / HD */}
        {equipment && equipment.length > 0 && (() => {
          const available = equipment.filter(eq => eq.status === EqStatus.AVAILABLE && (eq.id.startsWith('RF') || eq.id.startsWith('HD')));
          const rfUnits = available.filter(eq => eq.id.startsWith('RF'));
          const hdUnits = available.filter(eq => eq.id.startsWith('HD'));

          return (
            <div className="space-y-5">
              {/* Header */}
              <div 
                className="flex items-center px-1 cursor-pointer select-none group/assets-header"
                onClick={() => setIsAssetsCollapsed(!isAssetsCollapsed)}
              >
                <h3 className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] flex items-center group-hover/assets-header:text-primary transition-colors">
                  Available Assets
                  <span className="ml-2 opacity-60">
                    {isAssetsCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </h3>
                <span className="w-8 h-[1px] bg-outline flex-1 mx-4"></span>
                <span className="text-[10px] font-black text-success uppercase tracking-widest">{available.length} Standby</span>
              </div>

              {/* Refuellers */}
              {!isAssetsCollapsed && rfUnits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.25em] opacity-50 px-1 flex items-center">
                    <span className="w-4 h-[1px] bg-primary/40 mr-2"></span>
                    Refuellers (RF) — {rfUnits.length} units
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {rfUnits.map((eq) => (
                      <div key={eq.id} onClick={() => onSelectEquipment?.(eq.id)} className="bg-surface-dim border border-white/10 p-4 lg:p-5 rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all cursor-pointer shadow-premium hover:shadow-glow">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="p-2 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform flex-shrink-0">
                            <Truck className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-[900] text-on-surface tracking-tighter truncate">{eq.name}</p>
                            <p className="text-[8px] font-black text-success opacity-60 uppercase tracking-widest">Available</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <span className="text-[11px] font-black text-primary font-mono">{eq.currentVolume?.toLocaleString() || '0'} L</span>
                          <p className="text-[7px] font-black text-on-surface-dim uppercase tracking-wider opacity-40">Fuel Level</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hydrant Dispensers */}
              {!isAssetsCollapsed && hdUnits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.25em] opacity-50 px-1 flex items-center">
                    <span className="w-4 h-[1px] bg-warning/40 mr-2"></span>
                    Hydrant Dispensers (HD) — {hdUnits.length} units
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {hdUnits.map((eq) => (
                      <div key={eq.id} onClick={() => onSelectEquipment?.(eq.id)} className="bg-surface-dim border border-white/10 p-4 lg:p-5 rounded-2xl flex items-center space-x-3 group hover:border-warning/50 transition-all cursor-pointer shadow-premium hover:shadow-glow-warning">
                        <div className="p-2 bg-warning/10 rounded-lg group-hover:scale-110 transition-transform">
                          <Droplet className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-[11px] font-[900] text-on-surface tracking-tighter">{eq.name}</p>
                          <p className="text-[8px] font-black text-success opacity-60 uppercase tracking-widest">Available</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}



        {/* Tactical Quick Actions */}
        <div className="flex items-center justify-center space-x-4 mb-2 overflow-x-auto pb-2 custom-scrollbar">
            <button 
                title="Emergency Stop"
                className="flex-shrink-0 bg-error/10 text-error border border-error/20 p-3 sm:px-4 sm:py-2.5 rounded-full sm:rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
                <AlertOctagon className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-error" />
                <span className="hidden sm:inline">Emergency Stop</span>
            </button>
            <button 
                title="Request Backup"
                className="flex-shrink-0 bg-primary/10 text-primary border border-primary/20 p-3 sm:px-4 sm:py-2.5 rounded-full sm:rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
                <Users className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-primary" />
                <span className="hidden sm:inline">Request Backup</span>
            </button>
            <button 
                title="Report Hazard"
                className="flex-shrink-0 bg-surface-dim text-on-surface-dim border border-outline p-3 sm:px-4 sm:py-2.5 rounded-full sm:rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
                <AlertTriangle className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-on-surface-dim" />
                <span className="hidden sm:inline">Report Hazard</span>
            </button>
        </div>

        {/* Shift Briefing Info */}
        {shiftBriefingInfo.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em]">Critical Intel</h3>
                    <span className="w-8 h-[1px] bg-outline flex-1 mx-4"></span>
                    <span className="text-[10px] font-black text-warning uppercase">{shiftBriefingInfo.length} Updates</span>
                </div>
                <div className="card-premium border-l-4 border-l-warning overflow-hidden bg-warning/5">
                    <div className="p-6">
                        <ul className="space-y-3">
                            {shiftBriefingInfo.map((info: any, index: number) => (
                                <li key={index} className="flex items-start">
                                    <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 mr-3 flex-shrink-0" />
                                    <span className="text-[13px] font-bold text-on-surface/80 leading-relaxed uppercase tracking-tight">{info.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {/* DAILY or Diesel Equipment Allocations */}
        {visibleEquipment && visibleEquipment.length > 0 && (
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] px-1 flex items-center">
                    <span className="w-4 h-[1px] bg-warning/40 mr-2"></span>
                    Assigned Shift Allocations
                </h3>
                {visibleEquipment.map((eq: any, index: number) => {
                    const isDiesel = eq.shift_type === 'DIESEL' || eq.equipment_id.startsWith('DT');
                    return (
                        <div key={`alloc-${index}`} className="card-premium border-l-4 border-l-warning overflow-hidden bg-surface-dim/20 hover:bg-surface-dim/40 transition-colors duration-300">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4 gap-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-3xl font-black text-on-surface">{eq.equipment_id}</span>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                                                isDiesel ? 'bg-error/10 text-error border-error/20' : 'bg-primary/10 text-primary border-primary/20'
                                            }`}>
                                                {isDiesel ? 'DIESEL ALLOCATION' : 'DAILY ALLOCATION'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-2">
                                            {eq.shift_type} SHIFT • OPERATOR ASSIGNMENT
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                         <div className="flex items-center justify-center text-warning bg-warning/10 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-warning/20">
                                             <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                                         </div>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-outline/30 flex flex-col sm:flex-row justify-between sm:items-center text-[11px] font-black uppercase tracking-widest text-on-surface-dim gap-4">
                                    <span className="flex-1">
                                        {eq.shift_type === 'DAILY' 
                                            ? 'Assigned for morning daily equipment qc checks (not to operate this unit for the shift)' 
                                            : 'Assigned to top up this equipment\'s diesel tank'
                                        }
                                    </span>
                                    <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0 w-full sm:w-auto">
                                        <span className="text-success shrink-0">Active Allocation</span>
                                        <button
                                            onClick={() => handleCompleteAllocation(eq.id)}
                                            className="py-1 px-2.5 sm:px-3 text-[9px] font-[900] tracking-widest bg-success/15 hover:bg-success/25 text-success border border-success/30 hover:border-success/50 flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer"
                                            title="Mark Completed"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span className="hidden sm:inline">MARK COMPLETED</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Domestic Assignment */}
        {myDomesticTeam && (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Domestic Operations</h3>
                <div className="bg-surface-dim rounded-xl shadow-sm border border-outline border-l-4 border-l-primary overflow-hidden flex flex-col md:flex-row mb-4">
                    <div className="p-6 flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <span className="text-2xl font-black text-slate-800">{myDomesticTeam.team_name}</span>
                        </div>
                        <p className="text-slate-500 text-sm">You are assigned to Domestic Operations for this shift.</p>
                    </div>
                </div>

                {/* Domestic Flights List */}
                {myDomesticFlights.length > 0 ? (
                    <div className="space-y-3">
                        {myDomesticFlights.map((flight) => {
                            const delayed = isDelayed(flight.sta, flight.eta);
                            const displayStatus = (delayed && flight.status === 'PENDING') ? 'DELAYED' : flight.status;
                            
                            return (
                             <div key={flight.id} className="card-premium border-outline overflow-hidden flex flex-col md:flex-row active:scale-[0.99] transition-transform">
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-2xl font-black text-on-surface">{flight.flightNumber}</span>
                                            <span className="bg-surface-dim text-on-surface-dim px-2.5 py-1 rounded-lg text-[10px] font-black border border-outline uppercase tracking-wider">
                                                {flight.aircraftReg}
                                            </span>
                                            {flight.vehicleId && flight.status !== 'PENDING' && (
                                                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${equipmentBadgeClass(flight.vehicleId)}`}>
                                                    <Truck className="w-3 h-3" />
                                                    <span>{flight.vehicleId}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`whitespace-nowrap px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                            displayStatus === 'COMPLETED' ? 'bg-success/10 text-success border-success/10' : 
                                            displayStatus === 'DELAYED' ? 'bg-error/10 text-error border-error/10 animate-pulse' :
                                            displayStatus === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/10 animate-pulse' : 'bg-surface-dim text-on-surface-dim border-outline'
                                        }`}>
                                            {displayStatus.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-6 text-[10px] font-black uppercase tracking-widest bg-surface-dim/40 p-4 rounded-2xl border border-outline">
                                        <div className="flex flex-col">
                                            <span className="opacity-40 mb-1">STA</span>
                                            <span className="text-on-surface text-sm font-black tracking-tight">{flight.sta || '--:--'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="opacity-40 mb-1 text-primary">ETA</span>
                                            <span className={`${delayed ? 'text-error' : 'text-primary'} text-sm font-black tracking-tight transition-colors`}>{flight.eta || '--:--'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="opacity-40 mb-1 text-warning">STD</span>
                                            <span className="text-warning text-sm font-black tracking-tight">{flight.std || '--:--'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface-dim p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l border-outline w-full md:w-48">
                                      {flight.status !== 'COMPLETED' ? (
                                         [UserRole.ITP_OPERATOR, UserRole.ITP_SUPERVISOR].includes(user.role) ? (
                                             <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider text-center opacity-40">VIEW ONLY</span>
                                         ) : (
                                            <button 
                                              onClick={() => onStartJob?.(flight as any)}
                                              className="btn-command w-full text-[10px] py-3 lg:py-4 flex items-center justify-center group"
                                            >
                                                <Play className="w-3 h-3 mr-2 group-hover:scale-125 transition-transform" />
                                                START JOB
                                            </button>
                                         )
                                      ) : (
                                         <button disabled className="w-full bg-surface-lowest text-on-surface-dim opacity-50 font-black py-3 lg:py-4 rounded-2xl text-[10px] cursor-not-allowed uppercase tracking-[0.2em]">
                                             TASK LOGGED
                                         </button>
                                      )}
                                 </div>
                             </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-surface-dim p-6 text-center rounded-xl border border-dashed border-outline">
                        <p className="text-slate-500 font-medium">No domestic flights currently scheduled for {myDomesticTeam.team_name}.</p>
                    </div>
                )}
            </div>
        )}



        {/* International Flights - Hidden if assigned to Domestic */}
        {!myDomesticTeam && myTasks.length > 0 && (
            <div className="space-y-4">
                <h3 className="label-sm text-on-surface-dim">Assigned International Flights</h3>
                {myTasks.map((job) => {
                    const delayed = isDelayed(job.sta, job.eta);
                    const displayStatus = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
                    const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;
                    const assigneeName = usersList.find(u => u.id === job.assignedTo)?.name || 'Unknown';
                    const officerName = job.assignedOfficer ? usersList.find(u => u.id === job.assignedOfficer)?.name : null;
                    
                    return (
                        <div key={job.id} className="card-premium border-l-4 border-l-primary overflow-hidden active:scale-[0.99] transition-transform">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6 gap-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-3xl font-black text-on-surface">{job.flightNumber}</span>
                                            <span className="bg-surface-dim text-on-surface-dim px-2.5 py-1 rounded-lg text-[10px] font-black border border-outline uppercase tracking-wider">
                                                {job.aircraftReg}
                                            </span>
                                            {job.vehicleId && job.status !== 'PENDING' && (
                                                <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${equipmentBadgeClass(job.vehicleId)}`}>
                                                    <Truck className="w-4 h-4" />
                                                    <span>{job.vehicleId}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-2">{job.aircraftType} • Stand {job.stand}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 shrink-0">
                                         {/* My Task Indicator */}
                                         <div className="flex items-center justify-center text-primary bg-primary/10 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-primary/20" title="Assigned to you">
                                             <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                                         </div>

                                         {job.status !== 'COMPLETED' ? (
                                            [UserRole.ITP_OPERATOR, UserRole.ITP_SUPERVISOR].includes(user.role) ? null : (
                                               <button 
                                                 onClick={() => onStartJob?.(job)}
                                                 className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg sm:rounded-xl group shadow-premium kinetic-gradient text-white hover:scale-[1.05] active:scale-95 transition-all"
                                                 title="Start Job"
                                               >
                                                   <Play className="!w-7 !h-7 !fill-white !text-white stroke-[2.5] ml-0.5 group-hover:scale-110 transition-transform" />
                                               </button>
                                            )
                                         ) : (
                                             <div 
                                                 onClick={() => notify(`Details for ${job.flightNumber} are in the history log.`, "info")}
                                                 className="w-8 h-8 sm:w-10 sm:h-10 bg-success/10 text-success border border-success/20 flex items-center justify-center rounded-lg sm:rounded-xl opacity-80 cursor-pointer" 
                                                 title="Task Completed"
                                             >
                                                 <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                                             </div>
                                         )}
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-outline/30 space-y-4">
                                    {/* Row 1: Tactical Times */}
                                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest bg-surface-dim/40 px-4 py-2.5 rounded-2xl border border-outline/50 w-fit">
                                         <div className="flex flex-col">
                                             <span className="opacity-40 mb-1">STA</span>
                                             <span className="text-on-surface text-sm font-black tracking-tight">{job.sta || '--:--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="opacity-40 mb-1 text-primary">ETA</span>
                                             <span className={`${delayed ? 'text-error' : 'text-primary'} text-sm font-black tracking-tight transition-colors`}>{job.eta || '--:--'}</span>
                                         </div>
                                         <div className="flex flex-col">
                                             <span className="opacity-40 mb-1 text-warning">STD</span>
                                             <span className="text-warning text-sm font-black tracking-tight">{job.std || '--:--'}</span>
                                         </div>
                                     </div>

                                     {/* Row 2: Operator (Left) & Status (Right) */}
                                      <div className="flex items-center justify-between gap-4">
                                          <div className="flex items-center text-on-surface-dim font-bold gap-3 flex-wrap">
                                              <div className="flex items-center">
                                                  <div className="w-5 h-5 rounded-md bg-surface-dim border-transparent flex items-center justify-center mr-2 text-[10px] font-black">
                                                      {assigneeName.charAt(0)}
                                                  </div>
                                                  <span className="text-[10px] uppercase tracking-tight">{assigneeName} <span className="opacity-40 italic font-black text-[8px] ml-0.5">(OP)</span></span>
                                              </div>
                                              {officerName && (
                                                  <div className="flex items-center">
                                                      <div className="w-5 h-5 rounded-md bg-surface-dim border-transparent flex items-center justify-center mr-2 text-[10px] font-black text-primary bg-primary/5">
                                                          {officerName.charAt(0)}
                                                      </div>
                                                      <span className="text-[10px] uppercase tracking-tight text-on-surface-dim">{officerName} <span className="opacity-40 italic font-black text-[8px] ml-0.5">(OFFICER)</span></span>
                                                  </div>
                                              )}
                                          </div>
                                          
                                          <span className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                             displayStatus === 'COMPLETED' ? 'bg-success/10 text-success border-success/10' : 
                                             displayStatus === 'DELAYED' ? 'bg-error/10 text-error border-error/10 animate-pulse' :
                                             displayStatus === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/10 animate-pulse' : 'bg-surface-dim text-on-surface-dim border-outline'
                                         }`}>
                                             {displayStatus.replace('_', ' ')}
                                         </span>
                                     </div>
                                 </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    );
  };

  // Helper variables and functions for Live Refueling Status
  const shiftRanges: Record<string, { start: string; end: string; crossesMidnight: boolean }> = {
    'Morning': { start: '07:30', end: '16:00', crossesMidnight: false },
    'Evening': { start: '15:00', end: '23:30', crossesMidnight: false },
    'Night': { start: '22:30', end: '08:30', crossesMidnight: true },
  };

  const isFlightInShift = (dep?: string) => {
    if (!dep) return true;
    const range = shiftRanges[selectedBriefingShift || 'Morning'];
    if (!range) return true;
    if (range.crossesMidnight) {
      return dep >= range.start || dep <= range.end;
    }
    return dep >= range.start && dep <= range.end;
  };

  const frozenFlights = briefingInfo?.staffAssignments?.frozenFlights;

  const intlJobs = (frozenFlights?.intl 
    ? frozenFlights.intl.map((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const dbJob = (flightJobs || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        const status = dbJob ? dbJob.status : 'PENDING';
        return { ...ff, status };
      })
    : (flightJobs || []).filter(f => {
        const isDep = f.type ? f.type === 'departure' : !!f.std;
        return isDep && isFlightInShift(f.std) && f.date === selectedBriefingDate;
      }).map(f => {
        const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const dbJob = (flightJobs || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        const status = dbJob ? dbJob.status : 'PENDING';
        return { ...f, status };
      })
  ).filter((f: any) => f.status?.toUpperCase() !== 'CANCELLED')
   .sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));

  const domesticJobsRaw = (frozenFlights?.domestic 
    ? frozenFlights.domestic.map((ff: any) => {
        const cleanNo = (ff.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const dbJob = (domesticFlights || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        const status = dbJob ? dbJob.status : 'PENDING';
        return { ...ff, status };
      })
    : (domesticFlights || []).filter(f => f.type === 'departure' && isFlightInShift(f.std) && f.date === selectedBriefingDate).map(f => {
        const cleanNo = (f.flightNumber || '').replace(/\s+/g, '').toLowerCase();
        const dbJob = (domesticFlights || []).find(j => (j.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
        const status = dbJob ? dbJob.status : 'PENDING';
        return { ...f, status };
      })
  ).filter((f: any) => f.status?.toUpperCase() !== 'CANCELLED');

  const domesticJobs = domesticJobsRaw.map((df: any) => {
      const assignment = (domesticAssignments || []).find(da => da.team_name === df.assignedTeam);
      return {
          ...df,
          assignedTo: assignment?.op1 || '',
          assignedOfficer: assignment?.op2 || '',
          isDomestic: true,
      };
  }).sort((a: any, b: any) => (a.std || '').localeCompare(b.std || ''));

  const adhocJobsRaw = briefingInfo?.staffAssignments?.adhocFlights !== undefined
    ? briefingInfo.staffAssignments.adhocFlights
    : MOCK_ADHOC_FLIGHTS.filter(f => isFlightInShift(f.sta || f.std) && (!f.date || f.date === selectedBriefingDate));

  const adhocJobs = adhocJobsRaw.map((f: any) => ({
      ...f,
      isAdhoc: true,
  })).sort((a: any, b: any) => (a.std || a.sta || '').localeCompare(b.std || b.sta || ''));

  const ongoingIntl = intlJobs.filter(j => j.status === 'IN_PROGRESS');
  const ongoingDom = domesticJobs.filter(j => j.status === 'IN_PROGRESS');
  const ongoingAdhoc = adhocJobs.filter(j => j.status === 'IN_PROGRESS');

  const completedIntl = intlJobs.filter(j => j.status === 'COMPLETED');
  const completedDom = domesticJobs.filter(j => j.status === 'COMPLETED');
  const completedAdhoc = adhocJobs.filter(j => j.status === 'COMPLETED');

  const hasAdhoc = adhocJobs.length > 0;

  const getFlightVolume = (flightNumber: string) => {
    const log = (flightLogs || []).find(l => l.flightNumber === flightNumber && l.status === 'COMPLETED');
    return log?.volume;
  };

  const getFlightVehicle = (job: FlightJob, isCompleted: boolean) => {
    if (job.vehicleId) return job.vehicleId;
    const log = (flightLogs || []).find(l => l.flightNumber === job.flightNumber && l.status === (isCompleted ? 'COMPLETED' : 'IN_PROGRESS'));
    return log?.vehicleId;
  };

  const renderFlightListCard = (job: FlightJob, isCompleted: boolean) => {
    const usersList = staff && staff.length > 0 ? staff : MOCK_USERS;
    const assignee = usersList.find(u => u.id === job.assignedTo);
    const assigneeName = assignee?.name || 'Unassigned';
    
    const vehicleId = getFlightVehicle(job, isCompleted);
    const volume = getFlightVolume(job.flightNumber);

    return (
      <div key={job.id} className="bg-surface-dim/40 border border-outline/50 p-4 rounded-2xl flex items-center justify-between hover:border-primary/30 transition-all">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
            <Plane className={`w-5 h-5 ${isCompleted ? 'text-success' : 'text-warning animate-pulse'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-on-surface tracking-tight">{job.flightNumber}</span>
              <span className="bg-surface-container-low px-1.5 py-0.5 rounded text-[8px] font-black text-on-surface-dim uppercase tracking-wider">{job.aircraftReg}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[9px] font-bold text-on-surface-dim">
              <span>Stand {job.stand}</span>
              {vehicleId && (
                <>
                  <span className="opacity-30">•</span>
                  <span className="flex items-center gap-0.5 uppercase">
                    <Truck className="w-2.5 h-2.5 opacity-60" /> {vehicleId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {isCompleted ? (
            <div>
              {volume !== undefined ? (
                <span className="text-xs font-black text-success font-mono">
                  {volume.toLocaleString()} L
                </span>
              ) : (
                <span className="text-[10px] font-black text-success uppercase tracking-wider">Completed</span>
              )}
              <span className="block text-[8px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest mt-0.5">
                Uplift
              </span>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-black text-warning uppercase tracking-widest animate-pulse flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping"></span>
                Fueling
              </span>
              <span className="block text-[8px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest mt-0.5">
                {assigneeName.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCategoryList = (jobs: FlightJob[], title: string, isCompleted: boolean, typeColor: string) => {
    if (jobs.length === 0) {
      return (
        <div className="py-2.5 px-4 bg-surface-dim/20 border border-dashed border-outline/40 rounded-xl text-center">
          <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-wider">No {title.toLowerCase()} refuelings</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className={`text-[8.5px] font-black uppercase tracking-[0.2em] opacity-60 flex items-center ${typeColor}`}>
          <span className="w-2.5 h-[1px] bg-current opacity-40 mr-1.5"></span>
          {title}
        </p>
        <div className="space-y-2">
          {jobs.map(job => renderFlightListCard(job, isCompleted))}
        </div>
      </div>
    );
  };

  const renderItpDashboard = () => (
      <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500 ease-out">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h2 className="headline-lg text-on-surface">Into-Plane Operations Center</h2>
              <p className="text-on-surface-dim font-medium">Real-time tactical flight refueling oversight</p>
           </div>
            <div className="px-5 py-2.5 badge-custom-primary rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] w-fit">
               Shift: {selectedBriefingShift || 'Morning'} ({selectedBriefingShift === 'Evening' ? '15:00 - 23:30' : selectedBriefingShift === 'Night' ? '22:30 - 08:30' : '07:30 - 16:00'})
            </div>
        </div>

        {/* ITP Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="card-premium p-8 group hover:border-primary/30 animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-1">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Scheduled Flights</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">42</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform"><Plane className="w-6 h-6 text-primary" /></div>
             </div>
             <div className="mt-4 text-[10px] font-bold opacity-40 uppercase tracking-widest text-on-surface">12 Pending / 8 In-Progress</div>
          </div>
          {(() => {
            const categories = [
              { label: 'Total Volume', value: '164K L', subtext: '+5.2% vs Forecast', color: 'text-success', bg: 'bg-success/10', icon: Droplet, border: 'hover:border-success/30' },
              { label: 'International', value: '94.2K L', subtext: '+6.1% vs Forecast', color: 'text-primary', bg: 'bg-primary/10', icon: Globe, border: 'hover:border-primary/30' },
              { label: 'Domestic', value: '34.8K L', subtext: '+2.4% vs Forecast', color: 'text-warning', bg: 'bg-warning/10', icon: MapPin, border: 'hover:border-warning/30' },
              { label: 'Seaplane', value: '18.5K L', subtext: '+8.7% vs Forecast', color: 'text-primary', bg: 'bg-primary/10', icon: Anchor, border: 'hover:border-primary/30' },
              { label: 'Local Sales', value: '16.5K L', subtext: '-1.2% vs Forecast', color: 'text-error', bg: 'bg-error/10', icon: ShoppingBag, border: 'hover:border-error/30' },
            ];
            const current = categories[rotationIndex];
            const Icon = current.icon;

            return (
              <div className={`card-premium p-8 group transition-all duration-500 ${current.border} relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-2`}>
                <div className="flex justify-between items-start relative z-10 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div>
                    <p className="label-sm text-on-surface-dim font-bold opacity-60 flex items-center">
                      {current.label}
                      {rotationIndex === 0 && <span className="ml-2 w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>}
                    </p>
                    <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">{current.value}</h3>
                  </div>
                  <div className={`p-3 ${current.bg} rounded-xl group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${current.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-end relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <div className={`text-[10px] font-black ${current.color} uppercase tracking-widest`}>{current.subtext}</div>
                  <div className="flex space-x-1">
                    {categories.map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full transition-all duration-300 ${i === rotationIndex ? `w-3 ${current.bg.replace('/10', '')}` : 'bg-outline-variant'}`}></div>
                    ))}
                  </div>
                </div>
                
                {/* Decorative background element */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${current.bg} rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity`}></div>
              </div>
            );
          })()}
           <div className="card-premium p-8 group hover:border-primary/30 animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-3">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Active Staff</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">{operators.length}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform"><Users className="w-6 h-6 text-primary" /></div>
             </div>
             <div className="mt-4 text-[10px] font-bold opacity-40 uppercase tracking-widest text-success">All operators online</div>
          </div>
          <div className="card-premium p-8 group hover:border-warning/30 animate-in fade-in slide-in-from-bottom-2 duration-500 stagger-4">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Avg. Turnaround</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">32m</h3>
                </div>
                <div className="p-3 bg-warning/10 rounded-xl group-hover:scale-110 transition-transform"><Clock className="w-6 h-6 text-warning" /></div>
             </div>
             <div className="mt-4 text-[10px] font-black text-success uppercase tracking-widest">-2m vs Target</div>
          </div>
        </div>

        {/* Simplified Operator Status Grid for Duty Managers only */}
        {isItpManager && (
            <div className="card-premium p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[12px] font-black text-on-surface-dim uppercase tracking-[0.3em]">Operator Oversight</h3>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{operators.length} Personnel Active</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {operators.map((op) => {
                        const eqAssignment = allEquipmentAssignments.find(a => a.operator1_id === op.id || a.operator2_id === op.id);
                        const domAssignment = allDomesticAssignments.find(a => a.operator1_id === op.id || a.operator2_id === op.id);
                        const activeTask = flightJobs.find((j: FlightJob) => j.assignedTo === op.id && j.status === 'IN_PROGRESS');

                        let statusText = 'Available';
                        let statusColor = 'bg-on-surface-dim opacity-30';

                        if (activeTask) {
                            statusText = `Refueling ${activeTask.flightNumber}`;
                            statusColor = 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)] animate-pulse';
                        } else if (domAssignment) {
                            statusText = domAssignment.team_name;
                            statusColor = 'bg-success';
                        } else if (eqAssignment) {
                            statusText = 'Available';
                            statusColor = 'bg-success';
                        }

                        const currentVeh = activeTask?.vehicleId || eqAssignment?.equipment_id;

                        return (
                            <div key={op.id} className="flex flex-col items-center text-center p-4 bg-surface-dim border border-outline rounded-3xl group transition-all hover:bg-surface-container">
                                <div className="relative mb-3 flex flex-col items-center">
                                    <div className="relative">
                                        <img src={op.avatar} alt="" className="w-12 h-12 rounded-2xl border border-outline shadow-sm group-hover:scale-110 transition-transform" />
                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-surface-dim ${statusColor}`}></div>
                                    </div>

                                </div>
                                <p className="text-[10px] font-[900] text-on-surface uppercase tracking-tight line-clamp-1">{op.name.split(' ')[0]}</p>
                                
                                {currentVeh && (
                                    <div className={`mt-1.5 px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-widest ${equipmentBadgeSoftClass(currentVeh)}`}>
                                        {currentVeh}
                                    </div>
                                )}

                                <p className="text-[8px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest mt-1.5 line-clamp-1">{statusText}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Available Equipment Section - categorised RF / HD for Managers */}
        {equipment && equipment.length > 0 && (() => {
          const getStatusLabel = (status: EqStatus) => {
            if (status === EqStatus.AVAILABLE) return 'Standby';
            if (status === EqStatus.IN_USE) return 'In Use';
            if (status === EqStatus.REFUELLING) return 'Refuelling';
            return status;
          };

          const getStatusColor = (status: EqStatus) => {
            if (status === EqStatus.AVAILABLE) return 'text-success';
            if (status === EqStatus.IN_USE) return 'text-primary';
            if (status === EqStatus.REFUELLING) return 'text-warning';
            return 'text-on-surface-dim';
          };

          const active = equipment.filter(eq => 
            eq.status === EqStatus.AVAILABLE || 
            eq.status === EqStatus.IN_USE || 
            eq.status === EqStatus.REFUELLING
          );
          const rfUnits = active.filter(eq => eq.id.startsWith('RF')).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
          const hdUnits = active.filter(eq => eq.id.startsWith('HD')).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

          return (
            <div className="space-y-5 px-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center">
                <h3 className="text-[12px] font-black text-on-surface-dim uppercase tracking-[0.3em]">Operational Assets</h3>
                <span className="w-8 h-[1px] bg-outline flex-1 mx-4"></span>
                <span className="text-[10px] font-black text-success uppercase tracking-widest">
                  {active.filter(eq => eq.status === EqStatus.AVAILABLE).length} Standby / {active.length} Operational
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Refuellers */}
                {rfUnits.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.25em] opacity-50 flex items-center">
                      <span className="w-4 h-[1px] bg-primary/40 mr-2"></span>
                      Refuellers (RF)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {rfUnits.map((eq) => {
                        const isRequested = alerts.some(a => !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eq.id}`));
                        
                        const replenishButton = (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (isRequested || pendingRequests.has(eq.id)) return;
                              
                              setPendingRequests(prev => new Set(prev).add(eq.id));
                              try {
                                const success = await createAlert({
                                  severity: 'medium',
                                  message: `Replenishment requested for unit ${eq.id}`,
                                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                                  acknowledged: false,
                                  targetRole: UserRole.DEPOT_MANAGER
                                });
                                if (success) {
                                  await updateEquipmentStatus(eq.id, EqStatus.REFUELLING);
                                  notify(`Refuel request sent for ${eq.id}`, 'success');
                                }
                              } catch (error) {
                                console.error("Failed to send refuel request", error);
                                notify(`Failed to send refuel request for ${eq.id}`, 'error');
                              } finally {
                                setPendingRequests(prev => {
                                    const next = new Set(prev);
                                    next.delete(eq.id);
                                    return next;
                                });
                              }
                            }}
                            disabled={isRequested || pendingRequests.has(eq.id)}
                            className={`w-8 h-8 rounded-full transition-all shadow-premium flex items-center justify-center active:scale-95 shrink-0 ${
                              isRequested || pendingRequests.has(eq.id)
                              ? 'bg-surface-lowest text-on-surface-dim opacity-30 cursor-not-allowed border border-outline' 
                              : 'kinetic-gradient text-white border-none hover:scale-105'
                            }`}
                            title={isRequested ? 'Replenishment already requested' : pendingRequests.has(eq.id) ? 'Sending request...' : 'Request Replenishment'}
                          >
                            {isRequested || pendingRequests.has(eq.id) ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        );

                        return (
                          <div key={eq.id} className="bg-surface-dim/40 border border-outline p-3 sm:p-4 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all">
                            <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-2">
                              {/* Truck Badge */}
                              <div className="flex flex-col items-center bg-primary/10 rounded-lg pt-1.5 pb-1 px-1.5 transition-transform group-hover:scale-110 min-w-[32px] shrink-0">
                                <Truck className="w-3.5 h-3.5 text-primary mb-0.5" />
                                <span className="text-[7.5px] font-black text-primary font-mono leading-none">
                                  {Math.round(eq.maxCapacity / 1000)}K
                                </span>
                              </div>
                              {/* Text Info */}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-[900] text-on-surface tracking-tighter truncate">{eq.name}</p>
                                <div className="flex flex-col mt-0.5">
                                  <span className={`text-[8px] font-black uppercase tracking-widest ${getStatusColor(eq.status)} opacity-80`}>
                                    {getStatusLabel(eq.status)}
                                  </span>
                                  {eq.currentVolume !== undefined && (
                                    <span className="text-[13px] font-black text-primary font-mono mt-0.5">
                                      {eq.currentVolume.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {isItpManager && (
                              <div className="shrink-0">
                                {replenishButton}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hydrant Dispensers */}
                {hdUnits.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.25em] opacity-50 flex items-center">
                      <span className="w-4 h-[1px] bg-warning/40 mr-2"></span>
                      Hydrant Dispensers (HD)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {hdUnits.map((eq) => (
                        <div key={eq.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex items-center space-x-3 group hover:border-warning/30 transition-all cursor-pointer">
                          <div className="p-2 bg-warning/10 rounded-lg group-hover:scale-110 transition-transform">
                            <Droplet className="w-4 h-4 text-warning" />
                          </div>
                          <div>
                            <p className="text-[11px] font-[900] text-on-surface tracking-tighter">{eq.name}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${getStatusColor(eq.status)} opacity-80 mt-0.5 block`}>
                              {getStatusLabel(eq.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           {/* International Flight Volume Chart */}
           <div className="card-premium p-8">
              <h3 className="headline-lg text-on-surface mb-8 tracking-tighter">International Hourly Activity</h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={HOURLY_DATA_INT}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline)" />
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--color-primary)', fontSize: 10, fontWeight: 700}} />
                       <Tooltip cursor={{fill: 'var(--color-surface-dim)'}} contentStyle={{backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)'}} />
                       <Legend verticalAlign="top" height={36}/>
                       <Bar yAxisId="left" dataKey="flights" fill="var(--color-on-surface-dim)" opacity={0.4} radius={[4, 4, 0, 0]} name="Flights Served" />
                       <Line yAxisId="right" type="monotone" dataKey="volume" stroke="var(--color-primary)" strokeWidth={3} dot={{fill: 'var(--color-primary)', r: 4}} activeDot={{r: 6}} name="Uplift (L)" />
                    </ComposedChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Domestic Flight Volume Chart */}
           <div className="card-premium p-8">
              <h3 className="headline-lg text-on-surface mb-8 tracking-tighter">Domestic Hourly Activity</h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={HOURLY_DATA_DOM}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline)" />
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--color-success)', fontSize: 10, fontWeight: 700}} />
                       <Tooltip cursor={{fill: 'var(--color-surface-dim)'}} contentStyle={{backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)'}} />
                       <Legend verticalAlign="top" height={36}/>
                       <Bar yAxisId="left" dataKey="flights" fill="var(--color-on-surface-dim)" opacity={0.4} radius={[4, 4, 0, 0]} name="Flights Served" />
                       <Line yAxisId="right" type="monotone" dataKey="volume" stroke="var(--color-success)" strokeWidth={3} dot={{fill: 'var(--color-success)', r: 4}} activeDot={{r: 6}} name="Uplift (L)" />
                    </ComposedChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Performance Donut */}
           <div className="card-premium p-8 lg:col-span-1">
              <h3 className="headline-lg text-on-surface mb-8 tracking-tighter">On-Time Performance</h3>
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={FLIGHT_PERFORMANCE}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {FLIGHT_PERFORMANCE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-on-surface tracking-tighter">85%</span>
                  <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">On Time</span>
                </div>
              </div>
           </div>
           
           {/* Live Refueling Tracking */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 lg:col-span-2">
              {/* Ongoing Refueling Column */}
              <div className="card-premium p-6 sm:p-8 flex flex-col group">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                       <Droplet className="w-4 h-4 mr-3 text-warning animate-pulse" />
                       Ongoing Refueling
                    </h3>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-warning/10 text-warning border border-warning/25 animate-pulse">
                       {(ongoingIntl.length + ongoingDom.length + ongoingAdhoc.length)} Active
                    </span>
                 </div>
                 <div className="space-y-6">
                    {renderCategoryList(ongoingIntl, "International Operations", false, "text-primary")}
                    {renderCategoryList(ongoingDom, "Domestic Operations", false, "text-success")}
                    {hasAdhoc && renderCategoryList(ongoingAdhoc, "Ad-Hoc Operations", false, "text-warning")}
                 </div>
              </div>

              {/* Recently Completed Column */}
              <div className="card-premium p-6 sm:p-8 flex flex-col group">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                       <CheckCircle className="w-4 h-4 mr-3 text-success" />
                       Recently Completed
                    </h3>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-success/10 text-success border border-success/25">
                       {(completedIntl.length + completedDom.length + completedAdhoc.length)} Done
                    </span>
                 </div>
                 <div className="space-y-6">
                    {renderCategoryList(completedIntl, "International Operations", true, "text-primary")}
                    {renderCategoryList(completedDom, "Domestic Operations", true, "text-success")}
                    {hasAdhoc && renderCategoryList(completedAdhoc, "Ad-Hoc Operations", true, "text-warning")}
                 </div>
              </div>
           </div>
        </div>
      </div>
  );

  // --- Sub-Component: Depot Dashboard (FUEL SERVICES Style) ---
  const renderDepotDashboard = () => {
    const totalJetA1 = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.currentLevel, 0);
    const totalDiesel = (tanks || []).filter(t => t.type === FuelType.DIESEL).reduce((acc, t) => acc + t.currentLevel, 0);
    const totalPetrol = (tanks || []).filter(t => t.type === FuelType.PETROL).reduce((acc, t) => acc + t.currentLevel, 0);

    const maxJetA1 = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.capacity, 0);
    const maxDiesel = (tanks || []).filter(t => t.type === FuelType.DIESEL).reduce((acc, t) => acc + t.capacity, 0);
    const maxPetrol = (tanks || []).filter(t => t.type === FuelType.PETROL).reduce((acc, t) => acc + t.capacity, 0);

    const jetA1Pct = maxJetA1 > 0 ? (totalJetA1 / maxJetA1) * 100 : 0;
    const dieselPct = maxDiesel > 0 ? (totalDiesel / maxDiesel) * 100 : 0;
    const petrolPct = maxPetrol > 0 ? (totalPetrol / maxPetrol) * 100 : 0;

    // Find refuelers currently in Refuelling status
    const refuelingVehicles = (equipment || []).filter(
      eq => eq.type === EquipmentType.REFUELLER && eq.status === EqStatus.REFUELLING
    );

    const refuelingRequests = refuelingVehicles.map(rf => {
      const matchingAlert = (alerts || [])
        .filter(a => a && a.message.includes(rf.id))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

      if (matchingAlert) {
        return {
          id: matchingAlert.id,
          message: matchingAlert.message,
          timestamp: matchingAlert.timestamp,
          acknowledged: false
        };
      } else {
        return {
          id: `synth-${rf.id}`,
          message: `Replenishment requested for unit ${rf.id} (Low fuel: ${rf.currentVolume?.toLocaleString() || 0}L)`,
          timestamp: rf.lastUpdated ? new Date(rf.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--',
          acknowledged: false
        };
      }
    });

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
        {/* Metric Row: Jet A-1, Diesel, Petrol Stocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Jet A-1 Stock */}
          <div className="card-premium p-4 sm:p-8 group hover:border-primary/30 transition-all relative overflow-hidden">
            <p className="label-sm text-on-surface-dim opacity-40 mb-6 font-bold tracking-[0.2em]">Total Jet A-1 Stock</p>
            <div className="flex items-baseline space-x-3 mb-4">
              <h3 className="text-4xl font-[900] text-on-surface tracking-tighter">{(totalJetA1 / 1000000).toFixed(2)}M <span className="text-lg font-bold opacity-30">L</span></h3>
              <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/10">
                {jetA1Pct.toFixed(1)}% Fill
              </span>
            </div>
            {/* Custom progress bar */}
            <div className="h-1.5 w-full bg-surface-dim rounded-full overflow-hidden border border-outline/30 mt-2">
              <div className="bg-primary h-full rounded-full transition-all duration-[1000ms]" style={{ width: `${jetA1Pct}%` }}></div>
            </div>
            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-30 mt-4">Capacity: {(maxJetA1 / 1000000).toFixed(1)}M L</p>
          </div>

          {/* Diesel Stock */}
          <div className="card-premium p-4 sm:p-8 group hover:border-amber-500/30 transition-all relative overflow-hidden">
            <p className="label-sm text-on-surface-dim opacity-40 mb-6 font-bold tracking-[0.2em]">Total Diesel Stock</p>
            <div className="flex items-baseline space-x-3 mb-4">
              <h3 className="text-4xl font-[900] text-amber-600 tracking-tighter">{(totalDiesel / 1000).toFixed(1)}K <span className="text-lg font-bold opacity-30">L</span></h3>
              <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/10">
                {dieselPct.toFixed(1)}% Fill
              </span>
            </div>
            {/* Custom progress bar */}
            <div className="h-1.5 w-full bg-surface-dim rounded-full overflow-hidden border border-outline/30 mt-2">
              <div className="bg-amber-500 h-full rounded-full transition-all duration-[1000ms]" style={{ width: `${dieselPct}%` }}></div>
            </div>
            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-30 mt-4">Capacity: {(maxDiesel / 1000).toFixed(0)}K L</p>
          </div>

          {/* Petrol Stock */}
          <div className="card-premium p-4 sm:p-8 group hover:border-emerald-500/30 transition-all relative overflow-hidden">
            <p className="label-sm text-on-surface-dim opacity-40 mb-6 font-bold tracking-[0.2em]">Total Petrol Stock</p>
            <div className="flex items-baseline space-x-3 mb-4">
              <h3 className="text-4xl font-[900] text-emerald-600 tracking-tighter">{(totalPetrol / 1000).toFixed(1)}K <span className="text-lg font-bold opacity-30">L</span></h3>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">
                {petrolPct.toFixed(1)}% Fill
              </span>
            </div>
            {/* Custom progress bar */}
            <div className="h-1.5 w-full bg-surface-dim rounded-full overflow-hidden border border-outline/30 mt-2">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-[1000ms]" style={{ width: `${petrolPct}%` }}></div>
            </div>
            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-30 mt-4">Capacity: {(maxPetrol / 1000).toFixed(0)}K L</p>
          </div>
        </div>

        {/* Refueling Requests Widget */}
        <div className="card-premium p-4 sm:p-8 border border-outline relative overflow-hidden flex flex-col group">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                <Droplet className="w-4 h-4 mr-3 text-primary animate-pulse" />
                Active ITP Refueling Requests
              </h3>
              <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-50">Pending vehicle replenishments from Into-Plane duty managers</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap w-fit ${
              refuelingRequests.length > 0 ? 'bg-primary/10 text-primary border border-primary/20 animate-pulse' : 'bg-success/10 text-success border border-success/20'
            }`}>
              {refuelingRequests.length} Pending
            </span>
          </div>

          <div className="space-y-4 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
            {refuelingRequests.length === 0 ? (
              <div className="text-center py-10 opacity-30 flex flex-col items-center justify-center">
                <CheckCircle className="w-10 h-10 text-success mb-3 opacity-60" />
                <p className="text-[10px] font-black uppercase tracking-widest">All Vehicles Adequately Replenished</p>
              </div>
            ) : (
              refuelingRequests.map(request => {
                const match = request.message.match(/unit\s+(RF-\d+)/i);
                const vehicleId = match ? match[1].toUpperCase() : '';
                return (
                  <div key={request.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-dim/60 border border-outline rounded-2xl gap-4 hover:bg-surface-container transition-all">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{request.message}</p>
                        <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-50 mt-0.5">Requested {request.timestamp}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // Store the target vehicle in localStorage so Bridging can auto-fill it
                        if (vehicleId) localStorage.setItem('fms_initiate_loading_vehicle', vehicleId);
                        setActiveView('bridging');
                      }}
                      className="kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 shrink-0 shadow-premium px-6 py-2.5"
                    >
                      Dispatch Loading
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Centerpiece: Infrastructure Asset Grid */}
        <div className="card-premium p-4 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="headline-lg text-on-surface tracking-tighter uppercase italic">Infrastructure Asset Grid</h3>
              <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.4em] mt-2 opacity-40">Live Tank Farm Telemetry</p>
            </div>
            <div className="px-4 py-2 bg-surface-dim border border-outline rounded-xl flex items-center space-x-3 w-fit">
              <Database className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest whitespace-nowrap">{(tanks || []).length} Units Online</span>
            </div>
          </div>
          
          <TankStatusGrid tanks={tanks || []} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-12 max-w-[1600px] mx-auto pb-24">
      {/* ITP Manager: full ops center + all operator task boards */}
      {isItpManager ? (
        <div className="space-y-10">
          {renderItpDashboard()}
        </div>
      ) : isItpOperator ? renderOperatorDashboard() : (
        <>
            {/* View Switcher for Admins/Execs */}
            {isDualRole && (
                <div className="mb-10 flex justify-start">
                        <div className="bg-surface-dim p-1.5 rounded-[22px] border border-outline flex relative w-full sm:w-[320px] shadow-inner overflow-hidden">
                            <div 
                                className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] kinetic-gradient rounded-[18px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium ${viewMode === 'DEPOT' ? 'translate-x-full' : 'translate-x-0'}`}
                            />
                            <button
                                onClick={() => setViewMode('ITP')}
                                className={`flex-1 py-3 px-6 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'ITP' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
                            >
                                ITP Ops
                            </button>
                            <button
                                onClick={() => setViewMode('DEPOT')}
                                className={`flex-1 py-3 px-6 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'DEPOT' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
                            >
                                Depot Ops
                            </button>
                        </div>
                </div>
            )}

            {/* Conditionally Render View */}
            <div key={viewMode}>
                {viewMode === 'ITP' ? renderItpDashboard() : renderDepotDashboard()}
            </div>
        </>
      )}
    </div>
  );
};
