import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Fuel, Ban, CheckCheck, Megaphone, X, RefreshCw } from 'lucide-react';
import { FlightJob } from '../types';
import { DispatchState, CrewRecipients } from '../hooks/useFuelDispatch';

export interface FuelDispatchControlProps {
  job: FlightJob | any;
  dispatchState: DispatchState;
  recipients: CrewRecipients;
  canDispatch: boolean;
  disabled?: boolean;
  disabledReason?: string;
  align?: 'left' | 'right';
  onSend: (job: FlightJob | any, type: 'REQUEST_FUELING' | 'NO_FUEL') => Promise<boolean | void>;
  onCancel: (job: FlightJob | any) => Promise<boolean | void>;
}

export const FuelDispatchControl: React.FC<FuelDispatchControlProps> = ({
  job,
  dispatchState,
  recipients,
  canDispatch,
  disabled = false,
  disabledReason,
  align = 'right',
  onSend,
  onCancel,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    dispatchStatus,
    isDispatchAcknowledged,
    dispatchRequestedTime,
    dispatchAcknowledgedTime,
    dispatchAcknowledgedBy
  } = dispatchState;

  // Accurately compute fixed viewport coordinates for portaled popovers
  const updateCoords = useCallback((isDetails?: boolean) => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 12;
    const details = isDetails ?? isDetailsOpen;
    const popoverWidth = details ? 264 : 224;
    const popoverHeight = details ? 340 : 160;

    // Vertical positioning: default below button; flip up if overflowing viewport
    let top = rect.bottom + 6;
    if (top + popoverHeight > window.innerHeight - margin && rect.top - popoverHeight - 6 > margin) {
      top = rect.top - popoverHeight - 6;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

    // Horizontal positioning: align left or right based on prop, then clamp safely
    let left = align === 'left' ? rect.left : rect.right - popoverWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    setCoords({ top, left });
  }, [align, isDetailsOpen]);

  // Window listeners for repositioning and outside dismissal
  useEffect(() => {
    if (!isMenuOpen && !isDetailsOpen) return;

    updateCoords();

    const onScrollOrResize = () => {
      updateCoords();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsDetailsOpen(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsMenuOpen(false);
      setIsDetailsOpen(false);
    };

    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isMenuOpen, isDetailsOpen, updateCoords]);

  if (!canDispatch) {
    return null;
  }

  const statusUpper = String(job?.status || '').trim().toUpperCase();
  const isDeparted = statusUpper === 'DEPARTED';
  const effectiveDisabled = disabled || isDeparted || !recipients.hasRecipients;
  const computedDisabledReason = !recipients.hasRecipients
    ? 'Assign domestic crew before dispatching'
    : isDeparted
    ? 'Flight departed'
    : disabledReason || 'Dispatch unavailable';

  // --- STATE 2: ACTIVE OR ACKNOWLEDGED DISPATCH ---
  if (dispatchStatus) {
    return (
      <div className="relative inline-flex items-center">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || isProcessing}
          onClick={(e) => {
            e.stopPropagation();
            updateCoords(true);
            setIsMenuOpen(false);
            setIsDetailsOpen(!isDetailsOpen);
          }}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer relative shrink-0 ${
            isDispatchAcknowledged
              ? 'bg-emerald-600 text-white border border-emerald-400/60 hover:bg-emerald-500'
              : dispatchStatus === 'REQUEST_FUELING'
              ? 'bg-rose-600 text-white font-black border border-rose-400 hover:bg-rose-500'
              : 'bg-amber-500 text-slate-950 font-black border border-amber-400 hover:bg-amber-400'
          }`}
          title={
            isDispatchAcknowledged
              ? `${dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No-Fuel'} ACKNOWLEDGED by ${dispatchAcknowledgedBy || 'crew'} at ${dispatchAcknowledgedTime || '--:--'} (Req ${dispatchRequestedTime || '--:--'}). Click for options.`
              : `${dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No-Fuel'} PENDING since ${dispatchRequestedTime || '--:--'}. Click for options.`
          }
        >
          {isDispatchAcknowledged ? (
            <CheckCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
          ) : dispatchStatus === 'REQUEST_FUELING' ? (
            <Fuel className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
          ) : (
            <Ban className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-950" />
          )}

          {/* Pip indicator */}
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 border border-slate-900 ${
                isDispatchAcknowledged
                  ? 'bg-emerald-300'
                  : dispatchStatus === 'REQUEST_FUELING'
                  ? 'bg-rose-300'
                  : 'bg-amber-300'
              }`}
            />
          </span>
        </button>

        {/* Details Popover rendered via Portal into document.body (escapes table stacking contexts) */}
        {isDetailsOpen && typeof document !== 'undefined' && createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-[0.5px]"
              onClick={(e) => {
                e.stopPropagation();
                setIsDetailsOpen(false);
              }}
            />
            <div
              ref={popoverRef}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: '264px',
              }}
              className="z-[9999] bg-surface border border-outline rounded-2xl shadow-premium p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150 text-on-surface"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-black tracking-tight truncate">{job.flightNumber}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${
                      isDispatchAcknowledged
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : dispatchStatus === 'REQUEST_FUELING'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isDispatchAcknowledged ? 'Acknowledged' : 'Pending Ack'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDetailsOpen(false);
                  }}
                  className="p-1 rounded-lg hover:bg-surface-dim text-on-surface-dim hover:text-on-surface cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Timings & Info */}
              <div className="bg-surface-container-low rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] border border-outline-variant">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-dim font-medium">Type:</span>
                  <span className="font-bold text-on-surface">
                    {dispatchStatus === 'REQUEST_FUELING' ? 'Fuel Request' : 'No Fuel Required'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-dim font-medium">Stand:</span>
                  <span className="font-bold text-on-surface">{job.stand || 'TBA'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-dim font-medium">Assigned:</span>
                  <span className="font-bold text-on-surface truncate max-w-[130px] text-right">
                    {recipients.summary}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-dim font-medium">Requested:</span>
                  <span className="font-mono font-bold text-on-surface">
                    {dispatchRequestedTime || '--:--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-dim font-medium">Acknowledged:</span>
                  <span
                    className={`font-mono font-bold ${
                      isDispatchAcknowledged ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isDispatchAcknowledged ? dispatchAcknowledgedTime || '--:--' : 'Awaiting Crew'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsProcessing(true);
                    setIsDetailsOpen(false);
                    try {
                      await onCancel(job);
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Cancel Alert</span>
                </button>

                {dispatchStatus === 'REQUEST_FUELING' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsProcessing(true);
                      setIsDetailsOpen(false);
                      try {
                        await onSend(job, 'NO_FUEL');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    <Ban className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Switch to No Fuel</span>
                  </button>
                )}

                {dispatchStatus === 'NO_FUEL' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsProcessing(true);
                      setIsDetailsOpen(false);
                      try {
                        await onSend(job, 'REQUEST_FUELING');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/25 hover:bg-rose-600/25 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                  >
                    <Fuel className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Switch to Fuel Request</span>
                  </button>
                )}

                {!isDispatchAcknowledged && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsProcessing(true);
                      setIsDetailsOpen(false);
                      try {
                        await onSend(job, dispatchStatus!);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-dim hover:bg-surface-dim/80 text-on-surface text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-outline active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Re-send Alert</span>
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>
    );
  }

  // --- STATE 1: IDLE DISPATCH BUTTON ---
  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={effectiveDisabled || isProcessing}
        onClick={(e) => {
          e.stopPropagation();
          updateCoords(false);
          setIsDetailsOpen(false);
          setIsMenuOpen(!isMenuOpen);
        }}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all relative shrink-0 ${
          effectiveDisabled
            ? 'bg-surface-dim/30 text-white/30 border border-white/10 cursor-not-allowed select-none'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20 active:scale-95 shadow-sm cursor-pointer'
        }`}
        title={
          effectiveDisabled
            ? computedDisabledReason
            : `Manager: Dispatch Fuel Request / No-Fuel to assigned crew (${recipients.summary})`
        }
      >
        <Megaphone className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </button>

      {/* Dropdown Menu for Idle Dispatch rendered via Portal into document.body */}
      {isMenuOpen && !effectiveDisabled && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/25 backdrop-blur-[0.5px]"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(false);
            }}
          />
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '224px',
            }}
            className="z-[9999] bg-surface border border-outline rounded-xl shadow-premium p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150 text-on-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={isProcessing}
              onClick={async (e) => {
                e.stopPropagation();
                setIsProcessing(true);
                setIsMenuOpen(false);
                try {
                  await onSend(job, 'REQUEST_FUELING');
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 text-on-surface-dim transition-all flex items-center gap-2.5 cursor-pointer active:scale-95"
            >
              <Fuel className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Request Fueling</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={async (e) => {
                e.stopPropagation();
                setIsProcessing(true);
                setIsMenuOpen(false);
                try {
                  await onSend(job, 'NO_FUEL');
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-400 text-on-surface-dim transition-all flex items-center gap-2.5 cursor-pointer border-t border-outline-variant pt-2 active:scale-95"
            >
              <Ban className="w-4 h-4 text-amber-400 shrink-0" />
              <span>No Fuel Required</span>
            </button>
          </div>
        </> ,
        document.body
      )}
    </div>
  );
};
