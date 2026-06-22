import React, { useState } from 'react';
import { Tank, FuelType, User, UserRole } from '../types';
import { RefreshCw, AlertTriangle, Save, Droplet, Plane, Fuel, Database, Search, LayoutGrid, List, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { CALIBRATED_TANK_IDS, lookupVolumeSync, preloadCalibrationData } from '../services/calibrationService';

interface StockProps {
  user?: User | null;
}

export const Stock: React.FC<StockProps> = ({ user }) => {
  const { notify } = useNotification();
  const { tanks, updateTankLevel, serviceTankId, setServiceTankId } = useOperationalData();
  const [readings, setReadings] = useState<Record<string, number>>({});
  const [dipReadings, setDipReadings] = useState<Record<string, string>>({});
  const [tempReadings, setTempReadings] = useState<Record<string, string>>({});
  const [sgReadings, setSgReadings] = useState<Record<string, string>>({});
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [layoutMode, setLayoutMode] = useState<'cards' | 'table'>('table'); // Default to Table mode!
  const [serviceTankDropdownOpen, setServiceTankDropdownOpen] = useState(false);

  // Preload calibration data on mount
  React.useEffect(() => {
    preloadCalibrationData();
  }, []);

  const isOperator = user?.role === UserRole.DEPOT_OPERATOR;

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

  // Convert DIP Height (mm) to Liters using calibration table lookup
  const handleDipChange = (id: string, heightStr: string, capacity: number) => {
    // Keep raw string in local state for fluid typing
    setDipReadings(prev => ({ ...prev, [id]: heightStr }));

    const dipMm = parseFloat(heightStr) || 0;
    if (dipMm <= 0) {
      setReadings(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Use calibration table lookup (synchronous - data is preloaded)
    const calibratedVolume = lookupVolumeSync(id, dipMm);
    if (calibratedVolume !== null) {
      setReadings(prev => ({
        ...prev,
        [id]: calibratedVolume
      }));
    } else {
      // Fallback for tanks without calibration data
      const height = dipMm / 10; // Convert MM to CM for legacy formula
      const factor = capacity / 400;
      const calculatedLiters = Math.min(capacity, Math.round(height * factor));
      setReadings(prev => ({
        ...prev,
        [id]: calculatedLiters
      }));
    }
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
      notify(`Successfully finalized inventory readings for ${updatedCount} tanks.`, 'success');
      setReadings({}); // Clear readings after save
      setDipReadings({});
      setTempReadings({});
      setSgReadings({});
    } else {
      notify(`Please enter physical dip height or manual volume values first.`, 'warning');
    }
  };

  // Filter and search tanks
  const filteredTanks = (tanks || []).filter(tank => !!tank);

  // Group tanks
  const groups = filteredTanks.reduce((acc: Record<string, Tank[]>, tank) => {
    const category = categorizeTank(tank);
    if (!acc[category]) acc[category] = [];
    acc[category].push(tank);
    return acc;
  }, {});

  const order = ['NEW FUEL FARM', 'OLD FUEL FARM', 'SEAPLANE FUEL', 'FILLING STATIONS', 'OTHER INFRASTRUCTURE'];

  return (
    <div className="p-4 lg:p-10 space-y-8 lg:space-y-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            DEPOT <span className="text-primary italic font-medium ml-2 lg:ml-3">INVENTORY</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: STOCK FLOW</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">JIG Quality & Reconciliation</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {/* Layout Toggle switcher */}
          <div className="bg-surface-dim p-1.5 rounded-2xl border border-outline flex items-center shadow-inner">
            <button 
              onClick={() => setLayoutMode('table')}
              className={`p-2.5 rounded-xl transition-all ${layoutMode === 'table' ? 'kinetic-gradient text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setLayoutMode('cards')}
              className={`p-2.5 rounded-xl transition-all ${layoutMode === 'cards' ? 'kinetic-gradient text-white shadow-premium' : 'text-on-surface-dim hover:text-on-surface'}`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Date Selector - Protected for Depot Operators */}
          <div className="relative bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner flex items-center">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary opacity-40 pointer-events-none" />
            <input
              type="date"
              disabled={isOperator}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => { try { if (!isOperator && 'showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
              className={`bg-transparent text-[11px] font-black uppercase tracking-widest text-on-surface outline-none pl-8 pr-3 py-1.5 ${
                isOperator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
          </div>
          
          {/* Sync Container */}
          <div className="flex items-center sm:bg-surface-dim sm:p-1.5 sm:rounded-2xl sm:border sm:border-outline sm:shadow-inner">
            <span className="hidden sm:block text-[10px] font-black text-on-surface-dim px-4 uppercase tracking-widest opacity-60">
              Sync: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
            </span>
            <button className="p-3.5 hover:bg-surface-lowest rounded-xl border border-outline bg-surface-dim transition-all active:scale-95 shadow-sm">
              <RefreshCw className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
      </div>



      {/* Service Tank Selector - Depot Manager & Admin only */}
      {user && (user.role === UserRole.DEPOT_MANAGER || user.role === UserRole.ADMIN) && (
        <div className="card-premium p-4 border border-outline flex flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <Droplet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-black text-on-surface uppercase tracking-wide leading-none">Active Service Tank</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setServiceTankDropdownOpen(!serviceTankDropdownOpen)}
              className="flex items-center space-x-3 px-5 py-3 bg-surface-dim border border-outline rounded-2xl hover:border-primary/40 transition-all"
            >
              <Droplet className="w-4 h-4 text-primary" />
              <span className="text-xs font-black text-on-surface uppercase tracking-tight">
                {tanks.find(t => t.id === serviceTankId)?.name?.replace(/\s\((NFF|OFF)\)/i, '') || 'TK-101'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-on-surface-dim transition-transform ${serviceTankDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {serviceTankDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-outline rounded-2xl shadow-premium z-50 overflow-hidden">
                <div className="p-2 space-y-0.5">
                  {tanks
                    .filter(t => t.type === FuelType.JET_A1 && !t.name.toUpperCase().includes('RECOVERY') && !t.name.toUpperCase().includes('SPF'))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setServiceTankId(t.id);
                          setServiceTankDropdownOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-left ${
                          serviceTankId === t.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-surface-dim text-on-surface'
                        }`}
                      >
                        <Droplet className={`w-3.5 h-3.5 ${serviceTankId === t.id ? 'text-primary' : 'text-on-surface-dim opacity-40'}`} />
                        <span className="text-[11px] font-black uppercase tracking-tight">
                          {t.name.replace(/\s\((NFF|OFF)\)/i, '')}
                        </span>
                        {serviceTankId === t.id && (
                          <span className="ml-auto text-[8px] font-black text-primary uppercase tracking-widest">Active</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Main Lists */}
      <div className="space-y-16">
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

              {layoutMode === 'table' ? (
                /* TABULAR LAYOUT (Premium High-Speed Grid) */
                <div className="card-premium overflow-hidden border border-outline shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-dim border-b border-outline">
                          <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Tank Name</th>
                          <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Product</th>
                          <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Live Volume (L)</th>
                          <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Capacity (L)</th>
                          <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Fill Ratio</th>
                          {category !== 'SEAPLANE FUEL' && category !== 'FILLING STATIONS' && (
                            <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60" style={{ width: '130px' }}>Dip Height (mm)</th>
                          )}
                          <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60" style={{ width: '150px' }}>
                            {category === 'FILLING STATIONS' || category === 'SEAPLANE FUEL' ? 'Volume (L)' : 'Calc Volume (L)'}
                          </th>
                          {category !== 'FILLING STATIONS' && (
                            <>
                              <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60" style={{ width: '90px' }}>Temp (°C)</th>
                              <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60" style={{ width: '90px' }}>SG 15°C</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline">
                        {sortedTanks.map(tank => {
                          const style = getFuelStyle(tank.type);
                          const Icon = style.icon;
                          const fillPct = (tank.currentLevel / tank.capacity) * 100;
                          const isLow = tank.currentLevel < tank.safeMinLevel;

                          return (
                            <tr key={tank.id} className={`hover:bg-primary/[0.02] transition-colors ${isLow ? 'bg-error/5' : ''}`}>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 ${style.bg} rounded-xl border ${style.border}`}>
                                    <Icon className={`w-4 h-4 ${style.color}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-on-surface pr-2">{tank.name.replace(/\s\((NFF|OFF)\)/i, '')}</p>
                                    <p className="text-[8px] font-semibold text-on-surface-dim opacity-40">{tank.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[9px] font-black uppercase tracking-wider ${style.color}`}>
                                  {tank.type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs font-bold">
                                {tank.currentLevel.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs opacity-50">
                                {tank.capacity.toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center space-x-2">
                                  <span className={`text-[10px] font-mono font-bold ${isLow ? 'text-error' : 'text-on-surface'}`}>{fillPct.toFixed(1)}%</span>
                                  <div className="w-12 h-2 bg-surface-lowest border border-outline rounded-full overflow-hidden shrink-0">
                                    <div 
                                      className={`h-full rounded-full ${isLow ? 'bg-error' : style.accent}`} 
                                      style={{ width: `${fillPct}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              {/* DIP mm Input */}
                              {category !== 'SEAPLANE FUEL' && category !== 'FILLING STATIONS' && (
                                <td className="px-6 py-4 text-center">
                                  {CALIBRATED_TANK_IDS.has(tank.id) ? (
                                    <input 
                                      type="number"
                                      step="1"
                                      min="0"
                                      className="w-24 text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-black uppercase focus:ring-2 focus:ring-primary outline-none"
                                      placeholder="0"
                                      value={dipReadings[tank.id] ?? ''}
                                      onChange={(e) => handleDipChange(tank.id, e.target.value, tank.capacity)}
                                    />
                                  ) : (
                                    <span className="text-on-surface-dim opacity-30">—</span>
                                  )}
                                </td>
                              )}
                              {/* Liters Input (Read-Only if Calibrated, Manual if Uncalibrated) */}
                              <td className="px-6 py-4 text-center">
                                {CALIBRATED_TANK_IDS.has(tank.id) ? (
                                  <input 
                                    type="text"
                                    readOnly
                                    className="w-28 text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono font-bold text-on-surface-dim opacity-70 cursor-not-allowed"
                                    placeholder=""
                                    value={readings[tank.id] ? readings[tank.id].toLocaleString() : ''}
                                  />
                                ) : (
                                  <input 
                                    type="number"
                                    step="1"
                                    min="0"
                                    className="w-28 text-center px-2 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="0"
                                    value={readings[tank.id] ?? ''}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setReadings(prev => ({ ...prev, [tank.id]: val }));
                                    }}
                                  />
                                )}
                              </td>
                              {category !== 'FILLING STATIONS' && (
                                <>
                                  <td className="px-6 py-4 text-center">
                                    {tank.type === FuelType.DIESEL || tank.type === FuelType.PETROL ? (
                                      <span className="text-on-surface-dim opacity-30">—</span>
                                    ) : (
                                      <input 
                                        type="number"
                                        step="0.1"
                                        placeholder="15.0"
                                        className="w-16 text-center px-1.5 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono text-on-surface"
                                        value={tempReadings[tank.id] ?? ''}
                                        onChange={(e) => setTempReadings(prev => ({ ...prev, [tank.id]: e.target.value }))}
                                      />
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    {tank.type === FuelType.DIESEL || tank.type === FuelType.PETROL ? (
                                      <span className="text-on-surface-dim opacity-30">—</span>
                                    ) : (
                                      <input 
                                        type="number"
                                        step="0.0001"
                                        placeholder="0.8000"
                                        className="w-18 text-center px-1.5 py-1.5 bg-surface-dim border border-outline rounded-lg text-xs font-mono text-on-surface"
                                        value={sgReadings[tank.id] ?? ''}
                                        onChange={(e) => setSgReadings(prev => ({ ...prev, [tank.id]: e.target.value }))}
                                      />
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* CARD GRID LAYOUT */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sortedTanks.map(tank => {
                    const style = getFuelStyle(tank.type);
                    const Icon = style.icon;
                    const fillPct = (tank.currentLevel / tank.capacity) * 100;
                    const isLow = tank.currentLevel < tank.safeMinLevel;

                    return (
                       <div key={tank.id} className={`card-premium group hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col ${isLow ? 'border-error/40 bg-error/5' : ''}`}>
                        <div className={`absolute top-0 left-0 w-full h-1 ${style.accent} opacity-40 group-hover:opacity-100 transition-opacity`}></div>
                        
                        <div className="p-5 flex-grow flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2.5 ${style.bg} rounded-xl border ${style.border}`}>
                                <Icon className={`w-5 h-5 ${style.color}`} />
                              </div>
                              <div>
                                <h4 className="text-[13px] font-[900] text-on-surface tracking-tighter uppercase leading-none pr-1">
                                  {tank.name.replace(/\s\((NFF|OFF)\)/i, '')}
                                </h4>
                                <p className={`text-[8px] font-black ${style.color} uppercase tracking-widest mt-1 opacity-70`}>
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
                          <div className="flex-grow space-y-3 mb-4">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Live Volume</span>
                              <span className={`text-[12px] font-black tracking-tight ${isLow ? 'text-error' : style.color}`}>
                                {fillPct.toFixed(1)}%
                              </span>
                            </div>
                            
                            <p className="text-xl font-black text-on-surface tracking-tighter">
                              {tank.currentLevel.toLocaleString()} <span className="text-xs font-bold opacity-30">L</span>
                            </p>

                            <div className="relative h-2 bg-surface-lowest border border-outline rounded-full overflow-hidden shadow-inner">
                              <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-[1000ms] ${isLow ? 'bg-error shadow-[0_0_12px_rgba(239,68,68,0.4)]' : style.accent + ' shadow-glow'}`}
                                style={{ width: `${Math.max(2, fillPct)}%` }}
                              />
                            </div>

                            <div className="text-[8px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">
                              Cap: {tank.capacity.toLocaleString()}L
                            </div>
                          </div>

                          <div className="space-y-4 pt-4 border-t border-outline/50 mt-4">
                            {CALIBRATED_TANK_IDS.has(tank.id) ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-50">Dip Height (mm)</label>
                                  <input 
                                    type="number" 
                                    step="1"
                                    className="w-full px-2 py-2 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] font-black text-center"
                                    placeholder="0"
                                    value={dipReadings[tank.id] ?? ''}
                                    onChange={(e) => handleDipChange(tank.id, e.target.value, tank.capacity)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-50">Calculated (L)</label>
                                  <input 
                                    type="text" 
                                    readOnly
                                    className="w-full px-2 py-2 bg-surface-dim text-on-surface-dim border border-outline/30 rounded-xl text-[10px] font-mono font-bold text-center opacity-70 cursor-not-allowed"
                                    placeholder=""
                                    value={readings[tank.id] ? readings[tank.id].toLocaleString() : ''}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-50">Manual Volume (L)</label>
                                <input 
                                  type="number" 
                                  step="1"
                                  min="0"
                                  className="w-full px-2 py-2 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] font-mono font-bold text-center focus:ring-2 focus:ring-primary outline-none"
                                  placeholder="0"
                                  value={readings[tank.id] ?? ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setReadings(prev => ({ ...prev, [tank.id]: val }));
                                  }}
                                />
                              </div>
                            )}
                            {tank.type !== FuelType.DIESEL && tank.type !== FuelType.PETROL && category !== 'FILLING STATIONS' && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-50">Temp (°C)</label>
                                  <input 
                                    type="number" 
                                    step="0.1"
                                    className="w-full px-2 py-1.5 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] text-center"
                                    placeholder="15.0"
                                    value={tempReadings[tank.id] ?? ''}
                                    onChange={(e) => setTempReadings(prev => ({ ...prev, [tank.id]: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-50">SG 15°C</label>
                                  <input 
                                    type="number" 
                                    step="0.0001"
                                    className="w-full px-2 py-1.5 bg-surface-dim text-on-surface border border-outline rounded-xl text-[10px] text-center"
                                    placeholder="0.8000"
                                    value={sgReadings[tank.id] ?? ''}
                                    onChange={(e) => setSgReadings(prev => ({ ...prev, [tank.id]: e.target.value }))}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-8 border-t border-outline flex flex-col items-center">
          <button 
             onClick={handleSave}
             className="w-full lg:w-auto kinetic-gradient text-white p-4 lg:p-6 lg:px-16 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center shadow-premium active:scale-95 transition-all hover:scale-[1.02]"
             title="Finalize Reconciliation"
           >
              <Save className="w-5 h-5 mr-3" />
              <span>FINALIZE RECONCILIATION</span>
          </button>
      </div>
    </div>
  );
};