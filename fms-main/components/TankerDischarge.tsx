import React, { useState } from 'react';
import { Anchor, Droplet, FileText, CheckCircle, Scale, Thermometer, AlertOctagon, History } from 'lucide-react';

interface DischargeLog {
    id: string;
    vessel: string;
    bol: string;
    product: string;
    quantity: number;
    date: string;
    status: 'COMPLETED' | 'PENDING';
}

const MOCK_DISCHARGE_LOGS: DischargeLog[] = [
    { id: 'd1', vessel: 'MT Ocean Pride', bol: 'BOL-8821', product: 'Diesel', quantity: 1500, date: '2023-10-26', status: 'COMPLETED' },
    { id: 'd2', vessel: 'MT Nordic Spirit', bol: 'BOL-8825', product: 'Petrol', quantity: 2200, date: '2023-10-25', status: 'COMPLETED' },
];

export const TankerDischarge: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validated, setValidated] = useState(false);
  const [logs, setLogs] = useState<DischargeLog[]>(MOCK_DISCHARGE_LOGS);

  // High contrast standard inputs
  const inputClass = "w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900 placeholder:text-slate-400";
  const labelClass = "block text-sm font-bold text-slate-800 mb-2";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      // Add new log
      const form = e.target as HTMLFormElement;
      // In a real app we'd get these from form state, this is simplified for visual demo
      setLogs(prev => [{
          id: `d${Date.now()}`,
          vessel: 'Current Vessel',
          bol: 'New BOL',
          product: 'Diesel',
          quantity: 1000,
          date: new Date().toLocaleDateString(),
          status: 'COMPLETED'
      }, ...prev]);
    }, 1500);
  };

  const handleValidate = () => {
    // Simulate validation against calibration charts
    setValidated(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-300 bg-slate-50">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Anchor className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Discharge Recorded</h2>
        <p className="text-slate-600 max-w-md">
          Bulk import successfully logged. Stock levels for Main Tank Farm updated.
        </p>
        <button 
          onClick={() => { setSuccess(false); setValidated(false); }}
          className="mt-8 px-6 py-2 text-aviation-600 font-medium hover:bg-aviation-50 rounded-lg border border-aviation-200 bg-white"
        >
          Process Next Vessel
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto text-slate-900">
      <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-aviation-900 flex items-center">
            <Anchor className="w-6 h-6 mr-3 text-aviation-600" />
            Marine Tanker Discharge
          </h2>
          <p className="text-slate-500 mt-1">Record bulk fuel receipts from marine vessels</p>
        </div>
        <div className="flex space-x-2">
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold border border-yellow-200">Diesel</span>
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold border border-orange-200">Petrol</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vessel & Cargo Details */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-gray-100 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-slate-500" />
                            Bill of Lading Details
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Vessel Name</label>
                                <input type="text" className={inputClass} placeholder="e.g. MT Ocean Pride" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>BoL Number</label>
                                    <input type="text" className={inputClass} placeholder="BoL-8821" required />
                                </div>
                                <div>
                                    <label className={labelClass}>Product</label>
                                    <select className={inputClass} required>
                                        <option value="diesel">Diesel (Gasoil)</option>
                                        <option value="petrol">Petrol (Mogas)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>BoL Quantity (Metric Tonnes)</label>
                                <input type="number" className={inputClass} placeholder="0.000" step="0.001" required />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-gray-100 flex items-center">
                            <Scale className="w-5 h-5 mr-2 text-slate-500" />
                            Quality & Measurements
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Specific Gravity @ 15°C</label>
                                <input type="number" className={inputClass} placeholder="0.8400" step="0.0001" required />
                            </div>
                            <div>
                                <label className={labelClass}>Flash Point (°C)</label>
                                <input type="number" className={inputClass} placeholder="60.0" step="0.1" required />
                            </div>
                            <div>
                                <label className={labelClass}>Observed Temp (°C)</label>
                                <input type="number" className={inputClass} placeholder="28.5" step="0.1" required />
                            </div>
                            <div>
                                <label className={labelClass}>Water Content (ppm)</label>
                                <input type="number" className={inputClass} placeholder="0" required />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discharge Ops & Validation */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-gray-100">
                            Discharge Validation
                        </h3>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-slate-500">Receipt Tank</span>
                                <span className="font-bold text-slate-800">Diesel Storage A</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-slate-500">Available Ullage</span>
                                <span className="font-bold text-green-600">38,000 L</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: '24%' }}></div>
                            </div>
                        </div>

                        {!validated ? (
                            <div className="text-center py-6">
                                <AlertOctagon className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                                <p className="text-sm text-slate-600 mb-4">Validate figures against Vessel Calibration Charts before proceeding.</p>
                                <button 
                                    type="button" 
                                    onClick={handleValidate}
                                    className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900"
                                >
                                    Validate Calibration
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="flex items-center p-3 bg-green-50 text-green-800 rounded-lg border border-green-200">
                                    <CheckCircle className="w-5 h-5 mr-3" />
                                    <span className="font-medium">Calibration Validated</span>
                                </div>
                                
                                <div>
                                    <label className={labelClass}>Shore Tank Receipt Vol (Liters)</label>
                                    <input type="number" className={inputClass} placeholder="0" required />
                                </div>

                                <div className="pt-4">
                                    <button 
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-4 bg-aviation-600 text-white rounded-xl font-bold text-lg hover:bg-aviation-700 shadow-lg disabled:opacity-50"
                                    >
                                        {loading ? 'Processing...' : 'Confirm Discharge'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>
        
        {/* Oversight / History Panel */}
        <div className="xl:col-span-1">
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <History className="w-5 h-5 mr-2 text-aviation-600" />
                        Marine Oversight
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No discharge history found.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {logs.map(log => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-slate-800">{log.vessel}</span>
                                        <span className="text-xs font-mono text-slate-500">{log.date}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2">BOL: {log.bol}</div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className={`flex items-center font-medium ${log.product === 'Diesel' ? 'text-yellow-700' : 'text-orange-700'}`}>
                                            <Droplet className="w-3 h-3 mr-1" />
                                            {log.product}
                                        </span>
                                        <span className="text-slate-900 font-bold">
                                            {log.quantity.toLocaleString()} MT
                                        </span>
                                    </div>
                                    <div className="mt-2 text-right">
                                         <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                                                {log.status}
                                         </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
                    <button className="text-sm font-bold text-aviation-600 hover:text-aviation-800 flex items-center justify-center w-full">
                        <FileText className="w-4 h-4 mr-2" />
                        View All Records
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};