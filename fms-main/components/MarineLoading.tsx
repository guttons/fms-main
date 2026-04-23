import React, { useState, useEffect } from 'react';
import { Ship, Truck, CheckCircle, AlertTriangle, Save, Clock, ArrowRight, History, FileText, Anchor, Droplet } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { EquipmentType, UserRole, FuelType } from '../types';
import { useNotification } from '../context/NotificationContext';
import { supabaseService } from '../services/supabaseService';

interface MarineLoadingLog {
    id: string;
    refuellerId: string;
    vesselName: string;
    volume: number;
    meterOpen: number;
    meterClose: number;
    product: string;
    startTime: string;
    endTime: string;
    visualCheck: boolean;
    waterCheck: boolean;
    operatorId: string;
    timestamp: string;
}

const MOCK_MARINE_LOGS: MarineLoadingLog[] = [
    {
        id: 'ml1',
        refuellerId: 'RF-10',
        vesselName: 'MV Sea Breeze',
        volume: 12500,
        meterOpen: 100000,
        meterClose: 112500,
        product: 'Jet A-1',
        startTime: '10:30',
        endTime: '11:15',
        visualCheck: true,
        waterCheck: true,
        operatorId: 'u4',
        timestamp: '2023-10-27'
    },
    {
        id: 'ml2',
        refuellerId: 'RF-14',
        vesselName: 'MT Navigator',
        volume: 8000,
        meterOpen: 92000,
        meterClose: 100000,
        product: 'Jet A-1',
        startTime: '08:15',
        endTime: '08:45',
        visualCheck: true,
        waterCheck: true,
        operatorId: 'u4',
        timestamp: '2023-10-27'
    }
];

