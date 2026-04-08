
import React, { useState, useEffect } from 'react';
import { FlightLog, User, FlightJob } from '../types';
import { MOCK_JOBS, MOCK_USERS } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Lock } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';

interface IntoPlaneProps {
    user: User;
}

// --- UI Components ---

const MobileHeader: React.FC<{ user: User, isOnline: boolean, activeFlight: Partial<FlightLog> | null }> = ({ user, isOnline, activeFlight }) => (
  <div className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-30">
      <div className="flex justify-between items-center">
          <div>
              <h1 className="text-lg font-bold flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-aviation-500" />
                  R-045
              </h1>
              <p className="text-xs text-slate-400">Op: {user.name}</p>
          </div>
          <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-900 text-green-400 border border-green-700' : 'bg-orange-900 text-orange-400 border border-orange-700'}`}>
              {isOnline ? <Wifi className="w-3 h-3 mr-1"/> : <WifiOff className="w-3 h-3 mr-1"/>}
              {isOnline ? 'SYNCED' : 'OFFLINE'}
          </div>
      </div>
      {activeFlight && (
          <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center text-sm">
              <span className="font-mono text-aviation-400">{activeFlight.flightNumber}</span>
              <span className="text-slate-300">{activeFlight.stand}</span>
              <span className="bg-blue-900 px-2 py-0.5 rounded text-xs">{activeFlight.aircraftReg}</span>
          </div>
      )}
  </div>
);

