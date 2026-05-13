import React, { useState, useEffect } from 'react';
import { FlightLog, User, FlightJob, Equipment, EquipmentStatus } from '../types';
import { MOCK_JOBS, MOCK_USERS, MOCK_DOMESTIC_FLIGHTS } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Lock } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { equipmentBadgeClass, equipmentDotClass } from '../utils/equipmentColors';
import { useNotification } from '../context/NotificationContext';

import { useOperationalData } from '../context/OperationalDataContext';

interface IntoPlaneProps {
    user: User;
    initialJob?: FlightJob | null;
    onClearInitialJob?: () => void;
}


// --- UI Components ---


const MobileHeader: React.FC<{ 
    user: User, 
    isOnline: boolean, 
    activeFlight: Partial<FlightLog> | null,
    selectedVehicleId: string,
    setSelectedVehicleId: (id: string) => void,
    equipment: Equipment[]
}> = ({ user, isOnline, activeFlight, selectedVehicleId, setSelectedVehicleId, equipment }) => (
  <div className="bg-surface-container-lowest-container text-on-surface p-4 border-b border-outline sticky top-0 z-30 transition-colors shadow-sm flex items-center justify-between gap-3 overflow-hidden">
      <div className="flex items-center flex-1 min-w-0">
          <Truck className="w-5 h-5 mr-3 text-primary animate-pulse flex-shrink-0" />
          
          <div className="flex items-center flex-shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80 leading-none mr-3 hidden sm:block">Unit</span>
              
              {activeFlight && (
                  <div className="md:hidden flex items-center h-[30px]">
                      <span className="bg-surface-container-low border-transparent rounded-lg px-2.5 py-1 text-[11px] font-black text-on-surface opacity-60 uppercase tracking-widest leading-none">
                          {activeFlight.vehicleId}
                      </span>
                  </div>
              )}

              <div className={`relative w-full ${activeFlight ? 'hidden md:block' : 'block'}`}>
                  <select 
                      value={activeFlight?.vehicleId || selectedVehicleId}
                      disabled={!!activeFlight}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className="bg-surface-container-highest border border-outline rounded-lg py-2 pl-3 pr-8 text-[12px] font-bold text-on-surface shadow-sm appearance-none focus:border-primary transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[140px]"
                  >
                       {equipment
                         .filter(eq => (eq.id.startsWith('RF') || eq.id.startsWith('HD')) && (eq.status === EquipmentStatus.AVAILABLE || eq.id === selectedVehicleId))
                         .map(eq => (
                          <option key={eq.id} value={eq.id} className="text-on-surface bg-surface-container-low">{eq.id} - {eq.type}</option>
                      ))}
                  </select>
                  <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim rotate-90 pointer-events-none" />
              </div>
          </div>

          {activeFlight && (
              <div className="flex flex-col md:flex-row md:items-center justify-center ml-3 pl-3 border-l border-outline min-w-0 flex-1">
                  <span className="text-xl font-[900] text-primary tracking-tighter leading-none mb-1 md:mb-0 md:mr-3 flex-shrink-0">{activeFlight.flightNumber}</span>
                  <span className="text-[11px] font-black text-on-surface-dim uppercase tracking-widest truncate">
                      <span className="text-on-surface">{activeFlight.stand}</span>
                      {activeFlight.aircraftType && <span className="mx-1.5 opacity-50">•</span>}
                      {activeFlight.aircraftType && <span className="text-on-surface">{activeFlight.aircraftType}</span>}
                      {activeFlight.aircraftReg && <span className="mx-1.5 opacity-50">•</span>}
                      {activeFlight.aircraftReg && <span className="text-primary">{activeFlight.aircraftReg}</span>}
                  </span>
              </div>
          )}
      </div>

      <div className="flex items-center flex-shrink-0 ml-1">
          <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} title={isOnline ? 'Synced' : 'Offline'}></div>
      </div>
  </div>
);

