import React, { useState } from 'react';
import { FuelType } from '../types';
import { RefreshCw, AlertTriangle, Save } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';

export const Stock: React.FC = () => {
  const { notify } = useNotification();
  const { tanks, updateTankLevel } = useOperationalData();
  const [readings, setReadings] = useState<Record<string, number>>({});


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

  return (
    <div className="p-6 lg:p-10 space-y-10">
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
             <span className="text-[10px] font-black text-on-surface-dim px-4 uppercase tracking-widest opacity-60">Last Sync: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             <button className="p-3 hover:bg-surface-lowest rounded-xl border border-outline bg-surface-dim transition-all active:scale-95 shadow-sm">
                <RefreshCw className="w-4 h-4 text-primary" />
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(tanks || []).map((tank) => {
             const isLow = tank.currentLevel < tank.safeMinLevel;
             const fillPct = (tank.currentLevel / tank.capacity) * 100;
             const typeColor = tank.type === FuelType.JET_A1 ? 'bg-primary' : (tank.type === FuelType.DIESEL ? 'bg-warning' : 'bg-error');
             const typeBadge = tank.type === FuelType.JET_A1 
                ? 'bg-primary/10 text-primary border-primary/20' 
                : (tank.type === FuelType.DIESEL ? 'bg-warning/10 text-warning border-warning/20' : 'bg-error/10 text-error border-error/20');

             return (
                <div key={tank.id} className="card-premium group relative overflow-hidden transition-all hover:scale-[1.02]">
                    <div className="p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center flex-wrap gap-2 mb-1">
                                    <h3 className="text-lg font-[900] text-on-surface tracking-tighter italic uppercase">{tank.name}</h3>
                                    {isLow && (
                                        <div className="flex items-center text-error text-[8px] font-black bg-error/10 px-1.5 py-0.5 rounded border border-error/20 animate-pulse">
                                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                            CRITICAL
                                        </div>
                                    )}
                                </div>
                                <p className="text-[8px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest">Cap: {tank.capacity.toLocaleString()} L</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border shadow-sm shrink-0 ml-2 ${typeBadge}`}>
                                {tank.type === FuelType.JET_A1 ? 'JET A-1' : tank.type}
                            </span>
                        </div>

                        <div className="flex items-end space-x-3 mb-4">
                            <div className="flex-1 h-20 bg-surface-dim rounded-lg relative overflow-hidden border border-outline shadow-inner">
                                <div 
                                    className={`absolute bottom-0 w-full transition-all duration-1000 shadow-[0_0_20px_rgba(0,0,0,0.1)] ${typeColor}`}
                                    style={{ height: `${fillPct}%` }}
                                >
                                    <div className="absolute top-0 w-full h-1 bg-white/20 blur-[1px]"></div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col justify-center min-w-[6.5rem]">
                                <span className="block text-2xl xl:text-3xl font-[900] text-on-surface tracking-tighter italic">{tank.currentLevel.toLocaleString()}</span>
                                <span className="text-[8px] font-black text-on-surface-dim uppercase opacity-50 tracking-widest leading-tight mt-1">LITERS STATUS</span>
                                <div className="mt-0.5 inline-flex items-center justify-end">
                                    <span className="text-[10px] font-black text-primary">{Math.round(fillPct)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-outline">
                            <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">Physical Dip Reconciliation (L)</label>
                                <input 
                                    type="number" 
                                    className="w-full px-3 py-2.5 bg-surface text-on-surface border border-outline rounded-xl text-[10px] font-[900] uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner"
                                    placeholder={tank.currentLevel.toString()}
                                    value={readings[tank.id] ?? ''}
                                    onChange={(e) => handleReadingChange(tank.id, e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">Temp (°C)</label>
                                    <input type="number" className="w-full px-3 py-2.5 bg-surface text-on-surface border border-outline rounded-xl text-[10px] font-[900] uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner" placeholder="15.0" />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1.5 tracking-widest opacity-40">SG 15°C</label>
                                    <input type="number" className="w-full px-3 py-2.5 bg-surface text-on-surface border border-outline rounded-xl text-[10px] font-[900] uppercase tracking-widest placeholder:text-on-surface-dim/20 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-inner" placeholder="0.8000" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             );
        })}
      </div>

      <div className="fixed bottom-[90px] right-6 lg:bottom-10 lg:right-10 z-[60] animate-in slide-in-from-bottom-5">
          <button 
             onClick={handleSave}
             className="flex items-center justify-center p-4 lg:px-6 lg:py-4 bg-primary text-white rounded-full lg:rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 active:scale-95 active:translate-y-0 transition-all border border-white/10 group"
             title="Finalize Reconciliation"
           >
              <Save className="w-6 h-6 lg:w-5 lg:h-5 lg:mr-3 group-hover:scale-110 transition-transform" />
              <span className="hidden lg:inline font-[900] text-[11px] uppercase tracking-[0.2em]">
                  FINALIZE RECONCILIATION
              </span>
          </button>
      </div>
    </div>

  );
};