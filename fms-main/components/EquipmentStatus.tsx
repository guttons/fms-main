
import React, { useState } from 'react';
import { Equipment, EquipmentStatus as EqStatus, EquipmentType, Tank } from '../types';
import { EQUIPMENT } from '../constants';
import { 
  Truck, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Wrench, 
  Fuel, 
  Send,
  ArrowUpRight,
  Database,
  Search,
  Filter
} from 'lucide-react';

interface EquipmentStatusProps {
  tanks: Tank[];
}

export const EquipmentStatus: React.FC<EquipmentStatusProps> = ({ tanks }) => {
  const [equipment, setEquipment] = useState<Equipment[]>(EQUIPMENT);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<EquipmentType | 'All'>('All');

  const handleStatusChange = (id: string, newStatus: EqStatus) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, status: newStatus, lastUpdated: new Date().toISOString() } : eq
    ));
  };

  const sendRefuelRequest = (eqId: string) => {
    alert(`Refuel request sent to Depot Operators for ${eqId}`);
  };

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || eq.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return 'bg-green-100 text-green-700 border-green-200';
      case EqStatus.IN_USE: return 'bg-blue-100 text-blue-700 border-blue-200';
      case EqStatus.MAINTENANCE: return 'bg-orange-100 text-orange-700 border-orange-200';
      case EqStatus.OUT_OF_SERVICE: return 'bg-red-100 text-red-700 border-red-200';
      case EqStatus.REFUELLING: return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return <CheckCircle2 className="w-4 h-4" />;
      case EqStatus.IN_USE: return <Truck className="w-4 h-4" />;
      case EqStatus.MAINTENANCE: return <Wrench className="w-4 h-4" />;
      case EqStatus.OUT_OF_SERVICE: return <AlertCircle className="w-4 h-4" />;
      case EqStatus.REFUELLING: return <Fuel className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Tank Levels Overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Database className="w-5 h-5 mr-2 text-aviation-600" />
            Tank Levels Overview
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tanks.map(tank => {
            const percentage = (tank.currentLevel / tank.capacity) * 100;
            const isLow = tank.currentLevel < tank.safeMinLevel;
            
            return (
              <div key={tank.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-sm truncate pr-2">{tank.name}</h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    tank.type === 'Jet A-1' ? 'bg-blue-100 text-blue-700' : 
                    tank.type === 'Diesel' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {tank.type}
                  </span>
                </div>
                <div className="flex items-end justify-between mb-1">
                  <span className="text-lg font-black text-slate-900">{tank.currentLevel.toLocaleString()} L</span>
                  <span className="text-xs text-slate-500">/ {tank.capacity.toLocaleString()} L</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    className={`h-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-aviation-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">Capacity: {Math.round(percentage)}%</span>
                  {isLow && <span className="text-red-500 font-bold flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> LOW STOCK</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Equipment Management */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-aviation-600" />
            Equipment Status & Management
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search equipment..."
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 outline-none w-full sm:w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 outline-none appearance-none w-full sm:w-48"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="All">All Types</option>
                {Object.values(EquipmentType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEquipment.map(eq => (
            <div key={eq.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{eq.name}</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{eq.type}</p>
                  </div>
                  <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(eq.status)}`}>
                    {getStatusIcon(eq.status)}
                    <span>{eq.status}</span>
                  </div>
                </div>

                {eq.maxCapacity > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs font-bold text-slate-500 uppercase">Current Volume</span>
                      <span className="text-sm font-black text-slate-900">{eq.currentVolume.toLocaleString()} / {eq.maxCapacity.toLocaleString()} L</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-aviation-600 h-full transition-all duration-500"
                        style={{ width: `${(eq.currentVolume / eq.maxCapacity) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quick Status Update</label>
                    <div className="flex flex-wrap gap-1">
                      {Object.values(EqStatus).map(status => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(eq.id, status)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                            eq.status === status 
                              ? 'bg-aviation-600 text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Last update: {new Date(eq.lastUpdated).toLocaleTimeString()}</span>
                {eq.type === EquipmentType.REFUELLER && (
                  <button 
                    onClick={() => sendRefuelRequest(eq.id)}
                    className="flex items-center text-xs font-bold text-aviation-600 hover:text-aviation-700 bg-white px-3 py-1.5 rounded-lg border border-aviation-200 shadow-sm transition-all active:scale-95"
                  >
                    <Send className="w-3 h-3 mr-1.5" />
                    Request Refill
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
