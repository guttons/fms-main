
import React, { useState } from 'react';
import { Sailboat, MapPin, Droplet, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export const Seaplane: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // High contrast inputs for better visibility on tablets
    const inputClass = "w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aviation-500 focus:border-aviation-500 bg-white text-slate-900 placeholder:text-slate-400 font-medium text-lg transition-shadow";
    const labelClass = "block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            setSuccess(true);
        }, 1500);
    };

    if (success) {
        return (
             <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in duration-300 bg-slate-50 min-h-[600px]">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Daily Log Submitted</h2>
                <p className="text-slate-600 max-w-md text-lg">
                  Hydrant volume for the operator has been successfully recorded and synced to the central inventory.
                </p>
                <button 
                  onClick={() => { setSuccess(false); }}
                  className="mt-8 px-8 py-3 text-aviation-600 font-bold hover:bg-aviation-50 rounded-lg border-2 border-aviation-200 bg-white shadow-sm transition-colors text-lg"
                >
                  Submit Another Log
                </button>
              </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
            <div className="flex items-center mb-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 bg-blue-50 rounded-full mr-5 border border-blue-100">
                    <Sailboat className="w-10 h-10 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Seaplane Daily Operations</h2>
                    <p className="text-slate-500 text-lg">End-of-day Hydrant Volume Recording</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                     {/* Operator Selection */}
                     <div>
                        <label className={labelClass}>Seaplane Operator</label>
                        <select className={inputClass} required>
                            <option value="">Select Operator...</option>
                            <option value="TMA">Trans Maldivian (TMA)</option>
                            <option value="Manta">Manta Air</option>
                            <option value="Flyme">Flyme</option>
                        </select>
                     </div>

                     {/* Dock Location */}
                     <div>
                        <label className={labelClass}>Dock Location</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-4 w-6 h-6 text-gray-400" />
                            <select className={`${inputClass} pl-12`} required>
                                <option value="">Select Dock...</option>
                                <option>Terminal A - Dock 1</option>
                                <option>Terminal A - Dock 2</option>
                                <option>Terminal B - Dock 1</option>
                                <option>Terminal B - Dock 2</option>
                                <option>Floating Dock C</option>
                            </select>
                        </div>
                    </div>

                    {/* Hydrant/Pump ID */}
                    <div>
                        <label className={labelClass}>Hydrant / Pump ID</label>
                         <input required type="text" className={inputClass} placeholder="e.g. HP-01" />
                    </div>

                    {/* Fuel Type Readonly */}
                     <div>
                        <label className={labelClass}>Product</label>
                        <div className="w-full p-4 bg-slate-50 border border-gray-200 rounded-lg text-slate-700 font-bold flex items-center text-lg h-[62px]">
                            <Droplet className="w-6 h-6 mr-3 text-aviation-600" />
                            Jet A-1
                        </div>
                     </div>
                </div>

                {/* Volume Input - Prominent */}
                <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <label className={labelClass}>Total Daily Volume (Liters)</label>
                    <div className="relative">
                        <input 
                            required 
                            type="number" 
                            min="1"
                            className="w-full text-5xl font-black p-6 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-aviation-500/20 focus:border-aviation-500 bg-white text-slate-900 placeholder:text-slate-300 text-right pr-28 transition-all" 
                            placeholder="0" 
                        />
                        <span className="absolute right-8 top-1/2 transform -translate-y-1/2 text-2xl font-bold text-slate-400">LITERS</span>
                    </div>
                    <p className="text-slate-500 text-sm mt-3 flex items-center font-medium">
                        <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                        Please verify the closing meter reading matches the entered volume before submission.
                    </p>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full md:w-auto px-10 py-4 bg-aviation-600 text-white rounded-xl font-bold text-xl hover:bg-aviation-700 shadow-lg flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <Save className="w-6 h-6 mr-3" />
                                Submit Daily Log
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
