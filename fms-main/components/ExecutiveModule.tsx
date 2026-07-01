import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Calendar, FileText, TrendingUp, ShieldCheck, AlertTriangle, 
  ArrowUpRight, Info, Database, Layers, Ship, Plane, Compass, Activity, Clock,
  Plus, Trash2, Sliders
} from 'lucide-react';
import { User } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';

interface ExecutiveModuleProps {
  user?: User | null;
}

interface StockSummarySnapshot {
  date: string;
  openingStock: number;
  physicalBalance: number;
  deadStock: number;
  usableFuel: number;
  prevDaySales: number;
  sevenDayAvgSales: number;
  daysRemaining: number;
  estimatedLastTill: string;
  nextShipmentArrival: string;
  orderQtyMt: number;
  orderQtyLiters: number;
  daysToShipment: number;
  coverageStatus: 'secure' | 'warning' | 'critical';
}

interface ShipmentData {
  id: string;
  shipmentNumber: string;
  vessel: string;
  arrivalDate: string;
  isConfirmed: boolean;
  isCancelled?: boolean;
  orderQtyMt: number;
  averageSales: number;
  deadStock: number;
}

// Deterministic mock snapshot generator based on selected date string
const generateSnapshotForDate = (dateStr: string): StockSummarySnapshot => {
  // Simple deterministic hash based on the date string characters
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const seedRandom = (min: number, max: number) => {
    const x = Math.sin(hash++) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  const openingStock = seedRandom(7200000, 9400000);
  const prevDaySales = seedRandom(190000, 270000);
  const physicalBalance = openingStock - prevDaySales;
  const deadStock = 500000; // unpumpable tank bottoms
  const usableFuel = physicalBalance - deadStock;
  const sevenDayAvgSales = seedRandom(210000, 238000);
  
  const daysRemaining = parseFloat((usableFuel / sevenDayAvgSales).toFixed(1));
  
  // Calculate "Estimated Last Till" date
  const lastTillDate = new Date(dateStr);
  lastTillDate.setDate(lastTillDate.getDate() + Math.floor(daysRemaining));
  const estimatedLastTill = lastTillDate.toISOString().split('T')[0];
  
  // Shipment calculation
  const shipmentDate = new Date(dateStr);
  const daysToShipment = seedRandom(8, 26);
  shipmentDate.setDate(shipmentDate.getDate() + daysToShipment);
  const nextShipmentArrival = shipmentDate.toISOString().split('T')[0];
  
  const orderQtyMt = seedRandom(16000, 18500);
  const orderQtyLiters = Math.round(orderQtyMt * 1274); // conversion factor
  
  // Threshold determination: 22-Day Stock Coverage Threshold
  // secure: >= 22 days, warning: 15-22 days, critical: < 15 days
  const coverageStatus = daysRemaining >= 22 ? 'secure' : daysRemaining >= 15 ? 'warning' : 'critical';
  
  return {
    date: dateStr,
    openingStock,
    physicalBalance,
    deadStock,
    usableFuel,
    prevDaySales,
    sevenDayAvgSales,
    daysRemaining,
    estimatedLastTill,
    nextShipmentArrival,
    orderQtyMt,
    orderQtyLiters,
    daysToShipment,
    coverageStatus
  };
};

// Generates 30-day coverage days trend data
const generate30DayTrend = (endDateStr: string) => {
  const data = [];
  const endDate = new Date(endDateStr);
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const snap = generateSnapshotForDate(dateStr);
    data.push({
      date: dateStr.substring(5), // MM-DD
      daysRemaining: snap.daysRemaining,
      usableFuel: snap.usableFuel
    });
  }
  return data;
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const closingStockObj = payload.find((item: any) => item.name === 'Closing Stock');
    const ullageObj = payload.find((item: any) => item.name === 'Available Ullage');
    const rawData = payload[0]?.payload || {};
    const closingStock = rawData.closingStock;
    const isCancelled = rawData.isCancelled;
    const availableUllage = rawData.remainingUllageAfterReceipt !== undefined 
      ? Math.max(0, rawData.remainingUllageAfterReceipt)
      : (ullageObj ? Number(ullageObj.value) : 0);

    return (
      <div className="bg-[var(--color-surface-dim)] border border-[var(--color-outline)] p-4 rounded-xl shadow-premium space-y-1.5 min-w-[200px]">
        <p className="text-xs font-black text-[var(--color-on-surface)] uppercase tracking-wider mb-2">
          {label} {isCancelled && <span className="text-error text-[9px] ml-1.5">(CANCELLED)</span>}
        </p>
        {closingStockObj && (
          <div className="flex justify-between items-center gap-6">
            <span className="font-bold text-[var(--color-on-surface-dim)] opacity-85">Closing Stock:</span>
            <span className={`font-mono font-black ${isCancelled ? 'text-on-surface-dim/50 line-through' : 'text-primary'}`}>{closingStock?.toLocaleString()} L</span>
          </div>
        )}
        {ullageObj && (
          <div className="flex justify-between items-center gap-6">
            <span className="font-bold text-[var(--color-on-surface-dim)] opacity-85">Available Ullage:</span>
            <span className="font-mono font-black text-[var(--color-on-surface)]">{availableUllage?.toLocaleString()} L</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const ExecutiveModule: React.FC<ExecutiveModuleProps> = ({ user }) => {
  // Static daily view calendar state (initializes to Velana operational day)
  const [selectedDate, setSelectedDate] = useState<string>('2026-06-02');
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compute daily summary snapshots dynamically based on active selected calendar date
  const snapshot = useMemo(() => generateSnapshotForDate(selectedDate), [selectedDate]);
  
  // Compute MTD details dynamically
  const mtdDetails = useMemo(() => {
    const day = new Date(selectedDate).getDate();
    const volume = day * 224000 + 42000;
    const flights = day * 34 + 4;
    const variance = 4.8; // +4.8% YoY
    return { volume, flights, variance };
  }, [selectedDate]);

  // Compute 30-day line graph coordinates
  const trendData = useMemo(() => generate30DayTrend(selectedDate), [selectedDate]);

  // Dynamic window safety calculation (Usable Stock Days vs Days to Shipment Arrival)
  const safetyWindow = useMemo(() => {
    return parseFloat((snapshot.daysRemaining - snapshot.daysToShipment).toFixed(1));
  }, [snapshot]);

  const { tanks = [] } = useOperationalData();
  const nffTanks = useMemo(() => tanks.filter(t => ['tk101', 'tk102', 'tk103'].includes(t.id)), [tanks]);
  const maxCapacity = useMemo(() => nffTanks.reduce((acc, t) => acc + t.capacity, 0) || 43500000, [nffTanks]);
  const tanksCurrentLevel = useMemo(() => nffTanks.reduce((acc, t) => acc + t.currentLevel, 0) || 33765840, [nffTanks]);

  const [activeTab, setActiveTab] = useState<'daily' | 'shipment'>('daily');
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [initialStock, setInitialStock] = useState<number | null>(null);
  const activeInitialStock = initialStock !== null ? initialStock : tanksCurrentLevel;
  
  const [shipments, setShipments] = useState<ShipmentData[]>([
    {
      id: '168',
      shipmentNumber: '168 Delivery',
      vessel: 'MT.ALIMAS',
      arrivalDate: '2026-06-12',
      isConfirmed: true,
      isCancelled: false,
      orderQtyMt: 10000,
      averageSales: 552887,
      deadStock: 2500000
    },
    {
      id: '169',
      shipmentNumber: '169 Delivery',
      vessel: 'MT.NEON',
      arrivalDate: '2026-07-14',
      isConfirmed: false,
      isCancelled: false,
      orderQtyMt: 13000,
      averageSales: 665000,
      deadStock: 2500000
    },
    {
      id: '170',
      shipmentNumber: '170 Delivery',
      vessel: 'MT.NEON',
      arrivalDate: '2026-08-02',
      isConfirmed: false,
      isCancelled: false,
      orderQtyMt: 11000,
      averageSales: 745000,
      deadStock: 2500000
    },
    {
      id: '171',
      shipmentNumber: '171 Delivery',
      vessel: 'MT.NEON',
      arrivalDate: '2026-08-21',
      isConfirmed: false,
      isCancelled: false,
      orderQtyMt: 10000,
      averageSales: 732000,
      deadStock: 2500000
    },
    {
      id: '172',
      shipmentNumber: '172 Delivery',
      vessel: 'MT.NEON',
      arrivalDate: '2026-09-09',
      isConfirmed: false,
      isCancelled: false,
      orderQtyMt: 10000,
      averageSales: 727000,
      deadStock: 2500000
    }
  ]);

  const getDaysBetween = (d1Str: string, d2Str: string) => {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    d1.setHours(0,0,0,0);
    d2.setHours(0,0,0,0);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculatedShipments = useMemo(() => {
    let prevDate = currentDate;
    let prevClosingStock = activeInitialStock;
    
    return shipments.map((shipment, index) => {
      // Check if shipment arrival date is in the past relative to the Forecast Base Date
      const isPast = shipment.arrivalDate < currentDate;
      
      let days = 0;
      if (!isPast) {
        days = getDaysBetween(prevDate, shipment.arrivalDate);
        if (prevDate === currentDate && index === 0) {
          days = Math.max(0, days - 1);
        }
      }
      
      // Auto-confirm logic: automatically confirm if date of arrival is less than 31 days from the Forecast Base Date (today)
      const daysFromBase = getDaysBetween(currentDate, shipment.arrivalDate);
      const autoConfirmed = !shipment.isCancelled && (shipment.isConfirmed || daysFromBase < 31);
      
      const estimatedSales = isPast ? 0 : days * shipment.averageSales;
      const orderQtyLiters = shipment.orderQtyMt * 1270;
      const openingStock = isPast ? activeInitialStock : (index === 0 ? activeInitialStock : prevClosingStock);
      const availableUllageAtArrival = Math.max(0, maxCapacity - openingStock);
      
      // If the shipment is cancelled or in the past, no future fuel receipt is added to the forecast calculations
      const receiptQty = (shipment.isCancelled || isPast) ? 0 : orderQtyLiters;
      const closingStock = isPast ? openingStock : (openingStock - estimatedSales + receiptQty);
      const remainingUllageAfterReceipt = maxCapacity - closingStock;
      const stockAvailableAtVesselArrival = isPast 
        ? openingStock - shipment.deadStock
        : openingStock - estimatedSales - shipment.deadStock;
      
      const stockDaysAtArrival = shipment.averageSales > 0 
        ? parseFloat(((stockAvailableAtVesselArrival / shipment.averageSales) - 1).toFixed(2))
        : 0;
        
      if (isPast) {
        // If this shipment is in the past, the next shipment's calculation timeline starts from currentDate
        prevDate = currentDate;
        prevClosingStock = activeInitialStock;
      } else {
        prevDate = shipment.arrivalDate;
        prevClosingStock = closingStock;
      }
      
      return {
        ...shipment,
        isConfirmed: autoConfirmed,
        daysBetween: days,
        openingStock,
        orderQtyLiters,
        estimatedSales,
        availableUllageAtArrival,
        closingStock,
        remainingUllageAfterReceipt,
        remainingUllageDisplay: Math.max(0, remainingUllageAfterReceipt),
        stockAvailableAtVesselArrival,
        stockDaysAtArrival
      };
    });
  }, [shipments, currentDate, activeInitialStock, maxCapacity]);

  const visibleShipments = useMemo(() => {
    return calculatedShipments.slice(-6);
  }, [calculatedShipments]);

  const renderCustomTick = (props: any) => {
    const { x, y, payload } = props;
    const shipment = calculatedShipments.find(s => s.shipmentNumber === payload.value);
    const color = shipment?.isCancelled 
      ? '#ef4444' // red/error for cancelled
      : shipment?.isConfirmed 
        ? '#22c55e' // success green
        : '#f59e0b'; // warning yellow-orange
        
    const match = payload.value.match(/(\d+)/);
    const num = match ? match[1] : payload.value;
    const labelText = isMobile 
      ? `${num}${shipment?.isCancelled ? '✗' : ''}` 
      : `${payload.value}${shipment?.isCancelled ? ' (CANC)' : ''}`;

    return (
      <text x={x} y={y + 12} textAnchor="middle" fill={color} fontSize={isMobile ? 8 : 9} fontWeight={900} className="uppercase tracking-wider">
        {labelText}
      </text>
    );
  };

  const handleUpdateShipment = (index: number, fields: Partial<ShipmentData>) => {
    setShipments(prev => prev.map((s, i) => i === index ? { ...s, ...fields } : s));
  };

  const handleAddShipment = () => {
    setShipments(prev => {
      const lastShipment = prev[prev.length - 1];
      const match = lastShipment.shipmentNumber.match(/(\d+)/);
      const lastNum = match ? parseInt(match[1], 10) : 172;
      const nextNum = lastNum + 1;
      
      const lastDate = new Date(lastShipment.arrivalDate);
      lastDate.setDate(lastDate.getDate() + 19);
      const nextArrivalDate = lastDate.toISOString().split('T')[0];

      return [
        ...prev,
        {
          id: String(nextNum),
          shipmentNumber: `${nextNum} Delivery`,
          vessel: lastShipment.vessel,
          arrivalDate: nextArrivalDate,
          isConfirmed: false,
          isCancelled: false,
          orderQtyMt: lastShipment.orderQtyMt,
          averageSales: lastShipment.averageSales,
          deadStock: lastShipment.deadStock
        }
      ];
    });
  };

  const handleRemoveShipment = () => {
    setShipments(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  return (
    <div 
      className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32"
      onClick={(e) => {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement && activeEl.type === 'date') {
          if (e.target !== activeEl) {
            activeEl.blur();
          }
        }
      }}
    >
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            EXECUTIVE <span className="text-primary italic font-medium ml-3">PORTAL</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Maldives Airports Co. Ltd</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Velana Fuel Strategy Dashboard</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-success uppercase tracking-[0.3em] flex items-center gap-1">
               <ShieldCheck className="w-3.5 h-3.5 text-success" /> Static Daily Registry active
             </span>
          </div>
        </div>

        {/* Historical Archive Retrieval Calendar Selector */}
        <div className="flex flex-col space-y-2 shrink-0">
          <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Archive Snapshot Date</label>
          <div className="relative flex items-center gap-3 bg-surface-dim border border-outline px-5 py-3 rounded-2xl shadow-inner hover:border-primary/50 transition-colors">
            <Calendar className="w-4 h-4 text-primary shrink-0 opacity-50 pointer-events-none" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
              className="bg-transparent border-none outline-none text-xs font-black uppercase text-on-surface cursor-pointer select-none focus:ring-0 w-[140px]"
            />
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="mb-6 flex justify-center sm:justify-start">
        <div className="bg-surface-dim p-1.5 rounded-[22px] border border-outline flex relative w-full max-w-[340px] sm:max-w-none sm:w-[680px] shadow-inner overflow-hidden">
          <div 
            className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] kinetic-gradient rounded-[18px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium ${
              activeTab === 'shipment' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-3 px-2 sm:px-6 rounded-[18px] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] relative z-10 transition-colors duration-300 sm:whitespace-nowrap ${
              activeTab === 'daily' ? 'text-white' : 'text-on-surface-dim opacity-60'
            }`}
          >
            Daily Stock & Coverage
          </button>
          <button
            onClick={() => setActiveTab('shipment')}
            className={`flex-1 py-3 px-2 sm:px-6 rounded-[18px] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] relative z-10 transition-colors duration-300 sm:whitespace-nowrap ${
              activeTab === 'shipment' ? 'text-white' : 'text-on-surface-dim opacity-60'
            }`}
          >
            Shipment Forecast Summer 2026
          </button>
        </div>
      </div>

      {activeTab === 'daily' ? (
        <>
          {/* ── DAILY SUMMARY STATUS BANNER ── */}
          <div className="card-premium p-6 lg:p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 border-l-primary relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                snapshot.coverageStatus === 'secure' ? 'bg-success/10 text-success border-success/20 shadow-glow' : 
                snapshot.coverageStatus === 'warning' ? 'bg-warning/10 text-warning border-warning/20' : 
                'bg-error/10 text-error border-error/20 animate-pulse shadow-glow'
              }`}>
                {snapshot.coverageStatus === 'secure' ? <ShieldCheck className="w-6 h-6" /> : 
                 snapshot.coverageStatus === 'warning' ? <AlertTriangle className="w-6 h-6 text-warning" /> : 
                 <AlertTriangle className="w-6 h-6 text-error" />}
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-on-surface">Static Daily Summary snapshot</h4>
                <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-1 leading-relaxed">
                  Recorded on <span className="text-on-surface font-mono">{snapshot.date}</span>. This view remains constant throughout the operational day and compiles static figures generated for this historical date.
                </p>
              </div>
            </div>
            
            {/* Coverage Threshold indicator */}
            <div className="flex flex-col items-end">
              <span className={`text-[9px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider ${
                snapshot.coverageStatus === 'secure' ? 'bg-success/15 text-success border border-success/25' : 
                snapshot.coverageStatus === 'warning' ? 'bg-warning/15 text-warning border border-warning/25' : 
                'bg-error/15 text-error border border-error/25 animate-pulse'
              }`}>
                {snapshot.coverageStatus === 'secure' ? 'Secure Coverage (≥ 22D)' : 
                 snapshot.coverageStatus === 'warning' ? 'Warning Coverage (15D - 22D)' : 
                 'Critical stock Coverage (< 15D)'}
              </span>
            </div>
          </div>

          {/* ── DAILY SUMMARY SECTION ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
            
            {/* Widget 1: Stock Position */}
            <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Stock Position</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Inventory Sounding Dips
                </h3>
                
                <div className="space-y-4 mt-6">
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                    <span>Opening Inventory Stock:</span>
                    <span className="font-mono text-on-surface">{snapshot.openingStock.toLocaleString()} L</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                    <span>Physical sound Balance:</span>
                    <span className="font-mono text-on-surface">{snapshot.physicalBalance.toLocaleString()} L</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                    <span>Dead Stock calibration:</span>
                    <span className="font-mono text-on-surface-dim opacity-70">{snapshot.deadStock.toLocaleString()} L</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs font-black text-primary pt-2">
                    <span>Usable Fuel Available:</span>
                    <span className="font-mono text-xl">{snapshot.usableFuel.toLocaleString()} L</span>
                  </div>
                </div>
              </div>
              
              {/* Visual Usable Progress Bar */}
              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-[9px] font-black text-on-surface-dim uppercase">
                  <span>Dead Stock ({Math.round((snapshot.deadStock / snapshot.physicalBalance) * 100)}%)</span>
                  <span>Usable ({Math.round((snapshot.usableFuel / snapshot.physicalBalance) * 100)}%)</span>
                </div>
                <div className="h-2 w-full bg-surface-dim rounded-full overflow-hidden flex border border-outline/20">
                  <div className="h-full bg-on-surface-dim opacity-30" style={{ width: `${(snapshot.deadStock / snapshot.physicalBalance) * 100}%` }}></div>
                  <div className="h-full kinetic-gradient shadow-glow" style={{ width: `${(snapshot.usableFuel / snapshot.physicalBalance) * 100}%` }}></div>
                </div>
              </div>
            </div>

            {/* Widget 2: Sales Analysis */}
            <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Sales Analysis</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Daily Burn Rates
                </h3>
                
                <div className="space-y-5 mt-6">
                  <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Previous Day Sales</span>
                      <span className="text-base font-black text-on-surface font-mono">{snapshot.prevDaySales.toLocaleString()} L</span>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg text-primary text-[10px] font-black font-mono">
                      Day Sale
                    </div>
                  </div>

                  <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">7-Day Moving average</span>
                      <span className="text-base font-black text-on-surface font-mono">{snapshot.sevenDayAvgSales.toLocaleString()} L</span>
                    </div>
                    <div className="p-2 bg-success/10 rounded-lg text-success text-[10px] font-black font-mono">
                      7D average
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-outline/30 flex justify-between items-center">
                <span className="text-[10px] font-bold text-on-surface-dim uppercase">Comparison Variance:</span>
                <span className={`text-[10px] font-black flex items-center gap-1 ${
                  snapshot.prevDaySales > snapshot.sevenDayAvgSales ? 'text-primary' : 'text-success'
                }`}>
                  {snapshot.prevDaySales > snapshot.sevenDayAvgSales ? (
                    <>
                      <ArrowUpRight className="w-4 h-4" /> +{Math.round(((snapshot.prevDaySales - snapshot.sevenDayAvgSales) / snapshot.sevenDayAvgSales) * 100)}% vs Average
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4 rotate-90" /> -{Math.round(((snapshot.sevenDayAvgSales - snapshot.prevDaySales) / snapshot.sevenDayAvgSales) * 100)}% vs Average
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Widget 3: Availability Projections */}
            <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Availability Projections</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
                  <Compass className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Endurance Forecasting
                </h3>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl">
                    <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Stock Duration</span>
                    <span className="text-2xl font-[900] text-primary font-mono tracking-tighter block mt-1">{snapshot.daysRemaining} <span className="text-[10px] font-black not-italic uppercase opacity-55">Days</span></span>
                  </div>
                  <div className="bg-surface-dim/40 border border-outline p-4 rounded-xl">
                    <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50">Depletion Date</span>
                    <span className="text-sm font-black text-on-surface font-mono block mt-2 whitespace-nowrap">{snapshot.estimatedLastTill}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 opacity-70" />
                <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider leading-relaxed">
                  Depletion date reflects usable stocks only, based on current moving sales averages. Reorder point is 22 days.
                </p>
              </div>
            </div>

          </div>

          {/* ── SHIPMENT WINDOW ANALYSIS & MONTHLY PERFORMANCE OVERVIEW ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
            
            {/* Shipment Window Analysis Widget */}
            <div className="xl:col-span-2 card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Shipment Window Analysis</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
                  <Ship className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Tanker Discharge Interface Window
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  {/* Next Arrival */}
                  <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                    <div className="px-4 pt-4 pb-3">
                      <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Next Arrival Date</span>
                      <span className="text-sm font-black text-on-surface font-mono block leading-tight">{snapshot.nextShipmentArrival}</span>
                      <span className="text-[9px] font-bold text-primary block mt-1.5 uppercase tracking-wide">MT ALIMAS Vol. 18</span>
                    </div>
                  </div>
                  {/* Order Quantity */}
                  <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                    <div className="px-4 pt-4 pb-3">
                      <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Order Quantity</span>
                      <span className="text-base font-black text-on-surface font-mono block leading-tight">{snapshot.orderQtyMt.toLocaleString()} MT</span>
                      <span className="text-[9px] font-bold text-on-surface-dim opacity-60 block mt-1 font-mono">{(snapshot.orderQtyLiters / 1000000).toFixed(2)}M Liters</span>
                    </div>
                  </div>
                  {/* Arrival Window */}
                  <div className="bg-surface-dim/40 border border-outline rounded-xl overflow-hidden">
                    <div className="px-4 pt-4 pb-3">
                      <span className="text-[8px] font-black text-on-surface-dim uppercase tracking-wider block opacity-50 mb-2">Arrival Window</span>
                      <span className="text-base font-black text-on-surface font-mono block leading-tight">{snapshot.daysToShipment} Days</span>
                      <span className="text-[9px] font-bold text-on-surface-dim opacity-60 block mt-1 uppercase">Tanks ready for ullage</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-4 border rounded-xl flex items-center justify-between gap-4 text-xs font-bold
                ${safetyWindow >= 0 ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'}
              `}>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {safetyWindow >= 0 
                      ? `Safety Window Secure: Next tanker arrives ${safetyWindow} days before stock depletion.`
                      : `Safety Window Critical Alert: Depletion projected ${Math.abs(safetyWindow)} days before shipment arrival!`
                    }
                  </span>
                </div>
                <span className="font-mono text-sm font-black whitespace-nowrap">
                  {safetyWindow >= 0 ? `+${safetyWindow} Days` : `${safetyWindow} Days`}
                </span>
              </div>
            </div>

            {/* Monthly Performance Overview (MTD) */}
            <div className="card-premium p-6 lg:p-8 flex flex-col justify-between space-y-6">
              <div>
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Monthly Performance Overview</span>
                <h3 className="text-sm font-black uppercase text-on-surface mt-1 border-b border-outline/45 pb-3 flex items-center">
                  <Layers className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Month-to-Date (MTD) Summary
                </h3>

                <div className="space-y-4 mt-6">
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                    <span>Total Uplift Volume (L):</span>
                    <span className="font-mono text-on-surface font-black text-sm">{(mtdDetails.volume / 1000).toFixed(0)}K L</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-dim border-b border-outline/30 pb-2">
                    <span>Total Flights Served:</span>
                    <span className="font-mono text-on-surface font-black text-sm">{mtdDetails.flights} Flights</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-black text-success pt-1">
                    <span>YoY Variance (vs. Last Year):</span>
                    <span className="flex items-center font-mono gap-1 text-sm font-black">
                      <ArrowUpRight className="w-4 h-4" /> +{mtdDetails.variance}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-outline/30 flex justify-between items-center text-[9px] font-black uppercase text-on-surface-dim opacity-50 tracking-wider">
                <span>Billing Period: MTD Real-Time</span>
                <span>Aviation Sector</span>
              </div>
            </div>

          </div>

          {/* ── STOCK DAYS COVERAGE TREND GRAPH (30 DAYS) ── */}
          <div className="grid grid-cols-1 gap-6 lg:gap-10">
            <div className="card-premium p-6 lg:p-8">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-8 flex items-center">
                <Activity className="w-4 h-4 mr-3 text-primary opacity-60 animate-pulse" />
                Stock Coverage Days Remaining Trend Curve [Last 30-Day Snapshot Archive]
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="date" tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)', fontWeight: 900}} axisLine={false} tickLine={false} />
                    <YAxis label={{ value: 'Days Remaining', angle: -90, position: 'insideLeft', style: {fontSize: '9px', fill: 'var(--color-on-surface-dim)', fontWeight: 900} }} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-dim)', border: '1px solid var(--color-outline)', borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} iconType="circle" />
                    <Line type="monotone" dataKey="daysRemaining" name="Stock Days Remaining" stroke="var(--color-primary)" strokeWidth={3.5} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in duration-300">
          {/* ── SHIPMENT FORECAST STRATEGY BOARD ── */}
          <div className="card-premium p-6 lg:p-8 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-outline/30 pb-6">
              <div>
                <h3 className="text-sm font-black uppercase text-on-surface flex items-center">
                  <Ship className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Shipment Forecast Strategy Board
                </h3>
                <p className="text-[10px] font-bold text-on-surface-dim opacity-60 mt-1.5 uppercase tracking-wider">
                  Operational Window: Summer 2026 • Max Capacity: {maxCapacity.toLocaleString()} L ({nffTanks.length || 3} Tanks at NFF)
                </p>
              </div>
              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-surface-dim/40 border border-outline/50 p-4 rounded-2xl w-full sm:w-auto">
                {/* Current Date Control */}
                <div className="flex flex-col items-center space-y-1.5 text-center w-full sm:w-auto">
                  <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Forecast Base Date</label>
                  <div className="relative flex items-center bg-surface-lowest border border-outline rounded-xl focus-within:ring-1 focus-within:ring-primary transition-all w-full max-w-[180px]">
                    <input 
                      type="date" 
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                      onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                      className="bg-transparent text-[11px] font-black uppercase text-on-surface outline-none cursor-pointer w-full pl-9 pr-3 py-2 text-center"
                    />
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary opacity-50 pointer-events-none" />
                  </div>
                </div>
                
                {/* Initial Stock Control */}
                <div className="flex flex-col items-center space-y-1.5 text-center w-full sm:w-auto">
                  <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Starting Inventory [L]</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={activeInitialStock.toLocaleString()}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                      const num = clean === '' ? 0 : parseInt(clean, 10);
                      setInitialStock(num);
                    }}
                    className="bg-surface-lowest border border-outline px-3.5 py-2 rounded-xl text-[11px] font-mono text-on-surface font-black focus:ring-1 focus:ring-primary outline-none w-full max-w-[180px] text-center"
                  />
                </div>

                {/* Add / Remove Delivery Controls */}
                <div className="flex items-center justify-center gap-2 pt-2 sm:pt-4 w-full sm:w-auto">
                  <button 
                    onClick={handleAddShipment}
                    className="btn-add-delivery px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 h-[38px] shadow-premium border-none"
                  >
                    <Plus className="w-4 h-4" /> Add Delivery
                  </button>
                  {shipments.length > 5 && (
                    <button 
                      onClick={handleRemoveShipment}
                      className="bg-error/15 text-error border border-error/25 hover:bg-gradient-to-br hover:from-[#ef4444] hover:to-[#b91c1c] hover:text-white hover:border-transparent px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 h-[38px]"
                    >
                      <Trash2 className="w-4 h-4" /> Remove Last
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Horizontal Scroll Table wrapper */}
            <div className="overflow-x-auto custom-scrollbar border border-outline rounded-2xl bg-surface-dim/20 shadow-inner">
              <table className="w-full border-collapse text-left text-xs table-fixed min-w-[1000px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-surface border-r border-b border-outline px-2 sm:px-5 py-4 font-black uppercase text-on-surface tracking-wider w-14 sm:w-64 z-20 text-center sm:text-left">
                      <span className="hidden sm:inline">Parameter</span>
                      <span className="inline sm:hidden flex justify-center"><Sliders className="w-4 h-4 text-primary" /></span>
                    </th>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <th 
                          key={s.id} 
                          className={`px-4 py-4 text-center font-bold border-b border-outline w-48 transition-colors duration-300 z-10 ${
                            s.isCancelled
                              ? 'bg-error/5 text-on-surface-dim opacity-70'
                              : s.isConfirmed ? 'bg-primary/10 text-primary' : 'bg-surface-lowest'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider">{s.shipmentNumber}</span>
                            <button
                              onClick={() => {
                                if (s.isCancelled) {
                                  handleUpdateShipment(originalIdx, { isConfirmed: false, isCancelled: false });
                                } else if (s.isConfirmed) {
                                  handleUpdateShipment(originalIdx, { isConfirmed: false, isCancelled: true });
                                } else {
                                  handleUpdateShipment(originalIdx, { isConfirmed: true, isCancelled: false });
                                }
                              }}
                              className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                                s.isCancelled
                                  ? 'bg-error/20 text-error border border-error/30 hover:bg-error hover:text-white'
                                  : s.isConfirmed 
                                    ? 'bg-success/20 text-success border border-success/30 hover:bg-success hover:text-white' 
                                    : 'bg-warning/20 text-warning border border-warning/30 hover:bg-warning hover:text-white'
                              }`}
                            >
                              {s.isCancelled ? '✗ Cancelled' : s.isConfirmed ? '✓ Confirmed' : '⚡ Forecast'}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Vessel Name */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Ship className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Vessel Name</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Vessel Name
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <td key={s.id} className={`px-3 py-1 text-center ${
                          s.isCancelled ? 'bg-error/5 opacity-70' : s.isConfirmed ? 'bg-primary/5' : ''
                        }`}>
                          <input 
                            type="text" 
                            value={s.vessel}
                            onChange={(e) => handleUpdateShipment(originalIdx, { vessel: e.target.value })}
                            className={`bg-transparent border border-transparent hover:border-outline/50 focus:border-primary focus:bg-surface-lowest outline-none rounded-lg px-2.5 py-1.5 text-xs font-black text-center w-full transition-all ${
                              s.isCancelled ? 'text-on-surface-dim/40 line-through' : 'text-on-surface'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Date of Arrival */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Calendar className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Date of Arrival</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Date of Arrival
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <td key={s.id} className={`px-3 py-1 text-center ${
                          s.isCancelled ? 'bg-error/5 opacity-70' : s.isConfirmed ? 'bg-primary/5' : ''
                        }`}>
                          <input 
                            type="date" 
                            value={s.arrivalDate}
                            onChange={(e) => handleUpdateShipment(originalIdx, { arrivalDate: e.target.value })}
                            onClick={(e) => {
                              e.stopPropagation();
                              try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {}
                            }}
                            className={`bg-transparent border border-transparent hover:border-outline/50 focus:border-primary focus:bg-surface-lowest outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-center w-full transition-all cursor-pointer font-black ${
                              s.isCancelled ? 'text-on-surface-dim/40' : 'text-on-surface'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Days Until/Between Arrival */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Clock className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Days until / between arrival</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Days until / between arrival
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-black ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : 'text-on-surface'
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.daysBetween} Days
                      </td>
                    ))}
                  </tr>

                  {/* Opening Stock */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Database className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Opening Stock [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Opening Stock [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-bold ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : 'text-on-surface-dim'
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.openingStock.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Order Quantity [MT] */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Layers className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Order Quantity [MT]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Order Quantity [MT]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <td key={s.id} className={`px-3 py-1 text-center ${
                          s.isCancelled ? 'bg-error/5 opacity-70' : s.isConfirmed ? 'bg-primary/5' : ''
                        }`}>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            value={s.orderQtyMt.toLocaleString()}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                              const num = clean === '' ? 0 : parseInt(clean, 10);
                              handleUpdateShipment(originalIdx, { orderQtyMt: num });
                            }}
                            className={`bg-transparent border border-transparent hover:border-outline/50 focus:border-primary focus:bg-surface-lowest outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-center w-full transition-all font-black ${
                              s.isCancelled ? 'text-on-surface-dim/40 line-through' : s.isConfirmed ? 'text-success' : 'text-warning'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Order Quantity [L] */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Layers className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Order Quantity [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Order Quantity [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-black ${
                        s.isCancelled 
                          ? 'text-on-surface-dim/40 line-through bg-error/5 opacity-70' 
                          : s.isConfirmed 
                            ? 'text-success bg-primary/5' 
                            : 'text-warning'
                      }`}>
                        {s.orderQtyLiters.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Total Estimated Sales */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <TrendingUp className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Total Estimated Sales [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Total Estimated Sales [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-bold ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : 'text-on-surface-dim'
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.estimatedSales.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Available Ullage */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Info className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Available Ullage at arrival [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Available Ullage at arrival [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-bold ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : 'text-on-surface-dim'
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.availableUllageAtArrival.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Closing Stock */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Database className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Closing Stock [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Closing Stock [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-black text-on-surface ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : ''
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.closingStock.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Remaining Ullage after receipt */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Info className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Remaining Ullage after receipt [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Remaining Ullage after receipt [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const isOverfill = s.remainingUllageAfterReceipt < 0;
                      return (
                        <td 
                          key={s.id} 
                          className={`px-4 py-3 text-center font-mono ${
                            isOverfill 
                              ? 'text-error font-black bg-error/10 animate-pulse' 
                              : s.isCancelled 
                                ? 'text-on-surface-dim/45 font-bold bg-error/5 opacity-70' 
                                : 'text-on-surface-dim font-bold'
                          } ${s.isConfirmed && !s.isCancelled && !isOverfill ? 'bg-primary/5' : ''}`}
                        >
                          {isOverfill ? (
                            <span className="flex flex-col items-center">
                              <span>OVERFILL RISK!</span>
                              <span className="text-[10px] font-black">-{Math.abs(s.remainingUllageAfterReceipt).toLocaleString()}</span>
                            </span>
                          ) : (
                            s.remainingUllageAfterReceipt.toLocaleString()
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Dead Stock */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <ShieldCheck className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Dead Stock [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Dead Stock [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <td key={s.id} className={`px-3 py-1 text-center ${
                          s.isCancelled ? 'bg-error/5 opacity-70' : s.isConfirmed ? 'bg-primary/5' : ''
                        }`}>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            value={s.deadStock.toLocaleString()}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                              const num = clean === '' ? 0 : parseInt(clean, 10);
                              handleUpdateShipment(originalIdx, { deadStock: num });
                            }}
                            className={`bg-transparent border border-transparent hover:border-outline/50 focus:border-primary focus:bg-surface-lowest outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-center w-full transition-all font-black ${
                              s.isCancelled ? 'text-error/40 line-through' : 'text-error'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Stock Available at arrival */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Database className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Stock available at arrival [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Stock available at arrival [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => (
                      <td key={s.id} className={`px-4 py-3 text-center font-mono font-bold ${
                        s.isCancelled ? 'bg-error/5 text-on-surface-dim/40 opacity-70' : 'text-on-surface-dim'
                      } ${s.isConfirmed && !s.isCancelled ? 'bg-primary/5' : ''}`}>
                        {s.stockAvailableAtVesselArrival.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Average Daily Sales */}
                  <tr className="hover:bg-surface-dim/20 transition-colors border-b border-outline/30">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <TrendingUp className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Average Daily Sales [L]</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Average Daily Sales [L]
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const originalIdx = shipments.findIndex(item => item.id === s.id);
                      return (
                        <td key={s.id} className={`px-3 py-1 text-center ${
                          s.isCancelled ? 'bg-error/5 opacity-70' : s.isConfirmed ? 'bg-primary/5' : ''
                        }`}>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            value={s.averageSales.toLocaleString()}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                              const num = clean === '' ? 0 : parseInt(clean, 10);
                              handleUpdateShipment(originalIdx, { averageSales: num });
                            }}
                            className={`bg-transparent border border-transparent hover:border-outline/50 focus:border-primary focus:bg-surface-lowest outline-none rounded-lg px-2.5 py-1.5 text-xs font-mono text-center text-on-surface w-full transition-all font-black ${
                              s.isCancelled ? 'text-on-surface-dim/40' : 'text-on-surface'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>

                  {/* Stock days at arrival */}
                  <tr className="hover:bg-surface-dim/20 transition-colors">
                    <td className="sticky left-0 bg-surface border-r border-outline px-2 sm:px-5 py-1 font-bold text-on-surface-dim z-10 w-14 sm:w-64 group cursor-pointer focus:outline-none" tabIndex={0}>
                      <div className="flex items-center justify-center sm:justify-start h-12">
                        <Clock className="w-3.5 h-3.5 sm:mr-2.5 text-primary opacity-50 shrink-0" />
                        <span className="hidden sm:inline">Stock days at arrival</span>
                        <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 sm:hidden">
                          Stock days at arrival
                        </div>
                      </div>
                    </td>
                    {visibleShipments.map((s) => {
                      const isRedAlert = s.stockDaysAtArrival < 22;
                      return (
                        <td 
                          key={s.id} 
                          className={`px-4 py-3 text-center font-mono font-black ${
                            isRedAlert 
                              ? 'text-error bg-error/15 text-sm animate-pulse' 
                              : s.isCancelled 
                                ? 'text-success/50 bg-error/5 opacity-70' 
                                : 'text-success bg-success/5'
                          } ${s.isConfirmed && !s.isCancelled && !isRedAlert ? 'bg-primary/5' : ''}`}
                        >
                          {isRedAlert ? (
                            <span className="flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0 animate-bounce" />
                              <span>{Math.round(s.stockDaysAtArrival)} Days</span>
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
                              <span>{Math.round(s.stockDaysAtArrival)} Days</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Forecast Visual Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 mt-10">
            {/* Chart 1: Stock Levels */}
            <div className="card-premium p-6 lg:p-8">
              <h4 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center">
                <Activity className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Closing Inventory vs Capacity
              </h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visibleShipments} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="shipmentNumber" tick={renderCustomTick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Bar dataKey="closingStock" name="Closing Stock" stackId="a" fill="var(--color-primary)" radius={[0, 0, 0, 0]}>
                      {visibleShipments.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isCancelled ? '#4b5563' : entry.remainingUllageAfterReceipt < 0 ? '#ef4444' : 'var(--color-primary)'} 
                          opacity={entry.isCancelled ? 0.4 : 1}
                        />
                      ))}
                    </Bar>
                    <Bar dataKey="remainingUllageDisplay" name="Available Ullage" stackId="a" fill="var(--color-surface-container-highest)" stroke="var(--color-outline)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Days Coverage */}
            <div className="card-premium p-6 lg:p-8">
              <h4 className="text-xs font-black text-on-surface uppercase tracking-[0.2em] mb-6 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2.5 text-primary opacity-60" /> Coverage Days at Vessel Arrival
              </h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visibleShipments} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
                    <XAxis dataKey="shipmentNumber" tick={renderCustomTick} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{fontSize: 9, fill: 'var(--color-on-surface-dim)'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      formatter={(value: any) => [`${Math.round(value)} Days`, 'Stock Coverage']}
                      contentStyle={{ backgroundColor: 'var(--color-surface-dim)', border: '1px solid var(--color-outline)', borderRadius: '12px' }} 
                    />
                    <Line type="monotone" dataKey="stockDaysAtArrival" name="Stock Days" stroke="var(--color-primary)" strokeWidth={3} activeDot={{ r: 6 }} dot={(props) => {
                      const { cx, cy, payload } = props;
                      const isAlert = payload.stockDaysAtArrival < 22;
                      return (
                        <circle key={`dot-${payload.id}`} cx={cx} cy={cy} r={isAlert ? 6 : 4} fill={isAlert ? '#ef4444' : 'var(--color-success)'} stroke="white" strokeWidth={1.5} />
                      );
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
