import React, { useState, useEffect } from 'react';
import { MOCK_USERS, MOCK_DOMESTIC_FLIGHTS } from '../constants';
import { UserRole } from '../types';
import { Calendar, Plus, Plane, Clock, Users, Truck, MapPin } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

export const Schedule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'international' | 'domestic' | 'equipment'>('international');

  const [scheduledFlights, setScheduledFlights] = useState([
    { id: 'sf1', flight: 'EK405', ac: 'B777-300', stand: 'D12', eta: '14:30', assignedTo: 'u3' },
    { id: 'sf2', flight: 'SQ321', ac: 'A350-900', stand: 'F10', eta: '15:15', assignedTo: '' },
    { id: 'sf3', flight: 'QR101', ac: 'A320', stand: 'C05', eta: '16:00', assignedTo: '' },
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
  const [equipmentAssignments, setEquipmentAssignments] = useState([
    { id: 'eq1', eqNumber: 'EQ-01', op1: '', op2: '' },
    { id: 'eq2', eqNumber: 'EQ-02', op1: '', op2: '' },
    { id: 'eq3', eqNumber: 'EQ-03', op1: '', op2: '' },
    { id: 'eq4', eqNumber: 'EQ-04', op1: '', op2: '' },
  ]);

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
          setEquipmentAssignments(prev => prev.map(eq => ({ ...eq, op1: '', op2: '' })));
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
        eta: formData.get('eta') as string,
        assignedTo: ''
    };
    setScheduledFlights(prev => [...prev, newFlight]);
    setIsModalOpen(false);
  };

  const renderOperatorSelect = (value: string, onChange: (val: string) => void) => (
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-aviation-500 focus:border-aviation-500 p-2 border ${value ? 'bg-white text-slate-900' : 'bg-red-50 border-red-200 text-slate-900'}`}
    >
      <option value="">-- Unassigned --</option>
      {operators.map(op => (
        <option key={op.id} value={op.id}>{op.name}</option>
      ))}
    </select>
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-aviation-600" />
            Shift Schedule & Assignments
          </h2>
          <p className="text-slate-500">Manage operator assignments for all operations</p>
        </div>
        {activeTab === 'international' && (
          <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 bg-aviation-600 text-white rounded-lg font-bold hover:bg-aviation-700 shadow-sm"
          >
              <Plus className="w-5 h-5 mr-2" />
              Add Flight
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6 shadow-inner w-fit">
        <button
          onClick={() => setActiveTab('international')}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'international' ? 'bg-white text-aviation-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Plane className="w-4 h-4 mr-2" />
          International Ops
        </button>
        <button
          onClick={() => setActiveTab('domestic')}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'domestic' ? 'bg-white text-aviation-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          Domestic Ops
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'equipment' ? 'bg-white text-aviation-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="w-4 h-4 mr-2" />
          {currentShiftLabel}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* International Ops */}
        {activeTab === 'international' && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Flight</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Aircraft / Stand</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ETA</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Operator</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-slate-800">
              {scheduledFlights.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                          <div className="p-2 bg-aviation-50 rounded-lg mr-3">
                              <Plane className="w-5 h-5 text-aviation-600" />
                          </div>
                          <span className="font-bold text-lg">{item.flight}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">{item.ac}</div>
                      <div className="text-xs text-slate-500">Stand: {item.stand}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-slate-600">
                          <Clock className="w-4 h-4 mr-2" />
                          {item.eta}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, val))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-aviation-600 hover:text-aviation-900 font-bold">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Domestic Ops */}
        {activeTab === 'domestic' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Domestic Operations Teams</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {domesticTeams.map(team => (
                <div key={team.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-slate-800">{team.name}</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Operator 1</label>
                      {renderOperatorSelect(team.op1, (val) => handleAssignDomestic(team.id, 1, val))}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Operator 2</label>
                      {renderOperatorSelect(team.op2, (val) => handleAssignDomestic(team.id, 2, val))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Today's Domestic Flights</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Flight</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Aircraft / Stand</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ETA</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Team</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-slate-800">
                  {MOCK_DOMESTIC_FLIGHTS.map((flight) => (
                    <tr key={flight.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-blue-50 rounded-lg mr-3">
                            <Plane className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="font-bold text-lg">{flight.flightNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{flight.aircraftType} ({flight.aircraftReg})</div>
                        <div className="text-xs text-slate-500 flex items-center mt-1">
                          <MapPin className="w-3 h-3 mr-1" /> Stand {flight.stand}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-slate-600">
                          <Clock className="w-4 h-4 mr-2" />
                          {flight.eta}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                          {flight.assignedTeam}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            flight.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                            flight.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
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
        )}

        {/* Equipment Assignments */}
        {activeTab === 'equipment' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Equipment Assignments</h3>
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button
                  onClick={() => setEquipmentShift('DAILY')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${
                    equipmentShift === 'DAILY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  DAILY (Morning/Night)
                </button>
                <button
                  onClick={() => setEquipmentShift('DIESEL')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${
                    equipmentShift === 'DIESEL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  DIESEL (Evening)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {equipmentAssignments.map(eq => (
                <div key={eq.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-orange-100 rounded-lg mr-3">
                      <Truck className="w-5 h-5 text-orange-600" />
                    </div>
                    <h4 className="font-bold text-slate-800">{eq.eqNumber}</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Operator 1</label>
                      {renderOperatorSelect(eq.op1, (val) => handleAssignEquipment(eq.id, 1, val))}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Operator 2</label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Add Incoming Flight</h3>
                <form onSubmit={handleAddFlight} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Flight Number</label>
                        <input name="flight" required className="w-full p-2 border border-gray-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-aviation-500" placeholder="e.g. BA245" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Aircraft Type</label>
                            <input name="ac" required className="w-full p-2 border border-gray-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-aviation-500" placeholder="e.g. A320" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Stand</label>
                            <input name="stand" required className="w-full p-2 border border-gray-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-aviation-500" placeholder="e.g. C12" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Estimated Arrival (ETA)</label>
                        <input name="eta" type="time" required className="w-full p-2 border border-gray-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-aviation-500" />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg border border-gray-200"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 bg-aviation-600 text-white font-bold rounded-lg hover:bg-aviation-700 shadow-md"
                        >
                            Add Flight
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};