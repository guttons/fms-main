import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, RotateCcw, CheckCircle2, ShieldCheck, UserCheck, Briefcase, Mail } from 'lucide-react';

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
  required = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!signatureDataUrl);
  const [customDesig, setCustomDesig] = useState(false);
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
  }, [signatureDataUrl]);

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

    // Export base64
    const dataUrl = canvas.toDataURL('image/png');
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

  return (
    <div className="sm:card-premium p-3 sm:p-6 border sm:border-outline border-outline/30 space-y-4 sm:space-y-5 rounded-2xl bg-surface-dim/40 shadow-none sm:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-outline/30 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[11px] sm:text-xs font-[900] uppercase tracking-wider text-on-surface flex items-center gap-2">
              {title}
              {required && <span className="text-error text-xs font-black">*</span>}
            </h4>
            <p className="text-[9px] text-on-surface-dim opacity-60 font-bold uppercase tracking-widest mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {hasDrawn && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20 text-[9px] font-black uppercase tracking-widest animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" /> Certified
          </span>
        )}
      </div>

      {/* Declaration legal statement */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-surface-container-low border border-outline/30 text-[10px] text-on-surface-dim leading-relaxed italic">
        "{declarationText}"
      </div>

      {/* Signer Details: Full Name & Designation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Name Field */}
        <div>
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
            Signer Full Name {required && <span className="text-error">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
              disabled={disabled}
              placeholder="e.g., Capt. Ahmed Rasheed"
              className="w-full px-4 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface placeholder:opacity-30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
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
              placeholder="e.g., Pilot in Command / Engineer"
              className="w-full px-4 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface placeholder:opacity-30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
            />
            <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Designation Presets */}
      {designationPresets && designationPresets.length > 0 && !disabled && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-dim opacity-40 mr-1">
            Presets:
          </span>
          {designationPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onSignerDesignationChange(preset)}
              className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
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
        <div>
          <label className="block text-[9px] font-black text-on-surface-dim uppercase tracking-[0.2em] mb-1.5 opacity-60">
            Representative Email Address <span className="opacity-50 text-[8px] font-medium lowercase">(for instant invoice delivery)</span>
          </label>
          <div className="relative">
            <input
              type="email"
              value={signerEmail || ''}
              onChange={(e) => onSignerEmailChange(e.target.value)}
              disabled={disabled}
              placeholder="e.g., flightops@airline.com or rep@company.aero"
              className="w-full px-4 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-bold text-on-surface placeholder:opacity-30 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all disabled:opacity-50"
            />
            <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40 pointer-events-none" />
          </div>
        </div>
      )}

      {/* JavaScript Signature Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
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
        <div className="relative rounded-2xl border-2 border-dashed border-outline/60 bg-surface-container-lowest overflow-hidden transition-all hover:border-cyan-400/50">
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrawing}
            onPointerLeave={finishDrawing}
            onPointerCancel={finishDrawing}
            className={`w-full h-36 sm:h-44 block select-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
            }`}
            style={{ touchAction: 'none' }}
          />

          {/* Guidelines & Empty State Placeholder */}
          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center p-4">
              <PenTool className="w-5 h-5 text-cyan-400/30 mb-1.5" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-dim opacity-30">
                Sign Here Using Touch Screen or Mouse
              </span>
              <div className="w-3/4 border-b border-outline/30 mt-4"></div>
            </div>
          )}

          {/* Base guideline when signing */}
          {hasDrawn && (
            <div className="absolute bottom-5 left-8 right-8 border-b border-outline/20 pointer-events-none">
              <span className="absolute -top-3.5 right-0 text-[8px] font-mono uppercase text-on-surface-dim opacity-25">
                Signer Line
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
