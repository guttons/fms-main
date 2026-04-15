
import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { MOCK_ALERTS, MOCK_USERS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS } from '../constants';
import { FuelType, Tank, User, UserRole, FlightJob } from '../types';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Droplet, Users, Clock, Plane, LayoutDashboard, MapPin, CheckCircle, Truck, Play } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

// Mock Data for Charts
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
  tanks: Tank[];
  user: User;
  setActiveView: (view: string) => void;
  onStartJob?: (job: FlightJob) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ tanks, user, setActiveView, onStartJob }) => {
  // Logic to determine initial view and if switching is allowed
  const isItpManager = user.role === UserRole.ITP_MANAGER;
  const isItpOperator = [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR, UserRole.ITP_MANAGER].includes(user.role);
  const isDualRole = [UserRole.ADMIN, UserRole.EXECUTIVE].includes(user.role);
  
  const [viewMode, setViewMode] = useState<'ITP' | 'DEPOT'>(
    isItpManager ? 'ITP' : 'DEPOT'
  );

  const [myDomesticTeam, setMyDomesticTeam] = useState<any>(null);
  const [myEquipment, setMyEquipment] = useState<any>(null);
  const [shiftBriefingInfo, setShiftBriefingInfo] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [allEquipmentAssignments, setAllEquipmentAssignments] = useState<any[]>([]);
  const [allDomesticAssignments, setAllDomesticAssignments] = useState<any[]>([]);

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

          // Fetch Shift Briefing Info
          const briefingData = await supabaseService.getShiftBriefingInfo(todayDate) as any;
          if (briefingData && briefingData.info && briefingData.info.length > 0) {
            setShiftBriefingInfo(briefingData.info);
          }
        }
      } catch (error) {
        console.error("Error fetching assignments", error);
      }
    };
    fetchAssignments();
  }, [isItpOperator, user.id, viewMode]);

  const totalJetA1 = tanks.filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.currentLevel, 0);
  const maxJetA1 = tanks.filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.capacity, 0);
  const percentage = Math.round((totalJetA1 / maxJetA1) * 100);

  const stockData = [
    { name: 'Available', value: totalJetA1 },
    { name: 'Ullage (Empty)', value: maxJetA1 - totalJetA1 },
  ];

  const operators = MOCK_USERS.filter(u => [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(u.role));

  // --- Sub-Component: Operator Dashboard (My Tasks) ---
  const renderOperatorDashboard = () => {
    // STRICT filtering for RBAC: Only show jobs assigned to current user
    const myTasks = MOCK_JOBS
      .filter(job => job.assignedTo === user.id)
      .sort((a, b) => (a.std || '').localeCompare(b.std || ''));

    const myDomesticFlights = myDomesticTeam 
      ? MOCK_DOMESTIC_FLIGHTS
          .filter(f => f.assignedTeam === myDomesticTeam.team_name)
          .sort((a, b) => (a.std || '').localeCompare(b.std || ''))
      : [];
    
    const hasAnyTasks = myTasks.length > 0 || myDomesticTeam || myEquipment;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto">
        {/* Modern Stats Panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group hover:bg-primary/5 transition-colors">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Avg Refuel Time</span>
                <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-on-surface">18</span>
                    <span className="text-xs font-bold text-primary italic">MIN</span>
                </div>
            </div>
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group hover:bg-success/5 transition-colors">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Shift Progress</span>
                <div className="w-full h-1.5 bg-outline rounded-full mt-2 overflow-hidden">
                    <div className="bg-success h-full w-[65%]" />
                </div>
                <span className="text-[10px] font-black text-success mt-2 uppercase">65% DONE</span>
            </div>
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group hover:bg-warning/5 transition-colors">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Wind Velocity</span>
                <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-on-surface">08</span>
                    <span className="text-xs font-bold text-warning italic">KTS</span>
                </div>
            </div>
            <div className="card-premium p-6 border-outline flex flex-col justify-center items-center text-center group active:scale-95 transition-transform cursor-pointer hover:bg-primary/5">
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">Safety Status</span>
                <div className="flex items-center space-x-2 text-primary">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="text-xs font-black uppercase text-success">Verified</span>
                </div>
            </div>
        </div>

        <div className={`transition-all duration-1000 overflow-hidden ${showWelcome ? 'max-h-40 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
           <div className="card-premium p-8 border-outline flex items-center justify-between shadow-glow">
               <div>
                   <h2 className="title-lg text-on-surface">Operations Hub</h2>
                   <p className="text-on-surface-dim font-bold italic tracking-tight">Welcome back, <span className="text-primary">{user.name}</span></p>
               </div>
               <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-black border border-primary/20 flex items-center text-[10px] uppercase tracking-widest">
                   <Clock className="w-4 h-4 mr-2" />
                   {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </div>
           </div>
        </div>

        {/* Tactical Quick Actions */}
        <div className="flex items-center space-x-4 mb-2 overflow-x-auto pb-2 custom-scrollbar">
            <button className="flex-shrink-0 bg-error/10 text-error border border-error/20 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Emergency Stop
            </button>
            <button className="flex-shrink-0 bg-primary/10 text-primary border border-primary/20 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Request Backup
            </button>
            <button className="flex-shrink-0 bg-surface-dim text-on-surface-dim border border-outline px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Report Hazard
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

        {/* Domestic Assignment */}
        {myDomesticTeam && (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Domestic Operations</h3>
                <div className="bg-white rounded-xl shadow-sm border-l-4 border-l-blue-500 overflow-hidden flex flex-col md:flex-row mb-4">
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
                                                <div className="flex items-center space-x-1.5 px-2 py-1 bg-primary/10 rounded-lg text-primary border border-primary/20">
                                                    <Truck className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">{flight.vehicleId}</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
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
                                        <button 
                                          onClick={() => onStartJob?.(flight as any)}
                                          className="btn-command w-full text-xs py-4 flex items-center justify-center group"
                                        >
                                            <Play className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                            START JOB
                                        </button>
                                     ) : (
                                        <button disabled className="w-full bg-surface-lowest text-on-surface-dim opacity-50 font-black py-4 rounded-2xl text-[10px] cursor-not-allowed uppercase tracking-[0.2em]">
                                            TASK LOGGED
                                        </button>
                                     )}
                                </div>
                             </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white p-6 text-center rounded-xl border border-dashed border-gray-300">
                        <p className="text-slate-500 font-medium">No domestic flights currently scheduled for {myDomesticTeam.team_name}.</p>
                    </div>
                )}
            </div>
        )}

        {/* Equipment Assignment */}
        {myEquipment && myEquipment.length > 0 && (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Equipment Assignments</h3>
                {myEquipment.map((eq: any, index: number) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border-l-4 border-l-orange-500 overflow-hidden flex flex-col md:flex-row">
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-orange-50 rounded-lg">
                                        <Truck className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <span className="text-2xl font-black text-slate-800">{eq.equipment_id}</span>
                                </div>
                                <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-orange-100 text-orange-700">
                                    {eq.shift_type} SHIFT
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm">You are assigned to operate this equipment.</p>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* International Flights - Hidden if assigned to Domestic */}
        {!myDomesticTeam && myTasks.length > 0 && (
            <div className="space-y-4">
                <h3 className="label-sm text-on-surface-dim">Assigned International Flights</h3>
                {myTasks.map((job) => {
                    const delayed = isDelayed(job.sta, job.eta);
                    const displayStatus = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
                    
                    return (
                        <div key={job.id} className="card-premium border-l-4 border-l-primary overflow-hidden flex flex-col md:flex-row active:scale-[0.99] transition-transform">
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-3xl font-black text-on-surface">{job.flightNumber}</span>
                                        <span className="bg-surface-dim text-on-surface-dim px-2.5 py-1 rounded-lg text-[10px] font-black border border-outline uppercase tracking-wider">
                                            {job.aircraftReg}
                                        </span>
                                        {job.vehicleId && job.status !== 'PENDING' && (
                                            <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg text-primary border border-primary/20">
                                                <Truck className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{job.vehicleId}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
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
                            </div>
                            <div className="bg-surface-dim p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l border-outline w-full md:w-48">
                                 {job.status !== 'COMPLETED' ? (
                                    <button 
                                      onClick={() => onStartJob?.(job)}
                                      className="btn-command w-full text-xs py-4 flex items-center justify-center group"
                                    >
                                        <Play className="w-4 h-4 mr-2 group-hover:scale-125 transition-transform" />
                                        START JOB
                                    </button>
                                 ) : (
                                    <button disabled className="w-full bg-surface-lowest text-on-surface-dim opacity-50 font-black py-4 rounded-2xl text-[10px] cursor-not-allowed uppercase tracking-[0.2em]">
                                        TASK LOGGED
                                    </button>
                                 )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    );
  };

  const renderItpDashboard = () => (
      <div className="space-y-10 animate-in fade-in slide-in-from-left-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h2 className="headline-lg text-on-surface">Into-Plane Operations Center</h2>
              <p className="text-on-surface-dim font-medium">Real-time tactical flight refueling oversight</p>
           </div>
           <div className="px-5 py-2.5 bg-brand-blue dark:bg-primary text-white rounded-2xl text-[10px] font-black border border-outline shadow-xl uppercase tracking-[0.2em] w-fit">
              Shift: Morning (06:00 - 14:00)
           </div>
        </div>

        {/* ITP Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="card-premium p-8 group hover:border-primary/30">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Scheduled Flights</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">42</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform"><Plane className="w-6 h-6 text-primary" /></div>
             </div>
             <div className="mt-4 text-[10px] font-bold opacity-40 uppercase tracking-widest text-on-surface">12 Pending / 8 In-Progress</div>
          </div>
          <div className="card-premium p-8 group hover:border-success/30">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Uplift Volume</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">164K L</h3>
                </div>
                <div className="p-3 bg-success/10 rounded-xl group-hover:scale-110 transition-transform"><Droplet className="w-6 h-6 text-success" /></div>
             </div>
             <div className="mt-4 text-[10px] font-black text-success uppercase tracking-widest">+5.2% vs Forecast</div>
          </div>
           <div className="card-premium p-8 group hover:border-primary/30">
             <div className="flex justify-between items-start">
                <div>
                   <p className="label-sm text-on-surface-dim font-bold opacity-60">Active Staff</p>
                   <h3 className="text-4xl font-[900] text-on-surface mt-2 tracking-tighter">{operators.length}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform"><Users className="w-6 h-6 text-primary" /></div>
             </div>
             <div className="mt-4 text-[10px] font-bold opacity-40 uppercase tracking-widest text-success">All operators online</div>
          </div>
          <div className="card-premium p-8 group hover:border-warning/30">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Flight Volume Chart */}
           <div className="card-premium p-8 lg:col-span-2">
              <h3 className="headline-lg text-on-surface mb-8 tracking-tighter">Hourly Operations Activity</h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={HOURLY_DATA}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline)" />
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--color-on-surface-dim)', fontSize: 10, fontWeight: 700}} />
                       <Tooltip cursor={{fill: 'var(--color-surface-dim)'}} contentStyle={{backgroundColor: 'var(--color-surface-container)', borderRadius: '12px', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)'}} />
                       <Bar dataKey="flights" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Flights Served" />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Performance Donut */}
           <div className="card-premium p-8">
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
        </div>

        <div className="card-premium p-8">
            <h3 className="headline-lg text-on-surface mb-6 tracking-tighter">Operator Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {operators.map((op) => {
                    const eqAssignment = allEquipmentAssignments.find(a => a.operator1_id === op.id || a.operator2_id === op.id);
                    const domAssignment = allDomesticAssignments.find(a => a.operator1_id === op.id || a.operator2_id === op.id);
                    const activeTask = MOCK_JOBS.find(j => j.assignedTo === op.id && j.status === 'IN_PROGRESS');

                    let statusText = 'Available';
                    let subText = 'Standby';
                    let statusColor = 'bg-on-surface-dim opacity-30';

                    if (activeTask) {
                        statusText = `Refueling ${activeTask.flightNumber}`;
                        subText = activeTask.vehicleId || 'No Vehicle';
                        statusColor = 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]';
                    } else if (domAssignment) {
                        statusText = domAssignment.team_name;
                        subText = 'Domestic Ops';
                        statusColor = 'bg-success';
                    } else if (eqAssignment) {
                        statusText = `Assigned ${eqAssignment.equipment_id}`;
                        subText = 'Available';
                        statusColor = 'bg-success';
                    }

                    return (
                        <div key={op.id} className="flex items-center p-4 bg-surface-dim border border-outline rounded-2xl group transition-all hover:bg-surface-container">
                            <div className={`w-3 h-3 rounded-full mr-4 ${statusColor}`}></div>
                            <img src={op.avatar} alt="" className="w-10 h-10 rounded-xl mr-4 border border-outline shadow-sm" />
                            <div>
                                <p className="text-sm font-black text-on-surface uppercase tracking-tight">{op.name}</p>
                                <p className="text-[10px] font-bold text-on-surface-dim opacity-60 uppercase tracking-widest">
                                    {statusText} {subText !== 'Standby' ? `• ${subText}` : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
  );

  // --- Sub-Component: Depot Dashboard (FUEL SERVICES Style) ---
  const renderDepotDashboard = () => (
    <div className="space-y-10 fade-in">
      {/* Hero Section: Active Units + Metric Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* Hero Card: Active Refueling Units */}
        <div className="xl:col-span-2 card-premium p-12 relative overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="relative z-10">
            <p className="label-sm text-on-surface-dim opacity-40 mb-3 tracking-[0.4em]">Current Operations Overlay</p>
            <h3 className="headline-lg text-on-surface pl-0 font-black tracking-tighter uppercase relative">
                Active Refueling Units
                <div className="absolute -left-12 top-1 w-1.5 h-6 bg-primary rounded-full"></div>
            </h3>
            <div className="flex items-center space-x-2 mt-8">
              <div className="dot-live"></div>
              <span className="text-[10px] font-black text-success uppercase tracking-widest ml-3">Live Telemetry Synchronized</span>
            </div>
          </div>
          
          <div className="relative z-10 flex items-baseline space-x-10 mt-12">
            <span className="text-[160px] font-[900] text-primary leading-none tracking-tighter [text-shadow:_0_10px_40px_rgba(56,189,248,0.2)]">8</span>
            <span className="text-sm font-black text-on-surface-dim uppercase tracking-[0.4em] mb-8 opacity-40">Boeing / Airbus on Bay</span>
          </div>

          <div className="relative z-10 flex space-x-3 h-2 w-full max-w-xl mb-4">
            <div className="flex-1 bg-primary rounded-full shadow-premium"></div>
            <div className="flex-1 bg-primary rounded-full shadow-premium"></div>
            <div className="flex-1 bg-primary rounded-full shadow-premium"></div>
            <div className="flex-1 bg-primary rounded-full shadow-premium"></div>
            <div className="flex-1 bg-on-surface/5 rounded-full"></div>
          </div>

          {/* Abstract Background Element */}
          <div className="absolute -right-20 -bottom-20 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
        </div>

        {/* Critical Alerts Panel */}
        <div className="card-premium bg-error/5 border-error/10 p-10 flex flex-col group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-error/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          
          <div className="flex items-center justify-between mb-10 relative z-10">
             <h3 className="label-sm text-error font-black tracking-[0.2em]">Tactical Alerts (2)</h3>
             <AlertTriangle className="w-6 h-6 text-error opacity-40" />
          </div>
          
          <div className="space-y-6 flex-1 relative z-10">
             <div className="card-premium p-6 border-error/20 bg-surface-container/50 hover:bg-surface-container hover:scale-[1.02] transition-all cursor-pointer group/item relative overflow-hidden shadow-premium">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-error"></div>
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-[11px] font-black text-error uppercase mb-1 tracking-widest">TK-8 Depletion</p>
                      <p className="text-sm font-bold text-on-surface opacity-70">Level: 14.2% (CRITICAL)</p>
                   </div>
                   <Clock className="w-5 h-5 text-on-surface-dim opacity-20 group-hover/item:text-error transition-colors" />
                </div>
             </div>
             
             <div className="card-premium p-6 border-error/20 bg-surface-container/50 hover:bg-surface-container hover:scale-[1.02] transition-all cursor-pointer group/item relative overflow-hidden shadow-premium">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-error"></div>
                <div className="flex justify-between items-start">
                   <div>
                      <p className="text-[11px] font-black text-error uppercase mb-1 tracking-widest">Metering Error</p>
                      <p className="text-sm font-bold text-on-surface opacity-70">Flow Bay 3 Calibration Fail</p>
                   </div>
                   <Activity className="w-5 h-5 text-on-surface-dim opacity-20 group-hover/item:text-error transition-colors" />
                </div>
             </div>
          </div>
          
          <button className="w-full mt-10 py-5 text-[10px] font-black uppercase text-error hover:bg-error/10 border border-error/20 rounded-2xl transition-all tracking-[0.4em] relative z-10">
             System Mitigation Overview
          </button>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="card-premium p-10 group hover:border-primary/30">
          <p className="label-sm text-on-surface-dim opacity-40 mb-10 font-bold tracking-[0.2em]">Total Jet A-1 Stock</p>
          <div className="flex items-baseline space-x-4 mb-4">
            <h3 className="text-5xl font-[900] text-on-surface tracking-tighter">13.03M</h3>
            <span className="text-[11px] font-black text-success flex items-center bg-success/10 px-4 py-1.5 rounded-full border border-success/10">
              <TrendingUp className="w-4 h-4 mr-2" /> +0.2%
            </span>
          </div>
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-30 mt-4">System Standard vs 24H</p>
        </div>

        <div className="card-premium p-10 group hover:border-primary/30">
          <p className="label-sm text-on-surface-dim opacity-40 mb-10 font-bold tracking-[0.2em]">Operational Buffer</p>
          <div className="flex items-baseline space-x-4 mb-4">
            <h3 className="text-5xl font-[900] text-on-surface tracking-tighter">12.5 <span className="text-2xl font-bold opacity-20">DAYS</span></h3>
            <span className="bg-success/10 text-success border border-success/20 text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em] ml-6 shadow-sm">
              Optimal
            </span>
          </div>
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-30 mt-4">Dynamic Forecast Projection</p>
        </div>

        <div className="card-premium p-10 overflow-hidden relative group hover:border-primary/30">
          <p className="label-sm text-on-surface-dim opacity-40 mb-10 font-bold tracking-[0.2em]">Service Reliability</p>
          <div className="flex items-baseline space-x-4 mb-8">
            <h3 className="text-5xl font-[900] text-on-surface tracking-tighter">94.2%</h3>
            <span className="text-[10px] font-black text-on-surface-dim ml-6 opacity-40 uppercase tracking-widest whitespace-nowrap">KPI: 96%</span>
          </div>
          <div className="w-full bg-surface-dim border border-outline h-3.5 rounded-full overflow-hidden shadow-inner">
            <div className="bg-primary h-full rounded-full shadow-premium transition-all duration-[1500ms] cubic-bezier(0.16, 1, 0.3, 1)" style={{width: '94.2%'}}></div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="card-premium p-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-16">
          <div>
            <h3 className="headline-lg text-on-surface tracking-tighter font-black">Tactical Uplift Performance</h3>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.4em] mt-3 opacity-40">Planned Target vs Live Operational Stream</p>
          </div>
          <div className="flex items-center space-x-12 bg-surface-dim p-5 rounded-[22px] border border-outline">
             <div className="flex items-center space-x-4">
                <div className="w-8 h-0.5 border-t-2 border-dashed border-on-surface-dim opacity-30"></div>
                <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest">Base Target</span>
             </div>
             <div className="flex items-center space-x-4">
                <div className="w-8 h-1.5 bg-primary rounded-full shadow-premium"></div>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Live Flow</span>
             </div>
          </div>
        </div>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HOURLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" />
              <XAxis 
                dataKey="hour" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 800, fill: 'var(--color-on-surface-dim)'}} 
                dy={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 800, fill: 'var(--color-on-surface-dim)'}} 
                hide 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--color-surface-container)', borderRadius: '20px', border: '1px solid var(--color-outline)', boxShadow: 'var(--shadow-lg)', padding: '20px' }}
                itemStyle={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase' }}
                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1 }}
              />
              <Line 
                type="monotone" 
                dataKey="jetA1" 
                stroke="var(--color-primary)" 
                strokeWidth={5} 
                dot={{r: 0}} 
                activeDot={{r: 10, stroke: 'var(--color-surface-container)', strokeWidth: 4, fill: 'var(--color-primary)'}} 
              />
              <Line 
                type="monotone" 
                dataKey="diesel" 
                stroke="var(--color-on-surface-dim)" 
                strokeWidth={2} 
                strokeDasharray="10 10" 
                opacity={0.3}
                dot={{r: 0}} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tank Farm Section - Secondary */}
      <div className="card-premium p-10">
        <h4 className="label-sm text-on-surface-dim mb-10 tracking-[0.3em] font-black opacity-40">Infrastructure Asset Grid</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {tanks.map(tank => {
            const isLow = tank.currentLevel < tank.safeMinLevel;
            const fillPct = (tank.currentLevel / tank.capacity) * 100;
            return (
              <div key={tank.id} className="group cursor-pointer">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-[12px] font-black text-on-surface-dim uppercase tracking-tighter group-hover:text-primary transition-colors">{tank.name}</span>
                    {isLow ? <AlertTriangle className="w-3.5 h-3.5 text-error animate-pulse" /> : <div className="w-2 h-2 bg-success/30 rounded-full"></div>}
                 </div>
                 <div className="h-2 bg-surface-dim border border-outline rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-[2000ms] cubic-bezier(0.16, 1, 0.3, 1) ${isLow ? 'bg-error shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-premium'}`} 
                      style={{ width: `${fillPct}%` }}
                    ></div>
                 </div>
                 <p className="text-[10px] font-black text-on-surface-dim mt-3 opacity-30 uppercase tracking-widest">{fillPct.toFixed(0)}% Utilized</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-12 max-w-[1600px] mx-auto pb-24">
      {/* If ITP Operator, show specific view */}
      {isItpOperator ? renderOperatorDashboard() : (
        <>
            {/* View Switcher for Admins/Execs - Refined */}
            {isDualRole && (
                <div className="mb-10 flex justify-start">
                    <div className="bg-surface-dim p-2 rounded-[22px] border border-outline flex space-x-2 shadow-inner">
                        <button
                            onClick={() => setViewMode('DEPOT')}
                            className={`px-8 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                viewMode === 'DEPOT' 
                                ? 'bg-primary text-white shadow-xl shadow-primary/30' 
                                : 'text-on-surface-dim hover:text-on-surface'
                            }`}
                        >
                            Depot Task
                        </button>
                        <button
                            onClick={() => setViewMode('ITP')}
                            className={`px-8 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                viewMode === 'ITP' 
                                ? 'bg-primary text-white shadow-xl shadow-primary/30' 
                                : 'text-on-surface-dim hover:text-on-surface'
                            }`}
                        >
                            ITP Operations
                        </button>
                    </div>
                </div>
            )}

            {/* Conditionally Render View */}
            {viewMode === 'ITP' ? renderItpDashboard() : renderDepotDashboard()}
        </>
      )}
    </div>
  );
};
