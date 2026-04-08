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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Jet A-1 Stock Forecast</h2>
          <p className="text-slate-500 text-sm mt-1">Real-time depletion modeling based on live flight schedules</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-slate-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculate
          </button>
          <button className="flex items-center px-4 py-2 bg-aviation-600 text-white rounded-lg text-sm font-medium hover:bg-aviation-700 shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Scenario Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FORECAST_DATA.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenarioId(scenario.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              activeScenarioId === scenario.id 
                ? 'border-aviation-500 bg-aviation-50 ring-1 ring-aviation-500' 
                : 'border-white bg-white hover:border-gray-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                activeScenarioId === scenario.id ? 'bg-aviation-200 text-aviation-800' : 'bg-gray-100 text-gray-500'
              }`}>
                {scenario.name}
              </span>
              <Layers className={`w-4 h-4 ${activeScenarioId === scenario.id ? 'text-aviation-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-sm text-slate-600">{scenario.description}</p>
          </button>
        ))}
      </div>

      {/* Main Forecast Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6">30-Day Depletion Curve</h3>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeScenario.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} 
                tick={{fontSize: 12, fill: '#64748b'}}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <Tooltip 
                 contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none' }}
                 itemStyle={{ color: '#fff' }}
                 formatter={(value: number) => [`${value.toLocaleString()} L`, 'Stock Level']}
              />
              {/* Critical Threshold Line */}
              <ReferenceLine y={1000000} label="Critical Level" stroke="#ef4444" strokeDasharray="3 3" />
              
              <Area 
                type="monotone" 
                dataKey="stockLevel" 
                stroke="#0ea5e9" 
                fillOpacity={1} 
                fill="url(#colorStock)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border-l-4 border-aviation-500 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Stock Lasts Until</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">Nov 24, 2026</p>
          <p className="text-xs text-green-600 mt-2 font-medium">+2 days vs. Last Year</p>
        </div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-yellow-500 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Re-Order Point</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">Nov 18, 2026</p>
          <p className="text-xs text-slate-400 mt-2">At current consumption rate</p>
        </div>
        <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Tank Ullage Risk</p>
          <p className="text-2xl font-bold text-green-600 mt-1">Safe</p>
          <p className="text-xs text-slate-400 mt-2">Shipment of 2M Liters fits comfortably</p>
        </div>
      </div>
    </div>
  );
};