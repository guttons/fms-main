import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { FORECAST_DATA } from '../constants';
import { RefreshCw, Download, Layers, Calendar, ChevronRight, Fuel, AlertTriangle, CheckCircle, TrendingUp, Info } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { FuelType } from '../types';

export const Forecasting: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('nominal');
  const activeScenario = FORECAST_DATA.find(s => s.id === activeScenarioId) || FORECAST_DATA[0];
  const { tanks } = useOperationalData();

  // Stock Order Estimator State
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>(FuelType.JET_A1);
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default to 14 days from now
    return d.toISOString().split('T')[0];
  });

  // Default burn rates and safe reserves based on FuelType
  const getInitialBurnRate = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1: return 150000;
      case FuelType.DIESEL: return 8000;
      case FuelType.PETROL: return 2500;
      default: return 150000;
    }
  };

  const getSafeReserve = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1: return 1000000; // 1M L
      case FuelType.DIESEL: return 20000;   // 20k L
      case FuelType.PETROL: return 10000;   // 10k L
      default: return 1000000;
    }
  };

  const [burnRateInput, setBurnRateInput] = useState<string>('150000');
  const [customReserveInput, setCustomReserveInput] = useState<string>('1000000');

  // Synchronize defaults on toggle
  const handleFuelToggle = (type: FuelType) => {
    setSelectedFuelType(type);
    setBurnRateInput(getInitialBurnRate(type).toString());
    setCustomReserveInput(getSafeReserve(type).toString());
  };

  // Filter tanks and compute aggregates
  const activeTanks = (tanks || []).filter(t => t && t.type === selectedFuelType);
  const totalCurrentStock = activeTanks.reduce((sum, t) => sum + (t.currentLevel || 0), 0);
  const totalCapacity = activeTanks.reduce((sum, t) => sum + (t.capacity || 0), 0);

  const parsedBurnRate = parseFloat(burnRateInput) || 0;
  const parsedReserve = parseFloat(customReserveInput) || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const projectedConsumption = diffDays * parsedBurnRate;
  const projectedStockLevel = totalCurrentStock - projectedConsumption;
  
  // Volume needed to ensure stock does not fall below safe reserve + meets projected demand
  const recommendedOrder = Math.max(0, (parsedReserve + projectedConsumption) - totalCurrentStock);

  const getScenarioGradient = (id: string) => {
    switch (id) {
      case 'nominal': return 'kinetic-gradient';
      case 'upper': return 'gradient-error';
      case 'lower': return 'gradient-warning';
      default: return 'kinetic-gradient';
    }
  };

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            STOCK <span className="text-primary italic font-medium ml-3">FORECAST</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono whitespace-nowrap">Registry: DEPOT LOGISTICS</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20 hidden md:block"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] whitespace-nowrap">Predictive Depletion Modeling</span>
          </div>
        </div>
        <div className="flex space-x-4">
          <button className="flex items-center px-4 py-2.5 lg:px-6 lg:py-3.5 bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all text-on-surface-dim">
            <RefreshCw className="w-4 h-4 mr-3 text-primary opacity-60 animate-spin-slow" />
            RECALCULATE
          </button>
          <button className="flex items-center px-4 py-2.5 lg:px-6 lg:py-3.5 kinetic-gradient text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all border-none">
            <Download className="w-4 h-4 mr-3" />
            EXPORT DATA
          </button>
        </div>
      </div>

      {/* Scenario Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {FORECAST_DATA.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenarioId(scenario.id)}
            className={`card-premium p-6 lg:p-8 text-left transition-all relative overflow-hidden group ${
              activeScenarioId === scenario.id 
                ? 'border-primary shadow-lg' 
                : 'hover:border-primary/40'
            }`}
          >
            {activeScenarioId === scenario.id && (
               <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[40px] flex items-center justify-center border-l border-b border-primary/20">
                  <Layers className="w-5 h-5 text-primary" />
               </div>
            )}
            <div className="flex items-center space-x-4 mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border transition-all ${
                activeScenarioId === scenario.id 
                  ? `${getScenarioGradient(scenario.id)} text-white border-transparent shadow-md` 
                  : 'bg-surface-dim text-on-surface-dim border-outline'
              }`}>
                {scenario.name}
              </span>
            </div>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed">{scenario.description}</p>
          </button>
        ))}
      </div>

      {/* Main Forecast Chart */}
      <div className="card-premium p-6 lg:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
           <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
              <Layers className="w-4 h-4 mr-3 text-primary opacity-40" />
              Depletion Protocol [30-DAY]
           </h3>
           <div className="flex items-center space-x-6 text-[10px] font-black uppercase tracking-widest opacity-40">
              <div className="flex items-center">
                 <div className="w-2 h-2 rounded-full bg-primary mr-2"></div>
                 Active Stock
              </div>
              <div className="flex items-center">
                 <div className="w-2 h-2 rounded-full bg-error mr-2"></div>
                 Critical Limit
              </div>
           </div>
        </div>
        <div className="h-[300px] sm:h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeScenario.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                 dataKey="day" 
                 axisLine={false} 
                 tickLine={false} 
                 tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}} 
                 dy={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} 
                tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}}
                dx={-10}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
              <Tooltip 
                 contentStyle={{ 
                    backgroundColor: 'var(--color-surface-dim)', 
                    color: 'var(--color-on-surface)', 
                    borderRadius: '24px', 
                    border: '1px solid var(--color-outline)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    padding: '16px'
                 }}
                 cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                 formatter={(value: number) => [`${value.toLocaleString()} L`, 'STOCK LEVEL']}
              />
              <ReferenceLine y={1000000} stroke="var(--color-error)" strokeDasharray="8 8" strokeWidth={2} label={{ position: 'top', value: 'CRITICAL THRESHOLD', fill: 'var(--color-error)', fontSize: 9, fontWeight: 900 }} />
              
              <Area 
                type="monotone" 
                dataKey="stockLevel" 
                stroke="var(--color-primary)" 
                fillOpacity={1} 
                fill="url(#colorStock)" 
                strokeWidth={4}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* STOCK ORDER ESTIMATOR PANEL */}
      <div className="card-premium p-6 lg:p-10 border-t-4 border-t-primary">
         <div className="flex flex-col lg:flex-row justify-between gap-8 pb-8 border-b border-outline">
            <div>
               <h3 className="text-base font-black text-on-surface uppercase tracking-[0.3em] flex items-center mb-2">
                  <Calendar className="w-5 h-5 mr-3 text-primary" />
                  STOCK ORDER ESTIMATOR
               </h3>
               <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed">
                  Project procurement requirements based on live active stock levels, customized date perimeters, and average nominal burn rates.
               </p>
            </div>
            
            {/* Fuel Type Switcher Tabs */}
            <div className="flex bg-surface-dim p-1.5 rounded-2xl border border-outline self-start">
               {Object.values(FuelType).map((type) => (
                  <button
                     key={type}
                     onClick={() => handleFuelToggle(type)}
                     className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        selectedFuelType === type 
                           ? 'bg-primary text-white shadow-md' 
                           : 'text-on-surface-dim hover:text-on-surface'
                     }`}
                  >
                     {type}
                  </button>
               ))}
            </div>
         </div>

         {/* Form / Inputs Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 py-8 border-b border-outline">
            {/* Target Projection Date */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Target Projection Date</label>
               <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                  <input 
                     required
                     type="date"
                     value={targetDate}
                     min={new Date().toISOString().split('T')[0]}
                     onChange={(e) => setTargetDate(e.target.value)}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                  />
               </div>
            </div>

            {/* Average Daily Burn Rate */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Daily Burn Rate (Liters)</label>
               <div className="relative">
                  <TrendingUp className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                  <input 
                     required
                     type="text"
                     inputMode="numeric"
                     value={burnRateInput ? parseInt(burnRateInput.replace(/,/g, '')).toLocaleString() : ''}
                     onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (val === '' || /^\d*$/.test(val)) {
                           setBurnRateInput(val);
                        }
                     }}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface font-mono"
                     placeholder="150,000"
                  />
               </div>
            </div>

            {/* Minimum Safe Reserve */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Safe Buffer Stock (Liters)</label>
               <div className="relative">
                  <Layers className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                  <input 
                     required
                     type="text"
                     inputMode="numeric"
                     value={customReserveInput ? parseInt(customReserveInput.replace(/,/g, '')).toLocaleString() : ''}
                     onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (val === '' || /^\d*$/.test(val)) {
                           setCustomReserveInput(val);
                        }
                     }}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface font-mono"
                     placeholder="1,000,000"
                  />
               </div>
            </div>
         </div>

         {/* Calculations Output Metrics */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8">
            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Live Current Stock</span>
               <div>
                  <span className="text-2xl font-black text-primary font-mono">{totalCurrentStock.toLocaleString()} L</span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-50">
                     Active across {activeTanks.length} tanks (Capacity: {totalCapacity.toLocaleString()}L)
                  </p>
               </div>
            </div>

            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Days Remaining</span>
               <div>
                  <span className="text-2xl font-black text-on-surface font-mono">{diffDays} Days</span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-50">
                     Until target date: {targetDate}
                  </p>
               </div>
            </div>

            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Projected Stock Level</span>
               <div>
                  <span className={`text-2xl font-black font-mono ${projectedStockLevel < parsedReserve ? 'text-error' : 'text-success'}`}>
                     {projectedStockLevel.toLocaleString()} L
                  </span>
                  <div className="mt-1 flex items-center text-[9px] font-black uppercase tracking-widest">
                     {projectedStockLevel < parsedReserve ? (
                        <span className="text-error flex items-center gap-1">
                           <AlertTriangle className="w-3.5 h-3.5" /> Below Safe Buffer
                        </span>
                     ) : (
                        <span className="text-success flex items-center gap-1">
                           <CheckCircle className="w-3.5 h-3.5" /> Stock Intact
                        </span>
                     )}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col justify-between shadow-premium">
               <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Recommended Order</span>
               <div>
                  <span className={`text-2xl font-[900] font-mono ${recommendedOrder > 0 ? 'text-error shadow-glow' : 'text-success'}`}>
                     {recommendedOrder > 0 ? `${recommendedOrder.toLocaleString()} L` : '0 L (SECURE)'}
                  </span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-60">
                     {recommendedOrder > 0 ? 'Procurement recommended' : 'No re-order required'}
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* Key Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Depletion Zero-Point</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">NOV 24, 2026</p>
          <div className="mt-4 flex items-center text-[10px] font-black text-success uppercase tracking-widest">
             <div className="w-1.5 h-1.5 bg-success rounded-full mr-2"></div>
             +2 DAYS DRIFT POSITIVE
          </div>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-warning group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Re-Order Engagement</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">NOV 18, 2026</p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest">Current Burn Rate Sync</p>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-error group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Capacity Risk Factor</p>
          <p className="text-3xl font-[900] text-success tracking-tighter italic uppercase">NOMINAL</p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest font-mono">
             Jet A-1 Ullage: {(5000000 - (tanks.filter(t => t.type === FuelType.JET_A1).reduce((sum, t) => sum + (t.currentLevel || 0), 0))).toLocaleString()} L
          </p>
        </div>
      </div>
    </div>
  );
};