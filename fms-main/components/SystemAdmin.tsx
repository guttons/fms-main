import React from 'react';
import { Settings, Users, Server, ShieldCheck, Activity, Database, AlertCircle } from 'lucide-react';
import { MOCK_USERS } from '../constants';

export const SystemAdmin: React.FC = () => {
  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            SYSTEM <span className="text-primary italic font-medium ml-3">ADMINISTRATION</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Platform Integrity Center</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">All services synchronized</span>
          </div>
        </div>
        <div className="flex items-center space-x-3 bg-success/10 text-success px-6 py-3 rounded-2xl border border-success/20 font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.05)]">
           <Activity className="w-4 h-4 animate-pulse" />
           <span>System Status: OPERATIONAL</span>
        </div>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="card-premium p-8 flex items-center justify-between group transition-all hover:scale-[1.02]">
           <div>
              <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Database Integrity</p>
              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">CONNECTED</h3>
              <p className="text-[10px] font-black text-success mt-2 flex items-center">
                 <div className="w-1.5 h-1.5 bg-success rounded-full mr-2 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                 LATENCY: 24MS
              </p>
           </div>
           <div className="p-4 bg-surface-dim rounded-2xl border border-outline group-hover:border-primary/30 transition-all">
              <Database className="w-8 h-8 text-primary opacity-60" />
           </div>
        </div>
        
        <div className="card-premium p-8 flex items-center justify-between group transition-all hover:scale-[1.02]">
           <div>
              <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Sync Gateway</p>
              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">ACTIVE</h3>
              <p className="text-[10px] font-black text-on-surface-dim mt-2 opacity-60 uppercase tracking-widest">Last ping: 2s ago</p>
           </div>
           <div className="p-4 bg-surface-dim rounded-2xl border border-outline group-hover:border-primary/30 transition-all">
              <Server className="w-8 h-8 text-primary opacity-60" />
           </div>
        </div>

        <div className="card-premium p-8 flex items-center justify-between group transition-all hover:scale-[1.02]">
           <div>
              <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Security Perimeter</p>
              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">SECURE</h3>
              <p className="text-[10px] font-black text-on-surface-dim mt-2 opacity-60 uppercase tracking-widest">Protocol: SHIELD-X</p>
           </div>
           <div className="p-4 bg-surface-dim rounded-2xl border border-outline group-hover:border-primary/30 transition-all">
              <ShieldCheck className="w-8 h-8 text-primary opacity-60" />
           </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-surface rounded-3xl border border-outline overflow-hidden shadow-sm">
         <div className="px-8 py-6 border-b border-outline flex justify-between items-center bg-surface-dim/30">
            <div>
               <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                  <Users className="w-4 h-4 mr-3 text-primary opacity-60" />
                  PERSOnnel PROTOCOL
               </h3>
            </div>
            <button className="px-6 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-premium hover:scale-105 active:scale-95 transition-all">
               NEW OPERATOR
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline">
               <thead className="bg-surface-dim">
                  <tr>
                     <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">OPERATOR IDENTITY</th>
                     <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">CLEARANCE LEVEL</th>
                     <th className="px-8 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">LOGIN STATUS</th>
                     <th className="px-8 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">COMMANDS</th>
                  </tr>
               </thead>
               <tbody className="bg-surface divide-y divide-outline">
                  {MOCK_USERS.map((user) => (
                     <tr key={user.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-8 py-6 whitespace-nowrap">
                           <div className="flex items-center">
                              <div className="relative">
                                 <img className="h-10 w-10 rounded-2xl border border-outline object-cover shadow-sm group-hover:border-primary/30 transition-all" src={user.avatar} alt="" />
                                 <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-surface shadow-sm"></div>
                              </div>
                              <div className="ml-5">
                                 <div className="text-sm font-black text-on-surface uppercase tracking-tight">{user.name}</div>
                                 <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{user.id}</div>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                           <span className="px-4 py-1.5 inline-flex text-[9px] font-black rounded-xl bg-surface-dim text-on-surface-dim border border-outline uppercase tracking-widest">
                              {user.role}
                           </span>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap">
                           <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[9px] font-black bg-success/10 text-success border border-success/20 uppercase tracking-widest">
                              AUTHORIZED
                           </span>
                        </td>
                        <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                           <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-widest mr-6 transition-all">EDIT</button>
                           <button className="text-[10px] font-black text-error/60 hover:text-error uppercase tracking-widest transition-all">REVOKE</button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Recent System Alerts */}
      <div className="card-premium overflow-hidden">
         <div className="px-8 py-6 border-b border-outline bg-surface-dim/30">
             <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <AlertCircle className="w-4 h-4 mr-3 text-on-surface-dim opacity-40" />
                 Tactical Audit Log
             </h3>
         </div>
         <div className="p-8">
             <div className="space-y-6">
                 {[
                     { msg: 'Unauthorized bridge attempt from sector 192.168.1.105', time: '10 MINS AGO', severity: 'high' },
                     { msg: 'Personnel provisioned: Commercial Analyst (u6)', time: '2 HOURS AGO', severity: 'low' },
                     { msg: 'Primary datastore backup sequence complete', time: '6 HOURS AGO', severity: 'low' }
                 ].map((log, i) => (
                     <div key={i} className="flex items-start group">
                         <div className={`w-1.5 h-6 rounded-full mr-5 ${log.severity === 'high' ? 'bg-error shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'bg-primary/40'}`}></div>
                         <div className="flex-1">
                             <p className="text-sm text-on-surface font-black uppercase tracking-tight group-hover:text-primary transition-colors">{log.msg}</p>
                             <p className="text-[10px] font-black text-on-surface-dim opacity-30 mt-1 uppercase tracking-widest">{log.time}</p>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
};