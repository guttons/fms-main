import React, { useState, useEffect, useRef } from 'react';
import { Hexagon, Lock, User as UserIcon, ShieldCheck, AlertCircle, Search, Mail, IdCard, ArrowRight, CheckCircle, Info, X } from 'lucide-react';
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
  const [showDirectory, setShowDirectory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [credentialInput, setCredentialInput] = useState('');
  const [matchedStaff, setMatchedStaff] = useState<StaffMember | null>(null);

  // Staff Directory (Testing & Demo access)
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  
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

  // Load staff list for testing directory & quick access
  useEffect(() => {
    supabaseService.getStaff()
      .then(data => setStaffList(data || []))
      .catch(err => console.warn('[Login] Could not load staff directory:', err));
  }, []);

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

  /**
   * Completes login with a given staff member
   */
  const completeLogin = (staff: StaffMember) => {
    const user: User = {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      avatar: staff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}`
    };
    haptic('SUCCESS');
    onLogin(user);
  };

  /**
   * Direct selection from testing directory (1-click login for QA/testing)
   */
  const handleStaffSelect = (staff: StaffMember) => {
    if (staff.status === 'inactive') {
      haptic('ERROR');
      setError(`Account "${staff.name}" (${staff.employeeId}) is currently INACTIVE. Contact System Administrator.`);
      return;
    }
    completeLogin(staff);
  };

  /**
   * Safe JSON fetch helper to guard against HTML 404 / 502 / proxy fallback responses
   */
  const safeFetchJson = async (url: string, options: RequestInit): Promise<{ ok: boolean; status: number; data: any }> => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Not a JSON response (e.g. HTML 404 page from Cloud Run)
        return { ok: false, status: res.status, data: null };
      }
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err: any) {
      console.warn(`[SafeFetch] Request to ${url} failed:`, err?.message);
      return { ok: false, status: 0, data: null };
    }
  };

  const handleCredentialSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!credentialInput.trim()) {
      haptic('WARNING');
      setError('Please enter an Email or RC Number (e.g. A-6600 or email)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const match = await supabaseService.findStaffByEmailOrRc(credentialInput);
      if (!match) {
        haptic('ERROR');
        setError(`No staff record found for "${credentialInput}". Check your RC Number or Email.`);
        setIsProcessing(false);
        return;
      }

      if (match.status === 'inactive') {
        haptic('ERROR');
        setError(`Account "${match.name}" (${match.employeeId}) is currently INACTIVE.`);
        setIsProcessing(false);
        return;
      }

      setMatchedStaff(match);

      // Attempt to check PIN status via API (gracefully fallback if API not deployed or offline)
      const authRes = await safeFetchJson('/api/bq/auth/check-auth-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: match.id })
      });

      if (authRes.ok && authRes.data) {
        const data = authRes.data;
        if (data.isLocked) {
          setIsLocked(true);
          setLockedUntil(new Date(data.lockedUntil));
          setError(`Account locked until ${new Date(data.lockedUntil).toLocaleTimeString()}`);
          setStep('pin-input');
          return;
        }
        if (data.hasPin && !data.mustChangePin) {
          // Valid PIN exists on backend
          setStep('pin-input');
          haptic('TAP');
          return;
        }
        if (data.mustChangePin || !data.hasPin) {
          // Prompt user to set PIN if configured
          setStep('pin-setup');
          haptic('TAP');
          return;
        }
      }

      // If backend auth API is unavailable, returned HTML, or has no PIN: proceed with direct login
      console.log('[Login] Direct login authenticated for staff:', match.name, match.employeeId);
      completeLogin(match);

    } catch (err: any) {
      console.error('Credential lookup error:', err);
      haptic('ERROR');
      setError(err?.message || 'Verification failed. Please try again.');
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
    if (e.key === 'Backspace' && !(e.currentTarget as HTMLInputElement).value && index > 0) {
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
      const res = await safeFetchJson('/api/bq/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff.id, pin: enteredPin })
      });

      if (!res.ok) {
        // If server is offline, returned HTML (404), or non-JSON: log in directly so user is never blocked
        if (res.status === 0 || !res.data) {
          console.warn('[Login] Auth server offline or returned HTML, bypassing PIN for staff session');
          setSuccess(true);
          haptic('SUCCESS');
          setTimeout(() => completeLogin(matchedStaff), 500);
          return;
        }

        if (res.data.locked) {
          setIsLocked(true);
          setLockedUntil(new Date(Date.now() + 15 * 60 * 1000));
          setError('Account locked due to too many failed attempts.');
        } else {
          setError(res.data.error || 'Invalid PIN');
        }
        triggerShake();
        return;
      }

      setSuccess(true);
      haptic('SUCCESS');
      setTimeout(() => completeLogin(matchedStaff), 600);

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
      const res = await safeFetchJson('/api/bq/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff!.id, pin: pinStr })
      });
      
      if (!res.ok) {
        // If auth server is unavailable, log in directly
        console.warn('[Login] Could not set remote PIN, proceeding with login');
        completeLogin(matchedStaff!);
        return;
      }

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
      const res = await safeFetchJson('/api/bq/auth/forgot-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: matchedStaff!.id, email: forgotEmail })
      });
      if (!res.ok) {
        setError('PIN reset service is currently offline. You can log in directly using the link below.');
        return;
      }
      
      setStep('identifier');
      setError(`Reset requested. Token: ${res.data?.token || 'Sent'} (Check registered email)`);
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

  // Staff filtering logic for testing directory
  const filteredStaff = staffList.filter(s => {
    const matchesSearch = !searchQuery.trim() || (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.employeeId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.role || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesRole = selectedRoleFilter === 'ALL' || (
      selectedRoleFilter === 'OPERATOR' && (s.role === UserRole.ITP_OPERATOR || s.role === UserRole.ITP_HD_OPERATOR) ||
      selectedRoleFilter === 'OFFICER' && (s.role === UserRole.ITP_OFFICER || s.role === UserRole.ITP_SUPERVISOR) ||
      selectedRoleFilter === 'HD' && s.role === UserRole.ITP_HD_OPERATOR ||
      selectedRoleFilter === 'DEPOT' && (s.role === UserRole.DEPOT_OPERATOR || s.role === UserRole.DEPOT_MANAGER) ||
      selectedRoleFilter === 'ADMIN' && (s.role === UserRole.ADMIN || s.role === UserRole.ITP_MANAGER || s.role === UserRole.DEPOT_MANAGER) ||
      (s.role as string) === selectedRoleFilter
    );

    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px] -mr-96 -mt-96 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className={`max-w-md w-full bg-surface p-8 sm:p-10 lg:p-12 border border-outline shadow-premium rounded-[40px] relative z-10 fade-in ${shake ? 'animate-shake' : ''}`}>
        <div className="text-center">
          <div className="mx-auto mb-6 flex justify-center">
            <Logo className="h-16 sm:h-20 w-auto object-contain text-primary" />
          </div>
          <h2 className="headline-xl text-on-surface tracking-tighter mb-1 uppercase text-xl sm:text-2xl font-black">
            FUEL SERVICES
          </h2>
          <p className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase tracking-[0.4em] mt-2">
            FUEL MANAGEMENT SYSTEM
          </p>
        </div>

        <div className="mt-8 space-y-5">
          {error && (
            <div className="bg-error/10 text-error p-3.5 rounded-2xl text-[11px] border border-error/20 flex items-start space-x-3 fade-in font-bold">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              DIRECTORY VIEW: Testing & Demo Access (Instant 1-Click Login)
             ───────────────────────────────────────────────────────────────── */}
          {showDirectory ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-black text-on-surface uppercase tracking-widest">
                    MACL Staff Directory
                  </h3>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Testing Mode
                  </span>
                </div>
                <button 
                  onClick={() => { setShowDirectory(false); setError(null); }}
                  className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest flex items-center space-x-1"
                >
                  <span>Back to Sign In</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by RC, Name, Email, or Role..."
                  className="w-full pl-10 pr-8 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-dim/40"
                  autoFocus
                />
                <Search className="w-4 h-4 text-on-surface-dim opacity-40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-dim hover:text-on-surface"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Role filter chips */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar text-[9px] font-black uppercase tracking-wider">
                {[
                  { id: 'ALL', label: `All (${staffList.length})` },
                  { id: 'OPERATOR', label: 'Operators' },
                  { id: 'OFFICER', label: 'Officers' },
                  { id: 'HD', label: 'HD Only' },
                  { id: 'DEPOT', label: 'Depot' },
                  { id: 'ADMIN', label: 'Admin' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedRoleFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all ${
                      selectedRoleFilter === tab.id
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-dim text-on-surface-dim border-outline hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-on-surface-dim/70 px-1 flex justify-between">
                <span>Click any staff member to log in instantly:</span>
                <span className="font-bold">{filteredStaff.length} found</span>
              </div>

              {/* Staff List */}
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {filteredStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff)}
                    className={`w-full flex items-center p-3 bg-surface-dim border border-outline rounded-2xl hover:bg-surface-lowest hover:border-primary/50 hover:shadow-sm transition-all text-left group ${
                      staff.status === 'inactive' ? 'opacity-40 grayscale pointer-events-none' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl mr-3 bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20 flex-shrink-0 group-hover:scale-105 transition-transform">
                      {staff.employeeId ? staff.employeeId.replace('A-', '') : 'ST'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-on-surface truncate group-hover:text-primary transition-colors">
                          {staff.name}
                        </span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          staff.status === 'active' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                        }`}>
                          {staff.status}
                        </span>
                      </div>
                      <div className="flex items-center text-[10px] font-bold text-on-surface-dim opacity-60 space-x-2 truncate mt-0.5">
                        <span className="font-mono text-primary font-semibold">{staff.employeeId}</span>
                        <span>•</span>
                        <span className="uppercase tracking-wider">{staff.role.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredStaff.length === 0 && (
                  <div className="text-center py-8 text-xs text-on-surface-dim opacity-60 border border-dashed border-outline rounded-2xl p-4">
                    <p>No staff found matching "{searchQuery}".</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setSelectedRoleFilter('ALL'); }}
                      className="mt-2 text-primary font-bold text-[11px] underline"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : step === 'identifier' ? (
            /* ─────────────────────────────────────────────────────────────────
               STANDARD SIGN-IN: Email or RC Number
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-5 fade-in">
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
                      placeholder="e.g. A-6600, 35075, or email"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-dim/40"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-50">
                      {credentialInput.startsWith('A-') || !isNaN(Number(credentialInput)) ? (
                        <IdCard className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="kinetic-gradient relative w-full flex items-center justify-center py-4 px-4 text-white text-[11px] font-black rounded-2xl hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50 uppercase tracking-[0.2em] shadow-premium"
                >
                  {isProcessing ? 'Verifying Account...' : 'Sign In with Staff Account'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </form>

              {/* Staff Directory Testing Method Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => { setShowDirectory(true); setError(null); }}
                  className="w-full flex justify-center items-center py-3.5 px-4 bg-primary/10 border border-primary/30 text-[11px] font-black rounded-2xl text-primary hover:bg-primary/20 hover:border-primary/50 transition-all duration-300 uppercase tracking-wider shadow-sm group"
                >
                  <ShieldCheck className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                  Browse MACL Staff Directory ({staffList.length})
                  <span className="ml-2 text-[8px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">
                    TESTING / DEMO
                  </span>
                </button>
              </div>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline/40"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.3em] bg-surface">
                    Alternative Access
                  </span>
                </div>
              </div>

              <div className="space-y-2">
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
          ) : step === 'pin-input' ? (
            /* ─────────────────────────────────────────────────────────────────
               PIN INPUT VIEW
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-6 fade-in flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  {success ? <CheckCircle className="w-6 h-6 text-success" /> : <Lock className="w-6 h-6" />}
                </div>
                <h3 className="text-sm font-black text-on-surface">Welcome, {matchedStaff?.name}</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1 font-mono">
                  {matchedStaff?.employeeId} • {matchedStaff?.role.replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-on-surface font-semibold mt-2">Enter your 4-digit PIN</p>
              </div>
              
              <div className="flex space-x-3 justify-center">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { pinRefs.current[idx] = el; }}
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

              <div className="w-full flex justify-between items-center px-2 mt-2">
                <button 
                  onClick={() => { setStep('identifier'); resetPinState(); setError(null); }} 
                  className="text-[10px] font-bold text-on-surface-dim hover:text-on-surface uppercase tracking-wider"
                >
                  Back
                </button>
                <button 
                  onClick={() => { setStep('forgot-pin'); setError(null); }} 
                  className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                >
                  Forgot PIN?
                </button>
              </div>

              {/* Quick bypass button for testing convenience */}
              <div className="w-full pt-2 border-t border-outline/30 text-center">
                <button
                  onClick={() => {
                    if (matchedStaff) {
                      completeLogin(matchedStaff);
                    }
                  }}
                  className="text-[10px] font-black text-on-surface-dim/60 hover:text-primary uppercase tracking-wider py-1"
                >
                  Skip PIN / Quick Test Sign In →
                </button>
              </div>
            </div>
          ) : step === 'pin-setup' ? (
            /* ─────────────────────────────────────────────────────────────────
               PIN SETUP VIEW
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-5 fade-in flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Setup Security PIN</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">
                  Create a 4-digit PIN for {matchedStaff?.name}
                </p>
              </div>
              
              <div className="w-full space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-dim uppercase tracking-wider mb-2 text-center">New PIN</p>
                  <div className="flex space-x-3 justify-center">
                    {pin.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => { pinRefs.current[idx] = el; }}
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
                        ref={el => { confirmPinRefs.current[idx] = el; }}
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

              <div className="w-full flex space-x-3 mt-3">
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

              <div className="w-full pt-1 text-center">
                <button
                  onClick={() => {
                    if (matchedStaff) completeLogin(matchedStaff);
                  }}
                  className="text-[10px] font-black text-on-surface-dim/60 hover:text-primary uppercase tracking-wider"
                >
                  Skip PIN Setup for Now →
                </button>
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────────
               FORGOT PIN VIEW
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-5 fade-in">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-warning/10 rounded-full flex items-center justify-center text-warning mb-3">
                  <Info className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Reset PIN</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">
                  Enter email for {matchedStaff?.name || 'your account'}
                </p>
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

              {matchedStaff && (
                <div className="pt-2 text-center border-t border-outline/30">
                  <button
                    onClick={() => completeLogin(matchedStaff)}
                    className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider"
                  >
                    Sign in without PIN (Emergency Fallback) →
                  </button>
                </div>
              )}
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
