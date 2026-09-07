import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Radar, Plane, MapPin, Clock, ExternalLink, 
  Smartphone, ArrowRight, PlaneLanding, Fuel, Ban,
  RefreshCw, Globe, Search, Layers, Compass, ZoomIn, ZoomOut,
  Maximize2, Radio, CheckCircle2, ChevronRight, ChevronLeft, X, ShieldAlert, Sparkles
} from 'lucide-react';
import { User, UserRole, FlightJob } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { flightRadarService } from '../services/flightRadarService';
import { differenceInMinutes } from 'date-fns';

interface FlightTrackerProps {
  user: User;
  onNavigateToIntoPlane?: (job: FlightJob) => void;
}

// Coordinate bearing presets based on origin airport
const KNOWN_ORIGIN_BEARINGS: Record<string, number> = {
  // Southeast Asia / East Asia (Approaching from ESE ~ 100° - 120°)
  SIN: 105, KUL: 100, BKK: 95, HKG: 85, CAN: 80, PVG: 75, KIX: 70, NRT: 70,
  // Middle East (Approaching from NW ~ 310° - 330°)
  DXB: 325, AUH: 322, DOH: 320, BAH: 318, KWI: 315, MCT: 330, SHJ: 326, JED: 305, RUH: 310,
  // South Asia (Approaching from NE / N ~ 010° - 060°)
  CMB: 55, TRV: 45, COK: 40, MAA: 35, BLR: 30, DEL: 10, BOM: 15, CCU: 25, DAC: 20,
  // Europe / Russia (Approaching from NNW ~ 335° - 355°)
  SVO: 345, DME: 345, VKO: 345, IST: 335, FRA: 340, LHR: 342, LGW: 342, CDG: 340, VIE: 338, ZRH: 339, FCO: 336, MXP: 337,
  // Domestic & Southern Atolls (Approaching from South ~ 180° - 195°)
  GAN: 185, KDM: 182, DRV: 5, IFU: 10, TMF: 190, HAQ: 8, RNL: 2
};

