import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, User } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';
import { fmsDb } from '../services/db';

export type CustomerClassification = 'ADVANCE' | 'CREDIT' | 'CASH';

export interface CustomerAccount {
  id: string;
  name: string;
  classification: CustomerClassification;
  openingBalance: number;      // USD
  paymentsReceived: number;    // USD
  advanceBalance: number;      // USD (Current running balance for pre-pay)
  creditLimit: number;         // USD
  estimated5DaysSales: number;  // USD
  associatedAirlines?: string[]; // Third-party agent links or flight prefixes (e.g. EK, SQ, Q2)
  associatedRegs?: string[];    // Aircraft registrations (e.g. A6-EEO, 8Q-IAI)
  outstandingReceipts: number;  // USD
  runningBalance: number;      // USD
  openingBalanceLiters?: number;
  balanceLiters?: number;
}

export interface UpcomingPayment {
  id: string;
  customerId: string;
  customerName: string;
  referenceNumber: string;
  amount: number;
  uploadDate: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'CLEARED_IN_ORACLE';
  swiftCopyUrl?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  classification: CustomerClassification;
  amount: number;
  period: string;
  date: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  remainingAmount: number;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  status: 'UNAPPLIED' | 'PARTIALLY_APPLIED' | 'APPLIED';
  remainingAmount: number;
}

export interface ProformaRecord {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  period: string;
  invoiceNumber: string;
}

export interface FuelRequest {
  id: string;
  deliveryNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  quantityLiters: number;
  pricePerLiter: number;
  amount: number;
  aircraftReg: string;
  status: 'PENDING_CONFIRMATION' | 'APPROVED' | 'BLOCKED_INSUFFICIENT_FUNDS';
  
  // New granular report fields matching MACL spreadsheets
  categorySector: 'INT' | 'DOM' | 'SEA' | 'OWN' | 'RACL';
  operator: string;
  flightNumber: string;
  aircraftType: string;
  refuelTimePosition: string;  // HH:MM
  refuelTimeCommence: string;  // HH:MM
  refuelTimeComplete: string;  // HH:MM
  memoLine: string;
  currency: 'USD' | 'MVR';
  circularRate: number;
  discounts: number;
  gst: number;
  transactionType: 'ISSUES' | 'OWN';
  cogsAccount: 'ISSUES' | 'OWN';
  invoiceNumber?: string;
}

export interface MonthEndVariance {
  id: string;
  month: string;
  fuelType: 'Jet A-1' | 'Diesel' | 'Petrol';
  fmsStockLiters: number;
  oracleStockLiters: number;
  salesQuantityLiters: number;
  variancePercentage: number;
  status: 'PENDING_T1' | 'PENDING_T2' | 'PENDING_T3' | 'APPROVED';
  physicalCheckUploaded: boolean;
  notes?: string;
}

export interface ProcurementPR {
  id: string;
  prNumber: string;
  date: string;
  fuelType: string;
  quantityLiters: number;
  plattsRate: number; // USD/barrel
  fobValue: number; // USD
  vendorInvoiceVerified: boolean;
  poNumber?: string;
  oracleInvoiceNumber?: string;
  status: 'PR_CONFIRMED' | 'INVOICE_VERIFIED' | 'PO_RAISED' | 'AP_ENTERED_ORACLE';
}

export interface SurchargeRecord {
  grnNumber: string;
  originalValue: number;
  surchargeAmount: number;
  notes: string;
  date: string;
}

// Multi products delivery (MPD) Landside/Airside online sheet
export interface MpdSale {
  id: string;
  deliveryNo: string;
  date: string;
  customerName: string;
  operatorName: string;
  regNo: string;
  dieselLiters: number;
  petrolLiters: number;
  rateDiesel: number;
  ratePetrol: number;
  amountDiesel: number;
  amountPetrol: number;
  invoiceNumber?: string;
  classification: 'ADVANCE' | 'CREDIT' | 'CASH';
  type: 'LANDSIDE' | 'AIRSIDE';
  cogsAccount: 'ISSUES' | 'OWN';
}

// Customs Shipment & Royalty
export interface CustomsShipment {
  id: string;
  shipmentNumber: string;
  bFormNumber: string;
  arrivalDate: string;
  quantityLiters: number;
  fobValue: number;
  conversionFactor: string; // "1 MT = 1,250 Liters"
  metricTons: number;
  dutyPaid: number;
  royaltyRatePercent: number; // e.g. 5%
  royaltyAmount: number;
}

interface FinanceDataContextType {
  customers: CustomerAccount[];
  upcomingPayments: UpcomingPayment[];
  invoices: Invoice[];
  receipts: Receipt[];
  proformaRegister: ProformaRecord[];
  fuelRequests: FuelRequest[];
  varianceLogs: MonthEndVariance[];
  procurementPRs: ProcurementPR[];
  surcharges: SurchargeRecord[];
  mpdSales: MpdSale[];
  customsShipments: CustomsShipment[];
  
  // Actions
  uploadSwiftCopy: (customerId: string, referenceNumber: string, amount: number) => void;
  reviewSwiftCopy: (paymentId: string, action: 'APPROVE' | 'REJECT') => void;
  syncOracleReceipt: (customerId: string, referenceNumber: string, amount: number) => void;
  submitFuelRequest: (customerId: string, quantityLiters: number, aircraftReg: string, options?: Partial<FuelRequest>) => { success: boolean; message: string };
  runBillingProcess: (classification: CustomerClassification) => void;
  applyFIFOLogic: () => void;
  generateProforma: (customerId: string, period: string, amount: number) => void;
  approveVariance: (varianceId: string, notes?: string, physicalCheckFile?: boolean) => void;
  createProcurementPR: (fuelType: string, quantityLiters: number, plattsRate: number) => void;
  verifyVendorInvoice: (prId: string) => void;
  raisePO: (prId: string, poNumber: string) => void;
  enterAPInvoice: (prId: string, oracleInvoiceNumber: string) => void;
  addSurcharge: (grnNumber: string, amount: number, notes: string) => void;
  resetAllFinanceMockData: () => void;
}

const FinanceDataContext = createContext<FinanceDataContextType | undefined>(undefined);

