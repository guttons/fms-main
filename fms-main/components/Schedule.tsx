import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MOCK_USERS, MOCK_ADHOC_FLIGHTS, EQUIPMENT } from '../constants';
import { UserRole, EquipmentType, FlightJob } from '../types';
import { Calendar, Zap, Plane, Clock, Users, Truck, MapPin, ChevronDown, Droplet, Settings, Home, Radio, RefreshCw } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { BriefingShift } from '../context/OperationalDataContext';

export const Schedule: React.FC = () => {
  const { 
    equipment, 
    flightJobs, 
    briefingInfo, 
    updateFlightJob, 
    addFlightJob, 
    staff, 
    selectedBriefingShift, 
    setSelectedBriefingShift, 
    domesticAssignments, 
    updateDomesticAssignment,
    externalFlights,
    isExternalFlightsLoading,
    refreshExternalFlights,
    domesticFlights
  } = useOperationalData();
  const todayDate = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<'international' | 'domestic' | 'adhoc' | 'equipment' | 'status' | 'live'>('international');
  const [configuringFlightId, setConfiguringFlightId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<any>(null);

  const [fidsType, setFidsType] = useState<'arrival' | 'departure'>('arrival');
  const [fidsCategory, setFidsCategory] = useState<'all' | 'international' | 'domestic'>('all');
  const [fidsSearchQuery, setFidsSearchQuery] = useState('');

  // Fetch live flights on load
  useEffect(() => {
    refreshExternalFlights();
  }, [refreshExternalFlights]);

  const isFlightImported = (flightNo: string) => {
    const cleanNo = (flightNo || '').replace(/\s+/g, '').toLowerCase();
    return flightJobs.some(job => (job.flightNumber || '').replace(/\s+/g, '').toLowerCase() === cleanNo);
  };

  const getLogoUrl = (flightNumber?: string) => {
    if (!flightNumber) return null;
    const airlineCode = flightNumber.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    return airlineCode.length === 2 ? `https://fis.com.mv/tail/${airlineCode}.png` : null;
  };

  const getFidsStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('landed') || s.includes('departed')) {
      return 'bg-success/10 text-success border-success/20';
    }
    if (s.includes('cancel')) {
      return 'bg-error/10 text-error border-error/20';
    }
    if (s.includes('delay') || s.includes('final') || s.includes('closed')) {
      return 'bg-warning/10 text-warning border-warning/20';
    }
    return 'bg-surface-dim text-on-surface-dim border-outline opacity-60';
  };

  const handleImportClick = (flight: any) => {
    // Calculate route: Origin -> Male (MLE) or Male (MLE) -> Destination
    const routeStr = flight.type === 'arrival' 
      ? `${flight.originCode || flight.origin || ''} ➔ MLE`
      : `MLE ➔ ${flight.destinationCode || flight.destination || ''}`;

    const staVal = flight.type === 'arrival' ? flight.scheduledTime : '';
    const stdVal = flight.type === 'departure' ? flight.scheduledTime : '';
    const etaVal = flight.type === 'arrival' ? flight.estimatedTime || flight.scheduledTime : '';

    setPrefillData({
      flightNumber: flight.flightNumber || '',
      route: routeStr,
      stand: flight.gate || '', // Pull only gate as a stand as requested by user
      sta: staVal,
      eta: etaVal,
      std: stdVal
    });
    
    setIsModalOpen(true);
  };

  const filteredFidsFlights = useMemo(() => {
    return (externalFlights || [])
      .filter((f: any) => {
        // Type filter (arrival / departure)
        if (f.type !== fidsType) return false;

        // Category filter (all / international / domestic)
        if (fidsCategory !== 'all' && f.category !== fidsCategory) return false;

        // Search query
        if (fidsSearchQuery) {
          const q = fidsSearchQuery.toLowerCase();
          const matchFlight = (f.flightNumber || '').toLowerCase().includes(q);
          const matchAirline = (f.airline || '').toLowerCase().includes(q);
          const matchOrigin = (f.origin || '').toLowerCase().includes(q);
          const matchDest = (f.destination || '').toLowerCase().includes(q);
          return matchFlight || matchAirline || matchOrigin || matchDest;
        }

        return true;
      });
  }, [externalFlights, fidsType, fidsCategory, fidsSearchQuery]);

  const handleAddFlight = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = e.currentTarget;
    const formData = new FormData(target);
    const flight = formData.get('flight') as string;
    const route = formData.get('route') as string;
    const ac = formData.get('ac') as string;
    const stand = formData.get('stand') as string;
    const sta = formData.get('sta') as string;
    const eta = formData.get('eta') as string;
    const std = formData.get('std') as string;

    if (!flight || !route || !ac || !stand || !sta || !eta || !std) return;

    try {
      await addFlightJob({
        id: `fj-${Date.now()}`,
        flightNumber: flight,
        aircraftReg: ac,
        aircraftType: ac,
        stand,
        sta,
        eta,
        std,
        assignedTo: '',
        status: 'PENDING'
      });
      setIsModalOpen(false);
      target.reset();
    } catch (error) {
      console.error("Failed to add flight job:", error);
    }
  };

  const isDelayed = (sta?: string, eta?: string) => {
    if (!sta || !eta) return false;
    const [staH, staM] = sta.split(':').map(Number);
    const [etaH, etaM] = eta.split(':').map(Number);
    return (etaH * 60 + etaM) > (staH * 60 + staM);
  };

  const renderRoute = (route?: string, textSize = "text-sm") => {
    if (!route) return <span className={`${textSize} font-black tracking-tight text-on-surface-dim opacity-30`}>---</span>;
    const parts = route.split(/\s+/);
    return (
      <div className={`flex items-center ${textSize} font-black tracking-tight select-none`}>
        {parts.map((part, idx) => {
          if (part === 'MLE' || part === '➔' || part === '->') {
            return (
              <span key={idx} className="text-[10px] opacity-30 mx-[2px] font-bold">
                {part}
              </span>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  // Shift time ranges for filtering flights
  const shiftRanges: Record<BriefingShift, { start: string; end: string; crossesMidnight: boolean }> = {
    'Morning': { start: '07:30', end: '16:00', crossesMidnight: false },
    'Evening': { start: '15:00', end: '23:30', crossesMidnight: false },
    'Night': { start: '22:30', end: '08:30', crossesMidnight: true },
  };

  const isFlightInShift = (sta?: string) => {
    if (!sta) return true; // Show flights without STA always
    const range = shiftRanges[selectedBriefingShift];
    if (range.crossesMidnight) {
      return sta >= range.start || sta <= range.end;
    }
    return sta >= range.start && sta <= range.end;
  };

  const [scheduledFlights, setScheduledFlights] = useState(flightJobs);

  const frozenFlights = briefingInfo?.staffAssignments?.frozenFlights;

  useEffect(() => {
    const filtered = frozenFlights?.intl 
      ? frozenFlights.intl 
      : flightJobs.filter(f => isFlightInShift(f.sta || f.std) && (!f.date || f.date === todayDate));
    setScheduledFlights(filtered);
  }, [flightJobs, selectedBriefingShift, todayDate, frozenFlights]);

  const domesticFlightsToRender = frozenFlights?.domestic 
    ? frozenFlights.domestic 
    : (domesticFlights || []).filter(f => isFlightInShift(f.sta || f.std) && (!f.date || f.date === todayDate));

  const adhocFlightsToRender = frozenFlights?.adhoc 
    ? frozenFlights.adhoc 
    : MOCK_ADHOC_FLIGHTS.filter(f => isFlightInShift(f.sta));

  const domesticTeams = [
    { id: 't1', name: 'Team 1', op1: '', op2: '' },
    { id: 't2', name: 'Team 2', op1: '', op2: '' },
    { id: 't3', name: 'Team 3', op1: '', op2: '' },
  ].map(team => {
    const dbTeam = (domesticAssignments || []).find(d => d.team_name === team.name);
    return dbTeam ? { ...team, op1: dbTeam.operator1_id || '', op2: dbTeam.operator2_id || '' } : team;
  });

  const currentShiftLabel = selectedBriefingShift === 'Evening' ? 'DIESEL' : 'DAILY';
  const [dieselNeeds, setDieselNeeds] = useState<string[]>(briefingInfo?.dieselNeeds || []);
  
  const rfHdEquipment = (equipment || []).filter(eq => 
    eq && (eq.type === EquipmentType.REFUELLER || eq.type === EquipmentType.HYDRANT_DISPENSER)
  );

  const [equipmentAssignments, setEquipmentAssignments] = useState(
    (rfHdEquipment || []).map(eq => ({ id: eq.id, eqNumber: eq.id, op1: '', op2: '', shift_type: currentShiftLabel, eqType: eq.type }))
  );

  // Modal removed — replaced by shift selector
  const operators = (staff && staff.length > 0 ? staff : MOCK_USERS).filter(u => [UserRole.ITP_OPERATOR, UserRole.ITP_HD_OPERATOR].includes(u.role));

  useEffect(() => {
    if (briefingInfo?.dieselNeeds) {
      setDieselNeeds(briefingInfo.dieselNeeds);
    }
  }, [briefingInfo?.dieselNeeds]);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        // Load Equipment Assignments
        const equipmentData = await supabaseService.getEquipmentAssignments(todayDate, currentShiftLabel);
        
        if (equipmentData && equipmentData.length > 0) {
          setEquipmentAssignments(prev => prev.map(eq => {
            const dbEq = equipmentData.find(d => d.equipment_id === eq.eqNumber);
            if (dbEq) {
              return { ...eq, op1: dbEq.operator1_id || '', op2: dbEq.operator2_id || '', shift_type: dbEq.shift_type };
            }
            return { ...eq, op1: '', op2: '' };
          }));
        } else {
          setEquipmentAssignments(prev => prev.map(eq => ({ ...eq, op1: '', op2: '' })));
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
      }
    };
    loadAssignments();
  }, [currentShiftLabel, todayDate, rfHdEquipment.length]);

  const handleAssignFlight = (flightId: string, field: 'assignedTo' | 'assignedOfficer' | 'equipmentUsage', value: string) => {
    updateFlightJob(flightId, { [field]: value });
  };

  const handleAssignDomestic = async (teamId: string, opIndex: 1 | 2, userId: string) => {
    const team = domesticTeams.find(t => t.id === teamId);
    if (team) {
      const newOp1 = opIndex === 1 ? userId : team.op1;
      const newOp2 = opIndex === 2 ? userId : team.op2;
      try {
        await updateDomesticAssignment(team.name, newOp1, newOp2);
      } catch (error) {
        console.error("Failed to save domestic assignment:", error);
      }
    }
  };

  const handleAssignEquipment = async (eqId: string, opIndex: 1 | 2, userId: string) => {
    const updatedEqs = equipmentAssignments.map(eq => {
      if (eq.id === eqId) {
        return opIndex === 1 ? { ...eq, op1: userId } : { ...eq, op2: userId };
      }
      return eq;
    });
    setEquipmentAssignments(updatedEqs);

    const eq = updatedEqs.find(e => e.id === eqId);
    if (eq) {
      try {
        await supabaseService.upsertEquipmentAssignment(todayDate, eq.eqNumber, currentShiftLabel, eq.op1, eq.op2);
      } catch (error) {
        console.error("Failed to save equipment assignment:", error);
      }
    }
  };



  const renderOperatorSelect = (value: string, onChange: (val: string) => void) => (
    <div className="relative group/select">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full text-[10px] font-bold rounded-xl focus:border-primary px-3 py-2 border uppercase tracking-wider appearance-none transition-colors ${
          value ? 'bg-surface-dim text-on-surface border-outline' : 'bg-surface-dim text-error border-error/30'
        }`}
      >
        <option value="" className="bg-surface-dim text-on-surface">-- UNASSIGNED --</option>
        {operators.map(op => (
          <option key={op.id} value={op.id} className="bg-surface-dim text-on-surface">{op.name.toUpperCase()}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-on-surface-dim opacity-40 pointer-events-none" />
    </div>
  );

  return (
    <div className="p-6 lg:p-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            SHIFT <span className="text-primary italic font-medium ml-3">OPERATIONS</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em]">FUEL SERVICES HUB</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Fleet Deployment Active</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Shift Selector */}
          <div className="relative">
            <select
              value={selectedBriefingShift}
              onChange={(e) => setSelectedBriefingShift(e.target.value as BriefingShift)}
              className="appearance-none px-6 py-3 pr-10 kinetic-gradient text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-premium cursor-pointer outline-none"
              style={{ colorScheme: 'dark' }}
            >
              <option value="Morning" className="bg-surface-dim text-on-surface">Morning (07:30-16:00)</option>
              <option value="Evening" className="bg-surface-dim text-on-surface">Evening (15:00-23:30)</option>
              <option value="Night" className="bg-surface-dim text-on-surface">Night (22:30-08:30)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface-dim p-1.5 rounded-2xl border border-outline shadow-inner relative flex w-full md:w-fit overflow-x-auto scrollbar-none">
        <div 
          className={`absolute top-1.5 bottom-1.5 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
            ${activeTab === 'international' ? 'w-[calc(16.6%-3px)] left-1.5 md:w-[140px] md:translate-x-0' : ''}
            ${activeTab === 'domestic' ? 'w-[calc(16.6%-3px)] left-[calc(16.6%+1.5px)] md:w-[110px] md:left-1.5 md:translate-x-[140px]' : ''}
            ${activeTab === 'adhoc' ? 'w-[calc(16.6%-3px)] left-[calc(33.3%+1.5px)] md:w-[110px] md:left-1.5 md:translate-x-[250px]' : ''}
            ${activeTab === 'equipment' ? 'w-[calc(16.6%-3px)] left-[calc(50%+1.5px)] md:w-[110px] md:left-1.5 md:translate-x-[360px]' : ''}
            ${activeTab === 'status' ? 'w-[calc(16.6%-3px)] left-[calc(66.6%+1.5px)] md:w-[150px] md:left-1.5 md:translate-x-[470px]' : ''}
            ${activeTab === 'live' ? 'w-[calc(16.6%-3px)] left-[calc(83.3%+1.5px)] md:w-[150px] md:left-1.5 md:translate-x-[620px]' : ''}
          `}
        />
        <button
          onClick={() => setActiveTab('international')}
          className={`flex-1 md:w-[140px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'international' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden md:block whitespace-nowrap">International</span>
        </button>
        <button
          onClick={() => setActiveTab('domestic')}
          className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'domestic' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden md:block whitespace-nowrap">Domestic</span>
        </button>
        <button
          onClick={() => setActiveTab('adhoc')}
          className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'adhoc' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden md:block whitespace-nowrap">Ad-Hoc</span>
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex-1 md:w-[110px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'equipment' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          {currentShiftLabel === 'DIESEL' ? (
            <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          ) : (
            <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          )}
          <span className="hidden md:block whitespace-nowrap">{currentShiftLabel}</span>
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 md:w-[150px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'status' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden md:block whitespace-nowrap">Status Board</span>
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 md:w-[150px] flex items-center justify-center gap-1.5 sm:gap-2.5 px-2 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
            activeTab === 'live' ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
          }`}
        >
          <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden md:block whitespace-nowrap">Live Feed</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-surface rounded-3xl border border-outline overflow-hidden shadow-sm relative">
        <div key={activeTab}>
        {/* International Ops */}
        {activeTab === 'international' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-outline">
                <thead className="bg-surface-dim">
                  <tr>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">FLIGHT / TASK</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">REG / TYPE / ROUTE</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TIMINGS</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">OPERATOR ASSIGNED</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                  </tr>
                </thead>
                <tbody className="bg-surface divide-y divide-outline text-on-surface">
                  {scheduledFlights.map((item, idx) => {
                    const logoUrl = getLogoUrl(item.flightNumber);
                    const delayed = isDelayed(item.sta, item.eta);
                    const activeEquipmentUsage = item.equipmentUsage || 'HYDRANT';
                    return (
                      <tr key={item.id} className={`hover:bg-primary/[0.02] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                        <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                                {/* Yellow gradient stand badge */}
                                <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                                    {item.stand}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xl font-[900] tracking-tighter italic">{item.flightNumber}</span>
                                    {logoUrl && (
                                      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                        <img
                                          src={logoUrl}
                                          alt=""
                                          aria-hidden="true"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          className="w-full h-full object-contain select-none flex-shrink-0"
                                        />
                                      </div>
                                    )}
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-6">
                                <div>
                                    <div className="text-sm font-black tracking-tight">{item.aircraftReg}</div>
                                    <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{item.aircraftType}</div>
                                </div>
                                <div className="h-6 w-[1px] bg-outline/30" />
                                <div>
                                    {renderRoute(item.route)}
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest bg-surface-dim/30 px-4 py-2 rounded-full border border-outline/30 w-fit">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-on-surface-dim opacity-40">STA</span>
                                    <span className="text-on-surface text-xs font-black tracking-tight">{(item as any).sta || '--:--'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</span>
                                    <span className={`${delayed ? 'text-error' : 'text-primary'} text-xs font-black tracking-tight`}>{item.eta || '--:--'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-warning opacity-60">STD</span>
                                    <span className="text-warning text-xs font-black tracking-tight">{(item as any).std || '--:--'}</span>
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-6 whitespace-nowrap w-[320px]">
                            {activeEquipmentUsage === 'REFUELLER' ? (
                              <div className="flex space-x-2">
                                  <div className="flex-1">
                                      <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                      {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                                  </div>
                                  <div className="flex-1">
                                      <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                                      {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val))}
                                  </div>
                              </div>
                            ) : (
                              <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                  {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                              </div>
                            )}
                        </td>
                        <td className="px-4 py-6 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end items-center space-x-2">
                                <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'HYDRANT')} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeEquipmentUsage === 'HYDRANT' ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent' : 'bg-surface-dim text-on-surface-dim border-outline hover:text-cyan-500 hover:border-cyan-500/50'}`}>HD</button>
                                <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'REFUELLER')} className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${activeEquipmentUsage === 'REFUELLER' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent' : 'bg-surface-dim text-on-surface-dim border-outline hover:text-amber-500 hover:border-amber-500/50'}`}>RF</button>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {scheduledFlights.map((item) => {
                const logoUrl = getLogoUrl(item.flightNumber);
                const delayed = isDelayed(item.sta, item.eta);
                const activeEquipmentUsage = item.equipmentUsage || 'HYDRANT';
                return (
                  <div key={item.id} className="card-premium p-4 sm:p-6 border-outline group transition-all active:scale-[0.98] max-w-md mx-auto w-full">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center min-w-0">
                        <div className="flex items-center gap-3">
                          {/* Yellow gradient stand badge */}
                          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                              {item.stand}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{item.flightNumber}</h3>
                              {logoUrl && (
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                  <img
                                    src={logoUrl}
                                    alt=""
                                    aria-hidden="true"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    className="w-full h-full object-contain select-none flex-shrink-0"
                                  />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">
                              {item.aircraftReg} • {item.aircraftType} {item.route ? `• ${item.route}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-surface-dim rounded-xl border border-outline">
                      <div className="text-center border-r border-outline/30">
                        <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                        <p className="text-[11px] font-[900] text-on-surface">{(item as any).sta || '--:--'}</p>
                      </div>
                      <div className="text-center border-r border-outline/30">
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                        <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{item.eta}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                        <p className="text-[11px] font-[900] text-warning">{(item as any).std || '--:--'}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Assigned Crew</label>
                          <div className="flex space-x-2">
                              <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'HYDRANT')} className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${activeEquipmentUsage === 'HYDRANT' ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-transparent' : 'bg-surface-dim text-on-surface-dim hover:text-cyan-500'}`}>HD</button>
                              <button onClick={() => handleAssignFlight(item.id, 'equipmentUsage', 'REFUELLER')} className={`px-2 py-1 text-[8px] font-black uppercase rounded transition-all ${activeEquipmentUsage === 'REFUELLER' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent' : 'bg-surface-dim text-on-surface-dim hover:text-amber-500'}`}>RF</button>
                          </div>
                      </div>
                      {activeEquipmentUsage === 'REFUELLER' ? (
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                                  {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                              </div>
                              <div>
                                  <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OFFICER</label>
                                  {renderOperatorSelect(item.assignedOfficer || '', (val) => handleAssignFlight(item.id, 'assignedOfficer', val))}
                              </div>
                          </div>
                      ) : (
                          <div>
                              <label className="block text-[8px] font-black text-on-surface-dim uppercase mb-1 tracking-widest opacity-40">OPERATOR</label>
                              {renderOperatorSelect(item.assignedTo, (val) => handleAssignFlight(item.id, 'assignedTo', val))}
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Domestic Ops */}
        {activeTab === 'domestic' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
               <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
               Squadron Assignments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12">
              {domesticTeams.map((team, idx) => (
                <div key={team.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                  <div className="flex items-center mb-8">
                    <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                      <Users className="w-5 h-5 text-on-surface" />
                    </div>
                    <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{team.name}</h4>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">RF OPERATOR</label>
                      {renderOperatorSelect(team.op1, (val) => handleAssignDomestic(team.id, 1, val))}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">OFFICER</label>
                      {renderOperatorSelect(team.op2, (val) => handleAssignDomestic(team.id, 2, val))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block bg-surface-lowest border border-outline rounded-[32px] overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-outline">
                  <thead className="bg-surface-dim">
                    <tr>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TASK ID</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ASSET / SECTOR</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ETD/ETA</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline text-on-surface">
                    {domesticFlightsToRender.map((flight, idx) => {
                      const logoUrl = getLogoUrl(flight.flightNumber);
                      return (
                        <tr key={flight.id} className={`hover:bg-primary/[0.01] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {/* Yellow gradient stand badge */}
                              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                                {flight.stand}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg font-[900] italic tracking-tighter">{flight.flightNumber}</span>
                                {logoUrl && (
                                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                    <img
                                      src={logoUrl}
                                      alt=""
                                      aria-hidden="true"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      className="w-full h-full object-contain select-none flex-shrink-0"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="text-sm font-black tracking-tight">{flight.aircraftType}</div>
                            <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                              <span>{flight.aircraftReg}</span>
                              {flight.route && (
                                <>
                                  <span>•</span>
                                  {renderRoute(flight.route, "text-[10px]")}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center text-sm font-black">
                              <Clock className="w-4 h-4 mr-2.5 opacity-40" />
                              {flight.eta}
                            </div>
                          </td>

                          <td className="px-4 py-6 whitespace-nowrap">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                flight.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]' : 
                                flight.status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-dim text-on-surface-dim border-outline'
                            }`}>
                                {flight.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden space-y-4">
              {domesticFlightsToRender.map((flight) => {
                const logoUrl = getLogoUrl(flight.flightNumber);
                const delayed = isDelayed(flight.sta, flight.eta);
                return (
                  <div key={flight.id} className="card-premium p-4 sm:p-6 border-outline group transition-all active:scale-[0.98] max-w-md mx-auto w-full">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                              {flight.stand}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{flight.flightNumber}</h3>
                              {logoUrl && (
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                  <img
                                    src={logoUrl}
                                    alt=""
                                    aria-hidden="true"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    className="w-full h-full object-contain select-none flex-shrink-0"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                              <span>{flight.aircraftReg}</span>
                              <span>•</span>
                              <span>{flight.aircraftType}</span>
                              {flight.route && (
                                <>
                                  <span>•</span>
                                  {renderRoute(flight.route, "text-[10px]")}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-surface-dim rounded-xl border border-outline">
                      <div className="text-center border-r border-outline/30">
                        <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                        <p className="text-[11px] font-[900] text-on-surface">{flight.sta || '--:--'}</p>
                      </div>
                      <div className="text-center border-r border-outline/30">
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                        <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{flight.eta}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                        <p className="text-[11px] font-[900] text-warning">{flight.std || '--:--'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline/30">
                      <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Status</span>
                      <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                          flight.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : 
                          flight.status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-dim text-on-surface-dim border-outline'
                      }`}>
                          {flight.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ad-Hoc Assignments */}
        {activeTab === 'adhoc' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
            {/* Desktop View */}
            <div className="hidden md:block bg-surface-lowest border border-outline rounded-[32px] overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-outline">
                  <thead className="bg-surface-dim">
                    <tr>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">TASK ID</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ASSET / SECTOR</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">ETD/ETA</th>
                      <th className="px-4 py-5 text-left text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline text-on-surface">
                    {adhocFlightsToRender.map((flight, idx) => {
                      const logoUrl = getLogoUrl(flight.flightNumber);
                      return (
                        <tr key={flight.id} className={`hover:bg-primary/[0.01] transition-colors group animate-in fade-in slide-in-from-left-4 duration-300 stagger-${Math.min(idx + 1, 5)}`}>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {/* Yellow gradient stand badge */}
                              <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                                {flight.stand}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg font-[900] italic tracking-tighter">{flight.flightNumber}</span>
                                {logoUrl && (
                                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                    <img
                                      src={logoUrl}
                                      alt=""
                                      aria-hidden="true"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      className="w-full h-full object-contain select-none flex-shrink-0"
                                    />
                                  </div>
                                )}
                                <span className="ml-2 bg-amber-500/10 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/20">
                                  Ad-Hoc
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="text-sm font-black tracking-tight">{flight.aircraftType}</div>
                            <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                              <span>{flight.aircraftReg}</span>
                              {flight.route && (
                                <>
                                  <span>•</span>
                                  {renderRoute(flight.route, "text-[10px]")}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-6 whitespace-nowrap">
                            <div className="flex items-center text-sm font-black">
                              <Clock className="w-4 h-4 mr-2.5 opacity-40" />
                              {flight.eta}
                            </div>
                          </td>

                          <td className="px-4 py-6 whitespace-nowrap">
                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                flight.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]' : 
                                flight.status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-dim text-on-surface-dim border-outline'
                            }`}>
                                {flight.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden space-y-4">
              {adhocFlightsToRender.map((flight) => {
                const logoUrl = getLogoUrl(flight.flightNumber);
                const delayed = isDelayed(flight.sta, flight.eta);
                return (
                  <div key={flight.id} className="card-premium p-4 sm:p-6 border-outline group transition-all active:scale-[0.98] max-w-md mx-auto w-full">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 text-[10px] font-[900] px-2 py-0.5 rounded-md shadow-sm select-none uppercase tracking-wider">
                              {flight.stand}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="text-2xl font-[900] text-on-surface tracking-tighter italic uppercase">{flight.flightNumber}</h3>
                              {logoUrl && (
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                  <img
                                    src={logoUrl}
                                    alt=""
                                    aria-hidden="true"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    className="w-full h-full object-contain select-none flex-shrink-0"
                                  />
                                </div>
                              )}
                              <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/20">
                                Ad-Hoc
                              </span>
                            </div>
                            <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>{flight.aircraftReg}</span>
                              <span>•</span>
                              <span>{flight.aircraftType}</span>
                              {flight.route && (
                                <>
                                  <span>•</span>
                                  {renderRoute(flight.route, "text-[10px]")}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-surface-dim rounded-xl border border-outline">
                      <div className="text-center border-r border-outline/30">
                        <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">STA</p>
                        <p className="text-[11px] font-[900] text-on-surface">{flight.sta || '--:--'}</p>
                      </div>
                      <div className="text-center border-r border-outline/30">
                        <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${delayed ? 'text-error opacity-60' : 'text-primary opacity-60'}`}>ETA</p>
                        <p className={`text-[11px] font-[900] ${delayed ? 'text-error' : 'text-primary'}`}>{flight.eta}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-warning opacity-60 uppercase tracking-widest mb-1">STD</p>
                        <p className="text-[11px] font-[900] text-warning">{flight.std || '--:--'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-outline/30">
                      <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Status</span>
                      <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                          flight.status === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' : 
                          flight.status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-dim text-on-surface-dim border-outline'
                      }`}>
                          {flight.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Equipment Assignments */}
        {activeTab === 'equipment' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                 Tactical Fleet Assignment - {currentShiftLabel}
              </h3>
            </div>

            <div className="space-y-12">
              {['Refueller', 'Hydrant Dispenser'].map(type => {
                const eqs = equipmentAssignments.filter(eq => (currentShiftLabel === 'DAILY' || dieselNeeds.includes(eq.eqNumber)) && eq.eqType === type);
                if (eqs.length === 0) return null;
                return (
                  <div key={type}>
                    <h4 className="text-xs font-black text-on-surface-dim uppercase tracking-[0.3em] mb-6 border-b border-outline pb-2">
                        {type === 'Refueller' ? 'Refuellers (RF)' : 'Hydrant Dispensers (HD)'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {eqs.map(eq => (
                        <div key={eq.id} className="card-premium p-4 sm:p-6 group hover:border-primary/20 transition-colors w-full">
                          <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                              <div className="p-3 bg-surface-dim rounded-2xl border border-outline mr-4 group-hover:border-primary/30 transition-all">
                                <Truck className="w-5 h-5 text-on-surface" />
                              </div>
                              <h4 className="text-xl font-[900] text-on-surface italic uppercase tracking-tighter">{eq.eqNumber}</h4>
                            </div>
                            {dieselNeeds.includes(eq.eqNumber) && (
                              <div className="flex items-center space-x-1 px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 shadow-sm animate-pulse">
                                <Droplet className="w-3 h-3" />
                                <span className="text-[8px] font-black uppercase tracking-widest">DIESEL</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-6">
                            <div>
                              <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Operator</label>
                              {renderOperatorSelect(eq.op1, (val) => handleAssignEquipment(eq.id, 1, val))}
                            </div>
                            {type === 'Refueller' && currentShiftLabel !== 'DIESEL' && (
                              <div>
                                <label className="block text-[9px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Officer</label>
                                {renderOperatorSelect(eq.op2, (val) => handleAssignEquipment(eq.id, 2, val))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Board */}
        {activeTab === 'status' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 p-4 md:p-8 lg:p-10 space-y-10">
            <div className="flex items-center">
              <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                 <span className="w-1.5 h-6 bg-primary rounded-full mr-4"></span>
                 Operator Task Boards
              </h3>
              <span className="ml-6 w-8 h-[1px] bg-outline flex-1"></span>
              <span className="ml-6 text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">{operators.length} Personnel Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {operators.map((op) => {
                    const opTasks = flightJobs.filter((j: any) => j.assignedTo === op.id || j.assignedOfficer === op.id);
                    const activeTask = opTasks.find((j: any) => j.status === 'IN_PROGRESS');
                    const pendingCount = opTasks.filter((j: any) => j.status === 'PENDING').length;
                    const doneCount = opTasks.filter((j: any) => j.status === 'COMPLETED').length;
                    
                    const eqAssignment = equipmentAssignments.find(a => a.op1 === op.id || a.op2 === op.id);
                    const domAssignment = domesticTeams.find(a => a.op1 === op.id || a.op2 === op.id);

                    return (
                        <div key={op.id} className="card-premium p-4 sm:p-6 space-y-4 sm:space-y-6 hover:border-primary/20 transition-colors group relative overflow-hidden w-full">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            
                            {/* Operator Header */}
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center space-x-4">
                                    <img src={op.avatar} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border border-outline shadow-sm group-hover:scale-105 transition-transform shrink-0" />
                                    <div>
                                        <p className="text-[15px] font-[900] text-on-surface uppercase tracking-tight">{op.name}</p>
                                        <p className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest">{op.role.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-[9px] font-[900] border uppercase tracking-widest transition-all ${
                                    activeTask
                                        ? 'bg-success/10 text-success border-success/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                                        : 'bg-surface-dim text-on-surface-dim border-outline opacity-50'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTask ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-on-surface-dim opacity-30'}`} />
                                    <span className="whitespace-nowrap">
                                      {activeTask ? (
                                        <><span className="hidden sm:inline">Refueling </span>{activeTask.flightNumber}{activeTask.vehicleId && <span className="ml-1 opacity-60">({activeTask.vehicleId})</span>}</>
                                      ) : 'Standby'}
                                    </span>
                                </div>
                            </div>

                            {/* Mini stats */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-4 relative z-10">
                                <div className="bg-surface-dim/70 backdrop-blur-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-outline/50 group-hover:border-outline transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-on-surface tracking-tighter leading-none mb-1 sm:mb-2">{opTasks.length}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Total</span>
                                </div>
                                <div className="bg-warning/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-warning/10 border-dashed group-hover:border-solid transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-warning tracking-tighter leading-none mb-1 sm:mb-2">{pendingCount}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-warning opacity-60 uppercase tracking-widest">Pending</span>
                                </div>
                                <div className="bg-success/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col items-center border border-success/10 border-dashed group-hover:border-solid transition-all">
                                    <span className="text-lg sm:text-xl font-[900] text-success tracking-tighter leading-none mb-1 sm:mb-2">{doneCount}</span>
                                    <span className="text-[8px] sm:text-[9px] font-black text-success opacity-60 uppercase tracking-widest">Done</span>
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                {/* Equipment/Assignment Badge */}
                                {(eqAssignment || domAssignment) && (
                                    <div className="flex items-center space-x-3 bg-surface-lowest border border-outline px-4 py-3 rounded-2xl">
                                        {eqAssignment ? (
                                            <>
                                                <Truck className="w-4 h-4 text-on-surface-dim opacity-40" />
                                                <span className="text-[11px] font-black text-on-surface uppercase tracking-wider">{eqAssignment.eqNumber} <span className="opacity-50 text-[9px]">({eqAssignment.eqType})</span></span>
                                                <span className="text-[9px] text-on-surface-dim opacity-30 uppercase tracking-widest ml-auto">{eqAssignment.shift_type || 'Active'} Shift</span>
                                            </>
                                        ) : (
                                            <>
                                                <Users className="w-4 h-4 text-primary opacity-60" />
                                                <span className="text-[11px] font-black text-primary uppercase tracking-wider">{domAssignment?.name}</span>
                                                <span className="text-[9px] text-primary opacity-40 uppercase tracking-widest ml-auto">Domestic Ops</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Tasks list */}
                                {opTasks.length > 0 && (
                                    <div className="space-y-2.5">
                                        {opTasks.map(job => {
                                            const delayed = isDelayed(job.sta, job.eta);
                                            const ds = (delayed && job.status === 'PENDING') ? 'DELAYED' : job.status;
                                            return (
                                                <div key={job.id} className="flex items-center justify-between bg-surface-lowest border border-outline p-4 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl group/task hover:border-primary/20 transition-all gap-2">
                                                    <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                                                        <Plane className="w-4 h-4 text-on-surface-dim opacity-20 group-hover/task:rotate-12 transition-transform shrink-0" />
                                                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 min-w-0">
                                                            <span className="text-[11px] sm:text-[13px] font-[900] text-on-surface tracking-tighter uppercase italic">{job.flightNumber}</span>
                                                            <span className="text-[9px] sm:text-[10px] font-bold text-on-surface-dim opacity-40 uppercase tracking-widest truncate">{job.aircraftType}</span>
                                                            {job.vehicleId && (
                                                                <span className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
                                                                    {job.vehicleId}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all shrink-0 ${
                                                        ds === 'COMPLETED' ? 'text-success border-success/20 bg-success/5' :
                                                        ds === 'DELAYED' ? 'text-error border-error/20 bg-error/10 animate-pulse' :
                                                        ds === 'IN_PROGRESS' ? 'text-warning border-warning/20 bg-warning/5 animate-pulse' :
                                                        'text-on-surface-dim border-outline opacity-40'
                                                    }`}>{ds.replace('_', ' ')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {opTasks.length === 0 && (
                                    <div className="px-6 py-8 border border-dashed border-outline rounded-[32px] flex flex-col items-center justify-center opacity-40">
                                        <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em]">No tasks assigned today</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
        )}

        {/* Live Airport Feed */}
        {activeTab === 'live' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500 p-4 md:p-8 space-y-6">
            {/* Header controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-dim p-4 rounded-2xl border border-outline">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFidsType('arrival')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    fidsType === 'arrival' 
                      ? 'bg-primary text-white border-transparent' 
                      : 'bg-surface text-on-surface-dim border-outline hover:text-on-surface'
                  }`}
                >
                  Arrivals
                </button>
                <button
                  onClick={() => setFidsType('departure')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    fidsType === 'departure' 
                      ? 'bg-primary text-white border-transparent' 
                      : 'bg-surface text-on-surface-dim border-outline hover:text-on-surface'
                  }`}
                >
                  Departures
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Category filters */}
                <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-outline">
                  {['all', 'international', 'domestic'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFidsCategory(cat as any)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        fidsCategory === cat 
                          ? 'bg-primary text-white' 
                          : 'text-on-surface-dim hover:text-on-surface'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={fidsSearchQuery}
                    onChange={(e) => setFidsSearchQuery(e.target.value)}
                    placeholder="SEARCH FLIGHT..."
                    className="w-48 pl-4 pr-10 py-2.5 bg-surface border border-outline rounded-xl text-[10px] font-black uppercase tracking-wider outline-none focus:border-primary transition-all"
                  />
                  {fidsSearchQuery && (
                    <button 
                      onClick={() => setFidsSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-dim hover:text-on-surface text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Refresh button */}
                <button
                  onClick={() => refreshExternalFlights()}
                  disabled={isExternalFlightsLoading}
                  className="p-2.5 bg-surface border border-outline rounded-xl text-on-surface-dim hover:text-on-surface hover:border-primary disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
                  title="Refresh Live Data"
                >
                  <RefreshCw className={`w-4 h-4 ${isExternalFlightsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* FIDS Table / Feed */}
            {isExternalFlightsLoading && externalFlights.length === 0 ? (
              <div className="px-6 py-20 flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-60" />
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em]">Fetching live airport data...</p>
              </div>
            ) : filteredFidsFlights.length === 0 ? (
              <div className="px-6 py-20 border border-dashed border-outline rounded-[32px] flex flex-col items-center justify-center text-center opacity-50">
                <Plane className="w-10 h-10 text-on-surface-dim opacity-30 mb-4" />
                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.3em]">No flights found</p>
                <p className="text-[9px] font-medium text-on-surface-dim opacity-60 uppercase tracking-wider mt-1">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-outline shadow-sm">
                <table className="min-w-full divide-y divide-outline">
                  <thead className="bg-surface-dim">
                    <tr>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Airline</th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Flight</th>
                      <th className="px-6 py-4 text-left text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">{fidsType === 'arrival' ? 'Origin' : 'Destination'}</th>
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Scheduled</th>
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Estimated</th>
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Gate</th>
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Terminal</th>
                      <th className="px-6 py-4 text-center text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Live Status</th>
                      <th className="px-6 py-4 text-right text-[9px] font-black text-on-surface-dim uppercase tracking-wider opacity-60">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface divide-y divide-outline">
                    {filteredFidsFlights.map((flight, idx) => {
                      const isImported = isFlightImported(flight.flightNumber);
                      const statusColor = getFidsStatusColor(flight.status);
                      const airlineCode = (flight.airlineCode || flight.flightNumber || '').replace(/\s+/g, '').slice(0, 2).toLowerCase();

                      return (
                        <tr key={flight.id || idx} className="hover:bg-primary/[0.01] transition-colors group">
                          {/* Airline */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-surface-dim border border-outline flex items-center justify-center font-black text-[10px] text-on-surface-dim uppercase overflow-hidden">
                                {airlineCode ? (
                                  <img 
                                    src={`https://images.cocoon.co/airlines/${airlineCode}.png`} 
                                    alt={flight.airlineCode}
                                    onError={(e) => { (e.target as any).style.display = 'none'; }}
                                    className="w-full h-full object-contain p-1"
                                  />
                                ) : null}
                                <span className="group-hover:scale-110 transition-transform">{flight.airlineCode || flight.airline?.slice(0, 2)}</span>
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-on-surface uppercase tracking-tight">{flight.airline}</p>
                                <p className="text-[8px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">{flight.category}</p>
                              </div>
                            </div>
                          </td>
                          {/* Flight Number */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-[14px] font-[900] text-on-surface italic tracking-tight uppercase">{flight.flightNumber}</span>
                          </td>
                          {/* Route */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-3.5 h-3.5 text-on-surface-dim opacity-30 shrink-0" />
                              <span className="text-[12px] font-black text-on-surface uppercase tracking-wide">
                                {fidsType === 'arrival' 
                                  ? `${flight.origin} (${flight.originCode || '---'})` 
                                  : `${flight.destination} (${flight.destinationCode || '---'})`
                                }
                              </span>
                            </div>
                          </td>
                          {/* Scheduled */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-xs font-mono font-bold text-on-surface">{flight.scheduledTime}</span>
                          </td>
                          {/* Estimated */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`text-xs font-mono font-bold ${flight.estimatedTime && flight.estimatedTime !== flight.scheduledTime ? 'text-warning' : 'text-on-surface-dim opacity-50'}`}>
                              {flight.estimatedTime || flight.scheduledTime}
                            </span>
                          </td>
                          {/* Gate */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-xs font-black text-on-surface-dim uppercase">{flight.gate || '---'}</span>
                          </td>
                          {/* Terminal */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-xs font-black text-on-surface-dim opacity-60 uppercase">{flight.terminal || '---'}</span>
                          </td>
                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusColor}`}>
                              {flight.status || 'Scheduled'}
                            </span>
                          </td>
                          {/* Action */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {isImported ? (
                              <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-success/10 text-success border border-success/20">
                                Imported
                              </span>
                            ) : (
                              <button
                                onClick={() => handleImportClick(flight)}
                                className="px-4 py-2 bg-gradient-to-r from-primary to-primary-container text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-sm"
                              >
                                Import to FMS
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Add Flight Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setIsModalOpen(false); setPrefillData(null); }}>
            <div className="bg-surface-lowest rounded-[40px] shadow-2xl w-full max-w-lg p-10 border border-outline relative overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                
                <h3 className="text-3xl font-[900] text-on-surface mb-8 tracking-tighter uppercase italic relative z-10">INITIATE TASK</h3>
                <form key={prefillData ? `${prefillData.flightNumber}-${prefillData.sta}-${prefillData.std}` : 'empty'} onSubmit={handleAddFlight} className="space-y-8 relative z-10">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Flight Identity</label>
                            <input name="flight" defaultValue={prefillData?.flightNumber || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. EK405" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Route</label>
                            <input name="route" defaultValue={prefillData?.route || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. DXB-MLE-DXB" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Airframe</label>
                            <input name="ac" required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. B777" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Tactical Stand</label>
                            <input name="stand" defaultValue={prefillData?.stand || ''} required className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" placeholder="E.G. D12" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STA</label>
                            <input name="sta" type="time" defaultValue={prefillData?.sta || ''} required={!prefillData?.std} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">ETA</label>
                            <input name="eta" type="time" defaultValue={prefillData?.eta || ''} required={!prefillData?.std} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">STD</label>
                            <input name="std" type="time" defaultValue={prefillData?.std || ''} required={!prefillData?.sta} className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-5 mt-10">
                        <button 
                            type="button" 
                            onClick={() => { setIsModalOpen(false); setPrefillData(null); }}
                            className="px-8 py-4 text-[10px] font-black text-on-surface-dim hover:text-on-surface uppercase tracking-[0.2em] transition-all"
                        >
                            ABORT
                        </button>
                        <button 
                            type="submit" 
                            className="px-10 py-4 kinetic-gradient text-white font-[900] text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all"
                        >
                            CONFIRM DEPLOYMENT
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}

      {isModalOpen && (
        <style>{`
          .modal-open, .modal-open body {
            overflow: hidden !important;
            height: 100% !important;
          }
          .modal-open #bottom-nav,
          .modal-open header,
          .modal-open #sidebar {
            display: none !important;
          }
        `}</style>
      )}
    </div>
  );
};