import React from 'react';
import { ShieldAlert, IdCard, ArrowLeft, PhoneCall, Mail, AlertTriangle } from 'lucide-react';
import { Logo } from './Logo';

interface UnauthorizedPageProps {
  attemptedRc?: string;
  reason?: 'not_found' | 'inactive' | 'invalid_session' | 'unauthorized';
  onRetry: () => void;
}

export const UnauthorizedPage: React.FC<UnauthorizedPageProps> = ({
  attemptedRc,
  reason = 'not_found',
  onRetry
}) => {
  const getReasonTitle = () => {
    switch (reason) {
      case 'inactive':
        return 'Staff Account Deactivated';
      case 'invalid_session':
        return 'Session Expired or Revoked';
      case 'not_found':
      default:
        return 'Staff RC Number Not Recognized';
    }
  };

  const getReasonDescription = () => {
    switch (reason) {
      case 'inactive':
        return 'This employee RC number is currently marked as INACTIVE in the staff registry. System access has been suspended.';
      case 'invalid_session':
        return 'Your stored staff credentials could not be validated against the active staff directory. Please sign in again.';
      case 'not_found':
      default:
        return 'The entered Employee RC number is not registered in the MACL Fuel Management System. Access is strictly limited to authorized personnel.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden transition-colors duration-500">
      {/* Background glow accents */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-error/5 rounded-full blur-[140px] -mr-64 -mt-64 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />

      <div className="max-w-lg w-full bg-surface p-8 sm:p-12 border border-outline shadow-premium rounded-[40px] relative z-10 fade-in text-center">
        
        {/* MACL Brand Logo */}
        <div className="mx-auto mb-6 flex justify-center">
          <Logo className="h-16 sm:h-20 w-auto object-contain text-primary" />
        </div>

        {/* Security Warning Icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center text-error">
          <ShieldAlert className="w-9 h-9 animate-pulse" />
        </div>

        {/* Header Title */}
        <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight uppercase">
          Access Restricted
        </h2>
        <p className="text-[10px] font-black text-error uppercase tracking-[0.3em] mt-1">
          {getReasonTitle()}
        </p>

        {/* Attempted RC display (if provided) */}
        {attemptedRc && (
          <div className="mt-5 inline-flex items-center px-4 py-2 bg-surface-dim border border-outline rounded-2xl">
            <IdCard className="w-4 h-4 text-on-surface-dim opacity-50 mr-2" />
            <span className="text-xs font-mono font-black text-on-surface">
              {attemptedRc.toUpperCase()}
            </span>
            <span className="ml-2 px-2 py-0.5 text-[9px] font-black bg-error/20 text-error rounded-md uppercase">
              Unauthorized
            </span>
          </div>
        )}

        {/* Notice Card */}
        <div className="mt-6 p-5 bg-surface-dim border border-outline rounded-2xl text-left space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-on-surface">
                {getReasonDescription()}
              </p>
              <p className="text-[11px] text-on-surface-dim leading-relaxed">
                Only active employees with registered RC numbers in the MACL Staff Directory have permission to access aircraft refueling, depot logistics, and operations telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Contact & Instructions */}
        <div className="mt-6 p-4 rounded-2xl border border-outline/60 text-left space-y-2 text-[11px] text-on-surface-dim">
          <p className="font-bold text-on-surface text-xs">How to obtain access:</p>
          <p>
            If you are an active employee and believe this restriction is an error, please contact your <strong>Shift Supervisor</strong> or the <strong>Fuel Operations Admin Desk</strong> to register or verify your RC number.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] font-semibold text-on-surface-dim">
            <a 
              href="tel:+9603325511" 
              className="inline-flex items-center hover:text-primary transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 mr-1 text-primary" />
              Ext. 2404 / 2405 (Airport Ops)
            </a>
            <span className="hidden sm:inline opacity-30">•</span>
            <a 
              href="mailto:fuel.ops@macl.aero?subject=FMS%20RC%20Access%20Request" 
              className="inline-flex items-center hover:text-primary transition-colors"
            >
              <Mail className="w-3.5 h-3.5 mr-1 text-primary" />
              fuel.ops@macl.aero
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <button
            onClick={onRetry}
            className="kinetic-gradient w-full flex items-center justify-center py-4 px-6 text-white text-xs font-black rounded-2xl hover:scale-[1.01] active:scale-95 transition-all shadow-premium uppercase tracking-[0.2em]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Try Another RC Number
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-8">
          <p className="text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-[0.5em]">
            MACL Fuel Management Security Guard
          </p>
        </div>

      </div>
    </div>
  );
};
