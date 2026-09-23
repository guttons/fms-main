import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, ShieldCheck, AlertCircle, Search, Mail, IdCard, ArrowRight, CheckCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '../supabase';
import { User, UserRole, StaffMember } from '../types';
import { supabaseService } from '../services/supabaseService';
import { staffAuthService } from '../services/staffAuthService';
import { Logo } from './Logo';
import { UnauthorizedPage } from './UnauthorizedPage';
import { haptic } from '../utils/haptics';

interface LoginProps {
  onLogin: (user: User) => void;
}

type LoginStep = 'identifier' | 'password-setup' | 'forgot-password' | 'unauthorized';

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<LoginStep>('identifier');
  const [unauthorizedRc, setUnauthorizedRc] = useState<string>('');
  const [unauthorizedReason, setUnauthorizedReason] = useState<'not_found' | 'inactive' | 'invalid_session'>('not_found');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Credential inputs
  const [credentialInput, setCredentialInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New Password Setup
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [matchedStaff, setMatchedStaff] = useState<StaffMember | null>(null);
  const [shake, setShake] = useState(false);

  // Staff Directory for Testing & Demo
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabaseService.getStaff()
      .then(data => setStaffList(data || []))
      .catch(err => {
        console.warn('Failed to load staff list for login:', err);
      });
  }, []);

  const triggerShake = () => {
    setShake(true);
    haptic('ERROR');
    setTimeout(() => setShake(false), 500);
  };

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
   * Handle testing directory 1-click login
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
   * Handle primary password credential authentication
   */
  const handleCredentialSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!credentialInput.trim()) {
      haptic('WARNING');
      setError('Please enter an Email or RC Number');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const match = await supabaseService.findStaffByEmailOrRc(credentialInput);
      if (!match) {
        haptic('ERROR');
        setUnauthorizedRc(credentialInput.trim());
        setUnauthorizedReason('not_found');
        setStep('unauthorized');
        setIsLoggingIn(false);
        return;
      }

      if (match.status === 'inactive') {
        haptic('ERROR');
        setUnauthorizedRc(match.employeeId || credentialInput.trim());
        setUnauthorizedReason('inactive');
        setStep('unauthorized');
        setIsLoggingIn(false);
        return;
      }

      setMatchedStaff(match);

      // Check if user has a password configured
      const hasPassword = await staffAuthService.hasPassword(match.id);

      if (!hasPassword) {
        // First-time user setup: prompt to create a password
        if (passwordInput && passwordInput.length >= 4) {
          // If they already entered a valid password in the input, save it and log in
          await staffAuthService.setPassword(match.id, passwordInput);
          completeLogin(match);
          return;
        }

        // Show password setup view
        setStep('password-setup');
        setIsLoggingIn(false);
        return;
      }

      // User has a password — verify it
      if (!passwordInput) {
        haptic('WARNING');
        setError('Please enter your password.');
        setIsLoggingIn(false);
        return;
      }

      const verifyResult = await staffAuthService.verifyPassword(match.id, passwordInput);
      if (!verifyResult.success) {
        triggerShake();
        setError(verifyResult.error || 'Invalid password.');
        setIsLoggingIn(false);
        return;
      }

      // Success
      completeLogin(match);

    } catch (err: any) {
      console.error('Credential login error:', err);
      haptic('ERROR');
      setError(err?.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  /**
   * Handle first-time password setup submission
   */
  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedStaff) return;

    if (!newPassword || newPassword.length < 4) {
      haptic('WARNING');
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      triggerShake();
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const res = await staffAuthService.setPassword(matchedStaff.id, newPassword);
      if (!res.success) {
        setError(res.error || 'Failed to set password.');
        setIsLoggingIn(false);
        return;
      }

      completeLogin(matchedStaff);
    } catch (err: any) {
      setError(err?.message || 'Failed to save password.');
      setIsLoggingIn(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    haptic('TAP');
    setIsLoggingIn(true);
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
      setIsLoggingIn(false);
    }
  };

  const filteredStaff = staffList.filter(s => {
    if (!searchQuery.trim()) return true;
    const lower = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(lower) ||
      (s.employeeId || '').toLowerCase().includes(lower) ||
      (s.email || '').toLowerCase().includes(lower) ||
      (s.role || '').toLowerCase().includes(lower)
    );
  });

  if (step === 'unauthorized') {
    return (
      <UnauthorizedPage
        attemptedRc={unauthorizedRc}
        reason={unauthorizedReason}
        onRetry={() => {
          setStep('identifier');
          setError(null);
          setCredentialInput('');
          setPasswordInput('');
        }}
      />
    );
  }

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

          {/* ─────────────────────────────────────────────────────────────────
              DIRECTORY VIEW: Testing & Demo Access (Instant 1-Click Login)
             ───────────────────────────────────────────────────────────────── */}
          {showDirectory ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-300">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest">
                  MACL Staff Directory
                </h3>
                <button 
                  onClick={() => { setShowDirectory(false); setError(null); }}
                  className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
                >
                  Back to Sign In
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by RC Number, Name, Email, or Role..."
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-dim border border-outline rounded-xl text-xs font-semibold text-on-surface focus:outline-none focus:border-primary"
                  autoFocus
                />
                <Search className="w-4 h-4 text-on-surface-dim opacity-40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Staff List */}
              <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {filteredStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleStaffSelect(staff)}
                    className={`w-full flex items-center p-3 bg-surface-dim border border-outline rounded-2xl hover:bg-surface-lowest hover:border-primary/40 transition-all text-left group ${
                      staff.status === 'inactive' ? 'opacity-50 grayscale' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl mr-3 bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20 flex-shrink-0">
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
                      <div className="flex items-center text-[10px] font-bold text-on-surface-dim opacity-50 space-x-2 truncate">
                        <span>{staff.employeeId}</span>
                        <span>•</span>
                        <span className="uppercase">{staff.role.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredStaff.length === 0 && (
                  <p className="text-center py-6 text-xs text-on-surface-dim opacity-50">
                    No staff found matching "{searchQuery}".
                  </p>
                )}
              </div>
            </div>
          ) : step === 'identifier' ? (
            /* ─────────────────────────────────────────────────────────────────
               STANDARD SIGN-IN: Email/RC Number + Password
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-6 fade-in">
              <form onSubmit={handleCredentialSignIn} className="space-y-4">
                {/* Identifier Field */}
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">
                    Email or RC Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={credentialInput}
                      onChange={(e) => { setCredentialInput(e.target.value); setError(null); }}
                      placeholder="Email or RC Number"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-dim/40 placeholder:font-medium"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-40">
                      {credentialInput.startsWith('A-') || !isNaN(Number(credentialInput)) ? (
                        <IdCard className="w-4 h-4" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setStep('forgot-password'); setError(null); }}
                      className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => { setPasswordInput(e.target.value); setError(null); }}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-11 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all placeholder:text-on-surface-dim/40 placeholder:font-medium"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-40 hover:opacity-100 transition-opacity"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="kinetic-gradient relative w-full flex items-center justify-center py-4 px-4 text-white text-[11px] font-black rounded-2xl hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50 uppercase tracking-[0.2em] shadow-premium"
                >
                  {isLoggingIn ? 'Authenticating...' : 'Sign In with Staff Account'}
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
                  disabled={isLoggingIn}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-outline text-[10px] font-black rounded-2xl text-on-surface-dim hover:bg-surface-dim hover:text-on-surface transition-all duration-300 uppercase tracking-widest"
                >
                  <Lock className="h-4 w-4 text-primary mr-3" />
                  Sign in with Microsoft OAuth
                </button>

                {/* RBAC Compliance Notice */}
                <div className="w-full flex items-center justify-center py-2.5 px-3 border border-outline/50 rounded-2xl bg-surface-dim text-[10px] font-bold text-on-surface-dim text-center">
                  <ShieldCheck className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                  <span>MACL: Active Staff Authentication Required</span>
                </div>
              </div>
            </div>
          ) : step === 'password-setup' ? (
            /* ─────────────────────────────────────────────────────────────────
               PASSWORD SETUP VIEW: First-time setup
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-6 fade-in flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Welcome, {matchedStaff?.name}</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">
                  Create a password for your account ({matchedStaff?.employeeId})
                </p>
              </div>

              <form onSubmit={handleSetPasswordSubmit} className="w-full space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                      placeholder="Minimum 4 characters"
                      className="w-full pl-11 pr-11 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all"
                      required
                      autoFocus
                    />
                    <Lock className="w-4 h-4 text-on-surface-dim opacity-40 absolute left-4 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-dim opacity-40 hover:opacity-100"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-on-surface-dim uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                      placeholder="Re-enter password"
                      className="w-full pl-11 pr-4 py-3.5 bg-surface-dim border border-outline rounded-2xl text-xs font-bold text-on-surface focus:outline-none focus:border-primary transition-all"
                      required
                    />
                    <Lock className="w-4 h-4 text-on-surface-dim opacity-40 absolute left-4 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep('identifier'); setError(null); }}
                    className="flex-1 py-3 border border-outline rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-surface-dim"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save & Sign In
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────────
               FORGOT PASSWORD VIEW
               ───────────────────────────────────────────────────────────────── */
            <div className="space-y-6 fade-in">
              <div className="text-center w-full">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-on-surface">Password Recovery</h3>
                <p className="text-[10px] text-on-surface-dim uppercase tracking-wider mt-1">
                  Reset password for individual staff
                </p>
              </div>

              <div className="p-4 bg-surface-dim border border-outline rounded-2xl text-xs text-on-surface-dim space-y-2">
                <p className="font-bold text-on-surface">Contact Shift Supervisor or System Admin</p>
                <p className="text-[11px]">
                  Your shift supervisor or system administrator can instantly reset your password in the <strong>Staff Tracker</strong> or <strong>Staff Management</strong> console.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => { setStep('identifier'); setError(null); }}
                  className="flex-1 py-3 border border-outline rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-surface-dim"
                >
                  Back to Sign In
                </button>
                <a
                  href="mailto:fuel.ops@macl.aero?subject=MACL%20FMS%20Password%20Reset%20Request"
                  className="flex-1 flex items-center justify-center kinetic-gradient text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:scale-[1.01] active:scale-95 shadow-premium transition-all py-3"
                >
                  Contact Admin Desk
                </a>
              </div>
            </div>
          )}

        </div>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-black text-on-surface-dim opacity-20 uppercase tracking-[0.6em]">
            MACL FUEL SERVICES
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
