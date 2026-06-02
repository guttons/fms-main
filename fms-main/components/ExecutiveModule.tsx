import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Calendar, FileText, TrendingUp, ShieldCheck, AlertTriangle, 
  ArrowUpRight, Info, Database, Layers, Ship, Plane, Compass, Activity
} from 'lucide-react';
import { User } from '../types';

interface ExecutiveModuleProps {
  user?: User | null;
}

interface StockSummarySnapshot {
  date: string;
  openingStock: number;
  physicalBalance: number;
  deadStock: number;
  usableFuel: number;
  prevDaySales: number;
  sevenDayAvgSales: number;
  daysRemaining: number;
  estimatedLastTill: string;
  nextShipmentArrival: string;
  orderQtyMt: number;
  orderQtyLiters: number;
  daysToShipment: number;
  coverageStatus: 'secure' | 'warning' | 'critical';
}

// Deterministic mock snapshot generator based on selected date string
const generateSnapshotForDate = (dateStr: string): StockSummarySnapshot => {
  // Simple deterministic hash based on the date string characters
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const seedRandom = (min: number, max: number) => {
    const x = Math.sin(hash++) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  const openingStock = seedRandom(7200000, 9400000);
  const prevDaySales = seedRandom(190000, 270000);
  const physicalBalance = openingStock - prevDaySales;
  const deadStock = 500000; // unpumpable tank bottoms
  const usableFuel = physicalBalance - deadStock;
  const sevenDayAvgSales = seedRandom(210000, 238000);
  
  const daysRemaining = parseFloat((usableFuel / sevenDayAvgSales).toFixed(1));
  
  // Calculate "Estimated Last Till" date
  const lastTillDate = new Date(dateStr);
  lastTillDate.setDate(lastTillDate.getDate() + Math.floor(daysRemaining));
  const estimatedLastTill = lastTillDate.toISOString().split('T')[0];
  
  // Shipment calculation
  const shipmentDate = new Date(dateStr);
  const daysToShipment = seedRandom(8, 26);
  shipmentDate.setDate(shipmentDate.getDate() + daysToShipment);
  const nextShipmentArrival = shipmentDate.toISOString().split('T')[0];
  
  const orderQtyMt = seedRandom(16000, 18500);
  const orderQtyLiters = Math.round(orderQtyMt * 1274); // conversion factor
  
  // Threshold determination: 22-Day Stock Coverage Threshold
  // secure: >= 22 days, warning: 15-22 days, critical: < 15 days
  const coverageStatus = daysRemaining >= 22 ? 'secure' : daysRemaining >= 15 ? 'warning' : 'critical';
  
  return {
    date: dateStr,
    openingStock,
    physicalBalance,
    deadStock,
    usableFuel,
    prevDaySales,
    sevenDayAvgSales,
    daysRemaining,
    estimatedLastTill,
    nextShipmentArrival,
    orderQtyMt,
    orderQtyLiters,
    daysToShipment,
    coverageStatus
  };
};

// Generates 30-day coverage days trend data
const generate30DayTrend = (endDateStr: string) => {
  const data = [];
  const endDate = new Date(endDateStr);
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const snap = generateSnapshotForDate(dateStr);
    data.push({
      date: dateStr.substring(5), // MM-DD
      daysRemaining: snap.daysRemaining,
      usableFuel: snap.usableFuel
    });
  }
  return data;
};

