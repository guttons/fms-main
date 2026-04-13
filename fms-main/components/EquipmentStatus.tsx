import React, { useState } from 'react';
import { Equipment, EquipmentStatus as EqStatus, EquipmentType, Tank, User, UserRole } from '../types';
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
  Filter,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface EquipmentStatusProps {
  tanks: Tank[];
  user: User;
}

export const EquipmentStatus: React.FC<EquipmentStatusProps> = ({ tanks, user }) => {
  const [equipment, setEquipment] = useState<Equipment[]>(EQUIPMENT);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<EquipmentType | 'All'>('All');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [EquipmentType.REFUELLER]: true,
    [EquipmentType.HYDRANT_DISPENSER]: true,
    [EquipmentType.DIESEL_TRUCK]: true,
    [EquipmentType.HYDRANT_SERVICE]: true,
  });

  const canEdit = user.role === UserRole.ADMIN || user.role === UserRole.ITP_MANAGER;

  const handleStatusChange = (id: string, newStatus: EqStatus) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, status: newStatus, lastUpdated: new Date().toISOString() } : eq
    ));
  };

  const toggleCategory = (type: string) => {
    setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }));
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

  const isOutOfService = (status: EqStatus) => 
    status === EqStatus.MAINTENANCE || status === EqStatus.OUT_OF_SERVICE;

  // Grouping logic
  const equipmentByType = Object.values(EquipmentType).reduce((acc, type) => {
    const items = filteredEquipment.filter(eq => eq.type === type);
    if (items.length > 0 || filterType === type) {
      acc[type] = {
        inService: items.filter(eq => !isOutOfService(eq.status)),
        outOfService: items.filter(eq => isOutOfService(eq.status))
      };
    }
    return acc;
  }, {} as Record<string, { inService: Equipment[], outOfService: Equipment[] }>);

  return (
    <div className="p-6 space-y-8">
      {/* Tank Levels Overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center tracking-tight">
            <Database className="w-5 h-5 mr-2 text-aviation-600" />
            Terminal Tank Status
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tanks.map(tank => {
            const percentage = (tank.currentLevel / tank.capacity) * 100;
            const isLow = tank.currentLevel < tank.safeMinLevel;
            
            return (
              <div key={tank.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">{tank.name}</h3>
                    <p className="text-[10px] font-black text-aviation-600/60 uppercase tracking-widest">{tank.type}</p>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    tank.type === 'Jet A-1' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                    tank.type === 'Diesel' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-green-50 text-green-700 border-green-100'
                  }`}>
                    {tank.type === 'Jet A-1' ? 'JET' : tank.type}
                  </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-black text-slate-900 tabular-nums">{tank.currentLevel.toLocaleString()}</span>
                  <span className="text-xs font-bold text-slate-400 mb-1 ml-1 opacity-60">/ {tank.capacity.toLocaleString()} L</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-2 relative">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out relative ${isLow ? 'bg-error' : 'bg-primary'}`}
                    style={{ width: `${percentage}%` }}
                  >
                    <div className="absolute top-0 right-0 w-8 h-full bg-white/20 skew-x-[-20deg]"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Utilisation: {Math.round(percentage)}%</span>
                  {isLow && (
                    <span className="text-[10px] text-error font-black flex items-center animate-pulse">
                      <AlertCircle className="w-3 h-3 mr-1" /> CRITICAL LOW
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Equipment Management */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center tracking-tight">
              <Truck className="w-6 h-6 mr-3 text-aviation-600" />
              Equipment Ops Command
            </h2>
            <p className="text-sm text-slate-500 font-medium ml-9">Real-time status monitoring and fleet management</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-aviation-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search unit ID..."
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-aviation-500/10 focus:border-aviation-500 outline-none w-full sm:w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select 
                className="pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:ring-4 focus:ring-aviation-500/10 focus:border-aviation-500 outline-none appearance-none w-full sm:w-56 transition-all cursor-pointer"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <option value="All">All Categories</option>
                {Object.values(EquipmentType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {Object.entries(equipmentByType).map(([type, statusGroups]) => (
            <div key={type} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
              <div 
                className="flex items-center justify-between mb-6 cursor-pointer group/header"
                onClick={() => toggleCategory(type)}
              >
                <div className="flex items-center">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 mr-4 group-hover/header:border-aviation-300 transition-colors">
                    {expandedCategories[type] ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronRight className="w-5 h-5 text-slate-600" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{type}s</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 border border-white"></span>
                        {statusGroups.inService.length} Operational
                      </span>
                      {statusGroups.outOfService.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                          <span className="w-2 h-2 bg-error rounded-full mr-1.5 border border-white"></span>
                          {statusGroups.outOfService.length} Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {expandedCategories[type] && (
                <div className="space-y-8">
                  {/* In Service Section */}
                  {statusGroups.inService.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center">
                        <span className="w-8 h-[1px] bg-slate-200 mr-3"></span>
                        Operational units
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {statusGroups.inService.map(eq => (
                          <div key={eq.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group hover:shadow-xl hover:border-aviation-200 transition-all duration-300">
                            <div className="p-5 flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="text-lg font-black text-slate-900 group-hover:text-aviation-600 transition-colors">{eq.name}</h3>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{eq.type}</p>
                                </div>
                                <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(eq.status)}`}>
                                  {getStatusIcon(eq.status)}
                                  <span>{eq.status}</span>
                                </div>
                              </div>

                              {eq.maxCapacity > 0 && (
                                <div className="mb-6">
                                  <div className="flex justify-between items-end mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Current Load</span>
                                    <span className="text-xs font-black text-slate-900">{eq.currentVolume.toLocaleString()} / {eq.maxCapacity.toLocaleString()} L</span>
                                  </div>
                                  <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden border border-slate-100">
                                    <div 
                                      className="bg-aviation-600 h-full transition-all duration-700 ease-out"
                                      style={{ width: `${(eq.currentVolume / eq.maxCapacity) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {canEdit && (
                                <div className="mt-4 pt-4 border-t border-slate-50">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Master Status Override</label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.values(EqStatus).map(status => (
                                      <button
                                        key={status}
                                        onClick={() => handleStatusChange(eq.id, status)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border uppercase tracking-tight ${
                                          eq.status === status 
                                            ? 'bg-aviation-600 text-white border-aviation-600 shadow-md shadow-aviation-200' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-aviation-300 hover:text-aviation-600'
                                        }`}
                                      >
                                        {status}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="bg-slate-50/80 backdrop-blur-sm p-4 border-t border-slate-100 flex justify-between items-center group-hover:bg-aviation-50/30 transition-colors">
                              <span className="text-[10px] font-bold text-slate-400">SYNCED: {new Date(eq.lastUpdated).toLocaleTimeString()}</span>
                              {eq.type === EquipmentType.REFUELLER && canEdit && (
                                <button 
                                  onClick={() => sendRefuelRequest(eq.id)}
                                  className="flex items-center text-[10px] font-black text-aviation-600 hover:text-white hover:bg-aviation-600 bg-white px-3 py-2 rounded-xl border border-aviation-200 shadow-sm transition-all active:scale-95 uppercase tracking-widest"
                                >
                                  <Send className="w-3 h-3 mr-2" />
                                  Initiate Refill
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Out of Service Section */}
                  {statusGroups.outOfService.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-black text-error/60 uppercase tracking-[0.2em] mb-4 flex items-center">
                        <span className="w-8 h-[1px] bg-error/10 mr-3"></span>
                        Units in maintenance / grounded
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {statusGroups.outOfService.map(eq => (
                          <div key={eq.id} className="bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col opacity-80 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300">
                            <div className="p-5 flex-1 relative">
                              <div className="absolute top-0 right-0 p-4">
                                <AlertCircle className="w-5 h-5 text-error opacity-20" />
                              </div>
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="text-lg font-black text-slate-700">{eq.name}</h3>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{eq.type}</p>
                                </div>
                                <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(eq.status)}`}>
                                  {getStatusIcon(eq.status)}
                                  <span>{eq.status}</span>
                                </div>
                              </div>

                              {canEdit && (
                                <div className="mt-4 pt-4 border-t border-slate-200/50">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Status Recovery</label>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.values(EqStatus).map(status => (
                                      <button
                                        key={status}
                                        onClick={() => handleStatusChange(eq.id, status)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border uppercase tracking-tight ${
                                          eq.status === status 
                                            ? 'bg-aviation-600 text-white border-aviation-600 shadow-md' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-aviation-300'
                                        }`}
                                      >
                                        {status}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="bg-slate-100/50 p-4 border-t border-slate-200 flex justify-between items-center text-slate-400">
                              <span className="text-[10px] font-bold italic">Unit restricted from active ops</span>
                              <Wrench className="w-3 h-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
