import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sailboat, MapPin, Droplet, Save, CheckCircle, AlertTriangle, Calendar, FileText, Printer, Mail, Share2, X, ChevronLeft, CheckCheck, Eye } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { useFinanceData } from '../context/FinanceDataContext';
import { UserRole, FlightLog } from '../types';
import { checkDuplicateTicketAcrossJetA1 } from '../services/ticketValidation';
import { SignatureAcknowledgment } from './SignatureAcknowledgment';
import { generateInvoiceHtml, generateInvoicePdfFile, openPrintInvoice, sendInvoiceEmail, shareInvoice } from '../services/invoicePdfService';

interface SeaplaneProps {
    user?: any;
}

export const Seaplane: React.FC<SeaplaneProps> = ({ user }) => {
    const { flightLogs, staff, tanks, updateTankLevel, addFlightLogEntry, isTicketAutoEnabled, previewNextTicketNumber, generateTicketNumber } = useOperationalData();
    const { resolveCustomerByFlightOrAirline } = useFinanceData();
    const { notify } = useNotification();
    const isAutoJetA1 = isTicketAutoEnabled('JET_A1');
    const isAutoPaper = isTicketAutoEnabled('PAPER_OFFLINE');
    const [isPaperMode, setIsPaperMode] = useState(false);

    // Verifying Officer Name dropdown lists DEPOT staffs (Managers and Operators)
    const activeOfficers = (staff || []).filter(s => [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(s.role));
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [completedInvoiceLog, setCompletedInvoiceLog] = useState<FlightLog | null>(null);
    const [invoiceModalEmail, setInvoiceModalEmail] = useState<string>('');
    const [prebuiltInvoicePdf, setPrebuiltInvoicePdf] = useState<File | null>(null);
    const [isSharingPdf, setIsSharingPdf] = useState<boolean>(false);
    const invoiceEmailInputRef = React.useRef<HTMLInputElement | null>(null);

    const [formData, setFormData] = useState({
        operator: '',
        pumpId: 'SCADA',
        date: new Date().toISOString().split('T')[0],
        deliveryNumber: '',
        volume: '',
        officer: '',
        signerName: '',
        signerDesignation: '',
        signerEmail: '',
        signatureDataUrl: null as string | null
    });

    const activeAccountResolution = useMemo(() => {
        if (!formData.operator) {
            return { customer: undefined, airlineHolding: undefined, emails: [] as string[] };
        }
        return resolveCustomerByFlightOrAirline(
            `SEAPLANE-${formData.operator.toUpperCase()}`,
            formData.operator,
            `PUMP-${(formData.pumpId || 'SCADA').toUpperCase()}`,
            formData.operator
        );
    }, [formData.operator, formData.pumpId, resolveCustomerByFlightOrAirline]);

    const completedAccountResolution = useMemo(() => {
        if (!completedInvoiceLog) {
            return { customer: undefined, airlineHolding: undefined, emails: [] as string[] };
        }
        return resolveCustomerByFlightOrAirline(
            completedInvoiceLog.flightNumber,
            completedInvoiceLog.airline,
            completedInvoiceLog.aircraftReg,
            completedInvoiceLog.co
        );
    }, [completedInvoiceLog, resolveCustomerByFlightOrAirline]);

    // Auto-populate signerEmail from the customer account's email directory if empty
    useEffect(() => {
        if (formData.operator && !formData.signerEmail && activeAccountResolution.emails.length > 0) {
            setFormData(prev => !prev.signerEmail ? { ...prev, signerEmail: activeAccountResolution.emails[0] } : prev);
        }
    }, [formData.operator, activeAccountResolution.emails]);

    // Pre-generate the .pdf File when invoice is ready
    useEffect(() => {
        if (completedInvoiceLog) {
            const defaultEmail = completedInvoiceLog.signerEmail || completedAccountResolution.emails[0] || '';
            setInvoiceModalEmail(defaultEmail);
            setPrebuiltInvoicePdf(null);
            generateInvoicePdfFile(completedInvoiceLog, user)
                .then(file => setPrebuiltInvoicePdf(file))
                .catch(err => console.warn('[Seaplane] Prebuild invoice PDF warning:', err));
        } else {
            setPrebuiltInvoicePdf(null);
        }
    }, [completedInvoiceLog?.id, completedInvoiceLog?.deliveryNumber, user, completedAccountResolution.emails]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getPreviewTicket = () => {
        if (formData.deliveryNumber) {
            if (isPaperMode && !formData.deliveryNumber.includes('-P-')) {
                return `MLE-P-${formData.deliveryNumber.replace(/^MLE-P-/i, '')}`;
            }
            return formData.deliveryNumber.startsWith('MLE-') ? formData.deliveryNumber : `MLE-${formData.deliveryNumber}`;
        }
        if (isPaperMode && isAutoPaper) return previewNextTicketNumber('PAPER_OFFLINE');
        if (isAutoJetA1 && !isPaperMode) return previewNextTicketNumber('JET_A1');
        return 'PENDING';
    };

    const handleOpenReviewModal = async (e: React.FormEvent) => {
        e.preventDefault();
        setDuplicateError(null);

        let checkTicket = formData.deliveryNumber
            ? (isPaperMode && !formData.deliveryNumber.includes('-P-')
                ? `MLE-P-${formData.deliveryNumber.replace(/^MLE-P-/i, '')}`
                : (formData.deliveryNumber.startsWith('MLE-') ? formData.deliveryNumber : `MLE-${formData.deliveryNumber}`))
            : '';

        if (checkTicket) {
            const ticketVal = await checkDuplicateTicketAcrossJetA1(checkTicket, undefined, flightLogs);
            if (ticketVal.isDuplicate) {
                const errMsg = ticketVal.message || `Delivery ticket ${checkTicket} already exists in the operations log. Each ticket number must be unique.`;
                setDuplicateError(errMsg);
                notify(errMsg, 'error');
                return;
            }
        }

        const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
        if (parsedVolume <= 0) {
            notify('Please enter a valid daily flow volume greater than 0 L.', 'warning');
            return;
        }

        setShowConfirmModal(true);
    };

    const handleAuthorizeAndSubmit = async () => {
        setDuplicateError(null);

        if (!formData.signatureDataUrl || !formData.signerName?.trim()) {
            notify('Customer / Representative signature and full name are required to synchronize.', 'warning');
            return;
        }

        let finalDeliveryNumber = formData.deliveryNumber ? (formData.deliveryNumber.startsWith('MLE-') ? formData.deliveryNumber : `MLE-${formData.deliveryNumber}`) : '';

        // If auto-generation is active, atomically reserve number
        if (isAutoJetA1 && !finalDeliveryNumber) {
            const cat = isPaperMode ? 'PAPER_OFFLINE' : 'JET_A1';
            const genRes = await generateTicketNumber(cat, user?.name || user?.id || 'System Admin');
            if (genRes.success && genRes.ticketNumber) {
                finalDeliveryNumber = genRes.ticketNumber;
            }
        } else if (isPaperMode && !finalDeliveryNumber.includes('-P-')) {
            finalDeliveryNumber = `MLE-P-${formData.deliveryNumber.replace(/^MLE-P-/i, '')}`;
        }

        if (finalDeliveryNumber) {
            const ticketVal = await checkDuplicateTicketAcrossJetA1(finalDeliveryNumber, undefined, flightLogs);
            if (ticketVal.isDuplicate) {
                const errMsg = ticketVal.message || `Delivery ticket ${finalDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`;
                setDuplicateError(errMsg);
                notify(errMsg, 'error');
                return;
            }
        }

        setLoading(true);
        setShowConfirmModal(false);
        try {
            const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
            const chosenPump = (formData.pumpId || 'SCADA').toUpperCase();
            const newLogId = `sp-${Date.now()}`;
            const signedTimestamp = new Date().toISOString();

            const logToSave: FlightLog = {
                id: newLogId,
                flightNumber: `SEAPLANE-${formData.operator.toUpperCase()}`,
                aircraftReg: `PUMP-${chosenPump}`,
                aircraftType: 'DHC-6',
                stand: 'WATER DOCK',
                operatorId: user?.id || 'System Admin',
                vehicleId: chosenPump,
                status: 'COMPLETED',
                logType: 'SEAPLANE',
                isDomestic: true,
                intDom: 'DOM',
                airline: formData.operator.toUpperCase(),
                operatorName: formData.operator.toUpperCase(),
                co: formData.operator.toUpperCase(),
                officer: formData.officer || user?.name || 'Refuelling Officer',
                tacticalOperator: formData.officer || user?.name || 'Refuelling Officer',
                deliveryNumber: finalDeliveryNumber || undefined,
                operationalDate: formData.date,
                timestampStart: `${formData.date}T08:00:00.000Z`,
                timestampFinalEnd: `${formData.date}T16:00:00.000Z`,
                timestampClearance: signedTimestamp,
                meterOpen: 0,
                meterClose: parsedVolume,
                volume: parsedVolume,
                panelCheck: true,
                walkAroundCheck: true,
                appearanceCheck: true,
                waterCheck: true,
                remarks: `Seaplane Volume logged for ${formData.operator}`,
                signatureDataUrl: formData.signatureDataUrl || undefined,
                signerName: (formData.signerName || '').toUpperCase() || undefined,
                signerDesignation: formData.signerDesignation || undefined,
                signerEmail: formData.signerEmail || undefined,
                signedAt: formData.signatureDataUrl ? signedTimestamp : undefined,
                declarationConfirmed: !!formData.signatureDataUrl,
                invoiceHtml: undefined,
            };

            // Cache signature metadata for invoice retrieval BEFORE generating HTML
            if (formData.signatureDataUrl) {
                try {
                    const sigPayload = {
                        signatureDataUrl: formData.signatureDataUrl,
                        signerName: (formData.signerName || '').toUpperCase(),
                        signerDesignation: formData.signerDesignation,
                        signerEmail: formData.signerEmail || undefined,
                        signedAt: signedTimestamp
                    };
                    if (finalDeliveryNumber) {
                        localStorage.setItem(`fms_sig_${finalDeliveryNumber}`, JSON.stringify(sigPayload));
                    }
                    localStorage.setItem(`fms_sig_${newLogId}`, JSON.stringify(sigPayload));
                    if (logToSave.flightNumber) {
                        localStorage.setItem(`fms_sig_${logToSave.flightNumber}`, JSON.stringify(sigPayload));
                    }
                } catch (e) {}
            }

            try {
                logToSave.invoiceHtml = generateInvoiceHtml(logToSave, user);
            } catch (invErr) {
                console.warn('[Seaplane] Invoice HTML generation error:', invErr);
            }

            const savedLog = await supabaseService.createFlightLog(logToSave);
            const finalizedLog: FlightLog = { ...logToSave, ...(savedLog || {}) };
            if (addFlightLogEntry) {
                addFlightLogEntry(finalizedLog);
            }

            // Deduct pumped volume from active seaplane fuel tank
            const targetSpfTank = (tanks || []).find(t => t.id === 'spf-e1') || (tanks || []).find(t => t.id.startsWith('spf'));
            if (targetSpfTank && parsedVolume > 0) {
                const newLevel = Math.max(0, targetSpfTank.currentLevel - parsedVolume);
                await updateTankLevel(targetSpfTank.id, newLevel);
            }

            setCompletedInvoiceLog(finalizedLog);
            setLoading(false);
            setSuccess(true);
            notify('Seaplane volume log synchronized!', 'success');
        } catch (error) {
            console.error('Error logging seaplane volume:', error);
            setLoading(false);
            const errMsg = error instanceof Error ? error.message : String(error);
            notify(`Failed to log daily volume: ${errMsg}`, 'error');
        }
    };

    const resetFormAndStartNew = () => {
        setSuccess(false);
        setCompletedInvoiceLog(null);
        setDuplicateError(null);
        setFormData({
            operator: '',
            pumpId: 'SCADA',
            date: new Date().toISOString().split('T')[0],
            deliveryNumber: '',
            volume: '',
            officer: '',
            signerName: '',
            signerDesignation: '',
            signerEmail: '',
            signatureDataUrl: null
        });
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-6 sm:p-12 text-center animate-in fade-in zoom-in duration-500 bg-surface">
                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-primary/10 rounded-[40px] flex items-center justify-center mb-6 sm:mb-8 border border-primary/20 shadow-premium">
                    <CheckCircle className="w-12 h-12 text-primary shadow-glow" />
                </div>
                <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-3 tracking-tighter uppercase italic">LOG SYNCHRONIZED</h2>
                <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60 mb-6">
                    Daily hydrant volume recorded for {completedInvoiceLog?.operatorName || formData.operator} and distributed to global inventory. Task integrity verified.
                </p>

                {completedInvoiceLog && (
                    <div className="w-full max-w-md bg-surface-dim/50 border border-outline rounded-3xl p-5 mb-8 space-y-4 text-left shadow-sm">
                        <div className="flex items-center justify-between border-b border-outline/40 pb-3">
                            <div>
                                <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">Delivery Ticket</span>
                                <span className="text-base font-mono font-black text-error">{completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">Volume Logged</span>
                                <span className="text-base font-mono font-black text-primary">{(completedInvoiceLog.volume || 0).toLocaleString()} L</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">
                                Representative Email (for Instant Invoice Dispatch)
                            </label>
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface border border-outline">
                                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                                <input
                                    type="email"
                                    value={invoiceModalEmail}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setInvoiceModalEmail(val);
                                        setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: val } : prev));
                                    }}
                                    placeholder="Enter representative email address..."
                                    className="w-full bg-transparent text-xs font-bold text-on-surface outline-none placeholder:text-on-surface-dim/40"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => openPrintInvoice(completedInvoiceLog, user)}
                                className="py-3 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Printer className="w-3.5 h-3.5 shrink-0" />
                                <span>Print / PDF</span>
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const targetEmail = (invoiceModalEmail || completedInvoiceLog.signerEmail || '').trim();
                                    if (!targetEmail) {
                                        notify('Saving PDF invoice & opening email app. You can also enter the representative email above.', 'info');
                                    } else {
                                        notify(`Saving PDF invoice & opening email to ${targetEmail}...`, 'success');
                                    }
                                    await sendInvoiceEmail(completedInvoiceLog, targetEmail, user, prebuiltInvoicePdf);
                                }}
                                className="py-3 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Mail className="w-3.5 h-3.5 shrink-0" />
                                <span>Email PDF</span>
                            </button>
                            <button
                                type="button"
                                disabled={isSharingPdf}
                                onClick={async () => {
                                    setIsSharingPdf(true);
                                    try {
                                        const res = await shareInvoice(completedInvoiceLog, user, prebuiltInvoicePdf);
                                        if (res === 'downloaded') {
                                            notify('Invoice PDF downloaded to your device.', 'success');
                                        }
                                    } catch {
                                        notify('Could not share PDF invoice.', 'error');
                                    } finally {
                                        setIsSharingPdf(false);
                                    }
                                }}
                                className="py-3 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Share2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{isSharingPdf ? 'Sharing...' : 'Share PDF'}</span>
                            </button>
                        </div>
                    </div>
                )}

                <button 
                    onClick={resetFormAndStartNew}
                    className="px-10 py-4 kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-premium hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                    NEW LOG ENTRY
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-8 border-b border-outline pb-6 lg:pb-10">
                <div className="flex items-center">
                    <div className="p-4 lg:p-5 bg-primary/10 rounded-2xl lg:rounded-3xl mr-4 lg:mr-6 border border-primary/20 shadow-sm transition-all group-hover:shadow-glow">
                        <Sailboat className="w-8 h-8 lg:w-10 lg:h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
                            SEAPLANE <span className="text-primary italic font-medium ml-2 lg:ml-3">OPERATIONS</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                            <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono whitespace-nowrap">Registry: WATERBORNE OPS</span>
                            <div className="hidden lg:block h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                            <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em] whitespace-nowrap">Hydrant Volume Management</span>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleOpenReviewModal} className="space-y-6 lg:space-y-8">
                {/* Standalone Delivery Ticket & Resource Protocol Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Standalone Delivery Ticket Card designed like IntoPlane */}
                    <div className="card-premium p-6 lg:p-8 border-outline overflow-hidden lg:col-span-2 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">
                                    Delivery Ticket Number
                                </label>
                                {isAutoJetA1 && (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                        isPaperMode ? 'bg-success/10 text-success border border-success/20' : 'bg-primary/10 text-primary border border-primary/20'
                                    }`}>
                                        {isPaperMode ? 'AUTO: PAPER TICKET' : 'AUTO-GENERATED: JET A-1'}
                                    </span>
                                )}
                            </div>

                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-on-surface-dim hover:text-on-surface transition-colors select-none">
                                <input 
                                    type="checkbox"
                                    checked={isPaperMode}
                                    onChange={e => setIsPaperMode(e.target.checked)}
                                    className="rounded border-outline text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                />
                                <span>Paper / Offline Ticket</span>
                            </label>
                        </div>

                        {isAutoJetA1 && !isPaperMode ? (
                            <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                                <div className="text-4xl sm:text-5xl font-mono font-black text-error">
                                    {formData.deliveryNumber || previewNextTicketNumber('JET_A1')}
                                </div>
                                <span className="text-[9px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline shrink-0">
                                    System Assigned
                                </span>
                            </div>
                        ) : isPaperMode && isAutoPaper ? (
                            <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                                <div className="text-4xl sm:text-5xl font-mono font-black text-success">
                                    {formData.deliveryNumber || previewNextTicketNumber('PAPER_OFFLINE')}
                                </div>
                                <span className="text-[9px] font-black text-success/80 uppercase tracking-widest bg-success/10 px-3 py-1.5 rounded-xl border border-success/20 shrink-0">
                                    Auto Paper Series
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 max-w-full overflow-hidden">
                                <span className="text-2xl sm:text-3xl font-mono font-black text-on-surface-dim opacity-30 shrink-0">
                                    {isPaperMode ? 'MLE-P-' : 'MLE-'}
                                </span>
                                <input 
                                    type="text" 
                                    maxLength={isPaperMode ? 8 : 6}
                                    required={!isAutoJetA1}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className={`flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 transition-all text-error placeholder:text-error/20 ${
                                        duplicateError ? 'border-error' : 'border-outline focus:border-primary'
                                    }`}
                                    placeholder="000000"
                                    value={formData.deliveryNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setFormData(prev => ({ ...prev, deliveryNumber: val }));
                                        if (duplicateError) setDuplicateError(null);
                                    }}
                                />
                            </div>
                        )}

                        {duplicateError && (
                            <div className="mt-4 flex items-start gap-3 p-3 bg-error/10 border border-error/30 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-error mt-0.5 shrink-0" />
                                <p className="text-[10px] font-black text-error uppercase tracking-widest leading-relaxed">{duplicateError}</p>
                            </div>
                        )}
                    </div>

                    {/* Resource Protocol Card */}
                    <div className="card-premium p-6 lg:p-8 border-outline flex flex-col justify-between">
                        <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Resource Protocol</label>
                        <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center shadow-inner mt-auto">
                            <Droplet className="w-4.5 h-4.5 mr-3 text-primary animate-pulse shrink-0" />
                            JET A-1
                        </div>
                    </div>
                </div>

                <div className="card-premium p-6 lg:p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 mb-6 lg:mb-10">
                         {/* Operational Date Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Operational Date</label>
                            <div className="relative">
                                <input 
                                    required 
                                    type="date" 
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    onClick={(e) => {
                                        try {
                                            if ('showPicker' in HTMLInputElement.prototype) {
                                                (e.target as HTMLInputElement).showPicker();
                                            }
                                        } catch (err) {
                                            // Fallback for older browsers
                                        }
                                    }}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" 
                                />
                                <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                            </div>
                         </div>

                         {/* Operator Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Customer / Account</label>
                            <select 
                                name="operator"
                                value={formData.operator}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="">SELECT OPERATOR...</option>
                                <option value="TRANS MALDIVIAN AIRWAYS">TRANS MALDIVIAN AIRWAYS</option>
                                <option value="(SEAPLANE) ISLAND AVIATION SERVICES">ISLAND AVIATION SERVICES</option>
                                <option value="(SEAPLANE) MANTA AIR">MANTA AIR</option>
                                <option value="VILLA AIR SEAPLANES">VILLA AIR SEAPLANES</option>
                            </select>
                         </div>

                         {/* Hydrant/Pump ID */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Infrastructure Registry (Pump ID)</label>
                            <input 
                                required 
                                type="text" 
                                name="pumpId"
                                value={formData.pumpId}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            />
                         </div>

                          {/* Verifying Officer Name Field */}
                          <div>
                             <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Verifying Officer Name</label>
                             <select 
                                 required 
                                 name="officer"
                                 value={formData.officer}
                                 onChange={handleInputChange}
                                 className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                             >
                                 <option value="">SELECT OFFICER...</option>
                                 {(activeOfficers.length > 0 ? activeOfficers : staff || []).map(off => (
                                     <option key={off.id} value={off.name}>{off.name}</option>
                                 ))}
                             </select>
                          </div>
                    </div>
                </div>

                {/* Volume Input - Prominent */}
                <div className="mb-6 lg:mb-10 p-6 lg:p-10 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Sailboat className="w-16 lg:w-32 h-16 lg:h-32 text-on-surface" />
                    </div>
                    <label className="block text-[10px] font-bold text-on-surface uppercase mb-6 tracking-[0.3em] font-mono opacity-60 text-center">TOTAL DAILY FLOW COLLECTION (LITERS)</label>
                    <div className="relative w-full">
                        <input 
                            required 
                            type="text" 
                            name="volume"
                            inputMode="numeric"
                            className="w-full text-4xl lg:text-6xl font-[900] p-6 lg:p-10 bg-surface-lowest border border-outline rounded-[32px] lg:rounded-[40px] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-primary tracking-tighter text-center transition-all font-mono shadow-premium"
                            placeholder="0" 
                            value={formData.volume && formData.volume !== '0' ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
                            onChange={(e) => {
                                const val = e.target.value.replace(/,/g, '');
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setFormData(prev => ({ ...prev, volume: val }));
                                }
                            }}
                        />
                        <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30 tracking-[0.2em]">LTRS</span>
                    </div>
                    <div className="mt-8 flex items-center justify-center text-warning text-[10px] font-black uppercase tracking-widest space-x-3">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                        <span>Confirm meter integrity before sync submission</span>
                    </div>
                </div>

                {/* Customer / Seaplane Operator Signature & Declaration */}
                <SignatureAcknowledgment
                  signerName={formData.signerName}
                  onSignerNameChange={(val) => setFormData(prev => ({ ...prev, signerName: val.toUpperCase() }))}
                  signerDesignation={formData.signerDesignation}
                  onSignerDesignationChange={(val) => setFormData(prev => ({ ...prev, signerDesignation: val }))}
                  signerEmail={formData.signerEmail}
                  onSignerEmailChange={(val) => setFormData(prev => ({ ...prev, signerEmail: val }))}
                  signatureDataUrl={formData.signatureDataUrl}
                  onSignatureChange={(val) => setFormData(prev => ({ ...prev, signatureDataUrl: val }))}
                  designationPresets={[
                    'Pilot in Command (PIC)',
                    'First Officer',
                    'Base Maintenance Engineer',
                    'TMA Operations Coordinator',
                    'Manta Air Rep'
                  ]}
                  declarationText="I hereby acknowledge and certify receipt of the recorded seaplane hydrant flow volume. Totalizer readings and quality parameters have been verified and accepted."
                  title="Customer / Seaplane Operator Acknowledgment"
                  subtitle="Seaplane Hydrant Fuel Distribution Certification"
                />

                <div className="flex flex-col items-end gap-2">
                    <button 
                        type="submit" 
                        disabled={loading || (!isAutoJetA1 && (!formData.deliveryNumber || formData.deliveryNumber.length < 4)) || !formData.signatureDataUrl || !formData.signerName?.trim()}
                        className="w-full md:w-auto px-12 py-5 kinetic-gradient text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.4em] shadow-premium hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-20 disabled:scale-100 disabled:grayscale cursor-pointer"
                    >
                        {loading ? 'SYNCHRONIZING...' : (
                            <>
                                <Eye className="w-5 h-5 mr-4" />
                                REVIEW & SYNCHRONIZE
                            </>
                        )}
                    </button>
                    {(!formData.signatureDataUrl || !formData.signerName?.trim()) && (
                      <div className="flex items-center justify-center gap-2 text-amber-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-center py-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Customer / Representative signature and full name are required to submit</span>
                      </div>
                    )}
                </div>
            </form>

            {/* Review Seaplane Operations Log Modal */}
            {showConfirmModal && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-surface rounded-3xl border border-outline shadow-premium w-full max-w-2xl p-6 sm:p-8 animate-in fade-in zoom-in duration-300 my-auto max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between pb-4 border-b border-outline/30 shrink-0">
                    <div>
                      <span className="block text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Confirm Authorization</span>
                      <h3 className="text-xl sm:text-2xl font-[900] tracking-tighter text-on-surface">REVIEW SEAPLANE OPERATIONS LOG</h3>
                    </div>
                    <button onClick={() => setShowConfirmModal(false)} className="p-2 rounded-xl hover:bg-surface-dim transition-colors cursor-pointer">
                      <X className="w-5 h-5 text-on-surface-dim" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin">
                    {/* Customer & Infrastructure Block */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-dim/40 p-5 rounded-2xl border border-outline/20">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Customer / Account</span>
                        <span className="text-[12px] font-black text-primary uppercase">{formData.operator || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Pump ID</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">{formData.pumpId || 'SCADA'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Resource</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">JET A-1</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Operational Date</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">{formData.date}</span>
                      </div>
                    </div>

                    {/* Volume & Ticket Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="card-premium p-4 border-outline/30">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Delivery Ticket</span>
                        <span className="text-lg font-mono font-black text-error">
                          {getPreviewTicket()}
                        </span>
                      </div>
                      <div className="card-premium p-4 border-outline/30">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Total Flow Volume</span>
                        <span className="text-lg font-mono font-black text-primary">
                          {(parseFloat(formData.volume.toString().replace(/,/g, '')) || 0).toLocaleString()} L
                        </span>
                      </div>
                      <div className="card-premium p-4 border-outline/30">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Verifying Officer</span>
                        <span className="text-sm font-black text-on-surface uppercase">
                          {formData.officer || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* QC Compliance */}
                    <div className="p-5 bg-success/5 border border-success/20 rounded-2xl space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-success">Hydrant Quality & Meter Integrity</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-black uppercase text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Totalizer Integrity Verified</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Clear & Bright / Water Free</span>
                        </div>
                      </div>
                    </div>

                    {/* Declaration of Acknowledgment & Signature */}
                    <SignatureAcknowledgment
                      signerName={formData.signerName}
                      onSignerNameChange={(val) => setFormData(prev => ({ ...prev, signerName: val.toUpperCase() }))}
                      signerDesignation={formData.signerDesignation}
                      onSignerDesignationChange={(val) => setFormData(prev => ({ ...prev, signerDesignation: val }))}
                      signerEmail={formData.signerEmail}
                      onSignerEmailChange={(val) => setFormData(prev => ({ ...prev, signerEmail: val }))}
                      signatureDataUrl={formData.signatureDataUrl}
                      onSignatureChange={(val) => setFormData(prev => ({ ...prev, signatureDataUrl: val }))}
                      designationPresets={[
                        'Pilot in Command (PIC)',
                        'First Officer',
                        'Base Maintenance Engineer',
                        'TMA Operations Coordinator',
                        'Manta Air Rep'
                      ]}
                      declarationText="I hereby acknowledge and certify receipt of the recorded seaplane hydrant flow volume. Totalizer readings and quality parameters have been verified and accepted."
                      title="Customer / Seaplane Operator Acknowledgment"
                      subtitle="Seaplane Hydrant Fuel Distribution Certification"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4 border-t border-outline/30 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-4 bg-surface-dim border border-outline text-on-surface rounded-2xl font-[900] text-[11px] uppercase tracking-[0.2em] hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5 shrink-0" />
                      <span>Go Back & Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAuthorizeAndSubmit}
                      disabled={loading || !formData.signatureDataUrl || !formData.signerName?.trim()}
                      className="flex-1 py-4 kinetic-gradient text-white rounded-2xl font-[900] text-[11px] uppercase tracking-[0.2em] shadow-premium hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale cursor-pointer"
                    >
                      {loading ? (
                        <span className="font-[900]">SYNCHRONIZING...</span>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 shrink-0" />
                          <span>Authorize & Submit</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Post-Completion Invoice Modal with Print, Email & Share */}
            {completedInvoiceLog && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
                onClick={() => setCompletedInvoiceLog(null)}
              >
                <div
                  className="bg-surface border border-outline rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="p-6 border-b border-outline/30 flex items-center justify-between bg-surface-container-low">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-success/15 text-success flex items-center justify-center shrink-0">
                        <CheckCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-success">
                          Seaplane Log Finalized & Synced
                        </span>
                        <h3 className="text-xl font-[900] tracking-tight text-on-surface">
                          DELIVERY INVOICE READY
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setCompletedInvoiceLog(null)}
                      className="w-9 h-9 rounded-xl bg-surface-dim hover:bg-surface-container text-on-surface-dim hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-dim border border-outline/30">
                      <div>
                        <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">
                          Official Delivery Ticket
                        </span>
                        <span className="text-lg font-black text-rose-500 tracking-wider">
                          {completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">
                          Total Fuel Uplift
                        </span>
                        <span className="text-lg font-black text-primary">
                          {completedInvoiceLog.volume ? completedInvoiceLog.volume.toLocaleString() : '0'} L
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                        <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Customer / Operator</span>
                        <span className="font-black text-on-surface text-sm">{completedInvoiceLog.operatorName || completedInvoiceLog.airline}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                        <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Pump ID</span>
                        <span className="font-black text-on-surface text-sm">{completedInvoiceLog.vehicleId}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                        <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Verifying Officer</span>
                        <span className="font-bold text-on-surface">{completedInvoiceLog.officer || 'N/A'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                        <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Signer / Representative</span>
                        <span className="font-bold text-on-surface truncate block">{completedInvoiceLog.signerName || 'Operator Rep'}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/30 space-y-2">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">
                        Representative / Operator Email (for Instant Invoice Dispatch)
                      </label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                        <input
                          ref={invoiceEmailInputRef}
                          type="email"
                          value={invoiceModalEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInvoiceModalEmail(val);
                            setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: val } : prev));
                          }}
                          placeholder="Enter representative email address..."
                          className="w-full bg-transparent text-xs font-bold text-on-surface outline-none placeholder:text-on-surface-dim/40"
                        />
                      </div>
                      {completedAccountResolution.emails.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline/20">
                          <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-60 self-center mr-1">
                            Account Emails:
                          </span>
                          {completedAccountResolution.emails.map((emailAddr) => (
                            <button
                              key={emailAddr}
                              type="button"
                              onClick={() => {
                                setInvoiceModalEmail(emailAddr);
                                setCompletedInvoiceLog(prev => (prev ? { ...prev, signerEmail: emailAddr } : prev));
                              }}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border transition-all cursor-pointer ${
                                invoiceModalEmail === emailAddr
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-surface-dim text-on-surface-dim border-outline hover:border-primary/40 hover:text-on-surface'
                              }`}
                            >
                              {emailAddr}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-6 pt-2 space-y-2 border-t border-outline/20">
                    <button
                      type="button"
                      onClick={() => openPrintInvoice(completedInvoiceLog, user)}
                      className="w-full py-4 kinetic-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-premium hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="sm:hidden">Print / Save PDF</span>
                      <span className="hidden sm:inline">Print / Save PDF Invoice (FORM NO: G-001)</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const targetEmail = (invoiceModalEmail || completedInvoiceLog.signerEmail || '').trim();
                          if (!targetEmail) {
                            notify('Saving PDF invoice & opening email app. You can also enter the representative email above.', 'info');
                            invoiceEmailInputRef.current?.focus();
                          } else {
                            notify(`Saving PDF invoice & opening email to ${targetEmail}...`, 'success');
                          }
                          await sendInvoiceEmail(completedInvoiceLog, targetEmail, user, prebuiltInvoicePdf);
                        }}
                        className="flex-1 py-3 px-4 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl font-black text-[11px] uppercase tracking-wider text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-primary shrink-0" />
                        <span>Email to Rep</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSharingPdf}
                        onClick={async () => {
                          setIsSharingPdf(true);
                          try {
                            const res = await shareInvoice(completedInvoiceLog, user, prebuiltInvoicePdf);
                            if (res === 'downloaded') {
                              notify('Invoice PDF downloaded to your device.', 'success');
                            }
                          } catch {
                            notify('Could not share PDF invoice.', 'error');
                          } finally {
                            setIsSharingPdf(false);
                          }
                        }}
                        className="flex-1 py-3 px-4 bg-surface-dim hover:bg-surface-container border border-outline rounded-xl font-black text-[11px] uppercase tracking-wider text-on-surface transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Share2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{isSharingPdf ? 'Sharing...' : 'Share PDF'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCompletedInvoiceLog(null)}
                      className="w-full py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-on-surface-dim hover:text-on-surface transition-colors cursor-pointer mt-1"
                    >
                      Close Invoice Preview
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
    );
};

