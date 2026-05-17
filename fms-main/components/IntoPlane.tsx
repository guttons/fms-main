import React, { useState, useEffect } from 'react';
import { FlightLog, User, FlightJob, Equipment, EquipmentStatus } from '../types';
import { MOCK_JOBS, MOCK_USERS, MOCK_DOMESTIC_FLIGHTS, PIT_MAPPING } from '../constants';
import { Clock, CheckCircle, Truck, Play, Pause, AlertTriangle, Wifi, WifiOff, Save, ChevronRight, ChevronLeft, MapPin, User as UserIcon, Lock } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { equipmentBadgeClass, equipmentDotClass, getEquipmentHexColor } from '../utils/equipmentColors';
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
  <div className="bg-surface text-on-surface p-4 border-b border-outline sticky top-0 z-30 transition-colors shadow-sm flex items-center justify-between gap-3 overflow-hidden">
      <div className="flex items-center flex-1 min-w-0">
          <Truck className="w-5 h-5 mr-3 text-primary animate-pulse flex-shrink-0" />
          
          <div className="flex items-center flex-shrink-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80 leading-none mr-3 hidden sm:block">Unit</span>
              
              {activeFlight && (
                  <div className="md:hidden flex items-center h-[30px]">
                      <span 
                        className="bg-surface-container-low border-transparent rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-widest leading-none shadow-sm"
                        style={{ color: getEquipmentHexColor(activeFlight.vehicleId) }}
                      >
                          {activeFlight.vehicleId}
                      </span>
                  </div>
              )}

              <div className={`relative w-full ${activeFlight ? 'hidden md:block' : 'block'}`}>
                  <select 
                      value={activeFlight?.vehicleId || selectedVehicleId}
                      disabled={!!activeFlight}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      style={{ color: getEquipmentHexColor(activeFlight?.vehicleId || selectedVehicleId) }}
                      className="bg-surface-container-highest border border-outline rounded-lg py-2 pl-3 pr-8 text-[12px] font-bold shadow-sm appearance-none focus:border-primary transition-all cursor-pointer uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-fit"
                  >
                       {equipment
                         .filter(eq => (eq.id.startsWith('RF') || eq.id.startsWith('HD')) && (eq.status === EquipmentStatus.AVAILABLE || eq.id === selectedVehicleId))
                         .map(eq => (
                            <option 
                              key={eq.id} 
                              value={eq.id} 
                              style={{ color: getEquipmentHexColor(eq.id) }}
                              className="bg-surface-container-low font-bold uppercase"
                            >
                              {eq.id}
                            </option>
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
          <div className={`w-2.5 h-2.5 rounded-full ${equipmentDotClass(activeFlight?.vehicleId || selectedVehicleId)} shadow-premium`} title={isOnline ? 'Synced' : 'Offline'}></div>
      </div>
  </div>
);

const ScreenDashboard: React.FC<{ 
    user: User, 
    onStartJob: (job: FlightJob) => void,
    selectedVehicleId: string,
    setSelectedVehicleId: (id: string) => void
}> = ({ user, onStartJob }) => {
  const { notify } = useNotification();
  const { flightJobs, domesticFlights } = useOperationalData();
  const [viewMode, setViewMode] = useState<'INT' | 'DOM'>('INT');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  
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




  const filteredIntlJobs = filterMyTasks ? intlJobs.filter(j => j.assignedTo === user.id) : intlJobs;
  const filteredDomesticJobs = filterMyTasks ? domesticJobs.filter(j => j.assignedTo === user.id) : domesticJobs;

  const activeJobs = viewMode === 'INT' ? filteredIntlJobs : filteredDomesticJobs;

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
                  <div className="flex justify-between items-start mb-6 gap-4">
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
                          </div>
                      </div>
                                         <div className="flex items-center gap-3 shrink-0">
                           {/* Indicators & Actions */}
                            {isAssignedToMe && (
                               <div className="flex items-center justify-center text-primary bg-primary/10 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-primary/20" title="My Task">
                                   <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                               </div>
                           )}

                           <button 
                               onClick={() => {
                                   if (job.status === 'COMPLETED') {
                                       notify(`Log for ${job.flightNumber} is already finalized.`, "info");
                                   } else if (isAssignedToMe) {
                                       onStartJob(job);
                                   }
                               }}
                               disabled={!isAssignedToMe && job.status !== 'COMPLETED'}
                               className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-sm
                                   ${job.status === 'COMPLETED' ? 'bg-success/10 text-success border border-success/20' : 
                                     isAssignedToMe ? 'kinetic-gradient text-white hover:scale-[1.05] active:scale-95 shadow-premium' : 'bg-surface-container-low text-on-surface-dim opacity-40 border-outline'}
                               `}
                               title={job.status === 'COMPLETED' ? 'View Log' : (!isAssignedToMe ? 'Locked' : 'Start Job')}
                           >
                               {job.status === 'COMPLETED' ? <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" /> : 
                                (!isAssignedToMe ? <Lock className="w-5 h-5 sm:w-5 sm:h-5 stroke-[2.5]" /> : <Play className="w-[24px] h-[24px] sm:w-[28px] sm:h-[28px] flex-shrink-0 ml-0.5 sm:ml-1" fill="white" color="white" strokeWidth={2.5} />)}
                           </button>
                      </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline/50 space-y-4">
                      {/* Row 1: Tactical Times */}
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-surface-container-low/30 px-3 py-2 rounded-xl border border-outline/10 w-fit">
                          <div className="flex items-center gap-2">
                              <span className="opacity-40">STA</span>
                              <span className="text-on-surface text-xs font-black tracking-tight">{job.sta || '--:--'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-primary opacity-60">ETA</span>
                              <span className={`${delayed ? 'text-error' : 'text-primary'} text-xs font-black tracking-tight`}>{job.eta || '--:--'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-warning opacity-60">STD</span>
                              <span className="text-warning text-xs font-black tracking-tight">{job.std || '--:--'}</span>
                          </div>
                      </div>

                      {/* Row 2: Operator (Left) & Status (Right) */}
                      <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center text-on-surface-dim font-bold">
                               <div className="w-5 h-5 rounded-md bg-surface-container-low border-transparent flex items-center justify-center mr-2 text-[10px] font-black">
                                   {assigneeName.charAt(0)}
                               </div>
                               <span className="text-[10px] uppercase tracking-tight">{assigneeName}</span>
                          </div>
                          
                          <span className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shrink-0 ${
                              displayStatus === 'COMPLETED' ? 'bg-success/10 text-success border-success/10' : 
                              displayStatus === 'DELAYED' ? 'bg-error/10 text-error border-error/10' :
                              displayStatus === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/10' : 'bg-surface-container-low text-on-surface-dim border-outline'
                          }`}>
                              {displayStatus.replace('_', ' ')}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="p-5 flex flex-col space-y-8 pb-24">
      {/* Category Toggle */}
      <div className="flex justify-center mt-2 mb-4">
          <div className="bg-surface-container-low p-1 rounded-[22px] border-transparent flex relative w-full max-w-[320px] h-[38px]">
              <div 
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] kinetic-gradient rounded-[18px] transition-all duration-300 ${viewMode === 'DOM' ? 'translate-x-full' : 'translate-x-0'}`}
              />
              <button 
                  onClick={() => setViewMode('INT')}
                  className={`flex-1 flex items-center justify-center rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'INT' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  <span className="hidden sm:inline">International</span>
                  <span className="sm:hidden">INT</span>
              </button>
              <button 
                  onClick={() => setViewMode('DOM')}
                  className={`flex-1 flex items-center justify-center rounded-[18px] text-[10px] font-black uppercase tracking-[0.2em] relative z-10 transition-colors duration-300 ${viewMode === 'DOM' ? 'text-white' : 'text-on-surface-dim opacity-60'}`}
              >
                  <span className="hidden sm:inline">Domestic</span>
                  <span className="sm:hidden">DOM</span>
              </button>
          </div>

          <button 
              onClick={() => setFilterMyTasks(!filterMyTasks)}
              className={`ml-3 px-4 h-[38px] rounded-[22px] border transition-all flex items-center gap-2 justify-center sm:justify-start
                  ${filterMyTasks 
                      ? 'kinetic-gradient text-white border-transparent shadow-premium' 
                      : 'bg-surface-container-low text-on-surface-dim border-outline opacity-70 hover:opacity-100'}
              `}
              title={filterMyTasks ? 'Showing My Tasks' : 'Showing All Tasks'}
          >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  {filterMyTasks ? 'My Tasks Only' : 'All Tasks'}
              </span>
          </button>
      </div>

      <div key={viewMode} className={`space-y-4 animate-in fade-in duration-500 ${viewMode === 'INT' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'}`}>
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
  onInputChange: (field: keyof FlightLog, value: any) => void,
  onNext: () => void, 
  onBack: () => void 
}> = ({ activeFlight, onTimestamp, onInputChange, onNext, onBack }) => (
  <div className="p-5 flex flex-col h-full min-h-[calc(100vh-140px)] pb-32">
      <button onClick={onBack} className="flex items-center text-on-surface-dim hover:text-primary mb-6 font-black text-[11px] uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Schedule
      </button>
      <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase italic">Ramp Arrival <span className="text-primary">& Setup</span></h2>
      
      <div className="space-y-6 flex-1">
          <div className="card-premium p-6 border-outline overflow-hidden">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Delivery Ticket Number</label>
              <div className="flex items-center gap-2 max-w-full overflow-hidden">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">MLE-</span>
                  <input 
                      type="text" 
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-error placeholder:text-error/20"
                      placeholder="000000"
                      value={activeFlight?.deliveryNumber?.replace('MLE-', '') || ''}
                      onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          onInputChange('deliveryNumber', val ? `MLE-${val}` : '');
                      }}
                  />
              </div>
          </div>

          {activeFlight?.vehicleId?.startsWith('HD') && (
            <div className="card-premium p-6 border-outline overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Hydrant PIT Number</label>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                        <span className="text-2xl sm:text-3xl font-mono font-black text-primary opacity-30 shrink-0">J</span>
                        <input 
                            type="text" 
                            className="flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-primary placeholder:text-primary/10 uppercase"
                            placeholder="000-0"
                            value={activeFlight?.pitNumber?.startsWith('J') ? activeFlight.pitNumber.substring(1) : (activeFlight?.pitNumber || '')}
                            onChange={(e) => {
                                const val = e.target.value.toUpperCase().replace(/^J/, '');
                                onInputChange('pitNumber', val ? `J${val}` : '');
                            }}
                            list="pit-suggestions"
                        />
                        <datalist id="pit-suggestions">
                            {PIT_MAPPING.map((m, idx) => (
                                <option key={idx} value={m.pit}>{m.stand}</option>
                            ))}
                        </datalist>
                    </div>
                    {activeFlight.stand && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {PIT_MAPPING.filter(m => m.stand === activeFlight.stand).map((m, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => onInputChange('pitNumber', m.pit)}
                                    className="px-3 py-1.5 bg-surface-container-low rounded-lg text-[10px] font-black text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
                                >
                                    {m.pit}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          )}
          <button 
              onClick={() => onTimestamp('timestampArrived')}
              disabled={false}
              className={`w-full p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                  ${activeFlight?.timestampArrived 
                      ? 'bg-success/5 border-success text-on-surface' 
                      : 'bg-surface-container-lowest-container border-outline hover:border-primary active:scale-[0.98]'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Alpha</span>
                  <span className={`block text-3xl font-[900] tracking-tighter ${activeFlight?.timestampArrived ? 'text-success' : 'text-on-surface'}`}>
                      LOG ARRIVED
                  </span>
                  {activeFlight?.timestampArrived && (
                      <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                           <Clock className="w-4 h-4 mr-2 opacity-60"/>
                           {new Date(activeFlight.timestampArrived).toLocaleTimeString([], { hour12: false })}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampArrived && <MapPin className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
              {activeFlight?.timestampArrived && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
          </button>

          <button 
              onClick={() => onTimestamp('timestampPosition')}
              disabled={!activeFlight?.timestampArrived}
              className={`w-full p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                  ${activeFlight?.timestampPosition 
                      ? 'bg-success/5 border-success text-on-surface' 
                      : !activeFlight?.timestampArrived
                          ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                          : 'bg-surface-container-lowest-container border-outline hover:border-primary active:scale-[0.98]'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Bravo</span>
                  <span className={`block text-3xl font-[900] tracking-tighter ${activeFlight?.timestampPosition ? 'text-success' : 'text-on-surface'}`}>
                      LOG POSITION
                  </span>
                  {activeFlight?.timestampPosition && (
                      <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                           <Clock className="w-4 h-4 mr-2 opacity-60"/>
                           {new Date(activeFlight.timestampPosition).toLocaleTimeString([], { hour12: false })}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampPosition && <Truck className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
              {activeFlight?.timestampPosition && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
          </button>

          <div className="card-premium p-6 border-outline">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Operation Gamma: Opening Totalizer</label>
              <input 
                  type="text" 
                  disabled={!activeFlight?.timestampPosition || !!activeFlight?.timestampStart}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full text-4xl sm:text-6xl font-mono font-black py-4 bg-transparent outline-none border-b-4 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10 disabled:opacity-20"
                  placeholder="000,000"
                  value={activeFlight?.meterOpen !== undefined ? activeFlight.meterOpen.toLocaleString() : ''}
                  onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          onInputChange('meterOpen' as any, val === '' ? 0 : parseFloat(val));
                      }
                  }}
              />
          </div>

          <button 
              onClick={() => onTimestamp('timestampStart')}
              disabled={!activeFlight?.timestampPosition || activeFlight?.meterOpen === undefined}
              className={`w-full p-8 rounded-3xl border-2 text-left transition-all relative overflow-hidden group
                  ${activeFlight?.timestampStart 
                      ? 'bg-success/5 border-success text-on-surface' 
                      : (!activeFlight?.timestampPosition || !activeFlight?.meterOpen)
                          ? 'bg-surface-container-low border-outline opacity-40 cursor-not-allowed'
                          : 'bg-surface-container-lowest-container border-outline hover:border-primary active:scale-[0.98]'}
              `}
          >
              <div className="relative z-10">
                  <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-dim opacity-40 mb-2">Operation Delta</span>
                  <span className={`block text-3xl font-[900] tracking-tighter ${activeFlight?.timestampStart ? 'text-success' : 'text-on-surface'}`}>
                      COMMENCE FUELING
                  </span>
                   {activeFlight?.timestampStart && (
                      <span className="block mt-4 font-black text-[11px] uppercase tracking-widest text-success flex items-center">
                           <Clock className="w-4 h-4 mr-2 opacity-60"/>
                           {new Date(activeFlight.timestampStart).toLocaleTimeString([], { hour12: false })}
                      </span>
                  )}
              </div>
              {!activeFlight?.timestampStart && <Play className="absolute right-6 bottom-6 w-16 h-16 text-on-surface opacity-[0.03] group-hover:opacity-[0.06] transition-opacity" />}
              {activeFlight?.timestampStart && <CheckCircle className="absolute right-6 bottom-6 w-16 h-16 text-success opacity-10" />}
          </button>
      </div>

      <button 
          onClick={onNext}
          disabled={!activeFlight?.timestampStart || activeFlight?.deliveryNumber?.replace('MLE-', '').length !== 6}
          className="mt-8 w-full kinetic-gradient text-white p-4 lg:p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale active:scale-95 transition-all shadow-premium"
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
       <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase">Metering <span className="text-primary italic">& Volume</span></h2>

       <div className="space-y-8">
          <div className="p-6 border border-outline rounded-3xl">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
              <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full text-4xl sm:text-6xl font-mono font-black py-4 bg-transparent outline-none border-b-4 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                  placeholder="000,000"
                  value={activeFlight?.meterOpen !== undefined ? activeFlight.meterOpen.toLocaleString() : ''}
                  onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          onInputChange('meterOpen', val === '' ? 0 : parseFloat(val));
                      }
                  }}
              />
          </div>

          <button 
              onClick={() => onTimestamp('timestampInitialEnd')}
              disabled={activeFlight?.meterOpen === undefined}
              className={`w-full p-6 rounded-2xl border-2 font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all
                  ${activeFlight?.timestampInitialEnd 
                      ? 'bg-success/5 border-success text-success' 
                      : 'bg-surface-container-lowest-container border-outline text-on-surface hover:border-primary active:scale-95'}`}
          >
              <Pause className="w-5 h-5 mr-3" />
              {activeFlight?.timestampInitialEnd ? `Initial End: ${new Date(activeFlight.timestampInitialEnd).toLocaleTimeString([], { hour12: false })}` : 'Log Initial End'}
          </button>

          <div className="mt-4 p-4 lg:p-8 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline">
               <label className="block text-[10px] font-black text-on-surface uppercase mb-6 tracking-widest text-center opacity-60">Manual Volume Entry (L)</label>
               <div className="relative w-full max-w-md mx-auto">
                   <input 
                       type="text" 
                       inputMode="numeric"
                       pattern="[0-9]*"
                       className="w-full px-6 lg:px-10 py-4 lg:py-6 bg-surface-lowest border border-outline/50 rounded-[24px] lg:rounded-[32px] text-4xl sm:text-6xl font-[900] text-primary tracking-tighter text-center outline-none focus:border-primary transition-all font-mono"
                       placeholder="0,000"
                       value={activeFlight?.volume ? activeFlight.volume.toLocaleString() : ''}
                       onChange={(e) => {
                           const val = e.target.value.replace(/,/g, '');
                           if (val === '' || /^\d*\.?\d*$/.test(val)) {
                               onInputChange('volume', val === '' ? 0 : parseFloat(val));
                           }
                       }}
                   />
                   <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
               </div>
          </div>

          <div className="card-premium p-6 border-outline bg-surface-dim/40">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Calculated Closing Totalizer</label>
              <div className="text-4xl sm:text-6xl font-mono font-black py-4 text-on-surface-dim tracking-tight">
                  {((typeof activeFlight?.meterOpen === 'number' ? activeFlight.meterOpen : 0) + (typeof activeFlight?.volume === 'number' ? activeFlight.volume : 0)).toLocaleString()}
              </div>
          </div>
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

       <div className="mt-auto pt-10">
           <button 
              onClick={onNext}
              disabled={!activeFlight?.volume || activeFlight.volume <= 0}
              className="w-full kinetic-gradient p-4 lg:p-6 rounded-3xl font-black text-[13px] uppercase tracking-[0.2em] flex items-center justify-center disabled:opacity-40 disabled:grayscale shadow-premium active:scale-95 transition-all"
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
       <h2 className="text-on-surface text-xl sm:text-2xl font-black mb-8 tracking-tighter uppercase">JIG <span className="text-primary italic">Compliance Protocol</span></h2>

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
                      className="!w-5 !h-5 text-primary rounded-lg focus:ring-0 border-outline bg-surface-container-lowest transition-all"
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
              disabled={loading || !activeFlight?.panelCheck || !activeFlight?.walkAroundCheck || !activeFlight?.appearanceCheck || !activeFlight?.waterCheck}
              className="w-full kinetic-gradient p-5 lg:p-7 rounded-3xl font-[900] text-[14px] lg:text-[15px] uppercase tracking-[0.3em] flex items-center justify-center shadow-premium hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:grayscale"
           >
              {loading ? 'ENCRYPTING & SYNCING...' : (
                  <>
                      <Save className="w-5 h-5 lg:w-6 lg:h-6 mr-4" />
                      AUTHORIZE TASK COMPLETE
                  </>
              )}
           </button>
       </div>
  </div>
);

export const IntoPlane: React.FC<IntoPlaneProps> = ({ user, initialJob, onClearInitialJob }) => {
  const { notify } = useNotification();
  const { equipment, flightJobs, flightLogs, updateEquipmentStatus, updateEquipment } = useOperationalData();
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'timestamps' | 'metering' | 'qc'>('dashboard');
  const [activeFlight, setActiveFlight] = useState<Partial<FlightLog> | null>(null);
  
  // Auto-start if job passed from dashboard
  useEffect(() => {
    if (initialJob) {
      startJob(initialJob);
      if (onClearInitialJob) onClearInitialJob();
    }
  }, [initialJob]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (initialJob?.vehicleId) return initialJob.vehicleId;
    const available = equipment.find(eq => eq.status === EquipmentStatus.AVAILABLE);
    return available ? available.id : 'RF-04';
  });
  const [showTopUp, setShowTopUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (initialJob && initialJob.vehicleId) {
      setSelectedVehicleId(initialJob.vehicleId);
    }
  }, [initialJob]);

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

    // Fetch last meterClose for this vehicle
    const vehicleLogs = (flightLogs || []).filter(log => log.vehicleId === selectedVehicleId && log.status === 'COMPLETED');
    const lastLog = [...vehicleLogs].sort((a, b) => {
       const timeA = a.timestampFinalEnd ? new Date(a.timestampFinalEnd).getTime() : 0;
       const timeB = b.timestampFinalEnd ? new Date(b.timestampFinalEnd).getTime() : 0;
       return timeB - timeA;
    })[0];
    
    const initialMeter = lastLog?.meterClose || undefined;

    setActiveFlight({
      flightNumber: job.flightNumber,
      aircraftReg: job.aircraftReg,
      aircraftType: job.aircraftType,
      stand: job.stand,
      operatorId: user.id,
      vehicleId: selectedVehicleId,
      status: 'PENDING',
      meterOpen: initialMeter,
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
    setActiveFlight(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: prev[field] ? undefined : new Date().toISOString()
      };
    });
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
      
      // Auto-sync Stand with PIT Number
      if (field === 'pitNumber' && value) {
        const mapping = PIT_MAPPING.find(m => m.pit === value || m.pit === `J${value}`);
        if (mapping && mapping.stand !== prev?.stand) {
          updated.stand = mapping.stand;
        }
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
        volume: activeFlight.volume || 0,
        panelCheck: activeFlight.panelCheck || false,
        walkAroundCheck: activeFlight.walkAroundCheck || false,
        appearanceCheck: activeFlight.appearanceCheck || false,
        waterCheck: activeFlight.waterCheck || false,
        remarks: activeFlight.remarks || '',
        meterClose: (activeFlight.meterOpen || 0) + (activeFlight.volume || 0),
        deliveryNumber: activeFlight.deliveryNumber,
        pitNumber: activeFlight.pitNumber
      };

      await supabaseService.createFlightLog(logToSave);
      
      // Update Refueller Payload/Inventory if applicable
      if (selectedVehicleId.startsWith('RF')) {
        const vehicle = equipment.find(eq => eq.id === selectedVehicleId);
        if (vehicle && vehicle.currentVolume !== undefined) {
          const newVolume = Math.max(0, vehicle.currentVolume - (activeFlight.volume || 0));
          await updateEquipment(selectedVehicleId, { 
            currentVolume: newVolume,
            status: EquipmentStatus.AVAILABLE 
          });
        } else {
          updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
        }
      } else {
        // Just release hydrant/service equipment
        updateEquipmentStatus(selectedVehicleId, EquipmentStatus.AVAILABLE);
      }

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
                onInputChange={handleInputChange}
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




