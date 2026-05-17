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
  const inputClass = "w-full p-3 border border-outline rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-surface-dim text-on-surface placeholder:text-on-surface-dim/40 transition-colors";
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
      <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface-container-lowest">
        <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
          <Anchor className="w-12 h-12 text-primary shadow-glow" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">TASK COMPLETE</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Bulk import successfully logged to primary registry. Stock levels for Main Tank Farm synchronized.
        </p>
        <button 
          onClick={() => { setSuccess(false); setValidated(false); }}
          className="mt-12 px-10 py-4 kinetic-gradient font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
        >
          REFIRM DEPLOYMENT
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            MARINE <span className="text-primary italic font-medium ml-3">DISCHARGE</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: BULK RECEIPTS</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Readiness Control</span>
          </div>
        </div>
        <div className="flex space-x-3">
            <span className="px-4 py-1.5 bg-surface-container-low border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Diesel Gasoil</span>
            <span className="px-4 py-1.5 bg-surface-container-low border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Mogas Petrol</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-10">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Vessel & Cargo Details */}
                <div className="space-y-10">
                    <div className="card-premium p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <FileText className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Manifest Registry
                        </h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Tactical Vessel Identity</label>
                                <input type="text" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. MT OCEAN PRIDE" required />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">BoL Identity</label>
                                    <input type="text" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="BOL-8821" required />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Resource Type</label>
                                    <select className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none" required>
                                        <option value="diesel">DIESEL (GASOIL)</option>
                                        <option value="petrol">PETROL (MOGAS)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">BoL Quantity (MT)</label>
                                <input type="number" inputMode="decimal" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-right font-mono transition-all" placeholder="0.000" step="0.001" required />
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Scale className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Tactical QC Metrics
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">SG @ 15°C</label>
                                <input type="number" inputMode="decimal" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="0.8400" step="0.0001" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Flash Point (°C)</label>
                                <input type="number" inputMode="decimal" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="60.0" step="0.1" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Observed Temp (°C)</label>
                                <input type="number" inputMode="decimal" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="28.5" step="0.1" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">H2O Content (PPM)</label>
                                <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="0" required />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discharge Ops & Validation */}
                <div className="space-y-10">
                    <div className="card-premium p-8 h-full">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Discharge Validation
                        </h3>

                        <div className="bg-surface-container-low rounded-3xl border-transparent p-6 mb-8 shadow-inner">
                            <div className="flex justify-between items-center mb-4 text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                                <span>Receipt Destination</span>
                                <span className="text-primary">STORAGE SECTOR A</span>
                            </div>
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Available Ullage</span>
                                <span className="text-lg font-[900] text-success tracking-tighter">38,000 L</span>
                            </div>
                            <div className="w-full bg-surface-container-lowest-lowest rounded-full h-2 border-transparent overflow-hidden shadow-inner">
                                <div className="bg-success h-full transition-all duration-1000 shadow-glow" style={{ width: '24%' }}></div>
                            </div>
                        </div>

                        {!validated ? (
                            <div className="text-center py-10 space-y-6 alert-critical bg-error/5 rounded-2xl mx-2">
                                <AlertOctagon className="w-16 h-16 text-error mx-auto opacity-80 pulse-critical rounded-full" />
                                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed px-4">
                                    SYNCHRONIZE FIGURES AGAINST CALIBRATION CHARTS BEFORE PROCEEDING.
                                </p>
                                <button 
                                    type="button" 
                                    onClick={handleValidate}
                                    className="w-full py-5 kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-premium"
                                >
                                    ENGAGE VALIDATION
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center p-5 bg-success/10 text-success rounded-2xl border border-success/20 font-black text-[10px] uppercase tracking-widest">
                                    <CheckCircle className="w-5 h-5 mr-4" />
                                    <span>CALIBRATION DATA LOCKED</span>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Final Receipt Vol (L)</label>
                                    <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-xl font-[900] text-primary tracking-tighter outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-right font-mono" placeholder="0" required />
                                </div>

                                <div className="pt-6">
                                    <button 
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-5 kinetic-gradient rounded-2xl font-[900] text-[12px] uppercase tracking-[0.3em] shadow-premium hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'SYNCHRONIZING...' : 'INITIATE DISCHARGE'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>
        
        {/* Oversight / History Panel */}
        <div className="xl:col-span-1 h-full">
             <div className="card-premium h-full flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-outline bg-surface-container-low/30 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                        <History className="w-4 h-4 mr-3 text-primary" />
                        Marine Oversight
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Syncing historical logs...</div>
                    ) : (
                        <div className="divide-y divide-outline">
                            {logs.map(log => (
                                <div key={log.id} className="p-8 hover:bg-primary/[0.02] transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-lg font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.vessel}</span>
                                        <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">{log.date}</span>
                                    </div>
                                    <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-4">BoL: {log.bol}</div>
                                    <div className="flex justify-between items-center">
                                        <span className={`flex items-center text-[10px] font-black uppercase tracking-widest ${log.product === 'Diesel' ? 'text-warning' : 'text-primary'}`}>
                                            <Droplet className="w-3 h-3 mr-2" />
                                            {log.product}
                                        </span>
                                        <span className="text-xl font-[900] text-on-surface tracking-tighter italic">
                                            {log.quantity.toLocaleString()} <span className="text-[10px] opacity-20">MT</span>
                                        </span>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                         <span className="text-[9px] font-black px-4 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em] shadow-sm">
                                                {log.status}
                                         </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-outline bg-surface-container-low/30">
                    <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all w-full flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 mr-3" />
                        ACCESS TASK ARCHIVE
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

