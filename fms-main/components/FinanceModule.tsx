import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../utils/haptics';
import { 
  useFinanceData, 
  CustomerClassification, 
  CustomerAccount, 
  AirlineHolding, 
  FuelRequest, 
  MpdSale,
  FuelRateRecord,
  CustomerCategory 
} from '../context/FinanceDataContext';
import { useNotification } from '../context/NotificationContext';
import { sendFlightJobEmail } from '../services/invoicePdfService';
import { 
  DollarSign, FileText, Upload, CheckCircle, RefreshCw, BarChart2, Briefcase, 
  FileSpreadsheet, AlertTriangle, Printer, Download, ChevronRight, PlusCircle, 
  Layers, Scale, ListTodo, Shield, Trash2, ArrowUpRight, Search, Eye, X,
  Plane, Mail, Edit3, Zap, Send, Building2, ChevronDown, ChevronUp, Tag, Coins, Percent
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';

const FINANCE_TABS = [
  { id: 'balances',    label: 'Balances & SWIFTs',     icon: DollarSign },
  { id: 'accounts',    label: 'Accounts & Airlines',   icon: Plane },
  { id: 'billing',     label: 'Invoicing & FIFO',      icon: FileText },
  { id: 'variance',    label: 'Variance & COGS',       icon: Scale },
  { id: 'procurement', label: 'Duty & Procurement',    icon: Layers },
  { id: 'reports',     label: 'Financial Reports',     icon: FileSpreadsheet },
] as const;

export const FinanceModule: React.FC = () => {
  const { 
    customers, upcomingPayments, invoices, receipts, proformaRegister, 
    fuelRequests, varianceLogs, procurementPRs, surcharges, mpdSales, customsShipments,
    realtimeDeductions,
    fuelRates, activeUsdToMvrRate, updateFuelRate, addFuelRate, deleteFuelRate,
    reviewSwiftCopy, syncOracleReceipt, runBillingProcess, applyFIFOLogic, 
    generateProforma, approveVariance, createProcurementPR, verifyVendorInvoice, 
    raisePO, enterAPInvoice, addSurcharge, resetAllFinanceMockData,
    upsertCustomerAccount, deleteCustomerAccount,
    rollbackFlightDeduction
  } = useFinanceData();

  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'balances' | 'accounts' | 'billing' | 'variance' | 'procurement' | 'reports'>('balances');
  
  // Radio button slider references & state for top navigation tabs
  const tabBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabSlider, setTabSlider] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updateTabSlider = useCallback(() => {
    const idx = FINANCE_TABS.findIndex(t => t.id === activeTab);
    const btn = tabBtnRefs.current[idx];
    if (btn) {
      setTabSlider({
        left: btn.offsetLeft,
        top: btn.offsetTop,
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        ready: true,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    updateTabSlider();
    const frame = requestAnimationFrame(updateTabSlider);
    const timer1 = setTimeout(updateTabSlider, 60);
    const timer2 = setTimeout(updateTabSlider, 200);
    window.addEventListener('resize', updateTabSlider);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateTabSlider);
    };
  }, [updateTabSlider]);

  // Collapsible Customer Accounts state
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({});

  // Category filter state for Customer Credit & Balances
  const [balanceCategoryFilter, setBalanceCategoryFilter] = useState<CustomerCategory | 'ALL'>('ALL');

  // Fuel Rates Schedule Modal state
  const [showFuelRatesModal, setShowFuelRatesModal] = useState(false);
  const [editingFuelRate, setEditingFuelRate] = useState<FuelRateRecord | null>(null);
  const [rateAirline, setRateAirline] = useState('');
  const [rateDate, setRateDate] = useState('1-Mar-23');
  const [rateUsd, setRateUsd] = useState('1.85');
  const [rateMvr, setRateMvr] = useState('28.527');
  const [rateCurrency, setRateCurrency] = useState<'USD' | 'MVR'>('USD');
  const [rateCategory, setRateCategory] = useState<FuelRateRecord['category']>('INT');
  const [rateNotes, setRateNotes] = useState('');
  
  // Local state for forms
  const [searchQuery, setSearchQuery] = useState('');
  const [oracleCustId, setOracleCustId] = useState('');
  const [oracleRef, setOracleRef] = useState('');
  const [oracleAmount, setOracleAmount] = useState('');
  
  const [proformaCustId, setProformaCustId] = useState('');
  const [proformaAmount, setProformaAmount] = useState('');
  const [proformaPeriod, setProformaPeriod] = useState('June 1 - June 15');

  const [prFuelType, setPrFuelType] = useState('Jet A-1');
  const [prQty, setPrQty] = useState('');
  const [prPlatts, setPrPlatts] = useState('85.00');

  const [surchargeGrn, setSurchargeGrn] = useState('');
  const [surchargeAmt, setSurchargeAmt] = useState('');
  const [surchargeNotes, setSurchargeNotes] = useState('');

  const [selectedReport, setSelectedReport] = useState<string>('online_jeta1');
  const [salesReportType, setSalesReportType] = useState<'JETA1' | 'MPD'>('JETA1');
  const [ledgerCustId, setLedgerCustId] = useState('c1');

  // Month-end physical stock upload trigger
  const [varianceIdForUpload, setVarianceIdForUpload] = useState<string | null>(null);

  // Delivery ticket details modal state for "TAX INVOICE" mockup
  const [selectedTicket, setSelectedTicket] = useState<FuelRequest | MpdSale | null>(null);

  // Customer Account & Airline Email Directory Editor State
  const [editingCustomer, setEditingCustomer] = useState<CustomerAccount | null>(null);
  const [newAirlineCode, setNewAirlineCode] = useState('');
  const [newAirlineName, setNewAirlineName] = useState('');
  const [newAirlineJobEmails, setNewAirlineJobEmails] = useState('');
  const [newAirlineBillingEmails, setNewAirlineBillingEmails] = useState('');
  const [newAirlineRegs, setNewAirlineRegs] = useState('');

  // MOCK COGS Chart Data
  const cogsChartData = [
    { name: 'Jan', Sales: 2400000, COGS: 1800000, Margin: 600000 },
    { name: 'Feb', Sales: 2700000, COGS: 2000000, Margin: 700000 },
    { name: 'Mar', Sales: 3100000, COGS: 2300000, Margin: 800000 },
    { name: 'Apr', Sales: 2900000, COGS: 2150000, Margin: 750000 },
    { name: 'May', Sales: 3500000, COGS: 2600000, Margin: 900000 },
  ];

  // Filters (searches customer name, classification, held airlines, and emails)
  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesNameOrClass =
      c.name.toLowerCase().includes(q) || c.classification.toLowerCase().includes(q);
    const matchesAirlines =
      (c.associatedAirlines || []).some(a => a.toLowerCase().includes(q)) ||
      (c.airlineHoldings || []).some(
        h =>
          h.code.toLowerCase().includes(q) ||
          h.name.toLowerCase().includes(q) ||
          (h.flightJobEmails || []).some(e => e.toLowerCase().includes(q)) ||
          (h.billingEmails || []).some(e => e.toLowerCase().includes(q))
      );
    const matchesEmails = (c.accountEmails || []).some(e => e.toLowerCase().includes(q));
    return matchesNameOrClass || matchesAirlines || matchesEmails;
  });

  // Check if all filtered customers are currently expanded
  const isAllAccountsExpanded = 
    filteredCustomers.length > 0 && 
    filteredCustomers.every(c => collapsedAccounts[c.id] === false);

  const toggleAllAccounts = () => {
    const all: Record<string, boolean> = {};
    const nextCollapse = isAllAccountsExpanded;
    filteredCustomers.forEach(c => {
      all[c.id] = nextCollapse;
    });
    setCollapsedAccounts(all);
  };

  const openNewCustomerModal = () => {
    setEditingCustomer({
      id: `cust-${Date.now()}`,
      name: '',
      classification: 'ADVANCE',
      openingBalance: 0,
      paymentsReceived: 0,
      advanceBalance: 0,
      creditLimit: 0,
      estimated5DaysSales: 50000,
      runningBalance: 0,
      outstandingReceipts: 0,
      openingBalanceLiters: 0,
      balanceLiters: 0,
      defaultPricePerLiter: 1.19197,
      autoDeductOnUplift: true,
      associatedAirlines: [],
      associatedRegs: [],
      accountEmails: [],
      airlineHoldings: []
    });
  };

  const handleAddAirlineHoldingToEditor = () => {
    if (!editingCustomer) return;
    if (!newAirlineCode.trim() || !newAirlineName.trim()) {
      notify('Please enter both Airline Code (e.g. EK, BA) and Airline Name.', 'warning');
      return;
    }
    const code = newAirlineCode.toUpperCase().trim();
    const jobEmails = newAirlineJobEmails
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    const billEmails = newAirlineBillingEmails
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    const regs = newAirlineRegs
      .split(',')
      .map(r => r.toUpperCase().trim())
      .filter(Boolean);

    const newHolding: AirlineHolding = {
      code,
      name: newAirlineName.trim(),
      flightJobEmails: jobEmails,
      billingEmails: billEmails.length > 0 ? billEmails : jobEmails,
      aircraftRegs: regs,
      autoSendFlightJob: true,
      autoSendInvoice: true
    };

    const existingHoldings = editingCustomer.airlineHoldings || [];
    const updatedHoldings = existingHoldings.some(h => h.code.toUpperCase() === code)
      ? existingHoldings.map(h => (h.code.toUpperCase() === code ? newHolding : h))
      : [...existingHoldings, newHolding];

    setEditingCustomer({
      ...editingCustomer,
      airlineHoldings: updatedHoldings
    });
    setNewAirlineCode('');
    setNewAirlineName('');
    setNewAirlineJobEmails('');
    setNewAirlineBillingEmails('');
    setNewAirlineRegs('');
  };

  const handleRemoveAirlineHoldingFromEditor = (code: string) => {
    if (!editingCustomer) return;
    setEditingCustomer({
      ...editingCustomer,
      airlineHoldings: (editingCustomer.airlineHoldings || []).filter(h => h.code !== code)
    });
  };

  const handleSaveCustomerAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) {
      notify('Customer Account Name is required.', 'warning');
      return;
    }
    upsertCustomerAccount(editingCustomer);
    notify(`Saved Customer Account "${editingCustomer.name}" with ${(editingCustomer.airlineHoldings || []).length} held airline(s).`, 'success');
    setEditingCustomer(null);
  };


  const handleSyncReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oracleCustId || !oracleRef || !oracleAmount) {
      notify('Please fill in all sync fields.', 'warning');
      return;
    }
    const amt = parseFloat(oracleAmount);
    syncOracleReceipt(oracleCustId, oracleRef, amt);
    notify(`Synced Oracle receipt ${oracleRef} successfully.`, 'success');
    setOracleRef('');
    setOracleAmount('');
  };

  const handleRunBilling = (classif: CustomerClassification) => {
    runBillingProcess(classif);
    notify(`Billing Run executed successfully for ${classif} customers.`, 'success');
  };

  const handleApplyFIFO = () => {
    applyFIFOLogic();
    notify('FIFO Allocation triggered in Oracle Ledger.', 'success');
  };

  const handleGenerateProforma = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proformaCustId || !proformaAmount) {
      notify('Please enter proforma amount.', 'warning');
      return;
    }
    generateProforma(proformaCustId, proformaPeriod, parseFloat(proformaAmount));
    notify('Proforma Invoice logged in Register.', 'success');
    setProformaAmount('');
  };

  const handleCreatePR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prQty || !prPlatts) {
      notify('Please enter quantity and Platts rate.', 'warning');
      return;
    }
    createProcurementPR(prFuelType, parseInt(prQty), parseFloat(prPlatts));
    notify('Procurement PR raised successfully.', 'success');
    setPrQty('');
  };

  const handleAddSurcharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!surchargeGrn || !surchargeAmt) {
      notify('Please enter GRN Reference and Surcharge amount.', 'warning');
      return;
    }
    addSurcharge(surchargeGrn, parseFloat(surchargeAmt), surchargeNotes);
    notify('GRN updated with Surcharge bill.', 'success');
    setSurchargeGrn('');
    setSurchargeAmt('');
    setSurchargeNotes('');
  };

  const handleApproveVariance = (id: string, isT3: boolean) => {
    if (isT3) {
      setVarianceIdForUpload(id);
    } else {
      approveVariance(id, 'Variance within expected operational limits. Approved.');
      notify('Variance approved and entry sent to Oracle.', 'success');
    }
  };

  const handleUploadPhysicalCheck = (id: string) => {
    approveVariance(id, 'Physical stock verify completed. Reconciled.', true);
    setVarianceIdForUpload(null);
    notify('Physical closing balance uploaded. Variance fully approved in Oracle.', 'success');
  };

  return (
    <div className="p-3 sm:p-5 lg:p-8 space-y-6 lg:space-y-8 max-w-full min-w-0 overflow-x-hidden animate-in slide-in-from-bottom-2 duration-300">
      
      {/* Top Title & Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-outline pb-6 min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 inline-block">
            INTEGRATED ERP PORTAL
          </span>
          <h2 className="headline-lg text-on-surface tracking-tighter uppercase mt-3 break-words">
            FINANCE & BILLING DIVISION
          </h2>
          <p className="text-on-surface-dim uppercase tracking-wider text-[9px] font-black opacity-60">
            Real-time Flight Job Deduction • Multi-Airline Accounts • Airline Email Dispatch • Oracle Sync
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingFuelRate(null);
              setRateAirline('');
              setRateDate('1-Mar-23');
              setRateUsd('1.85');
              setRateMvr('28.527');
              setRateCurrency('USD');
              setRateCategory('INT');
              setRateNotes('');
              setShowFuelRatesModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 min-h-[42px]"
          >
            <Coins className="w-3.5 h-3.5" />
            Fuel Rates Schedule (USD & MVR)
          </button>
          <button
            onClick={openNewCustomerModal}
            className="flex items-center gap-2 kinetic-gradient text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-premium transition-all active:scale-95 min-h-[42px]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Customer Account
          </button>
          <button 
            onClick={() => {
              resetAllFinanceMockData();
              notify('Financial simulator database reset.', 'info');
            }}
            className="flex items-center gap-2 border border-outline hover:bg-surface-dim px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface transition-all active:scale-95 min-h-[42px]"
          >
            <Trash2 className="w-3.5 h-3.5 text-error" />
            Reset Data
          </button>
        </div>
      </div>

      {/* Tablet & Mobile Safe Responsive Tabs Grid with Animated Radio Slider */}
      <div className="relative bg-surface-dim p-1.5 rounded-2xl border border-outline grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 w-full shadow-inner select-none overflow-hidden">
        {/* Animated Kinetic Gradient Radio Slider matching System Settings */}
        {tabSlider.ready && (
          <div
            className="absolute rounded-xl kinetic-gradient shadow-premium transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform pointer-events-none"
            style={{
              left: `${tabSlider.left}px`,
              top: `${tabSlider.top}px`,
              width: `${tabSlider.width}px`,
              height: `${tabSlider.height}px`,
            }}
          />
        )}

        {FINANCE_TABS.map((t, idx) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={el => { tabBtnRefs.current[idx] = el; }}
              type="button"
              onClick={() => {
                haptic('TAP');
                setActiveTab(t.id as any);
              }}
              className={`relative z-10 min-h-[44px] px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors duration-300 cursor-pointer select-none ${
                isActive
                  ? 'text-white font-black'
                  : 'text-on-surface-dim hover:text-on-surface hover:bg-surface-lowest/40 font-bold'
              } ${!tabSlider.ready && isActive ? 'kinetic-gradient shadow-premium' : ''}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Container — min-w-0 prevents CSS Grid intrinsic width expansion on tablets */}
      <div className="grid grid-cols-1 gap-6 lg:gap-8 min-w-0 max-w-full">
        
        {/* TAB 1: Balances & SWIFT Copy Review */}
        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 min-w-0">
            {/* Customer accounts table — min-w-0 ensures overflow-x-auto scrolls inside the card on tablets */}
            <div className="lg:col-span-2 min-w-0 max-w-full bg-surface-lowest border border-outline p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-premium space-y-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 min-w-0">
                <div className="min-w-0">
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Customer Credit & Balances</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">
                    Categorized Accounts • Real-time deduction on flight job entry • Airline codes quick reference
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-outline bg-surface-dim px-3 py-2 rounded-xl w-full sm:max-w-xs min-h-[42px]">
                    <Search className="w-4 h-4 opacity-40 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search account, airline (EK, BA)..."
                      className="bg-transparent border-none outline-none text-xs font-bold text-on-surface w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Category Filter Pills Matching Screenshot 5 */}
              {(() => {
                const getCategoryForCustomer = (c: CustomerAccount): CustomerCategory => {
                  if (c.category) return c.category;
                  if (c.classification === 'CREDIT') {
                    if (c.name.toUpperCase().includes('IAS') || c.name.toUpperCase().includes('ISLAND AVIATION')) {
                      return 'IAS_CREDIT';
                    }
                    return 'CREDIT_GENERAL';
                  }
                  if (c.currency === 'MVR' || c.name.toUpperCase().includes('FLY ME')) {
                    return 'ADVANCE_DOM_MVR';
                  }
                  if (
                    c.name.toUpperCase().includes('TMA') ||
                    c.name.toUpperCase().includes('MANTA') ||
                    c.name.toUpperCase().includes('DOM')
                  ) {
                    return 'ADVANCE_DOM_USD';
                  }
                  return 'ADVANCE_INT_USD';
                };

                const CATEGORIES_DEF: { key: CustomerCategory; label: string; headerBg: string; currency: 'USD' | 'MVR' }[] = [
                  {
                    key: 'ADVANCE_INT_USD',
                    label: 'ADVANCE INT CUSTOMERS USD',
                    headerBg: 'bg-blue-600 text-white',
                    currency: 'USD'
                  },
                  {
                    key: 'ADVANCE_DOM_USD',
                    label: 'ADVANCE DOM CUSTOMERS USD',
                    headerBg: 'bg-cyan-700 text-white',
                    currency: 'USD'
                  },
                  {
                    key: 'ADVANCE_DOM_MVR',
                    label: 'ADVANCE DOM CUSTOMERS MVR',
                    headerBg: 'bg-teal-700 text-white',
                    currency: 'MVR'
                  },
                  {
                    key: 'IAS_CREDIT',
                    label: 'ISLAND AVIATION SERVICES (IAS / CREDIT)',
                    headerBg: 'bg-slate-900 text-white border-t-2 border-primary',
                    currency: 'USD'
                  },
                  {
                    key: 'CREDIT_GENERAL',
                    label: 'OTHER CREDIT CUSTOMERS',
                    headerBg: 'bg-slate-800 text-white',
                    currency: 'USD'
                  }
                ];

                const activeCats = balanceCategoryFilter === 'ALL'
                  ? CATEGORIES_DEF
                  : CATEGORIES_DEF.filter(cat => cat.key === balanceCategoryFilter);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <button
                        onClick={() => setBalanceCategoryFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all min-h-[34px] ${
                          balanceCategoryFilter === 'ALL'
                            ? 'kinetic-gradient text-white shadow-premium'
                            : 'bg-surface-dim hover:bg-surface-dim/80 text-on-surface-dim border border-outline'
                        }`}
                      >
                        All Categories ({filteredCustomers.length})
                      </button>
                      {CATEGORIES_DEF.map(cat => {
                        const count = filteredCustomers.filter(c => getCategoryForCustomer(c) === cat.key).length;
                        return (
                          <button
                            key={cat.key}
                            onClick={() => setBalanceCategoryFilter(cat.key)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all min-h-[34px] ${
                              balanceCategoryFilter === cat.key
                                ? 'kinetic-gradient text-white shadow-premium'
                                : 'bg-surface-dim hover:bg-surface-dim/80 text-on-surface-dim border border-outline'
                            }`}
                          >
                            {cat.label} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="w-full overflow-x-auto touch-pan-x -mx-1 px-1 pb-2 custom-scrollbar">
                      <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-outline text-[10px] font-black uppercase tracking-widest text-on-surface-dim">
                            <th className="pb-3 pr-3">Customer & Held Airlines</th>
                            <th className="pb-3 px-2">Class</th>
                            <th className="pb-3 px-2 text-right">Advance / Running Bal</th>
                            <th className="pb-3 px-2 text-right">Volume (L)</th>
                            <th className="pb-3 px-2 text-right">5-Day Sales Est.</th>
                            <th className="pb-3 px-2 text-right">Credit Limit</th>
                            <th className="pb-3 px-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline">
                          {activeCats.map(cat => {
                            const catCustomers = filteredCustomers.filter(c => getCategoryForCustomer(c) === cat.key);
                            if (catCustomers.length === 0 && balanceCategoryFilter !== cat.key) return null;

                            const subtotalBal = catCustomers.reduce(
                              (sum, c) => sum + (c.classification === 'ADVANCE' ? c.advanceBalance : c.runningBalance),
                              0
                            );
                            const subtotalLiters = catCustomers.reduce((sum, c) => sum + (c.balanceLiters || 0), 0);
                            const currSymbol = cat.currency === 'MVR' ? 'MVR ' : '$';

                            return (
                              <React.Fragment key={cat.key}>
                                {/* Category Header Bar Matching Screenshot 5 */}
                                <tr className={`${cat.headerBg} font-black text-xs uppercase tracking-wider shadow-sm`}>
                                  <td colSpan={7} className="py-2.5 px-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-white/80"></span>
                                        <span className="font-black text-white text-[11px] tracking-wider">{cat.label}</span>
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-black/25 text-white/95 border border-white/20">
                                          {catCustomers.length} Account{catCustomers.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-bold text-white/90 flex items-center gap-4">
                                        <span>
                                          Subtotal: <strong className="text-white font-mono">{currSymbol}{subtotalBal.toLocaleString()}</strong>
                                        </span>
                                        {subtotalLiters > 0 && (
                                          <span>
                                            Quota: <strong className="text-white font-mono">{subtotalLiters.toLocaleString()} L</strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {catCustomers.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="py-4 text-center text-on-surface-dim italic text-xs">
                                      No accounts found in this category.
                                    </td>
                                  </tr>
                                ) : (
                                  catCustomers.map(c => {
                                    const isLow = c.classification === 'ADVANCE' && c.advanceBalance < c.estimated5DaysSales;
                                    const holdings = c.airlineHoldings || [];
                                    const currPrefix = c.currency === 'MVR' ? 'MVR ' : '$';

                                    return (
                                      <tr key={c.id} className="hover:bg-surface-dim/40 transition-colors">
                                        {/* Customer Name & Quick Reference Airline Codes */}
                                        <td className="py-3 pr-3">
                                          <div className="font-black text-on-surface text-xs">{c.name}</div>
                                          <div className="flex flex-wrap items-center gap-1 mt-1">
                                            {holdings.length > 0 ? (
                                              holdings.map(h => (
                                                <span
                                                  key={h.code}
                                                  title={`${h.code} — ${h.name} (${(h.flightJobEmails || []).join(', ')})`}
                                                  className="px-1.5 py-0.5 rounded bg-gradient-to-r from-sky-500 to-blue-600 text-white border border-sky-400/30 text-[9px] font-black uppercase tracking-wider font-mono shadow-sm"
                                                >
                                                  {h.code}
                                                </span>
                                              ))
                                            ) : (
                                              (c.associatedAirlines || []).slice(0, 6).map(code => (
                                                <span
                                                  key={code}
                                                  className="px-1.5 py-0.5 rounded bg-gradient-to-r from-sky-500 to-blue-600 text-white border border-sky-400/30 text-[9px] font-black uppercase font-mono shadow-sm"
                                                >
                                                  {code}
                                                </span>
                                              ))
                                            )}
                                          </div>
                                        </td>

                                        {/* Classification */}
                                        <td className="py-3 px-2">
                                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border whitespace-nowrap
                                            ${c.classification === 'ADVANCE' ? 'bg-primary/10 text-primary border-primary/20' : 
                                              c.classification === 'CREDIT' ? 'bg-warning/10 text-warning border-warning/20' : 
                                              'bg-success/10 text-success border-success/20'}`}>
                                            {c.classification}
                                          </span>
                                        </td>

                                        {/* Advance / Running Balance */}
                                        <td className="py-3 px-2 text-right font-bold whitespace-nowrap">
                                          {c.classification === 'ADVANCE' ? (
                                            <span className="text-primary font-mono">{currPrefix}{c.advanceBalance.toLocaleString()}</span>
                                          ) : (
                                            <span className={`font-mono ${c.runningBalance < 0 ? 'text-warning' : 'text-on-surface'}`}>
                                              {currPrefix}{c.runningBalance.toLocaleString()}
                                            </span>
                                          )}
                                        </td>

                                        {/* Quota Liters */}
                                        <td className="py-3 px-2 text-right font-bold text-on-surface whitespace-nowrap font-mono">
                                          {c.balanceLiters !== undefined ? `${c.balanceLiters.toLocaleString()} L` : '-'}
                                        </td>

                                        {/* 5-Day Sales Estimate */}
                                        <td className="py-3 px-2 text-right font-bold text-on-surface-dim whitespace-nowrap font-mono">
                                          {c.classification === 'ADVANCE' || c.classification === 'CREDIT' ? `${currPrefix}${c.estimated5DaysSales.toLocaleString()}` : '-'}
                                        </td>

                                        {/* Credit Limit */}
                                        <td className="py-3 px-2 text-right font-bold text-on-surface-dim whitespace-nowrap font-mono">
                                          {c.classification === 'CREDIT' ? `${currPrefix}${c.creditLimit.toLocaleString()}` : '-'}
                                        </td>

                                        {/* Status */}
                                        <td className="py-3 px-2 text-right whitespace-nowrap">
                                          {isLow ? (
                                            <span className="inline-flex items-center gap-1 text-error font-black uppercase text-[9px] tracking-widest animate-pulse">
                                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> LOW
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-success font-bold uppercase text-[9px] tracking-widest">
                                              <CheckCircle className="w-3.5 h-3.5 shrink-0" /> SECURE
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Side pane: SWIFT copy uploads & Oracle sync */}
            <div className="space-y-8">
              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">SWIFT copies Queue</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Pending Billing review & credit approval</p>
                </div>

                <div className="space-y-4">
                  {upcomingPayments.filter(p => p.status === 'PENDING_REVIEW').length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-8 h-8 text-success opacity-20 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40">No pending SWIFT reviews</p>
                    </div>
                  ) : (
                    upcomingPayments.filter(p => p.status === 'PENDING_REVIEW').map(p => (
                      <div key={p.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-black text-on-surface uppercase">{p.customerName}</h4>
                            <span className="text-[9px] text-on-surface-dim uppercase tracking-widest">REF: {p.referenceNumber}</span>
                          </div>
                          <span className="text-xs font-black text-primary">${p.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => reviewSwiftCopy(p.id, 'REJECT')}
                            className="bg-error/10 hover:bg-error/25 text-error px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => reviewSwiftCopy(p.id, 'APPROVE')}
                            className="kinetic-gradient hover:scale-[1.03] active:scale-95 text-white px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-premium"
                          >
                            Approve FMS Credit
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Oracle Receipt Sync</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Simulate real-time cleared receipt hook</p>
                </div>

                <form onSubmit={handleSyncReceipt} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Customer</label>
                    <select
                      value={oracleCustId}
                      onChange={(e) => setOracleCustId(e.target.value)}
                      className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                    >
                      <option value="">Select Account</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.classification})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Oracle Ref</label>
                      <input
                        type="text"
                        value={oracleRef}
                        onChange={(e) => setOracleRef(e.target.value)}
                        placeholder="REC-908"
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Amount ($)</label>
                      <input
                        type="number"
                        value={oracleAmount}
                        onChange={(e) => setOracleAmount(e.target.value)}
                        placeholder="50000"
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full kinetic-gradient hover:scale-[1.02] active:scale-95 text-white font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium mt-2"
                  >
                    Sync Cleared Receipt
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1B: Customer Accounts Database, Held Airlines, Airline Emails & Real-Time Flight Job Deduction */}
        {activeTab === 'accounts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 min-w-0">
            {/* Left 2 Columns: Customer Accounts & Multi-Airline Email Directory */}
            <div className="lg:col-span-2 min-w-0 space-y-6">
              <div className="bg-surface-lowest border border-outline p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-premium space-y-6 min-w-0 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h3 className="title-md text-on-surface font-black uppercase tracking-tight flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      Customer Accounts & Airline Email Database
                    </h3>
                    <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider mt-0.5">
                      Maps every Customer Account to its held airlines, tail registrations, and dispatch/billing email addresses
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleAllAccounts}
                      className="px-3.5 py-2 rounded-xl border border-outline bg-surface-dim hover:bg-surface-lowest text-[10px] font-black uppercase tracking-wider text-on-surface flex items-center gap-1.5 transition-all min-h-[42px]"
                      title={isAllAccountsExpanded ? "Collapse all customer airline holdings" : "Expand all customer airline holdings"}
                    >
                      {isAllAccountsExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-primary" /> Collapse All
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-primary" /> Expand All
                        </>
                      )}
                    </button>
                    <button
                      onClick={openNewCustomerModal}
                      className="kinetic-gradient text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-premium flex items-center gap-1.5 shrink-0 min-h-[42px]"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add Customer Account
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredCustomers.map(cust => {
                    const holdings = cust.airlineHoldings || [];
                    const isCollapsed = collapsedAccounts[cust.id] !== false;

                    return (
                      <div
                        key={cust.id}
                        className="bg-surface-dim/40 border border-outline rounded-2xl p-4 sm:p-5 space-y-4 hover:border-primary/40 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline/60 pb-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-on-surface uppercase">{cust.name}</h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                                  cust.classification === 'ADVANCE'
                                    ? 'bg-primary/10 text-primary border-primary/20'
                                    : cust.classification === 'CREDIT'
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-success/10 text-success border-success/20'
                                }`}
                              >
                                {cust.classification}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-on-surface-dim">
                              <span>
                                Balance:{' '}
                                <strong className="text-primary font-mono">
                                  {cust.currency === 'MVR' ? 'MVR ' : '$'}{(cust.classification === 'ADVANCE' ? cust.advanceBalance : cust.runningBalance).toLocaleString()}
                                </strong>
                              </span>
                              {cust.balanceLiters !== undefined && (
                                <span>
                                  VolumeQuota: <strong className="text-on-surface font-mono">{cust.balanceLiters.toLocaleString()} L</strong>
                                </span>
                              )}
                              <span>
                                Rate: <strong className="text-on-surface font-mono">{cust.currency === 'MVR' ? 'MVR ' : '$'}{(cust.defaultPricePerLiter || 1.19197).toFixed(5)}/L</strong>
                              </span>
                              {(cust.accountEmails || []).length > 0 && (
                                <span className="inline-flex items-center gap-1 text-on-surface">
                                  <Mail className="w-3 h-3 text-primary" /> {(cust.accountEmails || []).join(', ')}
                                </span>
                              )}
                              {holdings.length > 0 && (
                                <span className="inline-flex items-center gap-1.5 text-on-surface-dim">
                                  <span>Airlines:</span>
                                  <span className="inline-flex items-center gap-1">
                                    {holdings.map(h => (
                                      <span
                                        key={h.code}
                                        className="px-1.5 py-0.2 rounded bg-gradient-to-r from-sky-500 to-blue-600 text-white font-mono text-[8.5px] font-black shadow-sm border border-sky-400/30"
                                        title={h.name}
                                      >
                                        {h.code}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCollapsedAccounts(prev => ({ ...prev, [cust.id]: !isCollapsed }))}
                              className="px-3.5 py-2 rounded-xl bg-surface-dim hover:bg-surface-lowest text-on-surface border border-outline text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 min-h-[38px] transition-all"
                            >
                              {isCollapsed ? (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5 text-primary" /> Show Airlines ({holdings.length})
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5 text-primary" /> Hide Airlines
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setEditingCustomer(cust)}
                              className="px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 min-h-[38px]"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Configure Airlines & Emails
                            </button>
                          </div>
                        </div>

                        {/* Airlines Held by this Customer Account (Expanded only when toggled) */}
                        {!isCollapsed && (
                          <div className="space-y-2.5 animate-in slide-in-from-top-1 duration-200 pt-2 border-t border-outline/40">
                            <div className="text-[9px] font-black uppercase tracking-widest text-on-surface-dim flex items-center gap-1.5">
                              <Plane className="w-3 h-3 text-primary" />
                              Airlines Held by {cust.name} ({holdings.length})
                            </div>
                            {holdings.length === 0 ? (
                              <p className="text-[10px] text-on-surface-dim italic">
                                No structured airlines configured yet. Tap "Configure Airlines & Emails" to add airlines and email routing.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {holdings.map(h => {
                                  const allAirlineEmails = Array.from(
                                    new Set([...(h.flightJobEmails || []), ...(h.billingEmails || [])])
                                  );
                                  return (
                                    <div
                                      key={h.code}
                                      className="bg-surface-lowest border border-outline rounded-xl p-3 flex flex-col justify-between gap-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <span className="px-2 py-0.5 rounded bg-gradient-to-r from-sky-500 to-blue-600 text-white border border-sky-400/30 text-[9px] font-black uppercase tracking-widest mr-1.5 font-mono shadow-sm">
                                            {h.code}
                                          </span>
                                          <span className="text-xs font-black text-on-surface">{h.name}</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            if (allAirlineEmails.length === 0) {
                                              notify(`No email configured for ${h.name}`, 'warning');
                                              return;
                                            }
                                            sendFlightJobEmail(
                                              {
                                                flightNumber: `${h.code}101`,
                                                airline: h.name,
                                                aircraftReg: (h.aircraftRegs && h.aircraftRegs[0]) || 'TBA',
                                                status: 'SCHEDULED / READY FOR UPLIFT',
                                                customerAccountName: cust.name,
                                                classification: cust.classification,
                                                remainingBalance:
                                                  cust.classification === 'ADVANCE' ? cust.advanceBalance : cust.runningBalance
                                              },
                                              allAirlineEmails
                                            );
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0"
                                          title={`Send Flight Job email to ${allAirlineEmails.join(', ')}`}
                                        >
                                          <Send className="w-2.5 h-2.5" /> Email Job
                                        </button>
                                      </div>
                                      <div className="space-y-1 text-[10px]">
                                        <div className="text-on-surface-dim">
                                          <strong className="text-on-surface uppercase text-[9px]">Flight Job Emails:</strong>{' '}
                                          {(h.flightJobEmails || []).length > 0 ? h.flightJobEmails.join(', ') : 'None'}
                                        </div>
                                        <div className="text-on-surface-dim">
                                          <strong className="text-on-surface uppercase text-[9px]">Billing Emails:</strong>{' '}
                                          {(h.billingEmails || []).length > 0 ? h.billingEmails.join(', ') : 'None'}
                                        </div>
                                        {(h.aircraftRegs || []).length > 0 && (
                                          <div className="text-on-surface-dim">
                                            <strong className="text-on-surface uppercase text-[9px]">Aircraft Regs:</strong>{' '}
                                            {h.aircraftRegs?.join(', ')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Real-Time Uplift Deduction Log */}
            <div className="space-y-6 min-w-0">
              {/* Real-Time Deduction Activity Feed */}
              <div className="bg-surface-lowest border border-outline p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-premium space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1 mb-1.5">
                      <Zap className="w-3 h-3" /> Live Apron Sync
                    </span>
                    <h4 className="text-xs font-black uppercase text-on-surface tracking-wider">Real-Time Uplift Deduction Log</h4>
                    <p className="text-[9px] font-bold uppercase text-on-surface-dim">Live balance deductions synced from Into-Plane ops</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black">
                    {realtimeDeductions.length} events
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
                  {realtimeDeductions.length === 0 ? (
                    <div className="text-center py-8 text-[10px] font-bold uppercase text-on-surface-dim opacity-50">
                      No real-time flight job deductions recorded in this session yet.
                    </div>
                  ) : (
                    realtimeDeductions.map(ev => (
                      <div key={ev.id} className="bg-surface-dim/50 border border-outline rounded-2xl p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-primary uppercase">
                            {ev.flightNumber} • Ticket #{ev.deliveryNumber}
                          </span>
                          <span className="font-black text-error">-${ev.amountDeducted.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-on-surface">
                          <span>{ev.customerName} ({ev.airlineName})</span>
                          <span>{ev.volumeLiters.toLocaleString()} L</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-on-surface-dim pt-1 border-t border-outline/30">
                          <span>New Bal: ${ev.newBalance.toLocaleString()}</span>
                          <div className="flex items-center gap-3">
                            {ev.emailsNotified.length > 0 && (
                              <button
                                onClick={() =>
                                  sendFlightJobEmail(
                                    {
                                      flightNumber: ev.flightNumber,
                                      airline: ev.airlineName,
                                      estimatedVolume: ev.volumeLiters,
                                      status: `COMPLETED (Ticket #${ev.deliveryNumber})`,
                                      customerAccountName: ev.customerName,
                                      classification: ev.classification,
                                      remainingBalance: ev.newBalance
                                    },
                                    ev.emailsNotified
                                  )
                                }
                                className="text-primary hover:underline font-black uppercase flex items-center gap-1"
                              >
                                <Mail className="w-2.5 h-2.5" /> Email ({ev.emailsNotified.length})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                rollbackFlightDeduction({
                                  id: ev.id,
                                  deliveryNumber: ev.deliveryNumber,
                                  flightNumber: ev.flightNumber
                                });
                                notify(`Removed deduction for Ticket #${ev.deliveryNumber} and refunded customer balance.`, 'success');
                              }}
                              className="text-error hover:text-error/80 font-black uppercase flex items-center gap-1 hover:underline transition-all"
                              title="Rollback this deduction and refund customer balance"
                            >
                              <Trash2 className="w-2.5 h-2.5" /> Rollback / Refund
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Billing & Invoicing Automation */}
        {activeTab === 'billing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-w-0">
            <div className="lg:col-span-2 space-y-8 min-w-0">
              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Billing Run Operations</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Convert confirmed uplifts into formal invoices</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'ADVANCE', label: 'Advance Customers', desc: 'Runs weekly. Accumulates fuel lifts.', color: 'border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary' },
                    { id: 'CREDIT', label: 'Credit Customers', desc: 'Runs fortnightly/monthly. Standard accounts.', color: 'border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning' },
                    { id: 'CASH', label: 'Cash Customers', desc: 'Runs immediately on reviewed fuel lifts.', color: 'border-success/20 bg-success/5 hover:bg-success/10 text-success' }
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleRunBilling(b.id as any)}
                      className={`border p-5 rounded-2xl text-left space-y-3 transition-all active:scale-98 ${b.color}`}
                    >
                      <h4 className="text-xs font-black uppercase">{b.label}</h4>
                      <p className="text-[10px] leading-relaxed opacity-85">{b.desc}</p>
                      <div className="flex items-center text-[10px] font-black uppercase tracking-wider gap-1.5 pt-2">
                        Execute Billing Run <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-outline/30 pb-4">
                  <div>
                    <h3 className="title-md text-on-surface font-black uppercase tracking-tight">FIFO Receipt Engine</h3>
                    <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Simulates first-in first-out Oracle receipt matching</p>
                  </div>
                  <button
                    onClick={handleApplyFIFO}
                    className="flex items-center gap-2 kinetic-gradient hover:scale-[1.02] active:scale-95 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-premium shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Auto Apply FIFO (Oracle)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-2 border-b border-outline flex justify-between">
                      <span>Outstanding Invoices</span>
                      <span className="text-primary font-black">FIFO Queue</span>
                    </h4>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {invoices.map(inv => (
                        <div key={inv.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">{inv.invoiceNumber}</span>
                            <h5 className="font-bold text-on-surface mt-1">{inv.customerName}</h5>
                            <span className="text-[9px] text-on-surface-dim uppercase tracking-widest">{inv.period}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-on-surface">${inv.amount.toLocaleString()}</span>
                            <div className="mt-1 flex items-center justify-end gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'PAID' ? 'bg-success' : inv.status === 'PARTIALLY_PAID' ? 'bg-warning' : 'bg-error'}`}></span>
                              <span className="text-[8px] font-black uppercase opacity-60">Remaining: ${inv.remainingAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-2 border-b border-outline flex justify-between">
                      <span>Sync Receipts</span>
                      <span className="text-success font-black">Applied Ledger</span>
                    </h4>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {receipts.map(rec => (
                        <div key={rec.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-success">{rec.receiptNumber}</span>
                            <h5 className="font-bold text-on-surface mt-1">{rec.customerName}</h5>
                            <span className="text-[9px] text-on-surface-dim uppercase tracking-widest">Cleared on: {rec.date}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-on-surface">${rec.amount.toLocaleString()}</span>
                            <div className="mt-1 flex items-center justify-end gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${rec.status === 'APPLIED' ? 'bg-success' : 'bg-warning'}`}></span>
                              <span className="text-[8px] font-black uppercase opacity-60">Remaining: ${rec.remainingAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Proforma Register</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Generate fortnightly proformas upon request</p>
                </div>

                <form onSubmit={handleGenerateProforma} className="space-y-4 border-b border-outline pb-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Customer</label>
                    <select
                      value={proformaCustId}
                      onChange={(e) => setProformaCustId(e.target.value)}
                      className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                    >
                      <option value="">Select Account</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Amount ($)</label>
                      <input
                        type="number"
                        value={proformaAmount}
                        onChange={(e) => setProformaAmount(e.target.value)}
                        placeholder="80000"
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Period</label>
                      <input
                        type="text"
                        value={proformaPeriod}
                        onChange={(e) => setProformaPeriod(e.target.value)}
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full kinetic-gradient hover:scale-[1.02] active:scale-95 text-white font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium mt-2"
                  >
                    Generate Proforma
                  </button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-1">Proforma Log Book</h4>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {proformaRegister.map(p => (
                      <div key={p.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary">{p.invoiceNumber}</span>
                          <h5 className="font-bold text-on-surface mt-0.5">{p.customerName}</h5>
                          <span className="text-[9px] text-on-surface-dim uppercase tracking-widest">Period: {p.period}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-on-surface">${p.amount.toLocaleString()}</span>
                          <span className="block text-[8px] opacity-45 uppercase font-bold mt-1">{p.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Month-end Stock Variance & COGS */}
        {activeTab === 'variance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div>
                <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Month-End Inventory Variance</h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Compare SCADA inventory balances against Oracle fuel records</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-success/20 bg-success/5 px-5 py-4 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-black text-success uppercase">Threshold 1 (&lt; 0.15%)</h4>
                  <p className="text-[9px] text-on-surface-dim leading-relaxed">Direct Finance Manager single approval required.</p>
                </div>
                <div className="border border-warning/20 bg-warning/5 px-5 py-4 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-black text-warning uppercase">Threshold 2 (0.15% - 0.25%)</h4>
                  <p className="text-[9px] text-on-surface-dim leading-relaxed">Escalation path requires Executive Director signoff.</p>
                </div>
                <div className="border border-error/20 bg-error/5 px-5 py-4 rounded-xl space-y-1.5">
                  <h4 className="text-xs font-black text-error uppercase">Threshold 3 (&gt; 0.25%)</h4>
                  <p className="text-[9px] text-on-surface-dim leading-relaxed">Requires physical stock check confirmation upload.</p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-2 border-b border-outline">Pending Reconciliation Logs</h4>
                <div className="space-y-4">
                  {varianceLogs.map(v => {
                    const isT1 = v.variancePercentage < 0.15;
                    const isT2 = v.variancePercentage >= 0.15 && v.variancePercentage <= 0.25;
                    const isT3 = v.variancePercentage > 0.25;
                    
                    const isApproved = v.status === 'APPROVED';

                    return (
                      <div key={v.id} className="bg-surface-dim/40 border border-outline p-5 rounded-[22px] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-on-surface uppercase">{v.fuelType} - {v.month}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase border
                              ${isT1 ? 'bg-success/10 text-success border-success/20' : 
                                isT2 ? 'bg-warning/10 text-warning border-warning/20' : 
                                'bg-error/10 text-error border-error/20'}`}>
                              {isT1 ? 'Threshold 1' : isT2 ? 'Threshold 2' : 'Threshold 3'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10px] font-bold text-on-surface-dim">
                            <div>FMS: <span className="text-on-surface font-black">{v.fmsStockLiters.toLocaleString()} L</span></div>
                            <div>Oracle: <span className="text-on-surface font-black">{v.oracleStockLiters.toLocaleString()} L</span></div>
                            <div>Sales Qty: <span className="text-on-surface font-black">{v.salesQuantityLiters.toLocaleString()} L</span></div>
                            <div>Variance: <span className="text-error font-black">{v.variancePercentage}%</span></div>
                          </div>
                          {v.notes && <p className="text-[10px] text-primary italic font-medium">Notes: {v.notes}</p>}
                        </div>
                        
                        <div className="shrink-0">
                          {isApproved ? (
                            <span className="flex items-center gap-1.5 text-success font-black uppercase text-[10px] tracking-widest bg-success/10 px-4 py-2 rounded-xl border border-success/20">
                              <CheckCircle className="w-4 h-4" /> Variance Reconciled
                            </span>
                          ) : varianceIdForUpload === v.id ? (
                            <button
                              onClick={() => handleUploadPhysicalCheck(v.id)}
                              className="kinetic-gradient hover:scale-[1.03] active:scale-95 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium flex items-center gap-2"
                            >
                              <Upload className="w-3.5 h-3.5 animate-bounce" /> Upload Physical Check
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApproveVariance(v.id, isT3)}
                              className="kinetic-gradient hover:scale-[1.03] active:scale-95 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium"
                            >
                              {isT3 ? 'Escalate with Physical Check' : 'Approve & Adjust Oracle'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div>
                <h3 className="title-md text-on-surface font-black uppercase tracking-tight">COGS & Margin Tracking</h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Real-time margin analysis of imported fuels</p>
              </div>

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cogsChartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="currentColor" className="text-[9px] opacity-40" />
                    <YAxis stroke="currentColor" className="text-[9px] opacity-40" />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-dim)', border: '1px solid var(--color-outline)' }} />
                    <Area type="monotone" dataKey="Sales" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="Margin" stroke="var(--color-success)" fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-surface-dim/40 border border-outline p-4 rounded-2xl">
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-50 block mb-1">Total Sales (May)</span>
                  <span className="title-md text-primary font-black">$3,500,000</span>
                </div>
                <div className="bg-surface-dim/40 border border-outline p-4 rounded-2xl">
                  <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-50 block mb-1">Gross Profit (May)</span>
                  <span className="title-md text-success font-black">$900,000</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Customs Duty & Procurement */}
        {activeTab === 'procurement' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div>
                <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Fuel Procurement Workflow</h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Tracks the 4 critical pipeline validation stages</p>
              </div>

              <form onSubmit={handleCreatePR} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-surface-dim/30 border border-outline p-5 rounded-[22px] text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Product</label>
                  <select
                    value={prFuelType}
                    onChange={(e) => setPrFuelType(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="Jet A-1">Jet A-1</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Quantity (L)</label>
                  <input
                    type="number"
                    value={prQty}
                    onChange={(e) => setPrQty(e.target.value)}
                    placeholder="1200000"
                    className="w-full bg-surface-lowest border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Platts ($/Bbl)</label>
                  <input
                    type="number"
                    value={prPlatts}
                    onChange={(e) => setPrPlatts(e.target.value)}
                    placeholder="85.00"
                    className="w-full bg-surface-lowest border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="kinetic-gradient hover:scale-[1.02] active:scale-95 text-white font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium"
                >
                  Create PR Order
                </button>
              </form>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-1">Active Pipeline Orders</h4>
                <div className="space-y-5">
                  {procurementPRs.map(pr => (
                    <div key={pr.id} className="bg-surface-dim/40 border border-outline p-5 rounded-[22px] space-y-4 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline pb-3">
                        <div>
                          <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{pr.prNumber}</span>
                          <span className="text-[9px] text-on-surface-dim uppercase tracking-widest ml-3">Raised on: {pr.date}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-on-surface">{pr.quantityLiters.toLocaleString()} Liters of {pr.fuelType}</span>
                          <span className="block text-[9px] text-on-surface-dim uppercase font-bold">FOB Value: ${pr.fobValue.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {[
                          { step: 1, label: '1. Fuel Team PR', active: pr.status !== 'PR_CONFIRMED', text: 'PR Confirmed' },
                          { step: 2, label: '2. Budget Platts', active: pr.status !== 'PR_CONFIRMED' && pr.status !== 'INVOICE_VERIFIED', text: 'Invoice Verified', action: () => verifyVendorInvoice(pr.id) },
                          { step: 3, label: '3. Procurement PO', active: pr.status === 'PO_RAISED' || pr.status === 'AP_ENTERED_ORACLE', text: pr.poNumber ? `PO: ${pr.poNumber}` : 'Raise PO', action: () => raisePO(pr.id, `PO-${Math.floor(20000 + Math.random() * 20000)}`) },
                          { step: 4, label: '4. AP Oracle Entry', active: pr.status === 'AP_ENTERED_ORACLE', text: pr.oracleInvoiceNumber ? `INV: ${pr.oracleInvoiceNumber}` : 'AP Oracle Entry', action: () => enterAPInvoice(pr.id, `ORCL-VND-${Math.floor(1000 + Math.random() * 9000)}`) }
                        ].map(st => {
                          const isDone = st.active;
                          return (
                            <div key={st.step} className={`p-3.5 rounded-xl border flex flex-col justify-between items-center min-h-[85px]
                              ${isDone 
                                ? 'bg-success/5 border-success/20 text-success' 
                                : 'bg-surface-lowest border-outline text-on-surface-dim'}`}>
                              <span className="text-[9px] font-black uppercase tracking-wider block">{st.label}</span>
                              {isDone ? (
                                <span className="text-[10px] font-black uppercase tracking-widest">{st.text}</span>
                              ) : st.action ? (
                                <button
                                  type="button"
                                  onClick={st.action}
                                  className="mt-2 kinetic-gradient hover:scale-[1.05] active:scale-95 text-white px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all shadow-sm"
                                >
                                  {st.text}
                                </button>
                              ) : (
                                <span className="text-[9px] font-bold opacity-30 mt-2 uppercase">Pending</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Customs Duty Computation</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Standard 5% duty calculation for imported fuels</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-surface-dim/40 border border-outline p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between text-xs border-b border-outline pb-2.5 font-bold text-on-surface-dim">
                      <span>Import Duty:</span>
                      <span className="text-primary font-black">5.00%</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-outline pb-2.5 font-bold text-on-surface-dim">
                      <span>Platts barrels:</span>
                      <span className="text-on-surface font-black">9,433 bbl</span>
                    </div>
                    <div className="flex justify-between text-xs border-b border-outline pb-2.5 font-bold text-on-surface-dim">
                      <span>FOB Value:</span>
                      <span className="text-on-surface font-black">$801,805</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-on-surface pb-1.5">
                      <span>Duty Calculated:</span>
                      <span className="text-success font-black">$40,090</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">GRN Surcharges</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Update Goods Received Notes with demurrage/port charges</p>
                </div>

                <form onSubmit={handleAddSurcharge} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">GRN / PO Ref</label>
                    <input
                      type="text"
                      value={surchargeGrn}
                      onChange={(e) => setSurchargeGrn(e.target.value)}
                      placeholder="PO-30219"
                      className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Surcharge ($)</label>
                      <input
                        type="number"
                        value={surchargeAmt}
                        onChange={(e) => setSurchargeAmt(e.target.value)}
                        placeholder="15000"
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Notes</label>
                      <input
                        type="text"
                        value={surchargeNotes}
                        onChange={(e) => setSurchargeNotes(e.target.value)}
                        placeholder="Demurrage"
                        className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full kinetic-gradient hover:scale-[1.02] active:scale-95 text-white font-black py-3.5 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-premium mt-2"
                  >
                    Add Surcharge bill
                  </button>
                </form>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider pb-1">Surcharges logged</h4>
                  <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {surcharges.map((s, idx) => (
                      <div key={idx} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-primary">{s.grnNumber}</span>
                          <p className="text-[10px] text-on-surface-dim font-bold mt-0.5">{s.notes}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-error">+${s.surchargeAmount.toLocaleString()}</span>
                          <span className="block text-[8px] opacity-45 uppercase font-bold mt-1">FOB: ${s.originalValue.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

{/* TAB 5: Required Financial Reports */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-300">
            {/* Reports Sidebar */}
            <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-5">
              <h3 className="text-[10px] font-black uppercase text-on-surface-dim tracking-widest pb-3 border-b border-outline">
                Verified Finance Sheets
              </h3>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {[
                  {
                    title: 'Daily Balances & Proformas',
                    items: [
                      { id: 'balance_jeta1', label: 'Jet Daily Balance Sheet' },
                      { id: 'adv_day_jeta1', label: 'Jet Advance Day Balance' },
                      { id: 'balance_mpd', label: 'MPD Advance Daily Sheet' }
                    ]
                  },
                  {
                    title: 'Uplifts & Invoicing Sheets',
                    items: [
                      { id: 'online_jeta1', label: 'Jet Fuel Online Sheet' },
                      { id: 'finance_jeta1', label: 'Jet Fuel Finance Sheet' },
                      { id: 'online_mpd', label: 'MPD Online Sheet' },
                      { id: 'finance_mpd', label: 'MPD Finance Sales Sheet' }
                    ]
                  },
                  {
                    title: 'Ledgers & Statements',
                    items: [
                      { id: 'statement_jeta1', label: 'Jet Statement of Accounts' },
                      { id: 'statement_mpd', label: 'MPD Statement of Account' }
                    ]
                  },
                  {
                    title: 'Inventory & Shipments',
                    items: [
                      { id: 'stock_activity', label: 'Stock Activity Report' },
                      { id: 'customs_duty', label: 'Customs & Royalty Summary' }
                    ]
                  }
                ].map((grp, gIdx) => (
                  <div key={gIdx} className="space-y-1.5">
                    <span className="text-[8px] font-black uppercase text-primary/70 tracking-widest block pl-2 mt-2">
                      {grp.title}
                    </span>
                    <div className="space-y-1">
                      {grp.items.map(rep => (
                        <button
                          key={rep.id}
                          onClick={() => setSelectedReport(rep.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
                            ${selectedReport === rep.id 
                              ? 'bg-primary/10 text-primary font-black border border-primary/20 shadow-sm' 
                              : 'text-on-surface-dim hover:bg-surface-dim hover:text-on-surface border border-transparent'}`}
                        >
                          {rep.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Account Selector for Statements */}
              {(selectedReport === 'statement_jeta1' || selectedReport === 'statement_mpd') && (
                <div className="pt-4 space-y-2 border-t border-outline">
                  <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider block pl-1">
                    Select Account
                  </label>
                  <select
                    value={ledgerCustId}
                    onChange={(e) => setLedgerCustId(e.target.value)}
                    className="w-full bg-surface-dim border border-outline px-3 py-2 rounded-xl text-[10px] font-bold text-on-surface outline-none"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-2 border-t border-outline">
                <button 
                  onClick={() => notify('Report export completed (CSV downloaded).', 'success')}
                  className="flex-1 flex justify-center items-center gap-1.5 kinetic-gradient text-white hover:scale-105 active:scale-95 transition-all shadow-premium rounded-xl p-3 text-[9px] font-black uppercase tracking-widest border-none"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 flex justify-center items-center gap-1.5 kinetic-gradient text-white hover:scale-105 active:scale-95 transition-all shadow-premium rounded-xl p-3 text-[9px] font-black uppercase tracking-widest border-none"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              </div>
            </div>

            {/* Report Viewer Glass Panel */}
            <div className="lg:col-span-3 bg-surface-lowest border border-outline p-8 rounded-[32px] shadow-premium space-y-6 overflow-x-auto min-h-[500px]">
              
              {/* 1. Jet Daily Balance Sheet */}
              {selectedReport === 'balance_jeta1' && (
                <div className="space-y-6 min-w-[800px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Jet Fuel Sales Daily Balance Sheet (HAQ & VIA)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">MACL Fuel Farm Division • 5-Jan-2026 Run</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">Customer Account</th>
                        <th className="pb-3 text-right">Opening Balance</th>
                        <th className="pb-3 text-right">Payments Received</th>
                        <th className="pb-3 text-right">Total Liters</th>
                        <th className="pb-3 text-right">Total USD</th>
                        <th className="pb-3 text-right">FMS Balance (USD)</th>
                        <th className="pb-3 text-right">Balance (Liters)</th>
                        <th className="pb-3 text-right">Upcoming payments</th>
                        <th className="pb-3">Proforma 1-15</th>
                        <th className="pb-3">Proforma 16-30</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {customers.filter(c => c.classification === 'ADVANCE').map(c => {
                        const hasUpcoming = upcomingPayments.some(p => p.customerId === c.id && p.status === 'PENDING_REVIEW');
                        const isLow = c.advanceBalance < c.estimated5DaysSales;
                        return (
                          <tr key={c.id} className="hover:bg-surface-dim/40 transition-colors">
                            <td className="py-3 font-bold text-on-surface uppercase">{c.name}</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">${c.openingBalance.toLocaleString()}</td>
                            <td className="py-3 text-right font-bold text-success">${c.paymentsReceived.toLocaleString()}</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">12,654 L</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">$35,431</td>
                            <td className={`py-3 text-right font-black ${isLow ? 'text-error' : 'text-primary'}`}>
                              ${c.advanceBalance.toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-black text-on-surface">
                              {c.balanceLiters?.toLocaleString() || '—'} L
                            </td>
                            <td className="py-3 text-right font-bold text-warning">
                              {hasUpcoming ? '$150,000 pending' : '—'}
                            </td>
                            <td className="py-3 font-bold text-on-surface-dim text-[10px]">Monthly</td>
                            <td className="py-3 font-bold text-on-surface-dim text-[10px]">21 DEC send for JAN</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 2. Jet Advance Day Balance */}
              {selectedReport === 'adv_day_jeta1' && (
                <div className="space-y-6 min-w-[800px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Jet Fuel Advance Customers Day Balance Sheet</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">Aviation Fuel Department • 5-Jan-2026</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">ADVANCE INT CUSTOMERS USD</th>
                        <th className="pb-3 text-right">Opening Balance</th>
                        <th className="pb-3 text-right">Payment</th>
                        <th className="pb-3 text-right">Liters</th>
                        <th className="pb-3 text-right">Sales</th>
                        <th className="pb-3 text-right">Balance</th>
                        <th className="pb-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {customers.filter(c => c.classification === 'ADVANCE').map(c => {
                        const hasUpcoming = upcomingPayments.some(p => p.customerId === c.id && p.status === 'PENDING_REVIEW');
                        return (
                          <tr key={c.id} className="hover:bg-surface-dim/40 transition-colors">
                            <td className="py-3 font-bold text-on-surface uppercase">{c.name}</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">${c.openingBalance.toLocaleString()}</td>
                            <td className="py-3 text-right font-bold text-success">${c.paymentsReceived.toLocaleString()}</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">23,501 L</td>
                            <td className="py-3 text-right font-bold text-on-surface-dim">$28,012.49</td>
                            <td className="py-3 text-right font-black text-primary">${c.advanceBalance.toLocaleString()}</td>
                            <td className="py-3 font-bold text-on-surface-dim uppercase text-[9px]">
                              {hasUpcoming ? '2M coming up' : 'Secure'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. MPD Advance Daily Sheet */}
              {selectedReport === 'balance_mpd' && (
                <div className="space-y-6 min-w-[850px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">MPD Advance Customers Daily Sheet (Diesel & Petrol)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">Multi-Product Division • Landside & Airside balances</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">ADVANCE CUSTOMERS</th>
                        <th className="pb-3 text-right">Opening Balance</th>
                        <th className="pb-3 text-right">Payments</th>
                        <th className="pb-3 text-right">Total Receipts</th>
                        <th className="pb-3 text-right">1-Dec (L)</th>
                        <th className="pb-3 text-right">2-Dec (L)</th>
                        <th className="pb-3 text-right">3-Dec (L)</th>
                        <th className="pb-3 text-right">Total Liters</th>
                        <th className="pb-3 text-right">Balance LTR</th>
                        <th className="pb-3 text-right">Balance MVR</th>
                        <th className="pb-3">Upcoming Payment</th>
                        <th className="pb-3">Advance/Carry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {[
                        { name: 'Island Aviation Services Ltd', opening: 11500, payments: 2240, total: 13740, d1: 32, d2: 50, d3: 0, ltrs: 82, balLtr: 780, balMvr: 12000, upcoming: '—', status: 'ADVANCE' },
                        { name: 'Manta Aviation Pvt Ltd', opening: 18100, payments: 25000, total: 43100, d1: 220, d2: 310, d3: 150, ltrs: 680, balLtr: 13200, balMvr: 203543, upcoming: '—', status: 'CASH & CARRY' },
                        { name: 'Maldives Transport PLC (MTCC)', opening: 8470, payments: 10000, total: 18470, d1: 45, d2: 45, d3: 22, ltrs: 112, balLtr: 1350, balMvr: 20817, upcoming: '$10,000', status: 'ADVANCE' }
                      ].map((c, idx) => (
                        <tr key={idx} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-bold text-on-surface uppercase">{c.name}</td>
                          <td className="py-3 text-right font-bold text-on-surface-dim">${c.opening.toLocaleString()}</td>
                          <td className="py-3 text-right font-bold text-success">${c.payments.toLocaleString()}</td>
                          <td className="py-3 text-right font-bold text-on-surface">${c.total.toLocaleString()}</td>
                          <td className="py-3 text-right text-on-surface-dim">{c.d1} L</td>
                          <td className="py-3 text-right text-on-surface-dim">{c.d2} L</td>
                          <td className="py-3 text-right text-on-surface-dim">{c.d3} L</td>
                          <td className="py-3 text-right font-bold text-on-surface">{c.ltrs} L</td>
                          <td className="py-3 text-right font-black text-primary">{c.balLtr.toLocaleString()} L</td>
                          <td className="py-3 text-right font-black text-on-surface">MVR {c.balMvr.toLocaleString()}</td>
                          <td className="py-3 font-bold text-warning text-[10px]">{c.upcoming}</td>
                          <td className="py-3 font-bold text-on-surface-dim text-[10px]">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 4. Jet Fuel Online Sheet */}
              {selectedReport === 'online_jeta1' && (
                <div className="space-y-6 min-w-[900px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Jet Fuel Online Sheet (HAQ and VIA)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">
                      Real-time Airside Refueling Log • Click Del No to view Tax Invoice
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Delivery No</th>
                        <th className="pb-3">Customer/Account Name</th>
                        <th className="pb-3">Flight No</th>
                        <th className="pb-3">Rego No</th>
                        <th className="pb-3">A/C Type</th>
                        <th className="pb-3">Sector</th>
                        <th className="pb-3">Position</th>
                        <th className="pb-3">Commence</th>
                        <th className="pb-3">Complete</th>
                        <th className="pb-3 text-right">Volume (Liters)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {fuelRequests.filter(fr => fr.status === 'APPROVED').map(fr => (
                        <tr key={fr.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3">{fr.date}</td>
                          <td className="py-3 font-black">
                            <button
                              onClick={() => setSelectedTicket(fr)}
                              className="font-black text-primary hover:underline hover:text-primary-container flex items-center gap-1 uppercase tracking-tight"
                            >
                              <Eye className="w-3 h-3 text-primary" /> {fr.deliveryNumber}
                            </button>
                          </td>
                          <td className="py-3 font-bold text-on-surface uppercase">{fr.customerName}</td>
                          <td className="py-3 font-bold">{fr.flightNumber}</td>
                          <td className="py-3 font-bold text-on-surface-dim">{fr.aircraftReg}</td>
                          <td className="py-3 text-on-surface-dim">{fr.aircraftType}</td>
                          <td className="py-3 font-bold text-on-surface-dim">{fr.categorySector}</td>
                          <td className="py-3 text-[10px] text-on-surface-dim font-bold">{fr.refuelTimePosition}</td>
                          <td className="py-3 text-[10px] text-on-surface-dim font-bold">{fr.refuelTimeCommence}</td>
                          <td className="py-3 text-[10px] text-on-surface-dim font-bold">{fr.refuelTimeComplete}</td>
                          <td className="py-3 text-right font-black text-on-surface">{fr.quantityLiters.toLocaleString()} L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Jet Fuel Finance Sheet */}
              {selectedReport === 'finance_jeta1' && (
                <div className="space-y-6 min-w-[900px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Jet Fuel Finance Sheet (HAQ and VIA)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">Official Circular Rates & MVR Revenue Ledger</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">DELNO</th>
                        <th className="pb-3">DATE</th>
                        <th className="pb-3">Oracle Customer Code</th>
                        <th className="pb-3">Operator</th>
                        <th className="pb-3">Sector</th>
                        <th className="pb-3 text-right">Volume (ltrs)</th>
                        <th className="pb-3 text-right">RATE USD/IG</th>
                        <th className="pb-3 text-right">AMOUNT USD</th>
                        <th className="pb-3 text-right">AMOUNT MVR</th>
                        <th className="pb-3">Invoice Number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {fuelRequests.filter(fr => fr.status === 'APPROVED').map(fr => (
                        <tr key={fr.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3">
                            <button
                              onClick={() => setSelectedTicket(fr)}
                              className="font-black text-primary hover:underline"
                            >
                              {fr.deliveryNumber}
                            </button>
                          </td>
                          <td className="py-3">{fr.date}</td>
                          <td className="py-3 text-[10px] font-bold text-on-surface-dim uppercase">ORCL-CUST-{fr.customerId.toUpperCase()}</td>
                          <td className="py-3 font-bold text-on-surface uppercase">{fr.operator}</td>
                          <td className="py-3 font-bold">{fr.categorySector}</td>
                          <td className="py-3 text-right font-bold text-on-surface">{fr.quantityLiters.toLocaleString()}</td>
                          <td className="py-3 text-right font-bold text-on-surface-dim">${fr.pricePerLiter.toFixed(5)}</td>
                          <td className="py-3 text-right font-black text-primary">${fr.amount.toLocaleString()}</td>
                          <td className="py-3 text-right font-black text-on-surface">MVR {(fr.amount * 15.42).toLocaleString()}</td>
                          <td className="py-3 font-bold text-on-surface-dim text-[11px]">{fr.invoiceNumber || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. MPD Online Sheet */}
              {selectedReport === 'online_mpd' && (
                <div className="space-y-6 min-w-[850px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Multi Products Delivery (MPD) Landside & Airside Online Sheet</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">MACL Logistics & Fleet refueling audit sheet</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Delivery Note No</th>
                        <th className="pb-3">Fleet/Reg</th>
                        <th className="pb-3">Customer</th>
                        <th className="pb-3">Operator Name</th>
                        <th className="pb-3">Registration</th>
                        <th className="pb-3 text-right">Diesel (Ltrs)</th>
                        <th className="pb-3 text-right">Petrol (Ltrs)</th>
                        <th className="pb-3">Oracle Customer Code</th>
                        <th className="pb-3 text-center">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {mpdSales.map(m => (
                        <tr key={m.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3">{m.date}</td>
                          <td className="py-3">
                            <button onClick={() => setSelectedTicket(m)} className="font-black text-primary hover:underline">
                              {m.deliveryNo}
                            </button>
                          </td>
                          <td className="py-3 font-bold text-on-surface">{m.regNo}</td>
                          <td className="py-3 uppercase text-on-surface-dim font-bold">{m.customerName}</td>
                          <td className="py-3 uppercase font-bold">{m.operatorName}</td>
                          <td className="py-3 text-on-surface-dim">{m.regNo}</td>
                          <td className="py-3 text-right font-black">{m.dieselLiters > 0 ? `${m.dieselLiters.toLocaleString()} L` : '—'}</td>
                          <td className="py-3 text-right font-black">{m.petrolLiters > 0 ? `${m.petrolLiters.toLocaleString()} L` : '—'}</td>
                          <td className="py-3 text-[10px] text-on-surface-dim font-bold">ORCL-MPD-{m.id.toUpperCase()}</td>
                          <td className="py-3 text-center">
                            <span className="bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded text-[8px] font-black uppercase">OK</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 7. MPD Finance Sales Sheet */}
              {selectedReport === 'finance_mpd' && (
                <div className="space-y-6 min-w-[900px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">MPD Finance Sales Sheet (Airside and Landside)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">Official Multi-product Revenue Accounting Ledger</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">DELIVER Y/N</th>
                        <th className="pb-3">DATE</th>
                        <th className="pb-3">CUSTOMER</th>
                        <th className="pb-3">AIRLINE/ORGANISATION</th>
                        <th className="pb-3">REG</th>
                        <th className="pb-3 text-right">DIESEL LTRS</th>
                        <th className="pb-3 text-right">PETROL LTRS</th>
                        <th className="pb-3 text-right">RATE DIF</th>
                        <th className="pb-3 text-right">RATE PF1</th>
                        <th className="pb-3 text-right">AMOUNT DIF</th>
                        <th className="pb-3 text-right">AMOUNT PET</th>
                        <th className="pb-3">invoice number</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {mpdSales.map(m => (
                        <tr key={m.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-black text-primary uppercase">{m.type === 'LANDSIDE' ? 'LWPD' : 'LMPD'}</td>
                          <td className="py-3">{m.date}</td>
                          <td className="py-3 font-bold text-on-surface uppercase">{m.customerName}</td>
                          <td className="py-3 uppercase text-on-surface-dim font-bold">{m.operatorName}</td>
                          <td className="py-3 font-bold text-on-surface-dim">{m.regNo}</td>
                          <td className="py-3 text-right font-bold text-on-surface">{m.dieselLiters > 0 ? m.dieselLiters.toLocaleString() : '—'}</td>
                          <td className="py-3 text-right font-bold text-on-surface">{m.petrolLiters > 0 ? m.petrolLiters.toLocaleString() : '—'}</td>
                          <td className="py-3 text-right text-on-surface-dim">${m.rateDiesel.toFixed(2)}</td>
                          <td className="py-3 text-right text-on-surface-dim">${m.ratePetrol.toFixed(2)}</td>
                          <td className="py-3 text-right font-black text-primary">${m.dieselLiters > 0 ? (m.dieselLiters * m.rateDiesel).toLocaleString() : '—'}</td>
                          <td className="py-3 text-right font-black text-primary">${m.petrolLiters > 0 ? (m.petrolLiters * m.ratePetrol).toLocaleString() : '—'}</td>
                          <td className="py-3 font-bold text-on-surface-dim text-[11px]">{m.invoiceNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 8. Jet fuel Statement of Accounts */}
              {selectedReport === 'statement_jeta1' && (
                <div className="space-y-6 min-w-[800px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Statement of Accounts for December 2025 (Jet A-1)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">
                      Ledger Activity Log for {customers.find(c => c.id === ledgerCustId)?.name}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">REF NO/DEL NO</th>
                        <th className="pb-3">DATE</th>
                        <th className="pb-3">DETAILS</th>
                        <th className="pb-3">Flight No</th>
                        <th className="pb-3">Registration</th>
                        <th className="pb-3">A/C Type</th>
                        <th className="pb-3 text-right">VOLUME LITERS</th>
                        <th className="pb-3 text-right">RATE USD</th>
                        <th className="pb-3 text-right">AMOUNT USD (DR)</th>
                        <th className="pb-3 text-right">PAYMENT RECEIVED (CR)</th>
                        <th className="pb-3 text-right">BALANCE (DR/CR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      <tr>
                        <td className="py-3 text-on-surface-dim font-bold">—</td>
                        <td className="py-3">01-Dec-2025</td>
                        <td className="py-3 font-black text-on-surface-dim">Balance brought forward</td>
                        <td className="py-3 font-bold">—</td>
                        <td className="py-3 font-bold">—</td>
                        <td className="py-3">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right font-black text-primary">
                          ${customers.find(c => c.id === ledgerCustId)?.classification === 'CREDIT' ? '614,057.59 DR' : '430,551.15 CR'}
                        </td>
                      </tr>
                      {fuelRequests.filter(fr => fr.customerId === ledgerCustId && fr.status === 'APPROVED').map(fr => (
                        <tr key={fr.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-black text-primary hover:underline cursor-pointer" onClick={() => setSelectedTicket(fr)}>
                            {fr.deliveryNumber}
                          </td>
                          <td className="py-3">{fr.date}</td>
                          <td className="py-3 text-on-surface-dim uppercase font-bold">{fr.operator}</td>
                          <td className="py-3 font-bold text-on-surface">{fr.flightNumber}</td>
                          <td className="py-3 font-bold">{fr.aircraftReg}</td>
                          <td className="py-3">{fr.aircraftType}</td>
                          <td className="py-3 text-right font-bold">{fr.quantityLiters.toLocaleString()} L</td>
                          <td className="py-3 text-right text-on-surface-dim">${fr.pricePerLiter.toFixed(5)}</td>
                          <td className="py-3 text-right text-error font-bold">${fr.amount.toLocaleString()}</td>
                          <td className="py-3 text-right">—</td>
                          <td className="py-3 text-right font-black text-on-surface">$0</td>
                        </tr>
                      ))}
                      {receipts.filter(r => r.customerId === ledgerCustId).map(r => (
                        <tr key={r.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-bold text-success">{r.receiptNumber}</td>
                          <td className="py-3">{r.date}</td>
                          <td className="py-3 font-black text-success uppercase">Oracle Payment Cleared</td>
                          <td className="py-3 font-bold">—</td>
                          <td className="py-3 font-bold">—</td>
                          <td className="py-3">—</td>
                          <td className="py-3 text-right">—</td>
                          <td className="py-3 text-right">—</td>
                          <td className="py-3 text-right">—</td>
                          <td className="py-3 text-right font-bold text-success">${r.amount.toLocaleString()}</td>
                          <td className="py-3 text-right font-black text-primary">${r.remainingAmount.toLocaleString()} CR</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Ledger Overdue Block */}
                  <div className="flex justify-between items-center bg-surface-dim/30 border border-outline p-5 rounded-2xl text-xs font-bold pt-4">
                    <span className="text-error font-black uppercase tracking-wider">OVER DUE</span>
                    <div className="flex gap-6 text-right">
                      <div>Total DR: <span className="font-black text-error">$1,798,494.44</span></div>
                      <div>Total CR: <span className="font-black text-success">$1,649,988.00</span></div>
                      <div>Net Outstanding: <span className="font-black text-primary text-sm">$465,551.15 DR</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. MPD Customers Statement of Account */}
              {selectedReport === 'statement_mpd' && (
                <div className="space-y-6 min-w-[850px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Statement of Accounts for December 2025 (MPD)</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">
                      Multi-Product Ledger Activity Log for {customers.find(c => c.id === ledgerCustId)?.name}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">DEL NO</th>
                        <th className="pb-3">DATE</th>
                        <th className="pb-3">REG</th>
                        <th className="pb-3 text-right">DIESEL LTRS</th>
                        <th className="pb-3 text-right">PETROL LTRS</th>
                        <th className="pb-3 text-right">RATE DIESEL</th>
                        <th className="pb-3 text-right">RATE PETROL</th>
                        <th className="pb-3 text-right">AMOUNT DIESEL</th>
                        <th className="pb-3 text-right">AMOUNT PETROL</th>
                        <th className="pb-3 text-right">PAYMENT (CR)</th>
                        <th className="pb-3 text-right">BALANCE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      <tr>
                        <td className="py-3 text-on-surface-dim font-bold">—</td>
                        <td className="py-3">01-Dec-2025</td>
                        <td className="py-3 font-black text-on-surface-dim">Balance brought forward</td>
                        <td className="py-3">—</td>
                        <td className="py-3">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right">—</td>
                        <td className="py-3 text-right font-black text-primary">100,138.00 DR</td>
                      </tr>
                      {mpdSales.map(m => (
                        <tr key={m.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-bold text-primary cursor-pointer" onClick={() => setSelectedTicket(m)}>{m.deliveryNo}</td>
                          <td className="py-3">{m.date}</td>
                          <td className="py-3 font-bold">{m.regNo}</td>
                          <td className="py-3 text-right font-bold text-on-surface">{m.dieselLiters > 0 ? m.dieselLiters : '—'}</td>
                          <td className="py-3 text-right font-bold text-on-surface">{m.petrolLiters > 0 ? m.petrolLiters : '—'}</td>
                          <td className="py-3 text-right text-on-surface-dim">${m.rateDiesel.toFixed(2)}</td>
                          <td className="py-3 text-right text-on-surface-dim">${m.ratePetrol.toFixed(2)}</td>
                          <td className="py-3 text-right font-black text-primary">${m.dieselLiters > 0 ? (m.dieselLiters * m.rateDiesel).toLocaleString() : '—'}</td>
                          <td className="py-3 text-right font-black text-primary">${m.petrolLiters > 0 ? (m.petrolLiters * m.ratePetrol).toLocaleString() : '—'}</td>
                          <td className="py-3 text-right">—</td>
                          <td className="py-3 text-right font-bold text-on-surface">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="flex justify-between items-center bg-surface-dim/30 border border-outline p-5 rounded-2xl text-xs font-bold pt-4">
                    <span className="text-error font-black uppercase tracking-wider">OVER DUE</span>
                    <div className="flex gap-6 text-right">
                      <div>Total Diesel DR: <span className="font-black text-primary">6,803 L</span></div>
                      <div>Total Petrol DR: <span className="font-black text-primary">120 L</span></div>
                      <div>Net Outstanding: <span className="font-black text-error text-sm">$77,673.88 DR</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* 10. Stock Activity Report */}
              {selectedReport === 'stock_activity' && (
                <div className="space-y-6 min-w-[800px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Stock Activity Report JET-A1, MGO and PETROL</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">MACL Fuel Farm Division • Reconciled Inventory Ledger</span>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">Fuel Product</th>
                        <th className="pb-3 text-right">Opening Stock</th>
                        <th className="pb-3 text-right">Receipts daily</th>
                        <th className="pb-3 text-right">Sales (FIFO)</th>
                        <th className="pb-3 text-right">SCADA Closing Ltrs</th>
                        <th className="pb-3 text-right">Physical Closing Ltrs</th>
                        <th className="pb-3 text-right">Variation (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {[
                        { type: 'JET-A1 (Kerosene)', opening: 4500000, receipts: 1000000, sales: 3800000, balance: 1700000, physical: 1696200, var: 0.10 },
                        { type: 'MGO (Low Sulfur Diesel)', opening: 152000, receipts: 50000, sales: 120000, balance: 82000, physical: 81720, var: 0.23 },
                        { type: 'PETROL (Super Gasoline)', opening: 85000, receipts: 20000, sales: 90000, balance: 15000, physical: 14680, var: 0.35 }
                      ].map((s, idx) => (
                        <tr key={idx} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-bold text-on-surface">{s.type}</td>
                          <td className="py-3 text-right">{s.opening.toLocaleString()} L</td>
                          <td className="py-3 text-right text-success font-bold">+{s.receipts.toLocaleString()} L</td>
                          <td className="py-3 text-right text-error font-bold">-{s.sales.toLocaleString()} L</td>
                          <td className="py-3 text-right font-black">{s.balance.toLocaleString()} L</td>
                          <td className="py-3 text-right font-black text-primary">{s.physical.toLocaleString()} L</td>
                          <td className="py-3 text-right font-black text-error">{s.var}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Shipment Receipts Sub-block */}
                  <div className="space-y-3 pt-6 border-t border-outline">
                    <h4 className="text-[10px] font-black text-on-surface-dim uppercase tracking-wider block pl-1">
                      Receipts Shipment Details (Reconciled Invoices)
                    </h4>
                    <table className="w-full text-left text-[11px] text-slate-500 border-collapse">
                      <thead>
                        <tr className="border-b border-outline text-[8px] font-black uppercase tracking-wider text-slate-400">
                          <th>Date</th>
                          <th>Shipment Number</th>
                          <th>Invoice Ref</th>
                          <th className="text-right">Quantity (Liters)</th>
                          <th className="text-right">Circular Rate ($)</th>
                          <th className="text-right">Invoice Amount ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-outline/30">
                          <td className="py-2">15-May-2026</td>
                          <td className="py-2 font-bold text-on-surface">MACL-JET-2026-01</td>
                          <td className="py-2">B-FORM-8871</td>
                          <td className="py-2 text-right">1,000,000 L</td>
                          <td className="py-2 text-right">$0.53770</td>
                          <td className="py-2 text-right font-bold text-primary">$537,700</td>
                        </tr>
                        <tr>
                          <td className="py-2">01-Jun-2026</td>
                          <td className="py-2 font-bold text-on-surface">MACL-JET-2026-02</td>
                          <td className="py-2">B-FORM-9022</td>
                          <td className="py-2 text-right">1,500,000 L</td>
                          <td className="py-2 text-right">$0.55467</td>
                          <td className="py-2 text-right font-bold text-primary">$832,000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 11. Customs Duty & Royalty Summary */}
              {selectedReport === 'customs_duty' && (
                <div className="space-y-6 min-w-[800px] animate-in fade-in duration-300">
                  <div className="border-b border-outline pb-4 text-center">
                    <h3 className="title-md text-on-surface font-black uppercase tracking-widest">Jet A-1 Customs Duty & Royalty Summary</h3>
                    <span className="text-[10px] text-on-surface-dim uppercase font-bold tracking-widest block mt-1">
                      Conversion factor and MT weights • 5% standard Import Duty rate
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="pb-3">Shipment Ref</th>
                        <th className="pb-3">B Form No</th>
                        <th className="pb-3 text-right">Import Liters</th>
                        <th className="pb-3 text-right">FOB value ($)</th>
                        <th className="pb-3 text-right">Conversion factor</th>
                        <th className="pb-3 text-right">Metric Tons (MT)</th>
                        <th className="pb-3 text-right">Import Duty (5%)</th>
                        <th className="pb-3 text-right">MACL Royalty (5%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {customsShipments.map(cs => (
                        <tr key={cs.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-3 font-bold text-on-surface uppercase">{cs.shipmentNumber}</td>
                          <td className="py-3 font-bold text-on-surface-dim">{cs.bFormNumber}</td>
                          <td className="py-3 text-right font-black">{cs.quantityLiters.toLocaleString()} L</td>
                          <td className="py-3 text-right font-bold text-primary">${cs.fobValue.toLocaleString()}</td>
                          <td className="py-3 text-right text-on-surface-dim">{cs.conversionFactor}</td>
                          <td className="py-3 text-right font-black text-on-surface">{cs.metricTons} MT</td>
                          <td className="py-3 text-right font-black text-success">${cs.dutyPaid.toLocaleString()}</td>
                          <td className="py-3 text-right font-black text-success">${cs.royaltyAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* ─── PREMIUM TAX INVOICE MODAL ─── */}
      {selectedTicket && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => setSelectedTicket(null)}>
          <div 
            className="bg-white text-slate-800 rounded-3xl w-full max-w-4xl shadow-premium border border-outline/50 overflow-hidden flex flex-col my-auto transition-transform duration-300 scale-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">TAX INVOICE BILLING RECORD</span>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            {/* Invoice Canvas Print Layout */}
            <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar font-sans text-xs">
              
              {/* Header row */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div className="space-y-2">
                  <h1 className="text-xl font-[1000] text-slate-900 tracking-tighter uppercase leading-none">MALDIVES AIRPORTS Co.</h1>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Velana International Airport, Hulhule 22000, Maldives</p>
                  <p className="text-[9px] text-slate-500 font-bold">TIN: 1000133GST501 • Email: billing@macl.aero</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">TAX INVOICE</h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase block mt-1">Invoice No: {'quantityLiters' in selectedTicket ? selectedTicket.invoiceNumber || 'FFF/2025/2500001322' : selectedTicket.invoiceNumber}</span>
                  <span className="text-[10px] font-bold text-slate-500 block">Date: {selectedTicket.date}</span>
                </div>
              </div>

              {/* Customer and billing info */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-outline">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Billed To:</span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedTicket.customerName}</h3>
                  <p className="text-[10px] text-slate-500">Corporate Account Code: {'customerId' in selectedTicket ? selectedTicket.customerId : 'c3'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Remit Info:</span>
                  <p className="text-[9px] text-slate-500 leading-relaxed font-bold">
                    Please remit payment to US$ A/c # 7713-101443-005<br/>
                    at Bank of Maldives PLC, Airport Branch Hulhule<br/>
                    SWIFT CODE: MALBMVMV
                  </p>
                </div>
              </div>

              {/* Invoice Lines Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Reference / Product Description</th>
                    <th className="pb-3 text-right">Volume Billed</th>
                    <th className="pb-3 text-right">Rate ($)</th>
                    <th className="pb-3 text-right">Amount ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {'quantityLiters' in selectedTicket ? (
                    // Jet A-1 request
                    <tr>
                      <td className="py-4 font-bold text-slate-800 uppercase">
                        JET FUEL SALES FROM {selectedTicket.date}<br/>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Flight: {selectedTicket.flightNumber} • A/C Reg: {selectedTicket.aircraftReg}</span>
                      </td>
                      <td className="py-4 text-right font-black">{selectedTicket.quantityLiters.toLocaleString()} Liters</td>
                      <td className="py-4 text-right font-bold text-slate-500">${selectedTicket.pricePerLiter.toFixed(5)}</td>
                      <td className="py-4 text-right font-black text-slate-900">${selectedTicket.amount.toLocaleString()}</td>
                    </tr>
                  ) : (
                    // MPD Sale
                    <>
                      {selectedTicket.dieselLiters > 0 && (
                        <tr>
                          <td className="py-4 font-bold text-slate-800 uppercase">
                            DIESEL SALES FROM {selectedTicket.date}<br/>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Operator: {selectedTicket.operatorName} • Reg: {selectedTicket.regNo}</span>
                          </td>
                          <td className="py-4 text-right font-black">{selectedTicket.dieselLiters.toLocaleString()} L</td>
                          <td className="py-4 text-right font-bold text-slate-500">${selectedTicket.rateDiesel.toFixed(2)}</td>
                          <td className="py-4 text-right font-black text-slate-900">${(selectedTicket.dieselLiters * selectedTicket.rateDiesel).toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedTicket.petrolLiters > 0 && (
                        <tr>
                          <td className="py-4 font-bold text-slate-800 uppercase">
                            PETROL SALES FROM {selectedTicket.date}<br/>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Operator: {selectedTicket.operatorName} • Reg: {selectedTicket.regNo}</span>
                          </td>
                          <td className="py-4 text-right font-black">{selectedTicket.petrolLiters.toLocaleString()} L</td>
                          <td className="py-4 text-right font-bold text-slate-500">${selectedTicket.ratePetrol.toFixed(2)}</td>
                          <td className="py-4 text-right font-black text-slate-900">${(selectedTicket.petrolLiters * selectedTicket.ratePetrol).toLocaleString()}</td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>

              {/* Total calculations */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-64 space-y-2 text-xs font-bold text-slate-500">
                  <div className="flex justify-between">
                    <span>GST (8%):</span>
                    <span className="text-slate-800">
                      ${('amount' in selectedTicket 
                        ? (selectedTicket.amount * 0.08) 
                        : (selectedTicket.dieselLiters * selectedTicket.rateDiesel + selectedTicket.petrolLiters * selectedTicket.ratePetrol) * 0.08
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-outline pt-2">
                    <span>Grand Total:</span>
                    <span className="text-slate-900">
                      ${('amount' in selectedTicket 
                        ? (selectedTicket.amount * 1.08) 
                        : (selectedTicket.dieselLiters * selectedTicket.rateDiesel + selectedTicket.petrolLiters * selectedTicket.ratePetrol) * 1.08
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Supporting delivery logs matching screenshot */}
              <div className="pt-6 border-t border-outline">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Supporting Uplift Logs</h4>
                <table className="w-full text-left text-[10px] text-slate-500 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[8px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-2">Delivery Ticket</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Operator Name</th>
                      <th className="pb-2">A/C Type</th>
                      <th className="pb-2">Reg</th>
                      <th className="pb-2 text-right">Volume</th>
                      <th className="pb-2 text-right">Circular Rate</th>
                      <th className="pb-2 text-right">Revenue ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {'quantityLiters' in selectedTicket ? (
                      <tr>
                        <td className="py-2 font-bold text-slate-800">{selectedTicket.deliveryNumber}</td>
                        <td className="py-2">{selectedTicket.date}</td>
                        <td className="py-2 uppercase">{selectedTicket.operator}</td>
                        <td className="py-2">{selectedTicket.aircraftType}</td>
                        <td className="py-2 font-bold">{selectedTicket.aircraftReg}</td>
                        <td className="py-2 text-right font-black">{selectedTicket.quantityLiters.toLocaleString()} L</td>
                        <td className="py-2 text-right">${selectedTicket.pricePerLiter.toFixed(5)}</td>
                        <td className="py-2 text-right font-black text-slate-800">${selectedTicket.amount.toLocaleString()}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="py-2 font-bold text-slate-800">{selectedTicket.deliveryNo}</td>
                        <td className="py-2">{selectedTicket.date}</td>
                        <td className="py-2 uppercase">{selectedTicket.operatorName}</td>
                        <td className="py-2">Own Use</td>
                        <td className="py-2 font-bold">{selectedTicket.regNo}</td>
                        <td className="py-2 text-right font-black">
                          {selectedTicket.dieselLiters > 0 ? `${selectedTicket.dieselLiters.toLocaleString()} L (Diesel)` : `${selectedTicket.petrolLiters.toLocaleString()} L (Petrol)`}
                        </td>
                        <td className="py-2 text-right">
                          ${selectedTicket.dieselLiters > 0 ? selectedTicket.rateDiesel.toFixed(2) : selectedTicket.ratePetrol.toFixed(2)}
                        </td>
                        <td className="py-2 text-right font-black text-slate-800">
                          ${(selectedTicket.dieselLiters * selectedTicket.rateDiesel + selectedTicket.petrolLiters * selectedTicket.ratePetrol).toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Print trigger footer */}
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-outline">
              <button 
                onClick={() => notify('PDF Invoice copy download triggered.', 'success')}
                className="px-5 py-2.5 rounded-xl border border-outline text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all"
              >
                Download PDF
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-premium flex items-center gap-1.5 border-none"
              >
                <Printer className="w-3.5 h-3.5" /> Print Invoice
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* CUSTOMER ACCOUNT, HELD AIRLINES & EMAIL ROUTING MODAL */}
      {editingCustomer && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setEditingCustomer(null)}
        >
          <div 
            className="bg-surface-lowest border border-outline rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-outline flex items-center justify-between bg-surface-dim/50 shrink-0">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                  Customer Account & Airline Email Routing
                </span>
                <h3 className="text-base font-black text-on-surface uppercase">
                  {editingCustomer.name || 'New Customer Account'}
                </h3>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="w-9 h-9 rounded-xl bg-surface-dim hover:bg-error/15 text-on-surface hover:text-error flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerAccount} className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Section 1: Core Account Details & Balances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Customer Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.name}
                    onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    placeholder="e.g. Access Flight Support / Emirates"
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Billing Classification
                  </label>
                  <select
                    value={editingCustomer.classification}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        classification: e.target.value as CustomerClassification
                      })
                    }
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="ADVANCE">ADVANCE (Pre-Paid Deposit)</option>
                    <option value="CREDIT">CREDIT (Periodic Invoicing)</option>
                    <option value="CASH">CASH (Immediate Settlement)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Circular Rate ($ / Liter)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={editingCustomer.defaultPricePerLiter ?? 1.19197}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        defaultPricePerLiter: parseFloat(e.target.value) || 1.19197
                      })
                    }
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Advance Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCustomer.advanceBalance}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const rate = editingCustomer.defaultPricePerLiter || 1.19197;
                      setEditingCustomer({
                        ...editingCustomer,
                        advanceBalance: val,
                        runningBalance: editingCustomer.classification === 'ADVANCE' ? val : editingCustomer.runningBalance,
                        balanceLiters: editingCustomer.classification === 'ADVANCE' ? Math.round(val / rate) : editingCustomer.balanceLiters
                      });
                    }}
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Running Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCustomer.runningBalance}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        runningBalance: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Credit Limit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCustomer.creditLimit}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        creditLimit: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    5-Day Sales Threshold ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCustomer.estimated5DaysSales}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        estimated5DaysSales: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">
                    Account-Level Emails (comma separated)
                  </label>
                  <input
                    type="text"
                    value={(editingCustomer.accountEmails || []).join(', ')}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        accountEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })
                    }
                    placeholder="ops@account.com, billing@account.com"
                    className="w-full bg-surface-dim border border-outline px-3.5 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none"
                  />
                </div>

                <div className="flex items-center justify-between bg-surface-dim/60 border border-outline rounded-xl px-4 py-3 mt-auto">
                  <div>
                    <div className="text-xs font-black text-on-surface uppercase">Real-Time Flight Job Balance Deduction</div>
                    <div className="text-[10px] text-on-surface-dim">
                      Automatically deduct uplift amount from balance as flight jobs are entered
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingCustomer.autoDeductOnUplift !== false}
                    onChange={e =>
                      setEditingCustomer({
                        ...editingCustomer,
                        autoDeductOnUplift: e.target.checked
                      })
                    }
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Section 2: Held Airlines & Per-Airline Email Routing */}
              <div className="border-t border-outline pt-5 space-y-4">
                <div>
                  <h4 className="text-xs font-black text-on-surface uppercase flex items-center gap-2">
                    <Plane className="w-4 h-4 text-primary" />
                    Airlines Held by this Customer Account ({(editingCustomer.airlineHoldings || []).length})
                  </h4>
                  <p className="text-[10px] text-on-surface-dim">
                    Add every airline operated or represented under this customer account along with the email addresses to receive Flight Jobs and Fuel Delivery Invoices.
                  </p>
                </div>

                {/* Add / Update Airline Holding Form */}
                <div className="bg-surface-dim/50 border border-outline rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-on-surface-dim">Airline Prefix / Code *</label>
                      <input
                        type="text"
                        value={newAirlineCode}
                        onChange={e => setNewAirlineCode(e.target.value.toUpperCase())}
                        placeholder="e.g. EK, BA, EY, Q2"
                        className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-black text-on-surface uppercase outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[9px] font-black uppercase text-on-surface-dim">Airline Name *</label>
                      <input
                        type="text"
                        value={newAirlineName}
                        onChange={e => setNewAirlineName(e.target.value)}
                        placeholder="e.g. British Airways / Emirates"
                        className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-on-surface-dim">Flight Job Dispatch Emails</label>
                      <input
                        type="text"
                        value={newAirlineJobEmails}
                        onChange={e => setNewAirlineJobEmails(e.target.value)}
                        placeholder="ops@airline.com, dispatch@agent.com"
                        className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-on-surface-dim">Billing / Invoice Emails</label>
                      <input
                        type="text"
                        value={newAirlineBillingEmails}
                        onChange={e => setNewAirlineBillingEmails(e.target.value)}
                        placeholder="fuel.billing@airline.com"
                        className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-on-surface-dim">Aircraft Tail Regs (optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newAirlineRegs}
                          onChange={e => setNewAirlineRegs(e.target.value.toUpperCase())}
                          placeholder="A6-EEO, G-ZBJA"
                          className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface uppercase outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddAirlineHoldingToEditor}
                          className="kinetic-gradient text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 shadow-premium"
                        >
                          + Add Airline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* List of Held Airlines */}
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                  {(editingCustomer.airlineHoldings || []).map(h => (
                    <div
                      key={h.code}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-dim/30 border border-outline rounded-xl p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-gradient-to-r from-sky-500 to-blue-600 text-white border border-sky-400/30 text-[10px] font-black uppercase font-mono shadow-sm">
                            {h.code}
                          </span>
                          <span className="font-black text-on-surface">{h.name}</span>
                          {(h.aircraftRegs || []).length > 0 && (
                            <span className="text-[10px] text-on-surface-dim font-bold">
                              [Regs: {h.aircraftRegs?.join(', ')}]
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-on-surface-dim">
                          <strong>Job Emails:</strong> {(h.flightJobEmails || []).join(', ') || 'None'} &nbsp;|&nbsp;{' '}
                          <strong>Billing Emails:</strong> {(h.billingEmails || []).join(', ') || 'None'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setNewAirlineCode(h.code);
                            setNewAirlineName(h.name);
                            setNewAirlineJobEmails((h.flightJobEmails || []).join(', '));
                            setNewAirlineBillingEmails((h.billingEmails || []).join(', '));
                            setNewAirlineRegs((h.aircraftRegs || []).join(', '));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-surface-dim hover:bg-primary/15 text-on-surface hover:text-primary text-[9px] font-black uppercase"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAirlineHoldingFromEditor(h.code)}
                          className="px-2.5 py-1 rounded-lg bg-error/10 hover:bg-error/20 text-error text-[9px] font-black uppercase"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-outline pt-4 flex items-center justify-between gap-3">
                {customers.some(c => c.id === editingCustomer.id) ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteCustomerAccount(editingCustomer.id);
                      notify(`Deleted Customer Account "${editingCustomer.name}".`, 'info');
                      setEditingCustomer(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-error/10 hover:bg-error/20 text-error text-[10px] font-black uppercase tracking-wider"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="px-5 py-2.5 rounded-xl border border-outline text-[10px] font-black uppercase tracking-wider text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-widest shadow-premium"
                  >
                    Save Account & Airlines
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* JET A-1 FUEL RATES SCHEDULE MODAL (USD & MVR) */}
      {showFuelRatesModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => {
            setShowFuelRatesModal(false);
            setEditingFuelRate(null);
          }}
        >
          <div 
            className="bg-surface-lowest border border-outline rounded-[28px] sm:rounded-[36px] max-w-4xl w-full max-h-[90vh] my-auto flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-outline flex items-center justify-between gap-4 bg-surface-dim/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Circular Tariff Schedule
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-dim">
                    FX: 1 USD = {activeUsdToMvrRate} MVR
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-on-surface uppercase tracking-tight mt-1">
                  JET A-1 Fuel Rates Schedule (USD & MVR)
                </h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">
                  Configured rates reflect in real-time to Into-Plane cash rate bar and delivery invoices
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFuelRatesModal(false);
                  setEditingFuelRate(null);
                }}
                className="p-2 rounded-xl hover:bg-surface-dim text-on-surface-dim hover:text-on-surface transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {/* Form to Edit or Add a Rate */}
              <div className="bg-surface-dim/50 border border-outline rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    {editingFuelRate ? `Edit Rate: ${editingFuelRate.airlineOrSector}` : 'Add / Set Fuel Rate'}
                  </h4>
                  {editingFuelRate && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFuelRate(null);
                        setRateAirline('');
                        setRateUsd('1.85');
                        setRateMvr('28.527');
                        setRateNotes('');
                      }}
                      className="text-[9px] font-black text-on-surface-dim hover:text-primary uppercase"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">Airline / Sector</label>
                    <input
                      type="text"
                      value={rateAirline}
                      onChange={e => setRateAirline(e.target.value.toUpperCase())}
                      placeholder="e.g. INT, DOM, FLY ME, IAS"
                      className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-black text-on-surface uppercase outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">Effective Date</label>
                    <input
                      type="text"
                      value={rateDate}
                      onChange={e => setRateDate(e.target.value)}
                      placeholder="1-Mar-23"
                      className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">USD Rate ($/L)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-on-surface-dim">$</span>
                      <input
                        type="number"
                        step="0.001"
                        value={rateUsd}
                        onChange={e => {
                          const val = e.target.value;
                          setRateUsd(val);
                          const n = parseFloat(val);
                          if (!isNaN(n)) {
                            setRateMvr((n * activeUsdToMvrRate).toFixed(3));
                          }
                        }}
                        placeholder="1.85"
                        className="w-full bg-surface-lowest border border-outline pl-7 pr-3 py-2 rounded-xl text-xs font-black text-emerald-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">MVR Rate (MVR/L)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-on-surface-dim">Rf</span>
                      <input
                        type="number"
                        step="0.001"
                        value={rateMvr}
                        onChange={e => {
                          const val = e.target.value;
                          setRateMvr(val);
                          const n = parseFloat(val);
                          if (!isNaN(n)) {
                            setRateUsd((n / activeUsdToMvrRate).toFixed(3));
                          }
                        }}
                        placeholder="28.527"
                        className="w-full bg-surface-lowest border border-outline pl-8 pr-3 py-2 rounded-xl text-xs font-black text-cyan-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">Primary Currency</label>
                    <select
                      value={rateCurrency}
                      onChange={e => setRateCurrency(e.target.value as any)}
                      className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-black text-on-surface uppercase outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="MVR">MVR (Rf)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">Category</label>
                    <select
                      value={rateCategory}
                      onChange={e => setRateCategory(e.target.value as any)}
                      className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-black text-on-surface uppercase outline-none"
                    >
                      <option value="INT">International (INT)</option>
                      <option value="DOM">Domestic (DOM)</option>
                      <option value="SEAPLANE">Seaplane (SEAPLANE)</option>
                      <option value="AIRLINE_CUSTOM">Airline Contract Custom</option>
                      <option value="IAS_DISCOUNT">Volume Discount</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-on-surface-dim tracking-wider">Notes / Reference</label>
                    <input
                      type="text"
                      value={rateNotes}
                      onChange={e => setRateNotes(e.target.value)}
                      placeholder="e.g. Standard international uplift tariff"
                      className="w-full bg-surface-lowest border border-outline px-3 py-2 rounded-xl text-xs font-bold text-on-surface outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!rateAirline.trim() || !rateUsd || !rateMvr) {
                        notify('Airline/Sector, USD rate and MVR rate are required.', 'warning');
                        return;
                      }
                      const numUsd = parseFloat(rateUsd) || 0;
                      const numMvr = parseFloat(rateMvr) || 0;

                      if (editingFuelRate) {
                        updateFuelRate({
                          ...editingFuelRate,
                          airlineOrSector: rateAirline.trim(),
                          effectiveDate: rateDate.trim() || '1-Mar-23',
                          rateUsd: numUsd,
                          rateMvr: numMvr,
                          currency: rateCurrency,
                          category: rateCategory,
                          notes: rateNotes.trim(),
                          active: true
                        });
                        notify(`Updated rate for "${rateAirline}" ($${numUsd} / MVR ${numMvr}).`, 'success');
                        setEditingFuelRate(null);
                      } else {
                        addFuelRate({
                          airlineOrSector: rateAirline.trim(),
                          effectiveDate: rateDate.trim() || '1-Mar-23',
                          rateUsd: numUsd,
                          rateMvr: numMvr,
                          currency: rateCurrency,
                          category: rateCategory,
                          notes: rateNotes.trim(),
                          active: true
                        });
                        notify(`Added new rate for "${rateAirline}" ($${numUsd} / MVR ${numMvr}).`, 'success');
                      }
                      setRateAirline('');
                      setRateNotes('');
                    }}
                    className="kinetic-gradient text-white font-black px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest shadow-premium"
                  >
                    {editingFuelRate ? 'Update Fuel Rate' : 'Save Fuel Rate'}
                  </button>
                </div>
              </div>

              {/* Rates Schedule Table Matching Screenshot 3 */}
              <div className="border border-outline rounded-2xl overflow-hidden">
                <div className="p-3 bg-surface-dim border-b border-outline flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase text-on-surface tracking-wider">
                    Official Jet A-1 Tariff Schedule ({fuelRates.length} Entries)
                  </div>
                  <span className="text-[9px] font-black text-emerald-500 uppercase">
                    Live Synced with Apron Ops
                  </span>
                </div>
                <div className="overflow-x-auto touch-pan-x custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-surface-lowest border-b border-outline text-[10px] font-black uppercase tracking-widest text-on-surface-dim">
                        <th className="py-2.5 px-3">Airline / Sector</th>
                        <th className="py-2.5 px-3">Effective Date</th>
                        <th className="py-2.5 px-3 text-right">USD Rate ($/L)</th>
                        <th className="py-2.5 px-3 text-right">MVR Rate (MVR/L)</th>
                        <th className="py-2.5 px-2 text-center">Curr</th>
                        <th className="py-2.5 px-3">Notes</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline">
                      {fuelRates.map(r => (
                        <tr key={r.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-2.5 px-3 font-black text-on-surface">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>{r.airlineOrSector}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-on-surface-dim text-[11px]">
                            {r.effectiveDate}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-500 font-mono text-[11px]">
                            ${r.rateUsd.toFixed(r.rateUsd < 1 ? 3 : 2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-cyan-500 font-mono text-[11px]">
                            {r.rateMvr.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-2 text-center font-black text-[9px] uppercase">
                            <span className={`px-2 py-0.5 rounded ${r.currency === 'MVR' ? 'bg-cyan-500/10 text-cyan-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                              {r.currency}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-dim text-[10px]">
                            {r.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFuelRate(r);
                                setRateAirline(r.airlineOrSector);
                                setRateDate(r.effectiveDate);
                                setRateUsd(String(r.rateUsd));
                                setRateMvr(String(r.rateMvr));
                                setRateCurrency(r.currency);
                                setRateCategory(r.category);
                                setRateNotes(r.notes || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[9px] font-black uppercase tracking-wider"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-outline bg-surface-dim/30 flex items-center justify-between">
              <span className="text-[10px] text-on-surface-dim font-bold">
                Rates automatically configure cash flight invoices in Into-Plane and Seaplane modules.
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowFuelRatesModal(false);
                  setEditingFuelRate(null);
                }}
                className="px-5 py-2 rounded-xl bg-surface-lowest hover:bg-surface-dim border border-outline text-[10px] font-black uppercase text-on-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
