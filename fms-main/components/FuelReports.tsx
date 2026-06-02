import React, { useState, useMemo } from 'react';
import { 
  FileText, Download, Calendar, Search, ShieldCheck, RefreshCw, 
  Layers, TrendingUp, TrendingDown, ClipboardList, Anchor, 
  Database, User as UserIcon, X, PlusCircle, CheckCircle, BarChart2 
} from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { FuelType, FlightLog, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface FuelReportsProps {
  user?: User | null;
}

interface ReconciliationLog {
  date: string;
  product: FuelType;
  computerStock: number;
  physicalDip: number;
  variance: number;
  operator: string;
}

export const FuelReports: React.FC<FuelReportsProps> = ({ user }) => {
  const { flightLogs, tanks, equipment } = useOperationalData();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'sales' | 'shipments' | 'reconciliation'>('sales');
  
  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('06');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily Reconciliation Entry Form States
  const [reconProduct, setReconProduct] = useState<FuelType>(FuelType.JET_A1);
  const [physicalDipVal, setPhysicalDipVal] = useState<string>('');
  const [reconLogs, setReconLogs] = useState<ReconciliationLog[]>([
    { date: '2026-06-01', product: FuelType.JET_A1, computerStock: 10100000, physicalDip: 10098500, variance: -1500, operator: 'Ali Riza' },
    { date: '2026-06-01', product: FuelType.DIESEL, computerStock: 143000, physicalDip: 143120, variance: 120, operator: 'Ali Riza' },
    { date: '2026-05-31', product: FuelType.PETROL, computerStock: 53000, physicalDip: 52980, variance: -20, operator: 'Hussein Manik' }
  ]);

  // Selected shipment for Figure 1.5 modal view
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);

  // 1. FUEL SALES MODULE DATA
  const salesSummary = useMemo(() => {
    // Generate sales aggregates based on flight logs
    const totalJetSales = (flightLogs || [])
      .filter(l => !l.flightNumber.includes('GROUND') && !l.flightNumber.includes('VESSEL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0);

    const totalDieselSales = (flightLogs || [])
      .filter(l => l.flightNumber.includes('GROUND') && l.flightNumber.includes('DIESEL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0) + 14200; // Adding seed ground station diesel

    const totalPetrolSales = (flightLogs || [])
      .filter(l => l.flightNumber.includes('GROUND') && l.flightNumber.includes('PETROL'))
      .reduce((acc, l) => acc + (l.volume || 0), 0) + 9800; // Adding seed petrol

    return {
      jet: totalJetSales > 0 ? totalJetSales : 12450000, // Fallback to premium mockup scales
      diesel: totalDieselSales,
      petrol: totalPetrolSales,
      total: (totalJetSales > 0 ? totalJetSales : 12450000) + totalDieselSales + totalPetrolSales
    };
  }, [flightLogs]);

  // Monthly breakdowns for Recharts
  const monthlySalesData = useMemo(() => {
    return [
      { month: 'Jan', jet: 10800000, diesel: 180000, petrol: 92000 },
      { month: 'Feb', jet: 11200000, diesel: 195000, petrol: 95000 },
      { month: 'Mar', jet: 12500000, diesel: 210000, petrol: 102000 },
      { month: 'Apr', jet: 11900000, diesel: 175000, petrol: 89000 },
      { month: 'May', jet: 12100000, diesel: 190000, petrol: 93000 },
      { month: 'Jun', jet: salesSummary.jet, diesel: salesSummary.diesel, petrol: salesSummary.petrol }
    ];
  }, [salesSummary]);

  // Carrier based sales report
  const airlineSalesData = useMemo(() => {
    return [
      { airline: 'Emirates', volume: 4500000, flights: 75, share: '36.1%' },
      { airline: 'Qatar Airways', volume: 3200000, flights: 58, share: '25.7%' },
      { airline: 'Singapore Airlines', volume: 2100000, flights: 35, share: '16.8%' },
      { airline: 'British Airways', volume: 1450000, flights: 22, share: '11.6%' },
      { airline: 'SriLankan Airlines', volume: 1200000, flights: 48, share: '9.8%' }
    ];
  }, []);

  // COLORS FOR CELL CHART
  const COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', '#8884d8', '#ff7300'];

  // 2. SHIPMENTS DATA (Tanker receipts - matches Figure 1.5 design values)
  const shipmentLogs = useMemo(() => {
    return [
      {
        id: 'sh-jet-18',
        vesselName: 'MT ALIMAS',
        shipmentNo: 'NS/SHIP-JET A-1/2026/18',
        product: FuelType.JET_A1,
        started: '2026-05-24 12:00',
        completed: '2026-05-26 10:24',
        quantityMt: 17001.051,
        tankBefore103: { dip: 1780, vol: 2533.575, roofCorr: 0, density: 777.2, temp: 26.50, density15: 0.7678, tankTemp: 29.90, vcf: 0.9825, kl15: 2489.237 },
        tankAfter103: { dip: 13493, vol: 15122.230, roofCorr: 0, density: 774.3, temp: 31.00, density15: 0.7829, tankTemp: 28.00, vcf: 0.9867, kl15: 14921.104 },
        tankBefore101: { dip: 3955, vol: 4873.279, roofCorr: 0, density: 777.4, temp: 26.40, density15: 0.7678, tankTemp: 30.60, vcf: 0.9819, kl15: 4785.073 },
        tankAfter101: { dip: 12619, vol: 14200.265, roofCorr: 0, density: 773.4, temp: 31.00, density15: 0.7797, tankTemp: 28.00, vcf: 0.9864, kl15: 14007.141 },
        recSummary: {
          blDensity: 0.7859,
          wcf: 0.7848,
          totalObsM3: 21915.641,
          totalVol15M3: 21653.935,
          usBarrels: 136267,
          longTons: 16725.661,
          metricTons: 16994.066,
          metricTonsBl: 17001.051,
          diffMt: -6.985,
          pctDiff: -0.04
        },
        remarks: 'Bulk discharge completed smoothly. All density tests passed JIG validation.',
        preparedBy: 'Ali Riza, Executive, DEPOT OPERATIONS'
      },
      {
        id: 'sh-diesel-02',
        vesselName: 'MT OCEAN PRIDE',
        shipmentNo: 'NS/SHIP-DIESEL/2026/02',
        product: FuelType.DIESEL,
        started: '2026-05-28 08:30',
        completed: '2026-05-29 16:45',
        quantityMt: 4200.000,
        recSummary: {
          blDensity: 0.8420,
          wcf: 0.8409,
          totalObsM3: 5050.000,
          totalVol15M3: 4980.000,
          usBarrels: 31320,
          longTons: 4125.000,
          metricTons: 4187.600,
          metricTonsBl: 4200.000,
          diffMt: -12.400,
          pctDiff: -0.29
        },
        remarks: 'Diesel gasoil reconciliation within tolerance.',
        preparedBy: 'Hussein Manik, Supervisor, DEPOT OPERATIONS'
      }
    ];
  }, []);

  // 3. CONSOLIDATED FUEL SUMMARY (Reconciliation Tab)
  // Summarize across facilities: Tanks, Refuellers, Hydrant dispensers
  const activeTanksTotal = useMemo(() => {
    const jet = (tanks || []).filter(t => t.type === FuelType.JET_A1).reduce((sum, t) => sum + t.currentLevel, 0);
    const diesel = (tanks || []).filter(t => t.type === FuelType.DIESEL).reduce((sum, t) => sum + t.currentLevel, 0);
    const petrol = (tanks || []).filter(t => t.type === FuelType.PETROL).reduce((sum, t) => sum + t.currentLevel, 0);
    return { jet, diesel, petrol };
  }, [tanks]);

  const activeRefuellersTotal = useMemo(() => {
    // Dynamic sum of all refueller capacities/volumes
    const refuellers = (equipment || []).filter(e => e.type === 'Refueller');
    const totalVolume = refuellers.reduce((sum, e) => sum + (e.currentVolume || 0), 0);
    return totalVolume;
  }, [equipment]);

  const hydrantVehiclesCount = useMemo(() => {
    return (equipment || []).filter(e => e.type === 'Hydrant Dispenser' || e.type === 'Hydrant Service').length;
  }, [equipment]);

  // Aggregate current inventory grand total
  const consolidatedInventory = useMemo(() => {
    const totalStorage = activeTanksTotal.jet + activeTanksTotal.diesel + activeTanksTotal.petrol;
    const totalMobile = activeRefuellersTotal; // Refuellers
    return {
      storage: totalStorage,
      mobile: totalMobile,
      grandTotal: totalStorage + totalMobile
    };
  }, [activeTanksTotal, activeRefuellersTotal]);

  // Form handler for Daily reconciliation physical dip entry
  const handleReconSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dipVal = parseFloat(physicalDipVal);
    if (isNaN(dipVal) || dipVal <= 0) return;

    // Fetch computerized stock from active totals
    let computerStock = 0;
    if (reconProduct === FuelType.JET_A1) computerStock = activeTanksTotal.jet;
    else if (reconProduct === FuelType.DIESEL) computerStock = activeTanksTotal.diesel;
    else computerStock = activeTanksTotal.petrol;

    const variance = dipVal - computerStock;

    const newLog: ReconciliationLog = {
      date: new Date().toISOString().split('T')[0],
      product: reconProduct,
      computerStock,
      physicalDip: dipVal,
      variance,
      operator: user?.name || 'System Admin'
    };

    setReconLogs(prev => [newLog, ...prev]);
    setPhysicalDipVal('');
  };

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            FUEL <span className="text-primary italic font-medium ml-3">REPORTS</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: FUEL DISPATCH</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Stock Audits</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline shrink-0 overflow-hidden w-full max-w-[420px] shadow-inner">
          <div 
            className={`absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
              ${activeTab === 'sales' ? 'left-1.5 translate-x-[0%]' : ''}
              ${activeTab === 'shipments' ? 'left-1.5 translate-x-[100%]' : ''}
              ${activeTab === 'reconciliation' ? 'left-1.5 translate-x-[200%]' : ''}
            `}
          />
          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'sales' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Fuel Sales
          </button>
          <button 
            onClick={() => setActiveTab('shipments')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'shipments' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Shipments Details
          </button>
          <button 
            onClick={() => setActiveTab('reconciliation')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'reconciliation' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Stock Summary
          </button>
        </div>
      </div>

      {/* ── TAB 1: FUEL SALES BREAKDOWN ── */}
      {activeTab === 'sales' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Report Year</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-5 py-3.5 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="2026">2026 OPERATIONAL YEAR</option>
                <option value="2025">2025 ARCHIVED YEAR</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Report Month</label>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-5 py-3.5 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="06">JUNE (CURRENT)</option>
                <option value="05">MAY</option>
                <option value="04">APRIL</option>
                <option value="03">MARCH</option>
              </select>
            </div>
          </div>

          {/* Liters Sold Aggregates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary flex flex-col justify-between">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Jet A-1 Active Sales</span>
              <div>
                <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">{(salesSummary.jet / 1000000).toFixed(2)}M L</span>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1 opacity-60">Commercial Flight Uplifts</p>
              </div>
            </div>
            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-success flex flex-col justify-between">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Diesel Active Sales</span>
              <div>
                <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">{salesSummary.diesel.toLocaleString()} L</span>
                <p className="text-[9px] font-black text-success uppercase tracking-widest mt-1 opacity-60">Ground Support Vehicles</p>
              </div>
            </div>
            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-warning flex flex-col justify-between">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Petrol Active Sales</span>
              <div>
                <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">{salesSummary.petrol.toLocaleString()} L</span>
                <p className="text-[9px] font-black text-warning uppercase tracking-widest mt-1 opacity-60">Airside AFS/LFS Stations</p>
              </div>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center">
                <BarChart2 className="w-4 h-4 mr-3 text-primary opacity-60" />
                Active Sales Trend [1-MONTH BREAKDOWN]
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySalesData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="month" tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'var(--color-surface-dim)'}} />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                    <Bar dataKey="jet" name="Jet A-1" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="diesel" name="Diesel" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="petrol" name="Petrol" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Airline Breakdown segment */}
            <div className="card-premium p-6 lg:p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6">Carrier sales Contribution</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={airlineSalesData} dataKey="volume" nameKey="airline" cx="50%" cy="50%" innerRadius={50} outerRadius={70} fill="#8884d8" paddingAngle={4}>
                        {airlineSalesData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2 border-t border-outline/40 pt-4">
                {airlineSalesData.slice(0, 3).map((item, idx) => (
                  <div key={item.airline} className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="flex items-center gap-2 text-on-surface-dim">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      {item.airline}
                    </span>
                    <span className="font-mono text-on-surface">{(item.volume / 1000000).toFixed(1)}M L</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Granular Sales Carrier table */}
          <div className="card-premium overflow-hidden">
            <div className="px-8 py-5 border-b border-outline bg-surface-dim/40">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em]">Airline-based Fuel Sales Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-dim/60 border-b border-outline">
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Airline Carrier</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Flights Served</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Total Uplift Volume (L)</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Uplift Share (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {airlineSalesData.map((row) => (
                    <tr key={row.airline} className="hover:bg-primary/[0.01] transition-colors">
                      <td className="px-8 py-4 text-xs font-black uppercase text-on-surface">{row.airline}</td>
                      <td className="px-8 py-4 text-center text-xs font-bold text-on-surface-dim">{row.flights}</td>
                      <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{row.volume.toLocaleString()} L</td>
                      <td className="px-8 py-4 text-right text-xs font-black text-primary italic">{row.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SHIPMENT DETAILS (Marine Receipts & Figure 1.5 template) ── */}
      {activeTab === 'shipments' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          <div className="card-premium p-6 lg:p-8">
            <h2 className="title-md text-on-surface uppercase tracking-tight font-black mb-6">Marine Tanker Discharge Log Ledger</h2>
            <div className="overflow-x-auto border border-outline rounded-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-dim/60 border-b border-outline">
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Receipt Date</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Vessel Particulars</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Shipment ID</th>
                    <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Fuel Grade</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Quantity (MT)</th>
                    <th className="px-8 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {shipmentLogs.map((ship) => (
                    <tr key={ship.id} className="hover:bg-primary/[0.01] transition-colors">
                      <td className="px-8 py-4 text-xs font-bold opacity-60 whitespace-nowrap">{ship.completed.split(' ')[0]}</td>
                      <td className="px-8 py-4 text-xs font-black uppercase text-on-surface">{ship.vesselName}</td>
                      <td className="px-8 py-4 text-[10px] font-black opacity-75">{ship.shipmentNo}</td>
                      <td className="px-8 py-4 text-xs">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-md uppercase ${
                          ship.product === FuelType.JET_A1 ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                        }`}>
                          {ship.product}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{ship.quantityMt.toLocaleString()} MT</td>
                      <td className="px-8 py-4 text-center">
                        <button 
                          onClick={() => setSelectedShipment(ship)}
                          className="px-4 py-2 kinetic-gradient text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-premium hover:scale-105"
                        >
                          View Receipt (Fig 1.5)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: FUEL STOCK SUMMARY & PHYSICAL RECONCILIATION ── */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          {/* Consolidated Active Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-primary">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Depot Active Storage</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{(consolidatedInventory.storage / 1000000).toFixed(2)}M L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Bulk Farm Tanks (TK-101/102/103/4/6/7)</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-success">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Refuellers mobile Volume</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{consolidatedInventory.mobile.toLocaleString()} L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Active mobile refueller fleet</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-surface-dim/40 flex flex-col justify-between border-l-4 border-l-warning">
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Hydrant Vehicles Count</span>
              <div>
                <span className="text-2xl font-black text-on-surface font-mono">{hydrantVehiclesCount} HS Vehicles</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Hydrant service/dispenser fleet</p>
              </div>
            </div>
            <div className="card-premium p-6 bg-primary/5 flex flex-col justify-between border border-primary/20 shadow-premium">
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Grand consolidated Stock</span>
              <div>
                <span className="text-2xl font-[900] text-primary font-mono tracking-tighter shadow-glow">{(consolidatedInventory.grandTotal / 1000000).toFixed(2)}M L</span>
                <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Active across entire facility</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
            {/* Daily Dip Reconciliation entry form */}
            <div className="xl:col-span-1 card-premium p-6 lg:p-8 flex flex-col justify-between">
              <form onSubmit={handleReconSubmit} className="space-y-6">
                <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] flex items-center border-b border-outline pb-4">
                  <PlusCircle className="w-5 h-5 mr-3 text-primary" />
                  Daily Dip Reconciliation
                </h3>

                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Fuel Grade</label>
                  <select 
                    value={reconProduct}
                    onChange={(e) => setReconProduct(e.target.value as FuelType)}
                    className="w-full px-5 py-3.5 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value={FuelType.JET_A1}>JET A-1 (AVIATION)</option>
                    <option value={FuelType.DIESEL}>DIESEL (GASOIL)</option>
                    <option value={FuelType.PETROL}>PETROL (MOGAS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Physical static Dip (Liters)</label>
                  <input 
                    type="number"
                    required
                    value={physicalDipVal}
                    onChange={(e) => setPhysicalDipVal(e.target.value)}
                    className="w-full px-5 py-3.5 bg-surface-dim border border-outline rounded-xl text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-primary outline-none text-right font-mono"
                    placeholder="Enter physical volume in L"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all"
                >
                  Engage Audit Entry
                </button>
              </form>

              <div className="pt-6 border-t border-outline/40 flex items-center gap-3 mt-6">
                <ShieldCheck className="w-5 h-5 text-success shrink-0" />
                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider leading-relaxed">
                  Daily static dips reconcile automated meters against physical tank soundings to identify systemic variances.
                </p>
              </div>
            </div>

            {/* Reconciliation Variance History log list */}
            <div className="xl:col-span-2 card-premium overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-8 py-5 border-b border-outline bg-surface-dim/40">
                  <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em]">Static Dip Audit Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-dim/60 border-b border-outline">
                        <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Audit Date</th>
                        <th className="px-6 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Grade</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">System Stock (L)</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Physical Dip (L)</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Material Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {reconLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-primary/[0.01] transition-colors">
                          <td className="px-6 py-4 text-xs font-bold opacity-60 whitespace-nowrap">{log.date}</td>
                          <td className="px-6 py-4 text-xs font-black uppercase text-on-surface">{log.product}</td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-on-surface">{log.computerStock.toLocaleString()} L</td>
                          <td className="px-6 py-4 text-right font-mono text-xs text-on-surface">{log.physicalDip.toLocaleString()} L</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider ${
                              log.variance === 0 ? 'bg-success/10 text-success' :
                              Math.abs(log.variance) <= 1000 ? 'bg-success/10 text-success' : 'bg-error/10 text-error animate-pulse'
                            }`}>
                              {log.variance >= 0 ? '+' : ''}{log.variance.toLocaleString()} L
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIGH FIDELITY MACL Figure 1.5 TEMPLATE POPUP MODAL ── */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-black border border-slate-300 w-full max-w-4xl rounded-2xl shadow-premium overflow-hidden flex flex-col my-8 relative max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-100 px-8 py-4 border-b border-slate-200 flex justify-between items-center text-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest">JIG Compliance Document Viewer</span>
              </div>
              <button 
                onClick={() => setSelectedShipment(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-black hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              {/* Figure 1.5 Replica Layout */}
              <div className="border-[3px] border-black p-6 font-sans text-xs bg-white text-black select-text">
                
                {/* Brand Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                  <div>
                    <h2 className="text-[13px] font-black tracking-tight leading-tight">FUEL SERVICES SECTION</h2>
                    <h3 className="text-[11px] font-bold text-slate-600">VELANA INTERNATIONAL AIRPORT</h3>
                    <h3 className="text-[10px] font-medium text-slate-500">MALDIVES AIRPORTS COMPANY LTD</h3>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="font-extrabold text-[12px] text-blue-900 tracking-wider">MALDIVES AIRPORTS Co.</div>
                    <div className="text-[8px] italic text-slate-400">your journey • our business</div>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center py-4">
                  <h1 className="text-xl font-black tracking-widest uppercase border-b-2 border-black inline-block px-10 pb-1">{selectedShipment.product.toUpperCase()} RECEIPT REPORT</h1>
                </div>

                {/* Vessel Manifest Metadata */}
                <table className="w-full border-collapse border border-black mb-6">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">NAME OF THE TANKER</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.vesselName}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">SHIPMENT NO</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.shipmentNo}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">STARTED</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.started}</td>
                    </tr>
                    <tr>
                      <td className="border-r border-black p-2 font-black w-1/4 uppercase bg-slate-50">COMPLETED</td>
                      <td className="p-2 font-bold w-3/4 text-blue-900">{selectedShipment.completed}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Dip Tank Readings Table (Figure 1.5 exact replication format) */}
                <table className="w-full border-collapse border border-black text-center mb-6">
                  <thead>
                    <tr className="border-b border-black bg-slate-100">
                      <th className="border-r border-black p-2 font-black rowspan-2 text-left" rowSpan={2}>TANK NO</th>
                      <th className="border-r border-black p-2 font-black colspan-2" colSpan={2}>TANK NO : 103</th>
                      <th className="border-r border-black p-2 font-black colspan-2" colSpan={2}>TANK NO : 101</th>
                      <th className="p-2 font-black w-16" rowSpan={2}></th>
                    </tr>
                    <tr className="border-b border-black bg-slate-50">
                      <th className="border-r border-black p-1.5 font-bold">BEFORE</th>
                      <th className="border-r border-black p-1.5 font-bold">AFTER</th>
                      <th className="border-r border-black p-1.5 font-bold">BEFORE</th>
                      <th className="border-r border-black p-1.5 font-bold">AFTER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Gross Dip MM */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">GROSS DIP <span className="float-right font-medium text-slate-500">MM</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.dip.toLocaleString()}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.dip.toLocaleString()}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Table Volume KL */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TABLE VOLUME <span className="float-right font-medium text-slate-500">KL</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vol.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Roof Correction */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">ROOF CORRECTION</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.roofCorr}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.roofCorr}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Recalculated Volume */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TABLE VOLUME <span className="float-right font-medium text-slate-500">KL</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vol.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vol.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Total Observed Volume */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TOTAL OBSERVED VOLUME</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>12,588.655 KL</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>9,326.986 KL</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Observed Density */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">DENSITY OBSERVED</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.density.toFixed(1)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.density.toFixed(1)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Temperature */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TEMPERATURE <span className="float-right font-medium text-slate-500">°C</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.temp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.temp.toFixed(2)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Density at 15 °C */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">DENSITY AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.density15.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.density15.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vcf.toFixed(4)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Tank Temp */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">TANK TEMPERATURE <span className="float-right font-medium text-slate-500">°C</span></td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.tankTemp.toFixed(2)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.tankTemp.toFixed(2)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* VCF */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">V.C.F</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.vcf.toFixed(4)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.vcf.toFixed(4)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* KL at 15 °C */}
                    <tr className="border-b border-black">
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">KILO LITRES AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore103?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter103?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankBefore101?.kl15.toFixed(3)}</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900">{selectedShipment.tankAfter101?.kl15.toFixed(3)}</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                    {/* Total receipt */}
                    <tr>
                      <td className="border-r border-black p-2 font-black text-left bg-slate-50">RECEIPT AT 15 °C</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>12,431.867 KL</td>
                      <td className="border-r border-black p-2 font-bold font-mono text-blue-900 text-center" colSpan={2}>9,222.068 KL</td>
                      <td className="p-2 font-mono"></td>
                    </tr>
                  </tbody>
                </table>

                {/* Bottom section: Receipts Summary & Remarks (Double column) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-black p-4">
                  {/* Left Column: Receipts Summary */}
                  <div>
                    <h3 className="font-extrabold border-b border-black pb-1 mb-2 text-center uppercase bg-slate-100">RECEIPTS</h3>
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">B/L DENSITY</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.blDensity.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">W.C.F</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.wcf.toFixed(4)}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">TOTAL OBSVD. VOLUME / M³</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.totalObsM3.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">TOTAL VOLUME @ 15 °C / M³</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.totalVol15M3.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">US BARRELS @ 60 °F</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.usBarrels.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">LONG TONS (AIR)</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.longTons.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">METRIC TONS (AIR)</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.metricTons.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">METRIC TONS (AIR) B/L</td>
                          <td className="text-right font-mono font-bold text-blue-900">{selectedShipment.recSummary?.metricTonsBl.toLocaleString()}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="font-bold py-1">DIFF BETWEEN B/L & OUT TURN</td>
                          <td className="text-right font-mono font-bold text-red-600">{selectedShipment.recSummary?.diffMt.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td className="font-black py-1">PERCENTAGE DIFFERENCE</td>
                          <td className="text-right font-mono font-black text-red-600">{selectedShipment.recSummary?.pctDiff}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right Column: Remarks & Prepared By */}
                  <div className="flex flex-col justify-between border-l border-slate-300 pl-4">
                    <div>
                      <h3 className="font-extrabold border-b border-black pb-1 mb-2 text-center uppercase bg-slate-100">REMARKS:</h3>
                      <p className="text-xs text-slate-700 leading-relaxed font-bold italic p-2 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                        {selectedShipment.remarks}
                      </p>
                    </div>

                    <div className="border-t border-slate-300 pt-4 mt-6">
                      <p className="font-black text-slate-400 text-[8px] uppercase tracking-wider">PREPARED BY:</p>
                      <p className="font-black text-blue-900 text-sm italic mt-2">{selectedShipment.preparedBy.split(',')[0]}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedShipment.preparedBy.split(',').slice(1).join(', ')}</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-8 py-5 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setSelectedShipment(null)}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 hover:scale-105 shadow-sm"
              >
                Close Receipt
              </button>
              <button 
                onClick={() => alert('Initiating secure PDF compilation under MACL standard format...')}
                className="px-6 py-2.5 kinetic-gradient text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all border-none"
              >
                Download PDF Format
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
