import React, { useState, useEffect, useCallback } from 'react';
import { Plane, Plus, Pencil, Trash2, X, Check, Search, RefreshCw, ChevronDown, ChevronRight, ShieldAlert, Layers } from 'lucide-react';
import { UserRole } from '../types';
import type { AirlineMaster, FlightMaster, AircraftMaster, AirlineHierarchyNode } from '../types';
import { supabaseService } from '../services/supabaseService';
import type { NotificationType } from '../context/NotificationContext';
import masterDbData from '../services/masterDbData.json';

interface FlightMasterTabProps {
  push: (msg: string, type?: NotificationType) => void;
  confirm: (msg: string, cb: () => void) => void;
  currentUser?: any;
}

interface ModalState {
  type: 'airline' | 'flight' | 'aircraft' | null;
  mode: 'add' | 'edit';
  data?: any;
  targetAirlineId?: string;
  targetAirlineName?: string;
}

export const FlightMasterTab: React.FC<FlightMasterTabProps> = ({ push, confirm, currentUser }) => {

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === 'ADMIN';

  const [hierarchy, setHierarchy] = useState<AirlineHierarchyNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'INT' | 'DOM'>('INT');
  const [expandedAirlines, setExpandedAirlines] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<ModalState>({ type: null, mode: 'add' });

  // Form State
  const [airlineName, setAirlineName] = useState('');
  const [iataCode, setIataCode] = useState('');
  const [icaoCode, setIcaoCode] = useState('');
  const [airlineCategory, setAirlineCategory] = useState<'INT' | 'DOM'>('INT');

  const [flightNumber, setFlightNumber] = useState('');
  const [flightRoute, setFlightRoute] = useState('');

  const [aircraftReg, setAircraftReg] = useState('');
  const [aircraftType, setAircraftType] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getMasterDBHierarchy();
      setHierarchy(data);
      if (data.length > 0) {
        setExpandedAirlines(prev => new Set(prev).add(data[0].airline.id));
      }
    } catch (err: any) {
      console.error('[FlightMasterTab] Error loading hierarchy:', err);
      push('Failed to load Master DB hierarchy.', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpandedAirlines(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBigQuerySync = async () => {
    if (!isAdmin) return;
    confirm('Sync all distinct historical Scheduled INT & DOM Airlines, Flight Numbers, and Aircraft Registrations extracted from BigQuery (14,728 Log Records)?', async () => {
      setSyncing(true);
      push('Syncing Master Database from BigQuery log dataset...', 'info');
      try {
        const stats = await supabaseService.bulkSeedMasterDB(masterDbData as any[]);
        push(`BigQuery Sync Complete! Synced ${stats.airlinesCount} Airlines (${stats.flightsCount} Flight Numbers, ${stats.aircraftsCount} Registered Aircrafts).`, 'success');
        await loadData();
      } catch (err: any) {
        console.error('[FlightMasterTab] Sync error:', err);
        push('Failed to complete BigQuery sync: ' + err.message, 'error');
      } finally {
        setSyncing(false);
      }
    });
  };

  // Open Modals
  const openAirlineModal = (mode: 'add' | 'edit', data?: AirlineMaster) => {
    setModal({ type: 'airline', mode, data });
    if (mode === 'edit' && data) {
      setAirlineName(data.name);
      setIataCode(data.iataCode || '');
      setIcaoCode(data.icaoCode || '');
      setAirlineCategory(data.category || 'INT');
    } else {
      setAirlineName('');
      setIataCode('');
      setIcaoCode('');
      setAirlineCategory('INT');
    }
  };

  const openFlightModal = (mode: 'add' | 'edit', targetAirline: { id: string; name: string }, data?: FlightMaster) => {
    setModal({ type: 'flight', mode, data, targetAirlineId: targetAirline.id, targetAirlineName: targetAirline.name });
    if (mode === 'edit' && data) {
      setFlightNumber(data.flightNumber);
      setFlightRoute(data.route || '');
    } else {
      setFlightNumber('');
      setFlightRoute('');
    }
  };

  const openAircraftModal = (mode: 'add' | 'edit', targetAirline: { id: string; name: string }, data?: AircraftMaster) => {
    setModal({ type: 'aircraft', mode, data, targetAirlineId: targetAirline.id, targetAirlineName: targetAirline.name });
    if (mode === 'edit' && data) {
      setAircraftReg(data.aircraftReg);
      setAircraftType(data.aircraftType);
    } else {
      setAircraftReg('');
      setAircraftType('');
    }
  };

  const closeModal = () => setModal({ type: null, mode: 'add' });

  // Save Actions
  const saveAirline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airlineName.trim()) return push('Airline name is required', 'warning');
    try {
      if (modal.mode === 'add') {
        await supabaseService.addAirline(airlineName, iataCode, icaoCode, airlineCategory);
        push(`Airline "${airlineName}" created successfully`, 'success');
      } else if (modal.data) {
        await supabaseService.updateAirline(modal.data.id, { name: airlineName, iataCode, icaoCode, category: airlineCategory });
        push(`Airline updated successfully`, 'success');
      }
      closeModal();
      loadData();
    } catch (err: any) {
      push(err.message || 'Error saving airline', 'error');
    }
  };

  const saveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) return push('Flight number is required', 'warning');
    try {
      if (modal.mode === 'add' && modal.targetAirlineId && modal.targetAirlineName) {
        await supabaseService.addFlightMaster(modal.targetAirlineId, modal.targetAirlineName, flightNumber, flightRoute);
        push(`Flight ${flightNumber} added`, 'success');
      } else if (modal.data) {
        await supabaseService.updateFlightMaster(modal.data.id, { flightNumber, route: flightRoute });
        push(`Flight updated successfully`, 'success');
      }
      closeModal();
      loadData();
    } catch (err: any) {
      push(err.message || 'Error saving flight', 'error');
    }
  };

  const saveAircraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aircraftReg.trim() || !aircraftType.trim()) return push('Registration and Aircraft Type are required', 'warning');
    try {
      if (modal.mode === 'add' && modal.targetAirlineId && modal.targetAirlineName) {
        await supabaseService.addAircraftMaster(modal.targetAirlineId, modal.targetAirlineName, aircraftReg, aircraftType);
        push(`Aircraft ${aircraftReg} (${aircraftType}) registered`, 'success');
      } else if (modal.data) {
        await supabaseService.updateAircraftMaster(modal.data.id, { aircraftReg, aircraftType });
        push(`Aircraft registration updated`, 'success');
      }
      closeModal();
      loadData();
    } catch (err: any) {
      push(err.message || 'Error saving aircraft registration', 'error');
    }
  };

  // Delete Actions
  const handleDeleteAirline = (id: string, name: string) => {
    confirm(`Delete Airline "${name}" and all associated flight numbers and aircraft registrations?`, async () => {
      try {
        await supabaseService.deleteAirline(id);
        push(`Airline "${name}" deleted`, 'info');
        loadData();
      } catch (err: any) {
        push(err.message || 'Failed to delete airline', 'error');
      }
    });
  };

  const handleDeleteFlight = (id: string, flt: string) => {
    confirm(`Delete Flight Number "${flt}"?`, async () => {
      try {
        await supabaseService.deleteFlightMaster(id);
        push(`Flight ${flt} deleted`, 'info');
        loadData();
      } catch (err: any) {
        push(err.message || 'Failed to delete flight', 'error');
      }
    });
  };

  const handleDeleteAircraft = (id: string, reg: string) => {
    confirm(`Delete Aircraft Registration "${reg}"?`, async () => {
      try {
        await supabaseService.deleteAircraftMaster(id);
        push(`Aircraft registration ${reg} deleted`, 'info');
        loadData();
      } catch (err: any) {
        push(err.message || 'Failed to delete aircraft registration', 'error');
      }
    });
  };

  // Filtered view
  const filteredHierarchy = hierarchy.filter(node => {
    const nodeCat = node.airline.category || 'INT';
    if (nodeCat !== categoryFilter) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchAirline = node.airline.name.toLowerCase().includes(q) || (node.airline.iataCode && node.airline.iataCode.toLowerCase().includes(q));
    const matchFlight = node.flights.some(f => f.flightNumber.toLowerCase().includes(q));
    const matchAircraft = node.aircrafts.some(a => a.aircraftReg.toLowerCase().includes(q) || a.aircraftType.toLowerCase().includes(q));
    return matchAirline || matchFlight || matchAircraft;
  });

  const intCount = hierarchy.filter(n => (n.airline.category || 'INT') === 'INT').length;
  const domCount = hierarchy.filter(n => n.airline.category === 'DOM').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-6 rounded-3xl border border-outline">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Plane className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black uppercase tracking-tight">Airline & Aircraft Master DB</h2>
          </div>
          <p className="text-xs text-on-surface-dim">
            Manage international and domestic scheduled airlines, flight numbers, and aircraft registrations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isAdmin && (
            <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border border-warning/20 text-warning rounded-2xl text-[10px] font-black uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4" />
              <span>Read-Only View (Admin Required to Edit)</span>
            </div>
          )}

          {isAdmin && (
            <>
              <button
                onClick={handleBigQuerySync}
                disabled={syncing}
                className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient text-white shadow-premium rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 border-none hover:opacity-90"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'SYNCING...' : 'SYNC INT & DOM FROM BIGQUERY'}
              </button>

              <button
                onClick={() => openAirlineModal('add')}
                className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient text-white shadow-premium rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border-none hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                ADD NEW AIRLINE
              </button>
            </>
          )}
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* INT / DOM Category Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-low border border-outline rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => setCategoryFilter('INT')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              categoryFilter === 'INT'
                ? 'kinetic-gradient text-white shadow-premium'
                : 'text-on-surface-dim hover:text-on-surface'
            }`}
          >
            INT ({intCount})
          </button>
          <button
            onClick={() => setCategoryFilter('DOM')}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              categoryFilter === 'DOM'
                ? 'kinetic-gradient text-white shadow-premium'
                : 'text-on-surface-dim hover:text-on-surface'
            }`}
          >
            DOM ({domCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-on-surface-dim absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by Airline, Flight (e.g. EK658), or Tail (e.g. 8Q-IAI)..."
            className="w-full pl-11 pr-4 py-2.5 bg-surface-container-low border border-outline rounded-2xl text-xs font-semibold text-on-surface placeholder:text-on-surface-dim/50 focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Hierarchy Content */}
      {loading ? (
        <div className="p-12 text-center text-on-surface-dim">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
          <p className="text-xs font-mono uppercase tracking-widest">Loading Master Database Hierarchy...</p>
        </div>
      ) : filteredHierarchy.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-low rounded-3xl border border-outline">
          <Layers className="w-10 h-10 text-on-surface-dim/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-on-surface mb-1 uppercase">No {categoryFilter} Master Records Found</h3>
          <p className="text-xs text-on-surface-dim max-w-md mx-auto mb-6">
            No matching {categoryFilter} airlines, flight numbers, or aircraft registrations were found in the database.
          </p>
          {isAdmin && (
            <button
              onClick={handleBigQuerySync}
              className="inline-flex items-center gap-2 px-6 py-3.5 kinetic-gradient text-white shadow-premium rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-none hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" />
              SEED FROM HISTORICAL BIGQUERY DATA
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHierarchy.map(({ airline, flights, aircrafts }) => {
            const isExpanded = expandedAirlines.has(airline.id);
            const cat = airline.category || 'INT';

            return (
              <div key={airline.id} className="bg-surface-container-low border border-outline rounded-3xl overflow-hidden transition-all shadow-sm">
                {/* Airline Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-surface-container/50 transition-colors" onClick={() => toggleExpand(airline.id)}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button className="p-1 rounded-lg text-on-surface-dim hover:text-on-surface shrink-0">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-primary" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-on-surface uppercase tracking-tight">{airline.name}</h3>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          cat === 'INT'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {cat}
                        </span>
                        {airline.iataCode && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-black uppercase tracking-wider">
                            {airline.iataCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-on-surface-dim mt-0.5">
                        {flights.length} Flight Numbers • {aircrafts.length} Registered Aircrafts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => openFlightModal('add', { id: airline.id, name: airline.name })}
                          className="px-3 py-1.5 kinetic-gradient text-white shadow-premium rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border-none hover:opacity-90"
                        >
                          + Flight
                        </button>
                        <button
                          onClick={() => openAircraftModal('add', { id: airline.id, name: airline.name })}
                          className="px-3 py-1.5 kinetic-gradient text-white shadow-premium rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border-none hover:opacity-90"
                        >
                          + Aircraft
                        </button>
                        <button
                          onClick={() => openAirlineModal('edit', airline)}
                          className="p-1.5 text-on-surface-dim hover:text-primary transition-colors"
                          title="Edit Airline"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAirline(airline.id, airline.name)}
                          className="p-1.5 text-on-surface-dim hover:text-error transition-colors"
                          title="Delete Airline"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-outline p-6 bg-surface-container-lowest/50 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Flights Column */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-outline pb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5" /> Flight Numbers ({flights.length})
                        </h4>
                        {isAdmin && (
                          <button
                            onClick={() => openFlightModal('add', { id: airline.id, name: airline.name })}
                            className="text-[10px] font-black text-primary hover:underline uppercase"
                          >
                            + Add Flight
                          </button>
                        )}
                      </div>

                      {flights.length === 0 ? (
                        <p className="text-xs text-on-surface-dim italic py-2">No flight numbers registered.</p>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {flights.map(flt => (
                            <div key={flt.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl border border-outline hover:border-primary/30 transition-all">
                              <div>
                                <span className="font-bold text-xs text-on-surface font-mono tracking-wider">{flt.flightNumber}</span>
                                {flt.route && <span className="text-[10px] text-on-surface-dim ml-2 font-medium">({flt.route})</span>}
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openFlightModal('edit', { id: airline.id, name: airline.name }, flt)} className="p-1.5 text-on-surface-dim hover:text-primary">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteFlight(flt.id, flt.flightNumber)} className="p-1.5 text-on-surface-dim hover:text-error">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Aircraft Registrations Column */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-outline pb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> Aircraft Registrations ({aircrafts.length})
                        </h4>
                        {isAdmin && (
                          <button
                            onClick={() => openAircraftModal('add', { id: airline.id, name: airline.name })}
                            className="text-[10px] font-black text-primary hover:underline uppercase"
                          >
                            + Add Registration
                          </button>
                        )}
                      </div>

                      {aircrafts.length === 0 ? (
                        <p className="text-xs text-on-surface-dim italic py-2">No aircraft registrations registered.</p>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {aircrafts.map(ac => (
                            <div key={ac.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl border border-outline hover:border-primary/30 transition-all">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-xs text-on-surface font-mono tracking-wider">{ac.aircraftReg}</span>
                                <span className="px-2 py-0.5 bg-surface-dim text-on-surface text-[10px] font-bold rounded-md uppercase">
                                  {ac.aircraftType}
                                </span>
                              </div>
                              {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openAircraftModal('edit', { id: airline.id, name: airline.name }, ac)} className="p-1.5 text-on-surface-dim hover:text-primary">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteAircraft(ac.id, ac.aircraftReg)} className="p-1.5 text-on-surface-dim hover:text-error">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {modal.type === 'airline' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveAirline} className="bg-surface-container-low border border-outline p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider">{modal.mode === 'add' ? 'Add New Airline' : 'Edit Airline'}</h3>
              <button type="button" onClick={closeModal} className="text-on-surface-dim hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Airline Name *</label>
                <input type="text" value={airlineName} onChange={e => setAirlineName(e.target.value)} required placeholder="e.g. Emirates" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-bold text-on-surface" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Category *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAirlineCategory('INT')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                      airlineCategory === 'INT'
                        ? 'kinetic-gradient text-white border-transparent shadow-premium'
                        : 'bg-surface-container border-outline text-on-surface-dim'
                    }`}
                  >
                    International (INT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAirlineCategory('DOM')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                      airlineCategory === 'DOM'
                        ? 'kinetic-gradient text-white border-transparent shadow-premium'
                        : 'bg-surface-container border-outline text-on-surface-dim'
                    }`}
                  >
                    Domestic (DOM)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">IATA Code</label>
                  <input type="text" value={iataCode} onChange={e => setIataCode(e.target.value)} placeholder="e.g. EK" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-mono uppercase font-bold text-on-surface" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">ICAO Code</label>
                  <input type="text" value={icaoCode} onChange={e => setIcaoCode(e.target.value)} placeholder="e.g. UAE" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-mono uppercase font-bold text-on-surface" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-xs font-bold text-on-surface-dim uppercase">Cancel</button>
              <button type="submit" className="px-6 py-2.5 kinetic-gradient text-white shadow-premium rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-none hover:opacity-90">Save Airline</button>
            </div>
          </form>
        </div>
      )}

      {modal.type === 'flight' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveFlight} className="bg-surface-container-low border border-outline p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider">{modal.mode === 'add' ? `Add Flight (${modal.targetAirlineName})` : 'Edit Flight Number'}</h3>
              <button type="button" onClick={closeModal} className="text-on-surface-dim hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Flight Number *</label>
                <input type="text" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} required placeholder="e.g. EK658" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-mono uppercase font-bold text-on-surface" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Route (Optional)</label>
                <input type="text" value={flightRoute} onChange={e => setFlightRoute(e.target.value)} placeholder="e.g. DXB - MLE - DXB" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-semibold text-on-surface" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-xs font-bold text-on-surface-dim uppercase">Cancel</button>
              <button type="submit" className="px-6 py-2.5 kinetic-gradient text-white shadow-premium rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-none hover:opacity-90">Save Flight</button>
            </div>
          </form>
        </div>
      )}

      {modal.type === 'aircraft' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveAircraft} className="bg-surface-container-low border border-outline p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider">{modal.mode === 'add' ? `Register Aircraft (${modal.targetAirlineName})` : 'Edit Aircraft Registration'}</h3>
              <button type="button" onClick={closeModal} className="text-on-surface-dim hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Aircraft Registration (Tail No.) *</label>
                <input type="text" value={aircraftReg} onChange={e => setAircraftReg(e.target.value)} required placeholder="e.g. 8Q-IAI" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-mono uppercase font-bold text-on-surface" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-on-surface-dim mb-1">Aircraft Type *</label>
                <input type="text" value={aircraftType} onChange={e => setAircraftType(e.target.value)} required placeholder="e.g. A320-200" className="w-full p-3 bg-surface-container border border-outline rounded-xl font-semibold uppercase font-bold text-on-surface" />
                <p className="text-[10px] text-on-surface-dim mt-1 italic">
                  Note: Aircraft registration permanently binds to this aircraft type.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-xs font-bold text-on-surface-dim uppercase">Cancel</button>
              <button type="submit" className="px-6 py-2.5 kinetic-gradient text-white shadow-premium rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border-none hover:opacity-90">Save Registration</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
