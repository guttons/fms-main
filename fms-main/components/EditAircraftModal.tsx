import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plane, MapPin, X } from 'lucide-react';
import { cleanAircraftTypeName, normalizeRegistration } from '../services/aircraftLookupService';

export const COMMON_AIRCRAFT_TYPES = [
  'A320',
  'A321',
  'A330',
  'A350',
  'B777',
  'B737',
  'B787',
  'B767',
  'B757',
  'DASH8',
  'ATR'
];

export const COMMON_MLE_STANDS = [
  '1', '2', '3', '4', '5', '8', '9', '10', '11', '12', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36',
  '37', '38', '39', '40', 'N', 'E'
];

export interface EditAircraftModalProps {
  flightNumber: string;
  initialType?: string;
  initialReg?: string;
  initialStand?: string;
  isDomestic?: boolean;
  isAdhoc?: boolean;
  onClose: () => void;
  onSave: (aircraftType: string, aircraftReg: string, stand?: string) => Promise<void> | void;
}

export interface FleetAircraft {
  reg: string;
  type: string;
}

export interface AirlineFleet {
  key: 'Q2' | 'NR' | 'VP';
  name: string;
  code: string;
  aircraft: FleetAircraft[];
}

export const DOMESTIC_FLEETS: Record<'Q2' | 'NR' | 'VP', AirlineFleet> = {
  Q2: {
    key: 'Q2',
    name: 'Maldivian',
    code: 'Q2',
    aircraft: [
      { reg: '8Q-AMD', type: 'DASH8' },
      { reg: '8Q-IAA', type: 'DASH8' },
      { reg: '8Q-IAK', type: 'DASH8' },
      { reg: '8Q-IAO', type: 'DASH8' },
      { reg: '8Q-IAR', type: 'DASH8' },
      { reg: '8Q-IAT', type: 'DASH8' },
      { reg: '8Q-IAQ', type: 'DASH8' },
      { reg: '8Q-IAS', type: 'DASH8' },
      { reg: '8Q-IAX', type: 'ATR' },
      { reg: '8Q-IAY', type: 'ATR' },
      { reg: '8Q-IAZ', type: 'ATR' },
      { reg: '8Q-IAW', type: 'ATR' },
      { reg: '8Q-IAV', type: 'ATR' },
      { reg: '8Q-IAB', type: 'A330' },
      { reg: '8Q-IAN', type: 'A320' },
    ]
  },
  NR: {
    key: 'NR',
    name: 'Manta Air',
    code: 'NR',
    aircraft: [
      { reg: '8Q-RAX', type: 'ATR' },
      { reg: '8Q-RAY', type: 'ATR' },
      { reg: '8Q-RAZ', type: 'ATR' },
    ]
  },
  VP: {
    key: 'VP',
    name: 'Villa Air',
    code: 'VP',
    aircraft: [
      { reg: '8Q-VAY', type: 'ATR' },
      { reg: '8Q-VAV', type: 'ATR' },
    ]
  }
};

const detectAirlineKey = (fn?: string, reg?: string, isDomestic?: boolean): 'Q2' | 'NR' | 'VP' | null => {
  const cleanFn = (fn || '').replace(/\s+/g, '').toUpperCase();
  if (cleanFn.startsWith('NR') || cleanFn.includes('MANTA')) return 'NR';
  if (cleanFn.startsWith('VP') || cleanFn.includes('VILLA') || cleanFn.includes('FLYME')) return 'VP';
  if (cleanFn.startsWith('Q2') || cleanFn.includes('MALDIVIAN') || cleanFn.includes('DQA') || cleanFn.includes('IAS')) return 'Q2';

  const cleanReg = (reg || '').replace(/\s+/g, '').toUpperCase();
  if (cleanReg.startsWith('8Q-RA') || cleanReg.startsWith('8QRA')) return 'NR';
  if (cleanReg.startsWith('8Q-VA') || cleanReg.startsWith('8QVA')) return 'VP';
  if (cleanReg.startsWith('8Q-IA') || cleanReg.startsWith('8QIA') || cleanReg.startsWith('8Q-AM') || cleanReg.startsWith('8QAM')) return 'Q2';

  if (isDomestic) return 'Q2';
  return null;
};