const ScreenDashboard: React.FC<{ 
    user: User, 
    onStartJob: (job: FlightJob) => void,
    selectedVehicleId: string,
    setSelectedVehicleId: (id: string) => void
}> = ({ user, onStartJob }) => {
  const { flightJobs, domesticFlights } = useOperationalData();
  const [viewMode, setViewMode] = useState<'INT' | 'DOM'>('INT');
  
  const intlJobs = flightJobs || [];
  const domesticJobs = (domesticFlights || []).map((df: any) => ({
      id: df.id,
      flightNumber: df.flightNumber,
      aircraftReg: df.aircraftReg,
      aircraftType: df.aircraftType,
      stand: df.stand,
      sta: df.sta,
      eta: df.eta,
      std: df.std,
      assignedTo: df.assignedTeam === 'Team 1' ? user.id : 'u1',
      status: df.status as any,
  }));



  const activeJobs = viewMode === 'INT' ? intlJobs : domesticJobs;

  const isDelayed = (sta?: string, eta?: string) => {
      if (!sta || !eta) return false;
      return eta > sta;
  };

  const renderJobCard = (job: FlightJob) => {
      const isAssignedToMe = job.assignedTo === user.id;
      const assignee = MOCK_USERS.find(u => u.id === job.assignedTo);
      const assigneeName = assignee?.name || 'Unassigned';
      const delayed = isDelayed(job.sta, job.eta);
      
      const displayStatus = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
      
      return (
          <div key={job.id} className={`bg-surface-container-lowest p-6 rounded-2xl relative overflow-hidden transition-all shrink-0 border ${isAssignedToMe ? 'border-primary border-l-[6px] shadow-sm' : 'border-outline opacity-80'}`}>
              <div className="relative z-10">
                  <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                      <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                               <h3 className="text-2xl sm:text-3xl font-[900] text-on-surface tracking-tighter truncate">{job.flightNumber}</h3>
                               {job.vehicleId && job.status !== 'PENDING' && (
                                   <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border shadow-sm animate-in fade-in zoom-in-95 duration-500 shrink-0 ${equipmentBadgeClass(job.vehicleId)}`}>
                                       <Truck className="w-3 h-3" />
                                       <span className="text-[9px] font-black uppercase tracking-widest leading-none">{job.vehicleId}</span>
                                   </div>
                               )}
                          </div>
                          <div className="flex flex-wrap items-center mt-2 text-on-surface-dim text-[11px] sm:text-[12px] font-bold gap-x-2.5 gap-y-1.5">
                               <div className="flex items-center whitespace-nowrap">
                                   <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary opacity-60 shrink-0" />
                                   <span>Stand {job.stand}</span>
                               </div>
                               <span className="opacity-20 shrink-0">|</span>
                               <span className="opacity-60 whitespace-nowrap">{job.aircraftType}</span>
                               <span className="opacity-20 shrink-0">|</span>
                               <span className="bg-surface-container-low px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-on-surface-dim border-transparent uppercase tracking-wider whitespace-nowrap">{job.aircraftReg}</span>
                               <span className="opacity-20 shrink-0">|</span>
                               <div className="flex items-center text-on-surface-dim font-bold">
                                   <div className="w-5 h-5 rounded-md bg-surface-container-low border-transparent flex items-center justify-center mr-2 text-[10px] font-black">
                                       {assigneeName.charAt(0)}
                                   </div>
                                   <span className="text-[11px] uppercase tracking-tight">{assigneeName}</span>
                               </div>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                           <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/50 px-4 py-2.5 rounded-xl">
                               <div className="flex items-center gap-2">
                                   <span className="opacity-40">STA</span>
                                   <span className="text-on-surface text-xs font-[900] tracking-tight">{job.sta || '--:--'}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                   <span className="text-primary opacity-60">ETA</span>
                                   <span className={`${delayed ? 'text-error' : 'text-primary'} text-xs font-[900] tracking-tight transition-colors`}>{job.eta || '--:--'}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                   <span className="text-warning opacity-60">STD</span>
                                   <span className="text-warning text-xs font-[900] tracking-tight">{job.std || '--:--'}</span>
                               </div>
                           </div>
                           <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border shrink-0 text-center whitespace-nowrap ${
                               displayStatus === 'COMPLETED' ? 'bg-success/10 text-success border-success/10' : 
                               displayStatus === 'DELAYED' ? 'bg-error/10 text-error border-error/10 animate-pulse' :
                               displayStatus === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/10 animate-pulse' : 'bg-surface-container-low text-on-surface-dim border-outline'
                           }`}>
                               {displayStatus.replace('_', ' ')}
                           </span>
                      </div>
                  </div>

                   {/* Flight Times Display (Mobile Only) */}
                   <div className="md:hidden grid grid-cols-3 gap-2 mb-6 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/50 p-3 rounded-xl border-transparent">
                       <div className="flex flex-col">
                           <span className="opacity-40 mb-1">STA</span>
                           <span className="text-on-surface text-sm font-[900] tracking-tight">{job.sta || '--:--'}</span>
                       </div>
                       <div className="flex flex-col">
                           <span className="opacity-40 mb-1 text-primary">ETA</span>
                           <span className={`${delayed ? 'text-error' : 'text-primary'} text-sm font-[900] tracking-tight transition-colors`}>{job.eta || '--:--'}</span>
                       </div>
                       <div className="flex flex-col">
                           <span className="opacity-40 mb-1 text-warning">STD</span>
                           <span className="text-warning text-sm font-[900] tracking-tight">{job.std || '--:--'}</span>
                       </div>
                   </div>
                  
                  <div className="flex justify-between items-center border-t border-outline pt-6">
                      <div className="flex items-center">
                          {isAssignedToMe && (
                              <div className="flex items-center justify-center text-primary bg-primary/10 w-10 h-10 rounded-xl border border-primary/20" title="My Task">
                                  <UserIcon className="w-5 h-5" />
                              </div>
                          )}
                      </div>
                      
                      <button 
                          onClick={() => onStartJob(job)}
                          disabled={!isAssignedToMe || job.status === 'COMPLETED'}
                          className={`px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm transition-all flex items-center justify-center
                              ${isAssignedToMe && job.status !== 'COMPLETED'
                                  ? 'kinetic-gradient hover:scale-[1.05] active:scale-95 shadow-premium' 
                                  : 'bg-surface-container-low text-on-surface-dim opacity-40 cursor-not-allowed border-transparent'
                              }
                          `}
                      >
                          {job.status === 'COMPLETED' ? 'VIEW LOG' : (!isAssignedToMe ? <Lock className="w-4 h-4" /> : 'START JOB')}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="p-5 flex flex-col space-y-8 pb-24">
      {/* Category Toggle */}
      <div className="flex justify-center mt-2 mb-4">
          <div className="bg-surface-container-low p-1.5 rounded-[22px] border-transparent flex relative w-full max-w-[320px] shadow-inner">
              <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] kinetic-gradient rounded-[18px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium ${viewMode === 'DOM' ? 'translate-x-full' : 'translate-x-0'}`}
              />
              <button 
                  onClick={() => setViewMode('INT')}
                  className={`flex-1 py-3 px-6 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'INT' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  International
              </button>
              <button 
                  onClick={() => setViewMode('DOM')}
                  className={`flex-1 py-3 px-6 rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'DOM' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  Domestic
              </button>
          </div>
      </div>

      <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
              <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
                  {viewMode === 'INT' ? 'International Operations' : 'Domestic Operations'}
              </h2>
              <span className="text-[10px] font-black bg-primary/5 text-primary px-3 py-1 rounded-full border border-primary/10">{activeJobs.length} Flights</span>
          </div>
          <div className="flex flex-col space-y-4">
              {activeJobs.map(renderJobCard)}
          </div>
      </div>
    </div>
  );
};

const ScreenTimestamps: React.FC<{ 
  activeFlight: Partial<FlightLog> | null, 
  onTimestamp: (field: keyof FlightLog) => void, 
  onNext: () => void, 
  onBack: () => void 
}> = ({ activeFlight, onTimestamp, onNext, onBack }) => (
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
      <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Schedule
      </button>
      <h2 className="text-on-surface text-2xl font-black mb-8 tracking-tighter uppercase">Ramp Arrival <span className="text-primary italic">& Setup</span></h2>
      
      <div className="space-y-6 flex-1">
          <button 
              onClick={() => onTimestamp('timestampPosition')}
              disabled={!!activeFlight?.timestampPosition}
              className={`w-full p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group shadow-ambient
                  ${activeFlight?.timestampPosition 
                      ? 'bg-success/5 border-success text-on-surface' 
                      : 'bg-surface-container-lowest-container border-outline hover:border-primary active:scale-[0.98]'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Alpha</span>
                  <span className={`block text-3xl font-[900] tracking-tighter ${activeFlight?.timestampPosition ? 'text-success' : 'text-on-surface'}`}>
                      LOG POSITION
                  </span>
                  {activeFlight?.timestampPosition && (
                      <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                           <Clock className="w-4 h-4 mr-2 opacity-60"/>
                           {new Date(activeFlight.timestampPosition).toLocaleTimeString()}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampPosition && <Truck className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
              {activeFlight?.timestampPosition && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
          </button>

          <button 
              onClick={() => onTimestamp('timestampStart')}
              disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart}
              className={`w-full p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group shadow-ambient
                  ${activeFlight?.timestampStart 
                      ? 'bg-success/5 border-success text-on-surface' 
                      : !activeFlight?.timestampPosition
                          ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                          : 'bg-surface-container-lowest-container border-outline hover:border-primary active:scale-[0.98]'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Bravo</span>
                  <span className={`block text-3xl font-[900] tracking-tighter ${activeFlight?.timestampStart ? 'text-success' : 'text-on-surface'}`}>
                      COMMENCE FUELING
                  </span>
                   {activeFlight?.timestampStart && (
                      <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                           <Clock className="w-4 h-4 mr-2 opacity-60"/>
                           {new Date(activeFlight.timestampStart).toLocaleTimeString()}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampStart && <Play className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
              {activeFlight?.timestampStart && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
          </button>
      </div>

      <button 
          onClick={onNext}
          disabled={!activeFlight?.timestampStart}
          className="mt-8 w-full kinetic-gradient p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale hover:shadow-premium active:scale-95 transition-all"
      >
          Proceed to Metering <ChevronRight className="ml-3 w-5 h-5" />
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
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
       <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Timestamps
       </button>
       <h2 className="text-on-surface text-2xl font-black mb-8 tracking-tighter uppercase">Metering <span className="text-primary italic">& Volume</span></h2>

       <div className="space-y-8">
          <div className="card-premium p-6 border-outline">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
              <input 
                  type="number" 
                  className="w-full text-5xl font-mono font-black py-4 bg-transparent outline-none border-b-4 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                  placeholder="000000"
                  value={activeFlight?.meterOpen || ''}
                  onChange={(e) => onInputChange('meterOpen', parseFloat(e.target.value))}
              />
          </div>

          <button 
              onClick={() => onTimestamp('timestampInitialEnd')}
              disabled={!activeFlight?.meterOpen || !!activeFlight?.timestampInitialEnd}
              className={`w-full p-6 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all
                  ${activeFlight?.timestampInitialEnd 
                      ? 'bg-success/5 border-success text-success' 
                      : 'bg-surface-container-lowest-container border-outline text-on-surface hover:border-primary active:scale-95'}`}
          >
              <Pause className="w-5 h-5 mr-3" />
              {activeFlight?.timestampInitialEnd ? `Initial End: ${new Date(activeFlight.timestampInitialEnd).toLocaleTimeString()}` : 'Log Initial End'}
          </button>

          <div className="card-premium p-6 border-outline">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Closing Totalizer</label>
              <input 
                  type="number" 
                  className="w-full text-5xl font-mono font-black py-4 bg-transparent outline-none border-b-4 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                  placeholder="000000"
                  value={activeFlight?.meterClose || ''}
                  onChange={(e) => onInputChange('meterClose', parseFloat(e.target.value))}
              />
          </div>

          <div className="bg-primary/5 p-8 rounded-[32px] border border-primary/20 text-center relative overflow-hidden group">
               <span className="block text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-3">Live Volume Derived</span>
               <span className="block text-5xl font-[900] text-primary tracking-tighter group-hover:scale-110 transition-transform">{activeFlight?.volume?.toLocaleString() || 0} <span className="text-2xl font-black opacity-40 italic">L</span></span>
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          </div>

          <div className="border-t border-outline pt-6">
               <button onClick={() => setShowTopUp(!showTopUp)} className="text-primary font-black text-[11px] uppercase tracking-widest flex items-center hover:scale-105 transition-transform">
                   {showTopUp ? '- Strike Top-Up Data' : '+ Register Top-Up Event'}
               </button>
               {showTopUp && (
                   <div className="grid grid-cols-2 gap-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-400">
                       <button onClick={() => onTimestamp('timestampFinalStart')} className={`p-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeFlight?.timestampFinalStart ? 'bg-success/5 border-success text-success' : 'bg-surface-container-low border-outline text-on-surface-dim hover:text-on-surface'}`}>
                           {activeFlight?.timestampFinalStart ? 'Started' : 'Final Start'}
                       </button>
                       <button onClick={() => onTimestamp('timestampFinalEnd')} className={`p-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeFlight?.timestampFinalEnd ? 'bg-success/5 border-success text-success' : 'bg-surface-container-low border-outline text-on-surface-dim hover:text-on-surface'}`}>
                           {activeFlight?.timestampFinalEnd ? 'Ended' : 'Final End'}
                       </button>
                   </div>
               )}
          </div>
       </div>

       <div className="mt-auto pt-10">
          <button 
              onClick={onNext}
              disabled={!activeFlight?.meterClose}
              className="w-full kinetic-gradient p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale shadow-premium active:scale-95 transition-all"
          >
              Final Compliance <ChevronRight className="ml-3 w-5 h-5" />
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
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
       <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Metering
       </button>
       <h2 className="text-on-surface text-2xl font-black mb-8 tracking-tighter uppercase">JIG <span className="text-primary italic">Compliance Protocol</span></h2>

       <div className="space-y-4 card-premium p-8 border-outline shadow-inner">
          {['panelCheck', 'walkAroundCheck', 'appearanceCheck', 'waterCheck'].map((check) => (
              <label key={check} className="flex items-center justify-between p-5 bg-surface-container-low border-transparent rounded-2xl hover:bg-surface-container-lowest-container transition-all cursor-pointer group">
                  <span className="font-black text-[13px] text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors">
                      {check.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <input 
                      type="checkbox" 
                      checked={!!activeFlight?.[check as keyof FlightLog]} 
                      onChange={(e) => onInputChange(check as keyof FlightLog, e.target.checked)}
                      className="w-7 h-7 text-primary rounded-xl focus:ring-0 border-outline bg-surface-container-lowest transition-all"
                  />
              </label>
          ))}
          
          <div className="pt-6">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Task Remarks & Feedback</label>
              <textarea 
                  className="w-full bg-surface-container-low border-2 border-outline rounded-2xl p-5 text-sm font-bold text-on-surface outline-none focus:border-primary transition-all min-h-[120px] placeholder:opacity-20"
                  placeholder="Enter any operational remarks, delays, or equipment issues..."
                  value={activeFlight?.remarks || ''}
                  onChange={(e) => onInputChange('remarks', e.target.value)}
              />
          </div>
       </div>

       <div className="mt-auto pt-10 space-y-6">
           <div className="bg-warning/5 border border-warning/20 p-6 rounded-3xl flex items-start">
               <AlertTriangle className="w-6 h-6 text-warning mr-4 flex-shrink-0" />
               <p className="text-[11px] font-bold text-on-surface opacity-60 leading-relaxed uppercase tracking-widest">Digital certification required. By committing, you verify JIG compliance and manual safety checks are complete.</p>
           </div>
           
           <button 
              onClick={onSubmit}
              disabled={loading}
              className="w-full kinetic-gradient p-7 rounded-3xl font-[900] text-[15px] uppercase tracking-[0.3em] flex items-center justify-center shadow-premium hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
           >
              {loading ? 'ENCRYPTING & SYNCING...' : (
                  <>
                      <Save className="w-6 h-6 mr-4" />
                      AUTHORIZE TASK COMPLETE
                  </>
              )}
           </button>
       </div>
  </div>
);

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user, initialJob, onClearInitialJob }) => {
  const { notify } = useNotification();
  const { equipment, flightJobs, updateEquipmentStatus } = useOperationalData();
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(null);
  
  // Auto-start if job passed from dashboard
  useEffect(() => {
    if (initialJob) {
      startJob(initialJob);
      if (onClearInitialJob) onClearInitialJob();
    }
  }, [initialJob]);

  const [selectedVehicleId, setSelectedVehicleId] = useState(() => {
    const available = equipment.find(eq => eq.status === EquipmentStatus.AVAILABLE);
    return available ? available.id : 'RF-04';
  });
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
    // Auto-update Equipment Status to IN_PROGRESS/IN_USE
    updateEquipmentStatus(selectedVehicleId, EquipmentStatus.IN_USE);

    setActiveFlight({
      flightNumber: job.flightNumber,
      aircraftReg: job.aircraftReg,
      aircraftType: job.aircraftType,
      stand: job.stand,
      operatorId: user.id,
      vehicleId: selectedVehicleId,
      status: 'PENDING',
      meterOpen: undefined,
      volume: 0,
      panelCheck: false,
      walkAroundCheck: false,
      appearanceCheck: false,
      waterCheck: false,
      remarks: '',
    });
    setCurrentScreen('timestamps');
  };


  const handleTimestamp = (field: keyof FlightLog) => {
    setActiveFlight(prev => ({
      ...prev,
      [field]: new Date().toISOString()
    }));
  };

  const handleBackToDashboard = () => {
    // If a job was started, release the equipment
    if (activeFlight && selectedVehicleId) {
      updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
    }
    setActiveFlight(null);
    setCurrentScreen('dashboard');
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
        vehicleId: selectedVehicleId,
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
      
      // Auto-update Equipment Status back to AVAILABLE
      updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
      notify("Job Completed & Synced to Database!", "success");
      setActiveFlight(null);
      setCurrentScreen('dashboard');
    } catch (error) {
      console.error('Error saving flight log:', error);
      notify('Failed to sync. Please check your secure connection.', "error");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-full flex flex-col bg-surface-container-lowest transition-colors duration-500">
        <MobileHeader 
          user={user} 
          isOnline={isOnline} 
          activeFlight={activeFlight} 
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          equipment={equipment}
        />
        <div className="flex-1">
            {currentScreen === 'dashboard' && (
              <ScreenDashboard 
                user={user} 
                onStartJob={startJob} 
                selectedVehicleId={selectedVehicleId}
                setSelectedVehicleId={setSelectedVehicleId}
              />
            )}
            {currentScreen === 'timestamps' && (
              <ScreenTimestamps 
                activeFlight={activeFlight} 
                onTimestamp={handleTimestamp} 
                onNext={() => setCurrentScreen('metering')}
                onBack={handleBackToDashboard}
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




