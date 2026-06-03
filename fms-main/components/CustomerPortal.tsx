import React, { useState } from 'react';
import { useFinanceData, FuelRequest } from '../context/FinanceDataContext';
import { useNotification } from '../context/NotificationContext';
import { 
  Coins, UploadCloud, FileText, CheckCircle, Calendar, Plane, 
  DollarSign, AlertCircle, Download, Search, RefreshCw, FileCheck, X, Printer, Eye
} from 'lucide-react';

export const CustomerPortal: React.FC<{ user: any }> = ({ user }) => {
  const { 
    customers, upcomingPayments, invoices, receipts, fuelRequests,
    uploadSwiftCopy, submitFuelRequest 
  } = useFinanceData();

  const { notify } = useNotification();
  
  // Resolve this user to a customer account (Emirates c1)
  const customerId = user.id === 'u10' ? 'c1' : 'c1';
  const customer = customers.find(c => c.id === customerId)!;

  // Local Form state
  const [qty, setQty] = useState('');
  const [aircraftReg, setAircraftReg] = useState('');
  const [reqDate, setReqDate] = useState(new Date().toISOString().split('T')[0]);

  const [swiftRef, setSwiftRef] = useState('');
  const [swiftAmount, setSwiftAmount] = useState('');
  const [isSwiftUploading, setIsSwiftUploading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'request' | 'statements' | 'payments'>('request');

  // Selected delivery ticket for Tax Invoice modal
  const [selectedTicket, setSelectedTicket] = useState<FuelRequest | null>(null);

  const pricePerLiter = 1.19197; // exact rate from Jet Fuel Finance Sheet screenshot
  const totalCost = qty ? parseInt(qty) * pricePerLiter : 0;
  const isBlocked = customer.classification === 'ADVANCE' && customer.advanceBalance < totalCost;
  const shortfall = totalCost - customer.advanceBalance;

  const handleFuelRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qty || !aircraftReg) {
      notify('Please specify aircraft registration and fuel volume.', 'warning');
      return;
    }
    const result = submitFuelRequest(customerId, parseInt(qty), aircraftReg, {
      categorySector: 'INT',
      operator: customer.name.toUpperCase(),
      flightNumber: 'EK' + Math.floor(100 + Math.random() * 900),
      aircraftType: 'B777-300'
    });
    if (result.success) {
      notify(result.message, 'success');
      setQty('');
      setAircraftReg('');
    } else {
      notify(result.message, 'error');
    }
  };

  const handleSwiftUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swiftRef || !swiftAmount) {
      notify('Please enter SWIFT reference and payment amount.', 'warning');
      return;
    }
    setIsSwiftUploading(true);
    setTimeout(() => {
      uploadSwiftCopy(customerId, swiftRef, parseFloat(swiftAmount));
      setIsSwiftUploading(false);
      notify(`SWIFT Copy ${swiftRef} uploaded successfully. Pending Billing Team review.`, 'success');
      setSwiftRef('');
      setSwiftAmount('');
    }, 1200);
  };

  // Filter statements matching exact SOA columns
  const clientUplifts = fuelRequests.filter(fr => fr.customerId === customerId);
  const filteredUplifts = clientUplifts.filter(u => 
    u.aircraftReg.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.deliveryNumber.includes(searchQuery)
  );

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
      
      {/* Portal Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-outline pb-6">
        <div>
          <span className="text-[10px] font-black uppercase text-success tracking-widest bg-success/10 px-3 py-1.5 rounded-full border border-success/20">
            CUSTOMER SELF-SERVICE PORTAL
          </span>
          <h2 className="headline-lg text-on-surface tracking-tighter uppercase mt-3">
            {customer.name} Portal
          </h2>
          <p className="text-on-surface-dim uppercase tracking-wider text-[9px] font-black opacity-60">
            Fuel Uplifts Management • Statement ledger • Payment upload
          </p>
        </div>
        
        {/* Top Balance indicator */}
        <div className="bg-surface-lowest border border-outline px-6 py-4 rounded-[22px] shadow-premium flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-on-surface-dim opacity-50 block">Available Balance</span>
            <span className="text-lg font-black text-primary">${customer.advanceBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Actions & Tab Forms */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Navigation Tabs — EquipmentStatus-style pill bar */}
          <div className="bg-surface-dim p-1 rounded-2xl border border-outline relative flex w-full overflow-x-auto no-scrollbar shadow-inner">
            {/* Mobile/tablet: fixed-width pixel indicator */}
            <div
              className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium lg:hidden
                ${activeTab === 'request'    ? 'left-1 w-[130px] translate-x-0'      : ''}
                ${activeTab === 'statements' ? 'left-1 w-[155px] translate-x-[130px]' : ''}
                ${activeTab === 'payments'   ? 'left-1 w-[145px] translate-x-[285px]' : ''}
              `}
            />
            {/* Desktop: percentage-based indicator (flex-1 equal thirds) */}
            <div
              className={`absolute top-1 bottom-1 rounded-xl kinetic-gradient transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-premium hidden lg:block w-[calc(33.333%-1.33px)]
                ${activeTab === 'request'    ? 'translate-x-0'    : ''}
                ${activeTab === 'statements' ? 'translate-x-[100%]' : ''}
                ${activeTab === 'payments'   ? 'translate-x-[200%]' : ''}
              `}
            />
            {[
              { id: 'request',    label: 'Request Fuel',      w: 'w-[130px] lg:w-auto' },
              { id: 'statements', label: 'Uplift Statements', w: 'w-[155px] lg:w-auto' },
              { id: 'payments',   label: 'Ledger Payments',   w: 'w-[145px] lg:w-auto' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`${t.w} flex-shrink-0 lg:flex-1 flex items-center justify-center py-3 text-[10px] font-black uppercase tracking-widest transition-all relative z-10
                  ${activeTab === t.id ? 'text-white' : 'text-on-surface-dim hover:text-on-surface'}`}
              >
                {t.label}
              </button>
            ))}
          </div>


          {/* TAB 1: Fuel request form with live validation */}
          {activeTab === 'request' && (
            <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div>
                <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Request Flight Fueling</h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Submits real-time validated fueling command to Apron team</p>
              </div>

              <form onSubmit={handleFuelRequest} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Aircraft Registration</label>
                    <input
                      type="text"
                      value={aircraftReg}
                      onChange={(e) => setAircraftReg(e.target.value.toUpperCase())}
                      placeholder="A6-EED"
                      className="w-full bg-surface-dim border border-outline px-4 py-3 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Required Volume (Liters)</label>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="35000"
                      className="w-full bg-surface-dim border border-outline px-4 py-3 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Delivery Date</label>
                    <input
                      type="date"
                      value={reqDate}
                      onChange={(e) => setReqDate(e.target.value)}
                      className="w-full bg-surface-dim border border-outline px-4 py-3 rounded-xl text-xs font-bold text-on-surface outline-none"
                    />
                  </div>
                </div>

                {/* Real-time balance checker display */}
                {qty && (
                  <div className={`p-5 rounded-2xl border transition-all animate-in fade-in duration-300
                    ${isBlocked 
                      ? 'bg-error/5 border-error/20 text-error' 
                      : 'bg-success/5 border-success/20 text-success'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      {isBlocked ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      <span className="text-xs font-black uppercase tracking-widest">
                        {isBlocked ? 'Blocked: Insufficient Advance Funds' : 'Authorized: Funds cleared'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-bold">
                      <div>Circular Rate: <span className="font-black text-on-surface">${pricePerLiter.toFixed(5)}/L</span></div>
                      <div>Total Cost: <span className="font-black text-on-surface">${totalCost.toLocaleString()}</span></div>
                      {isBlocked ? (
                        <div className="text-error">Shortfall: <span className="font-black">${shortfall.toLocaleString()}</span></div>
                      ) : (
                        <div className="text-success">Remaining Balance: <span className="font-black">${(customer.advanceBalance - totalCost).toLocaleString()}</span></div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBlocked}
                  className={`w-full font-black py-4 px-6 rounded-[18px] text-[11px] uppercase tracking-widest transition-all active:scale-95 hover:scale-[1.02] shadow-premium
                    ${isBlocked 
                      ? 'bg-on-surface-dim/20 text-on-surface-dim/40 cursor-not-allowed border border-outline' 
                      : 'kinetic-gradient text-white shadow-glow hover:shadow-premium'}`}
                >
                  Confirm Fuel Uplift Request
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Statement ledger access perfectly matching the SOA document */}
          {activeTab === 'statements' && (
            <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Statement of Accounts</h3>
                  <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Comprehensive statement history of delivery tickets</p>
                </div>
                <div className="flex items-center border border-outline bg-surface-dim px-3 py-1.5 rounded-xl max-w-xs">
                  <Search className="w-4 h-4 opacity-40 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Ticket / Flight..."
                    className="bg-transparent border-none outline-none text-xs font-bold text-on-surface w-full"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b border-outline text-[9px] font-black uppercase tracking-widest text-on-surface-dim pb-3">
                      <th className="pb-3">DEL NO</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Flight No</th>
                      <th className="pb-3">Registration</th>
                      <th className="pb-3">A/C Type</th>
                      <th className="pb-3 text-right">Volume</th>
                      <th className="pb-3 text-right">Rate</th>
                      <th className="pb-3 text-right">Debit ($)</th>
                      <th className="pb-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                    {filteredUplifts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12">
                          <FileText className="w-12 h-12 opacity-20 mx-auto mb-2 text-on-surface-dim" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-40">No statements registered</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUplifts.map(u => (
                        <tr key={u.id} className="hover:bg-surface-dim/40 transition-colors">
                          <td className="py-4">
                            <button
                              onClick={() => setSelectedTicket(u)}
                              className="font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-tight"
                            >
                              <Eye className="w-3.5 h-3.5" /> {u.deliveryNumber}
                            </button>
                          </td>
                          <td className="py-4 text-on-surface-dim font-bold">{u.date}</td>
                          <td className="py-4 font-black text-on-surface">{u.flightNumber}</td>
                          <td className="py-4 font-bold">{u.aircraftReg}</td>
                          <td className="py-4 text-on-surface-dim">{u.aircraftType}</td>
                          <td className="py-4 text-right font-black">{u.quantityLiters.toLocaleString()} L</td>
                          <td className="py-4 text-right font-bold text-on-surface-dim">${u.pricePerLiter.toFixed(5)}</td>
                          <td className="py-4 text-right font-black text-error">${u.amount.toLocaleString()}</td>
                          <td className="py-4 text-right font-bold text-on-surface">$0</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Payments logs */}
          {activeTab === 'payments' && (
            <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
              <div>
                <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Cleared Receipts & SWIFTs</h3>
                <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Sync confirmations matching cleared Oracle receivables</p>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {upcomingPayments.filter(p => p.customerId === customerId).length === 0 ? (
                  <div className="text-center py-12">
                    <FileCheck className="w-12 h-12 opacity-20 mx-auto mb-2 text-on-surface-dim" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-40">No payment logs available</p>
                  </div>
                ) : (
                  upcomingPayments.filter(p => p.customerId === customerId).map(p => (
                    <div key={p.id} className="bg-surface-dim/40 border border-outline p-4 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest block">Reference: {p.referenceNumber}</span>
                        <h4 className="font-bold text-on-surface mt-1">SWIFT copy upload</h4>
                        <span className="text-[9px] text-on-surface-dim uppercase tracking-widest block mt-0.5">{p.uploadDate}</span>
                      </div>
                      <div className="text-right space-y-2">
                        <span className="font-black text-success">${p.amount.toLocaleString()}</span>
                        <span className={`block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-center border ml-auto w-fit
                          ${p.status === 'APPROVED' ? 'bg-success/10 text-success border-success/20' : 
                            p.status === 'CLEARED_IN_ORACLE' ? 'bg-primary/10 text-primary border-primary/20' : 
                            'bg-warning/10 text-warning border-warning/20'}`}>
                          {p.status === 'APPROVED' ? 'FMS Credited' : p.status === 'CLEARED_IN_ORACLE' ? 'Oracle Cleared' : 'Pending Review'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: SWIFT Copy Upload & Balance Threshold Alerts */}
        <div className="space-y-8">
          
          {/* SWIFT copy uploader */}
          <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
            <div>
              <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Upload SWIFT copy</h3>
              <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">Pre-pay confirmation to credit upcoming fuel requests</p>
            </div>

            <form onSubmit={handleSwiftUpload} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">SWIFT Telex Reference</label>
                <input
                  type="text"
                  value={swiftRef}
                  onChange={(e) => setSwiftRef(e.target.value.toUpperCase())}
                  placeholder="MT103-EMI-449"
                  className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-on-surface-dim tracking-wider">Payment Amount ($)</label>
                <input
                  type="number"
                  value={swiftAmount}
                  onChange={(e) => setSwiftAmount(e.target.value)}
                  placeholder="150000"
                  className="w-full bg-surface-dim border border-outline px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface outline-none placeholder:opacity-30"
                />
              </div>

              <div className="border border-dashed border-outline hover:border-primary/40 rounded-2xl p-6 text-center transition-all bg-surface-dim/20 cursor-pointer">
                <UploadCloud className="w-8 h-8 opacity-45 mx-auto mb-2 text-primary" />
                <span className="text-[9px] font-black text-on-surface-dim uppercase tracking-wider block">Drag PDF Copy Here</span>
                <span className="text-[8px] text-on-surface-dim opacity-50 block mt-1">Maximum file size: 5MB</span>
              </div>

              <button
                type="submit"
                disabled={isSwiftUploading}
                className={`w-full font-black py-3.5 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 hover:scale-[1.02] shadow-premium mt-2 flex justify-center items-center gap-2
                  ${isSwiftUploading
                    ? 'bg-on-surface-dim/20 text-on-surface-dim/40 cursor-not-allowed border border-outline'
                    : 'kinetic-gradient text-white shadow-glow hover:shadow-premium'}`}
              >
                {isSwiftUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading...
                  </>
                ) : 'Submit Telex Confirmation'}
              </button>
            </form>
          </div>

          {/* Account status & rules info */}
          <div className="bg-surface-lowest border border-outline p-6 rounded-[32px] shadow-premium space-y-6">
            <div>
              <h3 className="title-md text-on-surface font-black uppercase tracking-tight">Contractual Limits</h3>
              <p className="text-[10px] text-on-surface-dim uppercase font-bold tracking-wider">SOP classification as defined by MACL Commercial</p>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-dim/40 border border-outline p-4 rounded-2xl space-y-3">
                <div className="flex justify-between text-xs border-b border-outline pb-2 font-bold text-on-surface-dim">
                  <span>Billing Group:</span>
                  <span className="text-on-surface font-black">Advance Pre-Pay</span>
                </div>
                <div className="flex justify-between text-xs border-b border-outline pb-2 font-bold text-on-surface-dim">
                  <span>Circular Price:</span>
                  <span className="text-on-surface font-black">${pricePerLiter.toFixed(5)} / Liter</span>
                </div>
                <div className="flex justify-between text-xs border-b border-outline pb-2 font-bold text-on-surface-dim">
                  <span>5-Day Alert Threshold:</span>
                  <span className="text-error font-black">$150,000</span>
                </div>
                <div className="flex justify-between text-xs font-black text-on-surface pt-1.5">
                  <span>Authorized Handlers:</span>
                  <span className="text-primary font-black">Third-Party agents</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>

      </div>

      {/* ─── PREMIUM TAX INVOICE MODAL (CLIENT SIDE VIEW) ─── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => setSelectedTicket(null)}>
          <div 
            className="bg-white text-slate-800 rounded-3xl w-full max-w-4xl shadow-premium border border-outline/50 overflow-hidden flex flex-col my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">TAX INVOICE STATEMENT RECORD</span>
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
                  <span className="text-[10px] font-black text-slate-400 uppercase block mt-1">Invoice No: {selectedTicket.invoiceNumber || 'FFF/2025/2500001322'}</span>
                  <span className="text-[10px] font-bold text-slate-500 block">Date: {selectedTicket.date}</span>
                </div>
              </div>

              {/* Customer and billing info */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Billed To:</span>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{customer.name}</h3>
                  <p className="text-[10px] text-slate-500">Corporate Account Code: {customer.id}</p>
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
                  <tr>
                    <td className="py-4 font-bold text-slate-800 uppercase">
                      JET FUEL SALES FROM {selectedTicket.date}<br/>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Flight: {selectedTicket.flightNumber} • A/C Reg: {selectedTicket.aircraftReg}</span>
                    </td>
                    <td className="py-4 text-right font-black">{selectedTicket.quantityLiters.toLocaleString()} Liters</td>
                    <td className="py-4 text-right font-bold text-slate-500">${selectedTicket.pricePerLiter.toFixed(5)}</td>
                    <td className="py-4 text-right font-black text-slate-900">${selectedTicket.amount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              {/* Total calculations */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-64 space-y-2 text-xs font-bold text-slate-500">
                  <div className="flex justify-between">
                    <span>GST (8%):</span>
                    <span className="text-slate-800">${(selectedTicket.amount * 0.08).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-2">
                    <span>Grand Total:</span>
                    <span className="text-slate-900">${(selectedTicket.amount * 1.08).toLocaleString()}</span>
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
                  </tbody>
                </table>
              </div>

            </div>

            {/* Print trigger footer */}
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => notify('PDF Statement download triggered.', 'success')}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-100 transition-all hover:scale-[1.02] active:scale-95"
              >
                Download PDF
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl kinetic-gradient text-white text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-premium flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
