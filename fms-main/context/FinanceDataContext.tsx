import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, User, FlightLog } from '../types';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';
import { fmsDb } from '../services/db';
import { serverTimeService } from '../services/serverTimeService';

export type CustomerClassification = 'ADVANCE' | 'CREDIT' | 'CASH';

export type CustomerCategory =
  | 'ADVANCE_INT_USD'
  | 'ADVANCE_DOM_USD'
  | 'ADVANCE_DOM_MVR'
  | 'IAS_CREDIT'
  | 'CREDIT_GENERAL';

export interface FuelRateRecord {
  id: string;
  category: 'INT' | 'SEAPLANE' | 'DOM' | 'IAS_DISCOUNT' | 'AIRLINE_CUSTOM';
  airlineOrSector: string;
  effectiveDate: string;
  rateUsd: number;
  rateMvr: number;
  currency: 'USD' | 'MVR';
  notes?: string;
  active?: boolean;
}

export interface AirlineHolding {
  code: string;               // Airline IATA/ICAO prefix e.g. 'EK', 'SQ', 'Q2', 'BA', 'EY'
  name: string;               // Full airline name e.g. 'Emirates', 'British Airways'
  flightJobEmails: string[];  // Emails to receive flight job dispatches
  billingEmails: string[];    // Emails to receive signed fuel delivery tickets & invoices
  aircraftRegs?: string[];    // Dedicated aircraft registrations for this airline
  autoSendFlightJob?: boolean;
  autoSendInvoice?: boolean;
}

export interface CustomerAccount {
  id: string;
  name: string;
  classification: CustomerClassification;
  category?: CustomerCategory;
  currency?: 'USD' | 'MVR';
  openingBalance: number;       // USD or MVR
  paymentsReceived: number;     // USD or MVR
  advanceBalance: number;       // Current running balance for pre-pay
  creditLimit: number;          // Credit limit
  estimated5DaysSales: number;   // 5-day sales estimate
  associatedAirlines?: string[]; // Third-party agent links or flight prefixes (e.g. EK, SQ, Q2)
  associatedRegs?: string[];     // Aircraft registrations (e.g. A6-EEO, 8Q-IAI)
  accountEmails?: string[];      // Primary account-level billing/ops emails
  airlineHoldings?: AirlineHolding[]; // Structured airlines held by this account + per-airline emails
  defaultPricePerLiter?: number; // Default circular rate USD/L
  autoDeductOnUplift?: boolean;  // Real-time deduction enabled when flight jobs / logs are entered
  outstandingReceipts: number;   //
  runningBalance: number;       //
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

export interface RealTimeDeductionEvent {
  id: string;
  timestamp: string;
  deliveryNumber: string;
  flightNumber: string;
  airlineName: string;
  customerId: string;
  customerName: string;
  classification: CustomerClassification;
  volumeLiters: number;
  amountDeducted: number;
  previousBalance: number;
  newBalance: number;
  emailsNotified: string[];
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
  realtimeDeductions: RealTimeDeductionEvent[];
  
  // Actions
  uploadSwiftCopy: (customerId: string, referenceNumber: string, amount: number) => void;
  reviewSwiftCopy: (paymentId: string, action: 'APPROVE' | 'REJECT') => void;
  syncOracleReceipt: (customerId: string, referenceNumber: string, amount: number) => void;
  submitFuelRequest: (customerId: string, quantityLiters: number, aircraftReg: string, options?: Partial<FuelRequest>) => { success: boolean; message: string };
  upsertCustomerAccount: (account: CustomerAccount) => void;
  deleteCustomerAccount: (customerId: string) => void;
  resolveCustomerByFlightOrAirline: (
    flightNumber?: string,
    airlineNameOrCode?: string,
    aircraftReg?: string,
    coAgent?: string
  ) => { customer: CustomerAccount | null; airlineHolding: AirlineHolding | null; emails: string[] };
  deductFlightUpliftRealtime: (payload: {
    id?: string;
    deliveryNumber: string;
    flightNumber: string;
    airline?: string;
    co?: string;
    aircraftReg: string;
    aircraftType?: string;
    volumeLiters: number;
    date?: string;
    timePosition?: string;
    timeCommence?: string;
    timeComplete?: string;
    categorySector?: 'INT' | 'DOM' | 'SEA' | 'OWN' | 'RACL';
    source?: string;
  }) => {
    deducted: boolean;
    customer?: CustomerAccount;
    airlineHolding?: AirlineHolding | null;
    amountDeducted?: number;
    newBalance?: number;
    message: string;
  };
  rollbackFlightDeduction: (identifier: {
    id?: string;
    deliveryNumber?: string;
    flightNumber?: string;
    volume?: number;
  }) => { success: boolean; message: string; refundedAmount?: number };
  updateFlightDeduction: (
    id: string,
    updates: Partial<FlightLog>,
    previousDeliveryNumber?: string
  ) => { success: boolean; message: string };
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

