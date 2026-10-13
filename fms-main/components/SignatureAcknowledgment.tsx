import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PenTool, RotateCcw, CheckCircle2, ShieldCheck, UserCheck, Briefcase, Mail, Maximize2, Minimize2 } from 'lucide-react';

export interface SignatureData {
  signatureDataUrl: string;
  signerName: string;
  signerDesignation: string;
  signerEmail?: string;
  signedAt: string;
}

export interface SignatureAcknowledgmentProps {
  signerName: string;
  onSignerNameChange: (val: string) => void;
  signerDesignation: string;
  onSignerDesignationChange: (val: string) => void;
  signerEmail?: string;
  onSignerEmailChange?: (val: string) => void;
  signatureDataUrl: string | null;
  onSignatureChange: (val: string | null) => void;
  designationPresets?: string[];
  declarationText?: string;
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  required?: boolean;
  fullScreenSection?: boolean;
}

export const SignatureAcknowledgment: React.FC<SignatureAcknowledgmentProps> = ({
  signerName,
  onSignerNameChange,
  signerDesignation,
  onSignerDesignationChange,
  signerEmail,
  onSignerEmailChange,
  signatureDataUrl,
  onSignatureChange,
  designationPresets = [
    'Captain (PIC)',
    'First Officer',
    'Aircraft Maintenance Engineer',
    'Ground Handler Rep'
  ],
  declarationText = 'I hereby acknowledge and certify receipt of the specified fuel volume. All quality control procedures, meter readings, and safety clearances have been verified and accepted.',
  title = 'Declaration of Acknowledgment',
  subtitle = 'Official Fuel Uplift & Transaction Certification',
  disabled = false,
  required = false,
  fullScreenSection = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!signatureDataUrl);
  const [isOverlayFullscreen, setIsOverlayFullscreen] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with existing signature or blank
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = signatureDataUrl;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  }, [signatureDataUrl, isOverlayFullscreen]);

  // Canvas coordinates converter
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;
    setIsDrawing(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4'; // Cyan-500
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastPointRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    ctx.strokeStyle = '#06b6d4'; // Cyan signature stroke
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
    if (!hasDrawn) {
      setHasDrawn(true);
    }
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export compact base64 PNG so API payloads stay well under 100KB
    let dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > 25000) {
      try {
        const tempCanvas = document.createElement('canvas');
        const targetWidth = 450;
        const targetHeight = Math.round((canvas.height / canvas.width) * targetWidth) || 110;
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tCtx = tempCanvas.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
          dataUrl = tempCanvas.toDataURL('image/png');
        }
      } catch {}
    }
    onSignatureChange(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  const isExpanded = fullScreenSection || isOverlayFullscreen;

  const content = (
    <div
      className={
        isOverlayFullscreen
          ? 'fixed inset-0 z-[9999] bg-surface p-4 sm:p-8 flex flex-col justify-between overflow-y-auto overflow-x-hidden space-y-4 animate-in fade-in duration-200'
          : fullScreenSection
          ? 'min-h-[calc(100dvh-4rem)] flex flex-col justify-between p-4 sm:p-8 border-2 border-cyan-500/25 space-y-4 sm:space-y-6 rounded-3xl bg-surface-dim/50 shadow-premium overflow-hidden'
          : 'sm:card-premium p-3 sm:p-6 border sm:border-outline border-outline/30 space-y-3.5 sm:space-y-5 rounded-2xl bg-surface-dim/40 shadow-none sm:shadow-sm overflow-hidden'
      }
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-outline/30 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[11px] sm:text-sm font-[900] uppercase tracking-wider text-on-surface leading-snug break-words">
              {title}
              {required && <span className="text-error text-xs font-black ml-1">*</span>}
            </h4>
            <p className="text-[8px] sm:text-[10px] text-on-surface-dim opacity-60 font-bold uppercase tracking-widest mt-0.5 leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {hasDrawn && (
            <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20 text-[8px] sm:text-[9px] font-black uppercase tracking-widest animate-in fade-in">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Certified
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsOverlayFullscreen(!isOverlayFullscreen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline/50 text-on-surface-dim hover:text-cyan-400 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
            title={isOverlayFullscreen ? 'Exit Full Screen' : 'Open Full Screen Signature'}
          >
            {isOverlayFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Declaration legal statement */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-surface-container-low border border-outline/30 text-[10px] sm:text-[11px] text-on-surface-dim leading-relaxed italic shrink-0">
        "{declarationText}"
      </div>

      {/* Signer Details: Full Name & Designation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 shrink-0">
        {/* Name Field */}
        <div>
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
            Signer Full Name {required && <span className="text-error">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value.toUpperCase())}
              disabled={disabled}
              placeholder=""
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs sm:text-sm font-bold text-on-surface uppercase focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
            />
            <UserCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 pointer-events-none" />
          </div>
        </div>

        {/* Designation Field */}
        <div>
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
            Designation / Title {required && <span className="text-error">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={signerDesignation}
              onChange={(e) => onSignerDesignationChange(e.target.value)}
              disabled={disabled}
              placeholder=""
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs sm:text-sm font-bold text-on-surface focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
            />
            <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Designation Presets */}
      {designationPresets && designationPresets.length > 0 && !disabled && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 shrink-0">
          <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mr-1">
            Presets:
          </span>
          {designationPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onSignerDesignationChange(preset)}
              className={`text-[9px] sm:text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                signerDesignation === preset
                  ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-sm'
                  : 'bg-surface-dim border-outline/40 text-on-surface-dim hover:text-on-surface hover:border-outline'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {/* Representative Email for Instant Invoice Dispatch */}
      {onSignerEmailChange && (
        <div className="shrink-0">
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
            Representative Email Address <span className="opacity-50 text-[8px] font-medium lowercase">(for instant invoice delivery)</span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={signerEmail || ''}
              onChange={(e) => onSignerEmailChange(e.target.value)}
              disabled={disabled}
              placeholder=""
              className="w-full px-4 py-3 bg-surface-dim border border-outline rounded-xl text-xs sm:text-sm font-bold text-on-surface focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
            />
            <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 pointer-events-none" />
          </div>
        </div>
      )}

      {/* JavaScript Signature Box */}
      <div className={`space-y-2 ${isExpanded ? 'flex-1 flex flex-col min-h-[260px] sm:min-h-[340px]' : ''}`}>
        <div className="flex items-center justify-between shrink-0">
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] opacity-60">
            Digital Signature Box {required && <span className="text-error">*</span>}
          </label>
          {hasDrawn && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Clear Signature
            </button>
          )}
        </div>

        {/* Canvas Pad */}
        <div className={`relative rounded-2xl border-2 border-dashed border-outline/60 bg-surface-container-lowest overflow-hidden transition-all hover:border-cyan-400/50 ${isExpanded ? 'flex-1 flex flex-col min-h-[240px] sm:min-h-[320px]' : ''}`}>
          <canvas
            ref={canvasRef}
            width={900}
            height={isExpanded ? 380 : 220}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerLeave={finishDrawing}
            onPointerCancel={finishDrawing}
            className={`w-full block select-none ${
              isExpanded ? 'flex-1 min-h-[240px] sm:min-h-[320px]' : 'h-36 sm:h-44'
            } ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
            }`}
            style={{ touchAction: 'none' }}
          />

          {/* Guidelines & Empty State Placeholder */}
          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center p-4">
              <PenTool className="w-6 h-6 text-cyan-400/30 mb-2" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-on-surface-dim opacity-30">
                Sign Here Using Touch Screen or Mouse
              </span>
              <div className="w-3/4 border-b border-outline/30 mt-6"></div>
            </div>
          )}

          {/* Base guideline when signing */}
          {hasDrawn && (
            <div className="absolute bottom-6 left-8 right-8 border-b border-outline/20 pointer-events-none">
              <span className="absolute -top-3.5 right-0 text-[8px] font-mono uppercase text-on-surface-dim opacity-25">
                Signer Line
              </span>
            </div>
          )}
        </div>
      </div>

      {isOverlayFullscreen && (
        <div className="pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsOverlayFullscreen(false)}
            className="w-full py-4 kinetic-gradient text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-premium flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Signature & Continue</span>
          </button>
        </div>
      )}
    </div>
  );

  if (isOverlayFullscreen && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};

