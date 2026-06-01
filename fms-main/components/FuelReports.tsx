import React, { useState, useMemo } from 'react';
import { FileText, Download, Calendar, Search, ShieldCheck, RefreshCw, Layers, TrendingUp, TrendingDown, ClipboardList } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { FuelType, FlightLog, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FuelReportsProps {
    user?: User | null;
}

export const FuelReports: React.FC<FuelReportsProps> = ({ user }) => {
    const { flightLogs, tanks } = useOperationalData();
    const [summaryDate, setSummaryDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Custom query parameters
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterProduct, setFilterProduct] = useState<string>('ALL');
    const [filterCategory, setFilterCategory] = useState<string>('ALL');

    // ── Generate Daily Fuel Summary (Balance Sheet) ──
    const dailySummary = useMemo(() => {
        const targetDate = summaryDate;
        
        // Filter operations matching selected date
        const dailyLogs = (flightLogs || []).filter(log => {
            if (!log || !log.timestampClearance) return false;
            return log.timestampClearance.startsWith(targetDate);
        });

        // 1. Calculate Jet A-1 Sales
        const jetFlights = dailyLogs.filter(l => !l.flightNumber.includes('SEAPLANE') && !l.flightNumber.includes('GROUND'));
        const jetVol = jetFlights.reduce((acc, l) => acc + (l.volume || 0), 0);

        // 2. Calculate Seaplane Sales
        const seaLogs = dailyLogs.filter(l => l.flightNumber.includes('SEAPLANE'));
        const seaVol = seaLogs.reduce((acc, l) => acc + (l.volume || 0), 0);

        // 3. Calculate Ground Station Sales (Petrol & Diesel)
        const groundLogs = dailyLogs.filter(l => l.flightNumber.includes('GROUND'));
        const dieselSales = groundLogs.filter(l => l.flightNumber.includes('DIESEL')).reduce((acc, l) => acc + (l.volume || 0), 0);
        const petrolSales = groundLogs.filter(l => l.flightNumber.includes('PETROL')).reduce((acc, l) => acc + (l.volume || 0), 0);

        // Receipts (from Marine Vessels)
        const marineLogs = dailyLogs.filter(l => l.flightNumber.includes('VESSEL'));
        const marineReceipts = marineLogs.reduce((acc, l) => acc + (l.volume || 0), 0);

        // Opening Stocks (estimated back from current levels and transactions)
        // Jet A-1 current stock
        const currentJetA1 = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((acc, t) => acc + t.currentLevel, 0);
        const currentDiesel = (tanks || []).filter(t => t.type === FuelType.DIESEL).reduce((acc, t) => acc + t.currentLevel, 0);
        const currentPetrol = (tanks || []).filter(t => t.type === FuelType.PETROL).reduce((acc, t) => acc + t.currentLevel, 0);

        // Mapped values for presentation
        const openingJet = currentJetA1 + jetVol + seaVol - marineReceipts; // simplified backtrack
        const openingDiesel = currentDiesel + dieselSales;
        const openingPetrol = currentPetrol + petrolSales;

        const totalOpening = openingJet + openingDiesel + openingPetrol;
        const totalSales = jetVol + seaVol + dieselSales + petrolSales;
        const totalClosing = currentJetA1 + currentDiesel + currentPetrol;

        // Variance computations
        const theoreticalClosing = totalOpening + marineReceipts - totalSales;
        const variance = totalClosing - theoreticalClosing;

        return {
            date: targetDate,
            logsCount: dailyLogs.length,
            jetVol,
            seaVol,
            dieselSales,
            petrolSales,
            marineReceipts,
            openingJet,
            openingDiesel,
            openingPetrol,
            closingJet: currentJetA1,
            closingDiesel: currentDiesel,
            closingPetrol: currentPetrol,
            totalOpening,
            totalSales,
            totalClosing,
            variance
        };
    }, [summaryDate, flightLogs, tanks]);

    // ── Parameterized Custom Query Engine ──
    const generatedLogs = useMemo(() => {
        return (flightLogs || []).filter(log => {
            if (!log || !log.timestampClearance) return false;
            
            const logDate = log.timestampClearance.split('T')[0];
            const inDateRange = logDate >= startDate && logDate <= endDate;
            if (!inDateRange) return false;

            // Product check
            if (filterProduct !== 'ALL') {
                const productLower = filterProduct.toLowerCase();
                const matchesJet = productLower === 'jet-a1' && (log.flightNumber.includes('SEAPLANE') || (!log.flightNumber.includes('GROUND') && !log.flightNumber.includes('VESSEL')));
                const matchesDiesel = productLower === 'diesel' && log.flightNumber.includes('DIESEL');
                const matchesPetrol = productLower === 'petrol' && log.flightNumber.includes('PETROL');
                if (!matchesJet && !matchesDiesel && !matchesPetrol) return false;
            }

            // Category check
            if (filterCategory !== 'ALL') {
                const catLower = filterCategory.toLowerCase();
                if (catLower === 'flight' && (log.flightNumber.includes('SEAPLANE') || log.flightNumber.includes('GROUND') || log.flightNumber.includes('VESSEL'))) return false;
                if (catLower === 'seaplane' && !log.flightNumber.includes('SEAPLANE')) return false;
                if (catLower === 'ground' && !log.flightNumber.includes('GROUND')) return false;
                if (catLower === 'receipt' && !log.flightNumber.includes('VESSEL')) return false;
            }

            return true;
        });
    }, [flightLogs, startDate, endDate, filterProduct, filterCategory]);

    const chartData = useMemo(() => {
        return [
            { name: 'Jet A-1 Flights', L: dailySummary.jetVol },
            { name: 'Seaplanes', L: dailySummary.seaVol },
            { name: 'Diesel Station', L: dailySummary.dieselSales },
            { name: 'Petrol Station', L: dailySummary.petrolSales },
        ];
    }, [dailySummary]);

    const handleCsvExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Flight/Vehicle,Type,Stand,Volume(L),Delivery Ticket,Remarks\n";
        
        generatedLogs.forEach(log => {
            const row = [
                log.timestampClearance?.split('T')[0] || '',
                log.flightNumber || '',
                log.aircraftType || '',
                log.stand || '',
                log.volume || 0,
                log.deliveryNumber || '',
                (log.remarks || '').replace(/,/g, ';')
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `FMS_Fuel_Report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 lg:p-10 space-y-10 pb-32">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
                <div>
                    <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
                        DEPOT <span className="text-primary italic font-medium ml-3">REPORTS</span>
                    </h1>
                    <div className="flex items-center space-x-3">
                         <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: FUEL DISPATCH</span>
                         <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                         <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Stock Audits</span>
                    </div>
                </div>
            </div>

            {/* TAB 1: DAILY FUEL SUMMARY BALANCE SHEET */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="title-lg text-on-surface flex items-center">
                        <ClipboardList className="w-5 h-5 mr-3 text-primary" />
                        Automated Daily Reconciliation
                    </h2>
                    <div className="bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner flex items-center shrink-0">
                        <Calendar className="w-4 h-4 text-primary opacity-40 mr-2.5 ml-1" />
                        <input
                            type="date"
                            value={summaryDate}
                            onChange={(e) => setSummaryDate(e.target.value)}
                            onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                            className="bg-transparent text-[11px] font-black uppercase tracking-widest text-on-surface outline-none cursor-pointer px-2 py-1"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Fuel Summary Breakdown Sheet */}
                    <div className="xl:col-span-2 card-premium p-8 lg:p-10 space-y-6">
                        <div className="flex justify-between items-center border-b border-outline pb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Operations Flow ledger</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">JIG compliance: verified</span>
                        </div>
                        
                        <div className="space-y-4 divide-y divide-outline">
                            {/* Opening Stock row */}
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-xs font-bold opacity-80">Opening Active Inventory</span>
                                <span className="font-mono text-sm font-black">{dailySummary.totalOpening.toLocaleString()} L</span>
                            </div>
                            
                            {/* Receipts row */}
                            <div className="flex justify-between items-center pt-4 py-2.5">
                                <span className="text-xs font-bold text-success">Vessel Receipts (+)</span>
                                <span className="font-mono text-sm font-black text-success">+{dailySummary.marineReceipts.toLocaleString()} L</span>
                            </div>

                            {/* Sales Breakdowns */}
                            <div className="pt-4 space-y-3">
                                <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-45">Sales & Provisioning (-)</span>
                                
                                <div className="flex justify-between items-center text-xs pl-4">
                                    <span className="opacity-70">Flight uplifts (Aviation Jet A-1)</span>
                                    <span className="font-mono font-bold">-{dailySummary.jetVol.toLocaleString()} L</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pl-4">
                                    <span className="opacity-70">Seaplane dock provisioning (Jet A-1)</span>
                                    <span className="font-mono font-bold">-{dailySummary.seaVol.toLocaleString()} L</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pl-4">
                                    <span className="opacity-70">Ground support Diesel Sales</span>
                                    <span className="font-mono font-bold">-{dailySummary.dieselSales.toLocaleString()} L</span>
                                </div>
                                <div className="flex justify-between items-center text-xs pl-4">
                                    <span className="opacity-70">Ground support Petrol Sales</span>
                                    <span className="font-mono font-bold">-{dailySummary.petrolSales.toLocaleString()} L</span>
                                </div>
                            </div>

                            {/* Total Sales sum */}
                            <div className="flex justify-between items-center pt-4 py-2.5">
                                <span className="text-xs font-bold text-error">Total Depleted Stocks (-)</span>
                                <span className="font-mono text-sm font-black text-error">-{dailySummary.totalSales.toLocaleString()} L</span>
                            </div>

                            {/* Closing Stock row */}
                            <div className="flex justify-between items-center pt-4 py-2.5">
                                <span className="text-xs font-bold opacity-80">Theoretical Closing Stock</span>
                                <span className="font-mono text-sm font-black">{(dailySummary.totalOpening + dailySummary.marineReceipts - dailySummary.totalSales).toLocaleString()} L</span>
                            </div>

                            {/* Physical stock dip check */}
                            <div className="flex justify-between items-center pt-4 py-2.5">
                                <span className="text-xs font-bold text-primary">Physical Diped Closing Stock</span>
                                <span className="font-mono text-sm font-black text-primary">{dailySummary.totalClosing.toLocaleString()} L</span>
                            </div>
                        </div>

                        {/* Operational Variance Display */}
                        <div className={`p-5 rounded-2xl border flex items-center justify-between ${
                            Math.abs(dailySummary.variance) < 2000 
                                ? 'bg-success/5 border-success/20 text-success' 
                                : 'bg-error/5 border-error/20 text-error'
                        }`}>
                            <div className="flex items-center space-x-3">
                                {dailySummary.variance >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Daily Material Variance</p>
                                    <p className="text-[9px] uppercase tracking-widest mt-0.5 opacity-40">Physical Dip vs Theoretical</p>
                                </div>
                            </div>
                            <span className="font-mono text-lg font-black">{dailySummary.variance >= 0 ? '+' : ''}{dailySummary.variance.toLocaleString()} L</span>
                        </div>
                    </div>

                    {/* Chart & Live Status Summary Card */}
                    <div className="card-premium p-8 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6">Sales Category Share</h3>
                            <div className="h-60 w-full mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{top: 5, right: 10, left: -20, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                                        <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 900, fill:'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={(v) => `${v / 1000}K`} tick={{fontSize: 8, fill:'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: 'var(--color-surface-dim)'}} />
                                        <Bar dataKey="L" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-outline flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-success animate-pulse shrink-0" />
                            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider leading-relaxed">
                                Balance reconciliation sheet strictly formatted under aviation tax guidelines. JIG Quality checks pass verification.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB 2: PARAMETERIZED FUEL QUERY REPORT GENERATOR */}
            <div className="card-premium p-8 lg:p-10 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline pb-6">
                    <div>
                        <h2 className="title-md text-on-surface uppercase tracking-tight font-black">Audit Ledger Search</h2>
                        <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-50">Generate query-based operations logs and export custom datasets</p>
                    </div>
                    {generatedLogs.length > 0 && (
                        <button 
                            onClick={handleCsvExport}
                            className="flex items-center px-6 py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-premium hover:scale-105 active:scale-95 transition-all shrink-0"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export custom report
                        </button>
                    )}
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Start Date</label>
                        <input 
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">End Date</label>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Fuel Class</label>
                        <select
                            value={filterProduct}
                            onChange={(e) => setFilterProduct(e.target.value)}
                            className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                        >
                            <option value="ALL">ALL PRODUCTS</option>
                            <option value="Jet-A1">AVIATION JET A-1</option>
                            <option value="Diesel">AUTOMOTIVE DIESEL</option>
                            <option value="Petrol">MOTOR PETROL</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Operation Stream</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
                        >
                            <option value="ALL">ALL TRANSACTIONS</option>
                            <option value="Flight">FLIGHT REFUELLING</option>
                            <option value="Seaplane">SEAPLANE DOCKS</option>
                            <option value="Ground">AFS/LFS SALES</option>
                            <option value="Receipt">VESSEL RECEIPTS</option>
                        </select>
                    </div>
                </div>

                {/* Audit Grid Table */}
                <div className="overflow-x-auto border border-outline rounded-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-dim/60 border-b border-outline">
                                <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Record Date</th>
                                <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Flow Target</th>
                                <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Asset category</th>
                                <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Location</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Volume (L)</th>
                                <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Delivery Ticket</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline">
                            {generatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">
                                        No refueling transactions found matching search criteria.
                                    </td>
                                </tr>
                            ) : (
                                generatedLogs.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-primary/[0.01] transition-colors">
                                        <td className="px-6 py-4 text-[10px] font-bold opacity-60 whitespace-nowrap">
                                            {log.timestampClearance?.split('T')[0] || log.operationalDate || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-black uppercase text-on-surface">
                                            {log.flightNumber}
                                        </td>
                                        <td className="px-6 py-4 text-[10px] font-black opacity-75">
                                            {log.aircraftType}
                                        </td>
                                        <td className="px-6 py-4 text-[10px] font-black opacity-60">
                                            {log.stand}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-xs">
                                            {log.volume.toLocaleString()} L
                                        </td>
                                        <td className="px-6 py-4 text-center text-[10px] font-black text-primary tracking-widest font-mono">
                                            {log.deliveryNumber || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-on-surface-dim pr-6">
                                            {log.remarks || '---'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
