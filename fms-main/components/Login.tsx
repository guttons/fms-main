import React, { useState, useEffect, useRef } from 'react';
import { Hexagon, Lock, User as UserIcon, ShieldCheck, AlertCircle, Search, Mail, IdCard, ArrowRight, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../supabase';
import { User, UserRole, StaffMember } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Logo } from './Logo';
import { haptic } from '../utils/haptics';

interface LoginProps {
  onLogin: (user: User) => void;
}

type LoginStep = 'identifier' | 'pin-input' | 'pin-setup' | 'forgot-pin';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<LoginStep>('identifier');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [credentialInput, setCredentialInput] = useState('');
  const [matchedStaff, setMatchedStaff] = useState<StaffMember | null>(null);
  
  // PIN states
  const PIN_LENGTH = 4;
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [confirmPin, setConfirmPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetPinState = () => {
    setPin(Array(PIN_LENGTH).fill(''));
    setConfirmPin(Array(PIN_LENGTH).fill(''));
    if (pinRefs.current[0]) pinRefs.current[0].focus();
  };

  const triggerShake = () => {
    setShake(true);
    haptic('ERROR');
    setTimeout(() => setShake(false), 500);
    resetPinState();
  };

  const handleCredentialSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!credentialInput.trim()) {
      haptic('WARNING');
      setError('Please enter an Email or RC Number');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const match = await supabaseService.findStaffByEmailOrRc(credentialInput);
      if (!match) {
        haptic('ERROR');
        setError(`No staff record found for "${credentialInput}".`);
        setIsProcessing(false);
        return;
      }

      if (match.status === 'inactive') {
        haptic('ERROR');
        setError(`Account is currently INACTIVE.`);
        setIsProcessing(false);
        return;
      }

      setMatchedStaff(match);

      // Check PIN status via API
      const res = await fetch('/api/bq/auth/check-auth-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: match.id })
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to check auth status');

      if (data.isLocked) {
        setIsLocked(true);
        setLockedUntil(new Date(data.lockedUntil));
        setError(`Account locked until ${new Date(data.lockedUntil).toLocaleTimeString()}`);
        setStep('pin-input');
      } else if (!data.hasPin || data.mustChangePin) {
        setStep('pin-setup');
      } else {
        setStep('pin-input');
      }
      
      haptic('TAP');
    } catch (err: any) {
      console.error('Credential lookup error:', err);
      haptic('ERROR');
      setError(err?.message || 'Verification failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    const val = value.replace(/[^0-9]/g, '');
    if (val.length > 1) return; // Prevent pasting multiple chars here for simplicity

    const newPinArray = isConfirm ? [...confirmPin] : [...pin];
    newPinArray[index] = val;
    
    if (isConfirm) {
      setConfirmPin(newPinArray);
    } else {
      setPin(newPinArray);
    }

    // Auto focus next
    if (val && index < PIN_LENGTH - 1) {
      const nextRef = isConfirm ? confirmPinRefs.current[index + 1] : pinRefs.current[index + 1];
      if (nextRef) nextRef.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent, isConfirm = false) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      const prevRef = isConfirm ? confirmPinRefs.current[index - 1] : pinRefs.current[index - 1];
      if (prevRef) {
        prevRef.focus();
        const newPinArray = isConfirm ? [...confirmPin] : [...pin];
        newPinArray[index - 1] = '';
        if (isConfirm) setConfirmPin(newPinArray);
        else setPin(newPinArray);
      }
    }
  };

  useEffect(() => {
    if (step === 'pin-input' && pin.every(p => p !== '')) {
      verifyPin(pin.join(''));
    }
  }, [pin, step]);

  const verifyPin = async (enteredPin: string) => {
    if (!matchedStaff) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/bq/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff.id, pin: enteredPin })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.locked) {
          setIsLocked(true);
          setLockedUntil(new Date(Date.now() + 15 * 60 * 1000));
          setError('Account locked due to too many failed attempts.');
        } else {
          setError(data.error || 'Invalid PIN');
        }
        triggerShake();
        return;
      }

      setSuccess(true);
      haptic('SUCCESS');
      
      setTimeout(() => {
        onLogin({
          id: matchedStaff.id,
          name: matchedStaff.name,
          role: matchedStaff.role,
          avatar: matchedStaff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedStaff.name)}`
        });
      }, 800);

    } catch (err: any) {
      setError(err.message || 'Verification failed');
      triggerShake();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetPin = async () => {
    const pinStr = pin.join('');
    const confirmPinStr = confirmPin.join('');
    
    if (pin.some(p => p === '') || confirmPin.some(p => p === '')) {
      setError('Please fill all PIN digits');
      haptic('WARNING');
      return;
    }
    
    if (pinStr !== confirmPinStr) {
      setError('PINs do not match');
      triggerShake();
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/bq/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff!.id, pin: pinStr })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to set PIN');

      haptic('SUCCESS');
      setStep('pin-input');
      resetPinState();
      setError('PIN set successfully. Please enter it to login.');
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN');
      haptic('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForgotPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/bq/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff!.id, email: forgotEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      
      setStep('identifier');
      setError(`Reset requested. Token: ${data.token} (Simulated email)`);
      haptic('SUCCESS');
    } catch (err: any) {
      setError(err.message || 'Request failed');
      haptic('ERROR');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    haptic('TAP');
    setIsProcessing(true);
    setError(null);
    try {
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid email profile',
        }
      });
      if (authErr) throw authErr;
    } catch (err: any) {
      console.error("Microsoft Login failed:", err);
      haptic('ERROR');
      setError(err.message || "Failed to sign in with Microsoft.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px] -mr-96 -mt-96 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className={`max-w-md w-full bg-surface p-10 sm:p-12 lg:p-14 border border-outline shadow-premium rounded-[48px] relative z-10 fade-in ${shake ? 'animate-shake' : ''}`}>
        <div className="text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <Logo className="h-20 sm:h-24 w-auto object-contain text-primary" />
          </div>
          <h2 className="headline-xl text-on-surface tracking-tighter mb-1 uppercase">
            FUEL SERVICES
          </h2>
          <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.5em] mt-3">
            FUEL MANAGEMENT SYSTEM
          </p>
        </div>

        <div className="mt-10 space-y-6">
          {error && (
            <div className="bg-error/10 text-error p-4 rounded-2xl text-[11px] border border-error/20 flex items-start space-x-3 fade-in font-bold">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'identifier' && (
            <div className="space-y-6 fade-in">
              <form onSubmit={handleCredentialSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">
                    Email or RC Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={credentialInput}
                      onChange={(e) => { setCredentialInput(e.target.value); setError(null); }}
                      placeholder="e.g. A-6600 or email"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-dim/40"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-40">
                      <IdCard className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="kinetic-gradient relative w-full flex items-center justify-center py-4 px-4 text-white text-[11px] font-black rounded-2xl hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50 uppercase tracking-[0.2em] shadow-premium"
                >
                  {isProcessing ? 'Checking...' : 'Continue'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </form>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline/40"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[9px] font-black text-on-surface-dim opacity-30 uppercase tracking-[0.4em] bg-surface">
                    Alternative Access
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleMicrosoftLogin}
                  disabled={isProcessing}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-outline text-[10px] font-black rounded-2xl text-on-surface-dim hover:bg-surface-dim hover:text-on-surface transition-all duration-300 uppercase tracking-widest"
                >
                  <Lock className="h-4 w-4 text-primary mr-3" />
                  Sign in with Microsoft OAuth
                </button>
              </div>
            </div>
          )}

          {step === 'pin-input' && (
            <div className="space-y-6 fade-in flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  {success ? <CheckCircle className="w-6 h-6 text-success" /> : <Lock className="w-6 h-6" />}
                </div>
                <h3 className="text-sm font-black text-on-surface">Welcome, {matchedStaff?.name}</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">Enter your PIN</p>
              </div>
              
              <div className="flex space-x-3 justify-center">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => pinRefs.current[idx] = el}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinChange(idx, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(idx, e)}
                    disabled={isLocked || success || isProcessing}
                    className="w-12 h-14 bg-surface-dim border border-outline rounded-xl text-center text-xl font-black text-on-surface focus:outline-none focus:border-primary transition-all disabled:opacity-50"
                  />
                ))}
              </div>

              <div className="w-full flex justify-between items-center px-2 mt-4">
                <button onClick={() => { setStep('identifier'); resetPinState(); setError(null); }} className="text-[10px] font-bold text-on-surface-dim hover:text-on-surface uppercase tracking-wider">
                  Back
                </button>
                <button onClick={() => { setStep('forgot-pin'); setError(null); }} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">
                  Forgot PIN?
                </button>
              </div>
            </div>
          )}

          {step === 'pin-setup' && (
            <div className="space-y-6 fade-in flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Setup PIN</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">Create a 4-digit PIN for quick access</p>
              </div>
              
              <div className="w-full space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-dim uppercase tracking-wider mb-2 text-center">New PIN</p>
                  <div className="flex space-x-3 justify-center">
                    {pin.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => pinRefs.current[idx] = el}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handlePinChange(idx, e.target.value)}
                        onKeyDown={e => handlePinKeyDown(idx, e)}
                        className="w-12 h-14 bg-surface-dim border border-outline rounded-xl text-center text-xl font-black text-on-surface focus:outline-none focus:border-primary"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-on-surface-dim uppercase tracking-wider mb-2 text-center">Confirm PIN</p>
                  <div className="flex space-x-3 justify-center">
                    {confirmPin.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => confirmPinRefs.current[idx] = el}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handlePinChange(idx, e.target.value, true)}
                        onKeyDown={e => handlePinKeyDown(idx, e, true)}
                        className="w-12 h-14 bg-surface-dim border border-outline rounded-xl text-center text-xl font-black text-on-surface focus:outline-none focus:border-primary"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full flex space-x-3 mt-4">
                <button
                  onClick={() => { setStep('identifier'); resetPinState(); setError(null); }}
                  className="flex-1 py-3 border border-outline rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-surface-dim"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetPin}
                  disabled={isProcessing}
                  className="flex-1 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50"
                >
                  Save PIN
                </button>
              </div>
            </div>
          )}

          {step === 'forgot-pin' && (
            <div className="space-y-6 fade-in">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-warning/10 rounded-full flex items-center justify-center text-warning mb-3">
                  <Info className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Reset PIN</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">Enter your email to receive a reset token</p>
              </div>

              <form onSubmit={handleForgotPinSubmit} className="space-y-4">
                <div>
                  <div className="relative">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Your registered email"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-dim opacity-40" />
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => { setStep('pin-input'); setError(null); }}
                    className="flex-1 py-3 border border-outline rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-surface-dim"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50"
                  >
                    Send Token
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-black text-on-surface-dim opacity-20 uppercase tracking-[0.6em]">
            MACL AVIATION & MARITIME SERVICES
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};
