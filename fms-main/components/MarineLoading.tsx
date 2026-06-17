import React, { useState, useEffect } from 'react';
import { Ship, Truck, CheckCircle, AlertTriangle, Save, Clock, ArrowRight, History, FileText, Anchor, Droplet, Users, Calendar } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { EquipmentType, UserRole, FuelType, EquipmentStatus, User } from '../types';
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
    deliveryNumber?: string;
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
        timestamp: new Date().toISOString().split('T')[0],
        deliveryNumber: 'MLE-881202'
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
        timestamp: new Date().toISOString().split('T')[0],
        deliveryNumber: 'MLE-881203'
    }
];

interface MarineLoadingProps {
  user?: User | null;
}

export const MarineLoading: React.FC<MarineLoadingProps> = ({ user }) => {
  const { equipment, createAlert, alerts, flightLogs, staff } = useOperationalData();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [logs, setLogs] = useState<MarineLoadingLog[]>(MOCK_MARINE_LOGS);

  const isOperator = user?.role === UserRole.DEPOT_OPERATOR;

  // Extract staff roles for personnel dropdowns
  const activeOperators = (staff || []).filter(s => [UserRole.DEPOT_OPERATOR, UserRole.ITP_OPERATOR].includes(s.role));
  const activeOfficers = (staff || []).filter(s => [UserRole.DEPOT_MANAGER, UserRole.ITP_MANAGER, UserRole.ADMIN].includes(s.role));

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
    deliveryNumber: '',
    date: new Date().toISOString().split('T')[0],
    operatorName: '',
    supervisorName: ''
  });

  // Pre-enter opening totalizer based on Refueller's last completed log close reading
  useEffect(() => {
    if (formData.refuellerId) {
      const vehicleLogs = (flightLogs || []).filter(
        log => log.vehicleId === formData.refuellerId && log.status === 'COMPLETED'
      );
      const lastLog = [...vehicleLogs].sort((a, b) => {
         const timeA = a.timestampFinalEnd ? new Date(a.timestampFinalEnd).getTime() : 0;
         const timeB = b.timestampFinalEnd ? new Date(b.timestampFinalEnd).getTime() : 0;
         return timeB - timeA;
      })[0];
      
      const initialMeter = lastLog?.meterClose || 0;
      setFormData(prev => {
        const vol = parseFloat(prev.volume.toString().replace(/,/g, '')) || 0;
        return {
          ...prev,
          meterOpen: initialMeter.toString(),
          meterClose: (initialMeter + vol).toString()
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        meterOpen: '',
        meterClose: ''
      }));
    }
  }, [formData.refuellerId, flightLogs]);

  const availableRefuelers = (equipment || [])
    .filter(eq => eq.type === EquipmentType.REFUELLER && eq.status === EquipmentStatus.AVAILABLE);

  // Filter alerts for replenishment requests to highlight them
  const requestedRFs = Array.from(new Set(
    (alerts || [])
      .filter(a => a && !a.acknowledged && (
        a.message.toLowerCase().includes('request') && (
          a.message.toLowerCase().includes('replenish') || 
          a.message.toLowerCase().includes('refuel')
        )
      ))
      .map(a => {
        const match = a.message.match(/unit\s+(RF-\d+)/i);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(Boolean) as string[]
  ));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      // Auto-calculate closing totalizer if meterOpen or volume changes
      if (name === 'meterOpen' || name === 'volume') {
        const open = parseFloat(name === 'meterOpen' ? value.replace(/,/g, '') : updated.meterOpen.toString().replace(/,/g, '')) || 0;
        const vol = parseFloat(name === 'volume' ? value.replace(/,/g, '') : updated.volume.toString().replace(/,/g, '')) || 0;
        updated.meterClose = (open + vol).toString();
      }

      return updated;
    });
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
    setDuplicateError(null);

    // ── Duplicate delivery number check ──
    const fullDeliveryNumber = `MLE-${formData.deliveryNumber}`;
    const isDuplicateGlobal = (flightLogs || []).some(
        (log) => log && log.deliveryNumber === fullDeliveryNumber
    );
    const isDuplicateLocal = (logs || []).some(
        (log) => log && log.deliveryNumber === fullDeliveryNumber
    );

    if (isDuplicateGlobal || isDuplicateLocal) {
        setDuplicateError(
            `Delivery ticket ${fullDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`
        );
        notify(`Delivery ticket number ${fullDeliveryNumber} is already used. Please enter a unique ticket number.`, 'error');
        return;
    }

    setLoading(true);
    
    // Simulate API call and save to database
    setTimeout(async () => {
      const parsedVolume = parseInt(formData.volume.toString().replace(/,/g, '')) || 0;
      const parsedMeterOpen = parseFloat(formData.meterOpen.toString().replace(/,/g, '')) || 0;
      const parsedMeterClose = parseFloat(formData.meterClose.toString().replace(/,/g, '')) || 0;

      const newLog: MarineLoadingLog = {
        id: `ml-${Date.now()}`,
        refuellerId: formData.refuellerId,
        vesselName: formData.vesselName,
        volume: parsedVolume,
        meterOpen: parsedMeterOpen,
        meterClose: parsedMeterClose,
        product: formData.product,
        startTime: formData.startTime,
        endTime: formData.endTime,
        visualCheck: formData.visualCheck,
        waterCheck: formData.waterCheck,
        operatorId: formData.operatorName || user?.name || 'System Admin',
        timestamp: formData.date,
        deliveryNumber: formData.deliveryNumber ? `MLE-${formData.deliveryNumber}` : undefined,
      };

      try {
        // Save to global flight/operations log
        const logToSave = {
          flightNumber: `VESSEL-${formData.vesselName.toUpperCase()}`,
          aircraftReg: `VESSEL-${formData.vesselName.toUpperCase()}`,
          aircraftType: 'MARINE VESSEL',
          stand: 'MARINE JETTY',
          operatorId: formData.operatorName || 'System Admin',
          vehicleId: formData.refuellerId.toUpperCase(),
          status: 'COMPLETED' as const,
          logType: 'MARINE' as const,
          deliveryNumber: formData.deliveryNumber ? `MLE-${formData.deliveryNumber}` : undefined,
          timestampStart: `${formData.date}T${formData.startTime}:00.000Z`,
          timestampFinalEnd: `${formData.date}T${formData.endTime}:00.000Z`,
          timestampClearance: new Date().toISOString(),
          meterOpen: parsedMeterOpen,
          meterClose: parsedMeterClose,
          volume: parsedVolume,
          panelCheck: true,
          walkAroundCheck: true,
          appearanceCheck: formData.visualCheck,
          waterCheck: formData.waterCheck,
          remarks: `Marine Loading for ${formData.vesselName} (Supervised by ${formData.supervisorName})`
        };

        await supabaseService.createFlightLog(logToSave);
      } catch (dbError) {
        console.error('Error saving marine log to database:', dbError);
      }

      setLogs(prev => [newLog, ...prev]);
      
      // Create alert for record
      await createAlert({
        severity: 'low',
        message: `Marine loading completed: ${formData.vesselName} loaded with ${parsedVolume.toLocaleString()}L from ${formData.refuellerId}${formData.deliveryNumber ? ` (Ticket: MLE-${formData.deliveryNumber})` : ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
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
          deliveryNumber: '',
          date: new Date().toISOString().split('T')[0],
          operatorName: '',
          supervisorName: ''
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
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">LOADING COMPLETE</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Marine vessel {formData.vesselName} successfully loaded from unit {formData.refuellerId}. Logistics registry updated.
        </p>
        <button 
          onClick={() => { setSuccess(false); setDuplicateError(null); }}
          className="mt-12 px-10 py-4 bg-primary text-white font-black text-[11px] uppercase rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        {/* Input Form */}
        <div className="xl:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-10">
                {/* Delivery Ticket Entry Field */}
                <div className="card-premium p-6 lg:p-8 border-outline overflow-hidden">
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Delivery Ticket Number</label>
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                        <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">MLE-</span>
                        <input 
                            type="text" 
                            maxLength={6}
                            required
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={`flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 transition-all text-error placeholder:text-error/20 ${
                                duplicateError ? 'border-error' : 'border-outline focus:border-primary'
                            }`}
                            placeholder="000000"
                            value={formData.deliveryNumber}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                  setFormData(prev => ({ ...prev, deliveryNumber: val }));
                                if (duplicateError) setDuplicateError(null);
                            }}
                        />
                    </div>
                    {duplicateError && (
                        <div className="mt-4 flex items-start gap-3 p-3 bg-error/10 border border-error/30 rounded-xl">
                            <AlertTriangle className="w-4 h-4 text-error mt-0.5 shrink-0" />
                            <p className="text-[10px] font-black text-error uppercase tracking-widest leading-relaxed">{duplicateError}</p>
                        </div>
                    )}
                </div>

                {/* Source & Destination */}
                <div className="card-premium p-6 lg:p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                        <ArrowRight className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Asset Assignment
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
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
                                    {availableRefuelers.length === 0 ? (
                                        <option disabled>NO AVAILABLE REFUELERS</option>
                                    ) : (
                                        availableRefuelers.map(rf => (
                                            <option key={rf.id} value={rf.id}>
                                                {rf.id} (FUEL: {rf.currentVolume.toLocaleString()} / CAP: {rf.maxCapacity.toLocaleString()}L) {requestedRFs.includes(rf.id) ? '⚠ REPLENISH' : ''}
                                            </option>
                                        ))
                                    )}
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

                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Fuel Type / Product</label>
                            <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center shadow-inner h-[53px]">
                                <Droplet className="w-4 h-4 mr-3 opacity-60" />
                                JET A-1
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mt-6 lg:mt-10 p-4 lg:p-6 bg-surface-dim/30 rounded-[24px] lg:rounded-[32px] shadow-inner">
                        <div className="card-premium p-4 lg:p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
                            <input 
                                type="text" 
                                name="meterOpen"
                                required
                                inputMode="numeric"
                                value={formData.meterOpen ? parseInt(formData.meterOpen.toString().replace(/,/g, '')).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData(prev => {
                                            const updated = { ...prev, meterOpen: val };
                                            const open = parseFloat(val) || 0;
                                            const vol = parseFloat(prev.volume.toString().replace(/,/g, '')) || 0;
                                            updated.meterClose = (open + vol).toString();
                                            return updated;
                                        });
                                    }
                                }}
                                className="w-full text-2xl lg:text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                                placeholder="000,000"
                            />
                        </div>

                        <div className="card-premium p-4 lg:p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Calculated Closing Totalizer</label>
                            <input 
                                type="text" 
                                name="meterClose"
                                readOnly
                                inputMode="numeric"
                                value={formData.meterClose ? parseInt(formData.meterClose.toString().replace(/,/g, '')).toLocaleString() : '0'}
                                className="w-full text-2xl lg:text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline/30 text-on-surface-dim opacity-70 cursor-not-allowed"
                                placeholder="000,000"
                            />
                        </div>
                    </div>

                    <div className="mt-4 p-4 lg:p-8 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline">
                        <label className="block text-[10px] font-black text-on-surface uppercase mb-4 tracking-widest text-center opacity-60">Transfer Volume (Liters)</label>
                        <div className="relative w-full max-w-md mx-auto">
                            <input 
                                type="text" 
                                name="volume"
                                required
                                inputMode="numeric"
                                placeholder="0"
                                value={formData.volume && formData.volume !== '0' ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData(prev => {
                                            const updated = { ...prev, volume: val };
                                            const open = parseFloat(prev.meterOpen.toString().replace(/,/g, '')) || 0;
                                            const vol = parseFloat(val) || 0;
                                            updated.meterClose = (open + vol).toString();
                                            return updated;
                                        });
                                    }
                                }}
                                className="w-full px-6 lg:px-10 py-4 lg:py-6 bg-surface-lowest border border-outline/50 rounded-[24px] lg:rounded-[32px] text-3xl lg:text-5xl font-[900] text-primary tracking-tighter text-center outline-none transition-all font-mono shadow-inner focus:border-primary"
                            />
                            <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
                        </div>
                    </div>
                </div>

                {/* Personnel Selectors */}
                <div className="card-premium p-6 lg:p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                        <Users className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Personnel Involved
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Transfer Operator Name</label>
                            <select
                                name="operatorName"
                                required
                                value={formData.operatorName}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                            >
                                <option value="">SELECT OPERATOR...</option>
                                {(activeOperators.length > 0 ? activeOperators : staff).map(op => (
                                    <option key={op.id} value={op.name}>{op.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Verifying Officer Name</label>
                            <select
                                name="supervisorName"
                                required
                                value={formData.supervisorName}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                            >
                                <option value="">SELECT OFFICER...</option>
                                {(activeOfficers.length > 0 ? activeOfficers : staff).map(off => (
                                    <option key={off.id} value={off.name}>{off.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Operations Timing & QC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                    <div className="card-premium p-6 lg:p-8 border border-outline rounded-3xl border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Clock className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Chronology
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Operational Date</label>
                                <div className="relative">
                                    <input 
                                        required 
                                        type="date" 
                                        name="date"
                                        disabled={isOperator}
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        onClick={(e) => { try { if (!isOperator && 'showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                                        className={`w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all ${
                                          isOperator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                    />
                                    <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Load Commencement</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="time" 
                                        name="startTime"
                                        required
                                        value={formData.startTime}
                                        onChange={handleInputChange}
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('startTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover:bg-primary hover:text-white transition-all text-on-surface-dim active:scale-95"
                                    >
                                        <Clock className="w-4 h-4" />
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
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('endTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover:bg-primary hover:text-white transition-all text-on-surface-dim active:scale-95"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-8 border border-outline rounded-3xl border-l-4 border-l-primary">
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

                <div className="bg-warning/10 p-6 rounded-3xl border border-warning/20 text-[10px] font-[900] uppercase tracking-widest text-warning flex items-start">
                    <AlertTriangle className="w-5 h-5 mr-4 flex-shrink-0" />
                    <p className="leading-relaxed">Bonding protocol must be established before transfer. Confirm emergency stop accessibility and sector clear.</p>
                </div>

                <button 
                    type="submit" 
                    disabled={loading || !formData.visualCheck || !formData.waterCheck || formData.deliveryNumber.length !== 6}
                    className="w-full py-6 kinetic-gradient text-white rounded-[32px] font-[900] text-sm uppercase tracking-[0.4em] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale flex items-center justify-center shadow-premium"
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
                                                {(typeof log.volume === 'number' ? log.volume : parseInt(log.volume)).toLocaleString()} <span className="text-[10px] opacity-20">L</span>
                                            </span>
                                            <span className="text-[9px] font-black px-4 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em]">
                                                {log.refuellerId}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                                            <span className="flex items-center font-mono">
                                                <Droplet className="w-3 h-3 mr-2" />
                                                {log.product}
                                            </span>
                                            {log.deliveryNumber && (
                                                <span className="flex items-center text-primary tracking-widest font-mono">
                                                    <FileText className="w-3.5 h-3.5 mr-1" />
                                                    {log.deliveryNumber}
                                                </span>
                                            )}
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
