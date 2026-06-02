import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, LineChart, Line, Cell 
} from 'recharts';
import { 
  FileText, TrendingUp, Download, PieChart as PieIcon, 
  Activity, Clock, ShieldCheck, ArrowUpRight, Globe, Layers, CheckCircle
} from 'lucide-react';

// Structured mock sales data for segmenting with origin and destination
const SEGMENTED_SALES_DATA = [
  { airline: 'Emirates', aircraft: 'B777-300ER', route: 'DXB ➔ MLE ➔ DXB', volume: 4500000, revenue: 3800000, frequency: 'Daily' },
  { airline: 'Emirates', aircraft: 'A380-800', route: 'DXB ➔ MLE ➔ DXB', volume: 6200000, revenue: 5200000, frequency: 'Daily' },
  { airline: 'Qatar Airways', aircraft: 'B787-9', route: 'DOH ➔ MLE ➔ DOH', volume: 3200000, revenue: 2900000, frequency: 'Daily' },
  { airline: 'Qatar Airways', aircraft: 'A350-900', route: 'DOH ➔ MLE ➔ DOH', volume: 2800000, revenue: 2400000, frequency: 'Weekly' },
  { airline: 'Singapore Airlines', aircraft: 'A350-900', route: 'SIN ➔ MLE ➔ SIN', volume: 2800000, revenue: 2600000, frequency: 'Daily' },
  { airline: 'Singapore Airlines', aircraft: 'B787-10', route: 'SIN ➔ MLE ➔ SIN', volume: 1900000, revenue: 1700000, frequency: 'Weekly' },
  { airline: 'British Airways', aircraft: 'B777-200', route: 'LHR ➔ MLE ➔ LHR', volume: 1900000, revenue: 1800000, frequency: 'Weekly' },
  { airline: 'SriLankan Airlines', aircraft: 'A330-300', route: 'CMB ➔ MLE ➔ CMB', volume: 1500000, revenue: 1200000, frequency: 'Daily' },
  { airline: 'SriLankan Airlines', aircraft: 'A320neo', route: 'CMB ➔ MLE ➔ CMB', volume: 600000, revenue: 480000, frequency: 'Monthly' },
];

// Route Profitability (SITA AMS Active correlated data)
const ROUTE_PROFITABILITY = [
  { month: 'Jan', lhr: 4500, dxb: 5400, sin: 3400, doh: 4100 },
  { month: 'Feb', lhr: 3800, dxb: 6100, sin: 3900, doh: 4300 },
  { month: 'Mar', lhr: 5100, dxb: 9800, sin: 4200, doh: 5200 },
  { month: 'Apr', lhr: 4200, dxb: 7900, sin: 3100, doh: 4700 },
  { month: 'May', lhr: 4800, dxb: 8400, sin: 3700, doh: 4900 },
  { month: 'Jun', lhr: 5300, dxb: 9100, sin: 4500, doh: 5600 },
];

// Peak Day & Hour comparison YoY
const PEAK_DAY_DATA = [
  { period: 'Peak Day Volume (L)', currentYear: 685000, previousYear: 597000 },
  { period: 'Peak Hour Volume (L)', currentYear: 142000, previousYear: 124000 },
];

// Peak Hour vs Off-Peak Hour Sales Volume Comparison
const PEAK_HOUR_COMPARISON_DATA = [
  { grade: 'Jet A-1 (Aviation)', peakHour: 142000, offPeakHour: 38000 },
  { grade: 'Diesel (Gasoil)', peakHour: 8400, offPeakHour: 2100 },
  { grade: 'Petrol (Mogas)', peakHour: 5200, offPeakHour: 1300 },
];