export const ExecutiveModule: React.FC<ExecutiveModuleProps> = ({ user }) => {
  // Static daily view calendar state (initializes to Velana operational day)
  const [selectedDate, setSelectedDate] = useState<string>('2026-06-02');

  // Compute daily summary snapshots dynamically based on active selected calendar date
  const snapshot = useMemo(() => generateSnapshotForDate(selectedDate), [selectedDate]);
  
  // Compute MTD details dynamically
  const mtdDetails = useMemo(() => {
    const day = new Date(selectedDate).getDate();
    const volume = day * 224000 + 42000;
    const flights = day * 34 + 4;
    const variance = 4.8; // +4.8% YoY
    return { volume, flights, variance };
  }, [selectedDate]);

  // Compute 30-day line graph coordinates
  const trendData = useMemo(() => generate30DayTrend(selectedDate), [selectedDate]);

  // Dynamic window safety calculation (Usable Stock Days vs Days to Shipment Arrival)
  const safetyWindow = useMemo(() => {
    return parseFloat((snapshot.daysRemaining - snapshot.daysToShipment).toFixed(1));
  }, [snapshot]);

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            EXECUTIVE <span className="text-primary italic font-medium ml-3">PORTAL</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Maldives Airports Co. Ltd</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Velana Fuel Strategy Dashboard</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-success uppercase tracking-[0.3em] flex items-center gap-1">
               <ShieldCheck className="w-3.5 h-3.5 text-success" /> Static Daily Registry active
             </span>
          </div>
        </div>

        {/* Historical Archive Retrieval Calendar Selector */}
        <div className="flex flex-col space-y-2 shrink-0">
          <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Archive Snapshot Date</label>
          <div className="relative flex items-center gap-3 bg-surface-dim border border-outline px-5 py-3 rounded-2xl shadow-inner hover:border-primary/50 transition-colors">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-black uppercase text-on-surface cursor-pointer select-none focus:ring-0 w-[140px]"
            />
          </div>
        </div>
      </div>

      {/* ── DAILY SUMMARY STATUS BANNER ── */}
      <div className="card-premium p-6 lg:p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 border-l-primary relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
            snapshot.coverageStatus === 'secure' ? 'bg-success/10 text-success border-success/20 shadow-glow' : 
            snapshot.coverageStatus === 'warning' ? 'bg-warning/10 text-warning border-warning/20' : 
            'bg-error/10 text-error border-error/20 animate-pulse shadow-glow'
          }`}>
            {snapshot.coverageStatus === 'secure' ? <ShieldCheck className="w-6 h-6" /> : 
             snapshot.coverageStatus === 'warning' ? <AlertTriangle className="w-6 h-6 text-warning" /> : 
             <AlertTriangle className="w-6 h-6 text-error" />}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-on-surface">Static Daily Summary snapshot</h4>
            <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-1 leading-relaxed">
              Recorded on <span className="text-on-surface font-mono">{snapshot.date}</span>. This view remains constant throughout the operational day and compiles static figures generated for this historical date.
            </p>
          </div>
        </div>
        
        {/* Coverage Threshold indicator */}
        <div className="flex flex-col items-end">
          <span className={`text-[9px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider ${
            snapshot.coverageStatus === 'secure' ? 'bg-success/15 text-success border border-success/25' : 
            snapshot.coverageStatus === 'warning' ? 'bg-warning/15 text-warning border border-warning/25' : 
            'bg-error/15 text-error border border-error/25 animate-pulse'
          }`}>
            {snapshot.coverageStatus === 'secure' ? 'Secure Coverage (≥ 22D)' : 
             snapshot.coverageStatus === 'warning' ? 'Warning Coverage (15D - 22D)' : 
             'Critical stock Coverage (< 15D)'}
          </span>
        </div>
      </div>

      {/* ── DAILY SUMMARY SECTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        
        {/* Widget 1: Stock Position */}
        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Stock Position</span>
            <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
              <Database className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Inventory Sounding Dips
            </h3>
            
            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                <span>Opening Inventory Stock:</span>
                <span className="font-mono text-on-surface">{snapshot.openingStock.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                <span>Physical sound Balance:</span>
                <span className="font-mono text-on-surface">{snapshot.physicalBalance.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                <span>Dead Stock calibration:</span>
                <span className="font-mono text-on-surface-dim opacity-70">{snapshot.deadStock.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-baseline text-xs font-black text-primary pt-2">
                <span>Usable Fuel Available:</span>
                <span className="font-mono text-xl">{snapshot.usableFuel.toLocaleString()} L</span>
              </div>
            </div>
          </div>
          
          {/* Visual Usable Progress Bar */}
          <div className="space-y-2 pt-4">
            <div className="flex justify-between text-[9px] font-black text-on-surface-dim uppercase">
              <span>Dead Stock ({Math.round((snapshot.deadStock / snapshot.physicalBalance) * 100)}%)</span>
              <span>Usable ({Math.round((snapshot.usableFuel / snapshot.physicalBalance) * 100)}%)</span>
            </div>
            <div className="h-2 w-full bg-surface-dim rounded-full overflow-hidden flex border border-outline/20">
              <div className="h-full bg-on-surface-dim opacity-30" style={{ width: `${(snapshot.deadStock / snapshot.physicalBalance) * 100}%` }}></div>
              <div className="h-full kinetic-gradient shadow-glow" style={{ width: `${(snapshot.usableFuel / snapshot.physicalBalance) * 100}%` }}></div>
            </div>
          </div>
        </div>

        {/* Widget 2: Sales Analysis */}
        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Sales Analysis</span>
            <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Daily Burn Rates
            </h3>
            
            <div className="space-y-5 mt-6">
              <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Previous Day Sales</span>
                  <span className="text-base font-black text-on-surface font-mono">{snapshot.prevDaySales.toLocaleString()} L</span>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg text-primary text-[10px] font-black font-mono">
                  Day Sale
                </div>
              </div>

              <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">7-Day Moving average</span>
                  <span className="text-base font-black text-on-surface font-mono">{snapshot.sevenDayAvgSales.toLocaleString()} L</span>
                </div>
                <div className="p-2 bg-success/10 rounded-lg text-success text-[10px] font-black font-mono">
                  7D average
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-outline/30 flex justify-between items-center">
            <span className="text-[10px] font-bold text-on-surface-dim uppercase">Comparison Variance:</span>
            <span className={`text-[10px] font-black flex items-center gap-1 ${
              snapshot.prevDaySales > snapshot.sevenDayAvgSales ? 'text-primary' : 'text-success'
            }`}>
              {snapshot.prevDaySales > snapshot.sevenDayAvgSales ? (
                <>
                  <ArrowUpRight className="w-4 h-4" /> +{Math.round(((snapshot.prevDaySales - snapshot.sevenDayAvgSales) / snapshot.sevenDayAvgSales) * 100)}% vs Average
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4 rotate-90" /> -{Math.round(((snapshot.sevenDayAvgSales - snapshot.prevDaySales) / snapshot.sevenDayAvgSales) * 100)}% vs Average
                </>
              )}
            </span>
          </div>
        </div>

        {/* Widget 3: Availability Projections */}
        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Availability Projections</span>
            <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
              <Compass className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Endurance Forecasting
            </h3>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl">
                <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Stock Duration</span>
                <span className="text-2xl font-[900] text-primary font-mono tracking-tighter block mt-1">{snapshot.daysRemaining} <span className="text-[10px] font-black not-italic uppercase opacity-55">Days</span></span>
              </div>
              <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl">
                <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Depletion Date</span>
                <span className="text-sm font-black text-on-surface font-mono block mt-2 whitespace-nowrap">{snapshot.estimatedLastTill}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 opacity-70" />
            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider leading-relaxed">
              Depletion date reflects usable stocks only, based on current moving sales averages. Reorder point is 22 days.
            </p>
          </div>
        </div>

      </div>

      {/* ── SHIPMENT WINDOW ANALYSIS & MONTHLY PERFORMANCE OVERVIEW ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        
        {/* Shipment Window Analysis Widget */}
        <div className="xl:col-span-2 card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Shipment Window Analysis</span>
            <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
              <Ship className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Tanker Discharge Interface Window
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {/* Next Arrival */}
              <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Next Arrival Date</span>
                  <span className="text-sm font-black text-on-surface font-mono block leading-tight">{snapshot.nextShipmentArrival}</span>
                  <span className="text-[9px] font-bold text-primary block mt-1.5 uppercase tracking-wide">MT ALIMAS Vol. 18</span>
                </div>
              </div>
              {/* Order Quantity */}
              <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Order Quantity</span>
                  <span className="text-base font-black text-on-surface font-mono block leading-tight">{snapshot.orderQtyMt.toLocaleString()} MT</span>
                  <span className="text-[9px] font-bold text-on-surface-dim opacity-60 block mt-1 font-mono">{(snapshot.orderQtyLiters / 1000000).toFixed(2)}M Liters</span>
                </div>
              </div>
              {/* Arrival Window */}
              <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Arrival Window</span>
                  <span className="text-base font-black text-on-surface font-mono block leading-tight">{snapshot.daysToShipment} Days</span>
                  <span className="text-[9px] font-bold text-on-surface-dim opacity-60 block mt-1 uppercase">Tanks ready for ullage</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-4 border rounded-xl flex items-center justify-between gap-4 text-xs font-bold
            ${safetyWindow >= 0 ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'}
          `}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {safetyWindow >= 0 
                  ? `Safety Window Secure: Next tanker arrives ${safetyWindow} days before stock depletion.`
                  : `Safety Window Critical Alert: Depletion projected ${Math.abs(safetyWindow)} days before shipment arrival!`
                }
              </span>
            </div>
            <span className="font-mono text-sm font-black whitespace-nowrap">
              {safetyWindow >= 0 ? `+${safetyWindow} Days` : `${safetyWindow} Days`}
            </span>
          </div>
        </div>

        {/* Monthly Performance Overview (MTD) */}
        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Monthly Performance Overview</span>
            <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
              <Layers className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Month-to-Date (MTD) Summary
            </h3>

            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                <span>Total Uplift Volume (L):</span>
                <span className="font-mono text-on-surface font-black text-sm">{(mtdDetails.volume / 1000).toFixed(0)}K L</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                <span>Total Flights Served:</span>
                <span className="font-mono text-on-surface font-black text-sm">{mtdDetails.flights} Flights</span>
              </div>
              <div className="flex justify-between items-center text-xs font-black text-success pt-1">
                <span>YoY Variance (vs. Last Year):</span>
                <span className="flex items-center font-mono gap-1 text-sm font-black">
                  <ArrowUpRight className="w-4 h-4" /> +{mtdDetails.variance}%
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-outline/30 flex justify-between items-center text-[9px] font-black uppercase text-on-surface-dim opacity-50 tracking-wider">
            <span>Billing Period: MTD Real-Time</span>
            <span>Aviation Sector</span>
          </div>
        </div>

      </div>

      {/* ── STOCK DAYS COVERAGE TREND GRAPH (30 DAYS) ── */}
      <div className="grid grid-cols-1 gap-6 lg:gap-10">
        <div className="card-premium p-6 lg:p-8">
          <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-8 flex items-center">
            <Activity className="w-4 h-4 mr-3 text-primary opacity-60 animate-pulse" />
            Stock Coverage Days Remaining Trend Curve [Last 30-Day Snapshot Archive]
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)', fontWeight: 900}} axisLine={false} tickLine={false} />
                <YAxis label={{ value: 'Days Remaining', angle: -90, position: 'insideLeft', style: {fontSize: '9px', fill: 'var(--color-on-surface-dim)', fontWeight: 900} }} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-dim)', border: '1px solid var(--color-outline)', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                <Line type="monotone" dataKey="daysRemaining" name="Stock Days Remaining" stroke="var(--color-primary)" strokeWidth={3.5} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
};
