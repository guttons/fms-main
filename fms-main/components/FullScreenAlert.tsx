import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Alert } from '../types';
import { Bell, BellRing, Fuel, Ban, Clock, AlertTriangle, ChevronRight, Check, PlaneLanding } from 'lucide-react';
import { Logo } from './Logo';
import { alertSoundEngine } from '../utils/alertSounds';
import { serverTimeService } from '../services/serverTimeService';

interface FullScreenAlertProps {
  alert: Alert;
  onAcknowledge: (alertId: string) => void;
}

export const FullScreenAlert: React.FC<FullScreenAlertProps> = ({ alert, onAcknowledge }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [etaRemaining, setEtaRemaining] = useState<string>('');

  const startXRef = useRef(0);
  const maxSlideRef = useRef(240);
  const isAcknowledgingRef = useRef(false);
  const currentDragXRef = useRef(0);

  useEffect(() => {
    const updateMaxSlide = () => {
      if (trackRef.current) {
        maxSlideRef.current = Math.max(100, trackRef.current.clientWidth - 56 - 8);
      }
    };
    updateMaxSlide();
    window.addEventListener('resize', updateMaxSlide);
    return () => window.removeEventListener('resize', updateMaxSlide);
  }, []);

  useEffect(() => {
    let vibrationInterval: ReturnType<typeof setInterval>;
    
    const startAlertAudio = async () => {
      try {
        alertSoundEngine.unlock();
        if (alert.alertType === 'REQUEST_FUELING' || alert.alertType === 'NO_FUEL') {
          await alertSoundEngine.playHighAlertAlarm();
        } else if (alert.alertType === 'ALERT_CANCELLED') {
          await alertSoundEngine.playEtaWarning();
        } else if (alert.alertType === 'ETA_5MIN') {
          await alertSoundEngine.playEtaCritical();
        } else if (alert.alertType === 'ETA_15MIN') {
          await alertSoundEngine.playEtaWarning();
        } else if (alert.alertType === 'LANDED') {
          await alertSoundEngine.playLandingChime();
        }
      } catch (e) {
        console.warn('[FullScreenAlert] Audio playback deferred until user interaction:', e);
      }
    };

    startAlertAudio();

    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
      vibrationInterval = setInterval(() => {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }, 3000);
    }

    // Critical alerts require explicit staff acknowledgment — never auto-dismiss
    return () => {
      if (vibrationInterval) clearInterval(vibrationInterval);
      alertSoundEngine.stop();
    };
  }, [alert.id, alert.alertType]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    
    if ((alert.alertType === 'ETA_15MIN' || alert.alertType === 'ETA_5MIN') && alert.metadata?.eta) {
      const updateTimer = () => {
        const now = serverTimeService.getServerTime();
        const etaDate = serverTimeService.getServerTime();
        const [hours, minutes] = alert.metadata.eta.split(':');
        etaDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        
        let diffMs = etaDate.getTime() - now.getTime();
        if (diffMs < 0) {
          setEtaRemaining('00:00');
          return;
        }
        const m = Math.floor(diffMs / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);
        setEtaRemaining(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      
      updateTimer();
      timerId = setInterval(updateTimer, 1000);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [alert.metadata?.eta, alert.alertType]);

  const handleAcknowledge = useCallback(() => {
    if (isAcknowledgingRef.current) return;
    isAcknowledgingRef.current = true;
    setIsAcknowledged(true);
    setIsDragging(false);
    currentDragXRef.current = maxSlideRef.current;
    setDragX(maxSlideRef.current);
    if (navigator.vibrate) {
      try { navigator.vibrate(100); } catch {}
    }
    onAcknowledge(alert.id);
  }, [alert.id, onAcknowledge]);

  const updatePosition = useCallback((clientX: number) => {
    if (isAcknowledgingRef.current) return;
    const deltaX = clientX - startXRef.current;
    const max = maxSlideRef.current;
    const clampedX = Math.max(0, Math.min(max, deltaX));
    currentDragXRef.current = clampedX;
    setDragX(clampedX);

    // Auto-trigger if slid >= 75% of the total distance
    if (max > 0 && clampedX >= max * 0.75) {
      handleAcknowledge();
    }
  }, [handleAcknowledge]);

  const endDrag = useCallback(() => {
    if (isAcknowledgingRef.current) return;
    setIsDragging(false);
    const max = maxSlideRef.current;
    const currentX = currentDragXRef.current;
    // If released past 60%, acknowledge
    if (max > 0 && currentX >= max * 0.6) {
      handleAcknowledge();
    } else {
      currentDragXRef.current = 0;
      setDragX(0);
    }
  }, [handleAcknowledge]);

  const handleStart = useCallback((clientX: number) => {
    if (isAcknowledgingRef.current) return;
    setIsDragging(true);
    startXRef.current = clientX;
    if (trackRef.current) {
      const trackWidth = trackRef.current.clientWidth;
      maxSlideRef.current = Math.max(100, trackWidth - 56 - 8);
    }
  }, []);

  // Global window listeners while dragging to guarantee smooth tracking even if finger outpaces handle
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      updatePosition(e.clientX);
    };
    const onPointerUp = () => {
      endDrag();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        updatePosition(e.touches[0].clientX);
      }
    };
    const onTouchEnd = () => {
      endDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging, updatePosition, endDrag]);

  const handlePointerDown = (e: React.PointerEvent) => {
    handleStart(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      handleStart(e.touches[0].clientX);
    }
  };

  let themeColorClass = 'text-warning';
  let themeBorderClass = 'border-warning/50';
  let themeBgClass = 'bg-warning/10';
  let pulsingBorderClass = 'animate-pulse';
  let Icon = AlertTriangle;
  
  if (alert.alertType === 'ALERT_CANCELLED') {
    themeColorClass = 'text-rose-400';
    themeBorderClass = 'border-rose-500/50';
    themeBgClass = 'bg-rose-500/10';
    Icon = Ban;
  } else if (alert.alertType === 'REQUEST_FUELING') {
    themeColorClass = 'text-rose-400';
    themeBorderClass = 'border-rose-500/50';
    themeBgClass = 'bg-rose-500/10';
    Icon = Fuel;
  } else if (alert.alertType === 'NO_FUEL') {
    themeColorClass = 'text-amber-400';
    themeBorderClass = 'border-amber-500/50';
    themeBgClass = 'bg-amber-500/10';
    Icon = Ban;
  } else if (alert.alertType === 'ETA_5MIN') {
    themeColorClass = 'text-error';
    themeBorderClass = 'border-error/50';
    themeBgClass = 'bg-error/10';
    Icon = BellRing;
  } else if (alert.alertType === 'ETA_15MIN') {
    themeColorClass = 'text-warning';
    Icon = Clock;
  } else if (alert.alertType === 'LANDED') {
    themeColorClass = 'text-emerald-500 dark:text-emerald-400';
    themeBorderClass = 'border-emerald-500/50';
    themeBgClass = 'bg-emerald-500/10';
    Icon = PlaneLanding;
  }

  return (
    <div 
      onClick={() => alertSoundEngine.unlock()}
      className="fixed inset-0 z-[9999999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-8"
    >
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <Logo className="w-8 h-8 sm:w-10 sm:h-10" />
        <div className="text-on-surface text-xl sm:text-2xl font-black tracking-widest uppercase">FMS Alert</div>
      </div>

      <div className={`relative w-full max-w-lg bg-surface border-2 ${themeBorderClass} rounded-3xl shadow-premium p-6 sm:p-10 flex flex-col items-center text-center overflow-hidden ${pulsingBorderClass}`}>
        
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 ${themeBgClass} blur-[50px] rounded-full pointer-events-none`} />

        <div className={`p-4 rounded-2xl ${themeBgClass} ${themeColorClass} mb-6 relative z-10`}>
          <Icon className="w-12 h-12 sm:w-16 sm:h-16" />
        </div>

        <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-widest ${themeColorClass} mb-2 relative z-10`}>
          {alert.alertType === 'ALERT_CANCELLED' ? 'ALERT CANCELLED' : alert.alertType === 'NO_FUEL' ? 'NO FUEL REQUIRED' : (alert.alertType?.replace(/_/g, ' ') || 'ALERT')}
        </h2>

        {alert.message && alert.alertType === 'ALERT_CANCELLED' && (
          <p className="text-xs sm:text-sm font-bold text-rose-300 max-w-sm mb-4 relative z-10 bg-rose-500/10 border border-rose-500/30 px-3.5 py-2 rounded-xl">
            {alert.message}
          </p>
        )}

        {alert.flightNumber && (
          <div className="text-4xl sm:text-6xl font-black text-on-surface tracking-wider mb-6 relative z-10">
            {alert.flightNumber}
          </div>
        )}

        {etaRemaining && (
          <div className="mb-6 flex flex-col items-center relative z-10">
            <span className="text-xs font-black uppercase tracking-widest text-on-surface-dim mb-1">Time Remaining</span>
            <div className={`text-4xl font-black tracking-wider ${themeColorClass} font-mono`}>
              {etaRemaining}
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4 mb-8 w-full relative z-10">
          {alert.metadata?.aircraftReg && (
            <div className="bg-surface-dim px-4 py-2 rounded-xl flex-1 min-w-[120px] border border-outline">
              <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim mb-1">Reg</div>
              <div className="text-sm font-bold text-on-surface">{alert.metadata.aircraftReg}</div>
            </div>
          )}
          {alert.metadata?.stand && (
            <div className="bg-surface-dim px-4 py-2 rounded-xl flex-1 min-w-[120px] border border-outline">
              <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim mb-1">Stand</div>
              <div className="text-sm font-bold text-on-surface">{alert.metadata.stand}</div>
            </div>
          )}
          {alert.metadata?.eta && !etaRemaining && (
            <div className="bg-surface-dim px-4 py-2 rounded-xl flex-1 min-w-[120px] border border-outline">
              <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim mb-1">ETA</div>
              <div className="text-sm font-bold text-on-surface">{alert.metadata.eta}</div>
            </div>
          )}
        </div>

        {alert.senderName && (
          <div className="text-sm text-on-surface-dim font-bold mb-8 relative z-10">
            Sent by <span className="text-on-surface uppercase tracking-wider">{alert.senderName}</span>
          </div>
        )}

        <div 
          className="w-full relative h-16 bg-surface-lowest rounded-2xl border border-outline/50 overflow-hidden flex items-center justify-center select-none shadow-sm z-10 touch-none" 
          ref={trackRef}
          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          {/* Progress fill */}
          <div 
            className={`absolute top-1 left-1 bottom-1 rounded-xl transition-all duration-75 pointer-events-none ${
              isAcknowledged ? 'bg-emerald-500/25 border border-emerald-500/40' : `${themeBgClass} border ${themeBorderClass}`
            }`}
            style={{ 
              width: `calc(${dragX}px + 3.5rem)`,
              maxWidth: 'calc(100% - 0.5rem)'
            }}
          />

          {/* Text Guide */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150"
            style={{ opacity: Math.max(0, 1 - (maxSlideRef.current > 0 ? (dragX / maxSlideRef.current) * 1.6 : 0)) }}
          >
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-on-surface-dim">
              Slide to Acknowledge &gt;&gt;&gt;
            </span>
          </div>
          
          {/* Handle */}
          <div 
            className={`absolute top-1 left-1 bottom-1 w-14 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing bg-surface border ${
              isAcknowledged ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-outline text-on-surface'
            } shadow-md z-10 touch-none`}
            style={{ 
              transform: `translateX(${dragX}px)`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
            onPointerDown={handlePointerDown}
            onTouchStart={handleTouchStart}
          >
            {isAcknowledged ? (
              <Check className="w-6 h-6 text-emerald-400" />
            ) : (
              <ChevronRight className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Fallback Tap to Acknowledge button */}
        <button
          type="button"
          onClick={handleAcknowledge}
          className="mt-3 text-[11px] font-black tracking-wider uppercase text-on-surface-dim hover:text-on-surface py-1.5 px-3 rounded-lg hover:bg-surface-dim active:scale-95 transition-all opacity-60 hover:opacity-100 z-10 cursor-pointer"
        >
          Tap to Acknowledge
        </button>

      </div>
    </div>
  );
};
