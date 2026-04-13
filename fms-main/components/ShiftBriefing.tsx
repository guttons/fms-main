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
  UserCheck, 
  Activity,
  AlertTriangle,
  ChevronRight,
  User as UserIcon
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
  const [additionalInfo, setAdditionalInfo] = useState([
    { text: 'Ready before 15 mins/PPE/360 Walkaround check/Following speed limits/Marshaling when required', type: 'critical' },
    { text: 'Officers should NOT stay inside the Bowser while refuelling is in progress', type: 'standard' },
    { text: 'The officer and operator have the responsibility to check and complete the daily refueller check', type: 'standard' },
    { text: 'All hose related issues must be reported with specific hose identification number clearly stated', type: 'standard' },
    { text: 'Rf 16 & 17 check if gear changed to NEUTRAL after parking', type: 'standard' },
  ]);

  const [staffAssignments, setStaffAssignments] = useState({
    officers: ['u1'], // Default IDs
    operators: ['u3', 'u3b'],
    supervisor: 'u2',
    inCharge: 'u2b'
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
        const data = await supabaseService.getShiftBriefingInfo(todayDate);
        if (data && data.length > 0) {
          setAdditionalInfo(data);
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
      await supabaseService.upsertShiftBriefingInfo(todayDate, additionalInfo);
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

  const renderStaffSelect = (value: string, role: UserRole, label: string, onSelect: (id: string) => void) => {
    const roleUsers = MOCK_USERS.filter(u => u.role === role);
    return (
      <div className="flex flex-col space-y-1">
        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</label>
        <select 
          value={value}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-primary-bright transition-colors cursor-pointer"
        >
          <option value="" className="bg-slate-900">-- Unassigned --</option>
          {roleUsers.map(u => (
            <option key={u.id} value={u.id} className="bg-slate-900">{u.name}</option>
          ))}
        </select>
      </div>
    );
  };

  const getUserName = (id: string) => MOCK_USERS.find(u => u.id === id)?.name || 'Unassigned';

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500 min-h-full bg-[#00142D]">
      
      {/* Tactical Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <div className="bg-primary-bright text-white p-2 rounded-lg shadow-lg shadow-primary-bright/20">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="headline-lg text-white mb-0">SHIFT INFRASTRUCTURE <span className="text-primary-bright font-medium">BRIEFING</span></h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center space-x-2">
              <Clock className="w-3 h-3 text-primary-bright" />
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{briefingDate} | {currentTime}</span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">LIVE OPS MODE</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center px-6 py-3 bg-primary-bright text-white font-black text-xs rounded-xl hover:bg-white hover:text-slate-900 transition-all active:scale-95 shadow-xl shadow-primary-bright/20 uppercase tracking-widest disabled:opacity-50 group"
        >
          <Save className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
          {isSaving ? 'ARCHIVING...' : 'AUTHORIZE & SAVE'}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Operations Overview */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* International Flights Card */}
            <div className="glass-surface rounded-3xl p-6 border-white/10 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Plane className="w-5 h-5 text-primary-bright" />
                  <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">International Ops</h3>
                </div>
                <span className="bg-primary-bright/20 text-primary-bright px-3 py-1 rounded-full text-[10px] font-black">{MOCK_JOBS.length} FLIGHTS</span>
              </div>
              <div className="space-y-3">
                {MOCK_JOBS.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/20 transition-all cursor-default">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-primary-bright/10 flex items-center justify-center font-black text-primary-bright text-xs">
                        {job.stand}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{job.flightNumber}</div>
                        <div className="text-[10px] text-white/40 font-bold uppercase">{job.aircraftType}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                        job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 
                        job.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500' : 'bg-white/10 text-white/60'
                      }`}>
                        {job.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Domestic Flights Card */}
            <div className="glass-surface rounded-3xl p-6 border-white/10 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 text-primary-bright" />
                  <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Domestic Ops</h3>
                </div>
                <span className="bg-primary-bright/20 text-primary-bright px-3 py-1 rounded-full text-[10px] font-black">{MOCK_DOMESTIC_FLIGHTS.length} FLIGHTS</span>
              </div>
              <div className="space-y-3">
                {MOCK_DOMESTIC_FLIGHTS.slice(0, 4).map((flight) => (
                  <div key={flight.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/20 transition-all cursor-default">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-white/60 text-xs">
                        {flight.stand}
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">{flight.flightNumber}</div>
                        <div className="text-[10px] text-white/40 font-bold uppercase">ETA: {flight.eta}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                        flight.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' : 
                        flight.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-500' : 'bg-white/10 text-white/60'
                      }`}>
                        {flight.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tactical Briefing Points */}
          <div className="card-premium glass-surface border-white/10 p-8 rounded-[32px] space-y-6">
            <div className="flex items-center space-x-3 mb-2">
              <ClipboardList className="w-5 h-5 text-primary-bright" />
              <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Strategic Briefing Points</h3>
            </div>
            <div className="space-y-4">
              {additionalInfo.map((info, i) => (
                <div key={i} className={`flex items-start space-x-4 p-4 rounded-2xl border transition-all ${
                  info.type === 'critical' ? 'bg-error/10 border-error/30 text-white' : 'bg-white/5 border-white/5 text-white/80'
                }`}>
                  <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 animate-pulse ${
                    info.type === 'critical' ? 'bg-error shadow-[0_0_10px_rgba(186,26,26,0.8)]' : 'bg-primary-bright shadow-[0_0_10px_rgba(14,165,233,0.8)]'
                  }`}></div>
                  <input 
                    type="text"
                    value={info.text}
                    onChange={(e) => {
                      const newInfo = [...additionalInfo];
                      newInfo[i].text = e.target.value;
                      setAdditionalInfo(newInfo);
                    }}
                    className="bg-transparent border-none focus:ring-0 p-0 m-0 w-full text-sm font-bold placeholder:text-white/20"
                  />
                  {info.type === 'critical' && <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Personnel & Equipment */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Staff Matrix */}
          <div className="glass-surface border-white/10 p-8 rounded-[32px] space-y-8 shadow-2xl">
            <div className="flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-primary-bright" />
              <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Tactical Staffing</h3>
            </div>
            
            <div className="space-y-6">
              {/* Shift Command */}
              <div className="grid grid-cols-2 gap-4">
                {renderStaffSelect(staffAssignments.supervisor, UserRole.ITP_MANAGER, "Duty Supervisor", (id) => setStaffAssignments(prev => ({ ...prev, supervisor: id })))}
                {renderStaffSelect(staffAssignments.inCharge, UserRole.DEPOT_MANAGER, "Shift In-Charge", (id) => setStaffAssignments(prev => ({ ...prev, inCharge: id })))}
              </div>

              {/* Functional Units */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex flex-col space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Command Officers</label>
                  <div className="grid grid-cols-1 gap-2">
                    {staffAssignments.officers.map((id, idx) => (
                      <div key={idx} className="flex items-center bg-white/5 border border-white/5 rounded-xl p-3">
                        <UserIcon className="w-4 h-4 text-primary-bright mr-3" />
                        <span className="text-xs font-bold text-white">{getUserName(id)}</span>
                        <ChevronRight className="w-3 h-3 ml-auto text-white/20" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Active Operators</label>
                  <div className="grid grid-cols-1 gap-2">
                    {staffAssignments.operators.map((id, idx) => (
                      <div key={idx} className="flex items-center bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-xs font-bold text-white">{getUserName(id)}</span>
                        <ChevronRight className="w-3 h-3 ml-auto text-white/20" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equipment Readiness (RF & HD ONLY) */}
          <div className="glass-surface border-white/10 p-8 rounded-[32px] space-y-6">
            <div className="flex items-center space-x-3">
              <Truck className="w-5 h-5 text-primary-bright" />
              <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Fleet Readiness (RF/HD)</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {rfHdEquipment.map((eq) => (
                <div key={eq.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col space-y-2 group hover:bg-white/10 transition-all cursor-default">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-white">{eq.id}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      eq.status === EquipmentStatus.AVAILABLE ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                  </div>
                  <div className="text-[9px] font-bold text-white/30 uppercase">{eq.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ongoing Tasks & Remarks */}
          <div className="glass-surface border-white/10 p-8 rounded-[32px] space-y-6">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-5 h-5 text-primary-bright" />
              <h3 className="text-xs font-black text-white/80 uppercase tracking-widest">Mission Remarks</h3>
            </div>
            <textarea 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white/80 focus:border-primary-bright outline-none min-h-[120px] resize-none"
              placeholder="Enter shift remarks here..."
            />
          </div>

        </div>
      </div>
    </div>
  );
};
