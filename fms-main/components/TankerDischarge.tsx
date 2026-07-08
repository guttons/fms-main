import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Anchor, Droplet, FileText, CheckCircle, Scale, Thermometer, AlertOctagon, History, ShieldAlert, Printer, X, ClipboardCheck, Database, Ruler, Layers, Waves, GitCommit, Percent, Sliders } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { FuelType, UserRole } from '../types';

interface DischargeLog {
    id: string;
    vessel: string;
    bol: string;
    product: FuelType;
    quantity: number; // in Metric Tons
    date: string;
    status: 'COMPLETED' | 'PENDING';
    tankName: string;
    
    observedDensity?: string;
    sg?: string;
    flashPoint?: string;
    temp?: string;
    h2o?: string;
    finalVolume?: string;

    // Detailed Report Data
    isDetailedReport?: boolean;
    reportType?: 'JETA1' | 'MGO' | 'PETROL';
    header?: any;
    tanksData?: any;
    summary?: any;
}

interface ReceiptData {
  id?: string;
  vessel: string;
  bol: string;
  product: FuelType | string;
  quantity: number;
  date: string;
  tankName: string;
  sg?: string;
  finalVolume?: string;
  flashPoint?: string;
  temp?: string;
  h2o?: string;
  observedDensity?: string;
  
  // Custom Detailed Report properties
  isDetailedReport?: boolean;
  reportType?: 'JETA1' | 'MGO' | 'PETROL';
  header?: any;
  tanksData?: any;
  summary?: any;
}

const K_VALUES: Record<string, { K0: number; K1: number; K2: number }> = {
  [FuelType.JET_A1]: { K0: 594.5418, K1: 0.0, K2: 0.0 },
  [FuelType.DIESEL]: { K0: 186.9696, K1: 0.4862, K2: 0.0 },
  [FuelType.PETROL]: { K0: 346.4228, K1: 0.4388, K2: 0.0 }
};

// ASTM D1250 Table 53B: Convert Observed Density at Temp to Density at 15°C
function getDensityAt15(observedDensity: number, temp: number, productType: FuelType): number {
  const rhoT = observedDensity * 1000; // convert to kg/m³
  const deltaT = temp - 15;
  
  const K = K_VALUES[productType] || K_VALUES[FuelType.JET_A1];
  const K0 = K.K0;
  const K1 = K.K1;
  const K2 = K.K2;
  
  let rho15 = rhoT; // initial guess
  for (let i = 0; i < 20; i++) {
    let alpha15 = 0;
    if (rho15 >= 770.5 && rho15 <= 787.5) {
      alpha15 = -0.00336312 + (2680.3206 / (rho15 * rho15));
    } else {
      alpha15 = K0 / (rho15 * rho15) + K1 / rho15 + K2;
    }
    const vcf = Math.exp(-alpha15 * deltaT * (1 + 0.8 * alpha15 * deltaT));
    rho15 = rhoT / vcf;
  }
  
  return rho15 / 1000; // convert back to kg/L
}

// ASTM D1250 Table 54B: Calculate Volume Correction Factor (VCF) from Density at 15°C and Tank Temp
function getVcf(density15: number, tankTemp: number, productType: FuelType): number {
  const rho15 = density15 * 1000; // convert to kg/m³
  const deltaT = tankTemp - 15;
  
  const K = K_VALUES[productType] || K_VALUES[FuelType.JET_A1];
  const K0 = K.K0;
  const K1 = K.K1;
  const K2 = K.K2;
  
  let alpha15 = 0;
  if (rho15 >= 770.5 && rho15 <= 787.5) {
    alpha15 = -0.00336312 + (2680.3206 / (rho15 * rho15));
  } else {
    alpha15 = K0 / (rho15 * rho15) + K1 / rho15 + K2;
  }
  
  const vcf = Math.exp(-alpha15 * deltaT * (1 + 0.8 * alpha15 * deltaT));
  return vcf;
}

const defaultMeasurement = () => ({
  tankId: '',
  grossDip: '',
  tableVolume: '',
  roofCorrection: '0',
  densityObserved: '',
  temperature: '',
  tankTemperature: '',
  density15: '',
  waterDip: '0',
  waterQuantity: '0',
  lineQuantity: '0'
});

