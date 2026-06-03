import React, { useState } from 'react';
import { useFinanceData, CustomerClassification, CustomerAccount, FuelRequest, MpdSale } from '../context/FinanceDataContext';
import { useNotification } from '../context/NotificationContext';
import { 
  DollarSign, FileText, Upload, CheckCircle, RefreshCw, BarChart2, Briefcase, 
  FileSpreadsheet, AlertTriangle, Printer, Download, ChevronRight, PlusCircle, 
  Layers, Scale, ListTodo, Shield, Trash2, ArrowUpRight, Search, Eye, X
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';

export const FinanceModule: React.FC = () => {
  const { 
    customers, upcomingPayments, invoices, receipts, proformaRegister, 
    fuelRequests, varianceLogs, procurementPRs, surcharges, mpdSales, customsShipments,
    reviewSwiftCopy, syncOracleReceipt, runBillingProcess, applyFIFOLogic, 
    generateProforma, approveVariance, createProcurementPR, verifyVendorInvoice, 
    raisePO, enterAPInvoice, addSurcharge, resetAllFinanceMockData
  } = useFinanceData();

  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState<'balances' | 'billing' | 'variance' | 'procurement' | 'reports'>('balances');
  
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

  // MOCK COGS Chart Data
  const cogsChartData = [
    { name: 'Jan', Sales: 2400000, COGS: 1800000, Margin: 600000 },
    { name: 'Feb', Sales: 2700000, COGS: 2000000, Margin: 700000 },
    { name: 'Mar', Sales: 3100000, COGS: 2300000, Margin: 800000 },
    { name: 'Apr', Sales: 2900000, COGS: 2150000, Margin: 750000 },
    { name: 'May', Sales: 3500000, COGS: 2600000, Margin: 900000 },
  ];

  // Filters
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.classification.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="p-4 lg:p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
      
      {/* Top Title & Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-outline pb-6">
        <div>
          <span className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
            INTEGRATED ERP PORTAL
          </span>
          <h2 className="headline-lg text-on-surface tracking-tighter uppercase mt-3">
            FINANCE & BILLING DIVISION
          </h2>
          <p className="text-on-surface-dim uppercase tracking-wider text-[9px] font-black opacity-60">
            Real-time Invoicing • Cost of Goods Sold • Oracle Sync
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              resetAllFinanceMockData();
              notify('Financial simulator database reset.', 'info');
            }}
            className="flex items-center gap-2 border border-outline hover:bg-surface-dim px-4.5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface transition-all active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5 text-error" />
            Reset Data
          </button>
        </div>
      </div>

      {/* Tabs Row — scrollable on mobile/tablet, evenly spread on desktop */}
      <div className="bg-surface-dim p-1 rounded-2xl border border-outline relative flex w-full overflow-x-auto no-scrollbar shadow-inner">
        {/* Sliding kinetic-gradient indicator — fixed widths for mobile, flex-1 tracking on lg */}
        <div
          className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
            lg:hidden
            ${activeTab === 'balances'    ? 'left-1 w-[140px] translate-x-0'       : ''}
            ${activeTab === 'billing'     ? 'left-1 w-[140px] translate-x-[140px]'  : ''}
            ${activeTab === 'variance'    ? 'left-1 w-[148px] translate-x-[280px]'  : ''}
            ${activeTab === 'procurement' ? 'left-1 w-[168px] translate-x-[428px]'  : ''}
            ${activeTab === 'reports'     ? 'left-1 w-[155px] translate-x-[596px]'  : ''}
          `}
        />
        {/* Desktop indicator uses percentage-based 20% width since buttons are flex-1 equal */}
        <div
          className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium
            hidden lg:block w-[calc(20%-1.6px)]
            ${activeTab === 'balances'    ? 'translate-x-0'    : ''}
            ${activeTab === 'billing'     ? 'translate-x-[100%]' : ''}
            ${activeTab === 'variance'    ? 'translate-x-[200%]' : ''}
            ${activeTab === 'procurement' ? 'translate-x-[300%]' : ''}
            ${activeTab === 'reports'     ? 'translate-x-[400%]' : ''}
          `}
        />
        {[
          { id: 'balances',    label: 'Balances & SWIFTs',  icon: DollarSign,      w: 'w-[140px] lg:w-auto' },
          { id: 'billing',     label: 'Invoicing & FIFO',    icon: FileText,        w: 'w-[140px] lg:w-auto' },
          { id: 'variance',    label: 'Variance & COGS',     icon: Scale,           w: 'w-[148px] lg:w-auto' },
          { id: 'procurement', label: 'Duty & Procurement',  icon: Layers,          w: 'w-[168px] lg:w-auto' },
          { id: 'reports',     label: 'Financial Reports',   icon: FileSpreadsheet, w: 'w-[155px] lg:w-auto' },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`${t.w} flex-shrink-0 lg:flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-black uppercase tracking-wider transition-all relative z-10 ${
                isActive ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>


      {/* Content Container */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* TAB 1: Balances & SWIFT Copy Review */}
        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Customer accounts table */}
            <div className="lg:col-span-2 bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Customer Credit & Balances</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Real-time validation matching circular rates</p>
                </div>
                <div className="flex items-center border border-outline bg-surface-dim px-3 py-1.5 rounded-xl max-w-xs">
                  <Search className="w-4 h-4 opacity-40 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search accounts..."
                    className="bg-transparent border-none outline-none text-xs font-bold text-on-surface w-full"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-outline text-[10px] font-black uppercase tracking-widest text-on-surface-dim">
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Classification</th>
                      <th className="pb-3 text-right">Advance Balance</th>
                      <th className="pb-3 text-right">Balance (Liters)</th>
                      <th className="pb-3 text-right">Credit Limit</th>
                      <th className="pb-3 text-right">5-Day Sales Limit</th>
                      <th className="pb-3">Threshold Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {filteredCustomers.map(c => {
                      const isLow = c.classification === 'ADVANCE' && c.advanceBalance < c.estimated5DaysSales;
                      return (
                        <tr key={c.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-4 font-black text-on-surface">{c.name}</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border
                              ${c.classification === 'ADVANCE' ? 'bg-primary/10 text-primary border-primary/20' : 
                                c.classification === 'CREDIT' ? 'bg-warning/10 text-warning border-warning/20' : 
                                'bg-success/10 text-success border-success/20'}`}>
                              {c.classification}
                            </span>
                          </td>
                          <td className="py-4 text-right font-bold text-primary">
                            {c.classification === 'ADVANCE' ? `$${c.advanceBalance.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-4 text-right font-bold text-on-surface">
                            {c.classification === 'ADVANCE' && c.balanceLiters ? `${c.balanceLiters.toLocaleString()} L` : '-'}
                          </td>
                          <td className="py-4 text-right font-bold text-on-surface-dim">
                            {c.classification === 'CREDIT' ? `$${c.creditLimit.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-4 text-right font-bold text-on-surface-dim">
                            {c.classification === 'ADVANCE' || c.classification === 'CREDIT' ? `$${c.estimated5DaysSales.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-4">
                            {isLow ? (
                              <span className="flex items-center gap-1.5 text-error font-black uppercase text-[9px] tracking-widest animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5" /> CRITICAL (LOW)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-success font-bold uppercase text-[9px] tracking-widest">
                                <CheckCircle className="w-3.5 h-3.5" /> SECURE
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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

        {/* TAB 2: Billing & Invoicing Automation */}
        {activeTab === 'billing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
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
      {selectedTicket && (
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
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
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
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-2">
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
              <div className="pt-6 border-t border-slate-100">
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
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => notify('PDF Invoice copy download triggered.', 'success')}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all"
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
        </div>
      )}

    </div>
  );
};