export const CommercialReports: React.FC = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'granular' | 'peaks'>('granular');

  // Filters for Segmenting
  const [selectedFrequency, setSelectedFrequency] = useState<string>('ALL');
  const [segmentBy, setSegmentBy] = useState<'airline' | 'aircraft' | 'route'>('airline');

  // Dynamic aggregates for global top-level panel
  const totalVolume = useMemo(() => SEGMENTED_SALES_DATA.reduce((sum, item) => sum + item.volume, 0), []);
  const totalRevenue = useMemo(() => SEGMENTED_SALES_DATA.reduce((sum, item) => sum + item.revenue, 0), []);
  const activeContractsCount = useMemo(() => new Set(SEGMENTED_SALES_DATA.map(item => item.airline)).size, []);
  const activeSectorsCount = useMemo(() => new Set(SEGMENTED_SALES_DATA.map(item => item.route)).size, []);

  // Dynamic granular sales aggregation
  const processedSalesData = useMemo(() => {
    // Filter by frequency
    const filtered = SEGMENTED_SALES_DATA.filter(item => {
      if (selectedFrequency !== 'ALL' && item.frequency !== selectedFrequency) return false;
      return true;
    });

    // Group by segment
    const groupedMap: { [key: string]: { name: string; volume: number; revenue: number } } = {};
    
    filtered.forEach(item => {
      let key = '';
      if (segmentBy === 'airline') key = item.airline;
      else if (segmentBy === 'aircraft') key = item.aircraft;
      else key = item.route;

      if (!groupedMap[key]) {
        groupedMap[key] = { name: key, volume: 0, revenue: 0 };
      }
      groupedMap[key].volume += item.volume;
      groupedMap[key].revenue += item.revenue;
    });

    return Object.values(groupedMap).sort((a, b) => b.volume - a.volume);
  }, [selectedFrequency, segmentBy]);

  // Route specific metrics for SITA correlation
  const getRoutePerformanceDetails = (routeName: string) => {
    const details: { [key: string]: { carriers: string; avgUplift: string; dispatch: string; compliance: string } } = {
      'DXB ➔ MLE ➔ DXB': { carriers: 'Emirates', avgUplift: '83,200 L', dispatch: '99.8%', compliance: '100.0%' },
      'DOH ➔ MLE ➔ DOH': { carriers: 'Qatar Airways', avgUplift: '72,800 L', dispatch: '99.5%', compliance: '99.6%' },
      'SIN ➔ MLE ➔ SIN': { carriers: 'Singapore Airlines', avgUplift: '76,400 L', dispatch: '99.7%', compliance: '100.0%' },
      'LHR ➔ MLE ➔ LHR': { carriers: 'British Airways', avgUplift: '68,500 L', dispatch: '99.6%', compliance: '99.2%' },
      'CMB ➔ MLE ➔ CMB': { carriers: 'SriLankan Airlines', avgUplift: '35,400 L', dispatch: '99.4%', compliance: '98.5%' }
    };
    return details[routeName] || { carriers: 'Commercial Carriers', avgUplift: '55,000 L', dispatch: '99.5%', compliance: '99.0%' };
  };

  const COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', '#8884d8', '#ff7300', '#00C49F'];

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            COMMERCIAL <span className="text-primary italic font-medium ml-3">ANALYTICS</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: FINANCIAL SECTOR</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Contract Monitoring & Volume Intelligence</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-success uppercase tracking-[0.3em] flex items-center gap-1"><Activity className="w-3.5 h-3.5 animate-pulse text-success" /> SITA AMS ONLINE</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline shrink-0 overflow-hidden w-full max-w-[360px] shadow-inner">
          <div 
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
              ${activeTab === 'granular' ? 'left-1.5 translate-x-[0%]' : ''}
              ${activeTab === 'peaks' ? 'left-1.5 translate-x-[100%]' : ''}
            `}
          />
          <button 
            onClick={() => setActiveTab('granular')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'granular' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Granular Matrix
          </button>
          <button 
            onClick={() => setActiveTab('peaks')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              activeTab === 'peaks' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Peak Utilization YoY
          </button>
        </div>
      </div>

      {/* ── AGGREGATE COMMERCIAL SALES VOLUMES ROW ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary flex flex-col justify-between">
          <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Aggregate Sales Volume</span>
          <div>
            <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">{(totalVolume / 1000000).toFixed(1)}M L</span>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1 opacity-60">Total SITA Uplift Liters</p>
          </div>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-success flex flex-col justify-between">
          <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Total Contract Revenue</span>
          <div>
            <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">${(totalRevenue / 1000000).toFixed(1)}M USD</span>
            <p className="text-[9px] font-black text-success uppercase tracking-widest mt-1 opacity-60">Finance Billing Clearance</p>
          </div>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-warning flex flex-col justify-between">
          <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Active Sectors / Routes</span>
          <div>
            <span className="text-3xl font-[900] text-on-surface tracking-tighter italic font-mono">{activeSectorsCount} Sectors</span>
            <p className="text-[9px] font-black text-warning uppercase tracking-widest mt-1 opacity-60">Real-Time Correlated Flights</p>
          </div>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary flex flex-col justify-between bg-primary/5 border border-primary/20 shadow-premium">
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Fuel Dispatch Yield</span>
          <div>
            <span className="text-3xl font-[900] text-primary tracking-tighter italic font-mono">18.2% Margin</span>
            <p className="text-[9px] font-black text-on-surface-dim uppercase mt-1 opacity-50">Avg Net Commercial Spread</p>
          </div>
        </div>
      </div>

      {/* ── TAB 1: GRANULAR SALES MATRIX ── */}
      {activeTab === 'granular' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Reporting Frequency</label>
              <div className="relative flex bg-surface-dim p-1 rounded-2xl border border-outline overflow-hidden">
                <div 
                  className={`absolute top-1 bottom-1 w-[calc(25%-2px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                    ${selectedFrequency === 'ALL' ? 'left-1 translate-x-[0%]' : ''}
                    ${selectedFrequency === 'Daily' ? 'left-1 translate-x-[100%]' : ''}
                    ${selectedFrequency === 'Weekly' ? 'left-1 translate-x-[200%]' : ''}
                    ${selectedFrequency === 'Monthly' ? 'left-1 translate-x-[300%]' : ''}
                  `}
                />
                {['ALL', 'Daily', 'Weekly', 'Monthly'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setSelectedFrequency(f)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all relative z-10 ${
                      selectedFrequency === f ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2.5 tracking-widest opacity-45">Segment Dimension</label>
              <div className="relative flex bg-surface-dim p-1 rounded-2xl border border-outline overflow-hidden">
                <div 
                  className={`absolute top-1 bottom-1 w-[calc(33.333%-2.67px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                    ${segmentBy === 'airline' ? 'left-1 translate-x-[0%]' : ''}
                    ${segmentBy === 'aircraft' ? 'left-1 translate-x-[100%]' : ''}
                    ${segmentBy === 'route' ? 'left-1 translate-x-[200%]' : ''}
                  `}
                />
                {[
                  { id: 'airline', label: 'Operator' },
                  { id: 'aircraft', label: 'Type' },
                  { id: 'route', label: 'Route' }
                ].map(s => (
                  <button 
                    key={s.id}
                    onClick={() => setSegmentBy(s.id as any)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all relative z-10 ${
                      segmentBy === s.id ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Generate Button */}
            <div className="flex items-end justify-end">
              <button className="flex items-center px-8 py-4 kinetic-gradient text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all w-full md:w-auto shrink-0 border-none">
                <Download className="w-4 h-4 mr-3" />
                GENERATE AUDIT REPORT
              </button>
            </div>
          </div>

          {/* Aggregates Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Volume Breakdown chart */}
            <div className="card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center">
                <PieIcon className="w-4 h-4 mr-3 text-primary opacity-60" />
                Sales Segment Volume matrix (Liters)
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={processedSalesData} margin={{top: 5, right: 30, left: 45, bottom: 5}}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={90} tick={{fill: 'var(--color-on-surface)', fontSize: 9, fontWeight: 900}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'var(--color-surface-dim)', opacity: 0.3}} />
                    <Bar dataKey="volume" name="UPLIFT VOLUME (L)" fill="var(--color-primary)" radius={[0, 8, 8, 0]} barSize={20}>
                      {processedSalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Route Profitability matrix (Correlated to SITA AMS!) */}
            <div className="card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                <span className="flex items-center">
                  <TrendingUp className="w-4 h-4 mr-3 text-primary opacity-60" />
                  Route Profitability Sector Metrics
                </span>
                <span className="text-[8px] font-black px-2.5 py-1 rounded-md bg-success/15 text-success border border-success/20 uppercase tracking-widest">
                  SITA AMS Live Correlated
                </span>
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ROUTE_PROFITABILITY}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                    <Line type="monotone" dataKey="dxb" name="DXB ➔ MLE ➔ DXB" stroke="var(--color-primary)" strokeWidth={3.5} dot={false} />
                    <Line type="monotone" dataKey="doh" name="DOH ➔ MLE ➔ DOH" stroke="#8884d8" strokeWidth={3.5} dot={false} />
                    <Line type="monotone" dataKey="sin" name="SIN ➔ MLE ➔ SIN" stroke="var(--color-success)" strokeWidth={3.5} dot={false} />
                    <Line type="monotone" dataKey="lhr" name="LHR ➔ MLE ➔ LHR" stroke="var(--color-warning)" strokeWidth={3.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Matrix / Route performance table */}
          <div className="card-premium overflow-hidden">
            <div className="px-8 py-5 border-b border-outline bg-surface-dim/40 flex justify-between items-center">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary opacity-60" />
                {segmentBy === 'route' ? 'SITA Route Performance & Reliability Matrix' : 'Granular Commercial Sales Registry'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              {segmentBy === 'route' ? (
                /* ── SPECIALIZED ROUTE-BASED PERFORMANCE METRICS TABLE ── */
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-dim/60 border-b border-outline">
                      <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Flight Sector (Origin ➔ Dest)</th>
                      <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Integrated Carrier</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Avg. Uplift Per Flight</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Delay-Free Compliance</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">On-Time Dispatch Rate</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Aggregate Volume</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">SITA Hook</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {processedSalesData.map((row) => {
                      const routeInfo = getRoutePerformanceDetails(row.name);
                      return (
                        <tr key={row.name} className="hover:bg-primary/[0.01] transition-colors group">
                          <td className="px-8 py-4 text-xs font-black uppercase text-on-surface italic group-hover:text-primary transition-colors">{row.name}</td>
                          <td className="px-8 py-4 text-xs font-bold text-on-surface-dim">{routeInfo.carriers}</td>
                          <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{routeInfo.avgUplift}</td>
                          <td className="px-8 py-4 text-right font-mono text-xs font-bold text-success">{routeInfo.compliance}</td>
                          <td className="px-8 py-4 text-right font-mono text-xs font-black text-primary italic">{routeInfo.dispatch}</td>
                          <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{(row.volume / 1000).toFixed(1)}K L</td>
                          <td className="px-8 py-4 text-right">
                            <span className="text-[8px] font-black px-2.5 py-0.5 rounded-md bg-success/15 text-success border border-success/20 uppercase tracking-widest whitespace-nowrap">
                              Connected
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* ── STANDARD OPERATOR/AIRCRAFT MATRIX TABLE ── */
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-dim/60 border-b border-outline">
                      <th className="px-8 py-4 text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Segment Dimension</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Uplift Volume (L)</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Projected Revenue ($)</th>
                      <th className="px-8 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {processedSalesData.map((row) => (
                      <tr key={row.name} className="hover:bg-primary/[0.01] transition-colors group">
                        <td className="px-8 py-4 text-xs font-black uppercase text-on-surface italic group-hover:text-primary transition-colors">{row.name}</td>
                        <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">{(row.volume / 1000).toFixed(1)}K L</td>
                        <td className="px-8 py-4 text-right font-mono text-xs font-bold text-on-surface">${(row.revenue / 1000).toFixed(1)}K</td>
                        <td className="px-8 py-4 text-right">
                          <span className="text-[8px] font-black px-3 py-1 rounded-md bg-success/15 text-success border border-success/20 uppercase tracking-widest">
                            Active Contract
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PEAK UTILIZATION YoY GROWTH & HOURLY COMPARISONS ── */}
      {activeTab === 'peaks' && (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Peak Summary statistics */}
            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Peak Day analysis</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 mb-4">MLE peak operational Day</h3>
                <span className="text-2xl font-[900] text-primary italic font-mono uppercase tracking-tighter">JUNE 24, 2026</span>
              </div>
              <div className="pt-4 border-t border-outline/40 flex justify-between items-center text-[9px] font-black uppercase mt-4">
                <span className="text-on-surface-dim">YoY Peak Growth:</span>
                <span className="text-success flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +14.8% YoY
                </span>
              </div>
            </div>

            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-warning flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Peak Hour analysis</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 mb-4">MLE peak operational Hour</h3>
                <span className="text-2xl font-[900] text-warning italic font-mono uppercase tracking-tighter">14:00 - 15:00</span>
              </div>
              <div className="pt-4 border-t border-outline/40 flex justify-between items-center text-[9px] font-black uppercase mt-4">
                <span className="text-on-surface-dim">YoY Peak Growth:</span>
                <span className="text-success flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +14.5% YoY
                </span>
              </div>
            </div>

            <div className="card-premium p-6 lg:p-8 border-l-4 border-l-success flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Audit period</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 mb-4">Commercial growth delta</h3>
                <span className="text-2xl font-[900] text-success italic font-mono uppercase tracking-tighter">POS DRIFT COMPACT</span>
              </div>
              <div className="pt-4 border-t border-outline/40 flex justify-between items-center text-[9px] font-black uppercase mt-4">
                <span className="text-on-surface-dim">Reconciliation:</span>
                <span className="text-success flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* YoY Peak volume comparison bar chart */}
            <div className="card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-8 flex items-center">
                <Clock className="w-4 h-4 mr-3 text-primary opacity-60" />
                Peak Volume Comparison vs Previous Year (YoY Growth Trends)
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PEAK_DAY_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="period" tick={{fontSize: 10, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                    <Bar dataKey="currentYear" name="Current Year Peak Volume (L)" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="previousYear" name="Previous Year Peak Volume (L)" fill="var(--color-on-surface-dim)" opacity={0.3} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Hour vs Off-Peak Hour Sales Volume Comparison */}
            <div className="card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-8 flex items-center">
                <Activity className="w-4 h-4 mr-3 text-success opacity-60 animate-pulse" />
                Peak Hour vs Off-Peak Hour Sales Flow Rates
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PEAK_HOUR_COMPARISON_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="grade" tick={{fontSize: 10, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                    <Bar dataKey="peakHour" name="Peak Hour Flow Rate (L/Hr)" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="offPeakHour" name="Off-Peak Hour Flow Rate (L/Hr)" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};