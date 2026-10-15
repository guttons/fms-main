import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Mail,
  X,
  ExternalLink,
  Download,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  Building,
  Plane,
  Sparkles
} from 'lucide-react';
import {
  openInOutlookWeb,
  openInGmail,
  openSystemMailto,
  downloadEmlDraft
} from '../services/invoicePdfService';
import { useNotification } from '../context/NotificationContext';

export interface EmailDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  flightNumber?: string;
  airlineName?: string;
  defaultTo: string;
  availableEmails?: string[];
  subject: string;
  bodyText: string;
  pdfAttachment?: File | Blob | null;
  pdfFilename?: string;
}

export const EmailDispatchModal: React.FC<EmailDispatchModalProps> = ({
  isOpen,
  onClose,
  title = 'Dispatch Flight Email',
  subtitle,
  flightNumber,
  airlineName,
  defaultTo,
  availableEmails = [],
  subject: initialSubject,
  bodyText: initialBodyText,
  pdfAttachment,
  pdfFilename = 'Invoice.pdf'
}) => {
  const { notify } = useNotification();
  const [to, setTo] = useState<string>(defaultTo || '');
  const [subject, setSubject] = useState<string>(initialSubject || '');
  const [bodyText, setBodyText] = useState<string>(initialBodyText || '');
  const [showBodyPreview, setShowBodyPreview] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDownloadingEml, setIsDownloadingEml] = useState<boolean>(false);

  // Sync state when props change
  useEffect(() => {
    setTo(defaultTo || '');
    setSubject(initialSubject || '');
    setBodyText(initialBodyText || '');
  }, [defaultTo, initialSubject, initialBodyText]);

  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const fullClipboardText = `To: ${to}\nSubject: ${subject}\n\n${bodyText}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullClipboardText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullClipboardText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      notify('Email details copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify('Failed to copy text', 'error');
    }
  };

  const handleOpenOutlookWeb = () => {
    if (!to.trim()) {
      notify('Please specify at least one recipient email address.', 'warning');
      return;
    }
    openInOutlookWeb(to.trim(), subject.trim(), bodyText);
    notify('Opened Microsoft 365 / Outlook on the Web compose tab.', 'success');
    localStorage.setItem('fms_preferred_email_client', 'm365');
  };

  const handleOpenGmail = () => {
    if (!to.trim()) {
      notify('Please specify at least one recipient email address.', 'warning');
      return;
    }
    openInGmail(to.trim(), subject.trim(), bodyText);
    notify('Opened Gmail compose tab.', 'success');
    localStorage.setItem('fms_preferred_email_client', 'gmail');
  };

  const handleDownloadEmlDraft = async () => {
    if (!to.trim()) {
      notify('Please specify at least one recipient email address.', 'warning');
      return;
    }
    setIsDownloadingEml(true);
    try {
      const cleanFlight = (flightNumber || 'Draft').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadEmlDraft({
        filename: `${cleanFlight}_Email_Draft`,
        to: to.trim(),
        subject: subject.trim(),
        bodyText,
        attachmentFile: pdfAttachment || null,
        attachmentFilename: pdfFilename
      });
      notify('Ready-to-send Outlook draft downloaded! Double-click to open in Outlook.', 'success');
      localStorage.setItem('fms_preferred_email_client', 'eml');
    } catch (e) {
      console.error('[EmailDispatchModal] EML download error:', e);
      notify('Failed to generate Outlook draft file.', 'error');
    } finally {
      setIsDownloadingEml(false);
    }
  };

  const handleOpenSystemMailto = () => {
    if (!to.trim()) {
      notify('Please specify at least one recipient email address.', 'warning');
      return;
    }
    openSystemMailto(to.trim(), subject.trim(), bodyText);
    notify('Triggered default system mail client.', 'info');
    localStorage.setItem('fms_preferred_email_client', 'mailto');
  };

  const toggleEmailChip = (chipEmail: string) => {
    const currentList = to
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const exists = currentList.includes(chipEmail);
    let nextList: string[];
    if (exists) {
      nextList = currentList.filter(s => s !== chipEmail);
    } else {
      nextList = [...currentList, chipEmail];
    }
    setTo(nextList.join(', '));
  };

  const modalContent = (
    <div className="fixed inset-0 z-[11000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface rounded-2xl sm:rounded-3xl border border-outline shadow-2xl w-full max-w-xl p-5 sm:p-7 animate-in fade-in zoom-in duration-200 my-auto flex flex-col max-h-[94dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 sm:pb-4 border-b border-outline/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary">
                  Email Dispatch
                </span>
                {flightNumber && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-dim border border-outline text-[9px] font-mono font-black text-on-surface">
                    {flightNumber}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-xl font-[900] tracking-tight text-on-surface truncate">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-dim transition-colors text-on-surface-dim shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 scrollbar-thin">
          {/* Metadata pill row */}
          {(airlineName || subtitle) && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-on-surface-dim opacity-75">
              {airlineName && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-dim border border-outline/30">
                  <Building className="w-3 h-3 text-cyan-400" />
                  <span>{airlineName}</span>
                </span>
              )}
              {subtitle && <span className="text-[10px] font-medium opacity-60">{subtitle}</span>}
            </div>
          )}

          {/* Recipients Field */}
          <div>
            <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-70">
              Recipients <span className="text-[8px] font-normal lowercase">(comma separated)</span>
            </label>
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="e.g. occ@airline.com, ops@handler.aero..."
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-mono font-bold text-on-surface focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all"
            />

            {/* Quick account email chips */}
            {availableEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-1 items-center">
                <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-50 mr-0.5">
                  Account Emails:
                </span>
                {availableEmails.map(email => {
                  const isSelected = to
                    .split(',')
                    .map(s => s.trim())
                    .includes(email);
                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => toggleEmailChip(email)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                          : 'bg-surface-dim border-outline/40 text-on-surface-dim hover:text-on-surface hover:border-outline'
                      }`}
                    >
                      {email} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-70">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all"
            />
          </div>

          {/* Attachment Banner if PDF attached */}
          {pdfAttachment && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <div className="flex items-center gap-2 text-[11px] font-black">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{pdfFilename}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 font-bold shrink-0">
                Auto-Attached in Draft
              </span>
            </div>
          )}

          {/* Collapsible Email Body Preview */}
          <div className="border border-outline/30 rounded-xl overflow-hidden bg-surface-dim/30">
            <button
              type="button"
              onClick={() => setShowBodyPreview(!showBodyPreview)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-dim/60 transition-colors text-left cursor-pointer"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-on-surface-dim opacity-70">
                {showBodyPreview ? 'Hide Message Preview' : 'Show Message Preview'}
              </span>
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary">
                {showBodyPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>
            {showBodyPreview && (
              <div className="p-3.5 pt-0 border-t border-outline/20">
                <textarea
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  rows={8}
                  className="w-full p-2.5 mt-2 bg-surface-container-lowest border border-outline/30 rounded-lg text-[10px] font-mono leading-relaxed text-on-surface outline-none focus:border-cyan-400 resize-y"
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Matrix */}
        <div className="pt-4 border-t border-outline/30 shrink-0 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 1. Microsoft 365 / Outlook Web (Primary for @macl.aero) */}
            <button
              type="button"
              onClick={handleOpenOutlookWeb}
              className="p-3.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/40 text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-[900] text-cyan-300 uppercase tracking-wider">
                    Outlook Web (M365)
                  </span>
                </div>
                <span className="block text-[8px] font-bold text-on-surface-dim opacity-70 mt-0.5">
                  Opens compose tab (@macl.aero)
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-500/20 text-blue-300 uppercase shrink-0">
                Instant
              </span>
            </button>

            {/* 2. Download Ready-to-Send Outlook Draft (.eml with PDF attached) */}
            <button
              type="button"
              disabled={isDownloadingEml}
              onClick={handleDownloadEmlDraft}
              className="p-3.5 rounded-xl bg-surface-dim hover:bg-surface-container-low border border-outline text-left transition-all group cursor-pointer flex items-center justify-between disabled:opacity-50"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-[900] text-on-surface uppercase tracking-wider">
                    Outlook Draft (.eml)
                  </span>
                </div>
                <span className="block text-[8px] font-bold text-on-surface-dim opacity-70 mt-0.5">
                  {pdfAttachment ? 'Opens Outlook with PDF attached' : 'Opens Outlook Desktop directly'}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-500/15 text-emerald-400 uppercase shrink-0">
                Desktop
              </span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 3. Gmail Web */}
            <button
              type="button"
              onClick={handleOpenGmail}
              className="py-2.5 px-3 rounded-xl bg-surface-dim hover:bg-surface-container border border-outline/50 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 text-on-surface text-[10px] font-black uppercase tracking-wider"
              title="Open Gmail Web Compose"
            >
              <ExternalLink className="w-3.5 h-3.5 text-red-400" />
              <span>Gmail Web</span>
            </button>

            {/* 4. Default System Mail App */}
            <button
              type="button"
              onClick={handleOpenSystemMailto}
              className="py-2.5 px-3 rounded-xl bg-surface-dim hover:bg-surface-container border border-outline/50 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 text-on-surface text-[10px] font-black uppercase tracking-wider"
              title="Open via device default mail client"
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>Mail App</span>
            </button>

            {/* 5. Copy Text */}
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3 rounded-xl bg-surface-dim hover:bg-surface-container border border-outline/50 text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 text-on-surface text-[10px] font-black uppercase tracking-wider"
              title="Copy email details to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