export const MarineLoading: React.FC = () => {
  const { equipment, createAlert } = useOperationalData();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<MarineLoadingLog[]>(MOCK_MARINE_LOGS);

  const [formData, setFormData] = useState({
    refuellerId: '',
    vesselName: '',
    meterOpen: '',
    meterClose: '',
    volume: '0',
    product: 'Jet A-1',
    startTime: '',
    endTime: '',
    visualCheck: false,
    waterCheck: false,
  });

  const refuellers = equipment.filter(e => e.type === EquipmentType.REFUELLER);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      // Auto-calculate volume if meters are provided
      if (name === 'meterOpen' || name === 'meterClose') {
        const open = parseFloat(name === 'meterOpen' ? value : updated.meterOpen);
        const close = parseFloat(name === 'meterClose' ? value : updated.meterClose);
        
        if (!isNaN(open) && !isNaN(close)) {
          updated.volume = (close - open).toString();
        }
      }

      return updated;
    });
  };

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setFormData(prev => ({ ...prev, [field]: now }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(async () => {
      const newLog: MarineLoadingLog = {
        id: `ml-${Date.now()}`,
        refuellerId: formData.refuellerId,
        vesselName: formData.vesselName,
        volume: parseInt(formData.volume),
        meterOpen: parseFloat(formData.meterOpen),
        meterClose: parseFloat(formData.meterClose),
        product: formData.product,
        startTime: formData.startTime,
        endTime: formData.endTime,
        visualCheck: formData.visualCheck,
        waterCheck: formData.waterCheck,
        operatorId: 'current_user',
        timestamp: new Date().toISOString().split('T')[0]
      };

      setLogs(prev => [newLog, ...prev]);
      
      // Create alert for record
      await createAlert({
        severity: 'low',
        message: `Marine loading completed: ${formData.vesselName} loaded with ${formData.volume}L from ${formData.refuellerId}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        acknowledged: false,
        targetRole: UserRole.DEPOT_MANAGER
      });

      setLoading(false);
      setSuccess(true);
      
      // Reset form after delay
      setTimeout(() => {
        setSuccess(false);
        setFormData({
          refuellerId: '',
          vesselName: '',
          meterOpen: '',
          meterClose: '',
          volume: '0',
          product: 'Jet A-1',
          startTime: '',
          endTime: '',
          visualCheck: false,
          waterCheck: false,
        });
      }, 3000);
    }, 1500);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
        <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
          <Ship className="w-12 h-12 text-primary shadow-glow" />
        </div>
        <h2 className="text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">LOADING COMPLETE</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Marine vessel {formData.vesselName} successfully loaded from unit {formData.refuellerId}. Logistics registry updated.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="mt-12 px-10 py-4 bg-primary text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
        >
          INITIATE NEW LOAD
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            MARINE <span className="text-primary italic font-medium ml-3">LOADING</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: ITP → VESSEL</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Direct Refueller Provisioning</span>
          </div>
        </div>
        <div className="px-6 py-3 bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface-dim flex items-center shadow-inner">
           <Ship className="w-4 h-4 mr-3 text-primary" />
           Vessel Support Operations
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Input Form */}
        <div className="xl:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-10">
                {/* Source & Destination */}
                <div className="card-premium p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                        <ArrowRight className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Asset Assignment
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Source Refueller</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                    <Truck className="h-4 w-4 text-primary opacity-40" />
                                </div>
                                <select 
                                    name="refuellerId"
                                    required
                                    value={formData.refuellerId}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                                >
                                    <option value="">SELECT RF UNIT...</option>
                                    {refuellers.map(rf => (
                                        <option key={rf.id} value={rf.id}>{rf.id} ({rf.currentVolume.toLocaleString()}L)</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Target Vessel Identity</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                    <Ship className="h-4 w-4 text-primary opacity-40" />
                                </div>
                                <input 
                                    type="text" 
                                    name="vesselName"
                                    required
                                    placeholder="E.G. MV SEA BREEZE"
                                    value={formData.vesselName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 p-6 bg-surface-dim/30 rounded-[32px] shadow-inner">
                        <div className="card-premium p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
                            <input 
                                type="number" 
                                name="meterOpen"
                                required
                                value={formData.meterOpen}
                                onChange={handleInputChange}
                                className="w-full text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                                placeholder="000000"
                            />
                        </div>

                        <div className="card-premium p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Closing Totalizer</label>
                            <input 
                                type="number" 
                                name="meterClose"
                                required
                                value={formData.meterClose}
                                onChange={handleInputChange}
                                className="w-full text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                                placeholder="000000"
                            />
                        </div>
                    </div>

                    <div className="mt-10">
                        <label className="block text-[10px] font-black text-on-surface uppercase mb-4 tracking-widest text-center">Transfer Volume (Liters)</label>
                        <div className="relative max-w-md mx-auto">
                            <input 
                                type="number" 
                                name="volume"
                                required
                                min="1"
                                placeholder="0"
                                value={formData.volume}
                                readOnly
                                className="w-full px-10 py-6 bg-surface-lowest border border-outline rounded-[32px] text-5xl font-[900] text-primary tracking-tighter text-center outline-none transition-all font-mono shadow-inner opacity-80"
                            />
                            <span className="absolute right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
                        </div>
                    </div>
                </div>

                {/* Operations Timing & QC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="card-premium p-8 border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Clock className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Chronology
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Load Commencement</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="time" 
                                        name="startTime"
                                        required
                                        value={formData.startTime}
                                        onChange={handleInputChange}
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('startTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover:bg-primary hover:text-white transition-all text-on-surface-dim group active:scale-95"
                                    >
                                        <Clock className="w-4 h-4 group-hover:animate-spin-slow" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Load Completion</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="time" 
                                        name="endTime"
                                        required
                                        value={formData.endTime}
                                        onChange={handleInputChange}
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('endTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover:bg-primary hover:text-white transition-all text-on-surface-dim group active:scale-95"
                                    >
                                        <Clock className="w-4 h-4 group-hover:animate-spin-slow" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-8 border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-3 text-primary" />
                            QC Protocol
                        </h3>
                        
                        <div className="space-y-4">
                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.visualCheck ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.visualCheck ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.visualCheck && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="visualCheck"
                                    checked={formData.visualCheck}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">Visual Analysis</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Free of Particulates / Clear & Bright</span>
                                </div>
                            </label>

                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.waterCheck ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.waterCheck ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.waterCheck && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="waterCheck"
                                    checked={formData.waterCheck}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">Water Verification</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Chemical Water Detector Negative</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bg-warning/10 p-6 rounded-3xl border border-warning/20 text-[10px] font-[900] uppercase tracking-widest text-warning flex items-start shadow-sm">
                    <AlertTriangle className="w-5 h-5 mr-4 flex-shrink-0 animate-pulse" />
                    <p className="leading-relaxed">Bonding cable must be connected to the vessel hull prior to loading. Maintain fire watch throughout operation.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={loading || !formData.visualCheck || !formData.waterCheck}
                    className="w-full py-6 bg-primary text-white rounded-[32px] font-[900] text-sm uppercase tracking-[0.4em] shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale flex items-center justify-center"
                >
                    {loading ? 'SYNCHRONIZING...' : (
                    <>
                        <Save className="w-5 h-5 mr-4" />
                        SUBMIT LOADING LOG
                    </>
                    )}
                </button>
            </form>
        </div>

        {/* Oversight / History Panel */}
        <div className="xl:col-span-1 h-full">
             <div className="card-premium h-full flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-outline bg-surface-dim/30 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                        <History className="w-4 h-4 mr-3 text-primary" />
                        Recent Provisioning
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {(logs || []).length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Syncing operational data...</div>
                    ) : (
                        <div className="divide-y divide-outline">
                            {(logs || []).map(log => {
                                return (
                                    <div key={log.id} className="p-8 hover:bg-primary/[0.02] transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-lg font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.vesselName}</span>
                                            <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">{log.startTime} - {log.endTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xl font-[900] text-on-surface tracking-tighter italic">
                                                {log.volume.toLocaleString()} <span className="text-[10px] opacity-20">L</span>
                                            </span>
                                            <span className="text-[9px] font-black px-4 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em]">
                                                {log.refuellerId}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                                            <span className="flex items-center">
                                                <Droplet className="w-3 h-3 mr-2" />
                                                {log.product}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-outline bg-surface-dim/30">
                    <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all w-full flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 mr-3" />
                        ACCESS LOG ARCHIVE
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};
