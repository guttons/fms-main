import React, { useState } from 'react';
import { Tank, FuelType } from '../types';
import { RefreshCw, AlertTriangle, Save, Droplet, Plane, Fuel, Database, LayoutGrid, AlertCircle } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';

export const Stock: React.FC = () => {
  const { notify } = useNotification();
  const { tanks, updateTankLevel } = useOperationalData();
  const [readings, setReadings] = useState<Record<string, number>>({});

  // Helper to categorize tanks
  const categorizeTank = (tank: Tank) => {
    const name = tank.name.toUpperCase();
    if (name.includes('NFF')) return 'NEW FUEL FARM';
    if (name.includes('OFF')) return 'OLD FUEL FARM';
    if (name.includes('SPF') || tank.id.startsWith('spf')) return 'SEAPLANE FUEL';
    if (name.includes('LFS') || name.includes('AFS') || tank.id.startsWith('lfs') || tank.id.startsWith('afs')) return 'FILLING STATIONS';
    return 'OTHER INFRASTRUCTURE';
  };

  const getFuelStyle = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1:
        return {
          icon: Plane,
          color: 'text-primary',
          bg: 'bg-primary/5',
          border: 'border-primary/20',
          accent: 'bg-primary'
        };
      case FuelType.DIESEL:
        return {
          icon: Fuel,
          color: 'text-amber-600',
          bg: 'bg-amber-500/5',
          border: 'border-amber-500/20',
          accent: 'bg-amber-500'
        };
      case FuelType.PETROL:
        return {
          icon: Fuel,
          color: 'text-emerald-600',
          bg: 'bg-emerald-500/5',
          border: 'border-emerald-500/20',
          accent: 'bg-emerald-500'
        };
      default:
        return {
          icon: Droplet,
          color: 'text-on-surface-dim',
          bg: 'bg-surface-dim',
          border: 'border-outline',
          accent: 'bg-on-surface-dim'
        };
    }
  };

  const handleReadingChange = (id: string, value: string) => {
    setReadings(prev => ({
        ...prev,
        [id]: parseFloat(value) || 0
    }));
  };

  const handleSave = () => {
    let updatedCount = 0;
    Object.entries(readings).forEach(([id, level]) => {
        const numLevel = level as number;
        if (!isNaN(numLevel) && numLevel >= 0) {
            updateTankLevel(id, numLevel);
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        notify(`Successfully updated inventory for ${updatedCount} tanks.`, 'success');
        setReadings({}); // Clear readings after save
    }
  };

  // Group tanks
  const groups = (tanks || []).reduce((acc: Record<string, Tank[]>, tank) => {
    const category = categorizeTank(tank);
    if (!acc[category]) acc[category] = [];
    acc[category].push(tank);
    return acc;
  }, {});

  const order = ['NEW FUEL FARM', 'OLD FUEL FARM', 'SEAPLANE FUEL', 'FILLING STATIONS', 'OTHER INFRASTRUCTURE'];

  return (
    <div className="p-6 lg:p-10 space-y-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            DEPOT <span className="text-primary italic font-medium ml-3">INVENTORY</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Status: MONITORING</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Live Tank Reconciliation</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner">
             <span className="text-[10px] font-black text-on-surface-dim px-4 uppercase tracking-widest opacity-60">Last Sync: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</span>
             <button className="p-3 hover:bg-surface-lowest rounded-xl border border-outline bg-surface-dim transition-all active:scale-95 shadow-sm">
                <RefreshCw className="w-4 h-4 text-primary" />
             </button>
        </div>
      </div>

      <div className="space-y-16">
        {order.map(category => {
          const categoryTanks = groups[category];
          if (!categoryTanks || categoryTanks.length === 0) return null;

          return (
            <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center mb-8">
                <div className="h-1 w-8 bg-primary/40 rounded-full mr-4"></div>
                <h3 className="text-[11px] font-black text-on-surface-dim uppercase tracking-[0.4em] opacity-80">
                  {category}
                </h3>
                <div className="h-[1px] flex-1 bg-outline ml-4 opacity-30"></div>
                <span className="ml-4 text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                  {categoryTanks.length} TANKS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryTanks.map(tank => {
                  const style = getFuelStyle(tank.type);
                  const Icon = style.icon;
                  const fillPct = (tank.currentLevel / tank.capacity) * 100;
                  const isLow = tank.currentLevel < tank.safeMinLevel;

                  return (
                    <div key={tank.id} className={`card-premium group hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col ${isLow ? 'border-error/40 bg-error/5' : ''}`}>
                      {/* Fuel Type Accent Line */}
                      <div className={`absolute top-0 left-0 w-full h-1 ${style.accent} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                      
                      <div className="p-5 flex-1">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2.5 ${style.bg} rounded-xl border ${style.border} group-hover:scale-110 transition-transform`}>
                              <Icon className={`w-5 h-5 ${style.color}`} />
                            </div>
                            <div>
                              <h4 className="text-[14px] font-[900] text-on-surface tracking-tighter uppercase leading-none group-hover:text-primary transition-colors">
                                {tank.name.replace(/\s\((NFF|OFF)\)/i, '')}
                              </h4>
                              <p className={`text-[9px] font-black ${style.color} uppercase tracking-widest mt-1 opacity-70`}>
                                {tank.type}
                              </p>
                            </div>
                          </div>
                          {isLow && (
                            <div className="p-1 bg-error/10 rounded-lg animate-pulse">
                              <AlertCircle className="w-4 h-4 text-error" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-1">Live Status</p>
                              <p className="text-xl font-black text-on-surface tracking-tighter">
                                {tank.currentLevel.toLocaleString()}
                                <span className="text-xs font-bold opacity-30 ml-1 text-[10px]">L</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-[12px] font-black tracking-tight ${isLow ? 'text-error' : style.color}`}>
                                {fillPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Container */}
                          <div className="relative h-2 bg-surface-lowest border border-outline rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={`absolute top-0 left-0 h-full transition-all duration-[1500ms] ease-out ${isLow ? 'bg-error shadow-[0_0_12px_rgba(239,68,68,0.4)]' : style.accent + ' shadow-glow'}`}
                              style={{ width: `${Math.max(2, fillPct)}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-1">
                            <div>
                              <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-30 mb-0.5">Capacity</p>
                              <p className="text-[10px] font-black text-on-surface opacity-60 uppercase">
                                {tank.capacity.toLocaleString()} L
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-30 mb-0.5">Safe Min</p>
                              <p className={`text-[10px] font-black uppercase ${isLow ? 'text-error' : 'text-on-surface opacity-60'}`}>
                                {tank.safeMinLevel.toLocaleString()} L
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Input Fields Section */}
                        <div className="space-y-4 pt-5 border-t border-outline/50 mt-auto">
                          <div>
                            <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">Physical Dip Reconciliation (L)</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                              placeholder={tank.currentLevel.toString()}
                              value={readings[tank.id] ?? ''}
                              onChange={(e) => handleReadingChange(tank.id, e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">Temp (°C)</label>
                              <input 
                                type="number" 
                                step="0.1"
                                className="w-full px-3 py-2 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                placeholder="15.0" 
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">SG 15°C</label>
                              <input 
                                type="number" 
                                step="0.0001"
                                className="w-full px-3 py-2 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                placeholder="0.8000" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Decorative Watermark for Farm */}
                      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                         {category === 'NEW FUEL FARM' ? <LayoutGrid size={80} /> : <Database size={80} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-[90px] right-6 lg:bottom-10 lg:right-10 z-[60] animate-in slide-in-from-bottom-5">
          <button 
             onClick={handleSave}
             className="flex items-center justify-center p-4 lg:px-6 lg:py-4 kinetic-gradient text-white rounded-full lg:rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 active:scale-95 active:translate-y-0 transition-all border border-white/10 group"
             title="Finalize Reconciliation"
           >
              <Save className="w-6 h-6 lg:w-5 lg:h-5 lg:mr-3 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:inline font-black text-[11px] uppercase tracking-[0.2em]">
                  FINALIZE RECONCILIATION
              </span>
          </button>
      </div>
    </div>
  );
};