  // Jet A-1 Fuel Rates Schedule (USD & MVR)
  fuelRates: FuelRateRecord[];
  activeUsdToMvrRate: number;
  updateFuelRate: (rate: FuelRateRecord) => void;
  addFuelRate: (rate: Omit<FuelRateRecord, 'id'>) => void;
  deleteFuelRate: (rateId: string) => void;
  getActiveFuelRate: (flightType?: string, airline?: string, currency?: 'USD' | 'MVR') => FuelRateRecord;
}

export const DEFAULT_FUEL_RATES: FuelRateRecord[] = [
  {
    id: 'fr-int',
    category: 'INT',
    airlineOrSector: 'INT',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.85,
    rateMvr: 28.527,
    currency: 'USD',
    notes: 'Standard International Jet A-1 uplift rate',
    active: true
  },
  {
    id: 'fr-seaplane',
    category: 'SEAPLANE',
    airlineOrSector: 'SEAPLANE',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.90,
    rateMvr: 29.298,
    currency: 'USD',
    notes: 'Standard Seaplane Jet A-1 uplift rate',
    active: true
  },
  {
    id: 'fr-dom',
    category: 'DOM',
    airlineOrSector: 'DOM',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.75,
    rateMvr: 26.985,
    currency: 'USD',
    notes: 'Standard Domestic Jet A-1 uplift rate',
    active: true
  },
  {
    id: 'fr-ias-discount',
    category: 'IAS_DISCOUNT',
    airlineOrSector: 'IAS DISCOUNT USD',
    effectiveDate: '1-Mar-23',
    rateUsd: 0.05,
    rateMvr: 0.771,
    currency: 'USD',
    notes: 'IAS Contractual Volume Discount (USD)',
    active: true
  },
  {
    id: 'fr-ias-dom',
    category: 'AIRLINE_CUSTOM',
    airlineOrSector: 'ISLAND AVIATION SERVICES',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.70,
    rateMvr: 26.214,
    currency: 'USD',
    notes: 'Island Aviation Services standard domestic contract rate',
    active: true
  },
  {
    id: 'fr-ias-sea',
    category: 'AIRLINE_CUSTOM',
    airlineOrSector: '(SEAPLANE) ISLAND AVIATION SERVICES',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.85,
    rateMvr: 28.527,
    currency: 'USD',
    notes: 'Island Aviation Services seaplane contract rate',
    active: true
  },
  {
    id: 'fr-ias-int',
    category: 'AIRLINE_CUSTOM',
    airlineOrSector: '(INT) ISLAND AVIATION SERVICES',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.80,
    rateMvr: 27.756,
    currency: 'USD',
    notes: 'Island Aviation Services international flights rate',
    active: true
  },
  {
    id: 'fr-ias-wb',
    category: 'AIRLINE_CUSTOM',
    airlineOrSector: '(WB) ISLAND AVIATION SERVICES',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.80,
    rateMvr: 27.756,
    currency: 'USD',
    notes: 'Island Aviation Services wide-body charter rate',
    active: true
  },
  {
    id: 'fr-flyme',
    category: 'AIRLINE_CUSTOM',
    airlineOrSector: 'FLY ME',
    effectiveDate: '1-Mar-23',
    rateUsd: 1.72,
    rateMvr: 26.522,
    currency: 'MVR',
    notes: 'Villa Air / Flyme contract rate (billed in MVR)',
    active: true
  }
];

const DEFAULT_CUSTOMER_ACCOUNTS: CustomerAccount[] = [
  // 1. ADVANCE INT CUSTOMERS USD
  {
    id: 'c1',
    name: 'Emirates Airlines',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 280000,
    paymentsReceived: 150000,
    advanceBalance: 430000,
    creditLimit: 0,
    estimated5DaysSales: 150000,
    runningBalance: 430000,
    outstandingReceipts: 0,
    openingBalanceLiters: 100000,
    balanceLiters: 153571,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['EK', 'EK650', 'EK651', 'EK652', 'EK653', 'FZ', 'FZ1569', 'FZ1570'],
    associatedRegs: ['A6-EEO', 'A6-EUV', 'A6-EOC', 'A6-FMA'],
    accountEmails: ['fuel.mle@emirates.com', 'ek.ops@emirates.com'],
    airlineHoldings: [
      {
        code: 'EK',
        name: 'Emirates',
        flightJobEmails: ['ek.ops@emirates.com', 'dispatch.mle@emirates.com'],
        billingEmails: ['fuel.mle@emirates.com', 'fuel.accounting@emirates.com'],
        aircraftRegs: ['A6-EEO', 'A6-EUV', 'A6-EOC'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'FZ',
        name: 'flydubai',
        flightJobEmails: ['ops.mle@flydubai.com'],
        billingEmails: ['fuel.billing@flydubai.com', 'fuel.mle@emirates.com'],
        aircraftRegs: ['A6-FMA', 'A6-FMB'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c2',
    name: 'Singapore Airlines',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 175712,
    paymentsReceived: 220000,
    advanceBalance: 395712,
    creditLimit: 0,
    estimated5DaysSales: 80000,
    runningBalance: 395712,
    outstandingReceipts: 0,
    openingBalanceLiters: 62754,
    balanceLiters: 141325,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['SQ', 'SQ431', 'SQ432', 'SQ451', 'SQ452', 'TR'],
    associatedRegs: ['9V-SMA', '9V-SMB', '9V-SHM'],
    accountEmails: ['sq.mle@singaporeair.com.sg', 'fuel.ops@singaporeair.com.sg'],
    airlineHoldings: [
      {
        code: 'SQ',
        name: 'Singapore Airlines',
        flightJobEmails: ['sq.mle@singaporeair.com.sg', 'dispatch@singaporeair.com.sg'],
        billingEmails: ['fuel.ops@singaporeair.com.sg'],
        aircraftRegs: ['9V-SMA', '9V-SMB', '9V-SHM'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'TR',
        name: 'Scoot',
        flightJobEmails: ['tr.ops@flyscoot.com', 'sq.mle@singaporeair.com.sg'],
        billingEmails: ['fuel.ops@singaporeair.com.sg'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c6',
    name: 'Qatar Airways',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 151575,
    paymentsReceived: 500000,
    advanceBalance: 651575,
    creditLimit: 0,
    estimated5DaysSales: 120000,
    runningBalance: 651575,
    outstandingReceipts: 0,
    openingBalanceLiters: 54134,
    balanceLiters: 232705,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['QR', 'QR672', 'QR673', 'QR674', 'QR675'],
    associatedRegs: ['A7-BCA', 'A7-BCB', 'A7-BEO'],
    accountEmails: ['qrops.mle@qatarairways.com.qa', 'fuel@qatarairways.com.qa'],
    airlineHoldings: [
      {
        code: 'QR',
        name: 'Qatar Airways',
        flightJobEmails: ['qrops.mle@qatarairways.com.qa', 'dispatch.mle@qatarairways.com.qa'],
        billingEmails: ['fuel@qatarairways.com.qa'],
        aircraftRegs: ['A7-BCA', 'A7-BCB', 'A7-BEO'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c7',
    name: 'Access Flight Support',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 26485,
    paymentsReceived: 15000,
    advanceBalance: 41485,
    creditLimit: 0,
    estimated5DaysSales: 30000,
    runningBalance: 41485,
    outstandingReceipts: 0,
    openingBalanceLiters: 22220,
    balanceLiters: 34804,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['AFS', 'BA', 'VS', 'DE', 'WK', 'AZ'],
    associatedRegs: ['G-ZBJA', 'D-ABOM', 'HB-JMG'],
    accountEmails: ['ops@accessflightsupport.com', 'fuel@accessflightsupport.com'],
    airlineHoldings: [
      {
        code: 'BA',
        name: 'British Airways',
        flightJobEmails: ['ba.mle@ba.com', 'ops@accessflightsupport.com'],
        billingEmails: ['fuel@accessflightsupport.com', 'fuel.invoices@ba.com'],
        aircraftRegs: ['G-ZBJA', 'G-ZBJF'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'DE',
        name: 'Condor',
        flightJobEmails: ['occ@condor.com', 'ops@accessflightsupport.com'],
        billingEmails: ['fuel@accessflightsupport.com'],
        aircraftRegs: ['D-ABOM'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'WK',
        name: 'Edelweiss Air',
        flightJobEmails: ['dispatch@flyedelweiss.com', 'ops@accessflightsupport.com'],
        billingEmails: ['fuel@accessflightsupport.com'],
        aircraftRegs: ['HB-JMG'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'VS',
        name: 'Virgin Atlantic',
        flightJobEmails: ['mle.ops@fly.virgin.com', 'ops@accessflightsupport.com'],
        billingEmails: ['fuel@accessflightsupport.com'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'AZ',
        name: 'ITA Airways',
        flightJobEmails: ['occ@ita-airways.com', 'ops@accessflightsupport.com'],
        billingEmails: ['fuel@accessflightsupport.com'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c8',
    name: 'AML Global Ltd',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 311853,
    paymentsReceived: 0,
    advanceBalance: 311853,
    creditLimit: 0,
    estimated5DaysSales: 50000,
    runningBalance: 311853,
    outstandingReceipts: 0,
    openingBalanceLiters: 261628,
    balanceLiters: 261628,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['AML', 'EY', 'G9', 'UL', '6E', 'WY'],
    associatedRegs: ['A6-BMJ', 'A6-ANY', 'A6-ARA', '4R-ALM', 'VT-IIO'],
    accountEmails: ['ops@amlglobal.aero', 'billing@amlglobal.aero'],
    airlineHoldings: [
      {
        code: 'EY',
        name: 'Etihad Airways',
        flightJobEmails: ['ey.mle@etihad.ae', 'ops@amlglobal.aero'],
        billingEmails: ['billing@amlglobal.aero', 'fuel@etihad.ae'],
        aircraftRegs: ['A6-BMJ', 'A6-BLV'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'G9',
        name: 'Air Arabia',
        flightJobEmails: ['g9.ops@airarabia.com', 'ops@amlglobal.aero'],
        billingEmails: ['billing@amlglobal.aero'],
        aircraftRegs: ['A6-ANY', 'A6-ARA'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'UL',
        name: 'SriLankan Airlines',
        flightJobEmails: ['ul.mle@srilankan.com', 'ops@amlglobal.aero'],
        billingEmails: ['billing@amlglobal.aero', 'fuel@srilankan.com'],
        aircraftRegs: ['4R-ALM', '4R-ALN'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: '6E',
        name: 'IndiGo',
        flightJobEmails: ['occ.intl@goindigo.in', 'ops@amlglobal.aero'],
        billingEmails: ['billing@amlglobal.aero'],
        aircraftRegs: ['VT-IIO'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'WY',
        name: 'Oman Air',
        flightJobEmails: ['wy.mle@omanair.com', 'ops@amlglobal.aero'],
        billingEmails: ['billing@amlglobal.aero'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c11',
    name: 'United Capital Investments Group,Dubai Multi Commodities Centre',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 65000,
    paymentsReceived: 50000,
    advanceBalance: 115000,
    creditLimit: 0,
    estimated5DaysSales: 40000,
    runningBalance: 115000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['UC'],
    accountEmails: ['ops@unitedcapital.ae', 'fuel@unitedcapital.ae'],
    airlineHoldings: [
      {
        code: 'UC',
        name: 'United Capital Charter Ops',
        flightJobEmails: ['ops@unitedcapital.ae'],
        billingEmails: ['fuel@unitedcapital.ae'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c12',
    name: 'BEOND-SIMDI OPERATIONS PVT LTD',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 120000,
    paymentsReceived: 80000,
    advanceBalance: 200000,
    creditLimit: 0,
    estimated5DaysSales: 60000,
    runningBalance: 200000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['B4', 'BYD'],
    associatedRegs: ['8Q-RIA'],
    accountEmails: ['ops@flybeond.com', 'finance@flybeond.com'],
    airlineHoldings: [
      {
        code: 'B4',
        name: 'Beond',
        flightJobEmails: ['ops@flybeond.com', 'dispatch@flybeond.com'],
        billingEmails: ['finance@flybeond.com'],
        aircraftRegs: ['8Q-RIA'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c13',
    name: 'US-BANGLA AIRLINES',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 45000,
    paymentsReceived: 40000,
    advanceBalance: 85000,
    creditLimit: 0,
    estimated5DaysSales: 35000,
    runningBalance: 85000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['BS', 'UBG'],
    associatedRegs: ['S2-AJC'],
    accountEmails: ['occ@usbair.com', 'fuel@usbair.com'],
    airlineHoldings: [
      {
        code: 'BS',
        name: 'US-Bangla Airlines',
        flightJobEmails: ['occ@usbair.com'],
        billingEmails: ['fuel@usbair.com'],
        aircraftRegs: ['S2-AJC'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c14',
    name: 'WORLD FUEL SERVICES LTD.',
    classification: 'ADVANCE',
    category: 'ADVANCE_INT_USD',
    currency: 'USD',
    openingBalance: 320000,
    paymentsReceived: 200000,
    advanceBalance: 520000,
    creditLimit: 0,
    estimated5DaysSales: 110000,
    runningBalance: 520000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['WFS'],
    accountEmails: ['fueldispatches@wfscorp.com', 'maldivesops@wfscorp.com'],
    airlineHoldings: [
      {
        code: 'WFS',
        name: 'World Fuel Services Charter',
        flightJobEmails: ['fueldispatches@wfscorp.com'],
        billingEmails: ['maldivesops@wfscorp.com'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },

  // 2. ADVANCE DOM CUSTOMERS USD
  {
    id: 'c15',
    name: 'TMA PVT LTD',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_USD',
    currency: 'USD',
    openingBalance: 120000,
    paymentsReceived: 100000,
    advanceBalance: 220000,
    creditLimit: 0,
    estimated5DaysSales: 75000,
    runningBalance: 220000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['TMA', 'HUM'],
    associatedRegs: ['8Q-TMA', '8Q-TMB'],
    accountEmails: ['fuel@transmaldivian.com', 'ops@transmaldivian.com'],
    airlineHoldings: [
      {
        code: 'TMA',
        name: 'Trans Maldivian Airways',
        flightJobEmails: ['ops@transmaldivian.com'],
        billingEmails: ['fuel@transmaldivian.com'],
        aircraftRegs: ['8Q-TMA', '8Q-TMB'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c16',
    name: 'TMA PVT LTD WITH GST',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_USD',
    currency: 'USD',
    openingBalance: 45000,
    paymentsReceived: 50000,
    advanceBalance: 95000,
    creditLimit: 0,
    estimated5DaysSales: 30000,
    runningBalance: 95000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['TMA'],
    accountEmails: ['tax.fuel@transmaldivian.com'],
    airlineHoldings: []
  },
  {
    id: 'c4',
    name: 'MANTA AVIATION PVT LTD',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_USD',
    currency: 'USD',
    openingBalance: 85000,
    paymentsReceived: 65000,
    advanceBalance: 150000,
    creditLimit: 0,
    estimated5DaysSales: 50000,
    runningBalance: 150000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['NR', 'NR101', 'NR102', 'MANTA'],
    associatedRegs: ['8Q-RAA', '8Q-RAB', '8Q-RAC'],
    accountEmails: ['occ@mantaair.mv', 'finance@mantaair.mv'],
    airlineHoldings: [
      {
        code: 'NR',
        name: 'Manta Air',
        flightJobEmails: ['occ@mantaair.mv', 'dispatch@mantaair.mv'],
        billingEmails: ['finance@mantaair.mv'],
        aircraftRegs: ['8Q-RAA', '8Q-RAB', '8Q-RAC'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c17',
    name: 'MANTA AVIATION WITH GST',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_USD',
    currency: 'USD',
    openingBalance: 35000,
    paymentsReceived: 30000,
    advanceBalance: 65000,
    creditLimit: 0,
    estimated5DaysSales: 20000,
    runningBalance: 65000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['NR'],
    accountEmails: ['finance@mantaair.mv'],
    airlineHoldings: []
  },

  // 3. ADVANCE DOM CUSTOMERS MVR
  {
    id: 'c5',
    name: 'FLY ME',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_MVR',
    currency: 'MVR',
    openingBalance: 250000,
    paymentsReceived: 227188,
    advanceBalance: 477188,
    creditLimit: 0,
    estimated5DaysSales: 150000,
    runningBalance: 477188,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['VP', 'VP201', 'VP202', 'FLYME', 'VILLA AIR'],
    associatedRegs: ['8Q-VAH', '8Q-VAI', '8Q-VAJ'],
    accountEmails: ['occ@flyme.mv', 'accounts@flyme.mv'],
    airlineHoldings: [
      {
        code: 'VP',
        name: 'Flyme (Villa Air)',
        flightJobEmails: ['occ@flyme.mv', 'dispatch@flyme.mv'],
        billingEmails: ['accounts@flyme.mv'],
        aircraftRegs: ['8Q-VAH', '8Q-VAI', '8Q-VAJ'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c18',
    name: 'FLY ME WITH GST',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_MVR',
    currency: 'MVR',
    openingBalance: 60000,
    paymentsReceived: 65000,
    advanceBalance: 125000,
    creditLimit: 0,
    estimated5DaysSales: 40000,
    runningBalance: 125000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['VP'],
    accountEmails: ['accounts@flyme.mv'],
    airlineHoldings: []
  },
  {
    id: 'c19',
    name: 'FLY ME (INT)',
    classification: 'ADVANCE',
    category: 'ADVANCE_DOM_MVR',
    currency: 'MVR',
    openingBalance: 40000,
    paymentsReceived: 45000,
    advanceBalance: 85000,
    creditLimit: 0,
    estimated5DaysSales: 30000,
    runningBalance: 85000,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['VP'],
    accountEmails: ['occ@flyme.mv'],
    airlineHoldings: []
  },

  // 4. ISLAND AVIATION SERVICES (IAS / CREDIT)
  {
    id: 'c3',
    name: 'IAS INTL',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -28200000,
    paymentsReceived: 10000000,
    advanceBalance: 0,
    creditLimit: 50000000,
    estimated5DaysSales: 500000,
    runningBalance: -18200000,
    outstandingReceipts: 18200000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2', 'Q2700', 'Q2701', 'Q2702', 'Q2104', 'MALDIVIAN', 'IAS'],
    associatedRegs: ['8Q-IAI', '8Q-IAJ', '8Q-ISD', '8Q-IAN', '8Q-IAS'],
    accountEmails: ['occ@iasl.aero', 'fuel.billing@iasl.aero'],
    airlineHoldings: [
      {
        code: 'Q2',
        name: 'Maldivian (Island Aviation Services)',
        flightJobEmails: ['occ@iasl.aero', 'dispatch@iasl.aero'],
        billingEmails: ['fuel.billing@iasl.aero', 'accounts@iasl.aero'],
        aircraftRegs: ['8Q-IAI', '8Q-IAJ', '8Q-ISD', '8Q-IAN', '8Q-IAS'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c20',
    name: '(WB) ISLAND AVIATION SERVICES',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -4500000,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 10000000,
    estimated5DaysSales: 150000,
    runningBalance: -4500000,
    outstandingReceipts: 4500000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2'],
    accountEmails: ['occ@iasl.aero'],
    airlineHoldings: []
  },
  {
    id: 'c21',
    name: '(SEAPLANE) ISLAND AVIATION SERVICES',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -2100000,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 5000000,
    estimated5DaysSales: 80000,
    runningBalance: -2100000,
    outstandingReceipts: 2100000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2'],
    accountEmails: ['seaplane.ops@iasl.aero'],
    airlineHoldings: []
  },
  {
    id: 'c22',
    name: '(SEAPLANE) GST',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -350000,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 1000000,
    estimated5DaysSales: 15000,
    runningBalance: -350000,
    outstandingReceipts: 350000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2'],
    accountEmails: ['finance@iasl.aero'],
    airlineHoldings: []
  },
  {
    id: 'c23',
    name: 'ISLAND AVIATION DOM',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -1250000,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 5000000,
    estimated5DaysSales: 60000,
    runningBalance: -1250000,
    outstandingReceipts: 1250000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2'],
    accountEmails: ['domestic.ops@iasl.aero'],
    airlineHoldings: []
  },
  {
    id: 'c24',
    name: 'IAS WITH GST',
    classification: 'CREDIT',
    category: 'IAS_CREDIT',
    currency: 'USD',
    openingBalance: -180000,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 500000,
    estimated5DaysSales: 10000,
    runningBalance: -180000,
    outstandingReceipts: 180000,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['Q2'],
    accountEmails: ['finance@iasl.aero'],
    airlineHoldings: []
  },

  // 5. OTHER CREDIT / COMMERCIAL CUSTOMERS
  {
    id: 'c9',
    name: 'Aviation Services Management',
    classification: 'CREDIT',
    category: 'CREDIT_GENERAL',
    currency: 'USD',
    openingBalance: -326370,
    paymentsReceived: 1215191,
    advanceBalance: 0,
    creditLimit: 5000000,
    estimated5DaysSales: 100000,
    runningBalance: 888821,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['ASM', 'SU', 'TK', 'SV', 'KU', 'GF'],
    associatedRegs: ['RA-73100', 'TC-LJA', 'HZ-AK36'],
    accountEmails: ['fuel@asm.aero', 'ops@asm.aero'],
    airlineHoldings: [
      {
        code: 'SU',
        name: 'Aeroflot',
        flightJobEmails: ['su.mle@aeroflot.ru', 'ops@asm.aero'],
        billingEmails: ['fuel@asm.aero'],
        aircraftRegs: ['RA-73100'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'TK',
        name: 'Turkish Airlines',
        flightJobEmails: ['tk.mle@thy.com', 'ops@asm.aero'],
        billingEmails: ['fuel@asm.aero', 'fuel@thy.com'],
        aircraftRegs: ['TC-LJA'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'SV',
        name: 'Saudia',
        flightJobEmails: ['sv.mle@saudia.com', 'ops@asm.aero'],
        billingEmails: ['fuel@asm.aero'],
        aircraftRegs: ['HZ-AK36'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'GF',
        name: 'Gulf Air',
        flightJobEmails: ['gf.mle@gulfair.com', 'ops@asm.aero'],
        billingEmails: ['fuel@asm.aero'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  },
  {
    id: 'c10',
    name: 'Mega Airport Services (Cash Agent)',
    classification: 'CASH',
    category: 'CREDIT_GENERAL',
    currency: 'USD',
    openingBalance: 0,
    paymentsReceived: 0,
    advanceBalance: 0,
    creditLimit: 0,
    estimated5DaysSales: 0,
    runningBalance: 0,
    outstandingReceipts: 0,
    defaultPricePerLiter: 1.19197,
    autoDeductOnUplift: true,
    associatedAirlines: ['MAS', 'CASH', 'MH', 'AK', 'FD', 'JD', 'MU'],
    associatedRegs: ['9M-MVD', '9M-MVG', '9M-AFO'],
    accountEmails: ['ops@megaairportservices.mv', 'cashdesk@macl.aero'],
    airlineHoldings: [
      {
        code: 'MH',
        name: 'Malaysia Airlines',
        flightJobEmails: ['mh.mle@malaysiaairlines.com', 'ops@megaairportservices.mv'],
        billingEmails: ['ops@megaairportservices.mv', 'cashdesk@macl.aero'],
        aircraftRegs: ['9M-MVD', '9M-MVG'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'AK',
        name: 'AirAsia',
        flightJobEmails: ['ak.mle@airasia.com', 'ops@megaairportservices.mv'],
        billingEmails: ['ops@megaairportservices.mv'],
        aircraftRegs: ['9M-AFO'],
        autoSendFlightJob: true,
        autoSendInvoice: true
      },
      {
        code: 'MU',
        name: 'China Eastern Airlines',
        flightJobEmails: ['mu.mle@ceair.com', 'ops@megaairportservices.mv'],
        billingEmails: ['ops@megaairportservices.mv'],
        aircraftRegs: [],
        autoSendFlightJob: true,
        autoSendInvoice: true
      }
    ]
  }
];

function enrichCustomersWithDefaultHoldings(list: CustomerAccount[]): CustomerAccount[] {
  return list.map(cust => {
    const def = DEFAULT_CUSTOMER_ACCOUNTS.find(
      d => d.id === cust.id || d.name.toLowerCase() === cust.name.toLowerCase()
    );
    if (!def) {
      return {
        ...cust,
        category: cust.category || 'CREDIT_GENERAL',
        currency: cust.currency || 'USD',
        associatedAirlines: cust.associatedAirlines || [],
        associatedRegs: cust.associatedRegs || [],
        accountEmails: cust.accountEmails || [],
        airlineHoldings: cust.airlineHoldings || [],
        defaultPricePerLiter: cust.defaultPricePerLiter ?? 1.19197,
        autoDeductOnUplift: cust.autoDeductOnUplift ?? true
      };
    }
    return {
      ...cust,
      category: cust.category || def.category,
      currency: cust.currency || def.currency,
      associatedAirlines:
        cust.associatedAirlines && cust.associatedAirlines.length > 0
          ? cust.associatedAirlines
          : def.associatedAirlines,
      associatedRegs:
        cust.associatedRegs && cust.associatedRegs.length > 0
          ? cust.associatedRegs
          : def.associatedRegs,
      accountEmails:
        cust.accountEmails && cust.accountEmails.length > 0
          ? cust.accountEmails
          : def.accountEmails,
      airlineHoldings:
        cust.airlineHoldings && cust.airlineHoldings.length > 0
          ? cust.airlineHoldings
          : def.airlineHoldings,
      defaultPricePerLiter: cust.defaultPricePerLiter ?? def.defaultPricePerLiter ?? 1.19197,
      autoDeductOnUplift: cust.autoDeductOnUplift ?? true
    };
  });
}

const FinanceDataContext = createContext<FinanceDataContextType | undefined>(undefined);

export const FinanceDataProvider: React.FC<{ children: React.ReactNode; user?: User | null }> = ({ children, user }) => {
  // Initialize customer list matching MACL actual worksheets + airline holdings & email directory
  const [customers, setCustomers] = useState<CustomerAccount[]>(() => {
    const saved = localStorage.getItem('fms_fin_customers');
    if (saved) {
      try {
        return enrichCustomersWithDefaultHoldings(JSON.parse(saved));
      } catch {
        return DEFAULT_CUSTOMER_ACCOUNTS;
      }
    }
    return DEFAULT_CUSTOMER_ACCOUNTS;
  });

  const [realtimeDeductions, setRealtimeDeductions] = useState<RealTimeDeductionEvent[]>(() => {
    const saved = localStorage.getItem('fms_fin_realtime_deductions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('fms_fin_realtime_deductions', JSON.stringify(realtimeDeductions.slice(0, 100)));
  }, [realtimeDeductions]);

  // Index customer master database into IndexedDB for offline flight number & aircraft reg resolution
  useEffect(() => {
    fmsDb.indexCustomerMappings(customers).catch(err => {
      console.warn('[MasterDB] Failed to index customer flight/reg mappings:', err);
    });
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

  // Jet A-1 Fuel Rates Schedule (USD & MVR)
  const [fuelRates, setFuelRates] = useState<FuelRateRecord[]>(() => {
    const saved = localStorage.getItem('fms_fuel_rates_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_FUEL_RATES;
  });

  const activeUsdToMvrRate = 15.42;

  useEffect(() => {
    localStorage.setItem('fms_fuel_rates_v1', JSON.stringify(fuelRates));
  }, [fuelRates]);

  const updateFuelRate = useCallback((rate: FuelRateRecord) => {
    setFuelRates(prev => prev.map(r => (r.id === rate.id ? rate : r)));
  }, []);

  const addFuelRate = useCallback((rate: Omit<FuelRateRecord, 'id'>) => {
    const newRecord: FuelRateRecord = {
      ...rate,
      id: `fr-${serverTimeService.getServerEpochMs()}`
    };
    setFuelRates(prev => [...prev, newRecord]);
  }, []);

  const deleteFuelRate = useCallback((rateId: string) => {
    setFuelRates(prev => prev.filter(r => r.id !== rateId));
  }, []);

  const getActiveFuelRate = useCallback(
    (flightType?: string, airline?: string, currency: 'USD' | 'MVR' = 'USD'): FuelRateRecord => {
      const upperAirline = (airline || '').toUpperCase().trim();
      const upperType = (flightType || '').toUpperCase().trim();

      // 1. Specific airline matches
      if (upperAirline) {
        if (upperAirline.includes('FLY') || upperAirline.includes('VILLA')) {
          const flyme = fuelRates.find(r => r.active && r.airlineOrSector.toUpperCase().includes('FLY ME'));
          if (flyme) return flyme;
        }
        if (upperAirline.includes('ISLAND AVIATION') || upperAirline.includes('MALDIVIAN') || upperAirline.includes('IAS')) {
          if (upperType.includes('SEA')) {
            const iasSea = fuelRates.find(r => r.active && r.airlineOrSector.includes('SEAPLANE'));
            if (iasSea) return iasSea;
          }
          if (upperType.includes('INT') || upperType.includes('INTERNATIONAL')) {
            const iasInt = fuelRates.find(r => r.active && r.airlineOrSector.includes('(INT)'));
            if (iasInt) return iasInt;
          }
          if (upperType.includes('WB') || upperType.includes('WIDE BODY')) {
            const iasWb = fuelRates.find(r => r.active && r.airlineOrSector.includes('(WB)'));
            if (iasWb) return iasWb;
          }
          const iasDom = fuelRates.find(r => r.active && r.airlineOrSector === 'ISLAND AVIATION SERVICES');
          if (iasDom) return iasDom;
        }
        const exact = fuelRates.find(r => r.active && r.airlineOrSector.toUpperCase() === upperAirline);
        if (exact) return exact;
      }

      // 2. Sector based matches
      if (upperType.includes('SEA')) {
        const sea = fuelRates.find(r => r.active && r.category === 'SEAPLANE');
        if (sea) return sea;
      }
      if (upperType.includes('DOM')) {
        const dom = fuelRates.find(r => r.active && r.category === 'DOM');
        if (dom) return dom;
      }

      // Default to standard International rate
      const intRate = fuelRates.find(r => r.active && r.category === 'INT');
      if (intRate) return intRate;

      return fuelRates[0] || DEFAULT_FUEL_RATES[0];
    },
    [fuelRates]
  );

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

      if (fetchedCusts && fetchedCusts.length > 0) setCustomers(enrichCustomersWithDefaultHoldings(fetchedCusts));
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
      id: `sw-${serverTimeService.getServerEpochMs()}`,
      customerId,
      customerName: customer.name,
      referenceNumber,
      amount,
      uploadDate: serverTimeService.getServerDate(),
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
      id: `rec-${serverTimeService.getServerEpochMs()}`,
      receiptNumber: `REC-${referenceNumber}`,
      customerId,
      customerName: customer.name,
      amount,
      date: serverTimeService.getServerDate(),
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

  // Create or update a CustomerAccount (including held airlines & email routing)
  const upsertCustomerAccount = useCallback((account: CustomerAccount) => {
    // Keep associatedAirlines and associatedRegs synchronized with airlineHoldings
    const holdingCodes = (account.airlineHoldings || [])
      .flatMap(h => [h.code?.toUpperCase().trim(), h.name?.toUpperCase().trim()])
      .filter(Boolean) as string[];
    const mergedAirlines = Array.from(
      new Set([...(account.associatedAirlines || []).map(a => a.toUpperCase().trim()), ...holdingCodes].filter(Boolean))
    );
    const holdingRegs = (account.airlineHoldings || [])
      .flatMap(h => h.aircraftRegs || [])
      .map(r => r.toUpperCase().trim())
      .filter(Boolean);
    const mergedRegs = Array.from(
      new Set([...(account.associatedRegs || []).map(r => r.toUpperCase().trim()), ...holdingRegs].filter(Boolean))
    );

    const normalized: CustomerAccount = {
      ...account,
      associatedAirlines: mergedAirlines,
      associatedRegs: mergedRegs,
      accountEmails: (account.accountEmails || []).map(e => e.trim()).filter(Boolean),
      airlineHoldings: (account.airlineHoldings || []).map(h => ({
        ...h,
        code: h.code.toUpperCase().trim(),
        name: h.name.trim(),
        flightJobEmails: (h.flightJobEmails || []).map(e => e.trim()).filter(Boolean),
        billingEmails: (h.billingEmails || []).map(e => e.trim()).filter(Boolean),
        aircraftRegs: (h.aircraftRegs || []).map(r => r.toUpperCase().trim()).filter(Boolean)
      })),
      defaultPricePerLiter: account.defaultPricePerLiter ?? 1.19197,
      autoDeductOnUplift: account.autoDeductOnUplift ?? true
    };

    setCustomers(prev => {
      const exists = prev.some(c => c.id === normalized.id);
      const next = exists ? prev.map(c => (c.id === normalized.id ? normalized : c)) : [normalized, ...prev];
      return next;
    });

    supabaseService.upsertFinCustomers([normalized]).catch(err => {
      console.warn('[Finance] Failed to upsert customer to Supabase, queueing offline outbox:', err);
      fmsDb.enqueueOutbox({
        idempotencyKey: `customer-upsert-${normalized.id}-${Date.now()}`,
        entityType: 'customer',
        entityId: normalized.id,
        action: 'UPDATE',
        payload: {
          id: normalized.id,
          name: normalized.name,
          classification: normalized.classification,
          opening_balance: normalized.openingBalance,
          payments_received: normalized.paymentsReceived,
          advance_balance: normalized.advanceBalance,
          credit_limit: normalized.creditLimit,
          estimated_5_days_sales: normalized.estimated5DaysSales,
          running_balance: normalized.runningBalance,
          outstanding_receipts: normalized.outstandingReceipts,
          opening_balance_liters: normalized.openingBalanceLiters ?? null,
          balance_liters: normalized.balanceLiters ?? null,
          associated_airlines: normalized.associatedAirlines || []
        }
      });
    });
  }, []);

  const deleteCustomerAccount = useCallback((customerId: string) => {
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    supabaseService.deleteFinCustomer(customerId).catch(err => {
      console.warn('[Finance] Failed to delete customer from Supabase:', err);
    });
  }, []);

  // Resolve owning CustomerAccount, specific AirlineHolding, and target email addresses
  // from flightNumber (e.g. "EK653", "BA2043"), airline name/code, aircraftReg, or C/O agent
  const resolveCustomerByFlightOrAirline = useCallback(
    (
      flightNumber?: string,
      airlineNameOrCode?: string,
      aircraftReg?: string,
      coAgent?: string
    ): { customer: CustomerAccount | null; airlineHolding: AirlineHolding | null; emails: string[] } => {
      const cleanFlight = (flightNumber || '').toUpperCase().trim();
      const prefixMatch = cleanFlight.match(/^([A-Z0-9]{2,3})\s*-?\s*\d+/);
      const flightPrefix = prefixMatch ? prefixMatch[1] : cleanFlight;
      const cleanAirline = (airlineNameOrCode || '').toUpperCase().trim();
      const cleanReg = (aircraftReg || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanRegWithDash = (aircraftReg || '').toUpperCase().trim();
      const cleanCo = (coAgent || '').toUpperCase().trim();

      // 1. Check exact AirlineHolding match across all customer accounts
      for (const cust of customers) {
        const holdings = cust.airlineHoldings || [];
        for (const h of holdings) {
          const hCode = (h.code || '').toUpperCase().trim();
          const hName = (h.name || '').toUpperCase().trim();
          const codeMatches =
            (hCode && (flightPrefix === hCode || cleanFlight.startsWith(hCode) || cleanAirline === hCode)) ||
            (hName && (cleanAirline === hName || cleanAirline.includes(hName) || hName.includes(cleanAirline && cleanAirline.length >= 3 ? cleanAirline : '___NONE___')));
          const regMatches =
            cleanReg.length >= 3 &&
            (h.aircraftRegs || []).some(
              r => r.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanReg || r.toUpperCase().trim() === cleanRegWithDash
            );

          if (codeMatches || regMatches) {
            const emails = Array.from(
              new Set([...(h.flightJobEmails || []), ...(h.billingEmails || []), ...(cust.accountEmails || [])].filter(Boolean))
            );
            return { customer: cust, airlineHolding: h, emails };
          }
        }
      }

      // 2. Check customer-level associatedAirlines, associatedRegs, or C/O agent name
      for (const cust of customers) {
        const custNameUpper = cust.name.toUpperCase().trim();
        const assocAirlines = (cust.associatedAirlines || []).map(a => a.toUpperCase().trim());
        const assocRegs = (cust.associatedRegs || []).map(r => r.toUpperCase().replace(/[^A-Z0-9]/g, ''));

        const matchesFlightOrPrefix =
          (cleanFlight && assocAirlines.includes(cleanFlight)) ||
          (flightPrefix && assocAirlines.includes(flightPrefix)) ||
          (cleanAirline && assocAirlines.includes(cleanAirline));

        const matchesReg = cleanReg.length >= 3 && assocRegs.includes(cleanReg);

        const matchesNameOrCo =
          (cleanCo && (custNameUpper.includes(cleanCo) || assocAirlines.includes(cleanCo))) ||
          (cleanAirline && cleanAirline.length >= 3 && (custNameUpper.includes(cleanAirline) || cleanAirline.includes(custNameUpper)));

        if (matchesFlightOrPrefix || matchesReg || matchesNameOrCo) {
          const matchedHolding =
            (cust.airlineHoldings || []).find(
              h =>
                h.code.toUpperCase() === flightPrefix ||
                h.code.toUpperCase() === cleanAirline ||
                (cleanAirline && h.name.toUpperCase().includes(cleanAirline))
            ) || (cust.airlineHoldings && cust.airlineHoldings[0]) || null;

          const emails = Array.from(
            new Set([
              ...(matchedHolding?.flightJobEmails || []),
              ...(matchedHolding?.billingEmails || []),
              ...(cust.accountEmails || [])
            ].filter(Boolean))
          );
          return { customer: cust, airlineHolding: matchedHolding, emails };
        }
      }

      return { customer: null, airlineHolding: null, emails: [] };
    },
    [customers]
  );

  // Real-time balance deduction when a flight job / fueling log is entered
  const deductFlightUpliftRealtime = useCallback(
    (payload: {
      id?: string;
      deliveryNumber: string;
      flightNumber: string;
      airline?: string;
      co?: string;
      aircraftReg: string;
      aircraftType?: string;
      volumeLiters: number;
      date?: string;
      timePosition?: string;
      timeCommence?: string;
      timeComplete?: string;
      categorySector?: 'INT' | 'DOM' | 'SEA' | 'OWN' | 'RACL';
      source?: string;
    }) => {
      const volume = Number(payload.volumeLiters) || 0;
      if (volume <= 0) {
        return { deducted: false, message: 'Zero volume uplift; no deduction required.' };
      }

      const ticketKey = (payload.deliveryNumber || payload.id || '').trim();
      if (ticketKey) {
        try {
          const deductedSetRaw = localStorage.getItem('fms_fin_deducted_tickets');
          const deductedList: string[] = deductedSetRaw ? JSON.parse(deductedSetRaw) : [];
          if (deductedList.includes(ticketKey)) {
            return { deducted: false, message: `Delivery Ticket #${ticketKey} already deducted.` };
          }
        } catch {}
      }

      const { customer, airlineHolding, emails } = resolveCustomerByFlightOrAirline(
        payload.flightNumber,
        payload.airline,
        payload.aircraftReg,
        payload.co
      );

      if (!customer) {
        return {
          deducted: false,
          message: `No linked Customer Account found for ${payload.flightNumber || payload.airline || payload.aircraftReg}.`
        };
      }

      if (customer.autoDeductOnUplift === false) {
        return {
          deducted: false,
          customer,
          airlineHolding,
          message: `Auto-deduction is disabled for ${customer.name}.`
        };
      }

      const pricePerLiter = customer.defaultPricePerLiter || 1.19197;
      const amount = Number((volume * pricePerLiter).toFixed(2));
      const prevBal = customer.classification === 'ADVANCE' ? customer.advanceBalance : customer.runningBalance;
      const nextAdvance =
        customer.classification === 'ADVANCE' ? Number((customer.advanceBalance - amount).toFixed(2)) : customer.advanceBalance;
      const nextRunning = Number((customer.runningBalance - amount).toFixed(2));
      const nextLiters =
        customer.balanceLiters !== undefined
          ? Math.max(0, Math.round(customer.balanceLiters - volume))
          : customer.classification === 'ADVANCE'
          ? Math.max(0, Math.round(nextAdvance / pricePerLiter))
          : undefined;

      const updatedCustomer: CustomerAccount = {
        ...customer,
        advanceBalance: nextAdvance,
        runningBalance: nextRunning,
        balanceLiters: nextLiters,
        outstandingReceipts:
          customer.classification === 'CREDIT' && nextRunning < 0 ? Math.abs(nextRunning) : customer.outstandingReceipts
      };

      setCustomers(prev => prev.map(c => (c.id === customer.id ? updatedCustomer : c)));

      // Persist updated customer balance to Supabase
      supabaseService.upsertFinCustomers([updatedCustomer]).catch(err => {
        console.warn('[Finance] Failed to sync real-time balance deduction to Supabase:', err);
      });

      const isDomestic =
        customer.id === 'c3' ||
        customer.id === 'c4' ||
        customer.id === 'c5' ||
        (payload.flightNumber || '').toUpperCase().startsWith('Q2') ||
        (payload.flightNumber || '').toUpperCase().startsWith('NR') ||
        (payload.flightNumber || '').toUpperCase().startsWith('VP');

      const newReq: FuelRequest = {
        id: payload.id ? `fr-${payload.id}` : `fr-${Date.now()}`,
        deliveryNumber: payload.deliveryNumber || `${Math.floor(312000 + Math.random() * 9000)}`,
        customerId: customer.id,
        customerName: customer.name,
        date: payload.date || new Date().toISOString().split('T')[0],
        quantityLiters: volume,
        pricePerLiter,
        amount,
        aircraftReg: payload.aircraftReg || 'TBA',
        status:
          customer.classification === 'ADVANCE' && prevBal < amount
            ? 'BLOCKED_INSUFFICIENT_FUNDS'
            : 'APPROVED',
        categorySector: payload.categorySector || (isDomestic ? 'DOM' : 'INT'),
        operator: (airlineHolding?.name || payload.airline || customer.name).toUpperCase(),
        flightNumber: (payload.flightNumber || 'FLIGHT').toUpperCase(),
        aircraftType: payload.aircraftType || 'JET',
        refuelTimePosition: payload.timePosition || '00:00',
        refuelTimeCommence: payload.timeCommence || '00:00',
        refuelTimeComplete: payload.timeComplete || '00:00',
        memoLine: isDomestic ? 'JET FUEL SALES DOMESTIC (REALTIME)' : 'JET FUEL SALES INTL (REALTIME)',
        currency: 'USD',
        circularRate: pricePerLiter,
        discounts: 0,
        gst: Number((amount * 0.08).toFixed(2)),
        transactionType: 'ISSUES',
        cogsAccount: 'ISSUES',
        invoiceNumber: `FFF/2026/${Math.floor(2600001000 + Math.random() * 8999)}`
      };

      setFuelRequests(prev => {
        const exists = prev.some(r => r.deliveryNumber === newReq.deliveryNumber);
        if (exists) {
          return prev.map(r => (r.deliveryNumber === newReq.deliveryNumber ? newReq : r));
        }
        return [newReq, ...prev];
      });

      supabaseService.createFinFuelRequest(newReq).catch(err => {
        console.warn('[Finance] Failed to sync real-time FuelRequest to Supabase:', err);
      });

      if (ticketKey) {
        try {
          const deductedSetRaw = localStorage.getItem('fms_fin_deducted_tickets');
          const deductedList: string[] = deductedSetRaw ? JSON.parse(deductedSetRaw) : [];
          if (!deductedList.includes(ticketKey)) {
            deductedList.unshift(ticketKey);
            localStorage.setItem('fms_fin_deducted_tickets', JSON.stringify(deductedList.slice(0, 500)));
          }
        } catch {}
      }

      const newBalance = customer.classification === 'ADVANCE' ? nextAdvance : nextRunning;
      const eventRecord: RealTimeDeductionEvent = {
        id: `ded-${Date.now()}`,
        timestamp: new Date().toISOString(),
        deliveryNumber: newReq.deliveryNumber,
        flightNumber: newReq.flightNumber,
        airlineName: airlineHolding?.name || payload.airline || customer.name,
        customerId: customer.id,
        customerName: customer.name,
        classification: customer.classification,
        volumeLiters: volume,
        amountDeducted: amount,
        previousBalance: prevBal,
        newBalance,
        emailsNotified: emails
      };

      setRealtimeDeductions(prev => [eventRecord, ...prev.slice(0, 99)]);

      return {
        deducted: true,
        customer: updatedCustomer,
        airlineHolding,
        amountDeducted: amount,
        newBalance,
        message: `Deducted $${amount.toLocaleString()} (${volume.toLocaleString()} L) from ${customer.name} in real time.`
      };
    },
    [resolveCustomerByFlightOrAirline]
  );

  // Listen globally for flight logs created in IntoPlane, Seaplane, or Schedule
  // and automatically deduct from the matched Customer Account balance in real time!
  useEffect(() => {
    const handleFlightLogCreated = (evt: Event) => {
      const customEvt = evt as CustomEvent<any>;
      const log = customEvt.detail;
      if (!log) return;
      const volume = Number(log.volume) || 0;
      if (volume <= 0) return;

      const formatHHMM = (iso?: string) => {
        if (!iso) return '00:00';
        if (/^\d{2}:\d{2}/.test(iso)) return iso.slice(0, 5);
        try {
          const d = new Date(iso);
          if (!isNaN(d.getTime())) {
            return d.toTimeString().slice(0, 5);
          }
        } catch {}
        return '00:00';
      };

      const sector =
        log.logType === 'SEAPLANE'
          ? 'SEA'
          : log.category === 'DOMESTIC' || log.isDomestic
          ? 'DOM'
          : 'INT';

      deductFlightUpliftRealtime({
        id: log.id,
        deliveryNumber: log.deliveryNumber || `TKT-${Date.now()}`,
        flightNumber: log.flightNumber || '',
        airline: log.airline || log.operatorName || '',
        co: log.co || '',
        aircraftReg: log.aircraftReg || '',
        aircraftType: log.aircraftType || '',
        volumeLiters: volume,
        date: log.operationalDate || (log.timestampStart ? String(log.timestampStart).split('T')[0] : undefined),
        timePosition: formatHHMM(log.timestampPosition || log.timestampStart),
        timeCommence: formatHHMM(log.timestampStart),
        timeComplete: formatHHMM(log.timestampEnd),
        categorySector: sector,
        source: log.logType || 'INTO_PLANE'
      });
    };

    window.addEventListener('fms:flight-log-created', handleFlightLogCreated);
    return () => {
      window.removeEventListener('fms:flight-log-created', handleFlightLogCreated);
    };
  }, [deductFlightUpliftRealtime]);

  // Rollback / Refund a flight job deduction when deleted or voided
  const rollbackFlightDeduction = useCallback(
    (identifier: {
      id?: string;
      deliveryNumber?: string;
      flightNumber?: string;
      volume?: number;
    }) => {
      const targetTicket = (identifier.deliveryNumber || '').trim();
      const cleanTargetDigits = targetTicket.replace(/^MLE-/, '').trim();
      const cleanFn = (identifier.flightNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const targetId = identifier.id || '';

      // 1. Identify matching realtime deduction events
      const matchedEvents = realtimeDeductions.filter(ev => {
        if (targetId && ev.id === targetId) return true;
        if (targetTicket && (ev.deliveryNumber === targetTicket || ev.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits)) return true;
        if (cleanTargetDigits && ev.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits) return true;
        if (cleanFn && ev.flightNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFn) return true;
        return false;
      });

      // 2. Refund customer balance(s)
      let totalRefunded = 0;
      if (matchedEvents.length > 0) {
        matchedEvents.forEach(ev => {
          totalRefunded += ev.amountDeducted;
          setCustomers(prev =>
            prev.map(c => {
              if (c.id === ev.customerId) {
                const nextAdvance =
                  c.classification === 'ADVANCE'
                    ? Number((c.advanceBalance + ev.amountDeducted).toFixed(2))
                    : c.advanceBalance;
                const nextRunning = Number((c.runningBalance + ev.amountDeducted).toFixed(2));
                const nextLiters =
                  c.balanceLiters !== undefined
                    ? Math.round(c.balanceLiters + ev.volumeLiters)
                    : undefined;
                const updatedCust: CustomerAccount = {
                  ...c,
                  advanceBalance: nextAdvance,
                  runningBalance: nextRunning,
                  balanceLiters: nextLiters,
                  outstandingReceipts:
                    c.classification === 'CREDIT' && nextRunning < 0
                      ? Math.abs(nextRunning)
                      : 0
                };
                supabaseService.upsertFinCustomers([updatedCust]).catch(err => {
                  console.warn('[Finance] Failed to sync refunded balance to Supabase:', err);
                });
                return updatedCust;
              }
              return c;
            })
          );
        });

        // Drop matched events from state
        setRealtimeDeductions(prev =>
          prev.filter(ev => !matchedEvents.some(m => m.id === ev.id))
        );
      } else {
        // Fallback: If no event in realtimeDeductions, check in fuelRequests
        const matchedReqs = fuelRequests.filter(req => {
          if (targetTicket && (req.deliveryNumber === targetTicket || req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits)) return true;
          if (cleanTargetDigits && req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits) return true;
          if (cleanFn && req.flightNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFn) return true;
          return false;
        });

        if (matchedReqs.length > 0) {
          matchedReqs.forEach(req => {
            totalRefunded += req.amount;
            setCustomers(prev =>
              prev.map(c => {
                if (c.id === req.customerId) {
                  const nextAdvance =
                    c.classification === 'ADVANCE'
                      ? Number((c.advanceBalance + req.amount).toFixed(2))
                      : c.advanceBalance;
                  const nextRunning = Number((c.runningBalance + req.amount).toFixed(2));
                  const nextLiters =
                    c.balanceLiters !== undefined
                      ? Math.round(c.balanceLiters + req.quantityLiters)
                      : undefined;
                  const updatedCust: CustomerAccount = {
                    ...c,
                    advanceBalance: nextAdvance,
                    runningBalance: nextRunning,
                    balanceLiters: nextLiters
                  };
                  supabaseService.upsertFinCustomers([updatedCust]).catch(console.warn);
                  return updatedCust;
                }
                return c;
              })
            );
          });
        }
      }

      // 3. Remove matched entries from fuelRequests
      setFuelRequests(prev =>
        prev.filter(req => {
          if (targetTicket && (req.deliveryNumber === targetTicket || req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits)) return false;
          if (cleanTargetDigits && req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanTargetDigits) return false;
          if (cleanFn && req.flightNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanFn) return false;
          return true;
        })
      );

      // 4. Remove ticket from fms_fin_deducted_tickets in localStorage
      try {
        const rawTickets = localStorage.getItem('fms_fin_deducted_tickets');
        if (rawTickets) {
          const ticketList: string[] = JSON.parse(rawTickets);
          const filtered = ticketList.filter(
            t => t !== targetTicket && t !== cleanTargetDigits && t !== targetId
          );
          localStorage.setItem('fms_fin_deducted_tickets', JSON.stringify(filtered));
        }
      } catch {}

      // 5. Blacklist in fms_deleted_log_ids so it won't be resurrected
      try {
        const rawDel = localStorage.getItem('fms_deleted_log_ids');
        const delList: string[] = rawDel ? JSON.parse(rawDel) : [];
        if (targetTicket && !delList.includes(targetTicket)) delList.push(targetTicket);
        if (cleanTargetDigits && !delList.includes(cleanTargetDigits)) delList.push(cleanTargetDigits);
        if (targetId && !delList.includes(targetId)) delList.push(targetId);
        localStorage.setItem('fms_deleted_log_ids', JSON.stringify(delList.slice(-500)));
      } catch {}

      return {
        success: true,
        message: `Rollback completed. Refunded $${totalRefunded.toLocaleString()} to customer balance.`,
        refundedAmount: totalRefunded
      };
    },
    [realtimeDeductions, fuelRequests]
  );

  // Update a flight job deduction when modified/edited in Log History
  const updateFlightDeduction = useCallback(
    (id: string, updates: Partial<FlightLog>, previousDeliveryNumber?: string) => {
      const prevTicket = (previousDeliveryNumber || '').trim();
      const cleanPrevTicket = prevTicket.replace(/^MLE-/, '').trim();
      const newTicket = (updates.deliveryNumber || '').trim();
      const cleanNewTicket = newTicket.replace(/^MLE-/, '').trim();
      const newFn = (updates.flightNumber || '').trim();
      const newVol = Number(updates.volume);

      let adjusted = false;

      // 1. Update matching realtimeDeductions event
      setRealtimeDeductions(prev =>
        prev.map(ev => {
          const isMatch =
            (id && ev.id === id) ||
            (prevTicket && (ev.deliveryNumber === prevTicket || ev.deliveryNumber.replace(/^MLE-/, '').trim() === cleanPrevTicket)) ||
            (newTicket && (ev.deliveryNumber === newTicket || ev.deliveryNumber.replace(/^MLE-/, '').trim() === cleanNewTicket));

          if (!isMatch) return ev;

          adjusted = true;
          const oldVol = ev.volumeLiters;
          const volumeDiff = !isNaN(newVol) && newVol > 0 ? newVol - oldVol : 0;

          if (volumeDiff !== 0) {
            setCustomers(custs =>
              custs.map(c => {
                if (c.id === ev.customerId) {
                  const pricePerLiter = c.defaultPricePerLiter || 1.19197;
                  const amountDiff = Number((volumeDiff * pricePerLiter).toFixed(2));
                  const nextAdvance =
                    c.classification === 'ADVANCE'
                      ? Number((c.advanceBalance - amountDiff).toFixed(2))
                      : c.advanceBalance;
                  const nextRunning = Number((c.runningBalance - amountDiff).toFixed(2));
                  const nextLiters =
                    c.balanceLiters !== undefined
                      ? Math.max(0, c.balanceLiters - volumeDiff)
                      : undefined;
                  const updatedCust: CustomerAccount = {
                    ...c,
                    advanceBalance: nextAdvance,
                    runningBalance: nextRunning,
                    balanceLiters: nextLiters
                  };
                  supabaseService.upsertFinCustomers([updatedCust]).catch(console.warn);
                  return updatedCust;
                }
                return c;
              })
            );
          }

          const price = ev.amountDeducted / (oldVol || 1);
          const newAmount = !isNaN(newVol) && newVol > 0 ? Number((newVol * price).toFixed(2)) : ev.amountDeducted;

          return {
            ...ev,
            deliveryNumber: newTicket || ev.deliveryNumber,
            flightNumber: newFn || ev.flightNumber,
            volumeLiters: !isNaN(newVol) && newVol > 0 ? newVol : ev.volumeLiters,
            amountDeducted: newAmount
          };
        })
      );

      // 2. Update matching fuelRequests
      setFuelRequests(prev =>
        prev.map(req => {
          const isMatch =
            (prevTicket && (req.deliveryNumber === prevTicket || req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanPrevTicket)) ||
            (newTicket && (req.deliveryNumber === newTicket || req.deliveryNumber.replace(/^MLE-/, '').trim() === cleanNewTicket)) ||
            (id && req.id === `fr-${id}`);

          if (!isMatch) return req;

          const updatedReq: FuelRequest = {
            ...req,
            deliveryNumber: newTicket || req.deliveryNumber,
            flightNumber: (newFn || req.flightNumber).toUpperCase(),
            quantityLiters: !isNaN(newVol) && newVol > 0 ? newVol : req.quantityLiters,
            amount:
              !isNaN(newVol) && newVol > 0
                ? Number((newVol * req.pricePerLiter).toFixed(2))
                : req.amount
          };
          supabaseService.updateFinFuelRequest(req.id, updatedReq).catch(console.warn);
          return updatedReq;
        })
      );

      return {
        success: true,
        message: adjusted ? 'Flight deduction updated successfully.' : 'No matching deduction found to update.'
      };
    },
    []
  );

  // Auto-purge any deleted tickets (e.g. MLE-070780) from realtimeDeductions on load
  useEffect(() => {
    try {
      const rawDel = localStorage.getItem('fms_deleted_log_ids');
      const deletedIds: string[] = rawDel ? JSON.parse(rawDel) : [];
      const targetPurge = Array.from(new Set([...deletedIds, 'MLE-070780', '070780', '70780']));
      
      const toRollback = realtimeDeductions.filter(ev => {
        const ticketDigits = (ev.deliveryNumber || '').toUpperCase().replace(/^MLE-/, '');
        return targetPurge.some(del => {
          const dUpper = String(del).toUpperCase();
          const dDigits = dUpper.replace(/^MLE-/, '');
          return ev.id === dUpper || ev.deliveryNumber === dUpper || ticketDigits === dDigits;
        });
      });

      if (toRollback.length > 0) {
        toRollback.forEach(ev => {
          rollbackFlightDeduction({ id: ev.id, deliveryNumber: ev.deliveryNumber, flightNumber: ev.flightNumber });
        });
      }
    } catch (e) {
      console.warn('[Finance] Auto-purge deleted deductions warning:', e);
    }
  }, [realtimeDeductions, rollbackFlightDeduction]);

  // Global listeners for flight-log-deleted and flight-log-updated events
  useEffect(() => {
    const handleFlightLogDeleted = (evt: Event) => {
      const customEvt = evt as CustomEvent<any>;
      if (customEvt.detail) {
        rollbackFlightDeduction(customEvt.detail);
      }
    };

    const handleFlightLogUpdated = (evt: Event) => {
      const customEvt = evt as CustomEvent<any>;
      if (customEvt.detail) {
        const { id, updates, previousDeliveryNumber } = customEvt.detail;
        updateFlightDeduction(id, updates || {}, previousDeliveryNumber);
      }
    };

    window.addEventListener('fms:flight-log-deleted', handleFlightLogDeleted);
    window.addEventListener('fms:flight-log-updated', handleFlightLogUpdated);

    return () => {
      window.removeEventListener('fms:flight-log-deleted', handleFlightLogDeleted);
      window.removeEventListener('fms:flight-log-updated', handleFlightLogUpdated);
    };
  }, [rollbackFlightDeduction, updateFlightDeduction]);

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
    localStorage.removeItem('fms_fin_deducted_tickets');
    localStorage.removeItem('fms_fin_realtime_deductions');
    localStorage.removeItem('fms_fuel_rates_v1');
    
    // Hard Reload mock lists with full airline holdings & email directory
    setFuelRates(DEFAULT_FUEL_RATES);
    setCustomers(DEFAULT_CUSTOMER_ACCOUNTS);
    setRealtimeDeductions([]);
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
      realtimeDeductions,
      
      // Jet A-1 Fuel Rates Schedule
      fuelRates,
      activeUsdToMvrRate,
      updateFuelRate,
      addFuelRate,
      deleteFuelRate,
      getActiveFuelRate,
      
      // Actions
      uploadSwiftCopy,
      reviewSwiftCopy,
      syncOracleReceipt,
      submitFuelRequest,
      upsertCustomerAccount,
      deleteCustomerAccount,
      resolveCustomerByFlightOrAirline,
      deductFlightUpliftRealtime,
      rollbackFlightDeduction,
      updateFlightDeduction,
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
