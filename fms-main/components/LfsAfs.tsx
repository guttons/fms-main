import React, { useState } from 'react';
import { Fuel, MapPin, Droplet, Save, CheckCircle, AlertTriangle, Calendar, FileText, User as UserIcon, CreditCard, Truck, ClipboardList } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { User, UserRole } from '../types';

interface LfsAfsProps {
    user?: User | null;
}

export const LfsAfs: React.FC<LfsAfsProps> = ({ user }) => {
    const { flightLogs, tanks, updateTankLevel } = useOperationalData();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        station: 'LFS', // LFS or AFS
        fuelType: 'Diesel', // Diesel, Petrol, Lube Oil, Internal
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        vehicleReg: '',
        driverName: '', // Holds "On account of" value
        volume: '',
        paymentMode: 'Credit', // Credit or Cash
        receivedBy: '',
        equipmentName: ''
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
        const fullDeliveryNumber = `MLE-${formData.invoiceNumber}`;
        const isDuplicate = (flightLogs || []).some(
            (log) => log && log.deliveryNumber === fullDeliveryNumber
        );
        if (isDuplicate) {
            setDuplicateError(
                `Invoice ticket ${fullDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`
            );
            return;
        }

        setLoading(true);
        try {
            const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
            
            // ── Deduct fuel from the corresponding AFS / LFS tank if a matching tank exists ──
            const targetTankId = `${formData.station.toLowerCase()}-${formData.fuelType.toLowerCase()}`;
            const matchingTank = (tanks || []).find(t => t && t.id === targetTankId);
            
            if (matchingTank) {
                const newLevel = Math.max(0, matchingTank.currentLevel - parsedVolume);
                await updateTankLevel(matchingTank.id, newLevel);
            }

            const logToSave = {
                flightNumber: `GROUND-${formData.station}-${formData.fuelType.toUpperCase()}`,
                aircraftReg: formData.vehicleReg.toUpperCase(),
                aircraftType: 'GROUND VEHICLE',
                stand: formData.station === 'LFS' ? 'LANDSIDE STATION' : 'AIRSIDE STATION',
                operatorId: user?.id || 'System Admin',
                vehicleId: formData.vehicleReg.toUpperCase(),
                status: 'COMPLETED' as const,
                logType: 'FILLING_STATION' as const,
                deliveryNumber: formData.invoiceNumber ? `MLE-${formData.invoiceNumber}` : undefined,
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
                remarks: `Ground support refuel: ${formData.vehicleReg} loaded with ${parsedVolume}L ${formData.fuelType} (On account of: ${formData.driverName}, Payment: ${formData.paymentMode}, Received by: ${formData.receivedBy}, Equipment: ${formData.equipmentName})`
            };

            await supabaseService.createFlightLog(logToSave);
            setLoading(false);
            setSuccess(true);
            setFormData({
                station: 'LFS',
                fuelType: 'Diesel',
                date: new Date().toISOString().split('T')[0],
                invoiceNumber: '',
                vehicleReg: '',
                driverName: '',
                volume: '',
                paymentMode: 'Credit',
                receivedBy: '',
                equipmentName: ''
            });
        } catch (error) {
            console.error('Error logging ground refueling volume:', error);
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
                <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">INVOICE SYNCHRONIZED</h2>
                <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
                  Ground vehicle refueling invoice recorded. Station tank volumes and logistics databases updated in real-time.
                </p>
                <button 
                  onClick={() => { setSuccess(false); }}
                  className="mt-12 px-10 py-4 kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
                >
                  RECORD NEW INVOICE
                </button>
              </div>
        );
    }

    return (
        <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
            <div className="flex items-center justify-between border-b border-outline pb-6 lg:pb-10">
                <div className="flex items-center">
                    <div className="p-4 lg:p-5 bg-primary/10 rounded-2xl lg:rounded-3xl mr-4 lg:mr-6 border border-primary/20 shadow-sm transition-all">
                        <Fuel className="w-8 h-8 lg:w-10 lg:h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
                            LFS / AFS <span className="text-primary italic font-medium ml-2 lg:ml-3">INVOICES</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                            <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono whitespace-nowrap">Registry: GROUND STATIONS</span>
                            <div className="hidden lg:block h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                            <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em] whitespace-nowrap">AFS & LFS Sales Protocol</span>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8 max-w-4xl mx-auto">
                {/* Delivery Ticket / Invoice Number */}
                <div className="card-premium p-6 lg:p-8 border-outline overflow-hidden">
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Invoice / Ticket Number</label>
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
                            value={formData.invoiceNumber}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setFormData(prev => ({ ...prev, invoiceNumber: val }));
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
                         {/* Station Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Operational Station</label>
                            <select 
                                name="station"
                                value={formData.station}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="LFS">LANDSIDE FILLING STATION (LFS)</option>
                                <option value="AFS">AIRSIDE FILLING STATION (AFS)</option>
                            </select>
                         </div>

                         {/* Fuel Type / Product */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Resource / Fuel Type</label>
                            <select 
                                name="fuelType"
                                value={formData.fuelType}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="Diesel">DIESEL</option>
                                <option value="Petrol">PETROL</option>
                            </select>
                         </div>

                         {/* Billing Mode (Credit / Cash) */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Payment Mode</label>
                            <select 
                                name="paymentMode"
                                value={formData.paymentMode}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="Credit">CREDIT</option>
                                <option value="Cash">CASH</option>
                            </select>
                         </div>

                         {/* Date */}
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
                                    disabled={user?.role === UserRole.DEPOT_OPERATOR}
                                    onClick={(e) => {
                                        try {
                                            if (user?.role !== UserRole.DEPOT_OPERATOR && 'showPicker' in HTMLInputElement.prototype) {
                                                (e.target as HTMLInputElement).showPicker();
                                            }
                                        } catch (err) {}
                                    }}
                                    className={`w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all ${user?.role === UserRole.DEPOT_OPERATOR ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
                                />
                            </div>
                         </div>

                         {/* On account of */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">On account of</label>
                            <div className="relative">
                                <UserIcon className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="driverName"
                                    value={formData.driverName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                    placeholder="E.G. SKYWARD AVIATION" 
                                />
                            </div>
                         </div>

                         {/* Received by */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Received by</label>
                            <div className="relative">
                                <UserIcon className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="receivedBy"
                                    value={formData.receivedBy}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                    placeholder="E.G. IBRAHIM NAZEER" 
                                />
                            </div>
                         </div>

                         {/* Equipment Name */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Equipment Name</label>
                            <div className="relative">
                                <ClipboardList className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="equipmentName"
                                    value={formData.equipmentName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                    placeholder="E.G. GROUND POWER UNIT GPU-02" 
                                />
                            </div>
                         </div>

                         {/* Vehicle Registration */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Vehicle Registration / ID</label>
                            <div className="relative">
                                <MapPin className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="vehicleReg"
                                    value={formData.vehicleReg}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                    placeholder="E.G. BG-1A90" 
                                />
                            </div>
                         </div>
                    </div>

                    {/* Tank Status Quick Insight */}
                    {['Diesel', 'Petrol'].includes(formData.fuelType) && (
                         <div className="mt-6 border-t border-outline/30 pt-6">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Resource Insight</label>
                            {(() => {
                                const targetId = `${formData.station.toLowerCase()}-${formData.fuelType.toLowerCase()}`;
                                const tank = (tanks || []).find(t => t && t.id === targetId);
                                return (
                                    <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center justify-between shadow-inner">
                                        <div className="flex items-center">
                                            <Droplet className="w-4 h-4 mr-3 opacity-60 animate-pulse" />
                                            {tank ? tank.name : 'RESOURCE UNKNOWN'}
                                        </div>
                                        {tank && (
                                            <span className="font-mono text-xs opacity-75">{tank.currentLevel.toLocaleString()} L</span>
                                        )}
                                    </div>
                                );
                            })()}
                         </div>
                    )}
                </div>

                {/* Volume Input - Prominent */}
                <div className="mb-6 lg:mb-10 p-6 lg:p-10 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Fuel className="w-16 lg:w-32 h-16 lg:h-32 text-on-surface" />
                    </div>
                    <label className="block text-[10px] font-bold text-on-surface uppercase mb-6 tracking-[0.3em] font-mono opacity-60 text-center">Fuel Provision Volume (Liters)</label>
                    <div className="relative w-full">
                        <input 
                            required 
                            type="text" 
                            name="volume"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-full text-4xl lg:text-6xl font-[900] p-6 lg:p-10 bg-surface-lowest border border-outline rounded-[32px] lg:rounded-[40px] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-primary tracking-tighter text-center transition-all font-mono shadow-premium"
                            placeholder="0" 
                            value={formData.volume ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
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
                        <span>Ensure tank safety thresholds are respected upon delivery</span>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={loading || formData.invoiceNumber.length !== 6 || !formData.volume || formData.volume === '0'}
                        className="w-full md:w-auto px-12 py-5 kinetic-gradient text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.4em] shadow-premium hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-20"
                    >
                        {loading ? 'SYNCHRONIZING...' : (
                            <>
                                <Save className="w-5 h-5 mr-4" />
                                CONFIRM TRANSACTION INVOICE
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};
