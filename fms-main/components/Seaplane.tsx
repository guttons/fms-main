
import React, { useState } from 'react';
import { Sailboat, MapPin, Droplet, Save, CheckCircle, AlertTriangle, Calendar, FileText } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';

interface SeaplaneProps {
    user?: any;
}

export const Seaplane: React.FC<SeaplaneProps> = ({ user }) => {
    const { flightLogs } = useOperationalData();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        operator: '',
        pumpId: '',
        date: new Date().toISOString().split('T')[0],
        deliveryNumber: '',
        volume: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setDuplicateError(null);

        // ── Duplicate delivery number check ──
        const fullDeliveryNumber = `MLE-${formData.deliveryNumber}`;
        const isDuplicate = flightLogs.some(
            (log) => log.deliveryNumber === fullDeliveryNumber
        );
        if (isDuplicate) {
            setDuplicateError(
                `Delivery ticket ${fullDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`
            );
            return;
        }

        setLoading(true);
        try {
            const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
            const logToSave = {
                flightNumber: `SEAPLANE-${formData.operator.toUpperCase()}`,
                aircraftReg: `PUMP-${formData.pumpId.toUpperCase()}`,
                aircraftType: 'DHC-6',
                stand: 'WATER DOCK',
                operatorId: user?.id || 'System Admin',
                vehicleId: formData.pumpId.toUpperCase(),
                status: 'COMPLETED' as const,
                logType: 'SEAPLANE' as const,
                deliveryNumber: formData.deliveryNumber ? `MLE-${formData.deliveryNumber}` : undefined,
                timestampStart: `${formData.date}T08:00:00.000Z`,
                timestampFinalEnd: `${formData.date}T16:00:00.000Z`,
                timestampClearance: new Date().toISOString(),
                meterOpen: 0,
                meterClose: parsedVolume,
                volume: parsedVolume,
                panelCheck: true,
                walkAroundCheck: true,
                appearanceCheck: true,
                waterCheck: true,
                remarks: `Seaplane Volume logged for ${formData.operator}`
            };

            await supabaseService.createFlightLog(logToSave);
            setLoading(false);
            setSuccess(true);
            setFormData({
                operator: '',
                pumpId: '',
                date: new Date().toISOString().split('T')[0],
                deliveryNumber: '',
                volume: ''
            });
        } catch (error) {
            console.error('Error logging seaplane volume:', error);
            setLoading(false);
            alert('Failed to log daily volume. Please try again.');
        }
    };

    if (success) {
        return (
             <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
                <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
                  <CheckCircle className="w-12 h-12 text-primary shadow-glow" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">LOG SYNCHRONIZED</h2>
                <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
                  Daily hydrant volume recorded and distributed to global inventory. Task integrity verified.
                </p>
                <button 
                  onClick={() => { setSuccess(false); }}
                  className="mt-12 px-10 py-4 kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
                >
                  NEW LOG ENTRY
                </button>
              </div>
        );
    }

    return (
        <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
                <div className="flex items-center">
                    <div className="p-4 lg:p-5 bg-primary/10 rounded-2xl lg:rounded-3xl mr-4 lg:mr-6 border border-primary/20 shadow-sm transition-all group-hover:shadow-glow">
                        <Sailboat className="w-8 h-8 lg:w-10 lg:h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
                            SEAPLANE <span className="text-primary italic font-medium ml-2 lg:ml-3">OPERATIONS</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                            <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono whitespace-nowrap">Registry: WATERBORNE OPS</span>
                            <div className="hidden lg:block h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                            <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em] whitespace-nowrap">Hydrant Volume Management</span>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8">
                {/* Standalone Delivery Ticket Card designed like IntoPlane */}
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

                <div className="card-premium p-6 lg:p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 mb-6 lg:mb-10">
                         {/* Operational Date Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Operational Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="date" 
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    onClick={(e) => {
                                        try {
                                            if ('showPicker' in HTMLInputElement.prototype) {
                                                (e.target as HTMLInputElement).showPicker();
                                            }
                                        } catch (err) {
                                            // Fallback for older browsers
                                        }
                                    }}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" 
                                />
                            </div>
                         </div>

                         {/* Operator Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Tactical Operator Identification</label>
                            <select 
                                name="operator"
                                value={formData.operator}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="">SELECT OPERATOR...</option>
                                <option value="TMA">TRANS MALDIVIAN (TMA)</option>
                                <option value="Manta">MANTA AIR</option>
                                <option value="Flyme">FLYME</option>
                            </select>
                         </div>

                         {/* Hydrant/Pump ID */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Infrastructure Registry (Pump ID)</label>
                            <input 
                                required 
                                type="text" 
                                name="pumpId"
                                value={formData.pumpId}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                placeholder="E.G. HP-01" 
                            />
                         </div>

                         {/* Fuel Type Readonly */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Resource Protocol</label>
                            <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center shadow-inner">
                                <Droplet className="w-4 h-4 mr-3 opacity-60" />
                                JET A-1
                            </div>
                         </div>
                    </div>
                </div>

                {/* Volume Input - Prominent */}
                <div className="mb-6 lg:mb-10 p-6 lg:p-10 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Sailboat className="w-16 lg:w-32 h-16 lg:h-32 text-on-surface" />
                    </div>
                    <label className="block text-[10px] font-bold text-on-surface uppercase mb-6 tracking-[0.3em] font-mono opacity-60 text-center">TOTAL DAILY FLOW COLLECTION (LITERS)</label>
                    <div className="relative w-full">
                        <input 
                            required 
                            type="text" 
                            name="volume"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-full text-4xl lg:text-6xl font-[900] p-6 lg:p-10 bg-surface-lowest border border-outline rounded-[32px] lg:rounded-[40px] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-primary tracking-tighter text-center transition-all font-mono shadow-premium"
                            placeholder="0" 
                            value={formData.volume && formData.volume !== '0' ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
                            onChange={(e) => {
                                const val = e.target.value.replace(/,/g, '');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setFormData(prev => ({ ...prev, volume: val }));
                                }
                            }}
                        />
                        <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30 tracking-[0.2em]">LTRS</span>
                    </div>
                    <div className="mt-8 flex items-center justify-center text-warning text-[10px] font-black uppercase tracking-widest space-x-3">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                        <span>Confirm meter integrity before sync submission</span>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={loading || formData.deliveryNumber.length !== 6}
                        className="w-full md:w-auto px-12 py-5 kinetic-gradient text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.4em] shadow-premium hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-20"
                    >
                        {loading ? 'SYNCHRONIZING...' : (
                            <>
                                <Save className="w-5 h-5 mr-4" />
                                FINAL SYNCHRONIZATION
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
