import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cleanAircraftTypeName, normalizeRegistration } from '../services/aircraftLookupService';

export interface AdhocFlightData {
  flightNumber: string;
  std: string;
  destination: string;
  aircraftReg: string;
  aircraftType: string;
  co: string;
  operatorName: string;
}

export interface AddAdhocFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (flightData: AdhocFlightData) => Promise<void> | void;
  notify?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export const AddAdhocFlightModal: React.FC<AddAdhocFlightModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  notify
}) => {
  const [adhocFlightNumber, setAdhocFlightNumber] = useState('');
  const [adhocStd, setAdhocStd] = useState('');
  const [adhocStdError, setAdhocStdError] = useState<string | null>(null);
  const [adhocDestination, setAdhocDestination] = useState('');
  const [adhocReg, setAdhocReg] = useState('');
  const [adhocType, setAdhocType] = useState('');
  const [adhocCo, setAdhocCo] = useState('');
  const [adhocOperatorName, setAdhocOperatorName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdhocStdError(null);

    const flt = adhocFlightNumber.trim().toUpperCase();
    const dest = adhocDestination.trim().toUpperCase();
    const reg = normalizeRegistration(adhocReg.trim().toUpperCase());
    const type = cleanAircraftTypeName(adhocType.trim().toUpperCase());
    const co = adhocCo.trim().toUpperCase();
    const op = adhocOperatorName.trim().toUpperCase();
    const stdInput = adhocStd.trim();

    if (!flt || !dest || !reg || !type || !co || !op) {
      notify?.('Please fill in all required fields (only DEP time is optional).', 'error');
      return;
    }

    let formattedStd = '---';
    if (stdInput) {
      const match = stdInput.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!match) {
        setAdhocStdError('Please enter a valid time (HH:MM from 00:00 to 23:59)');
        notify?.('Invalid DEP / STD time format. Use HH:MM.', 'error');
        return;
      }
      formattedStd = `${match[1].padStart(2, '0')}:${match[2]}`;
    }

    setIsSaving(true);
    try {
      await onAdd({
        flightNumber: flt,
        std: formattedStd,
        destination: dest,
        aircraftReg: reg,
        aircraftType: type,
        co,
        operatorName: op
      });
      // Reset form
      setAdhocFlightNumber('');
      setAdhocStd('');
      setAdhocStdError(null);
      setAdhocDestination('');
      setAdhocReg('');
      setAdhocType('');
      setAdhocCo('');
      setAdhocOperatorName('');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-surface-lowest/70 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      ></div>
      <div className="card-premium p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl border border-outline scale-in-center animate-in fade-in zoom-in duration-200 flex flex-col space-y-6">
        <div className="flex justify-between items-start border-b border-outline pb-4 shrink-0">
          <div>
            <h2 className="text-base font-black uppercase tracking-widest text-on-surface">Add Ad-Hoc Flight</h2>
            <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1.5">
              Input details for the ad-hoc flight
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-surface-container rounded-lg text-on-surface-dim hover:text-on-surface transition-colors border border-outline/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Flight Number *</label>
            <input 
              type="text"
              required
              style={{ textTransform: 'uppercase' }}
              value={adhocFlightNumber}
              onChange={(e) => setAdhocFlightNumber(e.target.value.toUpperCase())}
              className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider">DEP / STD (Time)</label>
                <span className="text-[9px] text-on-surface-dim opacity-50 uppercase tracking-wider">Optional</span>
              </div>
              <input 
                type="text"
                placeholder="HH:MM"
                style={{ textTransform: 'uppercase' }}
                value={adhocStd}
                onChange={(e) => {
                  setAdhocStd(e.target.value.toUpperCase());
                  setAdhocStdError(null);
                }}
                className={`w-full text-xs font-mono font-bold p-3 border rounded-xl text-on-surface focus:outline-none uppercase ${adhocStdError ? 'border-error bg-error/5 focus:border-error' : 'border-outline bg-surface-dim focus:border-warning'}`}
              />
              {adhocStdError && (
                <p className="text-[9px] font-bold text-error mt-1 tracking-wide">{adhocStdError}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Destination *</label>
              <input 
                type="text"
                required
                style={{ textTransform: 'uppercase' }}
                value={adhocDestination}
                onChange={(e) => setAdhocDestination(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Reg *</label>
              <input 
                type="text"
                required
                style={{ textTransform: 'uppercase' }}
                value={adhocReg}
                onChange={(e) => setAdhocReg(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Type *</label>
              <input 
                type="text"
                required
                style={{ textTransform: 'uppercase' }}
                value={adhocType}
                onChange={(e) => setAdhocType(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">C/O (Customer Name) *</label>
            <input 
              type="text"
              required
              style={{ textTransform: 'uppercase' }}
              value={adhocCo}
              onChange={(e) => setAdhocCo(e.target.value.toUpperCase())}
              className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">Operator Name *</label>
            <input 
              type="text"
              required
              style={{ textTransform: 'uppercase' }}
              value={adhocOperatorName}
              onChange={(e) => setAdhocOperatorName(e.target.value.toUpperCase())}
              className="w-full text-xs font-mono font-bold p-3 border border-outline bg-surface-dim rounded-xl text-on-surface focus:outline-none focus:border-warning uppercase"
            />
          </div>

          <div className="flex justify-end items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-surface-dim hover:bg-surface-container text-on-surface-dim hover:text-on-surface border border-outline rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 bg-warning text-slate-950 hover:bg-warning-hover rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-warning/20 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Adding...' : 'Add Flight'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
