import React, { useEffect, useState, useRef } from 'react';
import { Alert } from '../types';
import { Bell, BellRing, Fuel, Ban, Clock, AlertTriangle, ChevronRight, PlaneLanding } from 'lucide-react';
import { Logo } from './Logo';
import { alertSoundEngine } from '../utils/alertSounds';

interface FullScreenAlertProps {
  alert: Alert;
  onAcknowledge: (alertId: string) => void;
}

export const FullScreenAlert: React.FC<FullScreenAlertProps> = ({ alert, onAcknowledge }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [etaRemaining, setEtaRemaining] = useState<string>('');

  useEffect(() => {
    let vibrationInterval: ReturnType<typeof setInterval>;
    
    if (alert.alertType === 'REQUEST_FUELING' || alert.alertType === 'NO_FUEL') {
      alertSoundEngine.playHighAlertAlarm();
    } else if (alert.alertType === 'ETA_5MIN') {
      alertSoundEngine.playEtaCritical();
    } else if (alert.alertType === 'ETA_15MIN') {
      alertSoundEngine.playEtaWarning();
    } else if (alert.alertType === 'LANDED') {
      alertSoundEngine.playLandingChime();
    }

    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
      vibrationInterval = setInterval(() => {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }, 3000);
    }

    // Auto-acknowledge after 90 seconds
    const autoAckTimer = setTimeout(() => {
      handleAcknowledge();
    }, 90000);

    return () => {
      if (vibrationInterval) clearInterval(vibrationInterval);
      clearTimeout(autoAckTimer);
      alertSoundEngine.stop();
    };
  }, [alert.id]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    
    if ((alert.alertType === 'ETA_15MIN' || alert.alertType === 'ETA_5MIN') && alert.metadata?.eta) {
      const updateTimer = () => {
        const now = new Date();
        const etaDate = new Date();
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

  const handleAcknowledge = () => {
    onAcknowledge(alert.id);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);

    if (percentage > 80) {
      setIsDragging(false);
      handleAcknowledge();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (sliderPos <= 80) {
      setSliderPos(0);
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  let themeColorClass = 'text-warning';
  let themeBorderClass = 'border-warning/50';
  let themeBgClass = 'bg-warning/10';
  let pulsingBorderClass = 'animate-pulse';
  let Icon = AlertTriangle;
  
  if (alert.alertType === 'NO_FUEL' || alert.alertType === 'ETA_5MIN') {
    themeColorClass = 'text-error';
    themeBorderClass = 'border-error/50';
    themeBgClass = 'bg-error/10';
    if (alert.alertType === 'NO_FUEL') Icon = Ban;
    if (alert.alertType === 'ETA_5MIN') Icon = BellRing;
  } else if (alert.alertType === 'REQUEST_FUELING') {
    themeColorClass = 'text-warning';
    Icon = Fuel;
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
    <div className="fixed inset-0 z-[9999999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-8">
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
          {alert.alertType?.replace('_', ' ') || 'ALERT'}
        </h2>

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

        <div className="w-full relative h-16 bg-surface-lowest rounded-2xl border border-outline/50 overflow-hidden flex items-center justify-center select-none shadow-sm z-10" ref={trackRef}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-on-surface-dim">
              Slide to Acknowledge &gt;&gt;&gt;
            </span>
          </div>
          
          <div 
            className={`absolute top-1 left-1 bottom-1 w-14 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing bg-surface border border-outline text-on-surface shadow-md z-10`}
            style={{ 
              transform: `translateX(calc(${(trackRef.current?.offsetWidth || 300) * sliderPos / 100}px - ${sliderPos > 0 ? (sliderPos/100)*60 : 0}px))`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <ChevronRight className="w-6 h-6" />
          </div>
        </div>

      </div>
    </div>
  );
};
