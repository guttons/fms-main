import React, { useState, useEffect } from 'react';
import { MOCK_USERS } from '../constants';
import { FileText, Search, Download, Filter, Loader2 } from 'lucide-react';
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

  const filteredLogs = logs.filter(log => 
    log.flightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.aircraftReg.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-3 text-aviation-600" />
            Operation Logs
          </h2>
          <p className="text-slate-500">Historical records of fueling operations</p>
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search Flight No..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aviation-500 bg-white text-slate-900"
                />
             </div>
             <button className="p-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-slate-600">
                <Filter className="w-5 h-5" />
             </button>
             <button className="flex items-center px-4 py-2 bg-aviation-600 text-white rounded-lg font-medium hover:bg-aviation-700 shadow-sm text-sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
             </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-aviation-600 animate-spin mb-2" />
            <p className="text-slate-500">Loading logs from Firebase...</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Flight</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Operator</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Volume (L)</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">View</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">No logs found</td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                    const operatorName = MOCK_USERS.find(u => u.id === log.operatorId)?.name || 'Unknown';
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {log.timestampStart ? new Date(log.timestampStart).toLocaleString() : 'Pending'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{log.flightNumber}</div>
                            <div className="text-xs text-slate-500">{log.aircraftReg} ({log.aircraftType})</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {operatorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-medium text-slate-700">
                            {log.volume.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                                log.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                                {log.status}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button className="text-aviation-600 hover:text-aviation-900 font-bold">Details</button>
                        </td>
                      </tr>
                    );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
