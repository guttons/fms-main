import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plane, X } from 'lucide-react';
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

export interface EditAircraftModalProps {
  flightNumber: string;
  initialType?: string;
  initialReg?: string;
  onClose: () => void;
  onSave: (aircraftType: string, aircraftReg: string) => Promise<void> | void;
}

export const EditAircraftModal: React.FC<EditAircraftModalProps> = ({
  flightNumber,
  initialType,
  initialReg,
  onClose,
  onSave
}) => {
  const cleanInitialReg = (initialReg && initialReg !== '8Q-TBA' && !initialReg.startsWith('8Q-DOM')) ? initialReg : '';
  const cleanInitialType = initialType ? cleanAircraftTypeName(initialType) : '';

  const [acType, setAcType] = useState(cleanInitialType);
  const [acReg, setAcReg] = useState(cleanInitialReg);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acType.trim()) return;
    setSaving(true);
    try {
      const normalizedType = cleanAircraftTypeName(acType.trim().toUpperCase());
      const normalizedReg = acReg.trim() ? normalizeRegistration(acReg.trim().toUpperCase()) : '';
      await onSave(normalizedType, normalizedReg);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-premium text-on-surface animate-in zoom-in-95 duration-200 relative">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase">Edit Aircraft Details</h3>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">{flightNumber}</p>
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
          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">
              Aircraft Type
            </label>
            <input
              type="text"
              required
              value={acType}
              onChange={(e) => setAcType(e.target.value.toUpperCase())}
              placeholder="e.g. A320, ATR, B777"
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
            />
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {COMMON_AIRCRAFT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAcType(t)}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer active:scale-95 ${
                    cleanAircraftTypeName(acType.toUpperCase()) === t
                      ? 'kinetic-gradient text-white border-transparent shadow-sm'
                      : 'bg-surface-dim border-outline text-on-surface-dim hover:border-primary/50 hover:text-on-surface'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-2 opacity-60">
              Aircraft Registration
            </label>
            <input
              type="text"
              value={acReg}
              onChange={(e) => setAcReg(e.target.value.toUpperCase())}
              placeholder="e.g. 8Q-IAR"
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-2xl text-[13px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-primary"
            />
          </div>

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
