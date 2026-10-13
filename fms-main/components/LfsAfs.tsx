import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Fuel, MapPin, Droplet, Save, CheckCircle, AlertTriangle, Calendar, FileText, User as UserIcon, CreditCard, Truck, ClipboardList, Printer, Mail, Share2, X, ChevronLeft, CheckCheck, Eye } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { useOperationalData } from '../context/OperationalDataContext';
import { useNotification } from '../context/NotificationContext';
import { useFinanceData } from '../context/FinanceDataContext';
import { User, UserRole, FlightLog } from '../types';
import { SignatureAcknowledgment } from './SignatureAcknowledgment';
import { generateInvoiceHtml, generateInvoicePdfFile, openPrintInvoice, sendInvoiceEmail, shareInvoice } from '../services/invoicePdfService';

interface LfsAfsProps {
    user?: User | null;
}

export const LfsAfs: React.FC<LfsAfsProps> = ({ user }) => {
    const { flightLogs, staff, tanks, updateTankLevel, addFlightLogEntry, isTicketAutoEnabled, previewNextTicketNumber, generateTicketNumber } = useOperationalData();
    const { resolveCustomerByFlightOrAirline } = useFinanceData();
    const { notify } = useNotification();
    const isAutoMgo = isTicketAutoEnabled('MGO');
    const isAutoPaper = isTicketAutoEnabled('PAPER_OFFLINE');
    const [isPaperMode, setIsPaperMode] = useState(false);

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [completedInvoiceLog, setCompletedInvoiceLog] = useState<FlightLog | null>(null);
    const [invoiceModalEmail, setInvoiceModalEmail] = useState<string>('');
    const [prebuiltInvoicePdf, setPrebuiltInvoicePdf] = useState<File | null>(null);
    const [isSharingPdf, setIsSharingPdf] = useState<boolean>(false);

    // Filter Verifying Officers to DEPOT staffs (Managers and Operators)
    const activeOfficers = useMemo(() => {
        const depotFiltered = (staff || []).filter(s =>
            s.status === 'active' &&
            [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(s.role)
        );
        if (depotFiltered.length > 0) return depotFiltered;
        return (staff || []).filter(s =>
            [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(s.role)
        );
    }, [staff]);

    const [formData, setFormData] = useState({
        station: 'LFS', // LFS or AFS
        fuelType: 'Diesel', // Diesel, Petrol, Lube Oil, Internal
        date: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        vehicleReg: '',
        driverName: '', // Holds "On account of" value
        volume: '',
        paymentMode: 'Credit', // Credit or Cash
        receivedBy: '',
        equipmentName: '',
        officer: '',
        signerName: '',
        signerDesignation: '',
        signerEmail: '',
        signatureDataUrl: null as string | null
    });

    // Auto-populate customer email from Finance customer directory when "On account of" changes
    useEffect(() => {
        if (!formData.driverName) return;
        const resolved = resolveCustomerByFlightOrAirline('', formData.driverName);
        if (resolved?.emails && resolved.emails.length > 0) {
            setFormData(prev => (prev.signerEmail ? prev : { ...prev, signerEmail: resolved.emails[0] }));
        }
    }, [formData.driverName, resolveCustomerByFlightOrAirline]);

    // Prebuild PDF in the background when invoice log is ready so Web Share & Email work with a single click
    useEffect(() => {
        if (!completedInvoiceLog) {
            setPrebuiltInvoicePdf(null);
            return;
        }
        setInvoiceModalEmail(completedInvoiceLog.signerEmail || '');
        let cancelled = false;
        generateInvoicePdfFile(completedInvoiceLog, user || undefined)
            .then(file => {
                if (!cancelled) setPrebuiltInvoicePdf(file);
            })
            .catch(err => {
                console.warn('[LfsAfs] Background PDF prebuild failed:', err);
            });
        return () => {
            cancelled = true;
        };
    }, [completedInvoiceLog, user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const getPreviewTicket = () => {
        if (formData.invoiceNumber) {
            if (formData.invoiceNumber.startsWith('MLE-')) return formData.invoiceNumber;
            return isPaperMode ? `MLE-P-${formData.invoiceNumber}` : `MLE-${formData.invoiceNumber}`;
        }
        if (isPaperMode && isAutoPaper) return previewNextTicketNumber('PAPER_OFFLINE');
        if (isAutoMgo && !isPaperMode) return previewNextTicketNumber('MGO');
        return 'AUTO-ASSIGNED';
    };

    const handleOpenReviewModal = (e: React.FormEvent) => {
        e.preventDefault();
        setDuplicateError(null);

        const candidateTicket = formData.invoiceNumber
            ? (isPaperMode && !formData.invoiceNumber.includes('-P-')
                ? `MLE-P-${formData.invoiceNumber.replace(/^MLE-P-/i, '')}`
                : (formData.invoiceNumber.startsWith('MLE-') ? formData.invoiceNumber : `MLE-${formData.invoiceNumber}`))
            : '';

        if (candidateTicket) {
            const isDuplicate = (flightLogs || []).some(
                (log) => log && (log.deliveryNumber === candidateTicket || log.deliveryNumber === candidateTicket.replace('MLE-', ''))
            );
            if (isDuplicate) {
                setDuplicateError(
                    `Invoice ticket ${candidateTicket} already exists in the operations log. Each ticket number must be unique.`
                );
                return;
            }
        }

        const effectiveSignerName = (formData.signerName || formData.receivedBy || formData.driverName || '').trim();
        if (!formData.signatureDataUrl || !effectiveSignerName) {
            notify('Recipient / Driver signature and name are required to confirm transaction.', 'warning');
            return;
        }

        const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
        if (parsedVolume <= 0) {
            notify('Please enter a valid fuel provision volume greater than 0.', 'warning');
            return;
        }

        setShowConfirmModal(true);
    };

    const handleConfirmSubmit = async () => {
        setDuplicateError(null);
        setShowConfirmModal(false);

        let fullDeliveryNumber = formData.invoiceNumber 
            ? (formData.invoiceNumber.startsWith('MLE-') ? formData.invoiceNumber : `MLE-${formData.invoiceNumber}`) 
            : '';

        if (isAutoMgo && !fullDeliveryNumber) {
            const cat = isPaperMode ? 'PAPER_OFFLINE' : 'MGO';
            const genRes = await generateTicketNumber(cat, formData.officer || user?.name || user?.id || 'System Admin');
            if (genRes.success && genRes.ticketNumber) {
                fullDeliveryNumber = genRes.ticketNumber;
            }
        } else if (isPaperMode && !fullDeliveryNumber.includes('-P-')) {
            fullDeliveryNumber = `MLE-P-${formData.invoiceNumber.replace(/^MLE-P-/i, '')}`;
        }

        // ── Duplicate delivery number check ──
        if (fullDeliveryNumber) {
            const isDuplicate = (flightLogs || []).some(
                (log) => log && (log.deliveryNumber === fullDeliveryNumber || log.deliveryNumber === fullDeliveryNumber.replace('MLE-', ''))
            );
            if (isDuplicate) {
                setDuplicateError(
                    `Invoice ticket ${fullDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`
                );
                return;
            }
        }

        const effectiveSignerName = (formData.signerName || formData.receivedBy || formData.driverName || '').trim().toUpperCase();
        if (!formData.signatureDataUrl || !effectiveSignerName) {
            notify('Recipient / Driver signature and name are required to confirm transaction.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const parsedVolume = parseFloat(formData.volume.replace(/,/g, '')) || 0;
            const signedTimestamp = new Date().toISOString();
            const newLogId = `fs-${Date.now()}`;
            
            // ── Deduct fuel from the corresponding AFS / LFS tank if a matching tank exists ──
            const targetTankId = `${formData.station.toLowerCase()}-${formData.fuelType.toLowerCase()}`;
            const matchingTank = (tanks || []).find(t => t && t.id === targetTankId);
            
            if (matchingTank) {
                const newLevel = Math.max(0, matchingTank.currentLevel - parsedVolume);
                await updateTankLevel(matchingTank.id, newLevel);
            }

            const logToSave = {
                station: formData.station,
                fuelType: formData.fuelType,
                date: formData.date,
                invoiceNumber: fullDeliveryNumber ? fullDeliveryNumber.replace(/^MLE-/, '') : formData.invoiceNumber,
                deliveryNumber: fullDeliveryNumber,
                vehicleReg: formData.vehicleReg.toUpperCase(),
                driverName: formData.driverName,
                volume: parsedVolume,
                paymentMode: formData.paymentMode,
                receivedBy: formData.receivedBy,
                equipmentName: formData.equipmentName,
                officer: formData.officer || user?.name || 'System Admin',
                operatorId: formData.officer || user?.name || user?.id || 'System Admin',
                remarks: `Ground support refuel: ${formData.vehicleReg} loaded with ${parsedVolume}L ${formData.fuelType} (On account of: ${formData.driverName}, Payment: ${formData.paymentMode}, Received by: ${formData.receivedBy}, Equipment: ${formData.equipmentName})`,
                signatureDataUrl: formData.signatureDataUrl || undefined,
                signerName: effectiveSignerName || undefined,
                signerDesignation: formData.signerDesignation || undefined,
                signerEmail: formData.signerEmail || undefined,
                signedAt: formData.signatureDataUrl ? signedTimestamp : undefined,
                declarationConfirmed: !!formData.signatureDataUrl,
            };

            const flightLogEntry: FlightLog & { product?: string } = {
                id: newLogId,
                flightNumber: `GROUND-${formData.station}-${formData.fuelType.toUpperCase()}`,
                aircraftReg: formData.vehicleReg.toUpperCase(),
                aircraftType: (formData.equipmentName || 'GROUND VEHICLE').toUpperCase(),
                stand: formData.station === 'LFS' ? 'LANDSIDE STATION (LFS)' : 'AIRSIDE STATION (AFS)',
                airline: formData.driverName.toUpperCase(),
                operatorName: (formData.receivedBy || formData.driverName).toUpperCase(),
                co: formData.driverName.toUpperCase(),
                officer: formData.officer || user?.name || 'Depot Officer',
                tacticalOperator: formData.officer || user?.name || 'Depot Operator',
                operatorId: formData.officer || user?.name || user?.id || 'System Admin',
                vehicleId: `${formData.station}-${formData.fuelType.toUpperCase()}`,
                status: 'COMPLETED',
                logType: 'FILLING_STATION',
                product: formData.fuelType.toUpperCase(),
                isDomestic: true,
                intDom: 'INTERNAL',
                paymentType: formData.paymentMode.toUpperCase() as 'CREDIT' | 'CASH',
                deliveryNumber: fullDeliveryNumber || undefined,
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
                remarks: logToSave.remarks,
                signatureDataUrl: formData.signatureDataUrl || undefined,
                signerName: effectiveSignerName || undefined,
                signerDesignation: formData.signerDesignation || undefined,
                signerEmail: formData.signerEmail || undefined,
                signedAt: signedTimestamp,
                declarationConfirmed: true,
            };

            if (formData.signatureDataUrl) {
                try {
                    const sigPayload = {
                        signatureDataUrl: formData.signatureDataUrl,
                        signerName: effectiveSignerName,
                        signerDesignation: formData.signerDesignation,
                        signerEmail: formData.signerEmail || undefined,
                        signedAt: signedTimestamp
                    };
                    if (fullDeliveryNumber) {
                        localStorage.setItem(`fms_sig_${fullDeliveryNumber}`, JSON.stringify(sigPayload));
                    }
                    localStorage.setItem(`fms_sig_${newLogId}`, JSON.stringify(sigPayload));
                } catch (e) {}
            }

            try {
                flightLogEntry.invoiceHtml = generateInvoiceHtml(flightLogEntry, user || undefined);
            } catch (invErr) {
                console.warn('[LfsAfs] Invoice HTML generation error:', invErr);
            }

            await supabaseService.createFillingStationLog(logToSave);
            if (addFlightLogEntry) {
                addFlightLogEntry(flightLogEntry);
            }

            setCompletedInvoiceLog(flightLogEntry);
            setLoading(false);
            setSuccess(true);
            notify('Ground refueling invoice synchronized!', 'success');
        } catch (error) {
            console.error('Error logging ground refueling volume:', error);
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
            station: 'LFS',
            fuelType: 'Diesel',
            date: new Date().toISOString().split('T')[0],
            invoiceNumber: '',
            vehicleReg: '',
            driverName: '',
            volume: '',
            paymentMode: 'Credit',
            receivedBy: '',
            equipmentName: '',
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
                <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-3 tracking-tighter uppercase italic">INVOICE SYNCHRONIZED</h2>
                <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60 mb-6">
                    Ground vehicle refueling invoice recorded for {completedInvoiceLog?.airline || formData.driverName}. Station tank volumes and logistics databases updated in real-time.
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
                                onClick={() => openPrintInvoice(completedInvoiceLog, user || undefined)}
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
                                    await sendInvoiceEmail(completedInvoiceLog, targetEmail, user || undefined, prebuiltInvoicePdf);
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
                                        const res = await shareInvoice(completedInvoiceLog, user || undefined, prebuiltInvoicePdf);
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
                    RECORD NEW INVOICE
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
            <div className="flex items-center justify-between border-b border-outline pb-6 lg:pb-10">
                <div className="flex items-center">
                    <div className="p-4 lg:p-5 bg-primary/10 rounded-2xl lg:rounded-3xl mr-4 lg:mr-6 border border-primary/20 shadow-sm transition-all">
                        <Fuel className="w-8 h-8 lg:w-10 lg:h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="headline-lg tracking-tighter mb-1 lg:mb-2 uppercase flex items-center">
                            LFS / AFS <span className="text-primary italic font-medium ml-2 lg:ml-3">INVOICES</span>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                            <span className="text-[9px] lg:text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.2em] lg:tracking-[0.3em] font-mono whitespace-nowrap">Registry: GROUND STATIONS</span>
                            <div className="hidden lg:block h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
                            <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.2em] lg:tracking-[0.3em] whitespace-nowrap">AFS & LFS Sales Protocol</span>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleOpenReviewModal} className="space-y-6 lg:space-y-8 max-w-4xl mx-auto">
                {/* Delivery Ticket / Invoice Number */}
                <div className="card-premium p-6 lg:p-8 border-outline overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-40">
                                Invoice / Ticket Number
                            </label>
                            {isAutoMgo && (
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                    isPaperMode ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'
                                }`}>
                                    {isPaperMode ? 'AUTO: PAPER TICKET' : 'AUTO-GENERATED: MGO/DIESEL/PETROL'}
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

                    {isAutoMgo && !isPaperMode ? (
                        <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                            <div className="text-4xl sm:text-5xl font-mono font-black text-warning">
                                {formData.invoiceNumber || previewNextTicketNumber('MGO')}
                            </div>
                            <span className="text-[9px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline shrink-0">
                                System Assigned
                            </span>
                        </div>
                    ) : isPaperMode && isAutoPaper ? (
                        <div className="flex items-center justify-between gap-2 max-w-full overflow-hidden py-2">
                            <div className="text-4xl sm:text-5xl font-mono font-black text-success">
                                {formData.invoiceNumber || previewNextTicketNumber('PAPER_OFFLINE')}
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
                                required={!isAutoMgo}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={`flex-1 min-w-0 text-5xl font-mono font-black py-2 bg-transparent outline-none border-b-2 transition-all text-error placeholder:text-error/20 ${
                                    duplicateError ? 'border-error' : 'border-outline focus:border-primary'
                                }`}
                                placeholder="000000"
                                value={formData.invoiceNumber}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setFormData(prev => ({ ...prev, invoiceNumber: val }));
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

                <div className="card-premium p-6 lg:p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 mb-6 lg:mb-10">
                         {/* Station Selection */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Operational Station</label>
                            <select 
                                name="station"
                                value={formData.station}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="LFS">LANDSIDE FILLING STATION (LFS)</option>
                                <option value="AFS">AIRSIDE FILLING STATION (AFS)</option>
                            </select>
                         </div>

                         {/* Fuel Type / Product */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Resource / Fuel Type</label>
                            <select 
                                name="fuelType"
                                value={formData.fuelType}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="Diesel">DIESEL</option>
                                <option value="Petrol">PETROL</option>
                            </select>
                         </div>

                         {/* Billing Mode (Credit / Cash) */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Payment Mode</label>
                            <select 
                                name="paymentMode"
                                value={formData.paymentMode}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                                required
                            >
                                <option value="Credit">CREDIT</option>
                                <option value="Cash">CASH</option>
                            </select>
                         </div>

                         {/* Date */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Operational Date</label>
                            <div className="relative">
                                <input 
                                    required 
                                    type="date" 
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    disabled={user?.role === UserRole.DEPOT_OPERATOR}
                                    onClick={(e) => {
                                        try {
                                            if (user?.role !== UserRole.DEPOT_OPERATOR && 'showPicker' in HTMLInputElement.prototype) {
                                                (e.target as HTMLInputElement).showPicker();
                                            }
                                        } catch (err) {}
                                    }}
                                    className={`w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all ${user?.role === UserRole.DEPOT_OPERATOR ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
                                />
                                <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                            </div>
                         </div>

                         {/* On account of */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">On account of</label>
                            <div className="relative">
                                <UserIcon className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="driverName"
                                    value={formData.driverName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                />
                            </div>
                         </div>

                         {/* Received by */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Received by</label>
                            <div className="relative">
                                <UserIcon className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="receivedBy"
                                    value={formData.receivedBy}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                />
                            </div>
                         </div>

                         {/* Equipment Name */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Equipment Name</label>
                            <div className="relative">
                                <ClipboardList className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="equipmentName"
                                    value={formData.equipmentName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                />
                            </div>
                         </div>

                         {/* Vehicle Registration */}
                         <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Vehicle Registration / ID</label>
                            <div className="relative">
                                <MapPin className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                <input 
                                    required 
                                    type="text" 
                                    name="vehicleReg"
                                    value={formData.vehicleReg}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                                />
                            </div>
                         </div>

                         {/* Verifying Officer Name (DEPOT Staffs: Managers and Operators) */}
                         <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Verifying Officer Name</label>
                            <select 
                                required 
                                name="officer"
                                value={formData.officer}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer" 
                            >
                                <option value="">SELECT DEPOT VERIFYING OFFICER...</option>
                                {(activeOfficers.length > 0 ? activeOfficers : staff || []).map(off => (
                                    <option key={off.id} value={off.name}>{off.name}</option>
                                ))}
                            </select>
                         </div>
                    </div>

                    {/* Tank Status Quick Insight */}
                    {['Diesel', 'Petrol'].includes(formData.fuelType) && (
                         <div className="mt-6 border-t border-outline/30 pt-6">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-4 tracking-widest opacity-40">Resource Insight</label>
                            {(() => {
                                const targetId = `${formData.station.toLowerCase()}-${formData.fuelType.toLowerCase()}`;
                                const tank = (tanks || []).find(t => t && t.id === targetId);
                                return (
                                    <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center justify-between shadow-inner">
                                        <div className="flex items-center">
                                            <Droplet className="w-4 h-4 mr-3 opacity-60 animate-pulse" />
                                            {tank ? tank.name : 'RESOURCE UNKNOWN'}
                                        </div>
                                        {tank && (
                                            <span className="font-mono text-xs opacity-75">{tank.currentLevel.toLocaleString()} L</span>
                                        )}
                                    </div>
                                );
                            })()}
                         </div>
                    )}
                </div>

                {/* Volume Input - Prominent */}
                <div className="mb-6 lg:mb-10 p-6 lg:p-10 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Fuel className="w-16 lg:w-32 h-16 lg:h-32 text-on-surface" />
                    </div>
                    <label className="block text-[10px] font-bold text-on-surface uppercase mb-6 tracking-[0.3em] font-mono opacity-60 text-center">Fuel Provision Volume (Liters)</label>
                    <div className="relative w-full">
                        <input 
                            required 
                            type="text" 
                            name="volume"
                            inputMode="numeric"
                            className="w-full text-4xl lg:text-6xl font-[900] p-6 lg:p-10 bg-surface-lowest border border-outline rounded-[32px] lg:rounded-[40px] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-primary tracking-tighter text-center transition-all font-mono shadow-premium"
                            placeholder="0" 
                            value={formData.volume ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
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
                        <span>Ensure tank safety thresholds are respected upon delivery</span>
                    </div>
                </div>

                {/* Recipient / Driver Signature & Declaration */}
                <SignatureAcknowledgment
                  signerName={formData.signerName || formData.receivedBy || formData.driverName}
                  onSignerNameChange={(val) => setFormData(prev => ({ ...prev, signerName: val.toUpperCase() }))}
                  signerDesignation={formData.signerDesignation}
                  onSignerDesignationChange={(val) => setFormData(prev => ({ ...prev, signerDesignation: val }))}
                  signerEmail={formData.signerEmail}
                  onSignerEmailChange={(val) => setFormData(prev => ({ ...prev, signerEmail: val }))}
                  signatureDataUrl={formData.signatureDataUrl}
                  onSignatureChange={(val) => setFormData(prev => ({ ...prev, signatureDataUrl: val }))}
                  designationPresets={[
                    'Vehicle Driver',
                    'GSE Equipment Operator',
                    'Transport Officer',
                    'Security Patrol Officer',
                    'Ramp Operations Supervisor'
                  ]}
                  declarationText="I hereby acknowledge and certify receipt of the specified fuel volume for ground vehicle/equipment operations. Dispensing meter readings and fuel grade have been verified and accepted."
                  title="Recipient / Driver Acknowledgment"
                  subtitle="Ground Fuel Provision & Invoice Certification"
                />

                <div className="flex flex-col items-end gap-2">
                    <button 
                        type="submit" 
                        disabled={loading || (!isAutoMgo && (!formData.invoiceNumber || formData.invoiceNumber.length < 4)) || !formData.volume || formData.volume === '0' || !formData.signatureDataUrl || !(formData.signerName || formData.receivedBy || formData.driverName)?.trim()}
                        className="w-full md:w-auto px-12 py-5 kinetic-gradient text-white rounded-2xl font-[900] text-[12px] uppercase tracking-[0.4em] shadow-premium hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-20 disabled:scale-100 disabled:grayscale cursor-pointer"
                    >
                        {loading ? 'SYNCHRONIZING...' : (
                            <>
                                <Eye className="w-5 h-5 mr-4" />
                                REVIEW & SYNCHRONIZE
                            </>
                        )}
                    </button>
                    {(!formData.signatureDataUrl || !(formData.signerName || formData.receivedBy || formData.driverName)?.trim()) && (
                      <div className="flex items-center justify-center gap-2 text-amber-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-center py-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Recipient / Driver signature and name are required to confirm</span>
                      </div>
                    )}
                </div>
            </form>

            {/* Review Filling Station Transaction Log Modal */}
            {showConfirmModal && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-surface rounded-3xl border border-outline shadow-premium w-full max-w-2xl p-6 sm:p-8 animate-in fade-in zoom-in duration-300 my-auto max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between pb-4 border-b border-outline/30 shrink-0">
                    <div>
                      <span className="block text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Confirm Authorization</span>
                      <h3 className="text-xl sm:text-2xl font-[900] tracking-tighter text-on-surface">REVIEW FILLING STATION INVOICE</h3>
                    </div>
                    <button onClick={() => setShowConfirmModal(false)} className="p-2 rounded-xl hover:bg-surface-dim transition-colors cursor-pointer">
                      <X className="w-5 h-5 text-on-surface-dim" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin">
                    {/* Station & Product Summary Block */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-dim/40 p-5 rounded-2xl border border-outline/20">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Station</span>
                        <span className="text-[12px] font-black text-primary uppercase">{formData.station}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Resource</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">{formData.fuelType}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Payment Mode</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">{formData.paymentMode}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Operational Date</span>
                        <span className="text-[12px] font-black text-on-surface uppercase">{formData.date}</span>
                      </div>
                    </div>

                    {/* Account & Vehicle Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-dim/20 p-5 rounded-2xl border border-outline/10">
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">On Account Of</span>
                        <span className="text-[11px] font-black text-on-surface uppercase">{formData.driverName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Received By</span>
                        <span className="text-[11px] font-black text-on-surface uppercase">{formData.receivedBy || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Equipment</span>
                        <span className="text-[11px] font-black text-on-surface uppercase">{formData.equipmentName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Vehicle Reg / ID</span>
                        <span className="text-[11px] font-black text-primary uppercase">{formData.vehicleReg || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Volume & Ticket Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="card-premium p-4 border-outline/30">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Invoice Ticket</span>
                        <span className="text-lg font-mono font-black text-error">
                          {getPreviewTicket()}
                        </span>
                      </div>
                      <div className="card-premium p-4 border-outline/30">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Fuel Provision Volume</span>
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

                    {/* Signature Verification Card */}
                    <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                          Recipient / Driver Acknowledgment Verified
                        </span>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40">Signed By</span>
                          <span className="font-black text-on-surface uppercase">{formData.signerName || formData.receivedBy || formData.driverName}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40">Designation</span>
                          <span className="font-bold text-on-surface">{formData.signerDesignation || 'Vehicle Driver / Representative'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40">Email for Invoice</span>
                          <span className="font-bold text-primary truncate block">{formData.signerEmail || 'Not provided'}</span>
                        </div>
                      </div>
                      {formData.signatureDataUrl && (
                        <div className="bg-white rounded-xl p-2 flex items-center justify-center h-20 border border-outline/20">
                          <img src={formData.signatureDataUrl} alt="Recipient Signature" className="max-h-16 object-contain" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="pt-4 border-t border-outline/30 flex flex-col sm:flex-row gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-4 px-6 rounded-2xl border border-outline font-black text-[10px] uppercase tracking-widest text-on-surface-dim hover:bg-surface-dim transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Edit Details
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleConfirmSubmit}
                      className="flex-1 py-4 px-8 rounded-2xl kinetic-gradient text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-premium hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" />
                      {loading ? 'SYNCHRONIZING...' : 'AUTHORIZE & SYNCHRONIZE'}
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
    );
};