const ScreenDashboard: React.FC<{ user: User, onStartJob: (job: FlightJob) => void }> = ({ user, onStartJob }) => (
  <div className="p-4 space-y-4 pb-24">
      <div className="flex justify-between items-center mb-2">
          <h2 className="text-slate-500 text-sm font-bold uppercase tracking-wide">Shift Schedule</h2>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{MOCK_JOBS.length} Flights</span>
      </div>
      
      {MOCK_JOBS.map((job) => {
          const isAssignedToMe = job.assignedTo === user.id;
          const assignee = MOCK_USERS.find(u => u.id === job.assignedTo);
          const assigneeName = assignee?.name || 'Unassigned';
          
          return (
              <div key={job.id} className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden relative ${isAssignedToMe ? 'border-l-aviation-500 ring-1 ring-aviation-100' : 'border-l-gray-300 opacity-80'}`}>
                  <div className="p-5">
                      <div className="flex justify-between items-center mb-4">
                          <div>
                              <div className="flex items-center space-x-2">
                                   <h3 className="text-2xl font-black text-slate-800">{job.flightNumber}</h3>
                                   <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600 border border-slate-200">{job.aircraftReg}</span>
                              </div>
                              <div className="flex items-center mt-1 text-slate-500 text-sm">
                                   <MapPin className="w-4 h-4 mr-1 text-aviation-500" />
                                   Stand {job.stand}
                                   <span className="mx-2 text-gray-300">|</span>
                                   <span className="text-xs">{job.aircraftType}</span>
                              </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                              job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                              job.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                              {job.status.replace('_', ' ')}
                          </span>
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                          <div className="flex items-center text-sm">
                              {isAssignedToMe ? (
                                  <div className="flex items-center text-aviation-700 font-bold bg-aviation-50 px-2 py-1 rounded-md">
                                      <UserIcon className="w-4 h-4 mr-2" />
                                      My Task
                                  </div>
                              ) : (
                                  <div className="flex items-center text-slate-400">
                                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mr-2 text-xs font-bold">
                                          {assigneeName.charAt(0)}
                                      </div>
                                      <span>{assigneeName}</span>
                                  </div>
                              )}
                          </div>
                          
                          <button 
                              onClick={() => onStartJob(job)}
                              disabled={!isAssignedToMe || job.status === 'COMPLETED'}
                              className={`px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center
                                  ${isAssignedToMe && job.status !== 'COMPLETED'
                                      ? 'bg-aviation-600 active:bg-aviation-700 text-white' 
                                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                  }
                              `}
                          >
                              {!isAssignedToMe ? <Lock className="w-4 h-4 mr-2" /> : null}
                              {job.status === 'COMPLETED' ? 'VIEW LOG' : (!isAssignedToMe ? 'LOCKED' : 'START JOB')}
                          </button>
                      </div>
                  </div>
              </div>
          );
      })}
  </div>
);

const ScreenTimestamps: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onTimestamp: (field: keyof FlightLog) => void, 
  onNext: () => void, 
  onBack: () => void 
}> = ({ activeFlight, onTimestamp, onNext, onBack }) => (
  <div className="p-4 flex flex-col h-full min-h-[calc(100vh-140px)]">
      <button onClick={onBack} className="flex items-center text-slate-500 mb-4 font-bold text-sm">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to List
      </button>
      <h2 className="text-slate-900 text-xl font-bold mb-6">Ramp Arrival & Setup</h2>
      
      <div className="space-y-6 flex-1">
          <button 
              onClick={() => onTimestamp('timestampPosition')}
              disabled={!!activeFlight?.timestampPosition}
              className={`w-full p-8 rounded-2xl border-4 text-left transition-all relative overflow-hidden group shadow-sm
                  ${activeFlight?.timestampPosition 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-white border-slate-200 active:border-aviation-500 active:bg-aviation-50'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Step 1</span>
                  <span className={`block text-2xl font-black ${activeFlight?.timestampPosition ? 'text-green-700' : 'text-slate-900'}`}>
                      LOG POSITION
                  </span>
                  {activeFlight?.timestampPosition && (
                      <span className="block mt-2 font-mono text-green-600 font-bold flex items-center">
                           <Clock className="w-4 h-4 mr-2"/>
                           {new Date(activeFlight.timestampPosition).toLocaleTimeString()}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampPosition && <Truck className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-active:text-aviation-200" />}
              {activeFlight?.timestampPosition && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-green-200" />}
          </button>

          <button 
              onClick={() => onTimestamp('timestampStart')}
              disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart}
              className={`w-full p-8 rounded-2xl border-4 text-left transition-all relative overflow-hidden group shadow-sm
                  ${activeFlight?.timestampStart 
                      ? 'bg-green-50 border-green-500' 
                      : !activeFlight?.timestampPosition
                          ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                          : 'bg-white border-slate-200 active:border-aviation-500 active:bg-aviation-50'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Step 2</span>
                  <span className={`block text-2xl font-black ${activeFlight?.timestampStart ? 'text-green-700' : 'text-slate-900'}`}>
                      COMMENCE FUELING
                  </span>
                   {activeFlight?.timestampStart && (
                      <span className="block mt-2 font-mono text-green-600 font-bold flex items-center">
                           <Clock className="w-4 h-4 mr-2"/>
                           {new Date(activeFlight.timestampStart).toLocaleTimeString()}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampStart && <Play className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-active:text-aviation-200" />}
              {activeFlight?.timestampStart && <CheckCircle className="absolute right-4 bottom-4 w-12 h-12 text-green-200" />}
          </button>
      </div>

      <button 
          onClick={onNext}
          disabled={!activeFlight?.timestampStart}
          className="mt-6 w-full bg-slate-900 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors shadow-lg"
      >
          Proceed to Metering <ChevronRight className="ml-2" />
      </button>
  </div>
);

const ScreenMetering: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onTimestamp: (field: keyof FlightLog) => void, 
  onInputChange: (field: keyof FlightLog, value: any) => void, 
  onNext: () => void, 
  onBack: () => void,
  showTopUp: boolean,
  setShowTopUp: (val: boolean) => void
}> = ({ activeFlight, onTimestamp, onInputChange, onNext, onBack, showTopUp, setShowTopUp }) => (
  <div className="p-4 flex flex-col h-full min-h-[calc(100vh-140px)]">
       <button onClick={onBack} className="flex items-center text-slate-500 mb-4 font-bold text-sm">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Timestamps
       </button>
       <h2 className="text-slate-900 text-xl font-bold mb-6">Metering & Volume</h2>

       <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Opening Totalizer</label>
              <input 
                  type="number" 
                  className="w-full text-3xl font-mono font-bold p-3 border-2 border-gray-300 rounded-lg focus:border-aviation-500 focus:ring-0 bg-white text-slate-900 placeholder:text-slate-300"
                  placeholder="000000"
                  value={activeFlight?.meterOpen || ''}
                  onChange={(e) => onInputChange('meterOpen', parseFloat(e.target.value))}
              />
          </div>

          <button 
              onClick={() => onTimestamp('timestampInitialEnd')}
              disabled={!activeFlight?.meterOpen || !!activeFlight?.timestampInitialEnd}
              className={`w-full p-4 rounded-xl border-2 font-bold flex items-center justify-center transition-colors
                  ${activeFlight?.timestampInitialEnd 
                      ? 'bg-green-100 border-green-500 text-green-800' 
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-gray-50'}`}
          >
              <Pause className="w-5 h-5 mr-2" />
              {activeFlight?.timestampInitialEnd ? `Initial End: ${new Date(activeFlight.timestampInitialEnd).toLocaleTimeString()}` : 'Log Initial End'}
          </button>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Closing Totalizer</label>
              <input 
                  type="number" 
                  className="w-full text-3xl font-mono font-bold p-3 border-2 border-gray-300 rounded-lg focus:border-aviation-500 focus:ring-0 bg-white text-slate-900 placeholder:text-slate-300"
                  placeholder="000000"
                  value={activeFlight?.meterClose || ''}
                  onChange={(e) => onInputChange('meterClose', parseFloat(e.target.value))}
              />
          </div>

          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-center">
               <span className="block text-xs font-bold text-slate-500 uppercase">Net Volume Delivered</span>
               <span className="block text-4xl font-black text-slate-900 mt-1">{activeFlight?.volume?.toLocaleString() || 0} L</span>
          </div>

          <div className="border-t border-slate-200 pt-4">
               <button onClick={() => setShowTopUp(!showTopUp)} className="text-aviation-600 font-bold text-sm flex items-center hover:text-aviation-800">
                   {showTopUp ? '- Remove Top-Up' : '+ Add Top-Up'}
               </button>
               {showTopUp && (
                   <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                       <button onClick={() => onTimestamp('timestampFinalStart')} className={`p-3 rounded-lg border font-bold text-sm ${activeFlight?.timestampFinalStart ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                           {activeFlight?.timestampFinalStart ? 'Started' : 'Final Start'}
                       </button>
                       <button onClick={() => onTimestamp('timestampFinalEnd')} className={`p-3 rounded-lg border font-bold text-sm ${activeFlight?.timestampFinalEnd ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                           {activeFlight?.timestampFinalEnd ? 'Ended' : 'Final End'}
                       </button>
                   </div>
               )}
          </div>
       </div>

       <div className="mt-auto pt-6">
          <button 
              onClick={onNext}
              disabled={!activeFlight?.meterClose}
              className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors shadow-lg"
          >
              Finalize & QC <ChevronRight className="ml-2" />
          </button>
       </div>
  </div>
);

const ScreenQC: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onInputChange: (field: keyof FlightLog, value: any) => void, 
  onSubmit: () => void, 
  onBack: () => void,
  loading: boolean
}> = ({ activeFlight, onInputChange, onSubmit, onBack, loading }) => (
  <div className="p-4 flex flex-col h-full min-h-[calc(100vh-140px)]">
       <button onClick={onBack} className="flex items-center text-slate-500 mb-4 font-bold text-sm">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Metering
       </button>
       <h2 className="text-slate-900 text-xl font-bold mb-6">JIG Compliance Checks</h2>

       <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {['panelCheck', 'walkAroundCheck', 'appearanceCheck', 'waterCheck'].map((check) => (
              <label key={check} className="flex items-center p-3 border border-gray-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input 
                      type="checkbox" 
                      checked={!!activeFlight?.[check as keyof FlightLog]} 
                      onChange={(e) => onInputChange(check as keyof FlightLog, e.target.checked)}
                      className="w-6 h-6 text-aviation-600 rounded focus:ring-aviation-500 border-gray-300"
                  />
                  <span className="ml-3 font-medium text-slate-700 capitalize">
                      {check.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
              </label>
          ))}
       </div>

       <div className="mt-auto pt-6 space-y-4">
           <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-sm text-yellow-800 flex items-start">
               <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
               <p>By submitting, you certify that all data is accurate and fuel was delivered according to safety regulations.</p>
           </div>
           
           <button 
              onClick={onSubmit}
              disabled={loading}
              className="w-full bg-aviation-600 text-white p-4 rounded-xl font-bold text-lg flex items-center justify-center hover:bg-aviation-700 shadow-lg disabled:opacity-70 transition-colors"
           >
              {loading ? 'Syncing...' : (
                  <>
                      <Save className="w-5 h-5 mr-2" />
                      Complete Job
                  </>
              )}
           </button>
       </div>
  </div>
);

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user }) => {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showTopUp, setShowTopUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const startJob = (job: FlightJob) => {
    setActiveFlight({
      flightNumber: job.flightNumber,
      aircraftReg: job.aircraftReg,
      aircraftType: job.aircraftType,
      stand: job.stand,
      operatorId: user.id,
      vehicleId: 'R-045',
      status: 'PENDING',
      meterOpen: undefined,
      volume: 0,
      panelCheck: false,
      walkAroundCheck: false,
      appearanceCheck: false,
      waterCheck: false,
    });
    setCurrentScreen('timestamps');
  };

  const handleTimestamp = (field: keyof FlightLog) => {
    setActiveFlight(prev => ({
      ...prev,
      [field]: new Date().toISOString()
    }));
  };

  const handleInputChange = (field: keyof FlightLog, value: any) => {
    setActiveFlight(prev => {
      const updated = { ...prev, [field]: value };
      if ((field === 'meterClose' || field === 'meterOpen') && updated.meterClose !== undefined && updated.meterOpen !== undefined) {
        updated.volume = (updated.meterClose as number) - (updated.meterOpen as number);
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!activeFlight) return;
    
    setLoading(true);
    try {
      const logToSave: Omit<FlightLog, 'id'> = {
        flightNumber: activeFlight.flightNumber || '',
        aircraftReg: activeFlight.aircraftReg || '',
        aircraftType: activeFlight.aircraftType || '',
        stand: activeFlight.stand || '',
        operatorId: user.id,
        vehicleId: activeFlight.vehicleId || 'R-045',
        status: 'COMPLETED',
        timestampArrived: activeFlight.timestampArrived,
        timestampPosition: activeFlight.timestampPosition,
        timestampStart: activeFlight.timestampStart,
        timestampInitialEnd: activeFlight.timestampInitialEnd,
        timestampFinalStart: activeFlight.timestampFinalStart,
        timestampFinalEnd: activeFlight.timestampFinalEnd,
        timestampClearance: activeFlight.timestampClearance || new Date().toISOString(),
        meterOpen: activeFlight.meterOpen,
        meterClose: activeFlight.meterClose,
        volume: activeFlight.volume || 0,
        panelCheck: activeFlight.panelCheck || false,
        walkAroundCheck: activeFlight.walkAroundCheck || false,
        appearanceCheck: activeFlight.appearanceCheck || false,
        waterCheck: activeFlight.waterCheck || false,
      };

      await supabaseService.createFlightLog(logToSave);
      
      alert("Job Completed & Synced to Supabase!");
      setActiveFlight(null);
      setCurrentScreen('dashboard');
    } catch (error) {
      console.error('Error saving flight log to Supabase:', error);
      alert('Failed to sync with Supabase. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
        <MobileHeader user={user} isOnline={isOnline} activeFlight={activeFlight} />
        <div className="flex-1 overflow-y-auto">
            {currentScreen === 'dashboard' && <ScreenDashboard user={user} onStartJob={startJob} />}
            {currentScreen === 'timestamps' && (
              <ScreenTimestamps 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onNext={() => setCurrentScreen('metering')}
                onBack={() => setCurrentScreen('dashboard')}
              />
            )}
            {currentScreen === 'metering' && (
              <ScreenMetering 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onInputChange={handleInputChange}
                onNext={() => setCurrentScreen('qc')}
                onBack={() => setCurrentScreen('timestamps')}
                showTopUp={showTopUp}
                setShowTopUp={setShowTopUp}
              />
            )}
            {currentScreen === 'qc' && (
              <ScreenQC 
                activeFlight={activeFlight} 
                onInputChange={handleInputChange}
                onSubmit={handleSubmit}
                onBack={() => setCurrentScreen('metering')}
                loading={loading}
              />
            )}
        </div>
    </div>
  );
};
