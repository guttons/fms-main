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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
       <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <TrendingUp className="w-6 h-6 mr-3 text-aviation-600" />
            Commercial & Sales Analytics
          </h2>
          <p className="text-slate-500">Sales volume, revenue analysis, and carrier performance</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-aviation-600 text-white rounded-lg font-bold hover:bg-aviation-700 shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export Full Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Carrier Analysis */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Top Carriers by Volume (MTD)</h3>
                <PieIcon className="w-5 h-5 text-slate-400" />
             </div>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={SALES_DATA} margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="airline" type="category" width={80} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                        <Bar dataKey="volume" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Route Performance */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">Sales Trend by Route</h3>
                <TrendingUp className="w-5 h-5 text-slate-400" />
             </div>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ROUTE_PROFITABILITY}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                        <Legend />
                        <Line type="monotone" dataKey="lhr" name="LHR (London)" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="dxb" name="DXB (Dubai)" stroke="#f59e0b" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="sin" name="SIN (Singapore)" stroke="#10b981" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
               <FileText className="w-5 h-5 mr-2 text-slate-500" />
               Monthly Carrier Performance Details
            </h3>
         </div>
         <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
               <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Airline</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Uplift Volume (L)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Est. Revenue ($)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">MoM Growth</th>
               </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
               {SALES_DATA.map((row, idx) => (
                   <tr key={idx} className="hover:bg-gray-50">
                       <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{row.airline}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-mono">{row.volume.toLocaleString()}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-mono">${row.revenue.toLocaleString()}</td>
                       <td className="px-6 py-4 whitespace-nowrap text-right">
                           <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded-full">+4.2%</span>
                       </td>
                   </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};