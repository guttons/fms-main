import React, { useState, useEffect } from 'react';
import { FuelType, BridgingLog, UserRole, EquipmentType, EquipmentStatus } from '../types';
import { Droplet, Truck, CheckCircle, AlertTriangle, Save, Clock, ArrowRight, History, FileText } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useNotification } from '../context/NotificationContext';
import { useOperationalData } from '../context/OperationalDataContext';

export const Bridging: React.FC = () => {
  const { tanks, updateTankLevel, alerts, acknowledgeAlert, createAlert, equipment } = useOperationalData();
  const [logs, setLogs] = useState<BridgingLog[]>([]);
  const { notify } = useNotification();

  const availableRefuelers = (equipment || [])
    .filter(eq => eq.type === EquipmentType.REFUELLER && eq.status === EquipmentStatus.AVAILABLE);

  // Filter alerts for replenishment requests to highlight them
  const requestedRFs = Array.from(new Set(
    (alerts || [])
      .filter(a => a && !a.acknowledged && (
        a.message.toLowerCase().includes('replenishment requested') || 
        a.message.toLowerCase().includes('refuel requested')
      ))
      .map(a => {
        const match = a.message.match(/unit\s+(RF-\d+)/i);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(Boolean) as string[]
  ));

  const handleBridgingComplete = async (vehicleId: string) => {
    // Acknowledge the corresponding alert
    const relevantAlert = (alerts || []).find(a => a && !a.acknowledged && a.message.includes(`unit ${vehicleId}`));
    if (relevantAlert) {
      await acknowledgeAlert(relevantAlert.id);
    }
  };



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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch logs from Firebase on mount
  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const fetchedLogs = await supabaseService.getBridgingLogs();
        setLogs(fetchedLogs || []);
      } catch (error) {
        console.error('Error fetching bridging logs:', error);
      }
    };
    fetchLogs();
  }, []);

  const jetA1Tanks = (tanks || []).filter(t => t && t.type === FuelType.JET_A1);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, [field]: timeStr }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        // Update Tank Level
        const tank = (tanks || []).find(t => t && t.id === formData.sourceTankId);
        if (tank) {
            const transferVol = parseInt(formData.volume);
            if (!isNaN(transferVol)) {
                const newLevel = tank.currentLevel - transferVol;
                await updateTankLevel(tank.id, newLevel < 0 ? 0 : newLevel);
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
        
        // Acknowledge the alert
        await handleBridgingComplete(formData.vehicleId);

        // Notify ITP Duty Manager of replenishment completion
        await createAlert({
          severity: 'low',
          message: `Refueller ${formData.vehicleId} replenished with ${formData.volume}L`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          acknowledged: false,
          targetRole: UserRole.ITP_MANAGER
        });
        
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
        notify('Failed to save log to Firebase.', 'error');
        setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
        <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
          <Truck className="w-12 h-12 text-primary shadow-glow" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">TRANSFER LOGGED</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Refueler {formData.vehicleId} loaded with {formData.volume}L. Inventory databases synchronized across all sectors.
        </p>
        <button 
          onClick={() => setSuccess(false)}
          className="mt-12 px-10 py-4 bg-primary text-white font-black text-[11px] uppercase rounded-2xl transition-all"
        >
          INITIATE NEW LOAD
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-10 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            REFUELER <span className="text-primary italic font-medium ml-3">LOADING</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: DEPOT → ITP</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Jet A-1 Bridging Protocol</span>
          </div>
        </div>
        <div className="px-6 py-3 bg-surface-container-low p-1.5 rounded-[22px] border-transparent flex relative w-full max-w-[320px] text-on-surface-dim items-center">
           <Droplet className="w-4 h-4 mr-3 text-primary" />
           RESOURCE: JET A-1
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        {/* Input Form */}
        <div className="xl:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-10">
                {/* Source & Destination */}
                <div className="card-premium p-6 lg:p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                        <ArrowRight className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Transfer Mapping
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Source Asset</label>
                        <select 
                            name="sourceTankId"
                            required
                            value={formData.sourceTankId}
                            onChange={handleInputChange}
                            className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                        >
                            <option value="">SELECT TANK...</option>
                            {jetA1Tanks.map(t => (
                                <option key={t.id} value={t.id}>{t.name} (AVAIL: {t.currentLevel.toLocaleString()}L)</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Target Vehicle (Refueler)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                <Truck className="h-4 w-4 text-primary opacity-40" />
                            </div>
                            <select 
                                name="vehicleId"
                                required
                                value={formData.vehicleId}
                                onChange={handleInputChange}
                                className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                            >
                                <option value="">SELECT RF UNIT...</option>
                                {availableRefuelers.length === 0 ? (
                                    <option disabled>NO AVAILABLE REFUELERS</option>
                                ) : (
                                    availableRefuelers.map(rf => (
                                        <option key={rf.id} value={rf.id}>
                                            {rf.id} ({rf.currentVolume.toLocaleString()} / {rf.maxCapacity.toLocaleString()}L) {requestedRFs.includes(rf.id) ? '⚠ REPLENISH' : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>
                    </div>
                    
                    <div className="mt-8 flex items-center justify-center text-on-surface-dim opacity-20">
                        <ArrowRight className="w-8 h-8 transform rotate-90 md:rotate-0" />
                    </div>

                    <div className="mt-4 p-4 lg:p-8 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline">
                        <label className="block text-[10px] font-black text-on-surface uppercase mb-4 tracking-widest text-center opacity-60">Fuel Volume Provision (L)</label>
                        <div className="relative w-full max-w-md mx-auto">
                            <input 
                                type="text" 
                                name="volume"
                                required
                                placeholder="0,000"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.volume ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData(prev => ({ ...prev, volume: val }));
                                    }
                                }}
                                className="w-full px-6 lg:px-10 py-4 lg:py-6 bg-surface-lowest border border-outline/50 rounded-[24px] lg:rounded-[32px] text-3xl lg:text-5xl font-[900] text-primary tracking-tighter text-center outline-none focus:border-primary transition-all font-mono"
                            />
                            <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
                        </div>
                    </div>
                </div>

                {/* Operations Timing & QC in a grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                    <div className="card-premium p-6 lg:p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Clock className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Chronology
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Commencement</label>
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
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Completion</label>
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
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-8 border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-3 text-primary" />
                            Quality Assurance
                        </h3>
                        
                        <div className="space-y-4">
                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.visualCheckPassed ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.visualCheckPassed ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.visualCheckPassed && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="visualCheckPassed"
                                    checked={formData.visualCheckPassed}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">Visual Clearance</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Clear, Bright, No Particulates</span>
                                </div>
                            </label>

                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.cwdCheckPassed ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.cwdCheckPassed ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.cwdCheckPassed && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="cwdCheckPassed"
                                    checked={formData.cwdCheckPassed}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">CWD Verification</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Chemical Water Detector OK</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bg-warning/10 p-6 rounded-3xl border border-warning/20 text-[10px] font-[900] uppercase tracking-widest text-warning flex items-start">
                    <AlertTriangle className="w-5 h-5 mr-4 flex-shrink-0" />
                    <p className="leading-relaxed">Bonding protocol must be established before transfer. Confirm emergency stop accessibility and sector clear.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={loading || !formData.visualCheckPassed || !formData.cwdCheckPassed}
                    className="w-full py-6 bg-primary text-white rounded-[32px] font-[900] text-sm uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale flex items-center justify-center"
                >
                    {loading ? 'SYNCHRONIZING...' : (
                    <>
                        <Save className="w-5 h-5 mr-4" />
                        SUBMIT COMMAND LOG
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
                        Transfer Logs
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {(logs || []).length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Retrieving shift data...</div>
                    ) : (
                        <div className="divide-y divide-outline">
                            {(logs || []).map(log => {
                                const tank = (tanks || []).find(t => t && t.id === log.sourceTankId);
                                return (
                                    <div key={log.id} className="p-8 hover:bg-primary/[0.02] transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-lg font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.vehicleId}</span>
                                            <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">{log.startTime} - {log.endTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xl font-[900] text-on-surface tracking-tighter italic">
                                                {(typeof log.volume === 'number' ? log.volume : parseInt(log.volume)).toLocaleString()} <span className="text-[10px] opacity-20">L</span>
                                            </span>
                                            <span className="text-[9px] font-black px-4 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em]">
                                                PASSED
                                            </span>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                                            <span>SRC: {tank?.name || '---'}</span>
                                            <span>OP: {log.operatorId}</span>
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
                        ACCESS ARCHIVE
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};