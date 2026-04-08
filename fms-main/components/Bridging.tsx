import React, { useState } from 'react';
import { FuelType, Tank, BridgingLog } from '../types';
import { Droplet, Truck, CheckCircle, AlertTriangle, Save, Clock, ArrowRight, History, FileText } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

interface BridgingProps {
  tanks: Tank[];
  onUpdateTank: (id: string, newLevel: number) => void;
}

export const Bridging: React.FC<BridgingProps> = ({ tanks, onUpdateTank }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<BridgingLog[]>([]);
  
  // Standardized Input Classes for High Contrast
  const inputClass = "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900 placeholder:text-slate-400";
  const labelClass = "block text-sm font-bold text-slate-800 mb-2";

  const [formData, setFormData] = useState({
    sourceTankId: '',
    vehicleId: '',
    volume: '',
    startTime: '',
    endTime: '',
    visualCheckPassed: false,
    cwdCheckPassed: false,
    density: '',
    temperature: '',
  });

  // Fetch logs from Firebase on mount
  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const fetchedLogs = await supabaseService.getBridgingLogs();
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('Error fetching bridging logs:', error);
      }
    };
    fetchLogs();
  }, []);

  const jetA1Tanks = tanks.filter(t => t.type === FuelType.JET_A1);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setFormData(prev => ({ ...prev, [field]: now }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        // Update Tank Level
        const tank = tanks.find(t => t.id === formData.sourceTankId);
        if (tank) {
            const transferVol = parseInt(formData.volume);
            if (!isNaN(transferVol)) {
                const newLevel = tank.currentLevel - transferVol;
                await onUpdateTank(tank.id, newLevel < 0 ? 0 : newLevel);
            }
        }
        
        const logToSave: Omit<BridgingLog, 'id'> = {
          sourceTankId: formData.sourceTankId,
          vehicleId: formData.vehicleId,
          volume: parseInt(formData.volume),
          startTime: formData.startTime,
          endTime: formData.endTime,
          visualCheckPassed: formData.visualCheckPassed,
          cwdCheckPassed: formData.cwdCheckPassed,
          operatorId: 'current_user', // In a real app, use the actual user ID
          density: formData.density ? parseFloat(formData.density) : undefined,
          temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        };

        await supabaseService.createBridgingLog(logToSave);
        
        setLoading(false);
        setSuccess(true);
        
        // Refresh logs
        const updatedLogs = await supabaseService.getBridgingLogs();
        setLogs(updatedLogs);

        // Reset form
        setTimeout(() => {
            setSuccess(false);
            setFormData({
                sourceTankId: '',
                vehicleId: '',
                volume: '',
                startTime: '',
                endTime: '',
                visualCheckPassed: false,
                cwdCheckPassed: false,
                density: '',
                temperature: '',
            });
        }, 3000);
    } catch (error) {
        console.error('Error saving bridging log to Firebase:', error);
        alert('Failed to save log to Firebase.');
        setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-300 bg-slate-50">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Loading Recorded</h2>
        <p className="text-slate-600 max-w-md">
          Refueler {formData.vehicleId} has been successfully loaded with {formData.volume}L. 
          Stock levels updated.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="mt-8 px-6 py-2 text-aviation-600 font-medium hover:bg-aviation-50 rounded-lg border border-aviation-200 bg-white"
        >
          Record New Transfer
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto text-slate-900">
      <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-aviation-900 flex items-center">
            <Truck className="w-6 h-6 mr-3 text-aviation-600" />
            Refueler Loading (Bridging)
          </h2>
          <p className="text-slate-500 mt-1">Record fuel transfer from Depot to Into-Plane Vehicles</p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100 flex items-center">
           <Droplet className="w-4 h-4 mr-2" />
           Jet A-1 Operations
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Input Form */}
        <div className="xl:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Source & Destination */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-gray-100">
                    Transfer Configuration
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}>Source Tank</label>
                        <select 
                        name="sourceTankId"
                        required
                        value={formData.sourceTankId}
                        onChange={handleInputChange}
                        className={inputClass}
                        >
                        <option value="">Select Tank...</option>
                        {jetA1Tanks.map(t => (
                            <option key={t.id} value={t.id}>{t.name} (Available: {t.currentLevel.toLocaleString()}L)</option>
                        ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Refueler Vehicle ID</label>
                        <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Truck className="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            name="vehicleId"
                            required
                            placeholder="e.g. R-045"
                            value={formData.vehicleId}
                            onChange={handleInputChange}
                            className={`${inputClass} pl-10`}
                        />
                        </div>
                    </div>
                    </div>
                    
                    <div className="mt-6 flex items-center justify-center text-slate-400">
                    <ArrowRight className="w-6 h-6 transform rotate-90 md:rotate-0" />
                    </div>

                    <div className="mt-2">
                        <label className={labelClass}>Volume Loaded (Liters)</label>
                        <div className="relative">
                        <input 
                            type="number" 
                            name="volume"
                            required
                            min="1"
                            placeholder="0"
                            value={formData.volume}
                            onChange={handleInputChange}
                            className={`${inputClass} text-3xl font-mono p-4 pl-4 pr-12`}
                        />
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-bold">L</span>
                        </div>
                    </div>
                </div>

                {/* Operations Timing & QC in a grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-gray-100">
                        Operations Timing
                        </h3>
                        <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Start Time</label>
                            <div className="flex">
                            <input 
                                type="time" 
                                name="startTime"
                                required
                                value={formData.startTime}
                                onChange={handleInputChange}
                                className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900"
                            />
                            <button 
                                type="button"
                                onClick={() => setNow('startTime')}
                                className="px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 text-slate-700"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">End Time</label>
                            <div className="flex">
                            <input 
                                type="time" 
                                name="endTime"
                                required
                                value={formData.endTime}
                                onChange={handleInputChange}
                                className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900"
                            />
                            <button 
                                type="button"
                                onClick={() => setNow('endTime')}
                                className="px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 text-slate-700"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-aviation-500">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-aviation-600" />
                        Quality Control
                        </h3>
                        
                        <div className="space-y-3">
                        <label className={`flex p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.visualCheckPassed ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-aviation-300 bg-white'}`}>
                            <input 
                                type="checkbox" 
                                name="visualCheckPassed"
                                checked={formData.visualCheckPassed}
                                onChange={handleInputChange}
                                className="w-5 h-5 mt-0.5 text-aviation-600 focus:ring-aviation-500 border-gray-300"
                            />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-slate-900">Visual Check</span>
                                <span className="block text-xs text-slate-500">Clear, Bright, No Particles</span>
                            </div>
                        </label>

                        <label className={`flex p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.cwdCheckPassed ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-aviation-300 bg-white'}`}>
                            <input 
                                type="checkbox" 
                                name="cwdCheckPassed"
                                checked={formData.cwdCheckPassed}
                                onChange={handleInputChange}
                                className="w-5 h-5 mt-0.5 text-aviation-600 focus:ring-aviation-500 border-gray-300"
                            />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-slate-900">CWD Check</span>
                                <span className="block text-xs text-slate-500">Chemical Water Detector OK</span>
                            </div>
                        </label>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-sm text-yellow-800 flex items-start">
                    <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p>Ensure vehicle bonding cable is connected before commencing transfer. Verify emergency stop functionality.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={loading || !formData.visualCheckPassed || !formData.cwdCheckPassed}
                    className="w-full py-4 bg-aviation-600 text-white rounded-xl font-bold text-lg hover:bg-aviation-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                    {loading ? 'Processing...' : (
                    <>
                        <Save className="w-5 h-5 mr-2" />
                        Submit Log
                    </>
                    )}
                </button>
            </form>
        </div>

        {/* Oversight / History Panel */}
        <div className="xl:col-span-1">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <History className="w-5 h-5 mr-2 text-aviation-600" />
                        Recent Transfers
                    </h3>
                    <span className="text-xs font-medium text-slate-500">Last 24 Hours</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No logs available</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {logs.map(log => {
                                const tank = tanks.find(t => t.id === log.sourceTankId);
                                return (
                                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-800">{log.vehicleId}</span>
                                            <span className="text-xs font-mono text-slate-500">{log.startTime} - {log.endTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600 flex items-center">
                                                <Droplet className="w-3 h-3 mr-1 text-aviation-400" />
                                                {log.volume.toLocaleString()} L
                                            </span>
                                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                                PASSED
                                            </span>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-400">
                                            Source: {tank?.name || 'Unknown'} | Op: {log.operatorId}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
                    <button className="text-sm font-bold text-aviation-600 hover:text-aviation-800 flex items-center justify-center w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        View Full Report
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};