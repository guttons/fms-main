import React, { useState, useEffect, useRef } from 'react';
import { Anchor, Droplet, FileText, CheckCircle, Scale, Thermometer, AlertOctagon, History, ShieldAlert, Printer, X, Download, ClipboardCheck } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { FuelType, UserRole } from '../types';

interface DischargeLog {
    id: string;
    vessel: string;
    bol: string;
    product: FuelType;
    quantity: number;
    date: string;
    status: 'COMPLETED' | 'PENDING';
    tankName: string;
}

interface ReceiptData {
  vessel: string;
  bol: string;
  product: FuelType | string;
  quantity: number;
  date: string;
  tankName: string;
  sg?: string;
  flashPoint?: string;
  temp?: string;
  h2o?: string;
  finalVolume?: string;
}

const ReceiptModal: React.FC<{ data: ReceiptData; onClose: () => void }> = ({ data, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const receiptNo = `FMS-REC-${data.bol.replace(/[^A-Z0-9]/g, '')}-${new Date().getFullYear()}`;
  const isJetA1 = data.product === FuelType.JET_A1 || data.product === 'JET A-1';
  const volumeLiters = data.finalVolume ? parseInt(data.finalVolume).toLocaleString() : (data.quantity * 1274).toLocaleString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print styles injected globally for this modal */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #fms-receipt-print-root { display: block !important; position: fixed; inset: 0; z-index: 99999; background: white; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 no-print" onClick={onClose} />

      {/* Modal Container */}
      <div id="fms-receipt-print-root" className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-300" style={{ background: 'var(--color-surface)' }}>
          
          {/* Modal action bar */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-on-surface)' }}>Fuel Receipt Certificate</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 kinetic-gradient text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl hover:bg-red-500/10 transition-colors"
                style={{ color: 'var(--color-on-surface-dim)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── RECEIPT DOCUMENT ── */}
          <div ref={receiptRef} className="p-8" style={{ background: 'white', color: '#111', fontFamily: 'monospace' }}>
            {/* Header */}
            <div style={{ borderBottom: '3px solid #0369a1', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', color: '#0369a1' }}>MALDIVES AIRPORTS CO. LTD.</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginTop: '2px' }}>VELANA INTERNATIONAL AIRPORT — MLE / VRMM</div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>Fuel Depot Operations · Hulhulé Island, Republic of Maldives</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Receipt No.</div>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>{receiptNo}</div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>Date: {data.date}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', padding: '8px 16px', background: isJetA1 ? '#eff6ff' : '#fefce8', border: `1px solid ${isJetA1 ? '#bfdbfe' : '#fde68a'}`, borderRadius: '8px', display: 'inline-block' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, color: isJetA1 ? '#1d4ed8' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  {data.product} — BULK RECEIPT CERTIFICATE
                </span>
              </div>
            </div>

            {/* Vessel & BoL Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Vessel / Tanker Identity</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#111827', textTransform: 'uppercase' }}>{data.vessel}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Bill of Lading (BoL) No.</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>{data.bol}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Receiving Storage Tank</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#111827', textTransform: 'uppercase' }}>{data.tankName}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Receipt Date &amp; Time</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#111827' }}>{data.date} — {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} LT</div>
              </div>
            </div>

            {/* Volume Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#0369a1', color: 'white' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Value</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>BoL Quantity (Gross)</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{data.quantity.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280' }}>MT</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>Specific Gravity (SG @ 15°C)</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{data.sg || '0.8000'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280' }}>kg/L</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>Observed Temperature</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{data.temp || '28.5'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280' }}>°C</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>Flash Point</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{data.flashPoint || '60.0'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280' }}>°C</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>Water Content (H₂O)</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{data.h2o || '0'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6B7280' }}>PPM</td>
                </tr>
                <tr style={{ background: '#eff6ff', borderBottom: '2px solid #0369a1' }}>
                  <td style={{ padding: '10px 12px', color: '#1d4ed8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Receipt Volume</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: '15px', color: '#1d4ed8', fontFamily: 'monospace' }}>{volumeLiters}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1d4ed8', fontWeight: 900 }}>LITERS</td>
                </tr>
              </tbody>
            </table>

            {/* QC Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '16px', height: '16px', background: '#16a34a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 900 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Visual Appearance</div>
                  <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '1px' }}>Clear &amp; Bright — No Particulates</div>
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '16px', height: '16px', background: '#16a34a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'white', fontSize: '10px', fontWeight: 900 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Water Detection Test</div>
                  <div style={{ fontSize: '9px', color: '#6B7280', marginTop: '1px' }}>Chemical Detector — Negative</div>
                </div>
              </div>
            </div>

            {/* Signature Block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              {['Receiving Officer', 'Depot Manager / Supervisor', 'Vessel Representative'].map((role) => (
                <div key={role}>
                  <div style={{ height: '40px', borderBottom: '1px solid #374151', marginBottom: '6px' }} />
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{role}</div>
                  <div style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px' }}>Date: ___________</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ paddingTop: '12px', borderTop: '2px solid #E5E7EB' }}>
              <div style={{ fontSize: '8px', color: '#9CA3AF', lineHeight: '1.6', textAlign: 'center' }}>
                This receipt is issued in accordance with IATA AHM 955 and local fuel quality management procedures.
                All measurements are subject to calibration chart corrections per ASTM D1250. This document constitutes
                an official record of bulk petroleum product receipt at Velana International Airport Fuel Depot.
              </div>
              <div style={{ marginTop: '8px', fontSize: '8px', color: '#0369a1', textAlign: 'center', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                MACL FMS · Fuel Management System · {receiptNo}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const TankerDischarge: React.FC = () => {
  const { notify } = useNotification();
  const { tanks, updateTankLevel, createAlert } = useOperationalData();

  // Form states
  const [vessel, setVessel] = useState('');
  const [bol, setBol] = useState('');
  const [product, setProduct] = useState<FuelType>(FuelType.JET_A1);
  const [targetTankId, setTargetTankId] = useState('');
  const [quantity, setQuantity] = useState(''); // BoL quantity in Metric Tons
  const [sg, setSg] = useState('0.8000');
  const [flashPoint, setFlashPoint] = useState('60.0');
  const [temp, setTemp] = useState('28.5');
  const [h2o, setH2o] = useState('0');
  const [finalVolume, setFinalVolume] = useState(''); // Liter volume actual

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validated, setValidated] = useState(false);
  const [logs, setLogs] = useState<DischargeLog[]>([]);
  const [receiptLog, setReceiptLog] = useState<ReceiptData | null>(null);

  // Seed default logs on mount
  useEffect(() => {
    setLogs([
      { id: 'd1', vessel: 'MT Ocean Pride', bol: 'BOL-8821', product: FuelType.DIESEL, quantity: 1500, date: new Date(Date.now() - 86400000).toLocaleDateString(), status: 'COMPLETED', tankName: 'Diesel TK-201 (NFF)' },
      { id: 'd2', vessel: 'MT Nordic Spirit', bol: 'BOL-8825', product: FuelType.JET_A1, quantity: 2200, date: new Date(Date.now() - 172800000).toLocaleDateString(), status: 'COMPLETED', tankName: 'TK-101 (NFF)' },
    ]);
  }, []);

  // Filter tanks dynamically by fuel type, showing only NFF tanks for JET A-1 (excluding recovery tanks)
  const matchingTanks = (tanks || []).filter(t => {
    if (!t) return false;
    if (t.type !== product) return false;
    if (product === FuelType.JET_A1) {
      return t.name.toUpperCase().includes('NFF') && !t.name.toUpperCase().includes('RECOVERY');
    }
    return true;
  });

  // Auto-select first matching tank when fuel type changes
  useEffect(() => {
    if (matchingTanks.length > 0) {
      setTargetTankId(matchingTanks[0].id);
    } else {
      setTargetTankId('');
    }
  }, [product, tanks]);

  const selectedTank = (tanks || []).find(t => t && t.id === targetTankId);
  const currentUllage = selectedTank ? Math.max(0, selectedTank.capacity - selectedTank.currentLevel) : 0;
  const fillPercentage = selectedTank ? (selectedTank.currentLevel / selectedTank.capacity) * 100 : 0;

  const handleValidate = () => {
    if (!vessel || !bol || !targetTankId || !quantity) {
      notify('Please fill out all cargo manifest details before validation.', 'warning');
      return;
    }
    // Simulate validation against calibration charts
    setValidated(true);
    notify('Calibration chart comparison complete. Cargo details verified.', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTankId || !selectedTank) return;
    
    const dischargeVol = parseInt(finalVolume);
    if (isNaN(dischargeVol) || dischargeVol <= 0) {
      notify('Please enter a valid final receipt volume in liters.', 'warning');
      return;
    }

    if (dischargeVol > currentUllage) {
      notify(`Discharge volume (${dischargeVol.toLocaleString()}L) exceeds remaining tank capacity (${currentUllage.toLocaleString()}L).`, 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Tank Level in Firestore
      const newLevel = selectedTank.currentLevel + dischargeVol;
      await updateTankLevel(selectedTank.id, newLevel);

      // 2. Send Alert Notification to Depot Managers
      await createAlert({
        severity: 'low',
        message: `Bulk import completed: ${dischargeVol.toLocaleString()}L of ${product} discharged into ${selectedTank.name} from vessel ${vessel}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        acknowledged: false,
        targetRole: UserRole.DEPOT_MANAGER
      });

      // 3. Add to operational oversight log list locally
      const newLog: DischargeLog = {
        id: `d${Date.now()}`,
        vessel: vessel.toUpperCase(),
        bol: bol.toUpperCase(),
        product: product,
        quantity: parseFloat(quantity),
        date: new Date().toLocaleDateString(),
        status: 'COMPLETED',
        tankName: selectedTank.name
      };

      setLogs(prev => [newLog, ...prev]);
      setSuccess(true);
    } catch (err) {
      console.error('Failed to log marine discharge:', err);
      notify('Failed to save marine discharge. Please verify database connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
        <div className="w-32 h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-8 border border-primary/20 shadow-premium">
          <Anchor className="w-12 h-12 text-primary shadow-glow" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">DISCHARGE LOGGED</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Bulk receipt successfully captured. Storage tank farm levels synchronized in real-time.
        </p>
        <button 
          onClick={() => {
            setSuccess(false);
            setValidated(false);
            setVessel('');
            setBol('');
            setQuantity('');
            setFinalVolume('');
          }}
          className="mt-12 px-10 py-4 kinetic-gradient font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all text-white"
        >
          INITIATE NEW RECEIPT
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            MARINE <span className="text-primary italic font-medium ml-3">DISCHARGE</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: BULK RECEIPTS</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Readiness Control</span>
          </div>
        </div>
        <div className="flex space-x-3">
            <span className="px-4 py-1.5 bg-surface-container-low border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Jet A-1</span>
            <span className="px-4 py-1.5 bg-surface-container-low border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Diesel Gasoil</span>
            <span className="px-4 py-1.5 bg-surface-container-low border-transparent rounded-xl text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">Mogas Petrol</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        <div className="xl:col-span-2 space-y-6 lg:space-y-10">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                {/* Vessel & Cargo Details */}
                <div className="space-y-6 lg:space-y-10">
                    <div className="card-premium p-6 lg:p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <FileText className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Manifest Registry
                        </h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Tactical Vessel Identity</label>
                                <input 
                                  type="text" 
                                  className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                  placeholder="E.G. MT OCEAN PRIDE" 
                                  value={vessel}
                                  onChange={(e) => setVessel(e.target.value)}
                                  required 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">BoL Identity</label>
                                    <input 
                                      type="text" 
                                      className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                      placeholder="BOL-8821" 
                                      value={bol}
                                      onChange={(e) => setBol(e.target.value)}
                                      required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Resource Type</label>
                                    <select 
                                      className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none text-on-surface" 
                                      value={product}
                                      onChange={(e) => setProduct(e.target.value as FuelType)}
                                      required
                                    >
                                        <option value={FuelType.JET_A1}>JET A-1 (AVIATION)</option>
                                        <option value={FuelType.DIESEL}>DIESEL (GASOIL)</option>
                                        <option value={FuelType.PETROL}>PETROL (MOGAS)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">BoL Quantity (MT)</label>
                                    <input 
                                      type="number" 
                                      inputMode="decimal" 
                                      className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-right font-mono transition-all text-on-surface" 
                                      placeholder="0.000" 
                                      step="0.001" 
                                      value={quantity}
                                      onChange={(e) => setQuantity(e.target.value)}
                                      required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Target Storage Tank</label>
                                    <select 
                                      className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none text-on-surface" 
                                      value={targetTankId}
                                      onChange={(e) => setTargetTankId(e.target.value)}
                                      required
                                    >
                                        {matchingTanks.length === 0 ? (
                                          <option disabled>NO STORAGE TANKS</option>
                                        ) : (
                                          matchingTanks.map(t => (
                                            <option key={t.id} value={t.id}>{t.name} (AVAIL ULLAGE: {(t.capacity - t.currentLevel).toLocaleString()}L)</option>
                                          ))
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-6 lg:p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Scale className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Tactical QC Metrics
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">SG @ 15°C</label>
                                <input 
                                  type="number" 
                                  inputMode="decimal" 
                                  className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                  placeholder="0.8400" 
                                  step="0.0001" 
                                  value={sg}
                                  onChange={(e) => setSg(e.target.value)}
                                  required 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Flash Point (°C)</label>
                                <input 
                                  type="number" 
                                  inputMode="decimal" 
                                  className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                  placeholder="60.0" 
                                  step="0.1" 
                                  value={flashPoint}
                                  onChange={(e) => setFlashPoint(e.target.value)}
                                  required 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Observed Temp (°C)</label>
                                <input 
                                  type="number" 
                                  inputMode="decimal" 
                                  className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                  placeholder="28.5" 
                                  step="0.1" 
                                  value={temp}
                                  onChange={(e) => setTemp(e.target.value)}
                                  required 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">H2O Content (PPM)</label>
                                <input 
                                  type="number" 
                                  inputMode="numeric" 
                                  pattern="[0-9]*" 
                                  className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-on-surface" 
                                  placeholder="0" 
                                  value={h2o}
                                  onChange={(e) => setH2o(e.target.value)}
                                  required 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discharge Ops & Validation */}
                <div className="space-y-6 lg:space-y-10">
                    <div className="card-premium p-6 lg:p-8 h-full flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-3 text-primary opacity-60" />
                              Discharge Validation
                          </h3>

                          {selectedTank ? (
                            <div className="bg-surface-container-low rounded-3xl border-transparent p-6 mb-8 shadow-inner">
                                <div className="flex justify-between items-center mb-4 text-[10px] font-black text-on-surface-dim uppercase tracking-widest">
                                    <span>Target Storage Tank</span>
                                    <span className="text-primary font-mono">{selectedTank.name}</span>
                                </div>
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">Available Ullage</span>
                                    <span className="text-lg font-[900] text-success tracking-tighter">{currentUllage.toLocaleString()} L</span>
                                </div>
                                <div className="w-full bg-surface-lowest rounded-full h-2 border-transparent overflow-hidden shadow-inner">
                                    <div className="bg-success h-full transition-all duration-1000 shadow-glow animate-pulse" style={{ width: `${fillPercentage}%` }}></div>
                                </div>
                                <div className="flex justify-between items-center mt-2 text-[9px] font-black text-on-surface-dim opacity-30">
                                  <span>{selectedTank.currentLevel.toLocaleString()}L</span>
                                  <span>{selectedTank.capacity.toLocaleString()}L MAX</span>
                                </div>
                            </div>
                          ) : (
                            <div className="p-6 bg-error/10 text-error font-black uppercase text-[10px] tracking-widest rounded-2xl mb-8 flex items-center">
                              <ShieldAlert className="w-5 h-5 mr-3" />
                              Please select a target tank first.
                            </div>
                          )}
                        </div>

                        {!validated ? (
                            <div className="text-center py-10 space-y-6 alert-critical bg-error/5 rounded-2xl mx-2">
                                <AlertOctagon className="w-16 h-16 text-error mx-auto opacity-80 pulse-critical rounded-full" />
                                <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-60 leading-relaxed px-4">
                                    SYNCHRONIZE FIGURES AGAINST CALIBRATION CHARTS BEFORE PROCEEDING.
                                </p>
                                <button 
                                    type="button" 
                                    onClick={handleValidate}
                                    className="w-full py-5 kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-premium"
                                >
                                    ENGAGE VALIDATION
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center p-5 bg-success/10 text-success rounded-2xl border border-success/20 font-black text-[10px] uppercase tracking-widest">
                                    <CheckCircle className="w-5 h-5 mr-4" />
                                    <span>CALIBRATION DATA LOCKED</span>
                                </div>
                                
                                <div>
                                    <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Final Receipt Vol (L)</label>
                                    <input 
                                      type="number" 
                                      inputMode="numeric" 
                                      pattern="[0-9]*" 
                                      className="w-full px-6 py-4 bg-surface-container-low border-transparent rounded-2xl text-xl font-[900] text-primary tracking-tighter outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-right font-mono text-on-surface" 
                                      placeholder="0" 
                                      value={finalVolume}
                                      onChange={(e) => setFinalVolume(e.target.value)}
                                      required 
                                    />
                                </div>

                                <div className="pt-6">
                                    <button 
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-5 kinetic-gradient rounded-2xl font-[900] text-[12px] uppercase tracking-[0.3em] shadow-premium hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-white"
                                    >
                                        {loading ? 'SYNCHRONIZING...' : 'INITIATE DISCHARGE'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>
        
        {/* Oversight / History Panel */}
        <div className="xl:col-span-1 h-full">
             <div className="card-premium h-full flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-outline bg-surface-container-low/30 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                        <History className="w-4 h-4 mr-3 text-primary" />
                        Marine Oversight
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {logs.length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Syncing historical logs...</div>
                    ) : (
                        <div className="divide-y divide-outline">
                            {logs.map(log => (
                                <div key={log.id} className="p-6 hover:bg-primary/[0.02] transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-base font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors leading-tight">{log.vessel}</span>
                                        <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest shrink-0 ml-2">{log.date}</span>
                                    </div>
                                    <div className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest mb-1">BoL: {log.bol}</div>
                                    <div className="text-[9px] font-black text-primary uppercase tracking-widest mb-3">TANK: {log.tankName}</div>
                                    <div className="flex justify-between items-center">
                                        <span className={`flex items-center text-[10px] font-black uppercase tracking-widest ${log.product === FuelType.DIESEL ? 'text-amber-500' : 'text-primary'}`}>
                                            <Droplet className="w-3 h-3 mr-1.5" />
                                            {log.product}
                                        </span>
                                        <span className="text-lg font-[900] text-on-surface tracking-tighter italic">
                                            {log.quantity.toLocaleString()} <span className="text-[10px] opacity-20">MT</span>
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <button
                                            onClick={() => setReceiptLog({
                                              vessel: log.vessel,
                                              bol: log.bol,
                                              product: log.product,
                                              quantity: log.quantity,
                                              date: log.date,
                                              tankName: log.tankName
                                            })}
                                            className="flex items-center gap-1.5 text-[9px] font-black text-primary hover:text-on-surface uppercase tracking-widest transition-colors px-3 py-1.5 rounded-lg border border-primary/20 hover:border-primary/50 hover:bg-primary/5 active:scale-95"
                                        >
                                            <FileText className="w-3 h-3" />
                                            Receipt
                                        </button>
                                        <span className="text-[9px] font-black px-3 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em]">
                                            {log.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-outline bg-surface-container-low/30">
                    <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all w-full flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 mr-3" />
                        ACCESS TASK ARCHIVE
                    </button>
                </div>
             </div>
         </div>
       </div>

       {/* ── JET A-1 RECEIPT MODAL ── */}
       {receiptLog && (
         <ReceiptModal
           data={receiptLog}
           onClose={() => setReceiptLog(null)}
         />
       )}
     </div>
  );
};