const getBearingForOrigin = (route?: string, flightNo: string = ''): number => {
  if (route) {
    const originCode = route.split('➔')[0]?.trim().toUpperCase();
    if (originCode && KNOWN_ORIGIN_BEARINGS[originCode]) {
      return KNOWN_ORIGIN_BEARINGS[originCode];
    }
  }
  // Pseudo-random deterministic bearing based on flight callsign
  let hash = 0;
  for (let i = 0; i < flightNo.length; i++) {
    hash = (hash << 5) - hash + flightNo.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
};

export const FlightTracker: React.FC<FlightTrackerProps> = ({ user, onNavigateToIntoPlane }) => {
  const { flightJobs, externalFlights, alerts, staff, refreshData, refreshExternalFlights } = useOperationalData();
  const [selectedFlight, setSelectedFlight] = useState<FlightJob | null>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<'assigned' | 'all'>('assigned');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'approaching' | 'stand'>('all');
  const [isDecluttered, setIsDecluttered] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showRings, setShowRings] = useState(true);
  const [showSweep, setShowSweep] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const radarSvgRef = useRef<SVGSVGElement>(null);
  const isDismissedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Scroll parent containers to top when FlightTracker mounts so the top bar is never cut off
  useEffect(() => {
    window.scrollTo(0, 0);
    if (containerRef.current) {
      let parent = containerRef.current.parentElement;
      while (parent) {
        if (parent.scrollTop > 0) {
          parent.scrollTop = 0;
        }
        parent = parent.parentElement;
      }
    }
  }, []);

  const handleCardsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (carouselRef.current && e.deltaY !== 0) {
      carouselRef.current.scrollLeft += e.deltaY * 0.9;
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 360;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync external flights on mount
  useEffect(() => {
    refreshExternalFlights();
  }, [refreshExternalFlights]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Assigned flights for today (based on role)
  const assignedFlights = useMemo(() => {
    let list = flightJobs.filter(job => {
      const jobDate = job.date || todayStr;
      return (jobDate === todayStr || !job.date) && job.status !== 'COMPLETED';
    });

    const canSeeAll = [UserRole.ADMIN, UserRole.ITP_MANAGER, UserRole.ITP_SUPERVISOR, UserRole.FUEL_MANAGEMENT].includes(user.role);

    if (!canSeeAll) {
      list = list.filter(job => 
        job.assignedTo === user.id || 
        job.assignedOfficer === user.id ||
        (job.assignedTo && job.assignedTo.toLowerCase() === user.name.toLowerCase()) ||
        (job.assignedOfficer && job.assignedOfficer.toLowerCase() === user.name.toLowerCase())
      );
    }

    return list.sort((a, b) => {
      const timeA = a.eta || a.sta || a.std || '23:59';
      const timeB = b.eta || b.sta || b.std || '23:59';
      return timeA.localeCompare(timeB);
    });
  }, [flightJobs, user, todayStr]);

  // All active inbound / scheduled flights today (merged flight jobs + live external flights)
  const allInboundFlights = useMemo(() => {
    const seen = new Set<string>();
    const combined: FlightJob[] = [];

    // Add existing flight jobs
    flightJobs.forEach(job => {
      if (job.status === 'COMPLETED') return;
      const cleanNo = (job.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (!cleanNo || seen.has(cleanNo)) return;
      seen.add(cleanNo);
      combined.push(job);
    });

    // Add external live flights from FIS
    (externalFlights || []).forEach((ef: any) => {
      const cleanNo = (ef.flightNumber || '').replace(/\s+/g, '').toUpperCase();
      if (!cleanNo || seen.has(cleanNo)) return;
      seen.add(cleanNo);

      combined.push({
        id: ef.id || `live-${cleanNo}`,
        flightNumber: ef.flightNumber,
        aircraftReg: ef.aircraftReg || '8Q-TBA',
        aircraftType: ef.aircraftType || 'Widebody',
        stand: ef.gate || '---',
        sta: ef.type === 'arrival' ? ef.scheduledTime : undefined,
        eta: ef.type === 'arrival' ? (ef.estimatedTime || ef.scheduledTime) : undefined,
        std: ef.type === 'departure' ? ef.scheduledTime : undefined,
        route: ef.type === 'arrival' ? `${ef.originCode || ef.origin || 'INTL'} ➔ MLE` : `MLE ➔ ${ef.destinationCode || ef.destination || 'INTL'}`,
        status: ef.status || 'SCHEDULED',
        fidsStatus: ef.status,
        type: ef.type || 'arrival',
        date: ef.date
      });
    });

    return combined.sort((a, b) => {
      const timeA = a.eta || a.sta || a.std || '23:59';
      const timeB = b.eta || b.sta || b.std || '23:59';
      return timeA.localeCompare(timeB);
    });
  }, [flightJobs, externalFlights]);

  // Active flight pool based on selected tab, range filter, and search
  const displayedFlights = useMemo(() => {
    let base = activeFilterTab === 'assigned' ? assignedFlights : allInboundFlights;

    if (rangeFilter === 'approaching') {
      base = base.filter(f => {
        const s = (f.fidsStatus || f.status || '').toUpperCase();
        return !s.includes('LAND') && !s.includes('ARRIV');
      });
    } else if (rangeFilter === 'stand') {
      base = base.filter(f => {
        const s = (f.fidsStatus || f.status || '').toUpperCase();
        return s.includes('LAND') || s.includes('ARRIV');
      });
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toUpperCase();
    return base.filter(f => 
      (f.flightNumber || '').toUpperCase().includes(q) ||
      (f.route || '').toUpperCase().includes(q) ||
      (f.aircraftType || '').toUpperCase().includes(q) ||
      (f.aircraftReg || '').toUpperCase().includes(q) ||
      (f.stand || '').toUpperCase().includes(q)
    );
  }, [activeFilterTab, assignedFlights, allInboundFlights, rangeFilter, searchQuery]);

  // Auto-select first flight once on mount if not dismissed
  useEffect(() => {
    if (!isDismissedRef.current && !selectedFlight && displayedFlights.length > 0) {
      setSelectedFlight(displayedFlights[0]);
    }
  }, [displayedFlights]);

  const handleCloseDossier = () => {
    isDismissedRef.current = true;
    setSelectedFlight(null);
    setIsMobileDrawerOpen(false);
  };

  const handleSelectFlight = (flight: FlightJob) => {
    isDismissedRef.current = false;
    setSelectedFlight(flight);
    setIsMobileDrawerOpen(true);
  };

  // Keyboard Escape listener to close dossier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDossier();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper: Live Countdown
  const getLiveCountdown = (timeStr?: string) => {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const targetDate = new Date(currentTime);
    targetDate.setHours(hours, minutes, 0, 0);

    const diffMs = targetDate.getTime() - currentTime.getTime();
    if (diffMs <= 0) return 'Past / On Ground';

    const totalSecs = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Status Badge Logic
  const getFlightStatusBadge = (flight: FlightJob) => {
    const s = (flight.fidsStatus || flight.status || '').toUpperCase();
    if (s.includes('LAND') || s.includes('ARRIV')) {
      return { label: 'LANDED', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    }
    if (s.includes('DEPART') || s.includes('AIRBORNE')) {
      return { label: 'DEPARTED', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    }

    const targetTime = flight.eta || flight.sta;
    if (targetTime) {
      const [hours, minutes] = targetTime.split(':').map(Number);
      const targetDate = new Date(currentTime);
      targetDate.setHours(hours, minutes, 0, 0);
      const diffMins = differenceInMinutes(targetDate, currentTime);

      if (diffMins < 0) return { label: 'ARRIVED', color: 'bg-primary/20 text-primary border border-primary/30' };
      if (diffMins <= 5) return { label: 'ETA <5 MIN', color: 'bg-error/20 text-error border border-error/30 animate-pulse font-black' };
      if (diffMins <= 15) return { label: 'ETA <15 MIN', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' };
      if (diffMins <= 30) return { label: '15-30 MIN', color: 'bg-warning/20 text-warning border border-warning/30' };
      return { label: '>30 MIN', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' };
    }

    if (flight.std) {
      return { label: `STD ${flight.std}`, color: 'bg-surface-dim text-on-surface-dim border border-outline/30' };
    }

    return { label: 'SCHEDULED', color: 'bg-surface-dim text-on-surface-dim border border-outline/30' };
  };

  // Check tactical alert for flight
  const getActiveAlert = (flightNumber?: string) => {
    if (!flightNumber) return null;
    const clean = flightNumber.replace(/\s+/g, '').toUpperCase();
    return (alerts || []).find(a => 
      !a.acknowledged && 
      (a.flightNumber?.replace(/\s+/g, '').toUpperCase() === clean || a.message?.toUpperCase().includes(clean))
    );
  };

  const getAirlineCode = (flightNumber?: string) => {
    if (!flightNumber) return 'UNKNOWN';
    const match = flightNumber.match(/^[A-Z0-9]{2,3}/i);
    return match ? match[0].toUpperCase() : 'UNKNOWN';
  };

  // Compute Radar Positions for Displayed Flights
  // Center is (400, 400). Rings: 5NM=65px, 15NM=140px, 30NM=230px, 50NM=330px.
  const radarTargets = useMemo(() => {
    const center = 400;
    return displayedFlights.map((flight, idx) => {
      const isSelected = selectedFlight?.id === flight.id;
      const status = (flight.fidsStatus || flight.status || '').toUpperCase();
      const isLanded = status.includes('LAND') || status.includes('ARRIV');
      const baseBearing = getBearingForOrigin(flight.route, flight.flightNumber);

      // Add a slight lateral corridor stagger (-4° to +4°) so flights sharing origin corridors don't stack directly on top of each other
      const corridorOffset = ((idx % 7) - 3) * 2;
      const bearing = (baseBearing + corridorOffset + 360) % 360;

      let distancePx = 280; // Default 40NM
      let altitude = 'FL240';
      let speed = '380 KT';
      let distNm = 42;

      const targetTime = flight.eta || flight.sta;
      if (isLanded) {
        // Parked on apron stands east of runway 18/36 (x ~ 412-440, y ~ 366-435)
        // Arrange parked flights along distinct stand slots rather than clumping directly on the runway!
        const col = idx % 3;
        const row = Math.floor(idx / 3) % 10;
        const standX = 414 + col * 10;
        const standY = 368 + row * 7;
        return {
          flight,
          x: standX,
          y: standY,
          distancePx: 20,
          distNm: 0,
          bearing: 90,
          heading: 270, // Parked facing west towards terminal
          altitude: 'GND',
          speed: '0 KT',
          isLanded: true,
          isSelected
        };
      } else if (targetTime) {
        const [hours, minutes] = targetTime.split(':').map(Number);
        const targetDate = new Date(currentTime);
        targetDate.setHours(hours, minutes, 0, 0);
        const diffMins = differenceInMinutes(targetDate, currentTime);

        if (diffMins <= 0) {
          distancePx = 30;
          distNm = 1;
          altitude = '300 FT';
          speed = '135 KT';
        } else if (diffMins <= 5) {
          distancePx = 55 + (diffMins / 5) * 20;
          distNm = 4;
          altitude = '1,800 FT';
          speed = '160 KT';
        } else if (diffMins <= 15) {
          distancePx = 80 + ((diffMins - 5) / 10) * 55;
          distNm = 12;
          altitude = '4,500 FT';
          speed = '210 KT';
        } else if (diffMins <= 30) {
          distancePx = 145 + ((diffMins - 15) / 15) * 80;
          distNm = 24;
          altitude = 'FL120';
          speed = '280 KT';
        } else {
          distancePx = 230 + Math.min(105, (diffMins - 30) * 2.2);
          distNm = Math.round(distancePx / 7);
          altitude = 'FL260';
          speed = '420 KT';
        }
      } else if (flight.std) {
        // Departure climbing out
        distancePx = 60 + (idx % 5) * 35;
        distNm = Math.round(distancePx / 7);
        altitude = 'FL090';
        speed = '260 KT';
      }

      // Convert bearing & distance to X, Y
      const angleRad = ((bearing - 90) * Math.PI) / 180;
      const x = center + distancePx * Math.cos(angleRad);
      const y = center + distancePx * Math.sin(angleRad);
      const heading = isLanded ? 184 : (bearing + 180) % 360;

      return {
        flight,
        x,
        y,
        distancePx,
        distNm,
        bearing,
        heading,
        altitude,
        speed,
        isLanded,
        isSelected
      };
    });
  }, [displayedFlights, selectedFlight, currentTime]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshData(), refreshExternalFlights()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 h-full min-h-0 w-full flex flex-col bg-surface-lowest text-on-surface overflow-hidden relative select-none"
    >
      {/* ── TOP CONTROL BAR ──────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-outline/30 px-4 py-3 flex flex-col gap-2.5 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Header & Badges */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-inner">
              <Radar className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[13px] font-black tracking-widest uppercase text-on-surface">
                  Flight Radar
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  LIVE AIRFIELD
                </span>
                <span className="hidden sm:inline-flex text-[9px] font-mono font-bold text-on-surface-dim opacity-70">
                  VRMM / MLE
                </span>
              </div>
              <p className="text-[10px] text-on-surface-dim font-bold tracking-wider mt-0.5">
                Velana International Airport • {displayedFlights.length} Flights Tracked
              </p>
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            {/* Filter Toggle */}
            <div className="inline-flex p-0.5 rounded-xl bg-surface-dim border border-outline/50">
              <button
                onClick={() => setActiveFilterTab('assigned')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeFilterTab === 'assigned'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
              >
                My Assigned ({assignedFlights.length})
              </button>
              <button
                onClick={() => setActiveFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeFilterTab === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
              >
                All Inbound ({allInboundFlights.length})
              </button>
            </div>

            {/* Sector / Range Filter Toggle */}
            <div className="inline-flex p-0.5 rounded-xl bg-surface-dim border border-outline/50">
              <button
                onClick={() => setRangeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all ${
                  rangeFilter === 'all'
                    ? 'bg-surface text-primary shadow-sm font-black'
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
                title="Show all flights"
              >
                All
              </button>
              <button
                onClick={() => setRangeFilter('approaching')}
                className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all ${
                  rangeFilter === 'approaching'
                    ? 'bg-surface text-amber-400 shadow-sm font-black'
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
                title="Show only approaching flights"
              >
                Approach
              </button>
              <button
                onClick={() => setRangeFilter('stand')}
                className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all ${
                  rangeFilter === 'stand'
                    ? 'bg-surface text-emerald-400 shadow-sm font-black'
                    : 'text-on-surface-dim hover:text-on-surface'
                }`}
                title="Show only flights at stands"
              >
                Stands
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative hidden md:block w-36">
              <Search className="w-3.5 h-3.5 text-on-surface-dim absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search flight..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-dim border border-outline/50 rounded-xl pl-8 pr-2.5 py-1.5 text-[11px] font-bold text-on-surface placeholder:text-on-surface-dim/40 focus:outline-none focus:border-primary"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-dim hover:text-on-surface">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-surface-dim border border-outline/50 hover:bg-surface-container text-on-surface-dim hover:text-primary transition-all active:scale-95 shrink-0"
              title="Refresh radar flights"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>

            {/* Direct FlightRadar24 Live Web Map */}
            <a
              href={flightRadarService.getFlightWebUrl(selectedFlight?.flightNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
              title="Open Live FlightRadar24 in external window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>FR24 Live Web</span>
            </a>
          </div>
        </div>

        {/* ── Flight Cards Strip with Horizontal Controls ────────────────── */}
        <div className="relative group/cards flex items-center w-full">
          {/* Scroll Left Button (Desktop) */}
          <button
            type="button"
            onClick={() => scrollCarousel('left')}
            className="hidden lg:flex absolute left-0.5 z-10 p-1.5 rounded-full bg-surface-container/90 hover:bg-surface-container-high border border-outline/50 shadow-md text-on-surface hover:text-primary transition-all active:scale-90 shrink-0 backdrop-blur-sm"
            title="Scroll flight cards left"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Cards Carousel */}
          <div 
            ref={carouselRef}
            onWheel={handleCardsWheel}
            className="w-full overflow-x-auto custom-scrollbar-thin scroll-smooth pt-1 pb-1 px-0.5 lg:px-7"
          >
            <div className="flex gap-2.5 min-w-max pb-0.5">
              {displayedFlights.length === 0 ? (
                <div className="py-2 text-[11px] font-bold text-on-surface-dim/60 italic flex items-center gap-2">
                  <Plane className="w-4 h-4" /> No flights matching current filter.
                </div>
              ) : (
                displayedFlights.map(flight => {
                  const isSelected = selectedFlight?.id === flight.id;
                  const statusBadge = getFlightStatusBadge(flight);
                  const airlineCode = getAirlineCode(flight.flightNumber);
                  const alert = getActiveAlert(flight.flightNumber);
                  const timeLabel = flight.eta ? `ETA ${flight.eta}` : flight.sta ? `STA ${flight.sta}` : flight.std ? `STD ${flight.std}` : '---';

                  return (
                    <button
                      key={flight.id}
                      onClick={() => handleSelectFlight(flight)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all active:scale-95 text-left min-w-[200px] relative ${
                        isSelected 
                          ? 'bg-surface-container border-primary shadow-premium ring-2 ring-primary/20' 
                          : 'bg-surface-dim/50 border-outline/40 hover:border-outline hover:bg-surface-dim'
                      }`}
                    >
                      {/* Airline Tail / Logo */}
                      <div className="w-8 h-8 rounded-lg bg-surface border border-outline/30 flex items-center justify-center shrink-0 overflow-hidden relative">
                        <img 
                          src={`https://fis.com.mv/tail/${airlineCode}.png`}
                          alt={airlineCode}
                          className="w-full h-full object-contain p-0.5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <Plane className="w-3.5 h-3.5 text-on-surface-dim absolute -z-10 opacity-30" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-black text-on-surface truncate">
                            {flight.flightNumber}
                          </span>
                          {alert && (
                            <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider ${
                              alert.alertType === 'NO_FUEL' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                            }`}>
                              {alert.alertType === 'NO_FUEL' ? 'NO FUEL' : 'REQ FUEL'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-on-surface-dim font-mono">
                            {timeLabel}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Scroll Right Button (Desktop) */}
          <button
            type="button"
            onClick={() => scrollCarousel('right')}
            className="hidden lg:flex absolute right-0.5 z-10 p-1.5 rounded-full bg-surface-container/90 hover:bg-surface-container-high border border-outline/50 shadow-md text-on-surface hover:text-primary transition-all active:scale-95 shrink-0 backdrop-blur-sm"
            title="Scroll flight cards right"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── MAIN RADAR + TELEMETRY WORKSPACE ─────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ── LEFT: TACTICAL AIRFIELD RADAR ──────────────────────────────── */}
        <div className="flex-1 relative bg-[#060a12] flex flex-col items-center justify-center overflow-hidden border-b lg:border-b-0">
          {/* Radar HUD Controls Floating Toolbar */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 bg-[#0b121e]/85 backdrop-blur-md border border-outline/30 rounded-xl p-1.5 shadow-lg">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
              className="p-1.5 rounded-lg text-on-surface-dim hover:text-primary hover:bg-surface-dim transition-all"
              title="Zoom in radar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
              className="p-1.5 rounded-lg text-on-surface-dim hover:text-primary hover:bg-surface-dim transition-all"
              title="Zoom out radar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
              className="p-1.5 rounded-lg text-on-surface-dim hover:text-primary hover:bg-surface-dim transition-all text-[9px] font-black uppercase px-2 font-mono"
              title="Reset center to MLE"
            >
              RESET
            </button>
            <div className="w-[1px] h-4 bg-outline/40 my-auto hidden sm:block" />
            <button
              onClick={() => setShowRings(!showRings)}
              className={`p-1.5 rounded-lg transition-all ${showRings ? 'text-primary bg-primary/10' : 'text-on-surface-dim'}`}
              title="Toggle range rings"
            >
              <Compass className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSweep(!showSweep)}
              className={`p-1.5 rounded-lg transition-all ${showSweep ? 'text-emerald-400 bg-emerald-500/10' : 'text-on-surface-dim'}`}
              title="Toggle radar sweep animation"
            >
              <Radio className="w-4 h-4" />
            </button>
            {/* Declutter toggle button */}
            <button
              onClick={() => setIsDecluttered(!isDecluttered)}
              className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                isDecluttered ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-on-surface-dim hover:text-on-surface'
              }`}
              title={isDecluttered ? "Declutter ON: Minimal clean tags" : "Declutter OFF: Showing all tags"}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{isDecluttered ? 'Clean' : 'Full'}</span>
            </button>
          </div>

          {/* Compass Orientation Indicator */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1 bg-[#0b121e]/80 backdrop-blur-md border border-outline/30 rounded-xl px-3 py-2 text-right shadow-lg pointer-events-none">
            <span className="text-[9px] font-black text-emerald-400 font-mono tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              MLE TMA • 50 NM
            </span>
            <span className="text-[10px] font-mono font-bold text-on-surface-dim">
              RWY 18/36 • 184° / 004°
            </span>
            <span className="text-[9px] font-mono text-on-surface-dim/60">
              {currentTime.toLocaleTimeString([], { hour12: false })} MVT (UTC+5)
            </span>
          </div>

          {/* SVG Tactical Radar Display */}
          <div className="w-full h-full flex items-center justify-center p-4">
            <svg
              ref={radarSvgRef}
              viewBox="0 0 800 800"
              className="w-full h-full max-w-[760px] max-h-[760px] transition-transform duration-300"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: '400px 400px'
              }}
            >
              <defs>
                {/* Radial background gradient */}
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0d1b2a" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#08101e" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#040810" stopOpacity="1" />
                </radialGradient>

                {/* Sweep sector gradient */}
                <radialGradient id="sweepGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.25)" />
                  <stop offset="70%" stopColor="rgba(56, 189, 248, 0.08)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>

                {/* Aircraft glow filters */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Radar circular base */}
              <circle cx="400" cy="400" r="370" fill="url(#radarGlow)" stroke="#1e293b" strokeWidth="2" />

              {/* Range Rings with nautical mile markings */}
              {showRings && (
                <>
                  {/* 5 NM Ring (Touchdown & Stand Zone) */}
                  <circle cx="400" cy="400" r="65" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3,3" opacity="0.35" />
                  <text x="404" y="340" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold" opacity="0.6">5 NM</text>

                  {/* 15 NM Ring (Final Approach & 15-min Alert Zone) */}
                  <circle cx="400" cy="400" r="140" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4,4" opacity="0.45" />
                  <text x="404" y="265" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.75">15 NM (APPROACH)</text>

                  {/* 30 NM Ring (Terminal Maneuvering Area) */}
                  <circle cx="400" cy="400" r="230" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4,6" opacity="0.35" />
                  <text x="404" y="175" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.65">30 NM (TMA)</text>

                  {/* 50 NM Ring (Outer Sector) */}
                  <circle cx="400" cy="400" r="330" fill="none" stroke="#0284c7" strokeWidth="1.5" opacity="0.3" />
                  <text x="404" y="75" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.6">50 NM (CONTROL SECTOR)</text>

                  {/* Crosshair grid lines */}
                  <line x1="400" y1="40" x2="400" y2="760" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                  <line x1="40" y1="400" x2="760" y2="400" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />

                  {/* Diagonal guides (30° and 60° increments) */}
                  <line x1="145" y1="145" x2="655" y2="655" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,6" opacity="0.4" />
                  <line x1="145" y1="655" x2="655" y2="145" stroke="#1e293b" strokeWidth="0.8" strokeDasharray="2,6" opacity="0.4" />

                  {/* Cardinal Compass Headings */}
                  <text x="400" y="32" textAnchor="middle" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="900">000° N</text>
                  <text x="778" y="404" textAnchor="start" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="900">090° E</text>
                  <text x="400" y="785" textAnchor="middle" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="900">180° S</text>
                  <text x="5" y="404" textAnchor="start" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="900">270° W</text>
                </>
              )}

              {/* Geographic Features: Malé, Hulhulé (Airport Island), Hulhumalé */}
              <g id="atollGeography" opacity="0.6">
                {/* Malé Island */}
                <path d="M 370 420 Q 385 415 390 425 Q 388 438 375 435 Z" fill="#0f2b38" stroke="#10b981" strokeWidth="1" />
                <text x="365" y="445" fill="#10b981" fontSize="7" fontFamily="monospace">MALÉ</text>

                {/* Hulhulé Airport Island & Runway 18/36 */}
                <rect x="398" y="365" width="4" height="70" rx="1" fill="#38bdf8" filter="url(#glow)" />
                <line x1="400" y1="365" x2="400" y2="435" stroke="#ffffff" strokeWidth="1" strokeDasharray="2,2" />
                <text x="406" y="402" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">VRMM (MLE)</text>

                {/* Hulhumalé Island */}
                <path d="M 405 345 Q 418 335 425 355 Q 420 375 408 368 Z" fill="#0f2b38" stroke="#10b981" strokeWidth="1" />
                <text x="424" y="355" fill="#10b981" fontSize="7" fontFamily="monospace">HULHUMALÉ</text>

                {/* Runway extended centerlines (ILS Approach paths for RWY 18 & 36) */}
                <line x1="400" y1="180" x2="400" y2="365" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4,4" opacity="0.6" />
                <line x1="400" y1="435" x2="400" y2="620" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4,4" opacity="0.6" />
              </g>

              {/* Rotating Radar Sweep Ray */}
              {showSweep && (
                <g style={{ transformOrigin: '400px 400px', animation: 'spin 5s linear infinite' }}>
                  <line x1="400" y1="400" x2="400" y2="40" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
                  <path d="M 400 400 L 400 40 A 360 360 0 0 1 490 52 Z" fill="url(#sweepGradient)" />
                </g>
              )}

              {/* Selected Flight Approach Vector Highlight */}
              {selectedFlight && (() => {
                const target = radarTargets.find(t => t.flight.id === selectedFlight.id);
                if (!target || target.isLanded) return null;
                return (
                  <g className="animate-pulse">
                    <line 
                      x1={target.x} 
                      y1={target.y} 
                      x2={400} 
                      y2={400} 
                      stroke="#f59e0b" 
                      strokeWidth="2" 
                      strokeDasharray="6,4" 
                    />
                    <circle cx={target.x} cy={target.y} r="18" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,3" />
                  </g>
                );
              })()}

              {/* Plotted Live Aircraft Targets */}
              {radarTargets.map(({ flight, x, y, distNm, heading, altitude, speed, isLanded, isSelected }) => {
                const alert = getActiveAlert(flight.flightNumber);
                const isUrgent = alert || distNm <= 5;
                const statusColor = isUrgent ? '#ef4444' : isLanded ? '#10b981' : distNm <= 15 ? '#f59e0b' : '#38bdf8';
                
                // Smart Level of Detail: Show full datatag for selected, urgent, or close approach (<15NM) unless decluttered
                const showFullTag = isSelected || isUrgent || (!isDecluttered && distNm <= 15 && radarTargets.length < 35) || zoomLevel >= 1.5;

                return (
                  <g 
                    key={flight.id} 
                    className="cursor-pointer group transition-all"
                    onClick={() => handleSelectFlight(flight)}
                  >
                    {/* Generous touch/click hit area for mobile */}
                    <circle cx={x} cy={y} r="18" fill="transparent" />

                    {/* Smooth in-place pulsing ring (SVG animate - NO CSS animate-ping) */}
                    {(isSelected || isUrgent) && (
                      <circle 
                        cx={x} 
                        cy={y} 
                        r={isSelected ? 14 : 10} 
                        fill="none" 
                        stroke={statusColor} 
                        strokeWidth="1.5" 
                      >
                        <animate 
                          attributeName="r" 
                          values={isSelected ? "12;22;12" : "8;18;8"} 
                          dur="2s" 
                          repeatCount="indefinite" 
                        />
                        <animate 
                          attributeName="opacity" 
                          values="0.85;0.15;0.85" 
                          dur="2s" 
                          repeatCount="indefinite" 
                        />
                      </circle>
                    )}

                    {/* Aircraft Blip / Icon */}
                    <circle cx={x} cy={y} r={isSelected ? "4.5" : "3.5"} fill={statusColor} />
                    
                    {/* Directional airplane symbol */}
                    <g transform={`translate(${x}, ${y}) rotate(${heading}) translate(-7, -7)`}>
                      <path 
                        d="M 7 1 L 9 5 L 14 7 L 14 9 L 9 8 L 9 12 L 11 14 L 11 15 L 7 14 L 3 15 L 3 14 L 5 12 L 5 8 L 0 9 L 0 7 L 5 5 Z" 
                        fill={statusColor} 
                      />
                    </g>

                    {/* Tactical Flight Datatag */}
                    {showFullTag ? (
                      <g transform={`translate(${x + 10}, ${y - 12})`}>
                        <rect 
                          x="0" 
                          y="0" 
                          width={isSelected ? "96" : "76"} 
                          height="26" 
                          rx="4" 
                          fill="#0b121e" 
                          stroke={isSelected ? "#f59e0b" : statusColor} 
                          strokeWidth={isSelected ? "1.8" : "0.8"} 
                          opacity="0.94" 
                        />
                        <text x="6" y="11" fill="#f8fafc" fontSize="8.5" fontFamily="monospace" fontWeight="900">
                          {flight.flightNumber}
                        </text>
                        <text x="6" y="21" fill={statusColor} fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                          {isLanded ? `STAND ${flight.stand || 'TBA'}` : `${altitude} • ${distNm}NM`}
                        </text>
                      </g>
                    ) : (
                      /* Compact Minimal Datatag: Clean Pill with Flight Number (Prevents mobile clutter) */
                      <g transform={`translate(${x + 7}, ${y - 7})`}>
                        <rect 
                          x="0" 
                          y="0" 
                          width="44" 
                          height="14" 
                          rx="3" 
                          fill="#0b121e" 
                          stroke={statusColor} 
                          strokeWidth="0.6" 
                          opacity="0.88" 
                        />
                        <text x="4" y="10" fill="#e2e8f0" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                          {flight.flightNumber}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Radar Footer Status Bar */}
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 bg-[#0b121e]/90 backdrop-blur-md border border-outline/30 rounded-xl px-2.5 py-1.5 shadow-lg">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[8.5px] font-bold text-on-surface-dim uppercase">Landed</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-[8.5px] font-bold text-on-surface-dim uppercase">&lt;15m</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span className="text-[8.5px] font-bold text-on-surface-dim uppercase">Inbound</span>
              </div>
            </div>

            {/* Desktop & Mobile Dossier Control Buttons */}
            <div className="pointer-events-auto flex items-center gap-2">
              {selectedFlight ? (
                <button
                  onClick={handleCloseDossier}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/90 border border-outline/40 hover:border-primary text-on-surface text-[10px] font-black uppercase tracking-wider shadow-lg transition-all active:scale-95"
                  title="Close flight dossier (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Dossier</span>
                </button>
              ) : displayedFlights.length > 0 ? (
                <button
                  onClick={() => handleSelectFlight(displayedFlights[0])}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-wider shadow-lg hover:opacity-95 transition-all active:scale-95"
                  title="Open flight dossier"
                >
                  <span>Flight Dossier</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : null}

              {/* Mobile Open Drawer Button */}
              {selectedFlight && (
                <button
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95"
                >
                  <span>Flight Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Drawer Backdrop */}
        {isMobileDrawerOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[55] lg:hidden animate-in fade-in duration-200"
            onClick={handleCloseDossier}
          />
        )}

        {/* ── RIGHT: FLIGHT TELEMETRY & DISPATCH DOSSIER ─────────────────── */}
        {/* Desktop sidebar / Mobile bottom sheet */}
        <div 
          className={`
            w-full lg:w-[380px] xl:w-[420px] shrink-0 border-outline/30 bg-surface flex flex-col transition-all duration-300
            ${selectedFlight ? 'lg:static lg:flex lg:h-full lg:max-h-none lg:rounded-none lg:shadow-none lg:border-t-0 lg:border-l lg:z-30' : 'lg:hidden'}
            ${isMobileDrawerOpen 
              ? 'fixed inset-x-0 bottom-0 z-[60] max-h-[82vh] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] rounded-t-3xl border-t border-outline/50 animate-in slide-in-from-bottom duration-300' 
              : 'max-lg:hidden'}
          `}
        >
          {selectedFlight && (
            <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 pb-10 lg:pb-5">
              {/* Card Header with Close Button (Visible on BOTH Desktop & Mobile) */}
              <div className="flex flex-col pt-0 pb-1">
                <div className="w-10 h-1 rounded-full bg-outline/60 mb-2 shrink-0 lg:hidden self-center" />
                <div className="w-full flex items-center justify-between pb-2 border-b border-outline/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim">
                      Flight Dossier & Telemetry
                    </span>
                  </div>
                  <button 
                    onClick={handleCloseDossier}
                    className="p-1.5 rounded-lg text-on-surface-dim hover:text-on-surface hover:bg-surface-dim transition-colors"
                    title="Close flight details (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Flight Card */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-surface-dim border border-outline/40 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    <img 
                      src={`https://fis.com.mv/tail/${getAirlineCode(selectedFlight.flightNumber)}.png`}
                      alt="Tail"
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                        {selectedFlight.flightNumber}
                      </h2>
                      {(() => {
                        const alert = getActiveAlert(selectedFlight.flightNumber);
                        if (!alert) return null;
                        return (
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            alert.alertType === 'NO_FUEL' ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'
                          }`}>
                            {alert.alertType === 'NO_FUEL' ? <Ban className="w-3 h-3" /> : <Fuel className="w-3 h-3" />}
                            {alert.alertType === 'NO_FUEL' ? 'NO FUEL' : 'REQ FUEL'}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] font-bold text-on-surface-dim tracking-wider flex items-center gap-1.5 mt-0.5">
                      <Plane className="w-3.5 h-3.5" />
                      {selectedFlight.aircraftType} • {selectedFlight.aircraftReg || '8Q-TBA'}
                    </p>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-surface-dim border border-outline/50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[8.5px] font-black text-on-surface-dim tracking-widest">STAND</span>
                  <span className="text-[16px] font-black text-primary">{selectedFlight.stand || '---'}</span>
                </div>
              </div>

              {/* Route Display */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-dim/60 border border-outline/40">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-on-surface-dim tracking-widest uppercase">Origin</span>
                  <span className="text-[15px] font-black text-on-surface font-mono">
                    {selectedFlight.route?.split('➔')[0]?.trim() || 'INTL'}
                  </span>
                </div>

                <div className="flex-1 flex items-center justify-center px-4 relative">
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-outline/40 top-1/2 -translate-y-1/2"></div>
                  <Plane className="w-4 h-4 text-primary rotate-90 bg-surface-dim px-0.5 relative z-10" />
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-on-surface-dim tracking-widest uppercase">Destination</span>
                  <span className="text-[15px] font-black text-on-surface font-mono">
                    {selectedFlight.route?.split('➔')[1]?.trim() || 'MLE'}
                  </span>
                </div>
              </div>

              {/* Timing Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex flex-col p-2.5 rounded-xl bg-surface-dim border border-outline/30">
                  <span className="text-[8.5px] font-black text-on-surface-dim tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> STA
                  </span>
                  <span className="text-[13px] font-black text-on-surface font-mono mt-0.5">
                    {selectedFlight.sta || '--:--'}
                  </span>
                </div>

                <div className="flex flex-col p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                  <span className="text-[8.5px] font-black text-primary tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ETA
                  </span>
                  <span className="text-[13px] font-black text-primary font-mono mt-0.5">
                    {selectedFlight.eta || '--:--'}
                  </span>
                  {selectedFlight.eta && (
                    <span className="text-[8px] font-bold text-primary/80 font-mono">
                      in {getLiveCountdown(selectedFlight.eta)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col p-2.5 rounded-xl bg-surface-dim border border-outline/30">
                  <span className="text-[8.5px] font-black text-on-surface-dim tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3" /> STD
                  </span>
                  <span className="text-[13px] font-black text-on-surface font-mono mt-0.5">
                    {selectedFlight.std || '--:--'}
                  </span>
                  {selectedFlight.std && !selectedFlight.eta && (
                    <span className="text-[8px] font-bold text-on-surface-dim font-mono">
                      in {getLiveCountdown(selectedFlight.std)}
                    </span>
                  )}
                </div>
              </div>

              {/* Crew Assignments */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-dim/40 border border-outline/30">
                <span className="text-[9px] font-black text-on-surface-dim tracking-widest uppercase">
                  Airfield Crew Assignments
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-on-surface-dim">Operator</span>
                    <span className="text-[12px] font-black text-on-surface">
                      {staff.find(s => s.id === selectedFlight.assignedTo)?.name || selectedFlight.assignedTo || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold text-on-surface-dim">Officer</span>
                    <span className="text-[12px] font-black text-on-surface">
                      {staff.find(s => s.id === selectedFlight.assignedOfficer)?.name || selectedFlight.assignedOfficer || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Live External Flight Radar Links */}
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-on-surface-dim tracking-widest uppercase">
                  External Live Flight Radar Trackers
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {/* Flightradar24 App Deep Link */}
                  <a
                    href={flightRadarService.getFlightAppDeepLink(selectedFlight.flightNumber)}
                    className="py-2.5 px-3 rounded-xl bg-surface-dim border border-outline hover:border-primary text-on-surface text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                    title="Launch directly in FlightRadar24 App on phone"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-primary" />
                    FR24 App
                  </a>

                  {/* FlightRadar24 Web Map */}
                  <a
                    href={flightRadarService.getFlightWebUrl(selectedFlight.flightNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-surface-dim border border-outline hover:border-primary text-on-surface text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                    title="Open in FlightRadar24 Website"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    FR24 Web
                  </a>

                  {/* FlightAware */}
                  <a
                    href={flightRadarService.getFlightAwareUrl(selectedFlight.flightNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-surface-dim border border-outline hover:border-primary text-on-surface text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    FlightAware
                  </a>

                  {/* RadarBox */}
                  <a
                    href={flightRadarService.getRadarBoxUrl(selectedFlight.flightNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-surface-dim border border-outline hover:border-primary text-on-surface text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    RadarBox
                  </a>
                </div>
              </div>

              {/* Navigate to Into-Plane Fueling Button */}
              <button 
                className="w-full py-3.5 rounded-xl kinetic-gradient text-white font-black tracking-widest text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform mt-1"
                onClick={() => {
                  if (onNavigateToIntoPlane && selectedFlight) {
                    onNavigateToIntoPlane(selectedFlight);
                  }
                }}
              >
                OPEN IN INTO-PLANE FUELING <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