export const EditAircraftModal: React.FC<EditAircraftModalProps> = ({
  flightNumber,
  initialType,
  initialReg,
  initialStand,
  isDomestic,
  isAdhoc,
  onClose,
  onSave
}) => {
  const cleanInitialReg = (initialReg && initialReg !== '8Q-TBA' && !initialReg.startsWith('8Q-DOM')) ? initialReg : '';
  const cleanInitialType = initialType ? cleanAircraftTypeName(initialType) : '';
  const cleanInitialStand = initialStand && initialStand !== '---' && initialStand !== 'TBA' ? initialStand : '';

  const [acType, setAcType] = useState(cleanInitialType);
  const [acReg, setAcReg] = useState(cleanInitialReg);
  const [stand, setStand] = useState(cleanInitialStand);
  const [saving, setSaving] = useState(false);

  // Show only the relevant airline fleet based on the flight number
  const airlineKey = detectAirlineKey(flightNumber, initialReg, isDomestic);
  const fleet = airlineKey ? DOMESTIC_FLEETS[airlineKey] : null;

  const isStandApplicable = !isDomestic && !isAdhoc;

  // Handle selecting a fleet aircraft registration and auto-selecting associated type
  const handleSelectFleetAircraft = (item: FleetAircraft) => {
    setAcReg(item.reg);
    setAcType(item.type);
  };

  // Handle manual input in registration and auto-fill type if it matches known fleet
  const handleRegInputChange = (val: string) => {
    const upper = val.toUpperCase();
    setAcReg(upper);
    const norm = normalizeRegistration(upper);
    const matched = Object.values(DOMESTIC_FLEETS)
      .flatMap(f => f.aircraft)
      .find(a => a.reg === norm || a.reg === upper || a.reg.replace(/-/g, '') === upper.replace(/-/g, ''));
    if (matched) {
      setAcType(matched.type);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acType.trim()) return;
    setSaving(true);
    try {
      const normalizedType = cleanAircraftTypeName(acType.trim().toUpperCase());
      const normalizedReg = acReg.trim() ? normalizeRegistration(acReg.trim().toUpperCase()) : '';
      const normalizedStand = isStandApplicable ? stand.trim().toUpperCase() : undefined;
      await Promise.race([
        Promise.resolve(onSave(normalizedType, normalizedReg, normalizedStand)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 4000))
      ]);
      onClose();
    } catch (err) {
      console.warn('Flight details update handled:', err);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-premium text-on-surface animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">
                {isStandApplicable ? 'Edit Aircraft & Stand' : 'Edit Aircraft Details'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">{flightNumber}</p>
                {isDomestic && (
                  <span className="bg-sky-500/10 text-sky-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border border-sky-500/20">
                    Domestic
                  </span>
                )}
                {isAdhoc && (
                  <span className="bg-amber-500/10 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-500/20">
                    Ad-Hoc
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Aircraft Registration (Moved to Top) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-60">
                Aircraft Registration
              </label>
              {fleet && (
                <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
                  {fleet.code} &bull; {fleet.name} Fleet
                </span>
              )}
            </div>
            <input
              type="text"
              value={acReg}
              onChange={(e) => handleRegInputChange(e.target.value)}
              placeholder="e.g. 8Q-IAN"
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-primary font-mono"
            />

            {/* Quick Select Fleet Registrations for Relevant Airline */}
            {fleet && (
              <div className="mt-3">
                <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-50">
                  Quick Select {fleet.name} Fleet ({fleet.aircraft.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {fleet.aircraft.map((item) => {
                    const isSelected = acReg === item.reg;
                    return (
                      <button
                        key={item.reg}
                        type="button"
                        onClick={() => handleSelectFleetAircraft(item)}
                        className={`px-2.5 py-1.5 text-[10px] font-black uppercase rounded-xl border transition-all cursor-pointer active:scale-95 font-mono flex items-center gap-1.5 ${
                          isSelected
                            ? 'kinetic-gradient text-white border-transparent shadow-sm'
                            : 'bg-surface-dim border-outline text-on-surface-dim hover:border-primary/50 hover:text-on-surface'
                        }`}
                        title={`Select ${item.reg} (${item.type})`}
                      >
                        <span>{item.reg}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-primary font-sans'
                        }`}>
                          {item.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Aircraft Type (Moved Down, Type Options Removed) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-60">
                Aircraft Type
              </label>
              {acType && (
                <span className="text-[9px] font-black text-primary uppercase tracking-widest opacity-80 font-mono">
                  {acType}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={acType}
              onChange={(e) => setAcType(e.target.value.toUpperCase())}
              placeholder="e.g. A320, ATR, DASH8, B777"
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono"
            />
          </div>

          {/* 3. Stand is NOT needed for Domestic and Ad-hoc flights */}
          {isStandApplicable && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-60">
                  Assigned Stand / Bay
                </label>
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 uppercase tracking-widest">
                  <MapPin className="w-3 h-3" /> Stand
                </span>
              </div>
              <input
                type="text"
                value={stand}
                onChange={(e) => setStand(e.target.value.toUpperCase())}
                placeholder="e.g. 14, 22, N, E"
                className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-mono text-amber-400"
              />
              <div className="mt-2.5">
                <span className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-50">
                  Quick Select MLE Stands
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {COMMON_MLE_STANDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStand(s)}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer active:scale-95 font-mono ${
                        stand === s
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 border-transparent shadow-sm'
                          : 'bg-surface-dim border-outline text-on-surface-dim hover:border-amber-500/50 hover:text-on-surface'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-surface-dim border border-outline text-on-surface-dim hover:text-on-surface rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !acType.trim()}
              className="flex-1 py-3.5 kinetic-gradient text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-premium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export const EditFlightDetailsModal = EditAircraftModal;
