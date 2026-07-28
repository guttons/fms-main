import React, { useState, useEffect } from 'react';
import { Hexagon, Lock, User as UserIcon, ShieldCheck, AlertCircle, Search, Mail, IdCard, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { User, UserRole, StaffMember } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Logo } from './Logo';
import { haptic } from '../utils/haptics';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Direct RC Number or Email Input
  const [credentialInput, setCredentialInput] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabaseService.getStaff().then(data => setStaffList(data)).catch(err => {
      console.warn('Failed to load staff list for login:', err);
    });
  }, []);

  const handleCredentialSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!credentialInput.trim()) {
      haptic('WARNING');
      setError('Please enter an Email or RC Number (e.g. A-6600 or ibr.hamdhan@macl.aero)');
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const match = await supabaseService.findStaffByEmailOrRc(credentialInput);
      if (!match) {
        haptic('ERROR');
        setError(`No staff record found for "${credentialInput}". Please check your Email or RC Number.`);
        setIsLoggingIn(false);
        return;
      }

      if (match.status === 'inactive') {
        haptic('ERROR');
        setError(`Account "${match.name}" (${match.employeeId}) is currently INACTIVE. Contact your System Administrator to enable access.`);
        setIsLoggingIn(false);
        return;
      }

      const user: User = {
        id: match.id,
        name: match.name,
        role: match.role,
        avatar: match.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.name)}`
      };

      haptic('SUCCESS');
      onLogin(user);
    } catch (err: any) {
      console.error('Credential login error:', err);
      haptic('ERROR');
      setError(err?.message || 'Login failed.');
    } finally {
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

  const handleStaffSelect = (staff: StaffMember) => {
    if (staff.status === 'inactive') {
      haptic('ERROR');
      setError(`Account "${staff.name}" (${staff.employeeId}) is currently INACTIVE. Contact System Administrator.`);
      return;
    }

    const user: User = {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      avatar: staff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}`
    };
    haptic('SUCCESS');
    onLogin(user);
  };

  const filteredStaff = staffList.filter(s => {
    if (!searchQuery.trim()) return true;
    const lower = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(lower) ||
      s.employeeId.toLowerCase().includes(lower) ||
      (s.email || '').toLowerCase().includes(lower) ||
      s.role.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px] -mr-96 -mt-96 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className="max-w-md w-full bg-surface p-10 sm:p-12 lg:p-14 border border-outline shadow-premium rounded-[48px] relative z-10 fade-in">
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

          {!showDirectory ? (
            <div className="space-y-6">
              {/* Form: Sign In with Email or RC Number */}
              <form onSubmit={handleCredentialSignIn} className="space-y-4">
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

                <button
                  onClick={() => setShowDirectory(true)}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent text-[10px] font-black rounded-2xl text-primary hover:bg-primary/5 transition-all duration-300 uppercase tracking-widest"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Browse MACL Staff Directory ({staffList.length})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-300">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest">MACL Staff Directory</h3>
                <button 
                  onClick={() => setShowDirectory(false)}
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
                      {staff.employeeId.replace('A-', '')}
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
                  <p className="text-center py-6 text-xs text-on-surface-dim opacity-50">No staff found matching "{searchQuery}".</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[9px] font-black text-on-surface-dim opacity-20 uppercase tracking-[0.6em]">
            MACL AVIATION & MARITIME SERVICES
          </p>
        </div>
      </div>
    </div>
  );
};
