import React, { useState, useEffect } from 'react';
import { 
  FileText, ShieldAlert, Check, RefreshCw, Zap, 
  HelpCircle, AlertTriangle, Eye, ArrowRight, ToggleLeft, ToggleRight,
  Database, Info, RotateCcw, CheckCircle2, Hash
} from 'lucide-react';
import { UserRole, TicketCategory, TicketSequenceConfig } from '../types';
import { useOperationalData } from '../context/OperationalDataContext';
import { ticketGeneratorService } from '../services/ticketGeneratorService';
import { NotificationType } from '../context/NotificationContext';
import { activityLogService, LogModule, LogAction } from '../services/activityLogService';

interface TicketSettingsTabProps {
  currentUser?: any;
  pushNotification: (msg: string, type?: NotificationType) => void;
}

export const TicketSettingsTab: React.FC<TicketSettingsTabProps> = ({
  currentUser,
  pushNotification
}) => {
  const { 
    ticketSequences, 
    updateTicketSequence, 
    refreshTicketSequences,
    flightLogs 
  } = useOperationalData();

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [savingCategory, setSavingCategory] = useState<TicketCategory | null>(null);
  const [detectingCategory, setDetectingCategory] = useState<TicketCategory | null>(null);

  // Local draft configs for each category
  const [draftConfigs, setDraftConfigs] = useState<Record<TicketCategory, TicketSequenceConfig>>(() => ticketSequences);

  useEffect(() => {
    if (ticketSequences) {
      setDraftConfigs(ticketSequences);
    }
  }, [ticketSequences]);

  if (!isAdmin) {
    return (
      <div className="card-premium p-8 border-error/20 bg-error/5 flex flex-col items-center justify-center text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-3xl bg-error/10 border border-error/20 flex items-center justify-center text-error">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-on-surface uppercase tracking-tight">Access Restricted</h2>
          <p className="text-xs text-on-surface-dim opacity-70 max-w-md mt-1">
            Delivery ticket numbering rules and auto-generation switches are restricted to <strong>System Administrators</strong> only.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async (category: TicketCategory) => {
    const current = draftConfigs[category];
    const newState = !current.isAutoEnabled;

    setSavingCategory(category);
    try {
      await updateTicketSequence(category, { isAutoEnabled: newState }, currentUser);
      setDraftConfigs(prev => ({
        ...prev,
        [category]: { ...prev[category], isAutoEnabled: newState }
      }));
      pushNotification(
        `${category} automatic ticket generator is now ${newState ? 'ACTIVATED (ON)' : 'DEACTIVATED (OFF - Manual Mode)'}`,
        newState ? 'success' : 'info'
      );
    } catch (e) {
      pushNotification(`Failed to toggle ${category} generator.`, 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleFieldChange = (category: TicketCategory, field: keyof TicketSequenceConfig, value: any) => {
    setDraftConfigs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleSaveConfig = async (category: TicketCategory) => {
    const draft = draftConfigs[category];
    if (draft.currentNumber < 0) {
      pushNotification('Starting sequence number cannot be negative.', 'error');
      return;
    }

    setSavingCategory(category);
    try {
      await updateTicketSequence(category, {
        prefix: draft.prefix.trim().toUpperCase(),
        formatPattern: draft.formatPattern.trim(),
        paddingLength: Math.max(4, Math.min(10, Number(draft.paddingLength) || 6)),
        currentNumber: Number(draft.currentNumber) || 1,
        description: draft.description
      }, currentUser);

      pushNotification(`${category} sequence configuration successfully saved!`, 'success');
    } catch (e) {
      pushNotification(`Failed to save ${category} configuration.`, 'error');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleDetectMax = (category: TicketCategory) => {
    setDetectingCategory(category);
    try {
      const maxVal = ticketGeneratorService.detectMaxExistingTicket(category, flightLogs);
      if (maxVal > 0) {
        handleFieldChange(category, 'currentNumber', maxVal);
        pushNotification(
          `Detected highest existing ticket number in records: ${maxVal}. Sequence counter updated to ${maxVal}.`,
          'info'
        );
      } else {
        pushNotification(`No existing ticket numbers found matching ${category} format in local logs.`, 'info');
      }
    } finally {
      setDetectingCategory(null);
    }
  };

  const categories: {
    key: TicketCategory;
    title: string;
    badge: string;
    defaultDesc: string;
    examples: string;
    themeColor: string;
  }[] = [
    {
      key: 'JET_A1',
      title: 'Jet A-1 Aviation Operations',
      badge: 'JET A-1',
      defaultDesc: 'Applies to commercial Into-Plane refuelings, Seaplane bulk loading, and Marine Jet A-1 bunkering.',
      examples: 'Standard numeric sequence (e.g. MLE-100001, MLE-100002)',
      themeColor: 'border-primary/20 bg-primary/[0.02]'
    },
    {
      key: 'MGO',
      title: 'MGO / Diesel & Petrol Invoices',
      badge: 'MGO / GROUND',
      defaultDesc: 'Applies to Landside (LFS) and Airside (AFS) Diesel & Petrol vehicle fueling invoices.',
      examples: 'Distinct ground sequence (e.g. MLE-D-500001, MLE-D-500002 or MLE-MGO-500001)',
      themeColor: 'border-warning/20 bg-warning/[0.02]'
    },
    {
      key: 'PAPER_OFFLINE',
      title: 'Offline Paper Ticket Entry Method',
      badge: 'PAPER / OFFLINE',
      defaultDesc: 'Special automated sequence used when recording physical manual paper tickets into the system.',
      examples: 'Distinct paper entry tracking (e.g. MLE-P-100001, MLE-P-100002)',
      themeColor: 'border-success/20 bg-success/[0.02]'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Notice Banner */}
      <div className="bg-surface-container-low border border-outline rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
              Admin Governance
            </span>
            <span className="text-[10px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest">
              Delivery Ticket Number Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-on-surface uppercase tracking-tight">
            Automated Ticket Numbering Generator
          </h2>
          <p className="text-xs text-on-surface-dim opacity-70 leading-relaxed">
            By default, automatic generation is <strong>OFF</strong> and operators manually type 6-digit ticket numbers.
            When switched <strong>ON</strong>, the system generates atomic, collision-free delivery ticket numbers based on the fuel category.
          </p>
        </div>

        <button
          onClick={() => refreshTicketSequences()}
          className="px-5 py-3 rounded-2xl bg-surface-container border border-outline hover:border-primary/40 text-on-surface text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-primary" />
          Refresh Sequences
        </button>
      </div>

      {/* Category Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {categories.map(cat => {
          const cfg = draftConfigs[cat.key];
          const isSaving = savingCategory === cat.key;
          const isDetecting = detectingCategory === cat.key;
          const nextTicketPreview = ticketGeneratorService.formatTicket(
            cfg.formatPattern,
            cfg.prefix,
            (Number(cfg.currentNumber) || 0) + 1,
            Number(cfg.paddingLength) || 6
          );

          return (
            <div 
              key={cat.key}
              className={`card-premium p-6 sm:p-7 border rounded-3xl flex flex-col justify-between space-y-6 ${cat.themeColor}`}
            >
              <div className="space-y-5">
                {/* Header & Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg bg-surface-container-high border border-outline text-on-surface">
                      {cat.badge}
                    </span>
                    <h3 className="text-base font-black text-on-surface uppercase tracking-tight mt-2">
                      {cat.title}
                    </h3>
                  </div>

                  {/* Switch */}
                  <div className="flex flex-col items-end">
                    <button
                      onClick={() => handleToggle(cat.key)}
                      disabled={isSaving}
                      className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        cfg.isAutoEnabled ? 'bg-success' : 'bg-surface-container-high'
                      }`}
                      title={cfg.isAutoEnabled ? 'Click to switch OFF (Manual entry)' : 'Click to switch ON (Auto-generation)'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          cfg.isAutoEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${
                      cfg.isAutoEnabled ? 'text-success' : 'text-on-surface-dim opacity-50'
                    }`}>
                      {cfg.isAutoEnabled ? 'Auto ON' : 'Manual (OFF)'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-on-surface-dim opacity-60 leading-normal">
                  {cat.defaultDesc}
                </p>

                {/* Live Preview Display */}
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-dim opacity-50">
                      Next Auto-Generated Ticket:
                    </span>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Live Preview
                    </span>
                  </div>
                  <div className="text-2xl font-mono font-black text-error tracking-tight">
                    {nextTicketPreview}
                  </div>
                  <div className="text-[9px] text-on-surface-dim opacity-40 font-mono">
                    Current Counter: #{cfg.currentNumber}
                  </div>
                </div>

                {/* Settings Fields */}
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-60">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={cfg.prefix}
                        onChange={e => handleFieldChange(cat.key, 'prefix', e.target.value)}
                        className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-xs font-mono font-black text-on-surface outline-none border border-outline focus:border-primary uppercase"
                        placeholder="MLE-"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-60">
                        Zero Padding
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={10}
                        value={cfg.paddingLength}
                        onChange={e => handleFieldChange(cat.key, 'paddingLength', Number(e.target.value))}
                        className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-xs font-mono font-bold text-on-surface outline-none border border-outline focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-widest mb-1.5 opacity-60">
                      Format Pattern Template
                    </label>
                    <input
                      type="text"
                      value={cfg.formatPattern}
                      onChange={e => handleFieldChange(cat.key, 'formatPattern', e.target.value)}
                      className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-xs font-mono font-bold text-on-surface outline-none border border-outline focus:border-primary"
                      placeholder="{PREFIX}{NUMBER}"
                    />
                    <span className="text-[9px] text-on-surface-dim opacity-40 font-mono mt-1 block">
                      Variables: <code className="text-primary">{'{PREFIX}'}</code> and <code className="text-primary">{'{NUMBER}'}</code>
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[9px] font-black text-on-surface-dim uppercase tracking-widest opacity-60">
                        Current Sequence Counter
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDetectMax(cat.key)}
                        disabled={isDetecting}
                        className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1"
                        title="Scan database to detect the highest existing number in logs"
                      >
                        <Database className="w-3 h-3" />
                        Detect Max
                      </button>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={cfg.currentNumber}
                      onChange={e => handleFieldChange(cat.key, 'currentNumber', Number(e.target.value))}
                      className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-xs font-mono font-black text-on-surface outline-none border border-outline focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-outline flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveConfig(cat.key)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 kinetic-gradient rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Operational Help Guide */}
      <div className="bg-surface-container-low border border-outline rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          <h4 className="text-sm font-black text-on-surface uppercase tracking-tight">
            How Operational Forms Behave
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-on-surface-dim opacity-70">
          <div className="space-y-1.5">
            <strong className="text-on-surface font-bold uppercase tracking-wider block">
              1. When Switched OFF (Default)
            </strong>
            <p>
              Forms display the manual 6-digit input field with static <code className="font-mono text-on-surface">MLE-</code> prefix. Operators type their manual ticket numbers exactly as before. Duplicate ticket prevention remains active.
            </p>
          </div>

          <div className="space-y-1.5">
            <strong className="text-on-surface font-bold uppercase tracking-wider block">
              2. When Switched ON (Auto)
            </strong>
            <p>
              Forms display the next auto-generated ticket with a category badge. Ticket numbers are atomically assigned and validated upon submit so concurrent fuelings never collide.
            </p>
          </div>

          <div className="space-y-1.5">
            <strong className="text-on-surface font-bold uppercase tracking-wider block">
              3. Offline / Paper Ticket Entry
            </strong>
            <p>
              When an operator is recording physical paper tickets into the system, checking "Paper / Offline Ticket" automatically issues a trackable ticket from the <code className="font-mono text-on-surface">MLE-P-XXXXXX</code> sequence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