const ReceiptModal: React.FC<{ data: ReceiptData; onClose: () => void }> = ({ data, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => {
    window.print();
  };

  const isJet = data.reportType === 'JETA1';
  const isPetrol = data.reportType === 'PETROL';
  const isDiesel = data.reportType === 'MGO';

  const header = data.header || {};
  const tData = data.tanksData || {};
  const summary = data.summary || {};
  const hasTank2 = !!tData.t2;

  let brandingTitle = 'DIESEL RECEIPT REPORT';
  if (isJet) brandingTitle = 'JET A-1 RECEIPT REPORT';
  if (isPetrol) brandingTitle = 'PETROL RECEIPT REPORT';

  return (
    <>
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] no-print" onClick={onClose} />

      {/* Modal Container */}
      <div id="fms-receipt-print-root" className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className={`w-full ${data.isDetailedReport ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-300`} 
          style={{ background: 'var(--color-surface)' }}
        >
          
          {/* Modal action bar */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-black uppercase tracking-widest text-on-surface">Official Receipt Certificate</span>
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
                className="p-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-on-surface-dim"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── REPORT DOCUMENT ── */}
          <div ref={receiptRef} className="flex-1 overflow-y-auto p-8 bg-white text-black font-sans leading-tight print:p-4">
            
            {/* ── 1. DETAILED REPORTS ── */}
            {data.isDetailedReport ? (
              <div className="space-y-6">
                {/* Header Branding */}
                <div className="flex justify-between items-start border-b-2 border-sky-800 pb-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-sky-800 uppercase">Fuel Services Section</h2>
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Velana International Airport</h3>
                    <p className="text-[10px] text-gray-500 uppercase">Maldives Airports Company Ltd</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black tracking-tighter text-sky-800 uppercase italic">
                      {brandingTitle}
                    </h2>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">Date Logged: {data.date}</p>
                  </div>
                </div>

                {/* Header Metadata Grid */}
                <table className="w-full border-collapse border border-gray-300 text-xs font-mono">
                  <tbody>
                    {isJet ? (
                      <>
                        <tr>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-1/4">NAME OF THE TANKER</td>
                          <td className="border border-gray-300 p-2 w-1/4 uppercase">{header.tankerName}</td>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-1/4">SHIPMENT NO</td>
                          <td className="border border-gray-300 p-2 w-1/4 uppercase font-bold text-sky-800">{header.shipmentNo}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold">STARTED</td>
                          <td className="border border-gray-300 p-2">{header.startedDate} {header.startedTime} HRS</td>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold">COMPLETED</td>
                          <td className="border border-gray-300 p-2">{header.completedDate} {header.completedTime} HRS</td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-1/4">REPORT NO</td>
                          <td className="border border-gray-300 p-2 w-1/4 uppercase font-bold text-sky-800">{header.reportNo}</td>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-1/4">VESSEL</td>
                          <td className="border border-gray-300 p-2 w-1/4 uppercase">{header.vessel}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold">START DATE &amp; TIME</td>
                          <td className="border border-gray-300 p-2">{header.startedDate} {header.startedTime}</td>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold">FINISH DATE &amp; TIME</td>
                          <td className="border border-gray-300 p-2">{header.completedDate} {header.completedTime}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 bg-gray-50 p-2 font-bold">GRADE</td>
                          <td className="border border-gray-300 p-2 font-bold" colSpan={3}>{header.grade}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>

                {/* Measurements Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-400 text-[11px] font-mono">
                    <thead>
                      <tr className="bg-sky-800 text-white text-center">
                        <th className="border border-gray-400 p-2 text-left w-[200px]" rowSpan={2}>TANK DETAILS</th>
                        <th className="border border-gray-400 p-2" colSpan={2}>TANK 1: {tData.t1?.before?.tankId || 'N/A'}</th>
                        {hasTank2 && <th className="border border-gray-400 p-2" colSpan={2}>TANK 2: {tData.t2?.before?.tankId || 'N/A'}</th>}
                      </tr>
                      <tr className="bg-sky-700 text-white text-center">
                        <th className="border border-gray-400 p-1 w-[90px]">BEFORE</th>
                        <th className="border border-gray-400 p-1 w-[90px]">AFTER</th>
                        {hasTank2 && <th className="border border-gray-400 p-1 w-[90px]">BEFORE</th>}
                        {hasTank2 && <th className="border border-gray-400 p-1 w-[90px]">AFTER</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Gross Dip */}
                      <tr>
                        <td className="border border-gray-300 p-1.5 font-bold">GROSS DIP (MM)</td>
                        <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.grossDip}</td>
                        <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.grossDip}</td>
                        {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.grossDip}</td>}
                        {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.grossDip}</td>}
                      </tr>
                      {/* Table Volume */}
                      <tr>
                        <td className="border border-gray-300 p-1.5 font-bold">TABLE VOLUME (KL)</td>
                        <td className="border border-gray-300 p-1.5 text-right">{parseFloat(tData.t1?.before?.tableVolume).toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                        <td className="border border-gray-300 p-1.5 text-right">{parseFloat(tData.t1?.after?.tableVolume).toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                        {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.tableVolume ? parseFloat(tData.t2?.before?.tableVolume).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}</td>}
                        {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.tableVolume ? parseFloat(tData.t2?.after?.tableVolume).toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}</td>}
                      </tr>

                      {/* Jet Specific: Roof Correction */}
                      {isJet && (
                        <tr>
                          <td className="border border-gray-300 p-1.5 font-bold">ROOF CORRECTION</td>
                          <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.roofCorrection}</td>
                          <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.roofCorrection}</td>
                          {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.roofCorrection || '0'}</td>}
                          {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.roofCorrection || '0'}</td>}
                        </tr>
                      )}

                      {/* Diesel/Petrol Specific: Water parameters */}
                      {!isJet && (
                        <>
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">WATER DIP (MM)</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.waterDip || 'NIL'}</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.waterDip || 'NIL'}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.waterDip || 'NIL'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.waterDip || 'NIL'}</td>}
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">WATER QUANTITY (KL)</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.waterQuantity || '0.000'}</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.waterQuantity || '0.000'}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.waterQuantity || '0.000'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.waterQuantity || '0.000'}</td>}
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">VOLUME LESS WATER (KL)</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-800">{tData.t1?.beforeCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-800">{tData.t1?.afterCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-800">{tData.t2?.beforeCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-800">{tData.t2?.afterCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>}
                          </tr>
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">LINE QUANTITY (KL)</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.lineQuantity || 'NIL'}</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.lineQuantity || 'NIL'}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.lineQuantity || 'NIL'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.lineQuantity || 'NIL'}</td>}
                          </tr>
                        </>
                      )}

                      {/* Total Observed Volume Row */}
                      <tr className="bg-gray-100 font-bold">
                        <td className="border border-gray-300 p-1.5">TOTAL OBSERVED VOLUME</td>
                        <td className="border border-gray-300 p-1.5 text-center" colSpan={2}>{tData.t1?.obsVol?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>
                        {hasTank2 && <td className="border border-gray-300 p-1.5 text-center" colSpan={2}>{tData.t2?.obsVol?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>}
                      </tr>

                      {/* Temperature & Density Math (only for Jet & Diesel) */}
                      {!isPetrol && (
                        <>
                          {isJet && (
                            <>
                              <tr>
                                <td className="border border-gray-300 p-1.5 font-bold">DENSITY OBSERVED</td>
                                <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.densityObserved}</td>
                                <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.densityObserved}</td>
                                {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.densityObserved || '-'}</td>}
                                {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.densityObserved || '-'}</td>}
                              </tr>
                              <tr>
                                <td className="border border-gray-300 p-1.5 font-bold">TEMPERATURE °C</td>
                                <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.temperature}</td>
                                <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.temperature}</td>
                                {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.temperature || '-'}</td>}
                                {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.temperature || '-'}</td>}
                              </tr>
                            </>
                          )}

                          {/* Density @ 15°C */}
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold text-sky-800">DENSITY AT 15 °C (g/cm³)</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t1?.beforeCalc?.density15?.toFixed(4)}</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t1?.afterCalc?.density15?.toFixed(4)}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t2?.beforeCalc?.density15 ? tData.t2?.beforeCalc?.density15?.toFixed(4) : '-'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t2?.afterCalc?.density15 ? tData.t2?.afterCalc?.density15?.toFixed(4) : '-'}</td>}
                          </tr>

                          {/* WCF */}
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">W.C.F</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">
                              {tData.t1?.beforeCalc?.density15 > 0 ? (tData.t1.beforeCalc.density15 - 0.0011).toFixed(4) : '-'}
                            </td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">
                              {tData.t1?.afterCalc?.density15 > 0 ? (tData.t1.afterCalc.density15 - 0.0011).toFixed(4) : '-'}
                            </td>
                            {hasTank2 && (
                              <>
                                <td className="border border-gray-300 p-1.5 text-right font-bold">
                                  {tData.t2?.beforeCalc?.density15 > 0 ? (tData.t2.beforeCalc.density15 - 0.0011).toFixed(4) : '-'}
                                </td>
                                <td className="border border-gray-300 p-1.5 text-right font-bold">
                                  {tData.t2?.afterCalc?.density15 > 0 ? (tData.t2.afterCalc.density15 - 0.0011).toFixed(4) : '-'}
                                </td>
                              </>
                            )}
                          </tr>

                          {/* Tank Temperature */}
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold">TANK TEMPERATURE °C</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.before?.tankTemperature}</td>
                            <td className="border border-gray-300 p-1.5 text-right">{tData.t1?.after?.tankTemperature}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.before?.tankTemperature || '-'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right">{tData.t2?.after?.tankTemperature || '-'}</td>}
                          </tr>

                          {/* VCF */}
                          <tr>
                            <td className="border border-gray-300 p-1.5 font-bold text-sky-800">V.C.F (TABLE 54B)</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t1?.beforeCalc?.vcf?.toFixed(4)}</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t1?.afterCalc?.vcf?.toFixed(4)}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t2?.beforeCalc?.vcf ? tData.t2?.beforeCalc?.vcf?.toFixed(4) : '-'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold">{tData.t2?.afterCalc?.vcf ? tData.t2?.afterCalc?.vcf?.toFixed(4) : '-'}</td>}
                          </tr>

                          {/* KL at 15C */}
                          <tr className="bg-sky-50">
                            <td className="border border-gray-300 p-1.5 font-bold text-sky-900">KILO LITRES AT 15 °C</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-900">{tData.t1?.beforeCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                            <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-900">{tData.t1?.afterCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 })}</td>
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-900">{tData.t2?.beforeCalc?.kl15 ? tData.t2?.beforeCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}</td>}
                            {hasTank2 && <td className="border border-gray-300 p-1.5 text-right font-bold text-sky-900">{tData.t2?.afterCalc?.kl15 ? tData.t2?.afterCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}</td>}
                          </tr>

                          {/* Receipt @ 15°C */}
                          <tr className="bg-sky-100 font-black">
                            <td className="border border-gray-300 p-2">RECEIPT AT 15 °C</td>
                            <td className="border border-gray-300 p-2 text-center text-sky-900 text-xs" colSpan={2}>{tData.t1?.receipt15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>
                            {hasTank2 && <td className="border border-gray-300 p-2 text-center text-sky-900 text-xs" colSpan={2}>{tData.t2?.receipt15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>}
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Summary receipts table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {isPetrol ? (
                    <div>
                      <h3 className="text-xs font-black text-sky-800 uppercase mb-3 border-b pb-1.5">Cargo Outturn Summary</h3>
                      <table className="w-full border-collapse border border-gray-300 text-xs font-mono">
                        <tbody>
                          <tr className="bg-sky-50">
                            <td className="border border-gray-300 bg-sky-100 p-2 font-bold text-sky-950 w-[220px]">TOTAL OBSERVED VOLUME</td>
                            <td className="border border-gray-300 p-2 text-right font-black text-sky-950 text-sm">{summary.totalObservedVolume?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xs font-black text-sky-800 uppercase mb-3 border-b pb-1.5">Cargo Outturn Summary</h3>
                      <table className="w-full border-collapse border border-gray-300 text-xs font-mono">
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-[220px]">TOTAL OBSERVED VOLUME</td>
                            <td className="border border-gray-300 p-2 text-right font-bold">{summary.totalObservedVolume?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold">TOTAL VOLUME @ 15 °C</td>
                            <td className="border border-gray-300 p-2 text-right font-bold text-sky-800">{summary.totalVolume15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold">B/L DENSITY @ 15 °C</td>
                            <td className="border border-gray-300 p-2 text-right font-bold">{header.blDensity}</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold">W.C.F</td>
                            <td className="border border-gray-300 p-2 text-right font-bold text-gray-700">{summary.wcf?.toFixed(4)}</td>
                          </tr>
                          <tr className="bg-sky-50">
                            <td className="border border-gray-300 bg-sky-100 p-2 font-bold text-sky-950">METRIC TONS (AIR)</td>
                            <td className="border border-gray-300 p-2 text-right font-black text-sky-950 text-sm">{summary.metricTonsAir?.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold">LONG TONS (AIR)</td>
                            <td className="border border-gray-300 p-2 text-right font-bold">{summary.longTons?.toLocaleString(undefined, { minimumFractionDigits: 3 })} LT</td>
                          </tr>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold">US BARRELS @ 60 °F</td>
                            <td className="border border-gray-300 p-2 text-right font-bold">{summary.usBarrels?.toLocaleString(undefined, { minimumFractionDigits: 0 })} BBL</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isJet ? (
                    <div>
                      <h3 className="text-xs font-black text-sky-800 uppercase mb-3 border-b pb-1.5">Outturn Reconciliation</h3>
                      <table className="w-full border-collapse border border-gray-300 text-xs font-mono">
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 bg-gray-50 p-2 font-bold w-[220px]">METRIC TONS B/L (AIR)</td>
                            <td className="border border-gray-300 p-2 text-right font-bold">{parseFloat(header.blQtyAir)?.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</td>
                          </tr>
                          <tr className={summary.diffQty >= 0 ? 'text-green-800 font-bold bg-green-50' : 'text-red-800 font-bold bg-red-50'}>
                            <td className="border border-gray-300 p-2">DIFF BETWEEN B/L &amp; OUTTURN</td>
                            <td className="border border-gray-300 p-2 text-right">{summary.diffQty?.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</td>
                          </tr>
                          <tr className={summary.diffPercentage >= 0 ? 'text-green-800 font-black bg-green-50' : 'text-red-800 font-black bg-red-50'}>
                            <td className="border border-gray-300 p-2">PERCENTAGE DIFFERENCE</td>
                            <td className="border border-gray-300 p-2 text-right">{summary.diffPercentage?.toFixed(2)} %</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-[10px] text-gray-500 uppercase leading-relaxed font-mono">
                        <strong>REMARKS:</strong><br />
                        {header.remarks || 'No remarks provided.'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xs font-black text-sky-800 uppercase mb-3 border-b pb-1.5">Remarks</h3>
                      <div className="p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-xs text-gray-500 uppercase leading-relaxed font-mono h-[160px] overflow-y-auto">
                        <strong>REMARKS:</strong><br />
                        {header.remarks || 'No remarks provided.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Signature Blocks */}
                <div className="grid grid-cols-3 gap-6 pt-10 border-t border-gray-200 text-[10px] uppercase font-bold text-gray-500 font-mono text-center">
                  <div>
                    <div className="h-[40px] border-b border-gray-400 mb-2"></div>
                    <div>RECEIVING OFFICER</div>
                  </div>
                  <div>
                    <div className="h-[40px] border-b border-gray-400 mb-2"></div>
                    <div>DEPOT MANAGER / SUPERVISOR</div>
                  </div>
                  <div>
                    <div className="h-[40px] border-b border-gray-400 mb-2"></div>
                    <div>VESSEL REPRESENTATIVE</div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── 2. FALLBACK DEFAULT SIMPLE RECEIPT ── */
              <div>
                <div style={{ borderBottom: '3px solid #0369a1', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', color: '#0369a1' }}>MALDIVES AIRPORTS CO. LTD.</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', marginTop: '2px' }}>VELANA INTERNATIONAL AIRPORT — MLE / VRMM</div>
                      <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>Fuel Depot Operations · Hulhulé Island, Republic of Maldives</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Receipt No.</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>{data.bol}</div>
                      <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '4px' }}>Date: {data.date}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Vessel / Tanker Identity</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#111827', textTransform: 'uppercase' }}>{data.vessel}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Bill of Lading (BoL) No.</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>{data.bol}</div>
                  </div>
                </div>

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
                    <tr style={{ background: '#eff6ff', borderBottom: '2px solid #0369a1' }}>
                      <td style={{ padding: '10px 12px', color: '#1d4ed8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Receipt Volume</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: '15px', color: '#1d4ed8', fontFamily: 'monospace' }}>{data.finalVolume ? parseInt(data.finalVolume).toLocaleString() : (data.quantity * 1274).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1d4ed8', fontWeight: 900 }}>LITERS</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const TankerDischarge: React.FC = () => {
  const { notify } = useNotification();
  const { tanks, updateTankLevel, createAlert, vessels } = useOperationalData();

  // Tab selector: JETA1 vs MGO vs PETROL
  const [reportType, setReportType] = useState<'JETA1' | 'MGO' | 'PETROL'>('JETA1');

  // Toggle Tank 2 columns
  const [showTank2, setShowTank2] = useState(false);

  // Form states - JETA1
  const [jetA1Header, setJetA1Header] = useState({
    tankerName: 'MT ALIMAS',
    shipmentNo: 'N5/SHIP-JET A-1/2025/07',
    startedDate: '2025-04-16',
    startedTime: '21:48',
    completedDate: '2025-04-17',
    completedTime: '20:24',
    blDensity: '0.7883',
    blQtyAir: '7993.829',
    remarks: 'RECEIPT COMPLETED SATISFACTORILY.'
  });

  const [jetA1Tanks, setJetA1Tanks] = useState({
    tank1: {
      before: { tankId: 'TK-101', grossDip: '1913', tableVolume: '2642.781', roofCorrection: '0', densityObserved: '789.7', temperature: '28.80', tankTemperature: '30.50', density15: '0.7997', waterDip: '0', waterQuantity: '0', lineQuantity: '0' },
      after: { tankId: 'TK-101', grossDip: '11473', tableVolume: '12924.217', roofCorrection: '0', densityObserved: '782.5', temperature: '28.60', tankTemperature: '29.60', density15: '0.7925', waterDip: '0', waterQuantity: '0', lineQuantity: '0' }
    },
    tank2: {
      before: { tankId: '', grossDip: '', tableVolume: '', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0', lineQuantity: '0' },
      after: { tankId: '', grossDip: '', tableVolume: '', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0', lineQuantity: '0' }
    }
  });

  // Form states - MGO (Diesel)
  const [mgoHeader, setMgoHeader] = useState({
    reportNo: 'N5/MGO/2025/13',
    startedDate: '2025-04-16',
    startedTime: '20:35',
    completedDate: '2025-04-17',
    completedTime: '04:24',
    vessel: 'MT. ALIMAS',
    grade: 'MGO 0.5%',
    blDensity: '0.8359',
    remarks: 'MGO RECEIPT COMPLETED WITH MINOR B/L DIFFERENCE.'
  });

  const [mgoTanks, setMgoTanks] = useState({
    tank1: {
      before: { tankId: 'TK-201', grossDip: '490', tableVolume: '37.628', roofCorrection: '0', densityObserved: '814.2', temperature: '30.30', tankTemperature: '30.30', density15: '0.8237', waterDip: '0', waterQuantity: '0', lineQuantity: '0' },
      after: { tankId: 'TK-201', grossDip: '7999', tableVolume: '514.760', roofCorrection: '0', densityObserved: '825.0', temperature: '30.50', tankTemperature: '30.50', density15: '0.8350', waterDip: '0', waterQuantity: '0', lineQuantity: '0' }
    },
    tank2: {
      before: { tankId: 'TK-202', grossDip: '3078', tableVolume: '205.503', roofCorrection: '0', densityObserved: '813.9', temperature: '30.50', tankTemperature: '30.50', density15: '0.8234', waterDip: '0', waterQuantity: '0', lineQuantity: '0' },
      after: { tankId: 'TK-202', grossDip: '8021', tableVolume: '519.070', roofCorrection: '0', densityObserved: '821.5', temperature: '30.50', tankTemperature: '30.50', density15: '0.8310', waterDip: '0', waterQuantity: '0', lineQuantity: '0' }
    }
  });

  // Form states - PETROL
  const [petrolHeader, setPetrolHeader] = useState({
    reportNo: 'NFF/PETROL/2024/02',
    startedDate: '2024-07-08',
    startedTime: '14:29',
    completedDate: '2024-07-08',
    completedTime: '17:40',
    vessel: 'FUNNA',
    grade: 'PETROL',
    remarks: 'PETROL RECEIPT COMPLETED SATISFACTORILY WITH MINOR DISCREPANCY.'
  });

  const [petrolTanks, setPetrolTanks] = useState({
    tank1: {
      before: { tankId: 'TK-301', grossDip: '695', tableVolume: '9795.00', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0.00', lineQuantity: '125.40' },
      after: { tankId: 'TK-301', grossDip: '1455', tableVolume: '26751.00', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0.00', lineQuantity: '0' }
    },
    tank2: {
      before: { tankId: 'TK-302', grossDip: '583', tableVolume: '7238.00', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0.00', lineQuantity: '0' },
      after: { tankId: 'TK-302', grossDip: '583', tableVolume: '7238.00', roofCorrection: '0', densityObserved: '', temperature: '', tankTemperature: '', density15: '', waterDip: '0', waterQuantity: '0.00', lineQuantity: '0' }
    }
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logs, setLogs] = useState<DischargeLog[]>([]);
  const [receiptLog, setReceiptLog] = useState<ReceiptData | null>(null);

  // Seed default logs on mount
  useEffect(() => {
    setLogs([]);
  }, []);

  // Filter storage tanks dynamically by tab
  const getAvailableTanks = () => {
    const pType = reportType === 'JETA1' ? FuelType.JET_A1 : (reportType === 'MGO' ? FuelType.DIESEL : FuelType.PETROL);
    return (tanks || []).filter(t => {
      if (!t) return false;
      if (t.type !== pType) return false;
      if (pType === FuelType.JET_A1) {
        return t.name.toUpperCase().includes('NFF') && !t.name.toUpperCase().includes('RECOVERY');
      }
      return true;
    });
  };

  const handleHeaderChange = (report: 'JETA1' | 'MGO' | 'PETROL', field: string, value: string) => {
    if (report === 'JETA1') {
      setJetA1Header(prev => ({ ...prev, [field]: value }));
    } else if (report === 'MGO') {
      setMgoHeader(prev => ({ ...prev, [field]: value }));
    } else {
      setPetrolHeader(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleMeasurementChange = (
    report: 'JETA1' | 'MGO' | 'PETROL',
    tankKey: 'tank1' | 'tank2',
    phase: 'before' | 'after',
    field: string,
    value: string
  ) => {
    const setter = report === 'JETA1' ? setJetA1Tanks : (report === 'MGO' ? setMgoTanks : setPetrolTanks);
    const productType = report === 'JETA1' ? FuelType.JET_A1 : (report === 'MGO' ? FuelType.DIESEL : FuelType.PETROL);
    
    setter(prev => {
      const updatedPhase = { ...prev[tankKey][phase], [field]: value };
      
      // Auto-calculate density15 if observed density or lab temp changed (only for JETA1 and MGO)
      if (productType !== FuelType.PETROL && (field === 'densityObserved' || field === 'temperature')) {
        let dens = parseFloat(updatedPhase.densityObserved) || 0;
        if (dens > 10) dens = dens / 1000; // convert kg/m3 to kg/L
        const tempVal = parseFloat(updatedPhase.temperature) || 0;
        if (dens > 0 && tempVal > 0) {
          const calc15 = getDensityAt15(dens, tempVal, productType as FuelType);
          updatedPhase.density15 = calc15.toFixed(4);
        }
      }
      
      return {
        ...prev,
        [tankKey]: {
          ...prev[tankKey],
          [phase]: updatedPhase
        }
      };
    });
  };

  // Perform Derived Calculations for rendering & logging
  const deriveJetA1Calculations = () => {
    const calcPhase = (m: any) => {
      const tableVol = parseFloat(m.tableVolume) || 0;
      const roofCorr = parseFloat(m.roofCorrection) || 0;
      const tableVolLessRoof = Math.max(0, tableVol - roofCorr);
      const dens15 = parseFloat(m.density15) || 0;
      const tTemp = parseFloat(m.tankTemperature) || 0;
      const vcf = dens15 > 0 && tTemp > 0 ? getVcf(dens15, tTemp, FuelType.JET_A1) : 0;
      const kl15 = tableVolLessRoof * vcf;
      
      return { tableVolLessRoof, density15: dens15, vcf, kl15 };
    };

    const t1Before = calcPhase(jetA1Tanks.tank1.before);
    const t1After = calcPhase(jetA1Tanks.tank1.after);
    const t1ObsVol = t1After.tableVolLessRoof - t1Before.tableVolLessRoof;
    const t1Receipt15 = t1After.kl15 - t1Before.kl15;

    const t2Active = showTank2 && !!jetA1Tanks.tank2.before.tankId;
    const t2Before = calcPhase(jetA1Tanks.tank2.before);
    const t2After = calcPhase(jetA1Tanks.tank2.after);
    const t2ObsVol = t2Active ? (t2After.tableVolLessRoof - t2Before.tableVolLessRoof) : 0;
    const t2Receipt15 = t2Active ? (t2After.kl15 - t2Before.kl15) : 0;

    const blDensity = parseFloat(jetA1Header.blDensity) || 0;
    const wcf = Math.max(0, blDensity - 0.0011);
    
    const totalObservedVolume = t1ObsVol + t2ObsVol;
    const totalVolume15 = t1Receipt15 + t2Receipt15;
    const usBarrels = totalVolume15 * 6.293;

    // Use mixture/received density to compute outturn Metric Tons safely
    const avgDensity15 = totalVolume15 > 0 
      ? (t1Receipt15 * t1After.density15 + (t2Active ? t2Receipt15 * t2After.density15 : 0)) / totalVolume15 
      : blDensity;
    const outturnWcf = Math.max(0, avgDensity15 - 0.0011);
    const metricTonsAir = totalVolume15 * outturnWcf;
    const longTons = metricTonsAir * 0.9842065;

    const blQty = parseFloat(jetA1Header.blQtyAir) || 0;
    const diffQty = metricTonsAir - blQty;
    const diffPercentage = blQty > 0 ? (diffQty / blQty * 100) : 0;

    return {
      tData: {
        t1: {
          before: jetA1Tanks.tank1.before,
          after: jetA1Tanks.tank1.after,
          beforeCalc: t1Before,
          afterCalc: t1After,
          obsVol: t1ObsVol,
          receipt15: t1Receipt15
        },
        t2: t2Active ? {
          before: jetA1Tanks.tank2.before,
          after: jetA1Tanks.tank2.after,
          beforeCalc: t2Before,
          afterCalc: t2After,
          obsVol: t2ObsVol,
          receipt15: t2Receipt15
        } : null
      },
      summary: {
        totalObservedVolume,
        totalVolume15,
        wcf,
        metricTonsAir,
        longTons,
        usBarrels,
        diffQty,
        diffPercentage
      }
    };
  };

  const deriveMgoCalculations = () => {
    const calcPhase = (m: any) => {
      const tableVol = parseFloat(m.tableVolume) || 0;
      const waterQty = parseFloat(m.waterQuantity) || 0;
      const volLessWater = Math.max(0, tableVol - waterQty);
      const lineQty = parseFloat(m.lineQuantity) || 0;
      
      const dens15 = parseFloat(m.density15) || 0;
      const tTemp = parseFloat(m.tankTemperature) || 0;
      const vcf = dens15 > 0 && tTemp > 0 ? getVcf(dens15, tTemp, FuelType.DIESEL) : 0;
      const kl15 = volLessWater * vcf;
      
      return { volLessWater, lineQty, density15: dens15, vcf, kl15 };
    };

    const t1Before = calcPhase(mgoTanks.tank1.before);
    const t1After = calcPhase(mgoTanks.tank1.after);
    const t1ObsVol = (t1After.volLessWater - t1Before.volLessWater) + (t1Before.lineQty - t1After.lineQty);
    const t1Receipt15 = t1After.kl15 - t1Before.kl15;

    const t2Active = showTank2 && !!mgoTanks.tank2.before.tankId;
    const t2Before = calcPhase(mgoTanks.tank2.before);
    const t2After = calcPhase(mgoTanks.tank2.after);
    const t2ObsVol = t2Active ? ((t2After.volLessWater - t2Before.volLessWater) + (t2Before.lineQty - t2After.lineQty)) : 0;
    const t2Receipt15 = t2Active ? (t2After.kl15 - t2Before.kl15) : 0;

    const blDensity = parseFloat(mgoHeader.blDensity) || 0;
    const wcf = Math.max(0, blDensity - 0.0011);
    
    const totalObservedVolume = t1ObsVol + t2ObsVol;
    const totalVolume15 = t1Receipt15 + t2Receipt15;
    
    const avgDensity15 = totalVolume15 > 0 
      ? (t1Receipt15 * t1After.density15 + (t2Active ? t2Receipt15 * t2After.density15 : 0)) / totalVolume15 
      : blDensity;
    const outturnWcf = Math.max(0, avgDensity15 - 0.0011);
    const metricTonsAir = totalVolume15 * outturnWcf;
    const longTons = metricTonsAir * 0.9842065;
    const usBarrels = totalVolume15 * 6.293;

    return {
      tData: {
        t1: {
          before: mgoTanks.tank1.before,
          after: mgoTanks.tank1.after,
          beforeCalc: t1Before,
          afterCalc: t1After,
          obsVol: t1ObsVol,
          receipt15: t1Receipt15
        },
        t2: t2Active ? {
          before: mgoTanks.tank2.before,
          after: mgoTanks.tank2.after,
          beforeCalc: t2Before,
          afterCalc: t2After,
          obsVol: t2ObsVol,
          receipt15: t2Receipt15
        } : null
      },
      summary: {
        totalObservedVolume,
        totalVolume15,
        wcf,
        metricTonsAir,
        longTons,
        usBarrels
      }
    };
  };

  const derivePetrolCalculations = () => {
    const calcPhase = (m: any) => {
      const tableVol = parseFloat(m.tableVolume) || 0;
      const waterQty = parseFloat(m.waterQuantity) || 0;
      const volLessWater = Math.max(0, tableVol - waterQty);
      const lineQty = parseFloat(m.lineQuantity) || 0;
      
      return { volLessWater, lineQty };
    };

    const t1Before = calcPhase(petrolTanks.tank1.before);
    const t1After = calcPhase(petrolTanks.tank1.after);
    const t1ObsVol = (t1After.volLessWater - t1Before.volLessWater) + (t1Before.lineQty - t1After.lineQty);

    const t2Active = showTank2 && !!petrolTanks.tank2.before.tankId;
    const t2Before = calcPhase(petrolTanks.tank2.before);
    const t2After = calcPhase(petrolTanks.tank2.after);
    const t2ObsVol = t2Active ? ((t2After.volLessWater - t2Before.volLessWater) + (t2Before.lineQty - t2After.lineQty)) : 0;

    const totalObservedVolume = t1ObsVol + t2ObsVol;

    return {
      tData: {
        t1: {
          before: petrolTanks.tank1.before,
          after: petrolTanks.tank1.after,
          beforeCalc: t1Before,
          afterCalc: t1After,
          obsVol: t1ObsVol
        },
        t2: t2Active ? {
          before: petrolTanks.tank2.before,
          after: petrolTanks.tank2.after,
          beforeCalc: t2Before,
          afterCalc: t2After,
          obsVol: t2ObsVol
        } : null
      },
      summary: {
        totalObservedVolume
      }
    };
  };

  const jetCalcs = deriveJetA1Calculations();
  const mgoCalcs = deriveMgoCalculations();
  const petrolCalcs = derivePetrolCalculations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isJet = reportType === 'JETA1';
      const isMgo = reportType === 'MGO';
      const curCalcs = (isJet ? jetCalcs : (isMgo ? mgoCalcs : petrolCalcs)) as any;
      const curHeader = (isJet ? jetA1Header : (isMgo ? mgoHeader : petrolHeader)) as any;
      const curTanks = isJet ? jetA1Tanks : (isMgo ? mgoTanks : petrolTanks);
      
      const tankerName = isJet ? curHeader.tankerName : curHeader.vessel;
      const bolNo = isJet ? curHeader.shipmentNo : curHeader.reportNo;
      const fuelProduct = isJet ? FuelType.JET_A1 : (isMgo ? FuelType.DIESEL : FuelType.PETROL);
      
      // 1. Sync storage tank levels in the FMS database to the AFTER volume
      // Tank 1
      if (curTanks.tank1.after.tankId) {
        const afterVolKL = parseFloat(curTanks.tank1.after.tableVolume) || 0;
        const waterQty = parseFloat(curTanks.tank1.after.waterQuantity) || 0;
        const netVolLiters = (afterVolKL - waterQty) * 1000;
        await updateTankLevel(curTanks.tank1.after.tankId, netVolLiters);
      }
      // Tank 2 (optional)
      if (showTank2 && curTanks.tank2.after.tankId) {
        const afterVolKL = parseFloat(curTanks.tank2.after.tableVolume) || 0;
        const waterQty = parseFloat(curTanks.tank2.after.waterQuantity) || 0;
        const netVolLiters = (afterVolKL - waterQty) * 1000;
        await updateTankLevel(curTanks.tank2.after.tankId, netVolLiters);
      }

      // 2. Alert operations
      await createAlert({
        severity: 'low',
        message: `Bulk import completed: ${curCalcs.summary.totalObservedVolume.toLocaleString()} KL discharged into tanks from vessel ${tankerName}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        acknowledged: false,
        targetRole: UserRole.DEPOT_MANAGER
      });

      // 3. Log detailed report locally
      const newLog: DischargeLog = {
        id: `d${Date.now()}`,
        vessel: tankerName.toUpperCase(),
        bol: bolNo.toUpperCase(),
        product: fuelProduct,
        quantity: curCalcs.summary.metricTonsAir || curCalcs.summary.totalObservedVolume,
        date: new Date().toLocaleDateString(),
        status: 'COMPLETED',
        tankName: curTanks.tank1.after.tankId ? curTanks.tank1.after.tankId : 'DEPOT TANK',
        
        isDetailedReport: true,
        reportType: reportType,
        header: curHeader,
        tanksData: curCalcs.tData,
        summary: curCalcs.summary
      };

      setLogs(prev => [newLog, ...prev]);
      setSuccess(true);
      notify('Discharge details calculated, stored, and tank levels synchronized.', 'success');
    } catch (err) {
      console.error(err);
      notify('Failed to log marine discharge.', 'error');
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
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-4 tracking-tighter uppercase italic">RECEIPT LOGGED &amp; LOCKED</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60">
          Discharge calculation ledger locked. Storage tank farm levels synchronized in real-time.
        </p>
        <button 
          onClick={() => {
            setSuccess(false);
          }}
          className="mt-12 px-10 py-4 kinetic-gradient font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all text-white"
        >
          INITIATE NEW RECEIPT
        </button>
      </div>
    );
  }

  const activeHeader = (reportType === 'JETA1' ? jetA1Header : (reportType === 'MGO' ? mgoHeader : petrolHeader)) as any;
  const activeTanks = reportType === 'JETA1' ? jetA1Tanks : (reportType === 'MGO' ? mgoTanks : petrolTanks);
  const activeCalcs = (reportType === 'JETA1' ? jetCalcs : (reportType === 'MGO' ? mgoCalcs : petrolCalcs)) as any;

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            MARINE <span className="text-primary italic font-medium ml-3">OVERSIGHT</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: BULK DISCHARGE LEDGER</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Operational Readiness Control</span>
          </div>
        </div>
        
        {/* Toggle between Reports */}
        <div className="relative flex bg-surface-dim p-1.5 rounded-2xl border border-outline shrink-0 overflow-hidden w-full max-w-[480px] shadow-inner">
          <div 
            className={`absolute top-1.5 bottom-1.5 w-[calc(33.333%-4px)] rounded-xl kinetic-gradient transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium will-change-transform
              ${reportType === 'JETA1' ? 'left-1.5 translate-x-[0%]' : ''}
              ${reportType === 'MGO' ? 'left-1.5 translate-x-[100%]' : ''}
              ${reportType === 'PETROL' ? 'left-1.5 translate-x-[200%]' : ''}
            `}
          />
          <button
            type="button"
            onClick={() => setReportType('JETA1')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              reportType === 'JETA1' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Jet A-1 Receipt
          </button>
          <button
            type="button"
            onClick={() => setReportType('MGO')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              reportType === 'MGO' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Diesel Receipt
          </button>
          <button
            type="button"
            onClick={() => setReportType('PETROL')}
            className={`flex-1 flex items-center justify-center py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative z-10 overflow-hidden ${
              reportType === 'PETROL' ? 'text-white font-black' : 'text-on-surface-dim opacity-50 hover:opacity-85'
            }`}
          >
            Petrol Receipt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        <div className="xl:col-span-2 space-y-6 lg:space-y-10">
            <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-10">
                
                {/* ── HEADER CARD ── */}
                <div className="card-premium p-6 lg:p-8">
                  <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                      <FileText className="w-4 h-4 mr-3 text-primary opacity-60" />
                      Shipment Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {reportType === 'JETA1' ? (
                      <>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Name of Tanker</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={jetA1Header.tankerName}
                            onChange={(e) => handleHeaderChange('JETA1', 'tankerName', e.target.value)}
                            required 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Shipment No</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={jetA1Header.shipmentNo}
                            onChange={(e) => handleHeaderChange('JETA1', 'shipmentNo', e.target.value)}
                            required 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Started Date &amp; Time</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={jetA1Header.startedDate}
                              onChange={(e) => handleHeaderChange('JETA1', 'startedDate', e.target.value)}
                            />
                            <input 
                              type="time" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={jetA1Header.startedTime}
                              onChange={(e) => handleHeaderChange('JETA1', 'startedTime', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Completed Date &amp; Time</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={jetA1Header.completedDate}
                              onChange={(e) => handleHeaderChange('JETA1', 'completedDate', e.target.value)}
                            />
                            <input 
                              type="time" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={jetA1Header.completedTime}
                              onChange={(e) => handleHeaderChange('JETA1', 'completedTime', e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Report No</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={activeHeader.reportNo}
                            onChange={(e) => handleHeaderChange(reportType, 'reportNo', e.target.value)}
                            required 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Vessel</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={activeHeader.vessel}
                            onChange={(e) => handleHeaderChange(reportType, 'vessel', e.target.value)}
                            required 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Started Date &amp; Time</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={activeHeader.startedDate}
                              onChange={(e) => handleHeaderChange(reportType, 'startedDate', e.target.value)}
                            />
                            <input 
                              type="time" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={activeHeader.startedTime}
                              onChange={(e) => handleHeaderChange(reportType, 'startedTime', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Finish Date &amp; Time</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={activeHeader.completedDate}
                              onChange={(e) => handleHeaderChange(reportType, 'completedDate', e.target.value)}
                            />
                            <input 
                              type="time" 
                              className="w-1/2 px-4 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                              value={activeHeader.completedTime}
                              onChange={(e) => handleHeaderChange(reportType, 'completedTime', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Grade</label>
                          <input 
                            type="text" 
                            className="w-full px-6 py-4 bg-surface-container-low border border-outline text-on-surface rounded-2xl text-xs font-bold uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={activeHeader.grade}
                            onChange={(e) => handleHeaderChange(reportType, 'grade', e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ── TANK DIPPINGS TABLE ── */}
                <div className="card-premium p-6 lg:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                        <Scale className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Tank Dippings &amp; Receipts
                    </h3>
                    {!showTank2 && (
                      <button
                        type="button"
                        onClick={() => setShowTank2(true)}
                        className="px-4 py-2 border border-primary/30 text-primary hover:bg-primary/5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        + Add Tank 2
                      </button>
                    )}
                  </div>
                  
                  {/* Wrap in scrolling card for mobile views */}
                  <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0 scrollbar-thin">
                    <table className="w-full text-left border-collapse text-[11px] font-mono text-on-surface min-w-[550px] lg:min-w-0">
                      <thead>
                        <tr className="border-b border-outline">
                          <th className="sticky left-0 bg-surface border-r border-outline py-3 px-2 text-center font-black uppercase text-on-surface-dim tracking-wider w-14 md:w-[220px] z-20">
                            <span className="hidden md:inline">Parameter</span>
                            <span className="inline md:hidden flex justify-center"><Sliders className="w-4 h-4 text-primary" /></span>
                          </th>
                          <th className="py-3 px-2 text-center font-black uppercase text-primary tracking-wider" colSpan={2}>Tank 1 Details</th>
                          {showTank2 && (
                            <th className="py-3 px-2 text-center font-black uppercase text-primary tracking-wider" colSpan={2}>
                              <div className="flex items-center justify-center gap-2">
                                <span>Tank 2 Details (Optional)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowTank2(false);
                                    // Reset Tank 2 state
                                    setJetA1Tanks(prev => ({ ...prev, tank2: { before: defaultMeasurement(), after: defaultMeasurement() } }));
                                    setMgoTanks(prev => ({ ...prev, tank2: { before: defaultMeasurement(), after: defaultMeasurement() } }));
                                    setPetrolTanks(prev => ({ ...prev, tank2: { before: defaultMeasurement(), after: defaultMeasurement() } }));
                                  }}
                                  className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                                  title="Remove Tank 2"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </th>
                          )}
                        </tr>
                        <tr className="border-b border-outline/50 text-center font-black bg-surface-container-low/10">
                          <th className="sticky left-0 bg-surface border-r border-outline py-2 px-2 text-center font-black w-14 md:w-[220px] z-20"></th>
                          <th className="py-2 px-1 w-[100px]">BEFORE</th>
                          <th className="py-2 px-1 w-[100px]">AFTER</th>
                          {showTank2 && <th className="py-2 px-1 w-[100px]">BEFORE</th>}
                          {showTank2 && <th className="py-2 px-1 w-[100px]">AFTER</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Receiving Tank Selector */}
                        <tr className="border-b border-outline/30">
                          <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                            <div className="flex items-center justify-center md:justify-start">
                              <Database className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                              <span className="hidden md:inline">Receiving Tank ID</span>
                              <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                Receiving Tank ID
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-1" colSpan={2}>
                            <select 
                              className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                              value={activeTanks.tank1.before.tankId}
                              onChange={(e) => {
                                handleMeasurementChange(reportType, 'tank1', 'before', 'tankId', e.target.value);
                                handleMeasurementChange(reportType, 'tank1', 'after', 'tankId', e.target.value);
                              }}
                            >
                              <option value="">Select Tank</option>
                              {getAvailableTanks().map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          {showTank2 && (
                            <td className="py-2 px-1" colSpan={2}>
                              <select 
                                className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                                value={activeTanks.tank2.before.tankId}
                                onChange={(e) => {
                                  handleMeasurementChange(reportType, 'tank2', 'before', 'tankId', e.target.value);
                                  handleMeasurementChange(reportType, 'tank2', 'after', 'tankId', e.target.value);
                                }}
                              >
                                <option value="">Select Tank</option>
                                {getAvailableTanks().map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </td>
                          )}
                        </tr>

                        {/* Gross Dip */}
                        <tr className="border-b border-outline/30">
                          <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                            <div className="flex items-center justify-center md:justify-start">
                              <Ruler className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                              <span className="hidden md:inline">Gross Dip (mm)</span>
                              <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                Gross Dip (mm)
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              type="number" 
                              className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              value={activeTanks.tank1.before.grossDip}
                              onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'grossDip', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              type="number" 
                              className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              value={activeTanks.tank1.after.grossDip}
                              onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'grossDip', e.target.value)}
                            />
                          </td>
                          {showTank2 && (
                            <>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank2.before.grossDip}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'grossDip', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank2.after.grossDip}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'grossDip', e.target.value)}
                                />
                              </td>
                            </>
                          )}
                        </tr>

                        {/* Table Volume */}
                        <tr className="border-b border-outline/30">
                          <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                            <div className="flex items-center justify-center md:justify-start">
                              <Droplet className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                              <span className="hidden md:inline">Table Volume (KL)</span>
                              <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                Table Volume (KL)
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              type="number" 
                              step="0.001"
                              className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              value={activeTanks.tank1.before.tableVolume}
                              onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'tableVolume', e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-1">
                            <input 
                              type="number" 
                              step="0.001"
                              className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                              value={activeTanks.tank1.after.tableVolume}
                              onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'tableVolume', e.target.value)}
                            />
                          </td>
                          {showTank2 && (
                            <>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank2.before.tableVolume}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'tableVolume', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank2.after.tableVolume}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'tableVolume', e.target.value)}
                                />
                              </td>
                            </>
                          )}
                        </tr>

                        {/* Jet Specific: Roof Correction */}
                        {reportType === 'JETA1' && (
                          <tr className="border-b border-outline/30">
                            <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                              <div className="flex items-center justify-center md:justify-start">
                                <Layers className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                <span className="hidden md:inline">Roof Correction (KL)</span>
                                <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                  Roof Correction (KL)
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-1">
                              <input 
                                type="number" 
                                step="0.001"
                                className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={activeTanks.tank1.before.roofCorrection}
                                onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'roofCorrection', e.target.value)}
                              />
                            </td>
                            <td className="py-2 px-1">
                              <input 
                                type="number" 
                                step="0.001"
                                className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                value={activeTanks.tank1.after.roofCorrection}
                                onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'roofCorrection', e.target.value)}
                              />
                            </td>
                            {showTank2 && (
                              <>
                                <td className="py-2 px-1">
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    value={activeTanks.tank2.before.roofCorrection}
                                    onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'roofCorrection', e.target.value)}
                                  />
                                </td>
                                <td className="py-2 px-1">
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    value={activeTanks.tank2.after.roofCorrection}
                                    onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'roofCorrection', e.target.value)}
                                  />
                                </td>
                              </>
                            )}
                          </tr>
                        )}

                        {/* Diesel/Petrol Specific: Water dips & quantity, pipeline line qty */}
                        {(reportType === 'MGO' || reportType === 'PETROL') && (
                          <>
                            <tr className="border-b border-outline/30">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Waves className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Water Dip (mm)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Water Dip (mm)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="text" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.waterDip}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'waterDip', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="text" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.waterDip}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'waterDip', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="text" 
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.waterDip}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'waterDip', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="text" 
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.waterDip}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'waterDip', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                            <tr className="border-b border-outline/30">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Droplet className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Water Quantity (KL)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Water Quantity (KL)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.waterQuantity}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'waterQuantity', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.waterQuantity}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'waterQuantity', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.waterQuantity}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'waterQuantity', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.waterQuantity}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'waterQuantity', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                            <tr className="border-b border-outline/30 bg-primary/5">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Scale className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Volume Less Water (KL)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Volume Less Water (KL)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-black text-primary text-xs">
                                {activeCalcs.tData.t1?.beforeCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-black text-primary text-xs">
                                {activeCalcs.tData.t1?.afterCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-2 text-right font-mono font-black text-primary text-xs">
                                    {activeCalcs.tData.t2?.beforeCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 }) || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-black text-primary text-xs">
                                    {activeCalcs.tData.t2?.afterCalc?.volLessWater?.toLocaleString(undefined, { minimumFractionDigits: 3 }) || '-'}
                                  </td>
                                </>
                              )}
                            </tr>
                            <tr className="border-b border-outline/30">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <GitCommit className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Line Quantity (KL)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Line Quantity (KL)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="text" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.lineQuantity}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'lineQuantity', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="text" 
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.lineQuantity}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'lineQuantity', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="text" 
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.lineQuantity}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'lineQuantity', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="text" 
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.lineQuantity}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'lineQuantity', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>
                          </>
                        )}

                        {/* Density, Temperature Correction Details (Only for JETA1 and MGO) */}
                        {reportType !== 'PETROL' && (
                          <>
                            {/* Observed Lab Density & Temp */}
                            <tr className="border-b border-outline/30 bg-surface-container-low/10">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Scale className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Lab Observed Density</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Lab Observed Density (g/cm³)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.0001"
                                  placeholder="e.g. 789.7"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.densityObserved}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'densityObserved', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.0001"
                                  placeholder="e.g. 782.5"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.densityObserved}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'densityObserved', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.0001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.densityObserved}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'densityObserved', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.0001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.densityObserved}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'densityObserved', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>

                            <tr className="border-b border-outline/30 bg-surface-container-low/10">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Thermometer className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Lab Observed Temp (°C)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Lab Observed Temp (°C)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.temperature}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'temperature', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.temperature}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'temperature', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.temperature}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'temperature', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.01"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.temperature}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'temperature', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* Density @ 15°C */}
                            <tr className="border-b border-outline/30 bg-primary/[0.03]">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-sky-800 z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Scale className="w-3.5 h-3.5 md:mr-2.5 text-sky-800 opacity-55 shrink-0" />
                                  <span className="hidden md:inline">Density @ 15°C (ASTM 53B)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Density @ 15°C (g/cm³) (ASTM 53B)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.0001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.density15}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'density15', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.0001"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.density15}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'density15', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.0001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.density15}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'density15', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.0001"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.density15}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'density15', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* W.C.F Row */}
                            <tr className="border-b border-outline/30 bg-primary/[0.03]">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-sky-800 z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Percent className="w-3.5 h-3.5 md:mr-2.5 text-sky-800 opacity-55 shrink-0" />
                                  <span className="hidden md:inline">W.C.F</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    W.C.F
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface text-xs font-bold">
                                {activeCalcs.tData.t1?.beforeCalc?.density15 > 0 ? (activeCalcs.tData.t1.beforeCalc.density15 - 0.0011).toFixed(4) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-on-surface text-xs font-bold">
                                {activeCalcs.tData.t1?.afterCalc?.density15 > 0 ? (activeCalcs.tData.t1.afterCalc.density15 - 0.0011).toFixed(4) : '-'}
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-2 text-right font-mono text-on-surface text-xs font-bold">
                                    {activeCalcs.tData.t2?.beforeCalc?.density15 > 0 ? (activeCalcs.tData.t2.beforeCalc.density15 - 0.0011).toFixed(4) : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-on-surface text-xs font-bold">
                                    {activeCalcs.tData.t2?.afterCalc?.density15 > 0 ? (activeCalcs.tData.t2.afterCalc.density15 - 0.0011).toFixed(4) : '-'}
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* Tank Temperature */}
                            <tr className="border-b border-outline/30">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface-dim z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Thermometer className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-50 shrink-0" />
                                  <span className="hidden md:inline">Tank Temperature (°C)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Tank Temperature (°C)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.1"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.before.tankTemperature}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'before', 'tankTemperature', e.target.value)}
                                />
                              </td>
                              <td className="py-2 px-1">
                                <input 
                                  type="number" 
                                  step="0.1"
                                  className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                  value={activeTanks.tank1.after.tankTemperature}
                                  onChange={(e) => handleMeasurementChange(reportType, 'tank1', 'after', 'tankTemperature', e.target.value)}
                                />
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.before.tankTemperature}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'before', 'tankTemperature', e.target.value)}
                                    />
                                  </td>
                                  <td className="py-2 px-1">
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      className="w-full bg-surface-container-low border border-outline text-on-surface px-4 py-3 rounded-xl text-xs font-bold text-right font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                      value={activeTanks.tank2.after.tankTemperature}
                                      onChange={(e) => handleMeasurementChange(reportType, 'tank2', 'after', 'tankTemperature', e.target.value)}
                                    />
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* VCF */}
                            <tr className="border-b border-outline/30 bg-primary/[0.03]">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-sky-800 z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Sliders className="w-3.5 h-3.5 md:mr-2.5 text-sky-800 opacity-55 shrink-0" />
                                  <span className="hidden md:inline">VCF 54B</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Volume Correction Factor (VCF 54B)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-primary font-black text-xs">
                                {activeCalcs.tData.t1?.beforeCalc?.vcf?.toFixed(4)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-primary font-black text-xs">
                                {activeCalcs.tData.t1?.afterCalc?.vcf?.toFixed(4)}
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-2 text-right font-mono text-primary font-black text-xs">
                                    {activeCalcs.tData.t2?.beforeCalc?.vcf ? activeCalcs.tData.t2?.beforeCalc?.vcf?.toFixed(4) : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-primary font-black text-xs">
                                    {activeCalcs.tData.t2?.afterCalc?.vcf ? activeCalcs.tData.t2?.afterCalc?.vcf?.toFixed(4) : '-'}
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* Kilo Litres @ 15C */}
                            <tr className="border-b border-outline/30 bg-primary/[0.05]">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-sky-900 z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <Droplet className="w-3.5 h-3.5 md:mr-2.5 text-sky-900 opacity-60 shrink-0" />
                                  <span className="hidden md:inline">Kilo Litres @ 15°C</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Kilo Litres @ 15°C
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-sky-900 font-bold text-xs">
                                {activeCalcs.tData.t1?.beforeCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-sky-900 font-bold text-xs">
                                {activeCalcs.tData.t1?.afterCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                              </td>
                              {showTank2 && (
                                <>
                                  <td className="py-2 px-2 text-right font-mono text-sky-900 font-bold text-xs">
                                    {activeCalcs.tData.t2?.beforeCalc?.kl15 ? activeCalcs.tData.t2?.beforeCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono text-sky-900 font-bold text-xs">
                                    {activeCalcs.tData.t2?.afterCalc?.kl15 ? activeCalcs.tData.t2?.afterCalc?.kl15?.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}
                                  </td>
                                </>
                              )}
                            </tr>

                            {/* Receipt @ 15C */}
                            <tr className="bg-sky-500/10 font-bold">
                              <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                                <div className="flex items-center justify-center md:justify-start">
                                  <ClipboardCheck className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-60 shrink-0" />
                                  <span className="hidden md:inline">Receipt @ 15°C (KL)</span>
                                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                    Receipt @ 15°C (KL)
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center text-sky-400 font-black text-xs" colSpan={2}>
                                {activeCalcs.tData.t1?.receipt15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL
                              </td>
                              {showTank2 && (
                                <td className="py-2 px-2 text-center text-sky-400 font-black text-xs" colSpan={2}>
                                  {activeCalcs.tData.t2 ? `${activeCalcs.tData.t2?.receipt15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL` : '-'}
                                </td>
                              )}
                            </tr>
                          </>
                        )}

                        {/* Petrol Specific Receipt Outturn Row */}
                        {reportType === 'PETROL' && (
                          <tr className="bg-sky-500/10 font-bold">
                            <td className="sticky left-0 bg-surface border-r border-outline/30 px-2 md:px-5 py-3 font-black text-on-surface z-10 w-14 md:w-[220px] group cursor-pointer focus:outline-none" tabIndex={0}>
                              <div className="flex items-center justify-center md:justify-start">
                                <ClipboardCheck className="w-3.5 h-3.5 md:mr-2.5 text-primary opacity-60 shrink-0" />
                                <span className="hidden md:inline">Total Observed Volume (KL)</span>
                                <div className="absolute left-full ml-2 px-2.5 py-1 bg-[var(--color-surface-dim)] text-[9px] font-black text-[var(--color-on-surface)] uppercase rounded-lg border border-[var(--color-outline)] shadow-premium opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap z-50 md:hidden">
                                  Total Observed Volume (KL)
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center text-sky-400 font-black text-xs" colSpan={2}>
                              {activeCalcs.tData.t1?.obsVol?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL
                            </td>
                            {showTank2 && (
                              <td className="py-2 px-2 text-center text-sky-400 font-black text-xs" colSpan={2}>
                                {activeCalcs.tData.t2 ? `${activeCalcs.tData.t2?.obsVol?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL` : '-'}
                              </td>
                            )}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── SUMMARY PANEL & RECONCILIATION ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                  {reportType === 'PETROL' ? (
                    <div className="card-premium p-6 lg:p-8 col-span-1 lg:col-span-2">
                      <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                          <Scale className="w-4 h-4 mr-3 text-primary opacity-60" />
                          Outturn Summary
                      </h3>
                      <div className="space-y-4 text-xs font-mono text-on-surface uppercase">
                        <div className="flex justify-between border-b border-outline pb-2 bg-primary/5 p-4 rounded-xl">
                          <span className="text-primary font-black">Total Observed Volume</span>
                          <span className="font-black font-mono text-primary text-sm">{activeCalcs.summary.totalObservedVolume?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</span>
                        </div>
                        <div className="mt-4">
                          <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Remarks / Log Notes</label>
                          <textarea 
                            className="w-full px-4 py-3 bg-surface-container-low border border-outline text-on-surface rounded-xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                            rows={3}
                            value={petrolHeader.remarks}
                            onChange={(e) => handleHeaderChange('PETROL', 'remarks', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-premium p-6 lg:p-8">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                            <Scale className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Outturn summary
                        </h3>
                        <div className="space-y-4 text-xs font-mono text-on-surface uppercase">
                          <div className="flex justify-between border-b border-outline pb-2">
                            <span className="text-on-surface-dim">Total Observed Volume</span>
                            <span className="font-black font-mono">{activeCalcs.summary.totalObservedVolume?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</span>
                          </div>
                          <div className="flex justify-between border-b border-outline pb-2">
                            <span className="text-on-surface-dim text-sky-400">Total Volume @ 15 °C</span>
                            <span className="font-black font-mono text-sky-400">{activeCalcs.summary.totalVolume15?.toLocaleString(undefined, { minimumFractionDigits: 3 })} KL</span>
                          </div>
                          <div className="flex justify-between border-b border-outline pb-2 items-center">
                            <span className="text-on-surface-dim">B/L Density @ 15 °C (g/cm³)</span>
                            <input 
                              type="number"
                              step="0.0001"
                              className="w-[100px] bg-surface-container-low border border-outline text-on-surface px-3 py-1.5 rounded-lg text-right font-black font-mono text-xs focus:ring-2 focus:ring-primary/20"
                              value={activeHeader.blDensity}
                              onChange={(e) => handleHeaderChange(reportType, 'blDensity', e.target.value)}
                            />
                          </div>
                          <div className="flex justify-between border-b border-outline pb-2">
                            <span className="text-on-surface-dim">W.C.F</span>
                            <span className="font-black font-mono">{activeCalcs.summary.wcf?.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between border-b border-outline pb-2 bg-primary/5 p-2 rounded-xl">
                            <span className="text-primary font-black">Metric Tons (Air)</span>
                            <span className="font-black font-mono text-primary text-sm">{activeCalcs.summary.metricTonsAir?.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                          </div>
                          <div className="flex justify-between border-b border-outline pb-2">
                            <span className="text-on-surface-dim">Long Tons (Air)</span>
                            <span className="font-black font-mono">{activeCalcs.summary.longTons?.toLocaleString(undefined, { minimumFractionDigits: 3 })} LT</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-dim">US Barrels @ 60 °F</span>
                            <span className="font-black font-mono">{activeCalcs.summary.usBarrels?.toLocaleString(undefined, { minimumFractionDigits: 0 })} BBL</span>
                          </div>
                        </div>
                      </div>

                      {reportType === 'JETA1' ? (
                        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-3 text-primary opacity-60" />
                                Outturn Reconciliation
                            </h3>
                            <div className="space-y-4 text-xs font-mono text-on-surface uppercase">
                              <div className="flex justify-between border-b border-outline pb-2 items-center">
                                <span className="text-on-surface-dim">Metric Tons B/L (Air)</span>
                                <input 
                                  type="number"
                                  step="0.001"
                                  className="w-[120px] bg-surface-container-low border border-outline text-on-surface px-3 py-1.5 rounded-lg text-right font-black font-mono text-xs focus:ring-2 focus:ring-primary/20"
                                  value={jetA1Header.blQtyAir}
                                  onChange={(e) => handleHeaderChange('JETA1', 'blQtyAir', e.target.value)}
                                />
                              </div>
                              <div className={`flex justify-between border-b border-outline pb-2 p-2 rounded-xl ${activeCalcs.summary.diffQty >= 0 ? 'bg-success/5 text-success' : 'bg-error/5 text-error'}`}>
                                <span className="font-bold">Outturn Difference</span>
                                <span className="font-black font-mono">{activeCalcs.summary.diffQty?.toLocaleString(undefined, { minimumFractionDigits: 3 })} MT</span>
                              </div>
                              <div className={`flex justify-between p-2 rounded-xl ${activeCalcs.summary.diffPercentage >= 0 ? 'bg-success/5 text-success font-black' : 'bg-error/5 text-error font-black'}`}>
                                <span>Percentage Difference</span>
                                <span className="font-black font-mono">{activeCalcs.summary.diffPercentage?.toFixed(2)} %</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Remarks / Log Notes</label>
                            <textarea 
                              className="w-full px-4 py-3 bg-surface-container-low border border-outline text-on-surface rounded-xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                              rows={2}
                              value={jetA1Header.remarks}
                              onChange={(e) => handleHeaderChange('JETA1', 'remarks', e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="card-premium p-6 lg:p-8 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-3 text-primary opacity-60" />
                                Discharge Validation
                            </h3>
                            <div className="p-4 bg-success/5 border border-success/20 text-success font-black uppercase text-[10px] tracking-widest rounded-2xl mb-8 flex items-center">
                              <CheckCircle className="w-5 h-5 mr-3" />
                              MGO parameters calibrated &amp; aligned with calibration tables.
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-2 tracking-widest opacity-40">Remarks / Log Notes</label>
                            <textarea 
                              className="w-full px-4 py-3 bg-surface-container-low border border-outline text-on-surface rounded-xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                              rows={3}
                              value={mgoHeader.remarks}
                              onChange={(e) => handleHeaderChange('MGO', 'remarks', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Submissions action bar */}
                <div className="flex flex-col md:flex-row gap-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-5 kinetic-gradient font-black text-[12px] uppercase tracking-[0.3em] rounded-2xl shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-white"
                  >
                    {loading ? 'SYNCHRONIZING TANKS...' : 'INITIATE DISCHARGE LEDGER'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptLog({
                      vessel: reportType === 'JETA1' ? jetA1Header.tankerName : (reportType === 'MGO' ? mgoHeader.vessel : petrolHeader.vessel),
                      bol: reportType === 'JETA1' ? jetA1Header.shipmentNo : (reportType === 'MGO' ? mgoHeader.reportNo : petrolHeader.reportNo),
                      product: reportType === 'JETA1' ? FuelType.JET_A1 : (reportType === 'MGO' ? FuelType.DIESEL : FuelType.PETROL),
                      quantity: activeCalcs.summary.metricTonsAir || activeCalcs.summary.totalObservedVolume,
                      date: new Date().toLocaleDateString(),
                      tankName: activeTanks.tank1.before.tankId || 'DEPOT TANK',
                      
                      isDetailedReport: true,
                      reportType: reportType,
                      header: activeHeader,
                      tanksData: activeCalcs.tData,
                      summary: activeCalcs.summary
                    })}
                    className="px-8 py-5 border border-primary/30 text-primary hover:bg-primary/5 active:scale-95 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                  >
                    PREVIEW REPORT
                  </button>
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
                                        <span className={`flex items-center text-[10px] font-black uppercase tracking-widest ${log.product === FuelType.DIESEL ? 'text-amber-500' : (log.product === FuelType.PETROL ? 'text-emerald-500' : 'text-primary')}`}>
                                            <Droplet className="w-3 h-3 mr-1.5" />
                                            {log.product}
                                        </span>
                                        <span className="text-lg font-[900] text-on-surface tracking-tighter italic">
                                            {log.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[10px] opacity-20">MT</span>
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
                                              tankName: log.tankName,
                                              observedDensity: log.observedDensity,
                                              sg: log.sg,
                                              flashPoint: log.flashPoint,
                                              temp: log.temp,
                                              h2o: log.h2o,
                                              finalVolume: log.finalVolume,
                                              isDetailedReport: log.isDetailedReport,
                                              reportType: log.reportType,
                                              header: log.header,
                                              tanksData: log.tanksData,
                                              summary: log.summary
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

       {/* ── REPORT MODAL ── */}
       {receiptLog && createPortal(
         <ReceiptModal
           data={receiptLog}
           onClose={() => setReceiptLog(null)}
         />,
         document.body
       )}
     </div>
  );
};
