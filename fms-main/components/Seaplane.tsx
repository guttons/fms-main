
import React, { useState } from 'react';
import { Sailboat, MapPin, Droplet, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export const Seaplane: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);



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
             <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
                <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
                  <CheckCircle className="w-12 h-12 text-primary shadow-glow" />
                </div>
                <h2 className="text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">LOG SYNCHRONIZED</h2>
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
        <div className="p-6 lg:p-10 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
                <div className="flex items-center">
                    <div className="p-5 bg-primary/10 rounded-3xl mr-6 border border-primary/20 shadow-sm transition-all group-hover:shadow-glow">
                        <Sailboat className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
                            SEAPLANE <span className="text-primary italic font-medium ml-3">OPERATIONS</span>
                        </h1>
                        <div className="flex items-center space-x-3">
                            <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: WATERBORNE OPS</span>
                            <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Hydrant Volume Management</span>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card-premium p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                     {/* Operator Selection */}
                     <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Tactical Operator Identification</label>
                        <select className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none" required>
                            <option value="">SELECT OPERATOR...</option>
                            <option value="TMA">TRANS MALDIVIAN (TMA)</option>
                            <option value="Manta">MANTA AIR</option>
                            <option value="Flyme">FLYME</option>
                        </select>
                     </div>

                     {/* Dock Location */}
                     <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Deployment Coordinates (Dock)</label>
                        <div className="relative">
                            <MapPin className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                            <select className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none" required>
                                <option value="">SELECT DOCK...</option>
                                <option>TERMINAL A - DOCK 1</option>
                                <option>TERMINAL A - DOCK 2</option>
                                <option>TERMINAL B - DOCK 1</option>
                                <option>TERMINAL B - DOCK 2</option>
                                <option>FLOATING DOCK C</option>
                            </select>
                        </div>
                    </div>

                    {/* Hydrant/Pump ID */}
                    <div>
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Infrastructure Registry (Pump ID)</label>
                         <input required type="text" className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. HP-01" />
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

                {/* Volume Input - Prominent */}
                <div className="mb-10 p-10 bg-surface-dim/30 rounded-[40px] border border-outline shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Sailboat className="w-32 h-32 text-on-surface" />
                    </div>
                    <label className="block text-[10px] font-bold text-on-surface uppercase mb-6 tracking-[0.3em] font-mono opacity-60 text-center">TOTAL DAILY FLOW COLLECTION (LITERS)</label>
                    <div className="relative max-w-lg mx-auto">
                        <input 
                            required 
                            type="number" 
                            min="1"
                            className="w-full text-6xl font-[900] p-10 bg-surface-lowest border border-outline rounded-[40px] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-primary tracking-tighter text-center transition-all font-mono shadow-premium"
                            placeholder="0" 
                        />
                        <span className="absolute right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30 tracking-[0.2em]">LTRS</span>
                    </div>
                    <div className="mt-8 flex items-center justify-center text-warning text-[10px] font-black uppercase tracking-widest space-x-3">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                        <span>Confirm meter integrity before sync submission</span>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        type="submit" 
                        disabled={loading}
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
