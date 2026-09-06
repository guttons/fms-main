import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radar, Plane, MapPin, Clock, Navigation, ExternalLink, 
  Smartphone, ArrowRight, PlaneLanding, Fuel, Ban, AlertTriangle, 
  RefreshCw, Globe
} from 'lucide-react';
import { User, UserRole, FlightJob } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { flightRadarService } from '../services/flightRadarService';
import { differenceInMinutes } from 'date-fns';

interface FlightTrackerProps {
  user: User;
  onNavigateToIntoPlane?: (job: FlightJob) => void;
}

export const FlightTracker: React.FC<FlightTrackerProps> = ({ user, onNavigateToIntoPlane }) => {
  const { flightJobs, alerts, staff } = useOperationalData();
  const [selectedFlight, setSelectedFlight] = useState<FlightJob | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter flights for today and assigned to user (unless admin/manager/supervisor)
  const todayFlights = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    let filtered = flightJobs.filter(job => {
      const jobDate = job.date || today;
      return jobDate === today && job.status !== 'COMPLETED';
    });

    const canSeeAll = [UserRole.ADMIN, UserRole.ITP_MANAGER, UserRole.ITP_SUPERVISOR].includes(user.role);

    if (!canSeeAll) {
      filtered = filtered.filter(job => 
        job.assignedTo === user.id || 
        job.assignedOfficer === user.id ||
        job.assignedTo === user.name ||
        job.assignedOfficer === user.name
      );
    }

    // Sort by ETA or STA
    return filtered.sort((a, b) => {
      const timeA = a.eta || a.sta || '23:59';
      const timeB = b.eta || b.sta || '23:59';
      return timeA.localeCompare(timeB);
    });
  }, [flightJobs, user]);

  // Current map embed URL
  const mapUrl = useMemo(() => {
    if (selectedFlight) {
      return flightRadarService.getEmbedUrl({ flightNumber: selectedFlight.flightNumber });
    }
    return flightRadarService.getEmbedUrl();
  }, [selectedFlight]);

  const handleFlightSelect = (flight: FlightJob) => {
    setSelectedFlight(flight);
    setIsPanelOpen(true);
    setIframeLoading(true);
  };

  const resetMap = () => {
    setSelectedFlight(null);
    setIsPanelOpen(false);
    setIframeLoading(true);
  };

  const getUrgencyStatus = (eta?: string, sta?: string, statusText?: string) => {
    const isLanded = (statusText || '').toUpperCase().includes('LAND') || (statusText || '').toUpperCase().includes('ARRIV');
    if (isLanded) {
      return { color: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30', text: 'LANDED' };
    }

    const targetTime = eta || sta;
    if (!targetTime) return { color: 'bg-surface-dim text-on-surface-dim', text: 'NO TIME' };

    const [hours, minutes] = targetTime.split(':').map(Number);
    const targetDate = new Date(currentTime);
    targetDate.setHours(hours, minutes, 0, 0);

    const diffMins = differenceInMinutes(targetDate, currentTime);

    if (diffMins < 0) return { color: 'bg-primary/20 text-primary border border-primary/30', text: 'ARRIVED' };
    if (diffMins <= 5) return { color: 'bg-error/20 text-error border border-error/30 animate-pulse', text: 'ETA <5 MIN' };
    if (diffMins <= 15) return { color: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse', text: 'ETA <15 MIN' };
    if (diffMins <= 30) return { color: 'bg-warning/20 text-warning border border-warning/30', text: '15-30 MIN' };
    return { color: 'bg-success/20 text-success border border-success/30', text: '>30 MIN' };
  };

  const getLiveCountdown = (targetTimeStr?: string) => {
    if (!targetTimeStr) return null;
    const [hours, minutes] = targetTimeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const targetDate = new Date(currentTime);
    targetDate.setHours(hours, minutes, 0, 0);

    const diffMs = targetDate.getTime() - currentTime.getTime();
    if (diffMs <= 0) return 'Arrived / Past';

    const totalSeconds = Math.floor(diffMs / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getAirlineCode = (flightNumber: string) => {
    const match = flightNumber.match(/^[A-Z0-9]{2,3}/i);
    return match ? match[0].toUpperCase() : 'UNKNOWN';
  };

  const getActiveAlertForFlight = (flightNumber: string) => {
    const cleanNo = flightNumber.replace(/\s+/g, '').toUpperCase();
    return (alerts || []).find(a => 
      !a.acknowledged && 
      (a.flightNumber?.replace(/\s+/g, '').toUpperCase() === cleanNo || a.message.toUpperCase().includes(cleanNo))
    );
  };

  return (
    <div className="flex flex-col h-full bg-surface-lowest relative overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex flex-col pt-safe-top bg-surface-lowest/90 backdrop-blur-xl border-b border-outline/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Radar className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <h1 className="text-[12px] font-black tracking-widest text-on-surface flex items-center gap-2">
                FLIGHT TRACKER
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  LIVE RADAR
                </span>
              </h1>
              <p className="text-[10px] text-on-surface-dim tracking-wider font-medium mt-0.5">
                {todayFlights.length} {todayFlights.length === 1 ? 'ASSIGNED FLIGHT' : 'ASSIGNED FLIGHTS'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIframeLoading(true); }}
              className="p-2 rounded-xl bg-surface border border-outline hover:bg-surface-dim text-on-surface-dim transition-all"
              title="Refresh radar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Flight List Strip */}
        <div className="w-full overflow-x-auto no-scrollbar border-t border-outline/10">
          <div className="flex gap-3 p-3 px-4 min-w-max">
            {todayFlights.length === 0 ? (
              <div className="flex items-center justify-center w-full py-2">
                <p className="text-[11px] text-on-surface-dim tracking-wider flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5" /> NO ACTIVE FLIGHTS ASSIGNED TO YOU TODAY
                </p>
              </div>
            ) : (
              todayFlights.map((flight) => {
                const isSelected = selectedFlight?.id === flight.id;
                const status = getUrgencyStatus(flight.eta, flight.sta, flight.fidsStatus || flight.status);
                const airlineCode = getAirlineCode(flight.flightNumber);
                const flightAlert = getActiveAlertForFlight(flight.flightNumber);
                
                return (
                  <button
                    key={flight.id}
                    onClick={() => handleFlightSelect(flight)}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-95 text-left min-w-[210px] relative ${
                      isSelected 
                        ? 'bg-surface border-primary shadow-premium ring-2 ring-primary/20' 
                        : 'bg-surface border-outline/50 hover:border-outline shadow-sm'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface-lowest border border-outline/30 flex items-center justify-center overflow-hidden shrink-0 relative">
                      <img 
                        src={`https://fis.com.mv/tail/${airlineCode}.png`}
                        alt={airlineCode}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Plane className="w-4 h-4 text-on-surface-dim absolute -z-10" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[14px] font-black text-on-surface truncate">
                          {flight.flightNumber}
                        </span>
                        {flightAlert && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase flex items-center gap-1 ${
                            flightAlert.alertType === 'NO_FUEL' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                          }`}>
                            {flightAlert.alertType === 'NO_FUEL' ? <Ban className="w-2.5 h-2.5" /> : <Fuel className="w-2.5 h-2.5" />}
                            {flightAlert.alertType === 'NO_FUEL' ? 'NO FUEL' : 'REQ FUEL'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold text-on-surface-dim tracking-wider">
                          ETA: {flight.eta || flight.sta || 'N/A'}
                        </span>
                        <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider ${status.color}`}>
                          {status.text}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-surface-dim">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-lowest">
            <div className="w-12 h-12 rounded-full border-4 border-surface border-t-primary animate-spin mb-4"></div>
            <p className="text-[11px] font-black tracking-widest text-on-surface-dim animate-pulse">
              CONNECTING TO FLIGHTRADAR24 LIVE RADAR...
            </p>
          </div>
        )}
        
        <iframe
          src={mapUrl}
          className="w-full h-full border-0"
          onLoad={() => setIframeLoading(false)}
          title="FlightRadar24 Live Radar"
          allow="geolocation"
        />

        {/* Floating Quick-Action Tracker Buttons */}
        <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2.5">
          {selectedFlight && (
            <>
              {/* Native App Deep Link */}
              <a 
                href={flightRadarService.getFlightAppDeepLink(selectedFlight.flightNumber)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-lowest/90 backdrop-blur-xl border border-primary/40 shadow-lg text-[11px] font-black text-primary hover:bg-primary hover:text-white transition-all active:scale-95"
                title="Launch in FlightRadar24 App"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Open in App</span>
              </a>

              {/* Web FlightAware Fallback */}
              <a 
                href={flightRadarService.getFlightAwareUrl(selectedFlight.flightNumber)}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-lowest/90 backdrop-blur-xl border border-outline shadow-lg text-[11px] font-bold text-on-surface hover:bg-surface transition-all active:scale-95"
                title="Open in FlightAware"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">FlightAware</span>
              </a>

              {/* Reset map to MLE airport */}
              <button 
                onClick={resetMap}
                className="w-10 h-10 self-end rounded-xl bg-surface-lowest/90 backdrop-blur-xl border border-outline shadow-lg flex items-center justify-center text-on-surface hover:bg-surface active:scale-95 transition-all"
                title="Reset to MLE Airport"
              >
                <MapPin className="w-5 h-5 text-primary" />
              </button>
            </>
          )}

          {/* Direct link to web radar */}
          <a 
            href={selectedFlight ? flightRadarService.getFlightWebUrl(selectedFlight.flightNumber) : mapUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 self-end rounded-xl bg-surface-lowest/90 backdrop-blur-xl border border-outline shadow-lg flex items-center justify-center text-on-surface hover:bg-surface active:scale-95 transition-all"
            title="Open Fullscreen FlightRadar24"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Flight Detail Bottom Sheet */}
      {selectedFlight && (
        <>
          <div 
            className={`absolute inset-0 bg-black/30 backdrop-blur-sm z-30 transition-opacity duration-300 ${
              isPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsPanelOpen(false)}
          />
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-surface-lowest rounded-t-3xl border-t border-outline shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-40 transition-transform duration-300 ease-spring ${
              isPanelOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto pb-safe">
              {/* Drag Handle */}
              <div 
                className="w-12 h-1.5 bg-outline rounded-full mx-auto cursor-pointer"
                onClick={() => setIsPanelOpen(false)}
              />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-surface border border-outline/30 flex items-center justify-center shadow-sm">
                    <img 
                      src={`https://fis.com.mv/tail/${getAirlineCode(selectedFlight.flightNumber)}.png`}
                      alt="Airline"
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[22px] font-black text-on-surface tracking-tight">
                        {selectedFlight.flightNumber}
                      </h2>
                      {(() => {
                        const alert = getActiveAlertForFlight(selectedFlight.flightNumber);
                        if (!alert) return null;
                        return (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            alert.alertType === 'NO_FUEL' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                          }`}>
                            {alert.alertType === 'NO_FUEL' ? <Ban className="w-3 h-3" /> : <Fuel className="w-3 h-3" />}
                            {alert.alertType === 'NO_FUEL' ? 'NO FUEL' : 'REQ FUEL'}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[12px] font-bold text-on-surface-dim tracking-wider flex items-center gap-1.5 mt-0.5">
                      <Plane className="w-3.5 h-3.5" />
                      {selectedFlight.aircraftType} • {selectedFlight.aircraftReg || 'TBA'}
                    </p>
                  </div>
                </div>
                
                <div className="px-3.5 py-1.5 rounded-xl bg-surface border border-outline/50 flex flex-col items-center justify-center shadow-sm">
                  <span className="text-[9px] font-black text-on-surface-dim tracking-widest mb-0.5">STAND</span>
                  <span className="text-[18px] font-black text-on-surface">{selectedFlight.stand || 'TBA'}</span>
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-outline/30">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-on-surface-dim tracking-widest mb-1">ORIGIN</span>
                  <span className="text-[16px] font-black text-on-surface">{selectedFlight.route?.split('➔')[0]?.trim() || '---'}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center px-4 relative">
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-outline top-1/2 -translate-y-1/2"></div>
                  <Plane className="w-5 h-5 text-primary rotate-90 bg-surface px-1 relative z-10" />
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-on-surface-dim tracking-widest mb-1">DESTINATION</span>
                  <span className="text-[16px] font-black text-on-surface">MLE</span>
                </div>
              </div>

              {/* Times & Live Countdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col p-3 rounded-xl bg-surface border border-outline/30">
                  <span className="text-[9px] font-black text-on-surface-dim tracking-widest mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> STA
                  </span>
                  <span className="text-[14px] font-black text-on-surface">{selectedFlight.sta || '--:--'}</span>
                </div>
                
                <div className="flex flex-col p-3 rounded-xl bg-primary/10 border border-primary/30">
                  <span className="text-[9px] font-black text-primary tracking-widest mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ETA
                  </span>
                  <span className="text-[14px] font-black text-primary">{selectedFlight.eta || '--:--'}</span>
                  {selectedFlight.eta && (
                    <span className="text-[9px] font-bold text-primary/80 mt-0.5 font-mono">
                      in {getLiveCountdown(selectedFlight.eta)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-surface border border-outline/30">
                  <span className="text-[9px] font-black text-on-surface-dim tracking-widest mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> STD
                  </span>
                  <span className="text-[14px] font-black text-on-surface">{selectedFlight.std || '--:--'}</span>
                </div>
              </div>

              {/* Staff Assignments */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface border border-outline/30">
                <span className="text-[9px] font-black text-on-surface-dim tracking-widest px-1">CREW ASSIGNMENTS</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-on-surface-dim">Operator</span>
                    <span className="text-[13px] font-black text-on-surface">
                      {staff.find(s => s.id === selectedFlight.assignedTo)?.name || selectedFlight.assignedTo || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-on-surface-dim">Officer</span>
                    <span className="text-[13px] font-black text-on-surface">
                      {staff.find(s => s.id === selectedFlight.assignedOfficer)?.name || selectedFlight.assignedOfficer || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tracker Deep Links & Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={flightRadarService.getFlightAppDeepLink(selectedFlight.flightNumber)}
                  className="py-3 px-4 rounded-xl bg-surface border border-outline hover:border-primary text-on-surface text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Smartphone className="w-4 h-4 text-primary" />
                  FlightRadar App
                </a>
                <a
                  href={flightRadarService.getFlightAwareUrl(selectedFlight.flightNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-surface border border-outline hover:border-primary text-on-surface text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Globe className="w-4 h-4 text-primary" />
                  FlightAware Web
                </a>
              </div>

              {/* Navigate to Into-Plane Button */}
              <button 
                className="w-full py-4 rounded-xl kinetic-gradient text-white font-black tracking-widest text-[12px] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                onClick={() => {
                  if (onNavigateToIntoPlane && selectedFlight) {
                    onNavigateToIntoPlane(selectedFlight);
                  }
                }}
              >
                OPEN IN INTO-PLANE FUELING <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
