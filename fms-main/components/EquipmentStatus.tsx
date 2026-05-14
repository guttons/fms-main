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
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { supabaseService } from '../services/supabaseService';

interface EquipmentStatusProps {
  user: User;
}

export const EquipmentStatus: React.FC<EquipmentStatusProps> = ({ user }) => {
  const { notify } = useNotification();
  const { equipment, updateEquipmentStatus, createAlert, alerts } = useOperationalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<EquipmentType | 'All'>('All');
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [EquipmentType.REFUELLER]: true,
    [EquipmentType.HYDRANT_DISPENSER]: true,
    [EquipmentType.DIESEL_TRUCK]: true,
    [EquipmentType.HYDRANT_SERVICE]: true,
  });

  const canEdit = user.role === UserRole.ADMIN || user.role === UserRole.ITP_MANAGER || user.role === UserRole.DEPOT_MANAGER;

  const handleStatusChange = (id: string, newStatus: EqStatus) => {
    updateEquipmentStatus(id, newStatus);
  };


  const toggleCategory = (type: string) => {
    setExpandedCategories(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const sendRefuelRequest = async (eqId: string) => {
    if (pendingRequests.has(eqId)) return;
    
    try {
      // Check for duplicates locally first for immediate feedback
      const isRequested = (alerts || []).some(a => a && !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eqId}`));
      if (isRequested) {
        notify(`A replenishment request is already active for ${eqId}`, 'warning');
        return;
      }

      setPendingRequests(prev => new Set(prev).add(eqId));

      const success = await createAlert({
        severity: 'medium',
        message: `Replenishment requested for unit ${eqId}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        acknowledged: false,
        targetRole: UserRole.DEPOT_OPERATOR
      });
      
      if (success) {
        notify(`Refuel request sent to Depot Operators for ${eqId}`, 'success');
      }
    } catch (error) {
      console.error("Failed to send refuel request alert", error);
      notify(`Failed to send refuel request for ${eqId}`, 'error');
    } finally {
      setPendingRequests(prev => {
        const next = new Set(prev);
        next.delete(eqId);
        return next;
      });
    }
  };

  const filteredEquipment = (equipment || []).filter(eq => {
    if (!eq) return false;
    const matchesSearch = (eq.name || eq.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesFilter = filterType === 'All' || eq.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return 'bg-success/10 text-success border-success/20';
      case EqStatus.IN_USE: return 'bg-primary/10 text-primary border-primary/20';
      case EqStatus.MAINTENANCE: return 'bg-warning/10 text-warning border-warning/20';
      case EqStatus.OUT_OF_SERVICE: return 'bg-error/10 text-error border-error/20';
      case EqStatus.REFUELLING: return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-surface-dim text-on-surface-dim border-outline';
    }
  };

  const getStatusGradient = (status: EqStatus) => {
    switch (status) {
      case EqStatus.AVAILABLE: return 'gradient-success';
      case EqStatus.IN_USE: return 'kinetic-gradient';
      case EqStatus.MAINTENANCE: return 'gradient-warning';
      case EqStatus.OUT_OF_SERVICE: return 'gradient-error';
      case EqStatus.REFUELLING: return 'gradient-warning';
      default: return 'kinetic-gradient';
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
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10 border-b border-outline pb-6 lg:pb-10">
        <div className="flex flex-col">
          <h2 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
            EQUIPMENT <span className="text-primary italic font-medium ml-2 lg:ml-3">COMMAND</span>
          </h2>
          <div className="flex items-center space-x-3">
             <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono">Live Sync: ACTIVE</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em]">{filteredEquipment.length} Tactical units online</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-4">
          <div className="relative group w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="ID SEARCH..."
              className="pl-12 pr-6 py-2 lg:py-2.5 bg-surface-dim border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:opacity-20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none w-full sm:w-48 lg:w-56 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="bg-surface-dim p-1 rounded-2xl border border-outline relative flex w-full sm:w-auto overflow-x-auto no-scrollbar shadow-inner">
            <div 
              className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
                ${filterType === 'All' ? 'left-1 w-[70px] translate-x-0' : ''}
                ${filterType === EquipmentType.REFUELLER ? 'left-1 w-[100px] translate-x-[70px]' : ''}
                ${filterType === EquipmentType.HYDRANT_DISPENSER ? 'left-1 w-[150px] translate-x-[170px]' : ''}
                ${filterType === EquipmentType.DIESEL_TRUCK ? 'left-1 w-[110px] translate-x-[320px]' : ''}
                ${filterType === EquipmentType.HYDRANT_SERVICE ? 'left-1 w-[140px] translate-x-[430px]' : ''}
              `}
            />
            <button
              onClick={() => setFilterType('All')}
              className={`w-[70px] flex-shrink-0 flex items-center justify-center py-2 text-[8px] font-black uppercase tracking-widest transition-all relative z-10 ${
                filterType === 'All' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
            >
              ALL
            </button>
            {Object.values(EquipmentType).map((type, idx) => {
              const width = type === EquipmentType.REFUELLER ? 'w-[100px]' : 
                           type === EquipmentType.HYDRANT_DISPENSER ? 'w-[150px]' :
                           type === EquipmentType.DIESEL_TRUCK ? 'w-[110px]' : 'w-[140px]';
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`${width} flex-shrink-0 flex items-center justify-center py-2 text-[8px] font-black uppercase tracking-widest transition-all relative z-10 ${
                    filterType === type ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:space-y-6">
        {Object.entries(equipmentByType).map(([type, statusGroups]) => (
          <div key={type} className="bg-surface-lowest rounded-2xl lg:rounded-3xl p-4 lg:p-8 border border-outline shadow-sm relative overflow-hidden group/section">
            <div className="absolute top-0 right-0 w-[200px] lg:w-[300px] h-[200px] lg:h-[300px] bg-primary/5 rounded-full blur-[60px] lg:blur-[80px] -mr-20 lg:-mr-32 -mt-20 lg:-mt-32 pointer-events-none group-hover/section:bg-primary/10 transition-all duration-700"></div>
            
            <div 
              className="flex items-center justify-between mb-6 lg:mb-8 cursor-pointer group/header relative z-10"
              onClick={() => toggleCategory(type)}
            >
              <div className="flex items-center">
                <div className="p-2 lg:p-3 bg-surface-dim rounded-xl border border-outline mr-3 lg:mr-4 group-hover/header:border-primary transition-all shadow-sm active:scale-95">
                  {expandedCategories[type] ? <ChevronDown className="w-4 h-4 lg:w-5 lg:h-5 text-on-surface" /> : <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-on-surface" />}
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-[900] text-on-surface tracking-tighter uppercase italic">{type} FLEET</h3>
                  <div className="flex items-center gap-3 lg:gap-4 mt-1.5">
                    <span className="text-[8px] lg:text-[9px] font-black text-success uppercase tracking-widest flex items-center">
                      <div className="w-1.5 h-1.5 bg-success rounded-full mr-1.5 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                      {statusGroups.inService.length} ACTIVE
                    </span>
                    {statusGroups.outOfService.length > 0 && (
                      <span className="text-[8px] lg:text-[9px] font-black text-error uppercase tracking-widest flex items-center opacity-60">
                        <div className="w-1.5 h-1.5 bg-error rounded-full mr-1.5"></div>
                        {statusGroups.outOfService.length} GROUNDED
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {expandedCategories[type] && (
              <div className="space-y-6 lg:space-y-8 relative z-10">
                {/* In Service Section */}
                {statusGroups.inService.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.3em] mb-4 flex items-center opacity-40">
                      <span className="w-6 h-0.5 bg-primary/30 mr-3"></span>
                      TASK READY ASSETS
                    </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
                        {statusGroups.inService.map(eq => (
                          <div key={eq.id} className="card-premium bg-surface-dim border border-white/10 flex flex-col group transition-all duration-500 hover:scale-[1.02] hover:border-primary/30 hover:shadow-glow shadow-premium">
                          <div className="p-5 md:p-6 flex-1">
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className="text-xl font-[900] text-on-surface group-hover:text-primary transition-colors tracking-tighter italic">{eq.name}</h3>
                                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{eq.type}</p>
                              </div>
                              <div className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${getStatusColor(eq.status)}`}>
                                {getStatusIcon(eq.status)}
                                <span className="ml-1">{eq.status}</span>
                              </div>
                            </div>

                            {eq.maxCapacity > 0 && (
                              <div className="mb-6 bg-surface-lowest border border-outline p-4 rounded-2xl shadow-inner">
                                <div className="flex justify-between items-end mb-2">
                                  <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Payload Sync</span>
                                  <span className="text-xs font-black text-on-surface tracking-tighter">{eq.currentVolume.toLocaleString()} / {eq.maxCapacity.toLocaleString()} L</span>
                                </div>
                                <div className="w-full bg-surface-dim h-1.5 rounded-full overflow-hidden shadow-inner">
                                  <div 
                                    className="bg-primary h-full transition-all duration-1000 ease-out shadow-premium"
                                    style={{ width: `${(eq.currentVolume / eq.maxCapacity) * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {canEdit && (
                              <div className="mt-6 pt-5 border-t border-outline">
                                <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-[0.2em] opacity-30">Status Override</label>
                                <div className="flex flex-wrap gap-2">
                                  {Object.values(EqStatus).map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(eq.id, status)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border uppercase tracking-tight ${
                                        eq.status === status 
                                          ? `${getStatusGradient(status)} text-white border-transparent shadow-sm scale-[1.02]` 
                                          : 'bg-surface-dim text-on-surface-dim border-outline hover:text-primary hover:border-primary/30'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="bg-surface-dim/40 p-4 border-t border-outline flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                            <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">
                              {new Date(eq.lastUpdated).toLocaleTimeString()}
                            </span>
                            {eq.type === EquipmentType.REFUELLER && canEdit && (
                              <button 
                                onClick={() => sendRefuelRequest(eq.id)}
                                disabled={pendingRequests.has(eq.id) || alerts.some(a => !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eq.id}`))}
                                className={`flex items-center text-[9px] font-black px-2 py-1.5 lg:px-3 lg:py-2 rounded-xl border border-outline shadow-sm transition-all active:scale-95 uppercase tracking-widest ${
                                  pendingRequests.has(eq.id) || alerts.some(a => !a.acknowledged && a.message.includes(`Replenishment requested for unit ${eq.id}`))
                                  ? 'bg-surface-lowest text-on-surface-dim opacity-30 cursor-not-allowed'
                                  : 'text-primary hover:kinetic-gradient hover:text-white hover:border-transparent bg-surface-lowest'
                                }`}
                              >
                                <Send className={`w-3 h-3 mr-1.5 ${pendingRequests.has(eq.id) ? 'animate-pulse' : ''}`} />
                                {pendingRequests.has(eq.id) ? 'SENDING...' : 'REPLENISH'}
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
                  <div className="pt-6">
                    <h4 className="text-[9px] font-black text-error uppercase tracking-[0.3em] mb-4 flex items-center opacity-60">
                      <span className="w-6 h-0.5 bg-error/20 mr-3"></span>
                      GROUNDED / MAINT
                    </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
                        {statusGroups.outOfService.map(eq => (
                          <div key={eq.id} className="bg-surface-dim/60 border border-white/5 rounded-[24px] overflow-hidden flex flex-col opacity-75 grayscale-[0.6] hover:opacity-100 hover:grayscale-0 transition-all duration-500 hover:border-error/30 shadow-premium">
                          <div className="p-5 md:p-6 flex-1 relative">
                            <div className="absolute top-0 right-0 p-5 w-full flex justify-end">
                              <AlertCircle className="w-6 h-6 text-error opacity-10" />
                            </div>
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <h3 className="text-xl font-[900] text-on-surface-dim tracking-tighter italic uppercase">{eq.name}</h3>
                                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{eq.type}</p>
                              </div>
                              <div className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest ${getStatusColor(eq.status)}`}>
                                {getStatusIcon(eq.status)}
                                <span className="ml-1">{eq.status}</span>
                              </div>
                            </div>

                            {canEdit && (
                              <div className="mt-6 pt-5 border-t border-error/5">
                                <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-[0.2em] opacity-30">Fleet Recovery</label>
                                <div className="flex flex-wrap gap-2">
                                  {Object.values(EqStatus).map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(eq.id, status)}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border uppercase tracking-tight ${
                                        eq.status === status 
                                          ? 'bg-error text-white border-error shadow-sm' 
                                          : 'bg-surface-lowest text-on-surface-dim border-outline hover:border-error/30 hover:text-error'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="bg-error/[0.03] p-4 border-t border-error/5 flex justify-between items-center text-error opacity-60">
                            <span className="text-[9px] font-black uppercase tracking-widest italic">Operations Restriction Active</span>
                            <Wrench className="w-3.5 h-3.5" />
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
      
    </div>
  );
};
