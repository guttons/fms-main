import React, { useState, useEffect } from 'react';
import { MOCK_USERS, MOCK_DOMESTIC_FLIGHTS, EQUIPMENT } from '../constants';
import { UserRole, EquipmentType } from '../types';
import { Calendar, Plus, Plane, Clock, Users, Truck, MapPin, ChevronDown, Droplet } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

export const Schedule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'international' | 'domestic' | 'equipment'>('international');

  const [scheduledFlights, setScheduledFlights] = useState([
    { id: 'sf1', flight: 'EK405', ac: 'B777-300', stand: 'D12', sta: '14:15', eta: '14:30', std: '15:45', assignedTo: 'u3' },
    { id: 'sf2', flight: 'SQ321', ac: 'A350-900', stand: 'F10', sta: '15:00', eta: '15:15', std: '16:30', assignedTo: '' },
    { id: 'sf3', flight: 'QR101', ac: 'A320', stand: 'C05', sta: '15:45', eta: '16:00', std: '17:15', assignedTo: '' },
  ]);

  const [domesticTeams, setDomesticTeams] = useState([
    { id: 't1', name: 'Team 1', op1: '', op2: '' },
    { id: 't2', name: 'Team 2', op1: '', op2: '' },
    { id: 't3', name: 'Team 3', op1: '', op2: '' },
  ]);

  const currentHour = new Date().getHours();
  const isDieselTime = currentHour >= 15 && currentHour < 23;
  const currentShiftLabel = isDieselTime ? 'DIESEL' : 'DAILY';

  const [equipmentShift, setEquipmentShift] = useState<'DAILY' | 'DIESEL'>(currentShiftLabel);
  const [dieselNeeds, setDieselNeeds] = useState<string[]>([]);
  
  const rfHdEquipment = EQUIPMENT.filter(eq => 
    eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER
  );

  const [equipmentAssignments, setEquipmentAssignments] = useState(
    rfHdEquipment.map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '' }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const operators = MOCK_USERS.filter(u => u.role === UserRole.ITP_OPERATOR);
  const todayDate = new Date().toISOString().split('T')[0];

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
        
        // Load Diesel Needs from Briefing
        const briefingData = await supabaseService.getShiftBriefingInfo(todayDate) as any;
        if (briefingData && briefingData.dieselNeeds) {
          setDieselNeeds(briefingData.dieselNeeds);
        }

        if (equipmentData && equipmentData.length > 0) {
          setEquipmentAssignments(prev => prev.map(eq => {
            const dbEq = equipmentData.find(d => d.equipment_id === eq.eqNumber);
            if (dbEq) {
              return { ...eq, op1: dbEq.operator1_id || '', op2: dbEq.operator2_id || '' };
            }
            return eq;
          }));
        } else {
          // Reset if no data for this shift
          setEquipmentAssignments(rfHdEquipment.map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '' })));
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
      }
    };
    loadAssignments();
  }, [equipmentShift, todayDate]);

  const handleAssignFlight = (flightId: string, userId: string) => {
    setScheduledFlights(prev => prev.map(f => f.id === flightId ? { ...f, assignedTo: userId } : f));
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
    const newFlight = {
        id: `sf${Date.now()}`,
        flight: formData.get('flight') as string,
        ac: formData.get('ac') as string,
        stand: formData.get('stand') as string,
        sta: formData.get('sta') as string,
        eta: formData.get('eta') as string,
        std: formData.get('std') as string,
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
        className={`block w-full text-[11px] font-[900] rounded-xl shadow-inner focus:ring-4 focus:ring-primary/10 focus:border-primary px-4 py-3 border uppercase tracking-widest appearance-none transition-all ${
          value ? 'bg-surface-dim text-on-surface border-outline' : 'bg-surface-dim text-error border-error/30'
        }`}
      >
        <option value="" className="bg-surface-container text-on-surface">-- UNASSIGNED --</option>
        {operators.map(op => (
          <option key={op.id} value={op.id} className="bg-surface-container text-on-surface">{op.name.toUpperCase()}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-dim opacity-30 pointer-events-none group-hover/select:opacity-100 transition-all" />
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
                className="flex items-center px-6 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all"
            >
                <Plus className="w-4 h-4 mr-2" />
                NEW TASK
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner w-fit">
        <button
          onClick={() => setActiveTab('international')}
          className={`flex items-center px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'international' ? 'bg-primary text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Plane className="w-4 h-4 mr-2.5" />
          International
        </button>
        <button
          onClick={() => setActiveTab('domestic')}
          className={`flex items-center px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'domestic' ? 'bg-primary text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Users className="w-4 h-4 mr-2.5" />
          Domestic
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'equipment' ? 'bg-primary text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Truck className="w-4 h-4 mr-2.5" />
          {currentShiftLabel}
        </button>
      </div>

      {/* Content */}
      <div className="bg-surface rounded-3xl border border-outline overflow-hidden shadow-sm">
        
        {/* International Ops */}
        {activeTab === 'international' && (
          <div className="overflow-x-auto">
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
                {scheduledFlights.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="p-3 bg-surface-lowest rounded-2xl border border-outline mr-4 group-hover:border-primary/20 transition-all">
                                <Plane className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-xl font-[900] tracking-tighter italic">{item.flight}</span>
                        </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                        <div className="text-sm font-black tracking-tight">{item.ac}</div>
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
                        {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, val))}
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-[10px] font-black text-on-surface-dim hover:text-primary uppercase tracking-[0.2em] transition-all">
                            CONFIGURE
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Domestic Ops */}
        {activeTab === 'domestic' && (
          <div className="p-8 lg:p-10">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
               <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
               Squadron Assignments
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {domesticTeams.map(team => (
                <div key={team.id} className="card-premium p-6 group transition-all hover:scale-[1.02]">
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
                    {MOCK_DOMESTIC_FLIGHTS.map((flight) => (
                      <tr key={flight.id} className="hover:bg-primary/[0.01] transition-colors group">
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
          <div className="p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                 Tactical Fleet Assignment
              </h3>
              <div className="flex bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner">
                <button
                  onClick={() => setEquipmentShift('DAILY')}
                  className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
                    equipmentShift === 'DAILY' ? 'bg-primary text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  Daily Ops
                </button>
                <button
                  onClick={() => setEquipmentShift('DIESEL')}
                  className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
                    equipmentShift === 'DIESEL' ? 'bg-primary text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  Diesel Shift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {equipmentAssignments
                .filter(eq => equipmentShift === 'DAILY' || dieselNeeds.includes(eq.eqNumber))
                .map(eq => (
                <div key={eq.id} className="card-premium p-6 group transition-all hover:scale-[1.02]">
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
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Primary Pilot</label>
                      {renderOperatorSelect(eq.op1, (val) => handleAssignEquipment(eq.id, 1, val))}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Support Specialist</label>
                      {renderOperatorSelect(eq.op2, (val) => handleAssignEquipment(eq.id, 2, val))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add Flight Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface/20 backdrop-blur-xl p-4">
            <div className="bg-surface-lowest rounded-[40px] shadow-2xl w-full max-w-lg p-10 border border-outline relative overflow-hidden">
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
                            className="px-10 py-4 bg-primary text-white font-[900] text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
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