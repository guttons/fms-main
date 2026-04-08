import React, { useState } from 'react';
import { FuelType, Tank } from '../types';
import { Database, AlertTriangle, Save, RefreshCw } from 'lucide-react';

interface StockProps {
  tanks: Tank[];
  onUpdateTank: (id: string, newLevel: number) => void;
}

export const Stock: React.FC<StockProps> = ({ tanks, onUpdateTank }) => {
  // Input styling for high contrast
  const inputClass = "w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900 text-right font-mono";
  
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
            onUpdateTank(id, numLevel);
            updatedCount++;
        }
    });
    
    if (updatedCount > 0) {
        alert(`Successfully updated inventory for ${updatedCount} tanks.`);
        setReadings({}); // Clear readings after save
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto text-slate-900">
       <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-aviation-900 flex items-center">
            <Database className="w-6 h-6 mr-3 text-aviation-600" />
            Depot Inventory
          </h2>
          <p className="text-slate-500 mt-1">Daily tank physical stock reconciliation</p>
        </div>
        <div className="flex items-center space-x-3">
             <span className="text-sm text-slate-500">Last Updated: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             <button className="p-2 hover:bg-gray-100 rounded-full border border-gray-200 bg-white">
                <RefreshCw className="w-4 h-4 text-slate-600" />
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tanks.map((tank) => {
             const isLow = tank.currentLevel < tank.safeMinLevel;
             const fillPct = (tank.currentLevel / tank.capacity) * 100;
             const typeColor = tank.type === FuelType.JET_A1 ? 'bg-aviation-600' : (tank.type === FuelType.DIESEL ? 'bg-yellow-600' : 'bg-orange-600');
             const typeBadge = tank.type === FuelType.JET_A1 ? 'bg-aviation-50 text-aviation-700' : (tank.type === FuelType.DIESEL ? 'bg-yellow-50 text-yellow-700' : 'bg-orange-50 text-orange-700');

             return (
                <div key={tank.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border border-gray-200 ${typeBadge}`}>
                            {tank.type}
                        </span>
                        {isLow && (
                            <div className="flex items-center text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                LOW LEVEL
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6">
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{tank.name}</h3>
                        <p className="text-xs text-slate-500 mb-4">Max Capacity: {tank.capacity.toLocaleString()} L</p>

                        <div className="flex items-end space-x-4 mb-6">
                            <div className="flex-1 h-32 bg-gray-100 rounded-lg relative overflow-hidden border border-gray-200">
                                <div 
                                    className={`absolute bottom-0 w-full transition-all duration-1000 ${typeColor}`}
                                    style={{ height: `${fillPct}%` }}
                                >
                                    <div className="absolute top-0 w-full h-1 bg-white/30"></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-3xl font-black text-slate-900">{tank.currentLevel.toLocaleString()}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Current Liters</span>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Dip Reading (L)</label>
                                <input 
                                    type="number" 
                                    className={inputClass}
                                    placeholder={tank.currentLevel.toString()}
                                    value={readings[tank.id] ?? ''}
                                    onChange={(e) => handleReadingChange(tank.id, e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temp (°C)</label>
                                    <input type="number" className={inputClass} placeholder="15.0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SG</label>
                                    <input type="number" className={inputClass} placeholder="0.8000" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             );
        })}
      </div>

      <div className="mt-8 flex justify-end">
          <button 
             onClick={handleSave}
             className="flex items-center px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg"
           >
              <Save className="w-5 h-5 mr-2" />
              Save Inventory
          </button>
      </div>
    </div>
  );
};