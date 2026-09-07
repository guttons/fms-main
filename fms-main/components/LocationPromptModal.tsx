import React from 'react';
import { MapPin, Navigation, ShieldCheck, X } from 'lucide-react';
import { haptic } from '../utils/haptics';

interface LocationPromptModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export const LocationPromptModal: React.FC<LocationPromptModalProps> = ({
  isOpen,
  onAllow,
  onDismiss,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-surface border border-outline rounded-[32px] p-6 sm:p-8 w-full max-w-md shadow-premium flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        {/* Close icon */}
        <button 
          onClick={() => {
            haptic('TAP');
            onDismiss();
          }}
          className="absolute right-4 top-4 p-2 rounded-full text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors"
          title="Dismiss for now"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Animated Radar/Pin Icon */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-glow">
            <Navigation className="w-8 h-8 animate-pulse text-primary" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-surface"></span>
          </span>
        </div>

        {/* Modal Titles */}
        <span className="text-[10px] font-black text-primary uppercase tracking-[0.25em] mb-1">
          AIRFIELD POSITIONING
        </span>
        <h3 className="text-xl font-[900] text-on-surface tracking-tight uppercase mb-2">
          Enable Location Sharing
        </h3>
        
        <p className="text-[11px] font-bold text-on-surface-dim opacity-70 leading-relaxed mb-6 max-w-sm">
          MACL Fuel Services requires your real-time location to display your positioning across aprons and stands. This helps supervisors coordinate flight assignments and dispatch safely.
        </p>

        {/* Features preview */}
        <div className="w-full bg-surface-dim border border-outline/50 rounded-2xl p-4 mb-6 text-left space-y-2.5">
          <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Airside & apron stand identification (MLE)</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-bold text-on-surface">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>Assists dispatchers with nearby flight jobs</span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full space-y-2.5">
          <button
            onClick={() => {
              haptic('TAP');
              onAllow();
            }}
            disabled={isLoading}
            className="w-full py-3.5 px-6 kinetic-gradient text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <Navigation className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Requesting Permission...' : 'Share Airfield Location'}</span>
          </button>

          <button
            onClick={() => {
              haptic('TAP');
              onDismiss();
            }}
            className="w-full py-2.5 text-on-surface-dim hover:text-on-surface text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
};
