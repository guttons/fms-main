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
  UserCheck
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { MOCK_USERS, MOCK_JOBS, MOCK_DOMESTIC_FLIGHTS, EQUIPMENT } from '../constants';
import { User, UserRole, EquipmentType, EquipmentStatus } from '../types';

export const ShiftBriefing: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [briefingDate] = useState(new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  }));
  const [currentTime] = useState(new Date().toLocaleTimeString('en-GB', { 
    hour: '2-digit', minute: '2-digit' 
  }));

  // Initial Data
  const [additionalInfo, setAdditionalInfo] = useState<{text: string, type: string, isHighAlert?: boolean}[]>([
    { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'critical', isHighAlert: true },
    { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'standard' },
    { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'standard' },
    { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'standard' },
    { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'standard' },
  ]);
  
  const [dieselNeeds, setDieselNeeds] = useState<string[]>([]);

  const [staffAssignments, setStaffAssignments] = useState({
    activeOperators: ['u3', 'u3b'],
    activeOfficers: ['u1'],
    hydrantOpsOfficers: ['u7'],
    dutySupervisor: 'u2',
    shiftInCharge: 'u2b'
  });

  const [ongoingTasks, setOngoingTasks] = useState({
    int: 'Preparing for morning wave of arrivals',
    dom: '3 teams active for Dash-8 operations',
    adhoc: 'No adhoc requests currently',
    vvip: 'VVIP flight expected at 14:00'
  });

  const [remarks, setRemarks] = useState('Safety first. Ensure all grounding cables are checked before each operation.');

  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadBriefing = async () => {
      try {
        const data = await supabaseService.getShiftBriefingInfo(todayDate) as any;
        if (data) {
          if (data.info && data.info.length > 0) setAdditionalInfo(data.info);
          if (data.dieselNeeds) setDieselNeeds(data.dieselNeeds);
        }
      } catch (error) {
        console.error("Failed to load shift briefing:", error);
      }
    };
    loadBriefing();
  }, [todayDate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await supabaseService.upsertShiftBriefingInfo(todayDate, additionalInfo, dieselNeeds);
      // In a real app, we would also save staffAssignments and tasks
      alert('Shift briefing saved successfully!');
    } catch (error) {
      console.error("Failed to save shift briefing:", error);
      alert('Failed to save shift briefing.');
    } finally {
      setIsSaving(false);
    }
  };

  const rfHdEquipment = EQUIPMENT.filter(eq => 
    eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER
  );

  const renderStaffSelect = (value: string, roles: UserRole[], label: string, onSelect: (id: string) => void) => {
    const roleUsers = MOCK_USERS.filter(u => roles.includes(u.role));
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

  const getUserName = (id: string) => MOCK_USERS.find(u => u.id === id)?.name || 'Unassigned';

  return (
    <div className="p-6 lg:p-10 space-y-10 animate-in fade-in duration-700 min-h-screen relative overflow-y-auto custom-scrollbar transition-colors">
      
      {/* Dynamic Background Pulse */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-64 -mt-64 pointer-events-none"></div>

      {/* Tactical Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center space-x-5">
            <div className="bg-primary text-white p-4 rounded-2xl shadow-premium transform hover:scale-110 transition-transform">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="headline-lg tracking-tighter mb-1 uppercase">
                SHIFT INFRASTRUCTURE <span className="text-primary font-medium italic">BRIEFING</span>
              </h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 px-3 py-1 bg-surface-dim rounded-full border border-outline">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{briefingDate} | {currentTime}</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-1 bg-success/10 rounded-full border border-success/20">
                  <div className="dot-live"></div>
                  <span className="text-[10px] font-black text-success uppercase tracking-widest ml-1">SYSTEMS ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn-command px-10 py-5 rounded-3xl shadow-premium group hover:scale-[1.02] active:scale-95 bg-primary text-white transition-all font-black uppercase tracking-widest text-[11px]"
        >
          <Save className="w-4.5 h-4.5 mr-3 group-hover:rotate-12 transition-transform" />
          {isSaving ? 'ARCHIVING OPS DATA...' : 'AUTHORIZE & COMMIT'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: Operations & Personnel */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* International Flights Card */}
            <div className="card-premium p-8 space-y-8 group hover:border-primary/20">
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
                      <div className="w-14 h-14 rounded-[20px] bg-primary text-white flex items-center justify-center font-black text-base shadow-lg group-hover/item:scale-105 transition-transform">
                        {job.stand}
                      </div>
                      <div>
                        <div className="text-base font-black tracking-tight text-on-surface">{job.flightNumber}</div>
                        <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">{job.aircraftType}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${
                      job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/10' : 
                      job.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500 animate-pulse border border-amber-500/10' : 'bg-on-surface/5 opacity-40 border border-transparent'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Domestic Flights Card */}
            <div className="card-premium p-8 space-y-8 group hover:border-primary/20">
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
                      <div className="w-14 h-14 rounded-[20px] bg-surface-container border border-outline flex items-center justify-center font-black text-base group-hover/item:text-primary transition-colors text-on-surface">
                        {flight.stand}
                      </div>
                      <div>
                        <div className="text-base font-black tracking-tight text-on-surface">{flight.flightNumber}</div>
                        <div className="text-[10px] opacity-40 font-bold uppercase tracking-wider text-on-surface">ETA: {flight.eta}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${
                      flight.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/10' : 
                      flight.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' : 'bg-on-surface/5 opacity-40 border border-transparent'
                    }`}>
                      {flight.status.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PERSONNEL SECTOR: Split into 4 Separate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Active Operators Card */}
            <div className="card-premium p-8 space-y-6 group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-success/5 rounded-xl">
                  <Users className="w-6 h-6 text-success" />
                </div>
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Operators</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {staffAssignments.activeOperators.map((id, idx) => (
                  <div key={idx} className="flex items-center bg-surface-dim border border-outline rounded-2xl p-4 group/user hover:border-primary/30 transition-all hover:bg-surface-container shadow-sm">
                    <div className="w-3 h-3 bg-success rounded-full mr-4 shadow-[0_0_12px_rgba(34,197,94,0.4)]"></div>
                    <span className="text-sm font-black tracking-tight text-on-surface">{getUserName(id)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Officers Card */}
            <div className="card-premium p-8 space-y-6 group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/5 rounded-xl">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Active Officers</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {staffAssignments.activeOfficers.map((id, idx) => (
                  <div key={idx} className="flex items-center bg-surface-dim border border-outline rounded-2xl p-4 group/user hover:border-primary/30 transition-all hover:bg-surface-container shadow-sm">
                    <div className="w-3 h-3 bg-primary rounded-full mr-4 shadow-[0_0_12px_rgba(14,165,233,0.4)]"></div>
                    <span className="text-sm font-black tracking-tight text-on-surface">{getUserName(id)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hydrant Ops Officers Card */}
            <div className="card-premium p-8 space-y-6 group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-amber-500/5 rounded-xl">
                  <Droplet className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Hydrant Ops Officers</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {staffAssignments.hydrantOpsOfficers.length > 0 ? staffAssignments.hydrantOpsOfficers.map((id, idx) => (
                  <div key={idx} className="flex items-center bg-surface-dim border border-outline rounded-2xl p-4 group/user hover:border-primary/30 transition-all hover:bg-surface-container shadow-sm">
                    <div className="w-3 h-3 bg-amber-500 rounded-full mr-4 shadow-[0_0_12px_rgba(245,158,11,0.4)]"></div>
                    <span className="text-sm font-black tracking-tight text-on-surface">{getUserName(id)}</span>
                  </div>
                )) : (
                  <div className="text-[10px] font-bold opacity-20 uppercase italic text-center py-4 border border-dashed border-outline rounded-2xl">No officers assigned</div>
                )}
              </div>
            </div>

            {/* Supervisors & Managers Card */}
            <div className="card-premium p-8 space-y-6 group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary/5 rounded-xl">
                  <UserCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Staffing Management</h3>
              </div>
              <div className="space-y-6">
                {renderStaffSelect(staffAssignments.dutySupervisor, [UserRole.ITP_MANAGER], "Duty Supervisor", (id) => setStaffAssignments(prev => ({ ...prev, dutySupervisor: id })))}
                {/* Manager or Incharge will be same - using ITP_MANAGER role for Shift In-Charge selection */}
                {renderStaffSelect(staffAssignments.shiftInCharge, [UserRole.ITP_MANAGER, UserRole.DEPOT_MANAGER], "Shift In-Charge", (id) => setStaffAssignments(prev => ({ ...prev, shiftInCharge: id })))}
              </div>
            </div>
          </div>

          {/* Tactical Briefing Points */}
          <div className="card-premium p-10 space-y-10 relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10 w-full">
              <div className="flex items-center space-x-5">
                <div className="p-4 bg-primary/5 rounded-2xl">
                  <ClipboardList className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Strategic Briefing Points</h3>
              </div>
              <button 
                onClick={() => setAdditionalInfo([...additionalInfo, { text: '', type: 'standard' }])}
                className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all border border-primary/20 flex items-center space-x-2 px-4 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Add Point</span>
              </button>
            </div>
            
            <div className="space-y-6 relative z-10">
              {additionalInfo.map((info, i) => (
                <div key={i} className={`flex items-start space-x-6 p-6 rounded-[28px] border transition-all duration-300 shadow-sm ${
                  info.isHighAlert || info.type === 'critical'
                  ? 'bg-error/5 border-error/20 text-on-surface ring-2 ring-error/10 animate-pulse' 
                  : 'bg-surface-dim border-outline text-on-surface hover:border-primary/30 hover:bg-surface-container'
                }`}>
                  <div className={`mt-2 h-3 w-3 rounded-full flex-shrink-0 ${
                    info.isHighAlert || info.type === 'critical' ? 'bg-error shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                  }`}></div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text"
                      placeholder="Enter briefing directive..."
                      value={info.text}
                      onChange={(e) => {
                        const newInfo = [...additionalInfo];
                        newInfo[i].text = e.target.value;
                        setAdditionalInfo(newInfo);
                      }}
                      className="bg-transparent border-none focus:ring-0 p-0 m-0 w-full text-base font-bold placeholder:opacity-20 selection:bg-primary/20 text-on-surface"
                    />
                  </div>
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Equipment & Remarks (Separated from Staffing) */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Equipment Readiness (Fleet Status) */}
          <div className="card-premium p-10 space-y-10 group">
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
                  <div key={eq.id} className="bg-surface-dim border border-outline rounded-2xl p-5 flex flex-col space-y-4 group/eq hover:bg-surface-container hover:border-primary/20 transition-all cursor-default shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-[900] text-on-surface">{eq.id}</span>
                        <div className={`text-[10px] font-black uppercase tracking-widest ${eq.status === EquipmentStatus.AVAILABLE ? 'text-success' : 'text-error'} opacity-70`}>{eq.status}</div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        eq.status === EquipmentStatus.AVAILABLE ? 'bg-success animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-error shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                      }`}></div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setDieselNeeds(prev => 
                          prev.includes(eq.id) ? prev.filter(id => id !== eq.id) : [...prev, eq.id]
                        );
                      }}
                      className={`flex items-center justify-center space-x-2 py-2 rounded-xl border transition-all ${
                        needsDiesel 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20' 
                        : 'bg-surface border-outline text-on-surface-dim opacity-40 hover:opacity-100 hover:border-amber-500/30'
                      }`}
                    >
                      <Droplet className={`w-3 h-3 ${needsDiesel ? 'animate-bounce' : ''}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">DIESEL TOP-UP</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ongoing Tasks & Remarks (Separated into its own space) */}
          <div className="card-premium p-10 space-y-10 group">
            <div className="flex items-center space-x-5">
              <div className="p-4 bg-primary/5 rounded-2xl">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xs font-black opacity-40 uppercase tracking-[0.3em]">Task Remarks</h3>
            </div>
            <textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-surface-dim border border-outline rounded-[32px] p-8 text-[15px] font-bold text-on-surface opacity-80 focus:border-primary focus:bg-surface-container outline-none min-h-[220px] resize-none transition-all shadow-inner focus:shadow-md"
              placeholder="Enter comprehensive shift remarks here..."
            />
          </div>

        </div>
      </div>
    </div>
  );
};


