import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { FORECAST_DATA } from '../constants';
import { RefreshCw, Download, Layers } from 'lucide-react';

export const Forecasting: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('nominal');
  const activeScenario = FORECAST_DATA.find(s => s.id === activeScenarioId) || FORECAST_DATA[0];

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            STOCK <span className="text-primary italic font-medium ml-3">FORECAST</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: DEPOT LOGISTICS</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Predictive Depletion Modeling</span>
          </div>
        </div>
        <div className="flex space-x-4">
          <button className="flex items-center px-6 py-3 bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 transition-all text-on-surface-dim">
            <RefreshCw className="w-4 h-4 mr-3 text-primary opacity-60" />
            RECALCULATE
          </button>
          <button className="flex items-center px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all">
            <Download className="w-4 h-4 mr-3" />
            EXPORT DATA
          </button>
        </div>
      </div>

      {/* Scenario Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {FORECAST_DATA.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenarioId(scenario.id)}
            className={`card-premium p-8 text-left transition-all relative overflow-hidden group ${
              activeScenarioId === scenario.id 
                ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]' 
                : 'hover:border-primary/40'
            }`}
          >
            {activeScenarioId === scenario.id && (
               <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[40px] flex items-center justify-center border-l border-b border-primary/20">
                  <Layers className="w-5 h-5 text-primary" />
               </div>
            )}
            <div className="flex items-center space-x-4 mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border ${
                activeScenarioId === scenario.id 
                  ? 'bg-primary text-white border-primary shadow-sm' 
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
      <div className="card-premium p-10">
        <div className="flex items-center justify-between mb-10">
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
        <div className="h-[450px] w-full">
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

      {/* Key Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card-premium p-8 border-l-4 border-l-primary group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Depletion Zero-Point</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">NOV 24, 2026</p>
          <div className="mt-4 flex items-center text-[10px] font-black text-success uppercase tracking-widest">
             <div className="w-1.5 h-1.5 bg-success rounded-full mr-2 shadow-glow"></div>
             +2 DAYS DRIFT POSITIVE
          </div>
        </div>
        <div className="card-premium p-8 border-l-4 border-l-warning group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Re-Order Engagement</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">NOV 18, 2026</p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest">Current Burn Rate Sync</p>
        </div>
        <div className="card-premium p-8 border-l-4 border-l-error group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Capacity Risk Factor</p>
          <p className="text-3xl font-[900] text-success tracking-tighter italic uppercase">NOMINAL</p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest">Ullage Overhead: 2.1M L</p>
        </div>
      </div>
    </div>
  );
};