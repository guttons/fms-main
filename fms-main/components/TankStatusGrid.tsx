
import React from 'react';
import { Tank, FuelType } from '../types';
import { Droplet, Plane, Truck, Fuel, AlertCircle, Database, LayoutGrid } from 'lucide-react';

interface TankStatusGridProps {
  tanks: Tank[];
}

export const TankStatusGrid: React.FC<TankStatusGridProps> = ({ tanks }) => {
  // Helper to categorize tanks
  const categorizeTank = (tank: Tank) => {
    const name = tank.name.toUpperCase();
    if (name.includes('NFF')) return 'NEW FUEL FARM';
    if (name.includes('OFF')) return 'OLD FUEL FARM';
    if (name.includes('SPF') || tank.id.startsWith('spf')) return 'SEAPLANE FUEL';
    if (name.includes('LFS') || name.includes('AFS') || tank.id.startsWith('lfs') || tank.id.startsWith('afs')) return 'FILLING STATIONS';
    return 'OTHER INFRASTRUCTURE';
  };

  // Group tanks
  const groups = tanks.reduce((acc: Record<string, Tank[]>, tank) => {
    const category = categorizeTank(tank);
    if (!acc[category]) acc[category] = [];
    acc[category].push(tank);
    return acc;
  }, {});

  const order = ['NEW FUEL FARM', 'OLD FUEL FARM', 'SEAPLANE FUEL', 'FILLING STATIONS', 'OTHER INFRASTRUCTURE'];

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

  return (
    <div className="space-y-12">
      {order.map(category => {
        const categoryTanks = groups[category];
        if (!categoryTanks || categoryTanks.length === 0) return null;

        return (
          <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center mb-6">
              <div className="h-1 w-8 bg-primary/40 rounded-full mr-4"></div>
              <h3 className="text-[11px] font-black text-on-surface-dim uppercase tracking-[0.4em] opacity-80">
                {category}
              </h3>
              <div className="h-[1px] flex-1 bg-outline ml-4 opacity-30"></div>
              <span className="ml-4 text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                {categoryTanks.length} ASSETS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {categoryTanks.map(tank => {
                const style = getFuelStyle(tank.type);
                const Icon = style.icon;
                const fillPct = (tank.currentLevel / tank.capacity) * 100;
                const isLow = tank.currentLevel < tank.safeMinLevel;

                return (
                  <div key={tank.id} className={`card-premium p-6 group hover:scale-[1.02] transition-all relative overflow-hidden ${isLow ? 'border-error/40 bg-error/5' : ''}`}>
                    {/* Fuel Type Accent Line */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${style.accent} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                    
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

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-1">Current Level</p>
                          <p className="text-xl font-black text-on-surface tracking-tighter">
                            {(tank.currentLevel / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            <span className="text-xs font-bold opacity-30 ml-1">kL</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[12px] font-black tracking-tight ${isLow ? 'text-error' : style.color}`}>
                            {fillPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar Container */}
                      <div className="relative h-2.5 bg-surface-lowest border border-outline rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`absolute top-0 left-0 h-full transition-all duration-[1500ms] cubic-bezier(0.16, 1, 0.3, 1) ${isLow ? 'bg-error shadow-[0_0_12px_rgba(239,68,68,0.4)]' : style.accent + ' shadow-glow'}`}
                          style={{ width: `${Math.max(2, fillPct)}%` }}
                        />
                        {/* Safe Min Marker */}
                        <div 
                          className="absolute h-full w-[2px] bg-error opacity-40 top-0"
                          style={{ left: `${(tank.safeMinLevel / tank.capacity) * 100}%` }}
                          title="Safe Minimum Level"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-30 mb-0.5">Capacity</p>
                          <p className="text-[10px] font-black text-on-surface opacity-60 uppercase">
                            {(tank.capacity / 1000).toLocaleString()} kL
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-30 mb-0.5">Safe Min</p>
                          <p className={`text-[10px] font-black uppercase ${isLow ? 'text-error' : 'text-on-surface opacity-60'}`}>
                            {(tank.safeMinLevel / 1000).toLocaleString()} kL
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Decorative Watermark for Farm */}
                    <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                       {categorizeTank(tank) === 'NEW FUEL FARM' ? <LayoutGrid size={80} /> : <Database size={80} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
