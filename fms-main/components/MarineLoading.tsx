import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Ship, Truck, CheckCircle, AlertTriangle, Save, Clock, ArrowRight, History, FileText, Anchor, Droplet, Users, Calendar, Printer, Mail, Share2, X, ChevronLeft, CheckCheck, Eye } from 'lucide-react';
import { useOperationalData } from '../context/OperationalDataContext';
import { EquipmentType, UserRole, FuelType, EquipmentStatus, User, FlightLog } from '../types';
import { useNotification } from '../context/NotificationContext';
import { useFinanceData } from '../context/FinanceDataContext';
import { supabaseService } from '../services/supabaseService';
import { checkDuplicateTicketAcrossJetA1 } from '../services/ticketValidation';
import { SignatureAcknowledgment } from './SignatureAcknowledgment';
import { generateInvoiceHtml, generateInvoicePdfFile, openPrintInvoice, sendInvoiceEmail, shareInvoice } from '../services/invoicePdfService';

interface MarineLoadingLog {
    id: string;
    refuellerId: string;
    vesselName: string;
    volume: number;
    meterOpen: number;
    meterClose: number;
    product: string;
    startTime: string;
    endTime: string;
    visualCheck: boolean;
    waterCheck: boolean;
    operatorId: string;
    timestamp: string;
    deliveryNumber?: string;
    rawLog?: FlightLog;
}

interface MarineLoadingProps {
  user?: User | null;
}