export const FinanceDataProvider: React.FC<{ children: React.ReactNode; user?: User | null }> = ({ children, user }) => {
  // Initialize mock customer list matching MACL actual worksheets
  const [customers, setCustomers] = useState<CustomerAccount[]>(() => {
    const saved = localStorage.getItem('fms_fin_customers');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'c1', name: 'Emirates Airlines', classification: 'ADVANCE', openingBalance: 280000, paymentsReceived: 150000, advanceBalance: 430000, creditLimit: 0, estimated5DaysSales: 150000, runningBalance: 430000, outstandingReceipts: 0, openingBalanceLiters: 100000, balanceLiters: 153571, associatedAirlines: ['EK', 'EK650', 'EK651', 'EK652', 'EK653'], associatedRegs: ['A6-EEO', 'A6-EUV', 'A6-EOC'] },
      { id: 'c2', name: 'Singapore Airlines', classification: 'ADVANCE', openingBalance: 175712, paymentsReceived: 220000, advanceBalance: 395712, creditLimit: 0, estimated5DaysSales: 80000, runningBalance: 395712, outstandingReceipts: 0, openingBalanceLiters: 62754, balanceLiters: 141325, associatedAirlines: ['SQ', 'SQ451', 'SQ452'], associatedRegs: ['9V-SMA', '9V-SMB'] },
      { id: 'c3', name: 'Maldivian (IAS)', classification: 'CREDIT', openingBalance: -28200000, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 50000000, estimated5DaysSales: 500000, runningBalance: -18200000, outstandingReceipts: 18200000, associatedAirlines: ['Q2', 'Q2700', 'Q2701', 'Q2702'], associatedRegs: ['8Q-IAI', '8Q-IAJ', '8Q-ISD'] },
      { id: 'c4', name: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', openingBalance: -150790, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 20000000, estimated5DaysSales: 200000, runningBalance: -150790, outstandingReceipts: 150790, associatedAirlines: ['NR', 'NR101', 'NR102'], associatedRegs: ['8Q-RAA', '8Q-RAB'] },
      { id: 'c5', name: 'Flyme (Villa Air)', classification: 'CREDIT', openingBalance: 477188, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 15000000, estimated5DaysSales: 150000, runningBalance: 477188, outstandingReceipts: 0, associatedAirlines: ['VP', 'VP201', 'VP202'], associatedRegs: ['8Q-VAH', '8Q-VAI'] },
      { id: 'c6', name: 'Qatar Airways', classification: 'ADVANCE', openingBalance: 151575, paymentsReceived: 500000, advanceBalance: 651575, creditLimit: 0, estimated5DaysSales: 120000, runningBalance: 651575, outstandingReceipts: 0, openingBalanceLiters: 54134, balanceLiters: 232705, associatedAirlines: ['QR', 'QR672', 'QR673'], associatedRegs: ['A7-BCA', 'A7-BCB'] },
      { id: 'c7', name: 'Access Flight Support', classification: 'ADVANCE', openingBalance: 26485, paymentsReceived: 15000, advanceBalance: 41485, creditLimit: 0, estimated5DaysSales: 30000, runningBalance: 41485, outstandingReceipts: 0, associatedAirlines: ['AFS'] },
      { id: 'c8', name: 'AML Global Ltd', classification: 'ADVANCE', openingBalance: 311853, paymentsReceived: 0, advanceBalance: 311853, creditLimit: 0, estimated5DaysSales: 50000, runningBalance: 311853, outstandingReceipts: 0, associatedAirlines: ['AML'] },
      { id: 'c9', name: 'Aviation Services Management', classification: 'CREDIT', openingBalance: -326370, paymentsReceived: 1215191, advanceBalance: 0, creditLimit: 5000000, estimated5DaysSales: 100000, runningBalance: 888821, outstandingReceipts: 0, associatedAirlines: ['ASM'] },
      { id: 'c10', name: 'Mega Airport Services (Cash Agent)', classification: 'CASH', openingBalance: 0, paymentsReceived: 0, advanceBalance: 0, creditLimit: 0, estimated5DaysSales: 0, runningBalance: 0, outstandingReceipts: 0, associatedAirlines: ['MAS', 'CASH'] },
    ];
  });

  // Index customer master database into IndexedDB for offline flight number & aircraft reg resolution
  useEffect(() => {
    fmsDb.indexCustomerMappings(customers).catch(err => {
      console.warn('[MasterDB] Failed to index customer flight/reg mappings:', err);
    });

    // Also map specific aircraft tail numbers to customers
    for (const cust of customers) {
      if (cust.associatedRegs) {
        for (const reg of cust.associatedRegs) {
          fmsDb.mapFlightOrRegToCustomer(reg, cust.id, cust.name, cust.classification, 'AIRCRAFT_REG');
        }
      }
    }
  }, [customers]);

  const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>(() => {
    const saved = localStorage.getItem('fms_fin_upcoming');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'sw1', customerId: 'c1', customerName: 'Emirates Airlines', referenceNumber: 'SW-EMI-998', amount: 150000, uploadDate: '2026-06-01', status: 'PENDING_REVIEW' },
      { id: 'sw2', customerId: 'c6', customerName: 'Qatar Airways', referenceNumber: 'SW-QTR-102', amount: 300000, uploadDate: '2026-06-02', status: 'PENDING_REVIEW' }
    ];
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('fms_fin_invoices');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'inv101', invoiceNumber: 'FFF/2025/2500001322', customerId: 'c4', customerName: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', amount: 98871.90, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remainingAmount: 98871.90 },
      { id: 'inv102', invoiceNumber: 'FFF/2025/2500001323', customerId: 'c5', customerName: 'Flyme (Villa Air)', classification: 'CREDIT', amount: 25000, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remainingAmount: 25000 }
    ];
  });

  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    const saved = localStorage.getItem('fms_fin_receipts');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'rec201', receiptNumber: 'REC-ORCL-091', customerId: 'c3', customerName: 'Maldivian (IAS)', amount: 1649988, date: '2026-06-01', status: 'UNAPPLIED', remainingAmount: 1649988 }
    ];
  });

  const [proformaRegister, setProformaRegister] = useState<ProformaRecord[]>(() => {
    const saved = localStorage.getItem('fms_fin_proforma');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'prof1', date: '2026-05-28', customerId: 'c3', customerName: 'Maldivian (IAS)', amount: 85000, period: 'May 15 - May 30', invoiceNumber: 'PF-2026-010' }
    ];
  });

  // Granular sales uplifts matching Jet Fuel Finance Sheet
  const [fuelRequests, setFuelRequests] = useState<FuelRequest[]>(() => {
    const saved = localStorage.getItem('fms_fin_requests');
    if (saved) return JSON.parse(saved);
    return [
      { 
        id: 'fr1', 
        deliveryNumber: '312385', 
        customerId: 'c1', 
        customerName: 'Emirates Airlines', 
        date: '2026-06-01', 
        quantityLiters: 11059, 
        pricePerLiter: 1.19197, 
        amount: 13182.00, 
        aircraftReg: 'A6ANY', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'AIR ARABIA',
        flightNumber: 'G9094',
        aircraftType: 'A320',
        refuelTimePosition: '07:30',
        refuelTimeCommence: '07:45',
        refuelTimeComplete: '08:20',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 1054.56,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001270'
      },
      { 
        id: 'fr2', 
        deliveryNumber: '312396', 
        customerId: 'c3', 
        customerName: 'Maldivian (IAS)', 
        date: '2026-06-01', 
        quantityLiters: 7791, 
        pricePerLiter: 1.19197, 
        amount: 9286.64, 
        aircraftReg: '9MMVD', 
        status: 'APPROVED',
        categorySector: 'DOM',
        operator: 'MALAYSIAN AIRLINES',
        flightNumber: 'MH486',
        aircraftType: 'B737',
        refuelTimePosition: '08:10',
        refuelTimeCommence: '08:15',
        refuelTimeComplete: '08:45',
        memoLine: 'JET FUEL SALES DOMESTIC',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 742.93,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001271'
      },
      { 
        id: 'fr3', 
        deliveryNumber: '312400', 
        customerId: 'c1', 
        customerName: 'Emirates Airlines', 
        date: '2026-06-01', 
        quantityLiters: 6700, 
        pricePerLiter: 1.19197, 
        amount: 7986.20, 
        aircraftReg: 'A6BMJ', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'ETIHAD AIRWAYS',
        flightNumber: 'EY379',
        aircraftType: 'B787',
        refuelTimePosition: '09:05',
        refuelTimeCommence: '09:12',
        refuelTimeComplete: '09:40',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 638.90,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001272'
      },
      { 
        id: 'fr4', 
        deliveryNumber: '312582', 
        customerId: 'c1', 
        customerName: 'Emirates Airlines', 
        date: '2026-06-02', 
        quantityLiters: 1354, 
        pricePerLiter: 1.19197, 
        amount: 1613.93, 
        aircraftReg: 'A6ARA', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'AIR ARABIA',
        flightNumber: 'G9092',
        aircraftType: 'A320',
        refuelTimePosition: '10:00',
        refuelTimeCommence: '10:05',
        refuelTimeComplete: '10:20',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 129.11,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001273'
      },
      { 
        id: 'fr5', 
        deliveryNumber: '312589', 
        customerId: 'c3', 
        customerName: 'Maldivian (IAS)', 
        date: '2026-06-02', 
        quantityLiters: 10316, 
        pricePerLiter: 1.19197, 
        amount: 12296.36, 
        aircraftReg: '9MMVG', 
        status: 'APPROVED',
        categorySector: 'DOM',
        operator: 'MALAYSIAN AIRLINES',
        flightNumber: 'MH484',
        aircraftType: 'B737',
        refuelTimePosition: '11:15',
        refuelTimeCommence: '11:20',
        refuelTimeComplete: '12:00',
        memoLine: 'JET FUEL SALES DOMESTIC',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 983.71,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001274'
      },
      { 
        id: 'fr6', 
        deliveryNumber: '312591', 
        customerId: 'c2', 
        customerName: 'Singapore Airlines', 
        date: '2026-06-02', 
        quantityLiters: 372, 
        pricePerLiter: 1.19197, 
        amount: 443.41, 
        aircraftReg: 'VTIIO', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'INDIGO',
        flightNumber: '6E1134',
        aircraftType: 'A320',
        refuelTimePosition: '13:00',
        refuelTimeCommence: '13:10',
        refuelTimeComplete: '13:25',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 35.47,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001275'
      }
    ];
  });

  const [varianceLogs, setVarianceLogs] = useState<MonthEndVariance[]>(() => {
    const saved = localStorage.getItem('fms_fin_variances');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'v1', month: 'May 2026', fuelType: 'Jet A-1', fmsStockLiters: 4500000, oracleStockLiters: 4496200, salesQuantityLiters: 3800000, variancePercentage: 0.10, status: 'PENDING_T1', physicalCheckUploaded: false },
      { id: 'v2', month: 'May 2026', fuelType: 'Diesel', fmsStockLiters: 152000, oracleStockLiters: 151720, salesQuantityLiters: 120000, variancePercentage: 0.23, status: 'PENDING_T2', physicalCheckUploaded: false },
      { id: 'v3', month: 'May 2026', fuelType: 'Petrol', fmsStockLiters: 85000, oracleStockLiters: 84680, salesQuantityLiters: 90000, variancePercentage: 0.35, status: 'PENDING_T3', physicalCheckUploaded: false }
    ];
  });

  const [procurementPRs, setProcurementPRs] = useState<ProcurementPR[]>(() => {
    const saved = localStorage.getItem('fms_fin_pr');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'pr1', prNumber: 'PR-2026-05', date: '2026-05-20', fuelType: 'Jet A-1', quantityLiters: 1000000, plattsRate: 85.50, fobValue: 537700, vendorInvoiceVerified: true, poNumber: 'PO-30219', oracleInvoiceNumber: 'ORCL-VND-8871', status: 'AP_ENTERED_ORACLE' },
      { id: 'pr2', prNumber: 'PR-2026-06', date: '2026-06-01', fuelType: 'Jet A-1', quantityLiters: 1500000, plattsRate: 88.20, fobValue: 832000, vendorInvoiceVerified: false, status: 'PR_CONFIRMED' }
    ];
  });

  const [surcharges, setSurcharges] = useState<SurchargeRecord[]>(() => {
    const saved = localStorage.getItem('fms_fin_surcharges');
    if (saved) return JSON.parse(saved);
    return [
      { grnNumber: 'GRN-1092', originalValue: 537700, surchargeAmount: 18500, notes: 'Demurrage and port handling surcharges', date: '2026-05-24' }
    ];
  });

  // Mock Multi products delivery (MPD) matching Maldives Airports spreadsheets
  const [mpdSales, setMpdSales] = useState<MpdSale[]>(() => {
    const saved = localStorage.getItem('fms_fin_mpd');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'm1', deliveryNo: '79195', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'C1123', dieselLiters: 22.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 385.88, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm2', deliveryNo: '79196', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'ST20', dieselLiters: 46.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 811.44, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm3', deliveryNo: '79197', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'ST17', dieselLiters: 45.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 789.30, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm4', deliveryNo: '79198', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'C9723', dieselLiters: 0, petrolLiters: 15.00, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 0, amountPetrol: 307.50, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm5', deliveryNo: '79199', date: '2026-05-31', customerName: 'Island Aviation Services Limited', operatorName: 'ISLAND AVIATION', regNo: 'C1210', dieselLiters: 0, petrolLiters: 47.00, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 0, amountPetrol: 963.50, invoiceNumber: '2500000160', classification: 'CREDIT', type: 'AIRSIDE', cogsAccount: 'ISSUES' }
    ];
  });

  // Mock Customs Duty Summary Shipments matching Maldives Airports
  const [customsShipments, setCustomsShipments] = useState<CustomsShipment[]>(() => {
    const saved = localStorage.getItem('fms_fin_customs');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'cs1', shipmentNumber: 'MACL-JET-2026-01', bFormNumber: 'B-FORM-8871', arrivalDate: '2026-05-15', quantityLiters: 1000000, fobValue: 537700, conversionFactor: '1 MT = 1,250 Liters', metricTons: 800, dutyPaid: 26885, royaltyRatePercent: 5, royaltyAmount: 26885 },
      { id: 'cs2', shipmentNumber: 'MACL-JET-2026-02', bFormNumber: 'B-FORM-9022', arrivalDate: '2026-06-01', quantityLiters: 1500000, fobValue: 832000, conversionFactor: '1 MT = 1,250 Liters', metricTons: 1200, dutyPaid: 41600, royaltyRatePercent: 5, royaltyAmount: 41600 }
    ];
  });

  // Sync state changes to local storage for persistence in mock environment
  useEffect(() => {
    localStorage.setItem('fms_fin_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('fms_fin_upcoming', JSON.stringify(upcomingPayments));
  }, [upcomingPayments]);

  useEffect(() => {
    localStorage.setItem('fms_fin_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('fms_fin_receipts', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    localStorage.setItem('fms_fin_proforma', JSON.stringify(proformaRegister));
  }, [proformaRegister]);

  useEffect(() => {
    localStorage.setItem('fms_fin_requests', JSON.stringify(fuelRequests));
  }, [fuelRequests]);

  useEffect(() => {
    localStorage.setItem('fms_fin_variances', JSON.stringify(varianceLogs));
  }, [varianceLogs]);

  useEffect(() => {
    localStorage.setItem('fms_fin_pr', JSON.stringify(procurementPRs));
  }, [procurementPRs]);

  useEffect(() => {
    localStorage.setItem('fms_fin_surcharges', JSON.stringify(surcharges));
  }, [surcharges]);

  useEffect(() => {
    localStorage.setItem('fms_fin_mpd', JSON.stringify(mpdSales));
  }, [mpdSales]);

  useEffect(() => {
    localStorage.setItem('fms_fin_customs', JSON.stringify(customsShipments));
  }, [customsShipments]);

  // Load from Supabase on login
  const refreshData = useCallback(async () => {
    if (!user) return;
    try {
      const [
        fetchedCusts,
        fetchedUpcoming,
        fetchedInvoices,
        fetchedReceipts,
        fetchedProforma,
        fetchedRequests,
        fetchedVariances,
        fetchedPRs,
        fetchedSurcharges,
        fetchedMpd,
        fetchedCustoms
      ] = await Promise.all([
        supabaseService.getFinCustomers(),
        supabaseService.getFinUpcomingPayments(),
        supabaseService.getFinInvoices(),
        supabaseService.getFinReceipts(),
        supabaseService.getFinProformaRegister(),
        supabaseService.getFinFuelRequests(),
        supabaseService.getFinVarianceLogs(),
        supabaseService.getFinProcurementPRs(),
        supabaseService.getFinSurcharges(),
        supabaseService.getFinMpdSales(),
        supabaseService.getFinCustomsShipments()
      ]);

      if (fetchedCusts && fetchedCusts.length > 0) setCustomers(fetchedCusts);
      if (fetchedUpcoming && fetchedUpcoming.length > 0) setUpcomingPayments(fetchedUpcoming);
      if (fetchedInvoices && fetchedInvoices.length > 0) setInvoices(fetchedInvoices);
      if (fetchedReceipts && fetchedReceipts.length > 0) setReceipts(fetchedReceipts);
      if (fetchedProforma && fetchedProforma.length > 0) setProformaRegister(fetchedProforma);
      if (fetchedRequests && fetchedRequests.length > 0) setFuelRequests(fetchedRequests);
      if (fetchedVariances && fetchedVariances.length > 0) setVarianceLogs(fetchedVariances);
      if (fetchedPRs && fetchedPRs.length > 0) setProcurementPRs(fetchedPRs);
      if (fetchedSurcharges && fetchedSurcharges.length > 0) setSurcharges(fetchedSurcharges);
      if (fetchedMpd && fetchedMpd.length > 0) setMpdSales(fetchedMpd);
      if (fetchedCustoms && fetchedCustoms.length > 0) setCustomsShipments(fetchedCustoms);
    } catch (error) {
      console.error('Error refreshing finance data:', error);
    }
  }, [user]);

  // Sync with Supabase when user logs in
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  // Upload SWIFT Payment copies by a customer
  const uploadSwiftCopy = (customerId: string, referenceNumber: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newPayment: UpcomingPayment = {
      id: `sw-${Date.now()}`,
      customerId,
      customerName: customer.name,
      referenceNumber,
      amount,
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'PENDING_REVIEW',
      swiftCopyUrl: 'swift_copy.pdf'
    };

    setUpcomingPayments(prev => [newPayment, ...prev]);

    if (user) {
      supabaseService.createFinUpcomingPayment(newPayment).catch(err => {
        console.error('Failed to upload swift copy to Supabase:', err);
      });
    }
  };

  // Review SWIFT by Billing Team
  const reviewSwiftCopy = (paymentId: string, action: 'APPROVE' | 'REJECT') => {
    const targetPayment = upcomingPayments.find(p => p.id === paymentId);
    if (!targetPayment) return;

    const updatedStatus = action === 'APPROVE' ? 'APPROVED' : 'PENDING_REVIEW';
    
    setUpcomingPayments(prev => 
      prev.map(p => {
        if (p.id === paymentId) {
          return { ...p, status: updatedStatus as any };
        }
        return p;
      }).filter(p => !(action === 'REJECT' && p.id === paymentId))
    );

    if (action === 'APPROVE') {
      setCustomers(custs => 
        custs.map(c => {
          if (c.id === targetPayment.customerId && c.classification === 'ADVANCE') {
            const updatedBalance = c.advanceBalance + targetPayment.amount;
            const updatedCust = { ...c, advanceBalance: updatedBalance, runningBalance: updatedBalance };
            if (user) {
              supabaseService.upsertFinCustomers([updatedCust]).catch(err => console.error(err));
            }
            return updatedCust;
          }
          return c;
        })
      );
    }

    if (user) {
      if (action === 'REJECT') {
        Promise.resolve(supabase.from('fin_upcoming_payments').delete().eq('id', paymentId)).catch(err => console.error(err));
      } else {
        supabaseService.updateFinUpcomingPayment(paymentId, { status: updatedStatus }).catch(err => console.error(err));
      }
    }
  };

  // Sync actual cleared payments entered in Oracle
  const syncOracleReceipt = (customerId: string, referenceNumber: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newReceipt: Receipt = {
      id: `rec-${Date.now()}`,
      receiptNumber: `REC-${referenceNumber}`,
      customerId,
      customerName: customer.name,
      amount,
      date: new Date().toISOString().split('T')[0],
      status: 'UNAPPLIED',
      remainingAmount: amount
    };

    setReceipts(prev => [newReceipt, ...prev]);

    if (user) {
      supabaseService.createFinReceipt(newReceipt).catch(err => console.error(err));
    }

    const swift = upcomingPayments.find(p => p.customerId === customerId && p.referenceNumber === referenceNumber);
    if (swift) {
      setUpcomingPayments(prev => prev.filter(p => p.id !== swift.id));
      if (user) {
        Promise.resolve(supabase.from('fin_upcoming_payments').delete().eq('id', swift.id)).catch(err => console.error(err));
      }
    } else {
      setCustomers(custs => 
        custs.map(c => {
          if (c.id === customerId) {
            const updatedBal = c.advanceBalance + amount;
            const updatedCust = { ...c, advanceBalance: updatedBal, runningBalance: updatedBal };
            if (user) {
              supabaseService.upsertFinCustomers([updatedCust]).catch(err => console.error(err));
            }
            return updatedCust;
          }
          return c;
        })
      );
    }
  };

  // Fuel request validator
  const submitFuelRequest = (customerId: string, quantityLiters: number, aircraftReg: string, options?: Partial<FuelRequest>) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return { success: false, message: 'Customer account not found.' };

    const pricePerLiter = 1.19197; 
    const amount = quantityLiters * pricePerLiter;

    if (customer.classification === 'ADVANCE') {
      if (customer.advanceBalance < amount) {
        const remaining = customer.advanceBalance;
        const short = amount - remaining;
        
        const newReq: FuelRequest = {
          id: `fr-${Date.now()}`,
          deliveryNumber: `${Math.floor(312000 + Math.random() * 9000)}`,
          customerId,
          customerName: customer.name,
          date: new Date().toISOString().split('T')[0],
          quantityLiters,
          pricePerLiter,
          amount,
          aircraftReg,
          status: 'BLOCKED_INSUFFICIENT_FUNDS',
          categorySector: options?.categorySector || 'INT',
          operator: options?.operator || customer.name.toUpperCase(),
          flightNumber: options?.flightNumber || 'SQ432',
          aircraftType: options?.aircraftType || 'A350',
          refuelTimePosition: '14:20',
          refuelTimeCommence: '14:30',
          refuelTimeComplete: '15:10',
          memoLine: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circularRate: pricePerLiter,
          discounts: 0,
          gst: amount * 0.08,
          transactionType: 'ISSUES',
          cogsAccount: 'ISSUES'
        };
        setFuelRequests(prev => [newReq, ...prev]);
        if (user) {
          supabaseService.createFinFuelRequest(newReq).catch(err => console.error(err));
        }

        return {
          success: false,
          message: `Insufficient Funds! Total request is $${amount.toLocaleString()} but your remaining balance is $${remaining.toLocaleString()}. Please upload a SWIFT Copy for $${short.toLocaleString()} or contact billing.`
        };
      } else {
        const updatedCusts: CustomerAccount[] = [];
        setCustomers(prev => 
          prev.map(c => {
            if (c.id === customerId) {
              const updatedBal = c.advanceBalance - amount;
              const updated = { ...c, advanceBalance: updatedBal, runningBalance: updatedBal };
              updatedCusts.push(updated);
              return updated;
            }
            return c;
          })
        );

        const newReq: FuelRequest = {
          id: `fr-${Date.now()}`,
          deliveryNumber: `${Math.floor(312000 + Math.random() * 9000)}`,
          customerId,
          customerName: customer.name,
          date: new Date().toISOString().split('T')[0],
          quantityLiters,
          pricePerLiter,
          amount,
          aircraftReg,
          status: 'APPROVED',
          categorySector: options?.categorySector || 'INT',
          operator: options?.operator || customer.name.toUpperCase(),
          flightNumber: options?.flightNumber || 'SQ432',
          aircraftType: options?.aircraftType || 'A350',
          refuelTimePosition: '14:20',
          refuelTimeCommence: '14:30',
          refuelTimeComplete: '15:10',
          memoLine: 'JET FUEL SALES DEC 2025',
          currency: 'USD',
          circularRate: pricePerLiter,
          discounts: 0,
          gst: amount * 0.08,
          transactionType: 'ISSUES',
          cogsAccount: 'ISSUES',
          invoiceNumber: `FFF/2025/250000${Math.floor(1200 + Math.random() * 200)}`
        };
        setFuelRequests(prev => [newReq, ...prev]);

        if (user) {
          supabaseService.createFinFuelRequest(newReq).catch(err => console.error(err));
          if (updatedCusts.length > 0) {
            supabaseService.upsertFinCustomers(updatedCusts).catch(err => console.error(err));
          }
        }

        return { success: true, message: `Fuel Request approved! $${amount.toLocaleString()} has been reserved. Dispatch in progress.` };
      }
    } else if (customer.classification === 'CREDIT') {
      const debt = Math.abs(customer.runningBalance < 0 ? customer.runningBalance : 0);
      if (debt + amount > customer.creditLimit) {
        return { success: false, message: `Credit Limit Exceeded! Current outstanding is $${debt.toLocaleString()} + new request $${amount.toLocaleString()} exceeds your $${customer.creditLimit.toLocaleString()} limit.` };
      }

      const updatedCusts: CustomerAccount[] = [];
      setCustomers(prev => 
        prev.map(c => {
          if (c.id === customerId) {
            const updated = { ...c, runningBalance: c.runningBalance - amount };
            updatedCusts.push(updated);
            return updated;
          }
          return c;
        })
      );

      const newReq: FuelRequest = {
        id: `fr-${Date.now()}`,
        deliveryNumber: `${Math.floor(312000 + Math.random() * 9000)}`,
        customerId,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        quantityLiters,
        pricePerLiter,
        amount,
        aircraftReg,
        status: 'APPROVED',
        categorySector: options?.categorySector || 'DOM',
        operator: options?.operator || customer.name.toUpperCase(),
        flightNumber: options?.flightNumber || 'Q2-104',
        aircraftType: options?.aircraftType || 'Dash 8',
        refuelTimePosition: '16:00',
        refuelTimeCommence: '16:05',
        refuelTimeComplete: '16:30',
        memoLine: 'JET FUEL SALES DOMESTIC',
        currency: 'USD',
        circularRate: pricePerLiter,
        discounts: 0,
        gst: amount * 0.08,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: `FFF/2025/250000${Math.floor(1200 + Math.random() * 200)}`
      };
      setFuelRequests(prev => [newReq, ...prev]);

      if (user) {
        supabaseService.createFinFuelRequest(newReq).catch(err => console.error(err));
        if (updatedCusts.length > 0) {
          supabaseService.upsertFinCustomers(updatedCusts).catch(err => console.error(err));
        }
      }

      return { success: true, message: `Credit Uplift approved! Fuel delivery registered. Invoicing will trigger in the next periodic run.` };
    } else {
      const newReq: FuelRequest = {
        id: `fr-${Date.now()}`,
        deliveryNumber: `${Math.floor(312000 + Math.random() * 9000)}`,
        customerId,
        customerName: customer.name,
        date: new Date().toISOString().split('T')[0],
        quantityLiters,
        pricePerLiter,
        amount,
        aircraftReg,
        status: 'APPROVED',
        categorySector: options?.categorySector || 'DOM',
        operator: options?.operator || customer.name.toUpperCase(),
        flightNumber: options?.flightNumber || 'CASH-9',
        aircraftType: options?.aircraftType || 'Private',
        refuelTimePosition: '17:10',
        refuelTimeCommence: '17:20',
        refuelTimeComplete: '17:40',
        memoLine: 'IMMEDIATE CASH SALE',
        currency: 'USD',
        circularRate: pricePerLiter,
        discounts: 0,
        gst: amount * 0.08,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: `FFF/2025/250000${Math.floor(1200 + Math.random() * 200)}`
      };
      setFuelRequests(prev => [newReq, ...prev]);

      if (user) {
        supabaseService.createFinFuelRequest(newReq).catch(err => console.error(err));
      }
      
      setTimeout(() => {
        runBillingProcess('CASH');
      }, 500);

      return { success: true, message: `Cash fueling request authorized. Invoices immediately generated in Oracle, notifications routed to cash desk.` };
    }
  };

  // Periodic Billing Runs (Advance: weekly, Credit: fortnight/monthly, Cash: Immediate)
  const runBillingProcess = (classification: CustomerClassification) => {
    const targetRequests = fuelRequests.filter(fr => {
      const cust = customers.find(c => c.id === fr.customerId);
      return cust && cust.classification === classification && fr.status === 'APPROVED';
    });

    if (targetRequests.length === 0) return;

    const grouped: Record<string, typeof targetRequests> = {};
    targetRequests.forEach(r => {
      if (!grouped[r.customerId]) grouped[r.customerId] = [];
      grouped[r.customerId].push(r);
    });

    const newInvoices: Invoice[] = [];
    Object.entries(grouped).forEach(([customerId, reqs]) => {
      const totalAmount = reqs.reduce((sum, r) => sum + r.amount, 0);
      const customer = customers.find(c => c.id === customerId)!;
      const invNum = `FFF/2025/250000${Math.floor(1200 + Math.random() * 200)}`;

      newInvoices.push({
        id: `inv-${Date.now()}-${customerId}`,
        invoiceNumber: invNum,
        customerId,
        customerName: customer.name,
        classification,
        amount: totalAmount,
        period: classification === 'ADVANCE' ? 'Weekly Uplifts' : classification === 'CREDIT' ? 'Monthly Accumulation' : 'Immediate Cash Run',
        date: new Date().toISOString().split('T')[0],
        status: 'UNPAID',
        remainingAmount: totalAmount
      });
    });

    setInvoices(prev => [...newInvoices, ...prev]);
    if (user) {
      supabaseService.upsertFinInvoices(newInvoices).catch(err => console.error(err));
    }
  };

  // FIFO Application of receipts against invoices
  const applyFIFOLogic = () => {
    let activeInvoices = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let activeReceipts = [...receipts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let modified = false;

    activeReceipts = activeReceipts.map(rec => {
      if (rec.remainingAmount <= 0) return rec;

      activeInvoices = activeInvoices.map(inv => {
        if (inv.customerId !== rec.customerId || inv.remainingAmount <= 0 || rec.remainingAmount <= 0) return inv;

        const applyAmount = Math.min(inv.remainingAmount, rec.remainingAmount);
        inv.remainingAmount -= applyAmount;
        rec.remainingAmount -= applyAmount;
        
        inv.status = inv.remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        rec.status = rec.remainingAmount <= 0 ? 'APPLIED' : 'PARTIALLY_APPLIED';
        modified = true;

        return inv;
      });

      return rec;
    });

    if (modified) {
      setInvoices(activeInvoices);
      setReceipts(activeReceipts);

      if (user) {
        supabaseService.upsertFinInvoices(activeInvoices).catch(err => console.error(err));
        supabaseService.upsertFinReceipts(activeReceipts).catch(err => console.error(err));
      }
    }
  };

  // Proforma Invoicing Register generator
  const generateProforma = (customerId: string, period: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const newRecord: ProformaRecord = {
      id: `prof-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      customerId,
      customerName: customer.name,
      amount,
      period,
      invoiceNumber: `PF-2026-${Math.floor(100 + Math.random() * 900)}`
    };

    setProformaRegister(prev => [newRecord, ...prev]);

    if (user) {
      supabaseService.createFinProforma(newRecord).catch(err => console.error(err));
    }
  };

  // Month-end Stock Variance Approval Hierarchies
  const approveVariance = (varianceId: string, notes?: string, physicalCheckFile?: boolean) => {
    let targetLog: MonthEndVariance | null = null;
    setVarianceLogs(prev => 
      prev.map(v => {
        if (v.id === varianceId) {
          if (v.status === 'PENDING_T3' && !v.physicalCheckUploaded && !physicalCheckFile) {
            return v; 
          }
          const updated = {
            ...v,
            status: 'APPROVED' as const,
            physicalCheckUploaded: physicalCheckFile || v.physicalCheckUploaded,
            notes: notes || v.notes
          };
          targetLog = updated;
          return updated;
        }
        return v;
      })
    );

    if (user && targetLog) {
      supabaseService.updateFinVarianceLog(varianceId, targetLog).catch(err => console.error(err));
    }
  };

  // Procurement Workflow Mocks
  const createProcurementPR = (fuelType: string, quantityLiters: number, plattsRate: number) => {
    const barrelVolume = 159; 
    const barrels = quantityLiters / barrelVolume;
    const fobValue = Math.round(barrels * plattsRate);

    const newPR: ProcurementPR = {
      id: `pr-${Date.now()}`,
      prNumber: `PR-2026-${Math.floor(10 + Math.random() * 90)}`,
      date: new Date().toISOString().split('T')[0],
      fuelType,
      quantityLiters,
      plattsRate,
      fobValue,
      vendorInvoiceVerified: false,
      status: 'PR_CONFIRMED'
    };

    setProcurementPRs(prev => [newPR, ...prev]);

    if (user) {
      supabaseService.createFinProcurementPR(newPR).catch(err => console.error(err));
    }
  };

  const verifyVendorInvoice = (prId: string) => {
    let targetPR: ProcurementPR | null = null;
    setProcurementPRs(prev => 
      prev.map(pr => {
        if (pr.id === prId) {
          const updated = { ...pr, vendorInvoiceVerified: true, status: 'INVOICE_VERIFIED' as const };
          targetPR = updated;
          return updated;
        }
        return pr;
      })
    );

    if (user && targetPR) {
      supabaseService.updateFinProcurementPR(prId, targetPR).catch(err => console.error(err));
    }
  };

  const raisePO = (prId: string, poNumber: string) => {
    let targetPR: ProcurementPR | null = null;
    setProcurementPRs(prev => 
      prev.map(pr => {
        if (pr.id === prId) {
          const updated = { ...pr, poNumber, status: 'PO_RAISED' as const };
          targetPR = updated;
          return updated;
        }
        return pr;
      })
    );

    if (user && targetPR) {
      supabaseService.updateFinProcurementPR(prId, targetPR).catch(err => console.error(err));
    }
  };

  const enterAPInvoice = (prId: string, oracleInvoiceNumber: string) => {
    let targetPR: ProcurementPR | null = null;
    setProcurementPRs(prev => 
      prev.map(pr => {
        if (pr.id === prId) {
          const updated = { ...pr, oracleInvoiceNumber, status: 'AP_ENTERED_ORACLE' as const };
          targetPR = updated;
          return updated;
        }
        return pr;
      })
    );

    if (user && targetPR) {
      supabaseService.updateFinProcurementPR(prId, targetPR).catch(err => console.error(err));
    }
  };

  const addSurcharge = (grnNumber: string, amount: number, notes: string) => {
    const prMatch = procurementPRs.find(p => p.poNumber === grnNumber || p.prNumber === grnNumber);
    const originalValue = prMatch ? prMatch.fobValue : 500000;

    const newSurcharge: SurchargeRecord = {
      grnNumber,
      originalValue,
      surchargeAmount: amount,
      notes,
      date: new Date().toISOString().split('T')[0]
    };

    setSurcharges(prev => [newSurcharge, ...prev]);

    if (user) {
      supabaseService.createFinSurcharge(newSurcharge).catch(err => console.error(err));
    }
  };

  const resetAllFinanceMockData = () => {
    localStorage.removeItem('fms_fin_customers');
    localStorage.removeItem('fms_fin_upcoming');
    localStorage.removeItem('fms_fin_invoices');
    localStorage.removeItem('fms_fin_receipts');
    localStorage.removeItem('fms_fin_proforma');
    localStorage.removeItem('fms_fin_requests');
    localStorage.removeItem('fms_fin_variances');
    localStorage.removeItem('fms_fin_pr');
    localStorage.removeItem('fms_fin_surcharges');
    localStorage.removeItem('fms_fin_mpd');
    localStorage.removeItem('fms_fin_customs');
    
    // Hard Reload mock lists
    setCustomers([
      { id: 'c1', name: 'Emirates Airlines', classification: 'ADVANCE', openingBalance: 280000, paymentsReceived: 150000, advanceBalance: 430000, creditLimit: 0, estimated5DaysSales: 150000, runningBalance: 430000, outstandingReceipts: 0, openingBalanceLiters: 100000, balanceLiters: 153571 },
      { id: 'c2', name: 'Singapore Airlines', classification: 'ADVANCE', openingBalance: 175712, paymentsReceived: 220000, advanceBalance: 395712, creditLimit: 0, estimated5DaysSales: 80000, runningBalance: 395712, outstandingReceipts: 0, openingBalanceLiters: 62754, balanceLiters: 141325 },
      { id: 'c3', name: 'Maldivian (IAS)', classification: 'CREDIT', openingBalance: -28200000, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 50000000, estimated5DaysSales: 500000, runningBalance: -18200000, outstandingReceipts: 18200000 },
      { id: 'c4', name: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', openingBalance: -150790, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 20000000, estimated5DaysSales: 200000, runningBalance: -150790, outstandingReceipts: 150790 },
      { id: 'c5', name: 'Flyme (Villa Air)', classification: 'CREDIT', openingBalance: 477188, paymentsReceived: 10000000, advanceBalance: 0, creditLimit: 15000000, estimated5DaysSales: 150000, runningBalance: 477188, outstandingReceipts: 0 },
      { id: 'c6', name: 'Qatar Airways', classification: 'ADVANCE', openingBalance: 151575, paymentsReceived: 500000, advanceBalance: 651575, creditLimit: 0, estimated5DaysSales: 120000, runningBalance: 651575, outstandingReceipts: 0, openingBalanceLiters: 54134, balanceLiters: 232705 },
      { id: 'c7', name: 'Access Flight Support', classification: 'ADVANCE', openingBalance: 26485, paymentsReceived: 15000, advanceBalance: 41485, creditLimit: 0, estimated5DaysSales: 30000, runningBalance: 41485, outstandingReceipts: 0 },
      { id: 'c8', name: 'AML Global Ltd', classification: 'ADVANCE', openingBalance: 311853, paymentsReceived: 0, advanceBalance: 311853, creditLimit: 0, estimated5DaysSales: 50000, runningBalance: 311853, outstandingReceipts: 0 },
      { id: 'c9', name: 'Aviation Services Management', classification: 'CREDIT', openingBalance: -326370, paymentsReceived: 1215191, advanceBalance: 0, creditLimit: 5000000, estimated5DaysSales: 100000, runningBalance: 888821, outstandingReceipts: 0 },
      { id: 'c10', name: 'Mega Airport Services (Cash Agent)', classification: 'CASH', openingBalance: 0, paymentsReceived: 0, advanceBalance: 0, creditLimit: 0, estimated5DaysSales: 0, runningBalance: 0, outstandingReceipts: 0 },
    ]);
    setUpcomingPayments([
      { id: 'sw1', customerId: 'c1', customerName: 'Emirates Airlines', referenceNumber: 'SW-EMI-998', amount: 150000, uploadDate: '2026-06-01', status: 'PENDING_REVIEW' },
      { id: 'sw2', customerId: 'c6', customerName: 'Qatar Airways', referenceNumber: 'SW-QTR-102', amount: 300000, uploadDate: '2026-06-02', status: 'PENDING_REVIEW' }
    ]);
    setInvoices([
      { id: 'inv101', invoiceNumber: 'FFF/2025/2500001322', customerId: 'c4', customerName: 'Manta Aviation Pvt Ltd', classification: 'CREDIT', amount: 98871.90, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remainingAmount: 98871.90 },
      { id: 'inv102', invoiceNumber: 'FFF/2025/2500001323', customerId: 'c5', customerName: 'Flyme (Villa Air)', classification: 'CREDIT', amount: 25000, period: 'May 15 - May 30', date: '2026-05-16', status: 'UNPAID', remainingAmount: 25000 }
    ]);
    setReceipts([
      { id: 'rec201', receiptNumber: 'REC-ORCL-091', customerId: 'c3', customerName: 'Maldivian (IAS)', amount: 1649988, date: '2026-06-01', status: 'UNAPPLIED', remainingAmount: 1649988 }
    ]);
    setProformaRegister([
      { id: 'prof1', date: '2026-05-28', customerId: 'c3', customerName: 'Maldivian (IAS)', amount: 85000, period: 'May 15 - May 30', invoiceNumber: 'PF-2026-010' }
    ]);
    setFuelRequests([
      { 
        id: 'fr1', 
        deliveryNumber: '312385', 
        customerId: 'c1', 
        customerName: 'Emirates Airlines', 
        date: '2026-06-01', 
        quantityLiters: 11059, 
        pricePerLiter: 1.19197, 
        amount: 13182.00, 
        aircraftReg: 'A6ANY', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'AIR ARABIA',
        flightNumber: 'G9094',
        aircraftType: 'A320',
        refuelTimePosition: '07:30',
        refuelTimeCommence: '07:45',
        refuelTimeComplete: '08:20',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 1054.56,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001270'
      },
      { 
        id: 'fr2', 
        deliveryNumber: '312396', 
        customerId: 'c3', 
        customerName: 'Maldivian (IAS)', 
        date: '2026-06-01', 
        quantityLiters: 7791, 
        pricePerLiter: 1.19197, 
        amount: 9286.64, 
        aircraftReg: '9MMVD', 
        status: 'APPROVED',
        categorySector: 'DOM',
        operator: 'MALAYSIAN AIRLINES',
        flightNumber: 'MH486',
        aircraftType: 'B737',
        refuelTimePosition: '08:10',
        refuelTimeCommence: '08:15',
        refuelTimeComplete: '08:45',
        memoLine: 'JET FUEL SALES DOMESTIC',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 742.93,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001271'
      },
      { 
        id: 'fr3', 
        deliveryNumber: '312400', 
        customerId: 'c1', 
        customerName: 'Emirates Airlines', 
        date: '2026-06-01', 
        quantityLiters: 6700, 
        pricePerLiter: 1.19197, 
        amount: 7986.20, 
        aircraftReg: 'A6BMJ', 
        status: 'APPROVED',
        categorySector: 'INT',
        operator: 'ETIHAD AIRWAYS',
        flightNumber: 'EY379',
        aircraftType: 'B787',
        refuelTimePosition: '09:05',
        refuelTimeCommence: '09:12',
        refuelTimeComplete: '09:40',
        memoLine: 'JET FUEL SALES DEC 2025',
        currency: 'USD',
        circularRate: 1.19197,
        discounts: 0,
        gst: 638.90,
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: 'FFF/2025/2500001272'
      }
    ]);
    setVarianceLogs([
      { id: 'v1', month: 'May 2026', fuelType: 'Jet A-1', fmsStockLiters: 4500000, oracleStockLiters: 4496200, salesQuantityLiters: 3800000, variancePercentage: 0.10, status: 'PENDING_T1', physicalCheckUploaded: false },
      { id: 'v2', month: 'May 2026', fuelType: 'Diesel', fmsStockLiters: 152000, oracleStockLiters: 151720, salesQuantityLiters: 120000, variancePercentage: 0.23, status: 'PENDING_T2', physicalCheckUploaded: false },
      { id: 'v3', month: 'May 2026', fuelType: 'Petrol', fmsStockLiters: 85000, oracleStockLiters: 84680, salesQuantityLiters: 90000, variancePercentage: 0.35, status: 'PENDING_T3', physicalCheckUploaded: false }
    ]);
    setProcurementPRs([
      { id: 'pr1', prNumber: 'PR-2026-05', date: '2026-05-20', fuelType: 'Jet A-1', quantityLiters: 1000000, plattsRate: 85.50, fobValue: 537700, vendorInvoiceVerified: true, poNumber: 'PO-30219', oracleInvoiceNumber: 'ORCL-VND-8871', status: 'AP_ENTERED_ORACLE' },
      { id: 'pr2', prNumber: 'PR-2026-06', date: '2026-06-01', fuelType: 'Jet A-1', quantityLiters: 1500000, plattsRate: 88.20, fobValue: 832000, vendorInvoiceVerified: false, status: 'PR_CONFIRMED' }
    ]);
    setSurcharges([
      { grnNumber: 'GRN-1092', originalValue: 537700, surchargeAmount: 18500, notes: 'Demurrage and port handling surcharges', date: '2026-05-24' }
    ]);
    setMpdSales([
      { id: 'm1', deliveryNo: '79195', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'C1123', dieselLiters: 22.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 385.88, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm2', deliveryNo: '79196', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'ST20', dieselLiters: 46.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 811.44, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm3', deliveryNo: '79197', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'ST17', dieselLiters: 45.00, petrolLiters: 0, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 789.30, amountPetrol: 0, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm4', deliveryNo: '79198', date: '2026-05-31', customerName: 'Maldives Transport and Contracting Co PLC', operatorName: 'INTERNAL TRANSPORT SERVICES', regNo: 'C9723', dieselLiters: 0, petrolLiters: 15.00, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 0, amountPetrol: 307.50, invoiceNumber: 'Own Use', classification: 'CREDIT', type: 'LANDSIDE', cogsAccount: 'OWN' },
      { id: 'm5', deliveryNo: '79199', date: '2026-05-31', customerName: 'Island Aviation Services Limited', operatorName: 'ISLAND AVIATION', regNo: 'C1210', dieselLiters: 0, petrolLiters: 47.00, rateDiesel: 17.54, ratePetrol: 20.50, amountDiesel: 0, amountPetrol: 963.50, invoiceNumber: '2500000160', classification: 'CREDIT', type: 'AIRSIDE', cogsAccount: 'ISSUES' }
    ]);
    setCustomsShipments([
      { id: 'cs1', shipmentNumber: 'MACL-JET-2026-01', bFormNumber: 'B-FORM-8871', arrivalDate: '2026-05-15', quantityLiters: 1000000, fobValue: 537700, conversionFactor: '1 MT = 1,250 Liters', metricTons: 800, dutyPaid: 26885, royaltyRatePercent: 5, royaltyAmount: 26885 },
      { id: 'cs2', shipmentNumber: 'MACL-JET-2026-02', bFormNumber: 'B-FORM-9022', arrivalDate: '2026-06-01', quantityLiters: 1500000, fobValue: 832000, conversionFactor: '1 MT = 1,250 Liters', metricTons: 1200, dutyPaid: 41600, royaltyRatePercent: 5, royaltyAmount: 41600 }
    ]);
  };

  return (
    <FinanceDataContext.Provider value={{
      customers,
      upcomingPayments,
      invoices,
      receipts,
      proformaRegister,
      fuelRequests,
      varianceLogs,
      procurementPRs,
      surcharges,
      mpdSales,
      customsShipments,
      
      // Actions
      uploadSwiftCopy,
      reviewSwiftCopy,
      syncOracleReceipt,
      submitFuelRequest,
      runBillingProcess,
      applyFIFOLogic,
      generateProforma,
      approveVariance,
      createProcurementPR,
      verifyVendorInvoice,
      raisePO,
      enterAPInvoice,
      addSurcharge,
      resetAllFinanceMockData
    }}>
      {children}
    </FinanceDataContext.Provider>
  );
};

export const useFinanceData = () => {
  const context = useContext(FinanceDataContext);
  if (context === undefined) {
    throw new Error('useFinanceData must be used within a FinanceDataProvider');
  }
  return context;
};
