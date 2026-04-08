
import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { MOCK_ALERTS, MOCK_USERS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS } from '../constants';
import { FuelType, Tank, User, UserRole, FlightJob } from '../types';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Droplet, Users, Clock, Plane, LayoutDashboard, MapPin, CheckCircle, Truck } from 'lucide-react';
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
}

export const Dashboard: React.FC<DashboardProps> = ({ tanks, user }) => {
  // Logic to determine initial view and if switching is allowed
  const isItpManager = user.role === UserRole.ITP_MANAGER;
  const isItpOperator = user.role === UserRole.ITP_OPERATOR;
  const isDualRole = [UserRole.ADMIN, UserRole.EXECUTIVE].includes(user.role);
  
  const [viewMode, setViewMode] = useState<'ITP' | 'DEPOT'>(
    isItpManager ? 'ITP' : 'DEPOT'
  );

  const [myDomesticTeam, setMyDomesticTeam] = useState<any>(null);
  const [myEquipment, setMyEquipment] = useState<any>(null);
  const [shiftBriefingInfo, setShiftBriefingInfo] = useState<any[]>([]);

  useEffect(() => {
    if (isItpOperator) {
      const fetchAssignments = async () => {
        try {
          const todayDate = new Date().toISOString().split('T')[0];
          
          // Check Domestic
          const domesticData = await supabaseService.getDomesticAssignments(todayDate);
          if (domesticData) {
            const myTeam = domesticData.find(d => d.operator1_id === user.id || d.operator2_id === user.id);
            if (myTeam) setMyDomesticTeam(myTeam);
          }

          // Check Equipment (both DAILY and DIESEL)
          const dailyEquipmentData = await supabaseService.getEquipmentAssignments(todayDate, 'DAILY');
          const dieselEquipmentData = await supabaseService.getEquipmentAssignments(todayDate, 'DIESEL');
          
          const allEquipmentData = [...(dailyEquipmentData || []), ...(dieselEquipmentData || [])];
          const myEqs = allEquipmentData.filter(d => d.operator1_id === user.id || d.operator2_id === user.id);
          
          if (myEqs.length > 0) {
            setMyEquipment(myEqs); // Store array of assignments
          }

          // Fetch Shift Briefing Info
          const briefingData = await supabaseService.getShiftBriefingInfo(todayDate);
          if (briefingData && briefingData.length > 0) {
            setShiftBriefingInfo(briefingData);
          }
        } catch (error) {
          console.error("Error fetching assignments", error);
        }
      };
      fetchAssignments();
    }
  }, [isItpOperator, user.id]);

  const totalJetA1 = tanks.filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.currentLevel, 0);
  const maxJetA1 = tanks.filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.capacity, 0);
  const percentage = Math.round((totalJetA1 / maxJetA1) * 100);

  const stockData = [
    { name: 'Available', value: totalJetA1 },
    { name: 'Ullage (Empty)', value: maxJetA1 - totalJetA1 },
  ];

  const operators = MOCK_USERS.filter(u => u.role === UserRole.ITP_OPERATOR);

  // --- Sub-Component: Operator Dashboard (My Tasks) ---
  const renderOperatorDashboard = () => {
    // STRICT filtering for RBAC: Only show jobs assigned to current user
    const myTasks = MOCK_JOBS.filter(job => job.assignedTo === user.id);
    const myDomesticFlights = myDomesticTeam 
      ? MOCK_DOMESTIC_FLIGHTS.filter(f => f.assignedTeam === myDomesticTeam.team_name)
      : [];
    
    const hasAnyTasks = myTasks.length > 0 || myDomesticTeam || myEquipment;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
                <p className="text-slate-500">Welcome back, {user.name}</p>
            </div>
            <div className="bg-aviation-50 text-aviation-700 px-4 py-2 rounded-lg font-bold border border-aviation-100 flex items-center">
                <LayoutDashboard className="w-5 h-5 mr-2" />
                {myTasks.length + myDomesticFlights.length} Active Flights
            </div>
        </div>

        {!hasAnyTasks && (
            <div className="bg-white p-10 text-center rounded-xl border border-dashed border-gray-300">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No pending tasks assigned.</p>
            </div>
        )}

        {/* Shift Briefing Info */}
        {shiftBriefingInfo.length > 0 && (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Shift Briefing Info</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                        <ul className="list-disc pl-5 space-y-2 text-slate-700">
                            {shiftBriefingInfo.map((info: any, index: number) => (
                                <li key={index} className="text-sm font-medium">{info.text}</li>
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
                        {myDomesticFlights.map((flight) => (
                            <div key={flight.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-4 flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-xl font-black text-slate-800">{flight.flightNumber}</span>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                                                {flight.aircraftReg}
                                            </span>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                            flight.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                            flight.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {flight.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-slate-500 mt-2 text-sm">
                                        <MapPin className="w-4 h-4 mr-1 text-blue-500" />
                                        Stand {flight.stand}
                                        <span className="mx-2">•</span>
                                        <Plane className="w-4 h-4 mr-1" />
                                        {flight.aircraftType}
                                        <span className="mx-2">•</span>
                                        <Clock className="w-4 h-4 mr-1" />
                                        ETA: {flight.eta}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 w-full md:w-40">
                                     {flight.status !== 'COMPLETED' ? (
                                        <button className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 shadow-sm text-sm">
                                            Open Job
                                        </button>
                                     ) : (
                                        <button disabled className="w-full bg-gray-200 text-gray-500 font-bold py-2 rounded-lg text-sm cursor-not-allowed">
                                            View Details
                                        </button>
                                     )}
                                </div>
                            </div>
                        ))}
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
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Assigned International Flights</h3>
                {myTasks.map((job) => (
                    <div key={job.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-aviation-500 overflow-hidden flex flex-col md:flex-row">
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-3">
                                    <span className="text-3xl font-black text-slate-800">{job.flightNumber}</span>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                                        {job.aircraftReg}
                                    </span>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                    job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                    job.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {job.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="flex items-center text-slate-500 mt-2 text-sm">
                                <MapPin className="w-4 h-4 mr-1 text-aviation-500" />
                                Stand {job.stand}
                                <span className="mx-2">•</span>
                                <Plane className="w-4 h-4 mr-1" />
                                {job.aircraftType}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 w-full md:w-48">
                             <div className="text-xs text-slate-400 font-bold uppercase mb-1">Action</div>
                             {job.status !== 'COMPLETED' ? (
                                <button className="w-full bg-aviation-600 text-white font-bold py-2 rounded-lg hover:bg-aviation-700 shadow-sm text-sm">
                                    Open Job
                                </button>
                             ) : (
                                <button disabled className="w-full bg-gray-200 text-gray-500 font-bold py-2 rounded-lg text-sm cursor-not-allowed">
                                    View Details
                                </button>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    );
  };

  // --- Sub-Component: ITP Dashboard ---
  const renderItpDashboard = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="flex items-center justify-between">
           <div>
              <h2 className="text-2xl font-bold text-slate-900">Into-Plane Operations Center</h2>
              <p className="text-slate-500">Real-time flight refueling oversight</p>
           </div>
           <div className="px-4 py-2 bg-aviation-50 text-aviation-700 rounded-lg text-sm font-bold border border-aviation-100">
              Shift: Morning (06:00 - 14:00)
           </div>
        </div>

        {/* ITP Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm font-medium text-slate-500">Scheduled Flights</p>
                   <h3 className="text-3xl font-bold text-slate-900 mt-1">42</h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg"><Plane className="w-6 h-6 text-blue-600" /></div>
             </div>
             <div className="mt-4 text-xs text-slate-400">12 Pending / 8 In-Progress</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm font-medium text-slate-500">Uplift Volume (Today)</p>
                   <h3 className="text-3xl font-bold text-slate-900 mt-1">164,000 L</h3>
                </div>
                <div className="p-2 bg-green-50 rounded-lg"><Droplet className="w-6 h-6 text-green-600" /></div>
             </div>
             <div className="mt-4 text-xs text-green-600 font-bold">+5.2% vs Forecast</div>
          </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm font-medium text-slate-500">Active Staff</p>
                   <h3 className="text-3xl font-bold text-slate-900 mt-1">{operators.length}</h3>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg"><Users className="w-6 h-6 text-purple-600" /></div>
             </div>
             <div className="mt-4 text-xs text-slate-400">All operators online</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex justify-between items-start">
                <div>
                   <p className="text-sm font-medium text-slate-500">Avg. Turnaround</p>
                   <h3 className="text-3xl font-bold text-slate-900 mt-1">32m</h3>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg"><Clock className="w-6 h-6 text-orange-600" /></div>
             </div>
             <div className="mt-4 text-xs text-green-600 font-bold">-2m vs Target</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Flight Volume Chart */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Hourly Operations Activity</h3>
              <div className="h-72">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={HOURLY_DATA}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} />
                       <YAxis axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                       <Bar dataKey="flights" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Flights Served" />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Performance Donut */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">On-Time Performance</h3>
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
                  <span className="text-3xl font-bold text-slate-800">85%</span>
                  <span className="text-xs text-slate-500">On Time</span>
                </div>
              </div>
           </div>
        </div>

        {/* Staff Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Operator Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operators.map((op, idx) => (
                    <div key={op.id} className="flex items-center p-3 border border-gray-200 rounded-lg">
                        <div className={`w-3 h-3 rounded-full mr-3 ${idx === 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <img src={op.avatar} alt="" className="w-8 h-8 rounded-full mr-3" />
                        <div>
                            <p className="text-sm font-bold text-slate-900">{op.name}</p>
                            <p className="text-xs text-slate-500">{idx === 0 ? 'Available at Stand D12' : 'Refueling EK650'}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
  );

  // --- Sub-Component: Depot Dashboard ---
  const renderDepotDashboard = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Jet A-1 Stock</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalJetA1.toLocaleString()} L</h3>
            </div>
            <div className="p-2 bg-aviation-50 rounded-lg">
              <Droplet className="w-6 h-6 text-aviation-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
             <span className="text-green-500 font-medium flex items-center"><TrendingUp className="w-4 h-4 mr-1"/> Stable</span>
             <span className="text-slate-400 ml-2">vs last 24h</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Refuelings</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">8 Ops</h3>
            </div>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Activity className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
             <span className="text-slate-400">Peak expected at 18:00</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Critical Alerts</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{MOCK_ALERTS.filter(a => !a.acknowledged).length}</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
             <span className="text-red-500 font-medium cursor-pointer hover:underline">View Details</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Days Cover</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">12.5 Days</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
          </div>
           <div className="mt-4 w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
           </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Stock Overview */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
          <h4 className="text-lg font-bold text-slate-800 mb-6">Jet A-1 Capacity</h4>
          <div className="h-64 relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={stockData}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                 >
                   {stockData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={index === 0 ? '#0ea5e9' : '#e2e8f0'} />
                   ))}
                 </Pie>
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-slate-800">{percentage}%</span>
                <span className="text-xs text-slate-500">Full</span>
             </div>
          </div>
        </div>

        {/* Right: Uplift Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h4 className="text-lg font-bold text-slate-800 mb-6">Today's Uplift Volume</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={HOURLY_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="jetA1" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="diesel" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tank Details Grid */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="text-lg font-bold text-slate-800 mb-6">Tank Farm Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tanks.map(tank => {
            const isLow = tank.currentLevel < tank.safeMinLevel;
            const fillPct = (tank.currentLevel / tank.capacity) * 100;
            return (
              <div key={tank.id} className="p-4 border border-gray-200 rounded-lg hover:border-aviation-300 transition-colors">
                 <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-700">{tank.name}</span>
                    {isLow && <AlertTriangle className="w-4 h-4 text-red-500" />}
                 </div>
                 <div className="text-2xl font-bold text-slate-900 mb-1">{tank.currentLevel.toLocaleString()} L</div>
                 <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className={`h-2 rounded-full ${isLow ? 'bg-red-500' : 'bg-aviation-500'}`} 
                      style={{ width: `${fillPct}%` }}
                    ></div>
                 </div>
                 <div className="text-xs text-slate-500 flex justify-between">
                    <span>{tank.type}</span>
                    <span>{fillPct.toFixed(1)}%</span>
                 </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* If ITP Operator, show specific view */}
      {isItpOperator ? renderOperatorDashboard() : (
        <>
            {/* View Switcher for Admins/Execs */}
            {isDualRole && (
                <div className="mb-6 flex justify-center">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex">
                        <button
                            onClick={() => setViewMode('DEPOT')}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                viewMode === 'DEPOT' 
                                ? 'bg-aviation-100 text-aviation-800 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'
                            }`}
                        >
                            <Droplet className="w-4 h-4 mr-2" />
                            Depot / Stock
                        </button>
                        <div className="w-px bg-gray-200 mx-1 my-2"></div>
                        <button
                            onClick={() => setViewMode('ITP')}
                            className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                viewMode === 'ITP' 
                                ? 'bg-aviation-100 text-aviation-800 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50'
                            }`}
                        >
                            <Plane className="w-4 h-4 mr-2" />
                            Into-Plane
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