export const MarineLoading: React.FC<MarineLoadingProps> = ({ user }) => {
  const { equipment, createAlert, alerts, flightLogs, staff, updateEquipment, addFlightLogEntry, isTicketAutoEnabled, previewNextTicketNumber, generateTicketNumber } = useOperationalData();
  const { resolveCustomerByFlightOrAirline } = useFinanceData();
  const { notify } = useNotification();
  const isAutoJetA1 = isTicketAutoEnabled('JET_A1');
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
  const invoiceEmailInputRef = React.useRef<HTMLInputElement | null>(null);

  // Load real logs from database context dynamically via useMemo
  const logs = useMemo<MarineLoadingLog[]>(() => {
    const parseTime = (tString?: string) => {
      if (!tString) return '';
      try {
        const d = new Date(tString);
        if (isNaN(d.getTime())) return '';
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      } catch {
        return '';
      }
    };

    const dbLogs = (flightLogs || [])
      .filter(log => log && log.logType === 'MARINE')
      .map(log => {
        const vesselName = (log.flightNumber || '').replace('VESSEL-', '');
        return {
          id: log.id,
          refuellerId: log.vehicleId,
          vesselName: vesselName || 'MARINE VESSEL',
          volume: log.volume,
          meterOpen: log.meterOpen,
          meterClose: log.meterClose,
          product: 'Jet A-1',
          startTime: parseTime(log.timestampStart),
          endTime: parseTime(log.timestampFinalEnd),
          visualCheck: log.appearanceCheck,
          waterCheck: log.waterCheck,
          operatorId: log.operatorId,
          timestamp: log.timestampStart ? log.timestampStart.split('T')[0] : '',
          deliveryNumber: log.deliveryNumber,
          rawLog: log
        } as MarineLoadingLog;
      });

    // Sort by timestamp desc to show latest first
    const sortedLogs = [...dbLogs].sort((a, b) => {
      return (b.timestamp || '').localeCompare(a.timestamp || '') || (b.startTime || '').localeCompare(a.startTime || '');
    });

    // Deduplicate by deliveryNumber or id to prevent duplicates in Recent Provisioning
    const seen = new Set<string>();
    const deduplicatedLogs: MarineLoadingLog[] = [];
    for (const log of sortedLogs) {
      const key = log.deliveryNumber ? `ticket:${log.deliveryNumber}` : `id:${log.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedLogs.push(log);
      }
    }

    return deduplicatedLogs;
  }, [flightLogs]);

  const isOperator = user?.role === UserRole.DEPOT_OPERATOR;

  // Extract staff roles for personnel dropdowns
  const activeOperators = (staff || []).filter(s => [UserRole.DEPOT_OPERATOR, UserRole.ITP_OPERATOR, UserRole.ITP_SUPERVISOR].includes(s.role));
  // Verifying Officer Name dropdown lists DEPOT staffs (Managers and Operators)
  const activeOfficers = (staff || []).filter(s => [UserRole.DEPOT_MANAGER, UserRole.DEPOT_OPERATOR].includes(s.role));

  const [formData, setFormData] = useState({
    refuellerId: '',
    vesselName: '',
    meterOpen: '',
    meterClose: '',
    volume: '0',
    product: 'Jet A-1',
    startTime: '',
    endTime: '',
    visualCheck: false,
    waterCheck: false,
    deliveryNumber: '',
    date: new Date().toISOString().split('T')[0],
    operatorName: '',
    supervisorName: '',
    signerName: '',
    signerDesignation: '',
    signerEmail: '',
    signatureDataUrl: null as string | null
  });

  const activeAccountResolution = useMemo(() => {
    if (!formData.vesselName) {
      return { customer: undefined, airlineHolding: undefined, emails: [] as string[] };
    }
    return resolveCustomerByFlightOrAirline(
      `VESSEL-${formData.vesselName.toUpperCase()}`,
      formData.vesselName,
      `VESSEL-${formData.vesselName.toUpperCase()}`,
      'LOCAL SALES / OTHERS'
    );
  }, [formData.vesselName, resolveCustomerByFlightOrAirline]);

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

  useEffect(() => {
    if (formData.vesselName && !formData.signerEmail && activeAccountResolution.emails.length > 0) {
      setFormData(prev => !prev.signerEmail ? { ...prev, signerEmail: activeAccountResolution.emails[0] } : prev);
    }
  }, [formData.vesselName, activeAccountResolution.emails]);

  useEffect(() => {
    if (completedInvoiceLog) {
      const defaultEmail = completedInvoiceLog.signerEmail || completedAccountResolution.emails[0] || '';
      setInvoiceModalEmail(defaultEmail);
      setPrebuiltInvoicePdf(null);
      generateInvoicePdfFile(completedInvoiceLog, user || undefined)
        .then(file => setPrebuiltInvoicePdf(file))
        .catch(err => console.warn('[MarineLoading] Prebuild invoice PDF warning:', err));
    } else {
      setPrebuiltInvoicePdf(null);
    }
  }, [completedInvoiceLog?.id, completedInvoiceLog?.deliveryNumber, user, completedAccountResolution.emails]);

  // Pre-enter opening totalizer based on Refueller's last completed log close reading
  useEffect(() => {
    if (formData.refuellerId) {
      const vehicleLogs = (flightLogs || []).filter(
        log => log && log.vehicleId?.toUpperCase() === formData.refuellerId.toUpperCase() && log.status === 'COMPLETED'
      );
      const getLogTime = (log: any) => {
        if (log.timestampFinalEnd) return new Date(log.timestampFinalEnd).getTime();
        if (log.timestampClearance) return new Date(log.timestampClearance).getTime();
        if (log.timestampInitialEnd) return new Date(log.timestampInitialEnd).getTime();
        if (log.timestampStart) return new Date(log.timestampStart).getTime();
        if (log.timestampArrived) return new Date(log.timestampArrived).getTime();
        if (log.operationalDate) return new Date(log.operationalDate).getTime();
        return 0;
      };
      const lastLog = [...vehicleLogs].sort((a, b) => getLogTime(b) - getLogTime(a))[0];
      
      const initialMeter = (lastLog?.meterClose || 0).toString();
      setFormData(prev => {
        const vol = parseFloat(prev.volume.toString().replace(/,/g, '')) || 0;
        const newClose = ((parseFloat(initialMeter) || 0) + vol).toString();
        if (prev.meterOpen === initialMeter && prev.meterClose === newClose) {
          return prev;
        }
        return {
          ...prev,
          meterOpen: initialMeter,
          meterClose: newClose
        };
      });
    } else {
      setFormData(prev => {
        if (prev.meterOpen === '' && prev.meterClose === '') return prev;
        return {
          ...prev,
          meterOpen: '',
          meterClose: ''
        };
      });
    }
  }, [formData.refuellerId, flightLogs]);

  const availableRefuelers = (equipment || [])
    .filter(eq => eq.type === EquipmentType.REFUELLER && eq.status === EquipmentStatus.AVAILABLE && (eq.currentVolume || 0) > 0);

  // Filter alerts for replenishment requests to highlight them
  const requestedRFs = Array.from(new Set(
    (alerts || [])
      .filter(a => a && !a.acknowledged && (
        a.message.toLowerCase().includes('request') && (
          a.message.toLowerCase().includes('replenish') || 
          a.message.toLowerCase().includes('refuel')
        )
      ))
      .map(a => {
        const match = a.message.match(/unit\s+(RF-\d+)/i);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(Boolean) as string[]
  ));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      // Auto-calculate closing totalizer if meterOpen or volume changes
      if (name === 'meterOpen' || name === 'volume') {
        const open = parseFloat(name === 'meterOpen' ? value.replace(/,/g, '') : updated.meterOpen.toString().replace(/,/g, '')) || 0;
        const vol = parseFloat(name === 'volume' ? value.replace(/,/g, '') : updated.volume.toString().replace(/,/g, '')) || 0;
        updated.meterClose = (open + vol).toString();
      }

      return updated;
    });
  };

  const setNow = (field: 'startTime' | 'endTime') => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    setFormData(prev => ({ ...prev, [field]: timeStr }));
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

    if (!formData.visualCheck || !formData.waterCheck) {
      notify('Please complete both QC Protocol checks (Visual Analysis & Water Verification).', 'warning');
      return;
    }

    let checkTicket = formData.deliveryNumber
      ? (isPaperMode && !formData.deliveryNumber.includes('-P-')
          ? `MLE-P-${formData.deliveryNumber.replace(/^MLE-P-/i, '')}`
          : (formData.deliveryNumber.startsWith('MLE-') ? formData.deliveryNumber : `MLE-${formData.deliveryNumber}`))
      : '';

    if (checkTicket) {
      const ticketVal = await checkDuplicateTicketAcrossJetA1(checkTicket, undefined, flightLogs);
      if (ticketVal.isDuplicate) {
        const errorMsg = ticketVal.message || `Delivery ticket ${checkTicket} already exists in the operations log. Each ticket number must be unique.`;
        setDuplicateError(errorMsg);
        notify(errorMsg, 'error');
        return;
      }
    }

    const parsedVolume = parseInt(formData.volume.toString().replace(/,/g, '')) || 0;
    if (parsedVolume <= 0) {
      notify('Please enter a valid transfer volume greater than 0 L.', 'warning');
      return;
    }

    const refueller = (equipment || []).find(eq => eq.id === formData.refuellerId);
    if (refueller && refueller.currentVolume !== undefined) {
      const maxAllowedVolume = refueller.currentVolume + 500;
      if (parsedVolume > maxAllowedVolume) {
        notify(`Transfer volume (${parsedVolume.toLocaleString()} L) exceeds the refueller's balance fuel volume (${refueller.currentVolume.toLocaleString()} L) by more than 500 L.`, 'error');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleAuthorizeAndSubmit = async () => {
    setDuplicateError(null);

    if (!formData.signatureDataUrl || !formData.signerName?.trim()) {
      notify('Customer / Vessel signature and full name are required to finalize.', 'warning');
      return;
    }

    let finalDeliveryNumber = formData.deliveryNumber ? (formData.deliveryNumber.startsWith('MLE-') ? formData.deliveryNumber : `MLE-${formData.deliveryNumber}`) : '';

    if (isAutoJetA1 && !finalDeliveryNumber) {
      const cat = isPaperMode ? 'PAPER_OFFLINE' : 'JET_A1';
      const genRes = await generateTicketNumber(cat, formData.operatorName || user?.name || 'System Admin');
      if (genRes.success && genRes.ticketNumber) {
        finalDeliveryNumber = genRes.ticketNumber;
      }
    } else if (isPaperMode && !finalDeliveryNumber.includes('-P-')) {
      finalDeliveryNumber = `MLE-P-${formData.deliveryNumber.replace(/^MLE-P-/i, '')}`;
    }

    if (finalDeliveryNumber) {
      const ticketVal = await checkDuplicateTicketAcrossJetA1(finalDeliveryNumber, undefined, flightLogs);
      if (ticketVal.isDuplicate) {
        const errorMsg = ticketVal.message || `Delivery ticket ${finalDeliveryNumber} already exists in the operations log. Each ticket number must be unique.`;
        setDuplicateError(errorMsg);
        notify(errorMsg, 'error');
        return;
      }
    }

    const parsedVolume = parseInt(formData.volume.toString().replace(/,/g, '')) || 0;
    const parsedMeterOpen = parseFloat(formData.meterOpen.toString().replace(/,/g, '')) || 0;
    const parsedMeterClose = parseFloat(formData.meterClose.toString().replace(/,/g, '')) || 0;

    setLoading(true);
    setShowConfirmModal(false);

    try {
      const newLogId = `ml-${Date.now()}`;
      const signedTimestamp = new Date().toISOString();

      // Save to global flight/operations log
      const logToSave: FlightLog = {
        id: newLogId,
        flightNumber: `VESSEL-${formData.vesselName.toUpperCase()}`,
        aircraftReg: `VESSEL-${formData.vesselName.toUpperCase()}`,
        aircraftType: 'MARINE VESSEL',
        stand: 'MARINE JETTY',
        operatorId: formData.operatorName || user?.name || 'System Admin',
        tacticalOperator: formData.operatorName || user?.name || 'System Admin',
        officer: formData.supervisorName || 'N/A',
        operatorName: formData.vesselName,
        co: 'LOCAL SALES / OTHERS',
        airline: 'LOCAL SALES / OTHERS',
        vehicleId: formData.refuellerId.toUpperCase(),
        status: 'COMPLETED',
        logType: 'MARINE',
        isDomestic: true,
        intDom: 'DOM',
        deliveryNumber: finalDeliveryNumber || undefined,
        operationalDate: formData.date,
        timestampStart: formData.startTime ? new Date(`${formData.date}T${formData.startTime}:00`).toISOString() : `${formData.date}T00:00:00.000Z`,
        timestampFinalEnd: formData.endTime ? new Date(`${formData.date}T${formData.endTime}:00`).toISOString() : `${formData.date}T00:00:00.000Z`,
        timestampClearance: signedTimestamp,
        meterOpen: parsedMeterOpen,
        meterClose: parsedMeterClose,
        volume: parsedVolume,
        panelCheck: true,
        walkAroundCheck: true,
        appearanceCheck: formData.visualCheck,
        waterCheck: formData.waterCheck,
        remarks: `Marine Loading for ${formData.vesselName} (Supervised by ${formData.supervisorName})`,
        signatureDataUrl: formData.signatureDataUrl || undefined,
        signerName: formData.signerName ? formData.signerName.toUpperCase() : undefined,
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
          localStorage.setItem(`fms_sig_${logToSave.flightNumber}`, JSON.stringify(sigPayload));
        } catch (e) {}
      }

      try {
        logToSave.invoiceHtml = generateInvoiceHtml(logToSave, user || undefined);
      } catch (invErr) {
        console.warn('[MarineLoading] Invoice HTML generation error:', invErr);
      }

      const savedLog = await supabaseService.createFlightLog(logToSave);
      const finalizedLog: FlightLog = { ...logToSave, ...(savedLog || {}) };
      if (addFlightLogEntry) {
        addFlightLogEntry(finalizedLog);
      }

      // Update Refueller Payload/Inventory if applicable
      if (formData.refuellerId) {
        const refueller = (equipment || []).find(eq => eq.id.toUpperCase() === formData.refuellerId.toUpperCase());
        if (refueller && refueller.currentVolume !== undefined) {
          const newVolume = Math.max(0, refueller.currentVolume - parsedVolume);
          const capacity = refueller.maxCapacity || 20000;
          const isLow = newVolume < 2000 || newVolume < capacity * 0.1;
          
          await updateEquipment(formData.refuellerId, {
            currentVolume: newVolume,
            status: isLow ? EquipmentStatus.REFUELLING : EquipmentStatus.AVAILABLE
          });

          if (isLow) {
            try {
              await createAlert({
                severity: 'medium',
                message: `Replenishment requested for unit ${formData.refuellerId} (Low fuel: ${newVolume.toLocaleString()}L)`,
                timestamp: new Date().toISOString(),
                acknowledged: false,
                targetRole: UserRole.DEPOT_OPERATOR
              });
              notify(`Refueller ${formData.refuellerId} fuel level is low (${newVolume.toLocaleString()}L). Replenishment request triggered automatically.`, 'warning');
            } catch (err) {
              console.error("Auto alert trigger failed:", err);
            }
          }
        }
      }

      // Create alert for record safely
      try {
        await createAlert({
          severity: 'low',
          message: `Marine loading completed: ${formData.vesselName} loaded with ${parsedVolume.toLocaleString()}L from ${formData.refuellerId}${finalDeliveryNumber ? ` (Ticket: ${finalDeliveryNumber})` : ''}`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
          targetRole: UserRole.DEPOT_MANAGER
        });
      } catch (alertErr) {
        console.warn('Marine log completion alert warning:', alertErr);
      }

      setCompletedInvoiceLog(finalizedLog);
      setSuccess(true);
      notify('Marine loading log finalized and synced!', 'success');
    } catch (dbError) {
      console.error('Error saving marine log to database:', dbError);
      notify('Failed to sync marine loading log. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetFormAndStartNew = () => {
    setSuccess(false);
    setCompletedInvoiceLog(null);
    setDuplicateError(null);
    setFormData({
      refuellerId: '',
      vesselName: '',
      meterOpen: '',
      meterClose: '',
      volume: '0',
      product: 'Jet A-1',
      startTime: '',
      endTime: '',
      visualCheck: false,
      waterCheck: false,
      deliveryNumber: '',
      date: new Date().toISOString().split('T')[0],
      operatorName: '',
      supervisorName: '',
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
          <Ship className="w-12 h-12 text-primary shadow-glow" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-[900] text-on-surface mb-3 tracking-tighter uppercase italic">LOADING COMPLETE</h2>
        <p className="text-on-surface-dim max-w-md uppercase tracking-widest text-[10px] font-black opacity-60 mb-6">
          Marine vessel {completedInvoiceLog?.operatorName || formData.vesselName} successfully loaded from unit {completedInvoiceLog?.vehicleId || formData.refuellerId}. Logistics registry updated.
        </p>

        {completedInvoiceLog && (
          <div className="w-full max-w-md bg-surface-dim/50 border border-outline rounded-3xl p-5 mb-8 space-y-4 text-left shadow-sm">
            <div className="flex items-center justify-between border-b border-outline/40 pb-3">
              <div>
                <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">Delivery Ticket</span>
                <span className="text-base font-mono font-black text-error">{completedInvoiceLog.deliveryNumber || 'MLE-INVOICE'}</span>
              </div>
              <div className="text-right">
                <span className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">Volume Loaded</span>
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
          INITIATE NEW LOAD
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 lg:gap-10 border-b border-outline pb-6 lg:pb-10">
        <div>
          <h1 className="headline-lg tracking-tighter mb-2 uppercase flex items-center">
            MARINE <span className="text-primary italic font-medium ml-3">LOADING</span>
          </h1>
          <div className="flex items-center space-x-3">
             <span className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] font-mono">Registry: ITP → VESSEL</span>
             <div className="h-1 w-1 rounded-full bg-on-surface-dim opacity-20"></div>
             <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Direct Refueller Provisioning</span>
          </div>
        </div>
        <div className="px-6 py-3 bg-surface-dim border border-outline rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface-dim flex items-center shadow-inner">
           <Ship className="w-4 h-4 mr-3 text-primary" />
           Vessel Support Operations
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10">
        {/* Input Form */}
        <div className="xl:col-span-2">
            <form onSubmit={handleOpenReviewModal} className="space-y-6 lg:space-y-10">
                {/* Delivery Ticket Entry Field */}
                <div className="card-premium p-6 lg:p-8 border-outline overflow-hidden">
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

                {/* Source & Destination */}
                <div className="card-premium p-6 lg:p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                        <ArrowRight className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Asset Assignment
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Source Refueller</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                    <Truck className="h-4 w-4 text-primary opacity-40" />
                                </div>
                                <select 
                                    name="refuellerId"
                                    required
                                    value={formData.refuellerId}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                                >
                                    <option value="">SELECT RF UNIT...</option>
                                    {availableRefuelers.length === 0 ? (
                                        <option disabled>NO AVAILABLE REFUELERS</option>
                                    ) : (
                                        availableRefuelers.map(rf => (
                                            <option key={rf.id} value={rf.id}>
                                                {rf.id} (FUEL: {rf.currentVolume.toLocaleString()} / CAP: {rf.maxCapacity.toLocaleString()}L) {requestedRFs.includes(rf.id) ? '⚠ REPLENISH' : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Target Vessel Identity</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                    <Ship className="h-4 w-4 text-primary opacity-40" />
                                </div>
                                <input 
                                    type="text" 
                                    name="vesselName"
                                    required
                                    value={formData.vesselName}
                                    onChange={handleInputChange}
                                    className="w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Fuel Type / Product</label>
                            <div className="w-full px-6 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest flex items-center shadow-inner h-[53px]">
                                <Droplet className="w-4 h-4 mr-3 opacity-60" />
                                JET A-1
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mt-6 lg:mt-10 p-4 lg:p-6 bg-surface-dim/30 rounded-[24px] lg:rounded-[32px] shadow-inner">
                        <div className="card-premium p-4 lg:p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Opening Totalizer</label>
                            <input 
                                type="text" 
                                name="meterOpen"
                                required
                                inputMode="numeric"
                                value={formData.meterOpen ? parseInt(formData.meterOpen.toString().replace(/,/g, '')).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData(prev => {
                                            const updated = { ...prev, meterOpen: val };
                                            const open = parseFloat(val) || 0;
                                            const vol = parseFloat(prev.volume.toString().replace(/,/g, '')) || 0;
                                            updated.meterClose = (open + vol).toString();
                                            return updated;
                                        });
                                    }
                                }}
                                className="w-full text-2xl lg:text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline focus:border-primary transition-all text-on-surface placeholder:opacity-10"
                                placeholder="000,000"
                            />
                        </div>

                        <div className="card-premium p-4 lg:p-6 border-outline/30 bg-surface">
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-4 opacity-40">Calculated Closing Totalizer</label>
                            <input 
                                type="text" 
                                name="meterClose"
                                readOnly
                                inputMode="numeric"
                                value={formData.meterClose ? parseInt(formData.meterClose.toString().replace(/,/g, '')).toLocaleString() : '0'}
                                className="w-full text-2xl lg:text-4xl font-mono font-black py-2 bg-transparent outline-none border-b-2 border-outline/30 text-on-surface-dim opacity-70 cursor-not-allowed"
                                placeholder="000,000"
                            />
                        </div>
                    </div>

                    <div className="mt-4 p-4 lg:p-8 bg-surface-dim/30 rounded-[32px] lg:rounded-[40px] border border-outline">
                        <label className="block text-[10px] font-black text-on-surface uppercase mb-4 tracking-widest text-center opacity-60">Transfer Volume (Liters)</label>
                        <div className="relative w-full max-w-md mx-auto">
                            <input 
                                type="text" 
                                name="volume"
                                required
                                inputMode="numeric"
                                placeholder="0"
                                value={formData.volume && formData.volume !== '0' ? parseInt(formData.volume.toString().replace(/,/g, '')).toLocaleString() : ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '');
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData(prev => {
                                            const updated = { ...prev, volume: val };
                                            const open = parseFloat(prev.meterOpen.toString().replace(/,/g, '')) || 0;
                                            const vol = parseFloat(val) || 0;
                                            updated.meterClose = (open + vol).toString();
                                            return updated;
                                        });
                                    }
                                }}
                                className="w-full px-6 lg:px-10 py-4 lg:py-6 bg-surface-lowest border border-outline/50 rounded-[24px] lg:rounded-[32px] text-3xl lg:text-5xl font-[900] text-primary tracking-tighter text-center outline-none transition-all font-mono shadow-inner focus:border-primary"
                            />
                            <span className="absolute right-6 lg:right-10 top-1/2 transform -translate-y-1/2 text-[10px] font-black text-on-surface-dim uppercase opacity-30">LTRS</span>
                        </div>
                    </div>
                </div>

                {/* Personnel Selectors */}
                <div className="card-premium p-6 lg:p-8">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-6 flex items-center">
                        <Users className="w-4 h-4 mr-3 text-primary opacity-60" />
                        Personnel Involved
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Transfer Operator Name</label>
                            <select
                                name="operatorName"
                                required
                                value={formData.operatorName}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                            >
                                <option value="">SELECT OPERATOR...</option>
                                {(activeOperators.length > 0 ? activeOperators : staff).map(op => (
                                    <option key={op.id} value={op.name}>{op.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Verifying Officer Name</label>
                            <select
                                name="supervisorName"
                                required
                                value={formData.supervisorName}
                                onChange={handleInputChange}
                                className="w-full px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none"
                            >
                                <option value="">SELECT OFFICER...</option>
                                {(activeOfficers.length > 0 ? activeOfficers : staff).map(off => (
                                    <option key={off.id} value={off.name}>{off.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Operations Timing & QC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
                    <div className="card-premium p-6 lg:p-8 border border-outline rounded-3xl border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <Clock className="w-4 h-4 mr-3 text-primary opacity-60" />
                            Chronology
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Operational Date</label>
                                <div className="relative">
                                    <input 
                                        required 
                                        type="date" 
                                        name="date"
                                        disabled={isOperator}
                                        value={formData.date}
                                        onChange={handleInputChange}
                                        onClick={(e) => { try { if (!isOperator && 'showPicker' in HTMLInputElement.prototype) (e.target as HTMLInputElement).showPicker(); } catch {} }}
                                        className={`w-full pl-14 pr-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all ${
                                          isOperator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                    />
                                    <Calendar className="absolute left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary opacity-40 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Load Commencement</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="time" 
                                        name="startTime"
                                        required
                                        value={formData.startTime}
                                        onChange={handleInputChange}
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('startTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover-kinetic-gradient transition-all text-on-surface-dim active:scale-95 cursor-pointer"
                                        title="Set current time"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-on-surface-dim uppercase mb-3 tracking-widest opacity-40">Load Completion</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="time" 
                                        name="endTime"
                                        required
                                        value={formData.endTime}
                                        onChange={handleInputChange}
                                        className="flex-1 px-6 py-4 bg-surface-dim border border-outline rounded-2xl text-[11px] font-black uppercase tracking-widest focus:border-primary outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setNow('endTime')}
                                        className="px-5 bg-surface-dim border border-outline rounded-2xl hover-kinetic-gradient transition-all text-on-surface-dim active:scale-95 cursor-pointer"
                                        title="Set current time"
                                    >
                                        <Clock className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium p-8 border border-outline rounded-3xl border-l-4 border-l-primary">
                        <h3 className="text-sm font-black text-on-surface uppercase tracking-[0.3em] mb-8 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-3 text-primary" />
                            QC Protocol
                        </h3>
                        
                        <div className="space-y-4">
                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.visualCheck ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.visualCheck ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.visualCheck && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="visualCheck"
                                    checked={formData.visualCheck}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">Visual Analysis</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Free of Particulates / Clear & Bright</span>
                                </div>
                            </label>

                            <label className={`flex items-center p-6 rounded-3xl border-2 cursor-pointer transition-all ${formData.waterCheck ? 'border-success/40 bg-success/5' : 'border-outline bg-surface-dim hover:border-primary/30'}`}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.waterCheck ? 'bg-success border-success' : 'border-outline bg-surface'}`}>
                                    {formData.waterCheck && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    name="waterCheck"
                                    checked={formData.waterCheck}
                                    onChange={handleInputChange}
                                    className="hidden"
                                />
                                <div className="ml-5">
                                    <span className="block text-[10px] font-[900] text-on-surface uppercase tracking-widest">Water Verification</span>
                                    <span className="block text-[9px] text-on-surface-dim opacity-40 uppercase tracking-widest mt-1">Chemical Water Detector Negative</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bg-warning/10 p-6 rounded-3xl border border-warning/20 text-[10px] font-[900] uppercase tracking-widest text-warning flex items-start">
                    <AlertTriangle className="w-5 h-5 mr-4 flex-shrink-0" />
                    <p className="leading-relaxed">Bonding protocol must be established before transfer. Confirm emergency stop accessibility and sector clear.</p>
                </div>

                {/* Vessel Master / Customer Signature & Declaration */}
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
                    'Vessel Master / Captain',
                    'Chief Engineer',
                    'Marine Operations Officer',
                    'Harbor Duty Rep',
                    'Authorized Receiving Agent'
                  ]}
                  declarationText="I hereby acknowledge and certify receipt of the transferred fuel volume into the vessel specified. All meter readings, visual analyses, and safety bonding protocols have been verified and accepted."
                  title="Marine Customer / Vessel Acknowledgment"
                  subtitle="Official Bunker Transfer & Delivery Certification"
                />

                <button 
                    type="submit" 
                    disabled={loading || !formData.visualCheck || !formData.waterCheck || (!isAutoJetA1 && (!formData.deliveryNumber || formData.deliveryNumber.length < 4)) || !formData.signatureDataUrl || !formData.signerName?.trim()}
                    className="w-full py-6 kinetic-gradient text-white rounded-[32px] font-[900] text-sm uppercase tracking-[0.4em] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale flex items-center justify-center shadow-premium cursor-pointer"
                >
                    {loading ? 'SYNCHRONIZING...' : (
                    <>
                        <Eye className="w-5 h-5 mr-4" />
                        REVIEW & SUBMIT LOADING LOG
                    </>
                    )}
                </button>
                {(!formData.signatureDataUrl || !formData.signerName?.trim()) && (
                  <div className="flex items-center justify-center gap-2 text-amber-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-center py-2 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Customer / Vessel signature and full name are required to submit</span>
                  </div>
                )}
            </form>
        </div>

        {/* Oversight / History Panel */}
        <div className="xl:col-span-1 h-full">
             <div className="card-premium h-full flex flex-col overflow-hidden">
                <div className="px-8 py-6 border-b border-outline bg-surface-dim/30 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.3em] flex items-center">
                        <History className="w-4 h-4 mr-3 text-primary" />
                        Recent Provisioning
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {(logs || []).length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-on-surface-dim uppercase tracking-widest opacity-40 italic">Syncing operational data...</div>
                    ) : (
                        <div className="divide-y divide-outline">
                            {(logs || []).map(log => {
                                return (
                                    <div key={log.id} className="p-8 hover:bg-primary/[0.02] transition-colors group">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-lg font-[900] text-on-surface tracking-tighter italic uppercase group-hover:text-primary transition-colors">{log.vesselName}</span>
                                            <span className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-widest">{log.startTime} - {log.endTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xl font-[900] text-on-surface tracking-tighter italic">
                                                {(typeof log.volume === 'number' ? log.volume : parseInt(log.volume)).toLocaleString()} <span className="text-[10px] opacity-20">L</span>
                                            </span>
                                            <span className="text-[9px] font-black px-4 py-1 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-[0.2em]">
                                                {log.refuellerId}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black text-on-surface-dim uppercase tracking-widest">
                                            <span className="flex items-center font-mono opacity-40">
                                                <Droplet className="w-3 h-3 mr-2" />
                                                {log.product}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {log.deliveryNumber && (
                                                    <span className="flex items-center text-primary tracking-widest font-mono mr-2">
                                                        <FileText className="w-3.5 h-3.5 mr-1" />
                                                        {log.deliveryNumber}
                                                    </span>
                                                )}
                                                {log.rawLog && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openPrintInvoice(log.rawLog!, user || undefined)}
                                                            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                                                            title="View / Print Invoice PDF"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await shareInvoice(log.rawLog!, user || undefined);
                                                                    if (res === 'downloaded') {
                                                                        notify('Invoice PDF downloaded to your device.', 'success');
                                                                    }
                                                                } catch {
                                                                    notify('Could not share PDF invoice.', 'error');
                                                                }
                                                            }}
                                                            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                                                            title="Share Invoice PDF"
                                                        >
                                                            <Share2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCompletedInvoiceLog(log.rawLog!)}
                                                            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                                                            title="Email Invoice PDF"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-outline bg-surface-dim/30">
                    <button className="text-[10px] font-black text-primary hover:text-on-surface uppercase tracking-[0.3em] transition-all w-full flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 mr-3" />
                        ACCESS LOG ARCHIVE
                    </button>
                </div>
             </div>
        </div>
      </div>

      {/* Review Operations Log Modal */}
      {showConfirmModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface rounded-3xl border border-outline shadow-premium w-full max-w-2xl p-6 sm:p-8 animate-in fade-in zoom-in duration-300 my-auto max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-outline/30 shrink-0">
              <div>
                <span className="block text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Confirm Authorization</span>
                <h3 className="text-xl sm:text-2xl font-[900] tracking-tighter text-on-surface">REVIEW MARINE LOADING LOG</h3>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="p-2 rounded-xl hover:bg-surface-dim transition-colors cursor-pointer">
                <X className="w-5 h-5 text-on-surface-dim" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin">
              {/* Vessel & Equipment Block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-dim/40 p-5 rounded-2xl border border-outline/20">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Target Vessel</span>
                  <span className="text-[12px] font-black text-primary uppercase">{formData.vesselName || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Source Refueller</span>
                  <span className="text-[12px] font-black text-on-surface uppercase">{formData.refuellerId || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Product</span>
                  <span className="text-[12px] font-black text-on-surface uppercase">JET A-1</span>
                </div>
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Operational Date</span>
                  <span className="text-[12px] font-black text-on-surface uppercase">{formData.date}</span>
                </div>
              </div>

              {/* Metering & Delivery Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card-premium p-4 border-outline/30">
                  <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Opening Totalizer</span>
                  <span className="text-lg font-mono font-black text-on-surface">
                    {(parseFloat(formData.meterOpen.toString().replace(/,/g, '')) || 0).toLocaleString()}
                  </span>
                </div>
                <div className="card-premium p-4 border-outline/30">
                  <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Transfer Volume</span>
                  <span className="text-lg font-mono font-black text-primary">
                    {(parseInt(formData.volume.toString().replace(/,/g, '')) || 0).toLocaleString()} L
                  </span>
                </div>
                <div className="card-premium p-4 border-outline/30">
                  <span className="block text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mb-1">Closing Totalizer</span>
                  <span className="text-lg font-mono font-black text-on-surface">
                    {(parseFloat(formData.meterClose.toString().replace(/,/g, '')) || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Timestamps Listing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3.5 bg-surface-dim/30 rounded-xl border border-outline/20">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface">Load Commencement</span>
                  <span className="text-[10px] font-black text-success font-mono flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    {formData.startTime || '--:--'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3.5 bg-surface-dim/30 rounded-xl border border-outline/20">
                  <span className="text-[10px] font-black uppercase tracking-wider text-on-surface">Load Completion</span>
                  <span className="text-[10px] font-black text-success font-mono flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    {formData.endTime || '--:--'}
                  </span>
                </div>
              </div>

              {/* QC Compliance & Ticket Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 bg-success/5 border border-success/20 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-success">QC Protocol Compliance</h4>
                  <div className="grid grid-cols-1 gap-2 text-[10px] font-black uppercase text-on-surface">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span>Visual Analysis (Clear & Bright)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span>Water Verification (Detector Negative)</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-surface-dim/40 border border-outline/20 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-55">Log Billing & Personnel</h4>
                  <div className="space-y-1.5 text-[10px] font-black uppercase">
                    <div>
                      <span className="opacity-40 tracking-wider">Ticket:</span>{' '}
                      <span className="font-mono text-error font-black text-sm">{getPreviewTicket()}</span>
                    </div>
                    <div>
                      <span className="opacity-40 tracking-wider">Transfer Operator:</span>{' '}
                      <span className="text-on-surface">{formData.operatorName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="opacity-40 tracking-wider">Verifying Officer:</span>{' '}
                      <span className="text-on-surface">{formData.supervisorName || 'N/A'}</span>
                    </div>
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
                  'Vessel Master / Captain',
                  'Chief Engineer',
                  'Marine Operations Officer',
                  'Harbor Duty Rep',
                  'Authorized Receiving Agent'
                ]}
                declarationText="I hereby acknowledge and certify receipt of the transferred fuel volume into the vessel specified. All meter readings, visual analyses, and safety bonding protocols have been verified and accepted."
                title="Marine Customer / Vessel Acknowledgment"
                subtitle="Official Bunker Transfer & Delivery Certification"
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
                  <span className="font-[900]">SYNCING...</span>
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
                    Marine Loading Finalized & Synced
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
                  <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Vessel Name</span>
                  <span className="font-black text-on-surface text-sm">{completedInvoiceLog.operatorName || completedInvoiceLog.flightNumber?.replace('VESSEL-', '')}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                  <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Source Refueller</span>
                  <span className="font-black text-on-surface text-sm">{completedInvoiceLog.vehicleId}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                  <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Verifying Officer</span>
                  <span className="font-bold text-on-surface">{completedInvoiceLog.officer || 'N/A'}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/20">
                  <span className="block text-[8px] font-black uppercase text-on-surface-dim opacity-50">Signer / Representative</span>
                  <span className="font-bold text-on-surface truncate block">{completedInvoiceLog.signerName || 'Vessel Master'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline/30 space-y-2">
                <label className="block text-[8px] font-black uppercase tracking-widest text-on-surface-dim opacity-60">
                  Representative Email (for Instant Invoice Dispatch)
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
                onClick={() => openPrintInvoice(completedInvoiceLog, user || undefined)}
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
                    await sendInvoiceEmail(completedInvoiceLog, targetEmail, user || undefined, prebuiltInvoicePdf);
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

