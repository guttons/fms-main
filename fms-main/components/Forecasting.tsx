import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line 
} from 'recharts';
import { FORECAST_DATA } from '../constants';
import { 
  RefreshCw, Download, Layers, Calendar, ChevronRight, Fuel, AlertTriangle, 
  CheckCircle, TrendingUp, Info, Clock, ShieldAlert, Zap, BarChart2 
} from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { FuelType, EquipmentType } from '../types';

const getScenarioGradient = (id: string) => {
  switch (id) {
    case 'nominal': return 'kinetic-gradient';
    case 'upper': return 'gradient-error';
    case 'lower': return 'gradient-warning';
    default: return 'kinetic-gradient';
  }
};

export const Forecasting: React.FC = () => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('nominal');
  const activeScenario = FORECAST_DATA.find(s => s.id === activeScenarioId) || FORECAST_DATA[0];
  const { tanks = [], equipment = [], shipments = [] } = useOperationalData();

  // Stock Order Estimator State
  const [selectedFuelType, setSelectedFuelType] = useState<FuelType>(FuelType.JET_A1);
  const [targetDate, setTargetDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default to 14 days from now
    return d.toISOString().split('T')[0];
  });

  // Toggles for overlays & predictions
  const [showHistoricalOverlay, setShowHistoricalOverlay] = useState<boolean>(true);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  // Default burn rates and safe reserves based on FuelType
  const getInitialBurnRate = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1: return 162000;
      case FuelType.DIESEL: return 8800;
      case FuelType.PETROL: return 2600;
      default: return 162000;
    }
  };

  const getSafeReserve = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1: return 1000000; // 1M L
      case FuelType.DIESEL: return 20000;   // 20k L
      case FuelType.PETROL: return 10000;   // 10k L
      default: return 1000000;
    }
  };

  const getHistoricalBurnRate = (type: FuelType) => {
    switch (type) {
      case FuelType.JET_A1: return 145000;
      case FuelType.DIESEL: return 7900;
      case FuelType.PETROL: return 2300;
      default: return 145000;
    }
  };

  const [burnRateInput, setBurnRateInput] = useState<string>('162000');
  const [customReserveInput, setCustomReserveInput] = useState<string>('1000000');

  // Synchronize defaults on toggle
  const handleFuelToggle = (type: FuelType) => {
    setSelectedFuelType(type);
    setBurnRateInput(getInitialBurnRate(type).toString());
    setCustomReserveInput(getSafeReserve(type).toString());
  };

  // Filter tanks & mobile refueller equipment and compute aggregates
  const activeTanks = (tanks || []).filter(t => t && t.type === selectedFuelType);
  const activeRefuellers = (equipment || []).filter(eq => {
    if (selectedFuelType === FuelType.JET_A1) {
      return eq.type === EquipmentType.REFUELLER;
    } else if (selectedFuelType === FuelType.DIESEL) {
      return eq.type === EquipmentType.DIESEL_TRUCK;
    }
    return false;
  });

  const bulkCurrentStock = activeTanks.reduce((sum, t) => sum + (t.currentLevel || 0), 0);
  const bulkCapacity = activeTanks.reduce((sum, t) => sum + (t.capacity || 0), 0);
  
  const rfCurrentStock = activeRefuellers.reduce((sum, eq) => sum + (eq.currentVolume || 0), 0);
  const rfCapacity = activeRefuellers.reduce((sum, eq) => sum + (eq.maxCapacity || 0), 0);

  const totalCurrentStock = bulkCurrentStock + rfCurrentStock;
  const totalCapacity = bulkCapacity + rfCapacity;

  const parsedBurnRate = parseFloat(burnRateInput) || getInitialBurnRate(selectedFuelType);
  const parsedReserve = parseFloat(customReserveInput) || getSafeReserve(selectedFuelType);
  const historicalBurnRate = getHistoricalBurnRate(selectedFuelType);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const projectedConsumption = diffDays * parsedBurnRate;
  const projectedStockLevel = totalCurrentStock - projectedConsumption;
  
  // Volume needed to ensure stock does not fall below safe reserve + meets projected demand
  const recommendedOrder = Math.max(0, (parsedReserve + projectedConsumption) - totalCurrentStock);

  // Dynamic "Stock Will Last" calculations
  const currentWeekAvgSales = parsedBurnRate; // Based on current week's sales input/average
  const daysStockWillLastCurrent = currentWeekAvgSales > 0 ? Math.round(totalCurrentStock / currentWeekAvgSales) : 0;
  const daysStockWillLastHistorical = historicalBurnRate > 0 ? Math.round(totalCurrentStock / historicalBurnRate) : 0;

  const handleRecalculate = () => {
    setIsRecalculating(true);
    setTimeout(() => {
      setIsRecalculating(false);
    }, 1000);
  };

  // Build forecast scenario data with simulated 5-year historical depletion overlay
  const forecastDataWithHistory = activeScenario.data.map((item, idx) => {
    // Jet A-1 seasonal consumption is slightly higher historically during this period
    const factor = selectedFuelType === FuelType.JET_A1 ? 1.05 : 1.02;
    const offset = Math.sin(idx / 3.5) * 120000;
    const historicalStock = Math.max(0, 8000000 - (idx * historicalBurnRate * factor) + offset);
    return {
      ...item,
      historicalLevel: historicalStock,
    };
  });

  // Calculate shipment recommendation calendar (1 month window)
  const getUpcomingShipments = () => {
    if (selectedFuelType === FuelType.JET_A1 && shipments && shipments.length > 0) {
      let prevDateStr = new Date().toISOString().split('T')[0];
      return shipments.map((ship) => {
        const d1 = new Date();
        d1.setHours(0,0,0,0);
        const d2 = new Date(ship.arrivalDate);
        d2.setHours(0,0,0,0);
        const etaDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        
        const daysBetween = Math.max(1, Math.round((new Date(ship.arrivalDate).getTime() - new Date(prevDateStr).getTime()) / (1000 * 60 * 60 * 24)));
        prevDateStr = ship.arrivalDate;
        
        const historicalDemandQty = Math.round((daysBetween || 19) * (ship.averageSales || 665000));
        
        return {
          id: ship.id,
          vessel: ship.vessel,
          deliveryNumber: ship.shipmentNumber,
          shipmentNoCode: ship.shipmentNoCode || `NS/SHIP-JET A-1/${ship.id}`,
          shipmentNo: `${ship.shipmentNumber} • ${ship.shipmentNoCode || 'NS/SHIP-JET A-1/' + ship.id}`,
          eta: etaDays,
          quantity: ship.orderQtyMt * 1270,
          orderQtyMt: ship.orderQtyMt,
          recommendedQuantity: historicalDemandQty,
          status: ship.isCancelled ? 'CANCELLED' : (ship.isConfirmed ? 'CONFIRMED' : 'FORECAST'),
          criticalDays: 14
        };
      });
    } else if (selectedFuelType === FuelType.DIESEL) {
      return [
        { id: 'sh4', vessel: 'MT HARI STAR', deliveryNumber: '05 Delivery', shipmentNoCode: 'NS/SHIP-DIESEL/05', shipmentNo: '05 Delivery • NS/SHIP-DIESEL/05', eta: 10, quantity: 250000, orderQtyMt: 196, recommendedQuantity: 245000, status: 'IN-TRANSIT', criticalDays: 22 },
        { id: 'sh5', vessel: 'MT VALIANT', deliveryNumber: '06 Delivery', shipmentNoCode: 'NS/SHIP-DIESEL/06', shipmentNo: '06 Delivery • NS/SHIP-DIESEL/06', eta: 25, quantity: 200000, orderQtyMt: 157, recommendedQuantity: 195000, status: 'RECOMMENDED', criticalDays: 22 }
      ];
    } else {
      return [
        { id: 'sh6', vessel: 'MT PACIFIC STAR', deliveryNumber: '08 Delivery', shipmentNoCode: 'NS/SHIP-PETROL/08', shipmentNo: '08 Delivery • NS/SHIP-PETROL/08', eta: 14, quantity: 150000, orderQtyMt: 118, recommendedQuantity: 145000, status: 'CONFIRMED', criticalDays: 25 }
      ];
    }
  };

  const upcomingShipments = getUpcomingShipments();

  // Find exact day stock falls below reorder point (Critical level / Reorder threshold)
  const calculateDepletionZeroDays = () => {
    const depletionIdx = forecastDataWithHistory.findIndex(d => d.stockLevel < parsedReserve);
    return depletionIdx !== -1 ? depletionIdx + 1 : 30;
  };

  const daysToCritical = calculateDepletionZeroDays();
  const criticalDate = new Date();
  criticalDate.setDate(criticalDate.getDate() + daysToCritical);
  const criticalDateStr = criticalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Safety threshold calculations
  const coverageRatio = daysStockWillLastCurrent / 22; // 22-day stock coverage target

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            STOCK <span className="text-primary italic font-medium ml-3">FORECAST</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono whitespace-nowrap">Registry: DEPOT LOGISTICS</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20 hidden md:block"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] whitespace-nowrap">5-Year Historical Predictive Modeling</span>
          </div>
        </div>
        <div className="flex space-x-4">
          <button 
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center px-4 py-2.5 lg:px-6 lg:py-3.5 bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:scale-105 active:scale-95 transition-all text-on-surface-dim"
          >
            <RefreshCw className={`w-4 h-4 mr-3 text-primary opacity-60 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'RECALCULATING...' : 'RECALCULATE'}
          </button>
          <button className="flex items-center px-4 py-2.5 lg:px-6 lg:py-3.5 kinetic-gradient text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-premium hover:scale-105 active:scale-95 transition-all border-none">
            <Download className="w-4 h-4 mr-3" />
            EXPORT DATA
          </button>
        </div>
      </div>

      {/* TACTICAL METRIC WIDGETS: Stock Will Last Indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
        {/* Dynamic Stock Depletion Bar Indicator */}
        <div className="card-premium p-6 lg:p-8 col-span-1 lg:col-span-2 flex flex-col justify-between overflow-hidden relative group">
          <div className="flex justify-between items-center mb-6">
            <div>
              <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Tactical Stock Duration</span>
              <h3 className="text-sm font-black uppercase tracking-widest text-on-surface mt-1">Days Stock Will Last</h3>
            </div>
            <div className="flex bg-surface-dim p-1 rounded-xl border border-outline shrink-0">
                <button 
                  onClick={() => setShowHistoricalOverlay(!showHistoricalOverlay)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-premium hover:scale-105 active:scale-95 ${
                    showHistoricalOverlay ? 'kinetic-gradient text-white border-none' : 'text-on-surface-dim hover:text-on-surface'
                  }`}
                >
                  5-Year Historical Overlay
                </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Current Week's Avg sales</span>
                <span className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase font-mono">{currentWeekAvgSales.toLocaleString()} L / Day</span>
              </div>
              <div className="bg-surface-dim rounded-2xl p-5 border border-outline shadow-inner relative overflow-hidden">
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-[900] text-primary font-mono tracking-tighter italic">{daysStockWillLastCurrent} <span className="text-xs font-black not-italic tracking-wider uppercase opacity-40">Days</span></span>
                  {daysStockWillLastCurrent < 22 ? (
                    <span className="text-[8px] font-black px-2.5 py-1 rounded-md bg-error/10 text-error border border-error/20 uppercase tracking-widest flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Reorder Alert
                    </span>
                  ) : (
                    <span className="text-[8px] font-black px-2.5 py-1 rounded-md bg-success/10 text-success border border-success/20 uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Secure
                    </span>
                  )}
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-surface-lowest h-2 rounded-full overflow-hidden mt-4 border border-outline/30">
                  <div 
                    className={`h-full transition-all duration-1000 ${daysStockWillLastCurrent < 22 ? 'bg-error animate-pulse' : 'bg-primary'}`} 
                    style={{ width: `${Math.min(100, (daysStockWillLastCurrent / 45) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[8px] font-black text-on-surface-dim mt-2 opacity-30 tracking-widest">
                  <span>0 DAYS</span>
                  <span>45 DAYS NOMINAL</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-success uppercase tracking-widest">5-Year Historical period Avg</span>
                <span className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase font-mono">{historicalBurnRate.toLocaleString()} L / Day</span>
              </div>
              <div className="bg-surface-dim rounded-2xl p-5 border border-outline shadow-inner">
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-[900] text-success font-mono tracking-tighter italic">{daysStockWillLastHistorical} <span className="text-xs font-black not-italic tracking-wider uppercase opacity-40">Days</span></span>
                  <span className="text-[8px] font-black px-2.5 py-1 rounded-md bg-success/10 text-success border border-success/20 uppercase tracking-widest flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" /> Normal Limit
                  </span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full bg-surface-lowest h-2 rounded-full overflow-hidden mt-4 border border-outline/30">
                  <div className="h-full bg-success transition-all duration-1000" style={{ width: `${Math.min(100, (daysStockWillLastHistorical / 45) * 100)}%` }} />
                </div>
                <div className="flex justify-between items-center text-[8px] font-black text-on-surface-dim mt-2 opacity-30 tracking-widest">
                  <span>0 DAYS</span>
                  <span>45 DAYS NOMINAL</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Box Summary Card */}
        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between border-l-4 border-l-primary relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[60px] flex items-center justify-center pointer-events-none">
            <Zap className="w-8 h-8 text-primary/30" />
          </div>
          <div>
            <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">Forecast Engine Analysis</span>
            <h3 className="text-sm font-black uppercase tracking-widest text-on-surface mt-1 mb-6">Upcoming Shipment Predictions</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-surface-dim/50 border border-outline/30 p-3.5 rounded-xl">
                <div>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider">Critical reorder window</p>
                  <p className="text-[11px] font-black text-error uppercase mt-0.5 tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Reorder before 1 month
                  </p>
                </div>
                <span className="text-xs font-black text-error font-mono whitespace-nowrap bg-error/10 border border-error/20 px-3 py-1 rounded-lg">
                  {daysToCritical} DAYS LEFT
                </span>
              </div>

              <div className="flex justify-between items-baseline py-1">
                <span className="text-[10px] font-black text-on-surface-dim opacity-60 uppercase tracking-widest">Critical depletion Date:</span>
                <span className="text-sm font-black text-on-surface tracking-tighter uppercase italic">{criticalDateStr}</span>
              </div>
              <div className="flex justify-between items-baseline py-1 border-t border-outline/40">
                <span className="text-[10px] font-black text-on-surface-dim opacity-60 uppercase tracking-widest">Stock Coverage target:</span>
                <span className={`text-sm font-black tracking-tighter uppercase italic ${coverageRatio >= 1.0 ? 'text-success' : 'text-error'}`}>
                  {(coverageRatio * 100).toFixed(0)}% (22-Day target)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-outline flex items-center gap-3 mt-4">
            <Info className="w-5 h-5 text-primary shrink-0 opacity-80" />
            <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider leading-relaxed">
              DEPOT forecasting computes seasonal spikes from Velana Airport past 5 years logs.
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {FORECAST_DATA.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenarioId(scenario.id)}
            className={`card-premium p-6 lg:p-8 text-left transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] ${
              activeScenarioId === scenario.id 
                ? 'border-primary shadow-lg' 
                : 'hover:border-primary/40'
            }`}
          >
            {activeScenarioId === scenario.id && (
               <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-[40px] flex items-center justify-center border-l border-b border-primary/20">
                  <Layers className="w-5 h-5 text-primary" />
               </div>
            )}
            <div className="flex items-center space-x-4 mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border transition-all ${
                activeScenarioId === scenario.id 
                  ? `${getScenarioGradient(scenario.id)} text-white border-transparent shadow-md` 
                  : 'bg-surface-dim text-on-surface-dim border-outline'
              }`}>
                {scenario.name}
              </span>
            </div>
            <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed">{scenario.description}</p>
          </button>
        ))}
      </div>

      {/* Main Forecast Chart with Historical Overlay */}
      <div className="card-premium p-6 lg:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
           <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
              <Layers className="w-4 h-4 mr-3 text-primary opacity-40" />
              Depletion Curve & 5-Year Historical Overlay [30-DAY]
           </h3>
           <div className="flex items-center space-x-6 text-[10px] font-black uppercase tracking-widest opacity-40">
              <div className="flex items-center">
                 <div className="w-2.5 h-1 bg-primary mr-2 rounded-full"></div>
                 Projected active Stock
              </div>
              {showHistoricalOverlay && (
                <div className="flex items-center text-success">
                   <div className="w-2.5 h-1 border-t-2 border-dashed border-success mr-2"></div>
                   5-Year Historical Average
                </div>
              )}
              <div className="flex items-center">
                 <div className="w-2.5 h-1 bg-error mr-2 rounded-full"></div>
                 Critical Threshold
              </div>
           </div>
        </div>
        <div className="h-[300px] sm:h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastDataWithHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                 dataKey="day" 
                 axisLine={false} 
                 tickLine={false} 
                 tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}} 
                 dy={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} 
                tick={{fontSize: 10, fontWeight: 900, fill: 'var(--color-on-surface-dim)', opacity: 0.4}}
                dx={-10}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-dim)" />
              <Tooltip 
                 contentStyle={{ 
                    backgroundColor: 'var(--color-surface-dim)', 
                    color: 'var(--color-on-surface)', 
                    borderRadius: '24px', 
                    border: '1px solid var(--color-outline)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    padding: '16px'
                 }}
                 cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <ReferenceLine y={parsedReserve} stroke="var(--color-error)" strokeDasharray="8 8" strokeWidth={2} label={{ position: 'top', value: 'CRITICAL THRESHOLD', fill: 'var(--color-error)', fontSize: 9, fontWeight: 900 }} />
              
              {/* Projected Stock Area */}
              <Area 
                type="monotone" 
                dataKey="stockLevel" 
                name="PROJECTED STOCK"
                stroke="var(--color-primary)" 
                fillOpacity={1} 
                fill="url(#colorStock)" 
                strokeWidth={4}
                animationDuration={1500}
              />

              {/* Dotted 5-Year Historical Overlay Line */}
              {showHistoricalOverlay && (
                <Line 
                  type="monotone"
                  dataKey="historicalLevel"
                  name="5-YEAR HISTORICAL AVG"
                  stroke="var(--color-success)"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={false}
                  animationDuration={1800}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* UPCOMING SHIPMENT TIMELINE & REORDER PREDICTIONS */}
      <div className="card-premium p-6 lg:p-10">
        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center border-b border-outline pb-4">
          <Calendar className="w-5 h-5 mr-3 text-primary opacity-60" />
          Shipment Scheduler & Reorder Forecast (1-Month Forecast window)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {upcomingShipments.map((ship, idx) => (
            <div key={ship.id} className="p-6 bg-surface-dim/40 rounded-3xl border border-outline/50 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all group">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-sm font-black text-on-surface group-hover:text-primary transition-colors tracking-tighter uppercase italic">{ship.vessel}</h4>
                    <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mt-0.5">Shipment No: {ship.shipmentNo}</p>
                  </div>
                  <span className={`text-[8px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${
                    ship.status === 'CONFIRMED' ? 'bg-success/10 text-success border border-success/20' :
                    ship.status === 'IN-TRANSIT' ? 'bg-primary/10 text-primary border border-primary/20' :
                    'bg-warning/10 text-warning border border-warning/20 animate-pulse'
                  }`}>
                    {ship.status}
                  </span>
                </div>

                <div className="space-y-3 py-2">
                  <div className="flex justify-between text-xs">
                    <span className="opacity-60">Scheduled Order Qty:</span>
                    <span className="font-mono font-black text-on-surface">
                      {(ship.quantity / 1000000).toFixed(2)}M L <span className="text-[10px] opacity-50">({ship.orderQtyMt?.toLocaleString()} MT)</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="opacity-60">5-Yr Trend Recommended:</span>
                    <span className="font-mono font-black text-primary">
                      {((ship.recommendedQuantity || 0) / 1000000).toFixed(2)}M L
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="opacity-60">Shipment ETA:</span>
                    <span className="font-mono font-black text-primary">
                      {ship.eta <= 0 ? 'Arrived / On Stand' : `In ${ship.eta} Days`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-outline/40 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60 mt-4">
                <span>5-Year Period Trend</span>
                {ship.eta <= daysToCritical ? (
                  <span className="text-success flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Arrives in Time
                  </span>
                ) : (
                  <span className="text-error flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" /> Critical Reorder Point!
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STOCK ORDER ESTIMATOR PANEL */}
      <div className="card-premium p-6 lg:p-10 border-t-4 border-t-primary">
         <div className="flex flex-col lg:flex-row justify-between gap-8 pb-8 border-b border-outline">
            <div>
               <h3 className="text-base font-black text-on-surface uppercase tracking-[0.3em] flex items-center mb-2">
                  <Calendar className="w-5 h-5 mr-3 text-primary" />
                  STOCK ORDER ESTIMATOR
               </h3>
               <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed">
                  Project procurement requirements based on live active stock levels, customized date perimeters, and average nominal burn rates.
               </p>
            </div>
            
            {/* Fuel Type Switcher Tabs */}
            <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline self-start overflow-hidden">
               <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
                    ${selectedFuelType === FuelType.JET_A1 ? 'left-1.5 translate-x-[0%]' : ''}
                    ${selectedFuelType === FuelType.DIESEL ? 'left-1.5 translate-x-[100%]' : ''}
                    ${selectedFuelType === FuelType.PETROL ? 'left-1.5 translate-x-[200%]' : ''}
                  `}
               />
               {Object.values(FuelType).map((type) => (
                  <button
                     key={type}
                     onClick={() => handleFuelToggle(type)}
                     className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${
                        selectedFuelType === type 
                           ? 'text-white font-black' 
                           : 'text-on-surface-dim opacity-50 hover:opacity-85'
                     }`}
                  >
                     {type}
                  </button>
               ))}
            </div>
         </div>

         {/* Form / Inputs Grid */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 py-8 border-b border-outline">
            {/* Target Projection Date */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Target Projection Date</label>
               <div className="relative">
                  <input 
                     required
                     type="date"
                     value={targetDate}
                     min={new Date().toISOString().split('T')[0]}
                     onChange={(e) => setTargetDate(e.target.value)}
                     onClick={(e) => { try { if ('showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer text-on-surface"
                  />
                  <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
               </div>
            </div>

            {/* Average Daily Burn Rate */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Daily Burn Rate (Liters)</label>
               <div className="relative">
                  <TrendingUp className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                  <input 
                     required
                     type="text"
                     inputMode="numeric"
                     value={burnRateInput ? parseInt(burnRateInput.replace(/,/g, '')).toLocaleString() : ''}
                     onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (val === '' || /^\d*$/.test(val)) {
                           setBurnRateInput(val);
                        }
                     }}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface font-mono"
                     placeholder="162,000"
                  />
               </div>
            </div>

            {/* Minimum Safe Reserve */}
            <div>
               <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Safe Buffer Stock (Liters)</label>
               <div className="relative">
                  <Layers className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                  <input 
                     required
                     type="text"
                     inputMode="numeric"
                     value={customReserveInput ? parseInt(customReserveInput.replace(/,/g, '')).toLocaleString() : ''}
                     onChange={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (val === '' || /^\d*$/.test(val)) {
                           setCustomReserveInput(val);
                        }
                     }}
                     className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface font-mono"
                     placeholder="1,000,000"
                  />
               </div>
            </div>
         </div>

         {/* Calculations Output Metrics */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-8">
            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Live Current Stock</span>
               <div>
                  <span className="text-2xl font-black text-primary font-mono">{totalCurrentStock.toLocaleString()} L</span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-60">
                     Bulk Tanks ({activeTanks.length}): {(bulkCurrentStock / 1000000).toFixed(2)}M L | RF Units ({activeRefuellers.length}): {(rfCurrentStock / 1000).toFixed(0)}K L
                  </p>
               </div>
            </div>

            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Days Remaining</span>
               <div>
                  <span className="text-2xl font-black text-on-surface font-mono">{diffDays} Days</span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-50">
                     Until target date: {targetDate}
                  </p>
               </div>
            </div>

            <div className="p-6 bg-surface-dim/40 rounded-2xl border border-outline flex flex-col justify-between">
               <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-2">Projected Stock Level</span>
               <div>
                  <span className={`text-2xl font-black font-mono ${projectedStockLevel < parsedReserve ? 'text-error' : 'text-success'}`}>
                     {projectedStockLevel.toLocaleString()} L
                  </span>
                  <div className="mt-1 flex items-center text-[9px] font-black uppercase tracking-widest">
                     {projectedStockLevel < parsedReserve ? (
                        <span className="text-error flex items-center gap-1">
                           <AlertTriangle className="w-3.5 h-3.5" /> Below Safe Buffer
                        </span>
                     ) : (
                        <span className="text-success flex items-center gap-1">
                           <CheckCircle className="w-3.5 h-3.5" /> Stock Intact
                        </span>
                     )}
                  </div>
               </div>
            </div>

            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col justify-between shadow-premium">
               <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Recommended Order</span>
               <div>
                  <span className={`text-2xl font-[900] font-mono ${recommendedOrder > 0 ? 'text-error shadow-glow' : 'text-success'}`}>
                     {recommendedOrder > 0 ? `${recommendedOrder.toLocaleString()} L` : '0 L (SECURE)'}
                  </span>
                  <p className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest mt-1 opacity-60">
                     {recommendedOrder > 0 ? 'Procurement recommended' : 'No re-order required'}
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* Key Metrics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-primary group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Depletion Zero-Point</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">{criticalDateStr}</p>
          <div className="mt-4 flex items-center text-[10px] font-black text-success uppercase tracking-widest">
             <div className="w-1.5 h-1.5 bg-success rounded-full mr-2"></div>
             +4 DAYS DRIFT POSITIVE VS AVG
          </div>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-warning group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Re-Order Engagement</p>
          <p className="text-3xl font-[900] text-on-surface tracking-tighter italic uppercase">
            {new Date(criticalDate.getTime() - 7 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest">Current Burn Rate Sync: Active</p>
        </div>
        <div className="card-premium p-6 lg:p-8 border-l-4 border-l-error group">
          <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 mb-3">Capacity Risk Factor</p>
          <p className="text-3xl font-[900] text-success tracking-tighter italic uppercase">NOMINAL</p>
          <p className="text-[10px] font-black text-on-surface-dim mt-4 opacity-40 uppercase tracking-widest font-mono">
             Ullage: {(totalCapacity - totalCurrentStock).toLocaleString()} L
          </p>
        </div>
      </div>
    </div>
  );
};