import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import { FlightJob } from '../types';

/**
 * Shared "Departure & Fuel Request Timings" modal.
 * Used from both the Schedule module and the Into-Plane ops module timings banner.
 */
export const EditFuelRequestModal: React.FC<{
  flight: FlightJob;
  onClose: () => void;
  onSave: (updates: {
    std?: string;
    tobt?: string;
    frtAirline?: string;
    frtAocc?: string;
    frtFor?: string;
  }) => Promise<void> | void;
}> = ({ flight, onClose, onSave }) => {
  const [std, setStd] = useState(flight.std || '');
  const [tobt, setTobt] = useState(flight.tobt || '');
  const [frtAirline, setFrtAirline] = useState(flight.frtAirline || '');
  const [frtAocc, setFrtAocc] = useState(flight.frtAocc || '');
  const [frtFor, setFrtFor] = useState(flight.frtFor || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        std: std.trim() || undefined,
        tobt: tobt.trim() || undefined,
        frtAirline: frtAirline.trim() || undefined,
        frtAocc: frtAocc.trim() || undefined,
        frtFor: frtFor.trim() || undefined
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-premium text-on-surface animate-in zoom-in-95 duration-200 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Departure &amp; Fuel Request Timings</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                {flight.flightNumber} • STAND {flight.stand || '---'} • {flight.aircraftReg || flight.aircraftType || ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
                Scheduled Dep (STD)
              </label>
              <input
                type="text"
                placeholder="HH:MM"
                value={std}
                onChange={(e) => setStd(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono text-on-surface"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1.5 font-bold">
                TOBT (DEP STD Change)
              </label>
              <input
                type="text"
                placeholder="HH:MM"
                value={tobt}
                onChange={(e) => setTobt(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-dim border border-amber-500/40 rounded-2xl text-[13px] font-black tracking-wider focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all font-mono text-amber-400"
              />
              <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Target Off-Block Time</span>
            </div>
          </div>

          <div className="p-4 bg-surface-dim/50 border border-outline/60 rounded-2xl space-y-3">
            <span className="block text-[9px] font-black text-primary uppercase tracking-widest">
              Fuel Request Times (FRT)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT Airline
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtAirline}
                  onChange={(e) => setFrtAirline(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Airline Request</span>
              </div>

              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT AOCC
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtAocc}
                  onChange={(e) => setFrtAocc(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">AOCC Request</span>
              </div>

              <div>
                <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-wider mb-1 opacity-70">
                  FRT For
                </label>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={frtFor}
                  onChange={(e) => setFrtFor(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-outline rounded-xl text-xs font-black tracking-wider focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-on-surface"
                />
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-0.5">Requested For</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-surface-dim border border-outline text-on-surface-dim hover:text-on-surface rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 kinetic-gradient text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-premium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Timings'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
