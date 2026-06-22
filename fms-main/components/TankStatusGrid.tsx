
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
          color: 'text-sky-400',
          bg: 'bg-sky-500/10',
          border: 'border-sky-500/30',
          accent: 'bg-gradient-to-t from-sky-600 to-sky-400',
          cardBg: 'from-sky-500/[0.05] to-transparent',
          cardBorder: 'border-sky-500/25 hover:border-sky-500/55 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)]',
          hoverColor: 'group-hover:text-sky-400'
        };
      case FuelType.DIESEL:
        return {
          icon: Fuel,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          accent: 'bg-gradient-to-t from-amber-600 to-amber-400',
          cardBg: 'from-amber-500/[0.05] to-transparent',
          cardBorder: 'border-amber-500/25 hover:border-amber-500/55 hover:shadow-[0_0_20px_rgba(245,158,11,0.12)]',
          hoverColor: 'group-hover:text-amber-500'
        };
      case FuelType.PETROL:
        return {
          icon: Fuel,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          accent: 'bg-gradient-to-t from-emerald-600 to-emerald-400',
          cardBg: 'from-emerald-500/[0.05] to-transparent',
          cardBorder: 'border-emerald-500/25 hover:border-emerald-500/55 hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]',
          hoverColor: 'group-hover:text-emerald-500'
        };
      default:
        return {
          icon: Droplet,
          color: 'text-on-surface-dim',
          bg: 'bg-surface-dim/10',
          border: 'border-outline/30',
          accent: 'bg-gradient-to-t from-surface-dim to-on-surface-dim',
          cardBg: 'from-surface-dim/5 to-transparent',
          cardBorder: 'border-outline/20 hover:border-outline/40',
          hoverColor: 'group-hover:text-on-surface'
        };
    }
  };

  return (
    <div className="space-y-12">
      {order.map(category => {
        const categoryTanks = groups[category];
        if (!categoryTanks || categoryTanks.length === 0) return null;

        // Sort to show JET A1 tanks first, placing Recovery tanks at the end of the JET A1 list
        const sortedTanks = [...categoryTanks].sort((a, b) => {
          if (a.type === FuelType.JET_A1 && b.type !== FuelType.JET_A1) return -1;
          if (a.type !== FuelType.JET_A1 && b.type === FuelType.JET_A1) return 1;
          
          if (a.type === FuelType.JET_A1 && b.type === FuelType.JET_A1) {
            const aIsRecovery = a.name.toUpperCase().includes('RECOVERY');
            const bIsRecovery = b.name.toUpperCase().includes('RECOVERY');
            if (aIsRecovery && !bIsRecovery) return 1;
            if (!aIsRecovery && bIsRecovery) return -1;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          }
          
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

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
              {sortedTanks.map(tank => {
                const style = getFuelStyle(tank.type);
                const Icon = style.icon;
                const fillPct = (tank.currentLevel / tank.capacity) * 100;
                const isLow = tank.currentLevel < tank.safeMinLevel;

                return (
                  <div 
                    key={tank.id} 
                    className={`card-premium p-6 group hover:scale-[1.02] transition-all relative overflow-hidden bg-gradient-to-b ${style.cardBg} ${isLow ? 'border-error/40 bg-error/5 hover:border-error/60' : style.cardBorder}`}
                  >
                    {/* Fuel Type Accent Line */}
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${style.accent} opacity-60 group-hover:opacity-100 transition-opacity`}></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2.5 ${style.bg} rounded-xl border ${style.border} group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-5 h-5 ${style.color}`} />
                        </div>
                        <div>
                          <h4 className={`text-[14px] font-[900] text-on-surface tracking-tighter uppercase leading-none ${style.hoverColor} transition-colors`}>
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

                    <div className="flex justify-between items-stretch gap-4">
                      {/* Left Info side */}
                      <div className="flex-grow flex flex-col justify-between space-y-2">
                        <div>
                          <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-35">Live Volume</p>
                          <p className="text-base font-black text-on-surface tracking-tighter mt-0.5">
                            {tank.currentLevel.toLocaleString()} <span className="text-[9px] opacity-35 font-bold">L</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-35">Ullage</p>
                          <p className="text-base font-black text-on-surface-dim tracking-tighter mt-0.5 opacity-80">
                            {Math.max(0, tank.capacity - tank.currentLevel).toLocaleString()} <span className="text-[9px] opacity-35 font-bold">L</span>
                          </p>
                        </div>
                        <div className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 space-y-0.5">
                          <div>Cap: {tank.capacity.toLocaleString()} L</div>
                          <div className={isLow ? 'text-error font-bold' : ''}>Min: {tank.safeMinLevel.toLocaleString()} L</div>
                        </div>
                      </div>

                      {/* Right Tank graphic side */}
                      <div className="flex flex-col items-center justify-center shrink-0 w-24">
                        <div className="relative w-20 h-24 bg-surface-lowest border border-outline rounded-2xl overflow-hidden shadow-inner flex flex-col justify-end">
                          {/* Liquid level */}
                          <div 
                            className={`w-full transition-all duration-[1000ms] ${isLow ? 'bg-gradient-to-t from-red-700 to-red-400 shadow-[0_-2px_8px_rgba(239,68,68,0.4)]' : style.accent + ' shadow-glow'}`}
                            style={{ height: `${Math.min(100, Math.max(0, fillPct))}%` }}
                          >
                            {/* Wave highlight */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/20 animate-pulse"></div>
                          </div>
                          {/* Safe Min Marker */}
                          <div 
                            className="absolute w-full h-[1.5px] bg-error opacity-60 z-10"
                            style={{ bottom: `${(tank.safeMinLevel / tank.capacity) * 100}%` }}
                            title={`Safe Minimum Level: ${tank.safeMinLevel.toLocaleString()} L`}
                          />
                          {/* Percentage text overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <span className="text-[10px] font-black text-on-surface select-none drop-shadow-md bg-surface/50 px-1 py-0.5 rounded-md border border-outline/10">
                              {fillPct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Decorative Watermark for Fuel Type */}
                    <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity pointer-events-none text-on-surface-dim">
                      {tank.type === FuelType.JET_A1 ? <Plane size={96} className={style.color} /> :
                       tank.type === FuelType.DIESEL ? <Truck size={96} className={style.color} /> :
                       tank.type === FuelType.PETROL ? <Fuel size={96} className={style.color} /> :
                       <Droplet size={96} className={style.color} />}
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
