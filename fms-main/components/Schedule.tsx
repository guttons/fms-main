import React, { useState, useEffect } from 'react';
import { MOCK_USERS, MOCK_DOMESTIC_FLIGHTS, EQUIPMENT } from '../constants';
import { UserRole, EquipmentType, FlightJob } from '../types';
import { Calendar, Plus, Plane, Clock, Users, Truck, MapPin, ChevronDown, Droplet, Settings, Home } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';

export const Schedule: React.FC = () => {
  const { equipment, flightJobs, briefingInfo, updateFlightJob, addFlightJob } = useOperationalData();
  const [activeTab, setActiveTab] = useState<'international' | 'domestic' | 'equipment' | 'status'>('international');
  const [configuringFlightId, setConfiguringFlightId] = useState<string | null>(null);

  const isDelayed = (sta?: string, eta?: string) => {
    if (!sta || !eta) return false;
    const [staH, staM] = sta.split(':').map(Number);
    const [etaH, etaM] = eta.split(':').map(Number);
    return (etaH * 60 + etaM) > (staH * 60 + staM);
  };

  const [scheduledFlights, setScheduledFlights] = useState(flightJobs);

  useEffect(() => {
    setScheduledFlights(flightJobs);
  }, [flightJobs]);

  const [domesticTeams, setDomesticTeams] = useState([
    { id: 't1', name: 'Team 1', op1: '', op2: '' },
    { id: 't2', name: 'Team 2', op1: '', op2: '' },
    { id: 't3', name: 'Team 3', op1: '', op2: '' },
  ]);

  const currentHour = new Date().getHours();
  const isDieselTime = currentHour >= 15 && currentHour < 23;
  const currentShiftLabel = isDieselTime ? 'DIESEL' : 'DAILY';

  const [equipmentShift, setEquipmentShift] = useState<'DAILY' | 'DIESEL'>(currentShiftLabel);
  const [dieselNeeds, setDieselNeeds] = useState<string[]>(briefingInfo?.dieselNeeds || []);
  
  const rfHdEquipment = (equipment || []).filter(eq => 
    eq && (eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER)
  );

  const [equipmentAssignments, setEquipmentAssignments] = useState(
    (rfHdEquipment || []).map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '', shift_type: equipmentShift, eqType: eq.type }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const operators = MOCK_USERS.filter(u => [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(u.role));
  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (briefingInfo?.dieselNeeds) {
      setDieselNeeds(briefingInfo.dieselNeeds);
    }
  }, [briefingInfo?.dieselNeeds]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Load Domestic Assignments
        const domesticData = await supabaseService.getDomesticAssignments(todayDate);
        if (domesticData && domesticData.length > 0) {
          setDomesticTeams(prev => prev.map(team => {
            const dbTeam = domesticData.find(d => d.team_name === team.name);
            if (dbTeam) {
              return { ...team, op1: dbTeam.operator1_id || '', op2: dbTeam.operator2_id || '' };
            }
            return team;
          }));
        }

        // Load Equipment Assignments
        const equipmentData = await supabaseService.getEquipmentAssignments(todayDate, equipmentShift);
        
        if (equipmentData && equipmentData.length > 0) {
          setEquipmentAssignments(prev => prev.map(eq => {
            const dbEq = equipmentData.find(d => d.equipment_id === eq.eqNumber);
            if (dbEq) {
              return { ...eq, op1: dbEq.operator1_id || '', op2: dbEq.operator2_id || '', shift_type: dbEq.shift_type };
            }
            return eq;
          }));
        } else {
          // Reset if no data for this shift
          setEquipmentAssignments((rfHdEquipment || []).map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '', shift_type: equipmentShift, eqType: eq.type })));
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
      }
    };
    loadAssignments();
  }, [equipmentShift, todayDate, rfHdEquipment.length]);

  const handleAssignFlight = (flightId: string, field: 'assignedTo' | 'assignedOfficer' | 'equipmentUsage', value: string) => {
    updateFlightJob(flightId, { [field]: value });
  };


  const handleAssignDomestic = async (teamId: string, opIndex: 1 | 2, userId: string) => {
    const updatedTeams = domesticTeams.map(t => {
      if (t.id === teamId) {
        return opIndex === 1 ? { ...t, op1: userId } : { ...t, op2: userId };
      }
      return t;
    });
    setDomesticTeams(updatedTeams);

    const team = updatedTeams.find(t => t.id === teamId);
    if (team) {
      try {
        await supabaseService.upsertDomesticAssignment(todayDate, team.name, team.op1, team.op2);
      } catch (error) {
        console.error("Failed to save domestic assignment:", error);
      }
    }
  };

  const handleAssignEquipment = async (eqId: string, opIndex: 1 | 2, userId: string) => {
    const updatedEqs = equipmentAssignments.map(eq => {
      if (eq.id === eqId) {
        return opIndex === 1 ? { ...eq, op1: userId } : { ...eq, op2: userId };
      }
      return eq;
    });
    setEquipmentAssignments(updatedEqs);

    const eq = updatedEqs.find(e => e.id === eqId);
    if (eq) {
      try {
        await supabaseService.upsertEquipmentAssignment(todayDate, eq.eqNumber, equipmentShift, eq.op1, eq.op2);
      } catch (error) {
        console.error("Failed to save equipment assignment:", error);
      }
    }
  };

  const handleAddFlight = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newFlight: FlightJob = {
        id: `sf${Date.now()}`,
        flightNumber: formData.get('flight') as string,
        aircraftReg: formData.get('ac') as string,
        aircraftType: 'B737', // Default or from form
        stand: formData.get('stand') as string,
        sta: formData.get('sta') as string,
        eta: formData.get('eta') as string,
        std: formData.get('std') as string,
        status: 'PENDING',
        assignedTo: ''
    };
    setScheduledFlights(prev => [...prev, newFlight]);
    setIsModalOpen(false);
  };

  const renderOperatorSelect = (value: string, onChange: (val: string) => void) => (
    <div className="relative group/select">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full text-[10px] font-bold rounded-xl focus:border-primary px-3 py-2 border uppercase tracking-wider appearance-none transition-colors ${
          value ? 'bg-surface-dim text-on-surface border-outline' : 'bg-surface-dim text-error border-error/30'
        }`}
      >
        <option value="" className="bg-surface-container text-on-surface">-- UNASSIGNED --</option>
        {operators.map(op => (
          <option key={op.id} value={op.id} className="bg-surface-container text-on-surface">{op.name.toUpperCase()}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-dim opacity-40 pointer-events-none" />
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            SHIFT <span className="text-primary italic font-medium ml-3">OPERATIONS</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em]">FUEL SERVICES HUB</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Fleet Deployment Active</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {activeTab === 'international' && (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center px-6 py-3 kinetic-gradient text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all"
            >
                <Plus className="w-4 h-4 mr-2" />
                NEW TASK
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner relative flex w-full md:w-fit overflow-hidden">
        <div 
          className={`absolute top-1.5 bottom-1.5 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
            ${activeTab === 'international' ? 'left-1.5 w-[calc(25%-3px)] md:w-[calc(140px)] translate-x-0' : ''}
            ${activeTab === 'domestic' ? 'left-1.5 w-[calc(25%-3px)] md:w-[calc(120px)] translate-x-[100%] md:translate-x-[140px]' : ''}
            ${activeTab === 'equipment' ? 'left-1.5 w-[calc(25%-3px)] md:w-[calc(120px)] translate-x-[200%] md:translate-x-[260px]' : ''}
            ${activeTab === 'status' ? 'left-1.5 w-[calc(25%-3px)] md:w-[calc(160px)] translate-x-[300%] md:translate-x-[380px]' : ''}
          `}
        />
        <button
          onClick={() => setActiveTab('international')}
          className={`flex-1 md:w-[140px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'international' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:block whitespace-nowrap">International</span>
          <span className="block sm:hidden">INT</span>
        </button>
        <button
          onClick={() => setActiveTab('domestic')}
          className={`flex-1 md:w-[120px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'domestic' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:block whitespace-nowrap">Domestic</span>
          <span className="block sm:hidden">DOM</span>
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex-1 md:w-[120px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'equipment' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:block whitespace-nowrap">{currentShiftLabel}</span>
          <span className="block sm:hidden">{currentShiftLabel}</span>
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 md:w-[160px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'status' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:block whitespace-nowrap">Status Board</span>
          <span className="block sm:hidden">STATUS</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-surface rounded-3xl border border-outline overflow-hidden shadow-sm relative">
        <div key={activeTab}>
        {/* International Ops */}
        {activeTab === 'international' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-outline">
                <thead className="bg-surface-dim">
                  <tr>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">FLIGHT / TASK</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">PLATFORM / SECTOR</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STA</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ETA</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STD</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">OPERATOR ASSIGNED</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-outline text-on-surface">
                  {scheduledFlights.map((item, idx) => (
                    <tr key={item.id} className={`hover:bg-primary/[0.02] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                      <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center">
                              <div className="p-3 bg-surface-lowest rounded-2xl border border-outline mr-4 group-hover:border-primary/20 transition-all">
                                  <Plane className="w-5 h-5 text-primary" />
                              </div>
                              <span className="text-xl font-[900] tracking-tighter italic">{item.flightNumber}</span>
                          </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                          <div className="text-sm font-black tracking-tight">{item.aircraftReg}</div>
                          <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Stand {item.stand}</div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center text-sm font-black">
                              <Clock className="w-4 h-4 mr-2.5 text-primary opacity-40" />
                              {(item as any).sta || '--:--'}
                          </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center text-sm font-black">
                              <Clock className="w-4 h-4 mr-2.5 text-primary" />
                              {item.eta}
                          </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center text-sm font-black">
                              <Clock className="w-4 h-4 mr-2.5 text-primary opacity-40" />
                              {(item as any).std || '--:--'}
                          </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap max-w-[240px]">
                          {item.equipmentUsage === 'REFUELLER' ? (
                            <div className="flex space-x-2">
                                <div className="flex-1">
                                    <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                    {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                                    {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val))}
                                </div>
                            </div>
                          ) : (
                            <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                            </div>
                          )}
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                          {!item.equipmentUsage && configuringFlightId !== item.id ? (
                              <button 
                                  onClick={() => setConfiguringFlightId(item.id)}
                                  className="text-[10px] font-black text-on-surface-dim hover:text-primary uppercase tracking-[0.2em] transition-all"
                              >
                                  CONFIGURE
                              </button>
                          ) : (
                              <div className="flex justify-end items-center space-x-2">
                                  <button onClick={() => { handleAssignFlight(item.id, 'equipmentUsage', 'HYDRANT'); setConfiguringFlightId(null); }} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${item.equipmentUsage === 'HYDRANT' ? 'bg-cyan-500 text-white border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-surface-dim text-on-surface-dim border-outline hover:text-cyan-500 hover:border-cyan-500/50'}`}>HD</button>
                                  <button onClick={() => { handleAssignFlight(item.id, 'equipmentUsage', 'REFUELLER'); setConfiguringFlightId(null); }} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${item.equipmentUsage === 'REFUELLER' ? 'bg-amber-500 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-surface-dim text-on-surface-dim border-outline hover:text-amber-500 hover:border-amber-500/50'}`}>RF</button>
                              </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {scheduledFlights.map((item) => (
                <div key={item.id} className="card-premium p-4 sm:p-6 border-outline group transition-all active:scale-[0.98] max-w-md mx-auto w-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4">
                        <Plane className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{item.flightNumber}</h3>
                        <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{item.aircraftReg} • Stand {item.stand}</p>
                      </div>
                    </div>
                    <button className="p-2 text-primary opacity-40 hover:opacity-100">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-surface-dim rounded-xl border border-outline">
                    <div className="text-center border-r border-outline/30">
                      <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                      <p className="text-[11px] font-[900] text-on-surface">{(item as any).sta || '--:--'}</p>
                    </div>
                    <div className="text-center border-r border-outline/30">
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">ETA</p>
                      <p className="text-[11px] font-[900] text-primary">{item.eta}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STD</p>
                      <p className="text-[11px] font-[900] text-on-surface">{(item as any).std || '--:--'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Assigned Crew</label>
                        <div className="flex space-x-2">
                            <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'HYDRANT')} className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${item.equipmentUsage === 'HYDRANT' ? 'bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-surface-dim text-on-surface-dim hover:text-cyan-500'}`}>HD</button>
                            <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'REFUELLER')} className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${item.equipmentUsage === 'REFUELLER' ? 'bg-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-surface-dim text-on-surface-dim hover:text-amber-500'}`}>RF</button>
                        </div>
                    </div>
                    {item.equipmentUsage === 'REFUELLER' ? (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                                {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                            {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Domestic Ops */}
        {activeTab === 'domestic' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
               <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
               Squadron Assignments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
              {domesticTeams.map((team, idx) => (
                <div key={team.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                  <div className="flex items-center mb-8">
                    <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                      <Users className="w-5 h-5 text-on-surface" />
                    </div>
                    <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{team.name}</h4>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">RF OPERATOR</label>
                      {renderOperatorSelect(team.op1, (val) => handleAssignDomestic(team.id, 1, val))}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">OFFICER</label>
                      {renderOperatorSelect(team.op2, (val) => handleAssignDomestic(team.id, 2, val))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
               <span className="w-1.5 h-6 bg-primary/40 rounded-full mr-4"></span>
               Tactical Flight Log
            </h3>
            <div className="bg-surface-lowest border border-outline rounded-[32px] overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-outline">
                  <thead className="bg-surface-dim">
                    <tr>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TASK ID</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ASSET / SECTOR</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ETD/ETA</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline text-on-surface">
                    {MOCK_DOMESTIC_FLIGHTS.map((flight, idx) => (
                      <tr key={flight.id} className={`hover:bg-primary/[0.01] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4">
                              <Plane className="w-5 h-5 text-on-surface-dim" />
                            </div>
                            <span className="text-lg font-[900] italic tracking-tighter">{flight.flightNumber}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="text-sm font-black tracking-tight">{flight.aircraftType}</div>
                          <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">
                            {flight.aircraftReg} • Stand {flight.stand}
                          </div>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                          <div className="flex items-center text-sm font-black">
                            <Clock className="w-4 h-4 mr-2.5 opacity-40" />
                            {flight.eta}
                          </div>
                        </td>

                        <td className="px-8 py-6 whitespace-nowrap">
                          <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                              flight.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]' : 
                              flight.status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-dim text-on-surface-dim border-outline'
                          }`}>
                              {flight.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Equipment Assignments */}
        {activeTab === 'equipment' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                 Tactical Fleet Assignment
              </h3>
              <div className="flex bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner relative w-[200px] overflow-hidden">
                <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] kinetic-gradient rounded-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium ${equipmentShift === 'DIESEL' ? 'translate-x-full' : 'translate-x-0'}`}
                />
                <button
                  onClick={() => setEquipmentShift('DAILY')}
                  className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest relative z-10 ${
                    equipmentShift === 'DAILY' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  DAILY
                </button>
                <button
                  onClick={() => setEquipmentShift('DIESEL')}
                  className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest relative z-10 ${
                    equipmentShift === 'DIESEL' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  DIESEL
                </button>
              </div>
            </div>

            <div className="space-y-12">
              {['Refueller', 'Hydrant Dispenser'].map(type => {
                const eqs = equipmentAssignments.filter(eq => (equipmentShift === 'DAILY' || dieselNeeds.includes(eq.eqNumber)) && eq.eqType === type);
                if (eqs.length === 0) return null;
                return (
                  <div key={type}>
                    <h4 className="text-xs font-black text-on-surface-dim uppercase tracking-[0.3em] mb-6 border-b border-outline pb-2">
                        {type === 'Refueller' ? 'Refuellers (RF)' : 'Hydrant Dispensers (HD)'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {eqs.map(eq => (
                        <div key={eq.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                          <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                              <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                                <Truck className="w-5 h-5 text-on-surface" />
                              </div>
                              <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{eq.eqNumber}</h4>
                            </div>
                            {dieselNeeds.includes(eq.eqNumber) && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 shadow-sm animate-pulse">
                                <Droplet className="w-3 h-3" />
                                <span className="text-[8px] font-black uppercase tracking-widest">DIESEL</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-6">
                            <div>
                              <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Operator</label>
                              {renderOperatorSelect(eq.op1, (val) => handleAssignEquipment(eq.id, 1, val))}
                            </div>
                            {type === 'Refueller' && (
                              <div>
                                <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Officer</label>
                                {renderOperatorSelect(eq.op2, (val) => handleAssignEquipment(eq.id, 2, val))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Board */}
        {activeTab === 'status' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10 space-y-10">
            <div className="flex items-center">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                 Operator Task Boards
              </h3>
              <span className="ml-6 w-8 h-[1px] bg-outline flex-1"></span>
              <span className="ml-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{operators.length} Personnel Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {operators.map((op) => {
                    const opTasks = flightJobs.filter((j: any) => j.assignedTo === op.id || j.assignedOfficer === op.id);
                    const activeTask = opTasks.find((j: any) => j.status === 'IN_PROGRESS');
                    const pendingCount = opTasks.filter((j: any) => j.status === 'PENDING').length;
                    const doneCount = opTasks.filter((j: any) => j.status === 'COMPLETED').length;
                    
                    const eqAssignment = equipmentAssignments.find(a => a.op1 === op.id || a.op2 === op.id);
                    const domAssignment = domesticTeams.find(a => a.op1 === op.id || a.op2 === op.id);

                    return (
                        <div key={op.id} className="card-premium p-4 sm:p-6 space-y-4 sm:space-y-6 hover:border-primary/20 transition-colors group relative overflow-hidden w-full">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            {/* Operator Header */}
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center space-x-4">
                                    <img src={op.avatar} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border border-outline shadow-sm group-hover:scale-105 transition-transform shrink-0" />
                                    <div>
                                        <p className="text-[15px] font-[900] text-on-surface uppercase tracking-tight">{op.name}</p>
                                        <p className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest">{op.role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-[9px] font-[900] border uppercase tracking-widest transition-all ${
                                    activeTask
                                        ? 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                                        : 'bg-surface-dim text-on-surface-dim border-outline opacity-50'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTask ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-on-surface-dim opacity-30'}`} />
                                    <span className="whitespace-nowrap">
                                      {activeTask ? (
                                        <><span className="hidden sm:inline">Refueling </span>{activeTask.flightNumber}{activeTask.vehicleId && <span className="ml-1 opacity-60">({activeTask.vehicleId})</span>}</>
                                      ) : 'Standby'}
                                    </span>
                                </div>
                            </div>

                            {/* Mini stats */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                                <div className="bg-surface-dim/70 backdrop-blur-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-outline/50 group-hover:border-outline transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-on-surface tracking-tighter leading-none mb-1 sm:mb-2">{opTasks.length}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Total</span>
                                </div>
                                <div className="bg-warning/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-warning/10 border-dashed group-hover:border-solid transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-warning tracking-tighter leading-none mb-1 sm:mb-2">{pendingCount}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-warning opacity-60 uppercase tracking-widest">Pending</span>
                                </div>
                                <div className="bg-success/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-success/10 border-dashed group-hover:border-solid transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-success tracking-tighter leading-none mb-1 sm:mb-2">{doneCount}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-success opacity-60 uppercase tracking-widest">Done</span>
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                {/* Equipment/Assignment Badge */}
                                {(eqAssignment || domAssignment) && (
                                    <div className="flex items-center space-x-3 bg-surface-lowest border border-outline px-4 py-3 rounded-2xl">
                                        {eqAssignment ? (
                                            <>
                                                <Truck className="w-4 h-4 text-on-surface-dim opacity-40" />
                                                <span className="text-[11px] font-black text-on-surface uppercase tracking-wider">{eqAssignment.eqNumber} <span className="opacity-50 text-[9px]">({eqAssignment.eqType})</span></span>
                                                <span className="text-[9px] text-on-surface-dim opacity-30 uppercase tracking-widest ml-auto">{eqAssignment.shift_type || 'Active'} Shift</span>
                                            </>
                                        ) : (
                                            <>
                                                <Users className="w-4 h-4 text-primary opacity-60" />
                                                <span className="text-[11px] font-black text-primary uppercase tracking-wider">{domAssignment?.name}</span>
                                                <span className="text-[9px] text-primary opacity-40 uppercase tracking-widest ml-auto">Domestic Ops</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Tasks list */}
                                {opTasks.length > 0 && (
                                    <div className="space-y-2.5">
                                        {opTasks.map(job => {
                                            const delayed = isDelayed(job.sta, job.eta);
                                            const ds = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
                                            return (
                                                <div key={job.id} className="flex items-center justify-between bg-surface-lowest border border-outline p-4 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl group/task hover:border-primary/20 transition-all gap-2">
                                                    <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                                                        <Plane className="w-4 h-4 text-on-surface-dim opacity-20 group-hover/task:rotate-12 transition-transform shrink-0" />
                                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                                                            <span className="text-[11px] sm:text-[13px] font-[900] text-on-surface tracking-tighter uppercase italic">{job.flightNumber}</span>
                                                            <span className="text-[9px] sm:text-[10px] font-bold text-on-surface-dim opacity-40 uppercase tracking-widest truncate">{job.aircraftType}</span>
                                                            {job.vehicleId && (
                                                                <span className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
                                                                    {job.vehicleId}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all shrink-0 ${
                                                        ds === 'COMPLETED' ? 'text-success border-success/20 bg-success/5' :
                                                        ds === 'DELAYED' ? 'text-error border-error/20 bg-error/10 animate-pulse' :
                                                        ds === 'IN_PROGRESS' ? 'text-warning border-warning/20 bg-warning/5 animate-pulse' :
                                                        'text-on-surface-dim border-outline opacity-40'
                                                    }`}>{ds.replace('_', ' ')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {opTasks.length === 0 && (
                                    <div className="px-6 py-8 border border-dashed border-outline rounded-[32px] flex flex-col items-center justify-center opacity-40">
                                        <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em]">No tasks assigned today</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Add Flight Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/20 backdrop-blur-xl p-4" onClick={() => setIsModalOpen(false)}>
            <div className="bg-surface-lowest rounded-[40px] shadow-2xl w-full max-w-lg p-10 border border-outline relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                
                <h3 className="text-3xl font-[900] text-on-surface mb-8 tracking-tighter uppercase italic relative z-10">INITIATE TASK</h3>
                <form onSubmit={handleAddFlight} className="space-y-8 relative z-10">
                    <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Flight Identity</label>
                        <input name="flight" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. EK405" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Airframe</label>
                            <input name="ac" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. B777" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Tactical Stand</label>
                            <input name="stand" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. D12" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STA</label>
                            <input name="sta" type="time" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">ETA</label>
                            <input name="eta" type="time" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STD</label>
                            <input name="std" type="time" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-5 mt-10">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-8 py-4 text-[10px] font-black text-on-surface-dim hover:text-on-surface uppercase tracking-[0.2em] transition-all"
                        >
                            ABORT
                        </button>
                        <button 
                            type="submit" 
                            className="px-10 py-4 kinetic-gradient text-white font-[900] text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
                        >
                            CONFIRM DEPLOYMENT
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};