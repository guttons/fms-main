import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { FileText, TrendingUp, Download, PieChart as PieIcon } from 'lucide-react';

const SALES_DATA = [
  { airline: 'Emirates', volume: 450000, revenue: 380000 },
  { airline: 'Qatar', volume: 320000, revenue: 290000 },
  { airline: 'Singapore', volume: 280000, revenue: 260000 },
  { airline: 'British', volume: 190000, revenue: 180000 },
  { airline: 'SriLankan', volume: 150000, revenue: 120000 },
];

const ROUTE_PROFITABILITY = [
    { name: 'Jan', lhr: 4000, dxb: 2400, sin: 2400 },
    { name: 'Feb', lhr: 3000, dxb: 1398, sin: 2210 },
    { name: 'Mar', lhr: 2000, dxb: 9800, sin: 2290 },
    { name: 'Apr', lhr: 2780, dxb: 3908, sin: 2000 },
    { name: 'May', lhr: 1890, dxb: 4800, sin: 2181 },
    { name: 'Jun', lhr: 2390, dxb: 3800, sin: 2500 },
];

export const CommercialReports: React.FC = () => {
  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            COMMERCIAL <span className="text-primary italic font-medium ml-3">ANALYTICS</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: FINANCIAL SECTOR</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Sales Volume & Revenue Intelligence</span>
          </div>
        </div>
        <button className="flex items-center px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all">
            <Download className="w-4 h-4 mr-3" />
            GENERATE REVENUE AUDIT
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Top Carrier Analysis */}
          <div className="card-premium p-10">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                   <PieIcon className="w-4 h-4 mr-3 text-primary opacity-40" />
                   Carrier Volume [MTD]
                </h3>
             </div>
             <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={SALES_DATA} margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-outline-dim)" />
                        <XAxis type="number" hide />
                        <YAxis 
                           dataKey="airline" 
                           type="category" 
                           width={80} 
                           tick={{fill: 'var(--color-on-surface)', fontSize: 10, fontWeight: 900}} 
                           axisLine={false} 
                           tickLine={false} 
                        />
                        <Tooltip 
                           cursor={{fill: 'var(--color-surface-dim)', opacity: 0.5}} 
                           contentStyle={{
                              backgroundColor: 'var(--color-surface-dim)', 
                              color: 'var(--color-on-surface)', 
                              borderRadius: '24px', 
                              border: '1px solid var(--color-outline)',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              fontSize: '10px',
                              padding: '16px'
                           }} 
                        />
                        <Bar dataKey="volume" fill="var(--color-primary)" radius={[0, 12, 12, 0]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Route Performance */}
          <div className="card-premium p-10">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                   <TrendingUp className="w-4 h-4 mr-3 text-primary" />
                   Sector Profitability
                </h3>
             </div>
             <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ROUTE_PROFITABILITY}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                        <XAxis 
                           dataKey="name" 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}} 
                           dy={10}
                        />
                        <YAxis 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}} 
                        />
                        <Tooltip 
                           contentStyle={{
                              backgroundColor: 'var(--color-surface-dim)', 
                              color: 'var(--color-on-surface)', 
                              borderRadius: '24px', 
                              border: '1px solid var(--color-outline)',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              fontSize: '10px',
                              padding: '16px'
                           }} 
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} iconType="circle" />
                        <Line type="monotone" dataKey="lhr" name="LHR" stroke="var(--color-primary)" strokeWidth={4} dot={false} animationDuration={2000} />
                        <Line type="monotone" dataKey="dxb" name="DXB" stroke="var(--color-warning)" strokeWidth={4} dot={false} animationDuration={2000} />
                        <Line type="monotone" dataKey="sin" name="SIN" stroke="var(--color-success)" strokeWidth={4} dot={false} animationDuration={2000} />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      {/* Detailed Table */}
      <div className="card-premium overflow-hidden">
         <div className="px-10 py-8 border-b border-outline bg-surface-dim/30">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
               <FileText className="w-4 h-4 mr-3 text-primary opacity-60" />
               Carrier Intelligence Matrix
            </h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full">
               <thead>
                  <tr className="bg-surface-dim/50 border-b border-outline">
                     <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Tactical Carrier</th>
                     <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Uplift Volume (L)</th>
                     <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Projected Revenue ($)</th>
                     <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Performance Delta</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-outline">
                  {SALES_DATA.map((row, idx) => (
                      <tr key={idx} className="hover:bg-primary/[0.02] transition-colors group">
                          <td className="px-10 py-6 text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{row.airline}</td>
                          <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">{(row.volume / 1000).toFixed(1)}K</td>
                          <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">${(row.revenue / 1000).toFixed(1)}K</td>
                          <td className="px-10 py-6 text-right">
                              <span className="text-[9px] font-black px-4 py-1.5 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em] shadow-sm">
                                 +4.2% YOY
                              </span>
                          </td>
                      </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};