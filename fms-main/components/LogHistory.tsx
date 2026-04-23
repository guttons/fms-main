import React, { useState, useEffect } from 'react';
import { MOCK_USERS } from '../constants';
import { FileText, Search, Download, Filter } from 'lucide-react';
import { Logo } from './Logo';
import { supabaseService } from '../services/supabaseService';
import { FlightLog } from '../types';

export const LogHistory: React.FC = () => {
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const fetchedLogs = await supabaseService.getFlightLogs();
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('Error fetching logs from Firebase:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = (logs || []).filter(log => 
    log && (log.flightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.aircraftReg.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            OPERATION <span className="text-primary italic font-medium ml-3">ARCHIVE</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: TASK CONTROL</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Historical Engagement Audit</span>
          </div>
        </div>
        <div className="flex space-x-4 w-full md:w-auto">
             <div className="relative flex-1 md:w-72">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <input 
                    type="text" 
                    placeholder="SEARCH TASK REGISTRY..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                />
             </div>
             <button className="p-4 bg-surface-dim border border-outline rounded-2xl hover:bg-primary/5 transition-all text-on-surface-dim">
                <Filter className="w-5 h-5" />
             </button>
             <button className="flex items-center px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all">
                <Download className="w-4 h-4 mr-3" />
                EXPORT CSV
             </button>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="p-32 flex flex-col items-center justify-center">
            <Logo className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(1,155,201,0.5)] mb-6" />
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em] opacity-40 animate-pulse">Syncing Archive Database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-dim/50 border-b border-outline">
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Timestamp</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Flight ID</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Tactical Operator</th>
                  <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Volume (L)</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Deployment Status</th>
                  <th className="px-10 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Registry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-10 py-20 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Zero matches in historical database</td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                      const operatorName = MOCK_USERS.find(u => u.id === log.operatorId)?.name || 'Unknown';
                      return (
                        <tr key={log.id} className="hover:bg-primary/[0.02] transition-colors group">
                          <td className="px-10 py-6 text-[11px] font-black text-on-surface-dim font-mono tracking-widest uppercase">
                              {log.timestampStart ? new Date(log.timestampStart).toLocaleString() : 'PENDING SYNC'}
                          </td>
                          <td className="px-10 py-6">
                              <div className="text-sm font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.flightNumber}</div>
                              <div className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest mt-1">{log.aircraftReg} ({log.aircraftType})</div>
                          </td>
                          <td className="px-10 py-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                              {operatorName}
                          </td>
                          <td className="px-10 py-6 text-right text-sm font-black text-on-surface-dim font-mono tracking-tighter">
                              {log.volume.toLocaleString()}
                          </td>
                          <td className="px-10 py-6">
                              <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border uppercase tracking-[0.2em] shadow-sm ${
                                  log.status === 'COMPLETED' 
                                  ? 'bg-success/10 text-success border-success/20' 
                                  : 'bg-warning/10 text-warning border-warning/20'
                              }`}>
                                  {log.status}
                              </span>
                          </td>
                          <td className="px-10 py-6 text-right">
                              <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all">DETAILS</button>
                          </td>
                        </tr>
                      );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
