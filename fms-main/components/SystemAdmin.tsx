import React from 'react';
import { Settings, Users, Server, ShieldCheck, Activity, Database, AlertCircle } from 'lucide-react';
import { MOCK_USERS } from '../constants';

export const SystemAdmin: React.FC = () => {
  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <Settings className="w-6 h-6 mr-3 text-aviation-600" />
                System Administration
            </h2>
            <p className="text-slate-500">Platform configuration, user provisioning, and health monitoring</p>
         </div>
         <div className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 font-medium text-sm">
            <Activity className="w-4 h-4" />
            <span>All Systems Operational</span>
         </div>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Database Status</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Connected</h3>
              <p className="text-xs text-green-600 mt-1">Latency: 24ms</p>
           </div>
           <div className="p-3 bg-blue-50 rounded-full">
              <Database className="w-6 h-6 text-blue-600" />
           </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Sync Gateway</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Active</h3>
              <p className="text-xs text-slate-400 mt-1">Last sync: 2s ago</p>
           </div>
           <div className="p-3 bg-purple-50 rounded-full">
              <Server className="w-6 h-6 text-purple-600" />
           </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
           <div>
              <p className="text-sm font-medium text-slate-500">Security Audit</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Passed</h3>
              <p className="text-xs text-slate-400 mt-1">Last scan: 24h ago</p>
           </div>
           <div className="p-3 bg-green-50 rounded-full">
              <ShieldCheck className="w-6 h-6 text-green-600" />
           </div>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
               <Users className="w-5 h-5 mr-2 text-aviation-600" />
               User Provisioning
            </h3>
            <button className="px-4 py-2 bg-aviation-600 text-white rounded-lg text-sm font-bold hover:bg-aviation-700">
               + Add User
            </button>
         </div>
         <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                  <tr>
                     <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                     <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                     <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                  {MOCK_USERS.map((user) => (
                     <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex items-center">
                              <img className="h-8 w-8 rounded-full" src={user.avatar} alt="" />
                              <div className="ml-4">
                                 <div className="text-sm font-medium text-slate-900">{user.name}</div>
                                 <div className="text-xs text-slate-500">{user.id}</div>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800">
                              {user.role}
                           </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                           </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                           <button className="text-aviation-600 hover:text-aviation-900 mr-4">Edit</button>
                           <button className="text-red-600 hover:text-red-900">Revoke</button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Recent System Alerts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
         <div className="p-6 border-b border-gray-100">
             <h3 className="text-lg font-bold text-slate-900 flex items-center">
                 <AlertCircle className="w-5 h-5 mr-2 text-slate-500" />
                 Audit Log & Security Alerts
             </h3>
         </div>
         <div className="p-6">
             <div className="space-y-4">
                 {[
                     { msg: 'Failed login attempt from IP 192.168.1.105', time: '10 mins ago', severity: 'high' },
                     { msg: 'User provisioned: Commercial Analyst (u6)', time: '2 hours ago', severity: 'low' },
                     { msg: 'System backup completed successfully', time: '6 hours ago', severity: 'low' }
                 ].map((log, i) => (
                     <div key={i} className="flex items-start">
                         <div className={`w-2 h-2 mt-2 rounded-full mr-3 ${log.severity === 'high' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                         <div>
                             <p className="text-sm text-slate-800 font-medium">{log.msg}</p>
                             <p className="text-xs text-slate-400">{log.time}</p>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
};